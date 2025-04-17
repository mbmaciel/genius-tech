// Deriv API Wrapper
// This file provides a typed interface to interact with the Deriv WebSocket API

// Define types for the API responses and request payloads
interface DerivAuthRequest {
  authorize: string;
  req_id?: number;
}

interface DerivAPIRequest {
  [key: string]: any;
  req_id?: number;
}

interface DerivAPIResponse {
  req_id?: number;
  msg_type: string;
  error?: {
    code: string;
    message: string;
  };
  [key: string]: any;
}

interface DerivAuthorizeResponse extends DerivAPIResponse {
  authorize: {
    account_list: Array<{
      account_type: string;
      currency: string;
      is_disabled: 0 | 1;
      is_virtual: 0 | 1;
      landing_company_name: string;
      loginid: string;
      trading?: {
        shortcode?: string;
      };
    }>;
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

interface DerivBalanceResponse extends DerivAPIResponse {
  balance: {
    balance: number;
    currency: string;
    id: string;
    loginid: string;
  };
}

interface DerivTickResponse extends DerivAPIResponse {
  tick: {
    ask: number;
    bid: number;
    epoch: number;
    id: string;
    pip_size: number;
    quote: number;
    symbol: string;
  };
}

interface DerivPingResponse extends DerivAPIResponse {
  ping: string;
}

interface DerivProposalResponse extends DerivAPIResponse {
  proposal: {
    ask_price: number;
    date_start: number;
    display_value: string;
    id: string;
    longcode: string;
    spot: number;
    spot_time: number;
  };
}

interface DerivProfitTableResponse extends DerivAPIResponse {
  profit_table: {
    count: number;
    transactions: Array<{
      app_id?: number;
      buy_price?: number;
      contract_id: number;
      longcode: string;
      purchase_time: number;
      sell_price?: number;
      sell_time?: number;
      shortcode?: string;
      transaction_id: number;
    }>;
  };
}

interface DerivOpenContractsResponse extends DerivAPIResponse {
  open_contract: {
    contract_id: number;
    contract_type: string;
    currency: string;
    underlying: string;
    barrier?: string;
    bid_price: number;
    buy_price: number;
    date_start: number;
    entry_spot?: number;
    entry_tick?: number;
    entry_tick_time?: number;
    expiry_time: number;
    is_sold: 0 | 1;
    profit?: number;
    profit_percentage?: number;
    status?: "open" | "won" | "lost" | "cancelled";
    tick_count?: number;
    ticks?: Array<{
      epoch: number;
      quote: number;
    }>;
    transaction_ids: {
      buy: number;
      sell?: number;
    };
  };
}

interface DerivBuyContractResponse extends DerivAPIResponse {
  buy: {
    balance_after: number;
    contract_id: number;
    longcode: string;
    start_time: number;
    transaction_id: number;
  };
}

interface DerivActiveSymbolsResponse extends DerivAPIResponse {
  active_symbols: Array<{
    display_name: string;
    market: string;
    market_display_name: string;
    pip: number;
    submarket: string;
    submarket_display_name: string;
    symbol: string;
    symbol_type: string;
  }>;
}

interface DerivAccountInfo {
  accountName?: string;
  accountType?: string;
  balance?: number;
  balanceStr?: string;
  currency?: string;
  email?: string;
  fullname?: string;
  isVirtual?: boolean;
  landingCompany?: string;
  landingCompanyName?: string;
  loginId?: string;
  loginid?: string;
  userId?: number;
}

interface DerivAccountItem {
  account?: string;
  accountName?: string;
  loginid?: string;
  token?: string;
  isVirtual?: boolean;
  currency?: string;
}

interface DerivContract {
  id: number;
  type: string;
  currency: string;
  symbol: string;
  barrier?: string;
  bidPrice: number;
  buyPrice: number;
  startTime: number;
  entrySpot?: number;
  entryTime?: number;
  expiryTime: number;
  isSold: boolean;
  profit?: number;
  profitPercentage?: number;
  status?: string;
  tickCount?: number;
  ticks?: {epoch: number, quote: number}[];
  transactionIds: {
    buy: number;
    sell?: number;
  };
}

// Utility for generating unique request IDs
let requestCounter = 1;
function generateReqId(): number {
  return requestCounter++;
}

// Main DerivAPI class
class DerivAPI {
  private websocket: WebSocket | null = null;
  private pendingRequests: Map<number, { 
    resolve: (response: any) => void; 
    reject: (error: any) => void; 
    timeout: NodeJS.Timeout | null;
  }> = new Map();
  private subscriptions: Map<string, number> = new Map();
  private _isConnected: boolean = false;
  private _token: string | null = null;
  private _accountInfo: DerivAccountInfo | null = null;
  private _activeSubscriptions: Set<number> = new Set();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 2000; // Start with 2 seconds
  
  constructor() {
    this.setupEventListeners();
    this.loadToken();
  }
  
  // Setup DOM event listeners
  private setupEventListeners() {
    // Handle page visibility changes to reconnect if needed
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !this._isConnected) {
        console.log('Page became visible, attempting reconnection...');
        this.reconnect();
      }
    });
    
