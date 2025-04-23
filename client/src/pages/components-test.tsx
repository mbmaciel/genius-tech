import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import SymbolSelector from '@/components/trading/SymbolSelector';
import StrategySelector from '@/components/trading/StrategySelector';
import ConfigSidebar from '@/components/trading/ConfigSidebar';
import OperationHistoryCard from '@/components/trading/OperationHistoryCard';
import DigitAnalysis from '@/components/trading/DigitAnalysis';

export default function ComponentsTestPage() {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState('R_100');
  const [selectedStrategy, setSelectedStrategy] = useState('advance');
  const [isRunning, setIsRunning] = useState(false);
  
  // Mock de operações para teste
  const [operations, setOperations] = useState<any[]>([
    {
      id: 1,
      contract_id: '123456789',
      entry_value: 1.0,
      exit_value: 1.95,
      profit: 0.95,
      is_win: true,
      time: new Date(),
      timestamp: Date.now(),
      contract_type: 'DIGITOVER',
      symbol: 'R_100',
      strategy: 'advance',
      notification: {
        type: 'success',
        message: 'Operação concluída com sucesso'
      }
    },
    {
      id: 2,
      contract_id: '987654321',
      entry_value: 1.0,
      exit_value: 0,
      profit: -1.0,
      is_win: false,
      time: new Date(),
      timestamp: Date.now() - 60000,
      contract_type: 'DIGITOVER',
      symbol: 'R_100',
      strategy: 'advance',
      notification: {
        type: 'error',
        message: 'Operação concluída com perda'
      }
    },
    {
      id: 3,
      contract_id: '456789123',
      entry_value: 1.0,
      time: new Date(),
      timestamp: Date.now() - 30000,
      contract_type: 'DIGITOVER',
      symbol: 'R_100',
      strategy: 'advance',
      notification: {
        type: 'info',
        message: 'Operação em andamento'
      }
    }
  ]);
  
  // Handlers para testes
  const handleBasicConfigSave = (values: any) => {
    console.log('Configurações básicas salvas:', values);
  };
  
  const handleAdvanceConfigSave = (values: any) => {
    console.log('Configurações avançadas salvas:', values);
  };
  
  const handleClearHistory = () => {
    setOperations([]);
  };
  
  const handleAddMockOperation = () => {
    const isWin = Math.random() > 0.5;
    const newOperation = {
      id: Date.now(),
      contract_id: `mock_${Date.now()}`,
      entry_value: 1.0,
      exit_value: isWin ? 1.95 : 0,
      profit: isWin ? 0.95 : -1.0,
      is_win: isWin,
      time: new Date(),
      timestamp: Date.now(),
      contract_type: 'DIGITOVER',
      symbol: selectedSymbol,
      strategy: selectedStrategy,
      notification: {
        type: isWin ? 'success' : 'error',
        message: isWin ? 'Operação concluída com sucesso' : 'Operação concluída com perda'
      }
    };
    
    setOperations(prev => [newOperation, ...prev]);
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-8">{t('Teste de Componentes')}</h1>
      
      <div className="grid grid-cols-1 gap-6">
        <Tabs defaultValue="strategy">
          <TabsList className="mb-4">
            <TabsTrigger value="strategy">{t('Seletores e Configurações')}</TabsTrigger>
            <TabsTrigger value="analysis">{t('TesteAnalise')}</TabsTrigger>
            <TabsTrigger value="history">{t('Histórico de Operações')}</TabsTrigger>
          </TabsList>
          
          {/* Aba de seletores e configurações */}
          <TabsContent value="strategy">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('Seletores')}</CardTitle>
                  <CardDescription>{t('Selecione símbolo e estratégia')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">{t('SymbolSelector')}</h3>
                    <SymbolSelector 
                      value={selectedSymbol}
                      onChange={setSelectedSymbol}
                      disabled={isRunning}
                    />
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div>
                    <h3 className="font-medium mb-2">{t('StrategySelector')}</h3>
                    <StrategySelector 
                      value={selectedStrategy}
                      onChange={setSelectedStrategy}
                      disabled={isRunning}
                    />
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <div className="flex space-x-2">
                    <Button 
                      variant={isRunning ? 'destructive' : 'default'}
                      onClick={() => setIsRunning(!isRunning)}
                    >
                      {isRunning ? t('Parar') : t('Iniciar')}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={handleAddMockOperation}
                    >
                      {t('Adicionar Operação Teste')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>{t('Configurações')}</CardTitle>
                  <CardDescription>{t('Ajuste parâmetros da estratégia')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ConfigSidebar 
                    selectedStrategy={selectedStrategy}
                    isRunning={isRunning}
                    onSaveBasicConfig={handleBasicConfigSave}
                    onSaveAdvanceConfig={handleAdvanceConfigSave}
                    initialValues={{
                      basic: {
                        stake: 1,
                        martingale: 1.5,
                        maxLoss: 20,
                        maxProfit: 20,
                        stopOnLoss: true,
                        stopOnProfit: true
                      },
                      advance: {
                        digitFrequencyThreshold: 20,
                        analysisWindow: 25,
                        prediction: 1
                      }
                    }}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          {/* Aba de análise de dígitos */}
          <TabsContent value="analysis">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t('Análise de Dígitos')}</CardTitle>
                  <CardDescription>{t('Estatísticas em tempo real de dígitos do mercado')}</CardDescription>
                </CardHeader>
                <CardContent className="h-[500px]">
                  <DigitAnalysis 
                    symbol={selectedSymbol}
                    tickCount={25}
                    isActive={true}
                  />
                </CardContent>
              </Card>
              
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Controles')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {t('O componente DigitAnalysis se conecta com a API Deriv e recebe dados em tempo real. Você pode selecionar qualquer símbolo disponível para análise.')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('Quando a estratégia "Advance" está selecionada, o robot usará as estatísticas dos dígitos 0 e 1 para determinar entradas com base no limiar configurado.')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Símbolo Selecionado')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <SymbolSelector 
                      value={selectedSymbol}
                      onChange={setSelectedSymbol}
                      disabled={false}
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
          
          {/* Aba de histórico de operações */}
          <TabsContent value="history">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>{t('Histórico de Operações')}</CardTitle>
                    <CardDescription>{t('Registro de todas as operações realizadas')}</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[600px]">
                    <OperationHistoryCard 
                      operations={operations}
                      onClearHistory={handleClearHistory}
                      isRunning={isRunning}
                    />
                  </CardContent>
                </Card>
              </div>
              
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>{t('Controles')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Button 
                        onClick={handleAddMockOperation}
                        className="w-full"
                      >
                        {t('Adicionar Operação Aleatória')}
                      </Button>
                      
                      <Button 
                        variant="outline"
                        onClick={handleClearHistory}
                        className="w-full"
                        disabled={operations.length === 0 || isRunning}
                      >
                        {t('Limpar Histórico')}
                      </Button>
                      
                      <p className="text-sm text-muted-foreground mt-4">
                        {t('O componente OperationHistoryCard mostra detalhes de cada operação e calcula estatísticas importantes como taxa de acerto, lucro total, etc.')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}