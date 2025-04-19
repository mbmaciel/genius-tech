import React from 'react';
// Usando o componente de demonstração para testar atualizações visuais
import { StaticDigitChart } from '@/components/StaticDigitChart';

/**
 * Página dedicada para exibição de estatísticas de dígitos
 * Esta página utiliza um componente de demonstração que garante atualizações visuais
 */
export default function DigitStatsPage() {
  return (
    <div className="min-h-screen bg-[#0c1323] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Estatísticas de Dígitos em Tempo Real</h1>
          <p className="text-gray-400 mt-2">
            Visualização com dados de demonstração para validar as atualizações visuais
          </p>
        </header>
        
        <div className="grid grid-cols-1 gap-6">
          {/* Seção principal com o gráfico R_100 */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">Índice R_100 (Demonstração)</h2>
            <p className="text-gray-400 mb-6">
              Estatísticas atualizadas a cada 2 segundos para validar a renderização
            </p>
            
            {/* Componente de demonstração com dados simulados */}
            <StaticDigitChart 
              className="w-full"
            />
          </div>
          
          {/* Informações adicionais */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">Sobre Esta Visualização</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Este componente de demonstração gera dados aleatórios e atualiza o gráfico
                a cada 2 segundos para validar se as atualizações visuais estão funcionando corretamente.
              </p>
              <p>
                Esta abordagem permite identificar problemas de renderização 
                sem depender de conexões externas que podem ser instáveis.
              </p>
              <p>
                Características:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>Atualização visual garantida a cada 2 segundos</li>
                <li>Cores diferenciadas para dígitos pares e ímpares</li>
                <li>Sequência dos últimos dígitos simulados</li>
                <li>Renderização otimizada para atualizações frequentes</li>
                <li>Sem dependência de API externa (funciona offline)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}