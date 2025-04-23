import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

// Tipos
export type ContractType = 'DIGITOVER' | 'DIGITUNDER' | 'DIGITEVEN' | 'DIGITODD' | 'CALL' | 'PUT' | string;

interface AuthorizeResponse {
  authorize: {
    loginid: string;
    email: string;
    currency: string;
    balance: number;
    fullname: string;
    landing_company_name: string;
    is_virtual: boolean;
  };
}

interface TickResponse {
  tick: {
    id: string;
    quote: number;
    symbol: string;
    epoch: number;
    pip_size: number;
  };
}

interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    loginid: string;
  };
}

interface ActiveSymbolResponse {
  active_symbols: Array<{
    symbol: string;
    display_name: string;
    market: string;
    market_display_name: string;
    pip: number;
    submarket: string;
    submarket_display_name: string;
  }>;
}

interface ContractProposalResponse {
  proposal: {
    id: string;
    longcode: string;
    spot: number;
    spot_time: number;
    ask_price: number;
    display_value: number;
    payout: number;
    date_start: number;
    date_expiry: number;
  };
}

interface BuyContractResponse {
  buy: {
    balance_after: number;
    longcode: string;
    contract_id: number;
    start_time: number;
    transaction_id: number;
    buy_price: number;
    purchase_time: number;
  };
}

interface ContractUpdateResponse {
  proposal_open_contract: {
    contract_id: number;
    longcode: string;
    entry_spot: number;
    entry_tick_time: number;
    status: string;
    is_sold: number;
    profit: number;
    profit_percentage: number;
    exit_tick: number;
    exit_tick_time: number;
    sell_price: number;
    sell_time: number;
    current_spot: number;
    current_spot_time: number;
    barrier?: string;
    display_name: string;
    underlying: string;
    buy_price: number;
    payout: number;
    contract_type: string;
  };
}

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

interface RunStrategyOptions {
  symbol: string;
  strategy: string;
  initialStake?: number;
  targetProfit?: number;
  stopLoss?: number;
  maxOperations?: number;
  entryPercentageThreshold?: number;
  minimumAnalysisVolume?: number;
}

interface SymbolHistory {
  times: number[];
  prices: number[];
  digits?: number[];
}

interface DigitStats {
  [key: number]: {
    count: number;
    percentage: number;
  };
}

// Classe que gerencia a conexão direta com a API da Deriv via OAuth
class OAuthDirectService {
  private webSocket: WebSocket | null = null;
  private apiUrl: string = 'wss://ws.derivws.com/websockets/v3';
  private appId: string = '33666'; // App ID oficial da Deriv
  private authorized: any = null;
  private requestQueue: Array<{ request: any, resolve: Function, reject: Function }> = [];
  private requestMap: Map<string, { resolve: Function, reject: Function }> = new Map();
  private openContracts: Map<number, any> = new Map();
  private isProcessing: boolean = false;
  private messageListeners: Map<string, Array<(data: any) => void>> = new Map();
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private tickListeners: Map<string, Array<(data: any) => void>> = new Map();
  private contractUpdateListeners: Array<(data: any) => void> = [];
  private activeSymbols: any[] = [];
  private symbolHistory: Map<string, SymbolHistory> = new Map();
  private runningStrategies: Map<string, boolean> = new Map();
  private availableStrategies: Map<string, { path: string, xml: string | null }> = new Map();
  private operationHistory: any[] = [];
  private strategyConfigs: Map<string, any> = new Map();
  private lastTick: Map<string, any> = new Map();
  private digitStats: Map<string, DigitStats> = new Map();
  private loadingStrategies: boolean = false;
  
