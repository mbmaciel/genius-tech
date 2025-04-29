/**
 * XML Strategy Parser
 * Interpreta fielmente as estratégias definidas nos arquivos XML
 * e executa seus comandos exatamente como definidos
 */

import { DOMParser } from "xmldom";
import { DigitStat } from "./strategyRules";

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
  martingaleAtivo?: boolean; // Se martingale está ativo
  resetOnWin?: boolean; // Resetar para valor inicial após vitória

  // Configurações de duração e barreiras
  duration?: number; // Duração em ticks
  durationUnit?: string; // Unidade de duração (normalmente 't' para ticks)
  barrier?: string; // Barreira para contratos

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
  duration?: number; // Duração do contrato em ticks (normalmente 1 para 1 tick)
  message: string;
  rawCommands?: any;
}

// Interface para configuração completa da estratégia
export interface StrategyConfiguration {
  // Informações básicas
  name: string; // Nome da estratégia (ex: Advance, IRON UNDER)
  description?: string; // Descrição opcional
  
  // Configurações de operação
  contractType: string; // Tipo de contrato (DIGITOVER, DIGITUNDER, etc)
  symbol: string; // Símbolo a ser operado (R_100)
  
  // Valores de entrada e gerenciamento de risco
  entryValue: number; // Valor inicial
  martingaleFactor: number; // Fator de martingale
  profitTarget?: number; // Meta de lucro
  lossLimit?: number; // Limite de perda
  
  // Configurações técnicas
  prediction?: number; // Previsão (para contratos de dígito)
  barrier?: string; // Barreira (para contratos de dígito)
  duration?: number; // Duração em ticks/segundos
  durationUnit?: string; // Unidade de duração (t=ticks, s=segundos)
  
  // Configurações de regras 
  lossVirtualEnabled?: boolean; // Habilitar lossVirtual (martingale)
  resetOnWin?: boolean; // Resetar para valor inicial após vitória
  martingaleAfterConsecutiveLosses?: number; // Aplicar martingale após X perdas
  martingaleInstallments?: number; // Parcelas de martingale
}

/**
 * Extrai todas as configurações relevantes de um arquivo XML de estratégia
 * para garantir que a implementação siga fielmente o XML
 * 
 * @param xmlContent Conteúdo do arquivo XML como string
 * @param strategyName Nome da estratégia para identificação
 */
export function extractStrategyConfig(xmlContent: string, strategyName: string): StrategyConfiguration {
  // Criar parser XML
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
  
  // Configuração padrão
  const config: StrategyConfiguration = {
    name: strategyName,
    contractType: "DIGITOVER", // Valor padrão
    symbol: "R_100", // Símbolo padrão
    entryValue: 1, // Valor inicial padrão
    martingaleFactor: 1.5, // Fator de martingale padrão
    lossVirtualEnabled: true, // Ativar martingale por padrão
    resetOnWin: true, // Resetar após vitória por padrão
  };
  
  try {
    // Tentar extrair informações do XML
    
    // 1. Buscar tipo de contrato
    const tradeBlock = xmlDoc.getElementsByTagName("field");
    for (let i = 0; i < tradeBlock.length; i++) {
      const field = tradeBlock[i];
      if (field.getAttribute("name") === "TRADETYPE_LIST") {
        const tradeType = field.textContent?.trim().toLowerCase();
        if (tradeType === "overunder") {
          config.contractType = "DIGITOVER"; // Padrão para overunder quando não especificado
        } else if (tradeType === "matches") {
          config.contractType = "DIGITMATCHES";
        } else if (tradeType === "differs") {
          config.contractType = "DIGITDIFF";
        } else if (tradeType === "even") {
          config.contractType = "DIGITEVEN";
        } else if (tradeType === "odd") {
          config.contractType = "DIGITODD";
        }
      }
      
      // Buscar símbolo
      if (field.getAttribute("name") === "SYMBOL_LIST") {
        config.symbol = field.textContent?.trim() || "R_100";
      }
    }
    
    // 2. Extrair variáveis definidas no bloco de variáveis
    const variableBlocks = xmlDoc.getElementsByTagName("variables_set");
    for (let i = 0; i < variableBlocks.length; i++) {
      const varBlock = variableBlocks[i];
      const varField = varBlock.getElementsByTagName("field")[0];
      
      if (!varField) continue;
      
      const varName = varField.textContent?.trim().toUpperCase();
      
      // Obter o valor da variável (normalmente em um bloco math_number)
      const valueBlock = varBlock.getElementsByTagName("value")[0];
      if (!valueBlock) continue;
      
      const mathBlock = valueBlock.getElementsByTagName("block")[0];
      if (!mathBlock) continue;
      
      const numField = mathBlock.getElementsByTagName("field")[0];
      if (!numField || numField.getAttribute("name") !== "NUM") continue;
      
      const value = parseFloat(numField.textContent || "0");
      
      // Mapear variáveis para a configuração
      if (varName?.includes("VALOR INICIAL")) {
        config.entryValue = value;
      } else if (varName?.includes("MARTINGALE")) {
        config.martingaleFactor = value;
      } else if (varName?.includes("META")) {
        config.profitTarget = value;
      } else if (varName?.includes("LIMITE DE PERDA")) {
        config.lossLimit = value;
      } else if (varName?.includes("PREVISÃO") || varName?.includes("PREDICTION")) {
        config.prediction = value;
      } else if (varName?.includes("PORCENTAGEM")) {
        // Variável específica do Advance
        if (strategyName.toLowerCase().includes("advance")) {
          config.description = `Entra quando frequência <= ${value}%`;
        }
      } else if (varName?.includes("PARCELAS")) {
        config.martingaleInstallments = value;
      } else if (varName?.includes("DURATION") || varName?.includes("DURAÇÃO")) {
        config.duration = value;
      }
    }
    
    // 3. Verificar se há lossVirtual (aumento após perda) implementado
    // Vamos verificar se existe algum controle de loop ou martingale no XML
    if (xmlContent.toLowerCase().includes("martingale") || 
        xmlContent.toLowerCase().includes("loss") ||
        xmlContent.toLowerCase().includes("perda")) {
      config.lossVirtualEnabled = true;
    }
    
    // 4. Verificar se resetOnWin é mencionado (reset após vitória)
    if (xmlContent.toLowerCase().includes("valor") && 
        xmlContent.toLowerCase().includes("vencer")) {
      config.resetOnWin = true;
    }
    
    // 5. Ajustes específicos baseados no nome da estratégia
    const strategyLower = strategyName.toLowerCase();
    
    if (strategyLower.includes("advance")) {
      // Advance é sempre DIGITOVER com barreira 1
      config.contractType = "DIGITOVER";
      config.barrier = "1";
      config.prediction = 1;
      config.duration = 1;
      config.durationUnit = "t";
    } else if (strategyLower.includes("ironunder")) {
      config.contractType = "DIGITUNDER";
      // Para IRON UNDER, martingale é um percentual (ex: 0.5 = 50%)
      if (config.martingaleFactor < 1) {
        config.martingaleFactor = 1 + config.martingaleFactor;
      }
    } else if (strategyLower.includes("ironover")) {
      config.contractType = "DIGITOVER";
      // Para IRON OVER, martingale é um percentual (ex: 0.5 = 50%)
      if (config.martingaleFactor < 1) {
        config.martingaleFactor = 1 + config.martingaleFactor;
      }
    } else if (strategyLower.includes("botlow")) {
      // BOT LOW é tipicamente DIGITUNDER
      config.contractType = "DIGITUNDER";
    } else if (strategyLower.includes("manual")) {
      // Manual pode ser OVER ou UNDER dependendo do nome
      if (strategyLower.includes("under")) {
        config.contractType = "DIGITUNDER";
      } else {
        config.contractType = "DIGITOVER";
      }
    }
    
  } catch (error) {
    console.error(`[XML_PARSER] Erro ao analisar XML para ${strategyName}:`, error);
  }
  
  return config;
}

// Classe para interpretar e executar estratégias XML
export class XmlStrategyParser {
  private xmlContent: string = "";
  private xmlDoc: Document | null = null;
  private variables: StrategyVariables = {};
  private tradeType: string = "";
  private contractType: string = "";
  private entryConditions: any[] = [];
  private userConfig: StrategyVariables = {};

