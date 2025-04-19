/**
 * MÓDULO EXCLUSIVO PARA O DASHBOARD
 * 
 * Esta conexão WebSocket é COMPLETAMENTE ISOLADA de qualquer outra conexão
 * usada no sistema, especialmente do robô de operações.
 * 
 * NÃO UTILIZE esta conexão em nenhum outro lugar além do dashboard!
 */

// Evento de tick para componentes do dashboard
export interface DashboardTickEvent {
  symbol: string;
  quote: number;
  epoch: number;
  pipSize: number;
  lastDigit?: number; // Adicionando o dígito calculado
}

// Callbacks para eventos
type TickCallback = (event: DashboardTickEvent) => void;

class DashboardWebSocket {
  // Token dedicado apenas para o dashboard - NÃO usar no robô de operações!
  private readonly TOKEN = 'jybcQm0FbKr7evp';
  
  private webSocket: WebSocket | null = null;
  private tickCallbacks: TickCallback[] = [];
  private reconnectTimeout: any = null;
  private pingInterval: any = null;
  private reconnectAttempts: number = 0;
  private isConnected: boolean = false;
  private symbolSubscriptions: Set<string> = new Set();
  private readonly MAX_RECONNECT_DELAY = 30000; // 30 segundos
  
  /**
   * Inicia a conexão dedicada para o dashboard
   */
  public connect(): void {
    // Limpar qualquer conexão ou timeout existente
    this.cleanup();
    
    try {
      console.log('[DASHBOARD_WS] Iniciando conexão WebSocket dedicada para dashboard...');
      
      // URL com token dedicado apenas para o dashboard
      const wsUrl = `wss://ws.binaryws.com/websockets/v3?app_id=1089&token=${this.TOKEN}`;
      
      // Criar conexão
      this.webSocket = new WebSocket(wsUrl);
      
      // Configurar handlers
      this.webSocket.onopen = this.handleOpen.bind(this);
      this.webSocket.onmessage = this.handleMessage.bind(this);
      this.webSocket.onerror = this.handleError.bind(this);
      this.webSocket.onclose = this.handleClose.bind(this);
      
    } catch (error) {
      console.error('[DASHBOARD_WS] Erro ao iniciar conexão WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Encerra a conexão e limpa recursos
   */
  public disconnect(): void {
    console.log('[DASHBOARD_WS] Desconectando WebSocket do dashboard...');
    this.cleanup();
  }
  
  /**
   * Subscreve para ticks de um símbolo específico
   * @param symbol Nome do símbolo (ex: 'R_100')
   */
  public subscribeTicks(symbol: string): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.log(`[DASHBOARD_WS] WebSocket não está aberto, agendando subscrição para ${symbol}...`);
      this.symbolSubscriptions.add(symbol);
      return;
    }
    
    console.log(`[DASHBOARD_WS] Subscrevendo para ticks de ${symbol}...`);
    
    const request = {
      ticks: symbol,
      subscribe: 1
    };
    
    this.webSocket.send(JSON.stringify(request));
    this.symbolSubscriptions.add(symbol);
  }
  
  /**
   * Cancela subscrição para ticks de um símbolo específico
   * @param symbol Nome do símbolo (ex: 'R_100')
   */
  public unsubscribeTicks(symbol: string): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.log(`[DASHBOARD_WS] WebSocket não está aberto, removendo subscrição para ${symbol}...`);
      this.symbolSubscriptions.delete(symbol);
      return;
    }
    
    console.log(`[DASHBOARD_WS] Cancelando subscrição para ticks de ${symbol}...`);
    
    const request = {
      forget_all: "ticks",
      underlying: symbol
    };
    
