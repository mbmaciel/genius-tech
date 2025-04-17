import { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface RiskControlProps {
  onSettingsChange?: (settings: {
    entryValue: number;
    lossLimit: number;
    profitOption: string;
    martingaleFactor: number;
  }) => void;
}

export function RiskControl({ onSettingsChange }: RiskControlProps = {}) {
  const [entryValue, setEntryValue] = useState<string>('0.35');
  const [lossLimit, setLossLimit] = useState<string>('20');
  const [profitOption, setProfitOption] = useState<string>('mid');
  const [martingaleFactor, setMartingaleFactor] = useState<string>('0.4');
  const { toast } = useToast();
  
  // Efeito para notificar o componente pai quando os valores mudarem
  useEffect(() => {
    const entryValueNum = parseFloat(entryValue) || 0.35;
    const lossLimitNum = parseFloat(lossLimit) || 20;
    const martingaleFactorNum = parseFloat(martingaleFactor) || 0.4;
    
    if (onSettingsChange && entryValueNum >= 0.35) {
      onSettingsChange({
        entryValue: entryValueNum,
        lossLimit: lossLimitNum,
        profitOption,
        martingaleFactor: martingaleFactorNum
      });
    }
  }, [entryValue, lossLimit, profitOption, martingaleFactor, onSettingsChange]);

  const handleSaveSettings = () => {
    // Validar valor de entrada
    const entryValueNum = parseFloat(entryValue);
    if (isNaN(entryValueNum) || entryValueNum < 0.35) {
      toast({
        title: "Valor de entrada inválido",
        description: "O valor mínimo de entrada deve ser 0.35",
        variant: "destructive",
      });
      return;
    }

    // Validar limite de perda
    const lossLimitNum = parseFloat(lossLimit);
    if (isNaN(lossLimitNum) || lossLimitNum <= 0) {
      toast({
        title: "Limite de perda inválido",
        description: "Por favor, insira um valor positivo para o limite de perda",
        variant: "destructive",
      });
      return;
    }

    // Validar fator de Martingale
    const martingaleFactorNum = parseFloat(martingaleFactor);
    if (isNaN(martingaleFactorNum) || martingaleFactorNum < 0) {
      toast({
        title: "Fator de Martingale inválido",
        description: "Por favor, insira um valor positivo para o fator de Martingale",
        variant: "destructive",
      });
      return;
    }

    // Salvar configurações 
    const settings = {
      entryValue: entryValueNum,
      lossLimit: lossLimitNum,
      profitOption,
      martingaleFactor: martingaleFactorNum,
    };
    
    // Notificar o componente pai explicitamente ao clicar em Salvar
    if (onSettingsChange) {
      onSettingsChange(settings);
    }
    
    // Mostrar toast de confirmação
    toast({
      title: "Configurações salvas",
      description: "As configurações de risco foram atualizadas com sucesso.",
    });
  };

  return (
    <Card className="bg-[#0e1a33] border-gray-800">
      <CardContent className="p-5 space-y-4">
        <h3 className="text-white font-medium text-lg mb-4">Controle de Risco</h3>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="entry-value" className="text-white">
              Valor de entrada? (Mínimo de 0.35)
            </Label>
            <Input
              id="entry-value"
              type="number"
              min="0.35"
              step="0.01"
              value={entryValue}
              onChange={(e) => setEntryValue(e.target.value)}
              className="bg-[#1f3158] text-white border-gray-700"
              placeholder="0.35"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="loss-limit" className="text-white">
              Limite de Perda
            </Label>
            <Input
              id="loss-limit"
              type="number"
              min="0"
              step="0.01"
              value={lossLimit}
              onChange={(e) => setLossLimit(e.target.value)}
              className="bg-[#1f3158] text-white border-gray-700"
              placeholder="Ex: 50"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-white">
              Percentual de Lucro
            </Label>
            <RadioGroup 
              value={profitOption} 
              onValueChange={setProfitOption}
              className="flex space-x-2"
            >
              <div className="flex items-center space-x-2 bg-[#1f3158] p-2 rounded-md">
                <RadioGroupItem value="low" id="low" className="text-[#00e5b3]" />
                <Label htmlFor="low" className="text-white text-sm cursor-pointer">
                  Low 5%
                </Label>
              </div>
              <div className="flex items-center space-x-2 bg-[#1f3158] p-2 rounded-md">
                <RadioGroupItem value="mid" id="mid" className="text-[#00e5b3]" />
                <Label htmlFor="mid" className="text-white text-sm cursor-pointer">
                  Mid 10%
                </Label>
              </div>
              <div className="flex items-center space-x-2 bg-[#1f3158] p-2 rounded-md">
                <RadioGroupItem value="high" id="high" className="text-[#00e5b3]" />
                <Label htmlFor="high" className="text-white text-sm cursor-pointer">
                  High 15%
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="martingale-factor" className="text-white">
              Fator Martin Gale
            </Label>
            <Input
              id="martingale-factor"
              type="number"
              min="0"
              step="0.1"
              value={martingaleFactor}
              onChange={(e) => setMartingaleFactor(e.target.value)}
              className="bg-[#1f3158] text-white border-gray-700"
              placeholder="Ex: 0.4"
            />
          </div>
          
          <Button 
            onClick={handleSaveSettings}
            className="w-full mt-4 bg-[#00e5b3] hover:bg-opacity-80 text-black"
          >
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}