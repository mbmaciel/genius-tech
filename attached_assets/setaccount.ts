  /**
   * Muda para uma conta específica na lista de contas do usuário
   * @param loginId ID da conta para mudar
   * @returns Promise com resultado da mudança de conta
   */
  public async setAccount(loginId: string): Promise<any> {
    // Definir flag para indicar que uma troca de conta está em andamento
    // Isso vai evitar que a reconexão automática seja bloqueada
    this.isAccountSwitchInProgress = true;
    
    try {
      if (!this.isConnected) {
        throw new Error("WebSocket não está conectado");
      }
      
      if (!loginId) {
        throw new Error("ID da conta é necessário");
      }
      
      console.log(`[DerivAPI] Tentando mudar para a conta: ${loginId}`);
      
      // Primeiro passo: Cancelar todas as assinaturas ativas para evitar problemas
      await this.cancelAllActiveSubscriptions().catch(e => {
        console.warn("[DerivAPI] Erro ao cancelar assinaturas:", e);
      });
      
      // Obter informações atuais para logging
      const currentLoginId = this.accountInfo.loginId;
      console.log(`[DerivAPI] Mudando de conta ${currentLoginId || 'desconhecida'} para ${loginId}`);
      
      // ABORDAGEM SIMPLIFICADA: Usar o próprio token salvo da conta
      const normalizedId = loginId.toLowerCase();
      
      // Obter token da conta a partir de múltiplas fontes, em ordem de prioridade
      const tokenSources: any[] = [
        // 1. Token direto do localStorage específico para esta conta
        { type: 'direct', key: `deriv_token_${normalizedId}` },
        // 2. Token verificado específico
        { type: 'direct', key: `deriv_verified_token_${normalizedId}` },
        // 3. Token do mapeamento global
        { type: 'map', key: 'deriv_account_tokens', field: normalizedId },
        // 4. Token da lista de contas OAuth
        { type: 'list', key: 'deriv_user_accounts', accountField: 'account', tokenField: 'token', value: normalizedId }
      ];
      
      let accountToken = null;
      
      // Tentar obter o token de cada fonte na ordem
      for (const source of tokenSources) {
        try {
          if (source.type === 'direct') {
            const token = localStorage.getItem(source.key);
            if (token) {
              accountToken = token;
              console.log(`[DerivAPI] Token encontrado em: ${source.key}`);
              break;
            }
          } 
          else if (source.type === 'map') {
            const mapJson = localStorage.getItem(source.key);
            if (mapJson) {
              try {
                const tokenMap = JSON.parse(mapJson);
                if (tokenMap && tokenMap[source.field]) {
                  accountToken = tokenMap[source.field];
                  console.log(`[DerivAPI] Token encontrado no mapa: ${source.key}.${source.field}`);
                  break;
                }
              } catch (e) {
                console.warn(`[DerivAPI] Erro ao processar mapa ${source.key}:`, e);
              }
            }
          }
          else if (source.type === 'list') {
            const listJson = localStorage.getItem(source.key);
            if (listJson) {
              try {
                const accounts = JSON.parse(listJson);
                if (Array.isArray(accounts)) {
                  const matchedAccount = accounts.find(
                    acc => acc[source.accountField] && 
                          acc[source.accountField].toLowerCase() === source.value
                  );
                  
                  if (matchedAccount && matchedAccount[source.tokenField]) {
                    accountToken = matchedAccount[source.tokenField];
                    console.log(`[DerivAPI] Token encontrado na lista: ${source.key}`);
                    break;
                  }
                }
              } catch (e) {
                console.warn(`[DerivAPI] Erro ao processar lista ${source.key}:`, e);
              }
            }
          }
        } catch (e) {
          console.warn(`[DerivAPI] Erro ao verificar fonte ${JSON.stringify(source)}:`, e);
        }
      }
      
      // Se não encontrou token específico, usar o token atual como fallback
      if (!accountToken && this.token) {
        accountToken = this.token;
        console.log("[DerivAPI] Usando token atual como fallback");
      }
      
      if (!accountToken) {
        throw new Error(`Nenhum token disponível para a conta ${loginId}. Por favor, faça login novamente.`);
      }
      
      // NOVA ABORDAGEM - MAIS DIRETA:
      // Desconectar completamente, limpar estado e reconectar com o token específico
      
      console.log("[DerivAPI] Desconectando e limpando estado...");
      this.disconnect(true, false);
      
      // Aguardar para garantir desconexão completa
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Conectar novamente com o token específico
      console.log(`[DerivAPI] Reconectando com token específico para conta ${loginId}...`);
      const connectResponse = await this.connect();
      
      if (!connectResponse.connected) {
        throw new Error("Falha ao reconectar ao WebSocket");
      }
      
      // Autorizar diretamente com o token específico
      console.log(`[DerivAPI] Enviando autorização direta com token para ${loginId}`);
      const authResponse = await this.send({
        authorize: accountToken
      });
      
      if (authResponse.error) {
        throw new Error(`Erro na autorização: ${authResponse.error.message}`);
      }
      
      if (!authResponse.authorize) {
        throw new Error("Resposta de autorização inválida ou incompleta");
      }
      
      // Atualizar token e informações locais
      this.token = accountToken;
      this.isTokenAuth = true;
      
      // Atualizar informações da conta
      console.log("[DerivAPI] Atualizando informações da conta...");
      this.updateAccountInfo(authResponse.authorize);
      
      // Verificar se estamos na conta correta
      if (authResponse.authorize.loginid.toLowerCase() !== normalizedId) {
        console.log(`[DerivAPI] Autorização bem-sucedida, mas para conta diferente: ${authResponse.authorize.loginid}`);
        
        // Tentar mudar para a conta correta se estiver na lista
        if (authResponse.authorize.account_list) {
          const targetAccountExists = authResponse.authorize.account_list.some(
            (acc: any) => acc.loginid.toLowerCase() === normalizedId
          );
          
          if (targetAccountExists) {
            console.log(`[DerivAPI] Conta ${loginId} encontrada na lista, tentando set_account`);
            
            // Tentar set_account
            const setAccountResponse = await this.send({
              set_account: loginId
            });
            
            if (setAccountResponse.error) {
              throw new Error(`Erro ao mudar para conta ${loginId}: ${setAccountResponse.error.message}`);
            }
            
            // Atualizar informações
            this.accountInfo.loginId = loginId;
            this.accountInfo.isVirtual = /^VRTC/.test(loginId);
            
            // Notificar mudança
            this.notifyAccountChanged(loginId);
            
            console.log(`[DerivAPI] Conta alterada com sucesso para ${loginId} via set_account`);
            return setAccountResponse;
          } else {
            throw new Error(`A conta ${loginId} não está disponível com este token. Conta autorizada: ${authResponse.authorize.loginid}`);
          }
        } else {
          throw new Error(`Autorização com token específico resultou na conta ${authResponse.authorize.loginid}, não na solicitada: ${loginId}`);
        }
      }
      
      // Armazenar a conta ativa
      localStorage.setItem('deriv_active_account', loginId);
      
      // Salvar o token como verificado para uso futuro
      localStorage.setItem(`deriv_verified_token_${normalizedId}`, accountToken);
      
      // Notificar sobre a mudança de conta
      this.notifyAccountChanged(loginId);
      
      // Restaurar assinaturas básicas
      console.log("[DerivAPI] Restaurando assinaturas básicas...");
      setTimeout(() => {
        this.subscribeToBalanceUpdates()
          .catch(e => console.warn("[DerivAPI] Erro ao restaurar assinatura de saldo:", e));
      }, 500);
      
      console.log(`[DerivAPI] Conta alterada com sucesso para ${loginId}`);
      return { 
        success: true, 
        account: loginId,
        authorize: authResponse.authorize
      };
    } catch (error) {
      console.error(`[DerivAPI] Erro ao mudar para conta ${loginId}:`, error);
      
      // Tentar restaurar a conexão em caso de erro
      try {
        if (!this.isConnected) {
          console.log("[DerivAPI] Tentando reconectar após falha...");
          await this.connect();
          
          if (this.token) {
            const authResult = await this.send({
              authorize: this.token
            });
            
            if (authResult && !authResult.error && authResult.authorize) {
              this.updateAccountInfo(authResult.authorize);
              this.notifyAccountChanged(authResult.authorize.loginid);
            }
          }
        }
      } catch (reconnectError) {
        console.error("[DerivAPI] Falha ao reconectar após erro:", reconnectError);
      }
      
      throw error;
    } finally {
      // Garantir que a flag é redefinida mesmo se ocorrer um erro
      this.isAccountSwitchInProgress = false;
    }
  }
