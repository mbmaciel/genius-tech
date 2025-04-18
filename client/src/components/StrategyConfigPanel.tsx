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

// Função auxiliar para detectar tipo de estratégia
const detectStrategyType = (strategy: BinaryBotStrategy): string => {
  // Garantir que temos valores de string para comparação segura
  const name = (strategy.name || '').toLowerCase();
  const id = (strategy.id || '').toLowerCase();
  const description = (strategy.description || '').toLowerCase();
  const xmlPath = (strategy.xmlPath || '').toLowerCase();
  
  // Verificar usando TODAS as fontes disponíveis (nome, id, descrição e até o caminho XML)
  
  // Verificar Profitpro
  if (name.includes('profitpro') || id.includes('profitpro') || xmlPath.includes('profitpro')) 
    return 'profitpro';
  
  // Verificar Manual Over/Under (cuidado com a ordem: verificar 'manual under' antes de 'manual')
  if (name.includes('manual under') || id.includes('manual_under') || xmlPath.includes('manual under')) 
    return 'manual';
  if (name.includes('manual over') || id.includes('manual_over') || xmlPath.includes('manual over')) 
    return 'manual';  
  if (name.includes('manual') || id.includes('manual')) 
    return 'manual';
  
  // Verificar Iron Over/Under
  if (name.includes('iron over') || id.includes('iron_over') || xmlPath.includes('iron over')) 
    return 'iron';
  if (name.includes('iron under') || id.includes('iron_under') || xmlPath.includes('iron under')) 
    return 'iron';
  if (name.includes('iron') || id.includes('iron')) 
    return 'iron';
  
  // Verificar Bot Low / Maxpro
  if (name.includes('bot low') || id.includes('bot_low') || xmlPath.includes('bot low')) 
    return 'botlow';
  if (name.includes('maxpro') || id.includes('maxpro') || xmlPath.includes('maxpro')) 
    return 'botlow';
  
  // Verificar Green (usando a mesma configuração de Bot Low)
  if (name.includes('green') || id.includes('green') || xmlPath.includes('green')) 
    return 'botlow';
  
  // Verificar Advance
  if (name.includes('advance') || id.includes('advance') || xmlPath.includes('advance')) 
    return 'advance';
  
  // Verificar Wise Pro Tendencia
  if (name.includes('wise') || id.includes('wise') || xmlPath.includes('wise')) 
    return 'wise';
  if (name.includes('tendencia') || id.includes('tendencia') || xmlPath.includes('tendencia')) 
    return 'wise';
  
  // Verificação específica para IDs numerados ou nomes alternativos conhecidos
  if (id === 'manual_over' || id === 'manual_under') return 'manual';
  if (id === 'iron_over' || id === 'iron_under') return 'iron';
  if (id === 'wise_pro_tendencia') return 'wise';
  
  // Registrar que não conseguimos identificar
  console.warn("[STRATEGY_CONFIG] ⚠️ Tipo de estratégia não identificado:", name, id);
  console.warn("[STRATEGY_CONFIG] ⚠️ Caminho XML:", xmlPath);
  
  // Se não conseguir identificar, assume como manual (que tem mais campos)
  return 'manual';
};

// Função para criar configuração baseada no tipo de estratégia
const createConfigForStrategy = (strategy: BinaryBotStrategy): StrategyConfiguration => {
  // Base comum para todas as estratégias
  const baseConfig: StrategyConfiguration = {
    valorInicial: strategy.config?.initialStake || 0.35,
    metaGanho: strategy.config?.targetProfit || 20,
    limitePerda: strategy.config?.stopLoss || 10,
    martingale: strategy.config?.martingaleFactor || 1.5,
  };
  
  // Detectar tipo de estratégia
  const type = detectStrategyType(strategy);
  console.log("[STRATEGY_CONFIG] Tipo de estratégia detectado:", type, "para:", strategy.name);
  
  // Aplicar configurações específicas por tipo
  switch(type) {
    case 'profitpro':
      return {
        ...baseConfig,
        valorAposVencer: 0.35,
        parcelasMartingale: 3
      };
      
    case 'manual':
      return {
        ...baseConfig,
        valorAposVencer: 0.35,
        parcelasMartingale: 3
      };
      
    case 'iron':
      return {
        ...baseConfig,
        martingale: 0.5,
        usarMartingaleAposXLoss: 2
      };
      
    case 'botlow':
      return {
        ...baseConfig,
        valorAposVencer: 0.35
      };
      
    case 'advance':
      return {
        ...baseConfig,
        porcentagemParaEntrar: 70
      };
      
    case 'wise':
      return {
        ...baseConfig,
        valorAposVencer: 0.35
      };
      
    default:
      return baseConfig;
  }
};

export function StrategyConfigPanel({ strategy, onChange, className = '' }: StrategyConfigPanelProps) {
  // Estado para configuração atual
  const [config, setConfig] = useState<StrategyConfiguration>({
    valorInicial: 0.35,
    metaGanho: 20,
    limitePerda: 10,
    martingale: 1.5,
  });

  // Configurar a estratégia quando ela mudar - usando uma referência para evitar loops
  useEffect(() => {
    if (!strategy) return;
    
    console.log("[STRATEGY_CONFIG] Configurando estratégia:", strategy.name);
    
    // Criar configuração apropriada para esta estratégia
    const newConfig = createConfigForStrategy(strategy);
    console.log("[STRATEGY_CONFIG] Nova configuração gerada:", newConfig);
    
    // Atualizar estado
    setConfig(newConfig);
    
    // Notificar componente pai sobre a mudança - APENAS NA PRIMEIRA VEZ
    // Isso previne o loop infinito de atualizações
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

          {/* Campo para Valor Após Vencer - presente em várias estratégias */}
          {config.valorAposVencer !== undefined && (
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

          {/* Campo específico para parcelas de Martingale */}
          {config.parcelasMartingale !== undefined && (
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
          {config.porcentagemParaEntrar !== undefined && (
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
          {config.usarMartingaleAposXLoss !== undefined && (
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