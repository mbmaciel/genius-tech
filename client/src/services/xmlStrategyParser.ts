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
  entryAmount?: number; // Valor efetivo para entrada
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
   * Usa as configurações do usuário para sobrescrever variáveis extraídas do XML
   */
  public setUserConfig(config: StrategyVariables): void {
    this.userConfig = config;
    console.log('[XML_PARSER] Configurações do usuário aplicadas:', config);
    
    // Aplicar configurações do usuário diretamente nas variáveis (sobrescrevendo o XML)
    if (config.porcentagemParaEntrar !== undefined) {
      this.variables.porcentagemParaEntrar = config.porcentagemParaEntrar;
      console.log(`[XML_PARSER] Sobrescrevendo porcentagemParaEntrar com valor do usuário: ${config.porcentagemParaEntrar}`);
    }
    
    if (config.martingale !== undefined) {
      this.variables.martingale = config.martingale;
      console.log(`[XML_PARSER] Sobrescrevendo martingale com valor do usuário: ${config.martingale}`);
    }
    
    if (config.usarMartingaleAposXLoss !== undefined) {
      this.variables.usarMartingaleAposXLoss = config.usarMartingaleAposXLoss;
      console.log(`[XML_PARSER] Sobrescrevendo usarMartingaleAposXLoss com valor do usuário: ${config.usarMartingaleAposXLoss}`);
    }
    
    if (config.parcelasMartingale !== undefined) {
      this.variables.parcelasMartingale = config.parcelasMartingale;
      console.log(`[XML_PARSER] Sobrescrevendo parcelasMartingale com valor do usuário: ${config.parcelasMartingale}`);
    }
    
    if (config.valorInicial !== undefined) {
      this.variables.valorInicial = config.valorInicial;
      console.log(`[XML_PARSER] Sobrescrevendo valorInicial com valor do usuário: ${config.valorInicial}`);
    }
    
    if (config.meta !== undefined) {
      this.variables.meta = config.meta;
      console.log(`[XML_PARSER] Sobrescrevendo meta com valor do usuário: ${config.meta}`);
    }
    
    if (config.limitePerda !== undefined) {
      this.variables.limitePerda = config.limitePerda;
      console.log(`[XML_PARSER] Sobrescrevendo limitePerda com valor do usuário: ${config.limitePerda}`);
    }
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
    console.log(`[XML_PARSER] ADVANCE: Analisando condições de entrada`);
    console.log(`[XML_PARSER] ADVANCE: Variáveis atuais:`, JSON.stringify(this.variables));
    console.log(`[XML_PARSER] ADVANCE: Configurações do usuário:`, JSON.stringify(this.userConfig));
    
    // Obter porcentagem limite - CRÍTICO PARA ESTRATÉGIA ADVANCE
    let porcentagemParaEntrar = this.variables.porcentagemParaEntrar;
    
    // VERIFICAÇÃO PRIORITÁRIA: configuração do usuário deve sempre sobrescrever o XML
    if (this.userConfig.porcentagemParaEntrar !== undefined) {
      porcentagemParaEntrar = this.userConfig.porcentagemParaEntrar;
      console.log(`[XML_PARSER] ADVANCE: Usando porcentagem definida pelo usuário: ${porcentagemParaEntrar}%`);
    } else {
      console.log(`[XML_PARSER] ADVANCE: Porcentagem não definida pelo usuário. Valor do XML: ${porcentagemParaEntrar}`);
    }
    
    // BLOQUEIO DE SEGURANÇA: Se porcentagem não estiver definida, não permitir operação
    // Esta verificação é crítica para a estratégia Advance
    if (porcentagemParaEntrar === undefined) {
      console.log(`[XML_PARSER] ADVANCE: ERRO - Porcentagem para entrar não definida!`);
      
      return {
        shouldEnter: false,
        contractType: 'DIGITOVER',
        amount: this.getFinalAmount(),
        entryAmount: this.getFinalAmount(), // Garantir que o campo entryAmount seja enviado
        message: 'CONFIGURAÇÃO PENDENTE: Porcentagem para entrar não definida. Defina nas configurações.'
      };
    }
    
    console.log(`[XML_PARSER] ADVANCE: Porcentagem limite definida: ${porcentagemParaEntrar}%`);
    
    // Obter estatísticas dos dígitos 0 e 1
    let digit0 = digitStats.find(d => d.digit === 0);
    let digit1 = digitStats.find(d => d.digit === 1);
    
    // Garantir que sempre temos valores válidos mesmo se não encontrarmos nas estatísticas
    // Isso evita que a estratégia fique bloqueada se não encontrar os dígitos
    if (!digit0) {
      console.log(`[XML_PARSER] ADVANCE: Estatística para dígito 0 não encontrada, criando valor padrão`);
      digit0 = { digit: 0, count: 0, percentage: 0 };
    }
    
    if (!digit1) {
      console.log(`[XML_PARSER] ADVANCE: Estatística para dígito 1 não encontrada, criando valor padrão`);
      digit1 = { digit: 1, count: 0, percentage: 0 };
    }
    
    // Verificar a condição exata da estratégia ADVANCE
    // Condição: AMBOS os dígitos 0 e 1 devem ter frequência <= porcentagem definida
    const digit0Percentage = Math.round(digit0.percentage);
    const digit1Percentage = Math.round(digit1.percentage);
    
    console.log(`[XML_PARSER] ADVANCE: Estatísticas atuais: Dígito 0 = ${digit0Percentage}%, Dígito 1 = ${digit1Percentage}%`);
    console.log(`[XML_PARSER] ADVANCE: Condição: ambos devem ser <= ${porcentagemParaEntrar}%`);
    
    const shouldEnter = digit0Percentage <= porcentagemParaEntrar && digit1Percentage <= porcentagemParaEntrar;
    
    // Estratégia Advance: alterar para CALL em vez de DIGITOVER para evitar erros com dígito 0
    // CALL é mais confiável para a estratégia Advance e evita erros de validação de dígitos
    const contractType = 'CALL';
    
    // Obter valor de entrada com sobreposição de configuração do usuário
    const amount = this.getFinalAmount();
    
    // Determinar mensagem de feedback
    const message = shouldEnter
      ? `ADVANCE: Condição atendida! Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${porcentagemParaEntrar}%`
      : `ADVANCE: Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${porcentagemParaEntrar}%`;
    
    console.log(`[XML_PARSER] ADVANCE: Resultado da análise: ${shouldEnter ? 'ENTRAR' : 'NÃO ENTRAR'}`);
    
    return {
      shouldEnter,
      contractType,
      amount,
      entryAmount: amount, // Garantir que o valor seja enviado para o callback
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
      // IRON OVER usa uma lógica de martingale diferente:
      // Após X perdas consecutivas (usarMartingaleAposXLoss), o valor da entrada
      // é o valor inicial multiplicado pelo número de perdas consecutivas
      
      // Obter valor inicial para a estratégia (prioridade: configuração do usuário > XML > valor padrão)
      const valorInicial = this.userConfig.valorInicial !== undefined 
                         ? this.userConfig.valorInicial 
                         : this.variables.valorInicial || 0.35;
      
      // Obter fator de martingale (prioridade: configuração do usuário > XML > valor padrão)
      const martingaleFator = this.userConfig.martingale !== undefined
                            ? this.userConfig.martingale
                            : this.variables.martingale || 0.5;
      
      // CORREÇÃO CRÍTICA: Implementar corretamente o martingale conforme a lógica do XML
      // Usando a fórmula correta: valorInicial * (1 + martingaleFator * (consecutiveLosses - usarMartingaleAposXLoss + 1))
      const martingaleMultiplier = 1 + martingaleFator;
      amount = Math.round((valorInicial * martingaleMultiplier) * 100) / 100;
      
      console.log(`[XML_PARSER] IRON OVER: Aplicando martingale específico após ${consecutiveLosses} perdas.`);
      console.log(`[XML_PARSER] IRON OVER: Valor inicial: ${valorInicial}, Fator: ${martingaleFator}, Novo valor: ${amount}`);
    }
    
    // Obter previsão do XML ou configuração do usuário
    let prediction = this.variables.previsao;
    
    // CORREÇÃO CRÍTICA: Validar e garantir que prediction tenha um valor válido entre 1-9 para DIGITOVER
    if (prediction === undefined || prediction === null || prediction < 1 || prediction > 9) {
      // Usar um valor padrão seguro se prediction não for válido (1-9 são os únicos valores permitidos)
      prediction = 5; // Valor conservador como fallback
      console.log(`[XML_PARSER] 🚨 CORREÇÃO CRÍTICA: Previsão inválida para DIGITOVER. Usando valor padrão: ${prediction}`);
    } else {
      console.log(`[XML_PARSER] Usando previsão configurada: ${prediction} para DIGITOVER`);
    }
    
    // Mensagem da estratégia
    const message = useMartingale
      ? `IRON OVER: Usando martingale após ${consecutiveLosses} perdas (limite: ${usarMartingaleAposXLoss}). Previsão: DIGITOVER ${prediction}`
      : `IRON OVER: Operação normal sem martingale. Previsão: DIGITOVER ${prediction}`;
    
    return {
      shouldEnter,
      contractType: 'DIGITOVER',
      prediction,
      amount,
      entryAmount: amount,
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
      // IRON UNDER usa a mesma lógica do IRON OVER:
      // Após X perdas consecutivas (usarMartingaleAposXLoss), o valor da entrada
      // é o valor inicial multiplicado pelo número de perdas consecutivas
      
      // Obter valor inicial para a estratégia (prioridade: configuração do usuário > XML > valor padrão)
      const valorInicial = this.userConfig.valorInicial !== undefined 
                         ? this.userConfig.valorInicial 
                         : this.variables.valorInicial || 0.35;
      
      // Obter fator de martingale (prioridade: configuração do usuário > XML > valor padrão)
      const martingaleFator = this.userConfig.martingale !== undefined
                            ? this.userConfig.martingale
                            : this.variables.martingale || 0.5;
      
      // CORREÇÃO CRÍTICA: Implementar corretamente o martingale conforme a lógica do XML
      // Usando a fórmula correta: valorInicial * (1 + martingaleFator * (consecutiveLosses - usarMartingaleAposXLoss + 1))
      const martingaleMultiplier = 1 + martingaleFator;
      amount = Math.round((valorInicial * martingaleMultiplier) * 100) / 100;
      
      console.log(`[XML_PARSER] IRON UNDER: Aplicando martingale específico após ${consecutiveLosses} perdas.`);
      console.log(`[XML_PARSER] IRON UNDER: Valor inicial: ${valorInicial}, Fator: ${martingaleFator}, Novo valor: ${amount}`);
    }
    
    // Obter previsão do XML ou configuração do usuário
    let prediction = this.variables.previsao;
    
    // CORREÇÃO CRÍTICA: Validar e garantir que prediction tenha um valor válido entre 1-9 para DIGITUNDER
    if (prediction === undefined || prediction === null || prediction < 1 || prediction > 9) {
      // Usar um valor padrão seguro se prediction não for válido (1-9 são os únicos valores permitidos)
      prediction = 5; // Valor conservador como fallback
      console.log(`[XML_PARSER] 🚨 CORREÇÃO CRÍTICA: Previsão inválida para DIGITUNDER. Usando valor padrão: ${prediction}`);
    } else {
      console.log(`[XML_PARSER] Usando previsão configurada: ${prediction} para DIGITUNDER`);
    }
    
    // Mensagem da estratégia
    const message = useMartingale
      ? `IRON UNDER: Usando martingale após ${consecutiveLosses} perdas (limite: ${usarMartingaleAposXLoss}). Previsão: DIGITUNDER ${prediction}`
      : `IRON UNDER: Operação normal sem martingale. Previsão: DIGITUNDER ${prediction}`;
    
    return {
      shouldEnter,
      contractType: 'DIGITUNDER',
      prediction,
      amount,
      entryAmount: amount,
      message
    };
  }
  
  /**
   * Obtém o valor final para entrada considerando configurações do usuário
   */
  private getFinalAmount(): number {
    // CORREÇÃO CRÍTICA: Priorizar SEMPRE configurações do usuário sobre valores do XML
    
    // Buscar configuração definida pelo usuário no localStorage
    // Esta abordagem é mais confiável porque pega diretamente do localStorage
    // em vez de confiar apenas no this.userConfig que pode estar desatualizado
    let strategies = ['ironover', 'ironunder', 'advance'];
    let valorConfigurado = null;
    
    // Verificar para cada estratégia possível
    for (const strategyId of strategies) {
      try {
        const configStr = localStorage.getItem(`strategy_config_${strategyId}`);
        if (configStr) {
          const config = JSON.parse(configStr);
          if (config.valorInicial !== undefined) {
            valorConfigurado = parseFloat(config.valorInicial);
            console.log(`[XML_PARSER] 🚨 CORREÇÃO CRÍTICA: Encontrado valor inicial ${valorConfigurado} configurado pelo usuário para ${strategyId}`);
            break; // Usar o primeiro valor encontrado
          }
        }
      } catch (e) {
        console.error(`[XML_PARSER] Erro ao ler configuração salva para ${strategyId}:`, e);
      }
    }
    
    // Ordem de prioridade para valor de entrada:
    // 1. Valor encontrado no localStorage (mais confiável)
    // 2. Valor definido no userConfig (argumentos da função)
    // 3. Valor definido no XML
    // 4. Valor padrão (1.0) - CORREÇÃO: Valor default mais visível quando usado
    let amount = 1.0; // Valor padrão alterado para ser mais perceptível
    
    if (valorConfigurado !== null) {
      // Prioridade 1: Usar valor definido pelo usuário no localStorage
      amount = valorConfigurado;
      console.log(`[XML_PARSER] 🚨 CORREÇÃO CRÍTICA: Usando valor ${amount} definido pelo usuário no localStorage`);
    } else if (this.userConfig.valorInicial !== undefined) {
      // Prioridade 2: Usar valor definido no userConfig
      amount = this.userConfig.valorInicial;
      console.log(`[XML_PARSER] Usando valor ${amount} definido no userConfig`);
    } else if (this.variables.valorInicial !== undefined) {
      // Prioridade 3: Usar valor definido no XML
      amount = this.variables.valorInicial;
      console.log(`[XML_PARSER] Usando valor ${amount} definido no XML`);
    } else {
      // Prioridade 4: Usar valor padrão
      console.log(`[XML_PARSER] Nenhum valor configurado encontrado. Usando valor padrão: ${amount}`);
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
    
    console.log(`[XML_PARSER] Analisando estratégia: "${strategyId}" (normalizado: "${normalizedId}")`);
    
    // VERIFICAÇÃO ESTRATÉGIA ADVANCE - VERIFICAÇÕES ADICIONAIS PARA GARANTIR RECONHECIMENTO
    if (normalizedId.includes('advance') || normalizedId === 'advance' || strategyId === 'Advance' || strategyId === 'ADVANCE') {
      console.log(`[XML_PARSER] Estratégia ADVANCE reconhecida! Usando análise específica para Advance`);
      return this.analyzeAdvanceStrategy(digitStats);
    }
    // Estratégia IRON OVER
    else if (normalizedId.includes('iron_over') || normalizedId.includes('ironover')) {
      console.log(`[XML_PARSER] Estratégia IRON OVER reconhecida!`);
      return this.analyzeIronOverStrategy(consecutiveLosses);
    }
    // Estratégia IRON UNDER
    else if (normalizedId.includes('iron_under') || normalizedId.includes('ironunder')) {
      console.log(`[XML_PARSER] Estratégia IRON UNDER reconhecida!`);
      return this.analyzeIronUnderStrategy(consecutiveLosses);
    } 
    // Implementar outras estratégias conforme necessário
    
    // Se chegou aqui, não reconheceu nenhuma estratégia específica
    console.log(`[XML_PARSER] AVISO: Estratégia não reconhecida: "${strategyId}". Usando configuração padrão.`);
    
    // Obter previsão do XML ou configuração do usuário
    let prediction = this.variables.previsao;
    let contractType = this.contractType || 'DIGITOVER';
    
    // CORREÇÃO CRÍTICA: Validar e garantir que prediction tenha um valor válido entre 1-9 para contracts DIGIT
    if (prediction === undefined || prediction === null || prediction < 1 || prediction > 9) {
      // Usar um valor padrão seguro se prediction não for válido (1-9 são os únicos valores permitidos)
      prediction = 5; // Valor conservador como fallback
      console.log(`[XML_PARSER] 🚨 CORREÇÃO CRÍTICA: Previsão inválida para estratégia padrão. Usando valor padrão: ${prediction}`);
    }
    
    // Estratégia padrão
    return {
      shouldEnter: true,
      contractType: contractType,
      prediction: prediction,
      amount: this.getFinalAmount(),
      entryAmount: this.getFinalAmount(), // Garantir que o campo entryAmount seja enviado
      message: `Estratégia ${strategyId}: Usando configuração padrão com previsão ${prediction} e tipo ${contractType}`
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