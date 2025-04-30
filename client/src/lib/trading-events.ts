/**
 * Módulo para gerenciar eventos de trading e sincronizá-los com o monitor de lucro/perda
 */
import { profitLossMonitor } from './ProfitLossMonitor';

/**
 * Interface para eventos de atualização de ticks
 */
export interface TickEventData {
  tick: {
    quote: number;
    symbol: string;
    epoch: number;
    id?: string;
  };
}

/**
 * Interface para eventos de contratos
 */
export interface ContractEventData {
  contract_id: number;
  buy_price: number;
  contract_type: string;
  currency: string;
  longcode?: string;
  symbol: string;
  current_spot?: number;
  current_spot_time?: number;
  date_settlement?: number;
  date_start: number;
  entry_spot?: number;
  entry_tick_time?: number;
  exit_tick_time?: number;
  sell_price?: number;
  sell_time?: number;
  status?: 'open' | 'sold' | 'won' | 'lost';
  profit?: number;
}

/**
 * Classe de gerenciamento de eventos de trading
 * 
 * Esta classe centraliza o registro e monitoramento de eventos relacionados
 * ao trading, como ticks, contratos, operações concluídas, etc.
 */
class TradingEvents {
  private activeTrades: Map<number, ContractEventData> = new Map();
  private tradeListeners: Array<(event: string, data: any) => void> = [];
  private lastBatchTime: number = 0;
  private batchInterval: number = 500; // ms
  
  constructor() {
    // Configurar callbacks do monitor de lucro/perda
    profitLossMonitor.setCallbacks({
      onProfitTargetReached: () => {
        this.notifyListeners('profit_target_reached', {
          targetValue: profitLossMonitor.getStats().profitTarget,
          currentProfit: profitLossMonitor.getStats().netResult
        });
        
        // Disparar evento personalizado para o sistema
        const event = new CustomEvent('trading:profit_target_reached', {
          detail: {
            targetValue: profitLossMonitor.getStats().profitTarget, 
            currentProfit: profitLossMonitor.getStats().netResult
          }
        });
        document.dispatchEvent(event);
      },
      
      onLossLimitReached: () => {
        this.notifyListeners('loss_limit_reached', {
          limitValue: profitLossMonitor.getStats().lossLimit,
          currentLoss: -profitLossMonitor.getStats().netResult
        });
        
        // Disparar evento personalizado para o sistema
        const event = new CustomEvent('trading:loss_limit_reached', {
          detail: {
            limitValue: profitLossMonitor.getStats().lossLimit, 
            currentLoss: -profitLossMonitor.getStats().netResult
          }
        });
        document.dispatchEvent(event);
      },
      
      onUpdate: (data) => {
        // Não notificar em cada atualização para não sobrecarregar o sistema
        // Apenas registrar atualizações em intervalos
        const now = Date.now();
        if (now - this.lastBatchTime > this.batchInterval) {
          this.lastBatchTime = now;
          
          this.notifyListeners('profit_loss_update', {
            netProfit: data.netProfit,
            activeContracts: data.activeContracts,
            ...profitLossMonitor.getStats()
          });
        }
      }
    });
    
    // Iniciar o monitor
    profitLossMonitor.start();
  }
  
  /**
   * Registra um novo contrato
   * @param contract Dados do contrato
   */
  registerContract(contract: ContractEventData): void {
    try {
      const contractId = contract.contract_id;
      
      // Notificar sobre novo contrato
      this.notifyListeners('contract_registered', contract);
      
      // Adicionar ao mapa de contratos ativos
      this.activeTrades.set(contractId, contract);
      
      // Registrar no monitor de lucro/perda
      profitLossMonitor.registerContract(contractId, contract.buy_price);
      
      console.log(`[TRADING_EVENTS] Contrato ${contractId} registrado com sucesso`);
    } catch (error) {
      console.error(`[TRADING_EVENTS] Erro ao registrar contrato:`, error);
    }
  }
  
  /**
   * Atualiza os dados de um contrato existente
   * @param contract Dados do contrato
   */
  updateContract(contract: ContractEventData): void {
    try {
      const contractId = contract.contract_id;
      
      // Verificar se o contrato está sendo monitorado
      if (!this.activeTrades.has(contractId)) {
        // Se não estiver, registrá-lo
        this.registerContract(contract);
        return;
      }
      
      // Atualizar no mapa de contratos ativos
      this.activeTrades.set(contractId, {
        ...this.activeTrades.get(contractId),
        ...contract
      });
      
      // Se houver current_spot, atualizar o valor atual no monitor
      if (contract.current_spot) {
        const estimatedValue = this.estimateContractValue(contract);
        profitLossMonitor.updateContractValue(contractId, estimatedValue);
      }
      
      // Se o contrato foi concluído ou vendido, finalizar no monitor
      if (
        contract.status === 'won' || 
        contract.status === 'lost' || 
        contract.status === 'sold' ||
        contract.sell_price
      ) {
        const finalValue = contract.sell_price || 0;
        this.completeContract(contractId, finalValue, contract.profit);
      }
      
      // Notificar sobre atualização do contrato
      this.notifyListeners('contract_updated', contract);
    } catch (error) {
      console.error(`[TRADING_EVENTS] Erro ao atualizar contrato ${contract.contract_id}:`, error);
    }
  }
  
