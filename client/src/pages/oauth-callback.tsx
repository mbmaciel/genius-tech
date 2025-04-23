import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

/**
 * Página de callback para autenticação OAuth da Deriv
 * 
 * Esta página captura o token da URL quando o usuário é redirecionado de volta
 * do site da Deriv após a autenticação, e passa o token para a janela principal.
 */
export default function OAuthCallback() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    // Verificar se há um token no hash da URL
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const token = params.get('token1');
    
    if (token) {
      try {
        // Enviar mensagem para a janela que abriu esta (a janela principal)
        if (window.opener) {
          window.opener.postMessage({
            tokenResponse: {
              oauth_token: token
            }
          }, window.location.origin);
          
          setStatus('success');
          setMessage(t('Autenticação bem-sucedida! Esta janela será fechada automaticamente.'));
          
          // Fechar esta janela após um curto delay
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          // Caso não haja janela pai (e.g., o usuário abriu este link diretamente)
          setStatus('success');
          setMessage(t('Autenticação bem-sucedida! Você pode voltar para a aplicação.'));
          
          // Redirecionar para a página principal após um delay
          setTimeout(() => {
            setLocation('/');
          }, 3000);
        }
      } catch (error) {
        console.error('Erro ao processar token OAuth:', error);
        setStatus('error');
        setMessage(t('Ocorreu um erro ao processar a autenticação.'));
      }
    } else {
      setStatus('error');
      setMessage(t('Não foi possível encontrar o token de autenticação.'));
    }
  }, [t, setLocation]);

  const handleCloseClick = () => {
    if (window.opener) {
      window.close();
    } else {
      setLocation('/');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-[90%] max-w-md">
        <CardHeader>
          <CardTitle>
            {status === 'loading' && t('Processando autenticação...')}
            {status === 'success' && t('Autenticação concluída')}
            {status === 'error' && t('Erro de autenticação')}
          </CardTitle>
          <CardDescription>
            {status === 'loading' && t('Aguarde enquanto processamos sua autenticação com a Deriv.')}
            {status === 'success' && t('Você foi autenticado com sucesso na Deriv.')}
            {status === 'error' && t('Ocorreu um problema durante o processo de autenticação.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          {status === 'loading' && (
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
          )}
          {status === 'success' && (
            <CheckCircle className="h-16 w-16 text-green-500" />
          )}
          {status === 'error' && (
            <XCircle className="h-16 w-16 text-red-500" />
          )}
          
          <p className="text-center mt-4">
            {message}
          </p>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            onClick={handleCloseClick}
            disabled={status === 'loading'}
          >
            {window.opener ? t('Fechar janela') : t('Voltar à aplicação')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}