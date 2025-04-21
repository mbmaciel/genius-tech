import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { oauthDirectService } from '@/services/oauthDirectService';

/**
 * Componente de teste específico para a estratégia Iron Under
 * Independente de outros componentes para facilitar o debug
 */
export function IronUnderTester() {
  const [status, setStatus] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Função para adicionar logs
  const addLog = (message: string) => {
    setLogs(prev => [message, ...prev].slice(0, 10));
  };
  
  // Função para executar teste direto da estratégia Iron Under
  const testIronUnder = async () => {
    try {
      addLog('[TESTE] Iniciando teste da estratégia Iron Under...');
      setStatus('running');
      
      // Definir configurações específicas para IRON UNDER
      addLog('[TESTE] Configurando parâmetros da estratégia...');
      // IMPORTANTE: A API Deriv só aceita valores de 1 a 9 para digit
      oauthDirectService.setSettings({
        contractType: 'DIGITUNDER',
        prediction: 5, // ALTERADO DE 4 PARA 5 - Deriv requer digit entre 1-9
        entryValue: 0.35,
        profitTarget: 20,
        lossLimit: 20,
        martingaleFactor: 1.5
      });
      
      // Definir estratégia ativa
      oauthDirectService.setActiveStrategy('IRON UNDER');
      
      // Iniciar serviço
      addLog('[TESTE] Iniciando serviço de trading...');
      const started = await oauthDirectService.start();
      
      if (started) {
        addLog('[TESTE] Serviço de trading iniciado com sucesso!');
        
        // Executar primeira operação
        addLog('[TESTE] Executando primeira operação...');
        const operationStarted = await oauthDirectService.executeFirstOperation(0.35);
        
        if (operationStarted) {
          addLog('[TESTE] ✅ Operação iniciada com sucesso!');
        } else {
          addLog('[TESTE] ❌ Falha ao iniciar operação');
          setStatus('stopped');
        }
      } else {
        addLog('[TESTE] ❌ Falha ao iniciar serviço de trading');
        setStatus('stopped');
      }
    } catch (error) {
      console.error('[IRON_UNDER_TESTER] Erro:', error);
      addLog(`[TESTE] ❌ Erro: ${(error as Error).message || 'Erro desconhecido'}`);
      setStatus('stopped');
    }
  };
  
  // Função para parar o teste
  const stopTest = () => {
    try {
      addLog('[TESTE] Parando teste...');
      oauthDirectService.stop();
      setStatus('stopped');
      addLog('[TESTE] Teste parado com sucesso');
    } catch (error) {
      console.error('[IRON_UNDER_TESTER] Erro ao parar:', error);
      addLog(`[TESTE] ❌ Erro ao parar: ${(error as Error).message || 'Erro desconhecido'}`);
    }
  };
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Teste da Estratégia Iron Under</CardTitle>
        <CardDescription>Ferramenta para testar diretamente a estratégia Iron Under</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid gap-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm font-medium">Status:</span>
                <span className={`ml-2 text-sm ${
                  status === 'running' ? 'text-green-500' : 
                  status === 'stopped' ? 'text-red-500' : 'text-yellow-500'
                }`}>
                  {status === 'running' ? 'Em execução' : 
                   status === 'stopped' ? 'Parado' : 'Pronto'}
                </span>
              </div>
              
              {status === 'idle' && (
                <Button 
                  onClick={testIronUnder}
                  variant="default"
                  className="w-40"
                >
                  Iniciar Teste
                </Button>
              )}
              
              {status === 'running' && (
                <Button 
                  onClick={stopTest}
                  variant="destructive"
                  className="w-40"
                >
                  Parar Teste
                </Button>
              )}
              
              {status === 'stopped' && (
                <Button 
                  onClick={testIronUnder}
                  variant="outline"
                  className="w-40"
                >
                  Reiniciar Teste
                </Button>
              )}
            </div>
          </div>
          
          <div className="border rounded-md p-3 mt-4">
            <h3 className="text-sm font-medium mb-2">Logs:</h3>
            <div className="bg-black/10 dark:bg-white/5 rounded-md p-2 max-h-60 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2">Nenhum log disponível</p>
              ) : (
                <ul className="space-y-1">
                  {logs.map((log, index) => (
                    <li key={index} className="text-xs font-mono">
                      {log}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        Esta ferramenta executa diretamente a estratégia Iron Under sem depender dos outros componentes do sistema
      </CardFooter>
    </Card>
  );
}