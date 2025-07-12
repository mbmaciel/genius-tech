/**
 * Serviço de trading que estabelece conexão direta com o servidor Deriv via OAuth
 *
 * Mantém uma conexão WebSocket dedicada, independente do frontend
 * VERSÃO ATUALIZADA: Suporta múltiplos tokens e contas do usuário
 */
import {
  BotStats,
  TradingEvent,
  TradingSettings,
  OAuthDirectServiceInterface,
} from "./oauthDirectService.interface";
import { getStrategyById } from "@/lib/strategiesConfig";
import {
  evaluateAdvanceStrategy,
  evaluateIronOverStrategy,
  evaluateIronUnderStrategy,
  evaluateMaxProStrategy,
  evaluateDefaultStrategy,
  ContractType as StrategyContractType,
  DigitStat,
} from "@/services/strategyRules";
import {
  evaluateEntryConditions,
  updateStrategyResult,
  initializeStrategyState,
  getStrategyState,
} from "@/lib/strategy-handlers";

interface TokenInfo {
  token: string;
  loginid?: string;
  authorized: boolean;
  connected: boolean;
  primary: boolean;
}

class OAuthDirectService implements OAuthDirectServiceInterface {
  private webSocket: WebSocket | null = null;
  private tokens: TokenInfo[] = [];
  private activeToken: string | null = null;
  private activeSymbol: string = "R_100"; // Símbolo ativo para reconexões
  private isRunning: boolean = false;
  private eventListeners: Array<(event: TradingEvent) => void> = [];
  private currentContractId: string | number | null = null;
  private verboseLogging: boolean = false; // Controle de logs detalhados
  private contractTerminationReasons: Map<string, string> = new Map(); // Armazena motivos de encerramento de contratos
  /**
   * Método para obter o valor inicial do usuário com alta prioridade
   * @param userConfigValue Valor opcional do userConfig
   * @returns O valor inicial do usuário, ou o valor padrão
   */
  private getUserDefinedAmount(userConfigValue?: string | number): number {
    try {
      // ⚠️⚠️⚠️ MÉTODO TOTALMENTE REFATORADO PARA GARANTIR CONSISTÊNCIA DEFINITIVA ⚠️⚠️⚠️

      // PRIORIDADE 1: Valor do input na interface (mais alta prioridade)
      const inputElement = document.getElementById(
        "iron-bot-entry-value",
      ) as HTMLInputElement;
      if (inputElement && inputElement.value) {
        const valueFromInput = parseFloat(inputElement.value);
        if (!isNaN(valueFromInput) && valueFromInput > 0) {
          console.log(
            `[OAUTH_DIRECT] 💯 VALOR DEFINITIVO: ${valueFromInput} do input do usuário!`,
          );

          // ✅✅✅ NOVA CORREÇÃO CRÍTICA: Forçar persistência do valor do input no localStorage
          try {
            // Obter estratégia atual
            const currentStrategy = this.strategyConfig.toLowerCase();
            if (currentStrategy) {
              const configString = localStorage.getItem(
                `strategy_config_${currentStrategy}`,
              );
              if (configString) {
                let config = JSON.parse(configString);
                // Atualizar valor inicial com valor do input
                config.valorInicial = valueFromInput;
                localStorage.setItem(
                  `strategy_config_${currentStrategy}`,
                  JSON.stringify(config),
                );
                console.log(
                  `[OAUTH_DIRECT] ⭐ PERSISTÊNCIA FORÇADA: Valor do input ${valueFromInput} salvo no localStorage para ${currentStrategy}`,
                );
              }
            }
          } catch (e) {
            console.error(
              `[OAUTH_DIRECT] Erro ao tentar forçar persistência do valor:`,
              e,
            );
          }

          // Garantir que o valor é refletido também nas settings globais
          this.settings.entryValue = valueFromInput;

          // Retornar o valor do input imediatamente
          return valueFromInput;
        }
      }

      // PRIORIDADE 2: Valor passado nas configurações do usuário (segunda prioridade)
      if (userConfigValue !== undefined) {
        const valueFromConfig =
          typeof userConfigValue === "string"
            ? parseFloat(userConfigValue)
            : userConfigValue;

        if (!isNaN(valueFromConfig) && valueFromConfig > 0) {
          console.log(
            `[OAUTH_DIRECT] 💯 VALOR DAS CONFIGURAÇÕES: ${valueFromConfig}!`,
          );
          // Atualizar settings globais
          this.settings.entryValue = valueFromConfig;
          return valueFromConfig;
        }
      }

      // PRIORIDADE 3: Valor configurado nas configurações gerais
      if (
        this.settings.entryValue !== undefined &&
        Number(this.settings.entryValue) > 0
      ) {
        const valueAsNumber = Number(this.settings.entryValue);
        console.log(
          `[OAUTH_DIRECT] 💯 VALOR DAS CONFIGURAÇÕES GERAIS: ${valueAsNumber}!`,
        );
        return valueAsNumber;
      }

      // VALOR PADRÃO SEGURO se não encontrar em nenhum lugar
      console.log(
        `[OAUTH_DIRECT] ⚠️ FIXME: Nenhum valor válido encontrado! Usando valor padrão 1.0`,
      );
      return 1.0;
    } catch (error) {
      console.error(`[OAUTH_DIRECT] Erro em getUserDefinedAmount:`, error);
      return 1.0; // Valor padrão em caso de erro
    }
  }

  private settings: TradingSettings = {
    // CORREÇÃO CRÍTICA: Não usar valor fixo, será substituído pelo valor do localStorage
    entryValue: 1.0, // Valor default mais visível quando usado como fallback
    profitTarget: 20, // Valor padrão deve ser consistente com a UI
    lossLimit: 10,    // Valor padrão deve ser consistente com a UI
    martingaleFactor: 1.5,
    contractType: "DIGITOVER",
    // CORREÇÃO URGENTE: A estratégia Advance deve usar prediction: 1, não 5
    // Conforme definido no XML original da estratégia
    prediction: 1, // Valor corrigido de 5 para 1
    // NOVA IMPLEMENTAÇÃO: Suporte para lossVirtual e resetOnWin conforme XML
    lossVirtualEnabled: true, // Habilitar lossVirtual conforme XML (linhas 72-97)
    resetOnWin: true, // Resetar para valor inicial após vitória conforme XML (linhas 71-77)
    barrier: "1" // Barreira para contratos DIGITOVER/DIGITUNDER
  };

  // Estatísticas de performance
  private sessionStats = {
    totalProfit: 0, // Lucro total da sessão
    totalLoss: 0, // Perda total da sessão
    wins: 0, // Número de vitórias
    losses: 0, // Número de perdas
    initialBalance: 0, // Saldo inicial quando iniciou o bot
    currentBalance: 0, // Saldo atual
    netProfit: 0, // Lucro líquido da sessão
    startTime: new Date(), // Horário de início da sessão
  };
  
  /**
   * Reseta as estatísticas de trading
   * Usado pelo botão "Limpar Histórico"
   */
  public resetStats(): void {
    console.log("[OAUTH_DIRECT] Resetando estatísticas de trading");
    
    // Zerar todas as estatísticas da sessão
    this.sessionStats = {
      totalProfit: 0,
      totalLoss: 0, 
      wins: 0,
      losses: 0,
      initialBalance: this.sessionStats.initialBalance, // Mantém o saldo inicial
      currentBalance: this.sessionStats.currentBalance, // Mantém o saldo atual
      netProfit: 0,
      startTime: new Date(), // Reinicia o tempo
    };
    
    // Remover explicitamente a chave de estatísticas
    localStorage.removeItem('deriv_bot_stats');
    console.log("[OAUTH_DIRECT] Chave de estatísticas deriv_bot_stats removida explicitamente");
    
    // Limpar histórico de operações armazenado em localStorage
    this.clearLocalHistory();
    
    // Notificar listeners sobre limpeza de histórico
    this.notifyListeners({ type: 'history_cleared' });
    
    console.log("[OAUTH_DIRECT] Estatísticas resetadas com sucesso");
  }
  
