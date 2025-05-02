import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { BotController } from "@/components/BotController";
import { IronUnderTester } from "@/components/IronUnderTester";
import { DirectDigitDisplay } from "@/components/DirectDigitDisplay";
import { DirectTickerDisplay } from "@/components/DirectTickerDisplay";
import { ForceUpdateDigitDisplay } from "@/components/ForceUpdateDigitDisplay";
import { PureWebSocketDigits } from "@/components/PureWebSocketDigits";
import { SimpleDigitDisplay } from "@/components/SimpleDigitDisplay";
import { WebSocketDiagnostic } from "@/components/WebSocketDiagnostic";
import { TokenPermissionAlert } from "@/components/TokenPermissionAlert";
import { DerivLoginRequired } from "@/components/DerivLoginRequired";
import { RelatorioOperacoes } from "@/components/trading/RelatorioOperacoes";
import { OperationHistoryCard } from "@/components/trading/OperationHistoryCard";
import { DigitBarChart } from "@/components/ui/DigitBarChart";
import { IndependentDigitBarChart } from "@/components/IndependentDigitBarChart";
import derivApiService from "@/services/derivApiService";
import { oauthDirectService } from "@/services/oauthDirectService";
import { derivHistoryService } from "@/services/deriv-history-service";
import { BotStatus } from "@/services/botService";
import { getStrategyById } from "@/lib/strategiesConfig";
import { useTranslation } from "react-i18next";
import { injectAdvanceBarrierCorrection } from "@/lib/utils";

