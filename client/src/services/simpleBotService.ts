/**
 * Serviço simplificado para demonstração de trading automatizado
 * Versão 2023.1 - Focada na interface
 */

import { derivAPI } from '../lib/websocketManager';

export type BotStatus = 'idle' | 'running' | 'paused' | 'error';
export type ContractType = 'DIGITOVER' | 'DIGITUNDER' | 'CALL' | 'PUT';
export type ContractPrediction = number;

export interface BotSettings {
  entryValue: number;
  virtualLoss?: number;
  profitTarget: number;
  lossLimit: number;
  martingaleFactor: number;
  prediction?: ContractPrediction;
  contractType?: ContractType;
}

export interface OperationStats {
  wins: number;
  losses: number;
  totalProfit: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface Contract {
  contract_id: number | string;
  contract_type: string;
  buy_price: number;
  symbol: string;
  status: string;
  profit?: number;
  payout?: number;
  purchase_time: number;
  date_expiry?: number;
}

// Evento simplificado para atualizar a interface
type BotEvent = { type: string; [key: string]: any };

class SimpleBotService {
  private status: BotStatus = 'idle';
  private currentContractId: number | null = null;
  private activeStrategyId: string | null = null;
  private settings: BotSettings = {
    entryValue: 0.35,
    profitTarget: 10,
    lossLimit: 20,
    martingaleFactor: 1.5
  };
  private eventListeners: ((event: BotEvent) => void)[] = [];
  private operationTimer: NodeJS.Timeout | null = null;
  
  // Estatísticas simplificadas
  private stats: OperationStats = {
    wins: 0,
    losses: 0,
    totalProfit: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  };
  
  constructor() {
    console.log('[SIMPLEBOT] Inicializando serviço simplificado de bot');
  }
  
  /**
   * Define a estratégia ativa
   */
  public setActiveStrategy(strategyId: string): boolean {
    console.log(`[SIMPLEBOT] Definindo estratégia: ${strategyId}`);
    this.activeStrategyId = strategyId;
    
    // Configurar tipo de contrato baseado no nome
    if (strategyId.includes('under')) {
      this.settings.contractType = 'DIGITUNDER';
    } else {
      this.settings.contractType = 'DIGITOVER';
    }
    
    this.settings.prediction = 5; // Valor padrão para previsão
    
    return true;
  }
  
  /**
   * Define configurações do bot
   */
  public setSettings(settings: Partial<BotSettings>): void {
    this.settings = { ...this.settings, ...settings };
    console.log(`[SIMPLEBOT] Atualizou configurações:`, this.settings);
  }
  
  /**
   * Inicia a execução do bot
   */
  public async start(): Promise<boolean> {
    console.log('[SIMPLEBOT] Método start() chamado');
    
    if (this.status === 'running') {
      console.log('[SIMPLEBOT] Bot já está rodando');
      return true;
    }
    
    if (!this.activeStrategyId) {
      console.error('[SIMPLEBOT] Nenhuma estratégia selecionada');
      return false;
    }
    
    // Atualizar status do bot
    this.status = 'running';
    this.emitEvent({ type: 'status_change', status: this.status });
    
    // Simular operação para demonstração da interface
    this.simulateOperation();
    
    return true;
  }
  
  /**
   * Para a execução do bot
   */
  public stop(): void {
    console.log('[SIMPLEBOT] Método stop() chamado');
    
    // Atualizar status
    this.status = 'idle';
    this.emitEvent({ type: 'status_change', status: this.status });
    
    // Limpar timers
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }
  }
  
  /**
   * Adiciona um ouvinte para eventos do bot
   */
  public addEventListener(listener: (event: BotEvent) => void): void {
    this.eventListeners.push(listener);
  }
  
  /**
   * Remove um ouvinte de eventos
   */
  public removeEventListener(listener: (event: BotEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }
  
  /**
   * Obtém o status atual do bot
   */
  public getStatus(): BotStatus {
    return this.status;
  }
  
  /**
   * Obtém as estatísticas atuais
   */
  public getStats(): OperationStats {
    return { ...this.stats };
  }
  
  /**
   * Simula uma operação para fins de UI
   */
  private simulateOperation(): void {
    if (this.status !== 'running') return;
    
    const contract = {
      contract_id: Math.floor(Math.random() * 1000000),
      contract_type: this.settings.contractType || 'DIGITOVER',
      buy_price: this.settings.entryValue,
      symbol: 'R_100',
      status: 'open',
      purchase_time: Date.now() / 1000,
      payout: this.settings.entryValue * 1.9
    };
    
    // Notificar início de operação
    this.emitEvent({ type: 'operation_started', contract });
    
    // Após 5 segundos, simular finalização da operação
    this.operationTimer = setTimeout(() => {
      // Gerar resultado aleatório (vitória/derrota)
      const isWin = Math.random() > 0.5;
      const profit = isWin ? contract.buy_price * 0.9 : -contract.buy_price;
      
      if (isWin) {
        this.stats.wins++;
        this.stats.consecutiveWins++;
        this.stats.consecutiveLosses = 0;
      } else {
        this.stats.losses++;
        this.stats.consecutiveLosses++;
        this.stats.consecutiveWins = 0;
      }
      
      this.stats.totalProfit += profit;
      
      // Notificar resultado da operação
      this.emitEvent({
        type: 'operation_finished',
        result: isWin ? 'win' : 'loss',
        profit,
        contract: {
          ...contract,
          status: isWin ? 'won' : 'lost',
          profit
        }
      });
      
      // Atualizar estatísticas
      this.emitEvent({ type: 'stats_updated', stats: { ...this.stats } });
      
      // Programar próxima operação
      this.operationTimer = setTimeout(() => {
        this.simulateOperation();
      }, 3000);
    }, 5000);
  }
  
  /**
   * Emite um evento para todos os ouvintes registrados
   */
  private emitEvent(event: BotEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SIMPLEBOT] Erro ao processar evento:', error);
      }
    });
  }
}

// Exportar instância única do serviço
export const simpleBotService = new SimpleBotService();
export default simpleBotService;