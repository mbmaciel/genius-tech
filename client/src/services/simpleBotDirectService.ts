/**
 * Serviço para trading automatizado com API Deriv
 * Versão 2023.6 - EXCLUSIVAMENTE para operações reais (sem simulação)
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

class SimpleBotDirectService {
  private token: string | null = null;
  private status: BotStatus = 'idle';
  private currentContractId: number | null = null;
  private activeStrategyId: string | null = null;
  private webSocket: WebSocket | null = null;
  private settings: BotSettings = {
    entryValue: 0.35,
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
    
    // Verificar se temos um token OAuth armazenado
    const token = localStorage.getItem('deriv_oauth_token');
    if (token) {
      console.log('[SIMPLEBOT] Token OAuth encontrado para trading');
      this.token = token;
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
    
    // Tempo de espera entre operações (5 segundos)
    const delay = 5000;
    
    console.log(`[SIMPLEBOT] Próxima operação agendada para ${delay/1000}s`);
    
    this.operationTimer = setTimeout(() => {
      if (this.status === 'running') {
        this.executeRealOperation();
      }
    }, delay);
  }
  
  /**
   * Inicia a execução do bot (APENAS operações reais)
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
      
      // Iniciar operação real diretamente (usará o WebSocket do frontend)
      // A conexão já está estabelecida por padrão no frontend
      this.executeRealOperation();
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
   * Executa uma operação real usando a API Deriv através do WebSocket do frontend
   * Usa diretamente a referência do WebSocket que já está conectado e recebendo ticks
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
    
    // Verificar o WebSocket armazenado localmente primeiro
    let wsRef = this.webSocket;
    
    // Se não temos um WebSocket interno, verificar a referência global
    if (!wsRef || wsRef.readyState !== WebSocket.OPEN) {
      wsRef = (window as any).activeWebSocket;
      
      if (wsRef && wsRef.readyState === WebSocket.OPEN) {
        // Registrar este WebSocket para uso se ainda não estiver registrado
        if (this.webSocket !== wsRef) {
          console.log('[SIMPLEBOT] WebSocket encontrado globalmente, atualizando referência interna');
          this.webSocket = wsRef;
        }
      } else {
        console.error('[SIMPLEBOT] WebSocket não disponível ou não está conectado (nem interna nem global)');
        this.emitEvent({
          type: 'error',
          message: 'Conexão com servidor não disponível. Tente atualizar a página.'
        });
        return false;
      }
    }
    
    // Log para debug
    console.log('[SIMPLEBOT] WebSocket disponível e pronto para operações');
    
    try {
      // Construir parâmetros formatados conforme documentação da API
      const contractType = this.settings.contractType; // Ex: 'DIGITOVER', 'DIGITUNDER'
      const amount = this.settings.entryValue;
      const duration = 5; // 5 ticks de duração
      const prediction = this.settings.prediction || 5; // Previsão padrão: 5
      
      console.log(`[SIMPLEBOT] Comprando contrato ${contractType} com valor ${amount}`);
      
      // Formatar a solicitação de compra direta
      const buyRequest = {
        buy: 1,
        price: amount,
        parameters: {
          contract_type: contractType,
          currency: "USD",
          duration: duration,
          duration_unit: "t",
          symbol: "R_100",
          barrier: prediction.toString()
        }
      };
      
      console.log('[SIMPLEBOT] Enviando solicitação de compra:', buyRequest);
      
      // Enviar a solicitação pelo WebSocket existente
      wsRef.send(JSON.stringify(buyRequest));
      
      // Notificar que uma operação está em andamento
      this.emitEvent({
        type: 'operation_started',
        contract_type: contractType,
        amount: amount,
        prediction: prediction
      });
      
      return true;
    } catch (error) {
      console.error('[SIMPLEBOT] Erro ao executar operação real:', error);
      this.emitEvent({
        type: 'error',
        message: 'Erro ao executar operação'
      });
      
      // Agendar nova tentativa
      this.scheduleNextOperation();
      return false;
    }
  }
  
  /**
   * Registra o WebSocket ativo e configura listeners para respostas
   */
  public registerWebSocket(ws: WebSocket): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[SIMPLEBOT] Tentativa de registrar WebSocket não conectado');
      return;
    }
    
    try {
      // Armazenar no window para acesso global
      (window as any).activeWebSocket = ws;
      // Armazenar como referência interna também
      this.webSocket = ws;
      
      console.log('[SIMPLEBOT] WebSocket registrado com sucesso para operações de trading');
      
      // Adicionar listener para mensagens recebidas
      this.setupMessageListener(ws);
      
      // Verificar se está autorizado
      const token = localStorage.getItem('deriv_oauth_token');
      if (token && this.token !== token) {
        this.token = token;
        console.log('[SIMPLEBOT] Token OAuth atualizado durante registro de WebSocket');
      }
    } catch (error) {
      console.error('[SIMPLEBOT] Erro ao registrar WebSocket:', error);
    }
  }
  
  /**
   * Configura listener para mensagens do WebSocket
   */
  private setupMessageListener(ws: WebSocket): void {
    // Função de manipulação de mensagens
    const messageHandler = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        
        // Resposta de compra de contrato
        if (data.msg_type === 'buy') {
          console.log('[SIMPLEBOT] Resposta de compra recebida:', data);
          
          if (data.error) {
            // Erro na compra
            console.error('[SIMPLEBOT] Erro ao comprar contrato:', data.error.message);
            this.emitEvent({
              type: 'error',
              message: data.error.message || 'Erro ao executar a compra'
            });
            
            // Agendar nova operação
            this.scheduleNextOperation();
            
          } else if (data.buy) {
            // Compra bem-sucedida
            const contractId = data.buy.contract_id;
            const buyPrice = data.buy.buy_price;
            
            console.log(`[SIMPLEBOT] Contrato comprado com sucesso: ID ${contractId}, Valor $${buyPrice}`);
            this.currentContractId = contractId;
            
            // Monitorar o contrato
            this.monitorContract(contractId, ws);
          }
        }
        
        // Atualização de contrato aberto
        if (data.msg_type === 'proposal_open_contract') {
          const contract = data.proposal_open_contract;
          
          // Verificar se é o contrato atual
          if (contract && contract.contract_id === this.currentContractId) {
            // Verificar se o contrato foi encerrado
            if (contract.is_sold === 1) {
              console.log('[SIMPLEBOT] Contrato encerrado:', contract);
              
              // Atualizar estatísticas e agendar próxima operação
              this.processContractCompletion(contract);
              this.currentContractId = null;
            }
          }
        }
      } catch (error) {
        console.error('[SIMPLEBOT] Erro ao processar mensagem do WebSocket:', error);
      }
    };
    
    // Adicionar o listener ao WebSocket
    ws.addEventListener('message', messageHandler);
  }
  
  /**
   * Monitora um contrato específico
   */
  private monitorContract(contractId: number | string, ws: WebSocket): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error('[SIMPLEBOT] WebSocket não está pronto para monitorar contrato');
      return;
    }
    
    // Inscrever para atualizações do contrato
    const subscribeRequest = {
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    };
    
    try {
      ws.send(JSON.stringify(subscribeRequest));
      console.log(`[SIMPLEBOT] Monitorando contrato ID ${contractId}`);
    } catch (error) {
      console.error('[SIMPLEBOT] Erro ao iniciar monitoramento do contrato:', error);
    }
  }
}

// Exportar uma instância única do serviço
export const simpleBotDirectService = new SimpleBotDirectService();