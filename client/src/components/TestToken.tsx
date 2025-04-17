import React, { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { testOAuthToken } from "@/lib/tradingWebSocketManager";

export function TestToken() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const token = "wRCpaqmNKnlLBzh"; // Token específico fornecido pelo usuário
  
  const testToken = async () => {
    try {
      setLoading(true);
      console.log('[TEST] Testando token específico:', token);
      
      // Salvar o token no localStorage para ser usado pelo robô
      localStorage.setItem('deriv_oauth_token', token);
      
      // Testar o token
      const testResult = await testOAuthToken(token);
      setResult(testResult);
      
      console.log('[TEST] Resultado do teste do token:', testResult);
    } catch (error) {
      console.error('[TEST] Erro ao testar token:', error);
      setResult({ 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-4 border rounded-lg bg-card">
      <h2 className="text-lg font-semibold mb-4">Teste de Token Específico</h2>
      
      <Button onClick={testToken} disabled={loading}>
        {loading ? 'Testando...' : 'Testar Token wRCpaqmNKnlLBzh'}
      </Button>
      
      {result && (
        <div className="mt-4 p-3 rounded-md bg-background">
          <h3 className="font-medium mb-2">Resultado do teste:</h3>
          <pre className="text-sm overflow-auto p-2 bg-muted rounded">
            {JSON.stringify(result, null, 2)}
          </pre>
          
          {result.isValid ? (
            <p className="mt-2 text-green-500 font-medium">
              Token válido! Salvo no localStorage para uso com o robô.
            </p>
          ) : (
            <p className="mt-2 text-red-500 font-medium">
              Token inválido: {result.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}