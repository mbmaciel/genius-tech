import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { TrendingUp, TrendingDown, DollarSign, BarChart, Check, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import derivAPI from "@/lib/derivApi";

interface MetricCardProps {
  title: string;
  value: string;
  change: {
    value: string;
    type: "positive" | "negative";
  };
  icon: React.ReactNode;
}

const MetricCard = ({ title, value, change, icon }: MetricCardProps) => (
  <div className="grid-card p-6">
    <h3 className="text-[#8492b4] text-sm font-medium mb-2">{title}</h3>
    <div className="flex items-end justify-between">
      <div>
        <p className="text-2xl font-bold font-poppins">{value}</p>
        <div className="flex items-center mt-1">
          {change.type === "positive" ? (
            <ChevronUp className="w-4 h-4 text-[#00e5b3] mr-1" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[#ff5252] mr-1" />
          )}
          <span className={`text-sm ${change.type === "positive" ? "text-[#00e5b3]" : "text-[#ff5252]"}`}>{change.value}</span>
        </div>
      </div>
      <div className={`h-10 w-10 rounded-full ${change.type === "positive" ? "bg-[rgba(0,229,179,0.15)]" : "bg-[rgba(255,82,82,0.15)]"} flex items-center justify-center`}>
        {icon}
      </div>
    </div>
  </div>
);

export function DashboardOverview() {
  const [botActive, setBotActive] = useState(true);
  const [accountBalance, setAccountBalance] = useState<number | null>(null);
  const [accountCurrency, setAccountCurrency] = useState<string>('USD');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        if (!derivAPI.getConnectionStatus()) {
          setIsLoading(false);
          return;
        }

        // Tentar obter dados da conta se estiver autenticado
        const accountData = await derivAPI.send({ balance: 1 });
        console.log("Dados da conta recebidos:", accountData);
        
        if (accountData && accountData.balance) {
          // Extrair corretamente o saldo da resposta da API
          const balanceValue = accountData.balance.balance;
          const currencyValue = accountData.balance.currency;
          
          console.log(`Saldo obtido: ${balanceValue} ${currencyValue}`);
          
          if (balanceValue !== undefined && !isNaN(Number(balanceValue))) {
            setAccountBalance(Number(balanceValue));
            setAccountCurrency(currencyValue || 'USD');
          } else {
            console.error('Saldo inválido recebido:', balanceValue);
          }
        }
      } catch (error) {
        console.error('Erro ao obter dados da conta:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccountData();
    
    // Configurar listener para atualizações de saldo em tempo real
    const balanceHandler = (event: any) => {
      if (event.detail && event.detail.balance) {
        const balanceValue = event.detail.balance.balance;
        const currencyValue = event.detail.balance.currency;
        
        if (balanceValue !== undefined && !isNaN(Number(balanceValue))) {
          setAccountBalance(Number(balanceValue));
          setAccountCurrency(currencyValue || 'USD');
          setIsLoading(false);
        }
      }
    };
    
    // Registrar handler para eventos de saldo
    document.addEventListener('deriv:balance', balanceHandler);
    
    // Verificar saldo periodicamente
    const intervalId = setInterval(fetchAccountData, 30000);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('deriv:balance', balanceHandler);
    };
  }, []);

  // Formatando o valor para exibição
  const formattedBalance = accountBalance !== null 
    ? `${accountCurrency} ${typeof accountBalance === 'number' 
        ? accountBalance.toFixed(2) 
        : parseFloat(String(accountBalance)).toFixed(2)}`
    : 'Conecte-se';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
      <MetricCard
        title="Saldo da Conta"
        value={isLoading ? "Carregando..." : formattedBalance}
        change={{ value: "Saldo atual", type: "positive" }}
        icon={isLoading ? <Loader2 className="w-5 h-5 text-[#00e5b3] animate-spin" /> : <DollarSign className="w-5 h-5 text-[#00e5b3]" />}
      />
      
      <MetricCard
        title="Today's Trades"
        value="12"
        change={{ value: "8 wins", type: "positive" }}
        icon={<BarChart className="w-5 h-5 text-[#00e5b3]" />}
      />
      
      <MetricCard
        title="Success Rate"
        value="67.5%"
        change={{ value: "-1.2%", type: "negative" }}
        icon={<Check className="w-5 h-5 text-[#00e5b3]" />}
      />
      
      <div className="grid-card p-6">
        <h3 className="text-[#8492b4] text-sm font-medium mb-2">Bot Status</h3>
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-2xl font-bold font-poppins ${botActive ? "text-[#00e5b3]" : "text-[#ff5252]"}`}>
              {botActive ? "Active" : "Inactive"}
            </p>
            <div className="flex items-center mt-1">
              <span className="text-[#8492b4] text-sm">{botActive ? "Running for 6h 23m" : "Stopped"}</span>
            </div>
          </div>
          <Switch
            checked={botActive}
            onCheckedChange={setBotActive}
            className={botActive ? "bg-[#00e5b3]" : ""}
          />
        </div>
      </div>
    </div>
  );
}
