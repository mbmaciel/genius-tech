import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import { db } from "./db";
import { digitStats, digitHistory, digitStatsByPeriod, users, userCredentials } from "@shared/schema";
import { ticksRepository } from './db/ticksRepository';
import { eq, and, desc } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const httpServer = createServer(app);
  
  // API routes
  
  // Rota para salvar estatísticas de dígitos
  app.post('/api/digit-history', async (req, res) => {
    try {
      console.log('[API] Recebendo estatísticas de dígitos:', req.body.symbol, 'com', req.body.lastDigits?.length || 0, 'dígitos');
      
      const { symbol, lastDigits, digitStats: statsData, totalCount, lastUpdated } = req.body;
      
      if (!symbol || !lastDigits || !statsData) {
        return res.status(400).json({ error: 'Dados incompletos' });
      }
      
      // Para cada dígito (0-9), atualize ou insira suas estatísticas
      for (let digit = 0; digit <= 9; digit++) {
        const digitData = statsData[digit];
        if (!digitData) continue;
        
        // Verificar se já existe estatística para este símbolo e dígito
        const existingStats = await db.select().from(digitStats)
          .where(and(
            eq(digitStats.symbol, symbol),
            eq(digitStats.digit, digit)
          ));
        
        if (existingStats.length > 0) {
          // Atualizar estatísticas existentes
          await db.update(digitStats)
            .set({
              count: digitData.count,
              percentage: digitData.percentage,
              updated_at: new Date()
            })
            .where(and(
              eq(digitStats.symbol, symbol),
              eq(digitStats.digit, digit)
            ));
        } else {
          // Inserir novas estatísticas
          await db.insert(digitStats)
            .values({
              symbol,
              digit,
              count: digitData.count,
              percentage: digitData.percentage,
              updated_at: new Date()
            });
        }
      }
      
      console.log(`[API] Estatísticas atualizadas para ${symbol} (todos os dígitos)`);
      
      
      // Verificar se já existe histórico para este símbolo
      const existingHistory = await db.select().from(digitHistory)
        .where(eq(digitHistory.symbol, symbol));
      
      if (existingHistory.length > 0) {
        // Atualizar histórico existente
        await db.update(digitHistory)
          .set({
            digits: lastDigits,
            total_count: totalCount,
            updated_at: new Date()
          })
          .where(eq(digitHistory.symbol, symbol));
      } else {
        // Inserir novo histórico
        await db.insert(digitHistory)
          .values({
            symbol,
            digits: lastDigits,
            total_count: totalCount,
            updated_at: new Date()
          });
      }
      
      res.status(200).json({ success: true, message: 'Dados salvos com sucesso' });
    } catch (error) {
      console.error('[API] Erro ao salvar estatísticas de dígitos:', error);
      res.status(500).json({ error: 'Erro ao processar requisição' });
    }
  });
  
  // Rota para obter estatísticas de dígitos
  app.get('/api/digit-history/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      
      if (!symbol) {
        return res.status(400).json({ error: 'Símbolo é obrigatório' });
      }
      
      // Buscar estatísticas de dígitos
      const statsResults = await db.select().from(digitStats)
        .where(eq(digitStats.symbol, symbol));
      
      // Buscar histórico de dígitos
      const historyResult = await db.select().from(digitHistory)
        .where(eq(digitHistory.symbol, symbol));
      
      if (statsResults.length === 0 || historyResult.length === 0) {
        return res.status(404).json({ error: 'Dados não encontrados' });
      }
      
      // Converter resultados de dígitos para formato esperado pelo cliente
      const digitStatsObj: Record<number, { count: number; percentage: number }> = {};
      statsResults.forEach(stat => {
        digitStatsObj[stat.digit] = {
          count: stat.count,
          percentage: stat.percentage
        };
      });
      
      const result = {
        symbol,
        lastDigits: historyResult[0].digits || [],
        digitStats: digitStatsObj,
        totalCount: historyResult[0].total_count || 0,
        lastUpdated: historyResult[0].updated_at
      };
      
      res.status(200).json(result);
    } catch (error) {
      console.error('[API] Erro ao obter estatísticas de dígitos:', error);
      res.status(500).json({ error: 'Erro ao processar requisição' });
    }
  });
  
  // Create WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // WebSocket connection handler
  wss.on('connection', function connection(ws) {
    console.log('WebSocket client connected');
    
    // Handle incoming messages
    ws.on('message', function incoming(message) {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received message:', data);
        
        // Handle different message types
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        else if (data.type === 'subscribe') {
          // Handle subscription requests
          handleSubscription(ws, data);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });
    
    // Handle connection close
    ws.on('close', function() {
      console.log('WebSocket client disconnected');
    });
    
    // Send welcome message
    ws.send(JSON.stringify({ 
      type: 'welcome', 
      message: 'Connected to Genius Tech Trading WebSocket server'
    }));
  });
  
  // Authentication API endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Validate request
      if (!email || !password) {
        return res.status(400).json({ 
          message: 'Email and password are required' 
        });
      }
      
      // In a real app, you would verify credentials against the database
      // For now we'll just return success if the format is valid
      res.json({ 
        success: true,
        message: 'Authentication successful',
        user: {
          id: 1,
          email,
          name: 'Demo User',
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Registration API endpoint
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      // Validate request
      if (!username || !email || !password) {
        return res.status(400).json({ 
          message: 'All fields are required' 
        });
      }
      
      // In a real app, you would save the user to the database
      // For now we'll just return success if the format is valid
      res.json({ 
        success: true,
        message: 'Registration successful',
        user: {
          id: 1,
          username,
          email,
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // API endpoint to store user tokens
  app.post('/api/tokens/store', async (req, res) => {
    try {
      const { token, account, tokenType } = req.body;
      
      // Validate request
      if (!token || !account) {
        return res.status(400).json({ 
          message: 'Token and account are required' 
        });
      }
      
      // In a real app, you would store this information securely
      // For now, we'll just return success
      res.json({ 
        success: true,
        message: 'Token stored successfully'
      });
    } catch (error) {
      console.error('Token storage error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // API endpoint to retrieve market data (demo)
  app.get('/api/market/stats/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      
      // Generate demo data for the requested symbol
      const stats = generateMarketStats(symbol);
      
      res.json({ 
        success: true,
        stats
      });
    } catch (error) {
      console.error('Market stats error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // API endpoints para gerenciamento de usuários
  
  // GET - Obter lista de todas as credenciais de usuários
  app.get('/api/user-credentials', async (req, res) => {
    try {
      const credentials = await db.select()
        .from(userCredentials)
        .orderBy(desc(userCredentials.created_at));
      
      res.json({ 
        success: true,
        data: credentials
      });
    } catch (error) {
      console.error('Error retrieving user credentials:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // POST - Adicionar nova credencial de usuário
  app.post('/api/user-credentials', async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ 
          success: false,
          message: 'Email and password are required' 
        });
      }
      
      // Verificar se o usuário já existe
      const existingUser = await db.select()
        .from(userCredentials)
        .where(eq(userCredentials.email, email))
        .limit(1);
      
      if (existingUser.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
      
      // Inserir novo usuário
      const [newUser] = await db.insert(userCredentials)
        .values({
          email,
          password
        })
        .returning();
      
      res.status(201).json({ 
        success: true,
        message: 'User created successfully',
        data: newUser
      });
    } catch (error) {
      console.error('Error creating user credential:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error'
      });
    }
  });
  
  // DELETE - Remover credencial de usuário
  app.delete('/api/user-credentials/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({ 
          success: false,
          message: 'Valid user ID is required' 
        });
      }
      
      // Verificar se o usuário existe
      const userId = parseInt(id);
      const existingUser = await db.select()
        .from(userCredentials)
        .where(eq(userCredentials.id, userId))
        .limit(1);
      
      if (existingUser.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Remover usuário
      await db.delete(userCredentials)
        .where(eq(userCredentials.id, userId));
      
      res.json({ 
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting user credential:', error);
      res.status(500).json({ 
        success: false,
        message: 'Server error'
      });
    }
  });

  // API endpoints para estatísticas de dígitos
  
  // GET - Obter estatísticas para um símbolo específico
  app.get('/api/db/digit-stats', async (req, res) => {
    try {
      const { symbol } = req.query;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ 
          message: 'Symbol parameter is required' 
        });
      }
      
      // Buscar estatísticas do banco de dados
      const stats = await db.select()
        .from(digitStats)
        .where(eq(digitStats.symbol, symbol));
      
      res.json({ 
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error retrieving digit statistics:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // PUT - Atualizar estatísticas para um símbolo específico
  app.put('/api/db/digit-stats/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { stats } = req.body;
      
      if (!stats || !Array.isArray(stats)) {
        return res.status(400).json({ 
          message: 'Invalid statistics data' 
        });
      }
      
      // Atualizar estatísticas no banco de dados
      for (const stat of stats) {
        const { digit, count, percentage } = stat;
        
        // Verificar se o registro já existe
        const existingRecord = await db.select()
          .from(digitStats)
          .where(and(
            eq(digitStats.symbol, symbol),
            eq(digitStats.digit, digit)
          ))
          .limit(1);
        
        if (existingRecord.length > 0) {
          // Atualizar registro existente
          await db.update(digitStats)
            .set({
              count,
              percentage,
              updated_at: new Date()
            })
            .where(and(
              eq(digitStats.symbol, symbol),
              eq(digitStats.digit, digit)
            ));
        } else {
          // Inserir novo registro
          await db.insert(digitStats).values({
            symbol,
            digit,
            count,
            percentage
          });
        }
      }
      
      res.json({ 
        success: true,
        message: 'Statistics updated successfully'
      });
    } catch (error) {
      console.error('Error updating digit statistics:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // GET - Obter histórico de dígitos para um símbolo específico
  app.get('/api/db/digit-history', async (req, res) => {
    try {
      const { symbol } = req.query;
      
      if (!symbol || typeof symbol !== 'string') {
        return res.status(400).json({ 
          message: 'Symbol parameter is required' 
        });
      }
      
      // Buscar histórico de dígitos do banco de dados
      const history = await db.select()
        .from(digitHistory)
        .where(eq(digitHistory.symbol, symbol))
        .limit(1);
      
      if (history.length === 0) {
        return res.json({ 
          success: true,
          data: null
        });
      }
      
      res.json({ 
        success: true,
        data: history[0]
      });
    } catch (error) {
      console.error('Error retrieving digit history:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // PUT - Atualizar histórico de dígitos para um símbolo específico
  app.put('/api/db/digit-history/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const { digits, total_count } = req.body;
      
      if (!digits || !Array.isArray(digits)) {
        return res.status(400).json({ 
          message: 'Invalid history data' 
        });
      }
      
      // Verificar se o registro já existe
      const existingRecord = await db.select()
        .from(digitHistory)
        .where(eq(digitHistory.symbol, symbol))
        .limit(1);
      
      if (existingRecord.length > 0) {
        // Atualizar registro existente
        await db.update(digitHistory)
          .set({
            digits,
            total_count,
            updated_at: new Date()
          })
          .where(eq(digitHistory.symbol, symbol));
      } else {
        // Inserir novo registro
        await db.insert(digitHistory).values({
          symbol,
          digits,
          total_count
        });
      }
      
      res.json({ 
        success: true,
        message: 'History updated successfully'
      });
    } catch (error) {
      console.error('Error updating digit history:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // GET - Obter estatísticas por período para um símbolo específico
  app.get('/api/db/digit-stats-period', async (req, res) => {
    try {
      const { symbol, period } = req.query;
      
      if (!symbol || typeof symbol !== 'string' || !period || typeof period !== 'string') {
        return res.status(400).json({ 
          message: 'Symbol and period parameters are required' 
        });
      }
      
      // Buscar estatísticas do banco de dados
      const stats = await db.select()
        .from(digitStatsByPeriod)
        .where(and(
          eq(digitStatsByPeriod.symbol, symbol),
          eq(digitStatsByPeriod.period, period)
        ))
        .limit(1);
      
      if (stats.length === 0) {
        return res.json({ 
          success: true,
          data: null
        });
      }
      
      res.json({ 
        success: true,
        data: stats[0]
      });
    } catch (error) {
      console.error('Error retrieving period statistics:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // API endpoint para armazenar ticks no banco de dados
  app.post('/api/market/ticks', async (req, res) => {
    try {
      const { symbol, ticks } = req.body;
      
      if (!symbol || !ticks || !Array.isArray(ticks) || ticks.length === 0) {
        return res.status(400).json({ 
          success: false,
          message: 'Dados inválidos. Necessário fornecer símbolo e array de ticks.' 
        });
      }
      
      // Converter os ticks para o formato do banco de dados
      const ticksToStore = ticks.map(tick => {
        // Identificar qual propriedade contém o valor do tick
        let tickValue = null;
        if (tick.value !== undefined) tickValue = tick.value;
        else if (tick.tick_value !== undefined) tickValue = tick.tick_value;
        else if (tick.price !== undefined) tickValue = tick.price;
        else if (tick.quote !== undefined) tickValue = tick.quote;
        
        // Verificar se o valor do tick foi encontrado
        if (tickValue === null) {
          console.warn('[API] Tick com formato inválido:', tick);
          return null;
        }
        
        // Verificar se já temos o last_digit ou se precisamos extrair do valor
        let lastDigit;
        if (tick.last_digit !== undefined) {
          lastDigit = parseInt(tick.last_digit);
        } else {
          const tickValueStr = tickValue.toString();
          lastDigit = parseInt(tickValueStr.charAt(tickValueStr.length - 1));
        }
        
        return {
          symbol,
          tick_value: parseFloat(tickValue),
          last_digit: lastDigit
        };
      }).filter(tick => tick !== null);
      
      // Armazenar ticks no banco de dados
      await ticksRepository.storeMultipleTicks(ticksToStore);
      
      // Executar limpeza em segundo plano para limitar o tamanho do banco
      setTimeout(() => {
        ticksRepository.cleanupOldTicks(symbol, 1000)
          .catch(err => console.error(`[API] Erro na limpeza de ticks antigos: ${err}`));
      }, 100);
      
      res.json({
        success: true,
        message: `${ticksToStore.length} ticks armazenados com sucesso para ${symbol}`
      });
    } catch (error) {
      console.error('[API] Erro ao armazenar ticks:', error);
      res.status(500).json({ success: false, message: 'Erro ao processar requisição' });
    }
  });
  
  // API endpoint para buscar ticks do banco de dados
  app.get('/api/market/ticks/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const limit = parseInt(req.query.limit as string) || 500;
      
      if (!symbol) {
        return res.status(400).json({
          success: false,
          message: 'Símbolo é obrigatório'
        });
      }
      
      // Buscar ticks do banco de dados
      const ticks = await ticksRepository.getLastTicks(symbol, limit);
      
      // Calcular estatísticas de dígitos
      const digitCounts: Record<number, number> = {};
      const lastDigits: number[] = [];
      
      // Inicializar contadores
      for (let i = 0; i <= 9; i++) {
        digitCounts[i] = 0;
      }
      
      // Processar ticks para extrair dígitos e contar ocorrências
      ticks.forEach(tick => {
        const lastDigit = tick.last_digit;
        digitCounts[lastDigit]++;
        lastDigits.push(lastDigit);
      });
      
      // Calcular percentagens
      const digitStats: Record<number, { count: number, percentage: number }> = {};
      const totalTicks = ticks.length;
      
      Object.keys(digitCounts).forEach(digit => {
        const count = digitCounts[Number(digit)];
        digitStats[Number(digit)] = {
          count,
          percentage: totalTicks > 0 ? Math.round((count / totalTicks) * 100) : 0
        };
      });
      
      res.json({
        success: true,
        data: {
          symbol,
          ticks: ticks.map(tick => ({
            value: tick.tick_value,
            timestamp: tick.timestamp,
            lastDigit: tick.last_digit
          })),
          lastDigits: lastDigits.reverse(), // Reverter para ter os mais recentes primeiro
          digitStats,
          totalCount: totalTicks,
          lastUpdated: ticks.length > 0 ? ticks[0].timestamp : new Date()
        }
      });
    } catch (error) {
      console.error('[API] Erro ao buscar ticks:', error);
      res.status(500).json({ success: false, message: 'Erro ao processar requisição' });
    }
  });

  // API endpoint para buscar histórico completo de ticks para inicialização
  app.get('/api/market/ticks-history/:symbol', async (req, res) => {
    try {
      const { symbol } = req.params;
      const count = parseInt(req.query.count as string) || 500;
      
      // Primeiro tentar buscar do banco de ticks
      try {
        const ticks = await ticksRepository.getLastTicks(symbol, count);
        
        // Se temos ticks no banco, processar e retornar
        if (ticks.length > 0) {
          console.log(`[API] Encontrados ${ticks.length} ticks no banco de dados para ${symbol}`);
          
          // Calcular estatísticas de dígitos
          const digitCounts: Record<number, number> = {};
          const lastDigits: number[] = [];
          
          // Inicializar contadores
          for (let i = 0; i <= 9; i++) {
            digitCounts[i] = 0;
          }
          
          // Processar ticks para extrair dígitos e contar ocorrências
          ticks.forEach(tick => {
            const lastDigit = tick.last_digit;
            digitCounts[lastDigit]++;
            lastDigits.push(lastDigit);
          });
          
          // Calcular percentagens
          const digitStats: Record<number, { count: number, percentage: number }> = {};
          const totalTicks = ticks.length;
          
          Object.keys(digitCounts).forEach(digit => {
            const count = digitCounts[Number(digit)];
            digitStats[Number(digit)] = {
              count,
              percentage: totalTicks > 0 ? Math.round((count / totalTicks) * 100) : 0
            };
          });
          
          return res.json({
            success: true,
            data: {
              lastDigits: lastDigits.reverse(), // Reverter para ter os mais recentes primeiro
              digitStats,
              lastUpdated: new Date(),
              totalTicks: ticks.length
            }
          });
        }
      } catch (ticksDbError) {
        console.error('[API] Erro ao buscar ticks do banco:', ticksDbError);
      }
      
      // Se não encontrou no banco de ticks, tentar buscar do histórico de dígitos
      try {
        // Verificar histórico de dígitos
        const history = await db.select()
          .from(digitHistory)
          .where(eq(digitHistory.symbol, symbol))
          .limit(1);
        
        // Verificar estatísticas de dígitos
        const stats = await db.select()
          .from(digitStats)
          .where(eq(digitStats.symbol, symbol));
        
        // Se temos dados no banco, retornar eles
        if (history.length > 0 && stats.length > 0) {
          // Formatar estatísticas no formato esperado
          const digitStatsObj: Record<number, { count: number, percentage: number }> = {};
          
          for (const stat of stats) {
            digitStatsObj[stat.digit] = {
              count: stat.count,
              percentage: stat.percentage
            };
          }
          
          return res.json({
            success: true,
            data: {
              lastDigits: history[0].digits,
              digitStats: digitStatsObj,
              lastUpdated: history[0].updated_at,
              totalTicks: history[0].total_count
            }
          });
        }
      } catch (dbError) {
        console.error('Error retrieving from database:', dbError);
        // Continuar para buscar da API Deriv
      }
      
      // Se não encontrou no banco, iniciar com objeto vazio
      const result = {
        lastDigits: [] as number[],
        digitStats: {} as Record<number, { count: number, percentage: number }>,
        lastUpdated: new Date(),
        totalTicks: 0
      };
      
      // Inicializar estatísticas zeradas
      for (let i = 0; i < 10; i++) {
        result.digitStats[i] = { count: 0, percentage: 0 };
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error retrieving ticks history:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  return httpServer;
}

// Helper function to handle different subscription types
function handleSubscription(ws: WebSocket, data: any) {
  const { channel, params } = data;
  
  if (channel === 'ticks') {
    // Start sending tick data for the requested symbol
    sendTickData(ws, params.symbol);
  }
  else if (channel === 'ohlc') {
    // Send OHLC data for the requested symbol and timeframe
    sendOHLCData(ws, params.symbol, params.timeframe);
  }
}

// Helper function to generate mock market statistics
function generateMarketStats(symbol: string) {
  return {
    symbol,
    last_price: (Math.random() * 10000).toFixed(2),
    high: (Math.random() * 10000 + 500).toFixed(2),
    low: (Math.random() * 10000 - 500).toFixed(2),
    volume: Math.floor(Math.random() * 100000),
    timestamp: Date.now(),
    digits: [
      { digit: 0, percentage: Math.floor(Math.random() * 20) },
      { digit: 1, percentage: Math.floor(Math.random() * 20) },
      { digit: 2, percentage: Math.floor(Math.random() * 20) },
      { digit: 3, percentage: Math.floor(Math.random() * 20) },
      { digit: 4, percentage: Math.floor(Math.random() * 20) },
      { digit: 5, percentage: Math.floor(Math.random() * 20) },
      { digit: 6, percentage: Math.floor(Math.random() * 20) },
      { digit: 7, percentage: Math.floor(Math.random() * 20) },
      { digit: 8, percentage: Math.floor(Math.random() * 20) },
      { digit: 9, percentage: Math.floor(Math.random() * 20) },
    ]
  };
}

// Helper function to send tick data periodically
function sendTickData(ws: WebSocket, symbol: string) {
  // Only send data if the connection is open
  if (ws.readyState === WebSocket.OPEN) {
    // Generate random tick data
    const tick = {
      type: 'tick',
      symbol,
      quote: parseFloat((Math.random() * 10000).toFixed(2)),
      epoch: Math.floor(Date.now() / 1000)
    };
    
    ws.send(JSON.stringify(tick));
    
    // Schedule next tick update
    setTimeout(() => sendTickData(ws, symbol), 1000);
  }
}

// Helper function to send OHLC data
function sendOHLCData(ws: WebSocket, symbol: string, timeframe: string) {
  // Only send data if the connection is open
  if (ws.readyState === WebSocket.OPEN) {
    // Generate random OHLC data
    const basePrice = Math.random() * 10000;
    const open = basePrice;
    const high = basePrice * (1 + Math.random() * 0.01);
    const low = basePrice * (1 - Math.random() * 0.01);
    const close = basePrice * (1 + (Math.random() * 0.02 - 0.01));
    
    const ohlc = {
      type: 'ohlc',
      symbol,
      timeframe,
      open,
      high,
      low,
      close,
      timestamp: Date.now()
    };
    
    ws.send(JSON.stringify(ohlc));
    
    // For longer timeframes, send less frequently
    let interval = 1000;
    if (timeframe === '1m') interval = 5000;
    if (timeframe === '5m') interval = 10000;
    if (timeframe === '15m') interval = 15000;
    
    // Schedule next OHLC update
    setTimeout(() => sendOHLCData(ws, symbol, timeframe), interval);
  }
}
