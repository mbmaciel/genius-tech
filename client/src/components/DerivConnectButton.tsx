import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const APP_ID = 71403; // App ID da Deriv para OAuth

interface DerivConnectProps {
  className?: string;
  onSuccess?: (token: string, accountInfo: any) => void;
}

export function DerivConnectButton({ className, onSuccess }: DerivConnectProps) {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  // Função para iniciar o processo de autorização OAuth
  const handleConnect = () => {
    setIsConnecting(true);

    try {
      // Constrói a URL de autorização da Deriv
      const scope = 'read admin payments trade';
      
      // IMPORTANTE: Agora redirecionamos para a raiz do site, onde os tokens serão processados
      const redirectUri = encodeURIComponent(window.location.origin);
      const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;

      console.log('[AUTH] Iniciando processo de login na Deriv via OAuth do dashboard');
      console.log('[AUTH] URL de redirecionamento configurada para raiz:', redirectUri);
      
      // Registra a janela para processar o retorno
      localStorage.setItem('derivOAuthPending', 'true');
      
      // Abre a janela de autorização da Deriv
      window.location.href = authUrl;
    } catch (err) {
      console.error('Erro ao iniciar autenticação:', err);
      setIsConnecting(false);
      
      toast({
        title: 'Erro de Conexão',
        description: 'Não foi possível iniciar a autenticação com a Deriv.',
        variant: 'destructive',
      });
    }
  };

  // Efeito para verificar se já temos um token salvo
  useEffect(() => {
    const checkExistingToken = () => {
      const token = localStorage.getItem('deriv_token');
      const accountInfo = localStorage.getItem('deriv_account_info');
      
      if (token && accountInfo && onSuccess) {
        try {
          onSuccess(token, JSON.parse(accountInfo));
        } catch (err) {
          console.error('Erro ao processar dados salvos:', err);
        }
      }
    };
    
    checkExistingToken();
  }, [onSuccess]);

  return (
    <Button 
      onClick={handleConnect}
      disabled={isConnecting}
      className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium ${className}`}
      size="lg"
    >
      {isConnecting ? 'Conectando...' : 'Conectar com Deriv'}
    </Button>
  );
}