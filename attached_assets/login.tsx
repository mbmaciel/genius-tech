import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  username: z.string().min(3, "Usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      // Autenticar usuário
      if (data.username === "admin" && data.password === "password") {
        toast({
          title: "Login bem-sucedido",
          description: "Bem-vindo ao Genius Tech Dashboard",
        });
        
        sessionStorage.setItem("isLoggedIn", "true");
        navigate("/dashboard");
      } else {
        toast({
          title: "Login falhou",
          description: "Nome de usuário ou senha inválidos",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Erro durante login:", error);
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro durante o login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1a33] py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md bg-[#162746] border-[#3a7bd5] border">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <svg className="w-12 h-12 text-[#3a7bd5]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-white">Genius Tech</CardTitle>
          <CardDescription className="text-center text-[#8492b4]">
            Trading Bot Dashboard
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Nome de usuário</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Digite seu nome de usuário" 
                        {...field} 
                        className="bg-[#1f3158] border-gray-700 text-white"
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
                    <FormLabel className="text-white">Senha</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Digite sua senha" 
                        {...field} 
                        className="bg-[#1f3158] border-gray-700 text-white"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-[#3a7bd5] hover:bg-[#4a8be5] text-white" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Entrando...
                  </div>
                ) : (
                  "Entrar"
                )}
              </Button>
              
              <div className="text-center mt-4">
                <p className="text-sm text-[#8492b4]">
                  Credenciais de demonstração: admin / password
                </p>
              </div>
            </form>
          </Form>
          
          <div className="pt-4 border-t border-gray-700 mt-6">
            <div className="text-center">
              <p className="text-sm text-[#8492b4] mb-4">
                Não tem uma conta? Registre-se agora
              </p>
              <Button 
                onClick={() => navigate("/register")} 
                variant="outline" 
                className="w-full border-[#3a7bd5] text-[#3a7bd5] hover:bg-[#1f3158]"
              >
                Criar Nova Conta
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
