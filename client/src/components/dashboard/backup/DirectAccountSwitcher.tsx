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

export function DirectAccountSwitcher() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // ID único para o formulário
  const formId = 'account-switch-form';

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
    
    // Criar o formulário oculto que será usado para redirecionamento
    const createHiddenForm = () => {
      // Remover qualquer formulário anterior
      const existingForm = document.getElementById(formId);
      if (existingForm) {
        document.body.removeChild(existingForm);
      }
      
      // Criar novo formulário
      const form = document.createElement('form');
      form.id = formId;
      form.method = 'GET';
      form.action = '/dashboard';
      form.style.display = 'none';
      
      // Adicionar campos
      const accountInput = document.createElement('input');
      accountInput.type = 'hidden';
      accountInput.name = 'account';
      accountInput.id = 'account-input';
      
      const timestampInput = document.createElement('input');
      timestampInput.type = 'hidden';
      timestampInput.name = 't';
      timestampInput.id = 'timestamp-input';
      
      form.appendChild(accountInput);
      form.appendChild(timestampInput);
      document.body.appendChild(form);
    };
    
    createHiddenForm();
    
    return () => {
      // Remover formulário quando componente for desmontado
      const existingForm = document.getElementById(formId);
      if (existingForm) {
        document.body.removeChild(existingForm);
      }
    };
  }, []);

  // Função para lidar com o clique na conta
  const handleAccountClick = (account: Account) => {
    if (activeAccount?.loginid === account.loginid) return;
    
    console.log(`CLIQUE NA CONTA: ${account.loginid} - Iniciando processo de confirmação...`);
    
    try {
      // Solução extrema: usar setTimeout para garantir que os alertas sejam exibidos
      setTimeout(() => {
        try {
          console.log("Tentando mostrar alertas...");
          // Primeiro exibir um alerta simples
          window.alert(`ATENÇÃO: Você está prestes a trocar para a conta ${account.loginid}`);
          
          // Depois pedir confirmação
          const confirmed = window.confirm(
            `Deseja trocar para a conta ${account.loginid}?\n\n` +
            "Essa ação irá recarregar a página e definir a nova conta como principal."
          );
          
          console.log(`Confirmação do usuário: ${confirmed}`);
          
          if (confirmed) {
            console.log("Confirmação aceita, preparando troca de conta...");
            prepareSwitchAccount(account);
          }
        } catch (e) {
          console.error("Erro ao mostrar alertas:", e);
        }
      }, 100);
    } catch (e) {
      console.error("Erro ao configurar timer para alertas:", e);
      
      // Tentar uma abordagem alternativa direta em caso de falha
      if (window.confirm(`Trocar para conta ${account.loginid}?`)) {
        prepareSwitchAccount(account);
      }
    }
  };
  
  const prepareSwitchAccount = (account: Account) => {
    try {
      setIsLoading(true);
      
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
            console.log(`Token encontrado para conta ${account.loginid}`);
          }
        } catch (error) {
          console.error('Erro ao processar contas:', error);
        }
      }
      
      // Verificar se encontramos um token
      if (!token) {
        console.error(`Token não encontrado para a conta ${account.loginid}`);
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
      
      // Animação de carregamento (opcional, se tiver tempo de aparecer)
      alert(`Redirecionando para a conta ${account.loginid}...`);
      
      // Usar o formulário para submeter e forçar o redirecionamento
      const form = document.getElementById(formId) as HTMLFormElement;
      const accountInput = document.getElementById('account-input') as HTMLInputElement;
      const timestampInput = document.getElementById('timestamp-input') as HTMLInputElement;
      
      if (form && accountInput && timestampInput) {
        accountInput.value = account.loginid;
        timestampInput.value = Date.now().toString();
        form.submit();
      } else {
        // Fallback para caso o formulário não exista
        window.location.href = `/dashboard?account=${account.loginid}&t=${Date.now()}`;
      }
      
    } catch (error) {
      console.error('Erro ao trocar de conta:', error);
      alert(`Erro ao trocar de conta: ${error}`);
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