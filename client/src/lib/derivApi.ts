/**
 * derivApi.ts
 * Implementação da interface de comunicação com a API Deriv
 * Manipula autenticação, autorização e comunicação com o servidor WebSocket da Deriv
 */

// Constantes da API
const DERIV_WS_URL = 'wss://ws.derivws.com/websockets/v3';
const DEFAULT_APP_ID = '71403'; // ID oficial do nosso aplicativo

// Interface para eventos de resposta da API
interface ApiResponse {
  error?: {
    code: string;
    message: string;
  };
  [key: string]: any;
}

// Tipos de callbacks para eventos de WebSocket
type MessageCallback = (response: ApiResponse) => void;
type ConnectionCallback = (connected: boolean) => void;
type ErrorCallback = (error: Error) => void;

/**
 * Classe DerivAPI para gerenciar a conexão WebSocket com a API Deriv
 */
class DerivAPI {
  private socket: WebSocket | null = null;
  private isConnecting: boolean = false;
  private requestId: number = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private lastMessageTime: number = 0;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS: number = 5;
  private readonly PING_INTERVAL: number = 30000; // 30 segundos
  private readonly RECONNECT_DELAY: number = 2000; // 2 segundos iniciais
  
  // Armazenar callbacks para mensagens
  private callbacks: Map<number, MessageCallback> = new Map();

  // Armazenar listeners de eventos
  private connectionListeners: ConnectionCallback[] = [];
  private errorListeners: ErrorCallback[] = [];
  
  // Referência ao token usado atualmente
  private currentToken: string | null = null;
  
  // Informações da conta autenticada
  private authorizeInfo: any = null;
  private balanceInfo: any = null;
  
  // Configurações da API
  private appId: string = DEFAULT_APP_ID;
  private apiUrl: string = DERIV_WS_URL;
  
  constructor() {
    // Inicializar com os valores armazenados, se existirem
    this.appId = localStorage.getItem('deriv_app_id') || DEFAULT_APP_ID;
    this.apiUrl = localStorage.getItem('deriv_api_url') || DERIV_WS_URL;
    this.currentToken = localStorage.getItem('deriv_api_token');
    
    // Tentar conectar automaticamente ao inicializar, se houver token
    if (this.currentToken) {
      this.connect();
    }
  }
  
  /**
   * Conecta ao WebSocket da API Deriv
   * @returns Promise que resolve quando a conexão for estabelecida
   */
  public connect(): Promise<boolean> {
    // Se já estiver conectado ou tentando conectar, retornar estado atual
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      console.log('[DerivAPI] WebSocket já está conectado ou conectando');
      return Promise.resolve(true);
    }
    
    if (this.isConnecting) {
      console.log('[DerivAPI] Conexão já em andamento');
      return Promise.resolve(false);
    }
    
    this.isConnecting = true;
    console.log('[DerivAPI] Conectando ao WebSocket...');
    
