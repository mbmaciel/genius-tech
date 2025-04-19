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
import { RealtimeDigitBarChart } from "../components/RealtimeDigitBarChart";

// Dados estruturados para estatística de dígitos
interface DigitData {
  digit: number;
  count: number;
  percentage: number;
}

interface DashboardR100DisplayProps {
  onUpdateDigits?: (digit: number) => void;
  tickCount?: number;
}

export function DashboardR100Display({ onUpdateDigits, tickCount = 10 }: DashboardR100DisplayProps = {}) {
  // Estado local para este componente apenas
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [digitStats, setDigitStats] = useState<DigitData[]>([]);
  const [localTickCount, setLocalTickCount] = useState<number>(tickCount);
  
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
          return newDigits.slice(-parseInt(localTickCount.toString()));
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
  }, [localTickCount]);
  
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
    setLocalTickCount(newTicks);
    // Limitar os dígitos existentes ao novo valor
    setLastDigits((prev) => prev.slice(-newTicks));
  };
  
  return (
    <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg text-white font-medium">R_100 Digit Analysis</h2>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-1 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-400 mr-3">
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
          
          <select 
            className="bg-[#1d2a45] text-white text-sm rounded px-2 py-1 border border-[#3a4b6b]"
            value={localTickCount}
            onChange={handleTicksChange}
          >
            <option value="10">10 Ticks</option>
            <option value="25">25 Ticks</option>
            <option value="50">50 Ticks</option>
            <option value="100">100 Ticks</option>
            <option value="250">250 Ticks</option>
            <option value="500">500 Ticks</option>
          </select>
        </div>
      </div>
      
      {/* Novo componente otimizado de gráfico em tempo real */}
      <RealtimeDigitBarChart 
        symbol="R_100" 
        className="w-full mb-6" 
      />
      
      {/* Últimos dígitos com design aprimorado */}
      <div className="mt-4 bg-[#1d2a45] p-2 rounded">
        <div className="flex flex-wrap justify-center gap-1">
          {lastDigits.slice().reverse().map((digit, index) => {
            return (
              <div key={index} className="relative">
                {/* Indicador de mais recente */}
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                )}
                
                {/* Dígito com design hexagonal - usando tom azul da plataforma */}
                <div 
                  className="bg-[#2a407c] text-white w-9 h-9 flex items-center justify-center m-0.5 
                             shadow-lg transform transition-all duration-200"
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
    </div>
  );
}