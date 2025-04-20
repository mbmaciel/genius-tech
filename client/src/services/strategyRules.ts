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
 */
export function evaluateAdvanceStrategy(
  digitStats: DigitStat[],
  entryPercentage: number
): { shouldEnter: boolean; contractType: ContractType; message: string } {
  // Extrair estatísticas para os dígitos 0 e 1
  const digit0 = digitStats.find(stat => stat.digit === 0);
  const digit1 = digitStats.find(stat => stat.digit === 1);
  
  // Se não encontrou estatísticas para esses dígitos, não iniciar operação
  if (!digit0 || !digit1) {
    return { 
      shouldEnter: false, 
      contractType: 'CALL', 
      message: 'Estatísticas incompletas para dígitos 0 e 1' 
    };
  }
  
  // Verificar se AMBOS os dígitos 0 E 1 estão com percentual MENOR OU IGUAL ao definido
  const digit0Percentage = Math.round(digit0.percentage);
  const digit1Percentage = Math.round(digit1.percentage);
  
  const shouldEnter = digit0Percentage <= entryPercentage && digit1Percentage <= entryPercentage;
  
  // Determinar mensagem de feedback
  let message = shouldEnter 
    ? `ADVANCE: Condição satisfeita! Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${entryPercentage}%`
    : `ADVANCE: Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${entryPercentage}%`;
    
  return { 
    shouldEnter, 
    contractType: 'CALL',  // ADVANCE usa CALL por padrão
    message 
  };
}

/**
 * Avalia a estratégia IRON OVER
 * Regra: Usa contratos DIGITOVER e respeita o número de perdas para aplicar martingale
 */
export function evaluateIronOverStrategy(
  digitStats: DigitStat[],
  prediction: number = 5,
  consecutiveLosses: number = 0,
  martingaleAfterLosses: number = 2
): { shouldEnter: boolean; contractType: ContractType; useMartingale: boolean; message: string } {
  // IRON OVER sempre entra, mas controla o martingale após X perdas
  const shouldEnter = true;
  const contractType: ContractType = 'DIGITOVER';
  
  // Determinar se deve aplicar martingale baseado no número de perdas consecutivas
  const useMartingale = consecutiveLosses >= martingaleAfterLosses;
  
  const message = useMartingale
    ? `IRON OVER: Usando martingale após ${consecutiveLosses} perdas (limite: ${martingaleAfterLosses}). Previsão: DIGITOVER ${prediction}`
    : `IRON OVER: Operação normal sem martingale. Previsão: DIGITOVER ${prediction}`;
  
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
 */
export function evaluateIronUnderStrategy(
  digitStats: DigitStat[],
  prediction: number = 5,
  consecutiveLosses: number = 0,
  martingaleAfterLosses: number = 2
): { shouldEnter: boolean; contractType: ContractType; useMartingale: boolean; message: string } {
  // IRON UNDER sempre entra, mas controla o martingale após X perdas
  const shouldEnter = true;
  const contractType: ContractType = 'DIGITUNDER';
  
  // Determinar se deve aplicar martingale baseado no número de perdas consecutivas
  const useMartingale = consecutiveLosses >= martingaleAfterLosses;
  
  const message = useMartingale
    ? `IRON UNDER: Usando martingale após ${consecutiveLosses} perdas (limite: ${martingaleAfterLosses}). Previsão: DIGITUNDER ${prediction}`
    : `IRON UNDER: Operação normal sem martingale. Previsão: DIGITUNDER ${prediction}`;
  
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