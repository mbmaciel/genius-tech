/**
 * Módulo de gerenciamento de eventos WebSocket
 * 
 * Este módulo implementa manejadores de eventos para a conexão WebSocket
 * com a API Deriv, incluindo tratamento de erros, fechamento de conexão,
 * e reconexão automática quando necessário.
 */

import derivAPI from './derivApi';
import { isTokenBlocked, isAccountBlocked, cleanBlockedEntities } from './tokenBlocklist';

/**
 * Configura os manejadores de eventos padrão para o objeto WebSocket
 * @param websocket O objeto WebSocket a ser configurado
 */
export const setupWebSocketHandlers = (websocket: WebSocket): void => {
  if (!websocket) {
    console.error("Não foi possível configurar manejadores de eventos: objeto WebSocket inválido");
    return;
  }

  // Manipulador para o evento de fechamento da conexão
  websocket.onclose = (event) => {
    if (event.wasClean) {
      console.log(`[WebSocket] Conexão fechada de forma limpa, código=${event.code} motivo=${event.reason || 'Não especificado'}`);
    } else {
      // Por exemplo, quando o servidor cai ou a rede falha
      // event.code geralmente é 1006 nestes casos
      console.error(`[WebSocket] Conexão morreu de forma inesperada, código=${event.code}`);
      
      // Tentar reconectar após um breve atraso
      setTimeout(() => {
        attemptReconnect();
      }, 3000);
    }
  };

  // Manipulador para o evento de erro
  websocket.onerror = (error) => {
    console.error('[WebSocket] Erro de conexão:', error);
    
    // Limpar quaisquer entidades bloqueadas que possam estar causando problemas
    cleanBlockedEntities();
  };

  // Manipulador para o evento de mensagem
  const originalOnMessage = websocket.onmessage;
  websocket.onmessage = (event) => {
    // Chamar o manipulador original primeiro, se existir
    if (typeof originalOnMessage === 'function') {
      originalOnMessage.call(websocket, event);
    }
    
    // Processar a mensagem para verificar possíveis problemas
    try {
      const data = JSON.parse(event.data);
      
      // Verificar se a mensagem é uma resposta de autorização
      if (data?.msg_type === 'authorize' && data?.authorize?.loginid) {
        const accountId = data.authorize.loginid;
        
        // Verificar se a conta está na lista de bloqueio
        if (isAccountBlocked(accountId)) {
          console.error(`[WebSocket] ALERTA: Conta bloqueada detectada na mensagem de autorização: ${accountId}`);
          forceLogout(`Conta bloqueada (${accountId}) detectada`);
        }
      }
    } catch (e) {
      // Ignorar erros de parsing de JSON
    }
  };

  console.log("[WebSocket] Manejadores de eventos configurados com sucesso");
};

/**
 * Tenta reconectar à API Deriv usando o token salvo
 */
