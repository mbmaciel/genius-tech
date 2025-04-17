/**
 * DerivAPI - Classe de comunicação com a API da Deriv
 * Implementação baseada na biblioteca binary-live-api do projeto original
 */

import WebSocket from 'ws';

// Tipos de resposta da API Deriv
interface AuthorizeResponse {
  authorize: {
    loginid: string;
    fullname: string;
    balance: number;
    currency: string;
    email: string;
    is_virtual: boolean;
    landing_company_name: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    loginid: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ServerStatusResponse {
  website_status: {
    site_status: string;
    message: string;
    [key: string]: any;
  };
  [key: string]: any;
}

// Implementação da API da Deriv
export class DerivAPI {
  // Singleton
  private static instance: DerivAPI;

  // WebSocket
  private socket: WebSocket | null = null;
  private requestId: number = 1;
  private pendingRequests: Map<number, { resolve: Function, reject: Function }> = new Map();
  private activeSubscriptions: Map<number, string> = new Map(); // Rastrear assinaturas ativas (reqId -> tipo)

  // Reconexão
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: any = null;
  private reconnecting: boolean = false;

  // Autenticação
  private isTokenAuth: boolean = false;
  private token: string | null = null;
  
  // Configuração da API
  private baseUrl: string = 'wss://ws.derivws.com/websockets/v3';
  private appId: number = 71403;  // App ID correto para esta aplicação
  
  // Token da API do ambiente
  private defaultToken: string = import.meta.env.VITE_DERIV_API_TOKEN || 'XyeYPSAEjMeznXZ';
  
  // Armazenamento de informações da conta
  private accountInfo: any = {
    loginId: null,
    balance: {
      currency: null,
      balance: 0,
      loginId: null
    },
    isVirtual: false,
    landingCompanyName: null
  };
  
  // Construtor privado (Singleton)
  private constructor() {}
  
  // Método para obter instância (Singleton)
  public static getInstance(): DerivAPI {
    if (!DerivAPI.instance) {
      DerivAPI.instance = new DerivAPI();
    }
    return DerivAPI.instance;
  }
  
  // Verifica se o WebSocket está conectado
  public get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Obtém o status da conexão atual
   * @returns true se estiver conectado, false caso contrário
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
  
  /**
   * Obtém o token atual da API
   * @returns string com o token ou string vazia se não estiver autenticado
   */
  public getToken(): string {
    return this.token || '';
  }
  
  /**
   * Define o App ID para a conexão com a API
   * @param id ID do aplicativo registrado na Deriv
   */
  public setAppId(id: number): void {
    if (!this.isConnected) {
      this.appId = id;
    } else {
      console.warn("Não é possível alterar o App ID enquanto está conectado");
    }
  }
  
  /**
   * Conecta ao WebSocket da Deriv e autoriza com token, se fornecido
   * @param token Token de API opcional para autorização
   * @returns Promise que resolve após conexão estabelecida
   */
  public async connect(token?: string): Promise<any> {
    // Se já estiver conectado, retorna
    if (this.isConnected || this.reconnecting) {
      console.warn("[DerivAPI] Já existe uma conexão ativa ou uma tentativa de reconexão em andamento");
      return Promise.resolve({ alreadyConnected: true });
    }
    
    console.log("[DerivAPI] Iniciando conexão com API Deriv, método connect() chamado");
    
    // Se o token foi fornecido, armazenar
    if (token) {
      console.log(`[DerivAPI] Token fornecido diretamente (primeiros 5 caracteres): ${token.substring(0, 5)}***`);
      this.token = token;
    } else {
      // Tenta recuperar do localStorage
      try {
        console.log("[DerivAPI] Tentando recuperar token do localStorage...");
        const localToken = localStorage.getItem('deriv_api_token');
        if (localToken) {
          console.log(`[DerivAPI] Token recuperado do localStorage (primeiros 5 caracteres): ${localToken.substring(0, 5)}***`);
          this.token = localToken;
        } else if (this.defaultToken) {
          console.log(`[DerivAPI] Usando token padrão da configuração (primeiros 5 caracteres): ${this.defaultToken.substring(0, 5)}***`);
          this.token = this.defaultToken;
        } else {
          console.warn("[DerivAPI] Nenhum token disponível para autenticação!");
        }
      } catch (error) {
        console.warn("[DerivAPI] Erro ao carregar token do localStorage:", error);
        // Se houver erro, usar token padrão
        if (this.defaultToken) {
          console.log(`[DerivAPI] Usando token padrão devido a erro (primeiros 5 caracteres): ${this.defaultToken.substring(0, 5)}***`);
          this.token = this.defaultToken;
        } else {
          console.error("[DerivAPI] Nenhum token de fallback disponível após erro!");
        }
      }
    }
    
    this.reconnecting = true;
    const connectionUrl = `${this.baseUrl}?app_id=${this.appId}`;
    
    try {
      // Fechar qualquer conexão existente
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      
      console.log(`[DerivAPI] Conectando a ${connectionUrl}...`);
      
      // Criar nova conexão WebSocket
      this.socket = new WebSocket(connectionUrl);
      
      // Configurar handlers de eventos
      return new Promise((resolve, reject) => {
        if (!this.socket) {
          this.reconnecting = false;
          return reject(new Error("Falha ao criar WebSocket"));
        }
        
        // Timeout de 15 segundos para a conexão
        const connectionTimeout = setTimeout(() => {
          if (this.socket) {
            this.socket.close();
            this.socket = null;
          }
          this.reconnecting = false;
          reject(new Error("Timeout de conexão com o WebSocket"));
        }, 15000);
        
        // Evento: Conexão estabelecida
        this.socket.onopen = async () => {
          clearTimeout(connectionTimeout);
          console.log("[DerivAPI] Conexão WebSocket estabelecida com sucesso");
          this.reconnectAttempts = 0;
          this.reconnecting = false;
          
          // Se houver um token, autorizar
          if (this.token) {
            try {
              const authResponse = await this.authorize(this.token);
              resolve({
                connected: true,
                authorized: true,
                accountInfo: this.accountInfo
              });
            } catch (authError) {
              console.error("[DerivAPI] Erro na autorização:", authError);
              resolve({
                connected: true,
                authorized: false,
                error: authError
              });
            }
          } else {
            resolve({
              connected: true,
              authorized: false
            });
          }
        };
        
        // Evento: Erro de conexão
        this.socket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error("[DerivAPI] Erro no WebSocket:", error);
          this.reconnecting = false;
          reject(error);
        };
        
        // Evento: Conexão fechada
        this.socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.warn(`[DerivAPI] Conexão WebSocket fechada: Código ${event.code}`);
          this.reconnecting = false;
          this.attemptReconnect();
          // Se a promessa ainda não foi resolvida/rejeitada
          reject(new Error(`Conexão fechada: ${event.reason || 'Sem razão especificada'}`));
        };
        
        // Evento: Mensagem recebida
        this.socket.onmessage = (event) => {
          // Processar a mensagem
          this.processMessage(event.data);
        };
      });
    } catch (error) {
      this.reconnecting = false;
      console.error("[DerivAPI] Erro ao estabelecer conexão:", error);
      throw error;
    }
  }
  
