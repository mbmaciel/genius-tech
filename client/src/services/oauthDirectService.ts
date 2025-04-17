/**
 * Serviço de trading que estabelece conexão direta com o servidor Deriv via OAuth
 * 
 * Mantém uma conexão WebSocket dedicada, independente do frontend
 * VERSÃO ATUALIZADA: Suporta múltiplos tokens e contas do usuário
 */
import { 
  TradingEvent, 
  TradingSettings, 
  OAuthDirectServiceInterface 
} from './oauthDirectService.interface';

interface TokenInfo {
  token: string;
  loginid?: string;
  authorized: boolean;
  connected: boolean;
  primary: boolean;
}

class OAuthDirectService implements OAuthDirectServiceInterface {
  private webSocket: WebSocket | null = null;
  private tokens: TokenInfo[] = [];
  private activeToken: string | null = null;
  private isRunning: boolean = false;
  private eventListeners: Array<(event: TradingEvent) => void> = [];
  private currentContractId: string | number | null = null;
  private settings: TradingSettings = {
    entryValue: 0.35,
    profitTarget: 20,
    lossLimit: 20,
    martingaleFactor: 1.5,
    contractType: 'DIGITOVER',
    prediction: 5
  };
  private activeStrategy: string = '';
  private operationTimeout: any = null;
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private reconnectAttempts: number = 0;
  private initialized: boolean = false;
  
  constructor() {
    console.log('[OAUTH_DIRECT] Inicializando serviço de trading OAuth com conexão dedicada');
    
    // Inicializar com os tokens disponíveis
    this.loadAllTokens();
  }
  
  /**
   * Carrega todos os tokens disponíveis de todas as fontes
   */
  private loadAllTokens(): void {
    try {
      this.tokens = []; // Resetar lista de tokens
      
      // 1. Tentar obter token principal do localStorage
      const mainToken = localStorage.getItem('deriv_oauth_token');
      if (mainToken) {
        this.addToken(mainToken, true);
        console.log('[OAUTH_DIRECT] Token OAuth principal encontrado no localStorage');
      }
      
      // 2. Tentar obter tokens adicionais das contas salvas
      const accountsStr = localStorage.getItem('deriv_accounts');
      if (accountsStr) {
        try {
          const accounts = JSON.parse(accountsStr);
          if (accounts && Array.isArray(accounts) && accounts.length > 0) {
            accounts.forEach((acc: any) => {
              if (acc.token && (!mainToken || acc.token !== mainToken)) {
                this.addToken(acc.token, false, acc.loginid);
              }
            });
            console.log(`[OAUTH_DIRECT] ${accounts.length} contas encontradas no localStorage`);
          }
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao processar contas salvas:', error);
        }
      }
      
      // Se encontramos pelo menos um token, usar o primeiro como ativo
      if (this.tokens.length > 0) {
        const primaryToken = this.tokens.find(t => t.primary) || this.tokens[0];
        this.activeToken = primaryToken.token;
        console.log(`[OAUTH_DIRECT] Total de ${this.tokens.length} tokens carregados. Token ativo: ${primaryToken.loginid || 'desconhecido'}`);
      } else {
        console.warn('[OAUTH_DIRECT] Nenhum token encontrado em qualquer fonte!');
      }
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao carregar tokens:', error);
    }
  }
  
  /**
   * Adiciona um token à lista se ele ainda não existir
   */
  private addToken(token: string, isPrimary: boolean = false, loginid?: string): void {
    // Verificar se o token já existe na lista
    if (!this.tokens.some(t => t.token === token)) {
      this.tokens.push({
        token: token,
        loginid: loginid,
        authorized: false,
        connected: false,
        primary: isPrimary
      });
    }
  }
  
