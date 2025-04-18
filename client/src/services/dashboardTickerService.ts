/**
 * SERVIÇO EXCLUSIVO PARA DASHBOARD
 * 
 * Este serviço mantém uma conexão WebSocket dedicada apenas para
 * a exibição de ticks do R_100 no dashboard, completamente separada
 * da conexão usada pelo robô de operações.
 * 
 * IMPORTANTE: Este serviço NÃO deve ser importado ou usado em NENHUM
 * componente relacionado ao robô de operações.
 */

// Tipo para callbacks que serão chamados quando chegarem novos ticks
type TickCallback = (tick: any) => void;

class DashboardTickerService {
  private webSocket: WebSocket | null = null;
  private callbacks: TickCallback[] = [];
  private reconnectAttempts: number = 0;
  private reconnectInterval: any = null;
  private pingInterval: any = null;
  private isConnected: boolean = false;
  
  /**
   * Inicia conexão dedicada para o dashboard
   */
  public start(): void {
    console.log('[DASHBOARD_TICKER] Iniciando serviço de ticks dedicado para dashboard');
    this.setupWebSocket();
  }
  
  /**
   * Para a conexão e limpa recursos
   */
  public stop(): void {
    console.log('[DASHBOARD_TICKER] Parando serviço de ticks do dashboard');
    this.cleanup();
  }
  
  /**
   * Limpa todos os recursos e fecha conexões
   */
  private cleanup(): void {
    // Limpar intervalos
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Fechar WebSocket se estiver aberto
    if (this.webSocket) {
      try {
        if (this.webSocket.readyState === WebSocket.OPEN) {
          // Cancelar assinaturas antes de fechar
          this.webSocket.send(JSON.stringify({ forget_all: 'ticks' }));
        }
        
        this.webSocket.onopen = null;
        this.webSocket.onmessage = null;
        this.webSocket.onerror = null;
        this.webSocket.onclose = null;
        
        if (this.webSocket.readyState !== WebSocket.CLOSED) {
          this.webSocket.close();
        }
      } catch (e) {
        console.error('[DASHBOARD_TICKER] Erro ao limpar WebSocket:', e);
      }
      
      this.webSocket = null;
    }
    
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }
  
  /**
   * Configura a conexão WebSocket exclusiva para o dashboard
   */
  private setupWebSocket(): void {
    try {
      console.log('[DASHBOARD_TICKER] Criando nova conexão WebSocket para dashboard');
      
      // Token para app pública - apenas para visualização, não para trading
      // Completamente isolado da conexão OAuth do robô
      const appId = '1089'; 
      
      // Criar nova conexão exclusiva para o dashboard
      const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${appId}`;
      this.webSocket = new WebSocket(wsUrl);
      
      // Configurar handlers
      this.webSocket.onopen = this.handleOpen.bind(this);
      this.webSocket.onmessage = this.handleMessage.bind(this);
      this.webSocket.onerror = this.handleError.bind(this);
      this.webSocket.onclose = this.handleClose.bind(this);
      
      console.log('[DASHBOARD_TICKER] WebSocket para dashboard configurado');
    } catch (error) {
      console.error('[DASHBOARD_TICKER] Erro ao configurar WebSocket do dashboard:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Manipula evento de abertura da conexão
   */
  private handleOpen(): void {
    console.log('[DASHBOARD_TICKER] Conexão WebSocket do dashboard estabelecida');
    
    // Reiniciar contadores
    this.reconnectAttempts = 0;
    this.isConnected = true;
    
    // Limpar qualquer reconexão agendada
    if (this.reconnectInterval) {
      clearTimeout(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Configurar keep-alive
    this.setupKeepAlive();
    
    // Subscrever para ticks do R_100 (exclusivo para dashboard)
    this.subscribeToR100();
  }
  
  /**
   * Subscreve para ticks do R_100
   */
  private subscribeToR100(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[DASHBOARD_TICKER] WebSocket não está aberto para inscrição do R_100');
      return;
    }
    
    const request = {
      ticks: 'R_100',
      subscribe: 1
    };
    
    console.log('[DASHBOARD_TICKER] Subscrevendo para ticks do R_100 (exclusivo para dashboard)');
    this.webSocket.send(JSON.stringify(request));
  }
  
  /**
   * Manipula mensagens recebidas no WebSocket
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Processar apenas respostas de ticks
      if (data.msg_type === 'tick') {
        const tick = data.tick;
        
        // Dispachar evento personalizado para o dashboard
        // Completamente separado dos eventos usados pelo robô
        if (tick && tick.symbol === 'R_100') {
          const customEvent = new CustomEvent('deriv:tick', {
            detail: { tick }
          });
          
          // Disparar evento para componentes do dashboard
          document.dispatchEvent(customEvent);
        }
      }
    } catch (error) {
      console.error('[DASHBOARD_TICKER] Erro ao processar mensagem do dashboard:', error);
    }
  }
  
  /**
   * Manipula erros do WebSocket
   */
  private handleError(event: Event): void {
    console.error('[DASHBOARD_TICKER] Erro no WebSocket do dashboard:', event);
    this.isConnected = false;
  }
  
  /**
   * Manipula fechamento da conexão
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[DASHBOARD_TICKER] Conexão WebSocket do dashboard fechada: ${event.code} ${event.reason}`);
    this.isConnected = false;
    this.scheduleReconnect();
  }
  
  /**
   * Agenda reconexão em caso de falha
   */
  private scheduleReconnect(): void {
    // Evitar múltiplas tentativas simultâneas
    if (this.reconnectInterval) {
      return;
    }
    
    // Aumentar tempo entre tentativas
    const delay = Math.min(30000, 1000 * Math.pow(1.5, this.reconnectAttempts));
    this.reconnectAttempts++;
    
    console.log(`[DASHBOARD_TICKER] Agendando reconexão do dashboard em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    this.reconnectInterval = setTimeout(() => {
      console.log('[DASHBOARD_TICKER] Tentando reconectar WebSocket do dashboard...');
      this.cleanup(); // Limpar recursos antes de tentar novamente
      this.setupWebSocket();
    }, delay);
  }
  
  /**
   * Configura envio periódico de ping para manter conexão
   */
  private setupKeepAlive(): void {
    // Limpar intervalo anterior se existir
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Enviar ping a cada 30 segundos
    this.pingInterval = setInterval(() => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ ping: 1 }));
        console.log('[DASHBOARD_TICKER] Ping enviado para manter conexão do dashboard');
      }
    }, 30000);
  }
}

// Exportar instância única e isolada para uso exclusivo no dashboard
export const dashboardTicker = new DashboardTickerService();