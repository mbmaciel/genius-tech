/**
 * XML Strategy Parser
 * Interpreta fielmente as estratégias definidas nos arquivos XML
 * e executa seus comandos exatamente como definidos
 */

import { DOMParser } from 'xmldom';
import { DigitStat } from './strategyRules';

// Interface para representar as variáveis da estratégia
export interface StrategyVariables {
  // Variáveis comuns em todas estratégias
  valorInicial?: number;
  valorAposVencer?: number;
  martingale?: number;
  meta?: number;
  limitePerda?: number;
  previsao?: number;
  
  // Variáveis específicas
  porcentagemParaEntrar?: number;
  usarMartingaleAposXLoss?: number;
  parcelasMartingale?: number;
  contadorDeLoss?: number;
  
  // Lista de dígitos (para estratégias que usam histórico)
  listaDeDigitos?: number[];
}

// Interface para o resultado da análise
export interface StrategyAnalysisResult {
  shouldEnter: boolean;
  contractType: string;
  prediction?: number;
  amount: number;
  message: string;
  rawCommands?: any;
}

// Classe para interpretar e executar estratégias XML
export class XmlStrategyParser {
  private xmlContent: string = '';
  private xmlDoc: Document | null = null;
  private variables: StrategyVariables = {};
  private tradeType: string = '';
  private contractType: string = '';
  private entryConditions: any[] = [];
  private userConfig: StrategyVariables = {};
  
  // Mapeamento de variáveis do XML para nomes no sistema
  private variableMapping: Record<string, string> = {
    'VALOR INICIAL': 'valorInicial',
    'VALOR APÓS VENCER': 'valorAposVencer',
    'MARTINGALE': 'martingale',
    'META': 'meta',
    'LIMITE DE PERDA': 'limitePerda',
    'PREVISÃO': 'previsao',
    'PORCENTAGEM PARA ENTRAR': 'porcentagemParaEntrar',
    'USAR MARTINGALE APÓS QUANTOS LOSS?': 'usarMartingaleAposXLoss',
    'PARCELAS DE MARTINGALE': 'parcelasMartingale',
    'CONTADOR DE LOSS': 'contadorDeLoss',
    'LISTA DE DIGITOS': 'listaDeDigitos'
  };
  
  /**
   * Carrega o conteúdo XML da estratégia
   */
  public loadXml(xmlContent: string): boolean {
    try {
      this.xmlContent = xmlContent;
      const parser = new DOMParser();
      this.xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Extrair configurações básicas da estratégia
      this.extractVariables();
      this.extractTradeType();
      this.extractEntryConditions();
      
      return true;
    } catch (error) {
      console.error('[XML_PARSER] Erro ao carregar XML:', error);
      return false;
    }
  }
  
  /**
   * Define as configurações do usuário para sobrescrever os valores padrão
   */
  public setUserConfig(config: StrategyVariables): void {
    this.userConfig = config;
    console.log('[XML_PARSER] Configurações do usuário aplicadas:', config);
  }
  
