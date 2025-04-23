import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Wrench, 
  Save,
  Sliders, 
  DollarSign,
  Percent
} from 'lucide-react';

// Interfaces para as configurações
interface BasicConfig {
  stake: number;
  martingale: number;
  maxLoss: number;
  maxProfit: number;
  stopOnLoss: boolean;
  stopOnProfit: boolean;
}

interface AdvanceConfig {
  digitFrequencyThreshold: number;
  analysisWindow: number;
  prediction: number;
}

interface ConfigSidebarProps {
  selectedStrategy: string;
  isRunning: boolean;
  onSaveBasicConfig?: (config: BasicConfig) => void;
  onSaveAdvanceConfig?: (config: AdvanceConfig) => void;
  initialValues?: {
    basic?: Partial<BasicConfig>;
    advance?: Partial<AdvanceConfig>;
  };
}

export default function ConfigSidebar({
  selectedStrategy,
  isRunning,
  onSaveBasicConfig,
  onSaveAdvanceConfig,
  initialValues = {}
}: ConfigSidebarProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  // Estado para configurações básicas
  const [basicConfig, setBasicConfig] = useState<BasicConfig>({
    stake: initialValues.basic?.stake || 1,
    martingale: initialValues.basic?.martingale || 1.5,
    maxLoss: initialValues.basic?.maxLoss || 20,
    maxProfit: initialValues.basic?.maxProfit || 20,
    stopOnLoss: initialValues.basic?.stopOnLoss !== undefined ? initialValues.basic.stopOnLoss : true,
    stopOnProfit: initialValues.basic?.stopOnProfit !== undefined ? initialValues.basic.stopOnProfit : true
  });

  // Estado para configurações avançadas da estratégia Advance
  const [advanceConfig, setAdvanceConfig] = useState<AdvanceConfig>({
    digitFrequencyThreshold: initialValues.advance?.digitFrequencyThreshold || 20,
    analysisWindow: initialValues.advance?.analysisWindow || 25,
    prediction: initialValues.advance?.prediction || 1
  });
  
  // Resetar a configuração avançada ao mudar de estratégia
  useEffect(() => {
    if (selectedStrategy === 'advance') {
      setAdvanceConfig({
        digitFrequencyThreshold: initialValues.advance?.digitFrequencyThreshold || 20,
        analysisWindow: initialValues.advance?.analysisWindow || 25,
        prediction: initialValues.advance?.prediction || 1
      });
    }
  }, [selectedStrategy, initialValues.advance]);

  // Manipuladores para alterações nas configurações básicas
  const handleBasicConfigChange = (key: keyof BasicConfig, value: any) => {
    setBasicConfig(prev => ({ ...prev, [key]: value }));
  };

  // Manipuladores para alterações nas configurações da estratégia Advance
  const handleAdvanceConfigChange = (key: keyof AdvanceConfig, value: any) => {
    setAdvanceConfig(prev => ({ ...prev, [key]: value }));
  };

  // Enviar configurações básicas
  const saveBasicConfig = () => {
    if (onSaveBasicConfig) {
      onSaveBasicConfig(basicConfig);
      
      toast({
        title: t('Configurações salvas'),
        description: t('Configurações básicas foram atualizadas com sucesso'),
        duration: 3000
      });
    }
  };

  // Enviar configurações da estratégia Advance
  const saveAdvanceConfig = () => {
    if (onSaveAdvanceConfig) {
      onSaveAdvanceConfig(advanceConfig);
      
      toast({
        title: t('Configurações salvas'),
        description: t('Configurações avançadas foram atualizadas com sucesso'),
        duration: 3000
      });
    }
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="mb-4 grid grid-cols-2">
        <TabsTrigger value="basic" className="flex items-center gap-1">
          <Settings className="h-4 w-4" />
          {t('Básico')}
        </TabsTrigger>
        <TabsTrigger value="advanced" className="flex items-center gap-1" disabled={selectedStrategy !== 'advance'}>
          <Wrench className="h-4 w-4" />
          {t('Avançado')}
        </TabsTrigger>
      </TabsList>
      
      {/* Configurações básicas (comum a todas estratégias) */}
      <TabsContent value="basic" className="space-y-4">
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Valor da entrada */}
            <div className="space-y-1">
              <Label htmlFor="stake" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {t('Valor Inicial ($)')}
              </Label>
              <Input
                id="stake"
                type="number"
                min="0.35"
                step="0.1"
                value={basicConfig.stake}
                onChange={e => handleBasicConfigChange('stake', parseFloat(e.target.value))}
                disabled={isRunning}
              />
            </div>
            
            {/* Fator de Martingale */}
            <div className="space-y-1">
              <Label className="flex items-center gap-1">
                <Sliders className="h-4 w-4" />
                {t('Fator Martingale')}
              </Label>
              <div className="space-y-2">
                <Slider
                  min={1}
                  max={3}
                  step={0.1}
                  value={[basicConfig.martingale]}
                  onValueChange={value => handleBasicConfigChange('martingale', value[0])}
                  disabled={isRunning}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1.0x</span>
                  <span className="font-medium">{basicConfig.martingale.toFixed(1)}x</span>
                  <span>3.0x</span>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Perda máxima */}
            <div className="space-y-1">
              <Label htmlFor="maxLoss" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {t('Perda Máxima ($)')}
              </Label>
              <Input
                id="maxLoss"
                type="number"
                min="0"
                step="1"
                value={basicConfig.maxLoss}
                onChange={e => handleBasicConfigChange('maxLoss', parseInt(e.target.value))}
                disabled={isRunning}
              />
            </div>
            
            {/* Lucro Alvo */}
            <div className="space-y-1">
              <Label htmlFor="maxProfit" className="flex items-center gap-1">
                <DollarSign className="h-4 w-4" />
                {t('Lucro Alvo ($)')}
              </Label>
              <Input
                id="maxProfit"
                type="number"
                min="0"
                step="1"
                value={basicConfig.maxProfit}
                onChange={e => handleBasicConfigChange('maxProfit', parseInt(e.target.value))}
                disabled={isRunning}
              />
            </div>
            
            <Separator />
            
            {/* Parar ao atingir perda máxima */}
            <div className="flex items-center justify-between">
              <Label htmlFor="stopOnLoss" className="cursor-pointer">
                {t('Parar ao Atingir Perda Máxima')}
              </Label>
              <Switch
                id="stopOnLoss"
                checked={basicConfig.stopOnLoss}
                onCheckedChange={value => handleBasicConfigChange('stopOnLoss', value)}
                disabled={isRunning}
              />
            </div>
            
            {/* Parar ao atingir lucro alvo */}
            <div className="flex items-center justify-between">
              <Label htmlFor="stopOnProfit" className="cursor-pointer">
                {t('Parar ao Atingir Lucro Alvo')}
              </Label>
              <Switch
                id="stopOnProfit"
                checked={basicConfig.stopOnProfit}
                onCheckedChange={value => handleBasicConfigChange('stopOnProfit', value)}
                disabled={isRunning}
              />
            </div>
            
            <Button 
              className="w-full" 
              onClick={saveBasicConfig}
              disabled={isRunning}
            >
              <Save className="h-4 w-4 mr-2" />
              {t('Salvar Configurações')}
            </Button>
          </CardContent>
        </Card>
        
        {/* Mensagem explicativa */}
        <div className="text-xs text-muted-foreground">
          <p>{t('Configure os parâmetros básicos de gerenciamento de capital do robô aqui.')}</p>
        </div>
      </TabsContent>
      
      {/* Configurações avançadas específicas da estratégia selecionada */}
      <TabsContent value="advanced" className="space-y-4">
        {selectedStrategy === 'advance' ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {/* Descrição da estratégia */}
              <p className="text-sm text-muted-foreground mb-2">
                {t('A estratégia Advance monitora a frequência dos dígitos 0 e 1. Quando esta frequência estiver abaixo do Limiar de Frequência configurado, o robô fará uma operação DIGITOVER com a Previsão definida.')}
              </p>
              
              <Separator />
              
              {/* Limiar de frequência */}
              <div className="space-y-1">
                <Label className="flex items-center gap-1">
                  <Percent className="h-4 w-4" />
                  {t('Limiar de Frequência (%)')}
                </Label>
                <div className="space-y-2">
                  <Slider
                    min={5}
                    max={40}
                    step={1}
                    value={[advanceConfig.digitFrequencyThreshold]}
                    onValueChange={value => handleAdvanceConfigChange('digitFrequencyThreshold', value[0])}
                    disabled={isRunning}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>5%</span>
                    <span className="font-medium">{advanceConfig.digitFrequencyThreshold}%</span>
                    <span>40%</span>
                  </div>
                </div>
              </div>
              
              {/* Janela de análise */}
              <div className="space-y-1">
                <Label htmlFor="analysisWindow" className="flex items-center gap-1">
                  <Sliders className="h-4 w-4" />
                  {t('Janela de Análise (ticks)')}
                </Label>
                <Input
                  id="analysisWindow"
                  type="number"
                  min="10"
                  max="100"
                  value={advanceConfig.analysisWindow}
                  onChange={e => handleAdvanceConfigChange('analysisWindow', parseInt(e.target.value))}
                  disabled={isRunning}
                />
              </div>
              
              {/* Previsão (prediction) */}
              <div className="space-y-1">
                <Label htmlFor="prediction" className="flex items-center gap-1">
                  <Sliders className="h-4 w-4" />
                  {t('Previsão')}
                </Label>
                <Input
                  id="prediction"
                  type="number"
                  min="0"
                  max="9"
                  value={advanceConfig.prediction}
                  onChange={e => handleAdvanceConfigChange('prediction', parseInt(e.target.value))}
                  disabled={isRunning}
                />
              </div>
              
              <Button 
                className="w-full" 
                onClick={saveAdvanceConfig}
                disabled={isRunning}
              >
                <Save className="h-4 w-4 mr-2" />
                {t('Salvar Configurações Avançadas')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex items-center justify-center p-8 text-muted-foreground">
            {t('Não há configurações avançadas disponíveis para a estratégia selecionada')}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}