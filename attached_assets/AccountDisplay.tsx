import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import derivAPI from '@/lib/derivApi';

// Componente de botão de conexão
function ConnectButton() {
  const [isConnecting, setIsConnecting] = useState(false);
  
  const connectToDeriv = async () => {
    setIsConnecting(true);
    
    try {
      // Verificar se já temos conexão ativa
      if (!derivAPI.isConnected) {
        await derivAPI.connect();
      }
      
      // Se a conexão foi estabelecida, redirecionar para auth da Deriv
      // Adicionar parâmetro de redirecionamento para nosso endpoint de callback
      const redirectUrl = window.location.origin + '/oauth-callback';
      const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=71403&l=PT&brand=deriv&redirect_uri=${encodeURIComponent(redirectUrl)}`;
      
      // Redirecionar para autenticação na mesma aba
      window.location.href = authUrl;
      
      toast({
        title: "Conexão iniciada",
        description: "Complete a autenticação na janela aberta",
      });
      
    } catch (error) {
      console.error("Erro na conexão:", error);
      toast({
        title: "Erro de conexão",
        description: "Não foi possível iniciar a conexão com a Deriv",
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };
  
  return (
    <Button 
      onClick={connectToDeriv} 
      variant="default" 
      className="w-full bg-[#00e5b3] hover:bg-[#00c89f] text-[#0e1a33]"
      disabled={isConnecting}
    >
      {isConnecting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Conectando...
        </>
      ) : (
        <>
          <LogIn className="mr-2 h-4 w-4" />
          Conectar à Deriv
        </>
      )}
    </Button>
  );
}

export function AccountDisplay() {
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Função para carregar informações da conta atual
    const loadAccountInfo = async () => {
      setIsLoading(true);
      
      try {
        // Verificar se temos token no localStorage
        const mainToken = localStorage.getItem('deriv_api_token');
        
        // Verificar se já estamos autenticados
        if (derivAPI.isConnected && derivAPI.isAuthenticated()) {
          console.log("[AccountDisplay] API já está autenticada, obtendo dados da conta...");
          // Método 1: Dados por métodos públicos
          const currentAccount = derivAPI.getAccountDetails();
          
          setAccountInfo({
            loginId: currentAccount.loginId || '',
            name: currentAccount.name || '',
            currency: currentAccount.balance?.currency || currentAccount.currency || 'USD',
            balance: currentAccount.balance?.balance || 0,
            isVirtual: currentAccount.isVirtual || false,
            email: currentAccount.email || '',
            accountType: (currentAccount.isVirtual ? 'Demo' : 'Real')
          });
          setIsLoading(false);
          return;
        }
        
        // Tentar conexão e autenticação com token salvo
        if (mainToken) {
          console.log("[AccountDisplay] Encontrado token salvo, tentando autorizar...");
          
          // Garantir que estamos conectados antes de autorizar
          if (!derivAPI.isConnected) {
            await derivAPI.connect();
          }
          
          try {
            // Autorizar com o token salvo
            await derivAPI.authorize(mainToken);
            console.log("[AccountDisplay] Autorização com token salvo bem-sucedida");
            
            // Obter dados atualizados após autorização bem-sucedida
            const currentAccount = derivAPI.getAccountDetails();
            
            // Atualizar interface com os dados obtidos
            setAccountInfo({
              loginId: currentAccount.loginId || '',
              name: currentAccount.name || '',
              currency: currentAccount.balance?.currency || currentAccount.currency || 'USD',
              balance: currentAccount.balance?.balance || 0,
              isVirtual: !!currentAccount.isVirtual,
              email: currentAccount.email || '',
              accountType: (currentAccount.isVirtual ? 'Demo' : 'Real')
            });
            
            // Disparar evento para outros componentes saberem que estamos conectados
            document.dispatchEvent(new CustomEvent('deriv:authorized', {
              detail: currentAccount
            }));
          } catch (error) {
            console.error("[AccountDisplay] Falha ao autorizar com token salvo:", error);
            // Se falhar, limpar o token (pode estar inválido)
            localStorage.removeItem('deriv_api_token');
          }
        } else {
          console.log("[AccountDisplay] Nenhum token salvo encontrado");
        }
      } catch (error) {
        console.error("[AccountDisplay] Erro ao carregar informações da conta:", error);
      }
      
      setIsLoading(false);
    };

    // Carregar informações da conta ao montar
    loadAccountInfo();
    
    // Configurar um listener para mudanças de autorização
    const handleAuthorized = () => {
      console.log("[AccountDisplay] Evento de autorização detectado, atualizando exibição");
      loadAccountInfo();
    };
    
    document.addEventListener('deriv:authorized', handleAuthorized);
    
    // Configurar um intervalo para atualizar os dados a cada 30 segundos
    const updateInterval = setInterval(loadAccountInfo, 30000);
    
    return () => {
      document.removeEventListener('deriv:authorized', handleAuthorized);
      clearInterval(updateInterval);
    };
  }, []);

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Informações da Conta</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        ) : accountInfo ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">ID da Conta:</span>
              <span className="font-mono font-medium">{accountInfo.loginId}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Nome:</span>
              <span>{accountInfo.name}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Tipo:</span>
              <Badge 
                variant={accountInfo.isVirtual ? "outline" : "default"}
                className={accountInfo.isVirtual ? "bg-yellow-100 hover:bg-yellow-100 text-yellow-800 border-yellow-200" : ""}
              >
                {accountInfo.accountType}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Saldo:</span>
              <span className="font-semibold">
                {accountInfo.balance.toFixed(2)} {accountInfo.currency}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email:</span>
              <span className="text-xs truncate max-w-[150px]">{accountInfo.email}</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-2 text-muted-foreground space-y-4">
            <div>
              <p>Nenhuma conta conectada</p>
              <p className="text-xs mt-1">Use o botão abaixo ou acesse "Conexão"</p>
            </div>
            
            <ConnectButton />
          </div>
        )}
      </CardContent>
    </Card>
  );
}