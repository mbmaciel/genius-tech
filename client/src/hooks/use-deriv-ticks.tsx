import { useState, useEffect } from 'react';
import { oauthDirectService } from '../services/oauthDirectService';

/**
 * Hook especializado para capturar em tempo real os ticks da Deriv API
 * usando a conexão OAuth do sistema.
 * 
 * @param symbol O símbolo do mercado (ex: "R_100")
 * @returns Um objeto com o último dígito e a cotação completa
 */
export function useDerivTicks(symbol: string = 'R_100') {
  // Estado para armazenar o último dígito
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  // Estado para armazenar a última cotação completa
  const [lastQuote, setLastQuote] = useState<number | null>(null);
  // Estado para controlar se está carregando
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Estado para armazenar erros
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log(`[useDerivTicks] Inicializando hook para símbolo ${symbol}`);
    
    setIsLoading(true);
    setError(null);

    // Função para processar um novo tick recebido
    const processTickHandler = (event: Event) => {
      try {
        const customEvent = event as CustomEvent;
        const tickData = customEvent.detail;
        
        // Log para depuração
        console.log(`[useDerivTicks] Evento de tick recebido:`, tickData);
        
        if (tickData) {
          // Caso 1: Se tiver quote diretamente
          if (tickData.quote) {
            const quote = Number(tickData.quote);
            setLastQuote(quote);
            
            // Extrair o último dígito da cotação
            const quoteStr = quote.toString();
            const digit = parseInt(quoteStr.charAt(quoteStr.length - 1));
            if (!isNaN(digit)) {
              setLastDigit(digit);
              setIsLoading(false);
              console.log(`[useDerivTicks] Novo tick capturado: ${quote}, último dígito: ${digit}`);
            }
          } 
          // Caso 2: Se a mensagem for uma string que contém "Último dígito: X"
          else if (typeof tickData === 'string' && tickData.includes('Último dígito:')) {
            const match = tickData.match(/Último dígito: (\d)/);
            if (match && match[1]) {
              const digit = parseInt(match[1]);
              setLastDigit(digit);
              setIsLoading(false);
              console.log(`[useDerivTicks] Dígito extraído do log: ${digit}`);
            }
          }
          // Caso 3: Se tiver tick.quote (formato da API WebSocket)
          else if (tickData.tick && tickData.tick.quote) {
            const quote = Number(tickData.tick.quote);
            setLastQuote(quote);
            
            // Extrair o último dígito da cotação
            const quoteStr = quote.toString();
            const digit = parseInt(quoteStr.charAt(quoteStr.length - 1));
            if (!isNaN(digit)) {
              setLastDigit(digit);
              setIsLoading(false);
              console.log(`[useDerivTicks] Novo tick da API capturado: ${quote}, último dígito: ${digit}`);
            }
          }
        }
      } catch (err) {
        console.error('[useDerivTicks] Erro ao processar tick:', err);
        setError('Erro ao processar tick');
      }
    };

    // Registrar para os eventos 'oauthTick', 'tick' e 'tick-update'
    document.addEventListener('oauthTick', processTickHandler);
    document.addEventListener('tick', processTickHandler);
    document.addEventListener('tick-update', processTickHandler);
    
    // Garantir que estamos inscritos nos ticks do símbolo solicitado
    if (oauthDirectService) {
      oauthDirectService.subscribeToTicks(symbol);
      console.log(`[useDerivTicks] Inscrito nos ticks de ${symbol}`);
    }

    // Cleanup function
    return () => {
      document.removeEventListener('oauthTick', processTickHandler);
      document.removeEventListener('tick', processTickHandler);
      console.log(`[useDerivTicks] Desregistrando listeners para ${symbol}`);
    };
  }, [symbol]);

  return { lastDigit, lastQuote, isLoading, error };
}