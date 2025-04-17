import { useState, useEffect } from 'react';
import derivAPI from '@/lib/derivApi';

// Definir uma função para extrair o último dígito de um número
function getLastDigit(num: number): number {
  const numStr = num.toString();
  return parseInt(numStr.charAt(numStr.length - 1));
}

export function MarketDataDisplay() {
  const [tickData, setTickData] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [digitCounts, setDigitCounts] = useState<number[]>(Array(10).fill(0));
  
  // Função para buscar dados do mercado em tempo real
  const fetchMarketData = async () => {
    try {
      if (!derivAPI.getConnectionStatus()) {
        setIsConnected(false);
        return;
      }
      
      setIsConnected(true);
      const symbol = "R_100"; // Índice Volatilidade 100
      
      const response = await derivAPI.getTicksHistory(symbol, { count: 100, style: 'ticks' });
      
      if (response && response.history && response.history.prices) {
        const prices = response.history.prices.map((price: string | number) => 
          typeof price === 'number' ? price : parseFloat(price)
        );
        
        setTickData(prices);
        
        // Extrair os últimos dígitos
        const digits = prices.map((price: number) => getLastDigit(price));
        setLastDigits(digits);
        
        // Contar a frequência de cada dígito
        const counts = Array(10).fill(0);
        digits.forEach((digit: number) => {
          counts[digit]++;
        });
        setDigitCounts(counts);
      }
    } catch (error) {
      console.error("Erro ao buscar dados de mercado:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Configurar intervalo para atualização de dados
  useEffect(() => {
    fetchMarketData();
    
    const interval = setInterval(() => {
      fetchMarketData();
    }, 5000); // Atualizar a cada 5 segundos
    
    return () => clearInterval(interval);
  }, []);
  
  // Verificar periodicamente a conexão
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(derivAPI.getConnectionStatus());
    };
    
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // Obter os últimos 10 dígitos para exibição
  const last10Digits = lastDigits.slice(-10);
  
  // Obter os últimos 36 dígitos para a tabela
  const last36Digits = lastDigits.slice(-36);
  
  return (
    <div>
      {/* Dados em tempo real do Índice R_100 */}
      <div className="text-xs text-gray-400 mb-2">
        {isConnected ? (
          <span className="text-green-500">✓ Usando dados reais de mercado</span>
        ) : (
          <span className="text-amber-500">⚠ Sem conexão com dados reais</span>
        )}
      </div>
      
      {/* Últimos 10 dígitos com frequência */}
      <div className="grid grid-cols-10 gap-0.5 mb-4">
        {Array.from({ length: 10 }, (_, i) => {
          // Calcular altura baseada na frequência real
          const frequency = digitCounts[i] || 0;
          const heightPercentage = Math.max(5, Math.min(100, (frequency * 5)));
          
          // Verificar se este dígito está entre os últimos 10
          const isActive = last10Digits.includes(i);
          
          return (
            <div key={`digit-bar-${i}-${Date.now()}-${Math.random()}`} className="flex flex-col items-center">
              <div 
                className={`w-full ${isActive ? 'bg-green-700' : 'bg-[#1f3158]'} rounded-sm`}
                style={{ height: `${heightPercentage}px` }}
              ></div>
              <div className="text-xs text-white mt-1">{i}</div>
            </div>
          );
        })}
      </div>
      
      {/* Tabela de 36 últimos dígitos */}
      <div className="flex flex-wrap gap-1 text-xs mt-4">
        {last36Digits.map((digit, i) => {
          const color = digit % 2 === 0 ? 'text-blue-400' : 'text-white';
          return (
            <div key={`last-36-${i}-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substr(2, 5)}`} className={`w-5 h-5 flex items-center justify-center border border-gray-800 ${color}`}>
              {digit}
            </div>
          );
        })}
      </div>
    </div>
  );
}