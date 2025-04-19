import React, { useEffect, useState } from 'react';
import { oauthDirectService } from '@/services/oauthDirectService';
import { derivHistoryService } from '@/services/deriv-history-service';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DigitBarChartProps {
  symbol?: string;
  className?: string;
}

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export function DigitBarChart({ symbol = "R_100", className = "" }: DigitBarChartProps) {
  // Estados
  const [digits, setDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 }))
  );
  const [selectedCount, setSelectedCount] = useState<string>("500");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState<number>(0);

  // Buscar histórico de ticks no carregamento
  const fetchTicksHistory = async () => {
    try {
      setLoading(true);
      // O método getFullTicksHistory não existe, então vamos começar com array vazio
      // e construir histórico a partir de ticks recebidos em tempo real
      setDigits([]);
      
      // Inicializar com estatísticas vazias
      const emptyStats = Array.from({ length: 10 }, (_, i) => ({ 
        digit: i, count: 0, percentage: 0 
      }));
      setDigitStats(emptyStats);
      
      console.log(`[DigitBarChart] Iniciando coleta de ticks em tempo real para ${symbol}`);
      // Permitir que o componente inicie mesmo sem histórico inicial
      setLoading(false);
    } catch (err) {
      console.error("[DigitBarChart] Erro ao inicializar:", err);
      setError("Erro ao inicializar componente");
      setLoading(false);
    }
  };

  // Função para calcular estatísticas dos dígitos
  const calculateStats = (historyDigits: number[]) => {
    const limit = parseInt(selectedCount);
    const digitsToAnalyze = historyDigits.slice(0, limit);
    const counts = Array(10).fill(0);
    
    digitsToAnalyze.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    });
    
    const total = digitsToAnalyze.length;
    
    const newStats = counts.map((count, digit) => {
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { digit, count, percentage };
    });
    
    setDigitStats(newStats);
    // Forçar renderização com nova chave
    setRenderKey(prev => prev + 1);
  };

  // Adicionar novo dígito recebido em tempo real
  const addNewDigit = (newDigit: number) => {
    setDigits(prev => {
      const updated = [newDigit, ...prev].slice(0, 500);
      calculateStats(updated);
      return updated;
    });
  };

  // Recalcular quando a seleção mudar
  useEffect(() => {
    if (digits.length > 0) {
      calculateStats(digits);
    }
  }, [selectedCount]);

  // Inicializar dados e configurar listener para ticks em tempo real
  useEffect(() => {
    // Buscar histórico inicial
    fetchTicksHistory();
    
    // Função para atualizar os dados
    const updateDigitData = () => {
      console.log('[DigitBarChart] Tentando atualizar dados de dígitos...');
      
      try {
        // Obter dígitos do serviço de histórico
        if (typeof derivHistoryService.getDigitsHistory === 'function') {
          const count = parseInt(selectedCount);
          const tickHistory = derivHistoryService.getDigitsHistory(symbol, count);
          
          if (tickHistory && tickHistory.length > 0) {
            console.log(`[DigitBarChart] Recebidos ${tickHistory.length} dígitos do serviço de histórico`);
            
            // Atualizar histórico completo
            setDigits(tickHistory);
            
            // Calcular estatísticas a partir do histórico
            const digitCounts = Array(10).fill(0);
            
            tickHistory.forEach((digit: number) => {
              if (digit >= 0 && digit <= 9) {
                digitCounts[digit]++;
              }
            });
            
            const totalDigits = tickHistory.length;
            
            const updatedStats = digitCounts.map((count, digit) => {
              const percentage = totalDigits > 0 ? Math.round((count / totalDigits) * 100) : 0;
              return { digit, count, percentage };
            });
            
            setDigitStats(updatedStats);
            setLoading(false);
          } else {
            console.log('[DigitBarChart] Sem dados de histórico disponíveis');
          }
        } else {
          console.error('[DigitBarChart] Método getDigitsHistory não disponível no serviço');
        }
      } catch (err) {
        console.error('[DigitBarChart] Erro ao atualizar dados:', err);
      }
    };
    
    // Garantir que estamos inscritos para os ticks via OAuth
    if (oauthDirectService && typeof oauthDirectService.subscribeToTicks === 'function') {
      console.log(`[DigitBarChart] Inscrevendo-se para ticks de ${symbol} via OAuth`);
      oauthDirectService.subscribeToTicks(symbol);
    }
    
    // Também inscrever via serviço de histórico
    if (derivHistoryService && typeof derivHistoryService.subscribeToTicks === 'function') {
      console.log(`[DigitBarChart] Inscrevendo-se para ticks de ${symbol} via serviço de histórico`);
      derivHistoryService.subscribeToTicks(symbol);
    }
    
    // Configurar atualização periódica dos ticks
    const tickUpdateInterval = setInterval(updateDigitData, 1000);
    
    // Reforçar atualização periódica da interface
    const forceUpdateInterval = setInterval(() => {
      setRenderKey(prev => prev + 1);
    }, 1000);
    
    return () => {
      // Limpar intervalos
      clearInterval(tickUpdateInterval);
      clearInterval(forceUpdateInterval);
    };
  }, [symbol]);

  return (
    <div className={`w-full ${className}`} key={`chart-container-${renderKey}`}>
      <div className="bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg">
        <div className="p-3 bg-[#0e1a2e] border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 mr-1.5 rounded-sm"></div>
            <h3 className="font-medium text-white flex items-center">
              Gráfico de Dígitos do {symbol}
              {loading && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />
              )}
            </h3>
          </div>
          
          <div className="flex items-center">
            <Select value={selectedCount} onValueChange={setSelectedCount}>
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
                    key={`grid-line-${value}-${renderKey}`}
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
                    key={`bar-${stat.digit}-${stat.percentage}-${renderKey}`} 
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
                      key={`recent-digit-${index}-${renderKey}`} 
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
            
            {/* Contador de dígitos */}
            <div className="mt-4 text-xs text-gray-400 text-center">
              Analisando {selectedCount} de {Math.min(digits.length, 500)} dígitos disponíveis
            </div>
          </div>
        )}
      </div>
    </div>
  );
}