import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// Esquema de validação do formulário
const loginSchema = z.object({
  email: z.string().email({ message: "E-mail inválido" }),
  password: z.string().min(6, { message: "A senha deve ter pelo menos 6 caracteres" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // Configuração do formulário com react-hook-form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Função para lidar com a submissão do formulário
  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      // Simulando um atraso para mostrar o estado de carregamento
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Aqui seria feita a autenticação real com backend
      // Por enquanto, apenas redirecionamos para o dashboard
      
      toast({
        title: "Login realizado com sucesso",
        description: "Bem-vindo à plataforma Genius Technology Trading!",
      });
      
      // Redirecionando para o dashboard
      navigate("/dashboard");
    } catch (error) {
      console.error("Erro ao tentar fazer login:", error);
      
      toast({
        variant: "destructive",
        title: "Erro ao fazer login",
        description: "Ocorreu um erro ao tentar fazer login. Por favor, tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-screen bg-[#0c111b] text-white">
      <div className="mx-auto max-w-md w-full px-8 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">GENIUS TECHNOLOGY TRADING</h1>
          <h2 className="text-xl mb-1">Área de membros</h2>
          <p className="text-[#8492b4]">A maior inovação no mercado de operações automatizadas!</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">E-mail / Login</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="seu.email@exemplo.com" 
                      {...field} 
                      className="bg-[#1d2a45] border-[#3a4b6b] text-white" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-gray-300">Senha</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="******" 
                      {...field} 
                      className="bg-[#1d2a45] border-[#3a4b6b] text-white" 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              disabled={isLoading} 
              className="w-full bg-[#5b65d6] hover:bg-[#4550c5] text-white font-medium"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Entrando...
                </>
              ) : (
                "Login"
              )}
            </Button>

            <div className="text-center text-sm">
              <p className="text-[#8492b4]">
                Não possui conta? <a href="#" className="text-[#5b65d6] hover:underline">Cadastre-se agora mesmo</a>.
              </p>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}