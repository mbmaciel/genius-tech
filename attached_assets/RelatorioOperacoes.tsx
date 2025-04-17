import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AlertCircle, Download, Filter, Loader2 } from "lucide-react";
import derivAPI from "@/lib/derivApi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Operacao {
  id: string;
  data: Date;
  tipo: string;
  simbolo: string;
  entrada: number;
  resultado: number;
  status: "ganho" | "perda" | "empate";
  duracao: string;
}

export interface RelatorioOperacoesRef {
  atualizarDados: () => Promise<void>;
}

export const RelatorioOperacoes = forwardRef<RelatorioOperacoesRef>((props, ref) => {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totais, setTotais] = useState({
    ganhos: 0,
    perdas: 0,
    operacoes: 0,
    lucroTotal: 0,
    taxaAcerto: 0,
  });
  
  // Função que será exposta via ref
  const buscarHistoricoOperacoes = async () => {
    try {
      setIsLoading(true);
      setError(null);
    
      if (!derivAPI.getConnectionStatus()) {
        setError("É necessário conectar-se à API Deriv para visualizar os dados");
        setIsLoading(false);
        return;
      }
      
      // Obter data de 24 horas atrás em timestamp Unix
      const dataInicio = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
      
      // Obter o extrato da conta para as últimas 24 horas
      const statement = await derivAPI.getStatement({
        limit: 100,
        date_from: dataInicio.toString(),
        offset: 0
      });
      
      console.log("Dados do extrato da conta:", statement);
      
      if (statement?.statement?.transactions) {
        // Usar dados do extrato
        const operacoesData: Operacao[] = statement.statement.transactions
          .filter((tx: any) => tx.action === "buy" || tx.action === "sell")
          .map((tx: any) => {
            // Determinar status da operação
            let status: "ganho" | "perda" | "empate" = "empate";
            
            if (tx.amount > 0 && tx.action === "sell") {
              status = "ganho";
            } else if (tx.amount < 0 || (tx.action === "buy" && tx.amount < 0)) {
              status = "perda";
            }
            
            // Calcular duração da operação se ambas datas estiverem disponíveis
            const inicio = new Date(tx.transaction_time * 1000);
            const fim = tx.transaction_time_close ? new Date(tx.transaction_time_close * 1000) : inicio;
            const diferencaMs = fim.getTime() - inicio.getTime();
            const segundos = Math.floor(diferencaMs / 1000);
            const minutos = Math.floor(segundos / 60);
            const segundosRestantes = segundos % 60;
            const duracaoStr = `${minutos}m ${segundosRestantes}s`;
            
            return {
              id: tx.transaction_id.toString(),
              data: new Date(tx.transaction_time * 1000),
              tipo: tx.display_name || tx.action_type || "Desconhecido",
              simbolo: tx.symbol || "Desconhecido",
              entrada: Math.abs(tx.action === "buy" ? tx.amount : 0),
              resultado: tx.action === "sell" ? tx.amount : 0,
              status,
              duracao: duracaoStr
            };
          });
          
        // Ordenar por data, mais recentes primeiro
        operacoesData.sort((a, b) => b.data.getTime() - a.data.getTime());
        
        setOperacoes(operacoesData);
        
        // Calcular totais
        const ganhos = operacoesData.filter(op => op.status === "ganho").length;
        const perdas = operacoesData.filter(op => op.status === "perda").length;
        const totalOperacoes = operacoesData.length;
        const lucroTotal = operacoesData.reduce((sum, op) => sum + op.resultado, 0);
        const taxaAcerto = totalOperacoes > 0 ? (ganhos / totalOperacoes) * 100 : 0;
        
        setTotais({
          ganhos,
          perdas,
          operacoes: totalOperacoes,
          lucroTotal,
          taxaAcerto
        });
      } else {
        // Fallback para profit_table se o statement não retornar dados suficientes
        const profitTable = await derivAPI.getProfitTable({
          limit: 100,
          date_from: dataInicio.toString(),
          offset: 0
        });
        
        console.log("Dados da tabela de lucro/perda:", profitTable);
        
        if (profitTable?.profit_table?.transactions) {
          const operacoesData: Operacao[] = profitTable.profit_table.transactions
            .filter((tx: any) => tx.action_type === "buy" || tx.action_type === "sell")
            .map((tx: any) => {
              // Determinar status da operação
              let status: "ganho" | "perda" | "empate" = "empate";
              
              if (tx.profit > 0) {
                status = "ganho";
              } else if (tx.profit < 0) {
                status = "perda";
              }
              
              // Calcular duração da operação
              const inicio = new Date(tx.transaction_time * 1000);
              const fim = tx.sell_time ? new Date(tx.sell_time * 1000) : inicio;
              const diferencaMs = fim.getTime() - inicio.getTime();
              const segundos = Math.floor(diferencaMs / 1000);
              const minutos = Math.floor(segundos / 60);
              const segundosRestantes = segundos % 60;
              const duracaoStr = `${minutos}m ${segundosRestantes}s`;
              
              return {
                id: tx.transaction_id.toString(),
                data: new Date(tx.transaction_time * 1000),
                tipo: tx.contract_type || "Desconhecido",
                simbolo: tx.shortcode ? tx.shortcode.split('_')[0] : "Desconhecido",
                entrada: Math.abs(tx.buy_price),
                resultado: tx.profit,
                status,
                duracao: duracaoStr
              };
            });
            
          // Ordenar por data, mais recentes primeiro
          operacoesData.sort((a, b) => b.data.getTime() - a.data.getTime());
          
          setOperacoes(operacoesData);
          
          // Calcular totais
          const ganhos = operacoesData.filter(op => op.status === "ganho").length;
          const perdas = operacoesData.filter(op => op.status === "perda").length;
          const totalOperacoes = operacoesData.length;
          const lucroTotal = operacoesData.reduce((sum, op) => sum + op.resultado, 0);
          const taxaAcerto = totalOperacoes > 0 ? (ganhos / totalOperacoes) * 100 : 0;
          
          setTotais({
            ganhos,
            perdas,
            operacoes: totalOperacoes,
            lucroTotal,
            taxaAcerto
          });
        } else {
          setOperacoes([]);
          setTotais({
            ganhos: 0,
            perdas: 0,
            operacoes: 0,
            lucroTotal: 0,
            taxaAcerto: 0
          });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar histórico de operações:", error);
      setError("Ocorreu um erro ao buscar o histórico de operações");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Expor função de atualização via ref
  useImperativeHandle(ref, () => ({
    atualizarDados: buscarHistoricoOperacoes
  }));
  
  useEffect(() => {
    buscarHistoricoOperacoes();
  }, []);
  
  // Simulação de exportação para CSV/Excel
  const exportarRelatorio = () => {
    alert("Função de exportação será implementada nas próximas atualizações");
  };
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <Card className="flex-1 bg-[#162440] border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#8492b4]">Total de Operações</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totais.operacoes}</div>
            <p className="text-xs text-[#8492b4] mt-1">Últimas 24 horas</p>
          </CardContent>
        </Card>
        
        <Card className="flex-1 bg-[#162440] border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#8492b4]">Taxa de Acerto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totais.taxaAcerto.toFixed(1)}%</div>
            <p className="text-xs text-[#8492b4] mt-1">
              {totais.ganhos} ganhos / {totais.perdas} perdas
            </p>
          </CardContent>
        </Card>
        
        <Card className="flex-1 bg-[#162440] border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[#8492b4]">Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totais.lucroTotal >= 0 ? 'text-[#00e5b3]' : 'text-red-500'}`}>
              ${totais.lucroTotal.toFixed(2)}
            </div>
            <p className="text-xs text-[#8492b4] mt-1">Lucro/Perda total</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Histórico Detalhado</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs border-slate-700">
            <Filter className="h-3 w-3 mr-1" />
            Filtrar
          </Button>
          <Button variant="outline" size="sm" className="text-xs border-slate-700" onClick={exportarRelatorio}>
            <Download className="h-3 w-3 mr-1" />
            Exportar
          </Button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[#00e5b3]" />
        </div>
      ) : error ? (
        <Card className="bg-[#162440] border-slate-800">
          <CardContent className="pt-6">
            <div className="flex items-center text-amber-500">
              <AlertCircle className="h-4 w-4 mr-2" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : operacoes.length === 0 ? (
        <Card className="bg-[#162440] border-slate-800">
          <CardContent className="py-8 text-center">
            <p className="text-[#8492b4]">Nenhuma operação encontrada nas últimas 24 horas.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-[#162440] border-slate-800 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1a2b49] hover:bg-[#1a2b49] border-none">
                    <TableHead className="text-[#8492b4] font-medium">Data/Hora</TableHead>
                    <TableHead className="text-[#8492b4] font-medium">Tipo</TableHead>
                    <TableHead className="text-[#8492b4] font-medium">Símbolo</TableHead>
                    <TableHead className="text-[#8492b4] font-medium text-right">Entrada</TableHead>
                    <TableHead className="text-[#8492b4] font-medium text-right">Resultado</TableHead>
                    <TableHead className="text-[#8492b4] font-medium">Duração</TableHead>
                    <TableHead className="text-[#8492b4] font-medium">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operacoes.map((op) => (
                    <TableRow key={op.id} className="border-b border-slate-800 hover:bg-[#1a2b49]/50">
                      <TableCell className="text-sm">
                        {format(op.data, "dd/MM HH:mm:ss")}
                      </TableCell>
                      <TableCell className="text-sm">{op.tipo}</TableCell>
                      <TableCell className="text-sm">{op.simbolo}</TableCell>
                      <TableCell className="text-sm text-right">${op.entrada.toFixed(2)}</TableCell>
                      <TableCell className={`text-sm font-medium text-right ${
                        op.resultado > 0 ? 'text-[#00e5b3]' : 
                        op.resultado < 0 ? 'text-red-500' : 'text-[#8492b4]'
                      }`}>
                        {op.resultado >= 0 ? '+' : ''}{op.resultado.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm">{op.duracao}</TableCell>
                      <TableCell>
                        <Badge className={`
                          text-xs font-normal
                          ${op.status === 'ganho' 
                            ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' 
                            : op.status === 'perda' 
                              ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' 
                              : 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30'
                          }
                        `}>
                          {op.status === 'ganho' ? 'Ganho' : op.status === 'perda' ? 'Perda' : 'Empate'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});