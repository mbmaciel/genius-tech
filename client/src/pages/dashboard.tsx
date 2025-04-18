import { useEffect, useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { DerivConnectButton } from "@/components/DerivConnectButton";
import { AccountSelector } from "@/components/AccountSelector";
import { AccountInfo } from "@/components/AccountInfo";
import balanceService, { BalanceResponse } from "@/lib/balanceService";
import { RefreshCw, AlertCircle } from "lucide-react";
// Importar o novo componente isolado para o dashboard
import { DashboardR100Display } from "@/dashboard_exclusive/R100Display";
import { Button } from "@/components/ui/button";
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
  // Volatility 25 Index data
  const [vol25Data, setVol25Data] = useState<{time: number, price: number}[]>([]);
  const [vol25Connected, setVol25Connected] = useState<boolean>(false);
  const vol25SocketRef = useRef<WebSocket | null>(null);
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
  // Este efeito é CRÍTICO para garantir que a interface mostre a conta correta após a troca
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

  // NÃO é mais necessário iniciar a conexão WebSocket aqui
  // O R100Display possui sua própria conexão isolada
  
  // Calcular estatísticas dos dígitos quando lastDigits for atualizado
  useEffect(() => {
    if (lastDigits.length > 0) {
      const digitCounts = Array(10).fill(0);
      
      // Contar ocorrências de cada dígito
      lastDigits.forEach(digit => {
        digitCounts[digit]++;
      });
      
      // Calcular percentuais
      const stats = digitCounts.map((count, digit) => {
        const percentage = (count / lastDigits.length) * 100;
        return { digit, count, percentage: Math.round(percentage) };
      });
      
      setDigitStats(stats);
    }
  }, [lastDigits]);
  
  const handleTicksChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTicks = parseInt(e.target.value);
    setTicks(newTicks);
    // Limitar os dígitos existentes ao novo valor
    setLastDigits((prev: number[]) => prev.slice(-newTicks));
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
          variant: "destructive",
        });
        return;
      }
      
      // Salvar informações da nova conta no localStorage
      localStorage.setItem('deriv_active_loginid', account.loginid);
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('deriv_oauth_token', token);
      localStorage.setItem('account_switch_timestamp', Date.now().toString());
      localStorage.setItem('force_reconnect', 'true');
      
      // CRÍTICO: Atualizar as informações da conta no estado do componente
      // Isso garante que se o recarregamento não funcionar, a interface mostrará a conta correta
      setAccountInfo({
        ...account,
        token: token
      });
      
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
      
      // Disparar evento personalizado para notificar o sistema da troca de conta
      const switchEvent = new CustomEvent('deriv:account_switched', {
        detail: {
          loginid: account.loginid,
          timestamp: Date.now()
        }
      });
      document.dispatchEvent(switchEvent);
      
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
      
      // SOLUÇÃO DEFINITIVA: Técnica "HardReload" combinando várias abordagens
      console.log('[DASHBOARD] Aplicando SOLUÇÃO DEFINITIVA de recarregamento');
      
      // 1. Criar um iframe invisível que executará o script de recarregamento
      const iframe = document.createElement('iframe');
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      
      // Adicionar o iframe ao body
      document.body.appendChild(iframe);
      
      // 2. ABORDAGEM MÚLTIPLA - Execute todas as técnicas de recarregamento conhecidas
      try {
        // Método 1: Tentar usar o iframe
        if (iframe.contentWindow && iframe.contentWindow.document) {
          const reloadScript = `
            <script>
              window.parent.location.href = window.parent.location.href.split('?')[0] + '?force_reload=true&account=${account.loginid}&t=' + Date.now();
            </script>
          `;
          iframe.contentWindow.document.open();
          iframe.contentWindow.document.write(reloadScript);
          iframe.contentWindow.document.close();
        }
        
        // Método 2: setTimeout para garantir que o recarregamento seja executado mesmo se o iframe falhar
        setTimeout(() => {
          // Emitir evento de preparação antes do recarregamento
          try {
            // Notificar outros componentes que a página será recarregada
            const event = new CustomEvent('deriv:page_reloading', {
              detail: {
                reason: 'account_switch',
                newAccountId: account.loginid,
                timestamp: Date.now()
              }
            });
            document.dispatchEvent(event);
            
            // Limpar qualquer conexão WebSocket ativa
            if (typeof window.WebSocket !== 'undefined') {
              console.log('[DASHBOARD] Fechando conexões WebSocket antes do recarregamento');
            }
          } catch (e) {
            console.error('Erro ao preparar para recarregamento:', e);
          }
          
          // Forçar um recarregamento direto e completo
          window.location.href = `/dashboard?account=${account.loginid}&forcereload=true&t=${Date.now()}`;
        }, 300);
        
        // Método 3: Usar o método mais extremo window.location.reload(true) como último recurso
        setTimeout(() => {
          try {
            // @ts-ignore - O parâmetro true força ignorar o cache
            window.location.reload(true);
          } catch (e) {
            window.location.reload();
          }
        }, 800);
      } catch (e) {
        console.error('[DASHBOARD] Erro ao recarregar:', e);
        
        // Tenta recarregamento simples se tudo falhou
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao trocar de conta:', error);
      toast({
        title: "Erro ao trocar de conta",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen bg-[#0c1525]">
      {/* Sidebar/Menu lateral */}
      <div className="w-16 hover:w-48 transition-all duration-300 bg-[#0c1525] border-r border-[#1d2a45] flex flex-col items-center py-6 text-white overflow-hidden group">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center">
          <div className="w-10 h-10 rounded-md bg-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <span className="ml-3 font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Genius Tech</span>
        </div>
        
        {/* Ícones de menu */}
        <div className="flex flex-col space-y-6 items-center w-full">
          <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Dashboard</span>
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
          <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Operações</span>
          </button>
        </div>
      </div>
      
      {/* Conteúdo principal */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl text-white font-semibold">Dashboard</h1>
          
          <div className="flex items-center">
            {!isAuthenticated ? (
              <DerivConnectButton 
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-md transition-all duration-200"
                onSuccess={(token, accountInfo) => {
                  setIsAuthenticated(true);
                  setAccountInfo(accountInfo);
                  toast({
                    title: "Conexão bem-sucedida",
                    description: `Conectado como ${accountInfo.email || accountInfo.loginid}`,
                  });
                }}
              />
            ) : (
              <div className="flex items-center">
                {/* Informações simplificadas da conta */}
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
                      <div className="text-sm font-medium text-white">
                        {accountInfo.balance} <span className="text-xs">{accountInfo.currency}</span>
                      </div>
                      <div className="ml-2 w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Atualizado em tempo real"></div>
                    </div>
                  </div>
                )}
                
                {/* Dropdown para seletor de contas */}
                <div className="dropdown-container mr-3 relative">
                  <button 
                    onClick={() => setShowAccountOptions(!showAccountOptions)}
                    className="bg-[#1d2a45] text-white py-2 px-3 rounded-md border border-[#3a4b6b] hover:bg-[#2a3756] transition-colors flex items-center"
                  >
                    <span className="mr-1">Contas</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className={`ml-1 transition-transform ${showAccountOptions ? 'rotate-180' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  
                  {/* Dropdown das contas */}
                  {showAccountOptions && (
                    <div className="absolute top-full right-0 mt-1 w-64 bg-[#13203a] border border-[#3a4b6b] rounded-md shadow-lg z-10">
                      <div className="p-2 border-b border-[#3a4b6b]">
                        <p className="text-sm text-gray-400">Selecione uma conta</p>
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {(() => {
                          const accountsStr = localStorage.getItem('deriv_accounts');
                          if (accountsStr) {
                            try {
                              const accounts = JSON.parse(accountsStr);
                              return (
                                <div className="p-1">
                                  {accounts.map((acc: any) => {
                                    const isActive = accountInfo && accountInfo.loginid === acc.loginid;
                                    const accountText = acc.isVirtual 
                                      ? `${acc.loginid} (Demo)`
                                      : `${acc.loginid} (${acc.currency})`;
                                                                        
                                    return (
                                      <button
                                        key={acc.loginid}
                                        className={`w-full text-left px-3 py-2 my-1 rounded-md text-sm 
                                          ${isActive 
                                            ? 'bg-indigo-600 text-white' 
                                            : 'text-white hover:bg-[#2a3756]'}`}
                                        onClick={() => prepareAccountSwitch(acc)}
                                      >
                                        <div className="flex items-center">
                                          <div className={`w-2 h-2 rounded-full mr-2 ${isActive ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                          <div>
                                            <div>{accountText}</div>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            } catch (error) {
                              console.error('Erro ao carregar contas:', error);
                              return (
                                <div className="p-3 text-sm text-gray-400">
                                  Erro ao carregar contas
                                </div>
                              );
                            }
                          }
                          
                          return (
                            <div className="p-3 text-sm text-gray-400">
                              Sem contas disponíveis
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button 
                    onClick={() => window.location.href = '/bot'}
                    className="text-white text-sm py-2 px-3 rounded-md bg-indigo-600 hover:bg-indigo-700 transition-colors whitespace-nowrap flex items-center"
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className="mr-1"
                    >
                      <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                    </svg>
                    Automações
                  </button>
                  
                  <button 
                    onClick={() => {
                      // Limpar dados de autenticação
                      localStorage.removeItem('deriv_token');
                      localStorage.removeItem('deriv_account_info');
                      localStorage.removeItem('deriv_accounts');
                      setIsAuthenticated(false);
                      setAccountInfo(null);
                      
                      toast({
                        title: "Logout concluído",
                        description: "Você foi desconectado com sucesso.",
                      });
                    }}
                    className="text-white text-sm py-2 px-3 rounded-md bg-[#1d2a45] hover:bg-[#2a3756] transition-colors whitespace-nowrap"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* R_100 Display - Componente isolado exclusivo para o dashboard */}
          <DashboardR100Display />
          
          {/* Gráfico Deriv - Volatility 25 Index */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <h2 className="text-lg text-white font-medium mb-4">Gráfico Deriv</h2>
            <div className="relative w-full rounded border border-[#192339] overflow-hidden" style={{ height: "520px" }}>
              <iframe 
                src="https://charts.deriv.com/deriv/?market=synthetic_index&symbol=R_25&interval=24h&chart_type=line&theme=dark&toolbar=1&show_formula=0&candles=false" 
                className="absolute inset-0 w-full h-full"
                style={{ border: "none", background: "#0f1b31" }}
                title="Volatility 25 Index Chart"
                allow="fullscreen"
              ></iframe>
            </div>
          </div>
        </div>
        
        {/* Aviso de risco */}
        <div className="bg-[#13203a] rounded-lg p-4 mt-6 text-xs text-[#8492b4] leading-relaxed">
          <p>
            AVISO DE RISCO: Os produtos disponibilizados através deste site incluem opções binárias, contratos por diferenças ("CFDs") e outros derivativos complexos. A negociação de opções binárias pode não ser adequada para todos. A negociação de CFDs implica um elevado grau de risco, uma vez que a alavancagem pode trabalhar tanto para a sua vantagem como para a sua desvantagem. Como resultado, os produtos disponibilizados neste site podem não ser adequados para todo o tipo de investidor, devido ao risco de se perder todo o capital investido. Nunca se deve investir dinheiro que precisa e nunca se deve negociar com dinheiro emprestado. Antes de negociar os complexos produtos disponibilizados, certifique-se de que compreende os riscos envolvidos e aprenda mais sobre a negociação responsável.
          </p>
        </div>
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