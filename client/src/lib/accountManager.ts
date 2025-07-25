interface DerivAccount {
  loginid: string;
  token: string;
  currency: string;
  isVirtual?: boolean;
  balance?: number;
  email?: string;
  name?: string;
  fullAccountInfo?: any; // Informações completas recebidas da API
}

// App ID da Deriv para conexões WebSocket
const APP_ID = 72383;

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

// Autoriza múltiplos tokens em uma única conexão WebSocket
export async function authorizeMultipleAccounts(accounts: DerivAccount[]): Promise<boolean> {
  if (!accounts || accounts.length === 0) {
    console.error('Nenhuma conta para autorizar');
    return false;
  }
  
  // Autorizar cada conta individualmente
  const authorizePromises = accounts.map(account => 
    authorizeIndividualAccount(account.token, account.loginid)
  );
  
  try {
    // Esperar todas as autorizações terminarem
    await Promise.all(authorizePromises);
    return true;
  } catch (error) {
    console.error('Erro ao autorizar todas as contas:', error);
    return false;
  }
}

// Função para autorizar um único token
async function authorizeIndividualAccount(token: string, loginid: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Estabelecer uma conexão WebSocket
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID);
      
      // Timeout para não ficar esperando indefinidamente
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error(`Timeout ao autorizar conta ${loginid}.`));
      }, 15000);
      
      ws.onopen = () => {
        console.log(`Conexão WebSocket aberta para autorização da conta ${loginid}`);
        
        // Cria a solicitação com o token
        const authRequest = {
          authorize: token
        };
        
        // Envia a solicitação
        ws.send(JSON.stringify(authRequest));
      };
      
      ws.onmessage = (msg) => {
        try {
          const response = JSON.parse(msg.data);
          console.log(`Resposta de autorização da conta ${loginid}:`, response);
          
          if (response.error) {
            clearTimeout(timeout);
            ws.close();
            console.error(`Erro na autorização da conta ${loginid}:`, response.error);
            reject(new Error(`Erro na autorização da conta ${loginid}: ${response.error.message} (código: ${response.error.code})`));
            return;
          }
          
          if (response.authorize) {
            clearTimeout(timeout);
            
            // Salva informações detalhadas da conta no localStorage usando o loginid como parte da chave
            const accountKey = `deriv_account_info_${loginid}`;
            localStorage.setItem(accountKey, JSON.stringify(response.authorize));
            
            // Exibe informações básicas sobre a conta
            console.log(`Conta ${loginid} autorizada com sucesso!`);
            console.log(`- Nome: ${response.authorize.fullname}`);
            console.log(`- Email: ${response.authorize.email}`);
            console.log(`- Saldo: ${response.authorize.balance} ${response.authorize.currency}`);
            console.log(`- Virtual: ${response.authorize.is_virtual ? 'Sim' : 'Não'}`);
            
            // Atualiza as informações da conta no armazenamento de contas
            updateAccountInfo(loginid, {
              fullAccountInfo: response.authorize,
              email: response.authorize.email,
              name: response.authorize.fullname,
              balance: response.authorize.balance
            });
            
            // Se for a primeira conta sendo autorizada, define-a como a conta ativa
            const activeAccount = localStorage.getItem('deriv_active_account');
            if (!activeAccount) {
              localStorage.setItem('deriv_active_account', loginid);
              localStorage.setItem('deriv_account_info', JSON.stringify(response.authorize));
            }
            
            // Fecha a conexão e resolve a promessa
            ws.close();
            resolve(response.authorize);
          }
        } catch (e) {
          console.error(`Erro ao processar mensagem WebSocket para conta ${loginid}:`, e);
        }
      };
      
      ws.onerror = (error) => {
        console.error(`Erro na conexão WebSocket para autorização da conta ${loginid}:`, error);
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`Falha na comunicação com a API da Deriv para a conta ${loginid}.`));
      };
      
      ws.onclose = () => {
        console.log(`Conexão WebSocket para autorização da conta ${loginid} fechada`);
      };
    } catch (error) {
      reject(error);
    }
  });
}

// Autoriza uma conta específica para obter seus detalhes
export async function authorizeAccount(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // Estabelecer conexão WebSocket
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID);
      
      // Timeout para não ficar esperando indefinidamente
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout ao autorizar conta.'));
      }, 15000);
      
      ws.onopen = () => {
        console.log('Conexão WebSocket aberta para autorização de conta');
        const authRequest = {
          authorize: token
        };
        ws.send(JSON.stringify(authRequest));
      };
      
      ws.onmessage = (msg) => {
        try {
          const response = JSON.parse(msg.data);
          console.log('Resposta de autorização de conta:', response);
          
          if (response.error) {
            clearTimeout(timeout);
            ws.close();
            console.error('Erro na autorização da conta:', response.error);
            reject(new Error(`Erro na autorização: ${response.error.message} (código: ${response.error.code})`));
            return;
          }
          
          if (response.authorize) {
            clearTimeout(timeout);
            
            const accountInfo = response.authorize;
            
            // Exibe detalhes das contas disponíveis no console
            console.log('============ DETALHES DE CONTAS DISPONÍVEIS ============');
            if (accountInfo.account_list && Array.isArray(accountInfo.account_list)) {
              accountInfo.account_list.forEach((acc: any, index: number) => {
                console.log(`Conta ${index + 1}:`);
                console.log(`- ID: ${acc.loginid}`);
                console.log(`- Tipo: ${acc.account_type}`);
                console.log(`- Moeda: ${acc.currency}`);
                console.log(`- Virtual: ${acc.is_virtual ? 'Sim' : 'Não'}`);
                console.log(`- Categoria: ${acc.account_category}`);
                console.log(`- Empresa: ${acc.landing_company_name}`);
                console.log('--------------------------------------------------');
              });
            } else {
              console.log('Nenhuma lista de contas disponível na resposta.');
            }
            console.log('======================================================');
            
            // Fecha a conexão e resolve a promessa com as informações da conta
            ws.close();
            resolve(accountInfo);
          }
        } catch (e) {
          console.error('Erro ao processar mensagem WebSocket:', e);
        }
      };
      
      ws.onerror = (error) => {
        console.error('Erro na conexão WebSocket:', error);
        clearTimeout(timeout);
        ws.close();
        reject(new Error('Falha na comunicação com a API da Deriv.'));
      };
      
      ws.onclose = () => {
        console.log('Conexão WebSocket fechada');
      };
    } catch (error) {
      reject(error);
    }
  });
}