    this.webSocket.send(JSON.stringify(request));
    this.symbolSubscriptions.delete(symbol);
  }
  
  /**
   * Adiciona um callback para receber eventos de tick
   * @param callback Função a ser chamada quando receber um tick
   */
  public onTick(callback: TickCallback): void {
    this.tickCallbacks.push(callback);
  }
  
  /**
   * Remove um callback de eventos de tick
   * @param callback Função a ser removida
   */
  public offTick(callback: TickCallback): void {
    this.tickCallbacks = this.tickCallbacks.filter(cb => cb !== callback);
  }
  
  /**
   * Limpa todos os recursos associados à conexão
   */
  private cleanup(): void {
    // Limpar timers
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Fechar WebSocket se estiver aberto
    if (this.webSocket) {
      try {
        // Remover todos os handlers para evitar chamadas após limpeza
        this.webSocket.onopen = null;
        this.webSocket.onmessage = null;
        this.webSocket.onerror = null;
        this.webSocket.onclose = null;
        
        if (this.webSocket.readyState === WebSocket.OPEN) {
          // Cancelar todas as subscrições antes de fechar
          this.webSocket.send(JSON.stringify({ forget_all: "ticks" }));
          this.webSocket.close();
        }
      } catch (e) {
        console.error('[DASHBOARD_WS] Erro ao limpar WebSocket:', e);
      }
      
      this.webSocket = null;
    }
    
    this.isConnected = false;
  }
  
  /**
   * Manipula a abertura da conexão WebSocket
   */
  private handleOpen(): void {
    console.log('[DASHBOARD_WS] Conexão WebSocket estabelecida!');
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // Limpar qualquer reconexão agendada
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Configurar ping para manter conexão ativa
    this.setupPing();
    
    // Resubscrever para símbolos pendentes
    if (this.symbolSubscriptions.size > 0) {
      console.log(`[DASHBOARD_WS] Resubscrevendo para ${this.symbolSubscriptions.size} símbolos...`);
      
      for (const symbol of this.symbolSubscriptions) {
        this.subscribeTicks(symbol);
      }
    }
  }
  
  /**
   * Manipula mensagens recebidas no WebSocket
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Processar apenas respostas de ticks
      if (data.msg_type === 'tick' && data.tick) {
        const tick = data.tick;
        
        // Extrair o preço e calcular o último dígito com segurança
        const price = parseFloat(tick.quote);
        
        // APENAS usar o método string que é mais confiável para dígitos 0
        // Formatamos o número com exatamente 1 casa decimal
        const priceStr = price.toFixed(1);
        // Pegamos o último caractere, que é o dígito após o ponto
        const lastChar = priceStr.charAt(priceStr.length - 1);
        // Convertemos para número
        const finalLastDigit = parseInt(lastChar);
        
        // Log explícito para diagnóstico
        console.log(`[DASHBOARD_WS] Recebido tick do ${tick.symbol}: ${price}, último dígito calculado: ${finalLastDigit}, valor original: ${tick.quote}`);
        
        // Usar o dígito final calculado pelo método string
        const finalDigit = finalLastDigit;
        
        // Criar objeto de evento de tick
        const tickEvent: DashboardTickEvent = {
          symbol: tick.symbol,
          quote: price,
          epoch: tick.epoch,
          pipSize: tick.pip_size || 0,
          lastDigit: finalDigit // Usar o último dígito pelo método string
        };
        
        // Notificar callbacks
        this.tickCallbacks.forEach(callback => {
          try {
            callback(tickEvent);
          } catch (err) {
            console.error('[DASHBOARD_WS] Erro em callback de tick:', err);
          }
        });
        
        // Disparar evento personalizado para componentes React
        this.dispatchTickEvent(tickEvent);
      }
    } catch (error) {
      console.error('[DASHBOARD_WS] Erro ao processar mensagem WebSocket:', error);
    }
  }
  
  /**
   * Manipula erros do WebSocket
   */
  private handleError(event: Event): void {
    console.error('[DASHBOARD_WS] Erro na conexão WebSocket:', event);
    this.isConnected = false;
  }
  
  /**
   * Manipula o fechamento da conexão WebSocket
   */
  private handleClose(event: CloseEvent): void {
    console.log(`[DASHBOARD_WS] Conexão WebSocket fechada: Código ${event.code} - ${event.reason || 'Sem motivo'}`);
    this.isConnected = false;
    
    // Agendar reconexão
    this.scheduleReconnect();
  }
  
  /**
   * Agenda reconexão com backoff exponencial
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      return; // Já existe uma reconexão agendada
    }
    
    // Calcular delay com backoff exponencial (1s, 2s, 4s, 8s, etc.)
    const delay = Math.min(
      this.MAX_RECONNECT_DELAY,
      1000 * Math.pow(2, this.reconnectAttempts)
    );
    
    this.reconnectAttempts++;
    
    console.log(`[DASHBOARD_WS] Agendando reconexão em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      console.log('[DASHBOARD_WS] Tentando reconectar...');
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }
  
  /**
   * Configura envio periódico de ping para manter a conexão ativa
   */
  private setupPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    // Enviar ping a cada 30 segundos
    this.pingInterval = setInterval(() => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        this.webSocket.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }
  
  /**
   * Dispara evento personalizado com informações do tick
   */
  private dispatchTickEvent(tick: DashboardTickEvent): void {
    // Criar evento personalizado
    const event = new CustomEvent('dashboard:tick', {
      detail: { tick }
    });
    
    // Disparar evento no documento
    document.dispatchEvent(event);
  }
  
  /**
   * Verifica se a conexão está ativa
   */
  public isActive(): boolean {
    return this.isConnected && this.webSocket !== null && this.webSocket.readyState === WebSocket.OPEN;
  }
}

// Exportar instância única
export const dashboardWebSocket = new DashboardWebSocket();