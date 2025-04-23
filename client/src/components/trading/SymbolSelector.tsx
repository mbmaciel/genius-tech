import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Select, 
  SelectContent, 
  SelectGroup,
  SelectItem, 
  SelectLabel,
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { LoaderCircle } from 'lucide-react';
import { oauthDirectService } from '@/services/oauthDirectService';

interface Symbol {
  symbol: string;
  display_name: string;
  market?: string;
  market_display_name?: string;
}

interface SymbolSelectorProps {
  value: string;
  onChange: (symbol: string) => void;
  disabled?: boolean;
}

const defaultSymbols: Symbol[] = [
  { symbol: 'R_10', display_name: 'Volatility 10 (1s) Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'R_25', display_name: 'Volatility 25 (1s) Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'R_50', display_name: 'Volatility 50 (1s) Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'R_75', display_name: 'Volatility 75 (1s) Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'R_100', display_name: 'Volatility 100 (1s) Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'BOOM500', display_name: 'Boom 500 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'BOOM1000', display_name: 'Boom 1000 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'CRASH500', display_name: 'Crash 500 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
  { symbol: 'CRASH1000', display_name: 'Crash 1000 Index', market: 'synthetic_index', market_display_name: 'Synthetic Indices' },
];

const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [markets, setMarkets] = useState<Map<string, string>>(new Map());

  // Carregar os símbolos disponíveis
  useEffect(() => {
    const fetchSymbols = async () => {
      setIsLoading(true);
      try {
        const symbolsList = await oauthDirectService.getActiveSymbols();
        
        if (symbolsList && symbolsList.length > 0) {
          setSymbols(symbolsList);
          
          // Extrair mercados únicos
          const marketsMap = new Map<string, string>();
          symbolsList.forEach((symbol: Symbol) => {
            if (symbol.market && symbol.market_display_name) {
              marketsMap.set(symbol.market, symbol.market_display_name);
            }
          });
          setMarkets(marketsMap);
        } else {
          // Usar símbolos padrão se a API não retornar nada
          setSymbols(defaultSymbols);
          const defaultMarketsMap = new Map<string, string>();
          defaultSymbols.forEach(symbol => {
            if (symbol.market && symbol.market_display_name) {
              defaultMarketsMap.set(symbol.market, symbol.market_display_name);
            }
          });
          setMarkets(defaultMarketsMap);
        }
      } catch (error) {
        console.error('Erro ao carregar símbolos:', error);
        // Usar símbolos padrão em caso de erro
        setSymbols(defaultSymbols);
        const defaultMarketsMap = new Map<string, string>();
        defaultSymbols.forEach(symbol => {
          if (symbol.market && symbol.market_display_name) {
            defaultMarketsMap.set(symbol.market, symbol.market_display_name);
          }
        });
        setMarkets(defaultMarketsMap);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  // Agrupar símbolos por mercado
  const groupedSymbols = React.useMemo(() => {
    const grouped = new Map<string, Symbol[]>();
    
    symbols.forEach(symbol => {
      const market = symbol.market || 'other';
      if (!grouped.has(market)) {
        grouped.set(market, []);
      }
      grouped.get(market)!.push(symbol);
    });
    
    return grouped;
  }, [symbols]);

  return (
    <div>
      <Label htmlFor="symbol-select">{t('Símbolo')}</Label>
      <Select 
        value={value} 
        onValueChange={onChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="symbol-select">
          <SelectValue placeholder={t('Selecione um símbolo')}>
            {isLoading ? (
              <div className="flex items-center">
                <LoaderCircle className="h-4 w-4 mr-2 animate-spin" />
                {t('Carregando...')}
              </div>
            ) : (
              value
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Array.from(groupedSymbols.entries()).map(([market, marketSymbols]) => (
            <SelectGroup key={market}>
              <SelectLabel>{markets.get(market) || market}</SelectLabel>
              {marketSymbols.map(symbol => (
                <SelectItem key={symbol.symbol} value={symbol.symbol}>
                  {symbol.display_name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
          
          {symbols.length === 0 && !isLoading && (
            <SelectItem value="R_100" disabled>
              {t('Não foi possível carregar símbolos')}
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
};

export default SymbolSelector;