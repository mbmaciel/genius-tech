import { useState, useEffect, useRef } from "react";
import { AccountDashboard } from "@/components/dashboard/AccountDashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/dashboard/Sidebar";
// Relatório Diário removido conforme solicitado
import DigitStats from "@/components/dashboard/DigitStats";
import SimpleDigitStats from "@/components/dashboard/SimpleDigitStats";
import { AutomationsRobot } from "@/components/dashboard/AutomationsRobot";
import { AccountDisplay } from "@/components/dashboard/AccountDisplay";

import { DerivConnect } from "@/components/dashboard/DerivConnect";
import AccountInfo from "@/components/dashboard/AccountInfo";
import TokenManager from "@/components/dashboard/TokenManager";
import { ApiTokensManager } from "@/components/dashboard/ApiTokensManager";
import CashierOperations from "@/components/dashboard/CashierOperations";
import { NewAccountSelector } from "@/components/dashboard/NewAccountSelector";
import { DirectTokenApplier } from "@/components/dashboard/DirectTokenApplier";
import { AccountSwitcher } from "@/components/dashboard/AccountSwitcher";
import derivAPI from "@/lib/derivApi";
import { startKeepAlive, stopKeepAlive } from "@/lib/websocketKeepAlive";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Settings, HelpCircle, Bot, DollarSign } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import TradingBot from "@/components/tradingBot/TradingBot";

export default function DashboardPage() {
  const [activeView, setActiveView] = useState<string>("painel");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Ref removido: relatorioRef

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
                      onClick={() => setActiveView("trading-bot")}
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
                      onClick={() => setActiveView("trading-bot")}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-[#162440] border-slate-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg text-white">Conta</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <AccountDashboard />
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </>
        );
      
      case "trading-bot":
        // Importar a página dedicada do Robô de Operações
        const TradingBotPage = require('./TradingBotPage').default;
        return <TradingBotPage />;
        
      /* Caso removido: relatorio-diario */
        
      case "conexao":
        return (
          <>
            <h1 className="text-2xl font-bold mb-6 text-white">Conexão</h1>
            <div className="grid grid-cols-1 gap-6">
              {/* Componente de reparo de conexão */}
              <DirectTokenApplier />
              
              {/* Ferramenta de troca de contas */}
              <div className="mt-4">
                <AccountSwitcher />
              </div>
              
              <Card className="bg-[#162440] border-slate-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg text-white">Conexão Deriv API</CardTitle>
                </CardHeader>
                <CardContent>
                  <DerivConnect />
                </CardContent>
              </Card>
              
              {/* Componente de gerenciamento de tokens */}
              <div className="mt-6">
                <TokenManager />
              </div>
              
              {/* Componente de operações de caixa (depósito/saque) */}
              {isConnected && (
                <div className="mt-6">
                  <CashierOperations />
                </div>
              )}
            </div>
          </>
        );
          
      default:
        return (
          <div>
            <h1 className="text-2xl font-bold mb-6 text-white">{activeView}</h1>
            <p className="text-[#8492b4]">Conteúdo da página {activeView} será exibido aqui.</p>
          </div>
        );
    }
  };

  // Funções para os botões do cabeçalho
  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      // Primeiramente cancelar todas as assinaturas existentes para evitar duplicação
      console.log("Cancelando assinaturas existentes antes de atualizar...");
      await derivAPI.cancelAllActiveSubscriptions();
      
      // Verificar conexão
      const connected = derivAPI.getConnectionStatus();
      if (!connected) {
        console.log("Restabelecendo conexão...");
        await derivAPI.connect();
      }
      
      // Buscar dados atualizados
      if (activeView === "dashboard") {
        console.log("Atualizando saldo e dados da dashboard...");
        await derivAPI.subscribeToBalanceUpdates();
      } else if (activeView === "painel") {
        console.log("Atualizando painel principal...");
        await derivAPI.subscribeToBalanceUpdates();
        
        // Se estiver na visualização do painel, precisamos garantir que as estatísticas R_100 funcionem
        try {
          await derivAPI.subscribeTicks("R_100");
          console.log("Assinatura de ticks R_100 renovada");
        } catch (tickError) {
          console.warn("Erro ao assinar ticks R_100:", tickError);
        }
      } else if (activeView === "automacoes") {
        // Nada para atualizar por enquanto - o robô gerencia seu próprio estado
        console.log("Atualizando automações...");
      /* Caso removido: relatorio-diario */
      } else if (activeView === "conexao") {
        // Na página de conexão, apenas garantir que o status de conexão está correto
        console.log("Atualizando informações de conexão...");
      }
      
      toast({
        title: "Dados atualizados",
        description: "As informações foram atualizadas com sucesso",
      });
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar os dados",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleHelp = () => {
    toast({
      title: "Ajuda",
      description: "Selecione diferentes visões no menu lateral para navegar pelo sistema.",
    });
  };
  
  return (
    <div className="flex h-full bg-[#0e1a33]">
      <Sidebar onViewChange={handleViewChange} />
      
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Cabeçalho com botões */}
        <div className="bg-[#162440] p-4 border-b border-gray-800 flex justify-between items-center">
          <h1 className="text-lg font-medium text-white">
            {activeView === "dashboard" ? "Dashboard" : 
             activeView === "painel" ? "Painel" :
             activeView === "conexao" ? "Conexão" :
             activeView === "trading-bot" ? "Robô de Operações" : 
             activeView}
          </h1>
          
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs border-slate-700 hover:bg-[#1a2b49]"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
              {isLoading ? "Atualizando..." : "Atualizar"}
            </Button>
            
            <Button 
              variant="outline" 
              size="icon"
              className="h-8 w-8 border-slate-700 hover:bg-[#1a2b49]"
              onClick={handleHelp}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}