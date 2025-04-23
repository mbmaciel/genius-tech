import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

// App ID da Deriv para OAuth
const APP_ID = 71403;

export default function OAuthCallback() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<any>(null);

  useEffect(() => {
    // Extrair o código de autorização da URL
    const processOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        
        if (!code) {
          throw new Error('Código de autorização não encontrado na URL.');
        }

        // Estabelecer conexão WebSocket com a Deriv
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID);
        
        ws.onopen = () => {
          console.log('Conexão OAuth estabelecida');
          
          // Solicitar token de acesso usando o código OAuth
          const request = {
            oauth_token: code
          };
          
          ws.send(JSON.stringify(request));
        };
        
        ws.onmessage = (msg) => {
          const response = JSON.parse(msg.data);
          console.log('Resposta OAuth:', response);
          
          if (response.error) {
            setError(response.error.message);
            setProcessing(false);
            ws.close();
            
            toast({
              title: 'Erro de Autenticação',
              description: response.error.message,
              variant: 'destructive',
            });
            return;
          }
          
          // Token de acesso obtido com sucesso
          if (response.oauth_token) {
            const token = response.oauth_token.access_token;
            
            // Usar o token para obter informações da conta
            const authRequest = {
              authorize: token
            };
            
            ws.send(JSON.stringify(authRequest));
            return;
          }
          
          // Resposta de autorização recebida
          if (response.authorize) {
            const account = response.authorize;
            
            // Armazenar token e informações da conta no localStorage
            localStorage.setItem('deriv_token', account.token || '');
            localStorage.setItem('deriv_account_info', JSON.stringify(account));
            
            setAccountInfo(account);
            setProcessing(false);
            ws.close();
            
            toast({
              title: 'Autenticação Bem-sucedida',
              description: `Bem-vindo, ${account.email || account.loginid}!`,
            });
            
            // Redirecionar para o dashboard após um breve atraso
            setTimeout(() => {
              setLocation('/dashboard');
            }, 2000);
          }
        };
        
        ws.onerror = (error) => {
          console.error('Erro na conexão WebSocket:', error);
          setError('Falha na comunicação com a API da Deriv. Tente novamente.');
          setProcessing(false);
          
          toast({
            title: 'Erro de Conexão',
            description: 'Não foi possível estabelecer conexão com a Deriv.',
            variant: 'destructive',
          });
        };
        
        ws.onclose = () => {
          console.log('Conexão WebSocket fechada');
          
          if (processing && !accountInfo && !error) {
            setError('A conexão foi fechada inesperadamente. Por favor, tente novamente.');
            setProcessing(false);
            
            toast({
              title: 'Conexão Interrompida',
              description: 'A conexão com a Deriv foi encerrada. Tente novamente.',
              variant: 'destructive',
            });
          }
        };
        
        // Timeout para evitar que a página fique processando indefinidamente
        setTimeout(() => {
          if (processing) {
            setProcessing(false);
            setError('Tempo limite excedido. Tente novamente.');
            ws.close();
            
            toast({
              title: 'Tempo Excedido',
              description: 'O processo de autenticação demorou muito. Tente novamente.',
              variant: 'destructive',
            });
          }
        }, 30000);
        
      } catch (err) {
        console.error('Erro ao processar OAuth:', err);
        setError(typeof err === 'object' && err !== null && 'message' in err
          ? (err as Error).message
          : 'Erro desconhecido durante a autenticação');
        setProcessing(false);
        
        toast({
          title: 'Erro de Autenticação',
          description: 'Ocorreu um erro durante o processo de autenticação.',
          variant: 'destructive',
        });
      }
    };
    
    processOAuth();
  }, [location, setLocation, toast]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c1117] p-4">
      <Card className="w-full max-w-md bg-[#151b25] border-slate-800 text-white">
        <CardHeader>
          <CardTitle className="text-xl text-center">Processando Autenticação</CardTitle>
          <CardDescription className="text-center text-slate-400">
            {processing 
              ? 'Conectando com a Deriv...' 
              : (error 
                ? 'Falha na autenticação' 
                : 'Autenticação concluída!')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="flex flex-col items-center justify-center py-6">
          {processing ? (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
              <p className="text-slate-300 text-center">
                Aguarde enquanto processamos sua autenticação com a Deriv
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-red-500/20 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 h-6 w-6">
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="m15 9-6 6" />
                  <path d="m9 9 6 6" />
                </svg>
              </div>
              <p className="text-red-400 text-center">{error}</p>
              <Button 
                onClick={() => setLocation('/login')} 
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Voltar para Login
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              <div className="rounded-full bg-green-500/20 p-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 h-6 w-6">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              </div>
              <p className="text-green-400 text-center">
                Autenticação concluída com sucesso!
              </p>
              <p className="text-slate-400 text-center">
                Redirecionando para o dashboard...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}