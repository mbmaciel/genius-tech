import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import TradingBot from "@/pages/trading-bot";
import ApiDebug from "@/pages/api-debug";
import Register from "@/pages/register";
import Login from "@/pages/login";
import Debug from "@/pages/debug";
import { useEffect } from "react";

function Router() {
  // Handle Deriv connection redirection - this handles the OAuth redirect from Deriv
  useEffect(() => {
    const handleDerivRedirect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token1');
      
      if (token) {
        // Store token and navigate to dashboard
        localStorage.setItem('deriv_api_token', token);
        
        // Notify the user about successful connection via console (for debugging)
        console.log("Deriv API token received from OAuth, stored successfully");
        
        // Clean the URL by removing the token parameter
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Set flag to force reconnect on dashboard load
        localStorage.setItem('force_reconnect', 'true');
        
        // Navigate to dashboard
        window.location.href = '/dashboard';
      }
    };

    handleDerivRedirect();
  }, []);

  return (
    <Switch>
      <Route path="/" component={Login}/>
      <Route path="/dashboard" component={Dashboard}/>
      <Route path="/trading-bot" component={TradingBot}/>
      <Route path="/register" component={Register}/>
      <Route path="/login" component={Login}/>
      <Route path="/api-debug" component={ApiDebug}/>
      <Route path="/debug" component={Debug}/>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
