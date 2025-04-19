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

  // Função para buscar histórico de dígitos
  const fetchDigitHistory = async () => {
    try {
      setLoading(true);
      // Obter dados de histórico diretamente do serviço usando o método público
      const historyData = derivHistoryService.getDigitStats(symbol);
      
      if (historyData && historyData.lastDigits && historyData.lastDigits.length > 0) {
        setDigits(historyData.lastDigits);
        calculateStats(historyData.lastDigits.slice(0, parseInt(selectedCount)));
        setError(null);
      } else {
        setError("Não foi possível obter o histórico de dígitos");
      }
    } catch (err) {
      console.error(`[NewDigitBarChart] Erro ao buscar histórico: ${err}`);
      setError("Erro ao obter dados históricos");
    } finally {
      setLoading(false);
    }
  };

  // Efeito para carregar os dados iniciais
  useEffect(() => {
    console.log(`[NewDigitBarChart] Inicializando componente para ${symbol}`);
    fetchDigitHistory();
    
    // Configurar atualização periódica
    const updateInterval = setInterval(() => {
      fetchDigitHistory();
    }, 2000);
    
    // Forçar atualização da UI
    const renderInterval = setInterval(() => {
      setRenderKey(prev => prev + 1);
    }, 1000);
    
    return () => {
      clearInterval(updateInterval);
      clearInterval(renderInterval);
      
      // Limpar timeout caso exista
      if (lastDigitTimeoutRef.current) {
        clearTimeout(lastDigitTimeoutRef.current);
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