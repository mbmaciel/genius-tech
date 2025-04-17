import { useEffect, useState } from "react";
import { startKeepAlive, stopKeepAlive } from "@/lib/websocketKeepAlive";
import { useToast } from "@/hooks/use-toast";
import { DerivConnectButton } from "@/components/DerivConnectButton";

interface DigitData {
  digit: number;
  count: number;
  percentage: number;
}

export default function Dashboard() {
  const [digitStats, setDigitStats] = useState<DigitData[]>([]);
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  const [ticks, setTicks] = useState<number>(10);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const { toast } = useToast();
  
  // Efeito para verificar se já existe uma sessão autenticada
  useEffect(() => {
    const storedToken = localStorage.getItem('deriv_token');
    const storedAccountInfo = localStorage.getItem('deriv_account_info');
    
    if (storedToken && storedAccountInfo) {
      try {
        const parsedAccountInfo = JSON.parse(storedAccountInfo);
        setIsAuthenticated(true);
        setAccountInfo(parsedAccountInfo);
      } catch (error) {
        console.error('Erro ao processar dados de conta armazenados:', error);
      }
    }
  }, []);

  // Iniciar a conexão WebSocket quando o componente for montado
  useEffect(() => {
    // Iniciar a conexão WebSocket para dados R_100
    startKeepAlive();
    
    // Adicionar listener para eventos de tick
    const handleTick = (event: CustomEvent) => {
      const tick = event.detail.tick;
      if (tick && tick.symbol === 'R_100') {
        // Extrair o último dígito do tick
        const price = tick.quote;
        const lastDigit = Math.floor(price * 10) % 10;
        
        // Atualizar os últimos dígitos
        setLastDigits(prev => {
          const newDigits = [...prev, lastDigit];
          // Manter apenas os N últimos dígitos com base no valor de ticks
          return newDigits.slice(-parseInt(ticks.toString()));
        });
      }
    };
    
    // Registrar o evento personalizado
    document.addEventListener('deriv:tick', handleTick as EventListener);
    
    // Limpar ao desmontar
    return () => {
      document.removeEventListener('deriv:tick', handleTick as EventListener);
      stopKeepAlive();
    };
  }, [ticks]);
  
  // Calcular estatísticas dos dígitos quando lastDigits for atualizado
  useEffect(() => {
    if (lastDigits.length > 0) {
      const digitCounts = Array(10).fill(0);
      
      // Contar ocorrências de cada dígito
      lastDigits.forEach(digit => {
        digitCounts[digit]++;
      });
      
      // Calcular percentuais
      const stats = digitCounts.map((count, digit) => {
        const percentage = (count / lastDigits.length) * 100;
        return { digit, count, percentage: Math.round(percentage) };
      });
      
      setDigitStats(stats);
    }
  }, [lastDigits]);
  
  const handleTicksChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTicks = parseInt(e.target.value);
    setTicks(newTicks);
    // Limitar os dígitos existentes ao novo valor
    setLastDigits(prev => prev.slice(-newTicks));
  };
  
  // Função para obter a cor da barra com base no percentual
  const getBarColor = (percentage: number) => {
    if (percentage >= 30) return 'bg-red-600';
    if (percentage >= 20) return 'bg-red-500';
    if (percentage >= 15) return 'bg-red-400';
    if (percentage > 0) return 'bg-red-300';
    return 'bg-gray-300';
  };

  return (
    <div className="flex h-screen bg-[#0c1525]">
      {/* Sidebar/Menu lateral */}
      <div className="w-16 hover:w-48 transition-all duration-300 bg-[#0c1525] border-r border-[#1d2a45] flex flex-col items-center py-6 text-white overflow-hidden group">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center">
          <div className="w-10 h-10 rounded-md bg-indigo-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
            </svg>
          </div>
          <span className="ml-3 font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Genius Tech</span>
        </div>
        
        {/* Ícones de menu */}
        <div className="flex flex-col space-y-6 items-center w-full">
          <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Dashboard</span>
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
          <button className="w-full flex items-center px-3 py-2 text-white hover:bg-[#1d2a45] rounded-md transition-all duration-200 hover:scale-105">
            <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </div>
            <span className="ml-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300">Operações</span>
          </button>
        </div>
      </div>
      
      {/* Conteúdo principal */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl text-white font-semibold">Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            {!isAuthenticated ? (
              <DerivConnectButton 
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm py-2 px-4 rounded-md transition-all duration-200"
                onSuccess={(token, accountInfo) => {
                  setIsAuthenticated(true);
                  setAccountInfo(accountInfo);
                  toast({
                    title: "Conexão bem-sucedida",
                    description: `Conectado como ${accountInfo.email || accountInfo.loginid}`,
                  });
                }}
              />
            ) : (
              <div className="flex items-center space-x-4">
                <div className="bg-[#1d2a45] px-3 py-1 rounded-md text-white text-sm">
                  {accountInfo?.email || accountInfo?.loginid || 'Conectado'}
                </div>
                
                <button 
                  onClick={() => {
                    // Limpar dados de autenticação
                    localStorage.removeItem('deriv_token');
                    localStorage.removeItem('deriv_account_info');
                    setIsAuthenticated(false);
                    setAccountInfo(null);
                    
                    toast({
                      title: "Logout concluído",
                      description: "Você foi desconectado com sucesso.",
                    });
                  }}
                  className="text-white text-sm hover:underline"
                >
                  Logout DERIV
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Gráfico de barras */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg text-white font-medium">Gráfico de barras</h2>
              <select 
                className="bg-[#1d2a45] text-white text-sm rounded px-2 py-1 border border-[#3a4b6b]"
                value={ticks}
                onChange={handleTicksChange}
              >
                <option value="10">10 Ticks</option>
                <option value="25">25 Ticks</option>
                <option value="50">50 Ticks</option>
                <option value="100">100 Ticks</option>
              </select>
            </div>
            
            <div className="flex items-end h-64 space-x-3">
              {digitStats.map((stat) => (
                <div key={stat.digit} className="flex-1 flex flex-col items-center justify-end">
                  {/* Barra do gráfico */}
                  <div 
                    className={`w-full ${getBarColor(stat.percentage)}`} 
                    style={{ height: `${Math.max(5, stat.percentage)}%` }}
                  ></div>
                  
                  {/* Legenda (dígito) */}
                  <div className="mt-2 text-sm text-white">{stat.digit}</div>
                  
                  {/* Percentual */}
                  <div className="text-xs text-gray-400">{stat.percentage}%</div>
                </div>
              ))}
            </div>
            
            {/* Últimos dígitos */}
            <div className="mt-4 bg-[#1d2a45] p-2 rounded flex flex-wrap justify-center">
              {lastDigits.slice().reverse().map((digit, index) => (
                <span key={index} className="w-7 h-7 flex items-center justify-center text-white border border-[#3a4b6b] m-1 rounded-md">
                  {digit}
                </span>
              ))}
            </div>
          </div>
          
          {/* Gráfico Deriv */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <h2 className="text-lg text-white font-medium mb-4">Gráfico Deriv</h2>
            <div className="relative h-72 w-full bg-[#192339] rounded border border-[#2a3756] overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[#8492b4]">Carregando gráfico da Deriv...</span>
              </div>
              {/* Aqui seria renderizado o gráfico da Deriv */}
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