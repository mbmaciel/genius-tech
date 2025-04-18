import { BinaryBotStrategy } from './automationService';

/**
 * Lista de estratégias disponíveis com suas configurações padrão
 * baseadas nos arquivos XML analisados
 */
export const availableStrategies: BinaryBotStrategy[] = [
  // Estratégias lite
  {
    id: 'profitpro',
    name: 'ProfitPro Atualizado',
    description: 'Estratégia Profitpro com gestão financeira adaptativa',
    xmlPath: '/attached_assets/Profitpro Atualizado.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  },
  {
    id: 'manual_over',
    name: 'Manual Over',
    description: 'Estratégia manual otimizada para contratos CALL/ACIMA',
    xmlPath: '/attached_assets/Manual Over.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  },
  {
    id: 'manual_under',
    name: 'Manual Under',
    description: 'Estratégia manual otimizada para contratos PUT/ABAIXO',
    xmlPath: '/attached_assets/Manual Under.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  },
  {
    id: 'bot_low',
    name: 'BOT LOW',
    description: 'Estratégia simples otimizada para operações de baixo risco',
    xmlPath: '/attached_assets/BOT LOW.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  },
  
  // Estratégias premium
  {
    id: 'iron_over',
    name: 'IRON OVER',
    description: 'Estratégia IRON otimizada para contratos CALL/ACIMA',
    xmlPath: '/attached_assets/IRON OVER.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 0.5
    }
  },
  {
    id: 'iron_under',
    name: 'IRON UNDER',
    description: 'Estratégia IRON otimizada para contratos PUT/ABAIXO',
    xmlPath: '/attached_assets/IRON UNDER.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 0.5
    }
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia avançada de alta rentabilidade',
    xmlPath: '/attached_assets/MAXPRO .xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  },
  {
    id: 'advance',
    name: 'ADVANCE',
    description: 'Estratégia avançada com análise de tendência',
    xmlPath: '/attached_assets/Advance .xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  },
  {
    id: 'wise_pro_tendencia',
    name: 'WISE PRO TENDÊNCIA',
    description: 'Estratégia profissional com análise de tendência e reversão',
    xmlPath: '/attached_assets/WISE PRO TENDENCIA.xml',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  }
];

/**
 * Categorias de estratégias
 */
export const strategyCategories = {
  lite: availableStrategies.filter(s => 
    ['profitpro', 'manual_over', 'manual_under', 'bot_low'].includes(s.id)
  ),
  premium: availableStrategies.filter(s => 
    ['iron_over', 'iron_under', 'maxpro', 'advance', 'wise_pro_tendencia'].includes(s.id)
  )
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
  return strategyCategories[category] || [];
}

/**
 * Determina se uma estratégia é de maior risco
 */
export function isHighRiskStrategy(strategyId: string): boolean {
  return ['iron_over', 'iron_under', 'advance'].includes(strategyId);
}

/**
 * Verifica se uma estratégia usa previsão de dígito
 */
export function usesDigitPrediction(strategyId: string): boolean {
  return ['profitpro', 'manual_over', 'manual_under', 'iron_over', 'iron_under', 'advance'].includes(strategyId);
}

/**
 * Determina o tipo de contrato baseado na estratégia
 */
export function getContractTypeForStrategy(strategyId: string): string {
  if (['manual_over', 'iron_over'].includes(strategyId)) {
    return 'CALL';
  } else if (['manual_under', 'iron_under'].includes(strategyId)) {
    return 'PUT';
  } else if (['bot_low', 'maxpro', 'wise_pro_tendencia'].includes(strategyId)) {
    return 'DIGITDIFF';
  } else {
    // Profitpro e Advance usam DIGITOVER por padrão
    return 'DIGITOVER';
  }
}