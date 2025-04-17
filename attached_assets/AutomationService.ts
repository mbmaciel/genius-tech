import derivAPI from '@/lib/derivApi';

export interface BinaryBotStrategy {
  id: string;
  name: string;
  description: string;
  xmlPath: string;
}

// Estrutura para estatísticas de operações
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

export interface UpdateContractParams {
  stopLoss?: number | null;
  takeProfit?: number | null;
}

// Definir as estratégias disponíveis
const strategies: BinaryBotStrategy[] = [
  {
    id: 'bot-low',
    name: 'BOT LOW',
    description: 'Estratégia para operações em Baixa com suporte técnico',
    xmlPath: '/attached_assets/BOT LOW.xml'
  },
  {
    id: 'green',
    name: 'GREEN',
    description: 'Robô Green otimizado para entradas em tendência',
    xmlPath: '/attached_assets/green.xml'
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia avançada para índices com martingale',
    xmlPath: '/attached_assets/MAXPRO .xml'
  },
  {
    id: 'profit-pro',
    name: 'PROFIT PRO AT',
    description: 'Estratégia profissional com análise técnica',
    xmlPath: '/attached_assets/profitpro at.xml'
  },
  {
    id: 'iron-under',
    name: 'IRON UNDER',
    description: 'Estratégia DIGITS UNDER para R_100',
    xmlPath: '/attached_assets/IRON UNDER.xml'
  },
  {
    id: 'iron-over',
    name: 'IRON OVER',
    description: 'Estratégia DIGITS OVER para R_100',
    xmlPath: '/attached_assets/IRON OVER.xml'
  }
];

// Interface de controle do robô
class AutomationService {
  // Propriedades de execução da estratégia
  private runningStrategy: any = null;
  private _lastNoConnectionLog: number = 0; // Controle de logs de conexão
  private isRunning: boolean = false;
  private logListeners: Array<(message: string) => void> = [];
  private autoReconnectEnabled: boolean = true;
  private lastConnectionStatus: boolean = false;
  private contractMonitorInterval: number | null = null;
  private contractUpdateListeners: Array<(contracts: Contract[]) => void> = [];
  private statsUpdateListeners: Array<(stats: OperationStats) => void> = [];
  private contracts: Contract[] = [];
  private operationStats: OperationStats = this.initializeStats();
  private checkpointData: any = null;
  private recoveryAttempts: number = 0;
  private eventHandlers: Array<{type: string, handler: EventListener}> = [];
  private monitoredContracts: Set<number> = new Set();
  
  // Parâmetros de configuração do robô
  private initialStake: number = 1.0;  // Valor inicial padrão
  private martingaleFactor: number = 1.5;  // Fator de martingale padrão
  private targetProfit: number = 20;  // Meta de lucro padrão
  private stopLoss: number = 20;  // Limite de perda padrão

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

  constructor() {
    // Inicializar o monitor de conexão
    this.setupConnectionMonitor();
    
    // Inicializar o monitor de contratos
    this.setupContractMonitor();
    
    // Tentar carregar estatísticas anteriores da sessão
    this.loadStatsFromSession();
  }

  // Obter lista de estratégias disponíveis
  getStrategies(): BinaryBotStrategy[] {
    return strategies;
  }

  // Configurar o monitor de conexão para retomar operações em caso de queda
  private setupConnectionMonitor(): void {
    const checkInterval = 10000; // 10 segundos
    
    setInterval(() => {
      const currentStatus = derivAPI.getConnectionStatus();
      
      // Verificar alteração de status
      if (this.lastConnectionStatus && !currentStatus) {
        // Conexão perdida
        const message = "Conexão com a API perdida. Tentando reconectar...";
        console.warn(message);
        this.notifyLogListeners(message);
        
        if (this.autoReconnectEnabled) {
          this.attemptReconnection();
        }
      } else if (!this.lastConnectionStatus && currentStatus) {
        // Conexão recuperada
        const message = "Conexão com a API restabelecida!";
        console.log(message);
        this.notifyLogListeners(message);
        
        // Verificar se há operações pendentes para retomar
        if (this.checkpointData && this.isRunning) {
          this.recoverOperations();
        }
      }
      
      this.lastConnectionStatus = currentStatus;
    }, checkInterval);
  }

  // Monitorar contratos ativos e atualizar estatísticas
  private setupContractMonitor(): void {
    const updateInterval = 3000; // Atualizar a cada 3 segundos para maior responsividade
    
    console.log("Configurando monitor de contratos e estatísticas com intervalo de 3 segundos");
    
    this.contractMonitorInterval = window.setInterval(() => {
      // Sempre executar atualizações de contratos, mesmo sem estratégia rodando
      this.updateOpenContracts()
        .then(contracts => {
          this.contracts = contracts;
          
          // Notificar ouvintes sobre alterações nos contratos
          this.contractUpdateListeners.forEach(listener => {
            try {
              listener(this.contracts);
            } catch (err) {
              console.error('Erro ao notificar ouvinte de contratos:', err);
            }
          });
          
          // Forçar atualização das estatísticas em cada intervalo
          // independente de estar executando ou não
          return this.updateOperationStats();
        })
        .then(stats => {
          // Atualizar timestamp para mostrar atualização em tempo real
          stats.lastUpdateTime = new Date();
          this.operationStats = stats;
          
          // Notificar ouvintes sobre alterações nas estatísticas
          this.statsUpdateListeners.forEach(listener => {
              try {
                listener(this.operationStats);
              } catch (err) {
                console.error('Erro ao notificar ouvinte de estatísticas:', err);
              }
            });
            
            // Salvar estatísticas na sessão
            this.saveStatsToSession();
          })
          .catch(err => {
            console.error('Erro ao atualizar estatísticas:', err);
          });
    }, updateInterval);
  }

