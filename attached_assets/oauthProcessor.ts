/**
 * oauthProcessor.ts
 * Responsável por processar o fluxo de autenticação OAuth com a Deriv
 * Implementação baseada no código original da Deriv
 */

import { DerivAPI } from './derivApi';
import tokenBlocklist from './tokenBlocklist';

interface TokenObject {
  account: string;
  token: string;
  currency?: string;
  accountName?: string;
}

/**
 * Função principal para processar URL de redirecionamento do OAuth
 * Esta função deve ser chamada quando a aplicação é carregada
 * para verificar se há tokens de OAuth na URL
 */
export async function processOAuthCallback(done: () => void = () => {}): Promise<void> {
  try {
    // Processar query parameters
    const queryStr = parseQueryString();
    const tokenObjectList = queryToObjectArray(queryStr);

    if (tokenObjectList.length) {
      console.log('[OAuth] Tokens detectados na URL, processando...');
      // Esconder o conteúdo principal enquanto processa
      document.getElementById('main')?.setAttribute('style', 'display: none;');
      
      // Marcar que estamos em modo OAuth
      localStorage.setItem('deriv_is_oauth', 'true');
      
      // Adicionar token principal e tokens secundários se válidos
      await addTokenIfValid(tokenObjectList[0].token, tokenObjectList);
      
      // Obter a lista atualizada de tokens
      const accounts = getTokenList();
      if (accounts.length) {
        // Definir o token ativo como o primeiro da lista
        localStorage.setItem('deriv_api_token', accounts[0].token);
        
        // Salvar o identificador da conta ativa
        localStorage.setItem('deriv_active_account', accounts[0].account || accounts[0].accountName || '');
        
        // Registrar timestamp do login
        localStorage.setItem('deriv_oauth_timestamp', String(Date.now()));
        
        // Expor tokens no console para depuração (como solicitado)
        console.log('tokens');
        console.log(accounts);
      }
      
      // Redirecionar para a página principal sem os parâmetros OAuth
      const currentUrl = new URL(window.location.href);
      currentUrl.search = '';
      window.location.href = currentUrl.toString();
    } else {
      // Retornar controle para o callback se não houver tokens
      done();
    }
  } catch (error) {
    console.error('[OAuth] Erro ao processar callback OAuth:', error);
    // Limpar sinalizadores do OAuth em caso de erro
    localStorage.removeItem('deriv_is_oauth');
    done();
  }
}

/**
 * Converter a query string em uma array de objetos com tokens
 */
function queryToObjectArray(queryStr: Record<string, string>): TokenObject[] {
  const tokens: TokenObject[] = [];
  
  console.log("Processando query string para objetos:", queryStr);
  
  // Parâmetros esperados da API Deriv: acct1, token1, cur1
  if (queryStr['acct1'] && queryStr['token1']) {
    console.log("Formato Deriv detectado, criando objeto de token diretamente");
    const tokenObj: TokenObject = {
      account: queryStr['acct1'],
      accountName: queryStr['acct1'], // Para compatibilidade
      token: queryStr['token1']
    };
    
    // Adicionar moeda se estiver disponível
    if (queryStr['cur1']) {
      tokenObj.currency = queryStr['cur1'];
    }
    
    tokens.push(tokenObj);
    return tokens;
  }
  
  // Método original como fallback para outros formatos
  console.log("Usando método tradicional para processar parâmetros");
  Object.keys(queryStr).forEach(key => {
    // Verificar se a chave termina com um número
    if (!/\d$/.test(key)) return;
    
    const index = parseInt(key.slice(-1));
    let paramKey = key.slice(0, -1);
    
    // Fazer o nome consistente com o armazenamento
    paramKey = paramKey === 'acct' ? 'accountName' : paramKey;
    
    // Garantir que o índice seja válido
    while (tokens.length < index) {
      tokens.push({} as TokenObject);
    }
    
    // Atribuir valor ao objeto apropriado
    tokens[index - 1][paramKey as keyof TokenObject] = queryStr[key];
  });
  
  return tokens;
}

