/**
 * Serviço WebSocket independente para conexão com a Deriv API
 * Este serviço é completamente separado da conexão principal do bot e não interfere com ela
 */

// Interfaces para os dados
export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export interface DigitHistory {
  stats: DigitStat[];
  lastDigits: number[];
  totalSamples: number;
  symbol: string;
  lastUpdated: Date;
}

// Tipo de callback para ouvintes de eventos
type EventCallback = (data: any) => void;

class IndependentDerivService {
  private static instance: IndependentDerivService;
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private requestId: number = 1;
  private callbacks: Map<number, (response: any) => void> = new Map();
  private readonly appId: string = '1089'; // App ID público para dados de mercado
  
  // Gerenciamento de eventos
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  
  // Gerenciamento de reconexão
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  
  // Cache de dados
  private digitHistories: Map<string, DigitHistory> = new Map();
  
  // Controle de subscrição
  private activeSubscriptions: Set<string> = new Set();
  
  // Singleton
  private constructor() {
    console.log('[INDEPENDENT_DERIV] Inicializando serviço WebSocket independente para estatísticas de dígitos');
    
    // Inicializar mapas de eventos
    this.eventListeners.set('tick', new Set());
    this.eventListeners.set('history', new Set());
    this.eventListeners.set('connection', new Set());
    this.eventListeners.set('error', new Set());
    
    // Conectar automaticamente
    this.connect();
  }
  
  public static getInstance(): IndependentDerivService {
    if (!IndependentDerivService.instance) {
      IndependentDerivService.instance = new IndependentDerivService();
    }
    return IndependentDerivService.instance;
  }
  
  /**
   * Estabelece conexão com o WebSocket da Deriv
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        console.log('[INDEPENDENT_DERIV] Já conectado ao WebSocket');
        resolve(true);
        return;
      }
      
      // Limpar timer de reconexão existente
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
      }
      
      console.log('[INDEPENDENT_DERIV] Conectando ao WebSocket da Deriv...');
      const url = `wss://ws.binaryws.com/websockets/v3?app_id=${this.appId}`;
      
      try {
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log('[INDEPENDENT_DERIV] Conexão WebSocket estabelecida');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.notifyListeners('connection', { connected: true });
          
          // Reativar subscrições
          this.resubscribeAll();
          
          resolve(true);
        };
        
        this.socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[INDEPENDENT_DERIV] Erro ao processar mensagem:', error);
            this.notifyListeners('error', { message: 'Erro ao processar mensagem' });
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[INDEPENDENT_DERIV] Erro WebSocket:', error);
          this.notifyListeners('error', { message: 'Erro na conexão WebSocket' });
          reject(error);
        };
        
        this.socket.onclose = (event) => {
          console.log('[INDEPENDENT_DERIV] Conexão WebSocket fechada:', event.code, event.reason);
          this.isConnected = false;
          this.notifyListeners('connection', { connected: false });
          
          // Tentar reconexão
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            console.log(`[INDEPENDENT_DERIV] Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimer = setTimeout(() => {
              this.reconnectAttempts++;
              this.connect()
                .catch(() => console.error('[INDEPENDENT_DERIV] Falha na tentativa de reconexão'));
            }, delay);
          } else {
            console.error('[INDEPENDENT_DERIV] Máximo de tentativas de reconexão atingido');
          }
        };
      } catch (error) {
        console.error('[INDEPENDENT_DERIV] Erro ao iniciar conexão WebSocket:', error);
        this.notifyListeners('error', { message: 'Erro ao iniciar conexão' });
        reject(error);
      }
    });
  }
  
  /**
   * Processa as mensagens recebidas do WebSocket
   */
  private handleMessage(data: any): void {
    // Verificar se é uma resposta a uma solicitação específica
    if (data.req_id && this.callbacks.has(data.req_id)) {
      const callback = this.callbacks.get(data.req_id);
      if (callback) {
        callback(data);
        this.callbacks.delete(data.req_id);
      }
    }
    
    // Processar ticks recebidos
    if (data.tick) {
      const symbol = data.tick.symbol;
      const quote = data.tick.quote;
      const lastDigit = parseInt(quote.toString().slice(-1));
      
      // Log para diagnóstico
      console.log(`[INDEPENDENT_DERIV] Novo tick para ${symbol}: ${quote} (último dígito: ${lastDigit})`);
      
      // Notificar sobre o tick
      this.notifyListeners('tick', {
        symbol, 
        quote, 
        lastDigit,
        epoch: data.tick.epoch
      });
      
      // Atualizar histórico de dígitos
      this.updateDigitHistory(symbol, lastDigit);
    }
    
    // Processar histórico de ticks
    if (data.history && data.echo_req && data.echo_req.ticks_history) {
      const symbol = data.echo_req.ticks_history;
      const prices = data.history.prices;
      
      if (prices && prices.length > 0) {
        // Extrair últimos dígitos do histórico
        const lastDigits = prices.map((price: number) => 
          parseInt(price.toString().slice(-1))
        );
        
        // Atualizar histórico
        this.initializeDigitHistory(symbol, lastDigits);
        
        // Notificar sobre atualização de histórico
        this.notifyListeners('history', this.getDigitHistory(symbol));
      }
    }
    
    // Processar erros
    if (data.error) {
      console.error('[INDEPENDENT_DERIV] Erro na resposta da API:', data.error);
      this.notifyListeners('error', data.error);
    }
  }
  
