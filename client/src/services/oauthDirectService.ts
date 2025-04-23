/**
 * Serviço OAuth para autenticação Deriv
 * Gerencia fluxo de autenticação, captura tokens do URL e permite seleção de contas
 */

import IndependentDerivService, { independentDerivService } from './independent-deriv-service';

// Tipos de callbacks para eventos
export type MessageCallback = (data: any) => void;
export type StateCallback = (connected: boolean) => void;
export type ErrorCallback = (error: any) => void;
export type AccountCallback = (accounts: AccountInfo[]) => void;

// Tipos para informações de conta
export interface AccountInfo {
  loginid: string;
  token: string;
  currency?: string;
  balance?: number;
  name?: string;
  email?: string;
  is_virtual?: boolean;
  landing_company_name?: string;
}

class OAuthDirectService {
  private authorizationWindow: Window | null = null;
  private redirectUri: string = window.location.origin + '/oauth-callback';
  private derivService: IndependentDerivService;
  private appId: number;
  private accounts: AccountInfo[] = [];
  private selectedAccount: AccountInfo | null = null;
  private accountListeners: AccountCallback[] = [];
  private authorizeTimeouts: {[key: string]: NodeJS.Timeout} = {};
  private static instance: OAuthDirectService;

  constructor(appId?: number) {
    // Sobrescrever o appId se fornecido
    this.appId = appId || 1089;
    this.derivService = new IndependentDerivService(this.appId);
    
    // Procurar por tokens no localStorage
    this.tryLoadStoredAccounts();
    
    // Adicionar manipulador para eventos de mensagem para capturar respostas OAuth
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handlePostMessage);
    }
  }

  // Implementação do Singleton para garantir uma única instância
  public static getInstance(appId?: number): OAuthDirectService {
    if (!OAuthDirectService.instance) {
      OAuthDirectService.instance = new OAuthDirectService(appId);
    }
    return OAuthDirectService.instance;
  }

  // Tentativa de carregar contas salvas
  private tryLoadStoredAccounts(): void {
    try {
      const storedAccounts = localStorage.getItem('deriv_accounts');
      if (storedAccounts) {
        this.accounts = JSON.parse(storedAccounts);
        
        // Se tiver contas, notificar listeners
        if (this.accounts.length > 0) {
          this.notifyAccountListeners();
          
          // Se tiver uma conta selecionada, tentar autorizar
          const selectedLoginId = localStorage.getItem('deriv_selected_account');
          if (selectedLoginId) {
            const selectedAccount = this.accounts.find(acc => acc.loginid === selectedLoginId);
            if (selectedAccount) {
              this.selectAccount(selectedAccount.loginid);
            }
          }
        }
      }
    } catch (error) {
      console.error('[DerivOAuth] Erro ao carregar contas salvas:', error);
    }
  }

  // Manipulador para mensagens de janela
  private handlePostMessage = (event: MessageEvent): void => {
    // Verificar origem para segurança
    if (event.origin !== window.location.origin && !event.origin.includes('deriv.com')) {
      return;
    }

    // Verificar se é uma mensagem do Deriv OAuth
    if (event.data && typeof event.data === 'object' && event.data.tokenResponse) {
      const tokenData = event.data.tokenResponse;
      
      if (tokenData.url) {
        // Extrair token da URL
        const url = new URL(tokenData.url);
        const params = new URLSearchParams(url.search);
        const token = params.get('token1');
        
        if (token) {
          console.log('[DerivOAuth] Token recebido do redirecionamento OAuth');
          this.processAuthToken(token);
        }
      } else if (tokenData.oauth_token) {
        console.log('[DerivOAuth] Token recebido diretamente');
        this.processAuthToken(tokenData.oauth_token);
      }
    }
  };

  // Iniciar fluxo OAuth para autenticar com Deriv
  public initiateOAuth(): Window | null {
    // Criar URL para autenticação OAuth da Deriv
    const oauthUrl = new URL('https://oauth.deriv.com/oauth2/authorize');
    
    // Adicionar parâmetros necessários
    oauthUrl.searchParams.append('app_id', this.appId.toString());
    oauthUrl.searchParams.append('l', 'PT'); // Português como idioma padrão
    oauthUrl.searchParams.append('redirect_uri', this.redirectUri);
    oauthUrl.searchParams.append('response_type', 'token'); // Resposta como token diretamente no URL
    
    // Calcular dimensões e posição da janela
    const width = 400;
    const height = 700;
    const left = window.innerWidth / 2 - width / 2 + window.screenX;
    const top = window.innerHeight / 2 - height / 2 + window.screenY;
    
    // Abrir janela para autenticação
    this.authorizationWindow = window.open(
      oauthUrl.toString(),
      'DerivOAuth',
      `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
    );
    
    // Verificar se a janela foi realmente aberta
    if (!this.authorizationWindow) {
      console.error('[DerivOAuth] Falha ao abrir janela de autenticação. Verifique se os popups estão permitidos.');
      return null;
    }
    
    // Monitorar se a janela foi fechada
    const checkWindow = setInterval(() => {
      if (this.authorizationWindow && this.authorizationWindow.closed) {
        clearInterval(checkWindow);
        console.log('[DerivOAuth] Janela de autenticação fechada pelo usuário');
      }
    }, 500);
    
    return this.authorizationWindow;
  }

  // Métodos delegados para o serviço principal
  public async connect(): Promise<boolean> {
    return this.derivService.connect();
  }
  
  public disconnect(): void {
    this.derivService.disconnect();
  }
  
  public isConnected(): boolean {
    return this.derivService.isConnected();
  }
  
  public isAuthenticated(): boolean {
    return this.derivService.isAuthenticated();
  }
  
  public async authorize(token: string): Promise<any> {
    return this.derivService.authorize(token);
  }
  
  public async getBalance(): Promise<any> {
    return this.derivService.getBalance();
  }
  
  public async subscribeTicks(symbol: string): Promise<any> {
    return this.derivService.subscribeTicks(symbol);
  }
  
  public async unsubscribeTicks(symbol: string): Promise<void> {
    return this.derivService.unsubscribeTicks(symbol);
  }
  
  public addMessageListener(msgType: string, callback: (data: any) => void): void {
    this.derivService.addMessageListener(msgType, callback);
  }
  
  public removeMessageListener(msgType: string, callback: (data: any) => void): void {
    this.derivService.removeMessageListener(msgType, callback);
  }
  
  public addConnectionListener(callback: (connected: boolean) => void): void {
    this.derivService.addConnectionListener(callback);
  }
  
  public removeConnectionListener(callback: (connected: boolean) => void): void {
    this.derivService.removeConnectionListener(callback);
  }
  
  // Processar token de autorização recebido
  private async processAuthToken(token: string): Promise<void> {
    try {
      console.log('[DerivOAuth] Processando token de autorização');
      
      // Autorizar na API da Deriv com o token recebido
      const response = await this.authorize(token);
      
      if (response && response.authorize) {
        const authorizeData = response.authorize;
        
        // Mapear para AccountInfo
        const accountInfo: AccountInfo = {
          loginid: authorizeData.loginid,
          token: token,
          currency: authorizeData.currency,
          balance: authorizeData.balance,
          name: authorizeData.fullname,
          email: authorizeData.email,
          is_virtual: authorizeData.is_virtual,
          landing_company_name: authorizeData.landing_company_name
        };
        
        // Verificar se a conta já existe, atualizar se necessário
        const existingIndex = this.accounts.findIndex(acc => acc.loginid === accountInfo.loginid);
        
        if (existingIndex >= 0) {
          this.accounts[existingIndex] = {
            ...this.accounts[existingIndex],
            ...accountInfo
          };
        } else {
          this.accounts.push(accountInfo);
        }
        
        // Salvar contas no localStorage
        localStorage.setItem('deriv_accounts', JSON.stringify(this.accounts));
        
        // Definir como conta selecionada
        this.selectedAccount = accountInfo;
        localStorage.setItem('deriv_selected_account', accountInfo.loginid);
        
        // Notificar listeners sobre mudança nas contas
        this.notifyAccountListeners();
        
        console.log('[DerivOAuth] Autorização bem-sucedida para conta:', accountInfo.loginid);
        
        // Fechar a janela de autorização se ainda estiver aberta
        if (this.authorizationWindow && !this.authorizationWindow.closed) {
          this.authorizationWindow.close();
          this.authorizationWindow = null;
        }
      }
    } catch (error) {
      console.error('[DerivOAuth] Erro ao processar token de autorização:', error);
    }
  }

  // Selecionar uma conta específica e autenticar com ela
  public async selectAccount(loginid: string): Promise<boolean> {
    const account = this.accounts.find(acc => acc.loginid === loginid);
    
    if (!account || !account.token) {
      console.error('[DerivOAuth] Conta não encontrada ou sem token:', loginid);
      return false;
    }
    
    try {
      // Autorizar com o token da conta selecionada
      await this.authorize(account.token);
      
      // Atualizar conta selecionada
      this.selectedAccount = account;
      localStorage.setItem('deriv_selected_account', account.loginid);
      
      // Notificar listeners sobre mudança nas contas
      this.notifyAccountListeners();
      
      console.log('[DerivOAuth] Conta selecionada com sucesso:', loginid);
      return true;
    } catch (error) {
      console.error('[DerivOAuth] Erro ao selecionar conta:', error);
      
      // Se o token estiver expirado, remover a conta
      if (error && typeof error === 'object' && 'code' in error && error.code === 'InvalidToken') {
        this.removeAccount(loginid);
      }
      
      return false;
    }
  }

  // Remover uma conta da lista
  public removeAccount(loginid: string): void {
    this.accounts = this.accounts.filter(acc => acc.loginid !== loginid);
    
    // Se era a conta selecionada, desselecionar
    if (this.selectedAccount && this.selectedAccount.loginid === loginid) {
      this.selectedAccount = null;
      localStorage.removeItem('deriv_selected_account');
    }
    
    // Atualizar no localStorage
    localStorage.setItem('deriv_accounts', JSON.stringify(this.accounts));
    
    // Notificar listeners sobre mudança nas contas
    this.notifyAccountListeners();
    
    console.log('[DerivOAuth] Conta removida:', loginid);
  }

  // Limpar todas as contas
  public clearAllAccounts(): void {
    this.accounts = [];
    this.selectedAccount = null;
    
    // Limpar do localStorage
    localStorage.removeItem('deriv_accounts');
    localStorage.removeItem('deriv_selected_account');
    
    // Notificar listeners sobre mudança nas contas
    this.notifyAccountListeners();
    
    console.log('[DerivOAuth] Todas as contas removidas');
  }

  // Registrar para notificações de mudanças na lista de contas
  public onAccountsChange(callback: AccountCallback): () => void {
    this.accountListeners.push(callback);
    
    // Notificar imediatamente com o estado atual
    callback([...this.accounts]);
    
    // Retornar função para cancelar a inscrição
    return () => {
      this.accountListeners = this.accountListeners.filter(cb => cb !== callback);
    };
  }

  // Notificar todos os listeners sobre mudanças nas contas
  private notifyAccountListeners(): void {
    this.accountListeners.forEach(listener => {
      try {
        listener([...this.accounts]);
      } catch (error) {
        console.error('[DerivOAuth] Erro ao notificar listener de contas:', error);
      }
    });
  }

  // Getters para estado atual
  public getAccounts(): AccountInfo[] {
    return [...this.accounts];
  }

  public getSelectedAccount(): AccountInfo | null {
    return this.selectedAccount;
  }

  public hasAccounts(): boolean {
    return this.accounts.length > 0;
  }

  public isLoggedIn(): boolean {
    return !!this.selectedAccount;
  }

  // Método para comprar contratos com verificações adicionais
  public async buyContract(parameters: any): Promise<any> {
    // Verificar se há uma conta selecionada
    if (!this.selectedAccount) {
      throw new Error('Nenhuma conta Deriv selecionada. Faça login primeiro.');
    }
    
    // Verificar estado da conexão
    if (!this.isConnected()) {
      await this.connect();
    }
    
    // Verificar autenticação
    if (!this.isAuthenticated()) {
      await this.authorize(this.selectedAccount.token);
    }
    
    // Adicionar campos específicos para contratos digitais se necessário
    if (parameters.contract_type && parameters.contract_type.startsWith('DIGIT')) {
      if (parameters.contract_type === 'DIGITOVER' || parameters.contract_type === 'DIGITUNDER') {
        parameters.barrier = parameters.prediction;
      } else if (parameters.contract_type === 'DIGITODD' || parameters.contract_type === 'DIGITEVEN') {
        // Não é necessário barrier para estes tipos
      } else if (parameters.contract_type === 'DIGITDIFF' || parameters.contract_type === 'DIGITMATCH') {
        parameters.barrier = parameters.prediction;
      }
    }
    
    // Chamar método do serviço principal
    return this.derivService.buyContract(parameters);
  }

  // Limpar recursos ao destruir
  public destroy(): void {
    // Remover listener de mensagens
    if (typeof window !== 'undefined') {
      window.removeEventListener('message', this.handlePostMessage);
    }
    
    // Limpar timeouts
    Object.values(this.authorizeTimeouts).forEach(timeout => {
      clearTimeout(timeout);
    });
    
    // Fechar janela de autorização se estiver aberta
    if (this.authorizationWindow && !this.authorizationWindow.closed) {
      this.authorizationWindow.close();
      this.authorizationWindow = null;
    }
    
    // Desconectar WebSocket
    this.disconnect();
  }
}

// Criar e exportar instância única do serviço
export const oauthDirectService = OAuthDirectService.getInstance();

// Exportar a classe para permitir criação de instâncias adicionais se necessário
export default OAuthDirectService;