  /**
   * Desconecta do WebSocket da Deriv
   * @param forceLogout Se true, também remove o token e informações da conta
   * @param preserveReconnect Se true, não dispara eventos ou logs de desconexão
   */
  public disconnect(forceLogout: boolean = false, preserveReconnect: boolean = false): void {
    if (!this.socket) {
      return;
    }
    
    if (!preserveReconnect) {
      console.log('[DerivAPI] Desconectando do WebSocket...');
    }
    
    // Limpar timers e estados
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Remover handlers para evitar chamadas indesejadas
    this.socket.onclose = null;
    this.socket.onerror = null;
    this.socket.onmessage = null;
    
    // Fechar a conexão
    this.socket.close();
    this.socket = null;
    
    // Limpar informações de autenticação se solicitado
    if (forceLogout) {
      this.isTokenAuth = false;
      this.token = null;
      this.accountInfo = {
        loginId: null,
        balance: {
          currency: null,
          balance: 0,
          loginId: null
        },
        isVirtual: false,
        landingCompanyName: null
      };
      
      // Remover token do armazenamento local
      try {
        localStorage.removeItem('deriv_api_token');
      } catch (error) {
        console.warn('[DerivAPI] Erro ao remover token do localStorage:', error);
      }
      
      if (!preserveReconnect) {
        console.log('[DerivAPI] Sessão encerrada e informações de conta limpas');
      }
    }
    
    if (!preserveReconnect) {
      // Disparar evento de desconexão
      this.dispatchEvent('disconnect');
    }
  }
  
