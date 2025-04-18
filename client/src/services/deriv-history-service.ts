// Interface para estatísticas de dígitos
export interface DigitStats {
  [key: number]: {
    count: number;
    percentage: number;
  };
}

// Interface para histórico de dígitos
export interface DigitHistoryData {
  lastDigits: number[];
  digitStats: DigitStats;
  lastUpdated: Date;
  totalCount: number;
}

/**
 * Serviço para gerenciar o histórico de dígitos usando WebSocket da Deriv
 */
class DerivHistoryService {
  private static instance: DerivHistoryService;
  private websocket: WebSocket | null = null;
  private token: string = "jybcQm0FbKr7evp"; // Token básico para leitura
  private connected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private historyData: Record<string, DigitHistoryData> = {};
  private listeners: Array<(data: DigitHistoryData) => void> = [];
  private tickHistories: Record<string, number[]> = {};
  private lastSaveTime: number = 0;
  private readonly MIN_SAVE_INTERVAL = 5000; // 5 segundos entre salvamentos
  
  private constructor() {
    this.initializeDigitStats('R_100');
  }
  
  public static getInstance(): DerivHistoryService {
    if (!DerivHistoryService.instance) {
      DerivHistoryService.instance = new DerivHistoryService();
    }
    return DerivHistoryService.instance;
  }
  
  private initializeDigitStats(symbol: string) {
    // Verificar se já existe dados para este símbolo
    if (!this.historyData[symbol]) {
      this.historyData[symbol] = {
        lastDigits: [],
        digitStats: {},
        lastUpdated: new Date(),
        totalCount: 0
      };
      
      // Inicializar estatísticas para todos os dígitos
      const stats: DigitStats = {};
      for (let i = 0; i < 10; i++) {
        stats[i] = { count: 0, percentage: 0 };
      }
      this.historyData[symbol].digitStats = stats;
    }
    
    // Inicializar histórico de ticks vazio se não existir
    if (!this.tickHistories[symbol]) {
      this.tickHistories[symbol] = [];
    }
    
    return this.historyData[symbol];
  }
  
