/**
 * Serviço para gerenciar a execução de estratégias de trading
 * Implementa a lógica de execução dos bots definidos nos arquivos XML
 */

import derivApiService, { Contract, ContractType, ContractPrediction } from './derivApiService';

export interface StrategyConfig {
  id: string;
  name: string;
  file: string;
  type: 'lite' | 'premium';
}

export interface BotSettings {
  entryValue: number;
  virtualLoss: number;
  profitTarget: number;
  lossLimit: number;
  martingaleFactor: number;
  prediction?: ContractPrediction;
  contractType?: ContractType;
}

export interface OperationStats {
  wins: number;
  losses: number;
  totalProfit: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  lastOperation?: {
    result: 'win' | 'loss';
    profit: number;
    contractId: number;
    contractType: string;
    entryValue: number;
  };
}

// Eventos que o bot pode emitir
type BotEvent = 
  | { type: 'status_change'; status: BotStatus }
  | { type: 'operation_started'; contract: Contract }
  | { type: 'operation_finished'; result: 'win' | 'loss'; profit: number; contract: Contract }
  | { type: 'stats_updated'; stats: OperationStats }
  | { type: 'error'; message: string }
  | { type: 'balance_update'; balance: number; currency: string };

export type BotStatus = 'idle' | 'running' | 'paused' | 'error';

class BotService {
  private strategies: StrategyConfig[] = [
    // Lite Bots
    { id: "profitpro", name: "Profit Pro", file: "Profitpro Atualizado.xml", type: 'lite' },
    { id: "manualunder", name: "Manual Under", file: "Manual Under.xml", type: 'lite' },
    { id: "advance", name: "Advance", file: "Advance .xml", type: 'lite' },
    { id: "wisetendencia", name: "Wise Pro Tendência", file: "WISE PRO TENDENCIA.xml", type: 'lite' },
    
    // Premium Bots
    { id: "ironover", name: "Iron Over", file: "IRON OVER.xml", type: 'premium' },
    { id: "ironunder", name: "Iron Under", file: "IRON UNDER.xml", type: 'premium' },
    { id: "botlow", name: "Bot Low", file: "BOT LOW.xml", type: 'premium' },
    { id: "maxpro", name: "Max Pro", file: "MAXPRO .xml", type: 'premium' },
    { id: "green", name: "Green", file: "green.xml", type: 'premium' },
    { id: "manualover", name: "Manual Over", file: "manual Over.xml", type: 'premium' }
  ];
  
  private activeStrategy: StrategyConfig | null = null;
  private settings: BotSettings = {
    entryValue: 0.35,
    virtualLoss: 0,
    profitTarget: 10,
    lossLimit: 20,
    martingaleFactor: 1.5
  };
  
  private status: BotStatus = 'idle';
  private currentContract: Contract | null = null;
  private eventListeners: Array<(event: BotEvent) => void> = [];
  private operationTimer: NodeJS.Timeout | null = null;
  
  private stats: OperationStats = {
    wins: 0,
    losses: 0,
    totalProfit: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  };
  
  constructor() {
    // Inicializar ouvintes para eventos da API
    derivApiService.onContractUpdate(this.handleContractUpdate.bind(this));
    derivApiService.onBalanceUpdate(this.handleBalanceUpdate.bind(this));
    
    // IMPORTANTE: Verificar se temos token OAuth e inicializar a conexão com ele
    const oauthToken = localStorage.getItem('deriv_oauth_token');
    if (oauthToken) {
      console.log('[BOT_SERVICE] Inicializando conexão com token OAuth:', oauthToken.substring(0, 10) + '...');
      derivApiService.connect(oauthToken).then(success => {
        if (success) {
          console.log('[BOT_SERVICE] Conexão OAuth inicializada com sucesso');
          this.emitEvent({ type: 'status_change', status: 'idle' });
        } else {
          console.error('[BOT_SERVICE] Falha ao inicializar conexão OAuth');
          this.emitEvent({ type: 'error', message: 'Falha ao inicializar conexão OAuth' });
        }
      });
    } else {
      console.warn('[BOT_SERVICE] Token OAuth não encontrado, operações não estarão disponíveis');
    }
  }
  
