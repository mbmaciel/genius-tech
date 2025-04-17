import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { simpleBotService } from "../services/simpleBotService";

interface BotControllerProps {
  entryValue: number;
  profitTarget: number;
  lossLimit: number;
  selectedStrategy: string;
  onStatusChange: (status: 'idle' | 'running' | 'paused') => void;
  onStatsChange: (stats: { wins: number; losses: number; totalProfit: number }) => void;
}

export function BotController({
  entryValue,
  profitTarget,
  lossLimit,
  selectedStrategy,
  onStatusChange,
  onStatsChange
}: BotControllerProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');

  // Configurar listeners para mudanças de estado do bot
  useEffect(() => {
    const handleStatusChange = (event: any) => {
      if (event.type === 'status_change') {
        console.log('[BOT_CONTROLLER] Status alterado para:', event.status);
        setStatus(event.status);
        onStatusChange(event.status);
      }
    };

    const handleStatsUpdate = (event: any) => {
      if (event.type === 'stats_updated') {
        console.log('[BOT_CONTROLLER] Estatísticas atualizadas:', event.stats);
        onStatsChange({
          wins: event.stats.wins,
          losses: event.stats.losses,
          totalProfit: event.stats.totalProfit
        });
      }
    };

    // Registrar listeners
    simpleBotService.addEventListener(handleStatusChange);
    simpleBotService.addEventListener(handleStatsUpdate);

    // Limpar listeners ao desmontar
    return () => {
      simpleBotService.removeEventListener(handleStatusChange);
      simpleBotService.removeEventListener(handleStatsUpdate);
    };
  }, [onStatusChange, onStatsChange]);

  // Iniciar o bot - VERSÃO CORRIGIDA E MELHORADA
  const startBot = async () => {
    try {
      console.log('[BOT_CONTROLLER] Iniciando bot (VERSÃO CORRIGIDA E MELHORADA)...');
      
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
      
      // Atualizar status para feedback visual imediato
      setStatus('running');
      onStatusChange('running');
      
      // Tentar estabelecer conexão WebSocket com token OAuth
      try {
        const { derivAPI } = await import('../lib/websocketManager');
        if (!derivAPI.getSocketInstance() || derivAPI.getSocketInstance()?.readyState !== WebSocket.OPEN) {
          console.log('[BOT_CONTROLLER] Estabelecendo conexão WebSocket...');
          await derivAPI.connect();
          await derivAPI.authorize(token);
          console.log('[BOT_CONTROLLER] Conexão WebSocket estabelecida e autorizada');
        }
      } catch (connError) {
        console.error('[BOT_CONTROLLER] Erro ao estabelecer conexão:', connError);
        toast({
          title: "Erro de conexão",
          description: "Não foi possível conectar à API Deriv. Verifique sua conexão.",
          variant: "destructive"
        });
      }
      
      // Configurar bot com os parâmetros atuais
      console.log('[BOT_CONTROLLER] Configurando parâmetros do bot', {
        entryValue,
        profitTarget,
        lossLimit,
        martingaleFactor: 1.5
      });
      
      simpleBotService.setSettings({
        entryValue,
        profitTarget,
        lossLimit,
        martingaleFactor: 1.5
      });
      
      // Definir estratégia ativa
      console.log('[BOT_CONTROLLER] Definindo estratégia ativa:', selectedStrategy);
      simpleBotService.setActiveStrategy(selectedStrategy);
      
      // Iniciar o bot com pequeno atraso para garantir que a UI atualize primeiro
      console.log('[BOT_CONTROLLER] Iniciando bot com delay para UI...');
      
      // Usar um timeout para garantir que a interface atualize primeiro
      setTimeout(() => {
        try {
          console.log('[BOT_CONTROLLER] Chamando simpleBotService.start() de forma direta...');
          
          // Forçar tipo para simpleBotService para que TypeScript reconheça o método
          const botService = simpleBotService as typeof simpleBotService;
          
          // Chamar diretamente sem await para evitar problemas de contexto
          const promise = botService.start();
          
          // Tratar resultado da inicialização
          promise.then(success => {
            console.log('[BOT_CONTROLLER] Resultado do start():', success);
            
            if (success) {
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
          }).catch(error => {
            console.error('[BOT_CONTROLLER] Erro ao iniciar bot via promise:', error);
            setStatus('idle');
            onStatusChange('idle');
            toast({
              title: "Erro ao iniciar bot",
              description: "Ocorreu um erro ao iniciar o bot. Veja o console para detalhes.",
              variant: "destructive"
            });
          });
        } catch (e) {
          console.error('[BOT_CONTROLLER] Erro no timeout de start():', e);
          setStatus('idle');
          onStatusChange('idle');
        }
      }, 100);
      
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
      simpleBotService.stop();
      setStatus('idle');
      onStatusChange('idle');
      toast({
        title: "Bot parado",
        description: "O bot foi parado com sucesso.",
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