/**
 * Processar a URL para extrair os parâmetros, otimizado para a API da Deriv
 * que pode enviar URLs com espaços e formato específico
 */
function parseQueryString(): Record<string, string> {
  const params: Record<string, string> = {};
  // Usar a URL completa para garantir que captamos todos os parâmetros
  const queryString = window.location.search;
  
  if (queryString) {
    // Extrair parâmetros via regex para lidar com possíveis espaços
    const acct1Match = queryString.match(/acct1=([^&\s]+)/);
    const token1Match = queryString.match(/token1=([^&\s]+)/);
    const cur1Match = queryString.match(/cur1=([^&\s]+)/);
    
    // Adicionar parâmetros encontrados
    if (acct1Match && acct1Match[1]) {
      params['acct1'] = decodeURIComponent(acct1Match[1]);
    }
    
    if (token1Match && token1Match[1]) {
      params['token1'] = decodeURIComponent(token1Match[1]);
    }
    
    if (cur1Match && cur1Match[1]) {
      params['cur1'] = decodeURIComponent(cur1Match[1]);
    }
    
    // Log para diagnóstico
    console.log("Parâmetros extraídos:", params);
    
    // Fallback para o método tradicional se não encontramos os parâmetros acima
    if (!acct1Match && !token1Match) {
      console.log("Usando método tradicional de extração de parâmetros");
      try {
        // Primeiro tente com URLSearchParams
        const searchParams = new URLSearchParams(queryString);
        searchParams.forEach((value, key) => {
          params[key] = value;
        });
      } catch (e) {
        console.error("Erro ao usar URLSearchParams:", e);
        
        // Fallback para o método manual
        const cleanQuery = queryString.substring(1); // Remove o '?'
        const pairs = cleanQuery.split('&');
        pairs.forEach(pair => {
          const [key, value] = pair.split('=');
          if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
          }
        });
      }
    }
  }
  
  return params;
}

/**
 * Verificar e adicionar tokens se forem válidos
 */
async function addTokenIfValid(token: string, tokenObjectList: TokenObject[]): Promise<void> {
  // Verificar se o token está na lista de bloqueados
  if (tokenBlocklist.isTokenBlocked(token)) {
    console.warn('[OAuth] Token bloqueado detectado, ignorando');
    return;
  }
  
  // Usar a instância Singleton da API
  const api = DerivAPI.getInstance();
  
  try {
    // Tentar autorizar com o token
    const response = await api.send({
      authorize: token
    });
    
    if (response.error) {
      throw new Error(response.error.message || 'Falha na autorização');
    }
    
    const { authorize } = response;
    
    // Obter detalhes da landing company para verificações
    const lcResponse = await api.send({
      landing_company_details: authorize.landing_company_name
    });
    
    const hasRealityCheck = lcResponse.landing_company_details?.has_reality_check || false;
    const isEuRegulation = ['iom', 'malta'].includes(authorize.landing_company_name.toLowerCase()) && 
                          authorize.country === 'gb';
    
    // Adicionar token principal ao armazenamento
    addToken(token, authorize, hasRealityCheck, isEuRegulation);
    
    // Exibir informações sobre o token principal para debug
    console.error('============= TOKEN PRINCIPAL OAUTH PROCESSADO =============');
    console.error(`[TOKENS-OAUTH] Token principal para ${authorize.loginid}: ${token}`);
    
    // Processar tokens de contas secundárias
    const { account_list: accountList } = authorize;
    if (accountList && accountList.length > 1) {
      // Primeiro, garantir que temos todos os tokens para todas as contas
      console.error("[TOKENS-OAUTH] Processando tokens para todas as contas disponíveis");
      console.error("[TOKENS-OAUTH] Lista de contas:", accountList.map(acc => acc.loginid));
      
      // Para cada conta na lista de contas
      accountList.forEach(account => {
        // Procurar se temos um token específico para esta conta
        const tokenObject = tokenObjectList.find(t => t.accountName === account.loginid);
        
        if (tokenObject) {
          // Se encontramos um token para esta conta, vamos registrá-lo
          console.log(`[OAuth] Registrando token para conta ${account.loginid}`);
          addToken(tokenObject.token, account, false, false);
        } else {
          // Se não encontramos um token específico, usamos o token principal
          // para esta conta também - importante para contas virtuais
          console.log(`[OAuth] Usando token principal para conta ${account.loginid}`);
          
          // Armazenar o token principal também nos formatos específicos desta conta
          // Formatos de armazenamento de token
          localStorage.setItem(`deriv_verified_token_${account.loginid}`, token);
          localStorage.setItem(`deriv_token_${account.loginid.toLowerCase()}`, token);
          
          // Armazenar no mapa de tokens
          try {
            const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
            tokenMap[account.loginid] = token;
            localStorage.setItem('deriv_account_token_map', JSON.stringify(tokenMap));
          } catch (error) {
            console.error('[OAuth] Erro ao atualizar mapa de tokens:', error);
          }
        }
      });
    }
    
    // Salvar a lista completa em formato moderno
    saveOAuthTokens(tokenObjectList);
  } catch (error) {
    // Remover token em caso de falha e propagar o erro
    removeToken(token);
    console.error('[OAuth] Falha ao validar token:', error);
    throw error;
  }
}

