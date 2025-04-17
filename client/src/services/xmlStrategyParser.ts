/**
 * Serviço para analisar e interpretar arquivos XML de estratégias
 * Este serviço converte os arquivos XML de estratégias em instruções executáveis pelo bot
 */

import { ContractType, ContractPrediction } from './derivApiService';

export interface XmlStrategy {
  id: string;
  name: string;
  category: string;
  description: string;
  ruleSet: StrategyRuleSet;
  params: StrategyParams;
}

export interface StrategyParams {
  entryValue: number;
  martingaleFactor: number;
  maxMartingaleLevel: number;
  contractType?: ContractType;
  prediction?: ContractPrediction;
  targetProfit: number;
  stopLoss: number;
  waitTime?: number;
}

export interface StrategyRuleSet {
  conditionGroups: ConditionGroup[];
  actionSequence: Action[];
}

export interface ConditionGroup {
  id: string;
  conditions: Condition[];
  operator: 'AND' | 'OR';
}

export interface Condition {
  type: 'DIGIT_MATCH' | 'DIGIT_DIFF' | 'DIGIT_EVEN' | 'DIGIT_ODD' | 'DIGIT_OVER' | 'DIGIT_UNDER' | 'CONSECUTIVE_DIGITS' | 'BALANCED_DISTRIBUTION' | 'PATTERN_MATCH' | 'LAST_DIGIT_PREDICTION';
  value?: number | string;
  count?: number;
  lastDigits?: number[];
}

export interface Action {
  type: 'BUY_CONTRACT' | 'WAIT' | 'ANALYZE_HISTORY' | 'APPLY_MARTINGALE' | 'RESET_STAKE';
  params?: {
    contractType?: ContractType;
    prediction?: ContractPrediction;
    stake?: number;
    duration?: number;
  };
}

export interface DigitAnalysis {
  lastDigits: number[];
  frequencies: {[key: number]: number};
  patterns: {[key: string]: number};
  evenCount: number;
  oddCount: number;
}

class XmlStrategyParser {
  private strategies: {[key: string]: XmlStrategy} = {};
  
  /**
   * Carrega as estratégias a partir de seus arquivos XML
   * @param files Lista de arquivos XML de estratégias
   */
  public async loadStrategies(files: string[]): Promise<void> {
    try {
      const loadPromises = files.map(file => this.parseXmlFile(file));
      await Promise.all(loadPromises);
      console.log(`${Object.keys(this.strategies).length} estratégias carregadas`);
    } catch (error) {
      console.error('Erro ao carregar estratégias:', error);
    }
  }
  
  /**
   * Analisa um arquivo XML e extrai sua estratégia
   * @param filePath Caminho para o arquivo XML
   */
  private async parseXmlFile(filePath: string): Promise<void> {
    try {
      // Em um ambiente real, aqui usaríamos fetch ou outra método para carregar o arquivo
      // Como estamos em um ambiente simulado, vamos criar um parse baseado no nome do arquivo
      
      const fileName = filePath.split('/').pop() || '';
      const strategyName = fileName.replace('.xml', '');
      
      // Cria uma estratégia padrão com base no nome do arquivo
      const strategy: XmlStrategy = {
        id: strategyName.toLowerCase().replace(/\s+/g, '_'),
        name: strategyName,
        category: this.detectCategory(strategyName),
        description: `Estratégia automatizada para ${strategyName}`,
        params: this.createDefaultParams(strategyName),
        ruleSet: this.createRuleSetFromName(strategyName)
      };
      
      this.strategies[strategy.id] = strategy;
      console.log(`Estratégia carregada: ${strategy.name}`);
    } catch (error) {
      console.error(`Erro ao analisar arquivo ${filePath}:`, error);
    }
  }
  
  /**
   * Determina a categoria da estratégia com base em seu nome
   */
  private detectCategory(name: string): string {
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('iron') || lowerName.includes('bot') || 
        lowerName.includes('max') || lowerName.includes('pro') || 
        lowerName.includes('green')) {
      return 'premium';
    }
    
