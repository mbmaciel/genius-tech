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
  
  // Carregar operações do localStorage ao iniciar (persistência entre sessões)
  const loadSavedOperations = React.useCallback(() => {
    try {
      const savedOperations = localStorage.getItem('operation_history');
      if (savedOperations) {
        const parsed = JSON.parse(savedOperations);
        
        // Converter strings de data para objetos Date
        const processed = Array.isArray(parsed) ? parsed.map(op => ({
          ...op,
          time: op.time ? new Date(op.time) : new Date()
        })) : [];
        
        console.log('[OperationHistoryCard] 📂 Carregadas', processed.length, 'operações salvas do localStorage');
        return processed;
      }
    } catch (error) {
      console.error('[OperationHistoryCard] Erro ao carregar operações salvas:', error);
    }
    return [];
  }, []);
  
  // Referência ao estado interno do componente - com persistência
  const [internalOperations, setInternalOperations] = React.useState<Operation[]>(
    operations && operations.length > 0 ? operations : loadSavedOperations()
  );
  const { t } = useTranslation();
  
  // Salvar operações no localStorage quando elas mudarem
  React.useEffect(() => {
    if (internalOperations && internalOperations.length > 0) {
      try {
        localStorage.setItem('operation_history', JSON.stringify(internalOperations));
        console.log('[OperationHistoryCard] ✅ Histórico de', internalOperations.length, 'operações salvo no localStorage');
      } catch (error) {
        console.error('[OperationHistoryCard] Erro ao salvar histórico no localStorage:', error);
      }
    }
  }, [internalOperations]);
  
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
  
  // ★★★ CORREÇÃO CRÍTICA: Atualizar o estado interno quando as operações mudam ★★★
  // NUNCA perder operações antigas se as novas estiverem vazias
  React.useEffect(() => {
    console.log('[OperationHistoryCard] 📊 Recebidas operações externas:', operations.length, operations);
    
    if (operations && operations.length > 0) {
      // Verificar se temos operações novas em relação ao estado interno atual
      setInternalOperations(prevOps => {
        // Se não temos operações internas, usar as externas diretamente
        if (!prevOps || prevOps.length === 0) {
          console.log('[OperationHistoryCard] Sem operações anteriores, usando operações recebidas:', operations.length);
          return operations;
        }
        
        // Verificar se temos operações novas em comparação com o estado atual
        const currentIds = new Set(prevOps.map(op => String(op.id)));
        const hasNewOperations = operations.some(op => !currentIds.has(String(op.id)));
        
        if (hasNewOperations) {
          console.log('[OperationHistoryCard] ⭐ Detectadas NOVAS operações, atualizando estado!');
          // Manter histórico mais recente no topo (operações externas têm prioridade)
          return operations;
        } else {
          console.log('[OperationHistoryCard] Sem operações novas, mantendo estado atual com', prevOps.length, 'operações');
          return prevOps;
        }
      });
    } else {
      console.log('[OperationHistoryCard] ⚠️ Recebidas operações vazias! Mantendo estado anterior intacto');
      // NUNCA limpar o histórico se recebermos um array vazio - manter operações anteriores
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

  // Verificação adicional de segurança - converter operações para array se não for
  const safeOperations = Array.isArray(internalOperations) ? internalOperations : [];
  console.log('[OperationHistoryCard] 🔍 DIAGNÓSTICO: safeOperations.length =', safeOperations.length);
  
  // ★★★ CORREÇÃO CRÍTICA: Garantir que temos arrays válidos e separação correta ★★★ 
  console.log('[OperationHistoryCard] 🔍 DIAGNOSTICANDO separação de operações...');
  
  // Separar claramente operações intermediárias das regulares
  const intermediateOperations = safeOperations.filter(op => {
    const isInterm = Boolean(op.isIntermediate);
    console.log(`[OperationHistoryCard] Operação ${op.id}: isIntermediate=${isInterm}`);
    return isInterm;
  });
  
  // Para a aba principal, mostrar TODAS as operações 
  // Não filtrar para garantir que operações apareçam sempre
  const regularOperations = safeOperations;
  
  console.log('[OperationHistoryCard] 📊 DIAGNÓSTICO FINAL:');
  console.log('[OperationHistoryCard] - Total de operações:', safeOperations.length);
  console.log('[OperationHistoryCard] - Operações na aba principal:', regularOperations.length);
  console.log('[OperationHistoryCard] - Operações intermediárias:', intermediateOperations.length);

  return (
    <Card className="h-full shadow-md border border-[#2a3756] bg-[#13203A]">
      <CardHeader className="pb-3 pt-4">
        <CardTitle className="flex justify-between items-center text-white text-lg">
          <div className="flex items-center">
            <Clock className="w-5 h-5 mr-2 text-indigo-400" />
            {t('Histórico de Operações')}
            
            {/* Adicionar botões de ação para o histórico */}
            <div className="flex ml-2 space-x-1">
              <button 
                className="text-xs bg-indigo-700 text-white px-1.5 py-0.5 rounded hover:bg-indigo-600 transition-colors"
                onClick={() => {
                  // Exportar operações como JSON
                  try {
                    const dataStr = JSON.stringify(internalOperations, null, 2);
                    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
                    
                    const exportFileDefaultName = `deriv_operations_history_${new Date().toISOString().split('T')[0]}.json`;
                    
                    const linkElement = document.createElement('a');
                    linkElement.setAttribute('href', dataUri);
                    linkElement.setAttribute('download', exportFileDefaultName);
                    linkElement.click();
                    
                    console.log('[OperationHistoryCard] ✅ Histórico exportado com sucesso!');
                  } catch (error) {
                    console.error('[OperationHistoryCard] Erro ao exportar histórico:', error);
                    alert('Erro ao exportar histórico. Verifique o console para mais detalhes.');
                  }
                }}
              >
                Exportar
              </button>
              <button 
                className="text-xs bg-red-800 text-white px-1.5 py-0.5 rounded hover:bg-red-700 transition-colors"
                onClick={() => {
                  if (confirm('Tem certeza que deseja limpar todo o histórico de operações?')) {
                    // Limpar histórico local mas manter apenas operações de exemplo
                    setInternalOperations([]);
                    localStorage.removeItem('operation_history');
                    console.log('[OperationHistoryCard] 🧹 Histórico de operações limpo!');
                  }
                }}
              >
                Limpar
              </button>
            </div>
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
                              {op.strategy || 'Padrão'}
                            </span>
                          </div>
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