import React, { useEffect, useState } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { independentDerivService, DigitHistory } from '../services/independent-deriv-service';

interface IndependentDigitBarChartProps {
  symbol?: string;
  className?: string;
  showControls?: boolean;
}

/**
 * Componente de gráfico de barras de dígitos com conexão WebSocket independente
 * Este componente não interfere com a conexão principal do bot
 */
export function IndependentDigitBarChart({
  symbol = 'R_100',
  className = '',
  showControls = true
}: IndependentDigitBarChartProps) {
  // Estados do componente
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [digitHistory, setDigitHistory] = useState<DigitHistory | null>(null);
  const [selectedCount, setSelectedCount] = useState<string>("100");
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  
  // Iniciar conexão e inscrição para ticks
  useEffect(() => {
    setLoading(true);
    
    const handleHistoryUpdate = (data: DigitHistory) => {
      // Verificar se os dados são para o mesmo símbolo
      if (data.symbol === symbol) {
        setDigitHistory(data);
        
        // Atualizar últimos dígitos (inverter para mostrar mais recentes primeiro)
        const digits = [...data.lastDigits];
        setLastDigits(digits.slice(-parseInt(selectedCount)).reverse());
        
        setLoading(false);
      }
    };
    
    const handleConnectionEvent = (data: any) => {
      if (!data.connected) {
        setError('Conexão WebSocket perdida. Reconectando...');
      } else {
        setError(null);
      }
    };
    
    const handleErrorEvent = (data: any) => {
      setError(`Erro: ${data.message || 'Falha na comunicação com a Deriv'}`);
      setLoading(false);
    };
    
    // Registrar ouvintes de eventos
    independentDerivService.addListener('history', handleHistoryUpdate);
    independentDerivService.addListener('connection', handleConnectionEvent);
    independentDerivService.addListener('error', handleErrorEvent);
    
    // Iniciar busca de dados
    const fetchData = async () => {
      try {
        // Verificar se já temos dados em cache
        const cachedHistory = independentDerivService.getDigitHistory(symbol);
        if (cachedHistory && cachedHistory.totalSamples > 0) {
          handleHistoryUpdate(cachedHistory);
        }
        
        // Solicitar histórico e assinar ticks (mesmo que tenhamos cache)
        await independentDerivService.fetchTicksHistory(symbol, 500);
        await independentDerivService.subscribeTicks(symbol);
      } catch (err) {
        console.error('[IndependentDigitBarChart] Erro ao buscar dados:', err);
        setError('Falha ao buscar histórico de dígitos');
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Limpar ao desmontar
    return () => {
      independentDerivService.removeListener('history', handleHistoryUpdate);
      independentDerivService.removeListener('connection', handleConnectionEvent);
      independentDerivService.removeListener('error', handleErrorEvent);
    };
  }, [symbol]);
  
  // Atualizar exibição quando o número de ticks mudar
  useEffect(() => {
    if (digitHistory && digitHistory.lastDigits.length > 0) {
      const count = parseInt(selectedCount);
      const digits = [...digitHistory.lastDigits];
      setLastDigits(digits.slice(-count).reverse());
    }
  }, [selectedCount, digitHistory]);
  
  // Determinar a cor da barra com base na frequência do dígito
  const getBarColor = (percentage: number, digit: number): string => {
    // Cores diferentes para dígitos com frequência acima de 20%
    if (percentage >= 20) {
      return 'bg-red-500'; // Alta frequência em vermelho
    }
    
    // Cores diferentes para dígitos pares e ímpares
    return digit % 2 === 0 
      ? 'bg-green-500'  // Dígitos pares em verde
      : 'bg-blue-500';  // Dígitos ímpares em azul
  };
  
  return (
    <div className={`bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg ${className}`}>
      {/* Header com título e controles */}
      <div className="p-3 bg-[#0e1a2e] border-b border-gray-800 flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="font-medium text-white flex items-center">
            Gráfico de barras
            {loading && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />
            )}
          </h3>
        </div>
        
        {/* Controles de seleção (opcional) */}
        {showControls && (
          <div className="flex items-center">
            <Select value={selectedCount} onValueChange={setSelectedCount}>
              <SelectTrigger className="h-8 w-[90px] bg-[#0c1625] border border-gray-700 text-xs">
                <SelectValue placeholder="100" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 Ticks</SelectItem>
                <SelectItem value="50">50 Ticks</SelectItem>
                <SelectItem value="100">100 Ticks</SelectItem>
                <SelectItem value="200">200 Ticks</SelectItem>
                <SelectItem value="250">250 Ticks</SelectItem>
                <SelectItem value="500">500 Ticks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      {/* Mensagem de erro se necessário */}
      {error && (
        <div className="p-4 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      )}
      
      {/* Gráfico de barras */}
      <div className="p-6">
        <div className="flex items-end h-52 mb-8 relative">
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
            {digitHistory?.stats.map((stat) => (
              <div key={stat.digit} className="flex flex-col items-center w-full max-w-[45px] min-w-[20px]">
                {/* Percentual acima da barra */}
                {stat.percentage > 0 && (
                  <div className="text-xs font-medium text-white mb-1">
                    {stat.percentage}%
                  </div>
                )}
                
                {/* Barra com altura proporcional */}
                <div 
                  className={`w-full ${getBarColor(stat.percentage, stat.digit)}`}
                  style={{ 
                    height: `${Math.max(1, (stat.percentage / 50) * 100)}%`,
                    transition: 'height 0.3s ease-in-out'
                  }}
                ></div>
                
                {/* Dígito abaixo da barra */}
                <div className="mt-2 text-center text-sm text-white">
                  {stat.digit}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Sequência dos últimos dígitos */}
        <div className="mt-4">
          <div className="text-xs text-gray-400 mb-2">Últimos {lastDigits.length} dígitos:</div>
          <div className="flex flex-wrap gap-1">
            {lastDigits.map((digit, index) => (
              <div 
                key={index} 
                className={`w-7 h-7 flex items-center justify-center rounded ${
                  index === 0 
                    ? 'bg-primary text-white' 
                    : 'bg-[#1d2a45] text-white border border-[#2a3756]'
                }`}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Rodapé com informações */}
      <div className="px-4 py-2 bg-[#0c1625] text-xs text-gray-400 border-t border-gray-800">
        Análise baseada em {digitHistory?.totalSamples || 0} ticks do {symbol}
      </div>
    </div>
  );
}