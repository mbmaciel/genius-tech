/**
 * Classe auxiliar para monitorar o lucro e limite de perda em tempo real
 * 
 * Esta classe resolve o problema de verificação tardia dos limites de lucro e perda
 * verificando continuamente os valores mesmo durante operações em andamento
 */
export class ProfitLossMonitor {
  private profitTarget: number;
  private lossLimit: number;
  private sessionProfit: number = 0;
  private sessionLoss: number = 0;
  private netResult: number = 0;
  private isMonitoring: boolean = false;
  private checkIntervalId: number | null = null;
  private contractsInProgress: Map<number, { entryValue: number, currentValue?: number }> = new Map();
  private strategyId: string = '';
  
  // Callbacks
  private onProfitTargetReached: (() => void) | null = null;
  private onLossLimitReached: (() => void) | null = null;
  private onUpdate: ((data: { netProfit: number, activeContracts: number }) => void) | null = null;
  
  /**
   * Cria uma nova instância do monitor de lucro/perda
   * @param profitTarget Meta de lucro a ser atingida como valor padrão
   * @param lossLimit Limite de perda a ser respeitado como valor padrão
   */
  constructor(profitTarget: number = 20, lossLimit: number = 10) {
    this.profitTarget = profitTarget;
    this.lossLimit = lossLimit;
    
    // Isso apenas define os valores padrão; leremos os valores configurados pelo usuário
    console.log("[PROFIT_LOSS_MONITOR] Iniciado com valores PADRÃO. Meta de lucro:", profitTarget, "e limite de perda:", lossLimit);
    console.log("[PROFIT_LOSS_MONITOR] ⚠️ Estes valores serão substituídos pelos configurados pelo usuário.");
  }
  
  /**
   * Define a estratégia atual sendo utilizada
   * @param strategyId ID da estratégia 
   */
  setStrategy(strategyId: string): void {
    this.strategyId = strategyId;
    this.updateLimitsFromConfig();
    console.log(`[PROFIT_LOSS_MONITOR] Estratégia definida: ${strategyId}`);
  }
  
