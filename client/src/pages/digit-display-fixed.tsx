import React, { useState, useEffect, useRef } from 'react';

// Tipos
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// Componente principal
export default function DigitDisplayFixed() {
  // Estados
  const [digits, setDigits] = useState<Digit[]>([]);
  const [lastDigit, setLastDigit] = useState<Digit | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<{digit: Digit, count: number, percentage: number}[]>(
    Array.from({length: 10}, (_, i) => ({
      digit: i as Digit,
      count: 0,
      percentage: 0
    }))
  );
  const [sampleSize, setSampleSize] = useState(100);
  const [updateTime, setUpdateTime] = useState(new Date());
  const [latestTicks, setLatestTicks] = useState<string>("");
  
  // Referências
  const wsRef = useRef<WebSocket | null>(null);
  
  // Calcular estatísticas
  const calculateStats = (digitList: Digit[]): {digit: Digit, count: number, percentage: number}[] => {
    // Importante: garantir que o digitList esteja na ordem correta (mais recente primeiro)
    // e que estamos pegando apenas o número correto de dígitos
    const actualSampleSize = Math.min(sampleSize, digitList.length);
    const sample = digitList.slice(0, actualSampleSize);
    
    console.log(`[DIGIT-DISPLAY] Calculando estatísticas para ${actualSampleSize} dígitos. Total disponível: ${digitList.length}`);
    console.log(`[DIGIT-DISPLAY] Amostra atual: ${sample.slice(0, 10).join(', ')}...`);
    
    if (sample.length === 0) {
      return Array.from({length: 10}, (_, i) => ({
        digit: i as Digit,
        count: 0,
        percentage: 0
      }));
    }
    
    // Contar ocorrências precisamente
    const counts = new Array(10).fill(0);
    
    // Contar cada dígito na amostra
    for (let i = 0; i < sample.length; i++) {
      const digit = sample[i];
      counts[digit]++;
    }
    
    // Verificar que a soma total está correta
    const totalCounts = counts.reduce((sum, count) => sum + count, 0);
    console.log(`[DIGIT-DISPLAY] Total de contagens: ${totalCounts} (deve ser igual a ${actualSampleSize})`);
    
    // Calcular percentuais com precisão
    const result = counts.map((count, digit) => {
      const percentage = Math.round((count / actualSampleSize) * 100);
      return { 
        digit: digit as Digit, 
        count, 
        percentage 
      };
    });
    
    // Calcular soma de percentuais para verificar precisão
    const totalPercentage = result.reduce((sum, stat) => sum + stat.percentage, 0);
    console.log(`[DIGIT-DISPLAY] Soma dos percentuais: ${totalPercentage}% (deve estar próximo de 100%)`);
    
    console.log(`[DIGIT-DISPLAY] Estatísticas calculadas:`, 
      result.map(stat => `${stat.digit}: ${stat.percentage}%`).join(', ')
    );
    
    return result;
  };

  // Formatação de ticks para display
  const formatTicks = (ticks: number[]) => {
    return ticks.map(tick => {
      const tickStr = tick.toFixed(2);
      return tickStr.charAt(tickStr.length - 1);
    }).join(' ');
  };

  // Conectar ao WebSocket da Deriv
  const connectWebSocket = () => {
    try {
      // Fechar conexão existente se houver
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Iniciar nova conexão
      console.log("[DIGIT-DISPLAY] Conectando ao WebSocket da Deriv...");
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      wsRef.current = ws;
      
      // Manipuladores de eventos
      ws.addEventListener('open', () => {
        console.log("[DIGIT-DISPLAY] Conexão WebSocket estabelecida com sucesso");
        setIsConnected(true);
        setErrorMessage(null);
        
        // Solicitar histórico de ticks e assinar para atualizações
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
          console.log("[DIGIT-DISPLAY] Solicitação enviada:", request);
        } catch (err) {
          console.error("[DIGIT-DISPLAY] Erro ao enviar solicitação:", err);
          setErrorMessage("Falha ao enviar solicitação para o servidor");
        }
      });
      
      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Processar histórico inicial
          if (data.history && data.history.prices) {
            const prices = data.history.prices;
            console.log(`[DIGIT-DISPLAY] Histórico recebido com ${prices.length} preços`);
            
            // Extrair dígitos do histórico (último dígito decimal)
            const historyDigits = prices.map((price: number) => {
              const priceStr = price.toFixed(2);
              return parseInt(priceStr.charAt(priceStr.length - 1)) as Digit;
            }).reverse(); // Inverter para mostrar do mais recente para o mais antigo
            
            if (historyDigits.length > 0) {
              console.log(`[DIGIT-DISPLAY] Primeiros 10 dígitos: ${historyDigits.slice(0, 10).join(', ')}`);
              setLatestTicks(formatTicks(prices.slice(-20)));
              setDigits(historyDigits);
              setLastDigit(historyDigits[0]);
              const newStats = calculateStats(historyDigits);
              setStats(newStats);
              setIsLoading(false);
              setUpdateTime(new Date());
            }
          }
          
          // Processar ticks em tempo real
          if (data.tick && data.tick.quote) {
            const price = parseFloat(data.tick.quote);
            const priceStr = price.toFixed(2);
            const digit = parseInt(priceStr.charAt(priceStr.length - 1)) as Digit;
            
            console.log(`[DIGIT-DISPLAY] Tick recebido: ${price}, último dígito: ${digit}`);
            
            // Atualizar estado
            setLastDigit(digit);
            setDigits(prev => {
              const updated = [digit, ...prev].slice(0, 500);
              const newStats = calculateStats(updated);
              setStats(newStats);
              return updated;
            });
            
            // Atualizar display de ticks
            setLatestTicks(prev => {
              const newDisplay = digit + ' ' + prev.trim().substring(0, 36);
              return newDisplay;
            });
            
            setUpdateTime(new Date());
          }
          
          // Tratar erros da API
          if (data.error) {
            console.error(`[DIGIT-DISPLAY] Erro da API: ${data.error.code} - ${data.error.message}`);
            setErrorMessage(`Erro: ${data.error.message}`);
          }
        } catch (err) {
          console.error("[DIGIT-DISPLAY] Erro ao processar mensagem:", err);
        }
      });
      
      ws.addEventListener('error', (err) => {
        console.error("[DIGIT-DISPLAY] Erro na conexão WebSocket:", err);
        setIsConnected(false);
        setErrorMessage("Erro na conexão com o servidor");
      });
      
      ws.addEventListener('close', (event) => {
        console.log(`[DIGIT-DISPLAY] Conexão fechada (código: ${event.code}): ${event.reason}`);
        setIsConnected(false);
        
        // Tentar reconectar após 3 segundos
        setTimeout(() => {
          console.log("[DIGIT-DISPLAY] Tentando reconectar...");
          connectWebSocket();
        }, 3000);
      });
    } catch (err) {
      console.error("[DIGIT-DISPLAY] Erro ao configurar WebSocket:", err);
      setErrorMessage("Erro ao configurar conexão");
      setIsLoading(false);
    }
  };
  
  // Conectar quando o componente montar
  useEffect(() => {
    console.log("[DIGIT-DISPLAY] Componente montado, iniciando conexão...");
    connectWebSocket();
    
    // Limpar conexão ao desmontar
    return () => {
      console.log("[DIGIT-DISPLAY] Desmontando componente...");
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Atualizar estatísticas quando o tamanho da amostra mudar
  useEffect(() => {
    if (digits.length > 0) {
      console.log(`[DIGIT-DISPLAY] Tamanho da amostra alterado para: ${sampleSize}`);
      setStats(calculateStats(digits));
    }
  }, [sampleSize]);
  
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
                <option value={500}>500</option>
              </select>
            </div>
            
            <span className="text-sm text-gray-400">
              Última atualização: {updateTime.toLocaleTimeString()}
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