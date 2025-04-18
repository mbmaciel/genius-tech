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
  
  // Componente completamente desativado por solicitação do usuário
  // Não exibir nenhum aviso, independentemente da situação
  return null;
}