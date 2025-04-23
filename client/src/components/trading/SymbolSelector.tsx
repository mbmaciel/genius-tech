import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { oauthDirectService } from '@/services/oauthDirectService';

interface Symbol {
  symbol: string;
  display_name: string;
  market: string;
  market_display_name: string;
}

interface SymbolSelectorProps {
  selectedSymbol: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}

const SymbolSelector: React.FC<SymbolSelectorProps> = ({ 
  selectedSymbol, 
  onChange,
  disabled = false 
}) => {
  const { t } = useTranslation();
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [markets, setMarkets] = useState<{ [key: string]: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  // Símbolos padrão se a API não retornar nenhum
  const defaultSymbols: Symbol[] = [
    { symbol: 'R_10', display_name: 'Volatility 10 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'R_25', display_name: 'Volatility 25 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'R_50', display_name: 'Volatility 50 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'R_75', display_name: 'Volatility 75 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'R_100', display_name: 'Volatility 100 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'BOOM500', display_name: 'Boom 500 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'BOOM1000', display_name: 'Boom 1000 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'CRASH500', display_name: 'Crash 500 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
    { symbol: 'CRASH1000', display_name: 'Crash 1000 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  ];

  useEffect(() => {
    const loadSymbols = async () => {
      setIsLoading(true);
      try {
        // Tenta carregar símbolos da API
        if (oauthDirectService.isAuthorized()) {
          try {
            const result = await oauthDirectService.getActiveSymbols();
            if (result && Array.isArray(result) && result.length > 0) {
              setSymbols(result);
              
              // Extrai mercados únicos
              const uniqueMarkets: { [key: string]: string } = {};
              result.forEach(symbol => {
                uniqueMarkets[symbol.market] = symbol.market_display_name;
              });
              setMarkets(uniqueMarkets);
              return;
            }
          } catch (error) {
            console.error("Erro ao carregar símbolos da API:", error);
          }
        }
        
        // Usa símbolos padrão se a API falhar ou não estiver autorizada
        setSymbols(defaultSymbols);
        
        // Extrai mercados únicos dos símbolos padrão
        const uniqueMarkets: { [key: string]: string } = {};
        defaultSymbols.forEach(symbol => {
          uniqueMarkets[symbol.market] = symbol.market_display_name;
        });
        setMarkets(uniqueMarkets);
      } catch (error) {
        console.error("Erro ao processar símbolos:", error);
        // Usa símbolos padrão em caso de erro
        setSymbols(defaultSymbols);
        
        // Extrai mercados únicos dos símbolos padrão
        const uniqueMarkets: { [key: string]: string } = {};
        defaultSymbols.forEach(symbol => {
          uniqueMarkets[symbol.market] = symbol.market_display_name;
        });
        setMarkets(uniqueMarkets);
      } finally {
        setIsLoading(false);
      }
    };

    loadSymbols();
    
    // Inscrever-se em eventos de autorização para atualizar símbolos 
    // quando o usuário se conectar/desconectar
    const handleAuthChange = () => {
      loadSymbols();
    };
    
    document.addEventListener('derivAuthChange', handleAuthChange);
    
    return () => {
      document.removeEventListener('derivAuthChange', handleAuthChange);
    };
  }, []);

  // Organiza símbolos por mercado para exibição
  const symbolsByMarket = symbols.reduce((acc, symbol) => {
    if (!acc[symbol.market]) {
      acc[symbol.market] = [];
    }
    acc[symbol.market].push(symbol);
    return acc;
  }, {} as { [key: string]: Symbol[] });

  return (
    <div className="space-y-2">
      <Label htmlFor="symbol-select">{t('Ativo')}</Label>
      <Select 
        value={selectedSymbol} 
        onValueChange={onChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="symbol-select">
          <SelectValue placeholder={t('Selecione um ativo')} />
        </SelectTrigger>
        <SelectContent>
          {Object.keys(symbolsByMarket).map(market => (
            <div key={market}>
              <div className="px-2 py-1.5 text-sm font-semibold bg-muted/50">
                {markets[market] || market}
              </div>
              {symbolsByMarket[market].map(symbol => (
                <SelectItem key={symbol.symbol} value={symbol.symbol}>
                  {symbol.display_name}
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SymbolSelector;