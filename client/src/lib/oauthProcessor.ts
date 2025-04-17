/**
 * oauthProcessor.ts
 * Responsável pelo processamento da autenticação OAuth com a Deriv
 * Implementado a partir dos arquivos de referência
 */

import { derivAPI } from './derivApi';
import { saveAccountToken } from './accountSwitcher';

// App ID para autenticação OAuth
const APP_ID = '71403'; // ID oficial do nosso aplicativo
const OAUTH_URL = 'https://oauth.deriv.com/oauth2/authorize';

/**
 * Representa uma conta do usuário na Deriv
 */
export interface DerivAccount {
  account_type: string;
  currency: string;
  is_disabled: 0 | 1;
  is_virtual: 0 | 1;
  landing_company_name: string;
  loginid: string;
  token?: string;
}

/**
 * Representa os dados da autorização
 */
export interface AuthorizeResponse {
  authorize: {
    account_list: DerivAccount[];
    balance?: number;
    country?: string;
    currency?: string;
    email?: string;
    fullname?: string;
    is_virtual?: 0 | 1;
    landing_company_fullname?: string;
    landing_company_name?: string;
    local_currencies?: object;
    loginid?: string;
    preferred_language?: string;
    scopes?: string[];
    trading_platform_available?: 0 | 1;
    user_id?: number;
  };
}

/**
 * Representa uma conta do usuário processada a partir dos parâmetros de redirecionamento
 */
export interface UserAccount {
  account: string;
  token: string;
  currency: string;
  loginid?: string;
  isVirtual?: boolean;
  accountType?: string;
  balance?: number;
}

/**
 * Processa o token OAuth da URL de redirecionamento
 * @param url URL completa com parâmetros de consulta
 * @returns Objeto com os dados processados
 */
export const processOAuthRedirect = (url: string) => {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.hash.slice(1)); // remove o '#' inicial
    
    // Verificar se há erros na resposta
    const error = params.get('error');
    const errorDescription = params.get('error_description');
    
    if (error) {
      return {
        error: errorDescription || error,
        token: null,
        accounts: []
      };
    }
    
    // Processar tokens e identificar contas
    const userAccounts: UserAccount[] = [];
    const state = params.get('state');
    
    // Primeira conta: o token principal (token1 ou token)
    const mainToken = params.get('token1') || params.get('token');
    const mainAccount = params.get('acct1') || params.get('loginid');
    const mainCurrency = params.get('cur1') || params.get('currency') || 'USD';
    
    if (mainToken && mainAccount) {
      userAccounts.push({
        account: mainAccount,
        token: mainToken,
        currency: mainCurrency,
        loginid: mainAccount,
        isVirtual: mainAccount.toLowerCase().startsWith('vrtc'),
        accountType: mainAccount.toLowerCase().startsWith('vrtc') ? 'virtual' : 'real'
      });
    }
    
    // Processar contas adicionais (acct2, token2), (acct3, token3), etc.
    let accountIndex = 2;
    let hasMoreAccounts = true;
    
    while (hasMoreAccounts) {
      const acctParam = `acct${accountIndex}`;
      const tokenParam = `token${accountIndex}`;
      const curParam = `cur${accountIndex}`;
      
      const account = params.get(acctParam);
      const token = params.get(tokenParam);
      const currency = params.get(curParam) || 'USD';
      
      if (account && token) {
        userAccounts.push({
          account: account,
          token: token,
          currency: currency,
          loginid: account,
          isVirtual: account.toLowerCase().startsWith('vrtc'),
          accountType: account.toLowerCase().startsWith('vrtc') ? 'virtual' : 'real'
        });
        accountIndex++;
      } else {
        hasMoreAccounts = false;
      }
    }
    
    // Se não encontramos nenhuma conta, mas temos um token, criamos uma conta padrão
    if (userAccounts.length === 0 && mainToken) {
      return {
        token: mainToken, // Retornamos apenas o token para retrocompatibilidade
        state,
        accounts: [],
        error: null
      };
    }
    
    // Verificamos se temos pelo menos um token para usar
    if (userAccounts.length === 0 && !mainToken) {
      return {
        error: 'Nenhum token encontrado na resposta OAuth',
        token: null,
        accounts: []
      };
    }
    
    // Salvar as contas processadas para uso posterior
    localStorage.setItem('deriv_processed_accounts', JSON.stringify(userAccounts));
    
    // Salvar todos os tokens em um array para uso com autorização múltipla
    const allTokens = userAccounts.map(acc => acc.token);
    localStorage.setItem('deriv_all_tokens', JSON.stringify(allTokens));
    console.log(`[OAuthProcessor] Salvando ${allTokens.length} tokens para autorização múltipla`);
    
    // Limpar o estado salvo após uso
    localStorage.removeItem('deriv_oauth_state');
    
    return {
      token: mainToken, // Para retrocompatibilidade com código existente
      accounts: userAccounts,
      state,
      error: null
    };
  } catch (error: any) {
    console.error('[OAuthProcessor] Erro ao processar redirecionamento OAuth:', error);
    return {
      error: error.message || 'Erro ao processar resposta OAuth',
      token: null,
      accounts: []
    };
  }
};

/**
 * Salva as contas recebidas da API na autorização
 * @param accounts Lista de contas do usuário
 * @param token Token de autorização
 */
