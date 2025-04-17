/**
 * DerivAPI - Classe singleton para comunicação com a API da Deriv
 * Implementação baseada na documentação oficial em developers.deriv.com
 * 
 * Esta classe gerencia a conexão WebSocket, autenticação e operações API
 * Fornece métodos para realizar operações de trading, consulta e gerenciamento
 * Optimizado para alto desempenho com suporte a operações em massa
 */

export class DerivAPI {
  // Singleton pattern para garantir uma única instância da API
  private static instance: DerivAPI;
  private socket: WebSocket | null = null;
  private requestId: number = 1;
  private pendingRequests: Map<number, { resolve: Function, reject: Function }> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: any = null;
  private reconnecting: boolean = false;
  private isTokenAuth: boolean = false;
  private token: string | null = null;
  private baseUrl: string = 'wss://ws.derivws.com/websockets/v3';
  private appId: number = 71403;  // Affiliate ID 713161
  
  // Armazenamento de informações de conta
  private accountInfo: any = {
    loginId: null,
    balance: {
      currency: null,
      balance: 0,
      loginId: null
    },
    loginTime: null,
    isVirtual: false,
    oauthDetails: null,
    landingCompanyName: null,
  };
  
  // Informações de estado da conexão
  private connectionInfo: any = {
    server: {
      version: null,
      ping: 0,
      isDeriv: false
    },
    lastPing: 0,
    pingInterval: null
  };
  
  // Configurações
  private config = {
    pingIntervalTime: 10000, // 10 segundos
    reconnectDelayTime: 3000, // 3 segundos
    tokenStorageKey: 'deriv_api_token',
    tokenLoginTimeKey: 'deriv_api_login_time',
    debugMode: false
  };
  
  // Construtor privado para evitar instanciação direta (Singleton)
  private constructor() {}
  
  // Método para obter instância
  public static getInstance(): DerivAPI {
    if (!DerivAPI.instance) {
      DerivAPI.instance = new DerivAPI();
    }
    return DerivAPI.instance;
  }
  
  /**
   * Define a URL base para a conexão WebSocket
   * @param url URL completa do websocket (ex: wss://ws.derivws.com/websockets/v3)
   */
  public setBaseUrl(url: string): void {
    if (!this.isConnected) {
      this.baseUrl = url;
    } else {
      console.warn("Não é possível alterar a URL base enquanto está conectado");
    }
  }
  
  /**
   * Define o App ID utilizado para a conexão com a API
   * @param id ID do aplicativo registrado na Deriv
   */
  public setAppId(id: number): void {
    if (!this.isConnected) {
      this.appId = id;
    } else {
      console.warn("Não é possível alterar o App ID enquanto está conectado");
    }
  }
  
  /**
   * Obtém o status da conexão atual
   * @returns true se estiver conectado, false caso contrário
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
  
  /**
   * Obtém o ID da conta atualmente logada
   * @returns ID da conta ou null se não autenticado
   */
  public getLoginId(): string | null {
    return this.accountInfo.loginId;
  }
  
  /**
   * Obtém informações sobre a conta atual
   * @returns Informações de conta ou objeto vazio se não autenticado
   */
  public getAccountInfo(): any {
    return { ...this.accountInfo };
  }
  
  /**
   * Ativa ou desativa o modo de depuração para logs detalhados
   * @param enabled true para ativar, false para desativar
   */
  public setDebugMode(enabled: boolean): void {
    this.config.debugMode = enabled;
  }

  /**
   * Cria uma nova conexão WebSocket com o servidor da Deriv
   * @param token Token de API opcional para autenticação imediata
   * @returns Promise que resolve quando a conexão é estabelecida
   */
  public async connect(token?: string): Promise<any> {
    // Evitar conexões duplicadas
    if (this.isConnected || this.reconnecting) {
      console.warn("[DerivAPI] Já existe uma conexão ativa ou uma tentativa de reconexão em andamento");
      return;
    }
    
    this.reconnecting = true;
    
    // Construir URL com app_id
    const connectionUrl = `${this.baseUrl}?app_id=${this.appId}`;
    
    try {
      // Fechar qualquer conexão existente
      if (this.socket) {
        this.socket.close();
        this.socket = null;
      }
      
      console.log(`Conectando via WebSocket no endereço: "${connectionUrl}"`);
      
      // Criar nova conexão WebSocket
      this.socket = new WebSocket(connectionUrl);
      
      // Configurar manipuladores de eventos
      this.socket.onopen = () => this.handleOpen(token);
      this.socket.onmessage = (event) => this.handleMessage(event);
      this.socket.onclose = (event) => this.handleClose(event);
      this.socket.onerror = (error) => this.handleError(error);
      
      // Esperar até que a conexão seja estabelecida ou falhe
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Tempo limite de conexão excedido'));
          this.reconnecting = false;
        }, 10000);
        
