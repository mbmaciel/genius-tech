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
    
    // Configurar listener para eventos de troca de conta
    this.setupAccountSwitchListener();
  }
  
  /**
   * Configura listener para eventos de troca de conta
   * Isso permite que o serviço receba notificações quando o usuário 
   * troca de conta na dashboard
   */
  private setupAccountSwitchListener(): void {
    // Handler para evento de troca de conta via OAuth
    const handleAccountSwitch = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        // Compatibilidade com diferentes formatos de evento
        const accountId = customEvent.detail.accountId || customEvent.detail.loginid;
        const token = customEvent.detail.token;
        
        if (accountId && token) {
          console.log(`[OAUTH_DIRECT] Evento de troca de conta recebido: ${accountId}`);
          
          // Definir a conta como ativa
          this.setActiveAccount(accountId, token);
          
          // Forçar reconexão para validar o token
          if (this.isRunning) {
            console.log(`[OAUTH_DIRECT] Reconectando para validar token da conta ${accountId}...`);
            this.reconnect()
              .then(success => {
                if (success) {
                  console.log(`[OAUTH_DIRECT] Token da conta ${accountId} validado com sucesso`);
                  
                  // Notificar componentes da UI
                  this.notifyListeners({
                    type: 'account_changed',
                    message: `Conta alterada para ${accountId}`,
                    loginid: accountId
                  });
                } else {
                  console.error(`[OAUTH_DIRECT] Falha ao validar token da conta ${accountId}`);
                }
              })
              .catch(error => {
                console.error('[OAUTH_DIRECT] Erro ao reconectar após troca de conta:', error);
              });
          }
        }
      }
    };
    
    // Handler para evento de força de atualização de token
    const handleForceTokenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.loginid && customEvent.detail.token) {
        const { loginid, token } = customEvent.detail;
        
        console.log(`[OAUTH_DIRECT] ⚠️ Evento de FORÇA de atualização de token recebido: ${loginid}`);
        
        // Remover status de primário de todos os outros tokens
        this.tokens.forEach(t => {
          t.primary = false;
        });
        
        // Definir novo token como principal e ativo
        let tokenInfo = this.tokens.find(t => t.token === token || t.loginid === loginid);
        
        if (!tokenInfo) {
          // Se não existe, adicionar
          this.addToken(token, true, loginid);
          console.log(`[OAUTH_DIRECT] Adicionado novo token forçado para ${loginid}`);
        } else {
          // Se existe, atualizar
          tokenInfo.primary = true;
          tokenInfo.loginid = loginid;
          console.log(`[OAUTH_DIRECT] Token existente atualizado para ${loginid}`);
        }
        
        // Definir como token ativo
        this.activeToken = token;
        
        // Atualizar todos os locais de armazenamento
        localStorage.setItem('deriv_oauth_token', token);
        localStorage.setItem('deriv_api_token', token);
        localStorage.setItem('deriv_active_loginid', loginid);
        
        // Forçar reconexão imediata
        this.reconnect()
          .then(() => {
            console.log(`[OAUTH_DIRECT] Reconexão forçada para ${loginid} concluída`);
          })
          .catch(error => {
            console.error(`[OAUTH_DIRECT] Erro na reconexão forçada: ${error}`);
          });
      }
    };
    
    // Também verificar periodicamente se houve alteração no localStorage
    const checkLocalStorageForAccountChange = () => {
      try {
        const oauthAccountData = localStorage.getItem('deriv_oauth_selected_account');
        
        if (oauthAccountData) {
          const accountData = JSON.parse(oauthAccountData);
          
          // Se temos dados recentes (nos últimos 5 segundos)
          if (accountData.timestamp && 
              (Date.now() - accountData.timestamp < 5000) && 
              accountData.accountId && 
              accountData.token) {
            
            // Verificar se é diferente da conta atual
            const currentToken = this.tokens.find(t => t.primary)?.token;
            
            if (accountData.token !== currentToken) {
              console.log(`[OAUTH_DIRECT] Alteração de conta detectada via localStorage: ${accountData.accountId}`);
              
              // Atualizar a conta ativa
              this.setActiveAccount(accountData.accountId, accountData.token);
              
              // Reconectar se o serviço estiver em execução
              if (this.isRunning) {
                this.reconnect().catch(console.error);
              }
            }
          }
        }
      } catch (e) {
        // Ignorar erros no parsing
      }
    };
    
    // Configurar verificação periódica de alterações no localStorage
    setInterval(checkLocalStorageForAccountChange, 2000);
    
    // Registrar handlers para os eventos customizados
    document.addEventListener('deriv:oauth_account_switch', handleAccountSwitch as EventListener);
    document.addEventListener('deriv:account_switched', handleAccountSwitch as EventListener);
    document.addEventListener('deriv:force_token_update', handleForceTokenUpdate as EventListener);
  }
  
  /**
   * Carrega todos os tokens disponíveis de todas as fontes
   */
  private loadAllTokens(): void {
    try {
      this.tokens = []; // Resetar lista de tokens
      
      // 0. Verificar conta ativa definida na UI
      let activeAccountInfo = null;
      try {
        const activeAccountStr = localStorage.getItem('deriv_active_account');
        if (activeAccountStr) {
          activeAccountInfo = JSON.parse(activeAccountStr);
          
          // Verificar se os dados são recentes (menos de 10 minutos)
          if (activeAccountInfo && activeAccountInfo.timestamp && 
              (Date.now() - activeAccountInfo.timestamp < 10 * 60 * 1000)) {
            
            // Esta conta será definida como a primária
            if (activeAccountInfo.token) {
              this.addToken(activeAccountInfo.token, true, activeAccountInfo.loginid);
              console.log(`[OAUTH_DIRECT] Conta ativa encontrada no localStorage: ${activeAccountInfo.loginid}`);
            }
          }
        }
      } catch (e) {
        console.error('[OAUTH_DIRECT] Erro ao processar conta ativa:', e);
      }
      
      // 1. Tentar obter token principal do localStorage
      const mainToken = localStorage.getItem('deriv_oauth_token');
      if (mainToken) {
        // Adicionar apenas se ainda não foi adicionado como conta ativa
        if (!this.tokens.some(t => t.token === mainToken)) {
          this.addToken(mainToken, !activeAccountInfo);
          console.log('[OAUTH_DIRECT] Token OAuth principal encontrado no localStorage');
        }
      }
      
      // 2. Tentar obter tokens adicionais das contas salvas
      const accountsStr = localStorage.getItem('deriv_accounts');
      if (accountsStr) {
        try {
          const accounts = JSON.parse(accountsStr);
          if (accounts && Array.isArray(accounts) && accounts.length > 0) {
            accounts.forEach((acc: any) => {
              if (acc.token && !this.tokens.some(t => t.token === acc.token)) {
                // Verificar se a conta é a conta ativa do sistema
                const isActiveAccount = acc.loginid === localStorage.getItem('deriv_active_loginid');
                
                // Adicionar token com flag primary baseada se é conta ativa
                // e se já não temos uma conta marcada como primária
                const shouldBePrimary = isActiveAccount && !this.tokens.some(t => t.primary);
                
                // Adicionar o token
                this.addToken(acc.token, shouldBePrimary, acc.loginid);
              }
            });
            console.log(`[OAUTH_DIRECT] ${accounts.length} contas encontradas no localStorage`);
          }
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao processar contas salvas:', error);
        }
      }
      
      // 3. Verificar conta ativa no formato tradicional (deriv_active_loginid)
      if (!this.tokens.some(t => t.primary)) {
        const activeLoginID = localStorage.getItem('deriv_active_loginid');
        if (activeLoginID) {
          // Procurar token correspondente 
          const tokenForActiveAccount = this.tokens.find(t => t.loginid === activeLoginID);
          if (tokenForActiveAccount) {
            tokenForActiveAccount.primary = true;
            console.log(`[OAUTH_DIRECT] Definindo conta ${activeLoginID} como primária baseado em deriv_active_loginid`);
          }
        }
      }
      
      // Se encontramos pelo menos um token, usar o marcado como primário ou o primeiro
      if (this.tokens.length > 0) {
        const primaryToken = this.tokens.find(t => t.primary) || this.tokens[0];
        this.activeToken = primaryToken.token;
        
        // Se nenhum token estiver marcado como primário, marcar o primeiro
        if (!primaryToken.primary) {
          primaryToken.primary = true;
        }
        
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
        
        // CORREÇÃO: Usar o endereço correto com porta segura
        this.webSocket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=71403');
        
        // DEPURAÇÃO: Verificar ReadyState da conexão WebSocket
        console.log(`[OAUTH_DIRECT] Estado inicial WebSocket: ${this.getReadyStateText(this.webSocket.readyState)}`);
        
        // Configurar timeout para conexão
        const connectionTimeout = setTimeout(() => {
          console.error('[OAUTH_DIRECT] Timeout ao tentar conectar WebSocket');
          reject(new Error('Timeout ao conectar ao servidor'));
        }, 15000); // Aumentado para 15 segundos
        
        // Handler de abertura
        this.webSocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log('[OAUTH_DIRECT] Conexão WebSocket estabelecida com sucesso!');
          console.log(`[OAUTH_DIRECT] Estado após conexão: ${this.getReadyStateText(this.webSocket.readyState)}`);
          
          // Configurar ping para manter conexão
          this.setupKeepAlive();
          
          // Iniciar processo de autorização com todos os tokens
          this.authorizeAllTokens()
            .then(() => {
              this.initialized = true;
              resolve(true);
            })
            .catch((error) => {
              console.error('[OAUTH_DIRECT] Falha na autorização de tokens:', error);
              reject(error);
            });
        };
        
        // Handler de erro
        this.webSocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error('[OAUTH_DIRECT] Erro na conexão WebSocket:', error);
          this.scheduleReconnect();
          reject(error);
        };
        
        // Handler de fechamento
        this.webSocket.onclose = (event) => {
          console.log(`[OAUTH_DIRECT] Conexão WebSocket fechada: Código ${event.code}, Razão: ${event.reason}`);
          this.scheduleReconnect();
          
          // Se estiver em estado de execução, notificar erro
          if (this.isRunning) {
            this.notifyListeners({
              type: 'error',
              message: `Conexão com o servidor perdida (${event.code}). Tentando reconectar automaticamente.`
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
   * Inicializa a conexão WebSocket com o servidor Deriv
   * Método público para iniciar conexão a partir da página do bot
   */
  public initializeConnection(): Promise<boolean> {
    console.log('[OAUTH_DIRECT] Iniciando conexão manual...');
    return this.setupWebSocket().then(success => {
      if (success) {
        // Se a conexão for estabelecida com sucesso, inscrever para ticks
        console.log('[OAUTH_DIRECT] Conexão estabelecida, inscrevendo para ticks automaticamente...');
        setTimeout(() => {
          this.subscribeToTicks();
        }, 1000);
      }
      return success;
    });
  }
  
  /**
   * Retorna uma descrição textual para o estado de ReadyState do WebSocket
   */
  
  private getReadyStateText(state: number): string {
    switch (state) {
      case WebSocket.CONNECTING:
        return "CONNECTING (0)";
      case WebSocket.OPEN:
        return "OPEN (1)";
      case WebSocket.CLOSING:
        return "CLOSING (2)";
      case WebSocket.CLOSED:
        return "CLOSED (3)";
      default:
        return `DESCONHECIDO (${state})`;
    }
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
      
      // Resposta de tick - VERSÃO CORRIGIDA
      if (data.msg_type === 'tick') {
        try {
          // Processar tick recebido diretamente da conexão
          const price = parseFloat(data.tick.quote);
          
          // Forçar extração do último dígito de forma mais confiável
          const priceStr = price.toString();
          const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));
          
          const symbol = data.tick.symbol;
          const epoch = data.tick.epoch;
          
          console.log(`[OAUTH_DIRECT] Tick recebido: ${price}, Último dígito: ${lastDigit}`);
          
          // Evitar processamento se o último dígito não for um número válido
          if (!isNaN(lastDigit)) {
            // Adicionar timestamp para forçar a interface a reconhecer uma mudança
            const timestamp = Date.now();
            
            // Notificar para atualização de interface com dados completos
            this.notifyListeners({
              type: 'tick',
              price,
              lastDigit,
              symbol,
              epoch,
              timestamp  // Adicionar timestamp para forçar nova renderização
            });
          } else {
            console.error('[OAUTH_DIRECT] Último dígito inválido no tick:', price);
          }
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao processar tick:', error);
        }
      }
      
      // Resposta de compra de contrato
      if (data.msg_type === 'buy') {
        if (data.error) {
          console.error('[OAUTH_DIRECT] Erro na compra de contrato:', data.error.message);
          this.notifyListeners({
            type: 'error',
            message: `Erro na compra: ${data.error.message}`
          });
        } else {
          console.log('[OAUTH_DIRECT] Contrato comprado com sucesso:', data.buy.contract_id);
          this.currentContractId = data.buy.contract_id;
          
          this.notifyListeners({
            type: 'contract_purchased',
            contract_id: data.buy.contract_id,
            buy_price: data.buy.buy_price,
            contract: data.buy
          });
          
          // Inscrever para atualizações deste contrato
          this.subscribeToProposalOpenContract();
        }
      }
      
      // Resposta de atualização de contrato
      if (data.msg_type === 'proposal_open_contract') {
        const contract = data.proposal_open_contract;
        
        if (contract) {
          // Verificar se o contrato é o atual
          if (this.currentContractId && this.currentContractId.toString() === contract.contract_id.toString()) {
            console.log(`[OAUTH_DIRECT] Contrato ${contract.contract_id} atualizado, status: ${contract.status}`);
            
            this.notifyListeners({
              type: 'contract_update',
              contract_id: contract.contract_id,
              contract_details: contract
            });
            
            // Se o contrato foi finalizado, notificar resultado
            if (contract.status !== 'open') {
              // Obter resultado final
              const isWin = contract.status === 'won';
              const profit = contract.profit;
              
              console.log(`[OAUTH_DIRECT] Contrato ${contract.contract_id} finalizado. Resultado: ${isWin ? 'Ganho' : 'Perda'}, Lucro: ${profit}`);
              
              this.notifyListeners({
                type: 'contract_finished',
                contract_id: contract.contract_id,
                is_win: isWin,
                profit: profit,
                contract_details: contract
              });
              
              // Iniciar próxima operação após resultado
              this.startNextOperation(isWin, contract);
            }
          }
        }
      }
      
      // Resposta de saldo
      if (data.msg_type === 'balance') {
        const balance = data.balance;
        console.log('[OAUTH_DIRECT] Saldo atualizado:', balance);
        
        this.notifyListeners({
          type: 'balance_update',
          balance: balance
        });
      }
      
      // Resposta de venda (sell)
      if (data.msg_type === 'sell') {
        if (data.error) {
          console.error('[OAUTH_DIRECT] Erro na venda de contrato:', data.error.message);
          this.notifyListeners({
            type: 'error',
            message: `Erro na venda: ${data.error.message}`
          });
        } else {
          console.log('[OAUTH_DIRECT] Contrato vendido com sucesso:', data.sell);
          
          // Notificar interface sobre venda bem-sucedida
          this.notifyListeners({
            type: 'contract_finished',
            contract_id: this.currentContractId,
            sold: true,
            profit: data.sell.profit,
            contract_details: {
              contract_id: this.currentContractId,
              status: 'sold',
              profit: data.sell.profit
            }
          });
        }
      }
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao processar mensagem recebida:', error);
    }
  }
  
  /**
   * Inicia uma nova operação após o resultado de uma anterior
   */
  private startNextOperation(isWin: boolean, lastContract: any): void {
    try {
      // Implementação específica do martingale
      // Será executada posteriormente
      const nextAmount = this.calculateNextAmount(isWin, lastContract);
      
      // Se temos uma operação agendada, limpar
      if (this.operationTimeout) {
        clearTimeout(this.operationTimeout);
      }
      
      // Verificar se podemos continuar com base nas configurações
      const shouldContinue = this.validateOperationContinuation(isWin, lastContract);
      
      if (shouldContinue) {
        // Agendar próxima operação
        this.operationTimeout = setTimeout(() => {
          this.executeContractBuy(nextAmount);
        }, 3000);
      } else {
        console.log('[OAUTH_DIRECT] Estratégia finalizada devido às condições de parada');
        
        this.notifyListeners({
          type: 'bot_stopped',
          message: 'Condições de parada atingidas'
        });
        
        // Parar a execução
        this.stop();
      }
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao iniciar próxima operação:', error);
      
      // Notificar erro e parar a execução
      this.notifyListeners({
        type: 'error',
        message: `Erro ao iniciar próxima operação: ${error}`
      });
      
      this.stop();
    }
  }
  
  /**
   * Calcula o próximo valor de entrada com base no resultado anterior
   */
  private calculateNextAmount(isWin: boolean, lastContract: any): number {
    if (!lastContract || !lastContract.buy_price) {
      return Number(this.settings.entryValue) || 1;
    }
    
    let buyPrice = Number(lastContract.buy_price);
    
    if (isWin) {
      // Em caso de vitória, voltar ao valor inicial
      return Number(this.settings.entryValue) || 1;
    } else {
      // Em caso de perda, aplicar multiplicador martingale
      const factor = this.settings.martingaleFactor || 1.5;
      return Math.round(buyPrice * factor * 100) / 100;
    }
  }
  
  /**
   * Validar se a operação deve continuar com base nos limites configurados
   */
  private validateOperationContinuation(isWin: boolean, lastContract: any): boolean {
    // Implementação de validação baseada no lucro/perda e limites
    // A ser implementada posteriormente
    return true;
  }
  
  /**
   * Assina ticks do símbolo especificado (ou R_100 por padrão)
   * Método público para poder ser chamado diretamente da página
   */
  public subscribeToTicks(symbol: string = 'R_100'): void {
    if (!this.webSocket) {
      console.error('[OAUTH_DIRECT] WebSocket não está inicializado!');
      this.reconnect().catch(err => console.error('[OAUTH_DIRECT] Erro na reconexão durante inscrição de ticks:', err));
      return;
    }
    
    if (this.webSocket.readyState !== WebSocket.OPEN) {
      console.error(`[OAUTH_DIRECT] WebSocket não está aberto para inscrição de ticks! Estado atual: ${this.getReadyStateText(this.webSocket.readyState)}`);
      
      // Tentar reconectar se não estiver em estado CONNECTING
      if (this.webSocket.readyState !== WebSocket.CONNECTING) {
        console.log('[OAUTH_DIRECT] Tentando reconectar antes de inscrever para ticks...');
        this.reconnect().catch(err => console.error('[OAUTH_DIRECT] Erro na reconexão durante inscrição de ticks:', err));
      }
      return;
    }
    
    try {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      
      console.log(`[OAUTH_DIRECT] Inscrevendo-se para receber ticks do símbolo ${symbol}`);
      console.log(`[OAUTH_DIRECT] Estado WebSocket antes do envio: ${this.getReadyStateText(this.webSocket.readyState)}`);
      
      this.webSocket.send(JSON.stringify(request));
      console.log('[OAUTH_DIRECT] Requisição de ticks enviada com sucesso');
      
      // Verificar se ainda está tentando inscrever-se 3 segundos depois
      setTimeout(() => {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
          console.log('[OAUTH_DIRECT] Verificação de inscrição de ticks: WebSocket ainda aberto');
        } else {
          console.error('[OAUTH_DIRECT] WebSocket fechou após tentativa de inscrição de ticks!');
          this.reconnect().catch(console.error);
        }
      }, 3000);
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao enviar requisição de ticks:', error);
      // Tentar reconectar em caso de erro
      this.reconnect().catch(console.error);
    }
  }
  
  /**
   * Assina atualizações do contrato aberto atual
   */
  private subscribeToProposalOpenContract(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN || !this.currentContractId) {
      console.error('[OAUTH_DIRECT] WebSocket não está conectado ou não há contrato atual');
      return;
    }
    
    const request = {
      proposal_open_contract: 1,
      contract_id: this.currentContractId,
      subscribe: 1
    };
    
    console.log(`[OAUTH_DIRECT] Inscrevendo-se para atualizações do contrato ${this.currentContractId}`);
    this.webSocket.send(JSON.stringify(request));
  }
  
  /**
   * Assina atualizações de saldo
   */
  private subscribeToBalance(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está conectado');
      return;
    }
    
    const request = {
      balance: 1,
      subscribe: 1
    };
    
    console.log('[OAUTH_DIRECT] Inscrevendo-se para atualizações de saldo');
    this.webSocket.send(JSON.stringify(request));
  }
  
  /**
   * Configura mecanismo para manter a conexão ativa
   */
  private setupKeepAlive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Enviar ping a cada 30 segundos para manter a conexão
    this.pingInterval = setInterval(() => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        const pingRequest = {
          ping: 1
        };
        this.webSocket.send(JSON.stringify(pingRequest));
        console.log('[OAUTH_DIRECT] Ping enviado para manter conexão');
      }
    }, 30000);
  }
  
  /**
   * Agenda uma reconexão em caso de erro
   */
  private scheduleReconnect(): void {
    // Limpar reconexão agendada, se houver
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    // Se o serviço estiver em execução, tentar reconectar
    if (this.isRunning) {
      console.log('[OAUTH_DIRECT] Agendando reconexão...');
      
      // Aplicar backoff exponencial
      const baseDelay = 1000; // 1 segundo
      const maxDelay = 30000; // 30 segundos
      
      // Calcular atraso com backoff
      const delay = Math.min(baseDelay * Math.pow(1.5, this.reconnectAttempts), maxDelay);
      this.reconnectAttempts++;
      
      console.log(`[OAUTH_DIRECT] Tentativa ${this.reconnectAttempts} agendada para ${delay}ms`);
      
      this.reconnectTimeout = setTimeout(() => {
        console.log(`[OAUTH_DIRECT] Executando reconexão (tentativa ${this.reconnectAttempts})`);
        this.reconnect()
          .then(success => {
            if (success) {
              console.log('[OAUTH_DIRECT] Reconexão bem-sucedida');
              this.reconnectAttempts = 0;
            } else {
              console.error('[OAUTH_DIRECT] Falha na reconexão');
              this.scheduleReconnect();
            }
          })
          .catch(error => {
            console.error('[OAUTH_DIRECT] Erro na reconexão:', error);
            this.scheduleReconnect();
          });
      }, delay);
    }
  }
  
  /**
   * Autoriza um token com o servidor
   */
  private authorizeToken(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket não está conectado'));
        return;
      }
      
      // Timeout para caso não haja resposta
      const authTimeout = setTimeout(() => {
        reject(new Error('Timeout na autorização'));
      }, 10000);
      
      // Handler de resposta para autorização
      const authHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          
          // Verificar se é resposta para authorize
          if (data.msg_type === 'authorize') {
            // Remover o handler após receber a resposta
            if (this.webSocket) {
              this.webSocket.removeEventListener('message', authHandler);
            }
            
            clearTimeout(authTimeout);
            
            if (data.error) {
              console.error('[OAUTH_DIRECT] Erro na autorização:', data.error.message);
              reject(new Error(`Autorização falhou: ${data.error.message}`));
              return;
            }
            
            console.log('[OAUTH_DIRECT] Autorização bem-sucedida:', data.authorize?.loginid);
            
            // Atualizar o status do token na lista
            const tokenInfo = this.tokens.find(t => t.token === token);
            if (tokenInfo) {
              tokenInfo.authorized = true;
              tokenInfo.loginid = data.authorize.loginid;
            }
            
            // Inscrever-se para atualizações de saldo
            this.subscribeToBalance();
            
            resolve(true);
          }
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao processar resposta de autorização:', error);
        }
      };
      
      // Adicionar handler temporário para resposta de autorização
      this.webSocket.addEventListener('message', authHandler);
      
      // Enviar solicitação de autorização
      const authorizeRequest = {
        authorize: token
      };
      
      console.log('[OAUTH_DIRECT] Enviando solicitação de autorização');
      this.webSocket.send(JSON.stringify(authorizeRequest));
    });
  }
  
  /**
   * Autoriza todos os tokens disponíveis
   */
  private authorizeAllTokens(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        // Verificar se temos tokens
        if (this.tokens.length === 0) {
          console.error('[OAUTH_DIRECT] Nenhum token disponível');
          reject(new Error('Nenhum token disponível para autorização'));
          return;
        }
        
        // Identificar token primário
        const primaryToken = this.tokens.find(t => t.primary);
        
        if (!primaryToken) {
          console.warn('[OAUTH_DIRECT] Nenhum token primário encontrado, usando o primeiro');
          this.tokens[0].primary = true;
        }
        
        // Usar token primário ou o primeiro da lista
        const tokenToAuthorize = (primaryToken || this.tokens[0]).token;
        this.activeToken = tokenToAuthorize;
        
        console.log('[OAUTH_DIRECT] Iniciando autorização com token principal');
        
        try {
          // Autorizar com o token principal
          await this.authorizeToken(tokenToAuthorize);
          console.log('[OAUTH_DIRECT] Autorização com token principal concluída');
          
          // Inscrever-se para receber ticks
          this.subscribeToTicks();
          
          resolve(true);
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro na autorização com token principal:', error);
          
          // Tentar outros tokens se o principal falhar
          let authorized = false;
          
          // Iterar pelos tokens restantes
          for (const tokenInfo of this.tokens) {
            // Pular o token primário que já falhou
            if (tokenInfo.token === tokenToAuthorize) continue;
            
            try {
              console.log('[OAUTH_DIRECT] Tentando autorização com token alternativo');
              await this.authorizeToken(tokenInfo.token);
              
              // Se chegou aqui, a autorização foi bem-sucedida
              console.log('[OAUTH_DIRECT] Autorização com token alternativo bem-sucedida');
              this.activeToken = tokenInfo.token;
              
              // Marcar como primário
              this.tokens.forEach(t => t.primary = false);
              tokenInfo.primary = true;
              
              // Inscrever-se para receber ticks
              this.subscribeToTicks();
              
              authorized = true;
              break;
            } catch (altError) {
              console.error('[OAUTH_DIRECT] Erro na autorização com token alternativo:', altError);
            }
          }
          
          if (!authorized) {
            reject(new Error('Falha na autorização com todos os tokens disponíveis'));
          } else {
            resolve(true);
          }
        }
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro global na autorização de tokens:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Executa compra de contrato
   */
  private executeContractBuy(amount: number = 1): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está conectado');
      this.notifyListeners({
        type: 'error',
        message: 'WebSocket não está conectado'
      });
      return;
    }
    
    try {
      const contractType = this.settings.contractType || 'DIGITOVER';
      const prediction = this.settings.prediction || 5;
      
      // Notificar início da operação
      this.notifyListeners({
        type: 'operation_started',
        amount: amount,
        contract_type: contractType,
        prediction: prediction
      });
      
      // Preparar solicitação de compra de contrato
      const buyRequest = {
        buy: 1,
        price: amount,
        parameters: {
          amount: amount,
          basis: 'stake',
          contract_type: contractType,
          currency: 'USD',
          duration: 5,
          duration_unit: 't',
          symbol: 'R_100',
        }
      };
      
      // Adicionar predição se for tipo de contrato com dígito
      if (contractType.includes('DIGIT')) {
        buyRequest.parameters['barrier'] = prediction.toString();
      }
      
      console.log('[OAUTH_DIRECT] Enviando solicitação de compra de contrato:', buyRequest);
      this.webSocket.send(JSON.stringify(buyRequest));
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao executar compra de contrato:', error);
      this.notifyListeners({
        type: 'error',
        message: `Erro ao executar compra de contrato: ${error}`
      });
    }
  }
  
  /**
   * Fecha a conexão WebSocket
   */
  closeConnection(): void {
    if (this.webSocket) {
      try {
        this.webSocket.close();
        this.webSocket = null;
        console.log('[OAUTH_DIRECT] Conexão WebSocket fechada manualmente');
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro ao fechar conexão WebSocket:', error);
      }
    }
    
    // Limpar intervals e timeouts
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
      this.operationTimeout = null;
    }
  }
  
  /**
   * Inicia o serviço de conexão dedicada e trading
   */
  async start(): Promise<boolean> {
    try {
      console.log('[OAUTH_DIRECT] Iniciando serviço de trading direto...');
      
      // Verificar se o serviço já está em execução
      if (this.isRunning) {
        console.log('[OAUTH_DIRECT] Serviço já está em execução');
        return true;
      }
      
      // Carregar tokens novamente para garantir que temos os mais recentes
      this.loadAllTokens();
      
      // Verificar se temos tokens
      if (this.tokens.length === 0) {
        console.error('[OAUTH_DIRECT] Nenhum token encontrado para iniciar o serviço');
        throw new Error('Nenhum token encontrado. Faça login novamente.');
      }
      
      // Estabelecer conexão WebSocket
      await this.setupWebSocket();
      
      // Definir como em execução
      this.isRunning = true;
      
      // Notificar que o serviço foi iniciado
      this.notifyListeners({
        type: 'bot_started',
        strategy: this.activeStrategy,
        settings: this.settings
      });
      
      console.log('[OAUTH_DIRECT] Serviço de trading direto iniciado com sucesso');
      return true;
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao iniciar serviço de trading:', error);
      this.notifyListeners({
        type: 'error',
        message: `Erro ao iniciar serviço: ${error}`
      });
      
      // Limpar recursos em caso de erro
      this.closeConnection();
      this.isRunning = false;
      
      throw error;
    }
  }
  
  /**
   * Para o serviço de conexão dedicada e trading
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[OAUTH_DIRECT] Serviço já está parado');
      return;
    }
    
    console.log('[OAUTH_DIRECT] Parando serviço de trading direto...');
    
    // Definir como não em execução
    this.isRunning = false;
    
    // Fechar conexão WebSocket
    this.closeConnection();
    
    // Notificar que o serviço foi parado
    this.notifyListeners({
      type: 'bot_stopped',
      message: 'Serviço parado manualmente'
    });
    
    console.log('[OAUTH_DIRECT] Serviço de trading direto parado com sucesso');
  }
  
  /**
   * Reconecta o serviço para atualizar tokens ou após erro
   */
  async reconnect(): Promise<boolean> {
    try {
      console.log('[OAUTH_DIRECT] Reconectando serviço de trading direto...');
      
      // Fechar conexão existente
      this.closeConnection();
      
      // Estabelecer nova conexão
      await this.setupWebSocket();
      
      console.log('[OAUTH_DIRECT] Reconexão bem-sucedida');
      return true;
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro na reconexão:', error);
      
      // Notificar erro
      this.notifyListeners({
        type: 'error',
        message: `Erro na reconexão: ${error}`
      });
      
      return false;
    }
  }
  
  /**
   * Define as configurações de trading
   */
  setSettings(settings: Partial<TradingSettings>): void {
    // Mesclar novas configurações com as existentes
    this.settings = { ...this.settings, ...settings };
    console.log('[OAUTH_DIRECT] Configurações atualizadas:', this.settings);
    
    // Notificar mudança de configurações
    if (this.isRunning) {
      this.notifyListeners({
        type: 'settings_updated',
        settings: this.settings
      });
    }
  }
  
  /**
   * Define a estratégia ativa
   */
  setActiveStrategy(strategy: string): void {
    this.activeStrategy = strategy;
    console.log(`[OAUTH_DIRECT] Estratégia definida: ${strategy}`);
  }
  
  /**
   * Define a conta ativa para operação e valida o token
   * @param loginid ID da conta
   * @param token Token de autorização 
   */
  setActiveAccount(loginid: string, token: string): void {
    console.log(`[OAUTH_DIRECT] ⚠️ SOLICITAÇÃO PARA DEFINIR NOVA CONTA ATIVA: ${loginid} com token ${token.substring(0, 8)}...`);
    
    try {
      // PASSO 1: Obter conta anterior para comparação
      const previousAccount = this.tokens.find(t => t.primary);
      const isPrimary = previousAccount?.loginid === loginid;
      
      if (isPrimary) {
        console.log(`[OAUTH_DIRECT] Conta ${loginid} já é a primária. Apenas atualizando token...`);
      } else {
        console.log(`[OAUTH_DIRECT] Trocando conta primária de ${previousAccount?.loginid || 'desconhecida'} para ${loginid}`);
      }
      
      // PASSO 2: Remover flag primária de todas as contas existentes
      this.tokens.forEach(t => {
        if (t.primary) {
          console.log(`[OAUTH_DIRECT] Removendo status primário da conta anterior: ${t.loginid || 'desconhecida'}`);
          t.primary = false;
        }
      });
      
      // PASSO 3: Encontrar token existente ou criar novo
      let tokenInfo = this.tokens.find(t => t.token === token);
      if (!tokenInfo) {
        tokenInfo = this.tokens.find(t => t.loginid === loginid);
      }
      
      let isNewToken = false;
      
      if (tokenInfo) {
        // Atualizar token existente
        console.log(`[OAUTH_DIRECT] Atualizando token existente para conta: ${loginid}`);
        this.activeToken = token;
        tokenInfo.token = token; // Garantir que o token está atualizado
        tokenInfo.loginid = loginid; // Garantir que o loginid está atualizado
        tokenInfo.primary = true; // Marcar como primário
      } else {
        // Criar novo token
        console.log(`[OAUTH_DIRECT] Adicionando nova conta ativa: ${loginid}`);
        this.addToken(token, true, loginid);
        this.activeToken = token;
        isNewToken = true;
      }
      
      // PASSO 4: Salvar em TODOS os locais do localStorage para garantir consistência
      try {
        // Múltiplos formatos de armazenamento para compatibilidade
        localStorage.setItem('deriv_active_loginid', loginid);
        localStorage.setItem('deriv_api_token', token);
        localStorage.setItem('deriv_oauth_token', token);
        localStorage.setItem('deriv_selected_account', JSON.stringify({
          token: token,
          loginid: loginid,
          timestamp: Date.now()
        }));
        localStorage.setItem('deriv_oauth_selected_account', JSON.stringify({
          accountId: loginid,
          token: token,
          timestamp: Date.now()
        }));
        
        // Salvar explicitamente como conta ativa
        localStorage.setItem('deriv_active_account', JSON.stringify({
          loginid: loginid,
          token: token, 
          timestamp: Date.now(),
          is_virtual: tokenInfo?.loginid?.startsWith('VRTC') || false,
          active: true
        }));
        
        console.log(`[OAUTH_DIRECT] Conta ${loginid} salva em todos os locais de armazenamento`);
      } catch (e) {
        console.error('[OAUTH_DIRECT] Erro ao salvar conta no localStorage:', e);
      }
      
      // PASSO 5: Notificar mudança de conta
      this.notifyListeners({
        type: 'account_changed',
        loginid: loginid
      });
      
      // PASSO 6: Validar o token se a conexão estiver aberta
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        console.log(`[OAUTH_DIRECT] Validando token da conta ${loginid}...`);
        
        // Tentar autorizar com o novo token sem reconexão completa
        this.authorizeToken(token)
          .then(() => {
            console.log(`[OAUTH_DIRECT] ✅ Token da conta ${loginid} validado com sucesso!`);
            
            // Garantir que estamos inscritos para ticks após validação
            this.subscribeToTicks();
            
            // Notificar sobre validação bem-sucedida via evento interno
            this.notifyListeners({
              type: 'token_validated',
              message: `Token da conta ${loginid} validado com sucesso`,
              loginid: loginid
            });
            
            // Emitir evento customizado para a UI atualizar
            try {
              const tokenValidatedEvent = new CustomEvent('deriv:token_validated', {
                detail: {
                  loginid: loginid,
                  message: `Token da conta ${loginid} validado com sucesso`,
                  isNewAccount: !isPrimary
                }
              });
              document.dispatchEvent(tokenValidatedEvent);
            } catch (e) {
              console.error('[OAUTH_DIRECT] Erro ao emitir evento de validação de token:', e);
            }
          })
          .catch(error => {
            console.error(`[OAUTH_DIRECT] ❌ Erro ao validar token da conta ${loginid}:`, error);
            
            // Em caso de erro na validação de token atual, forçar reconexão completa
            console.log(`[OAUTH_DIRECT] Forçando reconexão completa após erro de validação...`);
            this.closeConnection();
            this.setupWebSocket().catch(reconnectError => {
              console.error('[OAUTH_DIRECT] Falha na reconexão após erro de validação:', reconnectError);
            });
          });
      } else {
        console.log(`[OAUTH_DIRECT] WebSocket não está aberto. Conta definida, mas token não validado.`);
      }
    } catch (error) {
      console.error(`[OAUTH_DIRECT] Erro crítico ao processar nova conta ativa:`, error);
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