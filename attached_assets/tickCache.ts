/**
 * Sistema de cache para ticks da Deriv API
 * Armazena os últimos ticks para uso em vários componentes,
 * independente da navegação do usuário
 */

// Estrutura para armazenar um tick único
export interface TickData {
  value: number;
  time: Date;
  symbol: string;
  digit: number;
}

// Estrutura para estatísticas de dígitos
export interface DigitStats {
  digit: number;
  count: number;
  percentage: number;
}

class TickCache {
  private ticks: Map<string, TickData[]> = new Map();
  private tickLimit: number = 500; // Aumentado para melhor análise estatística
  private digitStats: Map<string, DigitStats[]> = new Map();
  private lastDigits: Map<string, number[]> = new Map(); // Cache específico para últimos dígitos
  private callbacks: Set<(symbol: string, tick: TickData) => void> = new Set();

  constructor() {
    // Inicialização silenciosa para melhor performance
  }

  /**
   * Adiciona um novo tick ao cache com detecção avançada de duplicações
   * Distingue entre:
   * 1) Duplicações técnicas (pacotes duplicados da API) - são filtradas
   * 2) Repetições reais de mercado (o mesmo valor após tempo razoável) - são mantidas
   */
  addTick(symbol: string, price: number, time: Date): TickData {
    // Extrair o último dígito (centavos)
    const digit = Math.floor(price * 100) % 10;

    // Criar objeto do tick
    const tickData: TickData = {
      value: price,
      time: time,
      symbol: symbol,
      digit: digit
    };

    // Verificar se já existe um array para este símbolo
    if (!this.ticks.has(symbol)) {
      this.ticks.set(symbol, []);
    }

    // Buscar o array de ticks para este símbolo
    const symbolTicks = this.ticks.get(symbol)!;
    
    // Determinar se este é um tick duplicado
    let isDuplicatePacket = false;  // Duplicação técnica (pacote da API duplicado)
    let isRealMarketRepetition = false;  // Repetição real no mercado (mesmo valor após tempo razoável)
    
    if (symbolTicks.length > 0) {
      const lastTick = symbolTicks[symbolTicks.length - 1];
      
      // Verificar se o preço é idêntico
      const isPriceIdentical = Math.abs(lastTick.value - price) < 0.0001;
      
      // Verificar o intervalo de tempo desde o último tick
      const timeSinceLastTick = time.getTime() - lastTick.time.getTime();
      
      // Classificação:
      // 1. Se o intervalo for muito pequeno (<300ms) = provavelmente pacote duplicado (técnico)
      // 2. Se o intervalo for razoável (>=500ms) = possível repetição real do mercado
      
      if (isPriceIdentical) {
        if (timeSinceLastTick < 300) {
          // É uma duplicação técnica (provavelmente do websocket)
          isDuplicatePacket = true;
          // Ocultado para reduzir logs no console
          // console.log(`[TickCache] Pacote duplicado detectado para ${symbol}: ${price} (intervalo: ${timeSinceLastTick}ms)`);
        } else if (timeSinceLastTick >= 500) {
          // É uma repetição real do mercado - ISTO É IMPORTANTE MANTER!
          isRealMarketRepetition = true;
          console.log(`[TickCache] REPETIÇÃO REAL DE MERCADO para ${symbol}: ${price} (intervalo: ${timeSinceLastTick}ms)`);
        }
      }
    }

    // SEMPRE adicionamos ao array de ticks principal
    symbolTicks.push(tickData);

    // Limitar o número de ticks armazenados
    if (symbolTicks.length > this.tickLimit) {
      symbolTicks.shift(); // Remove o tick mais antigo
    }

    // Atualizar cache de últimos dígitos para acesso rápido
    if (!this.lastDigits.has(symbol)) {
      this.lastDigits.set(symbol, []);
    }
    const digitCache = this.lastDigits.get(symbol)!;
    
    // Para o cache de dígitos, adicionamos SEMPRE,
    // exceto se for uma duplicação técnica identificada
    if (!isDuplicatePacket || isRealMarketRepetition) {
      digitCache.push(digit);
    }
    
    // Limitar tamanho do cache de dígitos também
    if (digitCache.length > this.tickLimit) {
      digitCache.shift();
    }

    // Atualizar estatísticas de dígitos
    this.updateDigitStats(symbol);

    // Notificar todos os assinantes (mesmo para duplicações, 
    // pois outros componentes podem ter lógica própria de filtragem)
    this.notifySubscribers(symbol, tickData);

    return tickData;
  }
  
  /**
   * Obter o timestamp do último tick para um símbolo
   */
  private getLastTickTime(symbol: string): Date | null {
    if (!this.ticks.has(symbol)) return null;
    
    const symbolTicks = this.ticks.get(symbol)!;
    if (symbolTicks.length === 0) return null;
    
    return symbolTicks[symbolTicks.length - 1].time;
  }

  /**
   * Obter os últimos N dígitos para um símbolo (mais eficiente que extrair dos ticks)
   */
  getLastDigits(symbol: string, count: number = 10): number[] {
    if (!this.lastDigits.has(symbol)) return [];
    
    const digits = this.lastDigits.get(symbol)!;
    return digits.slice(-count);
  }

  /**
   * Inscrever para receber notificações de novos ticks
   */
  subscribe(callback: (symbol: string, tick: TickData) => void): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  /**
   * Notificar todos os assinantes sobre um novo tick
   */
  private notifySubscribers(symbol: string, tick: TickData): void {
    this.callbacks.forEach((callback) => {
      try {
        callback(symbol, tick);
      } catch (error) {
        console.error('Erro ao notificar assinante de tick:', error);
      }
    });
  }

  /**
   * Obter os últimos N ticks para um símbolo
   */
  getLastTicks(symbol: string, count: number = 10): TickData[] {
    if (!this.ticks.has(symbol)) return [];
    
    const symbolTicks = this.ticks.get(symbol)!;
    return symbolTicks.slice(-count);
  }

  /**
   * Obter todas as estatísticas de dígitos para um símbolo
   */
  getDigitStats(symbol: string): DigitStats[] {
    if (!this.digitStats.has(symbol)) {
      this.updateDigitStats(symbol);
    }
    return this.digitStats.get(symbol) || [];
  }

  /**
   * Atualizar estatísticas de dígitos para um símbolo
   */
  private updateDigitStats(symbol: string): void {
    const symbolTicks = this.ticks.get(symbol) || [];
    
    // Contagem de ocorrências de cada dígito
    const counts = Array(10).fill(0);
    for (const tick of symbolTicks) {
      counts[tick.digit]++;
    }
    
    // Calcular porcentagens e criar array de estatísticas
    const stats: DigitStats[] = counts.map((count, digit) => ({
      digit,
      count,
      percentage: symbolTicks.length > 0 ? (count / symbolTicks.length) * 100 : 0
    }));
    
    this.digitStats.set(symbol, stats);
  }

  /**
   * Limpar todos os dados armazenados
   */
  clear(): void {
    this.ticks.clear();
    this.digitStats.clear();
    this.lastDigits.clear();
  }
}

// Instância singleton para uso em toda a aplicação
export const tickCache = new TickCache();