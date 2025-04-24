import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Corrige o valor da barreira para estratégias específicas
 * Função utilitária global que pode ser utilizada em qualquer componente
 * 
 * @param barrier Valor original da barreira
 * @param strategyId ID da estratégia
 * @param contractType Tipo do contrato
 * @returns Valor corrigido da barreira
 */
export function correctBarrier(
  barrier: string | number | undefined, 
  strategyId: string | undefined,
  contractType?: string
): string | number | undefined {
  // Se não houver barreira ou estratégia, retornar o valor original
  if (!barrier || !strategyId) return barrier;
  
  // Normalizar ID da estratégia para comparação
  const normalizedStrategy = strategyId.toLowerCase();
  
  // Aplicar correções específicas por estratégia
  if (normalizedStrategy === 'advance' || normalizedStrategy === 'adv') {
    // Log para diagnóstico, mas apenas se o valor for diferente de 1
    if (barrier !== '1' && barrier !== 1) {
      console.log(`[UTILS] Corrigindo barreira para estratégia Advance. Original: ${barrier}, Corrigido: 1`);
    }
    
    // Para estratégia Advance, sempre retornar "1"
    return "1";
  }
  
  // Caso não tenha regras específicas, retornar o valor original
  return barrier;
}

/**
 * Corrige mensagens de texto que contêm informações de barreira
 * Ideal para corrigir strings como display_name e longcode
 * 
 * @param text Texto original contendo informações de barreira
 * @param strategyId ID da estratégia
 * @returns Texto com barreira corrigida
 */
export function correctBarrierText(
  text: string | undefined,
  strategyId: string | undefined
): string | undefined {
  // Se não houver texto ou estratégia, retornar o texto original
  if (!text || !strategyId) return text;
  
  // Normalizar ID da estratégia para comparação
  const normalizedStrategy = strategyId.toLowerCase();
  
  // Aplicar correções específicas por estratégia
  if (normalizedStrategy === 'advance' || normalizedStrategy === 'adv') {
    // Substituir todos os possíveis padrões de texto que contêm informações de barreira
    // Incluindo variações com diferentes espaçamentos e formatos
    const correctedText = text
      // Português - minúsculas
      .replace(/acima de \d+/gi, "acima de 1")
      .replace(/acima do \d+/gi, "acima do 1")
      .replace(/maior que \d+/gi, "maior que 1")
      .replace(/maior do que \d+/gi, "maior do que 1")
      .replace(/superior a \d+/gi, "superior a 1")
      
      // CORREÇÃO CRÍTICA: O formato que aparece na captura de tela
      .replace(/superior a \d+ ticks/gi, "superior a 1 ticks")
      .replace(/estritamente superior a \d+/gi, "estritamente superior a 1")
      
      // Português - Formato alternativo com "é"
      .replace(/é acima de \d+/gi, "é acima de 1")
      .replace(/é maior que \d+/gi, "é maior que 1")
      
      // Inglês
      .replace(/above \d+/gi, "above 1")
      .replace(/higher than \d+/gi, "higher than 1")
      .replace(/greater than \d+/gi, "greater than 1")
      .replace(/over \d+/gi, "over 1")
      
      // Formatos específicos da API Deriv (tanto DigitOver quanto DIGITOVER)
      .replace(/DigitOver \d+/g, "DigitOver 1")
      .replace(/DIGITOVER \d+/g, "DIGITOVER 1")
      .replace(/digit over \d+/gi, "digit over 1")
      
      // Formatos com números e sem espaço
      .replace(/>\s*\d+/g, ">1")
      .replace(/DigitOver\d+/g, "DigitOver1")
      .replace(/DIGITOVER\d+/g, "DIGITOVER1");
    
    // Log para diagnóstico, apenas se houve alteração
    if (correctedText !== text) {
      console.log(`[UTILS] Corrigindo texto de barreira para estratégia Advance`);
      console.log(`[UTILS] Original: ${text}`);
      console.log(`[UTILS] Corrigido: ${correctedText}`);
    }
    
    return correctedText;
  }
  
  // Caso não tenha regras específicas, retornar o texto original
  return text;
}
