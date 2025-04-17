import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from '@/hooks/use-toast';
import { AlertCircle, Copy, Loader2, Plus, Trash } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DirectTokenApplier } from './DirectTokenApplier';

interface TokenInfo {
  token: string;
  account: string;
  type: string;
}

export function ApiTokensManager() {
  const [tokenInput, setTokenInput] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [savedTokens, setSavedTokens] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveVerified, setSaveVerified] = useState(true);

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

  // Save a new token manually
  const handleSaveToken = () => {
    if (!tokenInput.trim()) {
      setError('Por favor, insira um token válido.');
      return;
    }
    
    if (!tokenName.trim()) {
      setError('Por favor, insira um nome para o token.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Save token without verification
      localStorage.setItem(`deriv_token_${tokenName}`, tokenInput);
      
      // If verification option is enabled
      if (saveVerified) {
        localStorage.setItem(`deriv_verified_token_${tokenName}`, tokenInput);
      }
      
      toast({
        title: "Token Salvo",
        description: `Token salvo para ${tokenName}`,
      });
      
      // Reset form
      setTokenInput('');
      setTokenName('');
      
      // Reload token list
      loadStoredTokens();
    } catch (error) {
      console.error('Failed to save token:', error);
      setError('Ocorreu um erro ao salvar o token.');
    } finally {
      setIsLoading(false);
    }
  };

  // Remove a specific token
  const handleRemoveToken = (tokenInfo: TokenInfo) => {
    if (tokenInfo.type === 'main') {
      // Remove main token
      localStorage.removeItem('deriv_api_token');
    } else {
      // Remove account token
      localStorage.removeItem(`deriv_token_${tokenInfo.account}`);
      localStorage.removeItem(`deriv_verified_token_${tokenInfo.account}`);
    }
    
    // Update the list
    loadStoredTokens();
    
    toast({
      title: "Token Removido",
      description: `Token para ${tokenInfo.account} removido com sucesso.`,
    });
  };

  // Remove all tokens
  const handleRemoveAllTokens = () => {
    const confirmed = window.confirm('Tem certeza que deseja remover todos os tokens? Isso desconectará sua sessão atual.');
    
    if (!confirmed) return;
    
    setIsRemoving(true);
    
    try {
      // Remove main token
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
        <CardTitle className="text-white text-xl">Gerenciar Tokens</CardTitle>
        <CardDescription>
          Gerencie tokens de API para autenticação com Deriv
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="saved">
          <TabsList className="bg-[#1f3158] text-white">
            <TabsTrigger value="saved">Tokens Salvos</TabsTrigger>
            <TabsTrigger value="add">Adicionar Token</TabsTrigger>
            <TabsTrigger value="apply">Aplicar Token</TabsTrigger>
          </TabsList>
          
          <TabsContent value="saved" className="pt-4">
            {savedTokens.length === 0 ? (
              <div className="text-center py-4 text-[#8492b4]">
                Nenhum token salvo ainda
              </div>
            ) : (
              <div className="space-y-2">
                {savedTokens.map((token, index) => (
                  <div 
                    key={index} 
                    className="bg-[#1f3158] rounded-md p-3 text-sm flex justify-between items-center"
                  >
                    <div>
                      <div className="text-white font-mono">{token.token}</div>
                      <div className="text-[#8492b4] text-xs">{token.account}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`text-xs px-2 py-1 rounded ${
                        token.type === 'main' 
                          ? 'bg-[#00e5b3]/10 text-[#00e5b3]' 
                          : 'bg-blue-500/10 text-blue-400'
                      }`}>
                        {token.type === 'main' ? 'Principal' : 'Conta'}
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleRemoveToken(token)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-950"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                
                <Button 
                  variant="outline" 
                  size="sm"
                  className="w-full mt-2 text-red-400 border-red-800/40 hover:bg-red-950/30"
                  onClick={handleRemoveAllTokens}
                  disabled={isRemoving}
                >
                  {isRemoving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash className="mr-2 h-4 w-4" />
                  )}
                  Remover Todos
                </Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="add" className="pt-4">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="token-input" className="text-white text-sm mb-1 block">
                  Token da API
                </Label>
                <Input
                  id="token-input"
                  type="password"
                  placeholder="Token da API (de app.deriv.com)"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="bg-[#1f3158] border-[#1c3654] text-white"
                />
              </div>
              
              <div>
                <Label htmlFor="token-name" className="text-white text-sm mb-1 block">
                  Nome / Identificador
                </Label>
                <Input
                  id="token-name"
                  placeholder="Nome ou identificador da conta"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  className="bg-[#1f3158] border-[#1c3654] text-white"
                />
              </div>
              
              <div className="flex items-center space-x-2 py-2">
                <Switch
                  id="verified-mode"
                  checked={saveVerified}
                  onCheckedChange={setSaveVerified}
                />
                <Label htmlFor="verified-mode" className="text-white text-sm">
                  Salvar como token verificado
                </Label>
              </div>
              
              <Button 
                onClick={handleSaveToken} 
                disabled={isLoading || !tokenInput.trim() || !tokenName.trim()} 
                className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Salvar Token
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="apply" className="pt-4">
            <DirectTokenApplier />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
