import React, { useState, useEffect } from 'react';
import { ArrowUpIcon, ArrowDownIcon, InfoIcon, AlertTriangleIcon, CheckCircleIcon, XCircleIcon, BarChartIcon } from 'lucide-react';
import { getStrategyById } from '@/lib/strategiesConfig';
import { useTranslation } from 'react-i18next';
import { oauthDirectService } from '@/services/oauthDirectService';

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
  // Novos campos para suportar as operações do serviço OAuth
  contract_id?: string | number;
  strategy?: string;
  symbol?: string;
  contract_type?: string;
  entry_value?: number;
  exit_value?: number;
  is_win?: boolean;
  entry_spot?: number | string;
  exit_spot?: number | string;
  entry_time?: number;
  exit_time?: number;
  duration?: number;
  barrier?: string | number;
  payout?: number;
  timestamp?: number;
}

interface RelatorioOperacoesProps {
  operations: Operation[];
  selectedStrategy?: string;
  useDirectService?: boolean; // Flag para usar o serviço direto OAuth para operações
}

export function RelatorioOperacoes({ operations, selectedStrategy, useDirectService = false }: RelatorioOperacoesProps) {
  const { t, i18n } = useTranslation();
  
  // Estado para armazenar estatísticas do bot
  const [botStats, setBotStats] = useState<{wins: number, losses: number, totalProfit: number}>({
    wins: 0,
    losses: 0,
    totalProfit: 0
  });
  
  // Obter estatísticas atualizadas ao carregar o componente ou quando as operações mudarem
  useEffect(() => {
    if (useDirectService) {
      try {
        // Obter estatísticas do serviço OAuth
        const stats = oauthDirectService.getStats();
        console.log('[RELATORIO] Estatísticas obtidas do serviço OAuth:', stats);
        
        // Garantir que as estatísticas não sejam indefinidas
        const safeStats = {
          wins: typeof stats.wins === 'number' ? stats.wins : 0,
          losses: typeof stats.losses === 'number' ? stats.losses : 0,
          totalProfit: typeof stats.totalProfit === 'number' ? stats.totalProfit : 0
        };
        
        setBotStats(safeStats);
      } catch (error) {
        console.error('[RELATORIO] Erro ao obter estatísticas do serviço OAuth:', error);
      }
    } else if (operations.length > 0) {
      // Calcular estatísticas com base nas operações normais
      const wins = operations.filter(op => op.profit > 0).length;
      const losses = operations.filter(op => op.profit < 0).length;
      const totalProfit = operations.reduce((total, op) => total + op.profit, 0);
      
      setBotStats({
        wins,
        losses,
        totalProfit
      });
    }
  }, [operations, useDirectService]);
  
  // Obter o idioma atual
  const currentLang = i18n.language;
  const locale = currentLang === 'en' ? 'en-US' : 'pt-BR';
  
  // Função para formatar valores monetários com base no idioma atual
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return '$0.00';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  // Função para formatar horário com base no idioma atual
  const formatTime = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return dateObj.toLocaleTimeString(locale, {
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
        {t('operations.strategy', 'Estratégia')}: <span className="font-bold text-indigo-400">{strategy.name}</span>
      </div>
    );
  };

  // Obter o comando atual da estratégia selecionada
  const strategyCommand = getStrategyCommand(selectedStrategy);

  // Filtrar operações intermediárias para não exibi-las
  const filteredOperations = operations.filter((op) => !op.isIntermediate);

  return (
    <div className="bg-[#13203a] rounded-lg shadow-lg p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{t('operations.history', 'Histórico de Operações')}</h3>
        {getStrategyDisplay()}
      </div>
      
      {/* Painel de estatísticas */}
      {(filteredOperations.length > 0 || useDirectService) && (
        <div className="bg-[#1e2d4d] rounded-md p-3 mb-4 flex flex-wrap justify-between items-center">
          <div className="flex items-center gap-2">
            <BarChartIcon className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-medium text-white">
              {t('operations.stats', 'Estatísticas')}
            </span>
          </div>
          
          <div className="flex gap-4 mt-2 sm:mt-0">
            <div className="text-center">
              <div className="text-xs text-gray-400">{t('operations.wins', 'Vitórias')}</div>
              <div className="text-base font-bold text-green-400">{botStats.wins}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-gray-400">{t('operations.losses', 'Derrotas')}</div>
              <div className="text-base font-bold text-red-400">{botStats.losses}</div>
            </div>
            
            <div className="text-center">
              <div className="text-xs text-gray-400">{t('operations.profit', 'Resultado')}</div>
              <div className={`text-base font-bold ${botStats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(botStats.totalProfit)}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="overflow-y-auto custom-scrollbar" style={{ maxHeight: '300px' }}>
        {filteredOperations.length > 0 ? (
          <div className="space-y-2">
            {filteredOperations.map((op) => (
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
                      {/* Comando específico da estratégia - usando estratégia específica da operação */}
                      <div className="text-xs text-yellow-400 font-medium mb-1">
                        {(() => {
                          // Tentar usar a estratégia específica da operação, se disponível
                          const strategyId = op.strategy || selectedStrategy;
                          if (!strategyId) return strategyCommand;
                          
                          // Personalizar o comando com base na estratégia da operação
                          return getStrategyCommand(strategyId);
                        })()}
                      </div>
                      
                      {/* Exibição especial para operações intermediárias da estratégia Advance */}
                      {op.isIntermediate && op.analysis ? (
                        <div className="mb-1">
                          <div className="flex items-center gap-1">
                            <InfoIcon className="w-5 h-5 text-blue-500" />
                            <span className="font-medium text-blue-400">
                              {t('operations.advanceAnalysis', 'Análise Advance')}
                            </span>
                            {op.entryValue !== undefined && (
                              <span className="text-xs text-gray-400 ml-2">
                                {t('operations.entryValue', 'Valor de entrada')}: <span className="text-yellow-400 font-semibold">{formatCurrency(op.entryValue)}</span>
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-300 mt-1 grid grid-cols-2 gap-x-2">
                            <span className="font-medium">{t('operations.digit0', 'Dígito 0')}: <span className="text-cyan-400">{op.analysis.digit0}%</span></span>
                            <span className="font-medium">{t('operations.digit1', 'Dígito 1')}: <span className="text-cyan-400">{op.analysis.digit1}%</span></span>
                            <span className="font-medium col-span-2">{t('operations.entryThreshold', 'Limite para entrada')}: <span className="text-yellow-400">{op.analysis.threshold}%</span></span>
                            <span className="font-medium col-span-2 mt-1">
                              {op.profit >= 0 
                                ? <span className="text-green-400">✓ {t('operations.conditionMet', 'Condição atendida')}</span> 
                                : <span className="text-amber-400">✗ {t('operations.conditionNotMet', 'Condição não atendida')}</span>}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 mb-1">
                            {op.profit > 0 || op.is_win ? (
                              <ArrowUpIcon className="w-5 h-5 text-green-500" />
                            ) : op.profit < 0 || (op.is_win === false) ? (
                              <ArrowDownIcon className="w-5 h-5 text-red-500" />
                            ) : (
                              <InfoIcon className="w-5 h-5 text-gray-500" />
                            )}
                            <span className={`font-medium ${
                              op.profit > 0 || op.is_win ? 'text-green-400' : 
                              op.profit < 0 || (op.is_win === false) ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {op.profit > 0 || op.is_win
                                ? t('operations.profit', 'Ganho:') 
                                : op.profit < 0 || (op.is_win === false)
                                  ? t('operations.loss', 'Perda:') 
                                  : t('operations.operation', 'Operação:')}
                            </span>
                            <span className={`font-bold ${
                              op.profit > 0 || op.is_win ? 'text-green-400' : 
                              op.profit < 0 || (op.is_win === false) ? 'text-red-400' : 'text-gray-400'
                            }`}>
                              {formatCurrency(Math.abs(op.profit))}
                            </span>
                            
                            {/* Exibir símbolo e tipo de contrato se disponíveis (novo formato) */}
                            {op.symbol && (
                              <span className="ml-1 text-xs text-blue-400 bg-blue-950 px-2 py-0.5 rounded">
                                {op.symbol}
                              </span>
                            )}
                            {op.contract_type && (
                              <span className="ml-1 text-xs text-purple-400 bg-purple-950 px-2 py-0.5 rounded">
                                {op.contract_type}
                              </span>
                            )}
                          </div>
                          
                          {/* Exibir ID do contrato sempre no topo para fácil referência */}
                          <div className="text-xs bg-[#1e2d4d] text-white px-2 py-1 rounded-sm mb-2 inline-block">
                            {t('operations.id', 'ID')}: <span className="font-semibold">{op.contract_id || op.id}</span>
                          </div>
                          
                          {/* Exibir dados de entrada/saída em grade melhorada */}
                          <div className="text-xs text-gray-300 grid grid-cols-2 gap-x-4 gap-y-1 mb-1 bg-[#1d2a45] p-2 rounded">
                            {/* Valor de entrada - Mostrado com destaque */}
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-1">{t('operations.entry', 'Entrada')}:</span>
                              <span className="text-yellow-400 font-semibold">{
                                // Garantir que valores válidos sejam mostrados, maior que zero
                                op.entry_value !== undefined && op.entry_value > 0
                                  ? formatCurrency(op.entry_value)
                                  : op.entryValue !== undefined && op.entryValue > 0
                                    ? formatCurrency(op.entryValue)
                                    : formatCurrency(1) // Valor mínimo de entrada
                              }</span>
                            </div>
                            
                            {/* Valor de saída/resultado com formatação condicional */}
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-1">{t('operations.result', 'Resultado Final')}:</span>
                              <span className={`font-semibold ${op.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {(op.finalValue !== undefined || op.exit_value !== undefined) 
                                  ? formatCurrency(op.finalValue || op.exit_value)
                                  : formatCurrency(op.profit)}
                              </span>
                            </div>
                            
                            {/* Tipo de contrato sempre visível */}
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-1">{t('operations.contractType', 'Tipo')}:</span>
                              <span className="text-purple-400 font-semibold">{op.contract_type || '—'}</span>
                            </div>
                            
                            {/* Símbolo/Mercado sempre visível */}
                            <div className="flex items-center">
                              <span className="text-gray-400 mr-1">{t('operations.symbol', 'Símbolo')}:</span>
                              <span className="text-blue-400 font-semibold">{op.symbol || 'R_100'}</span>
                            </div>
                          </div>
                          
                          {/* Seção de especificações da estratégia */}
                          <div className="text-xs text-gray-400 bg-[#1d2a45] p-2 rounded mt-1">
                            <div className="flex items-center mb-1">
                              <span className="text-yellow-400 font-semibold">{t('operations.strategySpecs', 'Especificações da Estratégia')}:</span>
                            </div>
                            
                            {/* Nome da estratégia com destaque */}
                            <div className="ml-2">
                              <span className="text-gray-400 mr-1">{t('operations.strategyUsed', 'Estratégia')}:</span>
                              <span className="text-yellow-400 font-semibold">
                                {/* Melhorar exibição da estratégia - tentar exibir o nome real da estratégia */}
                                {(() => {
                                  const strategyId = op.strategy || selectedStrategy;
                                  if (!strategyId) return '—';
                                  
                                  // Obter informação real da estratégia
                                  const strategyInfo = getStrategyById(strategyId);
                                  return strategyInfo?.name || strategyId;
                                })()}
                              </span>
                            </div>
                            
                            {/* Comando da estratégia - específico por tipo */}
                            <div className="ml-2 mt-1">
                              <span className="text-gray-400 mr-1">{t('operations.command', 'Comando')}:</span>
                              <span className="text-green-400 font-semibold">
                                {(() => {
                                  // Tentar usar a estratégia específica da operação, se disponível
                                  const strategyId = op.strategy || selectedStrategy;
                                  if (!strategyId) return strategyCommand;
                                  
                                  // Personalizar o comando com base na estratégia da operação
                                  return getStrategyCommand(strategyId);
                                })()}
                              </span>
                            </div>
                          </div>
                          
                          {/* Informações adicionais para contratos do formato novo */}
                          {useDirectService && op.entry_spot && op.exit_spot && (
                            <div className="text-xs text-gray-400 mt-1 grid grid-cols-2 gap-x-4 bg-[#1d2a45] p-2 rounded">
                              <span>{t('operations.entrySpot', 'Spot Entrada')}: <span className="text-cyan-400 font-semibold">{op.entry_spot}</span></span>
                              <span>{t('operations.exitSpot', 'Spot Saída')}: <span className="text-cyan-400 font-semibold">{op.exit_spot}</span></span>
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
                
                {/* Horário da operação - suporta tanto formato antigo (time) quanto novo (timestamp) */}
                <div className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                  {formatTime(op.timestamp ? new Date(op.timestamp) : op.time)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-6 text-gray-500">
            <p>{t('operations.noOperations', 'Nenhuma operação registrada')}</p>
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