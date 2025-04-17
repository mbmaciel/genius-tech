import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, BarChart, ArrowUpDown, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { useState, useEffect } from "react";
import derivAPI from "@/lib/derivApi";

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  isLoading?: boolean;
  color?: string;
  trend?: {
    value: string;
    type: "positive" | "negative" | "neutral";
  };
}

const MetricCard = ({ title, value, icon, isLoading = false, color = "#00e5b3", trend }: MetricCardProps) => (
  <Card className="border-slate-800 bg-[#162440] overflow-hidden">
    <CardContent className="pt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[#8492b4] text-sm font-medium">{title}</h3>
        <div className={`h-8 w-8 rounded-full bg-opacity-20 flex items-center justify-center`} style={{ backgroundColor: `${color}20` }}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" style={{ color }} /> : icon}
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-white">{value}</div>
        {trend && (
          <div className="flex items-center mt-1">
            {trend.type === "positive" ? (
              <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
            ) : trend.type === "negative" ? (
              <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
            ) : (
              <ArrowUpDown className="w-4 h-4 text-yellow-500 mr-1" />
            )}
            <span className={`text-xs ${
              trend.type === "positive" ? "text-green-500" : 
              trend.type === "negative" ? "text-red-500" :
              "text-yellow-500"
            }`}>
              {trend.value}
            </span>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
);

export function AccountDashboard() {
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  const [tradesCount, setTradesCount] = useState<number | null>(null);
  const [profitAmount, setProfitAmount] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [isLoadingTrades, setIsLoadingTrades] = useState(true);
  const [isLoadingProfit, setIsLoadingProfit] = useState(true);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [accountDetails, setAccountDetails] = useState<{
    loginid: string;
    name: string;
    email: string;
    currency: string;
    balance: number;
    isVirtual: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccountDetails = async () => {
      try {
        // Verificar conexão
        if (!derivAPI.getConnectionStatus()) {
          setError("Conecte-se à API Deriv primeiro");
          setIsLoadingBalance(false);
          return;
        }

        // Obter informações da conta
        const accountInfo = derivAPI.getAccountInfo();
        
        // Usar a API para obter o saldo atualizado
        let balanceResponse;
        try {
          balanceResponse = await derivAPI.send({
            balance: 1,
            subscribe: 0,
            req_id: Date.now()
          });
          console.log("Resposta de saldo obtida:", balanceResponse);
        } catch (balanceError) {
          console.error("Erro ao obter saldo via API:", balanceError);
        }
        
        if (accountInfo && accountInfo.balance) {
          // Usar os dados já disponíveis no accountInfo
          const loginId = accountInfo.loginId || '';
          let currency = accountInfo.balance.currency || 'USD';
          let balance = Number(accountInfo.balance.balance || 0);
          
          // Se tiver dados de balanceResponse, usar esses dados mais atualizados
          if (balanceResponse && balanceResponse.balance) {
            currency = balanceResponse.balance.currency || currency;
            balance = Number(balanceResponse.balance.balance || balance);
          }
          
          setAccountDetails({
            loginid: loginId,
            name: accountInfo.name || '',
            email: accountInfo.email || '',
            currency: currency,
            balance: balance,
            isVirtual: accountInfo.isVirtual || loginId.startsWith('VRTC')
          });
          
          // Atualizar também o estado do saldo para os cards
          setAccountBalance(balance);
          setAccountCurrency(currency);
          setIsLoadingBalance(false);
        } else if (balanceResponse && balanceResponse.balance) {
          // Se não tiver accountInfo, usar apenas os dados do balanceResponse
          const balanceValue = balanceResponse.balance.balance;
          const currencyValue = balanceResponse.balance.currency;
          const loginId = balanceResponse.balance.loginid;
          
          setAccountBalance(Number(balanceValue));
          setAccountCurrency(currencyValue || 'USD');
          
          // Definir informações básicas da conta
          if (loginId) {
            setAccountDetails({
              loginid: loginId,
              name: '',
              email: '',
              currency: currencyValue || 'USD',
              balance: Number(balanceValue),
              isVirtual: loginId.startsWith('VRTC')
            });
          }
          
          setIsLoadingBalance(false);
        } else {
          throw new Error("Não foi possível obter informações da conta");
        }
      } catch (error) {
        console.error("Erro ao obter detalhes da conta:", error);
        setError("Não foi possível obter informações da conta atual");
        setIsLoadingBalance(false);
      }
    };

    const fetchTradesHistory = async () => {
      try {
        if (!derivAPI.getConnectionStatus()) {
          setIsLoadingTrades(false);
          return;
        }

        // Configura data de início para as últimas 24 horas
        const oneDayAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

        // Buscar histórico de transações da conta
        const response = await derivAPI.send({
          statement: 1,
          description: 1,
          limit: 100,
          date_from: oneDayAgo
        });

        if (response && response.statement && response.statement.transactions) {
          // Filtrar só transações de trade (buy, sell)
          const trades = response.statement.transactions.filter(
            (tx: any) => tx.action === "buy" || tx.action === "sell"
          );

          // Definir número de trades
          setTradesCount(trades.length);
          
          // Calcular lucro/perda total
          const totalProfit = trades.reduce((total: number, trade: any) => {
            return total + parseFloat(trade.amount || 0);
          }, 0);
          
          setProfitAmount(totalProfit);
          
          setIsLoadingTrades(false);
          setIsLoadingProfit(false);
        } else {
          throw new Error("Erro ao obter histórico de trades");
        }
      } catch (error) {
        console.error("Erro ao obter histórico de trades:", error);
        setTradesCount(0);
        setProfitAmount(0);
        setIsLoadingTrades(false);
        setIsLoadingProfit(false);
      }
    };

    // Buscar dados iniciais
    fetchAccountDetails();
    fetchTradesHistory();

    // Configurar atualizações periódicas
    const balanceIntervalId = setInterval(fetchAccountDetails, 10000);
    
    // Limpar intervalos ao desmontar
    return () => {
      clearInterval(balanceIntervalId);
    };
  }, []);

  // Formatar valores para exibição
  const formattedBalance = accountBalance !== null 
    ? `${accountCurrency} ${accountBalance.toFixed(2)}` 
    : "Carregando...";
    
  const formattedTradesCount = tradesCount !== null 
    ? `${tradesCount}` 
    : "Carregando...";
    
  const formattedProfit = profitAmount !== null 
    ? `${accountCurrency} ${profitAmount.toFixed(2)}` 
    : "Carregando...";

  const profitTrend = profitAmount !== null 
    ? { 
        value: "Últimas 24h", 
        type: profitAmount > 0 ? "positive" : profitAmount < 0 ? "negative" : "neutral" as "positive" | "negative" | "neutral"
      } 
    : undefined;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <MetricCard
        title="Saldo da Conta"
        value={formattedBalance}
        icon={<DollarSign className="h-4 w-4" style={{ color: "#00e5b3" }} />}
        isLoading={isLoadingBalance}
        color="#00e5b3"
      />
      
      <MetricCard
        title="Operações (24h)"
        value={formattedTradesCount}
        icon={<BarChart className="h-4 w-4" style={{ color: "#60a5fa" }} />}
        isLoading={isLoadingTrades}
        color="#60a5fa"
      />
      
      <MetricCard
        title="Lucro/Perda (24h)"
        value={formattedProfit}
        icon={<ArrowUpDown className="h-4 w-4" style={{ color: profitAmount && profitAmount > 0 ? "#10b981" : "#ef4444" }} />}
        isLoading={isLoadingProfit}
        color={profitAmount && profitAmount > 0 ? "#10b981" : "#ef4444"}
        trend={profitTrend}
      />
    </div>
  );
}