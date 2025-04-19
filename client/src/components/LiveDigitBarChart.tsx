import React, { useEffect, useState, useRef } from 'react';
import { DigitBarChart } from './DigitBarChart';
import { independentDerivService, DigitHistory } from '../services/independent-deriv-service';

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
  maxDigits = 500  // Fixado em 500 ticks para atender ao requisito
}: LiveDigitBarChartProps) {
  const [historyData, setHistoryData] = useState<DigitHistory | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updateCounter, setUpdateCounter] = useState<number>(0);
  
  // Referência para controlar montagem
  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    // Função para atualizar os dados quando recebermos novas informações
    const updateHistoryData = (data: DigitHistory) => {
      if (!isMountedRef.current) return;
      
      console.log('[LiveDigitBarChart] Recebendo atualização de histórico:', 
        data.lastDigits.slice(-10).reverse().join(','), 
        'Stats:', data.stats.map(s => `${s.digit}:${s.percentage}%`).join(', '));
      
      // Sempre clonar os dados para garantir nova referência de objeto
      setHistoryData({
        ...data,
        stats: data.stats.map(stat => ({ ...stat })),
        lastDigits: [...data.lastDigits]
      });
      
      // Incrementar contador para forçar atualização
      setUpdateCounter(prev => prev + 1);
      
      setLoading(false);
    };
    
    // Registrar para receber atualizações
    independentDerivService.addListener('history', updateHistoryData);
    
    // Também escutar ticks diretamente para garantir atualização
    const handleTick = (tickData: any) => {
      if (!isMountedRef.current) return;
      
      // Quando receber um novo tick, buscar os dados mais recentes
      const current = independentDerivService.getDigitHistory(symbol);
      if (current && current.totalSamples > 0) {
        updateHistoryData(current);
      }
    };
    
    // Registrar para receber ticks individuais também
    independentDerivService.addListener('tick', handleTick);
    
    // Função para lidar com erros
    const handleError = (errorData: any) => {
      if (!isMountedRef.current) return;
      
      console.error('[LiveDigitBarChart] Erro na conexão:', errorData);
      setError('Falha na comunicação com a Deriv API');
      setLoading(false);
    };
    
    // Registrar para receber erros
    independentDerivService.addListener('error', handleError);
    
    // Buscar dados iniciais
    const fetchInitialData = async () => {
      try {
        if (!isMountedRef.current) return;
        
        setLoading(true);
        
        // Obter dados atuais (podem estar vazios inicialmente)
        const currentData = independentDerivService.getDigitHistory(symbol);
        
        // Se já temos dados, podemos mostrá-los enquanto carregamos mais
        if (currentData && currentData.totalSamples > 0) {
          setHistoryData({
            ...currentData,
            stats: currentData.stats.map(stat => ({ ...stat })),
            lastDigits: [...currentData.lastDigits]
          });
        }
        
        // Solicitar dados mais recentes e assinar para atualizações
        // Isso usa uma conexão WebSocket separada, independente do bot
        await independentDerivService.fetchTicksHistory(symbol, maxDigits);
        await independentDerivService.subscribeTicks(symbol);
        
        if (!isMountedRef.current) return;
        setLoading(false);
      } catch (err) {
        if (!isMountedRef.current) return;
        
        console.error('[LiveDigitBarChart] Erro ao buscar dados iniciais:', err);
        setError('Falha ao conectar com a Deriv API');
        setLoading(false);
      }
    };
    
    // Iniciar busca de dados
    fetchInitialData();
    
    // Configurar intervalo para forçar atualização de tempos em tempos
    const updateInterval = setInterval(() => {
      if (!isMountedRef.current) return;
      
      // Buscar dados atuais e atualizar mesmo se não houver mudança
      const current = independentDerivService.getDigitHistory(symbol);
      if (current && current.totalSamples > 0) {
        setHistoryData({
          ...current,
          stats: current.stats.map(stat => ({ ...stat })),
          lastDigits: [...current.lastDigits]
        });
        
        // Incrementar contador para forçar atualização
        setUpdateCounter(prev => prev + 1);
      }
    }, 1000);
    
    // Limpar ao desmontar
    return () => {
      isMountedRef.current = false;
      clearInterval(updateInterval);
      independentDerivService.removeListener('history', updateHistoryData);
      independentDerivService.removeListener('tick', handleTick);
      independentDerivService.removeListener('error', handleError);
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
    
    // Clonar estatísticas para garantir novo objeto
    const statistics = historyData.stats.map(stat => ({...stat}));
    
    // Pegar os últimos 10 dígitos em ordem inversa (mais recente primeiro)
    const recentDigits = [...historyData.lastDigits].slice(-10).reverse();
    
    // Adicionar um log para verificar
    console.log(`[LiveDigitBarChart] Preparando dados para renderização #${updateCounter}:`, 
      recentDigits.join(','),
      statistics.map(s => `${s.digit}:${s.percentage}%`).join(','));
    
    return {
      statistics,
      totalCount: historyData.totalSamples,
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
  
  // A chave de atualização garante que o componente será recriado com os novos dados
  // mesmo que a referência do objeto não mude
  return (
    <DigitBarChart
      key={`chart-${updateCounter}`}
      statistics={chartData.statistics}
      totalCount={chartData.totalCount}
      recentDigits={chartData.recentDigits}
      className={className}
    />
  );
}