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
  const hasSubscribed = useRef<boolean>(false); // Ref para controlar se já inscrevemos para ticks
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
      
      // Sempre buscar do serviço para garantir dados atualizados
      const historyData = await fetchFromServices();
      
      // Se o serviço retornou dados válidos, temos que forçar a atualização do estado
      if (historyData && Array.isArray(historyData.lastDigits) && historyData.lastDigits.length > 0) {
        // Usar dados frescos diretamente do serviço
        console.log(`[NewDigitBarChart] Atualizando estado com ${historyData.lastDigits.length} dígitos do serviço`);
        
        // IMPORTANTE: Usar spread para criar uma nova referência e forçar re-renderização
        setDigits([...historyData.lastDigits]);
        calculateStats(historyData.lastDigits.slice(0, parseInt(selectedCount)));
        setError(null);
        
        // Também atualizar o sessionStorage para ter dados consistentes
        sessionStorage.setItem(`digitHistory_${symbol}`, JSON.stringify(historyData.lastDigits));
      } 
      // Após buscar do serviço, adicionar uma verificação secundária apenas se necessário
      else if (digits.length === 0) {
        // Se ainda não temos dígitos do serviço, tente recuperar do sessionStorage como último recurso
        const storedDigits = sessionStorage.getItem(`digitHistory_${symbol}`);
        
        if (storedDigits) {
          try {
            const parsedDigits = JSON.parse(storedDigits);
            
            if (Array.isArray(parsedDigits) && parsedDigits.length > 0) {
              console.log(`[NewDigitBarChart] Usando ${parsedDigits.length} dígitos do sessionStorage como último recurso`);
              setDigits(parsedDigits);
              calculateStats(parsedDigits.slice(0, parseInt(selectedCount)));
              setError(null);
            }
          } catch (e) {
            console.error('[NewDigitBarChart] Erro ao ler do sessionStorage como último recurso:', e);
          }
        }
      }
      
    } catch (err) {
      console.error(`[NewDigitBarChart] Erro ao buscar histórico: ${err}`);
      setError("Erro ao obter dados históricos");
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };
  
  // Função para buscar dados dos serviços e evitar duplicações
  const fetchFromServices = async () => {
    try {
      // Forçar uma solicitação atualizada para garantir dados frescos
      if (oauthDirectService) {
        oauthDirectService.subscribeToTicks(symbol);
      }
      
      // Solicitar novos dados explicitamente do serviço de histórico
      await derivHistoryService.getTicksHistory(symbol, 500, true, false);
      
      // Obter os dados mais recentes após a solicitação
      const historyData = derivHistoryService.getDigitStats(symbol);
      
      if (historyData && historyData.lastDigits && historyData.lastDigits.length > 0) {
        // Log mais preciso sobre a fonte e quantidade de dados
        console.log(`[NewDigitBarChart] Recebido ${historyData.lastDigits.length} dígitos do derivHistoryService`);
        
        // Verificar se os dados são válidos antes de usar
        const validDigits = historyData.lastDigits.filter(d => typeof d === 'number' && d >= 0 && d <= 9);
        
        if (validDigits.length > 0) {
          // Verificar se precisamos atualizar o histórico
          // Comparar com o que já temos no estado para evitar atualizações desnecessárias
          let shouldUpdate = true;
          
          if (digits.length > 0) {
            // Verificar se os primeiros 10 dígitos são iguais (os mais recentes)
            // Se forem, não precisamos atualizar
            const currentFirst10 = digits.slice(0, 10);
            const newFirst10 = validDigits.slice(0, 10);
            
            // Só atualiza se houver realmente mudanças nos dígitos mais recentes
            if (currentFirst10.length === newFirst10.length) {
              let allEqual = true;
              for (let i = 0; i < currentFirst10.length; i++) {
                if (currentFirst10[i] !== newFirst10[i]) {
                  allEqual = false;
                  break;
                }
              }
              
              if (allEqual) {
                shouldUpdate = false;
                console.log(`[NewDigitBarChart] Ignorando atualização, os 10 dígitos mais recentes são idênticos`);
              }
            }
          }
          
          if (shouldUpdate) {
            // IMPORTANTE: Criar uma NOVA instância do array para forçar re-renderização
            const freshDigits = [...validDigits];
            
            // Usar apenas dígitos válidos - IMPORTANTE: Atribuição direta para atualização imediata
            setDigits(freshDigits);
            
            // Recalcular estatísticas com dados frescos
            calculateStats(freshDigits.slice(0, parseInt(selectedCount)));
            
            // Salvar no sessionStorage para acesso rápido - APENAS se tiver dados válidos
            console.log(`[NewDigitBarChart] Salvando ${freshDigits.length} dígitos válidos no sessionStorage`);
            sessionStorage.setItem(`digitHistory_${symbol}`, JSON.stringify(freshDigits));
            
            // Salvar estatísticas se disponíveis
            if (historyData.digitStats) {
              sessionStorage.setItem(`digitStats_${symbol}`, JSON.stringify(historyData.digitStats));
            }
            
            setError(null);
          }
          
          // Retornar o objeto historyData completo para uso posterior mesmo se não atualizou
          // pois outras partes do código podem precisar desses dados
          return {
            lastDigits: validDigits,
            digitStats: historyData.digitStats,
            totalCount: historyData.totalCount,
            lastUpdated: historyData.lastUpdated
          };
        } else {
          console.warn(`[NewDigitBarChart] Nenhum dígito válido encontrado nos dados recebidos do serviço`);
        }
      } else {
        // Se não conseguir do derivHistoryService, tente obter diretamente do oauthDirectService
        console.log(`[NewDigitBarChart] Solicitando ticks direto do oauthDirectService para ${symbol}`);
        
        // Garantir que estamos inscritos nos ticks (apenas uma vez)
        if (oauthDirectService && !hasSubscribed.current) {
          oauthDirectService.subscribeToTicks(symbol);
          hasSubscribed.current = true;
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
    
    // Se chegou aqui, retornar null para indicar que não conseguiu obter dados
    return null;
  };

  // Função para forçar carregamento limpo dos ticks iniciais
  const forceInitialTicksLoad = () => {
    console.log(`[NewDigitBarChart] Inicializando histórico de dígitos do zero`);
    
    // Limpar o sessionStorage para este símbolo para garantir dados limpos
    sessionStorage.removeItem(`digitHistory_${symbol}`);
    sessionStorage.removeItem(`digitStats_${symbol}`);
    sessionStorage.removeItem(`lastDigit_${symbol}`);
    sessionStorage.removeItem(`lastQuote_${symbol}`);
    
    // Resetar o estado do componente
    setDigits([]);
    setDigitStats([]);
    
    // Solicitar novos ticks diretamente do serviço
    if (oauthDirectService) {
      // Primeiro desinscrever para limpar qualquer estado anterior
      // Verificamos se o método existe para evitar erros
      try {
        // Como esse método pode não existir, usamos uma abordagem diferente
        // oauthDirectService.unsubscribeFromTicks não existe, então vamos apenas
        // nos reinscrever diretamente
        console.log(`[NewDigitBarChart] Reativando inscrição de ticks para ${symbol}`);
      } catch (e) {
        console.error(`[NewDigitBarChart] Erro ao processar ticks:`, e);
      }
      
      // Pequeno atraso para garantir que a desinscrição seja processada
      setTimeout(() => {
        // Agora inscrever para obter novos ticks
        oauthDirectService.subscribeToTicks(symbol);
        console.log(`[NewDigitBarChart] Solicitação explícita de ticks enviada para ${symbol}`);
        
        // Forçar uma chamada direta para buscar histórico fresco
        setTimeout(() => {
          console.log(`[NewDigitBarChart] Solicitando histórico completo diretamente do serviço`);
          derivHistoryService.getTicksHistory(symbol, 500, true, true)
            .then(() => fetchDigitHistory())
            .catch(e => console.error(`[NewDigitBarChart] Erro ao buscar histórico inicial:`, e));
        }, 300);
      }, 100);
    }
  };

  // Efeito para carregar os dados iniciais e lidar com ticks diretos do oauthDirectService
  useEffect(() => {
    console.log(`[NewDigitBarChart] Inicializando componente para ${symbol}`);
    
    // Limpar qualquer cache inconsistente se necessário
    try {
      // Verificar se temos dados válidos no localStorage
      const storedDigits = sessionStorage.getItem(`digitHistory_${symbol}`);
      if (storedDigits) {
        try {
          const parsedDigits = JSON.parse(storedDigits);
          if (!Array.isArray(parsedDigits) || parsedDigits.some(d => typeof d !== 'number' || d < 0 || d > 9)) {
            console.warn(`[NewDigitBarChart] Dados de histórico inválidos no sessionStorage, limpando...`);
            sessionStorage.removeItem(`digitHistory_${symbol}`);
          } else {
            console.log(`[NewDigitBarChart] Verificado: ${parsedDigits.length} dígitos válidos no sessionStorage`);
          }
        } catch (e) {
          console.error(`[NewDigitBarChart] Erro ao verificar dados do sessionStorage:`, e);
          sessionStorage.removeItem(`digitHistory_${symbol}`);
        }
      }
    } catch (e) {
      console.error(`[NewDigitBarChart] Erro ao verificar sessionStorage:`, e);
    }
    
    // Forçar carregamento imediato na inicialização
    forceInitialTicksLoad();
    
    // Forçar atualização da UI mais frequentemente sem solicitar novos ticks
    const renderInterval = setInterval(() => {
      setRenderKey(prev => prev + 1);
    }, 500); // Mais rápido para melhor capturar os novos dígitos
    
    // Verificação leve para atualização de estatísticas sem reconexão
    const updateInterval = setInterval(() => {
      // Apenas recalcular estatísticas com dados já carregados, sem solicitar novos
      try {
        if (digits.length > 0) {
          calculateStats(digits.slice(0, parseInt(selectedCount)));
        }
      } catch (e) {
        console.error(`[NewDigitBarChart] Erro ao atualizar estatísticas:`, e);
      }
    }, 2000);
    
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
                  
                  // Persistir no sessionStorage individual do último dígito
                  sessionStorage.setItem(`lastDigit_${symbol}`, digit.toString());
                  sessionStorage.setItem(`lastQuote_${symbol}`, quote.toString());
                  
                  // Atualizar estado local do indicador visual
                  setShowLastDigit(true);
                  // Não estamos usando setLastDigit e setLastQuote diretamente
                  // pois esses valores vêm do hook useDerivTicks
                  
                  // Limpar timeout anterior
                  if (lastDigitTimeoutRef.current) {
                    clearTimeout(lastDigitTimeoutRef.current);
                  }
                  
                  // Configurar novo timeout
                  lastDigitTimeoutRef.current = setTimeout(() => {
                    setShowLastDigit(false);
                  }, 3000);
                  
                  // IMPORTANTE: Recuperar os dígitos ATUAIS do sessionStorage primeiro
                  // para não sobrescrever o histórico com apenas um dígito
                  let currentDigits: number[] = [];
                  try {
                    const storedDigits = sessionStorage.getItem(`digitHistory_${symbol}`);
                    if (storedDigits) {
                      const parsedDigits = JSON.parse(storedDigits);
                      if (Array.isArray(parsedDigits) && parsedDigits.length > 0) {
                        // Verificar se os dígitos são válidos
                        if (parsedDigits.every(d => typeof d === 'number' && d >= 0 && d <= 9)) {
                          currentDigits = parsedDigits;
                        }
                      }
                    }
                  } catch (e) {
                    console.error('[NewDigitBarChart] Erro ao recuperar histórico:', e);
                  }
                  
                  // Se não conseguiu do sessionStorage, usar o estado atual
                  if (currentDigits.length === 0 && Array.isArray(digits)) {
                    currentDigits = [...digits];
                  }
                  
                  // Garantir que o dígito é válido antes de adicionar (0-9)
                  if (digit >= 0 && digit <= 9) {
                    // Adicionar o novo dígito no início (mais recente)
                    currentDigits.unshift(digit);
                    
                    // Manter apenas os últimos 500 dígitos
                    if (currentDigits.length > 500) {
                      currentDigits.length = 500;
                    }
                    
                    // Atualizar estado
                    setDigits(currentDigits);
                    
                    // Persistir em sessionStorage de forma segura
                    try {
                      // Usar uma cópia independente para evitar problemas de referência
                      const digitsCopy = [...currentDigits];
                      console.log(`[NewDigitBarChart] Atualizando histórico com novo dígito ${digit}, total agora: ${digitsCopy.length}`);
                      
                      // Persistir apenas depois de confirmar que temos dados válidos
                      if (digitsCopy.length > 0 && digitsCopy.every(d => Number.isInteger(d) && d >= 0 && d <= 9)) {
                        sessionStorage.setItem(`digitHistory_${symbol}`, JSON.stringify(digitsCopy));
                      } else {
                        console.warn('[NewDigitBarChart] Tentativa de salvar dados inválidos evitada.');
                      }
                    } catch (storageError) {
                      console.error('[NewDigitBarChart] Erro ao salvar no sessionStorage:', storageError);
                    }
                    
                    // Recalcular estatísticas com os dígitos atualizados
                    calculateStats(currentDigits.slice(0, parseInt(selectedCount)));
                  } else {
                    console.warn(`[NewDigitBarChart] Dígito inválido ignorado: ${digit}`);
                  }
                  
                  // Recalcular estatísticas apenas quando temos dígitos válidos
                  if (Array.isArray(digits)) {
                    // Criar uma cópia do array de dígitos atual
                    const digitsArray = [...digits];
                    
                    // Adicionar o novo dígito se ainda não estiver adicionado
                    if (digitsArray.length === 0 || digitsArray[0] !== digit) {
                      digitsArray.unshift(digit);
                      
                      // Manter apenas os últimos 500 dígitos
                      if (digitsArray.length > 500) {
                        digitsArray.length = 500;
                      }
                    }
                    
                    // Calcular estatísticas com o número selecionado de dígitos
                    calculateStats(digitsArray.slice(0, parseInt(selectedCount)));
                  }
                  
                  // Emitir evento para outros componentes
                  const tickEvent = new CustomEvent('tick-update', { 
                    detail: { 
                      digit, 
                      quote, 
                      symbol,
                      timestamp: Date.now() // Adicionar timestamp para melhor controle
                    } 
                  });
                  document.dispatchEvent(tickEvent);
                  
                  // Não precisamos fazer fetchDigitHistory após cada tick
                  // Isso evita as reconexões constantes
                  // Apenas recalculamos as estatísticas com os dados existentes
                  if (digits.length > 0) {
                    calculateStats(digits.slice(0, parseInt(selectedCount)));
                  }
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
  
  // Para rastrear o último dígito processado e evitar duplicações
  const lastProcessedDigitRef = useRef<{digit: number, timestamp: number} | null>(null);
  
  // Efeito para processar novos dígitos recebidos do hook useDerivTicks
  useEffect(() => {
    if (lastDigit !== null) {
      console.log(`[NewDigitBarChart] Novo dígito recebido do hook: ${lastDigit}`);
      
      // Verificar se este dígito já foi processado recentemente
      // Usamos uma janela de 1 segundo para evitar processamento duplicado
      const now = Date.now();
      const lastProcessed = lastProcessedDigitRef.current;
      
      if (lastProcessed && 
          lastProcessed.digit === lastDigit && 
          now - lastProcessed.timestamp < 1000) {
        console.log(`[NewDigitBarChart] Ignorando dígito ${lastDigit} duplicado (processado há ${now - lastProcessed.timestamp}ms)`);
        return; // Ignorar este tick, já foi processado recentemente
      }
      
      // Registrar este dígito como processado
      lastProcessedDigitRef.current = {
        digit: lastDigit,
        timestamp: now
      };
      
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
          symbol,
          timestamp: now
        } 
      });
      document.dispatchEvent(tickEvent);
      
      // Atualizar o histórico IMEDIATAMENTE com o novo dígito
      try {
        // 1. Primeiro buscar do sessionStorage para garantir que temos dados consistentes
        let currentDigits: number[] = [];
        const storedDigits = sessionStorage.getItem(`digitHistory_${symbol}`);
        
        if (storedDigits) {
          try {
            const parsed = JSON.parse(storedDigits);
            if (Array.isArray(parsed) && parsed.length > 0) {
              currentDigits = parsed;
            }
          } catch (e) {
            console.error(`[NewDigitBarChart] Erro ao ler histórico do sessionStorage:`, e);
          }
        }
        
        // Se não conseguir do sessionStorage, usar o estado atual
        if (currentDigits.length === 0 && digits.length > 0) {
          currentDigits = [...digits];
        }
        
        // 2. Verificar duplicação no início do array (posições mais recentes)
        // Verificamos se este dígito já está entre os 10 primeiros do histórico
        const isAlreadyRecent = currentDigits.length > 0 && 
                                currentDigits.slice(0, 10).includes(lastDigit);
        
        if (!isAlreadyRecent) {
          // 3. Adicionar o novo dígito NO INÍCIO (posição mais recente)
          currentDigits.unshift(lastDigit);
          
          // 4. Limitar tamanho
          if (currentDigits.length > 500) {
            currentDigits = currentDigits.slice(0, 500);
          }
          
          // 5. Atualizar o estado primeiro (isso força renderização)
          setDigits([...currentDigits]); // Usar nova referência para garantir atualização
          
          // 6. Recalcular estatísticas
          calculateStats(currentDigits.slice(0, parseInt(selectedCount)));
          
          // 7. Atualizar sessionStorage
          sessionStorage.setItem(`digitHistory_${symbol}`, JSON.stringify(currentDigits));
          
          console.log(`[NewDigitBarChart] Histórico atualizado IMEDIATAMENTE no useEffect (${currentDigits.length} dígitos)`);
          
          // 8. Também atualizar o serviço de histórico para manter consistência
          // Isso é importante porque outros componentes podem depender desse serviço
          try {
            derivHistoryService.addDigitToHistory(symbol, lastDigit);
          } catch (e) {
            console.error(`[NewDigitBarChart] Erro ao atualizar serviço de histórico:`, e);
          }
        } else {
          console.log(`[NewDigitBarChart] Dígito ${lastDigit} já está entre os 10 mais recentes, ignorando`);
        }
      } catch (e) {
        console.error(`[NewDigitBarChart] Erro ao atualizar histórico imediatamente:`, e);
      }
    }
  }, [lastDigit, lastQuote, symbol, selectedCount, digits]);

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
                <SelectValue />
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
                      {stat.digit.toString()}
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
                      {digit.toString()}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
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