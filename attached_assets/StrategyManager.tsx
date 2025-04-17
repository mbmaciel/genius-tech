import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { AlertCircle, CheckCircle, Play, StopCircle } from "lucide-react";
import { derivAPI } from '@/lib/derivApi';

// Lista de estratégias disponíveis
const AVAILABLE_STRATEGIES = [
  { id: 'IRON_OVER', name: 'IRON OVER', description: 'Estratégia que aposta em dígitos maiores que 5', defaultPrevisao: 5 },
  { id: 'IRON_UNDER', name: 'IRON UNDER', description: 'Estratégia que aposta em dígitos menores que 4', defaultPrevisao: 4 },
  { id: 'BOT_LOW', name: 'BOT LOW', description: 'Estratégia otimizada para dígitos baixos', defaultPrevisao: 2 },
  { id: 'MAXPRO', name: 'MAXPRO', description: 'Estratégia avançada com martingale inteligente', defaultPrevisao: 3 },
];

interface StrategySettings {
  valorInicial: number;
  valorAposVencer: number;
  previsao: number;
  martingale: number;
  meta: number;
  limitePerda: number;
  lossVirtual: number;
}

export function StrategyManager() {
  const [isActive, setIsActive] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string>(AVAILABLE_STRATEGIES[0].id);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastTick, setLastTick] = useState<number | null>(null);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [operationResult, setOperationResult] = useState<'win' | 'loss' | null>(null);
  const [tradesCount, setTradesCount] = useState({ wins: 0, losses: 0 });
  const [profit, setProfit] = useState(0);
  
  // Configurações da estratégia
  const [settings, setSettings] = useState<StrategySettings>({
    valorInicial: 0.35,
    valorAposVencer: 0.35,
    previsao: 5,
    martingale: 0.5,
    meta: 10,
    limitePerda: 5,
    lossVirtual: 1
  });

  // Atualizar configurações com base na estratégia selecionada
  useEffect(() => {
    const strategy = AVAILABLE_STRATEGIES.find(s => s.id === selectedStrategy);
    if (strategy) {
      setSettings(prev => ({
        ...prev,
        previsao: strategy.defaultPrevisao
      }));
    }
  }, [selectedStrategy]);

  // Verificar conexão com a API
  useEffect(() => {
    const checkConnection = async () => {
      const connected = derivAPI.getConnectionStatus();
      setIsConnected(connected);
      
      if (!connected) {
        try {
          await derivAPI.connect();
          setIsConnected(true);
        } catch (error) {
          console.error('Erro ao conectar à API Deriv:', error);
          setIsConnected(false);
        }
      }
    };
    
    checkConnection();
    
    // Monitorar ticks para atualização em tempo real
    const setupTickListener = async () => {
      try {
        await derivAPI.subscribeTicks('R_100');
        
        const tickHandler = (event: any) => {
          if (event.detail && event.detail.tick && event.detail.tick.symbol === 'R_100') {
            const tickValue = event.detail.tick.quote;
            setLastTick(tickValue);
            
            // Extrair o último dígito
            const digit = Math.floor(tickValue * 100) % 10;
            setLastDigit(digit);
            
            // Verificar resultado se a estratégia estiver ativa
            if (isActive) {
              checkTradeResult(digit);
            }
          }
        };
        
        document.addEventListener('deriv:tick', tickHandler);
        
        return () => {
          document.removeEventListener('deriv:tick', tickHandler);
          derivAPI.unsubscribeTicks('R_100').catch(console.error);
        };
      } catch (error) {
        console.error('Erro ao configurar monitor de ticks:', error);
      }
    };
    
    setupTickListener();
  }, [isActive]);
  
  // Verificar resultado da operação com base no dígito recebido
  const checkTradeResult = (digit: number) => {
    const strategy = AVAILABLE_STRATEGIES.find(s => s.id === selectedStrategy);
    
    // Verificar se é win ou loss com base na estratégia
    let isWin = false;
    
    if (selectedStrategy === 'IRON_OVER') {
      isWin = digit > settings.previsao;
    } else if (selectedStrategy === 'IRON_UNDER') {
      isWin = digit < settings.previsao;
    } else if (selectedStrategy === 'BOT_LOW') {
      isWin = digit <= settings.previsao;
    } else if (selectedStrategy === 'MAXPRO') {
      isWin = digit >= settings.previsao;
    }
    
    // Atualizar estado
    setOperationResult(isWin ? 'win' : 'loss');
    
    // Atualizar contadores
    if (isWin) {
      setTradesCount(prev => ({ ...prev, wins: prev.wins + 1 }));
      setProfit(prev => prev + settings.valorInicial * 0.95); // Lucro aproximado de 95%
    } else {
      setTradesCount(prev => ({ ...prev, losses: prev.losses + 1 }));
      setProfit(prev => prev - settings.valorInicial);
    }
    
    // Aplicar Martingale se necessário
    if (!isWin) {
      applyMartingale();
    } else {
      // Resetar valor após ganhar
      setSettings(prev => ({
        ...prev,
        valorInicial: prev.valorAposVencer
      }));
    }
    
    // Verificar se atingiu meta ou limite
    checkLimits();
  };
  
  // Aplicar estratégia de Martingale após perda
  const applyMartingale = () => {
    setSettings(prev => ({
      ...prev,
      valorInicial: prev.valorInicial + (prev.valorInicial * prev.martingale)
    }));
  };
  
  // Verificar se atingiu metas ou limites
  const checkLimits = () => {
    // Verificar meta de lucro
    if (profit >= settings.meta) {
      setIsActive(false);
      alert(`Meta de lucro atingida: ${profit.toFixed(2)}`);
    }
    
    // Verificar limite de perda
    if (profit <= -settings.limitePerda) {
      setIsActive(false);
      alert(`Limite de perda atingido: ${profit.toFixed(2)}`);
    }
  };
  
  // Iniciar/parar estratégia
  const toggleStrategy = () => {
    if (!isConnected) {
      alert('É necessário estar conectado à API Deriv para iniciar a estratégia');
      return;
    }
    
    if (isActive) {
      // Parar estratégia
      setIsActive(false);
    } else {
      // Iniciar estratégia
      setIsActive(true);
    }
  };
  
  // Resetar estatísticas
  const resetStats = () => {
    setTradesCount({ wins: 0, losses: 0 });
    setProfit(0);
    setOperationResult(null);
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Gerenciador de Estratégias</CardTitle>
        <CardDescription>
          Selecione e configure suas estratégias de trading automatizado
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Status de conexão */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-500" />
            )}
            <span>Status da API: {isConnected ? 'Conectado' : 'Desconectado'}</span>
          </div>
          
          <Button 
            variant={isActive ? "destructive" : "default"}
            onClick={toggleStrategy}
            disabled={!isConnected}
            className={isActive ? "bg-red-500 hover:bg-red-600" : "bg-[#00e5b3] hover:bg-[#00c9a0] text-black"}
          >
            {isActive ? (
              <>
                <StopCircle className="mr-2 h-4 w-4" />
                Parar Estratégia
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Iniciar Estratégia
              </>
            )}
          </Button>
        </div>
        
        {/* Seleção de estratégia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="strategy">Estratégia</Label>
            <Select 
              value={selectedStrategy} 
              onValueChange={setSelectedStrategy}
              disabled={isActive}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma estratégia" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_STRATEGIES.map(strategy => (
                  <SelectItem key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {AVAILABLE_STRATEGIES.find(s => s.id === selectedStrategy)?.description}
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="previsao">Previsão (0-9)</Label>
            <div className="flex items-center space-x-2">
              <Input 
                id="previsao" 
                type="number" 
                min={0} 
                max={9} 
                value={settings.previsao}
                onChange={e => setSettings({...settings, previsao: Number(e.target.value)})}
                disabled={isActive}
              />
            </div>
            <p className="text-xs text-gray-500">
              Valor de previsão para a estratégia selecionada
            </p>
          </div>
        </div>
        
        {/* Configurações de valor */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="valorInicial">Valor Inicial</Label>
            <Input 
              id="valorInicial" 
              type="number" 
              min={0.35} 
              step={0.01} 
              value={settings.valorInicial}
              onChange={e => setSettings({...settings, valorInicial: Number(e.target.value)})}
              disabled={isActive}
            />
            <p className="text-xs text-gray-500">
              Valor inicial da aposta (mínimo 0.35)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="valorAposVencer">Valor Após Vencer</Label>
            <Input 
              id="valorAposVencer" 
              type="number" 
              min={0.35} 
              step={0.01} 
              value={settings.valorAposVencer}
              onChange={e => setSettings({...settings, valorAposVencer: Number(e.target.value)})}
              disabled={isActive}
            />
            <p className="text-xs text-gray-500">
              Valor a usar após uma vitória
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="martingale">Fator Martingale</Label>
            <Input 
              id="martingale" 
              type="number" 
              min={0.1} 
              max={2} 
              step={0.1} 
              value={settings.martingale}
              onChange={e => setSettings({...settings, martingale: Number(e.target.value)})}
              disabled={isActive}
            />
            <p className="text-xs text-gray-500">
              Multiplicador após perda (0.5 = 50% a mais)
            </p>
          </div>
        </div>
        
        {/* Configurações de limites */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="meta">Meta de Lucro</Label>
            <div className="flex items-center space-x-2">
              <Input 
                id="meta" 
                type="number" 
                min={1} 
                value={settings.meta}
                onChange={e => setSettings({...settings, meta: Number(e.target.value)})}
                disabled={isActive}
              />
            </div>
            <p className="text-xs text-gray-500">
              A estratégia será interrompida ao atingir este lucro
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="limitePerda">Limite de Perda</Label>
            <div className="flex items-center space-x-2">
              <Input 
                id="limitePerda" 
                type="number" 
                min={1} 
                value={settings.limitePerda}
                onChange={e => setSettings({...settings, limitePerda: Number(e.target.value)})}
                disabled={isActive}
              />
            </div>
            <p className="text-xs text-gray-500">
              A estratégia será interrompida ao atingir esta perda
            </p>
          </div>
        </div>
        
        {/* Estatísticas */}
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Estatísticas</h3>
            <Button variant="outline" size="sm" onClick={resetStats} disabled={isActive}>
              Resetar
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">Último Valor</p>
              <p className="text-lg font-medium">{lastTick?.toFixed(2) || '-'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Último Dígito</p>
              <p className="text-lg font-medium">{lastDigit !== null ? lastDigit : '-'}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Resultado</p>
              <p className={`text-lg font-medium ${
                operationResult === 'win' ? 'text-green-500' : 
                operationResult === 'loss' ? 'text-red-500' : ''
              }`}>
                {operationResult === 'win' ? 'Ganhou' : 
                 operationResult === 'loss' ? 'Perdeu' : '-'}
              </p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Lucro/Perda</p>
              <p className={`text-lg font-medium ${profit > 0 ? 'text-green-500' : profit < 0 ? 'text-red-500' : ''}`}>
                {profit.toFixed(2)}
              </p>
            </div>
          </div>
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Acertos</p>
              <p className="text-lg font-medium text-green-500">{tradesCount.wins}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Erros</p>
              <p className="text-lg font-medium text-red-500">{tradesCount.losses}</p>
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-gray-500">Taxa de Acerto</p>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div 
                className="bg-green-500 h-2.5 rounded-full" 
                style={{ 
                  width: `${tradesCount.wins + tradesCount.losses > 0 
                    ? (tradesCount.wins / (tradesCount.wins + tradesCount.losses) * 100) 
                    : 0}%` 
                }}
              ></div>
            </div>
            <p className="text-xs mt-1">
              {tradesCount.wins + tradesCount.losses > 0 
                ? ((tradesCount.wins / (tradesCount.wins + tradesCount.losses) * 100).toFixed(1) + '%')
                : '0%'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}