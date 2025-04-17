import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { loginWithDeriv } from "@/lib/websocketManager";

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const handleLoginWithDeriv = () => {
    try {
      setIsLoading(true);
      loginWithDeriv(); // Redirecionará para o fluxo OAuth da Deriv
    } catch (error) {
      console.error("Erro ao iniciar login:", error);
      toast({
        variant: "destructive",
        title: "Erro ao iniciar login",
        description: "Ocorreu um erro ao iniciar o processo de login. Por favor, tente novamente.",
      });
      setIsLoading(false);
    }
  };

  const handleDirectLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simular login direto para o dashboard (para dev/teste)
    setIsLoading(true);
    
    setTimeout(() => {
      navigate("/dashboard");
    }, 1000);
  };

  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-[#0c111b] text-white p-4">
      <div className="max-w-md w-full p-8 bg-[#13203a] rounded-lg shadow-lg">
        {/* Logo e título */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-lg bg-indigo-600 flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Genius Technology Trading</h1>
          <p className="text-[#8492b4] mt-2">
            Plataforma de trading completa para a API Deriv
          </p>
        </div>

        {/* Botões de login */}
        <div className="space-y-4">
          {/* Botão de login com Deriv (OAuth) */}
          <button
            onClick={handleLoginWithDeriv}
            disabled={isLoading}
            className="w-full py-3 bg-[#00e5b3] hover:bg-[#00c49c] text-[#0c111b] font-medium rounded-lg transition-colors focus:ring-2 focus:ring-[#00e5b3] focus:ring-opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-[#0c111b] border-t-transparent rounded-full animate-spin mr-2"></div>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <circle cx="12" cy="12" r="4"></circle>
              </svg>
            )}
            {isLoading ? "Conectando..." : "Conectar com Deriv"}
          </button>

          {/* Botão de login direto (para desenvolvimento) */}
          <form onSubmit={handleDirectLogin} className="space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#1d2a45] hover:bg-[#28375c] text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-[#1d2a45] focus:ring-opacity-50"
            >
              {isLoading ? "Entrando..." : "Entrar no Dashboard"}
            </button>
          </form>
        </div>

        {/* Aviso de risco */}
        <div className="mt-8 text-xs text-[#8492b4] leading-relaxed">
          <p>
            AVISO DE RISCO: Os produtos oferecidos por Deriv.com e suas afiliadas envolvem risco e podem resultar em perdas. O trading de opções binárias pode não ser adequado para todos, por favor considere os Termos e Condições. A alavancagem cria risco adicional e exposição a perdas. Opere apenas com o que você pode se dar ao luxo de perder.
          </p>
        </div>
      </div>
    </div>
  );
}