import React, { useState, useEffect, useRef } from 'react';

// Interface para estatísticas de dígitos
interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export default function SimpleChart() {
  // Estados para armazenar dados
  const [digits, setDigits] = useState<number[]>([]);
  const [stats, setStats] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 }))
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [sample, setSample] = useState<string>("100");
  
  // Para forçar renderização
  const [updateKey, setUpdateKey] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Calcular estatísticas
  const calculateStats = (digitsList: number[], sampleSize: number) => {
    // Recortar para o tamanho da amostra
    const sample = digitsList.slice(0, sampleSize);
    const total = sample.length;
    
    if (total === 0) return;
    
    // Inicializar contadores
    const counts = Array(10).fill(0);
    sample.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    });
    
    // Calcular percentuais
    const newStats = counts.map((count, digit) => {
      const percentage = Math.round((count / total) * 100);
      return { digit, count, percentage };
    });
    
    setStats(newStats);
  };
  
  // Conectar ao WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      // URL do WebSocket da Deriv
      const wsUrl = "wss://ws.binaryws.com/websockets/v3?app_id=1089";
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("WebSocket conectado!");
        
        // Enviar solicitação de histórico de ticks - R_100 com inscrição
        const request = {
          ticks_history: "R_100",
          adjust_start_time: 1,
          count: 500,
          end: "latest", 
          start: 1,
          style: "ticks",
          subscribe: 1
        };
        
        ws.send(JSON.stringify(request));
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Processar histórico de ticks
          if (data.history && data.history.prices) {
            const prices = data.history.prices;
            const extractedDigits = prices.map((price: number) => {
              const priceStr = price.toFixed(2);
              return parseInt(priceStr.charAt(priceStr.length - 1), 10);
            });
            
            setDigits(extractedDigits);
            calculateStats(extractedDigits, parseInt(sample));
            setLoading(false);
            console.log("Recebido histórico com", extractedDigits.length, "ticks");
          }
          
          // Processar ticks em tempo real
          if (data.tick && data.tick.quote) {
            const price = parseFloat(data.tick.quote);
            const priceStr = price.toFixed(2);
            const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1), 10);
            
            if (!isNaN(lastDigit)) {
              console.log("Novo tick recebido:", price, "Último dígito:", lastDigit);
              
              // Adicionar novo dígito ao início do array
              setDigits(prev => {
                const newDigits = [lastDigit, ...prev].slice(0, 500);
                calculateStats(newDigits, parseInt(sample));
                return newDigits;
              });
              
              // Forçar atualização do componente
              setUpdateKey(prev => prev + 1);
            }
          }
        } catch (error) {
          console.error("Erro ao processar mensagem:", error);
        }
      };
      
      ws.onerror = (error) => {
        console.error("Erro WebSocket:", error);
        setLoading(false);
      };
      
      ws.onclose = () => {
        console.log("Conexão WebSocket fechada");
        // Reconectar após 2 segundos
        setTimeout(connectWebSocket, 2000);
      };
    };
    
    connectWebSocket();
    
    // Limpar ao desmontar
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Atualizar estatísticas quando a amostra mudar
  useEffect(() => {
    if (digits.length > 0) {
      calculateStats(digits, parseInt(sample));
    }
  }, [sample, digits.length]);
  
  // Forçar renderização periódica
  useEffect(() => {
    const interval = setInterval(() => {
      setUpdateKey(prev => prev + 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="container mx-auto p-4 bg-[#0e1a2e] min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6 text-center">Análise de Dígitos em Tempo Real</h1>
      
      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-red-600 rounded-sm"></div>
          <span className="font-medium">Gráfico de dígitos do R_100</span>
        </div>
        
        <select 
          value={sample} 
          onChange={(e) => setSample(e.target.value)}
          className="bg-[#0c1625] text-white border border-gray-700 rounded px-2 py-1"
        >
          <option value="25">25 Ticks</option>
          <option value="50">50 Ticks</option>
          <option value="100">100 Ticks</option>
          <option value="200">200 Ticks</option>
          <option value="500">500 Ticks</option>
        </select>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-white rounded-full"></div>
        </div>
      ) : (
        <div className="bg-[#0e1a2e] rounded-lg shadow-lg border border-gray-800">
          {/* Gráfico de barras */}
          <div className="p-4">
            <div className="relative h-64 flex items-end justify-between px-4" key={`chart-${updateKey}`}>
              {/* Linhas de grade */}
              <div className="absolute w-full h-full flex flex-col justify-between">
                {[0, 10, 20, 30, 40, 50].map(value => (
                  <div 
                    key={`grid-${value}-${updateKey}`}
                    className="w-full border-t border-gray-800 relative"
                    style={{ bottom: `${(value / 50) * 100}%` }}
                  >
                    <span className="absolute -top-3 -left-8 text-gray-500 text-xs">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Barras para cada dígito */}
              {stats.map(stat => {
                // Colorir baseado na frequência
                const barColor = stat.percentage >= 20 
                  ? "#ff3232" // Vermelho para 20% ou mais
                  : (stat.digit % 2 === 0 ? "#2a405a" : "#896746"); // Azul para pares, marrom para ímpares
                
                return (
                  <div 
                    key={`bar-${stat.digit}-${updateKey}`} 
                    className="flex flex-col items-center w-full z-10"
                  >
                    {/* Porcentagem acima da barra */}
                    <div className="h-6 flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {stat.percentage}%
                      </span>
                    </div>
                    
                    {/* Barra */}
                    <div 
                      className="w-8 transition-all duration-300 ease-in-out"
                      style={{ 
                        height: `${Math.max(1, (stat.percentage / 50) * 100)}%`,
                        backgroundColor: barColor
                      }}
                    ></div>
                    
                    {/* Dígito */}
                    <div className="mt-2 text-white font-bold">
                      {stat.digit}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Últimos 10 dígitos */}
            <div className="mt-6 border-t border-gray-800 pt-4">
              <h3 className="text-sm font-medium mb-2">Últimos 10 dígitos:</h3>
              <div className="flex justify-center">
                <div className="grid grid-cols-10 gap-1">
                  {digits.slice(0, 10).map((digit, index) => (
                    <div 
                      key={`recent-${index}-${updateKey}`} 
                      className={`w-8 h-8 flex items-center justify-center border rounded-md
                        ${index === 0 
                          ? 'bg-primary text-white border-primary' 
                          : 'border-gray-700 text-white'}`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Estatísticas */}
            <div className="mt-4 text-xs text-gray-400 text-center">
              Analisando {sample} de {digits.length} dígitos disponíveis
            </div>
          </div>
        </div>
      )}
    </div>
  );
}