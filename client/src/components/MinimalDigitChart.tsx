import React, { useState, useEffect, useRef } from 'react';

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export function MinimalDigitChart({ className = '' }: { className?: string }) {
  // Estados
  const [stats, setStats] = useState<DigitStat[]>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSamples, setTotalSamples] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  
  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const ticksHistoryRef = useRef<number[]>([]);
  const isMountedRef = useRef(true);
  
  // Symbol fixo
  const symbol = 'R_100';
  
  // Manipular mensagens WebSocket
  const handleMessage = (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      
      // Resposta de histórico de ticks
      if (data.msg_type === 'history' && data.echo_req.ticks_history === symbol) {
        const prices = data.history.prices;
        
        // Extrair dígitos
        const digits = prices.map((price: string) => {
          const lastChar = price.toString().slice(-1);
          return parseInt(lastChar);
        });
        
        // Atualizar histórico
        ticksHistoryRef.current = digits;
        
        // Processar estatísticas
        processDigitStats();
      }
      
      // Resposta de stream de ticks
      if (data.msg_type === 'tick' && data.tick && data.tick.symbol === symbol) {
        // Extrair último dígito
        const price = data.tick.quote;
        const lastDigit = parseInt(price.toString().slice(-1));
        
        // Adicionar ao histórico, mantendo tamanho máximo
        ticksHistoryRef.current.push(lastDigit);
        if (ticksHistoryRef.current.length > 500) {
          ticksHistoryRef.current.shift();
        }
        
        // Processar estatísticas
        processDigitStats();
      }
    } catch (err) {
      console.error('Erro ao processar mensagem:', err);
    }
  };
  
  // Calcular estatísticas de dígitos
  const processDigitStats = () => {
    if (!isMountedRef.current) return;
    
    const digitCounts: Record<number, number> = {};
    
    // Inicializar contadores
    for (let i = 0; i < 10; i++) {
      digitCounts[i] = 0;
    }
    
    // Contar ocorrências
    ticksHistoryRef.current.forEach(digit => {
      digitCounts[digit]++;
    });
    
    // Calcular percentuais e formatar resultados
    const total = ticksHistoryRef.current.length;
    const calculatedStats = Object.keys(digitCounts).map(digit => {
      const count = digitCounts[parseInt(digit)];
      return {
        digit: parseInt(digit),
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });
    
    // Ordenar por dígito
    calculatedStats.sort((a, b) => a.digit - b.digit);
    
    // Ultimos 10 dígitos em ordem reversa (mais recente primeiro)
    const recentDigits = [...ticksHistoryRef.current].slice(-10).reverse();
    
    // Atualizar estados
    setStats(calculatedStats);
    setLastDigits(recentDigits);
    setTotalSamples(total);
    setLoading(false);
    setUpdateCount(prev => prev + 1);
    
    // Log de atualizações (comentado para não poluir console)
    // console.log('MinimalDigitChart: Estatísticas atualizadas', calculatedStats);
  };
  
  // Configurar WebSocket
  useEffect(() => {
    console.log('MinimalDigitChart: Inicializando...');
    isMountedRef.current = true;
    
    // Criar conexão WebSocket
    const connect = () => {
      try {
        wsRef.current = new WebSocket('wss://ws.binaryws.com/websockets/v3');
        
        wsRef.current.onopen = () => {
          console.log('MinimalDigitChart: Conexão estabelecida');
          
          // Solicitar histórico inicial
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              ticks_history: symbol,
              adjust_start_time: 1,
              count: 500,
              end: 'latest',
              start: 1,
              style: 'ticks'
            }));
            
            // Subscrever ticks em tempo real
            wsRef.current.send(JSON.stringify({
              ticks: symbol,
              subscribe: 1
            }));
          }
        };
        
        wsRef.current.onmessage = handleMessage;
        
        wsRef.current.onclose = (event) => {
          console.log(`MinimalDigitChart: Conexão fechada (${event.code})`);
          
          // Tentar reconectar
          if (isMountedRef.current) {
            setTimeout(() => {
              if (isMountedRef.current) {
                connect();
              }
            }, 2000);
          }
        };
        
        wsRef.current.onerror = (error) => {
          console.error('MinimalDigitChart: Erro na conexão', error);
          setError('Falha na conexão com a API Deriv');
        };
      } catch (error) {
        console.error('MinimalDigitChart: Erro ao criar WebSocket', error);
        setError('Falha ao criar conexão WebSocket');
      }
    };
    
    // Iniciar conexão
    connect();
    
    // Limpeza ao desmontar
    return () => {
      console.log('MinimalDigitChart: Desmontando componente');
      isMountedRef.current = false;
      
      if (wsRef.current) {
        // Cancelar subscrição antes de fechar
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            forget_all: 'ticks'
          }));
        }
        
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);
  
  return (
    <div className={`bg-[#0e1a2e] rounded-lg overflow-hidden shadow-lg ${className}`}>
      {/* Cabeçalho */}
      <div className="p-3 bg-[#0e1a2e] border-b border-[#232e47] flex justify-between items-center">
        <h3 className="font-medium text-white">
          <span className="text-[#3a96dd]">{symbol}:</span> Análise de Dígitos
          {loading && <span className="ml-2 text-xs text-gray-400">Carregando...</span>}
        </h3>
        <div className="bg-[#ff3e50] px-2 py-0.5 text-xs text-white font-medium rounded-sm">
          Últimos 10 Dígitos (%)
        </div>
      </div>
      
      {/* Mensagem de erro */}
      {error && (
        <div className="p-4 text-center text-red-500">{error}</div>
      )}
      
      {/* Gráfico principal */}
      <div className="p-4">
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
          
          {/* Linhas de grade */}
          <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={`grid-${i}-${updateCount}`} className="w-full border-t border-[#2a3756] h-0"></div>
            ))}
          </div>
          
          {/* Barras para dígitos */}
          <div className="flex justify-between items-end w-full pl-8">
            {stats.map((stat) => {
              // Escala visual para percentuais típicos (~10-15%)
              const barHeight = Math.max(10, (stat.percentage / 5) * 100);
              const barColor = stat.digit % 2 === 0 ? '#00e5b3' : '#ff444f';
              
              return (
                <div 
                  key={`digit-${stat.digit}-${updateCount}`} 
                  className="flex flex-col items-center w-full"
                >
                  {/* Percentual acima da barra */}
                  <div className="text-xs font-bold text-white mb-1">
                    {stat.percentage}%
                  </div>
                  
                  {/* A barra em si */}
                  <div 
                    style={{
                      backgroundColor: barColor,
                      height: `${barHeight}%`,
                      width: '100%',
                      minHeight: '8px',
                      maxWidth: '30px',
                      borderRadius: '2px 2px 0 0'
                    }}
                  />
                  
                  {/* Dígito abaixo da barra */}
                  <div className="mt-2 text-sm font-medium text-white">
                    {stat.digit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Sequência de dígitos recentes */}
        <div className="mt-4 flex justify-center">
          <div className="bg-[#0c1625] border border-[#2a3756] rounded-md flex items-center px-2 py-1 space-x-2">
            {lastDigits.map((digit, index) => (
              <div 
                key={`recent-${index}-${digit}-${updateCount}`}
                className={`w-6 h-6 flex items-center justify-center ${
                  digit % 2 === 0 ? 'text-[#00e5b3]' : 'text-[#ff444f]'
                } font-medium text-base`}
              >
                {digit}
              </div>
            ))}
            
            {/* Preencher espaços vazios se necessário */}
            {Array.from({ length: Math.max(0, 10 - lastDigits.length) }, (_, i) => (
              <div 
                key={`empty-${i}-${updateCount}`}
                className="w-6 h-6 flex items-center justify-center text-transparent"
              >
                0
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Rodapé */}
      <div className="px-4 py-2 bg-[#0c1625] text-xs text-gray-400 border-t border-[#232e47]">
        <div className="flex justify-between items-center">
          <div>Baseado em {totalSamples} ticks</div>
          <div className="text-[#3a96dd] font-medium">v{updateCount}</div>
        </div>
      </div>
    </div>
  );
}