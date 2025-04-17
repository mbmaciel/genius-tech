/**
 * Gerenciador de conexão WebSocket com a API Deriv
 * Esta conexão é usada para autenticação OAuth e operações com a conta do usuário
 * É separada da conexão que obtém dados do índice R_100
 */

class WebSocketManager {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private appId: string = "71403"; // App ID da Deriv
  private endpoint: string = "wss://ws.derivws.com/websockets/v3"; // Endpoint atualizado
  private requestCallbacks: Map<string, (response: any) => void> = new Map();
  private authListeners: Array<(isAuthorized: boolean, account?: any) => void> = [];
  private balanceListeners: Array<(balance: any) => void> = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000;

  private static instance: WebSocketManager;

  private constructor() {
    this.initEventListeners();
  }

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Adiciona listeners para eventos de visibilidade da página
   */
  private initEventListeners(): void {
    window.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('focus', this.handleFocus);
  }

  /**
   * Remove os listeners de eventos
   */
  private removeEventListeners(): void {
    window.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('focus', this.handleFocus);
  }

  /**
   * Conecta-se à API WebSocket da Deriv
   * @returns Promise que resolve quando a conexão for estabelecida
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        console.log("Conexão WebSocket já está aberta");
        resolve(true);
        return;
      }

      try {
        console.log("Conectando à API Deriv...");
        this.socket = new WebSocket(this.endpoint);

        this.socket.onopen = () => {
          console.log("Conexão WebSocket estabelecida");
          this.reconnectAttempts = 0;
          this.startPingInterval();
          resolve(true);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
          console.error("Erro na conexão WebSocket:", error);
          reject(error);
        };

        this.socket.onclose = (event) => {
          console.warn("Conexão WebSocket fechada:", event.code, "-", event.reason);
          this.clearPingInterval();
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            console.error("Número máximo de tentativas de reconexão atingido");
            reject(new Error("Falha na conexão após várias tentativas"));
          }
        };
      } catch (error) {
        console.error("Erro ao conectar:", error);
        this.scheduleReconnect();
        reject(error);
      }
    });
  }

  /**
   * Processa as mensagens recebidas do WebSocket
   * @param data Dados recebidos
   */
  private handleMessage(data: string): void {
    try {
      const response = JSON.parse(data);
      console.log("Resposta recebida:", response);

      // Verificar se é uma resposta de autorização
      if (response.msg_type === 'authorize') {
        const isAuthorized = !response.error;
        this.notifyAuthListeners(isAuthorized, response.authorize);

        // Se autorizado com sucesso, assinar para atualizações de saldo
        if (isAuthorized && response.authorize) {
          this.sendRequest({
            balance: 1,
            subscribe: 1
          });
        }
      }

      // Verificar se é uma atualização de saldo
      if (response.msg_type === 'balance') {
        this.notifyBalanceListeners(response.balance);
      }

      // Processar callbacks para requisições específicas
      if (response.req_id && this.requestCallbacks.has(response.req_id)) {
        const callback = this.requestCallbacks.get(response.req_id);
        if (callback) {
          callback(response);
          this.requestCallbacks.delete(response.req_id);
        }
      }

      // Disparar evento customizado para a aplicação
      const event = new CustomEvent('deriv_api_response', { detail: response });
      window.dispatchEvent(event);

    } catch (error) {
      console.error("Erro ao processar mensagem:", error);
    }
  }

  /**
   * Envia uma requisição para a API
   * @param request Objeto da requisição
   * @param callback Callback opcional para processar a resposta
   * @returns Promise com a resposta
   */
  public sendRequest(request: any, callback?: (response: any) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket não está conectado"));
        return;
      }

      const reqId = Date.now().toString();
      const req = {
        req_id: reqId,
        ...request
      };

      // Registrar callback para esta requisição
      const responseHandler = (response: any) => {
        if (callback) callback(response);
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      };

      this.requestCallbacks.set(reqId, responseHandler);

