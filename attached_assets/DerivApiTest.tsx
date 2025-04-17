import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { derivAPI } from '@/lib/derivApi';

export default function DerivApiTest() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [tokenInfo, setTokenInfo] = useState<any>(null);
  const [apiUrl, setApiUrl] = useState<string>('');
  const [appId, setAppId] = useState<number>(0);
  const [isEnvironmentTokenUsed, setIsEnvironmentTokenUsed] = useState<boolean>(false);

  // Testar a conexão direta com a API da Deriv usando o token API configurado
  const testDirectConnection = async () => {
    try {
      setStatus('connecting');
      setMessage('Conectando à API da Deriv...');
      
      // Obter configurações antes de conectar
      setApiUrl('wss://ws.derivws.com/websockets/v3');
      
      // Usar appId (não podemos acessar a propriedade privada, então definimos manualmente)
      setAppId(71403); // App ID correto para esta aplicação
      
      // Se o usuário já estiver conectado, desconectar primeiro
      if (derivAPI.isConnected) {
        console.log("[TEST] Desconectando sessão existente antes de testar");
        derivAPI.disconnect(true);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Conectar sem token primeiro para testar o WebSocket básico
      console.log("[TEST] Tentando conectar sem token primeiro");
      await derivAPI.connect();
      
      console.log("[TEST] Conexão básica bem-sucedida");
      setMessage('Conexão básica com WebSocket estabelecida. Obtendo informações do servidor...');
      
      // Verificar status do servidor
      const serverStatus = await derivAPI.getServerStatus();
      console.log("[TEST] Status do servidor:", serverStatus);
      setServerInfo(serverStatus);
      
      // Desconectar da conexão pública
      derivAPI.disconnect();
      
      // Agora tentar com o token da API
      console.log("[TEST] Obtendo token de API da variável de ambiente");
      
      // Verificar se a variável de ambiente DERIV_API_TOKEN está definida
      const apiToken = import.meta.env.VITE_DERIV_API_TOKEN;
      
      // Variáveis de ambiente no frontend devem ter o prefixo VITE_
      if (!apiToken) {
        console.error("[TEST] Token de API não encontrado na variável de ambiente VITE_DERIV_API_TOKEN");
        throw new Error("Token de API não encontrado. Verifique se a variável de ambiente VITE_DERIV_API_TOKEN está configurada.");
      }
      
      setIsEnvironmentTokenUsed(true);
      setMessage('Token API encontrado. Autenticando...');
      
      // Conectar com o token
      console.log("[TEST] Tentando conectar com token API");
      await derivAPI.connect(apiToken);
      
      // Autorizar com o token
      console.log("[TEST] Autorizando com token API");
      const authResult = await derivAPI.authorize(apiToken);
      console.log("[TEST] Resultado da autorização:", authResult);
      
      if (!authResult || !authResult.authorize) {
        throw new Error("Falha na autorização com o token API");
      }
      
      setTokenInfo(authResult.authorize);
      setStatus('connected');
      setMessage('Conexão e autorização bem-sucedidas!');
      
    } catch (error: any) {
      console.error("[TEST] Erro durante teste de conexão:", error);
      setStatus('error');
      setMessage(`Erro: ${error.message || 'Erro desconhecido'}`);
      
      // Tentar desconectar em caso de erro
      try {
        derivAPI.disconnect(true);
      } catch (e) {
        console.error("[TEST] Erro ao desconectar após falha:", e);
      }
    }
  };

  return (
    <Card className="w-full md:w-[800px] mx-auto my-4 shadow-md border-border">
      <CardHeader>
        <CardTitle className="text-xl text-primary">Teste da API Deriv</CardTitle>
        <CardDescription>
          Teste direto de conexão com a API da Deriv usando token API configurado
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Status atual */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            {status === 'idle' && (
              <Badge variant="outline">Aguardando teste</Badge>
            )}
            {status === 'connecting' && (
              <Badge className="bg-yellow-500">Conectando...</Badge>
            )}
            {status === 'connected' && (
              <Badge className="bg-green-500">Conectado</Badge>
            )}
            {status === 'error' && (
              <Badge variant="destructive">Erro</Badge>
            )}
          </div>
          
          {/* Mensagem de status */}
          {message && (
            <Alert variant={status === 'error' ? 'destructive' : 'default'}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>
                {status === 'error' ? 'Erro no teste' : 'Status'}
              </AlertTitle>
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          )}
          
          {/* Informações de configuração */}
          <div className="rounded-md border p-4">
            <h3 className="text-sm font-medium mb-2">Configuração</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>URL da API:</div>
              <div>{apiUrl || 'Não detectado'}</div>
              
              <div>App ID:</div>
              <div>{appId || 'Não detectado'}</div>
              
              <div>Token API:</div>
              <div>{isEnvironmentTokenUsed ? 'Configurado ✓' : 'Não configurado'}</div>
            </div>
          </div>
          
          {/* Informações do servidor se disponíveis */}
          {serverInfo && (
            <>
              <Separator />
              <div className="rounded-md border p-4">
                <h3 className="text-sm font-medium mb-2">Informações do Servidor</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Versão:</div>
                  <div>{serverInfo.website_status?.version || 'N/A'}</div>
                  
                  <div>Status do site:</div>
                  <div>
                    {serverInfo.website_status?.site_status === 1 ? (
                      <span className="text-green-500 flex items-center">
                        <CheckCircle className="h-3 w-3 mr-1" /> Online
                      </span>
                    ) : (
                      <span className="text-red-500 flex items-center">
                        <XCircle className="h-3 w-3 mr-1" /> Offline
                      </span>
                    )}
                  </div>
                  
                  <div>Mensagem:</div>
                  <div>{serverInfo.website_status?.message || 'Sem mensagens'}</div>
                </div>
              </div>
            </>
          )}
          
          {/* Informações da conta se autenticado */}
          {tokenInfo && (
            <>
              <Separator />
              <div className="rounded-md border p-4">
                <h3 className="text-sm font-medium mb-2">Informações da Conta</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>ID da Conta:</div>
                  <div>{tokenInfo.loginid || 'N/A'}</div>
                  
                  <div>Nome:</div>
                  <div>{tokenInfo.fullname || 'N/A'}</div>
                  
                  <div>Saldo:</div>
                  <div>{tokenInfo.balance} {tokenInfo.currency}</div>
                  
                  <div>Tipo de Conta:</div>
                  <div>
                    {tokenInfo.is_virtual ? (
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">Demo</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-100 text-green-800">Real</Badge>
                    )}
                  </div>
                  
                  <div>Email:</div>
                  <div>{tokenInfo.email || 'N/A'}</div>
                </div>
              </div>
            </>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={() => {
            setStatus('idle');
            setMessage('');
            setServerInfo(null);
            setTokenInfo(null);
            setApiUrl('');
            setAppId(0);
            setIsEnvironmentTokenUsed(false);
            
            // Forçar desconexão para limpar qualquer estado
            try {
              derivAPI.disconnect(true);
            } catch (e) {
              console.error("Erro ao resetar estado:", e);
            }
          }}
        >
          Limpar
        </Button>
        
        <Button 
          onClick={testDirectConnection}
          disabled={status === 'connecting'}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {status === 'connecting' ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Testando...
            </>
          ) : (
            'Testar Conexão API'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}