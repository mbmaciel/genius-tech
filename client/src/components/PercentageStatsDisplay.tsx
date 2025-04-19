import React, { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { oauthDirectService } from "@/services/oauthDirectService";
import { Separator } from "@/components/ui/separator";

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

interface PercentageStatsDisplayProps {
  symbol?: string;
}

/**
 * Componente dedicado apenas às estatísticas percentuais
 * Captura ticks diretamente da Deriv, totalmente independente dos componentes de exibição de dígitos
 */
export const PercentageStatsDisplay = React.memo(function PercentageStatsDisplayInner({
  symbol = "R_100"
}: PercentageStatsDisplayProps) {
  // Estados
  const [allTicks, setAllTicks] = useState<number[]>([]);
  const [selectedCount, setSelectedCount] = useState<string>("50");
  const [digitStats, setDigitStats] = useState<DigitStat[]>([]);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Opções de seleção para quantidade de ticks
  const tickCountOptions = ["25", "50", "100", "150", "200", "300", "500"];
  
  // Capturar ticks diretamente da Deriv
  useEffect(() => {
    setIsLoading(true);
    console.log('[PercentageStatsDisplay] Inicializando captura de ticks direto da Deriv');
    
    // Monitorar os ticks via oauthDirectService
    const handleTick = (event: any) => {
      if (event.type === 'tick' && typeof event.lastDigit === 'number') {
        const newDigit = event.lastDigit;
        
        // Salvar o último dígito
        setLastDigit(newDigit);
        setLastUpdated(new Date());
        
        // Adicionar ao início do array e manter apenas os últimos 500 ticks
        setAllTicks(prev => {
          const updated = [newDigit, ...prev].slice(0, 500);
          updateStats(updated, parseInt(selectedCount));
          return updated;
        });
      }
    };
    
    // Registrar ouvinte para os ticks
    oauthDirectService.addEventListener(handleTick);
    
    // Iniciar a inscrição para os ticks
    oauthDirectService.subscribeToTicks(symbol)
      .then(success => {
        if (success) {
          console.log('[PercentageStatsDisplay] Inscrição para ticks realizada com sucesso');
          setIsLoading(false);
        } else {
          console.error('[PercentageStatsDisplay] Falha ao inscrever para ticks');
        }
      })
      .catch(error => {
        console.error('[PercentageStatsDisplay] Erro ao inscrever para ticks:', error);
      });
    
    // Limpar ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleTick);
    };
  }, [symbol]);
  
  // Atualizar estatísticas quando a quantidade selecionada mudar
  useEffect(() => {
    if (allTicks.length > 0) {
      updateStats(allTicks, parseInt(selectedCount));
    }
  }, [selectedCount]);
  
  // Função para atualizar as estatísticas com base nos ticks selecionados
  const updateStats = (ticksData: number[], count: number) => {
    // Garantir que usamos apenas a quantidade solicitada de ticks mais recentes
    const selectedTicks = ticksData.slice(0, count);
    
    // Contar ocorrências de cada dígito
    const counts = Array(10).fill(0);
    selectedTicks.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    });
    
    // Calcular percentuais
    const totalTicks = selectedTicks.length;
    const stats = counts.map((count, digit) => {
      const percentage = totalTicks > 0 ? Math.round((count / totalTicks) * 100) : 0;
      return { digit, count, percentage };
    });
    
    // Atualizar estado
    setDigitStats(stats);
    
    // Verificar se a soma dos percentuais é 100% (ou próximo, devido a arredondamentos)
    const totalPercentage = stats.reduce((sum, stat) => sum + stat.percentage, 0);
    if (Math.abs(totalPercentage - 100) > 5) {
      console.warn(`[PercentageStatsDisplay] Alerta: Total de percentuais (${totalPercentage}%) não está próximo de 100%. Verificar cálculos.`);
    }
    
    // Log para depuração
    console.log(`[PercentageStatsDisplay] Estatísticas atualizadas para ${count} ticks mais recentes:`,
      stats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
  };
  
  // Determinar cor de fundo baseada na porcentagem
  const getPercentageBackgroundStyle = (percentage: number) => {
    if (percentage >= 30) return { width: `${percentage}%`, backgroundColor: '#ef4444' }; // Vermelho (alto)
    if (percentage >= 20) return { width: `${percentage}%`, backgroundColor: '#f59e0b' }; // Âmbar (médio-alto) 
    if (percentage >= 10) return { width: `${percentage}%`, backgroundColor: '#10b981' }; // Verde (médio)
    return { width: `${percentage}%`, backgroundColor: '#6b7280' }; // Cinza (baixo)
  };
  
  // Calcular a variação em relação à média esperada (10%)
  const getVariation = (percentage: number): { value: number, isHigh: boolean } => {
    const variation = percentage - 10; // 10% é a média esperada
    return {
      value: Math.abs(variation),
      isHigh: variation > 0
    };
  };
  
  // Função para determinar a cor baseada na variação
  const getVariationColor = (variation: number, isHigh: boolean): string => {
    if (variation <= 2) return 'text-gray-400'; // Variação pequena
    return isHigh ? 'text-red-400' : 'text-green-400'; // Alta = vermelho, Baixa = verde
  };
  
  // Renderizar a UI
  return (
    <Card className="bg-[#13203a] p-4 shadow-lg border border-[#2a3756]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <div className="h-3 w-3 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
          <span className="text-sm font-medium text-white">Estatísticas de Frequência ({symbol})</span>
        </div>
        <div className="text-xs text-gray-400">
          {isLoading ? (
            <span className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse mr-1"></div>
              Carregando...
            </span>
          ) : (
            <span>
              {lastUpdated?.toLocaleTimeString() || 'Atualizado'} ({allTicks.length} ticks totais)
            </span>
          )}
        </div>
      </div>
      
      {/* Seletor de quantidade de ticks */}
      <div className="mb-4">
        <div className="flex items-center space-x-2">
          <div className="text-xs text-white">Analisar últimos:</div>
          <Select 
            value={selectedCount} 
            onValueChange={setSelectedCount}
          >
            <SelectTrigger className="w-24 h-8 bg-[#1e2c4e] border-[#2a3756] text-white">
              <SelectValue placeholder="Quantidade" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e2c4e] border-[#2a3756] text-white">
              {tickCountOptions.map(option => (
                <SelectItem key={option} value={option}>{option} ticks</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {lastDigit !== null && (
            <div className="ml-auto flex items-center">
              <div className="text-xs text-white mr-2">Último:</div>
              <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold 
                ${lastDigit % 2 === 0 
                  ? (lastDigit === 0 || lastDigit === 5 ? 'bg-amber-500' : 'bg-red-500') 
                  : 'bg-green-500'} 
                text-white`}
              >
                {lastDigit}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Estatísticas percentuais */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 font-medium">Frequência dos últimos {selectedCount} ticks:</div>
        
        {isLoading ? (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={`loading-${i}`} className="relative">
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {digitStats.map(stat => {
              const variation = getVariation(stat.percentage);
              return (
                <div key={`stat-${stat.digit}`} className="relative">
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
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-500">{stat.count}</span>
                    <span className={`text-xs ${getVariationColor(variation.value, variation.isHigh)}`}>
                      {variation.isHigh ? '+' : '-'}{variation.value}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      <Separator className="bg-[#2a3756] mb-4" />
      
      <div className="text-xs text-gray-500">
        Este componente mantém um histórico de até 500 ticks mais recentes capturados diretamente da Deriv.
        Selecione a quantidade desejada para análise estatística das frequências.
      </div>
    </Card>
  );
});