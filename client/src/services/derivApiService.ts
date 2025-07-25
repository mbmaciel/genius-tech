/**
 * Serviço para interagir com a API WebSocket da Deriv
 * Implementa funções para operações de trading com base nos contratos apresentados
 */

// Tipos de dados para operações com contratos
export interface Contract {
  contract_id: number;
  contract_type: string;
  buy_price: number;
  symbol: string;
  status: string;
  entry_spot?: number;
  exit_spot?: number;
  profit?: number;
  payout?: number;
  purchase_time: number;
  date_expiry?: number;
  barrier?: string;
  dateTime?: string;
  current_spot?: number;
  isProcessingSell?: boolean;
}

export interface ContractUpdateParams {
  stopLoss?: number | null;
  takeProfit?: number | null;
}

export type ContractPrediction = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type ContractType = 'DIGITOVER' | 'DIGITUNDER';

// Classe principal do serviço de API
class DerivApiService {
  private ws: WebSocket | null = null;
  private authorized: boolean = false;
  private token: string = '';
  private requestId: number = 1;
  private callbacks: Map<number, (response: any) => void> = new Map();
  
  // Eventos
  private tickListeners: Array<(data: any) => void> = [];
  private contractUpdateListeners: Array<(contract: Contract) => void> = [];
  private balanceUpdateListeners: Array<(balance: any) => void> = [];
  private connectionListeners: Array<(connected: boolean) => void> = [];
  
  /**
   * Inicializa a conexão com a API da Deriv
   * @param token Token de autorização opcional
   */
  public async connect(token?: string): Promise<boolean> {
    // Forçar fechamento da conexão anterior para garantir uma conexão limpa
    if (this.ws) {
      try {
        console.log('[DERIV_API] Fechando conexão WebSocket existente...');
        this.ws.onclose = null; // Remover handler para evitar reconexão automática
        this.ws.close();
        this.ws = null;
        this.authorized = false; // Resetar estado de autorização
      } catch (e) {
        console.error('[DERIV_API] Erro ao fechar conexão:', e);
      }
    }
    
    // Se token fornecido, sempre atualizá-lo
    if (token) {
      console.log('[DERIV_API] Token fornecido explicitamente, atualizando...');
      this.token = token;
      // Salvar no localStorage para uso futuro
      localStorage.setItem('deriv_oauth_token', token);
    } else {
      // Se não foi fornecido, tentar usar o do localStorage
      const storedToken = localStorage.getItem('deriv_oauth_token');
      if (storedToken) {
        console.log('[DERIV_API] Usando token OAuth do localStorage');
        token = storedToken;
        this.token = storedToken;
      }
    }
    
    try {
      return new Promise((resolve) => {
        console.log('[DERIV_API] Conectando ao WebSocket da Deriv...');
        this.ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089'); // Usando o app_id padrão
        
        // Configurar timeout para conexão
        const connectionTimeout = setTimeout(() => {
          console.error('[DERIV_API] Timeout na conexão WebSocket');
          if (this.ws) {
            this.ws.close();
            this.ws = null;
          }
          resolve(false);
        }, 10000); // 10 segundos de timeout
        
        this.ws.onopen = async () => {
          console.log('[DERIV_API] Conexão estabelecida com a API Deriv');
          clearTimeout(connectionTimeout); // Limpar timeout
          this.notifyConnectionListeners(true);
          
          if (token) {
            console.log('[DERIV_API] Autorizando com token:', token.substring(0, 10) + '...');
            this.token = token;
            const authorized = await this.authorize(token);
            console.log('[DERIV_API] Autorização ' + (authorized ? 'bem-sucedida' : 'falhou'));
            resolve(authorized);
          } else {
            console.log('[DERIV_API] Sem token para autorização, usando apenas para dados');
            resolve(true);
          }
        };
        
        this.ws.onmessage = (msg) => {
          try {
            const data = JSON.parse(msg.data);
            
            // Verificar resposta de autorização
            if (data.msg_type === 'authorize') {
              this.authorized = true;
              console.log('Autorização bem-sucedida na API Deriv');
            }
            
            // Processar atualizações de ticks
            if (data.msg_type === 'tick') {
              this.notifyTickListeners(data);
            }
            
            // Processar atualizações de balanço
            if (data.msg_type === 'balance') {
              this.notifyBalanceListeners(data.balance);
            }
            
            // Processar callbacks de requisições específicas
            if (data.req_id && this.callbacks.has(data.req_id)) {
              const callback = this.callbacks.get(data.req_id);
              if (callback) {
                callback(data);
                this.callbacks.delete(data.req_id);
              }
            }
          } catch (error) {
            console.error('Erro ao processar mensagem:', error);
          }
        };
        
        this.ws.onerror = (error) => {
          console.error('Erro na conexão WebSocket:', error);
          this.notifyConnectionListeners(false);
          resolve(false);
        };
        
        this.ws.onclose = () => {
          console.log('Conexão WebSocket fechada');
          this.notifyConnectionListeners(false);
          this.authorized = false;
        };
      });
    } catch (error) {
      console.error('Erro ao conectar:', error);
      return false;
    }
  }
  
