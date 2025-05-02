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
  | 'account_changed'    // Conta trocada
  | 'token_validated';   // Token validado com sucesso

export interface BotStats {
  wins: number;
  losses: number;
  totalProfit: number;
}

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
  activeSymbol?: string;   // Símbolo ativo (ex: R_100)
  duration?: number;       // Duração do contrato
  durationUnit?: string;   // Unidade de duração (t = ticks, s = segundos, etc)
  lossVirtualEnabled?: boolean; // Habilita a funcionalidade de lossVirtual (martingale após perda)
  resetOnWin?: boolean;    // Reset para valor inicial após vitória
  barrier?: string;        // Valor da barreira para contratos que usam barrier
  
  // Novas configurações para as regras específicas de Loss Virtual
  lossVirtualConsecutiveDigits?: number; // Número mínimo de ocorrências consecutivas para ativar Loss Virtual (para ProfitPro e MaxPro)
  martingaleAfterXLosses?: number;      // Aplicar martingale após X perdas consecutivas
  
  // Gerenciamento de nível de risco
  riskLevel?: 'low' | 'medium' | 'high'; // Nível de risco: baixo, médio ou alto
}

export interface OAuthDirectServiceInterface {
  // Métodos para gestão de serviço
  start(): Promise<boolean>;
  stop(): void;
  closeConnection(): void;
  reconnect(): Promise<boolean>;
  initializeConnection(): Promise<boolean>; // Método para inicializar conexão
  subscribeToTicks(symbol?: string): void; // Método para inscrição em ticks
  
  // Métodos para configuração
  setSettings(settings: Partial<TradingSettings>): void;
  setActiveStrategy(strategy: string): void;
  setActiveAccount(loginid: string, token: string): void;
  
  // Métodos para obter informações da conta
  getAccountBalance(): void; // Método para solicitar saldo atual da conta
  authorizeActiveToken(): Promise<boolean>; // Método para autorizar o token ativo
  getTicksHistory(symbol: string, count?: number): Promise<any>; // Método para obter histórico de ticks
  
  // Métodos para estatísticas e análise
  getDigitStats(): any[]; // Método para obter estatísticas de dígitos
  getDigitPercentage(digit: number): number; // Método para obter porcentagem de um dígito específico
  getRecentDigits(): number[]; // Método para obter os dígitos mais recentes
  getLastDigits(count?: number): number[]; // Método para obter os últimos N dígitos
  
  // Métodos para operação
  executeFirstOperation(amount?: number | string): Promise<boolean>; // Iniciar primeira operação
  executeContractBuy(amount?: number): void; // Executar compra de contrato
  
  // Métodos para eventos
  addEventListener(listener: (event: TradingEvent) => void): void;
  removeEventListener(listener: (event: TradingEvent) => void): void;
  
  // Métodos para histórico de operações
  getOperationsHistory(limit?: number): any[]; // Obter histórico de operações
  getStats(): BotStats; // Obter estatísticas de operações
}