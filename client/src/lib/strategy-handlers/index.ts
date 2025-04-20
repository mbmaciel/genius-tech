/**
 * Integrador de estratégias
 * Gerencia e aplica regras de estratégias para os bots
 */

import { 
  evaluateAdvanceStrategy, 
  evaluateIronOverStrategy, 
  evaluateIronUnderStrategy,
  evaluateMaxProStrategy,
  evaluateDefaultStrategy,
  ContractType,
  DigitStat
} from "@/services/strategyRules";

// Estado global para cada estratégia
interface StrategyState {
  consecutiveLosses: number;
  lastResult: 'win' | 'loss' | null;
  currentAmount: number;
  prediction?: number;
  entryConditionsMet: boolean;
}

// Cache de estado para cada estratégia
const strategyStates: Record<string, StrategyState> = {};

/**
 * Inicializa ou reseta o estado para uma estratégia
 */
export function initializeStrategyState(
  strategyId: string, 
  initialAmount: number = 0.35
): void {
  console.log(`[STRATEGY_HANDLER] Inicializando estado para estratégia: ${strategyId}`);
  
  // Definir state padrão
  strategyStates[strategyId] = {
    consecutiveLosses: 0,
    lastResult: null,
    currentAmount: initialAmount,
    prediction: strategyId.includes('digit') ? Math.floor(Math.random() * 10) : undefined,
    entryConditionsMet: false
  };
}

/**
 * Atualiza o estado da estratégia com base no resultado de uma operação
 */
export function updateStrategyResult(
  strategyId: string, 
  result: 'win' | 'loss', 
  profit: number
): void {
  if (!strategyStates[strategyId]) {
    initializeStrategyState(strategyId);
  }
  
  const state = strategyStates[strategyId];
  state.lastResult = result;
  
  // Atualizar contagem de perdas consecutivas
  if (result === 'win') {
    state.consecutiveLosses = 0;
    state.currentAmount = 0.35; // Resetar para valor inicial após ganho
  } else {
    state.consecutiveLosses++;
    // Valor de Entrada será calculado de acordo com a estratégia
  }
  
  console.log(`[STRATEGY_HANDLER] ${strategyId}: Resultado ${result}, Profit ${profit}, Perdas consecutivas: ${state.consecutiveLosses}`);
}

/**
 * Avalia as condições de entrada para uma estratégia
 */
