/**
 * Serviço para processamento e análise de estratégias XML do Binary Bot
 */

import { DOMParser } from 'xmldom';

interface ParsedStrategy {
  name: string;
  description?: string;
  parameters: StrategyParameters;
  contractType: string;
}

interface StrategyParameters {
  contractType?: string;  // DIGITOVER, DIGITUNDER, etc.
  prediction?: number;    // Número para predição em contratos DIGIT
  duration?: number;      // Duração do contrato
  durationUnit?: string;  // Unidade de tempo (t = ticks, s = segundos, etc)
  basis?: string;         // Basis para o contrato (stake, payout)
  currency?: string;      // Moeda do contrato
  barrier?: string;       // Barreira para contratos com barreira
  secondBarrier?: string; // Segunda barreira para contratos com 2 barreiras
}

/**
 * Analisa um arquivo XML de estratégia e extrai seus parâmetros
 * @param xmlString Conteúdo XML da estratégia
 * @returns ParsedStrategy Estratégia parseada com parâmetros
 */
export function parseStrategyXml(xmlString: string): ParsedStrategy | null {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Procurar informações básicas
    const name = getStrategyName(xmlDoc);
    const description = getStrategyDescription(xmlDoc);
    
    // Extrair parâmetros de contrato
    const contractType = getContractType(xmlDoc);
    const parameters = getStrategyParameters(xmlDoc);
    
    return {
      name,
      description,
      parameters,
      contractType
    };
  } catch (error) {
    console.error('Erro ao analisar XML da estratégia:', error);
    return null;
  }
}

/**
 * Extrai o nome da estratégia
 */
function getStrategyName(xmlDoc: Document): string {
  // Tentar extrair nome de um campo específico, ou usar nome padrão
  const nameElement = xmlDoc.getElementsByTagName('comment');
  if (nameElement && nameElement.length > 0) {
    return nameElement[0].textContent || 'Estratégia';
  }
  
  return 'Estratégia';
}

/**
 * Extrai a descrição da estratégia
 */
function getStrategyDescription(xmlDoc: Document): string | undefined {
  // Tentar extrair descrição de um elemento específico
  const descElement = xmlDoc.getElementsByTagName('description');
  if (descElement && descElement.length > 0) {
    return descElement[0].textContent || undefined;
  }
  
  return undefined;
}

/**
 * Extrai o tipo de contrato da estratégia
 */
function getContractType(xmlDoc: Document): string {
  // Procurar campo de field_contract_type ou purchase
  const contractTypeFields = xmlDoc.getElementsByTagName('field');
  
  for (let i = 0; i < contractTypeFields.length; i++) {
    const field = contractTypeFields[i];
    if (field.getAttribute('name') === 'CONTRACT_TYPE') {
      return field.textContent || 'DIGITOVER';
    }
  }
  
  // Tentar encontrar no elemento de compra
  const purchaseElements = xmlDoc.getElementsByTagName('purchase');
  if (purchaseElements && purchaseElements.length > 0) {
    for (let i = 0; i < purchaseElements.length; i++) {
      const contract = purchaseElements[i].getAttribute('contract_type');
      if (contract) {
        return contract;
      }
    }
  }
  
  // Para estratégia Advance, definir como DIGITOVER por padrão
  if (xmlDoc.getElementsByTagName('block').length > 0) {
    const blocks = xmlDoc.getElementsByTagName('block');
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].getAttribute('type') === 'trade') {
        return 'DIGITOVER';
      }
    }
  }
  
  return 'DIGITOVER'; // Padrão caso não encontre
}

/**
 * Extrai os parâmetros da estratégia
 */
function getStrategyParameters(xmlDoc: Document): StrategyParameters {
  const parameters: StrategyParameters = {};

  // Procurar tipo de contrato
  parameters.contractType = getContractType(xmlDoc);
  
  // Procurar parâmetros de predição (para DIGIT)
  if (parameters.contractType?.includes('DIGIT')) {
    parameters.prediction = findPredictionValue(xmlDoc);
  }
  
  // Procurar parâmetros de duração
  const durationInfo = findDurationFields(xmlDoc);
  if (durationInfo) {
    parameters.duration = durationInfo.duration;
    parameters.durationUnit = durationInfo.unit;
  }
  
  // Outras informações
  parameters.basis = findBasisValue(xmlDoc);
  parameters.barrier = findBarrierValue(xmlDoc);
  
  return parameters;
}

/**
 * Encontra o valor de predição (para contratos DIGIT)
 */
function findPredictionValue(xmlDoc: Document): number | undefined {
  // Procurar em campos de predição específicos
  const predictionFields = xmlDoc.getElementsByTagName('field');
  
  for (let i = 0; i < predictionFields.length; i++) {
    const field = predictionFields[i];
    if (field.getAttribute('name') === 'PREDICTION') {
      const value = field.textContent;
      if (value !== null) {
        return parseInt(value);
      }
    }
  }
  
  // Procurar valores de predição em outros possíveis lugares
  const valueElements = xmlDoc.getElementsByTagName('value');
  for (let i = 0; i < valueElements.length; i++) {
    const field = valueElements[i];
    if (field.getAttribute('name') === 'PREDICTION') {
      const valueContent = field.textContent;
      if (valueContent !== null) {
        return parseInt(valueContent);
      }
    }
  }
  
  // Para estratégia Advance, definir como 1 por padrão
  return 1;
}

/**
 * Encontra os valores de duração
 */
function findDurationFields(xmlDoc: Document): { duration: number, unit: string } | undefined {
  // Procurar em campos de duração
  const durationFields = xmlDoc.getElementsByTagName('field');
  let duration: number | undefined;
  let unit: string | undefined;
  
  for (let i = 0; i < durationFields.length; i++) {
    const field = durationFields[i];
    if (field.getAttribute('name') === 'DURATION') {
      const value = field.textContent;
      if (value !== null) {
        duration = parseInt(value);
      }
    }
    if (field.getAttribute('name') === 'DURATIONUNIT') {
      unit = field.textContent || 't';
    }
  }
  
  if (duration !== undefined && unit !== undefined) {
    return { duration, unit };
  }
  
  // Se não encontrar, definir valores padrão para estratégia Advance
  return { duration: 1, unit: 't' };
}

/**
 * Encontra o valor de basis (stake/payout)
 */
function findBasisValue(xmlDoc: Document): string | undefined {
  const basisFields = xmlDoc.getElementsByTagName('field');
  
  for (let i = 0; i < basisFields.length; i++) {
    const field = basisFields[i];
    if (field.getAttribute('name') === 'BASIS') {
      return field.textContent || 'stake';
    }
  }
  
  return 'stake';
}

/**
 * Encontra o valor de barreira para contratos com barreira
 */
function findBarrierValue(xmlDoc: Document): string | undefined {
  const barrierFields = xmlDoc.getElementsByTagName('field');
  
  for (let i = 0; i < barrierFields.length; i++) {
    const field = barrierFields[i];
    if (field.getAttribute('name') === 'BARRIER') {
      return field.textContent || undefined;
    }
  }
  
  return undefined;
}