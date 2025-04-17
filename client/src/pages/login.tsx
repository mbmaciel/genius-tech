import { useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';

export default function LoginPage() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulação de login bem-sucedido - na implementação real, isso seria uma chamada à API
    setTimeout(() => {
      setIsLoading(false);
      
      // Apenas para demonstração - normalmente verificaria credenciais
      if (email && password) {
        localStorage.setItem('isLoggedIn', 'true');
        setLocation('/dashboard');
        
        toast({
          title: 'Login bem-sucedido',
          description: 'Bem-vindo à plataforma de trading!',
        });
      } else {
        toast({
          title: 'Erro de login',
          description: 'Por favor, preencha todos os campos.',
          variant: 'destructive',
        });
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0c1117]">
      <div className="flex flex-col items-center mb-8">
        <h1 className="text-3xl font-bold text-white mb-1">ONE BOT PREMIUM</h1>
        <div className="text-slate-400 text-center max-w-md">
          <h2 className="text-xl font-medium mb-1">Área de membros</h2>
          <p>A maior inovação no mercado de operações automatizadas!</p>
        </div>
      </div>

      <Card className="w-full max-w-md bg-[#151b25] border-slate-800 text-white">
        <CardContent className="pt-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">E-mail / Login</label>
              <Input 
                type="email" 
                placeholder="Digite o seu e-mail" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[#0c1117] border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-400">Senha</label>
              <Input 
                type="password" 
                placeholder="Digite a sua senha" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[#0c1117] border-slate-700 text-white"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isLoading}
            >
              {isLoading ? 'Entrando...' : 'Login'}
            </Button>
          </form>
          
          <div className="mt-4 text-center text-sm text-slate-400">
            Não possui conta? <a href="/register" className="text-indigo-400 hover:underline">Cadastre-se agora mesmo</a>.
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 text-slate-500 text-center text-sm">
        &copy; {new Date().getFullYear()} Genius Technology Trading. Todos os direitos reservados.
      </div>
    </div>
  );
}