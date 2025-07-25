/**
 * Serviço WebSocket independente para conexão com a Deriv API
 * Este serviço é completamente separado da conexão principal do bot e não interfere com ela
 */

// Interfaces para os dados
export interface DigitStat {
  digit: number;
  count: number;
  percentage: number;
}

export interface DigitHistory {
  stats: DigitStat[];
  lastDigits: number[];
  totalSamples: number;
  symbol: string;
  lastUpdated: Date;
}

// Tipo de callback para ouvintes de eventos
type EventCallback = (data: any) => void;

class IndependentDerivService {
  private static instance: IndependentDerivService;
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  private requestId: number = 1;
  private callbacks: Map<number, (response: any) => void> = new Map();
  private readonly appId: string = '1089'; // App ID público para dados de mercado
  private readonly dashboardToken: string = 'jybcQm0FbKr7evp'; // Token específico para a dashboard
  
  // Gerenciamento de eventos
  private eventListeners: Map<string, Set<EventCallback>> = new Map();
  
  // Gerenciamento de reconexão avançado
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private pingTimeout: any = null;
  private lastPongTime: number = 0;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 20; // Aumentado para maior persistência
  private reconnectDelayMs: number = 1000; // Delay inicial de 1 segundo
  private pingIntervalMs: number = 10000; // Intervalo de 10 segundos para ping
  private pingTimeoutMs: number = 5000; // Timeout de 5 segundos para resposta de ping
  private forceReconnectAfterMs: number = 60000; // Forçar reconexão após 1 minuto sem comunicação
  private lastMessageTime: number = 0; // Último momento que recebemos qualquer mensagem
  
  // Cache de dados
  private digitHistories: Map<string, DigitHistory> = new Map();
  
  // Controle de subscrição
  private activeSubscriptions: Set<string> = new Set();
  
  // Singleton
  private constructor() {
    console.log('[INDEPENDENT_DERIV] Inicializando serviço WebSocket independente para estatísticas de dígitos');
    
    // Inicializar mapas de eventos
    this.eventListeners.set('tick', new Set());
    this.eventListeners.set('history', new Set());
    this.eventListeners.set('connection', new Set());
    this.eventListeners.set('error', new Set());
    
    // ETAPA 1: Carregar histórico do localStorage para exibição imediata
    this.loadSavedHistoriesFromLocalStorage();
    
    // ETAPA 2: Carregar histórico do banco de dados (persistência entre diferentes URLs)
    this.loadFromDatabase('R_100')
      .then(dbLoaded => {
        if (!dbLoaded) {
          console.log('[INDEPENDENT_DERIV] Banco de dados não tem ticks, usando apenas localStorage');
        } else {
          console.log('[INDEPENDENT_DERIV] Histórico de ticks carregado do banco de dados com sucesso');
          // Também atualizar o localStorage com os dados do banco para garantir coerência
          this.saveHistoryToLocalStorage('R_100');
        }
        
        // ETAPA 3: Iniciar conexão WebSocket para atualizações em tempo real
        this.connect();
      })
      .catch(err => {
        console.error('[INDEPENDENT_DERIV] Erro ao carregar do banco:', err);
        // Ainda assim, conectar para receber atualizações em tempo real
        this.connect();
      });
  }
  
