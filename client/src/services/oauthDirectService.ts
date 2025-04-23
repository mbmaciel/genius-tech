/**
 * Serviço para comunicação direta com a API Deriv via WebSocket
 * Usa OAuth para autenticação
 */

class OAuthDirectService {
  private baseUrl: string = 'wss://ws.binaryws.com/websockets/v3';
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private requestCallbacks: Map<string, (response: any) => void> = new Map();
  private messageListeners: Map<string, ((data: any) => void)[]> = new Map();
  private lastRequestId: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private pingInterval: number | null = null;
  private autoReconnect: boolean = true;
  private activeSubscriptions: Map<string, boolean> = new Map();

  constructor() {
    // Inicializar serviço
    this.setupEventListeners();
  }

  /**
   * Configura os listeners de eventos globais
   */
  private setupEventListeners() {
    // Listener para quando a janela é fechada
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });

    // Detectar quando a conexão com a internet cai/volta
    window.addEventListener('online', () => {
      if (this.autoReconnect && !this.isConnected) {
        this.connect();
      }
    });
  }

  /**
   * Conecta ao WebSocket da Deriv
   */
  public async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }

      try {
        this.socket = new WebSocket(this.baseUrl);

        this.socket.onopen = () => {
          console.log('WebSocket conectado');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.startPingInterval();
          this.resubscribeAll();
          resolve(true);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.socket.onclose = () => {
          console.log('WebSocket fechado');
          this.isConnected = false;
          this.stopPingInterval();
          
          if (this.autoReconnect) {
            this.attemptReconnect();
          }
        };

        this.socket.onerror = (error) => {
          console.error('Erro no WebSocket:', error);
          reject(error);
        };
      } catch (err) {
        console.error('Falha ao conectar WebSocket:', err);
        this.isConnected = false;
        reject(err);
      }
    });
  }

  /**
   * Desconecta do WebSocket
   */
  public disconnect(): void {
    this.autoReconnect = false;
    this.stopPingInterval();
    
    if (this.socket) {
      // Cancelar todas as assinaturas ativas
      this.activeSubscriptions.forEach((_, key) => {
        this.forget(key).catch(console.error);
      });

      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
    
    // Limpar callbacks pendentes
    this.requestCallbacks.clear();
  }

  /**
   * Tenta reconectar ao WebSocket após desconexão
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Falha após ${this.maxReconnectAttempts} tentativas de reconexão`);
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1);
    
    console.log(`Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect().catch(err => {
        console.error('Falha na tentativa de reconexão:', err);
      });
    }, delay);
  }

  /**
   * Inicia um intervalo para enviar pings e manter a conexão
   */
  private startPingInterval(): void {
    this.stopPingInterval();
    
    this.pingInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.ping().catch(console.error);
      }
    }, 30000); // Ping a cada 30 segundos
  }

  /**
   * Para o intervalo de ping
   */
  private stopPingInterval(): void {
    if (this.pingInterval !== null) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Reinscreve em todas as assinaturas ativas após reconexão
   */
  private async resubscribeAll(): Promise<void> {
    for (const [key, active] of this.activeSubscriptions.entries()) {
      if (active) {
        const [type, params] = key.split('|');
        const paramsObj = params ? JSON.parse(params) : {};
        
        try {
          await this.subscribe(type, paramsObj);
        } catch (err) {
          console.error(`Falha ao reinscrever em ${type}:`, err);
        }
      }
    }
  }

  /**
   * Processa mensagens recebidas do WebSocket
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      // Para debugging
      console.debug('Mensagem recebida:', data);
      
      // Se houver uma requisição associada a este ID
      if (data.req_id && this.requestCallbacks.has(data.req_id.toString())) {
        const callback = this.requestCallbacks.get(data.req_id.toString());
        if (callback) {
          callback(data);
          // Remover callback após processamento, a menos que seja uma assinatura
          if (!data.subscription) {
            this.requestCallbacks.delete(data.req_id.toString());
          }
        }
      }
      
      // Notificar todos os listeners para este tipo de mensagem
      // Exemplo: 'tick', 'ohlc', etc.
      for (const [eventType, listeners] of this.messageListeners.entries()) {
        if (data[eventType]) {
          for (const listener of listeners) {
            listener(data);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao processar mensagem:', error, event.data);
    }
  }

  /**
   * Envia uma requisição para a API
   */
  private async sendRequest(request: any): Promise<any> {
    if (!this.isConnected || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      try {
        // Gerar ID de requisição único
        const reqId = (++this.lastRequestId).toString();
        request.req_id = reqId;
        
        // Registrar callback para esta requisição
        this.requestCallbacks.set(reqId, (response: any) => {
          if (response.error) {
            reject(response.error);
          } else {
            resolve(response);
          }
        });
        
        // Enviar requisição
        this.socket!.send(JSON.stringify(request));
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Ping para manter conexão ativa
   */
  public async ping(): Promise<any> {
    return this.sendRequest({ ping: 1 });
  }

  /**
   * Autoriza o cliente com um token de acesso
   */
  public async authorize(token: string): Promise<any> {
    return this.sendRequest({ authorize: token });
  }

  /**
   * Obtém informações do balance da conta
   */
  public async getBalance(): Promise<any> {
    return this.sendRequest({ balance: 1 });
  }

  /**
   * Obtém lista de símbolos ativos
   */
  public async getActiveSymbols(): Promise<any> {
    try {
      const response = await this.sendRequest({ active_symbols: 'brief', product_type: 'basic' });
      return response.active_symbols;
    } catch (error) {
      console.error('Erro ao buscar símbolos ativos:', error);
      throw error;
    }
  }

  /**
   * Obtém contratos disponíveis para um símbolo
   */
  public async getContractsForSymbol(symbol: string): Promise<any> {
    return this.sendRequest({
      contracts_for: symbol,
      currency: 'USD',
      landing_company: 'svg'
    });
  }

  /**
   * Registra um ouvinte para um tipo específico de mensagem
   */
  public addMessageListener(eventType: string, callback: (data: any) => void): void {
    if (!this.messageListeners.has(eventType)) {
      this.messageListeners.set(eventType, []);
    }
    
    this.messageListeners.get(eventType)!.push(callback);
  }

  /**
   * Remove um ouvinte para um tipo específico de mensagem
   */
  public removeMessageListener(eventType: string, callback: (data: any) => void): void {
    if (this.messageListeners.has(eventType)) {
      const listeners = this.messageListeners.get(eventType)!;
      const index = listeners.indexOf(callback);
      
      if (index !== -1) {
        listeners.splice(index, 1);
      }
      
      if (listeners.length === 0) {
        this.messageListeners.delete(eventType);
      }
    }
  }

  /**
   * Faz uma assinatura para receber atualizações contínuas
   */
  private async subscribe(type: string, params: any = {}): Promise<string> {
    const request = { [type]: 1, ...params };
    const response = await this.sendRequest(request);
    
    // Registrar esta assinatura como ativa
    const subscriptionId = response.subscription?.id;
    if (subscriptionId) {
      const key = `${type}|${JSON.stringify(params)}`;
      this.activeSubscriptions.set(key, true);
    }
    
    return subscriptionId;
  }

  /**
   * Cancela uma assinatura
   */
  private async forget(subscriptionIdOrKey: string): Promise<boolean> {
    // Se for uma chave de tipo|params, tentar encontrar o ID da assinatura
    if (subscriptionIdOrKey.includes('|')) {
      this.activeSubscriptions.delete(subscriptionIdOrKey);
      
      // TODO: Implementar lookup para encontrar ID real da assinatura
      return true;
    }
    
    // Se for um ID de assinatura, cancelar diretamente
    try {
      const response = await this.sendRequest({ forget: subscriptionIdOrKey });
      
      // Remover subscrição da lista ativa
      for (const [key, _] of this.activeSubscriptions.entries()) {
        // Verificação simplificada, idealmente teríamos mapeamento de key -> subscription_id
        this.activeSubscriptions.delete(key);
      }
      
      return response.forget === 1;
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      return false;
    }
  }

  /**
   * Assina para receber ticks de um símbolo
   */
  public subscribeTicks(symbol: string, callback: (data: any) => void): void {
    this.addMessageListener('tick', callback);
    
    this.subscribe('ticks', { ticks: symbol })
      .catch(err => console.error(`Erro ao assinar ticks para ${symbol}:`, err));
  }

  /**
   * Cancela assinatura de ticks
   */
  public unsubscribeTicks(symbol: string, callback: (data: any) => void): void {
    this.removeMessageListener('tick', callback);
    
    // Identificar e cancelar a assinatura
    const key = `ticks|${JSON.stringify({ ticks: symbol })}`;
    
    if (this.activeSubscriptions.has(key)) {
      this.forget(key).catch(err => 
        console.error(`Erro ao cancelar assinatura de ticks para ${symbol}:`, err)
      );
    }
  }

  /**
   * Obtém histórico de ticks
   */
  public async getTicksHistory(symbol: string, count: number = 100, style: string = 'ticks'): Promise<any> {
    const end = 'latest';
    const request = {
      ticks_history: symbol,
      count: count,
      end: end,
      style: style
    };
    
    const response = await this.sendRequest(request);
    return response.history;
  }

  /**
   * Compra um contrato
   */
  public async buyContract(parameters: {
    contract_type: string;
    symbol: string;
    amount: number;
    basis: string;
    duration: number;
    duration_unit: string;
    barrier?: string | number;
    prediction?: number;
  }): Promise<any> {
    const request = {
      buy: 1,
      price: parameters.amount,
      parameters: {
        amount: parameters.amount,
        basis: parameters.basis,
        contract_type: parameters.contract_type,
        currency: 'USD',
        duration: parameters.duration,
        duration_unit: parameters.duration_unit,
        symbol: parameters.symbol
      }
    };
    
    // Adicionar barreira se fornecida
    if (parameters.barrier !== undefined) {
      request.parameters.barrier = parameters.barrier;
    }
    
    // Adicionar previsão para contratos de dígito
    if (parameters.prediction !== undefined) {
      request.parameters.prediction = parameters.prediction;
    }
    
    return this.sendRequest(request);
  }

  /**
   * Vende um contrato
   */
  public async sellContract(contractId: number, price: number): Promise<any> {
    return this.sendRequest({
      sell: contractId,
      price: price
    });
  }

  /**
   * Obtém detalhes de um contrato
   */
  public async getContractDetails(contractId: number): Promise<any> {
    return this.sendRequest({
      proposal_open_contract: 1,
      contract_id: contractId
    });
  }

  /**
   * Obtém contratos abertos
   */
  public async getOpenContracts(): Promise<any> {
    try {
      const response = await this.sendRequest({ proposal_open_contract: 1 });
      return response.proposal_open_contract;
    } catch (error) {
      console.error('Erro ao obter contratos abertos:', error);
      throw error;
    }
  }

  /**
   * Verifica se está conectado
   */
  public isSocketConnected(): boolean {
    return this.isConnected && !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

export const oauthDirectService = new OAuthDirectService();