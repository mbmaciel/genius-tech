/**
 * WebSocketManager - Gerenciador de conexões WebSocket para a API Deriv
 * 
 * Esta classe implementa as recomendações da documentação oficial da Deriv
 * para gerenciamento de conexões WebSocket, incluindo reconexão automática,
 * ping periódico e tratamento adequado de eventos.
 */

import { derivAPI } from './derivApi';

// Estados possíveis de WebSocket
enum WebSocketState {
  CONNECTING = 0,  // WebSocket.CONNECTING
  OPEN = 1,        // WebSocket.OPEN
  CLOSING = 2,     // WebSocket.CLOSING
  CLOSED = 3       // WebSocket.CLOSED
}

// Configurações padrão
const DEFAULT_CONFIG = {
  pingIntervalMs: 30000,          // 30 segundos entre pings (sessão expira em 2 min)
  reconnectDelayBaseMs: 1000,     // Delay base para reconexão
  reconnectDelayMaxMs: 60000,     // Delay máximo para reconexão (1 minuto)
  reconnectMaxAttempts: 10,       // Número máximo de tentativas
  sessionTimeoutMs: 120000,       // 2 minutos (timeout da sessão da Deriv)
  autoReconnect: true,            // Reconexão automática por padrão
  debug: false                    // Modo debug desligado por padrão
};

class WebSocketManager {
  private static instance: WebSocketManager;
  private config: typeof DEFAULT_CONFIG;
  private pingInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts: number = 0;
  private reconnecting: boolean = false;
  private lastMessageTime: number = 0;
  private preventAutoReconnect: boolean = false;
  private pingPromise: Promise<any> | null = null;
  
  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.lastMessageTime = Date.now();
    
