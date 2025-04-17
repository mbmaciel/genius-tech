import React, { useState, useEffect } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from '@/components/ui/button';
import derivAPI from '@/lib/derivApi';
import { toast } from '@/hooks/use-toast';
import { Loader2, SwitchCamera } from 'lucide-react';

interface Account {
  loginid: string;
  currency?: string;
  isVirtual?: boolean;
}

interface NewAccountSelectorProps {
  onAccountChanged?: (account: Account) => void;
  variant?: 'default' | 'button' | 'compact';
}

export function NewAccountSelector({ 
  onAccountChanged, 
  variant = 'default' 
}: NewAccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load active account on component mount
    const currentAccountInfo = derivAPI.getAccountInfo();
    if (currentAccountInfo && currentAccountInfo.loginId) {
      setActiveAccount({
        loginid: currentAccountInfo.loginId,
        isVirtual: currentAccountInfo.isVirtual,
        currency: currentAccountInfo.currency
      });
    }

    // Fetch available accounts
    const fetchAccounts = async () => {
      try {
        if (derivAPI.getConnectionStatus()) {
          const accountList = await derivAPI.getAccountList();
          setAccounts(accountList);
        }
      } catch (error) {
        console.error('Error fetching accounts:', error);
      }
    };

    fetchAccounts();

    // Listen for account changes
    const handleAccountInfo = (event: CustomEvent) => {
      const accountInfo = event.detail;
      if (accountInfo && accountInfo.loginId) {
        setActiveAccount({
          loginid: accountInfo.loginId,
          isVirtual: accountInfo.isVirtual,
          currency: accountInfo.currency
        });
      }
    };

    document.addEventListener('deriv:account_info' as any, handleAccountInfo as any);

    // Listen for connection status changes
    const handleConnectionStatus = (event: CustomEvent) => {
      if (event.detail.connected) {
        fetchAccounts();
      } else {
        setAccounts([]);
      }
    };

    document.addEventListener('deriv:connection_status' as any, handleConnectionStatus as any);

    return () => {
      document.removeEventListener('deriv:account_info' as any, handleAccountInfo as any);
      document.removeEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    };
  }, []);

  const switchAccount = async (account: Account) => {
    try {
      setIsLoading(true);
      
      // Store token for the selected account
      const accountTokenKey = `deriv_token_${account.loginid}`;
      const token = localStorage.getItem(accountTokenKey);
      
      if (!token) {
        throw new Error(`Token not found for account ${account.loginid}`);
      }
      
      // Set reconnection flag and store new token
      localStorage.setItem('force_reconnect', 'true');
      localStorage.setItem('deriv_api_token', token);
      
      // Disconnect current connection
      derivAPI.disconnect(true);
      
      // Notify parent component about account change
      if (onAccountChanged) {
        onAccountChanged(account);
      }
      
      // Reload page to apply new account
      window.location.reload();
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

  // Render different variants
  if (variant === 'button') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="bg-[#1f3158] border-[#1c3654] text-white hover:bg-[#283d6a]"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <SwitchCamera className="h-4 w-4 mr-2" />
                Trocar Conta
              </>
            )}
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

  if (variant === 'compact') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            className="px-2 h-8"
            disabled={isLoading}
          >
            <SwitchCamera className="h-4 w-4" />
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
                  <span className="text-sm">{account.loginid}</span>
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

  // Default variant
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          size="sm"
          className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33] text-xs py-1 px-3 rounded-full font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            "Trocar Conta"
          )}
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
