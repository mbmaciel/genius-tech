import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid, BarChart, Activity } from "lucide-react";
import { derivHistoryService } from '@/services/deriv-history-service';

interface TickHistoryProps {
  symbol?: string;
  className?: string;
}

interface TickData {
  quote: number;
  digit: number;
  timestamp: number;
}

// Visualização em grid dos dígitos
function GridView({ ticks }: { ticks: TickData[] }) {
  return (
    <div className="max-h-[200px] overflow-y-auto">
      <div className="grid grid-cols-10 gap-1 p-2">
        {ticks.map((tick, index) => (
          <div 
            key={index} 
            className={`
              aspect-square flex items-center justify-center rounded-md text-xs font-semibold
              ${tick.digit === 0 ? 'bg-violet-600' : ''}
              ${tick.digit === 1 ? 'bg-blue-600' : ''}
              ${tick.digit === 2 ? 'bg-cyan-600' : ''}
              ${tick.digit === 3 ? 'bg-teal-600' : ''}
              ${tick.digit === 4 ? 'bg-green-600' : ''}
              ${tick.digit === 5 ? 'bg-lime-600' : ''}
              ${tick.digit === 6 ? 'bg-yellow-600' : ''}
              ${tick.digit === 7 ? 'bg-amber-600' : ''}
              ${tick.digit === 8 ? 'bg-orange-600' : ''}
              ${tick.digit === 9 ? 'bg-red-600' : ''}
              hover:opacity-90 transition-opacity
            `}
            title={`${tick.quote} (${new Date(tick.timestamp).toLocaleTimeString()})`}
          >
            {tick.digit}
          </div>
        ))}
      </div>
    </div>
  );
}

