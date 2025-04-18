/**
 * Componente de Gestão Operacional para a Dashboard
 * Permite ao usuário definir parâmetros operacionais como saldo inicial
 * e visualizar métricas calculadas com base nesses valores
 */

import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { ArrowDownIcon, ArrowUpIcon, CalculatorIcon, DollarSignIcon, PercentIcon, TrendingUpIcon } from "lucide-react";

// Schema de validação para os dados do formulário
const formSchema = z.object({
  saldoInicial: z.coerce
    .number()
    .positive("O saldo inicial deve ser um valor positivo")
    .min(1, "O saldo deve ser no mínimo 1"),
});

// Tipagem para os dados do formulário
type FormValues = z.infer<typeof formSchema>;

/**
 * Componente principal de Gestão Operacional
 */
export function GestaoOperacional() {
  // Estado para armazenar os resultados calculados
  const [resultados, setResultados] = useState<{
    metaLucro: number;
    stopLoss: number;
    valorAposta1x: number;
    valorAposta2x: number;
    valorAposta3x: number;
    lucroProjetado: number;
  }>({
    metaLucro: 0,
    stopLoss: 0,
    valorAposta1x: 0,
    valorAposta2x: 0,
    valorAposta3x: 0,
    lucroProjetado: 0,
  });

  // Inicializar formulário com o hook useForm
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      saldoInicial: 0,
    },
  });

  // Calcular os valores quando o formulário for submetido
  const onSubmit = (data: FormValues) => {
    const saldoInicial = data.saldoInicial;
    
    // Calcular métricas de operação
    const metaLucro = saldoInicial * 0.15; // 15% do saldo inicial
    const stopLoss = saldoInicial * 0.1; // 10% do saldo inicial
    const valorAposta1x = saldoInicial * 0.01; // 1% do saldo inicial
    const valorAposta2x = valorAposta1x * 2; // Dobro do valor 1x
    const valorAposta3x = valorAposta1x * 3; // Triplo do valor 1x
    const lucroProjetado = metaLucro * 0.85; // 85% da meta de lucro (assumindo 85% de acertos)
    
    setResultados({
      metaLucro,
      stopLoss,
      valorAposta1x,
      valorAposta2x,
      valorAposta3x,
      lucroProjetado,
    });
  };

  // Carregar saldo inicial do localStorage, se disponível
  useEffect(() => {
    const storedSaldo = localStorage.getItem('saldoInicial');
    if (storedSaldo) {
      const parsedSaldo = parseFloat(storedSaldo);
      form.setValue('saldoInicial', parsedSaldo);
      onSubmit({ saldoInicial: parsedSaldo });
    }
  }, []);

  // Salvar no localStorage quando o saldo mudar
  useEffect(() => {
    const subscription = form.watch((value) => {
      if (value.saldoInicial && value.saldoInicial > 0) {
        localStorage.setItem('saldoInicial', value.saldoInicial.toString());
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form.watch]);

  // Formatar valores monetários
  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <Card className="w-full shadow-md border-slate-800 bg-slate-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-xl font-bold text-white flex items-center">
          <CalculatorIcon className="mr-2 h-5 w-5 text-blue-400" />
          Gestão Operacional
        </CardTitle>
        <CardDescription className="text-slate-400">
          Defina seu saldo inicial para calcular parâmetros operacionais recomendados
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="saldoInicial"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-300">Saldo Inicial</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <DollarSignIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input 
                        className="pl-9 bg-slate-800 border-slate-700 text-white" 
                        placeholder="0.00" 
                        {...field} 
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-slate-500">
                    Informe o saldo inicial da sua conta para cálculos de gerenciamento de risco
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              Calcular Parâmetros
            </Button>
          </form>
        </Form>
        
        <Separator className="my-6 bg-slate-800" />
        
        <div className="rounded-md border border-slate-800 bg-slate-950">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableHead className="w-[200px] text-slate-400">Parâmetro</TableHead>
                <TableHead className="text-right text-slate-400">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <TrendingUpIcon className="mr-2 h-4 w-4 text-green-500" />
                  Meta de Lucro (15%)
                </TableCell>
                <TableCell className="text-right text-green-400">
                  {formatCurrency(resultados.metaLucro)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <ArrowDownIcon className="mr-2 h-4 w-4 text-red-500" />
                  Stop Loss (10%)
                </TableCell>
                <TableCell className="text-right text-red-400">
                  {formatCurrency(resultados.stopLoss)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <DollarSignIcon className="mr-2 h-4 w-4 text-blue-500" />
                  Valor de Aposta 1x (1%)
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {formatCurrency(resultados.valorAposta1x)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <DollarSignIcon className="mr-2 h-4 w-4 text-blue-500" />
                  Valor de Aposta 2x (2%)
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {formatCurrency(resultados.valorAposta2x)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <DollarSignIcon className="mr-2 h-4 w-4 text-blue-500" />
                  Valor de Aposta 3x (3%)
                </TableCell>
                <TableCell className="text-right text-slate-300">
                  {formatCurrency(resultados.valorAposta3x)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <PercentIcon className="mr-2 h-4 w-4 text-yellow-500" />
                  Lucro Projetado
                </TableCell>
                <TableCell className="text-right text-yellow-400">
                  {formatCurrency(resultados.lucroProjetado)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        
        <div className="mt-4 text-xs text-slate-500 italic">
          * Cálculos baseados em métodos conservadores de gerenciamento de risco.
          <br />
          * Recomenda-se não ultrapassar 1-3% do saldo em cada operação.
        </div>
      </CardContent>
    </Card>
  );
}