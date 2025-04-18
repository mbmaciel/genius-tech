import { useState, useEffect, useMemo } from 'react';
import { Card } from "@/components/ui/card";
import { oauthDirectService } from "@/services/oauthDirectService";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface SimpleDigitDisplayProps {
  digits: number[];
  symbol?: string;
}

interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export function SimpleDigitDisplay({ digits, symbol = "R_100" }: SimpleDigitDisplayProps) {
  const [internalDigits, setInternalDigits] = useState<number[]>(digits);
  const [renderKey, setRenderKey] = useState<number>(Date.now());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Forçar renderização a cada segundo para garantir atualização visual
  useEffect(() => {
    const interval = setInterval(() => {
      setRenderKey(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Atualizar quando os dígitos externos mudarem
  useEffect(() => {
    console.log("[SIMPLE_DIGIT] Atualizando com novos dígitos externos:", digits);
    setInternalDigits(digits);
  }, [digits]);
  
  // Escutar eventos de tick diretamente
  useEffect(() => {
    console.log("[SIMPLE_DIGIT] Configurando listener de ticks para exibição simples");
    
    const handleTick = (event: any) => {
      if (event.type === 'tick' && typeof event.lastDigit === 'number') {
        console.log(`[SIMPLE_DIGIT] Tick recebido diretamente: ${event.lastDigit} (timestamp: ${event.timestamp || 'n/a'})`);
        
        setInternalDigits(prev => {
          // Criar uma referência completamente nova para o array
          const updated = [event.lastDigit, ...prev].slice(0, 20);
          return updated;
        });
        
        // Atualizar timestamp
        setLastUpdate(new Date());
        
        // Forçar nova renderização
        setRenderKey(Date.now());
      }
    };
    
    // Registrar handler
    oauthDirectService.addEventListener(handleTick);
    
    // Limpar
    return () => {
      oauthDirectService.removeEventListener(handleTick);
    };
  }, []);
  
  // Calcular estatísticas de dígitos
  const stats = useMemo(() => {
    if (internalDigits.length === 0) return [];
    
    // Contar ocorrências
    const counts = Array(10).fill(0);
    internalDigits.forEach(digit => {
      counts[digit]++;
    });
    
    // Calcular percentuais e criar array com estatísticas
    return Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: counts[i],
      percentage: Math.round((counts[i] / internalDigits.length) * 100)
    })) as DigitStat[];
  }, [internalDigits]);
  
  // Checar padrões
  const patterns = useMemo(() => {
    if (internalDigits.length < 3) return [];
    
    const results = [];
    
    // Padrão: 3 ou mais dígitos pares consecutivos
    let consecPairs = 0;
    for (let i = 0; i < internalDigits.length; i++) {
      if (internalDigits[i] % 2 === 0) {
        consecPairs++;
      } else {
        if (consecPairs >= 3) {
          results.push({
            type: 'conseq_even',
            count: consecPairs,
            message: `${consecPairs} pares consecutivos`
          });
        }
        consecPairs = 0;
      }
    }
    // Verificar caso termine com o padrão
    if (consecPairs >= 3) {
      results.push({
        type: 'conseq_even',
        count: consecPairs,
        message: `${consecPairs} pares consecutivos`
      });
    }
    
    // Padrão: 3 ou mais dígitos ímpares consecutivos
    let consecOdds = 0;
    for (let i = 0; i < internalDigits.length; i++) {
      if (internalDigits[i] % 2 !== 0) {
        consecOdds++;
      } else {
        if (consecOdds >= 3) {
          results.push({
            type: 'conseq_odd',
            count: consecOdds,
            message: `${consecOdds} ímpares consecutivos`
          });
        }
        consecOdds = 0;
      }
    }
    // Verificar caso termine com o padrão
    if (consecOdds >= 3) {
      results.push({
        type: 'conseq_odd',
        count: consecOdds,
        message: `${consecOdds} ímpares consecutivos`
      });
    }
    
    // Dígito mais frequente
    if (stats.length > 0) {
      const mostFrequent = [...stats].sort((a, b) => b.count - a.count)[0];
      if (mostFrequent.count >= 3) {
        results.push({
          type: 'frequent',
          digit: mostFrequent.digit,
          count: mostFrequent.count,
          message: `O dígito ${mostFrequent.digit} apareceu ${mostFrequent.count} vezes (${mostFrequent.percentage}%)`
        });
      }
    }
    
    return results;
  }, [internalDigits, stats]);
  
  // Função para determinar a cor do dígito
  const getDigitColor = (digit: number): string => {
    if (digit === 0 || digit === 5) {
      return "bg-amber-500 text-white"; // Amarelo para 0 e 5
    } else if (digit % 2 === 0) {
      return "bg-red-500 text-white";   // Vermelho para pares
    } else {
      return "bg-green-500 text-white"; // Verde para ímpares
    }
  };
  
  // Função para determinar cor de fundo baseada na porcentagem
  const getPercentageBackgroundStyle = (percentage: number) => {
    if (percentage >= 30) return { width: `${percentage}%`, backgroundColor: '#ef4444' }; // Vermelho
    if (percentage >= 20) return { width: `${percentage}%`, backgroundColor: '#f59e0b' }; // Âmbar
    if (percentage >= 10) return { width: `${percentage}%`, backgroundColor: '#10b981' }; // Verde
    return { width: `${percentage}%`, backgroundColor: '#6b7280' }; // Cinza
  };

  console.log("[SIMPLE_DIGIT] Renderizando com key:", renderKey, "dígitos:", internalDigits);
  
  return (
    <Card className="bg-[#13203a] p-4 shadow-lg border border-[#2a3756]">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center">
          <div className="h-3 w-3 rounded-full bg-blue-500 mr-2 animate-pulse"></div>
          <span className="text-sm font-medium text-white">{symbol}</span>
        </div>
        <div className="text-xs text-gray-400">
          Atualização: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>
      
      {/* Sequência de dígitos atual */}
      <div className="mb-4">
        <div className="text-xs text-gray-400 mb-2 font-medium">Sequência de dígitos atual:</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {internalDigits.length > 0 ? (
            internalDigits.map((digit, index) => (
              <div 
                key={`digit-${index}-${digit}-${renderKey}`}
                className={`${getDigitColor(digit)} w-8 h-8 flex items-center justify-center rounded-md font-bold text-sm shadow-md transform ${index === 0 ? 'scale-110 border-2 border-white' : ''}`}
              >
                {digit}
              </div>
            ))
          ) : (
            <div className="text-gray-400">Aguardando dados...</div>
          )}
        </div>
        
        {/* Legendas */}
        <div className="flex gap-3 mt-2 text-xs">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
            <span className="text-gray-400">Pares</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
            <span className="text-gray-400">Ímpares</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-amber-500 mr-1"></div>
            <span className="text-gray-400">0/5</span>
          </div>
        </div>
      </div>
      
      <Separator className="bg-[#2a3756] mb-4" />
      
      {/* Estatísticas */}
      <div className="mb-4">
        <h3 className="text-xs text-gray-400 font-medium mb-2">Distribuição de dígitos:</h3>
        <div className="grid grid-cols-5 gap-2">
          {stats.map((stat) => (
            <div key={`stat-${stat.digit}`} className="relative">
              <div className="text-center mb-1">
                <span className={`text-xs font-medium ${
                  stat.percentage >= 30 ? 'text-red-400' : 
                  stat.percentage >= 20 ? 'text-amber-400' : 
                  stat.percentage >= 10 ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {stat.digit}
                </span>
              </div>
              <div className="h-4 bg-[#1d2a45] rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500 ease-out"
                  style={getPercentageBackgroundStyle(stat.percentage)}
                ></div>
              </div>
              <div className="text-center mt-1">
                <span className="text-[10px] text-gray-400">{stat.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Padrões detectados */}
      {patterns.length > 0 && (
        <div>
          <h3 className="text-xs text-gray-400 font-medium mb-2">Padrões detectados:</h3>
          <div className="flex flex-wrap gap-2">
            {patterns.map((pattern, index) => (
              <Badge 
                key={`pattern-${index}`} 
                variant="outline"
                className={`
                  ${pattern.type === 'conseq_even' ? 'border-red-500 text-red-400' : 
                    pattern.type === 'conseq_odd' ? 'border-green-500 text-green-400' : 
                    'border-blue-500 text-blue-400'}
                `}
              >
                {pattern.message}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}