  /**
   * Autoriza a sessão usando um token
   * @param token Token de autorização da Deriv
   */
  public async authorize(token: string): Promise<boolean> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    
    // Verificar se temos tokens adicionais no localStorage
    const allTokens: string[] = [];
    const storedTokens = localStorage.getItem('deriv_all_tokens');
    
    if (storedTokens) {
      try {
        const tokenArray = JSON.parse(storedTokens);
        if (Array.isArray(tokenArray)) {
          tokenArray.forEach(t => {
            if (t !== token && allTokens.length < 25) {
              allTokens.push(t);
            }
          });
        }
      } catch (e) {
        console.error('[DERIV_API] Erro ao analisar tokens armazenados:', e);
      }
    }
    
    console.log(`[DERIV_API] Autorizando com token principal e ${allTokens.length} tokens adicionais`);
    
    return new Promise((resolve) => {
      // Usar o formato de autorização multi-token
      const authRequest: any = { 
        authorize: token,
        add_to_login_history: 1
      };
      
      // Adicionar tokens adicionais se existirem
      if (allTokens.length > 0) {
        authRequest.tokens = allTokens;
      }
      
      this.sendRequest(authRequest, (response) => {
        if (response.error) {
          console.error('[DERIV_API] Erro de autorização:', response.error.message);
          this.authorized = false;
          resolve(false);
        } else {
          console.log('[DERIV_API] Autorização bem-sucedida com detalhes da conta:', 
            response.authorize ? 
            `ID: ${response.authorize.loginid}, Tipo: ${response.authorize.is_virtual ? 'Virtual' : 'Real'}, Moeda: ${response.authorize.currency}` :
            'Sem detalhes da conta');
            
          this.authorized = true;
          this.token = token;
          
          // Armazenar tokens no localStorage
          if (!storedTokens) {
            localStorage.setItem('deriv_all_tokens', JSON.stringify([token]));
          }
          
          resolve(true);
        }
      });
    });
  }
  
  /**
   * Fecha a conexão WebSocket
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.authorized = false;
      this.notifyConnectionListeners(false);
      console.log('Desconectado da API Deriv');
    }
  }
  
  /**
   * Inscreve-se para receber ticks de um símbolo específico
   * @param symbol Símbolo para receber ticks (ex: R_100)
   */
  public subscribeTicks(symbol: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.sendRequest({
        ticks: symbol,
        subscribe: 1
      }, (response) => {
        if (response.error) {
          console.error('Erro ao inscrever-se para ticks:', response.error.message);
          resolve(false);
        } else {
          console.log(`Inscrito para ticks de ${symbol}`);
          resolve(true);
        }
      });
    });
  }
  
  /**
   * Cancela inscrição de ticks
   * @param symbol Símbolo para cancelar inscrição (ex: R_100)
   */
  public unsubscribeTicks(symbol: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.sendRequest({
        forget_all: 'ticks'
      }, (response) => {
        if (response.error) {
          console.error('Erro ao cancelar inscrição de ticks:', response.error.message);
          resolve(false);
        } else {
          console.log(`Inscrição de ticks cancelada`);
          resolve(true);
        }
      });
    });
  }
  
  /**
   * Compra um contrato
   * @param options Opções para a compra do contrato
   */
  public async buyContract(
    amount: number, 
    type: ContractType, 
    symbol: string = 'R_100', 
    duration: number = 1, 
    prediction?: ContractPrediction
  ): Promise<Contract | null> {
    // IMPORTANTE: Criar uma nova conexão exclusiva para operações comerciais
    // Esta abordagem evita conflitos com outras conexões WebSocket e garante
    // que usamos o token OAuth mais recente para compras de contratos
    
    console.log('[DERIV_API] Iniciando compra de contrato com conexão dedicada');
    const oauthToken = localStorage.getItem('deriv_oauth_token');
    
    if (!oauthToken) {
      console.error('[DERIV_API] Token OAuth não disponível para compra de contrato');
      return null;
    }
    
    // Criar nova conexão WebSocket dedicada para compra
    // Usamos o App ID real do projeto (71403) para operações
    const buySocket = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=71403');
    
    // Usando Promise para aguardar resposta da conexão
    return new Promise((resolve) => {
      // Timeout para evitar bloqueio em caso de problemas
      const timeoutId = setTimeout(() => {
        console.error('[DERIV_API] Timeout na compra de contrato');
        buySocket.close();
        resolve(null);
      }, 30000);
      
      // Quando a conexão for estabelecida
      buySocket.onopen = () => {
        console.log('[DERIV_API] Conexão dedicada para compra estabelecida');
        
        // Autorizar com token OAuth
        buySocket.send(JSON.stringify({
          authorize: oauthToken
        }));
      };
      
      // Lidar com mensagens da API
      buySocket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          console.log('[DERIV_API] Resposta da conexão de compra:', data);
          
          // Verificar autorização
          if (data.authorize) {
            console.log('[DERIV_API] Autorizado para compra com conta:', data.authorize.loginid);
            
            // Após autorização bem-sucedida, enviar solicitação de compra
            const buyRequest = {
              buy: 1,
              price: amount,
              parameters: {
                amount: amount,
                basis: 'stake',
                contract_type: type,
                currency: data.authorize.currency || 'USD',
                duration: duration,
                duration_unit: 't',
                symbol: symbol,
                ...(prediction !== undefined && { prediction: prediction })
              }
            };
            
            console.log('[DERIV_API] Enviando solicitação de compra:', buyRequest);
            buySocket.send(JSON.stringify(buyRequest));
          } 
          // Verificar resposta de compra
          else if (data.buy) {
            console.log('[DERIV_API] Contrato comprado com sucesso:', data.buy);
            clearTimeout(timeoutId);
            
            const contract: Contract = {
              contract_id: data.buy.contract_id,
              contract_type: type,
              buy_price: data.buy.buy_price,
              symbol: symbol,
              status: 'open',
              purchase_time: data.buy.purchase_time,
              payout: data.buy.payout
            };
            
            // Notificar ouvintes sobre o novo contrato
            this.notifyContractListeners(contract);
            
            // Fechar a conexão dedicada
            buySocket.close();
            
            // Resolver a promise com o contrato
            resolve(contract);
          }
          // Verificar erro
          else if (data.error) {
            console.error('[DERIV_API] Erro na compra:', data.error.message);
            clearTimeout(timeoutId);
            buySocket.close();
            resolve(null);
          }
        } catch (error) {
          console.error('[DERIV_API] Erro ao processar mensagem de compra:', error);
        }
      };
      
      // Lidar com erros de conexão
      buySocket.onerror = (error) => {
        console.error('[DERIV_API] Erro na conexão de compra:', error);
        clearTimeout(timeoutId);
        resolve(null);
      };
      
      // Lidar com fechamento de conexão
      buySocket.onclose = () => {
        console.log('[DERIV_API] Conexão de compra fechada');
        clearTimeout(timeoutId);
      };
    });
    
  }
  
  /**
   * Vende um contrato
   * @param contractId ID do contrato a ser vendido
   */
  public async sellContract(contractId: number): Promise<boolean> {
    console.log('[DERIV_API] Iniciando venda de contrato com conexão dedicada');
    const oauthToken = localStorage.getItem('deriv_oauth_token');
    
    if (!oauthToken) {
      console.error('[DERIV_API] Token OAuth não disponível para venda de contrato');
      return false;
    }
    
    // Criar nova conexão WebSocket dedicada para venda
    // Usamos o App ID real do projeto (71403) para operações
    const sellSocket = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=71403');
    
    // Usando Promise para aguardar resposta da conexão
    return new Promise((resolve) => {
      // Timeout para evitar bloqueio em caso de problemas
      const timeoutId = setTimeout(() => {
        console.error('[DERIV_API] Timeout na venda de contrato');
        sellSocket.close();
        resolve(false);
      }, 30000);
      
      // Quando a conexão for estabelecida
      sellSocket.onopen = () => {
        console.log('[DERIV_API] Conexão dedicada para venda estabelecida');
        
        // Autorizar com token OAuth
        sellSocket.send(JSON.stringify({
          authorize: oauthToken
        }));
      };
      
      // Lidar com mensagens da API
      sellSocket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          console.log('[DERIV_API] Resposta da conexão de venda:', data);
          
          // Verificar autorização
          if (data.authorize) {
            console.log('[DERIV_API] Autorizado para venda com conta:', data.authorize.loginid);
            
            // Após autorização bem-sucedida, enviar solicitação de venda
            const sellRequest = {
              sell: contractId,
              price: 0 // Vender pelo preço de mercado
            };
            
            console.log('[DERIV_API] Enviando solicitação de venda:', sellRequest);
            sellSocket.send(JSON.stringify(sellRequest));
          } 
          // Verificar resposta de venda
          else if (data.sell) {
            console.log('[DERIV_API] Contrato vendido com sucesso:', data.sell);
            clearTimeout(timeoutId);
            
            // Fechar a conexão dedicada
            sellSocket.close();
            
            // Resolver a promise
            resolve(true);
          }
          // Verificar erro
          else if (data.error) {
            console.error('[DERIV_API] Erro na venda:', data.error.message);
            clearTimeout(timeoutId);
            sellSocket.close();
            resolve(false);
          }
        } catch (error) {
          console.error('[DERIV_API] Erro ao processar mensagem de venda:', error);
        }
      };
      
      // Lidar com erros de conexão
      sellSocket.onerror = (error) => {
        console.error('[DERIV_API] Erro na conexão de venda:', error);
        clearTimeout(timeoutId);
        resolve(false);
      };
      
      // Lidar com fechamento de conexão
      sellSocket.onclose = () => {
        console.log('[DERIV_API] Conexão de venda fechada');
        clearTimeout(timeoutId);
      };
    });
  }
  
  /**
   * Cancela um contrato
   * @param contractId ID do contrato a ser cancelado
   */
  public async cancelContract(contractId: number): Promise<boolean> {
    if (!this.authorized) {
      console.error('Não autorizado. Faça login primeiro.');
      return false;
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        cancel: contractId
      }, (response) => {
        if (response.error) {
          console.error('Erro ao cancelar contrato:', response.error.message);
          resolve(false);
        } else if (response.cancel) {
          console.log('Contrato cancelado com sucesso:', contractId);
          resolve(true);
        } else {
          console.error('Resposta inesperada ao cancelar contrato:', response);
          resolve(false);
        }
      });
    });
  }
  
  /**
   * Vende todos os contratos expirados
   */
  public async sellExpiredContracts(): Promise<number> {
    if (!this.authorized) {
      console.error('Não autorizado. Faça login primeiro.');
      return 0;
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        sell_expired: 1
      }, (response) => {
        if (response.error) {
          console.error('Erro ao vender contratos expirados:', response.error.message);
          resolve(0);
        } else if (response.sell_expired) {
          console.log('Contratos expirados vendidos:', response.sell_expired.count);
          resolve(response.sell_expired.count);
        } else {
          console.error('Resposta inesperada ao vender contratos expirados:', response);
          resolve(0);
        }
      });
    });
  }
  
  /**
   * Atualiza as condições de um contrato (stop loss/take profit)
   * @param contractId ID do contrato a ser atualizado
   * @param params Parâmetros para atualização
   */
  public async updateContract(contractId: number, params: ContractUpdateParams): Promise<boolean> {
    if (!this.authorized) {
      console.error('Não autorizado. Faça login primeiro.');
      return false;
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        contract_update: 1,
        contract_id: contractId,
        limit_order: {
          stop_loss: params.stopLoss,
          take_profit: params.takeProfit
        }
      }, (response) => {
        if (response.error) {
          console.error('Erro ao atualizar contrato:', response.error.message);
          resolve(false);
        } else if (response.contract_update) {
          console.log('Contrato atualizado com sucesso:', contractId);
          resolve(true);
        } else {
          console.error('Resposta inesperada ao atualizar contrato:', response);
          resolve(false);
        }
      });
    });
  }
  
  /**
   * Obtém o histórico de atualizações de um contrato
   * @param contractId ID do contrato
   */
  public async getContractUpdateHistory(contractId: number): Promise<any[]> {
    if (!this.authorized) {
      console.error('Não autorizado. Faça login primeiro.');
      return [];
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        contract_update_history: 1,
        contract_id: contractId
      }, (response) => {
        if (response.error) {
          console.error('Erro ao obter histórico de contrato:', response.error.message);
          resolve([]);
        } else if (response.contract_update_history) {
          resolve(response.contract_update_history);
        } else {
          console.error('Resposta inesperada ao obter histórico de contrato:', response);
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Obtém a tabela de lucros
   * @param params Parâmetros para filtrar a tabela de lucros
   */
  public async getProfitTable(
    limit: number = 50, 
    offset: number = 0, 
    dateFrom?: string, 
    dateTo?: string
  ): Promise<any[]> {
    if (!this.authorized) {
      console.error('Não autorizado. Faça login primeiro.');
      return [];
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        profit_table: 1,
        description: 1,
        limit,
        offset,
        ...(dateFrom && { date_from: dateFrom }),
        ...(dateTo && { date_to: dateTo })
      }, (response) => {
        if (response.error) {
          console.error('Erro ao obter tabela de lucros:', response.error.message);
          resolve([]);
        } else if (response.profit_table && response.profit_table.transactions) {
          resolve(response.profit_table.transactions);
        } else {
          console.error('Resposta inesperada ao obter tabela de lucros:', response);
          resolve([]);
        }
      });
    });
  }
  
  /**
   * Obtém informações do saldo da conta
   */
  public async getBalance(): Promise<any> {
    // IMPORTANTE: Verificar se temos o token OAuth mais recente antes de qualquer operação
    const oauthToken = localStorage.getItem('deriv_oauth_token');
    if (oauthToken && oauthToken !== this.token) {
      console.log('[DERIV_API] Token OAuth mudou, reconectando para atualização de saldo...');
      // Reconectar com o novo token OAuth
      await this.connect(oauthToken);
    }
    
    if (!this.authorized) {
      console.error('[DERIV_API] Não autorizado para obter saldo. Verificando OAuth...');
      // Nova tentativa usando token OAuth explicitamente  
      const oauthToken = localStorage.getItem('deriv_oauth_token');
      if (oauthToken) {
        console.log('[DERIV_API] Tentando autorizar com token OAuth para obter saldo');
        const authorized = await this.authorize(oauthToken);
        if (!authorized) {
          console.error('[DERIV_API] Falha na autorização com token OAuth');
          return null;
        }
      } else {
        console.error('[DERIV_API] Token OAuth não disponível para obter saldo');
        return null;
      }
    }
    
    return new Promise((resolve) => {
      // Log explícito para depuração
      console.log('[DERIV_API] Solicitando saldo com token:', this.token ? this.token.substring(0, 10) + '...' : 'NENHUM');
      console.log('[DERIV_API] Autorizado:', this.authorized);
      
      this.sendRequest({
        balance: 1,
        subscribe: 1
      }, (response) => {
        if (response.error) {
          console.error('[DERIV_API] Erro ao obter saldo:', response.error.message);
          // Se ocorrer um erro, tentar reconectar com o token OAuth e tentar novamente
          const oauthToken = localStorage.getItem('deriv_oauth_token');
          if (oauthToken) {
            console.log('[DERIV_API] Tentando reconectar com novo token OAuth após erro de saldo');
            this.connect(oauthToken).then(success => {
              if (success) {
                console.log('[DERIV_API] Reconexão bem sucedida, solicitando saldo novamente');
                this.getBalance().then(balance => resolve(balance)).catch(() => resolve(null));
              } else {
                resolve(null);
              }
            });
          } else {
            resolve(null);
          }
        } else if (response.balance) {
          console.log('[DERIV_API] Saldo recebido com sucesso:', response.balance);
          this.notifyBalanceListeners(response.balance);
          resolve(response.balance);
        } else {
          console.error('[DERIV_API] Resposta inesperada ao obter saldo:', response);
          resolve(null);
        }
      });
    });
  }
  
  /**
   * Método auxiliar para enviar requisições para a API
   * @param request Objeto de requisição
   * @param callback Função de callback para resposta
   */
  private sendRequest(request: any, callback?: (response: any) => void): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket não está conectado');
      return;
    }
    
    const reqId = this.requestId++;
    const message = { ...request, req_id: reqId };
    
    if (callback) {
      this.callbacks.set(reqId, callback);
    }
    
    this.ws.send(JSON.stringify(message));
  }
  
  // Métodos para gerenciar ouvintes de eventos
  public onTick(listener: (data: any) => void): void {
    this.tickListeners.push(listener);
  }
  
  public offTick(listener: (data: any) => void): void {
    this.tickListeners = this.tickListeners.filter(l => l !== listener);
  }
  
  public onContractUpdate(listener: (contract: Contract) => void): void {
    this.contractUpdateListeners.push(listener);
  }
  
  public offContractUpdate(listener: (contract: Contract) => void): void {
    this.contractUpdateListeners = this.contractUpdateListeners.filter(l => l !== listener);
  }
  
  public onBalanceUpdate(listener: (balance: any) => void): void {
    this.balanceUpdateListeners.push(listener);
  }
  
  public offBalanceUpdate(listener: (balance: any) => void): void {
    this.balanceUpdateListeners = this.balanceUpdateListeners.filter(l => l !== listener);
  }
  
  public onConnectionChange(listener: (connected: boolean) => void): void {
    this.connectionListeners.push(listener);
  }
  
  public offConnectionChange(listener: (connected: boolean) => void): void {
    this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
  }
  
  // Métodos para notificar eventos
  private notifyTickListeners(data: any): void {
    this.tickListeners.forEach(listener => listener(data));
  }
  
  private notifyContractListeners(contract: Contract): void {
    this.contractUpdateListeners.forEach(listener => listener(contract));
  }
  
  private notifyBalanceListeners(balance: any): void {
    this.balanceUpdateListeners.forEach(listener => listener(balance));
  }
  
  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach(listener => listener(connected));
  }
}

// Exporta uma instância única do serviço
export const derivApiService = new DerivApiService();
export default derivApiService;