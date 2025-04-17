import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { oauthDirectService } from "@/services/oauthDirectService";

interface Account {
  loginid: string;
  token: string;
  currency: string;
  balance?: number;
  isVirtual?: boolean;
}

interface BotAccountSelectorProps {
  onAccountSelected: (account: Account) => void;
}

export function BotAccountSelector({ onAccountSelected }: BotAccountSelectorProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Carregar contas do localStorage
  useEffect(() => {
    try {
      const accountsStr = localStorage.getItem('deriv_accounts');
      
      if (accountsStr) {
        const parsedAccounts = JSON.parse(accountsStr);
        if (Array.isArray(parsedAccounts) && parsedAccounts.length > 0) {
          // Filtramos apenas contas com token válido
          const validAccounts = parsedAccounts
            .filter((acc: any) => acc.token && acc.loginid)
            .map((acc: any) => ({
              loginid: acc.loginid,
              token: acc.token,
              currency: acc.currency || 'USD',
              balance: acc.balance || 0,
              isVirtual: acc.loginid.startsWith('VRT') || acc.isVirtual
            }));
          
          setAccounts(validAccounts);
          
          // Definir a primeira conta como padrão se não houver seleção
          if (validAccounts.length > 0 && !selectedAccount) {
            setSelectedAccount(validAccounts[0].loginid);
            onAccountSelected(validAccounts[0]);
          }
        }
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Erro ao carregar contas:', error);
      setIsLoading(false);
    }
  }, []);

  // Lidar com a mudança de seleção
  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId);
    
    const selectedAcc = accounts.find(acc => acc.loginid === accountId);
    if (selectedAcc) {
      // Notificar o componente pai
      onAccountSelected(selectedAcc);
      
      // Definir a conta ativa no serviço de trading
      oauthDirectService.setActiveAccount(selectedAcc.loginid, selectedAcc.token);
    }
  };

  // Formatar nome da conta para exibição
  const formatAccountName = (account: Account) => {
    const name = `${account.loginid} (${account.currency})`;
    return account.isVirtual ? `${name} - Demo` : name;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Conta</CardTitle>
          <CardDescription>Carregando contas...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nenhuma conta encontrada</CardTitle>
          <CardDescription>Faça login na Deriv para operar</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => window.location.href = "/login"} 
            variant="default"
          >
            Fazer Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Conta para Operação</CardTitle>
        <CardDescription>Selecione a conta que deseja utilizar para o bot</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Select value={selectedAccount} onValueChange={handleAccountChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.loginid} value={account.loginid}>
                  <div className="flex items-center justify-between w-full">
                    <span>{formatAccountName(account)}</span>
                    {account.isVirtual && <Badge variant="outline" className="ml-2">Demo</Badge>}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedAccount && (
            <div className="pt-2 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Conta:</span>
                <span className="font-medium">{selectedAccount}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Moeda:</span>
                <span className="font-medium">
                  {accounts.find(a => a.loginid === selectedAccount)?.currency || 'USD'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">
                  {accounts.find(a => a.loginid === selectedAccount)?.isVirtual ? 'Demo' : 'Real'}
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}