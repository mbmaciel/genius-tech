import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertCircle, 
  RefreshCw, 
  Key, 
  Save, 
  Trash2, 
  Shield, 
  Copy,
  CheckCircle,
  FileWarning
} from 'lucide-react';
import derivAPI from '@/lib/derivApi';

interface AccountToken {
  account: string;
  token: string;
  currency: string;
  isVirtual?: boolean;
  accountType?: string;
  lastUsed?: string;
  isActive?: boolean;
}

export default function TokenManager() {
  const [open, setOpen] = useState(false);
  const [tokens, setTokens] = useState<AccountToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState('');
  const [newToken, setNewToken] = useState('');
  const [newCurrency, setNewCurrency] = useState('USD');
  const [isSaving, setIsSaving] = useState(false);
  
  // Dados da conta atual conectada
  const [currentAccount, setCurrentAccount] = useState<string | null>(null);
  
  // Função para exibir todos os tokens no console
  const showAllTokensInConsole = () => {
    console.log('[TokenDebug] ========= TOKENS EM TOKENMANAGER =========');
    
    // 1. Token principal
    const mainToken = localStorage.getItem('deriv_api_token');
    console.log('[TokenDebug] Token principal:', mainToken || 'Não encontrado');
    
    // 2. Verificar tokens no formato deriv_verified_token_XXX
    const verifiedTokens: Record<string, string> = {};
    // 3. Verificar tokens no formato deriv_token_XXX (minúsculo)
    const simpleTokens: Record<string, string> = {};
    
    // Iterar por todas as chaves no localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.startsWith('deriv_verified_token_')) {
        const accountId = key.replace('deriv_verified_token_', '');
        verifiedTokens[accountId] = localStorage.getItem(key) || '';
      } else if (key.startsWith('deriv_token_')) {
        const accountId = key.replace('deriv_token_', '');
        simpleTokens[accountId] = localStorage.getItem(key) || '';
      }
    }
    
    // Exibir tokens verificados
    console.log('[TokenDebug] Tokens verificados por conta:');
    Object.entries(verifiedTokens).forEach(([accountId, token]) => {
      console.log(`[TokenDebug] → Conta ${accountId}: ${token}`);
    });
    
    // Exibir tokens simples
    console.log('[TokenDebug] Tokens simples por conta:');
    Object.entries(simpleTokens).forEach(([accountId, token]) => {
      console.log(`[TokenDebug] → Conta ${accountId}: ${token}`);
    });
    
    // 4. Verificar no formato de mapa de tokens
    try {
      const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
      console.log('[TokenDebug] Token map:', tokenMap);
    } catch (e) {
      console.log('[TokenDebug] Erro ao processar mapa de tokens:', e);
    }
    
    // 5. Verificar na lista de contas
    try {
      const accountList = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
      console.log('[TokenDebug] Lista de contas com tokens:');
      accountList.forEach((account: any, index: number) => {
        console.log(`[TokenDebug] → Conta ${index + 1}: ${account.accountName || account.account}, Token: ${account.token}`);
      });
    } catch (e) {
      console.log('[TokenDebug] Erro ao processar lista de contas:', e);
    }
    
    console.log('[TokenDebug] ========================================');
  };

  useEffect(() => {
    if (open) {
      loadTokens();
      
      // Obter conta atual
      try {
        const accountInfo = derivAPI.getAccountInfo();
        if (accountInfo && accountInfo.loginId) {
          setCurrentAccount(accountInfo.loginId);
        }
      } catch (err) {
        console.error('Erro ao obter conta atual:', err);
      }
      
      // Exibir tokens no console
      showAllTokensInConsole();
    }
  }, [open]);
  
  // Expor função para depuração no console global
  useEffect(() => {
    (window as any).showDeriveTokens = showAllTokensInConsole;
  }, []);
  
  // Carregar tokens de todas as fontes possíveis
  const loadTokens = () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const loadedTokens: AccountToken[] = [];
      let mainToken: string | null = null;
      let mainAccount: string | null = null;
      
      // 1. Verificar token principal
      mainToken = localStorage.getItem('deriv_api_token');
      mainAccount = localStorage.getItem('deriv_active_account');
      
      // Mostrar os tokens completos no console para depuração
      console.log('[TokenDebug] Token principal:', mainToken || 'não encontrado');
      console.log('[TokenDebug] Conta principal:', mainAccount || 'não definida');
      
      // Exibir todos os tokens armazenados
      showAllTokensInConsole();
      
      // 2. Verificar contas do OAuth
      const userAccountsStr = localStorage.getItem('deriv_user_accounts');
      if (userAccountsStr) {
        try {
          const accounts = JSON.parse(userAccountsStr);
          console.log(`[TokenDebug] Contas OAuth (${accounts.length}):`, accounts);
          
          if (Array.isArray(accounts)) {
            accounts.forEach((acc: any) => {
              if (acc && acc.account && acc.token) {
                const isVirtual = typeof acc.account === 'string' && 
                  acc.account.toUpperCase().startsWith('VRTC');
                
                let accountType = 'Real';
                if (isVirtual) accountType = 'Demo';
                else if (acc.account.startsWith('CR')) accountType = 'Crypto';
                else if (acc.account.includes('MLT')) accountType = 'Malta';
                
                loadedTokens.push({
                  account: acc.account,
                  token: acc.token,
                  currency: acc.currency || 'USD',
                  isVirtual,
                  accountType,
                  isActive: mainAccount === acc.account
                });
              }
            });
          }
        } catch (err) {
          console.error('Erro ao processar contas OAuth:', err);
        }
      }
      
      // 3. Verificar mapa de tokens
      const tokenMapStr = localStorage.getItem('deriv_account_tokens');
      if (tokenMapStr) {
        try {
          const tokenMap = JSON.parse(tokenMapStr);
          console.log('Mapa de tokens:', tokenMap);
          
          if (tokenMap && typeof tokenMap === 'object') {
            Object.entries(tokenMap).forEach(([account, token]: [string, any]) => {
              // Evitar duplicatas
              if (!loadedTokens.some(t => t.account.toLowerCase() === account.toLowerCase())) {
                const isVirtual = account.toUpperCase().startsWith('VRTC');
                
                let accountType = 'Real';
                if (isVirtual) accountType = 'Demo';
                else if (account.startsWith('CR')) accountType = 'Crypto';
                else if (account.includes('MLT')) accountType = 'Malta';
                
                loadedTokens.push({
                  account,
                  token,
                  currency: 'USD', // Padrão
                  isVirtual,
                  accountType,
                  isActive: mainAccount === account
                });
              }
            });
          }
        } catch (err) {
          console.error('Erro ao processar mapa de tokens:', err);
        }
      }
      
      // 4. Procurar tokens individuais
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('deriv_token_') || 
          key.startsWith('deriv_verified_token_')
        )) {
          // Extrair ID da conta do nome da chave
          let account = '';
          if (key.startsWith('deriv_token_')) {
            account = key.replace('deriv_token_', '');
          } else {
            account = key.replace('deriv_verified_token_', '');
          }
          
          if (account && !loadedTokens.some(t => t.account.toLowerCase() === account.toLowerCase())) {
            const token = localStorage.getItem(key);
            if (token) {
              const isVirtual = account.toUpperCase().startsWith('VRTC');
              
              let accountType = 'Real';
              if (isVirtual) accountType = 'Demo';
              else if (account.startsWith('CR')) accountType = 'Crypto';
              else if (account.includes('MLT')) accountType = 'Malta';
              
              loadedTokens.push({
                account,
                token,
                currency: 'USD', // Padrão
                isVirtual,
                accountType,
                isActive: mainAccount === account
              });
            }
          }
        }
      }
      
      // 5. Verificar conta atual conectada
      const accountInfo = derivAPI.getAccountInfo();
      if (accountInfo && accountInfo.loginId) {
        const currentLoginId = accountInfo.loginId;
        
        // Marcar esta conta como ativa
        loadedTokens.forEach(token => {
          if (token.account.toLowerCase() === currentLoginId.toLowerCase()) {
            token.isActive = true;
          }
        });
        
        // Se a conta atual não estiver na lista e tivermos um token, adicioná-la
        if (!loadedTokens.some(t => t.account.toLowerCase() === currentLoginId.toLowerCase()) && mainToken) {
          const isVirtual = currentLoginId.toUpperCase().startsWith('VRTC');
          
          let accountType = 'Real';
          if (isVirtual) accountType = 'Demo';
          else if (currentLoginId.startsWith('CR')) accountType = 'Crypto';
          else if (currentLoginId.includes('MLT')) accountType = 'Malta';
          
          loadedTokens.push({
            account: currentLoginId,
            token: mainToken,
            currency: accountInfo.currency || 'USD',
            isVirtual: accountInfo.isVirtual,
            accountType,
            isActive: true
          });
        }
      }
      
      console.log(`Total de ${loadedTokens.length} tokens carregados`);
      setTokens(loadedTokens);
    } catch (err: any) {
      console.error('Erro ao carregar tokens:', err);
      setError(err.message || 'Erro ao carregar tokens');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Adicionar um novo token manualmente
  const addToken = async () => {
    if (!newAccount || !newToken) {
      setError('Conta e token são obrigatórios');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Verificar se já existe este token
      if (tokens.some(t => t.account.toLowerCase() === newAccount.toLowerCase())) {
        // Atualizar token existente
        const updatedTokens = tokens.map(t => 
          t.account.toLowerCase() === newAccount.toLowerCase()
            ? { ...t, token: newToken, currency: newCurrency }
            : t
        );
        setTokens(updatedTokens);
      } else {
        // Adicionar novo token
        const isVirtual = newAccount.toUpperCase().startsWith('VRTC');
        
        let accountType = 'Real';
        if (isVirtual) accountType = 'Demo';
        else if (newAccount.startsWith('CR')) accountType = 'Crypto';
        else if (newAccount.includes('MLT')) accountType = 'Malta';
        
        const newTokenObj: AccountToken = {
          account: newAccount,
          token: newToken,
          currency: newCurrency,
          isVirtual,
          accountType
        };
        
        setTokens([...tokens, newTokenObj]);
      }
      
      // Salvar em todas as fontes
      saveTokenToAllSources(newAccount, newToken, newCurrency);
      
      setSuccess('Token adicionado com sucesso');
      setNewAccount('');
      setNewToken('');
      setNewCurrency('USD');
    } catch (err: any) {
      console.error('Erro ao adicionar token:', err);
      setError(err.message || 'Erro ao adicionar token');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Salvar token em todas as fontes possíveis
  const saveTokenToAllSources = (account: string, token: string, currency: string = 'USD') => {
    try {
      const lowerAccount = account.toLowerCase();
      
      // 1. Salvar como token individual
      localStorage.setItem(`deriv_token_${lowerAccount}`, token);
      localStorage.setItem(`deriv_verified_token_${lowerAccount}`, token);
      
      // 2. Atualizar lista de contas OAuth
      try {
        const userAccountsStr = localStorage.getItem('deriv_user_accounts');
        let accounts = [];
        
        if (userAccountsStr) {
          accounts = JSON.parse(userAccountsStr);
        }
        
        // Verificar se a conta já existe na lista
        const existingIndex = accounts.findIndex((acc: any) => 
          acc.account.toLowerCase() === lowerAccount
        );
        
        if (existingIndex >= 0) {
          // Atualizar token existente
          accounts[existingIndex].token = token;
          accounts[existingIndex].currency = currency;
        } else {
          // Adicionar nova conta
          accounts.push({
            account,
            token,
            currency
          });
        }
        
        localStorage.setItem('deriv_user_accounts', JSON.stringify(accounts));
      } catch (err) {
        console.error('Erro ao atualizar contas OAuth:', err);
      }
      
      // 3. Atualizar mapa de tokens
      try {
        const tokenMapStr = localStorage.getItem('deriv_account_tokens');
        let tokenMap: Record<string, string> = {};
        
        if (tokenMapStr) {
          tokenMap = JSON.parse(tokenMapStr);
        }
        
        tokenMap[lowerAccount] = token;
        localStorage.setItem('deriv_account_tokens', JSON.stringify(tokenMap));
      } catch (err) {
        console.error('Erro ao atualizar mapa de tokens:', err);
      }
      
      // 4. Se for a conta atual ativa, atualizar o token principal também
      const activeAccount = localStorage.getItem('deriv_active_account');
      if (activeAccount && activeAccount.toLowerCase() === lowerAccount) {
        localStorage.setItem('deriv_api_token', token);
      }
      
      console.log(`Token para conta ${account} salvo em todas as fontes`);
    } catch (err) {
      console.error('Erro ao salvar token:', err);
      throw err;
    }
  };
  
  // Remover um token
  const removeToken = (account: string) => {
    try {
      // Remover da lista local
      setTokens(tokens.filter(t => t.account !== account));
      
      const lowerAccount = account.toLowerCase();
      
      // Remover de todas as fontes
      localStorage.removeItem(`deriv_token_${lowerAccount}`);
      localStorage.removeItem(`deriv_verified_token_${lowerAccount}`);
      
      // Remover da lista de contas OAuth
      try {
        const userAccountsStr = localStorage.getItem('deriv_user_accounts');
        if (userAccountsStr) {
          let accounts = JSON.parse(userAccountsStr);
          accounts = accounts.filter((acc: any) => acc.account.toLowerCase() !== lowerAccount);
          localStorage.setItem('deriv_user_accounts', JSON.stringify(accounts));
        }
      } catch (err) {
        console.error('Erro ao atualizar contas OAuth:', err);
      }
      
      // Remover do mapa de tokens
      try {
        const tokenMapStr = localStorage.getItem('deriv_account_tokens');
        if (tokenMapStr) {
          const tokenMap = JSON.parse(tokenMapStr);
          delete tokenMap[lowerAccount];
          localStorage.setItem('deriv_account_tokens', JSON.stringify(tokenMap));
        }
      } catch (err) {
        console.error('Erro ao atualizar mapa de tokens:', err);
      }
      
      // Se for a conta ativa, limpar também o token principal
      const activeAccount = localStorage.getItem('deriv_active_account');
      if (activeAccount && activeAccount.toLowerCase() === lowerAccount) {
        localStorage.removeItem('deriv_api_token');
        localStorage.removeItem('deriv_active_account');
      }
      
      setSuccess(`Token para conta ${account} removido com sucesso`);
    } catch (err: any) {
      console.error('Erro ao remover token:', err);
      setError(err.message || 'Erro ao remover token');
    }
  };
  
  // VERSÃO SIMPLIFICADA: Conectar com um token específico
  const connectWithToken = async (account: string, token: string) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log(`[TokenManager] NOVA IMPLEMENTAÇÃO SIMPLES para conectar à conta ${account}...`);
      
      // 1. Salvamento simplificado do token
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('deriv_active_account', account);
      localStorage.setItem(`deriv_token_${account.toLowerCase()}`, token);
      
      // 2. Desconectar completamente a API
      console.log(`[TokenManager] Desconectando WebSocket...`);
      derivAPI.disconnect(true);
      
      // 3. Aguardar para garantir desconexão completa
      console.log(`[TokenManager] Aguardando desconexão completa...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Notificar preparação para recarregar
      setSuccess("Preparando para recarregar com novo token...");
      
      // 4. Recarregar a página imediatamente
      console.log(`[TokenManager] Recarregando página para aplicar nova conexão...`);
      
      setTimeout(() => {
        // Última checagem para garantir que o token foi salvo
        if (localStorage.getItem('deriv_api_token') === token) {
          console.log(`[TokenManager] Token salvo, recarregando...`);
          window.location.href = window.location.pathname; // Recarregar mantendo a URL
        } else {
          console.error(`[TokenManager] Falha ao salvar token, tentando novamente...`);
          localStorage.setItem('deriv_api_token', token);
          window.location.reload();
        }
      }, 1000);
      
    } catch (err: any) {
      console.error('[TokenManager] Erro ao preparar conexão com novo token:', err);
      setError(err.message || 'Erro ao preparar conexão');
      setIsLoading(false);
    }
  };
  
  // Limpar todos os tokens
  const clearAllTokens = () => {
    if (confirm('Tem certeza que deseja limpar todos os tokens? Será necessário fazer login novamente.')) {
      try {
        // Desconectar primeiro
        derivAPI.disconnect(true);
        
        // Limpar todos os tokens do localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith('deriv_token_') || 
            key.startsWith('deriv_verified_token_') ||
            key === 'deriv_api_token' ||
            key === 'deriv_active_account' ||
            key === 'deriv_user_accounts' ||
            key === 'deriv_account_tokens'
          )) {
            localStorage.removeItem(key);
          }
        }
        
        setTokens([]);
        setSuccess('Todos os tokens foram removidos com sucesso');
      } catch (err: any) {
        console.error('Erro ao limpar tokens:', err);
        setError(err.message || 'Erro ao limpar tokens');
      }
    }
  };
  
  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Key className="h-4 w-4 mr-2" />
            Gerenciar Tokens
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>Gerenciador de Tokens da Deriv</DialogTitle>
            <DialogDescription>
              Gerencie e visualize os tokens de acesso para todas as suas contas da Deriv.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Adicionar Novo Token</CardTitle>
                      <CardDescription>
                        Adicione um token manualmente para uma conta específica.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="account">ID da Conta</Label>
                          <Input 
                            id="account" 
                            placeholder="Ex: CR1234567" 
                            value={newAccount}
                            onChange={(e) => setNewAccount(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="token">Token</Label>
                          <Input 
                            id="token" 
                            type="password" 
                            placeholder="Seu token de API" 
                            value={newToken}
                            onChange={(e) => setNewToken(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="currency">Moeda</Label>
                          <Input 
                            id="currency" 
                            placeholder="Ex: USD" 
                            value={newCurrency}
                            onChange={(e) => setNewCurrency(e.target.value)}
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-1">
                      <Button onClick={addToken} disabled={isSaving}>
                        {isSaving ? (
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Salvar Token
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
                
                {tokens.length === 0 ? (
                  <Alert className="my-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Nenhum token encontrado</AlertTitle>
                    <AlertDescription>
                      Não encontramos nenhum token salvo para contas da Deriv. 
                      Adicione manualmente ou use o botão "Conectar à Deriv" para autenticar.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Table>
                    <TableCaption>Lista de tokens salvos para suas contas Deriv</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID da Conta</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Moeda</TableHead>
                        <TableHead>Token</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tokens.map((token) => (
                        <TableRow key={token.account}>
                          <TableCell>
                            <div className="font-medium">{token.account}</div>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={token.isVirtual ? "secondary" : "default"}
                              className={token.isVirtual ? "bg-blue-600" : ""}
                            >
                              {token.accountType || (token.isVirtual ? "Demo" : "Real")}
                            </Badge>
                          </TableCell>
                          <TableCell>{token.currency || "USD"}</TableCell>
                          <TableCell>
                            <code className="px-2 py-1 bg-muted rounded text-xs">
                              {token.token.substring(0, 5)}...
                            </code>
                          </TableCell>
                          <TableCell>
                            {token.isActive ? (
                              <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" /> Ativa
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">
                                Inativa
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                variant="secondary" 
                                size="sm"
                                disabled={token.isActive || isLoading}
                                onClick={() => connectWithToken(token.account, token.token)}
                              >
                                <Key className="h-3 w-3 mr-1" />
                                Usar
                              </Button>
                              
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => removeToken(token.account)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
                
                {error && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Erro</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                {success && (
                  <Alert variant="default" className="mt-4 bg-green-50 text-green-600 border-green-200">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Sucesso</AlertTitle>
                    <AlertDescription>{success}</AlertDescription>
                  </Alert>
                )}
              </>
            )}
          </div>
          
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              onClick={clearAllTokens}
              disabled={isLoading}
            >
              <Shield className="h-4 w-4 mr-2" />
              Limpar Todos
            </Button>
            
            <div className="flex gap-4">
              <Button 
                variant="secondary"
                onClick={() => loadTokens()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
              
              <Button 
                onClick={() => setOpen(false)}
              >
                Fechar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}