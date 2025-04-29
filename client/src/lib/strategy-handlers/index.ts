/**
 * Integrador de estratégias
 * Gerencia e aplica regras de estratégias para os bots
 * Com suporte ao parser XML para seguir fielmente os comandos das estratégias
 */

import { 
  evaluateAdvanceStrategy, 
  evaluateIronOverStrategy, 
  evaluateIronUnderStrategy,
  evaluateMaxProStrategy,
  evaluateDefaultStrategy,
  ContractType,
  DigitStat
} from "@/services/strategyRules";

// Importar parser XML para interpretar as estratégias
import xmlStrategyParser, { 
  StrategyVariables, 
  StrategyAnalysisResult 
} from "@/services/xmlStrategyParser";

// Estado global para cada estratégia
interface StrategyState {
  consecutiveLosses: number;
  lastResult: 'win' | 'loss' | null;
  currentAmount: number;
  prediction?: number;
  entryConditionsMet: boolean;
  strategyXml?: string;
}

// Cache de estado para cada estratégia
const strategyStates: Record<string, StrategyState> = {};

// Cache de XMLs carregados
const xmlCache: Record<string, string> = {};

/**
 * Obtém o estado atual da estratégia pelo ID
 * @param strategyId ID normalizado da estratégia
 * @returns Estado atual da estratégia ou undefined se não existir
 */
export function getStrategyState(strategyId: string): StrategyState | undefined {
  const normalizedId = strategyId.toLowerCase();
  return strategyStates[normalizedId];
}

/**
 * Inicializa ou reseta o estado para uma estratégia
 */
export function initializeStrategyState(
  strategyId: string, 
  initialAmount: number = 1.0 // CORREÇÃO: Valor default mais visível
): void {
  console.log(`[STRATEGY_HANDLER] Inicializando estado para estratégia: ${strategyId}`);
  
  // CORREÇÃO CRÍTICA: Buscar valor inicial definido pelo usuário antes de inicializar
  let valorInicial = initialAmount; // Valor default
  
  // Verificar se há configuração do usuário salva
  const strategyLowerCase = strategyId.toLowerCase();
  const strategyConfigString = localStorage.getItem(`strategy_config_${strategyLowerCase}`);
  
  if (strategyConfigString) {
    try {
      const userConfig = JSON.parse(strategyConfigString);
      if (userConfig.valorInicial !== undefined) {
        valorInicial = parseFloat(userConfig.valorInicial);
        console.log(`[STRATEGY_HANDLER] 🚨 CORREÇÃO CRÍTICA: Inicializando com valor definido pelo usuário: ${valorInicial}`);
      }
    } catch (error) {
      console.error('[STRATEGY_HANDLER] Erro ao carregar configuração inicial:', error);
    }
  }
  
  // Definir state padrão usando o valor correto
  strategyStates[strategyId] = {
    consecutiveLosses: 0,
    lastResult: null,
    currentAmount: valorInicial, // Usar valor do usuário em vez do valor fixo
    prediction: strategyId.includes('digit') ? Math.floor(Math.random() * 10) : undefined,
    entryConditionsMet: false
  };
  
  console.log(`[STRATEGY_HANDLER] Estado inicializado com valor inicial: ${valorInicial}`);
}

/**
 * Atualiza o estado da estratégia com base no resultado de uma operação
 */
