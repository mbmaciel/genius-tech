import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Key, Lock } from "lucide-react";
import { 
  Alert,
  AlertDescription,
  AlertTitle, 
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TokenErrorData {
  token: string; 
  error: string; 
  timestamp: number;
  requiredScopes?: string[];
  foundScopes?: string[];
  message?: string;
}

interface TokenPermissionAlertProps {
  onReauthorize?: () => void;
}

export function TokenPermissionAlert({ onReauthorize }: TokenPermissionAlertProps) {
  const [tokenError, setTokenError] = useState<TokenErrorData | null>(null);
  const [pendingReauth, setPendingReauth] = useState<boolean>(false);
  const [permissionWarning, setPermissionWarning] = useState<boolean>(false);
  const [account, setAccount] = useState<string | null>(null);
  
  // Carregar dados do localStorage e configurar event listeners
  useEffect(() => {
    // Função para verificar os erros armazenados
    const checkStoredErrors = () => {
      // Verificar se há erros de token armazenados
      const tokenErrorStr = localStorage.getItem('deriv_token_scope_error');
      if (tokenErrorStr) {
        try {
          const errorData = JSON.parse(tokenErrorStr);
          // Verificar se o erro é recente (menos de 1 hora)
          if (Date.now() - errorData.timestamp < 60 * 60 * 1000) {
            setTokenError(errorData);
          } else {
            // Se o erro for antigo, limpar
            localStorage.removeItem('deriv_token_scope_error');
          }
        } catch (e) {
          console.error('[TOKEN_ALERT] Erro ao processar dados de erro do token:', e);
          localStorage.removeItem('deriv_token_scope_error');
        }
      }
      
      // Verificar se há uma reautorização pendente
      const pendingReauthStr = localStorage.getItem('deriv_pending_reauth');
      setPendingReauth(pendingReauthStr === 'true');
      
      // Carregar informações da conta atual
      const activeLoginId = localStorage.getItem('deriv_active_loginid');
      if (activeLoginId) {
        setAccount(activeLoginId);
      }
      
      // Limpar dados antigos de reautorização pendente após 1 dia
      const reauthTimestamp = localStorage.getItem('deriv_pending_reauth_timestamp');
      if (reauthTimestamp && Date.now() - parseInt(reauthTimestamp) > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('deriv_pending_reauth');
        localStorage.removeItem('deriv_pending_reauth_timestamp');
      }
    };
    
    // Verificar inicialmente
    checkStoredErrors();
    
    // Registrar event listeners para erros de token e permissão
    const handleTokenError = (event: CustomEvent) => {
      console.log('[TOKEN_ALERT] Recebido evento de erro de token:', event.detail);
      setTokenError(event.detail);
      
      // Salvar no localStorage
      localStorage.setItem('deriv_token_scope_error', JSON.stringify(event.detail));
    };
    
    const handlePermissionWarning = (event: CustomEvent) => {
      console.log('[TOKEN_ALERT] Recebido aviso de permissão:', event.detail);
      setPermissionWarning(true);
    };
    
    const handleAccountChanged = () => {
      // Quando a conta muda, verificar novamente os erros
      setPermissionWarning(false);
      setTokenError(null);
      
      // Esperar um momento para os dados serem atualizados no localStorage
      setTimeout(checkStoredErrors, 500);
    };
    
    // Registrar event listeners
    document.addEventListener('deriv_token_scope_error', handleTokenError as EventListener);
    document.addEventListener('deriv_token_permission_warning', handlePermissionWarning as EventListener);
    document.addEventListener('deriv:account_switched', handleAccountChanged as EventListener);
    
    // Configurar verificação periódica
    const interval = setInterval(checkStoredErrors, 5000);
    
    // Cleanup
    return () => {
      document.removeEventListener('deriv_token_scope_error', handleTokenError as EventListener);
      document.removeEventListener('deriv_token_permission_warning', handlePermissionWarning as EventListener);
      document.removeEventListener('deriv:account_switched', handleAccountChanged as EventListener);
      clearInterval(interval);
    };
  }, []);
  
  const handleReauthorize = () => {
    if (onReauthorize) {
      onReauthorize();
    } else {
      // URL de autorização padrão
      const appId = '71403';
      const redirectUri = encodeURIComponent(window.location.origin + '/auth-callback');
      const scope = encodeURIComponent('read admin payments trade trading trading_information');
      const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;
      
      // Registrar que a reautorização foi solicitada
      localStorage.setItem('deriv_pending_reauth', 'true');
      localStorage.setItem('deriv_pending_reauth_timestamp', Date.now().toString());
      
      // Abrir janela de autorização
      window.open(authUrl, '_blank', 'width=800,height=600');
    }
  };
  
  // Não mostrar nada se não houver problemas
  if (!tokenError && !pendingReauth && !permissionWarning) return null;
  
  return (
    <div className="space-y-3 mb-4 animate-fadeIn">
      {tokenError && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="flex items-center">
            Permissões insuficientes
            {account && (
              <Badge variant="outline" className="ml-2 text-xs border-orange-500 text-orange-300">
                {account}
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <div className="text-sm mb-2">
              <p className="mb-1">O token atual não possui as permissões necessárias para operações de trading.</p>
              
              {tokenError.requiredScopes && tokenError.foundScopes && (
                <div className="mt-2 text-xs bg-orange-950/30 p-2 rounded-md border border-orange-800/50">
                  <div className="flex items-center mb-1">
                    <Lock className="h-3 w-3 mr-1" />
                    <span className="font-semibold">Permissões necessárias:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {tokenError.requiredScopes.map(scope => (
                      <Badge key={scope} variant="outline" className={`text-xs border-orange-600 ${
                        tokenError.foundScopes?.includes(scope) 
                          ? 'bg-green-900/20 text-green-300' 
                          : 'bg-red-900/20 text-red-300'
                      }`}>
                        {scope}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="mt-2 text-orange-300 italic">
                Você precisa reautorizar a plataforma para garantir acesso completo às funções de trading.
              </p>
            </div>
            
            <div className="mt-3">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleReauthorize}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <Key className="h-3 w-3 mr-1" />
                Reautorizar com Deriv
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {permissionWarning && !tokenError && (
        <Alert className="border-yellow-500 bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
          <AlertTitle className="flex items-center text-yellow-300">
            Aviso de permissões
            {account && (
              <Badge variant="outline" className="ml-2 text-xs border-yellow-500 text-yellow-300">
                {account}
              </Badge>
            )}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm">
              O token tem acesso limitado. Algumas operações de trading podem não funcionar corretamente.
              Recomendamos reautorizar para garantir funcionalidade completa.
            </p>
            <div className="mt-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleReauthorize}
                className="border-yellow-600 hover:bg-yellow-900/50 text-yellow-300"
              >
                <Key className="h-3 w-3 mr-1" />
                Atualizar permissões
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {pendingReauth && !tokenError && !permissionWarning && (
        <Alert className="border-blue-500 bg-blue-950/20">
          <Info className="h-4 w-4" />
          <AlertTitle>Reautorização pendente</AlertTitle>
          <AlertDescription className="mt-2">
            <p>Você iniciou o processo de reautorização com a Deriv, mas ainda não o concluiu.
            Complete a autorização para garantir acesso completo às operações de trading.</p>
            <div className="mt-2">
              <Button 
                variant="default" 
                size="sm"
                onClick={handleReauthorize}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Concluir autorização
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}