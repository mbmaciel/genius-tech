/**
 * Utilitário para limpeza completa da sessão
 * Implementa uma solução mais radical para garantir que não haja persistência indevida
 */

// Importar dinamicamente as listas de bloqueio para evitar dependências cíclicas
// Esta função força a remoção das contas e tokens específicos que têm causado problemas
async function forceRemoveProblematicData() {
  try {
    // Definimos as contas problemáticas diretamente aqui
    const problematicAccounts = [
      "CR1330028", "CR1345293", "VRTC2817959", 
      "CR799393", "cr799393", // formato da documentação e variação
    ];
    
    // Definimos os tokens problemáticos diretamente aqui
    const problematicTokens = [
      "GXygBDVD8D7vF7M", "a1-DKteqH3wEOpJ5qGwffTQIuzDlVr", 
      "DKteqH3wEOpJ5qGwffTQIuzDlVr", "a1-f7pnteezo4jzhpxclctizt27hyeot"
    ];
    
    console.log("🧹 Procurando por contas e tokens problemáticos no storage...");
    
    // Verificar todas as chaves no localStorage
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      const value = localStorage.getItem(key);
      if (!value) continue;
      
      let shouldRemove = false;
      
      // Verificar se contém alguma conta problemática
      for (const account of problematicAccounts) {
        if (value.includes(account)) {
          console.log(`🚫 Encontrada conta problemática '${account}' em localStorage.${key}`);
          shouldRemove = true;
          break;
        }
      }
      
      // Verificar se contém algum token problemático
      if (!shouldRemove) {
        for (const token of problematicTokens) {
          if (value.includes(token)) {
            console.log(`🚫 Encontrado token problemático em localStorage.${key}`);
            shouldRemove = true;
            break;
          }
        }
      }
      
      if (shouldRemove) {
        console.log(`🗑️ Removendo localStorage.${key}`);
        localStorage.removeItem(key);
      }
    }
    
    // Mesmo processo para sessionStorage
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      
      const value = sessionStorage.getItem(key);
      if (!value) continue;
      
      let shouldRemove = false;
      
      // Verificar se contém alguma conta problemática
      for (const account of problematicAccounts) {
        if (value.includes(account)) {
          console.log(`🚫 Encontrada conta problemática '${account}' em sessionStorage.${key}`);
          shouldRemove = true;
          break;
        }
      }
      
      // Verificar se contém algum token problemático
      if (!shouldRemove) {
        for (const token of problematicTokens) {
          if (value.includes(token)) {
            console.log(`🚫 Encontrado token problemático em sessionStorage.${key}`);
            shouldRemove = true;
            break;
          }
        }
      }
      
      if (shouldRemove) {
        console.log(`🗑️ Removendo sessionStorage.${key}`);
        sessionStorage.removeItem(key);
      }
    }
    
    console.log("✅ Verificação e limpeza de dados problemáticos concluída");
    return true;
  } catch (e) {
    console.error("Erro ao remover dados problemáticos:", e);
    return false;
  }
}

/**
 * Limpa ABSOLUTAMENTE TODOS os dados do localStorage e sessionStorage
 * Esta é a função nuclear - use com cautela
 */
export function nukeAllStorageData() {
  console.log("☢️ ATENÇÃO: Limpeza nuclear de todos os dados de armazenamento iniciada");
  
  try {
    // FASE 1: Primeiro remover especificamente os problematicos (síncrono)
    forceRemoveProblematicData().catch(e => console.error("Erro na fase 1:", e));
    
    // FASE 2: Remover QUALQUER token de API
    const tokenKeys = [
      'deriv_api_token', 'derivApiToken', 'token', 'api_token',
      'deriv_oauth_token', 'deriv_token', 'oauth_token', 'access_token'
    ];
    
    tokenKeys.forEach(key => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });
    
    // FASE 3: Limpar localStorage completamente
    localStorage.clear();
    console.log("✓ localStorage completamente limpo");
    
    // FASE 4: Limpar sessionStorage completamente
    sessionStorage.clear();
    console.log("✓ sessionStorage completamente limpo");
    
    // FASE 5: Limpar cookies
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i];
      const eqPos = cookie.indexOf("=");
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
    console.log(`✓ ${cookies.length} cookies limpos`);
    
    // FASE 6: Remover service workers se houver
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (const registration of registrations) {
          registration.unregister();
        }
        console.log(`✓ ${registrations.length} service workers removidos`);
      }).catch(err => {
        console.error("Erro ao remover service workers:", err);
      });
    }
    
    console.log("☢️ Limpeza nuclear concluída com sucesso");
    return true;
  } catch (e) {
    console.error("Erro durante limpeza nuclear:", e);
    return false;
  }
}

/**
 * Limpa todos os dados e recarrega a página para começar do zero
 * Esta é a solução definitiva para problemas de persistência
 */
export function cleanAndReload() {
  nukeAllStorageData();
  console.log("☢️ Recarregando a página para começar do zero...");
  
  // Força um atraso para garantir que a limpeza seja completa
  setTimeout(() => {
    window.location.href = '/';
  }, 500);
}

/**
 * Botão de último recurso para quando nada mais funcionar
 */
export function EmergencyCleanButton() {
  return {
    render: () => {
      const button = document.createElement('button');
      button.innerText = 'LIMPAR TUDO E REINICIAR';
      button.style.position = 'fixed';
      button.style.bottom = '10px';
      button.style.right = '10px';
      button.style.zIndex = '9999';
      button.style.padding = '10px';
      button.style.backgroundColor = '#ff3e3e';
      button.style.color = 'white';
      button.style.border = 'none';
      button.style.borderRadius = '5px';
      button.style.fontWeight = 'bold';
      button.style.cursor = 'pointer';
      
      button.onclick = () => {
        if (confirm('ATENÇÃO: Isso vai limpar TODOS os dados da aplicação e reiniciar. Continuar?')) {
          cleanAndReload();
        }
      };
      
      document.body.appendChild(button);
    }
  };
}