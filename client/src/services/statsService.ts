/**
 * Serviço para gerenciar estatísticas de operações
 * Mantém e atualiza estatísticas de ganhos e perdas em tempo real
 */

import { derivApiService, Contract } from './derivApiService';

export interface OperationStats {
  wins: number;
  losses: number;
  totalProfit: number;
  totalLoss: number;
  netResult: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestStreak: number;
  worstStreak: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
  startTime: Date;
  lastUpdateTime: Date;
  contracts: Contract[];
  bySymbol: Record<string, {
    count: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
  }>;
  byContractType: Record<string, {
    count: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
  }>;
}

export interface BalanceInfo {
  balance: number;
  currency: string;
  previousBalance?: number;
  change?: number;
  changePercentage?: number;
  lastUpdate: Date;
}

class StatsService {
  private stats: OperationStats = this.initializeStats();
  private balanceInfo: BalanceInfo = {
    balance: 0,
    currency: 'USD',
    lastUpdate: new Date()
  };
  
  private statsListeners: Array<(stats: OperationStats) => void> = [];
  private balanceListeners: Array<(balance: BalanceInfo) => void> = [];
  
  constructor() {
    // Carregar estatísticas do armazenamento local, se disponível
    this.loadFromStorage();
    
    // Inscrever-se para atualizações de contratos
    derivApiService.onContractUpdate(this.handleContractUpdate.bind(this));
    derivApiService.onBalanceUpdate(this.handleBalanceUpdate.bind(this));
  }
  
  /**
   * Inicializa o objeto de estatísticas
   */
  private initializeStats(): OperationStats {
    return {
      wins: 0,
      losses: 0,
      totalProfit: 0,
      totalLoss: 0,
      netResult: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      bestStreak: 0,
      worstStreak: 0,
      averageProfit: 0,
      averageLoss: 0,
      profitFactor: 0,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      contracts: [],
      bySymbol: {},
      byContractType: {}
    };
  }
  
