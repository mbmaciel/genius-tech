import React, { useState, useEffect, useRef } from 'react';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

// Serviço de conexão OAuth com a Deriv
import { oauthDirectService } from '@/services/oauthDirectService';

// Interface para estatísticas de dígitos
interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

// Propriedades do componente
interface FixedDigitBarChartProps {
  symbol?: string;
  className?: string;
}

export function FixedDigitBarChart({ symbol = "R_100", className = "" }: FixedDigitBarChartProps) {
  // Estado para armazenar a quantidade de ticks a serem exibidos
  const [selectedCount, setSelectedCount] = useState("100");
  
  // Estado para armazenar os dígitos coletados
  const [digits, setDigits] = useState<number[]>([]);
  
  // Estado para armazenar as estatísticas calculadas
  const [digitStats, setDigitStats] = useState<DigitStat[]>([]);
  
  // Estado para controlar carregamento e erros
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Estado para o último dígito recebido
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [lastQuote, setLastQuote] = useState<number | null>(null);
  const [showLastDigit, setShowLastDigit] = useState(false);
  
  // Referência para controlar o timeout de exibição do último dígito
  const lastDigitTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Chave para forçar re-renderização
  const [renderKey, setRenderKey] = useState(0);
  
  // Controlador para evitar múltiplas chamadas de cálculo
  const calculatingRef = useRef(false);
  
  // Função para inicializar as estatísticas
  const initializeStats = () => {
    const initialStats: DigitStat[] = [];
    for (let i = 0; i < 10; i++) {
      initialStats.push({
        digit: i,
        count: 0,
        percentage: 0
      });
    }
    return initialStats;
  };
  
  // Inicializar estatísticas ao montar o componente
  useEffect(() => {
    setDigitStats(initializeStats());
  }, []);
  
  // Função para calcular estatísticas com base nos dígitos
  const calculateStats = (digitsToCount: number[]) => {
    if (calculatingRef.current || !digitsToCount || digitsToCount.length === 0) return;
    
    calculatingRef.current = true;
    
    try {
      // Inicializar contagem para cada dígito
      const counts: { [key: number]: number } = {};
      for (let i = 0; i < 10; i++) {
        counts[i] = 0;
      }
      
      // Contar ocorrências de cada dígito
      for (const digit of digitsToCount) {
        if (digit >= 0 && digit <= 9) {
          counts[digit] = (counts[digit] || 0) + 1;
        }
      }
      
      // Calcular percentagens e criar estatísticas
      const totalCounted = digitsToCount.length;
      const newStats: DigitStat[] = [];
      
      for (let i = 0; i < 10; i++) {
        const count = counts[i] || 0;
        const percentage = totalCounted > 0 ? Math.round((count / totalCounted) * 100) : 0;
        
        newStats.push({
          digit: i,
          count,
          percentage
        });
      }
      
      // Atualizar estado
      setDigitStats(newStats);
    } catch (err) {
      console.error('[FixedDigitBarChart] Erro ao calcular estatísticas:', err);
    } finally {
      calculatingRef.current = false;
    }
  };
  
  // Função para processar um novo dígito
  const processNewDigit = (digit: number, quote: number) => {
    setLastDigit(digit);
    setLastQuote(quote);
    
    // Mostrar o indicador visual
    setShowLastDigit(true);
    
    // Limpar timeout anterior se existir
    if (lastDigitTimeoutRef.current) {
      clearTimeout(lastDigitTimeoutRef.current);
    }
    
    // Configurar novo timeout para esconder o indicador
    lastDigitTimeoutRef.current = setTimeout(() => {
      setShowLastDigit(false);
    }, 3000);
    
    // Atualizar o histórico de dígitos
    setDigits(prevDigits => {
      // Criar uma cópia do array atual
      const updatedDigits = [digit, ...prevDigits];
      
      // Limitar a 500 dígitos no máximo
      if (updatedDigits.length > 500) {
        updatedDigits.length = 500;
      }
      
      // Salvar no localStorage para persistência
      try {
        localStorage.setItem(`fixed_digitHistory_${symbol}`, JSON.stringify(updatedDigits));
      } catch (e) {
        console.error('[FixedDigitBarChart] Erro ao salvar no localStorage:', e);
      }
      
      return updatedDigits;
    });
  };
  
  // Efeito para recalcular estatísticas quando os dígitos mudam
  useEffect(() => {
    const currentSelectedCount = parseInt(selectedCount);
    if (digits.length > 0 && currentSelectedCount > 0) {
      // Limitar a contagem ao número de dígitos disponíveis
      const countToUse = Math.min(currentSelectedCount, digits.length);
      calculateStats(digits.slice(0, countToUse));
    }
  }, [digits, selectedCount]);
  
  // Efeito para carregar os dados iniciais e configurar listeners
  useEffect(() => {
    console.log(`[FixedDigitBarChart] Inicializando para símbolo ${symbol}`);
    
    // Referência para controlar se o componente está montado
    const isMounted = { current: true };
    
    // Carregar histórico do localStorage
    try {
      const storedHistory = localStorage.getItem(`fixed_digitHistory_${symbol}`);
      if (storedHistory) {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          console.log(`[FixedDigitBarChart] Carregados ${parsedHistory.length} dígitos do localStorage`);
          setDigits(parsedHistory);
          // Forçar atualização da UI
          setRenderKey(prev => prev + 1);
        }
      }
    } catch (e) {
      console.error('[FixedDigitBarChart] Erro ao carregar do localStorage:', e);
    }
    
    // Função para manipular novos ticks
    const handleTick = (event: any) => {
      if (!isMounted.current) return;
      
      try {
        // Extrair dados relevantes do evento
        let tickData = null;
        
        if (event.type === 'tick') {
          if (event.data) {
            tickData = event.data.tick || event.data;
          } else if (event.tick) {
            tickData = event.tick;
          } else if (typeof event === 'object') {
            tickData = event;
          }
          
          if (tickData) {
            // Verificar se é o símbolo que estamos observando
            const tickSymbol = tickData.symbol || tickData.name || symbol;
            
            if (tickSymbol === symbol) {
              // Extrair cotação
              let quote = 0;
              if (typeof tickData.quote !== 'undefined') {
                quote = Number(tickData.quote);
              } else if (typeof tickData.value !== 'undefined') {
                quote = Number(tickData.value);
              } else if (typeof tickData.price !== 'undefined') {
                quote = Number(tickData.price);
              }
              
              if (quote > 0) {
                // Extrair o último dígito
                const quoteStr = quote.toString();
                const digit = parseInt(quoteStr.charAt(quoteStr.length - 1));
                
                if (!isNaN(digit)) {
                  console.log(`[FixedDigitBarChart] Novo tick para ${symbol}: ${quote} (dígito ${digit})`);
                  processNewDigit(digit, quote);
                  
                  // Forçar atualização da UI imediatamente após receber um novo dígito
                  setRenderKey(prev => prev + 1);
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('[FixedDigitBarChart] Erro ao processar tick:', err);
      }
    };
    
    // Configurar serviço e listeners
    if (oauthDirectService) {
      setLoading(true);
      
      // Registrar para eventos de tick
      oauthDirectService.addEventListener(handleTick);
      
      // Inscrever-se para receber ticks do símbolo desejado
      oauthDirectService.subscribeToTicks(symbol);
      
      console.log(`[FixedDigitBarChart] Registrado para receber ticks do símbolo ${symbol}`);
      
      // Definir intervalo para forçar atualização de UI mais frequente
      const refreshInterval = setInterval(() => {
        if (!isMounted.current) return;
        
        // Forçar recálculo das estatísticas a cada intervalo
        const currentSelectedCount = parseInt(selectedCount);
        if (digits.length > 0 && currentSelectedCount > 0) {
          // Limitar a contagem ao número de dígitos disponíveis
          const countToUse = Math.min(currentSelectedCount, digits.length);
          calculateStats(digits.slice(0, countToUse));
        }
        
        // Forçar atualização da UI
        setRenderKey(prev => prev + 1);
      }, 250); // Intervalo menor para atualizações mais frequentes
      
      // Intervalo secundário para verificações mais completas
      const fullRefreshInterval = setInterval(() => {
        if (!isMounted.current) return;
        
        // Criar cópias profundas dos estados para forçar atualizações
        if (digits.length > 0) {
          setDigits([...digits]);
          
          // Forçar atualização das estatísticas também
          setDigitStats(prevStats => 
            prevStats.map(stat => ({ ...stat }))
          );
        }
        
        // Também forçar atualização visual
        setRenderKey(prev => prev + 1);
      }, 1000);
      
      // Verificar conexão periodicamente
      const checkConnectionInterval = setInterval(() => {
        if (isMounted.current && oauthDirectService) {
          oauthDirectService.subscribeToTicks(symbol);
        }
      }, 15000);
      
      // Definir como carregado após um segundo
      setTimeout(() => {
        if (isMounted.current) {
          setLoading(false);
        }
      }, 1000);
      
      // Limpeza ao desmontar
      return () => {
        isMounted.current = false;
        
        // Remover listener
        if (oauthDirectService) {
          oauthDirectService.removeEventListener(handleTick);
        }
        
        // Limpar intervalos
        clearInterval(refreshInterval);
        clearInterval(fullRefreshInterval);
        clearInterval(checkConnectionInterval);
        
        // Limpar timeout se existir
        if (lastDigitTimeoutRef.current) {
          clearTimeout(lastDigitTimeoutRef.current);
        }
      };
    } else {
      setError("Serviço de conexão não disponível");
      setLoading(false);
    }
  }, [symbol, selectedCount]);
  
  return (
    <div className={`w-full ${className}`} key={`chart-container-${renderKey}`}>
      <div className="bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg">
        <div className="p-3 bg-[#0e1a2e] border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-600 mr-1.5 rounded-sm"></div>
            <h3 className="font-medium text-white flex items-center">
              Gráfico de Dígitos do {symbol}
              {loading && (
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