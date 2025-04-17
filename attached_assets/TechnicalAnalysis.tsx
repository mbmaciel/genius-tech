import React, { useEffect, useState, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import DigitStats from './DigitStats';
import DigitSequence from './DigitSequence';
import './TechnicalAnalysis.css';

// Registrar os componentes necessários do Chart.js
Chart.register(...registerables);

interface R100Data {
  symbol: string;
  period: number;
  values: number[];
  isLoading: boolean;
  lastUpdated: Date | null;
  volatilityIndex: number;
  digitStats: {
    [key: number]: {
      count: number;
      percentage: number;
    }
  };
  lastDigits: number[];
}

const TechnicalAnalysis: React.FC = () => {
  const [r100Data, setR100Data] = useState<R100Data | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const chartRef = useRef<HTMLCanvasElement>(null);
  const chartInstance = useRef<Chart | null>(null);

  // Função para carregar dados do R_100 via API
  const loadR100Data = async () => {
    try {
      console.log('Tentando carregar dados do R_100...');
      const response = await fetch('/api/v1/r100-data');
      console.log('Resposta da API:', response.status, response.statusText);
      
      if (!response.ok) {
        throw new Error(`Erro de API: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Dados R_100 recebidos:', data);
      
      setR100Data(data);
      setConnected(!data.isLoading);
      updateChart(data.values);
    } catch (error) {
      console.error('Erro ao carregar dados do R_100:', error);
      setConnected(false);
    }
  };

  // Atualizar o gráfico com novos dados
  const updateChart = (values: number[]) => {
    if (!chartRef.current || values.length === 0) return;

    const ctx = chartRef.current.getContext('2d');
    if (!ctx) return;

    // Criar array de labels (timestamps simulados)
    const labels = Array.from({ length: values.length }, (_, i) => `${i}`);

    // Criar dados para o gráfico
    const chartData = {
      labels,
      datasets: [
        {
          label: 'R_100',
          data: values,
          borderColor: '#00e5b3',
          backgroundColor: 'rgba(0, 229, 179, 0.1)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
        }
      ]
    };

    // Configurações do gráfico
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          min: 0,
          max: 100,
          grid: {
            color: 'rgba(255, 255, 255, 0.05)',
          },
          ticks: {
            color: 'rgba(255, 255, 255, 0.7)',
          }
        },
        x: {
          display: false,
        }
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: true,
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(14, 26, 51, 0.9)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: 'rgba(0, 229, 179, 0.3)',
          borderWidth: 1,
        }
      },
      elements: {
        point: {
          radius: 0,
          hitRadius: 10,
          hoverRadius: 5,
        }
      },
      animation: {
        duration: 500,
      },
    };

    // Destruir instância anterior do gráfico, se existir
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    // Criar nova instância do gráfico
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: chartData,
      // @ts-ignore - Problema de tipagem do Chart.js
      options: chartOptions,
    });
  };

  // Efeito para carregar dados iniciais e configurar atualização periódica
  useEffect(() => {
    // Log quando o componente é montado
    console.log('TechnicalAnalysis montado - iniciando carregamento de dados');
    
    // Função para verificar se conseguimos acessar o endpoint
    const testEndpoint = async () => {
      try {
        const response = await fetch('/api/v1/r100-data');
        console.log('Teste de endpoint R_100:', response.status, response.statusText);
        const data = await response.json();
        console.log('Amostra de dados recebidos:', {
          symbol: data.symbol,
          period: data.period,
          values: data.values ? `${data.values.length} valores` : 'nenhum',
          digitStats: data.digitStats ? 'presente' : 'ausente',
          lastDigits: data.lastDigits ? `${data.lastDigits.length} dígitos` : 'nenhum'
        });
      } catch (error) {
        console.error('Erro no teste de endpoint:', error);
      }
    };
    
    // Executar teste de endpoint
    testEndpoint();
    
    // Carregar dados imediatamente
    loadR100Data();
    
    // Configurar atualizações periódicas a cada 5 segundos
    const intervalId = setInterval(() => {
      console.log('Atualizando dados R_100...');
      loadR100Data();
    }, 5000);
    
    // Limpar intervalo ao desmontar o componente
    return () => {
      console.log('TechnicalAnalysis desmontado - limpando interval');
      clearInterval(intervalId);
    };
  }, []);

  if (!r100Data) {
    return (
      <div className="technical-analysis-container loading">
        <h3>Análise Técnica (R_100)</h3>
        <div className="loading-spinner">Carregando dados...</div>
      </div>
    );
  }

  return (
    <div className="technical-analysis-container">
      <div className="technical-analysis-header">
        <div className="technical-analysis-title">
          <h3>Análise Técnica (R_100)</h3>
          <span className={`connection-status ${connected ? 'connected' : ''}`}>
            {connected ? 'Conectado' : 'Carregando...'}
          </span>
        </div>
        <div className="technical-analysis-meta">
          <div className="meta-item">
            <span className="meta-value">{r100Data.period}</span>
            <span className="meta-label">Período</span>
          </div>
          <div className="meta-item">
            <span className="meta-value">
              {r100Data.volatilityIndex ? r100Data.volatilityIndex.toFixed(1) : '--'}
            </span>
            <span className="meta-label">Volatilidade</span>
          </div>
          <div className="meta-item">
            <span className="meta-value">
              {r100Data.values.length > 0 ? r100Data.values[r100Data.values.length - 1].toFixed(1) : '--'}
            </span>
            <span className="meta-label">Valor Atual</span>
          </div>
        </div>
      </div>

      <div className="chart-container">
        <canvas ref={chartRef}></canvas>
      </div>

      <div className="technical-analysis-stats">
        <div className="stats-header">
          <h4>Estatísticas de Dígitos</h4>
          <span className="last-update">
            Última atualização: {r100Data.lastUpdated 
              ? new Date(r100Data.lastUpdated).toLocaleTimeString() 
              : '--'}
          </span>
        </div>
        
        <div className="stats-container">
          <div className="digit-stats-container">
            <DigitStats digitStats={r100Data.digitStats} />
          </div>
          <div className="digit-sequence-container">
            <h5>Últimos 10 Dígitos</h5>
            <DigitSequence digits={r100Data.lastDigits.slice(-10)} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default TechnicalAnalysis;