    // Verificar se há uma flag para prevenir reconexão automática
    const preventReconnectTimestamp = localStorage.getItem('prevent_auto_reconnect');
    if (preventReconnectTimestamp) {
      const timestamp = parseInt(preventReconnectTimestamp);
      const currentTime = Date.now();
      // Verificar se a flag foi definida nos últimos 5 minutos
      if (currentTime - timestamp < 5 * 60 * 1000) {
        this.preventAutoReconnect = true;
        this.log('Reconexão automática desativada por flag recente');
      } else {
        // Limpar flag antiga
        localStorage.removeItem('prevent_auto_reconnect');
      }
    }
  }
  
  /**
   * Obtém a instância singleton do WebSocketManager
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }
  
  /**
   * Configura o gerenciador
   * @param config Configurações a serem aplicadas
   */
  public configure(config: Partial<typeof DEFAULT_CONFIG>): void {
    this.config = { ...this.config, ...config };
    this.log('WebSocketManager configurado:', this.config);
  }
  
  /**
   * Define se o modo de debug está ativado
   * @param enabled true para ativar logs de debug
   */
  public setDebugMode(enabled: boolean): void {
    this.config.debug = enabled;
    this.log('Modo debug ' + (enabled ? 'ativado' : 'desativado'));
  }
  
  /**
   * Logs apenas em modo debug
   * @param message Mensagem principal
   * @param params Parâmetros adicionais
   */
  private log(message: string, ...params: any[]): void {
    if (this.config.debug) {
      console.log(`[WebSocketManager] ${message}`, ...params);
    }
  }
  
  /**
   * Inicia o monitoramento da conexão WebSocket
   */
  public startMonitoring(): void {
    this.log('Iniciando monitoramento de conexão WebSocket');
    this.stopMonitoring(); // Garantir que não há intervalos duplicados
    
    // Iniciar ping periódico se a reconexão automática estiver ativada
    if (this.config.autoReconnect && !this.preventAutoReconnect) {
      this.startPingInterval();
    }
    
    // Registrar timestamp da última mensagem
    this.updateLastMessageTime();
    
    // Inicia um intervalo de verificação para o caso do ping falhar
    this.startHealthCheck();
  }
  
  /**
   * Interrompe o monitoramento e cancela qualquer tentativa de reconexão
   */
  public stopMonitoring(): void {
    this.log('Parando monitoramento de conexão WebSocket');
    
    // Limpar intervalo de ping
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Cancelar qualquer tentativa de reconexão pendente
    if (this.reconnectTimeout) {
      window.clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
    this.reconnecting = false;
  }
  
  /**
   * Atualiza o timestamp da última mensagem recebida/enviada
   */
  public updateLastMessageTime(): void {
    this.lastMessageTime = Date.now();
  }
  
  /**
   * Inicia o intervalo para envio de pings periódicos
   */
  private startPingInterval(): void {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval);
    }
    
    this.log(`Configurando ping a cada ${this.config.pingIntervalMs}ms`);
    
    // Criar intervalo para ping periódico
    this.pingInterval = window.setInterval(() => {
      this.sendPing();
    }, this.config.pingIntervalMs);
    
    // Enviar ping imediato para confirmar conexão
    this.sendPing();
  }
  
  /**
   * Inicia verificação periódica do estado da conexão
   */
  private startHealthCheck(): void {
    // Verificar a cada 10 segundos se estamos próximos do timeout
    const healthCheckInterval = window.setInterval(() => {
      // Se não houver reconexão em andamento e não estiver desconectado intencionalmente
      if (!this.reconnecting && !this.preventAutoReconnect) {
        const currentTime = Date.now();
        const timeSinceLastMessage = currentTime - this.lastMessageTime;
        
        // Se estiver próximo do timeout (80% do tempo limite), enviar ping
        if (timeSinceLastMessage > 0.8 * this.config.sessionTimeoutMs) {
          this.log('Conexão próxima do timeout, enviando ping de emergência');
          this.sendPing();
        }
        
        // Se ultrapassar o tempo limite, iniciar reconexão
        if (timeSinceLastMessage > this.config.sessionTimeoutMs) {
          this.log('Timeout de sessão detectado, tentando reconectar');
          this.attemptReconnect();
        }
      }
    }, 10000); // Verificar a cada 10 segundos
  }
  
  /**
   * Envia um ping para manter a conexão ativa
   */
  private async sendPing(): Promise<void> {
    if (!derivAPI.getConnectionStatus()) {
      this.log('Não é possível enviar ping: desconectado');
      return;
    }
    
    try {
      // Evitar pings simultâneos
      if (this.pingPromise) {
        this.log('Já existe um ping em andamento, aguardando...');
        await this.pingPromise;
        return;
      }
      
      this.log('Enviando ping para manter conexão ativa');
      this.pingPromise = derivAPI.ping();
      
      const response = await this.pingPromise;
      this.updateLastMessageTime();
      
      this.log('Ping bem-sucedido, resposta:', response);
    } catch (error) {
      this.log('Falha ao enviar ping:', error);
      
      // Se o ping falhar, tentar reconectar
      if (this.config.autoReconnect && !this.preventAutoReconnect) {
        this.attemptReconnect();
      }
    } finally {
      this.pingPromise = null;
    }
  }
  
  /**
   * Tenta reconectar ao servidor WebSocket
   */
  private attemptReconnect(): void {
    // Evitar reconexões simultâneas
    if (this.reconnecting) {
      this.log('Já existe uma tentativa de reconexão em andamento');
      return;
    }
    
    // Verificar se já ultrapassamos o número máximo de tentativas
    if (this.reconnectAttempts >= this.config.reconnectMaxAttempts) {
      this.log(`Número máximo de tentativas de reconexão (${this.config.reconnectMaxAttempts}) atingido`);
      
      // Notificar falha
      document.dispatchEvent(new CustomEvent('deriv:reconnect_failed', {
        detail: {
          attempts: this.reconnectAttempts,
          maxAttempts: this.config.reconnectMaxAttempts
        }
      }));
      
      // Parar tentativas de reconexão
      this.stopMonitoring();
      return;
    }
    
    // Marcar como reconectando
    this.reconnecting = true;
    
    // Calcular delay exponencial com jitter (para evitar reconexões simultâneas de múltiplos clientes)
    const backoffFactor = Math.min(Math.pow(2, this.reconnectAttempts), this.config.reconnectDelayMaxMs / this.config.reconnectDelayBaseMs);
    const jitter = Math.random() * 0.5 + 0.75; // Entre 0.75 e 1.25
    const delay = Math.min(this.config.reconnectDelayBaseMs * backoffFactor * jitter, this.config.reconnectDelayMaxMs);
    
    this.log(`Tentativa de reconexão ${this.reconnectAttempts + 1}/${this.config.reconnectMaxAttempts} em ${Math.round(delay)}ms`);
    
    // Notificar início da reconexão
    document.dispatchEvent(new CustomEvent('deriv:reconnecting', {
      detail: {
        attempt: this.reconnectAttempts + 1,
        delay: delay,
        maxAttempts: this.config.reconnectMaxAttempts
      }
    }));
    
    // Configurar timeout para reconexão
    this.reconnectTimeout = window.setTimeout(async () => {
      try {
        this.log(`Executando reconexão (tentativa ${this.reconnectAttempts + 1})`);
        
        // Tentar reconectar
        await derivAPI.connect();
        
        // Se chegou aqui, reconexão foi bem sucedida
        this.log('Reconexão bem-sucedida');
        
        // Resetar contadores
        this.reconnectAttempts = 0;
        this.reconnecting = false;
        
        // Atualizar timestamp de última mensagem
        this.updateLastMessageTime();
        
        // Se o ping não estiver ativo, reiniciar
        if (!this.pingInterval) {
          this.startPingInterval();
        }
        
        // Notificar reconexão bem-sucedida
        document.dispatchEvent(new CustomEvent('deriv:reconnected'));
      } catch (error) {
        this.log('Falha na tentativa de reconexão:', error);
        
        // Incrementar contador de tentativas
        this.reconnectAttempts++;
        this.reconnecting = false;
        
        // Tentar novamente
        this.attemptReconnect();
      }
    }, delay);
  }
  
  /**
   * Verifica se o WebSocket está em estado aberto
   */
  public isWebSocketOpen(): boolean {
    return derivAPI.isWebSocketOpen();
  }
}

// Exportar instância singleton
export const websocketManager = WebSocketManager.getInstance();
export default websocketManager;