  /**
   * Configura a conexão WebSocket
   */
  private setupWebSocket(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Verificar se temos tokens disponíveis
        if (this.tokens.length === 0) {
          // Tentar carregar novamente os tokens
          this.loadAllTokens();
          
          if (this.tokens.length === 0) {
            console.error('[OAUTH_DIRECT] Nenhum token OAuth encontrado');
            reject(new Error('Nenhum token OAuth encontrado. Faça login novamente.'));
            return;
          }
        }
        
        // Verificar se temos um token ativo
        if (!this.activeToken) {
          this.activeToken = this.tokens[0].token;
        }
        
        // Limpar conexão existente se houver
        this.closeConnection();
        
        console.log('[OAUTH_DIRECT] Estabelecendo conexão WebSocket dedicada com Deriv');
        this.webSocket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=71403');
        
        // Configurar timeout para conexão
        const connectionTimeout = setTimeout(() => {
          reject(new Error('Timeout ao conectar ao servidor'));
        }, 10000);
        
        // Handler de abertura
        this.webSocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('[OAUTH_DIRECT] Conexão WebSocket estabelecida com sucesso!');
          
          // Configurar ping para manter conexão
          this.setupKeepAlive();
          
          // Iniciar processo de autorização com todos os tokens
          this.authorizeAllTokens()
            .then(() => {
              this.initialized = true;
              resolve(true);
            })
            .catch((error) => reject(error));
        };
        
