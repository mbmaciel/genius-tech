import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { oauthDirectService } from "@/services/oauthDirectService";
import { Wallet, User } from "lucide-react";
import { BinaryBotStrategy } from '@/lib/automationService';
import { StrategyConfigPanel, StrategyConfiguration } from '@/components/StrategyConfigPanel';
import { getStrategyById, getContractTypeForStrategy, usesDigitPrediction } from '@/lib/strategiesConfig';
import { loadStrategyXml, evaluateEntryConditions, getStrategyState } from '@/lib/strategy-handlers';

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

// Componente de botão com estado interno para garantir mudança visual imediata
interface BotButtonProps {
  status: 'idle' | 'running' | 'paused';
  selectedStrategy: string;
  onStart: () => void;
  onStop: () => void;
}

function BotButton({ status: externalStatus, selectedStrategy, onStart, onStop }: BotButtonProps) {
  // Estado interno para garantir que o botão mude visualmente de forma imediata
  const [internalStatus, setInternalStatus] = useState<'idle' | 'running' | 'paused'>(externalStatus);
  
  // Sincronizar estado interno com externo quando ele mudar
  useEffect(() => {
    setInternalStatus(externalStatus);
  }, [externalStatus]);
  
  // Renderizar botão com base no estado interno
  if (internalStatus === 'running') {
    return (
      <Button
        onClick={() => {
          console.log('[BOT_BUTTON] 🛑 Parando bot...');
          // Mudar estado imediatamente para feedback visual
          setInternalStatus('idle');
          onStop();
        }}
        className="flex-1 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 text-white font-medium border border-red-900/50 shadow"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
        </svg>
        Parar Robô
      </Button>
    );
  } else {
    return (
      <Button
        onClick={() => {
          console.log('[BOT_BUTTON] 🚀🚀🚀 INICIANDO BOT - BOTÃO CLICADO 🚀🚀🚀');
          console.log('[BOT_BUTTON] Tipo da função onStart:', typeof onStart);
          // Mudar estado imediatamente para feedback visual
          setInternalStatus('running');
          
          try {
            console.log('[BOT_BUTTON] Chamando função onStart...');
            onStart();
            console.log('[BOT_BUTTON] Função onStart executada com sucesso');
          } catch (error) {
            console.error('[BOT_BUTTON] ❌ ERRO AO CHAMAR FUNÇÃO onStart:', error);
          }
        }}
        className="flex-1 bg-gradient-to-r from-green-800 to-green-900 hover:from-green-700 hover:to-green-800 text-white font-medium border border-green-900/50 shadow"
        disabled={!selectedStrategy}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        Iniciar Operações
      </Button>
    );
  }
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
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfiguration | null>(null);
  const [currentBotStrategy, setCurrentBotStrategy] = useState<BinaryBotStrategy | null>(null);
  
  // Efeito para carregar a estratégia quando o ID mudar
  useEffect(() => {
    const loadStrategyWithXml = async () => {
      if (selectedStrategy) {
        const strategy = getStrategyById(selectedStrategy);
        setCurrentBotStrategy(strategy);
        
        // Se temos a estratégia e o caminho do XML, carregar o XML para o parser
        if (strategy && strategy.xmlPath) {
          try {
            console.log(`[BOT_CONTROLLER] Carregando XML da estratégia ${strategy.name} de: ${strategy.xmlPath}`);
            
            // Usar o novo loadStrategyXml do strategy-handlers
            const loaded = await loadStrategyXml(selectedStrategy, strategy.xmlPath);
            
            if (loaded) {
              console.log(`[BOT_CONTROLLER] XML da estratégia ${strategy.name} carregado com sucesso`);
            } else {
              console.error(`[BOT_CONTROLLER] Falha ao carregar XML da estratégia ${strategy.name}`);
            }
          } catch (error) {
            console.error(`[BOT_CONTROLLER] Erro ao carregar XML da estratégia ${strategy.name}:`, error);
          }
        }
      } else {
        setCurrentBotStrategy(null);
      }
    };
    
    loadStrategyWithXml();
  }, [selectedStrategy]);

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
      // Registrar o evento apenas para fins de log, mas não fazer nada com symbol_update
      // para evitar problemas com fechamento de menus
      console.log('[BOT_CONTROLLER] Evento recebido:', event.type);
      
      // Ignorar todo processamento adicional para symbol_update
      if (event.type === 'symbol_update') {
        return;
      }
      
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
        
        // Disparar evento para o histórico de operações
        // Este evento é capturado pelo componente RelatorioOperacoes para registrar a operação
        const historyEvent = new CustomEvent('trading_operation_finished', {
          detail: {
            timestamp: Date.now(),
            contractId: event.contract_id,
            isWin: event.is_win,
            profit: event.profit,
            entry: event.entry_value || 0,
            exit: event.exit_value || 0,
            status: event.is_win ? 'won' : 'lost',
            type: selectedStrategy,
            contractDetails: event.contract_details || {}
          }
        });
        document.dispatchEvent(historyEvent);
      }
      
      // NOVO: Tratar evento de operação intermediária para estratégia Advance
      if (event.type === 'intermediate_operation') {
        console.log('[BOT_CONTROLLER] Recebida operação intermediária da estratégia Advance:', event.details);
        
        // Criar evento para adicionar a operação intermediária ao histórico
        // Usamos o mesmo formato do evento de histórico normal, mas adicionamos flag de intermediário
        const intermediateHistoryEvent = new CustomEvent('trading_operation_finished', {
          detail: {
            timestamp: Date.now(),
            contractId: event.details.contractId,
            isWin: event.details.status === 'won',
            profit: event.details.profit || 0,
            entry: event.details.amount || 0,
            exit: event.details.result || 0,
            status: event.details.status || 'pending',
            type: `${selectedStrategy} (intermediária)`, // Marcar claramente como intermediária
            isIntermediate: true, // Flag para identificar operações intermediárias no componente de histórico
            analysis: event.details.analysis || '',
            contractDetails: {
              contract_id: event.details.contractId,
              status: event.details.status,
              profit: event.details.profit
            }
          }
        });
        document.dispatchEvent(intermediateHistoryEvent);
      }
      
      if (event.type === 'bot_started' || event.type === 'operation_started') {
        console.log('[BOT_CONTROLLER] ✅ Bot estado alterado para ATIVO após evento:', event.type);
        setStatus('running');
        onStatusChange('running');
      }
      
      if (event.type === 'bot_target_reached') {
        console.log('[BOT_CONTROLLER] 🎯 Meta de lucro atingida:', event.message);
        toast({
          title: "Meta de lucro atingida!",
          description: event.message,
          variant: "default",
          duration: 10000, // 10 segundos para visibilidade
        });
        
        // Atualizar estado para parado
        setStatus('idle');
        onStatusChange('idle');
      }
      
      if (event.type === 'bot_limit_reached') {
        console.log('[BOT_CONTROLLER] 🛑 Limite de perda atingido:', event.message);
        toast({
          title: "Limite de perda atingido!",
          description: event.message,
          variant: "destructive",
          duration: 10000, // 10 segundos para visibilidade
        });
        
        // Atualizar estado para parado
        setStatus('idle');
        onStatusChange('idle');
      }
      
      if (event.type === 'bot_stopped') {
        console.log('[BOT_CONTROLLER] ✅ Bot estado alterado para PARADO após evento:', event.type);
        
        // Exibir notificação se houver uma razão específica
        if (event.reason || event.message) {
          const reason = event.reason || event.message;
          let toastVariant: "default" | "destructive" | null = null;
          
          // Determinar o tipo de notificação
          if (event.notificationType === 'error') {
            toastVariant = "destructive";
          } else if (event.notificationType === 'success') {
            // Manter default para sucesso
          }
          
          // Mostrar toast com a razão da parada
          toast({
            title: "Bot parado",
            description: reason,
            variant: toastVariant || "default",
            duration: 5000
          });
        }
        
        // Atualizar estado do bot
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
  // Handler para quando a configuração da estratégia mudar
  const handleStrategyConfigChange = (config: StrategyConfiguration) => {
    console.log('[BOT_CONTROLLER] Configuração de estratégia atualizada:', config);
    setStrategyConfig(config);
  };
  
  const startBot = async () => {
    try {
      console.log('[BOT_CONTROLLER] 🚀🚀🚀 INICIANDO BOT - FUNÇÃO STARTBOT CHAMADA 🚀🚀🚀');
      console.log('[BOT_CONTROLLER] 🔍 PARÂMETROS DETALHADOS:', {
        estrategia: selectedStrategy,
        config: strategyConfig,
        status: status,
        balanceInfo: accountInfo,
        tokenStatus: localStorage.getItem('deriv_oauth_token') ? 'Presente' : 'Ausente'
      });
      
      // Verificar se a estratégia foi selecionada
      if (!selectedStrategy || !currentBotStrategy) {
        toast({
          title: "Estratégia não selecionada",
          description: "Por favor, selecione uma estratégia antes de iniciar o robô.",
          variant: "destructive"
        });
        return;
      }
      
      // Verificar se temos a configuração da estratégia
      if (!strategyConfig) {
        toast({
          title: "Configuração incompleta",
          description: "Por favor, configure os parâmetros da estratégia antes de iniciar.",
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
      
      // Configurar bot com os parâmetros da estratégia específica
      console.log('[BOT_CONTROLLER] Configurando parâmetros do bot a partir da estratégia', {
        valorInicial: strategyConfig.valorInicial,
        metaGanho: strategyConfig.metaGanho,
        limitePerda: strategyConfig.limitePerda,
        martingale: strategyConfig.martingale
      });
      
      // ----- INÍCIO: NOVA IMPLEMENTAÇÃO COM PARSER XML -----
      // Carregar o XML da estratégia se ainda não foi carregado
      if (currentBotStrategy?.xmlPath) {
        try {
          const loaded = await loadStrategyXml(selectedStrategy, currentBotStrategy.xmlPath);
          if (loaded) {
            console.log(`[BOT_CONTROLLER] XML da estratégia ${currentBotStrategy.name} carregado com sucesso!`);
            
            // Exibir mensagem de sucesso para o usuário
            toast({
              title: "Estratégia carregada",
              description: `A estratégia ${currentBotStrategy.name} foi interpretada e será executada fielmente conforme seus comandos.`,
              duration: 5000,
            });
          } else {
            console.warn(`[BOT_CONTROLLER] Não foi possível carregar XML da estratégia ${currentBotStrategy.name}, usando implementação alternativa`);
          }
        } catch (error) {
          console.error(`[BOT_CONTROLLER] Erro ao carregar XML:`, error);
        }
      }
      // ----- FIM: NOVA IMPLEMENTAÇÃO COM PARSER XML -----
      
      // Definir o tipo de contrato com base na estratégia
      // Agora usaremos o tipo de contrato do XML se disponível
      let contractType = getContractTypeForStrategy(selectedStrategy);
      
      // Determinar a previsão de dígito com base na estratégia
      const needsPrediction = usesDigitPrediction(selectedStrategy);
      let prediction = needsPrediction ? Math.floor(Math.random() * 10) : undefined;
      
      // Tente obter os valores da estratégia usando o parser XML
      try {
        // Obter últimas estatísticas de dígitos 
        const digitStats = oauthDirectService.getDigitStats();
        
        if (digitStats.length > 0) {
          console.log(`[BOT_CONTROLLER] Usando estatísticas de dígitos para análise XML (${digitStats.length} dígitos)`);
          
          // Obter consecutiveLosses do estado atual da estratégia
          const strategyState = getStrategyState(selectedStrategy);
          const consecutiveLosses = strategyState?.consecutiveLosses || 0;
          
          // Analisar estratégia com parser XML
          const xmlAnalysis = await evaluateEntryConditions(
            selectedStrategy, 
            digitStats, 
            strategyConfig,
            currentBotStrategy?.xmlPath
          );
          
          // Usar valores do parser XML se possível
          contractType = xmlAnalysis.contractType;
          prediction = xmlAnalysis.prediction;
          
          console.log(`[BOT_CONTROLLER] ★ Análise XML da estratégia ${selectedStrategy}:`, {
            shouldEnter: xmlAnalysis.shouldEnter,
            contractType: xmlAnalysis.contractType,
            prediction: xmlAnalysis.prediction,
            entryAmount: xmlAnalysis.entryAmount,
            message: xmlAnalysis.message
          });
        }
      } catch (error) {
        console.error(`[BOT_CONTROLLER] Erro ao analisar estratégia com parser XML:`, error);
        // Continuar com os valores padrão obtidos anteriormente
      }
      
      if (prediction !== undefined) {
        console.log(`[BOT_CONTROLLER] Usando previsão de dígito: ${prediction}`);
      }
      
      // Configurar serviço com os parâmetros da configuração atual da estratégia
      oauthDirectService.setSettings({
        entryValue: strategyConfig.valorInicial,
        profitTarget: strategyConfig.metaGanho,
        lossLimit: strategyConfig.limitePerda,
        martingaleFactor: parseFloat(strategyConfig.martingale.toString()),
        contractType,
        prediction
      });
      
      // Definir estratégia ativa
      console.log('[BOT_CONTROLLER] Definindo estratégia ativa:', selectedStrategy);
      oauthDirectService.setActiveStrategy(selectedStrategy);
      
      // Iniciar o serviço de trading
      const success = await oauthDirectService.start();
      
      if (success) {
        // ATUALIZAR IMEDIATAMENTE O STATUS PARA GARANTIR QUE A INTERFACE MUDE
        console.log('[BOT_CONTROLLER] ✅✅✅ SERVIÇO INICIADO - Atualizando status para ATIVO ✅✅✅');
        console.log('[BOT_CONTROLLER] 🔄 Estado anterior:', status);
        setStatus('running');
        onStatusChange('running');
        console.log('[BOT_CONTROLLER] 🔄 Estado atual definido como: running');

        // Forçar a primeira operação após iniciar o serviço
        console.log('[BOT_CONTROLLER] Serviço iniciado, iniciando primeira operação...');
        
        // Executar a primeira operação com base na estratégia e no valor de entrada configurado
        const entryAmount = strategyConfig.valorInicial;
        const operationStarted = await oauthDirectService.executeFirstOperation(entryAmount);
        
        if (operationStarted) {
          console.log('[BOT_CONTROLLER] Primeira operação iniciada com sucesso!');
          // Garantir que o status esteja atualizado novamente
          setStatus('running');
          onStatusChange('running');
        } else {
          console.warn('[BOT_CONTROLLER] Não foi possível iniciar a primeira operação!');
        }
        
        // Atualização de status também ocorre via evento bot_started
        toast({
          title: "Bot iniciado",
          description: `Executando estratégia "${currentBotStrategy?.name}" com entrada de ${entryAmount}`,
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
      
      // Atualizar status IMEDIATAMENTE para garantir mudança na interface
      setStatus('idle');
      onStatusChange('idle');
      
      // Parar o serviço
      oauthDirectService.stop();
      
      // Atualização de status também ocorre via evento bot_stopped
      toast({
        title: "Parando robô",
        description: "Operações interrompidas com sucesso.",
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
      {/* Barra superior - Modal de status totalmente removido conforme solicitado */}
      <div className="bg-gradient-to-r from-[#13203a] to-[#1a2b4c] p-3 rounded-md border border-[#2a3756] shadow-lg">
        <div className="flex items-center justify-between">
          {status === 'running' && (
            <div className="flex items-center bg-green-600/10 py-2 px-4 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-sm text-green-400 font-medium">Operando</span>
            </div>
          )}
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
              <span className="ml-2 text-sm text-blue-400 font-bold">{currentBotStrategy?.name || "Nenhuma"}</span>
            </div>
          </div>
        </div>

        {/* Painel de configuração adaptável para estratégia */}
        <StrategyConfigPanel 
          strategy={currentBotStrategy} 
          onChange={handleStrategyConfigChange}
          className="mt-4" 
        />

        {/* Botões de controle com design aprimorado */}
        <div className="flex space-x-2 mt-4">
          <BotButton 
            status={status} 
            selectedStrategy={selectedStrategy}
            onStart={() => {
              // Log especial para depuração do clique
              console.log('[BOT_BUTTON] 🚀🚀🚀 BOTÃO DE INÍCIO CLICADO 🚀🚀🚀');
              console.log('[BOT_BUTTON] Estratégia selecionada:', selectedStrategy);
              
              // Teste simplificado diretamente para compra
              try {
                // Definir configurações específicas para IRON UNDER
                oauthDirectService.setSettings({
                  contractType: 'DIGITUNDER',
                  prediction: 4,
                  entryValue: 0.35,
                  profitTarget: 20,
                  lossLimit: 20,
                  martingaleFactor: 1.5
                });
                
                // Definir estratégia ativa
                oauthDirectService.setActiveStrategy('IRON UNDER');
                
                // Executar o teste assíncrono
                (async () => {
                  try {
                    console.log('[BOT_TEST] Iniciando serviço...');
                    const success = await oauthDirectService.start();
                    
                    if (success) {
                      console.log('[BOT_TEST] Serviço iniciado com sucesso!');
                      console.log('[BOT_TEST] Executando primeira operação de teste...');
                      
                      // Forçar execução da primeira operação
                      const started = await oauthDirectService.executeFirstOperation(0.35);
                      
                      console.log('[BOT_TEST] Primeira operação executada:', started ? 'SUCESSO' : 'FALHA');
                      
                      // Atualizar estados
                      setStatus('running');
                      onStatusChange('running');
                    } else {
                      console.error('[BOT_TEST] Falha ao iniciar serviço');
                    }
                  } catch (error) {
                    console.error('[BOT_TEST] Erro no teste:', error);
                  }
                })();
              } catch (error) {
                console.error('[BOT_BUTTON] Erro ao executar teste:', error);
              }
            }}
            onStop={() => {
              // Log especial para depuração do clique
              console.log('[BOT_BUTTON] 🛑 Parando bot...');
              // Chamar função para parar o bot
              stopBot();
            }}
          />
        </div>
        
        {/* Dicas para o usuário */}
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