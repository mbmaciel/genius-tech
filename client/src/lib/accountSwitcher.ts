/**
 * accountSwitcher.ts
 * Gerencia a funcionalidade de troca de contas da Deriv
 * Implementa as funções que permitem alternar entre contas do usuário
 */

import { derivAPI } from './derivApi';

/**
 * Representa o resultado de uma operação de troca de conta
 */
interface SwitchAccountResult {
  success: boolean;
  account?: string;
  balance?: number;
  currency?: string;
  error?: string;
}

/**
 * Realiza a troca para outra conta Deriv
 * 
 * @param accountId ID da conta para qual alternar (formato CR123456 ou VRTC123456)
 * @param forceReconnect Se deve forçar reconexão completa (true) ou tentar usar set_account (false)
 * @returns Resultado da operação de troca de conta
 */
export const switchToAccount = async (
  accountId: string,
  forceReconnect: boolean = false
): Promise<SwitchAccountResult> => {
  try {
    console.log(`[AccountSwitcher] Tentando alternar para conta ${accountId}...`);
    
    // Validar ID da conta
    if (!accountId) {
      return { success: false, error: 'ID da conta não especificado' };
    }
    
    // Obter token da conta
    const token = getAccountToken(accountId);
    if (!token && !forceReconnect) {
      return { success: false, error: 'Token não encontrado para esta conta' };
    }
    
    // Verificar se já estamos na conta solicitada
    const currentInfo = derivAPI.getAuthorizeInfo();
    if (currentInfo && currentInfo.loginid === accountId) {
      console.log(`[AccountSwitcher] Já estamos na conta ${accountId}`);
      return {
        success: true,
        account: accountId,
        balance: currentInfo.balance,
        currency: currentInfo.currency
      };
    }
    
    let result;
    
    if (forceReconnect || !derivAPI.isConnected()) {
      // Método 1: Reconexão completa com novo token
      if (!token) {
        return { success: false, error: 'Token não encontrado para esta conta' };
      }
      
      // Desconectar e limpar estado atual
      derivAPI.disconnect(false);
      
      // Reconectar com novo token
      await derivAPI.connect();
      const authorizeResponse = await derivAPI.authorize(token);
      
      if (authorizeResponse) {
        updateSelectedAccount(accountId);
        
        // Armazenar o token no localStorage para persistência
        saveAccountToken(accountId, token);
        
        return {
          success: true,
          account: accountId,
          balance: authorizeResponse.balance,
          currency: authorizeResponse.currency
        };
      }
    } else {
      // Método 2: Usar set_account para alternar sem reconexão completa
      try {
        const setAccountResponse = await derivAPI.setAccount(accountId);
        
        if (setAccountResponse) {
          updateSelectedAccount(accountId);
          
          return {
            success: true,
            account: accountId,
            balance: setAccountResponse.balance,
            currency: setAccountResponse.currency
          };
        }
      } catch (setAccountError: any) {
        console.error('[AccountSwitcher] Erro ao usar set_account:', setAccountError);
        
        // Se set_account falhar, tentar reconexão completa
        console.log('[AccountSwitcher] Tentando alternar com reconexão completa...');
        return switchToAccount(accountId, true);
      }
    }
    
    return { success: false, error: 'Não foi possível alternar para a conta solicitada' };
  } catch (error: any) {
    console.error('[AccountSwitcher] Erro ao alternar conta:', error);
    return { success: false, error: error.message || 'Erro desconhecido ao alternar conta' };
  }
};

/**
 * Atualiza a conta selecionada no armazenamento local
 * 
 * @param accountId ID da conta selecionada
 */
export const updateSelectedAccount = (accountId: string): void => {
  try {
    if (!accountId) return;
    
    localStorage.setItem('deriv_selected_account', accountId);
    
    // Disparar evento para notificar componentes da UI sobre a troca
    const accountEvent = new CustomEvent('deriv:account_changed', { 
      detail: { account: accountId } 
    });
    document.dispatchEvent(accountEvent);
    
    console.log(`[AccountSwitcher] Conta selecionada atualizada para ${accountId}`);
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao atualizar conta selecionada:', error);
  }
};

/**
 * Obtém a conta atualmente selecionada
 * 
 * @returns ID da conta selecionada ou null se nenhuma estiver selecionada
 */
export const getSelectedAccount = (): string | null => {
  try {
    return localStorage.getItem('deriv_selected_account');
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao obter conta selecionada:', error);
    return null;
  }
};

/**
 * Salva token para uma conta específica
 * 
 * @param accountId ID da conta
 * @param token Token a ser salvo
 */
export const saveAccountToken = (accountId: string, token: string): void => {
  try {
    if (!accountId || !token) return;
    
    // Obter tokens existentes
    const accountTokens = getAccountTokens();
    
    // Atualizar ou adicionar novo token
    accountTokens[accountId] = token;
    
    // Salvar no localStorage
    localStorage.setItem('deriv_account_tokens', JSON.stringify(accountTokens));
    
    console.log(`[AccountSwitcher] Token salvo para conta ${accountId}`);
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao salvar token da conta:', error);
  }
};

/**
 * Obtém o token de uma conta específica
 * 
 * @param accountId ID da conta
 * @returns Token da conta ou null se não encontrado
 */
export const getAccountToken = (accountId: string): string | null => {
  try {
    if (!accountId) return null;
    
    // Obter todos os tokens
    const accountTokens = getAccountTokens();
    
    // Retornar token específico
    return accountTokens[accountId] || null;
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao obter token da conta:', error);
    return null;
  }
};

/**
 * Obtém todos os tokens salvos
 * 
 * @returns Objeto com todos os tokens (accountId -> token)
 */
export const getAccountTokens = (): Record<string, string> => {
  try {
    const tokensStr = localStorage.getItem('deriv_account_tokens');
    return tokensStr ? JSON.parse(tokensStr) : {};
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao obter tokens das contas:', error);
    return {};
  }
};

/**
 * Remove um token específico
 * 
 * @param accountId ID da conta
 */
export const removeAccountToken = (accountId: string): void => {
  try {
    if (!accountId) return;
    
    // Obter tokens existentes
    const accountTokens = getAccountTokens();
    
    // Remover token específico
    if (accountTokens[accountId]) {
      delete accountTokens[accountId];
      
      // Salvar no localStorage
      localStorage.setItem('deriv_account_tokens', JSON.stringify(accountTokens));
      
      console.log(`[AccountSwitcher] Token removido para conta ${accountId}`);
    }
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao remover token da conta:', error);
  }
};

/**
 * Limpa todos os tokens salvos
 */
export const clearAllAccountTokens = (): void => {
  try {
    localStorage.removeItem('deriv_account_tokens');
    localStorage.removeItem('deriv_selected_account');
    localStorage.removeItem('deriv_api_token');
    
    console.log('[AccountSwitcher] Todos os tokens foram removidos');
  } catch (error) {
    console.error('[AccountSwitcher] Erro ao limpar tokens:', error);
  }
};