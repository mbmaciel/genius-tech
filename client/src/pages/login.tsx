import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  extractAccountsFromUrl, 
  saveAccounts, 
  authorizeAccount, 
  authorizeMultipleAccounts,
  updateAccountInfo
} from '@/lib/accountManager';
import { Loader2, ShieldAlert } from 'lucide-react';

// App ID da Deriv para OAuth
const APP_ID = 72383;

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [processingOAuth, setProcessingOAuth] = useState(false);
  const [oauthAccounts, setOauthAccounts] = useState<any[]>([]);
  
  // Estado para o modal de autenticação admin
  const [adminPassword, setAdminPassword] = useState('');
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);

  // Efeito para verificar status de login apenas em ambientes de produção
  // Desabilitado para permitir visualizar a página de login para testes
  
  // Efeito para verificar se há tokens na URL
  useEffect(() => {
    const processRedirectUrl = async () => {
      try {
        // Verificar se há parâmetros de conta/token na URL
        const url = window.location.href;
        console.log('[AUTH] Verificando URL de redirecionamento:', url);
        
        // Verificar se a URL contém os parâmetros de token da Deriv
        if (url.includes('acct1=') && url.includes('token1=')) {
          console.log('[AUTH] Detectados parâmetros de autenticação da Deriv na URL');
          setProcessingOAuth(true);
          
          // Extrair contas da URL
          const accounts = extractAccountsFromUrl(url);
          console.log('[AUTH] Contas extraídas da URL:', accounts);
          
          if (accounts.length > 0) {
            setOauthAccounts(accounts);
            
            // Salvar todas as contas no localStorage
            saveAccounts(accounts);
            console.log(`[AUTH] Armazenadas ${accounts.length} contas no localStorage`);
            
            // Sempre salvar o token principal para operações de trading
            // Este é o token que será usado para comprar/vender contratos
            localStorage.setItem('deriv_oauth_token', accounts[0].token);
            console.log('[AUTH] Token OAuth principal armazenado:', accounts[0].token.substring(0, 10) + '...');
            
            try {
              // Autorização das contas
              if (accounts.length > 1) {
                console.log('[AUTH] Autorizando múltiplas contas...');
                await authorizeMultipleAccounts(accounts);
                
                // Para múltiplas contas, ainda precisamos obter detalhes da primeira
                // para garantir que temos as informações completas no accountInfo
                const primaryAccountInfo = await authorizeAccount(accounts[0].token);
                localStorage.setItem('deriv_account_info', JSON.stringify(primaryAccountInfo));
              } else {
                // Para apenas uma conta, autorizar e salvar detalhes
                console.log('[AUTH] Autorizando conta única...');
                const accountInfo = await authorizeAccount(accounts[0].token);
                
                // Salvar informações detalhadas da conta principal
                localStorage.setItem('deriv_account_info', JSON.stringify(accountInfo));
                
                // Atualiza as informações da conta no registro de contas
                updateAccountInfo(accounts[0].loginid, {
                  fullAccountInfo: accountInfo,
                  email: accountInfo.email,
                  name: accountInfo.fullname,
                  balance: accountInfo.balance
                });
              }
              
              // Log de sucesso
              console.log('[AUTH] Autenticação concluída com sucesso para todas as contas');
              
              // Exibe mensagem de sucesso
              toast({
                title: 'Autenticação Bem-sucedida',
                description: `${accounts.length} conta(s) autorizada(s) com sucesso!`,
              });
              
              // Também define o login normal como feito
              localStorage.setItem('isLoggedIn', 'true');
              
              // Forçar o redirecionamento direto para o dashboard
              console.log('[AUTH] Redirecionando para dashboard...');
              window.location.href = '/dashboard';
              
            } catch (authError: any) {
              const errorMessage = authError && authError.message ? authError.message : 'Erro desconhecido';
              console.error('[AUTH] Erro durante autorização:', errorMessage);
              throw new Error(`Falha na autorização: ${errorMessage}`);
            }
          } else {
            throw new Error('Nenhuma conta encontrada nos parâmetros da URL.');
          }
        }
      } catch (error) {
        console.error('Erro ao processar redirecionamento OAuth:', error);
        // Mostra um erro mais detalhado para o usuário
        toast({
          title: 'Erro de Autenticação',
          description: error instanceof Error ? error.message : 'Erro ao processar autenticação',
          variant: 'destructive',
          duration: 10000, // Duração mais longa para mensagens de erro
        });
        setProcessingOAuth(false);
        
        // Se aconteceu um erro, podemos mostrar um botão para tentar novamente
        setOauthAccounts([]);
      }
    };
    
    processRedirectUrl();
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('[AUTH] Iniciando processo de login para:', email);
    setIsLoading(true);

    // Verificar se os campos foram preenchidos
    if (!email || !password) {
      setIsLoading(false);
      console.log('[AUTH] Erro: campos em branco');
      
      toast({
        title: 'Erro de login',
        description: 'Por favor, preencha todos os campos.',
        variant: 'destructive',
      });
      return;
    }
    
    // Verificar se é um acesso de administrador
    if (email === 'admin@teste.com' && password === 'admin123') {
      // Admin inicial autorizado
      console.log('[AUTH] Login com admin inicial');
      
      toast({
        title: 'Login de configuração',
        description: 'Bem-vindo ao acesso de configuração inicial.',
      });
      
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('isLoggedIn', 'true');
      
      // Redirecionar para o painel admin
      setTimeout(() => {
        window.location.href = '/admin';
      }, 500);
      return;
    }
    
    // Verificar senha administrativa de acesso rápido ao painel
    if (password === '234589@') {
      console.log('[AUTH] Login direto com senha de administração');
      
      toast({
        title: 'Acesso Administrativo',
        description: 'Acesso direto ao painel de administração autorizado.',
      });
      
      localStorage.setItem('isAdmin', 'true');
      localStorage.setItem('isLoggedIn', 'true');
      
      // Redirecionar para o painel admin
      setTimeout(() => {
        window.location.href = '/admin';
      }, 500);
      return;
    }
    
    try {
      // Primeiro tentar autenticar com o banco de dados
      console.log('[AUTH] Tentando verificar credenciais no banco de dados');
      
      // Fazer uma requisição para verificar as credenciais no banco
      const response = await fetch('/api/user-credentials');
      let foundInDatabase = false;
      let databaseUsers: any[] = [];
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data) {
          // Usuários encontrados no banco
          databaseUsers = result.data;
          console.log('[AUTH] Verificando credenciais entre ' + databaseUsers.length + ' usuários no banco de dados');
          
          // Verificar credenciais
          const foundUser = databaseUsers.find(user => 
            user.email === email && user.password === password
          );
          
          if (foundUser) {
            foundInDatabase = true;
            console.log('[AUTH] Usuário autenticado com o banco de dados:', email);
            
            // Atualizar localStorage para compatibilidade
            const userFormatted = {
              id: foundUser.id.toString(),
              email: foundUser.email,
              name: foundUser.email.split('@')[0], // Nome padrão
              isActive: true,
              createdAt: foundUser.created_at,
              lastLogin: new Date().toISOString()
            };
            
            // Salvar no localStorage para compatibilidade
            const registeredUsers = localStorage.getItem('registered_users');
            const users = registeredUsers ? JSON.parse(registeredUsers) : [];
            
            // Verificar se o usuário já existe no localStorage
            const existingUserIndex = users.findIndex((u: any) => u.email === email);
            
            if (existingUserIndex >= 0) {
              // Atualizar usuário existente
              users[existingUserIndex] = {
                ...users[existingUserIndex],
                lastLogin: new Date().toISOString()
              };
            } else {
              // Adicionar novo usuário
              users.push(userFormatted);
            }
            
            localStorage.setItem('registered_users', JSON.stringify(users));
            
            // Atualizar credenciais simplificadas para login
            const storedCredentials = localStorage.getItem('user_credentials');
            const credentials = storedCredentials ? JSON.parse(storedCredentials) : [];
            
            const existingCredIndex = credentials.findIndex((c: any) => c.email === email);
            
            if (existingCredIndex >= 0) {
              // Atualizar credencial existente
              credentials[existingCredIndex] = {
                email: email,
                password: password
              };
            } else {
              // Adicionar nova credencial
              credentials.push({
                email: email,
                password: password
              });
            }
            
            localStorage.setItem('user_credentials', JSON.stringify(credentials));
            
            // Atualizar status no localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user_email', email);
            
            // Feedback
            toast({
              title: 'Login bem-sucedido',
              description: 'Bem-vindo à plataforma de trading!',
            });
            
            // Redirecionar para o dashboard
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 500);
            
            return;
          }
        }
      }
      
      // Se não encontrou no banco, tenta no localStorage como fallback
      if (!foundInDatabase) {
        console.log('[AUTH] Usuário não encontrado no banco, verificando localStorage');
        
        const registeredUsers = localStorage.getItem('registered_users');
        const storedCredentials = localStorage.getItem('user_credentials');
        
        // Usuários existem no localStorage?
        if (storedCredentials && registeredUsers) {
          // Analisar os dados armazenados
          const credentials = JSON.parse(storedCredentials);
          const users = JSON.parse(registeredUsers);
          
          console.log('[AUTH] Verificando credenciais entre ' + credentials.length + ' usuários no localStorage');
          
          // Verificar se o usuário está cadastrado e a senha está correta
          const userCredential = credentials.find((cred: any) => 
            cred.email === email && cred.password === password
          );
          
          if (userCredential) {
            // O usuário existe e a senha está correta
            // Verificar se o usuário está ativo
            const userInfo = users.find((user: any) => user.email === email);
            
            if (userInfo && !userInfo.isActive) {
              setIsLoading(false);
              toast({
                title: 'Conta desativada',
                description: 'Sua conta foi desativada. Entre em contato com o administrador.',
                variant: 'destructive',
              });
              return;
            }
            
            // Credenciais válidas e usuário ativo
            console.log('[AUTH] Login bem-sucedido com localStorage para:', email);
            
            // Atualizar status no localStorage
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('user_email', email);
            
            // Atualizar última data de login
            const updatedUsers = users.map((user: any) => {
              if (user.email === email) {
                return {
                  ...user,
                  lastLogin: new Date().toISOString()
                };
              }
              return user;
            });
            
            // Salvar dados atualizados
            localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
            
            // Feedback
            toast({
              title: 'Login bem-sucedido',
              description: 'Bem-vindo à plataforma de trading!',
            });
            
            // Redirecionar para o dashboard
            setTimeout(() => {
              window.location.href = '/dashboard';
            }, 500);
            return;
          }
        }
        
        // Concatenar todos os usuários para verificar se o email existe
        const allCredentials = [...databaseUsers];
        if (storedCredentials) {
          const localCreds = JSON.parse(storedCredentials);
          allCredentials.push(...localCreds);
        }
        
        // Credenciais incorretas - verificar se o email existe
        const userExists = allCredentials.some((cred: any) => cred.email === email);
        
        // Log detalhado para depuração
        console.log('[AUTH] Credenciais incorretas. Email existe:', userExists ? 'Sim' : 'Não');
        
        setIsLoading(false);
        
        // Forçar a renderização do toast sem o timeout
        if (userExists) {
          // O email existe, mas a senha está incorreta
          console.log('[AUTH] Senha incorreta para email:', email);
          
          // Usar setTimeout para garantir que o toast será exibido
          setTimeout(() => {
            toast({
              title: 'Senha incorreta',
              description: 'A senha fornecida não corresponde a este usuário.',
              variant: 'destructive',
              duration: 5000, // Duração mais longa para garantir visibilidade
            });
          }, 100);
        } else {
          // O email não está cadastrado
          console.log('[AUTH] Usuário não encontrado:', email);
          
          // Usar setTimeout para garantir que o toast será exibido
          setTimeout(() => {
            toast({
              title: 'Usuário não encontrado',
              description: 'Este email não está cadastrado no sistema.',
              variant: 'destructive',
              duration: 5000, // Duração mais longa para garantir visibilidade
            });
          }, 100);
        }
      }
    } catch (error) {
      console.error('[AUTH] Erro ao processar credenciais:', error);
      setIsLoading(false);
      toast({
        title: 'Erro de autenticação',
        description: 'Ocorreu um erro ao verificar suas credenciais.',
        variant: 'destructive',
      });
    }
    
    // Sempre garantir que o estado de loading está desativado após o processamento
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  // UI diferente se estiver processando OAuth
  if (processingOAuth) {
    // Verificar se temos contas mas houve erro de processamento
    const hasError = oauthAccounts.length > 0 && !localStorage.getItem('deriv_account_info');
    
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c1117] p-4">
        <Card className="w-full max-w-md bg-[#151b25] border-slate-800 text-white">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              {hasError ? 'Erro na Autenticação' : 'Processando Autenticação'}
            </CardTitle>
            <CardDescription className="text-center text-slate-400">
              {hasError ? 'Ocorreu um erro ao autorizar sua conta' : 'Autorizando conta da Deriv...'}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="flex flex-col items-center space-y-4">
              {hasError ? (
                <div className="text-red-500 mb-4 rounded-full bg-red-500/10 p-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              ) : (
                <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
              )}
              
              <p className="text-slate-300 text-center">
                {hasError
                  ? 'Não foi possível autorizar sua conta com os tokens fornecidos.'
                  : 'Aguarde enquanto processamos sua autenticação com a Deriv'}
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
              
              {hasError && (
                <Button 
                  onClick={() => setProcessingOAuth(false)}
                  className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Voltar para o Login
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Função para iniciar o fluxo de OAuth com a Deriv
  const handleDerivLogin = () => {
    // URL base da Deriv para OAuth
    const derivBaseUrl = "https://oauth.deriv.com/oauth2/authorize";
    
    // Obter a URL atual para redirecionamento
    // Deriv exige que seja a mesma URL exata que receberá os parâmetros depois
    // Não podemos usar a URL completa do login pois o redirecionamento deve ser para a mesma URL
    const currentUrl = window.location.href;
    // Vamos usar a própria URL de login como redirecionamento
    // isso garantirá que os parâmetros acct1, token1, etc serão recebidos nesta mesma página
    
    // Parâmetros da solicitação
    const params = new URLSearchParams({
      app_id: APP_ID.toString(),
      l: "pt", // Idioma português
      brand: "deriv", // Marca da Deriv
    });
    
    // URL completa para redirecionamento
    const redirectUrl = `${derivBaseUrl}?${params.toString()}`;
    console.log('[AUTH] Iniciando processo de login na Deriv via OAuth:', redirectUrl);
    console.log('[AUTH] Quando autorizado, a Deriv redirecionará de volta para esta página com os tokens');
    
    // Redirecionamento para página de login da Deriv
    window.location.href = redirectUrl;
  };
  
  // Função para validar acesso ao painel de administração
  const handleAdminAuth = () => {
    setAdminAuthLoading(true);
    
    // Verificar senha de administrador
    setTimeout(() => {
      if (adminPassword === '234589@') {
        // Senha correta
        toast({
          title: 'Acesso Autorizado',
          description: 'Bem-vindo ao painel de administração',
        });
        
        // Salvar status de admin no localStorage
        localStorage.setItem('isAdmin', 'true');
        
        // Redirecionar para a página de admin
        window.location.href = '/admin';
      } else {
        // Senha incorreta
        toast({
          title: 'Acesso Negado',
          description: 'Senha de administração incorreta',
          variant: 'destructive',
        });
      }
      
      setAdminAuthLoading(false);
      setAdminPassword('');
    }, 500);
  };

  // UI normal de login
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c1117]">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">GENIUS TECHNOLOGY TRADING</h1>
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
        </CardContent>
      </Card>
      
      <div className="mt-8 text-slate-500 text-center text-sm flex flex-col items-center space-y-4">
        <div>&copy; {new Date().getFullYear()} Genius Technology Trading. Todos os direitos reservados.</div>
        
        {/* Dialog Modal para Autenticação do Admin */}
        <Dialog open={adminDialogOpen} onOpenChange={setAdminDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="bg-transparent border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white">
              <ShieldAlert className="w-4 h-4 mr-2" />
              Painel Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-[#151b25] border-slate-800 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Acesso Administrativo</DialogTitle>
              <DialogDescription className="text-slate-400">
                Digite a senha de administrador para acessar o painel de gerenciamento.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm text-slate-400">Senha de Administrador</label>
                <Input 
                  type="password" 
                  placeholder="Digite a senha de administrador" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="bg-[#0c1117] border-slate-700 text-white"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button 
                onClick={handleAdminAuth}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={adminAuthLoading}
              >
                {adminAuthLoading ? (
                  <div className="flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Verificando...</span>
                  </div>
                ) : (
                  "Entrar como Admin"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}