import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { 
  PlayIcon, PauseIcon, SquareIcon as StopIcon, AlertCircleIcon, SettingsIcon, 
  ArrowUpIcon, ArrowDownIcon, RefreshCwIcon, ArrowRightCircleIcon, 
  BarChart2Icon, TrendingUpIcon, HistoryIcon, 
  ZapIcon, DatabaseIcon, CpuIcon
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";

// Tipos para as estratégias
interface BinaryBotStrategy {
  id: string;
  name: string;
  description: string;
  type: 'OVER' | 'UNDER' | 'BOTH' | 'RISE' | 'FALL' | 'ADVANCED';
  config: {
    initialStake: number;
    martingaleFactor: number;
    maxMartingaleLevel: number;
    targetProfit: number;
    stopLoss: number;
    prediction?: number;
  }
}

// Configurações predefinidas das estratégias
const botStrategies: BinaryBotStrategy[] = [
  {
    id: "iron-over",
    name: "Iron Over",
    description: "Estratégia para operações OVER com martingale controlado",
    type: "OVER",
    config: {
      initialStake: 0.35,
      martingaleFactor: 0.5,
      maxMartingaleLevel: 1,
      targetProfit: 10,
      stopLoss: 2,
      prediction: 5
    }
  },
  {
    id: "iron-under",
    name: "Iron Under",
    description: "Estratégia para operações UNDER com martingale controlado",
    type: "UNDER",
    config: {
      initialStake: 0.35,
      martingaleFactor: 0.5,
      maxMartingaleLevel: 1,
      targetProfit: 10,
      stopLoss: 2,
      prediction: 4
    }
  },
  {
    id: "bot-low",
    name: "Bot Low",
    description: "Estratégia para dígitos baixos com recuperação controlada",
    type: "UNDER",
    config: {
      initialStake: 3,
      martingaleFactor: 0.4,
      maxMartingaleLevel: 3,
      targetProfit: 10,
      stopLoss: 20,
      prediction: 2
    }
  },
  {
    id: "green",
    name: "Green",
    description: "Robô Green com análise avançada de tendências",
    type: "ADVANCED",
    config: {
      initialStake: 1,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 2,
      targetProfit: 25,
      stopLoss: 15
    }
  },
  {
    id: "maxpro",
    name: "MaxPro",
    description: "Estratégia otimizada para índices voláteis",
    type: "BOTH",
    config: {
      initialStake: 3,
      martingaleFactor: 0.4,
      maxMartingaleLevel: 3,
      targetProfit: 10,
      stopLoss: 20,
      prediction: 3
    }
  },
  {
    id: "manual-under",
    name: "Manual Under",
    description: "Estratégia manual para UNDER com configurações ajustáveis",
    type: "UNDER",
    config: {
      initialStake: 2,
      martingaleFactor: 2,
      maxMartingaleLevel: 2,
      targetProfit: 25,
      stopLoss: 2,
      prediction: 6
    }
  },
  {
    id: "manual-over",
    name: "Manual Over",
    description: "Estratégia manual para OVER com configurações ajustáveis",
    type: "OVER",
    config: {
      initialStake: 2,
      martingaleFactor: 1,
      maxMartingaleLevel: 2,
      targetProfit: 2,
      stopLoss: 2,
      prediction: 2
    }
  },
  {
    id: "profit-pro",
    name: "Profit Pro",
    description: "Estratégia avançada com configurações ajustáveis pelo usuário",
    type: "BOTH",
    config: {
      initialStake: 0.35,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 3,
      targetProfit: 10,
      stopLoss: 10
    }
  },
  {
    id: "wise-pro",
    name: "Wise Pro",
    description: "Estratégia baseada em tendências de mercado",
    type: "RISE",
    config: {
      initialStake: 1,
      martingaleFactor: 1.5,
      maxMartingaleLevel: 2,
      targetProfit: 25,
      stopLoss: 100
    }
  },
  {
    id: "advance",
    name: "Advance",
    description: "Sistema avançado com análise de porcentagem",
    type: "BOTH",
    config: {
      initialStake: 5,
      martingaleFactor: 1,
      maxMartingaleLevel: 2,
      targetProfit: 10,
      stopLoss: 100,
      prediction: 1
    }
  }
];

// Status de uma operação
type OperationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';

// Estatísticas da operação
interface BotStats {
  wins: number;
  losses: number;
  winRate: number;
  currentProfit: number;
  maxProfit: number;
  maxLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  totalOperations: number;
  startTime: Date | null;
  elapsedTime: string;
}

// Componente principal da página do bot
export default function BotPage() {
  const [selectedStrategy, setSelectedStrategy] = useState<BinaryBotStrategy | null>(null);
  const [activeConfig, setActiveConfig] = useState<BinaryBotStrategy['config'] | null>(null);
  const [operationStatus, setOperationStatus] = useState<OperationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [autoMode, setAutoMode] = useState(true);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  
  // Estatísticas iniciais
  const initialStats: BotStats = {
    wins: 0,
    losses: 0,
    winRate: 0,
    currentProfit: 0,
    maxProfit: 0,
    maxLoss: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
    totalOperations: 0,
    startTime: null,
    elapsedTime: '00:00:00'
  };
  
  const [stats, setStats] = useState<BotStats>(initialStats);
  
  // Efeito para monitorar o progresso durante a operação
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (operationStatus === 'running') {
      timer = setInterval(() => {
        // Simulando progresso (na implementação real, isso viria da automação)
        setProgress(prev => {
          const targetProgress = (stats.currentProfit / (activeConfig?.targetProfit || 1)) * 100;
          return Math.min(Math.max(0, targetProgress), 100);
        });
        
        // Atualizando tempo decorrido
        if (stats.startTime) {
          const now = new Date();
          const diff = now.getTime() - stats.startTime.getTime();
          const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
          const minutes = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
          const seconds = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
          
          setStats(prev => ({
            ...prev,
            elapsedTime: `${hours}:${minutes}:${seconds}`
          }));
        }
      }, 1000);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [operationStatus, stats.startTime, activeConfig, stats.currentProfit]);
  
  useEffect(() => {
    // Simulando o carregamento do saldo da conta
    setAccountBalance(1000);
    setAccountCurrency('USD');
  }, []);
  
  // Função para selecionar uma estratégia
  const handleStrategySelect = (strategyId: string) => {
    const strategy = botStrategies.find(s => s.id === strategyId);
    if (strategy) {
      setSelectedStrategy(strategy);
      setActiveConfig({...strategy.config});
    }
  };
  
  // Funções para controle da automação
  const startBot = () => {
    if (!selectedStrategy || !activeConfig) return;
    
    setOperationStatus('running');
    setStats({
      ...initialStats,
      startTime: new Date()
    });
    
    // Aqui seria a lógica para iniciar a automação real usando a API Deriv
    console.log(`Iniciando operação com estratégia ${selectedStrategy.name}`, activeConfig);
  };
  
  const pauseBot = () => {
    setOperationStatus('paused');
    // Aqui seria a lógica para pausar a automação
  };
  
  const stopBot = () => {
    setOperationStatus('stopped');
    // Aqui seria a lógica para parar a automação e resetar
  };
  
  const resetBot = () => {
    setOperationStatus('idle');
    setStats(initialStats);
    setProgress(0);
    // Aqui seria a lógica para resetar completamente a automação
  };
  
  // Função para atualizar configurações
  const updateConfig = (key: keyof BinaryBotStrategy['config'], value: number) => {
    if (activeConfig) {
      setActiveConfig({
        ...activeConfig,
        [key]: value
      });
    }
  };
  
  // Simulação de uma operação (apenas para demonstração)
  const simulateOperation = (win: boolean) => {
    if (operationStatus !== 'running') return;
    
    setStats(prev => {
      const newStats = { ...prev };
      
      if (win) {
        newStats.wins += 1;
        newStats.consecutiveWins += 1;
        newStats.consecutiveLosses = 0;
        newStats.currentProfit += activeConfig?.initialStake ? activeConfig.initialStake * 0.92 : 0;
      } else {
        newStats.losses += 1;
        newStats.consecutiveLosses += 1;
        newStats.consecutiveWins = 0;
        newStats.currentProfit -= activeConfig?.initialStake || 0;
      }
      
      newStats.totalOperations += 1;
      newStats.winRate = (newStats.wins / newStats.totalOperations) * 100;
      newStats.maxProfit = Math.max(newStats.maxProfit, newStats.currentProfit);
      newStats.maxLoss = Math.min(newStats.maxLoss, newStats.currentProfit);
      
      return newStats;
    });
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 bg-[#111827] text-white min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Robô de Automações</h1>
        <div className="flex items-center space-x-2">
          {accountBalance !== null && (
            <Card className="bg-[#1a2234] border-none">
              <CardContent className="p-2">
                <div className="flex items-center">
                  <DatabaseIcon className="mr-2 h-4 w-4 text-emerald-400" />
                  <span className="font-medium">
                    {accountBalance.toFixed(2)} {accountCurrency}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      <Tabs defaultValue="strategies" className="w-full">
        <TabsList className="bg-[#1a2234] border-b border-gray-700 w-full justify-start">
          <TabsTrigger value="strategies" className="data-[state=active]:bg-[#2d3748]">
            Estratégias
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-[#2d3748]">
            Configurações
          </TabsTrigger>
          <TabsTrigger value="stats" className="data-[state=active]:bg-[#2d3748]">
            Estatísticas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="strategies" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {botStrategies.map(strategy => (
              <Card 
                key={strategy.id} 
                className={`bg-[#1a2234] border cursor-pointer transition-all hover:border-blue-500 ${selectedStrategy?.id === strategy.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-700'}`}
                onClick={() => handleStrategySelect(strategy.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{strategy.name}</CardTitle>
                      <CardDescription className="text-gray-400 mt-1">
                        {strategy.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center justify-center rounded-full bg-blue-500/20 p-1">
                      {strategy.type === 'OVER' && <ArrowUpIcon className="h-4 w-4 text-blue-500" />}
                      {strategy.type === 'UNDER' && <ArrowDownIcon className="h-4 w-4 text-red-500" />}
                      {strategy.type === 'BOTH' && <RefreshCwIcon className="h-4 w-4 text-green-500" />}
                      {strategy.type === 'RISE' && <TrendingUpIcon className="h-4 w-4 text-green-500" />}
                      {strategy.type === 'FALL' && <TrendingUpIcon className="h-4 w-4 text-red-500" style={{ transform: 'rotate(180deg)' }} />}
                      {strategy.type === 'ADVANCED' && <CpuIcon className="h-4 w-4 text-purple-500" />}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex flex-wrap gap-1">
                    <div className="flex items-center bg-blue-500/10 text-blue-500 rounded px-2 py-0.5 text-xs">
                      <DatabaseIcon className="mr-1 h-3 w-3" /> 
                      {strategy.config.initialStake} USD
                    </div>
                    <div className="flex items-center bg-green-500/10 text-green-500 rounded px-2 py-0.5 text-xs">
                      <ArrowRightCircleIcon className="mr-1 h-3 w-3" /> 
                      Alvo: {strategy.config.targetProfit} USD
                    </div>
                    <div className="flex items-center bg-red-500/10 text-red-500 rounded px-2 py-0.5 text-xs">
                      <AlertCircleIcon className="mr-1 h-3 w-3" /> 
                      Stop: {strategy.config.stopLoss} USD
                    </div>
                    {strategy.config.prediction !== undefined && (
                      <div className="flex items-center bg-purple-500/10 text-purple-500 rounded px-2 py-0.5 text-xs">
                        <ZapIcon className="mr-1 h-3 w-3" /> 
                        Digit: {strategy.config.prediction}
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button 
                    className="w-full" 
                    variant="outline" 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStrategySelect(strategy.id);
                      startBot();
                    }}
                    disabled={operationStatus === 'running'}
                  >
                    Selecionar
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="mt-4">
          <Card className="bg-[#1a2234] border-none">
            <CardHeader>
              <CardTitle>Configurações da Estratégia</CardTitle>
              <CardDescription>
                Ajuste os parâmetros para otimizar sua operação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedStrategy && (
                <div className="text-center py-8 text-gray-400">
                  <SettingsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecione uma estratégia para configurar</p>
                </div>
              )}
              
              {selectedStrategy && activeConfig && (
                <>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="initialStake">Entrada Inicial</Label>
                        <span className="text-sm text-gray-400">{activeConfig.initialStake} USD</span>
                      </div>
                      <Slider 
                        id="initialStake"
                        min={0.35} 
                        max={10} 
                        step={0.05} 
                        value={[activeConfig.initialStake]} 
                        onValueChange={(values) => updateConfig('initialStake', values[0])}
                        disabled={operationStatus === 'running'}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="martingaleFactor">Fator de Martingale</Label>
                        <span className="text-sm text-gray-400">x{activeConfig.martingaleFactor}</span>
                      </div>
                      <Slider 
                        id="martingaleFactor"
                        min={0.2} 
                        max={3} 
                        step={0.1} 
                        value={[activeConfig.martingaleFactor]} 
                        onValueChange={(values) => updateConfig('martingaleFactor', values[0])}
                        disabled={operationStatus === 'running'}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="maxMartingaleLevel">Nível de Martingale</Label>
                        <span className="text-sm text-gray-400">{activeConfig.maxMartingaleLevel}</span>
                      </div>
                      <Slider 
                        id="maxMartingaleLevel"
                        min={1} 
                        max={5} 
                        step={1} 
                        value={[activeConfig.maxMartingaleLevel]} 
                        onValueChange={(values) => updateConfig('maxMartingaleLevel', Math.round(values[0]))}
                        disabled={operationStatus === 'running'}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="targetProfit">Meta de Lucro</Label>
                        <span className="text-sm text-gray-400">{activeConfig.targetProfit} USD</span>
                      </div>
                      <Slider 
                        id="targetProfit"
                        min={1} 
                        max={50} 
                        step={1} 
                        value={[activeConfig.targetProfit]} 
                        onValueChange={(values) => updateConfig('targetProfit', values[0])}
                        disabled={operationStatus === 'running'}
                      />
                    </div>
                    
                    <div>
                      <div className="flex justify-between mb-2">
                        <Label htmlFor="stopLoss">Stop Loss</Label>
                        <span className="text-sm text-gray-400">{activeConfig.stopLoss} USD</span>
                      </div>
                      <Slider 
                        id="stopLoss"
                        min={1} 
                        max={50} 
                        step={1} 
                        value={[activeConfig.stopLoss]} 
                        onValueChange={(values) => updateConfig('stopLoss', values[0])}
                        disabled={operationStatus === 'running'}
                      />
                    </div>
                    
                    {selectedStrategy.type !== 'RISE' && selectedStrategy.type !== 'FALL' && selectedStrategy.type !== 'ADVANCED' && (
                      <div>
                        <div className="flex justify-between mb-2">
                          <Label htmlFor="prediction">Previsão (Dígito)</Label>
                          <span className="text-sm text-gray-400">
                            {activeConfig.prediction !== undefined ? activeConfig.prediction : 'N/A'}
                          </span>
                        </div>
                        <Slider 
                          id="prediction"
                          min={0} 
                          max={9} 
                          step={1} 
                          value={[activeConfig.prediction !== undefined ? activeConfig.prediction : 5]} 
                          onValueChange={(values) => updateConfig('prediction', Math.round(values[0]))}
                          disabled={operationStatus === 'running' || selectedStrategy.type === 'ADVANCED'}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2 pt-4">
                      <Switch 
                        id="autoMode" 
                        checked={autoMode}
                        onCheckedChange={setAutoMode}
                        disabled={operationStatus === 'running'}
                      />
                      <Label htmlFor="autoMode">Modo Automático</Label>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t border-gray-700 flex justify-between">
              <Button 
                variant="outline"
                onClick={resetBot}
                disabled={operationStatus === 'idle'}
              >
                Resetar
              </Button>
              <div className="space-x-2">
                {operationStatus === 'idle' && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={startBot}
                    disabled={!selectedStrategy}
                  >
                    <PlayIcon className="mr-2 h-4 w-4" />
                    Iniciar
                  </Button>
                )}
                
                {operationStatus === 'running' && (
                  <Button
                    variant="outline"
                    onClick={pauseBot}
                  >
                    <PauseIcon className="mr-2 h-4 w-4" />
                    Pausar
                  </Button>
                )}
                
                {operationStatus === 'paused' && (
                  <Button
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => setOperationStatus('running')}
                  >
                    <PlayIcon className="mr-2 h-4 w-4" />
                    Continuar
                  </Button>
                )}
                
                {(operationStatus === 'running' || operationStatus === 'paused') && (
                  <Button
                    variant="destructive"
                    onClick={stopBot}
                  >
                    <StopIcon className="mr-2 h-4 w-4" />
                    Parar
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="stats" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-[#1a2234] border-none">
              <CardHeader>
                <CardTitle>Progresso da Operação</CardTitle>
                <CardDescription>
                  {operationStatus === 'running' && "Operação em andamento"}
                  {operationStatus === 'paused' && "Operação em pausa"}
                  {operationStatus === 'idle' && "Robô pronto para iniciar"}
                  {operationStatus === 'stopped' && "Operação interrompida"}
                  {operationStatus === 'completed' && "Operação concluída"}
                  {operationStatus === 'error' && "Erro na operação"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Progresso da meta</Label>
                    <span className="text-sm text-gray-400">{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
                
                <div className="pt-4 grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Tempo de Execução</Label>
                    <p className="font-mono">{stats.elapsedTime}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Lucro Atual</Label>
                    <p className={`font-mono ${stats.currentProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {stats.currentProfit >= 0 ? '+' : ''}{stats.currentProfit.toFixed(2)} USD
                    </p>
                  </div>
                </div>
                
                {/* Botões de simulação (apenas para demo) */}
                {operationStatus === 'running' && (
                  <div className="flex space-x-2 pt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-green-500 border-green-500/20 hover:bg-green-500/10"
                      onClick={() => simulateOperation(true)}
                    >
                      Simular Win
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-red-500 border-red-500/20 hover:bg-red-500/10"
                      onClick={() => simulateOperation(false)}
                    >
                      Simular Loss
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card className="bg-[#1a2234] border-none">
              <CardHeader>
                <CardTitle>Estatísticas</CardTitle>
                <CardDescription>
                  Métricas da operação atual
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Total de Operações</Label>
                    <p className="font-mono">{stats.totalOperations}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Win Rate</Label>
                    <p className="font-mono">{stats.winRate.toFixed(1)}%</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Wins</Label>
                    <p className="font-mono text-green-500">{stats.wins}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Losses</Label>
                    <p className="font-mono text-red-500">{stats.losses}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Wins Consecutivos</Label>
                    <p className="font-mono">{stats.consecutiveWins}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Losses Consecutivos</Label>
                    <p className="font-mono">{stats.consecutiveLosses}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Lucro Máximo</Label>
                    <p className="font-mono text-green-500">+{stats.maxProfit.toFixed(2)} USD</p>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-400">Perda Máxima</Label>
                    <p className="font-mono text-red-500">{stats.maxLoss.toFixed(2)} USD</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}