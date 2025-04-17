import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { oauthDirectService } from "@/services/oauthDirectService";

interface BotControllerProps {
  entryValue: number;
  profitTarget: number;
  lossLimit: number;
  selectedStrategy: string;
  onStatusChange: (status: 'idle' | 'running' | 'paused') => void;
  onStatsChange: (stats: { wins: number; losses: number; totalProfit: number }) => void;
  onTickReceived?: (price: number, lastDigit: number) => void;
}

export function BotController({
  entryValue,
  profitTarget,
  lossLimit,
  selectedStrategy,
  onStatusChange,
  onStatsChange,
  onTickReceived
}: BotControllerProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalProfit: 0 });

  // Configurar listeners para eventos do serviço OAuth
  useEffect(() => {
    // Função para lidar com eventos do serviço de trading
    const handleTradingEvent = (event: any) => {
      console.log('[BOT_CONTROLLER] Evento recebido:', event.type);
      
      if (event.type === 'error') {
        // Mostrar erro para o usuário
        toast({
          title: "Erro no robô",
          description: event.message,
          variant: "destructive"
        });
      }
      
      if (event.type === 'authorized') {
        // Mostrar notificação de autorização bem-sucedida
        toast({
          title: "Autorização concluída",
          description: `Conta: ${event.account?.loginid || 'Deriv'}`,
        });
      }
      
      if (event.type === 'tick') {
        // Repassar ticks para o componente pai se necessário
        if (onTickReceived) {
          onTickReceived(event.price, event.lastDigit);
        }
      }
      
      if (event.type === 'contract_purchased') {
        // Mostrar notificação de compra
        toast({
          title: "Contrato comprado",
          description: `ID: ${event.contract_id}, Valor: $${event.buy_price}`,
        });
      }
      
      if (event.type === 'contract_finished') {
        // Atualizar estatísticas
        const newStats = { ...stats };
        
        if (event.is_win) {
          newStats.wins += 1;
        } else {
          newStats.losses += 1;
        }
        
        newStats.totalProfit += event.profit;
        setStats(newStats);
        onStatsChange(newStats);
        
        // Mostrar notificação de resultado
        toast({
          title: event.is_win ? "Operação vencedora!" : "Operação perdedora",
          description: `Resultado: $${event.profit.toFixed(2)}`,
          variant: event.is_win ? "default" : "destructive",
        });
      }
      
      if (event.type === 'bot_started') {
        setStatus('running');
        onStatusChange('running');
      }
      
      if (event.type === 'bot_stopped') {
        setStatus('idle');
        onStatusChange('idle');
      }
    };
    
    // Registrar listener
    oauthDirectService.addEventListener(handleTradingEvent);
    
    // Limpar listener ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleTradingEvent);
    };
  }, [toast, onStatusChange, onStatsChange, stats, onTickReceived]);

  // Iniciar o bot com o serviço OAuth direto
  const startBot = async () => {
    try {
      console.log('[BOT_CONTROLLER] Iniciando bot com serviço OAuth direto...');
      
      // Verificar se a estratégia foi selecionada
      if (!selectedStrategy) {
        toast({
          title: "Estratégia não selecionada",
          description: "Por favor, selecione uma estratégia antes de iniciar o robô.",
          variant: "destructive"
        });
        return;
      }
      
      // Verificar se o usuário está autenticado através do token OAuth
      const token = localStorage.getItem('deriv_oauth_token');
      if (!token) {
        toast({
          title: "Autenticação necessária",
          description: "É necessário fazer login com sua conta Deriv para operar com valores reais.",
          variant: "destructive",
        });
        return;
      }
      
      // Feedback visual imediato
      toast({
        title: "Iniciando robô...",
        description: "Estabelecendo conexão dedicada com Deriv...",
      });
      
      // Configurar bot com os parâmetros atuais
      console.log('[BOT_CONTROLLER] Configurando parâmetros do bot', {
        entryValue,
        profitTarget,
        lossLimit,
        martingaleFactor: 1.5
      });
      
      oauthDirectService.setSettings({
        entryValue,
        profitTarget,
        lossLimit,
        martingaleFactor: 1.5
      });
      
      // Definir estratégia ativa
      console.log('[BOT_CONTROLLER] Definindo estratégia ativa:', selectedStrategy);
      oauthDirectService.setActiveStrategy(selectedStrategy);
      
      // Iniciar o serviço de trading
      const success = await oauthDirectService.start();
      
      if (success) {
        // Atualização de status ocorre via evento bot_started
        toast({
          title: "Bot iniciado",
          description: `Executando estratégia "${selectedStrategy}" com entrada de ${entryValue}`,
        });
      } else {
        console.log('[BOT_CONTROLLER] Bot não iniciou com sucesso, resetando estado');
        setStatus('idle');
        onStatusChange('idle');
        toast({
          title: "Falha ao iniciar bot",
          description: "Verifique se sua sessão está ativa e tente novamente.",
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('[BOT_CONTROLLER] Erro ao iniciar bot:', error);
      setStatus('idle');
      onStatusChange('idle');
      toast({
        title: "Erro ao iniciar bot",
        description: "Ocorreu um erro ao iniciar o bot. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Parar o bot
  const stopBot = () => {
    try {
      console.log('[BOT_CONTROLLER] Parando bot...');
      oauthDirectService.stop();
      // Atualização de status ocorre via evento bot_stopped
      toast({
        title: "Parando robô",
        description: "Aguardando conclusão de operações em andamento...",
      });
    } catch (error) {
      console.error('[BOT_CONTROLLER] Erro ao parar bot:', error);
      toast({
        title: "Erro ao parar bot",
        description: "Ocorreu um erro ao parar o bot. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  // Renderizar botão de início/pausa
  return (
    <div className="flex space-x-2">
      {status === 'running' ? (
        <Button
          onClick={stopBot}
          className="flex-1 bg-red-500 hover:bg-red-600 text-white"
        >
          Pausar BOT
        </Button>
      ) : (
        <Button
          onClick={startBot}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white"
        >
          Executar BOT
        </Button>
      )}
    </div>
  );
}