  /**
   * Lista todas as estratégias disponíveis
   */
  public getStrategies(type?: 'lite' | 'premium'): StrategyConfig[] {
    // Carregar estratégias do serviço XML
    try {
      import('../services/xmlStrategyParser').then(module => {
        const parser = module.xmlStrategyParser;
        
        // Carregar estratégias adicionais dos arquivos XML
        const xmlStrategies = parser.getAllStrategies();
        
        // Adicionar as estratégias do XML, evitando duplicatas por ID
        xmlStrategies.forEach(xmlStrategy => {
          const exists = this.strategies.some(s => s.id === xmlStrategy.id);
          if (!exists) {
            this.strategies.push({
              id: xmlStrategy.id,
              name: xmlStrategy.name,
              file: `${xmlStrategy.id}.xml`,
              type: xmlStrategy.category as 'lite' | 'premium'
            });
          }
        });
      }).catch(err => {
        console.error('Erro ao carregar parser de estratégias XML:', err);
      });
    } catch (err) {
      console.error('Erro ao importar parser de estratégias XML:', err);
    }
    
    if (type) {
      return this.strategies.filter(s => s.type === type);
    }
    return this.strategies;
  }
  
  /**
   * Obtém uma estratégia pelo ID
   */
  public getStrategyById(id: string): StrategyConfig | undefined {
    return this.strategies.find(s => s.id === id);
  }
  
  /**
   * Define as configurações do bot
   */
  public setSettings(settings: Partial<BotSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }
  
  /**
   * Obtém as configurações atuais do bot
   */
  public getSettings(): BotSettings {
    return { ...this.settings };
  }
  
  /**
   * Define a estratégia ativa
   */
  public setActiveStrategy(strategyId: string): boolean {
    const strategy = this.getStrategyById(strategyId);
    if (!strategy) {
      this.emitEvent({ type: 'error', message: `Estratégia "${strategyId}" não encontrada` });
      return false;
    }
    
    this.activeStrategy = strategy;
    
    // Definir tipo de contrato e previsão com base no nome da estratégia
    if (strategy.id === 'ironunder' || strategy.id === 'manualunder' || strategy.id === 'botlow') {
      this.settings.contractType = 'DIGITUNDER';
      this.settings.prediction = 5; // Valor padrão para exemplo
    } else {
      this.settings.contractType = 'DIGITOVER';
      this.settings.prediction = 5; // Valor padrão para exemplo
    }
    
    return true;
  }
  
  /**
   * Inicia a execução do bot
   */
  public async start(): Promise<boolean> {
    if (this.status === 'running') {
      return true;
    }
    
    if (!this.activeStrategy) {
      this.emitEvent({ type: 'error', message: 'Nenhuma estratégia selecionada' });
      return false;
    }
    
    try {
      // IMPORTANTE: Verificar se temos token OAuth atualizado e usar ele para conectar
      const oauthToken = localStorage.getItem('deriv_oauth_token');
      if (!oauthToken) {
        this.emitEvent({ type: 'error', message: 'Token OAuth não disponível. Conecte sua conta na página Dashboard' });
        return false;
      }
      
      // Verificar conexão com a API, usando explicitamente o token OAuth
      if (!isApiAuthorized()) {
        console.log('[BOT_SERVICE] Conectando com token OAuth para operações de trading');
        const connected = await derivApiService.connect(oauthToken);
        if (!connected) {
          this.emitEvent({ type: 'error', message: 'Falha ao conectar à API Deriv com token OAuth' });
          return false;
        }
      }
      
      this.setStatus('running');
      this.startTrading();
      return true;
    } catch (error) {
      this.emitEvent({ type: 'error', message: `Erro ao iniciar o bot: ${error}` });
      this.setStatus('error');
      return false;
    }
  }
  
