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
  // Interface para os dados de cada dia na planilha
  interface DiaPlanilha {
    dia: number;
    saldoInicial: number;
    lucro: number;
    saldoFinal: number;
    limitePerca: number;
  }

  // Estado para armazenar os resultados calculados
  const [resultados, setResultados] = useState<{
    metaDiaria: number;
    metaDiariaComSaldo: number;
    limitePerca: number;
    metaSemanal: number;
    valorAposta1x: number;
    valorAposta2x: number;
    valorAposta3x: number;
    saldoProjetado: number;
    planilhaSemanal: DiaPlanilha[];
  }>({
    metaDiaria: 0,
    metaDiariaComSaldo: 0,
    limitePerca: 0,
    metaSemanal: 0,
    valorAposta1x: 0,
    valorAposta2x: 0,
    valorAposta3x: 0,
    saldoProjetado: 0,
    planilhaSemanal: [],
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
    
    // Calcular métricas de operação conforme especificado
    const metaDiaria = saldoInicial * 0.15; // 15% do saldo inicial
    const metaDiariaComSaldo = saldoInicial + metaDiaria; // Meta do dia = 15% do saldo inicial + o saldo inicial
    const limitePerca = saldoInicial * 0.07; // 7% do saldo inicial
    
    // Cálculo detalhado da planilha semanal com juros compostos (7 dias)
    let saldoAtual = saldoInicial;
    const planilhaSemanal: DiaPlanilha[] = [];
    
    for (let dia = 1; dia <= 7; dia++) {
      const lucro = saldoAtual * 0.15; // 15% do saldo do dia
      const saldoFinal = saldoAtual + lucro; // Saldo atual + lucro do dia
      const limitePerdaDiario = saldoAtual * 0.07; // 7% do saldo do dia como limite de perda
      
      // Adicionar dia à planilha
      planilhaSemanal.push({
        dia,
        saldoInicial: saldoAtual,
        lucro,
        saldoFinal,
        limitePerca: limitePerdaDiario
      });
      
      // Atualizar saldo para o próximo dia
      saldoAtual = saldoFinal;
    }
    
    const saldoProjetado = saldoAtual; // Saldo final após 7 dias
    const metaSemanal = saldoProjetado - saldoInicial; // Lucro total projetado
    
    // Valores de apostas recomendados
    const valorAposta1x = saldoInicial * 0.01; // 1% do saldo inicial
    const valorAposta2x = valorAposta1x * 2; // Dobro do valor 1x
    const valorAposta3x = valorAposta1x * 3; // Triplo do valor 1x
    
    setResultados({
      metaDiaria,
      metaDiariaComSaldo,
      limitePerca,
      metaSemanal,
      valorAposta1x,
      valorAposta2x,
      valorAposta3x,
      saldoProjetado,
      planilhaSemanal
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
              {/* METAS DIÁRIAS */}
              <TableRow className="hover:bg-slate-900 border-slate-800 bg-slate-900">
                <TableCell colSpan={2} className="text-sm font-semibold text-blue-400">
                  Metas Diárias
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <TrendingUpIcon className="mr-2 h-4 w-4 text-green-500" />
                  Meta de Lucro Diário (15%)
                </TableCell>
                <TableCell className="text-right text-green-400">
                  {formatCurrency(resultados.metaDiaria)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <TrendingUpIcon className="mr-2 h-4 w-4 text-green-500" />
                  Meta Diária Total (Saldo + 15%)
                </TableCell>
                <TableCell className="text-right text-green-400">
                  {formatCurrency(resultados.metaDiariaComSaldo)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <ArrowDownIcon className="mr-2 h-4 w-4 text-red-500" />
                  Limite de Perda Diário (7%)
                </TableCell>
                <TableCell className="text-right text-red-400">
                  {formatCurrency(resultados.limitePerca)}
                </TableCell>
              </TableRow>
              
              {/* METAS SEMANAIS */}
              <TableRow className="hover:bg-slate-900 border-slate-800 bg-slate-900">
                <TableCell colSpan={2} className="text-sm font-semibold text-blue-400">
                  Projeção Semanal (7 dias)
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <PercentIcon className="mr-2 h-4 w-4 text-yellow-500" />
                  Lucro Projetado (Juros Compostos)
                </TableCell>
                <TableCell className="text-right text-yellow-400">
                  {formatCurrency(resultados.metaSemanal)}
                </TableCell>
              </TableRow>
              
              <TableRow className="hover:bg-slate-900 border-slate-800">
                <TableCell className="font-medium text-slate-300 flex items-center">
                  <PercentIcon className="mr-2 h-4 w-4 text-yellow-500" />
                  Saldo Projetado ao Final de 7 Dias
                </TableCell>
                <TableCell className="text-right text-yellow-400">
                  {formatCurrency(resultados.saldoProjetado)}
                </TableCell>
              </TableRow>
              
              {/* VALORES DE APOSTA */}
              <TableRow className="hover:bg-slate-900 border-slate-800 bg-slate-900">
                <TableCell colSpan={2} className="text-sm font-semibold text-blue-400">
                  Valores Recomendados para Apostas
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
            </TableBody>
          </Table>
        </div>
        
        {/* PLANILHA SEMANAL DETALHADA */}
        <div className="mt-6">
          <h3 className="text-xl font-bold text-white mb-3 flex items-center">
            <CalculatorIcon className="mr-2 h-5 w-5 text-blue-400" />
            Planilha Semanal Detalhada
          </h3>
          
          <div className="rounded-md border border-slate-800 bg-slate-950 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-slate-900 border-slate-800">
                  <TableHead className="text-slate-400">Dia</TableHead>
                  <TableHead className="text-slate-400">Saldo Inicial</TableHead>
                  <TableHead className="text-slate-400">Lucro Diário (15%)</TableHead>
                  <TableHead className="text-slate-400">Saldo Final</TableHead>
                  <TableHead className="text-slate-400">Limite de Perda (7%)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.planilhaSemanal.map((dia) => (
                  <TableRow key={dia.dia} className="hover:bg-slate-900 border-slate-800">
                    <TableCell className="font-medium text-slate-300">Dia {dia.dia}</TableCell>
                    <TableCell className="text-slate-300">{formatCurrency(dia.saldoInicial)}</TableCell>
                    <TableCell className="text-green-400">{formatCurrency(dia.lucro)}</TableCell>
                    <TableCell className="text-blue-400">{formatCurrency(dia.saldoFinal)}</TableCell>
                    <TableCell className="text-red-400">{formatCurrency(dia.limitePerca)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <div className="mt-4 text-xs text-slate-500 italic">
          * Cálculos baseados em métodos conservadores de gerenciamento de risco.
          <br />
          * Recomenda-se não ultrapassar 1-3% do saldo em cada operação.
          <br />
          * A planilha acima demonstra o crescimento com juros compostos diários de 15%.
          <br />
          * O limite de perda é calculado como 7% do saldo de cada dia.
        </div>
      </CardContent>
    </Card>
  );
}