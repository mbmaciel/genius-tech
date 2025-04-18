import { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { oauthDirectService } from "@/services/oauthDirectService";

/**
 * Componente que atualiza os dígitos utilizando referências
 * para contornar problemas de reatividade no React
 */
export function DirectDigitDisplay() {
  // Estados para armazenar os dígitos e forçar renderização
  const [, setUpdateTrigger] = useState(0);
  
  // Usar ref para armazenar os dígitos diretamente (contorna problema de reatividade)
  const digitsRef = useRef<number[]>([]);
  const ticksReceivedRef = useRef<number>(0);
  
  // Forçar atualização periódica da interface
  useEffect(() => {
    console.log("[DIRECT_DISPLAY] Componente montado");
    
    // Forçar renderização a cada 500ms independente de receber ou não eventos
    const interval = setInterval(() => {
      setUpdateTrigger(prev => prev + 1);
    }, 500);
    
    return () => {
      console.log("[DIRECT_DISPLAY] Componente desmontado");
      clearInterval(interval);
    };
  }, []);
  
  // Configurar listener para eventos de tick
  useEffect(() => {
    console.log("[DIRECT_DISPLAY] Configurando listener de eventos");
    
    // Manipulador de eventos para ticks
    const handleTick = (event: any) => {
      if (event.type === 'tick' && typeof event.lastDigit === 'number') {
        // Atualizar a referência diretamente, sem passar pelo setState
        ticksReceivedRef.current++;
        digitsRef.current = [event.lastDigit, ...digitsRef.current].slice(0, 20);
        
        console.log(`[DIRECT_DISPLAY] Tick recebido #${ticksReceivedRef.current}: ${event.lastDigit}`);
        
        // Forçar renderização imediata
        setUpdateTrigger(Date.now());
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
      return "bg-purple-500 text-white"; // Roxo para 0 e 5
    } else if (digit % 2 === 0) {
      return "bg-red-500 text-white";    // Vermelho para pares
    } else {
      return "bg-green-500 text-white";  // Verde para ímpares
    }
  };
  
  return (
    <Card className="bg-gray-900 p-4 shadow-lg border border-gray-800">
      <div className="mb-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">Exibição direta com ref</span>
          <span className="text-xs text-gray-500">Ticks recebidos: {ticksReceivedRef.current}</span>
        </div>
        <div className="h-px bg-gray-800 w-full my-2"></div>
      </div>
      
      <div className="flex flex-wrap justify-center gap-2 mb-3">
        {digitsRef.current.length > 0 ? (
          digitsRef.current.map((digit, index) => (
            <div
              key={`direct-digit-${index}-${digit}`}
              className={`${getDigitColor(digit)} w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm shadow-md transition-all`}
            >
              {digit}
            </div>
          ))
        ) : (
          <div className="text-gray-500">Aguardando ticks...</div>
        )}
      </div>
      
      <div className="text-center text-xs text-gray-500">
        Última atualização: {new Date().toLocaleTimeString()}
      </div>
    </Card>
  );
}