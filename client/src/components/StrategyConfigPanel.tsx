import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BinaryBotStrategy } from '@/lib/automationService';

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

// Cria uma configuração completa com TODOS os campos possíveis
// Esta abordagem simples mostrará todos os campos relevantes para todas as estratégias
const createCompleteConfig = (strategy: BinaryBotStrategy): StrategyConfiguration => {
  // Ajustar valores padrão com base no ID da estratégia
  const martingaleValue = strategy.id.includes('iron') ? 0.5 : 1.5;
  
  // Configuração completa com todos os campos possíveis
  return {
    valorInicial: strategy.config?.initialStake || 0.35,
    metaGanho: strategy.config?.targetProfit || 20,
    limitePerda: strategy.config?.stopLoss || 10,
    martingale: martingaleValue,
    valorAposVencer: 0.35,
    parcelasMartingale: 3,
    porcentagemParaEntrar: 70,
    usarMartingaleAposXLoss: 2
  };
};

export function StrategyConfigPanel({ strategy, onChange, className = '' }: StrategyConfigPanelProps) {
  // Estado para configuração atual
  const [config, setConfig] = useState<StrategyConfiguration>({
    valorInicial: 0.35,
    metaGanho: 20,
    limitePerda: 10,
    martingale: 1.5,
    valorAposVencer: 0.35,
    parcelasMartingale: 3,
    porcentagemParaEntrar: 70,
    usarMartingaleAposXLoss: 2
  });

  // Configurar a estratégia quando ela mudar
  useEffect(() => {
    if (!strategy) return;
    
    console.log("[STRATEGY_CONFIG] Configurando estratégia:", strategy.name);
    
    // Criar configuração com todos os campos possíveis para a estratégia
    const newConfig = createCompleteConfig(strategy);
    console.log("[STRATEGY_CONFIG] Configuração criada para", strategy.name, newConfig);
    
    // Atualizar estado
    setConfig(newConfig);
    
    // Notificar o componente pai apenas uma vez para evitar loops
    const timer = setTimeout(() => {
      onChange(newConfig);
    }, 0);
    
    return () => clearTimeout(timer);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [strategy?.id]);

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

  // Renderizar apenas um card de seleção se não houver estratégia
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

  // Renderizar configuração completa se houver estratégia
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

          {/* Campo Valor Após Vencer sempre visível */}
          <div className="space-y-2">
            <Label htmlFor="valorAposVencer">Valor Após Vencer (USD)</Label>
            <Input
              id="valorAposVencer"
              type="number"
              step="0.01"
              value={config.valorAposVencer?.toString() || "0.35"}
              onChange={(e) => handleChange('valorAposVencer', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          {/* Campo Parcelas Martingale sempre visível */}
          <div className="space-y-2">
            <Label htmlFor="parcelasMartingale">Parcelas Martingale</Label>
            <Input
              id="parcelasMartingale"
              type="number"
              min="1"
              value={config.parcelasMartingale?.toString() || "3"}
              onChange={(e) => handleChange('parcelasMartingale', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          {/* Campo Porcentagem para Entrar sempre visível */}
          <div className="space-y-2">
            <Label htmlFor="porcentagemParaEntrar">Porcentagem para Entrar (%)</Label>
            <Input
              id="porcentagemParaEntrar"
              type="number"
              min="0"
              max="100"
              value={config.porcentagemParaEntrar?.toString() || "70"}
              onChange={(e) => handleChange('porcentagemParaEntrar', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          {/* Campo Usar Martingale Após X Loss sempre visível */}
          <div className="space-y-2">
            <Label htmlFor="usarMartingaleAposXLoss">Usar Martingale Após X Loss</Label>
            <Input
              id="usarMartingaleAposXLoss"
              type="number"
              min="1"
              value={config.usarMartingaleAposXLoss?.toString() || "2"}
              onChange={(e) => handleChange('usarMartingaleAposXLoss', e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}