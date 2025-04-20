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
import { getStrategyById } from '@/lib/strategiesConfig';
import { 
  evaluateAdvanceStrategy, 
  evaluateIronOverStrategy, 
  evaluateIronUnderStrategy,
  evaluateMaxProStrategy,
  evaluateDefaultStrategy, 
  ContractType as StrategyContractType,
  DigitStat
} from '@/services/strategyRules';
import {
  evaluateEntryConditions,
  updateStrategyResult,
  initializeStrategyState
} from '@/lib/strategy-handlers';

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
  private activeSymbol: string = 'R_100'; // Símbolo ativo para reconexões
  private isRunning: boolean = false;
  private eventListeners: Array<(event: TradingEvent) => void> = [];
  private currentContractId: string | number | null = null;
  private verboseLogging: boolean = false; // Controle de logs detalhados
  private settings: TradingSettings = {
    entryValue: 0.35,
    profitTarget: 20,
    lossLimit: 20,
    martingaleFactor: 1.5,
    contractType: 'DIGITOVER',
    prediction: 5
  };
  
  // Estatísticas de performance
  private sessionStats = {
    totalProfit: 0,       // Lucro total da sessão
    totalLoss: 0,         // Perda total da sessão
    wins: 0,              // Número de vitórias
    losses: 0,            // Número de perdas
    initialBalance: 0,    // Saldo inicial quando iniciou o bot
    currentBalance: 0,    // Saldo atual
    netProfit: 0,         // Lucro líquido da sessão
    startTime: new Date() // Horário de início da sessão
  };
  
  private strategyConfig: string = '';
  
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
          }
        }
      }
    };
    
    // Handler para o evento personalizado de troca de conta
    const handleAccountSwitchedEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.loginid) {
        const loginid = customEvent.detail.loginid;
        console.log(`[OAUTH_DIRECT] Evento personalizado de troca de conta detectado: ${loginid}`);
        
        // Forçar recarregamento de tokens
        this.loadAllTokens();
        
        // Verificar se a conta ativa foi atualizada
        const activeLoginId = localStorage.getItem('deriv_active_loginid');
        if (activeLoginId === loginid) {
          console.log(`[OAUTH_DIRECT] Verificada troca para conta ${loginid} no localStorage`);
          
          // Obter novo token
          const oauthToken = localStorage.getItem('deriv_oauth_token');
          if (oauthToken) {
            // Atualizar token ativo
            this.activeToken = oauthToken;
            
            // Procurar na lista de tokens
            const tokenInfo = this.tokens.find(t => t.loginid === loginid);
            if (tokenInfo) {
              // Marcar como primário
              tokenInfo.primary = true;
              
              // Forçar reconexão com o novo token
              if (this.isRunning) {
                console.log(`[OAUTH_DIRECT] Reconectando com novo token após troca de conta...`);
                this.reconnect()
                  .then(success => {
                    if (success) {
                      console.log(`[OAUTH_DIRECT] Reconexão após troca de conta bem-sucedida`);
                      // Notificar listeners
                      this.notifyListeners({
                        type: 'account_changed',
                        message: `Conta alterada para ${loginid}`,
                        loginid: loginid
                      });
                    } else {
                      console.error(`[OAUTH_DIRECT] Falha na reconexão após troca de conta`);
                    }
                  })
                  .catch(error => {
                    console.error(`[OAUTH_DIRECT] Erro na reconexão após troca de conta:`, error);
                  });
              }
            }
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
    document.addEventListener('deriv:account_switched', handleAccountSwitchedEvent as EventListener);
    document.addEventListener('deriv:force_token_update', handleForceTokenUpdate as EventListener);
  }
  
  /**
   * Carrega todos os tokens disponíveis de todas as fontes
   */
  private loadAllTokens(): void {
    try {
      this.tokens = []; // Resetar lista de tokens
      
      // 0. Verificar conta ativa definida na UI
      let activeAccountInfo: any = null;
      try {
        const activeAccountStr = localStorage.getItem('deriv_active_account');
        if (activeAccountStr && activeAccountStr.trim() !== '') {
          try {
            activeAccountInfo = JSON.parse(activeAccountStr);
            
            // Verificar se os dados são válidos e recentes (menos de 10 minutos)
            if (activeAccountInfo && 
                typeof activeAccountInfo === 'object' && 
                activeAccountInfo.timestamp && 
                (Date.now() - activeAccountInfo.timestamp < 10 * 60 * 1000)) {
              
              // Esta conta será definida como a primária apenas se tiver token válido
              if (activeAccountInfo.token && typeof activeAccountInfo.token === 'string') {
                this.addToken(activeAccountInfo.token, true, activeAccountInfo.loginid);
                console.log(`[OAUTH_DIRECT] Conta ativa encontrada no localStorage: ${activeAccountInfo.loginid}`);
              }
            }
          } catch (parseError) {
            console.error('[OAUTH_DIRECT] Erro ao fazer parse do JSON da conta ativa', parseError);
            activeAccountInfo = null; // Resetar para evitar uso de dados inválidos
          }
        }
      } catch (e) {
        console.warn('[OAUTH_DIRECT] Erro ao processar conta ativa:', e ? (e as Error).message : 'Erro desconhecido');
        activeAccountInfo = null; // Garantir que seja nulo em caso de erro
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
        // Primeiro tenta encontrar o token marcado como primário
        let primaryToken = this.tokens.find(t => t.primary);
        
        // Se não encontrar nenhum marcado como primário, usar o primeiro token disponível
        if (!primaryToken) {
          primaryToken = this.tokens[0];
          primaryToken.primary = true; // Marcar como primário
          console.log('[OAUTH_DIRECT] Nenhum token encontrado como primário. Definindo o primeiro token como primário.');
        }
        
        // Definir o token ativo
        this.activeToken = primaryToken.token;
        
        // Verificar se temos o loginid para esse token
        const loginidStr = primaryToken.loginid || 'desconhecido';
        console.log(`[OAUTH_DIRECT] Total de ${this.tokens.length} tokens carregados. Token ativo: ${loginidStr}`);
      } else {
        console.warn('[OAUTH_DIRECT] Nenhum token encontrado em qualquer fonte!');
        // Definir token como null para provocar novo processo de autenticação
        this.activeToken = null;
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
        if (!this.activeToken && this.tokens.length > 0) {
          // Selecionar o token principal ou o primeiro disponível
          const primaryToken = this.tokens.find(t => t.primary) || this.tokens[0];
          this.activeToken = primaryToken.token;
          console.log(`[OAUTH_DIRECT] Token ativo definido para ${primaryToken.loginid || 'desconhecido'}`);
        } else if (!this.activeToken) {
          // Caso extremo: não temos token ativo e nem tokens disponíveis
          console.error('[OAUTH_DIRECT] Erro crítico: nenhum token disponível para conexão');
          reject(new Error('Nenhum token disponível para conexão. Faça login novamente.'));
          return;
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
    if (!state && state !== 0) return 'DESCONHECIDO';
    
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
  // Flag para controlar se devemos permitir eventos de symbol_update
  private allowSymbolUpdateEvents: boolean = false;
  
  /**
   * Habilita eventos de symbol_update quando realmente necessário
   * Por exemplo, quando o usuário muda o símbolo na interface
   */
  public enableSymbolUpdateEvents(): void {
    this.allowSymbolUpdateEvents = true;
    this.symbolUpdateBlocked = false;
    
    // Auto-disable depois de 10 segundos
    setTimeout(() => {
      this.allowSymbolUpdateEvents = false;
    }, 10000);
  }
  
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
          
          // Após autorização bem-sucedida, inscrever-se para receber ticks uma única vez
          // sem disparar eventos de symbol_update frequentes
          if (!this.isRunning) {
            this.lastTickTime = Date.now(); // Inicializa o timestamp como agora para evitar notificações symbol_update desnecessárias
            
            // Temporariamente bloqueia eventos de symbol_update
            this.symbolUpdateBlocked = true;
            setTimeout(() => {
              this.subscribeToTicks(this.activeSymbol);
              
              // Continuamos bloqueados por 60 segundos
              setTimeout(() => {
                this.symbolUpdateBlocked = false;
              }, 60000);
            }, 100);
          }
        }
      }
      
      // Resposta de tick - VERSÃO CORRIGIDA e OTIMIZADA
      if (data.msg_type === 'tick' && data.tick) {
        try {
          // Processar tick conforme esquema JSON
          const tickData = data.tick;
          const price = parseFloat(tickData.quote);
          
          // Extração otimizada do último dígito - usando mesma abordagem do deriv-history-service
          const priceStr = price.toFixed(2); // Formato padrão da Deriv é com 2 casas decimais
          const lastChar = priceStr.charAt(priceStr.length - 1);
          const lastDigit = parseInt(lastChar, 10);
          
          // Extrair dados adicionais do esquema
          const symbol = tickData.symbol;
          const epoch = tickData.epoch;
          const pip_size = tickData.pip_size;
          const subscription_id = tickData.id || (data.subscription ? data.subscription.id : null);
          
          // Reduzir frequência de logs (log a cada 5 ticks em média)
          if (Math.random() < 0.2) {
            console.log(`[OAUTH_DIRECT] Tick recebido: ${price}, Último dígito: ${lastDigit}`);
          }
          
          // Verificar se o último dígito é válido
          if (!isNaN(lastDigit)) {
            // Criar evento com dados completos
            const tickEvent = {
              type: 'tick',
              price,
              lastDigit,
              symbol,
              epoch,
              pip_size,
              subscription_id,
              timestamp: Date.now()
            };
            
            // Atualizar o timestamp do último tick para o controle de notificações symbol_update
            this.lastTickTime = Date.now();
            
            // Notificar listners para atualização de interface
            this.notifyListeners(tickEvent);
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
              
              // Incluir todos os detalhes relevantes do contrato para histórico
              this.notifyListeners({
                type: 'contract_finished',
                contract_id: contract.contract_id,
                is_win: isWin,
                profit: profit,
                contract_details: contract,
                entry_value: contract.buy_price || 0,
                exit_value: contract.sell_price || 0
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
   * Obtém estatísticas de dígitos dos últimos 25 ticks
   * Usado para avaliar condições de entrada das estratégias
   */
  private getDigitStats(): DigitStat[] {
    try {
      // Obter dados de digits dos últimos ticks recebidos
      const localData = localStorage.getItem(`deriv_ticks_${this.activeSymbol}`);
      if (!localData) {
        console.log('[OAUTH_DIRECT] Nenhum histórico de ticks disponível ainda');
        return [];
      }
      
      const lastTicksData = JSON.parse(localData);
      if (!Array.isArray(lastTicksData) || lastTicksData.length < 10) {
        console.log('[OAUTH_DIRECT] Histórico de ticks insuficiente para análise');
        return [];
      }
      
      // Pegar os últimos 25 ticks (ou menos se não houver tantos)
      const sampleSize = Math.min(25, lastTicksData.length);
      const recentTicks = lastTicksData.slice(0, sampleSize);
      
      // Mapear os dígitos
      const digits = recentTicks.map((tick: any) => tick.lastDigit || parseInt(tick.price.toString().slice(-1)));
      
      // Calcular contagem para cada dígito
      const digitCounts: Record<number, number> = {};
      for (let i = 0; i <= 9; i++) {
        digitCounts[i] = 0;
      }
      
      digits.forEach(digit => {
        if (digit >= 0 && digit <= 9) {
          digitCounts[digit]++;
        }
      });
      
      // Converter para o formato de estatísticas de dígitos
      const digitStats: DigitStat[] = [];
      for (let i = 0; i <= 9; i++) {
        const count = digitCounts[i];
        const percentage = Math.round((count / sampleSize) * 100);
        digitStats.push({ digit: i, count, percentage });
      }
      
      console.log(`[OAUTH_DIRECT] Estatísticas de dígitos calculadas: ${JSON.stringify(digitStats.map(d => `${d.digit}:${d.percentage}%`).join(', '))}`);
      
      return digitStats;
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao calcular estatísticas de dígitos:', error);
      return [];
    }
  }

  /**
   * Inicia uma nova operação após o resultado de uma anterior
   */
  private startNextOperation(isWin: boolean, lastContract: any): void {
    try {
      // Se temos uma operação agendada, limpar
      if (this.operationTimeout) {
        clearTimeout(this.operationTimeout);
      }
      
      // Verificar se podemos continuar com base nas configurações
      const shouldContinue = this.validateOperationContinuation(isWin, lastContract);
      
      if (!shouldContinue) {
        console.log('[OAUTH_DIRECT] Estratégia finalizada devido às condições de parada');
        
        this.notifyListeners({
          type: 'bot_stopped',
          message: 'Condições de parada atingidas'
        });
        
        // Parar a execução
        this.stop();
        return;
      }
      
      // Obter a estratégia atual
      const strategyId = this.strategyConfig.toLowerCase();
      const strategy = getStrategyById(strategyId);
      
      // Atualizar o resultado no estado da estratégia
      updateStrategyResult(
        strategyId, 
        isWin ? 'win' : 'loss', 
        isWin ? (lastContract.profit || 0) : -(lastContract.buy_price || 0)
      );
      
      // Obter as estatísticas de dígitos para avaliar condições de entrada
      const digitStats = this.getDigitStats();
      
      // Determinar próximo valor de entrada
      const nextAmount = this.calculateNextAmount(isWin, lastContract);
      
      // Avaliar se devemos entrar baseado nas regras específicas da estratégia e configuração do usuário
      // Buscar configuração salva pelo usuário - estratégia deve usar APENAS a configuração do usuário
      const userConfigObj = localStorage.getItem(`strategy_config_${strategyId}`);
      let userConfig: any = null;
      
      if (userConfigObj) {
        try {
          userConfig = JSON.parse(userConfigObj);
        } catch (err) {
          console.error("[OAUTH_DIRECT] Erro ao carregar configuração do usuário:", err);
        }
      }

      // Garantir que estamos usando o valor do usuário para porcentagem de entrada
      // Se userConfig existir, devemos usar APENAS o valor dele, sem fallback
      const userDefinedPercentage = userConfig?.porcentagemParaEntrar;
      
      console.log(`[OAUTH_DIRECT] Valor de porcentagem definido pelo usuário:`, userDefinedPercentage);
      
      // Usar apenas o valor configurado pelo usuário, para respeitar estritamente sua configuração
      const entryResult = evaluateEntryConditions(
        strategyId,
        digitStats,
        {
          // Usar APENAS o valor do usuário, sem fallback para a estratégia
          porcentagemParaEntrar: userDefinedPercentage,
          martingale: userConfig?.martingale || this.settings.martingaleFactor || 1.5,
          usarMartingaleAposXLoss: userConfig?.usarMartingaleAposXLoss || 2 // Usar martingale após 2 perdas consecutivas
        }
      );
      
      console.log(`[OAUTH_DIRECT] Avaliação de entrada para ${strategyId}: ${entryResult.message}`);
      
      if (entryResult.shouldEnter) {
        // Agendar próxima operação com os parâmetros determinados pela avaliação
        this.operationTimeout = setTimeout(() => {
          // Converter tipo de contrato para formato da API Deriv
          const contractTypeMapping: Record<string, string> = {
            'CALL': 'CALL',
            'PUT': 'PUT',
            'DIGITOVER': 'DIGITOVER',
            'DIGITUNDER': 'DIGITUNDER',
            'DIGITDIFF': 'DIGITDIFF',
            'DIGITEVEN': 'DIGITEVEN',
            'DIGITODD': 'DIGITODD'
          };
          
          // Usar tipo de contrato da avaliação da estratégia
          this.settings.contractType = contractTypeMapping[entryResult.contractType] || 'DIGITOVER';
          
          // Usar previsão da avaliação, se disponível
          if (entryResult.prediction !== undefined) {
            this.settings.prediction = entryResult.prediction;
          }
          
          // Executar a compra com o valor baseado na estratégia
          this.executeContractBuy(entryResult.entryAmount || nextAmount);
        }, 3000);
      } else {
        // Se condições não atendidas, aguardar e verificar novamente
        console.log('[OAUTH_DIRECT] Condições de entrada não atendidas, aguardando próximo tick');
        
        this.operationTimeout = setTimeout(() => {
          // Tentar novamente após aguardar mais ticks
          this.startNextOperation(isWin, lastContract);
        }, 5000);
        
        // Notificar sobre a espera
        this.notifyListeners({
          type: 'info',
          message: `Aguardando condições ideais: ${entryResult.message}`
        });
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
    // Implementação de validação baseada no lucro/perda e limites configurados
    
    // Verificar se temos configurações de limite de perda e meta de lucro
    const profitTarget = this.settings.profitTarget;
    const lossLimit = this.settings.lossLimit;
    
    if (!profitTarget && !lossLimit) {
      // Se não houver limites, continuar operando
      return true;
    }
    
    // Atualizar estatísticas com o resultado
    if (isWin) {
      // Atualizar estatísticas para vitória
      this.sessionStats.wins++;
      
      // Verificar o lucro obtido
      if (lastContract && lastContract.profit) {
        const profit = parseFloat(lastContract.profit);
        if (!isNaN(profit)) {
          this.sessionStats.totalProfit += profit;
        }
      }
    } else {
      // Atualizar estatísticas para derrota
      this.sessionStats.losses++;
      
      // Verificar a perda
      if (lastContract && lastContract.profit) {
        const loss = parseFloat(lastContract.profit); // Será negativo em caso de perda
        if (!isNaN(loss) && loss < 0) {
          this.sessionStats.totalLoss += Math.abs(loss);
        }
      }
    }
    
    // Calcular o lucro líquido
    this.sessionStats.netProfit = this.sessionStats.totalProfit - this.sessionStats.totalLoss;
    
    // Se atingiu a meta de lucro, parar
    const profitTargetNum = typeof profitTarget === 'string' ? parseFloat(profitTarget) : profitTarget;
    if (profitTargetNum && !isNaN(profitTargetNum) && this.sessionStats.netProfit >= profitTargetNum) {
      const targetMessage = `Meta de lucro de ${profitTargetNum} atingida! Lucro atual: ${this.sessionStats.netProfit.toFixed(2)}`;
      console.log(`[OAUTH_DIRECT] Meta de lucro atingida: ${this.sessionStats.netProfit.toFixed(2)} / ${profitTargetNum}`);
      
      // Notificar interface sobre o atingimento da meta
      this.notifyListeners({
        type: 'bot_target_reached',
        message: targetMessage,
        profit: this.sessionStats.netProfit
      });
      
      // Parar o bot com a razão correta
      console.log('[OAUTH_DIRECT] Estratégia finalizada devido às condições de parada');
      this.stop(targetMessage, 'target');
      
      return false; // Parar operações
    }
    
    // Se atingiu o limite de perda, parar
    const lossLimitNum = typeof lossLimit === 'string' ? parseFloat(lossLimit) : lossLimit;
    if (lossLimitNum && !isNaN(lossLimitNum) && this.sessionStats.totalLoss >= lossLimitNum) {
      const limitMessage = `Limite de perda de ${lossLimitNum} atingido! Perda total: ${this.sessionStats.totalLoss.toFixed(2)}`;
      console.log(`[OAUTH_DIRECT] Limite de perda atingido: ${this.sessionStats.totalLoss.toFixed(2)} / ${lossLimitNum}`);
      
      // Notificar interface sobre o limite atingido
      this.notifyListeners({
        type: 'bot_limit_reached',
        message: limitMessage,
        loss: this.sessionStats.totalLoss
      });
      
      // Parar o bot com a razão correta
      console.log('[OAUTH_DIRECT] Estratégia finalizada devido às condições de parada');
      this.stop(limitMessage, 'limit');
      
      return false; // Parar operações
    }
    
    // Se ainda não atingiu nenhum limite, continuar operando
    return true;
  }
  
  /**
   * Assina ticks do símbolo especificado (ou R_100 por padrão)
   * Método público para poder ser chamado diretamente da página
   */
  /**
   * Assina ticks do símbolo especificado seguindo o esquema JSON oficial
   * Otimizado conforme o schema fornecido para Ticks Stream Request
   * 
   * @param symbol Símbolo para receber ticks (R_100 por padrão)
   */
  private lastSymbolUpdateTime: number = 0;
  private readonly SYMBOL_UPDATE_THROTTLE_MS: number = 30000; // 30 segundos - evita reconexões frequentes
  private lastSymbol: string = 'R_100';
  private lastTickTime: number = 0;
  private symbolUpdateBlocked: boolean = false; // Nova flag para bloquear atualizações por um período
  private symbolUpdateBlockTimeout: any = null;

  public subscribeToTicks(symbol: string = 'R_100'): void {
    // Atualizar o símbolo ativo para uso em reconexões
    if (symbol && symbol !== this.activeSymbol) {
      this.activeSymbol = symbol;
      console.log(`[OAUTH_DIRECT] Símbolo ativo atualizado para: ${symbol}`);
      
      // Somente notificar outros componentes se o símbolo realmente mudou
      // E se não enviamos uma atualização recentemente
      const now = Date.now();
      
      // Verificação mais rigorosa para evitar notificações duplicadas:
      // 1. O símbolo deve ter mudado em relação ao último notificado
      // 2. Deve ter passado tempo suficiente desde a última notificação
      // 3. Se estivermos recebendo ticks recentes, não emitir o evento
      // 4. Flag de bloqueio não está ativa
      if (symbol !== this.lastSymbol && 
          now - this.lastSymbolUpdateTime > this.SYMBOL_UPDATE_THROTTLE_MS &&
          now - this.lastTickTime > 2000 &&
          !this.symbolUpdateBlocked) {
        
        this.lastSymbolUpdateTime = now;
        this.lastSymbol = symbol;
        
        // Bloquear eventos de symbol_update por 60 segundos após qualquer atualização
        this.symbolUpdateBlocked = true;
        
        // Limpar bloqueio anterior, se existir
        if (this.symbolUpdateBlockTimeout) {
          clearTimeout(this.symbolUpdateBlockTimeout);
        }
        
        // Desbloquear após 60 segundos
        this.symbolUpdateBlockTimeout = setTimeout(() => {
          this.symbolUpdateBlocked = false;
        }, 60000);
        
        // Registramos no log, mas não notificamos listeners se tudo estiver funcionando
        if (now - this.lastTickTime > 5000) {
          console.log(`[OAUTH_DIRECT] Símbolo alterado para ${symbol}, enviando notificação aos listeners`);
          
          this.notifyListeners({
            type: 'symbol_update',
            symbol: this.activeSymbol,
            message: `Símbolo ativo: ${this.activeSymbol}`
          });
        } else {
          console.log(`[OAUTH_DIRECT] Símbolo alterado para ${symbol}, mas já recebendo ticks recentes (${(now - this.lastTickTime)/1000}s)`);
        }
      } else {
        // Registramos o motivo pelo qual não enviamos a notificação
        const timeSinceLastUpdate = now - this.lastSymbolUpdateTime;
        const timeSinceLastTick = now - this.lastTickTime;
        console.log(`[OAUTH_DIRECT] Notificação de símbolo ${symbol} suprimida:`, 
                   `mesmo símbolo anterior: ${symbol === this.lastSymbol},`,
                   `tempo desde última atualização: ${timeSinceLastUpdate/1000}s,`,
                   `tempo desde último tick: ${timeSinceLastTick/1000}s,`,
                   `bloqueado: ${this.symbolUpdateBlocked}`);
      }
    }
    
    // Verificar se o WebSocket está disponível
    if (!this.webSocket) {
      console.error('[OAUTH_DIRECT] WebSocket não está inicializado!');
      
      // Tentar reconexão e depois inscrever nos ticks
      this.reconnect()
        .then(success => {
          if (success) {
            console.log(`[OAUTH_DIRECT] Reconexão bem-sucedida, inscrevendo para ticks do ${this.activeSymbol}`);
            // Chamar novamente após reconexão bem-sucedida
            setTimeout(() => this.subscribeToTicks(), 500);
          }
        })
        .catch(err => console.error('[OAUTH_DIRECT] Erro na reconexão durante inscrição de ticks:', err));
      return;
    }
    
    if (this.webSocket.readyState !== WebSocket.OPEN) {
      console.error(`[OAUTH_DIRECT] WebSocket não está aberto para inscrição de ticks! Estado atual: ${this.getReadyStateText(this.webSocket.readyState)}`);
      
      // Tentar reconectar se não estiver em estado CONNECTING
      if (this.webSocket.readyState !== WebSocket.CONNECTING) {
        console.log('[OAUTH_DIRECT] Tentando reconectar antes de inscrever para ticks...');
        this.reconnect()
          .then(success => {
            if (success) {
              // Tentar inscrever novamente após reconexão bem-sucedida
              setTimeout(() => this.subscribeToTicks(), 500);
            }
          })
          .catch(err => console.error('[OAUTH_DIRECT] Erro na reconexão durante inscrição de ticks:', err));
      }
      return;
    }
    
    try {
      // Criar requisição conforme o schema JSON oficial
      const request = {
        ticks: symbol,
        subscribe: 1,
        req_id: Date.now() // Identificador único para rastrear esta requisição
      };
      
      console.log(`[OAUTH_DIRECT] Inscrevendo-se para receber ticks do símbolo ${symbol}`);
      console.log(`[OAUTH_DIRECT] Estado WebSocket antes do envio: ${this.getReadyStateText(this.webSocket.readyState)}`);
      
      this.webSocket.send(JSON.stringify(request));
      console.log('[OAUTH_DIRECT] Requisição de ticks enviada com sucesso');
      
      // Registrar o símbolo ativo para futuras reconexões
      this.activeSymbol = symbol;
      
      // Verificar se ainda está conectado após 3 segundos
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
   * Método público para solicitar saldo atual da conta
   * Pode ser chamado pelo componente para atualizar o saldo exibido
   */
  /**
   * Solicita o saldo atual da conta
   * @param options Opções adicionais (subscribe para inscrever-se em atualizações)
   */
  public getAccountBalance(options?: { subscribe?: boolean }): void {
    const subscribe = options?.subscribe ?? false;
    
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.log('[OAUTH_DIRECT] WebSocket não está conectado para obter saldo');
      this.reconnect().then(success => {
        if (success) {
          if (subscribe) {
            this._subscribeToBalance();
          } else {
            this._requestBalance();
          }
        }
      });
      return;
    }
    
    if (subscribe) {
      this._subscribeToBalance();
    } else {
      this._requestBalance();
    }
  }
  
  /**
   * Busca o histórico de ticks para um símbolo específico
   * @param symbol Símbolo para buscar o histórico (ex: R_100)
   * @param count Quantidade de ticks para buscar (máximo 500)
   * @returns Promise com o resultado do histórico
   */
  public getTicksHistory(symbol: string, count: number = 500): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.error('[OAUTH_DIRECT] Erro ao solicitar histórico: WebSocket não está conectado');
        this.reconnect().then(success => {
          if (success) {
            // Tentar novamente após reconexão
            this.getTicksHistory(symbol, count).then(resolve).catch(reject);
          } else {
            reject(new Error('Falha ao reconectar WebSocket'));
          }
        });
        return;
      }

      // ID único para esta solicitação
      const requestId = `ticks_history_${Date.now()}`;
      
      // Função para lidar com a resposta
      const handleHistoryResponse = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);
          
          // Verificar se é a resposta para a nossa solicitação
          if (response && response.req_id === requestId) {
            // Remover o listener após receber a resposta
            this.webSocket?.removeEventListener('message', handleHistoryResponse);
            
            if (response.error) {
              console.error('[OAUTH_DIRECT] Erro ao obter histórico:', response.error);
              reject(response.error);
            } else {
              console.log(`[OAUTH_DIRECT] Histórico recebido para ${symbol} com ${response.history?.prices?.length || 0} ticks`);
              resolve(response);
            }
          }
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao processar resposta de histórico:', error);
        }
      };
      
      // Adicionar listener temporário para esta solicitação específica
      this.webSocket.addEventListener('message', handleHistoryResponse);
      
      // Configurar a data de término (agora) e início (baseado na granularidade de 1 segundo)
      const end = Math.floor(Date.now() / 1000);
      const start = end - count * 2; // Pegar um intervalo maior para garantir que tenhamos ticks suficientes
      
      // Enviar a solicitação de histórico
      const request = {
        ticks_history: symbol,
        req_id: requestId,
        end: end,
        start: start,
        style: 'ticks',
        count: count,
        adjust_start_time: 1
      };
      
      console.log(`[OAUTH_DIRECT] Solicitando ${count} ticks históricos para ${symbol}`);
      
      // Enviar a solicitação para o WebSocket
      try {
        this.webSocket.send(JSON.stringify(request));
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro ao enviar solicitação de histórico:', error);
        this.webSocket.removeEventListener('message', handleHistoryResponse);
        reject(error);
      }
      
      // Configurar timeout para rejeitar a promessa após 10 segundos
      setTimeout(() => {
        if (this.webSocket) {
          this.webSocket.removeEventListener('message', handleHistoryResponse);
          reject(new Error('Timeout ao esperar resposta do histórico de ticks'));
        }
      }, 10000);
    });
  }

  /**
   * Solicita o saldo atual sem criar uma assinatura
   * Método privado utilizado por getAccountBalance
   */
  private _requestBalance(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está conectado para solicitar saldo');
      return;
    }
    
    // Garantir que estamos usando o token ativo correto
    if (!this.activeToken) {
      console.warn('[OAUTH_DIRECT] Nenhum token ativo para solicitar saldo');
      return;
    }
    
    // Solicitação de apenas balanço (sem combiná-la com authorize)
    const request = {
      balance: 1
    };
    
    console.log(`[OAUTH_DIRECT] Solicitando saldo atual para conta com token ${this.activeToken.substring(0, 4)}...`);
    
    try {
      this.webSocket.send(JSON.stringify(request));
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao solicitar saldo:', error);
    }
  }

  /**
   * Assina atualizações de saldo
   * Método privado utilizado por getAccountBalance
   */
  private _subscribeToBalance(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_DIRECT] WebSocket não está conectado para inscrever em saldo');
      return;
    }
    
    // Garantir que estamos usando o token ativo correto
    if (!this.activeToken) {
      console.warn('[OAUTH_DIRECT] Nenhum token ativo para inscrever em saldo');
      return;
    }
    
    // Solicitação de inscrição de balanço (sem combiná-la com authorize)
    const request = {
      balance: 1,
      subscribe: 1
    };
    
    console.log(`[OAUTH_DIRECT] Inscrevendo-se para atualizações de saldo para conta com token ${this.activeToken.substring(0, 4)}...`);
    
    try {
      this.webSocket.send(JSON.stringify(request));
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao inscrever-se para atualizações de saldo:', error);
    }
  }
  
  /**
   * Método legado para compatibilidade - utiliza o novo método _subscribeToBalance
   */
  private subscribeToBalance(): void {
    this._subscribeToBalance();
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
              
              // Verificar se o erro é devido a permissões insuficientes
              if (data.error.code === 'ScopeError' || data.error.message.includes('scope') || data.error.message.includes('permission')) {
                console.warn('[OAUTH_DIRECT] Token não tem permissões de trading. Notificando usuário para autorizar novamente.');
                
                // Armazenar o error e o token com problemas
                localStorage.setItem('deriv_token_scope_error', JSON.stringify({
                  token: token.substring(0, 10) + '...',
                  error: data.error.message,
                  timestamp: Date.now()
                }));
                
                // Notificar a UI sobre o problema
                this.notifyListeners({
                  type: 'token_permission_error',
                  message: 'O token não tem permissões suficientes para operações de trading. Por favor, autorize novamente com as permissões corretas.',
                  details: data.error.message,
                });
                
                // Direcionar o usuário a reautorizar com os escopos corretos
                this.promptForReauthorization();
              }
              
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
            
            // Verificar se o token tem permissões de trading verificando as scopes
            if (data.authorize && data.authorize.scopes) {
              const hasTrading = this.checkHasTradingPermission(data.authorize.scopes);
              
              console.log(`[OAUTH_DIRECT] Token tem permissões de trading: ${hasTrading ? 'SIM' : 'NÃO'}`);
              
              if (!hasTrading) {
                console.warn('[OAUTH_DIRECT] Token autorizado, mas sem permissões de trading.');
                
                // Notificar a UI sobre o problema
                this.notifyListeners({
                  type: 'token_permission_warning',
                  message: 'O token tem acesso limitado. Algumas operações de trading podem não funcionar.',
                  details: 'Permissões de trading não detectadas',
                });
              }
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
   * Verifica se o array de escopos contém permissões de trading
   */
  private checkHasTradingPermission(scopes: string[]): boolean {
    if (!scopes || !Array.isArray(scopes)) {
      console.error('[OAUTH_DIRECT] Escopos inválidos recebidos:', scopes);
      return false;
    }
    
    // Lista de escopos necessários
    const requiredScopes = ['trade', 'trading'];
    
    // Normalizar escopos para comparação (converter para minúsculas)
    const normalizedScopes = scopes.map(s => s.toLowerCase());
    
    // Verificar se pelo menos um dos escopos necessários está presente
    const hasRequiredScope = requiredScopes.some(scope => 
      normalizedScopes.includes(scope.toLowerCase())
    );
    
    // Registrar informações para depuração
    console.log(`[OAUTH_DIRECT] Token tem permissões de trading: ${hasRequiredScope ? 'SIM' : 'NÃO'}`);
    console.log(`[OAUTH_DIRECT] Escopos encontrados: ${normalizedScopes.join(', ')}`);
    
    // Apenas registrar erro crítico - quando não tem permissões essenciais
    if (!hasRequiredScope) {
      console.error('[OAUTH_DIRECT] Token não possui permissões de trading necessárias');
      
      // Registrar erro para ser exibido na interface
      const errorData = {
        token: this.activeToken ? this.activeToken.substring(0, 8) + '...' : 'desconhecido',
        error: 'missing_trading_permission',
        message: 'Este token não possui as permissões necessárias para operações de trading',
        requiredScopes: requiredScopes,
        foundScopes: normalizedScopes,
        timestamp: Date.now()
      };
      
      // Salvar no localStorage
      localStorage.setItem('deriv_token_scope_error', JSON.stringify(errorData));
      
      // Disparar evento para notificar componentes
      try {
        const scopeErrorEvent = new CustomEvent('deriv_token_scope_error', {
          detail: errorData
        });
        document.dispatchEvent(scopeErrorEvent);
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro ao disparar evento de erro de escopo:', error);
      }
    }
    // Removido o else if para alertas de permissões opcionais
    
    return hasRequiredScope;
  }
  
  /**
   * Solicita ao usuário que reautorize a aplicação com os escopos corretos
   * Versão melhorada com registro de ações e notificações abrangentes
   */
  private promptForReauthorization(): void {
    try {
      // Identificar a conta atual
      const currentAccount = localStorage.getItem('deriv_active_loginid') || 'sua conta';
      
      // Salvar o estado atual para retornar após a reautorização
      localStorage.setItem('deriv_pending_reauth', 'true');
      localStorage.setItem('deriv_pending_reauth_timestamp', Date.now().toString());
      
      // Montar a URL de autorização com os escopos corretos
      const appId = '71403'; // App ID do projeto
      const redirectUri = encodeURIComponent(window.location.origin + '/auth-callback');
      
      // Definir todos os escopos necessários
      const allScopes = ['read', 'admin', 'payments', 'trade', 'trading', 'trading_information'];
      const scope = encodeURIComponent(allScopes.join(' '));
      
      // URL de autorização da Deriv com idioma português
      const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;
      
      // Registrar solicitação de reautorização completa
      console.log(`[OAUTH_DIRECT] Solicitando reautorização para ${currentAccount} com escopos: ${allScopes.join(', ')}`);
      
      // Salvar informações de solicitação
      localStorage.setItem('deriv_reauth_request', JSON.stringify({
        timestamp: Date.now(),
        account: currentAccount,
        scopes: allScopes,
        url: authUrl
      }));
      
      // Notificar o usuário
      this.notifyListeners({
        type: 'reauthorization_required',
        message: `É necessário reautorizar ${currentAccount} para operações de trading`,
        details: 'A plataforma precisa de permissões adicionais para funcionar corretamente',
        account: currentAccount,
        scopes: allScopes,
        url: authUrl
      });
      
      // Abrir página de autorização em uma nova janela após breve delay
      setTimeout(() => {
        try {
          const authWindow = window.open(authUrl, '_blank', 'width=800,height=600');
          
          if (!authWindow) {
            console.error('[OAUTH_DIRECT] Falha ao abrir janela de autorização. Possível bloqueio de pop-up.');
            
            // Caso falhe em abrir a janela, mostrar instrução detalhada para o usuário
            this.notifyListeners({
              type: 'error',
              message: 'Não foi possível abrir a janela de autorização',
              details: 'Seu navegador pode estar bloqueando pop-ups. Por favor, permita pop-ups para este site ou use o botão de reautorização na interface.',
              actionRequired: true,
              actionUrl: authUrl
            });
            
            // Disparar evento personalizado de falha na autorização
            const failEvent = new CustomEvent('deriv_auth_window_blocked', {
              detail: {
                timestamp: Date.now(),
                account: currentAccount,
                url: authUrl
              }
            });
            document.dispatchEvent(failEvent);
          } else {
            console.log('[OAUTH_DIRECT] Janela de autorização aberta com sucesso');
            
            // Verificar se a janela está sendo carregada corretamente
            setTimeout(() => {
              try {
                if (authWindow.closed) {
                  console.warn('[OAUTH_DIRECT] Janela de autorização foi fechada rapidamente');
                  this.notifyListeners({
                    type: 'warning',
                    message: 'O processo de autorização foi interrompido',
                    details: 'A janela de autorização foi fechada antes de concluir o processo.'
                  });
                }
              } catch (e) {
                // Ignorar erros de acesso entre origens
              }
            }, 5000);
          }
        } catch (windowError) {
          console.error('[OAUTH_DIRECT] Erro ao abrir janela de autorização:', windowError);
          
          // Notificar que é necessário autorizar manualmente
          this.notifyListeners({
            type: 'error',
            message: 'Erro ao abrir janela de autorização',
            details: 'Por favor, use o botão de reautorização na interface para tentar novamente.'
          });
        }
      }, 1000);
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao solicitar reautorização:', error);
      
      // Notificar erro geral
      this.notifyListeners({
        type: 'error',
        message: 'Erro ao iniciar processo de reautorização',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
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
      const parameters: any = {
        amount: amount,
        basis: 'stake',
        contract_type: contractType,
        currency: 'USD',
        duration: 5,
        duration_unit: 't',
        symbol: 'R_100',
      };
      
      // Adicionar predição se for tipo de contrato com dígito
      if (contractType.includes('DIGIT')) {
        parameters.barrier = prediction.toString();
      }
      
      const buyRequest = {
        buy: 1,
        price: amount,
        parameters
      };
      
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
        // Enviar novamente o evento de bot iniciado para garantir que a interface esteja correta
        this.notifyListeners({
          type: 'bot_started',
          message: 'Bot já em execução'
        });
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
   * @param reason Motivo da parada (opcional)
   * @param type Tipo de motivo (opcional: 'user', 'error', 'limit', 'target')
   */
  stop(reason?: string, type: 'user' | 'error' | 'limit' | 'target' = 'user'): void {
    if (!this.isRunning) {
      console.log('[OAUTH_DIRECT] Serviço já está parado');
      return;
    }
    
    console.log('[OAUTH_DIRECT] Parando serviço de trading direto...');
    
    // Definir como não em execução
    this.isRunning = false;
    
    // Fechar conexão WebSocket
    this.closeConnection();
    
    // Determinar mensagem e notificação baseada no tipo
    let message = reason || 'Serviço parado manualmente';
    let notificationType: 'error' | 'warning' | 'success' | 'info' = 'info';
    
    // Definir tipo de notificação com base no motivo da parada
    if (type === 'error') {
      notificationType = 'error';
    } else if (type === 'limit') {
      notificationType = 'warning';
    } else if (type === 'target') {
      notificationType = 'success';
    }
    
    // Notificar que o serviço foi parado
    this.notifyListeners({
      type: 'bot_stopped',
      message: message,
      reason: reason,
      notificationType: notificationType,
      stopType: type
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
   * Executa a primeira operação após o bot ser iniciado
   * Esta função inicia o ciclo de operações do bot
   * IMPORTANTE: Esta função DEVE emitir o evento bot_started para a interface atualizar
   * 
   * @param amount Valor inicial da operação
   * @returns Promise<boolean> Indica se a operação foi enviada com sucesso
   */
  async executeFirstOperation(amount: number | string): Promise<boolean> {
    // Garantir que o amount seja um número
    const entryAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    try {
      console.log('[OAUTH_DIRECT] Iniciando primeira operação do bot com valor:', amount);
      
      // Verificar se o WebSocket está conectado
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.error('[OAUTH_DIRECT] WebSocket não está conectado para executar operação');
        this.notifyListeners({
          type: 'error',
          message: 'Falha na conexão. Não foi possível iniciar a operação.'
        });
        return false;
      }
      
      // Verificar se há um token autorizado com permissões de trading
      // Verificamos se o token está na lista e tem a flag authorized
      const activeTokenInfo = this.tokens.find(t => t.token === this.activeToken);
      const hasTrading = activeTokenInfo && activeTokenInfo.authorized;
                            
      if (!this.activeToken || !hasTrading) {
        console.error('[OAUTH_DIRECT] Token não tem permissões para trading');
        this.notifyListeners({
          type: 'error',
          message: 'Conta sem permissões de trading. Por favor, reautorize com permissões adequadas.'
        });
        return false;
      }
      
      // Inicializar o estado da estratégia
      const strategyId = this.strategyConfig.toLowerCase();
      const strategy = getStrategyById(strategyId);
      
      if (strategy) {
        console.log(`[OAUTH_DIRECT] Inicializando estratégia: ${strategy.name} (ID: ${strategyId})`);
        initializeStrategyState(strategyId, entryAmount);
        
        // Obter as configurações específicas da estratégia
        if (strategy.config && strategy.config.entryPercentage) {
          console.log(`[OAUTH_DIRECT] Configuração de porcentagem para ${strategy.name}: ${strategy.config.entryPercentage}%`);
        }
      } else {
        console.warn(`[OAUTH_DIRECT] Estratégia não encontrada para ID: ${strategyId}, usando padrões`);
      }
      
      // Obter saldo atual antes de iniciar operações para rastreamento de lucro/perda
      try {
        await new Promise<void>((resolve) => {
          // Criar handler temporário para receber o saldo
          const balanceHandler = (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              if (data && data.balance) {
                // Salvar saldo inicial para cálculos de lucro/perda
                this.sessionStats.initialBalance = parseFloat(data.balance.balance);
                this.sessionStats.currentBalance = this.sessionStats.initialBalance;
                
                // Reiniciar estatísticas da sessão
                this.sessionStats.totalProfit = 0;
                this.sessionStats.totalLoss = 0;
                this.sessionStats.wins = 0;
                this.sessionStats.losses = 0;
                this.sessionStats.netProfit = 0;
                this.sessionStats.startTime = new Date();
                
                console.log(`[OAUTH_DIRECT] Saldo inicial registrado: ${this.sessionStats.initialBalance}`);
                
                // Remover handler após receber o saldo
                if (this.webSocket) {
                  this.webSocket.removeEventListener('message', balanceHandler);
                }
                resolve();
              }
            } catch (e) {
              // Ignorar mensagens que não são do tipo balance
            }
          };
          
          // Adicionar handler temporário
          if (this.webSocket) {
            this.webSocket.addEventListener('message', balanceHandler);
            
            // Solicitar saldo
            const balanceRequest = {
              balance: 1
            };
            this.webSocket.send(JSON.stringify(balanceRequest));
            
            // Definir timeout para caso não receba resposta
            setTimeout(() => {
              if (this.webSocket) {
                this.webSocket.removeEventListener('message', balanceHandler);
              }
              resolve(); // Continuar mesmo sem o saldo
            }, 3000);
          } else {
            resolve(); // Continuar mesmo sem WebSocket
          }
        });
      } catch (e) {
        console.warn('[OAUTH_DIRECT] Erro ao obter saldo inicial:', e);
        // Continuar mesmo sem o saldo inicial
      }
      
      // Solicitar compra (API Deriv)
      // Para opções digitais (Digits):
      // https://api.deriv.com/api-explorer/#contract_for
      
      let symbolCode = 'R_100';  // Índice volatilidade 100
      let contractType = 'DIGITDIFF';  // Tipo de contrato (dígito diferente)
      let duration = '1';  // Duração em ticks
      let durationUnit = 't';  // Unidade de duração (t para ticks)
      let prediction = '0';  // Previsão do dígito (para contratos Digit)
      
      // Construir a requisição de compra
      // Usaremos configurações padrão simplificadas para iniciar
      console.log('[OAUTH_DIRECT] Usando configurações padrão para primeira operação');
      
      // A estratégia agora é sempre uma string simples
      // Derivamos parâmetros do nome e configurações
      try {
        // Determinar tipo de contrato com base no nome da estratégia
        if (this.strategyConfig.includes('under') || this.strategyConfig.includes('baixo') || this.strategyConfig.includes('low')) {
          contractType = 'DIGITUNDER';
          console.log('[OAUTH_DIRECT] Usando tipo DIGITUNDER baseado no nome da estratégia');
        } else if (this.strategyConfig.includes('over') || this.strategyConfig.includes('alto') || this.strategyConfig.includes('high')) {
          contractType = 'DIGITOVER';
          console.log('[OAUTH_DIRECT] Usando tipo DIGITOVER baseado no nome da estratégia');
        } else if (this.strategyConfig.includes('diff')) {
          contractType = 'DIGITDIFF';
          console.log('[OAUTH_DIRECT] Usando tipo DIGITDIFF baseado no nome da estratégia');
        } else if (this.strategyConfig.includes('match')) {
          contractType = 'DIGITMATICH';
          console.log('[OAUTH_DIRECT] Usando tipo DIGITMATCH baseado no nome da estratégia');
        }
        
        // Usar settings para previsão
        if (this.settings.prediction !== undefined) {
          prediction = this.settings.prediction.toString();
          console.log('[OAUTH_DIRECT] Usando previsão das configurações:', prediction);
        }
      } catch (error) {
        console.error('[OAUTH_DIRECT] Erro ao processar parâmetros da estratégia:', error);
      }
      
      // Construir parâmetros básicos
      const parameters: any = {
        amount: amount,
        basis: 'stake',
        contract_type: contractType,
        currency: 'USD',
        duration: duration,
        duration_unit: durationUnit,
        symbol: symbolCode
      };
      
      // Adicionar previsão para contratos de dígitos
      if (contractType.startsWith('DIGIT')) {
        parameters.barrier = prediction;
      }
      
      // Requisição de compra de contrato completa
      const buyRequest = {
        buy: 1,
        price: amount,
        parameters: parameters,
        subscribe: 1
      };
      
      console.log('[OAUTH_DIRECT] Enviando solicitação de compra:', buyRequest);
      
      // Enviar solicitação
      this.webSocket.send(JSON.stringify(buyRequest));
      
      // Notificar sobre a tentativa de compra e enviar evento de bot ativo para atualizar a interface
      this.notifyListeners({
        type: 'operation_started',
        message: `Iniciando operação: ${contractType} em ${symbolCode}, valor: ${amount}`
      });
      
      // Enviar explicitamente um evento bot_started para garantir que a interface seja atualizada
      this.notifyListeners({
        type: 'bot_started',
        message: 'Bot ativado após início de operação'
      });
      
      return true;
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao executar primeira operação:', error);
      this.notifyListeners({
        type: 'error',
        message: `Erro ao iniciar operação: ${error}`
      });
      return false;
    }
  }
  
  /**
   * Autoriza o token ativo para obter informações da conta mais recentes
   * Este método será chamado pelo BotController para atualizar os dados da conta
   * 
   * @returns Promise<boolean> Indica se a autorização foi bem-sucedida
   */
  async authorizeActiveToken(): Promise<boolean> {
    try {
      // Verificar se temos um token ativo
      if (!this.activeToken) {
        this.loadAllTokens();
        
        if (!this.activeToken) {
          console.error('[OAUTH_DIRECT] Nenhum token ativo disponível para autorização');
          return false;
        }
      }
      
      // Verificar se temos WebSocket disponível
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.log('[OAUTH_DIRECT] WebSocket não está disponível, inicializando conexão');
        try {
          await this.setupWebSocket();
        } catch (error) {
          console.error('[OAUTH_DIRECT] Erro ao configurar WebSocket para autorização:', error);
          return false;
        }
      }
      
      // Enviar solicitação de autorização
      const reqId = Date.now();
      const authRequest = {
        authorize: this.activeToken,
        req_id: reqId
      };
      
      return new Promise<boolean>((resolve) => {
        // Handler para receber resposta de autorização
        const messageHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            
            // Verificar se é a resposta da nossa solicitação
            if (data.req_id === reqId) {
              // Remover o handler após receber a resposta
              if (this.webSocket) {
                this.webSocket.removeEventListener('message', messageHandler);
              }
              
              if (data.error) {
                console.error('[OAUTH_DIRECT] Erro na autorização do token ativo:', data.error.message);
                resolve(false);
                return;
              }
              
              if (data.authorize) {
                console.log('[OAUTH_DIRECT] Token ativo autorizado com sucesso:', data.authorize.loginid);
                
                // Salvar informações da conta para uso futuro
                localStorage.setItem('deriv_account_info', JSON.stringify({
                  ...data.authorize,
                  timestamp: Date.now()
                }));
                
                // Atualizar loginid do token ativo
                const tokenIndex = this.tokens.findIndex(t => t.token === this.activeToken);
                if (tokenIndex >= 0) {
                  this.tokens[tokenIndex].loginid = data.authorize.loginid;
                  this.tokens[tokenIndex].authorized = true;
                }
                
                // Notificar sobre a autorização
                this.notifyListeners({
                  type: 'authorized',
                  account: data.authorize
                });
                
                // Assinar para atualizações de saldo
                this.subscribeToBalance();
                
                resolve(true);
                return;
              }
              
              // Se chegou aqui, não recebemos uma resposta válida
              console.error('[OAUTH_DIRECT] Resposta de autorização inválida:', data);
              resolve(false);
            }
          } catch (error) {
            console.error('[OAUTH_DIRECT] Erro ao processar resposta de autorização:', error);
            resolve(false);
          }
        };
        
        // Adicionar handler temporário para esta solicitação
        if (this.webSocket) {
          this.webSocket.addEventListener('message', messageHandler);
          
          // Enviar solicitação de autorização
          this.webSocket.send(JSON.stringify(authRequest));
          
          // Definir timeout para caso não receba resposta
          setTimeout(() => {
            if (this.webSocket) {
              this.webSocket.removeEventListener('message', messageHandler);
            }
            console.error('[OAUTH_DIRECT] Timeout na autorização do token ativo');
            resolve(false);
          }, 10000);
        } else {
          console.error('[OAUTH_DIRECT] WebSocket não disponível para autorização');
          resolve(false);
        }
      });
    } catch (error) {
      console.error('[OAUTH_DIRECT] Erro ao autorizar token ativo:', error);
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
    this.strategyConfig = strategy;
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
   * VERSÃO MELHORADA: Garante que as notificações ocorram mesmo em caso de componentes não responsivos
   */
  private notifyListeners(event: TradingEvent): void {
    console.log(`[OAUTH_DIRECT] Notificando ${this.eventListeners.length} listeners sobre: ${event.type}`);
    
    // Fazer uma cópia da lista de listeners para evitar problemas se um listener se remover durante a notificação
    const listeners = [...this.eventListeners];
    
    // Garantir que a notificação ocorra no próximo ciclo do event loop
    setTimeout(() => {
      listeners.forEach((listener, index) => {
        try {
          console.log(`[OAUTH_DIRECT] Enviando evento ${event.type} para listener #${index+1}`);
          listener({...event, timestamp: Date.now()}); // Garantir que cada listener recebe um objeto novo com timestamp único
        } catch (error) {
          console.error(`[OAUTH_DIRECT] Erro ao notificar listener #${index+1}:`, error);
        }
      });
    }, 0);
  }
}

// Exportar uma instância única do serviço
export const oauthDirectService = new OAuthDirectService();