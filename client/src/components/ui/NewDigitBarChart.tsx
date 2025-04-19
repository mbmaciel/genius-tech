import { useState, useEffect, useRef } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useDerivTicks } from '@/hooks/use-deriv-ticks';
import { derivHistoryService } from '@/services/deriv-history-service';
import { oauthDirectService } from '@/services/oauthDirectService';

interface DigitBarChartProps {
  symbol?: string;
  className?: string;
}

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export function NewDigitBarChart({ symbol = "R_100", className = "" }: DigitBarChartProps) {
  // Estados para os dados
  const [digits, setDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<DigitStat[]>([]);
  const [selectedCount, setSelectedCount] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Controle de UI
  const [renderKey, setRenderKey] = useState(0);
  const [showLastDigit, setShowLastDigit] = useState(false);
  const lastDigitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Usar o novo hook para obter os ticks em tempo real
  const { lastDigit, lastQuote, isLoading } = useDerivTicks(symbol);
  
  // Função para calcular as estatísticas com base nos dígitos
  const calculateStats = (digitsList: number[]) => {
    // Inicializar contagem para cada dígito (0-9)
    const counts: { [key: number]: number } = {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0
    };
    
    // Contar ocorrências
    digitsList.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    });
    
    // Calcular percentuais
    const total = digitsList.length;
    const stats: DigitStat[] = [];
    
    for (let i = 0; i < 10; i++) {
      const count = counts[i] || 0;
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      
      stats.push({
        digit: i,
        count,
        percentage
      });
    }
    
    setDigitStats(stats);
  };

  // Função para buscar histórico de dígitos com mecanismo de fallback
  const fetchDigitHistory = async () => {
    try {
      setLoading(true);
      
      // Tente obter do sessionStorage primeiro para ter uma resposta imediata
      const storedDigits = sessionStorage.getItem(`digitHistory_${symbol}`);
      const storedStats = sessionStorage.getItem(`digitStats_${symbol}`);
      
      if (storedDigits && storedStats) {
        try {
          const parsedDigits = JSON.parse(storedDigits);
          const parsedStats = JSON.parse(storedStats);
          
          if (Array.isArray(parsedDigits) && parsedDigits.length > 0) {
            console.log(`[NewDigitBarChart] Usando ${parsedDigits.length} dígitos do sessionStorage`);
            setDigits(parsedDigits);
            calculateStats(parsedDigits.slice(0, parseInt(selectedCount)));
            setError(null);
            setLoading(false);
            
            // Continue buscando em segundo plano para atualizar os dados
            setTimeout(() => fetchFromServices(), 500);
            return;
          }
        } catch (e) {
          console.error('[NewDigitBarChart] Erro ao ler do sessionStorage:', e);
        }
      }
      
      // Se não tiver dados no sessionStorage, busque normalmente
      await fetchFromServices();
      
    } catch (err) {
      console.error(`[NewDigitBarChart] Erro ao buscar histórico: ${err}`);
      setError("Erro ao obter dados históricos");
      setLoading(false);
    }
  };
  
  // Função para buscar dados dos serviços e atualizar o sessionStorage
  const fetchFromServices = async () => {
    try {
      // Tentar obter do derivHistoryService primeiro
      const historyData = derivHistoryService.getDigitStats(symbol);
      
      if (historyData && historyData.lastDigits && historyData.lastDigits.length > 0) {
        console.log(`[NewDigitBarChart] Atualizado com ${historyData.lastDigits.length} dígitos do derivHistoryService`);
        setDigits(historyData.lastDigits);
        calculateStats(historyData.lastDigits.slice(0, parseInt(selectedCount)));
        
        // Salvar no sessionStorage para acesso rápido
        sessionStorage.setItem(`digitHistory_${symbol}`, JSON.stringify(historyData.lastDigits));
        sessionStorage.setItem(`digitStats_${symbol}`, JSON.stringify(historyData.digitStats));
        
        setError(null);
      } else {
        // Se não conseguir do derivHistoryService, tente obter diretamente do oauthDirectService
        console.log(`[NewDigitBarChart] Solicitando ticks direto do oauthDirectService para ${symbol}`);
        
        // Solicitar ticks novamente para garantir atualização
        if (oauthDirectService) {
          oauthDirectService.subscribeToTicks(symbol);
        }
        
        setError("Obtendo novos dados de mercado...");
      }
    } catch (err) {
      console.error(`[NewDigitBarChart] Erro ao buscar dos serviços: ${err}`);
      setError("Erro ao obter dados. Tentando reconectar...");
      
      // Tentar novamente em caso de erro
      if (oauthDirectService) {
        oauthDirectService.reconnect()
          .then(() => oauthDirectService.subscribeToTicks(symbol))
          .catch(e => console.error('[NewDigitBarChart] Erro na reconexão:', e));
      }
    } finally {
      setLoading(false);
    }
  };

  // Efeito para carregar os dados iniciais e lidar com ticks diretos do oauthDirectService
  useEffect(() => {
    console.log(`[NewDigitBarChart] Inicializando componente para ${symbol}`);
    
    // Carregar histórico inicial
    fetchDigitHistory();
    
    // Configurar atualização periódica do histórico
    const updateInterval = setInterval(() => {
      fetchDigitHistory();
    }, 2000);
    
    // Forçar atualização da UI
    const renderInterval = setInterval(() => {
      setRenderKey(prev => prev + 1);
    }, 500); // Mais rápido para melhor capturar os novos dígitos
    
    // Listener direto para eventos do oauthDirectService
    const handleDirectTick = (event: any) => {
      try {
        // Verificar se o evento é de tick
        if (event && event.type === 'tick') {
          // Extrair os dados do tick de qualquer formato possível
          let tickData = null;
          
          if (event.data) {
            tickData = event.data.tick || event.data;
          } else if (event.tick) {
            tickData = event.tick;
          } else if (typeof event === 'object') {
            tickData = event;
          }
          
          if (tickData) {
            // Verificar se é para o símbolo que estamos interessados
            const tickSymbol = tickData.symbol || tickData.name || symbol;
            
            if (tickSymbol === symbol) {
              console.log(`[NewDigitBarChart] Evento de tick direto recebido para ${symbol}`);
              
              // Extrair a cotação do formato adequado
              let quote = 0;
              if (typeof tickData.quote !== 'undefined') {
                quote = Number(tickData.quote);
              } else if (typeof tickData.value !== 'undefined') {
                quote = Number(tickData.value);
              } else if (typeof tickData.price !== 'undefined') {
                quote = Number(tickData.price);
              }
              
              if (quote > 0) {
                const quoteStr = quote.toString();
                const digit = parseInt(quoteStr.charAt(quoteStr.length - 1));
                
                if (!isNaN(digit)) {
                  console.log(`[NewDigitBarChart] Novo dígito extraído: ${digit} (de ${quote})`);
                  
                  // Persistir no sessionStorage
                  sessionStorage.setItem(`lastDigit_${symbol}`, digit.toString());
                  sessionStorage.setItem(`lastQuote_${symbol}`, quote.toString());
                  
                  // Atualizar estado local
                  setShowLastDigit(true);
                  
                  // Limpar timeout anterior
                  if (lastDigitTimeoutRef.current) {
                    clearTimeout(lastDigitTimeoutRef.current);
                  }
                  
                  // Configurar novo timeout
                  lastDigitTimeoutRef.current = setTimeout(() => {
                    setShowLastDigit(false);
                  }, 3000);
                  
                  // Atualizar o histórico
                  const currentDigits = [...digits];
                  currentDigits.unshift(digit); // Adicionar no início do array
                  
                  // Manter apenas os últimos 500 dígitos
                  if (currentDigits.length > 500) {
                    currentDigits.length = 500;
                  }
                  
                  // Atualizar estado e sessionStorage
                  setDigits(currentDigits);
                  sessionStorage.setItem(`digitHistory_${symbol}`, JSON.stringify(currentDigits));
                  
                  // Recalcular estatísticas
                  calculateStats(currentDigits.slice(0, parseInt(selectedCount)));
                  
                  // Emitir evento para outros componentes
                  const tickEvent = new CustomEvent('tick-update', { 
                    detail: { 
                      digit, 
                      quote, 
                      symbol 
                    } 
                  });
                  document.dispatchEvent(tickEvent);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("[NewDigitBarChart] Erro ao processar tick direto:", err);
      }
    };
    
    // Registrar listener diretamente no oauthDirectService
    if (oauthDirectService) {
      oauthDirectService.addEventListener(handleDirectTick);
      console.log(`[NewDigitBarChart] Registrado como listener direto do oauthDirectService para ${symbol}`);
      
      // Garantir que estamos inscritos nos ticks do símbolo solicitado
      oauthDirectService.subscribeToTicks(symbol);
    }
    
    return () => {
      clearInterval(updateInterval);
      clearInterval(renderInterval);
      
      // Limpar timeout caso exista
      if (lastDigitTimeoutRef.current) {
        clearTimeout(lastDigitTimeoutRef.current);
      }
      
      // Remover listener do oauthDirectService
      if (oauthDirectService) {
        oauthDirectService.removeEventListener(handleDirectTick);
        console.log(`[NewDigitBarChart] Removido listener direto do oauthDirectService para ${symbol}`);
      }
    };
  }, [symbol, selectedCount]);
  
  // Efeito para processar novos dígitos
  useEffect(() => {
    if (lastDigit !== null) {
      console.log(`[NewDigitBarChart] Novo dígito recebido: ${lastDigit}`);
      
      // Mostrar o dígito no indicador
      setShowLastDigit(true);
      
      // Limpar timeout anterior
      if (lastDigitTimeoutRef.current) {
        clearTimeout(lastDigitTimeoutRef.current);
      }
      
      // Configurar novo timeout
      lastDigitTimeoutRef.current = setTimeout(() => {
        setShowLastDigit(false);
      }, 3000);
      
      // Criar um evento personalizado para sinalizar novo dígito
      const tickEvent = new CustomEvent('tick-update', { 
        detail: { 
          digit: lastDigit, 
          quote: lastQuote, 
          symbol 
        } 
      });
      document.dispatchEvent(tickEvent);
      
      // Atualizar o histórico
      fetchDigitHistory();
    }
  }, [lastDigit, lastQuote, symbol]);

  return (
    <div className={`w-full ${className}`} key={`chart-container-${renderKey}`}>
      <div className="bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg">
        <div className="p-3 bg-[#0e1a2e] border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 mr-1.5 rounded-sm"></div>
            <h3 className="font-medium text-white flex items-center">
              Gráfico de Dígitos do {symbol}
              {(loading || isLoading) && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin text-primary" />
              )}
            </h3>
          </div>
          
          <div className="flex items-center">
            <Select value={selectedCount} onValueChange={setSelectedCount}>
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
        </div>
        
        {error ? (
          <div className="text-red-500 text-sm p-4">{error}</div>
        ) : (
          <div className="p-4">
            {/* Área do gráfico */}
            <div className="relative h-[250px] flex items-end justify-between px-2">
              {/* Linhas de grade horizontais */}
              <div className="absolute w-full h-full flex flex-col justify-between">
                {[0, 10, 20, 30, 40, 50].map(value => (
                  <div 
                    key={`grid-line-${value}-${renderKey}`}
                    className="w-full border-t border-gray-800 relative"
                    style={{ bottom: `${(value / 50) * 100}%` }}
                  >
                    <span className="absolute -top-3 -left-8 text-gray-500 text-xs">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Barras para cada dígito */}
              {digitStats.map(stat => {
                // Determinar a cor baseada na frequência
                let barColor = stat.percentage >= 20 
                  ? "#ff3232" // Vermelho para 20% ou mais
                  : (stat.digit % 2 === 0 ? "#2a405a" : "#896746"); // Azul escuro para pares, marrom para ímpares
                
                // Destacar o último dígito recebido
                if (lastDigit !== null && stat.digit === lastDigit) {
                  barColor = "#00c48c"; // Verde para o último dígito
                }
                
                return (
                  <div 
                    key={`bar-${stat.digit}-${stat.percentage}-${renderKey}`} 
                    className="flex flex-col items-center w-9 z-10"
                  >
                    {/* Barra com altura proporcional à porcentagem */}
                    <div 
                      className="w-full transition-all duration-300 ease-in-out flex justify-center relative"
                      style={{ 
                        height: `${Math.max(1, (stat.percentage / 50) * 100)}%`,
                        backgroundColor: barColor
                      }}
                    >
                      {/* Mostrar percentual acima da barra */}
                      {stat.percentage > 0 && (
                        <div className="absolute -top-6 w-full text-center">
                          <span className="text-white text-xs font-bold">
                            {stat.percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Dígito abaixo da barra */}
                    <div className="mt-2 w-full text-center text-white font-semibold">
                      {stat.digit}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Sequência de dígitos mais recentes */}
            <div className="mt-6 border-t border-gray-800 pt-4">
              <div className="flex justify-center">
                <div className="grid grid-cols-10 gap-1 text-white text-sm font-mono">
                  {digits.slice(0, 10).map((digit, index) => (
                    <div 
                      key={`recent-digit-${index}-${renderKey}`} 
                      className={`w-7 h-7 flex items-center justify-center border rounded
                        ${index === 0 
                          ? 'bg-primary text-white border-primary font-bold' 
                          : 'border-gray-700 text-white'}`}
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Mostrar último dígito recebido de forma destacada */}
            {showLastDigit && lastDigit !== null && (
              <div className="mt-4 flex justify-center items-center">
                <div className="relative">
                  <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center animate-pulse">
                    <span className="text-2xl font-bold text-white">{lastDigit}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 bg-black text-white text-xs px-2 py-1 rounded-full">
                    Novo!
                  </div>
                </div>
              </div>
            )}
            
            {/* Contador de dígitos */}
            <div className="mt-4 text-xs text-gray-400 text-center">
              Analisando {selectedCount} de {Math.min(digits.length, 500)} dígitos disponíveis
            </div>
            
            {/* Exibir a última cotação */}
            {lastQuote && (
              <div className="mt-1 text-xs text-gray-300 text-center">
                Último valor: {lastQuote}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}