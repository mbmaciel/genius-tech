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
    // Inicializar estruturas com dados vazios para começar sempre limpo
    this.initializeDigitStats('R_100');
    
    // NUNCA carregar dados de localStorage ou outras fontes de persistência
    // durante a inicialização
    console.log('[DerivHistoryService] Iniciado com estruturas vazias, ignorando qualquer persistência');
    
    // Remover dados do localStorage para R_100 para garantir que começamos do zero
    localStorage.removeItem('digit_history_R_100');
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
      // Criar estatísticas para todos os dígitos (0-9)
      const stats: DigitStats = {};
      for (let i = 0; i <= 9; i++) {
        stats[i] = { count: 0, percentage: 0 };
      }
      
      this.historyData[symbol] = {
        lastDigits: [],
        digitStats: stats,
        lastUpdated: new Date(),
        totalCount: 0
      };
    } else {
      // Garantir que todos os dígitos (0-9) estão presentes nas estatísticas
      const stats = this.historyData[symbol].digitStats;
      for (let i = 0; i <= 9; i++) {
        if (!stats[i]) {
          stats[i] = { count: 0, percentage: 0 };
        }
      }
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
   * Limpa todo o histórico armazenado para um símbolo específico
   * @param symbol Símbolo a ser limpo (ex: R_100)
   */
  public clearHistory(symbol: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        console.log(`[DerivHistoryService] Limpando todo o histórico armazenado para ${symbol}`);
        
        // Remover dados do localStorage
        localStorage.removeItem(`digit_history_${symbol}`);
        
        // Reinicializar estruturas de dados
        const statsObj: DigitStats = {};
        for (let i = 0; i <= 9; i++) {
          statsObj[i] = {count: 0, percentage: 0};
        }
        
        this.historyData[symbol] = {
          lastDigits: [],
          digitStats: statsObj,
          lastUpdated: new Date(),
          totalCount: 0
        };
        
        this.tickHistories[symbol] = [];
        
        console.log(`[DerivHistoryService] Histórico para ${symbol} limpo com sucesso`);
        resolve();
      } catch (error) {
        console.error(`[DerivHistoryService] Erro ao limpar histórico para ${symbol}:`, error);
        resolve(); // Resolve mesmo em caso de erro para não interromper o fluxo
      }
    });
  }
  
  /**
   * Solicita histórico de ticks para um símbolo
   * @param symbol Símbolo (ex: R_100)
   * @param count Quantidade de ticks a serem solicitados
   * @param subscribe Se true, continua recebendo ticks em tempo real
   * @param forceRefresh Se true, ignora qualquer cache e busca dados frescos
   */
  public async getTicksHistory(
    symbol: string = 'R_100', 
    count: number = 500, 
    subscribe: boolean = false,
    forceRefresh: boolean = false
  ): Promise<DigitHistoryData> {
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
      
      console.log(`[DerivHistoryService] Solicitando os ${count} ticks mais recentes do mercado para ${symbol}`);
      
      // Se forceRefresh é true, limpar todos os dados anteriores
      if (forceRefresh) {
        console.log(`[DerivHistoryService] FORÇA ATUALIZAÇÃO: limpando dados armazenados para ${symbol} antes de buscar novos`);
        
        // Limpar dados anteriores antes de buscar novos ticks
        // Isto garante que sempre começamos com o estado atual do mercado
        const statsObj: DigitStats = {};
        for (let i = 0; i <= 9; i++) {
          statsObj[i] = {count: 0, percentage: 0};
        }
        
        this.historyData[symbol] = {
          lastDigits: [],
          digitStats: statsObj,
          lastUpdated: new Date(),
          totalCount: 0
        };
        
        this.tickHistories[symbol] = [];
        
        // Também remover do localStorage
        localStorage.removeItem(`digit_history_${symbol}`);
      }
      
      // Enviar solicitação para autorização
      this.websocket.send(JSON.stringify({
        authorize: this.token
      }));
      
      // Solicitar histórico de ticks (500 ticks é o padrão conforme solicitado)
      console.log(`[DerivHistoryService] Solicitando exatamente ${count} ticks mais recentes do mercado para ${symbol}`);
      this.websocket.send(JSON.stringify({
        ticks_history: symbol,
        count: count > 0 ? count : 500, // Garantir que solicitamos pelo menos 500 ticks
        end: 'latest',
        style: 'ticks',
        subscribe: subscribe ? 1 : undefined
      }));
      
      // Retornar os dados vazios enquanto aguardamos os ticks mais recentes
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
   * Método privado usado internamente pelo serviço
   */
  private addDigitToHistoryInternal(symbol: string, digit: number) {
    // Verificar se temos dados para este símbolo
    if (!this.historyData[symbol]) {
      this.initializeDigitStats(symbol);
    }
    
    // Adicionar dígito ao array
    this.historyData[symbol].lastDigits.push(digit);
    
    // Inicializar array de histórico se necessário
    if (!this.tickHistories[symbol]) {
      this.tickHistories[symbol] = [];
    }
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
   * Adiciona um dígito ao histórico e atualiza estatísticas
   * Método público para ser usado externamente
   * @param symbol Símbolo (ex: R_100)
   * @param digit Último dígito do preço
   */
  public addDigitToHistory(symbol: string, digit: number): void {
    try {
      // Adicionar ao histórico local
      this.addDigitToHistoryInternal(symbol, digit);
      
      // Salvar no banco de dados
      this.saveToDB(symbol);
      
      // Notificar ouvintes sobre a atualização
      this.notifyListeners(symbol);
    } catch (error) {
      console.error('[DerivHistoryService] Erro ao adicionar dígito ao histórico:', error);
    }
  }
  
  /**
   * Salva os dados atuais no banco de dados
   */
  private async saveToDB(symbol: string): Promise<void> {
    try {
      // Verificar se temos dados para salvar
      if (!this.historyData[symbol] || this.historyData[symbol].lastDigits.length === 0) {
        return;
      }
      
      // Verificar se passamos do intervalo mínimo para salvar
      const now = Date.now();
      if (now - this.lastSaveTime < this.MIN_SAVE_INTERVAL) {
        return; // Não salvar com muita frequência
      }
      
      this.lastSaveTime = now;
      
      // Dados para salvar
      const dataToSave = {
        symbol,
        lastDigits: this.historyData[symbol].lastDigits,
        digitStats: this.historyData[symbol].digitStats,
        totalCount: this.historyData[symbol].totalCount,
        lastUpdated: new Date()
      };
      
      // Requisição para salvar no backend
      try {
        const response = await fetch('/api/digit-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dataToSave)
        });
        
        if (!response.ok) {
          throw new Error(`Erro ao salvar no banco: ${response.status} ${response.statusText}`);
        }
        
        console.log(`[DerivHistoryService] Dados de ${symbol} salvos no banco de dados`);
      } catch (dbError) {
        console.error('[DerivHistoryService] Erro ao salvar no banco:', dbError);
        // Em caso de falha, salvar no localStorage
        this.saveToLocalStorage(symbol);
      }
    } catch (error) {
      console.error('[DerivHistoryService] Erro ao tentar salvar no banco:', error);
    }
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
   * DESATIVADO - Não salva mais em localStorage
   * Método mantido por compatibilidade, mas não faz nada
   */
  private saveToLocalStorage(symbol: string) {
    // A persistência em localStorage foi desativada
    // Método mantido por compatibilidade com o código existente
    // O REQUISITO CRÍTICO é NUNCA usar dados persistidos de sessões anteriores
    console.log(`[DerivHistoryService] Método saveToLocalStorage chamado para ${symbol}, mas desativado por projeto`);
    return;
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
        
        // Recalcular estatísticas e garantir que todos os dígitos (0-9) estão presentes
        this.recalculateStats(symbol);
        
        // Verificar se todos os dígitos (0-9) estão presentes
        const stats = this.historyData[symbol].digitStats;
        for (let i = 0; i <= 9; i++) {
          if (!stats[i]) {
            stats[i] = { count: 0, percentage: 0 };
          }
        }
        
        // Ordenar os dígitos numericamente (0-9)
        const orderedStats: DigitStats = {};
        for (let i = 0; i <= 9; i++) {
          orderedStats[i] = stats[i];
        }
        this.historyData[symbol].digitStats = orderedStats;
        
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