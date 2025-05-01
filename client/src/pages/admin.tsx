import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Loader2, 
  Plus, 
  Trash2, 
  UserPlus, 
  Users, 
  ArrowLeft, 
  ArrowLeftCircle, 
  ChevronLeft, 
  BarChart4, 
  Calendar, 
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { derivAPI } from '@/lib/derivApi';

// Interfaces
interface User {
  id: string;
  name: string;
  email: string;
  password?: string; // Apenas para cadastro
  createdAt: string;
  isActive: boolean;
  lastLogin?: string;
  role: 'user' | 'admin';
}

// Interface para as estatísticas de comissão da API Deriv
interface AppMarkupStatistics {
  breakdown: Array<{
    app_id: number;
    app_markup_usd: number;
    app_markup_value: number;
    dev_currcode: string;
    transactions_count: number;
  }>;
  total_app_markup_usd: number;
  total_transactions_count: number;
}

export default function AdminPage() {
  // Estados
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [users, setUsers] = useState<User[]>([]);
  const [newUserDialog, setNewUserDialog] = useState<boolean>(false);
  const [selectedTab, setSelectedTab] = useState<string>('users');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0], // 1 mês atrás
    to: new Date().toISOString().split('T')[0] // Hoje
  });
  const [loadingMarkupStats, setLoadingMarkupStats] = useState<boolean>(false);
  const [markupStats, setMarkupStats] = useState<AppMarkupStatistics | null>(null);
  
  // Formulário de novo usuário
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    email: '',
    password: '',
    isActive: true,
    role: 'user',
  });
  
  // Stats (estatísticas)
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    newUsersToday: 0,
    loginsToday: 0,
  });
  
  const { toast } = useToast();
  
  // Configurar intervalo de atualização para estatísticas em tempo real
  useEffect(() => {
    // Verificar se é admin
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    if (!isAdmin) {
      toast({
        title: 'Acesso não autorizado',
        description: 'Você não tem permissão para acessar o painel administrativo.',
        variant: 'destructive',
      });
      
      // Redirecionar para login
      window.location.href = '/login';
      return;
    }
    
    // Carregar dados iniciais
    async function initialize() {
      await loadUsers();
      if (selectedTab === 'commissions') {
        fetchMarkupStatistics();
      }
    }
    
    initialize();
  }, [selectedTab]);
  
  // Função para buscar estatísticas de comissão da API Deriv
  const fetchMarkupStatistics = async () => {
    // Verificar se o usuário está conectado e autorizado
    try {
      // Tenta obter o status da autorização enviando uma requisição authorize
      const authCheck = await derivAPI.send({ authorize: localStorage.getItem('deriv_token') || '' });
      
      if (!authCheck || authCheck.error) {
        toast({
          title: 'Não autorizado',
          description: 'É necessário estar conectado com a Deriv para visualizar as estatísticas de comissão.',
          variant: 'destructive',
        });
        return;
      }
    } catch (error) {
      toast({
        title: 'Erro de conexão',
        description: 'Não foi possível verificar a autorização com a Deriv.',
        variant: 'destructive',
      });
      return;
    }
    
    setLoadingMarkupStats(true);
    
    try {
      console.log('[ADMIN] Buscando estatísticas de comissão da API Deriv...');
      console.log('[ADMIN] Período:', dateRange.from, 'até', dateRange.to);
      
      const appMarkupRequest = {
        app_markup_statistics: 1,
        date_from: dateRange.from,
        date_to: dateRange.to
      };
      
      const response = await derivAPI.send(appMarkupRequest);
      
      if (response.error) {
        console.error('[ADMIN] Erro ao buscar estatísticas de comissão:', response.error);
        toast({
          title: 'Erro',
          description: `Não foi possível buscar as estatísticas de comissão: ${response.error.message || 'Erro desconhecido'}`,
          variant: 'destructive',
        });
        return;
      }
      
      if (response.app_markup_statistics) {
        console.log('[ADMIN] Estatísticas de comissão recebidas:', response.app_markup_statistics);
        setMarkupStats(response.app_markup_statistics);
      } else {
        console.error('[ADMIN] Resposta sem dados de estatísticas de comissão:', response);
        toast({
          title: 'Dados não encontrados',
          description: 'Não foram encontrados dados de comissão para o período selecionado.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('[ADMIN] Erro ao buscar estatísticas de comissão:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao buscar as estatísticas de comissão.',
        variant: 'destructive',
      });
    } finally {
      setLoadingMarkupStats(false);
    }
  };
  
  // Carregar usuários do banco de dados e do localStorage
  const loadUsers = async () => {
    setIsLoading(true);
    
    try {
      // Primeiro tente buscar usuários do banco de dados (API)
      const response = await fetch('/api/user-credentials');
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data)) {
          // Converter para o formato esperado pela interface
          const formattedUsers: User[] = result.data.map((cred: any) => ({
            id: cred.id.toString(),
            email: cred.email,
            name: cred.email.split('@')[0], // Nome padrão baseado no email
            createdAt: cred.created_at,
            isActive: true,
            role: 'user'
          }));
          
          setUsers(formattedUsers);
          
          // Atualizar também o localStorage para compatibilidade
          localStorage.setItem('registered_users', JSON.stringify(formattedUsers));
          
          // Atualizar credenciais simplificadas para login
          const simplifiedCreds = formattedUsers.map(user => ({
            email: user.email,
            password: 'password_hash_in_db' // Não expomos senhas do DB
          }));
          localStorage.setItem('user_credentials', JSON.stringify(simplifiedCreds));
          
          console.log('[ADMIN] Carregados ' + formattedUsers.length + ' usuários do banco de dados');
          
          // Calcular estatísticas com base nos dados do banco
          try {
            // Calcular estatísticas básicas
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            const activeUsers = formattedUsers.filter(user => user.isActive).length;
            const newUsersToday = formattedUsers.filter(user => {
              const createdAt = new Date(user.createdAt).getTime();
              return createdAt >= todayStart;
            }).length;
            
            const loginsToday = formattedUsers.filter(user => {
              if (!user.lastLogin) return false;
              const lastLogin = new Date(user.lastLogin).getTime();
              return lastLogin >= todayStart;
            }).length;
            
            setStats({
              totalUsers: formattedUsers.length,
              activeUsers,
              newUsersToday,
              loginsToday,
            });
            
            console.log('[ADMIN] Estatísticas calculadas do banco de dados:', { 
              totalUsers: formattedUsers.length, 
              activeUsers, 
              newUsersToday, 
              loginsToday 
            });
          } catch (error) {
            console.error('[ADMIN] Erro ao calcular estatísticas do banco de dados:', error);
          }
          
          return;
        }
      }
      
      // Se falhar com a API, tente o fallback para localStorage (compatibilidade)
      console.log('[ADMIN] Fallback: tentando carregar usuários do localStorage');
      const storedUsers = localStorage.getItem('registered_users');
      
      // Quando não há usuários cadastrados, inicializar arrays vazios
      if (!storedUsers) {
        console.log('[ADMIN] Nenhum usuário encontrado. Inicializando arrays vazios.');
        localStorage.setItem('registered_users', JSON.stringify([]));
        localStorage.setItem('user_credentials', JSON.stringify([]));
        setUsers([]);
      } else {
        const parsedUsers = JSON.parse(storedUsers);
        setUsers(parsedUsers);
        console.log('[ADMIN] Carregados ' + parsedUsers.length + ' usuários do localStorage');
        
        // Calcular estatísticas com base nos dados do localStorage
        try {
          // Calcular estatísticas básicas
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          
          const activeUsers = parsedUsers.filter((user: User) => user.isActive).length;
          const newUsersToday = parsedUsers.filter((user: User) => {
            const createdAt = new Date(user.createdAt).getTime();
            return createdAt >= todayStart;
          }).length;
          
          const loginsToday = parsedUsers.filter((user: User) => {
            if (!user.lastLogin) return false;
            const lastLogin = new Date(user.lastLogin).getTime();
            return lastLogin >= todayStart;
          }).length;
          
          setStats({
            totalUsers: parsedUsers.length,
            activeUsers,
            newUsersToday,
            loginsToday,
          });
          
          console.log('[ADMIN] Estatísticas calculadas do localStorage:', { 
            totalUsers: parsedUsers.length, 
            activeUsers, 
            newUsersToday, 
            loginsToday 
          });
        } catch (error) {
          console.error('[ADMIN] Erro ao calcular estatísticas do localStorage:', error);
        }
      }
    } catch (error) {
      console.error('[ADMIN] Erro ao carregar usuários:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar a lista de usuários.',
        variant: 'destructive',
      });
      
      // Tentar falback para localStorage em caso de erro no servidor
      try {
        const storedUsers = localStorage.getItem('registered_users');
        if (storedUsers) {
          const parsedUsers = JSON.parse(storedUsers);
          setUsers(parsedUsers);
          console.log('[ADMIN] Fallback: carregados ' + parsedUsers.length + ' usuários do localStorage');
          
          // Calcular estatísticas com base nos dados do localStorage (fallback)
          try {
            // Calcular estatísticas básicas
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            const activeUsers = parsedUsers.filter((user: User) => user.isActive).length;
            const newUsersToday = parsedUsers.filter((user: User) => {
              const createdAt = new Date(user.createdAt).getTime();
              return createdAt >= todayStart;
            }).length;
            
            const loginsToday = parsedUsers.filter((user: User) => {
              if (!user.lastLogin) return false;
              const lastLogin = new Date(user.lastLogin).getTime();
              return lastLogin >= todayStart;
            }).length;
            
            setStats({
              totalUsers: parsedUsers.length,
              activeUsers,
              newUsersToday,
              loginsToday,
            });
            
            console.log('[ADMIN] Estatísticas calculadas do localStorage (fallback):', { 
              totalUsers: parsedUsers.length, 
              activeUsers, 
              newUsersToday, 
              loginsToday 
            });
          } catch (error) {
            console.error('[ADMIN] Erro ao calcular estatísticas do localStorage (fallback):', error);
          }
        }
      } catch (e) {
        console.error('[ADMIN] Erro também no fallback:', e);
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Calcular estatísticas
  const calculateStats = () => {
    try {
      // Usar os usuários que já estão carregados no estado do componente
      if (users.length === 0) {
        console.log('[ADMIN] Nenhum usuário encontrado para calcular estatísticas.');
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          newUsersToday: 0,
          loginsToday: 0,
        });
        return;
      }
      
      // Calcular estatísticas básicas
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      
      const activeUsers = users.filter(user => user.isActive).length;
      const newUsersToday = users.filter(user => {
        const createdAt = new Date(user.createdAt).getTime();
        return createdAt >= todayStart;
      }).length;
      
      const loginsToday = users.filter(user => {
        if (!user.lastLogin) return false;
        const lastLogin = new Date(user.lastLogin).getTime();
        return lastLogin >= todayStart;
      }).length;
      
      setStats({
        totalUsers: users.length,
        activeUsers,
        newUsersToday,
        loginsToday,
      });
      
      console.log('[ADMIN] Estatísticas calculadas:', { 
        totalUsers: users.length, 
        activeUsers, 
        newUsersToday, 
        loginsToday 
      });
    } catch (error) {
      console.error('[ADMIN] Erro ao calcular estatísticas:', error);
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        newUsersToday: 0,
        loginsToday: 0,
      });
    }
  };
  
  // Adicionar novo usuário
  const handleAddUser = async () => {
    // Validar campos
    if (!newUser.name || !newUser.email || !newUser.password) {
      toast({
        title: 'Dados incompletos',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }
    
    // Verificar se o email já existe
    if (users.some(user => user.email === newUser.email)) {
      toast({
        title: 'Email já cadastrado',
        description: 'Este email já está sendo utilizado por outro usuário.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Primeiro tente adicionar ao banco de dados
      const response = await fetch('/api/user-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data) {
          console.log('[ADMIN] Usuário adicionado com sucesso no banco de dados:', result.data);
          
          // Criar formato de usuário para a UI
          const newUserData: User = {
            id: result.data.id.toString(),
            name: newUser.name || '',
            email: newUser.email || '',
            createdAt: result.data.created_at || new Date().toISOString(),
            isActive: true,
            role: 'user',
          };
          
          // Adicionar à lista de usuários local
          const updatedUsers = [...users, newUserData];
          setUsers(updatedUsers);
          
          // Atualizar também no localStorage para compatibilidade
          localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
          
          // Atualizar credenciais simplificadas para login
          const credentials = localStorage.getItem('user_credentials');
          const parsedCredentials = credentials ? JSON.parse(credentials) : [];
          
          const updatedCredentials = [
            ...parsedCredentials,
            {
              email: newUserData.email,
              password: newUserData.password,
            }
          ];
          
          localStorage.setItem('user_credentials', JSON.stringify(updatedCredentials));
          
          // Recalcular estatísticas
          calculateStats();
          
          // Feedback e fechar diálogo
          toast({
            title: 'Usuário adicionado',
            description: `${newUserData.name} foi cadastrado com sucesso.`,
          });
          
          // Limpar formulário
          setNewUser({
            name: '',
            email: '',
            password: '',
            isActive: true,
            role: 'user',
          });
          
          // Fechar diálogo
          setNewUserDialog(false);
          
          // Recarregar lista de usuários
          await loadUsers();
          return;
        }
      }
      
      // Se falhar com a API, usar fallback para localStorage
      console.log('[ADMIN] Fallback: salvando usuário apenas no localStorage');
      
      // Criar novo usuário
      const newUserData: User = {
        id: Date.now().toString(),
        name: newUser.name || '',
        email: newUser.email || '',
        password: newUser.password,
        createdAt: new Date().toISOString(),
        isActive: newUser.isActive || true,
        role: newUser.role || 'user',
      };
      
      // Adicionar à lista de usuários
      const updatedUsers = [...users, newUserData];
      setUsers(updatedUsers);
      
      // Salvar no localStorage
      localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
      
      // Também atualizar credenciais para login
      const credentials = localStorage.getItem('user_credentials');
      const parsedCredentials = credentials ? JSON.parse(credentials) : [];
      
      const updatedCredentials = [
        ...parsedCredentials,
        {
          email: newUserData.email,
          password: newUserData.password,
        }
      ];
      
      localStorage.setItem('user_credentials', JSON.stringify(updatedCredentials));
      
      // Recalcular estatísticas
      calculateStats();
      
      // Feedback e fechar diálogo
      toast({
        title: 'Usuário adicionado (local)',
        description: `${newUserData.name} foi cadastrado com sucesso (apenas localmente).`,
      });
      
      // Limpar formulário
      setNewUser({
        name: '',
        email: '',
        password: '',
        isActive: true,
        role: 'user',
      });
      
      // Fechar diálogo
      setNewUserDialog(false);
    } catch (error) {
      console.error('[ADMIN] Erro ao adicionar usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Alterar status de ativação do usuário
  const toggleUserStatus = (userId: string) => {
    try {
      // Encontrar e atualizar o usuário
      const updatedUsers = users.map(user => {
        if (user.id === userId) {
          return { ...user, isActive: !user.isActive };
        }
        return user;
      });
      
      setUsers(updatedUsers);
      
      // Atualizar no localStorage
      localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
      
      // Recalcular estatísticas
      calculateStats();
      
      // Feedback
      toast({
        title: 'Status atualizado',
        description: 'O status do usuário foi atualizado com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao atualizar status do usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status do usuário.',
        variant: 'destructive',
      });
    }
  };
  
  // Remover usuário
  const removeUser = async (userId: string) => {
    setIsLoading(true);
    
    try {
      // Encontrar usuário para feedback
      const user = users.find(u => u.id === userId);
      
      if (!user) {
        toast({
          title: 'Erro',
          description: 'Usuário não encontrado.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }
      
      // Primeiro tente remover do banco de dados
      let removedFromDB = false;
      
      try {
        const response = await fetch(`/api/user-credentials/${userId}`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            console.log('[ADMIN] Usuário removido com sucesso do banco de dados:', userId);
            removedFromDB = true;
          }
        }
      } catch (dbError) {
        console.error('[ADMIN] Erro ao remover usuário do banco de dados:', dbError);
        // Continuamos com a remoção local mesmo se falhar no banco
      }
      
      // Filtrar usuários
      const updatedUsers = users.filter(u => u.id !== userId);
      setUsers(updatedUsers);
      
      // Atualizar no localStorage
      localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
      
      // Também atualizar credenciais para login
      const credentials = localStorage.getItem('user_credentials');
      const parsedCredentials = credentials ? JSON.parse(credentials) : [];
      
      const updatedCredentials = parsedCredentials.filter(
        (cred: any) => cred.email !== user?.email
      );
      
      localStorage.setItem('user_credentials', JSON.stringify(updatedCredentials));
      
      // Recalcular estatísticas
      calculateStats();
      
      // Feedback
      toast({
        title: 'Usuário removido',
        description: removedFromDB 
          ? 'O usuário foi removido com sucesso do sistema.'
          : 'O usuário foi removido apenas localmente.',
      });
      
      // Recarregar dados
      await loadUsers();
    } catch (error) {
      console.error('[ADMIN] Erro ao remover usuário:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o usuário.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Voltar para o dashboard
  const goBack = () => {
    window.location.href = '/dashboard';
  };
  
  // Formatar data
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      return 'Data inválida';
    }
  };
  
  return (
    <div className="min-h-screen bg-[#0c1117] text-white">
      {/* Cabeçalho */}
      <div className="bg-[#151b25] p-4 shadow">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold">Painel Administrativo</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline"
              size="sm"
              onClick={() => loadUsers()}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Atualizar
                </>
              )}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={goBack}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          </div>
        </div>
      </div>
      
      {/* Conteúdo principal */}
      <div className="container mx-auto py-6 px-4">
        {/* Estatísticas rápidas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-[#151b25] border-slate-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-400">Total de Usuários</p>
                <p className="text-3xl font-bold text-indigo-500 mt-1">{users.length}</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#151b25] border-slate-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-400">Usuários Ativos</p>
                <p className="text-3xl font-bold text-emerald-500 mt-1">
                  {users.filter(user => user.isActive).length}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#151b25] border-slate-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-400">Novos Hoje</p>
                <p className="text-3xl font-bold text-blue-500 mt-1">
                  {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    return users.filter(user => {
                      const createdAt = new Date(user.createdAt).getTime();
                      return createdAt >= todayStart;
                    }).length;
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-[#151b25] border-slate-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-400">Logins Hoje</p>
                <p className="text-3xl font-bold text-amber-500 mt-1">
                  {(() => {
                    const now = new Date();
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    return users.filter(user => {
                      if (!user.lastLogin) return false;
                      const lastLogin = new Date(user.lastLogin).getTime();
                      return lastLogin >= todayStart;
                    }).length;
                  })()}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Tabs */}
        <Tabs defaultValue="users" className="mb-6" value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="bg-[#151b25] border-slate-800">
            <TabsTrigger value="users" className="data-[state=active]:bg-indigo-600">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="commissions" className="data-[state=active]:bg-indigo-600">
              <BarChart4 className="h-4 w-4 mr-2" />
              Comissões API
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4">
            <Card className="bg-[#151b25] border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Gerenciamento de Usuários</CardTitle>
                  <CardDescription className="text-slate-400">
                    Gerencie todos os usuários da plataforma.
                  </CardDescription>
                </div>
                
                <Dialog open={newUserDialog} onOpenChange={setNewUserDialog}>
                  <DialogTrigger asChild>
                    <Button className="bg-indigo-600 hover:bg-indigo-700">
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar Usuário
                    </Button>
                  </DialogTrigger>
                  
                  <DialogContent className="bg-[#151b25] border-slate-800 text-white">
                    <DialogHeader>
                      <DialogTitle className="text-white">Adicionar Novo Usuário</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        Preencha os dados para cadastrar um novo usuário na plataforma.
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Nome</Label>
                          <Input
                            id="name"
                            placeholder="Nome completo"
                            value={newUser.name}
                            onChange={e => setNewUser({...newUser, name: e.target.value})}
                            className="bg-[#0c1117] border-slate-700 text-white"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="Email"
                            value={newUser.email}
                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                            className="bg-[#0c1117] border-slate-700 text-white"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password">Senha</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Senha"
                            value={newUser.password}
                            onChange={e => setNewUser({...newUser, password: e.target.value})}
                            className="bg-[#0c1117] border-slate-700 text-white"
                          />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="active"
                            checked={newUser.isActive}
                            onCheckedChange={checked => setNewUser({...newUser, isActive: checked})}
                          />
                          <Label htmlFor="active">Usuário ativo</Label>
                        </div>
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setNewUserDialog(false)}
                        className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleAddUser}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-slate-400">
                    <Users className="h-12 w-12 mx-auto opacity-20 mb-2" />
                    <p>Nenhum usuário cadastrado.</p>
                    <Button 
                      className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => setNewUserDialog(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar primeiro usuário
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700">
                          <TableHead className="text-slate-400">Nome</TableHead>
                          <TableHead className="text-slate-400">Email</TableHead>
                          <TableHead className="text-slate-400">Criado em</TableHead>
                          <TableHead className="text-slate-400">Último login</TableHead>
                          <TableHead className="text-slate-400">Status</TableHead>
                          <TableHead className="text-slate-400">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      
                      <TableBody>
                        {users.map(user => (
                          <TableRow key={user.id} className="border-slate-700">
                            <TableCell className="font-medium">{user.name}</TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{formatDate(user.createdAt)}</TableCell>
                            <TableCell>{formatDate(user.lastLogin)}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                <Switch
                                  checked={user.isActive}
                                  onCheckedChange={() => toggleUserStatus(user.id)}
                                  className="mr-2"
                                />
                                <span className={user.isActive ? 'text-emerald-500' : 'text-red-500'}>
                                  {user.isActive ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeUser(user.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-100/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="commissions" className="mt-4">
            <Card className="bg-[#151b25] border-slate-800">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Estatísticas de Comissão da API Deriv</CardTitle>
                  <CardDescription className="text-slate-400">
                    Visualize as comissões geradas pelos aplicativos conectados à API Deriv.
                  </CardDescription>
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="date-from" className="whitespace-nowrap">De:</Label>
                    <Input
                      id="date-from"
                      type="date"
                      value={dateRange.from}
                      onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                      className="bg-[#0c1117] border-slate-700 text-white w-36"
                    />
                    
                    <Label htmlFor="date-to" className="whitespace-nowrap">Até:</Label>
                    <Input
                      id="date-to"
                      type="date"
                      value={dateRange.to}
                      onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                      className="bg-[#0c1117] border-slate-700 text-white w-36"
                    />
                    
                    <Button 
                      onClick={fetchMarkupStatistics}
                      disabled={loadingMarkupStats}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {loadingMarkupStats ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Carregando...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Atualizar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                {loadingMarkupStats ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                ) : false ? ( // A checagem de autorização já é feita no início da função
                  <div className="text-center py-8 text-slate-400">
                    <DollarSign className="h-12 w-12 mx-auto opacity-20 mb-2" />
                    <p>É necessário estar conectado com a Deriv para visualizar as estatísticas de comissão.</p>
                    <p className="mt-2 text-sm">Faça login na Deriv pela página principal e depois retorne ao painel de administração.</p>
                  </div>
                ) : !markupStats ? (
                  <div className="text-center py-8 text-slate-400">
                    <BarChart4 className="h-12 w-12 mx-auto opacity-20 mb-2" />
                    <p>Nenhum dado de comissão encontrado para o período selecionado.</p>
                    <p className="mt-2 text-sm">Tente selecionar um período diferente ou verificar as configurações da sua conta na Deriv.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card className="bg-[#0c1117] border-slate-800">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-slate-400">Total de Comissões (USD)</p>
                            <p className="text-3xl font-bold text-green-500 mt-1">
                              ${markupStats.total_app_markup_usd.toFixed(2)}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-[#0c1117] border-slate-800">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-slate-400">Total de Transações</p>
                            <p className="text-3xl font-bold text-amber-500 mt-1">
                              {markupStats.total_transactions_count}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                      
                      <Card className="bg-[#0c1117] border-slate-800">
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <p className="text-sm text-slate-400">Valor Médio por Transação</p>
                            <p className="text-3xl font-bold text-blue-500 mt-1">
                              ${markupStats.total_transactions_count > 0 
                                ? (markupStats.total_app_markup_usd / markupStats.total_transactions_count).toFixed(2) 
                                : "0.00"}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-slate-700">
                            <TableHead className="text-slate-400">App ID</TableHead>
                            <TableHead className="text-slate-400">Comissão (USD)</TableHead>
                            <TableHead className="text-slate-400">Comissão (Moeda Dev)</TableHead>
                            <TableHead className="text-slate-400">Moeda</TableHead>
                            <TableHead className="text-slate-400">Transações</TableHead>
                            <TableHead className="text-slate-400">Média por Trans. (USD)</TableHead>
                          </TableRow>
                        </TableHeader>
                        
                        <TableBody>
                          {markupStats.breakdown.map((item) => (
                            <TableRow key={item.app_id} className="border-slate-700">
                              <TableCell className="font-medium">{item.app_id}</TableCell>
                              <TableCell className="text-green-500">${item.app_markup_usd.toFixed(2)}</TableCell>
                              <TableCell>{item.app_markup_value.toFixed(2)}</TableCell>
                              <TableCell>{item.dev_currcode}</TableCell>
                              <TableCell>{item.transactions_count}</TableCell>
                              <TableCell>
                                ${item.transactions_count > 0 
                                  ? (item.app_markup_usd / item.transactions_count).toFixed(2) 
                                  : "0.00"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}