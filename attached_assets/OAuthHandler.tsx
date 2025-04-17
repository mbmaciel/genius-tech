import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { parseOAuthRedirectURL, saveUserAccounts } from '@/lib/oauthService';
import { derivAPI } from '@/lib/derivApi';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { useLocation } from 'wouter';

/**
 * Componente que gerencia autenticação OAuth com a Deriv
 * Processa os tokens do URL de redirecionamento e gerencia conexão
 */
export function OAuthHandler() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const processOAuthRedirect = async () => {
      try {
        // Verificar se há parâmetros na URL (após redirecionamento OAuth)
        // A URL de redirecionamento OAuth contém parâmetros como token1, acct1, etc.
        const hasQueryParams = window.location.search.includes('token') || 
                               window.location.search.includes('acct') ||
                               window.location.hash.includes('token') ||
                               window.location.hash.includes('access_token');
        
        // Verificar se estamos na página inicial e redirecionamos para o painel se logado
        const isOnHomePage = window.location.pathname === '/';
        const isOnLoginPage = window.location.pathname === '/auth';
        
        if (hasQueryParams) {
          console.log('Parâmetros OAuth detectados na URL, processando...');
          
          // Extrair contas e tokens do URL
          const userAccounts = parseOAuthRedirectURL(window.location.href);
          
          if (userAccounts.length > 0) {
            // Salvar contas e selecionar a primeira como padrão
            saveUserAccounts(userAccounts);
            
            // Verificar se há conta real disponível
            const hasRealAccount = userAccounts.some(acc => !acc.account.startsWith('VRT'));
            
            // Limpar a URL para remover tokens
            window.history.replaceState({}, document.title, window.location.pathname);
            
            // Tentar conectar com o token salvo
            const token = sessionStorage.getItem('derivToken');
            if (token) {
              try {
                const response = await derivAPI.connect(token);
                
                if (!hasRealAccount) {
                  // Mostrar aviso se só há conta de demonstração
                  toast({
                    title: 'Atenção: Apenas conta demo detectada',
                    description: 'Este aplicativo funciona melhor com contas reais. Algumas funcionalidades podem não estar disponíveis.',
                    variant: 'destructive',
                  });
                } else {
                  // Mostrar sucesso com conta real
                  toast({
                    title: 'Autenticação bem-sucedida',
                    description: 'Conectado à Deriv com conta real',
                  });
                }
                
                // Redirecionar para o painel se o login foi bem-sucedido
                setTimeout(() => {
                  setLocation('/?view=painel');
                }, 500);
              } catch (error) {
                // Erro na conexão
                console.error('Erro ao conectar com token OAuth:', error);
                toast({
                  title: 'Falha na conexão',
                  description: 'Não foi possível conectar à API da Deriv',
                  variant: 'destructive',
                });
              }
            }
          } else {
            console.warn('Nenhuma conta encontrada na URL de redirecionamento');
            toast({
              title: 'Erro na autenticação',
              description: 'Nenhuma conta foi encontrada no redirecionamento',
              variant: 'destructive',
            });
          }
        } else {
          // Verificar se já há um token salvo e tentar reconectar
          const savedToken = sessionStorage.getItem('derivToken');
          if (savedToken) {
            try {
              await derivAPI.connect(savedToken);
              console.log('Reconectado com token salvo previamente');
            } catch (error) {
              console.error('Erro ao reconectar com token salvo:', error);
              // Não mostrar toast de erro para não interromper a experiência do usuário
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar redirecionamento OAuth:', error);
      }
    };

    processOAuthRedirect();
  }, [toast]);

  return null; // Não renderiza nada
}

export default OAuthHandler;