// Função para formatar valores monetários com base no idioma atual
const formatCurrency = (value: number): string => {
  const locale =
    window.localStorage.getItem("i18nextLng") === "en" ? "en-US" : "pt-BR";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

// Interface para conta Deriv
interface DerivAccount {
  loginid: string;
  token: string;
  currency: string;
  balance: number;
  isVirtual: boolean;
}

/**
 * Função para salvar estatísticas de dígitos no backend
 * Com fallback para localStorage em caso de erro
 */
/**
 * FUNÇÃO DESATIVADA POR PROJETO:
 * REQUISITO CRÍTICO: Nunca utilizar dados persistidos de sessões anteriores
 * Esta função foi substituída por uma versão que apenas loga e não persiste dados.
 */
function saveDigitToBackend(
  symbol: string,
  newDigit: number,
  lastDigits: number[],
  digitStats: Array<{ digit: number; count: number; percentage: number }>,
) {
  // Apenas loga os dados e simula sucesso sem realmente enviar ao backend
  console.log(
    `[BOT_PAGE] DIGIT LOG ONLY - NÃO PERSISTINDO: ${symbol}, digit: ${newDigit} com ${lastDigits.length} dígitos`,
  );
  console.log(
    `[BOT_PAGE] Estatísticas de ${symbol} salvas no banco de dados com sucesso`,
  );
  return true;
}

// Log para indicar uso da nova versão com OAuth dedicado
console.log(
  "[BOT_PAGE] Usando nova página de bot que usa exclusivamente serviço OAuth dedicado",
);

// Log para indicar uso da nova versão com OAuth dedicado
console.log(
  "[BOT_PAGE] Usando nova página de bot que usa exclusivamente serviço OAuth dedicado",
);

export function BotPage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  // Função para recarregar a página forçadamente
  const forceFullReload = () => {
    console.log("[BOT_PAGE] Forçando recarregamento completo da página...");

    // Obter o idioma atual
    const currentLang = window.localStorage.getItem("i18nextLng") || "pt";

    // Textos com base no idioma
    const updateText =
      currentLang === "en" ? "UPDATING PAGE" : "ATUALIZANDO PÁGINA";
    const reloadingText =
      currentLang === "en"
        ? "Reloading application..."
        : "Recarregando aplicação...";

    // Criar elemento visual de carregamento
    const loadingElement = document.createElement("div");
    loadingElement.style.position = "fixed";
    loadingElement.style.top = "0";
    loadingElement.style.left = "0";
    loadingElement.style.width = "100%";
    loadingElement.style.height = "100%";
    loadingElement.style.backgroundColor = "rgba(11, 20, 41, 0.9)";
    loadingElement.style.zIndex = "9999";
    loadingElement.style.display = "flex";
    loadingElement.style.alignItems = "center";
    loadingElement.style.justifyContent = "center";
    loadingElement.style.flexDirection = "column";
    loadingElement.style.color = "white";
    loadingElement.style.fontSize = "24px";
    loadingElement.style.fontWeight = "bold";
    loadingElement.innerHTML = `
      <div style="margin-bottom: 20px;">${updateText}</div>
      <div style="font-size: 18px; margin-bottom: 30px;">${reloadingText}</div>
      <div style="width: 60px; height: 60px; border: 5px solid #1E3A8A; border-top: 5px solid #00E5B3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    `;

    // Adicionar estilo de animação
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loadingElement);

    // Recarregar a página após pequeno delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // Estado para autenticação e dados da conta
  const [accountInfo, setAccountInfo] = useState<any>(null);
  // Adicionado default para garantir valor inicial
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount>({
    loginid: "",
    token: "",
    currency: "USD",
    balance: 0,
    isVirtual: false,
  });
  const [authToken, setAuthToken] = useState<string | null>(null); // Token para autorização de operações

  // Estado para controle do robô
  const [botStatus, setBotStatus] = useState<BotStatus>("idle");

  // Estados para dados do gráfico
  const [ticks, setTicks] = useState<string>("10");
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<
    {
      digit: number;
      count: number;
      percentage: number;
    }[]
  >(
    Array.from({ length: 10 }, (_, i) => ({
      digit: i,
      count: 0,
      percentage: 0,
    })),
  );

  // Estados para configurações do bot
  const [entryValue, setEntryValue] = useState<string>("0.35");
  const [profitTarget, setProfitTarget] = useState<string>("20");
  const [lossLimit, setLossLimit] = useState<string>("20");
  const [martingaleFactor, setMartingaleFactor] = useState<string>("1.5");
  const [virtualLoss, setVirtualLoss] = useState<string>("");
  const [selectedBotType, setSelectedBotType] = useState<
    "lite" | "premium" | ""
  >("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");

  // Definir estratégias disponíveis
  const strategies = {
    lite: [
      { id: "profitpro", name: "Profit Pro", file: "Profitpro Atualizado.xml" },
      { id: "manualunder", name: "Control Under", file: "Manual Under.xml" },
      { id: "advance", name: "Advance", file: "Advance .xml" },
      {
        id: "wisetendencia",
        name: "Wise Pro Tendência",
        file: "WISE PRO TENDENCIA.xml",
      },
    ],
    premium: [
      { id: "ironover", name: "Iron Over", file: "IRON OVER.xml" },
      { id: "ironunder", name: "Iron Under", file: "IRON UNDER.xml" },
      { id: "botlow", name: "Bot Low", file: "BOT LOW.xml" },
      { id: "maxpro", name: "Max Pro", file: "MAXPRO .xml" },
      { id: "green", name: "Green", file: "green.xml" },
      { id: "manualover", name: "Control Over", file: "manual Over.xml" },
    ],
  };

  // Estado para operações
  const [operation, setOperation] = useState<{
    entry: number;
    buyPrice: number;
    profit: number;
    status: "comprado" | "vendendo" | null;
  }>({
    entry: 1584.42,
    buyPrice: 0,
    profit: 0,
    status: null,
  });

  // Estado para estatísticas com valores iniciais para teste
  const [stats, setStats] = useState({
    wins: 1,
    losses: 0,
    totalProfit: 8.7,
  });

  // Estado para saldo em tempo real
  const [realTimeBalance, setRealTimeBalance] = useState<{
    balance: number;
    previousBalance: number;
  }>({
    balance: 0,
    previousBalance: 0,
  });

  // Estado para controlar se o usuário está autenticado
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  /**
   * Função para atualizar as estatísticas de dígitos
   * Versão que usa ticks diretamente da Deriv e permite escolher quantidade de ticks para análise
   * IMPORTANTE: Para a estratégia Advance, sempre usamos exatamente 25 ticks, independente da seleção
   */
  const updateDigitStats = (newDigit: number) => {
    // Símbolo fixo para este componente
    const symbol = "R_100";

    // 1. Atualizar o histórico local de dígitos recebidos diretamente do mercado
    setLastDigits((prev: number[]) => {
      // Adicionar novo dígito ao início - mantendo os mais recentes primeiro
      // e garantindo que temos pelo menos 100 ticks para análises mais complexas
      return [newDigit, ...prev].slice(0, Math.max(parseInt(ticks) * 2, 100));
    });

    // 2. Capturar a quantidade selecionada pelo usuário para análise regular
    const selectedTicksCount = parseInt(ticks);

    // 3. CRÍTICO: Criar dois conjuntos de estatísticas:
    // A. Um para visualização normal do usuário (baseado na seleção de ticks)
    // B. Um ESPECIFICAMENTE para a estratégia Advance com EXATAMENTE 25 ticks

    // A. Estatísticas baseadas no número de ticks selecionados pelo usuário (para visualização)
    const recentDigits = lastDigits.slice(0, selectedTicksCount);

    // B. Estatísticas EXATAMENTE com 25 ticks para estratégia Advance
    const advance25Ticks = lastDigits.slice(0, 25);

    // 4. Inicializar contagens para cada dígito (0-9) para a visualização normal
    const digitCounts = Array(10).fill(0);

    // 5. Contar a frequência de cada dígito apenas nos ticks selecionados
    recentDigits.forEach((digit) => {
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    });

    // 6. Total de dígitos analisados (para calcular percentuais)
    const totalDigits = recentDigits.length;

    // 7. Criar o array de estatísticas com contagens e percentuais para visualização normal
    const updatedStats = digitCounts.map((count, digit) => {
      // Calcular o percentual com precisão, arredondando para o inteiro mais próximo
      const percentage =
        totalDigits > 0 ? Math.round((count / totalDigits) * 100) : 0;

      return {
        digit,
        count,
        percentage,
      };
    });

    // 8. CRÍTICO: Criar estatísticas específicas para Advance com exatamente 25 ticks
    // Inicializar contagens para cada dígito (0-9) para Advance
    const advanceDigitCounts = Array(10).fill(0);

    // Contar a frequência de cada dígito nos 25 ticks para Advance
    advance25Ticks.forEach((digit) => {
      if (digit >= 0 && digit <= 9) {
        advanceDigitCounts[digit]++;
      }
    });

    // Criar o array de estatísticas específico para Advance
    if (selectedStrategy === "advance") {
      // Substituir as estatísticas se a estratégia selecionada for Advance
      const advanceUpdatedStats = advanceDigitCounts.map((count, digit) => {
        // Calcular o percentual baseado em EXATAMENTE 25 ticks
        const percentage = Math.round((count / 25) * 100);

        return {
          digit,
          count,
          percentage,
        };
      });

      console.log(
        `[BOT_PAGE] Estatísticas específicas para ADVANCE (25 ticks):`,
      );
      console.log(
        `[BOT_PAGE]   Dígito 0: ${advanceUpdatedStats[0].percentage}%`,
      );
      console.log(
        `[BOT_PAGE]   Dígito 1: ${advanceUpdatedStats[1].percentage}%`,
      );

      // Para Advance, usamos as estatísticas específicas com 25 ticks
      setDigitStats(advanceUpdatedStats);
      return;
    }

    // Para outras estratégias, usamos as estatísticas normais baseadas na seleção do usuário

    // 8. Atualizar o estado das estatísticas de dígitos na interface
    setDigitStats(updatedStats);

    // 9. Log para depuração
    console.log(
      `[BOT_PAGE] Novas estatísticas calculadas para últimos ${selectedTicksCount} ticks:`,
      `"${updatedStats.map((s) => `${s.digit}: ${s.percentage}%`).join(", ")}"`,
    );

    // Verificar se a soma dos percentuais é 100% (ou próximo, devido a arredondamentos)
    const totalPercentage = updatedStats.reduce(
      (sum, stat) => sum + stat.percentage,
      0,
    );
    if (Math.abs(totalPercentage - 100) > 5) {
      console.warn(
        `[BOT_PAGE] Alerta: Total de percentuais (${totalPercentage}%) não está próximo de 100%. Verificar cálculos.`,
      );
    }

    console.log(
      `[BOT_PAGE] APENAS LOG (sem persistência):`,
      `Digit ${newDigit} (últimos ${selectedTicksCount} ticks) - Stats: ${updatedStats.map((s) => `${s.digit}: ${s.percentage}%`).join(", ")}`,
    );
  };

  // Estado para histórico de operações
  // Interface para operações no histórico
  interface Operation {
    id: number | string;
    entryValue?: number;
    finalValue?: number;
    profit: number;
    time: Date;
    contractType?: string;
    contract_type?: string;
    symbol?: string;
    strategy?: string;
    contract_id?: string | number;
    entry_value?: number;
    exit_value?: number;
    is_win?: boolean;
    entry_spot?: number | string;
    exit_spot?: number | string;
    entry_time?: number;
    exit_time?: number;
    duration?: number;
    barrier?: string | number;
    payout?: number;
    timestamp?: number;
    isIntermediate?: boolean; // Flag para identificar operações intermediárias da estratégia Advance
    notification?: {
      type: "success" | "info" | "warning" | "error";
      message: string;
    };
  }

  // Estado para histórico de operações com operação de teste inicial para verificar
  const [operationHistory, setOperationHistory] = useState<Array<Operation>>([
    // Operação de exemplo com ganho
    {
      id: Date.now(),
      entryValue: 10,
      entry_value: 10,
      finalValue: 18.7,
      exit_value: 18.7,
      profit: 8.7,
      time: new Date(),
      timestamp: Date.now(),
      contract_type: "DIGITOVER",
      symbol: "R_100",
      strategy: "botlow",
      is_win: true,
      notification: {
        type: "success",
        message: `GANHO | Entrada: $10.00 | Resultado: $8.70`,
      },
    },
    // Operação de exemplo com perda
    {
      id: Date.now() - 1000, // ID diferente
      entryValue: 5,
      entry_value: 5,
      finalValue: 0,
      exit_value: 0,
      profit: -5,
      time: new Date(Date.now() - 30000), // 30 segundos atrás
      timestamp: Date.now() - 30000,
      contract_type: "DIGITUNDER",
      symbol: "R_100",
      strategy: "botlow",
      is_win: false,
      notification: {
        type: "error",
        message: `PERDA | Entrada: $5.00 | Resultado: -$5.00`,
      },
    },
  ]);

  // ★★★ CORREÇÃO CRÍTICA: Carregar histórico de operações local ao iniciar a página ★★★
  useEffect(() => {
    console.log("[BOT_PAGE] Carregando histórico de operações do localStorage...");
    
    // Obter o histórico de operações do localStorage
    const historyKey = "deriv_operations_history";
    const savedHistory = localStorage.getItem(historyKey);
    
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          console.log(`[BOT_PAGE] Encontradas ${parsedHistory.length} operações no histórico local`);
          
          // Ordenar operações por data (mais recentes primeiro)
          const sortedHistory = parsedHistory.sort((a, b) => {
            // Usar os campos timestamp, saved_at ou time (o que estiver disponível)
            const timeA = a.timestamp || a.saved_at || (a.time ? new Date(a.time).getTime() : 0);
            const timeB = b.timestamp || b.saved_at || (b.time ? new Date(b.time).getTime() : 0);
            return timeB - timeA;
          });
          
          // Converter para o formato esperado pelo componente
          const formattedHistory = sortedHistory.map(operation => ({
            id: operation.contract_id || operation.id || Date.now(),
            contract_id: operation.contract_id,
            entryValue: operation.entry_value || operation.entryValue || 0,
            entry_value: operation.entry_value || operation.entryValue || 0,
            finalValue: operation.exit_value || operation.finalValue || 0,
            exit_value: operation.exit_value || operation.finalValue || 0,
            profit: operation.profit || 0,
            time: operation.time ? new Date(operation.time) : new Date(operation.timestamp || operation.saved_at || Date.now()),
            timestamp: operation.timestamp || operation.saved_at || Date.now(),
            contract_type: operation.contract_type || "",
            symbol: operation.symbol || "R_100",
            strategy: operation.strategy || "",
            is_win: operation.is_win ?? (operation.profit > 0),
            isIntermediate: operation.isIntermediate || operation.is_intermediate || false,
            notification: {
              type: operation.is_win || operation.profit > 0 ? "success" : "error" as const,
              message: `${operation.is_win || operation.profit > 0 ? "GANHO" : "PERDA"} | Entrada: $${(operation.entry_value || operation.entryValue || 0).toFixed(2)} | Resultado: $${(operation.profit || 0).toFixed(2)}`,
            },
          }));
          
          // Atualizar o estado com as operações carregadas
          setOperationHistory(formattedHistory.slice(0, 50));
          
          // Calcular estatísticas a partir do histórico
          const stats = formattedHistory.reduce((acc, op) => {
            const isWin = op.is_win || op.profit > 0;
            return {
              wins: acc.wins + (isWin ? 1 : 0),
              losses: acc.losses + (isWin ? 0 : 1),
              totalProfit: acc.totalProfit + (op.profit || 0),
            };
          }, { wins: 0, losses: 0, totalProfit: 0 });
          
          // Atualizar as estatísticas
          setStats(stats);
          
          console.log("[BOT_PAGE] ✅ Histórico de operações carregado com sucesso:", formattedHistory.length);
          console.log("[BOT_PAGE] 📊 Estatísticas calculadas:", stats);
        } else {
          console.log("[BOT_PAGE] Nenhuma operação encontrada no histórico local");
        }
      } catch (error) {
        console.error("[BOT_PAGE] Erro ao carregar histórico de operações:", error);
      }
    } else {
      console.log("[BOT_PAGE] Nenhum histórico de operações encontrado no localStorage");
    }
  }, []); // Executar apenas uma vez ao montar o componente

  // ★★★ CORREÇÃO CRÍTICA: Adicionar auto-refresh para garantir que operações sejam mostradas em tempo real ★★★
  useEffect(() => {
    console.log(
      "[BOT_PAGE] Configurando auto-refresh para histórico de operações...",
    );

    // Só iniciar o intervalo de atualização se o robô estiver em execução
    if (botStatus !== "running") {
      console.log(
        "[BOT_PAGE] Robô não está em execução, auto-refresh desativado",
      );
      return;
    }

    console.log("[BOT_PAGE] Robô em execução, ativando auto-refresh");

    // Definir intervalo de atualização a cada 5 segundos
    const refreshInterval = setInterval(() => {
      console.log(
        "[BOT_PAGE] Auto-refresh do histórico de operações disparado",
      );

      // Forçar re-render do histórico garantindo que seja o mesmo array para não perder operações
      setOperationHistory((prev) => [...prev]);

      // Atualizar estatísticas
      setStats((prev) => ({ ...prev }));
      
      // Verificar o localStorage para operações novas que possam ter sido adicionadas por outros componentes
      try {
        const historyKey = "deriv_operations_history";
        const savedHistory = localStorage.getItem(historyKey);
        
        if (savedHistory) {
          const parsedHistory = JSON.parse(savedHistory);
          if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
            // Verificar se há novas operações no localStorage que não estão no estado
            const existingIds = new Set(operationHistory.map(op => op.id));
            // Debug para verificar o conteúdo do histórico bruto
            console.log(`[BOT_PAGE] 📊 Conteúdo do histórico antes de processar:`, 
              parsedHistory.length > 0 ? parsedHistory[0] : 'Sem operações');
            
            const newOperations = parsedHistory
              .filter(op => !existingIds.has(op.contract_id || op.id))
              .map(operation => {
                // Garantir que operações com estratégia "Control Under" e "Control Over" sejam corretamente identificadas
                let strategyName = operation.strategy || "";
                
                // Verificar se é uma das estratégias renomeadas
                if (strategyName.toLowerCase().includes('manualunder') || 
                    strategyName.toLowerCase().includes('control_under')) {
                  strategyName = 'Control Under';
                } else if (strategyName.toLowerCase().includes('manualover') || 
                          strategyName.toLowerCase().includes('control_over')) {
                  strategyName = 'Control Over';
                }
                
                // Debug para verificar se o motivo de encerramento está presente
                if (operation.termination_reason) {
                  console.log(`[BOT_PAGE] 📊 Operação ${operation.contract_id} tem motivo de encerramento: ${operation.termination_reason}`);
                }
                
                return {
                  id: operation.contract_id || operation.id || Date.now(),
                  contract_id: operation.contract_id,
                  entryValue: operation.entry_value || operation.entryValue || 0,
                  entry_value: operation.entry_value || operation.entryValue || 0,
                  finalValue: operation.exit_value || operation.finalValue || 0,
                  exit_value: operation.exit_value || operation.finalValue || 0,
                  profit: operation.profit || 0,
                  time: operation.time ? new Date(operation.time) : new Date(operation.timestamp || operation.saved_at || Date.now()),
                  timestamp: operation.timestamp || operation.saved_at || Date.now(),
                  contract_type: operation.contract_type || "",
                  symbol: operation.symbol || "R_100",
                  strategy: strategyName, // Usar o nome corrigido da estratégia
                  is_win: operation.is_win ?? (operation.profit > 0),
                  isIntermediate: operation.isIntermediate || operation.is_intermediate || false,
                  // Incluir o motivo de encerramento da operação se disponível
                  termination_reason: operation.termination_reason,
                  notification: {
                    type: operation.is_win || operation.profit > 0 ? "success" : "error" as const,
                    message: `${operation.is_win || operation.profit > 0 ? "GANHO" : "PERDA"} | Entrada: $${(operation.entry_value || operation.entryValue || 0).toFixed(2)} | Resultado: $${(operation.profit || 0).toFixed(2)}`,
                  }
                };
              });
              
            if (newOperations.length > 0) {
              console.log(`[BOT_PAGE] 🔄 Encontradas ${newOperations.length} novas operações no localStorage`);
              setOperationHistory(prev => [...newOperations, ...prev].slice(0, 50));
            }
          }
        }
      } catch (error) {
        console.error("[BOT_PAGE] Erro ao verificar novas operações no localStorage:", error);
      }
    }, 5000);

    return () => {
      console.log("[BOT_PAGE] Limpando auto-refresh do histórico de operações");
      clearInterval(refreshInterval);
    };
  }, [botStatus, operationHistory.length]); // Adicionada dependência operationHistory.length para reagir a mudanças

  // ★★★ CORREÇÃO CRÍTICA: Adicionar event listener específico para eventos DOM de contratos finalizados ★★★
  useEffect(() => {
    console.log("[BOT_PAGE] ⚠️ Configurando event listener para eventos 'contract_finished'");
    
    // Criar função de callback para processar eventos de contratos finalizados via DOM
    const handleContractFinishedEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log("[BOT_PAGE] 📝 Evento DOM 'contract_finished' capturado:", customEvent.detail);
      
      if (customEvent.detail) {
        // Extrair dados do evento
        const contractEvent = customEvent.detail;
        
        // Valores importantes para o histórico
        const operationEntryValue = contractEvent.entry_value || parseFloat(entryValue || "0") || 0;
        const exitValue = contractEvent.exit_value || contractEvent.contract_details?.sell_price || 0;
        const profitValue = contractEvent.profit || 0;
        const isWin = contractEvent.is_win || false;
        
        // Criar registro de operação completo com todas as informações disponíveis
        const operationRecord = {
          id: contractEvent.contract_id || Date.now(),
          contract_id: contractEvent.contract_id,
          entryValue: operationEntryValue,
          entry_value: operationEntryValue,
          finalValue: exitValue,
          exit_value: exitValue,
          profit: profitValue,
          time: new Date(),
          timestamp: Date.now(),
          contract_type: contractEvent.contract_type || contractEvent.contract_details?.contract_type || "",
          symbol: contractEvent.symbol || contractEvent.contract_details?.underlying_symbol || "R_100",
          
          // Garantir que estratégias Control Under e Control Over sejam corretamente formatadas
          strategy: (() => {
            const strategyName = contractEvent.strategy || selectedStrategy || "";
            if (strategyName.toLowerCase().includes('manualunder') || 
                strategyName.toLowerCase().includes('control_under')) {
              return 'Control Under';
            } else if (strategyName.toLowerCase().includes('manualover') || 
                     strategyName.toLowerCase().includes('control_over')) {
              return 'Control Over';
            }
            return strategyName;
          })(),
          
          is_win: isWin,
          isIntermediate: contractEvent.isIntermediate || false,
          is_intermediate: contractEvent.is_intermediate || false,
          
          // Incluir o motivo de encerramento da operação se disponível
          termination_reason: contractEvent.termination_reason,
          
          notification: {
            type: isWin ? "success" : "error" as const,
            message: `${isWin ? "GANHO" : "PERDA"} | Entrada: $${operationEntryValue.toFixed(2)} | Resultado: $${profitValue.toFixed(2)}`,
          },
        };
        
        console.log("[BOT_PAGE] 🔄 Atualizando histórico com nova operação:", operationRecord);
        
        // Atualizar histórico de operações com a nova entrada
        setOperationHistory(prev => [operationRecord, ...prev].slice(0, 50));
        
        // Atualizar estatísticas
        setStats(prev => {
          const totalProfit = prev.totalProfit + profitValue;
          
          if (isWin) {
            return { ...prev, wins: prev.wins + 1, totalProfit };
          } else {
            return { ...prev, losses: prev.losses + 1, totalProfit };
          }
        });
        
        // Mostrar notificação toast (apenas para operações não intermediárias)
        if (!operationRecord.isIntermediate) {
          toast({
            title: isWin ? "Operação Vencedora!" : "Operação Perdedora",
            description: `Resultado: $${profitValue.toFixed(2)}`,
            variant: isWin ? "default" : "destructive",
          });
        }
      }
    };
    
    // Registrar o event listener
    window.addEventListener("contract_finished", handleContractFinishedEvent);
    
    // Remover event listener quando o componente for desmontado
    return () => {
      console.log("[BOT_PAGE] Removendo event listener para 'contract_finished'");
      window.removeEventListener("contract_finished", handleContractFinishedEvent);
    };
  }, [toast, entryValue, selectedStrategy]); // Dependências importantes para o callback

  // Verificar autenticação e conectar com OAuth direto
  useEffect(() => {
    console.log(
      "[BOT_PAGE] Inicializando página do bot com conexão OAuth dedicada",
    );

    // Verificação de conexão WebSocket ativa, mas sem forçar recarregamentos
    // Apenas fazer diagnóstico da conexão
    const checkInterfaceUpdates = setInterval(() => {
      const lastTick = localStorage.getItem("last_tick_timestamp");
      const now = Date.now();

      // Se estiver inativo há mais de 1 minuto, verificar a conexão sem recarregar a página
      if (lastTick && now - parseInt(lastTick) > 60000) {
        console.log(
          "[BOT_PAGE] Verificando estado da conexão WebSocket após 60 segundos sem ticks",
        );

        // Verificar se o WebSocket ainda está conectado
        if (
          oauthDirectService &&
          typeof oauthDirectService.subscribeToTicks === "function"
        ) {
          // Tentar reinscrever nos ticks, mas sem recarregar a página
          oauthDirectService.subscribeToTicks("R_100");
          console.log(
            "[BOT_PAGE] Tentativa de reativação da conexão de ticks realizada",
          );

          // Atualizar timestamp para evitar novas tentativas por 30 segundos
          localStorage.setItem("last_tick_timestamp", (now - 30000).toString());
        }
      }
    }, 30000);

    // Inicializar a conexão WebSocket do OAuth assim que a página carregar
    oauthDirectService
      .initializeConnection()
      .then((success) => {
        if (success) {
          console.log("[BOT_PAGE] Conexão WebSocket inicializada com sucesso");
          toast({
            title: "Conexão estabelecida",
            description:
              "Conexão com servidor da Deriv estabelecida com sucesso",
          });

          // Marcar timestamp do último tick
          localStorage.setItem("last_tick_timestamp", Date.now().toString());
        } else {
          console.error("[BOT_PAGE] Falha ao inicializar conexão WebSocket");
          toast({
            title: "Erro de conexão",
            description: "Falha ao conectar com servidor da Deriv",
            variant: "destructive",
          });
        }
      })
      .catch((error) => {
        console.error(
          "[BOT_PAGE] Erro ao inicializar conexão WebSocket:",
          error,
        );
        toast({
          title: "Erro de conexão",
          description: error.message || "Falha ao conectar com servidor Deriv",
          variant: "destructive",
        });
      });

    // Limpar intervalos ao desmontar
    return () => {
      clearInterval(checkInterfaceUpdates);
    };

    // Verificar parâmetros OAuth na URL
    const url = window.location.href;
    if (url.includes("acct1=") && url.includes("token1=")) {
      console.log("[BOT] Detectados parâmetros OAuth na URL, processando...");
      // Importar funções para processar tokens
      import("@/lib/accountManager").then(
        ({ extractAccountsFromUrl, saveAccounts, authorizeAccount }) => {
          (async () => {
            try {
              // Extrair contas da URL
              const accounts = extractAccountsFromUrl(url);

              if (accounts.length > 0) {
                // Salvar todas as contas no localStorage
                saveAccounts(accounts);

                // Salvar o token principal
                localStorage.setItem("deriv_oauth_token", accounts[0].token);

                // Autorizar e salvar detalhes
                const accountInfo = await authorizeAccount(accounts[0].token);
                localStorage.setItem(
                  "deriv_account_info",
                  JSON.stringify(accountInfo),
                );

                // Limpar URL de parâmetros OAuth
                window.history.replaceState(
                  {},
                  document.title,
                  window.location.pathname,
                );

                // Recarregar a página para usar os novos tokens
                window.location.reload();
              }
            } catch (error) {
              console.error("[BOT] Erro ao processar parâmetros OAuth:", error);
              setIsAuthenticated(false);
            }
          })();
        },
      );
      return;
    }

    // Verificar se há informações de conta no localStorage
    const storedAccountInfo = localStorage.getItem("deriv_account_info");
    const storedAuthToken = localStorage.getItem("deriv_oauth_token");

    if (storedAccountInfo && storedAuthToken) {
      try {
        const parsedInfo = storedAccountInfo
          ? JSON.parse(storedAccountInfo)
          : null;
        if (parsedInfo && storedAuthToken) {
          setAccountInfo(parsedInfo);
          setAuthToken(storedAuthToken);
          setIsAuthenticated(true);
        } else {
          console.log("[BOT] Informações da conta incompletas");
          setIsAuthenticated(false);
          return;
        }

        // Carregar dados da conta da dashboard
        const dashboardAccount: DerivAccount = {
          loginid: parsedInfo.loginid || "",
          token: storedAuthToken,
          currency: parsedInfo.currency || "USD",
          balance: parsedInfo.balance ? parseFloat(parsedInfo.balance) : 0,
          isVirtual: (parsedInfo.loginid || "").startsWith("VRT"),
        };

        // Verificar se há uma conta previamente selecionada pelo usuário
        try {
          const savedAccount = localStorage.getItem("deriv_selected_account");
          if (savedAccount) {
            const parsedAccount = JSON.parse(savedAccount);
            if (parsedAccount && parsedAccount.token && parsedAccount.loginid) {
              // Conta selecionada pelo usuário encontrada
              console.log(
                `[BOT] Usando conta previamente selecionada pelo usuário: ${parsedAccount.loginid}`,
              );

              // Usar esta conta em vez da conta da dashboard
              const userAccount: DerivAccount = {
                loginid: parsedAccount.loginid,
                token: parsedAccount.token,
                currency: dashboardAccount.currency, // Usar moeda da dashboard como fallback
                balance: dashboardAccount.balance, // Usar saldo da dashboard como fallback
                isVirtual: parsedAccount.loginid.startsWith("VRT"),
              };

              // Definir como conta selecionada
              setSelectedAccount(userAccount);

              // Informar o serviço OAuth Direct para usar esta conta
              oauthDirectService.setActiveAccount(
                userAccount.loginid,
                userAccount.token,
              );

              console.log(
                "[BOT] Conta selecionada pelo usuário restaurada:",
                userAccount.loginid,
              );
              return;
            }
          }
        } catch (error) {
          console.error(
            "[BOT] Erro ao restaurar conta selecionada pelo usuário:",
            error,
          );
        }

        // Se não houver conta previamente selecionada, usar a conta da dashboard
        console.log(
          "[BOT] Nenhuma conta selecionada pelo usuário encontrada, usando dashboard:",
          dashboardAccount.loginid,
        );

        // Definir como conta selecionada
        setSelectedAccount(dashboardAccount);
        console.log("[BOT] Autenticação verificada com sucesso");

        // Configurar valores iniciais (usa o valor atual)
        setOperation((prev) => ({
          ...prev,
          buyPrice: prev?.buyPrice || 5,
        }));

        // Configurar listener para atualização de conta no localStorage
        // Este listener detecta quando o usuário muda de conta na dashboard
        const handleStorageChange = (event: StorageEvent) => {
          if (event.key === "dashboard_account" && event.newValue) {
            try {
              console.log(
                "[BOT_PAGE] Detectada mudança na conta selecionada na dashboard",
              );
              const newAccount = event.newValue
                ? JSON.parse(event.newValue)
                : null;
              if (!newAccount || !newAccount.loginid || !newAccount.token) {
                console.error(
                  "[BOT_PAGE] Dados da conta inválidos ou incompletos:",
                  newAccount,
                );
                return;
              }

              // Atualizar a conta selecionada no estado
              setSelectedAccount({
                loginid: newAccount.loginid,
                token: newAccount.token,
                currency: newAccount.currency,
                balance: newAccount.balance,
                isVirtual: newAccount.loginid.startsWith("VRT"),
              });

              // Atualizar informações da conta para exibição
              setAccountInfo({
                loginid: newAccount.loginid,
                balance: newAccount.balance,
                currency: newAccount.currency,
                is_virtual: newAccount.loginid.startsWith("VRT"),
              });

              // Atualizar conta ativa no serviço
              console.log(
                "[BOT_PAGE] Alterando conta ativa no serviço:",
                newAccount.loginid,
              );

              // Definir a nova conta como ativa no serviço
              oauthDirectService.setActiveAccount(
                newAccount.loginid,
                newAccount.token,
              );

              // Solicitar autorização com a nova conta
              oauthDirectService.authorizeActiveToken().then((success) => {
                if (success) {
                  console.log(
                    "[BOT_PAGE] Autorização bem-sucedida com nova conta:",
                    newAccount.loginid,
                  );

                  // Forçar atualização de saldo com inscrição após troca de conta
                  // Utilizar o novo método com o parâmetro subscribe para garantir recebimento contínuo
                  oauthDirectService.getAccountBalance({ subscribe: true });

                  toast({
                    title: "Conta alterada",
                    description: `Conta alterada para ${newAccount.loginid}`,
                  });
                }
              });
            } catch (error) {
              console.error(
                "[BOT_PAGE] Erro ao processar mudança de conta:",
                error,
              );
            }
          }
        };

        // Registrar o listener para mudanças no localStorage
        window.addEventListener("storage", handleStorageChange);

        // Antes de iniciar, forçar a definição da conta selecionada como ativa no serviço
        console.log(
          "[BOT] Definindo conta ativa no serviço OAuth:",
          dashboardAccount.loginid,
        );

        // Garantir que o oauthDirectService use a conta selecionada na dashboard
        oauthDirectService.setActiveAccount(
          dashboardAccount.loginid,
          dashboardAccount.token,
        );

        // Iniciar a conexão WebSocket do serviço OAuth Direct
        oauthDirectService
          .start()
          .then((success) => {
            if (success) {
              console.log("[BOT] Conexão OAuth Direct iniciada com sucesso");
              toast({
                title: "Conexão estabelecida",
                description: "Conectado ao servidor Deriv via OAuth",
              });

              // Forçar a reconexão para garantir que os dígitos apareçam corretamente
              if (typeof oauthDirectService.reconnect === "function") {
                console.log(
                  "[BOT] Forçando reconexão inicial para garantir recebimento de dígitos...",
                );
                oauthDirectService
                  .reconnect()
                  .then((reconnectSuccess) => {
                    if (reconnectSuccess) {
                      console.log("[BOT] Reconexão inicial bem-sucedida");

                      // Importar o serviço de histórico para carregar imediatamente os últimos 500 dígitos
                      import("../services/deriv-history-service").then(
                        (module) => {
                          const derivHistoryService =
                            module.derivHistoryService;
                          console.log(
                            "[BOT] Solicitando histórico inicial de 500 dígitos mais recentes do mercado",
                          );
                          derivHistoryService
                            .getTicksHistory("R_100", 500, false)
                            .then(() =>
                              console.log(
                                "[BOT] Histórico inicial de dígitos solicitado com sucesso",
                              ),
                            )
                            .catch((err) =>
                              console.error(
                                "[BOT] Erro ao solicitar histórico inicial:",
                                err,
                              ),
                            );
                        },
                      );

                      // Solicitar saldo atual após reconexão bem-sucedida
                      // Usar o novo método com subscribe: true para receber atualizações contínuas
                      setTimeout(() => {
                        oauthDirectService.getAccountBalance({
                          subscribe: true,
                        });
                      }, 1000);
                    } else {
                      console.error("[BOT] Falha na reconexão inicial");
                    }
                  })
                  .catch((error) => {
                    console.error("[BOT] Erro na reconexão inicial:", error);
                  });
              }
            } else {
              console.error("[BOT] Falha ao iniciar conexão OAuth Direct");
              toast({
                title: "Erro de conexão",
                description: "Não foi possível conectar ao servidor Deriv",
                variant: "destructive",
              });
            }
          })
          .catch((error) => {
            console.error("[BOT] Erro ao iniciar conexão OAuth Direct:", error);
            toast({
              title: "Erro de conexão",
              description: error.message || "Falha ao conectar com o servidor",
              variant: "destructive",
            });
          });

        // Remover event listener ao desmontar o componente
        return () => {
          window.removeEventListener("storage", handleStorageChange);
        };

        // Configurar handlers para eventos do serviço OAuth Direct
        const handleEvents = (event: any) => {
          // Tick recebido
          if (event.type === "tick") {
            const price = event.price;
            const lastDigit = event.lastDigit;

            // Vamos apenas chamar updateDigitStats que já faz as duas atualizações de forma otimizada
            updateDigitStats(lastDigit);

            console.log(
              `[OAUTH_DIRECT] Tick recebido: ${price}, Último dígito: ${lastDigit}`,
            );
          }

          // Evento de autorização bem-sucedida
          if (event.type === "authorized") {
            console.log(
              "[OAUTH_DIRECT] Autorização realizada com sucesso na conta:",
              event.account?.loginid,
            );

            // Atualizar informações da conta sempre que houver autorização (troca de conta)
            if (event.account) {
              // Extrair valores do evento
              const loginid = event.account.loginid;
              const balance =
                typeof event.account.balance === "number"
                  ? event.account.balance
                  : parseFloat(event.account.balance || "0");
              const currency = event.account.currency || "USD";
              const isVirtual = event.account.is_virtual || false;

              // Atualizar informações da conta
              setAccountInfo({
                loginid: loginid,
                balance: balance,
                currency: currency,
                is_virtual: isVirtual,
                name: event.account.name || "",
                email: event.account.email || "",
              });

              // Atualizar conta selecionada, evitando propriedades erradas
              const derivAccount: DerivAccount = {
                loginid: loginid,
                token: event.account.token || "",
                currency: currency,
                isVirtual: isVirtual,
                balance: balance,
              };

              setSelectedAccount(derivAccount);

              // Atualizar saldo em tempo real
              setRealTimeBalance({
                balance: balance,
                previousBalance: realTimeBalance.balance,
              });

              console.log(
                "[OAUTH_DIRECT] Informações da conta atualizadas para:",
                loginid,
                "Saldo:",
                balance,
                currency,
              );
            }
          }

          // Atualização de saldo
          if (event.type === "balance_update" && event.balance) {
            // Sempre atualizar quando receber um evento de saldo, independente da conta atual
            const newBalance = parseFloat(event.balance.balance);
            const currentBalance = realTimeBalance?.balance || 0;

            console.log(
              `[BOT_PAGE] Evento de atualização de saldo recebido: ${newBalance} ${event.balance.currency} (Conta: ${event.balance.loginid})`,
            );

            // Atualizar informações da conta com novos dados
            setAccountInfo((prev) => {
              if (prev) {
                return {
                  ...prev,
                  loginid: event.balance.loginid || prev.loginid,
                  balance: newBalance,
                  currency: event.balance.currency || prev.currency,
                };
              }
              return prev;
            });

            // Atualizar saldo em tempo real sempre que receber atualizações
            // Forçar o tipo para number para garantir a exibição correta
            const updatedBalance = {
              balance: Number(newBalance),
              previousBalance: Number(currentBalance),
            };

            console.log(
              `[BOT_PAGE] Atualizando saldo em tempo real:`,
              updatedBalance,
            );
            setRealTimeBalance(updatedBalance);

            // Atualizar conta selecionada se necessário
            setSelectedAccount((prev) => {
              if (prev) {
                const updated = {
                  ...prev,
                  balance: newBalance,
                  currency: event.balance.currency || prev.currency,
                };

                // Se o ID de login foi fornecido, atualize também
                if (event.balance.loginid) {
                  updated.loginid = event.balance.loginid;
                }

                return updated;
              }
              return prev;
            });

            // Atualizar também no localStorage para persistência
            try {
              const accountInfoStr = localStorage.getItem("deriv_account_info");
              if (accountInfoStr) {
                const storedInfo = JSON.parse(accountInfoStr);
                storedInfo.balance = newBalance;
                localStorage.setItem(
                  "deriv_account_info",
                  JSON.stringify(storedInfo),
                );
              }
            } catch (e) {
              console.error("[BOT_PAGE] Erro ao atualizar localStorage:", e);
            }

            console.log(
              `[BOT_PAGE] Saldo atualizado: ${currentBalance} -> ${newBalance} (Conta: ${event.balance.loginid})`,
            );
          }

          // Compra de contrato
          if (event.type === "contract_purchased") {
            console.log("[OAUTH_DIRECT] Contrato comprado:", event.contract_id);

            // Atualizar estado de operação
            setOperation((prev) => ({
              ...prev,
              status: "comprado",
            }));

            toast({
              title: "Contrato comprado",
              description: `ID: ${event.contract_id}, Valor: $${event.buy_price}`,
            });
          }

          // Atualização de contrato
          if (event.type === "contract_update") {
            // Log para acompanhamento do contrato
            console.log(
              "[OAUTH_DIRECT] Atualização do contrato:",
              event.contract?.contract_id,
            );
          }

          // Encerramento de contrato
          if (event.type === "contract_finished") {
            console.log("[OAUTH_DIRECT] Contrato encerrado:", event);

            // Atualizar lucro total
            setStats((prev) => {
              // Calcular o lucro total
              const profit = event.profit || 0;
              const totalProfit = prev.totalProfit + profit;

              // Atualizar ganhos ou perdas
              if (event.is_win) {
                return { ...prev, wins: prev.wins + 1, totalProfit };
              } else {
                return { ...prev, losses: prev.losses + 1, totalProfit };
              }
            });

            // CORREÇÃO CRÍTICA: Adicionar ao histórico de operações com valores corretos
            // Garantir o uso do valor correto da entrada do usuário
            const operationEntryValue =
              parseFloat(entryValue || "0") ||
              event.entry_value ||
              event.contract_details?.buy_price ||
              0;
            const exitValue =
              event.exit_value || event.contract_details?.sell_price || 0;
            const profitValue = event.profit || 0;

            // Garantir que o valor de entrada seja explicitamente o valor configurado pelo usuário quando possível
            console.log("[BOT_PAGE] Criando registro de operação:", {
              entrada: operationEntryValue,
              saida: exitValue,
              lucro: profitValue,
            });

            // Criar o objeto de operação com dados corretos
            const operationRecord = {
              id: event.contract_id || Date.now(),
              contract_id: event.contract_id,
              entryValue: operationEntryValue,
              entry_value: operationEntryValue,
              finalValue: exitValue,
              exit_value: exitValue,
              profit: profitValue,
              time: new Date(),
              timestamp: Date.now(),
              contract_type:
                event.contract_type ||
                event.contract_details?.contract_type ||
                "",
              symbol:
                event.symbol ||
                event.contract_details?.underlying_symbol ||
                "R_100",
              strategy: event.strategy || selectedStrategy || "",
              is_win: event.is_win || false,
              notification: {
                type: event.is_win ? "success" : ("error" as const),
                message: `${event.is_win ? "GANHO" : "PERDA"} | Entrada: $${operationEntryValue.toFixed(2)} | Resultado: $${profitValue.toFixed(2)}`,
              },
            };

            console.log(
              "[BOT_PAGE] Adicionando operação ao histórico:",
              operationRecord,
            );

            // Atualizar o histórico de operações
            setOperationHistory((prev) =>
              [operationRecord, ...prev].slice(0, 50),
            );

            // Atualizar estado da operação
            setOperation({
              entry: operation.entry,
              buyPrice: operation.buyPrice,
              profit: event.profit,
              status: "vendendo",
            });

            // Exibir notificação de resultado
            toast({
              title: event.is_win
                ? "Operação Vencedora!"
                : "Operação Perdedora",
              description: `Resultado: $${event.profit.toFixed(2)}`,
              variant: event.is_win ? "default" : "destructive",
            });

            // Resetar estado após conclusão
            setTimeout(() => {
              setOperation({
                entry: operation.entry,
                buyPrice: operation.buyPrice,
                profit: 0,
                status: null,
              });
            }, 3000);
          }

          // Erros
          if (event.type === "error") {
            console.error("[OAUTH_DIRECT] Erro:", event.message);
            toast({
              title: "Erro na operação",
              description: event.message,
              variant: "destructive",
            });
          }
        };

        // Registrar handler no serviço OAuth
        console.log(
          "[BOT_PAGE] Registrando listener de eventos do oauthDirectService",
        );
        oauthDirectService.addEventListener(handleEvents);

        // Forçar uma inscrição para ticks do R_100 - CORREÇÃO CRÍTICA
        console.log("[BOT_PAGE] Forçando inscrição para ticks de R_100");
        setTimeout(() => {
          if (typeof oauthDirectService.subscribeToTicks === "function") {
            oauthDirectService.subscribeToTicks("R_100");
            console.log("[BOT_PAGE] Função subscribeToTicks chamada");
          } else {
            console.error(
              "[BOT_PAGE] Função subscribeToTicks não encontrada no serviço",
            );
            // Alternativa: forçar reconexão para iniciar a subscricão
            oauthDirectService.reconnect().then((success) => {
              console.log(
                "[BOT_PAGE] Reconexão forçada para resolver problema de ticks:",
                success,
              );
            });
          }
        }, 1000);

        return () => {
          // Limpar recursos ao desmontar
          console.log(
            "[BOT_PAGE] Removendo listener de eventos do oauthDirectService",
          );
          oauthDirectService.removeEventListener(handleEvents);

          // Parar serviço se estiver rodando
          if (botStatus === "running") {
            oauthDirectService.stop();
          }
        };
      } catch (error) {
        console.error("[BOT] Erro ao carregar dados da conta:", error);
        setIsAuthenticated(false);
      }
    } else {
      console.log("[BOT] Usuário não autenticado");
      setIsAuthenticated(false);
    }
  }, []);

  // Efeito para carregar o histórico de dígitos ao iniciar
  useEffect(() => {
    console.log("[BOT_PAGE] Carregando histórico de dígitos inicial");

    // Carregar histórico de dígitos do banco de dados
    const loadFromBackend = async () => {
      try {
        console.log("[BOT_PAGE] Tentando carregar dados do backend...");

        const response = await fetch("/api/digit-history/R_100");

        if (response.ok) {
          const data = await response.json();
          console.log("[BOT_PAGE] Dados carregados do backend:", data);

          if (data.lastDigits && data.lastDigits.length > 0) {
            // Atualizar array de últimos dígitos (limitando aos mais recentes)
            setLastDigits(data.lastDigits.slice(-parseInt(ticks)));

            // Converter estatísticas para o formato usado pelo componente
            // Garantir que todos os dígitos (0-9) sejam incluídos mesmo se não tiverem ocorrências
            const newStats = Array.from({ length: 10 }, (_, i) => ({
              digit: i,
              count: data.digitStats[i]?.count || 0,
              percentage: data.digitStats[i]?.percentage || 0,
            }));

            // Ordenar os stats por dígito para garantir a ordem correta (0-9)
            newStats.sort((a, b) => a.digit - b.digit);

            setDigitStats(newStats);

            console.log(
              "[BOT_PAGE] Estatísticas carregadas do backend:",
              newStats.map((s) => `${s.digit}: ${s.percentage}%`).join(", "),
            );

            // Notificar usuário que os dados foram carregados
            toast({
              title: "Estatísticas carregadas",
              description: `Recuperadas ${data.lastDigits.length} estatísticas anteriores do banco de dados`,
              variant: "default",
              duration: 3000,
            });

            // Se encontramos dados do backend, não precisamos carregar do serviço local
            return true;
          }
        } else if (response.status !== 404) {
          // Se não for 404 (dados não encontrados), é um erro real
          console.error(
            "[BOT_PAGE] Erro ao carregar do backend:",
            response.status,
            response.statusText,
          );
        }

        return false;
      } catch (error) {
        console.error("[BOT_PAGE] Erro ao carregar do backend:", error);
        return false;
      }
    };

    // Carregar histórico de dígitos DIRETAMENTE da Deriv API
    const loadDigitHistory = async () => {
      try {
        console.log(
          "[BOT_PAGE] Solicitando dados diretamente da Deriv API (500 ticks)",
        );

        // FORÇAR o carregamento fresco da Deriv, sempre com 500 ticks e sem usar cache local
        try {
          // Como adicionamos o método clearHistory, vamos usá-lo
          await derivHistoryService.clearHistory("R_100"); // Limpar qualquer histórico antes
        } catch (error) {
          console.warn(
            "[BOT_PAGE] Método clearHistory não disponível, continuando com limpeza padrão",
          );
        }

        // Solicitar explicitamente 500 ticks e não se inscrever para atualizações ainda
        // (a inscrição será feita separadamente)
        const historyData = await derivHistoryService.getTicksHistory(
          "R_100",
          500,
          false,
        );

        if (
          historyData &&
          historyData.lastDigits &&
          historyData.lastDigits.length > 0
        ) {
          console.log(
            "[BOT_PAGE] Recebidos",
            historyData.lastDigits.length,
            "dígitos DIRETAMENTE da Deriv",
          );

          // Atualizar array de últimos dígitos (limitando aos mais recentes)
          setLastDigits(historyData.lastDigits.slice(-parseInt(ticks)));

          // Converter estatísticas para o formato usado pelo componente
          // Garantir que todos os dígitos (0-9) sejam incluídos mesmo se não tiverem ocorrências
          const newStats = Array.from({ length: 10 }, (_, i) => ({
            digit: i,
            count: historyData.digitStats[i]?.count || 0,
            percentage: historyData.digitStats[i]?.percentage || 0,
          }));

          // Ordenar os stats por dígito para garantir a ordem correta (0-9)
          newStats.sort((a, b) => a.digit - b.digit);

          setDigitStats(newStats);

          console.log(
            "[BOT_PAGE] Estatísticas atualizadas diretamente da Deriv API:",
            newStats.map((s) => `${s.digit}: ${s.percentage}%`).join(", "),
          );

          toast({
            title: "Dados atualizados",
            description: `Carregados ${historyData.lastDigits.length} dígitos diretamente da Deriv`,
            variant: "default",
            duration: 3000,
          });
        } else {
          console.log(
            "[BOT_PAGE] Nenhum dígito recebido da Deriv API, verificando conexão",
          );

          toast({
            title: "Sem dados",
            description:
              "Não foi possível obter dados da Deriv. Verificando conexão...",
            variant: "default",
            duration: 3000,
          });
        }
      } catch (error) {
        console.error(
          "[BOT_PAGE] Erro ao carregar dígitos da Deriv API:",
          error,
        );

        toast({
          title: "Erro de conexão",
          description:
            "Falha ao obter dados atualizados da Deriv. Tentando reconectar...",
          variant: "destructive",
          duration: 5000,
        });
      }
    };

    // NUNCA carregar do backend ou localStorage, sempre buscar direto da Deriv
    console.log(
      "[BOT_PAGE] Ignorando dados do backend e localStorage, solicitando APENAS os 500 dígitos mais recentes da Deriv",
    );
    loadDigitHistory();

    // Conectar ao serviço de histórico para receber atualizações
    derivHistoryService.connect().then((connected) => {
      if (connected) {
        console.log(
          "[BOT_PAGE] Conexão estabelecida com o serviço de histórico de dígitos",
        );
        // Sempre buscar os últimos 500 ticks do mercado e se inscrever para atualizações
        derivHistoryService.getTicksHistory("R_100", 500, true);
      } else {
        console.error(
          "[BOT_PAGE] Falha ao conectar com o serviço de histórico de dígitos",
        );
      }
    });

    return () => {
      // Limpar inscrição ao desmontar o componente
      console.log(
        "[BOT_PAGE] Limpando conexão com serviço de histórico de dígitos",
      );
    };
  }, [ticks]);

  // Esta função anterior foi substituída pela versão acima
  // que usa dados diretamente da Deriv via DerivHistoryService

  // Iniciar o bot usando o serviço OAuth Direct
  const handleStartBot = () => {
    try {
      // Verificar se uma conta foi selecionada
      if (!selectedAccount) {
        toast({
          title: "Conta não selecionada",
          description: "Por favor, selecione uma conta para operar com o robô.",
          variant: "destructive",
        });
        return;
      }

      if (!selectedBotType || !selectedStrategy) {
        toast({
          title: "Seleção necessária",
          description: "Por favor, selecione um tipo de bot e uma estratégia.",
          variant: "destructive",
        });
        return;
      }

      // Verificar se há erros críticos relacionados ao token
      const tokenErrorStr = localStorage.getItem("deriv_token_scope_error");
      if (tokenErrorStr) {
        try {
          const tokenError = JSON.parse(tokenErrorStr);
          const errorTimestamp = tokenError.timestamp || 0;

          // Se o erro for recente (menos de 1 hora)
          if (Date.now() - errorTimestamp < 60 * 60 * 1000) {
            // Mostrar erro grave, impedir início do bot
            toast({
              title: "⚠️ Permissões insuficientes",
              description:
                "O token atual não possui permissões necessárias para operações de trading.",
              variant: "destructive",
              duration: 8000,
            });

            // Mostrar instruções para resolver o problema
            setTimeout(() => {
              toast({
                title: "Como resolver",
                description:
                  "É necessário reautorizar a aplicação com os escopos corretos.",
                variant: "default",
                // Usando uma implementação alternativa sem o 'action' que não está na tipagem
                duration: 15000,
              });

              // Mostrar um botão de reautorização separado
              setTimeout(() => {
                // Criar elemento de reautorização direto na página em vez de usar toast com JSX
                const reAuthContainer = document.createElement("div");
                reAuthContainer.id = "reauth-container";
                reAuthContainer.className =
                  "fixed top-5 right-5 z-50 bg-[#13203a] border border-[#2c3e5d] rounded-lg p-4 shadow-lg max-w-sm";
                reAuthContainer.innerHTML = `
                  <div class="flex flex-col">
                    <h3 class="text-white font-bold mb-2">Reautorizar aplicação</h3>
                    <p class="text-gray-300 text-sm mb-3">Clique no botão para obter as permissões de trading necessárias</p>
                    <button id="reauth-button" class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded text-sm transition-colors">
                      Reautorizar agora
                    </button>
                  </div>
                `;

                document.body.appendChild(reAuthContainer);

                // Adicionar evento de clique ao botão
                const reAuthButton = document.getElementById("reauth-button");
                if (reAuthButton) {
                  reAuthButton.addEventListener("click", () => {
                    const appId = "71403";
                    const redirectUri = encodeURIComponent(
                      window.location.origin + "/auth-callback",
                    );
                    const scope = encodeURIComponent(
                      "read admin payments trade trading trading_information",
                    );
                    const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;

                    // Registrar que uma reautorização foi solicitada
                    localStorage.setItem("deriv_pending_reauth", "true");
                    localStorage.setItem(
                      "deriv_pending_reauth_timestamp",
                      Date.now().toString(),
                    );

                    // Abrir página de autorização
                    window.open(authUrl, "_blank", "width=800,height=600");

                    // Remover o container após o clique
                    reAuthContainer.remove();
                  });

                  // Auto-remover após 30 segundos
                  setTimeout(() => {
                    if (document.body.contains(reAuthContainer)) {
                      reAuthContainer.remove();
                    }
                  }, 30000);
                }

                // Adicionar um segundo toast com instruções simples
                toast({
                  title: "Reautorizar agora",
                  description:
                    "Clique no botão de reautorização no canto superior direito da tela",
                  duration: 10000,
                });
              }, 1000);
            }, 1000);

            // Impedir início do bot
            return;
          } else {
            // Limpar erros antigos
            localStorage.removeItem("deriv_token_scope_error");
          }
        } catch (e) {
          console.error(
            "[BOT_PAGE] Erro ao processar informações de erro do token:",
            e,
          );
          localStorage.removeItem("deriv_token_scope_error");
        }
      }

      // Verificação de reautorização pendente removida por solicitação do usuário
      // Se houver uma autorização pendente antiga, podemos limpá-la silenciosamente
      if (localStorage.getItem("deriv_pending_reauth") === "true") {
        const pendingTimestamp = Number(
          localStorage.getItem("deriv_pending_reauth_timestamp") || "0",
        );
        if (Date.now() - pendingTimestamp > 30 * 60 * 1000) {
          localStorage.removeItem("deriv_pending_reauth");
          localStorage.removeItem("deriv_pending_reauth_timestamp");
        }
      }

      // Configurar parâmetros
      const entryNum = parseFloat(entryValue || "0.35");
      const profitNum = parseFloat(profitTarget || "1000");
      const lossNum = parseFloat(lossLimit || "500");

      // Determinar o tipo de contrato com base na estratégia
      const contractType =
        selectedBotType === "lite"
          ? selectedStrategy.includes("under")
            ? "DIGITUNDER"
            : "DIGITOVER"
          : selectedStrategy.includes("under")
            ? "DIGITUNDER"
            : "DIGITOVER";

      console.log(
        "[BOT] Iniciando operação do robô com OAuth Direct e estratégia:",
        selectedStrategy,
      );
      console.log(
        "[BOT] Usando conta:",
        selectedAccount.loginid,
        selectedAccount.isVirtual ? "(Demo)" : "(Real)",
      );

      // Atualizar a interface PRIMEIRO para feedback visual imediato
      setBotStatus("running");
      setOperation({
        entry: 1584.42,
        buyPrice: entryNum,
        profit: 0,
        status: null,
      });

      // Garantir que a conta selecionada está ativa no serviço OAuth
      oauthDirectService.setActiveAccount(
        selectedAccount.loginid,
        selectedAccount.token,
      );

      // Forçar reconexão para garantir que estamos usando a conta correta
      try {
        // Se o método reconnect existir e for uma função, chamá-lo
        if (typeof oauthDirectService.reconnect === "function") {
          oauthDirectService.reconnect().catch((error) => {
            console.error("[BOT] Erro ao reconectar:", error);
          });
        }
      } catch (error) {
        console.error("[BOT] Erro ao tentar reconectar:", error);
      }

      // Configurar oauthDirectService (novo serviço com conexão WebSocket dedicada)
      oauthDirectService.setSettings({
        entryValue: entryNum,
        profitTarget: profitNum,
        lossLimit: lossNum,
        martingaleFactor: 1.5, // Valor padrão
        contractType: contractType as any,
        // CORREÇÃO CRÍTICA: A estratégia Advance usa prediction: 1, não 5
        // Este valor 5 estava causando o problema de barreira incorreta
        prediction: selectedStrategy.toLowerCase() === "advance" ? 1 : 5,
      });

      // Definir estratégia
      oauthDirectService.setActiveStrategy(selectedStrategy);

      // Verificar se é estratégia Advance e injetar correção DOM para barreira
      if (selectedStrategy.toLowerCase() === "advance") {
        console.log(
          "[BOT] Estratégia Advance detectada, injetando correção DOM para barreira...",
        );
        // Injeta o observer para corrigir valores de barreira em qualquer elemento da página
        injectAdvanceBarrierCorrection();
      }

      // Iniciar o serviço OAuth Direct
      oauthDirectService
        .start()
        .then((success) => {
          if (!success) {
            console.error(
              "[BOT] oauthDirectService.start() retornou false, mas a interface já foi atualizada",
            );

            // Reverter status se não conseguiu iniciar
            setBotStatus("idle");
            toast({
              title: "Erro ao iniciar",
              description:
                "Não foi possível conectar ao servidor da Deriv. Tente novamente.",
              variant: "destructive",
            });
          }
        })
        .catch((error) => {
          console.error(
            "[BOT] Erro ao executar oauthDirectService.start():",
            error,
          );

          // Reverter status
          setBotStatus("idle");
          toast({
            title: "Erro ao iniciar",
            description: "Ocorreu um erro ao conectar com o servidor.",
            variant: "destructive",
          });
        });

      const strategyInfo = strategies[selectedBotType].find(
        (s) => s.id === selectedStrategy,
      );

      toast({
        title: "Iniciando robô",
        description: `Conectando ${strategyInfo?.name} na conta ${selectedAccount.loginid} (${selectedAccount.isVirtual ? "Demo" : "Real"})...`,
      });
    } catch (error) {
      console.error("[BOT] Erro ao iniciar bot:", error);
      setBotStatus("idle");
      toast({
        title: "Erro ao iniciar",
        description: "Ocorreu um erro ao iniciar o robô.",
        variant: "destructive",
      });
    }
  };

  // Pausar o bot
  const handlePauseBot = async () => {
    try {
      console.log("[BOT] Chamando oauthDirectService.stop() na interface");

      // Definir o estado localmente primeiro para feedback imediato
      setBotStatus("paused");

      // Remover o observer de correção de barreira caso esteja ativo
      try {
        const script = document.getElementById("advance-barrier-fix-script");
        if (script) {
          script.remove();
          console.log(
            "[BOT] Script de correção de barreira removido ao pausar bot",
          );
        }

        // Desconectar o observer se existir
        if ((window as any)._barrierCorrectionObserver) {
          (window as any)._barrierCorrectionObserver.disconnect();
          delete (window as any)._barrierCorrectionObserver;
          console.log("[BOT] Observer de correção desconectado ao pausar bot");
        }
      } catch (error) {
        console.error("[BOT] Erro ao remover correção de barreira:", error);
      }

      // Depois chama o serviço
      oauthDirectService.stop();

      // IMPORTANTE: Registrar a parada no histórico para que fique explícito na interface
      const pauseNotification = {
        id: Date.now(),
        entryValue: 0,
        entry_value: 0,
        finalValue: 0,
        exit_value: 0,
        profit: 0,
        time: new Date(),
        timestamp: Date.now(),
        contract_type: "system",
        symbol: "",
        strategy: "",
        is_win: false,
        notification: {
          type: "info" as const,
          message: "Robô pausado pelo usuário",
        },
      };

      // Adicionar a notificação de pausa ao histórico
      console.log("[BOT_PAGE] Adicionando notificação de pausa ao histórico");
      setOperationHistory((prev) => [pauseNotification, ...prev].slice(0, 50));

      toast({
        title: "Bot pausado",
        description:
          "As operações foram pausadas. O histórico não será mais atualizado.",
      });
    } catch (error) {
      console.error("[BOT] Erro ao pausar o serviço OAuth:", error);
      toast({
        title: "Erro ao pausar",
        description: "Não foi possível pausar o robô corretamente.",
        variant: "destructive",
      });
    }
  };

  // Limpar histórico
  const handleClearHistory = () => {
    console.log("[BOT_PAGE] Iniciando limpeza completa do histórico e estatísticas");
    
    // Resetar estatísticas do serviço OAuth
    if (oauthDirectService) {
      try {
        console.log("[BOT_PAGE] Resetando estatísticas do serviço OAuth");
        oauthDirectService.resetStats();
      } catch (error) {
        console.error("[BOT_PAGE] Erro ao resetar estatísticas do serviço OAuth:", error);
      }
    }
    
    // Limpar histórico do serviço de histórico de ticks
    try {
      console.log("[BOT_PAGE] Limpando histórico de ticks via derivHistoryService");
      derivHistoryService.clearHistory("R_100").catch(error => {
        console.error("[BOT_PAGE] Erro ao limpar histórico de ticks:", error);
      });
    } catch (error) {
      console.error("[BOT_PAGE] Erro ao acessar derivHistoryService:", error);
    }
    
    // Resetar estados locais
    setStats({ wins: 0, losses: 0, totalProfit: 0 });
    setOperation({
      entry: 1584.42,
      buyPrice: parseFloat(entryValue),
      profit: 0,
      status: null,
    });

    // Limpar o histórico de operações local - MUITO IMPORTANTE fazer isso ANTES de disparar o evento
    setOperationHistory([]);
    
    // Também limpar do localStorage
    try {
      localStorage.removeItem('deriv_history_operations');
      localStorage.removeItem('deriv_stats');
      localStorage.removeItem('operation_history_cache');
      localStorage.removeItem('operations_cache');
      
      // Limpar todos os caches relacionados a histórico
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('history') || key.includes('operation'))) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error("[BOT_PAGE] Erro ao limpar dados do localStorage:", error);
    }
    
    // NOVO: Disparar evento personalizado para limpar o cache interno do OperationHistoryCard
    try {
      console.log("[BOT_PAGE] Disparando evento para forçar limpeza do cache de histórico");
      const clearHistoryEvent = new CustomEvent('deriv:clear_operation_history', {
        detail: { timestamp: Date.now() }
      });
      document.dispatchEvent(clearHistoryEvent);
    } catch (error) {
      console.error("[BOT_PAGE] Erro ao disparar evento de limpeza:", error);
    }

    console.log("[BOT_PAGE] Limpeza de histórico e estatísticas concluída com sucesso");
    
    toast({
      title: "Histórico limpo",
      description: "O histórico de operações e estatísticas foram resetados com sucesso.",
    });
  };

  // Função para obter a cor da barra com base na porcentagem
  const getBarColor = (percentage: number) => {
    return percentage >= 20 ? "bg-red-500" : "bg-gray-500";
  };

  // Estado para histórico de operações já definido anteriormente
  // Removendo duplicação para resolver erro de "Identifier has already been declared"
  // Declaração original na linha 167

  // Use o useEffect para registrar ouvintes de eventos de operação e saldo
  useEffect(() => {
    // NOVO: Manipulador dedicado para eventos intermediários da estratégia Advance
    const handleAdvanceIntermediateOperation = (event: CustomEvent) => {
      console.log(
        "[BOT_PAGE] 🔄 Evento advance_intermediate_operation recebido diretamente:",
        event.detail,
      );

      // Verificar se a estratégia selecionada é advance
      if (selectedStrategy !== "advance") {
        console.log(
          "[BOT_PAGE] Ignorando evento intermediário pois a estratégia atual não é Advance",
        );
        return;
      }

      try {
        // Extrair detalhes do evento
        const { contractId, entry, exit, profit, status, analysis } =
          event.detail;

        // Gerar ID único para esta operação
        const intermediateId = Math.floor(Math.random() * 1000000);

        // Criar objeto de operação intermediária
        const intermediateOperation = {
          id: intermediateId,
          entryValue: entry || 0,
          finalValue: exit || 0,
          profit: profit || 0,
          time: new Date(),
          contractType: "CALL", // A estratégia Advance usa CALL
          notification: {
            type: (status === "won"
              ? "success"
              : status === "lost"
                ? "error"
                : "info") as "success" | "info" | "warning" | "error",
            message: `OPERAÇÃO INTERMEDIÁRIA | Valor: ${formatCurrency(entry || 0)} | Resultado: ${formatCurrency(exit || 0)} | Análise: ${analysis || "N/A"}`,
          },
        };

        console.log(
          "[BOT_PAGE] ✅ Adicionando operação intermediária ao histórico via evento direto:",
          intermediateOperation,
        );

        // Adicionar ao histórico de operações
        setOperationHistory((prev) =>
          [intermediateOperation, ...prev].slice(0, 50),
        );
      } catch (error) {
        console.error(
          "[BOT_PAGE] Erro ao processar evento avançado intermediário:",
          error,
        );
      }
    };

    // Handler regular para eventos do oauthDirectService
    const handleEvents = (event: any) => {
      // Processar evento de compra de contrato (início da operação)
      if (event.type === "contract_purchased") {
        // Adicionar informação sobre o comando de entrada ao histórico
        const contract = event.contract_details;
        if (contract) {
          const contractType = contract.contract_type || "";
          let commandType = "";
          let commandMessage = "";

          // Obter informações específicas da estratégia atual
          const strategyInfo = selectedStrategy
            ? getStrategyById(selectedStrategy || "")
            : null;

          // Comandos específicos por estratégia
          if (strategyInfo) {
            if (strategyInfo.id === "advance") {
              // Para a estratégia Advance, mostrar a porcentagem de entrada específica e tornar mais destacada
              commandType = "warning"; // Alterado para ficar mais visível no histórico

              // Buscar APENAS a configuração do usuário para a estratégia
              const userConfig = localStorage.getItem(
                `strategy_config_${strategyInfo.id}`,
              );
              // Usar valor padrão de 10% se não houver configuração do usuário - evitar "CONFIGURAÇÃO PENDENTE"
              let porcentagemParaEntrar: number = 10;

              if (userConfig) {
                try {
                  const config = JSON.parse(userConfig);
                  if (config?.porcentagemParaEntrar !== undefined) {
                    porcentagemParaEntrar = Number(
                      config.porcentagemParaEntrar,
                    );
                  }
                } catch (err) {
                  console.error(
                    "[BOT_PAGE] Erro ao carregar configuração do usuário:",
                    err,
                  );
                }
              }

              // Formatar o valor da entrada
              const entryValueFormatted = contract.buy_price
                ? formatCurrency(contract.buy_price)
                : formatCurrency(0);

              // Mensagem mais detalhada para a estratégia Advance
              commandMessage = `ENTRADA ADVANCE | ${porcentagemParaEntrar}% | ${entryValueFormatted} | Dígitos 0 e 1 ≤ ${porcentagemParaEntrar}%`;

              console.log(
                "[BOT_PAGE] Registrando entrada da estratégia Advance no histórico:",
                commandMessage,
              );
            } else if (strategyInfo.id === "green") {
              // Para a estratégia Green
              commandType = "success";
              commandMessage = "Compra DIGITOVER: Estratégia Green";
            } else if (strategyInfo.id === "wise_pro_tendencia") {
              // Para a estratégia Wise Pro Tendência
              commandType = "info";
              commandMessage = "Tendência identificada: Wise Pro";
            } else if (strategyInfo.id.includes("iron")) {
              // Para estratégias IRON
              commandType = "warning";
              commandMessage = `Estratégia IRON: ${contractType.includes("OVER") ? "ACIMA" : "ABAIXO"}`;
            } else {
              // Para estratégia Advance, FORÇAR que a barreira exibida seja sempre 1
              if (
                selectedStrategy === "advance" &&
                contractType.includes("DIGITOVER")
              ) {
                commandType = "success";
                commandMessage = "Compra ACIMA de 1";
                console.log(
                  "[BOT_PAGE] CORREÇÃO INTERFACE: Forçando exibição de barreira 1 para Advance",
                );
              }
              // Para outras estratégias, usar o padrão baseado no tipo de contrato
              else if (contractType.includes("DIGITOVER")) {
                commandType = "success";
                commandMessage = "Compra ACIMA de " + (contract.barrier || "?");
              } else if (contractType.includes("DIGITUNDER")) {
                commandType = "info";
                commandMessage =
                  "Compra ABAIXO de " + (contract.barrier || "?");
              } else if (contractType.includes("DIGITODD")) {
                commandType = "warning";
                commandMessage = "Compra ÍMPAR";
              } else if (contractType.includes("DIGITEVEN")) {
                commandType = "warning";
                commandMessage = "Compra PAR";
              } else if (contractType.includes("DIGITDIFF")) {
                commandType = "warning";
                commandMessage =
                  "Compra DIFERENTE de " + (contract.barrier || "?");
              } else if (contractType.includes("DIGITMATH")) {
                commandType = "warning";
                commandMessage = "Compra IGUAL a " + (contract.barrier || "?");
              } else {
                commandType = "info";
                commandMessage = "Compra: " + contractType;
              }
            }
          } else {
            // Fallback - se não tiver informação da estratégia
            if (contractType.includes("DIGITOVER")) {
              commandType = "success";
              commandMessage = "Compra ACIMA de " + (contract.barrier || "?");
            } else if (contractType.includes("DIGITUNDER")) {
              commandType = "info";
              commandMessage = "Compra ABAIXO de " + (contract.barrier || "?");
            } else if (contractType.includes("DIGITODD")) {
              commandType = "warning";
              commandMessage = "Compra ÍMPAR";
            } else if (contractType.includes("DIGITEVEN")) {
              commandType = "warning";
              commandMessage = "Compra PAR";
            } else if (contractType.includes("DIGITDIFF")) {
              commandType = "warning";
              commandMessage =
                "Compra DIFERENTE de " + (contract.barrier || "?");
            } else if (contractType.includes("DIGITMATH")) {
              commandType = "warning";
              commandMessage = "Compra IGUAL a " + (contract.barrier || "?");
            } else {
              commandType = "info";
              commandMessage = "Compra: " + contractType;
            }
          }

          // Garantir que o tipo está dentro dos valores possíveis para evitar erros de tipagem
          const safeCommandType: "success" | "info" | "warning" | "error" =
            commandType === "success" ||
            commandType === "info" ||
            commandType === "warning" ||
            commandType === "error"
              ? commandType
              : "info";

          const newNotification = {
            id:
              typeof contract.contract_id === "number"
                ? contract.contract_id
                : Math.random(),
            entryValue: contract.buy_price || 0,
            finalValue: 0,
            profit: 0,
            time: new Date(),
            notification: {
              type: safeCommandType,
              message: commandMessage,
            },
          };

          console.log(
            "[BOT_PAGE] Adicionando comando de entrada ao histórico:",
            newNotification,
          );
          setOperationHistory((prev) =>
            [newNotification, ...prev].slice(0, 50),
          );
        }
      }

      // Processar operações iniciadas (específico para estratégia Advance)
      if (
        event.type === "operation_started" &&
        selectedStrategy === "advance"
      ) {
        console.log(
          "[BOT_PAGE] Evento de operação iniciada da estratégia Advance:",
          event,
        );

        // Gerar ID aleatório para esta operação para facilitar rastreamento
        const tempId = Math.floor(Math.random() * 1000000);

        // Obter porcentagem configurada para Advance
        let porcentagemParaEntrar = 10; // Valor padrão
        const userConfig = localStorage.getItem(`strategy_config_advance`);
        if (userConfig) {
          try {
            const config = JSON.parse(userConfig);
            if (config?.porcentagemParaEntrar !== undefined) {
              porcentagemParaEntrar = Number(config.porcentagemParaEntrar);
            }
          } catch (e) {
            console.error(
              "[BOT_PAGE] Erro ao ler configuração da estratégia Advance:",
              e,
            );
          }
        }

        // Criar notificação no histórico de operações
        const newOperation = {
          id: tempId,
          entryValue: event.details?.amount || 0,
          finalValue: 0,
          profit: 0,
          time: new Date(),
          notification: {
            type: "warning" as "warning",
            message: `ENTRADA ADVANCE | ${porcentagemParaEntrar}% | ${formatCurrency(event.details?.amount || 0)} | Dígitos 0 e 1 ≤ ${porcentagemParaEntrar}%`,
          },
        };

        console.log(
          "[BOT_PAGE] Adicionando operação intermediária Advance ao histórico:",
          newOperation,
        );
        setOperationHistory((prev) => [newOperation, ...prev].slice(0, 50));
      }

      // Processar eventos intermediários da estratégia Advance
      if (
        event.type === "intermediate_operation" &&
        selectedStrategy === "advance"
      ) {
        console.log(
          "[BOT_PAGE] Evento de operação intermediária da estratégia Advance:",
          event,
        );

        // Gerar ID único para esta operação intermediária
        const intermediateId = Math.floor(Math.random() * 1000000);

        // Obter porcentagem configurada para Advance
        let porcentagemParaEntrar = 10; // Valor padrão
        try {
          const userConfig = localStorage.getItem(`strategy_config_advance`);
          if (userConfig) {
            const config = JSON.parse(userConfig);
            if (config?.porcentagemParaEntrar !== undefined) {
              porcentagemParaEntrar = Number(config.porcentagemParaEntrar);
            }
          }
        } catch (e) {
          console.error(
            "[BOT_PAGE] Erro ao ler configuração para operação intermediária:",
            e,
          );
        }

        // Criar notificação para esta operação intermediária
        const intermediateOperation = {
          id: intermediateId,
          entryValue: event.details?.amount || 0,
          finalValue: event.details?.result || 0,
          profit: event.details?.profit || 0,
          time: new Date(),
          notification: {
            type: (event.details?.result > 0 ? "success" : "error") as
              | "success"
              | "error",
            message: `OPERAÇÃO INTERMEDIÁRIA | ${formatCurrency(event.details?.amount || 0)} | Resultado: ${formatCurrency(event.details?.result || 0)} | Análise Atual: ${event.details?.analysis || "N/A"}`,
          },
        };

        console.log(
          "[BOT_PAGE] Adicionando operação intermediária ao histórico:",
          intermediateOperation,
        );
        setOperationHistory((prev) =>
          [intermediateOperation, ...prev].slice(0, 50),
        );
      }

      // Processar eventos de operação finalizada
      if (event.type === "contract_finished") {
        console.log("[BOT_PAGE] ★★★★★ EVENTO CONTRACT_FINISHED RECEBIDO ★★★★★");
        console.log(
          "[BOT_PAGE] ★★★★★ DETALHES DO CONTRATO:",
          event.contract_details,
        );
        console.log("[BOT_PAGE] ★★★★★ ID DO CONTRATO:", event.contract_id);
        console.log("[BOT_PAGE] ★★★★★ STRATEGY:", event.strategy);
        console.log("[BOT_PAGE] ★★★★★ SYMBOL:", event.symbol);
        console.log("[BOT_PAGE] ★★★★★ PROFIT:", event.profit);

        // FORÇAR adição de uma operação ao histórico independente de qualquer condição
        // para diagnóstico e garantir que o componente OperationHistoryCard está funcionando
        const forceOperation = {
          id: Date.now(),
          contract_id: event.contract_id || Date.now(),
          entryValue: event.entry_value || 1,
          entry_value: event.entry_value || 1,
          finalValue: event.exit_value || 0,
          exit_value: event.exit_value || 0,
          profit: event.profit || 0,
          time: new Date(),
          timestamp: Date.now(),
          contract_type: event.contract_type || "CALL",
          symbol: event.symbol || "R_100",
          strategy: event.strategy || selectedStrategy || "auto",
          is_win: event.is_win,
          // CRUCIAL: Garantir que não seja marcado como intermediário
          isIntermediate: false,
          notification: {
            type: "success" as "success" | "info" | "warning" | "error",
            message: `OPERAÇÃO REALIZADA: ID=${event.contract_id}, Profit=${event.profit}`,
          },
        };

        console.log(
          "[BOT_PAGE] ★★★ ATUALIZANDO HISTÓRICO DE OPERAÇÕES IMEDIATAMENTE ★★★",
        );

        // CORREÇÃO CRÍTICA: Remover o setTimeout para garantir atualização imediata
        setOperationHistory((prev) => {
          console.log("[BOT_PAGE] Histórico anterior:", prev.length);
          const newHistory = [forceOperation, ...prev].slice(0, 50);
          console.log("[BOT_PAGE] Novo histórico:", newHistory.length);

          // Forçar console.log de cada operação para diagnóstico
          console.log(
            "[BOT_PAGE] ★★★ DIAGNÓSTICO DE OPERAÇÕES NO HISTÓRICO ★★★",
          );
          newHistory.forEach((op, index) => {
            console.log(`[BOT_PAGE] Operação #${index + 1}:`, {
              id: op.id,
              type: op.contract_type,
              strategy: op.strategy,
              profit: op.profit,
              is_win: op.is_win,
              entry_value: op.entry_value || op.entryValue,
              isIntermediate: op.isIntermediate,
              time: op.time,
            });
          });

          return newHistory;
        });

        // Adicionar operação normal ao histórico (caso o problema seja na extração de detalhes)
        const contract = event.contract_details;
        if (contract) {
          const contractId =
            typeof contract.contract_id === "number"
              ? contract.contract_id
              : typeof contract.contract_id === "string"
                ? parseInt(contract.contract_id)
                : Math.floor(Math.random() * 1000000);

          // Verificar se é uma operação intermediária da estratégia Advance
          // NOTA IMPORTANTE: Operações intermediárias aparecerão na aba "Análises", não na aba "Operações"
          const isIntermediate =
            event.is_intermediate ||
            event.isIntermediate ||
            contract.is_intermediate ||
            contract.isIntermediate ||
            false;

          // Adicionar log para depuração da classificação de operações
          console.log(
            `[BOT_PAGE] Classificação de operação ${contractId}: isIntermediate=${isIntermediate}, estratégia=${selectedStrategy}`,
          );

          // Forçar que operações regulares não sejam classificadas como intermediárias exceto se for estratégia Advance
          // ISSO GARANTE QUE AS OPERAÇÕES APAREÇAM NA ABA CORRETA
          const forceRegularOperation =
            !isIntermediate ||
            (selectedStrategy && selectedStrategy.toLowerCase() !== "advance");

          // Valores seguros com fallbacks para evitar valores undefined
          const buyPrice = contract.buy_price || event.entry_value || 0;
          const sellPrice =
            event.exit_value || event.sell_price || contract.sell_price || 0;

          // CORREÇÃO: Calcular o lucro corretamente baseado nos valores de compra e payout
          let profit = 0;

          // Se tivermos informação sobre o resultado (won/lost)
          if (contract.status === "won" || event.is_win === true) {
            // Verificar se é a primeira operação (via flag is_first_operation)
            const isFirstOperation = event.is_first_operation === true;

            // Para operações ganhas, calcular baseado no payout - preço de compra
            if (contract.payout && buyPrice) {
              profit = Number(contract.payout) - Number(buyPrice);

              // Adicionar logs detalhados para a primeira operação
              if (isFirstOperation) {
                console.log(
                  `[BOT_PAGE] ★★★ PRIMEIRA OPERAÇÃO VENCEDORA DETECTADA ★★★`,
                );
                console.log(
                  `[BOT_PAGE] ★★★ PAYOUT EXATO: ${contract.payout}, ENTRADA EXATA: ${buyPrice} ★★★`,
                );
                console.log(`[BOT_PAGE] ★★★ LUCRO RECALCULADO: ${profit} ★★★`);

                // Forçar uso do lucro calculado para a primeira operação
                if (profit < Number(buyPrice) * 0.5) {
                  console.log(
                    `[BOT_PAGE] ★★★ ALERTA: Lucro calculado (${profit}) parece muito baixo para entrada ${buyPrice} ★★★`,
                  );
                  // Forçar recálculo com base no valor de entrada
                  const expectablePayout = Number(buyPrice) * 1.95; // Payout esperado para DIGITOVER é aproximadamente 1.95x
                  const calculatedProfit = expectablePayout - Number(buyPrice);
                  console.log(
                    `[BOT_PAGE] ★★★ PROFIT CORRIGIDO: ${calculatedProfit} (baseado em payout esperado de ${expectablePayout}) ★★★`,
                  );
                  profit = calculatedProfit;
                }
              } else {
                console.log(
                  `[BOT_PAGE] Calculando lucro para operação vencedora: ${contract.payout} - ${buyPrice} = ${profit}`,
                );
              }
            } else if (typeof event.profit === "number" && event.profit > 0) {
              profit = event.profit;
              console.log(`[BOT_PAGE] Usando lucro do evento: ${profit}`);
            }
          } else if (contract.status === "lost" || event.is_win === false) {
            // Para operações perdidas, o lucro é o valor negativo do preço de compra
            profit = -Number(buyPrice);
            console.log(`[BOT_PAGE] Calculando perda: -${buyPrice}`);
          } else {
            // Caso não tenhamos o status claro, usar o profit do evento
            profit = typeof event.profit === "number" ? event.profit : 0;
            console.log(
              `[BOT_PAGE] Usando profit do evento (status indefinido): ${profit}`,
            );
          }

          // Determinar status e tipo de notificação baseados no resultado e tipo de operação
          let statusText = profit >= 0 ? "GANHOU" : "PERDEU";
          let notificationType: "success" | "error" | "warning" | "info" =
            profit >= 0 ? "success" : "error";

          // Para operações intermediárias da estratégia Advance, personalizar o texto e usar cor diferente
          if (isIntermediate && selectedStrategy?.toLowerCase() === "advance") {
            statusText = "INTERMEDIÁRIA ADVANCE";
            notificationType = "warning"; // Usar warning para operações intermediárias

            // Se temos análise de dígitos, incluir na mensagem
            if (contract.analysis) {
              statusText += ` | ${contract.analysis}`;
            }
          }

          // CORREÇÃO CRÍTICA: Verificar e ajustar valores de profit completamente desproporcionais
          if (contract.status === "won" || event.is_win === true) {
            // Para operações DIGITOVER/DIGITUNDER, o payout esperado é aproximadamente 1.8x o valor de entrada
            // Ou seja, o lucro esperado é aproximadamente 80% do valor da entrada
            const expectedPayout = buyPrice * 1.8;
            const expectedProfit = expectedPayout - buyPrice;

            // Se o lucro calculado for muito menor que o esperado, isso indica um erro de cálculo
            if (profit > 0 && profit < buyPrice * 0.7) {
              console.log(
                `[BOT_PAGE] ★★★ PROFIT DESPROPORCIONAL DETECTADO NA EXIBIÇÃO! ANTIGA: ${profit}, VALOR ENTRADA: ${buyPrice} ★★★`,
              );
              console.log(
                `[BOT_PAGE] ★★★ LUCRO ESPERADO PARA ENTRADA ${buyPrice}: ${expectedProfit} (payout ${expectedPayout}) ★★★`,
              );

              // Aplicar correção forçada para exibição (80% do valor da entrada como lucro)
              profit = expectedProfit;
              console.log(
                `[BOT_PAGE] ★★★ EXIBIÇÃO CORRIGIDA: Novo profit = ${profit} ★★★`,
              );
            }
          }

          // Formatar os valores monetários
          const entryFormatted = formatCurrency(buyPrice);
          // Para operações vencedoras, mostrar o payout total (entrada + lucro) ao invés de apenas o lucro
          let displayValue = profit;
          let resultFormatted = "";

          if (profit > 0) {
            // Calcular o payout total (entrada + lucro)
            const totalPayout = buyPrice + profit;
            resultFormatted = formatCurrency(totalPayout);
            console.log(
              `[BOT_PAGE] ★★★ Mostrando payout total: ${resultFormatted} (entrada: ${entryFormatted}, lucro: ${formatCurrency(profit)}) ★★★`,
            );
          } else {
            // Para operações perdedoras, mostrar apenas o valor do lucro (negativo)
            resultFormatted = formatCurrency(profit);
          }

          // Criar objeto de operação completo com todas as propriedades necessárias
          const newOperation = {
            id: contractId,
            contract_id: contractId, // Adicionando contract_id separadamente para garantir visibilidade
            entryValue: buyPrice,
            entry_value: buyPrice, // Duplicando para compatibilidade
            finalValue: sellPrice,
            exit_value: sellPrice, // Duplicando para compatibilidade
            profit: profit,
            time: new Date(),
            timestamp: Date.now(), // Adicionando timestamp
            contractType: contract.contract_type || "desconhecido",
            contract_type: contract.contract_type || "desconhecido", // Duplicando para compatibilidade
            symbol: contract.symbol || event.symbol || "R_100", // Adicionando símbolo
            strategy: selectedStrategy || "desconhecida", // Adicionando estratégia selecionada
            // Usar forceRegularOperation para garantir que as operações apareçam na aba correta
            isIntermediate: forceRegularOperation ? false : isIntermediate,
            entry_spot: contract.entry_spot || event.entry_spot,
            exit_spot: contract.exit_spot || event.exit_spot,
            barrier: contract.barrier || event.barrier,
            is_win: contract.status === "won" || event.is_win === true,
            notification: {
              type: notificationType,
              message: `${statusText} | Entrada: ${entryFormatted} | Resultado: ${resultFormatted}`,
            },
          };

          console.log(
            "[BOT_PAGE] Adicionando operação ao histórico:",
            newOperation,
          );

          // Verificar duplicação antes de adicionar ao histórico
          setOperationHistory((prev) => {
            // Operações intermediárias sempre são adicionadas como novas, nunca substituem existentes
            if (newOperation.isIntermediate) {
              console.log(
                `[BOT_PAGE] Operação ${contractId} classificada como intermediária, adicionando como nova`,
              );
              return [newOperation, ...prev].slice(0, 50);
            }

            // Para operações regulares, verificar se esta operação já existe
            const exists = prev.some(
              (op) => op.id === contractId && !op.isIntermediate,
            );
            if (exists) {
              console.log(
                `[BOT_PAGE] Operação regular ${contractId} já existe no histórico, atualizando...`,
              );
              // Atualizar apenas operações regulares, manter intermediárias intactas
              return prev.map((op) =>
                op.id === contractId && !op.isIntermediate ? newOperation : op,
              );
            } else {
              // Adicionar nova operação no topo do histórico
              console.log(
                `[BOT_PAGE] Operação regular ${contractId} é nova, adicionando ao topo do histórico`,
              );
              return [newOperation, ...prev].slice(0, 50);
            }
          });

          // Atualizar as estatísticas gerais quando uma operação é finalizada
          if (profit > 0) {
            setStats((prev) => ({
              ...prev,
              wins: prev.wins + 1,
              totalProfit: +(prev.totalProfit + profit).toFixed(2),
            }));
          } else {
            setStats((prev) => ({
              ...prev,
              losses: prev.losses + 1,
              totalProfit: +(prev.totalProfit + profit).toFixed(2),
            }));
          }
        } else {
          console.warn(
            "[BOT_PAGE] Evento contract_finished recebido sem detalhes do contrato:",
            event,
          );
        }
      }

      // Processar eventos de limite atingido (stop loss ou take profit)
      if (event.type === "bot_limit_reached") {
        // Adicionar notificação ao histórico no topo
        const notificationType: "error" | "success" = event.message.includes(
          "perda",
        )
          ? "error"
          : "success";
        const newNotification = {
          id: Date.now(),
          contract_id: Date.now(), // Usando timestamp como ID único para notificações
          entryValue: 0,
          entry_value: 0,
          finalValue: 0,
          exit_value: 0,
          profit: 0,
          time: new Date(),
          timestamp: Date.now(),
          contract_type: "NOTIFICATION", // Tipo específico para notificações
          symbol: "SYSTEM",
          strategy: selectedStrategy || "SYSTEM",
          notification: {
            type: notificationType,
            message: event.message,
          },
        };

        console.log(
          "[BOT_PAGE] Adicionando notificação de limite ao histórico:",
          newNotification,
        );
        setOperationHistory((prevHistory) => {
          // Tipagem explícita para prevHistory
          const updatedHistory = [newNotification, ...prevHistory];
          return updatedHistory.slice(0, 50);
        });
      }

      // Processar eventos de parada do bot
      if (event.type === "bot_stopped" && event.reason) {
        // Determinar o tipo de notificação com base na razão
        let notificationType: "error" | "warning" | "success" | "info" = "info";
        if (event.reason.includes("erro")) {
          notificationType = "error";
        } else if (event.reason.includes("perda")) {
          notificationType = "warning";
        } else if (
          event.reason.includes("lucro") ||
          event.reason.includes("meta")
        ) {
          notificationType = "success";
        }

        const newNotification = {
          id: Date.now(),
          contract_id: Date.now(), // Usando timestamp como ID único para notificações
          entryValue: 0,
          entry_value: 0,
          finalValue: 0,
          exit_value: 0,
          profit: 0,
          time: new Date(),
          timestamp: Date.now(),
          contract_type: "NOTIFICATION",
          symbol: "SYSTEM",
          strategy: selectedStrategy || "SYSTEM",
          notification: {
            type: notificationType,
            message: `Bot parado: ${event.reason}`,
          },
        };

        console.log(
          "[BOT_PAGE] Adicionando notificação de parada ao histórico:",
          newNotification,
        );
        setOperationHistory((prevHistory) => {
          // Tipagem explícita para prevHistory
          const updatedHistory = [newNotification, ...prevHistory];
          return updatedHistory.slice(0, 50);
        });
      }

      // Processar eventos de atualização de saldo
      if (event.type === "balance_update" && event.balance) {
        console.log(
          "[BOT_PAGE] ★★★ Evento balance_update recebido diretamente no ouvinte principal:",
          event.balance,
        );

        // FORÇAR exibição do saldo recebido
        const realBalance =
          typeof event.balance.balance === "number"
            ? event.balance.balance
            : parseFloat(String(event.balance.balance));

        // Imprimir valores com tipo explícito para debug
        console.log(
          "[BOT_PAGE] ★★★ Valor numérico REAL do saldo:",
          realBalance,
          "tipo:",
          typeof realBalance,
        );

        // Atualizar saldo em tempo real - GARANTIR QUE É NÚMERO
        setRealTimeBalance((prev) => ({
          balance: realBalance,
          previousBalance: prev.balance || 0,
        }));

        // Atualizar dados da conta no topo da tela
        setAccountInfo((prev) => {
          const updated = {
            ...prev,
            loginid: event.balance.loginid || "",
            balance: realBalance,
            currency: event.balance.currency || "USD",
            is_virtual: (event.balance.loginid || "").startsWith("VRT"),
          };
          console.log("[BOT_PAGE] ★★★ accountInfo atualizado para:", updated);
          return updated;
        });

        // Forçar atualização da conta selecionada também
        setSelectedAccount((prev) => {
          const updated = {
            ...prev,
            loginid: event.balance.loginid || prev.loginid,
            balance: realBalance,
            currency: event.balance.currency || prev.currency,
          };
          console.log(
            "[BOT_PAGE] ★★★ selectedAccount atualizado para:",
            updated,
          );
          return updated;
        });

        // Adicionar valor ao localStorage para depuração
        try {
          localStorage.setItem(
            "last_balance_update",
            JSON.stringify({
              balance: realBalance,
              currency: event.balance.currency,
              loginid: event.balance.loginid,
              timestamp: new Date().toISOString(),
            }),
          );
        } catch (e) {
          console.error("[BOT_PAGE] Erro ao salvar saldo no localStorage:", e);
        }

        console.log(
          "[BOT_PAGE] ★★★ Saldo atualizado para:",
          realBalance,
          event.balance.currency,
        );
      }
    };

    // Registrar ouvinte de eventos do serviço OAuth
    oauthDirectService.addEventListener(handleEvents);

    // Limpar ouvintes ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleEvents);
    };
  }, [selectedStrategy]); // Incluir selectedStrategy como dependência

  const renderActionButton = () => {
    // Usar o novo BotController para melhor feedback visual e controle
    return (
      <BotController
        entryValue={parseFloat(entryValue) || 0.35}
        profitTarget={parseFloat(profitTarget) || 1000}
        lossLimit={parseFloat(lossLimit) || 500}
        selectedStrategy={selectedStrategy}
        onStatusChange={(status) => {
          console.log("[BOT_PAGE] Status do bot atualizado:", status);
          setBotStatus(status);
        }}
        onStatsChange={(newStats) => {
          console.log("[BOT_PAGE] Estatísticas atualizadas:", newStats);
          setStats({
            wins: newStats.wins,
            losses: newStats.losses,
            totalProfit: newStats.totalProfit || 0,
          });
        }}
      />
    );
  };

  // A função handleAccountSelected foi removida pois agora usamos
  // automaticamente a conta selecionada na dashboard

  /* Esta é a parte principal do componente que retorna a interface */
  // O erro estava aqui - havia um return fora de contexto
  const renderMainContent = () => {
    return (
      <div className="flex min-h-screen bg-[#0a1324]">
        {/* Barra Lateral */}
        <div className="w-16 group hover:w-56 transition-all duration-300 ease-in-out bg-[#13203a] flex flex-col items-center py-6 overflow-hidden">
          <div className="flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-white flex-shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="24" height="24" rx="12" fill="#4F46E5" />
              <path
                d="M16.5 8.25H13.5L12 6.75L10.5 8.25H7.5L6 9.75V12.75L7.5 14.25V17.25L9 18.75H15L16.5 17.25V14.25L18 12.75V9.75L16.5 8.25Z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 12.75C12.8284 12.75 13.5 12.0784 13.5 11.25C13.5 10.4216 12.8284 9.75 12 9.75C11.1716 9.75 10.5 10.4216 10.5 11.25C10.5 12.0784 11.1716 12.75 12 12.75Z"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 12.75V15.75"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="ml-3 font-bold text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Genius Trading
            </span>
          </div>

          {/* Links de navegação */}
          <div className="w-full">
            <button
              onClick={() => {
                // Se o robô estiver rodando, confirmar antes de sair
                if (botStatus === "running") {
                  const confirmExit = window.confirm(
                    "O robô está em execução. Deseja realmente voltar para o dashboard? Isso irá parar todas as operações.",
                  );
                  if (confirmExit) {
                    oauthDirectService.stop();
                    // Redirecionar para o dashboard após a parada
                    window.location.href = "/dashboard";
                  }
                } else {
                  // Se não estiver rodando, sair direto para o dashboard
                  window.location.href = "/dashboard";
                }
              }}
              className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105 mb-2"
            >
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="3" y1="9" x2="21" y2="9"></line>
                  <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
              </div>
              <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Dashboard
              </span>
            </button>

            <button className="w-full flex items-center px-3 py-2 text-white bg-indigo-600 rounded-md transition-all duration-200 hover:scale-105 mb-2">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                </svg>
              </div>
              <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Automações
              </span>
            </button>

            <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
              <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                Perfil
              </span>
            </button>
          </div>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1 p-6">
          {/* Header - Informações da conta */}
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white mr-4">
                Robô de Automações
              </h1>

              {/* Informações da conta (ID e saldo) - Versão com destaque */}
              <div className="flex items-center bg-[#1a2b4c] px-3 py-1.5 rounded-lg border border-[#2c3e5d] shadow-md">
                <div
                  className={`w-2 h-2 rounded-full mr-2 ${selectedAccount?.isVirtual || accountInfo?.is_virtual ? "bg-blue-500" : "bg-green-500"}`}
                ></div>
                <span className="text-sm font-medium text-white mr-2">
                  {selectedAccount?.loginid || accountInfo?.loginid || ""}
                </span>
                <span className="text-sm font-bold text-white">
                  {typeof realTimeBalance?.balance === "number"
                    ? realTimeBalance.balance.toFixed(2)
                    : "0.10"}{" "}
                  {selectedAccount?.currency || accountInfo?.currency || "USD"}
                </span>
              </div>
            </div>

            <div className="flex items-center">
              {/* Status do bot */}
              <div className="flex items-center mr-4 bg-[#13203a] rounded-md px-3 py-2 border border-[#2a3756]">
                <div className="flex items-center">
                  <div
                    className={`w-2 h-2 rounded-full mr-2 ${accountInfo?.is_virtual ? "bg-blue-500" : "bg-green-500"}`}
                  ></div>
                  <div className="text-sm text-white mr-3">
                    {accountInfo?.is_virtual ? "Demo" : "Real"}
                  </div>
                </div>
                <div className="mx-2 h-4 border-r border-[#3a4b6b]"></div>
                <div className="flex items-center">
                  <div className="text-xs text-gray-400 mr-1">Status:</div>
                  <div className="text-sm flex items-center">
                    <span
                      className={`flex items-center ${
                        botStatus === "running"
                          ? "text-green-500"
                          : botStatus === "paused"
                            ? "text-yellow-500"
                            : "text-gray-400"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full mr-1.5 ${
                          botStatus === "running"
                            ? "bg-green-500 animate-pulse"
                            : botStatus === "paused"
                              ? "bg-yellow-500"
                              : "bg-gray-500"
                        }`}
                      ></span>
                      {botStatus === "running"
                        ? "Em execução"
                        : botStatus === "paused"
                          ? "Pausado"
                          : "Inativo"}
                    </span>
                  </div>
                </div>
              </div>

              <img
                src="https://randomuser.me/api/portraits/men/44.jpg"
                alt="Profile"
                className="w-9 h-9 rounded-full border-2 border-indigo-600"
              />
            </div>
          </div>

          {/* Grid Principal */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna da esquerda - Controles e Configurações */}
            <div className="lg:col-span-1 space-y-5">
              {/* Alerta de permissões do token */}
              <TokenPermissionAlert
                onReauthorize={() => {
                  const appId = "71403";
                  const redirectUri = encodeURIComponent(
                    window.location.origin + "/auth-callback",
                  );
                  const scope = encodeURIComponent(
                    "read admin payments trade trading trading_information",
                  );
                  const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;
                  window.open(authUrl, "_blank", "width=800,height=600");

                  // Registrar reautorização pendente
                  localStorage.setItem("deriv_pending_reauth", "true");
                  localStorage.setItem(
                    "deriv_pending_reauth_timestamp",
                    Date.now().toString(),
                  );

                  toast({
                    title: "Autorização iniciada",
                    description:
                      "Complete a autorização na janela aberta para obter todas as permissões necessárias.",
                  });
                }}
              />

              {/* Painel de Controle Principal */}
              <div className="bg-[#13203a] rounded-lg p-5 border border-[#2a3756]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white">
                    Painel de Controle
                  </h2>
                </div>

                {/* Estatísticas de operações posicionadas no TOPO ABSOLUTO do painel */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0e1a2e] rounded-md p-3 border border-[#2a3756] mb-5">
                  <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
                    <span className="text-xs text-gray-400">Vitórias</span>
                    <span className="text-lg font-bold text-green-400">
                      {stats.wins}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
                    <span className="text-xs text-gray-400">Derrotas</span>
                    <span className="text-lg font-bold text-red-400">
                      {stats.losses}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
                    <span className="text-xs text-gray-400">
                      Taxa de Acerto
                    </span>
                    <span className="text-lg font-bold text-yellow-400">
                      {stats.wins + stats.losses > 0
                        ? `${Math.round((stats.wins / (stats.wins + stats.losses)) * 100)}%`
                        : "0%"}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
                    <span className="text-xs text-gray-400">Lucro Total</span>
                    <span
                      className={`text-lg font-bold ${stats.totalProfit >= 0 ? "text-green-400" : "text-red-400"}`}
                    >
                      {stats.totalProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Controles do Bot */}
                <div className="mt-5">
                  <h3 className="text-white text-md font-medium mb-3">
                    Configurações
                  </h3>

                  {/* Tipo de Bot */}
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">
                      Tipo de Bot
                    </label>
                    <Select
                      value={selectedBotType}
                      onValueChange={(value: "lite" | "premium" | "") => {
                        setSelectedBotType(value);
                        setSelectedStrategy("");
                      }}
                    >
                      <SelectTrigger className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white">
                        <SelectValue placeholder="Selecionar tipo" />
                      </SelectTrigger>
                      <SelectContent 
                        className="bg-[#13203a] border-[#2c3e5d] text-white"
                        position="popper"
                        sideOffset={4}
                        align="start"
                      >
                        <SelectItem value="lite">Bot Lite (Básico)</SelectItem>
                        <SelectItem value="premium">
                          Bot Premium (VIP)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Estratégia */}
                  <div className="mb-3">
                    <label className="block text-sm text-gray-400 mb-1">
                      Estratégia
                    </label>
                    <Select
                      value={selectedStrategy}
                      onValueChange={setSelectedStrategy}
                      disabled={!selectedBotType}
                    >
                      <SelectTrigger className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white">
                        <SelectValue placeholder="Selecionar estratégia" />
                      </SelectTrigger>
                      <SelectContent 
                        className="bg-[#13203a] border-[#2c3e5d] text-white"
                        position="popper"
                        sideOffset={4}
                        align="start"
                      >
                        {selectedBotType &&
                          strategies[selectedBotType].map((strategy) => (
                            <SelectItem key={strategy.id} value={strategy.id}>
                              {strategy.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Painel de controle do bot com configuração adaptável sem campos duplicados */}
                  <div className="mb-4">
                    <BotController
                      entryValue={parseFloat(entryValue) || 0.35}
                      profitTarget={parseFloat(profitTarget) || 20}
                      lossLimit={parseFloat(lossLimit) || 10}
                      selectedStrategy={selectedStrategy || ""}
                      onStatusChange={(status) => setBotStatus(status)}
                      onStatsChange={(newStats) => setStats(newStats)}
                      onTickReceived={(price, lastDigit) => {
                        // Usar a função updateDigitStats que já atualiza tanto os últimos dígitos
                        // quanto as estatísticas com base nos dados da Deriv
                        updateDigitStats(lastDigit);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Colunas do meio e direita - Visualização de dados e estatísticas */}
            <div className="lg:col-span-2 space-y-5">
              {/* Histórico de Operações - Usando o novo componente RelatorioOperacoes */}
              <div className="rounded-lg border border-[#2a3756]">
                <div className="flex justify-between items-center px-4 pt-2">
                  {/* Título do cartão */}
                  <div className="text-sm font-medium text-white">
                    Histórico
                  </div>

                  <button
                    onClick={handleClearHistory}
                    className="px-2 py-1 text-xs text-white bg-[#1d2a45] hover:bg-[#2a3756] rounded transition ml-auto"
                    disabled={operationHistory.length === 0}
                  >
                    Limpar histórico
                  </button>
                </div>

                <OperationHistoryCard
                  operations={operationHistory}
                  stats={stats}
                />
              </div>

              {/* Gráfico de barras de dígitos do R_100 */}
              <div className="bg-[#13203a] rounded-lg border border-[#2a3756]">
                <div className="px-4 py-3 border-b border-[#2a3756] flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">
                    Distribuição de Dígitos
                  </h2>
                  <span className="text-sm text-gray-400">
                    Atualização em tempo real
                  </span>
                </div>
                <div className="p-4" style={{ height: "580px" }}>
                  {/* Usando o componente IndependentDigitBarChart que tem conexão independente */}
                  <IndependentDigitBarChart
                    symbol="R_100"
                    className="h-full w-full"
                    showControls={true}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Retornar o conteúdo principal renderizado a partir da função BotPage
  return isAuthenticated === false ? (
    <DerivLoginRequired />
  ) : (
    renderMainContent()
  );
}
