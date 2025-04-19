import React, { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { oauthDirectService } from "@/services/oauthDirectService";

interface DigitBarChartProps {
  symbol?: string;
  className?: string;
}

export function DigitBarChart({ symbol = 'R_100', className = '' }: DigitBarChartProps) {
  // Estado para armazenar os dígitos históricos (até 500)
  const [digits, setDigits] = useState<number[]>([]);
  
  // Estado para armazenar a contagem e porcentagem de cada dígito
  const [digitStats, setDigitStats] = useState<{
    digit: number;
    count: number;
    percentage: number;
    color: string;
  }[]>(Array.from({ length: 10 }, (_, i) => ({
    digit: i,
    count: 0,
    percentage: 0,
    color: getDigitColor(i)
  })));
  
  // Quantidade de ticks a serem considerados para o cálculo (25, 50, 100, 200, 250, 500)
  const [ticksCount, setTicksCount] = useState<string>("50");
  
  // Referência para verificar se o componente está montado
  const isMounted = useRef(true);

  // Últimos dígitos mostrados na sequência abaixo do gráfico
  const [lastSequence, setLastSequence] = useState<number[]>([]);

  // Função para determinar a cor do dígito
  function getDigitColor(digit: number): string {
    // Vermelho para dígitos ímpares (1, 3, 5, 7, 9)
    if (digit % 2 !== 0) {
      return '#F43F5E'; // Vermelho
    }
    // Verde para dígitos pares (0, 2, 4, 6, 8)
    return '#10B981'; // Verde
  }
  
  // Função para buscar o histórico dos últimos 500 ticks
  const fetchTicksHistory = async () => {
    try {
      console.log('[DigitBarChart] Solicitando histórico de 500 ticks para', symbol);
      
      // Usar o serviço OAuth direto para solicitar o histórico de ticks
      const history = await oauthDirectService.getTicksHistory(symbol, 500);
      
      if (history && history.history && Array.isArray(history.history.prices)) {
        // Extrair apenas o último dígito de cada preço
        const historyDigits = history.history.prices.map((price: number) => {
          // Converter para string, pegar o último caractere e converter de volta para número
          const priceStr = price.toString();
          return parseInt(priceStr.charAt(priceStr.length - 1));
        });
        
        console.log(`[DigitBarChart] Histórico recebido com ${historyDigits.length} ticks para ${symbol}`);
        
        if (isMounted.current) {
          setDigits(historyDigits);
          updateDigitStats(historyDigits, parseInt(ticksCount));
          // Atualizar a sequência de dígitos (últimos 15 dígitos, do mais recente para o mais antigo)
          setLastSequence(historyDigits.slice(0, 15).reverse());
        }
      } else {
        console.error('[DigitBarChart] Formato de histórico inválido:', history);
      }
    } catch (error) {
      console.error('[DigitBarChart] Erro ao buscar histórico de ticks:', error);
    }
  };

  // Função para atualizar as estatísticas dos dígitos
  const updateDigitStats = (allDigits: number[], count: number) => {
    // Pegar apenas a quantidade de dígitos selecionada
    const selectedDigits = allDigits.slice(0, count);
    
    // Inicializar contagens para cada dígito (0-9)
    const digitCounts = Array(10).fill(0);
    
    // Contar a frequência de cada dígito
    selectedDigits.forEach(digit => {
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    });
    
    // Total de dígitos analisados
    const totalDigits = selectedDigits.length;
    
    // Atualizar as estatísticas
    const updatedStats = digitCounts.map((count, digit) => {
      const percentage = totalDigits > 0 ? Math.round((count / totalDigits) * 100) : 0;
      return {
        digit,
        count,
        percentage,
        color: getDigitColor(digit)
      };
    });
    
    setDigitStats(updatedStats);
  };
  
  // Efeito para buscar o histórico de ticks quando o componente montar
  useEffect(() => {
    fetchTicksHistory();
    
    // Limpar quando o componente desmontar
    return () => {
      isMounted.current = false;
    };
  }, [symbol]);
  
  // Atualizar as estatísticas quando a quantidade de ticks mudar
  useEffect(() => {
    if (digits.length > 0) {
      updateDigitStats(digits, parseInt(ticksCount));
    }
  }, [ticksCount, digits]);
  
  // Efeito para assinar eventos de ticks em tempo real
  useEffect(() => {
    // Função para tratar novos ticks
    const handleTick = (event: CustomEvent) => {
      const tickData = event.detail;
      
      // Verificar se o tick é para o símbolo que estamos monitorando
      if (tickData && tickData.symbol === symbol) {
        // Extrair o último dígito do preço
        const price = tickData.quote.toString();
        const lastDigit = parseInt(price.charAt(price.length - 1));
        
        // Adicionar o novo dígito ao início do array
        setDigits(prevDigits => {
          const newDigits = [lastDigit, ...prevDigits].slice(0, 500);
          updateDigitStats(newDigits, parseInt(ticksCount));
          
          // Atualizar a sequência de dígitos
          setLastSequence(newDigits.slice(0, 15).reverse());
          
          return newDigits;
        });
      }
    };
    
    // Registrar listener para ticks
    window.addEventListener('tick', handleTick as EventListener);
    
    // Assinar para receber ticks
    oauthDirectService.subscribeToTicks(symbol);
    
    // Limpar listener quando o componente desmontar
    return () => {
      window.removeEventListener('tick', handleTick as EventListener);
    };
  }, [symbol, ticksCount]);
  
  return (
    <div className={`rounded-lg p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Gráfico de barras</h2>
        <Select value={ticksCount} onValueChange={setTicksCount}>
          <SelectTrigger className="bg-[#1d2a45] border-[#3a4b6b] text-white h-8 text-xs w-24">
            <SelectValue>{ticksCount} Ticks</SelectValue>
          </SelectTrigger>
          <SelectContent className="bg-[#1d2a45] border-[#3a4b6b] text-white">
            <SelectItem value="25">25 Ticks</SelectItem>
            <SelectItem value="50">50 Ticks</SelectItem>
            <SelectItem value="100">100 Ticks</SelectItem>
            <SelectItem value="200">200 Ticks</SelectItem>
            <SelectItem value="250">250 Ticks</SelectItem>
            <SelectItem value="500">500 Ticks</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Legenda */}
      <div className="flex items-center mb-3">
        <div className="h-2 w-8 bg-[#10B981] mr-2"></div>
        <span className="text-xs text-white mr-4">Últimos {ticksCount} Dígitos (%)</span>
      </div>
      
      {/* Gráfico de barras */}
      <div className="relative h-56">
        {digitStats.map((stat) => (
          <div key={stat.digit} className="flex flex-col items-center absolute" style={{ 
            left: `${stat.digit * 10}%`, 
            width: '10%', 
            bottom: 0, 
            height: '100%' 
          }}>
            {/* Valor percentual sobre a barra */}
            <div className="text-white text-xs mb-1">{stat.percentage > 0 ? `${stat.percentage}%` : ''}</div>
            
            {/* Barra */}
            <div 
              className="w-full rounded-t"
              style={{ 
                height: `${Math.max(5, stat.percentage)}%`, 
                backgroundColor: stat.color,
                maxHeight: '85%' // Limitar altura máxima
              }}
            />
            
            {/* Dígito abaixo da barra */}
            <div className="text-white mt-2">{stat.digit}</div>
          </div>
        ))}
      </div>
      
      {/* Sequência de últimos dígitos */}
      <div className="mt-6 p-2 border border-[#3a4b6b] rounded flex justify-center overflow-x-auto">
        {lastSequence.map((digit, index) => (
          <div 
            key={index} 
            className="w-8 h-8 flex items-center justify-center text-white mx-1 rounded"
            style={{ backgroundColor: getDigitColor(digit) }}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
}