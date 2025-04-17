import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tickCache } from '@/lib/tickCache';
import derivAPI from '@/lib/derivApi';

// Componente simplificado para resolver o problema
export default function DigitDisplay({ symbol = 'R_100' }: { symbol?: string }) {
  const [digits, setDigits] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Carregar dados da API
        const response = await derivAPI.send({
          ticks_history: symbol,
          count: 30,
          end: "latest",
          style: "ticks"
        });
        
        if (response && response.history && response.history.prices) {
          // Extrair dígitos
          const extractedDigits = response.history.prices.map((price: number) => 
            Math.floor(price * 100) % 10
          );
          
          // Atualizar estado
          setDigits(extractedDigits);
          
          // Salvar no cache
          response.history.prices.forEach((price: number, index: number) => {
            const time = new Date(response.history.times[index] * 1000);
            tickCache.addTick(symbol, price, time);
          });
          
          setLoading(false);
        } else {
          throw new Error("Formato de resposta inválido");
        }
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
        setError("Erro ao carregar dados");
        setLoading(false);
      }
    };

    // Atualizar o componente quando receber novos ticks
    const handleTickUpdate = (event: any) => {
      if (event.detail && event.detail.tick && event.detail.tick.symbol === symbol) {
        const tickValue = event.detail.tick.quote;
        const lastDigit = Math.floor(tickValue * 100) % 10;
        
        // Atualizar a lista de dígitos
        setDigits(prev => {
          const updated = [...prev, lastDigit];
          return updated.slice(-30); // Manter apenas os últimos 30
        });
      }
    };

    // Registrar ouvinte e buscar dados iniciais
    document.addEventListener('deriv:tick', handleTickUpdate);
    fetchInitialData();
    
    // Inscrever para ticks
    derivAPI.subscribeTicks(symbol)
      .catch(err => console.error("Erro ao subscrever ticks:", err));
    
    // Limpeza
    return () => {
      document.removeEventListener('deriv:tick', handleTickUpdate);
      derivAPI.unsubscribeTicks(symbol)
        .catch(err => console.error("Erro ao cancelar assinatura:", err));
    };
  }, [symbol]);

  return (
    <Card className="bg-[#162440] border-slate-800">
      <CardHeader className="bg-[#1a2b49] py-1 px-3">
        <CardTitle className="text-xs font-medium text-white">
          Índice Volatilidade 100 (Últimos 30 Dígitos)
        </CardTitle>
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
                const isRepetition = idx > 0 && digit === digits[idx-1];
                return (
                  <div
                    key={`digit-display-${idx}`}
                    className="w-8 h-8 flex items-center justify-center text-white text-base font-bold"
                    style={{
                      backgroundColor: digit >= 5 ? 'rgba(74, 222, 128, 0.9)' : 'rgba(248, 113, 113, 0.9)',
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