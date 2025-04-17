/**
 * Serviço para lidar com a autenticação OAuth da Deriv
 * Baseado na documentação oficial: https://developers.deriv.com/docs/developer-portal/#authentication
 */

// App ID registrado no Deriv developer portal
const APP_ID = "33666"; // ID padrão da aplicação

// URL de autenticação OAuth
const OAUTH_URL = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}`;

// Funções para manipular os tokens OAuth

/**
 * Obtém os tokens de sessão do URL de redirecionamento após o login OAuth
 * Formata os parâmetros da URL em um array de contas de usuário
 */
export function parseOAuthRedirectURL(url: string): Array<{
  account: string;
  token: string;
  currency: string;
}> {
  try {
    // Obter a parte da query string da URL
    const queryString = url.split('?')[1];
    if (!queryString) return [];

    // Obter os parâmetros da query string
    const params = new URLSearchParams(queryString);
    
    // Extrair os pares de account/token/currency
    const accounts = [];
    let index = 1;
    
    while (params.has(`acct${index}`)) {
      const account = params.get(`acct${index}`);
      const token = params.get(`token${index}`);
      const currency = params.get(`cur${index}`);
      
      if (account && token && currency) {
        accounts.push({
          account,
          token,
          currency
        });
      }
      
      index++;
    }
    
    return accounts;
  } catch (error) {
    console.error('Erro ao processar URL de redirecionamento:', error);
    return [];
  }
}

/**
 * Gera a URL de autenticação OAuth para redirecionamento
 */
export function getOAuthURL(redirectURL?: string, affiliateToken?: string): string {
  let url = OAUTH_URL;
  
  // Adicionar URL de redirecionamento se fornecida
  if (redirectURL) {
    url += `&redirect_uri=${encodeURIComponent(redirectURL)}`;
  }
  
  // Adicionar token de afiliado se fornecido (apenas para login)
  if (affiliateToken) {
    url += `&affiliate_token=${encodeURIComponent(affiliateToken)}`;
  }
  
  return url;
}

/**
 * Redireciona o usuário para a página de autenticação OAuth da Deriv
 */
export function redirectToOAuth(redirectURL?: string, affiliateToken?: string): void {
  const oauthURL = getOAuthURL(redirectURL, affiliateToken);
  window.location.href = oauthURL;
}

/**
 * Salva as contas do usuário e o token selecionado
 */
export function saveUserAccounts(accounts: Array<{
  account: string;
  token: string;
  currency: string;
}>): void {
  try {
    // Salvar todas as contas
    sessionStorage.setItem('userAccounts', JSON.stringify(accounts));
    
    // Se houver pelo menos uma conta, salvar o token da primeira (pode ser mudado depois)
    if (accounts.length > 0) {
      const firstRealAccount = accounts.find(acc => !acc.account.startsWith('VRT'));
      
      // Priorizar conta real se existir, caso contrário usar a primeira conta
      if (firstRealAccount) {
        sessionStorage.setItem('derivToken', firstRealAccount.token);
        sessionStorage.setItem('derivAccount', firstRealAccount.account);
      } else {
        sessionStorage.setItem('derivToken', accounts[0].token);
        sessionStorage.setItem('derivAccount', accounts[0].account);
      }
      
      // Marcar como logado
      sessionStorage.setItem('isLoggedIn', 'true');
    }
  } catch (error) {
    console.error('Erro ao salvar contas do usuário:', error);
  }
}

/**
 * Obtém as contas do usuário salvas
 */
export function getUserAccounts(): Array<{
  account: string;
  token: string;
  currency: string;
}> {
  try {
    const accountsStr = sessionStorage.getItem('userAccounts');
    return accountsStr ? JSON.parse(accountsStr) : [];
  } catch (error) {
    console.error('Erro ao obter contas do usuário:', error);
    return [];
  }
}

/**
 * Obtém o token ativo
 */
export function getActiveToken(): string | null {
  return sessionStorage.getItem('derivToken');
}

/**
 * Troca para uma conta diferente
 */
export function switchAccount(account: string, token: string): void {
  sessionStorage.setItem('derivToken', token);
  sessionStorage.setItem('derivAccount', account);
}

/**
 * Limpa as informações de autenticação
 */
export function logout(): void {
  sessionStorage.removeItem('userAccounts');
  sessionStorage.removeItem('derivToken');
  sessionStorage.removeItem('derivAccount');
  sessionStorage.removeItem('isLoggedIn');
}

/**
 * Verifica se o usuário está autenticado
 */
export function isAuthenticated(): boolean {
  return sessionStorage.getItem('isLoggedIn') === 'true' && 
         sessionStorage.getItem('derivToken') !== null;
}

// Exportar o serviço como default
export default {
  parseOAuthRedirectURL,
  getOAuthURL,
  redirectToOAuth,
  saveUserAccounts,
  getUserAccounts,
  getActiveToken,
  switchAccount,
  logout,
  isAuthenticated
};