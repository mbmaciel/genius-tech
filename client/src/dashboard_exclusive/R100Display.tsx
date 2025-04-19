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
  const [localTickCount, setLocalTickCount] = useState<string>(tickCount.toString());
  
  // DEBUG - mostrar valores no console
  useEffect(() => {
    console.log("[DashboardR100Display] Componente inicializado com tickCount:", tickCount);
  }, []);
  
  // Efeito para gerenciar a conexão WebSocket
  useEffect(() => {
    // Função para processar ticks do R_100
    const handleTick = (event: Event) => {
      const customEvent = event as CustomEvent;
      const tickData = customEvent.detail.tick as DashboardTickEvent;
      
      if (tickData && tickData.symbol === 'R_100') {
        // Calcular último dígito
        const price = tickData.quote;
        // Método seguro para extrair o último dígito, 
        // garantindo que 0 também seja detectado corretamente
        const lastDigit = Math.floor(price * 10) % 10;
        
        // Log para debug do digito recebido
        console.log(`[R100Display] Recebido tick - Valor: ${price}, Último dígito: ${lastDigit}`);
        
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
    // Inicializar contagem para cada dígito (0-9), mesmo sem dados
    const digitCounts = Array(10).fill(0);
    
    // Contar ocorrências de cada dígito se tivermos dados
    if (lastDigits.length > 0) {
      lastDigits.forEach(digit => {
        // Garantir que o dígito está no intervalo válido
        if (digit >= 0 && digit <= 9) {
          digitCounts[digit]++;
        }
      });
    }
    
    // Calcular estatísticas para todos os dígitos de 0-9
    const totalDigits = lastDigits.length || 1; // Evitar divisão por zero
    const stats = [];
    
    for (let digit = 0; digit <= 9; digit++) {
      const count = digitCounts[digit];
      const percentage = (count / totalDigits) * 100;
      stats.push({ 
        digit, 
        count, 
        percentage: Math.round(percentage) 
      });
    }
    
    // Log para debug dos dígitos
    console.log(`[R100Display] Processando ${lastDigits.length} dígitos. Último dígito: ${lastDigits[lastDigits.length-1]}`);
    console.log(`[R100Display] Estatísticas: ${stats.map(s => `${s.digit}:${s.percentage}%`).join(', ')}`);
    
    // Atualizar estatísticas
    setDigitStats(stats);
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
    const newTicksValue = e.target.value;
    setLocalTickCount(newTicksValue);
    // Limitar os dígitos existentes ao novo valor
    setLastDigits((prev) => prev.slice(-parseInt(newTicksValue)));
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
      
      {/* Gráfico de barras para cada dígito - implementação direta */}
      <div className="w-full mb-6 bg-[#1d2a45] p-4 rounded-md">
        <div className="flex justify-between items-end h-52 mb-6 relative">
          {/* Eixo Y (percentuais) */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 pr-2">
            <div>100%</div>
            <div>80%</div>
            <div>60%</div>
            <div>40%</div>
            <div>20%</div>
            <div>0%</div>
          </div>
          
          {/* Barras para cada dígito */}
          <div className="flex justify-between items-end w-full pl-8 gap-1 pt-4">
            {digitStats.map((stat) => {
              // Altura visual da barra
              const barHeight = Math.max(10, Math.min(100, stat.percentage * 2));
              // Cores diferentes para pares e ímpares
              const barColor = stat.digit % 2 === 0 ? '#00e5b3' : '#ff444f';
              
              return (
                <div key={`bar-${stat.digit}`} className="flex flex-col items-center flex-1">
                  {/* Percentual */}
                  <div className="text-xs font-medium mb-1 text-white">
                    {stat.percentage}%
                  </div>
                  
                  {/* Barra */}
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${barHeight}%`,
                      backgroundColor: barColor,
                      minHeight: '10px',
                      maxWidth: '30px',
                      margin: '0 auto'
                    }}
                  ></div>
                  
                  {/* Dígito */}
                  <div className="mt-2 text-center text-sm font-medium text-white">
                    {stat.digit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
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