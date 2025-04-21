/**
 * Serviço para trading automatizado com API Deriv
 * Versão 2023.5 - EXCLUSIVAMENTE para operações reais (sem simulação)
 * Utiliza o token OAuth do cliente para operações
 * Usa a mesma conexão WebSocket que recebe os ticks do mercado
 */

export type BotStatus = 'idle' | 'running' | 'paused' | 'error';
export type ContractType = 'DIGITOVER' | 'DIGITUNDER' | 'CALL' | 'PUT';
export type ContractPrediction = number;

export interface BotSettings {
  entryValue: number;
  virtualLoss?: number;
  profitTarget: number;
  lossLimit: number;
  martingaleFactor: number;
  prediction?: ContractPrediction;
  contractType?: ContractType;
  stopLoss?: number | null;
  takeProfit?: number | null;
}

export interface OperationStats {
  wins: number;
  losses: number;
  totalProfit: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface Contract {
  contract_id: number | string;
  contract_type: string;
  buy_price: number;
  symbol: string;
  status: string;
  profit?: number;
  payout?: number;
  purchase_time: number;
  date_expiry?: number;
}

type BotEvent = { 
  type: string; 
  [key: string]: any 
};

class SimpleBotService {
  private token: string | null = null;
  private status: BotStatus = 'idle';
  private currentContractId: number | null = null;
  private activeStrategyId: string | null = null;
  private settings: BotSettings = {
    entryValue: 1.0, // CORREÇÃO: Valor default mais visível
    profitTarget: 10,
    lossLimit: 20,
    martingaleFactor: 1.5
  };
  private eventListeners: ((event: BotEvent) => void)[] = [];
  private operationTimer: NodeJS.Timeout | null = null;
  
  // Estatísticas simplificadas
  private stats: OperationStats = {
    wins: 0,
    losses: 0,
    totalProfit: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  };
  
  constructor() {
    console.log('[SIMPLEBOT] Inicializando serviço de bot de trading EXCLUSIVAMENTE real');
    
    // Configurar eventos da conexão WebSocket dedicada para trading
    tradingWebSocket.setEvents({
      onStatusChange: (status) => {
        console.log(`[SIMPLEBOT] Status da conexão de trading atualizado: ${status}`);
      },
      onError: (error) => {
        console.error('[SIMPLEBOT] Erro na conexão de trading:', error);
        this.emitEvent({
          type: 'error',
          message: 'Erro na conexão com a API de trading'
        });
      },
      onContractUpdate: (contract) => {
        console.log('[SIMPLEBOT] Atualização de contrato recebida:', contract);
        // Se o contrato estiver finalizado, processar o resultado
        if (contract.status !== 'open' && contract.contract_id) {
          this.processContractCompletion(contract);
        }
      },
      onBalanceUpdate: (balance) => {
        console.log('[SIMPLEBOT] Atualização de saldo recebida:', balance);
        this.emitEvent({
          type: 'balance_updated',
          balance: balance
        });
      }
    });
    
    // Verificar se temos um token OAuth armazenado
    const token = localStorage.getItem('deriv_oauth_token');
    if (token) {
      console.log('[SIMPLEBOT] Token OAuth encontrado para trading, verificando validade...');
      
      // Testar o token antes de tentar usá-lo
      tradingWebSocket.testToken(token)
        .then(result => {
          if (result.isValid) {
            console.log(`[SIMPLEBOT] Token OAuth é válido para a conta ${result.loginid}`);
            this.token = token;
            
            // Pré-conectar o WebSocket dedicado para trading
            tradingWebSocket.connect()
              .then(() => {
                console.log('[SIMPLEBOT] Conexão de trading estabelecida, autorizando...');
                return tradingWebSocket.authorize(token);
              })
              .then(response => {
                console.log('[SIMPLEBOT] Conexão de trading autorizada com sucesso:', 
                  response.authorize?.loginid);
              })
              .catch(err => {
                console.error('[SIMPLEBOT] Erro ao conectar WebSocket de trading:', err);
              });
          } else {
            console.error('[SIMPLEBOT] Token OAuth inválido:', result.error);
          }
        })
        .catch(err => {
          console.error('[SIMPLEBOT] Erro ao testar token OAuth:', err);
        });
    } else {
      console.warn('[SIMPLEBOT] Token OAuth não encontrado, operações reais estarão indisponíveis');
    }
  }
  
