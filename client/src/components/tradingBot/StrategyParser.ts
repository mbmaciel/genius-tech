// Types for XML strategies
interface XMLStrategy {
  id: string;
  name: string;
  description?: string;
  parameters: XMLStrategyParameter[];
  entryConditions: XMLStrategyCondition[];
  exitConditions?: XMLStrategyCondition[];
  moneyManagement?: XMLMoneyManagement;
}

interface XMLStrategyParameter {
  id: string;
  name: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  defaultValue: string | number | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

interface XMLStrategyCondition {
  type: 'indicator' | 'price' | 'time' | 'pattern';
  indicator?: string;
  parameter?: string;
  operator: '>' | '<' | '==' | '>=' | '<=' | '!=';
  value: string | number | boolean;
  timeframe?: string;
}

interface XMLMoneyManagement {
  initialStake: number;
  martingale?: {
    enable: boolean;
    multiplier: number;
    maxLevels: number;
  };
  stopLoss?: number;
  takeProfit?: number;
  maxConsecutiveLosses?: number;
}

/**
 * Sample hardcoded strategies in the format that would be parsed from XML
 */
function getHardcodedStrategies(): XMLStrategy[] {
  return [
    {
      id: 'IRON_OVER',
      name: 'IRON OVER',
      description: 'Estratégia otimizada para operações "acima de" (over)',
      parameters: [
        {
          id: 'timeframe',
          name: 'Timeframe',
          type: 'select',
          defaultValue: '1m',
          options: [
            { value: 'tick', label: 'Tick 1' },
            { value: '1m', label: '1 minuto' },
            { value: '5m', label: '5 minutos' },
            { value: '15m', label: '15 minutos' }
          ]
        },
        {
          id: 'period',
          name: 'Período',
          type: 'number',
          defaultValue: 14,
          min: 5,
          max: 50
        }
      ],
      entryConditions: [
        {
          type: 'indicator',
          indicator: 'RSI',
          operator: '<',
          value: 30,
          timeframe: '1m'
        },
        {
          type: 'price',
          parameter: 'close',
          operator: '<',
          value: 'EMA(14)',
          timeframe: '1m'
        }
      ],
      exitConditions: [
        {
          type: 'indicator',
          indicator: 'RSI',
          operator: '>',
          value: 70,
          timeframe: '1m'
        }
      ],
      moneyManagement: {
        initialStake: 5,
        martingale: {
          enable: true,
          multiplier: 2.0,
          maxLevels: 5
        },
        stopLoss: 50,
        takeProfit: 25,
        maxConsecutiveLosses: 3
      }
    },
    {
      id: 'IRON_UNDER',
      name: 'IRON UNDER',
      description: 'Estratégia otimizada para operações "abaixo de" (under)',
      parameters: [
        {
          id: 'timeframe',
          name: 'Timeframe',
          type: 'select',
          defaultValue: '1m',
          options: [
            { value: 'tick', label: 'Tick 1' },
            { value: '1m', label: '1 minuto' },
            { value: '5m', label: '5 minutos' },
            { value: '15m', label: '15 minutos' }
          ]
        },
        {
          id: 'period',
          name: 'Período',
          type: 'number',
          defaultValue: 14,
          min: 5,
          max: 50
        }
      ],
      entryConditions: [
        {
          type: 'indicator',
          indicator: 'RSI',
          operator: '>',
          value: 70,
          timeframe: '1m'
        },
        {
          type: 'price',
          parameter: 'close',
          operator: '>',
          value: 'EMA(14)',
          timeframe: '1m'
        }
      ],
      exitConditions: [
        {
          type: 'indicator',
          indicator: 'RSI',
          operator: '<',
          value: 30,
          timeframe: '1m'
        }
      ],
      moneyManagement: {
        initialStake: 5,
        martingale: {
          enable: true,
          multiplier: 2.0,
          maxLevels: 5
        },
        stopLoss: 50,
        takeProfit: 25,
        maxConsecutiveLosses: 3
      }
    },
    {
      id: 'MAXPRO',
      name: 'MAXPRO',
      description: 'Estratégia avançada com gerenciamento de risco otimizado',
      parameters: [
        {
          id: 'timeframe',
          name: 'Timeframe',
          type: 'select',
          defaultValue: '5m',
          options: [
            { value: '1m', label: '1 minuto' },
            { value: '5m', label: '5 minutos' },
            { value: '15m', label: '15 minutos' }
          ]
        }
      ],
      entryConditions: [
        {
          type: 'pattern',
          operator: '==',
          value: 'doji',
          timeframe: '5m'
        },
        {
          type: 'indicator',
          indicator: 'MACD',
          operator: '>',
          value: 'Signal',
          timeframe: '5m'
        }
      ],
      moneyManagement: {
        initialStake: 10,
        martingale: {
          enable: true,
          multiplier: 2.5,
          maxLevels: 4
        },
        stopLoss: 100,
        takeProfit: 50,
        maxConsecutiveLosses: 5
      }
    },
    {
      id: 'Green',
      name: 'Green',
      description: 'Estratégia de alta rentabilidade para mercados em tendência',
      parameters: [
        {
          id: 'period',
          name: 'Período',
          type: 'number',
          defaultValue: 20,
          min: 10,
          max: 50
        }
      ],
      entryConditions: [
        {
          type: 'indicator',
          indicator: 'Bollinger',
          parameter: 'lower',
          operator: '>',
          value: 'close',
          timeframe: '1m'
        }
      ],
      moneyManagement: {
        initialStake: 5,
        martingale: {
          enable: true,
          multiplier: 2.0,
          maxLevels: 6
        },
        stopLoss: 75,
        takeProfit: 40,
        maxConsecutiveLosses: 4
      }
    },
    {
      id: 'ProfitPro',
      name: 'ProfitPro',
      description: 'Estratégia com gerenciamento inteligente e alta taxa de acerto',
      parameters: [
        {
          id: 'symbol',
          name: 'Símbolo',
          type: 'select',
          defaultValue: 'R_100',
          options: [
            { value: 'R_10', label: 'Volatilidade 10' },
            { value: 'R_25', label: 'Volatilidade 25' },
            { value: 'R_50', label: 'Volatilidade 50' },
            { value: 'R_75', label: 'Volatilidade 75' },
            { value: 'R_100', label: 'Volatilidade 100' }
          ]
        }
      ],
      entryConditions: [
        {
          type: 'pattern',
          operator: '==',
          value: 'digitAnalysis',
          timeframe: 'tick'
        }
      ],
      moneyManagement: {
        initialStake: 5,
        martingale: {
          enable: true,
          multiplier: 2.0,
          maxLevels: 5
        },
        stopLoss: 50,
        takeProfit: 30,
        maxConsecutiveLosses: 3
      }
    }
  ];
}

/**
 * Function to simulate parsing XML strategies
 * In a real application, this would parse actual XML files
 */
export function parseXMLStrategy(strategyId?: string): XMLStrategy | XMLStrategy[] {
  const strategies = getHardcodedStrategies();
  
  if (strategyId) {
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) {
      throw new Error(`Strategy with ID ${strategyId} not found`);
    }
    return strategy;
  }
  