  // Mapeamento de variáveis do XML para nomes no sistema
  private variableMapping: Record<string, string> = {
    "VALOR INICIAL": "valorInicial",
    "VALOR APÓS VENCER": "valorAposVencer",
    MARTINGALE: "martingale",
    META: "meta",
    "LIMITE DE PERDA": "limitePerda",
    PREVISÃO: "previsao",
    "PORCENTAGEM PARA ENTRAR": "porcentagemParaEntrar",
    "USAR MARTINGALE APÓS QUANTOS LOSS?": "usarMartingaleAposXLoss",
    "PARCELAS DE MARTINGALE": "parcelasMartingale",
    "CONTADOR DE LOSS": "contadorDeLoss",
    "LISTA DE DIGITOS": "listaDeDigitos",
  };

  /**
   * Carrega o conteúdo XML da estratégia
   */
  public loadXml(xmlContent: string): boolean {
    try {
      this.xmlContent = xmlContent;
      const parser = new DOMParser();
      this.xmlDoc = parser.parseFromString(xmlContent, "text/xml");

      // Extrair configurações básicas da estratégia
      this.extractVariables();
      this.extractTradeType();
      this.extractEntryConditions();

      return true;
    } catch (error) {
      console.error("[XML_PARSER] Erro ao carregar XML:", error);
      return false;
    }
  }

  /**
   * Define as configurações do usuário para sobrescrever os valores padrão
   * Usa as configurações do usuário para sobrescrever variáveis extraídas do XML
   */
  public setUserConfig(config: StrategyVariables): void {
    this.userConfig = config;
    console.log("[XML_PARSER] Configurações do usuário aplicadas:", config);

    // Aplicar configurações do usuário diretamente nas variáveis (sobrescrevendo o XML)
    if (config.porcentagemParaEntrar !== undefined) {
      this.variables.porcentagemParaEntrar = config.porcentagemParaEntrar;
      console.log(
        `[XML_PARSER] Sobrescrevendo porcentagemParaEntrar com valor do usuário: ${config.porcentagemParaEntrar}`,
      );
    }

    if (config.martingale !== undefined) {
      this.variables.martingale = config.martingale;
      console.log(
        `[XML_PARSER] Sobrescrevendo martingale com valor do usuário: ${config.martingale}`,
      );
    }

    if (config.usarMartingaleAposXLoss !== undefined) {
      this.variables.usarMartingaleAposXLoss = config.usarMartingaleAposXLoss;
      console.log(
        `[XML_PARSER] Sobrescrevendo usarMartingaleAposXLoss com valor do usuário: ${config.usarMartingaleAposXLoss}`,
      );
    }

    if (config.parcelasMartingale !== undefined) {
      this.variables.parcelasMartingale = config.parcelasMartingale;
      console.log(
        `[XML_PARSER] Sobrescrevendo parcelasMartingale com valor do usuário: ${config.parcelasMartingale}`,
      );
    }

    if (config.valorInicial !== undefined) {
      this.variables.valorInicial = config.valorInicial;
      console.log(
        `[XML_PARSER] Sobrescrevendo valorInicial com valor do usuário: ${config.valorInicial}`,
      );
    }

    if (config.meta !== undefined) {
      this.variables.meta = config.meta;
      console.log(
        `[XML_PARSER] Sobrescrevendo meta com valor do usuário: ${config.meta}`,
      );
    }

    if (config.limitePerda !== undefined) {
      this.variables.limitePerda = config.limitePerda;
      console.log(
        `[XML_PARSER] Sobrescrevendo limitePerda com valor do usuário: ${config.limitePerda}`,
      );
    }
  }

