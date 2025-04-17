import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DerivConnect } from "./DerivConnect";
import AccountInfo from "./AccountInfo";
import TokenManager from "./TokenManager";
import { ApiTokensManager } from "./ApiTokensManager";
import { RefreshCw, DollarSign, Settings, HelpCircle } from 'lucide-react';
import derivAPI from '@/lib/derivApi';
import { toast } from '@/hooks/use-toast';

interface AccountDashboardProps {
  onViewChange?: (view: string) => void;
}

export function AccountDashboard({ onViewChange }: AccountDashboardProps) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Check connection status
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // Disconnect and reconnect to refresh the connection
      await derivAPI.disconnect();
      const reconnected = await derivAPI.connect();
      
      if (reconnected) {
        toast({
          title: "Conexão Atualizada",
          description: "Sua conexão com a API Deriv foi atualizada com sucesso.",
        });
      } else {
        toast({
          title: "Falha ao Atualizar",
          description: "Não foi possível atualizar a conexão. Verifique seu token.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error refreshing connection:', error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao atualizar a conexão.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <DollarSign className="h-6 w-6 mr-2 text-[#00e5b3]" />
          <h1 className="text-2xl font-bold text-white">Gerenciamento de Conta</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-white border-[#1c3654] hover:bg-[#1c3654]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Coluna Principal: Informações da Conta */}
        <div className="md:col-span-8 space-y-6">
          {!isConnected ? (
            <DerivConnect />
          ) : (
            <Tabs defaultValue="account" className="w-full">
              <TabsList className="bg-[#1f3158] text-white">
                <TabsTrigger value="account">Informações da Conta</TabsTrigger>
                <TabsTrigger value="tokens">Gerenciar Tokens</TabsTrigger>
              </TabsList>
              
              <TabsContent value="account" className="py-4">
                <AccountInfo />
              </TabsContent>
              
              <TabsContent value="tokens" className="py-4">
                <ApiTokensManager />
              </TabsContent>
            </Tabs>
          )}
        </div>
        
        {/* Coluna Lateral: Ações Rápidas */}
        <div className="md:col-span-4 space-y-6">
          <Card className="bg-[#162746] border-[#1c3654]">
            <CardHeader>
              <CardTitle className="text-white text-lg">Ações Rápidas</CardTitle>
              <CardDescription>
                Operações e ferramentas para sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => onViewChange && onViewChange('trading-bot')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Abrir Robô de Operações
              </Button>
              
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => onViewChange && onViewChange('cashier')}
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Operações de Caixa
              </Button>
              
              <Button 
                className="w-full justify-start" 
                variant="outline"
                onClick={() => window.open('https://app.deriv.com', '_blank')}
              >
                <HelpCircle className="mr-2 h-4 w-4" />
                Acessar Deriv.com
              </Button>
            </CardContent>
          </Card>
          
          {isConnected && (
            <TokenManager />
          )}
        </div>
      </div>
    </div>
  );
}