  /**
   * Inicializa o histórico de dígitos para um símbolo com dados existentes
   */
  private initializeDigitHistory(symbol: string, lastDigits: number[]): void {
    const digitCounts = new Array(10).fill(0);
    
    // Contar ocorrências de cada dígito
    for (const digit of lastDigits) {
      digitCounts[digit]++;
    }
    
    // Calcular percentuais
    const totalSamples = lastDigits.length;
    const stats = digitCounts.map((count, digit) => ({
      digit,
      count,
      percentage: totalSamples > 0 ? Math.round((count / totalSamples) * 100) : 0
    }));
    
    // Criar ou atualizar o histórico
    this.digitHistories.set(symbol, {
      stats,
      lastDigits: lastDigits.slice(-500), // Manter apenas os 500 mais recentes
      totalSamples,
      symbol,
      lastUpdated: new Date()
    });
    
    console.log(`[INDEPENDENT_DERIV] Histórico de dígitos inicializado para ${symbol} com ${totalSamples} amostras`);
  }
  
  /**
   * Atualiza o histórico de dígitos com um novo tick
   */
  private updateDigitHistory(symbol: string, lastDigit: number): void {
    console.log(`[INDEPENDENT_DERIV] Atualizando histórico para ${symbol} com dígito ${lastDigit}`);
    
    const history = this.digitHistories.get(symbol);
    
    if (!history) {
      // Criar histórico vazio para o símbolo se não existir
      const stats = Array.from({ length: 10 }, (_, digit) => ({
        digit,
        count: digit === lastDigit ? 1 : 0,
        percentage: digit === lastDigit ? 100 : 0
      }));
      
      this.digitHistories.set(symbol, {
        stats,
        lastDigits: [lastDigit],
        totalSamples: 1,
        symbol,
        lastUpdated: new Date()
      });
      
      // Notificar sobre a primeira atualização
      this.notifyListeners('history', this.getDigitHistory(symbol));
      return;
    }
    
    // Atualizar lista de últimos dígitos (limitar a 500)
    history.lastDigits.push(lastDigit);
    if (history.lastDigits.length > 500) {
      history.lastDigits.shift();
    }
    
    // Recontar dígitos (abordagem simples e confiável)
    const digitCounts = new Array(10).fill(0);
    for (const digit of history.lastDigits) {
      digitCounts[digit]++;
    }
    
    // Recalcular percentuais
    const totalSamples = history.lastDigits.length;
    history.stats = digitCounts.map((count, digit) => ({
      digit,
      count,
      percentage: totalSamples > 0 ? Math.round((count / totalSamples) * 100) : 0
    }));
    
    // Adicionar log para diagnóstico
    if (totalSamples % 10 === 0) { // Logar a cada 10 ticks para não sobrecarregar
      console.log(`[INDEPENDENT_DERIV] Estatísticas atualizadas para ${symbol}: 
        Total: ${totalSamples} ticks
        Dígitos recentes: ${history.lastDigits.slice(-10).reverse().join(', ')}
        Distribuição: ${history.stats.map(s => `${s.digit}:${s.percentage}%`).join(', ')}
      `);
    }
    
    history.totalSamples = totalSamples;
    history.lastUpdated = new Date();
    
    // Notificar ouvintes sobre atualização
    this.notifyListeners('history', this.getDigitHistory(symbol));
  }
  