  constructor() {
    // Inicializar estratégias disponíveis
    this.availableStrategies.set('advance', { path: '/attached_assets/Advance.xml', xml: null });
    this.availableStrategies.set('maxpro', { path: '/attached_assets/MAXPRO.xml', xml: null });
    this.availableStrategies.set('bot_low', { path: '/attached_assets/BOT LOW.xml', xml: null });
    this.availableStrategies.set('iron_over', { path: '/attached_assets/IRON OVER.xml', xml: null });
    this.availableStrategies.set('iron_under', { path: '/attached_assets/IRON UNDER.xml', xml: null });
    this.availableStrategies.set('manual_over', { path: '/attached_assets/Manual Over.xml', xml: null });
    this.availableStrategies.set('manual_under', { path: '/attached_assets/Manual Under.xml', xml: null });
    
    // Pré-configurar valores para cada estratégia
    this.strategyConfigs.set('advance', {
      symbol: 'R_100',
      contractType: 'DIGITOVER',
      prediction: 1,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
      entryPercentageThreshold: 40,
      minimumAnalysisVolume: 25,
    });
    
    this.strategyConfigs.set('maxpro', {
      symbol: 'R_100',
      contractType: 'DIGITOVER',
      prediction: 4,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
    });
    
    this.strategyConfigs.set('bot_low', {
      symbol: 'R_100',
      contractType: 'DIGITUNDER',
      prediction: 5,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
    });
    
    this.strategyConfigs.set('iron_over', {
      symbol: 'R_75',
      contractType: 'DIGITOVER',
      prediction: 4,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
    });
    
    this.strategyConfigs.set('iron_under', {
      symbol: 'R_75',
      contractType: 'DIGITUNDER',
      prediction: 5,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
    });
    
    this.strategyConfigs.set('manual_over', {
      symbol: 'R_100',
      contractType: 'DIGITOVER',
      prediction: 4,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
    });
    
    this.strategyConfigs.set('manual_under', {
      symbol: 'R_100',
      contractType: 'DIGITUNDER',
      prediction: 5,
      duration: 1,
      durationUnit: 't',
      basisType: 'stake',
      basisValue: 1,
    });
    
    // Iniciar carregamento das estratégias
    this.loadStrategies();
  }
  
  // Carregar todas as estratégias XML
  private async loadStrategies() {
    if (this.loadingStrategies) return;
    this.loadingStrategies = true;
    
    try {
      const promises = Array.from(this.availableStrategies.entries()).map(async ([key, strategy]) => {
        try {
          const response = await fetch(strategy.path);
          const xml = await response.text();
          this.availableStrategies.set(key, { ...strategy, xml });
          console.log(`Estratégia ${key} carregada com sucesso`);
        } catch (error) {
          console.error(`Erro ao carregar estratégia ${key}:`, error);
        }
      });
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Erro ao carregar estratégias:', error);
    } finally {
      this.loadingStrategies = false;
    }
  }
  
