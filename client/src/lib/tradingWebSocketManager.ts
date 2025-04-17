/**
 * WebSocketManager dedicado exclusivamente para operações de trading
 * Completamente separado do WebSocketManager do frontend
 * Usa apenas o token OAuth para operações reais com a API Deriv
 */

export type TradingWebSocketStatus = 'disconnected' | 'connecting' | 'connected' | 'authorized' | 'error';

export interface TradingWebSocketEvents {
  onStatusChange?: (status: TradingWebSocketStatus) => void;
  onError?: (error: any) => void;
  onResponse?: (response: any) => void;
  onContractUpdate?: (contract: any) => void;
  onBalanceUpdate?: (balance: any) => void;
}

class TradingWebSocketManager {
  private socket: WebSocket | null = null;
  private oauthToken: string | null = null;
  private endpoint: string = "wss://ws.derivws.com/websockets/v3"; // Endpoint atualizado
  private appId: string = "71403"; // App ID da Deriv
  private requestCallbacks: Map<string, (response: any) => void> = new Map();
  private lastError: Error | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private status: TradingWebSocketStatus = 'disconnected';
  private events: TradingWebSocketEvents = {};
  private subscriptionIds: string[] = [];

  private static instance: TradingWebSocketManager;

  private constructor() {
    // Implementação singleton
  }

  public static getInstance(): TradingWebSocketManager {
    if (!TradingWebSocketManager.instance) {
      TradingWebSocketManager.instance = new TradingWebSocketManager();
    }
    return TradingWebSocketManager.instance;
  }

  /**
   * Obtém o status atual da conexão
   */
  public getStatus(): TradingWebSocketStatus {
    return this.status;
  }

