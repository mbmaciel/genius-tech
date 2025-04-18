/**
 * Componente EXCLUSIVO para o dashboard
 * 
 * Este componente exibe os últimos dígitos do R_100 
 * usando uma conexão WebSocket totalmente separada.
 * 
 * IMPORTANTE: ESTE COMPONENTE NÃO DEVE SER USADO PELO ROBÔ DE OPERAÇÕES!
 */

import { useEffect, useState } from "react";
import { dashboardWebSocket, DashboardTickEvent } from "./dashboardWebSocket";

// Dados estruturados para estatística de dígitos
interface DigitData {
  digit: number;
  count: number;
  percentage: number;
}

export function DashboardR100Display() {
  // Estado local para este componente apenas
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [digitStats, setDigitStats] = useState<DigitData[]>([]);
  const [tickCount, setTickCount] = useState<number>(10);
  
  // Efeito para gerenciar a conexão WebSocket
  useEffect(() => {
    // Função para processar ticks do R_100
    const handleTick = (event: Event) => {
      const customEvent = event as CustomEvent;
      const tickData = customEvent.detail.tick as DashboardTickEvent;
      
      if (tickData && tickData.symbol === 'R_100') {
        // Calcular último dígito
        const price = tickData.quote;
        const lastDigit = Math.floor(price * 10) % 10;
        
        // Atualizar lista de dígitos
        setLastDigits(prev => {
          const newDigits = [...prev, lastDigit];
          // Manter apenas os últimos N dígitos
          return newDigits.slice(-parseInt(tickCount.toString()));
        });
      }
    };
    
    // Registrar listener de eventos
    document.addEventListener('dashboard:tick', handleTick);
    
    // Iniciar conexão e subscrever para ticks do R_100
    dashboardWebSocket.connect();
    dashboardWebSocket.subscribeTicks('R_100');
    
    // Verificar status da conexão periodicamente
    const connectionCheck = setInterval(() => {
      setIsConnected(dashboardWebSocket.isActive());
    }, 1000);
    
    // Limpar ao desmontar
    return () => {
      document.removeEventListener('dashboard:tick', handleTick);
      dashboardWebSocket.unsubscribeTicks('R_100');
      clearInterval(connectionCheck);
    };
  }, [tickCount]);
  
  // Efeito para calcular estatísticas dos dígitos
  useEffect(() => {
    if (lastDigits.length > 0) {
      // Inicializar contagem para cada dígito (0-9)
      const digitCounts = Array(10).fill(0);
      
      // Contar ocorrências de cada dígito
      lastDigits.forEach(digit => {
        digitCounts[digit]++;
      });
      
      // Calcular estatísticas
      const stats = digitCounts.map((count, digit) => {
        const percentage = (count / lastDigits.length) * 100;
        return { 
          digit, 
          count, 
          percentage: Math.round(percentage) 
        };
      });
      
      // Atualizar estatísticas
      setDigitStats(stats);
    }
  }, [lastDigits]);
  
  // Função para obter cor da barra com base no percentual
  const getBarColor = (percentage: number): string => {
    if (percentage >= 30) return 'bg-red-600';
    if (percentage >= 20) return 'bg-red-500';
    if (percentage >= 10) return 'bg-red-500';
    return 'bg-gray-500';
  };
  
  // Manipulador para mudança na quantidade de ticks
  const handleTicksChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTicks = parseInt(e.target.value);
    setTickCount(newTicks);
    // Limitar os dígitos existentes ao novo valor
    setLastDigits((prev) => prev.slice(-newTicks));
  };
  
  return (
    <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg text-white font-medium">Gráfico de barras</h2>
        <select 
          className="bg-[#1d2a45] text-white text-sm rounded px-2 py-1 border border-[#3a4b6b]"
          value={tickCount}
          onChange={handleTicksChange}
        >
          <option value="10">10 Ticks</option>
          <option value="25">25 Ticks</option>
          <option value="50">50 Ticks</option>
          <option value="100">100 Ticks</option>
          <option value="250">250 Ticks</option>
          <option value="500">500 Ticks</option>
          <option value="1000">1000 Ticks</option>
        </select>
      </div>
      
      <div className="relative w-full h-96 mt-4">
        {/* Container responsivo para o gráfico */}
        <div className="relative flex flex-col h-full">
          {/* Eixo Y (percentuais) com posição fixa */}
          <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs text-gray-400 pr-2 z-10">
            <div>50</div>
            <div>40</div>
            <div>30</div>
            <div>20</div>
            <div>10</div>
            <div>0</div>
          </div>
          
          {/* Linhas de grade horizontais */}
          <div className="absolute left-8 right-2 top-0 bottom-6 flex flex-col justify-between z-0">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-full border-t border-[#2a3756] h-0"></div>
            ))}
          </div>
          
          {/* Gráfico de barras responsivo */}
          <div className="flex h-full pt-0 pb-6 pl-8 pr-2 overflow-x-auto">
            <div className="flex flex-1 min-w-0 h-full justify-between">
              {digitStats.map((stat) => (
                <div key={stat.digit} className="flex flex-col items-center justify-end px-1">
                  {/* Valor percentual acima da barra somente para barras com valor */}
                  {stat.percentage > 0 && (
                    <div className="text-xs font-medium text-white whitespace-nowrap mb-1">
                      {stat.percentage}%
                    </div>
                  )}
                  
                  {/* Barra do gráfico com altura proporcional e responsiva */}
                  <div 
                    className={`w-full min-w-[20px] max-w-[40px] ${getBarColor(stat.percentage)}`}
                    style={{ 
                      height: stat.percentage === 0 ? '0px' : `${Math.min(50, Math.max(3, stat.percentage))}%` 
                    }}
                  ></div>
                  
                  {/* Número do dígito abaixo da barra */}
                  <div className="mt-1 text-xs sm:text-sm text-white">{stat.digit}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Últimos dígitos com design aprimorado */}
      <div className="mt-4 bg-[#1d2a45] p-2 rounded">
        <div className="flex flex-wrap justify-center gap-1">
          {lastDigits.slice().reverse().map((digit, index) => {
            // Cores diferentes dependendo do dígito
            let bgColor = '';
            let textColor = 'text-white';
            
            // Cores estilizadas para diferentes dígitos
            if (digit === 0 || digit === 5) {
              bgColor = 'bg-blue-500'; // Azul para 0 e 5
            } else if (digit % 2 === 0) {
              bgColor = 'bg-red-500'; // Vermelho para pares (exceto 0)
            } else {
              bgColor = 'bg-green-500'; // Verde para ímpares (exceto 5)
            }
            
            return (
              <div key={index} className="relative">
                {/* Indicador de mais recente */}
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Dígito com design hexagonal */}
                <div 
                  className={`${bgColor} ${textColor} w-9 h-9 flex items-center justify-center m-0.5 
                               shadow-lg transform transition-all duration-200 
                               clip-path-hexagon`}
                  style={{
                    clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
                  }}
                >
                  <span className="text-lg font-bold">{digit}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Status da conexão */}
      <div className="mt-2 flex items-center justify-end">
        <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-xs text-slate-400">
          {isConnected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
    </div>
  );
}