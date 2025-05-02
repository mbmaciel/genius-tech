import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpIcon, ArrowDownIcon, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

// Interface para o tipo de operação
interface Operation {
  id: number | string;
  entryValue?: number;
  finalValue?: number;
  profit: number;
  time: Date;
  notification?: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  };
  isIntermediate?: boolean; 
  contract_id?: string | number;
  strategy?: string;
  symbol?: string;
  contract_type?: string;
  entry_value?: number;
  exit_value?: number;
  is_win?: boolean;
  entry_spot?: number | string;
  exit_spot?: number | string;
  entry_time?: number;
  exit_time?: number;
  duration?: number;
  barrier?: string | number;
  payout?: number;
  timestamp?: number;
  termination_reason?: string; // Motivo de encerramento da operação
}

interface OperationHistoryCardProps {
  operations: Operation[];
  stats?: {
    wins: number;
    losses: number;
    totalProfit: number;
  };
}

export function OperationHistoryCard({ operations, stats }: OperationHistoryCardProps) {
  // Log para depuração das operações
  console.log('[OperationHistoryCard] Renderizando com operações:', operations.length, operations);
  
  // Referência ao estado interno do componente
  const [internalOperations, setInternalOperations] = React.useState<Operation[]>(operations || []);
  const { t } = useTranslation();
  
  // ★★★ CORREÇÃO CRÍTICA: Adicionar auto-refresh para forçar atualização periódica ★★★
  React.useEffect(() => {
    console.log('[OperationHistoryCard] Configurando auto-refresh para histórico de operações');
    
    // Definir intervalo de atualização a cada 5 segundos
    const refreshInterval = setInterval(() => {
      console.log('[OperationHistoryCard] Auto-refresh disparado, verificando atualizações...');
      
      // Forçar re-render do componente sem mudar o estado
      setInternalOperations(prev => [...prev]);
    }, 5000);
    
    return () => {
      console.log('[OperationHistoryCard] Limpando intervalo de auto-refresh');
      clearInterval(refreshInterval);
    };
  }, []);
  
  // Atualizar o estado interno quando as operações mudam
  React.useEffect(() => {
    console.log('[OperationHistoryCard] 📊 Recebidas operações externas:', operations.length, operations);
    if (operations && operations.length > 0) {
      setInternalOperations(operations);
    }
  }, [operations]);
  
  // NOTA: Simplificamos o sistema de eventos para resolver o problema de build
  // Agora usamos um intervalo para simular a atualização em tempo real em vez de eventos
  React.useEffect(() => {
    // O mecanismo de auto-refresh já é suficiente para manter o histórico atualizado
    console.log('[OperationHistoryCard] Sistema simplificado de atualização ativado');
    
    // Exibir informações detalhadas das operações no histórico quando o componente é montado
    console.log('[OperationHistoryCard] ★★★ INFORMAÇÕES DETALHADAS DO HISTÓRICO ★★★');
    console.log('[OperationHistoryCard] Quantidade de operações:', internalOperations.length);
    
    // Listar detalhadamente cada operação para verificar se estão sendo recebidas corretamente
    internalOperations.forEach((op, index) => {
      console.log(`[OperationHistoryCard] Operação #${index + 1}:`, {
        id: op.id,
        type: op.contract_type,
        strategy: op.strategy,
        profit: op.profit,
        is_win: op.is_win,
        entry_value: op.entry_value || op.entryValue,
        isIntermediate: op.isIntermediate,
        time: op.time
      });
    });
    
    return () => {
      console.log('[OperationHistoryCard] Sistema simplificado de atualização desativado');
    };
  }, [internalOperations]);
  
  // Função para formatar valores monetários
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '$0.00';
    return `$${value.toFixed(2)}`;
  };

  // Função para formatar data/hora
  const formatTime = (time: Date | number) => {
    if (typeof time === 'number') {
      return format(new Date(time), 'HH:mm:ss');
    }
    return format(time, 'HH:mm:ss');
  };

  // Mostrar TODAS as operações na aba principal "Operações"
  // A aba "Análises" agora exibe apenas operações marcadas explicitamente como intermediárias
  const regularOperations = internalOperations; // Todas as operações
  const intermediateOperations = internalOperations.filter(op => op.isIntermediate);

  return (
    <Card className="h-full shadow-md border border-[#2a3756] bg-[#13203A]">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="flex justify-between items-center text-white text-lg">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-indigo-400" />
            {t('Histórico de Operações')}
          </div>
          
          {stats && (
            <div className="flex items-center space-x-2 text-sm font-normal">
              <div className="flex items-center">
                <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
                <span className="text-green-400">{stats.wins}</span>
              </div>
              <div className="flex items-center">
                <XCircle className="w-4 h-4 mr-1 text-red-500" />
                <span className="text-red-400">{stats.losses}</span>
              </div>
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-1 text-indigo-400" />
                <span className={stats.totalProfit >= 0 ? "text-green-400" : "text-red-400"}>
                  {formatCurrency(stats.totalProfit)}
                </span>
              </div>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="px-4 pb-4">
        <Tabs defaultValue="regular" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-3 bg-[#1a2b4c]">
            <TabsTrigger value="regular">Todas Operações</TabsTrigger>
            <TabsTrigger value="intermediate">Análises Advance</TabsTrigger>
          </TabsList>
          
          <TabsContent value="regular" className="mt-0">
            <div className="overflow-y-auto max-h-[240px] scrollbar-thin">
              {regularOperations.length > 0 ? (
                <div className="space-y-2">
                  {regularOperations.map((op) => {
                    // Verificar se a operação foi vencedora ou perdedora
                    const isWin = op.is_win || op.profit > 0;
                    
                    // Obter valores para exibir
                    const entryValue = op.entry_value || op.entryValue || 0;
                    const profit = op.profit || 0;
                    
                    return (
                      <div 
                        key={op.id} 
                        className={`p-2 rounded-md border flex justify-between items-center ${
                          isWin ? 'bg-[#1a2d2a] border-[#2a5a4a]' : 'bg-[#2d1a1a] border-[#5a2a2a]'
                        }`}
                      >
                        <div className="flex flex-col">
                          <div className="flex items-center text-white text-sm">
                            <span className="font-medium">
                              {op.contract_type || op.symbol || 'Contrato'}
                            </span>
                            <span className="mx-1 text-gray-400">|</span>
                            <span className="text-gray-300 text-xs">
                              {(() => {
                                // Verificar se é uma das estratégias renomeadas e ajustar exibição
                                const strategyName = op.strategy || 'Padrão';
                                if (strategyName.toLowerCase().includes('manualunder') || 
                                    strategyName.toLowerCase().includes('control_under')) {
                                  return 'Control Under';
                                } else if (strategyName.toLowerCase().includes('manualover') || 
                                         strategyName.toLowerCase().includes('control_over')) {
                                  return 'Control Over';
                                }
                                return strategyName;
                              })()}
                            </span>
                          </div>
                          
                          {/* Exibir o ID do contrato */}
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <span className="text-xs text-blue-400">
                              ID: {op.contract_id || op.id || 'N/A'}
                            </span>
                          </div>
                          
                          {/* Exibir o motivo de encerramento (se existir) com estilo destacado */}
                          {op.termination_reason && (
                            <div className="flex items-center text-xs mt-1">
                              <span className="px-1.5 py-0.5 rounded-sm bg-amber-900/40 text-amber-300 text-xs font-medium border border-amber-700/50">
                                ⓘ {op.termination_reason}
                              </span>
                            </div>
                          )}
                          
                          {/* Hora da operação */}
                          <div className="flex items-center text-xs text-gray-400 mt-1">
                            <Clock className="w-3 h-3 mr-1" />
                            {op.time ? formatTime(op.time) : 
                             op.timestamp ? formatTime(op.timestamp) : 
                             'Agora'}
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          <div className="flex flex-col items-end mr-3">
                            <span className="text-xs text-gray-400">Entrada</span>
                            <span className="text-sm text-white">{formatCurrency(entryValue)}</span>
                          </div>
                          
                          <div className={`flex items-center ${isWin ? 'text-green-500' : 'text-red-500'}`}>
                            {isWin ? (
                              <ArrowUpIcon className="w-4 h-4 mr-1" />
                            ) : (
                              <ArrowDownIcon className="w-4 h-4 mr-1" />
                            )}
                            <span className="font-medium">
                              {formatCurrency(Math.abs(profit))}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  Nenhuma operação registrada. Inicie o robô para começar a operar.
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="intermediate" className="mt-0">
            <div className="overflow-y-auto max-h-[240px] scrollbar-thin">
              {intermediateOperations.length > 0 ? (
                <div className="space-y-2">
                  {intermediateOperations.map((op) => (
                    <div 
                      key={op.id} 
                      className="p-2 rounded-md border border-[#2a3756] bg-[#1a2b4c] flex justify-between items-center"
                    >
                      <div className="flex flex-col">
                        <div className="text-white text-sm">
                          {op.notification?.message || 'Análise de mercado'}
                        </div>
                        <div className="flex items-center text-xs text-gray-400 mt-1">
                          <Clock className="w-3 h-3 mr-1" />
                          {op.time ? formatTime(op.time) : 
                           op.timestamp ? formatTime(op.timestamp) : 
                           'Agora'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-400">
                  Nenhuma análise Advance disponível. Utilize a estratégia Advance para ver análises detalhadas aqui.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}