    return new Promise((resolve) => {
      // Limpar qualquer conexão anterior
      if (this.socket) {
        try {
          this.socket.onopen = null;
          this.socket.onclose = null;
          this.socket.onerror = null;
          this.socket.onmessage = null;
          this.socket.close();
        } catch (e) {
          console.error('[DerivAPI] Erro ao fechar WebSocket anterior:', e);
        }
      }
      
      // Criar nova conexão
      this.socket = new WebSocket(this.apiUrl);
      
      this.socket.onopen = () => {
        console.log('[DerivAPI] Conexão estabelecida');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.notifyConnectionListeners(true);
        
        // Iniciar o ping para manter a conexão ativa
        this.startPingInterval();
        
        // Se tiver token, autorizar automaticamente
        if (this.currentToken) {
          this.authorize(this.currentToken)
            .then(() => {
              console.log('[DerivAPI] Autorização automática bem-sucedida');
            })
            .catch(error => {
              console.error('[DerivAPI] Falha na autorização automática:', error);
            });
        }
        
        resolve(true);
      };
      
      this.socket.onclose = (event) => {
        console.log(`[DerivAPI] Conexão fechada: ${event.code} - ${event.reason}`);
        this.isConnecting = false;
        this.notifyConnectionListeners(false);
        this.clearPingInterval();
        
        // Tentar reconectar automaticamente
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
          console.log(`[DerivAPI] Tentativa de reconexão ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS} em ${this.RECONNECT_DELAY}ms`);
          
          if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
          }
          
          this.reconnectTimeout = setTimeout(() => {
            this.reconnectAttempts++;
            this.connect()
              .then((success) => {
                if (success) {
                  console.log('[DerivAPI] Reconexão bem-sucedida');
                } else {
                  console.log('[DerivAPI] Falha na reconexão');
                }
              })
              .catch((error) => {
                console.error('[DerivAPI] Erro durante reconexão:', error);
              });
          }, this.RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts));
        } else {
          console.error('[DerivAPI] Número máximo de tentativas de reconexão atingido');
        }
      };
      
      this.socket.onerror = (event) => {
        console.error('[DerivAPI] Erro na conexão WebSocket:', event);
        this.isConnecting = false;
        this.notifyConnectionListeners(false);
        this.notifyErrorListeners(new Error('Erro na conexão WebSocket'));
      };
      
      this.socket.onmessage = (event) => {
        this.lastMessageTime = Date.now();
        
        try {
          const data: ApiResponse = JSON.parse(event.data);
          
          // Verificar se é uma resposta a uma requisição específica
          const requestId = data.req_id as number;
          if (requestId && this.callbacks.has(requestId)) {
            const callback = this.callbacks.get(requestId);
            if (callback) {
              callback(data);
              this.callbacks.delete(requestId);
            }
          }
          
          // Emitir evento customizado para a UI
          const messageEvent = new CustomEvent('deriv:message', { 
            detail: data 
          });
          document.dispatchEvent(messageEvent);
          
          // Verificar por atualizações de saldo
          if (data.balance) {
            this.balanceInfo = data.balance;
            // Disparar evento de atualização de saldo
            const balanceEvent = new CustomEvent('deriv:balance', { 
              detail: data.balance 
            });
            document.dispatchEvent(balanceEvent);
          }
          
          // Verificar por erros
          if (data.error) {
            console.error(`[DerivAPI] Erro da API: ${data.error.code} - ${data.error.message}`);
            // Disparar evento de erro para a UI
            const errorEvent = new CustomEvent('deriv:error', { 
              detail: data.error 
            });
            document.dispatchEvent(errorEvent);
            
            // Tratamento específico para erros de autenticação
            if (data.error.code === 'InvalidToken') {
              this.notifyErrorListeners(new Error(`Token inválido: ${data.error.message}`));
            }
          }
        } catch (error) {
          console.error('[DerivAPI] Erro ao processar mensagem:', error);
        }
      };
    });
  }
  
  /**
   * Desconecta do WebSocket da API
   * @param clearToken Se deve limpar o token salvo
   */
  public disconnect(clearToken: boolean = false): void {
    this.clearPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.socket) {
      try {
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        this.socket.close();
        this.socket = null;
      } catch (e) {
        console.error('[DerivAPI] Erro ao desconectar WebSocket:', e);
      }
    }
    
    // Limpar token se solicitado
    if (clearToken) {
      this.currentToken = null;
      localStorage.removeItem('deriv_api_token');
    }
    
    this.notifyConnectionListeners(false);
    console.log('[DerivAPI] WebSocket desconectado');
  }
  
  /**
   * Adiciona um ouvinte para eventos de conexão
   * @param listener Função de callback para eventos de conexão
   */
  public addConnectionListener(listener: ConnectionCallback): void {
    this.connectionListeners.push(listener);
  }
  
  /**
   * Remove um ouvinte para eventos de conexão
   * @param listener Função de callback a ser removida
   */
  public removeConnectionListener(listener: ConnectionCallback): void {
    const index = this.connectionListeners.indexOf(listener);
    if (index !== -1) {
      this.connectionListeners.splice(index, 1);
    }
  }
  
  /**
   * Adiciona um ouvinte para eventos de erro
   * @param listener Função de callback para eventos de erro
   */
  public addErrorListener(listener: ErrorCallback): void {
    this.errorListeners.push(listener);
  }
  
  /**
   * Remove um ouvinte para eventos de erro
   * @param listener Função de callback a ser removida
   */
  public removeErrorListener(listener: ErrorCallback): void {
    const index = this.errorListeners.indexOf(listener);
    if (index !== -1) {
      this.errorListeners.splice(index, 1);
    }
  }
  
  /**
   * Notifica todos os ouvintes de conexão
   * @param connected Estado da conexão (true = conectado, false = desconectado)
   */
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('[DerivAPI] Erro em ouvinte de conexão:', error);
      }
    });
  }
  
  /**
   * Notifica todos os ouvintes de erro
   * @param error Objeto de erro a ser notificado
   */
  private notifyErrorListeners(error: Error): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('[DerivAPI] Erro em ouvinte de erro:', err);
      }
    });
  }
  
  /**
   * Inicia o intervalo de ping para manter a conexão ativa
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        // Verificar se não recebemos mensagens há mais de 35 segundos
        const now = Date.now();
        if (now - this.lastMessageTime > 35000) {
          console.log('[DerivAPI] Nenhuma mensagem recebida por muito tempo, enviando ping...');
        }
        
        // Enviar ping
        this.send({ ping: 1 }).catch(error => {
          console.error('[DerivAPI] Erro ao enviar ping:', error);
        });
      } else {
        console.warn('[DerivAPI] Não foi possível enviar ping, WebSocket não está aberto');
        this.clearPingInterval();
      }
    }, this.PING_INTERVAL);
  }
  
  /**
   * Limpa o intervalo de ping
   */
  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  /**
   * Envia um comando para a API e recebe a resposta
   * @param data Objeto de dados a ser enviado para a API
   * @returns Promise com a resposta da API
   */
  public send(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        // Se não estiver conectado, tentar conectar e enviar
        this.connect()
          .then(() => {
            this.sendAfterConnected(data, resolve, reject);
          })
          .catch(error => {
            reject(new Error(`Falha ao conectar para envio: ${error.message}`));
          });
      } else {
        // Se já estiver conectado, enviar diretamente
        this.sendAfterConnected(data, resolve, reject);
      }
    });
  }
  
  /**
   * Função auxiliar para enviar comando após conexão estabelecida
   */
  private sendAfterConnected(data: any, resolve: (value: any) => void, reject: (reason: any) => void): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      reject(new Error('WebSocket não está pronto para enviar solicitação'));
      return;
    }
    
    // Gerar ID de requisição único
    this.requestId++;
    const requestId = this.requestId;
    
    // Adicionar ID de requisição e App ID aos dados
    const requestData = {
      ...data,
      req_id: requestId,
      app_id: this.appId
    };
    
    // Registrar callback para esta requisição
    this.callbacks.set(requestId, (response: ApiResponse) => {
      if (response.error) {
        reject(new Error(`API Deriv erro ${response.error.code}: ${response.error.message}`));
      } else {
        resolve(response);
      }
    });
    
    try {
      // Enviar dados
      const jsonData = JSON.stringify(requestData);
      this.socket.send(jsonData);
    } catch (error) {
      // Remover callback em caso de erro
      this.callbacks.delete(requestId);
      reject(error);
    }
  }
  
  /**
   * Autoriza o usuário com um token
   * @param token Token de autorização
   * @returns Promise com os dados de autorização
   */
  public async authorize(token: string): Promise<any> {
    if (!token) {
      throw new Error('Token não especificado');
    }
    
    try {
      // Enviar solicitação de autorização
      const response = await this.send({ authorize: token });
      
      if (response.authorize) {
        // Armazenar token e informações de autorização
        this.currentToken = token;
        this.authorizeInfo = response.authorize;
        localStorage.setItem('deriv_api_token', token);
        
        // Disparar evento de autorização para a UI
        const authorizeEvent = new CustomEvent('deriv:authorize', { 
          detail: response.authorize 
        });
        document.dispatchEvent(authorizeEvent);
        
        return response.authorize;
      } else {
        throw new Error('Resposta de autorização inválida');
      }
    } catch (error) {
      console.error('[DerivAPI] Erro de autorização:', error);
      throw error;
    }
  }
  
  /**
   * Verifica se o token atual é válido
   * @returns Promise com resultado da verificação
   */
  public async verifyToken(): Promise<boolean> {
    if (!this.currentToken) {
      return false;
    }
    
    try {
      const response = await this.send({ authorize: this.currentToken });
      return !!response.authorize;
    } catch (error) {
      console.error('[DerivAPI] Erro ao verificar token:', error);
      return false;
    }
  }
  
  /**
   * Obtém informações da conta autorizada
   * @returns Informações da autorização ou null se não autenticado
   */
  public getAuthorizeInfo(): any {
    return this.authorizeInfo;
  }
  
  /**
   * Troca para outra conta disponível
   * @param loginid ID da conta para a qual alternar
   * @returns Promise com os dados da nova conta
   */
  public async setAccount(loginid: string): Promise<any> {
    if (!loginid) {
      throw new Error('ID de login não especificado');
    }
    
    try {
      const response = await this.send({ set_account: loginid });
      
      if (response.set_account) {
        // Atualizar informações de autorização
        this.authorizeInfo = {
          ...this.authorizeInfo,
          loginid: loginid,
          balance: response.set_account.balance,
          currency: response.set_account.currency
        };
        
        // Disparar evento de troca de conta para a UI
        const accountEvent = new CustomEvent('deriv:account_changed', { 
          detail: response.set_account 
        });
        document.dispatchEvent(accountEvent);
        
        return response.set_account;
      } else {
        throw new Error('Resposta de troca de conta inválida');
      }
    } catch (error) {
      console.error('[DerivAPI] Erro ao trocar de conta:', error);
      throw error;
    }
  }
  
  /**
   * Obtém informações de saldo da conta
   * @returns Promise com os dados de saldo
   */
  public async getBalance(): Promise<any> {
    try {
      const response = await this.send({ balance: 1, subscribe: 1 });
      
      if (response.balance) {
        this.balanceInfo = response.balance;
        return response.balance;
      } else {
        throw new Error('Resposta de saldo inválida');
      }
    } catch (error) {
      console.error('[DerivAPI] Erro ao obter saldo:', error);
      throw error;
    }
  }
  
  /**
   * Faz logout do usuário
   * @returns Promise com resultado do logout
   */
  public async logout(): Promise<any> {
    try {
      const response = await this.send({ logout: 1 });
      
      if (response.logout) {
        // Limpar dados de autenticação
        this.currentToken = null;
        this.authorizeInfo = null;
        localStorage.removeItem('deriv_api_token');
        
        // Disparar evento de logout para a UI
        const logoutEvent = new CustomEvent('deriv:logout');
        document.dispatchEvent(logoutEvent);
        
        return response.logout;
      } else {
        throw new Error('Resposta de logout inválida');
      }
    } catch (error) {
      console.error('[DerivAPI] Erro ao fazer logout:', error);
      throw error;
    }
  }
  
  /**
   * Obtém lista de contratos ativos
   * @returns Promise com a lista de contratos
   */
  public async getOpenContracts(): Promise<any> {
    try {
      const response = await this.send({ proposal_open_contract: 1, subscribe: 1 });
      return response.proposal_open_contract;
    } catch (error) {
      console.error('[DerivAPI] Erro ao obter contratos abertos:', error);
      throw error;
    }
  }
  
  /**
   * Obtém ticks para um símbolo específico
   * @param symbol Símbolo para o qual obter ticks (ex: "R_100")
   * @returns Promise com os dados de ticks
   */
  public async subscribeTicks(symbol: string): Promise<any> {
    try {
      const response = await this.send({ ticks: symbol, subscribe: 1 });
      return response;
    } catch (error) {
      console.error(`[DerivAPI] Erro ao assinar ticks para ${symbol}:`, error);
      throw error;
    }
  }
  
  /**
   * Verifica se o WebSocket está conectado
   * @returns True se conectado, false caso contrário
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Configura o App ID a ser usado nas requisições
   * @param appId ID da aplicação
   */
  public setAppId(appId: string): void {
    this.appId = appId;
    localStorage.setItem('deriv_app_id', appId);
  }
  
  /**
   * Configura a URL da API WebSocket
   * @param url URL do WebSocket
   */
  public setApiUrl(url: string): void {
    this.apiUrl = url;
    localStorage.setItem('deriv_api_url', url);
  }
}

// Exportar uma instância única para uso global
export const derivAPI = new DerivAPI();
export default derivAPI;