import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { oauthDirectService } from '@/services/oauthDirectService';
import { Play, StopCircle, Settings, RefreshCw, BarChart3 } from 'lucide-react';

interface BotControllerProps {
  selectedSymbol: string;
  selectedStrategy: string;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  isRunning: boolean;
}

// Schema para o formulário de controle do robô
const controlFormSchema = z.object({
  initialStake: z.coerce.number().min(0.35, { message: 'Valor mínimo é 0.35' }).max(100, { message: 'Valor máximo é 100' }),
  maxConsecutiveLosses: z.coerce.number().min(1, { message: 'Mínimo é 1' }).max(10, { message: 'Máximo é 10' }),
  martingaleEnabled: z.boolean().default(false),
  martingaleFactor: z.coerce.number().min(1, { message: 'Fator mínimo é 1' }).max(3, { message: 'Fator máximo é 3' }),
  stopConditionsEnabled: z.boolean().default(true),
  targetProfit: z.coerce.number().min(0, { message: 'Valor mínimo é 0' }),
  stopLoss: z.coerce.number().min(0, { message: 'Valor mínimo é 0' }),
  maxOperations: z.coerce.number().min(0, { message: 'Valor mínimo é 0' }),
});

type ControlFormValues = z.infer<typeof controlFormSchema>;

const BotController: React.FC<BotControllerProps> = ({
  selectedSymbol,
  selectedStrategy,
  onStart,
  onStop,
  isRunning
}) => {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [lastTick, setLastTick] = useState<{ value: number, time: Date } | null>(null);
  const [tickSubscription, setTickSubscription] = useState<number | null>(null);

  // Inicializar o formulário
  const form = useForm<ControlFormValues>({
    resolver: zodResolver(controlFormSchema),
    defaultValues: {
      initialStake: 1,
      maxConsecutiveLosses: 3,
      martingaleEnabled: false,
      martingaleFactor: 1.5,
      stopConditionsEnabled: true,
      targetProfit: 10,
      stopLoss: 10,
      maxOperations: 0,
    },
  });

  // Assinar atualizações de ticks
  useEffect(() => {
    if (!selectedSymbol) return;

    // Função para processar ticks
    const handleTick = (tick: any) => {
      if (tick && tick.tick) {
        setLastTick({
          value: tick.tick.quote,
          time: new Date(tick.tick.epoch * 1000)
        });
      }
    };

    // Assinar para receber ticks
    oauthDirectService.subscribeTicks(selectedSymbol, handleTick);

    // Cancelar assinatura ao desmontar
    return () => {
      if (selectedSymbol) {
        oauthDirectService.unsubscribeTicks(selectedSymbol, handleTick);
      }
    };
  }, [selectedSymbol]);

  // Manipular submissão do formulário
  const onSubmit = (data: ControlFormValues) => {
    console.log('Configurações do bot atualizadas:', data);
    // Aqui você pode implementar lógica para atualizar configurações no serviço
  };

  // Obter último dígito do valor do tick
  const getLastDigit = (value: number | null) => {
    if (value === null) return '-';
    // Para índices sintéticos, o último dígito é o dígito após o ponto decimal
    const valueString = value.toFixed(2);
    return valueString.charAt(valueString.length - 1);
  };

  return (
    <div className="space-y-4">
      {/* Painel de estatísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t('Símbolo')}</div>
            <div className="text-xl font-semibold">{selectedSymbol || '-'}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t('Estratégia')}</div>
            <div className="text-xl font-semibold">{selectedStrategy || '-'}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t('Último Valor')}</div>
            <div className="text-xl font-semibold">{lastTick ? lastTick.value.toFixed(2) : '-'}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">{t('Último Dígito')}</div>
            <div className="text-xl font-semibold">{getLastDigit(lastTick?.value || null)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Controles principais */}
      <div className="flex flex-col sm:flex-row gap-4">
        {!isRunning ? (
          <Button 
            onClick={onStart}
            className="w-full bg-green-600 hover:bg-green-700 flex-1"
            disabled={!selectedStrategy}
          >
            <Play className="h-4 w-4 mr-2" />
            {t('Iniciar Operações')}
          </Button>
        ) : (
          <Button 
            onClick={onStop}
            className="w-full bg-red-600 hover:bg-red-700 flex-1"
          >
            <StopCircle className="h-4 w-4 mr-2" />
            {t('Parar Operações')}
          </Button>
        )}
        
        <Button 
          variant="outline" 
          className="w-full flex-1"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4 mr-2" />
          {showSettings ? t('Ocultar Configurações') : t('Mostrar Configurações')}
        </Button>
      </div>

      {/* Configurações */}
      {showSettings && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="initialStake"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Valor Inicial')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            disabled={isRunning}
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('Valor inicial da operação')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="martingaleEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-x-2 rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>{t('Usar Martingale')}</FormLabel>
                          <FormDescription>
                            {t('Aumentar valor após perda')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            disabled={isRunning}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('martingaleEnabled') && (
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
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="stopConditionsEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between space-x-2 rounded-md border p-4">
                        <div className="space-y-0.5">
                          <FormLabel>{t('Condições de Parada')}</FormLabel>
                          <FormDescription>
                            {t('Definir limites de lucro/perda')}
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            disabled={isRunning}
                            className="h-4 w-4"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('stopConditionsEnabled') && (
                    <>
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
                              {t('0 = ilimitado')}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>

                <div className="mt-6 flex justify-end space-x-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => form.reset()}
                    disabled={isRunning}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {t('Restaurar Padrões')}
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isRunning}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    {t('Aplicar Configurações')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      )}
    </div>
  );
};

export default BotController;