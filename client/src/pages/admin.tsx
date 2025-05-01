import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, UserPlus, Users, ChevronLeft, LogOut, Shield, Info } from 'lucide-react';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  isActive: boolean;
}

export default function AdminPage() {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [newUserDialogOpen, setNewUserDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    password: ''
  });

  // Verificar se o usuário está logado como admin
  useEffect(() => {
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    
    if (!isAdmin) {
      toast({
        title: 'Acesso não autorizado',
        description: 'Você precisa fazer login como administrador para acessar esta página.',
        variant: 'destructive',
      });
      
      navigate('/login');
      return;
    }
    
    // Carregar lista de usuários
    loadUsers();
  }, [navigate, toast]);
  
  // Função para carregar usuários (mock)
  const loadUsers = () => {
    setIsLoading(true);
    
    // Simulação de carregamento de usuários
    setTimeout(() => {
      // Verificar se já existem usuários no localStorage
      const storedUsers = localStorage.getItem('registered_users');
      const parsedUsers: User[] = storedUsers ? JSON.parse(storedUsers) : [];
      
      setUsers(parsedUsers);
      setIsLoading(false);
    }, 1000);
  };
  
  // Função para adicionar um novo usuário
  const handleAddUser = () => {
    // Validar campos
    if (!newUser.email || !newUser.name || !newUser.password) {
      toast({
        title: 'Campos incompletos',
        description: 'Preencha todos os campos para adicionar um novo usuário.',
        variant: 'destructive',
      });
      return;
    }
    
    // Verificar se o email já existe
    if (users.some(user => user.email === newUser.email)) {
      toast({
        title: 'Email já cadastrado',
        description: 'Este email já está em uso por outro usuário.',
        variant: 'destructive',
      });
      return;
    }
    
    // Criar novo usuário
    const newUserObj: User = {
      id: Date.now().toString(),
      email: newUser.email,
      name: newUser.name,
      createdAt: new Date().toISOString(),
      isActive: true
    };
    
    // Adicionar à lista de usuários
    const updatedUsers = [...users, newUserObj];
    setUsers(updatedUsers);
    
    // Salvar lista de usuários atualizada
    localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
    
    // Salvar credenciais (em um sistema real, seria com hash de senha)
    const userCredentials = {
      email: newUser.email,
      password: newUser.password
    };
    
    // Armazenar credenciais (em produção, isso estaria no banco de dados com senhas hash)
    const storedCredentials = localStorage.getItem('user_credentials');
    const parsedCredentials = storedCredentials ? JSON.parse(storedCredentials) : [];
    const updatedCredentials = [...parsedCredentials, userCredentials];
    localStorage.setItem('user_credentials', JSON.stringify(updatedCredentials));
    
    // Limpar formulário e fechar diálogo
    setNewUser({
      email: '',
      name: '',
      password: ''
    });
    
    setNewUserDialogOpen(false);
    
    toast({
      title: 'Usuário adicionado',
      description: `${newUser.name} foi adicionado com sucesso.`,
    });
  };
  
  // Função para remover um usuário
  const handleRemoveUser = (userId: string) => {
    // Filtrar usuário da lista
    const updatedUsers = users.filter(user => user.id !== userId);
    setUsers(updatedUsers);
    
    // Salvar lista atualizada
    localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
    
    toast({
      title: 'Usuário removido',
      description: 'O usuário foi removido com sucesso.',
    });
  };
  
  // Função para alternar o status ativo/inativo de um usuário
  const toggleUserStatus = (userId: string) => {
    const updatedUsers = users.map(user => {
      if (user.id === userId) {
        return { ...user, isActive: !user.isActive };
      }
      return user;
    });
    
    setUsers(updatedUsers);
    
    // Salvar lista atualizada
    localStorage.setItem('registered_users', JSON.stringify(updatedUsers));
    
    const user = updatedUsers.find(u => u.id === userId);
    toast({
      title: user?.isActive ? 'Usuário ativado' : 'Usuário desativado',
      description: `O usuário foi ${user?.isActive ? 'ativado' : 'desativado'} com sucesso.`,
    });
  };
  
  // Função para fazer logout do admin
  const handleLogout = () => {
    localStorage.removeItem('isAdmin');
    navigate('/login');
    
    toast({
      title: 'Logout realizado',
      description: 'Você saiu do painel administrativo.',
    });
  };
  
  // Função de formatação de data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-[#0c1117] flex flex-col">
      {/* Header com título e botões de ação */}
      <header className="bg-[#151b25] border-b border-slate-800 p-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <Shield className="h-8 w-8 text-indigo-500" />
            <h1 className="text-xl font-bold text-white">Painel Administrativo</h1>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="border-slate-700 text-slate-400"
              onClick={() => navigate('/login')}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            <Button
              variant="destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>
      
      {/* Conteúdo principal */}
      <main className="flex-1 container max-w-7xl mx-auto py-6 px-4">
        <Tabs defaultValue="users">
          <TabsList className="bg-[#151b25] border-slate-800">
            <TabsTrigger value="users" className="data-[state=active]:bg-indigo-600">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="stats" className="data-[state=active]:bg-indigo-600">
              <Info className="h-4 w-4 mr-2" />
              Estatísticas
            </TabsTrigger>
          </TabsList>
          
          {/* Tab de gerenciamento de usuários */}
          <TabsContent value="users" className="mt-6">
            <Card className="bg-[#151b25] border-slate-800 text-white">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="text-xl text-white">Gerenciamento de Usuários</CardTitle>
                    <CardDescription className="text-slate-400">
                      Gerencie os usuários que podem acessar a plataforma.
                    </CardDescription>
                  </div>
                  
                  <Dialog open={newUserDialogOpen} onOpenChange={setNewUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <UserPlus className="h-4 w-4 mr-2" />
                        Novo Usuário
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#151b25] border-slate-800 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-white">Adicionar Novo Usuário</DialogTitle>
                        <DialogDescription className="text-slate-400">
                          Preencha os dados para adicionar um novo usuário à plataforma.
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <label className="text-sm text-slate-400">Nome Completo</label>
                          <Input 
                            placeholder="Nome do usuário" 
                            value={newUser.name}
                            onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                            className="bg-[#0c1117] border-slate-700 text-white"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm text-slate-400">Email</label>
                          <Input 
                            type="email" 
                            placeholder="email@exemplo.com" 
                            value={newUser.email}
                            onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                            className="bg-[#0c1117] border-slate-700 text-white"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm text-slate-400">Senha</label>
                          <Input 
                            type="password" 
                            placeholder="Senha" 
                            value={newUser.password}
                            onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                            className="bg-[#0c1117] border-slate-700 text-white"
                          />
                        </div>
                      </div>
                      
                      <DialogFooter>
                        <Button 
                          onClick={handleAddUser}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Adicionar Usuário
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                  </div>
                ) : (
                  <Table>
                    <TableCaption>Lista total de {users.length} usuários cadastrados.</TableCaption>
                    <TableHeader>
                      <TableRow className="border-slate-700">
                        <TableHead className="text-slate-400">Nome</TableHead>
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-slate-400">Data de Cadastro</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                            Nenhum usuário cadastrado. Adicione um usuário clicando no botão acima.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map(user => (
                          <TableRow key={user.id} className="border-slate-700">
                            <TableCell className="font-medium text-white">{user.name}</TableCell>
                            <TableCell className="text-slate-300">{user.email}</TableCell>
                            <TableCell className="text-slate-400">{formatDate(user.createdAt)}</TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                user.isActive 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {user.isActive ? 'Ativo' : 'Inativo'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="border-slate-700 hover:bg-slate-800"
                                onClick={() => toggleUserStatus(user.id)}
                              >
                                {user.isActive ? 'Desativar' : 'Ativar'}
                              </Button>
                              
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleRemoveUser(user.id)}
                              >
                                Remover
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
              
              <CardFooter className="border-t border-slate-800 pt-4">
                <p className="text-sm text-slate-400">
                  Apenas usuários ativos podem fazer login na plataforma.
                </p>
              </CardFooter>
            </Card>
          </TabsContent>
          
          {/* Tab de estatísticas */}
          <TabsContent value="stats" className="mt-6">
            <Card className="bg-[#151b25] border-slate-800 text-white">
              <CardHeader>
                <CardTitle className="text-xl text-white">Estatísticas de Usuários</CardTitle>
                <CardDescription className="text-slate-400">
                  Informações sobre os usuários cadastrados na plataforma.
                </CardDescription>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#1d2a45] p-4 rounded-lg">
                    <div className="text-lg text-slate-400 mb-2">Total de Usuários</div>
                    <div className="text-3xl font-bold text-white">{users.length}</div>
                  </div>
                  
                  <div className="bg-[#1d2a45] p-4 rounded-lg">
                    <div className="text-lg text-slate-400 mb-2">Usuários Ativos</div>
                    <div className="text-3xl font-bold text-green-400">
                      {users.filter(user => user.isActive).length}
                    </div>
                  </div>
                  
                  <div className="bg-[#1d2a45] p-4 rounded-lg">
                    <div className="text-lg text-slate-400 mb-2">Usuários Inativos</div>
                    <div className="text-3xl font-bold text-red-400">
                      {users.filter(user => !user.isActive).length}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}