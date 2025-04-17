/**
 * websocketKeepAlive.ts
 * Gerencia uma conexão WebSocket dedicada para dados do índice R_100
 * Esta conexão é separada da API principal de autenticação
 */

// Configurações da API
const DERIV_WS_URL = 'wss://ws.binaryws.com/websockets/v3';
const DERIV_APP_ID = '71403';
const DEFAULT_TOKEN = 'jybcQm0FbKr7evp';

// Tipos para os dados de tick
export interface TickData {
  quote: number;
  epoch: number;
  pip_size: number;
  symbol: string;
  ask?: number;
  bid?: number;
  symbol_name?: string;
  display_name?: string;
}

// Evento personalizado para ticks
interface TickEvent extends CustomEvent {
  detail: {
    tick: TickData;
  };
}

class WebSocketManager {
  private socket: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private subscriptions: Set<string> = new Set();
  private lastMessageTime: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly PING_INTERVAL = 30000; // 30 segundos
  private readonly RECONNECT_DELAY = 2000; // 2 segundos iniciais

  constructor() {
    // Adicionar listeners para eventos de visibilidade da página
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('focus', this.handleFocus);
  }

  /**
   * Inicia a conexão WebSocket e assinatura para R_100
   */
  public startKeepAlive(): void {
    this.connect().then(() => {
      this.subscribeTicks('R_100');
    });
  }

  /**
   * Encerra a conexão WebSocket
   */
  public stopKeepAlive(): void {
    this.unsubscribeAll();
    this.disconnect();
  }