  /**
   * Obtém histórico de ticks para um símbolo
   */
  public fetchTicksHistory(symbol: string, count: number = 500): Promise<DigitHistory> {
    if (!this.isConnected) {
      return this.connect().then(() => this.fetchTicksHistory(symbol, count));
    }
    
    console.log(`[INDEPENDENT_DERIV] Solicitando histórico de ${count} ticks para ${symbol}`);
    
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      
      this.callbacks.set(reqId, (response) => {
        if (response.error) {
          console.error(`[INDEPENDENT_DERIV] Erro ao obter histórico para ${symbol}:`, response.error);
          reject(new Error(response.error.message));
          return;
        }
        
        if (response.history && response.history.prices) {
          // Obter histórico depois de atualizado
          const history = this.getDigitHistory(symbol);
          resolve(history);
        } else {
          reject(new Error('Resposta de histórico incompleta'));
        }
      });
      
      // Enviar solicitação
      this.sendMessage({
        ticks_history: symbol,
        count: count,
        end: 'latest',
        style: 'ticks',
        req_id: reqId
      });
    });
  }
  
  /**
   * Assina para receber ticks de um símbolo específico
   */
  public subscribeTicks(symbol: string): Promise<boolean> {
    if (!this.isConnected) {
      return this.connect().then(() => this.subscribeTicks(symbol));
    }
    
    // Verificar se já está inscrito
    if (this.activeSubscriptions.has(symbol)) {
      console.log(`[INDEPENDENT_DERIV] Já inscrito para ticks de ${symbol}`);
      return Promise.resolve(true);
    }
    
    console.log(`[INDEPENDENT_DERIV] Assinando ticks para ${symbol}`);
    
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      
      this.callbacks.set(reqId, (response) => {
        if (response.error) {
          console.error(`[INDEPENDENT_DERIV] Erro ao assinar ticks para ${symbol}:`, response.error);
          reject(new Error(response.error.message));
          return;
        }
        
        console.log(`[INDEPENDENT_DERIV] Assinatura de ticks para ${symbol} bem-sucedida`);
        this.activeSubscriptions.add(symbol);
        resolve(true);
      });
      
      // Enviar solicitação
      this.sendMessage({
        ticks: symbol,
        subscribe: 1,
        req_id: reqId
      });
    });
  }
  
  /**
   * Cancela assinatura de ticks para um símbolo
   */
  public unsubscribeTicks(symbol: string): Promise<boolean> {
    if (!this.isConnected || !this.activeSubscriptions.has(symbol)) {
      console.log(`[INDEPENDENT_DERIV] Não inscrito para ticks de ${symbol}`);
      return Promise.resolve(true);
    }
    
    console.log(`[INDEPENDENT_DERIV] Cancelando assinatura de ticks para ${symbol}`);
    
    return new Promise((resolve) => {
      const reqId = this.requestId++;
      
      this.callbacks.set(reqId, () => {
        console.log(`[INDEPENDENT_DERIV] Assinatura de ticks para ${symbol} cancelada`);
        this.activeSubscriptions.delete(symbol);
        resolve(true);
      });
      
      // Enviar solicitação de cancelamento
      this.sendMessage({
        forget_all: 'ticks',
        req_id: reqId
      });
    });
  }
  
  /**
   * Reativa todas as subscrições ativas
   */
  private resubscribeAll(): void {
    if (this.activeSubscriptions.size === 0) {
      return;
    }
    
    console.log(`[INDEPENDENT_DERIV] Reativando ${this.activeSubscriptions.size} subscrições`);
    
    for (const symbol of this.activeSubscriptions) {
      this.subscribeTicks(symbol)
        .catch((error) => console.error(`[INDEPENDENT_DERIV] Erro ao reativar subscrição para ${symbol}:`, error));
    }
  }
  
  /**
   * Obtém o histórico de dígitos para um símbolo
   */
  public getDigitHistory(symbol: string): DigitHistory {
    const history = this.digitHistories.get(symbol);
    
    if (!history) {
      // Retornar um histórico vazio se não houver dados
      return {
        stats: Array.from({ length: 10 }, (_, digit) => ({
          digit,
          count: 0,
          percentage: 0
        })),
        lastDigits: [],
        totalSamples: 0,
        symbol,
        lastUpdated: new Date()
      };
    }
    
    return { ...history };
  }
  
  /**
   * Enviar mensagem para o WebSocket
   */
  private sendMessage(message: any): void {
    if (!this.socket || !this.isConnected) {
      console.error('[INDEPENDENT_DERIV] Tentativa de enviar mensagem sem conexão WebSocket');
      return;
    }
    
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * Adiciona um ouvinte para um tipo de evento
   */
  public addListener(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)?.add(callback);
    console.log(`[INDEPENDENT_DERIV] Ouvinte adicionado para evento ${event}`);
  }
  
  /**
   * Remove um ouvinte para um tipo de evento
   */
  public removeListener(event: string, callback: EventCallback): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
      console.log(`[INDEPENDENT_DERIV] Ouvinte removido para evento ${event}`);
    }
  }
  
  /**
   * Notifica todos os ouvintes registrados para um evento
   */
  private notifyListeners(event: string, data: any): void {
    if (!this.eventListeners.has(event)) {
      return;
    }
    
    const listeners = this.eventListeners.get(event);
    if (listeners && listeners.size > 0) {
      // Adicionar log para rastrear eventos e dados repassados
      if (event === 'history') {
        console.log(`[INDEPENDENT_DERIV] Notificando ${listeners.size} ouvintes sobre atualização de histórico:`, 
          `Symbol: ${data.symbol}, ` +
          `Stats: ${data.stats?.length || 0}, ` +
          `Digits: ${data.lastDigits?.length || 0}`);
      }
      
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[INDEPENDENT_DERIV] Erro ao executar ouvinte para ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Fecha a conexão WebSocket
   */
  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.isConnected = false;
    console.log('[INDEPENDENT_DERIV] Conexão WebSocket fechada');
  }
}

// Exportar instância única do serviço
export const independentDerivService = IndependentDerivService.getInstance();