import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BinaryBotStrategy } from "@/lib/automationService";

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
  predition?: number | string;
  
  // Campo específico para configuração de Loss Virtual
  // Define quantas vezes consecutivas os dígitos alvo devem aparecer antes da entrada
  lossVirtual?: number | string;
}

interface StrategyConfigPanelProps {
  strategy: BinaryBotStrategy | null;
  onChange: (config: StrategyConfiguration) => void;
  className?: string;
}

// Cria uma configuração específica para cada estratégia
const createCompleteConfig = (
  strategy: BinaryBotStrategy,
): StrategyConfiguration => {
  console.log(
    "[STRATEGY_CONFIG] Estratégia selecionada:",
    strategy.id,
    strategy.name,
  );

  // Configuração básica que todas as estratégias têm
  const baseConfig: StrategyConfiguration = {
    valorInicial: strategy.config?.initialStake || 0.35,
    metaGanho: strategy.config?.targetProfit || 20,
    limitePerda: strategy.config?.stopLoss || 10,
    martingale: strategy.config?.martingaleFactor || 1.5,
  };

  // Configurações específicas para cada estratégia
  const strategyId = strategy.id.toLowerCase();

  // ProfitPro: Valor Inicial, Valor Após Vencer, Contador de Loss Virtual, Loss Virtual,
  // Martingale, Parcelas Martingale, Meta de Ganho, Limite de Perda
  if (strategyId === "profitpro") {
    return {
      ...baseConfig,
      valorAposVencer: 0.35,
      parcelasMartingale: strategy.config?.maxMartingaleLevel || 3,
      lossVirtual: strategy.config?.lossVirtual || 1, // Loss Virtual para dígitos 0-6
    };
  }

  // Manual Over/Under: Valor Inicial, Valor Após Vencer, Martingale,
  // Parcelas Martingale, Meta de Ganho, Limite de Perda
  if (
    strategyId.includes("manual_over") ||
    strategyId.includes("manual_under") ||
    strategyId.includes("manualover") ||
    strategyId.includes("manualunder")
  ) {
    return {
      ...baseConfig,
      valorAposVencer: 0.35,
      parcelasMartingale: strategy.config?.maxMartingaleLevel || 3,
      predition: 5,
    };
  }

  // IRON OVER/UNDER: Valor Inicial, Martingale (0.5), Usar Martingale Após X Loss, Meta, Limite de Perda
  if (
    strategyId.includes("iron_over") ||
    strategyId.includes("iron_under") ||
    strategyId.includes("ironover") ||
    strategyId.includes("ironunder")
  ) {
    return {
      ...baseConfig,
      martingale: 0.5,
      usarMartingaleAposXLoss: 2,
    };
  }

  // BOT LOW/MAXPRO: Valor Inicial, Valor Após Vencer, Martingale, Meta de Lucro, Limite de Perda
  if (
    strategyId.includes("bot_low") ||
    strategyId.includes("botlow") ||
    strategyId.includes("maxpro")
  ) {
    // Configuração específica para MaxPro
    if (strategyId.includes("maxpro")) {
      return {
        ...baseConfig,
        valorAposVencer: 0.35,
        lossVirtual: strategy.config?.lossVirtual || 1, // Loss Virtual para dígitos 0-3
      };
    }
    
    // BOT LOW (pré-configurado para loss virtual = 1, não necessita configuração adicional)
    return {
      ...baseConfig,
      valorAposVencer: 0.35,
    };
  }

  // Advance: Porcentagem para Entrar, Valor Inicial, Martingale, Meta, Limite de Perda
  if (strategyId.includes("advance")) {
    console.log("[STRATEGY_CONFIG] ★ Configurando estratégia ADVANCE");

    // Verificar se já existe uma configuração salva
    const savedConfig = localStorage.getItem(`strategy_config_${strategy.id}`);
    // SEMPRE ter um valor padrão para porcentagemParaEntrar (10% é um valor conservador)
    // Em vez de undefined, usar um valor padrão para evitar "CONFIGURAÇÃO PENDENTE"
    let userValue = 10; // Valor padrão se não houver configuração salva

    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        // Só substituir o valor padrão se encontrou um valor válido
        if (
          parsed.porcentagemParaEntrar !== undefined &&
          parsed.porcentagemParaEntrar !== null
        ) {
          userValue = parsed.porcentagemParaEntrar;
          console.log(
            "[STRATEGY_CONFIG] ★ Carregando valor salvo para porcentagem:",
            userValue,
          );
        } else {
          console.log(
            "[STRATEGY_CONFIG] ★ Valor salvo para porcentagem não encontrado, usando padrão:",
            userValue,
          );
        }
      } catch (err) {
        console.error(
          "[STRATEGY_CONFIG] ★ Erro ao carregar configuração salva:",
          err,
        );
      }
    } else {
      console.log(
        "[STRATEGY_CONFIG] ★ Nenhuma configuração salva encontrada, usando valor padrão:",
        userValue,
      );
    }

    // IMPORTANTE: Sempre usar um valor numérico para porcentagemParaEntrar
    // Nunca retorne undefined para este campo na estratégia Advance
    return {
      ...baseConfig,
      porcentagemParaEntrar: userValue,
    };
  }

  // WISE PRO TENDENCIA: Valor Inicial, Valor Após Vencer, Martingale, Meta de Lucro, Limite de Perda
  if (strategyId.includes("wise") || strategyId.includes("tendencia")) {
    return {
      ...baseConfig,
      valorAposVencer: 0.35,
    };
  }

  // Caso não seja nenhuma das estratégias acima, retorna configuração básica
  console.log(
    "[STRATEGY_CONFIG] Usando configuração padrão para estratégia desconhecida:",
    strategy.id,
  );
  return baseConfig;
};

