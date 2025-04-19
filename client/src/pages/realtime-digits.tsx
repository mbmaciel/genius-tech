import React, { useState, useEffect, useRef } from 'react';

// Definição de tipos
type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

interface DigitStat {
  digit: Digit;
  count: number;
  percentage: number;
}

const RealtimeDigits: React.FC = () => {
  // Estados para dados e UI
  const [digits, setDigits] = useState<Digit[]>([]);
  const [lastDigit, setLastDigit] = useState<Digit | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState<number>(100);
  const [stats, setStats] = useState<DigitStat[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Referências
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Identificar o último segundo em que um tick foi recebido para evitar duplicação em alta frequência
  const lastTickTimeRef = useRef<number>(0);
  
  // Função para calcular estatísticas
  const calculateStats = (digitList: Digit[], size: number) => {
    // Limitando ao tamanho da amostra
    const sample = digitList.slice(0, size);
    
    if (sample.length === 0) {
      return Array.from({ length: 10 }, (_, i) => ({
        digit: i as Digit,
        count: 0,
        percentage: 0
      }));
    }
    
    // Contando cada dígito
    const counts: Record<Digit, number> = {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
    };
    
    sample.forEach(digit => {
      counts[digit]++;
    });
    
    // Calculando percentuais
    const result: DigitStat[] = Object.entries(counts).map(([digitStr, count]) => {
      const digit = parseInt(digitStr) as Digit;
      const percentage = Math.round((count / sample.length) * 100);
      return { digit, count, percentage };
    });
    
    return result.sort((a, b) => a.digit - b.digit);
  };
  
  // Função para processar um novo tick
  const processTick = (tick: any) => {
    try {
      if (!tick || !tick.quote) return;
      
      const now = Date.now();
      const price = parseFloat(tick.quote);
      
      // Extrair o último dígito (casa decimal)
      const priceStr = price.toFixed(2);
      const digit = parseInt(priceStr.charAt(priceStr.length - 1)) as Digit;
      
      // Verificar se não é duplicata (mesmo segundo)
      const tickTime = tick.epoch || Math.floor(now / 1000);
      if (tickTime <= lastTickTimeRef.current) {
        return;
      }
      
      // Atualizar o tempo do último tick
      lastTickTimeRef.current = tickTime;
      
      // Atualizar o estado com o novo dígito
      setLastDigit(digit);
      setLastUpdate(new Date());
      
      // Adicionar o novo dígito ao início da lista
      setDigits(prevDigits => {
        const updatedDigits = [digit, ...prevDigits].slice(0, 500);
        setStats(calculateStats(updatedDigits, sampleSize));
        return updatedDigits;
      });
      
      // Log para debug
      console.log(`[REAL-DIGITS] Tick recebido: ${price}, Último dígito: ${digit}`);
    } catch (err) {
      console.error('[REAL-DIGITS] Erro ao processar tick:', err);
    }
  };
  
  // Função para conectar-se ao WebSocket da Deriv
  const connectWebSocket = () => {
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('[REAL-DIGITS] WebSocket já conectado');
        return;
      }
      
      // Limpar qualquer tentativa de reconexão pendente
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      // Criar conexão
      console.log('[REAL-DIGITS] Iniciando conexão WebSocket...');
      const socket = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      wsRef.current = socket;
      
      // Gerenciar eventos do WebSocket
      socket.onopen = () => {
        console.log('[REAL-DIGITS] Conexão WebSocket estabelecida com sucesso');
        setIsConnected(true);
        setError(null);
        
        // Solicitar histórico + inscrição para R_100
        const request = {
          ticks_history: 'R_100',
          adjust_start_time: 1,
          count: 500,
          end: 'latest',
          start: 1,
          style: 'ticks',
          subscribe: 1
        };
        
        try {
          socket.send(JSON.stringify(request));
          console.log('[REAL-DIGITS] Solicitação enviada:', request);
        } catch (err) {
          console.error('[REAL-DIGITS] Erro ao enviar solicitação:', err);
          setError('Erro ao enviar solicitação para o servidor');
        }
      };
      
      // Processar mensagens recebidas
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Processar histórico inicialmente recebido
          if (data.history && data.history.prices) {
            console.log(`[REAL-DIGITS] Histórico recebido com ${data.history.prices.length} preços`);
            
            // Extrair dígitos do histórico
            const historyDigits = data.history.prices.map((price: number) => {
              const priceStr = price.toFixed(2);
              return parseInt(priceStr.charAt(priceStr.length - 1)) as Digit;
            });
            
            // Atualizar estados
            if (historyDigits.length > 0) {
              setDigits(historyDigits);
              setLastDigit(historyDigits[0]);
              setStats(calculateStats(historyDigits, sampleSize));
              setLastUpdate(new Date());
              console.log(`[REAL-DIGITS] Processados ${historyDigits.length} dígitos do histórico`);
              console.log(`[REAL-DIGITS] Primeiros 10 dígitos: ${historyDigits.slice(0, 10).join(', ')}`);
            }
            
            setIsLoading(false);
          }
          
          // Processar ticks de tempo real
          if (data.tick) {
            processTick(data.tick);
          }
          
          // Lidar com erros da API
          if (data.error) {
            console.error(`[REAL-DIGITS] Erro da API: ${data.error.code} - ${data.error.message}`);
            setError(`Erro da API: ${data.error.message}`);
          }
        } catch (err) {
          console.error('[REAL-DIGITS] Erro ao processar mensagem:', err);
        }
      };
      
      // Lidar com erros
      socket.onerror = (err) => {
        console.error('[REAL-DIGITS] Erro na conexão WebSocket:', err);
        setIsConnected(false);
        setError('Erro na conexão com o servidor');
        
        // A conexão já vai se fechar, então não precisamos fechar manualmente
      };
      
      // Lidar com fechamento da conexão
      socket.onclose = (event) => {
        console.log(`[REAL-DIGITS] Conexão WebSocket fechada (código: ${event.code}): ${event.reason}`);
        setIsConnected(false);
        
        // Tentar reconectar após 5 segundos
        reconnectTimerRef.current = setTimeout(() => {
          console.log('[REAL-DIGITS] Tentando reconectar...');
          connectWebSocket();
        }, 5000);
      };
    } catch (err) {
      console.error('[REAL-DIGITS] Erro ao configurar WebSocket:', err);
      setError('Erro ao configurar conexão com o servidor');
      setIsLoading(false);
    }
  };
  
  // Iniciar conexão quando o componente montar
  useEffect(() => {
    console.log('[REAL-DIGITS] Componente montado, iniciando conexão...');
    connectWebSocket();
    
    // Limpar ao desmontar
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      
      if (wsRef.current) {
        console.log('[REAL-DIGITS] Fechando conexão WebSocket...');
        wsRef.current.close();
      }
    };
  }, []);
  
  // Atualizar estatísticas quando o tamanho da amostra mudar
  useEffect(() => {
    if (digits.length > 0) {
      setStats(calculateStats(digits, sampleSize));
    }
  }, [sampleSize]);
  
  return (
    <div className="min-h-screen bg-[#0e1a2e] text-white p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Análise de Dígitos em Tempo Real</h1>
        
        {/* Status da conexão */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>
              {isConnected ? 'Conectado à Deriv API' : 'Desconectado'}
              {error && <span className="ml-2 text-red-400">({error})</span>}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span>Amostra:</span>
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
            
            <div className="text-sm text-gray-400">
              Última atualização: {lastUpdate.toLocaleTimeString()}
            </div>
          </div>
        </div>
        
        {/* Último dígito */}
        {lastDigit !== null && (
          <div className="flex justify-center mb-8">
            <div className="bg-[#1c64f2] w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold animate-pulse">
              {lastDigit}
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-4"></div>
            <p>Carregando dados do mercado...</p>
          </div>
        ) : (
          <>
            {/* Gráfico de barras */}
            <div className="bg-[#0f2444] rounded-lg shadow-xl border border-gray-800 p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Distribuição de Dígitos ({sampleSize} últimos ticks)</h2>
              
              <div className="h-64 flex items-end space-x-1 mb-6 relative">
                {/* Linhas de grade */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                  {[0, 10, 20, 30, 40, 50].map((value) => (
                    <div 
                      key={`grid-${value}`}
                      className="w-full border-t border-gray-800 relative"
                      style={{ bottom: `${value * 2}%` }}
                    >
                      <span className="absolute -top-2 -left-8 text-xs text-gray-500">
                        {value}%
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Barras para cada dígito */}
                {stats.map((stat) => {
                  // Determinar cor da barra baseado na frequência
                  const barColor = 
                    stat.percentage >= 25 ? 'bg-red-600' :
                    stat.percentage >= 20 ? 'bg-yellow-600' :
                    stat.digit % 2 === 0 ? 'bg-blue-800' : 'bg-purple-800';
                  
                  return (
                    <div 
                      key={`bar-${stat.digit}`}
                      className="flex-1 flex flex-col items-center"
                    >
                      {/* Porcentagem */}
                      <div className="mb-1 font-medium text-sm">
                        {stat.percentage}%
                      </div>
                      
                      {/* Barra */}
                      <div 
                        className={`w-full ${barColor} transition-all duration-300 rounded-t-sm`}
                        style={{ 
                          height: `${Math.max(1, stat.percentage * 2)}%`,
                        }}
                      ></div>
                      
                      {/* Dígito */}
                      <div className="mt-2 font-bold">
                        {stat.digit}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Legenda */}
              <div className="flex justify-center space-x-4 text-sm text-gray-400">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-600 rounded-sm mr-1"></div>
                  <span>≥ 25%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-yellow-600 rounded-sm mr-1"></div>
                  <span>≥ 20%</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-800 rounded-sm mr-1"></div>
                  <span>Pares</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-purple-800 rounded-sm mr-1"></div>
                  <span>Ímpares</span>
                </div>
              </div>
            </div>
            
            {/* Últimos dígitos */}
            <div className="bg-[#0f2444] rounded-lg shadow-xl border border-gray-800 p-6">
              <h2 className="text-xl font-semibold mb-4">Últimos 20 Dígitos</h2>
              
              <div className="grid grid-cols-10 gap-2">
                {digits.slice(0, 20).map((digit, index) => (
                  <div 
                    key={`digit-${index}`}
                    className={`
                      h-10 flex items-center justify-center rounded-md font-bold
                      ${index === 0 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-[#1c345a] text-gray-100'}
                    `}
                  >
                    {digit}
                  </div>
                ))}
              </div>
              
              <div className="mt-4 text-sm text-center text-gray-500">
                Total de dígitos disponíveis: {digits.length}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RealtimeDigits;