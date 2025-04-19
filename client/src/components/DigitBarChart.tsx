import React from 'react';

interface DigitBarChartProps {
  statistics: {
    digit: number;
    count: number;
    percentage: number;
  }[];
  totalCount: number;
  className?: string;
  recentDigits?: number[]; // Para mostrar os últimos 10 dígitos
}

export function DigitBarChart({ 
  statistics, 
  totalCount, 
  className = "", 
  recentDigits = [] 
}: DigitBarChartProps) {
  // Cores para barras com alta frequência (20% ou mais)
  const highFrequencyColor = "#ff3232"; // Vermelho
  
  // Cores para barras com baixa frequência
  const lowFrequencyColors = {
    even: "#2a405a", // Azul escuro para dígitos pares
    odd: "#896746"   // Marrom para dígitos ímpares
  };
  
  // Pegar apenas os últimos 10 dígitos para exibir
  const lastDigits = recentDigits.slice(0, 10);
  
  return (
    <div className={`rounded-md overflow-hidden ${className}`}>
      <div className="p-3 bg-[#0e1a2e] rounded-t-md border-b border-gray-800">
        <h3 className="font-medium text-white">Gráfico de barras</h3>
      </div>
      
      <div className="bg-[#0e1a2e] p-4 pb-0">
        {/* Área do gráfico */}
        <div className="relative h-[200px] flex items-end justify-between px-2">
          {/* Linhas de grade horizontais */}
          <div className="absolute w-full h-full flex flex-col justify-between">
            {[0, 10, 20, 30, 40, 50].map(value => (
              <div 
                key={value}
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
          {statistics.map(stat => {
            // Determinar a cor baseada na frequência
            let barColor = stat.percentage >= 20 
              ? highFrequencyColor 
              : (stat.digit % 2 === 0 ? lowFrequencyColors.even : lowFrequencyColors.odd);
            
            return (
              <div key={stat.digit} className="flex flex-col items-center w-8 z-10">
                {/* Barra com altura proporcional à porcentagem */}
                <div 
                  className="w-full rounded-t transition-all duration-300 ease-in-out flex justify-center"
                  style={{ 
                    height: `${(stat.percentage / 50) * 100}%`,
                    backgroundColor: barColor
                  }}
                >
                  {/* Mostrar percentual acima da barra se for significativo */}
                  {stat.percentage > 0 && (
                    <span className="text-white text-xs font-bold -mt-5">
                      {stat.percentage}%
                    </span>
                  )}
                </div>
                
                {/* Dígito abaixo da barra */}
                <div className="mt-2 bg-[#0e1a2e] w-full text-center text-white">
                  {stat.digit}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Seção de dígitos sequenciais abaixo do gráfico */}
      <div className="bg-[#0e1a2e] p-4 flex justify-center">
        <div className="flex space-x-1 overflow-x-auto text-white text-xs font-mono">
          {lastDigits.map((digit, index) => (
            <div 
              key={index} 
              className={`w-7 h-7 flex items-center justify-center border border-gray-700 rounded transition-all 
                ${index === 0 ? 'bg-primary border-primary' : ''}`}
            >
              {digit}
            </div>
          ))}
        </div>
      </div>
      
      <div className="p-2 bg-[#0e1a2e] text-xs text-gray-400 text-center">
        Análise baseada nos últimos {totalCount} dígitos
      </div>
    </div>
  );
}