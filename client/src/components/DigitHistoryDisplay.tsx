import React, { useState, useEffect } from 'react';
import { oauthDirectService } from "@/services/oauthDirectService";
import { derivHistoryService } from "@/services/deriv-history-service";
import { Loader2 } from "lucide-react";

interface DigitHistoryDisplayProps {
  symbol?: string;
  className?: string;
}

export function DigitHistoryDisplay({ symbol = "R_100", className = "" }: DigitHistoryDisplayProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [digits, setDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<{
    digit: number;
    count: number;
    percentage: number;
  }[]>(Array.from({ length: 10 }, (_, i) => ({ 
    digit: i, 
    count: 0, 
    percentage: 0 
  })));

  // Função para buscar histórico completo de ticks (500 ticks)
  const fetchFullTicksHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("[DigitHistoryDisplay] Buscando histórico completo de 500 ticks para:", symbol);
      
      // Solicitar histórico usando o CustomEvent API para comunicação com o serviço OAuth
      const ticksHistory = await new Promise<number[]>((resolve, reject) => {
        try {
          // Request ID único para identificar a resposta
          const requestId = `history_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          // Criamos um listener para a resposta do histórico
          const historyResponseHandler = (event: CustomEvent) => {
            const response = event.detail;
            
            // Verificamos se a resposta corresponde ao nosso requestId
            if (response && response.req_id === requestId) {
              // Removemos o listener após receber a resposta
              window.removeEventListener('deriv-history-response', historyResponseHandler as EventListener);
              
              if (response.error) {
                reject(new Error(response.error.message || 'Erro ao obter histórico'));
                return;
              }
              
              if (response.history && Array.isArray(response.history.prices)) {
                // Extrair os dígitos do histórico (último dígito de cada preço)
                const digits = response.history.prices.map((price: string) => {
                  const lastDigit = parseInt(price.slice(-1));
                  return isNaN(lastDigit) ? 0 : lastDigit;
                });
                resolve(digits);
              } else {
                reject(new Error("Formato de resposta inválido"));
              }
            }
          };
          
          // Registramos o listener para a resposta
          window.addEventListener('deriv-history-response', historyResponseHandler as EventListener);
          
          // Criamos o evento de solicitação de histórico
          const historyRequest = new CustomEvent('deriv-request-history', {
            detail: {
              req_id: requestId,
              ticks_history: symbol,
              adjust_start_time: 1,
              count: 500,
              end: "latest",
              start: 1,
              style: "ticks"
            }
          });
          
          // Disparamos o evento para que o serviço OAuth o capture
          window.dispatchEvent(historyRequest);
          
          // Definimos um timeout para evitar que a promessa fique pendente eternamente
          setTimeout(() => {
            window.removeEventListener('deriv-history-response', historyResponseHandler as EventListener);
            reject(new Error("Timeout ao aguardar resposta do histórico"));
          }, 10000);
          
        } catch (err) {
          reject(err);
        }
      });
      
      if (ticksHistory && ticksHistory.length > 0) {
        // Atualizar o estado com os dígitos históricos
        setDigits(ticksHistory);
        
        // Calcular estatísticas
        calculateStats(ticksHistory);
        
        console.log(`[DigitHistoryDisplay] Recebidos ${ticksHistory.length} dígitos históricos para ${symbol}`);
      } else {
        setError("Não foi possível obter o histórico de dígitos");
        console.error("[DigitHistoryDisplay] Nenhum dígito recebido para:", symbol);
      }
    } catch (err) {
      setError(`Erro ao buscar histórico: ${err instanceof Error ? err.message : String(err)}`);
      console.error("[DigitHistoryDisplay] Erro ao buscar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas dos dígitos
  const calculateStats = (historyDigits: number[]) => {
    // Inicializar contagens para cada dígito (0-9)
    const digitCounts = Array(10).fill(0);
    
    // Contar a frequência de cada dígito
    historyDigits.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    });
    
    // Total de dígitos analisados (para calcular percentuais)
    const totalDigits = historyDigits.length;
    
    // Criar o array de estatísticas com contagens e percentuais
    const updatedStats = digitCounts.map((count, digit) => {
      // Calcular o percentual com precisão, arredondando para o inteiro mais próximo
      const percentage = totalDigits > 0 ? Math.round((count / totalDigits) * 100) : 0;
      
      return {
        digit,
        count,
        percentage
      };
    });
    
    // Atualizar o estado das estatísticas de dígitos
    setDigitStats(updatedStats);
    
    // Verificar se a soma dos percentuais é 100% (ou próximo, devido a arredondamentos)
    const totalPercentage = updatedStats.reduce((sum, stat) => sum + stat.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 5) {
      console.warn(`[DigitHistoryDisplay] Alerta: Total de percentuais (${totalPercentage}%) não está próximo de 100%.`);
    }
  };

  // Função para atualizar dados com um novo dígito recebido
  const addNewDigit = (newDigit: number) => {
    setDigits(prevDigits => {
      // Adicionar o novo dígito ao início do array e manter apenas os 500 mais recentes
      const updatedDigits = [newDigit, ...prevDigits].slice(0, 500);
      // Recalcular estatísticas com os dados atualizados
      calculateStats(updatedDigits);
      return updatedDigits;
    });
  };

  // Efeito para buscar histórico inicial e configurar listener de ticks
  useEffect(() => {
    // Buscar histórico completo inicial
    fetchFullTicksHistory();
    
    // Configurar listener para ticks em tempo real
    const tickListener = (data: any) => {
      if (data && data.tick && typeof data.tick.last_digit === 'number') {
        const lastDigit = data.tick.last_digit;
        // Adicionar novo dígito recebido
        addNewDigit(lastDigit);
      }
    };
    
    // Registrar um event listener para os ticks
    const handleTick = (event: CustomEvent) => {
      if (event.detail) {
        tickListener(event.detail);
      }
    };
    
    // Adicionar o event listener para o evento 'tick'
    window.addEventListener('deriv-tick', handleTick as EventListener);
    
    // Inscrever-se para receber ticks do símbolo especificado
    oauthDirectService.subscribeToTicks(symbol);
    
    // Limpar listener ao desmontar componente
    return () => {
      window.removeEventListener('deriv-tick', handleTick as EventListener);
    };
  }, [symbol]);

  // Renderizar visualização de dígitos com estatísticas
  return (
    <div className={`w-full ${className}`}>
      <div className="mb-4">
        <h3 className="text-white text-md font-medium mb-2 flex items-center">
          Histórico de 500 Dígitos
          {loading && (
            <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />
          )}
        </h3>
        
        {error ? (
          <div className="text-red-500 text-sm">{error}</div>
        ) : (
          <>
            {/* Estatísticas de frequência dos dígitos */}
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2 mb-4">
              {digitStats.map((stat) => (
                <div 
                  key={stat.digit} 
                  className="bg-[#0e1a2e] rounded-md p-2 text-center"
                >
                  <div className="text-xl md:text-2xl font-bold">
                    {stat.digit}
                  </div>
                  <div 
                    className={`text-xs ${
                      stat.percentage > 12 ? 'text-green-400' : 
                      stat.percentage < 8 ? 'text-red-400' : 'text-gray-400'
                    }`}
                  >
                    {stat.percentage}%
                  </div>
                  <div className="text-[10px] text-gray-500">
                    {stat.count}x
                  </div>
                </div>
              ))}
            </div>
            
            {/* Visualização dos dígitos mais recentes (primeiros 100) */}
            <div className="flex flex-wrap gap-1 text-xs font-mono">
              {digits.slice(0, 100).map((digit, index) => (
                <span
                  key={index}
                  className={`inline-block w-7 h-7 flex items-center justify-center rounded
                    ${index === 0 ? 'bg-primary text-white font-bold' : 
                      digit % 2 === 0 ? 'bg-blue-900/40 text-blue-200' : 'bg-pink-900/40 text-pink-200'}`}
                >
                  {digit}
                </span>
              ))}
            </div>
            
            {/* Indicador de total */}
            <div className="mt-2 text-xs text-gray-400 text-right">
              Total: {digits.length}/500 dígitos
            </div>
          </>
        )}
      </div>
    </div>
  );
}