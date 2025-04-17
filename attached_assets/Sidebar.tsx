import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
  LineChart, 
  Home, 
  Database, 
  BarChart3, 
  Settings, 
  ChevronRight,
  FileText,
  Send,
  Monitor,
  Play,
  Square,
  BarChart4,
  Binary,
  Bot,
  Zap,
  Pause,
  StopCircle,
  RefreshCw,
  DollarSign,
  Link,
  Wifi,
  LogOut
} from "lucide-react";
import { useState, useEffect } from "react";

import derivAPI from "@/lib/derivApi";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DerivConnect } from "./DerivConnect";
import { AccountSelector } from "./AccountSelector";

interface SidebarItem {
  id: string;
  label: string;
  icon: JSX.Element;
  active?: boolean;
  onClick?: () => void;
}

interface SidebarProps {
  onViewChange?: (view: string) => void;
}

export function Sidebar({ onViewChange }: SidebarProps) {
  const [activeItem, setActiveItem] = useState<string | null>("painel");
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Ações dos botões
  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    console.log("Menu clicado:", itemId);
    
    // Destacar quando clicar no robô de operações
    if (itemId === "trading-bot") {
      toast({
        title: "Robô de Operações",
        description: "Carregando interface do robô de operações...",
      });
    }
    
    // Executar ação conforme o botão
    switch (itemId) {
      case "saldo":
        fetchAccountBalance();
        break;
      case "parar":
        stopTrading();
        break;
      case "comandos":
        // Mostrar comandos disponíveis
        toast({
          title: "Comandos disponíveis",
          description: "Use o painel para iniciar/parar operações",
        });
        break;
      default:
        // Alterar visualização se a função existir
        if (onViewChange) {
          onViewChange(itemId);
        }
    }
  };
  
  // Executar funções específicas ao clicar nos itens de comando
  const handleCommandClick = (itemId: string) => {
    switch (itemId) {
      case "saldo":
        fetchAccountBalance();
        break;
      case "parar":
        stopTrading();
        break;
      default:
        // Não fazer nada
    }
  };
  
  // Buscar saldo da conta sem mostrar notificação
  const fetchAccountBalanceSilent = async () => {
    try {
      // Verificar se existe uma conexão válida
      if (!derivAPI.getConnectionStatus()) {
        return;
      }
      
      // Obter saldo atual da conta usando método subscribeToBalanceUpdates do derivAPI
      const balanceData = await derivAPI.subscribeToBalanceUpdates();
      
      // Se temos dados de saldo, atualizar o estado
      if (balanceData && balanceData.balance) {
        setAccountInfo({
          currency: balanceData.balance.currency,
          balance: balanceData.balance.balance
        });
      }
    } catch (error) {
      console.error("Erro ao buscar saldo:", error);
    }
  };
  
  // Buscar saldo da conta e mostrar notificação
  const fetchAccountBalance = async () => {
    try {
      // Verificar se existe uma conexão válida
      if (!derivAPI.getConnectionStatus()) {
        toast({
          title: "Erro ao buscar saldo",
          description: "Não há conexão com a API Deriv",
          variant: "destructive",
        });
        return;
      }
      
      // Obter saldo atual da conta usando método subscribeToBalanceUpdates do derivAPI
      const balanceData = await derivAPI.subscribeToBalanceUpdates();
      
      // Se temos dados de saldo, atualizar o estado e notificar
      if (balanceData && balanceData.balance) {
        setAccountInfo({
          currency: balanceData.balance.currency,
          balance: balanceData.balance.balance
        });
        
        toast({
          title: "Saldo da Conta",
          description: `${balanceData.balance.currency} ${parseFloat(balanceData.balance.balance).toFixed(2)}`,
        });
      } else {
        toast({
          title: "Erro ao buscar saldo",
          description: "Verifique se você está autenticado",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro ao buscar saldo:", error);
      toast({
        title: "Erro ao buscar saldo",
        description: "Falha na comunicação com a API",
        variant: "destructive",
      });
    }
  };
  
  // Função para controle do robô de automação
  const stopTrading = () => {
    toast({
      title: "Robô de Automações",
      description: "O robô de automações foi parado com sucesso.",
      variant: "default"
    });
  };
  
  // Status de execução (sempre falso até implementação futura)
  const [isRunning, setIsRunning] = useState(false);
  
  useEffect(() => {
    // Verificar status a cada 2 segundos (apenas para status de conexão)
    const intervalId = setInterval(() => {
      // Verificar se está conectado à API da Deriv
      const connected = derivAPI.getConnectionStatus();
      setIsConnected(connected);
      
      if (connected) {
        fetchAccountBalanceSilent();
      }
    }, 2000);
    
    return () => clearInterval(intervalId);
  }, []);
  
  // Manipulador para o clique no botão de conexão
  const handleConnectClick = () => {
    setConnectDialogOpen(true);
  };
  
  const mainItems: SidebarItem[] = [
    {
      id: "painel",
      label: "Painel",
      icon: <Home className="h-4 w-4" />,
      onClick: () => handleItemClick("painel")
    },
    {
      id: "conexao",
      label: "Conexão",
      icon: <Link className="h-4 w-4" />,
      onClick: () => handleItemClick("conexao")
    },
    {
      id: "dashboard",
      label: "Dashboard",
      icon: <BarChart3 className="h-4 w-4" />,
      onClick: () => handleItemClick("dashboard")
    },
    {
      id: "trading-bot",
      label: "Robô de Operações",
      icon: <Bot className="h-4 w-4" />,
      onClick: () => handleItemClick("trading-bot")
    }
  ];

  return (
    <div className="w-[180px] bg-[#0e1a33] border-r border-gray-800 h-full flex flex-col">
      {/* Logo e Usuário */}
      <div className="p-4 border-b border-gray-800 flex flex-col items-center">
        <Avatar className="h-16 w-16 mb-2">
          <AvatarImage src="https://github.com/shadcn.png" alt="Alexandre Daniel" />
          <AvatarFallback className="bg-[#1a2b49]">AD</AvatarFallback>
        </Avatar>
        <div className="text-center">
          <h3 className="text-white text-sm font-medium">Alexandre Daniel</h3>
          <p className="text-[#8492b4] text-xs">admin</p>
        </div>
      </div>
      
      {/* Status de conexão */}
      <div className="px-4 py-2 border-b border-gray-800">
        {isConnected ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
                <span className="text-xs text-green-500">Conectado</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-red-500 hover:text-red-400"
                onClick={() => derivAPI.disconnect()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Seletor de contas */}
            <div className="flex items-center mt-1">
              <AccountSelector />
            </div>
          </div>
        ) : (
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                className="w-full bg-[#3a7bd5] hover:bg-[#3a7bd5]/80 text-white border-none"
                onClick={handleConnectClick}
              >
                <Wifi className="h-4 w-4 mr-2" />
                Conectar à Deriv
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-[#0e1a33] border-slate-700">
              <DialogHeader>
                <DialogTitle className="text-white">Conectar à API da Deriv</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <DerivConnect />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Status de operação */}
      {isRunning && (
        <div className="px-4 py-2 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-2"></div>
              <span className="text-xs text-green-500">Operando</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-red-500 hover:text-red-400"
              onClick={stopTrading}
            >
              <StopCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Itens de menu */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Menu principal */}
        {/* Primeiro renderizamos o Painel em destaque */}
        <Button
          key="painel"
          variant="ghost"
          size="sm"
          className={`w-full justify-start px-4 mb-2 ${
            activeItem === "painel"
              ? "bg-[#1a2b49] text-[#00e5b3] border-l-2 border-[#00e5b3]"
              : "text-white hover:text-[#00e5b3] hover:bg-[#162440] border-l-2 border-transparent"
          }`}
          onClick={() => handleItemClick("painel")}
        >
          <div className="flex items-center w-full">
            <div className="mr-2"><Home className="h-4 w-4" /></div>
            <span className="text-sm font-medium">Painel</span>
          </div>
        </Button>
        
        {/* Botão do Robô de Operações em destaque - Link direto */}
        <a href="/robo-operacoes" className="block w-full mb-2">
          <Button
            key="trading-bot"
            variant="ghost" 
            size="sm"
            className={`w-full justify-start px-4 ${
              activeItem === "trading-bot"
                ? "bg-[#00e5b3]/20 text-[#00e5b3] border-l-2 border-[#00e5b3]"
                : "text-[#00e5b3] hover:bg-[#00e5b3]/10 border-l-2 border-transparent"
            }`}
          >
            <div className="flex items-center w-full">
              <div className="mr-2"><Bot className="h-4 w-4" /></div>
              <span className="text-sm font-medium">Robô de Operações</span>
            </div>
          </Button>
        </a>

        {/* Outros itens do menu */}
        {mainItems.filter(item => item.id !== "painel" && item.id !== "trading-bot").map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            className={`w-full justify-start px-4 mb-1 ${
              activeItem === item.id
                ? "bg-[#1a2b49] text-[#00e5b3]"
                : "text-gray-400 hover:text-white hover:bg-[#162440]"
            }`}
            onClick={item.onClick}
          >
            <div className="flex items-center w-full">
              <div className="mr-2">{item.icon}</div>
              <span className="text-xs font-medium">{item.label}</span>
            </div>
          </Button>
        ))}
      </div>
      
      {/* Botão para sair */}
      <div className="p-2 border-t border-gray-800">
        <Button
          variant="outline"
          size="sm"
          className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-300 border-red-900"
          onClick={() => {
            sessionStorage.removeItem("isLoggedIn");
            // Desconectar da API também
            derivAPI.disconnect();
            // Redirecionar para a página de login (rota raiz)
            window.location.href = "/";
          }}
        >
          <LogOut className="h-4 w-4 mr-2" />
          <span className="text-xs font-medium">Sair da conta</span>
        </Button>
      </div>
      
      {/* Rodapé com versão */}
      <div className="p-2 text-center border-t border-gray-800">
        <span className="text-xs text-[#8492b4]">Genius Tech v3.0.0</span>
      </div>
    </div>
  );
}