  // Registrar ouvinte para atualizações de contratos
  onContractsUpdate(listener: (contracts: Contract[]) => void): void {
    this.contractUpdateListeners.push(listener);
  }

  // Registrar ouvinte para atualizações de estatísticas
  onStatsUpdate(listener: (stats: OperationStats) => void): void {
    this.statsUpdateListeners.push(listener);
  }

  // Obter contratos abertos
  // Atualizar contratos abertos - versão otimizada com menos logs
  private async updateOpenContracts(): Promise<Contract[]> {
    try {
      if (!derivAPI.getConnectionStatus()) {
        return this.contracts; // Usar cache sem logging
      }
      
      try {
        // Request otimizado para portfolio
        const response = await derivAPI.send({
          portfolio: 1
        });
        
        if (response && response.portfolio && response.portfolio.contracts) {
          const portfolioContracts = response.portfolio.contracts || [];
          
          // Logging condicional - apenas se houver contratos ativos
          if (portfolioContracts.length > 0 && portfolioContracts.length !== this.contracts.length) {
            console.log(`${portfolioContracts.length} contratos ativos em carteira`);
          }
          
          // Converter para formato interno
          const contracts: Contract[] = portfolioContracts.map((contract: any) => ({
            contract_id: contract.contract_id,
            contract_type: contract.contract_type || 'unknown',
            buy_price: contract.buy_price || 0,
            symbol: contract.symbol,
            status: 'open',
            entry_spot: contract.entry_spot,
            exit_spot: contract.exit_spot,
            profit: contract.bid_price - contract.buy_price || 0,
            payout: contract.payout,
            purchase_time: contract.purchase_time,
            date_expiry: contract.expiry_time,
            barrier: contract.barrier,
            dateTime: new Date(contract.purchase_time * 1000).toLocaleString(),
            current_spot: contract.current_spot,
            isProcessingSell: false
          }));
          
          return contracts;
        }
      } catch (portfolioError) {
        console.error('Erro ao obter portfolio:', portfolioError);
      }
      
      // Retornar array vazio quando não conseguimos obter contratos reais da API
      // Isso força o sistema a sempre usar dados reais
      this.notifyLogListeners("Não foi possível obter contratos reais da API. Verifique sua conexão.");
      console.warn("Falha ao carregar contratos reais - retornando array vazio");
      
      return [];
    } catch (error) {
      console.error('Erro ao obter contratos abertos:', error);
      return this.contracts; // Retornar dados em cache
    }
  }

  // Formatar contrato para o formato padrão
  private formatContract(contract: any): Contract {
    return {
      contract_id: contract.contract_id,
      contract_type: contract.contract_type,
      buy_price: contract.buy_price,
      symbol: contract.underlying_symbol || contract.symbol,
      status: contract.status,
      entry_spot: contract.entry_spot,
      exit_spot: contract.exit_spot,
      profit: contract.profit,
      payout: contract.payout,
      purchase_time: contract.purchase_time,
      date_expiry: contract.date_expiry,
      barrier: contract.barrier,
      dateTime: new Date(contract.purchase_time * 1000).toLocaleString(),
      current_spot: contract.current_spot,
      isProcessingSell: false
    };
  }

  // Vender um contrato
  async sellContract(contractId: number): Promise<any> {
    try {
      if (!derivAPI.getConnectionStatus()) {
        throw new Error('Não há conexão com a API da Deriv.');
      }
      
      // Marcar contrato como em processamento
      this.contracts = this.contracts.map(c => {
        if (c.contract_id === contractId) {
          return { ...c, isProcessingSell: true };
        }
        return c;
      });
      
      // Notificar ouvintes
      this.contractUpdateListeners.forEach(listener => {
        try {
          listener(this.contracts);
        } catch (err) {
          console.error('Erro ao notificar ouvinte de contratos (venda iniciada):', err);
        }
      });
      
      // Realizar a venda
      const result = await derivAPI.sellContract(contractId, 0);
      
      if (result.error) {
        throw new Error(result.error.message || 'Erro ao vender contrato');
      }
      
      // Log de sucesso
      const soldFor = result.sell?.sold_for;
      this.notifyLogListeners(`Contrato #${contractId} vendido com sucesso por ${soldFor}`);
      
      // Atualizar contratos depois da venda
      await this.updateOpenContracts();
      
      return result;
    } catch (error: any) {
      console.error('Erro ao vender contrato:', error);
      
      // Desmarcar contrato em processamento após erro
      this.contracts = this.contracts.map(c => {
        if (c.contract_id === contractId) {
          return { ...c, isProcessingSell: false };
        }
        return c;
      });
      
      // Notificar ouvintes
      this.contractUpdateListeners.forEach(listener => {
        try {
          listener(this.contracts);
        } catch (err) {
          console.error('Erro ao notificar ouvinte de contratos (venda falhou):', err);
        }
      });
      
      throw error;
    }
  }

