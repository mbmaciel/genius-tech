import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, KeyRound, RefreshCcw } from 'lucide-react';
import derivAPI from '@/lib/derivApi';

export function TokenInput() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [hasExistingToken, setHasExistingToken] = useState(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);

  // Carregar token existente ao montar o componente
  useEffect(() => {
    const savedToken = sessionStorage.getItem('derivToken');
    if (savedToken) {
      // Exibir versão truncada do token para segurança
      setToken(savedToken.substring(0, 3) + '...' + savedToken.substring(savedToken.length - 3));
      setHasExistingToken(true);
      
      // Verificar info da conta se já tiver token
      const checkAccount = async () => {
        try {
          // Verificar se já está conectado, ou conectar com o token salvo
          if (!derivAPI.getConnectionStatus()) {
            await derivAPI.connect(savedToken);
          }
          
          // Obter informações da conta de forma síncrona
          const info = derivAPI.getAccountInfo();
          if (info) {
            setAccountInfo(info);
            setIsSuccess(true);
          }
        } catch (error) {
          console.error("Erro ao carregar informações da conta:", error);
        }
      };
      
      checkAccount();
    }
  }, []);

  // Limpar token atual
  const handleResetToken = () => {
    // Limpar token da sessão
    sessionStorage.removeItem('derivToken');
    setToken('');
    setHasExistingToken(false);
    setAccountInfo(null);
    setIsSuccess(false);
    
    // Desconectar API atual
    derivAPI.disconnect(true); // true para forçar desconexão completa
    
    // Limpeza completa de todos os tokens para evitar problemas de mapeamento
    try {
      // Limpar todos os tokens possíveis de locais diferentes
      localStorage.removeItem('derivLinkedTokens');
      localStorage.removeItem('deriv_api_token');
      localStorage.removeItem('deriv_token_mapping');
      localStorage.removeItem('deriv_active_account');
      localStorage.removeItem('deriv_target_account');
      localStorage.removeItem('oauth_login_tokens');
      sessionStorage.removeItem('derivApiToken');
      console.log("Limpeza completa de tokens realizada para evitar conflitos");
      
      // Limpar cache de contas - remover todos os tokens das contas
      const savedAccountsJson = localStorage.getItem('derivSavedAccounts');
      if (savedAccountsJson) {
        try {
          const savedAccounts = JSON.parse(savedAccountsJson);
          // Remover os tokens de todas as contas, mas manter as informações básicas
          const updatedAccounts = savedAccounts.map((acc: any) => ({
            ...acc,
            token: undefined
          }));
          localStorage.setItem('derivSavedAccounts', JSON.stringify(updatedAccounts));
          console.log("Tokens removidos de todas as contas salvas");
        } catch (parseError) {
          // Se o JSON for inválido, remover completamente
          localStorage.removeItem('derivSavedAccounts');
        }
      }
      
      // Limpar também assinaturas para evitar reconexões automáticas
      sessionStorage.removeItem('activeSubscriptions');
    } catch (e) {
      console.error("Erro ao limpar mapeamentos de tokens:", e);
    }
  };

  // Testar token atual sem salvar
  const handleTestToken = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Obter o token atual
      const currentToken = sessionStorage.getItem('derivToken') || token;
      
      if (!currentToken || currentToken.length < 5) {
        setErrorMessage('Por favor, insira um token válido da API Deriv');
        return;
      }
      
      // Tentar autorizar com o token
      const authResponse = await derivAPI.connect(currentToken);
      
      if (authResponse === true || (typeof authResponse === 'object' && authResponse && (authResponse.authorize || authResponse.connected))) {
        setIsSuccess(true);
        // Obtenção síncrona de informações da conta
        setAccountInfo(derivAPI.getAccountInfo());
        console.log('Token válido e conexão autorizada com sucesso');
      } else {
        throw new Error('Não foi possível autorizar com o token fornecido');
      }
    } catch (error: any) {
      console.error('Erro ao testar token:', error);
      setErrorMessage(error.message || 'Erro ao conectar com o token fornecido');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToken = async () => {
    // Validação básica
    if (!token || token.length < 5) {
      setErrorMessage('Por favor, insira um token válido da API Deriv');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      setIsSuccess(false);

      // Se o token foi mascarado, não continuar (token já está salvo)
      if (token.includes('...')) {
        setErrorMessage('Este token já está salvo. Para inserir um novo, primeiro clique em "Limpar".');
        return;
      }

      // Salvar token na sessão para uso posterior
      sessionStorage.setItem('derivToken', token);
      setHasExistingToken(true);
      
      // Tentar autorizar com o token
      const authResponse = await derivAPI.connect(token);
      
      if (authResponse === true || (typeof authResponse === 'object' && authResponse && (authResponse.authorize || authResponse.connected))) {
        setIsSuccess(true);
        // Obtenção síncrona de informações da conta
        setAccountInfo(derivAPI.getAccountInfo());
        console.log('Token válido e conexão autorizada com sucesso');
        
        // Mascarar o token no campo por segurança
        setToken(token.substring(0, 3) + '...' + token.substring(token.length - 3));
      } else {
        throw new Error('Não foi possível autorizar com o token fornecido');
      }
    } catch (error: any) {
      console.error('Erro ao salvar token:', error);
      setErrorMessage(error.message || 'Erro ao conectar com o token fornecido');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar Token da API</CardTitle>
        <CardDescription>
          Insira o token da API gerado na plataforma Deriv para conectar ao serviço
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Token da API Deriv</Label>
            <div className="flex">
              <Input
                id="token"
                placeholder="Cole seu token aqui..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type={hasExistingToken ? "text" : "password"}
                className="font-mono"
                readOnly={hasExistingToken}
              />
              {hasExistingToken && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="ml-2" 
                  onClick={handleResetToken}
                  title="Limpar token"
                >
                  <RefreshCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {hasExistingToken 
                ? "Token configurado. Para alterar, clique em 'Limpar'." 
                : "Cole o token API gerado na plataforma Deriv."}
            </p>
          </div>
          
          {errorMessage && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}
          
          {isSuccess && (
            <Alert className="bg-green-50 border-green-200 text-green-700">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Token configurado com sucesso!</AlertDescription>
            </Alert>
          )}
          
          {accountInfo && (
            <div className="p-3 bg-slate-50 rounded border border-slate-200">
              <h4 className="font-medium text-sm mb-2">Informações da Conta</h4>
              <div className="text-xs space-y-1">
                <p><strong>Nome da conta:</strong> {accountInfo.fullname}</p>
                <p><strong>E-mail:</strong> {accountInfo.email}</p>
                <p><strong>Moeda:</strong> {accountInfo.currency}</p>
                <p><strong>Saldo:</strong> {accountInfo.balance?.toFixed(2)} {accountInfo.currency}</p>
                <p><strong>Landing Company:</strong> {accountInfo.landing_company_name}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between flex-wrap gap-2">
        <div>
          {hasExistingToken ? (
            <Button 
              onClick={handleTestToken} 
              variant="outline" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Testar Conexão
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleSaveToken} disabled={isLoading || !token}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <KeyRound className="mr-2 h-4 w-4" />
                  Salvar Token
                </>
              )}
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}