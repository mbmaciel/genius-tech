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
// Definição expandida do tipo de retorno para Advance
interface AdvanceStrategyAnalysis {
  digit0: number;
  digit1: number;
  threshold: number;
  barrier?: number;
  predictionValue?: number;
}

export function evaluateAdvanceStrategy(
  digitStats: DigitStat[],
  entryPercentage: number | undefined
): { 
  shouldEnter: boolean; 
  contractType: ContractType; 
  message: string;
  barrier: string; // Tornando obrigatório
  prediction: number; // Tornando obrigatório
  analysis: AdvanceStrategyAnalysis; 
  shouldLog: boolean; 
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
      barrier: "1", // FORÇAR aqui também
      prediction: 1, // FORÇAR aqui também
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
      barrier: "1", // FORÇANDO BARREIRA 1
      prediction: 1, // FORÇANDO PREVISÃO 1
      analysis: { 
        digit0: 0, 
        digit1: 0, 
        threshold: percentageToUse,
        barrier: 1, // Valor padrão para compatibilidade
        predictionValue: 1 // Valor padrão para compatibilidade 
      },
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
      barrier: "1", // FORÇANDO BARREIRA 1
      prediction: 1, // FORÇANDO PREVISÃO 1
      analysis: { 
        digit0: digit0Percentage, 
        digit1: digit1Percentage, 
        threshold: percentageToUse,
        barrier: 1, // Valor padrão para compatibilidade
        predictionValue: 1 // Valor padrão para compatibilidade 
      },
      shouldLog: true // Registramos esta análise no histórico
    };
  }
  
  // CRÍTICO: Adicionar log específico para debugar os valores usados na comparação
  console.log(`[STRATEGY_RULES] ADVANCE DEBUG: Comparando digit0=${digit0Percentage}% e digit1=${digit1Percentage}% com limite=${percentageToUse}%`);
  
  // CORREÇÃO CRÍTICA: Verificar explicitamente cada condição separadamente para facilitar debugging
  const digit0Ok = digit0Percentage <= percentageToUse;
  const digit1Ok = digit1Percentage <= percentageToUse;
  
  // IMPORTANTE: A condição só é satisfeita quando AMBOS os dígitos estão com percentual MENOR OU IGUAL ao definido
  const shouldEnter = digit0Ok && digit1Ok;
  
  console.log(`[STRATEGY_RULES] 🔎 VERIFICAÇÃO DETALHADA ADVANCE:`);
  console.log(`[STRATEGY_RULES] 🔎 Dígito 0 (${digit0Percentage}%) <= ${percentageToUse}%? ${digit0Ok ? 'SIM ✅' : 'NÃO ❌'}`);
  console.log(`[STRATEGY_RULES] 🔎 Dígito 1 (${digit1Percentage}%) <= ${percentageToUse}%? ${digit1Ok ? 'SIM ✅' : 'NÃO ❌'}`);
  console.log(`[STRATEGY_RULES] 🔎 AMBOS os dígitos estão abaixo do limite? ${shouldEnter ? 'SIM ✅' : 'NÃO ❌'}`);
  
  // Notificar usuário no console para diagnóstico com mais detalhes
  if (shouldEnter) {
    console.log(`[STRATEGY_RULES] 🚀🚀🚀 ATENÇÃO: CONDIÇÃO DE ENTRADA IDENTIFICADA! AMBOS os dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) <= ${percentageToUse}%`);
  } else {
    console.log(`[STRATEGY_RULES] ❌ CONDIÇÃO NÃO ATENDIDA! Um ou ambos os dígitos estão acima do limite de ${percentageToUse}%`);
    if (!digit0Ok) {
      console.log(`[STRATEGY_RULES] ❌ Dígito 0 (${digit0Percentage}%) > ${percentageToUse}%`);
    }
    if (!digit1Ok) {
      console.log(`[STRATEGY_RULES] ❌ Dígito 1 (${digit1Percentage}%) > ${percentageToUse}%`);
    }
  }
  
  // Determinar mensagem de feedback explícita incluindo o valor definido pelo usuário
  let message = shouldEnter 
    ? `ADVANCE XML: ✅ Condição satisfeita! Executando DIGITOVER conforme XML. Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${percentageToUse}%`
    : `ADVANCE XML: ❌ Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${percentageToUse}%`;
    
  // CORREÇÃO CRÍTICA: Forçar valores para a estratégia Advance
  // Especialmente a barreira = 1 para DIGITOVER e duração = 1 tick, conforme imagem do contrato
  console.log(`[STRATEGY_RULES] 🚨 CORREÇÃO CRÍTICA ADVANCE: Forçando DIGITOVER com barreira 1 e duration 1 tick!`);
  
  // Atualizar para mostrar a barreira correta
  message = message.replace('DIGITOVER', 'DIGITOVER 1');
  
  // SALVAR NO LOCALSTORAGE para rastreabilidade e diagnóstico
  try {
    localStorage.setItem('ADVANCE_BARRIER_FORCED', '1');
    localStorage.setItem('ADVANCE_DURATION_FORCED', '1');
    localStorage.setItem('ADVANCE_PREDICTION_FORCED', '1');
    localStorage.setItem('ADVANCE_EXECUTION_TIME', new Date().toISOString());
  } catch (e) {}
  
  return { 
    shouldEnter, 
    contractType: 'DIGITOVER', // CORREÇÃO: O contrato é DIGITOVER conforme confirmado pelo usuário
    message,
    barrier: "1", // CRITICO - FORÇANDO BARREIRA 1
    prediction: 1, // CRÍTICO - FORÇANDO PREVISÃO 1 
    analysis: { 
      digit0: digit0Percentage, 
      digit1: digit1Percentage, 
      threshold: percentageToUse,
      barrier: 1, // EXPLICITAMENTE DOCUMENTADO
      predictionValue: 1 // EXPLICITAMENTE DOCUMENTADO
    },
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
 * Avalia a estratégia ProfitPro
 * Implementa a lógica de Loss Virtual para dígitos 0-6
 * 
 * O parâmetro lossVirtual controla quantos dígitos consecutivos (0-6) devem aparecer antes de entrar
 */
export function evaluateProfitProStrategy(
  digitStats: DigitStat[],
  recentDigits: number[],
  lossVirtual: number = 1
): { shouldEnter: boolean; contractType: ContractType; prediction: number; message: string } {
  console.log(`[STRATEGY_RULES] ProfitPro: Analisando com Loss Virtual = ${lossVirtual}`);
  console.log(`[STRATEGY_RULES] ProfitPro: Dígitos recentes:`, recentDigits.slice(0, 10).join(', '));
  
  // Verificar se temos dígitos suficientes para análise
  if (recentDigits.length < lossVirtual) {
    console.log(`[STRATEGY_RULES] ProfitPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`);
    return {
      shouldEnter: false,
      contractType: 'DIGITOVER',
      prediction: 7,
      message: `ProfitPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`
    };
  }
  
  // Verificar os últimos 'lossVirtual' dígitos para determinar se devemos operar
  // Precisamos verificar se há 'lossVirtual' ocorrências consecutivas de dígitos 0-6
  const relevantDigits = recentDigits.slice(0, lossVirtual);
  const isTargetDigit = (digit: number) => digit >= 0 && digit <= 6;
  
  // Verificar se todos os dígitos relevantes são entre 0-6
  const allTargetDigits = relevantDigits.every(isTargetDigit);
  
  console.log(`[STRATEGY_RULES] ProfitPro: Verificando ${lossVirtual} dígitos consecutivos:`, relevantDigits.join(', '));
  console.log(`[STRATEGY_RULES] ProfitPro: Todos os dígitos são 0-6? ${allTargetDigits ? 'SIM ✅' : 'NÃO ❌'}`);
  
  // Se todos os dígitos relevantes forem 0-6, devemos entrar com DIGITOVER 7
  const shouldEnter = allTargetDigits;
  const contractType: ContractType = 'DIGITOVER';
  const prediction = 7; // Entrar com DIGITOVER 7 quando dígitos 0-6 aparecem lossVirtual vezes consecutivas
  
  let message = shouldEnter
    ? `ProfitPro: Condição atendida! ${lossVirtual} dígitos consecutivos entre 0-6. Executando DIGITOVER ${prediction}`
    : `ProfitPro: Aguardando ${lossVirtual} dígitos consecutivos entre 0-6. Sequência atual: ${relevantDigits.join(', ')}`;
  
  return {
    shouldEnter,
    contractType,
    prediction,
    message
  };
}

/**
 * Avalia a estratégia MAXPRO
 * Implementa a lógica de Loss Virtual para dígitos 0-3
 * 
 * O parâmetro lossVirtual controla quantos dígitos consecutivos (0-3) devem aparecer antes de entrar
 */
export function evaluateMaxProStrategy(
  digitStats: DigitStat[],
  recentDigits: number[],
  lossVirtual: number = 1
): { shouldEnter: boolean; contractType: ContractType; prediction: number; message: string } {
  console.log(`[STRATEGY_RULES] MaxPro: Analisando com Loss Virtual = ${lossVirtual}`);
  console.log(`[STRATEGY_RULES] MaxPro: Dígitos recentes:`, recentDigits.slice(0, 10).join(', '));
  
  // Verificar se temos dígitos suficientes para análise
  if (recentDigits.length < lossVirtual) {
    console.log(`[STRATEGY_RULES] MaxPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`);
    return {
      shouldEnter: false,
      contractType: 'DIGITOVER',
      prediction: 4,
      message: `MaxPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`
    };
  }
  
  // Verificar os últimos 'lossVirtual' dígitos para determinar se devemos operar
  // Precisamos verificar se há 'lossVirtual' ocorrências consecutivas de dígitos 0-3
  const relevantDigits = recentDigits.slice(0, lossVirtual);
  const isTargetDigit = (digit: number) => digit >= 0 && digit <= 3;
  
  // Verificar se todos os dígitos relevantes são entre 0-3
  const allTargetDigits = relevantDigits.every(isTargetDigit);
  
  console.log(`[STRATEGY_RULES] MaxPro: Verificando ${lossVirtual} dígitos consecutivos:`, relevantDigits.join(', '));
  console.log(`[STRATEGY_RULES] MaxPro: Todos os dígitos são 0-3? ${allTargetDigits ? 'SIM ✅' : 'NÃO ❌'}`);
  
  // Se todos os dígitos relevantes forem 0-3, devemos entrar com DIGITOVER 4
  const shouldEnter = allTargetDigits;
  const contractType: ContractType = 'DIGITOVER';
  const prediction = 4; // Entrar com DIGITOVER 4 quando dígitos 0-3 aparecem lossVirtual vezes consecutivas
  
  let message = shouldEnter
    ? `MaxPro: Condição atendida! ${lossVirtual} dígitos consecutivos entre 0-3. Executando DIGITOVER ${prediction}`
    : `MaxPro: Aguardando ${lossVirtual} dígitos consecutivos entre 0-3. Sequência atual: ${relevantDigits.join(', ')}`;
  
  return {
    shouldEnter,
    contractType,
    prediction,
    message
  };
}



/**
 * Avalia a estratégia Bot Low
 * Implementa a lógica para dígitos 0-2
 * O parâmetro lossVirtual é fixo em 1 para esta estratégia
 */
export function evaluateBotLowStrategy(
  digitStats: DigitStat[],
  recentDigits: number[]
): { shouldEnter: boolean; contractType: ContractType; prediction: number; message: string } {
  const lossVirtual = 1; // Bot Low tem sempre Loss Virtual = 1 (fixo)
  console.log(`[STRATEGY_RULES] Bot Low: Analisando com Loss Virtual fixo = ${lossVirtual}`);
  console.log(`[STRATEGY_RULES] Bot Low: Dígitos recentes:`, recentDigits.slice(0, 10).join(', '));
  
  // Verificar se temos dígitos suficientes para análise
  if (recentDigits.length < 1) {
    console.log(`[STRATEGY_RULES] Bot Low: Dígitos insuficientes (${recentDigits.length}) para análise`);
    return {
      shouldEnter: false,
      contractType: 'DIGITOVER',
      prediction: 3,
      message: `Bot Low: Dígitos insuficientes (${recentDigits.length}) para análise`
    };
  }
  
  // Verificar o último dígito para determinar se devemos operar
  // Precisamos verificar se o último dígito é entre 0-2
  const lastDigit = recentDigits[0];
  const isTargetDigit = lastDigit >= 0 && lastDigit <= 2;
  
  console.log(`[STRATEGY_RULES] Bot Low: Verificando último dígito: ${lastDigit}`);
  console.log(`[STRATEGY_RULES] Bot Low: Dígito é 0-2? ${isTargetDigit ? 'SIM ✅' : 'NÃO ❌'}`);
  
  // Se o último dígito for 0-2, devemos entrar com DIGITOVER 3
  const shouldEnter = isTargetDigit;
  const contractType: ContractType = 'DIGITOVER';
  const prediction = 3; // Entrar com DIGITOVER 3 quando o último dígito é 0-2
  
  let message = shouldEnter
    ? `Bot Low: Condição atendida! Último dígito ${lastDigit} está entre 0-2. Executando DIGITOVER ${prediction}`
    : `Bot Low: Aguardando dígito entre 0-2. Último dígito: ${lastDigit}`;
  
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