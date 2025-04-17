// Extrair token da URL após redirecionamento do OAuth
export const extractOAuthToken = (): string | null => {
  // Verificar formato específico da Deriv conforme documentação
  // Formato: https://[YOUR_WEBSITE_URL]/redirect/?acct1=cr799393&token1=a1-f7pnteezo4jzhpxclctizt27hyeot&cur1=usd&acct2=vrtc1859315&token2=a1clwe3vfuuus5kraceykdsoqm4snfq&cur2=usd&state=
  const urlParams = new URLSearchParams(window.location.search);
  
  // Verificar token1 (primeiro token, geralmente da conta real)
  const token1 = urlParams.get('token1');
  
  if (token1) {
    console.log('Token OAuth Deriv detectado na URL:', token1.substring(0, 5) + '...');
    // Limpar a URL para evitar que o token fique exposto
    window.history.replaceState({}, document.title, window.location.pathname);
    // Salvar o token no sessionStorage para maior segurança
    sessionStorage.setItem('derivToken', token1);
    return token1;
  }
  
  // Verificar token2 (geralmente conta virtual/demo) apenas como fallback
  const token2 = urlParams.get('token2');
  if (token2) {
    console.log('Token OAuth secundário Deriv detectado na URL:', token2.substring(0, 5) + '...');
    // Limpar a URL para evitar que o token fique exposto
    window.history.replaceState({}, document.title, window.location.pathname);
    // Salvar o token no sessionStorage para maior segurança
    sessionStorage.setItem('derivToken', token2);
    return token2;
  }

  // Verificar no hash fragment (formato alternativo, embora não mencionado na documentação)
  const hashFragment = window.location.hash.substring(1);
  const hashParams = new URLSearchParams(hashFragment);
  const accessToken = hashParams.get('access_token');
  
  if (accessToken) {
    console.log('Token OAuth detectado no hash fragment:', accessToken.substring(0, 5) + '...');
    // Limpar a URL para evitar que o token fique exposto
    window.history.replaceState({}, document.title, window.location.pathname);
    // Salvar o token no sessionStorage
    sessionStorage.setItem('derivToken', accessToken);
    return accessToken;
  }
  
  return null;
};

// Verificar se existe um token salvo
export const getSavedToken = (): string | null => {
  // Verificar primeiro na sessionStorage (preferencial para segurança)
  const sessionToken = sessionStorage.getItem('derivToken');
  if (sessionToken) {
    return sessionToken;
  }
  
  // Verificar no localStorage como fallback para compatibilidade
  const localToken = localStorage.getItem('deriv_token');
  if (localToken) {
    // Migrar para sessionStorage e remover do localStorage para maior segurança
    sessionStorage.setItem('derivToken', localToken);
    localStorage.removeItem('deriv_token');
    return localToken;
  }
  
  return null;
};

// Salvar token
export const saveToken = (token: string): void => {
  // Usar sessionStorage para maior segurança
  sessionStorage.setItem('derivToken', token);
};

// Remover token
export const removeToken = (): void => {
  // Limpar em ambos locais para garantir
  sessionStorage.removeItem('derivToken');
  localStorage.removeItem('deriv_token');
};