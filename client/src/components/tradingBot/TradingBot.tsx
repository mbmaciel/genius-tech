import React, { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import derivAPI from "@/lib/derivApi";
import { parseXMLStrategy } from "./StrategyParser";
import {
  Bot,
  Play,
  StopCircle,
  AlertCircle,
  FileText,
  BarChart2,
  Settings,
} from "lucide-react";

interface TradingBotProps {
  apiToken: string;
  isConnected: boolean;
  onError: (error: string) => void;
}

interface LogEntry {
  time: Date;
  message: string;
  type: "info" | "success" | "error" | "warning";
}

interface ContractResult {
  id: number;
  type: string;
  result: "won" | "lost" | "pending";
  profit: number;
  entry: number;
  exit?: number;
  time: Date;
}

export default function TradingBot({
  apiToken,
  isConnected,
  onError,
}: TradingBotProps) {
  // Strategy state
  const [selectedStrategy, setSelectedStrategy] = useState("ProfitPro");
  const [initialAmount, setInitialAmount] = useState("5");
  const [stopLoss, setStopLoss] = useState("50");
  const [takeProfit, setTakeProfit] = useState("25");
  const [martingaleMultiplier, setMartingaleMultiplier] = useState("2.0");
  const [maxMartingales, setMaxMartingales] = useState("5");
  const [timeframe, setTimeframe] = useState("1m");
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState("3");
  const [autoMode, setAutoMode] = useState(true);

  // Trading state
  const [isRunning, setIsRunning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [totalProfit, setTotalProfit] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [selectedSymbol, setSelectedSymbol] = useState("R_100");
  const [availableSymbols, setAvailableSymbols] = useState<
    Array<{ symbol: string; name: string }>
  >([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [contractResults, setContractResults] = useState<ContractResult[]>([]);

  // Refs
  const logContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Strategies options
  const strategies = [
    { id: "IRON_OVER", name: "IRON OVER" },
    { id: "IRON_UNDER", name: "IRON UNDER" },
    { id: "MAXPRO", name: "MAXPRO" },
    { id: "Green", name: "Green" },
    { id: "ProfitPro", name: "ProfitPro" },
  ];

  // Available timeframes
  const timeframes = [
    { id: "tick", name: "Tick 1" },
    { id: "1m", name: "1 minuto" },
    { id: "5m", name: "5 minutos" },
    { id: "15m", name: "15 minutos" },
  ];

  // Parse XML strategies
  useEffect(() => {
    // This function would parse XML strategies if we had them
    // For this implementation, we'll use a simplified approach
    const getAvailableStrategies = () => {
      try {
        const parsedStrategies = parseXMLStrategy();
        console.log("Parsed strategies:", parsedStrategies);
      } catch (error) {
        console.error("Error parsing strategies:", error);
        addLog("Erro ao carregar estratégias XML", "error");
      }
    };

    getAvailableStrategies();
  }, []);

  // Fetch available symbols
  useEffect(() => {
    const fetchSymbols = async () => {
      if (!isConnected) {
        setAvailableSymbols([
          { symbol: "R_10", name: "Volatilidade 10 (1s)" },
          { symbol: "R_25", name: "Volatilidade 25 (1s)" },
          { symbol: "R_50", name: "Volatilidade 50 (1s)" },
          { symbol: "R_75", name: "Volatilidade 75 (1s)" },
          { symbol: "R_100", name: "Volatilidade 100 (1s)" },
        ]);
        return;
      }

      try {
        const symbols = await derivAPI.getActiveSymbols();
        const volatilitySymbols = symbols
          .filter(
            (s) => s.market === "synthetic_index" && s.symbol.startsWith("R_"),
          )
          .map((s) => ({
            symbol: s.symbol,
            name: s.display_name,
          }));

        setAvailableSymbols(volatilitySymbols);
      } catch (error) {
        console.error("Error fetching symbols:", error);
        addLog("Erro ao buscar símbolos disponíveis", "error");
      }
    };

    fetchSymbols();
  }, [isConnected]);

  // Scroll to bottom when new log entries are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logEntries]);

  // Helper function to add log entries
  const addLog = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
  ) => {
    setLogEntries((prev) => [
      ...prev,
      {
        time: new Date(),
        message,
        type,
      },
    ]);
  };

  // Handle start trading
  const handleStartTrading = async () => {
    if (!isConnected) {
      toast({
        title: "Erro de Conexão",
        description:
          "Você precisa estar conectado à API Deriv para iniciar operações.",
        variant: "destructive",
      });
      return;
    }

    setIsBusy(true);

    try {
      // Clear previous results
      setTotalProfit(0);
      setWins(0);
      setLosses(0);
      setContractResults([]);

      // Start the bot
      setLogEntries([
        {
          time: new Date(),
          message: `Iniciando operações com estratégia ${selectedStrategy} em ${selectedSymbol}`,
          type: "info",
        },
      ]);

      // Subscribe to ticks
      await derivAPI.subscribeToTicks(selectedSymbol);
      addLog(
        `Inscrito com sucesso para receber ticks de ${selectedSymbol}`,
        "success",
      );

      // Set simulated data for UI state
      localStorage.setItem("trading_bot_running", "true");
      localStorage.setItem(
        "trading_bot_data",
        JSON.stringify({
          symbol: selectedSymbol,
          strategy: selectedStrategy,
          profitLoss: 0,
          winRate: 0,
          tradesCount: 0,
          startTime: Date.now(),
        }),
      );

      // Set trading as running
      setIsRunning(true);

      // Simulated initial purchase for demonstration
      setTimeout(() => {
        simulateTrade();
      }, 3000);
    } catch (error) {
      console.error("Error starting trading:", error);
      addLog(`Erro ao iniciar operações: ${error}`, "error");
      toast({
        title: "Erro",
        description:
          "Ocorreu um erro ao iniciar as operações. Verifique o log para mais detalhes.",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  };

  // Handle stop trading
  const handleStopTrading = async () => {
    setIsBusy(true);

    try {
      // Cancel subscriptions
      await derivAPI.cancelSubscription(`tick_${selectedSymbol}`);
      addLog("Operações interrompidas pelo usuário", "warning");

      // Clear simulated data
      localStorage.removeItem("trading_bot_running");
      localStorage.removeItem("trading_bot_data");

      // Set trading as stopped
      setIsRunning(false);

      toast({
        title: "Operações Interrompidas",
        description: "O robô de operações foi interrompido com sucesso.",
      });
    } catch (error) {
      console.error("Error stopping trading:", error);
      addLog(`Erro ao interromper operações: ${error}`, "error");
    } finally {
      setIsBusy(false);
    }
  };

  // Function to simulate trades for demonstration purposes
  const simulateTrade = () => {
    if (!isRunning) return;

    // Simulate a contract result
    const isWin = Math.random() > 0.4; // 60% win rate for demonstration
    const profit = isWin
      ? parseFloat(initialAmount) * 0.95
      : -parseFloat(initialAmount);

    // Add to results
    const newContract: ContractResult = {
      id: contractResults.length + 1,
      type: Math.random() > 0.5 ? "CALL" : "PUT",
      result: isWin ? "won" : "lost",
      profit: profit,
      entry: 5000 + Math.random() * 50,
      exit: 5000 + Math.random() * 50,
      time: new Date(),
    };

    setContractResults((prev) => [...prev, newContract]);

    // Update stats
    setTotalProfit((prev) => prev + profit);
    if (isWin) {
      setWins((prev) => prev + 1);
      addLog(
        `Operação #${contractResults.length + 1} encerrada com LUCRO: $${profit.toFixed(2)}`,
        "success",
      );
    } else {
      setLosses((prev) => prev + 1);
      addLog(
        `Operação #${contractResults.length + 1} encerrada com PREJUÍZO: $${Math.abs(profit).toFixed(2)}`,
        "error",
      );
    }

    // Update localStorage data
    const totalTrades = wins + losses + 1;
    const winRate =
      totalTrades > 0 ? ((isWin ? wins + 1 : wins) / totalTrades) * 100 : 0;

    localStorage.setItem(
      "trading_bot_data",
      JSON.stringify({
        symbol: selectedSymbol,
        strategy: selectedStrategy,
        profitLoss: totalProfit + profit,
        winRate: Math.round(winRate),
        tradesCount: totalTrades,
        startTime:
          JSON.parse(localStorage.getItem("trading_bot_data") || "{}")
            .startTime || Date.now(),
      }),
    );

    // Schedule next trade
    if (isRunning) {
      const delay = 5000 + Math.random() * 10000; // Random delay between 5-15 seconds
      setTimeout(() => {
        simulateTrade();
      }, delay);
    }
  };

  // Calculate win rate
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card className="bg-[#162440] rounded-lg p-6 border border-slate-800">
        <CardContent className="p-0 space-y-6">
          {/* Strategy Selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="col-span-1">
              <Label className="text-sm font-medium text-[#8492b4] mb-2 block">
                Selecione a Estratégia
              </Label>
              <Select
                value={selectedStrategy}
                onValueChange={setSelectedStrategy}
                disabled={isRunning || isBusy}
              >
                <SelectTrigger className="w-full bg-[#0e1a33] border border-[#1c3654] text-white">
                  <SelectValue placeholder="Selecione uma estratégia" />
                </SelectTrigger>
                <SelectContent className="bg-[#1f3158] border-[#1c3654] text-white">
                  {strategies.map((strategy) => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      {strategy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-1">
              <Label className="text-sm font-medium text-[#8492b4] mb-2 block">
                Valor Inicial
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={initialAmount}
                  onChange={(e) => setInitialAmount(e.target.value)}
                  min="1"
                  className="w-full bg-[#0e1a33] border border-[#1c3654] text-white"
                  disabled={isRunning || isBusy}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-[#8492b4]">USD</span>
                </div>
              </div>
            </div>

            <div className="col-span-1">
              <Label className="text-sm font-medium text-[#8492b4] mb-2 block">
                Stop Loss
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={stopLoss}
                  onChange={(e) => setStopLoss(e.target.value)}
                  min="1"
                  className="w-full bg-[#0e1a33] border border-[#1c3654] text-white"
                  disabled={isRunning || isBusy}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <span className="text-[#8492b4]">USD</span>
                </div>
              </div>
            </div>
          </div>

          {/* Strategy Parameters */}
          <div className="bg-[#0e1a33]/40 rounded-lg p-4 mb-6 border border-[#1c3654]">
            <h3 className="font-medium text-[#00e5b3] mb-3 flex items-center">
              <Settings className="h-4 w-4 mr-2" />
              Parâmetros da Estratégia
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Martingale
                </Label>
                <Select
                  value={martingaleMultiplier}
                  onValueChange={setMartingaleMultiplier}
                  disabled={isRunning || isBusy}
                >
                  <SelectTrigger className="w-full bg-[#0e1a33]/70 border border-[#1c3654] text-white text-sm">
                    <SelectValue placeholder="Selecione o multiplicador" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f3158] border-[#1c3654] text-white">
                    <SelectItem value="0">Não usar</SelectItem>
                    <SelectItem value="1.5">1.5x</SelectItem>
                    <SelectItem value="2.0">2.0x</SelectItem>
                    <SelectItem value="2.5">2.5x</SelectItem>
                    <SelectItem value="3.0">3.0x</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Máx. Martingale
                </Label>
                <Input
                  type="number"
                  value={maxMartingales}
                  onChange={(e) => setMaxMartingales(e.target.value)}
                  min="1"
                  max="15"
                  className="w-full bg-[#0e1a33]/70 border border-[#1c3654] text-white text-sm"
                  disabled={isRunning || isBusy}
                />
              </div>

              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Símbolo
                </Label>
                <Select
                  value={selectedSymbol}
                  onValueChange={setSelectedSymbol}
                  disabled={isRunning || isBusy}
                >
                  <SelectTrigger className="w-full bg-[#0e1a33]/70 border border-[#1c3654] text-white text-sm">
                    <SelectValue placeholder="Selecione o símbolo" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f3158] border-[#1c3654] text-white">
                    {availableSymbols.map((symbol) => (
                      <SelectItem key={symbol.symbol} value={symbol.symbol}>
                        {symbol.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Take Profit
                </Label>
                <Input
                  type="number"
                  value={takeProfit}
                  onChange={(e) => setTakeProfit(e.target.value)}
                  min="1"
                  className="w-full bg-[#0e1a33]/70 border border-[#1c3654] text-white text-sm"
                  disabled={isRunning || isBusy}
                />
              </div>

              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Stop Consecutivas
                </Label>
                <Input
                  type="number"
                  value={maxConsecutiveLosses}
                  onChange={(e) => setMaxConsecutiveLosses(e.target.value)}
                  min="1"
                  className="w-full bg-[#0e1a33]/70 border border-[#1c3654] text-white text-sm"
                  disabled={isRunning || isBusy}
                />
              </div>

              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Temporalidade
                </Label>
                <Select
                  value={timeframe}
                  onValueChange={setTimeframe}
                  disabled={isRunning || isBusy}
                >
                  <SelectTrigger className="w-full bg-[#0e1a33]/70 border border-[#1c3654] text-white text-sm">
                    <SelectValue placeholder="Selecione a temporalidade" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1f3158] border-[#1c3654] text-white">
                    {timeframes.map((tf) => (
                      <SelectItem key={tf.id} value={tf.id}>
                        {tf.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[#8492b4] text-xs mb-1 block">
                  Operações
                </Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={autoMode}
                    onCheckedChange={setAutoMode}
                    disabled={isRunning || isBusy}
                  />
                  <span className="text-white text-sm">
                    {autoMode ? "Automático" : "Manual"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bot Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <Button
              className={`flex-1 ${!isRunning ? "bg-[#00e5b3] hover:bg-[#00c69a]" : "bg-gray-600 hover:bg-gray-700"} text-[#0e1a33] font-bold py-3 px-6 rounded-lg flex items-center justify-center`}
              onClick={handleStartTrading}
              disabled={isRunning || isBusy || !isConnected}
            >
              <Play className="mr-2 h-5 w-5" />
              Iniciar Operações
            </Button>

            <Button
              className={`flex-1 ${isRunning ? "bg-red-600 hover:bg-red-700" : "bg-red-800/20 text-red-500 border border-red-800/30"} font-bold py-3 px-6 rounded-lg flex items-center justify-center`}
              onClick={handleStopTrading}
              disabled={!isRunning || isBusy}
            >
              <StopCircle className="mr-2 h-5 w-5" />
              Parar
            </Button>
          </div>

          {/* Connection Warning */}
          {!isConnected && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Não conectado à API</AlertTitle>
              <AlertDescription>
                Você precisa estar conectado à API Deriv para usar o robô de
                operações.
              </AlertDescription>
            </Alert>
          )}

          {/* Results and Logs */}
          <Tabs defaultValue="results" className="w-full">
            <TabsList className="bg-[#1f3158] text-white mb-4">
              <TabsTrigger
                value="results"
                className="data-[state=active]:bg-[#0e1a33]"
              >
                <BarChart2 className="h-4 w-4 mr-2" />
                Resultados
              </TabsTrigger>
              <TabsTrigger
                value="log"
                className="data-[state=active]:bg-[#0e1a33]"
              >
                <FileText className="h-4 w-4 mr-2" />
                Log de Atividades
              </TabsTrigger>
            </TabsList>

            <TabsContent value="results">
              {/* Real-time Results */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-[#0e1a33]/40 rounded-lg p-4 border border-[#1c3654]">
                  <h4 className="text-xs text-[#8492b4] mb-1">Lucro Total</h4>
                  <div
                    className={`text-2xl font-bold ${totalProfit >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}`}
                  >
                    {totalProfit >= 0 ? "+" : ""}
                    {totalProfit.toFixed(2)} USD
                  </div>
                </div>

                <div className="bg-[#0e1a33]/40 rounded-lg p-4 border border-[#1c3654]">
                  <h4 className="text-xs text-[#8492b4] mb-1">Win / Loss</h4>
                  <div className="text-lg font-bold">
                    {wins} / {losses} ({Math.round(winRate)}%)
                  </div>
                  <Progress value={winRate} className="h-1 mt-2 bg-[#1c3654]" />
                </div>

                <div className="bg-[#0e1a33]/40 rounded-lg p-4 border border-[#1c3654]">
                  <h4 className="text-xs text-[#8492b4] mb-1">Operações</h4>
                  <div className="text-lg font-bold">{wins + losses}</div>
                </div>
              </div>

              {/* Contracts Table */}
              <div className="bg-[#0e1a33]/40 rounded-lg border border-[#1c3654] overflow-hidden">
                <div className="overflow-x-auto">
                  {contractResults.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-[#1f3158]">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            #
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            Tipo
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            Resultado
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            Lucro/Prejuízo
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            Entrada
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            Saída
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-[#8492b4]">
                            Hora
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {contractResults.map((contract, index) => (
                          <tr
                            key={index}
                            className={
                              index % 2 === 0
                                ? "bg-[#0e1a33]/20"
                                : "bg-[#0e1a33]/40"
                            }
                          >
                            <td className="px-4 py-2 text-white">
                              {contract.id}
                            </td>
                            <td className="px-4 py-2 text-white">
                              {contract.type}
                            </td>
                            <td className="px-4 py-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  contract.result === "won"
                                    ? "bg-green-500/20 text-green-400"
                                    : contract.result === "lost"
                                      ? "bg-red-500/20 text-red-400"
                                      : "bg-blue-500/20 text-blue-400"
                                }`}
                              >
                                {contract.result === "won"
                                  ? "Ganhou"
                                  : contract.result === "lost"
                                    ? "Perdeu"
                                    : "Pendente"}
                              </span>
                            </td>
                            <td
                              className={`px-4 py-2 font-medium ${contract.profit >= 0 ? "text-green-400" : "text-red-400"}`}
                            >
                              {contract.profit >= 0 ? "+" : ""}
                              {contract.profit.toFixed(2)} USD
                            </td>
                            <td className="px-4 py-2 text-white">
                              {contract.entry?.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-white">
                              {contract.exit?.toFixed(2) || "-"}
                            </td>
                            <td className="px-4 py-2 text-[#8492b4]">
                              {contract.time.toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-6 text-center text-[#8492b4]">
                      {isRunning
                        ? "Aguardando resultados das operações..."
                        : "Nenhuma operação realizada ainda. Inicie o robô para começar."}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="log">
              {/* Activity Log */}
              <div
                className="bg-[#0e1a33]/40 rounded-lg p-4 border border-[#1c3654] h-64 overflow-y-auto"
                ref={logContainerRef}
              >
                <h3 className="font-medium text-[#00e5b3] mb-3 flex items-center">
                  <FileText className="h-4 w-4 mr-2" />
                  Registro de Atividades
                </h3>

                <div className="space-y-2 text-sm">
                  {logEntries.length > 0 ? (
                    logEntries.map((entry, index) => (
                      <div
                        key={index}
                        className={`
                        py-1 border-b border-[#1c3654]/50 
                        ${
                          entry.type === "info"
                            ? "text-[#8492b4]"
                            : entry.type === "success"
                              ? "text-green-400"
                              : entry.type === "error"
                                ? "text-red-400"
                                : "text-yellow-400"
                        }
                      `}
                      >
                        <span className="text-xs opacity-70 mr-2">
                          [{entry.time.toLocaleTimeString()}]
                        </span>
                        {entry.message}
                      </div>
                    ))
                  ) : (
                    <div className="text-[#8492b4]">
                      Sistema aguardando início das operações...
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
