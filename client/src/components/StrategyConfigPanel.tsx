import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { BinaryBotStrategy } from '@/lib/automationService';
import { getStrategyById, usesDigitPrediction } from '@/lib/strategiesConfig';

// Interface para configurações de estratégia individuais
export interface StrategyConfiguration {
  // Campos comuns a todas as estratégias
  valorInicial: number | string;
  metaGanho: number | string;
  limitePerda: number | string;
  martingale: number | string;
  
  // Campos específicos de algumas estratégias
  valorAposVencer?: number | string;
  parcelasMartingale?: number | string;
  porcentagemParaEntrar?: number | string;
  usarMartingaleAposXLoss?: number | string;
}

interface StrategyConfigPanelProps {
  strategy: BinaryBotStrategy | null;
  onChange: (config: StrategyConfiguration) => void;
  className?: string;
}

export function StrategyConfigPanel({ strategy, onChange, className = '' }: StrategyConfigPanelProps) {
  // Estado para configuração atual
  const [config, setConfig] = useState<StrategyConfiguration>({
    valorInicial: 0.35,
    metaGanho: 20,
    limitePerda: 10,
    martingale: 1.5,
  });

  // Efeito para atualizar configuração quando estratégia muda
  useEffect(() => {
    if (strategy) {
      console.log("[STRATEGY_CONFIG] Atualizando config para estratégia:", strategy.id);
      
      // Configuração base para todas as estratégias
      const baseConfig: StrategyConfiguration = {
        valorInicial: strategy.config?.initialStake || 0.35,
        metaGanho: strategy.config?.targetProfit || 20,
        limitePerda: strategy.config?.stopLoss || 10,
        martingale: strategy.config?.martingaleFactor || 1.5,
      };

      // Adicionar campos específicos por estratégia
      if (strategy.id === 'profitpro') {
        // ProfitPro
        baseConfig.valorAposVencer = 0.35;
        baseConfig.parcelasMartingale = 3;
      } 
      else if (strategy.id === 'manual_over' || strategy.id === 'manual_under') {
        // Manual Over/Under
        baseConfig.valorAposVencer = 0.35;
        baseConfig.parcelasMartingale = 3;
      } 
      else if (strategy.id === 'iron_over' || strategy.id === 'iron_under') {
        // IRON Over/Under
        baseConfig.martingale = 0.5;
        baseConfig.usarMartingaleAposXLoss = 2;
      } 
      else if (strategy.id === 'bot_low' || strategy.id === 'maxpro') {
        // BOT LOW / MAXPRO
        baseConfig.valorAposVencer = 0.35;
      } 
      else if (strategy.id === 'advance') {
        // Advance
        baseConfig.porcentagemParaEntrar = 70;
      } 
      else if (strategy.id === 'wise_pro_tendencia') {
        // WISE PRO TENDENCIA
        baseConfig.valorAposVencer = 0.35;
      }

      console.log("[STRATEGY_CONFIG] Config gerada:", baseConfig);
      
      // Atualizar estado local sem notificar o componente pai
      setConfig(baseConfig);
    }
  }, [strategy]); // Removemos onChange da lista de dependências
  
  // Efeito separado para notificar o componente pai quando o config é atualizado
  // Isso previne loops infinitos, pois só executará quando o config mudar por causa da estratégia
  useEffect(() => {
    // Certifica-se de que existe uma estratégia selecionada
    if (strategy) {
      // Notifica o componente pai apenas uma vez quando o config for atualizado
      onChange(config);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy?.id]); // Apenas quando a ID da estratégia mudar

  // Handler para mudança de campo
  const handleChange = (field: keyof StrategyConfiguration, value: string | number) => {
    // Validar valor numérico
    if (typeof value === 'string') {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        value = numValue;
      }
    }

    // Atualizar configuração
    const updatedConfig = {
      ...config,
      [field]: value
    };
    
    setConfig(updatedConfig);
    onChange(updatedConfig);
  };

  if (!strategy) {
    return (
      <Card className={`${className} bg-[#1a2234] border-gray-700`}>
        <CardHeader>
          <CardTitle className="text-gray-400">Configurações da Estratégia</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center">Selecione uma estratégia para configurar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} bg-[#1a2234] border-gray-700`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-blue-500">Configuração: {strategy.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          {/* Campos comuns a todas as estratégias */}
          <div className="space-y-2">
            <Label htmlFor="valorInicial">Valor Inicial (USD)</Label>
            <Input
              id="valorInicial"
              type="number"
              step="0.01"
              value={config.valorInicial.toString()}
              onChange={(e) => handleChange('valorInicial', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metaGanho">Meta de Lucro (USD)</Label>
            <Input
              id="metaGanho"
              type="number"
              step="0.01"
              value={config.metaGanho.toString()}
              onChange={(e) => handleChange('metaGanho', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="limitePerda">Limite de Perda (USD)</Label>
            <Input
              id="limitePerda"
              type="number"
              step="0.01"
              value={config.limitePerda.toString()}
              onChange={(e) => handleChange('limitePerda', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="martingale">Fator Martingale</Label>
            <Input
              id="martingale"
              type="number"
              step="0.1"
              value={config.martingale.toString()}
              onChange={(e) => handleChange('martingale', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          {/* Campo para Valor Após Vencer - presente em várias estratégias */}
          {(config.valorAposVencer !== undefined) && (
            <div className="space-y-2">
              <Label htmlFor="valorAposVencer">Valor Após Vencer (USD)</Label>
              <Input
                id="valorAposVencer"
                type="number"
                step="0.01"
                value={config.valorAposVencer.toString()}
                onChange={(e) => handleChange('valorAposVencer', e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {/* Os campos de Previsão, contadorLossVirtual e lossVirtual foram removidos 
              conforme solicitado, pois são determinados no código */}

          {/* Campo específico para parcelas de Martingale */}
          {(config.parcelasMartingale !== undefined) && (
            <div className="space-y-2">
              <Label htmlFor="parcelasMartingale">Parcelas Martingale</Label>
              <Input
                id="parcelasMartingale"
                type="number"
                min="1"
                value={config.parcelasMartingale.toString()}
                onChange={(e) => handleChange('parcelasMartingale', e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {/* Campo específico para Advance */}
          {(config.porcentagemParaEntrar !== undefined) && (
            <div className="space-y-2">
              <Label htmlFor="porcentagemParaEntrar">Porcentagem para Entrar (%)</Label>
              <Input
                id="porcentagemParaEntrar"
                type="number"
                min="0"
                max="100"
                value={config.porcentagemParaEntrar.toString()}
                onChange={(e) => handleChange('porcentagemParaEntrar', e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {/* Campo específico para IRON OVER/UNDER */}
          {(config.usarMartingaleAposXLoss !== undefined) && (
            <div className="space-y-2">
              <Label htmlFor="usarMartingaleAposXLoss">Usar Martingale Após X Loss</Label>
              <Input
                id="usarMartingaleAposXLoss"
                type="number"
                min="1"
                value={config.usarMartingaleAposXLoss.toString()}
                onChange={(e) => handleChange('usarMartingaleAposXLoss', e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}