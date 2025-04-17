import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AccountDashboard } from "@/components/dashboard/AccountDashboard";
import DigitStats from "@/components/dashboard/DigitStats";
import SimpleDigitStats from "@/components/dashboard/SimpleDigitStats";
import { AutomationsRobot } from "@/components/dashboard/AutomationsRobot";
import { AccountDisplay } from "@/components/dashboard/AccountDisplay";
import { NewAccountSelector } from "@/components/dashboard/NewAccountSelector";
import CashierOperations from "@/components/dashboard/CashierOperations";
import derivAPI from "@/lib/derivApi";
import { startKeepAlive, stopKeepAlive } from "@/lib/websocketKeepAlive";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Bot, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<string>("painel");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    console.log("Dashboard inicializando - verificando conexão...");
    
    // Definir um timeout para o carregamento - importante para não ficar preso
    const timeoutId = setTimeout(() => {
      console.log("Timeout de carregamento atingido - forçando renderização");
      setIsLoading(false);
    }, 5000); // 5 segundos máximos de carregamento
    
    // Verificar se estamos em processo de troca de conta
    const forceReconnect = localStorage.getItem('force_reconnect') === 'true';
    if (forceReconnect) {
      console.log("Detectado force_reconnect=true, realizando reconexão completa...");
      // Limpar a flag
      localStorage.removeItem('force_reconnect');
      
      // Se temos um processo de reconexão forçada, desconectar completamente primeiro
      derivAPI.disconnect(true);
      
      // Pequeno atraso para garantir que a desconexão seja concluída
      setTimeout(() => {
        // Tentar reconectar usando o token armazenado
        console.log("Reconectando após forceReconnect...");
        derivAPI.connect().then(() => {
          // Atualizar status após a reconexão
          setIsConnected(derivAPI.getConnectionStatus());
          setIsLoading(false);
        }).catch(e => {
          console.error("Erro na reconexão após forceReconnect:", e);
          setIsLoading(false);
        });
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Verificar se já existe uma conexão com a API Deriv, ou tentar conexão automática
    const checkAndInitConnection = async () => {
      setIsLoading(true);
      let connected = derivAPI.getConnectionStatus();
      console.log("Estado inicial da conexão:", connected);
      
      // Garantir que todas as assinaturas anteriores sejam canceladas antes de iniciar novas
      // Isso é muito importante para evitar duplicação de assinaturas e vazamentos de memória
      try {
        console.log("Cancelando assinaturas anteriores antes de iniciar a conexão");
        await derivAPI.cancelAllActiveSubscriptions();
      } catch (error) {
        console.warn("Erro ao limpar assinaturas anteriores:", error);
      }
      
      // Se não estiver conectado, tentar conexão automática com token da sessão
      if (!connected) {
        try {
          // Tentar conectar usando o token armazenado na sessão
          console.log("Tentando conexão automática com o token armazenado...");
          const tokenResult = await derivAPI.connect();
          
          if (tokenResult) {
            connected = true;
            console.log("Conexão automática bem-sucedida!");
            
            // Atualizar estado da conexão
            setIsConnected(true);
            
            // Iniciar assinatura para atualizações de saldo
            try {
              console.log("Iniciando assinatura para atualizações de saldo...");
              await derivAPI.subscribeToBalanceUpdates();
            } catch (error) {
              console.error("Erro ao iniciar assinatura de saldo:", error);
            }
          } else {
            console.log("Falha na conexão automática - continuando com a interface");
          }
        } catch (error) {
          console.warn("Não foi possível conectar automaticamente:", error);
          setIsConnected(false);
        }
      } else {
        // Já está conectado, apenas atualizar o estado
        console.log("API já está conectada, atualizando estado da UI");
        setIsConnected(true);
        
        // Iniciar assinatura para atualizações de saldo
        try {
          console.log("Iniciando assinatura para atualizações de saldo (conexão existente)...");
          await derivAPI.subscribeToBalanceUpdates();
        } catch (error) {
          console.error("Erro ao iniciar assinatura de saldo:", error);
        }
      }
      
      // Iniciar o mecanismo de keep-alive para manter a conexão WebSocket ativa
      if (connected) {
        console.log("Iniciando mecanismo de keep-alive para WebSocket");
        startKeepAlive();
        
        // Notificar o usuário
        toast({
          title: "Conexão mantida ativa",
          description: "Sistema de monitoramento de conexão iniciado",
          duration: 3000,
        });
      }
      
      setIsLoading(false);
    };
    
    checkAndInitConnection();
    
    // Configurar listener para eventos de conexão da API
    const handleConnectionEvent = (event: CustomEvent) => {
      if (event.detail.connected) {
        setIsConnected(true);
        // Reiniciar o keep-alive quando a conexão for restabelecida
        startKeepAlive();
      } else {
        setIsConnected(false);
        // Parar o keep-alive quando a conexão for perdida
        stopKeepAlive();
      }
    };
    
    // Registrar o listener de eventos
    document.addEventListener('deriv:connection_status' as any, handleConnectionEvent as any);
    
    // Limpar assinaturas ao desmontar
    return () => {
      document.removeEventListener('deriv:connection_status' as any, handleConnectionEvent as any);
      // Garantir que o keep-alive seja parado quando o componente for desmontado
      stopKeepAlive();
      
      // Importante: cancelar todas as assinaturas ao desmontar o componente
      // para evitar vazamentos de memória e problemas de conexão 
      // quando o usuário navegar para outras páginas
      console.log("Desmontando dashboard, cancelando assinaturas ativas");
      derivAPI.cancelAllActiveSubscriptions().catch(error => 
        console.warn("Erro ao cancelar assinaturas ao desmontar:", error)
      );
    };
  }, []);

  const handleViewChange = (view: string) => {
    setActiveView(view);
  };

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-[#00e5b3]" />
        </div>
      );
    }
    
    switch (activeView) {
      case "painel":
        return (
          <>
            <h1 className="text-xl font-bold mb-4 text-white">Painel</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Coluna principal (7/12): Robô de Automações + Contratos Abertos */}
              <div className="md:col-span-7 space-y-4">
                {/* Detalhes da Conta */}
                <div className="bg-[#162e40] rounded-lg p-4 border border-[#1c3654] mb-4">
                  <h2 className="text-base font-bold mb-2 text-[#00e5b3] flex items-center justify-between">
                    <div className="flex items-center">
                      <DollarSign className="h-4 w-4 mr-2 text-[#00e5b3]" />
                      Detalhes da Conta
                    </div>
                    <NewAccountSelector 
                      onAccountChanged={(account: { account: string; currency: string; isVirtual?: boolean }) => {
                        toast({
                          title: "Conta alterada",
                          description: `Agora operando com a conta ${account.account}`,
                        });
                      }} 
                    />
                  </h2>
                  
                  {/* Detalhes da conta dentro do Painel */}
                  <AccountDisplay />
                </div>
                
                {/* Robô de Operações */}
                <div className="bg-[#162e40] rounded-lg p-4 border border-[#1c3654]">
                  <h2 className="text-base font-bold mb-2 text-[#00e5b3] flex items-center justify-between">
                    <div className="flex items-center">
                      <Bot className="h-4 w-4 mr-2 text-[#00e5b3]" />
                      Robô de Operações
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33] border-none"
                      onClick={() => navigate("/trading-bot")}
                    >
                      <Bot className="h-4 w-4 mr-2" />
                      Abrir Robô de Operações
                    </Button>
                  </h2>
                  
                  <div className="p-4 text-center">
                    <p className="text-white mb-4">Acesse nosso robô avançado com estratégias prontas para operar automaticamente.</p>
                    <div className="bg-[#00e5b3]/10 p-4 rounded-lg mb-4">
                      <h3 className="text-[#00e5b3] font-bold mb-2">Estratégias disponíveis:</h3>
                      <ul className="text-white text-left mb-4 space-y-1">
                        <li>• IRON OVER - Para operações "acima de" (over)</li>
                        <li>• IRON UNDER - Para operações "abaixo de" (under)</li>
                        <li>• MAXPRO - Estratégia otimizada</li>
                        <li>• Green - Alta rentabilidade</li>
                        <li>• ProfitPro - Gerenciamento inteligente</li>
                      </ul>
                    </div>
                    <Button 
                      onClick={() => navigate("/trading-bot")}
                      className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33] border-none w-full py-6 text-lg font-bold animate-pulse"
                    >
                      <Bot className="h-6 w-6 mr-2" />
                      ACESSAR ROBÔ DE OPERAÇÕES
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Coluna secundária (5/12): Estatísticas R_100 */}
              <div className="md:col-span-5">
                {/* Estatísticas R_100 expandidas */}
                <div className="bg-[#162440] rounded-lg p-4 border border-slate-800 h-full">
                  <h2 className="text-base font-bold mb-3 text-white flex items-center">
                    <span className="bg-[#4364e8] w-3 h-3 rounded-full mr-2"></span>
                    Estatísticas R_100
                  </h2>
                  <DigitStats symbol="R_100" />
                </div>
              </div>
            </div>
          </>
        );
        
      case "dashboard":
        return (
          <>
            <h1 className="text-2xl font-bold mb-6 text-white">Dashboard</h1>
            <div className="grid grid-cols-1 gap-6">
              <div>
                <h2 className="text-xl font-bold mb-4 text-white flex justify-between items-center">
                  <span>Visão Geral</span>
                  <NewAccountSelector 
                    onAccountChanged={(account: { account: string; currency: string; isVirtual?: boolean }) => {
                      // Atualizar a interface após a troca de conta
                      toast({
                        title: "Conta alterada",
                        description: `Agora operando com a conta ${account.account}`,
                      });
                    }}
                  />
                </h2>
                <AccountDashboard onViewChange={handleViewChange} />
              </div>
            </div>
          </>
        );

      case "trading-bot":
        return (
          <>
            <div className="flex items-center mb-6">
              <Bot className="h-6 w-6 mr-2 text-[#00e5b3]" />
              <h1 className="text-2xl font-bold text-white">Robô de Operações</h1>
            </div>
            
            <div className="bg-[#162440] rounded-lg p-6 border border-slate-800">
              <AutomationsRobot />
            </div>
          </>
        );

      case "cashier":
        return (
          <>
            <div className="flex items-center mb-6">
              <DollarSign className="h-6 w-6 mr-2 text-[#00e5b3]" />
              <h1 className="text-2xl font-bold text-white">Operações de Caixa</h1>
            </div>
            
            <CashierOperations />
          </>
        );
        
      default:
        return (
          <div className="text-center py-6">
            <h2 className="text-xl font-bold text-white mb-2">Seção não disponível</h2>
            <p className="text-[#8492b4]">Esta seção está em desenvolvimento.</p>
            <Button 
              onClick={() => setActiveView("painel")} 
              className="mt-4 bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
            >
              Voltar ao Painel
            </Button>
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:flex" />
      
      {/* Mobile Sidebar */}
      <Sidebar className="" isMobile={true} />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-[#0e1a33]">
        {/* Top Navigation */}
        <header className="bg-[#162746] border-b border-[#1c3654] sticky top-0 z-10">
          <div className="flex items-center justify-between p-4">
            {/* Connection Status Indicator */}
            <div className="hidden md:flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`connection-pulse w-2 h-2 rounded-full ${isConnected ? 'bg-[#00e5b3]' : 'bg-red-500'}`}></div>
                <span className="text-sm text-[#8492b4]">{isConnected ? 'Conectado' : 'Desconectado'}</span>
              </div>
            </div>
            
            {/* Mobile tab selection */}
            <div className="md:hidden flex items-center space-x-2">
              <Tabs value={activeView} onValueChange={setActiveView} className="w-full">
                <TabsList className="bg-[#1f3158]">
                  <TabsTrigger value="painel" className="text-xs">Painel</TabsTrigger>
                  <TabsTrigger value="trading-bot" className="text-xs">Robô</TabsTrigger>
                  <TabsTrigger value="dashboard" className="text-xs">Perfil</TabsTrigger>
                  <TabsTrigger value="cashier" className="text-xs">Caixa</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            
            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await derivAPI.cancelAllActiveSubscriptions();
                  toast({
                    title: "Assinaturas resetadas",
                    description: "Todas as assinaturas de dados foram resetadas",
                  });
                } catch (error) {
                  console.error("Erro ao resetar assinaturas:", error);
                }
              }}
              className="text-white border-[#1c3654] hover:bg-[#1c3654]"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </header>
        
        {/* Content Area */}
        <div className="p-4 md:p-6">
          {renderContent()}
        </div>
      </main>
    </div>
  );
}