    // Handle window online/offline events
    window.addEventListener('online', () => {
      console.log('Network connection restored, attempting reconnection...');
      this.reconnect();
    });
    
    window.addEventListener('offline', () => {
      console.log('Network connection lost');
      this._isConnected = false;
      this.dispatchConnectionEvent(false);
    });
  }
  
  // Load token from storage
  private loadToken(): string | null {
    this._token = localStorage.getItem('deriv_api_token');
    return this._token;
  }
  
  // Save token to storage
  private saveToken(token: string): void {
    this._token = token;
    localStorage.setItem('deriv_api_token', token);
  }
  
  // Create WebSocket connection
  private async createConnection(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3');
      
      const onOpen = () => {
        console.log('WebSocket connection established');
        this._isConnected = true;
        this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        this.reconnectDelay = 2000; // Reset reconnect delay
        this.dispatchConnectionEvent(true);
        
        // Remove listeners to avoid memory leaks
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        
        resolve(ws);
      };
      
      const onError = (event: Event) => {
        console.error('WebSocket connection error:', event);
        this._isConnected = false;
        this.dispatchConnectionEvent(false);
        
        // Remove listeners to avoid memory leaks
        ws.removeEventListener('open', onOpen);
        ws.removeEventListener('error', onError);
        
        reject(new Error('Failed to establish WebSocket connection'));
      };
      
      ws.addEventListener('open', onOpen);
      ws.addEventListener('error', onError);
    });
  }
  
  // Handle WebSocket messages
  private setupMessageHandler(ws: WebSocket) {
    ws.addEventListener('message', (event) => {
      try {
        const data: DerivAPIResponse = JSON.parse(event.data);
        
        if (data.req_id && this.pendingRequests.has(data.req_id)) {
          const { resolve, reject, timeout } = this.pendingRequests.get(data.req_id)!;
          
          // Clear timeout if it exists
          if (timeout) {
            clearTimeout(timeout);
          }
          
          if (data.error) {
            console.error(`API Error [${data.error.code}]: ${data.error.message}`);
            reject(data.error);
          } else {
            resolve(data);
          }
          
          // Only remove non-subscription requests
          if (!this._activeSubscriptions.has(data.req_id)) {
            this.pendingRequests.delete(data.req_id);
          }
        } else if (data.msg_type === 'balance') {
          // Handle balance updates
          const balanceData = data as DerivBalanceResponse;
          if (this._accountInfo) {
            this._accountInfo.balance = balanceData.balance.balance;
            this._accountInfo.balanceStr = balanceData.balance.balance.toString();
            this._accountInfo.currency = balanceData.balance.currency;
            
            // Dispatch a custom event for balance updates
            this.dispatchEvent('balance_update', { 
              balance: balanceData.balance.balance,
              currency: balanceData.balance.currency,
              loginId: balanceData.balance.loginid
            });
          }
        } else if (data.msg_type === 'tick') {
          // Handle tick data
          this.dispatchEvent('tick', (data as DerivTickResponse).tick);
        } else if (data.msg_type === 'proposal') {
          // Handle proposal data
          this.dispatchEvent('proposal', (data as DerivProposalResponse).proposal);
        } else if (data.msg_type === 'buy') {
          // Handle contract purchase
          this.dispatchEvent('buy', (data as DerivBuyContractResponse).buy);
        } else if (data.msg_type === 'open_contract') {
          // Handle open contract updates
          const contractData = (data as DerivOpenContractsResponse).open_contract;
          
          if (contractData) {
            const contract: DerivContract = {
              id: contractData.contract_id,
              type: contractData.contract_type,
              currency: contractData.currency,
              symbol: contractData.underlying,
              barrier: contractData.barrier,
              bidPrice: contractData.bid_price,
              buyPrice: contractData.buy_price,
              startTime: contractData.date_start,
              entrySpot: contractData.entry_spot,
              entryTime: contractData.entry_tick_time,
              expiryTime: contractData.expiry_time,
              isSold: contractData.is_sold === 1,
              profit: contractData.profit,
              profitPercentage: contractData.profit_percentage,
              status: contractData.status,
              tickCount: contractData.tick_count,
              ticks: contractData.ticks,
              transactionIds: contractData.transaction_ids
            };
            
            this.dispatchEvent('contract_update', contract);
          }
        } else if (data.msg_type === 'ping') {
          // Handle ping response - useful for keepalive
          // console.log('Ping received:', (data as DerivPingResponse).ping);
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    });
    
    ws.addEventListener('close', (event) => {
      console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
      this._isConnected = false;
      this.dispatchConnectionEvent(false);
      
      // Attempt to reconnect
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => this.reconnect(), this.reconnectDelay);
        
        // Increase delay for next attempt (exponential backoff)
        this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 30000); // Max 30 seconds
        this.reconnectAttempts++;
      } else {
        console.error(`Maximum reconnection attempts (${this.maxReconnectAttempts}) reached.`);
      }
    });
    
    ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      // The close event will handle reconnection
    });
  }
  
  // Dispatch custom events for components to listen to
  private dispatchEvent(eventName: string, data: any) {
    const event = new CustomEvent(`deriv:${eventName}`, { detail: data });
    document.dispatchEvent(event);
  }
  
  // Specifically dispatch connection status events
  private dispatchConnectionEvent(connected: boolean) {
    const event = new CustomEvent('deriv:connection_status', { 
      detail: { connected } 
    });
    document.dispatchEvent(event);
  }
  
  // Send a request to the API
  private async sendRequest<T extends DerivAPIResponse>(request: DerivAPIRequest, timeoutMs = 30000): Promise<T> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      await this.connect();
      
      if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket connection is not open');
      }
    }
    
    const reqId = generateReqId();
    request.req_id = reqId;
    
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | null = null;
      
      // Set timeout for request
      if (timeoutMs > 0) {
        timeoutId = setTimeout(() => {
          if (this.pendingRequests.has(reqId)) {
            this.pendingRequests.delete(reqId);
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
          }
        }, timeoutMs);
      }
      
      // Store the request in pending requests
      this.pendingRequests.set(reqId, { resolve, reject, timeout: timeoutId });
      
      // Track subscription requests
      if (request.subscribe === 1) {
        this._activeSubscriptions.add(reqId);
        
        // Store the subscription type for easy cancellation later
        for (const key of Object.keys(request)) {
          if (key !== 'req_id' && key !== 'subscribe') {
            this.subscriptions.set(key, reqId);
            break;
          }
        }
      }
      
      // Send the request
      this.websocket!.send(JSON.stringify(request));
    });
  }
  
  // Reconnect to the API
  private async reconnect(): Promise<void> {
    try {
      if (this.websocket) {
        // Clean up old connection
        this.websocket.close();
        this.websocket = null;
      }
      
      // Create new connection
      this.websocket = await this.createConnection();
      this.setupMessageHandler(this.websocket);
      
      // Re-authorize if we have a token
      if (this._token) {
        await this.authorize(this._token);
        
        // Resubscribe to active subscriptions
        // Note: This would require storing subscription parameters
        // For simplicity, we rely on components to resubscribe when they detect reconnection
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
      throw error;
    }
  }
  
  // Connect to the API
  public async connect(): Promise<boolean> {
    try {
      // If already connected, return true
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        return true;
      }
      
      // Create connection
      this.websocket = await this.createConnection();
      this.setupMessageHandler(this.websocket);
      
      // Authorize if we have a token
      if (this._token) {
        await this.authorize(this._token);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to connect:', error);
      return false;
    }
  }
  
  // Disconnect from the API
  public disconnect(force: boolean = false): void {
    // Cancel all active subscriptions first
    if (!force) {
      this.cancelAllActiveSubscriptions();
    }
    
    // Close the connection
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this._isConnected = false;
    this.dispatchConnectionEvent(false);
    
    // Clear token if forced disconnect
    if (force) {
      this._token = null;
      this._accountInfo = null;
      localStorage.removeItem('deriv_api_token');
    }
  }
  
  // Authorize with the API using a token
  public async authorize(token: string): Promise<DerivAccountInfo | null> {
    if (!token) {
      throw new Error('Token is required for authorization');
    }
    
    try {
      const request: DerivAuthRequest = { authorize: token };
      const response = await this.sendRequest<DerivAuthorizeResponse>(request);
      
      this.saveToken(token);
      
      if (response.authorize) {
        this._accountInfo = {
          fullname: response.authorize.fullname,
          email: response.authorize.email,
          loginId: response.authorize.loginid,
          loginid: response.authorize.loginid,
          accountType: response.authorize.landing_company_name,
          landingCompany: response.authorize.landing_company_name,
          landingCompanyName: response.authorize.landing_company_fullname,
          currency: response.authorize.currency,
          balance: response.authorize.balance,
          balanceStr: response.authorize.balance?.toString(),
          isVirtual: response.authorize.is_virtual === 1,
          userId: response.authorize.user_id
        };
        
        this.dispatchEvent('account_info', this._accountInfo);
        return this._accountInfo;
      }
      
      return null;
    } catch (error) {
      console.error('Authorization failed:', error);
      throw error;
    }
  }
  
  // Get account information
  public getAccountInfo(): DerivAccountInfo | null {
    return this._accountInfo;
  }
  
  // Get account list
  public async getAccountList(): Promise<DerivAccountItem[]> {
    if (!this._token) {
      throw new Error('Not authorized. Call authorize() first');
    }
    
    try {
      const request: DerivAuthRequest = { authorize: this._token };
      const response = await this.sendRequest<DerivAuthorizeResponse>(request);
      
      if (response.authorize && response.authorize.account_list) {
        return response.authorize.account_list.map(account => ({
          loginid: account.loginid,
          currency: account.currency,
          isVirtual: account.is_virtual === 1,
          accountType: account.account_type,
          // Account may be disabled
          isDisabled: account.is_disabled === 1
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get account list:', error);
      throw error;
    }
  }
  
  // Check if connected
  public get isConnected(): boolean {
    return this._isConnected && this.websocket?.readyState === WebSocket.OPEN;
  }
  
  // Get connection status
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }
  
  // Get the current token
  public getToken(): string | null {
    return this._token;
  }
  
  // Cancel a specific subscription
  public async cancelSubscription(subscriptionType: string): Promise<boolean> {
    if (this.subscriptions.has(subscriptionType)) {
      const reqId = this.subscriptions.get(subscriptionType)!;
      
      try {
        const request = { forget: reqId };
        await this.sendRequest(request);
        
        this._activeSubscriptions.delete(reqId);
        this.subscriptions.delete(subscriptionType);
        this.pendingRequests.delete(reqId);
        
        return true;
      } catch (error) {
        console.error(`Failed to cancel ${subscriptionType} subscription:`, error);
        return false;
      }
    }
    
    return true; // No subscription to cancel
  }
  
  // Cancel all active subscriptions
  public async cancelAllActiveSubscriptions(): Promise<boolean> {
    if (this._activeSubscriptions.size === 0) {
      return true;
    }
    
    try {
      const request = { forget_all: ['ticks', 'proposal', 'portfolio', 'balance', 'transaction'] };
      await this.sendRequest(request);
      
      // Clear subscriptions
      this._activeSubscriptions.clear();
      this.subscriptions.clear();
      
      // Clear any pending requests that were for subscriptions
      for (const [reqId, request] of this.pendingRequests.entries()) {
        if (this._activeSubscriptions.has(reqId)) {
          if (request.timeout) {
            clearTimeout(request.timeout);
          }
          this.pendingRequests.delete(reqId);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to cancel all subscriptions:', error);
      return false;
    }
  }
  
  // Subscribe to balance updates
  public async subscribeToBalanceUpdates(): Promise<boolean> {
    try {
      await this.cancelSubscription('balance');
      
      const request = { balance: 1, subscribe: 1 };
      const response = await this.sendRequest(request);
      
      return response.msg_type === 'balance';
    } catch (error) {
      console.error('Failed to subscribe to balance updates:', error);
      return false;
    }
  }
  
  // Subscribe to ticks for a symbol
  public async subscribeToTicks(symbol: string): Promise<boolean> {
    try {
      // Cancel any existing tick subscription for this symbol
      await this.cancelSubscription(`tick_${symbol}`);
      
      const request = { ticks: symbol, subscribe: 1 };
      const response = await this.sendRequest<DerivTickResponse>(request);
      
      this.subscriptions.set(`tick_${symbol}`, response.req_id!);
      
      return response.msg_type === 'tick';
    } catch (error) {
      console.error(`Failed to subscribe to ticks for ${symbol}:`, error);
      return false;
    }
  }
  
  // Get active symbols
  public async getActiveSymbols(): Promise<DerivActiveSymbolsResponse['active_symbols']> {
    try {
      const request = { active_symbols: 'brief', product_type: 'basic' };
      const response = await this.sendRequest<DerivActiveSymbolsResponse>(request);
      
      return response.active_symbols || [];
    } catch (error) {
      console.error('Failed to get active symbols:', error);
      throw error;
    }
  }
  
  // Subscribe to open contracts
  public async subscribeToOpenContracts(): Promise<boolean> {
    try {
      await this.cancelSubscription('proposal_open_contract');
      
      const request = { proposal_open_contract: 1, subscribe: 1 };
      const response = await this.sendRequest<DerivOpenContractsResponse>(request);
      
      return response.msg_type === 'proposal_open_contract';
    } catch (error) {
      console.error('Failed to subscribe to open contracts:', error);
      return false;
    }
  }
  
  // Get profit table
  public async getProfitTable(options: {
    limit?: number;
    offset?: number;
    sort?: string;
    date_from?: number;
    date_to?: number;
  } = {}): Promise<DerivProfitTableResponse['profit_table']> {
    try {
      const request = { 
        profit_table: 1,
        limit: options.limit || 100,
        offset: options.offset || 0,
        sort: options.sort || 'DESC',
        date_from: options.date_from,
        date_to: options.date_to
      };
      
      const response = await this.sendRequest<DerivProfitTableResponse>(request);
      
      return response.profit_table;
    } catch (error) {
      console.error('Failed to get profit table:', error);
      throw error;
    }
  }
  
  // Buy contract
  public async buyContract(contractType: string, parameters: {
    symbol: string;
    amount: number;
    basis: 'payout' | 'stake';
    contract_type: string;
    currency: string;
    duration: number;
    duration_unit: 'tick' | 'm' | 's' | 'h' | 'd';
    barrier?: string;
    barrier2?: string;
    limit_order?: {
      stop_loss?: number;
      take_profit?: number;
    };
  }): Promise<DerivBuyContractResponse['buy']> {
    try {
      // First get the price (proposal)
      const proposalRequest = { 
        proposal: 1,
        ...parameters
      };
      
      const proposalResponse = await this.sendRequest<DerivProposalResponse>(proposalRequest);
      
      if (!proposalResponse.proposal || !proposalResponse.proposal.id) {
        throw new Error('Failed to get proposal for contract');
      }
      
      // Buy the contract using the proposal ID
      const buyRequest = { 
        buy: proposalResponse.proposal.id,
        price: parameters.amount
      };
      
      const buyResponse = await this.sendRequest<DerivBuyContractResponse>(buyRequest);
      
      return buyResponse.buy;
    } catch (error) {
      console.error('Failed to buy contract:', error);
      throw error;
    }
  }
  
  // Send ping to keep connection alive
  public async ping(): Promise<boolean> {
    try {
      const request = { ping: 1 };
      const response = await this.sendRequest<DerivPingResponse>(request, 5000);
      
      return response.msg_type === 'ping';
    } catch (error) {
      console.error('Ping failed:', error);
      return false;
    }
  }
}

// Create a singleton instance
const derivAPI = new DerivAPI();
export default derivAPI;
