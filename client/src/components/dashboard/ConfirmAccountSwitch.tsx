import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import derivAPI from '@/lib/derivApi';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Account {
  loginid: string;
  isVirtual?: boolean;
  currency?: string;
}

export function ConfirmAccountSwitch() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accountToSwitch, setAccountToSwitch] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);

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

    // Configurar listener para o evento personalizado
    const handleAccountSwitchRequest = (event: CustomEvent) => {
      if (event.detail && event.detail.account) {
        console.log('Evento de solicitação de troca recebido:', event.detail.account);
        setAccountToSwitch(event.detail.account);
        setIsOpen(true);
      }
    };

    // Adicionar o listener
    document.addEventListener('account:switch:request' as any, handleAccountSwitchRequest as any);

    // Remover listener quando o componente for desmontado
    return () => {
      document.removeEventListener('account:switch:request' as any, handleAccountSwitchRequest as any);
    };
  }, []);

  // Função para executar a troca de conta após confirmação do usuário
  const confirmSwitchAccount = async () => {
    if (!accountToSwitch) return;
    
    try {
      setIsLoading(true);
      
      // Fechar o modal antes de iniciar o processo
      setIsOpen(false);
      
      // Obter token para a conta selecionada
      let token: string | null = null;
      
      // Buscar token nas contas armazenadas
      const accountsStr = localStorage.getItem('deriv_accounts');
      if (accountsStr) {
        try {
          const accounts = JSON.parse(accountsStr);
          const matchingAccount = accounts.find((acc: any) => acc.loginid === accountToSwitch.loginid);
          
          if (matchingAccount && matchingAccount.token) {
            token = matchingAccount.token;
            console.log(`Token encontrado para conta ${accountToSwitch.loginid}`);
          }
        } catch (error) {
          console.error('Erro ao processar contas:', error);
        }
      }
      
      // Verificar se encontramos um token
      if (!token) {
        console.error(`Token não encontrado para a conta ${accountToSwitch.loginid}`);
        toast({
          title: "Erro ao trocar de conta",
          description: `Token não encontrado para ${accountToSwitch.loginid}. Faça login novamente.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Mostrar feedback visual da troca de conta
      toast({
        title: "Trocando de conta",
        description: `Preparando para trocar para conta ${accountToSwitch.loginid}...`,
        variant: "default",
      });
      
      // Salvar informações da nova conta no localStorage
      localStorage.setItem('deriv_active_loginid', accountToSwitch.loginid);
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('deriv_oauth_token', token);
      localStorage.setItem('account_switch_timestamp', Date.now().toString());
      localStorage.setItem('force_reconnect', 'true');
      
      // Criar objeto com informações da conta ativa
      const activeAccountData = {
        loginid: accountToSwitch.loginid,
        token: token,
        is_virtual: accountToSwitch.isVirtual,
        currency: accountToSwitch.currency,
        timestamp: Date.now(),
        active: true
      };
      
      // Salvar como conta ativa
      localStorage.setItem('deriv_active_account', JSON.stringify(activeAccountData));
      
      // Mostrar animação de carregamento em tela cheia
      const overlayElement = document.createElement('div');
      overlayElement.style.position = 'fixed';
      overlayElement.style.top = '0';
      overlayElement.style.left = '0';
      overlayElement.style.width = '100%';
      overlayElement.style.height = '100%';
      overlayElement.style.backgroundColor = 'rgba(11, 20, 41, 0.95)';
      overlayElement.style.zIndex = '9999';
      overlayElement.style.display = 'flex';
      overlayElement.style.flexDirection = 'column';
      overlayElement.style.alignItems = 'center';
      overlayElement.style.justifyContent = 'center';
      overlayElement.style.color = 'white';
      overlayElement.style.fontSize = '24px';
      overlayElement.style.fontWeight = 'bold';
      
      overlayElement.innerHTML = `
        <div style="margin-bottom: 20px;">TROCANDO PARA CONTA ${accountToSwitch.loginid}</div>
        <div style="font-size: 18px; margin-bottom: 30px;">A página será recarregada em instantes...</div>
        <div style="width: 60px; height: 60px; border: 5px solid #1E3A8A; border-top: 5px solid #00E5B3; border-radius: 50%; animation: spin 1s linear infinite;"></div>
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
      document.body.appendChild(overlayElement);
      
      // Forçar recarregamento da página depois de um breve delay
      setTimeout(() => {
        try {
          // Método 1: Criar uma URL com parâmetros para evitar cache
          const url = new URL(window.location.href);
          url.searchParams.set('account', accountToSwitch.loginid);
          url.searchParams.set('t', Date.now().toString());
          window.location.href = url.toString();
          
          // Método 2 como backup (em caso de falha do primeiro)
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } catch (e) {
          console.error('Erro ao recarregar página:', e);
          window.location.reload();
        }
      }, 1000);
      
    } catch (error) {
      console.error('Erro ao trocar de conta:', error);
      toast({
        title: "Erro ao trocar de conta",
        description: String(error),
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-[#162746] border-[#1c3654] text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center">
            <AlertCircle className="h-6 w-6 text-yellow-500 mr-2" />
            Confirmar troca de conta
          </DialogTitle>
          <DialogDescription className="text-gray-300">
            Você está prestes a trocar para a conta{' '}
            <span className="font-bold text-[#00e5b3]">{accountToSwitch?.loginid}</span>.
            <br /><br />
            Esta operação irá:
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Desconectar todas as conexões atuais</li>
              <li>Recarregar completamente a página</li>
              <li>Definir a nova conta como principal para todo o sistema</li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between mt-4">
          <Button 
            variant="outline"
            onClick={() => setIsOpen(false)}
            className="border-gray-600 text-white hover:bg-gray-700"
          >
            Cancelar
          </Button>
          <Button 
            onClick={confirmSwitchAccount}
            className="bg-[#00e5b3] text-[#0e1a33] hover:bg-[#00c99f] hover:text-[#0e1a33]"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="mr-2">Processando</span>
                <span className="h-4 w-4 border-2 border-t-transparent border-white rounded-full animate-spin"></span>
              </>
            ) : (
              <>Confirmar troca</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}