  /**
   * Autoriza a conexão usando um token API
   * @param token Token de API
   * @returns Promise que resolve com os dados da conta ou rejeita com erro
   */
  public async authorize(token: string): Promise<AuthorizeResponse> {
    if (!token) {
      return Promise.reject(new Error('Token não fornecido'));
    }
    
    console.log(`[DerivAPI] Autorizando com token (primeiros 5 caracteres): ${token.substring(0, 5)}***`);
    
    try {
      const response = await this.send({
        authorize: token
      }) as AuthorizeResponse;
      
      // Verificar se a resposta é válida
      if (!response.authorize) {
        throw new Error('Resposta de autorização inválida');
      }
      
      // Atualizar informações da conta
      this.isTokenAuth = true;
      this.token = token;
      this.accountInfo = {
        loginId: response.authorize.loginid,
        name: response.authorize.fullname,
        email: response.authorize.email,
        balance: {
          balance: response.authorize.balance,
          currency: response.authorize.currency,
          loginId: response.authorize.loginid
        },
        isVirtual: response.authorize.is_virtual,
        landingCompanyName: response.authorize.landing_company_name,
        loginTime: new Date().toISOString()
      };
      
      // Salvar token para uso futuro
      try {
        localStorage.setItem('deriv_api_token', token);
      } catch (error) {
        console.warn('[DerivAPI] Erro ao salvar token no localStorage:', error);
      }
      
      console.log(`[DerivAPI] Autorização bem-sucedida para a conta ${response.authorize.loginid}`);
      this.dispatchEvent('authorize', response.authorize);
      
      // Iniciar assinatura de saldo
      this.subscribeToBalanceUpdates()
        .then(() => console.log('[DerivAPI] Assinatura de saldo iniciada'))
        .catch(e => console.warn('[DerivAPI] Erro ao iniciar assinatura de saldo:', e.message));
      
      return response;
    } catch (error) {
      console.error('[DerivAPI] Erro durante autorização:', error);
      this.isTokenAuth = false;
      this.token = null;
      throw error;
    }
  }
  