export function updateStrategyResult(
  strategyId: string, 
  result: 'win' | 'loss', 
  profit: number
): void {
  if (!strategyStates[strategyId]) {
    initializeStrategyState(strategyId);
  }
  
  const state = strategyStates[strategyId];
  state.lastResult = result;
  
  // Atualizar contagem de perdas consecutivas
  if (result === 'win') {
    state.consecutiveLosses = 0;
    
    // CORREÇÃO CRÍTICA: Não usar valor fixo de 0.35, mas sim o valor inicial configurado pelo usuário
    // Obter configuração do usuário para esta estratégia
    const strategyCurrent = strategyId.toLowerCase();
    const strategyConfigString = localStorage.getItem(`strategy_config_${strategyCurrent}`);
    
    if (strategyConfigString) {
      try {
        const userConfig = JSON.parse(strategyConfigString);
        // Usar o valor definido pelo usuário, se disponível
        if (userConfig.valorInicial !== undefined) {
          state.currentAmount = parseFloat(userConfig.valorInicial);
          console.log(`[STRATEGY_HANDLER] 🚨 CORREÇÃO CRÍTICA: Após vitória, usando valor inicial configurado pelo usuário: ${state.currentAmount}`);
        } else {
          // Fallback para valor padrão apenas se não houver configuração
          state.currentAmount = 1.0; // CORREÇÃO: Valor default mais visível
          console.log(`[STRATEGY_HANDLER] Após vitória, usando valor padrão: ${state.currentAmount}`);
        }
      } catch (error) {
        console.error('[STRATEGY_HANDLER] Erro ao ler configuração após vitória:', error);
        state.currentAmount = 1.0; // CORREÇÃO: Valor default mais visível
      }
    } else {
      // Não encontrou configuração, usar valor padrão
      state.currentAmount = 1.0; // CORREÇÃO: Valor default mais visível
      console.log(`[STRATEGY_HANDLER] Não encontrou configuração, usando valor padrão após vitória: ${state.currentAmount}`);
    }
  } else {
    state.consecutiveLosses++;
    // Valor de Entrada será calculado de acordo com a estratégia
    console.log(`[STRATEGY_HANDLER] Derrota registrada! Aumentando consecutiveLosses para: ${state.consecutiveLosses}`);
  }
  
  console.log(`[STRATEGY_HANDLER] ${strategyId}: Resultado ${result}, Profit ${profit}, Perdas consecutivas: ${state.consecutiveLosses}`);
}

/**
 * Carrega o XML da estratégia para uso no parser
 */
