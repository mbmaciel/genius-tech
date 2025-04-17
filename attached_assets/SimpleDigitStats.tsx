import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import derivAPI from '@/lib/derivApi';

export default function SimpleDigitStats() {
  const [digits, setDigits] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const symbol = 'R_100';

  useEffect(() => {
    const fetchDigits = async () => {
      try {
        setLoading(true);
        
        // Fazer uma solicitação direta para o histórico de ticks
        const response = await derivAPI.send({
          ticks_history: symbol,
          count: 30,
          end: "latest",
          style: "ticks"
        });
        
        if (response?.history?.prices) {
          // Extrair os últimos dígitos
          const extractedDigits = response.history.prices.map((price: number) => 
            Math.floor(price * 100) % 10
          );
          
          // Atualizar o estado com os dígitos
          setDigits(extractedDigits);
          setLoading(false);
        } else {
          throw new Error("Resposta inválida");
        }
      } catch (error) {
        console.error("Erro ao buscar dígitos:", error);
        setError("Erro ao buscar dígitos");
        setLoading(false);
      }
    };
    
    const handleTickReceived = (event: any) => {
      const data = event.detail;
      if (data?.tick?.symbol === symbol) {
        const price = data.tick.quote;
        const digit = Math.floor(price * 100) % 10;
        
        // Adicionar o novo dígito e manter apenas os últimos 30
        setDigits(prev => {
          const updated = [...prev, digit];
          return updated.slice(-30);
        });
      }
    };
    
    // Iniciar a consulta aos dígitos
    fetchDigits();
    
    // Subscrever aos ticks
    derivAPI.subscribeTicks(symbol).catch(err => 
      console.error("Erro ao subscrever ticks:", err)
    );
    
    // Escutar eventos de tick
    document.addEventListener('deriv:tick', handleTickReceived);
    
    // Limpar ao desmontar
    return () => {
      document.removeEventListener('deriv:tick', handleTickReceived);
      derivAPI.unsubscribeTicks(symbol).catch(err =>
        console.error("Erro ao cancelar assinatura:", err)
      );
    };
  }, []);

  return (
    <Card className="bg-[#162440] border-slate-800">
      <CardHeader className="bg-[#1a2b49] py-1 px-3">
        <CardTitle className="text-xs font-medium text-white">Índice Volatilidade 100</CardTitle>
      </CardHeader>
      <CardContent className="p-1.5">
        {loading ? (
          <div className="flex justify-center items-center h-8">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00e5b3]"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center text-xs">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex gap-px min-w-max">
              {digits.map((digit, idx) => {
                // Marcar repetições para identificação visual
                const isRepetition = idx > 0 && digit === digits[idx-1];
                
                return (
                  <div 
                    key={`simple-digit-${idx}`} 
                    className="w-8 h-8 flex items-center justify-center text-white text-base font-bold" 
                    style={{
                      backgroundColor: digit >= 5 ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)',
                      // Marcar dígitos repetidos com borda amarela
                      border: isRepetition ? '2px solid yellow' : 'none'
                    }}
                  >
                    {digit}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}