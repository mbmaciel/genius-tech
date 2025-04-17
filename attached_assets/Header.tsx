import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ArrowDown, ArrowUp, Bell, Clock, LogIn, Key } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import derivAPI from "@/lib/derivApi";
import { DerivConnectButton } from "./DerivConnectButton";
import TokenManager from "./TokenManager";

export function Header() {
  const [isConnected, setIsConnected] = useState(true);
  const [currentTime, setCurrentTime] = useState('');
  const [accountInfo, setAccountInfo] = useState({
    loginid: '',
    balance: 0,
    currency: 'USD',
    isVirtual: false
  });
  const [isLoadingBalance, setIsLoadingBalance] = useState(true);
  const [balanceChanged, setBalanceChanged] = useState<'up' | 'down' | null>(null);
  const previousBalance = useRef(0);
  const balanceChangeTimeout = useRef<NodeJS.Timeout | null>(null);
  
  // Atualiza o horário a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false
      }) + ' GMT');
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Configura a atualização em tempo real do saldo
  useEffect(() => {
    // Função para configurar polling de saldo
    const setupBalancePolling = () => {
      // Configurar polling a cada 2 segundos para garantir atualizações frequentes
      const pollingInterval = setInterval(async () => {
        try {
          const balanceResponse = await derivAPI.getAccountBalance();
          if (balanceResponse && balanceResponse.balance) {
            updateAccountBalance(
              balanceResponse.balance.balance, 
              balanceResponse.balance.currency,
              balanceResponse.balance.loginid, // Incluir loginid se disponível
              balanceResponse.balance.is_virtual // Incluir status virtual se disponível
            );
          }
        } catch (error) {
          console.error("Erro ao atualizar saldo:", error);
        }
      }, 2000); // A cada 2 segundos para manter o saldo atualizado
      
      return pollingInterval;
    };
    
    // Função para atualizar o saldo e mostrar indicadores
    const updateAccountBalance = (newBalance: number, currency: string, loginId?: string, isVirtual?: boolean) => {
      // Atualizar indicador de mudança de saldo (seta para cima/baixo)
      if (previousBalance.current !== 0 && newBalance !== previousBalance.current) {
        // Limpar qualquer timeout anterior
        if (balanceChangeTimeout.current) {
          clearTimeout(balanceChangeTimeout.current);
        }
        
        setBalanceChanged(newBalance > previousBalance.current ? 'up' : 'down');
        
        // Configurar novo timeout para remover o indicador após 2 segundos
        balanceChangeTimeout.current = setTimeout(() => {
          setBalanceChanged(null);
        }, 2000);
      }
      
      // Atualizar saldo com todos os dados disponíveis
      setAccountInfo(prevInfo => {
        const updatedInfo = {
          ...prevInfo,
          balance: newBalance,
          currency: currency
        };
        
        // Atualizar loginid se fornecido
        if (loginId) {
          updatedInfo.loginid = loginId;
        }
        
        // Atualizar isVirtual se fornecido
        if (isVirtual !== undefined) {
          updatedInfo.isVirtual = isVirtual;
        }
        
        return updatedInfo;
      });
      
      // Atualizar referência para próxima comparação
      previousBalance.current = newBalance;
      
      // Não está mais carregando
      setIsLoadingBalance(false);
    };
    
    // Função principal para obter informações e saldo da conta
    const getAccountInfo = async () => {
      try {
        setIsLoadingBalance(true);
        
        // Tenta obter informações da conta usando getAccountInfo do derivAPI
        const accountDetails = derivAPI.getAccountInfo();
        
        // Verificar se temos informações válidas
        if (accountDetails && accountDetails.loginId) {
          console.log("Obtendo informações da conta via getAccountInfo:", accountDetails);
          
          // Atualizar estado com os dados obtidos
          setAccountInfo({
            loginid: accountDetails.loginId,
            balance: typeof accountDetails.balance === 'object' 
              ? accountDetails.balance.balance || 0 
              : accountDetails.balance || 0,
            currency: typeof accountDetails.balance === 'object' 
              ? accountDetails.balance.currency || 'USD' 
              : accountDetails.currency || 'USD',
            isVirtual: accountDetails.isVirtual || false
          });
          
          // Guardar saldo inicial para comparações
          previousBalance.current = typeof accountDetails.balance === 'object' 
            ? accountDetails.balance.balance || 0 
            : accountDetails.balance || 0;
          
          setIsLoadingBalance(false);
          setIsConnected(true);
          return; // Retornar para evitar execução redundante
        }
        
        // Se não conseguiu obter via getAccountInfo, tenta authorize direto
        const token = sessionStorage.getItem('derivApiToken') || import.meta.env.VITE_DERIV_API_TOKEN;
        
        if (token) {
          try {
            const response = await derivAPI.send({
              authorize: token
            });
            
            if (response && response.authorize) {
              console.log("Dados completos da conta obtidos via authorize:", response.authorize);
              
              // Definir ID e saldo inicial
              setAccountInfo({
                loginid: response.authorize.loginid || "",
                balance: response.authorize.balance || 0,
                currency: response.authorize.currency || "USD",
                isVirtual: response.authorize.is_virtual || false
              });
              
              // Guardar saldo inicial para comparações futuras
              previousBalance.current = response.authorize.balance || 0;
              
              setIsLoadingBalance(false);
            }
          } catch (authError) {
            console.error("Erro na autorização direta:", authError);
          }
        }
        
        // Inscrever-se para receber atualizações de saldo em tempo real
        try {
          await derivAPI.subscribeToBalanceUpdates();
          console.log("Inscrição para atualizações de saldo ativada");
        } catch (subError) {
          console.error("Erro ao inscrever para atualizações de saldo:", subError);
        }
        
        // Status de conexão da API
        setIsConnected(derivAPI.getConnectionStatus());
      } catch (error) {
        console.error("Erro ao obter informações da conta:", error);
        // Definir valores conhecidos em caso de erro total
        setAccountInfo({
          loginid: "CR1330028",
          balance: 0.1,
          currency: "USD",
          isVirtual: false
        });
        setIsConnected(false);
        setIsLoadingBalance(false);
      }
    };
    
    // Ouvinte para atualizações de saldo
    const handleBalanceUpdate = (event: any) => {
      const data = event.detail;
      
      if (data && data.balance) {
        const newBalance = data.balance.balance;
        const currency = data.balance.currency;
        const loginId = data.balance.loginid; // Extrair loginid se disponível
        
        // Não mostrar logs para atualizações silenciosas
        if (!data.silent) {
          console.log("Atualização de saldo recebida:", newBalance, currency, loginId);
        }
        
        // Passa loginid para updateAccountBalance se disponível
        updateAccountBalance(newBalance, currency, loginId);
      }
    };
    
    // Registrar ouvinte para evento personalizado de atualização de saldo
    document.addEventListener('deriv:balance_update', handleBalanceUpdate);
    
    // Iniciar obtenção de informações da conta
    getAccountInfo();
    
    // Configurar polling como fallback
    const pollingId = setupBalancePolling();
    
    // Limpar ouvintes e intervalos ao desmontar
    return () => {
      document.removeEventListener('deriv:balance_update', handleBalanceUpdate);
      clearInterval(pollingId);
      if (balanceChangeTimeout.current) {
        clearTimeout(balanceChangeTimeout.current);
      }
    };
  }, []);

  return (
    <header className="bg-[#0e1a33] border-b border-gray-800 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <div className="h-8 w-auto">
              <span className="text-xl font-bold text-[#00e5b3]">GeniusTech</span>
            </div>
          </div>

          {/* Horário e informações de conta */}
          <div className="flex-1 flex justify-center px-2 lg:ml-6 lg:justify-end">
            <div className="max-w-lg w-full">
              <div className="flex justify-end space-x-4">
                <div className="text-sm text-gray-400 flex items-center mr-4">
                  <Clock className="h-4 w-4 mr-1" />
                  <span>{currentTime}</span>
                </div>
                
                {isConnected ? (
                  <div className="flex items-center space-x-2">
                    <div className="bg-[#162440] text-white text-sm px-3 py-1 rounded flex items-center">
                      <span className="text-gray-400 mr-1">ID da Conta:</span>
                      <div className="flex items-center">
                        <span>{accountInfo.loginid}</span>
                        {accountInfo.isVirtual && (
                          <span className="ml-1 px-1 py-0.5 text-xs bg-blue-500 text-white rounded">Demo</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-[#162440] text-white text-sm px-3 py-1 rounded flex items-center">
                      <span className="text-gray-400 mr-1">Saldo:</span>
                      <span className="flex items-center">
                        {isLoadingBalance ? (
                          <span className="animate-pulse">...</span>
                        ) : (
                          <>
                            {accountInfo.balance.toFixed(2)} {accountInfo.currency.toUpperCase()}
                            {balanceChanged === 'up' && <ArrowUp className="ml-1 h-3 w-3 text-green-500" />}
                            {balanceChanged === 'down' && <ArrowDown className="ml-1 h-3 w-3 text-red-500" />}
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ) : (
                  <DerivConnectButton />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isConnected && <TokenManager />}
            
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white">
              <Bell className="h-5 w-5" />
            </Button>
            
            <Avatar className="h-8 w-8">
              <AvatarImage src="" />
              <AvatarFallback className="bg-[#00e5b3] text-[#0e1a33]">AD</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
    </header>
  );
}