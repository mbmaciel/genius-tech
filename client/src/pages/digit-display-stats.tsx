import React, { useState, useEffect, useRef } from 'react';

type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface DigitStat {
  digit: Digit;
  count: number;
  percentage: number;
}

export default function DigitDisplayStats() {
  // Estados
  const [digits, setDigits] = useState<number[]>([]);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [stats, setStats] = useState<DigitStat[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState(100);
  const [timestamp, setTimestamp] = useState(new Date());
  
  // Referência WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  
  // Função principal para cálculo de estatísticas
  const processStats = (digitData: number[]) => {
    if (digitData.length === 0) {
      return Array.from({ length: 10 }, (_, i) => ({
        digit: i as Digit,
        count: 0,
        percentage: 0
      }));
    }

    // Usar apenas os primeiros N dígitos baseado no tamanho da amostra
    const sampleData = digitData.slice(0, Math.min(sampleSize, digitData.length));
    
    // Array para contagem - inicializar com zeros
    const counts = Array(10).fill(0);
    
    // Contar cada dígito
    sampleData.forEach(digit => {
      counts[digit]++;
    });
    
    // Verificação de sanidade
    const totalCounted = counts.reduce((sum, count) => sum + count, 0);
    console.log(`[STATS] Tamanho da amostra: ${sampleData.length}, Total contado: ${totalCounted}`);
    
    // Calcular percentuais
    const stats: DigitStat[] = counts.map((count, digit) => ({
      digit: digit as Digit,
      count,
      percentage: Math.round((count / sampleData.length) * 100)
    }));
    
    // Verificação adicional
    const totalPercentage = stats.reduce((sum, stat) => sum + stat.percentage, 0);
    console.log(`[STATS] Soma dos percentuais: ${totalPercentage}%`);
    
    return stats;
  };
  
  // Conexão WebSocket
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    try {
      console.log("[WS] Iniciando conexão WebSocket...");
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      wsRef.current = ws;
      
      ws.addEventListener('open', () => {
        console.log("[WS] Conexão estabelecida");
        setIsConnected(true);
        setErrorMessage(null);
        
        // Pedir histórico e inscrever para atualizações
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
        console.log("[WS] Solicitação enviada:", request);
      });
      
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Processamento inicial do histórico
          if (data.history && data.history.prices) {
            const prices = data.history.prices;
            console.log(`[HIST] Recebidos ${prices.length} preços históricos`);
            
            // Extrair último dígito de cada preço e reverter a ordem
            // (mais recentes primeiro)
            const extractedDigits = prices.map((price: number) => {
              const priceStr = price.toFixed(2);
              return parseInt(priceStr.charAt(priceStr.length - 1));
            }).reverse();
            
            // Atualizar estado
            setDigits(extractedDigits);
            setLastDigit(extractedDigits[0]);
            
            // Calcular estatísticas
            const calculatedStats = processStats(extractedDigits);
            setStats(calculatedStats);
            
            setIsLoading(false);
            setTimestamp(new Date());
          }
          
          // Processamento de ticks em tempo real
          if (data.tick && data.tick.quote) {
            const price = parseFloat(data.tick.quote);
            const priceStr = price.toFixed(2);
            const digit = parseInt(priceStr.charAt(priceStr.length - 1));
            
            console.log(`[TICK] Recebido: ${price}, último dígito: ${digit}`);
            
            // Atualizar último dígito
            setLastDigit(digit);
            
            // Atualizar lista completa
            setDigits(prevDigits => {
              const updatedDigits = [digit, ...prevDigits].slice(0, 500);
              
              // Recalcular estatísticas
              const calculatedStats = processStats(updatedDigits);
              setStats(calculatedStats);
              
              return updatedDigits;
            });
            
            setTimestamp(new Date());
          }
          
          // Processamento de erros
          if (data.error) {
            console.error(`[API] Erro: ${data.error.code} - ${data.error.message}`);
            setErrorMessage(`Erro: ${data.error.message}`);
          }
        } catch (err) {
          console.error("[ERROR] Falha ao processar mensagem:", err);
        }
      });
      
      ws.addEventListener('error', (err) => {
        console.error("[WS] Erro de conexão:", err);
        setIsConnected(false);
        setErrorMessage("Erro na conexão com o servidor");
      });
      
      ws.addEventListener('close', (event) => {
        console.log(`[WS] Conexão fechada (código: ${event.code})`);
        setIsConnected(false);
        
        // Tentar reconectar após 3 segundos
        setTimeout(() => {
          console.log("[WS] Tentando reconectar...");
          connectWebSocket();
        }, 3000);
      });
    } catch (err) {
      console.error("[ERROR] Falha ao configurar WebSocket:", err);
      setErrorMessage("Erro ao configurar conexão");
    }
  };
  
  // Recalcular estatísticas quando o tamanho da amostra mudar
  useEffect(() => {
    if (digits.length > 0) {
      console.log(`[CONFIG] Amostra alterada para ${sampleSize}`);
      const calculatedStats = processStats(digits);
      setStats(calculatedStats);
    }
  }, [sampleSize]);
  
  // Conectar ao iniciar o componente
  useEffect(() => {
    console.log("[INIT] Componente iniciado");
    connectWebSocket();
    
    return () => {
      console.log("[CLEANUP] Encerrando conexão");
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Renderização
  return (
    <div className="min-h-screen bg-[#0e1a2e] text-white p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Dígitos em Tempo Real - R_100</h1>
        
        {/* Status e controles */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>
              {isConnected ? 'Conectado' : 'Desconectado'}
              {errorMessage && <span className="text-red-400 ml-2">({errorMessage})</span>}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div>
              <label className="mr-2">Amostra:</label>
              <select 
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value))}
                className="bg-[#1a2e4c] border border-gray-700 rounded px-2 py-1"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
            
            <span className="text-sm text-gray-400">
              Atualizado: {timestamp.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {/* Último dígito */}
        {lastDigit !== null && (
          <div className="flex justify-center mb-8">
            <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold animate-pulse">
              {lastDigit}
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin mb-4"></div>
            <p>Carregando dados do mercado...</p>
          </div>
        ) : (
          <>
            {/* Título com estilo da referência */}
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Gráfico de barras</h2>
            </div>

            {/* Grade de fundo */}
            <div className="relative h-80 mb-4 bg-[#0d1c34] border border-gray-800 rounded">
              {/* Linhas de grade horizontais */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 5, 10, 15, 20, 25, 30].map((value) => (
                  <div 
                    key={`grid-${value}`} 
                    className="w-full border-t border-gray-800 relative" 
                    style={{ 
                      bottom: `${(value / 30) * 100}%`,
                      height: "1px",
                      marginTop: value === 0 ? "-1px" : "0"
                    }}
                  >
                    <span className="absolute -top-2 -left-8 text-xs text-gray-500">{value}</span>
                  </div>
                ))}
              </div>
              
              {/* Barras verticais */}
              <div className="flex h-full px-4 pt-8 pb-8 justify-between items-end relative z-10">
                {stats.map((stat) => {
                  // Cor da barra baseada no percentual
                  let barColor = "bg-blue-600";
                  if (stat.percentage >= 20) barColor = "bg-red-600";
                  
                  return (
                    <div 
                      key={`stat-${stat.digit}`}
                      className="h-full flex flex-col items-center justify-end"
                      style={{ width: "8%" }}
                    >
                      {/* Porcentagem acima da barra */}
                      <div className="absolute top-2 text-sm font-semibold">
                        {stat.percentage > 0 && `${stat.percentage}%`}
                      </div>
                      
                      {/* Barra vertical */}
                      <div 
                        className={`w-full ${barColor} transition-all duration-300`}
                        style={{ 
                          height: `${Math.max(2, (stat.percentage / 30) * 100)}%`,
                        }}
                      />
                      
                      {/* Dígito abaixo da barra */}
                      <div className="absolute bottom-2 font-medium">
                        {stat.digit}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Sequência de dígitos (estilo da referência) */}
            <div className="bg-[#0d1c34] border border-gray-800 rounded p-2 mb-8 flex justify-center">
              <div className="tracking-widest text-lg font-mono">
                {digits.slice(0, 20).map((digit, i) => (
                  <span key={`recent-${i}`} className={`inline-block mx-1 ${i === 0 ? 'text-yellow-400' : ''}`}>{digit}</span>
                ))}
              </div>
            </div>
            
            {/* Legenda */}
            <div className="flex justify-center gap-4 text-sm text-gray-400 mb-8">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-600 rounded-sm mr-1"></div>
                <span>≥ 20%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-600 rounded-sm mr-1"></div>
                <span>≥ 10%</span>
              </div>
            </div>
            
            {/* Grid de dígitos (como na referência) */}
            <div className="grid grid-cols-10 gap-1 mb-8">
              {digits.slice(0, 30).map((digit, index) => (
                <div 
                  key={`digit-grid-${index}`}
                  className={`h-8 flex items-center justify-center rounded font-mono font-bold
                    ${index === 0 ? 'bg-blue-600' : 'bg-[#1a2e4c]'}`}
                >
                  {digit}
                </div>
              ))}
            </div>
            
            {/* Info adicional */}
            <div className="text-center text-sm text-gray-500">
              <p>Total de dígitos disponíveis: {digits.length}</p>
              <p className="mt-1">Dados em tempo real do R_100 da Deriv</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}