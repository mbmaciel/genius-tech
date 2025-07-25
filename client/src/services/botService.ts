/**
 * Serviço para gerenciar a execução de estratégias de trading
 * Implementa a lógica de execução dos bots definidos nos arquivos XML
 * VERSÃO ATUALIZADA - CORRIGIDA
 */

import { Contract, ContractType, ContractPrediction } from "./derivApiService";
import { derivAPI } from "../lib/websocketManager";

// Console log para sinalizar o carregamento do arquivo atualizado
console.log("[BOT_SERVICE] Carregando versão atualizada do botService...");

export interface StrategyConfig {
  id: string;
  name: string;
  file: string;
  type: "lite" | "premium";
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
    result: "win" | "loss";
    profit: number;
    contractId: number;
    contractType: string;
    entryValue: number;
  };
}

// Eventos que o bot pode emitir
type BotEvent =
  | { type: "status_change"; status: BotStatus }
  | { type: "operation_started"; contract: Contract }
  | {
      type: "operation_finished";
      result: "win" | "loss";
      profit: number;
      contract: Contract;
    }
  | { type: "stats_updated"; stats: OperationStats }
  | { type: "error"; message: string }
  | { type: "balance_update"; balance: number; currency: string };

export type BotStatus = "idle" | "running" | "paused" | "error";

class BotService {
  private strategies: StrategyConfig[] = [
    // Lite Bots
    {
      id: "profitpro",
      name: "Profit Pro",
      file: "Profitpro Atualizado.xml",
      type: "lite",
    },
    {
      id: "manualunder",
      name: "Control Under",
      file: "Manual Under.xml",
      type: "lite",
    },
    { id: "advance", name: "Advance", file: "Advance .xml", type: "lite" },
    {
      id: "wisetendencia",
      name: "Wise Pro Tendência",
      file: "WISE PRO TENDENCIA.xml",
      type: "lite",
    },

    // Premium Bots
    {
      id: "ironover",
      name: "Iron Over",
      file: "IRON OVER.xml",
      type: "premium",
    },
    {
      id: "ironunder",
      name: "Iron Under",
      file: "IRON UNDER.xml",
      type: "premium",
    },
    { id: "botlow", name: "Bot Low", file: "BOT LOW.xml", type: "premium" },
    { id: "maxpro", name: "Max Pro", file: "MAXPRO .xml", type: "premium" },
    { id: "green", name: "Green", file: "green.xml", type: "premium" },
    {
      id: "manualover",
      name: "Manual Over",
      file: "manual Over.xml",
      type: "premium",
    },
  ];

  private activeStrategy: StrategyConfig | null = null;
  private settings: BotSettings = {
    entryValue: 1.0, // CORREÇÃO: Valor default mais visível
    virtualLoss: 0,
    profitTarget: 10,
    lossLimit: 20,
    martingaleFactor: 1.5,
  };

  private status: BotStatus = "idle";
  private currentContract: Contract | null = null;
  private eventListeners: Array<(event: BotEvent) => void> = [];
  private operationTimer: NodeJS.Timeout | null = null;
  private lastDigit: number = 0; // Propriedade para armazenar o último dígito recebido

  private stats: OperationStats = {
    wins: 0,
    losses: 0,
    totalProfit: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0,
  };

