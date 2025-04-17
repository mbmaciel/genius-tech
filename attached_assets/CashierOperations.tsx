import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CircleDollarSign, ArrowUpCircle, ArrowDownCircle, Loader2, Wallet, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import derivAPI from "@/lib/derivApi";

export interface CashierResponse {
  cashier?: string | {
    action: 'deposit' | 'withdraw';
    deposit?: {
      address: string;
    };
    withdraw?: {
      id: string;
      status_code: string;
      status_message: string;
      dry_run?: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

type CashierType = 'deposit' | 'withdraw';

/**
 * Componente para operações de caixa (depósito e saque)
 */
export default function CashierOperations() {
  const [activeTab, setActiveTab] = useState<CashierType>('deposit');
  const [isLoading, setIsLoading] = useState(false);
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [cashierUrl, setCashierUrl] = useState<string | null>(null);
  const [cryptoDepositAddress, setCryptoDepositAddress] = useState<string | null>(null);
  const [withdrawalResult, setWithdrawalResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { toast } = useToast();
  
  // Função para processar operação de depósito
  const handleDeposit = async (type: 'url' | 'api' = 'url') => {
    if (!derivAPI.isAuthorized()) {
      toast({
        title: "Não autenticado",
        description: "Você precisa estar conectado à Deriv para realizar operações de caixa.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setCashierUrl(null);
    setCryptoDepositAddress(null);
    
    try {
      const provider = type === 'api' ? 'crypto' : 'doughflow';
      
      const response = await derivAPI.send({
        cashier: 'deposit',
        provider: provider,
        type: type
      }) as CashierResponse;
      
      if (response.error) {
        setError(`Erro: ${response.error.message} (Código: ${response.error.code})`);
        return;
      }
      
      if (typeof response.cashier === 'string') {
        // URL para serviço de caixa externo
        setCashierUrl(response.cashier);
      } else if (response.cashier && 'deposit' in response.cashier) {
        // Resposta para depósito em cripto
        setCryptoDepositAddress(response.cashier.deposit?.address || null);
      } else {
        setError('Resposta inválida do servidor para operação de depósito');
      }
      
      toast({
        title: "Consulta realizada",
        description: "Informações de depósito obtidas com sucesso",
      });
    } catch (error: any) {
      console.error('Erro ao processar depósito:', error);
      setError(`Erro ao processar depósito: ${error.message || 'Erro desconhecido'}`);
      
      toast({
        title: "Erro de processamento",
        description: error.message || "Ocorreu um erro ao processar a operação de depósito",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para processar operação de saque
  const handleWithdraw = async (type: 'url' | 'api' = 'url', dryRun: boolean = false) => {
    if (!derivAPI.isAuthorized()) {
      toast({
        title: "Não autenticado",
        description: "Você precisa estar conectado à Deriv para realizar operações de caixa.",
        variant: "destructive",
      });
      return;
    }
    
    // Validações para saque em cripto
    if (type === 'api') {
      if (!cryptoAddress.trim()) {
        setError('Endereço de carteira criptográfica é obrigatório');
        return;
      }
      
      if (!amount || parseFloat(amount) <= 0) {
        setError('Por favor, insira um valor válido para saque');
        return;
      }
    }
    
    setIsLoading(true);
    setError(null);
    setCashierUrl(null);
    setWithdrawalResult(null);
    
    try {
      const provider = type === 'api' ? 'crypto' : 'doughflow';
      
      // Preparar parâmetros para a requisição
      const params: any = {
        cashier: 'withdraw',
        provider: provider,
        type: type
      };
      
      // Adicionar parâmetros específicos para saque em cripto
      if (type === 'api') {
        params.address = cryptoAddress.trim();
        params.amount = parseFloat(amount);
        
        if (dryRun) {
          params.dry_run = 1;
        }
      }
      
      const response = await derivAPI.send(params) as CashierResponse;
      
      if (response.error) {
        setError(`Erro: ${response.error.message} (Código: ${response.error.code})`);
        return;
      }
      
      if (typeof response.cashier === 'string') {
        // URL para serviço de caixa externo
        setCashierUrl(response.cashier);
      } else if (response.cashier && 'withdraw' in response.cashier) {
        // Resposta para saque em cripto
        setWithdrawalResult(response.cashier.withdraw);
        
        toast({
          title: dryRun ? "Validação bem-sucedida" : "Solicitação de saque enviada",
          description: dryRun 
            ? "Os parâmetros de saque são válidos"
            : `ID da transação: ${response.cashier.withdraw?.id}`,
        });
      } else {
        setError('Resposta inválida do servidor para operação de saque');
      }
    } catch (error: any) {
      console.error('Erro ao processar saque:', error);
      setError(`Erro ao processar saque: ${error.message || 'Erro desconhecido'}`);
      
      toast({
        title: "Erro de processamento",
        description: error.message || "Ocorreu um erro ao processar a operação de saque",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Renderizar URL do caixa (para depósito ou saque)
  const renderCashierUrl = () => {
    if (!cashierUrl) return null;
    
    return (
      <div className="mt-4 p-3 bg-slate-700/40 border border-slate-700 rounded-md">
        <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
          <ExternalLink className="h-4 w-4 mr-2 text-slate-400" />
          URL do Caixa
        </h3>
        <p className="text-xs text-slate-400 mb-2">
          Clique no botão abaixo para abrir a página de {activeTab === 'deposit' ? 'depósito' : 'saque'} em uma nova janela:
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={() => window.open(cashierUrl, '_blank')}
        >
          <ExternalLink className="h-3 w-3 mr-2" />
          Abrir página de {activeTab === 'deposit' ? 'depósito' : 'saque'}
        </Button>
      </div>
    );
  };
  
  // Renderizar endereço de depósito em cripto
  const renderCryptoDepositAddress = () => {
    if (!cryptoDepositAddress) return null;
    
    return (
      <div className="mt-4 p-3 bg-slate-700/40 border border-slate-700 rounded-md">
        <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
          <Wallet className="h-4 w-4 mr-2 text-slate-400" />
          Endereço para Depósito
        </h3>
        <p className="text-xs text-slate-400 mb-2">
          Envie seus fundos para o seguinte endereço:
        </p>
        <div className="p-2 bg-slate-800 rounded text-xs font-mono text-slate-300 overflow-auto">
          {cryptoDepositAddress}
        </div>
      </div>
    );
  };
  
  // Renderizar resultado do saque
  const renderWithdrawalResult = () => {
    if (!withdrawalResult) return null;
    
    return (
      <div className="mt-4 p-3 bg-slate-700/40 border border-slate-700 rounded-md">
        <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center">
          <CircleDollarSign className="h-4 w-4 mr-2 text-slate-400" />
          Resultado da Operação
        </h3>
        
        {withdrawalResult.dry_run ? (
          <Alert className="bg-green-600/10 border-green-600/30 text-green-400">
            <AlertTitle>Validação bem-sucedida</AlertTitle>
            <AlertDescription>
              Os parâmetros fornecidos são válidos para saque em criptomoeda.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-slate-400">ID da Transação</p>
                <p className="font-medium text-white">{withdrawalResult.id}</p>
              </div>
              <div>
                <p className="text-slate-400">Status</p>
                <p className="font-medium text-white">{withdrawalResult.status_code}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              {withdrawalResult.status_message}
            </p>
          </>
        )}
      </div>
    );
  };
  
  return (
    <Card className="bg-[#162440] border-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg text-white">Operações de Caixa</CardTitle>
        <CardDescription>
          Realize depósitos e saques em sua conta Deriv
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs 
          defaultValue="deposit" 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as CashierType)}
          className="space-y-4"
        >
          <TabsList className="grid grid-cols-2 mb-2">
            <TabsTrigger value="deposit" className="flex items-center">
              <ArrowDownCircle className="h-4 w-4 mr-2" />
              Depósito
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="flex items-center">
              <ArrowUpCircle className="h-4 w-4 mr-2" />
              Saque
            </TabsTrigger>
          </TabsList>
          
          {/* Mostrar erros */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <TabsContent value="deposit" className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="rounded-md border border-slate-700 p-4">
                  <div className="font-medium flex items-center mb-3">
                    <CircleDollarSign className="h-4 w-4 mr-2 text-slate-400" />
                    Depósito via Fluxo de Pagamentos
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    Utilize o sistema de pagamentos integrado da Deriv para depósitos via cartão, transferência bancária e outros métodos disponíveis.
                  </p>
                  <Button 
                    onClick={() => handleDeposit('url')}
                    disabled={isLoading}
                    className="w-full mt-2 bg-[#00e5b3] hover:bg-[#00c59b] text-black"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>Continuar para Depósito</>
                    )}
                  </Button>
                </div>
                
                <div className="rounded-md border border-slate-700 p-4">
                  <div className="font-medium flex items-center mb-3">
                    <Wallet className="h-4 w-4 mr-2 text-slate-400" />
                    Depósito via Criptomoedas
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    Deposite fundos utilizando criptomoedas.
                  </p>
                  <Button 
                    onClick={() => handleDeposit('api')}
                    disabled={isLoading}
                    className="w-full mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>Obter Endereço para Depósito</>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Exibir URL do caixa */}
              {renderCashierUrl()}
              
              {/* Exibir endereço para depósito em cripto */}
              {renderCryptoDepositAddress()}
            </div>
          </TabsContent>
          
          <TabsContent value="withdraw" className="space-y-4">
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="rounded-md border border-slate-700 p-4">
                  <div className="font-medium flex items-center mb-3">
                    <CircleDollarSign className="h-4 w-4 mr-2 text-slate-400" />
                    Saque via Fluxo de Pagamentos
                  </div>
                  <p className="text-sm text-slate-400 mb-4">
                    Utilize o sistema de pagamentos integrado da Deriv para saques via transferência bancária e outros métodos disponíveis.
                  </p>
                  <Button 
                    onClick={() => handleWithdraw('url')}
                    disabled={isLoading}
                    className="w-full mt-2 bg-[#00e5b3] hover:bg-[#00c59b] text-black"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>Continuar para Saque</>
                    )}
                  </Button>
                </div>
                
                <div className="rounded-md border border-slate-700 p-4">
                  <div className="font-medium flex items-center mb-3">
                    <Wallet className="h-4 w-4 mr-2 text-slate-400" />
                    Saque via Criptomoedas
                  </div>
                  <div className="space-y-3 mb-4">
                    <div className="space-y-1">
                      <Label htmlFor="crypto-address">
                        Endereço da Carteira
                      </Label>
                      <Input
                        id="crypto-address"
                        placeholder="Insira o endereço da carteira de criptomoeda"
                        value={cryptoAddress}
                        onChange={(e) => setCryptoAddress(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="amount">
                        Valor
                      </Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Valor para saque"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      onClick={() => handleWithdraw('api', true)}
                      disabled={isLoading}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Validando...
                        </>
                      ) : (
                        <>Validar Dados</>
                      )}
                    </Button>
                    
                    <Button 
                      onClick={() => handleWithdraw('api')}
                      disabled={isLoading}
                      size="sm"
                      className="flex-1"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>Solicitar Saque</>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {/* Exibir URL do caixa */}
              {renderCashierUrl()}
              
              {/* Exibir resultado do saque */}
              {renderWithdrawalResult()}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}