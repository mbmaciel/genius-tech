import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { derivAPI, connectToDerivAPI } from "@/lib/websocketManager";
import { keepAliveService } from "@/lib/websocketKeepAlive";

/**
 * Componente para aplicar diretamente um token da API Deriv
 * Permite aos usuários colar um token e conectar-se imediatamente
 */
export function DirectTokenApplier() {
  const [token, setToken] = useState("");
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const { toast } = useToast();

  // Função para validar o formato do token
  const isValidTokenFormat = (token: string) => {
    // Tokens da API Deriv geralmente têm um formato específico
    // Este é um validador básico, apenas para verificar se o token tem um formato plausível
    return token.trim().length >= 20 && /^[a-zA-Z0-9]+$/.test(token.trim());
  };

  // Aplicar token e conectar
  const applyToken = async () => {
    if (!token.trim()) {
      setError("Por favor, informe um token de API.");
      return;
    }

    if (!isValidTokenFormat(token)) {
      setError("O token informado não parece ter um formato válido.");
      return;
    }

    setIsAuthorizing(true);
    setError(null);

    try {
      // 1. Conectar ao WebSocket (se ainda não estiver conectado)
      await connectToDerivAPI();

      // 2. Autorizar com o token
      const authResponse = await derivAPI.authorize(token.trim());
      console.log("Resposta de autorização:", authResponse);

      if (authResponse.error) {
        throw new Error(authResponse.error.message || "Falha na autorização");
      }

      if (authResponse.authorize) {
        // 3. Token válido, armazenar informações da conta
        setAccountInfo(authResponse.authorize);
        setIsConnected(true);

        // 4. Salvar o token para uso futuro
        localStorage.setItem("deriv_api_token", token.trim());

        // 5. Iniciar serviço de keep-alive para manter a conexão ativa
        const socket = derivAPI.getSocketInstance();
        if (socket) {
          keepAliveService.start(
            socket,
            () => {
              console.log("Conexão perdida, tentando reconectar...");
              toast({
                title: "Conexão perdida",
                description: "A conexão com a API foi perdida. Tentando reconectar...",
                variant: "destructive",
              });
            },
            () => {
              console.log("Conexão restaurada!");
              toast({
                title: "Conexão restaurada",
                description: "A conexão com a API foi restaurada com sucesso.",
              });
            }
          );
        }

        // 6. Notificar o usuário
        toast({
          title: "Conexão estabelecida",
          description: `Conectado à conta ${authResponse.authorize.loginid}`,
        });
      }
    } catch (err: any) {
      console.error("Erro ao autorizar com token:", err);
      setError(err.message || "Ocorreu um erro ao conectar com o token informado.");
      setIsConnected(false);
      setAccountInfo(null);
    } finally {
      setIsAuthorizing(false);
    }
  };

  // Desconectar
  const disconnect = () => {
    // Parar o serviço de keep-alive
    keepAliveService.stop();
    
    // Desconectar o WebSocket
    derivAPI.disconnect();
    
    // Limpar informações da conta
    setIsConnected(false);
    setAccountInfo(null);
    
    // Limpar token salvo
    localStorage.removeItem("deriv_api_token");
    
    // Notificar usuário
    toast({
      title: "Desconectado",
      description: "A conexão com a API foi encerrada.",
    });
  };

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          Conexão Direta com Token API
        </CardTitle>
        <CardDescription>
          Cole um token API da Deriv para conectar-se rapidamente sem autenticação OAuth
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro de conexão</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {isConnected ? (
          <Alert variant="default" className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle>Conectado</AlertTitle>
            <AlertDescription className="space-y-2">
              <div>Conta: <span className="font-medium">{accountInfo?.loginid}</span></div>
              <div>Nome: <span className="font-medium">{accountInfo?.fullname}</span></div>
              <div>Saldo: <span className="font-medium">{accountInfo?.balance ? `${accountInfo.balance} ${accountInfo.currency}` : "Indisponível"}</span></div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Token da API</Label>
              <Input
                id="token"
                placeholder="Cole seu token API aqui..."
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                O token deve ter permissões para <span className="font-semibold">read</span> e <span className="font-semibold">trade</span> para operações completas.
              </p>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        {isConnected ? (
          <Button variant="destructive" onClick={disconnect} className="ml-auto">
            Desconectar
          </Button>
        ) : (
          <Button 
            onClick={applyToken} 
            disabled={isAuthorizing || !token.trim()} 
            className="ml-auto"
          >
            {isAuthorizing ? "Conectando..." : "Conectar"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}