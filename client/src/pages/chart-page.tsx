import React from 'react';
import { DigitBarChart } from '@/components/ui/DigitBarChart';

export default function ChartPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-white">Análise de Dígitos em Tempo Real</h1>
      <DigitBarChart />
    </div>
  );
}