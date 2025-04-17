import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { derivAPI } from '@/lib/derivApi';
import { RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function ApiTester() {
  const [token, setToken] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [connectionInfo, setConnectionInfo] = useState<any>(null);
  
  // Carregar token salvo do localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_api_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);
  
  // Testar conexão com o token atual
  const testConnection = async () => {
    if (!token) {
      setStatus('error');
      setMessage('Por favor, forneça um token para testar');
      return;
    }
    
    try {
      setStatus('loading');
      setMessage('Testando conexão com a API...');
      
      // Limpar todas as conexões existentes
      derivAPI.disconnect(true, false);
      
      // Esperar um pouco para garantir que a desconexão seja completa
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Salvar token para uso posterior
      localStorage.setItem('deriv_api_token', token);
      
      // Conectar usando o token
      const connectResult = await derivAPI.connect(token);
      
      if (!connectResult.connected) {
        throw new Error('Não foi possível estabelecer conexão WebSocket');
      }
      
      // Autorizar com o token
      const authResult = await derivAPI.send({
        authorize: token
      });
      
      if (authResult.error) {
        throw new Error(`Erro de autorização: ${authResult.error.message}`);
      }
      
      if (!authResult.authorize) {
        throw new Error('Resposta de autorização vazia');
      }
      
      // Salvar informações da autorização
      setConnectionInfo({
        loginid: authResult.authorize.loginid,
        fullname: authResult.authorize.fullname,
        balance: authResult.authorize.balance,
        currency: authResult.authorize.currency,
        email: authResult.authorize.email,
        accounts: authResult.authorize.account_list ? 
          authResult.authorize.account_list.map((acc: any) => ({
            loginid: acc.loginid,
            currency: acc.currency,
            isVirtual: !!acc.is_virtual
          })) : []
      });
      
      setStatus('success');
      setMessage(`Conectado com sucesso como ${authResult.authorize.loginid} (${authResult.authorize.fullname})`);
      
      // Salvar token específico para esta conta também
      if (authResult.authorize.loginid) {
        localStorage.setItem(`deriv_verified_token_${authResult.authorize.loginid}`, token);
        localStorage.setItem(`deriv_token_${authResult.authorize.loginid.toLowerCase()}`, token);
        
        // Atualizar o mapa de tokens
        try {
          const tokenMap: Record<string, string> = {};
          const existingMap = localStorage.getItem('deriv_account_token_map');
          if (existingMap) {
            Object.assign(tokenMap, JSON.parse(existingMap));
          }
          tokenMap[authResult.authorize.loginid] = token;
          tokenMap[authResult.authorize.loginid.toLowerCase()] = token;
          localStorage.setItem('deriv_account_token_map', JSON.stringify(tokenMap));
        } catch (e) {
          console.error('Erro ao atualizar mapa de tokens:', e);
        }
        
        // Marcar esta conta como ativa
        localStorage.setItem('deriv_active_account', authResult.authorize.loginid);
      }
      
      // Obter saldo para confirmar
      const balanceResult = await derivAPI.getBalance();
      console.log('Resultado do saldo:', balanceResult);
      
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      setStatus('error');
      setMessage(`Erro: ${error.message || 'Erro desconhecido'}`);
      setConnectionInfo(null);
    }
  };
  
  return (
    <div className="p-4 border rounded-lg bg-card shadow-sm space-y-4">
      <h3 className="text-lg font-medium">Teste Direto de Conexão API</h3>
      
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Use esta ferramenta para testar diretamente a conexão com a API Deriv usando um token específico.
        </p>
        
        <div className="flex gap-2">
          <Input 
            value={token} 
            onChange={e => setToken(e.target.value)}
            placeholder="Token da API Deriv"
            type="password"
            className="flex-1"
          />
          <Button onClick={testConnection} disabled={status === 'loading'}>
            {status === 'loading' ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <></>
            )}
            Testar Conexão
          </Button>
        </div>
        
        {message && (
          <Alert variant={status === 'error' ? 'destructive' : status === 'success' ? 'default' : 'outline'}>
            {status === 'error' ? (
              <AlertCircle className="h-4 w-4 mr-2" />
            ) : status === 'success' ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : null}
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
        
        {connectionInfo && (
          <div className="mt-4 p-3 bg-muted/30 rounded-md border space-y-2 text-sm">
            <h4 className="font-medium">Informações da Conta</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>ID de Login:</div>
              <div className="font-mono">{connectionInfo.loginid}</div>
              
              <div>Nome:</div>
              <div>{connectionInfo.fullname}</div>
              
              <div>Email:</div>
              <div>{connectionInfo.email}</div>
              
              <div>Saldo:</div>
              <div>{connectionInfo.balance} {connectionInfo.currency}</div>
            </div>
            
            {connectionInfo.accounts && connectionInfo.accounts.length > 0 && (
              <div className="mt-2">
                <h5 className="font-medium mb-1">Contas Disponíveis:</h5>
                <ul className="space-y-1">
                  {connectionInfo.accounts.map((acc: any, index: number) => (
                    <li key={index} className="flex items-center space-x-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${acc.isVirtual ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      <span>{acc.loginid} ({acc.currency || 'USD'}) - {acc.isVirtual ? 'Demo' : 'Real'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        <div className="text-xs text-muted-foreground mt-2">
          <p>
            <strong>Dica:</strong> Se a conexão for bem-sucedida, o token será salvo e usado para as operações
            subsequentes. Pode ser necessário recarregar a página para que as alterações tenham efeito.
          </p>
        </div>
      </div>
    </div>
  );
}