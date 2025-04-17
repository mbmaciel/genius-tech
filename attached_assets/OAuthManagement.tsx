import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  CardDescription,
  Button,
  Alert,
  AlertDescription,
  AlertTitle
} from "@/components/ui";
import { AlertCircle, Check, ExternalLink, Key, XCircle } from "lucide-react";
import { derivAPI } from "@/lib/derivApi";
import { toast } from "@/hooks/use-toast";

interface OAuthApp {
  app_id: number;
  name: string;
  app_markup_percentage: string;
  last_used: string;
  scopes: string[];
  official: 0 | 1;
}

export default function OAuthManagement() {
  const [isLoading, setIsLoading] = useState(false);
  const [apps, setApps] = useState<OAuthApp[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState<number | null>(null);

  useEffect(() => {
    loadOAuthApps();
  }, []);

  const loadOAuthApps = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Obter lista de aplicações OAuth 
      const appsList = await derivAPI.listOAuthApps();
      
      if (Array.isArray(appsList)) {
        setApps(appsList);
      } else {
        console.warn("Formato inesperado na resposta de aplicações OAuth:", appsList);
        setApps([]);
      }
    } catch (error) {
      console.error("Erro ao carregar aplicações OAuth:", error);
      setError("Não foi possível carregar a lista de aplicações OAuth. Verifique sua conexão e tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeApp = async (appId: number) => {
    try {
      setIsRevoking(appId);
      
      // Solicitar revogação da aplicação
      const response = await derivAPI.revokeOAuthApp(appId);
      
      if (response && response.revoke_oauth_app === 1) {
        toast({
          title: "Aplicação revogada",
          description: "O acesso da aplicação foi revogado com sucesso.",
          variant: "default",
        });
        
        // Atualizar a lista após revogação bem-sucedida
        loadOAuthApps();
      } else {
        throw new Error("Falha ao revogar aplicação. Resposta inválida da API.");
      }
    } catch (error) {
      console.error("Erro ao revogar aplicação OAuth:", error);
      
      toast({
        title: "Erro ao revogar aplicação",
        description: "Não foi possível revogar o acesso da aplicação. Verifique suas permissões e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRevoking(null);
    }
  };

  const formatLastUsed = (dateStr: string) => {
    if (!dateStr) return "Nunca utilizado";
    
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <Card className="grid-card">
      <CardHeader className="p-4 border-b border-gray-800">
        <CardTitle className="text-lg font-medium font-poppins">Aplicações OAuth</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Gerencie as aplicações com acesso à sua conta Deriv
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Carregando aplicações...
          </div>
        ) : apps.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <p>Nenhuma aplicação OAuth encontrada.</p>
            <p className="mt-2">Você não autorizou nenhuma aplicação externa a acessar sua conta Deriv.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Aplicações autorizadas ({apps.length})</h3>
            
            <div className="space-y-3">
              {apps.map((app) => (
                <div 
                  key={app.app_id} 
                  className="bg-[#1f3158] p-3 rounded-md border border-gray-700"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium flex items-center">
                        {app.name}
                        {app.official === 1 && (
                          <span className="ml-2 px-1.5 py-0.5 bg-blue-800/50 text-blue-300 text-xs rounded-full flex items-center">
                            <Check className="w-3 h-3 mr-1" />
                            Oficial
                          </span>
                        )}
                      </h4>
                      
                      <p className="text-xs text-[#a0b0d0] mt-1">
                        ID: {app.app_id}
                      </p>
                      
                      <p className="text-xs text-[#a0b0d0] mt-1">
                        Último uso: {formatLastUsed(app.last_used)}
                      </p>
                      
                      {app.scopes && app.scopes.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-[#a0b0d0] mb-1">Permissões:</p>
                          <div className="flex flex-wrap gap-1">
                            {app.scopes.map(scope => (
                              <span 
                                key={scope} 
                                className="px-1.5 py-0.5 bg-[#2a3e62] text-[#c0d0e0] text-xs rounded"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeApp(app.app_id)}
                      disabled={isRevoking === app.app_id}
                      className="border-red-500 text-red-500 hover:bg-red-500/10"
                    >
                      {isRevoking === app.app_id ? (
                        "Revogando..."
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 mr-1" />
                          Revogar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-[#252f1f] p-3 rounded-md text-xs mt-4">
              <div className="flex items-start space-x-2">
                <Key className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-300">
                    <span className="font-bold">Dica de segurança:</span> Revise regularmente as aplicações com acesso à sua conta
                  </p>
                  <p className="text-green-200 mt-1">
                    Revogue o acesso de aplicações que você não reconhece ou não usa mais para manter sua conta segura.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="text-center mt-4">
              <a 
                href="https://app.deriv.com/account/security" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary-500 flex items-center justify-center"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Gerenciar aplicações no site oficial da Deriv
              </a>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}