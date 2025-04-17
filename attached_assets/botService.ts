import derivAPI from './derivApi';
import { Subject } from 'rxjs';

export type TradeOption = {
  symbol: string;
  contractType: string;
  duration: number;
  durationUnit: string;
  amount: number;
  currency: string;
  basis: 'stake' | 'payout';
  barrierOffset?: number;
  prediction?: number;
};

export type TradeState = 'idle' | 'running' | 'paused' | 'stopped' | 'finished' | 'error';
export type LogEntry = {
  timestamp: number;
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
};

export type TradeResult = {
  contractId: string;
  buy_price: number;
  payout: number;
  profit: number;
  entrySpot: number;
  exitSpot: number;
  entryTime: string;
  exitTime: string;
  result: 'win' | 'loss';
};

// Classe principal do serviço de Bot
class BotService {
  private state: TradeState = 'idle';
  private logs: LogEntry[] = [];
  private logSubject = new Subject<LogEntry>();
  private stateSubject = new Subject<TradeState>();
  private tradeResultSubject = new Subject<TradeResult>();
  private runningInterval: NodeJS.Timeout | null = null;
  private activeContracts: string[] = [];
  private totalRuns = 0;
  private totalWins = 0;
  private totalLosses = 0;
  private totalProfit = 0;
  private currentTradeOption: TradeOption | null = null;
  private strategyFunction: Function | null = null;

  constructor() {
    this.log('info', 'Bot service initialized');
  }

  // Inicializar o bot com opções de trading
  public init(strategy: Function) {
    if (!derivAPI.getConnectionStatus()) {
      this.log('error', 'API da Deriv não está conectada');
      throw new Error('API da Deriv não está conectada');
    }
    
    this.strategyFunction = strategy;
    this.log('info', 'Bot inicializado com estratégia definida');
    this.setState('idle');
    
    return this;
  }

  // Iniciar o bot com as opções definidas
  public start(tradeOption: TradeOption) {
    if (!derivAPI.getConnectionStatus()) {
      this.log('error', 'API da Deriv não está conectada');
      throw new Error('API da Deriv não está conectada');
    }
    
    if (!this.strategyFunction) {
      this.log('error', 'Nenhuma estratégia definida');
      throw new Error('Nenhuma estratégia definida');
    }
    
    this.currentTradeOption = tradeOption;
    this.setState('running');
    this.log('success', `Bot iniciado para ${tradeOption.symbol}`);
    
    // Executar a estratégia em um intervalo regular
    this.runningInterval = setInterval(() => {
      this.executeStrategy();
    }, 5000); // Verificar a cada 5 segundos
    
    return this;
  }

  // Pausar o bot
  public pause() {
    if (this.state === 'running') {
      this.setState('paused');
      this.log('info', 'Bot pausado');
      
      if (this.runningInterval) {
        clearInterval(this.runningInterval);
        this.runningInterval = null;
      }
    }
    
    return this;
  }

  // Retomar o bot
  public resume() {
    if (this.state === 'paused') {
      this.setState('running');
      this.log('info', 'Bot resumido');
      
      this.runningInterval = setInterval(() => {
        this.executeStrategy();
      }, 5000);
    }
    
    return this;
  }

  // Parar o bot
  public stop() {
    this.setState('stopped');
    this.log('info', 'Bot parado');
    
    if (this.runningInterval) {
      clearInterval(this.runningInterval);
      this.runningInterval = null;
    }
    
    return this;
  }