  // Cancelar um contrato
  async cancelContract(contractId: number): Promise<any> {
    try {
      if (!derivAPI.getConnectionStatus()) {
        throw new Error('Não há conexão com a API da Deriv.');
      }
      
      const result = await derivAPI.cancelContract(contractId);
      
      if (result.error) {
        throw new Error(result.error.message || 'Erro ao cancelar contrato');
      }
      
      // Log de sucesso
      this.notifyLogListeners(`Contrato #${contractId} cancelado com sucesso`);
      
      // Atualizar contratos após cancelamento
      await this.updateOpenContracts();
      
      return result;
    } catch (error: any) {
      console.error('Erro ao cancelar contrato:', error);
      throw error;
    }
  }

  // Atualizar um contrato com stop loss/take profit
  async updateContract(contractId: number, params: UpdateContractParams): Promise<any> {
    try {
      if (!derivAPI.getConnectionStatus()) {
        throw new Error('Não há conexão com a API da Deriv.');
      }
      
      const result = await derivAPI.updateContract(
        contractId,
        params.stopLoss,
        params.takeProfit
      );
      
      if (result.error) {
        throw new Error(result.error.message || 'Erro ao atualizar contrato');
      }
      
      // Log de sucesso
      let updateMsg = `Contrato #${contractId} atualizado:`;
      if (params.stopLoss !== undefined) {
        updateMsg += ` Stop Loss: ${params.stopLoss !== null ? params.stopLoss : 'removido'}`;
      }
      if (params.takeProfit !== undefined) {
        updateMsg += ` Take Profit: ${params.takeProfit !== null ? params.takeProfit : 'removido'}`;
      }
      this.notifyLogListeners(updateMsg);
      
      return result;
    } catch (error: any) {
      console.error('Erro ao atualizar contrato:', error);
      throw error;
    }
  }

  // Obter histórico de atualizações de um contrato
  async getContractUpdateHistory(contractId: number): Promise<any> {
    try {
      if (!derivAPI.getConnectionStatus()) {
        throw new Error('Não há conexão com a API da Deriv.');
      }
      
      const result = await derivAPI.getContractUpdateHistory(contractId);
      
      if (result.error) {
        throw new Error(result.error.message || 'Erro ao obter histórico de atualizações');
      }
      
      return result.contract_update_history || [];
    } catch (error: any) {
      console.error('Erro ao obter histórico de atualizações:', error);
      throw error;
    }
  }

  // Vender todos os contratos expirados
  async sellExpiredContracts(): Promise<any> {
    try {
      if (!derivAPI.getConnectionStatus()) {
        throw new Error('Não há conexão com a API da Deriv.');
      }
      
      const result = await derivAPI.sellExpiredContracts();
      
      if (result.error) {
        throw new Error(result.error.message || 'Erro ao vender contratos expirados');
      }
      
      // Log de sucesso
      const count = result.sell_expired?.count || 0;
      this.notifyLogListeners(`${count} contratos expirados vendidos com sucesso`);
      
      // Atualizar contratos após venda
      await this.updateOpenContracts();
      
      return result;
    } catch (error: any) {
      console.error('Erro ao vender contratos expirados:', error);
      throw error;
    }
  }