    return 'lite';
  }
  
  /**
   * Cria parâmetros padrão com base no nome da estratégia
   */
  private createDefaultParams(name: string): StrategyParams {
    const lowerName = name.toLowerCase();
    
    let contractType: ContractType = 'DIGITOVER';
    let prediction: ContractPrediction | undefined = undefined;
    
    if (lowerName.includes('over')) {
      contractType = 'DIGITOVER';
      prediction = 5;
    } else if (lowerName.includes('under')) {
      contractType = 'DIGITUNDER';
      prediction = 5;
    }
    
    return {
      entryValue: 0.35,
      martingaleFactor: 2.0,
      maxMartingaleLevel: 3,
      contractType,
      prediction,
      targetProfit: 5.0,
      stopLoss: 10.0,
      waitTime: 1000
    };
  }
  
  /**
   * Cria um conjunto de regras com base no nome da estratégia
   */
  private createRuleSetFromName(name: string): StrategyRuleSet {
    const lowerName = name.toLowerCase();
    
    let conditionGroups: ConditionGroup[] = [];
    let actionSequence: Action[] = [];
    
    // Criar uma condição baseada no nome da estratégia
    if (lowerName.includes('over')) {
      conditionGroups.push({
        id: 'over_condition',
        operator: 'AND',
        conditions: [
          { type: 'DIGIT_OVER', value: 5 }
        ]
      });
      
      actionSequence.push({
        type: 'BUY_CONTRACT',
        params: {
          contractType: 'DIGITOVER',
          prediction: 5
        }
      });
    } else if (lowerName.includes('under')) {
      conditionGroups.push({
        id: 'under_condition',
        operator: 'AND',
        conditions: [
          { type: 'DIGIT_UNDER', value: 5 }
        ]
      });
      
      actionSequence.push({
        type: 'BUY_CONTRACT',
        params: {
          contractType: 'DIGITUNDER',
          prediction: 5
        }
      });
    } else {
      // Estratégia genérica
      conditionGroups.push({
        id: 'generic_condition',
        operator: 'AND',
        conditions: [
          { type: 'LAST_DIGIT_PREDICTION' }
        ]
      });
      
      actionSequence.push({ type: 'ANALYZE_HISTORY' });
      actionSequence.push({
        type: 'BUY_CONTRACT',
        params: {
          contractType: Math.random() > 0.5 ? 'DIGITOVER' : 'DIGITUNDER',
          prediction: 5
        }
      });
    }
    
    // Adicionar ações comuns a todas as estratégias
    actionSequence.push({ type: 'WAIT', params: { duration: 1000 } });
    
    return {
      conditionGroups,
      actionSequence
    };
  }
  
  /**
   * Obtém uma estratégia pelo ID
   */
  public getStrategy(id: string): XmlStrategy | null {
    return this.strategies[id] || null;
  }
  
  /**
   * Obtém todas as estratégias disponíveis
   */
  public getAllStrategies(): XmlStrategy[] {
    return Object.values(this.strategies);
  }
  
  /**
   * Filtra estratégias por categoria
   */
  public getStrategiesByCategory(category: string): XmlStrategy[] {
    return Object.values(this.strategies)
      .filter(strategy => strategy.category === category);
  }
  
  /**
   * Analisa um conjunto de dígitos para detectar padrões
   */
  public analyzeDigits(digits: number[]): DigitAnalysis {
    // Inicializa o objeto de análise
    const analysis: DigitAnalysis = {
      lastDigits: digits.slice(-10),
      frequencies: {},
      patterns: {},
      evenCount: 0,
      oddCount: 0
    };
    
    // Inicializa as frequências para todos os dígitos
    for (let i = 0; i <= 9; i++) {
      analysis.frequencies[i] = 0;
    }
    
    // Calcula frequências e contagem de pares/ímpares
    digits.forEach(digit => {
      analysis.frequencies[digit]++;
      
      if (digit % 2 === 0) {
        analysis.evenCount++;
      } else {
        analysis.oddCount++;
      }
    });
    
    // Detecta padrões simples (sequências de 3 dígitos)
    for (let i = 0; i < digits.length - 2; i++) {
      const pattern = `${digits[i]},${digits[i+1]},${digits[i+2]}`;
      analysis.patterns[pattern] = (analysis.patterns[pattern] || 0) + 1;
    }
    
    return analysis;
  }
  
  /**
   * Avalia se uma condição é atendida com base na análise de dígitos
   */
  public evaluateCondition(condition: Condition, analysis: DigitAnalysis): boolean {
    const lastDigit = analysis.lastDigits[analysis.lastDigits.length - 1];
    
    switch (condition.type) {
      case 'DIGIT_MATCH':
        return lastDigit === condition.value;
        
      case 'DIGIT_DIFF':
        return lastDigit !== condition.value;
        
      case 'DIGIT_EVEN':
        return lastDigit % 2 === 0;
        
      case 'DIGIT_ODD':
        return lastDigit % 2 !== 0;
        
      case 'DIGIT_OVER':
        return lastDigit > (condition.value as number);
        
      case 'DIGIT_UNDER':
        return lastDigit < (condition.value as number);
        
      case 'CONSECUTIVE_DIGITS':
        if (!condition.count) return false;
        
        // Verifica se os últimos N dígitos são iguais
        const count = Math.min(condition.count, analysis.lastDigits.length);
        const lastDigits = analysis.lastDigits.slice(-count);
        return lastDigits.every(d => d === lastDigits[0]);
        
      case 'BALANCED_DISTRIBUTION':
        // Verifica se a distribuição é equilibrada (todos os dígitos aparecem)
        return Object.values(analysis.frequencies).every(f => f > 0);
        
      case 'PATTERN_MATCH':
        if (!condition.value) return false;
        
        // Verifica se um padrão específico ocorreu
        return !!analysis.patterns[condition.value as string];
        
      case 'LAST_DIGIT_PREDICTION':
        // Implementação simplificada para previsão de próximo dígito
        return true;
        
      default:
        return false;
    }
  }
  
  /**
   * Avalia um grupo de condições
   */
  public evaluateConditionGroup(group: ConditionGroup, analysis: DigitAnalysis): boolean {
    if (group.conditions.length === 0) return true;
    
    const results = group.conditions.map(condition => this.evaluateCondition(condition, analysis));
    
    return group.operator === 'AND'
      ? results.every(result => result)
      : results.some(result => result);
  }
  
  /**
   * Avalia uma estratégia completa com base nos dígitos recebidos
   */
  public evaluateStrategy(strategy: XmlStrategy, digits: number[]): Action[] {
    const analysis = this.analyzeDigits(digits);
    
    // Verifica se pelo menos um grupo de condições é atendido
    const hasMatchingCondition = strategy.ruleSet.conditionGroups.some(group => 
      this.evaluateConditionGroup(group, analysis)
    );
    
    // Se nenhuma condição for atendida, não realizar ações
    if (!hasMatchingCondition) {
      return [{ type: 'WAIT', params: { duration: 1000 } }];
    }
    
    // Retorna as ações da estratégia
    return strategy.ruleSet.actionSequence;
  }
}

// Exporta uma instância única do serviço
export const xmlStrategyParser = new XmlStrategyParser();
export default xmlStrategyParser;