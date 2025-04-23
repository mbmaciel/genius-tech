/**
 * Serviço independente para conexão com a API Deriv
 * Gerencia websocket, autenticação e operações de trading
 */
export default class IndependentDerivService {
  private ws: WebSocket | null = null;
  private appId: number;
  private endpoint: string = 'wss://ws.binaryws.com/websockets/v3';
  private requestMap: Map<string, any> = new Map();
  private messageListeners: Map<string, ((data: any) => void)[]> = new Map();
  private connectionListeners: ((connected: boolean) => void)[] = [];
  private errorListeners: ((error: any) => void)[] = [];
  private requestId: number = 0;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isAuthorized: boolean = false;
  private authorizedAccount: any = null;
  private autoReconnect: boolean = true;
  private subscribedStreams: Map<string, boolean> = new Map();
  private pingTimeout: NodeJS.Timeout | null = null;
  private sessionPauseTimeout: NodeJS.Timeout | null = null;
  private lastActiveTimestamp: number = Date.now();
  private forgetRequests: string[] = [];

  constructor(appId: number = 1089) {
    this.appId = appId;
  }

  /**
   * Conectar ao websocket da Deriv
   */
  public async connect(): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return true;
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.endpoint);

        this.ws.onopen = () => {
          console.log('[DerivAPI] Conectado ao WebSocket da Deriv');
          this.reconnectAttempts = 0;
          this.setupKeepAlive();
          this.notifyConnectionListeners(true);
          resolve(true);
        };

        this.ws.onclose = (event) => {
          console.log(`[DerivAPI] Conexão fechada: ${event.code} - ${event.reason}`);
          this.clearKeepAlive();
          this.notifyConnectionListeners(false);
          
          // Tentar reconectar automaticamente se habilitado
          if (this.autoReconnect) {
            this.attemptReconnect();
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DerivAPI] Erro na conexão WebSocket:', error);
          this.notifyErrorListeners(error);
          reject(error);
        };

        this.ws.onmessage = this.handleMessage.bind(this);
      } catch (error) {
        console.error('[DerivAPI] Erro ao criar conexão WebSocket:', error);
        this.notifyErrorListeners(error);
        reject(error);
      }
    });
  }

  /**
   * Desconectar do websocket
   */
  public disconnect(): void {
    this.clearKeepAlive();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      // Cancelar qualquer tentativa pendente de reconexão
      this.autoReconnect = false;
      
      // Limpar todos os streams inscritos
      this.subscribedStreams.clear();
      
      // Fechar o websocket
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
      this.isAuthorized = false;
      this.authorizedAccount = null;
    }
  }

  /**
   * Verificar se está conectado
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Verificar se está autorizado
   */
  public isAuthenticated(): boolean {
    return this.isAuthorized;
  }

  /**
   * Autorizar com token
   */
  public async authorize(token: string): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      const response = await this.send({
        authorize: token
      });

      if (response.authorize) {
        this.isAuthorized = true;
        this.authorizedAccount = response.authorize;
        console.log('[DerivAPI] Autorizado com sucesso como:', response.authorize.loginid);
      }

      return response;
    } catch (error) {
      console.error('[DerivAPI] Erro na autorização:', error);
      this.isAuthorized = false;
      this.authorizedAccount = null;
      throw error;
    }
  }

  /**
   * Obter informações da conta autorizada
   */
  public getAuthorizedAccount(): any {
    return this.authorizedAccount;
  }

  /**
   * Definir comportamento de reconexão automática
   */
  public setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }

  /**
   * Enviar requisição WebSocket
   */
  public async send(request: any): Promise<any> {
    if (!this.isConnected()) {
      try {
        await this.connect();
      } catch (error) {
        throw new Error('Falha ao conectar ao WebSocket: ' + error);
      }
    }

    const reqId = this.getUniqueRequestId();
    const fullRequest = {
      ...request,
      req_id: reqId,
      passthrough: {
        ...(request.passthrough || {}),
        request_time: Date.now()
      }
    };

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.requestMap.delete(reqId);
        reject(new Error(`Timeout na requisição ${reqId}`));
      }, 30000);

      this.requestMap.set(reqId, { resolve, reject, timeoutId, request: fullRequest });

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.updateLastActiveTimestamp();
        this.ws.send(JSON.stringify(fullRequest));
      } else {
        clearTimeout(timeoutId);
        this.requestMap.delete(reqId);
        reject(new Error('WebSocket não está conectado'));
      }
    });
  }

  /**
   * Adicionar listener para mensagens específicas
   */
  public addMessageListener(msgType: string, callback: (data: any) => void): void {
    if (!this.messageListeners.has(msgType)) {
      this.messageListeners.set(msgType, []);
    }
    this.messageListeners.get(msgType)?.push(callback);
  }

  /**
   * Remover listener de mensagens
   */
  public removeMessageListener(msgType: string, callback: (data: any) => void): void {
    if (this.messageListeners.has(msgType)) {
      const listeners = this.messageListeners.get(msgType);
      if (listeners) {
        this.messageListeners.set(
          msgType,
          listeners.filter((cb) => cb !== callback)
        );
      }
    }
  }

  /**
   * Adicionar listener para mudanças na conexão
   */
  public addConnectionListener(callback: (connected: boolean) => void): void {
    this.connectionListeners.push(callback);
    // Notificar imediatamente com o status atual
    callback(this.isConnected());
  }

  /**
   * Remover listener de conexão
   */
  public removeConnectionListener(callback: (connected: boolean) => void): void {
    this.connectionListeners = this.connectionListeners.filter((cb) => cb !== callback);
  }

  /**
   * Adicionar listener para erros
   */
  public addErrorListener(callback: (error: any) => void): void {
    this.errorListeners.push(callback);
  }

  /**
   * Remover listener de erros
   */
  public removeErrorListener(callback: (error: any) => void): void {
    this.errorListeners = this.errorListeners.filter((cb) => cb !== callback);
  }

  /**
   * Inscrever para stream de ticks
   */
  public async subscribeTicks(symbol: string): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      if (this.subscribedStreams.has(`ticks-${symbol}`)) {
        console.log(`[DerivAPI] Já inscrito para ticks de ${symbol}`);
        return;
      }

      const response = await this.send({
        ticks: symbol,
        subscribe: 1
      });

      if (response.tick) {
        this.subscribedStreams.set(`ticks-${symbol}`, true);
        console.log(`[DerivAPI] Inscrito para ticks de ${symbol}`);
      }

      return response;
    } catch (error) {
      console.error(`[DerivAPI] Erro ao inscrever para ticks de ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Cancelar inscrição de ticks
   */
  public async unsubscribeTicks(symbol: string): Promise<void> {
    try {
      const key = `ticks-${symbol}`;
      if (!this.subscribedStreams.has(key)) {
        return;
      }

      if (this.isConnected()) {
        await this.send({
          forget_all: ['ticks']
        });
      }

      this.subscribedStreams.delete(key);
      console.log(`[DerivAPI] Inscrição de ticks para ${symbol} cancelada`);
    } catch (error) {
      console.error(`[DerivAPI] Erro ao cancelar inscrição de ticks para ${symbol}:`, error);
    }
  }

  /**
   * Obter histórico de ticks
   */
  public async getTicksHistory(symbol: string, options: any = {}): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      const request = {
        ticks_history: symbol,
        adjust_start_time: 1,
        count: options.count || 100,
        end: 'latest',
        start: options.start || 1,
        style: options.style || 'ticks'
      };

      const response = await this.send(request);
      return response;
    } catch (error) {
      console.error(`[DerivAPI] Erro ao obter histórico de ticks para ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Obter saldo atual
   */
  public async getBalance(): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      if (!this.isAuthorized) {
        throw new Error('Não autorizado. Faça login primeiro.');
      }

      const response = await this.send({
        balance: 1,
        subscribe: 0
      });

      return response;
    } catch (error) {
      console.error('[DerivAPI] Erro ao obter saldo:', error);
      throw error;
    }
  }

  /**
   * Comprar contrato
   */
  public async buyContract(parameters: any): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      if (!this.isAuthorized) {
        throw new Error('Não autorizado. Faça login primeiro.');
      }

      const proposal = await this.send({
        proposal: 1,
        subscribe: 0,
        ...parameters
      });

      if (proposal.error) {
        throw proposal.error;
      }

      const buy = await this.send({
        buy: proposal.proposal.id,
        price: parameters.amount
      });

      return buy;
    } catch (error) {
      console.error('[DerivAPI] Erro ao comprar contrato:', error);
      throw error;
    }
  }

  /**
   * Obter contratos abertos
   */
  public async getOpenContracts(): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      if (!this.isAuthorized) {
        throw new Error('Não autorizado. Faça login primeiro.');
      }

      const response = await this.send({
        proposal_open_contract: 1,
        subscribe: 0
      });

      return response;
    } catch (error) {
      console.error('[DerivAPI] Erro ao obter contratos abertos:', error);
      throw error;
    }
  }

  /**
   * Vender contrato
   */
  public async sellContract(contractId: number, price: number): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      if (!this.isAuthorized) {
        throw new Error('Não autorizado. Faça login primeiro.');
      }

      const response = await this.send({
        sell: contractId,
        price: price
      });

      return response;
    } catch (error) {
      console.error(`[DerivAPI] Erro ao vender contrato ${contractId}:`, error);
      throw error;
    }
  }

  /**
   * Obter símbolos ativos disponíveis
   */
  public async getActiveSymbols(): Promise<any> {
    try {
      if (!this.isConnected()) {
        await this.connect();
      }

      const response = await this.send({
        active_symbols: 'brief',
        product_type: 'basic'
      });

      return response;
    } catch (error) {
      console.error('[DerivAPI] Erro ao obter símbolos ativos:', error);
      throw error;
    }
  }

  /**
   * Manipular mensagem recebida
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      this.updateLastActiveTimestamp();

      // Se for uma resposta a uma requisição específica
      if (data.req_id && this.requestMap.has(data.req_id)) {
        const { resolve, reject, timeoutId } = this.requestMap.get(data.req_id);
        clearTimeout(timeoutId);
        this.requestMap.delete(data.req_id);

        if (data.error) {
          console.error(`[DerivAPI] Erro na resposta ${data.req_id}:`, data.error);
          reject(data.error);
        } else {
          resolve(data);
        }
      }

      // Verificar se é um evento de ping/pong
      if (data.ping) {
        this.handlePingResponse();
        return;
      }

      // Verificar se é resposta de forget
      if (data.forget) {
        const idx = this.forgetRequests.indexOf(data.req_id);
        if (idx !== -1) {
          this.forgetRequests.splice(idx, 1);
        }
        return;
      }

      // Notificar listeners com base no tipo de mensagem
      for (const [msgType, handlers] of this.messageListeners.entries()) {
        if (data[msgType]) {
          handlers.forEach((handler) => {
            try {
              handler({ ...data });
            } catch (err) {
              console.error(`[DerivAPI] Erro ao processar listener ${msgType}:`, err);
            }
          });
        }
      }

      // Verificar se é um evento específico de tick
      if (data.tick) {
        const event = new CustomEvent('tick', { detail: data.tick });
        window.dispatchEvent(event);
      }

      // Verificar se é uma atualização de contrato
      if (data.proposal_open_contract) {
        const event = new CustomEvent('contract_update', { 
          detail: data.proposal_open_contract 
        });
        window.dispatchEvent(event);
      }

    } catch (error) {
      console.error('[DerivAPI] Erro ao processar mensagem:', error);
    }
  }

  /**
   * Gerar ID único para requisição
   */
  private getUniqueRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  /**
   * Configurar keep-alive para manter conexão
   */
  private setupKeepAlive(): void {
    this.clearKeepAlive();
    
    // Enviar ping a cada 30 segundos para manter a conexão ativa
    this.keepAliveInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, 30000);

    // Verificar inatividade a cada 5 minutos
    this.sessionPauseTimeout = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - this.lastActiveTimestamp;
      
      // Se estiver inativo por mais de 15 minutos
      if (inactiveTime > 15 * 60 * 1000) {
        console.log('[DerivAPI] Sessão inativa por 15 minutos, pausando atividade');
        // Manter apenas pings, mas reduzir outras atividades
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Limpar intervalos de keep-alive
   */
  private clearKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
    
    if (this.sessionPauseTimeout) {
      clearInterval(this.sessionPauseTimeout);
      this.sessionPauseTimeout = null;
    }
  }

  /**
   * Enviar ping para servidor
   */
  private sendPing(): void {
    if (!this.isConnected()) return;
    
    try {
      this.ws?.send(JSON.stringify({ ping: 1 }));
      
      // Definir timeout para detectar falha na resposta de ping
      this.pingTimeout = setTimeout(() => {
        console.warn('[DerivAPI] Não recebeu resposta ao ping, reconectando...');
        this.handleReconnection();
      }, 10000);
    } catch (error) {
      console.error('[DerivAPI] Erro ao enviar ping:', error);
      this.handleReconnection();
    }
  }

  /**
   * Manipular resposta de ping
   */
  private handlePingResponse(): void {
    // Limpar timeout de ping já que recebeu resposta
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  /**
   * Atualizar timestamp da última atividade
   */
  private updateLastActiveTimestamp(): void {
    this.lastActiveTimestamp = Date.now();
  }

  /**
   * Tentar reconectar ao WebSocket
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[DerivAPI] Número máximo de tentativas de reconexão atingido');
      return;
    }

    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    console.log(`[DerivAPI] Tentando reconectar em ${delay / 1000} segundos...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.handleReconnection();
    }, delay);
  }

  /**
   * Manipular reconexão e restauração de estado
   */
  private async handleReconnection(): Promise<void> {
    try {
      // Limpar estado atual
      if (this.ws) {
        this.ws.onclose = null;
        this.ws.onerror = null;
        this.ws.onmessage = null;
        this.ws.onopen = null;
        
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close();
        }
        this.ws = null;
      }

      // Armazenar estado atual
      const wasAuthorized = this.isAuthorized;
      const savedAccount = this.authorizedAccount;
      const savedToken = savedAccount?.token;
      const savedStreams = new Map(this.subscribedStreams);

      // Redefinir estado
      this.isAuthorized = false;
      this.authorizedAccount = null;
      this.subscribedStreams.clear();

      // Tentar reconectar
      await this.connect();

      // Restaurar autorização se necessário
      if (wasAuthorized && savedToken) {
        try {
          await this.authorize(savedToken);
        } catch (error) {
          console.error('[DerivAPI] Falha ao restaurar autorização após reconexão:', error);
        }
      }

      // Restaurar streams inscritos
      for (const [streamKey, active] of savedStreams.entries()) {
        if (active && streamKey.startsWith('ticks-')) {
          const symbol = streamKey.replace('ticks-', '');
          try {
            await this.subscribeTicks(symbol);
          } catch (error) {
            console.error(`[DerivAPI] Falha ao restaurar stream ${streamKey}:`, error);
          }
        }
      }

      console.log('[DerivAPI] Reconexão realizada com sucesso');
    } catch (error) {
      console.error('[DerivAPI] Erro durante reconexão:', error);
      
      // Se falhar, tentar novamente
      if (this.autoReconnect) {
        this.attemptReconnect();
      }
    }
  }

  /**
   * Notificar listeners de conexão
   */
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (error) {
        console.error('[DerivAPI] Erro ao notificar listener de conexão:', error);
      }
    });
  }

  /**
   * Notificar listeners de erro
   */
  private notifyErrorListeners(error: any): void {
    this.errorListeners.forEach((listener) => {
      try {
        listener(error);
      } catch (err) {
        console.error('[DerivAPI] Erro ao notificar listener de erro:', err);
      }
    });
  }
}

// Criar e exportar instância única por padrão
export const independentDerivService = new IndependentDerivService();