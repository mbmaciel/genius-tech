import React, { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

export function AccountSwitcherWithModal() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accountToSwitch, setAccountToSwitch] = useState<Account | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

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

  // Função para abrir o modal de confirmação
  const handleAccountClick = (account: Account) => {
    console.log("Abrindo modal para conta:", account.loginid);
    setAccountToSwitch(account);
    setConfirmDialogOpen(true);
  };
  
  // Função executada quando o usuário confirma a troca de conta
  const confirmAccountSwitch = () => {
    if (accountToSwitch) {
      console.log("Confirmado troca para conta:", accountToSwitch.loginid);
      setConfirmDialogOpen(false);
      switchAccount(accountToSwitch);
    }
  };

  // Função que realiza a troca de conta após confirmação
  const switchAccount = async (account: Account) => {
    try {
      setIsLoading(true);
      console.log("Iniciando troca para conta:", account.loginid);
      
      // Obter token para a conta selecionada verificando múltiplas fontes
      let token: string | null = null;
      
      // Método 1: Tentar encontrar nos tokens por conta
      const accountsStr = localStorage.getItem('deriv_accounts');
      if (accountsStr) {
        try {
          const accounts = JSON.parse(accountsStr);
          const matchingAccount = accounts.find((acc: any) => acc.loginid === account.loginid);
          
          if (matchingAccount && matchingAccount.token) {
            token = matchingAccount.token;
            console.log(`[AccountSwitcher] Token encontrado para ${account.loginid} em deriv_accounts`);
          }
        } catch (error) {
          console.error('Erro ao processar accounts:', error);
        }
      }
      
      // Método 2: Tentar encontrar no formato específico se não foi encontrado anteriormente
      if (!token) {
        const accountTokenKey = `deriv_token_${account.loginid}`;
        token = localStorage.getItem(accountTokenKey);
        
        if (token) {
          console.log(`[AccountSwitcher] Token encontrado para ${account.loginid} em ${accountTokenKey}`);
        }
      }
      
      // Verificar se encontramos um token
      if (!token) {
        console.error(`[AccountSwitcher] Token não encontrado para a conta ${account.loginid}`);
        toast({
          title: "Erro ao trocar de conta",
          description: `Token não encontrado para ${account.loginid}. Faça login novamente.`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
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
      
      // MÉTODO EXTREMO DE RECARREGAMENTO
      console.log('[AccountSwitcher] 🚨 IMPLEMENTANDO MÉTODO RADICAL DE RECARREGAMENTO');
     
      // Criar elemento visual que mostra que estamos trocando de conta
      const switchingElement = document.createElement('div');
      switchingElement.style.position = 'fixed';
      switchingElement.style.top = '0';
      switchingElement.style.left = '0';
      switchingElement.style.width = '100%';
      switchingElement.style.height = '100%';
      switchingElement.style.backgroundColor = 'rgba(11, 20, 41, 0.9)';
      switchingElement.style.zIndex = '9999';
      switchingElement.style.display = 'flex';
      switchingElement.style.alignItems = 'center';
      switchingElement.style.justifyContent = 'center';
      switchingElement.style.flexDirection = 'column';
      switchingElement.style.color = 'white';
      switchingElement.style.fontSize = '24px';
      switchingElement.style.fontWeight = 'bold';
      switchingElement.innerHTML = `
        <div style="margin-bottom: 20px;">TROCANDO PARA CONTA ${account.loginid}</div>
        <div style="font-size: 18px; margin-bottom: 30px;">Desconectando todas as conexões e recarregando...</div>
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
      document.body.appendChild(switchingElement);
      
      // Configurar nova conta como principal
      console.log('[AccountSwitcher] Configurando nova conta como principal...');
      localStorage.setItem('deriv_active_loginid', account.loginid);
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('deriv_oauth_token', token);
      localStorage.setItem('account_switch_timestamp', Date.now().toString());
      localStorage.setItem('force_reconnect', 'true');
      localStorage.setItem('deriv_active_account', JSON.stringify({
        loginid: account.loginid,
        token: token,
        is_virtual: account.isVirtual,
        currency: account.currency,
        timestamp: Date.now(),
        active: true
      }));
      
      // SOLUÇÃO DEFINITIVA: Técnica "HardReload" combinando várias abordagens
      console.log('[AccountSwitcher] Aplicando SOLUÇÃO DEFINITIVA de recarregamento');
      
      // 1. Criar um código JavaScript que será executado em um iframe para forçar recarregamento
      const reloadScript = `
        <script>
          window.parent.location.href = window.parent.location.href.split('?')[0] + '?force_reload=true&t=' + Date.now();
        </script>
      `;
      
      // 2. Criar um iframe invisível que executará o script
      const iframe = document.createElement('iframe');
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.position = 'absolute';
      iframe.style.top = '-9999px';
      
      // Adicionar o iframe ao body
      document.body.appendChild(iframe);
      
      // 3. ABORDAGEM MÚLTIPLA - Execute todas as técnicas de recarregamento conhecidas
      try {
        // Método 1: Write no iframe para executar JavaScript que faz recarregamento
        if (iframe.contentWindow && iframe.contentWindow.document) {
          iframe.contentWindow.document.open();
          iframe.contentWindow.document.write(reloadScript);
          iframe.contentWindow.document.close();
        }
        
        // Método 2: Recarregar diretamente
        console.log('[AccountSwitcher] Executando método location.href com timestamp');
        
        // Forçar recarregamento depois de 100ms 
        setTimeout(() => {
          const timestamp = Date.now();
          window.location.href = window.location.href.split('?')[0] + 
            `?account=${account.loginid}&forcereload=true&t=${timestamp}`;
        }, 100);
        
        // Método 3: Usar o método mais extremo window.location.reload(true)
        setTimeout(() => {
          try {
            // @ts-ignore - O parâmetro true força ignorar o cache
            window.location.reload(true);
          } catch (e) {
            window.location.reload();
          }
        }, 300);
        
        // Método 4: Redirecionar para um URL diferente e voltar
        setTimeout(() => {
          const currentUrl = window.location.href;
          const tempUrl = window.location.href + '#temp';
          window.location.href = tempUrl;
          
          setTimeout(() => {
            window.location.href = currentUrl + '?t=' + Date.now();
          }, 50);
        }, 500);
      } catch (e) {
        console.error('[AccountSwitcher] Erro ao recarregar:', e);
        
        // Tenta recarregamento simples se tudo falhou
        window.location.reload();
      }
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
    <>
      {/* Modal de confirmação */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
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
                <li>Validar o token da nova conta</li>
                <li>Recarregar completamente a página</li>
                <li>Definir a nova conta como principal para todo o sistema</li>
              </ul>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-between mt-4">
            <Button 
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              className="border-gray-600 text-white hover:bg-gray-700"
            >
              Cancelar
            </Button>
            <Button 
              onClick={confirmAccountSwitch}
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

      {/* Interface do seletor de contas */}
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
                  onClick={() => activeAccount?.loginid !== account.loginid && handleAccountClick(account)}
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
    </>
  );
}