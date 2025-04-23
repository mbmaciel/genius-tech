import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';

// Tipo para o usuário
export interface User {
  id: string;
  username: string;
  accountId?: string;
  email?: string;
  type?: 'deriv' | 'standard';
  balance?: number;
  currency?: string;
  isVirtual?: boolean;
}

// Tipo para o contexto de autenticação
export interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loginWithDeriv: (token: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

// Criação do contexto
const AuthContext = createContext<AuthContextType | null>(null);

// Hook para uso do contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}

// Provider do contexto
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Verificar autenticação no carregamento
  useEffect(() => {
    // Tentar obter usuário do localStorage
    const storedUser = localStorage.getItem('user');
    const derivAccountInfo = localStorage.getItem('deriv_account_info');
    
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else if (derivAccountInfo) {
      // Se tiver informações da Deriv, criar um usuário baseado nelas
      const derivInfo = JSON.parse(derivAccountInfo);
      const derivUser: User = {
        id: derivInfo.loginid || derivInfo.client_id || 'deriv-user',
        username: derivInfo.name || derivInfo.fullname || 'Deriv User',
        accountId: derivInfo.loginid || derivInfo.client_id,
        email: derivInfo.email,
        type: 'deriv',
        balance: derivInfo.balance?.balance || derivInfo.balance,
        currency: derivInfo.currency,
        isVirtual: derivInfo.is_virtual
      };
      
      setUser(derivUser);
      localStorage.setItem('user', JSON.stringify(derivUser));
    }
    
    setLoading(false);
  }, []);

  // Função de login
  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // Simulação de API - em produção, isso seria uma chamada real
      if (username && password) {
        // Usuário de exemplo para demonstração
        const loggedUser: User = {
          id: '1',
          username: username,
          email: `${username}@example.com`,
          type: 'standard'
        };
        
        setUser(loggedUser);
        localStorage.setItem('user', JSON.stringify(loggedUser));
        localStorage.setItem('isLoggedIn', 'true');
        
        toast({
          title: t('Login realizado com sucesso'),
          description: t('Bem-vindo de volta, {{username}}', { username }),
          variant: 'default'
        });
      } else {
        throw new Error(t('Credenciais inválidas'));
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: t('Erro no login'),
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Função de login com Deriv
  const loginWithDeriv = async (token: string) => {
    setLoading(true);
    setError(null);
    
    try {
      if (!token) {
        throw new Error(t('Token não fornecido'));
      }
      
      // Em uma implementação real, você enviaria o token para seu backend
      // ou faria uma chamada para a API Deriv para obter detalhes do usuário
      
      // Código de demonstração
      localStorage.setItem('deriv_oauth_token', token);
      
      // Criar um usuário temporário baseado no token
      // (na implementação real, você teria dados completos)
      const derivUser: User = {
        id: 'deriv-' + Date.now(),
        username: 'Deriv User',
        type: 'deriv',
        accountId: 'deriv-account'
      };
      
      setUser(derivUser);
      localStorage.setItem('user', JSON.stringify(derivUser));
      localStorage.setItem('isLoggedIn', 'true');
      
      toast({
        title: t('Login Deriv realizado com sucesso'),
        description: t('Conectado à sua conta Deriv'),
        variant: 'default'
      });
    } catch (err: any) {
      setError(err.message);
      toast({
        title: t('Erro no login Deriv'),
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Função de logout
  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
    // Não remover tokens Deriv para não perder a conexão com a API
    setUser(null);
    
    toast({
      title: t('Logout realizado'),
      description: t('Você foi desconectado com sucesso'),
      variant: 'default'
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        loginWithDeriv,
        loading,
        error
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}