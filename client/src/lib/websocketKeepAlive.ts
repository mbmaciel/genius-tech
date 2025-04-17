/**
 * WebSocketKeepAlive - Conexão permanente com a API Deriv para obter dados do R_100
 * Esta conexão é separada da conexão OAuth e usada exclusivamente para obter dados em tempo real
 * 
 * Implementação baseada na documentação oficial da Deriv:
 * https://api.deriv.com/docs/getting-started/websocket-intro/
 */

// Configuração da conexão WebSocket
const TOKEN = 'jybcQm0FbKr7evp'; // Token exclusivo para R_100
const APP_ID = 71403; // App ID do projeto
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`; // URL com app_id como parâmetro

// Estado global
let socket: WebSocket | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let tickListeners: Array<(tick: any) => void> = [];
let subscribedSymbols: string[] = []; // Array em vez de Set para melhor compatibilidade
let isReconnecting = false;
let reconnectAttempts = 0;
let MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Verifica se o WebSocket está conectado
 */
export const isConnected = (): boolean => {
  return socket !== null && socket.readyState === WebSocket.OPEN;
};

/**
 * Conecta ao WebSocket da Deriv usando o token específico para R_100
 */
export const connectWebSocket = async (): Promise<boolean> => {
  // Se já está conectado, não reconecta
  if (isConnected()) {
    return true;
  }

  // Se está reconectando, não inicia outra tentativa
  if (isReconnecting) {
    return false;
  }

  // Marca estado de reconexão
  isReconnecting = true;

  try {
    // Limpar qualquer conexão anterior
    if (socket) {
      try {
        socket.close();
      } catch (e) {
        console.error("[R100] Erro ao fechar conexão anterior:", e);
      }
      socket = null;
    }

    // Limpar timers existentes
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    console.log("[R100] Conectando ao WebSocket da Deriv...");
    // Criar nova conexão
    socket = new WebSocket(WS_URL);

    return new Promise((resolve) => {
      // Timeout para evitar espera indefinida
      const connectionTimeout = setTimeout(() => {
        if (!isConnected()) {
          console.warn("[R100] Timeout na conexão WebSocket");
          if (socket) socket.close();
          socket = null;
          isReconnecting = false;
          resolve(false);
        }
      }, 10000);

      // Evento de abertura da conexão
      socket!.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("[R100] Conexão estabelecida com sucesso!");
        
        // Configurar ping para manter a conexão ativa
        startPingInterval();
        
        // Autenticar com o token
        authenticate();
        
        isReconnecting = false;
        reconnectAttempts = 0;
        resolve(true);
      };

      // Evento de erro na conexão
      socket!.onerror = (error) => {
        if (window.location.pathname !== '/dashboard') {
          // Se não estiver no dashboard, é provavelmente erro de navegação
          console.log("[R100] Conexão interrompida durante navegação");
        } else {
          console.error("[R100] Erro na conexão:", error);
        }
        // onclose será chamado automaticamente
      };

      // Evento de fechamento da conexão
      socket!.onclose = (event) => {
        clearTimeout(connectionTimeout);
        
        // Código 1006 é esperado durante navegação entre páginas
        if (event.code === 1006) {
          console.log(`[R100] Conexão interrompida durante navegação`);
        } else {
          console.warn(`[R100] Conexão fechada: ${event.code}`);
        }
        
        socket = null;
        isReconnecting = false;
        
        // Agendar reconexão
        scheduleReconnect();
        
        resolve(false);
      };

      // Evento de mensagem recebida
      socket!.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.tick) {
            // Notifica sobre novo tick
            notifyTickListeners(response.tick);
          } 
          else if (response.error) {
            console.error("[R100] Erro da API:", response.error);
          }
          else if (response.authorize) {
            console.log("[R100] Autenticação bem-sucedida!");
            
            // Se tiver símbolos subscritos anteriormente, reinscrever
            if (subscribedSymbols.length > 0) {
              for (const symbol of subscribedSymbols) {
                subscribeToSymbol(symbol);
              }
            } else {
              // Inscrever no R_100 por padrão
              subscribeToSymbol('R_100');
            }
          }
        } catch (error) {
          console.error("[R100] Erro ao processar mensagem:", error);
        }
      };
    });
  } catch (error) {
    console.error("[R100] Erro ao configurar WebSocket:", error);
    isReconnecting = false;
    scheduleReconnect();
    return false;
  } 
};

/**
 * Autentica usando o token
 */
function authenticate() {
  if (!isConnected()) return;
  
  try {
    const authRequest = {
      authorize: TOKEN
    };
    
    socket!.send(JSON.stringify(authRequest));
  } catch (error) {
    console.error("[R100] Erro ao enviar autenticação:", error);
  }
}

/**
 * Agenda reconexão
 */
function scheduleReconnect() {
  // Não agenda reconexão se já atingiu o limite de tentativas
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[R100] Número máximo de tentativas de reconexão atingido');
    return;
  }
  
  // Limpa qualquer timeout existente
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  // Incrementa contador e calcula delay
  reconnectAttempts++;
  const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
  
  console.log(`[R100] Agendando reconexão em ${Math.round(delay/1000)}s (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
  
  // Agenda nova tentativa
  reconnectTimeout = setTimeout(() => {
    console.log(`[R100] Tentativa de reconexão ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}...`);
    connectWebSocket().catch(console.error);
  }, delay);
}

