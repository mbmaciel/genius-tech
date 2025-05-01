import React from 'react';
import { toast } from '@/hooks/use-toast';
import TradingBot from '@/components/tradingBot/TradingBot';
import derivAPI from '@/lib/derivApi';
import { Bot } from 'lucide-react';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { derivHistoryService } from '@/services/deriv-history-service';

export default function TradingBotPage() {
  const [, navigate] = useLocation();
  const [isConnected, setIsConnected] = React.useState(false);
  const [historyLoaded, setHistoryLoaded] = React.useState(false);

  // Carregar o histórico de ticks quando a página carregar
  React.useEffect(() => {
    const loadTickHistory = async () => {
      try {
        // Verificar se já temos histórico pré-carregado
        const currentHistory = derivHistoryService.getDigitStats('R_100');
        
        if (currentHistory && currentHistory.lastDigits && currentHistory.lastDigits.length >= 500) {
          // Já temos 500 ticks carregados - usar dados existentes
          console.log(`[TradingBot] Usando histórico existente com ${currentHistory.lastDigits.length} ticks já carregados`);
          setHistoryLoaded(true);
          
          // Ainda fazer uma atualização em segundo plano sem aguardar
          derivHistoryService.getTicksHistory('R_100', 500, true, false)
            .catch(error => console.error('[TradingBot] Erro ao atualizar histórico em background:', error));
        } else {
          // Não temos histórico completo, buscar agora 
          console.log('[TradingBot] Pré-carregando histórico de 500 ticks para R_100');
          await derivHistoryService.getTicksHistory('R_100', 500, true);
          setHistoryLoaded(true);
          console.log('[TradingBot] Histórico de ticks carregado com sucesso');
        }
      } catch (error) {
        console.error('[TradingBot] Erro ao pré-carregar histórico de ticks:', error);
      }
    };

    // OTIMIZAÇÃO: Agendar para executar após 50ms para não bloquear a renderização inicial
    const timerId = setTimeout(() => {
      loadTickHistory();
    }, 50);
    
    return () => clearTimeout(timerId);
  }, []);

  React.useEffect(() => {
    // Check initial connection status
    const connectionStatus = derivAPI.getConnectionStatus();
    setIsConnected(connectionStatus);
    
    // Listen for connection status changes
    const handleConnectionStatus = (event: CustomEvent) => {
      setIsConnected(event.detail.connected);
    };
    
    document.addEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    
    // Clean up listener on unmount
    return () => {
      document.removeEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
      
      // Cancel any active subscriptions when leaving the page
      derivAPI.cancelAllActiveSubscriptions().catch(error => 
        console.warn("Erro ao cancelar assinaturas ao desmontar:", error)
      );
    };
  }, []);

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
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => navigate('/dashboard')}
                className="text-white border-[#1c3654] hover:bg-[#1c3654] mr-4"
              >
                Voltar ao Dashboard
              </Button>
              
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-[#00e5b3]' : 'bg-red-500'}`}></div>
                <span className="text-sm text-[#8492b4]">{isConnected ? 'Conectado' : 'Desconectado'}</span>
              </div>
            </div>
          </div>
        </header>
        
        {/* Content */}
        <div className="p-4 md:p-6">
          <div className="space-y-6">
            <div className="flex items-center mb-6">
              <Bot className="h-6 w-6 mr-2 text-[#00e5b3]" />
              <h1 className="text-2xl font-bold text-white">Robô de Operações</h1>
            </div>
            
            <div className="bg-[#162440] rounded-lg p-6 border border-slate-800">
              <TradingBot 
                apiToken={derivAPI.getToken() || ''}
                isConnected={derivAPI.getConnectionStatus()}
                onError={(error: string) => {
                  toast({
                    title: "Erro no Robô de Operações",
                    description: error,
                    variant: "destructive",
                  });
                }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
