import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import BotController from '@/components/trading/BotController';
import ConfigSidebar from '@/components/trading/ConfigSidebar';
import SymbolSelector from '@/components/trading/SymbolSelector';
import StrategySelector from '@/components/trading/StrategySelector';
import OperationHistoryCard from '@/components/trading/OperationHistoryCard';
import DigitAnalysis from '@/components/trading/DigitAnalysis';
import { RocketIcon, AlertCircle, RefreshCw, Bot, History, ChartBar } from 'lucide-react';

const BotPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  
  // Estados do bot
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [selectedStrategy, setSelectedStrategy] = useState('advance');
  
  // Estados de configuração
  const [generalConfig, setGeneralConfig] = useState({
    initialStake: 1,
    targetProfit: 10,
    stopLoss: 10,
    martingaleFactor: 1.5
  });
  
  // Configurações específicas da estratégia Advance
  const [advanceConfig, setAdvanceConfig] = useState({
    entryThreshold: 30,
    analysisVolume: 25,
    prediction: 1
  });
  
  // Estados para histórico de operações e estatísticas
  const [operations, setOperations] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalOperations: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    totalProfit: 0,
    bestStreak: 0,
    worstStreak: 0,
    consecutiveWins: 0,
    consecutiveLosses: 0
  });
  
  // Handler para iniciar o bot
  const handleStartBot = () => {
    if (!isAuthenticated) {
      toast({
        title: t('É necessário fazer login'),
        description: t('Faça login com sua conta Deriv para iniciar o bot'),
        variant: 'destructive'
      });
      return;
    }
    
    setIsRunning(true);
    
    toast({
      title: t('Bot iniciado'),
      description: t('Monitorando mercado e executando estratégia'),
      variant: 'default'
    });
  };
  
  // Handler para parar o bot
  const handleStopBot = () => {
    setIsRunning(false);
    
    toast({
      title: t('Bot parado'),
      description: t('Operações interrompidas'),
      variant: 'default'
    });
  };
  
  // Handler para mudanças nas configurações gerais
  const handleGeneralConfigChange = (config: any) => {
    setGeneralConfig(config);
  };
  
  // Handler para mudanças nas configurações da estratégia Advance
  const handleAdvanceConfigChange = (config: any) => {
    setAdvanceConfig(config);
  };
  
  // Handler para mudanças de configuração
  const handleConfigChange = (config: any) => {
    if (config.type === 'general') {
      const { type, ...rest } = config;
      handleGeneralConfigChange(rest);
    } else if (config.type === 'advance') {
      const { type, ...rest } = config;
      handleAdvanceConfigChange(rest);
    }
  };
  
  // Handler para atualizações de operações
  const handleOperationsUpdate = (updatedOperations: any[]) => {
    setOperations(updatedOperations);
  };
  
  // Handler para atualizações de estatísticas
  const handleStatsUpdate = (updatedStats: any) => {
    setStats(updatedStats);
  };
  
  // Renderizar alerta de login, se não estiver autenticado
  const renderAuthAlert = () => {
    if (!isAuthenticated && !isLoading) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('É necessário fazer login')}</AlertTitle>
          <AlertDescription>
            {t('Você precisa fazer login com sua conta Deriv para utilizar o bot.')}
          </AlertDescription>
          <Button variant="outline" className="mt-2" asChild>
            <a href="/auth">{t('Ir para a página de login')}</a>
          </Button>
        </Alert>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{t('Bot de Trading')}</h1>
        
        <div className="flex items-center space-x-2">
          {isAuthenticated && (
            <div className="text-sm text-muted-foreground mr-4">
              {t('Conectado como')} <span className="font-medium">{user?.loginid}</span>
            </div>
          )}
          
          <Button variant="outline" size="sm" asChild>
            <a href="/dashboard">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('Voltar ao Dashboard')}
            </a>
          </Button>
        </div>
      </div>
      
      {renderAuthAlert()}
      
      <div className="grid grid-cols-12 gap-6">
        {/* Coluna de Configuração - 3/12 */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <Bot className="h-5 w-5 mr-2" />
                {t('Configurações')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <SymbolSelector
                  value={selectedSymbol}
                  onChange={setSelectedSymbol}
                  disabled={isRunning}
                />
                
                <StrategySelector
                  value={selectedStrategy}
                  onChange={setSelectedStrategy}
                  disabled={isRunning}
                />
              </div>
              
              <Separator />
              
              <ConfigSidebar
                onApplyConfig={handleConfigChange}
                selectedStrategy={selectedStrategy}
                isRunning={isRunning}
              />
            </CardContent>
          </Card>
        </div>
        
        {/* Coluna Central - 5/12 */}
        <div className="col-span-12 lg:col-span-5 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 lg:col-span-1">
              <BotController
                symbol={selectedSymbol}
                strategy={selectedStrategy}
                initialStake={generalConfig.initialStake}
                targetProfit={generalConfig.targetProfit}
                stopLoss={generalConfig.stopLoss}
                martingaleFactor={generalConfig.martingaleFactor}
                advanceSettings={selectedStrategy === 'advance' ? advanceConfig : undefined}
                onStart={handleStartBot}
                onStop={handleStopBot}
                onOperationUpdate={handleOperationsUpdate}
                onStatsUpdate={handleStatsUpdate}
                disabled={!isAuthenticated}
              />
            </div>
            
            <div className="col-span-2 lg:col-span-1">
              <DigitAnalysis 
                symbol={selectedSymbol}
                tickCount={advanceConfig.analysisVolume}
                isActive={isAuthenticated}
              />
            </div>
          </div>
          
          <Tabs defaultValue="history">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="history">
                <History className="h-4 w-4 mr-2" />
                {t('Histórico de Operações')}
              </TabsTrigger>
              <TabsTrigger value="stats">
                <ChartBar className="h-4 w-4 mr-2" />
                {t('Estatísticas')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="history" className="space-y-4 mt-4">
              <OperationHistoryCard 
                operations={operations}
                stats={stats}
              />
            </TabsContent>
            <TabsContent value="stats" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t('Estatísticas Detalhadas')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('Total de Operações')}</span>
                        <span className="font-medium">{stats.totalOperations}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('Vitórias')}</span>
                        <span className="font-medium text-green-500">{stats.wins}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('Derrotas')}</span>
                        <span className="font-medium text-red-500">{stats.losses}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('Taxa de Acerto')}</span>
                        <span className="font-medium">{(stats.winRate * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{t('Lucro Total')}</span>
                        <span className={`font-medium ${stats.totalProfit > 0 ? 'text-green-500' : stats.totalProfit < 0 ? 'text-red-500' : ''}`}>
                          {stats.totalProfit > 0 ? '+' : ''}{stats.totalProfit.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
        
        {/* Coluna de Detalhes - 4/12 */}
        <div className="col-span-12 lg:col-span-4">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center text-xl">
                <RocketIcon className="h-5 w-5 mr-2" />
                {t('Estratégia em Execução')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isRunning ? (
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">{t('Parâmetros Ativos')}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Símbolo')}</span>
                        <span className="font-medium">{selectedSymbol}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Estratégia')}</span>
                        <span className="font-medium">{selectedStrategy}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Valor de Entrada')}</span>
                        <span className="font-medium">{generalConfig.initialStake}</span>
                      </div>
                      {selectedStrategy === 'advance' && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('Predição')}</span>
                            <span className="font-medium">{advanceConfig.prediction}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('Limite 0-1')}</span>
                            <span className="font-medium">{advanceConfig.entryThreshold}%</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-2">{t('Controle de Risco')}</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Martingale')}</span>
                        <span className="font-medium">{generalConfig.martingaleFactor}x</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Meta de Lucro')}</span>
                        <span className="font-medium">{generalConfig.targetProfit}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('Stop Loss')}</span>
                        <span className="font-medium">{generalConfig.stopLoss}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Alert>
                    <AlertTitle>{t('Execução em Andamento')}</AlertTitle>
                    <AlertDescription>
                      {t('O robô está funcionando com os parâmetros acima. Você pode parar a qualquer momento.')}
                    </AlertDescription>
                  </Alert>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[40vh] text-center">
                  <Bot className="h-16 w-16 mb-4 text-muted-foreground" />
                  <h3 className="text-xl font-medium mb-2">{t('Bot Inativo')}</h3>
                  <p className="text-muted-foreground mb-6">
                    {t('Configure e inicie o bot para começar a operar automaticamente.')}
                  </p>
                  <Button 
                    size="lg" 
                    onClick={handleStartBot}
                    disabled={!isAuthenticated || isRunning}
                  >
                    {t('Iniciar Bot')}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BotPage;