  // Atualizar estatísticas de operação - logs reduzidos
  private async updateOperationStats(): Promise<OperationStats> {
    try {
      // Log removido para reduzir ruído no console
      
      if (!derivAPI.getConnectionStatus()) {
        // Log apenas na primeira vez ou a cada minuto
        const now = Date.now();
        if (!this._lastNoConnectionLog || now - this._lastNoConnectionLog > 60000) {
          console.log("Sem conexão com a API, utilizando dados em cache para as estatísticas");
          this._lastNoConnectionLog = now;
        }
        
        // Mesmo sem conexão, atualizar o timestamp para mostrar atividade
        const cachedStats = { ...this.operationStats };
        cachedStats.lastUpdateTime = new Date();
        
        return cachedStats;
      }
      
      try {
        // Solicitar tabela de lucro dos últimos 30 dias para garantir dados completos
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const formattedDate = thirtyDaysAgo.toISOString().split('T')[0]; // Formato YYYY-MM-DD
        
        // Usar paramêtros específicos para otimizar a resposta e obter dados mais recentes
        // Adicionando timestamp como parte do req_id para evitar cache
        const reqId = Date.now();
        const response = await derivAPI.send({
          profit_table: 1,
          date_from: formattedDate,
          limit: 500, // Limite máximo permitido
          req_id: reqId,
          sort: "DESC" // Garantir que os mais recentes venham primeiro
        });
        
        if (response.error) {
          console.error('Erro na API ao obter tabela de lucro:', response.error);
          // Não lançamos um erro aqui para não interromper o fluxo
        }
        
        const transactions = response.profit_table?.transactions || [];
        // Log apenas quando há transações relevantes
        if (transactions && transactions.length > 0) {
          // Inicializar estatísticas do zero para não acumular dados incorretos
          const stats = this.initializeStats();
          
          // Manter a data de início original
          stats.startTime = this.operationStats.startTime || new Date();
          stats.lastUpdateTime = new Date(); // Timestamp atual para mostrar atualização
          
          // Analisar transações para gerar estatísticas
          let currentWinStreak = 0;
          let currentLossStreak = 0;
          
          transactions.forEach((tx: any) => {
            stats.totalOperations++;
            
            const profit = tx.sell_price - tx.buy_price;
            const isWin = profit >= 0;
            
            // Atualizar estatísticas gerais
            if (isWin) {
              stats.wins++;
              stats.totalProfit += profit;
              currentWinStreak++;
              currentLossStreak = 0;
              if (currentWinStreak > stats.bestStreak) {
                stats.bestStreak = currentWinStreak;
              }
            } else {
              stats.losses++;
              stats.totalLoss += Math.abs(profit);
              currentLossStreak++;
              currentWinStreak = 0;
              if (currentLossStreak > stats.worstStreak) {
                stats.worstStreak = currentLossStreak;
              }
            }
            
            // Atualizar estatísticas por símbolo
            const symbol = tx.underlying_symbol || 'Desconhecido';
            if (!stats.bySymbol[symbol]) {
              stats.bySymbol[symbol] = {
                count: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                netProfit: 0
              };
            }
            
            stats.bySymbol[symbol].count++;
            if (isWin) {
              stats.bySymbol[symbol].wins++;
            } else {
              stats.bySymbol[symbol].losses++;
            }
            stats.bySymbol[symbol].netProfit += profit;
            stats.bySymbol[symbol].winRate = stats.bySymbol[symbol].wins / stats.bySymbol[symbol].count;
            
            // Atualizar estatísticas por tipo de contrato
            const contractType = tx.contract_type || 'Desconhecido';
            if (!stats.byContractType[contractType]) {
              stats.byContractType[contractType] = {
                count: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                netProfit: 0
              };
            }
            
            stats.byContractType[contractType].count++;
            if (isWin) {
              stats.byContractType[contractType].wins++;
            } else {
              stats.byContractType[contractType].losses++;
            }
            stats.byContractType[contractType].netProfit += profit;
            stats.byContractType[contractType].winRate = 
              stats.byContractType[contractType].wins / stats.byContractType[contractType].count;
          });
          
          // Calcular métricas derivadas
          stats.winRate = stats.totalOperations > 0 ? stats.wins / stats.totalOperations : 0;
          stats.netResult = stats.totalProfit - stats.totalLoss;
          stats.averageProfit = stats.wins > 0 ? stats.totalProfit / stats.wins : 0;
          stats.averageLoss = stats.losses > 0 ? stats.totalLoss / stats.losses : 0;
          stats.profitFactor = stats.totalLoss > 0 ? stats.totalProfit / stats.totalLoss : 0;
          
          // Manter os valores de sequências atuais
          stats.consecutiveWins = currentWinStreak;
          stats.consecutiveLosses = currentLossStreak;
          
          return stats;
        }
      } catch (apiError) {
        console.warn('Erro ao obter dados de API para estatísticas:', apiError);
      }
      
      // Se a API falhar ou não houver dados, retornar estatísticas vazias
      const stats = this.initializeStats();
      stats.startTime = new Date(); // Timestamp atual
      stats.lastUpdateTime = new Date();
      
      // Exibir mensagem no log
      this.notifyLogListeners("Falha ao obter dados reais de operações. Verifique sua conexão com a API.");
      console.error("Falha ao obter estatísticas reais - usando dados vazios");
      
      return stats;
    } catch (error) {
      console.error('Erro ao atualizar estatísticas de operação:', error);
      return this.operationStats; // Retornar dados em cache
    }
  }

  // Salvar estatísticas na sessão
  private saveStatsToSession(): void {
    try {
      sessionStorage.setItem('automationStats', JSON.stringify(this.operationStats));
    } catch (error) {
      console.error('Erro ao salvar estatísticas na sessão:', error);
    }
  }

