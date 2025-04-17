/**
 * WebSocketKeepAlive - Conexão permanente com a API Deriv para obter dados do R_100
 * Esta conexão é separada da conexão OAuth e usada exclusivamente para obter dados em tempo real
 * 
 * Implementação baseada na documentação oficial da Deriv:
 * https://api.deriv.com/docs/getting-started/websocket-intro/
 */

// Configuração da conexão WebSocket
const TOKEN = 'jybcQm0FbKr7evp'; // Token específico para conexão com dados do R_100
const WS_URL = 'wss://ws.derivws.com/websockets/v3'; // Endpoint recomendado na documentação

// Estado global
let socket: WebSocket | null = null;
let isConnecting = false;
let reconnectTimeout: NodeJS.Timeout | null = null;
let pingInterval: NodeJS.Timeout | null = null;
let subscribedSymbols: Set<string> = new Set();
let tickListeners: Array<(tick: any) => void> = [];
let connectionStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';

/**
 * Conecta ao WebSocket da Deriv e mantém a conexão ativa
 * @returns Promise<boolean> indicando se a conexão foi bem sucedida
 */
// Controle de tentativas de conexão
let currentServerIndex = 0;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 5;

/**
 * Tenta conectar usando diferentes endpoints
 */
export const connectWebSocket = async (): Promise<boolean> => {
  // Evitar conexões múltiplas
  if (isConnecting) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (connectionStatus === 'connected') {
          clearInterval(checkInterval);
          resolve(true);
        } else if (connectionStatus === 'disconnected') {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  // Se já está conectado, retorna
  if (socket && socket.readyState === WebSocket.OPEN) {
    connectionStatus = 'connected';
    return true;
  }

  isConnecting = true;
  connectionStatus = 'connecting';
  
  // Se excedeu o número máximo de tentativas, reinicia o contador e troca o servidor
  if (connectionAttempts >= MAX_CONNECTION_ATTEMPTS) {
    connectionAttempts = 0;
    currentServerIndex = (currentServerIndex + 1) % WS_URLS.length;
  }

  // Incrementa contador de tentativas
  connectionAttempts++;
  
  // Obtém o servidor atual
  const currentWsUrl = WS_URLS[currentServerIndex];

  try {
    console.log(`[R100] Conectando ao WebSocket (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}) [${currentWsUrl}]...`);
    
    // Fecha conexão existente se houver
    if (socket) {
      try {
        socket.close();
      } catch (e) {
        console.error("[R100] Erro ao fechar socket antigo:", e);
      }
    }

    return new Promise((resolve, reject) => {
      try {
        // Criar nova conexão
        socket = new WebSocket(`${currentWsUrl}?app_id=${APP_ID}`);

        // Define timeout para evitar espera excessiva
        const connectionTimeout = setTimeout(() => {
          if (socket && socket.readyState !== WebSocket.OPEN) {
            console.warn("[R100] Timeout na conexão - tentando outro servidor");
            socket.close();
            
            // Tenta o próximo servidor
            currentServerIndex = (currentServerIndex + 1) % WS_URLS.length;
            connectionAttempts = 0; // Reinicia contador para o novo servidor
            
            // Resolve com falha para acionar nova tentativa de reconexão
            resolve(false);
          }
        }, 8000); // 8 segundos de timeout

        socket.onopen = () => {
          clearTimeout(connectionTimeout);
          console.log("[R100] Conexão WebSocket estabelecida com sucesso!");
          connectionStatus = 'connected';
          isConnecting = false;
          connectionAttempts = 0; // Reinicia contador de tentativas
          
          // Iniciar mecanismos de manutenção
          startPingInterval();
          
          // Reinscrever em símbolos
          resubscribeToSymbols();
          
          resolve(true);
        };

        socket.onmessage = handleWebSocketMessage;

        socket.onerror = (error) => {
          console.error("[R100] Erro na conexão WebSocket:", error);
          // Não mudamos o status ainda, vamos esperar o onclose
        };

        socket.onclose = (event) => {
          clearTimeout(connectionTimeout);
          console.warn(`[R100] Conexão fechada: ${event.code} - ${event.reason}`);
          connectionStatus = 'disconnected';
          isConnecting = false;
          clearPingInterval();
          
          // Agendar reconexão
          const reconnectDelay = calculateReconnectDelay();
          scheduleReconnect(reconnectDelay);
          
          if (!event.wasClean) {
            reject(new Error(`Conexão fechada com código: ${event.code}`));
          }
        };
      } catch (error) {
        console.error("[R100] Erro ao inicializar WebSocket:", error);
        connectionStatus = 'disconnected';
        isConnecting = false;
        reject(error);
        scheduleReconnect(calculateReconnectDelay());
      }
    });
  } catch (error) {
    console.error("[R100] Erro fatal na conexão WebSocket:", error);
    connectionStatus = 'disconnected';
    isConnecting = false;
    scheduleReconnect(calculateReconnectDelay());
    return false;
  }
};

/**
 * Calcula o tempo de espera para próxima reconexão (exponential backoff)
 */
function calculateReconnectDelay(): number {
  const baseDelay = 1000; // 1 segundo
  const maxDelay = 30000; // 30 segundos
  
  // Exponential backoff baseado no número de tentativas
  const delay = Math.min(baseDelay * Math.pow(1.5, connectionAttempts - 1), maxDelay);
  
  // Adiciona um pouco de aleatoriedade (jitter) para evitar thundering herd
  return delay + Math.random() * 1000;
}

/**
 * Processa mensagens recebidas do WebSocket
 */
function handleWebSocketMessage(event: MessageEvent) {
  try {
    const response = JSON.parse(event.data);
    
    // Processar diferentes tipos de mensagens
    if (response.tick) {
      // Mensagem de tick de preço
      notifyTickListeners(response.tick);
      dispatchTickEvent(response.tick);
    } 
    else if (response.error) {
      console.error("[R100] Erro da API:", response.error);
      
      // Tratamento de erros específicos
      if (response.error.code === 'ConnectError' || 
          response.error.code === 'SubscribeError') {
        // Tentar reconectar em caso de erro de conexão/inscrição
        scheduleReconnect();
      }
    }
    else if (response.ping) {
      // Resposta a ping, não precisa fazer nada
    }
  } catch (error) {
    console.error("[R100] Erro ao processar mensagem:", error);
  }
}

/**
 * Agenda uma tentativa de reconexão
 */
function scheduleReconnect(delay: number = 3000) {
  // Limpar timeout existente
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Agendar nova tentativa
  reconnectTimeout = setTimeout(() => {
    console.log("[R100] Tentando reconectar...");
    
    connectWebSocket()
      .then(success => {
        if (success) {
          console.log("[R100] Reconexão bem-sucedida!");
        } else {
          console.warn("[R100] Falha na reconexão.");
          scheduleReconnect(5000); // Aumenta o tempo na próxima tentativa
        }
      })
      .catch(error => {
        console.error("[R100] Erro na reconexão:", error);
        scheduleReconnect(5000);
      });
  }, delay);
}

/**
 * Inicia o intervalo de ping para manter a conexão ativa
 */
function startPingInterval() {
  clearPingInterval();
  pingInterval = setInterval(() => {
    sendPing();
  }, 30000); // Ping a cada 30 segundos
}

/**
 * Limpa o intervalo de ping
 */
function clearPingInterval() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
}

