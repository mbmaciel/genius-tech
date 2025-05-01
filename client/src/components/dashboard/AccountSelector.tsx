import React, { useState, useEffect } from 'react';
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

import { derivAPI } from '@/lib/derivApi';
import { switchToAccount, getSelectedAccount } from '@/lib/accountSwitcher';

interface Account {
  account: string;
  token?: string;
  currency: string;
  loginid?: string;
  isVirtual?: boolean;
  accountType?: string;
  balance?: number;
}

interface AccountSelectorProps {
  onAccountChanged?: (account: Account) => void;
}

export function AccountSelector({
  onAccountChanged
}: AccountSelectorProps): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const { toast } = useToast();

  // Carregar contas do usuário
  useEffect(() => {
    if (derivAPI.isConnected()) {
      setIsConnected(true);
      loadUserAccounts();
    }

    // Adicionar listener para eventos de conexão
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        loadUserAccounts();
      } else {
        setAccounts([]);
      }
    };

    // Adicionar listener para eventos de autorização
    const handleAuthorization = (event: CustomEvent) => {
      if (event.detail && event.detail.account_list) {
        processAccountList(event.detail.account_list);
      }
    };

    // Adicionar listener para eventos de troca de conta
    const handleAccountChange = (event: CustomEvent) => {
      if (event.detail && event.detail.account) {
        setSelectedAccount(event.detail.account);
      }
    };

    // Registrar listeners
    derivAPI.addConnectionListener(handleConnectionChange);
    document.addEventListener('deriv:authorize', handleAuthorization as EventListener);
    document.addEventListener('deriv:account_changed', handleAccountChange as EventListener);

    // Iniciar com a conta selecionada anteriormente
    const lastSelectedAccount = getSelectedAccount();
    if (lastSelectedAccount) {
      setSelectedAccount(lastSelectedAccount);
    }

    // Limpar listeners ao desmontar
    return () => {
      derivAPI.removeConnectionListener(handleConnectionChange);
      document.removeEventListener('deriv:authorize', handleAuthorization as EventListener);
      document.removeEventListener('deriv:account_changed', handleAccountChange as EventListener);
    };
  }, []);

  // Carregar contas do usuário
  const loadUserAccounts = async () => {
    try {
      const authorizeInfo = derivAPI.getAuthorizeInfo();
      
      if (authorizeInfo && authorizeInfo.account_list) {
        processAccountList(authorizeInfo.account_list);
      }
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
    }
  };

  // Processar lista de contas recebida da API
  const processAccountList = (accountList: any[]) => {
    try {
      const formattedAccounts = accountList.map((acc) => {
        const currentAccount: Account = {
          account: acc.loginid,
          currency: acc.currency || '',
          loginid: acc.loginid,
          isVirtual: acc.is_virtual === 1,
          accountType: acc.account_type || acc.landing_company_name,
          balance: acc.balance
        };

        return currentAccount;
      });

      setAccounts(formattedAccounts);

      // Se tivermos apenas uma conta, selecioná-la automaticamente
      if (formattedAccounts.length === 1 && !selectedAccount) {
        setSelectedAccount(formattedAccounts[0].account);
      }

      // Se temos contas mas nenhuma selecionada, usar a primeira não desabilitada
      if (formattedAccounts.length > 0 && !selectedAccount) {
        const activeAccount = formattedAccounts.find(acc => !acc.isVirtual);
        if (activeAccount) {
          setSelectedAccount(activeAccount.account);
        } else {
          setSelectedAccount(formattedAccounts[0].account);
        }
      }
    } catch (error) {
      console.error('Erro ao processar lista de contas:', error);
    }
  };

  // Alternar para outra conta
  const handleAccountSwitch = async (accountId: string) => {
    setIsLoading(true);

    try {
      const result = await switchToAccount(accountId);

      if (result.success) {
        setSelectedAccount(accountId);
        
        // Encontrar a conta completa para passar para o callback
        const accountInfo = accounts.find(acc => acc.account === accountId);
        
        if (accountInfo && onAccountChanged) {
          onAccountChanged(accountInfo);
        }

        toast({
          title: "Conta alterada com sucesso",
          description: `Agora utilizando a conta ${formatAccountName(accountInfo || { account: accountId, currency: '', isVirtual: false })}`,
        });
      } else {
        toast({
          title: "Erro ao alterar conta",
          description: result.error || "Não foi possível alternar para a conta selecionada",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao alterar conta",
        description: error.message || "Ocorreu um erro inesperado ao trocar de conta",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Formatar nome da conta para exibição
  const formatAccountName = (account: Account) => {
    const accountType = account.isVirtual ? 'Demo' : 'Real';
    const currency = account.currency ? account.currency.toUpperCase() : '';
    
    return `${accountType} ${currency} (${account.account})`;
  };

  // Formatar saldo da conta
  const formatBalance = (account: Account) => {
    if (account.balance === undefined) return '';
    
    const currency = account.currency || '';
    return `${account.balance} ${currency.toUpperCase()}`;
  };

  // Renderizar o componente
  return (
    <div className="flex flex-col w-full gap-2">
      <div className="flex items-center gap-2">
        <Select 
          value={selectedAccount || ''} 
          onValueChange={handleAccountSwitch}
          disabled={isLoading || !isConnected || accounts.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma conta" />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4} align="start">
            <SelectGroup>
              {accounts.map((account) => (
                <SelectItem key={account.account} value={account.account}>
                  <div className="flex items-center justify-between w-full">
                    <span>{formatAccountName(account)}</span>
                    {account.balance !== undefined && (
                      <Badge variant={account.isVirtual ? "secondary" : "default"} className="ml-2">
                        {formatBalance(account)}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {!isConnected && (
        <p className="text-sm text-muted-foreground">
          Não conectado à API Deriv. Por favor, faça login primeiro.
        </p>
      )}

      {isConnected && accounts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhuma conta disponível. Verifique sua conexão com a API Deriv.
        </p>
      )}
    </div>
  );
}