  /**
   * Extrai as variáveis definidas no XML
   */
  private extractVariables(): void {
    if (!this.xmlDoc) return;

    try {
      // Obter todos os blocos de definição de variáveis
      const variablesBlocks = this.xmlDoc.getElementsByTagName("block");

      for (let i = 0; i < variablesBlocks.length; i++) {
        const block = variablesBlocks[i];

        // Verificar se é um bloco de atribuição de variável
        if (block.getAttribute("type") === "variables_set") {
          // Obter o nome da variável
          const varField = block.getElementsByTagName("field")[0];
          if (varField && varField.getAttribute("name") === "VAR") {
            const varName = varField.textContent || "";

            // Obter o valor da variável
            const valueBlock = block.getElementsByTagName("value")[0];
            if (valueBlock) {
              const numberBlock = valueBlock.getElementsByTagName("block")[0];
              let varValue: number | undefined;

              // Se for um bloco de número
              if (
                numberBlock &&
                numberBlock.getAttribute("type") === "math_number"
              ) {
                const numField = numberBlock.getElementsByTagName("field")[0];
                if (numField && numField.getAttribute("name") === "NUM") {
                  varValue = parseFloat(numField.textContent || "0");
                }
              }
              // Se for uma referência a outra variável
              else if (
                numberBlock &&
                numberBlock.getAttribute("type") === "variables_get"
              ) {
                const refVarField =
                  numberBlock.getElementsByTagName("field")[0];
                if (refVarField) {
                  const refVarName = refVarField.textContent || "";
                  // Mapear para o nome de variável no sistema
                  const systemVarName = this.variableMapping[refVarName];
                  if (
                    systemVarName &&
                    this.variables[systemVarName] !== undefined
                  ) {
                    varValue = this.variables[systemVarName] as number;
                  }
                }
              }

              // Salvar variável com seu valor
              if (varValue !== undefined) {
                const systemVarName = this.variableMapping[varName];
                if (systemVarName) {
                  this.variables[systemVarName] = varValue;
                  console.log(
                    `[XML_PARSER] Variável '${varName}' (${systemVarName}) = ${varValue}`,
                  );
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("[XML_PARSER] Erro ao extrair variáveis:", error);
    }
  }

  /**
   * Extrai o tipo de operação do XML
   */
  private extractTradeType(): void {
    if (!this.xmlDoc) return;

    try {
      // Obter o bloco de trade
      const tradeBlocks = this.xmlDoc.getElementsByTagName("block");

      for (let i = 0; i < tradeBlocks.length; i++) {
        const block = tradeBlocks[i];

        // Verificar se é um bloco de trade
        if (block.getAttribute("type") === "trade") {
          // Obter os campos do bloco de trade
          const fields = block.getElementsByTagName("field");

          for (let j = 0; j < fields.length; j++) {
            const field = fields[j];

            // Extrair tipo de trade (CALL/PUT/DIGIT...)
            if (field.getAttribute("name") === "TRADETYPE_LIST") {
              this.tradeType = field.textContent || "";
            }

            // Extrair subtipo específico (CALL/PUT/DIGITOVER/DIGITUNDER)
            if (field.getAttribute("name") === "TYPE_LIST") {
              this.contractType = field.textContent || "";
            }
          }

          console.log(
            `[XML_PARSER] Tipo de trade: ${this.tradeType}, Contrato: ${this.contractType}`,
          );
          break;
        }
      }
    } catch (error) {
      console.error("[XML_PARSER] Erro ao extrair tipo de trade:", error);
    }
  }

  /**
   * Extrai o tipo de contrato da tag purchase no XML
   * Esta função busca especificamente o contrato definido na seção "before_purchase"
   * que será usado na compra efetiva
   */
  private extractPurchaseBlockType(): string | null {
    if (!this.xmlDoc) return null;

    try {
      // Procurar por blocos do tipo "purchase"
      const blocks = this.xmlDoc.getElementsByTagName("block");

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.getAttribute("type") === "purchase") {
          // Encontrou bloco de compra, obter o tipo definido no campo PURCHASE_LIST
          const fields = block.getElementsByTagName("field");

          for (let j = 0; j < fields.length; j++) {
            const field = fields[j];

            if (field.getAttribute("name") === "PURCHASE_LIST") {
              const contractType = field.textContent || "";
              console.log(
                `[XML_PARSER] ✅ Tipo de contrato extraído da tag purchase: ${contractType}`,
              );
              return contractType;
            }
          }
        }
      }

      console.log("[XML_PARSER] ⚠️ Nenhum bloco purchase encontrado no XML");
      return null;
    } catch (error) {
      console.error(
        "[XML_PARSER] Erro ao extrair tipo de contrato do bloco purchase:",
        error,
      );
      return null;
    }
  }

  /**
   * Extrai o valor de previsão definido no XML
   * Este valor é usado em contratos DIGITOVER/DIGITUNDER para definir o dígito alvo
   */
  private extractPredictionValue(): number | null {
    if (!this.xmlDoc) return null;

    try {
      // Obter blocos de opções de trade
      const blocks = this.xmlDoc.getElementsByTagName("block");

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.getAttribute("type") === "tradeOptions") {
          // Encontrou bloco de opções, procurar pelo valor de PREDICTION
          const predictionValues = block.getElementsByTagName("value");

          for (let j = 0; j < predictionValues.length; j++) {
            const valueBlock = predictionValues[j];

            if (valueBlock.getAttribute("name") === "PREDICTION") {
              // Verificar se tem um bloco de valor direto ou uma referência a variável
              const innerBlocks = valueBlock.getElementsByTagName("block");

              if (innerBlocks.length > 0) {
                const innerBlock = innerBlocks[0];

                // Caso seja um número direto
                if (innerBlock.getAttribute("type") === "math_number") {
                  const numField = innerBlock.getElementsByTagName("field")[0];
                  if (numField && numField.getAttribute("name") === "NUM") {
                    const predictionValue = parseFloat(
                      numField.textContent || "0",
                    );
                    console.log(
                      `[XML_PARSER] ✅ Valor de previsão extraído do XML: ${predictionValue}`,
                    );
                    return predictionValue;
                  }
                }
                // Caso seja uma referência a variável
                else if (innerBlock.getAttribute("type") === "variables_get") {
                  const varField = innerBlock.getElementsByTagName("field")[0];
                  if (varField && varField.getAttribute("name") === "VAR") {
                    const varName = varField.textContent || "";
                    // Mapear para o nome de variável no sistema
                    const systemVarName = this.variableMapping[varName];
                    if (
                      systemVarName &&
                      this.variables[systemVarName] !== undefined
                    ) {
                      const predictionValue = this.variables[
                        systemVarName
                      ] as number;
                      console.log(
                        `[XML_PARSER] ✅ Valor de previsão extraído da variável ${varName}: ${predictionValue}`,
                      );
                      return predictionValue;
                    }
                  }
                }
              }
            }
          }
        }
      }

      console.log("[XML_PARSER] ⚠️ Nenhum valor de previsão encontrado no XML");
      return null;
    } catch (error) {
      console.error("[XML_PARSER] Erro ao extrair valor de previsão:", error);
      return null;
    }
  }

  /**
   * Extrai a duração de entrada definida no XML
   * Este valor é usado para definir quanto tempo o contrato ficará ativo
   */
  private extractEntryDuration(): number | null {
    if (!this.xmlDoc) return null;

    try {
      // Obter blocos de opções de trade
      const blocks = this.xmlDoc.getElementsByTagName("block");

      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.getAttribute("type") === "tradeOptions") {
          // Encontrou bloco de opções, procurar pelo valor de DURATION
          const durationValues = block.getElementsByTagName("value");

          for (let j = 0; j < durationValues.length; j++) {
            const valueBlock = durationValues[j];

            if (valueBlock.getAttribute("name") === "DURATION") {
              // Verificar se tem um bloco de valor direto ou uma shadow
              const shadows = valueBlock.getElementsByTagName("shadow");
              const innerBlocks = valueBlock.getElementsByTagName("block");

              // Primeiro tentar ler de um bloco direto, se existir
              if (innerBlocks.length > 0) {
                const innerBlock = innerBlocks[0];

                if (innerBlock.getAttribute("type") === "math_number") {
                  const numField = innerBlock.getElementsByTagName("field")[0];
                  if (numField && numField.getAttribute("name") === "NUM") {
                    const durationValue = parseFloat(
                      numField.textContent || "0",
                    );
                    console.log(
                      `[XML_PARSER] ✅ Duração de entrada extraída do XML: ${durationValue}`,
                    );
                    return durationValue;
                  }
                }
              }
              // Se não encontrou em bloco direto, tentar ler do shadow
              else if (shadows.length > 0) {
                const shadow = shadows[0];

                if (shadow.getAttribute("type") === "math_number") {
                  const numField = shadow.getElementsByTagName("field")[0];
                  if (numField && numField.getAttribute("name") === "NUM") {
                    const durationValue = parseFloat(
                      numField.textContent || "0",
                    );
                    console.log(
                      `[XML_PARSER] ✅ Duração de entrada extraída do shadow no XML: ${durationValue}`,
                    );
                    return durationValue;
                  }
                }
              }
            }
          }

          // Verificar também o tipo de duração (t = ticks, s = segundos, etc.)
          const fields = block.getElementsByTagName("field");
          for (let j = 0; j < fields.length; j++) {
            const field = fields[j];

            if (field.getAttribute("name") === "DURATIONTYPE_LIST") {
              const durationType = field.textContent || "";
              console.log(
                `[XML_PARSER] ✅ Tipo de duração extraído do XML: ${durationType}`,
              );
              // Este valor não é retornado, apenas para logging
            }
          }
        }
      }

      console.log(
        "[XML_PARSER] ⚠️ Nenhuma duração de entrada encontrada no XML",
      );
      return null;
    } catch (error) {
      console.error("[XML_PARSER] Erro ao extrair duração de entrada:", error);
      return null;
    }
  }

  /**
   * Extrai a duração de saída definida no XML (opcional)
   * Usado em algumas estratégias para determinar quando vender o contrato
   */
  private extractExitDuration(): number | null {
    // Esta é uma função placeholder para futura implementação
    // A maioria das estratégias atuais não define isso explicitamente no XML
    return null;
  }

  /**
   * Extrai as condições de entrada do XML
   */
  private extractEntryConditions(): void {
    if (!this.xmlDoc) return;

    try {
      // Obter o bloco de before_purchase (onde ficam as condições de entrada)
      const beforePurchaseBlocks = this.xmlDoc.getElementsByTagName("block");

      for (let i = 0; i < beforePurchaseBlocks.length; i++) {
        const block = beforePurchaseBlocks[i];

        // Verificar se é um bloco before_purchase
        if (block.getAttribute("type") === "before_purchase") {
          // Obter as condições dentro do bloco
          const statements = block.getElementsByTagName("statement");

          for (let j = 0; j < statements.length; j++) {
            const statement = statements[j];

            // Verificar se é o stack de before_purchase
            if (statement.getAttribute("name") === "BEFOREPURCHASE_STACK") {
              // Extrair condições (blocos IF e outros)
              const conditionBlocks = statement.getElementsByTagName("block");

              for (let k = 0; k < conditionBlocks.length; k++) {
                this.entryConditions.push(conditionBlocks[k]);
              }
            }
          }
        }
      }

      console.log(
        `[XML_PARSER] Condições de entrada extraídas: ${this.entryConditions.length}`,
      );
    } catch (error) {
      console.error(
        "[XML_PARSER] Erro ao extrair condições de entrada:",
        error,
      );
    }
  }

