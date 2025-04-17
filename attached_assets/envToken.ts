// Funções para acessar tokens e variáveis de ambiente de forma segura

/**
 * Obtém o token da API Deriv de forma síncrona
 * Prioridade: 
 * 1. Sessão do navegador
 * 2. Variáveis de ambiente VITE_DERIV_API_TOKEN (cliente)
 * 3. Valores salvos na janela (window) pelo servidor
 */
export const getDerivTokenSync = (): string | null => {
  // Tentar obter o token da sessão primeiro (configurado pelo usuário)
  const sessionToken = sessionStorage.getItem('derivToken');
  if (sessionToken) {
    return sessionToken;
  }
  
  // Ou da variável de ambiente global (configurada pelo desenvolvedor)
  const windowToken = typeof window !== 'undefined' ? (window as any).DERIV_API_TOKEN : null;
  if (windowToken) {
    return windowToken;
  }
  
  // Ou da variável de ambiente Vite (para desenvolvimento)
  if (import.meta.env.VITE_DERIV_API_TOKEN) {
    return import.meta.env.VITE_DERIV_API_TOKEN as string;
  }

  // Se nada for encontrado, retornar null para forçar o usuário a fornecer seu token
  return null;
};

/**
 * Obtém o token da API Deriv (versão assíncrona para compatibilidade)
 */
export const getDerivToken = async (): Promise<string | null> => {
  return getDerivTokenSync();
};