import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Operation } from '@/components/trading/OperationHistoryCard';
import { strategies, getStrategyById } from '@/lib/strategiesConfig';
import { oauthDirectService } from '@/services/oauthDirectService';
import { parseStrategyXml } from '@/services/xmlStrategyParser';
import {
  Play,
  StopCircle,
  ActivitySquare,
  AlertTriangle,
  Gauge,
  Wallet,
  Loader2
} from 'lucide-react';

interface BotControllerProps {
  symbol: string;
  strategy: string;
  initialStake: number;
  targetProfit: number;
  stopLoss: number;
  martingaleFactor: number;
  advanceSettings?: {
    entryThreshold: number;
    analysisVolume: number;
    prediction: number;
  };
  onStart: () => void;
  onStop: () => void;
  onOperationUpdate: (operations: Operation[]) => void;
  onStatsUpdate: (stats: any) => void;
  disabled?: boolean;
}

// Interface para estatísticas de operações
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
  averageProfit?: number;
  averageLoss?: number;
}

// Estado para o controlador do bot
interface BotState {
  running: boolean;
  status: 'idle' | 'running' | 'paused' | 'error';
  message: string;
  operations: Operation[];
  stats: OperationStats;
  balance: number | null;
  strategyXml: string | null;
  error: string | null;
  lastTick: {
    value: number;
    timestamp: number;
    lastDigit: number;
  } | null;
  digitStats: Map<number, { count: number; percentage: number }>;
}

