/**
 * Utilitário para limpeza completa de tokens e dados de autenticação
 * Garante que não haja resíduos de sessões anteriores
 */

// Lista de todas as chaves que precisam ser limpas no localStorage
const LOCAL_STORAGE_KEYS = [
  // Chaves do OAuth
  'deriv_oauth_token',
  'deriv_oauth_accounts',
  'deriv_token_data',
  'deriv_is_oauth',
  'deriv_last_account',
  'deriv_tokens',
  'deriv_accounts',
  'oauth_login_data',
  'oauth_accounts',
  'oauth_tokens',
  'oauth_currencies',
  'oauth_last_login',
  'active_loginid',
  'active_account',
  // Chaves de token API
  'deriv_api_token',
  'derivApiToken',
  'api_token',
  'is_api_token',
  // Chaves de estado de conexão
  'deriv_connection_status',
  'websocket_status',
  'ws_authorized',
  'ws_connection',
  // Chaves de informações de conta
  'account_info',
  'account_list',
  'account_currency',
  'account_balance',
  'account_name',
  'account_type',
  // Outras chaves relacionadas
  'deriv_language',
  'last_used_account',
];

// Lista de todas as chaves que precisam ser limpas no sessionStorage
const SESSION_STORAGE_KEYS = [
  'deriv_token',
  'deriv_session',
  'deriv_account',
  'deriv_session_token',
  'account_session',
  'api_session',
  'oauth_session',
  'login_session',
  'active_session',
];

/**
 * Limpa todos os dados de autenticação do armazenamento local e de sessão
 * @param preserveLanguage Se true, preserva a configuração de idioma (opcional)
 */
export function cleanAllStoredTokens(preserveLanguage: boolean = true): void {
  console.log('🧹 Iniciando limpeza completa de tokens e dados de autenticação...');
  
  // Armazenar idioma se necessário
  let language = null;
  if (preserveLanguage) {
    try {
      language = localStorage.getItem('deriv_language');
    } catch (e) {
      console.warn('Não foi possível preservar o idioma:', e);
    }
  }
  
  // Limpar localStorage
  try {
    for (const key of LOCAL_STORAGE_KEYS) {
      localStorage.removeItem(key);
    }
    console.log('✓ localStorage limpo com sucesso');
  } catch (e) {
    console.error('Erro ao limpar localStorage:', e);
  }
  
  // Limpar sessionStorage
  try {
    for (const key of SESSION_STORAGE_KEYS) {
      sessionStorage.removeItem(key);
    }
    console.log('✓ sessionStorage limpo com sucesso');
  } catch (e) {
    console.error('Erro ao limpar sessionStorage:', e);
  }
  
  // Restaurar idioma se necessário
  if (preserveLanguage && language) {
    try {
      localStorage.setItem('deriv_language', language);
    } catch (e) {
      console.warn('Não foi possível restaurar o idioma:', e);
    }
  }
  
  // Tentar limpar cookies relacionados à autenticação
  try {
    const cookies = document.cookie.split(';');
    let cookiesCleared = 0;
    
    for (const cookie of cookies) {
      const cookieName = cookie.split('=')[0].trim();
      if (cookieName.includes('deriv') || 
          cookieName.includes('oauth') || 
          cookieName.includes('token') || 
          cookieName.includes('account') || 
          cookieName.includes('login')) {
        
        // Expirar o cookie
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        cookiesCleared++;
      }
    }
    
    console.log(`✓ ${cookiesCleared} cookies limpos com sucesso`);
  } catch (e) {
    console.error('Erro ao limpar cookies:', e);
  }
  
  console.log('✓ Limpeza completa finalizada');
}

/**
 * Remove apenas os tokens OAuth, mantendo outras configurações
 */
export function cleanOAuthTokensOnly(): void {
  console.log('🧹 Limpando apenas tokens OAuth...');
  
  const oauthKeys = [
    'deriv_oauth_token',
    'deriv_oauth_accounts',
    'deriv_token_data',
    'deriv_is_oauth',
    'deriv_tokens',
    'oauth_login_data',
    'oauth_accounts',
    'oauth_tokens',
  ];
  
  try {
    for (const key of oauthKeys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    console.log('✓ Tokens OAuth limpos com sucesso');
  } catch (e) {
    console.error('Erro ao limpar tokens OAuth:', e);
  }
}

/**
 * Remove apenas os tokens API, mantendo tokens OAuth e outras configurações
 */
export function cleanApiTokensOnly(): void {
  console.log('🧹 Limpando apenas tokens API...');
  
  const apiKeys = [
    'deriv_api_token',
    'derivApiToken',
    'api_token',
    'is_api_token',
  ];
  
  try {
    for (const key of apiKeys) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    console.log('✓ Tokens API limpos com sucesso');
  } catch (e) {
    console.error('Erro ao limpar tokens API:', e);
  }
}

/**
 * Função completa para realizar logout
 * Limpa todos os dados e recarrega a página
 */
export function performFullLogout(): void {
  console.log('🚪 Iniciando processo de logout completo...');
  
  // Limpar todos os dados
  cleanAllStoredTokens(true);
  
  // Disparar evento de logout
  try {
    document.dispatchEvent(new CustomEvent('deriv:logout_completed', {
      detail: { success: true, timestamp: new Date().toISOString() }
    }));
  } catch (e) {
    console.error('Erro ao disparar evento de logout:', e);
  }
  
  console.log('✓ Logout completo finalizado, recarregando página...');
  
  // Recarregar a página para reiniciar o estado da aplicação
  setTimeout(() => {
    window.location.href = '/';
  }, 500);
}