  /**
   * Conecta ao WebSocket da Deriv
   */
  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.connected && this.websocket) {
        resolve(true);
        return;
      }
      
      // URL de conexão com a API WebSocket da Deriv
      const url = 'wss://ws.binaryws.com/websockets/v3?app_id=1089';
      this.websocket = new WebSocket(url);
      
      this.websocket.onopen = () => {
        console.log('[DerivHistoryService] Conexão WebSocket estabelecida');
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve(true);
      };
      
      this.websocket.onclose = () => {
        console.log('[DerivHistoryService] Conexão WebSocket fechada');
        this.connected = false;
        this.handleReconnect();
        resolve(false);
      };
      
      this.websocket.onerror = (error) => {
        console.error('[DerivHistoryService] Erro na conexão WebSocket:', error);
        this.connected = false;
        resolve(false);
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[DerivHistoryService] Erro ao processar mensagem:', error);
        }
      };
    });
  }
  
  /**
   * Solicita histórico de ticks para um símbolo
   * @param symbol Símbolo (ex: R_100)
   * @param count Quantidade de ticks a serem solicitados
   * @param subscribe Se true, continua recebendo ticks em tempo real
   */
  public async getTicksHistory(symbol: string = 'R_100', count: number = 500, subscribe: boolean = false): Promise<DigitHistoryData> {
    try {
      // Verificar se estamos conectados
      if (!this.connected) {
        await this.connect();
      }
      
      if (!this.connected || !this.websocket) {
        throw new Error('Não foi possível conectar ao WebSocket');
      }
      
      // Inicializar dados para este símbolo
      this.initializeDigitStats(symbol);
      
      // Carregar de localStorage
      this.loadFromLocalStorage(symbol);
      
      // Enviar solicitação para autorização
      this.websocket.send(JSON.stringify({
        authorize: this.token
      }));
      
      // Enviar solicitação para histórico de ticks
      this.websocket.send(JSON.stringify({
        ticks_history: symbol,
        count: count,
        end: 'latest',
        style: 'ticks',
        subscribe: subscribe ? 1 : undefined
      }));
      
      // Retornar os dados já carregados enquanto aguardamos atualizações
      return this.historyData[symbol];
    } catch (error) {
      console.error('[DerivHistoryService] Erro ao solicitar histórico de ticks:', error);
      throw error;
    }
  }
  
  /**
   * Trata as mensagens recebidas do WebSocket
   */
  private handleMessage(data: any) {
    // Resposta de autorização
    if (data.authorize) {
      console.log('[DerivHistoryService] Autorização recebida:', data.authorize);
    }
    
    // Resposta de histórico
    if (data.history) {
      const symbol = data.echo_req.ticks_history as string;
      console.log(`[DerivHistoryService] Histórico recebido para ${symbol} com ${data.history.prices.length} ticks`);
      
      // Processar ticks recebidos
      const prices = data.history.prices;
      const times = data.history.times;
      
      for (let i = 0; i < prices.length; i++) {
        const price = prices[i];
        const time = times[i];
        const digit = Math.floor(price * 10) % 10;
        
        // Adicionar ao histórico
        this.addDigitToHistory(symbol, digit);
      }
      
      // Notificar ouvintes
      this.notifyListeners(symbol);
      
      // Salvar em localStorage
      this.saveToLocalStorage(symbol);
    }
    
    // Tick em tempo real
    if (data.tick) {
      const symbol = data.tick.symbol as string;
      const price = data.tick.quote as number;
      const digit = Math.floor(price * 10) % 10;
      
      // Adicionar ao histórico
      this.addDigitToHistory(symbol, digit);
      
      // Notificar ouvintes
      this.notifyListeners(symbol);
      
      // Salvar periodicamente
      const now = Date.now();
      if (now - this.lastSaveTime > this.MIN_SAVE_INTERVAL) {
        this.saveToLocalStorage(symbol);
        this.lastSaveTime = now;
      }
    }
  }
  
  /**
   * Adiciona um dígito ao histórico e atualiza estatísticas
   */
  private addDigitToHistory(symbol: string, digit: number) {
    // Verificar se temos dados para este símbolo
    if (!this.historyData[symbol]) {
      this.initializeDigitStats(symbol);
    }
    
    // Adicionar dígito ao array
    this.historyData[symbol].lastDigits.push(digit);
    this.tickHistories[symbol].push(digit);
    
    // Limitar a 100 últimos dígitos para exibição
    if (this.historyData[symbol].lastDigits.length > 100) {
      this.historyData[symbol].lastDigits.shift();
    }
    
    // Manter histórico completo para estatísticas (limitado a 1000)
    if (this.tickHistories[symbol].length > 1000) {
      this.tickHistories[symbol].shift();
    }
    
    // Incrementar contagem total
    this.historyData[symbol].totalCount++;
    
    // Atualizar data da última atualização
    this.historyData[symbol].lastUpdated = new Date();
    
    // Recalcular estatísticas
    this.recalculateStats(symbol);
  }
  
  /**
   * Recalcula estatísticas para um símbolo
   */
  private recalculateStats(symbol: string) {
    const ticks = this.tickHistories[symbol];
    const stats = this.historyData[symbol].digitStats;
    
    // Inicializar contagens
    const counts: {[key: number]: number} = {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
    };
    
    // Contar ocorrências
    for (const digit of ticks) {
      counts[digit]++;
    }
    
    // Calcular percentagens
    const total = ticks.length;
    for (let i = 0; i < 10; i++) {
      stats[i] = {
        count: counts[i],
        percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
      };
    }
  }
  
  /**
   * Salva dados em localStorage
   */
  private saveToLocalStorage(symbol: string) {
    try {
      const data = {
        lastDigits: this.historyData[symbol].lastDigits,
        tickHistory: this.tickHistories[symbol],
        lastUpdated: this.historyData[symbol].lastUpdated.toISOString(),
        totalCount: this.historyData[symbol].totalCount
      };
      
      localStorage.setItem(`digit_history_${symbol}`, JSON.stringify(data));
      console.log(`[DerivHistoryService] Dados de ${symbol} salvos em localStorage`);
    } catch (error) {
      console.error('[DerivHistoryService] Erro ao salvar em localStorage:', error);
    }
  }
  
  /**
   * Carrega dados do localStorage
   */
  private loadFromLocalStorage(symbol: string) {
    try {
      const storedData = localStorage.getItem(`digit_history_${symbol}`);
      
      if (storedData) {
        const data = JSON.parse(storedData);
        
        // Restaurar dados
        this.historyData[symbol].lastDigits = data.lastDigits || [];
        this.tickHistories[symbol] = data.tickHistory || [];
        this.historyData[symbol].lastUpdated = new Date(data.lastUpdated);
        this.historyData[symbol].totalCount = data.totalCount || 0;
        
        // Recalcular estatísticas
        this.recalculateStats(symbol);
        
        console.log(`[DerivHistoryService] Dados de ${symbol} carregados do localStorage`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[DerivHistoryService] Erro ao carregar do localStorage:', error);
      return false;
    }
  }
  
  /**
   * Gerencia tentativas de reconexão
   */
  private handleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DerivHistoryService] Número máximo de tentativas de reconexão atingido');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000);
    
    console.log(`[DerivHistoryService] Tentativa de reconexão ${this.reconnectAttempts} em ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect().then((success) => {
        if (success) {
          console.log('[DerivHistoryService] Reconexão bem-sucedida');
          // Reinscrever nos ticks para símbolos ativos
          Object.keys(this.historyData).forEach((symbol) => {
            this.getTicksHistory(symbol, 0, true);
          });
        } else {
          console.log('[DerivHistoryService] Falha na reconexão');
          this.handleReconnect();
        }
      });
    }, delay);
  }
  
  /**
   * Adiciona um ouvinte para atualizações de um símbolo
   */
  public addListener(listener: (data: DigitHistoryData) => void, symbol: string = 'R_100') {
    this.listeners.push(listener);
    
    // Notificar imediatamente com os dados atuais
    if (this.historyData[symbol]) {
      listener(this.historyData[symbol]);
    }
  }
  
  /**
   * Remove um ouvinte
   */
  public removeListener(listener: (data: DigitHistoryData) => void) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }
  
  /**
   * Notifica todos os ouvintes sobre atualizações
   */
  private notifyListeners(symbol: string) {
    if (this.historyData[symbol]) {
      for (const listener of this.listeners) {
        listener(this.historyData[symbol]);
      }
    }
  }
  
  /**
   * Obtém os dados atuais para um símbolo
   */
  public getDigitStats(symbol: string = 'R_100'): DigitHistoryData {
    return this.historyData[symbol] || this.initializeDigitStats(symbol);
  }
}

// Exportar instância única
export const derivHistoryService = DerivHistoryService.getInstance();