import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { tradingWebSocket } from "@/lib/tradingWebSocketManager";

/**
 * Componente para testar um token específico (wRCpaqmNKnlLBzh)
 */
export function TokenTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    loginid?: string;
    balance?: number;
    currency?: string;
    error?: string;
    appliedToBot?: boolean;
  } | null>(null);

  // Token predefinido para teste
  const SPECIFIC_TOKEN = "wRCpaqmNKnlLBzh";

  const handleTest = async () => {
    setIsLoading(true);
    
    try {
      console.log("[TOKEN_TEST] Testando token específico:", SPECIFIC_TOKEN);
      
      // Usar o testToken do tradingWebSocketManager
      const testResult = await tradingWebSocket.testToken(SPECIFIC_TOKEN);
      
      console.log("[TOKEN_TEST] Resultado do teste:", testResult);
      
      if (testResult.isValid) {
        // Token é válido, salvar no localStorage
        localStorage.setItem('deriv_oauth_token', SPECIFIC_TOKEN);
        console.log("[TOKEN_TEST] Token válido e salvo no localStorage");
        
        // Tentar conectar e autorizar o WebSocket com este token
        await tradingWebSocket.connect();
        const authResult = await tradingWebSocket.authorize(SPECIFIC_TOKEN);
        
        if (!authResult.error) {
          console.log("[TOKEN_TEST] WebSocket autorizado com sucesso para conta:", authResult.authorize?.loginid);
          setResult({
            isValid: true,
            loginid: authResult.authorize?.loginid,
            balance: authResult.authorize?.balance,
            currency: authResult.authorize?.currency,
            appliedToBot: true
          });
        } else {
          console.error("[TOKEN_TEST] Erro na autorização:", authResult.error);
          setResult({
            isValid: true,
            loginid: testResult.loginid,
            error: `Token válido, mas falhou na autorização: ${authResult.error.message}`,
            appliedToBot: false
          });
        }
      } else {
        // Token inválido
        console.error("[TOKEN_TEST] Token inválido:", testResult.error);
        setResult({
          isValid: false,
          error: testResult.error
        });
      }
    } catch (error) {
      console.error("[TOKEN_TEST] Erro ao testar token:", error);
      setResult({
        isValid: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido ao testar token'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isTokenApplied = result?.isValid && result?.appliedToBot;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Teste de Token Específico</CardTitle>
        <CardDescription>
          Teste e aplique o token "wRCpaqmNKnlLBzh" para operações de trading
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {result ? (
            <div className={`p-4 rounded-lg border ${
              isTokenApplied 
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                : !result.isValid 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
            }`}>
              <div className="flex items-center">
                {isTokenApplied ? (
                  <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                ) : !result.isValid ? (
                  <XCircle className="h-5 w-5 mr-2 text-red-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 mr-2 text-yellow-500" />
                )}
                <h3 className="font-medium">
                  {isTokenApplied 
                    ? 'Token aplicado com sucesso' 
                    : !result.isValid 
                      ? 'Token inválido' 
                      : 'Token válido, mas não aplicado completamente'}
                </h3>
              </div>
              
              <div className="mt-2 space-y-1">
                {result.isValid && (
                  <>
                    {result.loginid && (
                      <p className="text-sm">ID da conta: <span className="font-medium">{result.loginid}</span></p>
                    )}
                    {result.balance !== undefined && (
                      <p className="text-sm">Saldo: <span className="font-medium">{result.balance} {result.currency}</span></p>
                    )}
                    {result.appliedToBot && (
                      <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                        Token configurado para uso com as WebSockets de trading.
                      </p>
                    )}
                  </>
                )}
                
                {result.error && (
                  <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Clique no botão abaixo para testar o token "wRCpaqmNKnlLBzh"
              </p>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleTest} 
          disabled={isLoading || isTokenApplied}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testando token...
            </>
          ) : isTokenApplied ? (
            'Token já está aplicado'
          ) : (
            'Testar e aplicar token wRCpaqmNKnlLBzh'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}