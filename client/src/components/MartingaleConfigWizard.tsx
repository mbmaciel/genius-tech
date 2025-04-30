import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { PlusIcon, MinusIcon, ArrowRightIcon, SaveIcon, CheckSquareIcon } from 'lucide-react';

// Esquema de validação
const martingaleSchema = z.object({
  initialStake: z.string().transform((v) => parseFloat(v)).refine((v) => v > 0, {
    message: "O valor inicial deve ser maior que zero",
  }),
  martingaleFactor: z.string().transform((v) => parseFloat(v)).refine((v) => v > 0, {
    message: "O fator de martingale deve ser maior que zero",
  }),
  maxMartingaleLevel: z.string().transform((v) => parseFloat(v)).refine((v) => v >= 0, {
    message: "O nível máximo de martingale deve ser maior ou igual a zero",
  }),
  lossVirtual: z.string().transform((v) => parseFloat(v)).refine((v) => v >= 0, {
    message: "O nível de Loss Virtual deve ser maior ou igual a zero",
  }),
  targetProfit: z.string().transform((v) => parseFloat(v)).refine((v) => v > 0, {
    message: "A meta de lucro deve ser maior que zero",
  }),
  stopLoss: z.string().transform((v) => parseFloat(v)).refine((v) => v > 0, {
    message: "O limite de perda deve ser maior que zero",
  }),
  resetOnWin: z.boolean().default(true),
});

type MartingaleFormValues = z.infer<typeof martingaleSchema>;

interface MartingaleConfigWizardProps {
  strategyId: string;
  onSave: (config: any) => void;
  onCancel: () => void;
  initialValues?: {
    valorInicial?: number;
    martingale?: number;
    lossVirtual?: number;
    metaGanho?: number;
    limitePerda?: number;
    parcelasMartingale?: number;
    resetAposVitoria?: boolean;
  };
}

