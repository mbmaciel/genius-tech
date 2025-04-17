import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Bot, Play, StopCircle, FileText, AlertTriangle } from 'lucide-react';
import derivAPI from '@/lib/derivApi';
import { useLocation } from 'wouter';

interface AutomationState {
  isRunning: boolean;
  symbol: string;
  strategy: string;
  profitLoss: number;
  winRate: number;
  tradesCount: number;
  startTime: number;
}

export function AutomationsRobot() {
  const [isConnected, setIsConnected] = useState(false);
  const [activeAutomation, setActiveAutomation] = useState<AutomationState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Check connection status when component mounts
  useEffect(() => {
    const connectionStatus = derivAPI.getConnectionStatus();
    setIsConnected(connectionStatus);
    
    // Listen for connection status changes
    const handleConnectionStatus = (event: CustomEvent) => {
      setIsConnected(event.detail.connected);
    };
    
    document.addEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    
    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    };
  }, []);

  const formatDuration = (startTime: number): string => {
    const durationMs = Date.now() - startTime;
    const seconds = Math.floor(durationMs / 1000) % 60;
    const minutes = Math.floor(durationMs / (1000 * 60)) % 60;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleNavigateToTradingBot = () => {
    navigate('/trading-bot');
  };

  const handleStopAutomation = () => {
    if (!activeAutomation) return;
    
    setIsLoading(true);
    
    // Simulate stopping automation with slight delay
    setTimeout(() => {
      setActiveAutomation(null);
      setIsLoading(false);
      
      toast({
        title: "Automação Interrompida",
        description: "O robô de operações foi interrompido com sucesso.",
      });
    }, 1000);
  };

  // Simulated active automation for demonstration purposes
  useEffect(() => {
    // Check if we should simulate an active automation
    const mockRunning = localStorage.getItem('trading_bot_running') === 'true';
    
    if (mockRunning && !activeAutomation) {
      const mockData = JSON.parse(localStorage.getItem('trading_bot_data') || '{}');
      
      setActiveAutomation({
        isRunning: true,
        symbol: mockData.symbol || 'R_100',
        strategy: mockData.strategy || 'IRON OVER',
        profitLoss: mockData.profitLoss || 0,
        winRate: mockData.winRate || 0,
        tradesCount: mockData.tradesCount || 0,
        startTime: mockData.startTime || Date.now()
      });
    }
  }, [activeAutomation]);

  return (
    <Card className="bg-[#162440] border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center">
          <Bot className="h-5 w-5 mr-2 text-[#00e5b3]" />
          Robô de Operações
        </CardTitle>
        <CardDescription>
          Automatize suas operações com estratégias predefinidas
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isConnected ? (
          <div className="bg-[#1f3158]/70 rounded-lg p-4 text-center">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-white mb-3">
              Você precisa estar conectado à API Deriv para usar o robô de operações.
            </p>
            <Button
              className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
              onClick={() => navigate('/dashboard')}
            >
              Ir para Conexão
            </Button>
          </div>
        ) : activeAutomation ? (
          <div className="space-y-4">
            <div className="bg-[#1f3158]/50 p-3 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-white">Status:</span>
                <span className="text-[#00e5b3] font-medium flex items-center">
                  <span className="w-2 h-2 bg-[#00e5b3] rounded-full mr-2 animate-pulse"></span>
                  Operando
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div>
                  <p className="text-[#8492b4]">Símbolo</p>
                  <p className="text-white font-medium">{activeAutomation.symbol}</p>
                </div>
                <div>
                  <p className="text-[#8492b4]">Estratégia</p>
                  <p className="text-white font-medium">{activeAutomation.strategy}</p>
                </div>
                <div>
                  <p className="text-[#8492b4]">Duração</p>
                  <p className="text-white font-medium">
                    {formatDuration(activeAutomation.startTime)}
                  </p>
                </div>
                <div>
                  <p className="text-[#8492b4]">Trades</p>
                  <p className="text-white font-medium">{activeAutomation.tradesCount}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#8492b4]">Win Rate</span>
                    <span className="text-xs text-white">{activeAutomation.winRate}%</span>
                  </div>
                  <Progress 
                    value={activeAutomation.winRate} 
                    className="h-2 bg-[#1f3158]" 
                  />
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-[#8492b4] text-sm">Lucro/Prejuízo:</span>
                  <span className={`text-lg font-bold ${activeAutomation.profitLoss >= 0 ? 'text-[#00e5b3]' : 'text-red-500'}`}>
                    {activeAutomation.profitLoss >= 0 ? '+' : ''}{activeAutomation.profitLoss.toFixed(2)} USD
                  </span>
                </div>
              </div>
            </div>
            
            <Button 
              variant="destructive" 
              className="w-full" 
              onClick={handleStopAutomation}
              disabled={isLoading}
            >
              <StopCircle className="mr-2 h-4 w-4" />
              {isLoading ? 'Interrompendo...' : 'Interromper Operações'}
            </Button>
          </div>
        ) : (
          <div className="text-center p-4">
            <Bot className="h-12 w-12 mx-auto mb-4 text-[#00e5b3] opacity-70" />
            <h3 className="text-white font-medium mb-2">Nenhuma automação ativa</h3>
            <p className="text-[#8492b4] text-sm mb-4">
              Configure o robô de operações para começar a operar automaticamente com suas estratégias preferidas.
            </p>
            <Button
              className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
              onClick={handleNavigateToTradingBot}
            >
              <Play className="mr-2 h-4 w-4" />
              Configurar Robô
            </Button>
          </div>
        )}
      </CardContent>
      
      {activeAutomation && (
        <CardFooter className="pt-0">
          <Button
            variant="outline"
            className="w-full border-[#1c3654] hover:bg-[#1c3654] text-white"
            onClick={handleNavigateToTradingBot}
          >
            <FileText className="mr-2 h-4 w-4" />
            Ver Detalhes
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
