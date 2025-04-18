import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import derivAPI from '@/lib/derivApi';
import { toast } from '@/hooks/use-toast';

interface Account {
  loginid: string;
  isVirtual?: boolean;
  currency?: string;
}

export function AccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load account info on component mount
    const currentAccountInfo = derivAPI.getAuthorizeInfo();
    if (currentAccountInfo && currentAccountInfo.loginid) {
      setActiveAccount({
        loginid: currentAccountInfo.loginid,
        isVirtual: Boolean(currentAccountInfo.is_virtual),
        currency: currentAccountInfo.currency
      });
    }

    // Fetch available accounts
    const fetchAccounts = async () => {
      try {
        if (derivAPI.isConnected()) {
          // Obter contas do localStorage pois a API não tem método getAccountList
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
              console.error('Error parsing accounts data:', parseError);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    };

    fetchAccounts();

    // Listen for account changes
    const handleAccountInfo = (event: CustomEvent) => {
      const accountInfo = event.detail;
      if (accountInfo && (accountInfo.loginId || accountInfo.loginid)) {
        setActiveAccount({
          loginid: accountInfo.loginId || accountInfo.loginid,
          isVirtual: Boolean(accountInfo.isVirtual || accountInfo.is_virtual),
          currency: accountInfo.currency
        });
      }
    };

    // Listener para validação de token do oauthDirectService
    const handleTokenValidation = (event: CustomEvent) => {
      const data = event.detail;
      if (data && data.loginid) {
        toast({
          title: "Token validado com sucesso",
          description: `Token da conta ${data.loginid} validado e pronto para operações.`,
          variant: "default",
        });
      }
    };

    document.addEventListener('deriv:account_info' as any, handleAccountInfo as any);
    document.addEventListener('deriv:token_validated' as any, handleTokenValidation as any);

    return () => {
      document.removeEventListener('deriv:account_info' as any, handleAccountInfo as any);
      document.removeEventListener('deriv:token_validated' as any, handleTokenValidation as any);
    };
  }, []);

  const switchAccount = async (account: Account) => {
    try {
      setIsLoading(true);
      
      // Store token for the selected account
      const accountTokenKey = `deriv_token_${account.loginid}`;
      const token = localStorage.getItem(accountTokenKey);
      
      if (!token) {
        throw new Error(`Token não encontrado para a conta ${account.loginid}`);
      }
      
      // Notificar o serviço OAuth sobre a mudança de conta
      toast({
        title: "Trocando de conta",
        description: `Validando token da conta ${account.loginid}...`,
        variant: "default",
      });
      
      // 1. Atualizar no localStorage para permitir comunicação indireta
      localStorage.setItem('deriv_oauth_selected_account', JSON.stringify({
        accountId: account.loginid,
        token: token,
        timestamp: new Date().getTime()
      }));
      
      // 2. Emitir evento para oauthDirectService
      const accountSwitchEvent = new CustomEvent('deriv:oauth_account_switch', { 
        detail: { 
          accountId: account.loginid,
          token: token
        } 
      });
      document.dispatchEvent(accountSwitchEvent);
      
      // Atualizar a visualização na UI imediatamente
      setActiveAccount({
        loginid: account.loginid,
        isVirtual: account.isVirtual,
        currency: account.currency
      });
      
      // Mostrar mensagem de mudança de conta
      toast({
        title: "Alterando conta principal",
        description: `Mudando para a conta ${account.loginid}...`,
        variant: "default",
      });
      
      // Salvar a conta como ativa no formato usado pela aplicação - IMPORTANTE
      // Essas mudanças garantem que o sistema reconheça a nova conta
      localStorage.setItem('deriv_active_loginid', account.loginid);
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('deriv_oauth_token', token);
      
      // Criar flag que indica que houve mudança de conta
      const switchTimestamp = Date.now();
      localStorage.setItem('account_switch_timestamp', String(switchTimestamp));
      
      // Criar objeto com informações da conta ativa
      const activeAccountData = {
        loginid: account.loginid,
        token: token,
        is_virtual: account.isVirtual,
        currency: account.currency,
        timestamp: switchTimestamp,
        active: true
      };
      
      // Armazenar como conta ativa
      localStorage.setItem('deriv_active_account', JSON.stringify(activeAccountData));
      
      // Forçar flag de reconexão em todo o sistema
      localStorage.setItem('force_reconnect', 'true');
      
      // Desconectar WebSocket atual para garantir reconexão
      derivAPI.disconnect(true);
      
      // Disparar evento para que outros componentes saibam da troca
      const event = new CustomEvent('deriv:account_switched', { 
        detail: activeAccountData
      });
      document.dispatchEvent(event);
      
      // Mostrar mensagem de sucesso
      toast({
        title: "Troca de conta iniciada",
        description: `Aplicando conta ${account.loginid} como principal...`,
        variant: "success",
      });
      
      // Atualizar interface imediatamente
      setActiveAccount(account);
      
      console.log('[AccountSwitcher] 🔄 Recarregando página para aplicar nova conta ativa');
      
      // Forçar recarregamento da página após breve atraso
      // Isso garante que todos os serviços do sistema reconheçam a nova conta
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error switching account:', error);
      toast({
        title: "Erro ao trocar de conta",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
                onClick={() => activeAccount?.loginid !== account.loginid && switchAccount(account)}
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
