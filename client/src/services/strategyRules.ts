/**
 * Regras de estratégias para os bots de trading
 * Implementação das condições específicas de cada bot
 */

// Tipos de estatísticas de dígitos
export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export type ContractType = 'CALL' | 'PUT' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITDIFF' | 'DIGITEVEN' | 'DIGITODD';

/**
 * Avalia a estratégia ADVANCE
 * Regra: Comprar APENAS quando os dígitos 0 E 1 tiverem frequência MENOR OU IGUAL à porcentagem definida pelo usuário
 * A análise DEVE utilizar EXATAMENTE os últimos 25 ticks para calcular os percentuais
 */
export function evaluateAdvanceStrategy(
  digitStats: DigitStat[],
  entryPercentage: number | undefined
): { 
  shouldEnter: boolean; 
  contractType: ContractType; 
  message: string;
  analysis: { digit0: number; digit1: number; threshold: number }; // Adicionamos análise para o histórico
  shouldLog: boolean; // Flag para informar que esta análise deve ser registrada no histórico, mesmo sem entrada
} {
  // Garantir que sempre temos um valor para porcentagem
  // Se valor não estiver definido, usar 10% como padrão
  const percentageToUse = entryPercentage !== undefined ? entryPercentage : 10;
  
  // Log adicional para debug detalhado
  console.log(`[STRATEGY_RULES] ADVANCE: Analisando com porcentagem definida pelo usuário: ${percentageToUse}%`);
  console.log(`[STRATEGY_RULES] ADVANCE: Total de estatísticas recebidas: ${digitStats.length} dígitos`);
  
  // Reescrita da validação para simplicidade e clareza
  if (typeof percentageToUse !== 'number' || isNaN(percentageToUse)) {
    return { 
      shouldEnter: false, 
      contractType: 'CALL', // A estratégia Advance usa CALL para melhor compatibilidade
      message: `Configuração de porcentagem inválida: ${percentageToUse}. Usando valor padrão 10%.`,
      analysis: { digit0: 0, digit1: 0, threshold: 10 },
      shouldLog: false // NÃO registramos esta operação intermediária no histórico (CORREÇÃO)
    };
  }
  
  // CRÍTICO: Verificar se temos dados suficientes (exatamente 25 ticks são necessários)
  // Contamos o total de ticks representados nas estatísticas
  const totalTicksRepresented = digitStats.reduce((sum, stat) => sum + stat.count, 0);
  
  // Log para depuração
  console.log(`[STRATEGY_RULES] ADVANCE: Total de ticks nas estatísticas: ${totalTicksRepresented}`);
  
  // Verificamos se temos exatamente 25 ticks para análise
  // Se não tiver pelo menos 25, não podemos prosseguir com análise precisa
  if (totalTicksRepresented < 25) {
    return { 
      shouldEnter: false, 
      contractType: 'CALL', // Tipo correto para estratégia Advance
      message: `ADVANCE: Dados insuficientes para análise. Necessários exatamente 25 ticks, temos ${totalTicksRepresented}.`,
      analysis: { digit0: 0, digit1: 0, threshold: percentageToUse },
      shouldLog: true // Registramos esta análise no histórico
    };
  }
  
  // Extrair estatísticas para os dígitos 0 e 1 dos últimos 25 ticks
  const digit0 = digitStats.find(stat => stat.digit === 0);
  const digit1 = digitStats.find(stat => stat.digit === 1);
  
  // Certifique-se de sempre ter valores, mesmo que sejam zeros
  const digit0Percentage = digit0 ? Math.round(digit0.percentage) : 0;
  const digit1Percentage = digit1 ? Math.round(digit1.percentage) : 0;
  
  // Log para depuração
  console.log(`[STRATEGY_RULES] ADVANCE: Baseado nos últimos 25 ticks:`);
  console.log(`[STRATEGY_RULES] ADVANCE:   - Dígito 0: ${digit0Percentage}%`);
  console.log(`[STRATEGY_RULES] ADVANCE:   - Dígito 1: ${digit1Percentage}%`);
  console.log(`[STRATEGY_RULES] ADVANCE:   - Limite definido pelo usuário: ${percentageToUse}%`);
  
  // Se não encontrou estatísticas para esses dígitos específicos, usar zeros
  // mas ainda registramos no histórico para transparência
  if (!digit0 || !digit1) {
    return { 
      shouldEnter: false, 
      contractType: 'CALL', 
      message: 'ADVANCE: Calculando estatísticas para dígitos 0 e 1...',
      analysis: { digit0: digit0Percentage, digit1: digit1Percentage, threshold: percentageToUse },
      shouldLog: true // Registramos esta análise no histórico
    };
  }
  
  // CRÍTICO: Adicionar log específico para debugar os valores usados na comparação
  console.log(`[STRATEGY_RULES] ADVANCE DEBUG: Comparando digit0=${digit0Percentage}% e digit1=${digit1Percentage}% com limite=${percentageToUse}%`);
  
  // Verificar se AMBOS os dígitos 0 E 1 estão com percentual MENOR OU IGUAL ao definido pelo usuário
  // IMPORTANTE: Esta é a condição principal que determina a entrada na operação
  const shouldEnter = digit0Percentage <= percentageToUse && digit1Percentage <= percentageToUse;
  
  console.log(`[STRATEGY_RULES] ADVANCE RESULTADO: shouldEnter=${shouldEnter}`);
  console.log(`[STRATEGY_RULES] 🔍 Verificando ambos os dígitos: 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) <= ${percentageToUse}%`);
  
  // Notificar usuário no console para diagnóstico
  if (shouldEnter) {
    console.log(`[STRATEGY_RULES] 🚀🚀🚀 ATENÇÃO: CONDIÇÃO DE ENTRADA IDENTIFICADA! Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) <= ${percentageToUse}%`);
  }
  
  // Determinar mensagem de feedback explícita incluindo o valor definido pelo usuário
  let message = shouldEnter 
    ? `ADVANCE XML: ✅ Condição satisfeita! Executando DIGITOVER conforme XML. Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${percentageToUse}%`
    : `ADVANCE XML: ❌ Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${percentageToUse}%`;
    
  return { 
    shouldEnter, 
    contractType: 'DIGITOVER', // CORRIGIDO CONFORME XML: <purchase>DIGITOVER</purchase>
    message,
    analysis: { digit0: digit0Percentage, digit1: digit1Percentage, threshold: percentageToUse },
    shouldLog: true // Sempre registramos estas análises no histórico para transparência completa
  };
}

