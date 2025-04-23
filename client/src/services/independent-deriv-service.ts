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
  private readonly dashboardToken: string = 'jybcQm0FbKr7evp'; // Token específico para a dashboard
  
  // Gerenciamento de eventos
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  
  // Gerenciamento de reconexão
  private reconnectTimer: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10; // Aumentado para mais tentativas
  private reconnectDelayMs: number = 1000; // Delay inicial de 1 segundo
  
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
    
    // Carregar históricos salvos do localStorage
    this.loadSavedHistoriesFromLocalStorage();
    
    // Conectar automaticamente
    this.connect();
  }
  
  /**
   * Carrega os históricos de dígitos salvos no localStorage
   * para que estejam disponíveis logo após carregar a página
   */
  private loadSavedHistoriesFromLocalStorage(): void {
    try {
      // Carregar histórico para o símbolo padrão R_100
      // Tentar várias chaves possíveis para compatibilidade
      let lastDigits: number[] = [];
      
      // Tentar nossa própria chave primeiro
      const savedHistoryKey = 'deriv_digits_history_R_100';
      const savedHistoryJson = localStorage.getItem(savedHistoryKey);
      
      if (savedHistoryJson) {
        const savedData = JSON.parse(savedHistoryJson);
        if (savedData.lastDigits && savedData.lastDigits.length > 0) {
          lastDigits = savedData.lastDigits;
          console.log(`[INDEPENDENT_DERIV] Carregado histórico de ${lastDigits.length} ticks da chave principal`);
        }
      }
      
      // Se não encontrou na primeira chave, tenta a chave usada pelo componente do Bot
      if (lastDigits.length === 0) {
        const botHistoryKey = 'fixed_digitHistory_R_100';
        const botHistoryJson = localStorage.getItem(botHistoryKey);
        
        if (botHistoryJson) {
          try {
            const botData = JSON.parse(botHistoryJson);
            if (Array.isArray(botData) && botData.length > 0) {
              lastDigits = botData;
              console.log(`[INDEPENDENT_DERIV] Carregado histórico de ${lastDigits.length} ticks da chave do Bot`);
            }
          } catch (e) {
            console.warn('[INDEPENDENT_DERIV] Erro ao analisar dados do Bot:', e);
          }
        }
      }
      
      // Inicializar com os dígitos encontrados (se houver)
      if (lastDigits.length > 0) {
        console.log(`[INDEPENDENT_DERIV] Inicializando histórico com ${lastDigits.length} ticks carregados do localStorage`);
        this.initializeDigitHistory('R_100', lastDigits);
      } else {
        console.log('[INDEPENDENT_DERIV] Nenhum histórico salvo encontrado, começando do zero');
      }
    } catch (e) {
      console.warn('[INDEPENDENT_DERIV] Erro ao carregar histórico do localStorage:', e);
    }
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
      const url = `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`;
      
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
            // Usar o delay configurado, com incremento exponencial suave
            const delay = Math.min(this.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts), 15000);
            console.log(`[INDEPENDENT_DERIV] Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimer = setTimeout(() => {
              this.reconnectAttempts++;
              this.connect()
                .then(() => {
                  console.log('[INDEPENDENT_DERIV] Reconexão bem-sucedida');
                  // Após reconectar, verificar se há subscrições ativas
                  if (this.activeSubscriptions.size > 0) {
                    this.resubscribeAll();
                  }
                })
                .catch(() => console.error('[INDEPENDENT_DERIV] Falha na tentativa de reconexão'));
            }, delay);
          } else {
            console.error('[INDEPENDENT_DERIV] Máximo de tentativas de reconexão atingido');
            // Mesmo após atingir o máximo, tentar novamente em 30 segundos como última chance
            this.reconnectTimer = setTimeout(() => {
              console.log('[INDEPENDENT_DERIV] Tentativa de recuperação final após pausa...');
              this.reconnectAttempts = 0; // Resetar contador
              this.connect();
            }, 30000);
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
      
      // Usar o método CORRETO para R_100
      // O último dígito é a SEGUNDA casa decimal (o último caractere do número formatado)
      const priceStr = parseFloat(quote.toString()).toFixed(2); // Formatar com 2 casas decimais
      const lastChar = priceStr.charAt(priceStr.length - 1); // Pegar o último caractere (segunda casa decimal)
      const lastDigit = parseInt(lastChar, 10);
      
      // Log detalhado para diagnóstico
      console.log(`[INDEPENDENT_DERIV] Processando ${quote} -> último dígito ${lastDigit}`);
      
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
        // Extrair últimos dígitos do histórico - usando método correto (segunda casa decimal)
        const lastDigits = prices.map((price: number) => {
          // Usar o mesmo método que usamos para ticks em tempo real
          const priceStr = parseFloat(price.toString()).toFixed(2); // Formatar com 2 casas decimais
          const lastChar = priceStr.charAt(priceStr.length - 1); // Pegar o último caractere (segunda casa decimal)
          return parseInt(lastChar, 10);
        });
        
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
    // Inicializar array de contagem para dígitos 0-9
    const digitCounts = new Array(10).fill(0);
    
    console.log(`[INDEPENDENT_DERIV] Inicializando histórico com ${lastDigits.length} dígitos. Primeiros 10:`, 
      lastDigits.slice(0, 10).join(', '));
    
    // Contar ocorrências de cada dígito, incluindo zero
    for (const digit of lastDigits) {
      // Verificação extra para garantir que dígitos 0 sejam contados corretamente
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    }
    
    // Verificação adicional para garantir que estamos contando corretamente
    console.log('[INDEPENDENT_DERIV] Contagem por dígito:', 
      digitCounts.map((count, digit) => `${digit}: ${count}`).join(', '));
    
    // Calcular percentuais
    const totalSamples = lastDigits.length;
    
    // Criar estatísticas para todos os dígitos, mesmo que não tenham ocorrências
    const stats = [];
    for (let digit = 0; digit <= 9; digit++) {
      stats.push({
        digit,
        count: digitCounts[digit],
        percentage: totalSamples > 0 ? Math.round((digitCounts[digit] / totalSamples) * 100) : 0
      });
    }
    
    // Criar ou atualizar o histórico com exatamente 500 ticks
    this.digitHistories.set(symbol, {
      stats,
      lastDigits: lastDigits.slice(-500), // Garantir que temos exatamente os 500 mais recentes
      totalSamples: Math.min(totalSamples, 500), // Limitar a 500 o total de amostras
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
      // Garantir que temos estatísticas para todos os dígitos (0-9)
      const stats = [];
      for (let i = 0; i <= 9; i++) {
        stats.push({
          digit: i,
          count: i === lastDigit ? 1 : 0,
          percentage: i === lastDigit ? 100 : 0
        });
      }
      
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
    
    // Atualizar lista de últimos dígitos (assegurar que manteremos exatamente 500)
    history.lastDigits.push(lastDigit);
    while (history.lastDigits.length > 500) {
      history.lastDigits.shift();
    }
    
    // Recontar dígitos (abordagem simples e confiável)
    const digitCounts = new Array(10).fill(0);
    for (const digit of history.lastDigits) {
      // Verificar se o dígito é um número válido antes de contar
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    }
    
    // Recalcular percentuais
    const totalSamples = history.lastDigits.length;
    history.stats = digitCounts.map((count, digit) => ({
      digit,
      count,
      percentage: totalSamples > 0 ? Math.round((count / totalSamples) * 100) : 0
    }));
    
    // Certificar que temos todos os dígitos representados (0-9), mesmo que com contagem zero
    for (let digit = 0; digit <= 9; digit++) {
      if (!history.stats.some(s => s.digit === digit)) {
        history.stats.push({
          digit,
          count: 0,
          percentage: 0
        });
      }
    }
    
    // Ordenar por dígito para garantir a ordem correta (0-9)
    history.stats.sort((a, b) => a.digit - b.digit);
    
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
   * Salva os dados do histórico de dígitos no localStorage para persistência
   */
  private saveHistoryToLocalStorage(symbol: string): void {
    try {
      const history = this.digitHistories.get(symbol);
      if (!history) return;
      
      const data = {
        lastDigits: history.lastDigits,
        stats: history.stats,
        totalSamples: history.totalSamples,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(`deriv_digits_history_${symbol}`, JSON.stringify(data));
      console.log(`[INDEPENDENT_DERIV] Histórico de ${history.lastDigits.length} ticks salvo no localStorage para ${symbol}`);
    } catch (e) {
      console.warn('[INDEPENDENT_DERIV] Não foi possível salvar o histórico no localStorage:', e);
    }
  }

  /**
   * Obtém histórico de ticks para um símbolo
   * Este método busca os últimos 500 ticks e os armazena, para que eles estejam
   * disponíveis mesmo após atualizar a página
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
          // Extrair todos os dígitos (até 500) e inicializar o histórico
          const prices = response.history.prices;
          const lastDigits = prices.map((price: number) => {
            // Usar o método CORRETO para R_100 (mesma estratégia de processamento do tick em tempo real)
            const priceStr = parseFloat(price.toString()).toFixed(2); // Formatar com 2 casas decimais
            const lastChar = priceStr.charAt(priceStr.length - 1); // Pegar o último caractere (segunda casa decimal)
            return parseInt(lastChar, 10);
          });
          
          console.log(`[INDEPENDENT_DERIV] Histórico recebido com ${lastDigits.length} ticks`);
          
          // Atualizar histórico com os dados recebidos
          this.initializeDigitHistory(symbol, lastDigits);
          
          // Salvar no localStorage para persistir entre recarregamentos
          this.saveHistoryToLocalStorage(symbol);
          
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
    
    // Tentar reativar R_100 diretamente se presente na lista
    if (this.activeSubscriptions.has('R_100')) {
      this.subscribeTicks('R_100')
        .catch(error => console.error('[INDEPENDENT_DERIV] Erro ao reativar R_100:', error));
    }
    
    // Se houver outras subscrições, poderíamos adicionar aqui
  }
  
  /**
   * Obtém o histórico de dígitos para um símbolo, com opção de filtrar por número de ticks
   * @param symbol O símbolo para obter o histórico
   * @param tickCount Opcional: O número de ticks para filtrar (25, 50, 100, 200, 300 ou 500)
   */
  public getDigitHistory(symbol: string, tickCount?: number): DigitHistory {
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
    
    // Se não especificar tickCount, retornar o histórico completo
    if (!tickCount || tickCount >= history.lastDigits.length) {
      console.log(`[INDEPENDENT_DERIV] Retornando histórico completo para ${symbol}: ${history.lastDigits.length} ticks`);
      return { ...history };
    }
    
    console.log(`[INDEPENDENT_DERIV] Filtrando histórico para ${symbol} com ${tickCount} ticks dos ${history.lastDigits.length} disponíveis`);
    
    // Caso contrário, filtrar pelos últimos N ticks (com verificação extra para garantir que estamos pegando o número certo)
    const filteredDigits = history.lastDigits.slice(-Math.min(tickCount, history.lastDigits.length));
    
    // Verificação extra
    if (filteredDigits.length !== tickCount) {
      console.warn(`[INDEPENDENT_DERIV] Aviso: Solicitados ${tickCount} ticks, mas obtidos ${filteredDigits.length}`);
    }
    
    // Recalcular as estatísticas baseadas nos dígitos filtrados
    const digitCounts = new Array(10).fill(0);
    
    // Contar ocorrências de cada dígito com verificação extra
    for (const digit of filteredDigits) {
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      } else {
        console.warn(`[INDEPENDENT_DERIV] Dígito inválido ignorado: ${digit}`);
      }
    }
    
    // Verificação extra para garantir que temos contagem para todos os dígitos
    if (digitCounts.some(count => count === undefined)) {
      console.warn(`[INDEPENDENT_DERIV] Algumas contagens são undefined:`, digitCounts);
      // Corrigir qualquer contagem undefined
      for (let i = 0; i < digitCounts.length; i++) {
        if (digitCounts[i] === undefined) digitCounts[i] = 0;
      }
    }
    
    // Recalcular percentuais com alta precisão e depois arredondar para evitar erros de precisão
    const totalSamples = filteredDigits.length;
    
    // Garantir que temos estatísticas para TODOS os dígitos, não apenas os que aparecem
    const stats = [];
    for (let digit = 0; digit <= 9; digit++) {
      const count = digitCounts[digit] || 0;
      // Usar cálculo de percentual mais preciso: calcular com precisão e depois arredondar
      const percentage = totalSamples > 0 ? Math.round((count / totalSamples) * 100) : 0;
      stats.push({ digit, count, percentage });
    }
    
    // Garantir que os dígitos estão em ordem correta
    stats.sort((a, b) => a.digit - b.digit);
    
    // Log para debug
    console.log(`[INDEPENDENT_DERIV] Histórico filtrado: ${totalSamples} ticks, distribuição:`,
      stats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
    
    // Retornar história filtrada
    return {
      stats,
      lastDigits: filteredDigits,
      totalSamples,
      symbol,
      lastUpdated: new Date()
    };
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
   * Remove todos os ouvintes de um evento específico ou de todos os eventos
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      // Remover todos os ouvintes de um evento específico
      if (this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
        console.log(`[INDEPENDENT_DERIV] Todos os ouvintes removidos para evento ${event}`);
      }
    } else {
      // Remover todos os ouvintes de todos os eventos
      this.eventListeners.forEach((_, eventName) => {
        this.eventListeners.set(eventName, new Set());
      });
      console.log(`[INDEPENDENT_DERIV] Todos os ouvintes removidos de todos os eventos`);
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