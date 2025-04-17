import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AlertCircle, AlertTriangle, Check, HelpCircle, 
  ExternalLink, RefreshCw 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Tipos de erros comuns da API Deriv
interface ErrorCode {
  code: string;
  message: string;
  description: string;
  solution: string;
}

const commonErrors: ErrorCode[] = [
  {
    code: "AuthorizationRequired",
    message: "Please log in.",
    description: "Autenticação necessária para acessar a API.",
    solution: "Faça login usando seu token de API ou OAuth da Deriv."
  },
  {
    code: "InvalidAppID",
    message: "Your app_id is invalid.",
    description: "O app_id fornecido não é válido ou não está registrado.",
    solution: "Verifique se você está usando o app_id correto registrado na Deriv."
  },
  {
    code: "InputValidationFailed",
    message: "Input validation failed.",
    description: "Os parâmetros fornecidos na requisição não são válidos.",
    solution: "Verifique o formato e os valores dos parâmetros enviados."
  },
  {
    code: "ContractCreationFailure",
    message: "Contract's stake amount is more than the maximum purchase price.",
    description: "Falha ao criar contrato por valor exceder limite máximo.",
    solution: "Reduza o valor da aposta ou verifique os limites da sua conta."
  },
  {
    code: "BalanceExceeded",
    message: "This deposit will cause your account balance to exceed your account limit.",
    description: "O valor excederia o limite da conta.",
    solution: "Reduza o valor ou verifique os limites da sua conta."
  },
  {
    code: "CashierLocked",
    message: "Your account cashier is locked.",
    description: "O caixa da sua conta está bloqueado temporariamente.",
    solution: "Entre em contato com o suporte da Deriv para desbloquear."
  },
  {
    code: "ClosedMarket",
    message: "Transfers are unavailable on weekends.",
    description: "Operações indisponíveis fora do horário de mercado.",
    solution: "Tente novamente durante o horário de funcionamento do mercado."
  },
  {
    code: "ConnectionError",
    message: "A connection error happened while we were completing your request.",
    description: "Problema de conexão com a API da Deriv.",
    solution: "Verifique sua conexão com a internet e tente novamente."
  },
  {
    code: "InternalServerError",
    message: "Sorry, an error occurred while processing your request.",
    description: "Erro interno no servidor da Deriv.",
    solution: "Tente novamente mais tarde ou contate o suporte da Deriv."
  }
];

export function ErrorHandler({ lastError }: { lastError?: string }) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Filtrar apenas os erros mais comuns para exibição inicial
  const displayErrors = commonErrors.slice(0, 4);
  
  return (
    <Card className="grid-card">
      <CardHeader className="p-4 border-b border-gray-800">
        <CardTitle className="text-lg font-medium font-poppins flex items-center">
          <AlertTriangle className="w-5 h-5 mr-2 text-amber-500" />
          Diagnóstico de Erros da API
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-4">
        {lastError ? (
          <div className="bg-red-900/30 border border-red-800 p-3 rounded-md mb-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5 mr-2" />
              <div>
                <h3 className="text-red-300 font-medium">Último erro detectado:</h3>
                <p className="text-sm text-red-200 mt-1">{lastError}</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2 border-red-700 text-red-300 hover:bg-red-900/50"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Tentar novamente
            </Button>
          </div>
        ) : (
          <div className="bg-green-900/20 border border-green-800 p-3 rounded-md mb-4">
            <div className="flex items-start">
              <Check className="w-5 h-5 text-green-400 shrink-0 mt-0.5 mr-2" />
              <div>
                <h3 className="text-green-300 font-medium">Sem erros recentes</h3>
                <p className="text-sm text-green-200/80 mt-1">
                  A conexão com a API da Deriv está funcionando normalmente.
                </p>
              </div>
            </div>
          </div>
        )}

        <h3 className="text-sm font-medium text-gray-300 mb-2 flex items-center">
          <HelpCircle className="w-4 h-4 mr-1 text-gray-400" />
          Erros comuns da API Deriv:
        </h3>
        
        <div className="space-y-2">
          {displayErrors.map((error) => (
            <div 
              key={error.code} 
              className="bg-[#1f3158] p-2 rounded-md text-xs flex items-start"
            >
              <div className="flex-1">
                <span className="text-amber-400 font-mono">{error.code}</span>
                <p className="text-[#8492b4] mt-1">{error.description}</p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-[#8492b4]">
                      <HelpCircle className="w-3 h-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p className="text-xs max-w-[200px]">{error.solution}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-3 w-full text-[#8492b4] border-[#1f3158] hover:bg-[#1f3158]/50"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              Ver lista completa de códigos de erro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Códigos de Erro da API Deriv</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Solução</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commonErrors.map((error) => (
                    <TableRow key={error.code}>
                      <TableCell className="font-mono text-amber-500">{error.code}</TableCell>
                      <TableCell>{error.description}</TableCell>
                      <TableCell>{error.solution}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}