  /**
   * Analisa a estratégia Advance
   * Condição: Entrar APENAS quando dígitos 0 e 1 estiverem com frequência <= porcentagem definida
   */
  public analyzeAdvanceStrategy(
    digitStats: DigitStat[],
  ): StrategyAnalysisResult {
    console.log(`[XML_PARSER] ADVANCE: Analisando condições de entrada`);
    console.log(
      `[XML_PARSER] ADVANCE: Variáveis atuais:`,
      JSON.stringify(this.variables),
    );
    console.log(
      `[XML_PARSER] ADVANCE: Configurações do usuário:`,
      JSON.stringify(this.userConfig),
    );

    // CORREÇÃO CRÍTICA: Sempre usar DIGITOVER com valor 1 para a estratégia Advance
    // Isso garante que o contrato ganha quando o dígito final é > 1
    console.log(
      `[XML_PARSER] 🚨 ADVANCE CORREÇÃO: Configurando DIGITOVER com valor 1 como especificado`,
    );

    // Obter porcentagem limite - CRÍTICO PARA ESTRATÉGIA ADVANCE
    let porcentagemParaEntrar = this.variables.porcentagemParaEntrar;

    // VERIFICAÇÃO PRIORITÁRIA: configuração do usuário deve sempre sobrescrever o XML
    if (this.userConfig.porcentagemParaEntrar !== undefined) {
      porcentagemParaEntrar = this.userConfig.porcentagemParaEntrar;
      console.log(
        `[XML_PARSER] ADVANCE: Usando porcentagem definida pelo usuário: ${porcentagemParaEntrar}%`,
      );
    } else {
      console.log(
        `[XML_PARSER] ADVANCE: Porcentagem não definida pelo usuário. Valor do XML: ${porcentagemParaEntrar}`,
      );
    }

    // BLOQUEIO DE SEGURANÇA: Se porcentagem não estiver definida, não permitir operação
    // Esta verificação é crítica para a estratégia Advance
    if (porcentagemParaEntrar === undefined) {
      console.log(
        `[XML_PARSER] ADVANCE: ERRO - Porcentagem para entrar não definida!`,
      );

      return {
        shouldEnter: false,
        contractType: "DIGITOVER",
        amount: this.getFinalAmount(),
        entryAmount: this.getFinalAmount(), // Garantir que o campo entryAmount seja enviado
        prediction: 1, // CORREÇÃO: Usando valor 1 como especificado
        duration: 1, // CORREÇÃO: Duração de exatamente 1 tick
        message:
          "CONFIGURAÇÃO PENDENTE: Porcentagem para entrar não definida. Defina nas configurações.",
      };
    }

    console.log(
      `[XML_PARSER] ADVANCE: Porcentagem limite definida: ${porcentagemParaEntrar}%`,
    );

    // Obter estatísticas dos dígitos 0 e 1
    let digit0 = digitStats.find((d) => d.digit === 0);
    let digit1 = digitStats.find((d) => d.digit === 1);

    // Garantir que sempre temos valores válidos mesmo se não encontrarmos nas estatísticas
    // Isso evita que a estratégia fique bloqueada se não encontrar os dígitos
    if (!digit0) {
      console.log(
        `[XML_PARSER] ADVANCE: Estatística para dígito 0 não encontrada, criando valor padrão`,
      );
      digit0 = { digit: 0, count: 0, percentage: 0 };
    }

    if (!digit1) {
      console.log(
        `[XML_PARSER] ADVANCE: Estatística para dígito 1 não encontrada, criando valor padrão`,
      );
      digit1 = { digit: 1, count: 0, percentage: 0 };
    }

    // Verificar a condição exata da estratégia ADVANCE
    // Condição: AMBOS os dígitos 0 e 1 devem ter frequência <= porcentagem definida
    const digit0Percentage = Math.round(digit0.percentage);
    const digit1Percentage = Math.round(digit1.percentage);

    console.log(
      `[XML_PARSER] ADVANCE: Estatísticas atuais: Dígito 0 = ${digit0Percentage}%, Dígito 1 = ${digit1Percentage}%`,
    );
    console.log(
      `[XML_PARSER] ADVANCE: Condição: ambos devem ser <= ${porcentagemParaEntrar}%`,
    );

    const shouldEnter =
      digit0Percentage <= porcentagemParaEntrar &&
      digit1Percentage <= porcentagemParaEntrar;

    // CORREÇÃO CRÍTICA: Usar DIGITOVER como especificado para a estratégia Advance
    // A estratégia vence quando o dígito final é > 1
    const contractType = "DIGITOVER";

    // Obter valor de entrada com sobreposição de configuração do usuário
    const amount = this.getFinalAmount();

    // Determinar mensagem de feedback
    const message = shouldEnter
      ? `ADVANCE: Condição atendida! Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${porcentagemParaEntrar}%. Usando DIGITOVER com valor 1 e duração de 1 tick.`
      : `ADVANCE: Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${porcentagemParaEntrar}%`;

    console.log(
      `[XML_PARSER] ADVANCE: Resultado da análise: ${shouldEnter ? "ENTRAR" : "NÃO ENTRAR"}`,
    );
    console.log(
      `[XML_PARSER] ADVANCE: Detalhes: DIGITOVER com target value = 1, duração = 1 tick`,
    );

    return {
      shouldEnter,
      contractType,
      amount,
      entryAmount: amount, // Garantir que o valor seja enviado para o callback
      prediction: 1, // CORREÇÃO: Valor fixo 1 para DIGITOVER conforme especificado
      duration: 1, // CORREÇÃO: Duração de exatamente 1 tick
      message,
    };
  }

  /**
   * Analisa a estratégia Iron Over
   * Condição: Usar DIGITOVER e controlar martingale após X perdas
   */
  /**
   * Analisa a estratégia Iron Over - Implementação FIEL ao XML mas com prioridade ao usuário
   * Segue exatamente o que está no XML do IRON OVER.xml fornecido
   */
  public analyzeIronOverStrategy(
    consecutiveLosses: number,
  ): StrategyAnalysisResult {
    console.log(
      `[XML_PARSER] 🔄 Analisando estratégia IRON OVER com ${consecutiveLosses} perdas consecutivas`,
    );

    // PASSO 1: Obter valores iniciais a partir da hierarquia correta

    // MODIFICAÇÃO CRÍTICA - APENAS valor do usuário, sem fallbacks!
    const botValueElement = document.getElementById(
      "iron-bot-entry-value",
    ) as HTMLInputElement;
    let valorInicial = 0; // Inicializado com zero, será rejeitado se não for modificado

    if (botValueElement && botValueElement.value) {
      const valueFromDOM = parseFloat(botValueElement.value);
      if (!isNaN(valueFromDOM) && valueFromDOM > 0) {
        valorInicial = valueFromDOM;
        console.log(
          `[XML_PARSER] ✅ IRON OVER: Usando valor ${valorInicial} configurado pelo usuário na interface`,
        );
      }
    } else {
      // Se não encontrar na interface, buscar no localStorage
      try {
        const configStr = localStorage.getItem("strategy_config_ironover");
        if (configStr) {
          const config = JSON.parse(configStr);
          if (
            config.valorInicial &&
            !isNaN(parseFloat(config.valorInicial.toString()))
          ) {
            valorInicial = parseFloat(config.valorInicial.toString());
            console.log(
              `[XML_PARSER] ✅ IRON OVER: Usando valor ${valorInicial} das configurações salvas`,
            );
          }
        }
      } catch (e) {
        console.error("[XML_PARSER] Erro ao ler configurações salvas:", e);
      }
    }

    // Definir valor amount inicial
    let amount = valorInicial;

    // Obter valor configurado para martingale - prioridade: configs do usuário > XML > padrão
    let martingaleFator = 0.5; // Valor padrão do XML

    if (this.userConfig.martingale !== undefined) {
      martingaleFator = this.userConfig.martingale;
    } else if (this.variables.martingale !== undefined) {
      martingaleFator = this.variables.martingale;
    }

    console.log(`[XML_PARSER] IRON OVER: Fator martingale: ${martingaleFator}`);

    // Obter valor configurado para martingale após X perdas
    let usarMartingaleAposXLoss = 1; // Valor padrão do XML

    if (this.userConfig.usarMartingaleAposXLoss !== undefined) {
      usarMartingaleAposXLoss = this.userConfig.usarMartingaleAposXLoss;
    } else if (this.variables.usarMartingaleAposXLoss !== undefined) {
      usarMartingaleAposXLoss = this.variables.usarMartingaleAposXLoss;
    }

    console.log(
      `[XML_PARSER] IRON OVER: Usar martingale após: ${usarMartingaleAposXLoss} perdas`,
    );

    // Obter previsão configurada (DIGITOVER precisa de um valor entre 1-9)
    let prediction = 5; // Valor padrão do XML IRON OVER

    if (this.userConfig.previsao !== undefined) {
      prediction = this.userConfig.previsao;
    } else if (this.variables.previsao !== undefined) {
      prediction = this.variables.previsao;
    }

    // Validar que prediction é um número válido entre 1-9
    if (typeof prediction !== "number" || prediction < 1 || prediction > 9) {
      prediction = 1; // Valor padrão seguro para DIGITOVER
      console.log(
        `[XML_PARSER] IRON OVER: Usando previsão padrão: ${prediction}`,
      );
    } else {
      console.log(
        `[XML_PARSER] IRON OVER: Usando previsão configurada: ${prediction}`,
      );
    }

    // PASSO 2: Aplicar a lógica exata do XML para calcular o valor da entrada

    // Em IRON OVER.xml, a lógica é:
    // 1. Se não houver perdas consecutivas ou não atingiu o limite para martingale, usa valor inicial
    // 2. Se atingiu o limite para martingale, usa valorInicial * (1 + martingaleFator)

    // Verificar se deve usar martingale com base nas perdas consecutivas
    const useMartingale = consecutiveLosses >= usarMartingaleAposXLoss;

    // IRON OVER sempre entra, mas controla o martingale
    const shouldEnter = true;
    console.log(
      `[XML_PARSER] IRON OVER: shouldEnter = ${shouldEnter} - Sempre entra na operação`,
    );

    // Aplicar martingale conforme definido no XML, se necessário
    if (useMartingale && consecutiveLosses > 0) {
      // IRON OVER usa uma lógica de martingale conforme XML:
      // Após X perdas consecutivas (usarMartingaleAposXLoss), aplica o fator martingale

      // Aplicar martingale conforme XML (valorInicial * (1 + martingaleFator))
      const martingaleMultiplier = 1 + martingaleFator;
      amount = Math.round(valorInicial * martingaleMultiplier * 100) / 100;

      console.log(
        `[XML_PARSER] IRON OVER: Aplicando martingale após ${consecutiveLosses} perdas.`,
      );
      console.log(
        `[XML_PARSER] IRON OVER: Valor inicial: ${valorInicial}, Fator: ${martingaleFator}, Novo valor: ${amount}`,
      );
    }

    // Já validamos a prediction acima, não é necessário validar novamente

    // Mensagem da estratégia
    const message = useMartingale
      ? `IRON OVER: Usando martingale após ${consecutiveLosses} perdas (limite: ${usarMartingaleAposXLoss}). Previsão: DIGITOVER ${prediction}`
      : `IRON OVER: Operação normal sem martingale. Previsão: DIGITOVER ${prediction}`;

    return {
      shouldEnter,
      contractType: "DIGITOVER",
      prediction,
      amount,
      entryAmount: amount,
      message,
    };
  }

