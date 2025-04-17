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
const WS_URL = 'wss://ws.derivws.com/websockets/v3?app_id=' + APP_ID; 

// Estado global
let socket: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let tickListeners: Array<(tick: any) => void> = [];
let subscribedSymbols = new Set<string>();

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
          resolve(false);
        }
      }, 10000);

      socket!.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log("[R100] Conexão estabelecida com sucesso!");
        
        // Configurar ping para manter a conexão ativa
        startPingInterval();
        
        // Autenticar com o token
        authenticate();
        
        resolve(true);
      };

      socket!.onclose = (event) => {
        clearTimeout(connectionTimeout);
        console.warn(`[R100] Conexão fechada: ${event.code}`);
        
        // Limpar ping interval
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        
        socket = null;
        
        // Agendar reconexão
        scheduleReconnect();
        
        resolve(false);
      };

      socket!.onerror = (error) => {
        console.error("[R100] Erro na conexão:", error);
        // onclose será chamado automaticamente
      };

      socket!.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.tick) {
            notifyTickListeners(response.tick);
          } 
          else if (response.error) {
            console.error("[R100] Erro da API:", response.error);
          }
          else if (response.authorize) {
            console.log("[R100] Autenticação bem-sucedida!");
            
            // Se tiver símbolos subscritos anteriormente, reinscrever
            if (subscribedSymbols.size > 0) {
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
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }
  
  reconnectTimeout = setTimeout(() => {
    connectWebSocket().catch(console.error);
  }, 5000);
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
      socket!.send(JSON.stringify({ ping: 1 }));
    } else {
      clearInterval(pingInterval!);
      pingInterval = null;
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
  
  // Adiciona ao conjunto de símbolos inscritos
  subscribedSymbols.add(symbol);
  
  // Se não estiver conectado, tenta conectar primeiro
  if (!isConnected()) {
    return connectWebSocket();
  }
  
  try {
    const request = {
      ticks: symbol,
      subscribe: 1
    };
    
    socket!.send(JSON.stringify(request));
    console.log(`[R100] Inscrito em ${symbol}`);
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
  
  // Remove do conjunto de símbolos inscritos
  subscribedSymbols.delete(symbol);
  
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
  // Notifica callbacks registrados
  tickListeners.forEach(listener => {
    try {
      listener(tick);
    } catch (error) {
      console.error("[R100] Erro no listener de tick:", error);
    }
  });
  
  // Dispara evento customizado para quem quiser escutar via addEventListener
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
  
  // Evitar duplicação
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
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Limpar dados
  subscribedSymbols.clear();
  
  if (socket) {
    try {
      socket.close();
    } catch (error) {
      console.error("[R100] Erro ao fechar socket:", error);
    }
    socket = null;
  }
  
  console.log("[R100] WebSocket fechado e recursos liberados");
}

/**
 * Inicia o sistema de keep-alive
 */
export function startKeepAlive() {
  console.log("[R100] Iniciando sistema de keep-alive");
  
  connectWebSocket().catch(error => {
    console.error("[R100] Erro ao iniciar keep-alive:", error);
  });
  
  // Adicionar event listeners para reconexão automática
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleNetworkChange);
  window.addEventListener('focus', handleVisibilityChange);
}

/**
 * Para o sistema de keep-alive
 */
export function stopKeepAlive() {
  console.log("[R100] Interrompendo sistema de keep-alive");
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleNetworkChange);
  window.removeEventListener('focus', handleVisibilityChange);
  
  closeWebSocket();
}

/**
 * Reconecta quando a aba volta a ficar visível
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && !isConnected()) {
    console.log("[R100] Página visível novamente, reconectando...");
    connectWebSocket().catch(console.error);
  }
}

/**
 * Reconecta quando a conexão de rede volta
 */
function handleNetworkChange() {
  if (window.navigator.onLine && !isConnected()) {
    console.log("[R100] Conexão de rede disponível, reconectando...");
    connectWebSocket().catch(console.error);
  }
}

// Exportar objeto para uso conveniente
export default {
  connect: connectWebSocket,
  subscribe: subscribeToSymbol,
  unsubscribe: unsubscribeFromSymbol,
  addListener: addTickListener,
  removeListener: removeTickListener,
  isConnected,
  close: closeWebSocket,
  startKeepAlive,
  stopKeepAlive
};