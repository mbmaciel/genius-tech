import React from 'react';
// Usando o componente completamente novo e independente
import { BasicDigitBarChart } from '@/components/BasicDigitBarChart';

/**
 * Página dedicada para exibição de estatísticas de dígitos
 * Esta página utiliza o componente com conexão WebSocket independente
 */
export default function DigitStatsPage() {
  return (
    <div className="min-h-screen bg-[#0c1323] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">Estatísticas de Dígitos em Tempo Real</h1>
          <p className="text-gray-400 mt-2">
            Visualização independente com conexão WebSocket dedicada
          </p>
        </header>
        
        <div className="grid grid-cols-1 gap-6">
          {/* Seção principal com o gráfico R_100 */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">Índice R_100</h2>
            <p className="text-gray-400 mb-6">
              Estatísticas dos últimos dígitos com atualização em tempo real
            </p>
            
            {/* Componente básico com implementação autônoma */}
            <BasicDigitBarChart 
              className="w-full"
            />
          </div>
          
          {/* Informações adicionais */}
          <div className="bg-[#13203a] rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">Sobre Esta Visualização</h2>
            <div className="space-y-4 text-gray-300">
              <p>
                Este componente utiliza uma conexão WebSocket dedicada para exibir as estatísticas 
                dos dígitos do índice R_100 em tempo real.
              </p>
              <p>
                A conexão é completamente independente do resto da aplicação, 
                não interferindo com outras operações ou conexões existentes.
              </p>
              <p>
                Características:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-4">
                <li>Conexão WebSocket dedicada e isolada</li>
                <li>Atualização em tempo real garantida</li>
                <li>Cores diferenciadas para dígitos pares e ímpares</li>
                <li>Implementação direta sem dependências externas</li>
                <li>Sequência dos últimos dígitos recebidos</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}