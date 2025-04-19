import React, { useEffect, useState } from 'react';
import { DigitBarChart } from './DigitBarChart';
import { DerivHistoryService, DigitHistoryData } from '../services/deriv-history-service';

interface LiveDigitBarChartProps {
  symbol?: string;
  className?: string;
  maxDigits?: number;
}

/**
 * Componente que exibe um gráfico de barras com estatísticas de dígitos em tempo real
 * Utiliza uma conexão WebSocket independente, separada da conexão OAuth do bot
 */
export function LiveDigitBarChart({
  symbol = 'R_100',
  className = '',
  maxDigits = 500
}: LiveDigitBarChartProps) {
  const [historyData, setHistoryData] = useState<DigitHistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Obter a instância do serviço
    const historyService = DerivHistoryService.getInstance();
    
    // Função para atualizar os dados quando recebermos novas informações
    const updateHistoryData = (data: DigitHistoryData) => {
      setHistoryData(data);
      setLoading(false);
    };
    
    // Registrar para receber atualizações
    historyService.addListener(updateHistoryData);
    
    // Buscar dados iniciais
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Obter dados atuais (podem estar vazios inicialmente)
        const currentData = historyService.getDigitStats(symbol);
        
        // Se já temos dados, podemos mostrá-los enquanto carregamos mais
        if (currentData && currentData.lastDigits.length > 0) {
          setHistoryData(currentData);
        }
        
        // Solicitar dados mais recentes e assinar para atualizações
        // Isso usa uma conexão WebSocket separada, independente do bot
        await historyService.getTicksHistory(symbol, maxDigits, true);
        
        setLoading(false);
      } catch (err) {
        console.error('[LiveDigitBarChart] Erro ao buscar dados iniciais:', err);
        setError('Falha ao conectar com a Deriv API');
        setLoading(false);
      }
    };
    
    // Iniciar busca de dados
    fetchInitialData();
    
    // Limpar ao desmontar
    return () => {
      historyService.removeListener(updateHistoryData);
    };
  }, [symbol, maxDigits]);
  
  // Preparar os dados para o componente de gráfico
  const prepareChartData = () => {
    if (!historyData) {
      // Dados de placeholder vazios durante o carregamento
      return {
        statistics: Array.from({ length: 10 }, (_, i) => ({
          digit: i,
          count: 0,
          percentage: 0
        })),
        totalCount: 0,
        recentDigits: []
      };
    }
    
    // Converter as estatísticas do formato do serviço para o formato do gráfico
    const statistics = Object.entries(historyData.digitStats).map(([digit, stats]) => ({
      digit: parseInt(digit),
      count: stats.count,
      percentage: stats.percentage
    })).sort((a, b) => a.digit - b.digit); // Ordenar por dígito
    
    // Recentes primeiro
    const recentDigits = [...historyData.lastDigits].slice(0, 10);
    
    return {
      statistics,
      totalCount: historyData.totalCount,
      recentDigits
    };
  };
  
  const chartData = prepareChartData();
  
  // Estado de carregamento
  if (loading && !historyData) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="mt-3 text-gray-400">Conectando à Deriv...</p>
        </div>
      </div>
    );
  }
  
  // Estado de erro
  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-red-500">
          <p>{error}</p>
          <button 
            className="mt-2 px-4 py-2 bg-primary rounded-md hover:bg-primary/80"
            onClick={() => window.location.reload()}
          >
            Reconectar
          </button>
        </div>
      </div>
    );
  }
  
  // Renderizar o gráfico com os dados preparados
  return (
    <DigitBarChart
      statistics={chartData.statistics}
      totalCount={chartData.totalCount}
      recentDigits={chartData.recentDigits}
      className={className}
    />
  );
}