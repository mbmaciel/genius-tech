import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

// Lista de estratégias disponíveis
const strategies = [
  {
    id: 'advance',
    name: 'Advance',
    description: 'Monitora frequência de dígitos 0-1 e faz entradas quando abaixo do limiar',
    type: 'DIGITOVER',
    category: 'Análise de Dígitos',
    color: 'bg-blue-500'
  },
  {
    id: 'botlow',
    name: 'BOT LOW',
    description: 'Estratégia otimizada para mercados com tendência de queda',
    type: 'DIGITUNDER',
    category: 'Tendência',
    color: 'bg-red-500'
  },
  {
    id: 'maxpro',
    name: 'MAXPRO',
    description: 'Estratégia de alta frequência com entradas precisas',
    type: 'DIGITOVER',
    category: 'Alta Precisão',
    color: 'bg-green-500'
  },
  {
    id: 'ironover',
    name: 'IRON OVER',
    description: 'Estratégia robusta para mercados voláteis com viés de alta',
    type: 'DIGITOVER',
    category: 'Volatilidade',
    color: 'bg-purple-500'
  },
  {
    id: 'ironunder',
    name: 'IRON UNDER',
    description: 'Estratégia robusta para mercados voláteis com viés de baixa',
    type: 'DIGITUNDER',
    category: 'Volatilidade',
    color: 'bg-indigo-500'
  },
  {
    id: 'wisepro',
    name: 'WISE PRO TENDENCIA',
    description: 'Detecta e segue automaticamente a tendência do mercado',
    type: 'CALL/PUT',
    category: 'Tendência',
    color: 'bg-amber-500'
  },
  {
    id: 'manualover',
    name: 'Manual Over',
    description: 'Entradas manuais otimizadas para DIGITOVER',
    type: 'DIGITOVER',
    category: 'Manual',
    color: 'bg-lime-500'
  },
  {
    id: 'manualunder',
    name: 'Manual Under',
    description: 'Entradas manuais otimizadas para DIGITUNDER',
    type: 'DIGITUNDER',
    category: 'Manual',
    color: 'bg-orange-500'
  },
  {
    id: 'profitpro',
    name: 'Profitpro Atualizado',
    description: 'Versão atualizada com gerenciamento avançado de lucro',
    type: 'DIGITDIFF',
    category: 'Avançada',
    color: 'bg-teal-500'
  }
];

// Agrupar estratégias por categoria
const groupedStrategies = strategies.reduce((acc, strategy) => {
  if (!acc[strategy.category]) {
    acc[strategy.category] = [];
  }
  acc[strategy.category].push(strategy);
  return acc;
}, {} as Record<string, typeof strategies>);

// Props do componente
interface StrategySelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  
  // Encontrar a estratégia selecionada
  const selectedStrategy = strategies.find(strategy => strategy.id === value);
  
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
          {selectedStrategy ? (
            <div className="flex items-center">
              <span>{selectedStrategy.name}</span>
              <Badge 
                variant="outline" 
                className={`ml-2 text-xs ${selectedStrategy.type === 'DIGITOVER' ? 'text-green-500' : 
                  selectedStrategy.type === 'DIGITUNDER' ? 'text-red-500' : 'text-blue-500'}`}
              >
                {selectedStrategy.type}
              </Badge>
            </div>
          ) : (
            t('Selecione uma estratégia')
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder={t('Pesquisar estratégia...')} className="border-0 focus:ring-0" />
          <CommandEmpty>
            {t('Nenhuma estratégia encontrada')}
          </CommandEmpty>
          <ScrollArea className="h-[300px]">
            {Object.entries(groupedStrategies).map(([category, categoryStrategies]) => (
              <CommandGroup key={category} heading={t(category)}>
                {categoryStrategies.map(strategy => (
                  <CommandItem
                    key={strategy.id}
                    value={strategy.id}
                    onSelect={() => {
                      onChange(strategy.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === strategy.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div>
                      <div className="font-medium">
                        {strategy.name}
                        <Badge 
                          variant="outline" 
                          className={`ml-2 text-xs ${strategy.type === 'DIGITOVER' ? 'text-green-500' : 
                            strategy.type === 'DIGITUNDER' ? 'text-red-500' : 'text-blue-500'}`}
                        >
                          {strategy.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {strategy.description}
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

export default StrategySelector;