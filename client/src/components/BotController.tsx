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
    const loadAccountInfo = async () => {
      // Primeiro, tentar carregar informações da sessão local
      try {
        const accountInfoStr = localStorage.getItem('deriv_account_info');
        if (accountInfoStr) {
          const storedAccountInfo = JSON.parse(accountInfoStr);
          
          // Verificar se os dados são válidos
          if (storedAccountInfo && storedAccountInfo.loginid) {
            console.log('[BOT_CONTROLLER] Informações da conta carregadas do localStorage:', storedAccountInfo.loginid);
            
            // Extrair saldo corretamente
            let balance = 0;
            if (typeof storedAccountInfo.balance === 'object' && storedAccountInfo.balance !== null) {
              balance = parseFloat(storedAccountInfo.balance.balance || 0);
            } else {
              balance = parseFloat(storedAccountInfo.balance || 0);
            }
            
            console.log('[BOT_CONTROLLER] Saldo carregado:', balance);
            
            // Atualizar estado com as informações da conta
            setAccountInfo({
              loginid: storedAccountInfo.loginid,
              balance: balance,
              currency: storedAccountInfo.currency || 'USD',
              is_virtual: storedAccountInfo.is_virtual || (storedAccountInfo.loginid?.startsWith('VRT') ?? false)
            });
          }
        }
      } catch (error) {
        console.error('[BOT_CONTROLLER] Erro ao carregar informações da conta do localStorage:', error);
      }
      
      // Em seguida, tentar obter dados atualizados via API
      try {
        // Iniciar processo de autorização para atualizar dados da conta
        console.log('[BOT_CONTROLLER] Solicitando autorização via oauthDirectService');
        await oauthDirectService.authorizeActiveToken();
        
        // Verificar se há token ativo para a conta selecionada
        const activeAccount = localStorage.getItem('deriv_active_account');
        const accountTokens = localStorage.getItem('deriv_account_tokens');
        
        if (activeAccount && accountTokens) {
          try {
            const tokens = JSON.parse(accountTokens);
            const token = tokens[activeAccount];
            
            if (token) {
              console.log('[BOT_CONTROLLER] Token ativo encontrado para a conta:', activeAccount);
            }
          } catch (e) {
            console.error('[BOT_CONTROLLER] Erro ao processar tokens de conta:', e);
          }
        }
      } catch (error) {
        console.error('[BOT_CONTROLLER] Erro ao obter dados atualizados da conta:', error);
      }
    };
    
    // Executar carregamento de dados
    loadAccountInfo();
    
    // Verificar a cada 30 segundos se há atualizações de saldo
    const refreshInterval = setInterval(() => {
      oauthDirectService.getAccountBalance();
    }, 30000);
    
    return () => clearInterval(refreshInterval);
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
      
      // Eventos de problema de permissão de token
      if (event.type === 'token_permission_error' || event.type === 'token_permission_warning') {
        const severity = event.type === 'token_permission_error' ? 'high' : 'medium';
        
        toast({
          title: severity === 'high' ? "Erro de permissão" : "Aviso de permissão",
          description: event.message,
          variant: severity === 'high' ? "destructive" : "default",
          duration: 10000, // 10 segundos para ler
        });
        
        // Se for um erro crítico, exibir instruções mais detalhadas
        if (severity === 'high') {
          setTimeout(() => {
            toast({
              title: "Como resolver",
              description: "Você precisa autorizar a aplicação com permissões de trading. Clique no botão de login na dashboard para autorizar novamente.",
              duration: 15000,
            });
          }, 2000);
        }
      }
      
      // Evento de reautorização necessária - removido por solicitação do usuário
      if (event.type === 'reauthorization_required') {
        // Removido o aviso de reautorização conforme solicitado
        console.log("[BOT_CONTROLLER] Evento de reautorização recebido, mas o aviso foi desativado");
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
        
        // Verificar se temos informações sobre escopos/permissões
        const hasTrading = event.account?.scopes?.some((scope: string) => 
          ['trade', 'trading', 'trading_information'].includes(scope.toLowerCase())
        );
        
        // Notificação de autorização (removido aviso de conta conforme solicitado)
        console.log('[BOT_CONTROLLER] Autorização concluída:', event.account?.loginid, 'Trading permitido:', hasTrading);
      }
      
      // Atualizar saldo quando receber atualização
      if (event.type === 'balance_update' && event.balance) {
        // Forçar atualização do saldo diretamente com o valor correto
        const newBalance = parseFloat(event.balance.balance || 0);
        console.log('[BOT_CONTROLLER] Atualizando saldo de:', accountInfo.balance, 'para:', newBalance);
        
        setAccountInfo(prev => ({
          ...prev,
          balance: newBalance,
          currency: event.balance.currency || prev.currency
        }));
        
        // Forçar atualização do localStorage para garantir persistência
        try {
          const accountInfoStr = localStorage.getItem('deriv_account_info');
          if (accountInfoStr) {
            const storedInfo = JSON.parse(accountInfoStr);
            storedInfo.balance = newBalance;
            localStorage.setItem('deriv_account_info', JSON.stringify(storedInfo));
          }
        } catch (e) {
          console.error('[BOT_CONTROLLER] Erro ao atualizar localStorage:', e);
        }
        
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

  // Não precisamos mais dessa função formatCurrency, já que usamos template string diretamente
  
  // Renderizar botão de início/pausa e informações da conta
  return (
    <div className="space-y-4">
      {/* Barra superior com status de execução */}
      <div className="bg-gradient-to-r from-[#13203a] to-[#1a2b4c] p-3 rounded-md border border-[#2a3756] shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className={`p-2 rounded-full mr-2 ${
              status === 'running' ? 'bg-green-600/20' : 
              status === 'paused' ? 'bg-yellow-600/20' : 'bg-gray-600/20'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${
                status === 'running' ? 'text-green-400' : 
                status === 'paused' ? 'text-yellow-400' : 'text-gray-400'
              }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d={status === 'running' 
                    ? "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    : status === 'paused' 
                    ? "M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                    : "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"} 
                />
              </svg>
            </div>
            <div>
              <div className={`text-sm font-medium ${
                status === 'running' ? 'text-green-400' : 
                status === 'paused' ? 'text-yellow-400' : 'text-gray-400'
              }`}>
                {status === 'running' ? 'Bot em Execução' : 
                 status === 'paused' ? 'Bot Pausado' : 'Bot Inativo'}
              </div>
              <div className="flex mt-0.5 items-center">
                <span className="text-xs text-gray-400">Entrada:</span>
                <span className="text-xs ml-1.5 text-white">{entryValue}</span>
                <span className="text-xs text-gray-400 ml-3">Alvo:</span>
                <span className="text-xs ml-1.5 text-white">{profitTarget}</span>
                <span className="text-xs text-gray-400 ml-3">Stop:</span>
                <span className="text-xs ml-1.5 text-white">{lossLimit}</span>
              </div>
            </div>
          </div>
          
          {status === 'running' && (
            <div className="flex items-center bg-green-600/10 py-1 px-3 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-xs text-green-400">Operando</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Estatísticas de operações - NOVO! */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-[#0e1a2e] rounded-md p-3 border border-[#2a3756]">
        <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
          <span className="text-xs text-gray-400">Vitórias</span>
          <span className="text-lg font-bold text-green-400">{stats.wins}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
          <span className="text-xs text-gray-400">Derrotas</span>
          <span className="text-lg font-bold text-red-400">{stats.losses}</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
          <span className="text-xs text-gray-400">Taxa de Acerto</span>
          <span className="text-lg font-bold text-yellow-400">
            {stats.wins + stats.losses > 0 
              ? `${Math.round((stats.wins / (stats.wins + stats.losses)) * 100)}%` 
              : '0%'}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 bg-[#13203a] rounded">
          <span className="text-xs text-gray-400">Lucro Total</span>
          <span className={`text-lg font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {stats.totalProfit.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Estratégia e botões de controle melhorados */}
      <div className="space-y-3">
        <div className="flex items-center p-3 bg-[#0e1a2e] rounded-md border border-[#2a3756]">
          <div className="flex-1">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              <span className="text-sm text-white font-medium">Estratégia Ativa:</span>
              <span className="ml-2 text-sm text-blue-400 font-bold">{selectedStrategy || "Nenhuma"}</span>
            </div>
          </div>
        </div>

        {/* Botões de controle com design aprimorado */}
        <div className="flex space-x-2">
          {status === 'running' ? (
            <Button
              onClick={stopBot}
              className="flex-1 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 text-white font-medium border border-red-900/50 shadow"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
              </svg>
              Parar Robô
            </Button>
          ) : (
            <Button
              onClick={startBot}
              className="flex-1 bg-gradient-to-r from-green-800 to-green-900 hover:from-green-700 hover:to-green-800 text-white font-medium border border-green-900/50 shadow"
              disabled={!selectedStrategy}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Iniciar Operações
            </Button>
          )}
        </div>
        
        {/* Dicas para o usuário - NOVO! */}
        {!selectedStrategy && (
          <div className="mt-2 text-xs text-center text-yellow-500">
            Selecione uma estratégia antes de iniciar as operações
          </div>
        )}
        {status === 'running' && (
          <div className="mt-2 text-xs text-center text-green-500 animate-pulse">
            Robô executando operações automaticamente...
          </div>
        )}
      </div>
    </div>
  );
}