/**
 * Configura o intervalo de ping para manter conexão ativa
 */
function startPingInterval() {
  if (pingInterval) {
    clearInterval(pingInterval);
  }
  
  pingInterval = setInterval(() => {
    if (isConnected()) {
      try {
        socket!.send(JSON.stringify({ ping: 1 }));
      } catch (error) {
        console.error("[R100] Erro ao enviar ping:", error);
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        
        // Reconectar se o ping falhar
        if (!isReconnecting) {
          connectWebSocket().catch(console.error);
        }
      }
    } else {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
    }
  }, 30000); // Ping a cada 30 segundos
}

/**
 * Inscreve para receber ticks de um símbolo
 */
export function subscribeToSymbol(symbol: string): Promise<boolean> {
  if (!symbol) {
    return Promise.reject(new Error("Símbolo não informado"));
  }
  
  // Adiciona ao array de símbolos inscritos se ainda não existir
  if (!subscribedSymbols.includes(symbol)) {
    subscribedSymbols.push(symbol);
  }
  
  // Se não estiver conectado, tenta conectar primeiro
  if (!isConnected()) {
    return connectWebSocket().then(() => {
      // A conexão foi estabelecida, a função authenticate já foi chamada
      // e o evento onmessage já tratará a inscrição após a autenticação
      return true;
    }).catch(() => {
      console.error(`[R100] Falha ao conectar para inscrever em ${symbol}`);
      return false;
    });
  }
  
  // Se já está conectado, envia requisição de inscrição
  try {
    const request = {
      ticks: symbol,
      subscribe: 1
    };
    
    socket!.send(JSON.stringify(request));
    console.log(`[R100] Inscrito em ${symbol} em tempo real`);
    return Promise.resolve(true);
  } catch (error) {
    console.error(`[R100] Erro ao inscrever em ${symbol}:`, error);
    return Promise.reject(error);
  }
}

/**
 * Cancela inscrição de um símbolo
 */
export function unsubscribeFromSymbol(symbol: string): Promise<boolean> {
  if (!symbol) {
    return Promise.reject(new Error("Símbolo não informado"));
  }
  
  // Remove do array de símbolos inscritos
  const index = subscribedSymbols.indexOf(symbol);
  if (index !== -1) {
    subscribedSymbols.splice(index, 1);
  }
  
  // Se não estiver conectado, não precisa fazer nada
  if (!isConnected()) {
    return Promise.resolve(false);
  }
  
  try {
    const request = {
      forget_all: ["ticks"]
    };
    
    socket!.send(JSON.stringify(request));
    console.log(`[R100] Cancelada inscrição em ticks`);
    
    // Reinscreve nos símbolos restantes
    for (const s of subscribedSymbols) {
      if (s !== symbol) {
        subscribeToSymbol(s);
      }
    }
    
    return Promise.resolve(true);
  } catch (error) {
    console.error("[R100] Erro ao cancelar inscrição:", error);
    return Promise.reject(error);
  }
}

