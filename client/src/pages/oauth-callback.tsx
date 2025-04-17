import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { processOAuthRedirect, processAuthorization, UserAccount } from "@/lib/oauthProcessor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { derivAPI } from "@/lib/derivApi";
import { useToast } from "@/hooks/use-toast";

export default function OAuthCallback() {
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const processOAuth = async () => {
      try {
        // Extrair os dados da URL
        const currentUrl = window.location.href;
        console.log("Processando URL de redirecionamento:", currentUrl);
        
        const result = processOAuthRedirect(currentUrl);
        console.log("Resultado do processamento OAuth:", result);

        if (result.error) {
          setError(result.error);
          setIsProcessing(false);
          return;
        }

        if (!result.token && (!result.accounts || result.accounts.length === 0)) {
          setError("Não foi possível extrair dados de conta da URL de redirecionamento.");
          setIsProcessing(false);
          return;
        }

        // Salvar as contas processadas
        if (result.accounts && result.accounts.length > 0) {
          setAccounts(result.accounts);
        }

        // Tentar autorizar com o token principal
        const mainToken = result.token || (result.accounts && result.accounts.length > 0 ? result.accounts[0].token : null);
        
        if (mainToken) {
          try {
            // Conectar ao WebSocket se não estiver conectado
            if (!derivAPI.isConnected()) {
              await derivAPI.connect();
            }
            
            // Fazer a autorização
            const authResult = await derivAPI.authorize(mainToken);
            
            if (authResult) {
              console.log("Autorização bem-sucedida:", authResult);
              
              // Salvar o token atual no localStorage para uso futuro
              localStorage.setItem('deriv_api_token', mainToken);
              
              // Processar a resposta de autorização para salvar detalhes das contas
              if (authResult.account_list) {
                await processAuthorization(mainToken);
              }
              
              setUserName(authResult.fullname || "");
              setSuccess(true);
              
              // Notificar o usuário
              toast({
                title: "Conectado com sucesso",
                description: `Bem-vindo ${authResult.fullname || "à plataforma Genius Technology Trading"}!`,
              });
              
              // Disparar evento de login bem-sucedido para componentes que estejam escutando
              const loginEvent = new CustomEvent('deriv:login_success', {
                detail: { accounts: result.accounts, authorizeResponse: authResult }
              });
              document.dispatchEvent(loginEvent);
            } else {
              setError("Falha na autenticação com o token fornecido.");
            }
          } catch (authError: any) {
            console.error("Erro ao autorizar:", authError);
            setError(`Erro de autorização: ${authError.message || "Erro desconhecido"}`);
          }
        } else {
          setError("Não foi possível obter um token válido para autorização.");
        }
      } catch (e: any) {
        console.error("Erro no processamento do OAuth:", e);
        setError(`Erro no processamento: ${e.message || "Erro desconhecido"}`);
      } finally {
        setIsProcessing(false);
      }
    };

    processOAuth();
  }, [toast]);

  const handleRedirect = () => {
    if (success) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1a33] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-[#162746] border-[#3a7bd5] border">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center text-white">
            {isProcessing ? "Processando Autenticação" : success ? "Autenticação Concluída" : "Erro de Autenticação"}
          </CardTitle>
          <CardDescription className="text-center text-[#8492b4]">
            {isProcessing 
              ? "Estamos processando sua autenticação com a Deriv..." 
              : success 
                ? `Você foi autenticado com sucesso na plataforma Genius Technology Trading.`
                : "Ocorreu um erro durante o processo de autenticação."}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-4">
          {isProcessing ? (
            <div className="flex justify-center py-8">
              <svg className="animate-spin h-12 w-12 text-[#00e5b3]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : success ? (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-[#00e5b3]/20 p-3">
                  <svg className="h-8 w-8 text-[#00e5b3]" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
              </div>
              
              <p className="text-white text-center">
                {userName ? `Olá, ${userName}!` : 'Você agora está conectado à sua conta Deriv.'}
              </p>
              
              {accounts.length > 0 && (
                <div className="bg-[#1f3158] p-2 rounded-md text-center text-sm">
                  <p className="text-[#8492b4] mb-2">Contas conectadas:</p>
                  <ul className="text-white">
                    {accounts.map((account, index) => (
                      <li key={index} className="mb-1">
                        {account.account} - {account.currency} 
                        <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${account.isVirtual ? 'bg-indigo-600' : 'bg-emerald-600'}`}>
                          {account.isVirtual ? 'Demo' : 'Real'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <Button 
                onClick={handleRedirect}
                className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
              >
                Ir para o Dashboard
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-red-500/20 p-3">
                  <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </div>
              </div>
              
              <p className="text-white text-center">
                {error || "Ocorreu um erro durante a autenticação."}
              </p>
              
              <Button 
                onClick={handleRedirect}
                className="w-full bg-[#3a7bd5] hover:bg-[#4a8be5] text-white"
              >
                Voltar para a página de login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}