import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { getStrategyById } from '@/lib/strategiesConfig';
import { ArrowRight, Settings, Gauge, TrendingUp } from 'lucide-react';

// Esquema para validação das configurações gerais
const generalConfigSchema = z.object({
  initialStake: z.coerce.number().min(0.35, 'O valor mínimo é 0.35').max(100, 'O valor máximo é 100'),
  targetProfit: z.coerce.number().min(0, 'O valor mínimo é 0').max(1000, 'O valor máximo é 1000'),
  stopLoss: z.coerce.number().min(0, 'O valor mínimo é 0').max(1000, 'O valor máximo é 1000'),
  martingaleFactor: z.coerce.number().min(1, 'O valor mínimo é 1').max(5, 'O valor máximo é 5')
});

// Esquema para validação das configurações da estratégia Advance
const advanceConfigSchema = z.object({
  entryThreshold: z.coerce.number().min(10, 'O valor mínimo é 10').max(40, 'O valor máximo é 40'),
  analysisVolume: z.coerce.number().min(10, 'O valor mínimo é 10').max(100, 'O valor máximo é 100'),
  prediction: z.coerce.number().min(0, 'O valor mínimo é 0').max(9, 'O valor máximo é 9')
});

type GeneralConfigFormValues = z.infer<typeof generalConfigSchema>;
type AdvanceConfigFormValues = z.infer<typeof advanceConfigSchema>;

interface ConfigSidebarProps {
  onApplyConfig: (config: any) => void;
  selectedStrategy: string;
  isRunning?: boolean;
}

