import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from '@/hooks/use-toast';
import derivAPI from '@/lib/derivApi';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';

export function DerivConnect() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // Check connection status when component mounts
  useEffect(() => {
    const connectionStatus = derivAPI.getConnectionStatus();
    setIsConnected(connectionStatus);
    
    // Listen for connection status changes
    const handleConnectionStatus = (event: CustomEvent) => {
      setIsConnected(event.detail.connected);
    };
    
    document.addEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    
    return () => {
      document.removeEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    };
  }, []);
  
  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      // Try to connect with existing token first
      const connected = await derivAPI.connect();
      
      // If we have a token but couldn't connect, something went wrong
      if (!connected && derivAPI.getToken()) {
        toast({
          title: "Erro de Conexão",
          description: "O token salvo é inválido ou expirou. Por favor, realize o login novamente.",
          variant: "destructive",
        });
        // Clear stored token
        localStorage.removeItem('deriv_api_token');
      }
      
      // If no token or connection failed, redirect to Deriv OAuth
      if (!connected) {
        initiateOAuth();
      } else {
        toast({
          title: "Conexão Estabelecida",
          description: "Conectado com sucesso à API Deriv.",
        });
      }
    } catch (error) {
      console.error('Connection error:', error);
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar à API Deriv. Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  const initiateOAuth = () => {
    const appId = '72383'; // App ID da Deriv atualizado
    const apiToken = 'P1x412DJ8Oc0Ych'; // API Token fornecido
    
    // Get the current domain for redirect
    const redirect_uri = `${window.location.origin}/`;
    
    // Create the OAuth URL
    const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=PT&redirect_uri=${encodeURIComponent(redirect_uri)}`;
    
    // Salvar o API token no localStorage para uso posterior
    localStorage.setItem('deriv_api_token', apiToken);
    
    // Redirect to Deriv's OAuth page
    window.location.href = oauthUrl;
  };
  
  const handleDisconnect = () => {
    try {
      derivAPI.disconnect(true);
      
      toast({
        title: "Desconectado",
        description: "Você foi desconectado da API Deriv.",
      });
    } catch (error) {
      console.error('Disconnect error:', error);
      toast({
        title: "Erro ao Desconectar",
        description: "Ocorreu um erro ao tentar desconectar.",
        variant: "destructive",
      });
    }
  };
  
  return (
    <Card className="bg-[#162746] border-[#1c3654]">
      <CardHeader>
        <CardTitle className="text-white">Conectar à Deriv</CardTitle>
        <CardDescription>
          Conecte-se à sua conta Deriv para começar a operar
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-[#00e5b3]' : 'bg-red-500'}`}></div>
          <span className="text-sm text-white">{isConnected ? 'Conectado' : 'Desconectado'}</span>
        </div>
        
        <p className="text-sm text-[#8492b4] mb-4">
          {isConnected
            ? "Você está conectado à API Deriv. Você pode acessar todas as funcionalidades de trading."
            : "Conecte-se à API Deriv para acessar todas as funcionalidades de trading."}
        </p>
      </CardContent>
      <CardFooter>
        {isConnected ? (
          <Button 
            variant="outline"
            className="w-full text-white border-[#1c3654] hover:bg-[#1c3654]"
            onClick={handleDisconnect}
          >
            Desconectar
          </Button>
        ) : (
          <Button 
            className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <ArrowRight className="mr-2 h-4 w-4" />
                Conectar com Deriv
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
