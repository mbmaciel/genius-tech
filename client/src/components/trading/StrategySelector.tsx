import React, { useState } from 'react';
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
import { 
  Bot, 
  Info,
  ChevronRight
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { strategies, Strategy } from '@/lib/strategiesConfig';

interface StrategyInfoCardProps {
  strategy: Strategy;
}

const StrategyInfoCard: React.FC<StrategyInfoCardProps> = ({ strategy }) => {
  const { t } = useTranslation();

  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold">{strategy.name}</h3>
        <Badge variant="outline">
          {strategy.type === 'advance' ? t('Avançada') : 
           strategy.type === 'custom' ? t('Personalizada') : 
           t('Padrão')}
        </Badge>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        {strategy.description}
      </p>
      
      {strategy.contractType && (
        <div className="flex items-center text-sm mb-2">
          <span className="font-medium mr-2">{t('Tipo de Contrato')}:</span>
          <Badge variant="secondary">{strategy.contractType}</Badge>
        </div>
      )}
      
      {strategy.entryCondition && (
        <div className="text-sm mb-2">
          <span className="font-medium mr-2">{t('Condição de Entrada')}:</span>
          <span>{strategy.entryCondition}</span>
        </div>
      )}
      
      <div className="text-sm text-muted-foreground">
        <span className="font-medium mr-2">{t('Arquivo')}:</span>
        <code className="text-xs bg-muted px-1 py-0.5 rounded">
          {strategy.xmlPath.split('/').pop()}
        </code>
      </div>
    </div>
  );
};

interface StrategyExplainerProps {
  strategies: Strategy[];
}

const StrategyExplainer: React.FC<StrategyExplainerProps> = ({ strategies }) => {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  // Filtra estratégias por tipo
  const filteredStrategies = selectedType 
    ? strategies.filter(s => s.type === selectedType)
    : strategies;

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <Button 
          variant={selectedType === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType(null)}
        >
          {t('Todas')}
        </Button>
        <Button 
          variant={selectedType === 'standard' ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType('standard')}
        >
          {t('Padrão')}
        </Button>
        <Button 
          variant={selectedType === 'advance' ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType('advance')}
        >
          {t('Avançada')}
        </Button>
        <Button 
          variant={selectedType === 'custom' ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedType('custom')}
        >
          {t('Personalizada')}
        </Button>
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {filteredStrategies.map(strategy => (
          <StrategyInfoCard key={strategy.id} strategy={strategy} />
        ))}
        
        {filteredStrategies.length === 0 && (
          <div className="text-center text-muted-foreground p-8">
            {t('Nenhuma estratégia encontrada')}
          </div>
        )}
      </div>
    </div>
  );
};

interface StrategySelectorProps {
  value: string;
  onChange: (strategyId: string) => void;
  disabled?: boolean;
}

const StrategySelector: React.FC<StrategySelectorProps> = ({
  value,
  onChange,
  disabled = false
}) => {
  const { t } = useTranslation();
  const [showInfo, setShowInfo] = useState(false);

  // Encontrar estratégia atual
  const currentStrategy = strategies.find(s => s.id === value) || null;

  return (
    <div>
      <div className="flex justify-between items-center">
        <Label htmlFor="strategy-select">{t('Estratégia')}</Label>
        
        <Dialog open={showInfo} onOpenChange={setShowInfo}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6" title={t('Informações sobre estratégias')}>
              <Info className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>{t('Estratégias Disponíveis')}</DialogTitle>
              <DialogDescription>
                {t('Informações sobre as estratégias disponíveis para o bot')}
              </DialogDescription>
            </DialogHeader>
            <StrategyExplainer strategies={strategies} />
          </DialogContent>
        </Dialog>
      </div>
      
      <div className="flex w-full gap-2 mt-1">
        <div className="flex-1">
          <Select 
            value={value} 
            onValueChange={onChange}
            disabled={disabled}
          >
            <SelectTrigger id="strategy-select">
              <SelectValue placeholder={t('Selecione uma estratégia')}>
                {currentStrategy?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{t('Estratégias Avançadas')}</SelectLabel>
                {strategies
                  .filter(s => s.type === 'advance')
                  .map(strategy => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      {strategy.name}
                      {strategy.contractType && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({strategy.contractType})
                        </span>
                      )}
                    </SelectItem>
                  ))}
              </SelectGroup>
              
              <SelectGroup>
                <SelectLabel>{t('Estratégias Padrão')}</SelectLabel>
                {strategies
                  .filter(s => s.type === 'standard')
                  .map(strategy => (
                    <SelectItem key={strategy.id} value={strategy.id}>
                      {strategy.name}
                      {strategy.contractType && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({strategy.contractType})
                        </span>
                      )}
                    </SelectItem>
                  ))}
              </SelectGroup>
              
              {strategies.some(s => s.type === 'custom') && (
                <SelectGroup>
                  <SelectLabel>{t('Personalizadas')}</SelectLabel>
                  {strategies
                    .filter(s => s.type === 'custom')
                    .map(strategy => (
                      <SelectItem key={strategy.id} value={strategy.id}>
                        {strategy.name}
                      </SelectItem>
                    ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        
        {currentStrategy && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="border rounded p-2 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-muted-foreground" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px]">
                <div>
                  <div className="font-semibold mb-1">{currentStrategy.name}</div>
                  <div className="text-xs mb-2">{currentStrategy.description}</div>
                  {currentStrategy.contractType && (
                    <Badge variant="secondary" className="mr-2">
                      {currentStrategy.contractType}
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {currentStrategy.type === 'advance' 
                      ? t('Avançada') 
                      : currentStrategy.type === 'custom' 
                        ? t('Personalizada') 
                        : t('Padrão')}
                  </Badge>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {currentStrategy?.entryCondition && (
        <div className="mt-1.5 text-xs text-muted-foreground flex items-center">
          <ChevronRight className="h-3 w-3 mr-1" />
          {currentStrategy.entryCondition}
        </div>
      )}
    </div>
  );
};

export default StrategySelector;