const ConfigSidebar: React.FC<ConfigSidebarProps> = ({
  onApplyConfig,
  selectedStrategy,
  isRunning = false
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('general');
  
  // Form para configurações gerais
  const generalForm = useForm<GeneralConfigFormValues>({
    resolver: zodResolver(generalConfigSchema),
    defaultValues: {
      initialStake: 1,
      targetProfit: 10,
      stopLoss: 10,
      martingaleFactor: 1.5
    }
  });
  
  // Form para configurações da estratégia Advance
  const advanceForm = useForm<AdvanceConfigFormValues>({
    resolver: zodResolver(advanceConfigSchema),
    defaultValues: {
      entryThreshold: 30,
      analysisVolume: 25,
      prediction: 1
    }
  });
  
  // Efeito para mudar tab quando a estratégia é alterada
  useEffect(() => {
    const strategy = getStrategyById(selectedStrategy);
    if (strategy && strategy.type === 'advance') {
      setActiveTab('advance');
    } else {
      setActiveTab('general');
    }
  }, [selectedStrategy]);
  
  // Handler para submissão do formulário de configurações gerais
  const onGeneralSubmit = (data: GeneralConfigFormValues) => {
    onApplyConfig({ 
      type: 'general',
      ...data
    });
    
    toast({
      title: t('Configurações atualizadas'),
      description: t('Configurações gerais do bot foram atualizadas'),
      variant: 'default'
    });
  };
  
  // Handler para submissão do formulário de configurações da estratégia Advance
  const onAdvanceSubmit = (data: AdvanceConfigFormValues) => {
    onApplyConfig({
      type: 'advance',
      ...data
    });
    
    toast({
      title: t('Configurações avançadas atualizadas'),
      description: t('Configurações da estratégia Advance foram atualizadas'),
      variant: 'default'
    });
  };
  
  // Determinar se deve mostrar configurações específicas da estratégia
  const showAdvanceConfig = selectedStrategy === 'advance';

  return (
    <div>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">
            <Settings className="h-4 w-4 mr-2" />
            {t('Geral')}
          </TabsTrigger>
          <TabsTrigger value="advance" disabled={!showAdvanceConfig}>
            <Gauge className="h-4 w-4 mr-2" />
            {t('Avançado')}
          </TabsTrigger>
        </TabsList>
        
        {/* Configurações gerais */}
        <TabsContent value="general">
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="space-y-4">
              <Accordion type="single" collapsible defaultValue="trading">
                <AccordionItem value="trading">
                  <AccordionTrigger className="text-sm font-medium">
                    {t('Parâmetros de Trading')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <FormField
                      control={generalForm.control}
                      name="initialStake"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>{t('Valor da Entrada')}</FormLabel>
                            <span className="text-sm">{field.value}</span>
                          </div>
                          <FormControl>
                            <div className="pt-2">
                              <Slider
                                value={[field.value]}
                                min={0.35}
                                max={10}
                                step={0.1}
                                onValueChange={(value) => field.onChange(value[0])}
                                disabled={isRunning}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            {t('Valor da entrada inicial')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={generalForm.control}
                      name="martingaleFactor"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>{t('Fator Martingale')}</FormLabel>
                            <span className="text-sm">{field.value}x</span>
                          </div>
                          <FormControl>
                            <div className="pt-2">
                              <Slider
                                value={[field.value]}
                                min={1}
                                max={3}
                                step={0.1}
                                onValueChange={(value) => field.onChange(value[0])}
                                disabled={isRunning}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            {t('Multiplicador para recuperação após perda')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="risk">
                  <AccordionTrigger className="text-sm font-medium">
                    {t('Gestão de Risco')}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4 pt-2">
                    <FormField
                      control={generalForm.control}
                      name="targetProfit"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>{t('Meta de Lucro')}</FormLabel>
                            <span className="text-sm">{field.value}</span>
                          </div>
                          <FormControl>
                            <div className="pt-2">
                              <Slider
                                value={[field.value]}
                                min={0}
                                max={50}
                                step={1}
                                onValueChange={(value) => field.onChange(value[0])}
                                disabled={isRunning}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            {t('Parar ao atingir lucro (0 = sem limite)')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={generalForm.control}
                      name="stopLoss"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex justify-between">
                            <FormLabel>{t('Stop Loss')}</FormLabel>
                            <span className="text-sm">{field.value}</span>
                          </div>
                          <FormControl>
                            <div className="pt-2">
                              <Slider
                                value={[field.value]}
                                min={0}
                                max={50}
                                step={1}
                                onValueChange={(value) => field.onChange(value[0])}
                                disabled={isRunning}
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            {t('Parar ao atingir perda (0 = sem limite)')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              
              <Button type="submit" className="w-full" disabled={isRunning}>
                {t('Aplicar Configurações')}
              </Button>
            </form>
          </Form>
        </TabsContent>
        
        {/* Configurações avançadas (para estratégia Advance) */}
        <TabsContent value="advance">
          <Form {...advanceForm}>
            <form onSubmit={advanceForm.handleSubmit(onAdvanceSubmit)} className="space-y-4">
              <div className="space-y-4">
                <FormField
                  control={advanceForm.control}
                  name="entryThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between">
                        <FormLabel>{t('Limiar para dígitos 0-1')}</FormLabel>
                        <span className="text-sm">{field.value}%</span>
                      </div>
                      <FormControl>
                        <div className="pt-2">
                          <Slider
                            value={[field.value]}
                            min={10}
                            max={40}
                            step={1}
                            onValueChange={(value) => field.onChange(value[0])}
                            disabled={isRunning}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t('Entrada quando % dígitos 0-1 for <= este valor')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={advanceForm.control}
                  name="analysisVolume"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex justify-between">
                        <FormLabel>{t('Volume de análise')}</FormLabel>
                        <span className="text-sm">{field.value} ticks</span>
                      </div>
                      <FormControl>
                        <div className="pt-2">
                          <Slider
                            value={[field.value]}
                            min={10}
                            max={50}
                            step={5}
                            onValueChange={(value) => field.onChange(value[0])}
                            disabled={isRunning}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t('Quantidade de ticks para análise')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={advanceForm.control}
                  name="prediction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Valor de Predição')}</FormLabel>
                      <div className="flex items-center space-x-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        <div className="text-sm text-muted-foreground">
                          {t('Entrada se último dígito maior que')} {field.value}
                        </div>
                      </div>
                      <FormControl>
                        <div className="pt-2">
                          <Slider
                            value={[field.value]}
                            min={0}
                            max={9}
                            step={1}
                            onValueChange={(value) => field.onChange(value[0])}
                            disabled={isRunning}
                          />
                        </div>
                      </FormControl>
                      <div className="flex mt-2 text-xs justify-between">
                        {Array.from({ length: 10 }).map((_, i) => (
                          <div 
                            key={i} 
                            className={`w-6 h-6 flex items-center justify-center rounded-full
                              ${field.value === i ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                            `}
                          >
                            {i}
                          </div>
                        ))}
                      </div>
                      <FormDescription className="mt-2">
                        {t('Valor para contrato DIGITOVER')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={isRunning}>
                {t('Aplicar Configurações Avançadas')}
              </Button>
            </form>
          </Form>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigSidebar;