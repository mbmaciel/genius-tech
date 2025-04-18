import { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";
import { oauthDirectService } from "@/services/oauthDirectService";

interface SimpleDigitDisplayProps {
  digits: number[];
  symbol?: string;
}

export function SimpleDigitDisplay({ digits, symbol = "R_100" }: SimpleDigitDisplayProps) {
  const [internalDigits, setInternalDigits] = useState<number[]>(digits);
  const [renderKey, setRenderKey] = useState<number>(Date.now());
  
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
  
  console.log("[SIMPLE_DIGIT] Renderizando com key:", renderKey, "dígitos:", internalDigits);
  
  return (
    <Card className="bg-slate-800 p-3 shadow-lg border border-slate-700">
      <div className="text-center text-sm text-slate-400 mb-2">
        {symbol} • Última atualização: {new Date().toLocaleTimeString()}
      </div>
      
      <div className="flex flex-wrap justify-center gap-1.5">
        {internalDigits.length > 0 ? (
          internalDigits.map((digit, index) => (
            <div 
              key={`simple-digit-${index}-${digit}-${renderKey}`}
              className={`${getDigitColor(digit)} w-8 h-8 flex items-center justify-center rounded-full font-bold transition-all duration-300 shadow`}
            >
              {digit}
            </div>
          ))
        ) : (
          <div className="text-slate-400">Aguardando ticks...</div>
        )}
      </div>
    </Card>
  );
}