// Visualização linear dos dígitos
function LineView({ ticks }: { ticks: TickData[] }) {
  // Determinar altura máxima para escala
  const max = Math.max(...ticks.map(t => t.quote));
  const min = Math.min(...ticks.map(t => t.quote));
  const range = max - min;
  const scale = 150 / (range || 1); // altura máxima de 150px

  return (
    <div className="relative h-[200px] w-full overflow-hidden p-2">
      <div className="flex items-end h-full">
        {ticks.map((tick, index) => {
          const height = ((tick.quote - min) * scale) || 1;
          return (
            <div 
              key={index}
              className="relative flex-grow h-full flex flex-col justify-end"
              style={{ minWidth: `${100 / Math.min(ticks.length, 100)}%` }}
            >
              <div 
                className={`
                  w-full rounded-t-sm cursor-pointer
                  ${tick.digit === 0 ? 'bg-violet-600' : ''}
                  ${tick.digit === 1 ? 'bg-blue-600' : ''}
                  ${tick.digit === 2 ? 'bg-cyan-600' : ''}
                  ${tick.digit === 3 ? 'bg-teal-600' : ''}
                  ${tick.digit === 4 ? 'bg-green-600' : ''}
                  ${tick.digit === 5 ? 'bg-lime-600' : ''}
                  ${tick.digit === 6 ? 'bg-yellow-600' : ''}
                  ${tick.digit === 7 ? 'bg-amber-600' : ''}
                  ${tick.digit === 8 ? 'bg-orange-600' : ''}
                  ${tick.digit === 9 ? 'bg-red-600' : ''}
                  hover:opacity-90 transition-opacity
                `}
                style={{ height: `${height}px` }}
                title={`${tick.quote} (${new Date(tick.timestamp).toLocaleTimeString()})`}
              >
                <div className="text-[8px] text-white font-bold text-center">
                  {tick.digit}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Visualização estatística dos dígitos
function StatsView({ ticks }: { ticks: TickData[] }) {
  // Calcular estatísticas de distribuição dos dígitos
  const digitCount = Array(10).fill(0);
  ticks.forEach(tick => {
    digitCount[tick.digit]++;
  });
  
  const digitPercentage = digitCount.map(count => 
    Math.round((count / ticks.length) * 100)
  );
  
  // Encontrar tendências
  const getColorForTrend = (percentage: number) => {
    if (percentage >= 15) return 'text-green-500'; // Alta frequência
    if (percentage <= 5) return 'text-red-500';   // Baixa frequência
    return 'text-gray-400';                        // Frequência média
  };
  
  return (
    <div className="p-4">
      <div className="grid grid-cols-10 gap-2">
        {digitPercentage.map((percentage, digit) => (
          <div key={digit} className="flex flex-col items-center">
            <div className={`text-lg font-bold ${getColorForTrend(percentage)}`}>
              {digit}
            </div>
            <div className="h-[120px] w-6 bg-gray-800 rounded-full relative overflow-hidden">
              <div 
                className={`
                  absolute bottom-0 left-0 right-0 
                  ${digit === 0 ? 'bg-violet-600' : ''}
                  ${digit === 1 ? 'bg-blue-600' : ''}
                  ${digit === 2 ? 'bg-cyan-600' : ''}
                  ${digit === 3 ? 'bg-teal-600' : ''}
                  ${digit === 4 ? 'bg-green-600' : ''}
                  ${digit === 5 ? 'bg-lime-600' : ''}
                  ${digit === 6 ? 'bg-yellow-600' : ''}
                  ${digit === 7 ? 'bg-amber-600' : ''}
                  ${digit === 8 ? 'bg-orange-600' : ''}
                  ${digit === 9 ? 'bg-red-600' : ''}
                  rounded-b-full
                `}
                style={{ height: `${percentage}%` }}
              />
            </div>
            <div className="text-xs mt-1">{percentage}%</div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-sm text-gray-400">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-green-500 font-semibold">●</span> Alta frequência (&gt;15%)
          </div>
          <div>
            <span className="text-red-500 font-semibold">●</span> Baixa frequência (&lt;5%)
          </div>
        </div>
      </div>
    </div>
  );
}

export function TickHistoryDisplay({ symbol = 'R_100', className = '' }: TickHistoryProps) {
  const [ticks, setTicks] = useState<TickData[]>([]);
  const [activeTab, setActiveTab] = useState<string>('grid');
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Carregar histórico de ticks
  useEffect(() => {
    const loadHistory = async () => {
      try {
        setIsLoading(true);
        
        // Buscar histórico de 500 ticks
        const history = await derivHistoryService.getTicksHistory(symbol, 500, true);
        
        // Transformar para o formato usado pelo componente
        const tickData: TickData[] = history.map((tick: any) => ({
          quote: tick.quote,
          digit: parseInt(tick.quote.toString().slice(-1)),
          timestamp: tick.epoch * 1000
        }));
        
        setTicks(tickData);
        setIsLoading(false);
      } catch (error) {
        console.error('Erro ao carregar histórico de ticks:', error);
        setIsLoading(false);
      }
    };
    
    loadHistory();
    
    // Configurar um intervalo para atualizar os dados
    const interval = window.setInterval(() => {
      loadHistory();
    }, 5000);
    
    setRefreshInterval(interval);
    
    // Limpar o intervalo ao desmontar
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [symbol]);
  
  // Configurar listener para novos ticks
  useEffect(() => {
    const handleTickUpdate = (event: CustomEvent) => {
      const tick = event.detail.tick;
      
      if (tick && tick.symbol === symbol) {
        const newTick: TickData = {
          quote: tick.quote,
          digit: parseInt(tick.quote.toString().slice(-1)),
          timestamp: tick.epoch * 1000
        };
        
        setTicks(prevTicks => {
          const newTicks = [newTick, ...prevTicks.slice(0, 499)];
          return newTicks;
        });
      }
    };
    
    // Adicionar listener
    document.addEventListener('deriv:tick' as any, handleTickUpdate as any);
    
    // Remover listener ao desmontar
    return () => {
      document.removeEventListener('deriv:tick' as any, handleTickUpdate as any);
    };
  }, [symbol]);
  
  return (
    <Card className={`bg-[#162440] rounded-lg border border-slate-800 ${className}`}>
      <CardContent className="p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-between items-center mb-4">
            <TabsList className="bg-[#0e1a33] border border-[#1c3654]">
              <TabsTrigger value="grid" className="data-[state=active]:bg-[#1c3654]">
                <Grid className="h-4 w-4 mr-1" />
                Grid
              </TabsTrigger>
              <TabsTrigger value="line" className="data-[state=active]:bg-[#1c3654]">
                <Activity className="h-4 w-4 mr-1" />
                Linear
              </TabsTrigger>
              <TabsTrigger value="stats" className="data-[state=active]:bg-[#1c3654]">
                <BarChart className="h-4 w-4 mr-1" />
                Estatísticas
              </TabsTrigger>
            </TabsList>
            
            <div className="text-sm text-[#8492b4]">
              {isLoading ? 'Carregando...' : `${ticks.length} ticks`}
            </div>
          </div>
          
          <TabsContent value="grid" className="mt-0">
            {ticks.length > 0 ? (
              <GridView ticks={ticks} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[#8492b4]">
                {isLoading ? 'Carregando ticks...' : 'Nenhum dado disponível'}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="line" className="mt-0">
            {ticks.length > 0 ? (
              <LineView ticks={ticks.slice(0, 100)} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[#8492b4]">
                {isLoading ? 'Carregando ticks...' : 'Nenhum dado disponível'}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stats" className="mt-0">
            {ticks.length > 0 ? (
              <StatsView ticks={ticks} />
            ) : (
              <div className="h-[200px] flex items-center justify-center text-[#8492b4]">
                {isLoading ? 'Carregando ticks...' : 'Nenhum dado disponível'}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}