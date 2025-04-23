import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { independentDerivService } from '@/services/independent-deriv-service';
import { 
  BarChart3, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  Ban,
  InfoIcon,
  Percent,
  ArrowDownToLine,
  Gauge,
  ListEnd
} from 'lucide-react';

// Interface para opções de configuração
interface DigitAnalysisProps {
  symbol: string;
  tickCount?: number;
  isActive?: boolean;
  threshold?: number;
  onSignalChange?: (signal: DigitSignal | null) => void;
}

// Interface para estatísticas de dígitos
interface DigitStats {
  [key: number]: {
    count: number;
    percentage: number;
  };
}

// Interface para sinal de entrada
interface DigitSignal {
  type: 'entry' | 'wait';
  message: string;
  frequency: number;
  confidence: 'high' | 'medium' | 'low';
  recommendation?: {
    contractType: string;
    prediction: number;
  };
}

const DigitAnalysis: React.FC<DigitAnalysisProps> = ({
  symbol,
  tickCount = 25,
  isActive = true,
  threshold = 20,
  onSignalChange
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<DigitStats>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [signal, setSignal] = useState<DigitSignal | null>(null);
  
  // Estatísticas dos dígitos 0 e 1 combinados (usado pela estratégia Advance)
  const zeroOneFrequency = useMemo(() => {
    const zeroCount = digitStats[0]?.count || 0;
    const oneCount = digitStats[1]?.count || 0;
    const total = ticks.length;
    
    if (total === 0) return 0;
    return ((zeroCount + oneCount) / total) * 100;
  }, [digitStats, ticks.length]);
  
  // Decidir se há sinal de entrada baseado na frequência de 0-1
  useEffect(() => {
    // Só gerar sinais se tivermos dados suficientes
    if (ticks.length >= tickCount && isActive) {
      let newSignal: DigitSignal | null = null;
      
      if (zeroOneFrequency < threshold) {
        // Sinal de entrada positivo
        newSignal = {
          type: 'entry',
          message: t('A frequência dos dígitos 0 e 1 está abaixo do limiar de {{threshold}}%. Recomendação para entrada DIGITOVER com previsão 1.', { threshold }),
          frequency: zeroOneFrequency,
          confidence: zeroOneFrequency < threshold/2 ? 'high' : 'medium',
          recommendation: {
            contractType: 'DIGITOVER',
            prediction: 1
          }
        };
      } else {
        // Estamos em modo de espera
        newSignal = {
          type: 'wait',
          message: t('A frequência atual dos dígitos 0 e 1 é {{frequency}}%. Aguarde até que esteja abaixo de {{threshold}}%.', { 
            frequency: zeroOneFrequency.toFixed(1),
            threshold 
          }),
          frequency: zeroOneFrequency,
          confidence: 'low'
        };
      }
      
      setSignal(newSignal);
      
      // Notificar componente pai, se necessário
      if (onSignalChange) {
        onSignalChange(newSignal);
      }
    }
  }, [zeroOneFrequency, threshold, ticks.length, tickCount, isActive, t, onSignalChange]);
  
  // Função para calcular estatísticas de dígitos
  const calculateDigitStats = (ticksData: number[]): DigitStats => {
    const stats: DigitStats = {};
    const total = ticksData.length;
    
    // Inicializar contadores
    for (let i = 0; i <= 9; i++) {
      stats[i] = { count: 0, percentage: 0 };
    }
    
    // Contar ocorrências
    ticksData.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        stats[digit].count++;
      }
    });
    
    // Calcular percentuais
    if (total > 0) {
      for (let i = 0; i <= 9; i++) {
        stats[i].percentage = (stats[i].count / total) * 100;
      }
    }
    
    return stats;
  };
  
  // Função para obter último dígito de um número
  const getLastDigit = (value: number): number => {
    const strValue = value.toString();
    return parseInt(strValue[strValue.length - 1]);
  };
  
  // Registrar para receber ticks
  useEffect(() => {
    if (!isActive) return;
    
    setLoading(true);
    setError(null);
    
    // Registrar para mudanças de estado de conexão
    const unsubscribeConnection = independentDerivService.onStateChange((connected) => {
      setIsConnected(connected);
      
      if (!connected) {
        setError(t('Conexão perdida com o servidor. Tentando reconectar...'));
      } else {
        setError(null);
      }
    });
    
    // Registrar para receber erros
    const unsubscribeError = independentDerivService.onError((err) => {
      setError(err.message || t('Erro na conexão com o servidor Deriv'));
    });
    
    // Buscar histórico inicial de ticks
    const loadInitialData = async () => {
      try {
        const history = await independentDerivService.getTickHistory(symbol, {
          count: tickCount
        });
        
        if (Array.isArray(history?.prices)) {
          // Extrair últimos dígitos
          const digits = history.prices.map((price: number) => getLastDigit(price));
          setTicks(digits);
          setDigitStats(calculateDigitStats(digits));
          setError(null);
        }
      } catch (err: any) {
        console.error('Erro ao buscar histórico de ticks:', err);
        setError(err.message || t('Falha ao buscar dados de mercado'));
      } finally {
        setLoading(false);
      }
    };
    
    // Iniciar assinatura de ticks em tempo real
    let ticksUnsubscribe: (() => Promise<void>) | null = null;
    
    const setupTicksSubscription = async () => {
      try {
        // Desinscrever de assinatura anterior, se existir
        if (ticksUnsubscribe) {
          await ticksUnsubscribe();
        }
        
        // Assinar para novos ticks
        ticksUnsubscribe = await independentDerivService.subscribeToTicks(symbol, (data) => {
          if (data?.tick?.quote) {
            const digit = getLastDigit(data.tick.quote);
            
            // Adicionar novo tick e manter apenas os últimos 'tickCount'
            setTicks(prevTicks => {
              const newTicks = [...prevTicks, digit].slice(-tickCount);
              // Recalcular estatísticas
              setDigitStats(calculateDigitStats(newTicks));
              return newTicks;
            });
          }
        });
      } catch (err: any) {
        console.error('Erro ao assinar ticks:', err);
        setError(err.message || t('Falha ao assinar atualizações de mercado'));
      }
    };
    
    // Inicializar dados e assinaturas
    loadInitialData().then(() => {
      if (isConnected) {
        setupTicksSubscription();
      }
    });
    
    // Limpeza ao desmontar ou mudar de símbolo
    return () => {
      unsubscribeConnection();
      unsubscribeError();
      
      if (ticksUnsubscribe) {
        ticksUnsubscribe().catch(err => {
          console.error('Erro ao cancelar assinatura de ticks:', err);
        });
      }
    };
  }, [symbol, isActive, tickCount, t, isConnected]);
  
  // Obter dígitos mais e menos frequentes
  const mostFrequentDigits = useMemo(() => {
    return Object.entries(digitStats)
      .map(([digit, stats]) => ({ digit: parseInt(digit), ...stats }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [digitStats]);
  
  const leastFrequentDigits = useMemo(() => {
    return Object.entries(digitStats)
      .map(([digit, stats]) => ({ digit: parseInt(digit), ...stats }))
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3);
  }, [digitStats]);
  
  // Agrupar dígitos para exibição
  const lowerDigits = useMemo(() => {
    return [0, 1, 2, 3, 4].map(digit => ({
      digit,
      ...digitStats[digit]
    }));
  }, [digitStats]);
  
  const higherDigits = useMemo(() => {
    return [5, 6, 7, 8, 9].map(digit => ({
      digit,
      ...digitStats[digit]
    }));
  }, [digitStats]);
  
  // Componente para mostrar barras de estatísticas de dígitos
  const DigitStatsDisplay = ({ items }: { items: { digit: number; count: number; percentage: number }[] }) => (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.digit} className="space-y-1">
          <div className="flex justify-between text-xs">
            <span className="font-medium">{item.digit}</span>
            <span className="text-muted-foreground">{item.count}x ({item.percentage.toFixed(1)}%)</span>
          </div>
          <Progress
            value={item.percentage}
            max={100}
            className={`h-2 ${getProgressColorClass(item.percentage)}`}
          />
        </div>
      ))}
    </div>
  );
  
  // Obter cor da barra de progresso baseado no valor
  const getProgressColorClass = (value: number): string => {
    if (value > 30) return 'bg-green-500';
    if (value > 20) return 'bg-blue-500';
    if (value > 10) return 'bg-amber-500';
    return 'bg-red-500';
  };
  
  return (
    <Tabs defaultValue="statistics" className="h-full flex flex-col">
      <TabsList className="grid grid-cols-3">
        <TabsTrigger value="statistics" className="flex items-center gap-1">
          <BarChart3 className="h-4 w-4" />
          {t('Análise')}
        </TabsTrigger>
        <TabsTrigger value="sequence" className="flex items-center gap-1">
          <ListEnd className="h-4 w-4" />
          {t('Sequência')}
        </TabsTrigger>
        <TabsTrigger value="signals" className="flex items-center gap-1">
          <Gauge className="h-4 w-4" />
          {t('Sinais')}
        </TabsTrigger>
      </TabsList>
      
      {/* Tab de Estatísticas */}
      <TabsContent value="statistics" className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
            <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">{t('Coletando dados de mercado...')}</p>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('Erro')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm font-medium">{t('Dígitos 0-4')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  <DigitStatsDisplay items={lowerDigits} />
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm font-medium">{t('Dígitos 5-9')}</CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1">
                  <DigitStatsDisplay items={higherDigits} />
                </CardContent>
              </Card>
            </div>
            
            <Card>
              <CardHeader className="p-3 pb-2">
                <CardTitle className="text-sm font-medium flex items-center">
                  <Percent className="h-4 w-4 mr-1" />
                  {t('Frequência 0-1')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>
                      {t('Atual')}: <span className="font-semibold">{zeroOneFrequency.toFixed(1)}%</span>
                    </span>
                    <span>
                      {t('Limiar')}: <span className="font-semibold">{threshold}%</span>
                    </span>
                  </div>
                  <Progress
                    value={zeroOneFrequency}
                    max={100}
                    className={`h-3 ${zeroOneFrequency < threshold ? 'bg-green-500' : 'bg-amber-500'}`}
                  />
                  
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="font-medium">{t('Status')}:</span>
                    {zeroOneFrequency < threshold ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {t('Pronto para entrada!')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-600">
                        <Clock className="h-3 w-3 mr-1" />
                        {t('Aguardando...')}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div>
              <h3 className="text-sm font-medium mb-2">{t('Informações do Mercado')}</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-muted-foreground">{t('Símbolo')}:</span>{' '}
                  <span className="font-medium">{symbol}</span>
                </div>
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-muted-foreground">{t('Ticks analisados')}:</span>{' '}
                  <span className="font-medium">{ticks.length}/{tickCount}</span>
                </div>
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-muted-foreground">{t('Ativo')}:</span>{' '}
                  <span className="font-medium">{isActive ? t('Sim') : t('Não')}</span>
                </div>
                <div className="bg-muted p-2 rounded-md">
                  <span className="text-muted-foreground">{t('Conectado')}:</span>{' '}
                  <span className="font-medium">{isConnected ? t('Sim') : t('Não')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
      
      {/* Tab de Sequência */}
      <TabsContent value="sequence" className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
            <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">{t('Coletando dados de mercado...')}</p>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('Erro')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-6 pt-2">
            <div>
              <h3 className="text-sm font-medium mb-2">
                {t('Últimos Dígitos ({count})', { count: ticks.length })}
              </h3>
              <div className="flex flex-wrap gap-1">
                {ticks.map((digit, index) => (
                  <div 
                    key={index} 
                    className={`w-8 h-8 rounded-md flex items-center justify-center font-semibold text-sm
                      ${digit <= 4 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                                     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`
                    }
                  >
                    {digit}
                  </div>
                ))}
                {ticks.length === 0 && (
                  <div className="text-muted-foreground italic">{t('Nenhum dado disponível')}</div>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2">{t('Dígitos Mais Frequentes')}</h3>
                <div className="space-y-1">
                  {mostFrequentDigits.map(({ digit, count, percentage }) => (
                    <div key={digit} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-semibold text-xs mr-2
                          ${digit <= 4 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                                         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`
                        }>
                          {digit}
                        </div>
                        <span className="text-sm">{t('Dígito')} {digit}</span>
                      </div>
                      <span className="text-sm font-medium">{percentage.toFixed(1)}% ({count}x)</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium mb-2">{t('Dígitos Menos Frequentes')}</h3>
                <div className="space-y-1">
                  {leastFrequentDigits.map(({ digit, count, percentage }) => (
                    <div key={digit} className="flex items-center justify-between p-2 bg-muted rounded-md">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center font-semibold text-xs mr-2
                          ${digit <= 4 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                                         'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`
                        }>
                          {digit}
                        </div>
                        <span className="text-sm">{t('Dígito')} {digit}</span>
                      </div>
                      <span className="text-sm font-medium">{percentage.toFixed(1)}% ({count}x)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </TabsContent>
      
      {/* Tab de Sinais */}
      <TabsContent value="signals" className="flex-1 flex flex-col">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
            <Clock className="h-10 w-10 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground">{t('Coletando dados de mercado...')}</p>
          </div>
        ) : error ? (
          <Alert variant="destructive" className="my-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('Erro')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !signal ? (
          <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
            <Ban className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">{t('Dados insuficientes para gerar sinais')}</p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            <Alert variant={signal.type === 'entry' ? 'default' : 'outline'} className="border-2">
              <div className="flex flex-col">
                <AlertTitle className="mb-2">
                  {signal.type === 'entry' ? (
                    <div className="flex items-center text-primary">
                      <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
                      {t('Sinal de Entrada Detectado!')}
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-amber-500" />
                      {t('Aguardando Condições de Entrada')}
                    </div>
                  )}
                </AlertTitle>
                <AlertDescription className="text-sm">
                  {signal.message}
                </AlertDescription>
              </div>
            </Alert>
            
            <Card>
              <CardHeader className="p-3 pb-1">
                <CardTitle className="text-sm font-medium">{t('Estratégia Advance')}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-1">
                <p className="text-sm text-muted-foreground mb-4">
                  {t('Esta estratégia monitora a frequência dos dígitos 0 e 1 nos últimos {count} ticks. Quando a frequência combinada desses dígitos cai abaixo de 20%, há uma maior probabilidade do próximo dígito ser maior que 1.', { count: tickCount })}
                </p>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('Frequência 0-1')}</span>
                      <span className={`font-medium ${zeroOneFrequency < threshold ? 'text-green-600' : 'text-amber-600'}`}>
                        {zeroOneFrequency.toFixed(1)}%
                      </span>
                    </div>
                    <Progress
                      value={zeroOneFrequency}
                      max={100}
                      className={`h-3 ${zeroOneFrequency < threshold ? 'bg-green-500' : 'bg-amber-500'}`}
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{t('Limiar de Frequência')}</span>
                      <span className="font-medium">{threshold}%</span>
                    </div>
                    <Progress
                      value={threshold}
                      max={100}
                      className="h-3 bg-blue-500"
                    />
                  </div>
                </div>
                
                <Separator className="my-4" />
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-2 rounded-md">
                    <span className="text-muted-foreground">{t('Confiança')}:</span>{' '}
                    <span className="font-medium">
                      {signal.confidence === 'high' ? t('Alta') : 
                       signal.confidence === 'medium' ? t('Média') : t('Baixa')}
                    </span>
                  </div>
                  
                  <div className="bg-muted p-2 rounded-md">
                    <span className="text-muted-foreground">{t('Símbolo')}:</span>{' '}
                    <span className="font-medium">{symbol}</span>
                  </div>
                  
                  {signal.recommendation && (
                    <>
                      <div className="bg-muted p-2 rounded-md">
                        <span className="text-muted-foreground">{t('Tipo')}:</span>{' '}
                        <span className="font-medium">{signal.recommendation.contractType}</span>
                      </div>
                      
                      <div className="bg-muted p-2 rounded-md">
                        <span className="text-muted-foreground">{t('Previsão')}:</span>{' '}
                        <span className="font-medium">{signal.recommendation.prediction}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default DigitAnalysis;