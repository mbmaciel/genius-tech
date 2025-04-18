import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { 
  Alert,
  AlertDescription,
  AlertTitle, 
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface TokenPermissionAlertProps {
  onReauthorize?: () => void;
}

export function TokenPermissionAlert({ onReauthorize }: TokenPermissionAlertProps) {
  const [tokenError, setTokenError] = useState<{ 
    token: string; 
    error: string; 
    timestamp: number;
  } | null>(null);
  
  const [pendingReauth, setPendingReauth] = useState<boolean>(false);
  
  useEffect(() => {
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
    
    // Limpar dados antigos de reautorização pendente após 1 dia
    const reauthTimestamp = localStorage.getItem('deriv_pending_reauth_timestamp');
    if (reauthTimestamp && Date.now() - parseInt(reauthTimestamp) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem('deriv_pending_reauth');
      localStorage.removeItem('deriv_pending_reauth_timestamp');
    }
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
  
  if (!tokenError && !pendingReauth) return null;
  
  return (
    <div className="space-y-3 mb-4">
      {tokenError && (
        <Alert variant="destructive" className="border-orange-500 bg-orange-950/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Problema detectado com o token</AlertTitle>
          <AlertDescription className="mt-2">
            <p>O token atual não tem permissões suficientes para operações de trading. 
            Isso pode causar falhas ao executar operações reais.</p>
            <div className="mt-2">
              <Button 
                variant="destructive" 
                size="sm"
                onClick={handleReauthorize}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Reautorizar com Deriv
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {pendingReauth && !tokenError && (
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