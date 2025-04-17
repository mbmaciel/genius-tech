import { XMLParser } from 'fast-xml-parser';

// Interface para representar uma estratégia XML parseada
export interface XMLStrategy {
  id: string;
  name: string;
  description: string;
  xmlContent: string;
  tradeType: 'DIGITOVER' | 'DIGITUNDER' | 'both';
  config: {
    valorInicial: number;
    valorAposVencer: number;
    previsao: number;
    martingale: number;
    metaGanho: number;
    limitePerda: number;
    lossVirtual: number;
  };
}

/**
 * Extrai o tipo de trade (DIGITOVER, DIGITUNDER) do XML
 */
const extractTradeType = (xmlObj: any): 'DIGITOVER' | 'DIGITUNDER' | 'both' => {
  try {
    // Verifica o campo TYPE_LIST dentro do bloco 'trade'
    if (xmlObj?.xml?.block?.field) {
      const fields = Array.isArray(xmlObj.xml.block.field) 
        ? xmlObj.xml.block.field 
        : [xmlObj.xml.block.field];
      
      const typeField = fields.find((field: any) => field['@_name'] === 'TYPE_LIST');
      
      if (typeField) {
        return typeField['#text'] as 'DIGITOVER' | 'DIGITUNDER' | 'both';
      }
    }
    
    // Se não encontrar, usa DIGITOVER como padrão
    return 'DIGITOVER';
  } catch (error) {
    console.error('Erro ao extrair tipo de trade:', error);
    return 'DIGITOVER';
  }
};

/**
 * Extrai valores de configuração do XML
 */
const extractConfig = (xmlObj: any): any => {
  const config: any = {
    valorInicial: 0.35,
    valorAposVencer: 0.35,
    previsao: 5,
    martingale: 0.5,
    metaGanho: 10,
    limitePerda: 5,
    lossVirtual: 1
  };
  
  try {
    // Extrai as variáveis do XML
    if (xmlObj?.xml?.variables?.variable) {
      const variables = Array.isArray(xmlObj.xml.variables.variable) 
        ? xmlObj.xml.variables.variable 
        : [xmlObj.xml.variables.variable];
      
      // Mapeia os IDs das variáveis para seus nomes
      const varMap = variables.reduce((map: any, v: any) => {
        map[v['@_id']] = v['#text'];
        return map;
      }, {});
      
      // Procura blocos de inicialização (variáveis_set) e seus valores
      if (xmlObj?.xml?.block?.statement) {
        let initBlocks = xmlObj.xml.block.statement.find((stmt: any) => 
          stmt['@_name'] === 'INITIALIZATION'
        );
        
        if (initBlocks && initBlocks.block) {
          const extractBlockValue = (block: any): any => {
            if (!block) return null;
            
            // Verifica se é um bloco de definição de variável
            if (block['@_type'] === 'variables_set' || block['@_type'] === 'math_number') {
              // Obtém o ID da variável sendo definida
              const varId = block.field?.['@_id'] || 
                           (block.field && Array.isArray(block.field) ? 
                            block.field.find((f: any) => f['@_variabletype'] !== undefined)?.['@_id'] : null);
              
              // Obtém o nome da variável
              const varName = varId ? varMap[varId] : null;
              
              // Obtém o valor definido
              let valor = null;
              if (block.value && block.value.block && block.value.block['@_type'] === 'math_number') {
                valor = Number(block.value.block.field['#text']);
              }
              
              // Mapeia o nome da variável para as configurações
              if (varName && valor !== null) {
                if (varName.includes('VALOR INICIAL')) config.valorInicial = valor;
                else if (varName.includes('VALOR APÓS VENCER')) config.valorAposVencer = valor;
                else if (varName.includes('PREVISÃO')) config.previsao = valor;
                else if (varName.includes('LOSS VIRTUAL')) config.lossVirtual = valor;
                else if (varName.includes('MARTINGALE')) config.martingale = valor;
                else if (varName.includes('META')) config.metaGanho = valor;
                else if (varName.includes('LIMITE DE PERDA')) config.limitePerda = valor;
              }
            }
            
            // Procura recursivamente nos blocos aninhados (next)
            if (block.next) {
              extractBlockValue(block.next.block);
            }
          };
          
          // Inicia a extração a partir do bloco inicial
          extractBlockValue(initBlocks.block);
        }
      }
    }
    
    return config;
  } catch (error) {
    console.error('Erro ao extrair configuração:', error);
    return config;
  }
};

