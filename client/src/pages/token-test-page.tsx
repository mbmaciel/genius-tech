import { TokenTest } from "@/components/TokenTest";
import { Layout } from "@/components/layout";

export function TokenTestPage() {
  return (
    <Layout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-8">Teste de Token</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <TokenTest />
          </div>
          <div className="bg-card p-6 rounded-lg border">
            <h2 className="text-xl font-semibold mb-4">Informações</h2>
            <div className="space-y-4 text-sm">
              <p>
                Esta página permite testar e aplicar um token específico para o robô de trading.
              </p>
              <p>
                O token <code className="px-1 py-0.5 bg-muted rounded">wRCpaqmNKnlLBzh</code> será testado
                e, se válido, será usado para todas as operações subsequentes.
              </p>
              <p>
                Este token já foi pré-configurado para ter todas as permissões necessárias 
                para operações de compra e venda de contratos no mercado.
              </p>
              <div className="mt-6">
                <h3 className="font-medium mb-2">Como funciona:</h3>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Clique no botão "Testar e aplicar token"</li>
                  <li>O sistema verificará a validade do token</li>
                  <li>Se válido, ele será armazenado para uso nas operações</li>
                  <li>Retorne à página do robô para iniciar operações</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}