  /**
   * Atualiza os limites com base na configuração da estratégia
   */
  private updateLimitsFromConfig(): void {
    if (!this.strategyId) return;
    
    try {
      // Tentar obter configuração do localStorage
      const configKey = `strategy_config_${this.strategyId.toLowerCase()}`;
      const savedConfig = localStorage.getItem(configKey);
      
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        
        // Verificar e atualizar os valores
        if (config.metaGanho !== undefined && !isNaN(Number(config.metaGanho))) {
          const newTarget = Number(config.metaGanho);
          if (this.profitTarget !== newTarget) {
            console.log(`[PROFIT_LOSS_MONITOR] Meta de lucro atualizada: ${this.profitTarget} → ${newTarget}`);
            this.profitTarget = newTarget;
          }
        }
        
        if (config.limitePerda !== undefined && !isNaN(Number(config.limitePerda))) {
          const newLimit = Number(config.limitePerda);
          if (this.lossLimit !== newLimit) {
            console.log(`[PROFIT_LOSS_MONITOR] Limite de perda atualizado: ${this.lossLimit} → ${newLimit}`);
            this.lossLimit = newLimit;
          }
        }
      }
    } catch (error) {
      console.error("[PROFIT_LOSS_MONITOR] Erro ao carregar configurações:", error);
    }
  }
  
  /**
   * Inicia o monitoramento de lucro/perda
   * @param checkIntervalMs Intervalo de verificação em milissegundos (padrão: 500ms)
   */
  start(checkIntervalMs: number = 500): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.checkIntervalId = window.setInterval(() => this.checkLimits(), checkIntervalMs);
    
    console.log("[PROFIT_LOSS_MONITOR] Monitoramento iniciado com intervalo de:", checkIntervalMs, "ms");
  }
  
  /**
   * Para o monitoramento de lucro/perda
   */
  stop(): void {
    if (!this.isMonitoring) return;
    
    if (this.checkIntervalId !== null) {
      window.clearInterval(this.checkIntervalId);
      this.checkIntervalId = null;
    }
    
    this.isMonitoring = false;
    console.log("[PROFIT_LOSS_MONITOR] Monitoramento interrompido");
  }
  
  /**
   * Reinicia o monitor com novos valores
   */
  reset(newProfitTarget?: number, newLossLimit?: number): void {
    // Atualizar valores se fornecidos
    if (newProfitTarget !== undefined) this.profitTarget = newProfitTarget;
    if (newLossLimit !== undefined) this.lossLimit = newLossLimit;
    
    // Reiniciar contadores
    this.sessionProfit = 0;
    this.sessionLoss = 0;
    this.netResult = 0;
    this.contractsInProgress.clear();
    
    console.log("[PROFIT_LOSS_MONITOR] Monitor reiniciado com meta:", this.profitTarget, "e limite:", this.lossLimit);
  }
  
  /**
   * Configura os callbacks para notificação
   * @param callbacks Objeto com callbacks para diferentes eventos
   */
  setCallbacks(callbacks: {
    onProfitTargetReached?: () => void;
    onLossLimitReached?: () => void;
    onUpdate?: (data: { netProfit: number, activeContracts: number }) => void;
  }): void {
    this.onProfitTargetReached = callbacks.onProfitTargetReached || null;
    this.onLossLimitReached = callbacks.onLossLimitReached || null;
    this.onUpdate = callbacks.onUpdate || null;
  }
  
  /**
   * Registra o início de um novo contrato
   * @param contractId ID do contrato
   * @param entryValue Valor de entrada
   */
  registerContract(contractId: number, entryValue: number): void {
    this.contractsInProgress.set(contractId, { entryValue });
    console.log("[PROFIT_LOSS_MONITOR] Novo contrato registrado:", contractId, "com valor:", entryValue);
  }
  
  /**
   * Atualiza o valor atual de um contrato em andamento
   * @param contractId ID do contrato
   * @param currentValue Valor atual do contrato
   */
  updateContractValue(contractId: number, currentValue: number): void {
    const contract = this.contractsInProgress.get(contractId);
    if (!contract) {
      console.warn("[PROFIT_LOSS_MONITOR] Tentativa de atualizar contrato não registrado:", contractId);
      return;
    }
    
    contract.currentValue = currentValue;
    this.contractsInProgress.set(contractId, contract);
  }
  
  /**
   * Finaliza um contrato (encerrado ou cancelado)
   * @param contractId ID do contrato
   * @param finalValue Valor final do contrato (ganho ou perda)
   */
  completeContract(contractId: number, finalValue: number): void {
    const contract = this.contractsInProgress.get(contractId);
    if (!contract) {
      console.warn("[PROFIT_LOSS_MONITOR] Tentativa de completar contrato não registrado:", contractId);
      return;
    }
    
    // Calcular resultado
    const profit = finalValue - contract.entryValue;
    
    if (profit >= 0) {
      this.sessionProfit += profit;
    } else {
      this.sessionLoss += Math.abs(profit);
    }
    
    this.netResult += profit;
    
    // Remover da lista de contratos em andamento
    this.contractsInProgress.delete(contractId);
    
    console.log(
      "[PROFIT_LOSS_MONITOR] Contrato", contractId, "finalizado. Resultado:", profit, 
      "Lucro total:", this.sessionProfit, "Perda total:", this.sessionLoss,
      "Saldo líquido:", this.netResult
    );
    
    // Verificar limites imediatamente
    this.checkLimits();
  }
  
  /**
   * Adiciona lucro ou perda diretamente (para operações manuais ou ajustes)
   * @param amount Valor a ser adicionado (positivo para lucro, negativo para perda)
   */
  addResult(amount: number): void {
    if (amount >= 0) {
      this.sessionProfit += amount;
    } else {
      this.sessionLoss += Math.abs(amount);
    }
    
    this.netResult += amount;
    
    console.log(
      "[PROFIT_LOSS_MONITOR] Resultado adicionado manualmente:", amount,
      "Lucro total:", this.sessionProfit, "Perda total:", this.sessionLoss,
      "Saldo líquido:", this.netResult
    );
    
    // Verificar limites imediatamente
    this.checkLimits();
  }
  
  /**
   * Obtém estatísticas atuais do monitor
   */
  getStats(): {
    profitTarget: number;
    lossLimit: number;
    sessionProfit: number;
    sessionLoss: number;
    netResult: number;
    activeContracts: number;
    estimatedNetResult: number;
  } {
    // Calcular resultado estimado incluindo contratos em andamento
    let estimatedProfit = this.netResult;
    
    // Usar Array.from para compatibilidade com versões mais antigas do JavaScript
    Array.from(this.contractsInProgress.entries()).forEach(([_, contract]) => {
      if (contract.currentValue !== undefined) {
        estimatedProfit += (contract.currentValue - contract.entryValue);
      }
    });
    
    return {
      profitTarget: this.profitTarget,
      lossLimit: this.lossLimit,
      sessionProfit: this.sessionProfit,
      sessionLoss: this.sessionLoss,
      netResult: this.netResult,
      activeContracts: this.contractsInProgress.size,
      estimatedNetResult: estimatedProfit
    };
  }
  
  /**
   * Verifica se os limites de lucro ou perda foram atingidos
   * @returns true se algum limite foi atingido
   */
  private checkLimits(): boolean {
    // Sempre atualizar os limites com os valores mais recentes configurados pelo usuário
    this.updateLimitsFromConfig();
    
    // Verificar se a meta de lucro foi atingida
    if (this.netResult >= this.profitTarget) {
      console.log(
        "[PROFIT_LOSS_MONITOR] ✅ Meta de lucro atingida!", 
        this.netResult, ">=", this.profitTarget,
        "(valor configurado pelo usuário)"
      );
      
      if (this.onProfitTargetReached) {
        this.onProfitTargetReached();
      }
      
      return true;
    }
    
    // Verificar se o limite de perda foi ultrapassado
    if (this.netResult <= -this.lossLimit) {
      console.log(
        "[PROFIT_LOSS_MONITOR] ❌ Limite de perda atingido!", 
        this.netResult, "<=", -this.lossLimit,
        "(valor configurado pelo usuário)"
      );
      
      if (this.onLossLimitReached) {
        this.onLossLimitReached();
      }
      
      return true;
    }
    
    // Verificar se há uma estimativa precoce de atingir os limites
    let estimatedNetResult = this.netResult;
    
    // Adicionar resultados estimados de contratos em andamento
    Array.from(this.contractsInProgress.entries()).forEach(([_, contract]) => {
      if (contract.currentValue !== undefined) {
        estimatedNetResult += (contract.currentValue - contract.entryValue);
      }
    });
    
    // Notificar sobre atualização do status
    if (this.onUpdate) {
      this.onUpdate({
        netProfit: this.netResult,
        activeContracts: this.contractsInProgress.size
      });
    }
    
    // Alertar se estivermos próximos de atingir algum limite
    const isNearProfitTarget = estimatedNetResult >= this.profitTarget * 0.9;
    const isNearLossLimit = estimatedNetResult <= -this.lossLimit * 0.9;
    
    if (isNearProfitTarget) {
      console.log("[PROFIT_LOSS_MONITOR] ⚠️ Próximo da meta de lucro!", estimatedNetResult, "está próximo de", this.profitTarget);
    }
    
    if (isNearLossLimit) {
      console.log("[PROFIT_LOSS_MONITOR] ⚠️ Próximo do limite de perda!", estimatedNetResult, "está próximo de", -this.lossLimit);
    }
    
    return false;
  }
}

// Exportar uma instância global para uso em toda a aplicação
export const profitLossMonitor = new ProfitLossMonitor(20, 10);