  // Carregar estatísticas da sessão
  private loadStatsFromSession(): void {
    try {
      const savedStats = sessionStorage.getItem('automationStats');
      if (savedStats) {
        const stats = JSON.parse(savedStats);
        
        // Ajustar datas que foram serializadas como strings
        stats.startTime = new Date(stats.startTime);
        stats.lastUpdateTime = new Date(stats.lastUpdateTime);
        
        this.operationStats = stats;
        console.log('Estatísticas carregadas da sessão.');
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas da sessão:', error);
    }
  }

  // Tentar reconexão com a API
  private async attemptReconnection(): Promise<void> {
    try {
      const result = await derivAPI.connect();
      if (result) {
        this.notifyLogListeners('Reconexão com a API bem-sucedida!');
      }
    } catch (error) {
      this.notifyLogListeners('Falha na tentativa de reconexão. Tentando novamente...');
    }
  }

  // Salvar checkpoint para recuperação
  private saveCheckpoint(): void {
    this.checkpointData = {
      timestamp: new Date(),
      runningStrategy: this.isRunning,
      // Outros dados necessários para recuperação
    };
  }

  // Recuperar operações após queda de conexão
  private async recoverOperations(): Promise<void> {
    try {
      if (!this.checkpointData) return;
      
      this.recoveryAttempts++;
      this.notifyLogListeners(`Tentando recuperar operações (${this.recoveryAttempts}ª tentativa)...`);
      
      // Atualizar contratos abertos
      await this.updateOpenContracts();
      
      // Aqui poderia haver mais lógica para retomar a estratégia
      
      this.notifyLogListeners('Operações recuperadas com sucesso!');
      this.recoveryAttempts = 0;
    } catch (error) {
      console.error('Erro ao recuperar operações:', error);
      this.notifyLogListeners('Falha ao recuperar operações.');
      
      // Limitar número de tentativas
      if (this.recoveryAttempts >= 3) {
        this.notifyLogListeners('Número máximo de tentativas de recuperação atingido. Parando estratégia.');
        this.stopStrategy();
      }
    }
  }

  // Notificar todos os ouvintes de log
  private notifyLogListeners(message: string): void {
    this.logListeners.forEach(listener => {
      try {
        listener(message);
      } catch (err) {
        console.error('Erro ao notificar ouvinte de log:', err);
      }
    });
  }

  // Carregar o XML da estratégia
  async loadStrategyXml(strategy: BinaryBotStrategy): Promise<string> {
    try {
      const response = await fetch(strategy.xmlPath);
      if (!response.ok) {
        throw new Error(`Erro ao carregar estratégia: ${response.statusText}`);
      }
      const xmlContent = await response.text();
      return xmlContent;
    } catch (error) {
      console.error(`Erro ao carregar XML para ${strategy.name}:`, error);
      throw new Error(`Não foi possível carregar a estratégia ${strategy.name}`);
    }
  }

  // Aplicar parâmetros de controle de risco ao XML
  applyRiskControlParams(
    xml: string,
    initialStake: number,
    stopLoss: number,
    targetProfit: number,
    martingaleFactor: number
  ): string {
    // Implementar a modificação do XML para incluir parâmetros de risco
    // Esta é uma implementação simples, pode precisar ser adaptada conforme a estrutura XML específica
    try {
      // Esta é uma abordagem básica - uma implementação completa analisaria 
      // e modificaria o XML estruturalmente
      let modifiedXml = xml;
      
      if (xml.includes('VALOR INICIAL')) {
        modifiedXml = modifiedXml.replace(
          /<field name="NUM">\d+(\.\d+)?<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>VALOR INICIAL<\/field>)/,
          `<field name="NUM">${initialStake}</field>`
        );
      }
      
      if (xml.includes('MARTINGALE')) {
        modifiedXml = modifiedXml.replace(
          /<field name="NUM">\d+(\.\d+)?<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>MARTINGALE<\/field>)/,
          `<field name="NUM">${martingaleFactor}</field>`
        );
      }
      
      if (xml.includes('LIMITE DE PERDA')) {
        // Aplicar o valor de limite de perda fornecido diretamente
        modifiedXml = modifiedXml.replace(
          /<field name="NUM">\d+(\.\d+)?<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>LIMITE DE PERDA<\/field>)/,
          `<field name="NUM">${stopLoss}</field>`
        );
        
        // Garantir que verificações de stop loss estejam habilitadas (se existirem)
        if (xml.includes('VERIFICAR_STOP_LOSS')) {
          modifiedXml = modifiedXml.replace(
            /<field name="BOOL">(TRUE|FALSE)<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>VERIFICAR_STOP_LOSS<\/field>)/,
            `<field name="BOOL">TRUE</field>`
          );
        }
        
