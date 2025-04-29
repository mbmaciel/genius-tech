import { WebSocket } from 'ws';

// Interface para as configurações de uma estratégia
export interface BotConfig {
  initialStake: number;
  martingaleFactor: number;
  maxMartingaleLevel: number;
  targetProfit: number;
  stopLoss: number;
  prediction?: number;
  entryPercentage?: number; // Porcentagem para entrar em estratégias específicas como Advance
  lossVirtual?: number; // Número de ocorrências consecutivas para loss virtual em estratégias ProfitPro e MaxPro
  
  // Campos específicos para estratégia ADVANCE
  forceBarrier?: string;
  forcePrediction?: number;
  forceDigitOver?: boolean;
}

// Tipos de estratégias suportadas
export type StrategyType = 'OVER' | 'UNDER' | 'BOTH' | 'RISE' | 'FALL' | 'ADVANCED';

// Interface para uma estratégia
export interface BinaryBotStrategy {
  id: string;
  name: string;
  description: string;
  type: StrategyType;
  config: BotConfig;
  xmlPath?: string;
}

// Interface para estatísticas de operações
export interface OperationStats {
  totalOperations: number;
  wins: number;
  losses: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netResult: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  bestStreak: number;
  worstStreak: number;
  averageProfit: number;
  averageLoss: number;
  profitFactor: number;
  startTime: Date;
  lastUpdateTime: Date;
  bySymbol: Record<string, {
    count: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
  }>;
  byContractType: Record<string, {
    count: number;
    wins: number;
    losses: number;
    winRate: number;
    netProfit: number;
  }>;
}

// Interface para um contrato
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

// Interface para atualização de contrato
export interface UpdateContractParams {
  stopLoss?: number | null;
  takeProfit?: number | null;
}

// Status de uma operação
export type OperationStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';

// Listener para mensagens de log
type LogListener = (message: string) => void;

// Listener para atualizações de contratos
type ContractUpdateListener = (contracts: Contract[]) => void;

// Listener para atualizações de estatísticas
type StatsUpdateListener = (stats: OperationStats) => void;

/**
 * Classe principal para gerenciar automações de trading
 */
class AutomationService {
  private wsConnection: WebSocket | null = null;
  private authToken: string | null = null;
  private runningStrategy: BinaryBotStrategy | null = null;
  private lastNoConnectionLog: number = 0;
  private operationStatus: OperationStatus = 'idle';
  private logListeners: LogListener[] = [];
  private contractUpdateListeners: ContractUpdateListener[] = [];
  private statsUpdateListeners: StatsUpdateListener[] = [];
  private contracts: Contract[] = [];
  private operationStats: OperationStats;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private botConfig: BotConfig | null = null;
  private currentSymbol: string = 'R_100';

  constructor() {
    this.operationStats = this.initializeStats();
    this.setupKeepAlive();
  }

  /**
   * Inicializa as estatísticas da operação
   */
  private initializeStats(): OperationStats {
    return {
      totalOperations: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalProfit: 0,
      totalLoss: 0,
      netResult: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      bestStreak: 0,
      worstStreak: 0,
      averageProfit: 0,
      averageLoss: 0,
      profitFactor: 0,
      startTime: new Date(),
      lastUpdateTime: new Date(),
      bySymbol: {},
      byContractType: {}
    };
  }

  /**
   * Configura o sistema de keep-alive para a conexão WebSocket
   */
  private setupKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(() => {
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        this.wsConnection.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }

  /**
   * Conecta ao WebSocket da Deriv
   */
  public async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.wsConnection && this.wsConnection.readyState === WebSocket.OPEN) {
        this.log("WebSocket já está conectado");
        resolve(true);
        return;
      }

      this.log("Conectando ao WebSocket da Deriv...");
      
