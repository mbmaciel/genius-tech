/**
 * tokenBlocklist.ts
 * Fornece mecanismos para verificar e gerenciar tokens bloqueados
 * Útil para melhorar a segurança e evitar o uso de tokens inválidos
 */

export class TokenBlocklist {
  private blockedTokens: Set<string> = new Set();
  private isInitialized: boolean = false;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Inicializa a lista de bloqueio
   */
  private initialize(): void {
    try {
      // Carregar tokens bloqueados do armazenamento local
      const blocklistStr = localStorage.getItem('deriv_blocked_tokens');
      if (blocklistStr) {
        const blocklistArray = JSON.parse(blocklistStr);
        if (Array.isArray(blocklistArray)) {
          blocklistArray.forEach(token => {
            if (token && typeof token === 'string') {
              this.blockedTokens.add(token);
            }
          });
        }
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.error('[TokenBlocklist] Erro ao inicializar lista de bloqueio:', error);
      // Mesmo com erro, consideramos inicializado para evitar tentativas repetidas
      this.isInitialized = true;
    }
  }
  
  /**
   * Verifica se um token está na lista de bloqueados
   * @param token Token para verificar
   * @returns true se o token estiver bloqueado
   */
  public isTokenBlocked(token: string): boolean {
    if (!this.isInitialized) {
      this.initialize();
    }
    
    // Verificação simples para tokens inválidos ou vazios
    if (!token || token.length < 5) {
      return true;
    }
    
    // Verificar lista de bloqueio explícita
    return this.blockedTokens.has(token);
  }
  
  /**
   * Adiciona um token à lista de bloqueados
   * @param token Token para bloquear
   */
  public blockToken(token: string): void {
    if (!token || token.length < 5) return;
    
    this.blockedTokens.add(token);
    this.saveBlocklist();
  }
  
  /**
   * Remove um token da lista de bloqueados
   * @param token Token para desbloquear
   */
  public unblockToken(token: string): void {
    this.blockedTokens.delete(token);
    this.saveBlocklist();
  }
  
  /**
   * Salva a lista de bloqueio no localStorage
   */
  private saveBlocklist(): void {
    try {
      const blocklistArray = Array.from(this.blockedTokens);
      localStorage.setItem('deriv_blocked_tokens', JSON.stringify(blocklistArray));
    } catch (error) {
      console.error('[TokenBlocklist] Erro ao salvar lista de bloqueio:', error);
    }
  }
  
  /**
   * Limpa a lista de bloqueio
   */
  public clearBlocklist(): void {
    this.blockedTokens.clear();
    localStorage.removeItem('deriv_blocked_tokens');
  }
  
  /**
   * Obtém a lista de tokens bloqueados
   * @returns Um array com todos os tokens bloqueados
   */
  public getBlockedTokens(): string[] {
    return Array.from(this.blockedTokens);
  }
  
  /**
   * Ativa o bloqueio de tokens de ambiente
   * Usado principalmente durante o processo OAuth para garantir
   * que apenas o token OAuth seja utilizado
   */
  public enableEnvTokenBlocking(): void {
    localStorage.setItem('deriv_block_env_tokens', 'true');
    console.log('[TokenBlocklist] Bloqueio de tokens de ambiente ativado');
  }
  
  /**
   * Desativa o bloqueio de tokens de ambiente
   */
  public disableEnvTokenBlocking(): void {
    localStorage.removeItem('deriv_block_env_tokens');
    console.log('[TokenBlocklist] Bloqueio de tokens de ambiente desativado');
  }
  
  /**
   * Verifica se o bloqueio de tokens de ambiente está ativo
   */
  public isEnvTokenBlockingEnabled(): boolean {
    return localStorage.getItem('deriv_block_env_tokens') === 'true';
  }
  
  /**
   * Limpa tokens expirados ou inválidos da lista de bloqueados
   * Evita o acúmulo de entidades antigas no armazenamento
   */
  public cleanBlockedEntities(): void {
    try {
      // Remover tokens expirados (mais antigos que 30 dias)
      const blockedList = this.getBlockedTokens();
      const currentTime = Date.now();
      const expireTime = 30 * 24 * 60 * 60 * 1000; // 30 dias em milissegundos
      
      // Verificar timestamps dos bloqueios
      const blockTimestamps = JSON.parse(localStorage.getItem('token_block_timestamps') || '{}');
      const newTimestamps: Record<string, number> = {};
      
      // Manter apenas tokens não expirados
      Object.keys(blockTimestamps).forEach(token => {
        if (currentTime - blockTimestamps[token] < expireTime) {
          newTimestamps[token] = blockTimestamps[token];
        } else {
          // Token expirado, remover do bloqueio
          this.unblockToken(token);
        }
      });
      
      // Atualizar timestamps
      localStorage.setItem('token_block_timestamps', JSON.stringify(newTimestamps));
      
      console.log(`[TokenBlocklist] Limpeza concluída: ${blockedList.length - this.blockedTokens.size} tokens expirados removidos`);
    } catch (error) {
      console.error('[TokenBlocklist] Erro durante limpeza:', error);
    }
  }
}

// Exportar como singleton para uso global
const tokenBlocklist = new TokenBlocklist();
export default tokenBlocklist;

// Exportar funções individuais para importação direta
export const cleanBlockedEntities = () => tokenBlocklist.cleanBlockedEntities();
export const isTokenBlocked = (token: string): boolean => tokenBlocklist.isTokenBlocked(token);

/**
 * Verifica se uma conta específica está bloqueada
 * @param accountId ID da conta para verificar
 * @returns true se a conta estiver bloqueada
 */
export const isAccountBlocked = (accountId: string): boolean => {
  if (!accountId) return false;
  
  try {
    // Verificar na lista de contas bloqueadas
    const blockedAccounts = JSON.parse(localStorage.getItem('deriv_blocked_accounts') || '[]');
    return blockedAccounts.includes(accountId);
  } catch (e) {
    console.error('[TokenBlocklist] Erro ao verificar bloqueio de conta:', e);
    return false;
  }
};