  /**
   * Define o token de autenticação OAuth para operações reais
   * @param token Token OAuth da Deriv
   */
  public setToken(token: string): void {
    console.log('[SIMPLEBOT] Definindo novo token OAuth para operações');
    this.token = token;
    
    // Salvar o token no localStorage para persistência
    localStorage.setItem('deriv_oauth_token', token);
    
    // Verificar se o token é válido
    this.validateToken(token);
  }
  
  /**
   * Valida um token OAuth com a API Deriv
   * @param token Token OAuth para validar
   */
  private async validateToken(token: string): Promise<boolean> {
    try {
      const result = await tradingWebSocket.testToken(token);
      
      if (result.isValid) {
        console.log(`[SIMPLEBOT] Token OAuth válido para conta: ${result.loginid}`);
        this.token = token;
        return true;
      } else {
        console.error('[SIMPLEBOT] Token OAuth inválido:', result.error);
        this.token = null;
        return false;
      }
    } catch (error) {
      console.error('[SIMPLEBOT] Erro ao validar token OAuth:', error);
      this.token = null;
      return false;
    }
  }
  
  /**
   * Obtém o token OAuth atual
   */
  public getToken(): string | null {
    return this.token;
  }
  
  /**
   * Processa a conclusão de um contrato
   */
  private processContractCompletion(contract: any): void {
    // Verificar se é um contrato válido
    if (!contract || !contract.contract_id) return;
    
    // Determinar resultado
    const isWin = contract.status === 'won';
    const profit = parseFloat(contract.profit || '0');
    
    console.log(`[SIMPLEBOT] Contrato ${contract.contract_id} finalizado: ${isWin ? 'GANHO' : 'PERDA'} de ${profit.toFixed(2)}`);
    
    // Atualizar estatísticas
    if (isWin) {
      this.stats.wins++;
      this.stats.consecutiveWins++;
      this.stats.consecutiveLosses = 0;
    } else {
      this.stats.losses++;
      this.stats.consecutiveLosses++;
      this.stats.consecutiveWins = 0;
    }
    
    this.stats.totalProfit += profit;
    
    // Notificar resultado
    this.emitEvent({
      type: 'operation_finished',
      result: isWin ? 'win' : 'loss',
      profit,
      contract: {
        contract_id: contract.contract_id,
        contract_type: contract.contract_type,
        buy_price: parseFloat(contract.buy_price),
        symbol: contract.underlying,
        status: contract.status,
        profit: profit,
        entry_spot: contract.entry_spot,
        exit_spot: contract.exit_spot,
        barrier: contract.barrier,
        purchase_time: contract.purchase_time,
        date_expiry: contract.date_expiry
      }
    });
    
    // Atualizar estatísticas
    this.emitEvent({ 
      type: 'stats_updated', 
      stats: { ...this.stats } 
    });
    
    // Agendar próxima operação se o bot estiver rodando
    if (this.status === 'running') {
      this.scheduleNextOperation();
    }
  }
  
  /**
   * Define a estratégia ativa
   */
  public setActiveStrategy(strategyId: string): boolean {
    console.log(`[SIMPLEBOT] Definindo estratégia: ${strategyId}`);
    this.activeStrategyId = strategyId;
    
    // Configurar tipo de contrato baseado no nome
    if (strategyId.includes('under')) {
      this.settings.contractType = 'DIGITUNDER';
    } else {
      this.settings.contractType = 'DIGITOVER';
    }
    
    this.settings.prediction = 5; // Valor padrão para previsão
    
    return true;
  }
  