  constructor() {
    // Usar a conexão OAuth existente para obter ticks e demais informações
    if (!derivAPI) {
      console.error(
        "[BOT_SERVICE] API Deriv não inicializada. Operações não estarão disponíveis",
      );
      return;
    }

    // Registrar handlers para a conexão OAuth
    derivAPI.onBalanceChange(this.handleBalanceUpdate.bind(this));

    // Estabelecer conexão WebSocket com a Deriv usando websocketManager
    const oauthToken = localStorage.getItem("deriv_oauth_token");
    if (oauthToken) {
      console.log(
        "[BOT_SERVICE] Inicializando conexão com token OAuth:",
        oauthToken.substring(0, 10) + "...",
      );

      // Primeiro conectar
      derivAPI
        .connect()
        .then(() => {
          // Depois autorizar com o token
          derivAPI
            .authorize(oauthToken)
            .then((response) => {
              if (response && !response.error) {
                console.log(
                  "[BOT_SERVICE] Autorização OAuth com sucesso:",
                  response.authorize?.loginid,
                );
                this.emitEvent({ type: "status_change", status: "idle" });

                // Inscrever-se para receber ticks de R_100 após autorização
                derivAPI
                  .sendRequest({
                    ticks: "R_100",
                    subscribe: 1,
                  })
                  .then((response) => {
                    console.log(
                      "[BOT_SERVICE] Inscrito em ticks R_100:",
                      response,
                    );

                    // Configurar um listener para os ticks
                    window.addEventListener("deriv_api_response", (e: any) => {
                      const data = e.detail;

                      // Se temos um tick do R_100, processar
                      if (data && data.tick && data.tick.symbol === "R_100") {
                        this.handleTickUpdate(data);
                      }

                      // Se temos um status de contrato, processar
                      if (data && data.proposal_open_contract) {
                        // Converter para o formato de contrato esperado
                        const contractUpdate =
                          this.formatContractUpdateFromProposal(
                            data.proposal_open_contract,
                          );
                        if (contractUpdate) {
                          this.handleContractUpdate(contractUpdate);
                        }
                      }
                    });
                  })
                  .catch((error) => {
                    console.error(
                      "[BOT_SERVICE] Erro ao se inscrever em ticks R_100:",
                      error,
                    );
                  });
              } else {
                console.error(
                  "[BOT_SERVICE] Falha na autorização OAuth:",
                  response?.error?.message,
                );
                this.emitEvent({
                  type: "error",
                  message: `Falha na autorização OAuth: ${response?.error?.message || "Erro desconhecido"}`,
                });
              }
            })
            .catch((error) => {
              console.error(
                "[BOT_SERVICE] Erro ao autorizar com token OAuth:",
                error,
              );
              this.emitEvent({
                type: "error",
                message: "Erro ao autorizar com token OAuth",
              });
            });
        })
        .catch((error) => {
          console.error("[BOT_SERVICE] Erro ao conectar à API Deriv:", error);
          this.emitEvent({
            type: "error",
            message: "Erro ao conectar à API Deriv",
          });
        });
    } else {
      console.warn(
        "[BOT_SERVICE] Token OAuth não encontrado, operações não estarão disponíveis",
      );
      this.emitEvent({
        type: "error",
        message:
          "Token OAuth não encontrado. Conecte sua conta na página Dashboard",
      });
    }
  }

  /**
   * Converte dados de proposta aberta para o formato de contrato
   */
  private formatContractUpdateFromProposal(proposal: any): Contract | null {
    if (!proposal || !proposal.contract_id) return null;

    return {
      contract_id: proposal.contract_id,
      contract_type: proposal.contract_type,
      buy_price: proposal.buy_price,
      symbol: proposal.underlying,
      status: proposal.status,
      entry_spot: proposal.entry_spot,
      exit_spot: proposal.exit_spot,
      profit: proposal.profit,
      payout: proposal.payout,
      purchase_time: proposal.date_start,
      date_expiry: proposal.date_expiry,
    };
  }

  /**
   * Manipula atualizações de tick e armazena o último dígito
   */
  private handleTickUpdate(tick: any): void {
    if (tick && tick.tick && tick.tick.quote) {
      const price = tick.tick.quote;
      // Extrair o último dígito do preço
      const priceStr = price.toString();
      const lastChar = priceStr.charAt(priceStr.length - 1);
      this.lastDigit = parseInt(lastChar, 10);

      console.log(
        `[BOT_SERVICE] Tick recebido: ${price}, último dígito: ${this.lastDigit}`,
      );
      console.log(
        `[BOT_SERVICE] Estado atual: status=${this.status}, temContrato=${this.currentContract !== null}, temTimer=${this.operationTimer !== null}`,
      );

      // Se o bot estiver em execução e sem contrato ativo, avaliar se deve operar
      if (
        this.status === "running" &&
        !this.currentContract &&
        !this.operationTimer
      ) {
        console.log("[BOT_SERVICE] Condições satisfeitas para iniciar trading");
        this.startTrading();
      } else {
        console.log("[BOT_SERVICE] Aguardando condições para operar");
      }
    }
  }

  /**
   * Lista todas as estratégias disponíveis
   */
  public getStrategies(type?: "lite" | "premium"): StrategyConfig[] {
    // Carregar estratégias do serviço XML
    try {
      import("../services/xmlStrategyParser")
        .then((module) => {
          const parser = module.xmlStrategyParser;

          // Carregar estratégias adicionais dos arquivos XML
          const xmlStrategies = parser.getAllStrategies();

          // Adicionar as estratégias do XML, evitando duplicatas por ID
          xmlStrategies.forEach((xmlStrategy) => {
            const exists = this.strategies.some((s) => s.id === xmlStrategy.id);
            if (!exists) {
              this.strategies.push({
                id: xmlStrategy.id,
                name: xmlStrategy.name,
                file: `${xmlStrategy.id}.xml`,
                type: xmlStrategy.category as "lite" | "premium",
              });
            }
          });
        })
        .catch((err) => {
          console.error("Erro ao carregar parser de estratégias XML:", err);
        });
    } catch (err) {
      console.error("Erro ao importar parser de estratégias XML:", err);
    }

    if (type) {
      return this.strategies.filter((s) => s.type === type);
    }
    return this.strategies;
  }