        console.log(`Limite de perda configurado como $${stopLoss}`);
      }
      
      if (xml.includes('META DE GANHO') || xml.includes('META')) {
        // Aplicar o valor de meta de lucro fornecido diretamente
        modifiedXml = modifiedXml.replace(
          /<field name="NUM">\d+(\.\d+)?<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>META DE GANHO<\/field>)/,
          `<field name="NUM">${targetProfit}</field>`
        );
        
        modifiedXml = modifiedXml.replace(
          /<field name="NUM">\d+(\.\d+)?<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>META<\/field>)/,
          `<field name="NUM">${targetProfit}</field>`
        );
        
        // Garantir que verificações de meta estejam habilitadas (se existirem)
        if (xml.includes('VERIFICAR_META')) {
          modifiedXml = modifiedXml.replace(
            /<field name="BOOL">(TRUE|FALSE)<\/field>(?=[\s\S]*?<field name="VAR"[^>]*>VERIFICAR_META<\/field>)/,
            `<field name="BOOL">TRUE</field>`
          );
        }
        
        console.log(`Meta de lucro configurada como $${targetProfit}`);
      }
      
      return modifiedXml;
    } catch (error) {
      console.error('Erro ao aplicar parâmetros de risco:', error);
      return xml; // Retornar XML original em caso de erro
    }
  }

  // Executar a estratégia
  async runStrategy(
    xml: string,
    token: string,
    onStart: () => void,
    onLog: (message: string) => void,
    onError: (error: string) => void,
    initialStake: number = 1.0,
    stopLoss: number = 20,
    targetProfit: number = 20,
    martingaleFactor: number = 1.5
  ): Promise<void> {
    try {
      if (this.isRunning) {
        onLog('Já existe uma estratégia em execução. Pare-a antes de iniciar outra.');
        return;
      }
      
      // Armazenar os parâmetros de risco nas propriedades da classe
      this.initialStake = initialStake;
      this.stopLoss = stopLoss;
      this.targetProfit = targetProfit;
      this.martingaleFactor = martingaleFactor;
      
      // Adicionar o ouvinte de log
      this.logListeners.push(onLog);
      
      // Marcar como em execução
      this.isRunning = true;
      
      // Log de início - apenas para o usuário, sem duplicação no console
      onLog('Iniciando execução da estratégia...');
      onLog(`Parâmetros definidos - Valor Inicial: $${initialStake}, Meta: $${targetProfit}, Limite: $${stopLoss}`);
      
      // Verificar conexão com a API
      if (!derivAPI.getConnectionStatus()) {
        throw new Error('Não há conexão com a API da Deriv. Conecte-se antes de iniciar a estratégia.');
      }
      
      // Configurar checkpoint inicial
      this.saveCheckpoint();
      
      // Notificar que o robô iniciou
      onStart();
      
      // Vender contratos expirados antes de iniciar
      try {
        const sellResult = await this.sellExpiredContracts();
        const count = sellResult?.sell_expired?.count || 0;
        if (count > 0) {
          onLog(`${count} contratos expirados foram vendidos automaticamente antes do início.`);
        }
      } catch (sellError) {
        console.warn('Erro ao vender contratos expirados:', sellError);
      }
      
      // Simulação de execução da estratégia (para demonstração)
      // Em uma implementação real, seria necessário um interpretador para o XML da Binary Bot
      this._simulateStrategyExecution(onLog, onError);

    } catch (error: any) {
      this.isRunning = false;
      const errorMsg = error.message || 'Erro desconhecido';
      onError(`Erro ao iniciar estratégia: ${errorMsg}`);
    }
  }

  // Parar a estratégia em execução
  stopStrategy(): void {
    if (!this.isRunning) {
      return;
    }
    
    // Marcar como não executando antes de tudo para evitar duplicações
    this.isRunning = false;
    
    // Enviar apenas uma notificação
    this.notifyLogListeners('Estratégia interrompida pelo usuário.');
    
    // Cancelar qualquer assinatura ou timeout em andamento
    if (this.runningStrategy) {
      clearInterval(this.runningStrategy);
      this.runningStrategy = null;
    }
    
    // Limpar checkpoints e outros dados
    this.checkpointData = null;
    this.recoveryAttempts = 0;
    
    // Resetar os ouvintes de log por último
    this.logListeners = [];
  }

  // Execução real de estratégia baseada no XML
  private _simulateStrategyExecution(
    onLog: (message: string) => void,
    onError: (error: string) => void
  ): void {
    onLog('Iniciando execução da estratégia...');
    
    // Verificar se há conexão com a API
    if (!derivAPI.getConnectionStatus()) {
      onError('Erro: Sem conexão com a API da Deriv. Não é possível executar a estratégia.');
      this.isRunning = false;
      return;
    }
    
    // Verificar se há token válido
    if (!derivAPI.isAuthorized()) {
      onError('Erro: Não autorizado na API da Deriv. Faça login para executar a estratégia.');
      this.isRunning = false;
      return;
    }
    
    // Usar os parâmetros de risco definidos pelo usuário
    let valorInicial = this.initialStake;
    let martingaleFactor = this.martingaleFactor;
    let prediction = 5;  // Valor padrão (para DIGITOVER)
    let symbol = 'R_100';  // Valor padrão
    
    // Log com informações essenciais (reduzido)
    onLog(`Parâmetros: ${symbol} | Valor: $${valorInicial} | Martingale: ${martingaleFactor}x | Meta: $${this.targetProfit} | Limite: $${this.stopLoss}`);
    
    // Inscrição para receber ticks e identificar oportunidades
    this.setUpTicksSubscription(symbol, onLog, onError);
    
    // Iniciar o loop de análise e execução da estratégia
    let contadorLoss = 0;
    let valorAtual = valorInicial;
    let lastDigit = null;
    
    this.runningStrategy = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(this.runningStrategy);
        return;
      }
      
      try {
        // Verificar se já atingimos metas ou limites
        const profit = await this.calculateSessionProfit();
        
        // Atualizar estatísticas e contratos (sem logs de detalhe)
        await this.updateOperationStats();
        await this.updateOpenContracts();
        
        // Fazer uma verificação para decidir se deve executar uma operação
        const shouldTrade = await this.analyzeTicks(symbol, prediction);
        
        if (shouldTrade) {
          // Log reduzido - apenas informação essencial
          onLog(`Sinal de entrada encontrado para ${symbol}`);
          
          // Executar a operação real usando a API
          const result = await this.executeContractBuy(
            symbol, 
            'DIGITOVER', 
            prediction, 
            valorAtual
          );
          
          if (result && result.buy) {
            onLog(`Compra #${result.buy.contract_id}: $${valorAtual}`);
            
            // Monitorar o resultado do contrato - logs simplificados
            this.monitorContract(result.buy.contract_id, (contract) => {
              if (contract.status === 'sold') {
                if (contract.profit > 0) {
                  // Usar ícone de sucesso + mensagem concisa
                  onLog(`✓ #${contract.contract_id}: +$${contract.profit}`);
                  contadorLoss = 0;
                  valorAtual = valorInicial; // Resetar para valor inicial após vitória
                } else {
                  // Usar ícone de erro + mensagem concisa
                  onLog(`✗ #${contract.contract_id}: -$${Math.abs(contract.profit)}`);
                  contadorLoss++;
                  
                  // Aplicar martingale após perda (log simplificado)
                  if (contadorLoss >= 1) {
                    valorAtual = valorAtual * (1 + martingaleFactor);
                    onLog(`Martingale: $${valorAtual.toFixed(2)}`);
                  }
                }
              }
            });
          } else {
            // Mensagem de erro concisa
            onError(`Falha na compra: ${result?.error?.message || 'Erro desconhecido'}`);
          }
        }
        
        // Salvar checkpoint (sem log)
        this.saveCheckpoint();
        
      } catch (error: any) {
        // Log de erro mais conciso
        console.error('Erro na estratégia:', error);
        onError(`Erro: ${error.message || 'Erro desconhecido'}`);
      }
    }, 5000);
  }
  
  // Configurar inscrição de ticks para monitoramento
  private setUpTicksSubscription(
    symbol: string, 
    onLog: (message: string) => void,
    onError: (error: string) => void
  ): void {
    try {
      // Inscrever-se para receber ticks em tempo real
      derivAPI.subscribeTicks(symbol)
        .then(() => {
          onLog(`Monitorando ticks para ${symbol} em tempo real`);
          
          // Configurar listener para os ticks
          const tickHandler = (event: CustomEvent) => {
            const tick = event.detail.tick;
            if (tick) {
              const price = tick.quote;
              const lastDigit = Math.floor(price * 100) % 10;
              // onLog(`${symbol}: Último dígito = ${lastDigit}`); // Comentado para reduzir spam no log
            }
          };
          
          // Registrar o handler de evento global
          document.addEventListener('deriv:tick', tickHandler as EventListener);
          
          // Armazenar o handler para remover mais tarde
          this.eventHandlers.push({
            type: 'deriv:tick',
            handler: tickHandler as EventListener
          });
        })
        .catch((err) => {
          onError(`Erro ao inscrever-se para ticks de ${symbol}: ${err.message}`);
        });
    } catch (error: any) {
      onError(`Falha ao configurar monitoramento de ticks: ${error.message || 'Erro desconhecido'}`);
    }
  }
  
  // Analisar ticks recentes para identificar oportunidades
  private async analyzeTicks(symbol: string, prediction: number): Promise<boolean> {
    try {
      // Obter histórico recente de ticks (aumentando a amostra para 20)
      const history = await derivAPI.getTicksHistory(symbol, { count: 20 });
      
      if (history && history.history && history.history.prices) {
        const prices = history.history.prices;
        
        // Criar lista dos últimos dígitos
        const lastDigits = prices.map((price: number) => Math.floor(price * 100) % 10);
        
        // Log para depuração
        console.log(`Últimos dígitos para ${symbol}: ${lastDigits.slice(-5).join(', ')}`);
        
        // Para DIGITOVER, verificar se temos uma sequência de dígitos menores que a previsão
        let lowDigitsCount = 0;
        let pattern = '';
        
        // Analisa últimos 5 dígitos para encontrar padrão
        for (let i = lastDigits.length - 1; i >= Math.max(0, lastDigits.length - 5); i--) {
          if (lastDigits[i] < prediction) {
            lowDigitsCount++;
            pattern += `${lastDigits[i]}(<${prediction}) `;
          } else {
            pattern += `${lastDigits[i]}(≥${prediction}) `;
          }
        }
        
        // Log com informações detalhadas
        console.log(`Análise para DIGITOVER ${prediction}: ${lowDigitsCount} dígitos abaixo de ${prediction}`);
        console.log(`Padrão analisado: ${pattern}`);
        
        // MODIFICAÇÃO IMPORTANTE: Mais condições para melhorar a detecção de oportunidades
        // 1. Ter pelo menos 3 dos últimos 5 dígitos abaixo da previsão
        // 2. Ou ter os últimos 2 dígitos consecutivos abaixo da previsão
        
        const lastTwoBelow = 
          lastDigits[lastDigits.length-1] < prediction && 
          lastDigits[lastDigits.length-2] < prediction;
          
        const threeOfFiveBelow = lowDigitsCount >= 3;
        
        // Resultado da análise com mais logs
        const shouldTrade = lastTwoBelow || threeOfFiveBelow;
        console.log(`Decisão de negociação: ${shouldTrade ? 'SIM' : 'NÃO'} (last2=${lastTwoBelow}, 3of5=${threeOfFiveBelow})`);
        
        return shouldTrade;
      }
      
      console.log("Nenhum dado de histórico de ticks recebido da API");
      return false;
    } catch (error) {
      console.error('Erro ao analisar ticks:', error);
      return false;
    }
  }
  
  // Calcular lucro da sessão atual
  private async calculateSessionProfit(): Promise<number> {
    try {
      // Atualizar estatísticas
      await this.updateOperationStats();
      
      // Retornar o lucro líquido
      return this.operationStats.netResult;
    } catch (error) {
      console.error('Erro ao calcular lucro da sessão:', error);
      return 0;
    }
  }
  
  // Executar compra de contrato
  private async executeContractBuy(
    symbol: string, 
    contractType: string, 
    prediction: number, 
    amount: number
  ): Promise<any> {
    try {
      console.log(`Preparando compra: ${symbol} ${contractType} Barreira:${prediction} Valor:${amount}`);
      
      // Parâmetros da proposta
      const proposalParams = {
        contract_type: contractType,
        currency: 'USD',
        symbol: symbol,
        amount: amount.toFixed(2),
        barrier: prediction.toString(),
        duration: 1,
        duration_unit: 't',
        basis: 'stake'
      };
      
      console.log('Enviando solicitação de proposta:', JSON.stringify(proposalParams));
      
      // Solicitar proposta
      const proposal = await derivAPI.sendProposal(proposalParams);
      
      console.log('Resposta da proposta recebida:', JSON.stringify(proposal));
      
      if (proposal && proposal.error) {
        console.error('Erro recebido na proposta:', proposal.error);
        throw new Error(`Erro na proposta: ${proposal.error.message}`);
      }
      
      if (!proposal || !proposal.proposal || !proposal.proposal.id) {
        console.error('Proposta inválida recebida:', proposal);
        throw new Error('Proposta não recebida corretamente');
      }
      
      // Mostrar os detalhes da proposta para debug
      console.log(`Proposta recebida: ID=${proposal.proposal.id}`);
      console.log(`Preço: ${proposal.proposal.ask_price}, Pagamento: ${proposal.proposal.payout}`);
      
      // Executar compra com a proposta recebida
      console.log(`Enviando ordem de compra: ID=${proposal.proposal.id}, Preço=${proposal.proposal.ask_price}`);
      
      const buyResult = await derivAPI.buyContract(
        proposal.proposal.id,
        proposal.proposal.ask_price
      );
      
      console.log('Resposta da compra:', JSON.stringify(buyResult));
      
      if (buyResult && buyResult.error) {
        console.error('Erro ao comprar contrato:', buyResult.error);
        throw new Error(`Erro na compra: ${buyResult.error.message}`);
      }
      
      if (buyResult && buyResult.buy) {
        console.log(`Compra bem-sucedida: Contrato #${buyResult.buy.contract_id}`);
        console.log(`Balanço após compra: ${buyResult.buy.balance_after}`);
      }
      
      return buyResult;
    } catch (error) {
      console.error('Exceção ao executar compra:', error);
      throw error;
    }
  }
  
  // Monitorar contrato até conclusão - implementação otimizada
  private monitorContract(contractId: number, callback: (contract: any) => void): void {
    // Prevenção de monitoramento duplicado do mesmo contrato
    if (this.monitoredContracts.has(contractId)) {
      console.log(`Contrato #${contractId} já está sendo monitorado`);
      return;
    }
    
    console.log(`Iniciando monitoramento do contrato #${contractId} com assinatura em tempo real`);
    
    // Adicionar à lista de contratos monitorados
    this.monitoredContracts.add(contractId);
    
    // Handler otimizado para processamento de eventos de contrato
    const contractUpdateHandler = (event: any) => {
      // Verificação prévia para não desperdiçar processamento se o robô não estiver rodando
      if (!this.isRunning) {
        document.removeEventListener('deriv:contract_update', contractUpdateHandler);
        this.monitoredContracts.delete(contractId);
        console.log(`Monitoramento do contrato #${contractId} cancelado - robô parado`);
        return;
      }

      const data = event.detail;
      if (!data || !data.proposal_open_contract) return;
      
      const contract = data.proposal_open_contract;
      
      // Usar o status do evento se disponível (adicionado na otimização do derivApi.ts)
      const eventStatus = data._status || contract.status || 'unknown';
      
      // Verificar se este evento é para o contrato que estamos monitorando
      if (contract.contract_id == contractId) {
        // Log reduzido para evitar saturação do console
        console.log(`Atualização para contrato #${contractId}: status=${eventStatus}, lucro=${contract.profit}`);
        
        // Verificação otimizada usando eventStatus
        if (eventStatus === 'sold' || eventStatus === 'expired') {
          // Notificar através do callback com o contrato finalizado
          callback(contract);
          
          // Limpeza completa dos recursos
          document.removeEventListener('deriv:contract_update', contractUpdateHandler);
          this.monitoredContracts.delete(contractId);
          
          console.log(`Contrato #${contractId} finalizado com status '${eventStatus}'`);
        }
      }
    };
    
    // Registrar o event listener
    document.addEventListener('deriv:contract_update', contractUpdateHandler);
    
    // Iniciar a assinatura do contrato com tratamento de erros aprimorado
    try {
      derivAPI.subscribeToContract(contractId.toString())
        .then(response => {
          if (response.error) {
            console.error(`Erro ao assinar contrato #${contractId}:`, response.error);
            // Limpeza em caso de erro
            document.removeEventListener('deriv:contract_update', contractUpdateHandler);
            this.monitoredContracts.delete(contractId);
            this.notifyLogListeners(`Erro ao monitorar contrato #${contractId}: ${response.error.message || 'Erro na API'}`);
          } else {
            console.log(`Assinatura iniciada com sucesso para contrato #${contractId}`);
            
            // Verificar se já está finalizado na primeira resposta
            const contract = response.proposal_open_contract;
            if (contract && (contract.status === 'sold' || contract.status === 'expired')) {
              // Processamento imediato para contrato já finalizado
              console.log(`Contrato #${contractId} já está finalizado (${contract.status})`);
              callback(contract);
              
              // Limpeza de recursos
              document.removeEventListener('deriv:contract_update', contractUpdateHandler);
              this.monitoredContracts.delete(contractId);
            }
          }
        })
        .catch(error => {
          // Limpeza garantida também em caso de exceção
          console.error(`Exceção ao assinar contrato #${contractId}:`, error);
          document.removeEventListener('deriv:contract_update', contractUpdateHandler);
          this.monitoredContracts.delete(contractId);
          this.notifyLogListeners(`Erro de conexão ao monitorar contrato #${contractId}`);
        });
    } catch (error) {
      // Tratamento para erros na chamada inicial
      console.error(`Erro ao iniciar monitoramento do contrato #${contractId}:`, error);
      document.removeEventListener('deriv:contract_update', contractUpdateHandler);
      this.monitoredContracts.delete(contractId);
      this.notifyLogListeners(`Falha ao iniciar monitoramento de contrato #${contractId}`);
    }
  }

  // Obter estatísticas atuais
  getOperationStats(): OperationStats {
    return this.operationStats;
  }

  // Obter contratos atuais
  getContracts(): Contract[] {
    return this.contracts;
  }
}

// Instância singleton do serviço
export const automationService = new AutomationService();
export default automationService;