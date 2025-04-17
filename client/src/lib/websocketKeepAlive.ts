/**
 * WebSocketKeepAlive - Conexão permanente com a API Deriv para obter dados do R_100
 * Esta conexão é separada da conexão OAuth e usada exclusivamente para obter dados em tempo real
 */

let socket: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let tickListeners: Array<(tick: any) => void> = [];
let pingInterval: NodeJS.Timeout | null = null;

// Token público da Deriv para acesso anônimo a dados de cotação
const APP_TOKEN = 'jybcQm0FbKr7evp'; 
const WS_URL = 'wss://ws.binaryws.com/websockets/v3?app_id=71403';

/**
 * Conecta ao WebSocket da Deriv e mantém a conexão ativa
 * @returns Promise<boolean> indicando se a conexão foi bem sucedida
 */
export const connectWebSocket = (): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log("[WebSocketKeepAlive] Conexão WebSocket já está aberta");
      resolve(true);
      return;
    }

    try {
      console.log("[WebSocketKeepAlive] Conectando...");
      socket = new WebSocket(WS_URL);

      socket.onopen = () => {
        console.log("[WebSocketKeepAlive] Conexão estabelecida");
        startPingInterval();
        subscribeToR100();
        resolve(true);
      };

      socket.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.tick) {
            notifyTickListeners(response.tick);
          } else if (response.error) {
            console.error("[WebSocketKeepAlive] Erro da API:", response.error);
          }
        } catch (error) {
          console.error("[WebSocketKeepAlive] Erro ao processar mensagem:", error);
        }
      };

      socket.onerror = (error) => {
        console.error("[WebSocketKeepAlive] Erro na conexão:", error);
        reject(error);
      };

      socket.onclose = (event) => {
        console.warn("[WebSocketKeepAlive] Conexão fechada:", event.code, "-", event.reason);
        clearPingInterval();
        scheduleReconnect();
      };
    } catch (error) {
      console.error("[WebSocketKeepAlive] Erro ao criar WebSocket:", error);
      scheduleReconnect();
      reject(error);
    }
  });
};

/**
 * Agenda uma tentativa de reconexão
 */
function scheduleReconnect() {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  reconnectTimeout = setTimeout(() => {
    console.log("[WebSocketKeepAlive] Tentando reconectar...");
    connectWebSocket()
      .then(() => {
        console.log("[WebSocketKeepAlive] Reconectado com sucesso");
      })
      .catch((error) => {
        console.error("[WebSocketKeepAlive] Falha ao reconectar:", error);
        scheduleReconnect();
      });
  }, 3000);
}

/**
 * Inicia o intervalo de ping para manter a conexão ativa
 */
function startPingInterval() {
  clearPingInterval();
  pingInterval = setInterval(() => {
    sendPing();
  }, 30000); // A cada 30 segundos
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
    const request = { ping: 1 };
    socket.send(JSON.stringify(request));
  }
}

/**
 * Inscreve-se para receber ticks do R_100
 */
function subscribeToR100() {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const request = {
      ticks: 'R_100',
      subscribe: 1
    };
    socket.send(JSON.stringify(request));
    console.log("[WebSocketKeepAlive] Inscrito em ticks para R_100");
  }
}

/**
 * Adiciona um listener para receber atualizações de ticks
 * @param listener Função que será chamada quando um novo tick chegar
 */
export const addTickListener = (listener: (tick: any) => void) => {
  tickListeners.push(listener);
};

/**
 * Remove um listener de ticks
 * @param listener O listener a ser removido
 */
export const removeTickListener = (listener: (tick: any) => void) => {
  const index = tickListeners.indexOf(listener);
  if (index !== -1) {
    tickListeners.splice(index, 1);
  }
};

/**
 * Notifica todos os listeners sobre um novo tick
 * @param tick Dados do tick
 */
function notifyTickListeners(tick: any) {
  tickListeners.forEach((listener) => {
    listener(tick);
  });
}

/**
 * Fecha a conexão WebSocket
 */
export const closeWebSocket = () => {
  clearPingInterval();
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (socket) {
    socket.close();
    socket = null;
  }
};

// Conecta automaticamente ao inicializar o módulo
connectWebSocket();

// Evento personalizado para enviar ticks para o DOM
export const dispatchTickEvent = (tick: any) => {
  const event = new CustomEvent('tick', { detail: tick });
  window.dispatchEvent(event);
};

// Adiciona um listener para encaminhar ticks para o evento DOM
addTickListener((tick) => {
  dispatchTickEvent(tick);
});

/**
 * Inicia o mecanismo de keep-alive para WebSocket
 */
export function startKeepAlive(): void {
  console.log("[WebSocketKeepAlive] Iniciando sistema de keep-alive");
  connectWebSocket().catch(err => {
    console.error("[WebSocketKeepAlive] Erro ao iniciar keep-alive:", err);
  });
}

/**
 * Interrompe o mecanismo de keep-alive para WebSocket
 */
export function stopKeepAlive(): void {
  console.log("[WebSocketKeepAlive] Interrompendo sistema de keep-alive");
  closeWebSocket();
}

// Exporta diretamente o objeto que fornece acesso aos métodos
export default {
  connect: connectWebSocket,
  close: closeWebSocket,
  addTickListener,
  removeTickListener,
  startKeepAlive,
  stopKeepAlive
};