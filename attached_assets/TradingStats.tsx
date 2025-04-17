import React, { useState } from 'react';
import { useEffect } from 'react';
import derivAPI from '../../lib/derivApi';

// Lista de estratégias disponíveis que estão presentes nos XMLs
const STRATEGIES = [
  { id: 'bot_low', name: 'BOT LOW', description: 'Estratégia para mercados em queda' },
  { id: 'iron_over', name: 'IRON OVER', description: 'Estratégia para ultrapassar resistências' },
  { id: 'iron_under', name: 'IRON UNDER', description: 'Estratégia para testar suportes' },
  { id: 'maxpro', name: 'MAXPRO', description: 'Estratégia para maximizar lucros em mercados voláteis' }
];

export default function TradingStats() {
  const [isLoading, setIsLoading] = useState(false);
  const [tradingEnabled, setTradingEnabled] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState(STRATEGIES[0].id);
  const [accountLimits, setAccountLimits] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Carregar limites da conta quando estiver autenticado
  useEffect(() => {
    if (derivAPI.isConnected) {
      fetchAccountLimits();
    }
  }, []);
  
  // Buscar limites da conta
  const fetchAccountLimits = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await derivAPI.send({
        get_limits: 1
      });
      
      if (response.get_limits) {
        setAccountLimits(response.get_limits);
      }
    } catch (error) {
      console.error('Erro ao buscar limites da conta:', error);
      setError('Falha ao carregar limites da conta');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Iniciar trading com a estratégia selecionada
  const startTrading = () => {
    setTradingEnabled(true);
    
    // Aqui seria implementada a lógica para carregar e executar o XML da estratégia
    console.log(`Iniciando estratégia: ${selectedStrategy}`);
    
    // Exibir toast ou notificação
    alert(`Estratégia ${selectedStrategy} iniciada`);
  };
  
  // Parar trading
  const stopTrading = () => {
    setTradingEnabled(false);
    
    // Aqui seria implementada a lógica para interromper a execução da estratégia
    console.log('Trading interrompido');
    
    // Exibir toast ou notificação
    alert('Trading interrompido');
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Controle de Trading</h2>
        
        {!isLoading && derivAPI.isConnected && (
          <button
            onClick={fetchAccountLimits}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            Atualizar Dados
          </button>
        )}
      </div>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {!derivAPI.isConnected ? (
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded mb-4">
          Conecte-se à sua conta Deriv para utilizar as funcionalidades de trading.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Estratégia
                </label>
                <select
                  value={selectedStrategy}
                  onChange={(e) => setSelectedStrategy(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  disabled={tradingEnabled || isLoading}
                >
                  {STRATEGIES.map((strategy) => (
                    <option key={strategy.id} value={strategy.id}>
                      {strategy.name} - {strategy.description}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex space-x-2">
                {!tradingEnabled ? (
                  <button
                    onClick={startTrading}
                    disabled={isLoading || !derivAPI.isConnected}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
                  >
                    Iniciar Trading
                  </button>
                ) : (
                  <button
                    onClick={stopTrading}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
                  >
                    Parar Trading
                  </button>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Limites da Conta
              </h3>
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              ) : accountLimits ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Depósito diário máximo:</span>
                    <span className="font-medium">
                      {accountLimits.daily_transfers?.max || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Limite de apostas por contrato:</span>
                    <span className="font-medium">
                      {accountLimits.payout || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Montante máximo por stake:</span>
                    <span className="font-medium">
                      {accountLimits.stake.max || 'N/A'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Montante mínimo por stake:</span>
                    <span className="font-medium">
                      {accountLimits.stake.min || 'N/A'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Nenhuma informação disponível
                </p>
              )}
            </div>
          </div>
          
          {tradingEnabled && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded">
              <div className="flex items-center">
                <div className="animate-pulse mr-2 h-3 w-3 rounded-full bg-blue-600"></div>
                <p>
                  Trading ativo utilizando a estratégia <strong>{STRATEGIES.find(s => s.id === selectedStrategy)?.name}</strong>
                </p>
              </div>
              <p className="text-xs mt-1">
                A estratégia está em execução. Você pode interromper a qualquer momento.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}