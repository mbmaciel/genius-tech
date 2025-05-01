import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface BotModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountInfo: any;
}

export function BotModal({ isOpen, onClose, accountInfo }: BotModalProps) {
  const [botMode, setBotMode] = useState<'idle' | 'running' | 'paused'>('idle');
  const [entryValue, setEntryValue] = useState<string>("0.35");
  const [profitTarget, setProfitTarget] = useState<string>("");
  const [lossLimit, setLossLimit] = useState<string>("");
  const [virtualLoss, setVirtualLoss] = useState<string>("");
  const [selectedBot, setSelectedBot] = useState<string>("");
  const [ticksCount, setTicksCount] = useState<string>("10");
  
  // Estado para dados de operação
  const [operationData, setOperationData] = useState<{
    entry: number;
    buyPrice: number;
    profit: number;
    status: 'comprado' | 'vendendo' | null;
  }>({
    entry: 0,
    buyPrice: 0,
    profit: 0,
    status: null
  });
  
  // Estado para contadores
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0
  });
  
  // Estado para dígitos e estatísticas
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<{
    digit: number;
    count: number;
    percentage: number;
  }[]>(Array.from({ length: 10 }, (_, i) => ({ 
    digit: i, 
    count: 0, 
    percentage: 0 
  })));

  // Simulação de atualização de dígitos para demonstração
  useEffect(() => {
    if (!isOpen || botMode !== 'running') return;
    
    const interval = setInterval(() => {
      const newDigit = Math.floor(Math.random() * 10);
      
      setLastDigits(prev => {
        const updated = [newDigit, ...prev].slice(0, 20);
        return updated;
      });
      
      setDigitStats(prev => {
        // Contagem de dígitos nos últimos ticks
        const counts: number[] = Array(10).fill(0);
        const updatedLastDigits = [newDigit, ...lastDigits].slice(0, parseInt(ticksCount));
        
        updatedLastDigits.forEach(d => {
          if (d >= 0 && d <= 9) counts[d]++;
        });
        
        // Cálculo de percentuais
        const total = updatedLastDigits.length;
        return prev.map((stat, i) => ({
          digit: i,
          count: counts[i],
          percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
        }));
      });
      
      // Simulação de operação
      if (botMode === 'running' && Math.random() > 0.8) {
        const isWin = Math.random() > 0.5;
        const entryNum = parseFloat(entryValue);
        const profit = isWin ? (entryNum * 0.95) : 0;
        
        if (isWin) {
          setStats(prev => ({ ...prev, wins: prev.wins + 1 }));
        } else {
          setStats(prev => ({ ...prev, losses: prev.losses + 1 }));
        }
        
        setOperationData({
          entry: Math.random() * 2000,
          buyPrice: entryNum,
          profit: profit,
          status: profit > 0 ? 'vendendo' : 'comprado'
        });
      }
      
    }, 2000);
    
    return () => clearInterval(interval);
  }, [isOpen, botMode, ticksCount, lastDigits, entryValue]);

  const handleExecuteBot = () => {
    setBotMode('running');
    setOperationData({
      entry: 1584.42,
      buyPrice: parseFloat(entryValue),
      profit: 0,
      status: 'comprado'
    });
  };

  const handlePauseBot = () => {
    setBotMode('paused');
  };

  const handleClearHistory = () => {
    setStats({ wins: 0, losses: 0 });
    setLastDigits([]);
    setDigitStats(Array.from({ length: 10 }, (_, i) => ({ 
      digit: i, 
      count: 0, 
      percentage: 0 
    })));
  };

  const getBarColor = (percentage: number) => {
    return percentage >= 20 ? 'bg-red-500' : 'bg-gray-500';
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl bg-[#0f1b31] text-white border-[#2a3756]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Robô de Automações</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-4">
          {/* Coluna Esquerda */}
          <div className="space-y-6">
            {/* Seleção de Bot */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Selecione um bot:</h3>
              <div>
                <Select value={selectedBot} onValueChange={setSelectedBot}>
                  <SelectTrigger className="bg-[#1d2a45] border-[#3a4b6b] text-white">
                    <SelectValue placeholder="Selecione um bot" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1d2a45] border-[#3a4b6b] text-white" position="popper" sideOffset={4} align="start">
                    <SelectItem value="lite">Lite Bots</SelectItem>
                    <SelectItem value="premium">Premium Bots</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Configurações de Trading */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Qual o valor de entrada?</Label>
                <Input
                  type="number"
                  value={entryValue}
                  onChange={e => setEntryValue(e.target.value)}
                  placeholder="0.35"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Adicionar Virtual Loss?</Label>
                <Input
                  value={virtualLoss}
                  onChange={e => setVirtualLoss(e.target.value)}
                  placeholder="Digite o número do Virtual Loss"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-white">Meta de Lucro</Label>
                <Input
                  value={profitTarget}
                  onChange={e => setProfitTarget(e.target.value)}
                  placeholder="Qual é a meta de lucro?"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white">Limite de Perdas Seguidas</Label>
                <Input
                  value={lossLimit}
                  onChange={e => setLossLimit(e.target.value)}
                  placeholder="Qual o limite de perdas seguidas?"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
            </div>
            
            {/* Informações de Conta e Operação */}
            <div className="mt-6 space-y-6">
              <div className="flex justify-between">
                <div className="flex items-center bg-[#1d2a45] p-3 rounded-md">
                  <div className="mr-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M15 9H9V15H15V9Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Balanço USD</div>
                    <div className="font-medium">$ {accountInfo?.balance || '0.00'}</div>
                  </div>
                </div>
                
                <div className="flex items-center bg-[#1d2a45] p-3 rounded-md">
                  <div className="mr-2">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M16 6L8 12L16 18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Lucro/Perdas</div>
                    <div className={`font-medium ${operationData.profit > 0 ? 'text-green-500' : 'text-white'}`}>
                      $ {operationData.profit.toFixed(2)} ({operationData.profit > 0 ? '+' : ''}
                      {operationData.buyPrice ? ((operationData.profit / operationData.buyPrice) * 100).toFixed(2) : '0.00'}%)
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Área de Operações */}
              {botMode !== 'idle' && (
                <div className="bg-[#13203a] border border-[#2a3756] rounded-md p-4">
                  <h3 className="text-lg font-medium mb-3">{operationData.status === 'comprado' ? 'Comprado' : 'Vendendo'}</h3>
                  <div className="bg-[#1d2a45] rounded-md overflow-hidden">
                    <div className="grid grid-cols-3 text-sm text-gray-400 p-3 border-b border-[#2a3756]">
                      <div>Entrada</div>
                      <div>Preço de compra</div>
                      <div>Lucro/Perda</div>
                    </div>
                    <div className="grid grid-cols-3 p-3 text-white">
                      <div>{operationData.entry.toFixed(2)}</div>
                      <div>{operationData.buyPrice.toFixed(2)}</div>
                      <div className={operationData.profit > 0 ? 'text-green-500' : ''}>
                        {operationData.profit.toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-4">
                    <div>
                      <span className="text-sm text-gray-400 mr-1">Ganhos:</span>
                      <span className="font-medium">{stats.wins}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-400 mr-1">Perdas:</span>
                      <span className="font-medium">{stats.losses}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Coluna Direita */}
          <div className="space-y-6">
            {/* Botões de Ação */}
            <div className="flex space-x-4">
              {botMode === 'idle' || botMode === 'paused' ? (
                <Button 
                  className="flex-1 bg-green-500 hover:bg-green-600 font-medium"
                  onClick={handleExecuteBot}
                >
                  Executar BOT
                </Button>
              ) : (
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600 font-medium"
                  onClick={handlePauseBot}
                >
                  Pausar BOT
                </Button>
              )}
              
              <Button 
                className="flex-1 bg-blue-500 hover:bg-blue-600 font-medium"
                onClick={handleClearHistory}
              >
                Limpar Histórico
              </Button>
            </div>
            
            {/* Gráfico de Barras */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-medium">Gráfico de barras</h3>
                <Select value={ticksCount} onValueChange={setTicksCount}>
                  <SelectTrigger className="bg-[#1d2a45] border-[#3a4b6b] text-white h-8 text-xs w-24">
                    <SelectValue>{ticksCount} Ticks</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#1d2a45] border-[#3a4b6b] text-white" position="popper" sideOffset={4} align="start">
                    <SelectItem value="10">10 Ticks</SelectItem>
                    <SelectItem value="25">25 Ticks</SelectItem>
                    <SelectItem value="50">50 Ticks</SelectItem>
                    <SelectItem value="100">100 Ticks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Estatísticas de Dígitos */}
              <div className="bg-[#13203a] border border-[#2a3756] rounded-md p-4">
                <div className="relative">
                  <div className="flex justify-between h-60 mb-2">
                    {/* Eixo Y */}
                    <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 pr-2">
                      <div>50</div>
                      <div>45</div>
                      <div>40</div>
                      <div>35</div>
                      <div>30</div>
                      <div>25</div>
                      <div>20</div>
                      <div>15</div>
                      <div>10</div>
                      <div>5</div>
                      <div>0</div>
                    </div>
                    
                    {/* Gráfico de barras */}
                    <div className="flex-1 flex justify-between items-end pl-8">
                      {digitStats.map((stat) => (
                        <div key={stat.digit} className="flex flex-col items-center w-full max-w-[40px]">
                          {stat.percentage > 0 && (
                            <div className="text-xs font-medium text-white mb-1">
                              {stat.percentage}%
                            </div>
                          )}
                          <div 
                            className={`w-full ${getBarColor(stat.percentage)}`}
                            style={{ 
                              height: stat.percentage === 0 ? '0px' : `${Math.min(100, Math.max(4, stat.percentage * 2))}px` 
                            }}
                          ></div>
                          <div className="mt-1 text-sm text-white">{stat.digit}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Legenda */}
                  <div className="flex items-center justify-end mb-4">
                    <div className="w-3 h-3 bg-red-500 mr-1"></div>
                    <span className="text-xs text-gray-400">Últimos {ticksCount} Dígitos (%)</span>
                  </div>
                  
                  {/* Últimos dígitos */}
                  <div className="bg-[#1d2a45] p-2 rounded flex flex-wrap justify-center">
                    {lastDigits.map((digit, index) => (
                      <div key={index} className="w-7 h-7 flex items-center justify-center text-white border border-[#3a4b6b] m-1 rounded">
                        {digit}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}