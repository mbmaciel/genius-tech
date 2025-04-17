import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import derivAPI from '@/lib/derivApi';

export default function ServerStatus() {
  const [serverStatus, setServerStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fetchServerStatus = async () => {
    if (!derivAPI.getConnectionStatus()) {
      setError('WebSocket não está conectado');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await derivAPI.getServerStatus();
      
      if (response && response.website_status) {
        setServerStatus(response.website_status);
      } else {
        throw new Error('Formato de resposta inválido');
      }
    } catch (err: any) {
      console.error('Erro ao obter status do servidor:', err);
      setError(err.message || 'Erro ao obter status do servidor');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Verificar status inicial quando o WebSocket estiver conectado
    const checkConnectionAndFetch = () => {
      if (derivAPI.getConnectionStatus()) {
        fetchServerStatus();
      }
    };
    
    // Tentar inicialmente
    checkConnectionAndFetch();
    
    // Adicionar event listener para quando a conexão for estabelecida
    const handleConnected = () => {
      fetchServerStatus();
    };
    
    document.addEventListener('deriv:connected', handleConnected);
    document.addEventListener('deriv:server_status', ((event: CustomEvent) => {
      setServerStatus(event.detail);
    }) as EventListener);
    
    // Intervalo para atualizar o status periodicamente quando conectado
    const interval = setInterval(() => {
      if (derivAPI.getConnectionStatus()) {
        fetchServerStatus();
      }
    }, 60000); // Atualizar a cada minuto
    
    return () => {
      document.removeEventListener('deriv:connected', handleConnected);
      document.removeEventListener('deriv:server_status', ((event: CustomEvent) => {}) as EventListener);
      clearInterval(interval);
    };
  }, []);
  
  const getApiLimits = () => {
    if (!serverStatus || !serverStatus.api_call_limits) return null;
    
    return (
      <div className="mt-4 space-y-2 text-sm">
        <div className="font-medium">Limites de API:</div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(serverStatus.api_call_limits).map(([key, value]: [string, any]) => (
            <div key={key} className="text-xs">
              <div className="font-medium">{value.applies_to}</div>
              {value.hourly && <div>Por hora: {value.hourly}</div>}
              {value.minutely && <div>Por minuto: {value.minutely}</div>}
              {value.max && <div>Máximo: {value.max}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Status do Servidor</CardTitle>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={fetchServerStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <CardDescription>
          Informações sobre o servidor da Deriv
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {error ? (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        ) : !serverStatus ? (
          <div className="text-sm text-muted-foreground">
            {loading ? 'Carregando status...' : 'Nenhum dado disponível'}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">Servidor operacional</span>
              
              {serverStatus.site_status === 1 ? (
                <Badge variant="outline" className="ml-auto bg-green-50">
                  Online
                </Badge>
              ) : (
                <Badge variant="destructive" className="ml-auto">
                  Manutenção
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Versão da API:</span>
                <span className="ml-2 font-medium">{serverStatus.api_version || 'N/A'}</span>
              </div>
              
              {serverStatus.clients_country && (
                <div>
                  <span className="text-muted-foreground">País:</span>
                  <span className="ml-2 font-medium">{serverStatus.clients_country.toUpperCase()}</span>
                </div>
              )}
              
              {serverStatus.message && (
                <div className="col-span-2">
                  <span className="text-muted-foreground">Mensagem:</span>
                  <span className="ml-2 font-medium">{serverStatus.message}</span>
                </div>
              )}
            </div>
            
            {getApiLimits()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}