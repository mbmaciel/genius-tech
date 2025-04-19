import React, { useState, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { independentDerivService } from '../services/independent-deriv-service';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';

interface RealtimeDigitBarChartProps {
  symbol?: string;
  className?: string;
  showControls?: boolean;
  initialTickCount?: number;
}

export function RealtimeDigitBarChart({ 
  symbol = 'R_100',
  className = '',
  showControls = true,
  initialTickCount = 100
}: RealtimeDigitBarChartProps) {
  // Estados
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [digits, setDigits] = useState<number[]>([]);
  const [stats, setStats] = useState<{digit: number, count: number, percentage: number}[]>([]);
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickCount, setTickCount] = useState<string>(initialTickCount.toString());

  // Força re-renderização a cada atualização
  const [forceRender, setForceRender] = useState(0);

  // Inicializar e configurar ouvintes
  useEffect(() => {
    console.log(`[RealtimeDigitBarChart] Inicializando para símbolo ${symbol}`);
    setIsLoading(true);
    setError(null);

    // Manipular atualizações de histórico e estatísticas
    const handleHistoryUpdate = (data: any) => {
      if (data && data.symbol === symbol && data.stats) {
        console.log(`[RealtimeDigitBarChart] Recebendo atualização com ${data.stats.length} estatísticas`);
        
        // Copiar os arrays para garantir novas referências
        const newStats = [...data.stats].map(stat => ({ ...stat }));
        const newDigits = [...data.lastDigits].slice(-10).reverse();
        
        // Verificar se temos todos os dígitos de 0 a 9
        for (let i = 0; i <= 9; i++) {
          if (!newStats.some(s => s.digit === i)) {
            newStats.push({
              digit: i,
              count: 0,
              percentage: 0
            });
          }
        }
        
        // Ordenar para garantir que aparecem na ordem correta
        newStats.sort((a, b) => a.digit - b.digit);
        
        setStats(newStats);
        setDigits(newDigits);
        setLastUpdate(Date.now());
        setIsLoading(false);
        
        // Forçar re-renderização da visualização
        setForceRender(prev => prev + 1);
      }
    };

    // Manipular erros
    const handleError = (error: any) => {
      console.error('[RealtimeDigitBarChart] Erro:', error);
      setError(error.message || 'Falha na comunicação com a API Deriv');
    };

    // Manipular eventos de conexão
    const handleConnection = (data: any) => {
      if (!data.connected) {
        setError('Conexão perdida. Reconectando...');
      } else {
        setError(null);
      }
    };

    // Registrar os ouvintes
    independentDerivService.addListener('history', handleHistoryUpdate);
    independentDerivService.addListener('error', handleError);
    independentDerivService.addListener('connection', handleConnection);

    // Buscar dados iniciais
    const fetchData = async () => {
      try {
        // Verificar cache
        const cache = independentDerivService.getDigitHistory(symbol);
        if (cache && cache.stats && cache.stats.length > 0) {
          handleHistoryUpdate(cache);
        }

        // Buscar o histórico mais recente
        try {
          await independentDerivService.fetchTicksHistory(symbol, parseInt(tickCount));
        } catch (e) {
          console.warn('[RealtimeDigitBarChart] Erro ao buscar histórico:', e);
        }

        // Assinar para atualizações em tempo real
        try {
          await independentDerivService.subscribeTicks(symbol);
        } catch (e) {
          console.error('[RealtimeDigitBarChart] Erro ao assinar ticks:', e);
          setError('Falha ao iniciar conexão em tempo real');
        }
      } catch (e) {
        console.error('[RealtimeDigitBarChart] Erro inicial:', e);
        setError('Falha ao obter dados iniciais');
      }
    };

    fetchData();

    // Limpar ouvintes quando o componente for desmontado
    return () => {
      independentDerivService.removeListener('history', handleHistoryUpdate);
      independentDerivService.removeListener('error', handleError);
      independentDerivService.removeListener('connection', handleConnection);
    };
  }, [symbol, tickCount]);

  // Atualizar a cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setForceRender(prev => prev + 1);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Função para recarregar manualmente os dados
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await independentDerivService.fetchTicksHistory(symbol, parseInt(tickCount));
      setTimeout(() => setIsRefreshing(false), 500);
    } catch (e) {
      console.error('[RealtimeDigitBarChart] Erro ao atualizar:', e);
      setError('Falha ao atualizar dados');
      setIsRefreshing(false);
    }
  };
  
  // Função para atualizar a quantidade de ticks analisados
  const handleTickCountChange = (value: string) => {
    setTickCount(value);
    setIsRefreshing(true);
    
    // Buscar dados com a nova quantidade
    independentDerivService.fetchTicksHistory(symbol, parseInt(value))
      .then(() => setTimeout(() => setIsRefreshing(false), 500))
      .catch((e) => {
        console.error('[RealtimeDigitBarChart] Erro ao atualizar tick count:', e);
        setError('Falha ao atualizar quantidade de ticks');
        setIsRefreshing(false);
      });
  };

  return (
    <div 
      key={`chart-${symbol}-${forceRender}-${lastUpdate}`} 
      className={`bg-[#0e1a2e] rounded-lg shadow-md overflow-hidden ${className}`}
    >
      {/* Cabeçalho */}
      <div className="p-3 flex justify-between items-center border-b border-[#234]">
        <div className="flex items-center">
          <h3 className="text-white font-medium">
            <span className="text-[#3a96dd]">{symbol}</span>: Análise de Dígitos
          </h3>
          {isLoading && <Loader2 className="h-4 w-4 ml-2 animate-spin text-blue-400" />}
        </div>
        
        <div className="flex items-center space-x-2">
          {showControls && (
            <Select value={tickCount} onValueChange={handleTickCountChange}>
              <SelectTrigger className="h-8 bg-[#1d2a45] border-[#3a4b6b] text-white text-xs w-32">
                <SelectValue placeholder="Quantidade de ticks" />
              </SelectTrigger>
              <SelectContent className="bg-[#1d2a45] border-[#3a4b6b] text-white">
                <SelectItem value="25">25 ticks</SelectItem>
                <SelectItem value="50">50 ticks</SelectItem>
                <SelectItem value="100">100 ticks</SelectItem>
                <SelectItem value="200">200 ticks</SelectItem>
                <SelectItem value="300">300 ticks</SelectItem>
                <SelectItem value="500">500 ticks</SelectItem>
              </SelectContent>
            </Select>
          )}
          
          <button 
            onClick={handleRefresh} 
            disabled={isRefreshing}
            className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-[#234]"
          >
            <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
      
      {/* Mensagem de erro */}
      {error && (
        <div className="p-4 text-center text-red-400">
          <p>{error}</p>
        </div>
      )}
      
      {/* Gráfico de barras */}
      <div className="p-4">
        <div className="flex items-end h-52 mb-6 relative">
          {/* Eixo Y (percentuais) */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 pr-2">
            <div>50%</div>
            <div>40%</div>
            <div>30%</div>
            <div>20%</div>
            <div>10%</div>
            <div>0%</div>
          </div>
          
          {/* Linhas de grade horizontais */}
          <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-full border-t border-[#2a3756] h-0"></div>
            ))}
          </div>
          
          {/* Barras para cada dígito */}
          <div className="flex justify-between items-end w-full pl-8">
            {stats.length > 0 ? (
              stats.map((stat) => {
                // Destacar frequências altas/baixas
                const isHighFrequency = stat.percentage >= 15;
                const isLowFrequency = stat.percentage <= 5;
                
                // Altura visual da barra
                const barHeight = Math.max(5, (stat.percentage / 6) * 100);
                
                // Cores das barras
                let barColor;
                if (isHighFrequency) {
                  barColor = '#ff444f'; // Vermelho para alta frequência
                } else if (isLowFrequency) {
                  barColor = '#00e5b3'; // Verde para baixa frequência
                } else {
                  barColor = stat.digit % 2 === 0 ? '#3a96dd' : '#f87537';
                }
                
                return (
                  <div 
                    key={`bar-${stat.digit}-${forceRender}-${stat.percentage}`}
                    className="flex flex-col items-center w-full"
                  >
                    {/* Percentual */}
                    <div className={`text-xs font-bold mb-1 ${
                      isHighFrequency ? 'text-[#ff444f]' : 
                      isLowFrequency ? 'text-[#00e5b3]' : 'text-white'
                    }`}>
                      {stat.percentage}%
                    </div>
                    
                    {/* Barra */}
                    <div style={{
                      height: `${barHeight}%`,
                      backgroundColor: barColor,
                      width: '100%',
                      maxWidth: '30px',
                      minHeight: '15px',
                      borderRadius: '2px 2px 0 0'
                    }}></div>
                    
                    {/* Dígito */}
                    <div className="mt-2 text-center text-sm font-medium text-white">
                      {stat.digit}
                    </div>
                  </div>
                );
              })
            ) : (
              // Barras de placeholder durante o carregamento
              Array.from({ length: 10 }, (_, i) => (
                <div key={`placeholder-${i}`} className="flex flex-col items-center w-full">
                  <div className="text-xs text-white mb-1">0%</div>
                  <div style={{
                    height: '15%',
                    backgroundColor: i % 2 === 0 ? '#00e5b3' : '#ff444f',
                    width: '100%',
                    maxWidth: '30px',
                    minHeight: '15px',
                    borderRadius: '2px 2px 0 0'
                  }}></div>
                  <div className="mt-2 text-center text-sm text-white">{i}</div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Sequência dos últimos dígitos */}
        <div className="mt-4">
          <div className="flex justify-center">
            <div className="bg-[#0c1625] border border-[#2a3756] rounded-md flex items-center px-2 py-1 space-x-2">
              {digits.length > 0 ? (
                digits.map((digit, index) => (
                  <div 
                    key={`digit-${index}-${digit}-${forceRender}`}
                    className={`w-6 h-6 flex items-center justify-center font-medium text-base ${
                      digit % 2 === 0 ? 'text-[#00e5b3]' : 'text-[#ff444f]'
                    }`}
                  >
                    {digit}
                  </div>
                ))
              ) : (
                // Placeholders durante o carregamento
                Array.from({ length: 10 }, (_, i) => (
                  <div 
                    key={`empty-${i}`}
                    className="w-6 h-6 flex items-center justify-center text-transparent"
                  >
                    0
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Rodapé com informações */}
      <div className="px-4 py-2 bg-[#0c1625] text-xs text-gray-400 border-t border-[#232e47]">
        <div className="flex justify-between items-center">
          <div>Análise baseada em {parseInt(tickCount)} ticks</div>
          <div className="text-[#3a96dd] font-medium">{symbol}</div>
        </div>
      </div>
    </div>
  );
}