  return strategies;
}

/**
 * Function to get default strategy parameters
 */
export function getDefaultStrategyParameters(strategyId: string): Record<string, any> {
  try {
    const strategy = parseXMLStrategy(strategyId) as XMLStrategy;
    
    const params: Record<string, any> = {};
    strategy.parameters.forEach(param => {
      params[param.id] = param.defaultValue;
    });
    
    // Add money management defaults
    if (strategy.moneyManagement) {
      params.initialStake = strategy.moneyManagement.initialStake;
      
      if (strategy.moneyManagement.martingale) {
        params.enableMartingale = strategy.moneyManagement.martingale.enable;
        params.martingaleMultiplier = strategy.moneyManagement.martingale.multiplier;
        params.maxMartingaleLevels = strategy.moneyManagement.martingale.maxLevels;
      }
      
      if (strategy.moneyManagement.stopLoss) {
        params.stopLoss = strategy.moneyManagement.stopLoss;
      }
      
      if (strategy.moneyManagement.takeProfit) {
        params.takeProfit = strategy.moneyManagement.takeProfit;
      }
      
      if (strategy.moneyManagement.maxConsecutiveLosses) {
        params.maxConsecutiveLosses = strategy.moneyManagement.maxConsecutiveLosses;
      }
    }
    
    return params;
  } catch (error) {
    console.error(`Error getting default parameters for strategy ${strategyId}:`, error);
    return {};
  }
}

/**
 * Function to validate a strategy XML
 * This would be more complex in a real application
 */
export function validateStrategyXML(xmlString: string): boolean {
  try {
    // In a real application, this would parse and validate the XML
    // For this implementation, we'll just check if it looks like XML
    return xmlString.includes('<strategy>') && xmlString.includes('</strategy>');
  } catch (error) {
    console.error('Error validating strategy XML:', error);
    return false;
  }
}
