import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import derivAPI from '@/lib/derivApi';

interface SymbolDetailsProps {
  symbol: string;
}

interface SymbolInfo {
  display_name: string;
  market_display_name: string;
  submarket_display_name: string;
  pip: number;
  exchange_is_open: number;
  is_trading_suspended: number;
  spot?: number;
  spot_age?: string;
  spot_time?: string;
  spot_percentage_change?: string;
}

// Informações padrão para R_100 (usado para fallback quando não há dados)
const R100DefaultInfo: SymbolInfo = {
  display_name: "Volatility 100 Index",
  market_display_name: "Synthetic Indices",
  submarket_display_name: "Volatility Indices",
  pip: 0.01,
  exchange_is_open: 1,
  is_trading_suspended: 0
};

export default function SymbolDetails({ symbol = 'R_100' }: SymbolDetailsProps) {
  const [symbolInfo, setSymbolInfo] = useState<SymbolInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSuccessTime, setLastSuccessTime] = useState<number>(0);
  const [retryCount, setRetryCount] = useState<number>(0);

  useEffect(() => {
    // Tentar carregar do cache local
    try {
      const cacheKey = `symbol_details_${symbol}`;
      const cachedData = localStorage.getItem(cacheKey);
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const cacheAge = Date.now() - parsedData.timestamp;
        
        // Se o cache for recente (menos de 30 segundos), usar primeiro
        if (cacheAge < 30000) {
          console.log(`Usando detalhes em cache para ${symbol}`);
          setSymbolInfo(parsedData.details);
          setLoading(false);
          setError(null);
          setLastSuccessTime(parsedData.timestamp);
        }
      }
    } catch (e) {
      console.warn("Erro ao ler cache de detalhes do símbolo:", e);
    }
    
    const fetchSymbolDetails = async () => {
      try {
        // Não mudar para loading se já temos dados, para evitar flash de loading
        if (!symbolInfo) {
          setLoading(true);
        }
        
        // Para R_100, conhecemos os detalhes básicos (mesmo sem conexão)
        if (symbol === 'R_100' && !derivAPI.getConnectionStatus()) {
          console.log("Usando dados padrão para R_100 (sem conexão)");
          setSymbolInfo(R100DefaultInfo);
          setError(null);
          setLoading(false);
          return;
        }
        
        // Verificar se já estamos conectados à API
        if (!derivAPI.getConnectionStatus()) {
          throw new Error("Não conectado à API Deriv");
        }
        
        // Limitar a frequência de requisições em caso de erros repetidos
        const now = Date.now();
        const timeSinceLastSuccess = now - lastSuccessTime;
        
        // Se a última requisição bem-sucedida foi recente e já temos dados, aguardar mais
        if (symbolInfo && timeSinceLastSuccess < 5000 * Math.pow(2, retryCount)) {
          console.log(`Aguardando antes de tentar obter detalhes novamente (backoff: ${5000 * Math.pow(2, retryCount)}ms)`);
          return;
        }
        
        // Buscar detalhes atualizados
        const details = await derivAPI.getSymbolDetails(symbol);
        
        if (details) {
          console.log(`Detalhes atualizados do símbolo ${symbol}:`, details);
          setSymbolInfo(details);
          setError(null);
          setRetryCount(0);
          setLastSuccessTime(now);
          
          // Salvar em cache local
          try {
            const cacheKey = `symbol_details_${symbol}`;
            localStorage.setItem(cacheKey, JSON.stringify({
              details,
              timestamp: now
            }));
          } catch (e) {
            console.warn("Erro ao salvar cache de detalhes do símbolo:", e);
          }
        } else if (symbol === 'R_100') {
          // Se é R_100 e não obtivemos dados, usar dados padrão
          console.log("Usando dados padrão para R_100 (falha na busca)");
          setSymbolInfo(R100DefaultInfo);
          setError(null);
        } else {
          // Para outros símbolos, mostrar erro
          setError(`Não foi possível obter detalhes do símbolo ${symbol}`);
          setRetryCount(prev => prev + 1);
        }
      } catch (err: any) {
        console.error(`Erro ao buscar detalhes do símbolo ${symbol}:`, err);
        
        // Se for R_100, usar informações padrão
        if (symbol === 'R_100') {
          console.log("Usando dados padrão para R_100 (erro na busca)");
          setSymbolInfo(R100DefaultInfo);
          setError(null);
        } else {
          setError(`Erro ao buscar detalhes do símbolo: ${err.message}`);
          setRetryCount(prev => prev + 1);
        }
      } finally {
        setLoading(false);
      }
    };

    // Buscar detalhes imediatamente
    fetchSymbolDetails();
    
    // Configurar atualização periódica com intervalo adaptativo
    // Usar intervalo maior se já tivermos muitas falhas
    const updateInterval = 5000 + (retryCount * 1000);
    console.log(`Configurando atualização de detalhes a cada ${updateInterval}ms`);
    
    const intervalId = setInterval(fetchSymbolDetails, updateInterval);
    
    return () => clearInterval(intervalId);
  }, [symbol, retryCount]);

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Detalhes do Símbolo</CardTitle>
          <CardDescription>Carregando informações...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Detalhes do Símbolo</CardTitle>
          <CardDescription>Ocorreu um erro</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 text-red-500">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!symbolInfo) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Detalhes do Símbolo</CardTitle>
          <CardDescription>Não foram encontradas informações</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4">Nenhuma informação disponível para {symbol}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>{symbolInfo.display_name}</CardTitle>
            <CardDescription>Detalhes do Índice</CardDescription>
          </div>
          <div>
            {symbolInfo.exchange_is_open === 1 ? (
              <Badge className="bg-green-500 hover:bg-green-600">Mercado Aberto</Badge>
            ) : (
              <Badge className="bg-red-500 hover:bg-red-600">Mercado Fechado</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Mercado</h4>
              <p>{symbolInfo.market_display_name}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Submercado</h4>
              <p>{symbolInfo.submarket_display_name}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Símbolo</h4>
              <p>{symbol}</p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-muted-foreground">Pip</h4>
              <p>{symbolInfo.pip}</p>
            </div>
          </div>
          
          {symbolInfo.spot && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold">Preço Atual</h4>
                  <p className="text-2xl font-bold">{symbolInfo.spot}</p>
                </div>
                {symbolInfo.spot_percentage_change && (
                  <div>
                    <Badge className={
                      Number(symbolInfo.spot_percentage_change) >= 0 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-red-500 hover:bg-red-600"
                    }>
                      {Number(symbolInfo.spot_percentage_change) >= 0 ? '+' : ''}
                      {symbolInfo.spot_percentage_change}%
                    </Badge>
                  </div>
                )}
              </div>
              
              {symbolInfo.spot_time && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Atualizado: {new Date(Number(symbolInfo.spot_time) * 1000).toLocaleTimeString()}
                </div>
              )}
            </div>
          )}
          
          {symbolInfo.is_trading_suspended === 1 && (
            <div className="mt-2 p-2 bg-red-900/20 text-red-300 rounded-md">
              Atenção: Negociação suspensa temporariamente para este símbolo.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}