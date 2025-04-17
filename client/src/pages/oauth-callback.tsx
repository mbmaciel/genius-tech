import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { derivAPI, authorizeDerivAPI } from "@/lib/websocketManager";

export default function OAuthCallback() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processando autenticação...");
  const { toast } = useToast();

  // Extrair parâmetros da URL
  useEffect(() => {
    const processOAuth = async () => {
      try {
        // Conex URL exata: https://84781f0a-b9d4-46b0-ab6f-750ffe9a64f7-00-2ynik35d9muy1.worf.replit.dev/oauth-callback
        console.log("Processando retorno OAuth...");
        console.log("URL atual:", window.location.href);
        
        const urlParams = new URLSearchParams(window.location.search);
        
        // Verificar erro de autorização
        if (urlParams.has("error")) {
          const error = urlParams.get("error");
          const errorDescription = urlParams.get("error_description");
          throw new Error(`${error}: ${errorDescription}`);
        }
        
        // Verificar se existem parâmetros de contas e tokens
        const urlAccounts = urlParams.get("acct");
        const urlTokens = urlParams.get("token");
        
        if (!urlAccounts || !urlTokens) {
          throw new Error("Parâmetros de conta ou token ausentes na URL");
        }
        
        // Transformar string de contas em array
        const accounts = urlAccounts.split(',');
        // Transformar string de tokens em array
        const tokens = urlTokens.split(',');
        
        if (accounts.length !== tokens.length) {
          throw new Error("Número de contas e tokens não correspondem");
        }
        
        // Criar estrutura de dados para armazenar as contas
        const accountsWithTokens = accounts.map((acc, index) => ({
          account: acc,
          token: tokens[index]
        }));
        
        console.log("Contas encontradas:", accountsWithTokens);
        
        // Armazenar as contas e tokens na localStorage para uso posterior
        localStorage.setItem('deriv_accounts', JSON.stringify(accountsWithTokens));
        
        // Se houver pelo menos uma conta, salvar o primeiro token como ativo
        if (accountsWithTokens.length > 0) {
          localStorage.setItem('deriv_active_account', accountsWithTokens[0].account);
          localStorage.setItem('deriv_api_token', accountsWithTokens[0].token);
          
          // Conectar ao WebSocket da Deriv
          await derivAPI.connect();
          
          // Autorizar com o token recebido
          try {
            const authResponse = await authorizeDerivAPI(accountsWithTokens[0].token);
            console.log("Autorização bem-sucedida:", authResponse);
            
            // Atualizar estado para sucesso
            setStatus("success");
            setMessage("Autenticação realizada com sucesso. Redirecionando...");
            
            // Notificar o usuário
            toast({
              title: "Conexão estabelecida",
              description: `Conectado com sucesso a ${accountsWithTokens.length} conta(s).`,
            });
            
            // Redirecionar para o dashboard após 2 segundos
            setTimeout(() => {
              navigate("/dashboard");
            }, 2000);
          } catch (authError) {
            console.error("Erro ao autorizar:", authError);
            throw new Error(`Erro de autorização: ${authError.message || 'Falha na autenticação com o token'}`);
          }
        } else {
          throw new Error("Nenhuma conta foi recebida na autenticação");
        }
      } catch (error) {
        console.error("Erro durante o processo de OAuth:", error);
        setStatus("error");
        setMessage(`Erro na autenticação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
        
        toast({
          variant: "destructive",
          title: "Erro na autenticação",
          description: "Ocorreu um erro ao processar a autenticação. Por favor, tente novamente.",
        });
        
        // Redirecionar para a página de login após 3 segundos
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    };
    
    processOAuth();
  }, [navigate, toast]);

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-[#0c111b] text-white">
      <div className="max-w-md w-full p-8 bg-[#13203a] rounded-lg shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-semibold mb-2">Autenticação Deriv</h1>
          <div className={`text-sm ${status === "error" ? "text-red-400" : "text-[#8492b4]"}`}>
            {message}
          </div>
        </div>
        
        {status === "loading" && (
          <div className="flex justify-center my-8">
            <div className="w-10 h-10 border-4 border-[#00e5b3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        
        {status === "success" && (
          <div className="flex flex-col items-center my-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-[#00e5b3] text-lg">Redirecionando para o Dashboard...</p>
          </div>
        )}
        
        {status === "error" && (
          <div className="flex flex-col items-center my-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400 text-lg">Redirecionando para a página de Login...</p>
          </div>
        )}
      </div>
    </div>
  );
}