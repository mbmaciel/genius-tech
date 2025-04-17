import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from '@/hooks/use-toast';
import derivAPI from '@/lib/derivApi';
import { AlertCircle, Key, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function DirectTokenApplier() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApplyToken = async () => {
    if (!token.trim()) {
      setError('Por favor, insira um token válido.');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Disconnect current connection if any
      derivAPI.disconnect(true);
      
      // Store the token
      localStorage.setItem('deriv_api_token', token);
      
      // Connect with the token
      const authorized = await derivAPI.authorize(token);
      
      if (!authorized) {
        throw new Error('Não foi possível autorizar com o token fornecido.');
      }
      
      toast({
        title: "Token Aplicado",
        description: "O token foi aplicado com sucesso. Você está conectado.",
      });
      
      // Reset form
      setToken('');
      
      // Force page refresh to update all components
      window.location.reload();
    } catch (error) {
      console.error('Failed to apply token:', error);
      setError('O token fornecido é inválido ou expirou.');
      
      // Clean up if failed
      localStorage.removeItem('deriv_api_token');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-[#162746] border-[#1c3654]">
      <CardHeader>
        <CardTitle className="text-white text-lg">Aplicar Token Diretamente</CardTitle>
        <CardDescription>
          Use esta opção para aplicar um token diretamente à sessão atual
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <div className="space-y-2">
          <Input
            type="password"
            placeholder="Token da API Deriv"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="bg-[#1f3158] border-[#1c3654] text-white"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleApplyToken} 
          disabled={isLoading || !token.trim()} 
          className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Aplicando...
            </>
          ) : (
            <>
              <Key className="mr-2 h-4 w-4" />
              Aplicar Token
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
