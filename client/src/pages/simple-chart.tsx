import React, { useState, useEffect, useRef, useCallback } from 'react';

// Interface para estatísticas de dígitos
interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

// Dados iniciais simulados para evitar tela em branco
const initialStats: DigitStat[] = Array.from({ length: 10 }, (_, i) => ({ 
  digit: i, 
  count: 0, 
  percentage: 0 
}));

// Exemplo de dígitos para inicialização
const initialDigits = Array(10).fill(0).map(() => Math.floor(Math.random() * 10));

export default function SimpleChart() {
  // Estados para armazenar dados
  const [digits, setDigits] = useState<number[]>(initialDigits);
  const [stats, setStats] = useState<DigitStat[]>(initialStats);
  const [loading, setLoading] = useState<boolean>(true);
  const [sample, setSample] = useState<string>("100");
  const [connected, setConnected] = useState<boolean>(false);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  
  // Para forçar renderização
  const [updateKey, setUpdateKey] = useState<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calcular estatísticas
  const calculateStats = useCallback((digitsList: number[], sampleSize: number) => {
    // Recortar para o tamanho da amostra
    const sample = digitsList.slice(0, sampleSize);
    const total = sample.length;
    
    if (total === 0) return initialStats;
    
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
    
    return newStats;
  }, []);
  
  // Processar novo tick
  const processTick = useCallback((price: number) => {
    const priceStr = price.toFixed(2);
    const digit = parseInt(priceStr.charAt(priceStr.length - 1), 10);
    
    if (!isNaN(digit)) {
      console.log(`[CHART] Tick recebido: ${price}, último dígito: ${digit}`);
      setLastDigit(digit);
      
      // Atualizar lista de dígitos
      setDigits(prev => {
        const newDigits = [digit, ...prev].slice(0, 500);
        return newDigits;
      });
      
      // Forçar atualização da interface
      setUpdateKey(prev => prev + 1);
    }
  }, []);
  
  // Efeito para atualizar estatísticas
  useEffect(() => {
    if (digits.length > 0) {
      const sampleSize = parseInt(sample);
      const newStats = calculateStats(digits, sampleSize);
      setStats(newStats);
      console.log(`[CHART] Estatísticas atualizadas para amostra de ${sampleSize} dígitos`);
    }
  }, [sample, digits, calculateStats]);
  
  // Conectar ao WebSocket
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("[CHART] WebSocket já está conectado");
          return;
        }
        
        // URL do WebSocket da Deriv
        const wsUrl = "wss://ws.binaryws.com/websockets/v3?app_id=1089";
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        
        // Evento de conexão aberta
        ws.onopen = () => {
          console.log("[CHART] WebSocket conectado com sucesso!");
          setConnected(true);
          
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
          
          try {
            ws.send(JSON.stringify(request));
            console.log("[CHART] Solicitação de ticks enviada:", request);
          } catch (error) {
            console.error("[CHART] Erro ao enviar solicitação:", error);
          }
        };
        
        // Evento de mensagem recebida
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
              
              console.log(`[CHART] Histórico recebido com ${extractedDigits.length} ticks`);
              setDigits(extractedDigits);
              setLoading(false);
            }
            
            // Processar ticks em tempo real
            if (data.tick && data.tick.quote) {
              const price = parseFloat(data.tick.quote);
              processTick(price);
            }
          } catch (error) {
            console.error("[CHART] Erro ao processar mensagem:", error);
          }
        };
        
        // Evento de erro
        ws.onerror = (error) => {
          console.error("[CHART] Erro WebSocket:", error);
          setConnected(false);
          setLoading(false);
        };
        
        // Evento de conexão fechada
        ws.onclose = () => {
          console.log("[CHART] Conexão WebSocket fechada");
          setConnected(false);
          
          // Limpar timeout existente
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          
          // Tentar reconectar após 5 segundos
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("[CHART] Tentando reconectar...");
            connectWebSocket();
          }, 5000);
        };
      } catch (error) {
        console.error("[CHART] Erro ao configurar WebSocket:", error);
        setLoading(false);
      }
    };
    
    // Estabelecer conexão inicial
    connectWebSocket();
    
    // Limpar ao desmontar
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [processTick]);
  
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
          <div className={`w-3 h-3 rounded-sm ${connected ? 'bg-green-500' : 'bg-red-600'}`}></div>
          <span className="font-medium">
            Gráfico de dígitos do R_100 
            {!connected && <span className="text-red-500 ml-2">(Reconectando...)</span>}
          </span>
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

      {/* Exibir o último dígito recebido */}
      {lastDigit !== null && (
        <div className="mb-4 flex justify-center">
          <div className="bg-primary text-white font-bold text-2xl w-16 h-16 rounded-full flex items-center justify-center animate-pulse">
            {lastDigit}
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex flex-col justify-center items-center h-64">
          <div className="animate-spin h-12 w-12 border-t-4 border-b-4 border-green-500 rounded-full mb-4"></div>
          <p className="text-white">Conectando à Deriv API...</p>
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
                      {value}%
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
            <div className="mt-6 text-xs text-gray-400">
              <div className="flex justify-between items-center border-t border-gray-800 pt-4">
                <span>Analisando {sample} de {digits.length} dígitos disponíveis</span>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                  <span>Atualizações em tempo real ativas</span>
                </div>
              </div>
              
              {/* Legenda de cores */}
              <div className="flex items-center mt-2 space-x-4 justify-center">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-[#ff3232] mr-1"></div>
                  <span>≥ 20%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-[#2a405a] mr-1"></div>
                  <span>Pares</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-[#896746] mr-1"></div>
                  <span>Ímpares</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}