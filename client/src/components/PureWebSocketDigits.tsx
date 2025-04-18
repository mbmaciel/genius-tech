import { useState, useEffect, useCallback } from 'react';
import { Card } from "@/components/ui/card";

/**
 * Componente que estabelece sua própria conexão WebSocket direta
 * Sem depender de serviços externos ou estados compartilhados
 */
export function PureWebSocketDigits() {
  const [digits, setDigits] = useState<number[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  // Função para estabelecer conexão
  const connectWebSocket = useCallback(() => {
    setStatus('connecting');
    setError(null);
    
    try {
      console.log('[PURE_WS] Iniciando conexão WebSocket direta');
      const socket = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      
      socket.onopen = () => {
        console.log('[PURE_WS] Conexão estabelecida com sucesso');
        setStatus('connected');
        
        // Subscrever para ticks do R_100
        const request = {
          ticks: 'R_100',
          subscribe: 1
        };
        socket.send(JSON.stringify(request));
        console.log('[PURE_WS] Solicitação de ticks enviada');
      };
      
      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.msg_type === 'tick') {
            const price = parseFloat(data.tick.quote);
            const priceStr = price.toString();
            const lastDigit = parseInt(priceStr.charAt(priceStr.length - 1));
            
            console.log(`[PURE_WS] Tick recebido: ${price}, último dígito: ${lastDigit}`);
            
            if (!isNaN(lastDigit)) {
              setDigits(prev => [lastDigit, ...prev].slice(0, 20));
              setLastUpdate(new Date());
            }
          }
        } catch (err) {
          console.error('[PURE_WS] Erro ao processar mensagem:', err);
        }
      };
      
      socket.onerror = (event) => {
        console.error('[PURE_WS] Erro na conexão WebSocket:', event);
        setStatus('disconnected');
        setError('Ocorreu um erro na conexão');
      };
      
      socket.onclose = () => {
        console.log('[PURE_WS] Conexão WebSocket fechada');
        setStatus('disconnected');
      };
      
      // Configurar intervalo de ping para manter conexão viva
      const pingInterval = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ ping: 1 }));
        }
      }, 30000);
      
      // Função de limpeza para fechar conexão
      return () => {
        console.log('[PURE_WS] Limpando conexão');
        clearInterval(pingInterval);
        socket.close();
      };
    } catch (err) {
      console.error('[PURE_WS] Erro ao configurar WebSocket:', err);
      setStatus('disconnected');
      setError('Falha ao iniciar conexão');
      return () => {}; // Retornar função vazia em caso de erro
    }
  }, []);
  
  // Conectar ao montar o componente
  useEffect(() => {
    const cleanup = connectWebSocket();
    return cleanup;
  }, [connectWebSocket]);
  
  // Função para obter cor do dígito
  const getDigitColor = (digit: number): string => {
    if (digit === 0 || digit === 5) {
      return "bg-blue-500 text-white"; // Azul para 0 e 5
    } else if (digit % 2 === 0) {
      return "bg-red-500 text-white";  // Vermelho para pares
    } else {
      return "bg-green-500 text-white"; // Verde para ímpares
    }
  };
  
  // Reconectar em caso de erro
  const handleReconnect = () => {
    connectWebSocket();
  };
  
  return (
    <Card className="bg-slate-900 p-4 shadow-lg border border-slate-800">
      <div className="mb-3 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${
            status === 'connected' ? 'bg-green-500' : 
            status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
          }`}></div>
          <span className="text-xs text-slate-400">
            {status === 'connected' ? 'Conectado' : 
             status === 'connecting' ? 'Conectando...' : 'Desconectado'}
          </span>
        </div>
        
        {status !== 'connected' && (
          <button 
            onClick={handleReconnect}
            className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-2 py-1 rounded"
          >
            Reconectar
          </button>
        )}
      </div>
      
      {error && (
        <div className="text-red-400 text-xs mb-3">
          Erro: {error}
        </div>
      )}
      
      <div className="flex flex-wrap justify-center gap-1.5 mb-3">
        {digits.length > 0 ? (
          digits.map((digit, index) => (
            <div 
              key={`pure-digit-${index}-${digit}-${lastUpdate.getTime()}`}
              className={`${getDigitColor(digit)} w-8 h-8 flex items-center justify-center rounded-full font-bold transition-all duration-300 shadow-md`}
            >
              {digit}
            </div>
          ))
        ) : (
          <div className="text-slate-500">Aguardando ticks...</div>
        )}
      </div>
      
      <div className="text-center text-xs text-slate-500">
        Componente WebSocket puro • Última atualização: {lastUpdate.toLocaleTimeString()}
      </div>
    </Card>
  );
}