  /**
   * Envia uma requisição para a API da Deriv
   * @param request Objeto de requisição
   * @param timeout Timeout em ms (padrão: 30000)
   * @returns Promise que resolve com a resposta ou rejeita com erro
   */
  public async send(request: any, timeout: number = 30000): Promise<any> {
    if (!this.isConnected) {
      return Promise.reject(new Error('WebSocket não está conectado'));
    }
    
    const requestId = this.requestId++;
    const requestObj = {
      ...request,
      req_id: requestId,
    };
    
    return new Promise((resolve, reject) => {
      // Configurar timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Timeout na requisição #${requestId}`));
      }, timeout);
      
      // Armazenar callbacks para resposta
      this.pendingRequests.set(requestId, {
        resolve: (response: any) => {
          clearTimeout(timeoutId);
          resolve(response);
        },
        reject: (error: any) => {
          clearTimeout(timeoutId);
          reject(error);
        }
      });
      
      // Enviar requisição
      try {
        const requestJson = JSON.stringify(requestObj);
        this.socket!.send(requestJson);
      } catch (error) {
        clearTimeout(timeoutId);
        this.pendingRequests.delete(requestId);
        reject(error);
      }
    });
  }
  
  /**
   * Processa mensagens recebidas do WebSocket
   * @param data Dados da mensagem
   */
  private processMessage(data: any): void {
    try {
      const response = JSON.parse(data.toString());
      
      // Verificar se é resposta a uma requisição pendente
      if (response.req_id && this.pendingRequests.has(response.req_id)) {
        const callbacks = this.pendingRequests.get(response.req_id);
        this.pendingRequests.delete(response.req_id);
        
        // Verificar se há um erro na resposta
        if (response.error) {
          callbacks!.reject(response.error);
          return;
        }
        
        callbacks!.resolve(response);
        return;
      }
      
      // Processa assinaturas (ex: balance, ticks, etc)
      this.processSubscription(response);
      
    } catch (error) {
      console.error('[DerivAPI] Erro ao processar mensagem:', error);
    }
  }
  
  /**
   * Processa mensagens de assinatura (balance, proposal, etc)
   * @param response Resposta da API
   */
  private processSubscription(response: any): void {
    // Resposta de alteração de saldo
    if (response.msg_type === 'balance') {
      // Atualizar saldo da conta
      if (response.balance && this.accountInfo) {
        this.accountInfo.balance = {
          balance: response.balance.balance,
          currency: response.balance.currency,
          loginId: response.balance.loginid
        };
        
        // Disparar evento de atualização de saldo
        this.dispatchEvent('balance', response.balance);
      }
    }
    
    // Aqui podem ser adicionados outros tipos de assinatura conforme necessário
    // (ticks, proposal, etc)
  }
  
  /**
   * Assina atualizações de saldo da conta
   * @returns Promise que resolve quando a assinatura for bem-sucedida
   */
  public async subscribeToBalanceUpdates(): Promise<any> {
    if (!this.isTokenAuth) {
      return Promise.reject(new Error('Autenticação necessária para assinar saldo'));
    }
    
    try {
      const response = await this.send({
        balance: 1,
        subscribe: 1
      });
      
      return response;
    } catch (error) {
      console.error('[DerivAPI] Erro ao assinar atualizações de saldo:', error);
      throw error;
    }
  }
  
  /**
   * Tenta reconectar após perda de conexão
   */
  private attemptReconnect(): void {
    if (this.reconnecting) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn(`[DerivAPI] Máximo de ${this.maxReconnectAttempts} tentativas de reconexão atingido`);
      this.reconnectAttempts = 0;
      this.dispatchEvent('reconnect_failed');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`[DerivAPI] Tentando reconexão em ${delay / 1000} segundos (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnecting = true;
      
      // Tentar reconectar com o token armazenado
      this.connect(this.token)
        .then(() => {
          console.log('[DerivAPI] Reconexão bem-sucedida');
          this.dispatchEvent('reconnect');
          this.reconnecting = false;
        })
        .catch(error => {
          console.error('[DerivAPI] Falha na reconexão:', error);
          this.reconnecting = false;
          // Tentar novamente
          this.attemptReconnect();
        });
    }, delay);
  }
  
  /**
   * Dispara um evento personalizado
   * @param eventName Nome do evento
   * @param detail Dados adicionais do evento
   */
  private dispatchEvent(eventName: string, detail: any = null): void {
    try {
      document.dispatchEvent(new CustomEvent(`deriv:${eventName}`, {
        detail
      }));
    } catch (error) {
      console.warn(`[DerivAPI] Erro ao disparar evento ${eventName}:`, error);
    }
  }
  
  /**
   * Verifica o status do servidor da Deriv
   * @returns Promise que resolve com o status do servidor
   */
  public async getServerStatus(): Promise<ServerStatusResponse> {
    try {
      return await this.send({
        website_status: 1
      }) as ServerStatusResponse;
    } catch (error) {
      console.error('[DerivAPI] Erro ao obter status do servidor:', error);
      throw error;
    }
  }
  
  /**
   * Obtém informações sobre a conta autenticada
   * @returns Objeto com informações da conta ou objeto vazio se não autenticado
   */
  public getAccountInfo(): any {
    if (!this.isTokenAuth) {
      return {};
    }
    
    return { ...this.accountInfo };
  }
}

// Exportar instância singleton
const derivAPI = DerivAPI.getInstance();
export default derivAPI;