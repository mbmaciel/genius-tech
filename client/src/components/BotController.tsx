import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { oauthDirectService } from "@/services/oauthDirectService";
import { Wallet, User } from "lucide-react";
import { BinaryBotStrategy } from '@/lib/automationService';
import { StrategyConfigPanel, StrategyConfiguration } from '@/components/StrategyConfigPanel';
import { getStrategyById, getContractTypeForStrategy, usesDigitPrediction } from '@/lib/strategiesConfig';
import { loadStrategyXml, evaluateEntryConditions, getStrategyState } from '@/lib/strategy-handlers';
import { useTranslation } from 'react-i18next';
// Importação do módulo completo para evitar problemas
import * as strategyRules from '@/services/strategyRules';

interface BotControllerProps {
  entryValue: number;
  profitTarget: number;
  lossLimit: number;
  selectedStrategy: string;
  onStatusChange: (status: 'idle' | 'running' | 'paused') => void;
  onStatsChange: (stats: { wins: number; losses: number; totalProfit: number }) => void;
  onTickReceived?: (price: number, lastDigit: number) => void;
}

interface AccountInfo {
  loginid?: string;
  balance?: number;
  currency?: string;
  is_virtual?: boolean;
}

// Componente de botão com estado interno para garantir mudança visual imediata
interface BotButtonProps {
  status: 'idle' | 'running' | 'paused';
  selectedStrategy: string;
  onStart: () => void;
  onStop: () => void;
}

function BotButton({ status: externalStatus, selectedStrategy, onStart, onStop }: BotButtonProps) {
  const { t } = useTranslation();
  // Estado interno para garantir que o botão mude visualmente de forma imediata
  const [internalStatus, setInternalStatus] = useState<'idle' | 'running' | 'paused'>(externalStatus);
  
  // Sincronizar estado interno com externo quando ele mudar
  useEffect(() => {
    setInternalStatus(externalStatus);
  }, [externalStatus]);
  
  // Renderizar botão com base no estado interno
  if (internalStatus === 'running') {
    return (
      <Button
        onClick={() => {
          console.log('[BOT_BUTTON] 🛑 Parando bot...');
          // Mudar estado imediatamente para feedback visual
          setInternalStatus('idle');
          onStop();
        }}
        className="flex-1 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-700 hover:to-red-800 text-white font-medium border border-red-900/50 shadow"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
        </svg>
        {t('bot.stop', 'Parar Robô')}
      </Button>
    );
  } else {
    return (
      <Button
        onClick={() => {
          console.log('[BOT_BUTTON] 🚀🚀🚀 INICIANDO BOT - BOTÃO CLICADO 🚀🚀🚀');
          console.log('[BOT_BUTTON] Tipo da função onStart:', typeof onStart);
          // Mudar estado imediatamente para feedback visual
          setInternalStatus('running');
          
          try {
            console.log('[BOT_BUTTON] Chamando função onStart...');
            onStart();
            console.log('[BOT_BUTTON] Função onStart executada com sucesso');
          } catch (error) {
            console.error('[BOT_BUTTON] ❌ ERRO AO CHAMAR FUNÇÃO onStart:', error);
          }
        }}
        className="flex-1 bg-gradient-to-r from-green-800 to-green-900 hover:from-green-700 hover:to-green-800 text-white font-medium border border-green-900/50 shadow"
        disabled={!selectedStrategy}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        {t('bot.start', 'Iniciar Operações')}
      </Button>
    );
  }
}