  /**
   * Marca um contrato como concluído
   * @param contractId ID do contrato
   * @param finalValue Valor final do contrato
   * @param profit Lucro do contrato
   */
  completeContract(contractId: number, finalValue: number, profit?: number): void {
    try {
      // Verificar se o contrato está sendo monitorado
      const contract = this.activeTrades.get(contractId);
      if (!contract) {
        console.warn(`[TRADING_EVENTS] Tentativa de completar contrato não registrado: ${contractId}`);
        return;
      }
      
      // Finalizar no monitor de lucro/perda
      profitLossMonitor.completeContract(contractId, finalValue);
      
      // Remover do mapa de contratos ativos
      this.activeTrades.delete(contractId);
      
      // Notificar sobre contrato concluído
      this.notifyListeners('contract_completed', {
        contractId,
        finalValue,
        profit: profit !== undefined ? profit : (finalValue - contract.buy_price)
      });
      
      console.log(`[TRADING_EVENTS] Contrato ${contractId} finalizado com sucesso`);
    } catch (error) {
      console.error(`[TRADING_EVENTS] Erro ao finalizar contrato ${contractId}:`, error);
    }
  }
  
  /**
   * Adiciona um resultado diretamente ao monitor
   * @param amount Valor a ser adicionado (positivo para lucro, negativo para perda)
   */
  addResult(amount: number): void {
    try {
      // Adicionar diretamente ao monitor de lucro/perda
      profitLossMonitor.addResult(amount);
      
      // Notificar sobre adição manual de resultado
      this.notifyListeners('result_added', { amount });
      
      console.log(`[TRADING_EVENTS] Resultado adicionado manualmente: ${amount}`);
    } catch (error) {
      console.error(`[TRADING_EVENTS] Erro ao adicionar resultado:`, error);
    }
  }
  
  /**
   * Configura o monitor de lucro/perda com novos limites
   * @param profitTarget Meta de lucro
   * @param lossLimit Limite de perda
   */
  configureMonitor(profitTarget?: number, lossLimit?: number): void {
    try {
      // Reiniciar o monitor com os novos valores
      profitLossMonitor.reset(profitTarget, lossLimit);
      
      // Notificar sobre configuração do monitor
      this.notifyListeners('monitor_configured', {
        profitTarget,
        lossLimit
      });
      
      console.log(`[TRADING_EVENTS] Monitor configurado: PT=${profitTarget}, LL=${lossLimit}`);
    } catch (error) {
      console.error(`[TRADING_EVENTS] Erro ao configurar monitor:`, error);
    }
  }
  
  /**
   * Adiciona um listener para eventos de trading
   * @param listener Função de callback para eventos
   */
  addListener(listener: (event: string, data: any) => void): void {
    this.tradeListeners.push(listener);
  }
  
  /**
   * Remove um listener de eventos de trading
   * @param listener Função de callback a ser removida
   */
  removeListener(listener: (event: string, data: any) => void): void {
    this.tradeListeners = this.tradeListeners.filter(l => l !== listener);
  }
  
  /**
   * Obtém estatísticas atuais do monitor de lucro/perda
   */
  getStats(): any {
    return profitLossMonitor.getStats();
  }
  
  /**
   * Estima o valor atual de um contrato com base em seus dados
   * @param contract Dados do contrato
   * @returns Valor estimado do contrato
   */
  private estimateContractValue(contract: ContractEventData): number {
    // Caso tenha sell_price, esse é o valor final
    if (contract.sell_price) {
      return contract.sell_price;
    }
    
    // Caso tenha profit, podemos calcular o valor atual
    if (contract.profit !== undefined) {
      return contract.buy_price + contract.profit;
    }
    
    // Se não temos informação suficiente, retornamos o valor de compra
    return contract.buy_price;
  }
  
  /**
   * Notifica todos os listeners sobre um evento
   * @param event Nome do evento
   * @param data Dados do evento
   */
  private notifyListeners(event: string, data: any): void {
    this.tradeListeners.forEach(listener => {
      try {
        listener(event, data);
      } catch (error) {
        console.error(`[TRADING_EVENTS] Erro ao notificar listener sobre evento '${event}':`, error);
      }
    });
  }
}

// Exportar uma instância global para uso em toda a aplicação
export const tradingEvents = new TradingEvents();