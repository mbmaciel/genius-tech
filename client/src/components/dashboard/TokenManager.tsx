import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from '@/hooks/use-toast';
import derivAPI from '@/lib/derivApi';
import { AlertCircle, Loader2, Save, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TokenInfo {
  token: string;
  account: string;
  type: string;
}

export default function TokenManager() {
  const [tokenInput, setTokenInput] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [savedTokens, setSavedTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load tokens when component mounts
  useEffect(() => {
    loadStoredTokens();
  }, []);

  // Fetch tokens from localStorage
  const loadStoredTokens = () => {
    const tokens: TokenInfo[] = [];
    
    // Check for main API token
    const mainToken = localStorage.getItem('deriv_api_token');
    if (mainToken) {
      tokens.push({
        token: mainToken.substring(0, 10) + '...',
        account: 'Token Principal',
        type: 'main'
      });
    }
    
    // Check for account-specific tokens
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.startsWith('deriv_token_')) {
        const account = key.replace('deriv_token_', '');
        const token = localStorage.getItem(key);
        if (token) {
          tokens.push({
            token: token.substring(0, 10) + '...',
            account: account,
            type: 'account'
          });
        }
      }
    }
    
    setSavedTokens(tokens);
  };

  // Save a new token
  const handleSaveToken = async () => {
    if (!tokenInput.trim()) {
      setError('Por favor, insira um token válido.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Verify token by attempting to authorize with it
      const originalToken = derivAPI.getToken();
      
      // Disconnect current connection (if any)
      derivAPI.disconnect();
      
      // Connect with the new token
      await derivAPI.authorize(tokenInput);
      
      const accountInfo = derivAPI.getAccountInfo();
      
      if (!accountInfo || !accountInfo.loginId) {
        throw new Error('O token não pôde ser verificado.');
      }
      
      // Save the token
      const accountId = accountInfo.loginId;
      const name = tokenName.trim() || accountId;
      
      // Store token for this specific account
      localStorage.setItem(`deriv_token_${accountId}`, tokenInput);
      
      // Also mark it as verified
      localStorage.setItem(`deriv_verified_token_${accountId}`, tokenInput);
      
      toast({
        title: "Token Salvo",
        description: `Token salvo para a conta ${name} (${accountId})`,
      });
      
      // Reset form
      setTokenInput('');
      setTokenName('');
      
      // Reload token list
      loadStoredTokens();
      
      // Restore original connection if possible
      if (originalToken) {
        await derivAPI.authorize(originalToken);
      }
    } catch (error) {
      console.error('Failed to save token:', error);
      setError('O token fornecido é inválido ou não pôde ser verificado.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove all tokens
  const handleRemoveAllTokens = async () => {
    const confirmed = window.confirm('Tem certeza que deseja remover todos os tokens? Isso desconectará sua sessão atual.');
    
    if (!confirmed) return;
    
    setIsRemoving(true);
    
    try {
      // Disconnect current API session
      derivAPI.disconnect(true);
      
      // Remove all tokens
      localStorage.removeItem('deriv_api_token');
      
      // Remove account-specific tokens
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        
        if (key.startsWith('deriv_token_') || key.startsWith('deriv_verified_token_')) {
          localStorage.removeItem(key);
          i--; // Adjust index since we're modifying the array we're iterating through
        }
      }
      
      // Clear token map if exists
      localStorage.removeItem('deriv_account_token_map');
      
      // Update token list
      setSavedTokens([]);
      
      toast({
        title: "Tokens Removidos",
        description: "Todos os tokens foram removidos com sucesso.",
      });
    } catch (error) {
      console.error('Error removing tokens:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao remover os tokens.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Card className="bg-[#162746] border-[#1c3654]">
      <CardHeader>
        <CardTitle className="text-white text-xl">Gerenciador de Tokens</CardTitle>
        <CardDescription>
          Gerencie tokens de API para autenticação com Deriv
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Token da API (de app.deriv.com)"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="bg-[#1f3158] border-[#1c3654] text-white"
          />
          
          <Input
            placeholder="Nome (opcional)"
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            className="bg-[#1f3158] border-[#1c3654] text-white"
          />
          
          <Button 
            onClick={handleSaveToken} 
            disabled={isLoading} 
            className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Token
              </>
            )}
          </Button>
        </div>
        
        <div>
          <h3 className="text-white text-sm font-medium mb-2">Tokens Salvos ({savedTokens.length})</h3>
          
          {savedTokens.length === 0 ? (
            <div className="text-[#8492b4] text-sm">
              Nenhum token salvo
            </div>
          ) : (
            <div className="space-y-2">
              {savedTokens.map((token, index) => (
                <div 
                  key={index} 
                  className="bg-[#1f3158] rounded-md p-2 text-sm flex justify-between items-center"
                >
                  <div>
                    <div className="text-white font-mono">{token.token}</div>
                    <div className="text-[#8492b4] text-xs">{token.account}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    token.type === 'main' 
                      ? 'bg-[#00e5b3]/10 text-[#00e5b3]' 
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {token.type === 'main' ? 'Principal' : 'Conta'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          className="w-full text-red-500 border-red-800 hover:bg-red-950 hover:text-red-400"
          onClick={handleRemoveAllTokens}
          disabled={isRemoving || savedTokens.length === 0}
        >
          {isRemoving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash className="mr-2 h-4 w-4" />
          )}
          Remover Todos os Tokens
        </Button>
      </CardFooter>
    </Card>
  );
}
