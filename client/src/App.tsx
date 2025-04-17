import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toast";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import { BotPage } from "@/pages/bot-page";

// Componente para verificar autenticação
const ProtectedRoute = ({ component: Component, ...rest }: any) => {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    // Verificar se há informações de conta no localStorage
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    
    if (storedAccountInfo) {
      setIsAuthenticated(true);
    } else {
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
  const [location] = useLocation();
  
  return (
    <div className="App">
      <Toaster />
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={(props: any) => <ProtectedRoute component={Dashboard} {...props} />} />
        <Route path="/dashboard" component={(props: any) => <ProtectedRoute component={Dashboard} {...props} />} />
        <Route path="/bot" component={(props: any) => <ProtectedRoute component={BotPage} {...props} />} />
      </Switch>
    </div>
  );
}

export default App;