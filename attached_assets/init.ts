/**
 * Módulo de inicialização de componentes críticos
 * 
 * Este módulo serve como ponto único para inicializar diversos
 * componentes da aplicação que precisam ser carregados no início.
 */

import { startKeepAlive } from './websocketKeepAlive';
import { startWebSocketMonitoring } from './websocketHandlers';
import { cleanBlockedEntities } from './tokenBlocklist';

/**
 * Inicializar componentes principais da aplicação
 */
export function initializeApp() {
  // Removido log excessivo para melhorar performance
  
  // Executar limpeza inicial de entidades bloqueadas
  cleanBlockedEntities();
  
  // Iniciar monitoramento da conexão WebSocket
  startWebSocketMonitoring();
  
  // Iniciar o mecanismo de keep-alive para WebSocket
  startKeepAlive();
  
  // Registrar flag de inicialização
  localStorage.setItem('app_initialized', Date.now().toString());
  
  // Removido log excessivo para melhorar performance
}

/**
 * Verificar e registrar o token da API Deriv do ambiente, se disponível
 */
export function checkEnvironmentApiToken() {
  // Verificar se existe um token da API no ambiente
  const envToken = import.meta.env.VITE_DERIV_API_TOKEN || '';
  
  if (envToken && envToken.length > 10) {
    console.log('Token da API Deriv encontrado nas variáveis de ambiente');
    
    // Armazenar para uso posterior apenas se não existir um token já salvo
    if (!localStorage.getItem('deriv_api_token') && !sessionStorage.getItem('derivApiToken')) {
      localStorage.setItem('deriv_api_token', envToken);
      console.log('Token da API Deriv do ambiente salvo para uso');
    }
  }
}

// Auto-executar inicialização quando o módulo é carregado no navegador
if (typeof window !== 'undefined') {
  // Verificar token do ambiente
  checkEnvironmentApiToken();
  
  // Inicializar a aplicação quando o DOM estiver carregado
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    // Se o DOM já estiver carregado, inicializar imediatamente
    initializeApp();
  }
}