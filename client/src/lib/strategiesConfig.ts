/**
 * Configuração das estratégias disponíveis no sistema
 */

export interface Strategy {
  id: string;
  name: string;
  description: string;
  xmlPath: string;
  type?: 'standard' | 'advance' | 'custom';
  contractType?: string;
  entryCondition?: string;
}

// Lista de estratégias disponíveis
export const strategies: Strategy[] = [
  {
    id: 'advance',
    name: 'Advance',
    description: 'Estratégia baseada em análise de frequência de dígitos 0-1',
    xmlPath: '/attached_assets/Advance.xml',
    type: 'advance',
    contractType: 'DIGITOVER',
    entryCondition: 'Quando os dígitos 0-1 representam 30% ou menos do total'
  },
  {
    id: 'iron_over',
    name: 'IRON OVER',
    description: 'Estratégia IRON para contratos DIGITOVER',
    xmlPath: '/attached_assets/IRON OVER.xml',
    type: 'standard',
    contractType: 'DIGITOVER'
  },
  {
    id: 'iron_under',
    name: 'IRON UNDER',
    description: 'Estratégia IRON para contratos DIGITUNDER',
    xmlPath: '/attached_assets/IRON UNDER.xml',
    type: 'standard',
    contractType: 'DIGITUNDER'
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia MAXPRO otimizada',
    xmlPath: '/attached_assets/MAXPRO.xml',
    type: 'standard'
  },
  {
    id: 'bot_low',
    name: 'BOT LOW',
    description: 'Estratégia BOT LOW para momentos de baixa volatilidade',
    xmlPath: '/attached_assets/BOT LOW.xml',
    type: 'standard'
  },
  {
    id: 'manual_over',
    name: 'Manual Over',
    description: 'Estratégia manual para DIGITOVER',
    xmlPath: '/attached_assets/Manual Over.xml',
    type: 'standard',
    contractType: 'DIGITOVER'
  },
  {
    id: 'manual_under',
    name: 'Manual Under',
    description: 'Estratégia manual para DIGITUNDER',
    xmlPath: '/attached_assets/Manual Under.xml',
    type: 'standard',
    contractType: 'DIGITUNDER'
  }
];

/**
 * Encontra uma estratégia pelo ID
 */
export function getStrategyById(id: string): Strategy | undefined {
  return strategies.find(strategy => strategy.id === id);
}

/**
 * Retorna o caminho para o arquivo XML de uma estratégia
 */
export function getStrategyXmlPath(id: string): string | undefined {
  const strategy = getStrategyById(id);
  return strategy?.xmlPath;
}

/**
 * Retorna as estratégias filtradas por tipo
 */
export function getStrategiesByType(type?: 'standard' | 'advance' | 'custom'): Strategy[] {
  if (!type) return strategies;
  return strategies.filter(strategy => strategy.type === type);
}

/**
 * Retorna as estratégias padrão (não customizadas)
 */
export function getStandardStrategies(): Strategy[] {
  return strategies.filter(strategy => strategy.type === 'standard');
}