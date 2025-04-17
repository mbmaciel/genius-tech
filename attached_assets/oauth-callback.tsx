import React, { useEffect, useState } from 'react';
import { Redirect } from "wouter";
import { processOAuthCallback } from '@/lib/oauthProcessor';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export default function OAuthCallbackPage() {
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  // Função para exibir tokens no console
  const exposeTokensInConsole = () => {
    try {
      console.error('============= TOKENS OAUTH CALLBACK (INÍCIO) =============');
      
      // 1. Mostrar token principal
      const mainToken = localStorage.getItem('deriv_api_token');
      console.error('[TOKENS] Token principal (deriv_api_token):', mainToken || 'Não encontrado');
      
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
      console.error('[TOKENS] Tokens verificados por conta:');
      Object.entries(verifiedTokens).forEach(([accountId, token]) => {
        console.error(`[TOKENS] → Conta ${accountId}: ${token}`);
      });
      
      // Exibir tokens simples
      console.error('[TOKENS] Tokens simples por conta:');
      Object.entries(simpleTokens).forEach(([accountId, token]) => {
        console.error(`[TOKENS] → Conta ${accountId}: ${token}`);
      });
      
      // 4. Verificar no formato de mapa de tokens
      try {
        const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
        console.error('[TOKENS] Token map:', tokenMap);
      } catch (e) {
        console.error('[TOKENS] Erro ao processar mapa de tokens:', e);
      }
      
      // 5. Verificar na lista de contas
      try {
        const tokenList = JSON.parse(localStorage.getItem('tokenList') || '[]');
        console.error('[TOKENS] Lista de tokens (formato antigo):', tokenList);
      } catch (e) {}
      
      // 6. Verificar lista moderna
      try {
        const userAccounts = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
        console.error('[TOKENS] Lista de contas com tokens (formato moderno):');
        userAccounts.forEach((account: any, index: number) => {
          console.error(`[TOKENS] → Conta ${index + 1}: ${account.accountName || account.account}, Token: ${account.token}`);
        });
      } catch (e) {
        console.error('[TOKENS] Erro ao processar lista de contas:', e);
      }
      
      console.error('============= TOKENS OAUTH CALLBACK (FIM) =============');
    } catch (e) {
      console.error('Erro ao expor tokens:', e);
    }
  };

  useEffect(() => {
    const handleOAuthProcess = async () => {
      try {
        // Iniciar processamento OAuth
        console.log("Iniciando processamento OAuth...");
        
        // Verificar tokens antes do processamento
        console.log("Tokens antes do processamento:");
        exposeTokensInConsole();
        
        // ===== NOVO MÉTODO SIMPLIFICADO DE PROCESSAMENTO =====
        
        // Obter os parâmetros diretamente da URL
        const urlParams = new URLSearchParams(window.location.search);
        
        // Usar nosso extrator melhorado para lidar com os espaços
        console.log("URL completa:", window.location.href);
        
        // Extrair diretamente os parâmetros usando regex que ignora espaços
        const urlSearch = window.location.search;
        
        // Token
        const tokenMatch = urlSearch.match(/token1=([^&\s]+)/);
        const token = tokenMatch ? tokenMatch[1] : null;
        
        // Conta
        const accountMatch = urlSearch.match(/acct1=([^&\s]+)/);
        const account = accountMatch ? accountMatch[1] : null;
        
        // Moeda
        const currencyMatch = urlSearch.match(/cur1=([^&\s]+)/);
        const currency = currencyMatch ? currencyMatch[1] : null;
        
        console.log("Parâmetros extraídos via regex:", { token, account, currency });
        
        if (token && account) {
          console.log("===== TOKEN ENCONTRADO NA URL =====");
          console.log(`Conta: ${account}`);
          console.log(`Moeda: ${currency || 'USD'}`);
          console.log(`Token: ${token.substring(0, 5)}...`);
          
          // 1. Salvar o token principal para autenticação
          localStorage.setItem('deriv_api_token', token);
          console.log("✓ Token principal salvo");
          
          // 2. Salvar token específico para a conta (formatos alternativos)
          localStorage.setItem(`deriv_token_${account}`, token);
          localStorage.setItem(`deriv_verified_token_${account}`, token);
          console.log("✓ Token da conta salvo");
          
          // 3. Atualizar lista de contas
          try {
            const accountList = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
            
            // Verificar se a conta já existe na lista
            const existingIndex = accountList.findIndex((acc: any) => 
              acc.account === account || acc.accountName === account
            );
            
            if (existingIndex >= 0) {
              // Atualizar conta existente
              accountList[existingIndex].token = token;
              if (currency) {
                accountList[existingIndex].currency = currency;
              }
              console.log("✓ Conta existente atualizada");
            } else {
              // Adicionar nova conta
              accountList.push({
                account: account,
                accountName: account,
                token: token,
                currency: currency || 'USD',
                isVirtual: account.startsWith('VRTC') || account.startsWith('VR')
              });
              console.log("✓ Nova conta adicionada à lista");
            }
            
            localStorage.setItem('deriv_user_accounts', JSON.stringify(accountList));
            console.log("✓ Lista de contas salva no localStorage");
            
            // Verificar se o salvamento funcionou
            const savedList = localStorage.getItem('deriv_user_accounts');
            console.log("Lista de contas após salvamento:", savedList ? JSON.parse(savedList) : 'Nada salvo');
          } catch (e) {
            console.error("Erro ao atualizar lista de contas:", e);
          }
          
          // 4. Conectar e autorizar imediatamente com o token
          try {
            // Importar derivAPI diretamente
            const { derivAPI } = await import('@/lib/derivApi');
            
            if (!derivAPI.isConnected) {
              console.log("Conectando ao WebSocket...");
              await derivAPI.connect();
            }
            
            console.log("Autorizando com o token...");
            await derivAPI.authorize(token);
            console.log("✓ Autorização com token bem-sucedida!");
            
            // Disparar evento de autorização
            document.dispatchEvent(new CustomEvent('deriv:authorized', {
              detail: derivAPI.getAccountDetails()
            }));
            console.log("✓ Evento de autorização disparado");
          } catch (authError) {
            console.error("Erro ao autorizar com token:", authError);
          }
          
          // 5. Verificar tokens após o processamento
          console.log("Tokens após processamento manual:");
          exposeTokensInConsole();
          
          // 6. Marcar como concluído para redirecionar
          console.log("Processamento concluído, redirecionando...");
          setComplete(true);
        } else {
          // Método antigo como fallback
          console.log("Nenhum token ou conta encontrados na URL, tentando método alternativo...");
          await processOAuthCallback(() => {
            console.log("Processamento OAuth pelo método antigo concluído");
            console.log("Tokens após processamento:");
            exposeTokensInConsole();
            setComplete(true);
          });
        }
      } catch (err: any) {
        console.error("Erro no processamento OAuth:", err);
        setError(err.message || "Erro desconhecido no processo de autenticação");
        setProcessing(false);
      }
    };

    // Executar processamento apenas uma vez na montagem
    handleOAuthProcess();
    
    // Adicionar evento global para depuração
    (window as any).oauthDebug = {
      exposeTokens: exposeTokensInConsole
    };
  }, []);

  // Verificar se já existe OAuth em progresso
  const existingOAuth = window.location.search.includes('acct1=') || 
                        window.location.search.includes('token1=');

  // Redirecionar para página principal se não for URL de callback OAuth
  if (!existingOAuth && !processing) {
    return <Redirect to="/" />;
  }

  // Redirecionar para o dashboard após processamento bem-sucedido
  if (complete) {
    // Sinalizar que o login foi bem-sucedido para evitar redirecionamentos indesejados
    sessionStorage.setItem("isLoggedIn", "true");
    // Redirecionar para o dashboard
    return <Redirect to="/dashboard" />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-full max-w-md p-8 space-y-4 bg-card rounded-lg shadow-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Autenticação Deriv
          </h1>
          
          {processing && (
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Processando autenticação Deriv...
              </p>
              <p className="text-sm text-muted-foreground">
                Por favor, aguarde enquanto processamos os dados da sua conta.
              </p>
            </div>
          )}

          {error && (
            <div className="py-4">
              <div className="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
                <p className="font-medium">Erro no processo de autenticação</p>
                <p className="text-sm">{error}</p>
              </div>
              <Button 
                className="w-full" 
                onClick={() => window.location.href = '/'}
              >
                Retornar à página inicial
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}