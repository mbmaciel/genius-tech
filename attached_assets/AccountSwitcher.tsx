import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle, ChevronRight, LogOut } from "lucide-react";
import derivAPI from '@/lib/derivApi';
import { Separator } from "@/components/ui/separator";

export function AccountSwitcher() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  
  // Função para depuração - exibir todos os tokens no console
  const showAllTokensInConsole = (prefix = '[AccountSwitcher]') => {
    console.log(`${prefix} ========= TOKENS ARMAZENADOS =========`);
    
    // 1. Token principal
    const mainToken = localStorage.getItem('deriv_api_token');
    const mainAccount = localStorage.getItem('deriv_active_account');
    console.log(`${prefix} Token principal:`, mainToken || 'Não encontrado');
    console.log(`${prefix} Conta principal:`, mainAccount || 'Não definida');
    
    // 2. Verificar tokens no formato deriv_verified_token_XXX
    const verifiedTokens: Record<string, string> = {};
    // 3. Verificar tokens no formato deriv_token_XXX (minúsculo)
    const simpleTokens: Record<string, string> = {};
    
    // Iterar por todas as chaves no localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      if (key.startsWith('deriv_verified_token_')) {
        const accountId = key.replace('deriv_verified_token_', '');
        verifiedTokens[accountId] = localStorage.getItem(key) || '';
      } else if (key.startsWith('deriv_token_')) {
        const accountId = key.replace('deriv_token_', '');
        simpleTokens[accountId] = localStorage.getItem(key) || '';
      }
    }
    
    // Exibir tokens verificados
    console.log(`${prefix} Tokens verificados por conta:`);
    Object.entries(verifiedTokens).forEach(([accountId, token]) => {
      console.log(`${prefix} → Conta ${accountId}: ${token}`);
    });
    
    // Exibir tokens simples
    console.log(`${prefix} Tokens simples por conta:`);
    Object.entries(simpleTokens).forEach(([accountId, token]) => {
      console.log(`${prefix} → Conta ${accountId}: ${token}`);
    });
    
    // 4. Verificar no formato de mapa de tokens
    try {
      const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
      console.log(`${prefix} Token map:`, tokenMap);
    } catch (e) {
      console.log(`${prefix} Erro ao processar mapa de tokens:`, e);
    }
    
    // 5. Verificar na lista de contas
    try {
      const accountList = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
      console.log(`${prefix} Lista de contas com tokens:`);
      accountList.forEach((account: any, index: number) => {
        console.log(`${prefix} → Conta ${index + 1}: ${account.accountName || account.account}, Token: ${account.token}`);
      });
    } catch (e) {
      console.log(`${prefix} Erro ao processar lista de contas:`, e);
    }
    
    console.log(`${prefix} ======================================`);
  };
  
  // Expor função para depuração no console global
  useEffect(() => {
    (window as any).showDeriveAccountTokens = showAllTokensInConsole;
    
    // Exibir tokens ao montar o componente
    console.log("[AccountSwitcher] Tokens disponíveis ao montar o componente:");
    showAllTokensInConsole();
  }, []);
  
  // Função para guardar e organizar tokens das contas
  const saveTokensForAccounts = (loginId: string, token: string) => {
    try {
      // Armazenamos os tokens em múltiplos formatos para garantir compatibilidade
      // Formato 1: deriv_verified_token_CONTA (ex: deriv_verified_token_CR1330028)
      localStorage.setItem(`deriv_verified_token_${loginId}`, token);
      
      // Formato 2: deriv_token_conta (minúsculo) (ex: deriv_token_cr1330028)
      localStorage.setItem(`deriv_token_${loginId.toLowerCase()}`, token);
      
      // Formato 3: mapa de tokens (estrutura JSON) 
      try {
        const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
        tokenMap[loginId] = token;
        tokenMap[loginId.toLowerCase()] = token;
        localStorage.setItem('deriv_account_token_map', JSON.stringify(tokenMap));
      } catch (e) {
        console.error("[AccountSwitcher] Erro ao salvar no mapa de tokens:", e);
        // Criar um novo mapa se falhou
        const newMap = { [loginId]: token, [loginId.toLowerCase()]: token };
        localStorage.setItem('deriv_account_token_map', JSON.stringify(newMap));
      }
      
      // Formato 4: array de contas do usuário (estrutura JSON)
      try {
        const userAccounts = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
        // Verificar se a conta já existe
        const accountIndex = userAccounts.findIndex((acc: any) => 
          acc.account === loginId || acc.loginid === loginId
        );
        
        if (accountIndex >= 0) {
          // Atualizar token da conta existente
          userAccounts[accountIndex].token = token;
        } else {
          // Adicionar nova conta
          userAccounts.push({
            account: loginId,
            loginid: loginId,
            token: token
          });
        }
        
        localStorage.setItem('deriv_user_accounts', JSON.stringify(userAccounts));
      } catch (e) {
        console.error("[AccountSwitcher] Erro ao salvar no array de contas:", e);
        // Criar um novo array se falhou
        const newAccounts = [{ account: loginId, loginid: loginId, token: token }];
        localStorage.setItem('deriv_user_accounts', JSON.stringify(newAccounts));
      }
      
      console.log(`[AccountSwitcher] Tokens para a conta ${loginId} salvos com sucesso em todos os formatos`);
      return true;
    } catch (error) {
      console.error("[AccountSwitcher] Erro ao salvar tokens:", error);
      return false;
    }
  };

  // Função para limpar o localStorage e reconectar com um novo token
  const connectWithNewToken = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!token) {
        setError("Por favor insira um token de API válido da Deriv");
        return;
      }
      
      console.log("[AccountSwitcher] Iniciando processo de reconexão com novo token...");
      
      // Solução mais eficiente: recarregar a página com o novo token
      // Isso garante uma conexão totalmente nova ao WebSocket e elimina
      // qualquer estado residual do cliente anterior
      
      // 1. Preservar dados importantes antes da reconexão
      const digitStats = localStorage.getItem('digitStats_R_100');
      
      // 2. Limpar tokens e identificadores de contas existentes
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes("deriv") ||
          key.includes("token") ||
          key.includes("account")
        )) {
          keysToRemove.push(key);
        }
      }
      
      // Remover as chaves
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[AccountSwitcher] Removido: ${key}`);
      });
      
      // 3. Restaurar dados importantes
      if (digitStats) {
        localStorage.setItem('digitStats_R_100', digitStats);
      }
      
      // 4. Salvar o novo token no localStorage
      localStorage.setItem('deriv_api_token', token);
      localStorage.setItem('force_reconnect', 'true');
      
      // 5. Recarregar a página para forçar uma reconexão completa
      setSuccess("Reconectando com o novo token...");
      
      // Limpar as contas salvas no localStorage para forçar atualização completa
      localStorage.removeItem('deriv_accounts');
      localStorage.removeItem('deriv_user_accounts');
      localStorage.removeItem('deriv_account_list');
      
      // Pequeno atraso para garantir que o usuário veja a mensagem
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
      return;
    } catch (error) {
      console.error("Erro ao trocar conta:", error);
      setError(error.message || "Erro ao trocar conta. Verifique o token e tente novamente.");
      setIsLoading(false);
    }
  };
  
  // Função para trocar para uma conta específica usando recarregamento de página
  const switchAccount = async () => {
    if (!accountId) {
      setError("Por favor insira um ID de conta válido");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      console.log(`[AccountSwitcher] Tentando trocar para a conta ${accountId}...`);
      
      // 1. Obter token para a conta especificada
      // Verificar em todos os formatos possíveis de armazenamento
      const accountToken = 
        localStorage.getItem(`deriv_verified_token_${accountId}`) || 
        localStorage.getItem(`deriv_token_${accountId.toLowerCase()}`) || 
        null;
      
      if (!accountToken) {
        // Tentar obter de outras estruturas
        let foundToken = null;
        try {
          // Verificar no mapa JSON
          const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
          if (tokenMap[accountId] || tokenMap[accountId.toLowerCase()]) {
            foundToken = tokenMap[accountId] || tokenMap[accountId.toLowerCase()];
          }
          
          // Verificar na lista de contas
          if (!foundToken) {
            const accounts = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
            const matchingAccount = accounts.find((acc: any) => 
              acc.account === accountId || acc.loginid === accountId
            );
            
            if (matchingAccount?.token) {
              foundToken = matchingAccount.token;
            }
          }
        } catch (e) {
          console.error("[AccountSwitcher] Erro ao buscar token:", e);
        }
        
        // Se ainda não encontrou, reportar erro
        if (!foundToken) {
          throw new Error(`Nenhum token encontrado para a conta ${accountId}. Conecte-se primeiro com um token válido.`);
        }
        
        // Usar o token encontrado
        localStorage.setItem('deriv_api_token', foundToken);
        localStorage.setItem('deriv_active_account', accountId);
        
        setSuccess(`Preparando para trocar para a conta ${accountId}...`);
        
        // Definir uma flag para forçar reconexão
        localStorage.setItem('force_reconnect', 'true');
        
        // Limpar as contas salvas no localStorage para forçar atualização completa
        localStorage.removeItem('deriv_accounts');
        localStorage.removeItem('deriv_user_accounts');
        localStorage.removeItem('deriv_account_list');
        
        // Recarregar a página para aplicar a nova conexão
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
        return;
      }
      
      // Se temos um token para a conta, usar esse token
      localStorage.setItem('deriv_api_token', accountToken);
      localStorage.setItem('deriv_active_account', accountId);
      
      setSuccess(`Preparando para trocar para a conta ${accountId}...`);
      
      // Definir uma flag para forçar reconexão
      localStorage.setItem('force_reconnect', 'true');
      
      // Limpar as contas salvas no localStorage para forçar atualização completa
      localStorage.removeItem('deriv_accounts');
      localStorage.removeItem('deriv_user_accounts');
      localStorage.removeItem('deriv_account_list');
      
      // Recarregar a página para aplicar a nova conexão
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error("Erro ao trocar conta:", error);
      setError(error.message || "Erro ao trocar conta. Verifique o ID e tente novamente.");
      setIsLoading(false);
    }
  };
  
  return (
    <Card className="border border-border shadow-md">
      <CardHeader className="bg-muted/50">
        <CardTitle>
          Gerenciar Conexão com Deriv
        </CardTitle>
        <CardDescription>
          Troque entre contas ou conecte-se com novos tokens de API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>
              {error}
            </AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="bg-green-50 border-green-200 text-green-900">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <AlertTitle className="text-green-900">Sucesso</AlertTitle>
            <AlertDescription className="text-green-800">
              {success}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-8">
          {/* Seção 1: Conectar com novo token */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">1. Conectar com Novo Token</h3>
            <p className="text-sm text-muted-foreground">
              Conecte-se à Deriv usando um token de API
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="token">Token de API</Label>
              <Input
                id="token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Cole seu token de API aqui"
              />
              
              <Button
                onClick={connectWithNewToken}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Conectando..." : "Conectar com Novo Token"}
              </Button>
            </div>
          </div>
          
          {/* Seção 2: Trocar para conta específica */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">2. Trocar para Conta Específica</h3>
            <p className="text-sm text-muted-foreground">
              Usa o método oficial account_switch da Deriv para trocar entre contas
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="accountId">ID da Conta</Label>
              <Input
                id="accountId"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                placeholder="Exemplo: VRTC2817959 ou CR1330028"
              />
              
              <Button
                onClick={switchAccount}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? "Trocando..." : "Trocar para esta Conta"}
              </Button>
            </div>
          </div>
          
          {/* Seção 3: Desconectar completamente */}
          <Separator className="my-6" />
          
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-red-600">3. Desconectar Completamente</h3>
            <p className="text-sm text-muted-foreground">
              Remove todas as conexões e tokens - use apenas se estiver tendo problemas para trocar contas
            </p>
            
            <Button
              variant="outline"
              className="w-full border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => {
                setIsLoading(true);
                setError(null);
                setSuccess("Desconectando completamente...");
                
                try {
                  // 1. Limpar todos os dados do localStorage relacionados a Deriv
                  for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && (
                      key.includes("deriv") || 
                      key.includes("token") || 
                      key.includes("account")
                    )) {
                      localStorage.removeItem(key);
                    }
                  }
                  
                  // 2. Limpar todos os dados do sessionStorage relacionados a Deriv
                  for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key && (
                      key.includes("deriv") || 
                      key.includes("token") || 
                      key.includes("account")
                    )) {
                      sessionStorage.removeItem(key);
                    }
                  }
                  
                  // 3. Forçar desconexão total no WebSocket
                  derivAPI.disconnect(true);
                  
                  // 4. Definir sinalizador para forçar desconexão completa
                  localStorage.setItem('reset_complete', 'true');
                  
                  // 5. Recarregar a página após um pequeno atraso
                  setTimeout(() => {
                    window.location.href = '/login';
                  }, 1000);
                } catch (error) {
                  console.error("[AccountSwitcher] Erro ao desconectar completamente:", error);
                  setError("Erro ao tentar desconectar. Tente novamente.");
                  setIsLoading(false);
                }
              }}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Desconectar Completamente
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}