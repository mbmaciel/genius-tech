import React, { useState, useEffect } from 'react';
import derivAPI from '@/lib/derivApi';

interface SimpleDigitStatsProps {
  symbol: string;
  compact?: boolean;
}

export default function SimpleDigitStats({ symbol, compact = false }: SimpleDigitStatsProps) {
  const [lastResults, setLastResults] = useState<Array<{ digit: number, isLow: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscribeToSymbol = async () => {
      try {
        await derivAPI.subscribeToTicks(symbol);
        setIsLoading(false);
      } catch (error) {
        console.error(`Failed to subscribe to ${symbol}:`, error);
        setIsLoading(false);
      }
    };
    
    const getDigitFromTick = (tick: number): number => {
      return Math.floor(tick * 10) % 10;
    };
    
    const handleTick = (event: CustomEvent) => {
      const tickData = event.detail;
      const price = tickData.quote;
      const lastDigit = getDigitFromTick(price);
      
      setLastResults(prev => {
        const newResults = [...prev];
        newResults.unshift({
          digit: lastDigit,
          isLow: lastDigit < 5
        });
        return newResults.slice(0, compact ? 6 : 10);
      });
    };
    
    // Subscribe to ticks and set up event listener
    subscribeToSymbol();
    document.addEventListener('deriv:tick' as any, handleTick as any);
    
    return () => {
      document.removeEventListener('deriv:tick' as any, handleTick as any);
      derivAPI.cancelSubscription(`tick_${symbol}`);
    };
  }, [symbol, compact]);

  if (isLoading) {
    return (
      <div className="flex justify-center">
        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-[#00e5b3] border-r-2 border-b-2 border-transparent"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {lastResults.length > 0 ? (
        lastResults.map((result, index) => (
          <div 
            key={index} 
            className={`${compact ? 'w-6 h-6' : 'w-8 h-8'} rounded-full flex items-center justify-center text-xs font-medium text-white ${
              result.isLow ? 'bg-[#4caf50]' : 'bg-[#ff5252]'
            }`}
          >
            {result.digit}
          </div>
        ))
      ) : (
        <div className="text-xs text-[#8492b4]">Aguardando resultados...</div>
      )}
    </div>
  );
}
