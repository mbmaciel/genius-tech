import React, { useState, useEffect } from 'react';
import derivAPI from '../../lib/derivApi';

interface Symbol {
  symbol: string;
  displayName: string;
  market: string;
  lastPrice: number | null;
  change: number | null;
  changePercent: number | null;
}

export default function SymbolsTable() {
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSymbolSubscriptions, setActiveSymbolSubscriptions] = useState<Record<string, number>>({});
  
  // Carregar símbolos na montagem
  useEffect(() => {
    fetchActiveSymbols();
    
    // Limpar assinaturas ao desmontar
    return () => {
      unsubscribeAll();
    };
  }, []);
  
  // Buscar símbolos ativos
  const fetchActiveSymbols = async () => {
    if (!derivAPI.isConnected) {
      setError("Conexão com a API não está disponível");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await derivAPI.send({
        active_symbols: "brief",
        product_type: "basic"
      });
      
      if (response.active_symbols) {
        // Processar apenas um subconjunto de símbolos para demonstração
        const filteredSymbols = response.active_symbols
          .filter((s: any) => 
            s.market === 'forex' || 
            s.market === 'indices' || 
            s.market === 'synthetic_index'
          )
          .slice(0, 10)
          .map((s: any) => ({
            symbol: s.symbol,
            displayName: s.display_name,
            market: s.market_display_name,
            lastPrice: null,
            change: null,
            changePercent: null
          }));
        
        setSymbols(filteredSymbols);
        
        // Inscrever-se para atualizações de preço para cada símbolo
        filteredSymbols.forEach(symbol => {
          subscribeToTicks(symbol.symbol);
        });
      }
    } catch (error) {
      console.error('Erro ao buscar símbolos ativos:', error);
      setError('Falha ao carregar símbolos. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Inscrever-se para atualizações de ticks para um símbolo
  const subscribeToTicks = async (symbol: string) => {
    try {
      const response = await derivAPI.send({
        ticks: symbol,
        subscribe: 1
      });
      
      if (response.subscription && response.subscription.id) {
        // Armazenar ID da assinatura
        setActiveSymbolSubscriptions(prev => ({
          ...prev,
          [symbol]: response.subscription.id
        }));
        
        // Atualizar preço inicial se disponível
        if (response.tick) {
          updateSymbolPrice(symbol, response.tick.quote);
        }
        
        // Configurar manipulador de eventos para atualizações de ticks
        const tickHandler = (event: any) => {
          const data = event.detail;
          if (data.tick && data.tick.symbol === symbol) {
            updateSymbolPrice(symbol, data.tick.quote);
          }
        };
        
        // Registrar manipulador de eventos
        document.addEventListener('deriv:tick', tickHandler);
        
        // Retornar função de limpeza
        return () => {
          document.removeEventListener('deriv:tick', tickHandler);
        };
      }
    } catch (error) {
      console.error(`Erro ao assinar ticks para ${symbol}:`, error);
    }
  };
  
  // Atualizar preço de um símbolo
  const updateSymbolPrice = (symbolCode: string, price: number) => {
    setSymbols(prevSymbols => {
      return prevSymbols.map(s => {
        if (s.symbol === symbolCode) {
          // Calcular variação se houver preço anterior
          const lastPrice = s.lastPrice;
          let change = null;
          let changePercent = null;
          
          if (lastPrice !== null) {
            change = price - lastPrice;
            changePercent = (change / lastPrice) * 100;
          }
          
          return {
            ...s,
            lastPrice: price,
            change,
            changePercent
          };
        }
        return s;
      });
    });
  };
  
  // Cancelar todas as assinaturas
  const unsubscribeAll = async () => {
    for (const symbol in activeSymbolSubscriptions) {
      try {
        await derivAPI.send({
          forget: activeSymbolSubscriptions[symbol]
        });
      } catch (error) {
        console.error(`Erro ao cancelar assinatura para ${symbol}:`, error);
      }
    }
    
    setActiveSymbolSubscriptions({});
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Símbolos Disponíveis</h2>
        
        <button
          onClick={fetchActiveSymbols}
          disabled={isLoading || !derivAPI.isConnected}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
        >
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Símbolo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Mercado</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Último Preço</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Variação</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {symbols.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  Nenhum símbolo disponível
                </td>
              </tr>
            ) : (
              symbols.map((symbol) => (
                <tr key={symbol.symbol} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {symbol.displayName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {symbol.market}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono">
                    {symbol.lastPrice !== null ? symbol.lastPrice.toFixed(5) : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                    {symbol.change !== null && symbol.changePercent !== null ? (
                      <div className={`inline-flex items-center ${symbol.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{symbol.change.toFixed(5)}</span>
                        <span className="ml-2">({symbol.change >= 0 ? '+' : ''}{symbol.changePercent.toFixed(2)}%)</span>
                        <span className="ml-1">
                          {symbol.change >= 0 ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          )}
                        </span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
    </div>
  );
}