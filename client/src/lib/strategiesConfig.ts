import { BinaryBotStrategy, StrategyType } from './automationService';

/**
 * Lista de estratégias disponíveis com suas configurações padrão
 * baseadas nos arquivos XML analisados
 */
export const availableStrategies: BinaryBotStrategy[] = [
  // Estratégias Lite
  {
    id: 'profitpro',
    name: 'Profitpro Atualizado',
    description: 'Estratégia para operações com gestão de perda virtual',
    type: 'BOTH' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3,
      targetProfit: 20,
      stopLoss: 10,
      prediction: 5
    }
  },
  {
    id: 'manual_under',
    name: 'Manual Under',
    description: 'Estratégia para operações abaixo de um limiar',
    type: 'UNDER' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3,
      targetProfit: 20,
      stopLoss: 10,
      prediction: 4
    }
  },
  {
    id: 'advance',
    name: 'Advance',
    description: 'Estratégia avançada com análise percentual',
    type: 'ADVANCED' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 2,
      targetProfit: 15,
      stopLoss: 10,
      prediction: 5
    }
  },
  {
    id: 'wise_pro_tendencia',
    name: 'WISE PRO TENDENCIA',
    description: 'Estratégia que analisa tendências de mercado',
    type: 'BOTH' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 2,
      targetProfit: 20,
      stopLoss: 10
    }
  },
  
  // Estratégias Premium
  {
    id: 'iron_over',
    name: 'IRON OVER',
    description: 'Estratégia para dígitos acima de 5',
    type: 'OVER' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 0.5,
      maxMartingaleLevel: 2,
      targetProfit: 15,
      stopLoss: 10,
      prediction: 5
    }
  },
  {
    id: 'iron_under',
    name: 'IRON UNDER',
    description: 'Estratégia para dígitos abaixo de 5',
    type: 'UNDER' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 0.5,
      maxMartingaleLevel: 2,
      targetProfit: 15,
      stopLoss: 10,
      prediction: 5
    }
  },
  {
    id: 'bot_low',
    name: 'BOT LOW',
    description: 'Estratégia para dígitos baixos',
    type: 'UNDER' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 2,
      targetProfit: 20,
      stopLoss: 10,
      prediction: 3
    }
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia de maximização de lucros',
    type: 'OVER' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 2,
      targetProfit: 20,
      stopLoss: 10,
      prediction: 5
    }
  },
  {
    id: 'manual_over',
    name: 'Manual Over',
    description: 'Estratégia para operações acima de um limiar',
    type: 'OVER' as StrategyType,
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3,
      targetProfit: 20,
      stopLoss: 10,
      prediction: 5
    }
  }
];

/**
 * Categorias de estratégias
 */
export const strategyCategories = {
  lite: ['profitpro', 'manual_under', 'advance', 'wise_pro_tendencia'],
  premium: ['iron_over', 'iron_under', 'bot_low', 'maxpro', 'manual_over']
};

/**
 * Obtém uma estratégia pelo ID
 */
export function getStrategyById(id: string): BinaryBotStrategy | null {
  return availableStrategies.find(strategy => strategy.id === id) || null;
}

/**
 * Obtém estratégias por categoria
 */
export function getStrategiesByCategory(category: 'lite' | 'premium'): BinaryBotStrategy[] {
  const categoryIds = strategyCategories[category];
  return availableStrategies.filter(strategy => categoryIds.includes(strategy.id));
}

/**
 * Determina se uma estratégia é de maior risco
 */
export function isHighRiskStrategy(strategyId: string): boolean {
  return ['iron_over', 'iron_under', 'maxpro'].includes(strategyId);
}

/**
 * Verifica se uma estratégia usa previsão de dígito
 */
export function usesDigitPrediction(strategyId: string): boolean {
  const strategy = getStrategyById(strategyId);
  return strategy?.config.prediction !== undefined;
}

/**
 * Determina o tipo de contrato baseado na estratégia
 */
export function getContractTypeForStrategy(strategyId: string): string {
  const strategy = getStrategyById(strategyId);
  if (!strategy) return 'DIGITOVER';
  
  switch (strategy.type) {
    case 'OVER':
      return 'DIGITOVER';
    case 'UNDER':
      return 'DIGITUNDER';
    case 'ADVANCED':
    case 'BOTH':
      // Para estratégias que suportam ambos os tipos,
      // usar a previsão para determinar o tipo
      if (strategy.config.prediction && strategy.config.prediction >= 5) {
        return 'DIGITOVER';
      } else {
        return 'DIGITUNDER';
      }
    default:
      return 'DIGITOVER';
  }
}