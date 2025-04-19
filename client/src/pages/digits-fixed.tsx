import React, { useState, useEffect, useRef } from 'react';

export default function DigitsFixed() {
  // Estados básicos
  const [digits, setDigits] = useState<number[]>([]);
  const [currentSampleSize, setCurrentSampleSize] = useState<number>(100);
  const [connected, setConnected] = useState<boolean>(false);
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updateTime, setUpdateTime] = useState<Date>(new Date());
  const [rawData, setRawData] = useState<string>('');
  
  // Estado para as estatísticas
  const [digitCounts, setDigitCounts] = useState<number[]>(Array(10).fill(0));
  const [digitPercentages, setDigitPercentages] = useState<number[]>(Array(10).fill(0));
  
  // Referência ao WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  
  // Função para extrair dígito de um preço
  const getLastDigit = (price: number): number => {
    const priceStr = price.toFixed(2);
    return parseInt(priceStr.charAt(priceStr.length - 1));
  };
  
  // Função principal para conectar ao WebSocket
  const connectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    console.log("[WS] Iniciando conexão...");
    
    try {
      const ws = new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=1089');
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log("[WS] Conexão aberta");
        setConnected(true);
        setError(null);
        
        // Solicitar histórico de ticks
        const request = {
          ticks_history: "R_100",
          adjust_start_time: 1,
          count: 500,
          end: "latest",
          start: 1,
          style: "ticks",
          subscribe: 1
        };
        
        ws.send(JSON.stringify(request));
        console.log("[WS] Solicitação enviada:", request);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Processar histórico inicial
          if (data.history && data.history.prices) {
            const prices = data.history.prices;
            console.log(`[HIST] Recebidos ${prices.length} preços`);
            
            // Extrair dígitos
            const extractedDigits = prices.map((price: number) => getLastDigit(price)).reverse();
            
            if (extractedDigits.length > 0) {
              setDigits(extractedDigits);
              setLastDigit(extractedDigits[0]);
              
              // RESUMO DOS DADOS para diagnóstico
              const rawDataStr = extractedDigits.slice(0, Math.min(20, extractedDigits.length)).join(', ');
              setRawData(rawDataStr);
              
              // Calcular estatísticas
              calculateStats(extractedDigits, currentSampleSize);
              
              setIsLoading(false);
              setUpdateTime(new Date());
            }
          }
          
          // Processar ticks em tempo real
          if (data.tick && data.tick.quote) {
            const price = parseFloat(data.tick.quote);
            const digit = getLastDigit(price);
            
            console.log(`[TICK] Preço: ${price}, Dígito: ${digit}`);
            
            // Atualizar último dígito
            setLastDigit(digit);
            
            // Atualizar lista completa
            setDigits(prevDigits => {
              const updatedDigits = [digit, ...prevDigits].slice(0, 500);
              
              // RESUMO DOS DADOS para diagnóstico
              const rawDataStr = updatedDigits.slice(0, Math.min(20, updatedDigits.length)).join(', ');
              setRawData(rawDataStr);
              
              // Calcular estatísticas
              calculateStats(updatedDigits, currentSampleSize);
              
              return updatedDigits;
            });
            
            setUpdateTime(new Date());
          }
          
          // Processar erros
          if (data.error) {
            console.error(`[API] Erro: ${data.error.code} - ${data.error.message}`);
            setError(data.error.message);
          }
        } catch (err) {
          console.error("[ERRO] Falha ao processar mensagem:", err);
        }
      };
      
      ws.onerror = (event) => {
        console.error("[WS] Erro na conexão:", event);
        setConnected(false);
        setError("Erro de conexão");
      };
      
      ws.onclose = (event) => {
        console.log(`[WS] Conexão fechada (código: ${event.code})`);
        setConnected(false);
        
        // Reconectar após 3 segundos
        setTimeout(() => {
          console.log("[WS] Tentando reconectar...");
          connectWebSocket();
        }, 3000);
      };
    } catch (err) {
      console.error("[ERRO] Falha ao configurar WebSocket:", err);
      setError("Falha ao configurar conexão");
    }
  };
  
  // Função para calcular estatísticas
  const calculateStats = (digitsArray: number[], sampleSize: number) => {
    // Garantir que estamos usando a quantidade correta de dígitos
    const actualSize = Math.min(sampleSize, digitsArray.length);
    const sample = digitsArray.slice(0, actualSize);
    
    console.log(`[STATS] Calculando para ${actualSize} dígitos`);
    console.log(`[STATS] Amostra: ${sample.slice(0, 10).join(',')}...`);
    
    // Reiniciar contadores
    const counts = Array(10).fill(0);
    
    // Contar ocorrências
    for (let i = 0; i < sample.length; i++) {
      const digit = sample[i];
      if (digit >= 0 && digit <= 9) {
        counts[digit]++;
      }
    }
    
    // Log detalhado das contagens
    console.log("[STATS] Contagens:", counts.join(','));
    
    // Total (deve ser igual ao sampleSize)
    const total = counts.reduce((sum, count) => sum + count, 0);
    console.log(`[STATS] Total contado: ${total}, esperado: ${actualSize}`);
    
    // Calcular percentuais
    const percentages = counts.map(count => Math.round((count / actualSize) * 100));
    
    // Log detalhado dos percentuais
    console.log("[STATS] Percentuais:", percentages.join(','));
    
    // Soma de percentuais (deve ser próxima de 100)
    const totalPercentage = percentages.reduce((sum, perc) => sum + perc, 0);
    console.log(`[STATS] Soma dos percentuais: ${totalPercentage}%`);
    
    // Atualizar estado
    setDigitCounts(counts);
    setDigitPercentages(percentages);
  };
  
  // Efeito para conectar ao WebSocket ao montar o componente
  useEffect(() => {
    console.log("[APP] Componente montado, iniciando conexão...");
    connectWebSocket();
    
    return () => {
      console.log("[APP] Componente desmontado, fechando conexão...");
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Efeito para recalcular estatísticas quando o tamanho da amostra mudar
  useEffect(() => {
    if (digits.length > 0) {
      console.log(`[APP] Tamanho da amostra alterado para ${currentSampleSize}`);
      calculateStats(digits, currentSampleSize);
    }
  }, [currentSampleSize]);
  
  return (
    <div className="min-h-screen bg-[#0e1a2e] text-white p-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">R_100 - Análise de Dígitos em Tempo Real</h1>
        
        {/* Status e controles */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span>
              {connected ? 'Conectado' : 'Desconectado'}
              {error && <span className="text-red-400 ml-2">({error})</span>}
            </span>
          </div>
          
          <div className="flex items-center space-x-4">
            <div>
              <label className="mr-2">Amostra:</label>
              <select 
                value={currentSampleSize}
                onChange={(e) => setCurrentSampleSize(Number(e.target.value))}
                className="bg-[#1a2e4c] border border-gray-700 rounded px-2 py-1"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
              </select>
            </div>
            
            <span className="text-sm text-gray-400">
              Atualizado: {updateTime.toLocaleTimeString()}
            </span>
          </div>
        </div>
        
        {/* Último dígito */}
        {lastDigit !== null && (
          <div className="flex justify-center mb-8">
            <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold animate-pulse">
              {lastDigit}
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin mb-4"></div>
            <p>Carregando dados do mercado...</p>
          </div>
        ) : (
          <>
            {/* Título*/}
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold mb-2">Gráfico de barras ({currentSampleSize} ticks)</h2>
            </div>

            {/* Grade de fundo */}
            <div className="relative h-80 mb-6 bg-[#0d1c34] border border-gray-800 rounded">
              {/* Linhas de grade horizontais */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 5, 10, 15, 20, 25, 30].map((value) => (
                  <div 
                    key={`grid-${value}`} 
                    className="w-full border-t border-gray-800 relative" 
                    style={{ 
                      bottom: `${(value / 30) * 100}%`,
                      height: "1px",
                      marginTop: value === 0 ? "-1px" : "0"
                    }}
                  >
                    <span className="absolute -top-2 -left-8 text-xs text-gray-500">{value}</span>
                  </div>
                ))}
              </div>
              
              {/* Barras verticais */}
              <div className="flex h-full px-4 pt-8 pb-8 justify-between items-end relative z-10">
                {digitPercentages.map((percentage, index) => {
                  // Cor da barra baseada no percentual
                  let barColor = "bg-blue-600";
                  if (percentage >= 20) barColor = "bg-red-600";
                  
                  return (
                    <div 
                      key={`stat-${index}`}
                      className="h-full flex flex-col items-center justify-end"
                      style={{ width: "8%" }}
                    >
                      {/* Porcentagem acima da barra */}
                      <div className="absolute top-2 text-sm font-semibold">
                        {percentage > 0 && `${percentage}%`}
                      </div>
                      
                      {/* Barra vertical */}
                      <div 
                        className={`w-full ${barColor} transition-all duration-300`}
                        style={{ 
                          height: `${Math.max(2, (percentage / 30) * 100)}%`,
                        }}
                      />
                      
                      {/* Dígito abaixo da barra + contagem */}
                      <div className="absolute bottom-2 font-medium">
                        {index}
                        <span className="text-xs text-gray-400 ml-1">
                          ({digitCounts[index]})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Dados brutos para diagnóstico */}
            <div className="bg-[#0d1c34] border border-gray-800 rounded p-3 mb-4">
              <h3 className="font-semibold mb-2">Dados brutos (últimos 20 dígitos):</h3>
              <div className="font-mono text-gray-300 overflow-x-auto">
                {rawData}
              </div>
            </div>
            
            {/* Sequência de dígitos */}
            <div className="bg-[#0d1c34] border border-gray-800 rounded p-3 mb-6">
              <div className="tracking-widest text-lg font-mono text-center">
                {digits.slice(0, 20).map((digit, i) => (
                  <span key={`recent-${i}`} className={`inline-block mx-1 ${i === 0 ? 'text-yellow-400' : ''}`}>{digit}</span>
                ))}
              </div>
            </div>
            
            {/* Legenda */}
            <div className="flex justify-center gap-4 text-sm text-gray-400 mb-6">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-600 rounded-sm mr-1"></div>
                <span>≥ 20%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-600 rounded-sm mr-1"></div>
                <span>≥ 10%</span>
              </div>
            </div>
            
            {/* Grid de dígitos */}
            <div className="grid grid-cols-10 gap-1 mb-6">
              {digits.slice(0, 30).map((digit, index) => (
                <div 
                  key={`digit-grid-${index}`}
                  className={`h-8 flex items-center justify-center rounded font-mono font-bold
                    ${index === 0 ? 'bg-blue-600' : 'bg-[#1a2e4c]'}`}
                >
                  {digit}
                </div>
              ))}
            </div>
            
            {/* Totais e Verificação */}
            <div className="bg-[#0d1c34] border border-gray-800 rounded p-3 mb-6">
              <h3 className="font-semibold mb-2">Verificação das estatísticas:</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-300">Dígitos totais: <span className="text-white">{digits.length}</span></p>
                  <p className="text-sm text-gray-300">Tamanho da amostra: <span className="text-white">{currentSampleSize}</span></p>
                  <p className="text-sm text-gray-300">Soma de todos os percentuais: <span className="text-white">{digitPercentages.reduce((sum, p) => sum + p, 0)}%</span></p>
                </div>
                <div>
                  <p className="text-sm text-gray-300">Total contado: <span className="text-white">{digitCounts.reduce((sum, c) => sum + c, 0)}</span></p>
                  <p className="text-sm text-gray-300">Média de percentual: <span className="text-white">{(digitPercentages.reduce((sum, p) => sum + p, 0) / 10).toFixed(1)}%</span></p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}