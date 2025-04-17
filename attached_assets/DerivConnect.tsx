import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, LogOut, Bug, Key } from 'lucide-react';
import { initiateOAuthLogin, removeAllTokens } from '@/lib/oauthProcessor';
import derivAPI from '@/lib/derivApi';
import * as tokenBlocklist from '@/lib/tokenBlocklist';

type AccountInfo = {
  loginid?: string;
  email?: string;
  currency?: string;
  balance?: number | { balance: number, currency: string };
  name?: string;
  is_virtual?: boolean;
  landing_company_name?: string;
};

export function DerivConnect() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({});
  const [error, setError] = useState('');
  const [showAccounts, setShowAccounts] = useState(false);
  const [availableAccounts, setAvailableAccounts] = useState<any[]>([]);

  // Verificar status de conexão atual
  useEffect(() => {
    // Função para expor tokens no console (como solicitado)
    const exposeTokensToConsole = () => {
      try {
        // Obter tokens em diferentes formatos para compatibilidade
        const tokenList = JSON.parse(localStorage.getItem('tokenList') || '[]');
        const userAccounts = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
        
        // Mostrar no console formatado como no exemplo
        console.log('tokens');
        console.log(tokenList.length > 0 ? tokenList : userAccounts);
        
        // Se houver informações de usuário local, mostrar também
        const userData = localStorage.getItem('user_data');
        if (userData) {
          try {
            const parsedUserData = JSON.parse(userData);
            console.log(parsedUserData);
          } catch (e) {
            // Ignorar erro de parsing
          }
        }
      } catch (e) {
        console.error('Erro ao expor tokens:', e);
      }
    };
    
    const checkConnection = async () => {
      try {
        setIsLoading(true);
        
        // Verificar se já existe uma conexão ativa
        const isConnected = derivAPI.getConnectionStatus();
        setIsConnected(isConnected);
        
        if (isConnected) {
          // Obter informações da conta atual
          const info = derivAPI.getAccountInfo();
          console.log('Informações da conta:', info);
          setAccountInfo(info || {});
          
          // Carregar lista de contas disponíveis
          const accounts = info.account_list || [];
          if (Array.isArray(accounts) && accounts.length > 0) {
            setAvailableAccounts(accounts);
          }
          
          // Expor tokens no console após conexão bem-sucedida
          exposeTokensToConsole();
        }
      } catch (err: any) {
        console.error('Erro ao verificar conexão:', err);
        setError(err.message || 'Erro desconhecido ao verificar conexão');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Expor tokens imediatamente independente da conexão
    exposeTokensToConsole();
    
    // Verificar conexão
    checkConnection();
    
    // Adicionar evento para inspecionar objeto global
    window.addEventListener('click', (e) => {
      if (e.altKey && e.ctrlKey) {
        console.log('Tokens ativos:');
        exposeTokensToConsole();
      }
    });
    
  }, []);

  // Função para iniciar login OAuth
  const handleLogin = () => {
    setIsLoading(true);
    try {
      initiateOAuthLogin();
    } catch (err: any) {
      setError(err.message || 'Erro ao iniciar login OAuth');
      setIsLoading(false);
    }
  };

  // Função para desconectar
  const handleLogout = async () => {
    setIsLoading(true);
    try {
      // Desconectar da API
      await derivAPI.disconnect(true);
      
      // Remover todos os tokens
      removeAllTokens();
      
      // Resetar estado
      setIsConnected(false);
      setAccountInfo({});
      setAvailableAccounts([]);
      
      // Recarregar a página para garantir que tudo seja limpo
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Erro ao desconectar');
      setIsLoading(false);
    }
  };

  // Obter o tipo de conta para exibição
  const getAccountType = (loginid?: string, isVirtual?: boolean): string => {
    if (!loginid) return 'Desconhecido';
    
    if (isVirtual || loginid.startsWith('VRT')) return 'Demo';
    if (loginid.startsWith('CR')) return 'Crypto';
    if (loginid.includes('MLT')) return 'Malta';
    return 'Real';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Conexão Deriv
          {isConnected && 
            <Badge className="ml-2 bg-green-500">Conectado</Badge>
          }
        </CardTitle>
        <CardDescription>
          {isConnected 
            ? 'Você está conectado com sua conta Deriv'
            : 'Conecte-se com sua conta Deriv para começar a operar'
          }
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="ml-2">Carregando...</span>
          </div>
        ) : isConnected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID da Conta</p>
                <p className="font-medium">{accountInfo.loginid || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tipo</p>
                <p className="font-medium">{getAccountType(accountInfo.loginid, accountInfo.is_virtual)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Moeda</p>
                <p className="font-medium">{accountInfo.currency || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Saldo</p>
                <p className="font-medium">
                  {typeof accountInfo.balance === 'object' 
                    ? `${accountInfo.balance.balance} ${accountInfo.balance.currency}`
                    : accountInfo.balance !== undefined 
                      ? `${accountInfo.balance} ${accountInfo.currency || ''}`
                      : 'N/A'
                  }
                </p>
              </div>
            </div>
            
            {availableAccounts.length > 0 && (
              <div>
                <div 
                  className="text-sm font-medium text-primary cursor-pointer flex items-center mt-4"
                  onClick={() => setShowAccounts(!showAccounts)}
                >
                  {showAccounts ? 'Ocultar' : 'Mostrar'} contas disponíveis ({availableAccounts.length})
                </div>
                
                {showAccounts && (
                  <div className="mt-2 space-y-2">
                    {availableAccounts.map((acc: any, index) => (
                      <div key={index} className="p-2 bg-muted rounded-md text-sm">
                        <div className="flex justify-between items-center">
                          <span>{acc.loginid}</span>
                          <Badge>
                            {getAccountType(acc.loginid, acc.is_virtual)}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {acc.currency || 'Sem moeda'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Faça login com sua conta Deriv para acessar todas as funcionalidades da plataforma.
            </p>
            
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-3">
        <div className="flex justify-between w-full">
          {isConnected ? (
            <Button 
              variant="destructive" 
              onClick={handleLogout}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
              Desconectar
            </Button>
          ) : (
            <Button 
              onClick={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
              Conectar com Deriv
            </Button>
          )}
          
          {isConnected && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/api-debug'}
            >
              <Bug className="h-4 w-4 mr-2" />
              Depurador de Tokens
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}