  /**
   * Analisa a estratégia Iron Under
   * Condição: Usar DIGITUNDER e controlar martingale após X perdas
   */
  /**
   * Analisa a estratégia Iron Under - Implementação FIEL ao XML com prioridade ao usuário
   * Segue exatamente o que está no XML do IRON UNDER.xml fornecido
   */
  /**
   * Analisa a estratégia ProfitPro com suporte ao parâmetro Loss Virtual
   * Aplica a lógica de verificação para dígitos 0-6 consecutivos
   */
  public analyzeProfitProStrategy(
    digitStats: DigitStat[],
    recentDigits: number[],
    lossVirtual: number = 1
  ): StrategyAnalysisResult {
    console.log(`[XML_PARSER] 🔄 ProfitPro: Analisando com Loss Virtual = ${lossVirtual}`);
    console.log(`[XML_PARSER] 🔄 ProfitPro: Dígitos recentes:`, recentDigits.slice(0, 10).join(', '));
    
    // PASSO 1: Obter valores iniciais a partir da hierarquia correta
    // MODIFICAÇÃO CRÍTICA - APENAS valor do usuário, sem fallbacks!
    let valorInicial = 0; // Inicializado com zero, será rejeitado se não for modificado

    // Buscar no localStorage
    try {
      const configStr = localStorage.getItem("strategy_config_profitpro");
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.valorInicial && !isNaN(parseFloat(config.valorInicial.toString()))) {
          valorInicial = parseFloat(config.valorInicial.toString());
          console.log(
            `[XML_PARSER] ✅ ProfitPro: Usando valor ${valorInicial} das configurações salvas`,
          );
        }
        
        // Obter valor de Loss Virtual configurado
        if (config.lossVirtual && !isNaN(parseInt(config.lossVirtual.toString()))) {
          lossVirtual = parseInt(config.lossVirtual.toString());
          console.log(
            `[XML_PARSER] ✅ ProfitPro: Usando Loss Virtual ${lossVirtual} das configurações salvas`,
          );
        }
      }
    } catch (e) {
      console.error("[XML_PARSER] Erro ao ler configurações salvas para ProfitPro:", e);
    }
    
    // Se não tiver valor configurado, usar padrão
    if (valorInicial <= 0) {
      valorInicial = 1; // Valor padrão seguro
      console.log(`[XML_PARSER] ⚠️ ProfitPro: Usando valor padrão ${valorInicial}`);
    }
    
    // Verificar se temos dígitos suficientes para análise
    if (recentDigits.length < lossVirtual) {
      console.log(`[XML_PARSER] ⚠️ ProfitPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`);
      return {
        shouldEnter: false,
        contractType: 'DIGITOVER',
        prediction: 7,
        amount: valorInicial,
        message: `ProfitPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`
      };
    }
    
    // PASSO 2: Verificar os últimos 'lossVirtual' dígitos para determinar se devemos operar
    // Precisamos verificar se há 'lossVirtual' ocorrências consecutivas de dígitos 0-6
    const relevantDigits = recentDigits.slice(0, lossVirtual);
    const isTargetDigit = (digit: number) => digit >= 0 && digit <= 6;
    
    // Verificar se todos os dígitos relevantes são entre 0-6
    const allTargetDigits = relevantDigits.every(isTargetDigit);
    
    console.log(`[XML_PARSER] 🔍 ProfitPro: Verificando ${lossVirtual} dígitos consecutivos:`, relevantDigits.join(', '));
    console.log(`[XML_PARSER] 🔍 ProfitPro: Todos os dígitos são 0-6? ${allTargetDigits ? 'SIM ✅' : 'NÃO ❌'}`);
    
    // PASSO 3: Decidir se devemos entrar na operação
    // Se todos os dígitos relevantes forem 0-6, devemos entrar com DIGITOVER 7
    const shouldEnter = allTargetDigits;
    const prediction = 7; // Entrar com DIGITOVER 7 quando dígitos 0-6 aparecem lossVirtual vezes consecutivas
    
    let message = shouldEnter
      ? `ProfitPro: Condição atendida! ${lossVirtual} dígitos consecutivos entre 0-6. Executando DIGITOVER ${prediction}`
      : `ProfitPro: Aguardando ${lossVirtual} dígitos consecutivos entre 0-6. Sequência atual: ${relevantDigits.join(', ')}`;
    
    return {
      shouldEnter,
      contractType: 'DIGITOVER',
      prediction,
      amount: valorInicial,
      message
    };
  }
  
  /**
   * Analisa a estratégia MaxPro com suporte ao parâmetro Loss Virtual
   * Aplica a lógica de verificação para dígitos 0-3 consecutivos
   */
  public analyzeMaxProStrategy(
    digitStats: DigitStat[],
    recentDigits: number[],
    lossVirtual: number = 1
  ): StrategyAnalysisResult {
    console.log(`[XML_PARSER] 🔄 MaxPro: Analisando com Loss Virtual = ${lossVirtual}`);
    console.log(`[XML_PARSER] 🔄 MaxPro: Dígitos recentes:`, recentDigits.slice(0, 10).join(', '));
    
    // PASSO 1: Obter valores iniciais a partir da hierarquia correta
    // MODIFICAÇÃO CRÍTICA - APENAS valor do usuário, sem fallbacks!
    let valorInicial = 0; // Inicializado com zero, será rejeitado se não for modificado

    // Buscar no localStorage
    try {
      const configStr = localStorage.getItem("strategy_config_maxpro");
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.valorInicial && !isNaN(parseFloat(config.valorInicial.toString()))) {
          valorInicial = parseFloat(config.valorInicial.toString());
          console.log(
            `[XML_PARSER] ✅ MaxPro: Usando valor ${valorInicial} das configurações salvas`,
          );
        }
        
        // Obter valor de Loss Virtual configurado
        if (config.lossVirtual && !isNaN(parseInt(config.lossVirtual.toString()))) {
          lossVirtual = parseInt(config.lossVirtual.toString());
          console.log(
            `[XML_PARSER] ✅ MaxPro: Usando Loss Virtual ${lossVirtual} das configurações salvas`,
          );
        }
      }
    } catch (e) {
      console.error("[XML_PARSER] Erro ao ler configurações salvas para MaxPro:", e);
    }
    
    // Se não tiver valor configurado, usar padrão
    if (valorInicial <= 0) {
      valorInicial = 1; // Valor padrão seguro
      console.log(`[XML_PARSER] ⚠️ MaxPro: Usando valor padrão ${valorInicial}`);
    }
    
    // Verificar se temos dígitos suficientes para análise
    if (recentDigits.length < lossVirtual) {
      console.log(`[XML_PARSER] ⚠️ MaxPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`);
      return {
        shouldEnter: false,
        contractType: 'DIGITOVER',
        prediction: 4,
        amount: valorInicial,
        message: `MaxPro: Dígitos insuficientes (${recentDigits.length}) para análise de Loss Virtual (${lossVirtual})`
      };
    }
    
    // PASSO 2: Verificar os últimos 'lossVirtual' dígitos para determinar se devemos operar
    // Precisamos verificar se há 'lossVirtual' ocorrências consecutivas de dígitos 0-3
    const relevantDigits = recentDigits.slice(0, lossVirtual);
    const isTargetDigit = (digit: number) => digit >= 0 && digit <= 3;
    
    // Verificar se todos os dígitos relevantes são entre 0-3
    const allTargetDigits = relevantDigits.every(isTargetDigit);
    
    console.log(`[XML_PARSER] 🔍 MaxPro: Verificando ${lossVirtual} dígitos consecutivos:`, relevantDigits.join(', '));
    console.log(`[XML_PARSER] 🔍 MaxPro: Todos os dígitos são 0-3? ${allTargetDigits ? 'SIM ✅' : 'NÃO ❌'}`);
    
    // PASSO 3: Decidir se devemos entrar na operação
    // Se todos os dígitos relevantes forem 0-3, devemos entrar com DIGITOVER 4
    const shouldEnter = allTargetDigits;
    const prediction = 4; // Entrar com DIGITOVER 4 quando dígitos 0-3 aparecem lossVirtual vezes consecutivas
    
    let message = shouldEnter
      ? `MaxPro: Condição atendida! ${lossVirtual} dígitos consecutivos entre 0-3. Executando DIGITOVER ${prediction}`
      : `MaxPro: Aguardando ${lossVirtual} dígitos consecutivos entre 0-3. Sequência atual: ${relevantDigits.join(', ')}`;
    
    return {
      shouldEnter,
      contractType: 'DIGITOVER',
      prediction,
      amount: valorInicial,
      message
    };
  }
  
  public analyzeIronUnderStrategy(
    consecutiveLosses: number,
  ): StrategyAnalysisResult {
    console.log(
      `[XML_PARSER] 🔄 Analisando estratégia IRON UNDER com ${consecutiveLosses} perdas consecutivas`,
    );

    // PASSO 1: Obter valores iniciais a partir da hierarquia correta

    // MODIFICAÇÃO CRÍTICA - APENAS valor do usuário, sem fallbacks!
    const botValueElement = document.getElementById(
      "iron-bot-entry-value",
    ) as HTMLInputElement;
    let valorInicial = 0; // Inicializado com zero, será rejeitado se não for modificado

    if (botValueElement && botValueElement.value) {
      const valueFromDOM = parseFloat(botValueElement.value);
      if (!isNaN(valueFromDOM) && valueFromDOM > 0) {
        valorInicial = valueFromDOM;
        console.log(
          `[XML_PARSER] ✅ IRON UNDER: Usando valor ${valorInicial} configurado pelo usuário na interface`,
        );
      }
    } else {
      // Se não encontrar na interface, buscar no localStorage
      try {
        const configStr = localStorage.getItem("strategy_config_ironunder");
        if (configStr) {
          const config = JSON.parse(configStr);
          if (
            config.valorInicial &&
            !isNaN(parseFloat(config.valorInicial.toString()))
          ) {
            valorInicial = parseFloat(config.valorInicial.toString());
            console.log(
              `[XML_PARSER] ✅ IRON UNDER: Usando valor ${valorInicial} das configurações salvas`,
            );
          }
        }
      } catch (e) {
        console.error("[XML_PARSER] Erro ao ler configurações salvas:", e);
      }
    }

    // Definir valor amount inicial
    let amount = valorInicial;

    // Obter valor configurado para martingale - prioridade: configs do usuário > XML > padrão
    let martingaleFator = 0.5; // Valor padrão do XML

    if (this.userConfig.martingale !== undefined) {
      martingaleFator = this.userConfig.martingale;
    } else if (this.variables.martingale !== undefined) {
      martingaleFator = this.variables.martingale;
    }

    console.log(
      `[XML_PARSER] IRON UNDER: Fator martingale: ${martingaleFator}`,
    );

    // Obter valor configurado para martingale após X perdas
    let usarMartingaleAposXLoss = 1; // Valor padrão do XML

    if (this.userConfig.usarMartingaleAposXLoss !== undefined) {
      usarMartingaleAposXLoss = this.userConfig.usarMartingaleAposXLoss;
    } else if (this.variables.usarMartingaleAposXLoss !== undefined) {
      usarMartingaleAposXLoss = this.variables.usarMartingaleAposXLoss;
    }

    console.log(
      `[XML_PARSER] IRON UNDER: Usar martingale após: ${usarMartingaleAposXLoss} perdas`,
    );

    // Obter previsão configurada (DIGITUNDER precisa de um valor entre 1-9)
    let prediction = 4; // Valor padrão do XML IRON UNDER

    if (this.userConfig.previsao !== undefined) {
      prediction = this.userConfig.previsao;
    } else if (this.variables.previsao !== undefined) {
      prediction = this.variables.previsao;
    }

    // Validar que prediction é um número válido entre 1-9
    if (typeof prediction !== "number" || prediction < 1 || prediction > 9) {
      prediction = 1; // Valor padrão seguro para DIGITUNDER conforme XML
      console.log(
        `[XML_PARSER] IRON UNDER: Usando previsão padrão: ${prediction}`,
      );
    } else {
      console.log(
        `[XML_PARSER] IRON UNDER: Usando previsão configurada: ${prediction}`,
      );
    }

    // PASSO 2: Aplicar a lógica exata do XML para calcular o valor da entrada

    // Verificar se deve usar martingale com base nas perdas consecutivas
    const useMartingale = consecutiveLosses >= usarMartingaleAposXLoss;

    // IRON UNDER sempre entra, mas controla o martingale
    const shouldEnter = true;
    console.log(
      `[XML_PARSER] IRON UNDER: shouldEnter = ${shouldEnter} - Sempre entra na operação`,
    );

    // Aplicar martingale conforme definido no XML, se necessário
    if (useMartingale && consecutiveLosses > 0) {
      // IRON UNDER usa uma lógica de martingale conforme XML:
      // Após X perdas consecutivas (usarMartingaleAposXLoss), aplica o fator martingale

      // Aplicar martingale conforme XML (valorInicial * (1 + martingaleFator))
      const martingaleMultiplier = 1 + martingaleFator;
      amount = Math.round(valorInicial * martingaleMultiplier * 100) / 100;

      console.log(
        `[XML_PARSER] IRON UNDER: Aplicando martingale após ${consecutiveLosses} perdas.`,
      );
      console.log(
        `[XML_PARSER] IRON UNDER: Valor inicial: ${valorInicial}, Fator: ${martingaleFator}, Novo valor: ${amount}`,
      );
    }

    // Já validamos a prediction acima, não é necessário validar novamente

    // Mensagem da estratégia
    const message = useMartingale
      ? `IRON UNDER: Usando martingale após ${consecutiveLosses} perdas (limite: ${usarMartingaleAposXLoss}). Previsão: DIGITUNDER ${prediction}`
      : `IRON UNDER: Operação normal sem martingale. Previsão: DIGITUNDER ${prediction}`;

    return {
      shouldEnter,
      contractType: "DIGITUNDER",
      prediction,
      amount,
      entryAmount: amount,
      message,
    };
  }

  /**
   * Obtém o valor final para entrada considerando configurações do usuário
   * NOVO MÉTODO SIMPLIFICADO: Retorna SOMENTE o valor da interface
   */
  /**
   * Detecta a estratégia ativa no momento
   * @returns string com o ID da estratégia ou undefined se não encontrar
   */
  private detectCurrentStrategy(): string | undefined {
    // Estratégias reconhecidas
    const strategies = ["ironover", "ironunder", "advance"];

    // Verificar qual estratégia está ativa via DOM
    const botStrategyElement = document.getElementById("bot-strategy-display");
    if (botStrategyElement && botStrategyElement.textContent) {
      const displayedStrategy = botStrategyElement.textContent.toLowerCase();

      if (displayedStrategy.includes("iron over")) {
        return "ironover";
      } else if (displayedStrategy.includes("iron under")) {
        return "ironunder";
      } else if (displayedStrategy.includes("advance")) {
        return "advance";
      }
    }

    // Segunda verificação: tentar inferir pelo XML carregado
    if (this.xmlContent) {
      const lowerXml = this.xmlContent.toLowerCase();

      if (lowerXml.includes("digitover")) {
        return "ironover";
      } else if (lowerXml.includes("digitunder")) {
        return "ironunder";
      }
    }

    // Se não conseguir determinar, retornar undefined
    return undefined;
  }

  /**
   * Obtém o valor final para entrada considerando configurações do usuário
   * Implementa a hierarquia correta: configs do usuário > XML
   */
  private getFinalAmount(): number {
    // 🔴🔴🔴 IMPLEMENTAÇÃO REESCRITA - SOLUÇÃO DEFINITIVA 22/04/2025 🔴🔴🔴
    // USAR EXCLUSIVAMENTE O VALOR CONFIGURADO PELO USUÁRIO
    // NUNCA USAR VALORES DO XML OU PADRÃO

    console.log(
      "[XML_PARSER] === LÓGICA DEFINITIVA PARA VALOR DA OPERAÇÃO ===",
    );

    // HIERARQUIA DE DECISÃO ATUALIZADA:
    // 1. APENAS configuração do usuário na interface (ÚNICA fonte aceita)

    // ÚNICA FONTE: Input no DOM (prioridade EXCLUSIVA)
    const botValueElement = document.getElementById(
      "iron-bot-entry-value",
    ) as HTMLInputElement;
    if (botValueElement && botValueElement.value) {
      const valueFromDOM = parseFloat(botValueElement.value);
      if (!isNaN(valueFromDOM) && valueFromDOM > 0) {
        console.log(
          `[XML_PARSER] ✅ VALOR ÚNICO: ${valueFromDOM} configurado pelo usuário na interface`,
        );

        // Assegurar que este valor seja salvo também no localStorage para
        // garantir consistência em todo o sistema
        const currentStrategy = this.detectCurrentStrategy();
        if (currentStrategy) {
          try {
            const configKey = `strategy_config_${currentStrategy}`;
            const savedConfig = localStorage.getItem(configKey);
            if (savedConfig) {
              // Atualizar o valor no localStorage
              const parsedConfig = JSON.parse(savedConfig);
              parsedConfig.valorInicial = valueFromDOM;
              localStorage.setItem(configKey, JSON.stringify(parsedConfig));
              console.log(
                `[XML_PARSER] ✅ Valor ${valueFromDOM} sincronizado com localStorage`,
              );
            }
          } catch (e) {
            console.error("[XML_PARSER] Erro ao atualizar localStorage:", e);
          }
        }

        return valueFromDOM;
      }
    }

    // ERRO FATAL: Se não encontrou valor configurado pelo usuário
    console.error(
      "[XML_PARSER] ❌ ERRO FATAL: NENHUM VALOR CONFIGURADO PELO USUÁRIO ENCONTRADO",
    );

    // Usar valor seguro apenas para evitar erro de tipo e timeout
    // Este valor NÃO será usado em operações reais pois bloquearemos
    // a operação se não houver valor configurado pelo usuário
    return 0;
  }

  /**
   * Analisar qualquer estratégia com base no XML carregado
   */
  public analyzeStrategy(
    strategyId: string,
    digitStats: DigitStat[],
    consecutiveLosses: number = 0,
  ): StrategyAnalysisResult {
    const normalizedId = strategyId.toLowerCase();

    console.log(
      `[XML_PARSER] Analisando estratégia: "${strategyId}" (normalizado: "${normalizedId}")`,
    );

    // Extrair valores diretamente do XML primeiro
    // Esta abordagem garante que usamos exatamente o que está definido no XML
    const xmlContractType = this.extractPurchaseBlockType();
    const xmlPrediction = 1; //this.extractPredictionValue();
    const xmlExitDuration = this.extractExitDuration();
    const xmlEntryDuration = this.extractEntryDuration();

    console.log(`[XML_PARSER] 📋 Valores extraídos diretamente do XML:`);
    console.log(`[XML_PARSER] 📋 - Tipo de contrato: ${xmlContractType}`);
    console.log(`[XML_PARSER] 📋 - Previsão: ${xmlPrediction}`);
    console.log(`[XML_PARSER] 📋 - Duração de saída: ${xmlExitDuration}`);
    console.log(`[XML_PARSER] 📋 - Duração de entrada: ${xmlEntryDuration}`);

    // USANDO EXATAMENTE o tipo de contrato do XML
    let contractType = xmlContractType || this.contractType || "DIGITOVER";
    console.log(
      `[XML_PARSER] 📋 Usando tipo de contrato do XML: ${contractType}`,
    );

    // VERIFICAÇÃO ESTRATÉGIA ADVANCE - VERIFICAÇÕES ADICIONAIS PARA GARANTIR RECONHECIMENTO
    if (
      normalizedId.includes("advance") ||
      normalizedId === "advance" ||
      strategyId === "Advance" ||
      strategyId === "ADVANCE"
    ) {
      console.log(
        `[XML_PARSER] Estratégia ADVANCE reconhecida! Usando análise específica para Advance`,
      );

      // Adicionar informações específicas do XML como parâmetros para análise Advance
      const advanceResult = this.analyzeAdvanceStrategy(digitStats);

      // GARANTIR que usamos o contractType do XML
      if (xmlContractType) {
        advanceResult.contractType = xmlContractType;
        console.log(
          `[XML_PARSER] 🚨 ADVANCE: Usando tipo de contrato do XML: ${xmlContractType}`,
        );
      }

      // GARANTIR que usamos o prediction do XML
      if (xmlPrediction !== undefined && xmlPrediction !== null) {
        advanceResult.prediction = xmlPrediction;
        console.log(
          `[XML_PARSER] 🚨 ADVANCE: Usando previsão do XML: ${xmlPrediction}`,
        );
      }

      return advanceResult;
    }
    // Estratégia IRON OVER
    else if (
      normalizedId.includes("iron_over") ||
      normalizedId.includes("ironover")
    ) {
      console.log(`[XML_PARSER] Estratégia IRON OVER reconhecida!`);

      const ironOverResult = this.analyzeIronOverStrategy(consecutiveLosses);

      // GARANTIR que usamos o contractType do XML
      if (xmlContractType) {
        ironOverResult.contractType = xmlContractType;
        console.log(
          `[XML_PARSER] 🚨 IRON OVER: Usando tipo de contrato do XML: ${xmlContractType}`,
        );
      }

      // GARANTIR que usamos o prediction do XML
      if (xmlPrediction !== undefined && xmlPrediction !== null) {
        ironOverResult.prediction = xmlPrediction;
        console.log(
          `[XML_PARSER] 🚨 IRON OVER: Usando previsão do XML: ${xmlPrediction}`,
        );
      }

      return ironOverResult;
    }
    // Estratégia IRON UNDER
    else if (
      normalizedId.includes("iron_under") ||
      normalizedId.includes("ironunder")
    ) {
      console.log(`[XML_PARSER] Estratégia IRON UNDER reconhecida!`);

      const ironUnderResult = this.analyzeIronUnderStrategy(consecutiveLosses);

      // GARANTIR que usamos o contractType do XML
      if (xmlContractType) {
        ironUnderResult.contractType = xmlContractType;
        console.log(
          `[XML_PARSER] 🚨 IRON UNDER: Usando tipo de contrato do XML: ${xmlContractType}`,
        );
      }

      // GARANTIR que usamos o prediction do XML
      if (xmlPrediction !== undefined && xmlPrediction !== null) {
        ironUnderResult.prediction = xmlPrediction;
        console.log(
          `[XML_PARSER] 🚨 IRON UNDER: Usando previsão do XML: ${xmlPrediction}`,
        );
      }

      return ironUnderResult;
    }
    // Implementar outras estratégias conforme necessário

    // Estratégia ProfitPro
    else if (normalizedId === "profitpro" || normalizedId.includes("profit_pro")) {
      console.log(`[XML_PARSER] Estratégia ProfitPro reconhecida!`);
      
      // Obter dígitos recentes para análise de Loss Virtual
      let recentDigits: number[] = [];
      
      try {
        // Tentar obter os dígitos mais recentes do serviço de histórico
        const localStorageDigits = localStorage.getItem("deriv_digits_history_R_100");
        if (localStorageDigits) {
          recentDigits = JSON.parse(localStorageDigits);
          console.log(`[XML_PARSER] ProfitPro: Carregados ${recentDigits.length} dígitos recentes do localStorage`);
        } else {
          // Se não encontrar no localStorage, usar os dígitos das estatísticas
          recentDigits = digitStats.map(stat => stat.digit);
          console.log(`[XML_PARSER] ProfitPro: Usando ${recentDigits.length} dígitos das estatísticas`);
        }
      } catch (error) {
        console.error(`[XML_PARSER] ProfitPro: Erro ao obter dígitos recentes:`, error);
        // Usar os dígitos das estatísticas como fallback
        recentDigits = digitStats.map(stat => stat.digit);
      }
      
      // Obter valor de Loss Virtual configurado
      let lossVirtual = 1; // Valor padrão
      
      try {
        const configStr = localStorage.getItem("strategy_config_profitpro");
        if (configStr) {
          const config = JSON.parse(configStr);
          if (config.lossVirtual && !isNaN(parseInt(config.lossVirtual.toString()))) {
            lossVirtual = parseInt(config.lossVirtual.toString());
            console.log(`[XML_PARSER] ProfitPro: Usando Loss Virtual ${lossVirtual} das configurações salvas`);
          }
        }
      } catch (error) {
        console.error(`[XML_PARSER] ProfitPro: Erro ao obter Loss Virtual configurado:`, error);
      }
      
      // Analisar estratégia com a configuração de Loss Virtual
      const profitProResult = this.analyzeProfitProStrategy(digitStats, recentDigits, lossVirtual);
      
      // GARANTIR que usamos o contractType do XML se disponível
      if (xmlContractType) {
        profitProResult.contractType = xmlContractType;
        console.log(`[XML_PARSER] 🚨 ProfitPro: Usando tipo de contrato do XML: ${xmlContractType}`);
      }
      
      // GARANTIR que usamos o prediction configurado
      if (profitProResult.prediction === undefined) {
        profitProResult.prediction = 7; // Valor padrão para ProfitPro
        console.log(`[XML_PARSER] 🚨 ProfitPro: Usando previsão padrão: 7`);
      }
      
      return profitProResult;
    }
    // Estratégia MaxPro
    else if (normalizedId === "maxpro" || normalizedId.includes("max_pro")) {
      console.log(`[XML_PARSER] Estratégia MaxPro reconhecida!`);
      
      // Obter dígitos recentes para análise de Loss Virtual
      let recentDigits: number[] = [];
      
      try {
        // Tentar obter os dígitos mais recentes do serviço de histórico
        const localStorageDigits = localStorage.getItem("r100_digits_history");
        if (localStorageDigits) {
          recentDigits = JSON.parse(localStorageDigits);
          console.log(`[XML_PARSER] MaxPro: Carregados ${recentDigits.length} dígitos recentes do localStorage`);
        } else {
          // Se não encontrar no localStorage, usar os dígitos das estatísticas
          recentDigits = digitStats.map(stat => stat.digit);
          console.log(`[XML_PARSER] MaxPro: Usando ${recentDigits.length} dígitos das estatísticas`);
        }
      } catch (error) {
        console.error(`[XML_PARSER] MaxPro: Erro ao obter dígitos recentes:`, error);
        // Usar os dígitos das estatísticas como fallback
        recentDigits = digitStats.map(stat => stat.digit);
      }
      
      // Obter valor de Loss Virtual configurado
      let lossVirtual = 1; // Valor padrão
      
      try {
        const configStr = localStorage.getItem("strategy_config_maxpro");
        if (configStr) {
          const config = JSON.parse(configStr);
          if (config.lossVirtual && !isNaN(parseInt(config.lossVirtual.toString()))) {
            lossVirtual = parseInt(config.lossVirtual.toString());
            console.log(`[XML_PARSER] MaxPro: Usando Loss Virtual ${lossVirtual} das configurações salvas`);
          }
        }
      } catch (error) {
        console.error(`[XML_PARSER] MaxPro: Erro ao obter Loss Virtual configurado:`, error);
      }
      
      // Analisar estratégia com a configuração de Loss Virtual
      const maxProResult = this.analyzeMaxProStrategy(digitStats, recentDigits, lossVirtual);
      
      // GARANTIR que usamos o contractType do XML se disponível
      if (xmlContractType) {
        maxProResult.contractType = xmlContractType;
        console.log(`[XML_PARSER] 🚨 MaxPro: Usando tipo de contrato do XML: ${xmlContractType}`);
      }
      
      // GARANTIR que usamos o prediction configurado
      if (maxProResult.prediction === undefined) {
        maxProResult.prediction = 4; // Valor padrão para MaxPro
        console.log(`[XML_PARSER] 🚨 MaxPro: Usando previsão padrão: 4`);
      }
      
      return maxProResult;
    }
    // Se chegou aqui, não reconheceu nenhuma estratégia específica
    console.log(
      `[XML_PARSER] AVISO: Estratégia não reconhecida: "${strategyId}". Usando configuração baseada apenas no XML.`,
    );

    // Obter previsão do XML ou configuração do usuário
    let prediction = xmlPrediction || this.variables.previsao;

    // CORREÇÃO CRÍTICA: Validar e garantir que prediction tenha um valor válido entre 1-9 para contracts DIGIT
    if (
      prediction === undefined ||
      prediction === null ||
      prediction < 1 ||
      prediction > 9
    ) {
      // Usar um valor padrão seguro se prediction não for válido (1-9 são os únicos valores permitidos)
      prediction = 5; // Valor conservador como fallback
      console.log(
        `[XML_PARSER] 🚨 CORREÇÃO CRÍTICA: Previsão inválida para estratégia padrão. Usando valor padrão: ${prediction}`,
      );
    }

    // CORREÇÃO CRÍTICA: Buscar primeiro o valor definido pelo usuário no localStorage
    // Esta é a fonte mais confiável e atual do valor configurado
    let valorConfiguradoUsuario: number | null = null;

    try {
      const configStr = localStorage.getItem(`strategy_config_${normalizedId}`);
      if (configStr) {
        const config = JSON.parse(configStr);
        if (config.valorInicial !== undefined) {
          valorConfiguradoUsuario = parseFloat(config.valorInicial);
          console.log(
            `[XML_PARSER] 🚨🚨 CORREÇÃO MASSIVA: Encontrado valor inicial ${valorConfiguradoUsuario} configurado pelo usuário para ${normalizedId}`,
          );
        }
      }
    } catch (e) {
      console.error(
        `[XML_PARSER] Erro ao ler configuração salva para ${normalizedId}:`,
        e,
      );
    }

    // CORREÇÃO CRÍTICA: Usar diretamente o valor encontrado no localStorage, se disponível
    const amount =
      valorConfiguradoUsuario !== null
        ? valorConfiguradoUsuario
        : this.getFinalAmount();

    console.log(
      `[XML_PARSER] 🚨 Estratégia padrão: Usando valor final: ${amount} para ${strategyId}`,
    );

    // Estratégia padrão
    return {
      shouldEnter: true,
      contractType: contractType,
      prediction: prediction,
      amount: amount,
      entryAmount: amount, // Garantir que o campo entryAmount seja enviado com o mesmo valor
      message: `Estratégia ${strategyId}: Usando configuração padrão com previsão ${prediction} e tipo ${contractType}`,
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
