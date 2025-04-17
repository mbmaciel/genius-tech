import { useEffect, useState, useCallback, useRef } from "react";
import { startKeepAlive, stopKeepAlive } from "@/lib/websocketKeepAlive";
import { useToast } from "@/hooks/use-toast";
import { DerivConnectButton } from "@/components/DerivConnectButton";
import { AccountSelector } from "@/components/AccountSelector";
import { AccountInfo } from "@/components/AccountInfo";
import balanceService, { BalanceResponse } from "@/lib/balanceService";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  
  // Efeito para verificar se já existe uma sessão autenticada - executado quando startBalanceSubscription muda
  useEffect(() => {
    const storedToken = localStorage.getItem('deriv_token');
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    
    if (storedToken && storedAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(storedAccountInfo);
        setIsAuthenticated(true);
        setAccountInfo(parsedAccountInfo);
        
        // Iniciar a assinatura de saldo em tempo real
        if (parsedAccountInfo && parsedAccountInfo.loginid) {
          // Sem efetuar nova chamada se já foi montado uma vez
          if (!balanceUpdateRef.current) {
            startBalanceSubscription(parsedAccountInfo.loginid);
          }
        }
      } catch (error) {
        console.error('Erro ao processar dados de conta armazenados:', error);
      }
    }
  }, [startBalanceSubscription]); // Depende da função de assinatura

  // Iniciar a conexão WebSocket quando o componente for montado
  useEffect(() => {
    // Iniciar a conexão WebSocket para dados R_100
    startKeepAlive();
    
    // Adicionar listener para eventos de tick
    const handleTick = (event: CustomEvent) => {
      const tick = event.detail.tick;
      if (tick && tick.symbol === 'R_100') {
        // Extrair o último dígito do tick
        const price = tick.quote;
        const lastDigit = Math.floor(price * 10) % 10;
        
        // Atualizar os últimos dígitos
        setLastDigits((prev: number[]) => {
          const newDigits = [...prev, lastDigit];
          // Manter apenas os N últimos dígitos com base no valor de ticks
          return newDigits.slice(-parseInt(ticks.toString()));
        });
      }
    };
    
    // Registrar o evento personalizado
    document.addEventListener('deriv:tick', handleTick as EventListener);
    
    // Limpar ao desmontar
    return () => {
      document.removeEventListener('deriv:tick', handleTick as EventListener);
      stopKeepAlive();
    };
  }, [ticks]);
  
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
                                        onClick={() => {
                                          if (isActive) {
                                            setShowAccountOptions(false);
                                            return;
                                          }
                                          
                                          try {
                                            // Obter informações detalhadas da conta
                                            const accountInfoKey = `deriv_account_info_${acc.loginid}`;
                                            const accountInfoStr = localStorage.getItem(accountInfoKey);
                                            
                                            if (accountInfoStr) {
                                              // Se temos informações detalhadas, use-as
                                              const accountData = JSON.parse(accountInfoStr);
                                              
                                              // Atualizar conta ativa
                                              localStorage.setItem('deriv_active_account', acc.loginid);
                                              localStorage.setItem('deriv_account_info', accountInfoStr);
                                              
                                              // Atualizar estado do componente
                                              setAccountInfo({
                                                loginid: accountData.loginid,
                                                email: accountData.email,
                                                name: accountData.fullname,
                                                balance: accountData.balance,
                                                currency: accountData.currency,
                                                isVirtual: accountData.is_virtual,
                                                landingCompanyName: accountData.landing_company_name
                                              });
                                              
                                              // Iniciar assinatura de saldo
                                              startBalanceSubscription(acc.loginid);
                                              
                                              toast({
                                                title: "Conta alternada",
                                                description: `Agora usando a conta ${acc.loginid}`,
                                              });
                                            } else {
                                              // Se não temos informações detalhadas, fazer autorização
                                              const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=71403');
                                              
                                              ws.onopen = () => {
                                                const authRequest = { authorize: acc.token };
                                                ws.send(JSON.stringify(authRequest));
                                              };
                                              
                                              ws.onmessage = (event) => {
                                                const response = JSON.parse(event.data);
                                                
                                                if (response.authorize) {
                                                  // Autorização bem-sucedida
                                                  localStorage.setItem('deriv_account_info', JSON.stringify(response.authorize));
                                                  localStorage.setItem('deriv_active_account', acc.loginid);
                                                  localStorage.setItem(accountInfoKey, JSON.stringify(response.authorize));
                                                  
                                                  // Atualizar estado 
                                                  setAccountInfo({
                                                    loginid: response.authorize.loginid,
                                                    email: response.authorize.email,
                                                    name: response.authorize.fullname,
                                                    balance: response.authorize.balance,
                                                    currency: response.authorize.currency,
                                                    isVirtual: response.authorize.is_virtual,
                                                    landingCompanyName: response.authorize.landing_company_name
                                                  });
                                                  
                                                  // Iniciar assinatura de saldo
                                                  startBalanceSubscription(response.authorize.loginid);
                                                  
                                                  toast({
                                                    title: "Conta alternada",
                                                    description: `Agora usando a conta ${response.authorize.loginid}`,
                                                  });
                                                  
                                                  ws.close();
                                                } else if (response.error) {
                                                  console.error('Erro na autorização:', response.error);
                                                  toast({
                                                    title: 'Erro ao alternar conta',
                                                    description: response.error.message || 'Falha na autorização',
                                                    variant: 'destructive',
                                                  });
                                                  ws.close();
                                                }
                                              };
                                              
                                              ws.onerror = () => {
                                                toast({
                                                  title: 'Erro de conexão',
                                                  description: 'Não foi possível conectar ao servidor da Deriv',
                                                  variant: 'destructive',
                                                });
                                              };
                                            }
                                          } catch (error) {
                                            console.error('Erro ao alternar conta:', error);
                                            toast({
                                              title: 'Erro ao alternar conta',
                                              description: 'Não foi possível processar a troca de conta',
                                              variant: 'destructive',
                                            });
                                          }
                                          
                                          // Fechar o menu dropdown após seleção
                                          setShowAccountOptions(false);
                                        }}
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
          {/* Gráfico de barras */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg text-white font-medium">Gráfico de barras</h2>
              <select 
                className="bg-[#1d2a45] text-white text-sm rounded px-2 py-1 border border-[#3a4b6b]"
                value={ticks}
                onChange={handleTicksChange}
              >
                <option value="10">10 Ticks</option>
                <option value="25">25 Ticks</option>
                <option value="50">50 Ticks</option>
                <option value="100">100 Ticks</option>
              </select>
            </div>
            
            <div className="relative w-full h-96 mt-4">
              {/* Container responsivo para o gráfico */}
              <div className="relative flex flex-col h-full">
                {/* Eixo Y (percentuais) com posição fixa */}
                <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-xs text-gray-400 pr-2 z-10">
                  <div>50</div>
                  <div>40</div>
                  <div>30</div>
                  <div>20</div>
                  <div>10</div>
                  <div>0</div>
                </div>
                
                {/* Linhas de grade horizontais */}
                <div className="absolute left-8 right-2 top-0 bottom-6 flex flex-col justify-between z-0">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-full border-t border-[#2a3756] h-0"></div>
                  ))}
                </div>
                
                {/* Gráfico de barras responsivo */}
                <div className="flex h-full pt-0 pb-6 pl-8 pr-2 overflow-x-auto">
                  <div className="flex flex-1 min-w-0 h-full justify-between">
                    {digitStats.map((stat) => (
                      <div key={stat.digit} className="flex flex-col items-center justify-end px-1">
                        {/* Valor percentual acima da barra somente para barras com valor */}
                        {stat.percentage > 0 && (
                          <div className="text-xs font-medium text-white whitespace-nowrap mb-1">
                            {stat.percentage}%
                          </div>
                        )}
                        
                        {/* Barra do gráfico com altura proporcional e responsiva */}
                        <div 
                          className={`w-full min-w-[20px] max-w-[40px] ${getBarColor(stat.percentage)}`}
                          style={{ 
                            height: stat.percentage === 0 ? '0px' : `${Math.min(50, Math.max(3, stat.percentage))}%` 
                          }}
                        ></div>
                        
                        {/* Número do dígito abaixo da barra */}
                        <div className="mt-1 text-xs sm:text-sm text-white">{stat.digit}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Últimos dígitos */}
            <div className="mt-4 bg-[#1d2a45] p-2 rounded flex flex-wrap justify-center">
              {lastDigits.slice().reverse().map((digit, index) => (
                <span key={index} className="w-7 h-7 flex items-center justify-center text-white border border-[#3a4b6b] m-1 rounded-md">
                  {digit}
                </span>
              ))}
            </div>
          </div>
          
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
    </div>
  );
}