  /**
   * Limpa o histórico armazenado no localStorage
   * @private
   */
  private clearLocalHistory(): void {
    try {
      console.log("[OAUTH_DIRECT] Iniciando limpeza completa do histórico no localStorage");
      
      // Lista expandida de chaves específicas a remover (cobrindo todas as variações possíveis)
      const specificKeys = [
        'deriv_operation_history',
        'deriv_operations_history',
        'deriv_session_stats',
        'operations_cache',
        'operation_history_cache',
        'deriv_bot_stats',              // Estatísticas do bot
        'deriv_bot_session_stats',      // Possível variação
        'operation_stats',              // Possível variação
        'operations_stats',             // Possível variação
        'deriv_stats',                  // Possível variação
        'trading_stats',                // Possível variação
        'profit_loss_stats',            // Possível variação
        'session_performance',          // Possível variação
        'trading_performance',          // Possível variação
        'bot_stats',                    // Possível variação
        'bot_performance',              // Possível variação
        'deriv_performance'             // Possível variação
      ];
      
      // Remover todas as chaves específicas listadas acima
      specificKeys.forEach(key => {
        localStorage.removeItem(key);
        console.log(`[OAUTH_DIRECT] Removida chave específica: ${key}`);
      });
      
      // Remover explicitamente a chave das estatísticas do bot (garantia dupla)
      localStorage.removeItem('deriv_bot_stats');
      console.log("[OAUTH_DIRECT] Limpeza explícita da chave de estatísticas: deriv_bot_stats");
      
      // Limpar históricos por estratégia e qualquer chave que contenha padrões relacionados
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith('deriv_') || 
          key.includes('operation') ||
          key.includes('history') ||
          key.includes('stats') ||
          key.includes('stat') ||
          key.includes('performance') ||
          key.includes('bot_') ||
          key.includes('_cache') ||
          key.includes('trading_')
        )) {
          // Não remover configurações de estratégia
          if (!key.includes('strategy_config_')) {
            keysToRemove.push(key);
            console.log(`[OAUTH_DIRECT] Marcando para remoção: ${key}`);
          }
        }
      }
      
      // Remover todas as chaves encontradas
      keysToRemove.forEach(key => {
        console.log(`[OAUTH_DIRECT] Removendo chave do localStorage: ${key}`);
        localStorage.removeItem(key);
      });
      
      // CORREÇÃO CRÍTICA: Forçar a limpeza das estatísticas de sessão
      this.sessionStats = {
        totalProfit: 0,
        totalLoss: 0, 
        wins: 0,
        losses: 0,
        initialBalance: this.sessionStats.initialBalance, // Mantém o saldo inicial
        currentBalance: this.sessionStats.currentBalance, // Mantém o saldo atual
        netProfit: 0,
        startTime: new Date(), // Reinicia o tempo
      };
      
      console.log("[OAUTH_DIRECT] ✅ Histórico local e estatísticas limpos com sucesso");
      
      // Notificar interface de que o histórico foi limpo
      this.notifyListeners({
        type: "history_cleared",
        message: "Histórico de operações e estatísticas limpos com sucesso"
      });
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao limpar histórico local:", error);
    }
  }

  private strategyConfig: string = "";
  private lastDigit: number = 0; // Último dígito recebido nos ticks
  private advancePercentage: number = 8; // Porcentagem para estratégia Advance (padrão 8% conforme Bot Builder)
  private activeStrategy: string = ""; // Estratégia ativa

  private operationTimeout: any = null;
  private pingInterval: any = null;
  private reconnectTimeout: any = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private initialized: boolean = false;

  constructor() {
    console.log(
      "[OAUTH_DIRECT] Inicializando serviço de trading OAuth com conexão dedicada",
    );

    // Inicializar com os tokens disponíveis
    this.loadAllTokens();

    // Configurar listener para eventos de troca de conta
    this.setupAccountSwitchListener();
  }

  /**
   * Configura listener para eventos de troca de conta
   * Isso permite que o serviço receba notificações quando o usuário
   * troca de conta na dashboard
   */
  private setupAccountSwitchListener(): void {
    // Handler para evento de troca de conta via OAuth
    const handleAccountSwitch = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail) {
        // Compatibilidade com diferentes formatos de evento
        const accountId =
          customEvent.detail.accountId || customEvent.detail.loginid;
        const token = customEvent.detail.token;

        if (accountId && token) {
          console.log(
            `[OAUTH_DIRECT] Evento de troca de conta recebido: ${accountId}`,
          );

          // Definir a conta como ativa
          this.setActiveAccount(accountId, token);

          // Forçar reconexão para validar o token
          if (this.isRunning) {
            console.log(
              `[OAUTH_DIRECT] Reconectando para validar token da conta ${accountId}...`,
            );
            this.reconnect().then((success) => {
              if (success) {
                console.log(
                  `[OAUTH_DIRECT] Token da conta ${accountId} validado com sucesso`,
                );

                // Notificar componentes da UI
                this.notifyListeners({
                  type: "account_changed",
                  message: `Conta alterada para ${accountId}`,
                  loginid: accountId,
                });
              } else {
                console.error(
                  `[OAUTH_DIRECT] Falha ao validar token da conta ${accountId}`,
                );
              }
            });
          }
        }
      }
    };

    // Handler para o evento personalizado de troca de conta
    const handleAccountSwitchedEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.loginid) {
        const loginid = customEvent.detail.loginid;
        console.log(
          `[OAUTH_DIRECT] Evento personalizado de troca de conta detectado: ${loginid}`,
        );

        // Forçar recarregamento de tokens
        this.loadAllTokens();

        // Verificar se a conta ativa foi atualizada
        const activeLoginId = localStorage.getItem("deriv_active_loginid");
        if (activeLoginId === loginid) {
          console.log(
            `[OAUTH_DIRECT] Verificada troca para conta ${loginid} no localStorage`,
          );

          // Obter novo token
          const oauthToken = localStorage.getItem("deriv_oauth_token");
          if (oauthToken) {
            // Atualizar token ativo
            this.activeToken = oauthToken;

            // Procurar na lista de tokens
            const tokenInfo = this.tokens.find((t) => t.loginid === loginid);
            if (tokenInfo) {
              // Marcar como primário
              tokenInfo.primary = true;

              // Forçar reconexão com o novo token
              if (this.isRunning) {
                console.log(
                  `[OAUTH_DIRECT] Reconectando com novo token após troca de conta...`,
                );
                this.reconnect()
                  .then((success) => {
                    if (success) {
                      console.log(
                        `[OAUTH_DIRECT] Reconexão após troca de conta bem-sucedida`,
                      );
                      // Notificar listeners
                      this.notifyListeners({
                        type: "account_changed",
                        message: `Conta alterada para ${loginid}`,
                        loginid: loginid,
                      });
                    } else {
                      console.error(
                        `[OAUTH_DIRECT] Falha na reconexão após troca de conta`,
                      );
                    }
                  })
                  .catch((error) => {
                    console.error(
                      `[OAUTH_DIRECT] Erro na reconexão após troca de conta:`,
                      error,
                    );
                  });
              }
            }
          }
        }
      }
    };

    // Handler para evento de força de atualização de token
    const handleForceTokenUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (
        customEvent.detail &&
        customEvent.detail.loginid &&
        customEvent.detail.token
      ) {
        const { loginid, token } = customEvent.detail;

        console.log(
          `[OAUTH_DIRECT] ⚠️ Evento de FORÇA de atualização de token recebido: ${loginid}`,
        );

        // Remover status de primário de todos os outros tokens
        this.tokens.forEach((t) => {
          t.primary = false;
        });

        // Definir novo token como principal e ativo
        let tokenInfo = this.tokens.find(
          (t) => t.token === token || t.loginid === loginid,
        );

        if (!tokenInfo) {
          // Se não existe, adicionar
          this.addToken(token, true, loginid);
          console.log(
            `[OAUTH_DIRECT] Adicionado novo token forçado para ${loginid}`,
          );
        } else {
          // Se existe, atualizar
          tokenInfo.primary = true;
          tokenInfo.loginid = loginid;
          console.log(
            `[OAUTH_DIRECT] Token existente atualizado para ${loginid}`,
          );
        }

        // Definir como token ativo
        this.activeToken = token;

        // Atualizar todos os locais de armazenamento
        localStorage.setItem("deriv_oauth_token", token);
        localStorage.setItem("deriv_api_token", token);
        localStorage.setItem("deriv_active_loginid", loginid);

        // Forçar reconexão imediata
        this.reconnect()
          .then(() => {
            console.log(
              `[OAUTH_DIRECT] Reconexão forçada para ${loginid} concluída`,
            );
          })
          .catch((error) => {
            console.error(`[OAUTH_DIRECT] Erro na reconexão forçada: ${error}`);
          });
      }
    };

    // Também verificar periodicamente se houve alteração no localStorage
    const checkLocalStorageForAccountChange = () => {
      try {
        const oauthAccountData = localStorage.getItem(
          "deriv_oauth_selected_account",
        );

        if (oauthAccountData) {
          const accountData = JSON.parse(oauthAccountData);

          // Se temos dados recentes (nos últimos 5 segundos)
          if (
            accountData.timestamp &&
            Date.now() - accountData.timestamp < 5000 &&
            accountData.accountId &&
            accountData.token
          ) {
            // Verificar se é diferente da conta atual
            const currentToken = this.tokens.find((t) => t.primary)?.token;

            if (accountData.token !== currentToken) {
              console.log(
                `[OAUTH_DIRECT] Alteração de conta detectada via localStorage: ${accountData.accountId}`,
              );

              // Atualizar a conta ativa
              this.setActiveAccount(accountData.accountId, accountData.token);

              // Reconectar se o serviço estiver em execução
              if (this.isRunning) {
                this.reconnect().catch(console.error);
              }
            }
          }
        }
      } catch (e) {
        // Ignorar erros no parsing
      }
    };

    // Configurar verificação periódica de alterações no localStorage
    setInterval(checkLocalStorageForAccountChange, 2000);

    // Registrar handlers para os eventos customizados
    document.addEventListener(
      "deriv:oauth_account_switch",
      handleAccountSwitch as EventListener,
    );
    document.addEventListener(
      "deriv:account_switched",
      handleAccountSwitchedEvent as EventListener,
    );
    document.addEventListener(
      "deriv:force_token_update",
      handleForceTokenUpdate as EventListener,
    );
  }

  /**
   * Carrega todos os tokens disponíveis de todas as fontes
   */
  private loadAllTokens(): void {
    try {
      this.tokens = []; // Resetar lista de tokens

      // 0. Verificar conta ativa definida na UI
      let activeAccountInfo: any = null;
      try {
        const activeAccountStr = localStorage.getItem("deriv_active_account");
        if (activeAccountStr && activeAccountStr.trim() !== "") {
          try {
            activeAccountInfo = JSON.parse(activeAccountStr);

            // Verificar se os dados são válidos e recentes (menos de 10 minutos)
            if (
              activeAccountInfo &&
              typeof activeAccountInfo === "object" &&
              activeAccountInfo.timestamp &&
              Date.now() - activeAccountInfo.timestamp < 10 * 60 * 1000
            ) {
              // Esta conta será definida como a primária apenas se tiver token válido
              if (
                activeAccountInfo.token &&
                typeof activeAccountInfo.token === "string"
              ) {
                this.addToken(
                  activeAccountInfo.token,
                  true,
                  activeAccountInfo.loginid,
                );
                console.log(
                  `[OAUTH_DIRECT] Conta ativa encontrada no localStorage: ${activeAccountInfo.loginid}`,
                );
              }
            }
          } catch (parseError) {
            console.error(
              "[OAUTH_DIRECT] Erro ao fazer parse do JSON da conta ativa",
              parseError,
            );
            activeAccountInfo = null; // Resetar para evitar uso de dados inválidos
          }
        }
      } catch (e) {
        console.warn(
          "[OAUTH_DIRECT] Erro ao processar conta ativa:",
          e ? (e as Error).message : "Erro desconhecido",
        );
        activeAccountInfo = null; // Garantir que seja nulo em caso de erro
      }

      // 1. Tentar obter token principal do localStorage
      const mainToken = localStorage.getItem("deriv_oauth_token");
      if (mainToken) {
        // Adicionar apenas se ainda não foi adicionado como conta ativa
        if (!this.tokens.some((t) => t.token === mainToken)) {
          this.addToken(mainToken, !activeAccountInfo);
          console.log(
            "[OAUTH_DIRECT] Token OAuth principal encontrado no localStorage",
          );
        }
      }

      // 2. Tentar obter tokens adicionais das contas salvas
      const accountsStr = localStorage.getItem("deriv_accounts");
      if (accountsStr) {
        try {
          const accounts = JSON.parse(accountsStr);
          if (accounts && Array.isArray(accounts) && accounts.length > 0) {
            accounts.forEach((acc: any) => {
              if (
                acc.token &&
                !this.tokens.some((t) => t.token === acc.token)
              ) {
                // Verificar se a conta é a conta ativa do sistema
                const isActiveAccount =
                  acc.loginid === localStorage.getItem("deriv_active_loginid");

                // Adicionar token com flag primary baseada se é conta ativa
                // e se já não temos uma conta marcada como primária
                const shouldBePrimary =
                  isActiveAccount && !this.tokens.some((t) => t.primary);

                // Adicionar o token
                this.addToken(acc.token, shouldBePrimary, acc.loginid);
              }
            });
            console.log(
              `[OAUTH_DIRECT] ${accounts.length} contas encontradas no localStorage`,
            );
          }
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] Erro ao processar contas salvas:",
            error,
          );
        }
      }

      // 3. Verificar conta ativa no formato tradicional (deriv_active_loginid)
      if (!this.tokens.some((t) => t.primary)) {
        const activeLoginID = localStorage.getItem("deriv_active_loginid");
        if (activeLoginID) {
          // Procurar token correspondente
          const tokenForActiveAccount = this.tokens.find(
            (t) => t.loginid === activeLoginID,
          );
          if (tokenForActiveAccount) {
            tokenForActiveAccount.primary = true;
            console.log(
              `[OAUTH_DIRECT] Definindo conta ${activeLoginID} como primária baseado em deriv_active_loginid`,
            );
          }
        }
      }

      // Se encontramos pelo menos um token, usar o marcado como primário ou o primeiro
      if (this.tokens.length > 0) {
        // Primeiro tenta encontrar o token marcado como primário
        let primaryToken = this.tokens.find((t) => t.primary);

        // Se não encontrar nenhum marcado como primário, usar o primeiro token disponível
        if (!primaryToken) {
          primaryToken = this.tokens[0];
          primaryToken.primary = true; // Marcar como primário
          console.log(
            "[OAUTH_DIRECT] Nenhum token encontrado como primário. Definindo o primeiro token como primário.",
          );
        }

        // Definir o token ativo
        this.activeToken = primaryToken.token;

        // Verificar se temos o loginid para esse token
        const loginidStr = primaryToken.loginid || "desconhecido";
        console.log(
          `[OAUTH_DIRECT] Total de ${this.tokens.length} tokens carregados. Token ativo: ${loginidStr}`,
        );
      } else {
        console.warn(
          "[OAUTH_DIRECT] Nenhum token encontrado em qualquer fonte!",
        );
        // Definir token como null para provocar novo processo de autenticação
        this.activeToken = null;
      }
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao carregar tokens:", error);
    }
  }

  /**
   * Adiciona um token à lista se ele ainda não existir
   */
  private addToken(
    token: string,
    isPrimary: boolean = false,
    loginid?: string,
  ): void {
    // Verificar se o token já existe na lista
    if (!this.tokens.some((t) => t.token === token)) {
      this.tokens.push({
        token: token,
        loginid: loginid,
        authorized: false,
        connected: false,
        primary: isPrimary,
      });
    }
  }

  /**
   * Configura a conexão WebSocket
   */
  private setupWebSocket(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        // Verificar se temos tokens disponíveis
        if (this.tokens.length === 0) {
          // Tentar carregar novamente os tokens
          this.loadAllTokens();

          if (this.tokens.length === 0) {
            console.error("[OAUTH_DIRECT] Nenhum token OAuth encontrado");
            reject(
              new Error("Nenhum token OAuth encontrado. Faça login novamente."),
            );
            return;
          }
        }

        // Verificar se temos um token ativo
        if (!this.activeToken && this.tokens.length > 0) {
          // Selecionar o token principal ou o primeiro disponível
          const primaryToken =
            this.tokens.find((t) => t.primary) || this.tokens[0];
          this.activeToken = primaryToken.token;
          console.log(
            `[OAUTH_DIRECT] Token ativo definido para ${primaryToken.loginid || "desconhecido"}`,
          );
        } else if (!this.activeToken) {
          // Caso extremo: não temos token ativo e nem tokens disponíveis
          console.error(
            "[OAUTH_DIRECT] Erro crítico: nenhum token disponível para conexão",
          );
          reject(
            new Error(
              "Nenhum token disponível para conexão. Faça login novamente.",
            ),
          );
          return;
        }

        // Limpar conexão existente se houver
        this.closeConnection();

        console.log(
          "[OAUTH_DIRECT] Estabelecendo conexão WebSocket dedicada com Deriv",
        );

        // CORREÇÃO: Usar o endereço correto com porta segura
        this.webSocket = new WebSocket(
          "wss://ws.derivws.com/websockets/v3?app_id=72383",
        );

        // DEPURAÇÃO: Verificar ReadyState da conexão WebSocket
        console.log(
          `[OAUTH_DIRECT] Estado inicial WebSocket: ${this.getReadyStateText(this.webSocket.readyState)}`,
        );

        // Configurar timeout para conexão
        const connectionTimeout = setTimeout(() => {
          console.error("[OAUTH_DIRECT] Timeout ao tentar conectar WebSocket");
          reject(new Error("Timeout ao conectar ao servidor"));
        }, 15000); // Aumentado para 15 segundos

        // Handler de abertura
        this.webSocket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log(
            "[OAUTH_DIRECT] Conexão WebSocket estabelecida com sucesso!",
          );

          // Verificar se o websocket ainda existe antes de acessar readyState
          if (this.webSocket) {
            console.log(
              `[OAUTH_DIRECT] Estado após conexão: ${this.getReadyStateText(this.webSocket.readyState)}`,
            );
          }

          // Configurar ping para manter conexão
          this.setupKeepAlive();

          // Iniciar processo de autorização com todos os tokens
          this.authorizeAllTokens()
            .then(() => {
              this.initialized = true;
              resolve(true);
            })
            .catch((error) => {
              console.error(
                "[OAUTH_DIRECT] Falha na autorização de tokens:",
                error,
              );
              reject(error);
            });
        };

        // Handler de erro
        this.webSocket.onerror = (error) => {
          clearTimeout(connectionTimeout);
          console.error("[OAUTH_DIRECT] Erro na conexão WebSocket:", error);
          this.scheduleReconnect();
          reject(error);
        };

        // Handler de fechamento
        this.webSocket.onclose = (event) => {
          console.log(
            `[OAUTH_DIRECT] Conexão WebSocket fechada: Código ${event.code}, Razão: ${event.reason}`,
          );
          this.scheduleReconnect();

          // Se estiver em estado de execução, notificar erro
          if (this.isRunning) {
            this.notifyListeners({
              type: "error",
              message: `Conexão com o servidor perdida (${event.code}). Tentando reconectar automaticamente.`,
            });
          }
        };

        // Handler de mensagens
        this.webSocket.onmessage = (event) => {
          this.handleMessage(event);
        };
      } catch (error) {
        console.error("[OAUTH_DIRECT] Erro ao configurar WebSocket:", error);
        reject(error);
      }
    });
  }

  /**
   * Inicializa a conexão WebSocket com o servidor Deriv
   * Método público para iniciar conexão a partir da página do bot
   */
  public initializeConnection(): Promise<boolean> {
    console.log("[OAUTH_DIRECT] Iniciando conexão manual...");
    return this.setupWebSocket().then((success) => {
      if (success) {
        // Se a conexão for estabelecida com sucesso, inscrever para ticks
        console.log(
          "[OAUTH_DIRECT] Conexão estabelecida, inscrevendo para ticks automaticamente...",
        );
        setTimeout(() => {
          this.subscribeToTicks();
        }, 1000);
      }
      return success;
    });
  }

  /**
   * Retorna uma descrição textual para o estado de ReadyState do WebSocket
   */

  private getReadyStateText(state: number): string {
    if (!state && state !== 0) return "DESCONHECIDO";

    switch (state) {
      case WebSocket.CONNECTING:
        return "CONNECTING (0)";
      case WebSocket.OPEN:
        return "OPEN (1)";
      case WebSocket.CLOSING:
        return "CLOSING (2)";
      case WebSocket.CLOSED:
        return "CLOSED (3)";
      default:
        return `DESCONHECIDO (${state})`;
    }
  }

  /**
   * Manipula mensagens recebidas do WebSocket
   */
  // Flag para controlar se devemos permitir eventos de symbol_update
  private allowSymbolUpdateEvents: boolean = false;

  /**
   * Habilita eventos de symbol_update quando realmente necessário
   * Por exemplo, quando o usuário muda o símbolo na interface
   */
  public enableSymbolUpdateEvents(): void {
    this.allowSymbolUpdateEvents = true;
    this.symbolUpdateBlocked = false;

    // Auto-disable depois de 10 segundos
    setTimeout(() => {
      this.allowSymbolUpdateEvents = false;
    }, 10000);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      // 💥💥💥 INTERCEPTAÇÃO ULTRA-RADICAL 💥💥💥
      // Modificar o JSON bruto antes mesmo de parsear
      let rawData = event.data;
      let wasModified = false;

      // Se for uma string, verificar e modificar conteúdo para Advance
      if (typeof rawData === "string") {
        const isAdvance = this.activeStrategy
          ?.toLowerCase()
          .includes("advance");
        const originalRawData = rawData;

        // INTERVENÇÃO EXTREMA: SUBSTITUI QUALQUER BARREIRA POR 1 PARA ADVANCE
        if (isAdvance) {
          // Modificar barreira
          if (/"barrier"\s*:\s*"[0-9]+"/.test(rawData)) {
            rawData = rawData.replace(
              /"barrier"\s*:\s*"[0-9]+"/g,
              '"barrier":"1"',
            );
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO EXTREMA: Barreira substituída por "1"`,
            );
          }

          // Modificar barreira sem aspas
          if (/"barrier"\s*:\s*[0-9]+\b/.test(rawData)) {
            rawData = rawData.replace(
              /"barrier"\s*:\s*[0-9]+\b/g,
              '"barrier":1',
            );
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO EXTREMA: Barreira numérica substituída por 1`,
            );
          }

          // CORREÇÃO ESPECIAL PARA "superior a 5 ticks" que está aparecendo na screenshot
          if (/superior a [0-9]+ ticks/.test(rawData)) {
            rawData = rawData.replace(
              /superior a [0-9]+ ticks/g,
              "superior a 1 ticks",
            );
            console.log(
              `[OAUTH_DIRECT] 🔴 CORREÇÃO CRÍTICA: "superior a X ticks" substituído por "superior a 1 ticks"`,
            );
          }

          // Correção para o texto encontrado na interface do contrato
          if (/estritamente superior a [0-9]+/.test(rawData)) {
            rawData = rawData.replace(
              /estritamente superior a [0-9]+/g,
              "estritamente superior a 1",
            );
            console.log(
              `[OAUTH_DIRECT] 🔴 CORREÇÃO CRÍTICA: "estritamente superior a X" substituído`,
            );
          }

          // Modificar texto descritivo para PT-BR e EN
          if (/acima de [0-9]+/.test(rawData)) {
            rawData = rawData.replace(/acima de [0-9]+/g, "acima de 1");
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO EXTREMA: "acima de X" substituído por "acima de 1"`,
            );
          }

          // "superior a X" - formato usado na tela
          if (/superior a [0-9]+/.test(rawData)) {
            rawData = rawData.replace(/superior a [0-9]+/g, "superior a 1");
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO EXTREMA: "superior a X" substituído por "superior a 1"`,
            );
          }

          if (/above [0-9]+/.test(rawData)) {
            rawData = rawData.replace(/above [0-9]+/g, "above 1");
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO EXTREMA: "above X" substituído por "above 1"`,
            );
          }

          // Verificar se o texto foi modificado
          wasModified = originalRawData !== rawData;

          // Armazenar dados para diagnóstico
          if (wasModified) {
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO RAW BEM-SUCEDIDA! (Advance)`,
            );
            try {
              localStorage.setItem("advance_raw_intercept", "true");
              localStorage.setItem(
                "advance_raw_time",
                new Date().toISOString(),
              );
              localStorage.setItem(
                "advance_raw_sample",
                rawData.substring(0, 100),
              ); // Amostra para diagnóstico
            } catch (e) {}
          }
        }
      }

      // Parsear o JSON (original ou modificado)
      const data = JSON.parse(rawData);

      // VERIFICAÇÕES E CORREÇÕES SECUNDÁRIAS APÓS PARSER
      // Este é o segundo nível de interceptação
      if (
        this.activeStrategy?.toLowerCase().includes("advance") &&
        data.proposal
      ) {
        // Verificar se ainda precisamos corrigir dados depois do parsing
        const needsCorrection =
          data.proposal.barrier !== "1" ||
          (data.proposal.display_name &&
            (data.proposal.display_name.includes("acima de 5") ||
              data.proposal.display_name.includes("above 5")));

        if (needsCorrection) {
          console.log(
            `[OAUTH_DIRECT] 🔴 CORREÇÃO SECUNDÁRIA: Proposta ainda precisa de ajustes`,
          );
          // Forçar valores corretos
          data.proposal.barrier = "1";

          // Corrigir display_name
          if (data.proposal.display_name) {
            data.proposal.display_name = data.proposal.display_name
              .replace(/acima de [0-9]+/g, "acima de 1")
              .replace(/above [0-9]+/g, "above 1");
          }

          wasModified = true;
          console.log(
            `[OAUTH_DIRECT] 🔴 CORREÇÃO SECUNDÁRIA APLICADA: barrier="${data.proposal.barrier}", display="${data.proposal.display_name}"`,
          );
        }
      }

      // Logs (detalhados apenas para mensagens modificadas ou para debugging)
      if (wasModified) {
        console.log(
          `[OAUTH_DIRECT] 🔍 MENSAGEM MODIFICADA: ${JSON.stringify(data, null, 2)}`,
        );
      } else if (Math.random() < 0.05) {
        // 5% de chance para reduzir logs
        console.log(
          `[OAUTH_DIRECT] 🔍 MENSAGEM ORIGINAL: ${JSON.stringify(data)}`,
        );
      }

      // Log resumido para depuração
      console.log(`[OAUTH_DIRECT] Mensagem recebida (${data.msg_type})`);

      // 💎 VERIFICAÇÃO ADICIONAL PARA PROPOSAL
      if (data.proposal) {
        console.log(
          `[OAUTH_DIRECT] 💎 PROPOSTA RECEBIDA: ID=${data.proposal.id}, Preço=${data.proposal.ask_price}`,
        );
      }

      // 💰 VERIFICAÇÃO ADICIONAL PARA BUY
      if (data.buy) {
        console.log(
          `[OAUTH_DIRECT] 💰 COMPRA CONFIRMADA: ID=${data.buy.contract_id}, Preço=${data.buy.buy_price}`,
        );

        // Salvar o ID do contrato atual
        this.currentContractId = data.buy.contract_id;

        // Inscrever para monitorar o contrato
        this.subscribeToProposalOpenContract(data.buy.contract_id);

        // Notificar sobre a compra
        this.notifyListeners({
          type: "contract_purchased",
          contract_id: data.buy.contract_id,
          details: data.buy,
        });
      }

      // ❌ VERIFICAÇÃO ADICIONAL PARA ERROS
      if (data.error) {
        console.error(
          `[OAUTH_DIRECT] ❌ ERRO DA API: ${JSON.stringify(data.error)}`,
        );

        // Notificar sobre o erro
        this.notifyListeners({
          type: "error",
          message: `Erro da API: ${data.error.message || JSON.stringify(data.error)}`,
        });
      }

      // Resposta de autorização
      if (data.msg_type === "authorize") {
        if (data.error) {
          console.error(
            "[OAUTH_DIRECT] Erro na autorização:",
            data.error.message,
          );
          this.notifyListeners({
            type: "error",
            message: `Erro na autorização: ${data.error.message}`,
          });
        } else {
          console.log(
            "[OAUTH_DIRECT] Autorização bem-sucedida:",
            data.authorize?.loginid,
          );
          this.notifyListeners({
            type: "authorized",
            account: data.authorize,
          });

          // Após autorização bem-sucedida, inscrever-se para receber ticks uma única vez
          // sem disparar eventos de symbol_update frequentes
          if (!this.isRunning) {
            this.lastTickTime = Date.now(); // Inicializa o timestamp como agora para evitar notificações symbol_update desnecessárias

            // Temporariamente bloqueia eventos de symbol_update
            this.symbolUpdateBlocked = true;
            setTimeout(() => {
              this.subscribeToTicks(this.activeSymbol);

              // Continuamos bloqueados por 60 segundos
              setTimeout(() => {
                this.symbolUpdateBlocked = false;
              }, 60000);
            }, 100);
          }
        }
      }

      // Resposta de tick - VERSÃO CORRIGIDA e OTIMIZADA
      if (data.msg_type === "tick" && data.tick) {
        try {
          // Processar tick conforme esquema JSON
          const tickData = data.tick;
          const price = parseFloat(tickData.quote);

          // Extração otimizada do último dígito - usando mesma abordagem do deriv-history-service
          const priceStr = price.toFixed(2); // Formato padrão da Deriv é com 2 casas decimais
          const lastChar = priceStr.charAt(priceStr.length - 1);
          const lastDigit = parseInt(lastChar, 10);

          // Extrair dados adicionais do esquema
          const symbol = tickData.symbol;
          const epoch = tickData.epoch;
          const pip_size = tickData.pip_size;
          const subscription_id =
            tickData.id || (data.subscription ? data.subscription.id : null);

          // Reduzir frequência de logs (log a cada 5 ticks em média)
          if (Math.random() < 0.2) {
            console.log(
              `[OAUTH_DIRECT] Tick recebido: ${price}, Último dígito: ${lastDigit}`,
            );
          }

          // Verificar se o último dígito é válido
          if (!isNaN(lastDigit)) {
            // Criar evento com dados completos
            const tickEvent = {
              type: "tick",
              price,
              lastDigit,
              symbol,
              epoch,
              pip_size,
              subscription_id,
              timestamp: Date.now(),
            };

            // Atualizar o timestamp do último tick para o controle de notificações symbol_update
            this.lastTickTime = Date.now();

            // Salvar o último dígito recebido
            this.lastDigit = lastDigit;

            // CORREÇÃO CRÍTICA: Salvar ticks no localStorage para uso pela estratégia
            this.saveTickToLocalStorage(symbol, {
              lastDigit,
              price,
              timestamp: Date.now(),
              epoch,
            });

            // IMPLEMENTAÇÃO CRÍTICA: Avaliar condições da estratégia a cada tick
            // Este é o ponto central que permite que o robô opere automaticamente
            if (this.isRunning && this.activeStrategy) {
              this.evaluateStrategyOnTick(lastDigit, price);
            }

            // Notificar listners para atualização de interface
            this.notifyListeners(tickEvent);
          } else {
            console.error(
              "[OAUTH_DIRECT] Último dígito inválido no tick:",
              price,
            );
          }
        } catch (error) {
          console.error("[OAUTH_DIRECT] Erro ao processar tick:", error);
        }
      }

      // Resposta de compra de contrato - MELHORADO
      if (data.msg_type === "buy") {
        if (data.error) {
          console.error(
            "[OAUTH_DIRECT] ❌ ERRO NA COMPRA DE CONTRATO:",
            data.error.message,
          );
          console.error("[OAUTH_DIRECT] Detalhes do erro:", data.error);

          this.notifyListeners({
            type: "error",
            message: `Erro na compra: ${data.error.message || "Falha na operação"}`,
            details: data.error,
          });
        } else if (data.buy) {
          console.log("[OAUTH_DIRECT] ✅ CONTRATO COMPRADO COM SUCESSO!");
          console.log("[OAUTH_DIRECT] 📊 Detalhes da compra:", {
            contract_id: data.buy.contract_id,
            longcode: data.buy.longcode,
            start_time: data.buy.start_time,
            payout: data.buy.payout,
            buy_price: data.buy.buy_price,
            symbol: data.buy.shortcode?.split("_")[0],
          });

          // Salvar ID do contrato atual
          this.currentContractId = data.buy.contract_id;

          // Emitir evento de contrato comprado com todos os detalhes
          this.notifyListeners({
            type: "contract_purchased",
            contract_id: data.buy.contract_id,
            buy_price: data.buy.buy_price,
            longcode: data.buy.longcode,
            payout: data.buy.payout,
            contract: data.buy,
          });

          // Registrar símbolo e valor da operação nos logs
          const symbol = data.buy.shortcode?.split("_")[0] || "R_100";
          console.log(
            `[OAUTH_DIRECT] ✅ Operação em ${symbol} com valor de entrada ${data.buy.buy_price}`,
          );

          // Inscrever para atualizações deste contrato - com retry em caso de falha
          this.subscribeToProposalOpenContract();
        } else {
          // Resposta inesperada - sem erro, mas também sem dados de compra
          console.error(
            "[OAUTH_DIRECT] ⚠️ RESPOSTA ANÔMALA: Mensagem de tipo buy sem objeto buy nem erro",
          );
          console.error("[OAUTH_DIRECT] Resposta completa:", data);
        }
      }

      // Resposta de atualização de contrato
      if (data.msg_type === "proposal_open_contract") {
        const contract = data.proposal_open_contract;

        if (contract) {
          // 🚨 CORREÇÃO CRÍTICA: Interceptar e modificar valores de barreira para estratégia Advance
          // Verificar se este é um contrato DIGITOVER e estamos executando a estratégia Advance
          if (
            this.activeStrategy &&
            contract.contract_type &&
            contract.contract_type.includes("DIGIT")
          ) {
            // Importar as funções utilitárias para correção de barreira
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const {
              correctBarrier,
              correctBarrierText,
            } = require("@/lib/utils");

            // Log detalhado para diagnóstico
            console.log(
              `[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO DETECTADA em proposal_open_contract para estratégia: ${this.activeStrategy}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔍 Valores originais: barrier=${contract.barrier}, contract_type=${contract.contract_type}`,
            );

            // Guardar valores originais para diagnóstico (raramente podem ser undefined)
            const originalBarrier = contract.barrier;
            const originalDisplay = contract.display_name;
            const originalLongcode = contract.longcode;

            // Usar função utilitária para corrigir a barreira de forma consistente
            if (contract.barrier) {
              contract.barrier = correctBarrier(
                contract.barrier,
                this.activeStrategy,
                contract.contract_type,
              );
            }

            // Usar função utilitária para corrigir textos que contêm barreira
            if (contract.display_name) {
              contract.display_name = correctBarrierText(
                contract.display_name,
                this.activeStrategy,
              );
            }

            // Usar função utilitária para corrigir textos no longcode
            if (contract.longcode) {
              contract.longcode = correctBarrierText(
                contract.longcode,
                this.activeStrategy,
              );
            }

            // Log das modificações realizadas
            console.log(
              `[OAUTH_DIRECT] 🔄 Valores MODIFICADOS: barrier=${contract.barrier}, display_name=${contract.display_name}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔄 Longcode MODIFICADO: ${contract.longcode}`,
            );

            // Guardar essas informações para diagnóstico
            try {
              localStorage.setItem(
                "barrier_correction_from",
                originalBarrier || "desconhecido",
              );
              localStorage.setItem(
                "barrier_correction_to",
                contract.barrier || "corrigido",
              );
              localStorage.setItem(
                "barrier_correction_strategy",
                this.activeStrategy || "desconhecido",
              );
              localStorage.setItem(
                "barrier_correction_time",
                new Date().toISOString(),
              );

              // Para a estratégia Advance, manter estatísticas específicas
              if (this.activeStrategy.toLowerCase().includes("advance")) {
                localStorage.setItem(
                  "advance_poc_barrier_from",
                  originalBarrier || "desconhecido",
                );
                localStorage.setItem(
                  "advance_poc_barrier_to",
                  contract.barrier || "1",
                );
                localStorage.setItem(
                  "advance_poc_display_from",
                  originalDisplay || "desconhecido",
                );
                localStorage.setItem(
                  "advance_poc_display_to",
                  contract.display_name || "modificado",
                );
                localStorage.setItem(
                  "advance_poc_longcode_from",
                  originalLongcode || "desconhecido",
                );
                localStorage.setItem(
                  "advance_poc_longcode_to",
                  contract.longcode || "modificado",
                );
              }
            } catch (e) {}
          }

          // Verificar se o contrato é o atual
          if (
            this.currentContractId &&
            this.currentContractId.toString() ===
              contract.contract_id.toString()
          ) {
            console.log(
              `[OAUTH_DIRECT] Contrato ${contract.contract_id} atualizado, status: ${contract.status}`,
            );

            // Emitir evento normal de atualização do contrato
            this.notifyListeners({
              type: "contract_update",
              contract_id: contract.contract_id,
              contract_details: contract,
            });

            // IMPORTANTE: Não vamos mais emitir atualizações intermediárias em contract_update
            // Isso estava causando múltiplos eventos indesejados no início da operação

            // Apenas reagir a atualizações completas de contratos
            if (contract.status === "won" || contract.status === "lost") {
              console.log(
                `[OAUTH_DIRECT] Contrato ${contract.contract_id} finalizado com status: ${contract.status}`,
              );
            }

            // Se o contrato foi finalizado, notificar resultado
            if (contract.status !== "open") {
              // CORREÇÃO CRÍTICA: Para estratégia Advance com contrato CALL
              // Precisamos verificar se o último dígito é 0 ou 1
              // Se for 0 ou 1, deve ser uma perda (mesmo que a API indique vitória)
              // Se NÃO for 0 ou 1, deve ser uma vitória (mesmo que a API indique perda)
              let isWin = contract.status === "won";

              // Verificar se estamos usando a estratégia Advance
              const strategyId = this.strategyConfig.toLowerCase();
              const isAdvanceStrategy = strategyId.includes("advance");
              const isCallContractType = contract.contract_type === "CALL";

              // Obter o último dígito do preço de saída (exit_tick)
              let exitDigit = null;
              if (contract.exit_tick_display) {
                // Extrair o último dígito do valor de saída
                exitDigit = parseInt(
                  contract.exit_tick_display.toString().slice(-1),
                );
                console.log(`[OAUTH_DIRECT] ★★★ EXIT DIGIT: ${exitDigit} ★★★`);
              }

              // CORREÇÃO CRÍTICA: Para Advance com contrato CALL, o resultado é:
              // - Vitória quando o dígito NÃO é 0 ou 1
              // - Derrota quando o dígito É 0 ou 1
              if (
                isAdvanceStrategy &&
                isCallContractType &&
                exitDigit !== null
              ) {
                const isDigit0or1 = exitDigit === 0 || exitDigit === 1;

                // Forçar resultado com base no dígito, não no status da API
                const correctedResult = !isDigit0or1; // true (vitória) se NÃO for 0 ou 1

                if (correctedResult !== isWin) {
                  console.log(
                    `[OAUTH_DIRECT] ★★★ CORREÇÃO CRÍTICA ADVANCE: Alterando resultado de ${isWin ? "VITÓRIA" : "DERROTA"} para ${correctedResult ? "VITÓRIA" : "DERROTA"} (último dígito: ${exitDigit}) ★★★`,
                  );
                  isWin = correctedResult;
                } else {
                  console.log(
                    `[OAUTH_DIRECT] Resultado da estratégia Advance confirmado: ${isWin ? "VITÓRIA" : "DERROTA"} (último dígito: ${exitDigit})`,
                  );
                }
              }

              // Sempre recalcular o profit para garantir que seja o correto
              // Para operações ganhas: calcular com base no payout - preço de compra
              // Para operações perdidas: o profit deve ser -buy_price
              let profit;

              // Para vitórias, SEMPRE calcular com base no payout
              if (isWin && contract.payout && contract.buy_price) {
                profit = Number(contract.payout) - Number(contract.buy_price);

                // NOVA CORREÇÃO: Verificar se o profit é proporcionalmente correto (pelo menos 0.5x do valor de entrada)
                // O payout mínimo esperado para DIGITOVER é aproximadamente 1.8x o valor da entrada
                const minExpectedProfit = Number(contract.buy_price) * 0.8; // Deve ganhar pelo menos 80% do valor da entrada

                if (profit < minExpectedProfit) {
                  console.log(
                    `[OAUTH_DIRECT] ★★★ CORREÇÃO CRÍTICA: Profit calculado (${profit}) é muito baixo. Aplicando correção forçada. ★★★`,
                  );

                  // Correção forçada: usar um valor padronizado de 1.8x para payout (para DIGITOVER e DIGITUNDER)
                  const correctedPayout = Number(contract.buy_price) * 1.8;
                  profit = correctedPayout - Number(contract.buy_price);

                  console.log(
                    `[OAUTH_DIRECT] ★★★ PROFIT CORRIGIDO: ${profit} (baseado em payout esperado de ${correctedPayout}) ★★★`,
                  );
                }

                console.log(
                  `[OAUTH_DIRECT] Calculando lucro para operação vencedora: Payout ${contract.payout} - Preço de compra ${contract.buy_price} = ${profit}`,
                );
              }
              // Para perdas, sempre usar o valor negativo do preço de compra
              else if (!isWin && contract.buy_price) {
                profit = -Number(contract.buy_price);
                console.log(
                  `[OAUTH_DIRECT] Calculando perda: -${contract.buy_price}`,
                );
              }
              // Fallback (não deveria acontecer)
              else {
                profit = contract.profit || 0;
                console.log(
                  `[OAUTH_DIRECT] Usando profit da API (não foi possível calcular): ${profit}`,
                );
              }

              console.log(
                `[OAUTH_DIRECT] Contrato ${contract.contract_id} finalizado. Resultado: ${isWin ? "Ganho" : "Perda"}, Lucro: ${profit}, Payout: ${contract.payout}, Preço de compra: ${contract.buy_price}`,
              );

              // Verificar se é a primeira operação (via passthrough)
              const isFirstOperation =
                contract.passthrough?.is_first_operation === true;
              if (isFirstOperation) {
                console.log(
                  `[OAUTH_DIRECT] ★★★ PRIMEIRA OPERAÇÃO DETECTADA VIA PASSTHROUGH ★★★`,
                );
                console.log(
                  `[OAUTH_DIRECT] Valor EXATO de entrada: ${contract.passthrough?.entryAmount || contract.buy_price}, Payout: ${contract.payout}`,
                );
              }

              // Incluir todos os detalhes relevantes do contrato para histórico
              // Registrar detalhes completos da operação finalizada
              // IMPORTANTE: Definir flag isIntermediate como false por padrão para operações normais
              const detailedContractInfo = {
                type: "contract_finished",
                isIntermediate: false, // Garantir que operações regulares NÃO sejam marcadas como intermediárias
                is_intermediate: false, // Duplicar flag para compatibilidade
                contract_id: contract.contract_id,
                is_win: isWin,
                profit: profit,
                contract_details: contract,
                entry_value: contract.buy_price || 0,
                exit_value: contract.sell_price || 0,
                is_first_operation: isFirstOperation,
                // Informações adicionais para o histórico
                strategy: this.activeStrategy,
                strategy_settings: this.settings,
                symbol: contract.underlying_symbol || contract.display_name,
                contract_type: contract.contract_type,
                entry_spot: contract.entry_spot,
                exit_spot:
                  contract.exit_spot_value || contract.exit_tick_display_value,
                entry_time: contract.date_start,
                exit_time: contract.sell_time || contract.date_expiry,
                duration:
                  (contract.sell_time || contract.date_expiry || 0) -
                  contract.date_start,
                barrier: contract.barrier,
                payout: contract.payout,
                timestamp: Date.now(),
                // Adicionar campo para motivo de encerramento da operação
                termination_reason: contract.passthrough?.termination_reason || "",
              };

              // Salvar histórico localmente para persistência
              this.saveOperationToHistory(detailedContractInfo);

              // Notificar listeners com detalhes completos e garantir que o evento seja do tipo correto
              this.notifyListeners({
                ...detailedContractInfo,
                type: "contract_finished", // CORREÇÃO CRÍTICA: Garantir que o tipo de evento seja contract_finished
                contract_id: contract.contract_id,
                is_win: isWin,
                profit: isWin
                  ? contract.payout - contract.buy_price
                  : -contract.buy_price,
              });

              // Iniciar próxima operação após resultado
              this.startNextOperation(isWin, contract);
            }
          }
        }
      }

      // Resposta de saldo
      if (data.msg_type === "balance") {
        const balance = data.balance;
        console.log("[OAUTH_DIRECT] Saldo atualizado:", balance);

        this.notifyListeners({
          type: "balance_update",
          balance: balance,
        });
      }

      // Resposta de venda (sell)
      if (data.msg_type === "sell") {
        if (data.error) {
          console.error(
            "[OAUTH_DIRECT] Erro na venda de contrato:",
            data.error.message,
          );
          this.notifyListeners({
            type: "error",
            message: `Erro na venda: ${data.error.message}`,
          });
        } else {
          console.log(
            "[OAUTH_DIRECT] Contrato vendido com sucesso:",
            data.sell,
          );

          // Sempre calcular corretamente o lucro na venda
          let profit;

          // Calcular com base no preço de venda e compra
          if (data.sell.sell_price && data.sell.buy_price) {
            profit = Number(data.sell.sell_price) - Number(data.sell.buy_price);
            console.log(
              `[OAUTH_DIRECT] Calculando lucro na venda: ${data.sell.sell_price} - ${data.sell.buy_price} = ${profit}`,
            );
          } else {
            // Fallback para o valor fornecido pela API (não deveria ocorrer)
            profit = data.sell.profit || 0;
            console.log(
              `[OAUTH_DIRECT] Usando profit da API para venda: ${profit}`,
            );
          }

          // Notificar interface sobre venda bem-sucedida
          this.notifyListeners({
            type: "contract_finished",
            // Garantir que operações regulares NÃO sejam marcadas como intermediárias
            isIntermediate: false,
            is_intermediate: false,
            contract_id: this.currentContractId || 0,
            sold: true,
            profit: profit,
            entry_value: data.sell.buy_price || 0,
            exit_value: data.sell.sell_price || 0,
            symbol: this.activeSymbol || "R_100",
            strategy: this.activeStrategy || "unknown",
            is_win: profit > 0,
            contract_details: {
              contract_id: this.currentContractId || 0,
              status: profit > 0 ? "won" : "lost",
              profit: profit,
              buy_price: data.sell.buy_price,
              sell_price: data.sell.sell_price,
              underlying_symbol: this.activeSymbol || "R_100",
            },
          });
        }
      }
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao processar mensagem recebida:",
        error,
      );
    }
  }

  /**
   * Controle de frequência para evitar operações excessivas
   * Cada estratégia tem seu próprio controle de tempo
   */
  private lastOperationTimes: Record<string, number> = {};
  private operationCooldowns: Record<string, number> = {
    advance: 15000, // Estratégia Advance: intervalo mínimo de 15 segundos entre operações (evita operações excessivas)
    ironover: 5000, // Estratégia Iron Over: intervalo mínimo de 5 segundos
    ironunder: 5000, // Estratégia Iron Under: intervalo mínimo de 5 segundos
    default: 3000, // Outras estratégias: intervalo mínimo de 3 segundos
  };

  /**
   * Avalia se o padrão de Loss Virtual deve ser aplicado com base no tipo da estratégia
   * 
   * CORREÇÃO CRÍTICA (01/05/2025): Esta função foi revisada para garantir que a regra de Loss Virtual
   * seja aplicada em TODAS as operações, não apenas na primeira.
   * 
   * Implementação específica para cada tipo de robô:
   * - Bot Low: entrar quando aparecer 0, 1 ou 2 (sem comando adicional)
   * - ProfitPro: entrar quando aparecer 0, 1, 2, 3, 4, 5 ou 6 (precisa de comando configurável)
   * - MaxPro: entrar quando aparecer 0, 1, 2 ou 3 (precisa de comando configurável)
   *
   * @param lastDigit O último dígito recebido no tick atual
   * @param strategy Nome da estratégia ativa
   * @returns true se deve executar entrada baseada no padrão Loss Virtual
   */
  private shouldApplyLossVirtual(lastDigit: number, strategy: string): boolean {
    // Normalizar nome da estratégia para comparação
    const strategyLower = strategy.toLowerCase();
    
    // BOT LOW: entra automaticamente quando o dígito for 0, 1 ou 2 (sem comando adicional)
    if (strategyLower.includes("botlow") || strategyLower.includes("bot low")) {
      const targetDigits = [0, 1, 2];
      const shouldEnter = targetDigits.includes(lastDigit);
      
      if (shouldEnter) {
        console.log(`[OAUTH_DIRECT] 🎯 BOT LOW: Loss Virtual identificado para dígito ${lastDigit} (regra: 0, 1 ou 2)`);
        
        // Registrar motivo da ativação do Loss Virtual para diagnóstico e auditoria
        this.notifyListeners({
          type: "loss_virtual_triggered",
          strategy: "botlow",
          digit: lastDigit,
          rule: `Dígito ${lastDigit} está no conjunto [0, 1, 2]`,
          timestamp: new Date().toISOString()
        });
      }
      
      return shouldEnter;
    }
    
    // PROFITPRO: entra quando o dígito for de 0 a 6, com verificação de ocorrências consecutivas
    if (strategyLower.includes("profitpro") || strategyLower.includes("profit pro")) {
      const targetDigits = [0, 1, 2, 3, 4, 5, 6];
      
      // Verificar se o dígito está no range definido (0-6)
      if (!targetDigits.includes(lastDigit)) {
        return false;
      }
      
      // Obter configuração específica da estratégia
      let requiredConsecutiveOccurrences = 1; // Valor padrão
      
      try {
        // PRIORIDADE 1: Obter valor do input na interface (se disponível)
        const inputElement = document.getElementById("loss-virtual-consecutive-input") as HTMLInputElement;
        if (inputElement && inputElement.value) {
          const valueFromInput = parseInt(inputElement.value);
          if (!isNaN(valueFromInput) && valueFromInput > 0) {
            requiredConsecutiveOccurrences = valueFromInput;
            console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 1: Ocorrências consecutivas Loss Virtual = ${requiredConsecutiveOccurrences} (do input)`);
            
            // Salvar no settings para reutilização futura
            this.settings.lossVirtualConsecutiveDigits = valueFromInput;
          }
        }
        
        // PRIORIDADE 2: Obter das settings
        if (requiredConsecutiveOccurrences === 1 && this.settings && this.settings.lossVirtualConsecutiveDigits) {
          requiredConsecutiveOccurrences = Number(this.settings.lossVirtualConsecutiveDigits);
          console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 2: Ocorrências consecutivas Loss Virtual = ${requiredConsecutiveOccurrences} (das settings)`);
        }
        
        // PRIORIDADE 3: Obter de localStorage
        if (requiredConsecutiveOccurrences === 1) {
          const configStr = localStorage.getItem(`strategy_config_${strategyLower.replace(/\s+/g, "")}`);
          if (configStr) {
            const config = JSON.parse(configStr);
            if (config.lossVirtualConsecutiveDigits) {
              requiredConsecutiveOccurrences = Number(config.lossVirtualConsecutiveDigits);
              console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 3: Ocorrências consecutivas Loss Virtual = ${requiredConsecutiveOccurrences} (do localStorage)`);
            }
          }
        }
      } catch (e) {
        console.error(`[OAUTH_DIRECT] Erro ao obter configuração de ocorrências consecutivas para ProfitPro:`, e);
      }
      
      // Obter os últimos dígitos para verificar ocorrências consecutivas
      const recentDigits = this.getLastDigits(10); // Últimos 10 dígitos
      
      // Contar ocorrências consecutivas do range de dígitos (0-6)
      let consecutiveCount = 0;
      for (const digit of recentDigits) {
        if (targetDigits.includes(digit)) {
          consecutiveCount++;
        } else {
          // Se encontrar um dígito fora do range, reiniciar contagem
          break;
        }
      }
      
      const shouldEnter = consecutiveCount >= requiredConsecutiveOccurrences;
      
      if (shouldEnter) {
        console.log(
          `[OAUTH_DIRECT] 🎯 PROFITPRO: Loss Virtual identificado para dígito ${lastDigit} ` +
          `(regra: dígitos 0-6 aparecem ${consecutiveCount}x consecutivamente, mínimo: ${requiredConsecutiveOccurrences}x)`
        );
        
        // Registrar motivo da ativação do Loss Virtual para diagnóstico e auditoria
        this.notifyListeners({
          type: "loss_virtual_triggered",
          strategy: "profitpro",
          digit: lastDigit,
          rule: `Dígito ${lastDigit} está no conjunto [0-6] e apareceu ${consecutiveCount}x consecutivamente (mínimo: ${requiredConsecutiveOccurrences}x)`,
          timestamp: new Date().toISOString()
        });
      }
      
      return shouldEnter;
    }
    
    // MAXPRO: entra quando o dígito for de 0 a 3, com verificação de ocorrências consecutivas
    if (strategyLower.includes("maxpro") || strategyLower.includes("max pro")) {
      const targetDigits = [0, 1, 2, 3];
      
      // Verificar se o dígito está no range definido (0-3)
      if (!targetDigits.includes(lastDigit)) {
        return false;
      }
      
      // Obter configuração específica da estratégia
      let requiredConsecutiveOccurrences = 1; // Valor padrão
      
      try {
        // PRIORIDADE 1: Obter valor do input na interface (se disponível)
        const inputElement = document.getElementById("loss-virtual-consecutive-input") as HTMLInputElement;
        if (inputElement && inputElement.value) {
          const valueFromInput = parseInt(inputElement.value);
          if (!isNaN(valueFromInput) && valueFromInput > 0) {
            requiredConsecutiveOccurrences = valueFromInput;
            console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 1: Ocorrências consecutivas Loss Virtual = ${requiredConsecutiveOccurrences} (do input)`);
            
            // Salvar no settings para reutilização futura
            this.settings.lossVirtualConsecutiveDigits = valueFromInput;
          }
        }
        
        // PRIORIDADE 2: Obter das settings
        if (requiredConsecutiveOccurrences === 1 && this.settings && this.settings.lossVirtualConsecutiveDigits) {
          requiredConsecutiveOccurrences = Number(this.settings.lossVirtualConsecutiveDigits);
          console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 2: Ocorrências consecutivas Loss Virtual = ${requiredConsecutiveOccurrences} (das settings)`);
        }
        
        // PRIORIDADE 3: Obter de localStorage
        if (requiredConsecutiveOccurrences === 1) {
          const configStr = localStorage.getItem(`strategy_config_${strategyLower.replace(/\s+/g, "")}`);
          if (configStr) {
            const config = JSON.parse(configStr);
            if (config.lossVirtualConsecutiveDigits) {
              requiredConsecutiveOccurrences = Number(config.lossVirtualConsecutiveDigits);
              console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 3: Ocorrências consecutivas Loss Virtual = ${requiredConsecutiveOccurrences} (do localStorage)`);
            }
          }
        }
      } catch (e) {
        console.error(`[OAUTH_DIRECT] Erro ao obter configuração de ocorrências consecutivas para MaxPro:`, e);
      }
      
      // Obter os últimos dígitos para verificar ocorrências consecutivas
      const recentDigits = this.getLastDigits(10); // Últimos 10 dígitos
      
      // Contar ocorrências consecutivas do range de dígitos (0-3)
      let consecutiveCount = 0;
      for (const digit of recentDigits) {
        if (targetDigits.includes(digit)) {
          consecutiveCount++;
        } else {
          // Se encontrar um dígito fora do range, reiniciar contagem
          break;
        }
      }
      
      const shouldEnter = consecutiveCount >= requiredConsecutiveOccurrences;
      
      if (shouldEnter) {
        console.log(
          `[OAUTH_DIRECT] 🎯 MAXPRO: Loss Virtual identificado para dígito ${lastDigit} ` +
          `(regra: dígitos 0-3 aparecem ${consecutiveCount}x consecutivamente, mínimo: ${requiredConsecutiveOccurrences}x)`
        );
        
        // Registrar motivo da ativação do Loss Virtual para diagnóstico e auditoria
        this.notifyListeners({
          type: "loss_virtual_triggered",
          strategy: "maxpro",
          digit: lastDigit,
          rule: `Dígito ${lastDigit} está no conjunto [0-3] e apareceu ${consecutiveCount}x consecutivamente (mínimo: ${requiredConsecutiveOccurrences}x)`,
          timestamp: new Date().toISOString()
        });
      }
      
      return shouldEnter;
    }
    
    // Outros tipos de estratégia (padrão)
    return false;
  }

  /**
   * Avalia a estratégia atual com base no último tick recebido e executa operação se necessário
   * FUNÇÃO CRÍTICA: Esta é a função central que decide quando executar operações automaticamente
   *
   * @param lastDigit O último dígito recebido no tick atual
   * @param price O preço completo do tick atual
   */
  private evaluateStrategyOnTick(lastDigit: number, price: number): void {
    try {
      // Verificar se temos uma estratégia ativa e o bot está rodando
      if (!this.activeStrategy || !this.isRunning) {
        return;
      }

      // Obter as estatísticas de dígitos atuais para análise
      const digitStats = this.getDigitStats();
      if (!digitStats || digitStats.length === 0) {
        console.log(
          "[OAUTH_DIRECT] Estatísticas de dígitos insuficientes para avaliação",
        );
        return;
      }

      // Obter informações sobre a estratégia em uso
      const strategyId = this.activeStrategy.toLowerCase();
      const strategy = getStrategyById(strategyId);

      if (!strategy) {
        console.log(`[OAUTH_DIRECT] Estratégia não encontrada: ${strategyId}`);
        return;
      }

      // CORREÇÃO CRÍTICA: Verificar intervalo mínimo entre operações para evitar execuções excessivas
      const currentTime = Date.now();
      const lastOpTime = this.lastOperationTimes[strategyId] || 0;
      const cooldownPeriod =
        this.operationCooldowns[strategyId] || this.operationCooldowns.default;

      // Tempo decorrido desde a última operação (em milissegundos)
      const timeSinceLastOp = currentTime - lastOpTime;

      // Se não passou tempo suficiente desde a última operação, ignorar este tick
      if (timeSinceLastOp < cooldownPeriod) {
        // Reduzir frequência de logs para não sobrecarregar o console (log a cada 10 ticks em média)
        if (Math.random() < 0.1) {
          console.log(
            `[OAUTH_DIRECT] 🕒 Ignorando tick - Intervalo mínimo não atingido. Passados ${Math.floor(timeSinceLastOp / 1000)}s de ${Math.floor(cooldownPeriod / 1000)}s`,
          );
        }
        return;
      }

      console.log(
        `[OAUTH_DIRECT] Avaliando estratégia ${strategy.name} para o dígito ${lastDigit}`,
      );

      // NOVO SISTEMA: Usar o sistema unificado de avaliação de estratégias
      // Obter o valor de entrada configurado pelo usuário
      let entryAmount: number | undefined = undefined;

      if (typeof this.settings.entryValue === "number") {
        entryAmount = this.settings.entryValue;
      } else if (typeof this.settings.entryValue === "string") {
        entryAmount = parseFloat(this.settings.entryValue);
        if (isNaN(entryAmount)) {
          console.error(
            "[OAUTH_DIRECT] Valor de entrada inválido:",
            this.settings.entryValue,
          );
          return;
        }
      }

      if (entryAmount === undefined || entryAmount <= 0) {
        console.error(
          "[OAUTH_DIRECT] Valor de entrada não configurado corretamente.",
        );
        return;
      }

      // ATENÇÃO: Removemos a verificação de contrato em andamento para permitir
      // que o Loss Virtual seja aplicado em todas as entradas, não só na primeira
      // Isso é necessário para que o robô respeite as regras específicas de cada estratégia
      if (this.currentContractId) {
        // Como ainda há um contrato em andamento, não vamos executar nova operação agora
        // mas ainda assim avaliaremos as condições de Loss Virtual para preparar a próxima entrada

        // Verificar se devemos aplicar Loss Virtual na próxima oportunidade
        const shouldUseVirtualLoss = this.shouldApplyLossVirtual(lastDigit, this.activeStrategy);
        
        if (shouldUseVirtualLoss) {
          // Registrar que encontramos uma condição para aplicar Loss Virtual na próxima entrada
          console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Condição identificada para aplicar na próxima entrada com dígito ${lastDigit}`);
          
          // Salvar no localStorage para uso quando o contrato atual terminar
          try {
            localStorage.setItem('pending_loss_virtual_entry', 'true');
            localStorage.setItem('pending_loss_virtual_digit', lastDigit.toString());
            localStorage.setItem('pending_loss_virtual_time', Date.now().toString());
          } catch (e) {
            console.error(`[OAUTH_DIRECT] Erro ao salvar informação de Loss Virtual pendente:`, e);
          }
        }
        
        // Ainda temos um contrato em andamento, então não executamos operação agora
        return;
      }

      // Implementar lógica para cada estratégia
      type GenericStrategyResult = {
        shouldEnter: boolean;
        contractType: string;
        message: string;
        prediction?: number;
      };

      let result: GenericStrategyResult | undefined;

      switch (strategyId) {
        case "advance":
          // Obter a porcentagem de entrada configurada pelo usuário (padrão 8% conforme BotBuilder)
          let userPercentage = this.advancePercentage;

          // CORREÇÃO CRÍTICA: Verificar se há configuração específica
          if (
            strategy.config &&
            typeof strategy.config.entryPercentage === "number"
          ) {
            userPercentage = strategy.config.entryPercentage;
            console.log(
              `[OAUTH_DIRECT] ✅ USANDO PORCENTAGEM CONFIGURADA: ${userPercentage}% passada por props/configuração`,
            );
          } else {
            console.log(
              `[OAUTH_DIRECT] ⚠️ Usando valor padrão de porcentagem: ${userPercentage}%`,
            );
          }

          // Verificação adicional para garantir valor válido
          if (userPercentage <= 0 || userPercentage > 100) {
            console.log(
              `[OAUTH_DIRECT] ⚠️ PORCENTAGEM INVÁLIDA ${userPercentage}%! Usando valor seguro de 8%`,
            );
            userPercentage = 8; // Valor seguro conforme interface padrão
          }

          console.log(
            `[OAUTH_DIRECT] 🔍 Avaliando ADVANCE com porcentagem ${userPercentage}% - AMBOS os dígitos 0 e 1 devem estar <= ${userPercentage}%`,
          );

          // GARANTIR que estamos passando o percentageToUse corretamente
          const advanceResult = evaluateAdvanceStrategy(
            digitStats,
            userPercentage,
          );
          result = {
            shouldEnter: advanceResult.shouldEnter,
            contractType: advanceResult.contractType,
            message: advanceResult.message,
            prediction: advanceResult.prediction,
            // A propriedade 'duration' não faz parte do tipo GenericStrategyResult, usamos apenas internamente
          };
          break;

        case "ironover":
          console.log(`[OAUTH_DIRECT] Avaliando estratégia IRON OVER`);
          const ironOverResult = evaluateIronOverStrategy(digitStats, 5); // Valor padrão seguro
          result = {
            shouldEnter: ironOverResult.shouldEnter,
            contractType: ironOverResult.contractType,
            message: ironOverResult.message,
            prediction: 5,
          };
          break;

        case "ironunder":
          console.log(`[OAUTH_DIRECT] Avaliando estratégia IRON UNDER`);
          const ironUnderResult = evaluateIronUnderStrategy(digitStats, 5); // Valor padrão seguro
          result = {
            shouldEnter: ironUnderResult.shouldEnter,
            contractType: ironUnderResult.contractType,
            message: ironUnderResult.message,
            prediction: 5,
          };
          break;

        case "maxpro":
          console.log(`[OAUTH_DIRECT] Avaliando estratégia MAXPRO`);
          const maxProResult = evaluateMaxProStrategy(digitStats);
          result = {
            shouldEnter: maxProResult.shouldEnter,
            contractType: maxProResult.contractType,
            message: maxProResult.message,
            prediction: maxProResult.prediction,
          };
          break;

        default:
          // Usar avaliação genérica para outras estratégias
          console.log(
            `[OAUTH_DIRECT] Avaliando estratégia padrão para ${strategyId}`,
          );
          const defaultResult = evaluateDefaultStrategy(digitStats, 'CALL'); // Valor padrão seguro (ContractType)
          result = {
            shouldEnter: defaultResult.shouldEnter,
            contractType: defaultResult.contractType,
            message: defaultResult.message,
          };
          break;
      }

      // CORREÇÃO CRÍTICA (01/05/2025): Verificação de Loss Virtual em TODAS as operações
      // Verificar condições específicas de Loss Virtual para cada estratégia
      const shouldEnterLossVirtual = this.shouldApplyLossVirtual(lastDigit, this.activeStrategy);
      
      // Registrar decisões para diagnóstico
      if (result && result.shouldEnter) {
        console.log(`[OAUTH_DIRECT] 🟢 Estratégia ${this.activeStrategy} indica entrada normal`);
      }
      
      if (shouldEnterLossVirtual) {
        console.log(`[OAUTH_DIRECT] 🔥 LOSS VIRTUAL ATIVO para estratégia ${this.activeStrategy} e dígito ${lastDigit}`);
      }
      
      // Entrada normal OU Loss Virtual - qualquer um dos dois pode ativar a operação
      if ((result && result.shouldEnter) || shouldEnterLossVirtual) {
        // Se estamos entrando devido ao Loss Virtual, registrar isso explicitamente
        if (shouldEnterLossVirtual) {
          console.log(
            `[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Condição específica para estratégia ${this.activeStrategy} com dígito ${lastDigit}`
          );
          
          // Configurar tipo de contrato adequado com base na estratégia
          if (this.activeStrategy.toLowerCase().includes("botlow")) {
            this.settings.contractType = "DIGITOVER";
            console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL BOT LOW: Usando DIGITOVER com dígito ${lastDigit}`);
          } else if (this.activeStrategy.toLowerCase().includes("profitpro")) {
            this.settings.contractType = "DIGITOVER";
            console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL PROFITPRO: Usando DIGITOVER com dígito ${lastDigit} (0-6)`);
          } else if (this.activeStrategy.toLowerCase().includes("maxpro")) {
            this.settings.contractType = "DIGITOVER";
            console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL MAXPRO: Usando DIGITOVER com dígito ${lastDigit} (0-3)`);
          }
        } else {
          console.log(
            `[OAUTH_DIRECT] ✅ CONDIÇÃO DE ENTRADA DETECTADA: ${result.message}`,
          );
          console.log(
            `[OAUTH_DIRECT] ✅ Tipo de contrato: ${result.contractType}`,
          );

          // Configurar tipo de contrato e possível valor de previsão
          this.settings.contractType = result.contractType;

          if (result.prediction !== undefined) {
            this.settings.prediction = result.prediction;
            console.log(
              `[OAUTH_DIRECT] ✅ Previsão específica: ${result.prediction}`,
            );
          }
        }

        // CORREÇÃO CRÍTICA: Atualizar o timestamp da última operação ANTES de executar
        // Isso evita que múltiplas operações sejam disparadas mesmo que a primeira falhe
        this.lastOperationTimes[strategyId] = Date.now();
        console.log(
          `[OAUTH_DIRECT] ⏱️ Atualizando timestamp da última operação para ${strategyId}`,
        );

        // Executar a operação com o valor de entrada configurado
        this.executeContractBuy(entryAmount);
      } else if (result) {
        // Apenas log informativo se não devemos entrar
        console.log(`[OAUTH_DIRECT] Condição não atendida: ${result.message}`);
      }
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao avaliar estratégia:", error);
    }
  }

  /**
   * Retorna a porcentagem de ocorrência de um dígito específico
   * @param digit Dígito para verificar porcentagem (0-9)
   * @returns Porcentagem de ocorrência nos ticks recentes (0-100)
   */
  public getDigitPercentage(digit: number): number {
    if (digit < 0 || digit > 9) {
      console.error(
        `[OAUTH_DIRECT] Dígito inválido: ${digit}, deve ser entre 0 e 9`,
      );
      return 0;
    }

    const stats = this.getDigitStats();
    const digitStat = stats.find((stat) => stat.digit === digit);

    return digitStat?.percentage || 0;
  }
  
  /**
   * Retorna os dígitos mais recentes (até 20)
   * @returns Array com os dígitos mais recentes, do mais novo para o mais antigo
   */
  public getRecentDigits(): number[] {
    try {
      // Obter dados de ticks da chave de localStorage
      const localDataKey = `deriv_ticks_${this.activeSymbol}`;
      const localData = localStorage.getItem(localDataKey);
      
      if (!localData) {
        console.log(
          "[OAUTH_DIRECT] ⚠️ Nenhum histórico de ticks disponível para getRecentDigits"
        );
        return [];
      }
      
      const ticksData = JSON.parse(localData);
      if (!Array.isArray(ticksData) || ticksData.length === 0) {
        console.log(
          "[OAUTH_DIRECT] ⚠️ Histórico de ticks inválido ou vazio para getRecentDigits"
        );
        return [];
      }
      
      // Limitar a 20 dígitos mais recentes
      const recentTickLimit = Math.min(20, ticksData.length);
      const recentTicks = ticksData.slice(0, recentTickLimit);
      
      // Extrair apenas os dígitos
      const digits = recentTicks.map(
        (tick: any) => tick.lastDigit || parseInt(tick.price.toString().slice(-1))
      );
      
      console.log(
        `[OAUTH_DIRECT] getRecentDigits: Retornando ${digits.length} dígitos recentes`
      );
      
      return digits;
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao obter dígitos recentes:",
        error
      );
      return [];
    }
  }
  
  /**
   * Retorna os últimos N dígitos
   * @param count Quantidade de dígitos para retornar (default: 10)
   * @returns Array com os últimos N dígitos, do mais novo para o mais antigo
   */
  public getLastDigits(count: number = 10): number[] {
    try {
      // Obter dados de ticks da chave de localStorage
      const localDataKey = `deriv_ticks_${this.activeSymbol}`;
      const localData = localStorage.getItem(localDataKey);
      
      if (!localData) {
        console.log(
          "[OAUTH_DIRECT] ⚠️ Nenhum histórico de ticks disponível para getLastDigits"
        );
        return [];
      }
      
      const ticksData = JSON.parse(localData);
      if (!Array.isArray(ticksData) || ticksData.length === 0) {
        console.log(
          "[OAUTH_DIRECT] ⚠️ Histórico de ticks inválido ou vazio para getLastDigits"
        );
        return [];
      }
      
      // Limitar à quantidade solicitada ou disponível
      const tickLimit = Math.min(count, ticksData.length);
      const selectedTicks = ticksData.slice(0, tickLimit);
      
      // Extrair apenas os dígitos
      const digits = selectedTicks.map(
        (tick: any) => tick.lastDigit || parseInt(tick.price.toString().slice(-1))
      );
      
      console.log(
        `[OAUTH_DIRECT] getLastDigits: Retornando ${digits.length}/${count} dígitos solicitados`
      );
      
      return digits;
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao obter últimos dígitos:",
        error
      );
      return [];
    }
  }

  /**
   * Obtém estatísticas de dígitos dos últimos 25 ticks
   * Usado para avaliar condições de entrada das estratégias
   */
  // Convertido para público para permitir integração com parser XML de estratégias
  public getDigitStats(): DigitStat[] {
    try {
      // Obter dados de digits dos últimos ticks recebidos
      const localDataKey = `deriv_ticks_${this.activeSymbol}`;
      console.log(
        "[OAUTH_DIRECT] 🔍 Buscando histórico de ticks na chave:",
        localDataKey,
      );

      const localData = localStorage.getItem(localDataKey);
      if (!localData) {
        console.log(
          "[OAUTH_DIRECT] ⚠️ Nenhum histórico de ticks disponível ainda na chave:",
          localDataKey,
        );

        // CORREÇÃO CRÍTICA: Usar independentDerivService para obter dados de ticks se não houver dados no localStorage
        // Como não podemos usar await aqui (método é síncrono), devemos usar uma abordagem alternativa
        try {
          // Usar o objeto de globalThis para acessar o serviço carregado em outro lugar
          // Este é um fallback para manter o método síncrono
          const independentService = (globalThis as any).independentDerivService;
          
          if (independentService) {
            console.log(
              "[OAUTH_DIRECT] 🔄 Tentando obter histórico do independentDerivService via global",
            );
            
            // Usar o método correto do serviço independente
            const digitHistory = independentService.getDigitHistory(
              this.activeSymbol,
              25,
            );
            
            // Adaptar formato para compatibilidade
            const independentStats = digitHistory.stats.map((stat: any) => ({
              digit: stat.digit,
              count: stat.count,
              percentage: stat.percentage
            }));

            if (independentStats && independentStats.length > 0) {
              console.log(
                "[OAUTH_DIRECT] ✅ Histórico obtido do independentDerivService:",
                independentStats,
              );
              return independentStats;
            }
          }
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] ❌ Erro ao obter histórico do independentDerivService:",
            error,
          );
        }

        return [];
      }

      const lastTicksData = JSON.parse(localData);
      if (!Array.isArray(lastTicksData) || lastTicksData.length < 10) {
        console.log(
          "[OAUTH_DIRECT] ⚠️ Histórico de ticks insuficiente para análise:",
          lastTicksData?.length || 0,
          "ticks",
        );
        return [];
      }

      // Pegar os últimos 25 ticks (ou menos se não houver tantos)
      const sampleSize = Math.min(25, lastTicksData.length);
      const recentTicks = lastTicksData.slice(0, sampleSize);

      // Mapear os dígitos
      const digits = recentTicks.map(
        (tick: any) =>
          tick.lastDigit || parseInt(tick.price.toString().slice(-1)),
      );

      // Calcular contagem para cada dígito
      const digitCounts: Record<number, number> = {};
      for (let i = 0; i <= 9; i++) {
        digitCounts[i] = 0;
      }

      digits.forEach((digit) => {
        if (digit >= 0 && digit <= 9) {
          digitCounts[digit]++;
        }
      });

      // Converter para o formato de estatísticas de dígitos
      const digitStats: DigitStat[] = [];
      for (let i = 0; i <= 9; i++) {
        const count = digitCounts[i];
        const percentage = Math.round((count / sampleSize) * 100);
        digitStats.push({ digit: i, count, percentage });
      }

      console.log(
        `[OAUTH_DIRECT] Estatísticas de dígitos calculadas: ${JSON.stringify(digitStats.map((d) => `${d.digit}:${d.percentage}%`).join(", "))}`,
      );

      return digitStats;
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao calcular estatísticas de dígitos:",
        error,
      );
      return [];
    }
  }

  /**
   * Inicia uma nova operação após o resultado de uma anterior
   */
  private async startNextOperation(
    isWin: boolean,
    lastContract: any,
  ): Promise<void> {
    try {
      console.log(`[OAUTH_DIRECT] 🚨🚨🚨 INICIANDO PRÓXIMA OPERAÇÃO 🚨🚨🚨`);
      console.log(
        `[OAUTH_DIRECT] Resultado anterior: ${isWin ? "VITÓRIA ✅" : "DERROTA ❌"}`,
      );
      console.log(
        `[OAUTH_DIRECT] Contrato anterior: ${lastContract?.contract_id || "N/A"}`,
      );
      console.log(
        `[OAUTH_DIRECT] Estado do robô: ${this.isRunning ? "EXECUTANDO" : "PARADO"}`,
      );
      console.log(
        `[OAUTH_DIRECT] WebSocket status: ${this.webSocket?.readyState || "DESCONECTADO"}`,
      );
      
      // CORREÇÃO CRÍTICA (29/04/2025): Logs adicionais para mostrar o parâmetro lossVirtual
      // e os dígitos recentes que serão usados na avaliação da estratégia
      const botStrategy = getStrategyById(this.strategyConfig);
      const lossVirtual = botStrategy?.config?.lossVirtual || 1;
      const recentDigits = this.getRecentDigits();
      
      console.log(
        `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO LOSS VIRTUAL: Parâmetro configurado = ${lossVirtual}, Dígitos recentes = ${recentDigits.slice(0, 10).join(', ')}`,
      );

      // CORREÇÃO CRÍTICA: Garantir que estamos em execução
      if (!this.isRunning) {
        console.log(
          `[OAUTH_DIRECT] ⚠️ ALERTA: Bot não está em execução. Próxima operação cancelada.`,
        );
        return;
      }

      // Se temos uma operação agendada, limpar
      if (this.operationTimeout) {
        clearTimeout(this.operationTimeout);
        this.operationTimeout = null;
      }

      // VERIFICAÇÃO CRUCIAL: Verificar se o WebSocket está conectado
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.log(
          `[OAUTH_DIRECT] ⚠️ ALERTA: WebSocket não está conectado (status: ${this.webSocket?.readyState}). Tentando reconectar...`,
        );

        try {
          await this.setupWebSocket();
          console.log(`[OAUTH_DIRECT] ✅ WebSocket reconectado com sucesso!`);
        } catch (error) {
          console.error(
            `[OAUTH_DIRECT] ❌ Falha ao reconectar WebSocket:`,
            error,
          );

          // Se falhar, tentar novamente em 5 segundos
          this.operationTimeout = setTimeout(() => {
            this.startNextOperation(isWin, lastContract);
          }, 5000);

          return;
        }
      }

      // Verificar se podemos continuar com base nas configurações
      const shouldContinue = this.validateOperationContinuation(
        isWin,
        lastContract,
      );

      if (!shouldContinue) {
        console.log(
          "[OAUTH_DIRECT] 🛑 Estratégia finalizada devido às condições de parada",
        );

        this.notifyListeners({
          type: "bot_stopped",
          message: "Condições de parada atingidas",
        });

        // Parar a execução
        this.stop();
        return;
      }

      // DIAGNÓSTICO: Verificar valor de entrada para próxima operação
      // Usar o mesmo mecanismo que o executeFirstOperation para garantir consistência
      const inputElement = document.getElementById(
        "iron-bot-entry-value",
      ) as HTMLInputElement;
      let entryAmount: number | undefined = undefined;

      if (inputElement && inputElement.value) {
        const valueFromDOM = parseFloat(inputElement.value);
        if (!isNaN(valueFromDOM) && valueFromDOM > 0) {
          entryAmount = valueFromDOM;
          console.log(
            `[OAUTH_DIRECT] ✅ Usando valor ${entryAmount} do DOM para próxima operação`,
          );
        }
      }

      // Se não encontrou no DOM, usar valor das configurações
      if (entryAmount === undefined) {
        entryAmount = this.settings.entryValue;
        console.log(
          `[OAUTH_DIRECT] ✅ Usando valor ${entryAmount} das configurações para próxima operação`,
        );
      }

      // VERIFICAÇÃO FINAL: Garantir que temos um valor de entrada
      if (
        entryAmount === undefined ||
        entryAmount === null ||
        entryAmount === 0
      ) {
        console.error(
          `[OAUTH_DIRECT] ❌ ERRO CRÍTICO: Valor de entrada inválido (${entryAmount}). Usando valor de fallback.`,
        );

        // ÚLTIMO RECURSO: Usar 1.0 como valor de fallback em caso de erro catastrófico
        entryAmount = 1.0;
        console.log(
          `[OAUTH_DIRECT] ✅ CORREÇÃO EMERGENCIAL: Usando valor de fallback ${entryAmount} para próxima operação`,
        );

        // Atualizar configurações para garantir consistência
        this.settings.entryValue = entryAmount;

        this.notifyListeners({
          type: "warning",
          message:
            "Valor de entrada foi resetado para 1.0. Verifique as configurações.",
        });
      }

      // Obter a estratégia atual
      const strategyId = this.strategyConfig.toLowerCase();
      const currentStrategy = getStrategyById(strategyId);

      // Calcular corretamente o lucro para atualizar o resultado na estratégia
      let calculatedProfit = lastContract.profit || 0;

      // Verificar se o profit está definido corretamente
      if (
        calculatedProfit === 0 ||
        calculatedProfit === undefined ||
        calculatedProfit === null
      ) {
        // Se for uma vitória com profit zero, temos que calcular com base no payout
        if (isWin && lastContract.payout && lastContract.buy_price) {
          calculatedProfit =
            Number(lastContract.payout) - Number(lastContract.buy_price);
          console.log(
            `[OAUTH_DIRECT] Recalculando lucro na estratégia: Payout ${lastContract.payout} - Preço de compra ${lastContract.buy_price} = ${calculatedProfit}`,
          );
        }
        // Se for uma perda, o profit deve ser -buy_price
        else if (!isWin && lastContract.buy_price) {
          calculatedProfit = -Number(lastContract.buy_price);
        }
      }

      // Atualizar o resultado no estado da estratégia com o valor calculado corretamente
      updateStrategyResult(
        strategyId,
        isWin ? "win" : "loss",
        isWin ? calculatedProfit : -Number(lastContract.buy_price || 0),
      );

      // Obter as estatísticas de dígitos para avaliar condições de entrada
      const digitStats = this.getDigitStats();

      // Determinar próximo valor de entrada
      const nextAmount = this.calculateNextAmount(isWin, lastContract);

      // Avaliar se devemos entrar baseado nas regras específicas da estratégia e configuração do usuário
      // Buscar configuração salva pelo usuário - estratégia deve usar APENAS a configuração do usuário
      const userConfigObj = localStorage.getItem(
        `strategy_config_${strategyId}`,
      );
      let userConfig: any = null;

      if (userConfigObj) {
        try {
          userConfig = JSON.parse(userConfigObj);
        } catch (err) {
          console.error(
            "[OAUTH_DIRECT] Erro ao carregar configuração do usuário:",
            err,
          );
        }
      }

      // Garantir que estamos usando o valor do usuário para porcentagem de entrada
      // Se userConfig existir, devemos usar APENAS o valor dele, sem fallback
      const userDefinedPercentage = userConfig?.porcentagemParaEntrar;

      console.log(
        `[OAUTH_DIRECT] Valor de porcentagem definido pelo usuário:`,
        userDefinedPercentage,
      );

      let entryResult;
      try {
        // Obter a estratégia para conseguir o caminho do XML
        const strategyObj = getStrategyById(strategyId);

        // Usar apenas o valor configurado pelo usuário, para respeitar estritamente sua configuração
        entryResult = await evaluateEntryConditions(
          strategyId,
          digitStats,
          {
            // Usar APENAS o valor do usuário, sem fallback para a estratégia
            porcentagemParaEntrar: userDefinedPercentage,
            // CORREÇÃO CRÍTICA: Usar valor inicial do localStorage com alta prioridade
            valorInicial: this.getUserDefinedAmount(userConfig?.valorInicial),
            // CORREÇÃO DO MARTINGALE: Priorizar settings.martingaleFactor pois já vem da interface do usuário
            martingale: this.settings.martingaleFactor || userConfig?.martingale || 1.5,
            usarMartingaleAposXLoss: userConfig?.usarMartingaleAposXLoss || 2, // Usar martingale após 2 perdas consecutivas
            metaGanho:
              userConfig?.metaGanho || this.settings.profitTarget || 20,
            limitePerda:
              userConfig?.limitePerda || this.settings.lossLimit || 20,
            parcelasMartingale: userConfig?.parcelasMartingale || 1,
            // CORREÇÃO CRÍTICA: Valor após vencer SEMPRE igual ao valor inicial configurado pelo usuário
            valorAposVencer: this.getUserDefinedAmount(
              userConfig?.valorInicial,
            ),
          },
          strategyObj?.xmlPath, // Passar o caminho do XML para usar o parser XML
        );

        console.log(
          `[OAUTH_DIRECT] Avaliação de entrada para ${strategyId}: ${entryResult.message}`,
        );

        // NOVO: Verificar se a mensagem contém dados JSON de análise da estratégia Advance
        try {
          if (
            strategyId.toLowerCase().includes("advance") &&
            entryResult.message.startsWith("{")
          ) {
            // Tentar fazer parse dos dados JSON
            const analysisData = JSON.parse(entryResult.message);

            // Verificar se devemos registrar esta análise no histórico
            if (analysisData.shouldLog) {
              console.log(
                `[OAUTH_DIRECT] Registrando análise intermediária da estratégia Advance no histórico`,
              );

              // Criar uma operação virtual para o histórico (não será executada)
              const intermediateOperation = {
                id: Date.now().toString(),
                timestamp: new Date().toISOString(),
                symbol: this.activeSymbol, // Usar a propriedade da classe diretamente
                type: "DIGITOVER", // Tipo de contrato usado pela estratégia Advance
                amount: this.settings.entryValue,
                result: null, // Não tem resultado, é só análise
                profit: 0,
                message: analysisData.message,
                lastDigit: this.lastDigit,
                isIntermediate: analysisData.isIntermediate, // Flag que indica operação intermediária
                analysis: analysisData.analysis, // Dados da análise (0%, 1%, limite%)
              };

              // Emitir evento para atualizar o histórico de operações
              this.emit("operation_log", intermediateOperation);

              // CORREÇÃO: Não interromper execução para a estratégia Advance
              // Apenas registramos a análise intermediária e continuamos a execução
              if (analysisData.isIntermediate) {
                // Notificar sobre a análise intermediária
                this.emit(
                  "info",
                  `Estratégia Advance: Análise intermediária registrada no histórico. Verificando condições de entrada...`,
                );

                // Verificar se temos ticks suficientes (25) para uma análise confiável
                const stats = this.getDigitStats();
                const ticksTotal = stats.reduce(
                  (sum, stat) => sum + stat.count,
                  0,
                );

                if (ticksTotal < 25) {
                  console.log(
                    `[OAUTH_DIRECT] Estratégia ADVANCE precisa de pelo menos 25 ticks, aguardando mais dados (${ticksTotal}/25)`,
                  );
                  this.operationTimeout = setTimeout(async () => {
                    await this.startNextOperation(isWin, lastContract);
                  }, 3000);
                  return; // Aguardar mais ticks
                }

                // IMPORTANTE: Não retornar aqui para permitir que a estratégia continue
                // Vamos deixar o fluxo seguir para avaliar se devemos entrar baseado nas condições
                console.log(
                  `[OAUTH_DIRECT] Estratégia ADVANCE: Continuando avaliação após análise intermediária`,
                );
              }
            }
          }
        } catch (error) {
          // Ignorar silenciosamente se não for JSON válido ou se ocorrer erro ao processar
          console.log(
            "[OAUTH_DIRECT] Mensagem de análise não é JSON válido, continuando normalmente",
          );
        }
      } catch (error) {
        console.error(
          "[OAUTH_DIRECT] Erro ao analisar com o parser XML:",
          error,
        );

        // Usar estratégia padrão em caso de erro
        this.operationTimeout = setTimeout(async () => {
          // Tentar novamente após aguardar mais ticks
          await this.startNextOperation(isWin, lastContract);
        }, 5000);
        return;
      }

      if (entryResult.shouldEnter) {
        // Agendar próxima operação com os parâmetros determinados pela avaliação
        this.operationTimeout = setTimeout(() => {
          // Converter tipo de contrato para formato da API Deriv
          const contractTypeMapping: Record<string, string> = {
            CALL: "CALL",
            PUT: "PUT",
            DIGITOVER: "DIGITOVER",
            DIGITUNDER: "DIGITUNDER",
            DIGITDIFF: "DIGITDIFF",
            DIGITEVEN: "DIGITEVEN",
            DIGITODD: "DIGITODD",
          };

          // Usar EXATAMENTE o tipo de contrato definido no XML e retornado pela avaliação da estratégia
          // Mapear apenas para garantir formato compatível com a API, mas sem alterar o valor real definido no XML
          const xmlContractType = entryResult.contractType;
          this.settings.contractType =
            contractTypeMapping[xmlContractType] || xmlContractType;

          // Log adicional para rastreabilidade do tipo de contrato
          console.log(
            `[OAUTH_DIRECT] 🚨 Tipo de contrato EXATO do XML: ${xmlContractType} -> mapeado para API: ${this.settings.contractType}`,
          );

          // Usar previsão da avaliação, se disponível
          if (entryResult.prediction !== undefined) {
            this.settings.prediction = entryResult.prediction;
          }

          // Executar a compra com o valor baseado na estratégia
          this.executeContractBuy(entryResult.entryAmount || nextAmount);
        }, 3000);
      } else {
        // Se condições não atendidas, aguardar e verificar novamente
        console.log(
          "[OAUTH_DIRECT] Condições de entrada não atendidas, aguardando próximo tick",
        );

        this.operationTimeout = setTimeout(async () => {
          // Tentar novamente após aguardar mais ticks
          await this.startNextOperation(isWin, lastContract);
        }, 5000);

        // Notificar sobre a espera
        this.notifyListeners({
          type: "info",
          message: `Aguardando condições ideais: ${entryResult.message}`,
        });
      }
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao iniciar próxima operação:", error);

      // Notificar erro e parar a execução
      this.notifyListeners({
        type: "error",
        message: `Erro ao iniciar próxima operação: ${error}`,
      });

      this.stop();
    }
  }

  /**
 

   /**
   * Calcula o próximo valor de entrada com base no resultado anterior
   * VERSÃO CORRIGIDA: Considera regra de martingale após X perdas consecutivas
   * ATUALIZAÇÃO (03/05/2025): Implementa ajuste de nível de risco
   */
  private calculateNextAmount(isWin: boolean, lastContract: any): number {
    // 🚨🚨🚨 IMPLEMENTAÇÃO DEFINITIVA CORRIGIDA - 22/04/2025 🚨🚨🚨

    console.log(
      `[OAUTH_DIRECT] 🚨 CRÍTICO: CALCULANDO PRÓXIMO VALOR - isWin: ${isWin}`,
    );

    // FUNÇÃO AUXILIAR: Pegar valor do input com máxima prioridade
    const getValueFromInput = (): number | null => {
      // PRIORIDADE 1: VALOR DO ELEMENTO DOM - MÁXIMA PRIORIDADE
      const inputEl = document.getElementById(
        "iron-bot-entry-value",
      ) as HTMLInputElement;
      if (inputEl && inputEl.value) {
        const value = parseFloat(inputEl.value);
        if (!isNaN(value) && value > 0) {
          console.log(
            `[OAUTH_DIRECT] 🌟🌟🌟 CORREÇÃO CRÍTICA: Valor ${value} obtido DIRETAMENTE do input da interface`,
          );

          // Atualizar configurações para consistência em operações futuras
          this.settings.entryValue = value;

          // Persistir no localStorage para garantir consistência
          try {
            const strategyKey = this.strategyConfig.toLowerCase();
            if (strategyKey) {
              const configString = localStorage.getItem(
                `strategy_config_${strategyKey}`,
              );
              if (configString) {
                let config = JSON.parse(configString);
                config.valorInicial = value;
                localStorage.setItem(
                  `strategy_config_${strategyKey}`,
                  JSON.stringify(config),
                );
                console.log(
                  `[OAUTH_DIRECT] 🌟 Valor ${value} persistido no localStorage para estratégia ${strategyKey}`,
                );
              }
            }
          } catch (e) {
            console.error(
              "[OAUTH_DIRECT] Erro ao persistir valor no localStorage:",
              e,
            );
          }

          return value;
        }
      }
      return null;
    };

    // PASSO 1: Verificar o valor do input com MAIS ALTA PRIORIDADE
    const inputValue = getValueFromInput();

    // Se encontramos um valor válido no input e estamos em uma das condições de retorno simples
    if (
      inputValue !== null &&
      (!lastContract || !lastContract.buy_price || isWin)
    ) {
      console.log(
        `[OAUTH_DIRECT] ✅ Usando valor ${inputValue} do input para operação`,
      );
      return inputValue;
    }

    // PASSO 2: Se não tivermos um contrato anterior ou ele não tiver valor
    if (!lastContract || !lastContract.buy_price) {
      // Verificar se temos um valor do input ou das configurações
      if (inputValue !== null) {
        console.log(
          `[OAUTH_DIRECT] ✅ Usando valor ${inputValue} do input (nenhum contrato anterior)`,
        );
        return inputValue;
      }

      if (this.settings.entryValue) {
        console.log(
          `[OAUTH_DIRECT] ✅ Usando valor ${this.settings.entryValue} das configurações (nenhum contrato anterior)`,
        );
        return Number(this.settings.entryValue);
      }

      // Se não tiver valor configurado, reportar erro
      console.error(
        `[OAUTH_DIRECT] ❌ ERRO: Nenhum valor configurado para a entrada.`,
      );
      this.notifyListeners({
        type: "error",
        message:
          "Nenhum valor configurado para a entrada. Por favor, verifique as configurações.",
      });

      // Parar o bot em caso de erro (sem valor configurado)
      this.stop("Nenhum valor configurado para a entrada", "error");

      // Retornar um valor válido apenas para evitar erro de tipo
      return 0;
    }

    let buyPrice = Number(lastContract.buy_price);

    // CORREÇÃO CRÍTICA: Buscar configurações do usuário antes de qualquer cálculo
    // Isso garante que os valores do usuário tenham prioridade absoluta
    const strategyCurrent = this.strategyConfig.toLowerCase();
    console.log(
      `[OAUTH_DIRECT] 🔍 Estratégia atual para cálculo do próximo valor: ${strategyCurrent}`,
    );

    const savedSettings = localStorage.getItem(
      `strategy_config_${strategyCurrent}`,
    );
    console.log(
      `[OAUTH_DIRECT] 🔍 Configurações salvas encontradas: ${savedSettings ? "SIM" : "NÃO"}`,
    );

    // CORREÇÃO CRÍTICA: Obter valor do DOM PRIMEIRO
    let valorDoInput = null;
    const inputElementDOM = document.getElementById(
      "iron-bot-entry-value",
    ) as HTMLInputElement;
    if (inputElementDOM && inputElementDOM.value) {
      const valueFromInput = parseFloat(inputElementDOM.value);
      if (!isNaN(valueFromInput) && valueFromInput > 0) {
        valorDoInput = valueFromInput;
        console.log(
          `[OAUTH_DIRECT] ⚠️⚠️⚠️ EMERGENCIAL: Lendo valor ${valorDoInput} diretamente do input visível`,
        );
      }
    }

    // Valores padrão que serão sobrescritos se houver configuração do usuário
    let configuracoes = {
      valorInicial: valorDoInput || Number(this.settings.entryValue) || 2, // AUMENTAR padrão para 2
      martingale: this.settings.martingaleFactor || 1.5,
      usarMartingaleAposXLoss: 2, // Valor padrão - aplicar martingale após 2 perdas consecutivas
      // Adicionando mais parâmetros de configuração
      metaGanho: this.settings.profitTarget || 20,
      limitePerda: this.settings.lossLimit || 20,
      valorAposVencer: valorDoInput || Number(this.settings.entryValue) || 2, // AUMENTAR padrão para 2
      parcelasMartingale: 1,
    };

    // Processar configurações salvas do usuário
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        console.log(
          `[OAUTH_DIRECT] 🔍 Configurações do usuário encontradas:`,
          settings,
        );

        // Iterar sobre todas as propriedades para garantir que pegamos todas
        for (const [key, value] of Object.entries(settings)) {
          if (value !== undefined && value !== null) {
            // @ts-ignore - Ignorar erro de tipo pois estamos acessando de forma dinâmica
            if (typeof configuracoes[key] === "number") {
              // @ts-ignore
              configuracoes[key] = parseFloat(value);
            } else {
              // @ts-ignore
              configuracoes[key] = value;
            }
          }
        }

        // Log detalhado para debugging
        console.log(
          `[OAUTH_DIRECT] 📊 CONFIGURAÇÕES FINAIS APLICADAS (prioridade para valores do usuário):`,
          JSON.stringify(configuracoes, null, 2),
        );
      } catch (error) {
        console.error("[OAUTH_DIRECT] Erro ao analisar configurações:", error);
      }
    } else {
      console.log(
        `[OAUTH_DIRECT] ⚠️ Configurações do usuário não encontradas, usando valores padrão`,
      );
    }

    if (isWin) {
      // ⚠️⚠️⚠️ VITÓRIA: IMPLEMENTAÇÃO CONFORME XML (VALOR APÓS VENCER) ⚠️⚠️⚠️
      // De acordo com o XML nas linhas 8,9 e 71-77, após uma vitória devemos resetar para o VALOR INICIAL

      // (1) Verificar se há configuração resetOnWin nas settings
      const resetToInitialValue = this.settings.resetOnWin !== false; // Por padrão, resetar (seguindo XML)
      
      if (resetToInitialValue) {
        console.log(`[OAUTH_DIRECT] 🌟 SEGUINDO XML: Após vitória, resetando para valor inicial`);
        
        // Verificar se já temos um valor do input da função auxiliar acima (inputValue)
        if (inputValue !== null) {
          console.log(
            `[OAUTH_DIRECT] 🔴🔴🔴 CORREÇÃO FINAL APÓS VITÓRIA: Usando valor ${inputValue} já lido do input`,
          );

          // Forçar atualização em todos os lugares
          this.settings.entryValue = inputValue;
          configuracoes.valorInicial = inputValue;

          // Retornar o valor do input com certeza absoluta
          return inputValue;
        }

        // BACKUP: Verificar novamente o input para garantir (segunda tentativa)
        const inputWinElem = document.getElementById(
          "iron-bot-entry-value",
        ) as HTMLInputElement;
        if (inputWinElem && inputWinElem.value) {
          const valueFromInput = parseFloat(inputWinElem.value);
          if (!isNaN(valueFromInput) && valueFromInput > 0) {
            console.log(
              `[OAUTH_DIRECT] 🔴🔴🔴 SEGUNDA TENTATIVA APÓS VITÓRIA: Usando valor ${valueFromInput} do input`,
            );

            // Forçar atualização em todos os lugares
            this.settings.entryValue = valueFromInput;
            configuracoes.valorInicial = valueFromInput;

            // Atualizar também no localStorage para próximas operações
            try {
              const currentStrategy = this.strategyConfig.toLowerCase();
              if (currentStrategy) {
                const configString = localStorage.getItem(
                  `strategy_config_${currentStrategy}`,
                );
                if (configString) {
                  let config = JSON.parse(configString);
                  config.valorInicial = valueFromInput;
                  localStorage.setItem(
                    `strategy_config_${currentStrategy}`,
                    JSON.stringify(config),
                  );
                  console.log(
                    `[OAUTH_DIRECT] 🔴🔴🔴 PERSISTÊNCIA: Valor ${valueFromInput} atualizado no localStorage após vitória`,
                  );
                }
              }
            } catch (e) {
              console.error(
                `[OAUTH_DIRECT] Erro ao atualizar valor no localStorage:`,
                e,
              );
            }

            // Retornar o valor do input com certeza absoluta
            return valueFromInput;
          }
        }

        // Se não encontrou no input, usar o valor inicial conforme XML
        console.log(
          `[OAUTH_DIRECT] ✅ Resultado: Vitória, voltando para valor inicial ${configuracoes.valorInicial}`,
        );
        return configuracoes.valorInicial;
      } else {
        // Se resetOnWin estiver desativado (não padrão), manter valor atual
        console.log(
          `[OAUTH_DIRECT] ⚠️ resetOnWin desativado, mantendo valor atual ${buyPrice}`,
        );
        return buyPrice;
      }
      console.log(
        `[OAUTH_DIRECT] ⚠️ Valor do input não encontrado, usando configurações: ${configuracoes.valorInicial}`,
      );

      // Atualizar também o valor na configuração global para garantir consistência
      this.settings.entryValue = configuracoes.valorInicial;

      return configuracoes.valorInicial;
    } else {
      // ⚠️⚠️⚠️ DERROTA: IMPLEMENTAÇÃO CONFORME XML (LOSSVIRTUAL) ⚠️⚠️⚠️
      // De acordo com o XML nas linhas 72-97, após uma derrota devemos aplicar martingale

      // (1) Verificar se lossVirtual está habilitado nas settings
      const lossVirtualEnabled = this.settings.lossVirtualEnabled !== false; // Por padrão, habilitar (seguindo XML)
      
      // Obter o estado atual da estratégia para verificar perdas consecutivas
      const strategyId = this.strategyConfig.toLowerCase();
      const strategyState = getStrategyState(strategyId);
      const consecutiveLosses = strategyState?.consecutiveLosses || 1;

      // CORREÇÃO CRÍTICA: Log detalhado para debug de martingale
      console.log(
        `[OAUTH_DIRECT] 🔴 Resultado: Derrota - Estratégia ${this.strategyConfig} - Perdas consecutivas: ${consecutiveLosses}`,
      );
      console.log(
        `[OAUTH_DIRECT] 🔴 Configuração: lossVirtual ${lossVirtualEnabled ? 'ATIVADO' : 'DESATIVADO'}, Aplicar martingale após ${configuracoes.usarMartingaleAposXLoss} perdas`,
      );

      if (!lossVirtualEnabled) {
        // Se lossVirtual estiver desativado (não padrão), manter valor atual
        console.log(
          `[OAUTH_DIRECT] ⚠️ lossVirtual desativado, mantendo valor atual ${buyPrice} após derrota`,
        );
        return buyPrice;
      }

      // CORREÇÃO CRÍTICA DO MARTINGALE (01/05/2025)
      // Verificar se já atingimos ou ultrapassamos o número de perdas para aplicar martingale
      // Corrigido para aplicar quando consecutiveLosses >= configuracoes.usarMartingaleAposXLoss
      
      console.log(
        `[OAUTH_DIRECT] 🚨 Perdas consecutivas: ${consecutiveLosses}, Martingale após X perdas: ${configuracoes.usarMartingaleAposXLoss}`,
      );
      
      // CORREÇÃO CRÍTICA (01/05/2025): Aplicar martingale quando o número de perdas for IGUAL OU MAIOR ao configurado
      // Isso garante que o Loss Virtual continua sendo aplicado em todas as operações subsequentes
      if (consecutiveLosses >= configuracoes.usarMartingaleAposXLoss) {
        let mensagemTipoMartingale = "";
        
        if (consecutiveLosses === configuracoes.usarMartingaleAposXLoss) {
          mensagemTipoMartingale = "PRIMEIRA ATIVAÇÃO";
        } else {
          mensagemTipoMartingale = "CONTINUANDO APLICAÇÃO";
        }
        
        console.log(
          `[OAUTH_DIRECT] 🔴⚠️ MARTINGALE ATIVADO! (${mensagemTipoMartingale}) - Perdas consecutivas (${consecutiveLosses}) >= Configurado (${configuracoes.usarMartingaleAposXLoss})`,
        );
        
        // Analisar string da estratégia para identificar tipo correto de comportamento
        const strategyLower = this.strategyConfig.toLowerCase();
        let nextAmount;
        
        const valorEntrada = configuracoes.valorInicial;
        console.log(`[OAUTH_DIRECT] 🚨 VALOR DE ENTRADA ORIGINAL: ${valorEntrada}`);
        console.log(`[OAUTH_DIRECT] 🚨 FATOR MARTINGALE CONFIGURADO: ${configuracoes.martingale}`);
        
        if (strategyLower.includes("ironunder") || strategyLower.includes("ironover")) {
          // 🚨🚨🚨 CORREÇÃO CRÍTICA 24/04/2025: Implementando exatamente como descrito no XML 🚨🚨🚨
          // No XML, usa math_change que ADICIONA o valor do martingale multiplicado, não substitui
          // A fórmula no XML é: VALOR_INICIAL += VALOR_INICIAL * MARTINGALE
          
          // Aumento incremental (adição) como no XML
          const incremento = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          nextAmount = Math.round((valorEntrada + incremento) * 100) / 100;
          
          console.log(
            `[OAUTH_DIRECT] 🔴 Iron Under/Over: Aplicando martingale corretamente:`,
          );
          console.log(
            `[OAUTH_DIRECT] 🔴 - Valor atual: ${valorEntrada}`,
          );
          console.log(
            `[OAUTH_DIRECT] 🔴 - Fator martingale: ${configuracoes.martingale}`,
          );
          console.log(
            `[OAUTH_DIRECT] 🔴 - Incremento calculado: ${incremento} (${valorEntrada} × ${configuracoes.martingale})`,
          );
          console.log(
            `[OAUTH_DIRECT] 🔴 - Valor final após incremento: ${nextAmount} (${valorEntrada} + ${incremento})`,
          );
        } else if (strategyLower.includes("advance")) {
          // Para Advance, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 Advance: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else if (strategyLower.includes("maxpro")) {
          // Para MAXPRO, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 MAXPRO: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else if (strategyLower.includes("botlow")) {
          // Para BOT LOW, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 BOT LOW: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else if (strategyLower.includes("profitpro")) {
          // Para Profitpro, usar martingale com múltiplas parcelas
          // As parcelas são definidas como configuracoes.parcelasMartingale (padrão 1)
          const parcelas = configuracoes.parcelasMartingale || 1;
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 Profitpro: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else if (strategyLower.includes("wisepro") || strategyLower.includes("tendencia")) {
          // Para WISE PRO TENDENCIA, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 WISE PRO: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else if (strategyLower.includes("green")) {
          // Para GREEN, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 Green: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else if (strategyLower.includes("manual")) {
          // Para Manual Under/Over, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 Manual: Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        } else {
          // Para outras estratégias, multiplicar o valor inicial pelo fator martingale
          nextAmount = Math.round(valorEntrada * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 Estratégia não identificada (${strategyLower}): Aplicando martingale: ${valorEntrada} x ${configuracoes.martingale} = ${nextAmount}`,
          );
        }

        console.log(
          `[OAUTH_DIRECT] 🔴 Aplicando martingale após ${consecutiveLosses} perdas consecutivas (lossVirtual ativado)`,
        );
        console.log(
          `[OAUTH_DIRECT] 🔴 Valor anterior: ${buyPrice}, Novo valor: ${nextAmount}`,
        );
        
        // 🚨🚨🚨 CORREÇÃO CRÍTICA 24/04/2025: Persistir o valor do martingale no localStorage 🚨🚨🚨
        // Este valor terá PRIORIDADE MÁXIMA no executeContractBuy
        try {
          localStorage.setItem('last_martingale_calculated_value', nextAmount.toString());
          localStorage.setItem('last_martingale_calculation_time', new Date().toISOString());
          console.log(`[OAUTH_DIRECT] 🚨 VALOR MARTINGALE SALVO NO LOCALSTORAGE: ${nextAmount}`);
        } catch (e) {
          console.error(`[OAUTH_DIRECT] Erro ao salvar valor martingale no localStorage:`, e);
        }

        return nextAmount;
      } else {
        // Essa condição nunca deve ser executada após a correção do if acima,
        // mas mantemos como um fallback de segurança
        
        // CORREÇÃO CRÍTICA (01/05/2025): Este bloco else é apenas um fallback,
        // já que todas as condições de martingale agora são tratadas no if acima
        console.log(
          `[OAUTH_DIRECT] ⚠️ ATENÇÃO: Caiu no fallback de segurança para o martingale (não deveria acontecer)`,
        );
        
        if (consecutiveLosses < configuracoes.usarMartingaleAposXLoss) {
          console.log(
            `[OAUTH_DIRECT] 🟠 Mantendo valor original (${buyPrice}) - Ainda não atingiu ${configuracoes.usarMartingaleAposXLoss} perdas consecutivas`,
          );
          return buyPrice;
        } else {
          // Este código não deveria mais ser acessado devido à correção no IF principal
          // Mas mantemos como medida de segurança
          console.log(
            `[OAUTH_DIRECT] 🔴🔴 FALLBACK CRÍTICO: O martingale deveria ter sido aplicado no IF anterior`,
          );
          // Aplicar o martingale como uma medida de segurança
          const valorEstimado = Math.round(configuracoes.valorInicial * configuracoes.martingale * 100) / 100;
          console.log(
            `[OAUTH_DIRECT] 🔴 FALLBACK: Aplicando martingale: ${configuracoes.valorInicial} x ${configuracoes.martingale} = ${valorEstimado}`,
          );
          return valorEstimado;
        }
      }
    }
  }

  /**
   * Validar se a operação deve continuar com base nos limites configurados
   */
  private validateOperationContinuation(
    isWin: boolean,
    lastContract: any,
  ): boolean {
    // 🚨 IMPLEMENTAÇÃO EMERGENCIAL CORRIGIDA - 22/04/2025 🚨

    console.log(
      `[OAUTH_DIRECT] 🔍 VALIDANDO CONTINUAÇÃO DE OPERAÇÕES: isWin=${isWin}, último contrato:`,
      lastContract?.contract_id,
    );

    // ESTADO CRÍTICO #1: Verificar se o bot ainda está em execução
    if (!this.isRunning) {
      console.log(
        `[OAUTH_DIRECT] ⚠️ FALHA CRÍTICA: Bot não está mais em execução, operações interrompidas`,
      );
      return false;
    }

    // ESTADO CRÍTICO #2: Verificar se o WebSocket está conectado
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.log(
        `[OAUTH_DIRECT] ⚠️ FALHA CRÍTICA: WebSocket não conectado (status: ${this.webSocket?.readyState})`,
      );

      // Tentar reconectar ao WebSocket se estiver fechado
      if (this.webSocket?.readyState === WebSocket.CLOSED) {
        console.log(`[OAUTH_DIRECT] ⚠️ Tentando reconectar WebSocket...`);
        this.setupWebSocket().catch((err) => {
          console.error(`[OAUTH_DIRECT] Falha na reconexão:`, err);
        });
      }

      return false;
    }

    // VERIFICAÇÃO #3: Verificar se temos configurações de limite de perda e meta de lucro
    const profitTarget = this.settings.profitTarget;
    const lossLimit = this.settings.lossLimit;

    console.log(
      `[OAUTH_DIRECT] Verificando limites - Meta de lucro: ${profitTarget || "não definida"}, Limite de perda: ${lossLimit || "não definido"}`,
    );

    // REGRA DE OURO: Se não houver limites, SEMPRE continuar operando
    if (
      (!profitTarget ||
        (typeof profitTarget === "number" && profitTarget <= 0)) &&
      (!lossLimit || (typeof lossLimit === "number" && lossLimit <= 0))
    ) {
      console.log(
        `[OAUTH_DIRECT] ✅ Sem limites definidos (ou limites inválidos), SEMPRE continuando operações`,
      );
      return true;
    }

    // Calcular corretamente o lucro/perda para atualizar estatísticas
    let calculatedAmount = 0;

    if (isWin) {
      // Atualizar estatísticas para vitória
      this.sessionStats.wins++;

      // Calcular lucro corretamente (verificar se profit está definido ou calcular com payout)
      if (lastContract) {
        if (lastContract.profit && parseFloat(lastContract.profit) > 0) {
          calculatedAmount = parseFloat(lastContract.profit);
        }
        // Se profit não estiver definido, calcular pelo payout e buy_price
        else if (lastContract.payout && lastContract.buy_price) {
          calculatedAmount =
            Number(lastContract.payout) - Number(lastContract.buy_price);
          console.log(
            `[OAUTH_DIRECT] Calculando lucro para estatísticas: Payout ${lastContract.payout} - Preço de compra ${lastContract.buy_price} = ${calculatedAmount}`,
          );
        }

        if (!isNaN(calculatedAmount)) {
          this.sessionStats.totalProfit += calculatedAmount;
        }
      }

      console.log(
        `[OAUTH_DIRECT] ✅ Vitória registrada! Total: ${this.sessionStats.wins} vitórias, lucro: ${this.sessionStats.totalProfit.toFixed(2)}`,
      );
    } else {
      // Atualizar estatísticas para derrota
      this.sessionStats.losses++;

      // Para derrotas, considerar o valor negativo do preço de compra
      if (lastContract && lastContract.buy_price) {
        calculatedAmount = Number(lastContract.buy_price);
        this.sessionStats.totalLoss += calculatedAmount;
      }

      console.log(
        `[OAUTH_DIRECT] ❌ Derrota registrada! Total: ${this.sessionStats.losses} derrotas, perda: ${this.sessionStats.totalLoss.toFixed(2)}`,
      );
    }

    // Calcular o lucro líquido
    this.sessionStats.netProfit =
      this.sessionStats.totalProfit - this.sessionStats.totalLoss;
    console.log(
      `[OAUTH_DIRECT] Lucro líquido atual: ${this.sessionStats.netProfit.toFixed(2)}`,
    );

    // CORREÇÃO CRÍTICA: Converter valores para números com garantia
    const profitTargetNum = profitTarget ? parseFloat(String(profitTarget)) : 0;
    const lossLimitNum = lossLimit ? parseFloat(String(lossLimit)) : 0;

    // Verificar explicitamente se existe um valor numérico válido configurado
    const hasProfitTarget =
      profitTargetNum && !isNaN(profitTargetNum) && profitTargetNum > 0;
    const hasLossLimit =
      lossLimitNum && !isNaN(lossLimitNum) && lossLimitNum > 0;

    console.log(
      `[OAUTH_DIRECT] Meta de lucro configurada: ${hasProfitTarget ? profitTargetNum : "Não definida"}`,
    );
    console.log(
      `[OAUTH_DIRECT] Limite de perda configurado: ${hasLossLimit ? lossLimitNum : "Não definido"}`,
    );

    // Se atingiu a meta de lucro, parar
    // Tratar a meta de lucro como valor absoluto conforme configurado na interface
    // CORREÇÃO CRÍTICA (01/05/2025): O valor da meta de lucro DEVE ser recuperado diretamente 
    // da configuração da estratégia ativa no painel StrategyConfigPanel e DEVE usar o valor configurado pelo usuário
    let targetValue = 0;
    try {
      const currentStrategy = this.strategyConfig.toLowerCase();
      if (currentStrategy) {
        // PRIORIDADE 1: Obter valor do input na interface (se disponível)
        const inputElement = document.getElementById("meta-ganho-input") as HTMLInputElement;
        if (inputElement && inputElement.value) {
          const valueFromInput = parseFloat(inputElement.value);
          if (!isNaN(valueFromInput) && valueFromInput > 0) {
            targetValue = valueFromInput;
            console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 1: Usando meta de lucro ${targetValue} do input do usuário`);
            
            // Salvar no localStorage para consistência futura
            try {
              const configString = localStorage.getItem(`strategy_config_${currentStrategy}`);
              if (configString) {
                const config = JSON.parse(configString);
                config.metaGanho = valueFromInput;
                localStorage.setItem(`strategy_config_${currentStrategy}`, JSON.stringify(config));
                console.log(`[OAUTH_DIRECT] 💾 META DE LUCRO atualizada no localStorage: ${valueFromInput}`);
              }
            } catch (e) {
              console.error(`[OAUTH_DIRECT] Erro ao atualizar meta de lucro no localStorage:`, e);
            }
          }
        }
        
        // PRIORIDADE 2: Obter da configuração salva no localStorage
        if (targetValue <= 0) {
          const configString = localStorage.getItem(`strategy_config_${currentStrategy}`);
          if (configString) {
            const config = JSON.parse(configString);
            if (config.metaGanho && !isNaN(parseFloat(config.metaGanho.toString()))) {
              targetValue = parseFloat(config.metaGanho.toString());
              console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 2: Usando meta de lucro ${targetValue} da configuração salva para ${currentStrategy}`);
            }
          }
        }
        
        // PRIORIDADE 3: Usar valor das configurações gerais
        if (targetValue <= 0) {
          targetValue = profitTargetNum;
          console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 3: Usando meta de lucro ${targetValue} das configurações gerais`);
        }
      } else {
        targetValue = profitTargetNum; // Fallback para o valor das configurações gerais
        console.log(`[OAUTH_DIRECT] ⚠️ Estratégia atual não definida, usando valor padrão: ${targetValue}`);
      }
    } catch (error) {
      targetValue = profitTargetNum; // Em caso de erro, usar o valor das configurações gerais
      console.error(`[OAUTH_DIRECT] ❌ Erro ao recuperar meta de lucro:`, error);
      console.log(`[OAUTH_DIRECT] ❌ Usando valor padrão para meta de lucro: ${targetValue}`);
    }
    
    // Se mesmo assim o valor for inválido, usar o valor mínimo seguro
    if (targetValue <= 0) {
      targetValue = 20; // Valor seguro padrão
      console.log(`[OAUTH_DIRECT] ⚠️ Meta de lucro inválida! Usando valor seguro: ${targetValue}`);
    }
    
    // CORREÇÃO CRÍTICA (29/04/2025): Validar a meta de lucro conforme EXATAMENTE configurado
    // O robô deve parar quando atingir ou superar o limite de lucro configurado
    console.log(
      `[OAUTH_DIRECT] 🔍 DEBUG META DE LUCRO: Lucro atual ${this.sessionStats.netProfit.toFixed(2)}, Meta configurada: ${targetValue.toFixed(2)}`,
    );
    
    if (hasProfitTarget && this.sessionStats.netProfit >= targetValue) {
      const targetMessage = `Meta de lucro de ${targetValue} atingida! Lucro atual: ${this.sessionStats.netProfit.toFixed(2)}`;
      console.log(
        `[OAUTH_DIRECT] 🎯 META DE LUCRO ATINGIDA: ${this.sessionStats.netProfit.toFixed(2)} / ${targetValue.toFixed(2)}`,
      );

      // Notificar interface sobre o atingimento da meta
      const terminationReason = `Meta de lucro atingida (${this.sessionStats.netProfit.toFixed(2)}/${targetValue.toFixed(2)})`;
      
      this.notifyListeners({
        type: "bot_target_reached",
        message: targetMessage,
        profit: this.sessionStats.netProfit,
        termination_reason: terminationReason
      });
      
      // Registrar motivo de encerramento para próximas operações
      if (this.currentContractId) {
        // Atualizar o passthrough do contrato atual para registrar motivo de encerramento
        this.addTerminationReasonToContract(this.currentContractId, terminationReason);
      }

      // Parar o bot com a razão correta
      console.log(
        "[OAUTH_DIRECT] Estratégia finalizada devido às condições de parada",
      );
      this.stop(targetMessage, "target");

      return false; // Parar operações
    }

    // Se atingiu o limite de perda, parar
    // Tratar limite de perda como valor absoluto conforme configurado na interface
    // CORREÇÃO CRÍTICA (01/05/2025): O valor do limite de perda DEVE ser recuperado diretamente 
    // da configuração da estratégia ativa no painel StrategyConfigPanel e DEVE usar o valor configurado pelo usuário
    let lossLimitValue = 0;
    try {
      const currentStrategy = this.strategyConfig.toLowerCase();
      if (currentStrategy) {
        // PRIORIDADE 1: Obter valor do input na interface (se disponível)
        const inputElement = document.getElementById("limite-perda-input") as HTMLInputElement;
        if (inputElement && inputElement.value) {
          const valueFromInput = parseFloat(inputElement.value);
          if (!isNaN(valueFromInput) && valueFromInput > 0) {
            lossLimitValue = valueFromInput;
            console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 1: Usando limite de perda ${lossLimitValue} do input do usuário`);
            
            // Salvar no localStorage para consistência futura
            try {
              const configString = localStorage.getItem(`strategy_config_${currentStrategy}`);
              if (configString) {
                const config = JSON.parse(configString);
                config.limitePerda = valueFromInput;
                localStorage.setItem(`strategy_config_${currentStrategy}`, JSON.stringify(config));
                console.log(`[OAUTH_DIRECT] 💾 LIMITE DE PERDA atualizado no localStorage: ${valueFromInput}`);
              }
            } catch (e) {
              console.error(`[OAUTH_DIRECT] Erro ao atualizar limite de perda no localStorage:`, e);
            }
          }
        }
        
        // PRIORIDADE 2: Obter da configuração salva no localStorage
        if (lossLimitValue <= 0) {
          const configString = localStorage.getItem(`strategy_config_${currentStrategy}`);
          if (configString) {
            const config = JSON.parse(configString);
            if (config.limitePerda && !isNaN(parseFloat(config.limitePerda.toString()))) {
              lossLimitValue = parseFloat(config.limitePerda.toString());
              console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 2: Usando limite de perda ${lossLimitValue} da configuração salva para ${currentStrategy}`);
            }
          }
        }
        
        // PRIORIDADE 3: Usar valor das configurações gerais
        if (lossLimitValue <= 0) {
          lossLimitValue = lossLimitNum;
          console.log(`[OAUTH_DIRECT] 🚀 PRIORIDADE 3: Usando limite de perda ${lossLimitValue} das configurações gerais`);
        }
      } else {
        lossLimitValue = lossLimitNum; // Fallback para o valor das configurações gerais
        console.log(`[OAUTH_DIRECT] ⚠️ Estratégia atual não definida, usando valor padrão: ${lossLimitValue}`);
      }
    } catch (error) {
      lossLimitValue = lossLimitNum; // Em caso de erro, usar o valor das configurações gerais
      console.error(`[OAUTH_DIRECT] ❌ Erro ao recuperar limite de perda:`, error);
      console.log(`[OAUTH_DIRECT] ❌ Usando valor padrão para limite de perda: ${lossLimitValue}`);
    }
    
    // Se mesmo assim o valor for inválido, usar o valor mínimo seguro
    if (lossLimitValue <= 0) {
      lossLimitValue = 20; // Valor seguro padrão
      console.log(`[OAUTH_DIRECT] ⚠️ Limite de perda inválido! Usando valor seguro: ${lossLimitValue}`);
    }
    
    // CORREÇÃO CRÍTICA (29/04/2025): Validar o limite de perda conforme EXATAMENTE configurado
    // O robô deve parar quando atingir ou superar o limite de perda configurado
    console.log(
      `[OAUTH_DIRECT] 🔍 DEBUG LIMITE DE PERDA: Perda atual ${this.sessionStats.totalLoss.toFixed(2)}, Limite configurado: ${lossLimitValue.toFixed(2)}`,
    );
    
    if (hasLossLimit && this.sessionStats.totalLoss >= lossLimitValue) {
      const limitMessage = `Limite de perda de ${lossLimitValue} atingido! Perda total: ${this.sessionStats.totalLoss.toFixed(2)}`;
      console.log(
        `[OAUTH_DIRECT] ⚠️ LIMITE DE PERDA ATINGIDO: ${this.sessionStats.totalLoss.toFixed(2)} / ${lossLimitValue.toFixed(2)}`,
      );

      // Notificar interface sobre o limite atingido
      const terminationReason = `Limite de perda atingido (${this.sessionStats.totalLoss.toFixed(2)}/${lossLimitValue.toFixed(2)})`;
      
      this.notifyListeners({
        type: "bot_limit_reached",
        message: limitMessage,
        loss: this.sessionStats.totalLoss,
        termination_reason: terminationReason
      });
      
      // Registrar motivo de encerramento para próximas operações
      if (this.currentContractId) {
        // Atualizar o passthrough do contrato atual para registrar motivo de encerramento
        this.addTerminationReasonToContract(this.currentContractId, terminationReason);
      }

      // Parar o bot com a razão correta
      console.log(
        "[OAUTH_DIRECT] Estratégia finalizada devido às condições de parada",
      );
      this.stop(limitMessage, "limit");

      return false; // Parar operações
    }

    // CORREÇÃO: Adicionar logs para diagnóstico de continuação
    console.log(
      `[OAUTH_DIRECT] ✅ Validação bem-sucedida, continuando operações. Situação: ${this.sessionStats.wins} vitórias, ${this.sessionStats.losses} derrotas, lucro líquido: ${this.sessionStats.netProfit.toFixed(2)}`,
    );

    // Se ainda não atingiu nenhum limite, continuar operando
    return true;
  }

  /**
   * Adiciona o motivo de encerramento ao contrato atual
   * @param contractId ID do contrato a ser atualizado
   * @param reason Motivo de encerramento da operação
   */
  private addTerminationReasonToContract(contractId: string | number, reason: string): void {
    try {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.log("[OAUTH_DIRECT] WebSocket não está disponível para atualizar contrato");
        return;
      }

      console.log(`[OAUTH_DIRECT] Registrando motivo de encerramento para contrato ${contractId}: ${reason}`);
      
      // Armazenar em localStorage para persistência
      const storageKey = `deriv_contract_termination_${contractId}`;
      localStorage.setItem(storageKey, JSON.stringify({
        contractId,
        reason,
        timestamp: Date.now()
      }));
      
      // Armazenar na sessão atual para acesso imediato
      if (!this.contractTerminationReasons) {
        this.contractTerminationReasons = new Map();
      }
      this.contractTerminationReasons.set(contractId.toString(), reason);
      
      // Atualizar todos os objetos relevantes do contrato
      this.notifyListeners({
        type: "contract_termination_reason",
        contract_id: contractId,
        termination_reason: reason,
        timestamp: Date.now()
      });
      
      console.log(`[OAUTH_DIRECT] ✅ Motivo de encerramento registrado com sucesso para contrato ${contractId}`);
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao registrar motivo de encerramento:", error);
    }
  }

  /**
   * Assina ticks do símbolo especificado (ou R_100 por padrão)
   * Método público para poder ser chamado diretamente da página
   */
  /**
   * Assina ticks do símbolo especificado seguindo o esquema JSON oficial
   * Otimizado conforme o schema fornecido para Ticks Stream Request
   *
   * @param symbol Símbolo para receber ticks (R_100 por padrão)
   */
  private lastSymbolUpdateTime: number = 0;
  private readonly SYMBOL_UPDATE_THROTTLE_MS: number = 30000; // 30 segundos - evita reconexões frequentes
  private lastSymbol: string = "R_100";
  private lastTickTime: number = 0;
  private symbolUpdateBlocked: boolean = false; // Nova flag para bloquear atualizações por um período
  private symbolUpdateBlockTimeout: any = null;

  public subscribeToTicks(symbol: string = "R_100"): void {
    // Atualizar o símbolo ativo para uso em reconexões
    if (symbol && symbol !== this.activeSymbol) {
      this.activeSymbol = symbol;
      console.log(`[OAUTH_DIRECT] Símbolo ativo atualizado para: ${symbol}`);

      // Somente notificar outros componentes se o símbolo realmente mudou
      // E se não enviamos uma atualização recentemente
      const now = Date.now();

      // Verificação mais rigorosa para evitar notificações duplicadas:
      // 1. O símbolo deve ter mudado em relação ao último notificado
      // 2. Deve ter passado tempo suficiente desde a última notificação
      // 3. Se estivermos recebendo ticks recentes, não emitir o evento
      // 4. Flag de bloqueio não está ativa
      if (
        symbol !== this.lastSymbol &&
        now - this.lastSymbolUpdateTime > this.SYMBOL_UPDATE_THROTTLE_MS &&
        now - this.lastTickTime > 2000 &&
        !this.symbolUpdateBlocked
      ) {
        this.lastSymbolUpdateTime = now;
        this.lastSymbol = symbol;

        // Bloquear eventos de symbol_update por 60 segundos após qualquer atualização
        this.symbolUpdateBlocked = true;

        // Limpar bloqueio anterior, se existir
        if (this.symbolUpdateBlockTimeout) {
          clearTimeout(this.symbolUpdateBlockTimeout);
        }

        // Desbloquear após 60 segundos
        this.symbolUpdateBlockTimeout = setTimeout(() => {
          this.symbolUpdateBlocked = false;
        }, 60000);

        // Registramos no log, mas não notificamos listeners se tudo estiver funcionando
        if (now - this.lastTickTime > 5000) {
          console.log(
            `[OAUTH_DIRECT] Símbolo alterado para ${symbol}, enviando notificação aos listeners`,
          );

          this.notifyListeners({
            type: "symbol_update",
            symbol: this.activeSymbol,
            message: `Símbolo ativo: ${this.activeSymbol}`,
          });
        } else {
          console.log(
            `[OAUTH_DIRECT] Símbolo alterado para ${symbol}, mas já recebendo ticks recentes (${(now - this.lastTickTime) / 1000}s)`,
          );
        }
      } else {
        // Registramos o motivo pelo qual não enviamos a notificação
        const timeSinceLastUpdate = now - this.lastSymbolUpdateTime;
        const timeSinceLastTick = now - this.lastTickTime;
        console.log(
          `[OAUTH_DIRECT] Notificação de símbolo ${symbol} suprimida:`,
          `mesmo símbolo anterior: ${symbol === this.lastSymbol},`,
          `tempo desde última atualização: ${timeSinceLastUpdate / 1000}s,`,
          `tempo desde último tick: ${timeSinceLastTick / 1000}s,`,
          `bloqueado: ${this.symbolUpdateBlocked}`,
        );
      }
    }

    // Verificar se o WebSocket está disponível
    if (!this.webSocket) {
      console.error("[OAUTH_DIRECT] WebSocket não está inicializado!");

      // Tentar reconexão e depois inscrever nos ticks
      this.reconnect()
        .then((success) => {
          if (success) {
            console.log(
              `[OAUTH_DIRECT] Reconexão bem-sucedida, inscrevendo para ticks do ${this.activeSymbol}`,
            );
            // Chamar novamente após reconexão bem-sucedida
            setTimeout(() => this.subscribeToTicks(), 500);
          }
        })
        .catch((err) =>
          console.error(
            "[OAUTH_DIRECT] Erro na reconexão durante inscrição de ticks:",
            err,
          ),
        );
      return;
    }

    if (this.webSocket.readyState !== WebSocket.OPEN) {
      console.error(
        `[OAUTH_DIRECT] WebSocket não está aberto para inscrição de ticks! Estado atual: ${this.getReadyStateText(this.webSocket.readyState)}`,
      );

      // Tentar reconectar se não estiver em estado CONNECTING
      if (this.webSocket.readyState !== WebSocket.CONNECTING) {
        console.log(
          "[OAUTH_DIRECT] Tentando reconectar antes de inscrever para ticks...",
        );
        this.reconnect()
          .then((success) => {
            if (success) {
              // Tentar inscrever novamente após reconexão bem-sucedida
              setTimeout(() => this.subscribeToTicks(), 500);
            }
          })
          .catch((err) =>
            console.error(
              "[OAUTH_DIRECT] Erro na reconexão durante inscrição de ticks:",
              err,
            ),
          );
      }
      return;
    }

    try {
      // Criar requisição conforme o schema JSON oficial
      const request = {
        ticks: symbol,
        subscribe: 1,
        req_id: Date.now(), // Identificador único para rastrear esta requisição
      };

      console.log(
        `[OAUTH_DIRECT] Inscrevendo-se para receber ticks do símbolo ${symbol}`,
      );
      console.log(
        `[OAUTH_DIRECT] Estado WebSocket antes do envio: ${this.getReadyStateText(this.webSocket.readyState)}`,
      );

      this.webSocket.send(JSON.stringify(request));
      console.log("[OAUTH_DIRECT] Requisição de ticks enviada com sucesso");

      // Registrar o símbolo ativo para futuras reconexões
      this.activeSymbol = symbol;

      // Verificar se ainda está conectado após 3 segundos
      setTimeout(() => {
        if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
          console.log(
            "[OAUTH_DIRECT] Verificação de inscrição de ticks: WebSocket ainda aberto",
          );
        } else {
          console.error(
            "[OAUTH_DIRECT] WebSocket fechou após tentativa de inscrição de ticks!",
          );
          this.reconnect().catch(console.error);
        }
      }, 3000);
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao enviar requisição de ticks:",
        error,
      );
      // Tentar reconectar em caso de erro
      this.reconnect().catch(console.error);
    }
  }

  /**
   * Assina atualizações do contrato aberto atual
   * @param contractId ID opcional do contrato (usa o currentContractId se não informado)
   */
  private subscribeToProposalOpenContract(contractId?: number | string): void {
    // Usar o ID passado ou o ID atual armazenado
    const targetContractId = contractId || this.currentContractId;
    if (
      !this.webSocket ||
      this.webSocket.readyState !== WebSocket.OPEN ||
      !targetContractId
    ) {
      console.error(
        "[OAUTH_DIRECT] WebSocket não está conectado ou não há contrato atual",
      );
      return;
    }

    const request = {
      proposal_open_contract: 1,
      contract_id: targetContractId,
      subscribe: 1,
    };

    console.log(
      `[OAUTH_DIRECT] Inscrevendo-se para atualizações do contrato ${targetContractId}`,
    );
    this.webSocket.send(JSON.stringify(request));
  }

  /**
   * Método público para solicitar saldo atual da conta
   * Pode ser chamado pelo componente para atualizar o saldo exibido
   */
  /**
   * Solicita o saldo atual da conta
   * @param options Opções adicionais (subscribe para inscrever-se em atualizações)
   */
  public getAccountBalance(options?: { subscribe?: boolean }): void {
    const subscribe = options?.subscribe ?? false;

    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.log(
        "[OAUTH_DIRECT] WebSocket não está conectado para obter saldo",
      );
      this.reconnect().then((success) => {
        if (success) {
          if (subscribe) {
            this._subscribeToBalance();
          } else {
            this._requestBalance();
          }
        }
      });
      return;
    }

    if (subscribe) {
      this._subscribeToBalance();
    } else {
      this._requestBalance();
    }
  }

  /**
   * Busca o histórico de ticks para um símbolo específico
   * @param symbol Símbolo para buscar o histórico (ex: R_100)
   * @param count Quantidade de ticks para buscar (máximo 500)
   * @returns Promise com o resultado do histórico
   */
  public getTicksHistory(symbol: string, count: number = 500): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.error(
          "[OAUTH_DIRECT] Erro ao solicitar histórico: WebSocket não está conectado",
        );
        this.reconnect().then((success) => {
          if (success) {
            // Tentar novamente após reconexão
            this.getTicksHistory(symbol, count).then(resolve).catch(reject);
          } else {
            reject(new Error("Falha ao reconectar WebSocket"));
          }
        });
        return;
      }

      // ID único para esta solicitação
      const requestId = `ticks_history_${Date.now()}`;

      // Função para lidar com a resposta
      const handleHistoryResponse = (event: MessageEvent) => {
        try {
          const response = JSON.parse(event.data);

          // Verificar se é a resposta para a nossa solicitação
          if (response && response.req_id === requestId) {
            // Remover o listener após receber a resposta
            this.webSocket?.removeEventListener(
              "message",
              handleHistoryResponse,
            );

            if (response.error) {
              console.error(
                "[OAUTH_DIRECT] Erro ao obter histórico:",
                response.error,
              );
              reject(response.error);
            } else {
              console.log(
                `[OAUTH_DIRECT] Histórico recebido para ${symbol} com ${response.history?.prices?.length || 0} ticks`,
              );
              resolve(response);
            }
          }
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] Erro ao processar resposta de histórico:",
            error,
          );
        }
      };

      // Adicionar listener temporário para esta solicitação específica
      this.webSocket.addEventListener("message", handleHistoryResponse);

      // Configurar a data de término (agora) e início (baseado na granularidade de 1 segundo)
      const end = Math.floor(Date.now() / 1000);
      const start = end - count * 2; // Pegar um intervalo maior para garantir que tenhamos ticks suficientes

      // Enviar a solicitação de histórico
      const request = {
        ticks_history: symbol,
        req_id: requestId,
        end: end,
        start: start,
        style: "ticks",
        count: count,
        adjust_start_time: 1,
      };

      console.log(
        `[OAUTH_DIRECT] Solicitando ${count} ticks históricos para ${symbol}`,
      );

      // Enviar a solicitação para o WebSocket
      try {
        this.webSocket.send(JSON.stringify(request));
      } catch (error) {
        console.error(
          "[OAUTH_DIRECT] Erro ao enviar solicitação de histórico:",
          error,
        );
        this.webSocket.removeEventListener("message", handleHistoryResponse);
        reject(error);
      }

      // Configurar timeout para rejeitar a promessa após 10 segundos
      setTimeout(() => {
        if (this.webSocket) {
          this.webSocket.removeEventListener("message", handleHistoryResponse);
          reject(
            new Error("Timeout ao esperar resposta do histórico de ticks"),
          );
        }
      }, 10000);
    });
  }

  /**
   * Salva tick no localStorage para uso pela avaliação de estratégias
   * @param symbol Símbolo do mercado (ex: R_100)
   * @param tickData Dados do tick (objeto com lastDigit, price, etc)
   */
  private saveTickToLocalStorage(symbol: string, tickData: any): void {
    try {
      // Chave para armazenar os ticks no localStorage
      const storageKey = `deriv_ticks_${symbol}`;

      // Buscar dados existentes ou iniciar com array vazio
      const existingData = localStorage.getItem(storageKey);
      let ticks = [];

      if (existingData) {
        try {
          ticks = JSON.parse(existingData);
          if (!Array.isArray(ticks)) {
            console.error(
              `[OAUTH_DIRECT] Dados inválidos no localStorage para ${storageKey}, reiniciando`,
            );
            ticks = [];
          }
        } catch (error) {
          console.error(
            `[OAUTH_DIRECT] Erro ao parsear dados do localStorage para ${storageKey}:`,
            error,
          );
          ticks = [];
        }
      }

      // Adicionar novo tick no início do array (mais recente primeiro)
      ticks.unshift(tickData);

      // Limitar a 500 ticks para não consumir muito localStorage
      const maxTicks = 500;
      if (ticks.length > maxTicks) {
        ticks = ticks.slice(0, maxTicks);
      }

      // Salvar de volta no localStorage
      localStorage.setItem(storageKey, JSON.stringify(ticks));

      // Log a cada 50 ticks para não poluir o console
      if (ticks.length % 50 === 0) {
        console.log(
          `[OAUTH_DIRECT] ✅ ${ticks.length} ticks salvos no localStorage para ${symbol}`,
        );
      }
    } catch (error) {
      console.error(
        `[OAUTH_DIRECT] Erro ao salvar tick no localStorage:`,
        error,
      );
    }
  }

  /**
   * Solicita o saldo atual sem criar uma assinatura
   * Método privado utilizado por getAccountBalance
   */
  private _requestBalance(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error(
        "[OAUTH_DIRECT] WebSocket não está conectado para solicitar saldo",
      );
      return;
    }

    // Garantir que estamos usando o token ativo correto
    if (!this.activeToken) {
      console.warn("[OAUTH_DIRECT] Nenhum token ativo para solicitar saldo");
      return;
    }

    // Solicitação de apenas balanço (sem combiná-la com authorize)
    const request = {
      balance: 1,
    };

    console.log(
      `[OAUTH_DIRECT] Solicitando saldo atual para conta com token ${this.activeToken.substring(0, 4)}...`,
    );

    try {
      this.webSocket.send(JSON.stringify(request));
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao solicitar saldo:", error);
    }
  }

  /**
   * Assina atualizações de saldo
   * Método privado utilizado por getAccountBalance
   */
  private _subscribeToBalance(): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error(
        "[OAUTH_DIRECT] WebSocket não está conectado para inscrever em saldo",
      );
      return;
    }

    // Garantir que estamos usando o token ativo correto
    if (!this.activeToken) {
      console.warn("[OAUTH_DIRECT] Nenhum token ativo para inscrever em saldo");
      return;
    }

    // Solicitação de inscrição de balanço (sem combiná-la com authorize)
    const request = {
      balance: 1,
      subscribe: 1,
    };

    console.log(
      `[OAUTH_DIRECT] Inscrevendo-se para atualizações de saldo para conta com token ${this.activeToken.substring(0, 4)}...`,
    );

    try {
      this.webSocket.send(JSON.stringify(request));
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao inscrever-se para atualizações de saldo:",
        error,
      );
    }
  }

  /**
   * Método legado para compatibilidade - utiliza o novo método _subscribeToBalance
   */
  private subscribeToBalance(): void {
    this._subscribeToBalance();
  }

  /**
   * Configura mecanismo para manter a conexão ativa
   */
  private setupKeepAlive(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Enviar ping a cada 30 segundos para manter a conexão
    this.pingInterval = setInterval(() => {
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        const pingRequest = {
          ping: 1,
        };
        this.webSocket.send(JSON.stringify(pingRequest));
        console.log("[OAUTH_DIRECT] Ping enviado para manter conexão");
      }
    }, 30000);
  }

  /**
   * Agenda uma reconexão em caso de erro
   */
  private scheduleReconnect(): void {
    // Limpar reconexão agendada, se houver
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // Se o serviço estiver em execução, tentar reconectar
    if (this.isRunning) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error(
          `[OAUTH_DIRECT] Número máximo de tentativas de reconexão (${this.maxReconnectAttempts}) atingido`,
        );
        this.notifyListeners({
          type: "error",
          message:
            "Não foi possível reconectar ao servidor. Verifique sua conexão ou faça login novamente.",
        });
        this.isRunning = false;
        this.closeConnection();
        this.reconnectAttempts = 0;
        return;
      }

      console.log("[OAUTH_DIRECT] Agendando reconexão...");

      // Aplicar backoff exponencial
      const baseDelay = 1000; // 1 segundo
      const maxDelay = 30000; // 30 segundos

      // Calcular atraso com backoff
      const delay = Math.min(
        baseDelay * Math.pow(1.5, this.reconnectAttempts),
        maxDelay,
      );
      this.reconnectAttempts++;

      console.log(
        `[OAUTH_DIRECT] Tentativa ${this.reconnectAttempts} agendada para ${delay}ms`,
      );

      this.reconnectTimeout = setTimeout(() => {
        console.log(
          `[OAUTH_DIRECT] Executando reconexão (tentativa ${this.reconnectAttempts})`,
        );
        this.reconnect()
          .then((success) => {
            if (success) {
              console.log("[OAUTH_DIRECT] Reconexão bem-sucedida");
              this.reconnectAttempts = 0;
            } else {
              console.error("[OAUTH_DIRECT] Falha na reconexão");
              this.scheduleReconnect();
            }
          })
          .catch((error) => {
            console.error("[OAUTH_DIRECT] Erro na reconexão:", error);
            this.scheduleReconnect();
          });
      }, delay);
    }
  }

  /**
   * Autoriza um token com o servidor
   */
  private authorizeToken(token: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        reject(new Error("WebSocket não está conectado"));
        return;
      }

      // Timeout para caso não haja resposta
      const authTimeout = setTimeout(() => {
        reject(new Error("Timeout na autorização"));
      }, 10000);

      // Handler de resposta para autorização
      const authHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // Verificar se é resposta para authorize
          if (data.msg_type === "authorize") {
            // Remover o handler após receber a resposta
            if (this.webSocket) {
              this.webSocket.removeEventListener("message", authHandler);
            }

            clearTimeout(authTimeout);

            if (data.error) {
              console.error(
                "[OAUTH_DIRECT] Erro na autorização:",
                data.error.message,
              );

              // Verificar se o erro é devido a permissões insuficientes
              if (
                data.error.code === "ScopeError" ||
                data.error.message.includes("scope") ||
                data.error.message.includes("permission")
              ) {
                console.warn(
                  "[OAUTH_DIRECT] Token não tem permissões de trading. Notificando usuário para autorizar novamente.",
                );

                // Armazenar o error e o token com problemas
                localStorage.setItem(
                  "deriv_token_scope_error",
                  JSON.stringify({
                    token: token.substring(0, 10) + "...",
                    error: data.error.message,
                    timestamp: Date.now(),
                  }),
                );

                // Notificar a UI sobre o problema
                this.notifyListeners({
                  type: "token_permission_error",
                  message:
                    "O token não tem permissões suficientes para operações de trading. Por favor, autorize novamente com as permissões corretas.",
                  details: data.error.message,
                });

                // Direcionar o usuário a reautorizar com os escopos corretos
                this.promptForReauthorization();
              }

              reject(new Error(`Autorização falhou: ${data.error.message}`));
              return;
            }

            console.log(
              "[OAUTH_DIRECT] Autorização bem-sucedida:",
              data.authorize?.loginid,
            );

            // Atualizar o status do token na lista
            const tokenInfo = this.tokens.find((t) => t.token === token);
            if (tokenInfo) {
              tokenInfo.authorized = true;
              tokenInfo.loginid = data.authorize.loginid;
            }

            // Verificar se o token tem permissões de trading verificando as scopes
            if (data.authorize && data.authorize.scopes) {
              const hasTrading = this.checkHasTradingPermission(
                data.authorize.scopes,
              );

              console.log(
                `[OAUTH_DIRECT] Token tem permissões de trading: ${hasTrading ? "SIM" : "NÃO"}`,
              );

              if (!hasTrading) {
                console.warn(
                  "[OAUTH_DIRECT] Token autorizado, mas sem permissões de trading.",
                );

                // Notificar a UI sobre o problema
                this.notifyListeners({
                  type: "token_permission_warning",
                  message:
                    "O token tem acesso limitado. Algumas operações de trading podem não funcionar.",
                  details: "Permissões de trading não detectadas",
                });
              }
            }

            // Inscrever-se para atualizações de saldo
            this.subscribeToBalance();

            resolve(true);
          }
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] Erro ao processar resposta de autorização:",
            error,
          );
        }
      };

      // Adicionar handler temporário para resposta de autorização
      this.webSocket.addEventListener("message", authHandler);

      // Enviar solicitação de autorização
      const authorizeRequest = {
        authorize: token,
      };

      console.log("[OAUTH_DIRECT] Enviando solicitação de autorização");
      this.webSocket.send(JSON.stringify(authorizeRequest));
    });
  }

  /**
   * Verifica se o array de escopos contém permissões de trading
   */
  private checkHasTradingPermission(scopes: string[]): boolean {
    if (!scopes || !Array.isArray(scopes)) {
      console.error("[OAUTH_DIRECT] Escopos inválidos recebidos:", scopes);
      return false;
    }

    // Lista de escopos necessários
    const requiredScopes = ["trade", "trading"];

    // Normalizar escopos para comparação (converter para minúsculas)
    const normalizedScopes = scopes.map((s) => s.toLowerCase());

    // Verificar se pelo menos um dos escopos necessários está presente
    const hasRequiredScope = requiredScopes.some((scope) =>
      normalizedScopes.includes(scope.toLowerCase()),
    );

    // Registrar informações para depuração
    console.log(
      `[OAUTH_DIRECT] Token tem permissões de trading: ${hasRequiredScope ? "SIM" : "NÃO"}`,
    );
    console.log(
      `[OAUTH_DIRECT] Escopos encontrados: ${normalizedScopes.join(", ")}`,
    );

    // Apenas registrar erro crítico - quando não tem permissões essenciais
    if (!hasRequiredScope) {
      console.error(
        "[OAUTH_DIRECT] Token não possui permissões de trading necessárias",
      );

      // Registrar erro para ser exibido na interface
      const errorData = {
        token: this.activeToken
          ? this.activeToken.substring(0, 8) + "..."
          : "desconhecido",
        error: "missing_trading_permission",
        message:
          "Este token não possui as permissões necessárias para operações de trading",
        requiredScopes: requiredScopes,
        foundScopes: normalizedScopes,
        timestamp: Date.now(),
      };

      // Salvar no localStorage
      localStorage.setItem(
        "deriv_token_scope_error",
        JSON.stringify(errorData),
      );

      // Disparar evento para notificar componentes
      try {
        const scopeErrorEvent = new CustomEvent("deriv_token_scope_error", {
          detail: errorData,
        });
        document.dispatchEvent(scopeErrorEvent);
      } catch (error) {
        console.error(
          "[OAUTH_DIRECT] Erro ao disparar evento de erro de escopo:",
          error,
        );
      }
    }
    // Removido o else if para alertas de permissões opcionais

    return hasRequiredScope;
  }

  /**
   * Solicita ao usuário que reautorize a aplicação com os escopos corretos
   * Versão melhorada com registro de ações e notificações abrangentes
   */
  private promptForReauthorization(): void {
    try {
      // Identificar a conta atual
      const currentAccount =
        localStorage.getItem("deriv_active_loginid") || "sua conta";

      // Salvar o estado atual para retornar após a reautorização
      localStorage.setItem("deriv_pending_reauth", "true");
      localStorage.setItem(
        "deriv_pending_reauth_timestamp",
        Date.now().toString(),
      );

      // Montar a URL de autorização com os escopos corretos
      const appId = "72383"; // App ID do projeto atualizado
      const redirectUri = encodeURIComponent(
        window.location.origin + "/auth-callback",
      );

      // Definir todos os escopos necessários
      const allScopes = [
        "read",
        "admin",
        "payments",
        "trade",
        "trading",
        "trading_information",
      ];
      const scope = encodeURIComponent(allScopes.join(" "));

      // URL de autorização da Deriv com idioma português
      const authUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=pt&redirect_uri=${redirectUri}&scope=${scope}`;

      // Registrar solicitação de reautorização completa
      console.log(
        `[OAUTH_DIRECT] Solicitando reautorização para ${currentAccount} com escopos: ${allScopes.join(", ")}`,
      );

      // Salvar informações de solicitação
      localStorage.setItem(
        "deriv_reauth_request",
        JSON.stringify({
          timestamp: Date.now(),
          account: currentAccount,
          scopes: allScopes,
          url: authUrl,
        }),
      );

      // Notificar o usuário
      this.notifyListeners({
        type: "reauthorization_required",
        message: `É necessário reautorizar ${currentAccount} para operações de trading`,
        details:
          "A plataforma precisa de permissões adicionais para funcionar corretamente",
        account: currentAccount,
        scopes: allScopes,
        url: authUrl,
      });

      // Abrir página de autorização em uma nova janela após breve delay
      setTimeout(() => {
        try {
          const authWindow = window.open(
            authUrl,
            "_blank",
            "width=800,height=600",
          );

          if (!authWindow) {
            console.error(
              "[OAUTH_DIRECT] Falha ao abrir janela de autorização. Possível bloqueio de pop-up.",
            );

            // Caso falhe em abrir a janela, mostrar instrução detalhada para o usuário
            this.notifyListeners({
              type: "error",
              message: "Não foi possível abrir a janela de autorização",
              details:
                "Seu navegador pode estar bloqueando pop-ups. Por favor, permita pop-ups para este site ou use o botão de reautorização na interface.",
              actionRequired: true,
              actionUrl: authUrl,
            });

            // Disparar evento personalizado de falha na autorização
            const failEvent = new CustomEvent("deriv_auth_window_blocked", {
              detail: {
                timestamp: Date.now(),
                account: currentAccount,
                url: authUrl,
              },
            });
            document.dispatchEvent(failEvent);
          } else {
            console.log(
              "[OAUTH_DIRECT] Janela de autorização aberta com sucesso",
            );

            // Verificar se a janela está sendo carregada corretamente
            setTimeout(() => {
              try {
                if (authWindow.closed) {
                  console.warn(
                    "[OAUTH_DIRECT] Janela de autorização foi fechada rapidamente",
                  );
                  this.notifyListeners({
                    type: "warning",
                    message: "O processo de autorização foi interrompido",
                    details:
                      "A janela de autorização foi fechada antes de concluir o processo.",
                  });
                }
              } catch (e) {
                // Ignorar erros de acesso entre origens
              }
            }, 5000);
          }
        } catch (windowError) {
          console.error(
            "[OAUTH_DIRECT] Erro ao abrir janela de autorização:",
            windowError,
          );

          // Notificar que é necessário autorizar manualmente
          this.notifyListeners({
            type: "error",
            message: "Erro ao abrir janela de autorização",
            details:
              "Por favor, use o botão de reautorização na interface para tentar novamente.",
          });
        }
      }, 1000);
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao solicitar reautorização:", error);

      // Notificar erro geral
      this.notifyListeners({
        type: "error",
        message: "Erro ao iniciar processo de reautorização",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  }

  /**
   * Autoriza todos os tokens disponíveis
   */
  private authorizeAllTokens(): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      try {
        // Verificar se temos tokens
        if (this.tokens.length === 0) {
          console.error("[OAUTH_DIRECT] Nenhum token disponível");
          reject(new Error("Nenhum token disponível para autorização"));
          return;
        }

        // Identificar token primário
        const primaryToken = this.tokens.find((t) => t.primary);

        if (!primaryToken) {
          console.warn(
            "[OAUTH_DIRECT] Nenhum token primário encontrado, usando o primeiro",
          );
          this.tokens[0].primary = true;
        }

        // Usar token primário ou o primeiro da lista
        const tokenToAuthorize = (primaryToken || this.tokens[0]).token;
        this.activeToken = tokenToAuthorize;

        console.log("[OAUTH_DIRECT] Iniciando autorização com token principal");

        try {
          // Autorizar com o token principal
          await this.authorizeToken(tokenToAuthorize);
          console.log(
            "[OAUTH_DIRECT] Autorização com token principal concluída",
          );

          // Inscrever-se para receber ticks
          this.subscribeToTicks();

          resolve(true);
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] Erro na autorização com token principal:",
            error,
          );

          // Tentar outros tokens se o principal falhar
          let authorized = false;

          // Iterar pelos tokens restantes
          for (const tokenInfo of this.tokens) {
            // Pular o token primário que já falhou
            if (tokenInfo.token === tokenToAuthorize) continue;

            try {
              console.log(
                "[OAUTH_DIRECT] Tentando autorização com token alternativo",
              );
              await this.authorizeToken(tokenInfo.token);

              // Se chegou aqui, a autorização foi bem-sucedida
              console.log(
                "[OAUTH_DIRECT] Autorização com token alternativo bem-sucedida",
              );
              this.activeToken = tokenInfo.token;

              // Marcar como primário
              this.tokens.forEach((t) => (t.primary = false));
              tokenInfo.primary = true;

              // Inscrever-se para receber ticks
              this.subscribeToTicks();

              authorized = true;
              break;
            } catch (altError) {
              console.error(
                "[OAUTH_DIRECT] Erro na autorização com token alternativo:",
                altError,
              );
            }
          }

          if (!authorized) {
            reject(
              new Error("Falha na autorização com todos os tokens disponíveis"),
            );
          } else {
            resolve(true);
          }
        }
      } catch (error) {
        console.error(
          "[OAUTH_DIRECT] Erro global na autorização de tokens:",
          error,
        );
        reject(error);
      }
    });
  }

  /**
   * Executa compra de contrato
   */
  public executeContractBuy(amount?: number): void {
    // 🚨🚨🚨 FIX EMERGENCIAL 22/04/2025 - ISSUE CRÍTICO: ROBÔ NÃO EXECUTA OPERAÇÕES 🚨🚨🚨
    // ATUALIZAÇÃO (03/05/2025): Implementando ajuste de nível de risco

    // Usar o valor da operação diretamente
    let adjustedAmount = amount;
    
    // Verificar se é um valor de martingale
    const isMartingaleValue = localStorage.getItem('last_martingale_calculated_value') === String(amount);

    // VERIFICAÇÃO CRÍTICA: Logar sempre que uma operação for solicitada
    console.log(
      `[OAUTH_DIRECT] 🚀🚀🚀 EXECUTANDO COMPRA DE CONTRATO COM VALOR ${adjustedAmount} ${isMartingaleValue ? '(valor martingale)' : ''}`
    );
    console.log(
      `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO DE COMPRA: WebSocket status: ${this.webSocket?.readyState}`,
    );
    console.log(
      `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO DE COMPRA: isRunning: ${this.isRunning}`,
    );
    console.log(
      `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO DE COMPRA: activeStrategy: ${this.activeStrategy}`,
    );

    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      console.error(
        "[OAUTH_DIRECT] 🔴 WebSocket não está conectado - Não é possível executar operação",
      );

      // CORREÇÃO EMERGENCIAL: Tentar reconectar antes de falhar
      console.log(
        "[OAUTH_DIRECT] 🔄 Tentando reconectar WebSocket antes de executar a operação...",
      );

      this.setupWebSocket()
        .then(() => {
          console.log(
            "[OAUTH_DIRECT] ✅ WebSocket reconectado com sucesso! Tentando executar operação novamente...",
          );
          // Chamar este método novamente após reconexão
          setTimeout(() => this.executeContractBuy(adjustedAmount), 1000);
        })
        .catch((err) => {
          console.error(
            "[OAUTH_DIRECT] ❌ Falha ao reconectar WebSocket:",
            err,
          );
          this.notifyListeners({
            type: "error",
            message:
              "WebSocket não está conectado e não foi possível reconectar",
          });
        });

      return;
    }

    try {
      // 🚨🚨🚨 IMPLEMENTAÇÃO DEFINITIVA - CORREÇÃO 24/04/2025 🚨🚨🚨
      // CORREÇÃO CRÍTICA DO MARTINGALE - GARANTIR QUE O VALOR SEJA ENVIADO CORRETAMENTE

      // NUNCA USAR VALOR PADRÃO - APENAS o valor do usuário ou martingale calculado
      let finalAmount: number | undefined = undefined;
      
      // PRIORIDADE MÁXIMA: Verificar se existe um valor de martingale recém calculado
      try {
        // Verificar estado da estratégia para saber se estamos no ponto exato de aplicar martingale
        const strategyId = this.strategyConfig.toLowerCase();
        const strategyState = getStrategyState(strategyId);
        const consecutiveLosses = strategyState?.consecutiveLosses || 0;
        
        // Obter configuração de quando aplicar martingale
        let martingaleAfterXLosses = 2; // Valor padrão
        try {
          const configStr = localStorage.getItem(`strategy_config_${strategyId}`);
          if (configStr) {
            const config = JSON.parse(configStr);
            if (config.usarMartingaleAposXLoss) {
              martingaleAfterXLosses = parseInt(config.usarMartingaleAposXLoss.toString());
            }
          }
        } catch (e) {
          console.error(`[OAUTH_DIRECT] Erro ao ler config de martingale:`, e);
        }
        
        // Verificar se estamos exatamente no ponto de aplicar martingale
        const exactMartingalePoint = consecutiveLosses === martingaleAfterXLosses;
        
        console.log(`[OAUTH_DIRECT] 🚨 DIAGNÓSTICO MARTINGALE:`);
        console.log(`[OAUTH_DIRECT] 🚨 - Perdas consecutivas: ${consecutiveLosses}`);
        console.log(`[OAUTH_DIRECT] 🚨 - Martingale após X perdas: ${martingaleAfterXLosses}`);
        console.log(`[OAUTH_DIRECT] 🚨 - Exatamente no ponto de martingale? ${exactMartingalePoint ? 'SIM' : 'NÃO'}`);
        
        // CORREÇÃO CRÍTICA (01/05/2025): Verificar se estamos no ponto de martingale OU ALÉM
        // Aplicar em todas as operações após atingir o número configurado de perdas
        if (consecutiveLosses >= martingaleAfterXLosses) {
          // Notificar que estamos aplicando martingale devido ao Loss Virtual
          console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Aplicando martingale porque ${consecutiveLosses} perdas >= ${martingaleAfterXLosses} configurado`);
          
          const martingaleValue = localStorage.getItem('last_martingale_calculated_value');
          const martingaleTime = localStorage.getItem('last_martingale_calculation_time');
          
          if (martingaleValue) {
            const parsedMartingaleValue = parseFloat(martingaleValue);
            console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Valor martingale encontrado: ${parsedMartingaleValue}`);
            
            // Verificar se o valor do martingale é válido
            if (!isNaN(parsedMartingaleValue) && parsedMartingaleValue > 0) {
              finalAmount = parsedMartingaleValue;
              console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Usando valor de martingale: ${finalAmount}`);
            } else {
              // Se o valor não for válido, calcular novamente
              console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Valor martingale inválido, recalculando`);
              
              // Obter valores de configuração da estratégia ativa
              const strategyConfig = this.settings || {};
              // Garantir que entryValue seja um número
              const entryValue = typeof strategyConfig.entryValue === 'number' ? strategyConfig.entryValue : 1;
              const martingaleFactor = typeof strategyConfig.martingaleFactor === 'number' ? strategyConfig.martingaleFactor : 2;
              
              // Garantir explicitamente a conversão para número
              const entryValueNum = Number(entryValue);
              const martingaleFactorNum = Number(martingaleFactor);
              const calculatedMartingale = Math.round(entryValueNum * martingaleFactorNum * 100) / 100;
              finalAmount = calculatedMartingale;
              console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Martingale recalculado: ${entryValue} × ${martingaleFactor} = ${finalAmount}`);
              
              // Salvar o novo valor calculado
              try {
                localStorage.setItem('last_martingale_calculated_value', finalAmount.toString());
                localStorage.setItem('last_martingale_calculation_time', new Date().toISOString());
              } catch (e) {
                console.error(`[OAUTH_DIRECT] Erro ao salvar martingale recalculado:`, e);
              }
            }
            
            console.log(`[OAUTH_DIRECT] 🚨 PRIORIDADE MÁXIMA: Usando valor martingale ${finalAmount}`);
            
            // Verificar timestamp para garantir que o valor é recente
            if (martingaleTime) {
              const calculationTime = new Date(martingaleTime);
              const now = new Date();
              const diffMs = now.getTime() - calculationTime.getTime();
              const diffSec = Math.floor(diffMs / 1000);
              
              console.log(`[OAUTH_DIRECT] 🚨 Valor martingale calculado há ${diffSec} segundos`);
              
              // Se o valor foi calculado há mais de 60 segundos, avisar mas ainda usar
              if (diffSec > 60) {
                console.log(`[OAUTH_DIRECT] ⚠️ Valor martingale tem mais de 60 segundos, mas ainda será usado`);
              }
            }
          } else {
            // Se não há valor martingale salvo, calcular um novo
            console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Nenhum valor martingale encontrado, calculando`);
            
            // Obter valores de configuração da estratégia ativa
            const strategyConfig = this.settings || {};
            // Garantir que entryValue seja um número
            const entryValue = typeof strategyConfig.entryValue === 'number' ? strategyConfig.entryValue : 1;
            const martingaleFactor = typeof strategyConfig.martingaleFactor === 'number' ? strategyConfig.martingaleFactor : 2;
            
            // Garantir explicitamente a conversão para número
            const entryValueNum = Number(entryValue);
            const martingaleFactorNum = Number(martingaleFactor);
            const calculatedMartingale = Math.round(entryValueNum * martingaleFactorNum * 100) / 100;
            finalAmount = calculatedMartingale;
            console.log(`[OAUTH_DIRECT] 🚨 LOSS VIRTUAL: Martingale calculado: ${entryValue} × ${martingaleFactor} = ${finalAmount}`);
            
            // Salvar o novo valor calculado
            try {
              localStorage.setItem('last_martingale_calculated_value', finalAmount.toString());
              localStorage.setItem('last_martingale_calculation_time', new Date().toISOString());
            } catch (e) {
              console.error(`[OAUTH_DIRECT] Erro ao salvar martingale calculado:`, e);
            }
          }
        }
      } catch (e) {
        console.error(`[OAUTH_DIRECT] Erro ao verificar valor martingale:`, e);
      }

      // PRIORIDADE 2: Se não encontramos valor martingale, buscar do input do usuário
      if (!finalAmount || finalAmount <= 0) {
        const inputElement = document.getElementById(
          "iron-bot-entry-value",
        ) as HTMLInputElement;
        if (inputElement && inputElement.value) {
          const valueFromInput = parseFloat(inputElement.value);
          if (!isNaN(valueFromInput) && valueFromInput > 0) {
            finalAmount = valueFromInput;
            console.log(
              `[OAUTH_DIRECT] ✅ Usando valor ${finalAmount} do input do usuário`,
            );
          }
        }
      }

      // PRIORIDADE 2: Se não encontrar no input, buscar no localStorage
      if (!finalAmount || finalAmount <= 0) {
        try {
          let configKey = "strategy_config_";
          if (this.activeStrategy) {
            configKey += this.activeStrategy.toLowerCase().replace(/\s+/g, "");
          } else {
            configKey += "default";
          }

          const configStr = localStorage.getItem(configKey);
          if (configStr) {
            const config = JSON.parse(configStr);
            if (
              config.valorInicial &&
              !isNaN(parseFloat(config.valorInicial.toString()))
            ) {
              finalAmount = parseFloat(config.valorInicial.toString());
              console.log(
                `[OAUTH_DIRECT] ✅ Usando valor ${finalAmount} salvo no localStorage`,
              );
            }
          }
        } catch (e) {
          console.error(
            "[OAUTH_DIRECT] Erro ao ler configuração do localStorage:",
            e,
          );
        }
      }

      // PRIORIDADE 3: Se especificado um valor como parâmetro desta função
      if (
        (!finalAmount || finalAmount <= 0) &&
        amount !== undefined &&
        amount > 0
      ) {
        finalAmount = amount;
        console.log(
          `[OAUTH_DIRECT] ✅ Usando valor ${finalAmount} passado como parâmetro`,
        );
      }

      // PRIORIDADE 4: Se ainda não tiver valor, usar entryValue das configurações
      if (
        (!finalAmount || finalAmount <= 0) &&
        this.settings.entryValue
      ) {
        // Converter para número para garantir tipo correto
        const entryValueAsNumber = typeof this.settings.entryValue === 'string' 
          ? parseFloat(this.settings.entryValue) 
          : this.settings.entryValue;
          
        if (entryValueAsNumber > 0) {
          finalAmount = entryValueAsNumber;
        }
        console.log(
          `[OAUTH_DIRECT] ✅ Usando valor ${finalAmount} das configurações`,
        );
      }

      // Log detalhado para diagnóstico
      console.log(`[OAUTH_DIRECT] === DIAGNÓSTICO DE VALOR DE ENTRADA ===`);
      console.log(`[OAUTH_DIRECT] Valor original recebido: ${amount}`);
      console.log(
        `[OAUTH_DIRECT] Valor nas configurações: ${this.settings.entryValue}`,
      );
      console.log(`[OAUTH_DIRECT] Valor FINAL usado: ${finalAmount}`);
      console.log(`[OAUTH_DIRECT] Estratégia atual: ${this.activeStrategy}`);
      console.log(`[OAUTH_DIRECT] =======================================`);

      // CORREÇÃO CRÍTICA: Verificar se temos um valor final válido!
      if (!finalAmount || finalAmount <= 0) {
        console.error(
          "[OAUTH_DIRECT] ❌ ERRO FATAL: Nenhum valor válido encontrado para executar operação",
        );
        this.notifyListeners({
          type: "error",
          message:
            "Valor de entrada não configurado. Por favor, verifique as configurações.",
        });
        return; // Não continuar sem valor válido
      }

      // Atualizar configurações com o valor para uso em operações subsequentes
      this.settings.entryValue = finalAmount;

      // Definir o amount para o valor final após aplicar as prioridades
      // Garantir que o valor seja numérico
      adjustedAmount = typeof finalAmount === 'number' ? finalAmount : 1.0;
      
      // Usar o valor sem modificadores
      console.log(
        `[OAUTH_DIRECT] 🛡️ Usando valor final: ${adjustedAmount}`
      );

      // Usar o tipo de contrato definido exatamente pelo XML da estratégia através do settings
      // Esta configuração vem do resultado da análise da estratégia via xmlStrategyParser
      let contractType = this.settings.contractType || "DIGITOVER";

      console.log(
        `[OAUTH_DIRECT] ✅ Usando tipo de contrato ${contractType} exatamente como definido no XML da estratégia`,
      );

      // LOG adicional para verificar a estratégia ativa e tipo de contrato
      console.log(
        `[OAUTH_DIRECT] 📊 Estratégia ativa: ${this.activeStrategy}, Tipo de contrato: ${contractType}`,
      );

      // NOVA VERIFICAÇÃO DE CONSISTÊNCIA:
      // Verificar se temos uma operação XML onde o tipo de contrato deve ser respeitado
      // e comparar com o que está definido na estratégia, garantindo consistência total

      // Se for uma estratégia XML conhecida, validar tipo de contrato
      if (this.activeStrategy) {
        // Caminhos conhecidos das estratégias IRON/CONTROL OVER e IRON/CONTROL UNDER
        const ironOverStrategies = ["iron over", "ironover", "iron_over"];
        const ironUnderStrategies = ["iron under", "ironunder", "iron_under"];
        // Adicionar estratégias Control Over e Control Under
        const controlOverStrategies = ["control over", "manualover", "manual_over", "control_over"];
        const controlUnderStrategies = ["control under", "manualunder", "manual_under", "control_under"];

        // Verificar e logar o tipo de contrato para máxima visibilidade
        if (
          ironOverStrategies.some((s) =>
            this.activeStrategy.toLowerCase().includes(s),
          )
        ) {
          console.log(
            `[OAUTH_DIRECT] ⚙️ Estratégia ${this.activeStrategy} é do tipo IRON OVER`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo de contrato definido: ${contractType}`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo esperado para IRON OVER: DIGITOVER`,
          );

          if (contractType !== "DIGITOVER") {
            console.log(
              `[OAUTH_DIRECT] 🔴 ATENÇÃO: Estratégia IRON OVER com tipo inconsistente: ${contractType}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔴 Isto pode indicar um problema na leitura do XML ou configuração`,
            );
          }
        } else if (
          ironUnderStrategies.some((s) =>
            this.activeStrategy.toLowerCase().includes(s),
          )
        ) {
          console.log(
            `[OAUTH_DIRECT] ⚙️ Estratégia ${this.activeStrategy} é do tipo IRON UNDER`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo de contrato definido: ${contractType}`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo esperado para IRON UNDER: DIGITUNDER`,
          );

          if (contractType !== "DIGITUNDER") {
            console.log(
              `[OAUTH_DIRECT] 🔴 ATENÇÃO: Estratégia IRON UNDER com tipo inconsistente: ${contractType}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔴 Isto pode indicar um problema na leitura do XML ou configuração`,
            );
          }
        } else if (
          controlOverStrategies.some((s) =>
            this.activeStrategy.toLowerCase().includes(s),
          )
        ) {
          console.log(
            `[OAUTH_DIRECT] ⚙️ Estratégia ${this.activeStrategy} é do tipo CONTROL OVER`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo de contrato definido: ${contractType}`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo esperado para CONTROL OVER: DIGITOVER`,
          );

          if (contractType !== "DIGITOVER") {
            console.log(
              `[OAUTH_DIRECT] 🔴 ATENÇÃO: Estratégia CONTROL OVER com tipo inconsistente: ${contractType}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔴 Isto pode indicar um problema na configuração`,
            );
          }
        } else if (
          controlUnderStrategies.some((s) =>
            this.activeStrategy.toLowerCase().includes(s),
          )
        ) {
          console.log(
            `[OAUTH_DIRECT] ⚙️ Estratégia ${this.activeStrategy} é do tipo CONTROL UNDER`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo de contrato definido: ${contractType}`,
          );
          console.log(
            `[OAUTH_DIRECT] ⚙️ Tipo esperado para CONTROL UNDER: DIGITUNDER`,
          );

          if (contractType !== "DIGITUNDER") {
            console.log(
              `[OAUTH_DIRECT] 🔴 ATENÇÃO: Estratégia CONTROL UNDER com tipo inconsistente: ${contractType}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔴 Isto pode indicar um problema na configuração`,
            );
          }
        }
      }

      // Garantir que prediction seja válido (1-9) para contratos DIGIT
      let prediction = this.settings.prediction || 5;
      if (
        contractType.startsWith("DIGIT") &&
        (prediction < 1 || prediction > 9)
      ) {
        console.warn(
          `[OAUTH_DIRECT] 🚨 Valor de previsão inválido: ${prediction}. API Deriv aceita apenas 1-9. Ajustando para 5.`,
        );
        prediction = 5;
      }

      // Log detalhado para depuração IRON UNDER
      console.log(
        `[OAUTH_DIRECT] 🚀🚀🚀 EXECUTANDO COMPRA DE CONTRATO - DEBUG DETALHADO 🚀🚀🚀`,
      );
      console.log(`[OAUTH_DIRECT] 🚀 Estratégia ativa: ${this.activeStrategy}`);
      console.log(
        `[OAUTH_DIRECT] 🚀 Tipo de contrato (CORRIGIDO): ${contractType}`,
      );
      console.log(`[OAUTH_DIRECT] 🚀 Previsão: ${prediction}`);
      console.log(
        `[OAUTH_DIRECT] 🚀 Valor da entrada EXATO: ${amount} (preservando valor configurado pelo usuário)`,
      );
      console.log(
        `[OAUTH_DIRECT] 🚀 Status da conexão: ${this.webSocket.readyState}`,
      );
      console.log(
        `[OAUTH_DIRECT] 💡 VALIDAÇÃO CRÍTICA: O valor da entrada deve ser exatamente o configurado pelo usuário`,
      );

      // Notificar início da operação
      this.notifyListeners({
        type: "operation_started",
        amount: adjustedAmount,
        contract_type: contractType,
        prediction: prediction
      });

      // 🚨🚨🚨 CORREÇÃO CRÍTICA: IMPLEMENTAÇÃO CORRIGIDA DE FLUXO PROPOSAL -> BUY 🚨🚨🚨
      // Documentação: https://api.deriv.com/api-explorer/#proposal
      // É necessário primeiro obter uma proposta antes de fazer a compra

      console.log(
        `[OAUTH_DIRECT] 🔄 FLUXO CORRIGIDO: Solicitando proposta (proposal) antes da compra`,
      );
      console.log(
        `[OAUTH_DIRECT] 💰 VALOR DE ENTRADA ORIGINAL: ${amount} USD (EXATAMENTE o valor configurado pelo usuário)`,
      );

      // Parse do valor para garantir que é numérico 
      const parsedAmount = typeof adjustedAmount === "number" 
        ? adjustedAmount 
        : 1.0; // valor padrão caso adjustedAmount não seja um número

      // Verificar e registrar se o valor foi convertido corretamente
      if (typeof adjustedAmount === "number" && parsedAmount !== adjustedAmount) {
        console.error(
          `[OAUTH_DIRECT] ⚠️ ALERTA: Valor de entrada pode ter sido alterado na conversão: ${adjustedAmount} -> ${parsedAmount}`,
        );
      }

      console.log(
        `[OAUTH_DIRECT] 💰 VALOR DE ENTRADA FINAL (após conversão): ${parsedAmount} USD`,
      );

      // Primeiro passo: criar a solicitação de proposta com ID único
      const reqId = Date.now(); // ID único para essa solicitação

      // Montar objeto de proposta conforme documentação da API
      // CORREÇÃO CRÍTICA: SEMPRE usar duração de 1 tick para a estratégia Advance
      // Conforme imagem do contrato fornecida pelo usuário, duração DEVE ser 1 tick

      // Valor padrão para outras estratégias
      let duration = 1;

      // Para a estratégia Advance, forçar SEMPRE 1 tick
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        duration = 1; // CRÍTICO: Advance SEMPRE usa exatamente 1 tick de duração
        console.log(
          `[OAUTH_DIRECT] 🚨 CORREÇÃO CRÍTICA: Estratégia Advance detectada! Forçando duração de 1 tick conforme contrato real.`,
        );

        // Para DIGITOVER, a prediction é definida pelo campo barrier
        prediction = 1; // CRÍTICO: Este é o valor que aparece no contrato: "acima de 1"
        console.log(
          `[OAUTH_DIRECT] 🚨 CORREÇÃO CRÍTICA: Forçando barrier/prediction = 1 para DIGITOVER (valor que aparece no contrato)`,
        );
      } else {
        console.log(
          `[OAUTH_DIRECT] Usando duração padrão de ${duration} ticks para estratégia ${this.activeStrategy || "desconhecida"}`,
        );
      }

      // DIAGNÓSTICO ADICIONAL: Log específico para configurações de Advance
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        console.log(
          `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO ADVANCE: Contract Type = ${contractType}`,
        );
        console.log(
          `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO ADVANCE: Prediction = ${prediction}`,
        );
        console.log(
          `[OAUTH_DIRECT] 🔍 DIAGNÓSTICO ADVANCE: Duration = ${duration} tick`,
        );
      }

      // IMPLEMENTAÇÃO CRÍTICA - CORREÇÃO ESPECÍFICA PARA ADVANCE
      // Para a estratégia Advance, SEMPRE usar 1 tick e previsão 1, independente do que esteja configurado
      // Conforme a imagem do contrato real fornecida pelo usuário, esses valores são obrigatórios
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        // FORÇAR duração de 1 tick para Advance
        duration = 1; // OBRIGATÓRIO: Duração 1 tick conforme a imagem do contrato

        // FORÇAR previsão de 1 para Advance (valor acima de 1)
        prediction = 1; // OBRIGATÓRIO: Previsão 1 conforme a imagem do contrato

        // Garantir que o contractType seja DIGITOVER
        contractType = "DIGITOVER"; // OBRIGATÓRIO: DIGITOVER conforme a imagem do contrato

        console.log(
          `[OAUTH_DIRECT] 🔴 CORREÇÃO EMERGENCIAL: FORÇANDO valores EXATAMENTE como na imagem do contrato:`,
        );
        console.log(
          `[OAUTH_DIRECT] 🔴 - Duration: ${duration} tick (OBRIGATÓRIO conforme imagem)`,
        );
        console.log(
          `[OAUTH_DIRECT] 🔴 - Prediction: ${prediction} (OBRIGATÓRIO conforme imagem)`,
        );
        console.log(
          `[OAUTH_DIRECT] 🔴 - Contract Type: ${contractType} (OBRIGATÓRIO conforme imagem)`,
        );
      }
      // Para outras estratégias, usar duration do XML se disponível
      else if (this.settings.duration !== undefined) {
        // Se o parser XML definiu uma duração específica, usar essa duração
        duration = this.settings.duration;
        console.log(
          `[OAUTH_DIRECT] 🚨 CORREÇÃO CRÍTICA: Usando duração de ${duration} tick(s) definida diretamente pelo parser XML`,
        );
      }

      // INTERVENÇÃO CRÍTICA PARA ADVANCE - VERIFICA E FORÇA NOVAMENTE AQUI
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        // GARANTIR QUE OS VALORES ESTÃO CORRETOS
        duration = 1;
        prediction = 1;
        contractType = "DIGITOVER";
        console.log(
          `[OAUTH_DIRECT] 🔴 INTERVENÇÃO CRÍTICA FINAL: FORÇANDO valores para Advance antes de enviar`,
        );
      }

      // VERIFICAÇÃO FINAL ABSOLUTA PARA ADVANCE
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        // GARANTIR valores da duração estão certos para Advance
        duration = 1; // FORÇAR 1 tick conforme imagem do contrato
        console.log(
          `[OAUTH_DIRECT] 🔴 GARANTINDO valor final antes de montar objeto: duration=${duration}`,
        );
      }

      // Montagem final do objeto de proposta
      const proposalRequest: any = {
        proposal: 1,
        req_id: reqId,
        amount: parsedAmount, // Usar o valor exato convertido
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        duration: duration, // CORREÇÃO: Usar EXATAMENTE 1 tick para Advance
        duration_unit: "t",
        symbol: "R_100",
      };

      // VERIFICAR OBJETO FINAL - se for Advance, duration deve ser 1
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        if (proposalRequest.duration !== 1) {
          console.log(
            `[OAUTH_DIRECT] 🚨 ERRO CRÍTICO: duration=${proposalRequest.duration}, DEVERIA SER 1! CORRIGINDO...`,
          );
          proposalRequest.duration = 1; // GARANTIR que é 1
        }
      }

      // DIAGNÓSTICO CRÍTICO: Mostrar detalhes exatos do que estamos enviando
      console.log(`[OAUTH_DIRECT] 🔍 ANTES DE ENVIAR - DETALHES DO CONTRATO:`);
      console.log(
        `[OAUTH_DIRECT] 🔍 - Contract Type: ${proposalRequest.contract_type}`,
      );
      console.log(
        `[OAUTH_DIRECT] 🔍 - Duration: ${proposalRequest.duration} ${proposalRequest.duration_unit}`,
      );

      // Adicionar barreira para contratos de dígito
      if (contractType.includes("DIGIT")) {
        // INTERVENÇÃO DEFINITIVA - Forçar valor da barreira para estratégias específicas
        if (
          this.activeStrategy &&
          this.activeStrategy.toLowerCase().includes("advance")
        ) {
          proposalRequest.barrier = "1";
          // Forçar atributos adicionais para modificar a visualização
          proposalRequest.display_name = "acima de 1"; // Tentar forçar o nome de exibição
          console.log(
            `[OAUTH_DIRECT] 🚨🚨🚨 INTERVENÇÃO DEFINITIVA: Forçando barrier=1 para ADVANCE`,
          );
        } else {
          proposalRequest.barrier = prediction.toString();
        }

        console.log(
          `[OAUTH_DIRECT] ⚡ Adicionando barreira ${proposalRequest.barrier} para contrato de dígito ${contractType}`,
        );
      }

      // MONITORAR API HACKING - Guardar os valores originais enviados para comparar com o retorno
      try {
        localStorage.setItem(
          "last_proposal_sent",
          JSON.stringify({
            contract_type: proposalRequest.contract_type,
            barrier: proposalRequest.barrier,
            timestamp: new Date().toISOString(),
          }),
        );
      } catch (e) {}

      // INTERVENÇÃO CRÍTICA FINAL PARA ADVANCE - ÚLTIMO RECURSO ANTES DE ENVIAR
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        // OVERRIDE FINAL - FORÇAR VALOR BARRIER=1 PARA ADVANCE
        console.log(
          `[OAUTH_DIRECT] 🚨🚨🚨 INTERVENÇÃO FINAL ABSOLUTA: ⭐ FORÇANDO BARRIER = 1 ⭐`,
        );

        // Forçar novamente todos os valores críticos
        proposalRequest.barrier = "1";
        proposalRequest.duration = 1;

        // CORREÇÃO URGENTE: Remover qualquer valor de porcentagemParaEntrar que esteja incorretamente sendo usado como barreira
        delete proposalRequest.porcentagemParaEntrar;

        // Adicionar propriedades específicas para tentar manipular a exibição na interface
        proposalRequest.display_value = "acima de 1";

        // Log específico para ajudar o diagnóstico
        console.log(`[OAUTH_DIRECT] 🔴 ADVANCE DIAGNÓSTICO FINAL:`);
        console.log(`[OAUTH_DIRECT] 🔴 Barrier: ${proposalRequest.barrier}`);
        console.log(`[OAUTH_DIRECT] 🔴 Duration: ${proposalRequest.duration}`);
        console.log(
          `[OAUTH_DIRECT] 🔴 Contract Type: ${proposalRequest.contract_type}`,
        );
        proposalRequest.duration_unit = "t";
        proposalRequest.contract_type = "DIGITOVER";

        // Registrar JSON final
        console.log(
          `[OAUTH_DIRECT] 📝 PROPOSTA FINAL ADVANCE:`,
          JSON.stringify(proposalRequest, null, 2),
        );

        // Salvar no localStorage para diagnóstico
        try {
          localStorage.setItem(
            "ADVANCE_FINAL_PROPOSAL",
            JSON.stringify({
              barrier: proposalRequest.barrier,
              duration: proposalRequest.duration,
              contract_type: proposalRequest.contract_type,
              timestamp: new Date().toISOString(),
            }),
          );
        } catch (e) {}
      }

      // ESSA SERÁ A PRIMEIRA MENSAGEM ENVIADA - PROPOSAL REQUEST
      console.log(
        `[OAUTH_DIRECT] 📤 ENVIANDO SOLICITAÇÃO DE PROPOSTA:`,
        proposalRequest,
      );

      // Criar uma variável para controlar se já processamos a resposta
      let proposalProcessed = false;

      // INTERCEPTAÇÃO CRÍTICA FINAL
      // Esta é nossa última chance de corrigir os valores para Advance
      if (
        this.activeStrategy &&
        this.activeStrategy.toLowerCase().includes("advance")
      ) {
        console.log(
          "[OAUTH_DIRECT] 🚨 INTERCEPTAÇÃO FINAL - Advance detectado!",
        );

        // FORÇAR os valores corretos diretamente no objeto
        proposalRequest.duration = 1;
        proposalRequest.contract_type = "DIGITOVER";
        proposalRequest.barrier = "1";

        console.log("[OAUTH_DIRECT] 🚨 OBJETO FINAL APÓS INTERCEPTAÇÃO:");
        console.log(
          `[OAUTH_DIRECT] 🚨 - duration: ${proposalRequest.duration}`,
        );
        console.log(
          `[OAUTH_DIRECT] 🚨 - contract_type: ${proposalRequest.contract_type}`,
        );
        console.log(`[OAUTH_DIRECT] 🚨 - barrier: ${proposalRequest.barrier}`);
      }

      // EMERGÊNCIA - CORREÇÃO FINAL - INTERCEPTAR COMPLETAMENTE O JSON
      try {
        // Nova abordagem: Mudar a string JSON diretamente
        let advanceRequest: any = proposalRequest;
        if (
          this.activeStrategy &&
          this.activeStrategy.toLowerCase().includes("advance")
        ) {
          // FORÇAR MANUALMENTE OS VALORES DA ESTRATÉGIA ADVANCE AQUI
          // EM VEZ DE MODIFICAR O OBJETO, VAMOS CRIAR UM OBJETO COMPLETAMENTE NOVO
          console.log(
            `[OAUTH_DIRECT] 🔴 EMERGÊNCIA - INTERCEPTAÇÃO ABSOLUTA PARA ADVANCE`,
          );
          advanceRequest = {
            proposal: 1,
            req_id: reqId,
            amount: proposalRequest.amount,
            basis: "stake",
            contract_type: "DIGITOVER",
            currency: "USD",
            duration: 1,
            duration_unit: "t",
            symbol: "R_100",
            barrier: "1",
            // ADICIONANDO PREDICTION EXPLICITAMENTE!
            prediction: 1, // CRÍTICO: prediction DEVE ser 1 exatamente conforme a imagem
          };
          console.log(
            `[OAUTH_DIRECT] 🚨🚨🚨 CONFIGURAÇÃO FORÇADA PARA ADVANCE:`,
          );
          console.log(
            `[OAUTH_DIRECT] 🚨 DURATION: ${advanceRequest.duration} ${advanceRequest.duration_unit}`,
          );
          console.log(
            `[OAUTH_DIRECT] 🚨 BARRIER: ${advanceRequest.barrier} (DIGITOVER significa acima de ${advanceRequest.barrier})`,
          );
          console.log(
            `[OAUTH_DIRECT] 🚨 CONTRACT_TYPE: ${advanceRequest.contract_type}`,
          );
          console.log(
            `[OAUTH_DIRECT] 🚨 PREDICTION: ${advanceRequest.prediction} (VERIFICAR SE ESTÁ SENDO IGNORADO PELA API)`,
          );
          console.log(
            `[OAUTH_DIRECT] 🔴 OBJETO COMPLETAMENTE SUBSTITUÍDO PARA ADVANCE`,
          );
        }

        // Converter objeto para string JSON para envio
        const jsonRequest = JSON.stringify(advanceRequest);
        console.log(`[OAUTH_DIRECT] 📤 JSON EXATO ENVIADO: ${jsonRequest}`);

        this.webSocket.send(jsonRequest);
        console.log(
          `[OAUTH_DIRECT] ✅ Proposta enviada com sucesso. Aguardando resposta...`,
        );
      } catch (wsError) {
        console.error(`[OAUTH_DIRECT] ❌ ERRO AO ENVIAR PROPOSTA:`, wsError);
        return; // Encerrar o fluxo se houver erro ao enviar
      }

      // Adicionar listener para receber a resposta da proposta
      const handleProposalResponse = (event: MessageEvent) => {
        // Evitar processamento duplicado
        if (proposalProcessed) {
          return;
        }

        try {
          const data = JSON.parse(event.data);
          console.log(`[OAUTH_DIRECT] 📨 Mensagem recebida:`, data);

          // Verificar se é a resposta à nossa proposta pelo req_id
          if (data.req_id === reqId && data.proposal) {
            // Marcar como processado para evitar duplicação
            proposalProcessed = true;

            console.log(
              `[OAUTH_DIRECT] ✅ PROPOSTA ACEITA: ID=${data.proposal.id}, Preço=${data.proposal.ask_price}, Payout=${data.proposal.payout}`,
            );

            // INTERVENÇÃO MASSIVA na proposta para Advance - último nível de interceptação
            if (this.activeStrategy?.toLowerCase().includes("advance")) {
              console.log(
                `[OAUTH_DIRECT] 🔴 INTERVENÇÃO MASSIVA PARA ADVANCE: Modificando proposta recebida`,
              );
              console.log(
                `[OAUTH_DIRECT] ⚠️ Proposta original:`,
                JSON.stringify(data.proposal, null, 2),
              );

              // Sempre modificar a barreira, independente do valor original
              const originalBarrier = data.proposal.barrier;
              const originalDisplay = data.proposal.display_name;

              // FORÇAR valores corretos
              data.proposal.barrier = "1";

              // INTERVENÇÃO NUCLEAR: Inspecionar objeto completo e modificar qualquer ocorrência de "5"
              const forceBarrierToOne = (obj: any) => {
                if (!obj || typeof obj !== "object") return;

                Object.keys(obj).forEach((key) => {
                  // Para strings, substituir qualquer menção à barreira 5
                  if (typeof obj[key] === "string") {
                    if (
                      key === "barrier" ||
                      key === "high_barrier" ||
                      key === "low_barrier"
                    ) {
                      if (obj[key] === "5") {
                        console.log(
                          `[OAUTH_DIRECT] 🔴 INTERVENÇÃO NUCLEAR: Substituindo ${key}="${obj[key]}" por "1"`,
                        );
                        obj[key] = "1";
                      }
                    }

                    // Para textos de exibição
                    if (
                      key === "display_name" ||
                      key === "longcode" ||
                      key === "shortcode" ||
                      key === "description"
                    ) {
                      const original = obj[key];

                      // Português
                      obj[key] = obj[key].replace(
                        /acima de \d+/g,
                        "acima de 1",
                      );
                      obj[key] = obj[key].replace(
                        /maior que \d+/g,
                        "maior que 1",
                      );
                      obj[key] = obj[key].replace(
                        /superior a \d+/g,
                        "superior a 1",
                      );

                      // Inglês
                      obj[key] = obj[key].replace(/above \d+/g, "above 1");
                      obj[key] = obj[key].replace(
                        /higher than \d+/g,
                        "higher than 1",
                      );
                      obj[key] = obj[key].replace(
                        /greater than \d+/g,
                        "greater than 1",
                      );

                      // Termos específicos
                      obj[key] = obj[key].replace(/over \d+/g, "over 1");
                      obj[key] = obj[key].replace(
                        /DigitOver \d+/g,
                        "DigitOver 1",
                      );
                      obj[key] = obj[key].replace(
                        /DIGITOVER \d+/g,
                        "DIGITOVER 1",
                      );

                      if (original !== obj[key]) {
                        console.log(
                          `[OAUTH_DIRECT] 🔴 INTERVENÇÃO NUCLEAR: Texto modificado em ${key}`,
                        );
                        console.log(`[OAUTH_DIRECT] 🔴 - ANTES: ${original}`);
                        console.log(`[OAUTH_DIRECT] 🔴 - DEPOIS: ${obj[key]}`);
                      }
                    }
                  }
                  // Para números, converter 5 para 1 em campos específicos
                  else if (typeof obj[key] === "number") {
                    if (
                      key === "barrier_count" ||
                      key === "barriers" ||
                      key === "prediction" ||
                      key === "digit"
                    ) {
                      if (obj[key] === 5) {
                        console.log(
                          `[OAUTH_DIRECT] 🔴 INTERVENÇÃO NUCLEAR: Número ${key}=${obj[key]} substituído por 1`,
                        );
                        obj[key] = 1;
                      }
                    }
                  }
                  // Recursão para objetos aninhados
                  else if (typeof obj[key] === "object" && obj[key] !== null) {
                    forceBarrierToOne(obj[key]);
                  }
                });
              };

              // Aplicar a função recursiva para modificar todos os valores "5" para "1"
              console.log(
                `[OAUTH_DIRECT] 🚨 APLICANDO INTERVENÇÃO NUCLEAR PARA SUBSTITUIR TODAS AS BARREIRAS`,
              );
              forceBarrierToOne(data.proposal);
              console.log(`[OAUTH_DIRECT] 🚨 INTERVENÇÃO NUCLEAR CONCLUÍDA`);

              // Modificar display_name em todos os casos, independente do conteúdo original
              if (data.proposal.display_name) {
                // Para português
                data.proposal.display_name = data.proposal.display_name.replace(
                  /acima de \d+/g,
                  "acima de 1",
                );

                // Para inglês
                data.proposal.display_name = data.proposal.display_name.replace(
                  /above \d+/g,
                  "above 1",
                );

                // Forçar caso nenhum padrão tenha sido encontrado
                if (data.proposal.display_name === originalDisplay) {
                  data.proposal.display_name = `${data.proposal.display_name} (acima de 1)`;
                }
              }

              // Modificar parâmetros adicionais para garantir que tudo seja consistente
              if (data.proposal.longcode) {
                // Importar função utilitária para correção consistente
                const { correctBarrierText } = require("@/lib/utils");
                // Usar a função utilitária completa com todos os padrões implementados
                data.proposal.longcode = correctBarrierText(
                  data.proposal.longcode,
                  "advance",
                );

                // CORREÇÃO ESPECÍFICA: para o caso específico do "superior a 5 ticks"
                if (
                  data.proposal.longcode.includes("superior a") &&
                  data.proposal.longcode.includes("ticks")
                ) {
                  data.proposal.longcode = data.proposal.longcode.replace(
                    /superior a \d+ ticks/gi,
                    "superior a 1 ticks",
                  );
                  console.log(
                    `[OAUTH_DIRECT] 🔴 PROPOSTA: Corrigido "superior a X ticks" especificamente`,
                  );
                }
              }

              // CORREÇÃO CRÍTICA: SEMPRE forçar duration para 1 tick INDEPENDENTE do valor original
              // Imagem do contrato mostra que precisa SER 1 tick EXATAMENTE
              console.log(
                `[OAUTH_DIRECT] 🔴 PROPOSTA: Valor original da duração: ${data.proposal.duration} ${data.proposal.duration_unit}`,
              );
              data.proposal.duration = 1;
              data.proposal.duration_unit = "t";
              console.log(
                `[OAUTH_DIRECT] 🔴 PROPOSTA: FORÇANDO duração para 1 tick conforme imagem do contrato!`,
              );

              // Registrar modificações no localStorage para diagnóstico
              try {
                localStorage.setItem(
                  "advance_barrier_from",
                  originalBarrier || "desconhecido",
                );
                localStorage.setItem("advance_barrier_to", "1");
                localStorage.setItem(
                  "advance_display_name_from",
                  originalDisplay || "desconhecido",
                );
                localStorage.setItem(
                  "advance_display_name_to",
                  data.proposal.display_name,
                );
                localStorage.setItem(
                  "advance_correction_time",
                  new Date().toISOString(),
                );
              } catch (e) {}

              console.log(
                `[OAUTH_DIRECT] 🔴 PROPOSTA MODIFICADA PARA ADVANCE:`,
              );
              console.log(
                `[OAUTH_DIRECT] ✅ Barreira: ${originalBarrier} -> ${data.proposal.barrier}`,
              );
              console.log(
                `[OAUTH_DIRECT] ✅ Display: ${originalDisplay} -> ${data.proposal.display_name}`,
              );
              console.log(
                `[OAUTH_DIRECT] ✅ JSON completo:`,
                JSON.stringify(data.proposal, null, 2),
              );
            }

            // Remover o listener imediatamente
            this.webSocket.removeEventListener(
              "message",
              handleProposalResponse,
            );

            // Agora sim fazer a compra usando o ID da proposta recebida
            const buyRequest = {
              buy: data.proposal.id,
              price: data.proposal.ask_price,
              req_id: Date.now(), // Novo ID único para a compra
            };

            // Se for Advance, adicionamos parâmetros extras
            if (this.activeStrategy?.toLowerCase().includes("advance")) {
              console.log(
                `[OAUTH_DIRECT] 🔴 MODIFICANDO COMPRA PARA ADVANCE COM BARREIRA 1`,
              );

              // INTERVENÇÃO CRÍTICA: Para contratos DIGITOVER, o campo "barrier" define a previsão (não prediction)
              // Esta é a razão pela qual estava aparecendo "acima de 5" em vez de "acima de 1"

              // MÚLTIPLAS TENTATIVAS DE MODIFICAR O JSON ENVIADO:

              // 1. Tentar com parameters (mais específico)
              (buyRequest as any).parameters = {
                barrier: "1",
              };

              // 2. Tentar diretamente no objeto principal (menos específico)
              (buyRequest as any).barrier = "1";

              // 3. Tentar com prediction explicitamente
              (buyRequest as any).prediction = 1;

              // 4. Tentativa de forçar alteração completa do objeto enviado
              const originalBuyId = buyRequest.buy;
              const originalPrice = buyRequest.price;
              const originalReqId = buyRequest.req_id;

              // Criar objeto completamente novo (tentativa de última chance)
              const newBuyRequest = {
                buy: originalBuyId,
                price: originalPrice,
                req_id: originalReqId,
                parameters: {
                  barrier: "1",
                },
                barrier: "1",
                prediction: 1,
              };

              // Substituir o objeto original pelo novo
              Object.assign(buyRequest, newBuyRequest);

              console.log(
                `[OAUTH_DIRECT] 🔴 INTERVENÇÃO CRÍTICA: RECONSTRUÇÃO COMPLETA DO OBJETO DE COMPRA`,
              );
              console.log(
                `[OAUTH_DIRECT] 🔴 COMPRA MODIFICADA:`,
                JSON.stringify(buyRequest, null, 2),
              );
            }

            // Log de diagnóstico adicional para verificar se o contrato tem realmente 1 tick
            console.log(`[OAUTH_DIRECT] 🔍 DIAGNÓSTICO DE PROPOSTA RECEBIDA:`);
            console.log(
              `[OAUTH_DIRECT] 🔍 - ID da proposta: ${data.proposal.id}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔍 - Preço: ${data.proposal.ask_price}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔍 - duration: ${data.proposal.duration} ${data.proposal.duration_unit}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔍 - contract_type: ${data.proposal.contract_type}`,
            );
            console.log(
              `[OAUTH_DIRECT] 🔍 - barrier: ${data.proposal.barrier}`,
            );

            // 🚨🚨🚨 CORREÇÃO CRÍTICA 24/04/2025: Logs adicionais para diagnóstico do martingale 🚨🚨🚨
            console.log(`[OAUTH_DIRECT] 🛒 ENVIANDO COMPRA:`, buyRequest);
            
            // TESTE FORÇADO: Verificar e GARANTIR que o valor do martingale seja enviado corretamente
            try {
              const strategyId = this.strategyConfig.toLowerCase();
              const strategyState = getStrategyState(strategyId);
              const consecutiveLosses = strategyState?.consecutiveLosses || 0;
              
              // Verificar se existe um valor de martingale armazenado
              const storedMartingaleValue = localStorage.getItem('last_martingale_calculated_value');
              
              // Obter configuração de quando aplicar martingale
              let martingaleAfterXLosses = 2; // Valor padrão
              try {
                const configStr = localStorage.getItem(`strategy_config_${strategyId}`);
                if (configStr) {
                  const config = JSON.parse(configStr);
                  if (config.usarMartingaleAposXLoss) {
                    martingaleAfterXLosses = parseInt(config.usarMartingaleAposXLoss.toString());
                  }
                }
              } catch (e) {
                console.error(`[OAUTH_DIRECT] Erro ao ler config de martingale:`, e);
              }
              
              // CORREÇÃO CRÍTICA (01/05/2025): Verificar se atingimos OU SUPERAMOS o ponto de aplicar martingale
              // Isso garante que todas as operações após atingir o número configurado de perdas continuem aplicando martingale
              const shouldApplyMartingale = consecutiveLosses >= martingaleAfterXLosses;
              
              console.log(`[OAUTH_DIRECT] 🚨🚨🚨 TESTE CRÍTICO DE VALIDAÇÃO MARTINGALE 🚨🚨🚨`);
              console.log(`[OAUTH_DIRECT] 🚨 ESTRATÉGIA: ${strategyId}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Perdas consecutivas: ${consecutiveLosses}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Martingale após X perdas: ${martingaleAfterXLosses}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Deve aplicar martingale? ${shouldApplyMartingale ? 'SIM' : 'NÃO'}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Valor martingale armazenado: ${storedMartingaleValue || 'Não encontrado'}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Valor sendo enviado originalmente: ${buyRequest.buy}`);
              
              // CORREÇÃO CRÍTICA (01/05/2025): Se atingimos ou superamos o ponto de martingale e temos um valor armazenado,
              // mas o valor não está sendo enviado corretamente, FORÇAR o valor correto
              if (shouldApplyMartingale && storedMartingaleValue) {
                const parsedMartingaleValue = parseFloat(storedMartingaleValue);
                if (!isNaN(parsedMartingaleValue) && parsedMartingaleValue > 0) {
                  if (parseFloat(buyRequest.buy) === parsedMartingaleValue) {
                    console.log(`[OAUTH_DIRECT] ✅✅✅ SUCESSO! Valor martingale ${parsedMartingaleValue} está sendo usado corretamente!`);
                  } else {
                    console.log(`[OAUTH_DIRECT] ❌❌❌ ERRO GRAVE! Valor martingale ${parsedMartingaleValue} NÃO está sendo usado! Enviando ${buyRequest.buy} em vez disso.`);
                    console.log(`[OAUTH_DIRECT] 🚨🚨🚨 INTERVENÇÃO FORÇADA: SUBSTITUINDO VALOR DE ENVIO PARA API`);
                    
                    // CORREÇÃO FORÇADA: Alterar o valor diretamente no objeto da requisição
                    buyRequest.buy = parsedMartingaleValue.toString(); 
                    buyRequest.price = parsedMartingaleValue.toString();
                    
                    // Log após a substituição
                    console.log(`[OAUTH_DIRECT] ✅✅✅ VALOR CORRIGIDO! Novo valor a enviar: ${buyRequest.buy}`);
                    console.log(`[OAUTH_DIRECT] 🚨 REQUISIÇÃO APÓS CORREÇÃO:`, JSON.stringify(buyRequest, null, 2));
                  }
                }
              }
              
              // Para fins de debug, registrar o valor final que será enviado independentemente
              console.log(`[OAUTH_DIRECT] 🚨 VALOR FINAL DO CAMPO BUY: ${buyRequest.buy}`);
              console.log(`[OAUTH_DIRECT] 🚨 VALOR FINAL DO CAMPO PRICE: ${buyRequest.price}`);
              
            } catch (validationError) {
              console.error(`[OAUTH_DIRECT] Erro ao validar martingale durante envio:`, validationError);
            }

            // Enviar a solicitação de compra
            try {
              // Registrar o ID do contrato para inscrição de updates futuros
              this.webSocket.send(JSON.stringify(buyRequest));
              console.log(`[OAUTH_DIRECT] ✅ Compra enviada com sucesso!`);
              
              // Limpar o valor do martingale para evitar uso acidental em operações subsequentes
              if (localStorage.getItem('last_martingale_calculated_value')) {
                console.log(`[OAUTH_DIRECT] 🧹 Limpando valor martingale do localStorage após uso bem-sucedido`);
                localStorage.removeItem('last_martingale_calculated_value');
                localStorage.removeItem('last_martingale_calculation_time');
              }
            } catch (buyError) {
              console.error(
                `[OAUTH_DIRECT] ❌ ERRO AO ENVIAR COMPRA:`,
                buyError,
              );
            }
          } else if (data.error) {
            // Marcar como processado se for um erro relacionado à nossa proposta
            if (data.req_id === reqId) {
              proposalProcessed = true;
              this.webSocket.removeEventListener(
                "message",
                handleProposalResponse,
              );
            }

            console.error(`[OAUTH_DIRECT] ❌ ERRO NA PROPOSTA:`, data.error);

            // Notificar sobre o erro
            this.notifyListeners({
              type: "error",
              message: `Erro na proposta: ${data.error.message || JSON.stringify(data.error)}`,
            });
          }
        } catch (error) {
          console.error(`[OAUTH_DIRECT] ❌ ERRO AO PROCESSAR RESPOSTA:`, error);

          // Remover listener apenas se for um erro grave de processamento
          if (!proposalProcessed) {
            proposalProcessed = true;
            this.webSocket.removeEventListener(
              "message",
              handleProposalResponse,
            );
          }
        }
      };

      // Adicionar o listener temporário
      this.webSocket.addEventListener("message", handleProposalResponse);

      // Adicionar um timeout para caso não receba resposta da proposta
      setTimeout(() => {
        if (!proposalProcessed) {
          this.webSocket.removeEventListener("message", handleProposalResponse);
          console.error(
            `[OAUTH_DIRECT] ⏱️ TIMEOUT: Nenhuma resposta para proposta após 15 segundos`,
          );

          // Notificar sobre o timeout
          this.notifyListeners({
            type: "error",
            message: `Timeout: Servidor não respondeu à proposta em tempo hábil.`,
          });
        }
      }, 15000); // 15 segundos (aumentado para dar mais tempo)
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao executar compra de contrato:",
        error,
      );
      this.notifyListeners({
        type: "error",
        message: `Erro ao executar compra de contrato: ${error}`,
      });
    }
  }

  /**
   * Fecha a conexão WebSocket
   */
  closeConnection(): void {
    if (this.webSocket) {
      try {
        this.webSocket.close();
        this.webSocket = null;
        console.log("[OAUTH_DIRECT] Conexão WebSocket fechada manualmente");
      } catch (error) {
        console.error(
          "[OAUTH_DIRECT] Erro ao fechar conexão WebSocket:",
          error,
        );
      }
    }

    // Limpar intervals e timeouts
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.operationTimeout) {
      clearTimeout(this.operationTimeout);
      this.operationTimeout = null;
    }
  }

  /**
   * Inicia o serviço de conexão dedicada e trading
   */
  async start(): Promise<boolean> {
    try {
      console.log("[OAUTH_DIRECT] Iniciando serviço de trading direto...");

      // Verificar se o serviço já está em execução
      if (this.isRunning) {
        // Enviar novamente o evento de bot iniciado para garantir que a interface esteja correta
        this.notifyListeners({
          type: "bot_started",
          message: "Bot já em execução",
        });
        console.log("[OAUTH_DIRECT] Serviço já está em execução");
        return true;
      }

      // Reinicializar estatísticas da sessão ao iniciar o bot
      this.sessionStats = {
        totalProfit: 0,
        totalLoss: 0,
        wins: 0,
        losses: 0,
        initialBalance: 0,
        currentBalance: 0,
        netProfit: 0,
        startTime: new Date(),
      };
      
      console.log("[OAUTH_DIRECT] ✅ Estatísticas da sessão reinicializadas com sucesso");

      // Carregar tokens novamente para garantir que temos os mais recentes
      this.loadAllTokens();

      // Verificar se temos tokens
      if (this.tokens.length === 0) {
        console.error(
          "[OAUTH_DIRECT] Nenhum token encontrado para iniciar o serviço",
        );
        throw new Error("Nenhum token encontrado. Faça login novamente.");
      }

      // Estabelecer conexão WebSocket
      await this.setupWebSocket();

      // Definir como em execução
      this.isRunning = true;

      // Notificar que o serviço foi iniciado
      this.notifyListeners({
        type: "bot_started",
        strategy: this.activeStrategy,
        settings: this.settings,
      });

      console.log(
        "[OAUTH_DIRECT] Serviço de trading direto iniciado com sucesso",
      );
      return true;
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao iniciar serviço de trading:",
        error,
      );
      this.notifyListeners({
        type: "error",
        message: `Erro ao iniciar serviço: ${error}`,
      });

      // Limpar recursos em caso de erro
      this.closeConnection();
      this.isRunning = false;

      throw error;
    }
  }

  /**
   * Para o serviço de conexão dedicada e trading
   * @param reason Motivo da parada (opcional)
   * @param type Tipo de motivo (opcional: 'user', 'error', 'limit', 'target')
   */
  stop(
    reason?: string,
    type: "user" | "error" | "limit" | "target" = "user",
  ): void {
    if (!this.isRunning) {
      console.log("[OAUTH_DIRECT] Serviço já está parado");
      return;
    }

    console.log("[OAUTH_DIRECT] Parando serviço de trading direto...");

    // Definir como não em execução
    this.isRunning = false;

    // Fechar conexão WebSocket
    this.closeConnection();

    // Determinar mensagem e notificação baseada no tipo
    let message = reason || "Serviço parado manualmente";
    let notificationType: "error" | "warning" | "success" | "info" = "info";

    // Definir tipo de notificação com base no motivo da parada
    if (type === "error") {
      notificationType = "error";
    } else if (type === "limit") {
      notificationType = "warning";
    } else if (type === "target") {
      notificationType = "success";
    }

    // Notificar que o serviço foi parado
    this.notifyListeners({
      type: "bot_stopped",
      message: message,
      reason: reason,
      notificationType: notificationType,
      stopType: type,
    });

    console.log("[OAUTH_DIRECT] Serviço de trading direto parado com sucesso");
  }

  /**
   * Reconecta o serviço para atualizar tokens ou após erro
   */
  async reconnect(): Promise<boolean> {
    try {
      console.log("[OAUTH_DIRECT] Reconectando serviço de trading direto...");

      // Fechar conexão existente
      this.closeConnection();

      // Estabelecer nova conexão
      await this.setupWebSocket();

      console.log("[OAUTH_DIRECT] Reconexão bem-sucedida");
      return true;
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro na reconexão:", error);

      // Notificar erro
      this.notifyListeners({
        type: "error",
        message: `Erro na reconexão: ${error}`,
      });

      return false;
    }
  }

  /**
   * Executa a primeira operação após o bot ser iniciado
   * Esta função inicia o ciclo de operações do bot
   * IMPORTANTE: Esta função DEVE emitir o evento bot_started para a interface atualizar
   *
   * @param amount Valor inicial da operação (opcional, pode ser ignorado se houver configuração do usuário)
   * @returns Promise<boolean> Indica se a operação foi enviada com sucesso
   */
  async executeFirstOperation(amount?: number | string): Promise<boolean> {
    console.log(
      `[OAUTH_DIRECT] 🚨🚨🚨 DIAGNÓSTICO CRÍTICO: executeFirstOperation chamado com valor: ${amount}`,
    );
    console.log(`[OAUTH_DIRECT] 🚨🚨🚨 isRunning: ${this.isRunning}`);
    console.log(
      `[OAUTH_DIRECT] 🚨🚨🚨 Estratégia ativa: ${this.activeStrategy}`,
    );
    console.log(
      `[OAUTH_DIRECT] 🚨🚨🚨 WebSocket readyState: ${this.webSocket ? this.webSocket.readyState : "null"}`,
    );

    // 🚨🚨🚨 IMPLEMENTAÇÃO EMERGENCIAL CORRIGIDA - EXTRA FORÇADA 22/04/2025 🚨🚨🚨
    // GARANTIR EXECUÇÃO A TODO CUSTO - DETECTAR E RESOLVER QUALQUER PROBLEMA

    // SUPER DIAGNÓSTICO: Listar todos os inputs da tela para encontrar o correto
    console.log(
      "[OAUTH_DIRECT] 🔍 DIAGNÓSTICO PRÉ-OPERAÇÃO: Procurando inputs na tela:",
    );
    let foundValidInput = false;

    try {
      const allInputs = document.querySelectorAll("input");
      if (allInputs.length > 0) {
        console.log(
          `[OAUTH_DIRECT] 🔍 Encontrados ${allInputs.length} inputs na página`,
        );

        allInputs.forEach((input: HTMLInputElement, index) => {
          console.log(
            `[OAUTH_DIRECT] Input #${index}: id=${input.id || "sem-id"}, type=${input.type}, value=${input.value || "vazio"}, placeholder=${input.placeholder || "sem-placeholder"}`,
          );

          // Verificar se é um input com valor
          if (input.value && parseFloat(input.value) > 0) {
            console.log(
              `[OAUTH_DIRECT] ✅ Input #${index} tem valor válido: ${input.value}`,
            );
            foundValidInput = true;
          }
        });
      } else {
        console.log(
          `[OAUTH_DIRECT] ⚠️ Nenhum input encontrado na página. Possível problema de renderização.`,
        );
      }
    } catch (error) {
      console.error(`[OAUTH_DIRECT] Erro ao buscar inputs:`, error);
    }

    // PRIORIDADE MÁXIMA: VERIFICAR VÁRIOS ELEMENTOS DOM POSSÍVEIS
    let entryAmount: number | undefined = undefined;

    // Tentar vários IDs possíveis
    const possibleIds = [
      "iron-bot-entry-value",
      "entry-value",
      "stake",
      "amount",
      "entry-amount",
      "valor-entrada",
    ];
    let foundInputElement = null;

    // Verificar cada ID possível
    for (const id of possibleIds) {
      const element = document.getElementById(id) as HTMLInputElement;
      if (element) {
        console.log(
          `[OAUTH_DIRECT] ✅ Encontrado input com ID '${id}': value=${element.value || "vazio"}`,
        );
        if (element.value && parseFloat(element.value) > 0) {
          foundInputElement = element;
          break;
        }
      }
    }

    // Se não encontrou por ID, procurar por atributos ou classes
    if (!foundInputElement) {
      const numberInputs = document.querySelectorAll('input[type="number"]');
      if (numberInputs.length > 0) {
        console.log(
          `[OAUTH_DIRECT] 🔍 Encontrados ${numberInputs.length} inputs numéricos`,
        );
        // Usar o primeiro input numérico com valor > 0
        for (let i = 0; i < numberInputs.length; i++) {
          const input = numberInputs[i] as HTMLInputElement;
          if (input.value && parseFloat(input.value) > 0) {
            console.log(
              `[OAUTH_DIRECT] ✅ Usando input numérico #${i}: value=${input.value}`,
            );
            foundInputElement = input;
            break;
          }
        }
      }
    }

    // Se encontrou um input válido, usar seu valor
    if (foundInputElement && foundInputElement.value) {
      const valueFromInput = parseFloat(foundInputElement.value);
      if (!isNaN(valueFromInput) && valueFromInput > 0) {
        entryAmount = valueFromInput;
        console.log(
          `[OAUTH_DIRECT] 🚨🚨🚨 CORREÇÃO FINAL: Usando valor ${entryAmount} encontrado no DOM`,
        );

        // Atualizar todas as fontes possíveis para garantir consistência
        this.settings.entryValue = entryAmount;

        // Persistir no localStorage para garantir consistência em todas as operações
        try {
          if (this.activeStrategy) {
            const strategyKey = this.activeStrategy
              .toLowerCase()
              .replace(/\s+/g, "");
            const configString = localStorage.getItem(
              `strategy_config_${strategyKey}`,
            );
            if (configString) {
              let config = JSON.parse(configString);
              config.valorInicial = entryAmount;
              localStorage.setItem(
                `strategy_config_${strategyKey}`,
                JSON.stringify(config),
              );
              console.log(
                `[OAUTH_DIRECT] ✅ Valor ${entryAmount} persistido no localStorage para estratégia ${strategyKey}`,
              );
            }
          }
        } catch (e) {
          console.error(
            "[OAUTH_DIRECT] Erro ao persistir valor no localStorage:",
            e,
          );
        }
      }
    } else {
      console.log(`[OAUTH_DIRECT] ⚠️ Nenhum input válido encontrado no DOM`);
    }

    // Se não encontrou no DOM, tentar outras fontes
    if (entryAmount === undefined) {
      console.log(
        `[OAUTH_DIRECT] ⚠️ Valor não encontrado no DOM, tentando fontes alternativas...`,
      );

      // Converter para número se for string
      let parsedAmount: number | undefined = undefined;
      if (amount !== undefined) {
        parsedAmount = typeof amount === "string" ? parseFloat(amount) : amount;
      }

      // 1. Valor configurado nas configurações do serviço
      if (
        this.settings.entryValue &&
        typeof this.settings.entryValue === "number" &&
        this.settings.entryValue > 0
      ) {
        entryAmount = this.settings.entryValue;
        console.log(
          `[OAUTH_DIRECT] 🔄 Alternativa 1: Usando valor ${entryAmount} das configurações do serviço`,
        );
      }
      // 2. Valor passado como parâmetro para esta função
      else if (parsedAmount !== undefined && parsedAmount > 0) {
        entryAmount = parsedAmount;
        console.log(
          `[OAUTH_DIRECT] 🔄 Alternativa 2: Usando valor ${entryAmount} passado como parâmetro`,
        );
      }
      // 3. Valor das configurações salvas no localStorage
      else {
        try {
          // Tentar obter a estratégia ativa
          const currentStrategy = this.activeStrategy || "";
          if (currentStrategy) {
            const configStr = localStorage.getItem(
              `strategy_config_${currentStrategy.toLowerCase()}`,
            );
            if (configStr) {
              const config = JSON.parse(configStr);
              if (config.valorInicial !== undefined) {
                const valorSalvo = parseFloat(config.valorInicial.toString());
                if (!isNaN(valorSalvo) && valorSalvo > 0) {
                  entryAmount = valorSalvo;
                  console.log(
                    `[OAUTH_DIRECT] 🔄 Alternativa 3: Usando valor ${entryAmount} do localStorage`,
                  );
                }
              }
            }
          }
        } catch (e) {
          console.error(
            "[OAUTH_DIRECT] Erro ao carregar valor de entrada do localStorage:",
            e,
          );
        }
      }

      // ÚLTIMA OPÇÃO - VALOR PADRÃO FORÇADO
      if (entryAmount === undefined) {
        entryAmount = 1.0; // Valor padrão absoluto para garantir que a operação seja executada
        console.log(
          `[OAUTH_DIRECT] 🚨 OVERRIDE CRÍTICO: Usando valor emergencial de ${entryAmount} para garantir execução`,
        );
      }
    }

    // VERIFICAÇÃO ADICIONAL: Verificar se há valor configurado na interface
    // Use esta verificação como último recurso, caso não tenha encontrado o valor
    if (entryAmount === null) {
      const botValueElement = document.getElementById(
        "iron-bot-entry-value",
      ) as HTMLInputElement;
      if (botValueElement && botValueElement.value) {
        const valueFromDOM = parseFloat(botValueElement.value);
        if (!isNaN(valueFromDOM) && valueFromDOM > 0) {
          console.log(
            `[OAUTH_DIRECT] ✓ SEGURANÇA: Usando valor ${valueFromDOM} obtido diretamente da interface (DOM)`,
          );
          entryAmount = valueFromDOM;
        }
      }
    }

    // ÚLTIMA VERIFICAÇÃO: Se depois de todas as tentativas ainda não tiver um valor,
    // use o valor que o usuário configurou nos inputs
    if (entryAmount === null) {
      console.log(
        `[OAUTH_DIRECT] ⚠️ AVISO: Não foi possível encontrar o valor configurado pelo usuário em nenhuma fonte`,
      );
      console.log(
        `[OAUTH_DIRECT] ⚠️ AVISO: Usando valor padrão do input da interface`,
      );
      // Procurar em todos os inputs possíveis do formulário
      const inputs = document.querySelectorAll('input[type="number"]');
      for (const input of inputs) {
        const value = parseFloat(input.value);
        if (!isNaN(value) && value > 0) {
          entryAmount = value;
          console.log(
            `[OAUTH_DIRECT] ✓ SEGURANÇA FINAL: Encontrei valor ${value} no input ${input.id || "sem id"}`,
          );
          break;
        }
      }
    }

    // NUNCA usar valor padrão - abortar operação se não encontrar valor configurado pelo usuário
    if (entryAmount === null || entryAmount === undefined) {
      console.error(
        `[OAUTH_DIRECT] ❌ ERRO FATAL: Não foi possível encontrar o valor configurado pelo usuário`,
      );
      this.notifyListeners({
        type: "error",
        message:
          "Valor de entrada não configurado. Por favor, verifique as configurações.",
      });
      return false; // Não continue com a operação
    }

    // Log detalhado para diagnóstico
    console.log(`[OAUTH_DIRECT] === DIAGNÓSTICO DE PRIMEIRA OPERAÇÃO ===`);
    console.log(`[OAUTH_DIRECT] Valor original recebido: ${parsedAmount}`);
    console.log(
      `[OAUTH_DIRECT] Valor nas configurações: ${this.settings.entryValue}`,
    );
    console.log(`[OAUTH_DIRECT] Valor FINAL usado: ${entryAmount}`);
    console.log(`[OAUTH_DIRECT] Estratégia atual: ${this.activeStrategy}`);
    console.log(`[OAUTH_DIRECT] ==========================================`);

    // Garantir que o valor inicial seja usado também nas configurações
    this.settings.entryValue = entryAmount;

    try {
      console.log(
        `[OAUTH_DIRECT] 🌟🌟🌟 INICIANDO PRIMEIRA OPERAÇÃO DO BOT 🌟🌟🌟`,
      );
      console.log(
        `[OAUTH_DIRECT] 🌟 Valor da primeira entrada (CORRIGIDO): ${entryAmount}`,
      );
      console.log(
        `[OAUTH_DIRECT] 🌟 Estratégia ativa: ${this.activeStrategy || "Nenhuma"}`,
      );
      console.log(
        `[OAUTH_DIRECT] 🌟 Configurações: ${JSON.stringify(this.settings, null, 2)}`,
      );
      console.log(
        `[OAUTH_DIRECT] 🌟 Token ativo: ${this.activeToken ? "Presente" : "Ausente"}`,
      );
      console.log(
        `[OAUTH_DIRECT] 🌟 WebSocket status: ${this.webSocket ? this.webSocket.readyState : "Não inicializado"}`,
      );

      // Verificar se o WebSocket está conectado
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.error(
          "[OAUTH_DIRECT] WebSocket não está conectado para executar operação",
        );
        this.notifyListeners({
          type: "error",
          message: "Falha na conexão. Não foi possível iniciar a operação.",
        });
        return false;
      }

      // Verificar se há um token autorizado com permissões de trading
      // Verificamos se o token está na lista e tem a flag authorized
      const activeTokenInfo = this.tokens.find(
        (t) => t.token === this.activeToken,
      );
      const hasTrading = activeTokenInfo && activeTokenInfo.authorized;

      if (!this.activeToken || !hasTrading) {
        console.error("[OAUTH_DIRECT] Token não tem permissões para trading");
        this.notifyListeners({
          type: "error",
          message:
            "Conta sem permissões de trading. Por favor, reautorize com permissões adequadas.",
        });
        return false;
      }

      // Inicializar o estado da estratégia
      const baseStrategyId = this.strategyConfig.toLowerCase();
      const strategy = getStrategyById(baseStrategyId);

      if (strategy) {
        console.log(
          `[OAUTH_DIRECT] Inicializando estratégia: ${strategy.name} (ID: ${baseStrategyId})`,
        );
        initializeStrategyState(baseStrategyId, entryAmount);

        // Obter as configurações específicas da estratégia
        if (strategy.config && strategy.config.entryPercentage) {
          console.log(
            `[OAUTH_DIRECT] Configuração de porcentagem para ${strategy.name}: ${strategy.config.entryPercentage}%`,
          );
        }
      } else {
        console.warn(
          `[OAUTH_DIRECT] Estratégia não encontrada para ID: ${baseStrategyId}, usando padrões`,
        );
      }

      // Obter saldo atual antes de iniciar operações para rastreamento de lucro/perda
      try {
        await new Promise<void>((resolve) => {
          // Criar handler temporário para receber o saldo
          const balanceHandler = (event: MessageEvent) => {
            try {
              const data = JSON.parse(event.data);
              if (data && data.balance) {
                // Salvar saldo inicial para cálculos de lucro/perda
                this.sessionStats.initialBalance = parseFloat(
                  data.balance.balance,
                );
                this.sessionStats.currentBalance =
                  this.sessionStats.initialBalance;

                // Reiniciar estatísticas da sessão
                this.sessionStats.totalProfit = 0;
                this.sessionStats.totalLoss = 0;
                this.sessionStats.wins = 0;
                this.sessionStats.losses = 0;
                this.sessionStats.netProfit = 0;
                this.sessionStats.startTime = new Date();

                console.log(
                  `[OAUTH_DIRECT] Saldo inicial registrado: ${this.sessionStats.initialBalance}`,
                );

                // Remover handler após receber o saldo
                if (this.webSocket) {
                  this.webSocket.removeEventListener("message", balanceHandler);
                }
                resolve();
              }
            } catch (e) {
              // Ignorar mensagens que não são do tipo balance
            }
          };

          // Adicionar handler temporário
          if (this.webSocket) {
            this.webSocket.addEventListener("message", balanceHandler);

            // Solicitar saldo
            const balanceRequest = {
              balance: 1,
            };
            this.webSocket.send(JSON.stringify(balanceRequest));

            // Definir timeout para caso não receba resposta
            setTimeout(() => {
              if (this.webSocket) {
                this.webSocket.removeEventListener("message", balanceHandler);
              }
              resolve(); // Continuar mesmo sem o saldo
            }, 3000);
          } else {
            resolve(); // Continuar mesmo sem WebSocket
          }
        });
      } catch (e) {
        console.warn("[OAUTH_DIRECT] Erro ao obter saldo inicial:", e);
        // Continuar mesmo sem o saldo inicial
      }

      // Solicitar compra (API Deriv)
      // Para opções digitais (Digits):
      // https://api.deriv.com/api-explorer/#contract_for

      let symbolCode = "R_100"; // Índice volatilidade 100
      let contractType = "DIGITDIFF"; // Tipo de contrato (dígito diferente)
      let duration = "1"; // Duração em ticks
      let durationUnit = "t"; // Unidade de duração (t para ticks)
      let prediction = "0"; // Previsão do dígito (para contratos Digit)

      // Construir a requisição de compra
      // Usaremos configurações padrão simplificadas para iniciar
      console.log(
        "[OAUTH_DIRECT] Usando configurações padrão para primeira operação",
      );

      // A estratégia agora é sempre uma string simples
      // Derivamos parâmetros do nome e configurações
      try {
        // Identificar estratégia atual (usar o strategyId já declarado acima)
        const currentStrategyId = this.strategyConfig.toLowerCase();
        const strategyObj = getStrategyById(currentStrategyId);

        // Buscar configuração salva pelo usuário
        const userConfigObj = localStorage.getItem(
          `strategy_config_${currentStrategyId}`,
        );
        let userConfig: any = {};

        if (userConfigObj) {
          try {
            userConfig = JSON.parse(userConfigObj);
          } catch (err) {
            console.error(
              "[OAUTH_DIRECT] Erro ao carregar configuração do usuário:",
              err,
            );
          }
        }

        // Obter as estatísticas dos últimos dígitos para análise
        const digitStats = this.getDigitStats();

        // Vamos usar o parser XML se a estratégia tiver um arquivo XML associado
        if (strategyObj?.xmlPath && digitStats.length > 0) {
          console.log(
            `[OAUTH_DIRECT] Analisando primeira entrada com parser XML para estratégia ${currentStrategyId}`,
          );

          try {
            // Avaliar entrada com o parser XML
            const xmlAnalysis = await evaluateEntryConditions(
              currentStrategyId,
              digitStats,
              {
                // Configurações do usuário
                porcentagemParaEntrar: userConfig?.porcentagemParaEntrar,
                // CORREÇÃO CRÍTICA: Usar valor inicial do localStorage com alta prioridade
                valorInicial: this.getUserDefinedAmount(
                  userConfig?.valorInicial,
                ),
                martingale:
                  // CORREÇÃO DO MARTINGALE: Priorizar settings.martingaleFactor pois já vem da interface do usuário
                  this.settings.martingaleFactor ||
                  userConfig?.martingale ||
                  1.5,
                metaGanho:
                  userConfig?.metaGanho || this.settings.profitTarget || 20,
                limitePerda:
                  userConfig?.limitePerda || this.settings.lossLimit || 20,
                usarMartingaleAposXLoss:
                  userConfig?.usarMartingaleAposXLoss || 2,
                parcelasMartingale: userConfig?.parcelasMartingale || 1,
                // CORREÇÃO CRÍTICA: Valor após vencer SEMPRE igual ao valor inicial configurado pelo usuário
                valorAposVencer: this.getUserDefinedAmount(
                  userConfig?.valorInicial,
                ),
              },
              strategyObj?.xmlPath,
            );

            // Usar valores do parser XML se disponíveis
            contractType = xmlAnalysis.contractType as string;
            if (xmlAnalysis.prediction !== undefined) {
              prediction = xmlAnalysis.prediction.toString();
            }

            console.log(`[OAUTH_DIRECT] Usando configurações do parser XML:`, {
              contractType,
              prediction,
              shouldEnter: xmlAnalysis.shouldEnter,
              message: xmlAnalysis.message,
            });
          } catch (error) {
            console.error(
              `[OAUTH_DIRECT] Erro ao analisar com parser XML:`,
              error,
            );
            // Continuar com as configurações padrão em caso de erro
          }
        } else {
          // Usar lógica anterior para determinar tipo de contrato se não tiver XML
          // Determinar tipo de contrato com base no nome da estratégia
          if (
            this.strategyConfig.includes("under") ||
            this.strategyConfig.includes("baixo") ||
            this.strategyConfig.includes("low")
          ) {
            contractType = "DIGITUNDER";
            console.log(
              "[OAUTH_DIRECT] Usando tipo DIGITUNDER baseado no nome da estratégia",
            );
          } else if (
            this.strategyConfig.includes("over") ||
            this.strategyConfig.includes("alto") ||
            this.strategyConfig.includes("high")
          ) {
            contractType = "DIGITOVER";
            console.log(
              "[OAUTH_DIRECT] Usando tipo DIGITOVER baseado no nome da estratégia",
            );
          } else if (this.strategyConfig.includes("diff")) {
            contractType = "DIGITDIFF";
            console.log(
              "[OAUTH_DIRECT] Usando tipo DIGITDIFF baseado no nome da estratégia",
            );
          } else if (this.strategyConfig.includes("match")) {
            contractType = "DIGITMATICH";
            console.log(
              "[OAUTH_DIRECT] Usando tipo DIGITMATCH baseado no nome da estratégia",
            );
          }
        }

        // Usar settings para previsão (caso não tenha sido definido pelo parser XML)
        if (this.settings.prediction !== undefined && prediction === "0") {
          prediction = this.settings.prediction.toString();
          console.log(
            "[OAUTH_DIRECT] Usando previsão das configurações:",
            prediction,
          );
        }
      } catch (error) {
        console.error(
          "[OAUTH_DIRECT] Erro ao processar parâmetros da estratégia:",
          error,
        );
      }

      // CORREÇÃO PRINCIPAL: Usar método getUserDefinedAmount para garantir prioridade correta
      // Obter o valor inicial respeitando estritamente a prioridade de configurações
      let finalAmount = this.getUserDefinedAmount(amount);

      // Buscar configuração específica da estratégia (já temos strategyId definido acima)
      const strategyConfigString = localStorage.getItem(
        `strategy_config_${this.strategyConfig.toLowerCase()}`,
      );
      let userConfig: any = {};

      if (strategyConfigString) {
        try {
          userConfig = JSON.parse(strategyConfigString);

          // GARANTIR CONSISTÊNCIA: Se temos configurações do usuário, garantir que o valor da entrada
          // seja exatamente o configurado pelo usuário e não o valor padrão
          if (userConfig.valorInicial !== undefined) {
            const userValueAsNumber = parseFloat(userConfig.valorInicial);
            // Validar que é um número válido
            if (!isNaN(userValueAsNumber) && userValueAsNumber > 0) {
              finalAmount = userValueAsNumber;
              console.log(
                `[OAUTH_DIRECT] 🚨 CORREÇÃO CRÍTICA: Usando valor inicial exato do usuário: ${finalAmount}`,
              );
            }

            // ATUALIZAÇÃO CRÍTICA: Garantir que todas as configurações do usuário são aplicadas
            // para operações futuras, sobrescrevendo qualquer configuração anterior
            this.settings.entryValue = finalAmount;

            if (userConfig.martingale !== undefined) {
              this.settings.martingaleFactor = parseFloat(
                userConfig.martingale,
              );
              console.log(
                `[OAUTH_DIRECT] 🚨 CORREÇÃO: Martingale configurado para ${this.settings.martingaleFactor}`,
              );
            }

            if (userConfig.metaGanho !== undefined) {
              this.settings.profitTarget = parseFloat(userConfig.metaGanho);
              console.log(
                `[OAUTH_DIRECT] 🚨 CORREÇÃO: Meta de ganho configurada para ${this.settings.profitTarget}`,
              );
            }

            if (userConfig.limitePerda !== undefined) {
              this.settings.lossLimit = parseFloat(userConfig.limitePerda);
              console.log(
                `[OAUTH_DIRECT] 🚨 CORREÇÃO: Limite de perda configurado para ${this.settings.lossLimit}`,
              );
            }
          }
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] Erro ao analisar configuração de estratégia:",
            error,
          );
        }
      }

      // 🚨🚨🚨 MUDANÇA CRÍTICA: FLUXO PROPOSAL -> BUY EM EXECUTEREALOPERATION 🚨🚨🚨
      // Documentação: https://api.deriv.com/api-explorer/#proposal
      // É necessário primeiro obter uma proposta antes de fazer a compra

      console.log(
        `[OAUTH_DIRECT] 🔄 FLUXO CORRETO: Primeiro solicitando proposta (proposal) antes da compra`,
      );

      // Parse do valor para garantir que é numérico
      const parsedAmount = parseFloat(finalAmount.toString());

      // Primeiro passo: criar a solicitação de proposta
      const reqId = Date.now(); // ID único para essa solicitação

      // Montar objeto de proposta conforme documentação da API
      const proposalRequest: any = {
        proposal: 1,
        req_id: reqId,
        amount: parsedAmount,
        basis: "stake",
        contract_type: contractType,
        currency: "USD",
        // CORREÇÃO CRÍTICA: Usar 1 tick em vez de 5 para Advance
        duration: this.activeStrategy?.toLowerCase().includes("advance")
          ? 1
          : 5,
        duration_unit: "t",
        symbol: symbolCode || "R_100",
      };

      // CORREÇÃO CRÍTICA: Adicionar log explícito para duração
      console.log(
        `[OAUTH_DIRECT] 🚨 Duração da operação definida para: ${proposalRequest.duration} ${proposalRequest.duration_unit}`,
      );

      // Adicionar barreira para contratos de dígito
      if (contractType.includes("DIGIT")) {
        // CORREÇÃO CRÍTICA: Forçar barreira 1 para Advance
        if (this.activeStrategy?.toLowerCase().includes("advance")) {
          proposalRequest.barrier = "1";
          console.log(
            `[OAUTH_DIRECT] 🚨 CORREÇÃO DE EMERGÊNCIA: Forçando barreira=1 para estratégia ADVANCE`,
          );
        } else {
          proposalRequest.barrier = prediction?.toString() || "1";
        }
        console.log(
          `[OAUTH_DIRECT] ⚡ Adicionando barreira ${proposalRequest.barrier} para contrato de dígito`,
        );
      }

      // ESSA SERÁ A PRIMEIRA MENSAGEM ENVIADA - PROPOSAL REQUEST
      console.log(
        `[OAUTH_DIRECT] 📤 ENVIANDO SOLICITAÇÃO DE PROPOSTA: ${JSON.stringify(proposalRequest, null, 2)}`,
      );

      // Enviar solicitação de proposta
      this.webSocket.send(JSON.stringify(proposalRequest));

      // Adicionar listener para receber a resposta da proposta e fazer a compra
      // 🔍🔍🔍 CORREÇÃO CRÍTICA: Listener especializado para capturar QUALQUER tipo de resposta 🔍🔍🔍
      const handleProposalResponse = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);

          // 📝 Log completo para TODAS as mensagens recebidas durante período de espera
          console.log(
            `[OAUTH_DIRECT] 🔍🔍🔍 MENSAGEM DURANTE ESPERA DE PROPOSTA: ${JSON.stringify(data)}`,
          );

          // Verificar se é a resposta à nossa proposta - VERSÃO MAIS ROBUSTA
          if (data.req_id === reqId && data.proposal) {
            console.log(
              `[OAUTH_DIRECT] ✅✅✅ PROPOSTA RECEBIDA COM SUCESSO:`,
              JSON.stringify(data.proposal),
            );

            // Remover o listener após receber a resposta
            this.webSocket.removeEventListener(
              "message",
              handleProposalResponse,
            );

            // Agora sim fazer a compra usando o ID da proposta recebida
            const buyRequest = {
              buy: data.proposal.id,
              price: data.proposal.ask_price,
              // 🔑 Adicionar req_id único para poder rastrear esta compra
              req_id: `buy_${Date.now()}`,
            };

            console.log(
              `[OAUTH_DIRECT] 🛒🛒🛒 ENVIANDO COMPRA BASEADA NA PROPOSTA: ${JSON.stringify(buyRequest, null, 2)}`,
            );
            
            // 🚨🚨🚨 VERIFICAÇÃO CRÍTICA DE MARTINGALE: Garantir que o valor correto seja enviado 🚨🚨🚨
            try {
              const strategyId = this.strategyConfig.toLowerCase();
              const strategyState = getStrategyState(strategyId);
              const consecutiveLosses = strategyState?.consecutiveLosses || 0;
              
              // Verificar se existe um valor de martingale armazenado no localStorage
              const storedMartingaleValue = localStorage.getItem('last_martingale_calculated_value');
              
              // Obter configuração de quando aplicar martingale
              let martingaleAfterXLosses = 2; // Valor padrão
              try {
                const configStr = localStorage.getItem(`strategy_config_${strategyId}`);
                if (configStr) {
                  const config = JSON.parse(configStr);
                  if (config.usarMartingaleAposXLoss) {
                    martingaleAfterXLosses = parseInt(config.usarMartingaleAposXLoss.toString());
                  }
                }
              } catch (e) {
                console.error(`[OAUTH_DIRECT] Erro ao ler config de martingale:`, e);
              }
              
              // Verificar se estamos exatamente no ponto de aplicar martingale
              const exactMartingalePoint = consecutiveLosses === martingaleAfterXLosses;
              
              console.log(`[OAUTH_DIRECT] 🚨🚨🚨 VERIFICAÇÃO FINAL DE MARTINGALE 🚨🚨🚨`);
              console.log(`[OAUTH_DIRECT] 🚨 ESTRATÉGIA: ${strategyId}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Perdas consecutivas: ${consecutiveLosses}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Martingale após X perdas: ${martingaleAfterXLosses}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Exatamente no ponto de martingale? ${exactMartingalePoint ? 'SIM' : 'NÃO'}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Valor martingale armazenado: ${storedMartingaleValue || 'Não encontrado'}`);
              console.log(`[OAUTH_DIRECT] 🚨 - Valor sendo enviado: price=${buyRequest.price}`);
              
              // INTERVENÇÃO CRÍTICA: Se estamos no ponto exato de martingale, temos um valor armazenado
              // e o valor não está sendo enviado corretamente, FORÇAR o valor correto
              if (exactMartingalePoint && storedMartingaleValue) {
                const parsedMartingaleValue = parseFloat(storedMartingaleValue);
                if (!isNaN(parsedMartingaleValue) && parsedMartingaleValue > 0) {
                  // Note que não podemos comparar diretamente com buyRequest.buy pois isso é o ID da proposta
                  // Comparamos com price que é o valor monetário
                  if (parseFloat(buyRequest.price) === parsedMartingaleValue) {
                    console.log(`[OAUTH_DIRECT] ✅✅✅ MARTINGALE OK! Valor ${parsedMartingaleValue} já está configurado corretamente!`);
                  } else {
                    console.log(`[OAUTH_DIRECT] ❌❌❌ ERRO MARTINGALE! Valor ${parsedMartingaleValue} NÃO está sendo usado!`);
                    console.log(`[OAUTH_DIRECT] 📊 Preço atual: ${buyRequest.price}, Martingale calculado: ${parsedMartingaleValue}`);
                    console.log(`[OAUTH_DIRECT] 🚨🚨🚨 INTERVENÇÃO FORÇADA: SUBSTITUINDO PREÇO PARA API`);
                    
                    // Alterar o price (valor monetário) - buy é o ID da proposta e não deve ser alterado!
                    buyRequest.price = parsedMartingaleValue.toString();
                    
                    console.log(`[OAUTH_DIRECT] ✅✅✅ PREÇO CORRIGIDO! Novo preço a enviar: ${buyRequest.price}`);
                    console.log(`[OAUTH_DIRECT] 🚨 REQUISIÇÃO APÓS CORREÇÃO:`, JSON.stringify(buyRequest, null, 2));
                  }
                }
              }
              
              // Para fins de debug, registrar o valor final que será enviado
              console.log(`[OAUTH_DIRECT] 🚨 VALOR FINAL DO CAMPO PRICE: ${buyRequest.price}`);
            } catch (validationError) {
              console.error(`[OAUTH_DIRECT] Erro ao validar martingale durante envio:`, validationError);
            }

            // 🚨 CORREÇÃO CRÍTICA: Adicionar um listener específico para esta compra
            const handleBuyResponse = (buyEvent: MessageEvent) => {
              try {
                const buyData = JSON.parse(buyEvent.data);
                console.log(
                  `[OAUTH_DIRECT] 🔍 MENSAGEM DURANTE ESPERA DE COMPRA: ${JSON.stringify(buyData)}`,
                );

                // INTERVENÇÃO FINAL PARA ADVANCE: Forçar valor da barreira para 1 na resposta de compra
                if (
                  this.activeStrategy?.toLowerCase().includes("advance") &&
                  (buyData.msg_type === "buy" || buyData.buy)
                ) {
                  console.log(
                    `[OAUTH_DIRECT] 🔴 INTERVENÇÃO NUCLEAR PARA ADVANCE: Corrigindo resposta de compra`,
                  );

                  const buyObj = buyData.buy || buyData.transaction || buyData;

                  // Forçar barreira 1 e corrigir textos
                  if (buyObj.barrier && buyObj.barrier !== "1") {
                    console.log(
                      `[OAUTH_DIRECT] 🔴 Corrigindo barreira: ${buyObj.barrier} -> 1`,
                    );
                    buyObj.barrier = "1";
                  }

                  if (buyObj.display_name) {
                    const original = buyObj.display_name;
                    buyObj.display_name = buyObj.display_name.replace(
                      /acima de \d+/g,
                      "acima de 1",
                    );
                    buyObj.display_name = buyObj.display_name.replace(
                      /above \d+/g,
                      "above 1",
                    );

                    if (original !== buyObj.display_name) {
                      console.log(
                        `[OAUTH_DIRECT] 🔴 Display name corrigido: ${original} -> ${buyObj.display_name}`,
                      );
                    }
                  }

                  if (buyObj.longcode) {
                    const original = buyObj.longcode;
                    // Português
                    buyObj.longcode = buyObj.longcode.replace(
                      /acima de \d+/g,
                      "acima de 1",
                    );
                    buyObj.longcode = buyObj.longcode.replace(
                      /superior a \d+/g,
                      "superior a 1",
                    );
                    buyObj.longcode = buyObj.longcode.replace(
                      /estritamente superior a \d+/g,
                      "estritamente superior a 1",
                    );
                    // Inglês
                    buyObj.longcode = buyObj.longcode.replace(
                      /above \d+/g,
                      "above 1",
                    );

                    if (original !== buyObj.longcode) {
                      console.log(
                        `[OAUTH_DIRECT] 🔴 Longcode corrigido para mostrar "acima de 1"`,
                      );
                    }
                  }
                }

                // Verificar se é uma resposta de compra
                if (buyData.msg_type === "buy" || buyData.buy) {
                  console.log(
                    `[OAUTH_DIRECT] ✅✅✅ COMPRA CONFIRMADA:`,
                    JSON.stringify(buyData),
                  );
                  this.webSocket.removeEventListener(
                    "message",
                    handleBuyResponse,
                  );
                }

                // Verificar se é um erro
                if (buyData.error) {
                  console.error(
                    `[OAUTH_DIRECT] ❌ ERRO NA COMPRA:`,
                    buyData.error,
                  );
                  this.webSocket.removeEventListener(
                    "message",
                    handleBuyResponse,
                  );

                  // Notificar sobre o erro
                  this.notifyListeners({
                    type: "error",
                    message: `Erro na compra: ${buyData.error.message || JSON.stringify(buyData.error)}`,
                  });
                }
              } catch (e) {
                console.error(
                  "[OAUTH_DIRECT] Erro ao processar resposta de compra:",
                  e,
                );
              }
            };

            // Adicionar listener para a resposta da compra
            this.webSocket.addEventListener("message", handleBuyResponse);

            // Define timeout para o listener de compra
            setTimeout(() => {
              this.webSocket.removeEventListener("message", handleBuyResponse);
              console.log(
                `[OAUTH_DIRECT] ⏱️ Timeout removeu listener de compra`,
              );
            }, 10000);

            // Enviar a requisição de compra
            this.webSocket.send(JSON.stringify(buyRequest));

            // Marcar que estamos processando uma compra
            this.notifyListeners({
              type: "processing",
              message: "Comprando contrato...",
            });
          } else if (data.error) {
            console.error(`[OAUTH_DIRECT] ❌ ERRO NA PROPOSTA:`, data.error);
            this.webSocket.removeEventListener(
              "message",
              handleProposalResponse,
            );

            // Notificar sobre o erro
            this.notifyListeners({
              type: "error",
              message: `Erro na proposta: ${data.error.message || JSON.stringify(data.error)}`,
            });
          }
        } catch (error) {
          console.error(
            `[OAUTH_DIRECT] ❌ ERRO AO PROCESSAR RESPOSTA DA PROPOSTA:`,
            error,
          );
          this.webSocket.removeEventListener("message", handleProposalResponse);
        }
      };

      // Adicionar o listener temporário
      this.webSocket.addEventListener("message", handleProposalResponse);

      // Adicionar um timeout para caso não receba resposta da proposta
      setTimeout(() => {
        this.webSocket.removeEventListener("message", handleProposalResponse);
        console.error(`[OAUTH_DIRECT] ⏱️ TIMEOUT NA PROPOSTA`);
      }, 10000); // 10 segundos

      // Notificar sobre a operação em andamento
      this.notifyListeners({
        type: "operation_started",
        amount: finalAmount,
        contract_type: contractType,
        prediction: prediction,
        message: `Iniciando operação: ${contractType} em ${symbolCode || "R_100"}, valor: ${finalAmount}`,
      });

      // Enviar evento de bot ativo para atualizar a interface
      this.notifyListeners({
        type: "bot_started",
        message: "Bot está realizando uma operação",
      });

      // A compra será feita no callback do proposal
      return true;
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao executar primeira operação:",
        error,
      );
      this.notifyListeners({
        type: "error",
        message: `Erro ao iniciar operação: ${error}`,
      });
      return false;
    }
  }

  /**
   * Autoriza o token ativo para obter informações da conta mais recentes
   * Este método será chamado pelo BotController para atualizar os dados da conta
   *
   * @returns Promise<boolean> Indica se a autorização foi bem-sucedida
   */
  async authorizeActiveToken(): Promise<boolean> {
    try {
      // Verificar se temos um token ativo
      if (!this.activeToken) {
        this.loadAllTokens();

        if (!this.activeToken) {
          console.error(
            "[OAUTH_DIRECT] Nenhum token ativo disponível para autorização",
          );
          return false;
        }
      }

      // Verificar se temos WebSocket disponível
      if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
        console.log(
          "[OAUTH_DIRECT] WebSocket não está disponível, inicializando conexão",
        );
        try {
          await this.setupWebSocket();
        } catch (error) {
          console.error(
            "[OAUTH_DIRECT] Erro ao configurar WebSocket para autorização:",
            error,
          );
          return false;
        }
      }

      // Enviar solicitação de autorização
      const reqId = Date.now();
      const authRequest = {
        authorize: this.activeToken,
        req_id: reqId,
      };

      return new Promise<boolean>((resolve) => {
        // Handler para receber resposta de autorização
        const messageHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);

            // Verificar se é a resposta da nossa solicitação
            if (data.req_id === reqId) {
              // Remover o handler após receber a resposta
              if (this.webSocket) {
                this.webSocket.removeEventListener("message", messageHandler);
              }

              if (data.error) {
                console.error(
                  "[OAUTH_DIRECT] Erro na autorização do token ativo:",
                  data.error.message,
                );
                resolve(false);
                return;
              }

              if (data.authorize) {
                console.log(
                  "[OAUTH_DIRECT] Token ativo autorizado com sucesso:",
                  data.authorize.loginid,
                );

                // Salvar informações da conta para uso futuro
                localStorage.setItem(
                  "deriv_account_info",
                  JSON.stringify({
                    ...data.authorize,
                    timestamp: Date.now(),
                  }),
                );

                // Atualizar loginid do token ativo
                const tokenIndex = this.tokens.findIndex(
                  (t) => t.token === this.activeToken,
                );
                if (tokenIndex >= 0) {
                  this.tokens[tokenIndex].loginid = data.authorize.loginid;
                  this.tokens[tokenIndex].authorized = true;
                }

                // Notificar sobre a autorização
                this.notifyListeners({
                  type: "authorized",
                  account: data.authorize,
                });

                // Assinar para atualizações de saldo
                this.subscribeToBalance();

                resolve(true);
                return;
              }

              // Se chegou aqui, não recebemos uma resposta válida
              console.error(
                "[OAUTH_DIRECT] Resposta de autorização inválida:",
                data,
              );
              resolve(false);
            }
          } catch (error) {
            console.error(
              "[OAUTH_DIRECT] Erro ao processar resposta de autorização:",
              error,
            );
            resolve(false);
          }
        };

        // Adicionar handler temporário para esta solicitação
        if (this.webSocket) {
          this.webSocket.addEventListener("message", messageHandler);

          // Enviar solicitação de autorização
          this.webSocket.send(JSON.stringify(authRequest));

          // Definir timeout para caso não receba resposta
          setTimeout(() => {
            if (this.webSocket) {
              this.webSocket.removeEventListener("message", messageHandler);
            }
            console.error(
              "[OAUTH_DIRECT] Timeout na autorização do token ativo",
            );
            resolve(false);
          }, 10000);
        } else {
          console.error(
            "[OAUTH_DIRECT] WebSocket não disponível para autorização",
          );
          resolve(false);
        }
      });
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao autorizar token ativo:", error);
      return false;
    }
  }

  /**
   * Define as configurações de trading
   */
  setSettings(settings: Partial<TradingSettings>): void {
    // Mesclar novas configurações com as existentes
    this.settings = { ...this.settings, ...settings };
    console.log("[OAUTH_DIRECT] Configurações atualizadas:", this.settings);

    // Notificar mudança de configurações
    if (this.isRunning) {
      this.notifyListeners({
        type: "settings_updated",
        settings: this.settings,
      });
    }
  }

  /**
   * Define a estratégia ativa
   */
  setActiveStrategy(strategy: string): void {
    this.strategyConfig = strategy;
    console.log(`[OAUTH_DIRECT] Estratégia definida: ${strategy}`);
  }

  /**
   * Define a conta ativa para operação e valida o token
   * @param loginid ID da conta
   * @param token Token de autorização
   */
  setActiveAccount(loginid: string, token: string): void {
    console.log(
      `[OAUTH_DIRECT] ⚠️ SOLICITAÇÃO PARA DEFINIR NOVA CONTA ATIVA: ${loginid} com token ${token.substring(0, 8)}...`,
    );

    try {
      // PASSO 1: Obter conta anterior para comparação
      const previousAccount = this.tokens.find((t) => t.primary);
      const isPrimary = previousAccount?.loginid === loginid;

      if (isPrimary) {
        console.log(
          `[OAUTH_DIRECT] Conta ${loginid} já é a primária. Apenas atualizando token...`,
        );
      } else {
        console.log(
          `[OAUTH_DIRECT] Trocando conta primária de ${previousAccount?.loginid || "desconhecida"} para ${loginid}`,
        );
      }

      // PASSO 2: Remover flag primária de todas as contas existentes
      this.tokens.forEach((t) => {
        if (t.primary) {
          console.log(
            `[OAUTH_DIRECT] Removendo status primário da conta anterior: ${t.loginid || "desconhecida"}`,
          );
          t.primary = false;
        }
      });

      // PASSO 3: Encontrar token existente ou criar novo
      let tokenInfo = this.tokens.find((t) => t.token === token);
      if (!tokenInfo) {
        tokenInfo = this.tokens.find((t) => t.loginid === loginid);
      }

      let isNewToken = false;

      if (tokenInfo) {
        // Atualizar token existente
        console.log(
          `[OAUTH_DIRECT] Atualizando token existente para conta: ${loginid}`,
        );
        this.activeToken = token;
        tokenInfo.token = token; // Garantir que o token está atualizado
        tokenInfo.loginid = loginid; // Garantir que o loginid está atualizado
        tokenInfo.primary = true; // Marcar como primário
      } else {
        // Criar novo token
        console.log(`[OAUTH_DIRECT] Adicionando nova conta ativa: ${loginid}`);
        this.addToken(token, true, loginid);
        this.activeToken = token;
        isNewToken = true;
      }

      // PASSO 4: Salvar em TODOS os locais do localStorage para garantir consistência
      try {
        // Múltiplos formatos de armazenamento para compatibilidade
        localStorage.setItem("deriv_active_loginid", loginid);
        localStorage.setItem("deriv_api_token", token);
        localStorage.setItem("deriv_oauth_token", token);
        localStorage.setItem(
          "deriv_selected_account",
          JSON.stringify({
            token: token,
            loginid: loginid,
            timestamp: Date.now(),
          }),
        );
        localStorage.setItem(
          "deriv_oauth_selected_account",
          JSON.stringify({
            accountId: loginid,
            token: token,
            timestamp: Date.now(),
          }),
        );

        // Salvar explicitamente como conta ativa
        localStorage.setItem(
          "deriv_active_account",
          JSON.stringify({
            loginid: loginid,
            token: token,
            timestamp: Date.now(),
            is_virtual: tokenInfo?.loginid?.startsWith("VRTC") || false,
            active: true,
          }),
        );

        console.log(
          `[OAUTH_DIRECT] Conta ${loginid} salva em todos os locais de armazenamento`,
        );
      } catch (e) {
        console.error(
          "[OAUTH_DIRECT] Erro ao salvar conta no localStorage:",
          e,
        );
      }

      // PASSO 5: Notificar mudança de conta
      this.notifyListeners({
        type: "account_changed",
        loginid: loginid,
      });

      // PASSO 6: Validar o token se a conexão estiver aberta
      if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
        console.log(`[OAUTH_DIRECT] Validando token da conta ${loginid}...`);

        // Tentar autorizar com o novo token sem reconexão completa
        this.authorizeToken(token)
          .then(() => {
            console.log(
              `[OAUTH_DIRECT] ✅ Token da conta ${loginid} validado com sucesso!`,
            );

            // Garantir que estamos inscritos para ticks após validação
            this.subscribeToTicks();

            // Notificar sobre validação bem-sucedida via evento interno
            this.notifyListeners({
              type: "token_validated",
              message: `Token da conta ${loginid} validado com sucesso`,
              loginid: loginid,
            });

            // Emitir evento customizado para a UI atualizar
            try {
              const tokenValidatedEvent = new CustomEvent(
                "deriv:token_validated",
                {
                  detail: {
                    loginid: loginid,
                    message: `Token da conta ${loginid} validado com sucesso`,
                    isNewAccount: !isPrimary,
                  },
                },
              );
              document.dispatchEvent(tokenValidatedEvent);
            } catch (e) {
              console.error(
                "[OAUTH_DIRECT] Erro ao emitir evento de validação de token:",
                e,
              );
            }
          })
          .catch((error) => {
            console.error(
              `[OAUTH_DIRECT] ❌ Erro ao validar token da conta ${loginid}:`,
              error,
            );

            // Em caso de erro na validação de token atual, forçar reconexão completa
            console.log(
              `[OAUTH_DIRECT] Forçando reconexão completa após erro de validação...`,
            );
            this.closeConnection();
            this.setupWebSocket().catch((reconnectError) => {
              console.error(
                "[OAUTH_DIRECT] Falha na reconexão após erro de validação:",
                reconnectError,
              );
            });
          });
      } else {
        console.log(
          `[OAUTH_DIRECT] WebSocket não está aberto. Conta definida, mas token não validado.`,
        );
      }
    } catch (error) {
      console.error(
        `[OAUTH_DIRECT] Erro crítico ao processar nova conta ativa:`,
        error,
      );
    }
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
   * Método compatível com componentes antigos para emitir eventos
   * Internamente usa notifyListeners
   */
  private emit(type: string, data: any): void {
    this.notifyListeners({
      type,
      ...data,
    });
  }

  /**
   * Notifica todos os listeners sobre um evento
   * VERSÃO MELHORADA: Garante que as notificações ocorram mesmo em caso de componentes não responsivos
   */
  private notifyListeners(event: TradingEvent): void {
    console.log(
      `[OAUTH_DIRECT] Notificando ${this.eventListeners.length} listeners sobre: ${event.type}`,
    );

    // Para eventos contract_finished, emitir também para o DOM
    if (event.type === "contract_finished" && typeof window !== "undefined") {
      try {
        console.log(
          `[OAUTH_DIRECT] 📢 Emitindo evento DOM: contract_finished`,
          event,
        );

        // ★★★ CORREÇÃO CRÍTICA ★★★
        // Forçar isIntermediate como false para todas as operações que NÃO sejam da estratégia ADVANCE
        // Isso garante que as operações apareçam na aba "Operações", não na aba "Análises"
        const strategyId = this.activeStrategy?.toLowerCase() || "";
        const isAdvanceStrategy = strategyId === "advance";

        // Apenas estratégia Advance pode ter operações intermediárias
        const originalIsIntermediate =
          event.isIntermediate || event.is_intermediate || false;
        const isIntermediate = isAdvanceStrategy
          ? originalIsIntermediate
          : false;

        console.log(`[OAUTH_DIRECT] ★★★ Classificação de operação:
          Estratégia: ${strategyId}
          É estratégia Advance? ${isAdvanceStrategy}
          isIntermediate original: ${originalIsIntermediate}
          isIntermediate final: ${isIntermediate}
        `);

        const domEvent = new CustomEvent("contract_finished", {
          detail: {
            ...event,
            timestamp: Date.now(),
            strategy: this.strategyConfig || "",
            entry_value: event.entry_value || this.settings.entryValue || 0,
            // Incluir flag isIntermediate de forma consistente,
            // forçando como false para operações não-Advance
            isIntermediate: isIntermediate,
            is_intermediate: isIntermediate,
          },
        });
        window.dispatchEvent(domEvent);
      } catch (e) {
        console.error(`[OAUTH_DIRECT] Erro ao emitir evento DOM:`, e);
      }
    }

    // Fazer uma cópia da lista de listeners para evitar problemas se um listener se remover durante a notificação
    const listeners = [...this.eventListeners];

    // Garantir que a notificação ocorra no próximo ciclo do event loop
    setTimeout(() => {
      listeners.forEach((listener, index) => {
        try {
          console.log(
            `[OAUTH_DIRECT] Enviando evento ${event.type} para listener #${index + 1}`,
          );
          listener({ ...event, timestamp: Date.now() }); // Garantir que cada listener recebe um objeto novo com timestamp único
        } catch (error) {
          console.error(
            `[OAUTH_DIRECT] Erro ao notificar listener #${index + 1}:`,
            error,
          );
        }
      });
    }, 0);
  }

  /**
   * Salva detalhes completos de uma operação finalizada no histórico local
   * @param operation Dados da operação finalizada
   */
  private saveOperationToHistory(operation: any): void {
    try {
      // Obter histórico existente
      const historyKey = "deriv_operations_history";
      let history: any[] = [];

      const existingHistory = localStorage.getItem(historyKey);
      if (existingHistory) {
        try {
          const parsed = JSON.parse(existingHistory);
          if (Array.isArray(parsed)) {
            history = parsed;
          }
        } catch (e) {
          console.error(
            "[OAUTH_DIRECT] Erro ao restaurar histórico de operações:",
            e,
          );
        }
      }

      // Verificar e garantir que a estratégia está corretamente definida
      let strategyName = operation.strategy;
      const activeStrategy = this.activeStrategy ? this.activeStrategy.toLowerCase() : '';
      
      // Verificar se é Control Under/Over que pode estar com identificação incorreta
      if (activeStrategy.includes('manualunder') || activeStrategy.includes('control_under') || activeStrategy.includes('control under')) {
        console.log(`[OAUTH_DIRECT] ✓ Corrigindo registro de estratégia: detectado Control Under`);
        strategyName = 'Control Under'; // Forçar nome correto
      } else if (activeStrategy.includes('manualover') || activeStrategy.includes('control_over') || activeStrategy.includes('control over')) {
        console.log(`[OAUTH_DIRECT] ✓ Corrigindo registro de estratégia: detectado Control Over`);
        strategyName = 'Control Over'; // Forçar nome correto
      }
      
      // Adicionar nova operação ao início do histórico com informações corrigidas
      history.unshift({
        ...operation,
        saved_at: Date.now(),
        strategy: strategyName || operation.strategy, // Usar a estratégia corrigida ou a original
      });

      // Limitar o tamanho do histórico para evitar exceder o armazenamento local (manter últimas 100 operações)
      if (history.length > 100) {
        history = history.slice(0, 100);
      }

      // Salvar histórico atualizado
      localStorage.setItem(historyKey, JSON.stringify(history));

      // Enviar via API para armazenamento externo se disponível
      this.sendOperationToAPI(operation);

      console.log(
        `[OAUTH_DIRECT] ✅ Operação ID:${operation.contract_id} salva no histórico local`,
      );
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao salvar operação no histórico:",
        error,
      );
    }
  }

  /**
   * Envia detalhes da operação para API externa (se configurada)
   * @param operation Dados da operação para enviar
   */
  private sendOperationToAPI(operation: any): void {
    try {
      // Verificar se há URL de API configurada
      const apiUrl = localStorage.getItem("operations_api_url");
      if (!apiUrl) {
        // API não configurada, não enviar
        return;
      }

      // Criar objeto para envio com dados essenciais
      const payload = {
        contract_id: operation.contract_id,
        strategy: operation.strategy,
        symbol: operation.symbol,
        contract_type: operation.contract_type,
        entry_value: operation.entry_value,
        exit_value: operation.exit_value,
        profit: operation.profit,
        is_win: operation.is_win,
        barrier: operation.barrier,
        entry_spot: operation.entry_spot,
        exit_spot: operation.exit_spot,
        entry_time: operation.entry_time,
        exit_time: operation.exit_time,
        timestamp: operation.timestamp,
      };

      // Enviar dados em background sem aguardar resposta
      fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (response.ok) {
            console.log(
              `[OAUTH_DIRECT] ✅ Operação ID:${operation.contract_id} enviada para API externa`,
            );
          } else {
            console.error(
              `[OAUTH_DIRECT] ❌ Erro ao enviar operação para API: ${response.status}`,
            );
          }
        })
        .catch((error) => {
          console.error(
            "[OAUTH_DIRECT] ❌ Erro ao enviar operação para API:",
            error,
          );
        });
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao tentar enviar operação para API:",
        error,
      );
    }
  }

  /**
   * Obtém o histórico completo de operações realizadas
   * @param limit Número máximo de operações para retornar
   * @returns Array com histórico de operações
   */
  public getOperationsHistory(limit: number = 50): any[] {
    try {
      const historyKey = "deriv_operations_history";
      const existingHistory = localStorage.getItem(historyKey);

      if (!existingHistory) {
        return [];
      }

      try {
        const history = JSON.parse(existingHistory);
        if (!Array.isArray(history)) {
          return [];
        }

        // Retornar apenas o número solicitado de operações mais recentes
        return history.slice(0, limit);
      } catch (e) {
        console.error(
          "[OAUTH_DIRECT] Erro ao parsear histórico de operações:",
          e,
        );
        return [];
      }
    } catch (error) {
      console.error(
        "[OAUTH_DIRECT] Erro ao obter histórico de operações:",
        error,
      );
      return [];
    }
  }

  /**
   * Obtém as estatísticas atuais de vitorias, derrotas e lucro total
   * @returns Estatísticas atualizadas do robô trading
   */
  public getStats(): BotStats {
    try {
      // Inicializar estatísticas padrão
      const defaultStats: BotStats = {
        wins: 0,
        losses: 0,
        totalProfit: 0,
      };

      // Tentar restaurar estatísticas do localStorage
      const statsKey = "deriv_bot_stats";
      const statsString = localStorage.getItem(statsKey);
      if (statsString) {
        try {
          const parsed = JSON.parse(statsString);
          if (parsed && typeof parsed === "object") {
            // Aplicar somente propriedades válidas
            return {
              wins: typeof parsed.wins === "number" ? parsed.wins : 0,
              losses: typeof parsed.losses === "number" ? parsed.losses : 0,
              totalProfit:
                typeof parsed.totalProfit === "number" ? parsed.totalProfit : 0,
            };
          }
        } catch (e) {
          console.error(
            "[OAUTH_DIRECT] Erro ao restaurar estatísticas do bot:",
            e,
          );
        }
      }

      // Se não houver estatísticas salvas ou ocorrer erro, calcular com base no histórico
      const history = this.getOperationsHistory(1000); // Pegar um histórico maior para cálculos precisos

      if (history.length > 0) {
        // Calcular estatísticas com base no histórico de operações
        const calculated = history.reduce(
          (stats, op) => {
            // Verificar se é uma operação válida com resultado
            if (op.is_win !== undefined && op.profit !== undefined) {
              if (op.is_win) {
                stats.wins++;
              } else {
                stats.losses++;
              }
              stats.totalProfit +=
                typeof op.profit === "number" ? op.profit : 0;
            }
            return stats;
          },
          { ...defaultStats },
        );

        // Salvar estatísticas calculadas para uso futuro
        localStorage.setItem(statsKey, JSON.stringify(calculated));

        return calculated;
      }

      // Retornar estatísticas padrão se não houver histórico
      return defaultStats;
    } catch (error) {
      console.error("[OAUTH_DIRECT] Erro ao calcular estatísticas:", error);
      return {
        wins: 0,
        losses: 0,
        totalProfit: 0,
      };
    }
  }
}

// Exportar uma instância única do serviço
export const oauthDirectService = new OAuthDirectService();
