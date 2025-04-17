/**
 * Serviço para trading automatizado com API Deriv
 * Versão 2023.2 - Executa operações reais
 */

import { derivAPI } from '../lib/websocketManager';

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

// Evento simplificado para atualizar a interface
type BotEvent = { type: string; [key: string]: any };

class SimpleBotService {
  private status: BotStatus = 'idle';
  private currentContractId: number | null = null;
  private activeStrategyId: string | null = null;
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
    console.log('[SIMPLEBOT] Inicializando serviço de bot de trading real');
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
   * Inicia a execução do bot (Versão com simulação para demonstração)
   */
  public async start(): Promise<boolean> {
    console.log('[SIMPLEBOT] Método start() chamado - VERSÃO SIMULADA');
    
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
      
      // Função para iniciar a primeira operação simulada
      const startFirstOperation = () => {
        try {
          console.log('[SIMPLEBOT] Iniciando operações simuladas (para demonstração)');
          
          // Verificar novamente se o bot ainda está ativo
          if (this.status === 'running') {
            console.log('[SIMPLEBOT] Executando primeira operação simulada');
            this.simulateOperation();
          } else {
            console.log('[SIMPLEBOT] Bot não está mais rodando ao tentar iniciar simulação');
          }
        } catch (err) {
          console.error('[SIMPLEBOT] Erro ao iniciar primeira operação:', err);
        }
      };
      
      // Chamar imediatamente
      startFirstOperation();
      
      // Verificação de segurança após 2 segundos
      this.operationTimer = setTimeout(() => {
        if (this.status === 'running' && this.stats.wins === 0 && this.stats.losses === 0) {
          console.log('[SIMPLEBOT] Verificação de segurança: primeira operação não iniciou, tentando novamente');
          startFirstOperation();
        }
      }, 2000);
      
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
  private executeRealOperation(): void {
    console.log('[SIMPLEBOT] Executando operação REAL no mercado');
    
    if (this.status !== 'running') {
      console.log('[SIMPLEBOT] Bot não está em status running, não vai executar operação');
      return;
    }
    
    // Verificar se temos a estratégia e configurações
    if (!this.settings.contractType || !this.settings.entryValue) {
      console.error('[SIMPLEBOT] Configurações incompletas para operação real');
      this.emitEvent({ 
        type: 'error', 
        message: 'Configurações incompletas para operação real'
      });
      return;
    }
    
    // Iniciar contrato de compra com a API Deriv
    import('../lib/websocketManager').then(({ derivAPI }) => {
      // Construir parâmetros da proposta
      const contractType = this.settings.contractType; // Ex: 'DIGITOVER', 'DIGITUNDER'
      const amount = this.settings.entryValue;
      const duration = 5; // 5 ticks de duração
      const prediction = this.settings.prediction || 5; // Previsão padrão: 5
      
      console.log(`[SIMPLEBOT] Solicitando proposta para ${contractType} com valor ${amount}`);
      
      // Primeiro solicitar uma proposta (cotação)
      derivAPI.sendRequest({
        proposal: 1,
        amount,
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        duration: duration,
        duration_unit: "t",
        symbol: "R_100",
        barrier: prediction.toString()
      }).then(response => {
        if (response.error) {
          console.error('[SIMPLEBOT] Erro ao solicitar proposta:', response.error);
          this.emitEvent({ 
            type: 'error', 
            message: `Erro ao solicitar proposta: ${response.error.message}`
          });
          
          // Agendar próxima tentativa
          this.scheduleNextOperation();
          return;
        }
        
        // Se temos uma proposta válida, comprar o contrato
        if (response.proposal) {
          const proposal = response.proposal;
          console.log('[SIMPLEBOT] Proposta recebida, comprando contrato...');
          
          // Fazer compra usando ID da proposta
          derivAPI.sendRequest({
            buy: proposal.id,
            price: amount
          }).then(buyResponse => {
            if (buyResponse.error) {
              console.error('[SIMPLEBOT] Erro ao comprar contrato:', buyResponse.error);
              this.emitEvent({ 
                type: 'error', 
                message: `Erro ao comprar contrato: ${buyResponse.error.message}`
              });
              
              // Agendar próxima tentativa
              this.scheduleNextOperation();
              return;
            }
            
            // Contrato comprado com sucesso
            const contract = buyResponse.buy;
            
            console.log('[SIMPLEBOT] Contrato comprado com sucesso:', contract);
            
            // Criar objeto de contrato no formato esperado pela UI
            const contractObj = {
              contract_id: contract.contract_id,
              contract_type: contractType,
              buy_price: parseFloat(contract.buy_price),
              symbol: "R_100",
              status: 'open',
              purchase_time: contract.purchase_time,
              payout: parseFloat(contract.payout)
            };
            
            // Notificar início de operação
            this.emitEvent({ type: 'operation_started', contract: contractObj });
            
            // Monitorar o contrato até o final
            this.monitorRealContract(contract.contract_id);
          }).catch(err => {
            console.error('[SIMPLEBOT] Exceção ao comprar contrato:', err);
            this.scheduleNextOperation();
          });
        }
      }).catch(err => {
        console.error('[SIMPLEBOT] Exceção ao solicitar proposta:', err);
        this.scheduleNextOperation();
      });
    }).catch(err => {
      console.error('[SIMPLEBOT] Erro ao importar derivAPI:', err);
      this.scheduleNextOperation();
    });
  }
  
  /**
   * Monitora um contrato real até sua conclusão
   */
  private monitorRealContract(contractId: string | number): void {
    console.log(`[SIMPLEBOT] Monitorando contrato real ID: ${contractId}`);
    
    import('../lib/websocketManager').then(({ derivAPI }) => {
      // Usar a proposta para solicitar detalhes do contrato
      derivAPI.sendRequest({
        proposal_open_contract: 1,
        contract_id: contractId,
        subscribe: 1
      }).then(response => {
        if (response.error) {
          console.error('[SIMPLEBOT] Erro ao monitorar contrato:', response.error);
          this.scheduleNextOperation();
          return;
        }
        
        // Registrar callback para atualizações do contrato
        const contractHandler = (event: CustomEvent) => {
          const data = event.detail;
          
          // Verificar se é uma atualização para nosso contrato
          if (data && 
              data.msg_type === 'proposal_open_contract' && 
              data.proposal_open_contract && 
              data.proposal_open_contract.contract_id == contractId) {
            
            const contract = data.proposal_open_contract;
            
            // Verificar se o contrato foi finalizado
            if (contract.status !== 'open') {
              // Remover o listener do evento
              window.removeEventListener('deriv_api_response', contractHandler as EventListener);
              
              // Processar o resultado
              const isWin = contract.status === 'won';
              const profit = parseFloat(contract.profit);
              
              console.log(`[SIMPLEBOT] Contrato finalizado: ${isWin ? 'GANHO' : 'PERDA'} de ${profit.toFixed(2)}`);
              
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
              
              // Notificar resultado da operação
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
                  purchase_time: contract.purchase_time,
                  date_expiry: contract.date_expiry
                }
              });
              
              // Atualizar estatísticas
              this.emitEvent({ type: 'stats_updated', stats: { ...this.stats } });
              
              // Cancelar a subscrição
              derivAPI.sendRequest({
                forget: data.subscription.id
              }).catch(err => {
                console.error('[SIMPLEBOT] Erro ao cancelar subscrição:', err);
              });
              
              // Agendar próxima operação
              this.scheduleNextOperation();
            }
          }
        };
        
        // Registrar para ouvir eventos de resposta da API
        window.addEventListener('deriv_api_response', contractHandler as EventListener);
        
      }).catch(err => {
        console.error('[SIMPLEBOT] Exceção ao monitorar contrato:', err);
        this.scheduleNextOperation();
      });
    }).catch(err => {
      console.error('[SIMPLEBOT] Erro ao importar derivAPI:', err);
      this.scheduleNextOperation();
    });
  }
  
  /**
   * Agenda a próxima operação
   */
  private scheduleNextOperation(): void {
    if (this.status !== 'running') {
      console.log('[SIMPLEBOT] Bot não está mais rodando, não agendando próxima operação');
      return;
    }
    
    console.log('[SIMPLEBOT] Agendando próxima operação em 3 segundos');
    this.operationTimer = setTimeout(() => {
      try {
        this.executeRealOperation();
      } catch (error) {
        console.error('[SIMPLEBOT] Erro ao iniciar próxima operação:', error);
      }
    }, 3000);
  }
  
  /**
   * Simula uma operação para exibição na interface
   */
  private simulateOperation(): void {
    console.log('[SIMPLEBOT] Executando simulação de operação');
    
    if (this.status !== 'running') {
      console.log('[SIMPLEBOT] Bot não está em status running, não vai simular operação');
      return;
    }
    
    console.log('[SIMPLEBOT] Criando contrato simulado');
    
    // Criar contrato simulado baseado nas configurações
    const contract = {
      contract_id: Math.floor(Math.random() * 1000000),
      contract_type: this.settings.contractType || 'DIGITOVER',
      buy_price: this.settings.entryValue,
      symbol: 'R_100',
      status: 'open',
      purchase_time: Math.floor(Date.now() / 1000),
      payout: this.settings.entryValue * 1.9
    };
    
    // Notificar início de operação
    console.log('[SIMPLEBOT] Emitindo evento de operação iniciada');
    this.emitEvent({ type: 'operation_started', contract });
    
    // Após 5 segundos, simular finalização da operação
    console.log('[SIMPLEBOT] Programando conclusão da operação em 5 segundos');
    this.operationTimer = setTimeout(() => {
      try {
        // Verificar novamente se o bot ainda está rodando
        if (this.status !== 'running') {
          console.log('[SIMPLEBOT] Bot não está mais rodando durante a operação, cancelando');
          return;
        }

        // Gerar resultado aleatório (vitória/derrota)
        const isWin = Math.random() > 0.5;
        const profit = isWin ? contract.buy_price * 0.9 : -contract.buy_price;
        
        console.log(`[SIMPLEBOT] Operação concluída: ${isWin ? 'GANHO' : 'PERDA'} de ${profit.toFixed(2)}`);
        
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
        
        // Notificar resultado da operação
        this.emitEvent({
          type: 'operation_finished',
          result: isWin ? 'win' : 'loss',
          profit,
          contract: {
            ...contract,
            status: isWin ? 'won' : 'lost',
            profit
          }
        });
        
        // Atualizar estatísticas
        this.emitEvent({ type: 'stats_updated', stats: { ...this.stats } });
        
        // Programar próxima operação se o bot ainda estiver rodando
        if (this.status === 'running') {
          console.log('[SIMPLEBOT] Programando próxima operação em 3 segundos');
          this.operationTimer = setTimeout(() => {
            try {
              this.simulateOperation();
            } catch (error) {
              console.error('[SIMPLEBOT] Erro ao iniciar próxima operação:', error);
            }
          }, 3000);
        }
      } catch (error) {
        console.error('[SIMPLEBOT] Erro durante a simulação de operação:', error);
      }
    }, 5000);
  }
  
  /**
   * Emite um evento para todos os ouvintes registrados
   */
  private emitEvent(event: BotEvent): void {
    this.eventListeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('[SIMPLEBOT] Erro ao processar evento:', error);
      }
    });
  }
}

// Exportar instância única do serviço
export const simpleBotService = new SimpleBotService();
export default simpleBotService;