  /**
   * Carregar estatísticas do armazenamento local
   */
  private loadFromStorage(): void {
    try {
      const savedStats = localStorage.getItem('trading_stats');
      if (savedStats) {
        const parsed = JSON.parse(savedStats);
        // Converter strings de data de volta para objetos Date
        parsed.startTime = new Date(parsed.startTime);
        parsed.lastUpdateTime = new Date(parsed.lastUpdateTime);
        this.stats = parsed;
      }
      
      const savedBalance = localStorage.getItem('balance_info');
      if (savedBalance) {
        const parsed = JSON.parse(savedBalance);
        parsed.lastUpdate = new Date(parsed.lastUpdate);
        this.balanceInfo = parsed;
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  }
  
  /**
   * Salvar estatísticas no armazenamento local
   */
  private saveToStorage(): void {
    try {
      localStorage.setItem('trading_stats', JSON.stringify(this.stats));
      localStorage.setItem('balance_info', JSON.stringify(this.balanceInfo));
    } catch (error) {
      console.error('Erro ao salvar estatísticas:', error);
    }
  }
  
  /**
   * Manipula atualizações de contratos
   */
  private handleContractUpdate(contract: Contract): void {
    // Verificar se o contrato já está fechado e tem um resultado
    if (contract.status !== 'open' && contract.profit !== undefined) {
      // Verificar se já processamos este contrato
      const alreadyProcessed = this.stats.contracts.some(c => c.contract_id === contract.contract_id);
      if (alreadyProcessed) return;
      
      const isWin = contract.profit > 0;
      
      // Adicionar o contrato à lista de contratos
      this.stats.contracts.push(contract);
      
      // Atualizar estatísticas gerais
      if (isWin) {
        this.stats.wins++;
        this.stats.totalProfit += contract.profit;
        this.stats.consecutiveWins++;
        this.stats.consecutiveLosses = 0;
        
        if (this.stats.consecutiveWins > this.stats.bestStreak) {
          this.stats.bestStreak = this.stats.consecutiveWins;
        }
      } else {
        this.stats.losses++;
        this.stats.totalLoss += contract.buy_price;
        this.stats.consecutiveLosses++;
        this.stats.consecutiveWins = 0;
        
        if (this.stats.consecutiveLosses > Math.abs(this.stats.worstStreak)) {
          this.stats.worstStreak = -this.stats.consecutiveLosses;
        }
      }
      
      // Calcular resultados líquidos
      this.stats.netResult = this.stats.totalProfit - this.stats.totalLoss;
      
      // Calcular médias
      if (this.stats.wins > 0) {
        this.stats.averageProfit = this.stats.totalProfit / this.stats.wins;
      }
      if (this.stats.losses > 0) {
        this.stats.averageLoss = this.stats.totalLoss / this.stats.losses;
      }
      
      // Calcular fator de lucro
      if (this.stats.totalLoss > 0) {
        this.stats.profitFactor = this.stats.totalProfit / this.stats.totalLoss;
      } else {
        this.stats.profitFactor = this.stats.totalProfit > 0 ? Infinity : 0;
      }
      
      // Atualizar estatísticas por símbolo
      if (!this.stats.bySymbol[contract.symbol]) {
        this.stats.bySymbol[contract.symbol] = {
          count: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          netProfit: 0
        };
      }
      
      const symbolStats = this.stats.bySymbol[contract.symbol];
      symbolStats.count++;
      if (isWin) {
        symbolStats.wins++;
        symbolStats.netProfit += contract.profit;
      } else {
        symbolStats.losses++;
        symbolStats.netProfit -= contract.buy_price;
      }
      symbolStats.winRate = symbolStats.wins / symbolStats.count * 100;
      
      // Atualizar estatísticas por tipo de contrato
      if (!this.stats.byContractType[contract.contract_type]) {
        this.stats.byContractType[contract.contract_type] = {
          count: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          netProfit: 0
        };
      }
      
      const typeStats = this.stats.byContractType[contract.contract_type];
      typeStats.count++;
      if (isWin) {
        typeStats.wins++;
        typeStats.netProfit += contract.profit;
      } else {
        typeStats.losses++;
        typeStats.netProfit -= contract.buy_price;
      }
      typeStats.winRate = typeStats.wins / typeStats.count * 100;
      
      // Atualizar timestamp
      this.stats.lastUpdateTime = new Date();
      
      // Salvar no localStorage
      this.saveToStorage();
      
      // Notificar ouvintes
      this.notifyStatsListeners();
    }
  }
  
  /**
   * Manipula atualizações de saldo
   */
  private handleBalanceUpdate(balance: any): void {
    if (!balance || typeof balance.balance !== 'number') return;
    
    const previousBalance = this.balanceInfo.balance;
    const newBalance = balance.balance;
    
    this.balanceInfo = {
      balance: newBalance,
      currency: balance.currency || 'USD',
      previousBalance,
      change: newBalance - previousBalance,
      changePercentage: previousBalance > 0 
        ? ((newBalance - previousBalance) / previousBalance) * 100 
        : 0,
      lastUpdate: new Date()
    };
    
    // Salvar no localStorage
    this.saveToStorage();
    
    // Notificar ouvintes
    this.notifyBalanceListeners();
  }
  
  /**
   * Atualiza manualmente o saldo (para simulações)
   */
  public updateBalance(value: number, currency: string = 'USD'): void {
    const previousBalance = this.balanceInfo.balance;
    
    this.balanceInfo = {
      balance: value,
      currency,
      previousBalance,
      change: value - previousBalance,
      changePercentage: previousBalance > 0 
        ? ((value - previousBalance) / previousBalance) * 100 
        : 0,
      lastUpdate: new Date()
    };
    
    // Salvar no localStorage
    this.saveToStorage();
    
    // Notificar ouvintes
    this.notifyBalanceListeners();
  }
  
  /**
   * Adiciona uma operação manualmente (para simulações)
   */
  public addOperation(contract: Partial<Contract> & { profit: number, buy_price: number }): void {
    const fullContract: Contract = {
      contract_id: Math.round(Math.random() * 1000000000),
      contract_type: contract.contract_type || 'DIGITOVER',
      symbol: contract.symbol || 'R_100',
      status: 'sold',
      purchase_time: Date.now() / 1000,
      ...contract
    };
    
    this.handleContractUpdate(fullContract);
  }
  
  /**
   * Reinicia as estatísticas
   */
  public resetStats(): void {
    this.stats = this.initializeStats();
    this.saveToStorage();
    this.notifyStatsListeners();
  }
  
  /**
   * Obtém o objeto de estatísticas atual
   */
  public getStats(): OperationStats {
    return { ...this.stats };
  }
  
  /**
   * Obtém as informações de saldo atuais
   */
  public getBalanceInfo(): BalanceInfo {
    return { ...this.balanceInfo };
  }
  
  /**
   * Adiciona um ouvinte para atualizações de estatísticas
   */
  public onStatsUpdate(listener: (stats: OperationStats) => void): void {
    this.statsListeners.push(listener);
    // Notificar imediatamente com os dados atuais
    listener({ ...this.stats });
  }
  
  /**
   * Remove um ouvinte de atualizações de estatísticas
   */
  public offStatsUpdate(listener: (stats: OperationStats) => void): void {
    this.statsListeners = this.statsListeners.filter(l => l !== listener);
  }
  
  /**
   * Adiciona um ouvinte para atualizações de saldo
   */
  public onBalanceUpdate(listener: (balance: BalanceInfo) => void): void {
    this.balanceListeners.push(listener);
    // Notificar imediatamente com os dados atuais
    listener({ ...this.balanceInfo });
  }
  
  /**
   * Remove um ouvinte de atualizações de saldo
   */
  public offBalanceUpdate(listener: (balance: BalanceInfo) => void): void {
    this.balanceListeners = this.balanceListeners.filter(l => l !== listener);
  }
  
  /**
   * Notifica todos os ouvintes de estatísticas
   */
  private notifyStatsListeners(): void {
    this.statsListeners.forEach(listener => {
      try {
        listener({ ...this.stats });
      } catch (error) {
        console.error('Erro ao notificar ouvinte de estatísticas:', error);
      }
    });
  }
  
  /**
   * Notifica todos os ouvintes de saldo
   */
  private notifyBalanceListeners(): void {
    this.balanceListeners.forEach(listener => {
      try {
        listener({ ...this.balanceInfo });
      } catch (error) {
        console.error('Erro ao notificar ouvinte de saldo:', error);
      }
    });
  }
}

// Exporta uma instância única do serviço
export const statsService = new StatsService();
export default statsService;