/**
 * Analisa um arquivo XML de estratégia
 */
export const parseStrategyXML = (xmlContent: string, strategyId: string, name: string): XMLStrategy | null => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text'
    });
    
    // Converte o XML para objeto
    const xmlObj = parser.parse(xmlContent);
    
    // Extrai o tipo de trade
    const tradeType = extractTradeType(xmlObj);
    
    // Extrai as configurações
    const config = extractConfig(xmlObj);
    
    // Retorna o objeto de estratégia
    return {
      id: strategyId,
      name,
      description: `Estratégia ${name} para dígitos ${tradeType === 'DIGITOVER' ? 'acima' : 'abaixo'} de ${config.previsao}`,
      xmlContent,
      tradeType,
      config
    };
  } catch (error) {
    console.error('Erro ao analisar XML de estratégia:', error);
    return null;
  }
};

/**
 * Estratégias pré-definidas
 */
export const AVAILABLE_STRATEGIES: XMLStrategy[] = [
  {
    id: 'iron_over',
    name: 'IRON OVER',
    description: 'Estratégia IRON OVER para dígitos acima de 5',
    xmlContent: '', // Será carregado dinamicamente
    tradeType: 'DIGITOVER',
    config: {
      valorInicial: 0.35,
      valorAposVencer: 0.35,
      previsao: 5,
      martingale: 0.5,
      metaGanho: 10,
      limitePerda: 2,
      lossVirtual: 1
    }
  },
  {
    id: 'bot_low',
    name: 'BOT LOW',
    description: 'Estratégia BOT LOW para dígitos abaixo de 2',
    xmlContent: '', // Será carregado dinamicamente
    tradeType: 'DIGITUNDER',
    config: {
      valorInicial: 3,
      valorAposVencer: 3,
      previsao: 2,
      martingale: 0.4,
      metaGanho: 10,
      limitePerda: 20,
      lossVirtual: 1
    }
  },
  {
    id: 'green',
    name: 'GREEN',
    description: 'Estratégia GREEN com análise estatística',
    xmlContent: '', // Será carregado dinamicamente
    tradeType: 'DIGITOVER',
    config: {
      valorInicial: 0.35,
      valorAposVencer: 0.35,
      previsao: 5,
      martingale: 0.5,
      metaGanho: 10,
      limitePerda: 5,
      lossVirtual: 1
    }
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia MAXPRO para dígitos acima de 3',
    xmlContent: '', // Será carregado dinamicamente
    tradeType: 'DIGITOVER',
    config: {
      valorInicial: 3,
      valorAposVencer: 3,
      previsao: 3,
      martingale: 0.4,
      metaGanho: 10,
      limitePerda: 20,
      lossVirtual: 1
    }
  },
  {
    id: 'profitpro_at',
    name: 'PROFITPRO AT',
    description: 'Estratégia PROFITPRO AT para dígitos abaixo de 7',
    xmlContent: '', // Será carregado dinamicamente
    tradeType: 'DIGITUNDER',
    config: {
      valorInicial: 0.35,
      valorAposVencer: 0.35,
      previsao: 7,
      martingale: 0.5,
      metaGanho: 10,
      limitePerda: 5,
      lossVirtual: 1
    }
  },
  {
    id: 'iron_under',
    name: 'IRON UNDER',
    description: 'Estratégia IRON UNDER para dígitos abaixo de 4',
    xmlContent: '', // Será carregado dinamicamente
    tradeType: 'DIGITUNDER',
    config: {
      valorInicial: 0.35,
      valorAposVencer: 0.35,
      previsao: 4,
      martingale: 0.5,
      metaGanho: 10,
      limitePerda: 2,
      lossVirtual: 1
    }
  }
];