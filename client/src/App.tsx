import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toast";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import AdminPage from "@/pages/admin";
import { BotPage } from "@/pages/bot-page";
import { TokenTestPage } from "@/pages/token-test-page";
import GestaoOperacionalPage from "@/pages/gestao-operacional-page";
import ChartPage from "@/pages/chart-page";
import SimpleChart from "@/pages/simple-chart";
import RealtimeDigits from "@/pages/realtime-digits";
import DigitDisplay from "@/pages/digit-display";
import DigitDisplayFixed from "@/pages/digit-display-fixed";
import DigitDisplayStats from "@/pages/digit-display-stats";
import DigitsFixed from "@/pages/digits-fixed";
import DigitStatsPage from "@/pages/digit-stats-page";
import { useTranslation } from 'react-i18next';
import { useToast } from "@/hooks/use-toast";

// Componente para verificar autenticação
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    // Inicializar arrays vazios se não existirem
    if (!localStorage.getItem('registered_users')) {
      localStorage.setItem('registered_users', JSON.stringify([]));
    }
    
    if (!localStorage.getItem('user_credentials')) {
      localStorage.setItem('user_credentials', JSON.stringify([]));
    }
    
    // Verificar se é administrador
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    console.log('[AUTH] ProtectedRoute - isAdmin:', isAdmin);
    
    // Verificar se o usuário está logado através do localStorage
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    console.log('[AUTH] ProtectedRoute - isLoggedIn:', isLoggedIn);
    
    // Verificar se há informações de conta da Deriv no localStorage
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    const hasDerivAccount = Boolean(storedAccountInfo);
    console.log('[AUTH] ProtectedRoute - hasDerivAccount:', hasDerivAccount);
    
    // Verificar credenciais de usuários registrados pelo admin
    let isRegisteredUser = false;
    const userEmail = localStorage.getItem('user_email');
    console.log('[AUTH] ProtectedRoute - userEmail:', userEmail);
    
    if (userEmail) {
      // Buscar credenciais de usuários
      const storedCredentials = localStorage.getItem('user_credentials');
      if (storedCredentials) {
        try {
          const credentials = JSON.parse(storedCredentials);
          isRegisteredUser = credentials.some((cred: any) => cred.email === userEmail);
          console.log('[AUTH] ProtectedRoute - Verificação de usuário registrado:', 
            isRegisteredUser ? 'Usuário está registrado' : 'Usuário não está registrado');
        } catch (error) {
          console.error('[AUTH] Erro ao analisar credenciais:', error);
        }
      }
    }
    
    // Verificar usuários registrados
    const registeredUsers = localStorage.getItem('registered_users');
    let users: any[] = [];
    
    try {
      users = registeredUsers ? JSON.parse(registeredUsers) : [];
      console.log('[AUTH] ProtectedRoute - Usuários registrados:', users.length);
    } catch (error) {
      console.error('[AUTH] Erro ao analisar lista de usuários:', error);
    }
    
    // Senha administrativa para acesso direto
    const adminPass = '234589@';
    
    // O acesso é liberado nas seguintes situações:
    // 1. Usuário é admin 
    // 2. Usuário está logado E é um usuário registrado
    // 3. Não há usuários registrados ainda (sistema inicial)
    const hasAccess = 
      isAdmin || 
      ((isLoggedIn || hasDerivAccount) && (isRegisteredUser || users.length === 0));
    
    if (hasAccess) {
      console.log('[AUTH] Acesso autorizado como:', 
        isAdmin ? 'Administrador' : 
        isRegisteredUser ? 'Usuário registrado' : 
        'Acesso inicial (sem usuários cadastrados)');
      
      setIsAuthenticated(true);
    } else {
      console.log('[AUTH] Acesso negado. Redirecionando para login');
      
      // Se o usuário está logado mas não está autorizado, exibir mensagem
      if (isLoggedIn || hasDerivAccount) {
        toast({
          title: 'Acesso não autorizado',
          description: 'Você não tem permissão para acessar esta página. Entre em contato com o administrador.',
          variant: 'destructive',
        });
        
        // Remover tokens para forçar novo login
        localStorage.removeItem('isLoggedIn');
      }
      
      setIsAuthenticated(false);
      // Redirecionar para a página de login se não autenticado
      setLocation('/login');
    }
  }, [setLocation, toast]);
  
  // Não renderizar nada até verificar a autenticação
  if (isAuthenticated === null) {
    return <div className="flex h-screen w-full items-center justify-center bg-[#0c1117]">
      <div className="flex flex-col items-center">
        <div className="animate-spin h-12 w-12 rounded-full border-4 border-dotted border-indigo-600"></div>
        <p className="mt-4 text-white">Verificando autenticação...</p>
      </div>
    </div>;
  }
  
  // Se autenticado, renderizar o componente
  if (isAuthenticated) {
    return <Component {...rest} />;
  }
  
  // Se não autenticado, redirecionamento é tratado pelo useEffect
  return null;
};

