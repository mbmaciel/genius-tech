import React, { useState, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OperationStatus } from "@/components/OperationStatus";
import { BotController } from "@/components/BotController";
import { DirectDigitDisplay } from "@/components/DirectDigitDisplay";
import { DirectTickerDisplay } from "@/components/DirectTickerDisplay";
import { ForceUpdateDigitDisplay } from "@/components/ForceUpdateDigitDisplay";
import { PureWebSocketDigits } from "@/components/PureWebSocketDigits";
import { SimpleDigitDisplay } from "@/components/SimpleDigitDisplay";
import { WebSocketDiagnostic } from "@/components/WebSocketDiagnostic";
import { TokenPermissionAlert } from "@/components/TokenPermissionAlert";
import derivApiService from "@/services/derivApiService";
import { oauthDirectService } from "@/services/oauthDirectService";
import { BotStatus } from "@/services/botService";

// Log para indicar uso da nova versão com OAuth dedicado
console.log('[BOT_PAGE] Usando nova página de bot que usa exclusivamente serviço OAuth dedicado');

// Interface para representar uma conta Deriv
interface DerivAccount {
  loginid: string;
  token: string;
  currency: string;
  balance?: number;
  isVirtual?: boolean;
}

export function BotPage() {
  const { toast } = useToast();
  
  // Função para recarregar a página forçadamente
  const forceFullReload = () => {
    console.log('[BOT_PAGE] Forçando recarregamento completo da página...');
    
    // Criar elemento visual de carregamento
    const loadingElement = document.createElement('div');
    loadingElement.style.position = 'fixed';
    loadingElement.style.top = '0';
    loadingElement.style.left = '0';
    loadingElement.style.width = '100%';
    loadingElement.style.height = '100%';
    loadingElement.style.backgroundColor = 'rgba(11, 20, 41, 0.9)';
    loadingElement.style.zIndex = '9999';
    loadingElement.style.display = 'flex';
    loadingElement.style.alignItems = 'center';
    loadingElement.style.justifyContent = 'center';
    loadingElement.style.flexDirection = 'column';
    loadingElement.style.color = 'white';
    loadingElement.style.fontSize = '24px';
    loadingElement.style.fontWeight = 'bold';
    loadingElement.innerHTML = `
      <div style="margin-bottom: 20px;">ATUALIZANDO PÁGINA</div>
      <div style="font-size: 18px; margin-bottom: 30px;">Recarregando aplicação...</div>
      <div style="width: 60px; height: 60px; border: 5px solid #1E3A8A; border-top: 5px solid #00E5B3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    `;
    
    // Adicionar estilo de animação
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(loadingElement);
    
    // Recarregar a página após pequeno delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };
  
  // Estado para autenticação e dados da conta
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [selectedAccount, setSelectedAccount] = useState<DerivAccount | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null); // Token para autorização de operações
  
  // Estado para controle do robô
  const [botStatus, setBotStatus] = useState<BotStatus>('idle');
  
  // Estados para dados do gráfico
  const [ticks, setTicks] = useState<string>("10");
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<{
    digit: number;
    count: number;
    percentage: number;
  }[]>(Array.from({ length: 10 }, (_, i) => ({ 
    digit: i, 
    count: 0, 
    percentage: 0 
  })));
  
  // Estados para configurações do bot
  const [entryValue, setEntryValue] = useState<string>("0.35");
  const [profitTarget, setProfitTarget] = useState<string>("");
  const [lossLimit, setLossLimit] = useState<string>("");
  const [virtualLoss, setVirtualLoss] = useState<string>("");
  const [selectedBotType, setSelectedBotType] = useState<"lite" | "premium" | "">("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  
  // Definir estratégias disponíveis
  const strategies = {
    lite: [
      { id: "profitpro", name: "Profit Pro", file: "Profitpro Atualizado.xml" },
      { id: "manualunder", name: "Manual Under", file: "Manual Under.xml" },
      { id: "advance", name: "Advance", file: "Advance .xml" },
      { id: "wisetendencia", name: "Wise Pro Tendência", file: "WISE PRO TENDENCIA.xml" }
    ],
    premium: [
      { id: "ironover", name: "Iron Over", file: "IRON OVER.xml" },
      { id: "ironunder", name: "Iron Under", file: "IRON UNDER.xml" },
      { id: "botlow", name: "Bot Low", file: "BOT LOW.xml" },
      { id: "maxpro", name: "Max Pro", file: "MAXPRO .xml" },
      { id: "green", name: "Green", file: "green.xml" },
      { id: "manualover", name: "Manual Over", file: "manual Over.xml" }
    ]
  };
  
  // Estado para operações
  const [operation, setOperation] = useState<{
    entry: number;
    buyPrice: number;
    profit: number;
    status: 'comprado' | 'vendendo' | null;
  }>({
    entry: 1584.42,
    buyPrice: 0,
    profit: 0,
    status: null
  });
  
  // Estado para estatísticas
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0
  });
  
  // Estado para saldo em tempo real
  const [realTimeBalance, setRealTimeBalance] = useState<{
    balance: number;
    previousBalance: number;
  }>({
    balance: 0,
    previousBalance: 0
  });

  // Estado para controlar se o usuário está autenticado
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  // Verificar autenticação e conectar com OAuth direto
  useEffect(() => {
    console.log('[BOT_PAGE] Inicializando página do bot com conexão OAuth dedicada');
    
    // Script para forçar atualização da página a cada 30 segundos se necessário
    // Isso ajuda a resolver problemas de atualização da interface
    let updateAttempts = 0;
    const maxUpdateAttempts = 3;
    
    const forcePageRefresh = () => {
      if (updateAttempts < maxUpdateAttempts) {
        updateAttempts++;
        console.log(`[BOT_PAGE] Forçando atualização da interface (tentativa ${updateAttempts}/${maxUpdateAttempts})`);
        
        // Forçar um re-render usando o estado React
        setLastDigits(prev => [...prev]);
        setDigitStats(prev => [...prev]);
        
        // Se não resolver após tentativas, recarregar a página
        if (updateAttempts === maxUpdateAttempts) {
          console.log('[BOT_PAGE] Problemas persistentes na interface, recarregando página...');
          setTimeout(() => window.location.reload(), 5000);
        }
      }
    };
    
    // Adicionar script para forçar refresh se necessário
    const checkInterfaceUpdates = setInterval(() => {
      const lastTick = localStorage.getItem('last_tick_timestamp');
      const now = Date.now();
      
      if (lastTick && (now - parseInt(lastTick)) > 20000) {
        console.log('[BOT_PAGE] Detectada inatividade na interface há mais de 20 segundos');
        forcePageRefresh();
      }
    }, 30000);
    
    // Inicializar a conexão WebSocket do OAuth assim que a página carregar
    oauthDirectService.initializeConnection()
      .then(success => {
        if (success) {
          console.log('[BOT_PAGE] Conexão WebSocket inicializada com sucesso');
          toast({
            title: "Conexão estabelecida",
            description: "Conexão com servidor da Deriv estabelecida com sucesso"
          });
          
          // Marcar timestamp do último tick
          localStorage.setItem('last_tick_timestamp', Date.now().toString());
        } else {
          console.error('[BOT_PAGE] Falha ao inicializar conexão WebSocket');
          toast({
            title: "Erro de conexão",
            description: "Falha ao conectar com servidor da Deriv",
            variant: "destructive"
          });
        }
      })
      .catch(error => {
        console.error('[BOT_PAGE] Erro ao inicializar conexão WebSocket:', error);
        toast({
          title: "Erro de conexão",
          description: error.message || "Falha ao conectar com servidor Deriv",
          variant: "destructive"
        });
      });
      
    // Limpar intervalos ao desmontar
    return () => {
      clearInterval(checkInterfaceUpdates);
    };
    
    // Verificar parâmetros OAuth na URL
    const url = window.location.href;
    if (url.includes('acct1=') && url.includes('token1=')) {
      console.log('[BOT] Detectados parâmetros OAuth na URL, processando...');
      // Importar funções para processar tokens
      import('@/lib/accountManager').then(({ extractAccountsFromUrl, saveAccounts, authorizeAccount }) => {
        (async () => {
          try {
            // Extrair contas da URL
            const accounts = extractAccountsFromUrl(url);
            
            if (accounts.length > 0) {
              // Salvar todas as contas no localStorage
              saveAccounts(accounts);
              
              // Salvar o token principal
              localStorage.setItem('deriv_oauth_token', accounts[0].token);
              
              // Autorizar e salvar detalhes
              const accountInfo = await authorizeAccount(accounts[0].token);
              localStorage.setItem('deriv_account_info', JSON.stringify(accountInfo));
              
              // Limpar URL de parâmetros OAuth
              window.history.replaceState({}, document.title, window.location.pathname);
              
              // Recarregar a página para usar os novos tokens
              window.location.reload();
            }
          } catch (error) {
            console.error('[BOT] Erro ao processar parâmetros OAuth:', error);
            setIsAuthenticated(false);
          }
        })();
      });
      return;
    }
    
    // Verificar se há informações de conta no localStorage
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    const storedAuthToken = localStorage.getItem('deriv_oauth_token');
    
    if (storedAccountInfo && storedAuthToken) {
      try {
        const parsedInfo = JSON.parse(storedAccountInfo);
        setAccountInfo(parsedInfo);
        setAuthToken(storedAuthToken);
        setIsAuthenticated(true);
        
        // Carregar dados da conta da dashboard
        const dashboardAccount: DerivAccount = {
          loginid: parsedInfo.loginid || '',
          token: storedAuthToken,
          currency: parsedInfo.currency || 'USD',
          balance: parsedInfo.balance ? parseFloat(parsedInfo.balance) : 0,
          isVirtual: (parsedInfo.loginid || '').startsWith('VRT')
        };
        
        // Verificar se há uma conta previamente selecionada pelo usuário
        try {
          const savedAccount = localStorage.getItem('deriv_selected_account');
          if (savedAccount) {
            const parsedAccount = JSON.parse(savedAccount);
            if (parsedAccount && parsedAccount.token && parsedAccount.loginid) {
              // Conta selecionada pelo usuário encontrada
              console.log(`[BOT] Usando conta previamente selecionada pelo usuário: ${parsedAccount.loginid}`);
              
              // Usar esta conta em vez da conta da dashboard
              const userAccount: DerivAccount = {
                loginid: parsedAccount.loginid,
                token: parsedAccount.token,
                currency: dashboardAccount.currency, // Usar moeda da dashboard como fallback
                balance: dashboardAccount.balance,   // Usar saldo da dashboard como fallback
                isVirtual: parsedAccount.loginid.startsWith('VRT')
              };
              
              // Definir como conta selecionada
              setSelectedAccount(userAccount);
              
              // Informar o serviço OAuth Direct para usar esta conta
              oauthDirectService.setActiveAccount(userAccount.loginid, userAccount.token);
              
              console.log('[BOT] Conta selecionada pelo usuário restaurada:', userAccount.loginid);
              return;
            }
          }
        } catch (error) {
          console.error('[BOT] Erro ao restaurar conta selecionada pelo usuário:', error);
        }
        
        // Se não houver conta previamente selecionada, usar a conta da dashboard
        console.log('[BOT] Nenhuma conta selecionada pelo usuário encontrada, usando dashboard:', dashboardAccount.loginid);
        
        // Definir como conta selecionada
        setSelectedAccount(dashboardAccount);
        console.log('[BOT] Autenticação verificada com sucesso');
        
        // Configurar valores iniciais
        setOperation(prev => ({
          ...prev,
          buyPrice: parseFloat(entryValue) || 0
        }));
        
        // Antes de iniciar, forçar a definição da conta selecionada como ativa no serviço
        console.log('[BOT] Definindo conta ativa no serviço OAuth:', dashboardAccount.loginid);
        
        // Garantir que o oauthDirectService use a conta selecionada na dashboard
        oauthDirectService.setActiveAccount(dashboardAccount.loginid, dashboardAccount.token);
        
        // Iniciar a conexão WebSocket do serviço OAuth Direct
        oauthDirectService.start()
          .then(success => {
            if (success) {
              console.log('[BOT] Conexão OAuth Direct iniciada com sucesso');
              toast({
                title: "Conexão estabelecida",
                description: "Conectado ao servidor Deriv via OAuth",
              });
              
              // Forçar a reconexão para garantir que os dígitos apareçam corretamente
              if (typeof oauthDirectService.reconnect === 'function') {
                console.log('[BOT] Forçando reconexão inicial para garantir recebimento de dígitos...');
                oauthDirectService.reconnect()
                  .then(reconnectSuccess => {
                    if (reconnectSuccess) {
                      console.log('[BOT] Reconexão inicial bem-sucedida');
                    } else {
                      console.error('[BOT] Falha na reconexão inicial');
                    }
                  })
                  .catch(error => {
                    console.error('[BOT] Erro na reconexão inicial:', error);
                  });
              }
            } else {
              console.error('[BOT] Falha ao iniciar conexão OAuth Direct');
              toast({
                title: "Erro de conexão",
                description: "Não foi possível conectar ao servidor Deriv",
                variant: "destructive"
              });
            }
          })
          .catch(error => {
            console.error('[BOT] Erro ao iniciar conexão OAuth Direct:', error);
            toast({
              title: "Erro de conexão",
              description: error.message || "Falha ao conectar com o servidor",
              variant: "destructive"
            });
          });
        
        // Configurar handlers para eventos do serviço OAuth Direct
        const handleEvents = (event: any) => {
          // Tick recebido
          if (event.type === 'tick') {
            const price = event.price;
            const lastDigit = event.lastDigit;
            
            // Atualizar últimos dígitos - FORÇAR ATUALIZAÇÃO
            setLastDigits(prev => {
              console.log('[BOT_PAGE] Atualizando lastDigits com novo dígito:', lastDigit);
              // Criando um novo array para garantir que o React reconheça a mudança
              const updated = [lastDigit, ...prev].slice(0, 20);
              console.log('[BOT_PAGE] Novo array de dígitos:', updated);
              return updated;
            });
            
            // Atualizar estatísticas de dígitos
            updateDigitStats(lastDigit);
            
            console.log(`[OAUTH_DIRECT] Tick recebido: ${price}, Último dígito: ${lastDigit}`);
          }
          
          // Evento de autorização bem-sucedida
          if (event.type === 'authorized') {
            console.log('[OAUTH_DIRECT] Autorização realizada com sucesso na conta:', event.account?.loginid);
            
            // Atualizar informações da conta se necessário
            if (event.account) {
              const updatedAccount = {
                ...parsedInfo,
                loginid: event.account.loginid,
                balance: event.account.balance?.toString() || parsedInfo.balance,
                currency: event.account.currency || parsedInfo.currency
              };
              
              setAccountInfo(updatedAccount);
              console.log('[OAUTH_DIRECT] Informações da conta atualizadas');
            }
          }
          
          // Atualização de saldo
          if (event.type === 'balance_update' && event.balance) {
            if (accountInfo) {
              const newBalance = parseFloat(event.balance.balance);
              const currentBalance = parseFloat(accountInfo.balance);
              
              // Atualizar informações da conta apenas se o saldo mudou
              if (newBalance !== currentBalance) {
                setAccountInfo({
                  ...accountInfo,
                  balance: newBalance // Mantém como número, sem converter para string
                });
                
                // Atualizar saldo em tempo real
                setRealTimeBalance({
                  balance: newBalance,
                  previousBalance: currentBalance
                });
                
                console.log(`[OAUTH_DIRECT] Saldo atualizado: ${currentBalance} -> ${newBalance}`);
              }
            }
          }
          
          // Compra de contrato
          if (event.type === 'contract_purchased') {
            console.log('[OAUTH_DIRECT] Contrato comprado:', event.contract_id);
            
            // Atualizar estado de operação
            setOperation(prev => ({
              ...prev,
              status: 'comprado'
            }));
            
            toast({
              title: "Contrato comprado",
              description: `ID: ${event.contract_id}, Valor: $${event.buy_price}`,
            });
          }
          
          // Atualização de contrato
          if (event.type === 'contract_update') {
            // Log para acompanhamento do contrato
            console.log('[OAUTH_DIRECT] Atualização do contrato:', event.contract?.contract_id);
          }
          
          // Encerramento de contrato
          if (event.type === 'contract_finished') {
            console.log('[OAUTH_DIRECT] Contrato encerrado:', event);
            
            // Atualizar estatísticas
            if (event.is_win) {
              setStats(prev => ({ ...prev, wins: prev.wins + 1 }));
            } else {
              setStats(prev => ({ ...prev, losses: prev.losses + 1 }));
            }
            
            // Atualizar estado da operação
            setOperation({
              entry: operation.entry,
              buyPrice: operation.buyPrice,
              profit: event.profit,
              status: 'vendendo'
            });
            
            // Exibir notificação de resultado
            toast({
              title: event.is_win ? "Operação Vencedora!" : "Operação Perdedora",
              description: `Resultado: $${event.profit.toFixed(2)}`,
              variant: event.is_win ? "default" : "destructive",
            });
            
            // Resetar estado após conclusão
            setTimeout(() => {
              setOperation({
                entry: operation.entry,
                buyPrice: operation.buyPrice,
                profit: 0,
                status: null
              });
            }, 3000);
          }
          
          // Erros
          if (event.type === 'error') {
            console.error('[OAUTH_DIRECT] Erro:', event.message);
            toast({
              title: "Erro na operação",
              description: event.message,
              variant: "destructive"
            });
          }
        };
        
        // Registrar handler no serviço OAuth
        console.log('[BOT_PAGE] Registrando listener de eventos do oauthDirectService');
        oauthDirectService.addEventListener(handleEvents);
        
        // Forçar uma inscrição para ticks do R_100 - CORREÇÃO CRÍTICA
        console.log('[BOT_PAGE] Forçando inscrição para ticks de R_100');
        setTimeout(() => {
          if (typeof oauthDirectService.subscribeToTicks === 'function') {
            oauthDirectService.subscribeToTicks('R_100');
            console.log('[BOT_PAGE] Função subscribeToTicks chamada');
          } else {
            console.error('[BOT_PAGE] Função subscribeToTicks não encontrada no serviço');
            // Alternativa: forçar reconexão para iniciar a subscricão
            oauthDirectService.reconnect().then(success => {
              console.log('[BOT_PAGE] Reconexão forçada para resolver problema de ticks:', success);
            });
          }
        }, 1000);
        
        return () => {
          // Limpar recursos ao desmontar
          console.log('[BOT_PAGE] Removendo listener de eventos do oauthDirectService');
          oauthDirectService.removeEventListener(handleEvents);
          
          // Parar serviço se estiver rodando
          if (botStatus === 'running') {
            oauthDirectService.stop();
          }
        };
      } catch (error) {
        console.error('[BOT] Erro ao carregar dados da conta:', error);
        setIsAuthenticated(false);
      }
    } else {
      console.log('[BOT] Usuário não autenticado');
      setIsAuthenticated(false);
    }
  }, []);
  
  // Atualizar estatísticas de dígitos - VERSÃO CORRIGIDA
  const updateDigitStats = (newDigit: number) => {
    console.log("[BOT_PAGE] Atualizando estatísticas com novo dígito:", newDigit);
    
    setDigitStats(prev => {
      // Contagem de dígitos nos últimos ticks
      const counts: number[] = Array(10).fill(0);
      const updatedLastDigits = [newDigit, ...lastDigits].slice(0, parseInt(ticks));
      
      // Contar ocorrências
      updatedLastDigits.forEach(d => {
        if (d >= 0 && d <= 9) counts[d]++;
      });
      
      // Cálculo de percentuais
      const total = updatedLastDigits.length;
      
      // Criar um novo array para garantir que o React reconheça a mudança
      const newStats = Array(10).fill(0).map((_, i) => ({
        digit: i,
        count: counts[i],
        percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
      }));
      
      console.log("[BOT_PAGE] Novas estatísticas calculadas:", 
        newStats.map(s => `${s.digit}: ${s.percentage}%`).join(", "));
      
      return newStats;
    });
  };
  
  // Iniciar o bot usando o serviço OAuth Direct
  const handleStartBot = () => {
    try {
      // Verificar se uma conta foi selecionada
      if (!selectedAccount) {
        toast({
          title: "Conta não selecionada",
          description: "Por favor, selecione uma conta para operar com o robô.",
          variant: "destructive"
        });
        return;
      }
      
      if (!selectedBotType || !selectedStrategy) {
        toast({
          title: "Seleção necessária",
          description: "Por favor, selecione um tipo de bot e uma estratégia.",
          variant: "destructive"
        });
        return;
      }
      
      // Verificar se há erros críticos relacionados ao token
      const tokenErrorStr = localStorage.getItem('deriv_token_scope_error');
      if (tokenErrorStr) {
        try {
          const tokenError = JSON.parse(tokenErrorStr);
          const errorTimestamp = tokenError.timestamp || 0;
          
          // Se o erro for recente (menos de 1 hora)
          if (Date.now() - errorTimestamp < 60 * 60 * 1000) {
            // Mostrar erro grave, impedir início do bot
            toast({
              title: "⚠️ Permissões insuficientes",
              description: "O token atual não possui permissões necessárias para operações de trading.",
              variant: "destructive",
              duration: 8000,
            });
            
            // Mostrar instruções para resolver o problema
            setTimeout(() => {
              toast({
                title: "Como resolver",
                description: "É necessário reautorizar a aplicação com os escopos corretos.",
                variant: "default",
                action: (
                  <Button 
                    onClick={() => {
                      const appId = '71403';
                      const redirectUri = encodeURIComponent(window.location.origin + '/auth-callback');
                      const scope = encodeURIComponent('read admin payments trade trading trading_information');
                      const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;
                      
                      // Registrar que uma reautorização foi solicitada
                      localStorage.setItem('deriv_pending_reauth', 'true');
                      localStorage.setItem('deriv_pending_reauth_timestamp', Date.now().toString());
                      
                      // Abrir página de autorização
                      window.open(authUrl, '_blank', 'width=800,height=600');
                    }}
                    variant="default"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
                  >
                    Reautorizar
                  </Button>
                ),
                duration: 15000,
              });
            }, 1000);
            
            // Impedir início do bot
            return;
          } else {
            // Limpar erros antigos
            localStorage.removeItem('deriv_token_scope_error');
          }
        } catch (e) {
          console.error('[BOT_PAGE] Erro ao processar informações de erro do token:', e);
          localStorage.removeItem('deriv_token_scope_error');
        }
      }
      
      // Verificação de reautorização pendente removida por solicitação do usuário
      // Se houver uma autorização pendente antiga, podemos limpá-la silenciosamente
      if (localStorage.getItem('deriv_pending_reauth') === 'true') {
        const pendingTimestamp = Number(localStorage.getItem('deriv_pending_reauth_timestamp') || '0');
        if (Date.now() - pendingTimestamp > 30 * 60 * 1000) {
          localStorage.removeItem('deriv_pending_reauth');
          localStorage.removeItem('deriv_pending_reauth_timestamp');
        }
      }
      
      // Configurar parâmetros
      const entryNum = parseFloat(entryValue || "0.35");
      const profitNum = parseFloat(profitTarget || "1000");
      const lossNum = parseFloat(lossLimit || "500");
      
      // Determinar o tipo de contrato com base na estratégia
      const contractType = selectedBotType === "lite" ? 
                        (selectedStrategy.includes('under') ? 'DIGITUNDER' : 'DIGITOVER') : 
                        selectedStrategy.includes('under') ? 'DIGITUNDER' : 'DIGITOVER';
      
      console.log("[BOT] Iniciando operação do robô com OAuth Direct e estratégia:", selectedStrategy);
      console.log("[BOT] Usando conta:", selectedAccount.loginid, selectedAccount.isVirtual ? "(Demo)" : "(Real)");
      
      // Atualizar a interface PRIMEIRO para feedback visual imediato
      setBotStatus('running');
      setOperation({
        entry: 1584.42,
        buyPrice: entryNum,
        profit: 0,
        status: null
      });
      
      // Garantir que a conta selecionada está ativa no serviço OAuth
      oauthDirectService.setActiveAccount(selectedAccount.loginid, selectedAccount.token);
      
      // Forçar reconexão para garantir que estamos usando a conta correta
      try {
        // Se o método reconnect existir e for uma função, chamá-lo
        if (typeof oauthDirectService.reconnect === 'function') {
          oauthDirectService.reconnect().catch(error => {
            console.error('[BOT] Erro ao reconectar:', error);
          });
        }
      } catch (error) {
        console.error('[BOT] Erro ao tentar reconectar:', error);
      }
      
      // Configurar oauthDirectService (novo serviço com conexão WebSocket dedicada)
      oauthDirectService.setSettings({
        entryValue: entryNum,
        profitTarget: profitNum,
        lossLimit: lossNum,
        martingaleFactor: 1.5, // Valor padrão
        contractType: contractType as any,
        prediction: 5 // Valor padrão para previsão
      });
      
      // Definir estratégia
      oauthDirectService.setActiveStrategy(selectedStrategy);
      
      // Iniciar o serviço OAuth Direct
      oauthDirectService.start().then(success => {
        if (!success) {
          console.error("[BOT] oauthDirectService.start() retornou false, mas a interface já foi atualizada");
          
          // Reverter status se não conseguiu iniciar
          setBotStatus('idle');
          toast({
            title: "Erro ao iniciar",
            description: "Não foi possível conectar ao servidor da Deriv. Tente novamente.",
            variant: "destructive"
          });
        }
      }).catch(error => {
        console.error("[BOT] Erro ao executar oauthDirectService.start():", error);
        
        // Reverter status
        setBotStatus('idle');
        toast({
          title: "Erro ao iniciar",
          description: "Ocorreu um erro ao conectar com o servidor.",
          variant: "destructive"
        });
      });
      
      const strategyInfo = strategies[selectedBotType].find(s => s.id === selectedStrategy);
      
      toast({
        title: "Iniciando robô",
        description: `Conectando ${strategyInfo?.name} na conta ${selectedAccount.loginid} (${selectedAccount.isVirtual ? 'Demo' : 'Real'})...`,
      });
      
    } catch (error) {
      console.error("[BOT] Erro ao iniciar bot:", error);
      setBotStatus('idle');
      toast({
        title: "Erro ao iniciar",
        description: "Ocorreu um erro ao iniciar o robô.",
        variant: "destructive"
      });
    }
  };
  
  // Pausar o bot
  const handlePauseBot = async () => {
    try {
      console.log("[BOT] Chamando oauthDirectService.stop() na interface");
      
      // Definir o estado localmente primeiro para feedback imediato
      setBotStatus('paused');
      
      // Depois chama o serviço
      oauthDirectService.stop();
      
      toast({
        title: "Bot pausado",
        description: "As operações foram pausadas.",
      });
    } catch (error) {
      console.error("[BOT] Erro ao pausar o serviço OAuth:", error);
      toast({
        title: "Erro ao pausar",
        description: "Não foi possível pausar o robô corretamente.",
        variant: "destructive"
      });
    }
  };
  
  // Limpar histórico
  const handleClearHistory = () => {
    setStats({ wins: 0, losses: 0 });
    setOperation({
      entry: 1584.42,
      buyPrice: parseFloat(entryValue),
      profit: 0,
      status: null
    });
    
    toast({
      title: "Histórico limpo",
      description: "O histórico de operações foi limpo.",
    });
  };
  
  // Função para obter a cor da barra com base na porcentagem
  const getBarColor = (percentage: number) => {
    return percentage >= 20 ? 'bg-red-500' : 'bg-gray-500';
  };
  
  // Estado para histórico de operações
  const [operationHistory, setOperationHistory] = useState<{
    id: number;
    type: string;
    result: 'win' | 'loss';
    amount: number;
    profit: number;
    time: Date;
  }[]>([]);
  
  // Use o useEffect para registrar ouvintes de eventos de operação
  useEffect(() => {
    const handleOperation = (event: any) => {
      if (event.type === 'operation_finished') {
        // Adicionar operação ao histórico
        const newOperation = {
          id: typeof event.contract.contract_id === 'number' ? event.contract.contract_id : Math.random(),
          type: event.contract.contract_type,
          result: event.result,
          amount: event.contract.buy_price,
          profit: event.profit,
          time: new Date()
        };
        
        setOperationHistory(prev => [newOperation, ...prev].slice(0, 50));
      }
    };
    
    // Registrar ouvinte de eventos
    oauthDirectService.addEventListener(handleOperation);
    
    // Limpar ouvinte ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleOperation);
    };
  }, []);

  const renderActionButton = () => {
    // Usar o novo BotController para melhor feedback visual e controle
    return (
      <BotController
        entryValue={parseFloat(entryValue) || 0.35}
        profitTarget={parseFloat(profitTarget) || 1000}
        lossLimit={parseFloat(lossLimit) || 500}
        selectedStrategy={selectedStrategy}
        onStatusChange={(status) => {
          console.log('[BOT_PAGE] Status do bot atualizado:', status);
          setBotStatus(status);
        }}
        onStatsChange={(newStats) => {
          console.log('[BOT_PAGE] Estatísticas atualizadas:', newStats);
          setStats({
            wins: newStats.wins,
            losses: newStats.losses
          });
        }}
      />
    );
  };

  // A função handleAccountSelected foi removida pois agora usamos
  // automaticamente a conta selecionada na dashboard

  return (
    <div className="flex min-h-screen bg-[#0a1324]">
      {/* Barra Lateral */}
      <div className="w-16 group hover:w-56 transition-all duration-300 ease-in-out bg-[#13203a] flex flex-col items-center py-6 overflow-hidden">
        <div className="flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="12" fill="#4F46E5" />
            <path d="M16.5 8.25H13.5L12 6.75L10.5 8.25H7.5L6 9.75V12.75L7.5 14.25V17.25L9 18.75H15L16.5 17.25V14.25L18 12.75V9.75L16.5 8.25Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 12.75C12.8284 12.75 13.5 12.0784 13.5 11.25C13.5 10.4216 12.8284 9.75 12 9.75C11.1716 9.75 10.5 10.4216 10.5 11.25C10.5 12.0784 11.1716 12.75 12 12.75Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 12.75V15.75" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="ml-3 font-bold text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">Genius Trading</span>
        </div>
        
        {/* Links de navegação */}
        <div className="w-full">
          <button 
            onClick={() => {
              // Se o robô estiver rodando, confirmar antes de sair
              if (botStatus === 'running') {
                const confirmExit = window.confirm("O robô está em execução. Deseja realmente voltar para o dashboard? Isso irá parar todas as operações.");
                if (confirmExit) {
                  oauthDirectService.stop();
                  // Redirecionar para o dashboard após a parada
                  window.location.href = '/dashboard';
                }
              } else {
                // Se não estiver rodando, sair direto para o dashboard
                window.location.href = '/dashboard';
              }
            }}
            className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105 mb-2">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Dashboard</span>
          </button>
          
          <button className="w-full flex items-center px-3 py-2 text-white bg-indigo-600 rounded-md transition-all duration-200 hover:scale-105 mb-2">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Automações</span>
          </button>
          
          <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Perfil</span>
          </button>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <div className="flex-1 p-6">
        {/* Header - Informações da conta */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Robô de Automações</h1>
          
          <div className="flex items-center">
            {accountInfo && (
              <div className="flex items-center mr-4 bg-[#13203a] rounded-md px-3 py-2 border border-[#2a3756]">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${accountInfo.isVirtual ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                  <div className="text-sm text-white mr-3">
                    {accountInfo.loginid}
                  </div>
                </div>
                <div className="mx-2 h-4 border-r border-[#3a4b6b]"></div>
                <div className="flex items-center">
                  <div className="text-xs text-gray-400 mr-1">Tipo:</div>
                  <div className="text-sm text-white mr-3">
                    {accountInfo.isVirtual ? 'Demo' : 'Real'}
                  </div>
                </div>
                <div className="mx-2 h-4 border-r border-[#3a4b6b]"></div>
                <div className="flex items-center">
                  <div className="text-xs text-gray-400 mr-1">Saldo:</div>
                  <div className="text-sm text-white">
                    <span className={`${realTimeBalance.balance > realTimeBalance.previousBalance ? 'text-green-500' : realTimeBalance.balance < realTimeBalance.previousBalance ? 'text-red-500' : 'text-white'}`}>
                      {typeof accountInfo.balance === 'number' 
                        ? accountInfo.balance.toFixed(2) 
                        : parseFloat(String(accountInfo.balance)).toFixed(2)} {accountInfo.currency}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <img
              src="https://randomuser.me/api/portraits/men/44.jpg"
              alt="Profile"
              className="w-9 h-9 rounded-full border-2 border-indigo-600"
            />
          </div>
        </div>
        
        {/* Grid Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna da esquerda - Controles e Configurações */}
          <div className="lg:col-span-1 space-y-5">
            {/* Informações da Conta */}
            <div className="bg-[#13203a] rounded-lg p-5 border border-[#2a3756]">
              <h2 className="text-lg font-semibold text-white mb-4">Conta para Operação</h2>
              {selectedAccount ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Conta:</span>
                    <span className="font-medium text-white">{selectedAccount.loginid}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="font-medium text-white">{selectedAccount.isVirtual ? 'Demo' : 'Real'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Moeda:</span>
                    <span className="font-medium text-white">{selectedAccount.currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Saldo:</span>
                    <span className="font-medium text-white">{realTimeBalance.balance.toFixed(2)} {selectedAccount.currency}</span>
                  </div>
                  <div className="text-xs mt-3 text-gray-400">
                    <p>Operando com a conta selecionada na Dashboard.</p>
                    <p>Para trocar, volte ao Dashboard e selecione outra conta.</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 flex items-center justify-center">
                  {/* Substitui o aviso por um indicador de carregamento */}
                  <svg className="animate-spin h-5 w-5 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-blue-400">Conectando à conta...</span>
                </div>
              )}
            </div>
            
            {/* Alerta de permissões do token */}
            <TokenPermissionAlert 
              onReauthorize={() => {
                const appId = '71403';
                const redirectUri = encodeURIComponent(window.location.origin + '/auth-callback');
                const scope = encodeURIComponent('read admin payments trade trading trading_information');
                const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;
                window.open(authUrl, '_blank', 'width=800,height=600');
                
                // Registrar reautorização pendente
                localStorage.setItem('deriv_pending_reauth', 'true');
                localStorage.setItem('deriv_pending_reauth_timestamp', Date.now().toString());
                
                toast({
                  title: "Autorização iniciada",
                  description: "Complete a autorização na janela aberta para obter todas as permissões necessárias.",
                });
              }}
            />
            
            {/* Painel de Controle Principal */}
            <div className="bg-[#13203a] rounded-lg p-5 border border-[#2a3756]">
              <h2 className="text-lg font-semibold text-white mb-4">Painel de Controle</h2>
              
              {/* Status da Operação */}
              <OperationStatus 
                status={botStatus}
                operation={operation}
                stats={stats}
                balanceInfo={{
                  balance: realTimeBalance.balance || 0,
                  currency: accountInfo?.currency || 'USD',
                  previousBalance: realTimeBalance.previousBalance,
                  change: realTimeBalance.balance - realTimeBalance.previousBalance
                }}
              />
              
              {/* Controles do Bot */}
              <div className="mt-5">
                <h3 className="text-white text-md font-medium mb-3">Configurações</h3>
                
                {/* Tipo de Bot */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-400 mb-1">Tipo de Bot</label>
                  <Select
                    value={selectedBotType}
                    onValueChange={(value: "lite" | "premium" | "") => {
                      setSelectedBotType(value);
                      setSelectedStrategy("");
                    }}
                  >
                    <SelectTrigger className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white">
                      <SelectValue placeholder="Selecionar tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13203a] border-[#2c3e5d] text-white">
                      <SelectItem value="lite">Bot Lite (Básico)</SelectItem>
                      <SelectItem value="premium">Bot Premium (VIP)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Estratégia */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-400 mb-1">Estratégia</label>
                  <Select
                    value={selectedStrategy}
                    onValueChange={setSelectedStrategy}
                    disabled={!selectedBotType}
                  >
                    <SelectTrigger className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white">
                      <SelectValue placeholder="Selecionar estratégia" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13203a] border-[#2c3e5d] text-white">
                      {selectedBotType && 
                        strategies[selectedBotType].map((strategy) => (
                          <SelectItem key={strategy.id} value={strategy.id}>
                            {strategy.name}
                          </SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Valor de Entrada */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-400 mb-1">Valor de Entrada ($)</label>
                  <Input
                    type="text"
                    value={entryValue}
                    onChange={(e) => setEntryValue(e.target.value)}
                    className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white"
                    placeholder="0.35"
                  />
                </div>
                
                {/* Meta de Lucro */}
                <div className="mb-3">
                  <label className="block text-sm text-gray-400 mb-1">Meta de Lucro ($)</label>
                  <Input
                    type="text"
                    value={profitTarget}
                    onChange={(e) => setProfitTarget(e.target.value)}
                    className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white"
                    placeholder="1000"
                  />
                </div>
                
                {/* Limite de Perda */}
                <div className="mb-5">
                  <label className="block text-sm text-gray-400 mb-1">Limite de Perda ($)</label>
                  <Input
                    type="text"
                    value={lossLimit}
                    onChange={(e) => setLossLimit(e.target.value)}
                    className="w-full bg-[#0e1a2e] border-[#2c3e5d] text-white"
                    placeholder="500"
                  />
                </div>
                
                {/* Painel de informações da conta e controle do bot */}
                <div className="mb-4">
                  <BotController 
                    entryValue={parseFloat(entryValue) || 0.35}
                    profitTarget={parseFloat(profitTarget) || 1000}
                    lossLimit={parseFloat(lossLimit) || 500}
                    selectedStrategy={selectedStrategy || ''}
                    onStatusChange={(status) => setBotStatus(status)}
                    onStatsChange={(newStats) => setStats(newStats)}
                    onTickReceived={(price, lastDigit) => {
                      // Atualizar últimos dígitos
                      setLastDigits(prev => {
                        const updated = [lastDigit, ...prev].slice(0, 20);
                        return updated;
                      });
                      
                      // Atualizar estatísticas
                      updateDigitStats(lastDigit);
                    }}
                  />
                </div>
                
                {/* Botões de Ação (backup) */}
                <div className="space-y-3">
                  <button
                    onClick={handleStartBot}
                    disabled={botStatus === 'running'}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all 
                      ${botStatus === 'running' 
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : 'bg-green-600 hover:bg-green-700 active:scale-95'}
                    `}
                  >
                    {botStatus === 'running' ? 'Executando...' : 'Iniciar Bot'}
                  </button>
                  
                  <button
                    onClick={handlePauseBot}
                    disabled={botStatus !== 'running'}
                    className={`w-full py-2 px-4 rounded-md text-white font-medium transition-all 
                      ${botStatus !== 'running' 
                        ? 'bg-gray-600 cursor-not-allowed' 
                        : 'bg-yellow-600 hover:bg-yellow-700 active:scale-95'}
                    `}
                  >
                    Pausar Bot
                  </button>
                  
                  <button
                    onClick={handleClearHistory}
                    className="w-full py-2 px-4 rounded-md text-white font-medium bg-gray-600 hover:bg-gray-700 transition-all active:scale-95"
                  >
                    Limpar Histórico
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Colunas do meio e direita - Visualização de dados e estatísticas */}
          <div className="lg:col-span-2 space-y-5">
            {/* Painel de Visualização Principal */}
            <div className="bg-[#13203a] rounded-lg p-5 border border-[#2a3756]">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-semibold text-white">Movimentação do Mercado</h2>
                
                <div className="flex space-x-2">
                  <Select
                    value={ticks}
                    onValueChange={setTicks}
                  >
                    <SelectTrigger className="h-8 w-[100px] bg-[#0e1a2e] border-[#2c3e5d] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13203a] border-[#2c3e5d] text-white">
                      <SelectItem value="10">10 ticks</SelectItem>
                      <SelectItem value="20">20 ticks</SelectItem>
                      <SelectItem value="50">50 ticks</SelectItem>
                      <SelectItem value="100">100 ticks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Visualização Estatística de Dígitos */}
              <div className="mb-4">
                <div className="grid grid-cols-10 gap-1 mt-2">
                  {digitStats.map(stat => (
                    <div key={stat.digit} className="flex flex-col items-center">
                      <div className="font-bold text-white mb-1">{stat.digit}</div>
                      <div className="w-full bg-[#0e1a2e] rounded-sm h-24 relative">
                        <div 
                          className={`absolute bottom-0 left-0 right-0 ${getBarColor(stat.percentage)}`}
                          style={{ height: `${stat.percentage}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{stat.percentage}%</div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Visualização simplificada de Dígitos - mantido apenas SimpleDigitDisplay */}
              <div>
                <h3 className="text-white text-md font-medium mb-2">Últimos Dígitos</h3>
                <SimpleDigitDisplay digits={lastDigits} />
              </div>
            </div>
            
            {/* Histórico de Operações */}
            <div className="bg-[#13203a] rounded-lg p-5 border border-[#2a3756]">
              <h2 className="text-lg font-semibold text-white mb-3">Histórico de Operações</h2>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-white">
                  <thead>
                    <tr className="border-b border-[#2a3756] text-gray-400">
                      <th className="text-left py-2 px-2">ID</th>
                      <th className="text-left py-2 px-2">Tipo</th>
                      <th className="text-left py-2 px-2">Resultado</th>
                      <th className="text-right py-2 px-2">Valor</th>
                      <th className="text-right py-2 px-2">Lucro/Perda</th>
                      <th className="text-right py-2 px-2">Horário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operationHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-4 text-gray-500">
                          Nenhuma operação realizada
                        </td>
                      </tr>
                    ) : (
                      operationHistory.map((op) => (
                        <tr key={op.id} className="border-b border-[#1d2a45]">
                          <td className="py-2 px-2">{op.id.toString().substring(0, 8)}</td>
                          <td className="py-2 px-2">{op.type}</td>
                          <td className="py-2 px-2">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                              op.result === 'win' ? 'bg-green-900 text-green-500' : 'bg-red-900 text-red-500'
                            }`}>
                              {op.result === 'win' ? 'Ganho' : 'Perda'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right">${op.amount.toFixed(2)}</td>
                          <td className={`py-2 px-2 text-right ${
                            op.profit >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {op.profit >= 0 ? '+' : ''}{op.profit.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-right text-gray-400">
                            {op.time.toLocaleTimeString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}