  // Executar compra
  public async buy(contractType: string, amount: number, duration: number, durationUnit: string) {
    if (!this.currentTradeOption) {
      this.log('error', 'Opções de trading não definidas');
      throw new Error('Opções de trading não definidas');
    }
    
    try {
      this.log('info', `Tentando comprar ${contractType} em ${this.currentTradeOption.symbol}`);
      
      // Criar uma proposta diretamente
      const proposalRequest: any = {
        proposal: 1,
        symbol: this.currentTradeOption.symbol,
        contract_type: contractType,
        duration: duration,
        duration_unit: durationUnit,
        amount: amount,
        currency: this.currentTradeOption.currency,
        basis: this.currentTradeOption.basis,
      };
      
      // Adicionar parâmetros opcionais se existirem
      if (this.currentTradeOption.barrierOffset) {
        proposalRequest.barrier = this.currentTradeOption.barrierOffset.toString();
      }
      
      if (this.currentTradeOption.prediction) {
        proposalRequest.prediction = this.currentTradeOption.prediction;
      }
      
      // Enviar proposta
      const proposalResponse = await derivAPI.send(proposalRequest);
      
      if (!proposalResponse || !proposalResponse.proposal) {
        this.log('error', 'Falha ao criar proposta de contrato');
        return;
      }
      
      const proposal = proposalResponse.proposal;
      
      // Comprar o contrato com base na proposta
      const buyResponse = await derivAPI.send({
        buy: proposal.id,
        price: proposal.ask_price
      });
      
      if (buyResponse && buyResponse.buy) {
        const contract = buyResponse.buy;
        this.activeContracts.push(contract.contract_id);
        this.log('success', `Contrato comprado: ${contract.contract_id} por ${contract.buy_price} ${this.currentTradeOption.currency}`);
        this.totalRuns += 1;
        
        // Monitorar o contrato
        this.monitorContract(contract.contract_id);
        
        return contract;
      } else {
        this.log('error', 'Falha ao comprar contrato');
      }
    } catch (error) {
      this.log('error', `Erro ao comprar contrato: ${error}`);
      throw error;
    }
  }

  // Monitorar um contrato específico usando eventos - implementação otimizada
  private async monitorContract(contractId: string) {
    try {
      console.log(`[BotService] Iniciando monitoramento do contrato #${contractId} via eventos`);
      
      // Evitar monitoramento duplicado do mesmo contrato
      if (this.activeContracts.includes(contractId)) {
        console.log(`[BotService] Contrato #${contractId} já está sendo monitorado`);
        return; // Retornar imediatamente para evitar listeners duplicados
      }
      
      // Adicionar à lista de contratos ativos
      this.activeContracts.push(contractId);
      
      // Iniciar assinatura para receber atualizações em tempo real
      const response = await derivAPI.subscribeToContract(contractId);
      
      if (response.error) {
        console.error(`[BotService] Erro ao iniciar assinatura para contrato #${contractId}:`, response.error);
        this.log('error', `Erro ao iniciar monitoramento: ${response.error.message || 'Falha na API'}`);
        // Remover da lista de contratos em caso de erro
        this.activeContracts = this.activeContracts.filter(id => id !== contractId);
        return;
      }
      
      console.log(`[BotService] Assinatura iniciada com sucesso para contrato #${contractId}`);
      
      // Verificar imediatamente se o contrato já está finalizado na primeira resposta
      const initialContract = response.proposal_open_contract;
      if (initialContract && (initialContract.status === 'sold' || initialContract.status === 'expired')) {
        this.processContractResult(initialContract);
        // Não precisamos continuar monitorando um contrato que já está finalizado
        this.activeContracts = this.activeContracts.filter(id => id !== contractId);
        return;
      }
      
      // Criar um listener para monitorar atualizações subsequentes - otimizado com _status
      const contractUpdateHandler = (event: any) => {
        const data = event.detail;
        if (!data || !data.proposal_open_contract) return;
        
        const contract = data.proposal_open_contract;
        const eventStatus = data._status || contract.status || 'unknown';
        
        // Verificar se este evento é para o contrato que estamos monitorando
        if (contract.contract_id == contractId) {
          // Log apenas para mudanças significativas de status
          console.log(`[BotService] Atualização para contrato #${contractId}: status=${eventStatus}, lucro=${contract.profit}`);
          
          // Usar _status para verificações mais eficientes
          if (eventStatus === 'sold' || eventStatus === 'expired') {
            // Processar resultado do contrato
            this.processContractResult(contract);
            
            // Limpar recursos
            document.removeEventListener('deriv:contract_update', contractUpdateHandler);
            this.activeContracts = this.activeContracts.filter(id => id !== contractId);
            
            console.log(`[BotService] Contrato #${contractId} finalizado com status '${eventStatus}'`);
          }
        }
      };
      
      // Registrar o listener para eventos de contrato
      document.addEventListener('deriv:contract_update', contractUpdateHandler);
    } catch (error: any) {
      // Garantir limpeza mesmo em caso de erro
      console.error(`[BotService] Erro ao monitorar contrato ${contractId}:`, error);
      const errorMessage = error.message || String(error);
      this.log('error', `Erro ao monitorar contrato: ${errorMessage}`);
      
      // Remover da lista de contratos ativos em caso de erro
      this.activeContracts = this.activeContracts.filter(id => id !== contractId);
    }
  }
  
