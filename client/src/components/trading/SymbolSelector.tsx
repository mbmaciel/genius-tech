import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

const symbolGroups = [
  {
    name: 'Índices Sintéticos',
    symbols: [
      { value: 'R_10', label: 'Volatilidade 10 Índice', description: 'Índice com volatilidade de 10%' },
      { value: 'R_25', label: 'Volatilidade 25 Índice', description: 'Índice com volatilidade de 25%' },
      { value: 'R_50', label: 'Volatilidade 50 Índice', description: 'Índice com volatilidade de 50%' },
      { value: 'R_75', label: 'Volatilidade 75 Índice', description: 'Índice com volatilidade de 75%' },
      { value: 'R_100', label: 'Volatilidade 100 Índice', description: 'Índice com volatilidade de 100%' },
    ]
  },
  {
    name: 'Contínuos',
    symbols: [
      { value: 'RDBEAR', label: 'Bear Market Índice', description: 'Simulação de mercado em queda' },
      { value: 'RDBULL', label: 'Bull Market Índice', description: 'Simulação de mercado em alta' },
    ]
  },
  {
    name: 'Crash/Boom',
    symbols: [
      { value: 'CRASH_1', label: 'Crash 1 Índice', description: 'Com quedas súbitas a cada ~1 períodos' },
      { value: 'BOOM_1', label: 'Boom 1 Índice', description: 'Com altas súbitas a cada ~1 períodos' },
      { value: 'CRASH_3', label: 'Crash 3 Índice', description: 'Com quedas súbitas a cada ~3 períodos' },
      { value: 'BOOM_3', label: 'Boom 3 Índice', description: 'Com altas súbitas a cada ~3 períodos' },
      { value: 'CRASH_500', label: 'Crash 500 Índice', description: 'Com quedas súbitas a cada ~500 períodos' },
      { value: 'BOOM_500', label: 'Boom 500 Índice', description: 'Com altas súbitas a cada ~500 períodos' },
    ]
  },
  {
    name: 'Mercados Reais',
    symbols: [
      { value: 'USDJPY', label: 'USD/JPY', description: 'Dólar vs. Iene Japonês' },
      { value: 'EURUSD', label: 'EUR/USD', description: 'Euro vs. Dólar' },
      { value: 'GBPUSD', label: 'GBP/USD', description: 'Libra vs. Dólar' },
      { value: 'AUDUSD', label: 'AUD/USD', description: 'Dólar Australiano vs. Dólar' },
    ]
  }
];

// Função para aplainar a lista de símbolos para pesquisa
const flatSymbols = symbolGroups.flatMap(group => 
  group.symbols.map(symbol => ({
    ...symbol,
    group: group.name
  }))
);

interface SymbolSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  
  // Encontrar o símbolo selecionado
  const selectedSymbol = flatSymbols.find(symbol => symbol.value === value);
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedSymbol ? (
            <div className="flex items-center">
              <span>{selectedSymbol.label}</span>
              <Badge variant="outline" className="ml-2 text-xs">
                {selectedSymbol.value}
              </Badge>
            </div>
          ) : (
            t('Selecione um símbolo')
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput placeholder={t('Pesquisar símbolo...')} className="border-0 focus:ring-0" />
          </div>
          <CommandEmpty>
            {t('Nenhum símbolo encontrado')}
          </CommandEmpty>
          <ScrollArea className="h-[300px]">
            {symbolGroups.map(group => (
              <CommandGroup key={group.name} heading={t(group.name)}>
                {group.symbols.map(symbol => (
                  <CommandItem
                    key={symbol.value}
                    value={symbol.value}
                    onSelect={() => {
                      onChange(symbol.value);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === symbol.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <div className="font-medium">
                        {symbol.label}
                        <Badge variant="outline" className="ml-2 text-xs">
                          {symbol.value}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {symbol.description}
                      </p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </ScrollArea>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SymbolSelector;