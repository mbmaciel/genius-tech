import React, { useEffect, useState } from 'react';
import { oauthDirectService } from '@/services/oauthDirectService';
import { derivHistoryService } from '@/services/deriv-history-service';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DigitBarChartProps {
  symbol?: string;
  className?: string;
}

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export function DigitBarChart({ symbol = "R_100", className = "" }: DigitBarChartProps) {
  // Estados
  const [digits, setDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<DigitStat[]>(
    Array.from({ length: 10 }, (_, i) => ({ digit: i, count: 0, percentage: 0 }))
  );
  const [selectedCount, setSelectedCount] = useState<string>("500");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState<number>(0);
  const [lastDigit, setLastDigit] = useState<number | null>(null); // Guardar o último dígito recebido
  const [showLastDigit, setShowLastDigit] = useState<boolean>(true); // Controlar exibição

  // Buscar histórico de ticks no carregamento
  const fetchTicksHistory = async () => {
    try {
      setLoading(true);
      // O método getFullTicksHistory não existe, então vamos começar com array vazio
      // e construir histórico a partir de ticks recebidos em tempo real
      setDigits([]);
      
      // Inicializar com estatísticas vazias
      const emptyStats = Array.from({ length: 10 }, (_, i) => ({ 
        digit: i, count: 0, percentage: 0 
      }));
      setDigitStats(emptyStats);
      
      console.log(`[DigitBarChart] Iniciando coleta de ticks em tempo real para ${symbol}`);
      // Permitir que o componente inicie mesmo sem histórico inicial
      setLoading(false);
    } catch (err) {
      console.error("[DigitBarChart] Erro ao inicializar:", err);
      setError("Erro ao inicializar componente");
      setLoading(false);
    }
  };

  // Função para calcular estatísticas dos dígitos
  const calculateStats = (historyDigits: number[]) => {
    const limit = parseInt(selectedCount);
    const digitsToAnalyze = historyDigits.slice(0, limit);
    const counts = Array(10).fill(0);
    
    digitsToAnalyze.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    });
    
    const total = digitsToAnalyze.length;
    
    const newStats = counts.map((count, digit) => {
      const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
      return { digit, count, percentage };
    });
    
    setDigitStats(newStats);
    // Forçar renderização com nova chave
    setRenderKey(prev => prev + 1);
  };

  // Adicionar novo dígito recebido em tempo real
  const addNewDigit = (newDigit: number) => {
    setDigits(prev => {
      const updated = [newDigit, ...prev].slice(0, 500);
      calculateStats(updated);
      return updated;
    });
  };

  // Recalcular quando a seleção mudar
  useEffect(() => {
    if (digits.length > 0) {
      calculateStats(digits);
    }
  }, [selectedCount]);

  // Inicializar dados e configurar listener para ticks em tempo real
  useEffect(() => {
    // Buscar histórico inicial
    fetchTicksHistory();
    
    // Função para atualizar os dados
    const updateDigitData = () => {
      console.log('[DigitBarChart] Atualizando dados de dígitos...');
      
      try {
        // Obter dados do serviço de histórico
        const historyData = derivHistoryService.getDigitStats(symbol);
        
        if (historyData && historyData.lastDigits) {
          // Obter array de dígitos
          const tickHistory = historyData.lastDigits;
          const count = parseInt(selectedCount);
          
          // Pegar apenas os dígitos mais recentes conforme a quantidade selecionada
          const recentDigits = tickHistory.slice(0, count);
          
          if (recentDigits.length > 0) {
            console.log(`[DigitBarChart] Recebidos ${recentDigits.length} dígitos para ${symbol}`);
            
            // Atualizar histórico completo
            setDigits(recentDigits);
            
            // Calcular estatísticas a partir do histórico
            calculateStats(recentDigits);
            setLoading(false);
          } else {
            console.log('[DigitBarChart] Sem dígitos recentes disponíveis');
          }
        } else {
          console.log(`[DigitBarChart] Sem dados de histórico para ${symbol}`);
        }
      } catch (err) {
        console.error('[DigitBarChart] Erro ao atualizar dados:', err);
      }
    };
    
    // Garantir que estamos inscritos para os ticks via OAuth
    if (oauthDirectService && typeof oauthDirectService.subscribeToTicks === 'function') {
      console.log(`[DigitBarChart] Inscrevendo-se para ticks de ${symbol} via OAuth`);
      oauthDirectService.subscribeToTicks(symbol);
    }
    
    // Adicionar listener para o serviço de histórico
    const historyListener = (data: any) => {
      if (data && data.lastDigits && data.lastDigits.length > 0) {
        // Guardar o último dígito para destacar na UI
        if (data.lastDigits[0] !== undefined) {
          setLastDigit(data.lastDigits[0]);
          
          // Resetar a exibição do dígito após 3 segundos
          setShowLastDigit(true);
          setTimeout(() => {
            setShowLastDigit(false);
          }, 3000);
        }
        
        setDigits(data.lastDigits);
        calculateStats(data.lastDigits.slice(0, parseInt(selectedCount)));
      }
    };
    
    // Adicionar listener para ticks do OAuth diretamente
    const tickListener = (event: CustomEvent) => {
      try {
        // Acessar diretamente a mensagem recebida
        const message = event.detail?.tick || event.detail;
        
        // Extrair o último dígito
        let lastDigitValue = null;
        
        // Verificar se temos o formato de log da aplicação (OAUTH_DIRECT com último dígito)
        if (message && typeof message === 'string' && message.includes('Último dígito:')) {
          const match = message.match(/Último dígito: (\d)/);
          if (match && match[1]) {
            lastDigitValue = parseInt(match[1]);
            console.log(`[DigitBarChart] Dígito extraído dos logs: ${lastDigitValue}`);
          }
        }
        // Verificar formato normal da API
        else if (message && message.quote) {
          // Verificar se é o formato esperado
          const quote = message.quote.toString();
          const lastChar = quote.charAt(quote.length - 1);
          lastDigitValue = parseInt(lastChar);
          console.log(`[DigitBarChart] Dígito extraído da cotação: ${lastDigitValue}`);
        } 
        // Verificar formato da API quando vem dentro de tick
        else if (message && message.tick && message.tick.quote) {
          const quote = message.tick.quote.toString();
          const lastChar = quote.charAt(quote.length - 1);
          lastDigitValue = parseInt(lastChar);
          console.log(`[DigitBarChart] Dígito extraído do tick.quote: ${lastDigitValue}`);
        }
        // Para depuração: mostrar formato do tick recebido
        else if (message) {
          console.log('[DigitBarChart] Formato de tick recebido:', typeof message === 'object' ? JSON.stringify(message) : message);
        }
        
        // Se conseguimos extrair um dígito válido
        if (lastDigitValue !== null && !isNaN(lastDigitValue) && lastDigitValue >= 0 && lastDigitValue <= 9) {
          // Atualizar o estado do componente
          setLastDigit(lastDigitValue);
          setShowLastDigit(true);
          
          // Resetar o estado após 3 segundos
          setTimeout(() => {
            setShowLastDigit(false);
          }, 3000);
        }
      } catch (err) {
        console.error('[DigitBarChart] Erro ao processar tick:', err);
      }
    };
    
    // Registrar para todos os eventos possíveis que possam conter ticks
    window.addEventListener('oauthTick', tickListener as EventListener);
    
    // Registro personalizado para capturar eventos diretamente do módulo OAuth
    document.addEventListener('tick', tickListener as EventListener);
    
    // Criar um método de acesso direto ao serviço através de uma função personalizada
    console.log('[DigitBarChart] Configurando monitoramento direto de ticks');
    
    // Configurar um evento personalizado para capturar ticks
    const tickEventName = 'digitBarChartTick';
    
    // Adicionar listener para ticks diretos da API
    window.addEventListener(tickEventName, ((event: CustomEvent) => {
      if (event.detail && event.detail.digit !== undefined) {
        const digit = event.detail.digit;
        console.log(`[DigitBarChart] Novo tick personalizado capturado: ${digit}`);
        setLastDigit(digit);
        setShowLastDigit(true);
        setTimeout(() => setShowLastDigit(false), 3000);
      }
    }) as EventListener);
    
    // Criar um proxy para capturar as chamadas WebSocket
    if (window.WebSocket) {
      console.log('[DigitBarChart] Configurando proxy WebSocket para monitorar ticks');
      
      // Função para analisar mensagens da API Deriv
      const parseDerivMessage = (data: string) => {
        try {
          const message = JSON.parse(data);
          if (message && message.tick && message.tick.quote) {
            const quote = message.tick.quote.toString();
            const lastChar = quote.charAt(quote.length - 1);
            const digit = parseInt(lastChar);
            
            if (!isNaN(digit) && digit >= 0 && digit <= 9) {
              // Disparar evento personalizado com o dígito
              window.dispatchEvent(new CustomEvent(tickEventName, { 
                detail: { digit, symbol: message.tick.symbol } 
              }));
            }
          }
        } catch (e) {
          // Ignorar erros de parsing
        }
      };
    }
    
    // Registrar no serviço de histórico
    derivHistoryService.addListener(historyListener, symbol);
    
    // Configurar atualização periódica dos ticks
    const tickUpdateInterval = setInterval(updateDigitData, 1000);
    
    // Reforçar atualização periódica da interface
    const forceUpdateInterval = setInterval(() => {
      setRenderKey(prev => prev + 1);
    }, 1000);
    
    // Método específico para exibir o dígito mais recente a partir dos dados armazenados
    const manualForceDigitUpdate = () => {
      // Buscar o último dígito dos dados disponíveis
      if (digits.length > 0) {
        const lastDigitFromHistory = digits[0];
        console.log(`[DigitBarChart] Atualizando último dígito manualmente: ${lastDigitFromHistory}`);
        setLastDigit(lastDigitFromHistory);
        setShowLastDigit(true);
        setTimeout(() => setShowLastDigit(false), 3000);
      }
    };
    
    // Programar para acionar a cada 2 segundos para garantir a atualização
    const manualCheckInterval = setInterval(manualForceDigitUpdate, 2000);
    
    return () => {
      // Limpar intervalos e desregistrar listeners
      derivHistoryService.removeListener(historyListener);
      window.removeEventListener('oauthTick', tickListener as EventListener);
      document.removeEventListener('tick', tickListener as EventListener);
      
      // Remover eventos personalizados
      window.removeEventListener('digitBarChartTick', ((event) => {}) as EventListener);
      
      clearInterval(tickUpdateInterval);
      clearInterval(forceUpdateInterval);
      clearInterval(manualCheckInterval);
    };
  }, [symbol, selectedCount]);

  return (
    <div className={`w-full ${className}`} key={`chart-container-${renderKey}`}>
      <div className="bg-[#0e1a2e] rounded-md overflow-hidden shadow-lg">
        <div className="p-3 bg-[#0e1a2e] border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-600 mr-1.5 rounded-sm"></div>
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
                <SelectValue placeholder="500" />
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
          </div>
        )}
      </div>
    </div>
  );
}