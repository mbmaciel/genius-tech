/**
 * Serviço de conexão WebSocket direta com a API Deriv
 * Esta implementação é independente da conexão OAuth usada pelo bot
 */

export class DirectWebSocketService {
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private messageQueue: any[] = [];
  private requestId: number = 1;
  private callbacks: Map<number, (response: any) => void> = new Map();
  private appId: string = '1089'; // App ID público usado apenas para dados de mercado não autenticados
  private eventListeners: Map<string, Set<(data: any) => void>> = new Map();
  private keepAliveInterval: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private autoReconnect: boolean = true;
  
  constructor() {
    this.eventListeners.set('tick', new Set());
    this.eventListeners.set('connection', new Set());
    this.eventListeners.set('error', new Set());
  }
  
  /**
   * Conecta ao WebSocket da Deriv
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        console.log('[DIRECT_WS] Já conectado ao WebSocket');
        resolve(true);
        return;
      }
      
      try {
        console.log('[DIRECT_WS] Iniciando conexão WebSocket direta com a Deriv API');
        this.socket = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + this.appId);
        
        this.socket.onopen = () => {
          console.log('[DIRECT_WS] Conexão WebSocket estabelecida');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Processa qualquer mensagem na fila
          while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendRawMessage(message);
          }
          
          // Inicia o keepalive
          this.startKeepAlive();
          
          // Notifica os listeners de conexão
          this.notifyListeners('connection', { status: 'connected' });
          
          resolve(true);
        };
        
        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          // Processa callbacks de resposta
          if (data.req_id && this.callbacks.has(data.req_id)) {
            const callback = this.callbacks.get(data.req_id);
            if (callback) {
              callback(data);
              this.callbacks.delete(data.req_id);
            }
          }
          
          // Processa eventos de tick
          if (data.tick) {
            const tickEvent = {
              symbol: data.tick.symbol,
              id: data.tick.id,
              quote: data.tick.quote,
              epoch: data.tick.epoch,
              pipSize: data.tick.pip_size
            };
            this.notifyListeners('tick', tickEvent);
          }
          
          // Processa erros
          if (data.error) {
            console.error('[DIRECT_WS] Erro na resposta da API:', data.error);
            this.notifyListeners('error', data.error);
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[DIRECT_WS] Erro na conexão WebSocket:', error);
          this.notifyListeners('error', { message: 'Erro na conexão WebSocket' });
          reject(error);
        };
        
        this.socket.onclose = (event) => {
          console.log('[DIRECT_WS] Conexão WebSocket fechada:', event.code, event.reason);
          this.isConnected = false;
          this.stopKeepAlive();
          
          // Tenta reconectar se necessário
          if (this.autoReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`[DIRECT_WS] Tentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
              this.connect()
                .then((success) => {
                  if (success) {
                    console.log('[DIRECT_WS] Reconexão bem-sucedida');
                  }
                })
                .catch((error) => {
                  console.error('[DIRECT_WS] Falha na reconexão:', error);
                });
            }, 2000 * this.reconnectAttempts); // Backoff exponencial
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[DIRECT_WS] Número máximo de tentativas de reconexão atingido');
            this.notifyListeners('error', { message: 'Falha ao reconectar' });
          }
          
          this.notifyListeners('connection', { status: 'disconnected' });
        };
        
      } catch (error) {
        console.error('[DIRECT_WS] Erro ao conectar ao WebSocket:', error);
        this.notifyListeners('error', { message: 'Erro ao conectar ao WebSocket' });
        reject(error);
      }
    });
  }
  
  /**
   * Assina para receber ticks de um símbolo específico
   */
  public subscribeTicks(symbol: string): Promise<boolean> {
    if (!this.isConnected) {
      console.log('[DIRECT_WS] Não conectado, tentando conectar primeiro');
      return this.connect().then(() => this.subscribeTicks(symbol));
    }
    
    console.log(`[DIRECT_WS] Assinando ticks para ${symbol}`);
    return this.sendMessage({
      ticks: symbol,
      subscribe: 1
    }).then(response => {
      if (response.error) {
        console.error(`[DIRECT_WS] Erro ao assinar ticks para ${symbol}:`, response.error);
        return false;
      }
      console.log(`[DIRECT_WS] Assinatura de ticks para ${symbol} bem-sucedida`);
      return true;
    });
  }
  
  /**
   * Obtém o histórico de ticks para um símbolo
   */
  public getTicksHistory(symbol: string, count: number = 500): Promise<any> {
    console.log(`[DIRECT_WS] Solicitando histórico de ${count} ticks para ${symbol}`);
    return this.sendMessage({
      ticks_history: symbol,
      count: count,
      end: 'latest',
      style: 'ticks'
    }).then(response => {
      if (response.error) {
        console.error(`[DIRECT_WS] Erro ao obter histórico de ticks para ${symbol}:`, response.error);
        throw new Error(response.error.message);
      }
      return response.history;
    });
  }
  
  /**
   * Adiciona um listener para eventos
   */
  public addListener(event: string, callback: (data: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)?.add(callback);
  }
  
  /**
   * Remove um listener para eventos
   */
  public removeListener(event: string, callback: (data: any) => void): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
    }
  }
  
  /**
   * Notifica todos os listeners de um evento
   */
  private notifyListeners(event: string, data: any): void {
    if (this.eventListeners.has(event)) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`[DIRECT_WS] Erro ao executar listener de ${event}:`, error);
          }
        });
      }
    }
  }
  
  /**
   * Envia uma mensagem para o servidor
   */
  private sendMessage(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      const messageWithId = { ...message, req_id: reqId };
      
      if (!this.isConnected) {
        console.log('[DIRECT_WS] Não conectado, enfileirando mensagem');
        this.messageQueue.push(messageWithId);
        this.callbacks.set(reqId, resolve);
        return;
      }
      
      this.callbacks.set(reqId, resolve);
      this.sendRawMessage(messageWithId);
      
      // Timeout para a resposta
      setTimeout(() => {
        if (this.callbacks.has(reqId)) {
          console.error(`[DIRECT_WS] Timeout na requisição ${reqId}`);
          this.callbacks.delete(reqId);
          reject(new Error('Timeout na requisição'));
        }
      }, 10000);
    });
  }
  
  /**
   * Envia uma mensagem bruta para o servidor
   */
  private sendRawMessage(message: any): void {
    if (this.socket && this.isConnected) {
      this.socket.send(JSON.stringify(message));
    } else {
      console.error('[DIRECT_WS] Tentativa de enviar mensagem com WebSocket desconectado');
      this.messageQueue.push(message);
    }
  }
  
  /**
   * Inicia o keepalive para manter a conexão ativa
   */
  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveInterval = window.setInterval(() => {
      this.sendRawMessage({ ping: 1 });
    }, 30000);
  }
  
  /**
   * Para o keepalive
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }
  
  /**
   * Desconecta do WebSocket
   */
  public disconnect(): void {
    this.stopKeepAlive();
    this.autoReconnect = false;
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
    console.log('[DIRECT_WS] Desconectado do WebSocket');
  }
}

// Exporta uma única instância do serviço para ser compartilhada
export const directWebSocketService = new DirectWebSocketService();