  /**
   * Define eventos para a conexão WebSocket
   * @param events Objeto com callbacks para diferentes eventos
   */
  public setEvents(events: TradingWebSocketEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Verifica se o socket está conectado
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Verifica se está autorizado (tem token válido)
   */
  public isAuthorized(): boolean {
    return this.status === 'authorized';
  }

  /**
   * Atualiza o status e notifica os listeners
   */
  private updateStatus(newStatus: TradingWebSocketStatus): void {
    if (this.status === newStatus) return;
    
    console.log(`[TRADING_WS] Status alterado: ${this.status} -> ${newStatus}`);
    this.status = newStatus;
    
    if (this.events.onStatusChange) {
      this.events.onStatusChange(newStatus);
    }
  }

  /**
   * Conecta ao WebSocket da Deriv
   * @returns Promise que resolve quando conectado
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.isConnected()) {
        console.log('[TRADING_WS] WebSocket já está conectado');
        resolve(true);
        return;
      }

      this.updateStatus('connecting');
      
      try {
        console.log('[TRADING_WS] Conectando ao WebSocket da Deriv...');
        this.socket = new WebSocket(this.endpoint);

        this.socket.onopen = () => {
          console.log('[TRADING_WS] Conexão estabelecida com sucesso');
          this.reconnectAttempts = 0;
          this.updateStatus('connected');
          this.startPingInterval();
          
          // Se tiver token, autorizar automaticamente
          if (this.oauthToken) {
            this.authorize(this.oauthToken)
              .then(() => resolve(true))
              .catch(error => {
                console.error('[TRADING_WS] Erro ao autorizar na conexão inicial:', error);
                resolve(true); // Ainda resolvemos como sucesso pois a conexão está ok
              });
          } else {
            resolve(true);
          }
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = (error) => {
          console.error('[TRADING_WS] Erro na conexão WebSocket:', error);
          this.lastError = new Error('Erro na conexão WebSocket');
          this.updateStatus('error');
          
          if (this.events.onError) {
            this.events.onError(error);
          }
          
          reject(error);
        };

        this.socket.onclose = (event) => {
          console.warn(`[TRADING_WS] Conexão fechada (${event.code}): ${event.reason || 'Sem razão especificada'}`);
          this.cleanup();
          this.updateStatus('disconnected');
          
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          } else {
            console.error('[TRADING_WS] Número máximo de tentativas de reconexão atingido');
            this.lastError = new Error('Falha após múltiplas tentativas de reconexão');
            this.updateStatus('error');
            reject(new Error('Falha após múltiplas tentativas de reconexão'));
          }
        };
      } catch (error) {
        console.error('[TRADING_WS] Exceção ao conectar:', error);
        this.lastError = error instanceof Error ? error : new Error('Erro desconhecido ao conectar');
        this.updateStatus('error');
        reject(error);
      }
    });
  }

  /**
   * Autoriza a conexão com um token OAuth
   * @param token Token OAuth para autorização
   */
  public authorize(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        return this.connect().then(() => this.authorize(token)).catch(reject);
      }

      this.oauthToken = token;
      console.log('[TRADING_WS] Autorizando com token OAuth...');

      this.sendRequest({
        authorize: token
      }).then(response => {
        if (response.error) {
          console.error('[TRADING_WS] Erro na autorização:', response.error);
          this.lastError = new Error(`Erro na autorização: ${response.error.message || 'Desconhecido'}`);
          reject(response.error);
          return;
        }

        console.log('[TRADING_WS] Autorização bem-sucedida:', response.authorize?.loginid);
        this.updateStatus('authorized');
        
        // Assinar para atualizações de saldo
        this.subscribeToBalance();
        
        resolve(response);
      }).catch(error => {
        console.error('[TRADING_WS] Exceção durante autorização:', error);
        this.lastError = error instanceof Error ? error : new Error('Erro desconhecido na autorização');
        reject(error);
      });
    });
  }

  /**
   * Teste manual de token - para verificação de tokens
   * @param token Token OAuth para testar
   */
  public testToken(token: string): Promise<{
    isValid: boolean;
    loginid?: string;
    balance?: number;
    currency?: string;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      console.log('[TRADING_WS] Testando token manualmente...');
      
      // Conexão temporária para teste
      const testSocket = new WebSocket(this.endpoint);
      let timeoutId: NodeJS.Timeout;
      
      // Timeout para garantir que o teste não fique pendurado
      timeoutId = setTimeout(() => {
        console.error('[TRADING_WS] Timeout no teste de token');
        testSocket.close();
        resolve({
          isValid: false, 
          error: 'Timeout durante o teste do token'
        });
      }, 10000);
      
      testSocket.onopen = () => {
        console.log('[TRADING_WS] Conexão de teste estabelecida, enviando authorize');
        
        const req = {
          authorize: token,
          req_id: 'test_token_' + Date.now()
        };
        
        testSocket.send(JSON.stringify(req));
      };
      
      testSocket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          console.log('[TRADING_WS] Resposta de teste recebida:', response);
          
          clearTimeout(timeoutId);
          
          if (response.error) {
            console.error('[TRADING_WS] Token inválido:', response.error);
            testSocket.close();
            resolve({
              isValid: false,
              error: response.error.message || 'Erro na autorização'
            });
            return;
          }
          
          if (response.msg_type === 'authorize' && response.authorize) {
            const auth = response.authorize;
            console.log('[TRADING_WS] Token válido para:', auth.loginid);
            
            // Fechar a conexão de teste
            testSocket.close();
            
            resolve({
              isValid: true,
              loginid: auth.loginid,
              balance: auth.balance,
              currency: auth.currency
            });
          }
        } catch (error) {
          console.error('[TRADING_WS] Erro ao processar resposta de teste:', error);
          clearTimeout(timeoutId);
          testSocket.close();
          resolve({
            isValid: false,
            error: 'Erro ao processar resposta do teste'
          });
        }
      };
      
      testSocket.onerror = (error) => {
        console.error('[TRADING_WS] Erro na conexão de teste:', error);
        clearTimeout(timeoutId);
        resolve({
          isValid: false,
          error: 'Erro na conexão WebSocket'
        });
      };
      
      testSocket.onclose = () => {
        console.log('[TRADING_WS] Conexão de teste fechada');
        clearTimeout(timeoutId);
      };
    });
  }

  /**
   * Processa mensagens recebidas do WebSocket
   */
  private handleMessage(data: string): void {
    try {
      const response = JSON.parse(data);
      
      // Notificar evento genérico de resposta
      if (this.events.onResponse) {
        this.events.onResponse(response);
      }
      
      // Processar atualizações de contratos
      if (response.msg_type === 'proposal_open_contract' && response.proposal_open_contract) {
        if (this.events.onContractUpdate) {
          this.events.onContractUpdate(response.proposal_open_contract);
        }
      }
      
      // Processar atualizações de saldo
      if (response.msg_type === 'balance' && response.balance) {
        if (this.events.onBalanceUpdate) {
          this.events.onBalanceUpdate(response.balance);
        }
      }
      
      // Processar callback específico para esta requisição
      if (response.req_id && this.requestCallbacks.has(response.req_id)) {
        const callback = this.requestCallbacks.get(response.req_id);
        if (callback) {
          callback(response);
          this.requestCallbacks.delete(response.req_id);
        }
      }
      
      // Salvar IDs de subscrição para cancelamento posterior
      if (response.subscription && response.subscription.id) {
        this.subscriptionIds.push(response.subscription.id);
      }
      
    } catch (error) {
      console.error('[TRADING_WS] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Envia uma requisição para a API
   * @param request Objeto da requisição
   */
  public sendRequest(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected()) {
        reject(new Error('WebSocket não está conectado'));
        return;
      }

      const reqId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const req = {
        req_id: reqId,
        ...request
      };

      // Registrar callback para esta requisição
      this.requestCallbacks.set(reqId, (response: any) => {
        if (response.error) {
          reject(response.error);
        } else {
          resolve(response);
        }
      });

      if (this.socket) {
        this.socket.send(JSON.stringify(req));
      }
    });
  }

  /**
   * Assina para atualizações de saldo
   */
  private subscribeToBalance(): Promise<any> {
    return this.sendRequest({
      balance: 1,
      subscribe: 1
    }).catch(error => {
      console.error('[TRADING_WS] Erro ao assinar para atualizações de saldo:', error);
      return error;
    });
  }

  /**
   * Agenda uma tentativa de reconexão
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    
    console.log(`[TRADING_WS] Agendando reconexão em ${delay}ms (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(error => {
        console.error(`[TRADING_WS] Falha na tentativa de reconexão ${this.reconnectAttempts}:`, error);
      });
    }, delay);
  }

  /**
   * Inicia o intervalo de ping para manter a conexão ativa
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendPing().catch(error => {
          console.warn('[TRADING_WS] Erro ao enviar ping:', error);
        });
      }
    }, 30000); // A cada 30 segundos
  }

  /**
   * Envia um ping para manter a conexão ativa
   */
  private sendPing(): Promise<any> {
    return this.sendRequest({ ping: 1 });
  }

  /**
   * Limpa recursos da conexão
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.requestCallbacks.clear();
  }

  /**
   * Cancela todas as subscrições ativas
   */
  private cancelAllSubscriptions(): Promise<any> {
    const promises: Promise<any>[] = [];
    
    // Primeiro tenta usar forget_all para tipos conhecidos
    const forgetAllPromise = this.sendRequest({
      forget_all: ["ticks", "proposal", "proposal_open_contract", "balance"]
    }).catch(error => {
      console.error('[TRADING_WS] Erro ao cancelar todas as subscrições:', error);
      return error;
    });
    
    promises.push(forgetAllPromise);
    
    // Depois cancela subscrições individuais armazenadas
    for (const id of this.subscriptionIds) {
      const promise = this.sendRequest({
        forget: id
      }).catch(error => {
        console.error(`[TRADING_WS] Erro ao cancelar subscrição ${id}:`, error);
        return error;
      });
      
      promises.push(promise);
    }
    
    return Promise.all(promises).then(() => {
      this.subscriptionIds = [];
      return true;
    });
  }

  /**
   * Desconecta do WebSocket
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        this.cleanup();
        this.updateStatus('disconnected');
        resolve();
        return;
      }

      // Primeiro cancelar todas as subscrições
      this.cancelAllSubscriptions()
        .finally(() => {
          this.cleanup();
          
          if (this.socket) {
            // Definir um timeout para garantir que a desconexão ocorra
            const timeout = setTimeout(() => {
              console.log('[TRADING_WS] Timeout atingido, forçando desconexão');
              this.socket = null;
              this.updateStatus('disconnected');
              resolve();
            }, 3000);
            
            // Definir um handler para o evento de fechamento
            const oldSocket = this.socket;
            const onCloseHandler = () => {
              clearTimeout(timeout);
              this.socket = null;
              this.updateStatus('disconnected');
              resolve();
            };
            
            oldSocket.addEventListener('close', onCloseHandler, { once: true });
            oldSocket.close();
          } else {
            this.updateStatus('disconnected');
            resolve();
          }
        });
    });
  }

  /**
   * Reinicia a conexão WebSocket
   */
  public async restart(): Promise<boolean> {
    await this.disconnect();
    return this.connect();
  }

  /**
   * Obtém o último erro
   */
  public getLastError(): Error | null {
    return this.lastError;
  }
}

// Exporta a instância singleton
export const tradingWebSocket = TradingWebSocketManager.getInstance();

// Exporta função de teste de token para uso externo
export const testOAuthToken = (token: string): Promise<{
  isValid: boolean;
  loginid?: string;
  balance?: number;
  currency?: string;
  error?: string;
}> => {
  return tradingWebSocket.testToken(token);
};