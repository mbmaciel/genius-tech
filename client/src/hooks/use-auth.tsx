import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { oauthDirectService } from '@/services/oauthDirectService';

export interface UserAccount {
  loginid?: string;
  token?: string;
  account_type?: string;
  currency?: string;
  balance?: number;
  email?: string;
  name?: string;
  is_virtual?: boolean;
  landing_company_name?: string;
}

interface AuthContextType {
  user: UserAccount | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (token?: string) => Promise<void>;
  logout: () => Promise<void>;
  accounts: UserAccount[];
  setActiveAccount: (loginid: string) => Promise<boolean>;
  updateAccountInfo: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [user, setUser] = useState<UserAccount | null>(null);
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      try {
        // Tentar obter token do localStorage
        const token = localStorage.getItem('deriv_oauth_token');
        
        if (token) {
          // Tentar autorizar com token existente
          await login(token);
        } else {
          setIsLoading(false);
        }
      } catch (err: any) {
        console.error('Erro ao verificar autenticação:', err);
        setError(err.message || 'Falha na autenticação');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Função para autenticar usuário
  const login = async (token?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let authToken = token;
      
      // Se não tiver token, pode-se implementar redirecionamento para página de login Deriv
      if (!authToken) {
        throw new Error('Token não fornecido');
      }
      
      // Conectar ao serviço da Deriv
      await oauthDirectService.connect();
      
      // Autorizar com o token
      const authResponse = await oauthDirectService.authorize(authToken);
      
      if (authResponse && authResponse.authorize) {
        // Guardar token no localStorage
        localStorage.setItem('deriv_oauth_token', authToken);
        
        // Criar objeto de usuário a partir da resposta
        const userData: UserAccount = {
          loginid: authResponse.authorize.loginid,
          account_type: authResponse.authorize.account_type,
          currency: authResponse.authorize.currency,
          balance: authResponse.authorize.balance,
          email: authResponse.authorize.email,
          name: authResponse.authorize.fullname,
          is_virtual: authResponse.authorize.is_virtual,
          landing_company_name: authResponse.authorize.landing_company_name,
          token: authToken
        };
        
        setUser(userData);
        
        // Se tiver múltiplas contas disponíveis
        if (authResponse.authorize.account_list && authResponse.authorize.account_list.length > 0) {
          const accountList = authResponse.authorize.account_list.map((acc: any) => ({
            loginid: acc.loginid,
            account_type: acc.account_type,
            currency: acc.currency,
            is_virtual: acc.is_virtual,
            token: acc.token || null,
          }));
          
          setAccounts(accountList);
        } else {
          setAccounts([userData]);
        }
        
        toast({
          title: t('Login bem-sucedido'),
          description: t('Você está conectado como {{name}}', { name: userData.name || userData.loginid }),
          variant: 'default',
        });
      } else {
        throw new Error('Falha na autorização');
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      setError(err.message || 'Falha na autenticação');
      
      toast({
        title: t('Erro no login'),
        description: err.message || t('Não foi possível fazer login. Tente novamente.'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Função para logout
  const logout = async () => {
    try {
      // Desconectar do serviço
      await oauthDirectService.disconnect();
      
      // Limpar dados de autenticação
      localStorage.removeItem('deriv_oauth_token');
      setUser(null);
      setAccounts([]);
      
      toast({
        title: t('Logout realizado'),
        description: t('Você foi desconectado com sucesso.'),
        variant: 'default',
      });
    } catch (err: any) {
      console.error('Erro ao fazer logout:', err);
      
      toast({
        title: t('Erro ao fazer logout'),
        description: err.message || t('Não foi possível fazer logout.'),
        variant: 'destructive',
      });
    }
  };

  // Mudar conta ativa
  const setActiveAccount = async (loginid: string): Promise<boolean> => {
    try {
      const selectedAccount = accounts.find(acc => acc.loginid === loginid);
      
      if (!selectedAccount || !selectedAccount.token) {
        throw new Error('Conta inválida ou sem token');
      }
      
      // Autorizar com o token da conta selecionada
      const authResponse = await oauthDirectService.authorize(selectedAccount.token);
      
      if (authResponse && authResponse.authorize) {
        // Atualizar token principal
        localStorage.setItem('deriv_oauth_token', selectedAccount.token);
        
        // Atualizar dados do usuário
        const updatedUser: UserAccount = {
          ...selectedAccount,
          email: authResponse.authorize.email,
          name: authResponse.authorize.fullname,
          balance: authResponse.authorize.balance,
          landing_company_name: authResponse.authorize.landing_company_name
        };
        
        setUser(updatedUser);
        
        toast({
          title: t('Conta alterada'),
          description: t('Agora você está usando a conta {{id}}', { id: loginid }),
          variant: 'default',
        });
        
        return true;
      } else {
        throw new Error('Falha ao mudar conta');
      }
    } catch (err: any) {
      console.error('Erro ao mudar conta:', err);
      
      toast({
        title: t('Erro ao mudar conta'),
        description: err.message || t('Não foi possível mudar para a conta selecionada.'),
        variant: 'destructive',
      });
      
      return false;
    }
  };

  // Atualizar informações da conta
  const updateAccountInfo = async () => {
    if (!user || !user.token) return;
    
    try {
      // Buscar saldo
      const balanceResponse = await oauthDirectService.getBalance();
      
      if (balanceResponse && balanceResponse.balance) {
        // Atualizar saldo do usuário
        setUser(prev => {
          if (!prev) return null;
          return {
            ...prev,
            balance: balanceResponse.balance.balance
          };
        });
      }
    } catch (err: any) {
      console.error('Erro ao atualizar informações da conta:', err);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isLoading, 
        isAuthenticated,
        error, 
        login, 
        logout,
        accounts,
        setActiveAccount,
        updateAccountInfo
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  
  return context;
}