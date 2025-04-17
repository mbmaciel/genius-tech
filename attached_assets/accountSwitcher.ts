/**
 * accountSwitcher.ts - Gerenciador de troca de contas da API Deriv
 * Implementação baseada na documentação oficial
 * https://api.deriv.com/api-explorer/#account_switch
 */

import derivAPI from './derivApi';
import { AuthError, ConnectionError, ValidationError } from './errorFactory';

/**
 * Interface de resposta após a troca de conta
 */
interface SwitchAccountResponse {
  success: boolean;
  error?: string;
  account?: string;
  currency?: string;
  balance?: number;
}

/**
 * Função para trocar de conta utilizando o método account_switch da API Deriv
 * Esta é a solução recomendada oficialmente para troca entre contas de um mesmo usuário
 * 
 * @param accountId ID da conta para a qual deseja trocar (ex: CR123456, VRTC123456)
 * @param forceReconnect Se true, força uma reconexão total com novo token
 * @returns Resultado da operação
 */
export async function switchToAccount(accountId: string, forceReconnect: boolean = true): Promise<SwitchAccountResponse> {
  try {
    console.log(`[AccountSwitcher] Iniciando troca para a conta ${accountId}...`);
    
    // 1. Verificar se a API está conectada
    if (!derivAPI.getConnectionStatus()) {
      console.log('[AccountSwitcher] API não conectada, tentando reconexão...');
      await derivAPI.connect();

      if (!derivAPI.getConnectionStatus()) {
        throw new ConnectionError('Não foi possível estabelecer conexão com a API Deriv');
      }
    }

    // 2. Cancelar todas as assinaturas ativas para evitar conflitos
    console.log('[AccountSwitcher] Cancelando assinaturas ativas...');
    await derivAPI.cancelAllActiveSubscriptions();

    if (forceReconnect) {
      // Implementação com autorização direta, sem desconexão total
      console.log('[AccountSwitcher] Usando abordagem melhorada para troca de contas...');
      
      // Encontrar o token para a conta específica - verificando múltiplos locais de armazenamento
      console.log(`[AccountSwitcher] Procurando token para a conta ${accountId}...`);
      
      // Verificamos em múltiplos formatos para maior compatibilidade
      let specificToken: string | null = null;
      
      // Formato 1 (case-sensitive - formato principal)
      const tokenKey1 = `deriv_verified_token_${accountId}`;
      if (localStorage.getItem(tokenKey1)) {
        specificToken = localStorage.getItem(tokenKey1);
        console.log(`[AccountSwitcher] Token encontrado em ${tokenKey1}`);
      }
      
      // Formato 2 (minúsculo)
      if (!specificToken) {
        const tokenKey2 = `deriv_token_${accountId.toLowerCase()}`;
        if (localStorage.getItem(tokenKey2)) {
          specificToken = localStorage.getItem(tokenKey2);
          console.log(`[AccountSwitcher] Token encontrado em ${tokenKey2}`);
        }
      }
      
      // Formato 3 (verificar no mapa de tokens)
      if (!specificToken) {
        try {
          const tokenMap = JSON.parse(localStorage.getItem('deriv_account_token_map') || '{}');
          if (tokenMap[accountId]) {
            specificToken = tokenMap[accountId];
            console.log(`[AccountSwitcher] Token encontrado no mapa de tokens`);
          } else if (tokenMap[accountId.toLowerCase()]) {
            specificToken = tokenMap[accountId.toLowerCase()];
            console.log(`[AccountSwitcher] Token encontrado no mapa de tokens (lowercase)`);
          }
        } catch (e) {
          console.error(`[AccountSwitcher] Erro ao verificar mapa de tokens:`, e);
        }
      }
      
      if (!specificToken) {
        throw new AuthError(`Não foi possível encontrar um token para a conta ${accountId}. Por favor, conecte-se uma vez com esta conta para gerar o token.`);
      }
      
      console.log(`[AccountSwitcher] Token encontrado para a conta ${accountId}`);
      
      // Verificar se já estamos conectados
      if (!derivAPI.getConnectionStatus()) {
        // Se não estamos conectados, precisamos conectar primeiro
        console.log('[AccountSwitcher] WebSocket não conectado, estabelecendo conexão...');
        await derivAPI.connect();
      } else {
        console.log('[AccountSwitcher] WebSocket já conectado, mantendo conexão ativa');
      }
      
      // Autenticar com o token específico, sem desconectar
      console.log('[AccountSwitcher] Autorizando com novo token, sem desconectar...');
      const authResponse = await derivAPI.send({
        authorize: specificToken
      });
      
      // Verificar se a autorização foi bem-sucedida
      if (authResponse.error) {
        console.error('[AccountSwitcher] Erro na autorização:', authResponse.error);
        throw new AuthError(`Falha na autorização: ${authResponse.error.message}`);
      }
      
      // Aguardar um momento para garantir que a conexão esteja estável
      console.log('[AccountSwitcher] Aguardando para estabilizar a conexão...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Atualizar conta ativa no localStorage
      localStorage.setItem('deriv_active_account', accountId);
      
      // Verificar se a conexão foi bem-sucedida
      const accountInfo = derivAPI.getAccountInfo();
      
      if (!accountInfo || accountInfo.loginid !== accountId) {
        throw new ValidationError(`Falha na reconexão: a conta conectada (${accountInfo?.loginid || 'desconhecida'}) não corresponde à solicitada (${accountId})`);
      }
      
      return {
        success: true,
        account: accountId,
        currency: accountInfo.currency,
        balance: accountInfo.balance?.balance
      };
    } else {
      // Implementação com account_switch (recomendada pela Deriv)
      console.log('[AccountSwitcher] Enviando comando account_switch...');
      
      // O formato correto conforme documentação da Deriv é account_switch
      console.log(`[AccountSwitcher] Tentando trocar para ${accountId} via account_switch`);
      const response = await derivAPI.send({
        account_switch: accountId
      });
      
      console.log('[AccountSwitcher] Resposta completa:', response);
      
      if (response.error) {
        console.error('[AccountSwitcher] Erro na troca de conta:', response.error);
        return {
          success: false,
          error: response.error.message || 'Erro desconhecido ao trocar de conta'
        };
      }
      
      if (response.account_switch || response.authorize) {
        console.log('[AccountSwitcher] Troca bem-sucedida para', accountId);
        
        // Atualizar conta ativa no localStorage
        localStorage.setItem('deriv_active_account', accountId);
        
        // Reautorizar para obter os dados atualizados
        const token = derivAPI.getToken();
        if (!token) {
          console.warn('[AccountSwitcher] Token não disponível para reautorização');
          return {
            success: true,
            account: accountId
          };
        }
        
        try {
          const authResult = await derivAPI.authorize(token);
          
          if (authResult.authorize) {
            console.log('[AccountSwitcher] Autorização após troca bem-sucedida');
            
            return {
              success: true,
              account: authResult.authorize.loginid,
              currency: authResult.authorize.currency,
              balance: authResult.authorize.balance
            };
          }
        } catch (error) {
          console.warn('[AccountSwitcher] Erro na reautorização após troca bem-sucedida:', error);
          // Não falhar a operação se apenas a reautorização falhar
          return {
            success: true,
            account: accountId
          };
        }
        
        return {
          success: true,
          account: accountId
        };
      }
      
      return {
        success: false,
        error: 'Resposta inválida da API'
      };
    }
  } catch (error: any) {
    console.error('[AccountSwitcher] Erro ao trocar de conta:', error);
    return {
      success: false,
      error: error.message || 'Erro desconhecido'
    };
  }
}