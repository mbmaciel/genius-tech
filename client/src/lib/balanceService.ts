/**
 * Serviço para obter e gerenciar saldos de contas da Deriv
 * Baseado na documentação: https://api.deriv.com/api-explorer/#balance
 */

// Configuração
const APP_ID = 71403; // App ID do projeto
const WS_URL = `wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`;

export interface BalanceResponse {
  balance: {
    balance: number;
    currency: string;
    loginid: string;
    accounts?: Record<string, {
      balance: number;
      converted_amount: number;
      currency: string;
      demo_account: 0 | 1;
      status: 0 | 1;
      type: 'mt5' | 'deriv';
    }>;
    total?: {
      deriv?: { amount: number; currency: string; };
      deriv_demo?: { amount: number; currency: string; };
      mt5?: { amount: number; currency: string; };
      mt5_demo?: { amount: number; currency: string; };
    };
  };
  subscription?: {
    id: string;
  };
  echo_req?: Record<string, any>;
  msg_type: string;
  req_id?: number;
}

// Lista de callbacks para notificações de saldo
const balanceListeners: Array<(balance: BalanceResponse['balance']) => void> = [];
let balanceSubscriptionId: string | null = null;
let socket: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;

/**
 * Obtém o saldo atualizado de uma conta específica ou da conta atual
 * @param token Token de autorização da conta
 * @param accountId ID opcional da conta (ex: CR123456)
 * @param subscribe Se deve inscrever-se para atualizações automáticas
 */
export async function getBalance(
  token: string, 
  accountId: string = 'current', 
  subscribe: boolean = false
): Promise<BalanceResponse['balance']> {
  return new Promise((resolve, reject) => {
    // Fechar qualquer conexão existente
    if (socket) {
      try {
        socket.close();
      } catch (e) {
        console.error('Erro ao fechar WebSocket existente:', e);
      }
      socket = null;
    }
    
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    
    // Abrir nova conexão
    socket = new WebSocket(WS_URL);
    
    // Timeout para não esperar indefinidamente
    const timeout = setTimeout(() => {
      if (socket) {
        socket.close();
        socket = null;
      }
      reject(new Error('Timeout ao obter saldo.'));
    }, 15000);
    
    socket.onopen = () => {
      // Primeiro autorizar o token
      const authRequest = {
        authorize: token
      };
      socket.send(JSON.stringify(authRequest));
    };
    
    socket.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        
        // Se for resposta de autorização bem-sucedida
        if (response.authorize) {
          // Agora solicitar o saldo
          const balanceRequest = {
            balance: 1,
            account: accountId,
            subscribe: subscribe ? 1 : 0
          };
          socket.send(JSON.stringify(balanceRequest));
        }
        // Se for resposta de saldo
        else if (response.msg_type === 'balance') {
          clearTimeout(timeout);
          
          // Se tiver ID de inscrição, salvar
          if (response.subscription && response.subscription.id) {
            balanceSubscriptionId = response.subscription.id;
          }
          
          // Se não for inscrição, fechar socket
          if (!subscribe) {
            if (socket) {
              socket.close();
              socket = null;
            }
          }
          
          // Notificar listeners se houver atualizações de saldo
          if (subscribe) {
            notifyBalanceListeners(response.balance);
          }
          
          resolve(response.balance);
        }
        // Se for erro
        else if (response.error) {
          clearTimeout(timeout);
          if (socket) {
            socket.close();
            socket = null;
          }
          reject(new Error(`Erro ao obter saldo: ${response.error.message}`));
        }
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
      }
    };
    
    socket.onerror = (error) => {
      clearTimeout(timeout);
      console.error('Erro na conexão WebSocket:', error);
      if (socket) {
        socket.close();
        socket = null;
      }
      reject(new Error('Falha na comunicação com a API da Deriv.'));
    };
    
    socket.onclose = () => {
      clearTimeout(timeout);
      // Se foi fechado, mas ainda temos inscrição ativa
      if (subscribe && balanceSubscriptionId) {
        // Agendar reconexão
        reconnectTimeout = setTimeout(() => {
          reconnectTimeout = null;
          getBalance(token, accountId, subscribe).catch(console.error);
        }, 5000);
      }
    };
  });
}

/**
 * Adiciona um listener para atualizações de saldo
 * @param listener Função chamada quando o saldo for atualizado
 */
export function addBalanceListener(listener: (balance: BalanceResponse['balance']) => void): void {
  if (typeof listener !== 'function') return;
  
  // Evitar duplicações
  if (!balanceListeners.includes(listener)) {
    balanceListeners.push(listener);
  }
}

/**
 * Remove um listener de atualizações de saldo
 * @param listener Função a ser removida
 */
export function removeBalanceListener(listener: (balance: BalanceResponse['balance']) => void): void {
  const index = balanceListeners.indexOf(listener);
  if (index !== -1) {
    balanceListeners.splice(index, 1);
  }
}

/**
 * Notifica todos os listeners sobre um novo saldo
 * @param balance Dados do saldo
 */
function notifyBalanceListeners(balance: BalanceResponse['balance']): void {
  balanceListeners.forEach(listener => {
    try {
      listener(balance);
    } catch (error) {
      console.error('Erro no listener de saldo:', error);
    }
  });
}

/**
 * Cancela a inscrição de atualizações de saldo
 */
export function unsubscribeBalance(): void {
  if (socket && socket.readyState === WebSocket.OPEN && balanceSubscriptionId) {
    const forgetRequest = {
      forget: balanceSubscriptionId
    };
    socket.send(JSON.stringify(forgetRequest));
    balanceSubscriptionId = null;
  }
  
  if (socket) {
    socket.close();
    socket = null;
  }
  
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

// Exporta objeto com métodos principais
export default {
  getBalance,
  addBalanceListener,
  removeBalanceListener,
  unsubscribeBalance
};