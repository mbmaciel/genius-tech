/**
 * Página de Gestão Operacional para configuração de parâmetros de operação
 */
import { GestaoOperacional } from "@/components/GestaoOperacional";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function GestaoOperacionalPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold text-white">Gestão Operacional</h1>
        <Link href="/dashboard">
          <Button className="bg-[#1d2a45] hover:bg-[#2a3756] text-white">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Dashboard
          </Button>
        </Link>
      </div>
      <p className="text-slate-400 mb-6">
        Configure parâmetros operacionais, defina limites e acompanhe métricas de desempenho
      </p>
      
      <Separator className="my-4 bg-slate-800" />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GestaoOperacional />
        </div>
        
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-white mb-3">Dicas de Gestão de Risco</h3>
            <ul className="space-y-2 text-slate-300">
              <li className="flex items-start">
                <span className="inline-block bg-blue-500 rounded-full w-1.5 h-1.5 mt-2 mr-2"></span>
                <span>Nunca arrisque mais do que 1-3% do seu capital por operação.</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-500 rounded-full w-1.5 h-1.5 mt-2 mr-2"></span>
                <span>Estabeleça metas diárias realistas de 5-10% do capital.</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-500 rounded-full w-1.5 h-1.5 mt-2 mr-2"></span>
                <span>Defina um limite de perda diário (stop loss) e respeite-o.</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-500 rounded-full w-1.5 h-1.5 mt-2 mr-2"></span>
                <span>Utilize a estratégia de Martingale com cautela, limitando a 3 entradas.</span>
              </li>
              <li className="flex items-start">
                <span className="inline-block bg-blue-500 rounded-full w-1.5 h-1.5 mt-2 mr-2"></span>
                <span>Divida seu capital em sessões operacionais independentes.</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg shadow-md">
            <h3 className="text-lg font-medium text-white mb-3">Glossário</h3>
            <dl className="space-y-2">
              <dt className="text-blue-400 font-medium">Meta de Lucro</dt>
              <dd className="text-slate-400 text-sm mb-2">Objetivo de ganho a ser alcançado antes de encerrar as operações.</dd>
              
              <dt className="text-red-400 font-medium">Stop Loss</dt>
              <dd className="text-slate-400 text-sm mb-2">Limite máximo de perda aceitável antes de parar de operar.</dd>
              
              <dt className="text-slate-300 font-medium">Valor de Aposta</dt>
              <dd className="text-slate-400 text-sm mb-2">Quantia a ser investida em cada operação, normalmente um percentual do capital total.</dd>
              
              <dt className="text-yellow-400 font-medium">Lucro Projetado</dt>
              <dd className="text-slate-400 text-sm">Estimativa de ganho considerando a taxa de acerto média das operações.</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}