  /**
   * Conecta ao WebSocket
   * @returns Promise que resolve quando a conexão for estabelecida
   */
  private connect(): Promise<boolean> {
    if (this.isConnected()) {
      return Promise.resolve(true);
    }

    if (this.isConnecting) {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.isConnected()) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);
      });
    }

    return new Promise((resolve, reject) => {
      try {
        this.isConnecting = true;
        
        // Construir a URL com o token
        const token = DEFAULT_TOKEN;
        const url = `${DERIV_WS_URL}?app_id=${DERIV_APP_ID}&l=PT&token=${token}`;
        
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log('[WebSocketKeepAlive] Conexão estabelecida');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.lastMessageTime = Date.now();
          resolve(true);
        };
        
        this.socket.onclose = (event) => {
          console.warn(`[WebSocketKeepAlive] Conexão fechada: ${event.code} - ${event.reason}`);
          this.cleanupConnection();
          this.scheduleReconnect();
          resolve(false);
        };
        
        this.socket.onerror = (error) => {
          console.error('[WebSocketKeepAlive] Erro na conexão WebSocket:', error);
          this.cleanupConnection();
          reject(error);
        };
        
        this.socket.onmessage = (event) => {
          this.lastMessageTime = Date.now();
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.isConnecting = false;
        console.error('[WebSocketKeepAlive] Erro ao conectar:', error);
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
      
      // Processar resposta de ticks
      if (response.tick) {
        const tickEvent = new CustomEvent('deriv:tick', {
          detail: {
            tick: response.tick
          }
        });
        document.dispatchEvent(tickEvent);
      }
      
      // Se for um erro, logar
      if (response.error) {
        console.error('[WebSocketKeepAlive] Erro da API:', response.error);
      }
    } catch (error) {
      console.error('[WebSocketKeepAlive] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Desconecta o WebSocket
   */
  private disconnect(): void {
    this.cleanupConnection();
    if (this.socket && this.isConnected()) {
      this.socket.close();
      this.socket = null;
    }
  }

  /**
   * Limpa recursos da conexão
   */
  private cleanupConnection(): void {
    this.clearPingInterval();
    this.clearReconnectInterval();
    this.isConnecting = false;
  }

  /**
   * Inicia o intervalo de ping para manter a conexão ativa
   */
  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      this.sendPing();
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
   * Limpa o intervalo de reconexão
   */
  private clearReconnectInterval(): void {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Envia um ping para manter a conexão ativa
   */
  private sendPing(): void {
    if (this.isConnected()) {
      this.socket!.send(JSON.stringify({ ping: 1 }));
    }
  }

  /**
   * Agenda uma tentativa de reconexão
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.warn('[WebSocketKeepAlive] Número máximo de tentativas de reconexão atingido');
      return;
    }

    this.clearReconnectInterval();
    
    // Aumentar o atraso exponencialmente
    const delay = this.RECONNECT_DELAY * Math.pow(1.5, this.reconnectAttempts);
    
    this.reconnectInterval = setTimeout(() => {
      console.log('[WebSocketKeepAlive] Tentando reconectar...');
      this.reconnectAttempts++;
      
      this.connect().then((connected) => {
        if (connected) {
          console.log('[WebSocketKeepAlive] Reconectado com sucesso');
          
          // Reinscrever nas assinaturas anteriores
          this.resubscribe();
        }
      }).catch(() => {
        console.error('[WebSocketKeepAlive] Falha na tentativa de reconexão');
      });
    }, delay);
  }

  /**
   * Assina ticks para um símbolo específico
   * @param symbol Símbolo para o qual obter ticks (ex: "R_100")
   */
  public subscribeTicks(symbol: string): void {
    if (!symbol) return;
    
    // Verificar se já está inscrito
    if (this.subscriptions.has(symbol)) return;
    
    this.connect().then(() => {
      if (!this.isConnected()) return;
      
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      
      this.socket!.send(JSON.stringify(request));
      this.subscriptions.add(symbol);
      console.log(`[WebSocketKeepAlive] Inscrito em ticks para ${symbol}`);
    });
  }

  /**
   * Cancela a inscrição de ticks para um símbolo específico
   * @param symbol Símbolo para cancelar a inscrição
   */
  public unsubscribeTicks(symbol: string): void {
    if (!this.isConnected() || !this.subscriptions.has(symbol)) return;
    
    const request = {
      forget_all: ['ticks'],
      req_id: Date.now()
    };
    
    this.socket!.send(JSON.stringify(request));
    this.subscriptions.delete(symbol);
    console.log(`[WebSocketKeepAlive] Cancelada inscrição em ticks para ${symbol}`);
  }

  /**
   * Cancela todas as inscrições
   */
  public unsubscribeAll(): void {
    if (!this.isConnected()) return;
    
    const request = {
      forget_all: ['ticks'],
      req_id: Date.now()
    };
    
    this.socket!.send(JSON.stringify(request));
    this.subscriptions.clear();
    console.log('[WebSocketKeepAlive] Todas as inscrições canceladas');
  }

  /**
   * Reinscreve em todas as assinaturas anteriores
   */
  private resubscribe(): void {
    const symbols = Array.from(this.subscriptions);
    this.subscriptions.clear();
    
    symbols.forEach(symbol => {
      this.subscribeTicks(symbol);
    });
  }

  /**
   * Verifica se o WebSocket está conectado
   */
  private isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }

  /**
   * Tratamento de evento quando a página fica visível
   */
  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      console.log('[WebSocketKeepAlive] Page became visible, attempting reconnection...');
      if (!this.isConnected()) {
        this.connect().then(connected => {
          if (connected) {
            this.resubscribe();
          }
        });
      }
    }
  };

  /**
   * Tratamento de evento quando a rede está online
   */
  private handleOnline = (): void => {
    console.log('[WebSocketKeepAlive] Network online, attempting reconnection...');
    if (!this.isConnected()) {
      this.connect().then(connected => {
        if (connected) {
          this.resubscribe();
        }
      });
    }
  };

  /**
   * Tratamento de evento quando a janela ganha foco
   */
  private handleFocus = (): void => {
    // Verificar se a conexão está inativa por muito tempo
    const now = Date.now();
    if (this.lastMessageTime && (now - this.lastMessageTime > 2 * this.PING_INTERVAL)) {
      console.log('[WebSocketKeepAlive] Connection may be stale, checking...');
      this.sendPing();
      
      // Se não receber resposta em 5 segundos, forçar reconexão
      setTimeout(() => {
        if (now === this.lastMessageTime) {
          console.log('[WebSocketKeepAlive] Connection is stale, forcing reconnect...');
          this.disconnect();
          this.connect().then(connected => {
            if (connected) {
              this.resubscribe();
            }
          });
        }
      }, 5000);
    }
  };
}

// Exportar uma instância única para uso global
const websocketManager = new WebSocketManager();

// Função para iniciar o keepalive
export const startKeepAlive = (): void => {
  websocketManager.startKeepAlive();
};

// Função para parar o keepalive
export const stopKeepAlive = (): void => {
  websocketManager.stopKeepAlive();
};

// Função para assinar ticks de um símbolo específico
export const subscribeTicks = (symbol: string): void => {
  websocketManager.subscribeTicks(symbol);
};

// Função para cancelar assinatura de ticks de um símbolo específico
export const unsubscribeTicks = (symbol: string): void => {
  websocketManager.unsubscribeTicks(symbol);
};

// Função para cancelar todas as assinaturas
export const unsubscribeAll = (): void => {
  websocketManager.unsubscribeAll();
};

// Exportar o gerenciador para uso avançado (se necessário)
export default websocketManager;