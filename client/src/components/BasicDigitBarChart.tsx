import React, { useEffect, useState } from 'react';

/**
 * Componente extremamente simplificado para mostrar estatísticas de dígitos
 * Esta implementação não depende de serviços externos, apenas recebe dados via WebSocket diretamente
 */
export function BasicDigitBarChart({ className = '' }: { className?: string }) {
  // Estados básicos
  const [stats, setStats] = useState<Array<{digit: number, count: number, percentage: number}>>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalSamples, setTotalSamples] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Símbolo fixo
  const symbol = 'R_100';
  
  // Função para criar WebSocket e processar dados
  useEffect(() => {
    console.log('BasicDigitBarChart: Inicializando conexão WebSocket direta');
    
    // Flag de montagem para evitar atualizações após desmontagem
    let isMounted = true;
    
    // Armazenamento local de dados
    const ticksHistory: number[] = [];
    const maxTicks = 500;
    
    // Conexão WebSocket
    const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3');
    
    // Calcular estatísticas de dígitos
    const calculateStats = () => {
      if (!isMounted) return;
      
      // Contagem de dígitos
      const digitCounts: Record<number, number> = {
        0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
      };
      
      // Contar ocorrências
      ticksHistory.forEach(lastDigit => {
        digitCounts[lastDigit]++;
      });
      
      // Calcular percentuais e formatar
      const total = ticksHistory.length;
      const newStats = Object.keys(digitCounts).map(digit => {
        const count = digitCounts[parseInt(digit)];
        return {
          digit: parseInt(digit),
          count,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0
        };
      });
      
      // Atualizar estados apenas se componente ainda montado
      if (isMounted) {
        setStats(newStats);
        setLastDigits(ticksHistory.slice(-10).reverse());
        setTotalSamples(total);
        setIsLoading(false);
        
        // Forçar atualização visual 
        setRefreshTrigger(prev => prev + 1);
      }
    };
    
    // Processar mensagens recebidas
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Resposta a ticks_history
        if (data.msg_type === 'history' && data.echo_req.ticks_history === symbol) {
          // Processar histórico inicial
          console.log(`BasicDigitBarChart: Recebido histórico com ${data.history.prices.length} ticks`);
          
          // Extrair últimos dígitos
          const digits = data.history.prices.map((price: string) => {
            const lastChar = price.toString().slice(-1);
            return parseInt(lastChar);
          });
          
          // Limpar histórico e adicionar novos dados
          ticksHistory.length = 0;
          digits.forEach(digit => {
            ticksHistory.push(digit);
            if (ticksHistory.length > maxTicks) {
              ticksHistory.shift();
            }
          });
          
          // Atualizar estatísticas
          calculateStats();
        }
        
        // Resposta a tick_stream
        if (data.msg_type === 'tick' && data.tick && data.tick.symbol === symbol) {
          // Extrair último dígito do preço
          const price = data.tick.quote;
          const lastDigit = parseInt(price.toString().slice(-1));
          
          // Adicionar ao histórico
          ticksHistory.push(lastDigit);
          if (ticksHistory.length > maxTicks) {
            ticksHistory.shift();
          }
          
          // Atualizar estatísticas
          calculateStats();
        }
        
      } catch (err) {
        console.error('Erro ao processar mensagem:', err);
      }
    };
    
    // Eventos de conexão
    ws.onopen = () => {
      console.log('BasicDigitBarChart: WebSocket conectado');
      
      // Solicitar histórico de ticks
      ws.send(JSON.stringify({
        ticks_history: symbol,
        adjust_start_time: 1,
        count: 500,
        end: 'latest',
        start: 1,
        style: 'ticks'
      }));
      
      // Subscrever ticks em tempo real
      ws.send(JSON.stringify({
        ticks: symbol,
        subscribe: 1
      }));
    };
    
    ws.onerror = (error) => {
      console.error('BasicDigitBarChart: Erro na conexão WebSocket', error);
      if (isMounted) {
        setError('Erro ao conectar à API Deriv. Tente recarregar a página.');
        setIsLoading(false);
      }
    };
    
    ws.onclose = () => {
      console.log('BasicDigitBarChart: Conexão WebSocket fechada');
      if (isMounted) {
        setError('A conexão com a API Deriv foi fechada. Recarregue a página para tentar novamente.');
        setIsLoading(false);
      }
    };
    
    // Limpar ao desmontar
    return () => {
      isMounted = false;
      
      // Cancelar subscrição e fechar conexão
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          forget_all: 'ticks'
        }));
        ws.close();
      }
    };
  }, []);
  
  // Renderização do componente
  return (
    <div className={`bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg ${className}`}>
      {/* Cabeçalho */}
      <div className="p-3 bg-[#0e1a2e] border-b border-[#232e47] flex justify-between items-center">
        <h3 className="font-medium text-white">
          <span className="text-[#3a96dd]">{symbol}:</span> Análise de Dígitos
          {isLoading && <span className="ml-2 text-xs text-gray-400">Carregando...</span>}
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
        {/* Gráfico de barras */}
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
              <div key={i} className="w-full border-t border-[#2a3756] h-0"></div>
            ))}
          </div>
          
          {/* Barras para dígitos */}
          <div className="flex justify-between items-end w-full pl-8">
            {stats.length > 0 ? (
              // Mapear as estatísticas para barras
              stats.map((stat) => {
                // Escala visual para percentuais típicos (~10-15%)
                const barHeight = Math.max(10, (stat.percentage / 5) * 100);
                const barColor = stat.digit % 2 === 0 ? '#00e5b3' : '#ff444f';
                
                return (
                  <div 
                    key={`bar-${stat.digit}-${refreshTrigger}`} 
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
              })
            ) : (
              // Barras de placeholder durante carregamento
              Array.from({ length: 10 }, (_, i) => (
                <div key={`placeholder-${i}`} className="flex flex-col items-center w-full">
                  <div className="text-xs text-white mb-1">0%</div>
                  <div 
                    style={{
                      backgroundColor: i % 2 === 0 ? '#00e5b3' : '#ff444f',
                      height: '10%',
                      width: '100%',
                      maxWidth: '30px',
                      borderRadius: '2px 2px 0 0'
                    }}
                  />
                  <div className="mt-2 text-sm text-white">{i}</div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Sequência de dígitos recentes */}
        <div className="mt-4 flex justify-center">
          <div className="bg-[#0c1625] border border-[#2a3756] rounded-md flex items-center px-2 py-1 space-x-2">
            {lastDigits.map((digit, index) => (
              <div 
                key={`recent-${index}-${digit}-${refreshTrigger}`}
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
                key={`empty-${i}`}
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
          <div>Baseado em {totalSamples} ticks (v{refreshTrigger})</div>
          <div className="text-[#3a96dd] font-medium">{symbol}</div>
        </div>
      </div>
    </div>
  );
}