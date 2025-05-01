import { db } from '../db';
import { marketTicks } from '@shared/schema';
import { eq, desc, sql, and, not, inArray } from 'drizzle-orm';

interface MarketTick {
  symbol: string;
  tick_value: number;
  last_digit: number;
  timestamp?: Date;
}

/**
 * Classe responsável por gerenciar a persistência dos ticks de mercado no banco de dados
 */
export class TicksRepository {
  
  /**
   * Armazena um novo tick no banco de dados
   */
  async storeTick(tick: MarketTick): Promise<void> {
    try {
      await db.insert(marketTicks).values({
        symbol: tick.symbol,
        tick_value: tick.tick_value,
        last_digit: tick.last_digit
      }).onConflictDoNothing();
      
      console.log(`[TicksRepository] Tick armazenado para ${tick.symbol}: ${tick.tick_value} (${tick.last_digit})`);
    } catch (error) {
      console.error('[TicksRepository] Erro ao armazenar tick:', error);
    }
  }

  /**
   * Armazena múltiplos ticks no banco de dados em uma única transação
   */
  async storeMultipleTicks(ticks: MarketTick[]): Promise<void> {
    if (!ticks.length) return;
    
    try {
      // Converter para o formato aceito pelo Drizzle
      const ticksToInsert = ticks.map(tick => ({
        symbol: tick.symbol,
        tick_value: tick.tick_value,
        last_digit: tick.last_digit
      }));
      
      // Inserir em uma única operação (mais eficiente)
      await db.insert(marketTicks).values(ticksToInsert).onConflictDoNothing();
      
      console.log(`[TicksRepository] ${ticks.length} ticks armazenados para ${ticks[0].symbol}`);
    } catch (error) {
      console.error('[TicksRepository] Erro ao armazenar múltiplos ticks:', error);
    }
  }

  /**
   * Recupera os últimos N ticks de um símbolo específico
   */
  async getLastTicks(symbol: string, limit: number = 500): Promise<MarketTick[]> {
    try {
      const result = await db.select({
        id: marketTicks.id,
        symbol: marketTicks.symbol,
        tick_value: marketTicks.tick_value,
        last_digit: marketTicks.last_digit,
        timestamp: marketTicks.timestamp
      })
      .from(marketTicks)
      .where(eq(marketTicks.symbol, symbol))
      .orderBy(desc(marketTicks.timestamp))
      .limit(limit);
      
      console.log(`[TicksRepository] Recuperados ${result.length} ticks para ${symbol}`);
      return result as MarketTick[];
    } catch (error) {
      console.error('[TicksRepository] Erro ao recuperar ticks:', error);
      return [];
    }
  }

  /**
   * Verifica se há ticks armazenados para um determinado símbolo
   */
  async hasStoredTicks(symbol: string): Promise<boolean> {
    try {
      const result = await db.select({
        count: sql<number>`count(*)`
      })
      .from(marketTicks)
      .where(eq(marketTicks.symbol, symbol));
      
      return result[0].count > 0;
    } catch (error) {
      console.error('[TicksRepository] Erro ao verificar ticks armazenados:', error);
      return false;
    }
  }

  /**
   * Limpa ticks antigos para evitar crescimento excessivo do banco
   * Mantém apenas os últimos N ticks por símbolo
   */
  async cleanupOldTicks(symbol: string, keepLatest: number = 1000): Promise<void> {
    try {
      // Identificar os IDs dos ticks mais recentes que devem ser mantidos
      const latestIds = await db.select({ id: marketTicks.id })
        .from(marketTicks)
        .where(eq(marketTicks.symbol, symbol))
        .orderBy(desc(marketTicks.timestamp))
        .limit(keepLatest);
      
      if (latestIds.length < keepLatest) {
        // Não há ticks suficientes para limpar
        return;
      }
      
      // Extrair os IDs para manter
      const idsToKeep = latestIds.map(row => row.id);
      
      // Remover todos os outros ticks para este símbolo (que não estão na lista de IDs a manter)
      const result = await db.delete(marketTicks)
        .where(
          and(
            eq(marketTicks.symbol, symbol),
            not(inArray(marketTicks.id, idsToKeep))
          )
        );
      
      console.log(`[TicksRepository] Limpeza executada para ${symbol}. Mantendo ${keepLatest} ticks mais recentes.`);
    } catch (error) {
      console.error('[TicksRepository] Erro ao limpar ticks antigos:', error);
    }
  }
}

export const ticksRepository = new TicksRepository();