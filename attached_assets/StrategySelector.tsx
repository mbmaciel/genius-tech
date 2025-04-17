import React, { useState } from 'react';

interface Strategy {
  id: string;
  name: string;
  description: string;
  file: string;
  active?: boolean;
}

interface StrategySelectorProps {
  className?: string;
  onStrategySelect?: (strategy: Strategy) => void;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({ 
  className = '',
  onStrategySelect
}) => {
  // Lista de estratégias disponíveis
  const [strategies] = useState<Strategy[]>([
    {
      id: 'bot-low',
      name: 'Bot Low',
      description: 'Estratégia para operar em mercados com tendência de baixa',
      file: 'BOT LOW.xml'
    },
    {
      id: 'iron-under',
      name: 'Iron Under',
      description: 'Estratégia para operar abaixo de um nível de suporte',
      file: 'IRON UNDER.xml'
    },
    {
      id: 'iron-over',
      name: 'Iron Over',
      description: 'Estratégia para operar acima de um nível de resistência',
      file: 'IRON OVER.xml'
    },
    {
      id: 'max-pro',
      name: 'Max Pro',
      description: 'Estratégia avançada para maximizar lucros em mercados voláteis',
      file: 'MAXPRO .xml'
    },
    {
      id: 'green',
      name: 'Green',
      description: 'Estratégia para captura de tendências positivas',
      file: 'green.xml'
    },
    {
      id: 'profit-pro',
      name: 'Profit Pro AT',
      description: 'Estratégia de alta frequência para otimização de lucros',
      file: 'profitpro at.xml'
    }
  ]);
  
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Handler para seleção de estratégia
  const handleStrategySelect = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
    
    // Se houver callback, chamar
    if (onStrategySelect) {
      onStrategySelect(strategy);
    }
  };
  
  // Carregar conteúdo da estratégia XML
  const loadStrategyXML = async (strategyFile: string) => {
    try {
      // Aqui implantaremos a lógica para carregar o arquivo XML da estratégia
      console.log(`Carregando estratégia: ${strategyFile}`);
      
      // Simulação de carregamento da estratégia
      setError(null);
    } catch (error) {
      console.error('Erro ao carregar estratégia:', error);
      setError(`Falha ao carregar estratégia: ${(error as Error).message}`);
    }
  };
  
  return (
    <div className={`strategy-selector ${className} bg-opacity-10 bg-gray-800 p-4 rounded-lg shadow-md`}>
      <h3 className="text-lg font-semibold text-green-400 mb-4 pb-2 border-b border-gray-700">
        Estratégias de Trading
      </h3>
      
      {error && (
        <div className="text-red-400 text-sm mb-4 p-2 bg-red-400 bg-opacity-10 rounded">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-4">
        {strategies.map(strategy => (
          <div 
            key={strategy.id}
            className={`
              p-3 rounded border cursor-pointer transition-colors
              ${selectedStrategy?.id === strategy.id 
                ? 'border-green-500 bg-green-500 bg-opacity-10' 
                : 'border-gray-700 hover:border-green-500'}
            `}
            onClick={() => handleStrategySelect(strategy)}
          >
            <div className="flex justify-between items-start">
              <h4 className="font-medium">{strategy.name}</h4>
              {selectedStrategy?.id === strategy.id && (
                <span className="text-xs px-2 py-0.5 bg-green-500 text-black rounded">Selecionada</span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">{strategy.description}</p>
            <div className="text-xs text-gray-500 mt-2">Arquivo: {strategy.file}</div>
          </div>
        ))}
      </div>
      
      {selectedStrategy && (
        <div className="mt-4 flex justify-end">
          <button
            className="px-4 py-2 bg-green-500 text-black rounded hover:bg-green-600 transition-colors"
            onClick={() => loadStrategyXML(selectedStrategy.file)}
          >
            Carregar Estratégia
          </button>
        </div>
      )}
    </div>
  );
};

export default StrategySelector;