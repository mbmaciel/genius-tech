import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";
import derivAPI from "@/lib/derivApi";

interface DerivAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (accountInfo: any) => void;
}

export function DerivAuthModal({ isOpen, onClose, onSuccess }: DerivAuthModalProps) {
  const [authUrl, setAuthUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // Configurar a URL de autenticação
  useEffect(() => {
    const setupAuth = () => {
      try {
        // App ID da Deriv (usar um app ID registrado para produção)
        const appId = 33666;
        
        // Criar URL para o OAuth da Deriv
        // Usando uma abordagem de embedded auth
        const redirectUri = window.location.origin + window.location.pathname;
        const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=PT&redirect_uri=${encodeURIComponent(redirectUri)}`;
        
        setAuthUrl(authUrl);
        setIsLoading(false);
      } catch (err) {
        console.error('Erro ao configurar autenticação:', err);
        setError('Erro ao configurar autenticação com a Deriv');
        setIsLoading(false);
      }
    };
    
    if (isOpen) {
      setupAuth();
      
      // Configurar listener para mensagem de callback
      const handleMessage = (event: MessageEvent) => {
        // Verificar se a mensagem é da nossa origem ou da Deriv
        if (event.origin === window.location.origin || 
            event.origin.includes('deriv.com') || 
            event.origin.includes('binary.com')) {
          
          try {
            // Verificar se a mensagem contém um token
            if (event.data && typeof event.data === 'string' && event.data.includes('token')) {
              const params = new URLSearchParams(event.data);
              const token = params.get('token1');
              
              if (token) {
                setToken(token);
                handleAuth(token);
              }
            }
          } catch (err) {
            console.error('Erro ao processar mensagem:', err);
          }
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Verificar se já temos um token na URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token1');
      
      if (urlToken) {
        // Limpar a URL
        window.history.replaceState({}, document.title, window.location.pathname);
        setToken(urlToken);
        handleAuth(urlToken);
      }
      
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [isOpen, onSuccess]);
  
  // Autenticar com o token
  const handleAuth = async (token: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Conectar e autenticar em um único passo
      const response = await derivAPI.connect(token);
      
      // Obter informações da conta da resposta
      if (response.authorize) {
        const accountInfo = response.authorize;
        
        // Armazenar o token e as informações da conta
        sessionStorage.setItem('derivToken', token);
        
        // Notificar sobre o sucesso
        onSuccess(accountInfo);
        onClose();
      } else {
        throw new Error('Resposta de autorização inválida');
      }
    } catch (err) {
      console.error('Erro de autenticação:', err);
      setError('Falha na autenticação com a Deriv. Por favor, tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Abrir página de login da Deriv em uma nova janela
  const openDerivLogin = () => {
    setIsLoading(true);
    setError(null);
    
    // Abrir em uma popup
    const width = 800;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const popup = window.open(
      authUrl,
      'DerivAuth',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );
    
    // Verificar se a popup foi bloqueada
    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      setError('Popup bloqueado pelo navegador. Por favor, permita popups para este site.');
      setIsLoading(false);
      return;
    }
    
    // Monitorar o fechamento da janela
    const checkPopup = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkPopup);
        
        // Se não recebemos um token após o fechamento da janela
        if (!token) {
          setIsLoading(false);
          setError('Autenticação cancelada ou falhou. Por favor, tente novamente.');
        }
      }
    }, 500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0e1a33] text-white border-gray-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">Conectar à Deriv</DialogTitle>
          <DialogDescription className="text-[#8492b4]">
            Conecte sua conta Deriv para utilizar todas as funcionalidades de trading.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col space-y-4 py-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-10 w-10 text-[#00e5b3] animate-spin mb-4" />
              <p className="text-center text-[#8492b4]">
                Conectando à Deriv...
              </p>
            </div>
          ) : error ? (
            <div className="bg-[#1f3158] p-4 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-[#ff5252] shrink-0 mr-3 mt-0.5" />
              <div>
                <p className="text-white font-medium mb-1">Erro de conexão</p>
                <p className="text-sm text-[#8492b4]">{error}</p>
                <Button 
                  className="mt-4 bg-[#ff444f] hover:bg-[#ff5f69] text-white"
                  onClick={() => setError(null)}
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-[#1f3158] p-4 rounded-md">
                <p className="text-sm text-[#8492b4] mb-4">
                  Para conectar sua conta Deriv, você será redirecionado para a página de login da Deriv.
                  Após o login, você será automaticamente redirecionado de volta.
                </p>
                
                <ul className="space-y-2 text-sm text-[#8492b4] list-disc list-inside mb-4">
                  <li>Nenhuma senha é armazenada por este aplicativo</li>
                  <li>A conexão é segura e criptografada</li>
                  <li>Você terá acesso completo aos recursos de trading</li>
                </ul>
              </div>
              
              <Button 
                className="w-full bg-[#ff444f] hover:bg-[#ff5f69] text-white py-6 text-lg"
                onClick={openDerivLogin}
              >
                Continuar para o login da Deriv
              </Button>
              
              <p className="text-xs text-center text-[#8492b4]">
                Ao conectar sua conta, você concorda com os termos e condições da Deriv e deste aplicativo.
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}