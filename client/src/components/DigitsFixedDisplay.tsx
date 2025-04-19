import React, { useState, useEffect } from 'react';
import { oauthDirectService } from "@/services/oauthDirectService";
import { derivHistoryService } from "@/services/deriv-history-service";

export function DigitsFixedDisplay({ symbol = 'R_100' }: { symbol?: string }) {
  // Estados básicos
  const [digits, setDigits] = useState<number[]>([]);
  const [currentSampleSize, setCurrentSampleSize] = useState<number>(100);
  const [connected, setConnected] = useState<boolean>(Boolean(localStorage.getItem('deriv_oauth_token')));
  const [lastDigit, setLastDigit] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updateTime, setUpdateTime] = useState<Date>(new Date());
  const [rawData, setRawData] = useState<string>('');
  
  // Estado para as estatísticas
  const [digitCounts, setDigitCounts] = useState<number[]>(Array(10).fill(0));
  const [digitPercentages, setDigitPercentages] = useState<number[]>(Array(10).fill(0));
  
  // Função para extrair dígito de um preço
  const getLastDigit = (price: number): number => {
    const priceStr = price.toFixed(2);
    return parseInt(priceStr.charAt(priceStr.length - 1));
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
  
  // Usamos os serviços existentes em vez de criar uma nova conexão WebSocket
  useEffect(() => {
    console.log("[DIGIT_DISPLAY] Inicializando componente, reutilizando conexão OAuth existente");
    
    // Verificar se já existe uma conexão e se não, apenas atualizar a UI
    // O oauthDirectService não tem método isConnected direto, mas podemos verificar o estado
    const oauthConnected = Boolean(localStorage.getItem('deriv_oauth_token'));
    setConnected(oauthConnected);
    
    // Obter histórico de dígitos existente
    let historyDigits: number[] = [];
    try {
      // Tentar obter a partir do serviço ou extrair dos últimos ticks
      if (typeof derivHistoryService.getTicksHistory === 'function') {
        const ticksHistory = derivHistoryService.getTicksHistory(symbol);
        if (ticksHistory && ticksHistory.prices) {
          historyDigits = ticksHistory.prices.map((price: number) => getLastDigit(price)).reverse();
        }
      }
    } catch (err) {
      console.warn("[DIGIT_DISPLAY] Não foi possível obter histórico de ticks:", err);
    }
    
    if (historyDigits.length > 0) {
      setDigits(historyDigits);
      setIsLoading(false);
      setLastDigit(historyDigits[0]);
      
      // RESUMO DOS DADOS
      const latestDigits = historyDigits.slice(0, 20).join(', ');
      setRawData(latestDigits);
      
      // Calcular estatísticas iniciais
      calculateStats(historyDigits, currentSampleSize);
      setUpdateTime(new Date());
    }
    
    // Inscrever-se para atualizações de ticks usando o evento custom do serviço existente
    const tickHandler = (event: CustomEvent) => {
      const data = event.detail;
      if (data && data.tick && data.tick.symbol === symbol) {
        const price = parseFloat(data.tick.quote);
        const digit = getLastDigit(price);
        
        // Atualizar último dígito
        setLastDigit(digit);
        setConnected(true);
        
        // Atualizar lista completa
        setDigits(prevDigits => {
          const updatedDigits = [digit, ...prevDigits].slice(0, 500);
          
          // RESUMO DOS DADOS para diagnóstico
          const rawDataStr = updatedDigits.slice(0, Math.min(20, updatedDigits.length)).join(', ');
          setRawData(rawDataStr);
          
          // Calcular estatísticas - recalculamos explicitamente com o tamanho correto
          calculateStats(updatedDigits, currentSampleSize);
          
          return updatedDigits;
        });
        
        setUpdateTime(new Date());
        setIsLoading(false);
      }
      
      // Processar erros
      if (data && data.error) {
        console.error(`[DIGIT_DISPLAY] Erro: ${data.error.code} - ${data.error.message}`);
        setError(data.error.message);
      }
    };
    
    // Registrando escuta no evento de tick do serviço OAuth
    document.addEventListener('oauthTick', tickHandler as EventListener);
    
    // Iniciar a escuta de ticks (não inicia uma nova conexão, apenas garante que estamos ouvindo ticks)
    if (oauthConnected && typeof oauthDirectService.subscribeToTicks === 'function') {
      // Apenas notificar que queremos ouvir ticks, sem iniciar nova conexão
      oauthDirectService.subscribeToTicks(symbol);
    }
    
    // Limpar assinatura quando o componente for desmontado
    return () => {
      console.log("[DIGIT_DISPLAY] Componente desmontado, removendo ouvinte de eventos");
      document.removeEventListener('oauthTick', tickHandler as EventListener);
    };
  }, [symbol]);
  
  // Efeito para recalcular estatísticas quando o tamanho da amostra mudar
  useEffect(() => {
    if (digits.length > 0) {
      console.log(`[APP] Tamanho da amostra alterado para ${currentSampleSize}`);
      calculateStats(digits, currentSampleSize);
    }
  }, [currentSampleSize, digits]);
  
  return (
    <div className="bg-[#0e1a2e] text-white p-4 rounded-md">
      <div>
        <h1 className="text-xl font-bold mb-4 text-center">{symbol} - Análise de Dígitos</h1>
        
        {/* Status e controles */}
        <div className="flex justify-between items-center mb-4">
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
          <div className="flex justify-center mb-6">
            <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold animate-pulse">
              {lastDigit}
            </div>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-40">
            <div className="w-10 h-10 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin mb-4"></div>
            <p>Carregando dados do mercado...</p>
          </div>
        ) : (
          <>
            {/* Título*/}
            <div className="mb-4 text-center">
              <h2 className="text-lg font-semibold">Gráfico de barras ({currentSampleSize} ticks)</h2>
            </div>

            {/* Grade de fundo */}
            <div className="relative h-64 mb-4 bg-[#0d1c34] border border-gray-800 rounded">
              {/* Linhas de grade horizontais */}
              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 5, 10, 15, 20, 25, 30, 35].map((value) => (
                  <div 
                    key={`grid-${value}`} 
                    className="w-full border-t border-gray-800 relative" 
                    style={{ 
                      bottom: `${(value / 35) * 100}%`,
                      height: "1px",
                      marginTop: value === 0 ? "-1px" : "0"
                    }}
                  >
                    <span className="absolute -top-2 -left-6 text-xs text-gray-500">{value}%</span>
                  </div>
                ))}
              </div>
              
              {/* Barras verticais */}
              <div className="flex h-full px-4 pt-8 pb-8 justify-between items-end relative z-10">
                {digitPercentages.map((percentage, index) => {
                  // Cor da barra baseada no percentual
                  let barColor = "bg-blue-600";
                  
                  // Percentuais elevados ficam em vermelho para destacar
                  if (percentage > 13) barColor = "bg-amber-500";
                  if (percentage > 16) barColor = "bg-red-600";
                  
                  // Percentuais baixos ficam em verde
                  if (percentage < 7) barColor = "bg-green-500";
                  
                  return (
                    <div 
                      key={`stat-${index}`}
                      className="h-full flex flex-col items-center justify-end"
                      style={{ width: "8%" }}
                    >
                      {/* Porcentagem acima da barra */}
                      <div className="absolute top-2 text-xs font-semibold">
                        {percentage > 0 && `${percentage}%`}
                      </div>
                      
                      {/* Barra vertical - Definindo altura exata baseada no percentual */}
                      <div 
                        className={`w-full ${barColor} transition-all duration-300`}
                        style={{ 
                          // Regra de 3: Máximo 100% = 100% de altura, então percentage% = (percentage/100) * 100% altura
                          height: `${Math.max(1, percentage)}%`,
                        }}
                      />
                      
                      {/* Dígito abaixo da barra + contagem */}
                      <div className="absolute bottom-2 font-medium text-xs">
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
            
            {/* Legenda */}
            <div className="flex justify-center gap-4 text-sm text-gray-400 mb-4">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-600 rounded-sm mr-1"></div>
                <span>≥ 16%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-amber-500 rounded-sm mr-1"></div>
                <span>≥ 13%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-blue-600 rounded-sm mr-1"></div>
                <span>7-13%</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-sm mr-1"></div>
                <span>&lt; 7%</span>
              </div>
            </div>
            
            {/* Sequência de dígitos */}
            <div className="bg-[#0d1c34] border border-gray-800 rounded p-2 mb-4">
              <div className="tracking-widest text-lg font-mono text-center">
                {digits.slice(0, 20).map((digit, i) => (
                  <span key={`recent-${i}`} className={`inline-block mx-1 ${i === 0 ? 'text-yellow-400' : ''}`}>{digit}</span>
                ))}
              </div>
            </div>
            
            {/* Grid de dígitos reduzido para economizar espaço */}
            <div className="grid grid-cols-10 gap-1 mb-4">
              {digits.slice(0, 20).map((digit, index) => (
                <div 
                  key={`digit-grid-${index}`}
                  className={`h-6 flex items-center justify-center rounded font-mono font-bold text-xs
                    ${index === 0 ? 'bg-blue-600' : 'bg-[#1a2e4c]'}`}
                >
                  {digit}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}