export async function loadStrategyXml(
  strategyId: string,
  xmlPath: string
): Promise<boolean> {
  try {
    // Se já temos o XML em cache, usar o cache
    if (xmlCache[strategyId]) {
      console.log(`[STRATEGY_HANDLER] Usando XML em cache para estratégia: ${strategyId}`);
      
      // Carregar no parser
      const success = xmlStrategyParser.loadXml(xmlCache[strategyId]);
      
      if (success) {
        // Guardar no estado da estratégia
        if (!strategyStates[strategyId]) {
          initializeStrategyState(strategyId);
        }
        strategyStates[strategyId].strategyXml = xmlCache[strategyId];
        return true;
      }
      
      // Se falhou ao usar o cache, tentar buscar de novo
      delete xmlCache[strategyId];
    }
    
    // Buscar o XML do arquivo
    const response = await fetch(xmlPath);
    if (!response.ok) {
      console.error(`[STRATEGY_HANDLER] Erro ao carregar XML da estratégia ${strategyId}: ${response.statusText}`);
      return false;
    }
    
    const xmlContent = await response.text();
    
    // Salvar em cache
    xmlCache[strategyId] = xmlContent;
    
    // Carregar no parser
    const success = xmlStrategyParser.loadXml(xmlContent);
    
    if (success) {
      // Guardar no estado da estratégia
      if (!strategyStates[strategyId]) {
        initializeStrategyState(strategyId);
      }
      strategyStates[strategyId].strategyXml = xmlContent;
      console.log(`[STRATEGY_HANDLER] XML carregado com sucesso para estratégia: ${strategyId}`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`[STRATEGY_HANDLER] Erro ao carregar XML da estratégia ${strategyId}:`, error);
    return false;
  }
}

/**
 * Avalia as condições de entrada para uma estratégia usando o parser XML
 * que executa fielmente os comandos da estratégia
 */
export async function evaluateEntryConditions(
  strategyId: string, 
  digitStats: DigitStat[], 
  strategyConfig: any,
  xmlPath?: string
): Promise<{
  shouldEnter: boolean;
  contractType: ContractType;
  prediction?: number;
  entryAmount: number;
  message: string;
}> {
  // Log de depuração detalhado ⬇️
  console.log(`[STRATEGY_HANDLER] 🧪 Avaliando condições para estratégia: ${strategyId}`);
  console.log(`[STRATEGY_HANDLER] 🧪 Configuração recebida:`, strategyConfig);
  console.log(`[STRATEGY_HANDLER] 🧪 Quantidade de estatísticas de dígitos recebidas: ${digitStats.length}`);
  
  // Garantir que o estado existe
  if (!strategyStates[strategyId]) {
    console.log(`[STRATEGY_HANDLER] 🧪 Inicializando estado da estratégia: ${strategyId}`);
    initializeStrategyState(strategyId);
  }
  
  const state = strategyStates[strategyId];
  const normalizedId = strategyId.toLowerCase();
  
  console.log(`[STRATEGY_HANDLER] 🧪 Estado atual da estratégia:`, {
    consecutiveLosses: state.consecutiveLosses,
    lastResult: state.lastResult,
    currentAmount: state.currentAmount,
    xmlDisponivel: !!state.strategyXml
  });
  
  // Verificar se temos o XML carregado ou precisamos carregar
  if (!state.strategyXml && xmlPath) {
    console.log(`[STRATEGY_HANDLER] 🧪 Carregando XML da estratégia: ${xmlPath}`);
    await loadStrategyXml(strategyId, xmlPath);
  }
  
  // Converter configuração para formato compatível com o parser
  const userConfig: StrategyVariables = {
    valorInicial: strategyConfig?.valorInicial ? parseFloat(strategyConfig.valorInicial.toString()) : undefined,
    valorAposVencer: strategyConfig?.valorAposVencer ? parseFloat(strategyConfig.valorAposVencer.toString()) : undefined,
    martingale: strategyConfig?.martingale ? parseFloat(strategyConfig.martingale.toString()) : undefined,
    meta: strategyConfig?.metaGanho ? parseFloat(strategyConfig.metaGanho.toString()) : undefined,
    limitePerda: strategyConfig?.limitePerda ? parseFloat(strategyConfig.limitePerda.toString()) : undefined,
    porcentagemParaEntrar: strategyConfig?.porcentagemParaEntrar ? parseFloat(strategyConfig.porcentagemParaEntrar.toString()) : undefined,
    usarMartingaleAposXLoss: strategyConfig?.usarMartingaleAposXLoss ? parseInt(strategyConfig.usarMartingaleAposXLoss.toString()) : undefined,
    parcelasMartingale: strategyConfig?.parcelasMartingale ? parseInt(strategyConfig.parcelasMartingale.toString()) : undefined
  };
  
  // DEBUG - Verificar se a configuração do usuário está sendo detectada
  if (strategyConfig?.valorInicial) {
    console.log(`[STRATEGY_HANDLER] 🔍 CRÍTICO: Encontrou valorInicial=${strategyConfig.valorInicial} configurado pelo usuário`);
  } else {
    console.log(`[STRATEGY_HANDLER] 🔍 CRÍTICO: valorInicial não encontrado na configuração do usuário`);
  }
  
  console.log(`[STRATEGY_HANDLER] 🧪 Configuração convertida para parser XML:`, userConfig);
  
  // Aplicar configuração do usuário no parser
  xmlStrategyParser.setUserConfig(userConfig);
  
  // Verificar se podemos usar o parser XML
  const canUseXmlParser = state.strategyXml !== undefined;
  console.log(`[STRATEGY_HANDLER] 🧪 Parser XML disponível: ${canUseXmlParser}`);
  
  // Configurações de entrada padrão (caso não use parser XML)
  // CORREÇÃO CRÍTICA: Usar valor inicial configurado pelo usuário
  let entryAmount = state.currentAmount || 1.0; // Valor default mais visível
  let shouldEnter = false;
  let contractType: ContractType = 'CALL';
  let prediction: number | undefined = undefined;
  let message = "";
  
  // ----- USO DO PARSER XML - SEGUE FIELMENTE OS COMANDOS DO XML -----
  if (canUseXmlParser) {
    console.log(`[STRATEGY_HANDLER] 🧪 Usando parser XML para estratégia: ${strategyId}`);
    
    // Para IRON UNDER: forçar debug detalhado
    if (normalizedId.includes('iron') && normalizedId.includes('under')) {
      console.log(`[STRATEGY_HANDLER] 🚨🚨🚨 IRON UNDER DETECTADO - Análise específica iniciada 🚨🚨🚨`);
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER: Estado atual:`, state);
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER: Últimas estatísticas:`, digitStats.slice(0, 5));
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER: XML disponível:`, !!state.strategyXml);
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER: Configuração do usuário:`, strategyConfig);
    }
    
    // Analisar estratégia usando o parser XML
    const result = xmlStrategyParser.analyzeStrategy(
      strategyId,
      digitStats,
      state.consecutiveLosses
    );
    
    // Atualizar estado com base na análise do XML
    shouldEnter = result.shouldEnter;
    contractType = result.contractType as ContractType;
    prediction = result.prediction;
    entryAmount = result.amount;
    message = `[XML] ${result.message}`;
    
    // Log detalhado para rastreabilidade completa do tipo de contrato definido no XML
    console.log(`[STRATEGY_HANDLER] 🔍 XML EXATO: Tipo de contrato ${contractType} EXATAMENTE como definido no XML da estratégia ${strategyId}`);
    console.log(`[STRATEGY_HANDLER] 🔍 XML EXATO: shouldEnter=${shouldEnter}, prediction=${prediction}, amount=${entryAmount}`);
    
    // Se for usar martingale com base no resultado anterior
    if (state.lastResult === 'loss') {
      // O parser já considera o martingale, o valor já está ajustado em result.amount
      console.log(`[STRATEGY_HANDLER] [XML] Ajuste de martingale já aplicado pelo parser XML: ${entryAmount}`);
    }
  }
  // ----- FALLBACK PARA IMPLEMENTAÇÃO ANTERIOR -----
  else {
    console.log(`[STRATEGY_HANDLER] Usando implementação antiga para estratégia: ${strategyId} (XML não disponível)`);
    
    // Aplicar regras específicas para cada estratégia - IMPLEMENTAÇÃO ANTERIOR
    let useMartingale = false;
    
    if (normalizedId.includes('advance')) {
      // Obter porcentagem limite da configuração
      // CRÍTICO: Sempre ter um valor para porcentagem, usando 10% como padrão se não estiver definido
      let entryPercentage = 10; // Valor padrão para estratégia Advance
      
      // Verificar se o usuário definiu um valor específico na configuração
      if (strategyConfig?.porcentagemParaEntrar !== undefined && strategyConfig.porcentagemParaEntrar !== null) {
        // Converter para número e garantir que seja um valor válido
        const configValue = parseFloat(strategyConfig.porcentagemParaEntrar.toString());
        if (!isNaN(configValue)) {
          entryPercentage = configValue;
          console.log(`[STRATEGY_HANDLER] ADVANCE: Usando porcentagem definida pelo usuário: ${entryPercentage}%`);
        } else {
          console.log(`[STRATEGY_HANDLER] ADVANCE: Valor de porcentagem inválido (${strategyConfig.porcentagemParaEntrar}), usando padrão: ${entryPercentage}%`);
        }
      } else {
        console.log(`[STRATEGY_HANDLER] ADVANCE: Usando porcentagem padrão: ${entryPercentage}%`);
      }
      
      // Log adicional para depuração - mostra exatamente o valor que está sendo usado
      console.log(`[STRATEGY_HANDLER] ADVANCE DEBUG: Valor final de porcentagem para análise: ${entryPercentage}%`);
      
      // O valor de entryPercentage agora é garantido ser um número válido
      const result = evaluateAdvanceStrategy(digitStats, entryPercentage);
      shouldEnter = result.shouldEnter;
      contractType = result.contractType;
      message = result.message;

      // NOVO: Usar o flag shouldLog para registrar análises intermediárias
      // Isso vai permitir que mesmo as operações não executadas apareçam no histórico
      if (result.shouldLog) {
        // Emitir um evento de análise para o relatório de operações
        // Isso será gerenciado pelo oauthDirectService para adicionar ao histórico
        console.log(`[STRATEGY_HANDLER] ADVANCE: Emitindo análise para histórico: ${message}`);
        console.log(`[STRATEGY_HANDLER] ADVANCE: Análise com dígitos - 0: ${result.analysis.digit0}%, 1: ${result.analysis.digit1}%, limite: ${result.analysis.threshold}%`);
        
        // Estrutura de dados adicional será utilizada por oauthDirectService
        // para incluir esta operação no histórico, mesmo sem execução
        // O tipo explícito é uma boa prática para evitar erros
        const analysisData = {
          shouldLog: true,
          isIntermediate: !shouldEnter, // Se não deve entrar, é uma análise intermediária
          message: message,
          analysis: result.analysis
        };
        
        // Esta informação é passada via "message" e processada em oauthDirectService
        message = JSON.stringify(analysisData);
      }
      
      // Calcular valor de entrada considerando martingale para ADVANCE
      if (state.lastResult === 'loss') {
        const martingaleFactor = strategyConfig?.martingale 
          ? parseFloat(strategyConfig.martingale.toString()) 
          : 1.5;
        
        entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
        console.log(`[STRATEGY_HANDLER] ADVANCE: Aplicando martingale, novo valor: ${entryAmount}`);
      }
      
    } else if (normalizedId.includes('iron_over') || normalizedId.includes('ironover')) {
      // Configuração para IRON OVER
      prediction = state.prediction || 5;
      
      const martingaleAfterLosses = strategyConfig?.usarMartingaleAposXLoss 
        ? parseInt(strategyConfig.usarMartingaleAposXLoss.toString())
        : 2;
      
      const result = evaluateIronOverStrategy(
        digitStats, 
        prediction, 
        state.consecutiveLosses,
        martingaleAfterLosses
      );
      
      shouldEnter = result.shouldEnter;
      contractType = result.contractType;
      useMartingale = result.useMartingale;
      message = result.message;
      
      // Aplicar martingale apenas se permitido
      if (state.lastResult === 'loss' && useMartingale) {
        const martingaleFactor = strategyConfig?.martingale 
          ? parseFloat(strategyConfig.martingale.toString()) 
          : 0.5;
        
        entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
        console.log(`[STRATEGY_HANDLER] IRON_OVER: Aplicando martingale após ${state.consecutiveLosses} perdas, novo valor: ${entryAmount}`);
      }
      
    } else if (normalizedId.includes('iron_under') || normalizedId.includes('ironunder')) {
      // Configuração para IRON UNDER - ATENÇÃO: A API Deriv requer que o digit esteja entre 1-9
      
      // IMPORTANTE: Verificar se prediction está dentro do intervalo válido (1-9)
      // Anteriormente, usávamos 4 como padrão, mas agora garantimos que esteja entre 1-9
      prediction = state.prediction || 5; // Mudado de 4 para 5 - valor inválido pode causar falha na operação
      
      if (prediction < 1 || prediction > 9) {
        console.error(`[STRATEGY_HANDLER] ❌ IRON UNDER: Valor de previsão inválido: ${prediction}. A API Deriv aceita apenas 1-9. Ajustando para 5.`);
        prediction = 5; // Valor seguro dentro do intervalo
      }
      
      const martingaleAfterLosses = strategyConfig?.usarMartingaleAposXLoss 
        ? parseInt(strategyConfig.usarMartingaleAposXLoss.toString())
        : 2;
      
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER (Versão corrigida): Iniciando análise detalhada`);
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER (Versão corrigida): Prediction=${prediction}, ConsecutiveLosses=${state.consecutiveLosses}, martingaleAfterLosses=${martingaleAfterLosses}`);
      
      const result = evaluateIronUnderStrategy(
        digitStats, 
        prediction, 
        state.consecutiveLosses,
        martingaleAfterLosses
      );
      
      console.log(`[STRATEGY_HANDLER] 🚨 IRON UNDER (Versão corrigida): Resultado da análise:`, result);
      
      shouldEnter = result.shouldEnter;
      contractType = result.contractType;
      useMartingale = result.useMartingale;
      message = result.message;
      
      // Aplicar martingale apenas se permitido
      if (state.lastResult === 'loss' && useMartingale) {
        const martingaleFactor = strategyConfig?.martingale 
          ? parseFloat(strategyConfig.martingale.toString()) 
          : 0.5;
        
        entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
        console.log(`[STRATEGY_HANDLER] IRON_UNDER: Aplicando martingale após ${state.consecutiveLosses} perdas, novo valor: ${entryAmount}`);
      }
      
    } else if (normalizedId.includes('maxpro')) {
      // Configuração para MAXPRO
      // CORREÇÃO CRÍTICA (29/04/2025): Garantir que estamos passando os dígitos recentes e o loss virtual
      // para que a estratégia MAXPRO possa avaliar corretamente as condições de entrada
      // Verificar configurações de lossVirtual nos parâmetros da função ou usar valor padrão
      const lossVirtual = strategyConfig?.lossVirtual 
        ? parseInt(strategyConfig.lossVirtual.toString())
        : 1;
      // Usar os dígitos recentes passados como parâmetro para a função
      const recentDigits = Array.isArray(digitStats) ? digitStats.map(d => d.digit) : [];
      
      console.log(`[STRATEGY_HANDLER] 🔍 MAXPRO: Usando análise de loss virtual = ${lossVirtual}`);
      console.log(`[STRATEGY_HANDLER] 🔍 MAXPRO: Analisando dígitos recentes = ${recentDigits.slice(0, 10).join(', ')}`);
      
      const result = evaluateMaxProStrategy(digitStats, recentDigits, lossVirtual);
      shouldEnter = result.shouldEnter;
      console.log(`[STRATEGY_HANDLER] 🔍 MAXPRO: Resultado da análise = ${shouldEnter ? 'ENTRAR ✅' : 'NÃO ENTRAR ❌'}, Motivo: ${result.message}`);
      contractType = result.contractType;
      prediction = result.prediction;
      message = result.message;
      
      // Aplicar martingale para MAXPRO
      if (state.lastResult === 'loss') {
        const martingaleFactor = strategyConfig?.martingale 
          ? parseFloat(strategyConfig.martingale.toString()) 
          : 1.5;
        
        entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
        console.log(`[STRATEGY_HANDLER] MAXPRO: Aplicando martingale, novo valor: ${entryAmount}`);
      }
      
    } else {
      // Estratégia padrão
      const defaultContractType = contractType as ContractType;
      const result = evaluateDefaultStrategy(digitStats, defaultContractType);
      shouldEnter = result.shouldEnter;
      contractType = result.contractType;
      message = result.message;
      
      // Aplicar martingale padrão
      if (state.lastResult === 'loss') {
        const martingaleFactor = strategyConfig?.martingale 
          ? parseFloat(strategyConfig.martingale.toString()) 
          : 1.5;
        
        entryAmount = Math.round((state.currentAmount * (1 + martingaleFactor)) * 100) / 100;
        console.log(`[STRATEGY_HANDLER] ${strategyId}: Aplicando martingale padrão, novo valor: ${entryAmount}`);
      }
    }
  }
  
  // Atualizar estado da estratégia
  state.entryConditionsMet = shouldEnter;
  state.currentAmount = entryAmount;
  
  return {
    shouldEnter,
    contractType,
    prediction,
    entryAmount,
    message
  };
}



/**
 * Reseta todas as estratégias
 */
export function resetAllStrategies(): void {
  Object.keys(strategyStates).forEach(id => {
    initializeStrategyState(id);
  });
  console.log("[STRATEGY_HANDLER] Todas as estratégias foram redefinidas");
}