  // Processar o resultado de um contrato finalizado
  private processContractResult(contract: any) {
    const contractId = contract.contract_id.toString();
    const profit = contract.profit;
    
    if (profit > 0) {
      this.totalWins += 1;
      this.log('success', `Contrato ${contractId} ganhou ${profit} ${this.currentTradeOption?.currency}`);
    } else {
      this.totalLosses += 1;
      this.log('error', `Contrato ${contractId} perdeu ${profit} ${this.currentTradeOption?.currency}`);
    }
    
    this.totalProfit += profit;
    
    // Emitir resultado do trade
    this.tradeResultSubject.next({
      contractId,
      buy_price: contract.buy_price,
      payout: contract.payout,
      profit: contract.profit,
      entrySpot: contract.entry_tick,
      exitSpot: contract.exit_tick,
      entryTime: new Date(contract.date_start * 1000).toISOString(),
      exitTime: new Date(contract.date_expiry * 1000).toISOString(),
      result: profit > 0 ? 'win' : 'loss'
    });
  }

  // Executar a estratégia definida
  private executeStrategy() {
    if (!this.strategyFunction || !this.currentTradeOption) return;
    
    try {
      // Aqui executamos a função de estratégia definida pelo usuário
      this.strategyFunction(this);
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      this.log('error', `Erro ao executar estratégia: ${errorMessage}`);
      this.setState('error');
      
      if (this.runningInterval) {
        clearInterval(this.runningInterval);
        this.runningInterval = null;
      }
    }
  }

  // Registrar log
  private log(type: 'info' | 'success' | 'error' | 'warning', message: string) {
    const logEntry: LogEntry = {
      timestamp: Date.now(),
      type,
      message
    };
    
    this.logs.push(logEntry);
    this.logSubject.next(logEntry);
    
    // Log para console também (durante desenvolvimento)
    console.log(`[Bot ${type}]: ${message}`);
  }

  // Alterar estado
  private setState(newState: TradeState) {
    this.state = newState;
    this.stateSubject.next(newState);
  }

  // Getters públicos
  public getState() {
    return this.state;
  }

  public getLogs() {
    return this.logs;
  }

  public getStatistics() {
    return {
      totalRuns: this.totalRuns,
      totalWins: this.totalWins,
      totalLosses: this.totalLosses,
      totalProfit: this.totalProfit,
      winRate: this.totalRuns > 0 ? (this.totalWins / this.totalRuns) * 100 : 0
    };
  }

  // Observables para componentes React
  public onLogEntry() {
    return this.logSubject.asObservable();
  }

  public onStateChange() {
    return this.stateSubject.asObservable();
  }

  public onTradeResult() {
    return this.tradeResultSubject.asObservable();
  }
}

// Exportar uma instância única
export const botService = new BotService();

export default botService;