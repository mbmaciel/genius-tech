import React, { useEffect, useState, useRef } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Loader2, RefreshCw, ChevronDown } from 'lucide-react';
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
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  
  // SOLUÇÃO PARA O BUG: 
  // Isso força uma nova instância do componente cada vez que o número de ticks muda
  // Resolvendo completamente o problema de renderização
  const [key, setKey] = useState<string>(`${symbol}-${selectedCount}-${Date.now()}`);
  
  // Quando o selectedCount muda, geramos uma nova chave única
  useEffect(() => {
    setKey(`${symbol}-${selectedCount}-${Date.now()}`);
  }, [symbol, selectedCount]);
  
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
        
        // Aplicar filtro com base no selectedCount
        const tickCount = parseInt(selectedCount, 10);
        // Obter os dados filtrados de acordo com a quantidade de ticks selecionada
        const filteredData = independentDerivService.getDigitHistory(symbol, tickCount);
        
        // Log detalhado dos percentuais para debug        
        console.log('[IndependentDigitBarChart] DADOS ATUALIZADOS:', 
          filteredData.stats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
                    
        // IMPORTANTE: Forçar incremento do renderVersion para garantir re-renderização
        setRenderVersion(prev => prev + 1);
        
        // Criar novos objetos para forçar re-render
        const newStats = filteredData.stats.map(stat => ({
          digit: stat.digit,
          count: stat.count,
          percentage: stat.percentage
        }));
        
        // Converter em novo objeto para forçar re-render (usando cópia profunda)
        setDigitHistory({
          symbol: filteredData.symbol,
          stats: newStats,
          lastDigits: [...filteredData.lastDigits],
          totalSamples: filteredData.totalSamples,
          lastUpdated: new Date()
        });
        
        // Atualizar últimos dígitos (mostrar apenas os 10 mais recentes)
        const digits = [...filteredData.lastDigits];
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
  
  // SOLUÇÃO SIMPLIFICADA PARA O PROBLEMA DE RENDERIZAÇÃO:
  // Quando o selectedCount muda, limpamos o estado e removemos todos os listeners
  useEffect(() => {
    console.log('[IndependentDigitBarChart] Nova contagem selecionada:', selectedCount);
    
    // 1. Limpar completamente os dados
    setDigitHistory(null);
    setLastDigits([]);
    
    // 2. Mostrar estado de carregamento
    setLoading(true);
    
    // 3. Remover todos os listeners de histórico
    const listeners = (independentDerivService as any).eventListeners?.get('history');
    if (listeners) {
      listeners.clear();
      console.log('[IndependentDigitBarChart] Listeners de histórico limpos');
    }
    
    // 4. Resetar versão de renderização para forçar atualização completa
    setRenderVersion(v => v + 100);
    
    console.log(`[IndependentDigitBarChart] Setup completo para ${selectedCount} ticks`);
  }, [selectedCount]);
  
  // Sistema único de atualização com estabilidade para todos os modos
  useEffect(() => {
    console.log(`[IndependentDigitBarChart] Configurando sistema de atualização para ${selectedCount} ticks`);
    
    // Referência para verificar se componente ainda está montado
    const isMounted = { current: true };
    
    // Diferentes intervalos baseados no número de ticks selecionados
    let UPDATE_INTERVAL = 200; // padrão - mais rápido para 100 ticks
    
    // Ajustar intervalo com base no número de ticks
    if (parseInt(selectedCount, 10) <= 50) {
      UPDATE_INTERVAL = 600; // mais lento para poucos ticks (25-50)
    } else if (parseInt(selectedCount, 10) >= 200) {
      UPDATE_INTERVAL = 400; // médio para muitos ticks (200+)
    }
    
    console.log(`[IndependentDigitBarChart] Configurado intervalo de ${UPDATE_INTERVAL}ms para ${selectedCount} ticks`);
    
    // Último timestamp de atualização para evitar atualizações muito próximas
    let lastUpdateTimestamp = 0;
    
    // Cache de dados para evitar atualizações desnecessárias
    let dataCache: DigitHistory | null = null;
    
    // Função de atualização unificada
    const updateChart = () => {
      try {
        if (!symbol || !isMounted.current) return;
        
        // Verificar tempo entre atualizações
        const now = Date.now();
        if (now - lastUpdateTimestamp < UPDATE_INTERVAL/2) {
          return; // Skip se muito recente
        }
        
        // Obter a quantidade de ticks selecionada (manter como número)
        const tickCount = parseInt(selectedCount, 10);
        
        // Obter dados atualizados
        const currentData = independentDerivService.getDigitHistory(symbol, tickCount);
        
        // Verificar se os dados são válidos e completos
        if (!currentData || !currentData.stats || currentData.stats.length !== 10) {
          console.warn('[IndependentDigitBarChart] Dados incompletos recebidos');
          return;
        }
        
        // Verificar se houve alteração nos dados (para evitar renderizações desnecessárias)
        if (dataCache && 
            JSON.stringify(dataCache.stats.map(s => s.percentage)) === 
            JSON.stringify(currentData.stats.map(s => s.percentage)) &&
            dataCache.lastDigits.length === currentData.lastDigits.length) {
          return; // Pular se os dados são idênticos
        }
        
        // Atualizar cache
        dataCache = currentData;
        lastUpdateTimestamp = now;
        
        // Criar uma cópia completa dos dados para garantir que React detecte as mudanças
        const newDigitHistory = {
          symbol: currentData.symbol,
          stats: currentData.stats.map(stat => ({
            digit: stat.digit,
            count: stat.count,
            percentage: stat.percentage
          })),
          lastDigits: [...currentData.lastDigits],
          totalSamples: currentData.totalSamples,
          lastUpdated: new Date()
        };
        
        // Atualizar estados de forma atômica
        if (isMounted.current) {
          console.log(`[IndependentDigitBarChart] Atualizando gráfico com distribuição: ${
            newDigitHistory.stats.map(s => `${s.digit}:${s.percentage}%`).join(', ')
          }`);
          
          // Atualizar estados de forma controlada
          setDigitHistory(newDigitHistory);
          setLastDigits([...currentData.lastDigits].slice(-10).reverse());
          setRenderVersion(prev => (prev >= 1000 ? 1 : prev + 1));
          
          // Desativar loading se estiver ativo
          if (loading) setLoading(false);
        }
      } catch (err) {
        console.error('[IndependentDigitBarChart] Erro na atualização:', err);
      }
    };
    
    // Executar primeira atualização imediatamente
    updateChart();
    
    // Configurar intervalo de atualização
    const interval = setInterval(updateChart, UPDATE_INTERVAL);
    
    // Cleanup
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [symbol, selectedCount]); // Dependências: símbolo e número de ticks
  
  // Versão de renderização para garantir refresh completo
  const [renderVersion, setRenderVersion] = useState<number>(0);
  
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
  
  // Efeito para fechar o menu quando clicar fora dele
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Procurar se o clique foi dentro do menu ou do botão de dropdown
      if (isMenuOpen && !target.closest('.custom-dropdown')) {
        setIsMenuOpen(false);
      }
    };
    
    // Adicionar listener quando o menu estiver aberto
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    // Remover listener ao desmontar ou fechar o menu
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);
  
  // SOLUÇÃO FINAL: 
  // Use a chave única para o componente inteiro para forçar recriação completa quando mudar o selectedCount
  
  return (
    <div 
      key={key}
      className={`bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg ${className}`}
    >
      {/* Header com título e controles */}
      <div className="p-3 bg-[#0e1a2e] border-b border-[#232e47] flex justify-between items-center">
        <div className="flex items-center">
          <h3 className="font-medium text-white flex items-center">
            <span className="text-[#3a96dd]">{symbol}:</span>&nbsp;Análise de <span className="text-amber-500">{selectedCount}</span> Dígitos
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
          <div className="flex items-center ml-2 relative">
            <div className="custom-dropdown">
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Impedir que o evento se propague para outros elementos
                  setIsMenuOpen(!isMenuOpen);
                  console.log("[MENU] Menu clicado, novo estado:", !isMenuOpen);
                }}
                className="h-8 w-[100px] bg-blue-900/30 border border-blue-500 text-xs text-white hover:bg-blue-800/40 hover:border-blue-400 rounded px-2 flex items-center justify-between"
                data-test-id="tick-select-trigger"
                style={{ cursor: 'pointer' }} // Garantir que o cursor seja de ponteiro
              >
                <span>{selectedCount} Ticks</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {isMenuOpen && (
                <div 
                  className="absolute right-0 top-full mt-1 bg-[#0e1a2e] border border-blue-500 rounded z-50 w-[100px] overflow-hidden shadow-lg"
                  style={{ maxHeight: '200px' }}
                >
                  {["25", "50", "100", "200", "300", "500"].map((value) => (
                    <button
                      key={value}
                      className={`w-full text-left px-3 py-1.5 text-xs ${
                        selectedCount === value 
                          ? 'bg-blue-900 text-white font-medium' 
                          : 'text-white hover:bg-blue-900/50'
                      }`}
                      onClick={() => {
                        try {
                          console.log(`[IndependentDigitBarChart] Alterando seleção para: ${value}`);
                          setSelectedCount(value);
                          setIsMenuOpen(false);
                          
                          // Não precisamos buscar dados aqui, pois o useEffect específico
                          // já vai limpar os dados e o sistema de atualização automática
                          // irá buscar os novos dados com a quantidade correta de ticks
                        } catch (error) {
                          console.error('[IndependentDigitBarChart] Erro ao processar seleção:', error);
                        }
                      }}
                    >
                      {value} Ticks
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          
          {/* Linhas de grade horizontais - uma para cada valor do eixo */}
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
                
                // Calcular altura visual para escala de 0-50% (como na escala do eixo Y)
                // Dobrar a porcentagem para que 10% = 20% da altura visual e assim por diante
                const barHeight = Math.max(3, stat.percentage * 2);
                
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
                      transition: `height ${
                        parseInt(selectedCount, 10) <= 50 
                          ? '0.5s cubic-bezier(0.4, 0, 0.2, 1)' // Transição mais lenta e suave para 25/50 ticks
                          : parseInt(selectedCount, 10) >= 200
                            ? '0.3s ease-out' // Média suavidade para 200+ ticks
                            : '0.15s ease-in-out' // Rápida mas suave para 100 ticks
                      }`,
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
          <div>
            Mostrando <span className="text-amber-400 font-medium">{selectedCount}</span> 
            <span> de </span>
            <span className="text-blue-400">{digitHistory?.lastDigits.length || 0}</span> ticks disponíveis
          </div>
          <div className="text-[#3a96dd] font-medium">{symbol}</div>
        </div>
      </div>
    </div>
  );
}