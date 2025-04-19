import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { oauthDirectService } from '@/services/oauthDirectService';

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

interface SimplePercentageStatsProps {
  symbol: string;
}

/**
 * Componente muito simples para exibir estatísticas de frequência de dígitos
 */
export function SimplePercentageStats({ symbol }: SimplePercentageStatsProps) {
  // Estados para armazenar dados e configurações
  const [digitStats, setDigitStats] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 }))
  );
  const [tickCount, setTickCount] = useState<string>("50");
  const [recentTicks, setRecentTicks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Função para buscar histórico usando o serviço WebSocket
  useEffect(() => {
    console.log('[SimplePercentageStats] Iniciando componente para', symbol);
    
    // Função de callback para receber histórico
    const processHistory = (history: any) => {
      try {
        if (history && history.history && history.history.prices) {
          // Extrair últimos dígitos e inverter para ter os mais recentes primeiro
          const digits = history.history.prices.map((price: number) => {
            return parseInt(price.toString().slice(-1));
          }).reverse();
          
          console.log(`[SimplePercentageStats] Recebidos ${digits.length} ticks via WebSocket`);
          
          // Atualizar estado
          setRecentTicks(digits);
          
          // Calcular estatísticas iniciais
          updateStats(digits, parseInt(tickCount));
          
          // Remover estado de carregamento
          setIsLoading(false);
          
          // Atualizar timestamp
          setLastUpdate(Date.now());
        } else {
          console.error('[SimplePercentageStats] Dados de histórico inválidos:', history);
        }
      } catch (error) {
        console.error('[SimplePercentageStats] Erro ao processar histórico:', error);
      }
    };
    
    // Função para receber ticks em tempo real
    const processTick = (tick: any) => {
      try {
        if (tick && (tick.quote || tick.ask)) {
          const price = tick.quote || tick.ask;
          const lastDigit = parseInt(price.toString().slice(-1));
          
          console.log(`[SimplePercentageStats] Novo tick: ${price}, último dígito: ${lastDigit}`);
          
          // Adicionar novo dígito ao estado
          setRecentTicks(prev => {
            const updated = [lastDigit, ...prev].slice(0, 500);
            updateStats(updated, parseInt(tickCount));
            return updated;
          });
          
          // Atualizar timestamp
          setLastUpdate(Date.now());
        }
      } catch (error) {
        console.error('[SimplePercentageStats] Erro ao processar tick:', error);
      }
    };
    
    // Inicializar conexão e solicitar histórico
    const initConnection = async () => {
      try {
        // Garantir que o serviço esteja conectado
        const connected = await oauthDirectService.initializeConnection();
        
        if (connected) {
          console.log('[SimplePercentageStats] Conexão WebSocket inicializada com sucesso');
          
          // Solicitar histórico de ticks
          oauthDirectService.requestTicksHistory(symbol, 500, processHistory);
          
          // Inscrever para ticks em tempo real
          oauthDirectService.subscribeToTicks(symbol);
        } else {
          console.error('[SimplePercentageStats] Falha ao inicializar conexão WebSocket');
        }
      } catch (error) {
        console.error('[SimplePercentageStats] Erro ao inicializar conexão:', error);
      }
    };
    
    // Iniciar conexão
    initConnection();
    
    // Configurar handler de eventos para ticks em tempo real
    const tickHandler = (event: any) => {
      if (event.type === 'tick' && event.tick) {
        processTick(event.tick);
      }
    };
    
    // Registrar handler
    oauthDirectService.addEventListener(tickHandler);
    
    // Configurar timer para solicitar histórico novamente a cada 30 segundos
    const intervalId = setInterval(() => {
      console.log('[SimplePercentageStats] Solicitando atualização do histórico');
      oauthDirectService.requestTicksHistory(symbol, 500, processHistory);
    }, 30000);
    
    // Limpar ao desmontar
    return () => {
      clearInterval(intervalId);
      oauthDirectService.removeEventListener(tickHandler);
    };
  }, [symbol, tickCount]);

  // Função para calcular estatísticas quando ticks ou quantidade mudar
  const updateStats = (ticks: number[], count: number) => {
    // Selecionar apenas a quantidade solicitada
    const selectedTicks = ticks.slice(0, count);
    
    if (selectedTicks.length === 0) {
      return;
    }
    
    // Contadores de dígitos
    const counts = Array(10).fill(0);
    
    // Contar ocorrências
    selectedTicks.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    });
    
    // Calcular percentuais
    const totalTicks = selectedTicks.length;
    const stats = counts.map((count, digit) => {
      const percentage = Math.round((count / totalTicks) * 100);
      return { digit, count, percentage };
    });
    
    // Atualizar estado
    setDigitStats(stats);
  };

  // Atualizar estatísticas quando quantidade de ticks mudar
  useEffect(() => {
    if (recentTicks.length > 0) {
      updateStats(recentTicks, parseInt(tickCount));
    }
  }, [tickCount, recentTicks]);

  // Função para determinar cor com base no percentual
  const getColorClass = (percentage: number): string => {
    if (percentage <= 5) return "bg-blue-500";
    if (percentage <= 8) return "bg-green-500";
    if (percentage <= 12) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="w-full p-4 bg-[#0d1729] rounded-md">
      {/* Seletor de ticks para análise */}
      <div className="flex justify-between items-center mb-3">
        <div className="text-sm text-gray-400">
          Última atualização: {new Date(lastUpdate).toLocaleTimeString()}
        </div>
        <Select value={tickCount} onValueChange={setTickCount}>
          <SelectTrigger className="h-8 w-[120px] bg-[#0e1a2e] border-[#2c3e5d] text-white">
            <SelectValue placeholder="Ticks" />
          </SelectTrigger>
          <SelectContent className="bg-[#13203a] border-[#2c3e5d] text-white">
            <SelectItem value="25">25 ticks</SelectItem>
            <SelectItem value="50">50 ticks</SelectItem>
            <SelectItem value="100">100 ticks</SelectItem>
            <SelectItem value="200">200 ticks</SelectItem>
            <SelectItem value="500">500 ticks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-400">Carregando dados...</span>
        </div>
      ) : (
        <>
          {/* Mostrar resumos de grupos relevantes */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-[#0e1a2e] p-3 rounded-md">
              <h4 className="text-white text-sm font-medium mb-1">Dígitos 0-1</h4>
              <div className="text-xl font-bold text-white">
                {digitStats.filter(s => s.digit <= 1).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
              <div className="text-xs text-gray-400">
                0: {digitStats.find(s => s.digit === 0)?.percentage}%, 
                1: {digitStats.find(s => s.digit === 1)?.percentage}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-3 rounded-md">
              <h4 className="text-white text-sm font-medium mb-1">Dígitos &gt; 5</h4>
              <div className="text-xl font-bold text-white">
                {digitStats.filter(s => s.digit > 5).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
              <div className="text-xs text-gray-400">
                {digitStats
                  .filter(s => s.digit > 5)
                  .map(s => `${s.digit}: ${s.percentage}%`)
                  .join(', ')}
              </div>
            </div>
          </div>
          
          {/* Gráfico de barras para todos os dígitos */}
          <div className="grid grid-cols-10 gap-1">
            {digitStats.map(stat => (
              <div key={stat.digit} className="flex flex-col items-center">
                <div className="font-bold text-white mb-1">{stat.digit}</div>
                <div className="w-full bg-[#0e1a2e] rounded-sm h-20 relative">
                  <div
                    className={`absolute bottom-0 w-full ${getColorClass(stat.percentage)}`}
                    style={{ 
                      height: `${Math.max(stat.percentage, 3)}%`, 
                      transition: 'height 0.3s ease-out' 
                    }}
                  ></div>
                  <div className="absolute bottom-1 left-0 right-0 text-center text-white text-xs font-bold">
                    {stat.percentage}%
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">{stat.count}</div>
              </div>
            ))}
          </div>
          
          {/* Estatísticas adicionais */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">Pares</div>
              <div className="text-md font-bold text-white">
                {digitStats.filter(s => s.digit % 2 === 0).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">Ímpares</div>
              <div className="text-md font-bold text-white">
                {digitStats.filter(s => s.digit % 2 === 1).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">Total</div>
              <div className="text-md font-bold text-white">
                {recentTicks.length > 0 ? recentTicks.length : 0}/500
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}