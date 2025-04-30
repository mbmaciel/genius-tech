import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart, LineChart, PieChart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface TickHistoryProps {
  symbol?: string;
  className?: string;
}

interface TickData {
  quote: number;
  digit: number;
  timestamp: number;
}

// Componente de Exibição em Grade
function GridView({ ticks }: { ticks: TickData[] }) {
  return (
    <div className="grid grid-cols-10 gap-1 max-h-[300px] overflow-y-auto p-1">
      {ticks.map((tick, index) => {
        // Determinar a cor do dígito baseado em seu valor
        const getDigitColor = (digit: number) => {
          if (digit >= 0 && digit <= 2) return 'bg-red-500/90 text-white';
          if (digit >= 3 && digit <= 6) return 'bg-blue-500/90 text-white';
          return 'bg-green-500/90 text-white';
        };
        
        const digitClass = getDigitColor(tick.digit);
        
        return (
          <div 
            key={index} 
            className={`${digitClass} w-full aspect-square flex items-center justify-center
                        text-lg font-bold rounded-md transition-transform hover:scale-105`}
            title={`Valor: ${tick.quote.toFixed(2)} - Hora: ${new Date(tick.timestamp).toLocaleTimeString()}`}
          >
            {tick.digit}
          </div>
        );
      })}
    </div>
  );
}

