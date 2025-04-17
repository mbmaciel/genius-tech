import { useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import derivAPI from "@/lib/derivApi";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    
    try {
      // Simulate login
      // In a real application, you would make a request to your backend
      console.log("Login form data:", data);
      
      // Simulate a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demonstration, let's connect directly to Deriv API using OAuth
      connectDerivOAuth();
    } catch (error) {
      console.error("Erro durante o login:", error);
      toast({
        title: "Erro no login",
        description: "Ocorreu um erro ao fazer login. Verifique suas credenciais e tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const connectDerivOAuth = () => {
    try {
      const appId = process.env.VITE_DERIV_APP_ID || '36544'; // Default app ID if not provided
      
      // Get the current domain for redirect
      const redirect_uri = `${window.location.origin}/`;
      
      // Create the OAuth URL
      const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${appId}&l=PT&redirect_uri=${encodeURIComponent(redirect_uri)}`;
      
      // Redirect to Deriv's OAuth page
      window.location.href = oauthUrl;
    } catch (error) {
      console.error("Error initiating OAuth:", error);
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível iniciar o processo de autenticação com a Deriv.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const directConnect = async () => {
    setIsLoading(true);
    try {
      // Try to connect with existing token
      const connected = await derivAPI.connect();
      
      if (connected) {
        toast({
          title: "Conectado com sucesso",
          description: "Você foi conectado com o token existente.",
        });
        navigate("/dashboard");
      } else {
        // If no token or connection fails, redirect to Deriv OAuth
        connectDerivOAuth();
      }
    } catch (error) {
      console.error("Error connecting:", error);
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar automaticamente. Tente fazer login pelo Deriv.",
        variant: "destructive",
      });
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
          <CardTitle className="text-2xl font-bold text-center text-white">Login</CardTitle>
          <CardDescription className="text-center text-[#8492b4]">
            Faça login para acessar o Genius Tech Dashboard
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4 pt-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white">Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="Digite seu email" 
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
              
              <div className="flex items-center justify-between">
                <FormField
                  control={form.control}
                  name="rememberMe"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          className="data-[state=checked]:bg-[#3a7bd5] data-[state=checked]:text-white"
                        />
                      </FormControl>
                      <FormLabel className="text-white text-sm cursor-pointer">
                        Lembrar-me
                      </FormLabel>
                    </FormItem>
                  )}
                />
                
                <Button 
                  variant="link" 
                  className="text-[#3a7bd5] p-0"
                  onClick={() => toast({
                    title: "Funcionalidade em desenvolvimento",
                    description: "A recuperação de senha será implementada em breve.",
                  })}
                >
                  Esqueceu a senha?
                </Button>
              </div>
              
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
            </form>
          </Form>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-gray-700"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#162746] px-2 text-[#8492b4]">ou</span>
            </div>
          </div>
          
          <Button 
            onClick={directConnect}
            disabled={isLoading}
            className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
          >
            Conectar com Deriv
          </Button>
          
          <div className="pt-4 border-t border-gray-700 mt-4">
            <div className="text-center text-[#8492b4]">
              Não tem uma conta?{" "}
              <Button 
                onClick={() => navigate("/register")} 
                variant="link" 
                className="text-[#3a7bd5] p-0"
              >
                Registre-se
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
