import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { testOAuthToken } from "@/lib/tradingWebSocketManager";
import { simpleBotService } from "@/services/simpleBotService";

// Token específico para testar
const SPECIFIC_TOKEN = "wRCpaqmNKnlLBzh";

export function SpecificTokenTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    isValid: boolean;
    loginid?: string;
    balance?: number;
    currency?: string;
    error?: string;
    appliedToBot?: boolean;
  } | null>(null);
  
  // Verificar se o token já está salvo no localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_oauth_token');
    if (savedToken === SPECIFIC_TOKEN) {
      setResult(prevResult => ({
        ...prevResult,
        isValid: true,
        appliedToBot: true
      }));
    }
  }, []);

  const handleTest = async () => {
    try {
      setIsLoading(true);
      console.log('[SPECIFIC_TOKEN] Testando token:', SPECIFIC_TOKEN);
      
      // Executar o teste do token
      const testResult = await testOAuthToken(SPECIFIC_TOKEN);
      
      if (testResult.isValid) {
        // Salvar o token no localStorage
        localStorage.setItem('deriv_oauth_token', SPECIFIC_TOKEN);
        
        // Aplicar o token ao serviço do bot
        if (simpleBotService) {
          try {
            simpleBotService.setAuthToken(SPECIFIC_TOKEN);
            console.log('[SPECIFIC_TOKEN] Token aplicado ao serviço do bot com sucesso');
            
            setResult({
              ...testResult,
              appliedToBot: true
            });
          } catch (botError) {
            console.error('[SPECIFIC_TOKEN] Erro ao aplicar token ao bot:', botError);
            setResult({
              ...testResult,
              appliedToBot: false,
              error: 'Token válido, mas houve um erro ao aplicá-lo ao robô'
            });
          }
        } else {
          console.log('[SPECIFIC_TOKEN] Serviço do bot não disponível, salvando apenas o token');
          setResult({
            ...testResult,
            appliedToBot: false
          });
        }
      } else {
        setResult(testResult);
      }
    } catch (error) {
      console.error('[SPECIFIC_TOKEN] Erro ao testar token:', error);
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
                      : 'Token válido, mas não aplicado ao robô'}
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
                        Token configurado para uso com o robô de trading.
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