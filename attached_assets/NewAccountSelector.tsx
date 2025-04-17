import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RefreshCw } from "lucide-react";
import derivAPI from "@/lib/derivApi";
import { toast } from "@/hooks/use-toast";

type Account = {
  account: string;
  loginid?: string;
  currency: string;
  isVirtual?: boolean;
  accountType?: string;
  balance?: number;
};

type AccountSelectorProps = {
  onAccountChanged?: (account: Account) => void;
  className?: string;
};

export function NewAccountSelector({ onAccountChanged, className }: AccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean>(false);

  // Função para carregar contas disponíveis
  const loadAccounts = async () => {
    try {
      // Obter contas diretamente da API Deriv
      // Obter informações de autorização, que incluem a lista de contas
      const authResponse = await derivAPI.send({ authorize: derivAPI.getToken() });
      console.log("Resposta de autorização:", authResponse);
      
      if (authResponse?.authorize?.account_list && authResponse.authorize.account_list.length > 0) {
        // Transformar os dados da API para o formato esperado pelo seletor
        const apiAccounts = authResponse.authorize.account_list.map((acc: any) => ({
          account: acc.loginid,
          loginid: acc.loginid,
          currency: acc.currency || "USD",
          isVirtual: acc.loginid.startsWith("VRTC"),
          accountType: acc.loginid.startsWith("VRTC") ? "Demo" : "Real",
          balance: acc.balance
        }));
        
        console.log("Contas disponíveis:", apiAccounts);
        setAccounts(apiAccounts);
        
        // Definir a conta atual como selecionada
        const currentAccountId = localStorage.getItem('deriv_active_account');
        if (currentAccountId) {
          setSelectedAccount(currentAccountId);
        } else if (apiAccounts.length > 0) {
          setSelectedAccount(apiAccounts[0].account);
        }
      } else {
        // Se não conseguir obter contas da API, tente o localStorage
        const storedAccounts = localStorage.getItem("deriv_accounts");
        if (storedAccounts) {
          try {
            const parsedAccounts = JSON.parse(storedAccounts);
            if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
              setAccounts(parsedAccounts);
              
              // Definir a conta atual como selecionada
              const currentAccountId = localStorage.getItem("deriv_active_account");
              if (currentAccountId) {
                setSelectedAccount(currentAccountId);
              } else {
                setSelectedAccount(parsedAccounts[0].account);
              }
            }
          } catch (error) {
            console.error("Erro ao processar contas do localStorage:", error);
          }
        }
      }
    } catch (error) {
      console.error("Erro ao carregar contas:", error);
    }
  };

  // Carregar contas ao montar o componente
  useEffect(() => {
    loadAccounts();
  }, []);

  // Função para trocar de conta usando o novo componente
  const switchAccount = async () => {
    if (!selectedAccount) {
      setError("Nenhuma conta selecionada");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Vamos usar um método mais simplificado para troca de contas
      // Importar o módulo dinamicamente para evitar referência circular
      try {
        const { switchToAccount } = await import("@/lib/accountSwitcher");
        
        // Mostrar toast informativo
        toast({
          title: "Trocando de conta...",
          description: `Conectando à conta ${selectedAccount} sem interromper a conexão`,
        });
        
        // Verificar se existe um token para a conta selecionada
        const tokenKey1 = `deriv_verified_token_${selectedAccount}`;
        const tokenKey2 = `deriv_token_${selectedAccount.toLowerCase()}`;
        
        // Verificar em múltiplos locais de armazenamento
        const hasToken = localStorage.getItem(tokenKey1) || 
                         localStorage.getItem(tokenKey2);
                         
        if (!hasToken) {
          // Verificar se existe no mapa de tokens
          try {
            const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
            const hasInMap = tokenMap[selectedAccount] || tokenMap[selectedAccount.toLowerCase()];
            
            if (!hasInMap) {
              // Avisar o usuário e pedir para reconectar
              toast({
                title: "Token não encontrado",
                description: `É necessário conectar-se primeiro com a conta ${selectedAccount} para obter um token válido.`,
                variant: "destructive",
              });
              return;
            }
          } catch (e) {
            console.error("Erro ao verificar mapa de tokens:", e);
          }
        }
        
        // Chamar a função para trocar de conta forçando reconexão
        const switchResult = await switchToAccount(selectedAccount, true);
        
        if (!switchResult.success) {
          throw new Error(switchResult.error || `Falha ao trocar para a conta ${selectedAccount}`);
        }
        
        // Encontrar o objeto da conta com todas as informações
        const accountToSwitch = accounts.find(
          (acc: Account) => acc.account === selectedAccount || acc.loginid === selectedAccount
        );
        
        if (!accountToSwitch) {
          console.warn(`Conta ${selectedAccount} não encontrada na lista, usando informações básicas`);
          
          // Usar informações básicas da resposta
          if (onAccountChanged) {
            onAccountChanged({
              account: selectedAccount,
              currency: switchResult.currency || "USD",
              isVirtual: selectedAccount.toLowerCase().startsWith("vrtc"),
              balance: switchResult.balance || 0
            });
          }
        } else {
          // Notificar alteração com o objeto completo da conta
          if (onAccountChanged) {
            onAccountChanged(accountToSwitch);
          }
        }
        
        // Mostrar toast de sucesso
        toast({
          title: "Conta alterada",
          description: `Agora conectado à conta ${selectedAccount}`,
        });
        
        // Fechar o diálogo
        setOpen(false);
        
        // Restaurar subscriptions sem recarregar a página
        setTimeout(() => {
          try {
            console.log("Restaurando assinaturas após troca de conta...");
            
            // Resubscrever ao saldo
            derivAPI.subscribeToBalanceUpdates()
              .then(() => console.log("Assinatura de saldo restaurada"))
              .catch(e => console.error("Erro ao restaurar assinatura de saldo:", e));
            
            // Resubscrever aos ticks se necessário
            derivAPI.subscribeTicks("R_100")
              .then(() => console.log("Assinatura de ticks R_100 restaurada"))
              .catch(e => console.error("Erro ao restaurar assinatura de ticks:", e));
              
            // Atualizar lista de contas disponíveis
            loadAccounts();
          } catch (e) {
            console.error("Erro ao restaurar estado após troca de conta:", e);
          }
        }, 1000);
        
      } catch (importError: any) {
        console.error("Erro ao importar accountSwitcher:", importError);
        throw new Error(`Erro ao carregar módulo de troca de contas: ${importError?.message || 'Erro desconhecido'}`);
      }
    } catch (error: any) {
      console.error("Erro ao trocar conta:", error);
      setError(error.message || "Erro desconhecido ao trocar de conta");
      
      toast({
        title: "Erro ao trocar de conta",
        description: error.message || "Não foi possível trocar para a conta selecionada",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 text-xs"
          >
            {accounts.find((acc: Account) => acc.account === selectedAccount)?.account || "Selecionar Conta"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Selecione uma Conta</DialogTitle>
            <DialogDescription>
              Escolha entre suas contas Deriv disponíveis
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="flex items-center gap-2">
              <Select
                value={selectedAccount}
                onValueChange={setSelectedAccount}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem
                      key={account.account}
                      value={account.account}
                    >
                      <div className="flex items-center gap-2">
                        <span>{account.account}</span>
                        <span className="text-muted-foreground">
                          ({account.currency})
                        </span>
                        {account.isVirtual && (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                            Demo
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={loadAccounts}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            {error && (
              <div className="text-sm text-red-500 mt-2">{error}</div>
            )}
            
            <div className="flex justify-end space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button
                onClick={switchAccount}
                disabled={isLoading || !selectedAccount}
              >
                {isLoading ? "Trocando..." : "Trocar Conta"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}