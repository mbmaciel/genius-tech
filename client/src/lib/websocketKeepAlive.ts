/**
 * Módulo de manutenção da conexão WebSocket com a API Deriv
 * Implementa o mecanismo de keep-alive usando ping/pong para evitar
 * a desconexão após o período de inatividade de 2 minutos
 */

export class WebSocketKeepAlive {
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private socket: WebSocket | null = null;
  private checkStatusInterval: NodeJS.Timeout | null = null;
  private lastPongTime: number = 0;
  private isActive: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private pingIntervalTime: number = 30000; // 30 segundos
  private statusCheckInterval: number = 40000; // 40 segundos
  private connectionTimeoutLimit: number = 70000; // 70 segundos (pouco mais que 2x o ping)
  private reconnectDelay: number = 2000; // 2 segundos
  private onConnectionLost: (() => void) | null = null;
  private onConnectionRestored: (() => void) | null = null;

  /**
   * Inicia o mecanismo de keep-alive para um WebSocket
   * @param socket WebSocket a ser mantido ativo
   * @param onConnectionLost Callback para quando a conexão for perdida
   * @param onConnectionRestored Callback para quando a conexão for restaurada
   */
  public start(
    socket: WebSocket,
    onConnectionLost?: () => void,
    onConnectionRestored?: () => void
  ): void {
    if (this.isActive) {
      console.log("[KEEPALIVE] Sistema já está ativo, reiniciando...");
      this.stop();
    }

    console.log("[KEEPALIVE] Iniciando sistema de manutenção de conexão WebSocket");
    this.socket = socket;
    this.isActive = true;
    this.lastPongTime = Date.now();
    this.reconnectAttempts = 0;
    this.onConnectionLost = onConnectionLost || null;
    this.onConnectionRestored = onConnectionRestored || null;

    // Configurar handler de mensagens para detectar pongs
    this.setupMessageHandler();

    // Iniciar envio periódico de pings
    this.startPinging();

    // Iniciar verificação de status
    this.startStatusCheck();
  }

  /**
   * Para o mecanismo de keep-alive
   */
  public stop(): void {
    console.log("[KEEPALIVE] Parando sistema de manutenção de conexão");
    this.isActive = false;
    this.clearAllIntervals();
    this.socket = null;
  }

  /**
   * Configura o handler de mensagens para detectar respostas de ping
   */
  private setupMessageHandler(): void {
    if (!this.socket) return;

    const pongHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Verificar se é uma resposta de ping
        if (data.msg_type === "ping" && data.ping === "pong") {
          console.log("[KEEPALIVE] Pong recebido da API");
          this.lastPongTime = Date.now();
          this.reconnectAttempts = 0; // Resetar contador de tentativas
        }
      } catch (error) {
        console.error("[KEEPALIVE] Erro ao processar mensagem:", error);
      }
    };

    // Remover handler existente e adicionar novo
    this.socket.addEventListener("message", pongHandler);

    // Armazenar referência para remover depois
    (this.socket as any)._pongHandler = pongHandler;
  }

  /**
   * Inicia o envio periódico de pings
   */
  private startPinging(): void {
    this.clearInterval(this.pingInterval);
    
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, this.pingIntervalTime);
  }

  /**
   * Envia um ping para o servidor
   */
  private pingCounter: number = 1;
  
  private sendPing(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn("[KEEPALIVE] Não foi possível enviar ping, WebSocket não está aberto");
      return;
    }

    try {
      // Usar contador para reduzir frequência de logs
      if (this.pingCounter % 5 === 0) {
        console.log("[KEEPALIVE] Sistema de keep-alive ativo");
      }
      
      // Enviar ping com req_id para identificação conforme esquema JSON
      const pingMessage = JSON.stringify({
        ping: 1,
        req_id: Date.now() + this.pingCounter++
      });
      
      this.socket.send(pingMessage);
    } catch (error) {
      console.error("[KEEPALIVE] Erro ao enviar ping:", error);
    }
  }

  /**
   * Inicia a verificação periódica de status da conexão
   */
  private startStatusCheck(): void {
    this.clearInterval(this.checkStatusInterval);
    
    this.checkStatusInterval = setInterval(() => {
      this.checkConnectionStatus();
    }, this.statusCheckInterval);
  }

  /**
   * Verifica o status da conexão
   */
  private checkConnectionStatus(): void {
    if (!this.isActive) return;

    const now = Date.now();
    const timeSinceLastPong = now - this.lastPongTime;

    if (timeSinceLastPong > this.connectionTimeoutLimit) {
      console.warn(`[KEEPALIVE] Nenhum pong recebido nos últimos ${timeSinceLastPong / 1000}s. Conexão pode estar inativa.`);
      
      // Verificar se o socket ainda está aberto
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        console.log("[KEEPALIVE] Socket ainda está aberto, enviando ping de verificação");
        this.sendPing();
      } else {
        console.error("[KEEPALIVE] WebSocket não está aberto, iniciando processo de reconexão");
        this.handleConnectionLoss();
      }
    }
  }

  /**
   * Processa a perda de conexão
   */
  private handleConnectionLoss(): void {
    if (this.onConnectionLost) {
      console.log("[KEEPALIVE] Notificando aplicação sobre perda de conexão");
      this.onConnectionLost();
    }

    // Parar o envio de pings
    this.clearInterval(this.pingInterval);
    
    // Iniciar processo de reconexão se ainda não estiver em andamento
    if (!this.reconnectInterval) {
      this.scheduleReconnect();
    }
  }

  /**
   * Agenda uma tentativa de reconexão
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("[KEEPALIVE] Número máximo de tentativas de reconexão atingido");
      this.stop();
      return;
    }

    this.clearInterval(this.reconnectInterval);
    
    this.reconnectInterval = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`[KEEPALIVE] Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      if (this.onConnectionRestored) {
        this.onConnectionRestored();
      }
      
      // Se a reconexão foi bem-sucedida, voltar ao modo normal
      this.clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
      
      // Se ainda estiver ativo, reiniciar o ping
      if (this.isActive) {
        this.startPinging();
      }
    }, this.reconnectDelay);
  }

  /**
   * Utilitário para limpar um intervalo específico
   */
  private clearInterval(interval: NodeJS.Timeout | null): void {
    if (interval) {
      clearInterval(interval);
    }
  }

  /**
   * Limpa todos os intervalos
   */
  private clearAllIntervals(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.checkStatusInterval) {
      clearInterval(this.checkStatusInterval);
      this.checkStatusInterval = null;
    }
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }
}

// Exportar instância singleton para uso global
export const keepAliveService = new WebSocketKeepAlive();
export default keepAliveService;

// Função para iniciar o serviço de keep-alive (exportação simples para importação)
export function startKeepAlive(
  socket: WebSocket,
  onConnectionLost?: () => void,
  onConnectionRestored?: () => void
): void {
  keepAliveService.start(socket, onConnectionLost, onConnectionRestored);
}

// Função para parar o serviço de keep-alive
export function stopKeepAlive(): void {
  keepAliveService.stop();
}