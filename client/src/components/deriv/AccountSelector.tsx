import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { AccountInfo, oauthDirectService } from '@/services/oauthDirectService';
import { 
  LogIn, 
  LogOut, 
  RefreshCw, 
  UserPlus, 
  ChevronDown,
  Wallet,
  User,
  ExternalLink
} from 'lucide-react';

interface AccountSelectorProps {
  onAccountChange?: (account: AccountInfo | null) => void;
  className?: string;
  showBalance?: boolean;
}

export default function AccountSelector({
  onAccountChange,
  className = '',
  showBalance = true
}: AccountSelectorProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);

  // Inscrever-se para atualizações de contas
  useEffect(() => {
    const unsubscribe = oauthDirectService.onAccountsChange((newAccounts) => {
      setAccounts(newAccounts);
      const selected = oauthDirectService.getSelectedAccount();
      setSelectedAccount(selected);
      
      // Notificar componente pai se necessário
      if (onAccountChange) {
        onAccountChange(selected);
      }
    });
    
    return () => unsubscribe();
  }, [onAccountChange]);

  // Iniciar fluxo de autenticação OAuth
  const handleStartOAuth = () => {
    setLoading(true);
    
    try {
      const window = oauthDirectService.initiateOAuth();
      if (!window) {
        toast({
          title: t('Falha ao abrir janela de autenticação'),
          description: t('Verifique se os popups estão permitidos para este site'),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar OAuth:', error);
      toast({
        title: t('Erro de autenticação'),
        description: t('Ocorreu um erro ao tentar conectar com a Deriv'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
      setDialogOpen(false);
    }
  };

  // Selecionar uma conta
  const handleAccountSelect = async (loginid: string) => {
    if (loginid === selectedAccount?.loginid) return;
    
    setLoading(true);
    
    try {
      const success = await oauthDirectService.selectAccount(loginid);
      
      if (success) {
        const selected = oauthDirectService.getSelectedAccount();
        setSelectedAccount(selected);
        
        toast({
          title: t('Conta alterada'),
          description: t('Agora você está usando a conta {{account}}', { account: loginid }),
        });
        
        // Notificar componente pai se necessário
        if (onAccountChange) {
          onAccountChange(selected);
        }
      } else {
        toast({
          title: t('Falha ao trocar de conta'),
          description: t('Não foi possível selecionar a conta {{account}}', { account: loginid }),
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Erro ao selecionar conta:', error);
      toast({
        title: t('Erro'),
        description: t('Ocorreu um erro ao trocar de conta'),
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = () => {
    oauthDirectService.clearAllAccounts();
    toast({
      title: t('Desconectado'),
      description: t('Você foi desconectado da sua conta Deriv')
    });
    
    // Notificar componente pai se necessário
    if (onAccountChange) {
      onAccountChange(null);
    }
    
    setDialogOpen(false);
  };

  // Remover uma conta específica
  const handleRemoveAccount = (loginid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    oauthDirectService.removeAccount(loginid);
    
    toast({
      title: t('Conta removida'),
      description: t('A conta {{account}} foi removida', { account: loginid })
    });
  };

  // Renderizar o conteúdo do seletor
  const renderAccountSelector = () => {
    if (!accounts.length) {
      return (
        <Button 
          variant="outline" 
          className={`flex items-center ${className}`} 
          onClick={() => setDialogOpen(true)}
          disabled={loading}
        >
          <LogIn className="mr-2 h-4 w-4" />
          {t('Conectar Deriv')}
        </Button>
      );
    }

    return (
      <Select
        value={selectedAccount?.loginid}
        onValueChange={handleAccountSelect}
        disabled={loading}
      >
        <SelectTrigger className={`w-[210px] ${className}`}>
          <SelectValue>
            {selectedAccount ? (
              <div className="flex items-center">
                {selectedAccount.is_virtual ? (
                  <Badge variant="outline" className="mr-2 bg-orange-100 text-orange-800 hover:bg-orange-100">
                    {t('Demo')}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="mr-2 bg-green-100 text-green-800 hover:bg-green-100">
                    {t('Real')}
                  </Badge>
                )}
                <span className="font-medium">{selectedAccount.loginid}</span>
                {showBalance && selectedAccount.balance !== undefined && (
                  <span className="ml-2 text-muted-foreground">
                    {selectedAccount.balance} {selectedAccount.currency}
                  </span>
                )}
              </div>
            ) : (
              t('Selecionar conta')
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {accounts.map((account) => (
            <SelectItem 
              key={account.loginid} 
              value={account.loginid}
              className="relative py-3"
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex flex-col">
                  <div className="flex items-center">
                    {account.is_virtual ? (
                      <Badge variant="outline" className="mr-2 bg-orange-100 text-orange-800 hover:bg-orange-100">
                        {t('Demo')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="mr-2 bg-green-100 text-green-800 hover:bg-green-100">
                        {t('Real')}
                      </Badge>
                    )}
                    <span className="font-medium">{account.loginid}</span>
                  </div>
                  {account.landing_company_name && (
                    <span className="text-xs text-muted-foreground mt-1">
                      {account.landing_company_name}
                    </span>
                  )}
                </div>
                {showBalance && account.balance !== undefined && (
                  <span className="text-sm font-medium">
                    {account.balance} {account.currency}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
          <div className="flex justify-between p-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setDialogOpen(true)}
              className="w-full"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {t('Adicionar conta')}
            </Button>
          </div>
        </SelectContent>
      </Select>
    );
  };

  // Renderizar o componente
  return (
    <>
      {renderAccountSelector()}
      
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t('Gerenciar contas Deriv')}</DialogTitle>
            <DialogDescription>
              {t('Conecte-se à sua conta Deriv para operar com o robô')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {accounts.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm font-medium">
                  {t('Contas conectadas')}
                </div>
                {accounts.map((account) => (
                  <div 
                    key={account.loginid}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      selectedAccount?.loginid === account.loginid 
                        ? 'bg-muted' 
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => handleAccountSelect(account.loginid)}
                  >
                    <div className="flex items-center">
                      <div className="mr-3">
                        {account.is_virtual ? (
                          <Wallet className="h-10 w-10 text-orange-500 bg-orange-100 p-2 rounded-full" />
                        ) : (
                          <User className="h-10 w-10 text-green-500 bg-green-100 p-2 rounded-full" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center">
                          <span className="font-medium">{account.loginid}</span>
                          {account.is_virtual && (
                            <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-800 hover:bg-orange-100">
                              {t('Demo')}
                            </Badge>
                          )}
                        </div>
                        {account.name && (
                          <div className="text-sm text-muted-foreground">{account.name}</div>
                        )}
                        <div className="text-sm">
                          {account.balance !== undefined && (
                            <span className="font-medium">
                              {account.balance} {account.currency}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleRemoveAccount(account.loginid, e)}
                      title={t('Remover esta conta')}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                <div className="flex flex-col space-y-2 pt-4">
                  <Button 
                    onClick={handleStartOAuth}
                    disabled={loading}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('Adicionar outra conta')}
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={handleLogout}
                    disabled={loading}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('Remover todas as contas')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 space-y-4">
                <div className="text-center space-y-2">
                  <p>{t('Você ainda não tem nenhuma conta conectada')}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('Conecte-se à sua conta Deriv para usar o robô de trading')}
                  </p>
                </div>
                
                <Button 
                  className="w-full" 
                  onClick={handleStartOAuth}
                  disabled={loading}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {loading ? t('Conectando...') : t('Conectar conta Deriv')}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}