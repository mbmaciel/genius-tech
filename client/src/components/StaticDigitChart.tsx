import React, { useState, useEffect } from 'react';

interface Stat {
  digit: number;
  count: number;
  percentage: number;
}

// Componente de gráfico independente sem integrações externas
export function StaticDigitChart({ className = "" }: { className?: string }) {
  const [stats, setStats] = useState<Stat[]>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [totalSamples, setTotalSamples] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Função para simular dados
  const generateRandomData = () => {
    // Array para armazenar contagem de cada dígito (0-9)
    const counts: Record<number, number> = {};
    // Gerar uma amostra inicial aleatória
    const totalSamplesCount = 500;
    const sampleDigits: number[] = [];

    // Inicializa contadores
    for (let i = 0; i < 10; i++) {
      counts[i] = 0;
    }

    // Gera dados aleatórios com uma distribuição mais realista
    for (let i = 0; i < totalSamplesCount; i++) {
      // Gerar um número aleatório entre 0 e 9
      const digit = Math.floor(Math.random() * 10);
      counts[digit]++;
      
      // Manter apenas os últimos 10 dígitos para exibição
      if (sampleDigits.length >= 500) {
        sampleDigits.shift();
      }
      sampleDigits.push(digit);
    }

    // Calcular percentuais
    const newStats = Object.keys(counts).map(digit => {
      const count = counts[parseInt(digit)];
      return {
        digit: parseInt(digit),
        count,
        percentage: Math.round((count / totalSamplesCount) * 100)
      };
    });

    // Atualizar estado
    setStats(newStats);
    setLastDigits(sampleDigits.slice(-10).reverse());
    setTotalSamples(totalSamplesCount);
    setIsLoading(false);
    
    // Incrementar chave para forçar re-renderização
    setRefreshKey(prev => prev + 1);
  };

  // Função para atualizar com novo dígito
  const addNewDigit = () => {
    // Gerar um novo dígito aleatório
    const newDigit = Math.floor(Math.random() * 10);
    
    // Atualizar histórico
    const newDigits = [...lastDigits.slice(0, -1)];
    newDigits.unshift(newDigit);
    setLastDigits(newDigits);
    
    // Atualizar contagem e percentual
    const newStats = [...stats];
    const digitObj = newStats.find(s => s.digit === newDigit);
    if (digitObj) {
      digitObj.count++;
      
      // Recalcular percentuais
      const total = totalSamples + 1;
      setTotalSamples(total);
      
      newStats.forEach(stat => {
        stat.percentage = Math.round((stat.count / total) * 100);
      });
      
      setStats([...newStats]);
      
      // Forçar atualização visual
      setRefreshKey(prev => prev + 1);
      
      console.log(`Novo dígito: ${newDigit}, Estatísticas:`, 
        newStats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
    }
  };

  // Gera dados iniciais
  useEffect(() => {
    // Gerar dados iniciais
    generateRandomData();
    
    // Configurar atualização periódica
    const interval = setInterval(() => {
      addNewDigit();
    }, 2000); // Atualiza a cada 2 segundos
    
    // Limpar intervalo ao desmontar
    return () => clearInterval(interval);
  }, []);

  // Renderização do componente
  return (
    <div className={`bg-[#0e1a2e] rounded-lg overflow-hidden shadow-lg ${className}`}>
      {/* Cabeçalho */}
      <div className="p-3 bg-[#0e1a2e] border-b border-[#232e47] flex justify-between items-center">
        <h3 className="font-medium text-white">
          <span className="text-[#3a96dd]">R_100:</span> Análise de Dígitos
          {isLoading && <span className="ml-2 text-xs text-gray-400">Carregando...</span>}
        </h3>
        <div className="bg-[#ff3e50] px-2 py-0.5 text-xs text-white font-medium rounded-sm">
          Últimos 10 Dígitos (%)
        </div>
      </div>
      
      {/* Gráfico principal */}
      <div className="p-4">
        {/* Gráfico de barras */}
        <div className="flex items-end h-52 mb-8 relative">
          {/* Eixo Y (percentuais) */}
          <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 pr-2">
            <div>50%</div>
            <div>40%</div>
            <div>30%</div>
            <div>20%</div>
            <div>10%</div>
            <div>0%</div>
          </div>
          
          {/* Linhas de grade */}
          <div className="absolute left-8 right-0 top-0 bottom-0 flex flex-col justify-between">
            {[0, 1, 2, 3, 4, 5].map((line) => (
              <div 
                key={`line-${line}-${refreshKey}`}
                className="w-full border-t border-[#2a3756] h-0"
              />
            ))}
          </div>
          
          {/* Barras para dígitos */}
          <div className="flex justify-between items-end w-full pl-8">
            {stats.map((stat) => {
              // Escala visual para percentuais típicos (~10-15%)
              const barHeight = Math.max(8, (stat.percentage / 5) * 100);
              const barColor = stat.digit % 2 === 0 ? '#00e5b3' : '#ff444f';
              
              return (
                <div 
                  key={`bar-${stat.digit}-${refreshKey}`} 
                  className="flex flex-col items-center w-full"
                >
                  {/* Percentual acima da barra */}
                  <div className="text-xs font-bold text-white mb-1">
                    {stat.percentage}%
                  </div>
                  
                  {/* A barra em si */}
                  <div 
                    style={{
                      backgroundColor: barColor,
                      height: `${barHeight}%`,
                      width: '100%',
                      maxWidth: '30px',
                      borderRadius: '2px 2px 0 0'
                    }}
                  />
                  
                  {/* Dígito abaixo da barra */}
                  <div className="mt-2 text-sm font-medium text-white">
                    {stat.digit}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Sequência de dígitos recentes */}
        <div className="mt-4 flex justify-center">
          <div className="bg-[#0c1625] border border-[#2a3756] rounded-md flex items-center px-2 py-1 space-x-2">
            {lastDigits.map((digit, index) => (
              <div 
                key={`recent-${index}-${digit}-${refreshKey}`}
                className={`w-6 h-6 flex items-center justify-center ${
                  digit % 2 === 0 ? 'text-[#00e5b3]' : 'text-[#ff444f]'
                } font-medium text-base`}
              >
                {digit}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Rodapé */}
      <div className="px-4 py-2 bg-[#0c1625] text-xs text-gray-400 border-t border-[#232e47]">
        <div className="flex justify-between items-center">
          <div>
            Baseado em {totalSamples} amostras (demo)
          </div>
          <div className="text-[#3a96dd]">
            Atualização #{refreshKey}
          </div>
        </div>
      </div>
    </div>
  );
}