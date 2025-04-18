/**
 * Serviço simplificado para obtenção de ticks
 * Versão minimalista que foca apenas em receber e transmitir ticks para componentes de visualização
 */

type TickCallback = (tick: { price: number, lastDigit: number }) => void;

class SimpleTickerService {
  private webSocket: WebSocket | null = null;
  private callbacks: TickCallback[] = [];
  private reconnectAttempts: number = 0;
  private reconnectInterval: any = null;
  private pingInterval: any = null;
  
  /**
   * Inicia conexão simplificada para obter ticks
   */
  public start(): void {
    console.log('[SIMPLE_TICKER] Iniciando serviço simplificado de ticks');
    this.setupWebSocket();
  }
  
  /**
   * Configura a conexão WebSocket básica
   */
  private setupWebSocket(): void {
    try {
      console.log('[SIMPLE_TICKER] Criando nova conexão WebSocket');
      
      // Sempre usar wss para produção e ws para desenvolvimento local
      const wsUrl = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';
      
      // Criar nova conexão
      this.webSocket = new WebSocket(wsUrl);
      
      // Configurar handlers
      this.webSocket.onopen = this.handleOpen.bind(this);
      this.webSocket.onmessage = this.handleMessage.bind(this);
      this.webSocket.onerror = this.handleError.bind(this);
      this.webSocket.onclose = this.handleClose.bind(this);
      
      console.log('[SIMPLE_TICKER] WebSocket configurado');
    } catch (error) {
      console.error('[SIMPLE_TICKER] Erro ao configurar WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Manipula evento de abertura da conexão
   */
  private handleOpen(): void {
    console.log('[SIMPLE_TICKER] Conexão WebSocket estabelecida');
    
    // Reiniciar contagem de tentativas
    this.reconnectAttempts = 0;
    
    // Cancelar qualquer reconexão agendada
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Configurar ping para manter conexão viva
    this.setupKeepAlive();
    
    // Subscrever para ticks do R_100
    this.subscribeToTicks('R_100');
  }
  
  /**
   * Manipula mensagens recebidas
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Processar apenas mensagens de tick
      if (data.msg_type === 'tick') {
        const price = parseFloat(data.tick.quote);
        const lastDigit = parseInt(price.toString().slice(-1));
        
        console.log(`[SIMPLE_TICKER] Tick recebido: ${price}, último dígito: ${lastDigit}`);
        
        // Notificar callbacks
        if (!isNaN(lastDigit)) {
          this.notifyCallbacks({ price, lastDigit });
        }
      }
    } catch (error) {
      console.error('[SIMPLE_TICKER] Erro ao processar mensagem:', error);
    }
  }
  
  /**
   * Manipula erros de conexão
   */
  private handleError(event: Event): void {
    console.error('[SIMPLE_TICKER] Erro na conexão WebSocket:', event);
    this.scheduleReconnect();
  }
  
  /**
   * Manipula fechamento da conexão
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[SIMPLE_TICKER] Conexão WebSocket fechada: Código ${event.code}, Motivo: ${event.reason}`);
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
    
    console.log(`[SIMPLE_TICKER] Agendando reconexão em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    this.reconnectInterval = setTimeout(() => {
      console.log('[SIMPLE_TICKER] Tentando reconectar...');
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
        console.log('[SIMPLE_TICKER] Ping enviado para manter conexão');
      }
    }, 30000);
  }
  
  /**
   * Subscreve para ticks de um símbolo específico
   */
  private subscribeToTicks(symbol: string): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[SIMPLE_TICKER] WebSocket não está aberto para inscrição de ticks');
      return;
    }
    
    const request = {
      ticks: symbol,
      subscribe: 1
    };
    
    this.webSocket.send(JSON.stringify(request));
    console.log(`[SIMPLE_TICKER] Inscrito para receber ticks de ${symbol}`);
  }
  
  /**
   * Registra callback para receber ticks
   */
  public onTick(callback: TickCallback): void {
    this.callbacks.push(callback);
    console.log(`[SIMPLE_TICKER] Novo callback registrado (total: ${this.callbacks.length})`);
  }
  
  /**
   * Remove callback
   */
  public offTick(callback: TickCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
      console.log(`[SIMPLE_TICKER] Callback removido (restantes: ${this.callbacks.length})`);
    }
  }
  
  /**
   * Notifica todos os callbacks registrados
   */
  private notifyCallbacks(tick: { price: number, lastDigit: number }): void {
    this.callbacks.forEach(callback => {
      try {
        callback(tick);
      } catch (error) {
        console.error('[SIMPLE_TICKER] Erro ao notificar callback:', error);
      }
    });
  }
  
  /**
   * Para o serviço e fecha conexões
   */
  public stop(): void {
    console.log('[SIMPLE_TICKER] Parando serviço de ticks');
    
    // Limpar intervalos
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    // Fechar conexão
    if (this.webSocket) {
      this.webSocket.onclose = null; // Evitar tentativa de reconexão ao fechar manualmente
      this.webSocket.close();
      this.webSocket = null;
    }
    
    // Limpar callbacks
    this.callbacks = [];
  }
}

// Exportar instância única
export const simpleTicker = new SimpleTickerService();