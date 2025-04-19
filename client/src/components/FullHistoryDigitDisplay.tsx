import React, { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { oauthDirectService } from "@/services/oauthDirectService";
import { derivHistoryService } from "@/services/deriv-history-service";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DigitHistoryData } from "@/services/deriv-history-service";

interface FullHistoryDigitDisplayProps {
  symbol?: string;
  maxDigitsToShow?: number;
}

/**
 * Componente que busca e exibe automaticamente os 500 dígitos históricos
 * ao ser montado, e continua atualizando com novos dígitos
 */
export const FullHistoryDigitDisplay = React.memo(function FullHistoryDigitDisplayInner({
  symbol = "R_100",
  maxDigitsToShow = 200
}: FullHistoryDigitDisplayProps) {
  // Estados
  const [historyData, setHistoryData] = useState<DigitHistoryData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [updateCounter, setUpdateCounter] = useState<number>(0);

  // Atualizar contador para forçar re-renderização
  const forceUpdate = () => setUpdateCounter(prev => prev + 1);

  // Buscar histórico completo ao montar
  useEffect(() => {
    setIsLoading(true);
    console.log(`[FullHistoryDigitDisplay] Buscando histórico completo para ${symbol}`);

    // Solicitar 500 ticks (o máximo permitido pela API)
    derivHistoryService.getTicksHistory(symbol, 500, true)
      .then(historyData => {
        console.log(`[FullHistoryDigitDisplay] Recebido histórico com ${historyData.lastDigits.length} dígitos`);
        setHistoryData(historyData);
        setIsLoading(false);
      })
      .catch(error => {
        console.error(`[FullHistoryDigitDisplay] Erro ao buscar histórico:`, error);
        setIsLoading(false);
      });

    // Adicionar ouvinte para atualizações do histórico
    const handleHistoryUpdate = (data: DigitHistoryData) => {
      if (data.lastDigits.length > 0) {
        setHistoryData(data);
        forceUpdate();
      }
    };

    // Registrar ouvinte
    derivHistoryService.addListener(handleHistoryUpdate, symbol);

    // Limpar ao desmontar
    return () => {
      derivHistoryService.removeListener(handleHistoryUpdate);
    };
  }, [symbol]);

  // Monitorar ticks em tempo real para atualização mais rápida
  useEffect(() => {
    const handleTick = (event: any) => {
      if (event.type === 'tick' && typeof event.lastDigit === 'number') {
        // Apenas forçamos uma atualização, o histórico já será atualizado pelo serviço
        forceUpdate();
      }
    };

    // Registrar handler
    oauthDirectService.addEventListener(handleTick);

    // Limpar ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleTick);
    };
  }, []);

  // Memoizar estatísticas para evitar recálculos desnecessários
  const stats = useMemo(() => {
    if (!historyData) return [];

    const result = [];
    for (let i = 0; i <= 9; i++) {
      const digitStats = historyData.digitStats[i];
      if (digitStats) {
        result.push({
          digit: i,
          count: digitStats.count,
          percentage: digitStats.percentage
        });
      }
    }
    return result;
  }, [historyData, updateCounter]);

  // Detectar padrões nos dígitos
  const patterns = useMemo(() => {
    if (!historyData || !historyData.lastDigits.length) return [];
    
    const digits = historyData.lastDigits.slice(0, 20); // Analisar apenas os 20 mais recentes
    const results = [];
    
    // Padrão: 3+ dígitos pares consecutivos
    let consecPairs = 0;
    for (let i = 0; i < digits.length; i++) {
      if (digits[i] % 2 === 0) {
        consecPairs++;
      } else {
        if (consecPairs >= 3) {
          results.push({
            type: 'conseq_even',
            count: consecPairs,
            message: `${consecPairs} pares consecutivos`
          });
        }
        consecPairs = 0;
      }
    }
    
    // Verificar caso termine com o padrão
    if (consecPairs >= 3) {
      results.push({
        type: 'conseq_even',
        count: consecPairs,
        message: `${consecPairs} pares consecutivos`
      });
    }
    
    // Padrão: 3+ dígitos ímpares consecutivos
    let consecOdds = 0;
    for (let i = 0; i < digits.length; i++) {
      if (digits[i] % 2 !== 0) {
        consecOdds++;
      } else {
        if (consecOdds >= 3) {
          results.push({
            type: 'conseq_odd',
            count: consecOdds,
            message: `${consecOdds} ímpares consecutivos`
          });
        }
        consecOdds = 0;
      }
    }
    
    // Verificar caso termine com o padrão
    if (consecOdds >= 3) {
      results.push({
        type: 'conseq_odd',
        count: consecOdds,
        message: `${consecOdds} ímpares consecutivos`
      });
    }
    
    // Dígito mais frequente nos últimos 20
    const counts: Record<number, number> = {};
    digits.forEach(d => {
      counts[d] = (counts[d] || 0) + 1;
    });
    
    const mostFrequent = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([digit, count]) => ({ 
        digit: parseInt(digit), 
        count, 
        percentage: Math.round((count / digits.length) * 100) 
      }))[0];
    
    if (mostFrequent && mostFrequent.count >= 3) {
      results.push({
        type: 'frequent',
        digit: mostFrequent.digit,
        count: mostFrequent.count,
        message: `O dígito ${mostFrequent.digit} apareceu ${mostFrequent.count} vezes (${mostFrequent.percentage}%)`
      });
    }
    
    return results;
  }, [historyData, updateCounter]);

  // Função para determinar a cor do dígito
  const getDigitColor = (digit: number): string => {
    if (digit === 0 || digit === 5) {
      return "bg-amber-500 text-white"; // Amarelo para 0 e 5
    } else if (digit % 2 === 0) {
      return "bg-red-500 text-white";   // Vermelho para pares
    } else {
      return "bg-green-500 text-white"; // Verde para ímpares
    }
  };

  // Determinar cor de fundo baseada na porcentagem
  const getPercentageBackgroundStyle = (percentage: number) => {
    if (percentage >= 30) return { width: `${percentage}%`, backgroundColor: '#ef4444' }; // Vermelho
    if (percentage >= 20) return { width: `${percentage}%`, backgroundColor: '#f59e0b' }; // Âmbar
    if (percentage >= 10) return { width: `${percentage}%`, backgroundColor: '#10b981' }; // Verde
    return { width: `${percentage}%`, backgroundColor: '#6b7280' }; // Cinza
  };

  // Renderizar a UI
  return (
    <Card className="bg-[#13203a] p-4 shadow-lg border border-[#2a3756]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <div className="h-3 w-3 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
          <span className="text-sm font-medium text-white">{symbol}</span>
        </div>
        <div className="text-xs text-gray-400">
          {isLoading ? (
            <span className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-1"></div>
              Carregando...
            </span>
          ) : (
            <span>
              {historyData?.lastUpdated?.toLocaleTimeString() || 'Atualizado'}
              {' '} 
              ({historyData?.lastDigits.length || 0} dígitos)
            </span>
          )}
        </div>
      </div>
      
      {/* Exibição grande e destacada do último dígito (que está no final do array) */}
      {!isLoading && historyData?.lastDigits && historyData.lastDigits.length > 0 && (
        <div className="mb-4 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs text-white font-bold mb-1">ÚLTIMO DÍGITO:</div>
            <div 
              className={`${getDigitColor(historyData.lastDigits[historyData.lastDigits.length - 1])} w-16 h-16 flex items-center justify-center rounded-md font-bold text-2xl shadow-md animate-pulse border-2 border-white mx-auto`}
            >
              {historyData.lastDigits[historyData.lastDigits.length - 1]}
            </div>
          </div>
        </div>
      )}
      
      {/* Sequência de dígitos atual - apresentados 1 a 1 em múltiplas linhas */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 font-medium">Histórico de dígitos: <span className="text-xs text-red-400 font-bold">(ordem da esquerda para direita - o mais recente é o primeiro à direita!)</span></div>
        {isLoading ? (
          <div className="grid grid-cols-10 gap-1.5 mb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={`loading-${i}`}
                className="w-8 h-8 flex items-center justify-center rounded-md font-bold text-sm shadow-md bg-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : historyData?.lastDigits && historyData.lastDigits.length > 0 ? (
          // Agrupar os dígitos em linhas de 10 para melhor visualização
          <div className="space-y-1.5">
            {Array.from({ length: Math.ceil(Math.min(maxDigitsToShow, historyData.lastDigits.length) / 10) }).map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-10 gap-1.5">
                {historyData.lastDigits.slice(rowIndex * 10, (rowIndex + 1) * 10).map((digit, colIndex) => {
                  const index = (rowIndex * 10) + colIndex;
                  if (index >= maxDigitsToShow) return null;
                  return (
                    <div 
                      key={`digit-${index}-${updateCounter}`}
                      className={`${getDigitColor(digit)} w-8 h-8 flex items-center justify-center rounded-md font-bold text-sm shadow-md transform ${index === 9 ? 'scale-125 border-2 border-white animate-pulse' : ''}`}
                    >
                      {digit}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-400">Aguardando dados...</div>
        )}
        
        {/* Legendas */}
        <div className="flex gap-3 mt-2 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
            <span className="text-gray-400">Pares</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
            <span className="text-gray-400">Ímpares</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-amber-500 mr-1"></div>
            <span className="text-gray-400">0/5</span>
          </div>
        </div>
      </div>
      
      <Separator className="bg-[#2a3756] mb-4" />
      
      {/* Estatísticas */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 font-medium">Estatísticas de {historyData?.totalCount || 0} dígitos:</div>
        <div className="grid grid-cols-5 gap-2">
          {stats.map(stat => (
            <div key={`stat-${stat.digit}-${updateCounter}`} className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-400">{stat.digit}</span>
                <span className="text-xs font-bold text-white">{stat.percentage}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={getPercentageBackgroundStyle(stat.percentage)}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1 text-right">{stat.count}</div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Padrões detectados */}
      {patterns.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">Padrões detectados:</h3>
          <div className="flex flex-wrap gap-2">
            {patterns.map((pattern, index) => (
              <Badge 
                key={`pattern-${index}-${updateCounter}`} 
                variant="outline"
                className={`
                  ${pattern.type === 'conseq_even' ? 'border-red-500 text-red-400' : 
                    pattern.type === 'conseq_odd' ? 'border-green-500 text-green-400' : 
                    'border-blue-500 text-blue-400'}
                `}
              >
                {pattern.message}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
});