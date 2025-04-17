import React, { useState, useEffect, useRef } from 'react';
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OperationStatus } from "@/components/OperationStatus";
import { initStrategyLoader } from "@/utils/strategyLoader";

export function BotPage() {
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  
  // Estado para autenticação e dados da conta
  const [accountInfo, setAccountInfo] = useState<any>(null);
  
  // Estado para controle do robô
  const [botStatus, setBotStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  
  // Estados para dados do gráfico
  const [ticks, setTicks] = useState<string>("10");
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [digitStats, setDigitStats] = useState<{
    digit: number;
    count: number;
    percentage: number;
  }[]>(Array.from({ length: 10 }, (_, i) => ({ 
    digit: i, 
    count: 0, 
    percentage: 0 
  })));
  
  // Estados para configurações do bot
  const [entryValue, setEntryValue] = useState<string>("0.35");
  const [profitTarget, setProfitTarget] = useState<string>("");
  const [lossLimit, setLossLimit] = useState<string>("");
  const [virtualLoss, setVirtualLoss] = useState<string>("");
  const [selectedBotType, setSelectedBotType] = useState<"lite" | "premium" | "">("");
  const [selectedStrategy, setSelectedStrategy] = useState<string>("");
  
  // Definir estratégias disponíveis
  const strategies = {
    lite: [
      { id: "profitpro", name: "Profit Pro", file: "Profitpro Atualizado.xml" },
      { id: "manualunder", name: "Manual Under", file: "Manual Under.xml" },
      { id: "advance", name: "Advance", file: "Advance .xml" },
      { id: "wisetendencia", name: "Wise Pro Tendência", file: "WISE PRO TENDENCIA.xml" }
    ],
    premium: [
      { id: "ironover", name: "Iron Over", file: "IRON OVER.xml" },
      { id: "ironunder", name: "Iron Under", file: "IRON UNDER.xml" },
      { id: "botlow", name: "Bot Low", file: "BOT LOW.xml" },
      { id: "maxpro", name: "Max Pro", file: "MAXPRO .xml" },
      { id: "green", name: "Green", file: "green.xml" },
      { id: "manualover", name: "Manual Over", file: "manual Over.xml" }
    ]
  };
  
  // Estado para operações
  const [operation, setOperation] = useState<{
    entry: number;
    buyPrice: number;
    profit: number;
    status: 'comprado' | 'vendendo' | null;
  }>({
    entry: 1584.42,
    buyPrice: 0,
    profit: 0,
    status: null
  });
  
  // Estado para estatísticas
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0
  });
  
  // Estado para saldo em tempo real
  const [realTimeBalance, setRealTimeBalance] = useState<{
    balance: number;
    previousBalance: number;
  }>({
    balance: 0,
    previousBalance: 0
  });

  // Verificar autenticação e carregar dados iniciais
  useEffect(() => {
    // Verificar se há informações de conta no localStorage
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    if (storedAccountInfo) {
      try {
        const parsedInfo = JSON.parse(storedAccountInfo);
        setAccountInfo(parsedInfo);
        
        // Configurar valores iniciais
        setOperation(prev => ({
          ...prev,
          buyPrice: parseFloat(entryValue) || 0
        }));
        
        // Iniciar conexão WebSocket para R_100
        setupWebSocket();
        
        return () => {
          // Limpar WebSocket ao desmontar
          cleanup();
        };
      } catch (error) {
        console.error('Erro ao carregar dados da conta:', error);
      }
    } else {
      // Redirecionar para a página de login se não autenticado
      window.location.href = '/';
    }
  }, []);
  
  // Função para configurar WebSocket
  const setupWebSocket = () => {
    if (wsRef.current) return;
    
    try {
      console.log('[R100] Conectando ao WebSocket da Deriv...');
      wsRef.current = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      
      wsRef.current.onopen = () => {
        console.log('[R100] Conexão estabelecida com sucesso!');
        
        // Autorizar com token (usando o token dedicado para R_100)
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            authorize: 'jybcQm0FbKr7evp' // Token fixo para R_100
          }));
        }
        
        // Resetar contagem de tentativas
        reconnectAttemptsRef.current = 0;
      };
      
      wsRef.current.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          
          // Resposta de autorização
          if (data.msg_type === 'authorize') {
            console.log('[R100] Autenticação bem-sucedida!');
            // Inscrever-se para receber ticks do R_100
            subscribeToTicks();
            // Inscrever-se para atualizações de saldo
            requestBalance();
          }
          
          // Resposta de saldo
          if (data.msg_type === 'balance') {
            console.log('[R100] Atualização de saldo recebida:', data.balance);
            if (accountInfo && data.balance) {
              const newBalance = parseFloat(data.balance.balance);
              const currentBalance = parseFloat(accountInfo.balance);
              
              // Atualizar informações da conta apenas se o saldo mudou
              if (newBalance !== currentBalance) {
                setAccountInfo({
                  ...accountInfo,
                  balance: newBalance.toFixed(2)
                });
                
                // Atualizar saldo em tempo real
                setRealTimeBalance({
                  balance: newBalance,
                  previousBalance: currentBalance
                });
                
                console.log(`[R100] Saldo atualizado: ${currentBalance} -> ${newBalance}`);
              }
            }
          }
          
          // Resposta de tick
          if (data.msg_type === 'tick') {
            const price = data.tick.quote;
            const lastDigit = Math.floor(price * 100) % 10;
            
            // Atualizar últimos dígitos
            setLastDigits(prev => {
              const updated = [lastDigit, ...prev];
              return updated.slice(0, 20);
            });
            
            // Atualizar estatísticas de dígitos
            updateDigitStats(lastDigit);
            
            // Simular operação se o bot estiver rodando
            if (botStatus === 'running') {
              simulateOperation();
            }
          }
          
        } catch (error) {
          console.error('[R100] Erro ao processar mensagem:', error);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('[R100] Erro na conexão:', error);
        cleanup();
        scheduleReconnect();
      };
      
      wsRef.current.onclose = () => {
        console.log('[R100] WebSocket fechado e recursos liberados');
        wsRef.current = null;
        scheduleReconnect();
      };
      
    } catch (error) {
      console.error('[R100] Erro ao configurar WebSocket:', error);
      scheduleReconnect();
    }
  };
  
  // Função para limpar recursos
  const cleanup = () => {
    if (wsRef.current) {
      console.log('[R100] Parando sistema de keep-alive');
      wsRef.current.close();
      wsRef.current = null;
    }
  };
  
  // Função para agendar reconexão
  const scheduleReconnect = () => {
    if (reconnectAttemptsRef.current >= 10) {
      console.log('[R100] Número máximo de tentativas de reconexão atingido.');
      return;
    }
    
    const delay = 2000; // 2 segundos
    reconnectAttemptsRef.current += 1;
    
    console.log(`[R100] Agendando reconexão em ${delay/1000}s (tentativa ${reconnectAttemptsRef.current}/10)`);
    
    setTimeout(() => {
      console.log(`[R100] Tentativa de reconexão ${reconnectAttemptsRef.current}/10...`);
      setupWebSocket();
    }, delay);
  };
  
  // Inscrever-se para ticks do R_100
  const subscribeToTicks = () => {
    if (!wsRef.current) return;
    
    wsRef.current.send(JSON.stringify({
      ticks: 'R_100',
      subscribe: 1
    }));
    
    console.log('[R100] Inscrito em R_100 em tempo real');
  };
  
  // Atualizar estatísticas de dígitos
  const updateDigitStats = (newDigit: number) => {
    setDigitStats(prev => {
      // Contagem de dígitos nos últimos ticks
      const counts: number[] = Array(10).fill(0);
      const updatedLastDigits = [newDigit, ...lastDigits].slice(0, parseInt(ticks));
      
      updatedLastDigits.forEach(d => {
        if (d >= 0 && d <= 9) counts[d]++;
      });
      
      // Cálculo de percentuais
      const total = updatedLastDigits.length;
      return prev.map((stat, i) => ({
        digit: i,
        count: counts[i],
        percentage: total > 0 ? Math.round((counts[i] / total) * 100) : 0
      }));
    });
  };
  
  // Função para executar operações reais utilizando a API Deriv
  const simulateOperation = () => {
    // Verificar se o bot está executando e tem uma estratégia selecionada
    if (botStatus !== 'running' || !selectedStrategy) {
      return;
    }
    
    // Verificar se já estamos processando uma operação para evitar duplicatas
    if (operation.status === 'comprado') {
      return;
    }
    
    // Aumentar a chance de uma operação para demonstração
    if (Math.random() > 0.85) {
      console.log("[BOT] Executando operação real de trading com estratégia:", selectedStrategy);
      
      const entryNum = parseFloat(entryValue || "0.35");
      
      // Determinar o tipo de contrato com base na estratégia
      const contractType = selectedBotType === "lite" ? 
                           (selectedStrategy.includes('under') ? 'DIGITUNDER' : 'DIGITOVER') : 
                           selectedStrategy.includes('under') ? 'DIGITUNDER' : 'DIGITOVER';
      
      // Determinar o dígito com base no último dígito recebido do stream de ticks
      const targetDigit = lastDigits.length > 0 ? lastDigits[0] : 5; // valor padrão 5 se não houver dígitos
      
      // Enviar solicitação de compra de contrato
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        const buyParams = {
          buy: 1,
          price: entryNum,
          parameters: {
            contract_type: contractType,
            symbol: "R_100",
            duration: 5,
            duration_unit: "t",
            barrier: targetDigit.toString(), // Usar o último dígito como barreira
            currency: accountInfo?.currency || "USD"
          }
        };
        
        // Atualizar estado de operação
        setOperation({
          entry: operation.entry,
          buyPrice: entryNum,
          profit: 0,
          status: 'comprado'
        });
        
        // Exibir notificação de compra
        toast({
          title: "Enviando ordem",
          description: `Comprando ${contractType} sobre ${targetDigit} por $${entryNum}`,
        });
        
        console.log("[BOT] Enviando ordem de compra:", buyParams);
        
        // Enviar solicitação de compra para a API
        wsRef.current.send(JSON.stringify(buyParams));
        
        // Configurar listener para resposta da compra
        const buyResponseHandler = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            
            // Verificar se é uma resposta de compra
            if (data.msg_type === 'buy') {
              console.log("[BOT] Resposta de compra recebida:", data);
              
              if (data.error) {
                // Erro na compra
                toast({
                  title: "Erro na compra",
                  description: data.error.message || "Não foi possível executar a compra",
                  variant: "destructive",
                });
                
                setOperation({
                  ...operation,
                  status: null
                });
                
              } else if (data.buy) {
                // Compra bem-sucedida
                const contractId = data.buy.contract_id;
                const buyPrice = data.buy.buy_price;
                
                toast({
                  title: "Contrato comprado",
                  description: `ID: ${contractId}, Valor: $${buyPrice}`,
                });
                
                // Monitorar contrato para atualizar resultado
                monitorContract(contractId);
              }
            }
            
            // Verificar se é uma atualização de contrato
            if (data.msg_type === 'proposal_open_contract') {
              const contract = data.proposal_open_contract;
              
              if (contract.contract_id && contract.is_sold === 1) {
                // Contrato foi encerrado
                const isWin = contract.profit >= 0;
                const profit = parseFloat(contract.profit);
                
                // Atualizar estatísticas
                if (isWin) {
                  setStats(prev => ({ ...prev, wins: prev.wins + 1 }));
                  setOperation({
                    entry: operation.entry,
                    buyPrice: entryNum,
                    profit: profit,
                    status: 'vendendo'
                  });
                  
                  // Exibir notificação de ganho
                  toast({
                    title: "Operação Vencedora!",
                    description: `Lucro: $${profit.toFixed(2)} (+${((profit/entryNum)*100).toFixed(2)}%)`,
                    variant: "default",
                  });
                } else {
                  setStats(prev => ({ ...prev, losses: prev.losses + 1 }));
                  setOperation({
                    entry: operation.entry,
                    buyPrice: entryNum,
                    profit: profit, // Profit é negativo quando há perda
                    status: 'comprado'
                  });
                  
                  // Exibir notificação de perda
                  toast({
                    title: "Operação Perdedora",
                    description: `Perda: $${Math.abs(profit).toFixed(2)}`,
                    variant: "destructive",
                  });
                }
                
                // Atualizar saldo em tempo real
                if (accountInfo) {
                  // Verificar saldo atual (fazer uma solicitação de saldo)
                  requestBalance();
                }
                
                // Remover listener após conclusão
                wsRef.current?.removeEventListener('message', buyResponseHandler);
              }
            }
          } catch (error) {
            console.error("[BOT] Erro ao processar resposta da API:", error);
          }
        };
        
        // Adicionar listener temporário
        wsRef.current.addEventListener('message', buyResponseHandler);
        
        // Remover listener após 2 minutos para evitar acúmulo
        setTimeout(() => {
          wsRef.current?.removeEventListener('message', buyResponseHandler);
        }, 120000);
      } else {
        toast({
          title: "Erro de conexão",
          description: "WebSocket não está conectado. Tente novamente.",
          variant: "destructive",
        });
      }
    }
  };
  
  // Função para monitorar contrato específico
  const monitorContract = (contractId: number) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      proposal_open_contract: 1,
      contract_id: contractId,
      subscribe: 1
    }));
    
    console.log(`[BOT] Monitorando contrato ID: ${contractId}`);
  };
  
  // Função para solicitar atualização de saldo
  const requestBalance = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    wsRef.current.send(JSON.stringify({
      balance: 1,
      subscribe: 1
    }));
    
    console.log("[BOT] Solicitando atualização de saldo");
  };
  
  // Iniciar o bot
  const handleStartBot = () => {
    if (!selectedBotType || !selectedStrategy) {
      toast({
        title: "Seleção necessária",
        description: "Por favor, selecione um tipo de bot e uma estratégia.",
        variant: "destructive"
      });
      return;
    }
    
    // Atualizar estado do bot
    setBotStatus('running');
    setOperation({
      entry: 1584.42,
      buyPrice: parseFloat(entryValue),
      profit: 0,
      status: 'comprado'
    });
    
    // Solicitar saldo atual em tempo real
    if (accountInfo) {
      // Solicitar saldo atualizado da API
      requestBalance();
      
      // Mostrar informação de início de operação
      console.log("[BOT] Bot de trading iniciado com as seguintes configurações:");
      console.log(`[BOT] - Estratégia: ${selectedStrategy}`);
      console.log(`[BOT] - Valor de entrada: ${entryValue || "0.35"}`);
      console.log(`[BOT] - Meta de lucro: ${profitTarget || "N/A"}`);
      console.log(`[BOT] - Limite de perdas: ${lossLimit || "N/A"}`);
    }
    
    const strategyInfo = strategies[selectedBotType].find(s => s.id === selectedStrategy);
    
    toast({
      title: "Bot iniciado",
      description: `Robô ${strategyInfo?.name} está operando agora.`,
    });
  };
  
  // Pausar o bot
  const handlePauseBot = () => {
    setBotStatus('paused');
    
    toast({
      title: "Bot pausado",
      description: "As operações foram pausadas.",
    });
  };
  
  // Limpar histórico
  const handleClearHistory = () => {
    setStats({ wins: 0, losses: 0 });
    setOperation({
      entry: 1584.42,
      buyPrice: parseFloat(entryValue),
      profit: 0,
      status: null
    });
    
    toast({
      title: "Histórico limpo",
      description: "O histórico de operações foi limpo.",
    });
  };
  
  // Função para obter a cor da barra com base na porcentagem
  const getBarColor = (percentage: number) => {
    return percentage >= 20 ? 'bg-red-500' : 'bg-gray-500';
  };
  
  // Renderizar botão de ação principal (Executar/Pausar)
  const renderActionButton = () => {
    if (botStatus === 'running') {
      return (
        <button 
          onClick={handlePauseBot}
          className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-2 px-4 rounded font-medium"
        >
          Pausar BOT
        </button>
      );
    } else {
      return (
        <button 
          onClick={handleStartBot}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded font-medium"
        >
          Executar BOT
        </button>
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0a1324]">
      {/* Barra Lateral */}
      <div className="w-16 group hover:w-56 transition-all duration-300 ease-in-out bg-[#13203a] flex flex-col items-center py-6 overflow-hidden">
        <div className="flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="24" height="24" rx="12" fill="#4F46E5" />
            <path d="M16.5 8.25H13.5L12 6.75L10.5 8.25H7.5L6 9.75V12.75L7.5 14.25V17.25L9 18.75H15L16.5 17.25V14.25L18 12.75V9.75L16.5 8.25Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 12.75C12.8284 12.75 13.5 12.0784 13.5 11.25C13.5 10.4216 12.8284 9.75 12 9.75C11.1716 9.75 10.5 10.4216 10.5 11.25C10.5 12.0784 11.1716 12.75 12 12.75Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 12.75V15.75" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="ml-3 font-bold text-white text-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">Genius Trading</span>
        </div>
        
        {/* Links de navegação */}
        <div className="w-full">
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105 mb-2">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Dashboard</span>
          </button>
          
          <button className="w-full flex items-center px-3 py-2 text-white bg-indigo-600 rounded-md transition-all duration-200 hover:scale-105 mb-2">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Automações</span>
          </button>
          
          <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Perfil</span>
          </button>
        </div>
      </div>
      
      {/* Conteúdo Principal */}
      <div className="flex-1 p-6">
        {/* Header - Informações da conta */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Robô de Automações</h1>
          
          <div className="flex items-center">
            {accountInfo && (
              <div className="flex items-center mr-4 bg-[#13203a] rounded-md px-3 py-2 border border-[#2a3756]">
                <div className="flex items-center">
                  <div className={`w-2 h-2 rounded-full mr-2 ${accountInfo.isVirtual ? 'bg-blue-500' : 'bg-green-500'}`}></div>
                  <div className="text-sm text-white mr-3">
                    {accountInfo.loginid}
                  </div>
                </div>
                <div className="mx-2 h-4 border-r border-[#3a4b6b]"></div>
                <div className="flex items-center">
                  <div className="text-xs text-gray-400 mr-1">Tipo:</div>
                  <div className="text-sm text-white mr-3">
                    {accountInfo.isVirtual ? 'Demo' : 'Real'}
                  </div>
                </div>
                <div className="mx-2 h-4 border-r border-[#3a4b6b]"></div>
                <div className="flex items-center">
                  <div className="text-xs text-gray-400 mr-1">Saldo:</div>
                  <div className="text-sm font-medium text-white">
                    {accountInfo.balance} <span className="text-xs">{accountInfo.currency}</span>
                  </div>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => window.location.href = '/'}
              className="bg-[#1d2a45] text-white py-2 px-3 rounded-md border border-[#3a4b6b] hover:bg-[#2a3756] transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
        
        {/* Grade Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coluna Esquerda - Configurações do bot e operações */}
          <div className="space-y-6">
            {/* Seleção de Bots */}
            <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
              <h2 className="text-lg text-white font-medium mb-4">Selecione um bot:</h2>
              <div>
                <button 
                  onClick={() => {
                    if (botStatus !== 'running') {
                      setSelectedBotType("lite");
                      setSelectedStrategy("");
                    } else {
                      toast({
                        title: "Bot em execução",
                        description: "Pause o bot antes de trocar de estratégia.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className={`w-full text-left mb-2 p-3 rounded ${selectedBotType === "lite" ? "bg-blue-600" : "bg-[#1d2a45]"} text-white`}
                >
                  {selectedBotType === "lite" && selectedStrategy ? 
                    strategies.lite.find(s => s.id === selectedStrategy)?.name : 
                    "Lite Bots"}
                </button>
                <button 
                  onClick={() => {
                    if (botStatus !== 'running') {
                      setSelectedBotType("premium");
                      setSelectedStrategy("");
                    } else {
                      toast({
                        title: "Bot em execução",
                        description: "Pause o bot antes de trocar de estratégia.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className={`w-full text-left p-3 rounded ${selectedBotType === "premium" ? "bg-purple-600" : "bg-[#1d2a45]"} text-white`}
                >
                  {selectedBotType === "premium" && selectedStrategy ? 
                    strategies.premium.find(s => s.id === selectedStrategy)?.name : 
                    "Premium Bots"}
                </button>
              </div>
              
              {selectedBotType && !selectedStrategy && (
                <div className="mt-4">
                  <h3 className="text-sm text-gray-400 mb-2">Escolha uma estratégia:</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {strategies[selectedBotType].map(strategy => (
                      <button
                        key={strategy.id}
                        onClick={() => {
                          if (botStatus !== 'running') {
                            setSelectedStrategy(strategy.id);
                          } else {
                            toast({
                              title: "Bot em execução",
                              description: "Pause o bot antes de trocar de estratégia.",
                              variant: "destructive"
                            });
                          }
                        }}
                        className={`text-left p-2 rounded text-white text-sm ${
                          selectedStrategy === strategy.id ? "bg-indigo-600" : "bg-[#1d2a45]"
                        }`}
                      >
                        {strategy.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedStrategy && (
                <div className="mt-4">
                  <div className="flex justify-between">
                    <h3 className="text-sm text-gray-400">Estratégia selecionada:</h3>
                    {botStatus !== 'running' ? (
                      <button 
                        onClick={() => setSelectedStrategy("")}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Trocar estratégia
                      </button>
                    ) : (
                      <span className="text-xs text-yellow-400">
                        (Pause o bot para trocar)
                      </span>
                    )}
                  </div>
                  <div className="mt-2 p-3 rounded bg-indigo-600 text-white flex justify-between items-center">
                    <span className="font-medium">
                      {selectedBotType === "lite" 
                        ? strategies.lite.find(s => s.id === selectedStrategy)?.name 
                        : strategies.premium.find(s => s.id === selectedStrategy)?.name}
                    </span>
                    <span className="text-xs bg-indigo-700 px-2 py-1 rounded">
                      {selectedBotType === "lite" ? "Lite" : "Premium"}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Configurações de Trading */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <h2 className="text-lg text-white font-medium mb-4">Qual o valor de entrada?</h2>
                <Input
                  type="number"
                  value={entryValue}
                  onChange={e => setEntryValue(e.target.value)}
                  placeholder="0.35"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
              
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <h2 className="text-lg text-white font-medium mb-4">Adicionar Virtual Loss?</h2>
                <Input
                  value={virtualLoss}
                  onChange={e => setVirtualLoss(e.target.value)}
                  placeholder="Digite o número do Virtual Loss"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <h2 className="text-lg text-white font-medium mb-4">Meta de Lucro</h2>
                <Input
                  value={profitTarget}
                  onChange={e => setProfitTarget(e.target.value)}
                  placeholder="Qual é a meta de lucro?"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
              
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <h2 className="text-lg text-white font-medium mb-4">Limite de Perdas Seguidas</h2>
                <Input
                  value={lossLimit}
                  onChange={e => setLossLimit(e.target.value)}
                  placeholder="Qual o limite de perdas seguidas?"
                  className="bg-[#1d2a45] border-[#3a4b6b] text-white"
                />
              </div>
            </div>
            
            {/* Informações de Conta e Estatísticas */}
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <div className="flex items-center">
                  <div className="mr-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M16 12h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
                      <path d="M12 6v2m0 12v-2"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Balanço USD</div>
                    <div className={`text-lg font-medium ${
                      realTimeBalance.balance > (realTimeBalance.previousBalance || 0) 
                        ? 'text-green-500' 
                        : realTimeBalance.balance < (realTimeBalance.previousBalance || 0)
                          ? 'text-red-500'
                          : 'text-white'
                    }`}>
                      $ {accountInfo?.balance || '0.00'}
                      {realTimeBalance.balance !== realTimeBalance.previousBalance && realTimeBalance.previousBalance && (
                        <span className="text-xs ml-1">
                          ({realTimeBalance.balance > realTimeBalance.previousBalance ? '+' : ''}
                          {(realTimeBalance.balance - realTimeBalance.previousBalance).toFixed(2)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <div className="flex items-center">
                  <div className="mr-3">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Lucro/Perdas</div>
                    <div className={`text-lg font-medium ${operation.profit > 0 ? 'text-green-500' : 'text-white'}`}>
                      $ {operation.profit.toFixed(2)} ({operation.profit > 0 ? '+' : ''}
                      {operation.buyPrice ? ((operation.profit / operation.buyPrice) * 100).toFixed(2) : '0.00'}%)
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Área de operações - Aparece quando o bot está rodando */}
            {botStatus !== 'idle' && (
              <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
                <h2 className="text-lg text-white font-medium mb-4">
                  {operation.status === 'comprado' ? 'Comprado' : 'Vendendo'}
                </h2>
                <div className="bg-[#1d2a45] rounded-md overflow-hidden">
                  <div className="grid grid-cols-3 text-sm text-gray-400 p-3 border-b border-[#2a3756]">
                    <div>Entrada</div>
                    <div>Preço de compra</div>
                    <div>Lucro/Perda</div>
                  </div>
                  <div className="grid grid-cols-3 p-3 text-white">
                    <div>{operation.entry.toFixed(2)}</div>
                    <div>{operation.buyPrice.toFixed(2)}</div>
                    <div className={operation.profit > 0 ? 'text-green-500' : ''}>
                      {operation.profit.toFixed(2)}
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between mt-4">
                  <div>
                    <span className="text-sm text-gray-400 mr-1">Ganhos:</span>
                    <span className="font-medium text-white">{stats.wins}</span>
                  </div>
                  <div>
                    <span className="text-sm text-gray-400 mr-1">Perdas:</span>
                    <span className="font-medium text-white">{stats.losses}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Botões de Ação */}
            <div className="flex space-x-4">
              {renderActionButton()}
              
              <button 
                onClick={handleClearHistory}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded font-medium"
              >
                Limpar Histórico
              </button>
            </div>
          </div>
          
          {/* Coluna Direita - Gráficos */}
          <div className="space-y-6">
            {/* Gráfico Deriv */}
            <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
              <h2 className="text-lg text-white font-medium mb-4">Gráfico Deriv</h2>
              <div className="relative w-full rounded border border-[#192339] overflow-hidden" style={{ height: "320px" }}>
                <iframe 
                  src="https://charts.deriv.com/deriv/?market=synthetic_index&symbol=R_25&interval=24h&chart_type=line&theme=dark&toolbar=1&show_formula=0&candles=false" 
                  className="absolute inset-0 w-full h-full"
                  style={{ border: "none", background: "#0f1b31" }}
                  title="Volatility 25 Index Chart"
                  allow="fullscreen"
                ></iframe>
              </div>
            </div>
            
            {/* Gráfico de Barras */}
            <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg text-white font-medium">Gráfico de barras</h2>
                <Select value={ticks} onValueChange={setTicks}>
                  <SelectTrigger className="bg-[#1d2a45] border-[#3a4b6b] text-white h-8 text-xs w-24">
                    <SelectValue>{ticks} Ticks</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#1d2a45] border-[#3a4b6b] text-white">
                    <SelectItem value="10">10 Ticks</SelectItem>
                    <SelectItem value="25">25 Ticks</SelectItem>
                    <SelectItem value="50">50 Ticks</SelectItem>
                    <SelectItem value="100">100 Ticks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="relative">
                {/* Legendas do eixo Y */}
                <div className="flex flex-col justify-between absolute left-0 top-0 h-48 text-xs text-gray-400 py-2">
                  <div>50</div>
                  <div>40</div>
                  <div>30</div>
                  <div>20</div>
                  <div>10</div>
                  <div>0</div>
                </div>
                
                {/* Gráfico de barras */}
                <div className="pl-8 h-48">
                  <div className="flex justify-between items-end h-full">
                    {digitStats.map((stat) => (
                      <div key={stat.digit} className="flex flex-col items-center">
                        {stat.percentage > 0 && (
                          <div className="text-xs font-medium text-white mb-1">
                            {stat.percentage}%
                          </div>
                        )}
                        <div 
                          className={`w-7 ${getBarColor(stat.percentage)}`}
                          style={{ 
                            height: stat.percentage === 0 ? '0px' : `${Math.min(100, Math.max(4, stat.percentage * 2))}px` 
                          }}
                        ></div>
                        <div className="mt-1 text-sm text-white">{stat.digit}</div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Legenda */}
                <div className="flex items-center justify-end my-3">
                  <div className="w-3 h-3 bg-red-500 mr-1"></div>
                  <span className="text-xs text-gray-400">Últimos {ticks} Dígitos (%)</span>
                </div>
              </div>
              
              {/* Últimos dígitos */}
              <div className="bg-[#1d2a45] p-2 rounded flex flex-wrap justify-center mt-2">
                {lastDigits.map((digit, index) => (
                  <span key={index} className="w-7 h-7 flex items-center justify-center text-white border border-[#3a4b6b] m-1 rounded-md">
                    {digit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Estatísticas e tabelas de operações */}
        <div className="grid grid-cols-2 gap-6 mt-6">
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg text-white font-medium">Comprado</h2>
              <h2 className="text-lg text-white font-medium">Vendendo</h2>
              <h2 className="text-lg text-white font-medium">Vendido</h2>
            </div>
            
            <div className="bg-[#1d2a45] rounded-md overflow-hidden">
              <div className="grid grid-cols-3 text-sm text-gray-400 p-3 border-b border-[#2a3756]">
                <div>Entrada</div>
                <div>Preço de compra</div>
                <div>Lucro/Perda</div>
              </div>
              <div className="grid grid-cols-3 p-3 text-white">
                <div>1507.03</div>
                <div>{parseFloat(entryValue || "0.35")}</div>
                <div className="text-green-500">{operation.profit ? operation.profit.toFixed(2) : "0.30"}</div>
              </div>
            </div>
            
            <div className="flex justify-between mt-3">
              <div className="flex items-center">
                <span className="text-sm text-gray-400 mr-2">Ganhos:</span>
                <span className="font-medium text-white text-lg">{stats.wins || 1}</span>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-400 mr-2">Perdas:</span>
                <span className="font-medium text-white text-lg">{stats.losses || 0}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 mr-2 rounded-full"></div>
                <h2 className="text-white font-medium">Balanço USD</h2>
              </div>
              <div className={`text-xl font-bold ${
                realTimeBalance.balance > (realTimeBalance.previousBalance || 0) 
                  ? 'text-green-500' 
                  : realTimeBalance.balance < (realTimeBalance.previousBalance || 0)
                    ? 'text-red-500'
                    : 'text-white'
              }`}>
                $ {accountInfo?.balance || '174.06'}
                {realTimeBalance.balance !== realTimeBalance.previousBalance && realTimeBalance.previousBalance && (
                  <span className="text-sm ml-1">
                    ({realTimeBalance.balance > realTimeBalance.previousBalance ? '+' : ''}
                    {(realTimeBalance.balance - realTimeBalance.previousBalance).toFixed(2)})
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 mr-2 rounded-full"></div>
                <h2 className="text-white font-medium">Lucro/Perdas</h2>
              </div>
              <div className="text-xl font-bold text-green-500">
                $ {operation.profit ? operation.profit.toFixed(2) : "0.30"} (+0.03%)
              </div>
            </div>
          </div>
        </div>
        
        {/* Aviso de risco */}
        <div className="bg-[#13203a] rounded-lg p-4 mt-6 text-xs text-[#8492b4] leading-relaxed">
          <p>
            AVISO DE RISCO: Os produtos disponibilizados através deste site incluem opções binárias, contratos por diferenças ("CFDs") e outros derivativos complexos. A negociação de opções binárias pode não ser adequada para todos. A negociação de CFDs implica um elevado grau de risco, uma vez que a alavancagem pode trabalhar tanto para a sua vantagem como para a sua desvantagem. Como resultado, os produtos disponibilizados neste site podem não ser adequados para todo o tipo de investidor, devido ao risco de se perder todo o capital investido. Nunca se deve investir dinheiro que precisa e nunca se deve negociar com dinheiro emprestado. Antes de negociar os complexos produtos disponibilizados, certifique-se de que compreende os riscos envolvidos e aprenda mais sobre a negociação responsável.
          </p>
        </div>
      </div>
    </div>
  );
}