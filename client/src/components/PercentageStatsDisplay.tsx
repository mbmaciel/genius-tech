import React, { useState, useEffect, useCallback } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { oauthDirectService } from '@/services/oauthDirectService';

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

// Definindo a interface de props com prop symbol
interface PercentageStatsDisplayProps {
  symbol: string;
}

/**
 * Componente dedicado apenas às estatísticas percentuais
 * Captura ticks diretamente da Deriv, totalmente independente dos componentes de exibição de dígitos
 */
// Removendo o React.memo que pode estar causando problema na atualização
export function PercentageStatsDisplay({
  symbol = 'R_100'
}: PercentageStatsDisplayProps) {
  // Estado para armazenar estatísticas de dígitos (0-9)
  const [digitStats, setDigitStats] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 }))
  );
  
  // Estado para armazenar os ticks recentes (mais recentes primeiro)
  const [recentTicks, setRecentTicks] = useState<number[]>([]);
  
  // Estado para configurar quantos ticks analisar
  const [tickCount, setTickCount] = useState<string>("50");
  
  // Estado para controlar carregamento inicial
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Função para calcular cores das barras com base no percentual
  const getBarColor = (percentage: number): string => {
    if (percentage <= 5) return "bg-blue-500";
    if (percentage <= 8) return "bg-green-500";
    if (percentage <= 12) return "bg-amber-500";
    return "bg-red-500";
  };

  // Função para calcular as estatísticas de dígitos com base nos ticks recentes
  const calculateDigitStats = useCallback((ticks: number[], count: number) => {
    // Usar apenas a quantidade selecionada de ticks mais recentes
    const selectedTicks = ticks.slice(0, count);
    
    // Inicializar contagens para cada dígito (0-9)
    const digitCounts = Array(10).fill(0);
    
    // Contar a frequência de cada dígito
    selectedTicks.forEach(tick => {
      if (tick >= 0 && tick <= 9) {
        digitCounts[tick]++;
      }
    });
    
    // Total de ticks analisados
    const totalTicks = selectedTicks.length;
    
    // Criar array de estatísticas com percentuais
    return digitCounts.map((count, digit) => {
      const percentage = totalTicks > 0 ? Math.round((count / totalTicks) * 100) : 0;
      return { digit, count, percentage };
    });
  }, []);

  // Função para buscar o histórico direto da Deriv
  const fetchDerivHistory = useCallback(async () => {
    try {
      console.log('[PercentageStatsDisplay] Solicitando histórico direto da Deriv para', symbol);
      
      // Fazer a solicitação direta para a API da Deriv
      const response = await fetch('https://blue.binaryws.com/api/v3/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticks_history: symbol,
          adjust_start_time: 1,
          count: 500,
          end: 'latest',
          start: 1,
          style: 'ticks',
          req_id: Date.now(),
        }),
      });
      
      const data = await response.json();
      
      if (data && data.history && data.history.prices) {
        console.log(`[PercentageStatsDisplay] Histórico recebido com ${data.history.prices.length} ticks`);
        
        // Processar ticks e obter os últimos dígitos
        const historyDigits = data.history.prices.map((price: number) => 
          parseInt(price.toString().slice(-1))
        ).reverse(); // Mais recente primeiro
        
        // Atualizar estado
        setRecentTicks(historyDigits);
        
        // Calcular estatísticas
        const stats = calculateDigitStats(historyDigits, parseInt(tickCount));
        setDigitStats(stats);
        
        // Desativar carregamento
        setIsLoading(false);
        
        // Log para debugging
        console.log(`[PercentageStatsDisplay] ESTATÍSTICAS ATUALIZADAS: ${stats.map(s => `${s.digit}: ${s.percentage}%`).join(', ')}`);
        
        return historyDigits;
      }
      
      console.warn('[PercentageStatsDisplay] Resposta inválida da API Deriv');
      setIsLoading(false);
      return [];
    } catch (error) {
      console.error('[PercentageStatsDisplay] Erro ao buscar histórico da Deriv:', error);
      setIsLoading(false);
      return [];
    }
  }, [symbol, tickCount, calculateDigitStats]);

  // Conectar ao serviço OAuth e configurar atualizações em tempo real
  useEffect(() => {
    console.log('[PercentageStatsDisplay] Inicializando componente para', symbol);
    
    // Buscar histórico inicial diretamente da Deriv (sem dados fictícios)
    fetchDerivHistory();
    
    // Inicializar conexão OAuth para dados em tempo real
    oauthDirectService.initializeConnection()
      .then((success) => {
        if (success) {
          console.log('[PercentageStatsDisplay] Conexão OAuth inicializada com sucesso');
          oauthDirectService.subscribeToTicks(symbol);
        } else {
          console.error('[PercentageStatsDisplay] Falha ao inicializar conexão OAuth');
        }
      })
      .catch(error => {
        console.error('[PercentageStatsDisplay] Erro ao inicializar conexão OAuth:', error);
      });
      
    // Handler para processar ticks em tempo real
    const handleTickEvent = (event: any) => {
      if (event.type === 'tick' && event.tick) {
        // Extrair o último dígito do valor do tick
        const tickValue = event.tick.quote || event.tick.ask;
        const lastDigit = parseInt(tickValue.toString().slice(-1));
        
        console.log(`[PercentageStatsDisplay] NOVO TICK RECEBIDO EM TEMPO REAL: ${tickValue}, dígito: ${lastDigit}`);
        
        // Atualizar ticks e estatísticas
        setRecentTicks(prevTicks => {
          const newTicks = [lastDigit, ...prevTicks].slice(0, 500);
          
          // Calcular novas estatísticas
          const stats = calculateDigitStats(newTicks, parseInt(tickCount));
          setDigitStats(stats);
          
          // Mostrar estatísticas atualizadas no console
          console.log(`[PercentageStatsDisplay] ★★★ ATUALIZANDO ESTATÍSTICAS: ${stats.map(s => `${s.digit}: ${s.percentage}%`).join(', ')}`);
          
          return newTicks;
        });
      }
    };

    // Registrar o handler
    oauthDirectService.addEventListener(handleTickEvent);
    
    // Limpar inscrições ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleTickEvent);
    };
  }, [symbol, calculateDigitStats, tickCount, fetchDerivHistory]);

  // Atualizar estatísticas quando a quantidade de ticks mudar
  useEffect(() => {
    if (recentTicks.length > 0) {
      const stats = calculateDigitStats(recentTicks, parseInt(tickCount));
      setDigitStats(stats);
    }
  }, [tickCount, recentTicks, calculateDigitStats]);

  return (
    <div className="w-full">
      {/* Seletor de quantidade de ticks */}
      <div className="flex justify-end mb-3">
        <Select
          value={tickCount}
          onValueChange={setTickCount}
        >
          <SelectTrigger className="h-8 w-[150px] bg-[#0e1a2e] border-[#2c3e5d] text-white">
            <SelectValue placeholder="Ticks para análise" />
          </SelectTrigger>
          <SelectContent className="bg-[#13203a] border-[#2c3e5d] text-white">
            <SelectItem value="25">25 ticks</SelectItem>
            <SelectItem value="50">50 ticks</SelectItem>
            <SelectItem value="100">100 ticks</SelectItem>
            <SelectItem value="150">150 ticks</SelectItem>
            <SelectItem value="200">200 ticks</SelectItem>
            <SelectItem value="300">300 ticks</SelectItem>
            <SelectItem value="500">500 ticks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-32">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-400">Carregando dados em tempo real...</span>
        </div>
      ) : (
        <>
          {/* Exibição compacta dos percentuais relevantes para estratégias */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="bg-[#0e1a2e] p-3 rounded-md">
              <h4 className="text-white text-sm font-medium mb-1">Dígitos 0-1</h4>
              <div className="flex items-end space-x-1">
                <div className="text-2xl font-bold text-white">
                  {digitStats.filter(s => s.digit <= 1).reduce((sum, s) => sum + s.percentage, 0)}%
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  (0: {digitStats.find(s => s.digit === 0)?.percentage}%, 1: {digitStats.find(s => s.digit === 1)?.percentage}%)
                </div>
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-3 rounded-md">
              <h4 className="text-white text-sm font-medium mb-1">Dígitos &gt; 5</h4>
              <div className="flex items-end space-x-1">
                <div className="text-2xl font-bold text-white">
                  {digitStats.filter(s => s.digit > 5).reduce((sum, s) => sum + s.percentage, 0)}%
                </div>
                <div className="text-xs text-gray-400 mb-1">
                  (6-9: {digitStats.filter(s => s.digit > 5).map(s => s.digit + ':' + s.percentage + '%').join(', ')})
                </div>
              </div>
            </div>
          </div>
          
          {/* Estatísticas detalhadas */}
          <div className="grid grid-cols-10 gap-1 mt-4">
            {digitStats.map(stat => (
              <div key={stat.digit} className="flex flex-col items-center">
                <div className="font-bold text-white mb-1">{stat.digit}</div>
                <div className="w-full bg-[#0e1a2e] rounded-sm h-24 relative">
                  <div
                    className={`absolute bottom-0 w-full ${getBarColor(stat.percentage)}`}
                    style={{ 
                      height: `${Math.max(stat.percentage, 4)}%`,
                      transition: 'height 0.3s ease-out' 
                    }}
                  ></div>
                  <div className="absolute bottom-2 left-0 right-0 text-center text-white font-bold">
                    {stat.percentage}%
                  </div>
                </div>
                <div className="text-xs text-gray-400 mt-1">{stat.count}</div>
              </div>
            ))}
          </div>
          
          {/* Estatísticas adicionais */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mt-4">
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">Pares</div>
              <div className="text-lg font-bold text-white">
                {digitStats.filter(s => s.digit % 2 === 0).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">Ímpares</div>
              <div className="text-lg font-bold text-white">
                {digitStats.filter(s => s.digit % 2 !== 0).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">0-4</div>
              <div className="text-lg font-bold text-white">
                {digitStats.filter(s => s.digit <= 4).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">5-9</div>
              <div className="text-lg font-bold text-white">
                {digitStats.filter(s => s.digit >= 5).reduce((sum, s) => sum + s.percentage, 0)}%
              </div>
            </div>
            <div className="bg-[#0e1a2e] p-2 rounded-md text-center">
              <div className="text-xs text-gray-400">Total</div>
              <div className="text-lg font-bold text-white">
                {recentTicks.length > 0 ? recentTicks.length : 0}/500
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}