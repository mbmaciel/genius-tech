import { db } from '@/lib/db';
import { 
  digitHistory, 
  digitStats,
  digitStatsByPeriod,
  type InsertDigitStat,
  type InsertDigitHistory,
  type InsertDigitStatsByPeriod 
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Interface para os dados de estatísticas de dígitos
export interface DigitStatistics {
  [key: number]: {
    count: number;
    percentage: number;
  };
}

// Interface para os dados de histórico de dígitos formatados
export interface DigitHistoryData {
  lastDigits: number[];
  digitStats: DigitStatistics;
  lastUpdated: Date;
  totalTicks: number;
}

export interface TicksHistoryOptions {
  symbol?: string;
  count?: number;
  subscribe?: boolean;
}

class TicksHistoryService {
  private static instance: TicksHistoryService;
  private websocket: WebSocket | null = null;
  private token: string = "jybcQm0FbKr7evp"; // Token fixo básico para operações de leitura
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 2000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private historyListeners: Array<(data: DigitHistoryData) => void> = [];
  private tickListeners: Array<(digit: number, price: number) => void> = [];

  // Estatísticas em memória
  private stats: DigitHistoryData = {
    lastDigits: [],
    digitStats: {},
    lastUpdated: new Date(),
    totalTicks: 0
  };

  // Cache em memória
  private cache: {
    [symbol: string]: DigitHistoryData
  } = {};

  private constructor() {
    // Inicializar estatísticas para todos os dígitos
    this.resetDigitStats();
  }

  public static getInstance(): TicksHistoryService {
    if (!TicksHistoryService.instance) {
      TicksHistoryService.instance = new TicksHistoryService();
    }
    return TicksHistoryService.instance;
  }

  private resetDigitStats() {
    const newStats: DigitStatistics = {};
    for (let i = 0; i < 10; i++) {
      newStats[i] = { count: 0, percentage: 0 };
    }
    this.stats.digitStats = newStats;
    this.stats.lastDigits = [];
    this.stats.totalTicks = 0;
    this.stats.lastUpdated = new Date();
  }

  // Conectar ao WebSocket para ticks históricos
  public connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.isConnected && this.websocket) {
        resolve(true);
        return;
      }

      const url = "wss://ws.binaryws.com/websockets/v3?app_id=1089";
      this.websocket = new WebSocket(url);

      this.websocket.onopen = () => {
        console.log('[TICKS_HISTORY] Conexão WebSocket aberta');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve(true);
      };

      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('[TICKS_HISTORY] Erro ao processar mensagem:', error);
        }
      };

      this.websocket.onerror = (error) => {
        console.error('[TICKS_HISTORY] Erro na conexão WebSocket:', error);
        this.isConnected = false;
        if (!this.reconnectTimer) {
          this.handleDisconnect();
        }
        resolve(false);
      };

      this.websocket.onclose = () => {
        console.log('[TICKS_HISTORY] Conexão WebSocket fechada');
        this.isConnected = false;
        if (!this.reconnectTimer) {
          this.handleDisconnect();
        }
        resolve(false);
      };
    });
  }

  private handleDisconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[TICKS_HISTORY] Tentando reconectar em ${this.reconnectTimeout / 1000}s (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connect().then((success) => {
          if (success) {
            console.log('[TICKS_HISTORY] Reconexão bem-sucedida');
            // Reinscrever nos ticks que estavam ativos
            if (this.stats.lastDigits.length > 0) {
              this.getTicksHistory({ symbol: 'R_100', subscribe: true });
            }
          } else {
            console.log('[TICKS_HISTORY] Falha na reconexão');
          }
        });
      }, this.reconnectTimeout);
      
      // Aumentar o timeout para a próxima tentativa (exponential backoff)
      this.reconnectTimeout = Math.min(this.reconnectTimeout * 1.5, 30000);
    } else {
      console.error('[TICKS_HISTORY] Número máximo de tentativas de reconexão atingido');
    }
  }

  // Solicitar histórico de ticks para um símbolo
  public getTicksHistory(options: TicksHistoryOptions = {}): Promise<DigitHistoryData> {
    const symbol = options.symbol || 'R_100';
    const count = options.count || 500; // Solicitar 500 ticks por padrão
    const subscribe = options.subscribe || false;

    return new Promise(async (resolve, reject) => {
      try {
        // Primeiro, verificar cache em memória
        if (this.cache[symbol]) {
          resolve(this.cache[symbol]);
        }

        // Segundo, verificar banco de dados
        const dbData = await this.getDigitHistoryFromDatabase(symbol);
        if (dbData) {
          this.cache[symbol] = dbData;
          this.stats = dbData;
          this.notifyHistoryListeners(dbData);
          resolve(dbData);

          // Se não precisamos de subscrição, podemos retornar aqui
          if (!subscribe) {
            return;
          }
        }
        
        // Terceiro, solicitar dados da API Deriv
        if (!this.isConnected) {
          await this.connect();
        }

        if (!this.isConnected || !this.websocket) {
          reject(new Error("Não foi possível conectar ao servidor"));
          return;
        }

        // Autorizar primeiro
        this.websocket.send(JSON.stringify({
          authorize: this.token
        }));

        // Enviar requisição para histórico de ticks
        this.websocket.send(JSON.stringify({
          ticks_history: symbol,
          count: count,
          end: "latest",
          style: "ticks",
          subscribe: subscribe ? 1 : undefined
        }));
      } catch (error) {
        console.error('[TICKS_HISTORY] Erro ao solicitar histórico de ticks:', error);
        reject(error);
      }
    });
  }

  private handleMessage(data: any) {
    // Resposta de autorização
    if (data.authorize) {
      console.log('[TICKS_HISTORY] Autorização bem-sucedida');
    }
    
    // Resposta de histórico de ticks
    if (data.history) {
      console.log(`[TICKS_HISTORY] Recebido histórico com ${data.history.prices.length} ticks`);
      
      // Resetar estatísticas
      this.resetDigitStats();
      
      // Processar todos os ticks do histórico
      for (let i = 0; i < data.history.prices.length; i++) {
        const price = data.history.prices[i];
        const digit = Math.floor(price * 10) % 10;
        this.updateDigitStats(digit);
      }
      
      // Salvar no banco de dados
      this.saveStatsToDatabase(data.echo_req.ticks_history);
      
      // Notificar ouvintes
      this.notifyHistoryListeners(this.stats);
    }
    
    // Resposta de tick em tempo real (se inscrito)
    if (data.tick) {
      const price = data.tick.quote;
      const digit = Math.floor(price * 10) % 10;
      
      // Atualizar estatísticas
      this.updateDigitStats(digit);
      
      // Salvar no banco de dados periodicamente (a cada 10 ticks)
      if (this.stats.totalTicks % 10 === 0) {
        this.saveStatsToDatabase(data.tick.symbol);
      }
      
      // Notificar ouvintes
      this.notifyTickListeners(digit, price);
      this.notifyHistoryListeners(this.stats);
    }
  }

  private updateDigitStats(digit: number) {
    // Adicionar o dígito ao array de últimos dígitos
    this.stats.lastDigits.push(digit);
    
    // Manter apenas os últimos 100 dígitos
    if (this.stats.lastDigits.length > 100) {
      this.stats.lastDigits.shift();
    }
    
    // Incrementar a contagem total
    this.stats.totalTicks++;
    
    // Verificar se o dígito já existe nas estatísticas
    if (!this.stats.digitStats[digit]) {
      this.stats.digitStats[digit] = { count: 0, percentage: 0 };
    }
    
    // Recalcular as estatísticas para todos os dígitos
    const counts: { [digit: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    
    // Contar ocorrências de cada dígito
    for (const d of this.stats.lastDigits) {
      counts[d]++;
    }
    
    // Calcular percentagens
    const total = this.stats.lastDigits.length;
    for (let i = 0; i < 10; i++) {
      this.stats.digitStats[i] = {
        count: counts[i],
        percentage: Math.round((counts[i] / total) * 100)
      };
    }
    
    // Atualizar timestamp
    this.stats.lastUpdated = new Date();
  }

  // Métodos para banco de dados
  
  // Salvar estatísticas no banco de dados
  private async saveStatsToDatabase(symbol: string) {
    try {
      console.log(`[TICKS_HISTORY] Salvando estatísticas para ${symbol} no banco de dados`);
      
      // 1. Salvar contagem individual de cada dígito
      for (let i = 0; i < 10; i++) {
        const stat: InsertDigitStat = {
          symbol,
          digit: i,
          count: this.stats.digitStats[i].count,
          percentage: this.stats.digitStats[i].percentage
        };
        
        // Verificar se o registro já existe
        const existingRecord = await db.select()
          .from(digitStats)
          .where(and(
            eq(digitStats.symbol, symbol),
            eq(digitStats.digit, i)
          ))
          .limit(1);
        
        if (existingRecord.length > 0) {
          // Atualizar registro existente
          await db.update(digitStats)
            .set({
              count: stat.count,
              percentage: stat.percentage,
              updated_at: new Date()
            })
            .where(and(
              eq(digitStats.symbol, symbol),
              eq(digitStats.digit, i)
            ));
        } else {
          // Inserir novo registro
          await db.insert(digitStats).values(stat);
        }
      }
      
      // 2. Salvar array de últimos dígitos
      const historyData: InsertDigitHistory = {
        symbol,
        digits: this.stats.lastDigits,
        total_count: this.stats.totalTicks
      };
      
      // Verificar se o registro já existe
      const existingHistory = await db.select()
        .from(digitHistory)
        .where(eq(digitHistory.symbol, symbol))
        .limit(1);
      
      if (existingHistory.length > 0) {
        // Atualizar registro existente
        await db.update(digitHistory)
          .set({
            digits: this.stats.lastDigits,
            total_count: this.stats.totalTicks,
            updated_at: new Date()
          })
          .where(eq(digitHistory.symbol, symbol));
      } else {
        // Inserir novo registro
        await db.insert(digitHistory).values(historyData);
      }
      
      console.log(`[TICKS_HISTORY] Estatísticas salvas com sucesso para ${symbol}`);
    } catch (error) {
      console.error('[TICKS_HISTORY] Erro ao salvar estatísticas no banco de dados:', error);
    }
  }
  
  // Carregar estatísticas do banco de dados
  private async getDigitHistoryFromDatabase(symbol: string): Promise<DigitHistoryData | null> {
    try {
      console.log(`[TICKS_HISTORY] Carregando estatísticas para ${symbol} do banco de dados`);
      
      // 1. Carregar estatísticas individuais
      const statsRecords = await db.select()
        .from(digitStats)
        .where(eq(digitStats.symbol, symbol));
      
      // 2. Carregar array de dígitos
      const historyRecord = await db.select()
        .from(digitHistory)
        .where(eq(digitHistory.symbol, symbol))
        .limit(1);
      
      // Se não houver dados, retornar null
      if (statsRecords.length === 0 || historyRecord.length === 0) {
        console.log(`[TICKS_HISTORY] Nenhum dado encontrado para ${symbol}`);
        return null;
      }
      
      // Montar resultado
      const result: DigitHistoryData = {
        lastDigits: (historyRecord[0].digits as number[]) || [],
        digitStats: {},
        lastUpdated: historyRecord[0].updated_at,
        totalTicks: historyRecord[0].total_count
      };
      
      // Processar estatísticas
      for (const stat of statsRecords) {
        result.digitStats[stat.digit] = {
          count: stat.count,
          percentage: stat.percentage
        };
      }
      
      console.log(`[TICKS_HISTORY] Estatísticas carregadas com sucesso para ${symbol}`);
      return result;
    } catch (error) {
      console.error('[TICKS_HISTORY] Erro ao carregar estatísticas do banco de dados:', error);
      return null;
    }
  }

  // Listeners

  // Adicionar ouvinte para atualizações de histórico
  public addHistoryListener(listener: (data: DigitHistoryData) => void) {
    this.historyListeners.push(listener);
    
    // Notificar imediatamente com os dados atuais
    if (this.stats.lastDigits.length > 0) {
      listener(this.stats);
    }
  }
  
  // Remover ouvinte de histórico
  public removeHistoryListener(listener: (data: DigitHistoryData) => void) {
    this.historyListeners = this.historyListeners.filter(l => l !== listener);
  }
  
  // Adicionar ouvinte para novos ticks
  public addTickListener(listener: (digit: number, price: number) => void) {
    this.tickListeners.push(listener);
  }
  
  // Remover ouvinte de ticks
  public removeTickListener(listener: (digit: number, price: number) => void) {
    this.tickListeners = this.tickListeners.filter(l => l !== listener);
  }
  
  // Notificar ouvintes sobre atualizações de histórico
  private notifyHistoryListeners(data: DigitHistoryData) {
    for (const listener of this.historyListeners) {
      listener(data);
    }
  }
  
  // Notificar ouvintes sobre novos ticks
  private notifyTickListeners(digit: number, price: number) {
    for (const listener of this.tickListeners) {
      listener(digit, price);
    }
  }
}

// Exportar instância única
export const ticksHistoryService = TicksHistoryService.getInstance();