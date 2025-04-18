import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface SimpleDigitDisplayProps {
  digits: number[];
  symbol?: string;
}

export function SimpleDigitDisplay({ digits, symbol = "R_100" }: SimpleDigitDisplayProps) {
  const getDigitColor = (digit: number) => {
    if (digit === 0 || digit === 5) {
      return "bg-[#fad75b] text-black"; // Amarelo
    } else if (digit % 2 === 0) {
      return "bg-[#ff444f] text-white"; // Vermelho
    } else {
      return "bg-[#00e5b3] text-black"; // Verde
    }
  };

  return (
    <Card className="bg-[#162440] border-slate-800 shadow-md p-4">
      <div className="mb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">Símbolo</span>
          <span className="text-sm font-bold text-white">{symbol}</span>
        </div>
        <div className="h-px bg-slate-700/50 w-full my-2"></div>
      </div>
      
      <div className="flex justify-center mb-3">
        <div className="flex flex-wrap justify-center gap-2">
          {digits.slice(0, 20).map((digit, index) => (
            <div
              key={index}
              className={`${getDigitColor(digit)} w-8 h-8 rounded-full flex items-center justify-center font-bold text-md shadow-md`}
            >
              {digit}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-center text-xs text-gray-400 pt-1">
        Últimos 20 dígitos
      </div>
    </Card>
  );
}