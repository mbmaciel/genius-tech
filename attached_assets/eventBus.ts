/**
 * Sistema de Event Bus para comunicação entre componentes
 * Permite que componentes sem relação direta se comuniquem através de eventos
 */

type EventCallback = (data: any) => void;

class EventBus {
  private events: Record<string, Set<EventCallback>> = {};

  /**
   * Registra um callback para um evento específico
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) {
      this.events[event] = new Set();
    }
    
    this.events[event].add(callback);
    
    // Retorna uma função para remover o ouvinte
    return () => {
      this.off(event, callback);
    };
  }

  /**
   * Remove um callback específico para um evento
   */
  off(event: string, callback: EventCallback): void {
    if (this.events[event]) {
      this.events[event].delete(callback);
    }
  }

  /**
   * Emite um evento com os dados fornecidos
   */
  emit(event: string, data?: any): void {
    if (this.events[event]) {
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Erro ao processar evento ${event}:`, error);
        }
      });
    }
  }

  /**
   * Remove todos os event listeners
   */
  clear(): void {
    this.events = {};
  }
}

// Eventos globais da aplicação
export const EVENTS = {
  STATE_CHANGED: 'state_changed',
  TRADING_STATUS_CHANGED: 'trading_status_changed',
  ACCOUNT_UPDATED: 'account_updated',
  TICK_RECEIVED: 'tick_received',
  BALANCE_UPDATED: 'balance_updated',
  ERROR_OCCURRED: 'error_occurred',
  STATS_UPDATED: 'stats_updated',
  OPTIONS_UPDATED: 'options_updated',
  TRADES_UPDATED: 'trades_updated',
  CONTRACT_UPDATED: 'contract_updated',
  OPEN_CONTRACTS_UPDATED: 'open_contracts_updated',
};

// Instância do Event Bus para toda a aplicação
export const eventBus = new EventBus();

// Exporta o tipo de callback para facilitar o uso
export type { EventCallback };