  /**
   * Pausa a execução do bot
   */
  public pause(): void {
    if (this.status !== 'running') return;
    
    this.setStatus('paused');
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }
  }
  
  /**
   * Para a execução do bot
   */
  public stop(): void {
    this.setStatus('idle');
    
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }
    
    // Cancelar contratos ativos se existirem
    if (this.currentContract) {
      derivApiService.sellContract(this.currentContract.contract_id)
        .then(() => {
          this.currentContract = null;
        })
        .catch(error => {
          console.error('Erro ao vender contrato ativo:', error);
        });
    }
  }
  
  /**
   * Reseta as estatísticas do bot
   */
  public resetStats(): void {
    this.stats = {
      wins: 0,
      losses: 0,
      totalProfit: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0
    };
    
    this.emitEvent({ type: 'stats_updated', stats: { ...this.stats } });
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
   * Simula a lógica de trading com base na estratégia selecionada
   * Esta função seria substituída pela lógica real baseada no XML da estratégia
   */
  private startTrading(): void {
    if (this.status !== 'running') {
      console.log('[BOT_SERVICE] Bot não está em execução, retornando');
      return;
    }
    
    console.log(`[BOT_SERVICE] Verificando limites: lucro=${this.stats.totalProfit}, meta=${this.settings.profitTarget}, limite perda=${this.settings.lossLimit}`);
    
    // Verificar se atingiu o limite de lucro ou perda
    if (this.stats.totalProfit >= this.settings.profitTarget) {
      console.log(`[BOT_SERVICE] Meta de lucro de ${this.settings.profitTarget} atingida!`);
      this.emitEvent({ 
        type: 'status_change', 
        status: 'idle' 
      });
      this.emitEvent({ 
        type: 'error', 
        message: `Meta de lucro de ${this.settings.profitTarget} atingida!` 
      });
      this.setStatus('idle');
      return;
    }
    
    if (-this.stats.totalProfit >= this.settings.lossLimit) {
      console.log(`[BOT_SERVICE] Limite de perda de ${this.settings.lossLimit} atingido!`);
      this.emitEvent({ 
        type: 'status_change', 
        status: 'idle' 
      });
      this.emitEvent({ 
        type: 'error', 
        message: `Limite de perda de ${this.settings.lossLimit} atingido!` 
      });
      this.setStatus('idle');
      return;
    }
    
    // Se já existe um contrato em andamento, não iniciar outro
    if (this.currentContract !== null) {
      console.log('[BOT_SERVICE] Já existe um contrato em andamento, aguardando resultado');
      return;
    }
    
    // Calcular valor da entrada com base em martingale se necessário
    let entryValue = this.settings.entryValue;
    if (this.stats.consecutiveLosses > 0) {
      // Aplicar martingale após perdas consecutivas
      entryValue = entryValue * Math.pow(this.settings.martingaleFactor, this.stats.consecutiveLosses);
      entryValue = parseFloat(entryValue.toFixed(2)); // Arredondar para 2 casas decimais
      console.log(`[BOT_SERVICE] Aplicando martingale após ${this.stats.consecutiveLosses} perdas, novo valor: ${entryValue}`);
    }
    
    // Verificar se o último dígito recebido é adequado para a estratégia
    const lastDigitReceived = this.lastDigit;
    console.log(`[BOT_SERVICE] Último dígito para análise: ${lastDigitReceived}`);
    
    // Usar a estratégia selecionada
    // Para DIGITOVER e DIGITUNDER, verificamos o último dígito
    const contractType = this.settings.contractType || 'DIGITOVER';
    const prediction = this.settings.prediction || 5;
    
    // Validar se devemos fazer a operação com base no último dígito (lógica simplificada)
    let shouldTrade = true;
    
    // Exemplo de lógica de trading baseada no último dígito
    // Isso seria customizado com base no XML da estratégia
    if (contractType === 'DIGITOVER') {
      // Para DIGITOVER, verificamos se o último dígito é maior que o prediction
      shouldTrade = lastDigitReceived > prediction;
      console.log(`[BOT_SERVICE] Avaliando DIGITOVER: ${lastDigitReceived} > ${prediction} = ${shouldTrade}`);
    } else if (contractType === 'DIGITUNDER') {
      // Para DIGITUNDER, verificamos se o último dígito é menor que o prediction
      shouldTrade = lastDigitReceived < prediction;
      console.log(`[BOT_SERVICE] Avaliando DIGITUNDER: ${lastDigitReceived} < ${prediction} = ${shouldTrade}`);
    }
    
    // Executar a operação se a análise indicar que devemos operar
    if (shouldTrade) {
      console.log(`[BOT_SERVICE] Condições favoráveis para operação, executando...`);
      this.executeOperation(entryValue, contractType, prediction);
    } else {
      console.log(`[BOT_SERVICE] Condições desfavoráveis, aguardando próximo tick...`);
      // Tentar novamente no próximo tick
      this.operationTimer = setTimeout(() => {
        if (this.status === 'running') {
          this.startTrading();
        }
      }, 2000);
    }
  }
  
  /**
   * Executa uma operação de compra de contrato
   */
  private async executeOperation(
    amount: number, 
    type: ContractType, 
    prediction: ContractPrediction
  ): Promise<void> {
    try {
      console.log(`[BOT_SERVICE] Iniciando operação: ${type} ${prediction} valor=${amount}`);
      
      // IMPORTANTE: Verificar token OAuth antes da operação
      const oauthToken = localStorage.getItem('deriv_oauth_token');
      if (!oauthToken) {
        console.error('[BOT_SERVICE] Token OAuth não disponível');
        this.emitEvent({ 
          type: 'error', 
          message: 'Token OAuth não disponível. Reconecte sua conta no Dashboard' 
        });
        
        this.operationTimer = setTimeout(() => {
          if (this.status === 'running') {
            this.startTrading();
          }
        }, 10000);
        
        return;
      }
      
      console.log('[BOT_SERVICE] Comprando contrato...');
      const contract = await derivApiService.buyContract(amount, type, 'R_100', 1, prediction);
      
      if (!contract) {
        console.error('[BOT_SERVICE] Falha ao comprar contrato. Token OAuth pode estar inválido');
        this.emitEvent({ type: 'error', message: 'Falha ao comprar contrato. Verifique seu token OAuth' });
        
        // Tentar novamente após um intervalo
        this.operationTimer = setTimeout(() => {
          if (this.status === 'running') {
            this.startTrading();
          }
        }, 5000);
        
        return;
      }
      
      this.currentContract = contract;
      this.emitEvent({ type: 'operation_started', contract });
      
      // O resultado será processado no evento de atualização de contrato
    } catch (error) {
      this.emitEvent({ type: 'error', message: `Erro ao executar operação: ${error}` });
      
      // Tentar novamente após um intervalo
      this.operationTimer = setTimeout(() => {
        if (this.status === 'running') {
          this.startTrading();
        }
      }, 5000);
    }
  }
  
  /**
   * Manipula atualizações de contratos
   */
  private handleContractUpdate(contract: Contract): void {
    if (!this.currentContract || this.currentContract.contract_id !== contract.contract_id) {
      return;
    }
    
    // Verificar se o contrato foi fechado
    if (contract.status !== 'open') {
      const isWin = contract.profit && contract.profit > 0;
      const result = isWin ? 'win' : 'loss';
      const profit = contract.profit || 0;
      
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
      this.stats.lastOperation = {
        result,
        profit,
        contractId: contract.contract_id,
        contractType: contract.contract_type,
        entryValue: contract.buy_price
      };
      
      // Notificar sobre a conclusão da operação
      this.emitEvent({ 
        type: 'operation_finished', 
        result, 
        profit, 
        contract 
      });
      
      // Atualizar estatísticas
      this.emitEvent({ 
        type: 'stats_updated', 
        stats: { ...this.stats } 
      });
      
      // Limpar o contrato atual
      this.currentContract = null;
      
      // Aguardar um pouco antes da próxima operação
      this.operationTimer = setTimeout(() => {
        if (this.status === 'running') {
          this.startTrading();
        }
      }, 3000);
    }
  }
  
  /**
   * Manipula atualizações de saldo
   */
  private handleBalanceUpdate(balance: any): void {
    if (balance) {
      this.emitEvent({ 
        type: 'balance_update', 
        balance: balance.balance, 
        currency: balance.currency 
      });
    }
  }
  
  /**
   * Define o status do bot e emite o evento correspondente
   */
  private setStatus(status: BotStatus): void {
    this.status = status;
    this.emitEvent({ type: 'status_change', status });
  }
  
  /**
   * Emite um evento para todos os ouvintes registrados
   */
  private emitEvent(event: BotEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Erro ao processar evento do bot:', error);
      }
    });
  }
}

// Função para verificar o estado de autorização
function isApiAuthorized(): boolean {
  return (derivApiService as any).authorized || false;
}

// Exporta uma instância única do serviço
export const botService = new BotService();
export default botService;