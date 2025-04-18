import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { oauthDirectService } from "@/services/oauthDirectService";
import { Wallet, User } from "lucide-react";

interface BotControllerProps {
  entryValue: number;
  profitTarget: number;
  lossLimit: number;
  selectedStrategy: string;
  onStatusChange: (status: 'idle' | 'running' | 'paused') => void;
  onStatsChange: (stats: { wins: number; losses: number; totalProfit: number }) => void;
  onTickReceived?: (price: number, lastDigit: number) => void;
}

interface AccountInfo {
  loginid?: string;
  balance?: number;
  currency?: string;
  is_virtual?: boolean;
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
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    loginid: '',
    balance: 0,
    currency: 'USD',
    is_virtual: false
  });

  // Buscar informações da conta ao iniciar componente
  useEffect(() => {
    // Tentativa de carregar informações armazenadas na sessão
    try {
      const accountInfoStr = localStorage.getItem('deriv_account_info');
      if (accountInfoStr) {
        const storedAccountInfo = JSON.parse(accountInfoStr);
        
        // Verificar se os dados são válidos
        if (storedAccountInfo && storedAccountInfo.loginid) {
          console.log('[BOT_CONTROLLER] Informações da conta carregadas do localStorage:', storedAccountInfo.loginid);
          
          // Atualizar estado com as informações da conta
          setAccountInfo({
            loginid: storedAccountInfo.loginid,
            balance: storedAccountInfo.balance?.balance || storedAccountInfo.balance || 0,
            currency: storedAccountInfo.currency || 'USD',
            is_virtual: storedAccountInfo.is_virtual || (storedAccountInfo.loginid?.startsWith('VRT') ?? false)
          });
        }
      }
    } catch (error) {
      console.error('[BOT_CONTROLLER] Erro ao carregar informações da conta:', error);
    }
    
    // Iniciar processo de autorização para atualizar dados da conta
    oauthDirectService.authorizeActiveToken();
  }, []);

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
        // Atualizar informações da conta
        if (event.account) {
          const newAccountInfo: AccountInfo = {
            loginid: event.account.loginid || '',
            balance: event.account.balance ? 
              (typeof event.account.balance === 'object' ? 
                event.account.balance.balance : event.account.balance) : 0,
            currency: event.account.currency || 'USD',
            is_virtual: event.account.is_virtual || false
          };
          
          console.log('[BOT_CONTROLLER] Conta autorizada:', newAccountInfo);
          setAccountInfo(newAccountInfo);
        }
        
        // Mostrar notificação de autorização bem-sucedida
        toast({
          title: "Autorização concluída",
          description: `Conta: ${event.account?.loginid || 'Deriv'}`,
        });
      }
      
      // Atualizar saldo quando receber atualização
      if (event.type === 'balance_update' && event.balance) {
        setAccountInfo(prev => ({
          ...prev,
          balance: parseFloat(event.balance.balance || 0),
          currency: event.balance.currency || prev.currency
        }));
        console.log('[BOT_CONTROLLER] Saldo atualizado:', event.balance);
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

  // Auxiliar para formatar valor monetário
  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Renderizar botão de início/pausa e informações da conta
  return (
    <div className="space-y-4">
      {/* Barra superior com informações da conta */}
      <div className="bg-slate-800 p-3 rounded-md flex items-center justify-between">
        <div className="flex items-center">
          <User className="h-5 w-5 mr-2 text-blue-400" />
          <span className="text-sm text-gray-300">ID: </span>
          <span className="text-sm font-bold ml-1 text-white">{accountInfo.loginid || '-'}</span>
          {accountInfo.is_virtual && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded">Demo</span>
          )}
        </div>
        <div className="flex items-center">
          <Wallet className="h-5 w-5 mr-2 text-green-400" />
          <span className="text-sm text-gray-300">Saldo: </span>
          <span className="text-sm font-bold ml-1 text-white">
            {accountInfo.balance !== undefined && accountInfo.currency 
              ? formatCurrency(accountInfo.balance, accountInfo.currency)
              : '-'}
          </span>
        </div>
      </div>
      
      {/* Botões de controle */}
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
    </div>
  );
}