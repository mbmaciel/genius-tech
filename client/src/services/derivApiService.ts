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
    
    return new Promise((resolve) => {
      this.sendRequest({ authorize: token }, (response) => {
        if (response.error) {
          console.error('Erro de autorização:', response.error.message);
          this.authorized = false;
          resolve(false);
        } else {
          this.authorized = true;
          this.token = token;
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
    // IMPORTANTE: Verificar se temos o token OAuth mais recente antes de operar
    const oauthToken = localStorage.getItem('deriv_oauth_token');
    if (oauthToken && oauthToken !== this.token) {
      console.log('[DERIV_API] Token OAuth mudou, reconectando para operações...');
      // Reconectar com o novo token OAuth
      await this.connect(oauthToken);
    }
    
    if (!this.authorized) {
      console.error('[DERIV_API] Não autorizado para comprar contratos. Verificando OAuth...');
      // Nova tentativa usando token OAuth explicitamente
      const oauthToken = localStorage.getItem('deriv_oauth_token');
      if (oauthToken) {
        console.log('[DERIV_API] Tentando autorizar com token OAuth para compra de contrato');
        const authorized = await this.authorize(oauthToken);
        if (!authorized) {
          console.error('[DERIV_API] Falha na autorização com token OAuth');
          return null;
        }
      } else {
        console.error('[DERIV_API] Token OAuth não disponível');
        return null;
      }
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        buy: 1,
        price: amount,
        parameters: {
          amount: amount,
          basis: 'stake',
          contract_type: type,
          currency: 'USD',
          duration: duration,
          duration_unit: 't',
          symbol: symbol,
          ...(prediction !== undefined && { prediction: prediction })
        }
      }, (response) => {
        if (response.error) {
          console.error('Erro ao comprar contrato:', response.error.message);
          resolve(null);
        } else if (response.buy) {
          console.log('Contrato comprado com sucesso:', response.buy.contract_id);
          
          const contract: Contract = {
            contract_id: response.buy.contract_id,
            contract_type: type,
            buy_price: response.buy.buy_price,
            symbol: symbol,
            status: 'open',
            purchase_time: response.buy.purchase_time,
            payout: response.buy.payout
          };
          
          this.notifyContractListeners(contract);
          resolve(contract);
        } else {
          console.error('Resposta inesperada ao comprar contrato:', response);
          resolve(null);
        }
      });
    });
  }
  
  /**
   * Vende um contrato
   * @param contractId ID do contrato a ser vendido
   */
  public async sellContract(contractId: number): Promise<boolean> {
    // IMPORTANTE: Verificar se temos o token OAuth mais recente antes de operar
    const oauthToken = localStorage.getItem('deriv_oauth_token');
    if (oauthToken && oauthToken !== this.token) {
      console.log('[DERIV_API] Token OAuth mudou, reconectando para vender contrato...');
      // Reconectar com o novo token OAuth
      await this.connect(oauthToken);
    }
    
    if (!this.authorized) {
      console.error('[DERIV_API] Não autorizado para vender contrato. Verificando OAuth...');
      // Nova tentativa usando token OAuth explicitamente
      const oauthToken = localStorage.getItem('deriv_oauth_token');
      if (oauthToken) {
        console.log('[DERIV_API] Tentando autorizar com token OAuth para vender contrato');
        const authorized = await this.authorize(oauthToken);
        if (!authorized) {
          console.error('[DERIV_API] Falha na autorização com token OAuth');
          return false;
        }
      } else {
        console.error('[DERIV_API] Token OAuth não disponível');
        return false;
      }
    }
    
    return new Promise((resolve) => {
      this.sendRequest({
        sell: contractId,
        price: 0 // Vender pelo preço de mercado
      }, (response) => {
        if (response.error) {
          console.error('Erro ao vender contrato:', response.error.message);
          resolve(false);
        } else if (response.sell) {
          console.log('Contrato vendido com sucesso:', contractId);
          resolve(true);
        } else {
          console.error('Resposta inesperada ao vender contrato:', response);
          resolve(false);
        }
      });
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
      this.sendRequest({
        balance: 1,
        subscribe: 1
      }, (response) => {
        if (response.error) {
          console.error('Erro ao obter saldo:', response.error.message);
          resolve(null);
        } else if (response.balance) {
          this.notifyBalanceListeners(response.balance);
          resolve(response.balance);
        } else {
          console.error('Resposta inesperada ao obter saldo:', response);
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