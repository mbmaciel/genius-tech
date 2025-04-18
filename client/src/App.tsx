import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toast";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import { BotPage } from "@/pages/bot-page";
import { TokenTestPage } from "@/pages/token-test-page";
import { ConfirmAccountSwitch } from "@/components/dashboard/ConfirmAccountSwitch";

// Componente para verificar autenticação
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    // Verificar se o usuário está logado através do localStorage
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    // Ou verifica se há informações de conta da Deriv no localStorage
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    
    // O usuário está autenticado se estiver logado OU tiver informações da conta Deriv
    if (isLoggedIn || storedAccountInfo) {
      console.log('Usuário autenticado:', isLoggedIn ? 'Login local' : 'Conta Deriv');
      setIsAuthenticated(true);
    } else {
      console.log('Usuário não autenticado, redirecionando para login');
      setIsAuthenticated(false);
      // Redirecionar para a página de login se não autenticado
      setLocation('/login');
    }
  }, [setLocation]);
  
  // Não renderizar nada até verificar a autenticação
  if (isAuthenticated === null) {
    return <div>Carregando...</div>;
  }
  
  // Se autenticado, renderizar o componente
  if (isAuthenticated) {
    return <Component {...rest} />;
  }
  
  // Se não autenticado, redirecionamento é tratado pelo useEffect
  return null;
};

function App() {
  return (
    <div className="App">
      <Toaster />
      {/* <ConfirmAccountSwitch /> */}
      <Switch>
        <Route path="/login" component={Login} />
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
            
            return <div>Processando autenticação...</div>;
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
      </Switch>
    </div>
  );
}

export default App;