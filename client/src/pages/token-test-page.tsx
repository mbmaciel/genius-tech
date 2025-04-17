import React from 'react';
import { Layout } from '@/components/layout';
import { TokenTester } from '@/components/TokenTester';

export default function TokenTestPage() {
  return (
    <Layout>
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Teste de Token OAuth</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Use esta página para testar manualmente um token OAuth específico da Deriv.
              O token será verificado diretamente com a API Deriv para confirmar se é válido para operações reais.
            </p>
          </div>
          
          <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Como obter um token OAuth</h2>
            <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-gray-300">
              <li>Acesse a <a href="https://app.deriv.com/account/api-token" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">página de API Token da Deriv</a></li>
              <li>Faça login em sua conta Deriv se solicitado</li>
              <li>Crie um novo token com permissões para operações de trading</li>
              <li>Copie o token gerado e cole no campo abaixo</li>
              <li>Clique em "Testar Token" para verificar se é válido</li>
            </ol>
          </div>
          
          <div className="flex justify-center">
            <TokenTester />
          </div>
          
          <div className="mt-10 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-300">
              Importante:
            </h3>
            <p className="mt-2 text-yellow-700 dark:text-yellow-400">
              Use apenas tokens válidos da sua conta Deriv. Um token válido será usado pelo robô para executar
              operações reais no mercado, que envolvem dinheiro real. Nunca compartilhe seus tokens com terceiros.
              O token será armazenado apenas localmente em seu navegador e nunca é enviado para nossos servidores.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}