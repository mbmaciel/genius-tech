import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { derivHistoryService } from "@/services/deriv-history-service";
import { oauthDirectService } from "@/services/oauthDirectService";
import { Separator } from "@/components/ui/separator";

interface HistoricalDigitDisplayProps {
  symbol?: string;
  maxDigitsToShow?: number;
}

/**
 * Componente totalmente independente que exibe apenas os dígitos históricos
 * sem influenciar as estatísticas percentuais
 */
export const HistoricalDigitDisplay = React.memo(function HistoricalDigitDisplayInner({
  symbol = "R_100",
  maxDigitsToShow = 200
}: HistoricalDigitDisplayProps) {
  // Estados
  const [digits, setDigits] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Buscar histórico completo ao montar
  useEffect(() => {
    setIsLoading(true);
    console.log(`[HistoricalDigitDisplay] Buscando histórico completo para ${symbol}`);

    // Solicitar 500 ticks (o máximo permitido pela API)
    derivHistoryService.getTicksHistory(symbol, 500, true)
      .then(historyData => {
        console.log(`[HistoricalDigitDisplay] Recebido histórico com ${historyData.lastDigits.length} dígitos`);
        setDigits(historyData.lastDigits);
        setLastUpdated(historyData.lastUpdated);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(`[HistoricalDigitDisplay] Erro ao buscar histórico:`, err);
        setError("Falha ao carregar histórico de dígitos");
        setIsLoading(false);
      });

    // Adicionar ouvinte para ticks em tempo real para manter atualizado
    const handleTick = (event: any) => {
      if (event.type === 'tick' && typeof event.lastDigit === 'number') {
        // Adicionar novo dígito no início do array
        setDigits(prev => [event.lastDigit, ...prev].slice(0, 500));
        setLastUpdated(new Date());
      }
    };

    // Registrar handler
    oauthDirectService.addEventListener(handleTick);

    // Limpar ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleTick);
    };
  }, [symbol]);

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

  // Renderizar a UI
  return (
    <Card className="bg-[#13203a] p-4 shadow-lg border border-[#2a3756]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <div className="h-3 w-3 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
          <span className="text-sm font-medium text-white">Histórico de 500 Dígitos ({symbol})</span>
        </div>
        <div className="text-xs text-gray-400">
          {isLoading ? (
            <span className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-1"></div>
              Carregando...
            </span>
          ) : (
            <span>
              {lastUpdated?.toLocaleTimeString() || 'Atualizado'} ({digits.length} dígitos)
            </span>
          )}
        </div>
      </div>
      
      {/* Exibição grande e destacada do último dígito */}
      {!isLoading && digits.length > 0 && (
        <div className="mb-4 flex items-center justify-center">
          <div className="text-center">
            <div className="text-xs text-white font-bold mb-1">ÚLTIMO DÍGITO:</div>
            <div 
              className={`${getDigitColor(digits[0])} w-16 h-16 flex items-center justify-center rounded-md font-bold text-2xl shadow-md animate-pulse border-2 border-white mx-auto`}
            >
              {digits[0]}
            </div>
          </div>
        </div>
      )}
      
      {/* Mensagem de erro, se houver */}
      {error && (
        <div className="bg-red-500/20 text-red-400 p-3 rounded-md mb-3">
          {error}
        </div>
      )}
      
      {/* Sequência de dígitos atual - apresentados 1 a 1 em múltiplas linhas */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 font-medium">Histórico completo de dígitos: <span className="text-xs text-red-400 font-bold">(ordem da esquerda para direita - o mais recente é o primeiro à esquerda!)</span></div>
        {isLoading ? (
          <div className="grid grid-cols-10 gap-1.5 mb-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div 
                key={`loading-${i}`}
                className="w-8 h-8 flex items-center justify-center rounded-md font-bold text-sm shadow-md bg-gray-700 animate-pulse"
              />
            ))}
          </div>
        ) : digits.length > 0 ? (
          // Agrupar os dígitos em linhas de 10 para melhor visualização
          <div className="space-y-1.5">
            {Array.from({ length: Math.ceil(Math.min(maxDigitsToShow, digits.length) / 10) }).map((_, rowIndex) => (
              <div key={`row-${rowIndex}`} className="grid grid-cols-10 gap-1.5">
                {digits.slice(rowIndex * 10, (rowIndex + 1) * 10).map((digit, colIndex) => {
                  const index = (rowIndex * 10) + colIndex;
                  if (index >= maxDigitsToShow) return null;
                  return (
                    <div 
                      key={`digit-${index}`}
                      className={`${getDigitColor(digit)} w-8 h-8 flex items-center justify-center rounded-md font-bold text-sm shadow-md transform ${index === 0 ? 'scale-125 border-2 border-white animate-pulse' : ''}`}
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
      
      <div className="text-xs text-gray-500">
        Este componente exibe apenas o histórico de dígitos, sem afetar as estatísticas percentuais.
        Para análise em tempo real com escolha de quantidade de ticks, use a seleção acima.
      </div>
    </Card>
  );
});