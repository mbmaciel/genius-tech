/**
 * Regras de estratégias para os bots de trading
 * Implementação das condições específicas de cada bot
 */

import { DigitStat } from "@/types/digit-types";

export type ContractType = 'CALL' | 'PUT' | 'DIGITOVER' | 'DIGITUNDER' | 'DIGITDIFF' | 'DIGITEVEN' | 'DIGITODD';

/**
 * Avalia a estratégia ADVANCE
 * Regra: Comprar APENAS quando os dígitos 0 E 1 tiverem frequência MENOR OU IGUAL à porcentagem definida (padrão 8%)
 */
export function evaluateAdvanceStrategy(
  digitStats: DigitStat[],
  entryPercentage: number = 8
): { shouldEnter: boolean; contractType: ContractType; message: string } {
  if (!digitStats || digitStats.length < 10) {
    return {
      shouldEnter: false,
      contractType: 'CALL',
      message: "Estatísticas de dígitos insuficientes"
    };
  }

  // Encontrando estatísticas para dígitos 0 e 1
  const digit0 = digitStats.find(s => s.digit === 0);
  const digit1 = digitStats.find(s => s.digit === 1);

  // Obtendo percentuais
  const percent0 = digit0?.percentage || 0;
  const percent1 = digit1?.percentage || 0;

  console.log(`[STRATEGY_RULES] ADVANCE: Dígito 0 = ${percent0}%, Dígito 1 = ${percent1}%, Limite = ${entryPercentage}%`);

  // Verificando se AMBOS estão abaixo ou iguais ao limite
  const shouldEnter = percent0 <= entryPercentage && percent1 <= entryPercentage;

  let message = shouldEnter
    ? `✅ Condição satisfeita: Dígitos 0 (${percent0}%) e 1 (${percent1}%) <= ${entryPercentage}%`
    : `❌ Condição não satisfeita: Pelo menos um dígito > ${entryPercentage}%`;

  return {
    shouldEnter,
    contractType: 'CALL', // ADVANCE usa contratos CALL por padrão
    message
  };
}

/**
 * Avalia a estratégia IRON OVER
 * Regra: Usa contratos DIGITOVER e respeita o número de perdas para aplicar martingale
 */
export function evaluateIronOverStrategy(
  digitStats: DigitStat[],
  prediction: number,
  consecutiveLosses: number,
  martingaleAfterLosses: number = 2
): { shouldEnter: boolean; contractType: ContractType; useMartingale: boolean; message: string } {
  if (!digitStats || digitStats.length < 10) {
    return {
      shouldEnter: false,
      contractType: 'DIGITOVER',
      useMartingale: false,
      message: "Estatísticas de dígitos insuficientes"
    };
  }

  // Para IRON OVER, verificamos a frequência de dígitos abaixo da previsão
  const lowDigits = digitStats.filter(s => s.digit < prediction);
  const totalLowPercentage = lowDigits.reduce((sum, d) => sum + d.percentage, 0);

  console.log(`[STRATEGY_RULES] IRON OVER: Previsão = ${prediction}, Percentagem de dígitos menores = ${totalLowPercentage}%`);

  // Aplicar martingale apenas após X perdas consecutivas
  const useMartingale = consecutiveLosses >= martingaleAfterLosses;

  // Definir se devemos entrar com base na distribuição de dígitos
  // Entramos quando há maior concentração de dígitos menores que a previsão
  const shouldEnter = totalLowPercentage >= 60;

  const message = shouldEnter
    ? `✅ Condição satisfeita: ${totalLowPercentage}% de dígitos < ${prediction}`
    : `❌ Condição não satisfeita: Apenas ${totalLowPercentage}% de dígitos < ${prediction}`;

  const martingaleMessage = useMartingale
    ? `⚠️ Aplicando martingale após ${consecutiveLosses} perdas`
    : `Martingale não aplicado (requer ${martingaleAfterLosses} perdas, atual: ${consecutiveLosses})`;

  return {
    shouldEnter,
    contractType: 'DIGITOVER',
    useMartingale,
    message: `${message}. ${martingaleMessage}`
  };
}

/**
 * Avalia a estratégia IRON UNDER
 * Similar à IRON OVER, mas com lógica invertida e usa DIGITUNDER
 */
