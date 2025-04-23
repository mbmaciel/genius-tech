import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Ban,
  BarChart3,
  Check,
  X,
  ArrowDown,
  ArrowUp,
  MoreHorizontal,
  Trash2,
  Medal,
  AlertTriangle,
  Clock
} from 'lucide-react';

// Tipo para uma operação
interface Operation {
  id: string | number;
  contract_id: string | number;
  entry_value: number;
  exit_value?: number;
  profit?: number;
  is_win?: boolean;
  time: Date;
  timestamp: number;
  contract_type: string;
  symbol: string;
  strategy: string;
  notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  };
}

// Tipo para estatísticas de operações
interface OperationStats {
  totalOperations: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  bestStreak: number;
  worstStreak: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

// Função para calcular estatísticas
function calculateStats(operations: Operation[]): OperationStats {
  const completedOperations = operations.filter(op => op.exit_value !== undefined);
  const wins = completedOperations.filter(op => op.is_win).length;
  const losses = completedOperations.filter(op => op.is_win === false).length;
  const winRate = completedOperations.length > 0 
    ? (wins / completedOperations.length) * 100 
    : 0;
  
  // Cálculo de streak (sequência de vitórias/derrotas)
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let bestStreak = 0;
  let worstStreak = 0;
  let consecutiveWins = 0;
  let consecutiveLosses = 0;
  
  // Ordenar operações por timestamp
  const sortedOps = [...completedOperations].sort((a, b) => a.timestamp - b.timestamp);
  
  for (const op of sortedOps) {
    if (op.is_win) {
      currentWinStreak++;
      currentLossStreak = 0;
      bestStreak = Math.max(bestStreak, currentWinStreak);
    } else if (op.is_win === false) {
      currentLossStreak++;
      currentWinStreak = 0;
      worstStreak = Math.max(worstStreak, currentLossStreak);
    }
  }
  
  // Verifica a streak atual
  consecutiveWins = currentWinStreak;
  consecutiveLosses = currentLossStreak;
  
  // Cálculo do lucro total
  const totalProfit = completedOperations.reduce((sum, op) => sum + (op.profit || 0), 0);
  
  return {
    totalOperations: completedOperations.length,
    wins,
    losses,
    winRate,
    totalProfit,
    bestStreak,
    worstStreak,
    consecutiveWins,
    consecutiveLosses
  };
}

// Props do componente
interface OperationHistoryCardProps {
  operations: Operation[];
  onClearHistory?: () => void;
  isRunning?: boolean;
}

// Componente OperationHistoryCard
const OperationHistoryCard: React.FC<OperationHistoryCardProps> = ({
  operations,
  onClearHistory,
  isRunning = false
}) => {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<OperationStats>({
    totalOperations: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    bestStreak: 0,
    worstStreak: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  });
  
  // Atualizar estatísticas quando as operações mudarem
  useEffect(() => {
    setStats(calculateStats(operations));
  }, [operations]);
  
  // Formatar valor monetário
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Formatar data
  const formatDate = (date: Date) => {
    return format(date, 'dd/MM/yyyy HH:mm:ss', {
      locale: i18n.language === 'pt-BR' ? ptBR : enUS
    });
  };
  
  // Renderizar item de operação
  const renderOperationItem = (operation: Operation) => {
    const isOpen = operation.exit_value === undefined;
    const isProfitable = operation.profit !== undefined && operation.profit > 0;
    const isLoss = operation.profit !== undefined && operation.profit < 0;
    
    return (
      <div 
        key={operation.id} 
        className={`p-3 border rounded-md mb-2 ${
          isOpen 
            ? 'bg-muted border-muted-foreground/20'
            : isProfitable 
              ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'
              : isLoss
                ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900' 
                : 'bg-background border-border'
        }`}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex items-center">
            {isOpen ? (
              <Clock className="h-4 w-4 mr-2 text-muted-foreground animate-pulse" />
            ) : operation.is_win ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <X className="h-4 w-4 mr-2 text-red-500" />
            )}
            <div>
              <div className="font-medium">
                {operation.contract_type}
                <Badge 
                  variant="outline" 
                  className="ml-2 text-xs"
                >
                  {operation.symbol}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {t('ID')}: {operation.contract_id.toString().slice(0, 8)}...
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className={`font-medium ${
              isOpen ? '' : isProfitable ? 'text-green-600' : 'text-red-600'
            }`}>
              {isOpen 
                ? t('Em andamento')
                : formatMoney(operation.profit || 0)
              }
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDate(operation.time)}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50 text-sm">
          <div>
            <span className="text-muted-foreground">{t('Estratégia')}:</span>{' '}
            <span className="font-medium">{operation.strategy}</span>
          </div>
          <div>
            <span className="text-muted-foreground">{t('Entrada')}:</span>{' '}
            <span className="font-medium">{formatMoney(operation.entry_value)}</span>
          </div>
          {!isOpen && (
            <>
              <div>
                <span className="text-muted-foreground">{t('Saída')}:</span>{' '}
                <span className="font-medium">{formatMoney(operation.exit_value || 0)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">{t('Resultado')}:</span>{' '}
                <span className={`font-medium ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
                  {isProfitable ? (
                    <span className="flex items-center">
                      <ArrowUp className="h-3 w-3 mr-1" />
                      {operation.is_win ? t('Ganho') : t('Empate')}
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <ArrowDown className="h-3 w-3 mr-1" />
                      {t('Perda')}
                    </span>
                  )}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };
  
  return (
    <Tabs defaultValue="operations" className="h-full flex flex-col">
      <TabsList className="grid grid-cols-2">
        <TabsTrigger value="operations" className="flex items-center gap-1">
          <ClipboardList className="h-4 w-4" />
          {t('Operações')}
        </TabsTrigger>
        <TabsTrigger value="statistics" className="flex items-center gap-1">
          <BarChart3 className="h-4 w-4" />
          {t('Estatísticas')}
        </TabsTrigger>
      </TabsList>
      
      {/* Conteúdo da aba Operações */}
      <TabsContent value="operations" className="flex-1 flex flex-col">
        <div className="flex justify-between mb-4">
          <div className="font-medium text-sm">
            {t('Total')}: {operations.length}
          </div>
          {onClearHistory && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClearHistory} 
              disabled={operations.length === 0 || isRunning}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              {t('Limpar')}
            </Button>
          )}
        </div>
        
        {operations.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <ClipboardList className="h-12 w-12 mb-2 opacity-20" />
            <p>{t('Nenhuma operação realizada')}</p>
            <p className="text-xs">{t('As operações aparecerão aqui quando forem realizadas')}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="pr-4">
              {operations.map(renderOperationItem)}
            </div>
          </ScrollArea>
        )}
      </TabsContent>
      
      {/* Conteúdo da aba Estatísticas */}
      <TabsContent value="statistics" className="flex-1 flex flex-col">
        {stats.totalOperations === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-2 opacity-20" />
            <p>{t('Sem dados para mostrar')}</p>
            <p className="text-xs">{t('Complete operações para ver estatísticas')}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="pr-4 space-y-6">
              {/* Resumo geral */}
              <div>
                <h3 className="text-lg font-medium mb-3">{t('Resumo Geral')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {t('Lucro Total')}
                    </div>
                    <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {formatMoney(stats.totalProfit)}
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Medal className="h-4 w-4 mr-1" />
                      {t('Taxa de Acerto')}
                    </div>
                    <div className="text-2xl font-bold">
                      {stats.winRate.toFixed(1)}%
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Operações */}
              <div>
                <h3 className="text-lg font-medium mb-3">{t('Operações')}</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-sm text-muted-foreground mb-1">
                      {t('Total')}
                    </div>
                    <div className="text-xl font-bold">
                      {stats.totalOperations}
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <Check className="h-3 w-3 mr-1 text-green-500" />
                      {t('Ganhos')}
                    </div>
                    <div className="text-xl font-bold text-green-500">
                      {stats.wins}
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <X className="h-3 w-3 mr-1 text-red-500" />
                      {t('Perdas')}
                    </div>
                    <div className="text-xl font-bold text-red-500">
                      {stats.losses}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sequências */}
              <div>
                <h3 className="text-lg font-medium mb-3">{t('Sequências')}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                      {t('Melhor Sequência')}
                    </div>
                    <div className="text-xl font-bold text-green-500">
                      {stats.bestStreak} {t('ganhos')}
                    </div>
                  </div>
                  
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center text-sm text-muted-foreground mb-1">
                      <TrendingDown className="h-4 w-4 mr-1 text-red-500" />
                      {t('Pior Sequência')}
                    </div>
                    <div className="text-xl font-bold text-red-500">
                      {stats.worstStreak} {t('perdas')}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Sequência atual */}
              <div>
                <h3 className="text-lg font-medium mb-3">{t('Sequência Atual')}</h3>
                <div className="bg-muted p-3 rounded-md">
                  {stats.consecutiveWins > 0 ? (
                    <div className="flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2 text-green-500" />
                      <div>
                        <div className="font-medium">{t('Sequência de Ganhos')}</div>
                        <div className="text-xl font-bold text-green-500">
                          {stats.consecutiveWins} {t('operações')}
                        </div>
                      </div>
                    </div>
                  ) : stats.consecutiveLosses > 0 ? (
                    <div className="flex items-center">
                      <TrendingDown className="h-5 w-5 mr-2 text-red-500" />
                      <div>
                        <div className="font-medium">{t('Sequência de Perdas')}</div>
                        <div className="text-xl font-bold text-red-500">
                          {stats.consecutiveLosses} {t('operações')}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Ban className="h-5 w-5 mr-2 text-muted-foreground" />
                      <div className="font-medium">{t('Sem sequência atual')}</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Alerta para poucas operações */}
              {stats.totalOperations < 10 && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md p-3">
                  <div className="flex items-center text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <div className="font-medium">{t('Aviso')}</div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('Estatísticas podem não ser representativas com menos de 10 operações completas.')}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </TabsContent>
    </Tabs>
  );
};

export default OperationHistoryCard;