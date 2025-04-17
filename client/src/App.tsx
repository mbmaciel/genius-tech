import { Route, Switch } from "wouter";
import { Toaster } from "@/components/ui/toast";
import Login from "@/pages/login";
import OAuthCallback from "@/pages/oauth-callback";
import Dashboard from "@/pages/dashboard";
import BotPage from "@/pages/bot-page";
import { useEffect } from "react";

export default function App() {
  // Verificar se há um token salvo ao iniciar a aplicação
  useEffect(() => {
    // Inicialização, se necessário
    console.log("Aplicação iniciada");
  }, []);

  return (
    <>
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/oauth-callback" component={OAuthCallback} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/bot" component={BotPage} />
        <Route>
          {/* Rota 404 - redireciona para Login */}
          <Login />
        </Route>
      </Switch>
      <Toaster />
    </>
  );
}