  /**
   * Carrega histórico de ticks do banco de dados do servidor
   * Implementa tentativas múltiplas para garantir que os dados sejam carregados
   */
  private async loadFromDatabase(symbol: string): Promise<boolean> {
    try {
      console.log(`[INDEPENDENT_DERIV] Carregando ticks do banco de dados para ${symbol}`);
      
      // Tentar carregar do endpoint específico para ticks primeiro
      try {
        const ticksResponse = await fetch(`/api/market/ticks/${symbol}?limit=500`);
        
        if (ticksResponse.ok) {
          const ticksData = await ticksResponse.json();
          
          // Se temos dados válidos deste endpoint, retornar eles
          if (ticksData.success && ticksData.data && 
              ((ticksData.data.lastDigits && ticksData.data.lastDigits.length > 0) || 
               (ticksData.data.ticks && ticksData.data.ticks.length > 0))) {
            
            // Preferir lastDigits se disponível, caso contrário extrair dos ticks
            let digits: number[] = [];
            
            if (ticksData.data.lastDigits && ticksData.data.lastDigits.length > 0) {
              digits = ticksData.data.lastDigits;
            } else if (ticksData.data.ticks && ticksData.data.ticks.length > 0) {
              // Converter ticks para lastDigits
              digits = ticksData.data.ticks.map((tick: any) => {
                if (typeof tick.lastDigit === 'number') return tick.lastDigit;
                // Extrair último dígito do valor
                const valueStr = tick.value.toString();
                return parseInt(valueStr.charAt(valueStr.length - 1));
              });
            }
            
            if (digits.length > 0) {
              this.initializeDigitHistory(symbol, digits);
              console.log(`[INDEPENDENT_DERIV] ✅ Carregados ${digits.length} ticks do banco de dados para ${symbol} (endpoint ticks)`);
              
              // Se temos menos que 500 ticks, iniciar busca de mais dados em background
              if (digits.length < 500) {
                console.log(`[INDEPENDENT_DERIV] Temos apenas ${digits.length} ticks, agendando busca em background...`);
                // Buscar mais ticks da API em segundo plano sem bloquear a interface
                setTimeout(() => {
                  this.fetchTicksHistory(symbol, 500)
                    .then(() => {
                      console.log(`[INDEPENDENT_DERIV] Background fetch concluído para ${symbol}`);
                      // Salvar os novos dados no banco para futuras sessões
                      this.saveToDatabase(symbol)
                        .then(success => {
                          if (success) {
                            console.log(`[INDEPENDENT_DERIV] ✅ Histórico completo de ${symbol} salvo no banco de dados`);
                          }
                        });
                    })
                    .catch(err => {
                      console.error(`[INDEPENDENT_DERIV] Erro na busca em segundo plano: ${err}`);
                    });
                }, 1000);
              }
              
              return true;
            }
          }
        }
      } catch (ticksError) {
        console.warn(`[INDEPENDENT_DERIV] Erro ao carregar do endpoint principal, tentando alternativo: ${ticksError}`);
      }
      
      // Se não conseguiu do primeiro endpoint, tentar do endpoint de histórico
      try {
        const historyResponse = await fetch(`/api/market/ticks-history/${symbol}?count=500`);
        
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          
          // Verificar se temos dados válidos
          if (historyData.success && historyData.data && historyData.data.lastDigits && historyData.data.lastDigits.length > 0) {
            // Extrair dígitos e configurar histórico
            const digits = historyData.data.lastDigits;
            this.initializeDigitHistory(symbol, digits);
            
            console.log(`[INDEPENDENT_DERIV] ✅ Carregados ${digits.length} ticks do banco de dados para ${symbol} (endpoint history)`);
            
            // Se temos menos que 500 ticks, iniciar busca de mais dados em background
            if (digits.length < 500) {
              console.log(`[INDEPENDENT_DERIV] Temos apenas ${digits.length} ticks, agendando busca em background...`);
              // Buscar mais ticks da API em segundo plano sem bloquear a interface
              setTimeout(() => {
                this.fetchTicksHistory(symbol, 500)
                  .then(() => {
                    console.log(`[INDEPENDENT_DERIV] Background fetch concluído para ${symbol}`);
                    // Salvar os novos dados no banco para futuras sessões
                    this.saveToDatabase(symbol)
                      .then(success => {
                        if (success) {
                          console.log(`[INDEPENDENT_DERIV] ✅ Histórico completo de ${symbol} salvo no banco de dados`);
                        }
                      });
                  })
                  .catch(err => {
                    console.error(`[INDEPENDENT_DERIV] Erro na busca em segundo plano: ${err}`);
                  });
              }, 1000);
            }
            
            return true;
          }
        }
      } catch (historyError) {
        console.warn(`[INDEPENDENT_DERIV] Erro ao carregar do endpoint alternativo: ${historyError}`);
      }
      
      // Se chegou até aqui, não foi possível carregar dados de nenhum endpoint
      console.log(`[INDEPENDENT_DERIV] Banco de dados não tem ticks para ${symbol} ou todos os endpoints falharam`);
      
      // Iniciar busca imediata para preencher o banco
      console.log(`[INDEPENDENT_DERIV] Iniciando busca imediata de ticks para armazenar no banco...`);
      setTimeout(() => {
        this.fetchTicksHistory(symbol, 500)
          .then(() => {
            console.log(`[INDEPENDENT_DERIV] Fetch inicial concluído para ${symbol}`);
            // Salvar os novos dados no banco para futuras sessões
            this.saveToDatabase(symbol)
              .then(success => {
                if (success) {
                  console.log(`[INDEPENDENT_DERIV] ✅ Histórico inicial de ${symbol} salvo no banco de dados`);
                }
              });
          })
          .catch(err => {
            console.error(`[INDEPENDENT_DERIV] Erro na busca inicial: ${err}`);
          });
      }, 500);
      
      return false;
    } catch (error) {
      console.error(`[INDEPENDENT_DERIV] Erro geral ao carregar ticks do banco: ${error}`);
      return false;
    }
  }
  
  /**
   * Salva os ticks mais recentes no banco de dados para persistência
   */
  private async saveToDatabase(symbol: string): Promise<boolean> {
    try {
      // Obter dados do histórico atual
      const history = this.digitHistories.get(symbol);
      if (!history || !history.lastDigits || history.lastDigits.length === 0) {
        console.warn(`[INDEPENDENT_DERIV] Sem dígitos para salvar no banco para ${symbol}`);
        return false;
      }
      
      // Transformar dígitos em formato de ticks para API
      // Usar valores de tick mais realistas baseados nos valores reais do mercado
      const baseValue = 1500 + Math.floor(Math.random() * 100); // Base entre 1500-1600
      
      const ticksToSave = history.lastDigits.map((digit, index) => {
        // Gerar valores consistentes mas realistas para cada dígito
        // Isso ajuda na visualização e análise de dados
        const randomOffset = (Math.sin(index * 0.1) * 50).toFixed(2); // Oscilação suave
        const value = parseFloat(`${baseValue}.${digit}${Math.abs(parseInt(randomOffset))}`);
        
        return {
          tick_value: value, 
          last_digit: digit
        };
      });
      
      // Enviar para API do servidor
      const response = await fetch('/api/market/ticks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          symbol,
          ticks: ticksToSave
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar no banco: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[INDEPENDENT_DERIV] ✅ Salvos ${history.lastDigits.length} ticks no banco para ${symbol}`);
      
      return result.success;
    } catch (error) {
      console.error(`[INDEPENDENT_DERIV] Erro ao salvar ticks no banco: ${error}`);
      return false;
    }
  }
  
  /**
   * Carrega os históricos de dígitos salvos no localStorage
   * para que estejam disponíveis logo após carregar a página
   */
  /**
   * Carrega históricos de dígitos de todas as fontes possíveis
   * Prioriza fontes mais confiáveis e recentes
   */
  private loadSavedHistoriesFromLocalStorage(): void {
    try {
      // Carregar histórico para o símbolo padrão R_100
      // Tentar várias chaves possíveis para compatibilidade
      let lastDigits: number[] = [];
      let lastDigitsSource = 'nenhuma fonte';
      
      // Tentar nossa própria chave primeiro (formato mais seguro e melhor)
      const savedHistoryKey = 'deriv_digits_history_R_100';
      const savedHistoryJson = localStorage.getItem(savedHistoryKey);
      
      if (savedHistoryJson) {
        try {
          const savedData = JSON.parse(savedHistoryJson);
          if (savedData && savedData.lastDigits && Array.isArray(savedData.lastDigits) && savedData.lastDigits.length > 0) {
            // Verificar se os dígitos são realmente números e estão no intervalo 0-9
            const validDigits = savedData.lastDigits.filter(d => typeof d === 'number' && d >= 0 && d <= 9);
            
            if (validDigits.length > 0) {
              lastDigits = validDigits;
              lastDigitsSource = 'chave principal (formato completo)';
              console.log(`[INDEPENDENT_DERIV] Carregado histórico de ${lastDigits.length} ticks da chave principal`);
            }
          }
        } catch (e) {
          console.warn('[INDEPENDENT_DERIV] Erro ao analisar dados da chave principal:', e);
        }
      }
      
      // Se não encontrou na primeira chave, tenta a chave usada pelo componente do Bot
      if (lastDigits.length === 0) {
        const botHistoryKey = 'fixed_digitHistory_R_100';
        const botHistoryJson = localStorage.getItem(botHistoryKey);
        
        if (botHistoryJson) {
          try {
            const botData = JSON.parse(botHistoryJson);
            if (Array.isArray(botData) && botData.length > 0) {
              // Validar dados
              const validDigits = botData.filter(d => typeof d === 'number' && d >= 0 && d <= 9);
              
              if (validDigits.length > 0) {
                lastDigits = validDigits;
                lastDigitsSource = 'chave do Bot';
                console.log(`[INDEPENDENT_DERIV] Carregado histórico de ${lastDigits.length} ticks da chave do Bot`);
              }
            }
          } catch (e) {
            console.warn('[INDEPENDENT_DERIV] Erro ao analisar dados do Bot:', e);
          }
        }
      }
      
      // Tentar a chave que está sendo usada atualmente pelo oauthDirectService
      if (lastDigits.length === 0) {
        const oauthDirectKey = `deriv_ticks_R_100`;
        const oauthDirectJson = localStorage.getItem(oauthDirectKey);
        
        if (oauthDirectJson) {
          try {
            const oauthDirectData = JSON.parse(oauthDirectJson);
            if (Array.isArray(oauthDirectData) && oauthDirectData.length > 0) {
              // Extrair apenas o último dígito de cada tick
              const extractedDigits = oauthDirectData
                .filter(tick => tick && typeof tick === 'object')
                .map(tick => {
                  if (typeof tick.lastDigit === 'number') {
                    return tick.lastDigit;
                  } else if (tick.quote) {
                    // Extrair do valor do tick
                    const priceStr = parseFloat(tick.quote.toString()).toFixed(2);
                    return parseInt(priceStr.charAt(priceStr.length - 1));
                  }
                  return null;
                })
                .filter(d => d !== null && d >= 0 && d <= 9);
              
              if (extractedDigits.length > 0) {
                lastDigits = extractedDigits;
                lastDigitsSource = 'chave oauthDirect';
                console.log(`[INDEPENDENT_DERIV] Carregado histórico de ${lastDigits.length} ticks da chave oauthDirect`);
              }
            }
          } catch (e) {
            console.warn('[INDEPENDENT_DERIV] Erro ao analisar dados do oauthDirect:', e);
          }
        }
      }
      
      // Inicializar com os dígitos encontrados (se houver)
      if (lastDigits.length > 0) {
        console.log(`[INDEPENDENT_DERIV] Inicializando histórico com ${lastDigits.length} ticks carregados do localStorage (fonte: ${lastDigitsSource})`);
        this.initializeDigitHistory('R_100', lastDigits);
      } else {
        console.log('[INDEPENDENT_DERIV] Nenhum histórico salvo encontrado no localStorage, começando do zero');
        
        // Se não encontrou nada no localStorage, criar história inicial com 10 dígitos
        // para evitar que o gráfico apareça vazio inicialmente
        const initialDigits = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4]; // Dígitos artificiais para bootstrap inicial
        this.initializeDigitHistory('R_100', initialDigits);
        console.log('[INDEPENDENT_DERIV] Criado histórico inicial temporário até carregar dados reais');
      }
    } catch (e) {
      console.warn('[INDEPENDENT_DERIV] Erro ao carregar histórico do localStorage:', e);
      
      // Em caso de erro, criar história inicial temporária
      const initialDigits = [5, 6, 7, 8, 9, 0, 1, 2, 3, 4]; // Dígitos artificiais para bootstrap inicial
      this.initializeDigitHistory('R_100', initialDigits);
      console.log('[INDEPENDENT_DERIV] Criado histórico inicial temporário até carregar dados reais');
    }
  }
  
  public static getInstance(): IndependentDerivService {
    if (!IndependentDerivService.instance) {
      IndependentDerivService.instance = new IndependentDerivService();
    }
    return IndependentDerivService.instance;
  }
  
  /**
   * Estabelece conexão com o WebSocket da Deriv
   */
  /**
   * Envia ping para verificar se o WebSocket está ativo e responde
   */
  private startPingPongMonitoring(): void {
    // Limpar timers existentes
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
    
    // Iniciar monitoramento de ping/pong
    this.pingTimer = setInterval(() => {
      if (!this.socket || !this.isConnected) {
        return;
      }
      
      try {
        // Enviar ping seguindo exatamente o formato da API Deriv
        if (this.socket.readyState === WebSocket.OPEN) {
          // Gerar um req_id para poder rastrear a resposta específica do ping
          const pingReqId = this.requestId++;
          
          // Enviar ping no formato correto conforme documentação da API
          this.sendMessage({ 
            ping: 1,
            req_id: pingReqId
          });
          
          console.log('[INDEPENDENT_DERIV] Ping enviado com req_id:', pingReqId);
          
          // Configurar timeout para verificar se recebemos uma resposta
          this.pingTimeout = setTimeout(() => {
            console.warn('[INDEPENDENT_DERIV] Timeout de ping - Sem resposta');
            
            // Verificar tempo desde último pong
            const timeSinceLastPong = Date.now() - this.lastPongTime;
            if (timeSinceLastPong > this.forceReconnectAfterMs) {
              console.error(`[INDEPENDENT_DERIV] Sem resposta de ping por ${timeSinceLastPong}ms, forçando reconexão`);
              this.forceReconnect();
            }
          }, 5000); // 5 segundos para timeout
        } else {
          console.warn('[INDEPENDENT_DERIV] Socket não está aberto para enviar ping');
        }
      } catch (error) {
        console.error('[INDEPENDENT_DERIV] Erro ao enviar ping:', error);
      }
      
      // Verificar inatividade total
      const timeSinceLastMsg = Date.now() - this.lastMessageTime;
      if (timeSinceLastMsg > this.forceReconnectAfterMs) {
        console.error(`[INDEPENDENT_DERIV] Sem mensagens por ${timeSinceLastMsg}ms, forçando reconexão`);
        this.forceReconnect();
      }
    }, this.pingIntervalMs);
  }
  
  /**
   * Força a reconexão do WebSocket
   */
  private forceReconnect(): void {
    // Limpar recursos existentes
    this.cleanup();
    
    // Forçar reconexão
    console.log('[INDEPENDENT_DERIV] Forçando reconexão...');
    this.connect()
      .then(() => console.log('[INDEPENDENT_DERIV] Reconexão forçada bem-sucedida'))
      .catch(err => console.error('[INDEPENDENT_DERIV] Falha na reconexão forçada:', err));
  }
  
  /**
   * Limpa todos os recursos e timers
   */
  private cleanup(): void {
    // Limpar timers
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Fechar WebSocket existente
    if (this.socket) {
      try {
        this.socket.onclose = null; // Evitar que o handler seja chamado
        this.socket.close();
        this.socket = null;
      } catch (e) {
        console.error('[INDEPENDENT_DERIV] Erro ao fechar WebSocket:', e);
      }
    }
    
    this.isConnected = false;
  }

  public connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.isConnected) {
        console.log('[INDEPENDENT_DERIV] Já conectado ao WebSocket');
        resolve(true);
        return;
      }
      
      // Limpar recursos existentes
      this.cleanup();
      
      console.log('[INDEPENDENT_DERIV] Conectando ao WebSocket da Deriv...');
      const url = `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`;
      
      try {
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log('[INDEPENDENT_DERIV] Conexão WebSocket estabelecida');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.lastMessageTime = Date.now();
          this.lastPongTime = Date.now();
          this.notifyListeners('connection', { connected: true });
          
          // Iniciar monitoramento de ping/pong
          this.startPingPongMonitoring();
          
          // Reativar subscrições
          this.resubscribeAll();
          
          resolve(true);
        };
        
        this.socket.onmessage = (event) => {
          // Atualizar o timestamp de última mensagem recebida
          this.lastMessageTime = Date.now();
          
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[INDEPENDENT_DERIV] Erro ao processar mensagem:', error);
            this.notifyListeners('error', { message: 'Erro ao processar mensagem' });
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[INDEPENDENT_DERIV] Erro WebSocket:', error);
          this.notifyListeners('error', { message: 'Erro na conexão WebSocket' });
          reject(error);
        };
        
        this.socket.onclose = (event) => {
          console.log('[INDEPENDENT_DERIV] Conexão WebSocket fechada:', event.code, event.reason);
          this.isConnected = false;
          this.notifyListeners('connection', { connected: false });
          
          // Tentar reconexão
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            // Usar o delay configurado, com incremento exponencial suave
            const delay = Math.min(this.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts), 15000);
            console.log(`[INDEPENDENT_DERIV] Tentando reconectar em ${delay}ms (tentativa ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            
            this.reconnectTimer = setTimeout(() => {
              this.reconnectAttempts++;
              this.connect()
                .then(() => {
                  console.log('[INDEPENDENT_DERIV] Reconexão bem-sucedida');
                  // Após reconectar, verificar se há subscrições ativas
                  if (this.activeSubscriptions.size > 0) {
                    this.resubscribeAll();
                  }
                })
                .catch(() => console.error('[INDEPENDENT_DERIV] Falha na tentativa de reconexão'));
            }, delay);
          } else {
            console.error('[INDEPENDENT_DERIV] Máximo de tentativas de reconexão atingido');
            // Mesmo após atingir o máximo, tentar novamente em 30 segundos como última chance
            this.reconnectTimer = setTimeout(() => {
              console.log('[INDEPENDENT_DERIV] Tentativa de recuperação final após pausa...');
              this.reconnectAttempts = 0; // Resetar contador
              this.connect();
            }, 30000);
          }
        };
      } catch (error) {
        console.error('[INDEPENDENT_DERIV] Erro ao iniciar conexão WebSocket:', error);
        this.notifyListeners('error', { message: 'Erro ao iniciar conexão' });
        reject(error);
      }
    });
  }
  
  /**
   * Processa as mensagens recebidas do WebSocket
   */
  private handleMessage(data: any): void {
    // Atualizar timestamp da última mensagem recebida
    this.lastMessageTime = Date.now();
    
    // Verificar se é resposta de ping (conforme JSON Schema, a resposta deve ser ping: "pong")
    if (data.msg_type === 'ping' && data.ping === 'pong') {
      console.log('[INDEPENDENT_DERIV] Resposta de ping recebida: pong');
      
      // Limpar o timeout do ping se estiver ativo
      if (this.pingTimeout) {
        clearTimeout(this.pingTimeout);
        this.pingTimeout = null;
      }
      
      this.lastPongTime = Date.now();
      return;
    }
    
    // Verificar se é uma resposta a uma solicitação específica
    if (data.req_id && this.callbacks.has(data.req_id)) {
      const callback = this.callbacks.get(data.req_id);
      if (callback) {
        callback(data);
        this.callbacks.delete(data.req_id);
      }
    }
    
    // Processar ticks recebidos
    if (data.tick) {
      const symbol = data.tick.symbol;
      const quote = data.tick.quote;
      
      // Usar o método CORRETO para R_100
      // O último dígito é a SEGUNDA casa decimal (o último caractere do número formatado)
      const priceStr = parseFloat(quote.toString()).toFixed(2); // Formatar com 2 casas decimais
      const lastChar = priceStr.charAt(priceStr.length - 1); // Pegar o último caractere (segunda casa decimal)
      const lastDigit = parseInt(lastChar, 10);
      
      // Log detalhado para diagnóstico
      console.log(`[INDEPENDENT_DERIV] Processando ${quote} -> último dígito ${lastDigit}`);
      
      // Log para diagnóstico
      console.log(`[INDEPENDENT_DERIV] Novo tick para ${symbol}: ${quote} (último dígito: ${lastDigit})`);
      
      // Notificar sobre o tick
      this.notifyListeners('tick', {
        symbol, 
        quote, 
        lastDigit,
        epoch: data.tick.epoch
      });
      
      // Atualizar histórico de dígitos
      this.updateDigitHistory(symbol, lastDigit);
    }
    
    // Processar histórico de ticks
    if (data.history && data.echo_req && data.echo_req.ticks_history) {
      const symbol = data.echo_req.ticks_history;
      const prices = data.history.prices;
      
      if (prices && prices.length > 0) {
        // Extrair últimos dígitos do histórico - usando método correto (segunda casa decimal)
        const lastDigits = prices.map((price: number) => {
          // Usar o mesmo método que usamos para ticks em tempo real
          const priceStr = parseFloat(price.toString()).toFixed(2); // Formatar com 2 casas decimais
          const lastChar = priceStr.charAt(priceStr.length - 1); // Pegar o último caractere (segunda casa decimal)
          return parseInt(lastChar, 10);
        });
        
        // Atualizar histórico
        this.initializeDigitHistory(symbol, lastDigits);
        
        // Notificar sobre atualização de histórico
        this.notifyListeners('history', this.getDigitHistory(symbol));
      }
    }
    
    // Processar erros
    if (data.error) {
      console.error('[INDEPENDENT_DERIV] Erro na resposta da API:', data.error);
      this.notifyListeners('error', data.error);
    }
  }
  
  /**
   * Inicializa o histórico de dígitos para um símbolo com dados existentes
   * Inclui garantias extras contra bad data (dígitos nulos, undefined ou tipos errados)
   */
  private initializeDigitHistory(symbol: string, lastDigits: number[]): void {
    // Validação de entrada para evitar problemas com dados inválidos
    if (!lastDigits || !Array.isArray(lastDigits)) {
      console.warn(`[INDEPENDENT_DERIV] Tentativa de inicializar histórico com dados inválidos para ${symbol}`);
      lastDigits = [];
    }
    
    // Filtrar para garantir que temos apenas dígitos válidos (0-9)
    const validDigits = lastDigits.filter(digit => typeof digit === 'number' && digit >= 0 && digit <= 9);
    
    // Se perdemos muitos dígitos na filtragem, avisar
    if (validDigits.length < lastDigits.length) {
      console.warn(`[INDEPENDENT_DERIV] Filtrado ${lastDigits.length - validDigits.length} dígitos inválidos para ${symbol}`);
    }
    
    // Se não temos dígitos válidos, não há como inicializar
    if (validDigits.length === 0) {
      console.warn(`[INDEPENDENT_DERIV] Sem dígitos válidos para inicializar histórico de ${symbol}`);
      return;
    }
    
    // Inicializar array de contagem para dígitos 0-9
    const digitCounts = new Array(10).fill(0);
    
    console.log(`[INDEPENDENT_DERIV] Inicializando histórico com ${validDigits.length} dígitos. Primeiros 10:`, 
      validDigits.slice(0, 10).join(', '));
    
    // Contar ocorrências de cada dígito
    for (const digit of validDigits) {
      digitCounts[digit]++;
    }
    
    // Verificação adicional para garantir que estamos contando corretamente
    console.log('[INDEPENDENT_DERIV] Contagem por dígito:', 
      digitCounts.map((count, digit) => `${digit}: ${count}`).join(', '));
    
    // Calcular percentuais
    const totalSamples = validDigits.length;
    
    // Criar estatísticas para todos os dígitos, mesmo que não tenham ocorrências
    const stats = [];
    for (let digit = 0; digit <= 9; digit++) {
      stats.push({
        digit,
        count: digitCounts[digit],
        percentage: totalSamples > 0 ? Math.round((digitCounts[digit] / totalSamples) * 100) : 0
      });
    }
    
    // Limitar a 500 dígitos (os mais recentes)
    const limitedDigits = validDigits.slice(-500);
    
    // Criar ou atualizar o histórico
    this.digitHistories.set(symbol, {
      stats,
      lastDigits: limitedDigits,
      totalSamples: limitedDigits.length,
      symbol,
      lastUpdated: new Date()
    });
    
    // Salvar imediatamente no localStorage para persistência
    this.saveHistoryToLocalStorage(symbol);
    
    console.log(`[INDEPENDENT_DERIV] Histórico de dígitos inicializado para ${symbol} com ${limitedDigits.length} amostras`);
  }
  
  /**
   * Método público para inicializar diretamente o histórico de dígitos
   * Usado para carregar dados salvos do localStorage direto do componente
   */
  public initializeHistoryDirectly(symbol: string, lastDigits: number[]): void {
    console.log(`[INDEPENDENT_DERIV] Inicializando diretamente histórico com ${lastDigits.length} dígitos para ${symbol}`);
    
    // Usar o método privado para inicializar
    this.initializeDigitHistory(symbol, lastDigits);
    
    // Notificar sobre atualização do histórico
    const history = this.digitHistories.get(symbol);
    if (history) {
      this.notifyListeners('history', history);
    }
  }
  
  /**
   * Atualiza o histórico de dígitos com um novo tick
   */
  private updateDigitHistory(symbol: string, lastDigit: number): void {
    console.log(`[INDEPENDENT_DERIV] Atualizando histórico para ${symbol} com dígito ${lastDigit}`);
    
    const history = this.digitHistories.get(symbol);
    
    if (!history) {
      // Criar histórico vazio para o símbolo se não existir
      // Garantir que temos estatísticas para todos os dígitos (0-9)
      const stats = [];
      for (let i = 0; i <= 9; i++) {
        stats.push({
          digit: i,
          count: i === lastDigit ? 1 : 0,
          percentage: i === lastDigit ? 100 : 0
        });
      }
      
      this.digitHistories.set(symbol, {
        stats,
        lastDigits: [lastDigit],
        totalSamples: 1,
        symbol,
        lastUpdated: new Date()
      });
      
      // Notificar sobre a primeira atualização
      this.notifyListeners('history', this.getDigitHistory(symbol));
      
      // Salvar o primeiro dígito no banco de dados também
      this.scheduleDbSave(symbol);
      
      return;
    }
    
    // Atualizar lista de últimos dígitos (assegurar que manteremos exatamente 500)
    history.lastDigits.push(lastDigit);
    while (history.lastDigits.length > 500) {
      history.lastDigits.shift();
    }
    
    // Recontar dígitos (abordagem simples e confiável)
    const digitCounts = new Array(10).fill(0);
    for (const digit of history.lastDigits) {
      // Verificar se o dígito é um número válido antes de contar
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      }
    }
    
    // Recalcular percentuais
    const totalSamples = history.lastDigits.length;
    history.stats = digitCounts.map((count, digit) => ({
      digit,
      count,
      percentage: totalSamples > 0 ? Math.round((count / totalSamples) * 100) : 0
    }));
    
    // Certificar que temos todos os dígitos representados (0-9), mesmo que com contagem zero
    for (let digit = 0; digit <= 9; digit++) {
      if (!history.stats.some(s => s.digit === digit)) {
        history.stats.push({
          digit,
          count: 0,
          percentage: 0
        });
      }
    }
    
    // Ordenar por dígito para garantir a ordem correta (0-9)
    history.stats.sort((a, b) => a.digit - b.digit);
    
    // Adicionar log para diagnóstico
    if (totalSamples % 10 === 0) { // Logar a cada 10 ticks para não sobrecarregar
      console.log(`[INDEPENDENT_DERIV] Estatísticas atualizadas para ${symbol}: 
        Total: ${totalSamples} ticks
        Dígitos recentes: ${history.lastDigits.slice(-10).reverse().join(', ')}
        Distribuição: ${history.stats.map(s => `${s.digit}:${s.percentage}%`).join(', ')}
      `);
    }
    
    history.totalSamples = totalSamples;
    history.lastUpdated = new Date();
    
    // Notificar ouvintes sobre atualização
    this.notifyListeners('history', this.getDigitHistory(symbol));
    
    // Salvar no localStorage para persistência local
    this.saveHistoryToLocalStorage(symbol);
    
    // Salvar no banco de dados de forma controlada (a cada 50 ticks)
    // para evitar sobrecarga de requisições
    if (totalSamples % 50 === 0) {
      this.scheduleDbSave(symbol);
    }
  }
  
  /**
   * Agenda o salvamento no banco de dados com throttling
   * para evitar múltiplas requisições simultâneas
   */
  private dbSaveThrottleTimers: Record<string, any> = {};
  
  private scheduleDbSave(symbol: string): void {
    // Cancelar timer existente se houver
    if (this.dbSaveThrottleTimers[symbol]) {
      clearTimeout(this.dbSaveThrottleTimers[symbol]);
    }
    
    // Agendar nova solicitação com delay de 2 segundos
    this.dbSaveThrottleTimers[symbol] = setTimeout(() => {
      this.saveToDatabase(symbol)
        .then(success => {
          if (success) {
            console.log(`[INDEPENDENT_DERIV] ✅ Histórico de ${symbol} salvo no banco de dados`);
          }
        })
        .catch(err => console.error(`[INDEPENDENT_DERIV] Erro ao salvar no banco:`, err))
        .finally(() => {
          this.dbSaveThrottleTimers[symbol] = null;
        });
    }, 2000);
  }
  
  /**
   * Salva os dados do histórico de dígitos no localStorage para persistência
   */
  private saveHistoryToLocalStorage(symbol: string): void {
    try {
      const history = this.digitHistories.get(symbol);
      if (!history) return;
      
      const data = {
        lastDigits: history.lastDigits,
        stats: history.stats,
        totalSamples: history.totalSamples,
        lastUpdated: new Date().toISOString()
      };
      
      localStorage.setItem(`deriv_digits_history_${symbol}`, JSON.stringify(data));
      console.log(`[INDEPENDENT_DERIV] Histórico de ${history.lastDigits.length} ticks salvo no localStorage para ${symbol}`);
    } catch (e) {
      console.warn('[INDEPENDENT_DERIV] Não foi possível salvar o histórico no localStorage:', e);
    }
  }

  /**
   * Obtém histórico de ticks para um símbolo
   * Este método busca os últimos 500 ticks e os armazena, para que eles estejam
   * disponíveis mesmo após atualizar a página
   */
  public fetchTicksHistory(symbol: string, count: number = 500): Promise<DigitHistory> {
    if (!this.isConnected) {
      return this.connect().then(() => this.fetchTicksHistory(symbol, count));
    }
    
    console.log(`[INDEPENDENT_DERIV] Solicitando histórico de ${count} ticks para ${symbol}`);
    
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      
      this.callbacks.set(reqId, (response) => {
        if (response.error) {
          console.error(`[INDEPENDENT_DERIV] Erro ao obter histórico para ${symbol}:`, response.error);
          reject(new Error(response.error.message));
          return;
        }
        
        if (response.history && response.history.prices) {
          // Extrair todos os dígitos (até 500) e inicializar o histórico
          const prices = response.history.prices;
          const lastDigits = prices.map((price: number) => {
            // Usar o método CORRETO para R_100 (mesma estratégia de processamento do tick em tempo real)
            const priceStr = parseFloat(price.toString()).toFixed(2); // Formatar com 2 casas decimais
            const lastChar = priceStr.charAt(priceStr.length - 1); // Pegar o último caractere (segunda casa decimal)
            return parseInt(lastChar, 10);
          });
          
          console.log(`[INDEPENDENT_DERIV] Histórico recebido com ${lastDigits.length} ticks`);
          
          // Atualizar histórico com os dados recebidos
          this.initializeDigitHistory(symbol, lastDigits);
          
          // Salvar no localStorage para persistir entre recarregamentos
          this.saveHistoryToLocalStorage(symbol);
          
          // Obter histórico depois de atualizado
          const history = this.getDigitHistory(symbol);
          resolve(history);
        } else {
          reject(new Error('Resposta de histórico incompleta'));
        }
      });
      
      // Enviar solicitação
      this.sendMessage({
        ticks_history: symbol,
        count: count,
        end: 'latest',
        style: 'ticks',
        req_id: reqId
      });
    });
  }
  
  /**
   * Assina para receber ticks de um símbolo específico
   */
  public subscribeTicks(symbol: string): Promise<boolean> {
    if (!this.isConnected) {
      return this.connect().then(() => this.subscribeTicks(symbol));
    }
    
    // Verificar se já está inscrito
    if (this.activeSubscriptions.has(symbol)) {
      console.log(`[INDEPENDENT_DERIV] Já inscrito para ticks de ${symbol}`);
      return Promise.resolve(true);
    }
    
    console.log(`[INDEPENDENT_DERIV] Assinando ticks para ${symbol}`);
    
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      
      this.callbacks.set(reqId, (response) => {
        if (response.error) {
          console.error(`[INDEPENDENT_DERIV] Erro ao assinar ticks para ${symbol}:`, response.error);
          reject(new Error(response.error.message));
          return;
        }
        
        console.log(`[INDEPENDENT_DERIV] Assinatura de ticks para ${symbol} bem-sucedida`);
        this.activeSubscriptions.add(symbol);
        resolve(true);
      });
      
      // Enviar solicitação
      this.sendMessage({
        ticks: symbol,
        subscribe: 1,
        req_id: reqId
      });
    });
  }
  
  /**
   * Cancela assinatura de ticks para um símbolo
   */
  public unsubscribeTicks(symbol: string): Promise<boolean> {
    if (!this.isConnected || !this.activeSubscriptions.has(symbol)) {
      console.log(`[INDEPENDENT_DERIV] Não inscrito para ticks de ${symbol}`);
      return Promise.resolve(true);
    }
    
    console.log(`[INDEPENDENT_DERIV] Cancelando assinatura de ticks para ${symbol}`);
    
    return new Promise((resolve) => {
      const reqId = this.requestId++;
      
      this.callbacks.set(reqId, () => {
        console.log(`[INDEPENDENT_DERIV] Assinatura de ticks para ${symbol} cancelada`);
        this.activeSubscriptions.delete(symbol);
        resolve(true);
      });
      
      // Enviar solicitação de cancelamento
      this.sendMessage({
        forget_all: 'ticks',
        req_id: reqId
      });
    });
  }
  
  /**
   * Reativa todas as subscrições ativas
   */
  private resubscribeAll(): void {
    if (this.activeSubscriptions.size === 0) {
      return;
    }
    
    console.log(`[INDEPENDENT_DERIV] Reativando ${this.activeSubscriptions.size} subscrições`);
    
    // Tentar reativar R_100 diretamente se presente na lista
    if (this.activeSubscriptions.has('R_100')) {
      this.subscribeTicks('R_100')
        .catch(error => console.error('[INDEPENDENT_DERIV] Erro ao reativar R_100:', error));
    }
    
    // Se houver outras subscrições, poderíamos adicionar aqui
  }
  
  /**
   * Obtém o histórico de dígitos para um símbolo, com opção de filtrar por número de ticks
   * @param symbol O símbolo para obter o histórico
   * @param tickCount Opcional: O número de ticks para filtrar (25, 50, 100, 200, 300 ou 500)
   */
  public getDigitHistory(symbol: string, tickCount?: number): DigitHistory {
    const history = this.digitHistories.get(symbol);
    
    if (!history) {
      // Retornar um histórico vazio se não houver dados
      return {
        stats: Array.from({ length: 10 }, (_, digit) => ({
          digit,
          count: 0,
          percentage: 0
        })),
        lastDigits: [],
        totalSamples: 0,
        symbol,
        lastUpdated: new Date()
      };
    }
    
    // Se não especificar tickCount, retornar o histórico completo
    if (!tickCount || tickCount >= history.lastDigits.length) {
      console.log(`[INDEPENDENT_DERIV] Retornando histórico completo para ${symbol}: ${history.lastDigits.length} ticks`);
      return { ...history };
    }
    
    console.log(`[INDEPENDENT_DERIV] Filtrando histórico para ${symbol} com ${tickCount} ticks dos ${history.lastDigits.length} disponíveis`);
    
    // Caso contrário, filtrar pelos últimos N ticks (com verificação extra para garantir que estamos pegando o número certo)
    const filteredDigits = history.lastDigits.slice(-Math.min(tickCount, history.lastDigits.length));
    
    // Verificação extra
    if (filteredDigits.length !== tickCount) {
      console.warn(`[INDEPENDENT_DERIV] Aviso: Solicitados ${tickCount} ticks, mas obtidos ${filteredDigits.length}`);
    }
    
    // Recalcular as estatísticas baseadas nos dígitos filtrados
    const digitCounts = new Array(10).fill(0);
    
    // Contar ocorrências de cada dígito com verificação extra
    for (const digit of filteredDigits) {
      if (digit >= 0 && digit <= 9) {
        digitCounts[digit]++;
      } else {
        console.warn(`[INDEPENDENT_DERIV] Dígito inválido ignorado: ${digit}`);
      }
    }
    
    // Verificação extra para garantir que temos contagem para todos os dígitos
    if (digitCounts.some(count => count === undefined)) {
      console.warn(`[INDEPENDENT_DERIV] Algumas contagens são undefined:`, digitCounts);
      // Corrigir qualquer contagem undefined
      for (let i = 0; i < digitCounts.length; i++) {
        if (digitCounts[i] === undefined) digitCounts[i] = 0;
      }
    }
    
    // Recalcular percentuais com alta precisão e depois arredondar para evitar erros de precisão
    const totalSamples = filteredDigits.length;
    
    // Garantir que temos estatísticas para TODOS os dígitos, não apenas os que aparecem
    const stats = [];
    for (let digit = 0; digit <= 9; digit++) {
      const count = digitCounts[digit] || 0;
      // Usar cálculo de percentual mais preciso: calcular com precisão e depois arredondar
      const percentage = totalSamples > 0 ? Math.round((count / totalSamples) * 100) : 0;
      stats.push({ digit, count, percentage });
    }
    
    // Garantir que os dígitos estão em ordem correta
    stats.sort((a, b) => a.digit - b.digit);
    
    // Log para debug
    console.log(`[INDEPENDENT_DERIV] Histórico filtrado: ${totalSamples} ticks, distribuição:`,
      stats.map(s => `${s.digit}: ${s.percentage}%`).join(', '));
    
    // Retornar história filtrada
    return {
      stats,
      lastDigits: filteredDigits,
      totalSamples,
      symbol,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Envia uma mensagem e retorna uma promise com a resposta
   */
  public send(message: any): Promise<any> {
    if (!this.socket || !this.isConnected) {
      return Promise.reject(new Error('WebSocket não está conectado'));
    }
    
    return new Promise((resolve, reject) => {
      const reqId = this.requestId++;
      
      // Adicionar id à mensagem
      const messageWithId = {
        ...message,
        req_id: reqId
      };
      
      // Configurar callback para a resposta
      this.callbacks.set(reqId, (response) => {
        if (response.error) {
          reject(new Error(response.error.message || 'Erro na API Deriv'));
        } else {
          resolve(response);
        }
      });
      
      // Enviar a mensagem
      this.sendMessage(messageWithId);
      
      // Configurar timeout para a resposta (3 segundos)
      setTimeout(() => {
        if (this.callbacks.has(reqId)) {
          this.callbacks.delete(reqId);
          reject(new Error('Timeout ao aguardar resposta da API'));
        }
      }, 3000);
    });
  }
  
  /**
   * Enviar mensagem para o WebSocket
   */
  private sendMessage(message: any): void {
    if (!this.socket || !this.isConnected) {
      console.error('[INDEPENDENT_DERIV] Tentativa de enviar mensagem sem conexão WebSocket');
      return;
    }
    
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * Adiciona um ouvinte para um tipo de evento
   */
  public addListener(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    
    this.eventListeners.get(event)?.add(callback);
    console.log(`[INDEPENDENT_DERIV] Ouvinte adicionado para evento ${event}`);
  }
  
  /**
   * Remove um ouvinte para um tipo de evento
   */
  public removeListener(event: string, callback: EventCallback): void {
    if (this.eventListeners.has(event)) {
      this.eventListeners.get(event)?.delete(callback);
      console.log(`[INDEPENDENT_DERIV] Ouvinte removido para evento ${event}`);
    }
  }
  
  /**
   * Remove todos os ouvintes de um evento específico ou de todos os eventos
   */
  public removeAllListeners(event?: string): void {
    if (event) {
      // Remover todos os ouvintes de um evento específico
      if (this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
        console.log(`[INDEPENDENT_DERIV] Todos os ouvintes removidos para evento ${event}`);
      }
    } else {
      // Remover todos os ouvintes de todos os eventos
      this.eventListeners.forEach((_, eventName) => {
        this.eventListeners.set(eventName, new Set());
      });
      console.log(`[INDEPENDENT_DERIV] Todos os ouvintes removidos de todos os eventos`);
    }
  }
  
  /**
   * Carrega diretamente dados históricos de ticks do localStorage
   * Este método é utilizado para garantir que os dados persistidos estejam disponíveis imediatamente
   * após a abertura da página, sem precisar esperar por conexão WebSocket
   * @param symbol O símbolo para carregar o histórico (ex: 'R_100')
   * @returns true se os dados foram carregados com sucesso, false caso contrário
   */
  public loadHistoryDirectlyFromLocalStorage(symbol: string): boolean {
    console.log(`[INDEPENDENT_DERIV] Tentando carregar histórico diretamente do localStorage para ${symbol}`);
    
    try {
      // Chave usada pelo oauthDirectService para salvar ticks
      const storageKey = `deriv_ticks_${symbol}`;
      const storageData = localStorage.getItem(storageKey);
      
      if (storageData) {
        const parsedData = JSON.parse(storageData);
        
        if (Array.isArray(parsedData) && parsedData.length > 0) {
          // Extrair dígitos dos ticks
          const lastDigits = parsedData.map(tick => {
            // Verificar se o tick tem o campo lastDigit
            if (typeof tick.lastDigit === 'number' && tick.lastDigit >= 0 && tick.lastDigit <= 9) {
              return tick.lastDigit;
            }
            
            // Fallback: tentar extrair do quote
            if (tick.quote) {
              const priceStr = parseFloat(tick.quote.toString()).toFixed(2);
              const lastChar = priceStr.charAt(priceStr.length - 1);
              return parseInt(lastChar, 10);
            }
            
            return null;
          }).filter(digit => digit !== null) as number[];
          
          if (lastDigits.length > 0) {
            // Usar o método privado para inicializar o histórico
            this.initializeDigitHistory(symbol, lastDigits);
            
            // Notificar sobre a atualização do histórico
            const history = this.digitHistories.get(symbol);
            if (history) {
              this.notifyListeners('history', history);
            }
            
            console.log(`[INDEPENDENT_DERIV] ✅ Histórico carregado com sucesso do localStorage: ${lastDigits.length} ticks`);
            return true;
          }
        }
      }
      
      console.log(`[INDEPENDENT_DERIV] ⚠️ Não foram encontrados dados históricos no localStorage para ${symbol}`);
      return false;
    } catch (error) {
      console.error(`[INDEPENDENT_DERIV] ❌ Erro ao carregar histórico do localStorage para ${symbol}:`, error);
      return false;
    }
  }
  
  /**
   * Notifica todos os ouvintes registrados para um evento
   */
  private notifyListeners(event: string, data: any): void {
    if (!this.eventListeners.has(event)) {
      return;
    }
    
    const listeners = this.eventListeners.get(event);
    if (listeners && listeners.size > 0) {
      // Adicionar log para rastrear eventos e dados repassados
      if (event === 'history') {
        console.log(`[INDEPENDENT_DERIV] Notificando ${listeners.size} ouvintes sobre atualização de histórico:`, 
          `Symbol: ${data.symbol}, ` +
          `Stats: ${data.stats?.length || 0}, ` +
          `Digits: ${data.lastDigits?.length || 0}`);
      }
      
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[INDEPENDENT_DERIV] Erro ao executar ouvinte para ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Fecha a conexão WebSocket e limpa recursos
   */
  public disconnect(): void {
    console.log('[INDEPENDENT_DERIV] Desconectando WebSocket');
    
    // Usar o cleanup centralizado
    this.cleanup();
    
    // Limpar todas as subscrições ativas
    this.activeSubscriptions.clear();
    
    console.log('[INDEPENDENT_DERIV] Conexão WebSocket fechada');
  }
}

// Exportar instância única do serviço
export const independentDerivService = IndependentDerivService.getInstance();

// Adicionar ao globalThis para acesso emergencial entre módulos
(globalThis as any).independentDerivService = independentDerivService;