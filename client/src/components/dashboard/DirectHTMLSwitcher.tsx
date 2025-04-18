import React, { useState, useEffect } from 'react';
import derivAPI from '@/lib/derivApi';

interface Account {
  loginid: string;
  isVirtual?: boolean;
  currency?: string;
}

export function DirectHTMLSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Carregar informações da conta atual
    const currentAccountInfo = derivAPI.getAuthorizeInfo();
    if (currentAccountInfo && currentAccountInfo.loginid) {
      setActiveAccount({
        loginid: currentAccountInfo.loginid,
        isVirtual: Boolean(currentAccountInfo.is_virtual),
        currency: currentAccountInfo.currency
      });
    }

    // Buscar contas disponíveis
    const fetchAccounts = async () => {
      try {
        // Obter contas do localStorage
        const accountsStr = localStorage.getItem('deriv_accounts');
        if (accountsStr) {
          try {
            const accountsData = JSON.parse(accountsStr);
            const formattedAccounts = accountsData.map((acc: any) => ({
              loginid: acc.loginid,
              isVirtual: Boolean(acc.is_virtual),
              currency: acc.currency
            }));
            setAccounts(formattedAccounts);
          } catch (parseError) {
            console.error('Erro ao analisar dados de contas:', parseError);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar contas:', error);
      }
    };

    fetchAccounts();
  }, []);
  
  // Função que prepara os dados da conta e redireciona
  const switchAccount = (account: Account) => {
    if (activeAccount?.loginid === account.loginid) return;
    
    setIsLoading(true);
    
    try {
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
        alert(`Erro: Token não encontrado para ${account.loginid}. Faça login novamente.`);
        setIsLoading(false);
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
      
      // Redirecionar para o dashboard
      window.location.href = `/dashboard?account=${account.loginid}&t=${Date.now()}`;
      
    } catch (error) {
      console.error('Erro ao trocar de conta:', error);
      alert(`Erro ao trocar de conta: ${error}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#162746] border border-[#1c3654] rounded-lg p-2">
      <div className="flex flex-col">
        <div className="mb-2 pb-2 border-b border-[#1c3654]">
          <div className="flex items-center p-2">
            <div className={`w-2 h-2 rounded-full ${activeAccount?.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'} mr-2`}></div>
            <span className="text-sm font-medium text-white">
              Conta atual: {activeAccount?.loginid || 'Nenhuma'}
            </span>
          </div>
        </div>
        
        <div className="text-sm text-gray-300 mb-2 px-2">
          Selecione uma conta:
        </div>
        
        {accounts.map((account) => (
          <button
            key={account.loginid}
            onClick={() => {
              const confirmed = window.confirm(`Trocar para conta ${account.loginid}?`);
              if (confirmed) {
                switchAccount(account);
              }
            }}
            disabled={isLoading || activeAccount?.loginid === account.loginid}
            className={`
              w-full text-left p-2 rounded mb-1
              ${activeAccount?.loginid === account.loginid ? 'bg-[#1f3158]' : 'hover:bg-[#1f3158]'}
              ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              transition-colors
            `}
          >
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full ${account.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'} mr-2`}></div>
              <div className="flex flex-col">
                <span className="text-sm text-white">{account.loginid}</span>
                <span className="text-xs text-gray-400">
                  {account.isVirtual ? 'Demo' : 'Real'} {account.currency ? `(${account.currency})` : ''}
                </span>
              </div>
            </div>
          </button>
        ))}
        
        {accounts.length === 0 && (
          <div className="p-2 text-center text-gray-400 text-sm">
            Nenhuma conta disponível
          </div>
        )}
      </div>
    </div>
  );
}