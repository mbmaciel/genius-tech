/**
 * Interface para o serviço OAuthDirect
 * Define as operações suportadas pelo serviço de OAuth direto
 */

export interface TradingEvent {
  type: string;
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
  
  // Métodos para configuração
  setSettings(settings: Partial<TradingSettings>): void;
  setActiveStrategy(strategy: string): void;
  
  // Métodos para eventos
  addEventListener(listener: (event: TradingEvent) => void): void;
  removeEventListener(listener: (event: TradingEvent) => void): void;
}