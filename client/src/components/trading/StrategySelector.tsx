import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface Strategy {
  id: string;
  name: string;
  description: string;
}

interface StrategySelectorProps {
  selectedStrategy: string;
  onChange: (strategy: string) => void;
  disabled?: boolean;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({ 
  selectedStrategy, 
  onChange,
  disabled = false 
}) => {
  const { t } = useTranslation();
  
  // Lista de estratégias disponíveis
  const strategies: Strategy[] = [
    { id: 'advance', name: 'Advance', description: 'Estratégia baseada em análise de frequência de dígitos' },
    { id: 'maxpro', name: 'MAXPRO', description: 'Estratégia otimizada para índices de volatilidade' },
    { id: 'bot_low', name: 'BOT LOW', description: 'Estratégia para operações de baixo valor' },
    { id: 'iron_over', name: 'IRON OVER', description: 'Estratégia Over especializada' },
    { id: 'iron_under', name: 'IRON UNDER', description: 'Estratégia Under especializada' },
    { id: 'manual_over', name: 'Manual Over', description: 'Configuração manual para operações Over' },
    { id: 'manual_under', name: 'Manual Under', description: 'Configuração manual para operações Under' },
  ];

  return (
    <div className="space-y-2">
      <Label htmlFor="strategy-select">{t('Estratégia')}</Label>
      <Select 
        value={selectedStrategy} 
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger id="strategy-select">
          <SelectValue placeholder={t('Selecione uma estratégia')} />
        </SelectTrigger>
        <SelectContent>
          {strategies.map(strategy => (
            <SelectItem 
              key={strategy.id} 
              value={strategy.id}
              title={strategy.description}
            >
              {strategy.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default StrategySelector;