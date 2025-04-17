import { useState, useEffect } from 'react';
import derivAPI from '@/lib/derivApi';

interface LiveChartProps {
  symbol?: string;
}

export function LiveChart({ symbol = 'R_100' }: LiveChartProps) {
  const [prices, setPrices] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Buscar dados do mercado
  const fetchMarketData = async () => {
    try {
      if (!derivAPI.getConnectionStatus()) {
        setIsConnected(false);
        return;
      }
      
      setIsConnected(true);
      
      // Usando o método getTicksHistory para obter histórico de dados
      const response = await derivAPI.getTicksHistory(symbol, { count: 100, style: 'ticks' });
      
      if (response && response.history && response.history.prices && response.history.times) {
        // Processar preços
        const priceData = response.history.prices.map((price: string | number) => 
          typeof price === 'number' ? price : parseFloat(price)
        );
        
        // Processar timestamps
        const timeData = response.history.times.map((time: number) => 
          new Date(time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
        
        console.log("Dados do gráfico R_100 atualizados:", priceData.length, "pontos");
        setPrices(priceData);
        setTimestamps(timeData);
      } else {
        console.error("Resposta do histórico de ticks inválida:", response);
      }
    } catch (error) {
      console.error("Erro ao buscar dados para o gráfico:", error);
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
  }, [symbol]);
  
  // Verificar periodicamente a conexão
  useEffect(() => {
    const checkConnection = () => {
      setIsConnected(derivAPI.getConnectionStatus());
    };
    
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);
  
  // Obter apenas os últimos pontos de dados para o gráfico
  const chartPoints = prices.length > 0 ? prices.slice(-30) : [];
  
  // Calcular pontos para o SVG
  const generateChartPoints = () => {
    if (chartPoints.length === 0) return "";
    
    // Encontrar o valor mínimo e máximo para escala
    const minPrice = Math.min(...chartPoints);
    const maxPrice = Math.max(...chartPoints);
    const range = maxPrice - minPrice;
    
    // Padding para não ficar colado nas bordas
    const paddedMin = minPrice - range * 0.1;
    const paddedMax = maxPrice + range * 0.1;
    const adjustedRange = paddedMax - paddedMin;
    
    // Gerar pontos SVG
    return chartPoints.map((price, i) => {
      // Calcular posição X baseada no índice
      const x = (i / (chartPoints.length - 1)) * 500;
      
      // Calcular posição Y (invertida, pois SVG tem 0,0 no topo)
      // Mapear o preço para o intervalo [0, 200] (altura do SVG)
      const normalizedPrice = (price - paddedMin) / adjustedRange;
      const y = 200 - normalizedPrice * 180; // Deixar espaço nas bordas
      
      return `${x},${y}`;
    }).join(" ");
  };
  
  // Obter timestamps para exibição no eixo X
  const visibleTimestamps = timestamps.slice(-30);
  const timeLabels = visibleTimestamps.filter((_, i) => i % 6 === 0); // Mostrar apenas alguns para não ficar apertado
  
  return (
    <div className="w-full h-[200px] bg-[#000000] rounded relative overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
          <div className="text-white">Carregando dados...</div>
        </div>
      )}
      
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-70 z-10">
          <div className="text-amber-500">Sem conexão com a API. Conecte-se à sua conta Deriv.</div>
        </div>
      )}
      
      <div className="absolute inset-0">
        <svg width="100%" height="100%" viewBox="0 0 500 200">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00e5b3" stopOpacity="1" />
              <stop offset="100%" stopColor="#4169e1" stopOpacity="0.7" />
            </linearGradient>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00e5b3" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0" />
            </linearGradient>
          </defs>
          <g>
            {/* Linhas de grade */}
            <line x1="0" y1="40" x2="500" y2="40" stroke="#1a3a1a" strokeWidth="1" />
            <line x1="0" y1="80" x2="500" y2="80" stroke="#1a3a1a" strokeWidth="1" />
            <line x1="0" y1="120" x2="500" y2="120" stroke="#1a3a1a" strokeWidth="1" />
            <line x1="0" y1="160" x2="500" y2="160" stroke="#1a3a1a" strokeWidth="1" />
            
            {/* Linha do gráfico com área preenchida */}
            {chartPoints.length > 0 && (
              <>
                {/* Área debaixo da linha */}
                <path 
                  d={`M0,200 L0,${200 - (chartPoints[0] - Math.min(...chartPoints)) / (Math.max(...chartPoints) - Math.min(...chartPoints)) * 180} ${generateChartPoints()} L500,200 Z`}
                  fill="url(#areaGradient)" 
                />
                {/* Linha principal */}
                <polyline 
                  points={generateChartPoints()}
                  fill="none" 
                  stroke="url(#lineGradient)" 
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Ponto atual (último valor) */}
                {chartPoints.length > 0 && (
                  <circle 
                    cx="500" 
                    cy={200 - (chartPoints[chartPoints.length - 1] - Math.min(...chartPoints)) / (Math.max(...chartPoints) - Math.min(...chartPoints)) * 180}
                    r="4" 
                    fill="#00e5b3" 
                  />
                )}
              </>
            )}
          </g>
        </svg>
      </div>
      
      {/* Rótulos de tempo no eixo X */}
      <div className="absolute bottom-0 left-0 w-full flex justify-between px-3 py-1 text-xs text-gray-400">
        {timeLabels.map((time, i) => (
          <span key={`time-label-${time}-${i}`}>{time}</span>
        ))}
      </div>
    </div>
  );
}