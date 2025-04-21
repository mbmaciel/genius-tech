import React from 'react';
import { ArrowUpIcon, ArrowDownIcon, InfoIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon } from 'lucide-react';
import { getStrategyById } from '@/lib/strategiesConfig';

// Interface para o tipo de operação
interface Operation {
  id: number | string;
  entryValue?: number;
  finalValue?: number;
  profit: number;
  time: Date;
  notification?: {
    type: 'success' | 'info' | 'warning' | 'error';
    message: string;
  };
  isIntermediate?: boolean; // Flag para operações intermediárias (análises sem entrada)
  analysis?: {
    digit0: number;
    digit1: number;
    threshold: number;
  };
}

interface RelatorioOperacoesProps {
  operations: Operation[];
  selectedStrategy?: string;
}

export function RelatorioOperacoes({ operations, selectedStrategy }: RelatorioOperacoesProps) {
  // Função para formatar valores monetários
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '$0.00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Função para formatar horário
  const formatTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('[RELATORIO] Erro ao formatar data:', error);
      return '--:--:--';
    }
  };

  // Função para obter o comando específico da estratégia
  const getStrategyCommand = (strategyId: string | undefined) => {
    if (!strategyId) return "Entrada";
    
    // Obter a estratégia completa para acessar configurações específicas
    const strategy = getStrategyById(strategyId);
    
    // Obter configurações do usuário para a estratégia
    const configObj = localStorage.getItem(`strategy_config_${strategyId}`);
    let userConfig: any = null;
    
    if (configObj) {
      try {
        userConfig = JSON.parse(configObj);
      } catch (err) {
        console.error("[RELATORIO] Erro ao carregar configuração do usuário:", err);
      }
    }
    
    // Verificar se temos configuração de parcelas martingale
    // IMPORTANTE: estratégias Iron Over e Iron Under NÃO usam parcelas martingale
    // Elas usam um conceito diferente de "martingale após X perdas"
    const isIronStrategy = strategyId.toLowerCase() === 'ironover' || strategyId.toLowerCase() === 'ironunder';
    
    const hasParcelasMartingale = 
      !isIronStrategy && 
      (userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel);
    
    // Mapeamento dos comandos específicos para cada estratégia
    switch (strategyId.toLowerCase()) {
      case 'advance':
        // Obter o valor da porcentagem específica para a estratégia Advance
        // SOMENTE usar a configuração do usuário, sem valor padrão
        // IMPORTANTE: NUNCA usar valores padrão (nem 70% nem 8%), SOMENTE valor do usuário
        let entryPercentage = userConfig?.porcentagemParaEntrar;
        
        if (entryPercentage === undefined || entryPercentage === null) {
          console.log("[RELATORIO] ALERTA: Valor de porcentagem não definido pelo usuário");
          
          // Se não tem configuração do usuário, mostrar mensagem clara
          let command = "CONFIGURAÇÃO PENDENTE";  
          return command;
        }
        
        // Garantir que estamos exibindo um valor numérico, não uma string
        const percentageValue = typeof entryPercentage === 'string' 
          ? parseFloat(entryPercentage) 
          : entryPercentage;
        
        console.log("[RELATORIO] Usando valor do usuário para porcentagem de entrada:", percentageValue);
        
        let command = `PORCENTAGEM PARA ENTRAR: ${percentageValue}%`;
        
        // Adicionar parcelas martingale se configurado
        if (hasParcelasMartingale) {
          const parcelas = userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel;
          command += ` | PARCELAS MARTINGALE: ${parcelas}`;
        }
        
        return command;
      case 'profitpro':
        return hasParcelasMartingale 
          ? `ENTRADA PROFIT PRO | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA PROFIT PRO";
      case 'manualunder':
        return hasParcelasMartingale 
          ? `ENTRADA MANUAL UNDER | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA MANUAL UNDER";
      case 'manualover':
        return hasParcelasMartingale 
          ? `ENTRADA MANUAL OVER | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA MANUAL OVER";
      case 'ironover':
        // Para Iron Over, adicionar apenas o parâmetro "Usar Martingale Após X Loss"
        // IMPORTANTE: IRON Over NÃO usa o conceito de "Parcelas Martingale"
        let ironOverCommand = "ENTRADA IRON OVER";
        
        // Adicionar APENAS informação sobre "USAR MARTINGALE APÓS X LOSS"
        if (userConfig?.usarMartingaleAposXLoss !== undefined) {
          ironOverCommand += ` | MULTIPLICAR APÓS: ${userConfig.usarMartingaleAposXLoss} LOSS`;
        }
        
        return ironOverCommand;
        
      case 'ironunder':
        // Para Iron Under, adicionar apenas o parâmetro "Usar Martingale Após X Loss" 
        // IMPORTANTE: IRON Under NÃO usa o conceito de "Parcelas Martingale"
        let ironUnderCommand = "ENTRADA IRON UNDER";
        
        // Adicionar APENAS informação sobre "USAR MARTINGALE APÓS X LOSS"
        if (userConfig?.usarMartingaleAposXLoss !== undefined) {
          ironUnderCommand += ` | MULTIPLICAR APÓS: ${userConfig.usarMartingaleAposXLoss} LOSS`;
        }
        
        return ironUnderCommand;
      case 'botlow':
        return hasParcelasMartingale 
          ? `ENTRADA BOT LOW | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA BOT LOW";
      case 'maxpro':
        return hasParcelasMartingale 
          ? `ENTRADA MAXPRO | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA MAXPRO";
      case 'green':
        return hasParcelasMartingale 
          ? `ENTRADA GREEN | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA GREEN";
      case 'wisetendencia':
        return hasParcelasMartingale 
          ? `ENTRADA TENDÊNCIA | PARCELAS MARTINGALE: ${userConfig?.parcelasMartingale || strategy?.config?.maxMartingaleLevel}`
          : "ENTRADA TENDÊNCIA";
      default:
        return "Entrada";
    }
  };

  // Função para obter o ícone com base no tipo de notificação
  const getNotificationIcon = (type: 'success' | 'info' | 'warning' | 'error') => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'info':
        return <InfoIcon className="w-5 h-5 text-blue-500" />;
      case 'warning':
        return <AlertTriangleIcon className="w-5 h-5 text-amber-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return <InfoIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  // Função para obter a estratégia formatada, se disponível
  const getStrategyDisplay = () => {
    if (!selectedStrategy) return null;
    
    const strategy = getStrategyById(selectedStrategy);
    if (!strategy) return null;
    
    return (
      <div className="text-sm text-gray-400 mb-2">
        Estratégia: <span className="font-bold text-indigo-400">{strategy.name}</span>
      </div>
    );
  };

  // Obter o comando atual da estratégia selecionada
  const strategyCommand = getStrategyCommand(selectedStrategy);

  return (
    <div className="bg-[#13203a] rounded-lg shadow-lg p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Histórico de Operações</h3>
        {getStrategyDisplay()}
      </div>
      
      <div className="overflow-y-auto custom-scrollbar h-[calc(100%-2.5rem)]" style={{ maxHeight: '350px' }}>
        {operations.length > 0 ? (
          <div className="space-y-2">
            {operations.map((op) => (
              <div 
                key={op.id} 
                className={`p-3 rounded-md flex items-start justify-between ${
                  op.notification 
                    ? 'bg-[#1d2a45] border-l-4 border-opacity-80 ' + 
                      (op.notification.type === 'success' ? 'border-green-500' : 
                       op.notification.type === 'info' ? 'border-blue-500' : 
                       op.notification.type === 'warning' ? 'border-amber-500' : 'border-red-500')
                    : op.profit > 0 
                      ? 'bg-[#1a2e38] border-l-4 border-green-500 border-opacity-70' 
                      : op.profit < 0 
                        ? 'bg-[#2e1a1a] border-l-4 border-red-500 border-opacity-70' 
                        : 'bg-[#1d2a45]'
                }`}
              >
                {/* Informações principais */}
                <div className="flex-1">
                  {/* Mensagem de notificação, se existir */}
                  {op.notification && (
                    <div className="flex items-center mb-1 gap-2">
                      {getNotificationIcon(op.notification.type)}
                      <p className={`text-sm ${
                        op.notification.type === 'success' ? 'text-green-400' : 
                        op.notification.type === 'info' ? 'text-blue-400' : 
                        op.notification.type === 'warning' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {op.notification.message}
                      </p>
                    </div>
                  )}
                  
                  {/* Detalhes da operação, se for uma operação completa ou intermediária */}
                  {!op.notification && (
                    <>
                      {/* Comando específico da estratégia */}
                      <div className="text-xs text-yellow-400 font-medium mb-1">
                        {strategyCommand}
                      </div>
                      
                      {/* Exibição especial para operações intermediárias da estratégia Advance */}
                      {op.isIntermediate && op.analysis ? (
                        <div className="mb-1">
                          <div className="flex items-center gap-1">
                            <InfoIcon className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-blue-400">
                              Análise Advance
                            </span>
                          </div>
                          <div className="text-xs text-gray-300 mt-1 grid grid-cols-2 gap-x-2">
                            <span className="font-medium">Dígito 0: <span className="text-cyan-400">{op.analysis.digit0}%</span></span>
                            <span className="font-medium">Dígito 1: <span className="text-cyan-400">{op.analysis.digit1}%</span></span>
                            <span className="font-medium col-span-2">Limite para entrada: <span className="text-yellow-400">{op.analysis.threshold}%</span></span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 mb-1">
                            {op.profit > 0 ? (
                              <ArrowUpIcon className="w-5 h-5 text-green-500" />
                            ) : op.profit < 0 ? (
                              <ArrowDownIcon className="w-5 h-5 text-red-500" />
                            ) : (
                              <InfoIcon className="w-5 h-5 text-gray-500" />
                            )}
                            <span className={`font-medium ${
                              op.profit > 0 ? 'text-green-400' : 
                              op.profit < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {op.profit > 0 ? 'Ganho:' : op.profit < 0 ? 'Perda:' : 'Operação:'}
                            </span>
                            <span className={`font-bold ${
                              op.profit > 0 ? 'text-green-400' : 
                              op.profit < 0 ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {formatCurrency(Math.abs(op.profit))}
                            </span>
                          </div>
                          
                          {op.entryValue !== undefined && op.finalValue !== undefined && (
                            <div className="text-xs text-gray-400 grid grid-cols-2 gap-x-4">
                              <span>Entrada: {formatCurrency(op.entryValue)}</span>
                              <span>Saída: {formatCurrency(op.finalValue)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
                
                {/* Horário da operação */}
                <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                  {formatTime(op.time)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-gray-500">
            <p>Nenhuma operação registrada</p>
          </div>
        )}
      </div>
      
      {/* Estilização personalizada para a barra de rolagem */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #13203a;
          border-radius: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #2a3f5f;
          border-radius: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #3e5279;
        }
      `}} />
    </div>
  );
}