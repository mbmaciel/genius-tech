import React, { useState } from 'react';
import derivAPI from '@/lib/derivApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export function TestConnection() {
  const [pingResult, setPingResult] = useState<{ pingTime?: string; status: string }>({
    status: 'idle',
  });
  const [activeSymbols, setActiveSymbols] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const testPing = async () => {
    try {
      setIsLoading(true);
      setPingResult({ status: 'pending' });
      
      const startTime = Date.now();
      
      // Enviar um ping para testar a API
      const response = await derivAPI.send({ ping: 1 });
      
      const endTime = Date.now();
      const pingTime = `${endTime - startTime}ms`;
      
      setPingResult({
        status: 'success',
        pingTime,
      });
      
      console.log('Ping resultado:', response);
    } catch (error) {
      console.error('Erro ao enviar ping:', error);
      setPingResult({
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const testGetActiveSymbols = async () => {
    try {
      setIsLoading(true);
      
      // Obter símbolos ativos da API
      const response = await derivAPI.send({ active_symbols: "brief", product_type: "basic" });
      
      if (response.active_symbols && Array.isArray(response.active_symbols)) {
        setActiveSymbols(response.active_symbols.slice(0, 5)); // Mostra apenas os primeiros 5
      }
      
      console.log('Símbolos ativos:', response);
    } catch (error) {
      console.error('Erro ao obter símbolos ativos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="p-4 border-b border-gray-800">
        <CardTitle className="text-lg font-medium font-poppins">Teste de Conexão API Deriv</CardTitle>
        <CardDescription className="text-[#8492b4]">
          Teste a comunicação com a API Deriv usando nossa solução de proxy híbrida
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex gap-2">
            <Button 
              onClick={testPing} 
              disabled={isLoading}
              className="bg-[#3a7bd5] hover:bg-opacity-80"
            >
              {isLoading && pingResult.status === 'pending' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testando...
                </>
              ) : (
                'Testar Ping'
              )}
            </Button>
            <Button 
              onClick={testGetActiveSymbols} 
              disabled={isLoading} 
              variant="outline"
              className="border-[#3a7bd5] text-[#3a7bd5] hover:bg-[#3a7bd5]/10"
            >
              {isLoading && pingResult.status !== 'pending' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando...
                </>
              ) : (
                'Buscar Símbolos'
              )}
            </Button>
          </div>

          {pingResult.status === 'success' && (
            <div className="mt-2 p-3 bg-[#0e2e23] text-[#6cd99e] rounded border border-[#2a523e]">
              <div className="flex items-center">
                <CheckCircle2 className="w-5 h-5 mr-2 text-[#00e5b3]" />
                <span>Conexão bem-sucedida! Tempo de resposta: {pingResult.pingTime}</span>
              </div>
            </div>
          )}

          {pingResult.status === 'error' && (
            <div className="mt-2 p-3 bg-[#3e1a1d] text-[#ff8b8b] rounded border border-[#56292c]">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 mr-2 text-[#ff5757]" />
                <span>Falha na conexão. Tente novamente.</span>
              </div>
            </div>
          )}

          {activeSymbols.length > 0 && (
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-[#e0e7ff]">Símbolos disponíveis (5 primeiros):</h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeSymbols.map((symbol, index) => (
                  <li key={index} className="p-2 bg-[#1f3158] rounded text-sm text-[#b3c3e0] border border-[#2a3e6a]">
                    <span className="font-medium text-white">{symbol.symbol}</span> - {symbol.display_name || symbol.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}