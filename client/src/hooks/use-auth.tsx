import React, { createContext, ReactNode, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
}

interface User {
  id: number;
  username: string;
  email?: string;
  name?: string;
}

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  name?: string;
}

// Contexto de autenticação
export const AuthContext = createContext<AuthContextType | null>(null);

// Provedor de autenticação
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Verificar se o usuário está autenticado ao carregar
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        // Verificar se há um usuário no localStorage
        const savedUser = localStorage.getItem('auth_user');
        if (savedUser) {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
        }
      } catch (err) {
        console.error('Erro ao verificar autenticação:', err);
        setError(err instanceof Error ? err : new Error('Erro desconhecido'));
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Função de login
  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Simula autenticação - em um caso real, chamaria uma API
      if (username === 'demo' && password === 'password') {
        const user = {
          id: 1,
          username: 'demo',
          name: 'Usuário Demo',
          email: 'demo@example.com'
        };
        
        setUser(user);
        localStorage.setItem('auth_user', JSON.stringify(user));
        
        toast({
          title: t('Login realizado com sucesso'),
          description: t('Bem-vindo de volta, {{name}}', { name: user.name }),
          variant: 'default',
        });
      } else {
        throw new Error(t('Credenciais inválidas'));
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('Erro ao fazer login'));
      setError(error);
      
      toast({
        title: t('Erro ao fazer login'),
        description: error.message,
        variant: 'destructive',
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Função de logout
  const logout = async () => {
    try {
      setIsLoading(true);
      setUser(null);
      localStorage.removeItem('auth_user');
      localStorage.removeItem('deriv_token');
      
      toast({
        title: t('Logout realizado com sucesso'),
        description: t('Você foi desconectado do sistema'),
        variant: 'default',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('Erro ao fazer logout'));
      setError(error);
      
      toast({
        title: t('Erro ao fazer logout'),
        description: error.message,
        variant: 'destructive',
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Função de registro
  const register = async (userData: RegisterData) => {
    try {
      setIsLoading(true);
      setError(null);

      // Simula registro - em um caso real, chamaria uma API
      const newUser = {
        id: 1,
        username: userData.username,
        name: userData.name || userData.username,
        email: userData.email
      };
      
      setUser(newUser);
      localStorage.setItem('auth_user', JSON.stringify(newUser));
      
      toast({
        title: t('Registro realizado com sucesso'),
        description: t('Bem-vindo, {{name}}', { name: newUser.name }),
        variant: 'default',
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(t('Erro ao registrar'));
      setError(error);
      
      toast({
        title: t('Erro ao registrar'),
        description: error.message,
        variant: 'destructive',
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Valor do contexto
  const contextValue: AuthContextType = {
    user,
    isLoading,
    error,
    login,
    logout,
    register
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook de autenticação
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}