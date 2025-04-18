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
    type: 'BOTH',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  {
    id: 'manual_over',
    name: 'Manual Over',
    description: 'Estratégia manual otimizada para contratos CALL/ACIMA',
    xmlPath: '/attached_assets/Manual Over.xml',
    type: 'RISE',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  {
    id: 'manual_under',
    name: 'Manual Under',
    description: 'Estratégia manual otimizada para contratos PUT/ABAIXO',
    xmlPath: '/attached_assets/Manual Under.xml',
    type: 'FALL',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  {
    id: 'bot_low',
    name: 'BOT LOW',
    description: 'Estratégia simples otimizada para operações de baixo risco',
    xmlPath: '/attached_assets/BOT LOW.xml',
    type: 'BOTH',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  
  // Estratégias premium
  {
    id: 'iron_over',
    name: 'IRON OVER',
    description: 'Estratégia IRON otimizada para contratos CALL/ACIMA',
    xmlPath: '/attached_assets/IRON OVER.xml',
    type: 'RISE',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 0.5,
      maxMartingaleLevel: 2
    }
  },
  {
    id: 'iron_under',
    name: 'IRON UNDER',
    description: 'Estratégia IRON otimizada para contratos PUT/ABAIXO',
    xmlPath: '/attached_assets/IRON UNDER.xml',
    type: 'FALL',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 0.5,
      maxMartingaleLevel: 2
    }
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia avançada de alta rentabilidade',
    xmlPath: '/attached_assets/MAXPRO .xml',
    type: 'BOTH',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  {
    id: 'advance',
    name: 'ADVANCE',
    description: 'Estratégia avançada com análise de tendência',
    xmlPath: '/attached_assets/Advance .xml',
    type: 'ADVANCED',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  {
    id: 'wise_pro_tendencia',
    name: 'WISE PRO TENDÊNCIA',
    description: 'Estratégia profissional com análise de tendência e reversão',
    xmlPath: '/attached_assets/WISE PRO TENDENCIA.xml',
    type: 'BOTH',
    config: {
      initialStake: 0.35,
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
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
  // Normalizar o ID para comparação
  const id = (strategyId || '').toLowerCase();
  
  // Verificar todas as estratégias que usam dígitos
  return ['profitpro', 'manual_over', 'manual_under', 'iron_over', 'iron_under', 'advance',
          'wise_pro_tendencia', 'bot_low', 'maxpro', 'green'].some(s => 
            id.includes(s.toLowerCase())
          );
}

/**
 * Determina o tipo de contrato baseado na estratégia
 */
export function getContractTypeForStrategy(strategyId: string): string {
  // Normalizar o ID para comparação
  const id = (strategyId || '').toLowerCase();
  
  // Verificar estratégias CALL (ACIMA)
  if (id.includes('over') || id.includes('acima')) {
    return 'CALL';
  } 
  // Verificar estratégias PUT (ABAIXO)
  else if (id.includes('under') || id.includes('abaixo')) {
    return 'PUT';
  } 
  // Verificar estratégias que usam DIGITDIFF
  else if (id.includes('bot_low') || id.includes('bot low') || 
           id.includes('maxpro') || id.includes('wise') ||
           id.includes('tendencia')) {
    return 'DIGITDIFF';
  } 
  // Default é DIGITOVER
  else {
    return 'DIGITOVER';
  }
}