        // Handler de erro
        this.webSocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('[OAUTH_DIRECT] Erro na conexão WebSocket:', error);
          this.scheduleReconnect();
          reject(error);
        };
        
        // Handler de fechamento
        this.webSocket.onclose = () => {
          console.log('[OAUTH_DIRECT] Conexão WebSocket fechada');
          this.scheduleReconnect();
          
          // Se estiver em estado de execução, notificar erro
          if (this.isRunning) {
            this.notifyListeners({
              type: 'error',
              message: 'Conexão com o servidor perdida. Tentando reconectar automaticamente.'
            });
          }
        };
        
        // Handler de mensagens
        this.webSocket.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro ao configurar WebSocket:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Manipula mensagens recebidas do WebSocket
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Log resumido para depuração
      console.log(`[OAUTH_DIRECT] Mensagem recebida (${data.msg_type})`);
      
      // Resposta de autorização
      if (data.msg_type === 'authorize') {
        if (data.error) {
          console.error('[OAUTH_DIRECT] Erro na autorização:', data.error.message);
          this.notifyListeners({
            type: 'error',
            message: `Erro na autorização: ${data.error.message}`
          });
        } else {
          console.log('[OAUTH_DIRECT] Autorização bem-sucedida:', data.authorize?.loginid);
          this.notifyListeners({
            type: 'authorized',
            account: data.authorize
          });
          
          // Após autorização bem-sucedida, inscrever-se para receber ticks
          this.subscribeToTicks();
        }
      }
      
      // Resposta de tick
      if (data.msg_type === 'tick') {
        // Processar tick recebido diretamente da conexão
        const price = data.tick.quote;
        const lastDigit = Math.floor(price * 100) % 10;
        const symbol = data.tick.symbol;
        const epoch = data.tick.epoch;
        
        console.log(`[OAUTH_DIRECT] Tick recebido: ${price}, Último dígito: ${lastDigit}`);
        
        // Notificar para atualização de interface
        this.notifyListeners({
          type: 'tick',
          price: price,
          lastDigit: lastDigit,
          symbol: symbol,
          epoch: epoch
        });
        
        // Se o bot estiver executando, analise o tick para possível operação
        if (this.isRunning && !this.currentContractId) {
          this.analyzeTickForOperation(price, lastDigit);
        }
      }
      
      // Resposta de compra
      if (data.msg_type === 'buy') {
        if (data.error) {
          console.error('[OAUTH_DIRECT] Erro ao comprar contrato:', data.error.message);
          this.notifyListeners({
            type: 'error',
            message: data.error.message
          });
          
          // Agendar próxima operação mesmo com erro
          if (this.isRunning) {
            this.scheduleNextOperation();
          }
        } else if (data.buy) {
          const contractId = data.buy.contract_id;
          const buyPrice = data.buy.buy_price;
          
          console.log(`[OAUTH_DIRECT] Contrato comprado: ID ${contractId}, Valor $${buyPrice}`);
          this.currentContractId = contractId;
          
          this.notifyListeners({
            type: 'contract_purchased',
            contract_id: contractId,
            buy_price: buyPrice
          });
          
          // Monitorar contrato
          this.monitorContract(contractId);
        }
      }
      
      // Atualização de contrato aberto
      if (data.msg_type === 'proposal_open_contract') {
        const contract = data.proposal_open_contract;
        
        if (contract && contract.contract_id === this.currentContractId) {
          // Atualizar interface com status do contrato
          this.notifyListeners({
            type: 'contract_update',
            contract: contract
          });
          
          // Verificar se o contrato foi encerrado
          if (contract.is_sold === 1) {
            console.log('[OAUTH_DIRECT] Contrato encerrado:', contract);
            
            // Calcular resultado
            const isWin = contract.profit >= 0;
            const profit = parseFloat(contract.profit);
            
            this.notifyListeners({
              type: 'contract_finished',
              contract_id: contract.contract_id,
              profit: profit,
              is_win: isWin,
              contract_details: contract
            });
            
            this.currentContractId = null;
            
            // Se o bot ainda estiver em execução, programar próxima operação
            if (this.isRunning) {
              this.scheduleNextOperation();
            }
          }
        }
      }
      
      // Resposta de saldo
      if (data.msg_type === 'balance') {
        console.log('[OAUTH_DIRECT] Atualização de saldo recebida:', data.balance);
        
        // Notificar para atualização de interface
        this.notifyListeners({
          type: 'balance_update',
          balance: data.balance
        });
      }
      
      // Resposta de ping
      if (data.msg_type === 'ping') {
        // Responder com pong para manter a conexão
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
          this.webSocket.send(JSON.stringify({ pong: 1 }));
        }
      }
      
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao processar mensagem:', error);
    }
  }
  
  /**
   * Inscreve para receber ticks do R_100
   */
  private subscribeToTicks(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está disponível para inscrição de ticks');
      return;
    }
    
    console.log('[OAUTH_DIRECT] Inscrevendo para receber ticks do R_100...');
    
    // Inscrever para ticks do R_100
    this.webSocket.send(JSON.stringify({
      ticks: 'R_100',
      subscribe: 1
    }));
    
    // Inscrever para atualizações de saldo
    this.webSocket.send(JSON.stringify({
      balance: 1,
      subscribe: 1
    }));
  }
  
  /**
   * Analisa o tick recebido para possível execução de operação
   */
  private analyzeTickForOperation(price: number, lastDigit: number): void {
    // Esta função permite analisar o tick para decidir quando executar uma operação
    // Nesta implementação simplificada, apenas registramos o tick
    
    // Exemplo: Executar de acordo com a estratégia e último dígito
    const shouldExecute = this.shouldExecuteBasedOnStrategy(lastDigit);
    
    if (shouldExecute) {
      console.log(`[OAUTH_DIRECT] Condições atendidas para operação: dígito ${lastDigit}`);
      this.executeOperation();
    }
  }
  
  /**
   * Determina se deve executar operação com base na estratégia e dígito
   */
  private shouldExecuteBasedOnStrategy(lastDigit: number): boolean {
    // Implementação básica para decisão de execução
    // Na versão atual, vamos simplificar e permitir execução a cada tick
    return true;
  }
  
  /**
   * Autoriza apenas o token da conta selecionada na dashboard
   */
  private authorizeAllTokens(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Definir variáveis de controle
      let authorizedPrimaryToken = false;
      let authorizedAnyToken = false;

      console.log(`[OAUTH_DIRECT] Buscando token da conta selecionada na dashboard`);
      
      if (this.tokens.length === 0) {
        reject(new Error('Nenhum token disponível para autorização'));
        return;
      }
      
      // Verificar se temos um token da dashboard
      const dashboardToken = localStorage.getItem('deriv_oauth_token');
      
      if (!dashboardToken) {
        reject(new Error('Nenhum token de dashboard encontrado. Por favor, selecione uma conta na dashboard'));
        return;
      }
      
      console.log('[OAUTH_DIRECT] Token da dashboard encontrado, autorizando apenas esta conta');
      
      // Verificar se este token já existe na nossa lista
      let tokenInfo = this.tokens.find(t => t.token === dashboardToken);
      
      if (!tokenInfo) {
        // Se não existe, adicionamos ele
        console.log('[OAUTH_DIRECT] Adicionando token da dashboard na lista');
        this.addToken(dashboardToken, true);
        tokenInfo = this.tokens.find(t => t.token === dashboardToken);
      }
      
      if (tokenInfo) {
        // Marcar o token como primário
        tokenInfo.primary = true;
        
        // Definir como token ativo para todas as operações
        this.activeToken = dashboardToken;
        
        try {
          // Autorizar apenas este token
          await this.authorizeToken(dashboardToken);
          
          // Marcar como autorizado
          tokenInfo.authorized = true;
          tokenInfo.connected = true;
          
          console.log(`[OAUTH_DIRECT] Token da dashboard autorizado com sucesso: ${tokenInfo.loginid || 'desconhecido'}`);
          
          // Inscrever para ticks
          this.subscribeToTicks();
          
          resolve();
        } catch (error) {
          console.error(`[OAUTH_DIRECT] Falha ao autorizar token da dashboard:`, error);
          reject(error);
        }
      } else {
        reject(new Error('Falha ao configurar token da dashboard'));
      }
    });
  }
  
  /**
   * Autoriza um token específico
   */
  private authorizeToken(token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket não está conectado'));
        return;
      }
      
      if (!token) {
        reject(new Error('Token inválido'));
        return;
      }
      
      console.log('[OAUTH_DIRECT] Autorizando com token OAuth...');
      
      // Configura timeout para autorização
      const authTimeout = setTimeout(() => {
        reject(new Error('Timeout na autorização'));
      }, 5000);
      
      // Handler para mensagem de autorização
      const authHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.msg_type === 'authorize') {
            this.webSocket?.removeEventListener('message', authHandler);
            clearTimeout(authTimeout);
            
            if (data.error) {
              console.error('[OAUTH_DIRECT] Erro na autorização:', data.error.message);
              reject(new Error(data.error.message));
            } else {
              console.log('[OAUTH_DIRECT] Autorização bem-sucedida para:', data.authorize?.loginid);
              
              // Atualizar loginid do token correspondente
              const tokenIndex = this.tokens.findIndex(t => t.token === token);
              if (tokenIndex >= 0) {
                this.tokens[tokenIndex].loginid = data.authorize?.loginid;
              }
              
              // Notificar autorização bem-sucedida
              this.notifyListeners({
                type: 'authorized',
                account: data.authorize
              });
              
              resolve();
            }
          }
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao processar mensagem de autorização:', error);
        }
      };
      
      // Adicionar handler temporário para autorização
      this.webSocket.addEventListener('message', authHandler);
      
      // Enviar solicitação de autorização
      this.webSocket.send(JSON.stringify({
        authorize: token
      }));
    });
  }
  
  /**
   * Configura envio periódico de ping para manter a conexão ativa
   */
  private setupKeepAlive(): void {
    // Limpar intervalo existente se houver
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Configurar novo intervalo
    this.pingInterval = setInterval(() => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000); // 30 segundos
  }
  
  /**
   * Agenda tentativa de reconexão
   */
  private scheduleReconnect(): void {
    // Limpar timeout existente se houver
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Incrementar contador de tentativas
    this.reconnectAttempts++;
    
    // Limitar número de tentativas
    if (this.reconnectAttempts > 10) {
      console.log('[OAUTH_DIRECT] Número máximo de tentativas de reconexão atingido');
      this.notifyListeners({
        type: 'error',
        message: 'Não foi possível reconectar ao servidor após várias tentativas.'
      });
      return;
    }
    
    // Calcular delay baseado no número de tentativas (exponential backoff)
    const delay = Math.min(30000, 1000 * Math.pow(2, this.reconnectAttempts));
    console.log(`[OAUTH_DIRECT] Agendando reconexão em ${delay/1000}s (tentativa ${this.reconnectAttempts}/10)`);
    
    // Agendar reconexão
    this.reconnectTimeout = setTimeout(() => {
      console.log(`[OAUTH_DIRECT] Tentativa de reconexão ${this.reconnectAttempts}/10`);
      this.setupWebSocket()
        .then(() => {
          console.log('[OAUTH_DIRECT] Reconexão bem-sucedida!');
          this.reconnectAttempts = 0;
          
          // Se estava em execução, retomar operações
          if (this.isRunning) {
            this.scheduleNextOperation();
          }
        })
        .catch(error => {
          console.error('[OAUTH_DIRECT] Falha na tentativa de reconexão:', error);
        });
    }, delay);
  }
  
  /**
   * Inicia o bot de trading
   */
  async start(): Promise<boolean> {
    try {
      console.log('[OAUTH_DIRECT] Iniciando serviço de trading...');
      
      // Verificar se temos tokens disponíveis
      if (this.tokens.length === 0) {
        // Tentar carregar novamente os tokens
        this.loadAllTokens();
        
        if (this.tokens.length === 0) {
          console.error('[OAUTH_DIRECT] Nenhum token OAuth disponível');
          this.notifyListeners({
            type: 'error',
            message: 'Nenhum token OAuth encontrado. Faça login novamente.'
          });
          return false;
        }
      }
      
      // Configurar a conexão WebSocket se não existir
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.log('[OAUTH_DIRECT] WebSocket não está conectado, estabelecendo conexão...');
        try {
          await this.setupWebSocket();
        } catch (error) {
          console.error('[OAUTH_DIRECT] Falha ao estabelecer conexão WebSocket:', error);
          this.notifyListeners({
            type: 'error',
            message: 'Falha ao conectar ao servidor. Tente novamente.'
          });
          return false;
        }
      }
      
      // Verificar se temos um token ativo e autorizado
      const activeTokenInfo = this.tokens.find(t => t.token === this.activeToken && t.authorized);
      if (!activeTokenInfo) {
        console.error('[OAUTH_DIRECT] Nenhum token ativo e autorizado disponível');
        this.notifyListeners({
          type: 'error',
          message: 'Problema com a autorização. Tente fazer login novamente.'
        });
        return false;
      }
      
      // Atualizar estado
      this.isRunning = true;
      
      // Notificar início
      this.notifyListeners({
        type: 'bot_started',
        strategy: this.activeStrategy,
        settings: this.settings
      });
      
      // Programar primeira operação
      this.scheduleNextOperation(2000);
      
      return true;
    } catch (error: any) {
      console.error('[OAUTH_DIRECT] Erro ao iniciar bot:', error);
      this.notifyListeners({
        type: 'error',
        message: 'Erro ao iniciar bot: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      });
      return false;
    }
  }
  
  /**
   * Para o bot de trading
   */
  stop(): void {
    console.log('[OAUTH_DIRECT] Parando serviço de trading');
    this.isRunning = false;
    
    // Limpar timeout pendente se houver
    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
      this.operationTimeout = null;
    }
    
    // Notificar parada do bot
    this.notifyListeners({
      type: 'bot_stopped'
    });
  }
  
  /**
   * Fecha completamente a conexão e limpa recursos
   */
  closeConnection(): void {
    // Parar keep-alive
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Parar reconexão
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Fechar WebSocket
    if (this.webSocket) {
      if (this.webSocket.readyState === WebSocket.OPEN || 
          this.webSocket.readyState === WebSocket.CONNECTING) {
        this.webSocket.close();
      }
      this.webSocket = null;
    }
  }
  
  /**
   * Agenda a próxima operação
   */
  private scheduleNextOperation(delay: number = 5000): void {
    // Limpar timeout pendente se houver
    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
    }
    
    console.log(`[OAUTH_DIRECT] Próxima operação agendada em ${delay}ms`);
    
    // Agendar próxima operação
    this.operationTimeout = setTimeout(() => {
      // Verificar se ainda estamos em execução
      if (!this.isRunning) return;
      
      // Executar operação
      this.executeOperation();
    }, delay);
  }
  
  /**
   * Executa uma operação de trading
   */
  private async executeOperation(): Promise<void> {
    console.log('[OAUTH_DIRECT] Executando operação de trading');
    
    // Verificar se estamos rodando
    if (!this.isRunning) {
      console.log('[OAUTH_DIRECT] Serviço não está em execução');
      return;
    }
    
    // Verificar se já existe um contrato em andamento
    if (this.currentContractId) {
      console.log('[OAUTH_DIRECT] Já existe um contrato em andamento');
      return;
    }
    
    // Verificar conexão
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está disponível');
      
      // Tentar restabelecer conexão
      try {
        await this.setupWebSocket();
      } catch (error) {
        console.error('[OAUTH_DIRECT] Falha ao reconectar:', error);
        this.notifyListeners({
          type: 'error',
          message: 'Falha na conexão com o servidor'
        });
        return;
      }
    }
    
    // Verificar se temos um token ativo e autorizado
    if (!this.activeToken) {
      console.error('[OAUTH_DIRECT] Nenhum token ativo disponível');
      
      // Verificar se temos algum token autorizado
      const authorizedToken = this.tokens.find(t => t.authorized);
      if (authorizedToken) {
        this.activeToken = authorizedToken.token;
        console.log(`[OAUTH_DIRECT] Usando token autorizado: ${authorizedToken.loginid || 'desconhecido'}`);
      } else {
        this.notifyListeners({
          type: 'error',
          message: 'Nenhum token autorizado disponível. Faça login novamente.'
        });
        return;
      }
    }
    
    try {
      // Determinar o tipo de contrato com base na estratégia
      let contractType = 'DIGITOVER';
      
      if (this.activeStrategy.includes('under')) {
        contractType = 'DIGITUNDER';
      } else if (this.activeStrategy.includes('over')) {
        contractType = 'DIGITOVER';
      }
      
      // Atualizar tipo de contrato nas configurações
      this.settings.contractType = contractType;
      
      // Obter parâmetros para a solicitação
      const amount = parseFloat(this.settings.entryValue.toString());
      const prediction = this.settings.prediction || 5;
      
      // Verificar se estamos usando o token da conta selecionada pelo usuário
      const activeTokenInfo = this.tokens.find(t => t.token === this.activeToken);
      
      // Se não estamos usando o token primário, corrigir para usar o token primário
      if (!activeTokenInfo || !activeTokenInfo.primary) {
        // Se não for o token primário, vamos tentar encontrar o token primário
        const primaryToken = this.tokens.find(t => t.primary);
        if (primaryToken) {
          this.activeToken = primaryToken.token;
          console.log(`[OAUTH_DIRECT] Corrigindo para usar o token primário: ${primaryToken.loginid}`);
        }
      }
      
      // COMPLETAMENTE NOVO FORMATO DA REQUISIÇÃO
      // Criando uma nova requisição de compra no formato correto
      this.executeBuyRequest(contractType, amount, prediction, activeTokenInfo?.loginid);
      
      // Notificar sobre o início da operação
      this.notifyListeners({
        type: 'operation_started',
        contract_type: contractType,
        amount: amount,
        prediction: prediction,
        loginid: activeTokenInfo?.loginid
      });
    } catch (error: any) {
      console.error('[OAUTH_DIRECT] Erro ao executar operação:', error);
      this.notifyListeners({
        type: 'error',
        message: 'Erro ao executar operação: ' + (error instanceof Error ? error.message : 'Erro desconhecido')
      });
      
      // Agendar próxima operação mesmo com erro
      this.scheduleNextOperation();
    }
  }
  
  /**
   * Executa uma requisição de compra com formato correto
   */
  private executeBuyRequest(contractType: string, amount: number, prediction: number, loginid?: string): void {
    try {
      // Formato correto da requisição usando o formato documentado na API:
      // - buy: ID do contrato (1 se passarmos parâmetros diretos)
      // - price: valor máximo para compra
      // - parameters: objeto com detalhes do contrato
      //   - basis: "stake" (valor de entrada) ou "payout" (pagamento pretendido)
      //   - amount: valor correspondente ao basis
      const buyRequest = {
        buy: 1,
        price: amount, // Valor máximo para compra
        parameters: {
          basis: "stake", // Usamos "stake" para indicar que o amount é o valor de entrada
          amount: amount, // Valor da aposta
          contract_type: contractType,
          currency: "USD",
          duration: 5,
          duration_unit: "t",
          symbol: "R_100",
          barrier: prediction.toString()
        }
      };
      
      console.log(`[OAUTH_DIRECT] Enviando solicitação de compra com token ${loginid || 'desconhecido'}:`, buyRequest);
      
      // Enviar solicitação se o WebSocket estiver disponível
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify(buyRequest));
      } else {
        throw new Error('WebSocket não está disponível ou conectado');
      }
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao enviar solicitação de compra:', error);
      throw error;
    }
  }
  
  /**
   * Monitora um contrato específico
   */
  private monitorContract(contractId: number | string): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está pronto para monitorar contrato');
      return;
    }
    
    // Inscrever-se para atualizações do contrato
    const subscribeRequest = {
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    };
    
    try {
      this.webSocket.send(JSON.stringify(subscribeRequest));
      console.log(`[OAUTH_DIRECT] Monitorando contrato ID ${contractId}`);
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao iniciar monitoramento do contrato:', error);
    }
  }
  
  /**
   * Define as configurações do serviço
   */
  setSettings(settings: Partial<TradingSettings>): void {
    this.settings = { ...this.settings, ...settings };
    console.log('[OAUTH_DIRECT] Configurações atualizadas:', this.settings);
  }
  
  /**
   * Define a estratégia ativa
   */
  setActiveStrategy(strategy: string): void {
    this.activeStrategy = strategy;
    console.log('[OAUTH_DIRECT] Estratégia definida:', strategy);
  }
  
  /**
   * Define a conta ativa para operação
   * @param loginid ID da conta
   * @param token Token de autorização 
   */
  setActiveAccount(loginid: string, token: string): void {
    // Verificar se o token existe na lista
    const tokenInfo = this.tokens.find(t => t.token === token && t.loginid === loginid);
    
    if (tokenInfo) {
      console.log(`[OAUTH_DIRECT] Definindo conta ativa: ${loginid}`);
      this.activeToken = token;
      
      // Marcar este token como primário
      this.tokens.forEach(t => {
        t.primary = (t.token === token && t.loginid === loginid);
      });
      
      // Notificar mudança de conta
      this.notifyListeners({
        type: 'account_changed',
        loginid: loginid
      });
    } else {
      // Se o token não existe, vamos adicioná-lo e tentar autorizar
      console.log(`[OAUTH_DIRECT] Adicionando nova conta ativa: ${loginid}`);
      this.addToken(token, true, loginid);
      this.activeToken = token;
      
      // Se já estamos conectados, autorizar este token
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.authorizeToken(token)
          .then(() => {
            console.log(`[OAUTH_DIRECT] Nova conta autorizada com sucesso: ${loginid}`);
            
            // Notificar mudança de conta
            this.notifyListeners({
              type: 'account_changed',
              loginid: loginid
            });
          })
          .catch(error => {
            console.error(`[OAUTH_DIRECT] Erro ao autorizar nova conta: ${loginid}`, error);
            this.notifyListeners({
              type: 'error',
              message: `Erro ao autorizar conta ${loginid}. Tente novamente.`
            });
          });
      }
    }
  }
  
  /**
   * Adiciona um listener para eventos
   */
  addEventListener(listener: (event: TradingEvent) => void): void {
    this.eventListeners.push(listener);
  }
  
  /**
   * Remove um listener de eventos
   */
  removeEventListener(listener: (event: TradingEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }
  
  /**
   * Notifica todos os listeners sobre um evento
   */
  private notifyListeners(event: TradingEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro ao notificar listener:', error);
      }
    });
  }
}

// Exportar uma instância única do serviço
export const oauthDirectService = new OAuthDirectService();