/**
 * Notifica todos os listeners sobre um novo tick
 */
function notifyTickListeners(tick: any) {
  // Notifica listeners registrados
  tickListeners.forEach(listener => {
    try {
      listener(tick);
    } catch (error) {
      console.error("[R100] Erro no listener de tick:", error);
    }
  });
  
  // Dispara evento personalizado
  try {
    const event = new CustomEvent('deriv:tick', { 
      detail: { tick },
      bubbles: true,
      cancelable: true 
    });
    document.dispatchEvent(event);
  } catch (error) {
    console.error("[R100] Erro ao disparar evento de tick:", error);
  }
}

/**
 * Adiciona um listener para receber ticks
 */
export function addTickListener(listener: (tick: any) => void) {
  if (typeof listener !== 'function') return;
  
  // Evita duplicações
  if (!tickListeners.includes(listener)) {
    tickListeners.push(listener);
  }
}

/**
 * Remove um listener de ticks
 */
export function removeTickListener(listener: (tick: any) => void) {
  const index = tickListeners.indexOf(listener);
  if (index !== -1) {
    tickListeners.splice(index, 1);
  }
}

/**
 * Fecha a conexão WebSocket e limpa recursos
 */
export function closeWebSocket() {
  if (socket) {
    try {
      socket.close();
    } catch (e) {
      console.error("[R100] Erro ao fechar WebSocket:", e);
    }
    socket = null;
  }
  
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  subscribedSymbols = []; // Limpa o array
  console.log("[R100] WebSocket fechado e recursos liberados");
}

/**
 * Inicia o sistema de keep-alive
 */
export function startKeepAlive() {
  console.log("[R100] Iniciando sistema de keep-alive");
  
  // Reset reconnect attempts to ensure it starts fresh
  reconnectAttempts = 0;
  
  // Adiciona event listeners para reconexão automática
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleNetworkChange);
  
  try {
    // Inicia conexão
    connectWebSocket().catch(error => {
      console.error("[R100] Erro ao iniciar conexão:", error);
      scheduleReconnect(); // Agenda reconexão em caso de erro
    });
  } catch (error) {
    console.error("[R100] Erro ao iniciar sistema de keep-alive:", error);
    scheduleReconnect(); // Agenda reconexão em caso de erro
  }
}

/**
 * Para o sistema de keep-alive
 */
export function stopKeepAlive() {
  console.log("[R100] Parando sistema de keep-alive");
  
  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleNetworkChange);
  
  // Fecha conexão
  closeWebSocket();
}

/**
 * Manipulador de evento de visibilidade da página
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && !isConnected() && !isReconnecting) {
    console.log("[R100] Página visível, reconectando...");
    connectWebSocket().catch(console.error);
  }
}

/**
 * Manipulador de evento de rede
 */
function handleNetworkChange() {
  if (window.navigator.onLine && !isConnected() && !isReconnecting) {
    console.log("[R100] Rede disponível, reconectando...");
    connectWebSocket().catch(console.error);
  }
}

/**
 * Redefine o contador de tentativas de reconexão
 */
export function resetReconnectAttempts() {
  reconnectAttempts = 0;
  console.log("[R100] Contador de tentativas de reconexão redefinido");
}

// Exporta objeto com todos os métodos
export default {
  connect: connectWebSocket,
  subscribe: subscribeToSymbol,
  unsubscribe: unsubscribeFromSymbol,
  addListener: addTickListener,
  removeListener: removeTickListener,
  isConnected,
  close: closeWebSocket,
  startKeepAlive,
  stopKeepAlive,
  resetReconnectAttempts
};