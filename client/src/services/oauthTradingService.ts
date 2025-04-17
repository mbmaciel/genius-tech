/**
 * Serviço para operações de trading usando OAuth
 * 
 * Este serviço gerencia a autenticação OAuth e operações de trading diretamente com a API Deriv
 */

interface TradingEvent {
  type: string;
  [key: string]: any;
}

interface TradingSettings {
  entryValue: string | number;
  profitTarget?: string | number;
  lossLimit?: string | number;
  martingaleFactor?: number;
  contractType?: string;
  prediction?: number;
}

class OAuthTradingService {
  private webSocket: WebSocket | null = null;
  private token: string | null = null;
  private isRunning: boolean = false;
  private eventListeners: Array<(event: TradingEvent) => void> = [];
  private currentContractId: string | number | null = null;
  private settings: TradingSettings = {
    entryValue: 0.35,
    profitTarget: 20,
    lossLimit: 20,
    martingaleFactor: 1.5,
    contractType: 'DIGITOVER',
    prediction: 5
  };
  private activeStrategy: string = '';
  private operationTimeout: any = null;
  
  constructor() {
    console.log('[OAUTH_TRADING] Inicializando serviço de trading com OAuth');
    // Tentar obter token do localStorage
    this.token = localStorage.getItem('deriv_oauth_token');
    if (this.token) {
      console.log('[OAUTH_TRADING] Token OAuth encontrado no localStorage');
    }
  }
  
