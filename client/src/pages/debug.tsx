import { Helmet } from 'react-helmet';
import React from 'react';

export default function Debug() {
  return (
    <div className="min-h-screen bg-[#0e1a33] text-white">
      <Helmet>
        <title>Debug | Genius Technology Trading</title>
      </Helmet>
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center">Página de Debug</h1>
        
        <div className="grid grid-cols-1 gap-6">
          <div className="bg-[#162746] rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4">API Deriv - Debug</h2>
            <p className="text-[#8492b4] mb-4">
              Esta página contém ferramentas para testar a API da Deriv e depurar a conexão WebSocket.
            </p>
            
            {/* Aqui entrariam os componentes de debug da API Deriv */}
            <div className="bg-[#1f3158] p-4 rounded-md">
              <p className="text-sm">Componente de teste API não carregado.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}