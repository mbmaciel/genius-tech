import { useEffect, useState } from 'react';
import { independentDerivService } from '@/services/independent-deriv-service';

interface SimpleDigitBarChartProps {
  symbol?: string;
  className?: string;
}

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

/**
 * Versão simplificada do gráfico de barras de dígitos
 * Implementação mais direta para garantir funcionamento visual correto
 */
export function SimpleDigitBarChart({ symbol = 'R_100', className = '' }: SimpleDigitBarChartProps) {
  const [stats, setStats] = useState<DigitStat[]>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [totalSamples, setTotalSamples] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Efeito para inicializar conexão e dados
  useEffect(() => {
    let mounted = true;
    let updateInterval: NodeJS.Timeout;
    
    // Inicializar e conectar ao serviço
    const initialize = async () => {
      try {
        // Conectar e buscar dados iniciais
        await independentDerivService.connect();
        const history = await independentDerivService.fetchTicksHistory(symbol, 500);
        
        if (mounted) {
          // Atualizar estados com dados iniciais
          setStats(history.stats || []);
          setLastDigits(history.lastDigits.slice(-10).reverse());
          setTotalSamples(history.totalSamples);
          
          // Assinar ticks em tempo real
          await independentDerivService.subscribeTicks(symbol);
          setLoading(false);
        }
      } catch (err) {
        console.error('Erro ao inicializar gráfico de dígitos:', err);
        if (mounted) setError('Falha ao conectar ao serviço Deriv');
      }
    };
    
    // Função para atualizar dados periodicamente
    const updateData = () => {
      if (!mounted) return;
      
      try {
        const currentData = independentDerivService.getDigitHistory(symbol);
        if (currentData && currentData.stats) {
          setStats([...currentData.stats]);
          setLastDigits([...currentData.lastDigits].slice(-10).reverse());
          setTotalSamples(currentData.totalSamples);
        }
      } catch (err) {
        console.error('Erro ao atualizar dados do gráfico:', err);
      }
    };
    
    // Inicializar e configurar intervalo de atualização
    initialize();
    updateInterval = setInterval(updateData, 150);
    
    // Cleanup
    return () => {
      mounted = false;
      clearInterval(updateInterval);
      independentDerivService.unsubscribeTicks(symbol).catch(console.error);
    };
  }, [symbol]);
  
  // Renderiza o gráfico
  return (
    <div className={`bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg ${className}`}>
      {/* Cabeçalho */}
      <div className="p-3 bg-[#0e1a2e] border-b border-[#232e47] flex justify-between items-center">
        <h3 className="font-medium text-white">
          <span className="text-[#3a96dd]">{symbol}:</span> Análise de Dígitos
          {loading && <span className="ml-2 text-xs text-gray-400">Carregando...</span>}
        </h3>
        <div className="bg-[#ff3e50] px-2 py-0.5 text-xs text-white font-medium rounded-sm">
          Últimos 10 Dígitos (%)
        </div>
      </div>
      
      {/* Mensagem de erro */}
      {error && (
        <div className="p-4 text-center text-red-500">{error}</div>
      )}
      
      {/* Gráfico principal */}
      <div className="p-4">
        {/* Gráfico de barras */}
        <div className="flex items-end h-52 mb-8 relative">
          {/* Eixo Y (percentuais) */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 pr-2">
            <div>50%</div>
            <div>40%</div>
            <div>30%</div>
            <div>20%</div>
            <div>10%</div>
            <div>0%</div>
          </div>
          
          {/* Linhas de grade */}
          <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-full border-t border-[#2a3756] h-0"></div>
            ))}
          </div>
          
          {/* Barras para dígitos */}
          <div className="flex justify-between items-end w-full pl-8">
            {stats.length > 0 ? (
              // Mapear as estatísticas para barras
              stats.map((stat) => {
                // Escala visual para percentuais típicos (~10-15%)
                const barHeight = Math.max(10, (stat.percentage / 5) * 100);
                const barColor = stat.digit % 2 === 0 ? '#00e5b3' : '#ff444f';
                
                return (
                  <div 
                    key={`digit-bar-${stat.digit}-${Date.now()}`} 
                    className="flex flex-col items-center w-full"
                  >
                    {/* Percentual acima da barra */}
                    <div className="text-xs font-bold text-white mb-1">
                      {stat.percentage}%
                    </div>
                    
                    {/* A barra em si */}
                    <div 
                      style={{
                        backgroundColor: barColor,
                        height: `${barHeight}%`,
                        width: '100%',
                        minHeight: '8px',
                        maxWidth: '30px',
                        borderRadius: '2px 2px 0 0'
                      }}
                    />
                    
                    {/* Dígito abaixo da barra */}
                    <div className="mt-2 text-sm font-medium text-white">
                      {stat.digit}
                    </div>
                  </div>
                );
              })
            ) : (
              // Barras de placeholder durante carregamento
              Array.from({ length: 10 }, (_, i) => (
                <div key={`placeholder-${i}`} className="flex flex-col items-center w-full">
                  <div className="text-xs text-white mb-1">0%</div>
                  <div 
                    style={{
                      backgroundColor: i % 2 === 0 ? '#00e5b3' : '#ff444f',
                      height: '10%',
                      width: '100%',
                      maxWidth: '30px',
                      borderRadius: '2px 2px 0 0'
                    }}
                  />
                  <div className="mt-2 text-sm text-white">{i}</div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Sequência de dígitos recentes */}
        <div className="mt-4 flex justify-center">
          <div className="bg-[#0c1625] border border-[#2a3756] rounded-md flex items-center px-2 py-1 space-x-2">
            {lastDigits.map((digit, index) => (
              <div 
                key={`recent-${index}-${digit}-${Date.now()}`}
                className={`w-6 h-6 flex items-center justify-center ${
                  digit % 2 === 0 ? 'text-[#00e5b3]' : 'text-[#ff444f]'
                } font-medium text-base`}
              >
                {digit}
              </div>
            ))}
            
            {/* Preencher espaços vazios se necessário */}
            {Array.from({ length: Math.max(0, 10 - lastDigits.length) }, (_, i) => (
              <div 
                key={`empty-${i}`}
                className="w-6 h-6 flex items-center justify-center text-transparent"
              >
                0
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Rodapé */}
      <div className="px-4 py-2 bg-[#0c1625] text-xs text-gray-400 border-t border-[#232e47]">
        <div className="flex justify-between items-center">
          <div>Baseado em {totalSamples} ticks</div>
          <div className="text-[#3a96dd] font-medium">{symbol}</div>
        </div>
      </div>
    </div>
  );
}