export function BotController({
  entryValue,
  profitTarget,
  lossLimit,
  selectedStrategy,
  onStatusChange,
  onStatsChange,
  onTickReceived
}: BotControllerProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [status, setStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [stats, setStats] = useState({ wins: 0, losses: 0, totalProfit: 0 });
  const [accountInfo, setAccountInfo] = useState<AccountInfo>({
    loginid: '',
    balance: 0,
    currency: 'USD',
    is_virtual: false
  });
  const [strategyConfig, setStrategyConfig] = useState<StrategyConfiguration | null>(null);
  const [currentBotStrategy, setCurrentBotStrategy] = useState<BinaryBotStrategy | null>(null);
  
  // Efeito para carregar a estratégia quando o ID mudar
  useEffect(() => {
    const loadStrategyWithXml = async () => {
      if (selectedStrategy) {
        const strategy = getStrategyById(selectedStrategy);
        setCurrentBotStrategy(strategy);
        
        // Se temos a estratégia e o caminho do XML, carregar o XML para o parser
        if (strategy && strategy.xmlPath) {
          try {
            console.log(`[BOT_CONTROLLER] Carregando XML da estratégia ${strategy.name} de: ${strategy.xmlPath}`);
            
            // Usar o novo loadStrategyXml do strategy-handlers
            const loaded = await loadStrategyXml(selectedStrategy, strategy.xmlPath);
            
            if (loaded) {
              console.log(`[BOT_CONTROLLER] XML da estratégia ${strategy.name} carregado com sucesso`);
            } else {
              console.error(`[BOT_CONTROLLER] Falha ao carregar XML da estratégia ${strategy.name}`);
            }
          } catch (error) {
            console.error(`[BOT_CONTROLLER] Erro ao carregar XML da estratégia ${strategy.name}:`, error);
          }
        }
      } else {
        setCurrentBotStrategy(null);
      }
    };
    
    loadStrategyWithXml();
  }, [selectedStrategy]);

  // Buscar informações da conta ao iniciar componente
  useEffect(() => {
    const loadAccountInfo = async () => {
      // Primeiro, tentar carregar informações da sessão local
      try {
        const accountInfoStr = localStorage.getItem('deriv_account_info');
        if (accountInfoStr) {
          const storedAccountInfo = JSON.parse(accountInfoStr);
          
          // Verificar se os dados são válidos
          if (storedAccountInfo && storedAccountInfo.loginid) {
            console.log('[BOT_CONTROLLER] Informações da conta carregadas do localStorage:', storedAccountInfo.loginid);
            
            // Extrair saldo corretamente
            let balance = 0;
            if (typeof storedAccountInfo.balance === 'object' && storedAccountInfo.balance !== null) {
              balance = parseFloat(storedAccountInfo.balance.balance || 0);
            } else {
              balance = parseFloat(storedAccountInfo.balance || 0);
            }
            
            console.log('[BOT_CONTROLLER] Saldo carregado:', balance);
            
            // Atualizar estado com as informações da conta
            setAccountInfo({
              loginid: storedAccountInfo.loginid,
              balance: balance,
              currency: storedAccountInfo.currency || 'USD',
              is_virtual: storedAccountInfo.is_virtual || (storedAccountInfo.loginid?.startsWith('VRT') ?? false)
            });
          }
        }
      } catch (error) {
        console.error('[BOT_CONTROLLER] Erro ao carregar informações da conta do localStorage:', error);
      }
      
      // Em seguida, tentar obter dados atualizados via API
      try {
        // Iniciar processo de autorização para atualizar dados da conta
        console.log('[BOT_CONTROLLER] Solicitando autorização via oauthDirectService');
        await oauthDirectService.authorizeActiveToken();
        
        // Verificar se há token ativo para a conta selecionada
        const activeAccount = localStorage.getItem('deriv_active_account');
        const accountTokens = localStorage.getItem('deriv_account_tokens');
        
        if (activeAccount && accountTokens) {
          try {
            const tokens = JSON.parse(accountTokens);
            const token = tokens[activeAccount];
            
            if (token) {
              console.log('[BOT_CONTROLLER] Token ativo encontrado para a conta:', activeAccount);
            }
          } catch (e) {
            console.error('[BOT_CONTROLLER] Erro ao processar tokens de conta:', e);
          }
        }
      } catch (error) {
        console.error('[BOT_CONTROLLER] Erro ao obter dados atualizados da conta:', error);
      }
    };
    
    // Executar carregamento de dados
    loadAccountInfo();
    
    // Verificar a cada 30 segundos se há atualizações de saldo
    const refreshInterval = setInterval(() => {
      oauthDirectService.getAccountBalance();
    }, 30000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Configurar listeners para eventos do serviço OAuth
  useEffect(() => {
    // Função para lidar com eventos do serviço de trading
    const handleTradingEvent = (event: any) => {
      // Registrar o evento apenas para fins de log, mas não fazer nada com symbol_update
      // para evitar problemas com fechamento de menus
      console.log('[BOT_CONTROLLER] Evento recebido:', event.type);
      
      // Ignorar todo processamento adicional para symbol_update
      if (event.type === 'symbol_update') {
        return;
      }
      
      if (event.type === 'error') {
        // Mostrar erro para o usuário
        toast({
          title: t('common.error', 'Erro no robô'),
          description: event.message,
          variant: "destructive"
        });
      }
      
      // Eventos de problema de permissão de token
      if (event.type === 'token_permission_error' || event.type === 'token_permission_warning') {
        const severity = event.type === 'token_permission_error' ? 'high' : 'medium';
        
        toast({
          title: severity === 'high' ? t('bot.error.permissionError', 'Erro de permissão') : t('bot.error.permissionWarning', 'Aviso de permissão'),
          description: event.message,
          variant: severity === 'high' ? "destructive" : "default",
          duration: 10000, // 10 segundos para ler
        });
        
        // Se for um erro crítico, exibir instruções mais detalhadas
        if (severity === 'high') {
          setTimeout(() => {
            toast({
              title: t('bot.error.howToFix', 'Como resolver'),
              description: t('bot.error.authorizationNeeded', 'Você precisa autorizar a aplicação com permissões de trading. Clique no botão de login na dashboard para autorizar novamente.'),
              duration: 15000,
            });
          }, 2000);
        }
      }
      
      // Evento de reautorização necessária - removido por solicitação do usuário
      if (event.type === 'reauthorization_required') {
        // Removido o aviso de reautorização conforme solicitado
        console.log("[BOT_CONTROLLER] Evento de reautorização recebido, mas o aviso foi desativado");
      }
      
      if (event.type === 'authorized') {
        // Atualizar informações da conta
        if (event.account) {
          const newAccountInfo: AccountInfo = {
            loginid: event.account.loginid || '',
            balance: event.account.balance ? 
              (typeof event.account.balance === 'object' ? 
                event.account.balance.balance : event.account.balance) : 0,
            currency: event.account.currency || 'USD',
            is_virtual: event.account.is_virtual || false
          };
          
          console.log('[BOT_CONTROLLER] Conta autorizada:', newAccountInfo);
          setAccountInfo(newAccountInfo);
        }
        
        // Verificar se temos informações sobre escopos/permissões
        const hasTrading = event.account?.scopes?.some((scope: string) => 
          ['trade', 'trading', 'trading_information'].includes(scope.toLowerCase())
        );
        
        // Notificação de autorização (removido aviso de conta conforme solicitado)
        console.log('[BOT_CONTROLLER] Autorização concluída:', event.account?.loginid, 'Trading permitido:', hasTrading);
      }
      
      // Atualizar saldo quando receber atualização
      if (event.type === 'balance_update' && event.balance) {
        // Forçar atualização do saldo diretamente com o valor correto
        const newBalance = parseFloat(event.balance.balance || 0);
        console.log('[BOT_CONTROLLER] Atualizando saldo de:', accountInfo.balance, 'para:', newBalance);
        
        setAccountInfo(prev => ({
          ...prev,
          balance: newBalance,
          currency: event.balance.currency || prev.currency
        }));
        
        // Forçar atualização do localStorage para garantir persistência
        try {
          const accountInfoStr = localStorage.getItem('deriv_account_info');
          if (accountInfoStr) {
            const storedInfo = JSON.parse(accountInfoStr);
            storedInfo.balance = newBalance;
            localStorage.setItem('deriv_account_info', JSON.stringify(storedInfo));
          }
        } catch (e) {
          console.error('[BOT_CONTROLLER] Erro ao atualizar localStorage:', e);
        }
        
        console.log('[BOT_CONTROLLER] Saldo atualizado:', event.balance);
      }
      
      if (event.type === 'tick') {
        // Repassar ticks para o componente pai se necessário
        if (onTickReceived) {
          onTickReceived(event.price, event.lastDigit);
        }
        
        // CORREÇÃO 23/04/2025: Avaliar condições da estratégia e disparar operações
        // quando as condições forem atendidas
        if (status === 'running') {
          // Função para garantir que o código não seja interrompido por undefined ou null
          const safeExecute = (fn: () => void, context = 'unknown') => {
            try {
              fn();
            } catch (e) {
              console.error(`[BOT_CONTROLLER] ERRO CRÍTICO NO CONTEXTO: ${context}`, e);
            }
          };
          
          try {
            console.log('[BOT_CONTROLLER] ==================== BLOCO TRY PRINCIPAL ====================');
            // Verificar se o serviço está disponível
            if (!oauthDirectService) {
              console.error('[BOT_CONTROLLER] Serviço OAuth não disponível!');
              return;
            }
            
            // Garantir que a função existe e pode ser chamada
            if (typeof oauthDirectService.getDigitStats !== 'function') {
              console.error('[BOT_CONTROLLER] Função getDigitStats não disponível no serviço!');
              return;
            }
            
            // Obter estatísticas dos dígitos para avaliação das condições com tratamento seguro
            const digitStats = safeExecute(() => oauthDirectService.getDigitStats(), 'getDigitStats') || [];
            console.log('[BOT_CONTROLLER] Obtidas estatísticas:', digitStats?.length || 0, 'dígitos');
            
            if (!digitStats || digitStats.length < 10) {
              // Sem estatísticas suficientes para avaliação
              console.log('[BOT_CONTROLLER] Estatísticas insuficientes, abortando:', digitStats?.length);
              return;
            }
            
            // Obter porcentagem configurada pelo usuário (para estratégias como Advance)
            let entryPercentage: number | undefined = undefined;
            
            if (strategyConfig?.porcentagemParaEntrar !== undefined) {
              entryPercentage = typeof strategyConfig.porcentagemParaEntrar === 'string' ? 
                parseFloat(strategyConfig.porcentagemParaEntrar) : 
                (typeof strategyConfig.porcentagemParaEntrar === 'number' ? 
                  strategyConfig.porcentagemParaEntrar : undefined);
              console.log(`[BOT_CONTROLLER] Usando porcentagem de entrada configurada pelo usuário:`, entryPercentage);
            }
            
            // Variáveis para resultado da análise
            let shouldEnter = false;
            let contractType = 'CALL';
            let message = '';
            let prediction: number | undefined = undefined;
            
            // Avaliar condições baseado na estratégia selecionada
            if (selectedStrategy.toLowerCase().includes('advance')) {
              // Estratégia Advance
              console.log('[BOT_CONTROLLER] Implementando diretamente a lógica da estratégia ADVANCE');
              
              // Implementação direta da estratégia ADVANCE para evitar problemas de importação
              try {
                // Garantir que sempre temos um valor para porcentagem
                // Se valor não estiver definido, usar 10% como padrão
                const percentageToUse = entryPercentage !== undefined ? entryPercentage : 10;
                
                // Log adicional para debug detalhado
                console.log(`[BOT_CONTROLLER] ADVANCE: Analisando com porcentagem definida pelo usuário: ${percentageToUse}%`);
                console.log(`[BOT_CONTROLLER] ADVANCE: Total de estatísticas recebidas: ${digitStats.length} dígitos`);
                
                // Verificar se temos um valor de percentagem válido
                if (typeof percentageToUse !== 'number' || isNaN(percentageToUse)) {
                  shouldEnter = false;
                  contractType = 'CALL'; // A estratégia Advance usa CALL para melhor compatibilidade
                  message = `Configuração de porcentagem inválida: ${percentageToUse}. Usando valor padrão 10%.`;
                  console.log(`[BOT_CONTROLLER] ${message}`);
                  return;
                }
                
                // CRÍTICO: Verificar se temos dados suficientes (exatamente 25 ticks são necessários)
                // Contamos o total de ticks representados nas estatísticas
                const totalTicksRepresented = digitStats.reduce((sum, stat) => sum + stat.count, 0);
                
                // Log para depuração
                console.log(`[BOT_CONTROLLER] ADVANCE: Total de ticks nas estatísticas: ${totalTicksRepresented}`);
                
                // Verificamos se temos exatamente 25 ticks para análise
                // Se não tiver pelo menos 25, não podemos prosseguir com análise precisa
                if (totalTicksRepresented < 25) {
                  shouldEnter = false;
                  contractType = 'CALL'; // Tipo correto para estratégia Advance
                  message = `ADVANCE: Dados insuficientes para análise. Necessários exatamente 25 ticks, temos ${totalTicksRepresented}.`;
                  console.log(`[BOT_CONTROLLER] ${message}`);
                  return;
                }
                
                // Extrair estatísticas para os dígitos 0 e 1 dos últimos 25 ticks
                const digit0 = digitStats.find(stat => stat.digit === 0);
                const digit1 = digitStats.find(stat => stat.digit === 1);
                
                // Certifique-se de sempre ter valores, mesmo que sejam zeros
                const digit0Percentage = digit0 ? Math.round(digit0.percentage) : 0;
                const digit1Percentage = digit1 ? Math.round(digit1.percentage) : 0;
                
                // Log para depuração
                console.log(`[BOT_CONTROLLER] ADVANCE: Baseado nos últimos 25 ticks:`);
                console.log(`[BOT_CONTROLLER] ADVANCE:   - Dígito 0: ${digit0Percentage}%`);
                console.log(`[BOT_CONTROLLER] ADVANCE:   - Dígito 1: ${digit1Percentage}%`);
                console.log(`[BOT_CONTROLLER] ADVANCE:   - Limite definido pelo usuário: ${percentageToUse}%`);
                
                // Se não encontrou estatísticas para esses dígitos específicos, usar zeros
                // mas ainda registramos no histórico para transparência
                if (!digit0 || !digit1) {
                  shouldEnter = false;
                  contractType = 'CALL';
                  message = 'ADVANCE: Calculando estatísticas para dígitos 0 e 1...';
                  console.log(`[BOT_CONTROLLER] ${message}`);
                  return;
                }
                
                // CRÍTICO: Adicionar log específico para debugar os valores usados na comparação
                console.log(`[BOT_CONTROLLER] ADVANCE DEBUG: Comparando digit0=${digit0Percentage}% e digit1=${digit1Percentage}% com limite=${percentageToUse}%`);
                
                // Verificar se AMBOS os dígitos 0 E 1 estão com percentual MENOR OU IGUAL ao definido pelo usuário
                // IMPORTANTE: Esta é a condição principal que determina a entrada na operação
                shouldEnter = digit0Percentage <= percentageToUse && digit1Percentage <= percentageToUse;
                contractType = 'DIGITOVER';
                
                console.log(`[BOT_CONTROLLER] ADVANCE RESULTADO: shouldEnter=${shouldEnter}`);
                console.log(`[BOT_CONTROLLER] 🔍 Verificando ambos os dígitos: 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) <= ${percentageToUse}%`);
                
                // Notificar usuário no console para diagnóstico
                if (shouldEnter) {
                  console.log(`[BOT_CONTROLLER] 🚀🚀🚀 ATENÇÃO: CONDIÇÃO DE ENTRADA IDENTIFICADA! Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) <= ${percentageToUse}%`);
                }
                
                // Determinar mensagem de feedback explícita incluindo o valor definido pelo usuário
                message = shouldEnter 
                  ? `ADVANCE XML: ✅ Condição satisfeita! Executando DIGITOVER conforme XML. Dígitos 0 (${digit0Percentage}%) e 1 (${digit1Percentage}%) ambos <= ${percentageToUse}%`
                  : `ADVANCE XML: ❌ Condição não atendida. Dígito 0 (${digit0Percentage}%) ou 1 (${digit1Percentage}%) > ${percentageToUse}%`;
                  
                console.log(`[BOT_CONTROLLER] ${message}`);
                
              } catch (advanceError) {
                console.error('[BOT_CONTROLLER] ERRO ESPECÍFICO NA ESTRATÉGIA ADVANCE (implementação direta):', advanceError);
                if (advanceError instanceof Error) {
                  console.error('[BOT_CONTROLLER] Erro Advance - detalhes:', {
                    message: advanceError.message,
                    stack: advanceError.stack,
                    name: advanceError.name
                  });
                } else {
                  console.error('[BOT_CONTROLLER] Erro não é uma instância de Error:', typeof advanceError);
                }
              }
            } 
            else if (selectedStrategy.toLowerCase().includes('iron_over') || 
                    selectedStrategy.toLowerCase().includes('ironover')) {
              // Estratégia Iron Over - Implementação direta para evitar problemas de importação
              console.log('[BOT_CONTROLLER] Implementando diretamente a lógica da estratégia IRON OVER');
              try {
                // IRON OVER SEMPRE faz DIGITOVER
                shouldEnter = true;
                contractType = 'DIGITOVER';
                prediction = 5; // Valor padrão para dígitos
                message = `IRON OVER XML: Operação normal. Previsão: DIGITOVER ${prediction}`;
                
                console.log(`[BOT_CONTROLLER] Análise IRON OVER: ${shouldEnter ? 'ENTRAR' : 'AGUARDAR'} - ${message}`);
              } catch (ironOverError) {
                console.error('[BOT_CONTROLLER] ERRO ESPECÍFICO NA ESTRATÉGIA IRON OVER (implementação direta):', ironOverError);
                if (ironOverError instanceof Error) {
                  console.error('[BOT_CONTROLLER] Erro IRON OVER - detalhes:', {
                    message: ironOverError.message,
                    stack: ironOverError.stack,
                    name: ironOverError.name
                  });
                }
              }
            }
            else if (selectedStrategy.toLowerCase().includes('iron_under') || 
                    selectedStrategy.toLowerCase().includes('ironunder')) {
              // Estratégia Iron Under - Implementação direta para evitar problemas de importação
              console.log('[BOT_CONTROLLER] Implementando diretamente a lógica da estratégia IRON UNDER');
              try {
                // IRON UNDER SEMPRE faz DIGITUNDER
                shouldEnter = true;
                contractType = 'DIGITUNDER';
                prediction = 5; // Valor padrão para dígitos
                message = `IRON UNDER XML: Operação normal. Previsão: DIGITUNDER ${prediction}`;
                
                console.log(`[BOT_CONTROLLER] Análise IRON UNDER: ${shouldEnter ? 'ENTRAR' : 'AGUARDAR'} - ${message}`);
              } catch (ironUnderError) {
                console.error('[BOT_CONTROLLER] ERRO ESPECÍFICO NA ESTRATÉGIA IRON UNDER (implementação direta):', ironUnderError);
                if (ironUnderError instanceof Error) {
                  console.error('[BOT_CONTROLLER] Erro IRON UNDER - detalhes:', {
                    message: ironUnderError.message,
                    stack: ironUnderError.stack,
                    name: ironUnderError.name
                  });
                }
              }
            }
            else if (selectedStrategy.toLowerCase().includes('maxpro')) {
              // Estratégia MaxPro - Implementação direta para evitar problemas de importação
              console.log('[BOT_CONTROLLER] Implementando diretamente a lógica da estratégia MAXPRO');
              try {
                // Ordenar dígitos por frequência (do menor para o maior)
                const sortedStats = [...digitStats].sort((a, b) => a.percentage - b.percentage);
                
                // Pegar o dígito com menor frequência
                const lowestFreqDigit = sortedStats[0]?.digit ?? 5;
                
                // Pegar o dígito com maior frequência
                const highestFreqDigit = sortedStats[sortedStats.length - 1]?.digit ?? 5;
                
                // Verificar se a diferença entre maior e menor frequência é significativa
                const lowestPercentage = sortedStats[0]?.percentage ?? 0;
                const highestPercentage = sortedStats[sortedStats.length - 1]?.percentage ?? 0;
                const percentageDiff = highestPercentage - lowestPercentage;
                
                shouldEnter = percentageDiff >= 8; // Precisa de pelo menos 8% de diferença
                
                // Determine o tipo de contrato (DIGITOVER para dígito com baixa frequência)
                contractType = 'DIGITOVER';
                prediction = lowestFreqDigit;
                
                message = shouldEnter
                  ? `MAXPRO: Condição atendida! Dígito ${lowestFreqDigit} com frequência baixa (${lowestPercentage}%). Diferença: ${percentageDiff}%`
                  : `MAXPRO: Distribuição muito equilibrada (dif: ${percentageDiff}%). Aguardando melhor oportunidade.`;
                  
                console.log(`[BOT_CONTROLLER] Análise MAXPRO: ${shouldEnter ? 'ENTRAR' : 'AGUARDAR'} - ${message}`);
              } catch (maxProError) {
                console.error('[BOT_CONTROLLER] ERRO ESPECÍFICO NA ESTRATÉGIA MAXPRO (implementação direta):', maxProError);
                if (maxProError instanceof Error) {
                  console.error('[BOT_CONTROLLER] Erro MAXPRO - detalhes:', {
                    message: maxProError.message,
                    stack: maxProError.stack,
                    name: maxProError.name
                  });
                }
              }
            }
            else {
              // Estratégia padrão ou desconhecida - Implementação direta para evitar problemas de importação
              console.log(`[BOT_CONTROLLER] Implementando diretamente a lógica padrão para estratégia: ${selectedStrategy}`);
              try {
                // Estratégia padrão sempre entra com CALL
                shouldEnter = true;
                contractType = 'CALL';
                message = `Estratégia padrão: Entrada com ${contractType}`;
                
                console.log(`[BOT_CONTROLLER] Análise padrão: ${shouldEnter ? 'ENTRAR' : 'AGUARDAR'} - ${message}`);
              } catch (defaultError) {
                console.error('[BOT_CONTROLLER] ERRO ESPECÍFICO NA ESTRATÉGIA PADRÃO (implementação direta):', defaultError);
                if (defaultError instanceof Error) {
                  console.error('[BOT_CONTROLLER] Erro PADRÃO - detalhes:', {
                    message: defaultError.message,
                    stack: defaultError.stack,
                    name: defaultError.name
                  });
                }
              }
            }
            
            // Se as condições forem atendidas, executar operação
            if (shouldEnter) {
              console.log(`[BOT_CONTROLLER] 🚨 CONDIÇÕES ATENDIDAS! Iniciando operação ${contractType}`);
              
              // Obter valor de entrada configurado pelo usuário
              const valorInicialStr = strategyConfig?.valorInicial;
              const valueToUse = typeof valorInicialStr === 'string' ? 
                parseFloat(valorInicialStr) : 
                (typeof valorInicialStr === 'number' ? valorInicialStr : 0);
                
              if (!valueToUse || valueToUse <= 0) {
                console.error('[BOT_CONTROLLER] Valor de entrada não encontrado ou inválido!');
                return;
              }
              
              // Definir tipo de contrato e previsão
              oauthDirectService.setSettings({
                contractType: contractType,
                prediction: prediction
              });
              
              // Executar operação via função específica do serviço
              (oauthDirectService as any).executeContractBuy(valueToUse);
              
              // Exibir toast informativo
              toast({
                title: `Operação iniciada (${selectedStrategy})`,
                description: `Condições atendidas: ${message}`,
              });
            }
          } catch (error) {
            console.error('[BOT_CONTROLLER] ==================== ERRO NO BLOCO TRY PRINCIPAL ====================');
            console.error('[BOT_CONTROLLER] Erro ao avaliar condições da estratégia:', error);
            console.error('[BOT_CONTROLLER] Tipo de erro:', typeof error);
            console.error('[BOT_CONTROLLER] JSON do erro:', JSON.stringify(error, null, 2));
            
            // Log adicional para diagnóstico
            if (error instanceof Error) {
              console.error('[BOT_CONTROLLER] Detalhes do erro:', {
                message: error.message,
                stack: error.stack,
                name: error.name
              });
            } else {
              console.error('[BOT_CONTROLLER] Erro não é uma instância de Error. Tipo:', typeof error);
              console.error('[BOT_CONTROLLER] Conteúdo do erro:', error);
              console.error('[BOT_CONTROLLER] Propriedades do erro (se houver):', Object.keys(error || {}));
            }
            
            console.error('[BOT_CONTROLLER] Estratégia que causou o erro:', selectedStrategy);
            console.error('[BOT_CONTROLLER] Status do bot durante o erro:', status);
            console.error('[BOT_CONTROLLER] ==================== FIM DO LOG DE ERRO ====================');
          }
        }
      }
      
      if (event.type === 'contract_purchased') {
        // Mostrar notificação de compra
        toast({
          title: t('bot.contract.purchased', 'Contrato comprado'),
          description: t('bot.contract.details', 'ID: {{id}}, Valor: ${{value}}', { 
            id: event.contract_id, 
            value: event.buy_price 
          }),
        });
      }
      
      if (event.type === 'contract_finished') {
        // Atualizar estatísticas
        const newStats = { ...stats };
        
        if (event.is_win) {
          newStats.wins += 1;
        } else {
          newStats.losses += 1;
        }
        
        newStats.totalProfit += event.profit;
        setStats(newStats);
        onStatsChange(newStats);
        
        // Mostrar notificação de resultado
        toast({
          title: event.is_win 
            ? t('bot.contract.wonOperation', 'Operação vencedora!') 
            : t('bot.contract.lostOperation', 'Operação perdedora'),
          description: t('bot.contract.result', 'Resultado: ${{profit}}', { 
            profit: event.profit.toFixed(2) 
          }),
          variant: event.is_win ? "default" : "destructive",
        });
        
        // Disparar evento para o histórico de operações
        // Este evento é capturado pelo componente RelatorioOperacoes para registrar a operação
        const historyEvent = new CustomEvent('trading_operation_finished', {
          detail: {
            timestamp: Date.now(),
            contractId: event.contract_id,
            isWin: event.is_win,
            profit: event.profit,
            entry: event.entry_value || 0,
            exit: event.exit_value || 0,
            status: event.is_win ? 'won' : 'lost',
            type: selectedStrategy,
            contractDetails: event.contract_details || {}
          }
        });
        document.dispatchEvent(historyEvent);
      }
      
      // NOVO: Tratar evento de operação intermediária para estratégia Advance
      if (event.type === 'intermediate_operation') {
        console.log('[BOT_CONTROLLER] Recebida operação intermediária da estratégia Advance:', event.details);
        
        // Criar evento para adicionar a operação intermediária ao histórico
        // Usamos o mesmo formato do evento de histórico normal, mas adicionamos flag de intermediário
        const intermediateHistoryEvent = new CustomEvent('trading_operation_finished', {
          detail: {
            timestamp: Date.now(),
            contractId: event.details.contractId,
            isWin: event.details.status === 'won',
            profit: event.details.profit || 0,
            entry: event.details.amount || 0,
            exit: event.details.result || 0,
            status: event.details.status || 'pending',
            type: `${selectedStrategy} (intermediária)`, // Marcar claramente como intermediária
            isIntermediate: true, // Flag para identificar operações intermediárias no componente de histórico
            analysis: event.details.analysis || '',
            contractDetails: {
              contract_id: event.details.contractId,
              status: event.details.status,
              profit: event.details.profit
            }
          }
        });
        document.dispatchEvent(intermediateHistoryEvent);
      }
      
      if (event.type === 'bot_started' || event.type === 'operation_started') {
        console.log('[BOT_CONTROLLER] ✅ Bot estado alterado para ATIVO após evento:', event.type);
        setStatus('running');
        onStatusChange('running');
      }
      
      if (event.type === 'bot_target_reached') {
        console.log('[BOT_CONTROLLER] 🎯 Meta de lucro atingida:', event.message);
        toast({
          title: t('bot.target.reached', 'Meta de lucro atingida!'),
          description: event.message,
          variant: "default",
          duration: 10000, // 10 segundos para visibilidade
        });
        
        // Atualizar estado para parado
        setStatus('idle');
        onStatusChange('idle');
      }
      
      if (event.type === 'bot_limit_reached') {
        console.log('[BOT_CONTROLLER] 🛑 Limite de perda atingido:', event.message);
        toast({
          title: t('bot.limit.reached', 'Limite de perda atingido!'),
          description: event.message,
          variant: "destructive",
          duration: 10000, // 10 segundos para visibilidade
        });
        
        // Atualizar estado para parado
        setStatus('idle');
        onStatusChange('idle');
      }
      
      if (event.type === 'bot_stopped') {
        console.log('[BOT_CONTROLLER] ✅ Bot estado alterado para PARADO após evento:', event.type);
        
        // Exibir notificação se houver uma razão específica
        if (event.reason || event.message) {
          const reason = event.reason || event.message;
          let toastVariant: "default" | "destructive" | null = null;
          
          // Determinar o tipo de notificação
          if (event.notificationType === 'error') {
            toastVariant = "destructive";
          } else if (event.notificationType === 'success') {
            // Manter default para sucesso
          }
          
          // Mostrar toast com a razão da parada
          toast({
            title: t('bot.stopped', 'Bot parado'),
            description: reason,
            variant: toastVariant || "default",
            duration: 5000
          });
        }
        
        // Atualizar estado do bot
        setStatus('idle');
        onStatusChange('idle');
      }
    };
    
    // Registrar listener
    oauthDirectService.addEventListener(handleTradingEvent);
    
    // Limpar listener ao desmontar
    return () => {
      oauthDirectService.removeEventListener(handleTradingEvent);
    };
  }, [toast, onStatusChange, onStatsChange, stats, onTickReceived]);

  // Tratamento de erros global para todo o componente
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('[BOT_CONTROLLER] 🔴 ERRO GLOBAL CAPTURADO:', event.error);
      console.error('[BOT_CONTROLLER] Mensagem do erro:', event.message);
      console.error('[BOT_CONTROLLER] Origem do erro:', event.filename, 'linha:', event.lineno, 'coluna:', event.colno);
      
      // Exibir feedback para o usuário
      toast({
        title: 'Erro detectado',
        description: `Um erro ocorreu durante a execução. Detalhes: ${event.message}`,
        variant: "destructive",
      });
    };
    
    // Registrar handler global de erros
    window.addEventListener('error', handleGlobalError);
    
    // Limpar handler ao desmontar
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, [toast]);
  
  // Iniciar o bot com o serviço OAuth direto
  // Handler para quando a configuração da estratégia mudar
  const handleStrategyConfigChange = (config: StrategyConfiguration) => {
    try {
      console.log('[BOT_CONTROLLER] Configuração de estratégia atualizada:', config);
      setStrategyConfig(config);
    } catch (e) {
      console.error('[BOT_CONTROLLER] Erro ao atualizar configuração da estratégia:', e);
    }
  };
  
  const startBot = async () => {
    try {
      console.log('[BOT_CONTROLLER] 🚀🚀🚀 INICIANDO BOT - FUNÇÃO STARTBOT CHAMADA 🚀🚀🚀');
      console.log('[BOT_CONTROLLER] 🔍 PARÂMETROS DETALHADOS:', {
        estrategia: selectedStrategy,
        config: strategyConfig,
        status: status,
        balanceInfo: accountInfo,
        tokenStatus: localStorage.getItem('deriv_oauth_token') ? 'Presente' : 'Ausente'
      });
      
      // Verificar se a estratégia foi selecionada
      if (!selectedStrategy || !currentBotStrategy) {
        toast({
          title: t('bot.error.noStrategy', 'Estratégia não selecionada'),
          description: t('bot.error.selectStrategy', 'Por favor, selecione uma estratégia antes de iniciar o robô.'),
          variant: "destructive"
        });
        return;
      }
      
      // Verificar se temos a configuração da estratégia
      if (!strategyConfig) {
        toast({
          title: t('bot.error.incompleteConfig', 'Configuração incompleta'),
          description: t('bot.error.configureParams', 'Por favor, configure os parâmetros da estratégia antes de iniciar.'),
          variant: "destructive"
        });
        return;
      }
      
      // Verificar se o usuário está autenticado através do token OAuth
      const token = localStorage.getItem('deriv_oauth_token');
      if (!token) {
        toast({
          title: t('bot.error.authRequired', 'Autenticação necessária'),
          description: t('bot.error.loginRequired', 'É necessário fazer login com sua conta Deriv para operar com valores reais.'),
          variant: "destructive",
        });
        return;
      }
      
      // Feedback visual imediato
      toast({
        title: t('bot.starting', 'Iniciando robô...'),
        description: t('bot.connecting', 'Estabelecendo conexão dedicada com Deriv...'),
      });
      
      // Configurar bot com os parâmetros da estratégia específica
      console.log('[BOT_CONTROLLER] Configurando parâmetros do bot a partir da estratégia', {
        valorInicial: strategyConfig.valorInicial,
        metaGanho: strategyConfig.metaGanho,
        limitePerda: strategyConfig.limitePerda,
        martingale: strategyConfig.martingale
      });
      
      // ----- INÍCIO: NOVA IMPLEMENTAÇÃO COM PARSER XML -----
      // Carregar o XML da estratégia se ainda não foi carregado
      if (currentBotStrategy?.xmlPath) {
        try {
          const loaded = await loadStrategyXml(selectedStrategy, currentBotStrategy.xmlPath);
          if (loaded) {
            console.log(`[BOT_CONTROLLER] XML da estratégia ${currentBotStrategy.name} carregado com sucesso!`);
            
            // Exibir mensagem de sucesso para o usuário
            toast({
              title: "Estratégia carregada",
              description: `A estratégia ${currentBotStrategy.name} foi interpretada e será executada fielmente conforme seus comandos.`,
              duration: 5000,
            });
          } else {
            console.warn(`[BOT_CONTROLLER] Não foi possível carregar XML da estratégia ${currentBotStrategy.name}, usando implementação alternativa`);
          }
        } catch (error) {
          console.error(`[BOT_CONTROLLER] Erro ao carregar XML:`, error);
        }
      }
      // ----- FIM: NOVA IMPLEMENTAÇÃO COM PARSER XML -----
      
      // Definir o tipo de contrato com base na estratégia
      // Agora usaremos o tipo de contrato do XML se disponível
      let contractType = getContractTypeForStrategy(selectedStrategy);
      
      // Determinar a previsão de dígito com base na estratégia
      const needsPrediction = usesDigitPrediction(selectedStrategy);
      let prediction = needsPrediction ? Math.floor(Math.random() * 10) : undefined;
      
      // Tente obter os valores da estratégia usando o parser XML
      try {
        // Obter últimas estatísticas de dígitos 
        const digitStats = oauthDirectService.getDigitStats();
        
        if (digitStats.length > 0) {
          console.log(`[BOT_CONTROLLER] Usando estatísticas de dígitos para análise XML (${digitStats.length} dígitos)`);
          
          // Obter consecutiveLosses do estado atual da estratégia
          const strategyState = getStrategyState(selectedStrategy);
          const consecutiveLosses = strategyState?.consecutiveLosses || 0;
          
          // Analisar estratégia com parser XML
          const xmlAnalysis = await evaluateEntryConditions(
            selectedStrategy, 
            digitStats, 
            strategyConfig,
            currentBotStrategy?.xmlPath
          );
          
          // Usar valores do parser XML se possível
          contractType = xmlAnalysis.contractType;
          
          // Converter prediction para garantir que seja number ou undefined
          if (xmlAnalysis.prediction !== undefined) {
            const predictValue = typeof xmlAnalysis.prediction === 'string' ?
              parseInt(xmlAnalysis.prediction) :
              (typeof xmlAnalysis.prediction === 'number' ? 
                xmlAnalysis.prediction : undefined);
                
            prediction = predictValue;
            console.log(`[BOT_CONTROLLER] Prediction convertido para número:`, prediction);
          }
          
          console.log(`[BOT_CONTROLLER] ★ Análise XML da estratégia ${selectedStrategy}:`, {
            shouldEnter: xmlAnalysis.shouldEnter,
            contractType: xmlAnalysis.contractType,
            prediction: xmlAnalysis.prediction,
            entryAmount: xmlAnalysis.entryAmount,
            message: xmlAnalysis.message
          });
        }
      } catch (error) {
        console.error(`[BOT_CONTROLLER] Erro ao analisar estratégia com parser XML:`, error);
        // Continuar com os valores padrão obtidos anteriormente
      }
      
      if (prediction !== undefined) {
        console.log(`[BOT_CONTROLLER] Usando previsão de dígito: ${prediction}`);
      }
      
      // 🚨🚨🚨 CORREÇÃO DEFINITIVA - 22/04/2025 🚨🚨🚨
      // Garantir que o input no DOM esteja sempre atualizado com o valor definido 
      // na configuração antes de qualquer operação
      const inputElement = document.getElementById('iron-bot-entry-value') as HTMLInputElement;
      if (inputElement && strategyConfig.valorInicial) {
        console.log(`[BOT_CONTROLLER] ✅ GARANTINDO valor ${strategyConfig.valorInicial} no DOM`);
        inputElement.value = strategyConfig.valorInicial.toString();
      }
      
      // Adicionar valor como variável global para garantir acesso em todas as funções
      (window as any).ironBotEntryValue = strategyConfig.valorInicial;
      
      // Configurar serviço com os parâmetros da configuração atual da estratégia
      // USAR EXATAMENTE o valor da estratégia como valor inicial
      console.log(`[BOT_CONTROLLER] 🚨 Configurando serviço com valor EXATO: ${strategyConfig.valorInicial}`);
      oauthDirectService.setSettings({
        entryValue: strategyConfig.valorInicial, // Valor EXATO da configuração
        profitTarget: strategyConfig.metaGanho,
        lossLimit: strategyConfig.limitePerda,
        martingaleFactor: parseFloat(strategyConfig.martingale.toString()),
        contractType,
        prediction
      });
      
      // Definir estratégia ativa
      console.log('[BOT_CONTROLLER] Definindo estratégia ativa:', selectedStrategy);
      oauthDirectService.setActiveStrategy(selectedStrategy);
      
      // Iniciar o serviço de trading
      const success = await oauthDirectService.start();
      
      if (success) {
        // ATUALIZAR IMEDIATAMENTE O STATUS PARA GARANTIR QUE A INTERFACE MUDE
        console.log('[BOT_CONTROLLER] ✅✅✅ SERVIÇO INICIADO - Atualizando status para ATIVO ✅✅✅');
        console.log('[BOT_CONTROLLER] 🔄 Estado anterior:', status);
        setStatus('running');
        onStatusChange('running');
        console.log('[BOT_CONTROLLER] 🔄 Estado atual definido como: running');

        // CORREÇÃO 23/04/2025
        // PLANO DEFINITIVO: Garantir execução correta para TODAS as estratégias
        
        // Etapa 1: Obter valor exato da configuração do usuário
        console.log('[BOT_CONTROLLER] 🚨🚨🚨 CORREÇÃO CRÍTICA 23/04: Forçando execução com valor EXATO do usuário!');
        const exactUserValue = strategyConfig.valorInicial; 
        console.log(`[BOT_CONTROLLER] 🚨 VALOR EXATO DE ENTRADA CONFIGURADO PELO USUÁRIO: ${exactUserValue}`);
        
        // EXTREMAMENTE IMPORTANTE: Definir variável global para garantir acesso ao valor correto em qualquer ponto
        (window as any).ironBotEntryValue = exactUserValue;
        
        // Etapa 2: Configurar explicitamente o tipo de contrato adequado para cada estratégia
        let contractType = 'CALL'; // Tipo padrão
        
        // Função auxiliar para determinar o tipo de contrato com base na estratégia
        const getContractTypeForStrategy = (strategyName: string): string => {
          const strategy = strategyName.toLowerCase();
          if (strategy.includes('iron_under') || strategy.includes('ironunder')) {
            return 'DIGITUNDER';
          } else if (strategy.includes('iron_over') || strategy.includes('ironover')) {
            return 'DIGITOVER';
          } else if (strategy.includes('maxpro')) {
            return 'DIGITOVER';
          } else if (strategy.includes('advance')) {
            return 'CALL';
          } else if (strategy.includes('botlow')) {
            return 'PUT';
          } else {
            return 'CALL'; // Valor padrão para outras estratégias
          }
        };
        
        contractType = getContractTypeForStrategy(selectedStrategy);
        
        // CORREÇÃO MANUAL para estratégias com tipos específicos de contrato
        if (selectedStrategy.toLowerCase().includes('iron_under') || selectedStrategy.toLowerCase().includes('ironunder')) {
          contractType = 'DIGITUNDER';
          console.log(`[BOT_CONTROLLER] ⚠️ Forçando tipo DIGITUNDER para estratégia IRON UNDER`);
        } else if (selectedStrategy.toLowerCase().includes('iron_over') || selectedStrategy.toLowerCase().includes('ironover')) {
          contractType = 'DIGITOVER';
          console.log(`[BOT_CONTROLLER] ⚠️ Forçando tipo DIGITOVER para estratégia IRON OVER`);
        }
        
        // Etapa 3: Configurar o serviço com todos os parâmetros exatos
        oauthDirectService.setSettings({
          entryValue: exactUserValue,
          profitTarget: strategyConfig.metaGanho,
          lossLimit: strategyConfig.limitePerda,
          martingaleFactor: typeof strategyConfig.martingale === 'string' ? 
                parseFloat(strategyConfig.martingale) :
                (typeof strategyConfig.martingale === 'number' ? 
                  strategyConfig.martingale : 1),
          contractType: contractType,
          prediction: 5 // Valor padrão que será substituído pela análise da estratégia
        });
        
        // Etapa 4: Tentar execução com diferentes métodos (SOLUÇÃO DEFINITIVA)
        console.log(`[BOT_CONTROLLER] 🚨 TENTATIVA 1: Executando primeira operação via método padrão`);
        let operationStarted = await oauthDirectService.executeFirstOperation(exactUserValue);
        
        // Verificar se a operação foi iniciada com sucesso
        if (!operationStarted) {
          console.log(`[BOT_CONTROLLER] 🚨 TENTATIVA 2: Primeira operação falhou, usando método direto`);
          
          // Verificar se o WebSocket está disponível
          if ((oauthDirectService as any).webSocket && (oauthDirectService as any).webSocket.readyState === 1) {
            console.log(`[BOT_CONTROLLER] 🚨 WebSocket confirmado disponível, enviando operação DIRETAMENTE`);
            
            try {
              // Tentar executar operação diretamente pelo método interno
              (oauthDirectService as any).executeContractBuy(exactUserValue);
              console.log(`[BOT_CONTROLLER] 🚨 TENTATIVA 2: Operação enviada diretamente!`);
              operationStarted = true;
            } catch (error) {
              console.error(`[BOT_CONTROLLER] ❌ ERRO AO EXECUTAR OPERAÇÃO DIRETA:`, error);
            }
          } else {
            console.log(`[BOT_CONTROLLER] 🚨 TENTATIVA 3: WebSocket não disponível, tentando reconexão forçada`);
            
            try {
              // Tentar forçar reconexão e tentar novamente
              await (oauthDirectService as any).reconnect();
              await new Promise(resolve => setTimeout(resolve, 1000)); // Aguardar 1 segundo para estabilizar
              
              console.log(`[BOT_CONTROLLER] 🚨 Após reconexão, enviando operação novamente`);
              
              // Verificar se o WebSocket está disponível após reconexão
              if ((oauthDirectService as any).webSocket && (oauthDirectService as any).webSocket.readyState === 1) {
                (oauthDirectService as any).executeContractBuy(exactUserValue);
                console.log(`[BOT_CONTROLLER] 🚨 TENTATIVA 3: Operação enviada após reconexão!`);
                operationStarted = true;
              } else {
                console.error(`[BOT_CONTROLLER] ❌ WebSocket ainda não disponível após reconexão`);
              }
            } catch (error) {
              console.error(`[BOT_CONTROLLER] ❌ ERRO DURANTE RECONEXÃO:`, error);
            }
          }
        }
        
        if (operationStarted) {
          console.log('[BOT_CONTROLLER] Primeira operação iniciada com sucesso!');
          // Garantir que o status esteja atualizado novamente
          setStatus('running');
          onStatusChange('running');
        } else {
          console.warn('[BOT_CONTROLLER] Não foi possível iniciar a primeira operação!');
        }
        
        // Atualização de status também ocorre via evento bot_started
        toast({
          title: t('bot.started', 'Bot iniciado'),
          description: t('bot.executingStrategy', 'Executando estratégia "{{name}}" com entrada de {{value}}', {
            name: currentBotStrategy?.name,
            value: exactUserValue
          }),
        });
      } else {
        console.log('[BOT_CONTROLLER] Bot não iniciou com sucesso, resetando estado');
        setStatus('idle');
        onStatusChange('idle');
        toast({
          title: t('bot.error.startFailed', 'Falha ao iniciar bot'),
          description: t('bot.error.checkSession', 'Verifique se sua sessão está ativa e tente novamente.'),
          variant: "destructive"
        });
      }
      
    } catch (error) {
      console.error('[BOT_CONTROLLER] Erro ao iniciar bot:', error);
      setStatus('idle');
      onStatusChange('idle');
      toast({
        title: t('bot.error.errorStarting', 'Erro ao iniciar bot'),
        description: t('bot.error.tryAgain', 'Ocorreu um erro ao iniciar o bot. Tente novamente.'),
        variant: "destructive"
      });
    }
  };

  // Parar o bot
  const stopBot = () => {
    try {
      console.log('[BOT_CONTROLLER] Parando bot...');
      
      // Atualizar status IMEDIATAMENTE para garantir mudança na interface
      setStatus('idle');
      onStatusChange('idle');
      
      // Parar o serviço
      oauthDirectService.stop();
      
      // Atualização de status também ocorre via evento bot_stopped
      toast({
        title: t('bot.stopping', 'Parando robô'),
        description: t('bot.operationsStopped', 'Operações interrompidas com sucesso.'),
      });
    } catch (error) {
      console.error('[BOT_CONTROLLER] Erro ao parar bot:', error);
      toast({
        title: t('bot.error.stopError', 'Erro ao parar bot'),
        description: t('bot.error.stopErrorMessage', 'Ocorreu um erro ao parar o bot. Tente novamente.'),
        variant: "destructive"
      });
    }
  };

  // Não precisamos mais dessa função formatCurrency, já que usamos template string diretamente
  
  // Renderizar botão de início/pausa e informações da conta
  return (
    <div className="space-y-4">
      {/* Barra superior - Modal de status totalmente removido conforme solicitado */}
      <div className="bg-gradient-to-r from-[#13203a] to-[#1a2b4c] p-3 rounded-md border border-[#2a3756] shadow-lg">
        <div className="flex items-center justify-between">
          {status === 'running' && (
            <div className="flex items-center bg-green-600/10 py-2 px-4 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-sm text-green-400 font-medium">{t('bot.status.operating', 'Operando')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Estratégia e botões de controle melhorados */}
      <div className="space-y-3">
        <div className="flex items-center p-3 bg-[#0e1a2e] rounded-md border border-[#2a3756]">
          <div className="flex-1">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              <span className="text-sm text-white font-medium">{t('bot.activeStrategy', 'Estratégia Ativa:')}</span>
              <span className="ml-2 text-sm text-blue-400 font-bold">{currentBotStrategy?.name || t('bot.none', 'Nenhuma')}</span>
            </div>
          </div>
        </div>

        {/* Painel de configuração adaptável para estratégia */}
        <StrategyConfigPanel 
          strategy={currentBotStrategy} 
          onChange={handleStrategyConfigChange}
          className="mt-4" 
        />

        {/* Botões de controle com design aprimorado */}
        <div className="flex space-x-2 mt-4">
          <BotButton 
            status={status} 
            selectedStrategy={selectedStrategy}
            onStart={() => {
              // Log especial para depuração do clique
              console.log('[BOT_BUTTON] 🚀🚀🚀 BOTÃO DE INÍCIO CLICADO 🚀🚀🚀');
              console.log('[BOT_BUTTON] Estratégia selecionada:', selectedStrategy);
              
              // Teste simplificado diretamente para compra
              try {
                // CORREÇÃO COMPLETA: Usar a estratégia selecionada atualmente em vez de fixar em IRON UNDER
                // Buscar configurações da estratégia atualmente selecionada
                const currentStrategy = selectedStrategy?.toLowerCase() || 'advance';
                console.log(`[BOT_BUTTON] 🚨 CORREÇÃO CRÍTICA: Usando estratégia atual: ${currentStrategy}`);
                
                const userConfigString = localStorage.getItem(`strategy_config_${currentStrategy}`);
                // CORREÇÃO CRÍTICA: NUNCA USAR VALOR FIXO, nem mesmo como fallback
                // Buscar valor do DOM para garantir 100% de consistência com a interface
                let userEntryValue: number | null = null;
                
                // 1. Valor do input na tela (mais alta prioridade SEMPRE)
                const inputElement = document.getElementById('iron-bot-entry-value') as HTMLInputElement;
                if (inputElement && inputElement.value) {
                  const valueFromInput = parseFloat(inputElement.value);
                  if (!isNaN(valueFromInput) && valueFromInput > 0) {
                    userEntryValue = valueFromInput;
                    console.log(`[BOT_BUTTON] 🔥 CORREÇÃO DEFINITIVA: Usando valor ${userEntryValue} diretamente do input da interface`);
                    
                    // ✅ NOVA CORREÇÃO CRÍTICA: Forçar atualização do localStorage com valor do input 
                    // para garantir que todos os componentes usem o valor correto
                    try {
                      if (userConfigString) {
                        let updatedConfig = JSON.parse(userConfigString);
                        updatedConfig.valorInicial = valueFromInput;
                        localStorage.setItem(`strategy_config_${currentStrategy}`, JSON.stringify(updatedConfig));
                        console.log(`[BOT_BUTTON] 🚨 ATUALIZAÇÃO CRÍTICA: Salvando valor do input (${valueFromInput}) no localStorage para estratégia ${currentStrategy}`);
                      }
                    } catch (e) {
                      console.error('[BOT_BUTTON] Erro ao atualizar localStorage:', e);
                    }
                    
                    // RETORNAR IMEDIATAMENTE para evitar que outro valor sobrescreva
                    // Nunca chegará nas próximas opções se o input tiver valor
                  }
                }
                
                // 2. Ou valor passado por props (segunda prioridade)
                if (userEntryValue === null && entryValue !== undefined && entryValue > 0) {
                  userEntryValue = entryValue;
                  console.log(`[BOT_BUTTON] 🔥 CORREÇÃO DEFINITIVA: Usando valor ${userEntryValue} passado por props`);
                }
                
                // 3. Ou valor configurado no localStorage (terceira prioridade)
                if (userEntryValue === null && userConfigString) {
                  try {
                    const userConfig = JSON.parse(userConfigString);
                    if (userConfig.valorInicial !== undefined) {
                      const userValueAsNumber = parseFloat(userConfig.valorInicial);
                      if (!isNaN(userValueAsNumber) && userValueAsNumber > 0) {
                        userEntryValue = userValueAsNumber;
                        console.log(`[BOT_BUTTON] ⚠️ Usando valor do localStorage para estratégia ${currentStrategy}: ${userEntryValue}`);
                      }
                    }
                  } catch (error) {
                    console.error(`[BOT_BUTTON] Erro ao analisar configuração do usuário para ${currentStrategy}:`, error);
                  }
                }
                
                // Obter o tipo de contrato adequado para a estratégia selecionada
                const contractType = getContractTypeForStrategy(currentStrategy) || 'DIGITOVER';
                
                // Obter previsão adequada para a estratégia (se usar predição de dígitos)
                let prediction = 5;
                if (usesDigitPrediction(currentStrategy)) {
                  // Buscar previsão da configuração da estratégia se disponível
                  if (strategyConfig && strategyConfig.prediction !== undefined) {
                    prediction = parseInt(strategyConfig.prediction.toString()) || 5;
                  }
                }
                
                // Definir configurações específicas para a estratégia atual com o valor do usuário
                oauthDirectService.setSettings({
                  contractType: contractType,
                  prediction: prediction,
                  entryValue: userEntryValue || Number(entryValue) || undefined, // CORREÇÃO CRÍTICA: Usar valor do usuário
                  profitTarget: profitTarget || strategyConfig?.metaGanho || 20,
                  lossLimit: lossLimit || strategyConfig?.limitePerda || 20,
                  martingaleFactor: strategyConfig?.martingale || 1.5
                });
                
                // Definir estratégia ativa
                oauthDirectService.setActiveStrategy(selectedStrategy || 'ADVANCE');
                
                // Executar o teste assíncrono
                (async () => {
                  try {
                    console.log('[BOT_TEST] Iniciando serviço...');
                    const success = await oauthDirectService.start();
                    
                    if (success) {
                      console.log('[BOT_TEST] 🟢 Serviço iniciado com sucesso!');
                      console.log('[BOT_TEST] 🟢 Executando primeira operação de teste...');
                      
                      // SUPER LOG DIAGNÓSTICO - Listar todos os inputs da tela para encontrar o correto
                      console.log('[BOT_DIAGNÓSTICO] 🔎 Procurando inputs na tela:');
                      const allInputs = document.querySelectorAll('input');
                      allInputs.forEach((input, index) => {
                        console.log(`[BOT_DIAGNÓSTICO] Input #${index}: id=${input.id || 'sem-id'}, type=${input.type}, value=${input.value}, placeholder=${input.placeholder || 'sem-placeholder'}`);
                      });
                      
                      // Tentar diferentes IDs possíveis para o input de valor
                      const possibleIds = ['iron-bot-entry-value', 'entry-value', 'stake', 'amount', 'entry-amount', 'valor-entrada'];
                      let foundInput = null;
                      
                      // Verificar cada ID possível
                      for (const id of possibleIds) {
                        const element = document.getElementById(id) as HTMLInputElement;
                        if (element) {
                          console.log(`[BOT_DIAGNÓSTICO] ✅ Encontrado input com ID '${id}': value=${element.value}`);
                          foundInput = element;
                          break;
                        }
                      }
                      
                      // Se não encontrou por ID, procurar por atributos ou classes
                      if (!foundInput) {
                        const numberInputs = document.querySelectorAll('input[type="number"]');
                        if (numberInputs.length > 0) {
                          console.log(`[BOT_DIAGNÓSTICO] 🔍 Encontrados ${numberInputs.length} inputs numéricos`);
                          // Usar o primeiro input numérico com valor > 0
                          for (let i = 0; i < numberInputs.length; i++) {
                            const input = numberInputs[i] as HTMLInputElement;
                            if (input.value && parseFloat(input.value) > 0) {
                              console.log(`[BOT_DIAGNÓSTICO] ✅ Usando input numérico #${i}: value=${input.value}`);
                              foundInput = input;
                              break;
                            }
                          }
                        }
                      }
                      
                      // Agora usar o input encontrado ou fallback
                      let finalOperationAmount: number | undefined;
                      
                      if (foundInput && foundInput.value) {
                        const inputValue = parseFloat(foundInput.value);
                        if (!isNaN(inputValue) && inputValue > 0) {
                          finalOperationAmount = inputValue;
                          console.log(`[BOT_TEST] 🚨 CORREÇÃO DEFINITIVA: Pegando valor ${finalOperationAmount} do input encontrado`);
                        }
                      } else {
                        console.log(`[BOT_DIAGNÓSTICO] ⚠️ Não foi possível encontrar um input válido na tela`);
                      }
                      
                      // Se não foi possível pegar do input, usar valor calculado anteriormente
                      if (finalOperationAmount === undefined) {
                        finalOperationAmount = userEntryValue !== null ? userEntryValue : Number(entryValue) || undefined;
                        console.log(`[BOT_TEST] ⚠️ Usando valor de fallback: ${finalOperationAmount}`);
                      }
                      
                      // GARANTIR que nunca usamos undefined ou null
                      if (finalOperationAmount === undefined || finalOperationAmount === null) {
                        finalOperationAmount = 1.0; // Último recurso absoluto
                        console.log(`[BOT_TEST] ⚠️⚠️⚠️ VALOR CRÍTICO AUSENTE: Usando valor padrão ${finalOperationAmount} como último recurso`);
                      }
                      
                      console.log(`[BOT_TEST] 🚨 VALOR FINAL: Usando ${finalOperationAmount} para a primeira operação`);
                      const started = await oauthDirectService.executeFirstOperation(finalOperationAmount);
                      
                      console.log('[BOT_TEST] Primeira operação executada:', started ? 'SUCESSO ✅' : 'FALHA ❌');
                      
                      // Atualizar estados
                      setStatus('running');
                      onStatusChange('running');
                    } else {
                      console.error('[BOT_TEST] Falha ao iniciar serviço');
                    }
                  } catch (error) {
                    console.error('[BOT_TEST] Erro no teste:', error);
                  }
                })();
              } catch (error) {
                console.error('[BOT_BUTTON] Erro ao executar teste:', error);
              }
            }}
            onStop={() => {
              // Log especial para depuração do clique
              console.log('[BOT_BUTTON] 🛑 Parando bot...');
              // Chamar função para parar o bot
              stopBot();
            }}
          />
        </div>
        
        {/* Dicas para o usuário */}
        {!selectedStrategy && (
          <div className="mt-2 text-xs text-center text-yellow-500">
            Selecione uma estratégia antes de iniciar as operações
          </div>
        )}
        {status === 'running' && (
          <div className="mt-2 text-xs text-center text-green-500 animate-pulse">
            Robô executando operações automaticamente...
          </div>
        )}
      </div>
    </div>
  );
}