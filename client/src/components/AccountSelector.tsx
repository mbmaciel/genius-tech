import { useState, useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Wallet, Users } from 'lucide-react';
import { authorizeAccount } from '@/lib/accountManager';
import { useToast } from '@/hooks/use-toast';

interface Account {
  loginid: string;
  token?: string;
  currency: string;
  is_virtual?: boolean | number;
  balance?: number;
  account_type?: string;
}

interface AccountSelectorProps {
  onAccountChanged?: (account: any) => void;
  className?: string;
}

export function AccountSelector({ onAccountChanged, className = '' }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Carregar contas disponíveis
  useEffect(() => {
    const loadAccounts = () => {
      const accountInfoStr = localStorage.getItem('deriv_account_info');
      if (!accountInfoStr) return;
      
      try {
        const accountInfo = JSON.parse(accountInfoStr);
        
        if (accountInfo && accountInfo.account_list && Array.isArray(accountInfo.account_list)) {
          // Mapear lista de contas para o formato que precisamos
          const accountsList = accountInfo.account_list.map((acc: any) => ({
            loginid: acc.loginid,
            currency: acc.currency || 'USD',
            is_virtual: acc.is_virtual,
            account_type: acc.account_type,
            // Token será adicionado de localStorage se disponível
          }));
          
          // Tentar obter tokens armazenados
          const storedAccountsStr = localStorage.getItem('deriv_accounts');
          if (storedAccountsStr) {
            const storedAccounts = JSON.parse(storedAccountsStr);
            // Adicionar tokens às contas mapeadas
            accountsList.forEach((acc: any) => {
              const storedAcc = storedAccounts.find((stored: any) => stored.loginid === acc.loginid);
              if (storedAcc && storedAcc.token) {
                acc.token = storedAcc.token;
              }
            });
          }
          
          setAccounts(accountsList);
          
          // Se temos o loginid atual, selecionamos ele
          if (accountInfo.loginid) {
            setSelectedAccount(accountInfo.loginid);
          } else if (accountsList.length > 0) {
            setSelectedAccount(accountsList[0].loginid);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar contas:', error);
      }
    };
    
    loadAccounts();
  }, []);

  const handleAccountChange = async (loginid: string) => {
    // Encontrar a conta com este loginid
    const account = accounts.find(acc => acc.loginid === loginid);
    if (!account || !account.token) {
      toast({
        title: 'Erro ao alternar conta',
        description: 'Token não disponível para esta conta.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Autorizar a conta para obter informações atualizadas
      const accountInfo = await authorizeAccount(account.token);
      
      // Atualizar o localStorage com a nova conta ativa
      localStorage.setItem('deriv_account_info', JSON.stringify(accountInfo));
      
      // Atualizar estado local
      setSelectedAccount(loginid);
      
      toast({
        title: 'Conta alterada',
        description: `Agora utilizando a conta ${loginid}`,
      });
      
      // Notificar o componente pai se houver callback
      if (onAccountChanged) {
        onAccountChanged(accountInfo);
      }
    } catch (error) {
      console.error('Erro ao alternar conta:', error);
      toast({
        title: 'Erro ao alternar conta',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Formatar o nome da conta para exibição
  const formatAccountName = (account: Account) => {
    const isVirtual = account.is_virtual === 1 || account.is_virtual === true;
    return `${account.loginid} (${account.currency})${isVirtual ? ' - Demo' : ''}`;
  };
  
  // Se não houver contas ou tokens, não renderiza o componente
  if (accounts.length === 0) return null;

  return (
    <div className={`flex items-center ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={isLoading}>
          <Button variant="outline" className="bg-[#1d2a45] border-[#3a4b6b] text-white hover:bg-[#2a3756] hover:text-white">
            <Users className="mr-2 h-4 w-4" />
            {accounts.find(acc => acc.loginid === selectedAccount) 
              ? formatAccountName(accounts.find(acc => acc.loginid === selectedAccount)!)
              : "Selecionar Conta"}
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-[#13203a] border-[#3a4b6b] text-white">
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.loginid}
              onClick={() => handleAccountChange(account.loginid)}
              className="cursor-pointer hover:bg-[#1d2a45]"
            >
              <Wallet className="mr-2 h-4 w-4" />
              <span>{formatAccountName(account)}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}