/**
 * Salvar todos os tokens OAuth em formato mais moderno
 */
function saveOAuthTokens(tokenList: TokenObject[]): void {
  try {
    // Primeiro, tentar carregar a lista existente
    const existingStr = localStorage.getItem('deriv_user_accounts');
    let existing: TokenObject[] = [];
    
    if (existingStr) {
      try {
        existing = JSON.parse(existingStr);
      } catch (e) {
        console.warn('[OAuth] Erro ao processar lista de contas existente:', e);
      }
    }
    
    // Mesclar com a nova lista, evitando duplicatas
    const merged = [...existing];
    
    tokenList.forEach(newToken => {
      const accountId = newToken.accountName || newToken.account;
      if (!accountId) return;
      
      const existingIndex = merged.findIndex(
        item => (item.accountName || item.account) === accountId
      );
      
      if (existingIndex >= 0) {
        // Atualizar token existente
        merged[existingIndex] = { ...merged[existingIndex], ...newToken };
      } else {
        // Adicionar novo token
        merged.push(newToken);
      }
    });
    
    // Salvar a lista atualizada
    localStorage.setItem('deriv_user_accounts', JSON.stringify(merged));
    
    // Também atualizar o mapa de tokens para compatibilidade
    const tokenMap: Record<string, string> = {};
    merged.forEach(item => {
      const accountId = (item.accountName || item.account || '').toLowerCase();
      if (accountId && item.token) {
        tokenMap[accountId] = item.token;
      }
    });
    
    localStorage.setItem('deriv_account_token_map', JSON.stringify(tokenMap));
  } catch (error) {
    console.error('[OAuth] Erro ao salvar tokens OAuth:', error);
  }
}

// Funções de gerenciamento de tokens

/**
 * Adicionar token no armazenamento local
 */
function addToken(token: string, account: any, hasRealityCheck: boolean, isEu: boolean): void {
  const loginid = account.loginid;
  const isVirtual = /^VRT/.test(loginid);
  
  // Estruturar dados da conta para armazenamento
  const accountInfo = {
    token,
    loginInfo: {
      loginid,
      is_virtual: isVirtual,
      currency: account.currency,
      landing_company_name: account.landing_company_name,
      country: account.country
    },
    hasRealityCheck,
    isEu
  };
  
  // Salvar em diferentes formatos para garantir compatibilidade
  
  // 1. Salvar no localStorage com chave específica para a conta
  localStorage.setItem(`deriv_token_${loginid.toLowerCase()}`, token);
  localStorage.setItem(`deriv_verified_token_${loginid}`, token);
  
  // 2. Salvar no formato de lista de tokens
  const existingTokens = JSON.parse(localStorage.getItem('tokenList') || '[]');
  
  // Verificar se este token já existe
  const tokenIndex = existingTokens.findIndex((t: any) => 
    t.loginInfo.loginid === loginid
  );
  
  if (tokenIndex >= 0) {
    // Atualizar token existente
    existingTokens[tokenIndex] = accountInfo;
  } else {
    // Adicionar novo token
    existingTokens.push(accountInfo);
  }
  
  localStorage.setItem('tokenList', JSON.stringify(existingTokens));
}