  /**
   * Define configurações do bot
   */
  public setSettings(settings: Partial<BotSettings>): void {
    this.settings = { ...this.settings, ...settings };
    console.log(`[SIMPLEBOT] Atualizou configurações:`, this.settings);
  }
  
  /**
   * Agenda a próxima operação
   */
  private scheduleNextOperation(): void {
    if (this.status !== 'running') return;
    
    // Limpar qualquer timer anterior
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
    }
    
    // Tempo de espera entre operações (3-7 segundos)
    const delay = 5000;
    
    console.log(`[SIMPLEBOT] Próxima operação agendada para ${delay/1000}s`);
    
    this.operationTimer = setTimeout(() => {
      if (this.status === 'running') {
        this.executeRealOperation();
      }
    }, delay);
  }
  
  /**
   * Inicia a execução do bot (APENAS operações reais, sem fallback para simulação)
   */
  public async start(): Promise<boolean> {
    console.log('[SIMPLEBOT] Método start() chamado - APENAS OPERAÇÕES REAIS (sem simulação)');
    
    if (this.status === 'running') {
      console.log('[SIMPLEBOT] Bot já está rodando, ignorando chamada');
      return true;
    }
    
    if (!this.activeStrategyId) {
      console.error('[SIMPLEBOT] Nenhuma estratégia selecionada');
      return false;
    }
    
    try {
      // Atualizar status do bot
      console.log('[SIMPLEBOT] Atualizando status para running');
      this.status = 'running';
      this.emitEvent({ type: 'status_change', status: this.status });
      
      // Limpar qualquer timer anterior
      if (this.operationTimer) {
        clearTimeout(this.operationTimer);
        this.operationTimer = null;
      }
      
      // Verificar se temos token OAuth
      if (!this.token) {
        console.error('[SIMPLEBOT] Não foi possível iniciar: Token OAuth não encontrado');
        this.emitEvent({ 
          type: 'error', 
          message: 'Token OAuth não encontrado. Faça login com sua conta Deriv.' 
        });
        this.status = 'error';
        return false;
      }
      
      // Iniciar operação real
      await this.executeRealOperation();
      return true;
    } catch (error) {
      console.error('[SIMPLEBOT] Erro ao iniciar bot:', error);
      this.status = 'error';
      this.emitEvent({ type: 'status_change', status: 'error' });
      this.emitEvent({ type: 'error', message: 'Erro ao iniciar bot' });
      return false;
    }
  }
  
