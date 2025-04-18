import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { DerivConnectButton } from "@/components/DerivConnectButton";
import { AccountSelector } from "@/components/AccountSelector";
import { AccountInfo } from "@/components/AccountInfo";
import balanceService, { BalanceResponse } from "@/lib/balanceService";
import { RefreshCw, AlertCircle, Users, ChevronDown, Bot } from "lucide-react";
// Importar o novo componente isolado para o dashboard
import { DashboardR100Display } from "@/dashboard_exclusive/R100Display";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/dashboard/Sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DigitData {
  digit: number;
  count: number;
  percentage: number;
}

export default function Dashboard() {
  const [digitStats, setDigitStats] = useState<DigitData[]>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [ticks, setTicks] = useState<number>(10);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState<boolean>(false);
  const [showAccountOptions, setShowAccountOptions] = useState<boolean>(false);
  const [accountToSwitch, setAccountToSwitch] = useState<any>(null);
  const [confirmAccountSwitch, setConfirmAccountSwitch] = useState<boolean>(false);
  const { toast } = useToast();
  
  // Referência para o callback de atualização de saldo
  const balanceUpdateRef = useRef<((balanceData: any) => void) | null>(null);
  
  // Efeito para gerenciar a assinatura de saldo
  useEffect(() => {
    // Função para atualizar o saldo no estado
    const handleBalanceUpdate = (balanceData: any) => {
      console.log('[Balance] Saldo atualizado:', balanceData);
      setAccountInfo((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          balance: balanceData.balance,
          currency: balanceData.currency
        };
      });
    };
    
    // Armazenar a referência da função para poder removê-la posteriormente
    balanceUpdateRef.current = handleBalanceUpdate;
    
    // Adicionar o listener apenas uma vez
    balanceService.addBalanceListener(handleBalanceUpdate);
    
    // Limpeza ao desmontar o componente
    return () => {
      if (balanceUpdateRef.current) {
        balanceService.removeBalanceListener(balanceUpdateRef.current);
        balanceUpdateRef.current = null;
      }
      balanceService.unsubscribeBalance();
    };
  }, []); // Sem dependências para evitar recriação
  
  // Função para iniciar a assinatura de saldo para uma conta específica
  const startBalanceSubscription = useCallback(async (loginId: string) => {
    try {
      setIsLoadingBalance(true);
      const storedAccounts = localStorage.getItem('deriv_accounts');
      if (!storedAccounts) return;
      
      const accounts = JSON.parse(storedAccounts);
      const account = accounts.find((acc: any) => acc.loginid === loginId);
      
      if (account && account.token) {
        console.log(`[Balance] Iniciando assinatura de saldo para ${loginId}`);
        
        // Iniciar a assinatura (que por padrão agora é true)
        // O callback já está registrado no efeito acima
        await balanceService.getBalance(account.token);
      }
    } catch (error) {
      console.error('Erro ao iniciar assinatura de saldo:', error);
      toast({
        title: "Erro ao conectar ao serviço de saldo",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setIsLoadingBalance(false);
    }
  }, [toast]);
  
  // Efeito para verificar se já existe uma sessão autenticada e carregar a conta ativa atual
  useEffect(() => {
    // Função para carregar a conta ativa atual
    const loadActiveAccount = () => {
      try {
        console.log('[DASHBOARD] Obtendo informações atualizadas da conta ativa...');
        
        // 1. Verificar se temos um token OAuth primeiro (autenticação principal)
        const storedOAuthToken = localStorage.getItem('deriv_oauth_token');
        
        if (storedOAuthToken) {
          console.log('[DASHBOARD] Token OAuth encontrado:', storedOAuthToken.substring(0, 10) + '...');
          setIsAuthenticated(true);
          
          // 2. Obter o ID da conta ativa do localStorage (definido durante a troca de conta)
          const activeLoginId = localStorage.getItem('deriv_active_loginid');
          console.log('[DASHBOARD] ID da conta ativa no localStorage:', activeLoginId);
          
          if (activeLoginId) {
            // 3. Obter as contas disponíveis
            const storedAccounts = localStorage.getItem('deriv_accounts');
            
            if (storedAccounts) {
              const accounts = JSON.parse(storedAccounts);
              console.log('[DASHBOARD] Contas disponíveis:', accounts.map((acc: any) => acc.loginid));
              
              // Procurar a conta ativa pelo ID
              const activeAccount = accounts.find((acc: any) => acc.loginid === activeLoginId);
              
              if (activeAccount) {
                console.log(`[DASHBOARD] Conta ativa encontrada: ${activeAccount.loginid} (${activeAccount.currency})`);
                
                // IMPORTANTE: Atualizar as informações da conta no estado
                setAccountInfo({
                  ...activeAccount,
                  // Garantir que os campos obrigatórios estejam presentes
                  isVirtual: activeAccount.is_virtual || activeAccount.isVirtual,
                  balance: activeAccount.balance || 0
                });
                
                // Iniciar a assinatura de saldo para a conta ativa
                startBalanceSubscription(activeLoginId);
                return; // Saímos depois de lidar com sucesso
              } else {
                console.warn(`[DASHBOARD] Conta ativa ${activeLoginId} não encontrada nas contas armazenadas`);
              }
            }
          }
          
          // 4. Fallback: Tentar usar informações de conta armazenadas diretamente
          const storedAccountInfo = localStorage.getItem('deriv_account_info');
          if (storedAccountInfo) {
            try {
              const parsedAccountInfo = JSON.parse(storedAccountInfo);
              console.log('[DASHBOARD] Usando dados da conta armazenados diretamente');
              setAccountInfo(parsedAccountInfo);
              
              // Iniciar a assinatura de saldo
              if (parsedAccountInfo && parsedAccountInfo.loginid) {
                startBalanceSubscription(parsedAccountInfo.loginid);
              }
            } catch (error) {
              console.error('[DASHBOARD] Erro ao processar dados de conta armazenados:', error);
            }
          }
        } else {
          console.log('[DASHBOARD] Alerta: Token OAuth não encontrado. Operações de trading não funcionarão.');
          
          // Verificar token tradicional como fallback
          const storedToken = localStorage.getItem('deriv_token');
          const storedAccountInfo = localStorage.getItem('deriv_account_info');
          
          if (storedToken && storedAccountInfo) {
            try {
              const parsedAccountInfo = JSON.parse(storedAccountInfo);
              setIsAuthenticated(true);
              setAccountInfo(parsedAccountInfo);
              
              // Iniciar a assinatura de saldo em tempo real
              if (parsedAccountInfo && parsedAccountInfo.loginid) {
                startBalanceSubscription(parsedAccountInfo.loginid);
              }
            } catch (error) {
              console.error('[DASHBOARD] Erro ao processar dados de conta armazenados:', error);
            }
          }
        }
      } catch (error) {
        console.error('[DASHBOARD] Erro ao carregar informações da conta:', error);
      }
    };
    
    // Carregar a conta ativa
    loadActiveAccount();
    
    // Adicionar detector de evento para mudanças forçadas de conta
    const handleForceUpdate = () => {
      console.log('[DASHBOARD] Evento de atualização forçada detectado');
      loadActiveAccount();
    };
    
    // Registrar listener para eventos de atualização forçada
    window.addEventListener('storage', (event) => {
      if (event.key === 'deriv_active_loginid' || event.key === 'account_switch_timestamp') {
        handleForceUpdate();
      }
    });
    
    return () => {
      window.removeEventListener('storage', handleForceUpdate);
    };
  }, [startBalanceSubscription]); // Depende da função de assinatura

  // Função para processar novos dígitos do R_100
  const handleNewDigit = (digit: number) => {
    setLastDigits((prev) => {
      // Manter apenas os últimos 'ticks' dígitos
      const newDigits = [...prev, digit];
      if (newDigits.length > ticks) {
        return newDigits.slice(-ticks);
      }
      return newDigits;
    });
  };

  // Função para obter a cor da barra com base no percentual
  const getBarColor = (percentage: number) => {
    if (percentage >= 30) return 'bg-red-600';
    if (percentage >= 20) return 'bg-red-500';
    if (percentage >= 10) return 'bg-red-500';
    return 'bg-gray-500';
  };
  
  // Prepara uma conta para troca
  const prepareAccountSwitch = (acc: any) => {
    if (accountInfo && acc.loginid === accountInfo.loginid) {
      setShowAccountOptions(false);
      return;
    }
    
    setAccountToSwitch(acc);
    setConfirmAccountSwitch(true);
  };
  
  // Função que realiza a troca de conta após confirmação
  const switchAccount = async (account: any) => {
    try {
      setConfirmAccountSwitch(false);
      toast({
        title: "Trocando de conta",
        description: `Preparando troca para ${account.loginid}...`,
      });
      
      // Obter token para a conta selecionada
      let token: string | null = null;
      
      // Buscar token nas contas armazenadas
      const accountsStr = localStorage.getItem('deriv_accounts');
      if (accountsStr) {
        try {
          const accounts = JSON.parse(accountsStr);
          const matchingAccount = accounts.find((acc: any) => acc.loginid === account.loginid);
          
          if (matchingAccount && matchingAccount.token) {
            token = matchingAccount.token;
          }
        } catch (error) {
          console.error('Erro ao processar contas:', error);
        }
      }
      
      if (!token) {
        toast({
          title: "Erro ao trocar de conta",
          description: `Token não encontrado para ${account.loginid}. Faça login novamente.`,
          variant: "destructive"
        });
        return;
      }
      
      // Salvar informações da nova conta no localStorage
      localStorage.setItem('deriv_active_loginid', account.loginid);
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('deriv_oauth_token', token);
      localStorage.setItem('account_switch_timestamp', Date.now().toString());
      localStorage.setItem('force_reconnect', 'true');
      
      // Criar objeto com informações da conta ativa
      const activeAccountData = {
        loginid: account.loginid,
        token: token,
        is_virtual: account.isVirtual,
        currency: account.currency,
        timestamp: Date.now(),
        active: true
      };
      
      // Salvar como conta ativa
      localStorage.setItem('deriv_active_account', JSON.stringify(activeAccountData));
      
      // Mostrar tela de carregamento ao trocar conta
      const loadingElement = document.createElement('div');
      loadingElement.style.position = 'fixed';
      loadingElement.style.top = '0';
      loadingElement.style.left = '0';
      loadingElement.style.width = '100%';
      loadingElement.style.height = '100%';
      loadingElement.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      loadingElement.style.zIndex = '9999';
      loadingElement.style.display = 'flex';
      loadingElement.style.alignItems = 'center';
      loadingElement.style.justifyContent = 'center';
      loadingElement.style.flexDirection = 'column';
      loadingElement.style.color = 'white';
      loadingElement.style.fontSize = '18px';
      loadingElement.innerHTML = `
        <div style="margin-bottom: 20px;">TROCANDO PARA CONTA ${account.loginid}</div>
        <div style="margin-bottom: 30px;">A página será recarregada em instantes...</div>
        <div style="width: 50px; height: 50px; border: 4px solid #1E3A8A; border-top: 4px solid #00E5B3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
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
      
      // Redirecionar com recarregamento forçado depois de um pequeno delay
      setTimeout(() => {
        // Usar replace para garantir que caches e histórico sejam limpos
        window.location.replace(`/dashboard?account=${account.loginid}&t=${Date.now()}`);
        
        // Backup: se o replace não funcionar, usar reload
        setTimeout(() => window.location.reload(), 200);
      }, 800);
      
    } catch (error) {
      console.error('Erro ao trocar de conta:', error);
      toast({
        title: "Erro ao trocar de conta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex h-screen bg-[#0c1525]">
      {/* Sidebar/Menu lateral */}
      <Sidebar className="hidden md:flex" />
      <Sidebar isMobile={true} className="md:hidden" />
      
      {/* Conteúdo principal */}
      <div className="flex-1 md:ml-16 transition-all duration-300">
        {/* Barra superior com seletor de contas e links */}
        <div className="w-full bg-[#13203a] flex justify-between items-center p-2 px-4 space-x-4">
          {/* Seletor de contas - Lado esquerdo */}
          {isAuthenticated && accountInfo && (
            <div className="relative">
              <button
                onClick={() => setShowAccountOptions(!showAccountOptions)}
                className="bg-[#1d2a45] hover:bg-[#2a3756] text-white px-3 py-1 rounded-md text-sm flex items-center"
              >
                <div className={`h-2 w-2 rounded-full mr-2 ${accountInfo.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'}`}></div>
                <span className="mr-1">{accountInfo.loginid}</span>
                <ChevronDown className="h-4 w-4" />
              </button>
              
              {/* Menu dropdown para contas */}
              {showAccountOptions && (
                <div className="absolute left-0 mt-1 w-60 bg-[#1d2a45] rounded-md shadow-lg z-50 border border-[#2a3756] overflow-hidden">
                  <div className="p-2 border-b border-[#2a3756]">
                    <h3 className="text-sm text-gray-300">Selecionar Conta</h3>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {(() => {
                      // Obter contas do localStorage
                      const accountsStr = localStorage.getItem('deriv_accounts');
                      const accounts = accountsStr ? JSON.parse(accountsStr) : [];
                      return accounts.map((account: any) => (
                      <button
                        key={account.loginid}
                        onClick={() => {
                          // Se for a mesma conta, apenas fechar o menu
                          if (account.loginid === accountInfo.loginid) {
                            setShowAccountOptions(false);
                            return;
                          }
                          // Confirmar troca para outra conta
                          setAccountToSwitch(account);
                          setConfirmAccountSwitch(true);
                          setShowAccountOptions(false);
                        }}
                        className={`flex items-center justify-between w-full p-2 text-sm hover:bg-[#2a3756] ${
                          account.loginid === accountInfo.loginid ? 'bg-[#2a3756]' : ''
                        }`}
                      >
                        <div className="flex items-center">
                          <div className={`h-2 w-2 rounded-full mr-2 ${account.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'}`}></div>
                          <span className="text-white">{account.loginid}</span>
                        </div>
                        <span className={`${account.isVirtual ? 'text-blue-400' : 'text-[#00e5b3]'}`}>
                          {account.balance?.toFixed(2)} {account.currency}
                        </span>
                      </button>
                    ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Lado direito com os botões/links */}
          <div className="flex items-center space-x-4">
            {/* Botão Robô de Operações - Só aparece quando o usuário está conectado */}
            {isAuthenticated && accountInfo && (
              <a href="/bot" className="text-white hover:text-[#00e5b3] text-sm font-medium flex items-center">
                <Bot className="h-4 w-4 mr-1" />
                Robô de Operações
              </a>
            )}
            
            {/* Logout DERIV - Também só aparece quando o usuário está conectado */}
            {isAuthenticated && accountInfo ? (
              <a href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  // Remover tokens e dados da conta
                  localStorage.removeItem('deriv_token');
                  localStorage.removeItem('deriv_oauth_token');
                  localStorage.removeItem('deriv_account_info');
                  localStorage.removeItem('deriv_active_loginid');
                  
                  // Aviso de sucesso
                  toast({
                    title: "Desconectado com sucesso",
                    description: "Você foi desconectado da Deriv",
                  });
                  
                  // Atualizar estado
                  setIsAuthenticated(false);
                  setAccountInfo(null);
                  
                  // Recarregar a página após pequeno delay
                  setTimeout(() => window.location.reload(), 500);
                }}
                className="text-white hover:text-[#00e5b3] text-sm">
                Logout DERIV
              </a>
            ) : (
              // Link Login quando não estiver autenticado
              <a href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  const button = document.querySelector('[class*="DerivConnectButton"]') as HTMLElement;
                  if (button) button.click();
                }}
                className="text-white hover:text-[#00e5b3] text-sm">
                Login DERIV
              </a>
            )}
          </div>
        </div>
        
        <main className="p-4">
          {/* Cabeçalho com informações da conta e botão de login */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 bg-[#162746] rounded-lg p-4 border border-[#1c3654]">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full">
              <h1 className="text-2xl font-bold text-white">Dashboard</h1>
              
              <div className="flex-1"></div>
              
              {/* Informações da conta */}
              {isAuthenticated && accountInfo ? (
                <div className="flex flex-wrap items-center gap-2 md:gap-4">
                  {/* Informações básicas da conta */}
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${accountInfo.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'}`}></div>
                    <span className="text-white font-medium">{accountInfo.loginid}</span>
                  </div>
                  
                  {/* Saldo com indicador de carregamento */}
                  <div className="flex items-center bg-[#1d2a45] px-3 py-1 rounded-md">
                    {isLoadingBalance ? (
                      <RefreshCw className="h-4 w-4 text-white animate-spin mr-1" />
                    ) : (
                      <span className={`font-bold ${accountInfo.isVirtual ? 'text-blue-400' : 'text-[#00e5b3]'}`}>
                        {accountInfo.balance?.toFixed(2)} {accountInfo.currency}
                      </span>
                    )}
                  </div>
                  
                  {/* Seletor de conta (botão que abre opções) */}
                  <button
                    onClick={() => setShowAccountOptions(!showAccountOptions)}
                    className="bg-[#1d2a45] hover:bg-[#2a3756] text-white px-3 py-1 rounded-md text-sm flex items-center"
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Contas
                  </button>
                  
                  {/* Botão de logout */}
                  <button
                    onClick={() => {
                      // Remover tokens e dados da conta
                      localStorage.removeItem('deriv_token');
                      localStorage.removeItem('deriv_oauth_token');
                      localStorage.removeItem('deriv_account_info');
                      localStorage.removeItem('deriv_active_loginid');
                      
                      // Aviso de sucesso
                      toast({
                        title: "Desconectado com sucesso",
                        description: "Você foi desconectado da Deriv",
                      });
                      
                      // Atualizar estado
                      setIsAuthenticated(false);
                      setAccountInfo(null);
                      
                      // Recarregar a página após pequeno delay
                      setTimeout(() => window.location.reload(), 500);
                    }}
                    className="bg-red-700 hover:bg-red-800 text-white px-3 py-1 rounded-md text-sm flex items-center"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <DerivConnectButton />
              )}
            </div>
          </div>
          
          {/* Grade com os dois gráficos lado a lado */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {/* Coluna da esquerda: Gráfico de barras */}
            <div className="w-full">
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg text-white font-medium">Gráfico de barras</h2>
                  <select 
                    className="bg-[#1d2a45] text-white text-sm rounded px-2 py-1 border border-[#3a4b6b]"
                    defaultValue="10"
                  >
                    <option value="10">10 Ticks</option>
                    <option value="25">25 Ticks</option>
                    <option value="50">50 Ticks</option>
                    <option value="100">100 Ticks</option>
                  </select>
                </div>
                <DashboardR100Display />
              </div>
            </div>
            
            {/* Coluna da direita: Gráfico Deriv */}
            <div className="w-full bg-[#13203a] rounded-lg p-6 shadow-md">
              <h2 className="text-lg text-white font-medium mb-4">Gráfico Deriv</h2>
              <div className="aspect-video bg-[#0c1525] rounded-md">
                <iframe
                  src="https://charts.deriv.com/deriv"
                  className="w-full h-full rounded-md"
                  style={{ border: "none" }}
                  title="Gráfico Deriv"
                ></iframe>
              </div>
            </div>
          </div>
          
          {/* Texto de aviso no rodapé, igual à imagem */}
          <div className="mt-8 text-xs text-gray-500 bg-[#13203a] p-4 rounded-lg">
            <p>AVISO DE RISCOS: Os produtos disponibilizados através deste site incluem opções binárias, contratos por diferenças ("CFDs") e outros derivados complexos. A negociação de opções binárias pode não ser adequada para todos. A negociação de CFDs implica um elevado grau de risco, uma vez que a alavancagem pode trabalhar tanto para a sua vantagem como para a sua desvantagem. Como resultado, os produtos disponibilizados neste site podem não ser adequados para todo tipo de investidor, devido ao risco de se perder todo o capital investido. Nunca se deve investir dinheiro que precisa e nunca se deve negociar com dinheiro emprestado. Antes de negociar os complexos produtos disponibilizados, certifique-se de que compreende os riscos envolvidos e aprenda mais sobre a negociação responsável.</p>
          </div>
        </main>
      </div>
      
      {/* Modal de confirmação de troca de conta */}
      <Dialog open={confirmAccountSwitch} onOpenChange={setConfirmAccountSwitch}>
        <DialogContent className="bg-[#162746] border-[#1c3654] text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center">
              <AlertCircle className="h-6 w-6 text-yellow-500 mr-2" />
              Confirmar troca de conta
            </DialogTitle>
            <DialogDescription className="text-gray-300">
              Você está prestes a trocar para a conta{' '}
              <span className="font-bold text-[#00e5b3]">
                {accountToSwitch?.loginid}
              </span>
            </DialogDescription>
            <div className="text-gray-300 mt-4">
              <p>Esta operação irá:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Desconectar todas as conexões atuais</li>
                <li>Validar o token da nova conta</li>
                <li>Recarregar completamente a página</li>
                <li>Definir a nova conta como principal para todo o sistema</li>
              </ul>
            </div>
          </DialogHeader>
          <DialogFooter className="sm:justify-between mt-4">
            <Button 
              variant="outline"
              onClick={() => setConfirmAccountSwitch(false)}
              className="border-gray-600 text-white hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => switchAccount(accountToSwitch)}
              className="bg-[#00e5b3] text-[#0e1a33] hover:bg-[#00c99f] hover:text-[#0e1a33]"
            >
              Confirmar troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}