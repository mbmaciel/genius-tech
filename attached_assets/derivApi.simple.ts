/**
 * DerivAPI - Interface para comunicação com a API WebSocket da Deriv
 * Implementação baseada na documentação oficial em developers.deriv.com
 */

export class DerivAPI {
  // Singleton pattern
  private static instance: DerivAPI;
  
  // Propriedades privadas
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
  
  // Armazenamento de informações da conta
  private accountInfo: any = {
    loginId: null,
    balance: {
      currency: null,
      balance: 0,
      loginId: null
    },
    loginTime: null,
    isVirtual: false,
    landingCompanyName: null,
    oauthDetails: null
  };
  
  // Informações de conexão
  private connectionInfo: any = {
    server: { version: null, ping: 0 },
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
  
  // Construtor privado (Singleton)
  private constructor() {}
  
  // Getter para status de conexão
  public get isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  // Método para obter instância (Singleton)
  public static getInstance(): DerivAPI {
    if (!DerivAPI.instance) {
      DerivAPI.instance = new DerivAPI();
    }
    return DerivAPI.instance;
  }
  
  /**
   * Define o App ID para a conexão com a API
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
   * Salva o token no armazenamento local
   * @param token Token a ser salvo
   */
  private saveTokenToStorage(token: string): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.config.tokenStorageKey, token);
        localStorage.setItem(this.config.tokenLoginTimeKey, new Date().toISOString());
        console.log('Token salvo para uso persistente:', token.substring(0, 5) + '****');
      }
    } catch (error) {
      console.warn('Não foi possível salvar o token no armazenamento local');
    }
  }
  
  /**
   * Carrega o token do armazenamento local
   * @returns Token salvo ou null se não existir
   */
  private loadTokenFromStorage(): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        const token = localStorage.getItem(this.config.tokenStorageKey);
        const loginTime = localStorage.getItem(this.config.tokenLoginTimeKey);
        
        if (token) {
          console.log('Token salvo para uso persistente:', token.substring(0, 5) + '****');
          if (loginTime) {
            console.log('Login registrado em:', loginTime);
          }
          return token;
        }
      }
    } catch (error) {
      console.warn('Não foi possível carregar o token do armazenamento local');
    }
    return null;
  }
  
  /**
   * Obtém o token atual
   * @returns Token atual ou null se não autenticado
   */
  public getToken(): string | null {
    return this.token;
  }
  
  /**
   * Envia ping para manter a conexão ativa
   */
  private sendPing(): void {
    if (!this.isConnected) {
      console.warn("[WebSocket] Ping não enviado: WebSocket não está conectado");
      return;
    }
    
    try {
      this.socket!.send(JSON.stringify({ ping: 1 }));
    } catch (error) {
      console.error("[WebSocket] Erro ao enviar ping:", error);
    }
    
    // Verificar timeout (se não houve resposta em 30s, reconectar)
    const pingTimeout = 30 * 1000; // 30 segundos
    const now = Date.now();
    
    if (this.connectionInfo.lastPing > 0 && now - this.connectionInfo.lastPing > pingTimeout) {
      console.warn(`[WebSocket] Sem resposta de ping por ${((now - this.connectionInfo.lastPing) / 1000).toFixed(3)}s. Forçando reconexão...`);
      this.disconnect();
      this.attemptReconnect();
    }
  }
  
  /**
   * Tenta reconectar após perda de conexão
   */
  private attemptReconnect(): void {
    if (this.reconnecting) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn("[WebSocket] Máximo de " + this.maxReconnectAttempts + " tentativas de reconexão atingido. Resetando estado...");
      this.socket = null;
      this.reconnectAttempts = 0;
      this.reconnecting = false;
      document.dispatchEvent(new CustomEvent('deriv:reconnect_failed'));
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 10000);
    
    console.log(`[WebSocket] Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts}. Reconectando em ${delay}ms...`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.isTokenAuth && this.token) {
        console.log("[WebSocket] Tentando reconectar com token salvo...");
        this.connect(this.token).catch(err => 
          console.error('[WebSocket] Falha na reconexão com token:', err.message)
        );
      } else {
        this.connect().catch(err => 
          console.error('[WebSocket] Falha na reconexão:', err.message)
        );
      }
    }, delay);
  }
  
  /**
   * Estabelece conexão com o servidor WebSocket da Deriv
   * @param token Token opcional para autorização automática
   * @returns Promise que resolve quando a conexão for estabelecida
   */
  public async connect(token?: string): Promise<any> {
    if (this.isConnected || this.reconnecting) {
      console.warn("[DerivAPI] Já existe uma conexão ativa ou uma tentativa de reconexão em andamento");
      return Promise.resolve({ alreadyConnected: true });
    }
    
    this.reconnecting = true;
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
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.reconnecting = false;
          reject(new Error('Tempo limite de conexão excedido'));
        }, 10000);
        
        this.socket!.onopen = () => {
          clearTimeout(timeout);
          this.reconnecting = false;
          console.log('[WebSocket] Conexão estabelecida');
          
          // Configurar ping periódico
          if (this.connectionInfo.pingInterval) {
            clearInterval(this.connectionInfo.pingInterval);
          }
          
          this.connectionInfo.pingInterval = setInterval(() => this.sendPing(), this.config.pingIntervalTime);
          
          // Evento de conexão estabelecida
          document.dispatchEvent(new CustomEvent('deriv:connected'));
          
          // Autorizar automaticamente se token for fornecido
          if (token) {
            this.authorize(token)
              .then(() => console.log('Autorização automática bem-sucedida'))
              .catch(err => console.error('Falha na autorização automática:', err.message));
          }
          
          resolve({ connected: true });
        };
        
        this.socket!.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Atualizar timestamp de ping
            this.connectionInfo.lastPing = Date.now();
            
            // Log detalhado se modo debug estiver ativo
            if (this.config.debugMode) {
              console.log('[WebSocket] Mensagem recebida:', data);
            }
            
            // Processar resposta para requisição pendente
            if (data.req_id && this.pendingRequests.has(data.req_id)) {
              const { resolve, reject } = this.pendingRequests.get(data.req_id)!;
              this.pendingRequests.delete(data.req_id);
              
              if (data.error) {
                reject(new Error(data.error.message || 'Erro na requisição'));
              } else {
                resolve(data);
              }
            }
            
            // Processar ticks
            if (data.tick) {
              document.dispatchEvent(new CustomEvent(`deriv:tick:${data.tick.symbol}`, {
                detail: data.tick
              }));
            }
            
            // Processar mudanças de saldo
            if (data.balance) {
              this.accountInfo.balance = {
                currency: data.balance.currency,
                balance: data.balance.balance,
                loginId: data.balance.loginid
              };
              
              document.dispatchEvent(new CustomEvent('deriv:balance_changed', {
                detail: data.balance
              }));
            }
            
            // Processar contratos abertos
            if (data.proposal_open_contract) {
              document.dispatchEvent(new CustomEvent('deriv:contract_update', {
                detail: data.proposal_open_contract
              }));
            }
            
            // Responder ping/pong
            if (data.ping) {
              this.socket?.send(JSON.stringify({ pong: 1 }));
            }
          } catch (error: any) {
            console.error('[WebSocket] Erro ao processar mensagem:', error?.message || error);
          }
        };
        
        this.socket!.onclose = (event) => {
          // Limpar ping interval
          if (this.connectionInfo.pingInterval) {
            clearInterval(this.connectionInfo.pingInterval);
            this.connectionInfo.pingInterval = null;
          }
          
          if (event.wasClean) {
            console.log(`[WebSocket] Conexão fechada normalmente: código=${event.code}, motivo=${event.reason || 'Não especificado'}`);
          } else {
            console.log(`[WebSocket] Conexão interrompida, código=${event.code}`);
            this.attemptReconnect();
          }
          
          document.dispatchEvent(new CustomEvent('deriv:disconnected'));
        };
        
        this.socket!.onerror = (error) => {
          clearTimeout(timeout);
          this.reconnecting = false;
          console.error('[WebSocket] Erro:', error);
          document.dispatchEvent(new CustomEvent('deriv:connection_error'));
          reject(new Error('Falha ao conectar ao servidor'));
        };
      });
    } catch (error: any) {
      this.reconnecting = false;
      console.error('[DerivAPI] Erro ao estabelecer conexão:', error?.message || error);
      throw error;
    }
  }
  
  /**
   * Desconecta do servidor WebSocket
   */
  public disconnect(): void {
    if (this.connectionInfo.pingInterval) {
      clearInterval(this.connectionInfo.pingInterval);
      this.connectionInfo.pingInterval = null;
    }
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    this.reconnectAttempts = 0;
    this.reconnecting = false;
    
    if (this.socket && this.isConnected) {
      console.log('[DerivAPI] Desconectando do servidor...');
      this.socket.close();
      this.socket = null;
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
      } catch (error: any) {
        throw new Error(`Falha ao conectar antes da autorização: ${error.message}`);
      }
    }
    
    this.token = token;
    
    try {
      const response = await this.send({
        authorize: token
      });
      
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
        
        this.isTokenAuth = true;
        this.saveTokenToStorage(token);
        
        document.dispatchEvent(new CustomEvent('deriv:authorized', {
          detail: {
            user: response.authorize,
            isVirtual: this.accountInfo.isVirtual
          }
        }));
        
        return response;
      } else if (response && response.error) {
        this.token = null;
        this.isTokenAuth = false;
        throw new Error(response.error.message);
      }
      
      return response;
    } catch (error: any) {
      this.token = null;
      this.isTokenAuth = false;
      console.error('[DerivAPI] Erro de autorização:', error.message);
      throw error;
    }
  }
  
  /**
   * Tenta autorizar usando token salvo no armazenamento local
   * @returns Promise com resultado da autorização ou null se não houver token
   */
  public async authorizeFromStorage(): Promise<any> {
    const token = this.loadTokenFromStorage();
    if (token) {
      return this.authorize(token);
    }
    return null;
  }
  
  /**
   * Verifica se está autorizado
   * @returns true se autorizado, false caso contrário
   */
  public isAuthorized(): boolean {
    return this.isTokenAuth && this.accountInfo.loginId !== null;
  }
  
  /**
   * Envia uma requisição para a API
   * @param request Objeto de requisição no formato da API
   * @returns Promise que resolve para a resposta da API
   */
  public async send(request: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        return reject(new Error("WebSocket não está conectado"));
      }
      
      const currentId = this.requestId++;
      request.req_id = currentId;
      
      this.pendingRequests.set(currentId, { resolve, reject });
      
      try {
        this.socket!.send(JSON.stringify(request));
      } catch (error) {
        this.pendingRequests.delete(currentId);
        reject(error);
      }
    });
  }
  
  /**
   * Inscreve-se em um stream de ticks para um símbolo
   * @param symbol Símbolo para receber atualizações (ex: R_100)
   * @param callback Função a chamar para cada tick
   * @returns Promise com resposta inicial
   */
  public async subscribeTicks(symbol: string, callback: (tick: any) => void): Promise<any> {
    if (!this.isConnected) {
      throw new Error("WebSocket não está conectado");
    }
    
    document.addEventListener(`deriv:tick:${symbol}`, ((event: CustomEvent) => {
      if (callback && typeof callback === 'function') {
        callback(event.detail);
      }
    }) as EventListener);
    
    return this.send({
      ticks: symbol,
      subscribe: 1
    });
  }
  
  /**
   * Cancela inscrição de ticks
   * @returns Promise com resposta
   */
  public async unsubscribeTicks(): Promise<any> {
    return this.send({
      forget_all: ["ticks"]
    });
  }
  
  /**
   * Obtém histórico de ticks para um símbolo
   * @param symbol Símbolo (ex: R_100)
   * @param options Opções adicionais
   * @returns Promise com histórico de ticks
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
    
    return this.send({
      ticks_history: symbol,
      ...options
    });
  }
  
  /**
   * Obtém proposta para um contrato
   * @param params Parâmetros da proposta
   * @returns Promise com resposta da proposta
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
    if (!params.contract_type) throw new Error("Tipo de contrato é obrigatório");
    if (!params.currency) throw new Error("Moeda é obrigatória");
    if (!params.symbol) throw new Error("Símbolo é obrigatório");
    
    return this.send({
      proposal: 1,
      ...params
    });
  }
  
  /**
   * Compra um contrato baseado em proposta
   * @param proposalId ID da proposta
   * @param price Preço máximo de compra
   * @param options Opções adicionais
   * @returns Promise com resultado da compra
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
      
      if (!proposalId) throw new Error("ID da proposta é obrigatório");
      if (!price || isNaN(Number(price))) throw new Error("Preço válido é obrigatório");
      
      const request: any = {
        buy: proposalId,
        price: price.toString()
      };
      
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
        if (options.subscribe === true) request.subscribe = 1;
      }
      
      console.log(`Enviando requisição de compra: ${JSON.stringify(request)}`);
      
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
      
      console.log(`Resposta da compra: ${JSON.stringify(response)}`);
      
      if (response && response.buy) {
        console.log(`Contrato comprado com sucesso: ID #${response.buy.contract_id}`);
        console.log(`Valor: ${response.buy.buy_price}, Pagamento: ${response.buy.payout}`);

        document.dispatchEvent(new CustomEvent('deriv:contract_bought', {
          detail: {
            contract: response.buy,
            timestamp: Date.now()
          }
        }));
        
        // Monitorar contrato
        if (!options?.subscribe && response.buy.contract_id) {
          try {
            this.getOpenContract(Number(response.buy.contract_id))
              .then(() => console.log(`Monitoramento iniciado para contrato #${response.buy.contract_id}`))
              .catch((err: any) => console.warn(`Erro no monitoramento: ${err?.message || 'Erro desconhecido'}`));
          } catch (err: any) {
            console.warn(`Erro ao configurar monitoramento: ${err?.message || 'Erro desconhecido'}`);
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
    } catch (error: any) {
      console.error("Erro ao executar compra de contrato:", error.message || error);
      throw error;
    }
  }
  
  /**
   * Vende um contrato específico
   * @param contractId ID do contrato a vender
   * @param price Preço mínimo (0 para mercado)
   * @param options Opções adicionais
   * @returns Promise com resultado da venda
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

      if (!contractId || isNaN(Number(contractId))) {
        throw new Error("ID do contrato válido é obrigatório para vender");
      }
      
      console.log(`Vendendo contrato ID: ${contractId}, preço: ${price}`);
      
      const request: any = {
        sell: contractId
      };
      
      if (price && price > 0) {
        request.price = price.toString();
      }
      
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
      }
      
      console.log(`Enviando requisição de venda: ${JSON.stringify(request)}`);
      
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
      
      console.log(`Resposta da venda: ${JSON.stringify(response)}`);
      
      if (response && response.sell) {
        console.log(`Contrato vendido com sucesso: ID #${response.sell.contract_id}`);
        console.log(`Valor: ${response.sell.sold_for}`);

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
        throw new Error("Formato de resposta inesperado");
      }
    } catch (error: any) {
      console.error("Erro ao executar venda de contrato:", error.message || error);
      throw error;
    }
  }

  /**
   * Atualiza um contrato (stop loss / take profit)
   * @param contractId ID do contrato a atualizar
   * @param stopLoss Novo valor de stop loss (ou null para remover)
   * @param takeProfit Novo valor de take profit (ou null para remover)
   * @returns Promise com resultado da atualização
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

      if (!contractId) throw new Error("ID do contrato é obrigatório");
      
      const numericContractId = typeof contractId === 'string' ? parseInt(contractId) : contractId;
      
      if (isNaN(numericContractId)) throw new Error("ID do contrato deve ser um número válido");
      
      console.log(`Atualizando contrato ID: ${numericContractId}`);
      
      const limitOrder: {stop_loss?: number | null, take_profit?: number | null} = {};
      
      if (stopLoss !== undefined) {
        limitOrder.stop_loss = stopLoss;
        console.log(`Configurando stop loss: ${stopLoss !== null ? stopLoss : 'remover'}`);
      }
      
      if (takeProfit !== undefined) {
        limitOrder.take_profit = takeProfit;
        console.log(`Configurando take profit: ${takeProfit !== null ? takeProfit : 'remover'}`);
      }
      
      const request: any = {
        contract_update: 1,
        contract_id: numericContractId,
        limit_order: limitOrder
      };
      
      console.log(`Enviando requisição de atualização: ${JSON.stringify(request)}`);
      
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
      
      console.log(`Resposta da atualização: ${JSON.stringify(response)}`);
      
      if (response && response.contract_update) {
        console.log(`Contrato atualizado com sucesso: ID #${response.contract_update.contract_id}`);
        
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
    } catch (error: any) {
      console.error("Erro ao atualizar contrato:", error.message || error);
      throw error;
    }
  }
  
  /**
   * Obtém detalhes de um contrato aberto
   * @param contractId ID do contrato
   * @param subscribe true para iniciar inscrição de atualizações
   * @returns Promise com detalhes do contrato
   */
  public async getOpenContract(contractId: number, subscribe: boolean = true): Promise<any> {
    const request: any = {
      proposal_open_contract: 1,
      contract_id: contractId
    };
    
    if (subscribe) {
      request.subscribe = 1;
    }
    
    return this.send(request);
  }
  
  /**
   * Obtém lista de contratos abertos do usuário
   * @param subscribe true para receber atualizações
   * @returns Promise com lista de contratos abertos
   */
  public async getOpenContractsList(subscribe: boolean = true): Promise<any> {
    const request: any = {
      proposal_open_contract: 1
    };
    
    if (subscribe) {
      request.subscribe = 1;
    }
    
    return this.send(request);
  }
  
  /**
   * Cancela um contrato específico
   * @param contractId ID do contrato a cancelar
   * @param options Opções adicionais
   * @returns Promise com resultado do cancelamento
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
      
      const request: any = {
        cancel: contractId
      };
      
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
      }
      
      const response = await this.send(request);
      
      if (response && response.cancel) {
        console.log(`Contrato cancelado com sucesso: ID #${response.cancel.contract_id}`);
        if (response.cancel.sold_for) {
          console.log(`Valor recuperado: ${response.cancel.sold_for}`);
        }

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
    } catch (error: any) {
      console.error("Erro ao cancelar contrato:", error.message || error);
      throw error;
    }
  }
  
  /**
   * Vende todos os contratos expirados
   * @param options Opções adicionais
   * @returns Promise com resultado da operação
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
      
      const request: any = {
        sell_expired: 1
      };
      
      if (options) {
        if (options.loginid) request.loginid = options.loginid;
        if (options.passthrough) request.passthrough = options.passthrough;
      }
      
      const response = await this.send(request);
      
      if (response && response.sell_expired) {
        const count = response.sell_expired.count;
        console.log(`${count} contratos expirados vendidos com sucesso`);
        
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
    } catch (error: any) {
      console.error("Erro ao vender contratos expirados:", error.message || error);
      throw error;
    }
  }
  
  /**
   * Obtém o histórico de lucro da conta
   * @param filters Filtros para a consulta
   * @returns Promise com tabela de lucro
   */
  public async getProfitTable(filters: {
    contract_type?: string[],
    date_from?: string,
    date_to?: string,
    description?: number,
    limit?: number,
    offset?: number,
    sort?: "ASC" | "DESC",
    passthrough?: any
  } = {}): Promise<any> {
    const request: any = {
      profit_table: 1,
      ...filters
    };
    
    return this.send(request);
  }
}

export const derivAPI = DerivAPI.getInstance();
export default derivAPI;