        // Sobrescrever temporariamente o handler onopen
        const originalOnOpen = this.socket!.onopen;
        this.socket!.onopen = (event) => {
          clearTimeout(timeout);
          this.reconnecting = false;
          if (originalOnOpen) originalOnOpen.call(this.socket, event);
          resolve({ connected: true });
        };
        
        // Sobrescrever temporariamente o handler onerror
        const originalOnError = this.socket!.onerror;
        this.socket!.onerror = (event) => {
          clearTimeout(timeout);
          this.reconnecting = false;
          if (originalOnError) originalOnError.call(this.socket, event);
          reject(new Error('Falha ao conectar ao servidor'));
        };
      });
    } catch (error) {
      this.reconnecting = false;
      console.error('[DerivAPI] Erro ao estabelecer conexão:', error);
      throw error;
    }
  }
  
  /**
   * Desconecta do servidor WebSocket
   */
  public disconnect(): void {
    // Limpar ping interval
    if (this.connectionInfo.pingInterval) {
      clearInterval(this.connectionInfo.pingInterval);
      this.connectionInfo.pingInterval = null;
    }
    
    // Limpar qualquer timeout de reconexão
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Reset das variáveis de estado
    this.reconnectAttempts = 0;
    this.reconnecting = false;
    
    // Fechar conexão
    if (this.socket && this.isConnected) {
      console.log('[DerivAPI] Desconectando do servidor...');
      this.socket.close();
      this.socket = null;
      
      // Reset dos estados
      this.isTokenAuth = false;
      document.dispatchEvent(new CustomEvent('deriv:disconnected'));
    }
  }
  
  /**
   * Autentica com a API usando um token
   * @param token Token de API obtido do site da Deriv
   * @returns Promise que resolve para o resultado da autorização
   */
  public async authorize(token: string): Promise<any> {
    if (!token) {
      throw new Error("Token é obrigatório para autorização");
    }
    
    if (!this.isConnected) {
      try {
        await this.connect();
      } catch (error) {
        throw new Error(`Falha ao conectar antes da autorização: ${error.message}`);
      }
    }
    
    // Armazenar o token para reconexões
    this.token = token;
    
    try {
      const response = await this.send({
        authorize: token
      });
      
      // Armazenar dados de autorização
      if (response && response.authorize) {
        this.accountInfo.loginId = response.authorize.loginid;
        this.accountInfo.balance = {
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          loginId: response.authorize.loginid
        };
        this.accountInfo.loginTime = new Date();
        this.accountInfo.isVirtual = /^VRTC/.test(response.authorize.loginid);
        this.accountInfo.landingCompanyName = response.authorize.landing_company_name;
        
        // Atualizar status de autenticação
        this.isTokenAuth = true;
        
        // Salvar token no armazenamento local se disponível
        this.saveTokenToStorage(token);
        
        // Notificar sistemas externos
        document.dispatchEvent(new CustomEvent('deriv:authorized', {
          detail: {
            user: response.authorize,
            isVirtual: this.accountInfo.isVirtual
          }
        }));
        
        // Verificar aplicações OAuth ativas
        this.listOAuthApps()
          .then(() => console.log("Informações de OAuth atualizadas"))
          .catch(err => console.warn("Não foi possível obter informações de OAuth:", err.message));
        
        return response;
      } else if (response && response.error) {
        this.token = null;
        this.isTokenAuth = false;
        throw new Error(response.error.message);
      }
      
      return response;
    } catch (error) {
      this.token = null;
      this.isTokenAuth = false;
      console.error('[DerivAPI] Erro de autorização:', error.message);
      throw error;
    }
  }
  
  /**
   * Verifica se o cliente está autorizado atualmente
   * @returns true se estiver autorizado, false caso contrário
   */
  public isAuthorized(): boolean {
    return this.isTokenAuth && this.accountInfo.loginId !== null;
  }
  
  /**
   * Tenta autorizar usando um token salvo no armazenamento local
   * @returns Promise que resolve para o resultado da autorização ou null se não houver token
   */
  public async authorizeFromStorage(): Promise<any> {
    const token = this.loadTokenFromStorage();
    if (token) {
      return this.authorize(token);
    }
    return null;
  }
  
  /**
   * Atualiza um contrato existente (stop loss / take profit)
   * Implementa o endpoint 'contract_update' de acordo com o schema documentado
   * 
   * @param contractId ID do contrato a ser atualizado
   * @param stopLoss Novo valor para stop loss (ou null para remover)
   * @param takeProfit Novo valor para take profit (ou null para remover)
   * @returns Promise com o resultado da atualização
   */
  public async updateContract(
    contractId: string | number, 
    stopLoss?: number | null, 
    takeProfit?: number | null
  ): Promise<any> {
    try {
      if (!this.isConnected || !this.isAuthorized()) {
        throw new Error("API não conectada ou não autorizada");
      }

      // Validar parâmetros
      if (!contractId) {
        throw new Error("ID do contrato é obrigatório para atualizar");
      }
      
      const numericContractId = typeof contractId === 'string' ? parseInt(contractId) : contractId;
      
      if (isNaN(numericContractId)) {
        throw new Error("ID do contrato deve ser um número válido");
      }
      
      console.log(`Atualizando contrato ID: ${numericContractId}`);
      
      // Construir objeto de ordem limite conforme requerido pela API
      const limitOrder: {stop_loss?: number | null, take_profit?: number | null} = {};
      
      if (stopLoss !== undefined) {
        // Para remover, deve ser definido como null
        limitOrder.stop_loss = stopLoss;
        console.log(`Configurando stop loss: ${stopLoss !== null ? stopLoss : 'remover'}`);
      }
      
      if (takeProfit !== undefined) {
        // Para remover, deve ser definido como null
        limitOrder.take_profit = takeProfit;
        console.log(`Configurando take profit: ${takeProfit !== null ? takeProfit : 'remover'}`);
      }
      
      // Construir requisição completa
      const request: any = {
        contract_update: 1,
        contract_id: numericContractId,
        limit_order: limitOrder
      };
      
      // Log detalhado da requisição
      console.log(`Enviando requisição de atualização: ${JSON.stringify(request)}`);
      
      // Enviar a solicitação com retry
      let retries = 0;
      const maxRetries = 2;
      let response;
      
      while (retries <= maxRetries) {
        try {
          response = await this.send(request);
          break;
        } catch (error) {
          retries++;
          if (retries > maxRetries) throw error;
          console.warn(`Tentativa ${retries}/${maxRetries} falhou, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Log detalhado da resposta
      console.log(`Resposta da atualização: ${JSON.stringify(response)}`);
      
      // Verificar e processar a resposta
      if (response && response.contract_update) {
        console.log(`Contrato atualizado com sucesso: ID #${response.contract_update.contract_id}`);
        
        // Disparar evento para notificar sistemas externos
        document.dispatchEvent(new CustomEvent('deriv:contract_updated', {
          detail: {
            contract: response.contract_update,
            timestamp: Date.now()
          }
        }));
        
        return response;
      } else if (response && response.error) {
        console.error("Erro ao atualizar contrato:", response.error);
        throw new Error(`Erro na atualização: ${response.error.message}`);
      } else {
        console.error("Resposta inesperada da API:", response);
        throw new Error("Formato de resposta inesperado da API");
      }
    } catch (error) {
      console.error("Erro ao atualizar contrato:", error);
      throw error;
    }
  }
  
  /**
   * Obtém o histórico de atualizações de um contrato específico
   * @param contractId ID do contrato
   */
  public async getContractUpdateHistory(contractId: string | number): Promise<any> {
    return this.send({
      contract_update_history: 1,
      contract_id: typeof contractId === 'string' ? parseInt(contractId) : contractId
    });
  }

  // Removido método legado de venda de contrato para evitar duplicações

  /**
   * Obtém o histórico de ticks para um símbolo e opcionalmente assina atualizações
   * Implementação baseada no schema oficial da API Deriv
   * 
   * @param symbol O símbolo para obter histórico (ex: R_100)
   * @param options Opções adicionais de configuração
   * @returns Promise que resolve para o histórico de ticks
   */
  public async getTicksHistory(
    symbol: string, 
    options: {
      count?: number;
      end?: string | number;
      granularity?: number;
      start?: string | number;
      style?: string;
      subscribe?: number;
      adjust_start_time?: number;
    } = {}
  ): Promise<any> {
    if (!symbol) {
      throw new Error("Símbolo é obrigatório para obter histórico de ticks");
    }
    
    // Construir a requisição
    const request: any = {
      ticks_history: symbol,
      ...options
    };
    
    return this.send(request);
  }
  
  /**
   * Envia uma requisição para a API e retorna uma Promise com o resultado
   * @param request Objeto de requisição no formato da API
   * @returns Promise que resolve para a resposta da API
   */
  public async send(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      // Verificar se está conectado
      if (!this.isConnected) {
        return reject(new Error("WebSocket não está conectado"));
      }
      
      // Atribuir ID à requisição
      const currentId = this.requestId++;
      request.req_id = currentId;
      
      // Registrar a requisição pendente
      this.pendingRequests.set(currentId, { resolve, reject });
      
      try {
        // Enviar a requisição
        this.socket!.send(JSON.stringify(request));
      } catch (error) {
        // Limpar a requisição pendente
        this.pendingRequests.delete(currentId);
        reject(error);
      }
    });
  }
  
  /**
   * Inscreve-se em um stream de ticks para um símbolo
   * @param symbol O símbolo para obter atualizações (ex: R_100)
   * @param callback Função a ser chamada para cada tick recebido
   * @returns Promise que resolve para a resposta inicial
   */
  public async subscribeTicks(symbol: string, callback: (tick: any) => void): Promise<any> {
    // Verificar se está conectado
    if (!this.isConnected) {
      throw new Error("WebSocket não está conectado");
    }
    
    // Registrar um event listener para o símbolo
    document.addEventListener(`deriv:tick:${symbol}`, ((event: CustomEvent) => {
      if (callback && typeof callback === 'function') {
        callback(event.detail);
      }
    }) as EventListener);
    
    // Fazer a requisição de inscrição
    return this.send({
      ticks: symbol,
      subscribe: 1
    });
  }
  
  /**
   * Cancela a inscrição de um stream de ticks
   * @param symbol O símbolo para cancelar a inscrição
   * @returns Promise que resolve para a resposta de cancelamento
   */
  public async unsubscribeTicks(symbol: string): Promise<any> {
    return this.send({
      forget_all: ["ticks"]
    });
  }
  
  /**
   * Obtém a proposta para um contrato, necessário antes de comprar
   * Implementa o endpoint 'proposal' com todos os parâmetros possíveis
   * Nota: Alguns parâmetros são obrigatórios dependendo do tipo de contrato
   * 
   * @param params Parâmetros completos da proposta
   * @returns Promise que resolve para a resposta da proposta
   */
  public async getProposal(params: {
    contract_type: string;
    currency: string;
    symbol: string;
    amount?: number;
    barrier?: string | number;
    barrier2?: string | number;
    basis?: 'payout' | 'stake';
    date_expiry?: number;
    date_start?: number;
    duration?: number;
    duration_unit?: 'd' | 'm' | 's' | 'h' | 't';
    limit_order?: {
      stop_loss?: number;
      take_profit?: number;
    };
    multiplier?: number;
    cancellation?: string;
    product_type?: 'basic' | 'multi_barrier' | 'lookback';
    trading_period_start?: number;
    selected_tick?: number;
    subscribe?: number;
  }): Promise<any> {
    // Verificar parâmetros obrigatórios
    if (!params.contract_type) {
      throw new Error("Tipo de contrato é obrigatório");
    }
    
    if (!params.currency) {
      throw new Error("Moeda é obrigatória");
    }
    
    if (!params.symbol) {
      throw new Error("Símbolo é obrigatório");
    }
    
    // Enviar a requisição de proposta
    return this.send({
      proposal: 1,
      ...params
    });
  }
  
  /**
   * Compra um contrato baseado em uma proposta
   * Implementa o endpoint 'buy' de acordo com o schema documentado
   * 
   * @param proposalId ID da proposta retornado pelo método getProposal
   * @param price Preço máximo de compra
   * @param options Opções adicionais como loginid e passthrough
   * @returns Promise com o resultado da compra
   */
  public async buyContract(
    proposalId: string,
    price: number,
    options?: {
      loginid?: string;
      passthrough?: any;
      subscribe?: boolean;
    }
  ): Promise<any> {
    try {
      if (!this.isConnected || !this.isAuthorized()) {
        throw new Error("API não conectada ou não autorizada");
      }

      console.log(`Comprando contrato com proposta ID: ${proposalId}, preço: ${price}`);
      
      // Validar parâmetros obrigatórios
      if (!proposalId) {
        throw new Error("ID da proposta é obrigatório para comprar um contrato");
      }
      
      if (!price || isNaN(Number(price))) {
        throw new Error("Preço válido é obrigatório para comprar um contrato");
      }
      
      // Construir a solicitação conforme o schema da API
      const request: any = {
        buy: proposalId,
        price: price.toString() // Garantir que o preço seja uma string conforme documentação
      };
      
      // Opções adicionais
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
        if (options.subscribe === true) request.subscribe = 1; // O valor deve ser 1 se present
      }
      
      // Log detalhado da requisição
      console.log(`Enviando requisição de compra: ${JSON.stringify(request)}`);
      
      // Enviar a solicitação de compra com retry
      let retries = 0;
      const maxRetries = 2; // Máximo de 2 retentativas
      let response;
      
      while (retries <= maxRetries) {
        try {
          response = await this.send(request);
          break; // Se chegou aqui, a requisição foi bem sucedida
        } catch (error) {
          retries++;
          if (retries > maxRetries) throw error;
          console.warn(`Tentativa ${retries}/${maxRetries} falhou, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo antes de tentar novamente
        }
      }
      
      // Log detalhado da resposta
      console.log(`Resposta da compra: ${JSON.stringify(response)}`);
      
      // Verificar e processar a resposta
      if (response && response.buy) {
        console.log(`Contrato comprado com sucesso: ID #${response.buy.contract_id}`);
        console.log(`Valor: ${response.buy.buy_price}, Pagamento: ${response.buy.payout}`);

        // Disparar evento para notificar sistemas externos
        document.dispatchEvent(new CustomEvent('deriv:contract_bought', {
          detail: {
            contract: response.buy,
            timestamp: Date.now()
          }
        }));
        
        // Monitorar automaticamente o contrato comprado se subscribe=1 não foi usado
        if (!options?.subscribe && response.buy.contract_id) {
          try {
            this.getOpenContractsList(Number(response.buy.contract_id))
              .then(() => console.log(`Monitoramento automático iniciado para contrato #${response.buy.contract_id}`))
              .catch((err: any) => console.warn(`Não foi possível iniciar monitoramento automático: ${err?.message || 'Erro desconhecido'}`));
          } catch (err: any) {
            console.warn(`Erro ao configurar monitoramento de contrato: ${err?.message || 'Erro desconhecido'}`);
          }
        }
        
        return response;
      } else if (response && response.error) {
        console.error("Erro ao comprar contrato:", response.error);
        throw new Error(`Erro na compra: ${response.error.message}`);
      } else {
        console.error("Resposta inesperada da API:", response);
        throw new Error("Formato de resposta inesperado da API");
      }
    } catch (error) {
      console.error("Erro ao executar compra de contrato:", error);
      throw error;
    }
  }
  
  /**
   * Vende um contrato específico
   * Implementa o endpoint 'sell' de acordo com o schema documentado
   * 
   * @param contractId ID do contrato a ser vendido
   * @param price Preço mínimo de venda (0 para vender a mercado)
   * @param options Opções adicionais como loginid e passthrough
   * @returns Promise com o resultado da venda
   */
  public async sellContract(
    contractId: number,
    price: number = 0,
    options?: {
      loginid?: string;
      passthrough?: any;
    }
  ): Promise<any> {
    try {
      if (!this.isConnected || !this.isAuthorized()) {
        throw new Error("API não conectada ou não autorizada");
      }

      // Validar parâmetros
      if (!contractId || isNaN(Number(contractId))) {
        throw new Error("ID do contrato válido é obrigatório para vender");
      }
      
      console.log(`Vendendo contrato ID: ${contractId}, preço: ${price}`);
      
      // Construir a solicitação conforme o schema da API
      const request: any = {
        sell: contractId
      };
      
      // Adicionar preço apenas se for maior que zero
      if (price && price > 0) {
        request.price = price.toString();
      }
      
      // Opções adicionais
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
      }
      
      // Log detalhado da requisição
      console.log(`Enviando requisição de venda: ${JSON.stringify(request)}`);
      
      // Enviar a solicitação de venda com retry
      let retries = 0;
      const maxRetries = 2; 
      let response;
      
      while (retries <= maxRetries) {
        try {
          response = await this.send(request);
          break;
        } catch (error) {
          retries++;
          if (retries > maxRetries) throw error;
          console.warn(`Tentativa ${retries}/${maxRetries} falhou, tentando novamente...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Log detalhado da resposta
      console.log(`Resposta da venda: ${JSON.stringify(response)}`);
      
      // Verificar e processar a resposta
      if (response && response.sell) {
        console.log(`Contrato vendido com sucesso: ID #${response.sell.contract_id}`);
        console.log(`Valor: ${response.sell.sold_for}`);

        // Disparar evento para notificar sistemas externos
        document.dispatchEvent(new CustomEvent('deriv:contract_sold', {
          detail: {
            contract: response.sell,
            timestamp: Date.now()
          }
        }));
        
        return response;
      } else if (response && response.error) {
        console.error("Erro ao vender contrato:", response.error);
        throw new Error(`Erro na venda: ${response.error.message}`);
      } else {
        console.error("Resposta inesperada da API:", response);
        throw new Error("Formato de resposta inesperado da API");
      }
    } catch (error) {
      console.error("Erro ao executar venda de contrato:", error);
      throw error;
    }
  }
  
  /**
   * Obtém o objeto WebSocket atual para monitoramento/operações avançadas
   * @returns WebSocket ativo da conexão ou null se desconectado
   */
  public getWebSocket(): WebSocket | null {
    return this.socket;
  }
  
  /**
   * Lista todas as aplicações OAuth de terceiros utilizadas pelo usuário
   * Retorna um array de objetos com detalhes das aplicações:
   * - app_id: ID da aplicação
   * - name: Nome da aplicação
   * - app_markup_percentage: Porcentagem de markup
   * - last_used: Data da última utilização
   * - official: Se é uma aplicação oficial (1) ou não (0)
   * - scopes: Array de escopos permitidos
   * 
   * @param loginId ID de login opcional para contas múltiplas
   * @returns Promise com resposta contendo array oauth_apps com aplicações
   */
  public async listOAuthApps(loginId?: string): Promise<any> {
    try {
      const request: any = {
        oauth_apps: 1
      };
      
      if (loginId) {
        request.loginid = loginId;
      }
      
      const response = await this.send(request);
      
      if (response && response.oauth_apps) {
        // Filtrar os apps para destacar o nosso (713161)
        const ourAppId = 713161;
        const ourApp = response.oauth_apps.find((app: any) => app.app_id === ourAppId);
        
        console.log("Aplicativo OAuth do Genius Tech encontrado:", ourApp);
        
        // Atualizar informações de conexão se o nosso app estiver presente
        if (ourApp) {
          // Podemos usar essas informações para mostrar quando foi a última vez que o usuário
          // usou nosso aplicativo, os escopos permitidos, etc.
          this.accountInfo.oauthDetails = {
            appId: ourApp.app_id,
            appName: ourApp.name,
            lastUsed: ourApp.last_used,
            scopes: ourApp.scopes
          };
          
          // Disparar evento personalizado
          document.dispatchEvent(new CustomEvent('deriv:oauth_app_info', {
            detail: {
              app: ourApp
            }
          }));
        }
        
        return response.oauth_apps;
      }
      
      return [];
    } catch (error) {
      console.error("Erro ao listar aplicativos OAuth:", error);
      return [];
    }
  }
  
  /**
   * Vende todos os contratos expirados
   * Implementa o endpoint 'sell_expired' de acordo com o schema documentado
   * 
   * @param options Opções adicionais como loginid e passthrough
   * @returns Promise com o resultado da operação
   */
  public async sellExpiredContracts(
    options?: {
      loginid?: string;
      passthrough?: any;
    }
  ): Promise<any> {
    try {
      if (!this.isConnected || !this.isAuthorized()) {
        throw new Error("API não conectada ou não autorizada");
      }

      console.log("Vendendo contratos expirados...");
      
      // Construir a solicitação conforme o schema da API
      const request: any = {
        sell_expired: 1
      };
      
      // Opções adicionais
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
      }
      
      // Enviar a solicitação
      const response = await this.send(request);
      
      // Verificar e processar a resposta
      if (response && response.sell_expired) {
        const count = response.sell_expired.count;
        console.log(`${count} contratos expirados vendidos com sucesso`);
        
        // Disparar evento para notificar sistemas externos
        document.dispatchEvent(new CustomEvent('deriv:contracts_expired_sold', {
          detail: {
            count: count,
            timestamp: Date.now()
          }
        }));
        
        return response;
      } else if (response && response.error) {
        console.error("Erro ao vender contratos expirados:", response.error);
        throw new Error(`Erro na venda de expirados: ${response.error.message}`);
      } else {
        console.error("Resposta inesperada da API:", response);
        throw new Error("Formato de resposta inesperado da API");
      }
    } catch (error) {
      console.error("Erro ao vender contratos expirados:", error);
      throw error;
    }
  }
  
  /**
   * Cancela um contrato específico
   * Implementa o endpoint 'cancel' de acordo com o schema documentado
   * 
   * @param contractId ID do contrato a ser cancelado
   * @param options Opções adicionais como loginid e passthrough
   * @returns Promise com o resultado do cancelamento
   */
  public async cancelContract(
    contractId: number,
    options?: {
      loginid?: string;
      passthrough?: any;
    }
  ): Promise<any> {
    try {
      if (!this.isConnected || !this.isAuthorized()) {
        throw new Error("API não conectada ou não autorizada");
      }

      console.log(`Cancelando contrato ID: ${contractId}`);
      
      // Construir a solicitação conforme o schema da API
      const request: any = {
        cancel: contractId
      };
      
      // Opções adicionais
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
      }
      
      // Enviar a solicitação de cancelamento
      const response = await this.send(request);
      
      // Verificar e processar a resposta
      if (response && response.cancel) {
        console.log(`Contrato cancelado com sucesso: ID #${response.cancel.contract_id}`);
        if (response.cancel.sold_for) {
          console.log(`Valor recuperado: ${response.cancel.sold_for}`);
        }

        // Disparar evento para notificar sistemas externos
        document.dispatchEvent(new CustomEvent('deriv:contract_cancelled', {
          detail: {
            contract: response.cancel,
            timestamp: Date.now()
          }
        }));
        
        return response;
      } else if (response && response.error) {
        console.error("Erro ao cancelar contrato:", response.error);
        throw new Error(`Erro no cancelamento: ${response.error.message}`);
      } else {
        console.error("Resposta inesperada da API:", response);
        throw new Error("Formato de resposta inesperado da API");
      }
    } catch (error) {
      console.error("Erro ao cancelar contrato:", error);
      throw error;
    }
  }
  
  /**
   * Atualiza uma aplicação OAuth existente
   * 
   * A resposta contém um objeto app_update com os detalhes da aplicação atualizada:
   * - app_id: ID da aplicação 
   * - name: Nome da aplicação
   * - scopes: Array de escopos permitidos
   * - redirect_uri: URL de redirecionamento após login
   * - active: Status de ativação (1 = ativo)
   * - app_markup_percentage: Markup para preços de contratos
   * - appstore, github, googleplay, homepage, verification_uri: URLs opcionais
   * 
   * @param appId ID da aplicação a ser atualizada
   * @param params Parâmetros de atualização da aplicação
   * @param params.name Nome da aplicação (obrigatório)
   * @param params.scopes Array de escopos permitidos (obrigatório)
   * @param params.redirect_uri URL de redirecionamento após login bem-sucedido (opcional)
   * @param params.app_markup_percentage Markup para preços de contratos (máx 3%, opcional)
   * @param params.appstore URL da App Store (opcional)
   * @param params.github URL do GitHub (opcional)
   * @param params.googleplay URL do Google Play (opcional)
   * @param params.homepage URL da página inicial (opcional)
   * @param params.verification_uri URL para verificação de email (opcional)
   * @param loginId ID de login opcional para contas múltiplas
   * @returns Promise com resultado da atualização
   */
  public async updateApplication(
    appId: number, 
    params: {
      name: string,
      scopes: Array<"read" | "trade" | "trading_information" | "payments" | "admin">,
      redirect_uri?: string,
      app_markup_percentage?: number,
      appstore?: string,
      github?: string,
      googleplay?: string,
      homepage?: string,
      verification_uri?: string
    },
    loginId?: string
  ): Promise<any> {
    const request: any = {
      app_update: appId,
      ...params
    };
    
    if (loginId) {
      request.loginid = loginId;
    }
    
    return this.send(request);
  }
}

export const derivAPI = DerivAPI.getInstance();
export default derivAPI;
