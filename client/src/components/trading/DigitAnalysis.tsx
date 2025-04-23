import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { oauthDirectService } from '@/services/oauthDirectService';
import { 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  Hash, 
  BarChart, 
  PieChart,
  Clock,
  Loader2
} from 'lucide-react';

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'neutral';
}

interface DigitAnalysisProps {
  symbol: string;
  tickCount?: number;
  onDigitAnalysisComplete?: (stats: DigitStat[]) => void;
  isActive?: boolean;
}

const DigitAnalysis: React.FC<DigitAnalysisProps> = ({
  symbol,
  tickCount = 25,
  onDigitAnalysisComplete,
  isActive = true
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [digits, setDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<DigitStat[]>([]);
  const [tickCounter, setTickCounter] = useState(0);
  const [lastTick, setLastTick] = useState<{value: number, timestamp: number} | null>(null);
  const [activeTab, setActiveTab] = useState('chart');

  // Processar novo tick e atualizar estatísticas
  const processTick = (tick: any) => {
    if (!tick || !tick.tick) return;
    
    const value = tick.tick.quote;
    const timestamp = tick.tick.epoch;
    
    // Extrai o último dígito (formato específico para índices sintéticos como R_100)
    const valueStr = value.toFixed(2);
    const lastDigit = parseInt(valueStr.charAt(valueStr.length - 1));
    
    // Atualizar último tick
    setLastTick({ value, timestamp });
    
    // Atualizar lista de dígitos (manter apenas os últimos N)
    setDigits(prevDigits => {
      const newDigits = [...prevDigits, lastDigit];
      if (newDigits.length > tickCount) {
        return newDigits.slice(newDigits.length - tickCount);
      }
      return newDigits;
    });
    
    // Atualizar contador
    setTickCounter(prev => prev + 1);
  };

  // Calcular estatísticas para cada dígito (0-9)
  useEffect(() => {
    if (!digits.length) return;
    
    // Contagem para cada dígito
    const counts = Array(10).fill(0);
    digits.forEach(digit => {
      counts[digit]++;
    });
    
    // Calcular porcentagens e determinar tendência
    const stats = counts.map((count, digit) => {
      // Tendência baseada na média esperada (10%)
      const percentage = digits.length ? (count / digits.length) * 100 : 0;
      let trend: 'up' | 'down' | 'neutral' = 'neutral';
      
      if (percentage > 12) trend = 'up';
      else if (percentage < 8) trend = 'down';
      
      return {
        digit,
        count,
        percentage,
        trend
      };
    });
    
    setDigitStats(stats);
    
    // Notificar componente pai se callback fornecido
    if (onDigitAnalysisComplete) {
      onDigitAnalysisComplete(stats);
    }
  }, [digits, onDigitAnalysisComplete]);

  // Carregar histórico de ticks ao iniciar e assinar para novos ticks
  useEffect(() => {
    if (!symbol || !isActive) return;
    
    const loadHistoryAndSubscribe = async () => {
      setIsLoading(true);
      setDigits([]);
      setTickCounter(0);
      
      try {
        // Carregar histórico inicial
        const history = await oauthDirectService.getTicksHistory(symbol, tickCount);
        
        if (history && history.prices) {
          // Extrair últimos dígitos do histórico
          const initialDigits = history.prices.map((price: number) => {
            const valueStr = price.toFixed(2);
            return parseInt(valueStr.charAt(valueStr.length - 1));
          });
          
          setDigits(initialDigits);
          setTickCounter(initialDigits.length);
        }
        
        // Assinar para receber novos ticks
        oauthDirectService.subscribeTicks(symbol, processTick);
      } catch (error) {
        console.error('Erro ao carregar histórico de ticks:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadHistoryAndSubscribe();
    
    // Limpar ao desmontar
    return () => {
      if (symbol) {
        oauthDirectService.unsubscribeTicks(symbol, processTick);
      }
    };
  }, [symbol, tickCount, isActive]);

  // Renderiza o gráfico de barras de dígitos
  const renderDigitBars = () => {
    return (
      <div className="space-y-3">
        {digitStats.map(stat => (
          <div key={stat.digit} className="flex items-center space-x-2">
            <div className="w-6 text-center font-bold">{stat.digit}</div>
            <div className="flex-1">
              <Progress 
                value={stat.percentage} 
                max={100}
                className={`h-6 ${
                  stat.trend === 'up' ? 'bg-slate-200 dark:bg-slate-800' : 
                  stat.trend === 'down' ? 'bg-slate-200 dark:bg-slate-800' : 
                  'bg-slate-100 dark:bg-slate-900'
                }`}
              />
            </div>
            <div className="w-12 text-right font-mono">
              {stat.percentage.toFixed(1)}%
            </div>
            <div className="w-6 text-center">
              {stat.trend === 'up' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : stat.trend === 'down' ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Renderiza círculos de últimos dígitos
  const renderDigitSequence = () => {
    return (
      <div>
        <div className="flex flex-wrap gap-2 mt-2">
          {digits.slice().reverse().map((digit, idx) => {
            // Determinar cor baseada na estatística desse dígito
            const stat = digitStats.find(s => s.digit === digit);
            const colorClass = 
              stat?.trend === 'up' ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-100' : 
              stat?.trend === 'down' ? 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-100' : 
              'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-100';
            
            return (
              <div 
                key={`${digit}-${idx}`} 
                className={`w-8 h-8 flex items-center justify-center rounded-full border ${colorClass} font-bold`}
              >
                {digit}
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 text-sm text-muted-foreground">
          {t('Últimos {{count}} dígitos de {{symbol}}', { count: digits.length, symbol })}
        </div>
      </div>
    );
  };

  // Renderiza estatísticas resumidas
  const renderSummaryStats = () => {
    // Calcular total para dígitos 0-1
    const lowDigitsStats = digitStats.filter(s => s.digit <= 1);
    const lowDigitsPercentage = lowDigitsStats.reduce((total, stat) => total + stat.percentage, 0);
    
    // Calcular total para dígitos 2-9
    const highDigitsStats = digitStats.filter(s => s.digit >= 2);
    const highDigitsPercentage = highDigitsStats.reduce((total, stat) => total + stat.percentage, 0);
    
    return (
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-sm flex items-center">
              <Hash className="h-4 w-4 mr-1" />
              {t('Dígitos 0-1')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="text-2xl font-bold">
              {lowDigitsPercentage.toFixed(1)}%
            </div>
            <div className="flex mt-1 items-center">
              <Progress value={lowDigitsPercentage} className="flex-1 h-2" />
              {lowDigitsPercentage > 20 ? (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {t('Alto')}
                </Badge>
              ) : lowDigitsPercentage < 20 ? (
                <Badge variant="default" className="ml-2 text-xs">
                  {t('Baixo')}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="p-3">
            <CardTitle className="text-sm flex items-center">
              <Hash className="h-4 w-4 mr-1" />
              {t('Dígitos 2-9')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="text-2xl font-bold">
              {highDigitsPercentage.toFixed(1)}%
            </div>
            <div className="flex mt-1 items-center">
              <Progress value={highDigitsPercentage} className="flex-1 h-2" />
              {highDigitsPercentage > 80 ? (
                <Badge variant="default" className="ml-2 text-xs">
                  {t('Alto')}
                </Badge>
              ) : highDigitsPercentage < 80 ? (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {t('Baixo')}
                </Badge>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle>{t('Análise de Dígitos')}</CardTitle>
        <CardDescription className="flex justify-between items-center">
          <span>{t('Frequência e distribuição')}</span>
          <div className="flex items-center text-xs text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            <span>{digits.length}/{tickCount}</span>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-2">{t('Carregando dados...')}</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="chart">
                <BarChart className="h-4 w-4 mr-2" />
                {t('Gráfico')}
              </TabsTrigger>
              <TabsTrigger value="sequence">
                <Hash className="h-4 w-4 mr-2" />
                {t('Sequência')}
              </TabsTrigger>
              <TabsTrigger value="stats">
                <Percent className="h-4 w-4 mr-2" />
                {t('Estatísticas')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="chart">
              {renderDigitBars()}
            </TabsContent>
            
            <TabsContent value="sequence">
              {renderDigitSequence()}
            </TabsContent>
            
            <TabsContent value="stats">
              {renderSummaryStats()}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default DigitAnalysis;