      try {
        this.wsConnection = new WebSocket('wss://ws.binaryws.com/websockets/v3');

        this.wsConnection.onopen = () => {
          this.log("Conexão estabelecida com sucesso!");
          resolve(true);
        };

        this.wsConnection.onmessage = (message) => {
          this.handleMessage(message.data);
        };

        this.wsConnection.onerror = (error) => {
          this.log(`Erro na conexão WebSocket: ${error.message || 'Erro desconhecido'}`);
          resolve(false);
        };

        this.wsConnection.onclose = () => {
          this.log("Conexão WebSocket fechada");
          this.wsConnection = null;
        };
      } catch (error) {
        this.log(`Erro ao criar conexão WebSocket: ${error instanceof Error ? error.message : String(error)}`);
        resolve(false);
      }
    });
  }

  /**
   * Processa mensagens recebidas pelo WebSocket
   */
  private handleMessage(data: any): void {
    try {
      const response = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Resposta de autenticação
      if (response.authorize) {
        this.log("Autenticação bem-sucedida!");
        document.dispatchEvent(new CustomEvent('deriv:authorized', { detail: response.authorize }));
      }
      
      // Resposta de tick
      if (response.tick) {
        document.dispatchEvent(new CustomEvent('deriv:tick', { detail: response.tick }));
      }
      
      // Resposta de compra
      if (response.buy) {
        this.log(`Contrato adquirido: ${response.buy.contract_id}`);
        document.dispatchEvent(new CustomEvent('deriv:buy', { detail: response.buy }));
      }
      
      // Resposta de contratos abertos
      if (response.proposal_open_contract) {
        const contract = response.proposal_open_contract;
        document.dispatchEvent(new CustomEvent('deriv:contract', { detail: contract }));
      }
      
      // Resposta de histórico de compra
      if (response.history) {
        document.dispatchEvent(new CustomEvent('deriv:history', { detail: response.history }));
      }
      
      // Resposta de venda
      if (response.sell) {
        this.log(`Contrato vendido: ${response.sell.contract_id}`);
        document.dispatchEvent(new CustomEvent('deriv:sell', { detail: response.sell }));
      }
      
      // Resposta de histórico de ticks
      if (response.history?.ticks) {
        document.dispatchEvent(new CustomEvent('deriv:tick_history', { detail: response.history }));
      }
      
      // Resposta de erro
      if (response.error) {
        this.log(`Erro API: ${response.error.code} - ${response.error.message}`);
        document.dispatchEvent(new CustomEvent('deriv:error', { detail: response.error }));
      }
      
      // Resposta de ping
      if (response.ping) {
        this.wsConnection?.send(JSON.stringify({ pong: 1 }));
      }
    } catch (error) {
      this.log(`Erro ao processar mensagem: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Envia uma solicitação para a API WebSocket
   */
  public sendRequest(request: any): void {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      this.log("WebSocket não está conectado");
      return;
    }

    try {
      this.wsConnection.send(JSON.stringify(request));
    } catch (error) {
      this.log(`Erro ao enviar solicitação: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Autoriza a sessão com um token
   */
  public authorize(token: string): void {
    this.authToken = token;
    this.sendRequest({ authorize: token });
  }

  /**
   * Inscreve-se para receber ticks de um símbolo
   */
  public subscribeTicks(symbol: string): void {
    this.currentSymbol = symbol;
    this.sendRequest({ ticks: symbol, subscribe: 1 });
    this.log(`Inscrito em ${symbol} em tempo real`);
  }

  /**
   * Cancela a inscrição de ticks
   */
  public unsubscribeTicks(): void {
    if (this.currentSymbol) {
      this.sendRequest({ forget_all: 'ticks' });
      this.log(`Cancelada inscrição em ticks`);
    }
  }

  /**
   * Compra um contrato
   */
  public buyContract(contractType: string, amount: number, symbol: string, prediction?: number): void {
    if (!this.authToken) {
      this.log("Não autorizado. Faça login primeiro.");
      return;
    }

    let parameters: any = {
      buy: 1,
      price: amount,
      parameters: {
        contract_type: contractType,
        symbol: symbol,
        currency: 'USD',
        duration: 1,
        duration_unit: 't',
      }
    };

    if (prediction !== undefined) {
      parameters.parameters.barrier = prediction.toString();
    }

    this.sendRequest(parameters);
    this.log(`Solicitação de compra enviada: ${contractType} em ${symbol}`);
  }

  /**
   * Vende um contrato
   */
  public sellContract(contractId: number): void {
    if (!this.authToken) {
      this.log("Não autorizado. Faça login primeiro.");
      return;
    }

    this.sendRequest({
      sell: contractId,
      price: 0
    });
    this.log(`Solicitação de venda enviada para contrato ${contractId}`);
  }

  /**
   * Inicia uma estratégia de automação
   */
  public startBot(strategy: BinaryBotStrategy, config: BotConfig): void {
    if (this.operationStatus === 'running') {
      this.log("Um bot já está em execução. Pare-o primeiro.");
      return;
    }

    this.runningStrategy = strategy;
    this.botConfig = config;
    this.operationStats = this.initializeStats();
    this.operationStatus = 'running';
    this.log(`Iniciando estratégia ${strategy.name} com configurações personalizadas`);

    // Conecta ao WebSocket se ainda não estiver conectado
    this.connect().then((connected) => {
      if (!connected) {
        this.log("Não foi possível iniciar o bot - falha na conexão");
        this.operationStatus = 'error';
        return;
      }

      // Simula a execução de uma estratégia básica
      if (strategy.type === 'OVER' || strategy.type === 'UNDER' || strategy.type === 'BOTH') {
        const contractType = strategy.type === 'OVER' ? 'DIGITOVER' : 
                             strategy.type === 'UNDER' ? 'DIGITUNDER' : 
                             Math.random() > 0.5 ? 'DIGITOVER' : 'DIGITUNDER';
        
        this.subscribeTicks('R_100');
        
        // Compra um contrato inicial
        this.buyContract(
          contractType,
          config.initialStake,
          'R_100',
          config.prediction
        );
      }
    });
  }

  /**
   * Pausa a execução do bot
   */
  public pauseBot(): void {
    if (this.operationStatus !== 'running') {
      this.log("Nenhum bot em execução para pausar");
      return;
    }

    this.operationStatus = 'paused';
    this.log("Bot pausado");
  }

  /**
   * Continua a execução do bot
   */
  public resumeBot(): void {
    if (this.operationStatus !== 'paused') {
      this.log("Não há bot pausado para continuar");
      return;
    }

    this.operationStatus = 'running';
    this.log("Bot continuando a execução");
  }

  /**
   * Para a execução do bot
   */
  public stopBot(): void {
    if (this.operationStatus === 'idle') {
      this.log("Nenhum bot em execução para parar");
      return;
    }

    this.unsubscribeTicks();
    this.operationStatus = 'stopped';
    this.runningStrategy = null;
    this.botConfig = null;
    this.log("Bot parado");
  }

  /**
   * Registra uma mensagem de log
   */
  private log(message: string): void {
    console.log(`[AutomationService] ${message}`);
    this.logListeners.forEach(listener => listener(message));
  }

  /**
   * Adiciona um listener para mensagens de log
   */
  public onLog(listener: LogListener): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter(l => l !== listener);
    };
  }

  /**
   * Adiciona um listener para atualizações de contratos
   */
  public onContractsUpdate(listener: ContractUpdateListener): () => void {
    this.contractUpdateListeners.push(listener);
    return () => {
      this.contractUpdateListeners = this.contractUpdateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Adiciona um listener para atualizações de estatísticas
   */
  public onStatsUpdate(listener: StatsUpdateListener): () => void {
    this.statsUpdateListeners.push(listener);
    return () => {
      this.statsUpdateListeners = this.statsUpdateListeners.filter(l => l !== listener);
    };
  }

  /**
   * Obtém o status atual da operação
   */
  public getOperationStatus(): OperationStatus {
    return this.operationStatus;
  }

  /**
   * Obtém as estatísticas atuais da operação
   */
  public getOperationStats(): OperationStats {
    return this.operationStats;
  }

  /**
   * Fecha a conexão e libera recursos
   */
  public dispose(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    if (this.wsConnection) {
      try {
        this.wsConnection.close();
      } catch (error) {
        console.error("Erro ao fechar WebSocket:", error);
      }
      this.wsConnection = null;
    }

    this.operationStatus = 'idle';
    this.runningStrategy = null;
    this.botConfig = null;
    this.logListeners = [];
    this.contractUpdateListeners = [];
    this.statsUpdateListeners = [];
  }
}

// Cria uma instância singleton do serviço
export const automationService = new AutomationService();