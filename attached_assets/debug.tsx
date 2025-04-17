import { Helmet } from 'react-helmet';
import DerivApiTest from '@/components/debug/DerivApiTest';

export default function DebugPage() {
  return (
    <div className="container mx-auto p-4">
      <Helmet>
        <title>Diagnóstico da Conexão - Deriv API</title>
      </Helmet>
      
      <div className="flex flex-col space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Diagnóstico de Conexão com a API Deriv</h1>
          <p className="text-muted-foreground mt-2">
            Esta página testa a conexão direto com a API da Deriv para diagnosticar problemas
          </p>
        </div>
        
        <DerivApiTest />
      </div>
    </div>
  );
}