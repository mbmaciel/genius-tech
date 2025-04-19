import React, { useEffect, useState, useRef } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, RefreshCw } from 'lucide-react';
import { independentDerivService, DigitHistory } from '../services/independent-deriv-service';

interface IndependentDigitBarChartProps {
  symbol?: string;
  className?: string;
  showControls?: boolean;
}

/**
 * Componente de gráfico de barras de dígitos com conexão WebSocket independente
 * Este componente não interfere com a conexão principal do bot
 */
export function IndependentDigitBarChart({
  symbol = 'R_100',
  className = '',
  showControls = true
}: IndependentDigitBarChartProps) {
  // Estados do componente
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [digitHistory, setDigitHistory] = useState<DigitHistory | null>(null);
  const [selectedCount, setSelectedCount] = useState<string>("100");
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  
  // Iniciar conexão e inscrição para ticks
  useEffect(() => {
    setLoading(true);
    console.log('[IndependentDigitBarChart] Inicializando componente para', symbol);
    
    const handleHistoryUpdate = (data: DigitHistory) => {
      // Verificar se os dados são para o mesmo símbolo
      if (data.symbol === symbol) {
        console.log('[IndependentDigitBarChart] Recebido atualização do histórico com', 
                    data.lastDigits.length, 'dígitos e', 
                    data.stats?.length || 0, 'estatísticas');
        
        // Log detalhado dos percentuais para debug        
        console.log('[IndependentDigitBarChart] DADOS ATUALIZADOS:', 
          data.stats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
                    
        // IMPORTANTE: Forçar incremento do renderVersion para garantir re-renderização
        setRenderVersion(prev => prev + 1);
        
        // Criar novos objetos para forçar re-render
        const newStats = data.stats.map(stat => ({
          digit: stat.digit,
          count: stat.count,
          percentage: stat.percentage
        }));
        
        // Converter em novo objeto para forçar re-render (usando cópia profunda)
        setDigitHistory({
          symbol: data.symbol,
          stats: newStats,
          lastDigits: [...data.lastDigits],
          totalSamples: data.totalSamples,
          lastUpdated: new Date()
        });
        
        // Atualizar últimos dígitos (mostrar apenas os 10 mais recentes)
        const digits = [...data.lastDigits];
        // Pegamos apenas os 10 últimos dígitos conforme solicitado
        setLastDigits(digits.slice(-10).reverse());
        
        setLoading(false);
      }
    };
    
    const handleConnectionEvent = (data: any) => {
      if (!data.connected) {
        setError('Conexão WebSocket perdida. Reconectando...');
      } else {
        setError(null);
      }
    };
    
    const handleErrorEvent = (data: any) => {
      setError(`Erro: ${data.message || 'Falha na comunicação com a Deriv'}`);
      setLoading(false);
    };
    
    // Registrar ouvintes de eventos
    independentDerivService.addListener('history', handleHistoryUpdate);
    independentDerivService.addListener('connection', handleConnectionEvent);
    independentDerivService.addListener('error', handleErrorEvent);
    
    // Iniciar busca de dados
    const fetchData = async () => {
      try {
        // Verificar se já temos dados em cache
        const cachedHistory = independentDerivService.getDigitHistory(symbol);
        if (cachedHistory && cachedHistory.totalSamples > 0) {
          handleHistoryUpdate(cachedHistory);
        }
        
        // Solicitar histórico e assinar ticks (mesmo que tenhamos cache)
        try {
          await independentDerivService.fetchTicksHistory(symbol, 500);
        } catch (historyError) {
          console.warn('[IndependentDigitBarChart] Erro ao buscar histórico, tentando apenas subscrição:', historyError);
          setError('Usando dados recentes. Atualizando...');
        }
        
        try {
          await independentDerivService.subscribeTicks(symbol);
        } catch (subscribeError) {
          console.error('[IndependentDigitBarChart] Erro ao subscrever ticks:', subscribeError);
          setError('Falha na conexão em tempo real. Tentando reconectar...');
          
          // Tentar novamente após 3 segundos
          setTimeout(() => {
            independentDerivService.subscribeTicks(symbol)
              .catch(e => console.error('[IndependentDigitBarChart] Erro na reconexão:', e));
          }, 3000);
        }
      } catch (err) {
        console.error('[IndependentDigitBarChart] Erro ao buscar dados:', err);
        setError('Falha ao buscar histórico de dígitos');
        setLoading(false);
      }
    };
    
    fetchData();
    
    // Limpar ao desmontar
    return () => {
      independentDerivService.removeListener('history', handleHistoryUpdate);
      independentDerivService.removeListener('connection', handleConnectionEvent);
      independentDerivService.removeListener('error', handleErrorEvent);
    };
  }, [symbol]);
  
  // Atualizar exibição quando o número de ticks mudar
  useEffect(() => {
    if (digitHistory && digitHistory.lastDigits.length > 0) {
      // Independente do selectedCount, sempre mostrar apenas 10 dígitos na sequência
      const digits = [...digitHistory.lastDigits];
      setLastDigits(digits.slice(-10).reverse());
    }
  }, [selectedCount, digitHistory]);
  
  // Contador de versão para forçar re-renderização completa
  const [renderVersion, setRenderVersion] = useState<number>(0);
  
  // Atualizar dados periodicamente
  useEffect(() => {
    // Intervalo rápido para melhor sensação de tempo real
    const REFRESH_INTERVAL = 200; // ms - mais rápido para melhor responsividade
    let interval: NodeJS.Timeout;
    
    // Referência para verificar se componente ainda está montado
    const isMounted = { current: true };
    
    // Função que força atualização completa dos dados e re-renderização
    const forceRender = () => {
      try {
        if (!symbol || !isMounted.current) return;
        
        // Obter os dados mais recentes do serviço WebSocket
        const currentData = independentDerivService.getDigitHistory(symbol);
        
        if (currentData && currentData.stats && currentData.stats.length > 0) {
          // Incrementar contador de versão para forçar re-renderização completa
          // A cada 100 atualizações, resetamos para 1 para evitar números muito grandes
          const nextVersion = renderVersion >= 10000 ? 1 : Math.max(renderVersion, 0) + 1;
          
          // Forçar criação de novos objetos com estrutura idêntica
          // Isso garante que o React detecte as mudanças e atualize a UI
          const freshStats = currentData.stats.map(stat => ({
            digit: stat.digit,
            count: stat.count,
            percentage: stat.percentage
          }));
          
          // Sempre atualizar se temos estatísticas (para garantir que o gráfico esteja atualizado)
          // Criar um objeto completamente novo sem referências ao anterior
          const newHistory = {
            symbol: currentData.symbol,
            stats: freshStats,
            lastDigits: [...currentData.lastDigits],
            totalSamples: currentData.totalSamples,
            lastUpdated: new Date()
          };
          
          // Define os novos estados (cada um separadamente para garantir a atualização)
          setDigitHistory(newHistory);
          setLastDigits([...currentData.lastDigits].slice(-10).reverse());
          
          // Forçar a re-renderização completa
          setRenderVersion(nextVersion);
          
          // Log mais visível para debug (a cada 10 atualizações para não poluir o console)
          if (nextVersion % 10 === 0) {
            console.log(`[DigitBarChart] ▶▶▶ Atualização v${nextVersion}:`, 
              freshStats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
          }
          
          // Atualizar o estado de carregamento se necessário
          if (loading) {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('[DigitBarChart] Erro ao atualizar:', err);
      }
    };
    
    // Executar imediatamente a primeira vez
    forceRender();
    
    // Configurar intervalo de atualização
    interval = setInterval(forceRender, REFRESH_INTERVAL);
    
    // Limpar intervalo ao desmontar
    return () => {
      isMounted.current = false;
      if (interval) clearInterval(interval);
    };
  }, [symbol, selectedCount]); // Adicionado selectedCount para reagir a mudanças neste valor
  
  // Determinar a cor da barra com base no dígito (para seguir exatamente o modelo da imagem)
  const getBarColor = (digit: number): string => {
    // Dígitos pares em verde, ímpares em vermelho
    return digit % 2 === 0 
      ? 'bg-[#00e5b3]'  // Dígitos pares em verde (usando o tom exato da imagem)
      : 'bg-[#ff444f]';   // Dígitos ímpares em vermelho (usando o tom exato da imagem)
  };
  
  // Função para criar a versão de renderização única do componente (para forçar re-render)
  const renderKey = `${symbol}-v${renderVersion}-${digitHistory?.lastUpdated?.getTime() || 0}`;
  
  // Para debug
  React.useEffect(() => {
    console.log(`[IndependentDigitBarChart] Renderizando com chave: ${renderKey}`);
  }, [renderKey]);
  
  return (
    <div 
      key={renderKey}
      className={`bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg ${className}`}
    >
      {/* Header com título e controles */}
      <div className="p-3 bg-[#0e1a2e] border-b border-[#232e47] flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="font-medium text-white flex items-center">
            <span className="text-[#3a96dd]">{symbol}:</span>&nbsp;Análise de Dígitos
            {loading && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />
            )}
          </h3>
        </div>
        
        {/* Box com indicação de "Últimos 10 Dígitos" (como na imagem) */}
        <div className="bg-[#ff3e50] px-2 py-0.5 text-xs text-white font-medium rounded-sm shadow-sm">
          Últimos 10 Dígitos (%)
        </div>
        
        {/* Controles de seleção (opcional) */}
        {showControls && (
          <div className="flex items-center ml-2">
            <Select 
              value={selectedCount} 
              onValueChange={(value) => {
                console.log(`[IndependentDigitBarChart] Alterando seleção para: ${value}`);
                setSelectedCount(value);
                // Forçar atualização completa ao alterar o número de ticks
                setRenderVersion(prev => prev + 1);
              }}
            >
              <SelectTrigger className="h-8 w-[90px] bg-[#0c1625] border border-gray-700 text-xs">
                <SelectValue placeholder="100" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 Ticks</SelectItem>
                <SelectItem value="50">50 Ticks</SelectItem>
                <SelectItem value="100">100 Ticks</SelectItem>
                <SelectItem value="200">200 Ticks</SelectItem>
                <SelectItem value="250">250 Ticks</SelectItem>
                <SelectItem value="500">500 Ticks</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      {/* Mensagem de erro se necessário */}
      {error && (
        <div className="p-4 text-center">
          <p className="text-red-500">{error}</p>
        </div>
      )}
      
      {/* Gráfico de barras */}
      <div className="p-6">
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
          
          {/* Linhas de grade horizontais */}
          <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-full border-t border-[#2a3756] h-0"></div>
            ))}
          </div>
          
          {/* Barras para cada dígito */}
          <div className="flex justify-between items-end w-full pl-8">
            {/* Força a recriação completa de todas as barras */}
            {renderVersion && digitHistory?.stats ? 
              // Mapear cada estatística para uma barra - key baseada no renderVersion para recriação completa
              digitHistory.stats.map((stat) => {
                // Determinar se o dígito tem uma frequência alta ou baixa para destacar visualmente
                const isHighFrequency = stat.percentage >= 15;
                const isLowFrequency = stat.percentage <= 5;
                
                // Calcular a altura visual baseada no percentual (com um mínimo visual)
                // Usamos um divisor menor para barras maiores, mais visíveis
                const barHeight = Math.max(5, (stat.percentage / 6) * 100); 
                
                // Determinar a cor da barra baseada em características do dígito
                let barColor;
                if (isHighFrequency) {
                  barColor = '#ff444f'; // Vermelho para alta frequência
                } else if (isLowFrequency) {
                  barColor = '#00e5b3'; // Verde para baixa frequência
                } else {
                  barColor = stat.digit % 2 === 0 ? '#3a96dd' : '#f87537'; // Azul para pares, laranja para ímpares
                }
                
                // Texto destacado para valores extremos
                const percentText = isHighFrequency ? 'text-[#ff444f] font-bold' : 
                                   isLowFrequency ? 'text-[#00e5b3] font-bold' : 'text-white';
                
                return (
                  <div 
                    // Força recriação do componente a cada versão
                    key={`bar-${stat.digit}-v${renderVersion}-${stat.percentage}`} 
                    className="flex flex-col items-center w-full max-w-[45px] min-w-[20px]"
                  >
                    {/* Percentual acima da barra */}
                    <div className={`text-xs font-bold ${percentText} mb-1`}>
                      {stat.percentage}%
                    </div>
                    
                    {/* Barra com altura dinâmica e efeitos visuais */}
                    <div style={{
                      height: `${barHeight}%`,
                      backgroundColor: barColor,
                      width: '100%',
                      minHeight: '15px',
                      transition: 'height 0.1s ease-out', // Transição suave mas rápida
                      borderRadius: '2px 2px 0 0',
                      boxShadow: isHighFrequency || isLowFrequency ? '0 0 5px 0 rgba(255,255,255,0.2)' : 'none'
                    }}></div>
                    
                    {/* Dígito abaixo da barra */}
                    <div className={`mt-2 text-center text-sm font-medium ${
                      isHighFrequency ? 'text-[#ff444f]' : 
                      isLowFrequency ? 'text-[#00e5b3]' : 'text-white'
                    }`}>
                      {stat.digit}
                    </div>
                  </div>
                );
              })
            : 
              // Barras de placeholder durante o carregamento
              Array.from({ length: 10 }, (_, i) => (
                <div key={`placeholder-${i}-${renderVersion || 0}`} className="flex flex-col items-center w-full max-w-[45px] min-w-[20px]">
                  <div className="text-xs font-medium text-white mb-1">0%</div>
                  <div 
                    style={{ 
                      height: '15%',
                      backgroundColor: i % 2 === 0 ? '#00e5b3' : '#ff444f',
                      width: '100%',
                      minHeight: '15px',
                      borderRadius: '2px 2px 0 0'
                    }}
                  ></div>
                  <div className="mt-2 text-center text-sm text-white">{i}</div>
                </div>
              ))
            }
          </div>
        </div>
        
        {/* Sequência dos últimos dígitos no formato da imagem de referência */}
        <div className="mt-6">
          <div className="flex justify-center">
            {/* Container para a sequência de dígitos no estilo da imagem */}
            <div className="bg-[#0c1625] border border-[#2a3756] rounded-md flex items-center px-2 py-1 space-x-2">
              {lastDigits.map((digit, index) => {
                // Determinar a cor baseada no dígito, igual às barras
                const textColor = digit % 2 === 0 
                  ? 'text-[#00e5b3]' // Verde para pares
                  : 'text-[#ff444f]'; // Vermelho para ímpares
                
                return (
                  <div 
                    key={`digit-${index}-${digit}-v${renderVersion}`} 
                    className={`w-6 h-6 flex items-center justify-center ${textColor} font-medium text-base`}
                  >
                    {digit}
                  </div>
                );
              })}
              
              {/* Preencher com espaços vazios se não tivermos 10 dígitos ainda */}
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
      </div>
      
      {/* Rodapé com informações */}
      <div className="px-4 py-2 bg-[#0c1625] text-xs text-gray-400 border-t border-[#232e47]">
        <div className="flex justify-between items-center">
          <div>Análise baseada em {digitHistory?.totalSamples || 0} ticks</div>
          <div className="text-[#3a96dd] font-medium">{symbol}</div>
        </div>
      </div>
    </div>
  );
}