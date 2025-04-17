import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, Check } from "lucide-react";
import derivAPI from '@/lib/derivApi';

export function DirectTokenApplier() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [token, setToken] = useState<string>("");
  
  // Nova implementação baseada no método oficial da API Deriv
  const fixDerivConnection = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      if (!token) {
        setError("Por favor insira seu token de API da Deriv");
        setIsLoading(false);
        return;
      }
      
      console.log("[DirectTokenApplier] NOVA IMPLEMENTAÇÃO USANDO O MÉTODO SET_ACCOUNT");
      console.log("[DirectTokenApplier] Iniciando processo de limpeza e reconexão...");
      
      // 1. Limpar totalmente o armazenamento e conexões existentes
      console.log("[DirectTokenApplier] Desconectando e limpando todas as conexões existentes...");
      
      // Desconectar da API
      derivAPI.disconnect(true);
      
      // Aguardar desconexão completa
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Limpar tokens do localStorage
      console.log("[DirectTokenApplier] Limpando todos os tokens do localStorage...");
      const allTokenKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes("deriv") || 
          key.includes("token") || 
          key.includes("account")
        )) {
          allTokenKeys.push(key);
        }
      }
      
      // Remover tokens encontrados
      allTokenKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[DirectTokenApplier] Removido: ${key}`);
      });
      
      // 2. Salvar o novo token e tentar conectar
      console.log("[DirectTokenApplier] Salvando novo token principal...");
      localStorage.setItem('deriv_api_token', token);
      
      // 3. Estabelecer nova conexão com o token
      console.log("[DirectTokenApplier] Estabelecendo nova conexão com token...");
      await derivAPI.connect(token);
      
      // 4. Autorizar com o token fornecido
      console.log("[DirectTokenApplier] Autorizando com o token...");
      const authResponse = await derivAPI.authorize(token);
      
      if (authResponse.error) {
        throw new Error(`Erro de autorização: ${authResponse.error.message || 'Falha na autenticação'}`);
      }
      
      if (!authResponse.authorize) {
        throw new Error("Resposta de autorização inválida da API");
      }
      
      // 5. Verificar a conta conectada
      const loginId = authResponse.authorize.loginid;
      const balance = authResponse.authorize.balance;
      const currency = authResponse.authorize.currency;
      const isVirtual = !!authResponse.authorize.is_virtual;
      const accountList = authResponse.authorize.account_list || [];
      
      console.log(`[DirectTokenApplier] Conexão bem-sucedida! Conta ativa: ${loginId}`);
      console.log(`[DirectTokenApplier] Saldo: ${balance} ${currency}`);
      console.log(`[DirectTokenApplier] Conta virtual: ${isVirtual}`);
      console.log(`[DirectTokenApplier] Lista de contas disponíveis:`, accountList);
      
      // 6. Salvar a conta ativa
      localStorage.setItem('deriv_active_account', loginId.toLowerCase());
      
      // 7. Salvar a lista de contas
      if (accountList && accountList.length > 0) {
        try {
          // Criar um mapa de contas para tokens
          const accountTokenMap: Record<string, string> = {};
          accountTokenMap[loginId.toLowerCase()] = token;
          
          // Salvar o token específico para esta conta
          localStorage.setItem(`deriv_token_${loginId.toLowerCase()}`, token);
          
          // Construir a nova lista de contas
          const userAccounts = accountList.map((acc: any) => ({
            account: acc.loginid.toLowerCase(),
            currency: acc.currency || currency,
            isVirtual: !!acc.is_virtual,
            token: acc.loginid.toLowerCase() === loginId.toLowerCase() ? token : '' // Só temos o token da conta atual
          }));
          
          localStorage.setItem('deriv_user_accounts', JSON.stringify(userAccounts));
          localStorage.setItem('deriv_account_tokens', JSON.stringify(accountTokenMap));
          
          console.log(`[DirectTokenApplier] ${userAccounts.length} contas salvas com sucesso`);
        } catch (mapError) {
          console.error("[DirectTokenApplier] Erro ao mapear contas:", mapError);
        }
      }
      
      // 8. Mostrar mensagem de sucesso
      setSuccess(`Conexão estabelecida com sucesso para a conta ${loginId}!`);
      
      // 9. Recarregar a página após breve delay
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err: any) {
      console.error("[DirectTokenApplier] Erro ao conectar:", err);
      setError(err.message || "Erro desconhecido ao conectar");
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <div className="flex flex-col gap-4 mb-6 p-4 border border-blue-200 bg-blue-50 rounded-md">
        <h3 className="text-lg font-semibold text-blue-800">Reparar Conexão Deriv</h3>
        <p className="text-sm text-blue-700">
          Esta ferramenta corrige problemas de conexão e troca de contas da Deriv. 
          Insira seu token de API para iniciar uma conexão limpa.
        </p>
        
        <div className="flex flex-col gap-2">
          <label htmlFor="token" className="text-sm font-medium text-blue-700">
            Token API da Deriv:
          </label>
          <input
            id="token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="p-2 border border-blue-300 rounded-md"
            placeholder="Insira o token de API da sua conta principal"
          />
          <p className="text-xs text-blue-600">
            O token pode ser obtido em <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noopener noreferrer" className="underline">app.deriv.com/account/api-token</a>
          </p>
        </div>
        
        <Button 
          onClick={fixDerivConnection}
          disabled={isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? "Reparando conexão..." : "Reparar Conexão Deriv"}
        </Button>
        
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert variant="default" className="mt-2 bg-green-50 text-green-600 border-green-100">
            <Check className="h-4 w-4" />
            <AlertTitle>Sucesso</AlertTitle>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );
}