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
  previsao?: number | string;
  contadorLossVirtual?: number | string;
  lossVirtual?: number | string;
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
      const baseConfig: StrategyConfiguration = {
        valorInicial: strategy.config?.initialStake || 0.35,
        metaGanho: strategy.config?.targetProfit || 20,
        limitePerda: strategy.config?.stopLoss || 10,
        martingale: strategy.config?.martingaleFactor || 1.5,
      };

      // Verificar tipo de estratégia e adicionar campos específicos
      switch (strategy.id) {
        case 'profitpro':
          baseConfig.valorAposVencer = 0.35;
          baseConfig.previsao = 5;
          baseConfig.contadorLossVirtual = 1;
          baseConfig.lossVirtual = 1;
          baseConfig.parcelasMartingale = 3;
          break;
        case 'manual_over':
        case 'manual_under':
          baseConfig.valorAposVencer = 0.35;
          baseConfig.previsao = strategy.id.includes('over') ? 5 : 4;
          baseConfig.parcelasMartingale = 3;
          break;
        case 'iron_over':
        case 'iron_under':
          baseConfig.previsao = strategy.id.includes('over') ? 5 : 4;
          baseConfig.martingale = 0.5;
          baseConfig.usarMartingaleAposXLoss = 2;
          break;
        case 'bot_low':
        case 'maxpro':
          baseConfig.valorAposVencer = 0.35;
          break;
        case 'advance':
          baseConfig.porcentagemParaEntrar = 70;
          baseConfig.previsao = 5;
          break;
        case 'wise_pro_tendencia':
          baseConfig.valorAposVencer = 0.35;
          break;
      }

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

          {/* Campo para Previsão - presente em várias estratégias */}
          {(config.previsao !== undefined) && (
            <div className="space-y-2">
              <Label htmlFor="previsao">Previsão (Dígito)</Label>
              <Input
                id="previsao"
                type="number"
                min="0"
                max="9"
                value={config.previsao.toString()}
                onChange={(e) => handleChange('previsao', e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {/* Campos específicos da estratégia Profitpro */}
          {(config.contadorLossVirtual !== undefined && config.lossVirtual !== undefined) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contadorLossVirtual">Contador de Loss Virtual</Label>
                <Input
                  id="contadorLossVirtual"
                  type="number"
                  min="0"
                  value={config.contadorLossVirtual.toString()}
                  onChange={(e) => handleChange('contadorLossVirtual', e.target.value)}
                  className="bg-[#0d1525] border-gray-700"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lossVirtual">Loss Virtual</Label>
                <Input
                  id="lossVirtual"
                  type="number"
                  min="0"
                  value={config.lossVirtual.toString()}
                  onChange={(e) => handleChange('lossVirtual', e.target.value)}
                  className="bg-[#0d1525] border-gray-700"
                />
              </div>
            </>
          )}

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