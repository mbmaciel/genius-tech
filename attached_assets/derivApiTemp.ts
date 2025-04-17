/**
 * DerivAPI - Versão mínima para teste
 */

export class DerivAPI {
  private static instance: DerivAPI;
  private socket: WebSocket | null = null;
  private reconnecting: boolean = false;
  private baseUrl: string = 'wss://ws.derivws.com/websockets/v3';
  private appId: number = 71403;
  
  private constructor() {}
  
  public static getInstance(): DerivAPI {
    if (!DerivAPI.instance) {
      DerivAPI.instance = new DerivAPI();
    }
    return DerivAPI.instance;
  }
  
  public get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Conexão básica
   */
  public async connect(): Promise<any> {
    const connectionUrl = `${this.baseUrl}?app_id=${this.appId}`;
    
    try {
      this.socket = new WebSocket(connectionUrl);
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tempo limite excedido'));
        }, 10000);
        
        this.socket!.onopen = (event) => {
          clearTimeout(timeout);
          console.log('[WebSocket] Conexão estabelecida');
          resolve({ connected: true });
        };
        
        this.socket!.onerror = (error) => {
          clearTimeout(timeout);
          console.error('[WebSocket] Erro:', error);
          reject(new Error('Falha ao conectar'));
        };
      });
    } catch (error) {
      console.error('[DerivAPI] Erro:', error);
      throw error;
    }
  }
  
  /**
   * Desconexão básica
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

export const derivAPI = DerivAPI.getInstance();
export default derivAPI;