      // Enviar a requisição
      this.socket.send(JSON.stringify(req));
    });
  }

  /**
   * Autoriza o usuário usando um token
   * @param token Token de autenticação
   * @returns Promise com o resultado da autorização
   */
  public authorize(token: string): Promise<any> {
    this.token = token;
    return this.sendRequest({
      authorize: token,
      passthrough: { app_id: this.appId }
    });
  }

  /**
   * Define um novo token e autoriza
   * @param token Novo token
   */
  public setToken(token: string): Promise<any> {
    return this.authorize(token);
  }

  /**
   * Desconecta do WebSocket
   */
  public disconnect(): void {
    this.cleanup();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Limpa recursos da conexão
   */
  private cleanup(): void {
    this.clearPingInterval();
    this.requestCallbacks.clear();
    this.removeEventListeners();
  }

  /**
   * Inicia o intervalo de ping para manter a conexão ativa
   */
  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 30000); // A cada 30 segundos
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
   * Envia um ping para manter a conexão ativa
   */
  private sendPing(): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.sendRequest({ ping: 1 }).catch(err => {
        console.warn("Erro ao enviar ping:", err);
      });
    }
  }
  
  /**
   * Verifica se o cliente está autorizado
   * @returns token de autorização ou null se não autorizado
   */
  public getAuthorization(): string | null {
    return this.token;
  }

  /**
   * Agenda uma tentativa de reconexão
   */
  private scheduleReconnect(): void {
    setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.connect().catch(err => {
        console.error("Erro ao reconectar:", err);
      });
    }, this.reconnectDelay);
  }

  /**
   * Adiciona um listener para eventos de autenticação
   * @param listener Função a ser chamada quando o status de autenticação mudar
   */
  public onAuthChange(listener: (isAuthorized: boolean, account?: any) => void): void {
    this.authListeners.push(listener);
  }

  /**
   * Remove um listener de eventos de autenticação
   * @param listener Função a ser removida
   */
  public removeAuthListener(listener: (isAuthorized: boolean, account?: any) => void): void {
    const index = this.authListeners.indexOf(listener);
    if (index !== -1) {
      this.authListeners.splice(index, 1);
    }
  }

  /**
   * Notifica todos os listeners de autenticação
   * @param isAuthorized Status de autenticação
   * @param account Informações da conta, se autenticado
   */
  private notifyAuthListeners(isAuthorized: boolean, account?: any): void {
    this.authListeners.forEach(listener => {
      listener(isAuthorized, account);
    });
  }

  /**
   * Adiciona um listener para eventos de saldo
   * @param listener Função a ser chamada quando o saldo mudar
   */
  public onBalanceChange(listener: (balance: any) => void): void {
    this.balanceListeners.push(listener);
  }

  /**
   * Remove um listener de eventos de saldo
   * @param listener Função a ser removida
   */
  public removeBalanceListener(listener: (balance: any) => void): void {
    const index = this.balanceListeners.indexOf(listener);
    if (index !== -1) {
      this.balanceListeners.splice(index, 1);
    }
  }

  /**
   * Notifica todos os listeners de saldo
   * @param balance Informações de saldo
   */
  private notifyBalanceListeners(balance: any): void {
    this.balanceListeners.forEach(listener => {
      listener(balance);
    });
  }

  /**
   * Obtém informações da conta atual
   * @returns Promise com informações da conta
   */
  public getAccountInfo(): Promise<any> {
    return this.sendRequest({ get_account_status: 1 });
  }

  /**
   * Cancela todas as subscrições ativas
   */
  public cancelAllActiveSubscriptions(): Promise<any> {
    return this.sendRequest({ forget_all: "ticks" });
  }

  /**
   * Tratamento de evento quando a página fica visível
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible' && (!this.socket || this.socket.readyState !== WebSocket.OPEN)) {
      console.log("Página visível, reconectando...");
      this.connect().catch(console.error);
    }
  };

  /**
   * Tratamento de evento quando a rede está online
   */
  private handleOnline = (): void => {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log("Rede online, reconectando...");
      this.connect().catch(console.error);
    }
  };

  /**
   * Tratamento de evento quando a janela ganha foco
   */
  private handleFocus = (): void => {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.log("Janela em foco, verificando conexão...");
      this.connect().catch(console.error);
    }
  };
}

// Exporta uma instância singleton
export const derivAPI = WebSocketManager.getInstance();

/**
 * Helper para conectar à API Deriv
 * @returns Promise com o resultado da conexão
 */
export const connectToDerivAPI = (): Promise<boolean> => {
  return derivAPI.connect();
};

/**
 * Helper para autorizar com a API Deriv
 * @param token Token de autenticação
 * @returns Promise com o resultado da autorização
 */
export const authorizeDerivAPI = (token: string): Promise<any> => {
  return derivAPI.authorize(token);
};

/**
 * Helper para enviar uma requisição para a API Deriv
 * @param request Objeto da requisição
 * @returns Promise com a resposta
 */
export const sendRequest = (request: any): Promise<any> => {
  return derivAPI.sendRequest(request);
};

/**
 * Inicia o processo de login com a Deriv
 * Redireciona para a página de autorização OAuth da Deriv
 */
export const loginWithDeriv = (): void => {
  const appId = "71403"; // App ID da Deriv
  const callbackUrl = `${window.location.origin}/oauth-callback`;
  const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${encodeURIComponent(callbackUrl)}`;
  window.location.href = authUrl;
};