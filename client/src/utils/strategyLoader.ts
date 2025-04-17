/**
 * Utilitário para carregar e pré-processar estratégias XML de trading
 */

import { xmlStrategyParser } from "../services/xmlStrategyParser";

// Lista de arquivos XML disponíveis para carregamento
const strategyFiles = [
  // Estratégias Lite
  'attached_assets/Profitpro Atualizado.xml',
  'attached_assets/Manual Under.xml',
  'attached_assets/Advance .xml',
  'attached_assets/WISE PRO TENDENCIA.xml',
  
  // Estratégias Premium
  'attached_assets/IRON OVER.xml',
  'attached_assets/IRON UNDER.xml',
  'attached_assets/BOT LOW.xml',
  'attached_assets/MAXPRO .xml',
  'attached_assets/green.xml',
  'attached_assets/manual Over.xml'
];

/**
 * Carrega todas as estratégias disponíveis
 */
export async function loadAllStrategies() {
  try {
    console.log('[StrategyLoader] Carregando estratégias XML...');
    await xmlStrategyParser.loadStrategies(strategyFiles);
    console.log('[StrategyLoader] Estratégias carregadas com sucesso');
    
    return {
      lite: xmlStrategyParser.getStrategiesByCategory('lite'),
      premium: xmlStrategyParser.getStrategiesByCategory('premium')
    };
  } catch (error) {
    console.error('[StrategyLoader] Erro ao carregar estratégias:', error);
    return {
      lite: [],
      premium: []
    };
  }
}

/**
 * Carrega uma estratégia específica pelo ID
 */
export async function loadStrategy(id: string) {
  try {
    // Primeiro carregamos todas as estratégias se ainda não foram carregadas
    await loadAllStrategies();
    
    // Então retornamos a estratégia específica
    return xmlStrategyParser.getStrategy(id);
  } catch (error) {
    console.error(`[StrategyLoader] Erro ao carregar estratégia ${id}:`, error);
    return null;
  }
}

/**
 * Inicializa o carregador de estratégias
 */
export function initStrategyLoader() {
  console.log('[StrategyLoader] Inicializando carregador de estratégias');
  // Pré-carregar as estratégias para que estejam disponíveis
  loadAllStrategies().catch(error => {
    console.error('[StrategyLoader] Erro na inicialização:', error);
  });
}

// Inicializar o carregador na importação do módulo
initStrategyLoader();