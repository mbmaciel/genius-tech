import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { testOAuthToken } from "@/lib/tradingWebSocketManager";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function TokenTester() {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    loginid?: string;
    balance?: number;
    currency?: string;
    error?: string;
  } | null>(null);

  const handleTest = async () => {
    if (!token.trim()) return;
    
    try {
      setLoading(true);
      setResult(null);
      
      console.log('Testando token:', token);
      const testResult = await testOAuthToken(token);
      
      setResult(testResult);
      console.log('Resultado do teste:', testResult);
      
      if (testResult.isValid) {
        // Salvar o token válido no localStorage para uso posterior
        localStorage.setItem('deriv_oauth_token', token);
      }
    } catch (error) {
      console.error('Erro ao testar token:', error);
      setResult({
        isValid: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao testar token'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Testador de Token OAuth</CardTitle>
        <CardDescription>
          Teste um token OAuth específico para verificar se é válido para operações reais
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="token" className="text-sm font-medium">
              Token OAuth da Deriv
            </label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Cole o token OAuth aqui"
              className="w-full"
            />
          </div>

          {result && (
            <Alert variant={result.isValid ? "default" : "destructive"}>
              <div className="flex items-center">
                {result.isValid ? (
                  <CheckCircle className="h-5 w-5 mr-2" />
                ) : (
                  <XCircle className="h-5 w-5 mr-2" />
                )}
                <AlertTitle>
                  {result.isValid ? "Token válido" : "Token inválido"}
                </AlertTitle>
              </div>
              <AlertDescription className="mt-2">
                {result.isValid ? (
                  <div className="space-y-1">
                    <p>ID da conta: {result.loginid}</p>
                    {result.balance !== undefined && (
                      <p>Saldo: {result.balance} {result.currency}</p>
                    )}
                    <p className="text-green-500 font-medium">
                      Token foi salvo e será usado para operações reais.
                    </p>
                  </div>
                ) : (
                  <p>{result.error || "Token não é válido para autenticação com Deriv."}</p>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          onClick={handleTest}
          disabled={loading || !token.trim()}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            "Testar Token"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}