  // Conectar ao WebSocket da Deriv
  async connect() {
    return new Promise<void>((resolve, reject) => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        console.log('WebSocket já está conectado');
        resolve();
        return;
      }
      
      try {
        this.webSocket = new WebSocket(this.apiUrl);
        
        this.webSocket.onopen = () => {
          console.log('WebSocket conectado com sucesso');
          this.startPingInterval();
          resolve();
        };
        
        this.webSocket.onmessage = (message) => {
          this.handleMessage(message);
        };
        
        this.webSocket.onerror = (error) => {
          console.error('Erro na conexão WebSocket:', error);
          reject(new Error('Falha na conexão com o servidor Deriv'));
        };
        
        this.webSocket.onclose = () => {
          console.log('Conexão WebSocket fechada');
          this.clearPingInterval();
          this.attemptReconnect();
        };
      } catch (error) {
        console.error('Erro ao inicializar WebSocket:', error);
        reject(error);
      }
    });
  }
  
  // Desconectar do WebSocket
  async disconnect() {
    return new Promise<void>((resolve) => {
      if (this.webSocket) {
        this.clearPingInterval();
        this.clearReconnectTimer();
        
        // Encerrar todas as assinaturas ativas
        this.unsubscribeAllTicks();
        
        if (this.webSocket.readyState === WebSocket.OPEN) {
          this.webSocket.close();
        }
        
        this.webSocket = null;
        this.authorized = null;
        this.requestQueue = [];
        this.requestMap.clear();
        this.openContracts.clear();
        this.messageListeners.clear();
        this.tickListeners.clear();
        this.contractUpdateListeners = [];
        
        console.log('Desconectado da API Deriv');
      }
      
      resolve();
    });
  }
  
  // Reconectar automaticamente
  private attemptReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.reconnectTimer = setTimeout(async () => {
      console.log('Tentando reconectar...');
      try {
        await this.connect();
        
        // Tentar reautorizar se havia uma autorização anterior
        if (this.authorized) {
          const token = localStorage.getItem('deriv_token');
          if (token) {
            try {
              await this.authorizeAccount(token);
              console.log('Reautorizado com sucesso');
            } catch (error) {
              console.error('Falha ao reautorizar:', error);
              localStorage.removeItem('deriv_token');
            }
          }
        }
      } catch (error) {
        console.error('Falha ao reconectar:', error);
        // Tentar novamente em 5 segundos
        this.attemptReconnect();
      }
    }, 5000);
  }
  
  // Limpar o timer de reconexão
  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  // Iniciar ping periódico para manter a conexão ativa
  private startPingInterval() {
    this.clearPingInterval();
    this.pingTimer = setInterval(() => {
      this.ping().catch(error => {
        console.error('Erro ao enviar ping:', error);
      });
    }, 30000); // Ping a cada 30 segundos
  }
  
  // Limpar o timer de ping
  private clearPingInterval() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
  
  // Enviar ping para manter a conexão ativa
  async ping() {
    return this.send({ ping: 1 });
  }
  
  // Processar mensagens recebidas do WebSocket
  private handleMessage(message: MessageEvent) {
    try {
      const data = JSON.parse(message.data);
      
      // Verificar se é uma resposta a uma requisição pendente
      if (data.req_id && this.requestMap.has(data.req_id)) {
        const { resolve, reject } = this.requestMap.get(data.req_id)!;
        
        if (data.error) {
          reject(data.error);
        } else {
          resolve(data);
        }
        
        this.requestMap.delete(data.req_id);
        this.processQueue();
        return;
      }
      
      // Verificar se é uma atualização de tick
      if (data.tick) {
        const symbol = data.tick.symbol;
        this.lastTick.set(symbol, data.tick);
        
        // Atualizar histórico do símbolo
        if (!this.symbolHistory.has(symbol)) {
          this.symbolHistory.set(symbol, { times: [], prices: [], digits: [] });
        }
        
        const history = this.symbolHistory.get(symbol)!;
        history.times.push(data.tick.epoch);
        history.prices.push(data.tick.quote);
        
        // Extrair o último dígito
        const lastDigit = Math.floor(data.tick.quote * Math.pow(10, data.tick.pip_size)) % 10;
        if (!history.digits) history.digits = [];
        history.digits.push(lastDigit);
        
        // Manter apenas os últimos 1000 ticks
        if (history.times.length > 1000) {
          history.times.shift();
          history.prices.shift();
          history.digits.shift();
        }
        
        // Atualizar estatísticas de dígitos
        this.updateDigitStats(symbol, history);
        
        // Notificar os ouvintes do tick
        if (this.tickListeners.has(symbol)) {
          const listeners = this.tickListeners.get(symbol)!;
          listeners.forEach(listener => listener(data));
        }
        
        return;
      }
      
      // Verificar se é uma atualização de contrato
      if (data.proposal_open_contract) {
        const contract = data.proposal_open_contract;
        this.openContracts.set(contract.contract_id, contract);
        
        // Notificar ouvintes de atualização de contrato
        this.contractUpdateListeners.forEach(listener => listener(contract));
        
        // Verificar se o contrato foi concluído
        if (contract.is_sold === 1) {
          // Atualizar histórico de operações
          this.updateOperationHistory(contract);
        }
        
        return;
      }
      
      // Processar outros tipos de mensagens (balance, etc)
      
      // Notificar ouvintes específicos por tipo de mensagem
      for (const [msgType, listeners] of this.messageListeners.entries()) {
        if (data[msgType]) {
          listeners.forEach(listener => listener(data));
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
    }
  }
  
  // Enviar uma requisição para o WebSocket
  private async send(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket não está conectado'));
        return;
      }
      
      // Adicionar à fila se já estiver processando uma requisição
      if (this.isProcessing) {
        this.requestQueue.push({ request, resolve, reject });
        return;
      }
      
      this.isProcessing = true;
      
      // Gerar um ID único para a requisição
      const reqId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      request.req_id = reqId;
      
      // Registrar a promessa no mapa de requisições
      this.requestMap.set(reqId, { resolve, reject });
      
      try {
        this.webSocket.send(JSON.stringify(request));
      } catch (error) {
        this.requestMap.delete(reqId);
        this.isProcessing = false;
        reject(error);
      }
      
      // Timeout de 60 segundos para a resposta
      setTimeout(() => {
        if (this.requestMap.has(reqId)) {
          const { reject } = this.requestMap.get(reqId)!;
          reject(new Error('Timeout na resposta da API'));
          this.requestMap.delete(reqId);
          this.isProcessing = false;
          this.processQueue();
        }
      }, 60000);
    });
  }
  
  // Processar a próxima requisição na fila
  private processQueue() {
    if (this.requestQueue.length === 0) {
      this.isProcessing = false;
      return;
    }
    
    const { request, resolve, reject } = this.requestQueue.shift()!;
    
    this.send(request)
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.isProcessing = false;
        this.processQueue();
      });
  }
  
  // Autorizar a conta com o token
  async authorizeAccount(token: string): Promise<any> {
    try {
      const response = await this.send({
        authorize: token,
      }) as AuthorizeResponse;
      
      this.authorized = response.authorize;
      localStorage.setItem('deriv_token', token);
      
      // Solicitar o saldo após autorização
      this.getBalance();
      
      return this.authorized;
    } catch (error) {
      console.error('Erro ao autorizar:', error);
      throw error;
    }
  }
  
  // Verificar se está autorizado
  isAuthorized(): boolean {
    return !!this.authorized;
  }
  
  // Obter informações da conta autorizada
  getAuthorized(): any {
    return this.authorized;
  }
  
  // Obter saldo da conta
  async getBalance(): Promise<any> {
    try {
      const response = await this.send({
        balance: 1,
        subscribe: 1
      }) as BalanceResponse;
      
      return response.balance;
    } catch (error) {
      console.error('Erro ao obter saldo:', error);
      throw error;
    }
  }
  
  // Obter símbolos ativos
  async getActiveSymbols(): Promise<any[]> {
    try {
      const response = await this.send({
        active_symbols: 'brief',
        product_type: 'basic'
      }) as ActiveSymbolResponse;
      
      this.activeSymbols = response.active_symbols;
      return this.activeSymbols;
    } catch (error) {
      console.error('Erro ao obter símbolos ativos:', error);
      throw error;
    }
  }
  
  // Assinar ticks para um símbolo específico
  subscribeTicks(symbol: string, callback: (data: any) => void): void {
    // Registrar o callback
    if (!this.tickListeners.has(symbol)) {
      this.tickListeners.set(symbol, []);
      
      // Enviar a solicitação de assinatura
      this.send({
        ticks: symbol,
        subscribe: 1
      }).catch(error => {
        console.error(`Erro ao assinar ticks para ${symbol}:`, error);
      });
    }
    
    const listeners = this.tickListeners.get(symbol)!;
    listeners.push(callback);
  }
  
  // Cancelar assinatura de ticks para um símbolo específico
  unsubscribeTicks(symbol: string, callback?: (data: any) => void): void {
    if (!this.tickListeners.has(symbol)) return;
    
    if (callback) {
      // Remover apenas um callback específico
      const listeners = this.tickListeners.get(symbol)!;
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      if (listeners.length === 0) {
        this.tickListeners.delete(symbol);
        this.send({
          forget_all: 'ticks'
        }).catch(error => {
          console.error('Erro ao cancelar assinatura de ticks:', error);
        });
      }
    } else {
      // Remover todos os callbacks para este símbolo
      this.tickListeners.delete(symbol);
      this.send({
        forget_all: 'ticks'
      }).catch(error => {
        console.error('Erro ao cancelar assinatura de ticks:', error);
      });
    }
  }
  
  // Cancelar todas as assinaturas de ticks
  unsubscribeAllTicks(): void {
    this.tickListeners.clear();
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.send({
        forget_all: 'ticks'
      }).catch(error => {
        console.error('Erro ao cancelar todas as assinaturas de ticks:', error);
      });
    }
  }
  
  // Obter histórico de ticks para um símbolo
  async getTickHistory(symbol: string, count: number = 1000): Promise<SymbolHistory> {
    try {
      const response = await this.send({
        ticks_history: symbol,
        count: count,
        end: 'latest',
        style: 'ticks'
      });
      
      const history: SymbolHistory = {
        times: response.history.times,
        prices: response.history.prices,
        digits: []
      };
      
      // Extrair os últimos dígitos
      if (response.pip_size) {
        history.digits = response.history.prices.map((price: number) => {
          return Math.floor(price * Math.pow(10, response.pip_size)) % 10;
        });
      }
      
      // Atualizar o histórico armazenado
      this.symbolHistory.set(symbol, history);
      
      // Atualizar estatísticas de dígitos
      this.updateDigitStats(symbol, history);
      
      return history;
    } catch (error) {
      console.error(`Erro ao obter histórico de ticks para ${symbol}:`, error);
      throw error;
    }
  }
  
  // Atualizar estatísticas de dígitos para um símbolo
  private updateDigitStats(symbol: string, history: SymbolHistory): void {
    if (!history.digits || history.digits.length === 0) return;
    
    const stats: DigitStats = {};
    
    // Inicializar contagem para cada dígito
    for (let i = 0; i <= 9; i++) {
      stats[i] = { count: 0, percentage: 0 };
    }
    
    // Contar ocorrências de cada dígito
    history.digits.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        stats[digit].count++;
      }
    });
    
    // Calcular porcentagens
    const total = history.digits.length;
    for (let i = 0; i <= 9; i++) {
      stats[i].percentage = (stats[i].count / total) * 100;
    }
    
    this.digitStats.set(symbol, stats);
  }
  
  // Obter estatísticas de dígitos para um símbolo
  getDigitStats(symbol: string): DigitStats | undefined {
    return this.digitStats.get(symbol);
  }
  
  // Propor um contrato
  async proposeContract(params: {
    contractType: ContractType;
    symbol: string;
    duration: number;
    durationUnit: string;
    basisType: string;
    basisValue: number;
    barrierValue?: number | string;
    secondBarrierValue?: number | string;
  }): Promise<any> {
    try {
      const request: any = {
        proposal: 1,
        contract_type: params.contractType,
        symbol: params.symbol,
        duration: params.duration,
        duration_unit: params.durationUnit,
        currency: this.authorized ? this.authorized.currency : 'USD',
      };
      
      // Definir o valor base (stake ou payout)
      if (params.basisType === 'stake') {
        request.amount = params.basisValue;
      } else if (params.basisType === 'payout') {
        request.amount_type = 'payout';
        request.amount = params.basisValue;
      }
      
      // Adicionar barreiras se necessário
      if (params.barrierValue !== undefined) {
        request.barrier = params.barrierValue;
      }
      
      if (params.secondBarrierValue !== undefined) {
        request.barrier2 = params.secondBarrierValue;
      }
      
      // Para contratos DIGIT, adicionar o valor de previsão
      if (params.contractType.startsWith('DIGIT')) {
        request.barrier = params.barrierValue;
      }
      
      const response = await this.send(request) as ContractProposalResponse;
      return response.proposal;
    } catch (error) {
      console.error('Erro ao propor contrato:', error);
      throw error;
    }
  }
  
  // Comprar um contrato
  async buyContract(proposalId: string, price: number): Promise<any> {
    try {
      const response = await this.send({
        buy: proposalId,
        price: price
      }) as BuyContractResponse;
      
      // Iniciar monitoramento do contrato comprado
      this.subscribeContractUpdates(response.buy.contract_id);
      
      return response.buy;
    } catch (error) {
      console.error('Erro ao comprar contrato:', error);
      throw error;
    }
  }
  
  // Assinar atualizações de um contrato específico
  async subscribeContractUpdates(contractId: number): Promise<void> {
    try {
      await this.send({
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1
      });
    } catch (error) {
      console.error(`Erro ao assinar atualizações para o contrato ${contractId}:`, error);
      throw error;
    }
  }
  
  // Vender um contrato
  async sellContract(contractId: number): Promise<any> {
    try {
      const response = await this.send({
        sell: contractId,
        price: 0 // Vender ao preço de mercado
      });
      
      return response.sell;
    } catch (error) {
      console.error(`Erro ao vender contrato ${contractId}:`, error);
      throw error;
    }
  }
  
  // Registrar ouvinte para atualizações de contratos
  addContractUpdateListener(listener: (contract: any) => void): void {
    this.contractUpdateListeners.push(listener);
  }
  
  // Remover ouvinte de atualizações de contratos
  removeContractUpdateListener(listener: (contract: any) => void): void {
    const index = this.contractUpdateListeners.indexOf(listener);
    if (index !== -1) {
      this.contractUpdateListeners.splice(index, 1);
    }
  }
  
  // Atualizar histórico de operações
  private updateOperationHistory(contract: any): void {
    const existingIndex = this.operationHistory.findIndex(op => op.contract_id === contract.contract_id);
    
    const operation = {
      id: contract.contract_id,
      contract_id: contract.contract_id,
      entry_value: contract.buy_price,
      exit_value: contract.sell_price,
      profit: contract.profit,
      time: new Date(contract.purchase_time * 1000),
      timestamp: contract.purchase_time,
      contract_type: contract.contract_type,
      symbol: contract.underlying,
      strategy: this.getRunningStrategyName() || 'manual',
      is_win: contract.profit >= 0,
      is_completed: true,
      notification: {
        type: contract.profit >= 0 ? 'success' : 'error',
        message: contract.profit >= 0 
          ? `Ganho de ${contract.profit.toFixed(2)} ${contract.currency}`
          : `Perda de ${Math.abs(contract.profit).toFixed(2)} ${contract.currency}`
      }
    };
    
    if (existingIndex !== -1) {
      this.operationHistory[existingIndex] = operation;
    } else {
      this.operationHistory.push(operation);
    }
    
    // Emitir evento de atualização
    document.dispatchEvent(new CustomEvent('operationHistoryUpdate', {
      detail: this.operationHistory
    }));
  }
  
  // Obter histórico de operações
  getOperationHistory(): any[] {
    return [...this.operationHistory];
  }
  
  // Limpar histórico de operações
  clearOperationHistory(): void {
    this.operationHistory = [];
    document.dispatchEvent(new CustomEvent('operationHistoryUpdate', {
      detail: this.operationHistory
    }));
  }
  
  // Obter o nome da estratégia em execução
  private getRunningStrategyName(): string | null {
    for (const [name, running] of this.runningStrategies.entries()) {
      if (running) return name;
    }
    return null;
  }
  
  // Executar uma estratégia
  async runStrategy(options: RunStrategyOptions): Promise<void> {
    const { symbol, strategy, initialStake = 1, targetProfit = 0, stopLoss = 0, maxOperations = 0 } = options;
    
    // Verificar se já existe uma estratégia em execução
    if (this.getRunningStrategyName()) {
      throw new Error('Já existe uma estratégia em execução');
    }
    
    // Verificar se a estratégia existe
    if (!this.availableStrategies.has(strategy)) {
      throw new Error(`Estratégia "${strategy}" não encontrada`);
    }
    
    // Marcar a estratégia como em execução
    this.runningStrategies.set(strategy, true);
    
    // Obter configuração da estratégia
    let strategyConfig = { ...this.strategyConfigs.get(strategy) };
    
    // Aplicar parâmetros personalizados
    strategyConfig.symbol = symbol;
    strategyConfig.basisValue = initialStake;
    
    if (options.entryPercentageThreshold) {
      strategyConfig.entryPercentageThreshold = options.entryPercentageThreshold;
    }
    
    if (options.minimumAnalysisVolume) {
      strategyConfig.minimumAnalysisVolume = options.minimumAnalysisVolume;
    }
    
    // Assinar ticks para o símbolo selecionado
    this.subscribeTicks(symbol, this.onTickReceived.bind(this));
    
    // Obter histórico de ticks para análise inicial
    await this.getTickHistory(symbol, 1000);
    
    console.log(`Estratégia "${strategy}" iniciada com símbolo ${symbol}`);
    
    // Emitir evento de início de estratégia
    document.dispatchEvent(new CustomEvent('strategyStart', {
      detail: {
        strategy,
        symbol,
        config: strategyConfig
      }
    }));
  }
  
  // Parar a estratégia em execução
  async stopStrategy(): Promise<void> {
    for (const [strategy, running] of this.runningStrategies.entries()) {
      if (running) {
        // Marcar a estratégia como parada
        this.runningStrategies.set(strategy, false);
        
        // Emitir evento de parada de estratégia
        document.dispatchEvent(new CustomEvent('strategyStop', {
          detail: { strategy }
        }));
        
        console.log(`Estratégia "${strategy}" parada`);
      }
    }
  }
  
  // Manipulador de ticks recebidos
  private onTickReceived(data: TickResponse): void {
    const tick = data.tick;
    const runningStrategy = this.getRunningStrategyName();
    
    if (!runningStrategy) return;
    
    // Verificar se é o símbolo correto
    const config = this.strategyConfigs.get(runningStrategy);
    if (tick.symbol !== config.symbol) return;
    
    // Executar análise baseada na estratégia
    this.analyzeTickForStrategy(runningStrategy, tick);
  }
  
  // Analisar tick para a estratégia selecionada
  private async analyzeTickForStrategy(strategy: string, tick: any): Promise<void> {
    const config = this.strategyConfigs.get(strategy);
    
    // Verificar se há dados suficientes para análise
    const history = this.symbolHistory.get(tick.symbol);
    if (!history || !history.digits || history.digits.length < config.minimumAnalysisVolume) {
      return;
    }
    
    // Obter estatísticas de dígitos atualizadas
    const stats = this.digitStats.get(tick.symbol);
    if (!stats) return;
    
    let shouldEnter = false;
    
    // Estratégia baseada no tipo de estratégia
    switch (strategy) {
      case 'advance':
        // Analisa frequência dos dígitos 0 e 1
        // Se ambos estiverem abaixo do limiar, faz entrada DIGITOVER com prediction = 1
        const digit0Percentage = stats[0]?.percentage || 0;
        const digit1Percentage = stats[1]?.percentage || 0;
        
        if (digit0Percentage <= config.entryPercentageThreshold && 
            digit1Percentage <= config.entryPercentageThreshold) {
          shouldEnter = true;
          // Usar DIGITOVER com valor de previsão 1 (ganha quando o dígito é > 1)
          config.contractType = 'DIGITOVER';
          config.prediction = 1;
        }
        break;
        
      case 'maxpro':
      case 'bot_low':
      case 'iron_over':
      case 'iron_under':
      case 'manual_over':
      case 'manual_under':
        // Implementar lógica para outras estratégias
        // Por enquanto, usar a configuração padrão definida
        shouldEnter = Math.random() < 0.05; // Simulação para demonstração
        break;
        
      default:
        return;
    }
    
    // Se análise indicar entrada, criar um contrato
    if (shouldEnter) {
      this.executeContractBasedOnStrategy(strategy, tick);
    }
  }
  
  // Executar contrato baseado na estratégia
  private async executeContractBasedOnStrategy(strategy: string, tick: any): Promise<void> {
    try {
      const config = this.strategyConfigs.get(strategy);
      
      // Propor contrato com os parâmetros da estratégia
      const proposal = await this.proposeContract({
        contractType: config.contractType,
        symbol: config.symbol,
        duration: config.duration,
        durationUnit: config.durationUnit,
        basisType: config.basisType,
        basisValue: config.basisValue,
        barrierValue: config.prediction,
      });
      
      // Comprar o contrato
      const contract = await this.buyContract(proposal.id, proposal.ask_price);
      
      console.log(`Contrato comprado: ${contract.contract_id}`);
      
      // Adicionar ao histórico de operações imediatamente como pendente
      const pendingOperation = {
        id: contract.contract_id,
        contract_id: contract.contract_id,
        entry_value: contract.buy_price,
        time: new Date(contract.purchase_time * 1000),
        timestamp: contract.purchase_time,
        contract_type: config.contractType,
        symbol: config.symbol,
        strategy: strategy,
        is_completed: false,
      };
      
      this.operationHistory.push(pendingOperation);
      
      // Emitir evento de atualização
      document.dispatchEvent(new CustomEvent('operationHistoryUpdate', {
        detail: this.operationHistory
      }));
      
    } catch (error) {
      console.error('Erro ao executar contrato:', error);
    }
  }
  
  // Obter URL para autorização OAuth
  getOAuthUrl(): string {
    const callbackUrl = window.location.origin + '/oauth-callback';
    return `https://oauth.deriv.com/oauth2/authorize?app_id=${this.appId}&l=PT&redirect_uri=${encodeURIComponent(callbackUrl)}`;
  }
  
  // Abrir janela de autorização OAuth
  openOAuthWindow(): Window | null {
    const url = this.getOAuthUrl();
    return window.open(url, 'deriv_oauth', 'width=800,height=600');
  }
  
  // Processar token OAuth da URL
  processOAuthToken(url: string): string | null {
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('token1');
    return token;
  }
}