  /**
   * Extrai as variáveis definidas no XML
   */
  private extractVariables(): void {
    if (!this.xmlDoc) return;
    
    try {
      // Obter todos os blocos de definição de variáveis
      const variablesBlocks = this.xmlDoc.getElementsByTagName('block');
      
      for (let i = 0; i < variablesBlocks.length; i++) {
        const block = variablesBlocks[i];
        
        // Verificar se é um bloco de atribuição de variável
        if (block.getAttribute('type') === 'variables_set') {
          // Obter o nome da variável
          const varField = block.getElementsByTagName('field')[0];
          if (varField && varField.getAttribute('name') === 'VAR') {
            const varName = varField.textContent || '';
            
            // Obter o valor da variável
            const valueBlock = block.getElementsByTagName('value')[0];
            if (valueBlock) {
              const numberBlock = valueBlock.getElementsByTagName('block')[0];
              let varValue: number | undefined;
              
              // Se for um bloco de número
              if (numberBlock && numberBlock.getAttribute('type') === 'math_number') {
                const numField = numberBlock.getElementsByTagName('field')[0];
                if (numField && numField.getAttribute('name') === 'NUM') {
                  varValue = parseFloat(numField.textContent || '0');
                }
              }
              // Se for uma referência a outra variável
              else if (numberBlock && numberBlock.getAttribute('type') === 'variables_get') {
                const refVarField = numberBlock.getElementsByTagName('field')[0];
                if (refVarField) {
                  const refVarName = refVarField.textContent || '';
                  // Mapear para o nome de variável no sistema
                  const systemVarName = this.variableMapping[refVarName];
                  if (systemVarName && this.variables[systemVarName] !== undefined) {
                    varValue = this.variables[systemVarName] as number;
                  }
                }
              }
              
              // Salvar variável com seu valor
              if (varValue !== undefined) {
                const systemVarName = this.variableMapping[varName];
                if (systemVarName) {
                  this.variables[systemVarName] = varValue;
                  console.log(`[XML_PARSER] Variável '${varName}' (${systemVarName}) = ${varValue}`);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('[XML_PARSER] Erro ao extrair variáveis:', error);
    }
  }
  
  /**
   * Extrai o tipo de operação do XML
   */
  private extractTradeType(): void {
    if (!this.xmlDoc) return;
    
    try {
      // Obter o bloco de trade
      const tradeBlocks = this.xmlDoc.getElementsByTagName('block');
      
      for (let i = 0; i < tradeBlocks.length; i++) {
        const block = tradeBlocks[i];
        
        // Verificar se é um bloco de trade
        if (block.getAttribute('type') === 'trade') {
          // Obter os campos do bloco de trade
          const fields = block.getElementsByTagName('field');
          
          for (let j = 0; j < fields.length; j++) {
            const field = fields[j];
            
            // Extrair tipo de trade (CALL/PUT/DIGIT...)
            if (field.getAttribute('name') === 'TRADETYPE_LIST') {
              this.tradeType = field.textContent || '';
            }
            
            // Extrair subtipo específico (CALL/PUT/DIGITOVER/DIGITUNDER)
            if (field.getAttribute('name') === 'TYPE_LIST') {
              this.contractType = field.textContent || '';
            }
          }
          
          console.log(`[XML_PARSER] Tipo de trade: ${this.tradeType}, Contrato: ${this.contractType}`);
          break;
        }
      }
    } catch (error) {
      console.error('[XML_PARSER] Erro ao extrair tipo de trade:', error);
    }
  }
  
  /**
   * Extrai as condições de entrada do XML
   */
  private extractEntryConditions(): void {
    if (!this.xmlDoc) return;
    
    try {
      // Obter o bloco de before_purchase (onde ficam as condições de entrada)
      const beforePurchaseBlocks = this.xmlDoc.getElementsByTagName('block');
      
      for (let i = 0; i < beforePurchaseBlocks.length; i++) {
        const block = beforePurchaseBlocks[i];
        
        // Verificar se é um bloco before_purchase
        if (block.getAttribute('type') === 'before_purchase') {
          // Obter as condições dentro do bloco
          const statements = block.getElementsByTagName('statement');
          
          for (let j = 0; j < statements.length; j++) {
            const statement = statements[j];
            
            // Verificar se é o stack de before_purchase
            if (statement.getAttribute('name') === 'BEFOREPURCHASE_STACK') {
              // Extrair condições (blocos IF e outros)
              const conditionBlocks = statement.getElementsByTagName('block');
              
              for (let k = 0; k < conditionBlocks.length; k++) {
                this.entryConditions.push(conditionBlocks[k]);
              }
            }
          }
        }
      }
      
      console.log(`[XML_PARSER] Condições de entrada extraídas: ${this.entryConditions.length}`);
    } catch (error) {
      console.error('[XML_PARSER] Erro ao extrair condições de entrada:', error);
    }
  }
  
  /**
   * Analisa a estratégia Advance
   * Condição: Entrar APENAS quando dígitos 0 e 1 estiverem com frequência <= porcentagem definida
   */
  public analyzeAdvanceStrategy(digitStats: DigitStat[]): StrategyAnalysisResult {
    // Obter porcentagem limite
    let porcentagemParaEntrar = this.variables.porcentagemParaEntrar;
    
    // Se o usuário definiu um valor, substituir o padrão
    if (this.userConfig.porcentagemParaEntrar !== undefined) {
      porcentagemParaEntrar = this.userConfig.porcentagemParaEntrar;
      console.log(`[XML_PARSER] Usando porcentagem definida pelo usuário: ${porcentagemParaEntrar}%`);
    }
    
    // Se a porcentagem não estiver definida, não permitir operação
    if (porcentagemParaEntrar === undefined) {
      return {
        shouldEnter: false,
        contractType: 'DIGITOVER',
        amount: this.getFinalAmount(),
        message: 'Porcentagem para entrar não definida. Defina nas configurações.'
      };
    }
    
    // Obter estatísticas dos dígitos 0 e 1
    const digit0 = digitStats.find(d => d.digit === 0);
    const digit1 = digitStats.find(d => d.digit === 1);
    
    if (!digit0 || !digit1) {
      return {
        shouldEnter: false,
        contractType: 'DIGITOVER',
        amount: this.getFinalAmount(),
        message: 'Estatísticas incompletas para dígitos 0 e 1'
      };
    }
    
    // Verificar a condição exata da estratégia ADVANCE
    // Condição: AMBOS os dígitos 0 e 1 devem ter frequência <= porcentagem definida
    const digit0Percentage = Math.round(digit0.percentage);
    const digit1Percentage = Math.round(digit1.percentage);
    const shouldEnter = digit0Percentage <= porcentagemParaEntrar && digit1Percentage <= porcentagemParaEntrar;
    
    // Determinar tipo de contrato (a estratégia Advance usa DIGITOVER por padrão)
    const contractType = 'DIGITOVER';
    
    // Determinar mensagem de feedback
    const message = shouldEnter
      ? `ADVANCE: Condição atendida! Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${porcentagemParaEntrar}%`
      : `ADVANCE: Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${porcentagemParaEntrar}%`;
    
    // Obter valor de entrada com sobreposição de configuração do usuário
    const amount = this.getFinalAmount();
    
    return {
      shouldEnter,
      contractType,
      amount,
      prediction: this.variables.previsao,
      message
    };
  }
  
  /**
   * Analisa a estratégia Iron Over
   * Condição: Usar DIGITOVER e controlar martingale após X perdas
   */
  public analyzeIronOverStrategy(consecutiveLosses: number): StrategyAnalysisResult {
    // Obter valor para martingale após X perdas
    let usarMartingaleAposXLoss = this.variables.usarMartingaleAposXLoss;
    
    // Se o usuário definiu um valor, substituir o padrão
    if (this.userConfig.usarMartingaleAposXLoss !== undefined) {
      usarMartingaleAposXLoss = this.userConfig.usarMartingaleAposXLoss;
      console.log(`[XML_PARSER] Usando limite de perdas para martingale definido pelo usuário: ${usarMartingaleAposXLoss}`);
    }
    
    // Se não estiver definido, usar valor padrão 1
    if (usarMartingaleAposXLoss === undefined) {
      usarMartingaleAposXLoss = 1;
    }
    
    // Verificar se deve usar martingale
    const useMartingale = consecutiveLosses >= usarMartingaleAposXLoss;
    
    // IRON OVER sempre entra, mas controla o martingale
    const shouldEnter = true;
    
    // Obter valor de entrada considerando martingale
    let amount = this.getFinalAmount();
    
    // Se for usar martingale, ajustar valor
    if (useMartingale && consecutiveLosses > 0) {
      let martingaleFactor = this.variables.martingale || 0.5;
      
      // Se o usuário definiu um valor, substituir o padrão
      if (this.userConfig.martingale !== undefined) {
        martingaleFactor = this.userConfig.martingale;
      }
      
      // Calcular novo valor com martingale
      amount = Math.round((amount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[XML_PARSER] IRON OVER: Aplicando martingale (${martingaleFactor}) após ${consecutiveLosses} perdas, novo valor: ${amount}`);
    }
    
    // Obter previsão do XML ou configuração do usuário
    let prediction = this.variables.previsao || 5;
    
    // Mensagem da estratégia
    const message = useMartingale
      ? `IRON OVER: Usando martingale após ${consecutiveLosses} perdas (limite: ${usarMartingaleAposXLoss}). Previsão: DIGITOVER ${prediction}`
      : `IRON OVER: Operação normal sem martingale. Previsão: DIGITOVER ${prediction}`;
    
    return {
      shouldEnter,
      contractType: 'DIGITOVER',
      prediction,
      amount,
      message
    };
  }
  
  /**
   * Analisa a estratégia Iron Under
   * Condição: Usar DIGITUNDER e controlar martingale após X perdas
   */
  public analyzeIronUnderStrategy(consecutiveLosses: number): StrategyAnalysisResult {
    // Similar ao Iron Over mas com tipo de contrato DIGITUNDER
    // Obter valor para martingale após X perdas
    let usarMartingaleAposXLoss = this.variables.usarMartingaleAposXLoss;
    
    // Se o usuário definiu um valor, substituir o padrão
    if (this.userConfig.usarMartingaleAposXLoss !== undefined) {
      usarMartingaleAposXLoss = this.userConfig.usarMartingaleAposXLoss;
      console.log(`[XML_PARSER] Usando limite de perdas para martingale definido pelo usuário: ${usarMartingaleAposXLoss}`);
    }
    
    // Se não estiver definido, usar valor padrão 1
    if (usarMartingaleAposXLoss === undefined) {
      usarMartingaleAposXLoss = 1;
    }
    
    // Verificar se deve usar martingale
    const useMartingale = consecutiveLosses >= usarMartingaleAposXLoss;
    
    // IRON UNDER sempre entra, mas controla o martingale
    const shouldEnter = true;
    
    // Obter valor de entrada considerando martingale
    let amount = this.getFinalAmount();
    
    // Se for usar martingale, ajustar valor
    if (useMartingale && consecutiveLosses > 0) {
      let martingaleFactor = this.variables.martingale || 0.5;
      
      // Se o usuário definiu um valor, substituir o padrão
      if (this.userConfig.martingale !== undefined) {
        martingaleFactor = this.userConfig.martingale;
      }
      
      // Calcular novo valor com martingale
      amount = Math.round((amount * (1 + martingaleFactor)) * 100) / 100;
      console.log(`[XML_PARSER] IRON UNDER: Aplicando martingale (${martingaleFactor}) após ${consecutiveLosses} perdas, novo valor: ${amount}`);
    }
    
    // Obter previsão do XML ou configuração do usuário
    let prediction = this.variables.previsao || 4;
    
    // Mensagem da estratégia
    const message = useMartingale
      ? `IRON UNDER: Usando martingale após ${consecutiveLosses} perdas (limite: ${usarMartingaleAposXLoss}). Previsão: DIGITUNDER ${prediction}`
      : `IRON UNDER: Operação normal sem martingale. Previsão: DIGITUNDER ${prediction}`;
    
    return {
      shouldEnter,
      contractType: 'DIGITUNDER',
      prediction,
      amount,
      message
    };
  }
  
  /**
   * Obtém o valor final para entrada considerando configurações do usuário
   */
  private getFinalAmount(): number {
    // Valor inicial da estratégia
    let amount = this.variables.valorInicial || 0.35;
    
    // Se o usuário definiu um valor, substituir o padrão
    if (this.userConfig.valorInicial !== undefined) {
      amount = this.userConfig.valorInicial;
    }
    
    return amount;
  }
  
  /**
   * Analisar qualquer estratégia com base no XML carregado
   */
  public analyzeStrategy(
    strategyId: string, 
    digitStats: DigitStat[],
    consecutiveLosses: number = 0
  ): StrategyAnalysisResult {
    const normalizedId = strategyId.toLowerCase();
    
    // Estratégia ADVANCE
    if (normalizedId.includes('advance')) {
      return this.analyzeAdvanceStrategy(digitStats);
    }
    // Estratégia IRON OVER
    else if (normalizedId.includes('iron_over') || normalizedId.includes('ironover')) {
      return this.analyzeIronOverStrategy(consecutiveLosses);
    }
    // Estratégia IRON UNDER
    else if (normalizedId.includes('iron_under') || normalizedId.includes('ironunder')) {
      return this.analyzeIronUnderStrategy(consecutiveLosses);
    } 
    // Implementar outras estratégias conforme necessário
    
    // Estratégia padrão
    return {
      shouldEnter: true,
      contractType: this.contractType || 'DIGITOVER',
      prediction: this.variables.previsao,
      amount: this.getFinalAmount(),
      message: `Estratégia ${strategyId}: Usando configuração padrão`
    };
  }
  
  /**
   * Obter todas as variáveis extraídas do XML
   */
  public getVariables(): StrategyVariables {
    return this.variables;
  }
  
  /**
   * Obter o tipo de contrato definido no XML
   */
  public getContractType(): string {
    return this.contractType;
  }
}

// Instância global do parser
const xmlStrategyParser = new XmlStrategyParser();
export default xmlStrategyParser;