export function evaluateEntryConditions(
  strategyId: string, 
  digitStats: DigitStat[], 
  strategyConfig: any
): {
  shouldEnter: boolean;
  contractType: ContractType;
  prediction?: number;
  entryAmount: number;
  message: string;
} {
  // Garantir que o estado existe
  if (!strategyStates[strategyId]) {
    initializeStrategyState(strategyId);
  }
  
  const state = strategyStates[strategyId];
  const normalizedId = strategyId.toLowerCase();
  
  // Configurações de entrada
  let entryAmount = state.currentAmount || 0.35;
  let shouldEnter = false;
  let contractType: ContractType = 'CALL';
  let prediction: number | undefined = undefined;
  let message = "";
  let useMartingale = false;
  
  // Aplicar regras específicas para cada estratégia
  if (normalizedId.includes('advance')) {
    // Obter porcentagem limite da configuração ou usar padrão
    // O valor de porcentagem DEVE SER definido pelo usuário, nunca usar valor fixo
    const entryPercentage = strategyConfig?.porcentagemParaEntrar 
      ? parseFloat(strategyConfig.porcentagemParaEntrar.toString()) 
      : 70; // Valor padrão de 70% caso não haja configuração - preferência por valor mais conservador
    
    // Removido log para evitar confusão com o valor exibido
    
    const result = evaluateAdvanceStrategy(digitStats, entryPercentage);
    shouldEnter = result.shouldEnter;
    contractType = result.contractType;
    message = result.message;
    
    // Calcular valor de entrada considerando martingale para ADVANCE
    if (state.lastResult === 'loss') {
      const martingaleFactor = strategyConfig?.martingale 
        ? parseFloat(strategyConfig.martingale.toString()) 
        : 1.5;
      
      entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[STRATEGY_HANDLER] ADVANCE: Aplicando martingale, novo valor: ${entryAmount}`);
    }
    
  } else if (normalizedId.includes('iron_over') || normalizedId.includes('ironover')) {
    // Configurar previsão padrão para IRON OVER
    prediction = state.prediction || 5; // Previsão padrão é 5
    
    // Valor para início de martingale
    const martingaleAfterLosses = strategyConfig?.usarMartingaleAposXLoss 
      ? parseInt(strategyConfig.usarMartingaleAposXLoss.toString())
      : 2;
    
    const result = evaluateIronOverStrategy(
      digitStats, 
      prediction, 
      state.consecutiveLosses,
      martingaleAfterLosses
    );
    
    shouldEnter = result.shouldEnter;
    contractType = result.contractType;
    useMartingale = result.useMartingale;
    message = result.message;
    
    // Aplicar martingale apenas se as condições do IRON OVER permitirem
    if (state.lastResult === 'loss' && useMartingale) {
      const martingaleFactor = strategyConfig?.martingale 
        ? parseFloat(strategyConfig.martingale.toString()) 
        : 0.5; // Martingale menor para IRON (0.5 é o padrão)
      
      entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[STRATEGY_HANDLER] IRON_OVER: Aplicando martingale após ${state.consecutiveLosses} perdas, novo valor: ${entryAmount}`);
    }
    
  } else if (normalizedId.includes('iron_under') || normalizedId.includes('ironunder')) {
    // Configurar previsão padrão para IRON UNDER
    prediction = state.prediction || 5; // Previsão padrão é 5
    
    // Valor para início de martingale
    const martingaleAfterLosses = strategyConfig?.usarMartingaleAposXLoss 
      ? parseInt(strategyConfig.usarMartingaleAposXLoss.toString())
      : 2;
    
    const result = evaluateIronUnderStrategy(
      digitStats, 
      prediction, 
      state.consecutiveLosses,
      martingaleAfterLosses
    );
    
    shouldEnter = result.shouldEnter;
    contractType = result.contractType;
    useMartingale = result.useMartingale;
    message = result.message;
    
    // Aplicar martingale apenas se as condições do IRON UNDER permitirem
    if (state.lastResult === 'loss' && useMartingale) {
      const martingaleFactor = strategyConfig?.martingale 
        ? parseFloat(strategyConfig.martingale.toString()) 
        : 0.5; // Martingale menor para IRON (0.5 é o padrão)
      
      entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[STRATEGY_HANDLER] IRON_UNDER: Aplicando martingale após ${state.consecutiveLosses} perdas, novo valor: ${entryAmount}`);
    }
    
  } else if (normalizedId.includes('maxpro')) {
    const result = evaluateMaxProStrategy(digitStats);
    shouldEnter = result.shouldEnter;
    contractType = result.contractType;
    prediction = result.prediction;
    message = result.message;
    
    // Aplicar martingale para MAXPRO
    if (state.lastResult === 'loss') {
      const martingaleFactor = strategyConfig?.martingale 
        ? parseFloat(strategyConfig.martingale.toString()) 
        : 1.5;
      
      entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[STRATEGY_HANDLER] MAXPRO: Aplicando martingale, novo valor: ${entryAmount}`);
    }
    
  } else {
    // Estratégia padrão quando não houver implementação específica
    const defaultContractType = contractType as ContractType;
    const result = evaluateDefaultStrategy(digitStats, defaultContractType);
    shouldEnter = result.shouldEnter;
    contractType = result.contractType;
    message = result.message;
    
    // Aplicar martingale padrão
    if (state.lastResult === 'loss') {
      const martingaleFactor = strategyConfig?.martingale 
        ? parseFloat(strategyConfig.martingale.toString()) 
        : 1.5;
      
      entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[STRATEGY_HANDLER] ${strategyId}: Aplicando martingale padrão, novo valor: ${entryAmount}`);
    }
  }
  
  // Atualizar estado da estratégia
  state.entryConditionsMet = shouldEnter;
  state.currentAmount = entryAmount;
  
  return {
    shouldEnter,
    contractType,
    prediction,
    entryAmount,
    message
  };
}

/**
 * Obtém o estado atual de uma estratégia
 */
export function getStrategyState(strategyId: string): StrategyState | null {
  return strategyStates[strategyId] || null;
}

/**
 * Reseta todas as estratégias
 */
export function resetAllStrategies(): void {
  Object.keys(strategyStates).forEach(id => {
    initializeStrategyState(id);
  });
  console.log("[STRATEGY_HANDLER] Todas as estratégias foram redefinidas");
}