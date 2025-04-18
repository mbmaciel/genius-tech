import React from 'react';
import { Progress } from "@/components/ui/progress";
import { BotStatus } from '../services/botService';
import { Loader2 } from 'lucide-react';

interface OperationStatusProps {
  status: BotStatus;
  operation: {
    entry: number;
    buyPrice: number;
    profit: number;
    status: string | null;
  };
  stats: {
    wins: number;
    losses: number;
  };
  balanceInfo: {
    balance: number;
    currency: string;
    previousBalance?: number;
    change?: number;
  };
}

export function OperationStatus({ 
  status, 
  operation, 
  stats, 
  balanceInfo 
}: OperationStatusProps) {
  // Determinar porcentagem de progresso com base no resultado atual
  const calculateWinRate = () => {
    const total = stats.wins + stats.losses;
    if (total === 0) return 0;
    return (stats.wins / total) * 100;
  };

  // Calcular lucro líquido
  const netProfit = operation.profit - operation.buyPrice;
  
  // Calcular porcentagem de lucro/perda
  const profitPercentage = operation.buyPrice ? (netProfit / operation.buyPrice) * 100 : 0;
  
  // Determinar cores de status
  const getStatusColor = () => {
    if (status === 'running') return 'text-green-500';
    if (status === 'paused') return 'text-yellow-500';
    if (status === 'error') return 'text-red-500';
    return 'text-gray-400';
  };
  
  return (
    <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <div className={`w-3 h-3 rounded-full mr-2 ${
            status === 'running' ? 'bg-green-500 animate-pulse' : 
            status === 'paused' ? 'bg-yellow-500' : 
            status === 'error' ? 'bg-red-500' : 'bg-gray-500'
          }`}></div>
          <h2 className={`text-lg font-medium ${getStatusColor()}`}>
            {status === 'running' && 'Bot em Execução'}
            {status === 'paused' && 'Bot Pausado'}
            {status === 'idle' && 'Bot Parado'}
            {status === 'error' && 'Erro no Bot'}
          </h2>
        </div>
        
        {status === 'running' && (
          <div className="flex items-center text-white">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm">Processando...</span>
          </div>
        )}
      </div>
      
      {/* Estatísticas das operações */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-[#1d2a45] rounded p-4">
          <div className="text-sm text-gray-400 mb-1">Ganhos</div>
          <div className="text-xl font-bold text-green-500">{stats.wins}</div>
        </div>
        
        <div className="bg-[#1d2a45] rounded p-4">
          <div className="text-sm text-gray-400 mb-1">Perdas</div>
          <div className="text-xl font-bold text-red-500">{stats.losses}</div>
        </div>
      </div>
      
      {/* Taxa de ganho - Progressão visual */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Taxa de Ganho</span>
          <span className="text-sm text-white font-medium">
            {calculateWinRate().toFixed(0)}%
          </span>
        </div>
        <Progress 
          value={calculateWinRate()} 
          className="h-2 bg-[#1d2a45]" 
        />
      </div>
      
      {/* Detalhes da operação atual */}
      {operation.status && (
        <div className="bg-[#1d2a45] rounded-md overflow-hidden mb-4">
          <div className="bg-[#2a3756] text-sm text-white font-medium p-3">
            {operation.status === 'comprado' ? 'Contrato em Andamento' : 'Resultado da Operação'}
          </div>
          
          <div className="p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Entrada</span>
              <span className="text-white">{operation.entry.toFixed(2)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Preço de Compra</span>
              <span className="text-white">{operation.buyPrice.toFixed(2)} {balanceInfo.currency}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-400">Lucro/Perda</span>
              <span className={`font-medium ${netProfit > 0 ? 'text-green-500' : netProfit < 0 ? 'text-red-500' : 'text-white'}`}>
                {netProfit.toFixed(2)} {balanceInfo.currency} ({netProfit > 0 ? '+' : ''}{profitPercentage.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Resumo do saldo */}
      <div className="bg-[#1d2a45] rounded-md p-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Saldo Atual</span>
          <span className={`text-lg font-bold ${
            balanceInfo.change && balanceInfo.change > 0 
            ? 'text-green-500' 
            : balanceInfo.change && balanceInfo.change < 0 
            ? 'text-red-500' 
            : 'text-white'
          }`}>
            {new Intl.NumberFormat('pt-BR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            }).format(balanceInfo.balance)} {balanceInfo.currency}
            
            {balanceInfo.change && (
              <span className="text-xs ml-1">
                ({balanceInfo.change > 0 ? '+' : ''}
                {new Intl.NumberFormat('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(balanceInfo.change)})
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}