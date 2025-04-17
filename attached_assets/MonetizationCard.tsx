import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CircleDollarSign, Percent, UserPlus, CheckCircle2, ExternalLink, DollarSign } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function MonetizationCard() {
  return (
    <Card className="grid-card">
      <CardHeader className="p-4 border-b border-gray-800">
        <CardTitle className="text-lg font-medium font-poppins flex items-center">
          <CircleDollarSign className="w-5 h-5 mr-2 text-[#00e5b3]" />
          Oportunidades de Receita
        </CardTitle>
        <CardDescription>
          Opções de monetização para sua plataforma
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        <Tabs defaultValue="markup">
          <TabsList className="bg-[#162746] grid grid-cols-2 mb-4">
            <TabsTrigger value="markup" className="data-[state=active]:bg-[#1f3158]">
              Markups
            </TabsTrigger>
            <TabsTrigger value="affiliate" className="data-[state=active]:bg-[#1f3158]">
              Programa de Afiliados
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="markup" className="space-y-4">
            <div className="bg-[#1f3158] p-4 rounded-md">
              <div className="flex items-start mb-3">
                <Percent className="w-5 h-5 text-[#3a7bd5] mr-2 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium text-sm">Markups</h3>
                  <p className="text-[#8492b4] text-xs mt-1">
                    Adicione uma margem de até 3% nos contratos, aumentando seus lucros sem comprometer a experiência do usuário.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-[#162746] p-2 rounded">
                  <Badge variant="outline" className="mb-1">Básico</Badge>
                  <p className="text-white font-medium">1%</p>
                  <p className="text-[#8492b4] text-xs">Markup inicial</p>
                </div>
                <div className="bg-[#162746] p-2 rounded">
                  <Badge variant="outline" className="mb-1">Padrão</Badge>
                  <p className="text-white font-medium">2%</p>
                  <p className="text-[#8492b4] text-xs">Markup médio</p>
                </div>
                <div className="bg-[#162746] p-2 rounded">
                  <Badge variant="outline" className="mb-1">Premium</Badge>
                  <p className="text-white font-medium">3%</p>
                  <p className="text-[#8492b4] text-xs">Markup máximo</p>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-white text-xs font-medium mb-2">Como implementar</h4>
                <p className="text-[#8492b4] text-xs">
                  Os markups podem ser implementados adicionando uma pequena porcentagem ao preço de compra de cada contrato, sem afetar a funcionalidade principal da plataforma.
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="affiliate" className="space-y-4">
            <div className="bg-[#1f3158] p-4 rounded-md">
              <div className="flex items-start mb-3">
                <UserPlus className="w-5 h-5 text-[#3a7bd5] mr-2 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium text-sm">Programa de Afiliados Deriv</h3>
                  <p className="text-[#8492b4] text-xs mt-1">
                    Torne-se um afiliado oficial da Deriv e ganhe comissões por novos clientes encaminhados através de sua plataforma.
                  </p>
                </div>
              </div>
              
              <ul className="space-y-2 mt-3">
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                  <p className="text-[#8492b4] text-xs">Comissões competitivas de até 45% sobre a atividade de trading</p>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                  <p className="text-[#8492b4] text-xs">Relatórios detalhados e transparentes para acompanhar seu desempenho</p>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mr-2 mt-0.5 shrink-0" />
                  <p className="text-[#8492b4] text-xs">Materiais de marketing e suporte em múltiplos idiomas</p>
                </li>
              </ul>
              
              <div className="bg-[#162746] p-3 rounded-md mt-3 text-xs">
                <p className="text-white font-medium mb-1">Como implementar:</p>
                <ol className="list-decimal list-inside text-[#8492b4] space-y-1 ml-1">
                  <li>Cadastre-se no programa de afiliados da Deriv</li>
                  <li>Inclua seu token de afiliado nas URLs de redirecionamento OAuth</li>
                  <li>Para login: <code className="bg-gray-800 px-1 rounded text-xs">&affiliate_token=YOUR_TOKEN</code></li>
                  <li>Para cadastro: <code className="bg-gray-800 px-1 rounded text-xs">?t=YOUR_TOKEN</code></li>
                </ol>
              </div>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full mt-3 border-blue-600 text-blue-400 hover:bg-blue-900/20"
                onClick={() => window.open('https://deriv.com/partners/affiliate-ib/', '_blank')}
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Cadastrar-se como afiliado Deriv
              </Button>
            </div>
            
            <div className="bg-[#1f3158] p-4 rounded-md">
              <div className="flex items-start mb-3">
                <DollarSign className="w-5 h-5 text-[#3a7bd5] mr-2 mt-0.5" />
                <div>
                  <h3 className="text-white font-medium text-sm">Benefícios para Desenvolvedores</h3>
                  <p className="text-[#8492b4] text-xs mt-1">
                    Desenvolva aplicações com a API da Deriv e ganhe comissões quando clientes negociarem através delas.
                  </p>
                </div>
              </div>
              
              <div className="bg-emerald-900/20 border border-emerald-900/50 p-2 rounded-md mt-2">
                <p className="text-emerald-300 text-xs">
                  Os afiliados podem ganhar comissões quando clientes referidos negociam Opções em plataformas de terceiros desenvolvidas com a API da Deriv.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="p-4 border-t border-gray-800">
        <p className="text-[#8492b4] text-xs">
          As opções de monetização estão sujeitas aos termos e condições da Deriv e podem requerer aprovação prévia.
        </p>
      </CardFooter>
    </Card>
  );
}