import React from 'react';
import { 
  Alert, 
  AlertDescription, 
  AlertTitle 
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

/**
 * Componente exibido quando o usuário precisa fazer login na Deriv
 * Exibe instruções detalhadas e links para autenticação
 */
export function DerivLoginRequired() {
  // URL base do OAuth da Deriv
  const oauthUrl = "https://oauth.deriv.com/oauth2/authorize?app_id=28687&l=pt&brand=deriv";
  
  // URL de redirecionamento após autorização
  const redirectUri = encodeURIComponent(window.location.origin);
  
  // URL completa para autenticação
  const fullOauthUrl = `${oauthUrl}&redirect_uri=${redirectUri}`;
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b1429] p-4">
      <div className="w-full max-w-3xl bg-[#13203a] rounded-lg p-6 border border-[#2a3756] shadow-lg">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Autenticação Necessária
        </h1>
        
        <Alert className="bg-[#192b47] border-blue-700 mb-6">
          <AlertTitle className="text-blue-300 font-semibold">
            Você precisa se conectar com sua conta Deriv
          </AlertTitle>
          <AlertDescription className="text-blue-100">
            Para acessar o robô de operações, é necessário autorizar o acesso à sua conta Deriv através do OAuth.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4 mb-8 text-gray-300">
          <div className="p-4 bg-[#0e1a2e] rounded-md">
            <h3 className="font-medium text-white mb-2">O que é o OAuth?</h3>
            <p className="text-sm">
              OAuth é um protocolo seguro que permite que você autorize nosso aplicativo a acessar sua conta Deriv 
              sem compartilhar suas credenciais de login. Sua senha permanece segura e protegida.
            </p>
          </div>
          
          <div className="p-4 bg-[#0e1a2e] rounded-md">
            <h3 className="font-medium text-white mb-2">Passo a passo para autenticação:</h3>
            <ol className="list-decimal pl-5 text-sm space-y-2">
              <li>Clique no botão "Conectar com Deriv" abaixo</li>
              <li>Você será redirecionado para o site da Deriv</li>
              <li>Faça login com suas credenciais da Deriv (se ainda não estiver logado)</li>
              <li>Autorize nosso aplicativo a acessar sua conta</li>
              <li>Você será redirecionado de volta automaticamente</li>
            </ol>
          </div>
          
          <div className="p-4 bg-[#0e1a2e] rounded-md">
            <h3 className="font-medium text-white mb-2">Informações importantes:</h3>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Nenhuma senha é armazenada em nosso sistema</li>
              <li>Você pode revogar o acesso a qualquer momento na sua conta Deriv</li>
              <li>O acesso é apenas para operações e monitoramento</li>
              <li>Seus dados pessoais são protegidos e criptografados</li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col items-center">
          <Button 
            className="bg-[#ff444f] hover:bg-[#ff6369] text-white font-medium py-2 px-6 rounded-md mb-4 flex items-center space-x-2"
            onClick={() => window.location.href = fullOauthUrl}
          >
            <span>Conectar com Deriv</span>
            <ExternalLink size={16} />
          </Button>
          
          <p className="text-xs text-gray-400 max-w-md text-center">
            Ao clicar no botão acima, você será redirecionado para o site oficial da Deriv.com para autorização segura.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DerivLoginRequired;