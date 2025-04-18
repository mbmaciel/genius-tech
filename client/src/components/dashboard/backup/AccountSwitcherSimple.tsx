import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import derivAPI from '@/lib/derivApi';

interface Account {
  loginid: string;
  isVirtual?: boolean;
  currency?: string;
}

export function AccountSwitcherSimple() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Carregar informações da conta atual quando o componente for montado
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
        if (derivAPI.isConnected()) {
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
        }
      } catch (error) {
        console.error('Erro ao buscar contas:', error);
      }
    };

    fetchAccounts();
  }, []);

  // Função para lidar com o clique na conta
  const handleAccountClick = (account: Account) => {
    if (activeAccount?.loginid === account.loginid) return;
    
    console.log("SOLICITANDO TROCA DE CONTA", account.loginid);
    setIsLoading(true);
    
    // Criar e disparar evento para solicitar mudança de conta
    const switchEvent = new CustomEvent('account:switch:request', {
      detail: {
        account: account
      }
    });
    
    document.dispatchEvent(switchEvent);
    
    // Resetar o estado de carregamento após um breve período
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="bg-[#0e1a33] text-white rounded-lg p-3 flex items-center justify-between cursor-pointer hover:bg-opacity-70 w-full"
          disabled={isLoading}
        >
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${activeAccount?.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'}`}></div>
            <span className="text-sm font-medium truncate max-w-[120px]">
              {activeAccount?.loginid || 'Sem conta'}
            </span>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 bg-[#162746] border-[#1c3654] text-white">
        <div className="flex flex-col">
          {accounts.length > 0 ? (
            accounts.map((account) => (
              <Button
                key={account.loginid}
                variant="ghost"
                className={`flex items-center justify-start px-4 py-2 text-left hover:bg-[#1f3158] ${activeAccount?.loginid === account.loginid ? 'bg-[#1f3158]' : ''}`}
                onClick={() => handleAccountClick(account)}
                disabled={isLoading || activeAccount?.loginid === account.loginid}
              >
                <div className={`w-2 h-2 rounded-full ${account.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'} mr-2`}></div>
                <div className="flex flex-col items-start">
                  <span className="text-sm">{account.loginid}</span>
                  <span className="text-xs text-gray-400">
                    {account.isVirtual ? 'Demo' : 'Real'} {account.currency ? `(${account.currency})` : ''}
                  </span>
                </div>
              </Button>
            ))
          ) : (
            <div className="p-4 text-center text-gray-400 text-sm">Nenhuma conta disponível</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}