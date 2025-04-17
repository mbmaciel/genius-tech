import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PlayIcon, PauseIcon, SquareIcon as StopIcon, RefreshCwIcon } from "lucide-react";
import { 
  automationService, 
  BinaryBotStrategy, 
  BotConfig,
  OperationStats,
  OperationStatus
} from "../lib/automationService";

interface BotControllerProps {
  selectedStrategy?: BinaryBotStrategy | null;
  config?: BotConfig | null;
  onStatusChange?: (status: OperationStatus) => void;
}

export function BotController({ selectedStrategy, config, onStatusChange }: BotControllerProps) {
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [currentProfit, setCurrentProfit] = useState(0);
  const [stats, setStats] = useState<OperationStats | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Registra um listener para mensagens de log
  useEffect(() => {
    const removeLogListener = automationService.onLog((message) => {
      setLogs(prev => [...prev.slice(-99), message]);
    });
    
    // Registra um listener para atualizações de estatísticas
    const removeStatsListener = automationService.onStatsUpdate((updatedStats) => {
      setStats(updatedStats);
      
      // Atualiza o progresso com base no lucro vs. meta
      if (config && config.targetProfit > 0) {
        const profitProgress = (updatedStats.netResult / config.targetProfit) * 100;
        setProgress(Math.min(100, Math.max(0, profitProgress)));
      }
      
      setCurrentProfit(updatedStats.netResult);
    });
    
    // Limpa os listeners ao desmontar
    return () => {
      removeLogListener();
      removeStatsListener();
    };
  }, [config]);
  
  // Monitora as mudanças de status
  useEffect(() => {
    const checkStatus = () => {
      const currentStatus = automationService.getOperationStatus();
      setStatus(currentStatus);
      if (onStatusChange) {
        onStatusChange(currentStatus);
      }
    };
    
    // Verifica o status inicialmente
    checkStatus();
    
    // Configura um intervalo para verificar regularmente
    const interval = setInterval(checkStatus, 1000);
    
    return () => {
      clearInterval(interval);
    };
  }, [onStatusChange]);
  
  // Handlers para os botões de controle
  const handleStart = () => {
    if (!selectedStrategy || !config) return;
    
    automationService.startBot(selectedStrategy, config);
    setStatus('running');
  };
  
  const handlePause = () => {
    automationService.pauseBot();
    setStatus('paused');
  };
  
  const handleResume = () => {
    automationService.resumeBot();
    setStatus('running');
  };
  
  const handleStop = () => {
    automationService.stopBot();
    setStatus('stopped');
  };
  
  const handleReset = () => {
    automationService.stopBot();
    setStatus('idle');
    setProgress(0);
    setCurrentProfit(0);
    setLogs([]);
  };
  
  return (
    <Card className="bg-[#1a2234] border-[#2a3756] shadow">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Controle do Robô</span>
          
          <div className="text-sm font-normal">
            {status === 'idle' && <span className="text-gray-400">Pronto</span>}
            {status === 'running' && <span className="text-green-500">Em Execução</span>}
            {status === 'paused' && <span className="text-yellow-500">Pausado</span>}
            {status === 'stopped' && <span className="text-orange-500">Parado</span>}
            {status === 'completed' && <span className="text-blue-500">Concluído</span>}
            {status === 'error' && <span className="text-red-500">Erro</span>}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Estratégia selecionada */}
        {selectedStrategy && (
          <div className="text-sm">
            <span className="text-gray-400 mr-2">Estratégia:</span>
            <span className="font-medium text-white">{selectedStrategy.name}</span>
          </div>
        )}
        
        {/* Barra de progresso */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Progresso</span>
            <span className={currentProfit >= 0 ? "text-green-500" : "text-red-500"}>
              {currentProfit >= 0 ? '+' : ''}{currentProfit.toFixed(2)} USD
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Logs (últimas 3 entradas) */}
        <div className="mt-2 space-y-1 bg-[#141b2d] rounded p-2 h-24 overflow-y-auto">
          {logs.slice(-3).map((log, index) => (
            <div key={index} className="text-xs text-gray-300">{log}</div>
          ))}
          {logs.length === 0 && (
            <div className="text-xs text-gray-500 italic">Nenhuma atividade registrada</div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={status === 'idle'}
        >
          <RefreshCwIcon className="h-4 w-4 mr-1" />
          Resetar
        </Button>
        
        <div className="space-x-2">
          {status === 'idle' && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleStart}
              disabled={!selectedStrategy || !config}
            >
              <PlayIcon className="h-4 w-4 mr-1" />
              Iniciar
            </Button>
          )}
          
          {status === 'running' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handlePause}
              >
                <PauseIcon className="h-4 w-4 mr-1" />
                Pausar
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
              >
                <StopIcon className="h-4 w-4 mr-1" />
                Parar
              </Button>
            </>
          )}
          
          {status === 'paused' && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={handleResume}
              >
                <PlayIcon className="h-4 w-4 mr-1" />
                Continuar
              </Button>
              
              <Button
                size="sm"
                variant="destructive"
                onClick={handleStop}
              >
                <StopIcon className="h-4 w-4 mr-1" />
                Parar
              </Button>
            </>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}