import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  ArrowUpDown, 
  Download, 
  X, 
  Check, 
  Clock, 
  Search,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Interface para operações
export interface Operation {
  id: string | number;
  contract_id: string | number;
  entry_value: number;
  exit_value?: number;
  profit?: number;
  time: Date;
  timestamp: number;
  contract_type: string;
  symbol: string;
  strategy: string;
  is_win?: boolean;
  is_completed?: boolean;
  notification?: {
    type: 'error' | 'success' | 'info' | 'warning';
    message: string;
  };
}

interface OperationHistoryCardProps {
  operations: Operation[];
  onUpdate?: (operations: Operation[]) => void;
}

export const OperationHistoryCard: React.FC<OperationHistoryCardProps> = ({ 
  operations = [],
  onUpdate 
}) => {
  const { t, i18n } = useTranslation();
  const [sortColumn, setSortColumn] = useState<string>('time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSymbol, setFilterSymbol] = useState<string>('all');
  const [filterStrategy, setFilterStrategy] = useState<string>('all');
  const [selectedOperation, setSelectedOperation] = useState<Operation | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const locale = i18n.language === 'pt' ? ptBR : enUS;

  // Calcular estatísticas
  const stats = React.useMemo(() => {
    const completed = operations.filter(op => op.is_completed);
    const wins = completed.filter(op => op.is_win);
    const losses = completed.filter(op => op.is_win === false);
    
    const totalProfit = completed.reduce((sum, op) => sum + (op.profit || 0), 0);
    const winsProfit = wins.reduce((sum, op) => sum + (op.profit || 0), 0);
    const lossesLoss = losses.reduce((sum, op) => sum + (op.profit || 0), 0);
    
    return {
      total: operations.length,
      completed: completed.length,
      wins: wins.length,
      losses: losses.length,
      winRate: completed.length ? (wins.length / completed.length) * 100 : 0,
      totalProfit,
      winsProfit,
      lossesLoss,
    };
  }, [operations]);

  // Lista de símbolos únicos
  const uniqueSymbols = React.useMemo(() => {
    return Array.from(new Set(operations.map(op => op.symbol)));
  }, [operations]);

  // Lista de estratégias únicas
  const uniqueStrategies = React.useMemo(() => {
    return Array.from(new Set(operations.map(op => op.strategy)));
  }, [operations]);

  // Ordenar operações
  const sortedOperations = React.useMemo(() => {
    return [...operations].sort((a, b) => {
      if (sortColumn === 'time') {
        return sortDirection === 'asc' 
          ? a.timestamp - b.timestamp 
          : b.timestamp - a.timestamp;
      }
      if (sortColumn === 'profit') {
        const profitA = a.profit || 0;
        const profitB = b.profit || 0;
        return sortDirection === 'asc' ? profitA - profitB : profitB - profitA;
      }
      return 0;
    });
  }, [operations, sortColumn, sortDirection]);

  // Filtrar operações
  const filteredOperations = React.useMemo(() => {
    return sortedOperations.filter(op => {
      // Filtro de busca
      const searchMatch = searchTerm === '' || 
        op.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.strategy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.contract_id.toString().includes(searchTerm);
      
      // Filtro de status
      let statusMatch = true;
      if (filterStatus === 'completed') {
        statusMatch = !!op.is_completed;
      } else if (filterStatus === 'pending') {
        statusMatch = !op.is_completed;
      } else if (filterStatus === 'win') {
        statusMatch = !!op.is_win;
      } else if (filterStatus === 'loss') {
        statusMatch = op.is_win === false;
      }
      
      // Filtro de símbolo
      const symbolMatch = filterSymbol === 'all' || op.symbol === filterSymbol;
      
      // Filtro de estratégia
      const strategyMatch = filterStrategy === 'all' || op.strategy === filterStrategy;
      
      return searchMatch && statusMatch && symbolMatch && strategyMatch;
    });
  }, [sortedOperations, searchTerm, filterStatus, filterSymbol, filterStrategy]);

  // Paginação
  const paginatedOperations = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredOperations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredOperations, currentPage]);

  const totalPages = Math.ceil(filteredOperations.length / itemsPerPage);

  // Mudar ordenação
  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Exportar para CSV
  const exportToCSV = () => {
    if (filteredOperations.length === 0) return;
    
    const headers = [
      'ID', 
      'Contract ID', 
      'Symbol', 
      'Strategy', 
      'Type', 
      'Entry', 
      'Exit', 
      'Profit', 
      'Result', 
      'Time'
    ].join(',');
    
    const rows = filteredOperations.map(op => [
      op.id,
      op.contract_id,
      op.symbol,
      op.strategy,
      op.contract_type,
      op.entry_value,
      op.exit_value || '',
      op.profit || '',
      op.is_win === undefined ? 'Pending' : op.is_win ? 'Win' : 'Loss',
      format(op.time, 'yyyy-MM-dd HH:mm:ss')
    ].join(','));
    
    const csv = [headers, ...rows].join('\\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `operations-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Formatar valor com 2 casas decimais
  const formatValue = (value: number | undefined) => {
    if (value === undefined) return '-';
    return value.toFixed(2);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Histórico de Operações')}</CardTitle>
        <CardDescription>
          {t('Total')}: {stats.total} | 
          {t('Completas')}: {stats.completed} | 
          {t('Ganhos')}: {stats.wins} | 
          {t('Perdas')}: {stats.losses} | 
          {t('Taxa de Vitória')}: {stats.winRate.toFixed(1)}% | 
          {t('Lucro Total')}: {stats.totalProfit.toFixed(2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <Input 
            placeholder={t('Buscar por símbolo, estratégia ou ID...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-1/3"
          />
          
          <Select 
            value={filterStatus} 
            onValueChange={setFilterStatus}
          >
            <SelectTrigger className="w-full md:w-1/6">
              <SelectValue placeholder={t('Status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('Todos')}</SelectItem>
              <SelectItem value="completed">{t('Completos')}</SelectItem>
              <SelectItem value="pending">{t('Pendentes')}</SelectItem>
              <SelectItem value="win">{t('Ganhos')}</SelectItem>
              <SelectItem value="loss">{t('Perdas')}</SelectItem>
            </SelectContent>
          </Select>
          
          <Select 
            value={filterSymbol} 
            onValueChange={setFilterSymbol}
          >
            <SelectTrigger className="w-full md:w-1/6">
              <SelectValue placeholder={t('Símbolo')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('Todos')}</SelectItem>
              {uniqueSymbols.map(symbol => (
                <SelectItem key={symbol} value={symbol}>{symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select 
            value={filterStrategy} 
            onValueChange={setFilterStrategy}
          >
            <SelectTrigger className="w-full md:w-1/6">
              <SelectValue placeholder={t('Estratégia')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('Todas')}</SelectItem>
              {uniqueStrategies.map(strategy => (
                <SelectItem key={strategy} value={strategy}>{strategy}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            onClick={exportToCSV}
            disabled={filteredOperations.length === 0}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            {t('Exportar')}
          </Button>
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">
                  <Button variant="ghost" onClick={() => toggleSort('time')} className="p-0 h-auto">
                    {t('Data/Hora')}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>{t('ID')}</TableHead>
                <TableHead>{t('Símbolo')}</TableHead>
                <TableHead>{t('Estratégia')}</TableHead>
                <TableHead>{t('Tipo')}</TableHead>
                <TableHead>{t('Entrada')}</TableHead>
                <TableHead>{t('Saída')}</TableHead>
                <TableHead>
                  <Button variant="ghost" onClick={() => toggleSort('profit')} className="p-0 h-auto">
                    {t('Lucro')}
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>{t('Status')}</TableHead>
                <TableHead>{t('Ações')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedOperations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center h-24">
                    {t('Nenhuma operação encontrada')}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOperations.map((operation) => (
                  <TableRow key={operation.id}>
                    <TableCell className="font-medium">
                      {format(operation.time, 'dd/MM/yy HH:mm:ss', { locale })}
                    </TableCell>
                    <TableCell>{operation.contract_id}</TableCell>
                    <TableCell>{operation.symbol}</TableCell>
                    <TableCell>{operation.strategy}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {operation.contract_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatValue(operation.entry_value)}</TableCell>
                    <TableCell>{formatValue(operation.exit_value)}</TableCell>
                    <TableCell>
                      {operation.profit !== undefined && (
                        <span className={operation.profit >= 0 ? 'text-green-500' : 'text-red-500'}>
                          {operation.profit >= 0 ? '+' : ''}{formatValue(operation.profit)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {operation.is_completed ? (
                        operation.is_win ? (
                          <Badge className="bg-green-500/10 text-green-500">
                            <Check className="h-3 w-3 mr-1" /> {t('Ganho')}
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/10 text-red-500">
                            <X className="h-3 w-3 mr-1" /> {t('Perda')}
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <Clock className="h-3 w-3 mr-1" /> {t('Pendente')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setSelectedOperation(operation)}
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-muted-foreground">
              {t('Mostrando')} {(currentPage - 1) * itemsPerPage + 1}-
              {Math.min(currentPage * itemsPerPage, filteredOperations.length)} {t('de')} {filteredOperations.length}
            </div>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                {t('Anterior')}
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => 
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 1 && page <= currentPage + 1)
                )
                .map((page, i, array) => (
                  <React.Fragment key={page}>
                    {i > 0 && array[i - 1] !== page - 1 && (
                      <Button variant="outline" size="sm" disabled>...</Button>
                    )}
                    <Button
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  </React.Fragment>
                ))
              }
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                {t('Próximo')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal de detalhes da operação */}
      <Dialog open={!!selectedOperation} onOpenChange={(open) => !open && setSelectedOperation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Detalhes da Operação')}</DialogTitle>
            <DialogDescription>
              {t('ID do Contrato')}: {selectedOperation?.contract_id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOperation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium">{t('Data/Hora')}:</p>
                  <p className="text-sm">
                    {format(selectedOperation.time, 'dd/MM/yyyy HH:mm:ss', { locale })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Símbolo')}:</p>
                  <p className="text-sm">{selectedOperation.symbol}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Estratégia')}:</p>
                  <p className="text-sm">{selectedOperation.strategy}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Tipo de Contrato')}:</p>
                  <p className="text-sm">{selectedOperation.contract_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Valor de Entrada')}:</p>
                  <p className="text-sm">{formatValue(selectedOperation.entry_value)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Valor de Saída')}:</p>
                  <p className="text-sm">
                    {selectedOperation.exit_value !== undefined 
                      ? formatValue(selectedOperation.exit_value) 
                      : t('Pendente')}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Lucro/Perda')}:</p>
                  {selectedOperation.profit !== undefined ? (
                    <p className={`text-sm ${selectedOperation.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {selectedOperation.profit >= 0 ? '+' : ''}{formatValue(selectedOperation.profit)}
                    </p>
                  ) : (
                    <p className="text-sm">{t('Pendente')}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{t('Status')}:</p>
                  <p className="text-sm">
                    {selectedOperation.is_completed
                      ? (selectedOperation.is_win 
                          ? <span className="text-green-500">{t('Ganho')}</span> 
                          : <span className="text-red-500">{t('Perda')}</span>)
                      : <span className="text-muted-foreground">{t('Pendente')}</span>}
                  </p>
                </div>
              </div>
              
              {selectedOperation.notification && (
                <div className={`p-3 rounded-md ${
                  selectedOperation.notification.type === 'success' ? 'bg-green-500/10' :
                  selectedOperation.notification.type === 'error' ? 'bg-red-500/10' :
                  selectedOperation.notification.type === 'warning' ? 'bg-yellow-500/10' :
                  'bg-blue-500/10'
                }`}>
                  <p className="text-sm">{selectedOperation.notification.message}</p>
                </div>
              )}
              
              <div className="flex justify-center">
                {selectedOperation.is_win !== undefined && (
                  <div className={`rounded-full p-6 ${
                    selectedOperation.is_win 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-red-500/20 text-red-500'
                  }`}>
                    {selectedOperation.is_win ? (
                      <TrendingUp className="h-10 w-10" />
                    ) : (
                      <TrendingDown className="h-10 w-10" />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setSelectedOperation(null)}
            >
              {t('Fechar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};