// Instância global do serviço
export const oauthDirectService = new OAuthDirectService();

// Hook React para usar o serviço
export function useOAuthDirectService() {
  const { t } = useTranslation();
  const { toast } = useToast();
  
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authorized, setAuthorized] = useState<any>(null);
  const [symbols, setSymbols] = useState<any[]>([]);
  const [activeAccount, setActiveAccount] = useState<any>(null);
  const [apiInstance, setApiInstance] = useState<OAuthDirectService>(oauthDirectService);
  
  // Verificar autorização inicial
  useEffect(() => {
    const checkAuth = async () => {
      if (oauthDirectService.isAuthorized()) {
        setIsAuthorized(true);
        setAuthorized(oauthDirectService.getAuthorized());
      } else {
        const token = localStorage.getItem('deriv_token');
        if (token) {
          try {
            // Conectar primeiro
            await oauthDirectService.connect();
            
            // Tentar autorizar com o token salvo
            const auth = await oauthDirectService.authorizeAccount(token);
            setIsAuthorized(true);
            setAuthorized(auth);
          } catch (error) {
            console.error('Erro ao autorizar com token salvo:', error);
            localStorage.removeItem('deriv_token');
          }
        }
      }
    };
    
    checkAuth();
  }, []);
  
  // Registrar ouvinte para atualizações de autorização
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.data && event.data.type === 'oauth_callback') {
        const token = event.data.token;
        if (token) {
          authorizeAccount(token).catch(error => {
            console.error('Erro ao autorizar com token recebido:', error);
            toast({
              title: t('Erro de Autorização'),
              description: t('Não foi possível autorizar sua conta. Por favor, tente novamente.'),
              variant: 'destructive',
            });
          });
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [t, toast]);
  
  // Conectar ao WebSocket
  const connect = useCallback(async () => {
    try {
      await oauthDirectService.connect();
      
      // Carregar símbolos ativos
      const symbols = await oauthDirectService.getActiveSymbols();
      setSymbols(symbols);
      
      // Abrir janela OAuth para login
      const authWindow = oauthDirectService.openOAuthWindow();
      
      if (!authWindow) {
        throw new Error(t('Bloqueador de pop-ups impediu a abertura da janela de autorização.'));
      }
      
      toast({
        title: t('Conectado'),
        description: t('Por favor, complete a autenticação na janela aberta.'),
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      toast({
        title: t('Erro de Conexão'),
        description: error.message || t('Falha ao conectar à API Deriv'),
        variant: 'destructive',
      });
      throw error;
    }
  }, [t, toast]);
  
  // Desconectar do WebSocket
  const disconnect = useCallback(async () => {
    try {
      await oauthDirectService.disconnect();
      setIsAuthorized(false);
      setAuthorized(null);
      setActiveAccount(null);
      localStorage.removeItem('deriv_token');
      
      toast({
        title: t('Desconectado'),
        description: t('Você foi desconectado da API Deriv'),
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: t('Erro ao Desconectar'),
        description: error.message || t('Falha ao desconectar da API Deriv'),
        variant: 'destructive',
      });
      throw error;
    }
  }, [t, toast]);
  
  // Autorizar conta com token
  const authorizeAccount = useCallback(async (token: string) => {
    try {
      const auth = await oauthDirectService.authorizeAccount(token);
      setIsAuthorized(true);
      setAuthorized(auth);
      setActiveAccount(auth);
      
      toast({
        title: t('Autorizado'),
        description: t('Sua conta foi autorizada com sucesso'),
        variant: 'default',
      });
      
      return auth;
    } catch (error: any) {
      console.error('Erro ao autorizar:', error);
      toast({
        title: t('Erro de Autorização'),
        description: error.message || t('Falha ao autorizar com a API Deriv'),
        variant: 'destructive',
      });
      throw error;
    }
  }, [t, toast]);
  
  // Obter saldo da conta
  const getBalance = useCallback(async () => {
    try {
      return await oauthDirectService.getBalance();
    } catch (error) {
      console.error('Erro ao obter saldo:', error);
      throw error;
    }
  }, []);
  
  // Obter símbolos ativos
  const getActiveSymbols = useCallback(async () => {
    try {
      const activeSymbols = await oauthDirectService.getActiveSymbols();
      setSymbols(activeSymbols);
      return activeSymbols;
    } catch (error) {
      console.error('Erro ao obter símbolos ativos:', error);
      throw error;
    }
  }, []);
  
  // Executar estratégia
  const runStrategy = useCallback(async (options: RunStrategyOptions) => {
    try {
      await oauthDirectService.runStrategy(options);
      toast({
        title: t('Estratégia Iniciada'),
        description: t('A estratégia foi iniciada com sucesso'),
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Erro ao executar estratégia:', error);
      toast({
        title: t('Erro ao Iniciar Estratégia'),
        description: error.message || t('Falha ao iniciar a estratégia'),
        variant: 'destructive',
      });
      throw error;
    }
  }, [t, toast]);
  
  // Parar estratégia
  const stopStrategy = useCallback(async () => {
    try {
      await oauthDirectService.stopStrategy();
      toast({
        title: t('Estratégia Parada'),
        description: t('A estratégia foi interrompida com sucesso'),
        variant: 'default',
      });
    } catch (error: any) {
      console.error('Erro ao parar estratégia:', error);
      toast({
        title: t('Erro ao Parar Estratégia'),
        description: error.message || t('Falha ao parar a estratégia'),
        variant: 'destructive',
      });
      throw error;
    }
  }, [t, toast]);
  
  return {
    connect,
    disconnect,
    isAuthorized,
    authorizeAccount,
    getBalance,
    getActiveSymbols,
    runStrategy,
    stopStrategy,
    symbols,
    authorized,
    activeAccount,
    apiInstance
  };
}