export function StrategyConfigPanel({
  strategy,
  onChange,
  className = "",
}: StrategyConfigPanelProps) {
  // Estado para configuração atual
  const [config, setConfig] = useState<StrategyConfiguration>({
    valorInicial: 0.35,
    metaGanho: 20,
    limitePerda: 10,
    martingale: 1.5,
    valorAposVencer: 0.35,
    parcelasMartingale: 3,
    // Removido valor fixo padrão para estratégia ADVANCE
    // O usuário deve configurar explicitamente
    porcentagemParaEntrar: undefined,
    usarMartingaleAposXLoss: 2,
  });

  // Configurar a estratégia quando ela mudar
  useEffect(() => {
    if (!strategy) return;

    console.log("[STRATEGY_CONFIG] Configurando estratégia:", strategy.name);

    // Criar configuração com todos os campos possíveis para a estratégia
    const newConfig = createCompleteConfig(strategy);
    console.log(
      "[STRATEGY_CONFIG] Configuração criada para",
      strategy.name,
      newConfig,
    );

    // CRÍTICO: Garantir que a configuração inicial também seja salva no localStorage
    // A estratégia Advance precisa de um valor válido para porcentagemParaEntrar
    try {
      // Só salvamos no localStorage se não houver uma configuração prévia
      // para evitar sobrescrever configurações já definidas pelo usuário
      const existingConfig = localStorage.getItem(
        `strategy_config_${strategy.id}`,
      );
      if (!existingConfig) {
        console.log(
          `[STRATEGY_CONFIG] Salvando configuração inicial para ${strategy.id}:`,
          newConfig,
        );
        localStorage.setItem(
          `strategy_config_${strategy.id}`,
          JSON.stringify(newConfig),
        );
      } else {
        console.log(
          `[STRATEGY_CONFIG] Configuração existente encontrada para ${strategy.id}, não sobrescrevendo`,
        );
      }
    } catch (error) {
      console.error(
        `[STRATEGY_CONFIG] Erro ao salvar configuração inicial:`,
        error,
      );
    }

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
  const handleChange = (
    field: keyof StrategyConfiguration,
    value: string | number,
  ) => {
    // Validar valor numérico
    if (typeof value === "string") {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        value = numValue;
      }
    }

    // Atualizar configuração
    const updatedConfig = {
      ...config,
      [field]: value,
    };

    // PERSISTÊNCIA CRÍTICA: Salvar no localStorage toda vez que o usuário alterar um valor
    if (strategy?.id) {
      try {
        localStorage.setItem(
          `strategy_config_${strategy.id}`,
          JSON.stringify(updatedConfig),
        );
        console.log(
          `[STRATEGY_CONFIG] Configuração salva para ${strategy.id}:`,
          updatedConfig,
        );
      } catch (error) {
        console.error(`[STRATEGY_CONFIG] Erro ao salvar configuração:`, error);
      }
    }

    setConfig(updatedConfig);
    onChange(updatedConfig);
  };

  // Renderizar apenas um card de seleção se não houver estratégia
  if (!strategy) {
    return (
      <Card className={`${className} bg-[#1a2234] border-gray-700`}>
        <CardHeader>
          <CardTitle className="text-gray-400">
            Configurações da Estratégia
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center">
            Selecione uma estratégia para configurar
          </p>
        </CardContent>
      </Card>
    );
  }

  // Verificar quais campos devem ser exibidos com base na estratégia selecionada
  const strategyId = strategy.id.toLowerCase();

  // VALOR APÓS VENCER FOI REMOVIDO - esse valor deve ser igual ao valor de entrada definido pelo usuário
  // e não precisa ser configurado separadamente

  // Parcelas de Martingale é um conceito usado apenas em algumas estratégias
  // As estratégias IRON não usam "parcelas", mas sim "martingale após X perdas"
  const showParcelasMartingale =
    strategyId === "profitpro" ||
    strategyId.includes("manual") ||
    strategyId.includes("green");

  const showPredition = strategyId.includes("manual");

  const showPorcentagemParaEntrar = strategyId.includes("advance");

  const showUsarMartingaleAposXLoss =
    strategyId.includes("iron") || strategyId.includes("green");
    
  // Mostrar configuração de Loss Virtual apenas para ProfitPro e MaxPro
  // Bot Low já é pré-configurado com loss virtual = 1 para dígitos 0-2
  const showLossVirtual = 
    strategyId === "profitpro" || strategyId.includes("maxpro");

  // Renderizar configuração específica para a estratégia
  return (
    <Card className={`${className} bg-[#1a2234] border-gray-700`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-blue-500">
          Configuração: {strategy.name}
        </CardTitle>
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
              onChange={(e) => handleChange("valorInicial", e.target.value)}
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
              onChange={(e) => handleChange("metaGanho", e.target.value)}
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
              onChange={(e) => handleChange("limitePerda", e.target.value)}
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
              onChange={(e) => handleChange("martingale", e.target.value)}
              className="bg-[#0d1525] border-gray-700"
            />
          </div>

          {/* Campo Valor Após Vencer removido - valor é sempre igual ao Valor Inicial */}

          {/* Campo Parcelas Martingale - apenas para estratégias que o usam */}
          {showParcelasMartingale && (
            <div className="space-y-2">
              <Label htmlFor="parcelasMartingale">Parcelas de Martingale</Label>
              <Input
                id="parcelasMartingale"
                type="number"
                min="1"
                value={config.parcelasMartingale?.toString() || "3"}
                onChange={(e) =>
                  handleChange("parcelasMartingale", e.target.value)
                }
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {showPredition && (
            <div className="space-y-2">
              <Label htmlFor="parcelasMartingale">Previsão</Label>
              <Input
                id="predition"
                type="number"
                min="1"
                value={config.predition?.toString() || "3"}
                onChange={(e) => handleChange("predition", e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {/* Campo Porcentagem para Entrar - apenas para estratégia ADVANCE */}
          {showPorcentagemParaEntrar && (
            <div className="space-y-2">
              <Label htmlFor="porcentagemParaEntrar">
                Porcentagem para Entrar (%)
              </Label>
              <Input
                id="porcentagemParaEntrar"
                type="number"
                min="0"
                max="100"
                value={config.porcentagemParaEntrar?.toString() || ""}
                onChange={(e) =>
                  handleChange("porcentagemParaEntrar", e.target.value)
                }
                className="bg-[#0d1525] border-gray-700"
              />
            </div>
          )}

          {/* Campo Usar Martingale Após X Loss - apenas para estratégias IRON */}
          {showUsarMartingaleAposXLoss && (
            <div className="space-y-2">
              <Label htmlFor="usarMartingaleAposXLoss">
                {strategyId.includes("iron")
                  ? "Multiplicar valor após X perdas"
                  : "Usar Martingale Após X Loss"}
              </Label>
              <Input
                id="usarMartingaleAposXLoss"
                type="number"
                min="1"
                value={config.usarMartingaleAposXLoss?.toString() || "2"}
                onChange={(e) =>
                  handleChange("usarMartingaleAposXLoss", e.target.value)
                }
                className="bg-[#0d1525] border-gray-700"
              />
              {strategyId.includes("iron") && (
                <p className="text-xs text-gray-400 mt-1">
                  Após esse número de perdas, a próxima entrada será: Valor
                  Inicial × Número de perdas consecutivas
                </p>
              )}
            </div>
          )}
          
          {/* Campo Loss Virtual - apenas para estratégias ProfitPro e MaxPro */}
          {showLossVirtual && (
            <div className="space-y-2">
              <Label htmlFor="lossVirtual">
                {strategyId === "profitpro"
                  ? "Loss Virtual para Dígitos 0-6"
                  : "Loss Virtual para Dígitos 0-3"}
              </Label>
              <Input
                id="lossVirtual"
                type="number"
                min="1"
                value={config.lossVirtual?.toString() || "1"}
                onChange={(e) => handleChange("lossVirtual", e.target.value)}
                className="bg-[#0d1525] border-gray-700"
              />
              <p className="text-xs text-gray-400 mt-1">
                {strategyId === "profitpro" 
                  ? "Número de vezes consecutivas que os dígitos 0-6 devem aparecer antes de realizar uma entrada"
                  : "Número de vezes consecutivas que os dígitos 0-3 devem aparecer antes de realizar uma entrada"}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