/**
 * Envia um ping para manter a conexão ativa
 */
function sendPing() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(JSON.stringify({ ping: 1 }));
    } catch (error) {
      console.error("[R100] Erro ao enviar ping:", error);
      scheduleReconnect();
    }
  }
}

/**
 * Inscreve-se para receber ticks de um símbolo
 * @param symbol Símbolo para inscrição (ex: 'R_100')
 */
export function subscribeToSymbol(symbol: string): Promise<boolean> {
  if (!symbol) {
    return Promise.reject(new Error("Símbolo inválido"));
  }
  
  // Adiciona ao conjunto de símbolos inscritos
  subscribedSymbols.add(symbol);
  
  // Se não estiver conectado, agenda para subscrição posterior
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return connectWebSocket();
  }
  
  return new Promise((resolve, reject) => {
    try {
      const request = {
        ticks: symbol,
        subscribe: 1
      };
      
      socket.send(JSON.stringify(request));
      console.log(`[R100] Inscrito em ticks para ${symbol}`);
      resolve(true);
    } catch (error) {
      console.error(`[R100] Erro ao inscrever em ${symbol}:`, error);
      reject(error);
    }
  });
}

/**
 * Reinscreve em todos os símbolos que estavam assinados
 * Chamado após reconexão
 */
function resubscribeToSymbols() {
  if (subscribedSymbols.size === 0) {
    // Se não houver símbolos anteriores, inscreve no R_100 por padrão
    subscribeToSymbol('R_100').catch(error => {
      console.error("[R100] Erro ao reiniciar subscrição padrão:", error);
    });
    return;
  }
  
  // Reinscreve em todos os símbolos
  for (const symbol of subscribedSymbols) {
    subscribeToSymbol(symbol).catch(error => {
      console.error(`[R100] Erro ao reiniciar subscrição para ${symbol}:`, error);
    });
  }
}

