/**
 * Componente de exibição de dados do R_100 no dashboard
 * Este componente carrega dados do histórico salvo no localStorage
 * e mantém atualização em tempo real usando WebSocket dedicado
 */

import { useEffect, useState, useRef } from "react";
import { derivHistoryService, type DigitHistoryData } from "../services/deriv-history-service";

interface DigitData {
  digit: number;
  count: number;
  percentage: number;
}

export function DashboardR100Display() {
  const [digitStats, setDigitStats] = useState<DigitData[]>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  
  // Efeito para carregar histórico do localStorage ao iniciar componente
  useEffect(() => {
    // Verificar os dados no localStorage diretamente
    console.log('[DASHBOARD_R100] Verificando dados no localStorage diretamente');
    const localStorageData = localStorage.getItem('deriv_ticks_R_100');
    console.log('[DASHBOARD_R100] Dados brutos no localStorage:', localStorageData ? 'ENCONTRADOS' : 'NÃO ENCONTRADOS');
    
    if (localStorageData) {
      try {
        const parsedData = JSON.parse(localStorageData);
        console.log('[DASHBOARD_R100] Quantidade de ticks no localStorage:', parsedData.length);
        
        // Extrair todos os dígitos do histórico (até 500)
        const allDigits = parsedData.map((tick: any) => tick.lastDigit);
        // Para exibição, pegamos apenas os últimos 20 dígitos
        const lastDigitsExtracted = allDigits.slice(-20);
        console.log('[DASHBOARD_R100] Total de dígitos carregados:', allDigits.length);
        console.log('[DASHBOARD_R100] Últimos 20 dígitos para exibição:', lastDigitsExtracted);
        
        // Atualizar o estado com os dados extraídos
        setLastDigits(lastDigitsExtracted);
        setLastUpdate(new Date());
        
        // Calcular estatísticas manualmente
        const digitCounts = Array(10).fill(0);
        parsedData.forEach((tick: any) => {
          if (tick.lastDigit >= 0 && tick.lastDigit <= 9) {
            digitCounts[tick.lastDigit]++;
          }
        });
        
        // Calcular percentuais e formar estatísticas
        const totalCount = parsedData.length || 1; // Evitar divisão por zero
        const stats: DigitData[] = [];
        
        for (let digit = 0; digit <= 9; digit++) {
          const count = digitCounts[digit];
          const percentage = Math.round((count / totalCount) * 100);
          stats.push({ digit, count, percentage });
        }
        
        console.log('[DASHBOARD_R100] Estatísticas calculadas:', stats.map(s => `${s.digit}:${s.percentage}%`).join(', '));
        setDigitStats(stats);
      } catch (error) {
        console.error('[DASHBOARD_R100] Erro ao processar dados do localStorage:', error);
      }
    } else {
      // Tentar o método original
      try {
        const historyData = derivHistoryService.getDigitStats('R_100');
        console.log('[DASHBOARD_R100] Dados do derivHistoryService:', historyData);
        
        if (historyData && historyData.lastDigits && historyData.lastDigits.length > 0) {
          console.log(`[DASHBOARD_R100] Carregados ${historyData.lastDigits.length} ticks do histórico salvo`);
          
          // Atualizar o estado com dados carregados (pegando os últimos 20)
          setLastDigits(historyData.lastDigits.slice(0, 20));
          setLastUpdate(historyData.lastUpdated);
          
          // Converter estatísticas para o formato usado pelo componente
          const stats: DigitData[] = [];
          for (let i = 0; i <= 9; i++) {
            if (historyData.digitStats[i]) {
              stats.push({
                digit: i,
                count: historyData.digitStats[i].count,
                percentage: historyData.digitStats[i].percentage
              });
            }
          }
          
          setDigitStats(stats);
        } else {
          console.log('[DASHBOARD_R100] Nenhum histórico encontrado, começando do zero');
        }
      } catch (error) {
        console.error('[DASHBOARD_R100] Erro ao carregar histórico:', error);
      }
    }
  }, []);
  
  // Registrar um ouvinte para atualizações do serviço
  useEffect(() => {
    const handleHistoryUpdate = (data: DigitHistoryData) => {
      // Atualizar com dados mais recentes do serviço
      if (data && data.lastDigits && data.lastDigits.length > 0) {
        setLastDigits(data.lastDigits.slice(0, 20));
        setLastUpdate(data.lastUpdated);
        
        // Converter estatísticas para o formato usado pelo componente
        const stats: DigitData[] = [];
        for (let i = 0; i <= 9; i++) {
          if (data.digitStats[i]) {
            stats.push({
              digit: i,
              count: data.digitStats[i].count,
              percentage: data.digitStats[i].percentage
            });
          }
        }
        
        setDigitStats(stats);
      }
    };
    
    // Registrar ouvinte
    derivHistoryService.addListener(handleHistoryUpdate, 'R_100');
    
    // Remover ouvinte ao desmontar
    return () => {
      derivHistoryService.removeListener(handleHistoryUpdate);
    };
  }, []);
  
  // Efeito para criar uma conexão WebSocket dedicada e isolada apenas para este componente
  useEffect(() => {
    // Função para criar uma conexão WebSocket completamente nova
    const connectWebSocket = () => {
      console.log('[DASHBOARD_R100] Iniciando nova conexão dedicada...');
      
      // Limpar qualquer conexão anterior
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      
      // Criar uma conexão totalmente nova e independente
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      wsRef.current = ws;
      
      // Configurar manipuladores de eventos
      ws.onopen = () => {
        console.log('[DASHBOARD_R100] Conexão estabelecida, solicitando ticks...');
        setIsConnected(true);
        
        // Subscrever para ticks do R_100 (específico para o dashboard)
        ws.send(JSON.stringify({ ticks: 'R_100', subscribe: 1 }));
        
        // Configurar ping periódico para manter a conexão
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        
        pingIntervalRef.current = window.setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ ping: 1 }));
            console.log('[DASHBOARD_R100] Ping enviado para manter conexão');
          }
        }, 30000);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Tratar apenas mensagens de tick para R_100
          if (data.msg_type === 'tick' && data.tick && data.tick.symbol === 'R_100') {
            const price = parseFloat(data.tick.quote);
            // Obter o último dígito
            const lastDigit = Math.floor(price * 10) % 10;
            
            // Atualizar estado
            setLastDigits(prev => {
              const newDigits = [...prev, lastDigit];
              // Manter apenas os últimos 20 dígitos
              return newDigits.slice(-20);
            });
            
            // Atualizar horário da última atualização
            setLastUpdate(new Date());
          }
        } catch (error) {
          console.error('[DASHBOARD_R100] Erro ao processar mensagem:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('[DASHBOARD_R100] Erro na conexão WebSocket:', error);
        setIsConnected(false);
      };
      
      ws.onclose = (event) => {
        console.log(`[DASHBOARD_R100] Conexão fechada: ${event.code} ${event.reason}`);
        setIsConnected(false);
        
        // Limpar intervalo de ping
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        
        // Tentar reconectar após alguns segundos
        setTimeout(connectWebSocket, 5000);
      };
    };
    
    // Iniciar conexão
    connectWebSocket();
    
    // Limpar recursos ao desmontar o componente
    return () => {
      console.log('[DASHBOARD_R100] Limpando recursos do componente...');
      
      // Limpar intervalo de ping
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      // Fechar WebSocket
      if (wsRef.current) {
        try {
          if (wsRef.current.readyState === WebSocket.OPEN) {
            // Cancelar subscrição antes de fechar
            wsRef.current.send(JSON.stringify({ forget_all: 'ticks' }));
            wsRef.current.close();
          }
        } catch (e) {
          console.error('[DASHBOARD_R100] Erro ao fechar WebSocket:', e);
        }
        wsRef.current = null;
      }
    };
  }, []);
  
  // Efeito para calcular estatísticas quando os últimos dígitos mudam
  useEffect(() => {
    if (lastDigits.length > 0) {
      const digitCounts = Array(10).fill(0);
      
      // Contar ocorrências de cada dígito
      lastDigits.forEach(digit => {
        digitCounts[digit]++;
      });
      
      // Calcular percentuais
      const stats = digitCounts.map((count, digit) => {
        const percentage = (count / lastDigits.length) * 100;
        return { digit, count, percentage: Math.round(percentage) };
      });
      
      setDigitStats(stats);
    }
  }, [lastDigits]);
  
  // Função para obter a cor da barra com base no percentual
  const getBarColor = (percentage: number) => {
    if (percentage >= 30) return 'bg-red-600';
    if (percentage >= 20) return 'bg-red-500';
    if (percentage >= 10) return 'bg-red-500';
    return 'bg-gray-500';
  };
  
  return (
    <div className="p-4 bg-slate-800 rounded-lg border border-slate-700 transition-all">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-white">R_100 - Últimos dígitos</h2>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-xs text-slate-400">
            {isConnected ? 'Conectado' : 'Desconectado'}
          </span>
        </div>
      </div>
      
      {/* Exibição de últimos dígitos */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2 justify-center mb-2">
          {lastDigits.length > 0 ? lastDigits.map((digit, index) => (
            <div 
              key={index} 
              className={`w-8 h-8 flex items-center justify-center rounded-full font-medium 
              ${digit % 2 === 0 ? 'bg-red-500' : digit === 5 || digit === 0 ? 'bg-blue-500' : 'bg-green-500'} 
              text-white`}
            >
              {digit}
            </div>
          )) : (
            <div className="text-slate-500 py-2">Aguardando dados...</div>
          )}
        </div>
        <div className="text-xs text-slate-500 text-center">
          {lastUpdate ? `Última atualização: ${lastUpdate.toLocaleTimeString()}` : 'Sem dados'}
        </div>
      </div>
      
      {/* Gráfico de estatísticas de dígitos */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-slate-300">Estatísticas - Histórico de 500 ticks</h3>
        {digitStats.map((stat) => (
          <div key={stat.digit} className="flex items-center">
            <div className="w-4 text-xs text-slate-400 mr-2">{stat.digit}</div>
            <div className="flex-1 h-5 bg-slate-900 rounded-sm overflow-hidden">
              <div 
                className={`h-full ${getBarColor(stat.percentage)}`} 
                style={{ width: `${stat.percentage}%` }}
              ></div>
            </div>
            <div className="ml-2 text-xs text-slate-400 w-8 text-right">{stat.percentage}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}