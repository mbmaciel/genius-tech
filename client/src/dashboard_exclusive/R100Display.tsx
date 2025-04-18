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
  const [lastUpdate, setLastUpdate] = useState<string>('--:--:--');
  
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
          // Manter apenas os últimos 20 dígitos
          return newDigits.slice(-20);
        });
        
        // Atualizar hora da última atualização
        const now = new Date();
        setLastUpdate(now.toLocaleTimeString());
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
      
      // Não desconectar o WebSocket aqui para manter a conexão 
      // entre navegações, apenas cancelar a subscrição do R_100
    };
  }, []);
  
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
  
  // Função para determinar a cor do dígito
  const getDigitColor = (digit: number): string => {
    if (digit === 0 || digit === 5) {
      return "bg-blue-500"; // Azul para 0 e 5
    } else if (digit % 2 === 0) {
      return "bg-red-500";  // Vermelho para pares
    } else {
      return "bg-green-500"; // Verde para ímpares
    }
  };
  
  // Função para obter cor da barra de estatística
  const getBarColor = (percentage: number): string => {
    if (percentage >= 30) return 'bg-red-600';
    if (percentage >= 20) return 'bg-red-500';
    if (percentage >= 10) return 'bg-red-500';
    return 'bg-gray-500';
  };
  
  return (
    <div className="p-4 bg-slate-800 rounded-lg shadow-lg border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white">R_100 - Dashboard Monitor</h3>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-400">
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>
      
      {/* Últimos dígitos */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-slate-300 mb-2">Últimos dígitos</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {lastDigits.length > 0 ? (
            lastDigits.map((digit, index) => (
              <div
                key={index}
                className={`w-8 h-8 flex items-center justify-center rounded-full ${getDigitColor(digit)} text-white font-medium`}
              >
                {digit}
              </div>
            ))
          ) : (
            <div className="text-slate-500 py-2">Aguardando dados...</div>
          )}
        </div>
        <div className="text-xs text-slate-500 text-right">
          Atualizado: {lastUpdate}
        </div>
      </div>
      
      {/* Estatísticas */}
      <div>
        <h4 className="text-sm font-medium text-slate-300 mb-2">Estatísticas de Dígitos</h4>
        <div className="grid grid-cols-1 gap-2">
          {digitStats.map((stat) => (
            <div key={stat.digit} className="flex items-center">
              <div className="w-6 text-xs text-slate-400">{stat.digit}</div>
              <div className="flex-1 h-5 bg-slate-900 rounded-sm overflow-hidden">
                <div
                  className={`h-full ${getBarColor(stat.percentage)}`}
                  style={{ width: `${stat.percentage}%` }}
                ></div>
              </div>
              <div className="ml-2 text-xs text-slate-400 w-10 text-right">
                {stat.percentage}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}