import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Play,
  StopCircle,
  Pause,
  Download,
  RefreshCw,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import derivAPI from "@/lib/derivApi";
import botService, {
  LogEntry,
  TradeOption,
  TradeState,
} from "@/lib/botService";
import { Subscription } from "rxjs";

export function BotController() {
  const [botState, setBotState] = useState<TradeState>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [symbolList, setSymbolList] = useState<string[]>([]);
  const [statistics, setStatistics] = useState({
    totalRuns: 0,
    totalWins: 0,
    totalLosses: 0,
    totalProfit: 0,
    winRate: 0,
  });

  // Opções de trading
  const [tradeOptions, setTradeOptions] = useState<TradeOption>({
    symbol: "R_10",
    contractType: "CALL",
    duration: 5,
    durationUnit: "m",
    amount: 10,
    currency: "USD",
    basis: "stake",
  });

  const { toast } = useToast();

  // Verificar conexão API e listar símbolos disponíveis
  useEffect(() => {
    const checkConnection = async () => {
      const connected = derivAPI.getConnectionStatus();
      setIsConnected(connected);

      if (connected) {
        try {
          // Obter lista de símbolos disponíveis
          const symbols = await derivAPI.getActiveSymbols();
          if (symbols && symbols.length > 0) {
            const symbolNames = symbols.map((s: any) => s.symbol);
            setSymbolList(symbolNames);
          }
        } catch (error) {
          console.error("Erro ao obter símbolos:", error);
        }
      }
    };

    checkConnection();

    // Verificar periodicamente
    const interval = setInterval(checkConnection, 10000);
    return () => clearInterval(interval);
  }, []);

  // Subscrever para logs e estado do bot
  useEffect(() => {
    const logSubscription = botService.onLogEntry().subscribe((logEntry) => {
      setLogs((prevLogs) => [...prevLogs, logEntry]);
    });

    const stateSubscription = botService.onStateChange().subscribe((state) => {
      setBotState(state);
    });

    // Atualizar estatísticas periodicamente
    const statsInterval = setInterval(() => {
      setStatistics(botService.getStatistics());
    }, 2000);

    return () => {
      logSubscription.unsubscribe();
      stateSubscription.unsubscribe();
      clearInterval(statsInterval);
    };
  }, []);

  // Inicializar bot com estratégia simples
  const initBot = () => {
    // Definir uma estratégia simples
    const simpleStrategy = (bot: typeof botService) => {
      // Verificamos nosso indicador personalizado (RSI, MA, etc.)
      const randomValue = Math.random();

      // Simular uma condição de entrada
      if (randomValue < 0.3) {
        bot.buy(
          "CALL",
          tradeOptions.amount,
          tradeOptions.duration,
          tradeOptions.durationUnit,
        );
      } else if (randomValue > 0.7) {
        bot.buy(
          "PUT",
          tradeOptions.amount,
          tradeOptions.duration,
          tradeOptions.durationUnit,
        );
      }
    };

    try {
      botService.init(simpleStrategy);
      toast({
        title: "Bot inicializado",
        description: "Estratégia definida com sucesso",
      });
    } catch (error) {
      console.error("Erro ao inicializar bot:", error);
      toast({
        title: "Erro ao inicializar",
        description: "Não foi possível inicializar o bot",
        variant: "destructive",
      });
    }
  };

  // Iniciar bot
  const handleStart = () => {
    if (!isConnected) {
      toast({
        title: "Conexão necessária",
        description: "Conecte-se à sua conta Deriv antes de iniciar o bot",
        variant: "destructive",
      });
      return;
    }

    try {
      // Inicializar se ainda não tiver feito
      if (botState === "idle") {
        initBot();
      }

      // Iniciar o bot
      botService.start(tradeOptions);

      toast({
        title: "Bot iniciado",
        description: `Trading em ${tradeOptions.symbol} iniciado`,
      });
    } catch (error) {
      console.error("Erro ao iniciar bot:", error);
      toast({
        title: "Erro",
        description: "Não foi possível iniciar o bot",
        variant: "destructive",
      });
    }
  };

  // Pausar bot
  const handlePause = () => {
    try {
      botService.pause();
      toast({
        title: "Bot pausado",
        description: "As operações do bot foram pausadas",
      });
    } catch (error) {
      console.error("Erro ao pausar bot:", error);
    }
  };

  // Retomar bot
  const handleResume = () => {
    try {
      botService.resume();
      toast({
        title: "Bot resumido",
        description: "As operações do bot foram retomadas",
      });
    } catch (error) {
      console.error("Erro ao retomar bot:", error);
    }
  };

  // Parar bot
  const handleStop = () => {
    try {
      botService.stop();
      toast({
        title: "Bot parado",
        description: "O robô de trading foi parado com sucesso",
        variant: "destructive",
      });
    } catch (error) {
      console.error("Erro ao parar bot:", error);
    }
  };

  // Atualizar opções de trading
  const updateTradeOption = (key: keyof TradeOption, value: any) => {
    setTradeOptions((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Limpar logs
  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <>
      <Card className="grid-card">
        <CardHeader className="p-4 border-b border-gray-800 flex flex-row justify-between items-center space-y-0">
          <CardTitle className="text-lg font-medium font-poppins">
            Controle do Bot
          </CardTitle>

          <div className="flex space-x-2">
            {botState === "running" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  className="flex items-center"
                >
                  <Pause className="w-4 h-4 mr-1" />
                  Pausar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  className="flex items-center"
                >
                  <StopCircle className="w-4 h-4 mr-1" />
                  Parar
                </Button>
              </>
            ) : botState === "paused" ? (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleResume}
                  className="bg-[#3a7bd5] hover:bg-opacity-80 text-white flex items-center"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Retomar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  className="flex items-center"
                >
                  <StopCircle className="w-4 h-4 mr-1" />
                  Parar
                </Button>
              </>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleStart}
                className="bg-[#00e5b3] hover:bg-opacity-80 text-black flex items-center"
                disabled={!isConnected}
              >
                <Play className="w-4 h-4 mr-1" />
                Iniciar Bot
              </Button>
            )}
          </div>
        </CardHeader>

        <Tabs defaultValue="config">
          <TabsList className="w-full bg-[#162746] border-b border-gray-800 rounded-none px-4">
            <TabsTrigger
              value="config"
              className="data-[state=active]:bg-[#1f3158] data-[state=active]:shadow-none"
            >
              Configurações
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="data-[state=active]:bg-[#1f3158] data-[state=active]:shadow-none"
            >
              Estatísticas
            </TabsTrigger>
            <TabsTrigger
              value="logs"
              className="data-[state=active]:bg-[#1f3158] data-[state=active]:shadow-none"
            >
              Logs
            </TabsTrigger>
          </TabsList>

          <CardContent className="p-0">
            <TabsContent value="config" className="m-0 p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ativo de Trading</Label>
                  <Select
                    value={tradeOptions.symbol}
                    onValueChange={(value) =>
                      updateTradeOption("symbol", value)
                    }
                    disabled={botState === "running"}
                  >
                    <SelectTrigger className="w-full bg-[#0e1a33] border-gray-700">
                      <SelectValue placeholder="Selecione um ativo" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0e1a33] border-gray-700">
                      {symbolList.length > 0 ? (
                        symbolList.map((symbol) => (
                          <SelectItem key={symbol} value={symbol}>
                            {symbol}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="R_10">R_10</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Contrato</Label>
                  <Select
                    value={tradeOptions.contractType}
                    onValueChange={(value) =>
                      updateTradeOption("contractType", value)
                    }
                    disabled={botState === "running"}
                  >
                    <SelectTrigger className="w-full bg-[#0e1a33] border-gray-700">
                      <SelectValue placeholder="Selecione um tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0e1a33] border-gray-700">
                      <SelectItem value="CALL">Alta (CALL)</SelectItem>
                      <SelectItem value="PUT">Baixa (PUT)</SelectItem>
                      <SelectItem value="DIGITEVEN">Par (DIGITEVEN)</SelectItem>
                      <SelectItem value="DIGITODD">Ímpar (DIGITODD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor da Operação ({tradeOptions.currency})</Label>
                  <Input
                    type="number"
                    value={tradeOptions.amount}
                    onChange={(e) =>
                      updateTradeOption("amount", Number(e.target.value))
                    }
                    disabled={botState === "running"}
                    className="bg-[#0e1a33] border-gray-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duração</Label>
                  <div className="flex space-x-2">
                    <Input
                      type="number"
                      value={tradeOptions.duration}
                      onChange={(e) =>
                        updateTradeOption("duration", Number(e.target.value))
                      }
                      disabled={botState === "running"}
                      className="bg-[#0e1a33] border-gray-700"
                    />
                    <Select
                      value={tradeOptions.durationUnit}
                      onValueChange={(value) =>
                        updateTradeOption("durationUnit", value)
                      }
                      disabled={botState === "running"}
                    >
                      <SelectTrigger className="w-32 bg-[#0e1a33] border-gray-700">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#0e1a33] border-gray-700">
                        <SelectItem value="t">Ticks</SelectItem>
                        <SelectItem value="s">Segundos</SelectItem>
                        <SelectItem value="m">Minutos</SelectItem>
                        <SelectItem value="h">Horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <h3 className="text-sm font-medium mb-3">Estratégia</h3>
                <div className="bg-[#0e1a33] p-3 rounded-md">
                  <p className="text-sm text-[#8492b4]">
                    Estratégia Atual:{" "}
                    <span className="text-white">RSI Crossover</span>
                  </p>
                  <p className="text-xs text-[#8492b4] mt-1">
                    Quando RSI cruza abaixo de 30, compra CALL. Quando cruza
                    acima de 70, compra PUT.
                  </p>

                  <Button
                    className="mt-3 bg-[#3a7bd5] hover:bg-opacity-80 text-white text-xs"
                    size="sm"
                    disabled={botState === "running"}
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    Configurar Estratégia
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stats" className="m-0 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#1f3158] p-3 rounded-md">
                  <p className="text-xs text-[#8492b4]">Total de Operações</p>
                  <p className="text-xl font-medium">{statistics.totalRuns}</p>
                </div>
                <div className="bg-[#1f3158] p-3 rounded-md">
                  <p className="text-xs text-[#8492b4]">Ganhos</p>
                  <p className="text-xl font-medium text-[#00e5b3]">
                    {statistics.totalWins}
                  </p>
                </div>
                <div className="bg-[#1f3158] p-3 rounded-md">
                  <p className="text-xs text-[#8492b4]">Perdas</p>
                  <p className="text-xl font-medium text-[#ff444f]">
                    {statistics.totalLosses}
                  </p>
                </div>
                <div className="bg-[#1f3158] p-3 rounded-md">
                  <p className="text-xs text-[#8492b4]">Taxa de Acerto</p>
                  <p className="text-xl font-medium">
                    {statistics.winRate.toFixed(2)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 bg-[#1f3158] p-3 rounded-md">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium">Lucro Total</p>
                  <p
                    className={`text-lg font-medium ${statistics.totalProfit >= 0 ? "text-[#00e5b3]" : "text-[#ff444f]"}`}
                  >
                    {statistics.totalProfit.toFixed(2)} {tradeOptions.currency}
                  </p>
                </div>

                <div className="w-full bg-[#0e1a33] h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${statistics.totalProfit >= 0 ? "bg-[#00e5b3]" : "bg-[#ff444f]"}`}
                    style={{
                      width: `${Math.min((Math.abs(statistics.totalProfit) / 100) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium">Estado do Bot</p>
                  <div className="flex items-center">
                    <span
                      className={`inline-block w-2 h-2 rounded-full mr-2 ${
                        botState === "running"
                          ? "bg-[#00e5b3]"
                          : botState === "paused"
                            ? "bg-[#ffc107]"
                            : botState === "error"
                              ? "bg-[#ff444f]"
                              : "bg-gray-500"
                      }`}
                    ></span>
                    <p className="text-sm">
                      {botState === "running"
                        ? "Em execução"
                        : botState === "paused"
                          ? "Pausado"
                          : botState === "stopped"
                            ? "Parado"
                            : botState === "error"
                              ? "Erro"
                              : "Inativo"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="logs" className="m-0 p-0">
              <div className="flex justify-between items-center p-2 bg-[#1f3158] border-b border-gray-800">
                <p className="text-xs text-[#8492b4]">Logs de operação</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={clearLogs}
                >
                  Limpar
                </Button>
              </div>
              <div className="h-60 overflow-y-auto bg-[#0e1a33] p-2">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-[#8492b4] text-sm">
                      Nenhum log disponível
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-xs">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className="log-entry py-1 border-b border-gray-800"
                      >
                        <span className="text-gray-400 mr-2">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`
                          ${log.type === "info" ? "text-white" : ""}
                          ${log.type === "success" ? "text-[#00e5b3]" : ""}
                          ${log.type === "error" ? "text-[#ff444f]" : ""}
                          ${log.type === "warning" ? "text-[#ffc107]" : ""}
                        `}
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </>
  );
}
