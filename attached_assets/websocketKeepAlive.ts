/**
 * Módulo de manutenção da conexão WebSocket
 * 
 * Este módulo é um adaptador para o WebSocketManager, que implementa
 * um mecanismo de "keep-alive" para a conexão WebSocket com a API Deriv,
 * seguindo as recomendações da documentação oficial.
 */

import { websocketManager } from './websocketManager';

/**
 * Inicia o mecanismo de keep-alive para WebSocket
 */
export function startKeepAlive(): void {
  console.log("[WebSocket] Iniciando sistema de keep-alive com nova implementação");
  
  // Configurar o websocketManager com valores para melhor estabilidade
  websocketManager.configure({
    pingIntervalMs: 30000,        // 30 segundos entre pings (sessão expira em 2 min)
    reconnectDelayBaseMs: 1000,   // Delay base para reconexão
    reconnectDelayMaxMs: 15000,   // Delay máximo para reconexão (15 segundos)
    reconnectMaxAttempts: 10,     // Número máximo de tentativas
    sessionTimeoutMs: 120000,     // 2 minutos (timeout da sessão da Deriv)
    autoReconnect: true,          // Reconexão automática
    debug: false                  // Modo debug desligado em produção
  });
  
  // Iniciar monitoramento
  websocketManager.startMonitoring();
  
  // Limpar qualquer flag de prevenção de reconexão automática
  localStorage.removeItem('prevent_auto_reconnect');
  
  // Registrar event listeners para eventos do websocketManager
  document.addEventListener('deriv:reconnecting', (event) => {
    const customEvent = event as CustomEvent;
    console.log(`[WebSocket] Tentativa de reconexão ${customEvent.detail?.attempt}/${customEvent.detail?.maxAttempts}`);
  });
  
  document.addEventListener('deriv:reconnected', () => {
    console.log('[WebSocket] Reconexão bem-sucedida');
  });
  
  document.addEventListener('deriv:reconnect_failed', (event) => {
    const customEvent = event as CustomEvent;
    console.error(`[WebSocket] Falha em todas as ${customEvent.detail?.attempts} tentativas de reconexão`);
  });
}

/**
 * Interrompe o mecanismo de keep-alive para WebSocket
 */
export function stopKeepAlive(): void {
  console.log("[WebSocket] Interrompendo sistema de keep-alive");
  websocketManager.stopMonitoring();
}

export default {
  startKeepAlive,
  stopKeepAlive
};