/**
 * Avalia a estratégia IRON OVER
 * Regra: Usa contratos DIGITOVER e respeita o número de perdas para aplicar martingale
 * 
 * IMPLEMENTAÇÃO EXATA DO XML: <purchase>DIGITOVER</purchase>
 */
export function evaluateIronOverStrategy(
  digitStats: DigitStat[],
  prediction: number = 5,
  consecutiveLosses: number = 0,
  martingaleAfterLosses: number = 2
): { shouldEnter: boolean; contractType: ContractType; useMartingale: boolean; message: string } {
  // Logs para diagnóstico
  console.log(`[STRATEGY_RULES] 🚀 IRON OVER XML: Executando compra DIGITOVER conforme definido no XML`);
  console.log(`[STRATEGY_RULES] 🚀 IRON OVER XML: Previsão=${prediction}, Perdas consecutivas=${consecutiveLosses}`);
  
  // IRON OVER SEMPRE faz DIGITOVER, conforme XML (sem condição)
  const shouldEnter = true;
  const contractType: ContractType = 'DIGITOVER';
  
  // Determinar se deve aplicar martingale baseado no número de perdas consecutivas
  const useMartingale = consecutiveLosses >= martingaleAfterLosses;
  
  const message = useMartingale
    ? `IRON OVER XML: Usando martingale após ${consecutiveLosses} perdas (limite: ${martingaleAfterLosses}). Previsão: DIGITOVER ${prediction}`
    : `IRON OVER XML: Operação normal sem martingale. Previsão: DIGITOVER ${prediction}`;
  
  // Logs para diagnóstico
  console.log(`[STRATEGY_RULES] 🚀 IRON OVER XML: shouldEnter=${shouldEnter}, Tipo=${contractType}, useMartingale=${useMartingale}`);
  
  return {
    shouldEnter,
    contractType,
    useMartingale,
    message
  };
}

/**
 * Avalia a estratégia IRON UNDER
 * Similar à IRON OVER, mas com lógica invertida e usa DIGITUNDER
 * IMPORTANTE: A API Deriv exige que o valor 'digit' esteja no range 1-9
 * 
 * IMPLEMENTAÇÃO EXATA DO XML: <purchase>DIGITUNDER</purchase>
 */
