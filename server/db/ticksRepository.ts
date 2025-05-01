import { pool } from '../db';

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
      const query = `
        INSERT INTO market_ticks (symbol, tick_value, last_digit)
        VALUES ($1, $2, $3)
        ON CONFLICT (symbol, timestamp) DO NOTHING
      `;
      await pool.query(query, [tick.symbol, tick.tick_value, tick.last_digit]);
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
      // Iniciar transação
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Preparar a query com múltiplos valores
        const values = ticks.map((tick, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(',');
        const params = ticks.flatMap(tick => [tick.symbol, tick.tick_value, tick.last_digit]);
        
        const query = `
          INSERT INTO market_ticks (symbol, tick_value, last_digit)
          VALUES ${values}
          ON CONFLICT (symbol, timestamp) DO NOTHING
        `;
        
        await client.query(query, params);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('[TicksRepository] Erro na transação de ticks:', error);
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('[TicksRepository] Erro ao armazenar múltiplos ticks:', error);
    }
  }

  /**
   * Recupera os últimos N ticks de um símbolo específico
   */
  async getLastTicks(symbol: string, limit: number = 500): Promise<MarketTick[]> {
    try {
      const query = `
        SELECT symbol, tick_value, last_digit, timestamp
        FROM market_ticks
        WHERE symbol = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;
      
      const result = await pool.query(query, [symbol, limit]);
      return result.rows;
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
      const query = `
        SELECT COUNT(*) as count
        FROM market_ticks
        WHERE symbol = $1
      `;
      
      const result = await pool.query(query, [symbol]);
      return parseInt(result.rows[0].count, 10) > 0;
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
      const findLatestQuery = `
        SELECT id
        FROM market_ticks
        WHERE symbol = $1
        ORDER BY timestamp DESC
        LIMIT $2
      `;
      
      const latestResult = await pool.query(findLatestQuery, [symbol, keepLatest]);
      
      if (latestResult.rows.length < keepLatest) {
        // Não há ticks suficientes para limpar
        return;
      }
      
      // Extrair os IDs para manter
      const idsToKeep = latestResult.rows.map(row => row.id);
      
      // Remover todos os outros ticks para este símbolo
      const deleteQuery = `
        DELETE FROM market_ticks
        WHERE symbol = $1 AND id NOT IN (${idsToKeep.join(',')})
      `;
      
      await pool.query(deleteQuery, [symbol]);
      console.log(`[TicksRepository] Limpeza executada para ${symbol}. Mantendo ${keepLatest} ticks mais recentes.`);
    } catch (error) {
      console.error('[TicksRepository] Erro ao limpar ticks antigos:', error);
    }
  }
}

export const ticksRepository = new TicksRepository();