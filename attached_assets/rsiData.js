/**
 * Serviço para obtenção de dados RSI da API Deriv
 */

const WebSocket = require('ws');

// Classe para gerenciar dados RSI
class RSIDataManager {
  constructor() {
    this.ws = null;
    this.rsiData = {
      values: [],
      lastUpdated: null,
      isLoading: false,
      symbol: 'R_100',
      period: 14,
      digitStats: {
        0: { count: 0, percentage: 0 },
        1: { count: 0, percentage: 0 },
        2: { count: 0, percentage: 0 },
        3: { count: 0, percentage: 0 },
        4: { count: 0, percentage: 0 },
        5: { count: 0, percentage: 0 },
        6: { count: 0, percentage: 0 },
        7: { count: 0, percentage: 0 },
        8: { count: 0, percentage: 0 },
        9: { count: 0, percentage: 0 }
      },
      lastDigits: [],
      volatilityIndex: 0
    };
    this.ticksHistoryData = [];
    this.subscribers = [];
    this.reconnectInterval = null;
    this.apiToken = process.env.DERIV_API_TOKEN;
    this.appId = 1089; // ID de aplicativo do lado do servidor
  }

  // Inicia o serviço
  start() {
    console.log('Iniciando serviço de dados RSI...');
    this.connect();
    
    // Configurar reconexão automática
    this.reconnectInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.log('Tentando reconectar ao serviço WebSocket da Deriv...');
        this.connect();
      }
    }, 30000); // Tentar reconectar a cada 30 segundos
  }

  // Estabelece a conexão com a API Deriv
  connect() {
    // Fechar conexão anterior se existir
    if (this.ws) {
      this.ws.terminate();
    }

    this.rsiData.isLoading = true;
    this.notifySubscribers();

    // Criar nova conexão
    this.ws = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

    this.ws.onopen = () => {
      console.log('Conexão WebSocket com Deriv estabelecida');
      
      // Autenticar com token API
      // Retiramos o uso de token para evitar erros de autenticação,
      // e usamos diretamente as operações públicas da API
      this.subscribeToTicks();
    };

    this.ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      
      // Não verificamos mais resposta de autorização pois estamos usando dados públicos
      
      // Lidar com histórico de ticks
      if (data.msg_type === 'history' && data.req_id === 2) {
        this.processTicksHistory(data);
      }
      
      // Lidar com atualizações de ticks
      if (data.msg_type === 'tick' && data.req_id === 3) {
        this.processNewTick(data);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Erro WebSocket:', error);
      this.rsiData.isLoading = false;
      this.notifySubscribers();
    };

    this.ws.onclose = (event) => {
      console.log(`Conexão WebSocket fechada: ${event.code} - ${event.reason}`);
      this.rsiData.isLoading = false;
      this.notifySubscribers();
    };
  }

  // Inscreve-se para receber atualizações de ticks
  subscribeToTicks() {
    // Primeiro, solicitar histórico de ticks
    const ticksHistoryRequest = {
      ticks_history: this.rsiData.symbol,
      adjust_start_time: 1,
      count: 5000, // Quantidade suficiente para cálculo significativo de RSI
      end: "latest",
      start: 1,
      style: "ticks",
      req_id: 2
    };
    
    this.ws.send(JSON.stringify(ticksHistoryRequest));
    
    // Em seguida, inscrever-se para atualizações de ticks
    const ticksSubscriptionRequest = {
      ticks: this.rsiData.symbol,
      subscribe: 1,
      req_id: 3
    };
    
    this.ws.send(JSON.stringify(ticksSubscriptionRequest));
  }

  // Processa o histórico de ticks recebido
  processTicksHistory(data) {
    if (!data.history || !data.history.prices) {
      console.error('Dados de histórico de ticks inválidos:', data);
      return;
    }
    
    this.ticksHistoryData = data.history.prices.map((price, index) => ({
      price: parseFloat(price),
      time: data.history.times[index] * 1000 // Converter para milissegundos
    }));
    
    // Calcular RSI inicial
    this.calculateRSI();
    
    // Processar dígitos do histórico
    this.processDigitStats();
    
    this.rsiData.isLoading = false;
    this.rsiData.lastUpdated = new Date();
    
    this.notifySubscribers();
    console.log('Dados RSI iniciais calculados com sucesso');
  }

  // Processa um novo tick recebido
  processNewTick(data) {
    if (!data.tick || !data.tick.quote) {
      console.error('Dados de tick inválidos:', data);
      return;
    }
    
    const newTick = {
      price: parseFloat(data.tick.quote),
      time: data.tick.epoch * 1000 // Converter para milissegundos
    };
    
    // Adicionar novo tick ao histórico
    this.ticksHistoryData.push(newTick);
    
    // Manter apenas os últimos 5000 ticks para performance
    if (this.ticksHistoryData.length > 5000) {
      this.ticksHistoryData.shift();
    }
    
    // Recalcular RSI com o novo tick
    this.calculateRSI();
    
    // Atualizar stats de dígitos
    this.updateDigitStats(newTick.price);
    
    this.rsiData.lastUpdated = new Date();
    
    this.notifySubscribers();
  }

  // Calcula o RSI com base nos dados históricos
  calculateRSI() {
    const period = this.rsiData.period;
    const prices = this.ticksHistoryData.map(tick => tick.price);
    
    if (prices.length < period + 1) {
      console.log('Dados insuficientes para cálculo de RSI');
      return;
    }
    
    // Calcular mudanças nos preços
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }
    
    // Calcular RSI para cada ponto usando o período especificado
    const rsiValues = [];
    
    for (let i = period; i < changes.length; i++) {
      const windowChanges = changes.slice(i - period, i);
      
      let gains = 0;
      let losses = 0;
      
      windowChanges.forEach(change => {
        if (change > 0) {
          gains += change;
        } else {
          losses -= change; // Tornar positivo para cálculo
        }
      });
      
      // Médias de ganhos e perdas
      const avgGain = gains / period;
      const avgLoss = losses / period;
      
      // Calcula RS e RSI
      if (avgLoss === 0) {
        rsiValues.push(100); // RS é infinito, RSI é 100
      } else {
        const rs = avgGain / avgLoss;
        const rsi = 100 - (100 / (1 + rs));
        rsiValues.push(rsi);
      }
    }
    
    // Calcular volatilidade
    const recentValues = rsiValues.slice(-20); // Últimos 20 valores
    if (recentValues.length > 0) {
      const mean = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;
      const squaredDiffs = recentValues.map(val => Math.pow(val - mean, 2));
      const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / recentValues.length;
      this.rsiData.volatilityIndex = Math.sqrt(variance);
    }
    
    // Armazenar os resultados
    this.rsiData.values = rsiValues.slice(-100); // Manter apenas os últimos 100 valores
  }

  // Processa estatísticas de dígitos a partir do histórico
  processDigitStats() {
    // Resetar contagens
    for (let i = 0; i < 10; i++) {
      this.rsiData.digitStats[i] = { count: 0, percentage: 0 };
    }
    
    // Contar ocorrências de cada dígito
    const lastDigits = [];
    this.ticksHistoryData.forEach(tick => {
      const price = tick.price.toFixed(2);
      const lastDigit = parseInt(price.charAt(price.length - 1));
      
      if (!isNaN(lastDigit)) {
        this.rsiData.digitStats[lastDigit].count++;
        lastDigits.push(lastDigit);
      }
    });
    
    // Manter apenas os últimos 10 dígitos
    this.rsiData.lastDigits = lastDigits.slice(-10);
    
    // Calcular percentagens
    const total = this.rsiData.lastDigits.length;
    if (total > 0) {
      for (let i = 0; i < 10; i++) {
        this.rsiData.digitStats[i].percentage = 
          (this.rsiData.digitStats[i].count / total) * 100;
      }
    }
  }

  // Atualiza as estatísticas de dígitos com um novo preço
  updateDigitStats(price) {
    const priceStr = price.toFixed(2);
    const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));
    
    if (!isNaN(lastDigit)) {
      this.rsiData.digitStats[lastDigit].count++;
      
      // Adicionar à lista de últimos dígitos - apenas um dígito por vez
      this.rsiData.lastDigits.push(lastDigit);
      
      // Manter apenas os últimos 10 dígitos conforme solicitado
      if (this.rsiData.lastDigits.length > 10) {
        this.rsiData.lastDigits.shift();
      }
      
      // Recalcular percentagens baseadas nos últimos 100 dígitos (ou menos, se não houver 100 ainda)
      const last100Digits = this.rsiData.lastDigits.slice(-100);
      const total = last100Digits.length;
      
      for (let i = 0; i < 10; i++) {
        // Contar ocorrências no array de últimos dígitos para maior precisão
        const countInLast100 = last100Digits.filter(d => d === i).length;
        this.rsiData.digitStats[i] = {
          count: this.rsiData.digitStats[i].count,
          percentage: (countInLast100 / total) * 100
        };
      }
      
      // Enviar atualização para todos os assinantes a cada novo dígito
      this.notifySubscribers();
      
      // Transmitir novo dígito via WebSocket em tempo real para todos os clientes
      if (global.broadcastNewDigit) {
        global.broadcastNewDigit(lastDigit);
      }
      
      // Registrar no console quando um novo dígito é recebido
      console.log(`Novo dígito recebido: ${lastDigit} (Total: ${this.rsiData.lastDigits.length})`);
    }
  }

  // Adiciona um assinante para receber atualizações
  subscribe(callback) {
    this.subscribers.push(callback);
    // Envia imediatamente os dados atuais para o novo assinante
    callback(this.getData());
    return () => this.unsubscribe(callback);
  }

  // Remove um assinante
  unsubscribe(callback) {
    this.subscribers = this.subscribers.filter(cb => cb !== callback);
  }

  // Notifica todos os assinantes sobre mudanças nos dados
  notifySubscribers() {
    const data = this.getData();
    this.subscribers.forEach(callback => callback(data));
  }

  // Retorna os dados atuais
  getData() {
    return { ...this.rsiData };
  }

  // Para o serviço
  stop() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('Serviço de dados RSI parado');
  }
}

// Exportar uma instância única
const rsiDataManager = new RSIDataManager();

module.exports = rsiDataManager;