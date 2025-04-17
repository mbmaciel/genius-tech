import React, { useState, useEffect } from 'react';
import derivAPI from '@/lib/derivApi';
import { Skeleton } from '@/components/ui/skeleton';

interface DigitResult {
  digit: number;
  color: string;
}

interface DigitDistribution {
  digit: number;
  percentage: number;
  count: number;
  highlight: boolean;
}

interface DigitStatsProps {
  symbol: string;
}

export default function DigitStats({ symbol }: DigitStatsProps) {
  const [lastDigits, setLastDigits] = useState<DigitResult[]>([]);
  const [distribution, setDistribution] = useState<DigitDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTrend, setCurrentTrend] = useState<{
    trend: 'OVER' | 'UNDER' | 'NEUTRAL';
    confidence: number;
    repeatingDigit: number | null;
    cycleCount: number;
  }>({
    trend: 'NEUTRAL',
    confidence: 0,
    repeatingDigit: null,
    cycleCount: 0
  });

  useEffect(() => {
    const historySize = 100; // Number of ticks to analyze
    let tickHistory: number[] = [];
    
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
    
    const getDigitColor = (digit: number): string => {
      return digit < 5 ? '#4caf50' : '#ff5252'; // Green for 0-4, Red for 5-9
    };
    
    const updateDistribution = (history: number[]) => {
      const counts = Array(10).fill(0);
      history.forEach(digit => {
        counts[digit]++;
      });
      
      // Calculate highest frequency digit
      let highestFreq = 0;
      let highestDigit = 0;
      
      counts.forEach((count, digit) => {
        if (count > highestFreq) {
          highestFreq = count;
          highestDigit = digit;
        }
      });
      
      // Map to distribution format
      const dist = counts.map((count, digit) => {
        const percentage = history.length > 0 
          ? Math.round((count / history.length) * 100) 
          : 0;
        
        return {
          digit,
          count,
          percentage,
          highlight: digit === highestDigit
        };
      });
      
      setDistribution(dist);
      
      // Analyze trend
      const lowCount = history.filter(d => d < 5).length;
      const highCount = history.length - lowCount;
      const overPercentage = Math.round((highCount / history.length) * 100);
      const underPercentage = Math.round((lowCount / history.length) * 100);
      
      // Check for a repeating digit pattern
      let repeatingDigit = null;
      let maxCount = 0;
      counts.forEach((count, digit) => {
        if (count > maxCount) {
          maxCount = count;
          repeatingDigit = digit;
        }
      });
      
      // Calculate the confidence of the trend
      const trend = overPercentage > underPercentage ? 'OVER' : 'UNDER';
      const confidence = trend === 'OVER' ? overPercentage : underPercentage;
      
      // Calculate the cycle count (how many recent occurrences of the digit)
      const lastOccurrences = history.filter(d => d === repeatingDigit).length;
      
      setCurrentTrend({
        trend: confidence > 60 ? trend : 'NEUTRAL',
        confidence,
        repeatingDigit,
        cycleCount: lastOccurrences
      });
    };
    
    const handleTick = (event: CustomEvent) => {
      const tickData = event.detail;
      const price = tickData.quote;
      const lastDigit = getDigitFromTick(price);
      
      // Add to history
      tickHistory = [lastDigit, ...tickHistory].slice(0, historySize);
      
      // Add to last digits display
      setLastDigits(prev => {
        const newDigits = [...prev];
        newDigits.unshift({
          digit: lastDigit,
          color: getDigitColor(lastDigit)
        });
        return newDigits.slice(0, 10); // Keep only 10 most recent
      });
      
      // Update distribution
      updateDistribution(tickHistory);
    };
    
    // Subscribe to ticks and set up event listener
    subscribeToSymbol();
    document.addEventListener('deriv:tick' as any, handleTick as any);
    
    return () => {
      document.removeEventListener('deriv:tick' as any, handleTick as any);
      derivAPI.cancelSubscription(`tick_${symbol}`);
    };
  }, [symbol]);
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {Array(10).fill(0).map((_, index) => (
            <Skeleton key={index} className="w-8 h-8 rounded-full bg-[#1f3158]" />
          ))}
        </div>
        
        <div className="grid grid-cols-5 gap-2">
          {Array(10).fill(0).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-md bg-[#1f3158]" />
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Last Results */}
      <div className="flex flex-wrap gap-2 mb-4">
        {lastDigits.length > 0 ? (
          lastDigits.map((result, index) => (
            <div 
              key={index} 
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: result.color }}
            >
              {result.digit}
            </div>
          ))
        ) : (
          <div className="text-sm text-[#8492b4]">Aguardando resultados...</div>
        )}
      </div>
      
      {/* Digit Distribution Grid */}
      <div className="grid grid-cols-5 gap-2">
        {distribution.map((item) => (
          <div 
            key={item.digit}
            className={`digit-cell bg-[#0e1a33]/50 border ${item.highlight ? 'border-[#00e5b3] bg-[#00e5b3]/20' : 'border-[#1c3654]'} rounded-md p-2 text-center`}
          >
            <div className="text-lg font-bold">{item.digit}</div>
            <div className="text-xs mt-1">{item.percentage}%</div>
            <div className="w-full bg-gray-700 h-1 mt-1 rounded-full overflow-hidden">
              <div 
                className="bg-[#00e5b3] h-full" 
                style={{ width: `${item.percentage}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Pattern Analysis */}
      <div className="bg-[#0e1a33]/50 p-3 rounded-md border border-[#1c3654]">
        <h3 className="text-sm font-medium mb-2">Análise de Padrões</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs">Tendência Atual</span>
            <span className={`text-xs font-medium ${
              currentTrend.trend === 'OVER' ? 'text-[#ff5252]' : 
              currentTrend.trend === 'UNDER' ? 'text-[#4caf50]' : 'text-white'
            }`}>
              {currentTrend.trend} ({currentTrend.confidence}%)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Dígito Tendência</span>
            <span className="text-xs font-medium">
              {currentTrend.repeatingDigit !== null ? `${currentTrend.repeatingDigit} (${distribution[currentTrend.repeatingDigit]?.percentage || 0}%)` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs">Repetição</span>
            <span className="text-xs font-medium">{currentTrend.cycleCount}º ciclo</span>
          </div>
        </div>
      </div>
    </div>
  );
}