export function MartingaleConfigWizard({
  strategyId,
  onSave,
  onCancel,
  initialValues = {}
}: MartingaleConfigWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const totalSteps = 4;
  const [simulationResults, setSimulationResults] = useState<Array<{stake: number, level: number}>>([]);

  // Valores padrão
  const defaultValues: MartingaleFormValues = {
    initialStake: (initialValues.valorInicial || 1).toString(),
    martingaleFactor: (initialValues.martingale || 1.5).toString(),
    maxMartingaleLevel: (initialValues.parcelasMartingale || 3).toString(),
    lossVirtual: (initialValues.lossVirtual || 1).toString(),
    targetProfit: (initialValues.metaGanho || 20).toString(),
    stopLoss: (initialValues.limitePerda || 10).toString(),
    resetOnWin: initialValues.resetAposVitoria !== undefined ? initialValues.resetAposVitoria : true,
  };

  // Configuração do formulário
  const form = useForm<MartingaleFormValues>({
    resolver: zodResolver(martingaleSchema),
    defaultValues,
  });

  // Simulação dos valores de martingale
  useEffect(() => {
    const initialStake = parseFloat(form.watch('initialStake')) || 1;
    const factor = parseFloat(form.watch('martingaleFactor')) || 1.5;
    const maxLevel = parseInt(form.watch('maxMartingaleLevel')) || 3;
    
    const results = [];
    let currentStake = initialStake;
    
    // Adicionar a entrada inicial
    results.push({
      stake: currentStake,
      level: 0
    });
    
    // Calcular cada nível de martingale
    for (let i = 1; i <= maxLevel; i++) {
      currentStake = parseFloat((currentStake * factor).toFixed(2));
      results.push({
        stake: currentStake,
        level: i
      });
    }
    
    setSimulationResults(results);
  }, [
    form.watch('initialStake'),
    form.watch('martingaleFactor'),
    form.watch('maxMartingaleLevel')
  ]);

  const onSubmit = (data: MartingaleFormValues) => {
    // Convertemos para o formato que o sistema espera
    const configToSave = {
      valorInicial: parseFloat(data.initialStake),
      martingale: parseFloat(data.martingaleFactor),
      parcelasMartingale: parseInt(data.maxMartingaleLevel),
      lossVirtual: parseInt(data.lossVirtual),
      metaGanho: parseFloat(data.targetProfit),
      limitePerda: parseFloat(data.stopLoss),
      resetAposVitoria: data.resetOnWin,
    };
    
    // Salvar as configurações no localStorage para persistência
    try {
      const configKey = `strategy_config_${strategyId.toLowerCase()}`;
      localStorage.setItem(configKey, JSON.stringify(configToSave));
      
      toast({
        title: "Configuração salva",
        description: "As configurações de martingale foram salvas com sucesso.",
        duration: 3000,
      });
      
      // Chamar callback para informar que foi salvo
      onSave(configToSave);
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as configurações. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const nextStep = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      form.handleSubmit(onSubmit)();
    }
  };

  const prevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onCancel();
    }
  };

  // Total acumulado que pode ser perdido na pior sequência
  const totalRisk = simulationResults.reduce((acc, curr) => acc + curr.stake, 0);
  
  // Função para renderizar o conteúdo com base no passo atual
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <>
            <CardDescription className="mb-4">
              Configure os valores básicos de operação da estratégia.
            </CardDescription>
            
            <FormField
              control={form.control}
              name="initialStake"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Valor Inicial (R$)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="0.35" step="0.01" placeholder="1.00" />
                  </FormControl>
                  <FormDescription>
                    O valor da sua primeira entrada (stake) em cada ciclo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="targetProfit"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Meta de Lucro (R$)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="1" step="1" placeholder="20" />
                  </FormControl>
                  <FormDescription>
                    O robô parará quando atingir este valor de lucro.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="stopLoss"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Limite de Perda (R$)</FormLabel>
                  <FormControl>
                    <Input {...field} type="number" min="1" step="1" placeholder="10" />
                  </FormControl>
                  <FormDescription>
                    O robô parará quando as perdas atingirem este valor.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
        
      case 2:
        return (
          <>
            <CardDescription className="mb-4">
              Configure como o sistema deve reagir após perdas consecutivas.
            </CardDescription>
            
            <FormField
              control={form.control}
              name="martingaleFactor"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Fator de Martingale</FormLabel>
                  <div className="flex items-center gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newValue = Math.max(0.1, parseFloat(field.value) - 0.1).toFixed(1);
                        form.setValue('martingaleFactor', newValue);
                      }}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <FormControl className="flex-1">
                      <Input {...field} type="number" min="0.1" step="0.1" placeholder="1.5" />
                    </FormControl>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newValue = (parseFloat(field.value) + 0.1).toFixed(1);
                        form.setValue('martingaleFactor', newValue);
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormDescription>
                    Multiplicador aplicado após cada perda (ex: 1.5x, 2x).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="maxMartingaleLevel"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Níveis Máximos de Martingale</FormLabel>
                  <div className="flex items-center gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newValue = Math.max(0, parseInt(field.value) - 1).toString();
                        form.setValue('maxMartingaleLevel', newValue);
                      }}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <FormControl className="flex-1">
                      <Input {...field} type="number" min="0" step="1" placeholder="3" />
                    </FormControl>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newValue = (parseInt(field.value) + 1).toString();
                        form.setValue('maxMartingaleLevel', newValue);
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormDescription>
                    Quantas vezes o sistema aplicará o martingale consecutivamente.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="lossVirtual"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <FormLabel>Loss Virtual (Aplicar martingale após X perdas)</FormLabel>
                  <div className="flex items-center gap-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newValue = Math.max(0, parseInt(field.value) - 1).toString();
                        form.setValue('lossVirtual', newValue);
                      }}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <FormControl className="flex-1">
                      <Input {...field} type="number" min="0" step="1" placeholder="1" />
                    </FormControl>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        const newValue = (parseInt(field.value) + 1).toString();
                        form.setValue('lossVirtual', newValue);
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormDescription>
                    Quantas perdas consecutivas são necessárias antes de aplicar martingale.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="resetOnWin"
              render={({ field }) => (
                <FormItem className="mb-4">
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Switch 
                        checked={field.value} 
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel>Resetar para valor inicial após vitória</FormLabel>
                  </div>
                  <FormDescription>
                    Se ativado, retorna ao valor inicial após qualquer vitória.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        );
        
      case 3:
        return (
          <>
            <CardDescription className="mb-6">
              Simulação da sequência de martingale com base nas suas configurações.
            </CardDescription>
            
            <div className="space-y-4">
              <div className="grid grid-cols-3 font-medium text-sm mb-2">
                <div>Nível</div>
                <div>Valor (R$)</div>
                <div>Acumulado (R$)</div>
              </div>
              
              <Separator />
              
              {simulationResults.map((result, index) => {
                const accumulatedRisk = simulationResults
                  .slice(0, index + 1)
                  .reduce((sum, item) => sum + item.stake, 0);
                  
                return (
                  <div key={index} className="grid grid-cols-3 items-center py-2">
                    <div className={index === 0 ? "text-green-500" : "text-yellow-500"}>
                      {index === 0 ? "Inicial" : `Martingale ${index}`}
                    </div>
                    <div className="font-mono">
                      {result.stake.toFixed(2)}
                    </div>
                    <div className="font-mono text-muted-foreground">
                      {accumulatedRisk.toFixed(2)}
                    </div>
                  </div>
                );
              })}
              
              <Separator />
              
              <div className="pt-2 flex justify-between font-medium">
                <span>Perda máxima possível em uma sequência:</span>
                <span className="font-mono text-destructive">{totalRisk.toFixed(2)} R$</span>
              </div>
              
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-md p-3 mt-4">
                <p className="text-sm text-yellow-500">
                  <strong>Importante:</strong> Certifique-se de que seu limite de perda seja maior 
                  que a perda máxima possível mostrada acima, caso contrário, o robô pode parar 
                  antes de completar sua sequência de martingale.
                </p>
              </div>
            </div>
          </>
        );
        
      case 4:
        return (
          <>
            <CardDescription className="mb-6">
              Confirme suas configurações antes de salvar.
            </CardDescription>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Valores Básicos</h4>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Valor Inicial:</span>
                    <span className="font-mono">{form.getValues('initialStake')} R$</span>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Meta de Lucro:</span>
                    <span className="font-mono">{form.getValues('targetProfit')} R$</span>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Limite de Perda:</span>
                    <span className="font-mono">{form.getValues('stopLoss')} R$</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Configuração de Martingale</h4>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Fator:</span>
                    <span className="font-mono">{form.getValues('martingaleFactor')}x</span>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Níveis Máximos:</span>
                    <span className="font-mono">{form.getValues('maxMartingaleLevel')}</span>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Loss Virtual:</span>
                    <span className="font-mono">Após {form.getValues('lossVirtual')} {parseInt(form.getValues('lossVirtual')) === 1 ? 'perda' : 'perdas'}</span>
                  </div>
                  <div className="grid grid-cols-2 text-sm">
                    <span className="text-muted-foreground">Reset após vitória:</span>
                    <span>{form.getValues('resetOnWin') ? 'Sim' : 'Não'}</span>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div className="pt-2">
                <p className="text-sm text-muted-foreground">
                  Estas configurações serão salvas para a estratégia atual e aplicadas em todas as operações.
                </p>
              </div>
            </div>
          </>
        );
        
      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Assistente de Configuração de Martingale</CardTitle>
        <div className="flex items-center gap-2 mt-2">
          {Array.from({ length: totalSteps }).map((_, index) => (
            <div 
              key={index}
              className={`h-1 flex-1 rounded-full ${index + 1 === step ? 'bg-primary' : index + 1 < step ? 'bg-primary/50' : 'bg-muted'}`}
            />
          ))}
        </div>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent>
            {renderStepContent()}
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline"
              onClick={prevStep}
            >
              {step === 1 ? 'Cancelar' : 'Voltar'}
            </Button>
            
            <Button 
              type="button"
              onClick={nextStep}
            >
              {step === totalSteps ? (
                <div className="flex items-center gap-2">
                  <SaveIcon className="h-4 w-4" />
                  <span>Salvar Configurações</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Próximo</span>
                  <ArrowRightIcon className="h-4 w-4" />
                </div>
              )}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}