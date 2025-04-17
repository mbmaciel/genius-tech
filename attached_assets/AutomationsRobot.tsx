import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Play, RotateCcw, Ban, Clock, AlertCircle, Info, FileText, Settings, Bot, 
  Trash2, BarChart2, History, RefreshCw, Zap, DollarSign, TrendingUp, TrendingDown,
  Wallet, ArrowUpDown
} from 'lucide-react';
import { automationService, BinaryBotStrategy, OperationStats, Contract } from './AutomationService';
import derivAPI from '@/lib/derivApi';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface LogMessage {
  id: number;
  type: 'info' | 'error' | 'success' | 'warning';
  message: string;
  timestamp: Date;
}

interface AccountBalance {
  balance: number;
  currency: string;
  previousBalance?: number;
  lastUpdate: Date;
}

export function AutomationsRobot() {
  // Estado do robô
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedStrategy, setSelectedStrategy] = useState<BinaryBotStrategy | null>(null);
  const [strategies, setStrategies] = useState<BinaryBotStrategy[]>([]);
  const [strategyXml, setStrategyXml] = useState<string>('');
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [lastLogId, setLastLogId] = useState<number>(0);

  // Estatísticas e contratos
  const [stats, setStats] = useState<OperationStats | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  
  // Saldo da conta
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [balanceUpdateInterval, setBalanceUpdateInterval] = useState<number | null>(null);

  // Parâmetros de controle de risco
  const [initialStake, setInitialStake] = useState<number>(1);
  const [stopLoss, setStopLoss] = useState<number>(20);
  const [targetProfit, setTargetProfit] = useState<number>(20);
  const [martingaleFactor, setMartingaleFactor] = useState<number>(1.5);
  const [useSmartStaking, setUseSmartStaking] = useState<boolean>(false);
  const [autoReconnect, setAutoReconnect] = useState<boolean>(true);

  // Função para obter o saldo atual da conta
  const fetchAccountBalance = async () => {
    try {
      if (!derivAPI.getConnectionStatus()) return;
      
      // Utilizar diretamente as informações da conta em memória
      // para evitar o erro "AlreadySubscribed"
      const accountInfo = derivAPI.getAccountInfo();
      
      if (accountInfo && accountInfo.balance !== undefined) {
        // Verificar se o saldo é um número ou um objeto
        let newBalance: number;
        let currency: string = 'USD';
        
        if (typeof accountInfo.balance === 'object' && accountInfo.balance !== null) {
          // Se for um objeto complexo, extrair o valor do saldo e moeda
          newBalance = typeof accountInfo.balance.balance === 'number' 
            ? accountInfo.balance.balance
            : parseFloat(accountInfo.balance.balance?.toString() || '0');
          
          currency = accountInfo.balance.currency || currency;
        } else {
          // Se for um valor primitivo
          newBalance = parseFloat(accountInfo.balance.toString());
          currency = accountInfo.currency || currency;
        }
        
        setAccountBalance(prev => {
          // Se já temos um saldo anterior, armazená-lo como o saldo anterior
          if (prev) {
            return {
              balance: newBalance,
              currency: currency,
              previousBalance: prev.balance,
              lastUpdate: new Date()
            };
          } else {
            return {
              balance: newBalance,
              currency: currency,
              lastUpdate: new Date()
            };
          }
        });
        
        // Atualizar o log apenas se o saldo mudou e não for o primeiro carregamento
        if (accountBalance && newBalance !== accountBalance.balance) {
          const diff = newBalance - accountBalance.balance;
          const formattedDiff = diff > 0 
            ? `+${diff.toFixed(2)}` 
            : diff.toFixed(2);
          
          addLog(`Saldo atualizado: ${newBalance.toFixed(2)} ${currency} (${formattedDiff} ${currency})`, 
            diff >= 0 ? 'success' : 'error');
        }
        
        // Não registrar saldo no console, reduz ruído
        // console.log('Saldo obtido de accountInfo:', newBalance, currency);
        return;
      }
      
      // Se não conseguiu obter do accountInfo, tenta uma solicitação direta
      // mas sem subscribe para evitar o erro
      try {
        const balanceResponse = await derivAPI.send({
          balance: 1,
          subscribe: 0
        });
        
        console.log('Resposta de saldo obtida:', balanceResponse);
        
        if (balanceResponse?.balance) {
          // Garantir que temos um número válido para o saldo
          let newBalance: number;
          const balanceValue = balanceResponse.balance.balance;
          
          if (typeof balanceValue === 'number') {
            newBalance = balanceValue;
          } else if (typeof balanceValue === 'string') {
            newBalance = parseFloat(balanceValue);
          } else if (typeof balanceValue === 'object' && balanceValue !== null) {
            // Se for outro objeto aninhado
            newBalance = parseFloat(String(balanceValue.balance || 0));
          } else {
            newBalance = 0;
          }
          
          const currency = balanceResponse.balance.currency || 'USD';
          
          const updatedBalance = {
            balance: newBalance,
            currency: currency,
            previousBalance: accountBalance?.balance,
            lastUpdate: new Date()
          };
          
          console.log('Saldo atualizado:', updatedBalance);
          
          setAccountBalance(updatedBalance);
        }
      } catch (apiError) {
        console.warn('Não foi possível obter saldo da API:', apiError);
      }
    } catch (error) {
      console.error('Erro ao obter saldo da conta:', error);
    }
  };

  // Carrega a lista de estratégias ao montar o componente
  useEffect(() => {
    const availableStrategies = automationService.getStrategies();
    setStrategies(availableStrategies);
    
    // Se existir pelo menos uma estratégia, seleciona a primeira por padrão
    if (availableStrategies.length > 0) {
      setSelectedStrategy(availableStrategies[0]);
      loadStrategyXml(availableStrategies[0]);
    }
    
    // Adiciona mensagem de log inicial
    addLog('Bem-vindo ao Robô de Automações. Selecione uma estratégia para começar.', 'info');
    
    // Registrar ouvintes para atualizações de contratos e estatísticas
    automationService.onContractsUpdate(contracts => {
      setContracts(contracts);
    });
    
    automationService.onStatsUpdate(stats => {
      setStats(stats);
    });
    
    // Buscar saldo inicial e configurar atualizações periódicas
    fetchAccountBalance();
    const intervalId = window.setInterval(fetchAccountBalance, 5000); // Atualizar a cada 5 segundos
    setBalanceUpdateInterval(intervalId);
    
    // Limpar intervalo ao desmontar o componente
    return () => {
      if (balanceUpdateInterval) {
        clearInterval(balanceUpdateInterval);
      }
    };
  }, []);
  
  // Rolagem automática para o último log
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);
  
  // Carrega o conteúdo XML da estratégia selecionada
  const loadStrategyXml = async (strategy: BinaryBotStrategy) => {
    try {
      addLog(`Carregando estratégia "${strategy.name}"...`, 'info');
      const xml = await automationService.loadStrategyXml(strategy);
      setStrategyXml(xml);
      addLog(`Estratégia "${strategy.name}" carregada com sucesso.`, 'success');
    } catch (error) {
      console.error('Erro ao carregar XML da estratégia:', error);
      addLog(`Erro ao carregar estratégia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
    }
  };
  
  // Adiciona uma nova mensagem de log
  const addLog = (message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info') => {
    // Usar timestamp como parte do ID para garantir unicidade
    const timestamp = Date.now();
    const newId = timestamp + Math.floor(Math.random() * 10000); // Adiciona aleatoriedade para garantir unicidade
    setLastLogId(newId);
    
    // Formatar mensagem de operação para melhor visualização no log
    let formattedMessage = message;
    
    // Se a mensagem contém operação ou contrato, formatamos para uma visualização melhor
    if (message.includes('operação') || message.includes('Operação') || 
        message.includes('contrato') || message.includes('Contrato')) {
      
      // Para mensagens de ganho/perda, formatamos o valor monetário
      if (message.includes('GANHO') || message.includes('ganho') || 
          message.includes('Lucro') || message.includes('lucro')) {
        // Adicionar "+" ao valor se não tiver
        if (!message.includes('+')) {
          const valueMatch = message.match(/USD\s?(\d+(\.\d+)?)/);
          if (valueMatch) {
            const value = valueMatch[0];
            formattedMessage = message.replace(value, `+${value}`);
          }
        }
      }
    }
    
    setLogs(prevLogs => [...prevLogs, {
      id: newId,
      type,
      message: formattedMessage,
      timestamp: new Date()
    }]);
    
    // Log para debug no console
    console.log(`[${type.toUpperCase()}] ${message}`);
  };
  
  // Limpar todos os logs
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs limpos.', 'info');
  };
  
  // Iniciar a execução da estratégia
  const startStrategy = async () => {
    if (!selectedStrategy) {
      toast({
        title: "Erro",
        description: "Selecione uma estratégia antes de iniciar.",
        variant: "destructive"
      });
      return;
    }
    
    if (!derivAPI.getConnectionStatus()) {
      toast({
        title: "Não conectado",
        description: "Conecte-se à API da Deriv antes de iniciar uma estratégia.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Pegar o token atual
      const token = derivAPI.getToken();
      if (!token) {
        toast({
          title: "Token não disponível",
          description: "O token de API não está disponível. Reconecte-se primeiro.",
          variant: "destructive"
        });
        return;
      }
      
      // Aplicar parâmetros de controle de risco ao XML
      const modifiedXml = automationService.applyRiskControlParams(
        strategyXml,
        initialStake,
        stopLoss,
        targetProfit,
        martingaleFactor
      );
      
      // Iniciar a estratégia com os parâmetros do usuário
      await automationService.runStrategy(
        modifiedXml,
        token || "",
        // Callback de início
        () => {
          setIsRunning(true);
          toast({
            title: "Robô iniciado",
            description: `Estratégia ${selectedStrategy.name} iniciada com sucesso.`
          });
        },
        // Callback de log
        (message) => {
          addLog(message, 'info');
        },
        // Callback de erro
        (errorMessage) => {
          addLog(errorMessage, 'error');
          toast({
            title: "Erro no robô",
            description: errorMessage,
            variant: "destructive"
          });
        },
        // Parâmetros de configuração do usuário
        initialStake,
        stopLoss,
        targetProfit,
        martingaleFactor
      );
    } catch (error) {
      console.error('Erro ao iniciar estratégia:', error);
      addLog(`Erro ao iniciar estratégia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'error');
      toast({
        title: "Erro ao iniciar",
        description: `Não foi possível iniciar a estratégia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive"
      });
    }
  };
  
  // Parar a execução da estratégia
  const stopStrategy = () => {
    try {
      // Importante: evitar chamadas duplicadas verificando o estado atual
      if (!isRunning) {
        console.log('Estratégia já está parada, ignorando chamada duplicada');
        return;
      }
      
      // Primeiro atualizar o estado local para evitar múltiplas chamadas
      setIsRunning(false);
      
      // Não adicionar log aqui, pois o próprio serviço já emitirá um log
      // Remover para evitar duplicação: addLog('Estratégia interrompida pelo usuário.', 'warning');
      
      // Parar a estratégia apenas uma vez
      automationService.stopStrategy();
      
      // Notificar o usuário
      toast({
        title: "Robô parado",
        description: "Execução da estratégia interrompida com sucesso."
      });
    } catch (error) {
      console.error('Erro ao parar estratégia:', error);
      toast({
        title: "Erro",
        description: "Erro ao parar a estratégia",
        variant: "destructive"
      });
    }
  };
  
  // Renderizar ícone para o tipo de log
  const getLogIcon = (type: 'info' | 'error' | 'success' | 'warning') => {
    switch (type) {
      case 'info':
        return <Info className="w-4 h-4 text-blue-400 mr-2" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500 mr-2" />;
      case 'success':
        return <Bot className="w-4 h-4 text-green-500 mr-2" />;
      case 'warning':
        return <Clock className="w-4 h-4 text-yellow-500 mr-2" />;
      default:
        return <Info className="w-4 h-4 text-blue-400 mr-2" />;
    }
  };
  
  // Formatar timestamp do log
  const formatLogTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Alternar estratégia selecionada
  const handleStrategyChange = (strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (strategy) {
      setSelectedStrategy(strategy);
      loadStrategyXml(strategy);
    }
  };
  
  // Vender um contrato
  const handleSellContract = async (contractId: number) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      addLog(`Iniciando venda do contrato #${contractId}...`, 'info');
      
      const result = await automationService.sellContract(contractId);
      
      addLog(`Contrato #${contractId} vendido com sucesso por $${result.sell?.sold_for || 0}`, 'success');
      toast({
        title: "Contrato vendido",
        description: `Contrato #${contractId} vendido com sucesso`
      });
    } catch (error: any) {
      addLog(`Erro ao vender contrato: ${error.message || 'Erro desconhecido'}`, 'error');
      toast({
        title: "Erro",
        description: `Não foi possível vender o contrato: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Cancelar um contrato
  const handleCancelContract = async (contractId: number) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      addLog(`Iniciando cancelamento do contrato #${contractId}...`, 'info');
      
      const result = await automationService.cancelContract(contractId);
      
      addLog(`Contrato #${contractId} cancelado com sucesso`, 'success');
      toast({
        title: "Contrato cancelado",
        description: `Contrato #${contractId} cancelado com sucesso`
      });
    } catch (error: any) {
      addLog(`Erro ao cancelar contrato: ${error.message || 'Erro desconhecido'}`, 'error');
      toast({
        title: "Erro",
        description: `Não foi possível cancelar o contrato: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Atualizar um contrato (stop loss/take profit)
  const handleUpdateContract = async (contractId: number, stopLoss: number | null, takeProfit: number | null) => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      addLog(`Atualizando condições do contrato #${contractId}...`, 'info');
      
      const result = await automationService.updateContract(contractId, {
        stopLoss,
        takeProfit
      });
      
      addLog(`Contrato #${contractId} atualizado com sucesso`, 'success');
      toast({
        title: "Contrato atualizado",
        description: `Contrato #${contractId} atualizado com sucesso`
      });
    } catch (error: any) {
      addLog(`Erro ao atualizar contrato: ${error.message || 'Erro desconhecido'}`, 'error');
      toast({
        title: "Erro",
        description: `Não foi possível atualizar o contrato: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Vender todos os contratos expirados
  const handleSellExpiredContracts = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      addLog("Iniciando venda de contratos expirados...", 'info');
      
      const result = await automationService.sellExpiredContracts();
      const count = result?.sell_expired?.count || 0;
      
      addLog(`${count} contrato(s) expirado(s) vendido(s) com sucesso`, 'success');
      toast({
        title: "Contratos expirados vendidos",
        description: `${count} contrato(s) expirado(s) vendido(s) com sucesso`
      });
    } catch (error: any) {
      addLog(`Erro ao vender contratos expirados: ${error.message || 'Erro desconhecido'}`, 'error');
      toast({
        title: "Erro",
        description: `Não foi possível vender os contratos expirados: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Calcular duração da sessão
  const getSessionDuration = () => {
    if (!stats) return "00:00";
    
    const now = new Date();
    const diffInMs = now.getTime() - stats.startTime.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInMinutes = Math.floor((diffInMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${diffInHours.toString().padStart(2, '0')}:${diffInMinutes.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="grid grid-cols-1 gap-4">
      {/* Linha 1: Controles e estratégias */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Seleção de estratégia e controles */}
        <div className="bg-[#1c3450] p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <Settings className="h-4 w-4 mr-2 text-[#00e5b3]" />
              <span className="text-white font-medium">Controle do Robô</span>
            </div>
            <div className="flex items-center space-x-3">
              {/* Exibição do saldo da conta */}
              {accountBalance && (
                <div className="flex items-center">
                  <Wallet className="h-4 w-4 mr-1 text-[#00e5b3]" />
                  <span className="text-xs font-medium text-white">
                    {accountBalance.balance.toFixed(2)} {accountBalance.currency}
                  </span>
                  
                  {/* Exibir mudança no saldo se houver */}
                  {accountBalance.previousBalance !== undefined && accountBalance.balance !== accountBalance.previousBalance && (
                    <Badge 
                      className={`ml-1 px-1 py-0 text-[10px] ${
                        accountBalance.balance > accountBalance.previousBalance 
                          ? 'bg-green-500/20 text-green-300 hover:bg-green-500/20' 
                          : 'bg-red-500/20 text-red-300 hover:bg-red-500/20'
                      }`}
                    >
                      <span className="flex items-center">
                        <ArrowUpDown className="h-2 w-2 mr-0.5" />
                        {accountBalance.balance > accountBalance.previousBalance 
                          ? `+${(accountBalance.balance - accountBalance.previousBalance).toFixed(2)}` 
                          : (accountBalance.previousBalance - accountBalance.balance).toFixed(2)
                        }
                      </span>
                    </Badge>
                  )}
                </div>
              )}
              
              {isRunning && (
                <span className="text-xs font-normal text-green-400 animate-pulse">● Em execução</span>
              )}
            </div>
          </div>
          
          {/* Seleção de estratégia e ajustes de valores - layout compacto */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="strategy-select" className="text-white text-xs">Estratégia</Label>
              <Select 
                disabled={isRunning}
                value={selectedStrategy?.id}
                onValueChange={handleStrategyChange}
              >
                <SelectTrigger id="strategy-select" className="border-slate-700 bg-[#162440] h-8 text-sm">
                  <SelectValue placeholder="Selecione uma estratégia" />
                </SelectTrigger>
                <SelectContent className="bg-[#162440] border-slate-700">
                  <SelectGroup>
                    <SelectLabel>Estratégias disponíveis</SelectLabel>
                    {strategies.map(strategy => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            
            {/* Layout compacto com campos de entrada */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="initial-stake" className="text-white text-xs">Valor inicial ($)</Label>
                <Input 
                  id="initial-stake"
                  type="number"
                  disabled={isRunning}
                  value={initialStake.toString()}
                  min={0.35}
                  max={100}
                  step={0.05}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0.35 && value <= 100) {
                      setInitialStake(value);
                    }
                  }}
                  className="h-8 text-sm border-slate-700 bg-[#162440]"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="martingale" className="text-white text-xs">Martingale (x)</Label>
                <Input 
                  id="martingale"
                  type="number"
                  disabled={isRunning}
                  value={martingaleFactor.toString()}
                  min={1}
                  max={3}
                  step={0.1}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 3) {
                      setMartingaleFactor(value);
                    }
                  }}
                  className="h-8 text-sm border-slate-700 bg-[#162440]"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="target-profit" className="text-white text-xs">Meta ($)</Label>
                <Input 
                  id="target-profit"
                  type="number"
                  disabled={isRunning}
                  value={targetProfit.toString()}
                  min={1}
                  max={500}
                  step={1}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 500) {
                      setTargetProfit(value);
                    }
                  }}
                  className="h-8 text-sm border-slate-700 bg-[#162440]"
                />
              </div>
              
              <div className="space-y-1">
                <Label htmlFor="stop-loss" className="text-white text-xs">Limite ($)</Label>
                <Input 
                  id="stop-loss"
                  type="number"
                  disabled={isRunning}
                  value={stopLoss.toString()}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 1 && value <= 100) {
                      setStopLoss(value);
                    }
                  }}
                  className="h-8 text-sm border-slate-700 bg-[#162440]"
                />
              </div>
            </div>
          </div>
          
          {/* Botões de controle */}
          <div className="flex justify-between mt-4">
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs border-slate-700 hover:bg-[#1a2b49]"
              onClick={clearLogs}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Limpar logs
            </Button>
            
            {isRunning ? (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={stopStrategy}
              >
                <Ban className="h-3 w-3 mr-1" />
                Parar robô
              </Button>
            ) : (
              <Button 
                variant="default" 
                size="sm"
                className="bg-[#00e5b3] hover:bg-[#00c49a] text-[#0e1a33]"
                onClick={startStrategy}
              >
                <Play className="h-3 w-3 mr-1" />
                Iniciar robô
              </Button>
            )}
          </div>
        </div>
        
        {/* Estatísticas da Operação */}
        <div className="bg-[#1c3450] p-4 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <FileText className="h-4 w-4 mr-2 text-[#00e5b3]" />
              <span className="text-white font-medium">Estatísticas da Operação</span>
            </div>
            <div className="flex items-center">
              <Label htmlFor="auto-reconnect" className="text-xs text-[#8492b4] mr-2">Auto-reconexão</Label>
              <Switch
                id="auto-reconnect"
                checked={autoReconnect}
                onCheckedChange={setAutoReconnect}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#162440] p-3 rounded-lg">
              <div className="text-xs text-[#8492b4] mb-1">Operações</div>
              <div className="text-white font-bold text-xl">
                {(stats?.wins || 0) + (stats?.losses || 0)}
              </div>
              <div className="text-xs text-[#8492b4] mt-1">Total de entradas</div>
            </div>
            
            <div className="bg-[#162440] p-3 rounded-lg">
              <div className="text-xs text-[#8492b4] mb-1">Resultado</div>
              <div className={`font-bold text-xl ${(stats?.netResult || 0) >= 0 ? 'text-[#00e5b3]' : 'text-red-400'}`}>
                ${(stats?.netResult || 0).toFixed(2)}
              </div>
              <div className="text-xs text-[#8492b4] mt-1">Lucro/Prejuízo</div>
            </div>
            
            <div className="bg-[#162440] p-3 rounded-lg">
              <div className="text-xs text-[#8492b4] mb-1">Assertividade</div>
              <div className="text-white font-bold text-xl">
                {stats && stats.wins + stats.losses > 0 
                  ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) 
                  : 0}%
              </div>
              <div className="text-xs text-[#8492b4] mt-1">Taxa de acerto</div>
            </div>
            
            <div className="bg-[#162440] p-3 rounded-lg">
              <div className="text-xs text-[#8492b4] mb-1">Tempo</div>
              <div className="text-white font-bold text-xl">
                {getSessionDuration()}
              </div>
              <div className="text-xs text-[#8492b4] mt-1">Duração da sessão</div>
            </div>
          </div>
          
          <div className="mt-3">
            <div className="flex justify-between items-center">
              <div className="text-xs text-[#8492b4]">
                <span>
                  <span className="text-[#00e5b3] mr-1">▲</span> {stats?.wins || 0} ganhos |
                  <span className="text-red-400 mx-1">▼</span> {stats?.losses || 0} perdas |
                  Contratos ativos: {contracts.length}
                </span>
              </div>
              <div>
                {stats && stats.totalProfit > 0 && stats.totalLoss > 0 && (
                  <span className="text-xs text-[#8492b4]">
                    Fator de lucro: <span className="text-[#00e5b3]">{(stats.totalProfit / stats.totalLoss).toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>
            
            {selectedStrategy && (
              <div className="text-sm text-[#8492b4] mt-2">
                <span className="text-white text-xs">Estratégia atual:</span> {selectedStrategy.name} - {selectedStrategy.description}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Linha 2: Log de Operação */}
      <div className="bg-[#1c3450] p-4 rounded-lg">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center">
            <Bot className="h-4 w-4 mr-2 text-[#00e5b3]" />
            <span className="text-white font-medium">Log de Operação</span>
          </div>
          <div className="text-xs text-[#8492b4]">
            {isRunning ? 'Estado: Robô ativo' : 'Estado: Aguardando'}
          </div>
        </div>
        
        <ScrollArea className="h-[200px] rounded-md border border-[#162440] bg-[#162440] p-2">
          <div className="space-y-1">
            {logs
              // Removendo o filtro para exibir todos os logs de operação
              .map(log => {
                // Determinar se é uma entrada ou resultado
                const isEntry = log.message.includes('Compra') || 
                              log.message.includes('compra') || 
                              log.message.includes('Executando operação') ||
                              log.message.includes('operação #');
                              
                const isWin = log.message.includes('Lucro') || 
                           log.message.includes('GANHO') || 
                           (log.type === 'success' && 
                            (log.message.includes('operação') || 
                             log.message.includes('Operação') || 
                             log.message.includes('contrato')));
                             
                const isLoss = log.message.includes('Prejuízo') || 
                            log.message.includes('PERDA') || 
                            (log.type === 'error' && 
                             (log.message.includes('operação') || 
                              log.message.includes('Operação') || 
                              log.message.includes('contrato')));
                
                // Extrair valor da mensagem (se existir)
                const valueMatch = log.message.match(/[\$]?\s?(\d+(\.\d+)?)/);
                const value = valueMatch ? valueMatch[0] : '';
                
                return (
                  <div 
                    key={log.id} 
                    className={`flex items-start text-xs py-1 border-b border-gray-800 ${
                      isLoss ? 'text-red-400' : 
                      isWin ? 'text-[#00e5b3]' : 
                      isEntry ? 'text-blue-300' :
                      'text-[#a0aec0]'
                    }`}
                  >
                    <span className="text-[#566388] inline-block w-16 flex-shrink-0">
                      {formatLogTime(log.timestamp)}
                    </span>
                    <span className="flex items-center flex-1">
                      {isEntry ? <DollarSign className="h-3 w-3 mr-1" /> : (
                        isWin ? <TrendingUp className="h-3 w-3 mr-1" /> : 
                        isLoss ? <TrendingDown className="h-3 w-3 mr-1" /> :
                        <Info className="h-3 w-3 mr-1" />
                      )}
                      <span>
                        {log.message}
                        {value && (
                          <span className={`font-bold ml-1 ${isWin ? 'text-[#00e5b3]' : isLoss ? 'text-red-400' : ''}`}>
                            {value}
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                );
              })}
            <div ref={logEndRef} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}