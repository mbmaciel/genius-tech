import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Percent, 
  DollarSign, 
  RefreshCw,
  BarChart,
  Plus
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import derivAPI from '@/lib/derivApi';

interface Contract {
  contract_id: string;
  contract_type: string;
  entry_spot: number;
  entry_tick_time: number;
  date_expiry: number;
  expiry_time: number;
  underlying_symbol: string;
  display_name?: string;
  barrier?: string;
  high_barrier?: string;
  low_barrier?: string;
  buy_price: number;
  bid_price?: number;
  ask_price?: number;
  current_spot: number;
  current_spot_time: number;
  date_settlement?: number;
  date_start: number;
  payout: number;
  profit: number;
  sell_price?: number;
  sell_time?: number;
  status: 'open' | 'won' | 'lost' | 'sold';
  longcode?: string;
  shortcode?: string;
  transaction_ids: {
    buy: number;
    sell?: number;
  };
  // Flags para controlar estados de UI
  isProcessingSell?: boolean;
  isProcessingUpdate?: boolean;
  // Para stop loss e take profit
  limit_order?: {
    stop_loss?: number | null;
    take_profit?: number | null;
  };
}

export function OpenContracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Função para iniciar a inscrição nos contratos abertos
  const subscribeToOpenContracts = async () => {
    try {
      console.log("Inscrevendo para atualizações de contratos abertos...");
      
      // Primeiro, tentar cancelar quaisquer inscrições anteriores para evitar erros
      try {
        await derivAPI.send({
          forget_all: ["proposal_open_contract", "portfolio"]
        });
        console.log("Inscrições anteriores de contratos canceladas com sucesso");
      } catch (forgetErr) {
        console.log("Nenhuma inscrição anterior para cancelar ou erro ao cancelar:", forgetErr);
      }
      
      // Aguardar um pequeno intervalo para garantir que o cancelamento seja processado
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Abordagem 1: Solicitar a lista de contratos no portfolio
      // Esta chamada retorna informações básicas sobre todos os contratos abertos
      try {
        const portfolioResponse = await derivAPI.send({
          portfolio: 1
        });
        
        if (portfolioResponse && portfolioResponse.portfolio) {
          const portfolioContracts = portfolioResponse.portfolio.contracts || [];
          
          console.log(`Portfolio retornou ${portfolioContracts.length} contratos abertos`);
          
          // Se houver contratos no portfolio, vamos obter detalhes de cada um
          if (portfolioContracts.length > 0) {
            // Populamos a lista inicial de contratos
            const initialContracts = portfolioContracts.map((contract: any) => ({
              ...contract,
              status: 'open',  // Sempre estará aberto no portfolio
              current_spot: 0, // Será atualizado depois
              current_spot_time: 0,
              profit: 0,       // Calculado posteriormente com bid_price
            }));
            
            setContracts(initialContracts);
            
            // Para cada contrato, vamos obter os detalhes e se inscrever para atualizações
            for (const contract of portfolioContracts) {
              try {
                await derivAPI.send({
                  proposal_open_contract: 1,
                  contract_id: contract.contract_id,
                  subscribe: 1
                });
              } catch (error) {
                console.warn(`Erro ao obter detalhes do contrato ${contract.contract_id}:`, error);
              }
            }
          }
        }
      } catch (portfolioError) {
        console.error("Erro ao obter portfolio:", portfolioError);
      }
      
      // Abordagem 2: Inscrever-se para todos os contratos abertos
      // Esta chamada irá fornecer atualizações em tempo real para todos os contratos abertos
      try {
        const response = await derivAPI.send({
          proposal_open_contract: 1,
          subscribe: 1
        });
        
        if (response && response.error) {
          console.error("Erro ao inscrever para contratos abertos:", response.error);
          setError(`Erro ao inscrever para contratos: ${response.error.message}`);
        } else {
          console.log("Inscrição para contratos abertos realizada com sucesso");
        }
      } catch (subError) {
        console.error("Erro na inscrição de contratos abertos:", subError);
      }
      
      setIsLoading(false);
      setLastUpdate(new Date());
    } catch (err: any) {
      console.error("Erro ao se inscrever para contratos abertos:", err);
      setError(`Erro ao se inscrever: ${err.message || "Erro desconhecido"}`);
      setIsLoading(false);
    }
  };

  // Função para atualizar manualmente os contratos
  const refreshContracts = async () => {
    setIsRefreshing(true);
    try {
      // Para atualizar, primeiro cancelamos todas as inscrições existentes
      try {
        await derivAPI.send({
          forget_all: ["proposal_open_contract", "portfolio"]
        });
        console.log("Inscrições canceladas com sucesso para atualização");
      } catch (forgetErr) {
        console.warn("Erro ao cancelar inscrições para atualização:", forgetErr);
      }
      
      // Limpar lista atual de contratos
      setContracts([]);
      
      // Aguardar um pequeno intervalo para garantir que o cancelamento seja processado
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Em seguida, inscreva-se novamente
      await subscribeToOpenContracts();
      
      setIsRefreshing(false);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Erro ao atualizar contratos:", error);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Verificar se está conectado à API da Deriv
    const connectionStatus = derivAPI.getConnectionStatus();
    setIsConnected(connectionStatus);
    
    if (!connectionStatus) {
      setError("Você precisa se conectar à Deriv para ver os contratos abertos");
      setIsLoading(false);
      return;
    }

    // Configurar evento para atualizações de contratos
    const handleContractUpdate = (event: any) => {
      const data = event.detail;
      
      if (data && data.proposal_open_contract) {
        const contract = data.proposal_open_contract;
        
        setContracts(prevContracts => {
          // Verificar se o contrato já existe na lista
          const exists = prevContracts.some(c => c.contract_id === contract.contract_id);
          
          if (exists) {
            // Se o contrato estiver encerrado (não aberto), manter por 10 segundos para visualização
            if (contract.status !== 'open') {
              setTimeout(() => {
                setContracts(prevContracts => 
                  prevContracts.filter(c => 
                    c.contract_id !== contract.contract_id || c.status === 'open'
                  )
                );
              }, 10000); // Manter contratos encerrados por 10 segundos
            }
            
            // Atualizar contrato existente
            return prevContracts.map(c => 
              c.contract_id === contract.contract_id ? contract : c
            );
          } else {
            // Adicionar novo contrato
            return [...prevContracts, contract];
          }
        });
        
        setLastUpdate(new Date());
      }
    };

    // Registrar ouvinte de eventos
    document.addEventListener('deriv:contract_update', handleContractUpdate);
    
    // Iniciar a inscrição para contratos abertos
    subscribeToOpenContracts();
    
    // Limpar ao desmontar
    return () => {
      document.removeEventListener('deriv:contract_update', handleContractUpdate);
      // Não cancelamos a inscrição aqui porque pode ser útil manter para outros componentes
    };
  }, []);

  // Formatar valor monetário
  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Formatar data/hora
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Calcular o tempo restante em segundos
  const getRemainingSeconds = (expiryTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, expiryTime - now);
  };

  // Formatar tempo restante
  const formatRemainingTime = (expiryTime: number) => {
    const remainingSeconds = getRemainingSeconds(expiryTime);
    
    if (remainingSeconds <= 0) return "Expirado";
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calcular a porcentagem de progresso
  const getTimeProgress = (startTime: number, expiryTime: number) => {
    const now = Math.floor(Date.now() / 1000);
    const totalDuration = expiryTime - startTime;
    const elapsed = now - startTime;
    
    if (totalDuration <= 0) return 100;
    
    return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
  };

  // Obter cor com base no status do lucro
  const getProfitColor = (profit: number) => {
    if (profit > 0) return "text-green-500";
    if (profit < 0) return "text-red-500";
    return "text-gray-400";
  };

  // Obter badge de status do contrato
  const getStatusBadge = (status: string, profit: number) => {
    switch (status) {
      case 'open':
        return <Badge variant="default" className="bg-blue-500">Aberto</Badge>;
      case 'won':
        return <Badge variant="default" className="bg-green-500">Ganhou</Badge>;
      case 'lost':
        return <Badge variant="default" className="bg-red-500">Perdeu</Badge>;
      case 'sold':
        return profit >= 0 
          ? <Badge variant="default" className="bg-green-500">Vendido (Lucro)</Badge>
          : <Badge variant="default" className="bg-amber-500">Vendido (Perda)</Badge>;
      default:
        return <Badge variant="default">Desconhecido</Badge>;
    }
  };

  // Vender um contrato
  const sellContract = async (contractId: string) => {
    try {
      console.log(`Tentando vender contrato com ID: ${contractId}`);
      
      // Adicionar loading state para este contrato específico
      setContracts(prevContracts => 
        prevContracts.map(c => 
          c.contract_id === contractId 
            ? {...c, isProcessingSell: true} 
            : c
        )
      );
      
      const response = await derivAPI.send({
        sell: contractId,
        price: 0 // Vender pelo preço de mercado
      });
      
      if (response && response.error) {
        console.error("Erro ao vender contrato:", response.error);
        
        // Remover loading state
        setContracts(prevContracts => 
          prevContracts.map(c => 
            c.contract_id === contractId 
              ? {...c, isProcessingSell: false} 
              : c
          )
        );
        
        return;
      }
      
      console.log("Contrato vendido com sucesso:", response);
      
      if (response && response.sell) {
        // Atualizar o contrato localmente enquanto esperamos pela atualização via websocket
        setContracts(prevContracts => 
          prevContracts.map(c => 
            c.contract_id === contractId 
              ? {
                  ...c, 
                  isProcessingSell: false,
                  status: 'sold',
                  sell_price: response.sell.sold_for,
                  profit: response.sell.sold_for - c.buy_price
                } 
              : c
          )
        );
      }
    } catch (error) {
      console.error("Erro ao vender contrato:", error);
      
      // Remover loading state em caso de erro
      setContracts(prevContracts => 
        prevContracts.map(c => 
          c.contract_id === contractId 
            ? {...c, isProcessingSell: false} 
            : c
        )
      );
    }
  };
  
  // Atualizar um contrato com stop loss ou take profit
  const updateContract = async (contractId: string, stopLoss?: number | null, takeProfit?: number | null) => {
    try {
      console.log(`Atualizando contrato ${contractId} - Stop Loss: ${stopLoss}, Take Profit: ${takeProfit}`);
      
      // Adicionar loading state para este contrato específico
      setContracts(prevContracts => 
        prevContracts.map(c => 
          c.contract_id === contractId 
            ? {...c, isProcessingUpdate: true} 
            : c
        )
      );
      
      const limitOrder: {stop_loss?: number | null, take_profit?: number | null} = {};
      
      // Adicionar stop loss e take profit apenas se fornecidos
      if (stopLoss !== undefined) {
        limitOrder.stop_loss = stopLoss;
      }
      
      if (takeProfit !== undefined) {
        limitOrder.take_profit = takeProfit;
      }
      
      const response = await derivAPI.send({
        contract_update: 1,
        contract_id: parseInt(contractId),
        limit_order: limitOrder
      });
      
      if (response && response.error) {
        console.error("Erro ao atualizar contrato:", response.error);
        
        // Remover loading state
        setContracts(prevContracts => 
          prevContracts.map(c => 
            c.contract_id === contractId 
              ? {...c, isProcessingUpdate: false} 
              : c
          )
        );
        
        return;
      }
      
      console.log("Contrato atualizado com sucesso:", response);
      
      // Se a atualização for bem-sucedida, vamos buscar o histórico de atualizações
      try {
        const historyResponse = await derivAPI.send({
          contract_update_history: 1,
          contract_id: parseInt(contractId)
        });
        
        if (historyResponse && historyResponse.contract_update_history) {
          console.log("Histórico de atualizações:", historyResponse.contract_update_history);
        }
      } catch (historyError) {
        console.warn("Erro ao obter histórico de atualizações:", historyError);
      }
      
      // Atualizar o contrato localmente com os novos valores
      setContracts(prevContracts => 
        prevContracts.map(c => {
          if (c.contract_id === contractId) {
            const updatedContract = {
              ...c,
              isProcessingUpdate: false
            };
            
            // Atualizar limite de stop loss, se fornecido
            if (stopLoss !== undefined) {
              updatedContract.limit_order = {
                ...(updatedContract.limit_order || {}),
                stop_loss: stopLoss
              };
            }
            
            // Atualizar limite de take profit, se fornecido
            if (takeProfit !== undefined) {
              updatedContract.limit_order = {
                ...(updatedContract.limit_order || {}),
                take_profit: takeProfit
              };
            }
            
            return updatedContract;
          }
          return c;
        })
      );
      
    } catch (error) {
      console.error("Erro ao atualizar contrato:", error);
      
      // Remover loading state em caso de erro
      setContracts(prevContracts => 
        prevContracts.map(c => 
          c.contract_id === contractId 
            ? {...c, isProcessingUpdate: false} 
            : c
        )
      );
    }
  };

  // Obter tipo de contrato formatado
  const getContractTypeDisplay = (contractType: string) => {
    const typeMap: Record<string, string> = {
      'CALL': 'Alta',
      'PUT': 'Baixa',
      'DIGITOVER': 'Dígito Acima',
      'DIGITUNDER': 'Dígito Abaixo',
      'DIGITODD': 'Dígito Ímpar',
      'DIGITEVEN': 'Dígito Par',
      'DIGITMATCH': 'Dígito Igual',
      'DIGITDIFF': 'Dígito Diferente',
      'ASIANU': 'Asiático Alta',
      'ASIAND': 'Asiático Baixa',
      'EXPIRYRANGE': 'Intervalo',
      'EXPIRYMISS': 'Fora Intervalo',
      'RANGE': 'Permanecer',
      'UPORDOWN': 'Toque',
      'ONETOUCH': 'Um Toque',
      'NOTOUCH': 'Sem Toque'
    };
    
    return typeMap[contractType] || contractType;
  };

  if (!isConnected) {
    return (
      <div className="w-full">
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3 w-3" />
          <AlertTitle className="text-xs">Não conectado</AlertTitle>
          <AlertDescription className="text-xs">
            Conecte-se à Deriv para ver contratos abertos.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <div className="text-xs text-[#8492b4]">
              Atualizado: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshContracts}
          disabled={isRefreshing}
          className="h-7 px-2 border-slate-700 hover:bg-[#1a2b49]"
        >
          <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-xs">Atualizar</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : error ? (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-3 w-3" />
          <AlertTitle className="text-xs">Erro</AlertTitle>
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : contracts.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-[#8492b4] text-sm">Nenhum contrato aberto no momento.</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[240px]">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead className="p-2">Contrato</TableHead>
                <TableHead className="p-2">Valor</TableHead>
                <TableHead className="p-2">Status</TableHead>
                <TableHead className="p-2">Lucro</TableHead>
                <TableHead className="p-2">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contracts.map((contract) => (
                <TableRow key={contract.contract_id} className="text-xs">
                  <TableCell className="p-2">
                    <div className="font-medium">{contract.underlying_symbol}</div>
                    <div className="text-[#8492b4] text-xs">
                      Spot: {contract.current_spot?.toFixed(2) || 'N/A'}
                    </div>
                    {contract.status === 'open' && (
                      <div className="text-xs text-blue-400 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {formatRemainingTime(contract.date_expiry)}
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell className="p-2">
                    <div>{formatMoney(contract.buy_price)}</div>
                  </TableCell>
                  
                  <TableCell className="p-2">
                    {getStatusBadge(contract.status, contract.profit)}
                  </TableCell>
                  
                  <TableCell className={`p-2 ${getProfitColor(contract.profit)}`}>
                    <div className="font-medium">{formatMoney(contract.profit)}</div>
                    {contract.profit !== 0 && (
                      <div className="text-xs flex items-center">
                        {((contract.profit / contract.buy_price) * 100).toFixed(1)}%
                      </div>
                    )}
                  </TableCell>
                  
                  <TableCell className="p-2">
                    {contract.status === 'open' ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => sellContract(contract.contract_id)}
                        className="h-6 px-2 py-0 border-slate-700 hover:bg-[#1a2b49]"
                        disabled={contract.isProcessingSell}
                      >
                        {contract.isProcessingSell ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="text-xs">Vender</span>
                        )}
                      </Button>
                    ) : (
                      <span className="text-xs text-[#8492b4]">Finalizado</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="pt-2 text-xs text-[#8492b4] flex items-center justify-between">
        <span>Contratos são atualizados automaticamente.</span>
        {contracts.length > 0 && (
          <Badge variant="outline" className="ml-2">
            <BarChart className="h-3 w-3 mr-1" />
            {contracts.length} contratos
          </Badge>
        )}
      </div>
    </div>
  );
}