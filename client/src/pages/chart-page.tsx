import React from 'react';
import { FixedDigitBarChart } from '@/components/ui/FixedDigitBarChart';

export default function ChartPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">Análise de Dígitos em Tempo Real</h1>
      <div className="bg-[#0e1a2e] p-4 rounded-md mb-6">
        <p className="text-gray-300 text-sm mb-4">
          Este gráfico mostra a distribuição dos últimos dígitos do preço em tempo real.
          As barras são atualizadas conforme chegam novos dados do mercado.
        </p>
      </div>
      <FixedDigitBarChart symbol="R_100" />
    </div>
  );
}