export const saveAccounts = (accounts: DerivAccount[], token: string) => {
  try {
    if (!accounts || !token) return;
    
    // Salvar token para a conta atualmente autorizada
    const currentAccount = accounts.find(acc => acc.token);
    if (currentAccount) {
      saveAccountToken(currentAccount.loginid, token);
    }
    
    // Salvar tokens para todas as contas que têm tokens
    accounts.forEach(account => {
      if (account.token) {
        saveAccountToken(account.loginid, account.token);
      }
    });
    
    // Salvar lista de contas no localStorage para referência
    localStorage.setItem('deriv_accounts', JSON.stringify(accounts));
    
    console.log('[OAuthProcessor] Contas salvas com sucesso');
  } catch (error) {
    console.error('[OAuthProcessor] Erro ao salvar contas:', error);
  }
};

/**
 * Processa a autorização e salva dados do usuário
 * @param token Token de autorização
 * @returns Resultado da autorização
 */
export const processAuthorization = async (token: string) => {
  try {
    // Verificar se o token é válido
    if (!token) {
      throw new Error('Token não fornecido');
    }
    
    console.log('[OAuthProcessor] Processando autorização...');
    
    // Conectar ao WebSocket se necessário
    if (!derivAPI.isConnected()) {
      await derivAPI.connect();
    }
    
    // Autorizar com o token
    const authorizeResponse = await derivAPI.authorize(token);
    
    if (authorizeResponse && authorizeResponse.account_list) {
      // Salvar as contas e tokens
      saveAccounts(authorizeResponse.account_list, token);
      
      // Salvar o token atual no localStorage
      localStorage.setItem('deriv_api_token', token);
      
      // Disparar evento de login bem-sucedido
      const loginEvent = new CustomEvent('deriv:login_success', {
        detail: authorizeResponse
      });
      document.dispatchEvent(loginEvent);
      
      return authorizeResponse;
    } else {
      throw new Error('Resposta de autorização inválida');
    }
  } catch (error: any) {
    console.error('[OAuthProcessor] Erro no processamento da autorização:', error);
    
    // Disparar evento de erro de login
    const errorEvent = new CustomEvent('deriv:login_error', {
      detail: { error: error.message || 'Erro desconhecido na autorização' }
    });
    document.dispatchEvent(errorEvent);
    
    throw error;
  }
};

/**
 * Gera a URL para a página de autorização OAuth da Deriv
 * @returns URL para autorização OAuth
 */
export const getOAuthLoginURL = () => {
  try {
    // Obter o App ID das configurações ou usar o padrão
    const appId = localStorage.getItem('deriv_app_id') || APP_ID;
    
    // Criar o estado para verificação de CSRF
    const state = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('deriv_oauth_state', state);
    
    // Obter a URL de redirecionamento atual
    const redirectUri = encodeURIComponent(window.location.origin + '/oauth-callback');
    
    // Construir a URL completa
    const url = `${OAUTH_URL}?app_id=${appId}&l=PT&redirect_uri=${redirectUri}&state=${state}`;
    
    return url;
  } catch (error) {
    console.error('[OAuthProcessor] Erro ao gerar URL de login OAuth:', error);
    return '';
  }
};

/**
 * Inicia o processo de login OAuth
 */
export const initiateOAuthLogin = () => {
  try {
    const url = getOAuthLoginURL();
    if (url) {
      window.location.href = url;
    } else {
      throw new Error('Não foi possível gerar a URL de login');
    }
  } catch (error) {
    console.error('[OAuthProcessor] Erro ao iniciar login OAuth:', error);
    
    // Disparar evento de erro
    const errorEvent = new CustomEvent('deriv:login_error', {
      detail: { error: 'Não foi possível iniciar o processo de login' }
    });
    document.dispatchEvent(errorEvent);
  }
};

/**
 * Obtém a lista de contas do usuário
 * @returns Lista de contas salvas ou array vazio
 */
export const getUserAccounts = () => {
  try {
    const accountsStr = localStorage.getItem('deriv_accounts');
    return accountsStr ? JSON.parse(accountsStr) as DerivAccount[] : [];
  } catch (error) {
    console.error('[OAuthProcessor] Erro ao obter contas do usuário:', error);
    return [];
  }
};

/**
 * Verifica se o usuário está autenticado
 * @returns true se o usuário está autenticado, false caso contrário
 */
export const isAuthenticated = () => {
  try {
    // Verificar se temos um token no localStorage
    const token = localStorage.getItem('deriv_api_token');
    return !!token;
  } catch (error) {
    console.error('[OAuthProcessor] Erro ao verificar autenticação:', error);
    return false;
  }
};

/**
 * Faz logout do usuário
 */
export const logout = () => {
  try {
    // Chamar o método de logout da API Deriv
    derivAPI.logout()
      .then(() => {
        console.log('[OAuthProcessor] Logout realizado com sucesso');
      })
      .catch(error => {
        console.error('[OAuthProcessor] Erro ao realizar logout da API:', error);
      })
      .finally(() => {
        // Independente do resultado da API, limpar dados locais
        localStorage.removeItem('deriv_api_token');
        localStorage.removeItem('deriv_accounts');
        localStorage.removeItem('deriv_selected_account');
        
        // Disparar evento de logout
        const logoutEvent = new CustomEvent('deriv:logout');
        document.dispatchEvent(logoutEvent);
      });
  } catch (error) {
    console.error('[OAuthProcessor] Erro durante o logout:', error);
  }
};