export function evaluateIronUnderStrategy(
  digitStats: DigitStat[],
  prediction: number = 5, // ATUALIZADO: Agora usamos 5 como padrão - API Deriv requer valores entre 1-9
  consecutiveLosses: number = 0,
  martingaleAfterLosses: number = 2
): { shouldEnter: boolean; contractType: ContractType; useMartingale: boolean; message: string } {
  // Validação de segurança para garantir que prediction esteja no intervalo permitido
  if (prediction < 1 || prediction > 9) {
    console.warn(`[STRATEGY_RULES] IRON UNDER XML: Previsão ${prediction} fora do intervalo permitido (1-9). Ajustando para 5.`);
    prediction = 5; // Valor seguro dentro do intervalo permitido
  }
  
  // Logs para diagnóstico
  console.log(`[STRATEGY_RULES] 🚀 IRON UNDER XML: Executando compra DIGITUNDER conforme definido no XML`);
  console.log(`[STRATEGY_RULES] 🚀 IRON UNDER XML: Previsão=${prediction}, Perdas consecutivas=${consecutiveLosses}`);
  
  // IRON UNDER SEMPRE faz DIGITUNDER, conforme XML (sem condição)
  const shouldEnter = true;
  const contractType: ContractType = 'DIGITUNDER';
  
  // Determinar se deve aplicar martingale baseado no número de perdas consecutivas
  const useMartingale = consecutiveLosses >= martingaleAfterLosses;
  
  const message = useMartingale
    ? `IRON UNDER XML: Usando martingale após ${consecutiveLosses} perdas (limite: ${martingaleAfterLosses}). Previsão: DIGITUNDER ${prediction}`
    : `IRON UNDER XML: Operação normal sem martingale. Previsão: DIGITUNDER ${prediction}`;
  
  // Logs para diagnóstico
  console.log(`[STRATEGY_RULES] 🚀 IRON UNDER XML: shouldEnter=${shouldEnter}, Tipo=${contractType}, useMartingale=${useMartingale}`);
  
  return {
    shouldEnter,
    contractType,
    useMartingale,
    message
  };
}

/**
 * Avalia a estratégia MAXPRO
 * Usa análise de padrões de dígitos e filtra por distribuição equilibrada
 */
export function evaluateMaxProStrategy(
  digitStats: DigitStat[]
): { shouldEnter: boolean; contractType: ContractType; prediction: number; message: string } {
  // Ordenar dígitos por frequência (do menor para o maior)
  const sortedStats = [...digitStats].sort((a, b) => a.percentage - b.percentage);
  
  // Pegar o dígito com menor frequência
  const lowestFreqDigit = sortedStats[0]?.digit ?? 5;
  
  // Pegar o dígito com maior frequência
  const highestFreqDigit = sortedStats[sortedStats.length - 1]?.digit ?? 5;
  
  // Verificar se a diferença entre maior e menor frequência é significativa
  const lowestPercentage = sortedStats[0]?.percentage ?? 0;
  const highestPercentage = sortedStats[sortedStats.length - 1]?.percentage ?? 0;
  const percentageDiff = highestPercentage - lowestPercentage;
  
  const shouldEnter = percentageDiff >= 8; // Precisa de pelo menos 8% de diferença
  
  // Determine o tipo de contrato (DIGITOVER para dígito com baixa frequência)
  const contractType: ContractType = 'DIGITOVER';
  const prediction = lowestFreqDigit;
  
  let message = shouldEnter
    ? `MAXPRO: Condição atendida! Dígito ${lowestFreqDigit} com frequência baixa (${lowestPercentage}%). Diferença: ${percentageDiff}%`
    : `MAXPRO: Distribuição muito equilibrada (dif: ${percentageDiff}%). Aguardando melhor oportunidade.`;
  
  return {
    shouldEnter,
    contractType,
    prediction,
    message
  };
}



/**
 * Avalia a estratégia padrão (fallback)
 * Usada quando não há regras específicas para a estratégia selecionada
 */
export function evaluateDefaultStrategy(
  digitStats: DigitStat[],
  contractType: ContractType = 'CALL'
): { shouldEnter: boolean; contractType: ContractType; message: string } {
  // Estratégia padrão sempre entra, usando o tipo de contrato especificado
  return {
    shouldEnter: true,
    contractType,
    message: `Estratégia padrão: Entrada com ${contractType}`
  };
}