  /**
   * Obtém uma estratégia pelo ID
   */
  public getStrategyById(id: string): StrategyConfig | undefined {
    return this.strategies.find((s) => s.id === id);
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
      this.emitEvent({
        type: "error",
        message: `Estratégia "${strategyId}" não encontrada`,
      });
      return false;
    }

    this.activeStrategy = strategy;

    // Definir tipo de contrato e previsão com base no nome da estratégia
    if (
      strategy.id === "ironunder" ||
      strategy.id === "manualunder" ||
      strategy.id === "botlow"
    ) {
      this.settings.contractType = "DIGITUNDER";
      this.settings.prediction = 1; // Valor padrão para exemplo
    } else {
      this.settings.contractType = "DIGITOVER";
      this.settings.prediction = 1; // Valor padrão para exemplo
    }

    return true;
  }

  /**
   * Inicia a execução do bot
   */
  public async start(): Promise<boolean> {
    console.log("[BOT_SERVICE] Método start() chamado");

    if (this.status === "running") {
      console.log(
        "[BOT_SERVICE] Bot já está rodando, ignorando chamada start()",
      );
      return true;
    }

    if (!this.activeStrategy) {
      console.error("[BOT_SERVICE] Nenhuma estratégia selecionada");
      this.emitEvent({
        type: "error",
        message: "Nenhuma estratégia selecionada",
      });
      return false;
    }

    try {
      // Simplificar o processo para solução temporária
      // Não tentar fazer nova conexão ou autorização, assumir que conexão já existe
      console.log("[BOT_SERVICE] Atualizando status para running");

      // Atualizar estado e iniciar operações
      this.setStatus("running");

      console.log("[BOT_SERVICE] Iniciando operações de trading");
      this.startTrading();

      return true;
    } catch (error) {
      console.error("[BOT_SERVICE] Erro ao iniciar o bot:", error);
      this.emitEvent({
        type: "error",
        message: `Erro ao iniciar o bot: ${error}`,
      });
      this.setStatus("error");
      return false;
    }
  }

  /**
   * Pausa a execução do bot
   */
  public pause(): void {
    if (this.status !== "running") return;

    this.setStatus("paused");
    if (this.operationTimer) {
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }
  }

  /**
   * Para a execução do bot
   */
  public async stop(): Promise<void> {
    console.log("[BOT_SERVICE] Método stop() chamado");

    // Atualizar estado para idle
    this.setStatus("idle");

    // Limpar temporizadores
    if (this.operationTimer) {
      console.log("[BOT_SERVICE] Limpando temporizador de operações");
      clearTimeout(this.operationTimer);
      this.operationTimer = null;
    }

    // Cancelar contratos ativos se existirem (simplificado)
    if (this.currentContract) {
      console.log(
        "[BOT_SERVICE] Cancelando contrato ativo:",
        this.currentContract.contract_id,
      );
      this.currentContract = null;
    }

    console.log("[BOT_SERVICE] Bot parado com sucesso");
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
      consecutiveLosses: 0,
    };

    this.emitEvent({ type: "stats_updated", stats: { ...this.stats } });
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
    this.eventListeners = this.eventListeners.filter((l) => l !== listener);
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
    // NOVA VERSÃO - CORRIGIDA E SIMPLIFICADA PARA DEMONSTRAÇÃO

    console.log(`[BOT_SERVICE] NOVA VERSÃO DO BOT EM EXECUÇÃO`);
    console.log(`[BOT_SERVICE] Status atual do bot: ${this.status}`);

    // Se não estiver rodando, sair imediatamente
    if (this.status !== "running") {
      console.log("[BOT_SERVICE] Bot não está em execução, retornando");
      return;
    }

    // Se já existe um contrato em andamento, não iniciar outro
    if (this.currentContract !== null) {
      console.log(
        "[BOT_SERVICE] Já existe um contrato em andamento, aguardando resultado",
      );
      return;
    }

    // Calcular valor da entrada
    const entryValue = this.settings.entryValue;

    // Usar a estratégia selecionada
    const contractType = this.settings.contractType || "DIGITOVER";
    const prediction = this.settings.prediction || 1;

    console.log("---------predição: " + prediction);
    // EXECUÇÃO IMEDIATA para demonstração
    console.log(`[BOT_SERVICE] EXECUTANDO OPERAÇÃO IMEDIATAMENTE`);
    console.log(
      `[BOT_SERVICE] Tipo de contrato: ${contractType}, Previsão: ${prediction}, Valor: ${entryValue}`,
    );

    // Executar operação de compra
    this.executeOperation(entryValue, contractType, prediction);
  }

  /**
   * Executa uma operação de compra de contrato
   */
  private async executeOperation(
    amount: number,
    type: ContractType,
    prediction: ContractPrediction,
  ): Promise<void> {
    try {
      console.log(
        `[BOT_SERVICE] Iniciando operação: ${type} ${prediction} valor=${amount}`,
      );

      // IMPORTANTE: Verificar token OAuth antes da operação
      const oauthToken = localStorage.getItem("deriv_oauth_token");
      if (!oauthToken) {
        console.error("[BOT_SERVICE] Token OAuth não disponível");
        this.emitEvent({
          type: "error",
          message:
            "Token OAuth não disponível. Reconecte sua conta no Dashboard",
        });

        this.operationTimer = setTimeout(() => {
          if (this.status === "running") {
            this.startTrading();
          }
        }, 10000);

        return;
      }

      console.log("[BOT_SERVICE] Comprando contrato usando a conexão OAuth...");

      // Usar a conexão OAuth para comprar o contrato
      const buyResponse = await derivAPI.sendRequest({
        buy: 1,
        price: amount,
        parameters: {
          amount: amount,
          basis: "stake",
          contract_type: type,
          currency: "USD", // Valor padrão, será substituído pelo correto da conta
          duration: 1,
          duration_unit: "t",
          symbol: "R_100",
          ...(prediction !== undefined && { prediction: prediction }),
        },
      });

      if (buyResponse.error) {
        console.error(
          "[BOT_SERVICE] Erro na compra:",
          buyResponse.error.message,
        );
        this.emitEvent({
          type: "error",
          message: `Falha ao comprar contrato: ${buyResponse.error.message}`,
        });

        // Tentar novamente após um intervalo
        this.operationTimer = setTimeout(() => {
          if (this.status === "running") {
            this.startTrading();
          }
        }, 5000);

        return;
      }

      // Compra bem-sucedida, criar objeto de contrato
      const contract: Contract = {
        contract_id: buyResponse.buy.contract_id,
        contract_type: type,
        buy_price: buyResponse.buy.buy_price,
        symbol: "R_100",
        status: "open",
        purchase_time: buyResponse.buy.purchase_time,
        payout: buyResponse.buy.payout,
      };

      this.currentContract = contract;
      this.emitEvent({ type: "operation_started", contract });

      // Solicitar atualizações sobre o status do contrato
      derivAPI
        .sendRequest({
          proposal_open_contract: 1,
          contract_id: contract.contract_id,
          subscribe: 1,
        })
        .catch((err) => {
          console.error(
            "[BOT_SERVICE] Erro ao solicitar atualizações do contrato:",
            err,
          );
        });

      // O resultado será processado no evento de atualização de contrato
    } catch (error) {
      this.emitEvent({
        type: "error",
        message: `Erro ao executar operação: ${error}`,
      });

      // Tentar novamente após um intervalo
      this.operationTimer = setTimeout(() => {
        if (this.status === "running") {
          this.startTrading();
        }
      }, 5000);
    }
  }

  /**
   * Manipula atualizações de contratos
   */
  private handleContractUpdate(contract: Contract): void {
    if (
      !this.currentContract ||
      this.currentContract.contract_id !== contract.contract_id
    ) {
      return;
    }

    // Verificar se o contrato foi fechado
    if (contract.status !== "open") {
      const isWin = contract.profit && contract.profit > 0;
      const result = isWin ? "win" : "loss";
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
        entryValue: contract.buy_price,
      };

      // Notificar sobre a conclusão da operação
      this.emitEvent({
        type: "operation_finished",
        result,
        profit,
        contract,
      });

      // Atualizar estatísticas
      this.emitEvent({
        type: "stats_updated",
        stats: { ...this.stats },
      });

      // Limpar o contrato atual
      this.currentContract = null;

      // Aguardar um pouco antes da próxima operação
      this.operationTimer = setTimeout(() => {
        if (this.status === "running") {
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
      console.log("[BOT_SERVICE] Atualização de balanço recebida:", balance);
      this.emitEvent({
        type: "balance_update",
        balance: balance.balance,
        currency: balance.currency,
      });
    }
  }

  /**
   * Define o status do bot e emite o evento correspondente
   */
  private setStatus(status: BotStatus): void {
    this.status = status;
    this.emitEvent({ type: "status_change", status });
  }

  /**
   * Emite um evento para todos os ouvintes registrados
   */
  private emitEvent(event: BotEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Erro ao processar evento do bot:", error);
      }
    });
  }
}

// Função para verificar o estado de autorização
function isApiAuthorized(): boolean {
  return derivAPI && derivAPI.getAuthorization() ? true : false;
}

// Exporta uma instância única do serviço
export const botService = new BotService();
export default botService;