  /**
   * Para a execução do bot
   */
  public stop(): void {
    console.log('[SIMPLEBOT] Método stop() chamado');
    
    // Atualizar status
    this.status = 'idle';
    this.emitEvent({ type: 'status_change', status: this.status });
    
    // Limpar timers
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }
  }
  
  /**
   * Adiciona um ouvinte para eventos do bot
   */
  public addEventListener(listener: (event: BotEvent) => void): void {
    this.eventListeners.push(listener);
  }
  
  /**
   * Remove um ouvinte de eventos
   */
  public removeEventListener(listener: (event: BotEvent) => void): void {
    this.eventListeners = this.eventListeners.filter(l => l !== listener);
  }
  
  /**
   * Emite um evento para todos os ouvintes
   */
  private emitEvent(event: BotEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SIMPLEBOT] Erro ao notificar ouvinte:', error);
      }
    });
  }
  
  /**
   * Obtém o status atual do bot
   */
  public getStatus(): BotStatus {
    return this.status;
  }
  
  /**
   * Obtém as estatísticas atuais
   */
  public getStats(): OperationStats {
    return { ...this.stats };
  }
  
  /**
   * Executa uma operação real usando a API Deriv
   */
  private async executeRealOperation(): Promise<boolean> {
    console.log('[SIMPLEBOT] Executando operação REAL no mercado');
    
    if (this.status !== 'running') {
      console.log('[SIMPLEBOT] Bot não está em status running, não vai executar operação');
      return false;
    }
    
    // Verificar se temos a estratégia e configurações
    if (!this.settings.contractType || !this.settings.entryValue) {
      console.error('[SIMPLEBOT] Configurações incompletas para operação real');
      this.emitEvent({ 
        type: 'error', 
        message: 'Configurações incompletas para operação real'
      });
      return false;
    }
    
    try {
      // Verificar se o WebSocket dedicado para trading está conectado e autorizado
      if (!tradingWebSocket.isConnected()) {
        console.log('[SIMPLEBOT] WebSocket de trading não está conectado, tentando reconectar...');
        try {
          await tradingWebSocket.connect();
          console.log('[SIMPLEBOT] Conexão WebSocket de trading estabelecida, autorizando...');
          const authResponse = await tradingWebSocket.authorize(this.token!);
          
          if (authResponse.error) {
            console.error('[SIMPLEBOT] Erro na autorização com WebSocket de trading:', authResponse.error);
            this.emitEvent({
              type: 'error',
              message: `Erro na autorização: ${authResponse.error.message || 'Erro desconhecido'}`
            });
            return false;
          }
          
          console.log('[SIMPLEBOT] Autorização de trading bem-sucedida:', authResponse.authorize?.loginid);
        } catch (connError) {
          console.error('[SIMPLEBOT] Erro ao reconectar/autorizar WebSocket de trading:', connError);
          this.emitEvent({
            type: 'error',
            message: 'Falha na conexão com a API Deriv para trading'
          });
          return false;
        }
      } else if (!tradingWebSocket.isAuthorized()) {
        console.log('[SIMPLEBOT] WebSocket de trading está conectado mas não autorizado, autorizando...');
        try {
          const authResponse = await tradingWebSocket.authorize(this.token!);
          
          if (authResponse.error) {
            console.error('[SIMPLEBOT] Erro na autorização de WebSocket já conectado:', authResponse.error);
            this.emitEvent({
              type: 'error',
              message: `Erro na autorização: ${authResponse.error.message || 'Erro desconhecido'}`
            });
            return false;
          }
          
          console.log('[SIMPLEBOT] WebSocket de trading autorizado com sucesso:', authResponse.authorize?.loginid);
        } catch (authError) {
          console.error('[SIMPLEBOT] Erro ao autorizar conexão de trading existente:', authError);
          return false;
        }
      }
      
      // Construir parâmetros formatados conforme documentação da API
      const contractType = this.settings.contractType; // Ex: 'DIGITOVER', 'DIGITUNDER'
      const amount = this.settings.entryValue;
      const duration = 5; // 5 ticks de duração
      const prediction = this.settings.prediction || 5; // Previsão padrão: 5
      
      console.log(`[SIMPLEBOT] Solicitando proposta para ${contractType} com valor ${amount}`);
      
      // Identificador único para esta operação (timestamp)
      const operationId = Date.now().toString();
      
      // Formatar a solicitação de proposta conforme documentação da API
      const proposalRequest = {
        proposal: 1,
        amount,
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        duration: duration,
        duration_unit: "t",
        symbol: "R_100",
        barrier: prediction.toString()
      };
      
      console.log('[SIMPLEBOT] Enviando solicitação de proposta:', proposalRequest);
      
      // Obter proposta de contrato
      const proposalResponse = await tradingWebSocket.sendRequest(proposalRequest);
      
      if (proposalResponse.error) {
        console.error('[SIMPLEBOT] Erro na solicitação de proposta:', proposalResponse.error);
        this.emitEvent({ 
          type: 'error', 
          message: `Erro na proposta: ${proposalResponse.error.message || 'Erro desconhecido'}` 
        });
        
        // Agendar próxima tentativa
        this.scheduleNextOperation();
        return false;
      }
      
      const proposal = proposalResponse.proposal;
      if (!proposal || !proposal.id) {
        console.error('[SIMPLEBOT] Proposta recebida inválida ou sem ID');
        this.scheduleNextOperation();
        return false;
      }
      
      console.log('[SIMPLEBOT] Proposta recebida com sucesso, ID:', proposal.id);
      
      // Notificar sobre o preço de compra
      this.emitEvent({
        type: 'proposal_received',
        proposal: {
          price: proposal.ask_price,
          payout: proposal.payout,
          spot: proposal.spot
        }
      });
      
      // Comprar o contrato usando a proposta recebida
      const buyRequest = {
        buy: proposal.id,
        price: proposal.ask_price
      };
      
      console.log('[SIMPLEBOT] Comprando contrato com proposta:', buyRequest);
      
      // Iniciar notificação de compra
      this.emitEvent({
        type: 'contract_purchase_sent',
        contract: {
          type: contractType,
          amount: amount,
          prediction: prediction
        }
      });
      
      // Executar compra
      const buyResponse = await tradingWebSocket.sendRequest(buyRequest);
      
      if (buyResponse.error) {
        console.error('[SIMPLEBOT] Erro na compra do contrato:', buyResponse.error);
        this.emitEvent({ 
          type: 'error', 
          message: `Erro na compra: ${buyResponse.error.message || 'Erro desconhecido'}` 
        });
        this.scheduleNextOperation();
        return false;
      }
      
      // Processar resposta de compra
      const buy = buyResponse.buy;
      if (!buy || !buy.contract_id) {
        console.error('[SIMPLEBOT] Compra retornou resposta inválida ou sem contract_id');
        this.scheduleNextOperation();
        return false;
      }
      
      console.log('[SIMPLEBOT] Contrato comprado com sucesso, ID:', buy.contract_id);
      this.currentContractId = Number(buy.contract_id);
      
      // Notificar sobre contrato comprado
      this.emitEvent({
        type: 'contract_purchased',
        contract: {
          contract_id: buy.contract_id,
          longcode: buy.longcode,
          start_time: buy.start_time,
          buy_price: buy.buy_price
        }
      });
      
      // Monitorar o resultado do contrato
      this.monitorContract(buy.contract_id);
      
      return true;
    } catch (error) {
      console.error('[SIMPLEBOT] Erro não tratado ao executar operação real:', error);
      this.emitEvent({ 
        type: 'error', 
        message: 'Erro ao executar operação real' 
      });
      this.scheduleNextOperation();
      return false;
    }
  }
  
  /**
   * Monitora um contrato específico até que ele seja concluído
   */
  private async monitorContract(contractId: string | number): Promise<void> {
    console.log(`[SIMPLEBOT] Monitorando contrato ${contractId}`);
    
    try {
      // Enviar solicitação para obter atualizações de contrato
      const request = {
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1
      };
      
      const response = await tradingWebSocket.sendRequest(request);
      
      if (response.error) {
        console.error(`[SIMPLEBOT] Erro ao monitorar contrato ${contractId}:`, response.error);
      } else {
        console.log(`[SIMPLEBOT] Monitorando contrato ${contractId} iniciado`);
      }
    } catch (error) {
      console.error(`[SIMPLEBOT] Exceção ao monitorar contrato ${contractId}:`, error);
    }
  }
  
  /**
   * Simular uma operação no mercado
   * NOTA: Esse método está aqui apenas por compatibilidade, mas não executa simulação.
   * Ele sempre chama a função de operação real.
   */
  private simulateOperation(): void {
    console.log('[SIMPLEBOT] Método simulateOperation() redirecionando para operação REAL');
    this.executeRealOperation();
  }
}

// Exportar uma única instância do serviço
export const simpleBotService = new SimpleBotService();