const BotController: React.FC<BotControllerProps> = ({
  symbol,
  strategy,
  initialStake,
  targetProfit,
  stopLoss,
  martingaleFactor,
  advanceSettings,
  onStart,
  onStop,
  onOperationUpdate,
  onStatsUpdate,
  disabled = false
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [botState, setBotState] = useState<BotState>({
    running: false,
    status: 'idle',
    message: t('Pronto para iniciar'),
    operations: [],
    stats: {
      totalOperations: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalProfit: 0,
      bestStreak: 0,
      worstStreak: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0
    },
    balance: null,
    strategyXml: null,
    error: null,
    lastTick: null,
    digitStats: new Map()
  });
  
  // Referências para o estado atual
  const currentSymbol = useRef(symbol);
  const currentStrategy = useRef(strategy);
  const currentStake = useRef(initialStake);
  const currentProfit = useRef(0);
  const ticksBuffer = useRef<number[]>([]);
  const contractsInProgress = useRef<Map<number, any>>(new Map());
  const currentMartingaleLevel = useRef(0);
  const currentStakeValue = useRef(initialStake);
  
  // Efeito para atualizar referências quando props mudam
  useEffect(() => {
    currentSymbol.current = symbol;
    currentStrategy.current = strategy;
    currentStake.current = initialStake;
  }, [symbol, strategy, initialStake]);
  
  // Função para carregar o XML da estratégia
  const loadStrategyXml = async () => {
    try {
      const strategyConfig = getStrategyById(strategy);
      if (!strategyConfig) {
        throw new Error(t('Estratégia não encontrada'));
      }
      
      // Usando path normalizado para fetch
      const xmlPath = strategyConfig.xmlPath.startsWith('/') 
        ? strategyConfig.xmlPath.substring(1) 
        : strategyConfig.xmlPath;
      
      const response = await fetch(xmlPath);
      if (!response.ok) {
        throw new Error(t('Falha ao carregar o arquivo XML da estratégia'));
      }
      
      const xmlText = await response.text();
      setBotState(prev => ({ ...prev, strategyXml: xmlText }));
      return xmlText;
    } catch (error: any) {
      setBotState(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
        message: t('Erro ao carregar estratégia')
      }));
      
      toast({
        title: t('Erro ao carregar estratégia'),
        description: error.message,
        variant: 'destructive'
      });
      
      return null;
    }
  };
  
  // Função para iniciar o bot
  const startBot = async () => {
    try {
      // Conectar ao servidor WebSocket
      await oauthDirectService.connect();
      
      // Verificar se a conexão foi bem-sucedida
      if (!oauthDirectService.isSocketConnected()) {
        throw new Error(t('Falha ao conectar ao servidor da Deriv'));
      }
      
      // Verificar balanço
      const balanceResponse = await oauthDirectService.getBalance();
      if (!balanceResponse || !balanceResponse.balance) {
        throw new Error(t('Não foi possível obter o balanço da conta'));
      }
      
      const balance = balanceResponse.balance.balance;
      
      if (balance < initialStake) {
        throw new Error(t('Saldo insuficiente para iniciar as operações'));
      }
      
      // Carregar XML da estratégia
      const xmlText = await loadStrategyXml();
      if (!xmlText) {
        throw new Error(t('Falha ao carregar a estratégia'));
      }
      
      // Analisar XML para extrair parâmetros
      const parsedStrategy = parseStrategyXml(xmlText);
      if (!parsedStrategy) {
        throw new Error(t('Falha ao analisar o arquivo de estratégia'));
      }
      
      // Resetar contadores e estado
      currentProfit.current = 0;
      ticksBuffer.current = [];
      contractsInProgress.current.clear();
      currentMartingaleLevel.current = 0;
      currentStakeValue.current = initialStake;
      
      // Atualizar estado do bot
      setBotState(prev => ({
        ...prev,
        running: true,
        status: 'running',
        message: t('Bot iniciado'),
        operations: [],
        stats: {
          totalOperations: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalProfit: 0,
          bestStreak: 0,
          worstStreak: 0,
          consecutiveWins: 0,
          consecutiveLosses: 0
        },
        balance,
        error: null,
        lastTick: null,
        digitStats: new Map()
      }));
      
      // Registrar para receber atualizações de ticks
      oauthDirectService.subscribeTicks(symbol, handleTickUpdate);
      
      // Registrar para receber atualizações de contratos
      oauthDirectService.addMessageListener('proposal_open_contract', handleContractUpdate);
      
      // Notificar o componente pai
      onStart();
      
      toast({
        title: t('Bot iniciado'),
        description: t('Monitorando mercado {{symbol}}', { symbol }),
        variant: 'default'
      });
    } catch (error: any) {
      setBotState(prev => ({
        ...prev,
        status: 'error',
        error: error.message,
        message: t('Erro ao iniciar bot')
      }));
      
      toast({
        title: t('Erro ao iniciar o bot'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  
  // Função para parar o bot
  const stopBot = async () => {
    try {
      // Desinscrever dos ticks
      oauthDirectService.unsubscribeTicks(symbol, handleTickUpdate);
      
      // Remover listener de contratos
      oauthDirectService.removeMessageListener('proposal_open_contract', handleContractUpdate);
      
      // Atualizar estado
      setBotState(prev => ({
        ...prev,
        running: false,
        status: 'idle',
        message: t('Bot parado')
      }));
      
      // Notificar componente pai
      onStop();
      
      toast({
        title: t('Bot parado'),
        description: t('Operações finalizadas'),
        variant: 'default'
      });
    } catch (error: any) {
      console.error('Erro ao parar bot:', error);
      toast({
        title: t('Erro ao parar bot'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  
  // Handler para atualização de ticks
  const handleTickUpdate = (data: any) => {
    if (!data || !data.tick || !botState.running) return;
    
    const tick = data.tick;
    const price = tick.quote;
    const timestamp = tick.epoch;
    
    // Extrair último dígito
    const priceStr = price.toFixed(2);
    const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));
    
    // Atualizar buffer de ticks
    ticksBuffer.current.push(lastDigit);
    
    // Manter apenas os N ticks mais recentes para análise
    const analysisSize = advanceSettings?.analysisVolume || 25;
    if (ticksBuffer.current.length > analysisSize) {
      ticksBuffer.current = ticksBuffer.current.slice(
        ticksBuffer.current.length - analysisSize
      );
    }
    
    // Atualizar estatísticas de dígitos
    const digitStats = calculateDigitStats(ticksBuffer.current);
    
    // Atualizar estado com o último tick
    setBotState(prev => ({
      ...prev,
      lastTick: {
        value: price,
        timestamp,
        lastDigit
      },
      digitStats
    }));
    
    // Verificar condição de entrada se o bot estiver rodando
    if (botState.running) {
      checkEntryCondition(digitStats);
    }
  };
  
  // Calcular estatísticas de dígitos
  const calculateDigitStats = (digits: number[]) => {
    const stats = new Map<number, { count: number; percentage: number }>();
    
    // Inicializar contagem para todos os dígitos (0-9)
    for (let i = 0; i < 10; i++) {
      stats.set(i, { count: 0, percentage: 0 });
    }
    
    // Contar ocorrências
    for (const digit of digits) {
      const current = stats.get(digit);
      if (current) {
        stats.set(digit, {
          count: current.count + 1,
          percentage: 0 // Será calculado abaixo
        });
      }
    }
    
    // Calcular porcentagens
    for (let i = 0; i < 10; i++) {
      const stat = stats.get(i);
      if (stat) {
        stats.set(i, {
          ...stat,
          percentage: (stat.count / digits.length) * 100
        });
      }
    }
    
    return stats;
  };
  
  // Verificar condição de entrada baseado na estratégia
  const checkEntryCondition = (digitStats: Map<number, { count: number; percentage: number }>) => {
    if (!botState.running || contractsInProgress.current.size > 0) return;
    
    try {
      // Estratégia selecionada
      const strategyConfig = getStrategyById(currentStrategy.current);
      if (!strategyConfig) return;
      
      // Verificar tipo de estratégia
      switch (strategyConfig.id) {
        case 'advance':
          // Estratégia Advance: verificar frequência de dígitos 0-1
          const threshold = advanceSettings?.entryThreshold || 30;
          
          // Somar porcentagens de dígitos 0 e 1
          const zeroPercent = digitStats.get(0)?.percentage || 0;
          const onePercent = digitStats.get(1)?.percentage || 0;
          const lowDigitsPercent = zeroPercent + onePercent;
          
          // Se a porcentagem de 0-1 for menor ou igual ao limite, fazer entrada
          if (lowDigitsPercent <= threshold) {
            executeContractBuy({
              contractType: 'DIGITOVER',
              prediction: advanceSettings?.prediction || 1,
              stake: currentStakeValue.current
            });
          }
          break;
          
        default:
          // Outras estratégias seriam implementadas aqui
          break;
      }
    } catch (error: any) {
      console.error('Erro ao verificar condição de entrada:', error);
    }
  };
  
  // Executar compra de contrato
  const executeContractBuy = async (params: {
    contractType: string;
    prediction?: number;
    stake: number;
    barrier?: string;
  }) => {
    try {
      // Verificar se o bot está rodando
      if (!botState.running) return;
      
      // Parâmetros do contrato
      const buyParams = {
        contract_type: params.contractType,
        symbol: currentSymbol.current,
        amount: params.stake,
        basis: 'stake',
        duration: 1,
        duration_unit: 't',
      };
      
      // Adicionar predição se necessário (para contratos DIGIT)
      if (params.prediction !== undefined && params.contractType.includes('DIGIT')) {
        buyParams.prediction = params.prediction;
      }
      
      // Adicionar barreira se fornecida
      if (params.barrier) {
        buyParams.barrier = params.barrier;
      }
      
      // Comprar contrato
      const response = await oauthDirectService.buyContract(buyParams);
      
      // Verificar resposta
      if (response && response.buy) {
        const contract = response.buy;
        
        // Registrar contrato em andamento
        contractsInProgress.current.set(contract.contract_id, {
          id: contract.contract_id,
          buy_price: contract.buy_price,
          transaction_id: contract.transaction_id,
          purchase_time: new Date().getTime(),
          symbol: currentSymbol.current,
          contract_type: params.contractType
        });
        
        // Adicionar à lista de operações
        const newOperation: Operation = {
          id: Math.random().toString(36).substring(2, 9),
          contract_id: contract.contract_id,
          entry_value: parseFloat(botState.lastTick?.value.toFixed(2) || '0'),
          time: new Date(),
          timestamp: new Date().getTime(),
          contract_type: params.contractType,
          symbol: currentSymbol.current,
          strategy: currentStrategy.current,
          notification: {
            type: 'info',
            message: t('Contrato comprado')
          }
        };
        
        // Atualizar operações
        setBotState(prev => {
          const updatedOperations = [...prev.operations, newOperation];
          onOperationUpdate(updatedOperations);
          return {
            ...prev,
            operations: updatedOperations,
            message: t('Contrato comprado: ID {{id}}', { id: contract.contract_id })
          };
        });
      } else if (response && response.error) {
        throw new Error(response.error.message || t('Erro ao comprar contrato'));
      }
    } catch (error: any) {
      console.error('Erro ao executar compra:', error);
      toast({
        title: t('Erro ao comprar contrato'),
        description: error.message,
        variant: 'destructive'
      });
    }
  };
  
  // Handler para atualizações de contratos
  const handleContractUpdate = (data: any) => {
    if (!data || !data.proposal_open_contract || !botState.running) return;
    
    const contract = data.proposal_open_contract;
    
    // Se o contrato não está sendo monitorado, ignorar
    if (!contractsInProgress.current.has(contract.contract_id)) return;
    
    // Se o contrato foi finalizado
    if (contract.status === 'sold' || contract.status === 'won' || contract.status === 'lost') {
      // Remover da lista de contratos em andamento
      contractsInProgress.current.delete(contract.contract_id);
      
      // Determinar resultado
      const isWin = contract.status === 'won';
      const profit = parseFloat(contract.profit);
      
      // Atualizar estatísticas
      updateStats(isWin, profit);
      
      // Atualizar operação existente
      setBotState(prev => {
        const updatedOperations = prev.operations.map(op => {
          if (op.contract_id === contract.contract_id) {
            return {
              ...op,
              exit_value: parseFloat(contract.exit_tick || '0'),
              profit,
              is_win: isWin,
              notification: {
                type: isWin ? 'success' : 'error',
                message: isWin ? t('Ganho') : t('Perda')
              }
            };
          }
          return op;
        });
        
        // Atualizar balanço se disponível
        const newBalance = prev.balance !== null ? prev.balance + profit : null;
        
        // Notificar componente pai com operações atualizadas
        onOperationUpdate(updatedOperations);
        
        return {
          ...prev,
          operations: updatedOperations,
          balance: newBalance,
          message: t('Contrato finalizado: {{result}}', {
            result: isWin ? t('Ganho') : t('Perda')
          })
        };
      });
      
      // Ajustar stake para próxima operação (martingale)
      if (isWin) {
        // Reset em caso de vitória
        currentMartingaleLevel.current = 0;
        currentStakeValue.current = currentStake.current;
      } else {
        // Aumentar stake em caso de derrota
        currentMartingaleLevel.current++;
        currentStakeValue.current = currentStake.current * Math.pow(martingaleFactor, currentMartingaleLevel.current);
      }
      
      // Verificar stop loss e take profit
      checkStopConditions();
    }
  };
  
  // Atualizar estatísticas de operações
  const updateStats = (isWin: boolean, profit: number) => {
    setBotState(prev => {
      // Calcular novas estatísticas
      const wins = isWin ? prev.stats.wins + 1 : prev.stats.wins;
      const losses = !isWin ? prev.stats.losses + 1 : prev.stats.losses;
      const totalOperations = prev.stats.totalOperations + 1;
      const totalProfit = prev.stats.totalProfit + profit;
      const winRate = totalOperations > 0 ? wins / totalOperations : 0;
      
      // Calcular sequências de vitórias/derrotas
      let consecutiveWins = isWin ? prev.stats.consecutiveWins + 1 : 0;
      let consecutiveLosses = !isWin ? prev.stats.consecutiveLosses + 1 : 0;
      const bestStreak = Math.max(prev.stats.bestStreak, consecutiveWins);
      const worstStreak = Math.max(prev.stats.worstStreak, consecutiveLosses);
      
      // Calcular médias
      const averageProfit = wins > 0 
        ? (totalProfit + (prev.stats.losses * Math.abs(profit))) / wins 
        : 0;
      const averageLoss = losses > 0 
        ? (totalProfit - (prev.stats.wins * Math.abs(profit))) / losses * -1 
        : 0;
      
      const updatedStats = {
        totalOperations,
        wins,
        losses,
        winRate,
        totalProfit,
        bestStreak,
        worstStreak,
        consecutiveWins,
        consecutiveLosses,
        averageProfit,
        averageLoss
      };
      
      // Notificar componente pai
      onStatsUpdate(updatedStats);
      
      return {
        ...prev,
        stats: updatedStats
      };
    });
  };
  
  // Verificar condições de parada (stop loss e take profit)
  const checkStopConditions = () => {
    // Verificar se o bot está rodando
    if (!botState.running) return;
    
    // Obter lucro total atual
    const totalProfit = botState.stats.totalProfit;
    
    // Verificar take profit
    if (targetProfit > 0 && totalProfit >= targetProfit) {
      stopBot();
      toast({
        title: t('Meta de lucro atingida'),
        description: t('Bot parado automaticamente'),
        variant: 'default'
      });
      return;
    }
    
    // Verificar stop loss
    if (stopLoss > 0 && totalProfit <= -stopLoss) {
      stopBot();
      toast({
        title: t('Stop loss atingido'),
        description: t('Bot parado automaticamente'),
        variant: 'destructive'
      });
      return;
    }
  };
  
  // Selecionar botão de ação baseado no estado
  const renderActionButton = () => {
    if (botState.running) {
      return (
        <Button 
          variant="destructive" 
          size="lg"
          onClick={stopBot}
          disabled={disabled}
          className="w-full"
        >
          <StopCircle className="mr-2 h-5 w-5" />
          {t('Parar Bot')}
        </Button>
      );
    } else {
      return (
        <Button 
          variant="default" 
          size="lg"
          onClick={startBot}
          disabled={disabled}
          className="w-full"
        >
          <Play className="mr-2 h-5 w-5" />
          {t('Iniciar Bot')}
        </Button>
      );
    }
  };
  
  // Função para renderizar badges de status
  const renderStatusBadge = () => {
    switch (botState.status) {
      case 'running':
        return (
          <Badge variant="default" className="text-xs">
            <ActivitySquare className="h-3 w-3 mr-1 animate-pulse" />
            {t('Em execução')}
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="text-xs">
            <AlertTriangle className="h-3 w-3 mr-1" />
            {t('Erro')}
          </Badge>
        );
      case 'paused':
        return (
          <Badge variant="outline" className="text-xs">
            {t('Pausado')}
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs">
            {t('Pronto')}
          </Badge>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-0">
        <div className="flex justify-between items-center">
          <CardTitle className="text-xl">{t('Controle do Bot')}</CardTitle>
          {renderStatusBadge()}
        </div>
        <CardDescription>
          {botState.message}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="flex flex-col border rounded-md p-3">
            <span className="text-xs text-muted-foreground">{t('Lucro/Perda')}</span>
            <div className="flex items-center mt-1">
              <Wallet className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className={`text-xl font-bold ${
                botState.stats.totalProfit > 0 
                  ? 'text-green-500' 
                  : botState.stats.totalProfit < 0 
                    ? 'text-red-500' 
                    : ''
              }`}>
                {botState.stats.totalProfit > 0 ? '+' : ''}
                {botState.stats.totalProfit.toFixed(2)}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col border rounded-md p-3">
            <span className="text-xs text-muted-foreground">{t('Taxa de Acerto')}</span>
            <div className="flex items-center mt-1">
              <Gauge className="h-4 w-4 mr-2 text-muted-foreground" />
              <span className="text-xl font-bold">
                {(botState.stats.winRate * 100).toFixed(0)}%
              </span>
              <span className="text-xs text-muted-foreground ml-2">
                ({botState.stats.wins}/{botState.stats.totalOperations})
              </span>
            </div>
          </div>
        </div>
        
        <div className="border rounded-md p-4 mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span>{t('Último preço')}</span>
            <span>{t('Último dígito')}</span>
          </div>
          
          {botState.lastTick ? (
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold">
                {botState.lastTick.value.toFixed(2)}
              </span>
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold">
                {botState.lastTick.lastDigit}
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center py-2 text-muted-foreground">
              {botState.running ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : null}
              <span>{t('Aguardando dados')}</span>
            </div>
          )}
        </div>
        
        {botState.error && (
          <div className="border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 rounded-md p-3 mb-6">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                  {t('Erro')}
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {botState.error}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {renderActionButton()}
      </CardContent>
    </Card>
  );
};

export default BotController;