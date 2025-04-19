import React, { useState, useEffect } from 'react';
import { oauthDirectService } from "@/services/oauthDirectService";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DigitBarChart } from './DigitBarChart';

interface DigitHistoryDisplayProps {
  symbol?: string;
  className?: string;
}

type DigitStat = {
  digit: number;
  count: number;
  percentage: number;
};

export function DigitHistoryDisplay({ symbol = "R_100", className = "" }: DigitHistoryDisplayProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [digits, setDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 }))
  );
  // Estado para armazenar a quantidade selecionada de dígitos para análise
  const [selectedCount, setSelectedCount] = useState<string>("500");

  // Função para buscar histórico completo de ticks (500 ticks)
  const fetchFullTicksHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("[DigitHistoryDisplay] Buscando histórico completo de 500 ticks para:", symbol);
      
      // Solicitar histórico via WebSocket direto
      const historicDigits = await fetchDirectFromDeriv(symbol, 500);
      
      if (historicDigits && historicDigits.length > 0) {
        // Atualizar o estado com os dígitos históricos
        setDigits(historicDigits);
        
        // Calcular estatísticas
        calculateStats(historicDigits);
        
        console.log(`[DigitHistoryDisplay] Recebidos ${historicDigits.length} dígitos históricos para ${symbol}`);
      } else {
        setError("Não foi possível obter o histórico de dígitos");
        console.error("[DigitHistoryDisplay] Nenhum dígito recebido para:", symbol);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erro ao buscar histórico: ${errorMessage}`);
      console.error("[DigitHistoryDisplay] Erro ao buscar histórico:", err);
    } finally {
      setLoading(false);
    }
  };

  // Função para obter histórico diretamente da Deriv via WebSocket
  const fetchDirectFromDeriv = (symbolName: string, count: number): Promise<number[]> => {
    return new Promise((resolve, reject) => {
      try {
        // Preparar a requisição de histórico
        const request = {
          ticks_history: symbolName,
          adjust_start_time: 1,
          count: count,
          end: "latest",
          start: 1,
          style: "ticks",
          req_id: Math.floor(Math.random() * 1000000)
        };
        
        // Obter o token de autorização, se disponível
        const authToken = localStorage.getItem('deriv_oauth_token');
        
        // Estabelecer conexão WebSocket direta
        const wsUrl = "wss://ws.binaryws.com/websockets/v3?app_id=1089";
        const ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log("[DigitHistoryDisplay] WebSocket conectado para histórico");
          
          // Autorizar primeiro se tiver token
          if (authToken) {
            ws.send(JSON.stringify({
              authorize: authToken
            }));
          } else {
            // Se não tiver token, enviar solicitação de histórico diretamente
            ws.send(JSON.stringify(request));
          }
        };
        
        ws.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            
            // Se resposta for de autorização, enviar solicitação de histórico
            if (data.msg_type === 'authorize') {
              console.log("[DigitHistoryDisplay] Autorização para histórico bem-sucedida");
              ws.send(JSON.stringify(request));
            }
            
            // Se for a resposta do histórico
            if (data.msg_type === 'history' && data.req_id === request.req_id) {
              if (data.error) {
                console.error("[DigitHistoryDisplay] Erro na resposta do histórico:", data.error);
                reject(new Error(data.error.message || "Erro ao solicitar histórico"));
                ws.close();
                return;
              }
              
              if (data.history && Array.isArray(data.history.prices)) {
                console.log(`[DigitHistoryDisplay] Recebidos ${data.history.prices.length} ticks históricos`);
                
                // Extrair últimos dígitos de cada preço
                const digits = data.history.prices.map((price: number | string) => {
                  const priceStr = price.toString();
                  const lastChar = priceStr.charAt(priceStr.length - 1);
                  const digit = parseInt(lastChar);
                  return isNaN(digit) ? 0 : digit;
                });
                
                resolve(digits);
              } else {
                console.error("[DigitHistoryDisplay] Resposta de histórico inválida:", data);
                reject(new Error("Formato de resposta inválido"));
              }
              
              // Fechar conexão após receber resposta
              ws.close();
            }
          } catch (err) {
            console.error("[DigitHistoryDisplay] Erro ao processar mensagem:", err);
            reject(err);
            ws.close();
          }
        };
        
        ws.onerror = (error) => {
          console.error("[DigitHistoryDisplay] Erro na conexão WebSocket:", error);
          reject(new Error("Erro na conexão WebSocket"));
        };
        
        // Timeout para evitar espera infinita
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            console.warn("[DigitHistoryDisplay] Timeout ao aguardar resposta, fechando conexão");
            ws.close();
            reject(new Error("Timeout ao solicitar histórico"));
          }
        }, 15000);
      } catch (err) {
        console.error("[DigitHistoryDisplay] Erro ao estabelecer conexão:", err);
        reject(err);
      }
    });
  };

  // Para controlar atualizações da UI
  const [updateCounter, setUpdateCounter] = useState<number>(0);
  
  // Calcular estatísticas dos dígitos
  const calculateStats = (historyDigits: number[], countToAnalyze?: number) => {
    // Obter a quantidade de dígitos a analisar, com base na seleção do usuário
    const limit = countToAnalyze || parseInt(selectedCount);
    
    // Utilizar apenas os N dígitos mais recentes
    const digitsToAnalyze = historyDigits.slice(0, limit);
    
    // Inicializar contagens para cada dígito (0-9)
    const digitCounts = Array(10).fill(0);
    
    // Contar a frequência de cada dígito
    digitsToAnalyze.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    });
    
    // Total de dígitos analisados (para calcular percentuais)
    const totalDigits = digitsToAnalyze.length;
    
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
    
    // Incrementar contador para forçar atualização da UI
    setUpdateCounter(prev => prev + 1);
    
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

  // Recalcular estatísticas quando a seleção de contagem muda
  useEffect(() => {
    if (digits.length > 0) {
      calculateStats(digits);
    }
  }, [selectedCount, digits.length]);

  // Efeito para buscar histórico inicial e configurar listener de ticks
  useEffect(() => {
    // Buscar histórico completo inicial
    fetchFullTicksHistory();
    
    // Configurar listener para ticks em tempo real
    const tickListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.tick && typeof customEvent.detail.tick.last_digit === 'number') {
        const lastDigit = customEvent.detail.tick.last_digit;
        // Adicionar novo dígito recebido
        addNewDigit(lastDigit);
      }
    };
    
    // Adicionar o event listener para o evento 'deriv-tick'
    window.addEventListener('deriv-tick', tickListener);
    
    // Inscrever-se para receber ticks do símbolo especificado
    oauthDirectService.subscribeToTicks(symbol);
    
    // Configurar intervalo para forçar atualizações da UI a cada 2 segundos
    const refreshInterval = setInterval(() => {
      setUpdateCounter(prev => prev + 1);
    }, 2000);
    
    // Limpar listener e intervalo ao desmontar componente
    return () => {
      window.removeEventListener('deriv-tick', tickListener);
      clearInterval(refreshInterval);
    };
  }, [symbol]);

  // Renderizar apenas o gráfico de barras
  return (
    <div className={`w-full ${className}`}>
      <div className="bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg">
        <div className="p-3 bg-[#0e1a2e] border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 mr-1.5 rounded-sm"></div>
            <h3 className="font-medium text-white flex items-center">
              Gráfico de barras
              {loading && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />
              )}
            </h3>
          </div>
          
          {/* Menu de seleção para quantidade de dígitos a analisar */}
          <div className="flex items-center">
            <Select value={selectedCount} onValueChange={(value) => setSelectedCount(value)}>
              <SelectTrigger className="h-8 w-[90px] bg-[#0c1625] border border-gray-700 text-xs">
                <SelectValue placeholder="500" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 Ticks</SelectItem>
                <SelectItem value="50">50 Ticks</SelectItem>
                <SelectItem value="100">100 Ticks</SelectItem>
                <SelectItem value="200">200 Ticks</SelectItem>
                <SelectItem value="250">250 Ticks</SelectItem>
                <SelectItem value="500">500 Ticks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {error ? (
          <div className="text-red-500 text-sm p-4">{error}</div>
        ) : (
          <div className="p-4">
            {/* Área do gráfico */}
            <div className="relative h-[250px] flex items-end justify-between px-2">
              {/* Linhas de grade horizontais */}
              <div className="absolute w-full h-full flex flex-col justify-between">
                {[0, 10, 20, 30, 40, 50].map(value => (
                  <div 
                    key={value}
                    className="w-full border-t border-gray-800 relative"
                    style={{ bottom: `${(value / 50) * 100}%` }}
                  >
                    <span className="absolute -top-3 -left-8 text-gray-500 text-xs">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Barras para cada dígito */}
              {digitStats.map(stat => {
                // Determinar a cor baseada na frequência
                let barColor = stat.percentage >= 20 
                  ? "#ff3232" // Vermelho para 20% ou mais
                  : (stat.digit % 2 === 0 ? "#2a405a" : "#896746"); // Azul escuro para pares, marrom para ímpares
                
                return (
                  <div 
                    key={`${stat.digit}-${stat.percentage}-${updateCounter}`} 
                    className="flex flex-col items-center w-9 z-10"
                  >
                    {/* Barra com altura proporcional à porcentagem */}
                    <div 
                      className="w-full transition-all duration-300 ease-in-out flex justify-center relative"
                      style={{ 
                        height: `${Math.max(1, (stat.percentage / 50) * 100)}%`,
                        backgroundColor: barColor
                      }}
                    >
                      {/* Mostrar percentual acima da barra */}
                      {stat.percentage > 0 && (
                        <div className="absolute -top-6 w-full text-center">
                          <span className="text-white text-xs font-bold">
                            {stat.percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Dígito abaixo da barra */}
                    <div className="mt-2 w-full text-center text-white font-semibold">
                      {stat.digit}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Sequência de dígitos mais recentes */}
            <div className="mt-6 border-t border-gray-800 pt-4">
              <div className="flex justify-center">
                <div className="grid grid-cols-10 gap-1 text-white text-sm font-mono">
                  {digits.slice(0, 10).map((digit, index) => (
                    <div 
                      key={`digit-${index}-${digit}-${updateCounter}`} 
                      className={`w-7 h-7 flex items-center justify-center border rounded
                        ${index === 0 
                          ? 'bg-primary text-white border-primary font-bold' 
                          : 'border-gray-700 text-white'}`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}