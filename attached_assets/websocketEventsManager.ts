/**
 * Gerenciador de eventos WebSocket
 * 
 * Este módulo fornece funções para monitorar e tratar eventos
 * específicos da conexão WebSocket com a API Deriv.
 */

import { cleanBlockedEntities } from './tokenBlocklist';
import derivAPI from './derivApi';

// Mensagens de erro para diferentes códigos de fechamento
const CLOSE_REASON_MESSAGES: Record<number, string> = {
  1000: "Fechamento normal",
  1001: "Saindo, o navegador está se fechando",
  1002: "Erro de protocolo",
  1003: "Dados recebidos não podem ser aceitos",
  1004: "Reservado", 
  1005: "Sem código de status recebido",
  1006: "Conexão perdida anormalmente",
  1007: "Erro de mensagem (dados não-UTF-8)",
  1008: "Violação de política",
  1009: "Mensagem muito grande",
  1010: "Extensões requeridas não negociadas",
  1011: "Erro inesperado no servidor",
  1012: "Servidor reiniciando",
  1013: "Servidor sobrecarregado",
  1014: "Timeout de gateway",
  1015: "Falha de TLS/SSL"
};

/**
 * Configura os manejadores de eventos do WebSocket
 * @param socket Objeto WebSocket a ser monitorado
 * @param options Opções de configuração
 */
export const setupWebSocketEventHandlers = (
  socket: WebSocket,
  options: {
    onClose?: (event: CloseEvent) => void,
    onError?: (event: Event) => void,
    onReconnect?: () => void
  } = {}
): void => {
  // Tratamento de fechamento da conexão
  socket.onclose = (event: CloseEvent) => {
    if (event.wasClean) {
      const reason = CLOSE_REASON_MESSAGES[event.code] || "Motivo desconhecido";
      console.log(`[WebSocket] Conexão fechada normalmente: código=${event.code}, razão=${reason}`);
      
      // Limpeza após fechamento normal
      cleanupAfterDisconnect("fechamento normal");
    } else {
      // Conexão perdida de forma anormal (geralmente código 1006)
      console.error(`[WebSocket] Conexão morreu anormalmente: código=${event.code}`);
      
      // Limpeza após desconexão anormal
      cleanupAfterDisconnect("falha de conexão");
      
      // Tentar reconectar após um breve atraso
      setTimeout(() => {
        console.log("[WebSocket] Tentando reconectar após desconexão anormal...");
        if (options.onReconnect) {
          options.onReconnect();
        } else {
          defaultReconnect();
        }
      }, 3000);
    }
    
    // Executar callback personalizado de fechamento, se fornecido
    if (options.onClose) {
      options.onClose(event);
    }
  };
  
  // Tratamento de erros na conexão
  socket.onerror = (event: Event) => {
    console.error(`[WebSocket] Erro de conexão:`, event);
    
    // Limpeza após erro
    cleanupAfterDisconnect("erro");
    
    // Executar callback personalizado de erro, se fornecido
    if (options.onError) {
      options.onError(event);
    }
  };
  
  console.log("[WebSocket] Manipuladores de eventos configurados com sucesso");
};

/**
 * Limpa dados de conexão e estado após uma desconexão
 * @param reason Motivo da limpeza
 */
export const cleanupAfterDisconnect = (reason: string): void => {
  console.log(`[WebSocket] Executando limpeza após ${reason}`);
  
  // Primeiro verificar se há entidades bloqueadas e removê-las
  cleanBlockedEntities();
  
  // Tentar também enviar um logout explícito para descartar tokens no servidor
  if (derivAPI.getConnectionStatus()) {
    try {
      console.log("[WebSocket] Enviando logout explícito");
      derivAPI.send({ logout: 1 }).catch(err => {
        console.warn("[WebSocket] Erro ao enviar logout:", err);
      });
    } catch (e) {
      console.warn("[WebSocket] Falha ao enviar logout:", e);
    }
  }
  
  // Registrar o fechamento para diagnóstico
  const timestamp = new Date().toISOString();
  try {
    const disconnects = JSON.parse(localStorage.getItem('deriv_disconnects') || '[]');
    disconnects.push({
      timestamp,
      reason,
      sessionDuration: calculateSessionDuration()
    });
    
    // Manter apenas os últimos 10 eventos
    if (disconnects.length > 10) {
      disconnects.splice(0, disconnects.length - 10);
    }
    
    localStorage.setItem('deriv_disconnects', JSON.stringify(disconnects));
  } catch (e) {
    console.error("[WebSocket] Erro ao registrar desconexão:", e);
  }
};

/**
 * Calcula a duração da sessão atual
 * @returns Duração em minutos ou string "desconhecida"
 */
const calculateSessionDuration = (): string => {
  try {
    const startTime = localStorage.getItem('deriv_session_start');
    if (!startTime) return "desconhecida";
    
    const start = new Date(startTime).getTime();
    const now = Date.now();
    const durationMs = now - start;
    
    // Converter para minutos com 1 casa decimal
    return (durationMs / 60000).toFixed(1) + " minutos";
  } catch (e) {
    return "erro no cálculo";
  }
};

/**
 * Implementação padrão de reconexão
 */
const defaultReconnect = async (): Promise<void> => {
  // Verificar se devemos evitar reconexão automática
  if (localStorage.getItem('prevent_auto_reconnect') === 'true') {
    console.log("[WebSocket] Reconexão automática desativada pelo usuário");
    return;
  }
  
  try {
    // Tentar obter o token salvo
    const token = localStorage.getItem('deriv_api_token') || 
                  sessionStorage.getItem('derivApiToken');
                  
    if (!token) {
      console.warn("[WebSocket] Sem token disponível para reconexão");
      return;
    }
    
    console.log("[WebSocket] Tentando reconectar com token salvo...");
    
    // Esperar um momento antes de tentar reconectar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Tentar reconectar com o token salvo
    const result = await derivAPI.connect(token);
    
    if (result) {
      console.log("[WebSocket] Reconexão automática bem-sucedida");
      
      // Disparar evento para notificar a UI
      document.dispatchEvent(new CustomEvent('deriv:reconnect_complete', { 
        detail: { success: true }
      }));
    } else {
      console.error("[WebSocket] Falha na reconexão automática");
    }
  } catch (error) {
    console.error("[WebSocket] Erro durante reconexão automática:", error);
  }
};

/**
 * Registra o início de uma nova sessão WebSocket
 */
export const registerSessionStart = (): void => {
  localStorage.setItem('deriv_session_start', new Date().toISOString());
};

export default {
  setupWebSocketEventHandlers,
  cleanupAfterDisconnect,
  registerSessionStart
};