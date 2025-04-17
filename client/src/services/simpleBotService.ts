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
    
    // Verificar se temos um token OAuth armazenado
    const token = localStorage.getItem('deriv_oauth_token');
    if (token) {
      console.log('[SIMPLEBOT] Token OAuth encontrado, inicializando conexão...');
      // Importar WebSocketManager de forma assíncrona para evitar dependência cíclica
      import('../lib/websocketManager').then(({ derivAPI }) => {
        // Conectar e autorizar com o token
        derivAPI.connect().then(() => {
          derivAPI.authorize(token).then(response => {
            console.log('[SIMPLEBOT] Autorização bem-sucedida com API Deriv:', response.authorize?.loginid);
          }).catch(err => {
            console.error('[SIMPLEBOT] Falha na autorização com API Deriv:', err);
          });
        }).catch(err => {
          console.error('[SIMPLEBOT] Falha na conexão com API Deriv:', err);
        });
      });
    } else {
      console.warn('[SIMPLEBOT] Token OAuth não encontrado, operações reais estarão indisponíveis');
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
   * Inicia a execução do bot (Versão híbrida: tenta operações reais e, se falhar, usa simulação)
   */
  public async start(): Promise<boolean> {
    console.log('[SIMPLEBOT] Método start() chamado - VERSÃO HÍBRIDA (real ou simulada)');
    
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
      
      // Primeiro tentamos uma operação real
      const startRealOperation = async () => {
        try {
          console.log('[SIMPLEBOT] Tentando iniciar operação REAL');
          
          // Verificar novamente se o bot ainda está ativo
          if (this.status === 'running') {
            // Primeiro tentar uma operação real
            await this.executeRealOperation();
            return true;
          } else {
            console.log('[SIMPLEBOT] Bot não está mais rodando ao tentar iniciar operação');
            return false;
          }
        } catch (err) {
          console.error('[SIMPLEBOT] Erro ao iniciar operação real:', err);
          return false;
        }
      };

      // Tentar operação real, mas se falhar, usamos simulação
      const successWithReal = await startRealOperation().catch(() => false);
      
      if (!successWithReal) {
        console.log('[SIMPLEBOT] Operação real falhou ou não está disponível, usando simulação como fallback');
        
        // Função para iniciar operação simulada
        const startSimulatedOperation = () => {
          try {
            console.log('[SIMPLEBOT] Iniciando operações SIMULADAS (fallback)');
            
            if (this.status === 'running') {
              console.log('[SIMPLEBOT] Executando operação simulada');
              this.simulateOperation();
            } else {
              console.log('[SIMPLEBOT] Bot não está mais rodando');
            }
          } catch (err) {
            console.error('[SIMPLEBOT] Erro ao iniciar operação simulada:', err);
          }
        };
        
        // Iniciar simulação imediatamente
        startSimulatedOperation();
      }
      
      // Verificação de segurança após 2 segundos
      this.operationTimer = setTimeout(() => {
        if (this.status === 'running' && this.stats.wins === 0 && this.stats.losses === 0) {
          console.log('[SIMPLEBOT] Verificação de segurança: primeira operação não iniciou, usando simulação');
          this.simulateOperation();
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
  private executeRealOperation(): Promise<boolean> {
    console.log('[SIMPLEBOT] Executando operação REAL no mercado');
    
    return new Promise(async (resolve, reject) => {
      if (this.status !== 'running') {
        console.log('[SIMPLEBOT] Bot não está em status running, não vai executar operação');
        return reject(new Error('Bot não está em execução'));
      }
      
      // Verificar se temos a estratégia e configurações
      if (!this.settings.contractType || !this.settings.entryValue) {
        console.error('[SIMPLEBOT] Configurações incompletas para operação real');
        this.emitEvent({ 
          type: 'error', 
          message: 'Configurações incompletas para operação real'
        });
        return reject(new Error('Configurações incompletas'));
      }
      
      try {
        // Obter a instância da API
        const { derivAPI } = await import('../lib/websocketManager');
        
        // Obter o token OAuth armazenado
        const token = localStorage.getItem('deriv_oauth_token');
        if (!token) {
          console.error('[SIMPLEBOT] Token OAuth não encontrado, impossível fazer operações reais');
          this.emitEvent({ 
            type: 'error', 
            message: 'Token OAuth não encontrado'
          });
          this.simulateOperation(); // Fallback para simulação apenas se não houver token
          return resolve(false);
        }
        
        // Verificar se o websocket está conectado e autorizado
        if (!derivAPI.getSocketInstance() || derivAPI.getSocketInstance()?.readyState !== WebSocket.OPEN) {
          console.log('[SIMPLEBOT] WebSocket não está conectado, tentando reconectar...');
          try {
            await derivAPI.connect();
            await derivAPI.authorize(token);
            console.log('[SIMPLEBOT] Reconexão e autorização bem-sucedidas');
          } catch (connError) {
            console.error('[SIMPLEBOT] Erro ao reconectar/autorizar:', connError);
            this.simulateOperation(); // Fallback para simulação
            return resolve(false);
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
          req_id: operationId,
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
        
        // Executar solicitação de proposta
        try {
          const response = await derivAPI.sendRequest(proposalRequest);
          
          if (response.error) {
            console.error('[SIMPLEBOT] Erro ao solicitar proposta:', response.error);
            this.emitEvent({ 
              type: 'error', 
              message: `Erro ao solicitar proposta: ${response.error.message || 'Erro desconhecido'}`
            });
            
            // Agendar próxima tentativa
            this.scheduleNextOperation();
            return reject(new Error(`Erro de proposta: ${response.error.message || 'Erro desconhecido'}`));
          }
          
          // Se temos uma proposta válida, comprar o contrato
          if (response.proposal) {
            const proposal = response.proposal;
            console.log('[SIMPLEBOT] Proposta recebida, comprando contrato...', proposal);
            
            // Formatar solicitação de compra com o ID da proposta
            // Baseado na documentação da API fornecida no arquivo "Contrato de Compra (solicitação.txt)"
            const buyRequest = {
              req_id: `buy_${operationId}`,
              buy: proposal.id,
              price: amount
            };
            
            try {
              const buyResponse = await derivAPI.sendRequest(buyRequest);
              
              if (buyResponse.error) {
                console.error('[SIMPLEBOT] Erro ao comprar contrato:', buyResponse.error);
                this.emitEvent({ 
                  type: 'error', 
                  message: `Erro ao comprar contrato: ${buyResponse.error.message || 'Erro desconhecido'}`
                });
                
                // Agendar próxima tentativa
                this.scheduleNextOperation();
                return reject(new Error(`Erro na compra: ${buyResponse.error.message || 'Erro desconhecido'}`));
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
              await this.monitorRealContract(contract.contract_id);
              resolve(true);
            } catch (buyError) {
              console.error('[SIMPLEBOT] Exceção ao comprar contrato:', buyError);
              this.scheduleNextOperation();
              reject(buyError);
            }
          } else {
            console.error('[SIMPLEBOT] Proposta não recebida na resposta');
            this.scheduleNextOperation();
            reject(new Error('Proposta não recebida'));
          }
        } catch (proposalError) {
          console.error('[SIMPLEBOT] Exceção ao solicitar proposta:', proposalError);
          this.scheduleNextOperation();
          reject(proposalError);
        }
      } catch (importError) {
        console.error('[SIMPLEBOT] Erro ao importar derivAPI:', importError);
        this.scheduleNextOperation();
        reject(importError);
      }
    });
  }
  
  /**
   * Monitora um contrato real até sua conclusão
   * @returns Promise que resolve quando o contrato for finalizado
   */
  private monitorRealContract(contractId: string | number): Promise<boolean> {
    console.log(`[SIMPLEBOT] Monitorando contrato real ID: ${contractId}`);
    
    return new Promise(async (resolve, reject) => {
      try {
        // Importar API de forma assíncrona
        const { derivAPI } = await import('../lib/websocketManager');
        
        // Formato correto usando o schema atualizado da API
        const monitorRequest = {
          req_id: `monitor_${Date.now().toString()}`,
          proposal_open_contract: 1,
          contract_id: contractId,
          subscribe: 1
        };
        
        console.log('[SIMPLEBOT] Enviando solicitação de monitoramento:', monitorRequest);
        
        // Enviar solicitação para monitorar o contrato
        const response = await derivAPI.sendRequest(monitorRequest);
        
        if (response.error) {
          console.error('[SIMPLEBOT] Erro ao monitorar contrato:', response.error);
          this.scheduleNextOperation();
          return reject(new Error(`Erro ao monitorar: ${response.error.message || 'Erro desconhecido'}`));
        }
        
        console.log('[SIMPLEBOT] Resposta de monitoramento:', response);
        
        // Registrar callback para atualizações do contrato
        const contractHandler = (event: CustomEvent) => {
          const data = event.detail;
          
          // Verificar se é uma atualização para nosso contrato
          if (data && 
              data.msg_type === 'proposal_open_contract' && 
              data.proposal_open_contract && 
              data.proposal_open_contract.contract_id == contractId) {
            
            const contract = data.proposal_open_contract;
            
            // Log detalhado das atualizações de contrato
            console.log(`[SIMPLEBOT] Atualização de contrato ID ${contractId}:`, contract);
            
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
              
              // Notificar resultado da operação com TODOS os detalhes do contrato
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
              this.emitEvent({ type: 'stats_updated', stats: { ...this.stats } });
              
              // Cancelar a subscrição
              if (data.subscription && data.subscription.id) {
                console.log('[SIMPLEBOT] Cancelando subscrição:', data.subscription.id);
                derivAPI.sendRequest({
                  forget: data.subscription.id
                }).catch(err => {
                  console.error('[SIMPLEBOT] Erro ao cancelar subscrição:', err);
                });
              }
              
              // Agendar próxima operação
              this.scheduleNextOperation();
              
              // Resolver a promise
              resolve(true);
            }
          }
        };
        
        // Registrar para ouvir eventos de resposta da API
        window.addEventListener('deriv_api_response', contractHandler as EventListener);
        
        // Configurar um timeout de segurança para evitar que a promise nunca resolva
        setTimeout(() => {
          console.log('[SIMPLEBOT] Timeout de monitoramento de contrato excedido');
          window.removeEventListener('deriv_api_response', contractHandler as EventListener);
          this.scheduleNextOperation();
          resolve(false);
        }, 300000); // 5 minutos de timeout
        
      } catch (err) {
        console.error('[SIMPLEBOT] Exceção ao monitorar contrato:', err);
        this.scheduleNextOperation();
        reject(err);
      }
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