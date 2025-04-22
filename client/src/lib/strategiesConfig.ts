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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
    xmlPath: '/client/public/IRON_OVER.xml', // MODIFICADO: Usando XML corrigido
    type: 'RISE',
    config: {
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3,
      // Valor específico da porcentagem para entrar da estratégia Advance
      // Aumentando valor padrão para 70% (mais conservador/seguro)
      entryPercentage: 70
    }
  },
  {
    id: 'wise_pro_tendencia',
    name: 'WISE PRO TENDÊNCIA',
    description: 'Estratégia profissional com análise de tendência e reversão',
    xmlPath: '/attached_assets/WISE PRO TENDENCIA.xml',
    type: 'BOTH',
    config: {
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
      targetProfit: 20,
      stopLoss: 10,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3
    }
  },
  {
    id: 'green',
    name: 'Green',
    description: 'Estratégia Green para contratos binários',
    xmlPath: '/attached_assets/green.xml',
    type: 'BOTH',
    config: {
      initialStake: 1.0, // CORREÇÃO: Valor default mais visível
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
    ['iron_over', 'iron_under', 'maxpro', 'advance', 'wise_pro_tendencia', 'green'].includes(s.id)
  )
};

/**
 * Mapeamento de IDs da interface para IDs do sistema
 */
const idMapping: Record<string, string> = {
  // Mapeamento dos IDs da interface para IDs do sistema
  'profitpro': 'profitpro',
  'manualover': 'manual_over',
  'manualunder': 'manual_under',
  'botlow': 'bot_low',
  'ironover': 'iron_over',
  'ironunder': 'iron_under',
  'maxpro': 'maxpro',
  'advance': 'advance',
  'wisetendencia': 'wise_pro_tendencia',
  'green': 'green',
  
  // Colocar também o mapeamento inverso para aceitar ambos formatos
  'manual_over': 'manual_over',
  'manual_under': 'manual_under',
  'bot_low': 'bot_low',
  'iron_over': 'iron_over',
  'iron_under': 'iron_under',
  'wise_pro_tendencia': 'wise_pro_tendencia',
  
  // Mais variações comuns nos nomes de estratégias para garantir compatibilidade
  'manual over': 'manual_over',
  'manual under': 'manual_under',
  'bot low': 'bot_low',
  'iron over': 'iron_over',
  'iron under': 'iron_under',
  'wise pro tendencia': 'wise_pro_tendencia',
  'wise pro tendência': 'wise_pro_tendencia'
};

/**
 * Obtém uma estratégia pelo ID
 */
export function getStrategyById(id: string): BinaryBotStrategy | null {
  console.log("[STRATEGY_CONFIG] ★ Buscando estratégia com ID:", id);
  
  // Passo 1: Tentar usar o ID diretamente
  const directStrategy = availableStrategies.find(strategy => strategy.id === id);
  if (directStrategy) {
    console.log("[STRATEGY_CONFIG] ★ Estratégia encontrada diretamente:", directStrategy.name);
    return directStrategy;
  }
  
  // Passo 2: Tentar usar o mapeamento
  const mappedId = idMapping[id];
  if (mappedId) {
    const mappedStrategy = availableStrategies.find(strategy => strategy.id === mappedId);
    if (mappedStrategy) {
      console.log("[STRATEGY_CONFIG] ★ Estratégia encontrada via mapeamento:", mappedStrategy.name);
      return mappedStrategy;
    }
  }
  
  // Passo 3: Tentar busca flexível baseada em substring
  const normalizedId = id.toLowerCase();
  for (const strategy of availableStrategies) {
    const strategyId = strategy.id.toLowerCase();
    const strategyName = strategy.name.toLowerCase();
    
    if (strategyId.includes(normalizedId) || normalizedId.includes(strategyId) ||
        strategyName.includes(normalizedId) || normalizedId.includes(strategyName)) {
      console.log("[STRATEGY_CONFIG] ★ Estratégia encontrada via busca flexível:", strategy.name);
      return strategy;
    }
  }
  
  console.warn("[STRATEGY_CONFIG] ⚠️ Nenhuma estratégia encontrada para o ID:", id);
  return null;
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
  // Green estratégia
  else if (id.includes('green')) {
    return 'DIGITOVER';
  }
  // Default é DIGITOVER
  else {
    return 'DIGITOVER';
  }
}