/**
 * Remover token específico do armazenamento
 */
function removeToken(token: string): void {
  const tokenList = getTokenList();
  const tokenInfo = tokenList.find(info => info.token === token);
  
  if (tokenInfo && tokenInfo.loginInfo && tokenInfo.loginInfo.loginid) {
    const loginid = tokenInfo.loginInfo.loginid;
    
    // Remover tokens específicos para esta conta
    localStorage.removeItem(`deriv_token_${loginid.toLowerCase()}`);
    localStorage.removeItem(`deriv_verified_token_${loginid}`);
  }
  
  // Atualizar a lista de tokens
  const updatedList = tokenList.filter(info => info.token !== token);
  localStorage.setItem('tokenList', JSON.stringify(updatedList));
  
  // Atualizar também o formato moderno
  try {
    const userAccounts = JSON.parse(localStorage.getItem('deriv_user_accounts') || '[]');
    const updatedAccounts = userAccounts.filter((acc: any) => acc.token !== token);
    localStorage.setItem('deriv_user_accounts', JSON.stringify(updatedAccounts));
  } catch (e) {
    console.error('[OAuth] Erro ao atualizar contas após remoção de token:', e);
  }
}

/**
 * Obter a lista completa de tokens
 */
function getTokenList(): any[] {
  try {
    return JSON.parse(localStorage.getItem('tokenList') || '[]');
  } catch (e) {
    console.error('[OAuth] Erro ao obter lista de tokens:', e);
    return [];
  }
}

/**
 * Remover todos os tokens
 */
export function removeAllTokens(): void {
  // Obter a lista de tokens para remover chaves específicas
  const tokenList = getTokenList();
  
  // Remover tokens específicos por conta
  tokenList.forEach(info => {
    if (info.loginInfo && info.loginInfo.loginid) {
      const loginid = info.loginInfo.loginid;
      localStorage.removeItem(`deriv_token_${loginid.toLowerCase()}`);
      localStorage.removeItem(`deriv_verified_token_${loginid}`);
    }
  });
  
  // Limpar todas as chaves relacionadas
  localStorage.removeItem('tokenList');
  localStorage.removeItem('deriv_user_accounts');
  localStorage.removeItem('deriv_account_token_map');
  localStorage.removeItem('deriv_api_token');
  localStorage.removeItem('deriv_active_account');
  localStorage.removeItem('deriv_is_oauth');
  localStorage.removeItem('deriv_oauth_timestamp');
}

/**
 * Obter a URL para o processo de OAuth da Deriv
 */
export function getOAuthURL(): string {
  // Usar app_id 71403 (Affiliate ID 713161)
  const baseUrl = 'https://oauth.deriv.com/oauth2/authorize';
  const origin = window.location.origin;
  const redirectUri = `${origin}/oauth-callback`;
  
  // Adicionamos o parâmetro de redirecionamento e idioma
  const queryParams = new URLSearchParams({
    app_id: '71403',
    l: 'PT',  // Página em Português
    redirect_uri: redirectUri,
    brand: 'deriv'
  });
  
  // Log para depuração
  console.log(`[OAuth] URL gerada: ${baseUrl}?${queryParams.toString()}`);
  
  return `${baseUrl}?${queryParams.toString()}`;
}

/**
 * Iniciar o processo de login OAuth
 */
export function initiateOAuthLogin(): void {
  window.location.href = getOAuthURL();
}

// Exportação default para compatibilidade
export default {
  processOAuthCallback,
  removeAllTokens,
  initiateOAuthLogin,
  getOAuthURL
};