function App() {
  // Adicionar hook do i18n para garantir que a renderização seja atualizada quando o idioma mudar
  const { t, i18n } = useTranslation();
  
  // Efeito para registrar mudanças de idioma
  useEffect(() => {
    console.log(`[App] Idioma atual: ${i18n.language}`);
    
    // Evento de mudança de idioma
    const handleLanguageChange = (lng: string) => {
      console.log(`[App] Idioma alterado para: ${lng}`);
    };
    
    i18n.on('languageChanged', handleLanguageChange);
    
    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, [i18n]);
  
  return (
    <div className="App">
      <Toaster />
      {/* <ConfirmAccountSwitch /> */}
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/" component={() => {
          // Verificar se há parâmetros de autenticação da Deriv na URL
          const url = window.location.href;
          console.log('[AUTH] Verificando URL da raiz:', url);
          
          if (url.includes('acct1=') && url.includes('token1=')) {
            console.log('[AUTH] Tokens de autenticação da Deriv detectados na raiz');
            // Tem tokens de autenticação - processar e depois redirecionar para dashboard
            // Importar funções para processar os tokens
            import('@/lib/accountManager').then(({ extractAccountsFromUrl, saveAccounts, authorizeMultipleAccounts, authorizeAccount, updateAccountInfo }) => {
              (async () => {
                try {
                  // Extrair contas da URL
                  const accounts = extractAccountsFromUrl(url);
                  console.log('[AUTH] Contas extraídas da URL:', accounts);
                  
                  if (accounts.length > 0) {
                    // Salvar todas as contas no localStorage
                    saveAccounts(accounts);
                    console.log(`[AUTH] Armazenadas ${accounts.length} contas no localStorage`);
                    
                    // Sempre salvar o token principal para operações de trading
                    localStorage.setItem('deriv_oauth_token', accounts[0].token);
                    console.log('[AUTH] Token OAuth principal armazenado:', accounts[0].token.substring(0, 10) + '...');
                    
                    try {
                      // Autorização das contas
                      if (accounts.length > 1) {
                        console.log('[AUTH] Autorizando múltiplas contas...');
                        await authorizeMultipleAccounts(accounts);
                        
                        // Para múltiplas contas, ainda precisamos obter detalhes da primeira
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
                      console.log('[AUTH] Autenticação concluída com sucesso para todas as contas na raiz');
                      
                      // Também define o login normal como feito
                      localStorage.setItem('isLoggedIn', 'true');
                      
                      // Redirecionar para o dashboard
                      console.log('[AUTH] Redirecionando para dashboard depois de processar tokens...');
                      window.location.href = '/dashboard';
                      
                    } catch (authError: any) {
                      console.error('[AUTH] Erro durante autorização na raiz:', authError);
                      // Se houver erro, redirecionar para login
                      window.location.href = '/login';
                    }
                  } else {
                    console.error('[AUTH] Nenhuma conta encontrada nos parâmetros da URL');
                    window.location.href = '/login';
                  }
                } catch (error) {
                  console.error('[AUTH] Erro ao processar tokens na raiz:', error);
                  window.location.href = '/login';
                }
              })();
            });
            
            return <div className="flex h-screen w-full items-center justify-center bg-[#0c1117]">
              <div className="flex flex-col items-center">
                <div className="animate-spin h-12 w-12 rounded-full border-4 border-dotted border-indigo-600"></div>
                <p className="mt-4 text-white">Processando autenticação Deriv...</p>
              </div>
            </div>;
          } else {
            // Não tem tokens - redirecionar para login
            console.log('[AUTH] Sem tokens na URL, redirecionando para login');
            window.location.href = '/login';
            return null;
          }
        }} />
        <Route path="/dashboard" component={(props: any) => <ProtectedRoute component={Dashboard} {...props} />} />
        <Route path="/bot" component={(props: any) => <ProtectedRoute component={BotPage} {...props} />} />
        <Route path="/token-test" component={(props: any) => <ProtectedRoute component={TokenTestPage} {...props} />} />
        <Route path="/gestao-operacional" component={(props: any) => <ProtectedRoute component={GestaoOperacionalPage} {...props} />} />
        <Route path="/chart" component={(props: any) => <ProtectedRoute component={ChartPage} {...props} />} />
        <Route path="/simplechart" component={SimpleChart} />
        <Route path="/realtime" component={RealtimeDigits} />
        <Route path="/digits" component={DigitsFixed} />
        <Route path="/digit-stats" component={DigitStatsPage} />
      </Switch>
    </div>
  );
}

export default App;