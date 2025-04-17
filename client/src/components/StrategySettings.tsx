import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "lucide-react";
import { BinaryBotStrategy, BotConfig } from "../lib/automationService";

interface StrategySettingsProps {
  strategy: BinaryBotStrategy | null;
  config: BotConfig | null;
  onConfigChange: (config: BotConfig) => void;
  disabled?: boolean;
  onReset?: () => void;
}

export function StrategySettings({ 
  strategy, 
  config, 
  onConfigChange, 
  disabled = false,
  onReset
}: StrategySettingsProps) {
  // Função para atualizar uma configuração específica
  const updateConfig = (key: keyof BotConfig, value: number) => {
    if (!config) return;
    
    onConfigChange({
      ...config,
      [key]: value
    });
  };

  return (
    <Card className="bg-[#1a2234] border-[#2a3756]">
      <CardHeader>
        <CardTitle>Configurações da Estratégia</CardTitle>
        <CardDescription>
          Ajuste os parâmetros para otimizar sua operação
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!strategy && (
          <div className="text-center py-8 text-gray-400">
            <SettingsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma estratégia para configurar</p>
          </div>
        )}
        
        {strategy && config && (
          <>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="initialStake">Entrada Inicial</Label>
                  <span className="text-sm text-gray-400">{config.initialStake} USD</span>
                </div>
                <Slider 
                  id="initialStake"
                  min={0.35} 
                  max={10} 
                  step={0.05} 
                  value={[config.initialStake]} 
                  onValueChange={(values) => updateConfig('initialStake', values[0])}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="martingaleFactor">Fator de Martingale</Label>
                  <span className="text-sm text-gray-400">x{config.martingaleFactor}</span>
                </div>
                <Slider 
                  id="martingaleFactor"
                  min={0.2} 
                  max={3} 
                  step={0.1} 
                  value={[config.martingaleFactor]} 
                  onValueChange={(values) => updateConfig('martingaleFactor', values[0])}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="maxMartingaleLevel">Nível de Martingale</Label>
                  <span className="text-sm text-gray-400">{config.maxMartingaleLevel}</span>
                </div>
                <Slider 
                  id="maxMartingaleLevel"
                  min={1} 
                  max={5} 
                  step={1} 
                  value={[config.maxMartingaleLevel]} 
                  onValueChange={(values) => updateConfig('maxMartingaleLevel', Math.round(values[0]))}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="targetProfit">Meta de Lucro</Label>
                  <span className="text-sm text-gray-400">{config.targetProfit} USD</span>
                </div>
                <Slider 
                  id="targetProfit"
                  min={1} 
                  max={50} 
                  step={1} 
                  value={[config.targetProfit]} 
                  onValueChange={(values) => updateConfig('targetProfit', values[0])}
                  disabled={disabled}
                />
              </div>
              
              <div>
                <div className="flex justify-between mb-2">
                  <Label htmlFor="stopLoss">Stop Loss</Label>
                  <span className="text-sm text-gray-400">{config.stopLoss} USD</span>
                </div>
                <Slider 
                  id="stopLoss"
                  min={1} 
                  max={50} 
                  step={1} 
                  value={[config.stopLoss]} 
                  onValueChange={(values) => updateConfig('stopLoss', values[0])}
                  disabled={disabled}
                />
              </div>
              
              {strategy.type !== 'RISE' && strategy.type !== 'FALL' && strategy.type !== 'ADVANCED' && (
                <div>
                  <div className="flex justify-between mb-2">
                    <Label htmlFor="prediction">Previsão (Dígito)</Label>
                    <span className="text-sm text-gray-400">
                      {config.prediction !== undefined ? config.prediction : 'N/A'}
                    </span>
                  </div>
                  <Slider 
                    id="prediction"
                    min={0} 
                    max={9} 
                    step={1} 
                    value={[config.prediction !== undefined ? config.prediction : 5]} 
                    onValueChange={(values) => updateConfig('prediction', Math.round(values[0]))}
                    disabled={disabled || strategy.type === 'ADVANCED'}
                  />
                </div>
              )}
              
              <div className="flex items-center space-x-2 pt-4">
                <Switch 
                  id="autoMode" 
                  checked={true}
                  disabled={disabled}
                />
                <Label htmlFor="autoMode">Modo Automático</Label>
              </div>
            </div>
          </>
        )}
      </CardContent>
      
      {strategy && config && onReset && (
        <CardFooter className="border-t border-gray-700">
          <Button 
            variant="outline"
            onClick={onReset}
            disabled={disabled}
            className="w-full"
          >
            Restaurar Padrão
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}