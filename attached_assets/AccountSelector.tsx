import React, { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, RefreshCw, Key, CheckCircle, XCircle, LogIn } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import derivAPI from "@/lib/derivApi";

interface Account {
  account: string;
  token?: string;
  currency: string;
  loginid?: string;
  isVirtual?: boolean;
  accountType?: string;
  balance?: number;
}

interface AccountSelectorProps {
  onAccountChanged?: (account: Account) => void;
}

export function AccountSelector({
  onAccountChanged,
}: AccountSelectorProps): JSX.Element {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  console.log("Contas disponíveis:", accounts);

  // Função para carregar contas do usuário diretamente da API
  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      console.log("[AccountSelector] Iniciando carregamento de contas direto da API...");

      // Primeiro verificamos se estamos conectados à API Deriv
      if (!derivAPI.getConnectionStatus()) {
        console.log("[AccountSelector] API não está conectada. Não é possível obter contas.");
        setError("Conecte-se primeiro à sua conta Deriv para ver suas contas");
        setIsLoading(false);
        return;
      }

      // Obter informações da conta autenticada atual incluindo a lista de contas
      const authInfo = derivAPI.getAccountInfo();
      
      // Verificar se temos informações válidas e lista de contas
      console.log("[AccountSelector] Informações de autenticação:", authInfo);
      
      if (authInfo && authInfo.account_list && Array.isArray(authInfo.account_list)) {
        console.log(`[AccountSelector] Obtidas ${authInfo.account_list.length} contas da API Deriv:`, 
          JSON.stringify(authInfo.account_list));
        
        // Transformar os dados da API no formato esperado pelo componente
        const accountsData = authInfo.account_list.map((acc: any) => {
          // Determinar se é conta virtual baseado no ID (começa com 'VRTC')
          const isVirtual = acc.loginid.toUpperCase().startsWith("VRTC");
          
          // Determinar o tipo de conta
          let accountType = "Real";
          if (isVirtual) accountType = "Demo";
          else if (acc.loginid.startsWith("CR")) accountType = "Crypto";
          else if (acc.loginid.includes("MLT")) accountType = "Malta";
          
          const accountObj = {
            account: acc.loginid,
            loginid: acc.loginid,
            currency: acc.currency || "USD",
            isVirtual,
            accountType,
            // Outros dados que possam estar disponíveis
            balance: acc.balance !== undefined ? acc.balance : 0
          };
          
          console.log(`[AccountSelector] Processando conta: ${acc.loginid}`, accountObj);
          return accountObj;
        });
        
        console.log("[AccountSelector] Lista de contas processada:", accountsData);
        
        // Definir as contas
        setAccounts(accountsData);
        
        // Usar a conta atualmente conectada como selecionada
        if (authInfo.loginid) {
          setSelectedAccount(authInfo.loginid);
          localStorage.setItem("deriv_active_account", authInfo.loginid);
        } else if (accountsData.length > 0) {
          setSelectedAccount(accountsData[0].account);
        }
        
        console.log("[AccountSelector] Contas carregadas com sucesso da API");
      } else {
        // Fallback para o método atual se não conseguir obter da API
        console.log("[AccountSelector] Não foi possível obter lista de contas da API, usando conta atual");
        
        if (authInfo && typeof authInfo === "object" && authInfo.loginid) {
          const currentAccount: Account = {
            account: authInfo.loginid,
            currency: authInfo.currency || "USD",
            isVirtual: authInfo.isVirtual || false,
            accountType: authInfo.isVirtual ? "Demo" : "Real",
            balance: authInfo.balance || 0,
          };

          setAccounts([currentAccount]);
          setSelectedAccount(currentAccount.account);
        } else {
          setError("Não foi possível obter informações da conta atual");
        }
      }
    } catch (err: any) {
      console.error("Erro ao carregar contas:", err);
      setError(err.message || "Erro ao carregar contas");
    } finally {
      setIsLoading(false);
    }
  };

  // Carregar contas ao montar o componente
  useEffect(() => {
    loadAccounts();
  }, []);

  // Nova função para trocar de conta usando o método official set_account
  const switchAccount = async () => {
    if (!selectedAccount) {
      setError("Nenhuma conta selecionada");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      console.log(`[AccountSelector] Iniciando processo de troca para a conta ${selectedAccount}...`);

      // Encontrar o objeto da conta com todas as informações
      const accountToSwitch = accounts.find(
        (acc) => acc.account === selectedAccount,
      );

      if (!accountToSwitch) {
        throw new Error(`Conta ${selectedAccount} não encontrada na lista`);
      }
      
      // Usar o método official set_account da Deriv
      // Importação dinâmica para evitar referência circular
      const { switchToAccount } = await import('@/lib/accountSwitcher');
      
      console.log(`[AccountSelector] Chamando accountSwitcher para a conta ${selectedAccount}...`);
      const result = await switchToAccount(selectedAccount);
      
      if (!result.success) {
        throw new Error(result.error || `Falha ao trocar para a conta ${selectedAccount}`);
      }
      
      console.log(`[AccountSelector] Troca de conta bem-sucedida:`, result);
      
      // Notificar sobre a mudança de conta bem-sucedida
      if (onAccountChanged && accountToSwitch) {
        onAccountChanged(accountToSwitch);
      }
      
      // Fechar diálogo e recarregar após 1 segundo
      setOpen(false);
      setTimeout(() => {
        console.log(`[AccountSelector] Recarregando página para aplicar troca de conta...`);
        window.location.reload();
      }, 1000);
      
      // ESTRATÉGIA DIRETA PARA TODAS AS CONTAS (SIMPLES E EFICAZ)
      // Baseada diretamente na documentação oficial da Deriv
      
      console.log(`[AccountSelector] Trocando para a conta: ${selectedAccount}`);
      
      // Primeiro, precisamos verificar se temos um token para a conta
      // A lista de accts/tokens do OAuth está em formato como:
      // deriv_user_accounts = [{ account: "CR123456", token: "abc123", currency: "USD" }]
      try {
        // 1. Primeiro, tentar obter os tokens da lista salva no OAuth
        const userAccountsStr = localStorage.getItem('deriv_user_accounts');
        let accounts = [];
        
        if (userAccountsStr) {
          try {
            accounts = JSON.parse(userAccountsStr);
            console.log(`[AccountSelector] Contas disponíveis do OAuth:`, accounts);
          } catch (e) {
            console.warn('[AccountSelector] Erro ao processar deriv_user_accounts:', e);
            // Continuar para usar outros métodos como fallback
          }
        } 
        
        // 2. Se não existir deriv_user_accounts, criar a partir das contas atuais
        if (!userAccountsStr || accounts.length === 0) {
          console.log(`[AccountSelector] Contas OAuth não encontradas, usando contas atuais como fallback`);
          
          // Recuperar tokens de outras fontes para construir esta lista
          accounts = accounts.map(acc => {
            // Para cada conta, tentar recuperar o token de múltiplas fontes
            const accountId = acc.account.toLowerCase();
            let token = null;
            
            // Tentar buscar em ordem de prioridade
            [
              `deriv_token_${accountId}`,
              `deriv_verified_token_${accountId}`
            ].some(key => {
              const savedToken = localStorage.getItem(key);
              if (savedToken) {
                token = savedToken;
                return true; // Para interromper o loop
              }
              return false;
            });
            
            // Usar mapeamento como opção adicional
            if (!token) {
              try {
                const tokenMapStr = localStorage.getItem('deriv_account_tokens');
                if (tokenMapStr) {
                  const tokenMap = JSON.parse(tokenMapStr);
                  if (tokenMap && tokenMap[accountId]) {
                    token = tokenMap[accountId];
                  }
                }
              } catch (e) {
                console.error(`[AccountSelector] Erro ao processar mapa de tokens:`, e);
              }
            }
            
            // NÃO devemos usar o token principal para contas virtuais,
            // pois isso faria com que o sistema voltasse para a conta principal
            
            return {
              ...acc,
              token: token
            };
          });
          
          // Salvar esta lista para uso futuro
          if (accounts.some(acc => acc.token)) {
            try {
              localStorage.setItem('deriv_user_accounts', JSON.stringify(accounts));
              console.log(`[AccountSelector] Lista de contas e tokens reconstruída e salva:`);
            } catch (e) {
              console.error(`[AccountSelector] Erro ao salvar lista de contas reconstruída:`, e);
            }
          }
        }
        
        // Encontrar a conta selecionada na lista
        const selectedAccountData = accounts.find((acc: any) => 
          acc.account.toLowerCase() === selectedAccount.toLowerCase()
        );
        
        if (!selectedAccountData || !selectedAccountData.token) {
          throw new Error(`Não foi possível encontrar token para a conta ${selectedAccount}`);
        }
        
        // Desconectar completamente primeiro
        console.log(`[AccountSelector] Desconectando conexão atual...`);
        derivAPI.disconnect(true);
        
        // Aguardar um momento para garantir desconexão completa
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Reconectar com o WebSocket (e usar o token específico)
        console.log(`[AccountSelector] Estabelecendo nova conexão WebSocket...`);
        
        // Salvar o token para uso direto em vez de usar setToken
        const specificToken = selectedAccountData.token;
        localStorage.setItem('deriv_api_token', specificToken);
        
        // Desconectar e conectar com novo token
        derivAPI.disconnect(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        await derivAPI.connect();
        
        // Autorizar diretamente com o token específico da conta
        console.log(`[AccountSelector] Autorizando com token específico para ${selectedAccount}`);
        const authResult = await derivAPI.authorize(selectedAccountData.token);
        
        if (authResult.error) {
          throw new Error(`Falha na autorização: ${authResult.error.message}`);
        }
        
        console.log(`[AccountSelector] Autorização bem-sucedida para ${selectedAccount}`);
        
        // Verificar a conta atual após autorização
        if (authResult.authorize && authResult.authorize.loginid) {
          const connectedAccount = authResult.authorize.loginid;
          console.log(`[AccountSelector] Conta conectada após autorização: ${connectedAccount}`);
          
          if (connectedAccount.toLowerCase() !== selectedAccount.toLowerCase()) {
            throw new Error(`Autorização conectou à conta ${connectedAccount} em vez de ${selectedAccount}`);
          }
          
          // Atualizar o saldo da conta no objeto accountToSwitch
          if (authResult.authorize.balance !== undefined) {
            accountToSwitch.balance = authResult.authorize.balance;
          }
        }
        
        // Notificar mudança
        console.log(`[AccountSelector] Troca para ${selectedAccount} concluída com sucesso`);
        if (onAccountChanged) {
          onAccountChanged(accountToSwitch);
        }
        
        // Fechar o diálogo
        setOpen(false);
        return;
      } catch (error: any) {
        console.error(`[AccountSelector] Erro ao trocar para conta ${selectedAccount}:`, error);
        setError(error.message);
        setIsLoading(false);
      }
      
      // Se chegou aqui, ou não é uma conta virtual ou falhou a tentativa direta
      // ABORDAGEM NORMAL: Encontrar o token específico para a conta
      console.log("[AccountSelector] Verificando token correto para a conta selecionada...");

      // IMPORTANTE: Cada conta tem seu próprio token. Vamos procurar pelos tokens em várias fontes.
      const normalizedAccountId = selectedAccount.toLowerCase();
      
      // Fontes de tokens a verificar
      type TokenSource = 
        | { name: string; type: 'direct' }
        | { name: string; type: 'map'; key: string }
        | { name: string; type: 'list'; matchField: string; valueField: string; matchValue: string };
        
      const sources: TokenSource[] = [
        // 1. Primeiro verificar o mapeamento de tokens por conta (do OAuth)
        { 
          name: 'deriv_account_tokens', 
          type: 'map', 
          key: normalizedAccountId
        },
        // 2. Verificar tokens individuais por conta
        {
          name: `deriv_token_${normalizedAccountId}`,
          type: 'direct'
        },
        // 3. Verificar tokens verificados
        {
          name: `deriv_verified_token_${normalizedAccountId}`,
          type: 'direct'
        },
        // 4. Verificar no mapeamento tradicional
        {
          name: 'deriv_account_token_map',
          type: 'map',
          key: normalizedAccountId
        },
        // 5. Verificar lista de contas salvas durante OAuth
        {
          name: 'deriv_user_accounts',
          type: 'list',
          matchField: 'account',
          valueField: 'token',
          matchValue: normalizedAccountId
        }
      ];
      
      // Procurar por tokens em todas as fontes
      let token = null;
      
      for (const source of sources) {
        try {
          if (source.type === 'direct') {
            // Verificar token armazenado diretamente
            const foundToken = localStorage.getItem(source.name);
            if (foundToken) {
              token = foundToken;
              console.log(`[AccountSelector] Token encontrado em ${source.name}`);
              break;
            }
          } 
          else if (source.type === 'map') {
            // Verificar token em um mapeamento
            const mapJson = localStorage.getItem(source.name);
            if (mapJson) {
              const tokenMap = JSON.parse(mapJson) as Record<string, string>;
              if (tokenMap && tokenMap[source.key]) {
                token = tokenMap[source.key];
                console.log(`[AccountSelector] Token encontrado em mapeamento ${source.name}`);
                break;
              }
            }
          }
          else if (source.type === 'list') {
            // Verificar token em uma lista de objetos
            const listJson = localStorage.getItem(source.name);
            if (listJson) {
              const list = JSON.parse(listJson) as any[];
              if (Array.isArray(list)) {
                const matchingItem = list.find(item => 
                  item[source.matchField] && 
                  item[source.matchField].toLowerCase() === source.matchValue
                );
                
                if (matchingItem && matchingItem[source.valueField]) {
                  token = matchingItem[source.valueField];
                  console.log(`[AccountSelector] Token encontrado em lista ${source.name}`);
                  break;
                }
              }
            }
          }
        } catch (error) {
          console.error(`[AccountSelector] Erro ao buscar token em ${source.name}:`, error);
        }
      }

      // 6. Verificar no objeto da conta se disponível
      if (!token && accountToSwitch.token) {
        token = accountToSwitch.token;
        console.log(`[AccountSelector] Token encontrado no objeto da conta para ${selectedAccount}`);
      }
      
      // NÃO USAR MAIS: Para contas virtuais, não devemos usar o token da conta principal
      // pois isso faz o sistema retornar para a conta principal em vez de mudar para a virtual
      const isVirtualAccount = selectedAccount.toUpperCase().startsWith('VRTC');
      if (!token && isVirtualAccount) {
        console.log(`[AccountSelector] Conta virtual ${selectedAccount} requer seu próprio token OAuth específico`);
      }

      if (!token) {
        // ÚLTIMA TENTATIVA - verificar se podemos usar setAccount com o token atual
        // Verificar se a conta está na lista de contas disponíveis para o token atual
        const accountsList = authInfo?.account_list || [];
        const isInCurrentAccountsList = accountsList.some((acc: any) => 
          acc.loginid && acc.loginid.toUpperCase() === selectedAccount.toUpperCase()
        );
        
        if (isInCurrentAccountsList) {
          console.log(`[AccountSelector] Tentando usar o método setAccount com autorização atual para ${selectedAccount}`);
          try {
            const result = await derivAPI.setAccount(selectedAccount);
            
            console.log(`[AccountSelector] Troca para ${selectedAccount} bem-sucedida via setAccount:`, result);
            
            // Atualizar informações de saldo
            try {
              const updatedInfo = derivAPI.getAccountInfo();
              if (updatedInfo && updatedInfo.balance) {
                accountToSwitch.balance = updatedInfo.balance.balance;
              }
            } catch (e) {
              console.warn("[AccountSelector] Erro ao atualizar saldo após troca:", e);
            }
            
            // Notificar mudança
            if (onAccountChanged) {
              onAccountChanged(accountToSwitch);
            }
            
            // Fechar o diálogo
            setOpen(false);
            return;
          } catch (e) {
            console.error("[AccountSelector] Falha ao usar setAccount como última tentativa:", e);
            // Continuar para o erro padrão abaixo
          }
        }
        
        // Se todas as tentativas falharam, não temos token para esta conta
        throw new Error(
          `Não foi possível obter token para a conta ${selectedAccount}. Por favor, reconecte via OAuth.`,
        );
      }

      console.log(
        `[AccountSelector] Token encontrado para conta ${selectedAccount}. Preparando autenticação...`,
      );
      
      console.log(`[AccountSelector] Token a ser utilizado: ${token.substring(0, 5)}...`);
      
      // Armazenar o token encontrado nos outros locais para facilitar acesso futuro
      try {
        // 1. Salvar como token verificado
        localStorage.setItem(`deriv_verified_token_${normalizedAccountId}`, token);
        
        // 2. Salvar no mapeamento de tokens
        const tokenMap: Record<string, string> = {};
        try {
          const mapJson = localStorage.getItem('deriv_account_tokens');
          if (mapJson) {
            const parsedMap = JSON.parse(mapJson);
            if (parsedMap && typeof parsedMap === 'object') {
              // Copiar as propriedades do objeto parseado para o tokenMap
              Object.keys(parsedMap).forEach(key => {
                if (typeof parsedMap[key] === 'string') {
                  tokenMap[key] = parsedMap[key];
                }
              });
            }
          }
        } catch (e) {
          console.error('[AccountSelector] Erro ao carregar mapa de tokens existente:', e);
        }
        
        // Adicionar ou atualizar o token no mapa
        tokenMap[normalizedAccountId] = token;
        localStorage.setItem('deriv_account_tokens', JSON.stringify(tokenMap));
        
        // 3. Salvar como token individual
        localStorage.setItem(`deriv_token_${normalizedAccountId}`, token);
        
        // 4. Salvar também no formato tradicional para compatibilidade
        const verifiedTokenKey = `deriv_verified_token_${selectedAccount}`;
        localStorage.setItem(verifiedTokenKey, token);
        
        console.log(`[AccountSelector] Token para ${selectedAccount} salvo em múltiplos locais para acesso futuro`);
      } catch (e) {
        console.warn('[AccountSelector] Erro ao salvar token em múltiplos locais:', e);
      }

      // Usar método aprimorado setAccount
      console.log(`[AccountSelector] Usando método setAccount aprimorado para ${selectedAccount}`);
      const setAccountResult = await derivAPI.send({
        set_account: selectedAccount
      });
      
      if (!result || result.error) {
        throw new Error(
          `Falha ao alternar para conta ${selectedAccount}: ${result?.error?.message || 'Erro desconhecido'}`,
        );
      }
      
      console.log(`[AccountSelector] Troca de conta bem-sucedida para: ${selectedAccount}`);

      // Atualizar o objeto da conta com saldo mais recente
      const accountInfo = derivAPI.getAccountInfo();
      if (accountInfo?.balance !== undefined) {
        accountToSwitch.balance = accountInfo.balance.balance;
      }

      // Notificar mudança
      if (onAccountChanged) {
        onAccountChanged(accountToSwitch);
      }

      // Restaurar assinaturas básicas
      console.log("[AccountSelector] Restaurando assinaturas após troca de conta");
      setTimeout(() => {
        try {
          // Resubscrever ao saldo
          derivAPI.subscribeToBalanceUpdates()
            .then(() => console.log("Assinatura de saldo restaurada"))
            .catch(e => console.error("Erro ao restaurar assinatura de saldo:", e));
          
          // Resubscrever aos ticks se necessário
          derivAPI.subscribeTicks("R_100")
            .then(() => console.log("Assinatura de ticks R_100 restaurada"))
            .catch(e => console.error("Erro ao restaurar assinatura de ticks:", e));
        } catch (e) {
          console.error("Erro ao restaurar assinaturas:", e);
        }
      }, 1000);

      // Fechar o diálogo
      setOpen(false);
    } catch (error: any) {
      console.error("Erro na troca de conta:", error);
      setError(`Falha na troca: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Componente para gerenciar tokens de forma mais eficiente
  const TokenManager = ({ accountId }: { accountId: string }) => {
    const [token, setToken] = useState<string>("");
    const [tokenStatus, setTokenStatus] = useState<
      "idle" | "verifying" | "valid" | "invalid"
    >("idle");
    const [tokenInfo, setTokenInfo] = useState<string | null>(null);
    const [tokenSources, setTokenSources] = useState<Array<{source: string, found: boolean}>>([]);

    // Função para obter o token de múltiplas fontes
    const findAndLoadToken = () => {
      // Lista de todas as fontes possíveis de tokens para verificar
      const sources = [
        { key: `deriv_verified_token_${accountId}`, type: 'localStorage', label: 'Token verificado' },
        { key: `deriv_token_${accountId}`, type: 'localStorage', label: 'Token individual' },
        { key: 'deriv_account_tokens', type: 'jsonMap', label: 'Mapa de tokens', field: accountId },
        { key: 'deriv_user_accounts', type: 'jsonArray', label: 'Lista OAuth', field: 'account', tokenField: 'token', value: accountId }
      ];

      // Resultados para exibir na interface
      const sourcesResults: Array<{source: string, found: boolean}> = [];
      let foundToken: string | null = null;

      // Verificar cada fonte
      sources.forEach(source => {
        try {
          if (source.type === 'localStorage') {
            const storedToken = localStorage.getItem(source.key);
            const found = !!storedToken;
            sourcesResults.push({ source: source.label, found });
            
            if (found && !foundToken && storedToken) {
              foundToken = storedToken;
              console.log(`[TokenManager] Token encontrado em ${source.key}`);
              // Quando encontramos um token válido para esta conta, vamos garantir que ele seja mantido 
              // para uso futuro no sistema de conexão principal
              localStorage.setItem('deriv_api_token', storedToken);
            }
          } 
          else if (source.type === 'jsonMap') {
            const jsonStr = localStorage.getItem(source.key);
            if (jsonStr) {
              try {
                const parsedMap = JSON.parse(jsonStr) as Record<string, string>;
                const field = source.field as string;
                const found = !!parsedMap[field];
                sourcesResults.push({ source: source.label, found });
                
                if (found && !foundToken) {
                  foundToken = parsedMap[field];
                  console.log(`[TokenManager] Token encontrado no mapa ${source.key}`);
                }
              } catch (e) {
                sourcesResults.push({ source: source.label, found: false });
              }
            } else {
              sourcesResults.push({ source: source.label, found: false });
            }
          }
          else if (source.type === 'jsonArray') {
            const jsonStr = localStorage.getItem(source.key);
            if (jsonStr) {
              try {
                const parsedArray = JSON.parse(jsonStr) as Array<Record<string, any>>;
                if (Array.isArray(parsedArray)) {
                  const field = source.field as string;
                  const tokenField = source.tokenField as string;
                  const value = source.value as string;
                  
                  const item = parsedArray.find(
                    item => (item[field]?.toLowerCase() === value.toLowerCase())
                  );
                  const found = !!item && !!item[tokenField];
                  sourcesResults.push({ source: source.label, found });
                  
                  if (found && !foundToken && item) {
                    foundToken = item[tokenField];
                    console.log(`[TokenManager] Token encontrado na lista ${source.key}`);
                  }
                } else {
                  sourcesResults.push({ source: source.label, found: false });
                }
              } catch (e) {
                sourcesResults.push({ source: source.label, found: false });
              }
            } else {
              sourcesResults.push({ source: source.label, found: false });
            }
          }
        } catch (e) {
          sourcesResults.push({ source: source.label, found: false });
          console.error(`[TokenManager] Erro ao verificar fonte ${source.key}:`, e);
        }
      });

      // Atualizar estado com os resultados
      setTokenSources(sourcesResults);
      
      // Se encontrou um token, exibi-lo
      if (foundToken) {
        // Mostrar apenas parte do token por segurança
        const tokenPreview = 
          foundToken.substring(0, 6) + 
          "..." + 
          foundToken.substring(foundToken.length - 4);
        
        setTokenInfo(`Token encontrado: ${tokenPreview}`);
        setToken(foundToken);
        setTokenStatus("valid");
        return true;
      } else {
        setTokenInfo("Nenhum token encontrado para esta conta");
        setToken("");
        setTokenStatus("idle");
        return false;
      }
    };

    // Ao montar o componente ou quando o accountId mudar, verificar o token
    useEffect(() => {
      findAndLoadToken();
    }, [accountId]);

    // Função para verificar o token
    const verifyToken = async () => {
      if (!token.trim()) {
        setTokenStatus("invalid");
        setTokenInfo("Token não pode estar vazio");
        return;
      }

      setTokenStatus("verifying");
      setTokenInfo("Verificando token...");

      try {
        // Criar um WebSocket temporário para verificação
        const verificationWs = new WebSocket(
          "wss://ws.derivws.com/websockets/v3?app_id=71403",
        );

        // Definir timeout
        const timeoutPromise = new Promise<null>((_, reject) => {
          setTimeout(() => reject(new Error("Timeout na verificação")), 10000);
        });

        // Promise de verificação
        const verifyPromise = new Promise<{ loginid: string }>(
          (resolve, reject) => {
            verificationWs.onopen = () => {
              // Enviar solicitação de autorização
              verificationWs.send(
                JSON.stringify({
                  authorize: token,
                  req_id: Date.now(),
                }),
              );
            };

            verificationWs.onmessage = (event) => {
              try {
                const response = JSON.parse(event.data);

                if (response.error) {
                  verificationWs.close();
                  reject(new Error(`API error: ${response.error.message}`));
                  return;
                }

                if (response.authorize) {
                  verificationWs.close();
                  resolve(response.authorize);
                }
              } catch (e) {
                verificationWs.close();
                reject(e);
              }
            };

            verificationWs.onerror = (error) => {
              reject(new Error("Erro na conexão WebSocket"));
            };
          },
        );

        // Executar a verificação com timeout
        const result = await Promise.race([verifyPromise, timeoutPromise]);

        if (result) {
          // Token é válido, verificar se é para a conta correta
          if (result.loginid === accountId) {
            // Token válido e para a conta correta!
            setTokenStatus("valid");
            setTokenInfo(`✅ Token válido para a conta ${accountId}`);

            // Salvar o token verificado em múltiplas localizações para garantir que ele seja encontrado
            localStorage.setItem(`deriv_verified_token_${accountId}`, token);
            localStorage.setItem(`deriv_token_${accountId.toLowerCase()}`, token);
            
            // Salvar também como token principal da API - isso é fundamental para a consistência
            localStorage.setItem('deriv_api_token', token);
            
            // Registrar que este é o token atual
            localStorage.setItem('deriv_active_account', accountId);

            // Atualizar o mapeamento
            const tokenMap: Record<string, string> = {};
            try {
              const existingMap = localStorage.getItem(
                "deriv_account_token_map",
              );
              if (existingMap) {
                Object.assign(tokenMap, JSON.parse(existingMap));
              }
            } catch (e) {
              console.error("Erro ao carregar mapeamento existente:", e);
            }

            tokenMap[accountId] = token;
            tokenMap[accountId.toLowerCase()] = token; // Adicionar também em lowercase para compatibilidade
            localStorage.setItem(
              "deriv_account_token_map",
              JSON.stringify(tokenMap),
            );
          } else {
            // Token válido, mas para outra conta
            setTokenStatus("invalid");
            setTokenInfo(
              `❌ Este token é para a conta ${result.loginid}, não para ${accountId}`,
            );
          }
        }
      } catch (error: any) {
        console.error("Erro na verificação do token:", error);
        setTokenStatus("invalid");
        setTokenInfo(`❌ Erro: ${error.message}`);
      }
    };

    return (
      <div className="space-y-3">
        <h4 className="font-medium mb-2">Gerenciar Token da Conta</h4>

        <div className="text-sm text-muted-foreground">
          {tokenStatus === "valid" ? (
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800 flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span>Token válido para a conta <strong>{accountId}</strong></span>
            </div>
          ) : (
            <span>Insira um token de API da Deriv associado a esta conta. Um token
            correto deve retornar dados da conta {accountId}.</span>
          )}
        </div>

        {/* Status de verificação das fontes de token */}
        {tokenSources.length > 0 && (
          <div className="p-2 bg-muted/30 rounded-md border text-xs space-y-1">
            <p className="font-medium mb-1 text-sm">Fontes de token verificadas:</p>
            {tokenSources.map((source, index) => (
              <div key={index} className="flex items-center">
                {source.found ? (
                  <CheckCircle className="h-3 w-3 text-green-600 mr-1.5" />
                ) : (
                  <XCircle className="h-3 w-3 text-gray-400 mr-1.5" />
                )}
                <span className={source.found ? "text-green-600" : "text-gray-500"}>
                  {source.source}: {source.found ? "Encontrado" : "Não encontrado"}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex space-x-2">
          <Input
            placeholder="Token da API Deriv"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="flex-1"
            type="password"
          />
          <Button
            size="sm"
            onClick={verifyToken}
            disabled={tokenStatus === "verifying" || !token.trim()}
          >
            {tokenStatus === "verifying" ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Key className="h-4 w-4" />
            )}
            <span className="ml-2">Verificar</span>
          </Button>
        </div>

        {tokenInfo && (
          <div
            className={`mt-2 text-sm ${
              tokenStatus === "valid"
                ? "text-green-600"
                : tokenStatus === "invalid"
                  ? "text-red-600"
                  : "text-muted-foreground"
            }`}
          >
            {tokenInfo}
          </div>
        )}

        <div className="flex space-x-2 mt-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => findAndLoadToken()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Recarregar Token
          </Button>
          
          <Button 
            size="sm" 
            variant="default" 
            className="flex-1"
            disabled={token === "" || tokenStatus !== "valid"}
            onClick={() => {
              // Use o token específico para a conta em múltiplos locais
              if (token) {
                localStorage.setItem(`deriv_verified_token_${accountId}`, token); 
                localStorage.setItem(`deriv_token_${accountId.toLowerCase()}`, token);
                localStorage.setItem('deriv_api_token', token);  // Token principal para a API também
                localStorage.setItem('deriv_active_account', accountId);  // Marcar como conta ativa
              }
              // Força uma reconexão para usar o token mais recente
              derivAPI.disconnect(true, false);
              setTimeout(() => {
                switchAccount();  // chamar a versão sem argumentos
              }, 500);
              setOpen(false);
            }}
          >
            <LogIn className="h-4 w-4 mr-2" />
            Usar Esta Conta
          </Button>
        </div>

        <div className="text-xs mt-4 text-muted-foreground">
          <strong>Dica:</strong> Você pode obter um novo token de API em{" "}
          <a
            href="https://app.deriv.com/account/api-token"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            app.deriv.com/account/api-token
          </a>
        </div>
      </div>
    );
  };

  // Verificar se temos mais de uma conta
  const hasMultipleAccounts = accounts.length > 1;

  // Função para limpar todos os mapeamentos de tokens e iniciar obtenção de novos tokens
  const resetTokenMappings = (showMessage = true): void => {
    try {
      console.log("=== LIMPANDO TODOS OS TOKENS E MAPEAMENTOS ===");

      // Limpar todos os mapeamentos e tokens existentes
      const tokensToRemove = [
        "derivLinkedTokens",
        "deriv_api_token",
        "deriv_account_token_map",
        "deriv_target_account",
        "deriv_active_account",
        "oauth_login_tokens",
      ];

      // Adicionar tokens específicos para cada conta
      const savedAccountsJson = localStorage.getItem("derivSavedAccounts");
      if (savedAccountsJson) {
        try {
          const savedAccounts = JSON.parse(savedAccountsJson);
          savedAccounts.forEach((account: any) => {
            if (account.account) {
              tokensToRemove.push(`deriv_token_${account.account}`);
              tokensToRemove.push(`deriv_verified_token_${account.account}`);
            }
          });
        } catch (e) {
          console.error("Erro ao processar contas salvas:", e);
        }
      }

      // Limpar todos os tokens do localStorage
      tokensToRemove.forEach((key) => {
        localStorage.removeItem(key);
      });

      // Limpar tokens do sessionStorage
      sessionStorage.removeItem("derivApiToken");
      sessionStorage.removeItem("derivToken");
      sessionStorage.removeItem("activeSubscriptions");

      // Limpar tokens das contas salvas
      if (savedAccountsJson) {
        try {
          const savedAccounts = JSON.parse(savedAccountsJson);
          const updatedAccounts = savedAccounts.map((acc: any) => ({
            ...acc,
            token: undefined,
          }));
          localStorage.setItem(
            "derivSavedAccounts",
            JSON.stringify(updatedAccounts),
          );
        } catch (e) {
          localStorage.removeItem("derivSavedAccounts");
        }
      }

      // Fechar a conexão WebSocket atual
      derivAPI.disconnect(true, false);

      if (showMessage) {
        // Mostrar mensagem de sucesso com mais informações
        setError(
          `Todos os tokens foram limpos. Agora você precisará obter novos tokens usando o OAuth da Deriv para cada conta. Utilize o botão "Conectar" no cabeçalho ou na página inicial.`,
        );
      }

      // Recarregar a lista de contas, mas sem tokens
      setTimeout(() => {
        loadAccounts();
      }, 1000);
    } catch (e) {
      console.error("Erro ao limpar mapeamentos de tokens:", e);
      if (showMessage) {
        setError(
          "Erro ao limpar mapeamento de tokens: " + (e as Error).message,
        );
      }
    }
  };

  // Função para formatar o display do nome da conta
  const formatAccountName = (account: Account) => {
    let displayName = account.account;

    // Adicionar tipo de conta e moeda
    if (account.accountType) {
      displayName = `${account.accountType} (${account.currency || "USD"})`;

      // Adicionar saldo se disponível
      if (account.balance !== undefined) {
        displayName += ` - ${account.balance} ${account.currency || "USD"}`;
      }

      // Adicionar ID da conta truncado
      if (account.account) {
        const truncatedId =
          account.account.substring(0, 4) +
          "..." +
          account.account.substring(account.account.length - 4);
        displayName += ` - ${truncatedId}`;
      }
    }

    return displayName;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="ml-2"
          disabled={isLoading}
        >
          {isLoading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <></>
          )}
          {"Gerenciar Contas"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {"Selecionar Conta Deriv"}
          </DialogTitle>
          <DialogDescription>
            {"Escolha qual conta deseja utilizar para operar. Se estiver tendo problemas, use o botão 'Limpar Tokens' abaixo."}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Lista de seleção de contas */}
          <Select
            value={selectedAccount || undefined}
            onValueChange={setSelectedAccount}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Contas Disponíveis</SelectLabel>
                {accounts.map((account) => (
                  <SelectItem key={account.account} value={account.account}>
                    {formatAccountName(account)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Detalhes da conta selecionada com abas para gerenciamento de token */}
          {selectedAccount && (
            <div className="mt-4">
              <Tabs defaultValue="details">
                <TabsList className="w-full mb-2">
                  <TabsTrigger value="details" className="flex-1">
                    Detalhes
                  </TabsTrigger>
                  <TabsTrigger value="token" className="flex-1">
                    Token
                  </TabsTrigger>
                </TabsList>

                <TabsContent
                  value="details"
                  className="p-3 border rounded-md bg-muted/30"
                >
                  <h4 className="font-medium mb-2">Detalhes da Conta</h4>
                  {accounts
                    .filter((acc) => acc.account === selectedAccount)
                    .map((account) => (
                      <div key={account.account} className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            ID da Conta:
                          </span>
                          <span className="font-mono">{account.account}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tipo:</span>
                          <span>
                            {account.accountType ||
                              (account.isVirtual ? "Demo" : "Real")}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Moeda:</span>
                          <span>{account.currency || "USD"}</span>
                        </div>
                        {account.balance !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Saldo:
                            </span>
                            <span>
                              {account.balance} {account.currency || "USD"}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                </TabsContent>

                <TabsContent
                  value="token"
                  className="p-3 border rounded-md bg-muted/30"
                >
                  <TokenManager accountId={selectedAccount} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {/* Botões de atualização e gerenciamento */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadAccounts()}
              disabled={isLoading}
            >
              {isLoading ? "Atualizando..." : "Atualizar Lista"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetTokenMappings(true)}
              disabled={isLoading}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Limpar Tokens
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            onClick={switchAccount}
            disabled={isLoading || !selectedAccount}
          >
            {isLoading ? "Processando..." : "Usar Esta Conta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
