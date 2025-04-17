interface DerivAccount {
  loginid: string;
  token: string;
  currency: string;
  isVirtual?: boolean;
  balance?: number;
  email?: string;
  name?: string;
}

// Função para extrair tokens e informações de contas da URL de redirecionamento
export function extractAccountsFromUrl(url: string): DerivAccount[] {
  try {
    const accounts: DerivAccount[] = [];
    const urlObj = new URL(url);
    
    // Extração de parâmetros da url
    // Formato esperado: acct1=cr799393&token1=a1-f7pnteezo4jzh...&cur1=usd&acct2=vrtc1859315&token2=a1clwe3vfu...&cur2=usd
    const params = urlObj.searchParams;
    
    // Vamos tentar com um approach simples: verificar os pares acct/token/cur de 1 a 10
    const maxIndex = 10; // Limite razoável de contas que um usuário pode ter
    
    // Processa cada conta encontrada
    for (let i = 1; i <= maxIndex; i++) {
      const loginid = params.get(`acct${i}`);
      const token = params.get(`token${i}`);
      const currency = params.get(`cur${i}`);
      
      if (loginid && token && currency) {
        accounts.push({
          loginid,
          token,
          currency,
          // O loginid das contas demo/virtuais geralmente começa com 'VRTC'
          isVirtual: loginid.toUpperCase().startsWith('VRTC')
        });
      }
    }
    
    return accounts;
  } catch (error) {
    console.error('Erro ao extrair contas da URL:', error);
    return [];
  }
}

// Salva todas as contas extraídas no localStorage
export function saveAccounts(accounts: DerivAccount[]): void {
  if (!accounts || accounts.length === 0) return;
  
  // Salva a lista completa de contas
  localStorage.setItem('deriv_accounts', JSON.stringify(accounts));
  
  // Define a primeira conta como a conta ativa por padrão
  localStorage.setItem('deriv_active_account', accounts[0].loginid);
  
  // Armazena a conta ativa para uso rápido
  localStorage.setItem('deriv_token', accounts[0].token);
}

// Obtém todas as contas salvas
export function getAccounts(): DerivAccount[] {
  const accountsJson = localStorage.getItem('deriv_accounts');
  
  if (!accountsJson) return [];
  
  try {
    return JSON.parse(accountsJson);
  } catch (error) {
    console.error('Erro ao carregar contas:', error);
    return [];
  }
}

// Obtém a conta ativa atualmente
export function getActiveAccount(): DerivAccount | null {
  const accounts = getAccounts();
  const activeAccountId = localStorage.getItem('deriv_active_account');
  
  if (!accounts.length || !activeAccountId) return null;
  
  return accounts.find(acc => acc.loginid === activeAccountId) || accounts[0];
}

// Define a conta ativa
export function setActiveAccount(loginid: string): boolean {
  const accounts = getAccounts();
  const account = accounts.find(acc => acc.loginid === loginid);
  
  if (!account) return false;
  
  localStorage.setItem('deriv_active_account', loginid);
  localStorage.setItem('deriv_token', account.token);
  
  return true;
}

// Limpa todas as informações das contas
export function clearAccounts(): void {
  localStorage.removeItem('deriv_accounts');
  localStorage.removeItem('deriv_active_account');
  localStorage.removeItem('deriv_token');
  localStorage.removeItem('deriv_account_info');
}

// Atualiza as informações de uma conta específica (por exemplo, após receber um balance update)
export function updateAccountInfo(loginid: string, newInfo: Partial<DerivAccount>): boolean {
  const accounts = getAccounts();
  const accountIndex = accounts.findIndex(acc => acc.loginid === loginid);
  
  if (accountIndex === -1) return false;
  
  accounts[accountIndex] = { ...accounts[accountIndex], ...newInfo };
  localStorage.setItem('deriv_accounts', JSON.stringify(accounts));
  
  // Se for a conta ativa, atualiza também as informações da conta ativa
  if (loginid === localStorage.getItem('deriv_active_account')) {
    localStorage.setItem('deriv_account_info', JSON.stringify(accounts[accountIndex]));
  }
  
  return true;
}