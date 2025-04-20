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
 * Inicializa ou reseta o estado para uma estratégia
 */
export function initializeStrategyState(
  strategyId: string, 
  initialAmount: number = 0.35
): void {
  console.log(`[STRATEGY_HANDLER] Inicializando estado para estratégia: ${strategyId}`);
  
  // Definir state padrão
  strategyStates[strategyId] = {
    consecutiveLosses: 0,
    lastResult: null,
    currentAmount: initialAmount,
    prediction: strategyId.includes('digit') ? Math.floor(Math.random() * 10) : undefined,
    entryConditionsMet: false
  };
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
    state.currentAmount = 0.35; // Resetar para valor inicial após ganho
  } else {
    state.consecutiveLosses++;
    // Valor de Entrada será calculado de acordo com a estratégia
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
  // Garantir que o estado existe
  if (!strategyStates[strategyId]) {
    initializeStrategyState(strategyId);
  }
  
  const state = strategyStates[strategyId];
  const normalizedId = strategyId.toLowerCase();
  
  // Verificar se temos o XML carregado ou precisamos carregar
  if (!state.strategyXml && xmlPath) {
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
  
  // Aplicar configuração do usuário no parser
  xmlStrategyParser.setUserConfig(userConfig);
  
  // Verificar se podemos usar o parser XML
  const canUseXmlParser = state.strategyXml !== undefined;
  
  // Configurações de entrada padrão (caso não use parser XML)
  let entryAmount = state.currentAmount || 0.35;
  let shouldEnter = false;
  let contractType: ContractType = 'CALL';
  let prediction: number | undefined = undefined;
  let message = "";
  
  // ----- USO DO PARSER XML - SEGUE FIELMENTE OS COMANDOS DO XML -----
  if (canUseXmlParser) {
    console.log(`[STRATEGY_HANDLER] Usando parser XML para estratégia: ${strategyId}`);
    
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
      let entryPercentage = undefined;
      
      if (strategyConfig?.porcentagemParaEntrar !== undefined) {
        entryPercentage = parseFloat(strategyConfig.porcentagemParaEntrar.toString());
        console.log(`[STRATEGY_HANDLER] Usando valor definido pelo usuário para porcentagem de entrada: ${entryPercentage}%`);
      } else {
        console.log(`[STRATEGY_HANDLER] ALERTA: Configuração de porcentagem não encontrada. Operação não será permitida.`);
      }
      
      const result = evaluateAdvanceStrategy(digitStats, entryPercentage);
      shouldEnter = result.shouldEnter;
      contractType = result.contractType;
      message = result.message;
      
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
      // Configuração para IRON UNDER
      prediction = state.prediction || 4;
      
      const martingaleAfterLosses = strategyConfig?.usarMartingaleAposXLoss 
        ? parseInt(strategyConfig.usarMartingaleAposXLoss.toString())
        : 2;
      
      const result = evaluateIronUnderStrategy(
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
        console.log(`[STRATEGY_HANDLER] IRON_UNDER: Aplicando martingale após ${state.consecutiveLosses} perdas, novo valor: ${entryAmount}`);
      }
      
    } else if (normalizedId.includes('maxpro')) {
      // Configuração para MAXPRO
      const result = evaluateMaxProStrategy(digitStats);
      shouldEnter = result.shouldEnter;
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
 * Obtém o estado atual de uma estratégia
 */
export function getStrategyState(strategyId: string): StrategyState | null {
  return strategyStates[strategyId] || null;
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