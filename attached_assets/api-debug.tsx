import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { derivAPI } from '@/lib/derivApi';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, ArrowUp, CheckCircle, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TokenDebugInfo {
  key: string;
  value: string;
  type: 'main' | 'verified' | 'simple' | 'map' | 'oauth';
  account?: string;
}

export default function ApiDebugPage() {
  const [tokens, setTokens] = useState<TokenDebugInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<boolean>(false);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);

  // Carregar status de conexão
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = derivAPI.isConnected;
      setConnectionStatus(isConnected);

      // Obter conta ativa
      try {
        const accountInfo = derivAPI.getAccountInfo();
        if (accountInfo && accountInfo.loginId) {
          setActiveAccount(accountInfo.loginId);
        } else {
          setActiveAccount(null);
        }
      } catch (e) {
        setActiveAccount(null);
      }
    };

    checkConnection();
    
    // Verificar a cada 5 segundos
    const interval = setInterval(checkConnection, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Carregar tokens armazenados
  const loadAllTokens = () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const tokenList: TokenDebugInfo[] = [];
      
      // 1. Token principal
      const mainToken = localStorage.getItem('deriv_api_token');
      if (mainToken) {
        tokenList.push({
          key: 'deriv_api_token',
          value: mainToken,
          type: 'main'
        });
      }
      
      // 2. Verificar tokens no formato deriv_verified_token_XXX
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        if (key.startsWith('deriv_verified_token_')) {
          const accountId = key.replace('deriv_verified_token_', '');
          const token = localStorage.getItem(key);
          if (token) {
            tokenList.push({
              key,
              value: token,
              type: 'verified',
              account: accountId
            });
          }
        } else if (key.startsWith('deriv_token_')) {
          const accountId = key.replace('deriv_token_', '');
          const token = localStorage.getItem(key);
          if (token) {
            tokenList.push({
              key,
              value: token,
              type: 'simple',
              account: accountId
            });
          }
        }
      }
      
      // 3. Verificar no formato de mapa de tokens
      try {
        const tokenMapStr = localStorage.getItem('deriv_account_token_map');
        if (tokenMapStr) {
          const tokenMap = JSON.parse(tokenMapStr);
          if (tokenMap && typeof tokenMap === 'object') {
            for (const [account, token] of Object.entries(tokenMap)) {
              if (typeof token === 'string') {
                tokenList.push({
                  key: `deriv_account_token_map[${account}]`,
                  value: token,
                  type: 'map',
                  account
                });
              }
            }
          }
        }
      } catch (e) {
        console.error('Erro ao processar mapa de tokens:', e);
      }
      
      // 4. Verificar na lista de contas OAuth
      try {
        const userAccountsStr = localStorage.getItem('deriv_user_accounts');
        if (userAccountsStr) {
          const accounts = JSON.parse(userAccountsStr);
          if (Array.isArray(accounts)) {
            accounts.forEach((acc: any, index: number) => {
              if (acc && acc.token && (acc.account || acc.accountName)) {
                const account = acc.account || acc.accountName;
                tokenList.push({
                  key: `deriv_user_accounts[${index}]`,
                  value: acc.token,
                  type: 'oauth',
                  account
                });
              }
            });
          }
        }
      } catch (e) {
        console.error('Erro ao processar lista de contas:', e);
      }
      
      setTokens(tokenList);
      
      // Também exibir no console
      console.error('================= TOKENS DEBUG =================');
      tokenList.forEach(token => {
        console.error(`[TOKEN] ${token.key} (${token.type}): ${token.value.substring(0, 10)}...`);
      });
      console.error('===============================================');
      
    } catch (err: any) {
      console.error('Erro ao carregar tokens:', err);
      setError(err.message || 'Erro ao carregar tokens');
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar tokens ao iniciar
  useEffect(() => {
    loadAllTokens();
  }, []);

  // Copiar token para a área de transferência
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Token copiado para área de transferência!');
      })
      .catch(err => {
        console.error('Erro ao copiar:', err);
      });
  };

  // Limpar todos os tokens
  const clearAllTokens = () => {
    if (window.confirm('Tem certeza que deseja remover TODOS os tokens?')) {
      try {
        // Primeiro, listar todas as chaves relacionadas a tokens
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key === 'deriv_api_token' ||
            key === 'deriv_account_token_map' ||
            key === 'deriv_user_accounts' ||
            key === 'tokenList' ||
            key.startsWith('deriv_token_') ||
            key.startsWith('deriv_verified_token_')
          )) {
            keysToRemove.push(key);
          }
        }
        
        // Remover cada chave
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        // Recarregar lista
        loadAllTokens();
        alert(`${keysToRemove.length} tokens removidos com sucesso!`);
      } catch (err: any) {
        console.error('Erro ao limpar tokens:', err);
        setError(err.message || 'Erro ao limpar tokens');
      }
    }
  };

  // Exibir debug de conexão avançado
  const showConnectionDebug = () => {
    try {
      console.error('============= DEBUG DE CONEXÃO =============');
      console.error(`Status de conexão WebSocket: ${derivAPI.isConnected ? 'Conectado' : 'Desconectado'}`);
      
      if (derivAPI.isConnected) {
        console.error(`Conta ativa: ${activeAccount || 'Nenhuma'}`);
        
        const accountInfo = derivAPI.getAccountInfo();
        console.error('Informações da conta:', accountInfo);
      }
      
      console.error('===========================================');
    } catch (e) {
      console.error('Erro ao mostrar debug de conexão:', e);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Debugger da API Deriv</h1>
        <p className="text-muted-foreground">Ferramenta para visualizar e gerenciar tokens da API</p>
      </div>
      
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Status de Conexão</CardTitle>
            <CardDescription>Estado atual da conexão com a API Deriv</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <div className={`w-3 h-3 rounded-full ${connectionStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{connectionStatus ? 'Conectado' : 'Desconectado'}</span>
            </div>
            
            {activeAccount && (
              <div className="mt-2">
                <Badge variant="outline" className="text-primary">
                  Conta ativa: {activeAccount}
                </Badge>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={showConnectionDebug}
            >
              Debug Detalhado
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
            <CardDescription>Opções para gerenciar tokens</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Button 
                variant="outline" 
                onClick={loadAllTokens} 
                disabled={isLoading}
                className="justify-start"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar Lista de Tokens
              </Button>
              
              <Button 
                variant="destructive" 
                onClick={clearAllTokens} 
                disabled={isLoading}
                className="justify-start"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Limpar Todos os Tokens
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card>
        <CardHeader>
          <CardTitle>
            Tokens Armazenados
            {tokens.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {tokens.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Lista de todos os tokens da API Deriv armazenados no navegador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              {isLoading ? 'Carregando tokens...' : 'Nenhum token encontrado'}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Token principal */}
              {tokens.filter(t => t.type === 'main').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Token Principal</h3>
                  <div className="space-y-2">
                    {tokens.filter(t => t.type === 'main').map((token, index) => (
                      <div key={`main-${index}`} className="flex items-center justify-between p-2 bg-card border rounded-md">
                        <div>
                          <div className="font-mono text-sm">{token.value.substring(0, 15)}...</div>
                          <div className="text-xs text-muted-foreground">{token.key}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.value)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Separator />
              
              {/* Tokens verificados */}
              {tokens.filter(t => t.type === 'verified').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Tokens Verificados</h3>
                  <div className="space-y-2">
                    {tokens.filter(t => t.type === 'verified').map((token, index) => (
                      <div key={`verified-${index}`} className="flex items-center justify-between p-2 bg-card border rounded-md">
                        <div>
                          <div className="font-mono text-sm">{token.value.substring(0, 15)}...</div>
                          <div className="text-xs text-muted-foreground">{token.key}</div>
                          {token.account && (
                            <Badge variant="outline" className="mt-1">
                              {token.account}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.value)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {tokens.filter(t => t.type === 'simple').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Tokens Simples</h3>
                  <div className="space-y-2">
                    {tokens.filter(t => t.type === 'simple').map((token, index) => (
                      <div key={`simple-${index}`} className="flex items-center justify-between p-2 bg-card border rounded-md">
                        <div>
                          <div className="font-mono text-sm">{token.value.substring(0, 15)}...</div>
                          <div className="text-xs text-muted-foreground">{token.key}</div>
                          {token.account && (
                            <Badge variant="outline" className="mt-1">
                              {token.account}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.value)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {tokens.filter(t => t.type === 'map').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Mapa de Tokens</h3>
                  <div className="space-y-2">
                    {tokens.filter(t => t.type === 'map').map((token, index) => (
                      <div key={`map-${index}`} className="flex items-center justify-between p-2 bg-card border rounded-md">
                        <div>
                          <div className="font-mono text-sm">{token.value.substring(0, 15)}...</div>
                          <div className="text-xs text-muted-foreground">{token.key}</div>
                          {token.account && (
                            <Badge variant="outline" className="mt-1">
                              {token.account}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.value)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {tokens.filter(t => t.type === 'oauth').length > 0 && (
                <div>
                  <h3 className="font-medium mb-2">Tokens OAuth</h3>
                  <div className="space-y-2">
                    {tokens.filter(t => t.type === 'oauth').map((token, index) => (
                      <div key={`oauth-${index}`} className="flex items-center justify-between p-2 bg-card border rounded-md">
                        <div>
                          <div className="font-mono text-sm">{token.value.substring(0, 15)}...</div>
                          <div className="text-xs text-muted-foreground">{token.key}</div>
                          {token.account && (
                            <Badge variant="outline" className="mt-1">
                              {token.account}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(token.value)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button 
            variant="outline" 
            onClick={loadAllTokens} 
            disabled={isLoading}
            className="w-full"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Carregando...' : 'Atualizar Tokens'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}