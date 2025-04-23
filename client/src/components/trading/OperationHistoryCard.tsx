import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrendingDown, TrendingUp, List, Table as TableIcon, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { pt, enUS } from 'date-fns/locale';

export interface Operation {
  id: string | number;
  contract_id: string | number;
  entry_value: number;
  exit_value?: number;
  profit?: number;
  time: Date;
  timestamp: number;
  contract_type: string;
  symbol: string;
  strategy: string;
  is_win?: boolean;
  notification: {
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  };
}

interface OperationHistoryCardProps {
  operations: Operation[];
  stats: {
    totalOperations: number;
    wins: number;
    losses: number;
    winRate: number;
    totalProfit: number;
  };
}

const OperationHistoryCard: React.FC<OperationHistoryCardProps> = ({ operations, stats }) => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<'list' | 'table'>('list');
  const dateLocale = i18n.language === 'pt' ? pt : enUS;
  
  // Ordenar operações por timestamp (mais recentes primeiro)
  const sortedOperations = [...operations].sort((a, b) => b.timestamp - a.timestamp);
  
  // Renderizar item de operação no formato de lista
  const renderOperationListItem = (operation: Operation) => {
    // Determinar variante do badge
    let badgeVariant: 'outline' | 'destructive' | 'default' = 'outline';
    if (operation.is_win === true) badgeVariant = 'default';
    if (operation.is_win === false) badgeVariant = 'destructive';
    
    // Formatar valores
    const formattedEntryValue = operation.entry_value.toFixed(2);
    const formattedExitValue = operation.exit_value 
      ? operation.exit_value.toFixed(2) 
      : t('Aguardando');
    
    const formattedProfit = operation.profit !== undefined 
      ? (operation.profit > 0 ? '+' : '') + operation.profit.toFixed(2)
      : '-';
    
    const formattedTime = format(
      new Date(operation.time), 
      'HH:mm:ss', 
      { locale: dateLocale }
    );
    
    return (
      <div 
        key={operation.id} 
        className={`border p-3 rounded-md mb-3 ${
          operation.is_win === true 
            ? 'border-l-4 border-l-green-500' 
            : operation.is_win === false 
              ? 'border-l-4 border-l-red-500' 
              : ''
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <div>
            <div className="font-medium">{operation.contract_type} - {operation.symbol}</div>
            <div className="text-xs text-muted-foreground">{t('ID')}: {operation.contract_id}</div>
          </div>
          
          <Badge variant={badgeVariant} className="ml-2">
            {operation.is_win === true 
              ? t('Ganho') 
              : operation.is_win === false 
                ? t('Perda') 
                : t('Em andamento')}
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-2 mb-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">{t('Entrada')}</div>
            <div>{formattedEntryValue}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('Saída')}</div>
            <div>{formattedExitValue}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t('Lucro')}</div>
            <div className={
              operation.profit 
                ? (operation.profit > 0 ? 'text-green-500' : 'text-red-500') 
                : ''
            }>
              {formattedProfit}
            </div>
          </div>
        </div>
        
        <div className="flex justify-between items-center text-xs text-muted-foreground">
          <div className="flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formattedTime}
          </div>
          
          <div>
            {operation.strategy}
          </div>
        </div>
      </div>
    );
  };
  
  // Renderizar operações em formato de tabela
  const renderOperationsTable = () => {
    return (
      <div className="w-full overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b text-left text-xs font-medium text-muted-foreground">
              <th className="p-2">{t('ID')}</th>
              <th className="p-2">{t('Tipo')}</th>
              <th className="p-2">{t('Entrada')}</th>
              <th className="p-2">{t('Saída')}</th>
              <th className="p-2">{t('Resultado')}</th>
              <th className="p-2">{t('Hora')}</th>
            </tr>
          </thead>
          <tbody>
            {sortedOperations.map(operation => (
              <tr 
                key={operation.id} 
                className={`border-b hover:bg-muted/50 text-sm ${
                  operation.is_win === true 
                    ? 'bg-green-50 dark:bg-green-950/20' 
                    : operation.is_win === false 
                      ? 'bg-red-50 dark:bg-red-950/20' 
                      : ''
                }`}
              >
                <td className="p-2">
                  <div className="font-mono text-xs">{operation.contract_id}</div>
                </td>
                <td className="p-2">
                  <Badge variant="outline" className="text-xs">
                    {operation.contract_type}
                  </Badge>
                </td>
                <td className="p-2">{operation.entry_value.toFixed(2)}</td>
                <td className="p-2">
                  {operation.exit_value 
                    ? operation.exit_value.toFixed(2) 
                    : <span className="text-muted-foreground italic text-xs">{t('Aguardando')}</span>}
                </td>
                <td className="p-2">
                  {operation.is_win === undefined ? (
                    <Badge variant="outline" className="text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {t('Em andamento')}
                    </Badge>
                  ) : operation.is_win ? (
                    <div className="flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" />
                      <span className="text-green-500">{operation.profit && operation.profit.toFixed(2)}</span>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                      <span className="text-red-500">{operation.profit && operation.profit.toFixed(2)}</span>
                    </div>
                  )}
                </td>
                <td className="p-2 text-xs text-muted-foreground">
                  {format(new Date(operation.time), 'HH:mm:ss', { locale: dateLocale })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
  
  // Renderizar estatísticas resumidas
  const renderStats = () => {
    return (
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="p-2 border rounded flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">{t('Operações')}</span>
          <span className="text-xl font-medium">{stats.totalOperations}</span>
        </div>
        
        <div className="p-2 border rounded flex flex-col items-center justify-center bg-green-50 dark:bg-green-950/20">
          <span className="text-xs text-muted-foreground">{t('Ganhos')}</span>
          <span className="text-xl font-medium text-green-500">{stats.wins}</span>
        </div>
        
        <div className="p-2 border rounded flex flex-col items-center justify-center bg-red-50 dark:bg-red-950/20">
          <span className="text-xs text-muted-foreground">{t('Perdas')}</span>
          <span className="text-xl font-medium text-red-500">{stats.losses}</span>
        </div>
        
        <div className="p-2 border rounded flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground">{t('Taxa')}</span>
          <span className="text-xl font-medium">
            {(stats.winRate * 100).toFixed(0)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{t('Histórico de Operações')}</CardTitle>
            <CardDescription>
              {t('Últimas operações realizadas pelo bot')}
            </CardDescription>
          </div>
          
          <div className="flex items-center border rounded-md">
            <Button 
              variant={view === 'list' ? 'default' : 'ghost'} 
              size="sm" 
              className="h-8 px-2"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={view === 'table' ? 'default' : 'ghost'} 
              size="sm" 
              className="h-8 px-2"
              onClick={() => setView('table')}
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {renderStats()}
        
        {operations.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-muted-foreground mb-2">
              {t('Nenhuma operação realizada')}
            </div>
            <div className="text-xs text-muted-foreground">
              {t('Inicie o bot para começar a operar')}
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {view === 'list' ? (
              <div className="pr-4">
                {sortedOperations.map(renderOperationListItem)}
              </div>
            ) : (
              renderOperationsTable()
            )}
          </ScrollArea>
        )}
      </CardContent>
      <CardFooter className="flex justify-between text-xs text-muted-foreground">
        <div>
          {stats.totalOperations > 0 && (
            <span>
              {t('Total de {{total}} operações', { total: stats.totalOperations })}
            </span>
          )}
        </div>
        <div className="flex items-center">
          {stats.totalProfit > 0 ? (
            <>
              <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
              <span className="text-green-500">
                +{stats.totalProfit.toFixed(2)}
              </span>
            </>
          ) : stats.totalProfit < 0 ? (
            <>
              <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
              <span className="text-red-500">
                {stats.totalProfit.toFixed(2)}
              </span>
            </>
          ) : null}
        </div>
      </CardFooter>
    </Card>
  );
};

export default OperationHistoryCard;