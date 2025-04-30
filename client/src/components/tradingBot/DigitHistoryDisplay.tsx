import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { derivHistoryService, DigitHistoryData } from "@/services/deriv-history-service";

interface DigitHistoryDisplayProps {
  symbol?: string;
  title?: string;
  showCount?: number;
  className?: string;
}

/**
 * Componente para exibir o histórico de dígitos de um símbolo específico
 */
export default function DigitHistoryDisplay({
  symbol = "R_100",
  title = "Histórico de Dígitos",
  showCount = 500,
  className = "",
}: DigitHistoryDisplayProps) {
  const [digits, setDigits] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tabView, setTabView] = useState("grid");

  // Carregar o histórico de dígitos
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const loadHistory = async () => {
      try {
        // Solicitar histórico com 500 ticks para o símbolo R_100
        await derivHistoryService.getTicksHistory(symbol, 500, true);
        
        // Obter o histórico atualizado
        const historyData = derivHistoryService.getDigitStats(symbol);
        
        if (isMounted && historyData && historyData.lastDigits) {
          setDigits(historyData.lastDigits.slice(0, showCount));
          setIsLoading(false);
        }
      } catch (error) {
        console.error("[DigitHistoryDisplay] Erro ao carregar histórico:", error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadHistory();

    // Configurar listener para atualizações contínuas
    const handleHistoryUpdate = (data: DigitHistoryData) => {
      if (isMounted && data && data.lastDigits) {
        setDigits(data.lastDigits.slice(0, showCount));
      }
    };

    derivHistoryService.addListener(handleHistoryUpdate);

    return () => {
      isMounted = false;
      derivHistoryService.removeListener(handleHistoryUpdate);
    };
  }, [symbol, showCount]);

  // Renderizar um dígito com o fundo colorido de acordo com seu valor
  const renderDigit = (digit: number, index: number) => {
    // Cores para os dígitos (0-9)
    const digitColors = [
      "bg-blue-500", // 0 - azul
      "bg-green-500", // 1 - verde
      "bg-red-500", // 2 - vermelho
      "bg-purple-500", // 3 - roxo
      "bg-yellow-500", // 4 - amarelo
      "bg-pink-500", // 5 - rosa
      "bg-teal-500", // 6 - turquesa
      "bg-orange-500", // 7 - laranja
      "bg-indigo-500", // 8 - índigo
      "bg-gray-500", // 9 - cinza
    ];

    return (
      <div
        key={`digit-${index}`}
        className={`flex items-center justify-center ${digitColors[digit]} text-white font-bold rounded-md w-8 h-8 m-1 text-center`}
      >
        {digit}
      </div>
    );
  };

  // Renderizar os dígitos como uma lista linear
  const renderLinearHistory = () => {
    return (
      <div className="flex flex-wrap justify-start mt-4">
        {digits.map((digit, index) => renderDigit(digit, index))}
      </div>
    );
  };

  // Renderizar os dígitos como uma grid 10x10
  const renderGridHistory = () => {
    const rows = [];
    for (let i = 0; i < Math.min(digits.length, 500) / 10; i++) {
      const rowDigits = digits.slice(i * 10, (i + 1) * 10);
      rows.push(
        <div key={`row-${i}`} className="flex justify-center my-1">
          {rowDigits.map((digit, index) => renderDigit(digit, i * 10 + index))}
        </div>
      );
    }
    return <div className="mt-4">{rows}</div>;
  };

  // Renderizar estatísticas dos dígitos
  const renderDigitStats = () => {
    const digitStats: { [key: number]: number } = {};
    for (let i = 0; i <= 9; i++) {
      digitStats[i] = 0;
    }

    digits.forEach((digit) => {
      digitStats[digit]++;
    });

    return (
      <div className="grid grid-cols-5 gap-4 mt-4">
        {Object.entries(digitStats).map(([digit, count]) => {
          const percentage = digits.length > 0 ? (count / digits.length) * 100 : 0;
          return (
            <div
              key={`stat-${digit}`}
              className="text-center p-2 bg-[#0e1a33] rounded-md border border-[#1c3654]"
            >
              <div className={`text-2xl font-bold ${count > 0 ? "text-[#00e5b3]" : "text-gray-400"}`}>
                {digit}
              </div>
              <div className="text-sm text-[#8492b4]">
                {count} ({percentage.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card className={`bg-[#162440] rounded-lg border border-[#1c3654] ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center text-white">
          <span className="mr-2">🔢</span>
          {title}
          <span className="ml-2 text-sm text-[#8492b4] font-normal">
            ({isLoading ? "Carregando..." : `${digits.length} ticks`})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue="grid"
          value={tabView}
          onValueChange={setTabView}
          className="w-full"
        >
          <TabsList className="grid grid-cols-3 bg-[#0e1a33]">
            <TabsTrigger value="grid" className="text-sm">
              Grade
            </TabsTrigger>
            <TabsTrigger value="linear" className="text-sm">
              Linear
            </TabsTrigger>
            <TabsTrigger value="stats" className="text-sm">
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="grid" className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-[#8492b4]">
                Carregando histórico de dígitos...
              </div>
            ) : digits.length === 0 ? (
              <div className="text-center py-12 text-[#8492b4]">
                Nenhum dado histórico disponível. Por favor, aguarde...
              </div>
            ) : (
              renderGridHistory()
            )}
          </TabsContent>

          <TabsContent value="linear" className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-[#8492b4]">
                Carregando histórico de dígitos...
              </div>
            ) : digits.length === 0 ? (
              <div className="text-center py-12 text-[#8492b4]">
                Nenhum dado histórico disponível. Por favor, aguarde...
              </div>
            ) : (
              renderLinearHistory()
            )}
          </TabsContent>

          <TabsContent value="stats" className="pt-4">
            {isLoading ? (
              <div className="text-center py-12 text-[#8492b4]">
                Carregando estatísticas...
              </div>
            ) : digits.length === 0 ? (
              <div className="text-center py-12 text-[#8492b4]">
                Nenhum dado disponível para análise.
              </div>
            ) : (
              renderDigitStats()
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}