/**
 * Notifica todos os listeners sobre um novo tick
 */
function notifyTickListeners(tick: any) {
  tickListeners.forEach(listener => {
    try {
      listener(tick);
    } catch (error) {
      console.error("[R100] Erro no listener de tick:", error);
    }
  });
}

/**
 * Adiciona um listener para receber ticks
 */
export function addTickListener(listener: (tick: any) => void) {
  if (typeof listener !== 'function') return;
  tickListeners.push(listener);
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
  // Limpar timers
  clearPingInterval();
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Limpar estado
  subscribedSymbols.clear();
  
  // Fechar socket
  if (socket) {
    try {
      socket.close();
    } catch (error) {
      console.error("[R100] Erro ao fechar WebSocket:", error);
    }
    socket = null;
  }
  
  connectionStatus = 'disconnected';
  console.log("[R100] WebSocket fechado e recursos liberados");
}

/**
 * Dispara evento personalizado com dados do tick
 */
export function dispatchTickEvent(tick: any) {
  if (!tick) return;
  
  try {
    const event = new CustomEvent('deriv:tick', { 
      detail: { tick },
      bubbles: true,
      cancelable: true 
    });
    document.dispatchEvent(event);
  } catch (error) {
    console.error("[R100] Erro ao dispatchar evento de tick:", error);
  }
}

/**
 * Inicia o sistema de keep-alive
 */
export function startKeepAlive() {
  console.log("[R100] Iniciando sistema de keep-alive");
  
  // Conectar ao WebSocket
  connectWebSocket()
    .then(success => {
      if (success) {
        // Inscrever para receber dados do R_100 por padrão
        subscribeToSymbol('R_100').catch(console.error);
      }
    })
    .catch(error => {
      console.error("[R100] Erro ao iniciar keep-alive:", error);
    });
    
  // Adicionar listeners para eventos de visibilidade da página
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('online', handleOnlineEvent);
  window.addEventListener('focus', handleWindowFocus);
}

/**
 * Para o sistema de keep-alive e libera recursos
 */
export function stopKeepAlive() {
  console.log("[R100] Interrompendo sistema de keep-alive");
  
  // Remover listeners de eventos da página
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnlineEvent);
  window.removeEventListener('focus', handleWindowFocus);
  
  // Fechar conexão
  closeWebSocket();
}

/**
 * Manipulador para eventos de visibilidade
 */
function handleVisibilityChange() {
  if (document.visibilityState === 'visible') {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log("[R100] Página visível, verificando conexão WebSocket");
      connectWebSocket().catch(console.error);
    }
  }
}

/**
 * Manipulador para eventos de conexão online
 */
function handleOnlineEvent() {
  if (window.navigator.onLine && (!socket || socket.readyState !== WebSocket.OPEN)) {
    console.log("[R100] Conexão online detectada, reconectando WebSocket");
    connectWebSocket().catch(console.error);
  }
}

/**
 * Manipulador para eventos de foco da janela
 */
function handleWindowFocus() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    console.log("[R100] Janela em foco, verificando conexão WebSocket");
    connectWebSocket().catch(console.error);
  }
}

// Exportar objeto com métodos principais
export default {
  connect: connectWebSocket,
  close: closeWebSocket,
  subscribe: subscribeToSymbol,
  addListener: addTickListener,
  removeListener: removeTickListener,
  startKeepAlive,
  stopKeepAlive
};