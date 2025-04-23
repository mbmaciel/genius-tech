import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { HelpCircle, Info, Save, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Schema para o formulário de configuração
const configSchema = z.object({
  initialStake: z.coerce.number().min(0.35, { message: 'Valor mínimo é 0.35' }).max(100, { message: 'Valor máximo é 100' }),
  martingaleFactor: z.coerce.number().min(1, { message: 'Fator mínimo é 1' }).max(3, { message: 'Fator máximo é 3' }),
  maxConsecutiveLosses: z.coerce.number().min(1, { message: 'Mínimo é 1' }).max(10, { message: 'Máximo é 10' }),
  targetProfit: z.coerce.number().min(0, { message: 'Valor mínimo é 0' }),
  stopLoss: z.coerce.number().min(0, { message: 'Valor mínimo é 0' }),
  maxOperations: z.coerce.number().min(0, { message: 'Valor mínimo é 0' }),
  enableAutomation: z.boolean().default(true),
  enableMartingale: z.boolean().default(false),
  enableStopConditions: z.boolean().default(true),
  minimumAnalysisVolume: z.coerce.number().min(10, { message: 'Valor mínimo é 10' }).max(1000, { message: 'Valor máximo é 1000' }),
  entryPercentageThreshold: z.coerce.number().min(1, { message: 'Valor mínimo é 1' }).max(99, { message: 'Valor máximo é 99' }),
});

// Tipo do formulário baseado no schema
type ConfigFormValues = z.infer<typeof configSchema>;

interface ConfigSidebarProps {
  isConnected: boolean;
  isRunning: boolean;
  onConfigChange?: (config: ConfigFormValues) => void;
}

export const ConfigSidebar: React.FC<ConfigSidebarProps> = ({
  isConnected,
  isRunning,
  onConfigChange
}) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Valores padrão do formulário
  const defaultValues: ConfigFormValues = {
    initialStake: 1,
    martingaleFactor: 1.5,
    maxConsecutiveLosses: 3,
    targetProfit: 10,
    stopLoss: 10,
    maxOperations: 0,
    enableAutomation: true,
    enableMartingale: false,
    enableStopConditions: true,
    minimumAnalysisVolume: 25,
    entryPercentageThreshold: 40,
  };

  // Inicializar o formulário
  const form = useForm<ConfigFormValues>({
    resolver: zodResolver(configSchema),
    defaultValues,
  });

  // Submeter o formulário
  const onSubmit = (data: ConfigFormValues) => {
    console.log('Configuração atualizada:', data);
    if (onConfigChange) {
      onConfigChange(data);
    }
  };

  // Resetar formulário
  const handleReset = () => {
    form.reset(defaultValues);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('Configurações Básicas')}</CardTitle>
              <CardDescription>
                {t('Configure os parâmetros básicos do robô')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="initialStake"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('Valor Inicial da Entrada')}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 p-0" type="button">
                              <HelpCircle className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{t('Valor inicial para cada operação')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        disabled={isRunning}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enableMartingale"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-x-2 rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('Martingale')}
                      </FormLabel>
                      <FormDescription>
                        {t('Aumenta valor da entrada após perda')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isRunning}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('enableMartingale') && (
                <>
                  <FormField
                    control={form.control}
                    name="martingaleFactor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Fator Martingale')}</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Slider
                              defaultValue={[field.value]}
                              min={1}
                              max={3}
                              step={0.1}
                              onValueChange={(values) => field.onChange(values[0])}
                              disabled={isRunning}
                            />
                            <div className="flex justify-between">
                              <span>1.0x</span>
                              <span className="font-medium">{field.value}x</span>
                              <span>3.0x</span>
                            </div>
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxConsecutiveLosses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Máximo de Perdas Consecutivas')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            disabled={isRunning}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('Parar após este número de perdas consecutivas')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              <FormField
                control={form.control}
                name="enableStopConditions"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between space-x-2 rounded-md border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        {t('Condições de Parada')}
                      </FormLabel>
                      <FormDescription>
                        {t('Define limites para interromper as operações')}
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isRunning}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('enableStopConditions') && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="targetProfit"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Meta de Lucro')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              disabled={isRunning}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Parar ao atingir este lucro')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="stopLoss"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('Stop Loss')}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              disabled={isRunning}
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            {t('Parar ao atingir esta perda')}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="maxOperations"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Máximo de Operações')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            disabled={isRunning}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('0 = sem limite')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-center mb-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? t('Ocultar Avançado') : t('Mostrar Avançado')}
            </Button>
          </div>

          {showAdvanced && (
            <Card>
              <CardHeader>
                <CardTitle>{t('Configurações Avançadas')}</CardTitle>
                <CardDescription>
                  {t('Parâmetros avançados para estratégias específicas')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-md bg-blue-500/10 mb-2">
                  <div className="flex items-center">
                    <Info className="h-4 w-4 mr-2 text-blue-500" />
                    <p className="text-sm text-blue-500">
                      {t('Estas configurações afetam principalmente a estratégia Advance')}
                    </p>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="minimumAnalysisVolume"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Volume Mínimo de Análise')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          disabled={isRunning}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Quantidade de ticks analisados para identificar padrões')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="entryPercentageThreshold"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Limiar de Porcentagem para Entrada')}</FormLabel>
                      <FormControl>
                        <div className="space-y-2">
                          <Slider
                            defaultValue={[field.value]}
                            min={1}
                            max={99}
                            step={1}
                            onValueChange={(values) => field.onChange(values[0])}
                            disabled={isRunning}
                          />
                          <div className="flex justify-between">
                            <span>1%</span>
                            <span className="font-medium">{field.value}%</span>
                            <span>99%</span>
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        {t('Percentual mínimo para considerar um padrão válido')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={!isConnected || isRunning}
            >
              <Save className="h-4 w-4 mr-2" />
              {t('Salvar Configurações')}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={handleReset}
              disabled={isRunning}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('Restaurar Padrões')}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
};