import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useOAuthDirectService } from '@/services/oauthDirectService';
import { BotController } from '@/components/BotController';
import { OperationHistoryCard } from '@/components/trading/OperationHistoryCard';
import { ConfigSidebar } from '@/components/trading/ConfigSidebar';
import SymbolSelector from '@/components/trading/SymbolSelector';
import StrategySelector from '@/components/trading/StrategySelector';

export default function OldBotPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [operationHistory, setOperationHistory] = useState<any[]>([]);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [balance, setBalance] = useState({ balance: 0, currency: 'USD' });
  const [error, setError] = useState<string | null>(null);
  
  // Usar o serviço OAuth da Deriv
  const {
    connect,
    disconnect,
    isAuthorized,
    authorizeAccount,
    runStrategy,
    stopStrategy,
    getBalance,
    getActiveSymbols,
    symbols,
    authorized,
    activeAccount,
    apiInstance,
  } = useOAuthDirectService();

  // Conectar automaticamente ao carregar a página
  useEffect(() => {
    if (!isConnected && !isConnecting && user) {
      handleConnect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Atualizar estado quando conectado
  useEffect(() => {
    if (isAuthorized && authorized) {
      setIsConnected(true);
      setIsConnecting(false);
      setAccountInfo(authorized);
      loadBalance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, authorized]);

  // Carregar saldo após conectar
  const loadBalance = async () => {
    try {
      const balanceData = await getBalance();
      if (balanceData) {
        setBalance({
          balance: balanceData.balance,
          currency: balanceData.currency,
        });
      }
    } catch (err) {
      console.error("Erro ao carregar saldo:", err);
    }
  };

  // Manipuladores de eventos
  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      await connect();
    } catch (err: any) {
      setError(err.message || "Erro ao conectar");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setIsConnected(false);
      setAccountInfo(null);
      setBalance({ balance: 0, currency: 'USD' });
    } catch (err: any) {
      toast({
        title: t('Erro ao desconectar'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleStrategyChange = (strategy: string) => {
    setSelectedStrategy(strategy);
  };

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const handleStartStrategy = async () => {
    if (!selectedStrategy) {
      toast({
        title: t('Selecione uma estratégia'),
        description: t('Você precisa selecionar uma estratégia para iniciar as operações'),
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsRunning(true);
      await runStrategy({
        symbol: selectedSymbol,
        strategy: selectedStrategy,
        // Opcionalmente, adicione outros parâmetros como:
        // initialStake: 1,
        // maxOperations: 0,
        // targetProfit: 10,
        // stopLoss: 5,
      });
      
      toast({
        title: t('Estratégia iniciada'),
        description: t('A estratégia {{strategy}} foi iniciada com sucesso', { strategy: selectedStrategy }),
        variant: 'default',
      });
    } catch (err: any) {
      toast({
        title: t('Erro ao iniciar estratégia'),
        description: err.message,
        variant: 'destructive',
      });
      setIsRunning(false);
    }
  };

  const handleStopStrategy = async () => {
    try {
      await stopStrategy();
      setIsRunning(false);
      toast({
        title: t('Estratégia interrompida'),
        description: t('A estratégia foi interrompida com sucesso'),
        variant: 'default',
      });
    } catch (err: any) {
      toast({
        title: t('Erro ao interromper estratégia'),
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const handleOperationUpdate = (operations: any[]) => {
    setOperationHistory(operations);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container p-4 mx-auto flex-grow">
        <h1 className="text-2xl font-bold mb-4">{t('Robô de Operações (Legacy)')}</h1>
        
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('Erro')}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9">
            <Card className="mb-4">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle>{t('Controle de Operações')}</CardTitle>
                  {isConnected ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-500">
                      {t('Conectado')}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/10 text-red-500">
                      {t('Desconectado')}
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {accountInfo ? (
                    <span>
                      {t('Conta')}: {accountInfo.loginid} - 
                      {t('Saldo')}: {balance.balance} {balance.currency}
                    </span>
                  ) : (
                    t('Conecte-se para começar a operar')
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  {!isConnected ? (
                    <Button 
                      onClick={handleConnect} 
                      disabled={isConnecting}
                      className="w-full md:w-auto"
                    >
                      {isConnecting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t('Conectando...')}
                        </>
                      ) : (
                        t('Conectar com Deriv')
                      )}
                    </Button>
                  ) : (
                    <div className="flex flex-col md:flex-row gap-4 w-full">
                      <div className="w-full md:w-1/3">
                        <SymbolSelector
                          selectedSymbol={selectedSymbol}
                          onChange={handleSymbolChange}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="w-full md:w-1/3">
                        <StrategySelector
                          selectedStrategy={selectedStrategy}
                          onChange={handleStrategyChange}
                          disabled={isRunning}
                        />
                      </div>
                      <div className="flex gap-2 w-full md:w-1/3">
                        {!isRunning ? (
                          <Button 
                            onClick={handleStartStrategy} 
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={!selectedStrategy}
                          >
                            {t('Iniciar')}
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleStopStrategy} 
                            className="w-full bg-red-600 hover:bg-red-700"
                          >
                            {t('Parar')}
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          onClick={handleDisconnect}
                          className="whitespace-nowrap"
                        >
                          {t('Desconectar')}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="bot" className="w-full">
              <TabsList className="w-full">
                <TabsTrigger value="bot" className="flex-1">{t('Controle do Robô')}</TabsTrigger>
                <TabsTrigger value="history" className="flex-1">{t('Histórico de Operações')}</TabsTrigger>
                <TabsTrigger value="config" className="flex-1">{t('Configurações')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="bot">
                <Card>
                  <CardContent className="pt-6">
                    <BotController
                      isConnected={isConnected}
                      isRunning={isRunning}
                      selectedSymbol={selectedSymbol}
                      selectedStrategy={selectedStrategy}
                      onStart={handleStartStrategy}
                      onStop={handleStopStrategy}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="history">
                <OperationHistoryCard 
                  operations={operationHistory}
                  onUpdate={handleOperationUpdate}
                />
              </TabsContent>
              
              <TabsContent value="config">
                <Card>
                  <CardContent className="pt-6">
                    <ConfigSidebar 
                      isConnected={isConnected}
                      isRunning={isRunning}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle>{t('Informações')}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <strong>{t('Status')}:</strong> {isConnected ? t('Conectado') : t('Desconectado')}
                  </div>
                  <div>
                    <strong>{t('Estratégia')}:</strong> {selectedStrategy || t('Nenhuma selecionada')}
                  </div>
                  <div>
                    <strong>{t('Ativo')}:</strong> {selectedSymbol}
                  </div>
                  {isConnected && (
                    <>
                      <div>
                        <strong>{t('Conta')}:</strong> {accountInfo?.loginid}
                      </div>
                      <div>
                        <strong>{t('Saldo')}:</strong> {balance.balance} {balance.currency}
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => window.open('https://app.deriv.com', '_blank')}
                >
                  {t('Abrir Deriv')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}