  /**
   * Registra um WebSocket existente para uso nas operações
   */
  registerWebSocket(ws: WebSocket): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_TRADING] Erro: WebSocket não está conectado');
      return;
    }
    
    console.log('[OAUTH_TRADING] Registrando WebSocket para operações');
    this.webSocket = ws;
    
    // Configurar listener de mensagens
    this.setupMessageListener(ws);
  }
  
  /**
   * Configura listener para mensagens recebidas pelo WebSocket
   */
  private setupMessageListener(ws: WebSocket): void {
    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Resposta de autorização
        if (data.msg_type === 'authorize') {
          console.log('[OAUTH_TRADING] Autorização bem-sucedida:', data.authorize?.loginid);
        }
        
        // Resposta de compra
        if (data.msg_type === 'buy') {
          console.log('[OAUTH_TRADING] Resposta de compra recebida:', data);
          
          if (data.error) {
            // Erro na compra
            console.error('[OAUTH_TRADING] Erro ao comprar contrato:', data.error.message);
            this.notifyListeners({
              type: 'error',
              message: data.error.message || 'Erro ao executar a compra'
            });
          } else if (data.buy) {
            // Compra bem-sucedida
            const contractId = data.buy.contract_id;
            const buyPrice = data.buy.buy_price;
            
            console.log(`[OAUTH_TRADING] Contrato comprado: ID ${contractId}, Valor $${buyPrice}`);
            this.currentContractId = contractId;
            
            // Notificar sobre compra bem-sucedida
            this.notifyListeners({
              type: 'contract_purchased',
              contract_id: contractId,
              buy_price: buyPrice
            });
            
            // Monitorar contrato
            this.monitorContract(contractId);
          }
        }
        
        // Atualização de contrato aberto
        if (data.msg_type === 'proposal_open_contract') {
          const contract = data.proposal_open_contract;
          
          if (contract && contract.contract_id === this.currentContractId) {
            // Verificar se o contrato foi encerrado
            if (contract.is_sold === 1) {
              console.log('[OAUTH_TRADING] Contrato encerrado:', contract);
              
              // Calcular resultado
              const isWin = contract.profit >= 0;
              const profit = parseFloat(contract.profit);
              
              // Notificar sobre o resultado
              this.notifyListeners({
                type: 'contract_finished',
                contract_id: contract.contract_id,
                profit: profit,
                is_win: isWin
              });
              
              this.currentContractId = null;
              
              // Se o bot ainda estiver em execução, programar próxima operação
              if (this.isRunning) {
                console.log('[OAUTH_TRADING] Agendando próxima operação...');
                this.scheduleNextOperation();
              }
            }
          }
        }
      } catch (error) {
        console.error('[OAUTH_TRADING] Erro ao processar mensagem do WebSocket:', error);
      }
    };
    
    // Adicionar o listener ao WebSocket
    ws.addEventListener('message', messageHandler);
  }
  
  /**
   * Inicia o serviço de trading
   */
  async start(): Promise<boolean> {
    console.log('[OAUTH_TRADING] Iniciando serviço de trading');
    
    // Verificar se temos o token OAuth
    if (!this.token) {
      console.error('[OAUTH_TRADING] Token OAuth não encontrado');
      this.notifyListeners({
        type: 'error',
        message: 'Token OAuth não encontrado. Faça login novamente.'
      });
      return false;
    }
    
    // Verificar se temos um WebSocket disponível
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_TRADING] WebSocket não está disponível');
      this.notifyListeners({
        type: 'error',
        message: 'Conexão com o servidor não está disponível'
      });
      return false;
    }
    
    // Atualizar estado
    this.isRunning = true;
    
    // Autorizar usando o token (mesmo que já esteja autorizado, isso atualiza a sessão)
    this.webSocket.send(JSON.stringify({
      authorize: this.token
    }));
    
    console.log('[OAUTH_TRADING] Sessão autorizada com token OAuth');
    
    // Agendar a primeira operação com um pequeno atraso
    this.scheduleNextOperation(2000);
    
    return true;
  }
  
  /**
   * Para o serviço de trading
   */
  stop(): void {
    console.log('[OAUTH_TRADING] Parando serviço de trading');
    this.isRunning = false;
    
    // Limpar timeout pendente se houver
    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
      this.operationTimeout = null;
    }
    
    this.notifyListeners({
      type: 'bot_stopped'
    });
  }
  
  /**
   * Agenda a próxima operação
   */
  private scheduleNextOperation(delay: number = 5000): void {
    // Limpar timeout pendente se houver
    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
    }
    
    console.log(`[OAUTH_TRADING] Próxima operação agendada em ${delay}ms`);
    
    // Agendar próxima operação
    this.operationTimeout = setTimeout(() => {
      // Verificar se ainda estamos em execução
      if (!this.isRunning) return;
      
      // Executar operação
      this.executeOperation();
    }, delay);
  }
  
  /**
   * Executa uma operação de trading
   */
  private async executeOperation(): Promise<void> {
    console.log('[OAUTH_TRADING] Executando operação de trading');
    
    // Verificar se estamos rodando
    if (!this.isRunning) {
      console.log('[OAUTH_TRADING] Serviço não está em execução');
      return;
    }
    
    // Verificar se já existe um contrato em andamento
    if (this.currentContractId) {
      console.log('[OAUTH_TRADING] Já existe um contrato em andamento');
      return;
    }
    
    // Verificar conexão
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_TRADING] WebSocket não está disponível');
      this.notifyListeners({
        type: 'error',
        message: 'Conexão com o servidor não está disponível'
      });
      return;
    }
    
    try {
      // Determinar o tipo de contrato com base na estratégia
      let contractType = 'DIGITOVER';
      
      if (this.activeStrategy.includes('under')) {
        contractType = 'DIGITUNDER';
      } else if (this.activeStrategy.includes('over')) {
        contractType = 'DIGITOVER';
      }
      
      // Atualizar tipo de contrato nas configurações
      this.settings.contractType = contractType;
      
      // Obter parâmetros para a solicitação
      const amount = parseFloat(this.settings.entryValue.toString());
      const prediction = this.settings.prediction || 5;
      
      // Criar solicitação de compra
      const buyRequest = {
        buy: 1,
        price: amount,
        parameters: {
          contract_type: contractType,
          currency: "USD",
          duration: 5,
          duration_unit: "t",
          symbol: "R_100",
          barrier: prediction.toString()
        }
      };
      
      console.log('[OAUTH_TRADING] Enviando solicitação de compra:', buyRequest);
      
      // Enviar solicitação
      this.webSocket.send(JSON.stringify(buyRequest));
      
      // Notificar sobre o início da operação
      this.notifyListeners({
        type: 'operation_started',
        contract_type: contractType,
        amount: amount,
        prediction: prediction
      });
    } catch (error) {
      console.error('[OAUTH_TRADING] Erro ao executar operação:', error);
      this.notifyListeners({
        type: 'error',
        message: 'Erro ao executar operação'
      });
      
      // Agendar próxima operação mesmo com erro
      this.scheduleNextOperation();
    }
  }
  
  /**
   * Monitora um contrato específico
   */
  private monitorContract(contractId: number | string): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error('[OAUTH_TRADING] WebSocket não está pronto para monitorar contrato');
      return;
    }
    
    // Inscrever-se para atualizações do contrato
    const subscribeRequest = {
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    };
    
    try {
      this.webSocket.send(JSON.stringify(subscribeRequest));
      console.log(`[OAUTH_TRADING] Monitorando contrato ID ${contractId}`);
    } catch (error) {
      console.error('[OAUTH_TRADING] Erro ao iniciar monitoramento do contrato:', error);
    }
  }
  
  /**
   * Define as configurações do serviço
   */
  setSettings(settings: Partial<TradingSettings>): void {
    this.settings = { ...this.settings, ...settings };
    console.log('[OAUTH_TRADING] Configurações atualizadas:', this.settings);
  }
  
  /**
   * Define a estratégia ativa
   */
  setActiveStrategy(strategy: string): void {
    this.activeStrategy = strategy;
    console.log('[OAUTH_TRADING] Estratégia definida:', strategy);
  }
  
  /**
   * Adiciona um listener para eventos
   */
  addEventListener(listener: (event: TradingEvent) => void): void {
    this.eventListeners.push(listener);
  }
  
  /**
   * Remove um listener de eventos
   */
  removeEventListener(listener: (event: TradingEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }
  
  /**
   * Notifica todos os listeners sobre um evento
   */
  private notifyListeners(event: TradingEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[OAUTH_TRADING] Erro ao notificar listener:', error);
      }
    });
  }
}

// Exportar uma instância única do serviço
export const oauthTradingService = new OAuthTradingService();