const attemptReconnect = async (): Promise<boolean> => {
  // Verificar se o usuário desativou a reconexão automática
  if (localStorage.getItem('prevent_auto_reconnect') === 'true') {
    console.log('[WebSocket] Reconexão automática desativada pelo usuário');
    return false;
  }
  
  // Tentar obter um token válido para reconexão
  const token = localStorage.getItem('deriv_api_token') || 
                sessionStorage.getItem('derivApiToken');
  
  if (!token) {
    console.warn('[WebSocket] Sem token válido para reconexão');
    return false;
  }
  
  // Verificar se o token está na lista de bloqueio
  if (isTokenBlocked(token)) {
    console.error(`[WebSocket] Token bloqueado detectado: ${token.substring(0, 4)}... Abortando reconexão.`);
    forceLogout('Token bloqueado detectado durante tentativa de reconexão');
    return false;
  }
  
  console.log(`[WebSocket] Tentando reconectar com token: ${token.substring(0, 4)}...`);
  
  try {
    // Aguardar um momento antes de tentar reconectar
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Forçar desconexão antes de reconectar
    if (derivAPI.getConnectionStatus()) {
      derivAPI.disconnect(true);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Tentar conectar
    const result = await derivAPI.connect(token);
    
    if (result) {
      console.log('[WebSocket] Reconexão bem-sucedida');
      
      // Verificar a conta após reconexão
      try {
        // Usa a versão síncrona de getAccountInfo
        const accountInfo = derivAPI.getAccountInfo();
        if (accountInfo && accountInfo.loginid) {
          console.log(`[WebSocket] Reconectado à conta: ${accountInfo.loginid}`);
          
          // Verificar se a conta reconectada está na lista de bloqueio
          if (isAccountBlocked(accountInfo.loginid)) {
            console.error(`[WebSocket] Conta bloqueada detectada após reconexão: ${accountInfo.loginid}`);
            forceLogout(`Conta bloqueada (${accountInfo.loginid}) após reconexão`);
            return false;
          }
        }
      } catch (err) {
        console.warn('[WebSocket] Erro ao verificar conta após reconexão:', err);
      }
      
      // Informar outros componentes sobre a reconexão bem-sucedida
      document.dispatchEvent(new CustomEvent('deriv:reconnected', { 
        detail: { success: true, timestamp: Date.now() }
      }));
      
      return true;
    } else {
      console.error('[WebSocket] Falha na reconexão');
      return false;
    }
  } catch (error) {
    console.error('[WebSocket] Erro durante tentativa de reconexão:', error);
    return false;
  }
};

/**
 * Força o logout e limpa todos os dados
 * @param reason Motivo para o logout forçado
 */
const forceLogout = (reason: string): void => {
  console.error(`[WebSocket] LOGOUT FORÇADO - Motivo: ${reason}`);
  
  // Desativar reconexão automática
  localStorage.setItem('prevent_auto_reconnect', 'true');
  
  try {
    // Enviar logout explícito primeiro se possível
    if (derivAPI.getConnectionStatus()) {
      derivAPI.send({ logout: 1 }).catch(() => {
        console.warn('[WebSocket] Falha ao enviar comando de logout');
      });
    }
    
    // Forçar desconexão
    derivAPI.disconnect(true);
    
    // Limpar tokens e dados de autenticação
    cleanBlockedEntities();
    
    // Limpar dados adicionais
    sessionStorage.removeItem('derivApiToken');
    localStorage.removeItem('deriv_api_token');
    localStorage.removeItem('deriv_active_account');
    localStorage.removeItem('derivSavedAccounts');
    localStorage.removeItem('deriv_auth_success');
    localStorage.removeItem('deriv_is_oauth');
    
    // Mostrar alerta
    alert(`A conexão com a API da Deriv foi encerrada devido a uma questão de segurança: ${reason}`);
    
    // Redirecionar para a página inicial após um breve atraso
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  } catch (error) {
    console.error('[WebSocket] Erro durante logout forçado:', error);
    
    // Mesmo com erro, tentar redirecionar
    window.location.href = '/';
  }
};

/**
 * Ativa o monitoramento da conexão WebSocket
 */
export const startWebSocketMonitoring = (): void => {
  // Verificar se podemos acessar o objeto WebSocket
  const getWebSocketObject = () => {
    // Primeiro, verificar se a API Deriv expõe um método para obter o WebSocket
    if (derivAPI.getWebSocket && typeof derivAPI.getWebSocket === 'function') {
      try {
        return derivAPI.getWebSocket();
      } catch (e) {
        console.warn('[WebSocket] Não foi possível obter o objeto WebSocket da API:', e);
      }
    }
    return null;
  };
  
  // Tentar acessar e configurar o objeto WebSocket imediatamente
  const websocket = getWebSocketObject();
  if (websocket) {
    setupWebSocketHandlers(websocket);
  } else {
    console.warn('[WebSocket] Objeto WebSocket não disponível agora, aguardando conexão...');
    
    // Configurar um listener para a conexão
    document.addEventListener('deriv:connected', () => {
      const websocket = getWebSocketObject();
      if (websocket) {
        setupWebSocketHandlers(websocket);
      }
    });
  }
  
  // Iniciar verificação periódica das contas e tokens bloqueados
  setInterval(() => {
    if (derivAPI.getConnectionStatus()) {
      const accountInfo = derivAPI.getAccountInfo();
      if (accountInfo && accountInfo.loginid) {
        // Verificar se a conta está na lista de bloqueio
        if (isAccountBlocked(accountInfo.loginid)) {
          console.error(`[WebSocket] Conta bloqueada detectada em verificação periódica: ${accountInfo.loginid}`);
          forceLogout(`Conta bloqueada (${accountInfo.loginid}) detectada em verificação periódica`);
        }
      }
    }
  }, 60000); // Verificar a cada minuto
};

export default {
  setupWebSocketHandlers,
  startWebSocketMonitoring
};