// Componente de Visualização Linear
function LineView({ ticks }: { ticks: TickData[] }) {
  const lastTicks = ticks.slice(-100); // Usar os últimos 100 ticks para a visualização linear
  
  // Calcular altura da barra para cada dígito (0-9)
  const maxHeight = 100; // Altura máxima em pixels
  
  return (
    <div className="h-[300px] flex items-end justify-between gap-0.5 p-2">
      {lastTicks.map((tick, index) => {
        // Determinar a cor do dígito baseado em seu valor
        const getDigitColor = (digit: number) => {
          if (digit >= 0 && digit <= 2) return 'bg-red-500/90';
          if (digit >= 3 && digit <= 6) return 'bg-blue-500/90';
          return 'bg-green-500/90';
        };
        
        const height = ((tick.digit + 1) / 10) * maxHeight;
        const digitClass = getDigitColor(tick.digit);
        
        return (
          <div 
            key={index} 
            className="relative flex-1 min-w-1"
            title={`Dígito: ${tick.digit} - Valor: ${tick.quote.toFixed(2)}`}
          >
            <div 
              className={`${digitClass} w-full transition-all duration-300 ease-out rounded-t`}
              style={{ height: `${height}%` }}
            />
            {index % 10 === 0 && (
              <div className="absolute -bottom-6 text-xs text-gray-400">
                {index}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Componente de Estatísticas
function StatsView({ ticks }: { ticks: TickData[] }) {
  // Calcular estatísticas de frequência
  const digitCounts = Array(10).fill(0);
  
  ticks.forEach(tick => {
    digitCounts[tick.digit]++;
  });
  
  const totalTicks = ticks.length;
  
  // Calcular percentagens
  const digitPercentages = digitCounts.map(count => 
    totalTicks > 0 ? ((count / totalTicks) * 100).toFixed(1) : '0.0'
  );
  
  // Encontrar valores máximo e mínimo para destaque
  const maxPercentage = Math.max(...digitPercentages.map(p => parseFloat(p)));
  const minPercentage = Math.min(...digitPercentages.map(p => parseFloat(p)));
  
  // Obter os últimos dígitos para estatísticas recentes
  const lastDigits = ticks.slice(-10).map(t => t.digit).reverse();
  
  return (
    <div className="space-y-4">
      <div className="bg-[#0f172a] p-4 rounded-md">
        <h3 className="font-medium text-blue-400 mb-2">Últimos 10 Dígitos</h3>
        <div className="flex gap-1">
          {lastDigits.map((digit, index) => {
            const getDigitColor = (d: number) => {
              if (d >= 0 && d <= 2) return 'bg-red-500/90 text-white';
              if (d >= 3 && d <= 6) return 'bg-blue-500/90 text-white';
              return 'bg-green-500/90 text-white';
            };
            
            return (
              <div 
                key={index}
                className={`${getDigitColor(digit)} w-8 h-8 flex items-center justify-center
                          font-medium rounded-md ${index === 0 ? 'ring-2 ring-yellow-400' : ''}`}
              >
                {digit}
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, digit) => {
          const percentage = parseFloat(digitPercentages[digit]);
          let badgeClass = 'bg-gray-600';
          
          // Destacar valores máximos e mínimos
          if (percentage === maxPercentage) badgeClass = 'bg-green-600';
          if (percentage === minPercentage) badgeClass = 'bg-red-600';
          
          return (
            <div key={digit} className="bg-[#0f172a] p-3 rounded-md">
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium">{digit}</span>
                <Badge className={badgeClass}>{percentage}%</Badge>
              </div>
              <div className="bg-gray-700 h-2 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${percentage === maxPercentage ? 'bg-green-500' : percentage === minPercentage ? 'bg-red-500' : 'bg-blue-500'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {digitCounts[digit]} de {totalTicks}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TickHistoryDisplay({ symbol = 'R_100', className = '' }: TickHistoryProps) {
  const [tickData, setTickData] = useState<TickData[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'line' | 'stats'>('grid');
  
  useEffect(() => {
    // Função para carregar histórico de ticks do localStorage
    const loadTickHistory = () => {
      try {
        const storedTicks = localStorage.getItem(`ticks_history_${symbol}`);
        if (storedTicks) {
          const parsedTicks = JSON.parse(storedTicks);
          
          if (Array.isArray(parsedTicks) && parsedTicks.length > 0) {
            // Processar ticks para garantir que temos o formato correto
            const processedTicks = parsedTicks.map(tick => ({
              quote: typeof tick.quote === 'number' ? tick.quote : parseFloat(tick.quote),
              digit: typeof tick.quote === 'number' 
                ? parseInt(tick.quote.toFixed(2).slice(-1)) 
                : parseInt(parseFloat(tick.quote).toFixed(2).slice(-1)),
              timestamp: tick.timestamp || Date.now()
            }));
            
            setTickData(processedTicks);
            console.log(`[TICK_HISTORY] Carregados ${processedTicks.length} ticks para ${symbol}`);
          }
        }
      } catch (error) {
        console.error('[TICK_HISTORY] Erro ao carregar histórico de ticks:', error);
      }
    };
    
    // Carregar histórico inicial
    loadTickHistory();
    
    // Adicionar listener para atualizações de ticks
    const handleTickUpdate = () => {
      loadTickHistory();
    };
    
    // Configurar evento personalizado para atualizar quando novos ticks chegarem
    window.addEventListener('tick_history_updated', handleTickUpdate);
    
    // Também atualizar a cada 2 segundos para garantir dados atuais
    const intervalId = setInterval(loadTickHistory, 2000);
    
    return () => {
      window.removeEventListener('tick_history_updated', handleTickUpdate);
      clearInterval(intervalId);
    };
  }, [symbol]);
  
  return (
    <Card className={`${className} bg-[#1a2234] border-gray-700`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg text-blue-500">
            Histórico de Ticks - {symbol}
          </CardTitle>
          <Badge variant="outline" className="font-mono">
            {tickData.length} ticks
          </Badge>
        </div>
      </CardHeader>
      
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)} className="w-full">
        <div className="px-6">
          <TabsList className="grid grid-cols-3 mb-2">
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <BarChart className="h-4 w-4" />
              <span>Grade</span>
            </TabsTrigger>
            <TabsTrigger value="line" className="flex items-center gap-2">
              <LineChart className="h-4 w-4" />
              <span>Linear</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span>Estatísticas</span>
            </TabsTrigger>
          </TabsList>
        </div>
        
        <CardContent>
          <TabsContent value="grid" className="mt-0">
            <GridView ticks={tickData} />
          </TabsContent>
          
          <TabsContent value="line" className="mt-0">
            <LineView ticks={tickData} />
          </TabsContent>
          
          <TabsContent value="stats" className="mt-0">
            <StatsView ticks={tickData} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}