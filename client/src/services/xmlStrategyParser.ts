/**
 * Serviço para análise de estratégias XML do Binary Bot
 */

// Verifica se uma estratégia é do tipo "Advance"
export function isAdvanceStrategy(strategyId: string): boolean {
  // No momento apenas a estratégia 'advance' tem configurações especiais
  return strategyId === 'advance';
}

// Esta função analisaria o XML de uma estratégia para extrair informações
export async function parseStrategyXml(xmlPath: string) {
  try {
    // Essa implementação seria mais completa em um caso real,
    // carregando e analisando o XML de estratégia
    // Como é apenas para testes, retornamos um objeto padrão
    
    return {
      name: xmlPath.replace('.xml', ''),
      type: xmlPath.includes('OVER') ? 'DIGITOVER' : 'DIGITUNDER',
      prediction: 1,
      duration: 1,
      duration_unit: 'tick',
      parameters: {
        analysisWindow: 25,
        digitFrequencyThreshold: 20,
      }
    };
  } catch (error) {
    console.error('Erro ao analisar estratégia XML:', error);
    throw new Error('Falha ao carregar estratégia XML');
  }
}

// Tipos e interfaces para estratégias
export interface StrategyConfig {
  id: string;
  name: string;
  type: string;
  prediction?: number;
  duration?: number;
  duration_unit?: string;
  parameters?: Record<string, any>;
}

export interface StrategyAnalysisResult {
  shouldEnter: boolean;
  contract_type: string;
  prediction?: number;
  direction?: 'rise' | 'fall';
  reason?: string;
}

// Função de exemplo para a estratégia Advance
export function evaluateAdvanceStrategy(
  digitStats: Record<number, { percentage: number }>,
  config: { digitFrequencyThreshold: number }
): StrategyAnalysisResult {
  // Verifica se as estatísticas estão disponíveis
  if (!digitStats[0] || !digitStats[1]) {
    return {
      shouldEnter: false,
      contract_type: 'DIGITOVER',
      reason: 'Estatísticas de dígitos não disponíveis'
    };
  }
  
  // Calcula a frequência combinada dos dígitos 0 e 1
  const combinedFrequency = digitStats[0].percentage + digitStats[1].percentage;
  
  // Verifica se está abaixo do limiar de frequência
  if (combinedFrequency < config.digitFrequencyThreshold) {
    return {
      shouldEnter: true,
      contract_type: 'DIGITOVER',
      prediction: 1,
      reason: `Frequência de dígitos 0-1 (${combinedFrequency.toFixed(1)}%) abaixo do limiar (${config.digitFrequencyThreshold}%)`
    };
  }
  
  return {
    shouldEnter: false,
    contract_type: 'DIGITOVER',
    prediction: 1,
    reason: `Frequência de dígitos 0-1 (${combinedFrequency.toFixed(1)}%) acima do limiar (${config.digitFrequencyThreshold}%)`
  };
}