import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { extractAccountsFromUrl, saveAccounts } from '@/lib/accountManager';
import { Loader2 } from 'lucide-react';

// App ID da Deriv para OAuth
const APP_ID = 71403;

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const [oauthAccounts, setOauthAccounts] = useState<any[]>([]);

  // Efeito para verificar se há tokens na URL
  useEffect(() => {
    const processRedirectUrl = async () => {
      try {
        // Verificar se há parâmetros de conta/token na URL
        const url = window.location.href;
        if (url.includes('acct1=') && url.includes('token1=')) {
          setProcessingOAuth(true);
          
          // Extrair contas da URL
          const accounts = extractAccountsFromUrl(url);
          console.log('Contas extraídas da URL:', accounts);
          
          if (accounts.length > 0) {
            setOauthAccounts(accounts);
            
            // Salvar contas no localStorage
            saveAccounts(accounts);
            
            // Obter informações detalhadas da primeira conta
            await authorizeFirstAccount(accounts[0].token);
          } else {
            throw new Error('Nenhuma conta encontrada nos parâmetros da URL.');
          }
        }
      } catch (error) {
        console.error('Erro ao processar redirecionamento OAuth:', error);
        toast({
          title: 'Erro de Autenticação',
          description: error instanceof Error ? error.message : 'Erro ao processar autenticação',
          variant: 'destructive',
        });
        setProcessingOAuth(false);
      }
    };
    
    processRedirectUrl();
  }, [toast]);
  
  // Função para autorizar a primeira conta após redirecionamento OAuth
  const authorizeFirstAccount = async (token: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      try {
        // Estabelecer conexão WebSocket
        const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID);
        
        // Timeout para não ficar esperando indefinidamente
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Timeout ao autorizar conta.'));
        }, 15000);
        
        ws.onopen = () => {
          console.log('Conexão WebSocket aberta para autorização');
          const authRequest = {
            authorize: token
          };
          ws.send(JSON.stringify(authRequest));
        };
        
        ws.onmessage = (msg) => {
          try {
            const response = JSON.parse(msg.data);
            console.log('Resposta de autorização:', response);
            
            if (response.error) {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(response.error.message));
              return;
            }
            
            if (response.authorize) {
              clearTimeout(timeout);
              
              // Salvar informações detalhadas da conta
              const accountInfo = response.authorize;
              localStorage.setItem('deriv_account_info', JSON.stringify(accountInfo));
              
              toast({
                title: 'Autenticação Bem-sucedida',
                description: `Bem-vindo, ${accountInfo.email || accountInfo.loginid}!`,
              });
              
              // Redirecionar para o dashboard
              setTimeout(() => {
                setProcessingOAuth(false);
                setLocation('/dashboard');
              }, 1000);
              
              ws.close();
              resolve();
            }
          } catch (e) {
            console.error('Erro ao processar mensagem WebSocket:', e);
          }
        };
        
        ws.onerror = (error) => {
          console.error('Erro na conexão WebSocket:', error);
          clearTimeout(timeout);
          ws.close();
          reject(new Error('Falha na comunicação com a API da Deriv.'));
        };
        
        ws.onclose = () => {
          console.log('Conexão WebSocket fechada');
        };
      } catch (error) {
        reject(error);
      }
    });
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulação de login bem-sucedido - na implementação real, isso seria uma chamada à API
    setTimeout(() => {
      setIsLoading(false);
      
      // Apenas para demonstração - normalmente verificaria credenciais
      if (email && password) {
        localStorage.setItem('isLoggedIn', 'true');
        setLocation('/dashboard');
        
        toast({
          title: 'Login bem-sucedido',
          description: 'Bem-vindo à plataforma de trading!',
        });
      } else {
        toast({
          title: 'Erro de login',
          description: 'Por favor, preencha todos os campos.',
          variant: 'destructive',
        });
      }
    }, 1000);
  };

  // UI diferente se estiver processando OAuth
  if (processingOAuth) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c1117] p-4">
        <Card className="w-full max-w-md bg-[#151b25] border-slate-800 text-white">
          <CardHeader>
            <CardTitle className="text-xl text-center">Processando Autenticação</CardTitle>
            <CardDescription className="text-center text-slate-400">
              Autorizando conta da Deriv...
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
              <p className="text-slate-300 text-center">
                Aguarde enquanto processamos sua autenticação com a Deriv
              </p>
              {oauthAccounts.length > 0 && (
                <div className="bg-[#1d2a45] p-4 rounded mt-4 w-full">
                  <p className="text-sm text-slate-300 mb-2">Contas encontradas:</p>
                  {oauthAccounts.map((acc, index) => (
                    <div key={index} className="text-xs text-slate-400 mb-1 flex justify-between">
                      <span>{acc.loginid}</span>
                      <span>{acc.currency.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // UI normal de login
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c1117]">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">ONE BOT PREMIUM</h1>
        <div className="text-slate-400 text-center max-w-md">
          <h2 className="text-xl font-medium mb-1">Área de membros</h2>
          <p>A maior inovação no mercado de operações automatizadas!</p>
        </div>
      </div>

      <Card className="w-full max-w-md bg-[#151b25] border-slate-800 text-white">
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">E-mail / Login</label>
              <Input 
                type="email" 
                placeholder="Digite o seu e-mail" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0c1117] border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">Senha</label>
              <Input 
                type="password" 
                placeholder="Digite a sua senha" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0c1117] border-slate-700 text-white"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Login'}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm text-slate-400">
            Não possui conta? <a href="/register" className="text-indigo-400 hover:underline">Cadastre-se agora mesmo</a>.
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700">
            <Button 
              onClick={() => {
                // URL de autorização OAuth da Deriv
                const scope = 'read admin payments trade';
                const redirectUri = encodeURIComponent(window.location.origin);
                const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;
                window.location.href = authUrl;
              }}
              variant="outline"
              className="w-full bg-transparent border-indigo-600 hover:bg-indigo-600/10 text-indigo-400"
            >
              Conectar com Deriv
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-slate-500 text-center text-sm">
        &copy; {new Date().getFullYear()} Genius Technology Trading. Todos os direitos reservados.
      </div>
    </div>
  );
}