export function evaluateIronUnderStrategy(
  digitStats: DigitStat[],
  prediction: number,
  consecutiveLosses: number,
  martingaleAfterLosses: number = 2
): { shouldEnter: boolean; contractType: ContractType; useMartingale: boolean; message: string } {
  if (!digitStats || digitStats.length < 10) {
    return {
      shouldEnter: false,
      contractType: 'DIGITUNDER',
      useMartingale: false,
      message: "Estatísticas de dígitos insuficientes"
    };
  }

  // Para IRON UNDER, verificamos a frequência de dígitos acima da previsão
  const highDigits = digitStats.filter(s => s.digit > prediction);
  const totalHighPercentage = highDigits.reduce((sum, d) => sum + d.percentage, 0);

  console.log(`[STRATEGY_RULES] IRON UNDER: Previsão = ${prediction}, Percentagem de dígitos maiores = ${totalHighPercentage}%`);

  // Aplicar martingale apenas após X perdas consecutivas
  const useMartingale = consecutiveLosses >= martingaleAfterLosses;

  // Definir se devemos entrar com base na distribuição de dígitos
  const shouldEnter = totalHighPercentage >= 60;

  const message = shouldEnter
    ? `✅ Condição satisfeita: ${totalHighPercentage}% de dígitos > ${prediction}`
    : `❌ Condição não satisfeita: Apenas ${totalHighPercentage}% de dígitos > ${prediction}`;

  const martingaleMessage = useMartingale
    ? `⚠️ Aplicando martingale após ${consecutiveLosses} perdas`
    : `Martingale não aplicado (requer ${martingaleAfterLosses} perdas, atual: ${consecutiveLosses})`;

  return {
    shouldEnter,
    contractType: 'DIGITUNDER',
    useMartingale,
    message: `${message}. ${martingaleMessage}`
  };
}

/**
 * Avalia a estratégia MAXPRO
 * Usa análise de padrões de dígitos e filtra por distribuição equilibrada
 */
export function evaluateMaxProStrategy(
  digitStats: DigitStat[]
): { shouldEnter: boolean; contractType: ContractType; prediction: number; message: string } {
  if (!digitStats || digitStats.length < 10) {
    return {
      shouldEnter: false,
      contractType: 'DIGITDIFF',
      prediction: 5,
      message: "Estatísticas de dígitos insuficientes"
    };
  }

  // MAXPRO procura padrões específicos e distribição equilibrada entre dígitos pares e ímpares
  const evenDigits = digitStats.filter(s => s.digit % 2 === 0);
  const oddDigits = digitStats.filter(s => s.digit % 2 !== 0);
  
  const totalEvenPercentage = evenDigits.reduce((sum, d) => sum + d.percentage, 0);
  const totalOddPercentage = oddDigits.reduce((sum, d) => sum + d.percentage, 0);
  
  // Encontrar o dígito com maior frequência
  const sortedByFrequency = [...digitStats].sort((a, b) => b.percentage - a.percentage);
  const mostFrequentDigit = sortedByFrequency[0];
  
  console.log(`[STRATEGY_RULES] MAXPRO: Pares=${totalEvenPercentage}%, Ímpares=${totalOddPercentage}%, Mais frequente=${mostFrequentDigit.digit} (${mostFrequentDigit.percentage}%)`);

  // Verificar se há um desequilíbrio significativo entre pares e ímpares (pelo menos 15% de diferença)
  const hasImbalance = Math.abs(totalEvenPercentage - totalOddPercentage) >= 15;
  
  // Verificar se há um dígito muito frequente (pelo menos 20%)
  const hasHighFrequencyDigit = mostFrequentDigit.percentage >= 20;

  // MAXPRO entra com contratos DIGITDIFF quando há desequilíbrio ou dígito com alta frequência
  const shouldEnter = hasImbalance || hasHighFrequencyDigit;
  
  // Escolher a previsão com base no dígito mais frequente
  const prediction = mostFrequentDigit.digit;

  let message = "";
  if (hasImbalance) {
    message += `Desequilíbrio detectado: Pares=${totalEvenPercentage}%, Ímpares=${totalOddPercentage}%. `;
  }
  if (hasHighFrequencyDigit) {
    message += `Dígito ${mostFrequentDigit.digit} com alta frequência (${mostFrequentDigit.percentage}%). `;
  }
  
  message += shouldEnter ? "✅ Condições para entrada satisfeitas." : "❌ Condições para entrada não satisfeitas.";

  return {
    shouldEnter,
    contractType: 'DIGITDIFF',
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
  if (!digitStats || digitStats.length < 10) {
    return {
      shouldEnter: false,
      contractType,
      message: "Estatísticas de dígitos insuficientes"
    };
  }
  
  // Implementação de regra padrão simples
  const shouldEnter = Math.random() > 0.5; // Simplificado para demonstração
  
  return {
    shouldEnter,
    contractType,
    message: shouldEnter ? "✅ Condições padrão satisfeitas" : "❌ Condições padrão não satisfeitas"
  };
}