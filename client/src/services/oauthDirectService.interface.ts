/**
 * Interface para o serviço OAuthDirect
 * Define as operações suportadas pelo serviço de OAuth direto
 */

export type TradingEventType = 
  | 'authorized'         // Autorização realizada
  | 'tick'               // Novo tick recebido
  | 'error'              // Erro ocorrido
  | 'contract_purchased' // Contrato comprado
  | 'contract_update'    // Atualização de contrato
  | 'contract_finished'  // Contrato finalizado
  | 'balance_update'     // Atualização de saldo
  | 'bot_started'        // Bot iniciado
  | 'bot_stopped'        // Bot parado
  | 'operation_started'  // Operação iniciada
  | 'account_changed';   // Conta trocada

export interface TradingEvent {
  type: TradingEventType | string;
  message?: string;
  account?: any;
  price?: number;
  lastDigit?: number;
  symbol?: string;
  epoch?: number;
  contract_id?: string | number;
  buy_price?: number;
  contract?: any;
  profit?: number;
  is_win?: boolean;
  contract_details?: any;
  balance?: any;
  strategy?: string;
  settings?: TradingSettings;
  contract_type?: string;
  amount?: number;
  prediction?: number;
  loginid?: string;
  [key: string]: any;
}

export interface TradingSettings {
  entryValue: string | number;
  profitTarget?: string | number;
  lossLimit?: string | number;
  martingaleFactor?: number;
  contractType?: string;
  prediction?: number;
}

export interface OAuthDirectServiceInterface {
  // Métodos para gestão de serviço
  start(): Promise<boolean>;
  stop(): void;
  closeConnection(): void;
  reconnect(): Promise<boolean>;
  
  // Métodos para configuração
  setSettings(settings: Partial<TradingSettings>): void;
  setActiveStrategy(strategy: string): void;
  setActiveAccount(loginid: string, token: string): void;
  
  // Métodos para eventos
  addEventListener(listener: (event: TradingEvent) => void): void;
  removeEventListener(listener: (event: TradingEvent) => void): void;
}