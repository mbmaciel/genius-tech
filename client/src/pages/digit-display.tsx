import React, { useState, useEffect, useRef } from 'react';

// Tipos
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

// Componente principal
export default function DigitDisplay() {
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
  
  // Referências
  const wsRef = useRef<WebSocket | null>(null);
  
  // Calcular estatísticas
  const calculateStats = (digitList: Digit[]): {digit: Digit, count: number, percentage: number}[] => {
    // Usar apenas o número de dígitos da amostra selecionada
    const sample = digitList.slice(0, sampleSize);
    console.log(`[DIGIT-DISPLAY] Calculando estatísticas para ${sample.length} dígitos. Total disponível: ${digitList.length}`);
    
    if (sample.length === 0) {
      return Array.from({length: 10}, (_, i) => ({
        digit: i as Digit,
        count: 0,
        percentage: 0
      }));
    }
    
    // Contar ocorrências
    const counts: {[key in Digit]?: number} = {};
    for (let i = 0; i < 10; i++) {
      counts[i as Digit] = 0;
    }
    
    sample.forEach(digit => {
      counts[digit] = (counts[digit] || 0) + 1;
    });
    
    // Converter para array e calcular percentuais
    const result = Object.entries(counts).map(([digit, count]) => {
      const digitNum = parseInt(digit) as Digit;
      const percentage = Math.round((count / sample.length) * 100);
      return { digit: digitNum, count, percentage };
    });
    
    console.log(`[DIGIT-DISPLAY] Estatísticas calculadas:`, 
      result.map(stat => `${stat.digit}: ${stat.percentage}%`).join(', ')
    );
    
    return result.sort((a, b) => a.digit - b.digit);
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
            });
            
            if (historyDigits.length > 0) {
              console.log(`[DIGIT-DISPLAY] Primeiros 10 dígitos: ${historyDigits.slice(0, 10).join(', ')}`);
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
  
  // Função para colorir baseado na frequência
  const getBarColor = (percentage: number, isEven: boolean) => {
    if (percentage >= 25) return 'bg-red-600';
    if (percentage >= 20) return 'bg-yellow-600';
    return isEven ? 'bg-blue-700' : 'bg-purple-700';
  };
  
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
            {/* Gráfico de barras */}
            <div className="bg-[#0f2444] rounded-lg border border-gray-800 p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Distribuição de Dígitos ({sampleSize} ticks)</h2>
              
              <div className="flex items-end space-x-2 h-60 mb-4">
                {stats.map((stat) => (
                  <div 
                    key={`stat-${stat.digit}`}
                    className="flex-1 flex flex-col items-center"
                  >
                    {/* Porcentagem acima da barra */}
                    <div className="text-sm font-medium mb-1">
                      {stat.percentage}%
                    </div>
                    
                    {/* Barra vertical */}
                    <div 
                      className={`w-full ${getBarColor(stat.percentage, stat.digit % 2 === 0)} rounded-t-sm transition-all duration-300`}
                      style={{ 
                        height: `${Math.max(1, stat.percentage * 2)}%`,
                      }}
                    />
                    
                    {/* Dígito abaixo da barra */}
                    <div className="mt-2 font-bold">
                      {stat.digit}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Legenda */}
              <div className="flex justify-center gap-4 mt-4 text-sm text-gray-400">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-600 rounded-sm mr-1"></div>
                  <span>≥ 25%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-600 rounded-sm mr-1"></div>
                  <span>≥ 20%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-700 rounded-sm mr-1"></div>
                  <span>Pares</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-700 rounded-sm mr-1"></div>
                  <span>Ímpares</span>
                </div>
              </div>
            </div>
            
            {/* Últimos 20 dígitos */}
            <div className="bg-[#0f2444] rounded-lg border border-gray-800 p-6">
              <h2 className="text-xl font-semibold mb-4">Últimos 20 Dígitos</h2>
              
              <div className="grid grid-cols-10 gap-2">
                {digits.slice(0, 20).map((digit, index) => (
                  <div 
                    key={`digit-${index}`}
                    className={`
                      h-10 flex items-center justify-center rounded-md font-bold
                      ${index === 0 ? 'bg-blue-600' : 'bg-[#1a2e4c]'}
                    `}
                  >
                    {digit}
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-center text-sm text-gray-500">
                Total disponível: {digits.length} dígitos
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}