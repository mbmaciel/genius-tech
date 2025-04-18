import React, { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { oauthDirectService } from "@/services/oauthDirectService";

/**
 * Um componente que atualiza os dígitos automaticamente
 * Contorna problemas de renderização usando forceUpdate
 */
export function ForceUpdateDigitDisplay() {
  // Estado local para os dígitos e força de atualização
  const [digits, setDigits] = useState<number[]>([]);
  const [updateCounter, setUpdateCounter] = useState(0);
  
  // Força a atualização do componente
  const forceUpdate = () => setUpdateCounter(prev => prev + 1);
  
  useEffect(() => {
    console.log("[FORCE_UPDATE] Componente de dígitos montado");
    
    // Handler para eventos de tick
    const handleTick = (event: any) => {
      if (event.type === 'tick' && typeof event.lastDigit === 'number') {
        console.log("[FORCE_UPDATE] Tick recebido:", event.lastDigit);
        
        // Atualiza o estado com o novo dígito
        setDigits(prev => {
          const updated = [event.lastDigit, ...prev].slice(0, 20);
          console.log("[FORCE_UPDATE] Nova sequência de dígitos:", updated);
          return updated;
        });
        
        // Força uma renderização adicional
        forceUpdate();
      }
    };
    
    // Registrar e limpar o handler
    oauthDirectService.addEventListener(handleTick);
    
    return () => {
      console.log("[FORCE_UPDATE] Componente de dígitos desmontado");
      oauthDirectService.removeEventListener(handleTick);
    };
  }, []);
  
  // Função auxiliar para determinar a cor do dígito
  const getDigitColor = (digit: number) => {
    if (digit === 0 || digit === 5) {
      return "bg-[#fad75b] text-black"; // Amarelo
    } else if (digit % 2 === 0) {
      return "bg-[#ff444f] text-white"; // Vermelho
    } else {
      return "bg-[#00e5b3] text-black"; // Verde
    }
  };
  
  // Renderização
  return (
    <Card className="bg-[#162440] border-slate-800 shadow-md p-4">
      <div className="mb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">Símbolo</span>
          <span className="text-sm font-bold text-white">R_100</span>
        </div>
        <div className="h-px bg-slate-700/50 w-full my-2"></div>
      </div>
      
      <div className="flex justify-center mb-3">
        <div className="flex flex-wrap justify-center gap-2">
          {digits.length > 0 ? (
            digits.map((digit, index) => (
              <div
                key={`digit-${index}-${digit}-${updateCounter}`}
                className={`${getDigitColor(digit)} w-8 h-8 rounded-full flex items-center justify-center font-bold text-md shadow-md`}
              >
                {digit}
              </div>
            ))
          ) : (
            <div className="text-gray-400">Aguardando dígitos...</div>
          )}
        </div>
      </div>
      
      <div className="flex justify-center text-xs text-gray-400 pt-1">
        Últimos {digits.length} dígitos (forçado: {updateCounter})
      </div>
    </Card>
  );
}