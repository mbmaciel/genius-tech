import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, ArrowDown, ArrowUp, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import derivAPI from '@/lib/derivApi';

export default function CashierOperations() {
  const [isConnected, setIsConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState<{
    currency?: string;
    balance?: number;
    isVirtual?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Deposit form state
  const [depositAmount, setDepositAmount] = useState("");
  
  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");

  // Check connection status when component mounts
  useEffect(() => {
    const connectionStatus = derivAPI.getConnectionStatus();
    setIsConnected(connectionStatus);
    
    // Get account info if connected
    if (connectionStatus) {
      const info = derivAPI.getAccountInfo();
      if (info) {
        setAccountInfo({
          currency: info.currency,
          balance: info.balance,
          isVirtual: info.isVirtual
        });
      }
    }
    
    // Listen for connection status changes
    const handleConnectionStatus = (event: CustomEvent) => {
      setIsConnected(event.detail.connected);
      
      // Update account info when connection changes
      if (event.detail.connected) {
        const info = derivAPI.getAccountInfo();
        if (info) {
          setAccountInfo({
            currency: info.currency,
            balance: info.balance,
            isVirtual: info.isVirtual
          });
        }
      } else {
        setAccountInfo(null);
      }
    };
    
    // Listen for balance updates
    const handleBalanceUpdate = (event: CustomEvent) => {
      const balanceData = event.detail;
      
      setAccountInfo(prev => {
        if (!prev) return prev;
        
        return {
          ...prev,
          balance: balanceData.balance,
          currency: balanceData.currency
        };
      });
    };
    
    document.addEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    document.addEventListener('deriv:balance_update' as any, handleBalanceUpdate as any);
    
    // Cleanup listeners on unmount
    return () => {
      document.removeEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
      document.removeEventListener('deriv:balance_update' as any, handleBalanceUpdate as any);
    };
  }, []);

  // Handle deposit
  const handleDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // In a real app, this would integrate with Deriv's cashier API
    // For this implementation, we'll redirect to Deriv's cashier page
    setTimeout(() => {
      setIsLoading(false);
      window.open('https://app.deriv.com/cashier/deposit', '_blank');
      
      toast({
        title: "Redirecionando para o Caixa",
        description: "Você será redirecionado para o Caixa na Deriv para completar seu depósito.",
      });
    }, 1000);
  };

  // Handle withdrawal
  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // In a real app, this would integrate with Deriv's cashier API
    // For this implementation, we'll redirect to Deriv's cashier page
    setTimeout(() => {
      setIsLoading(false);
      window.open('https://app.deriv.com/cashier/withdrawal', '_blank');
      
      toast({
        title: "Redirecionando para o Caixa",
        description: "Você será redirecionado para o Caixa na Deriv para completar seu saque.",
      });
    }, 1000);
  };

  // Format currency
  const formatCurrency = (amount: number | undefined): string => {
    if (amount === undefined) return '0.00';
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (!isConnected) {
    return (
      <Card className="bg-[#162746] border-[#1c3654]">
        <CardHeader className="pb-2">
          <CardTitle className="text-white flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-[#00e5b3]" />
            Operações de Caixa
          </CardTitle>
          <CardDescription>
            Gerenciamento de depósitos e saques
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Não conectado</AlertTitle>
            <AlertDescription>
              Você precisa estar conectado à API Deriv para acessar as operações de caixa.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#162746] border-[#1c3654]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-[#00e5b3]" />
          Operações de Caixa
        </CardTitle>
        <CardDescription>
          Gerenciamento de depósitos e saques
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 p-3 bg-[#1f3158]/50 rounded-lg">
          <p className="text-[#8492b4] text-sm mb-1">Saldo Atual</p>
          <p className="text-2xl font-bold text-white">
            {formatCurrency(accountInfo?.balance || 0)} {accountInfo?.currency || 'USD'}
          </p>
          {accountInfo?.isVirtual && (
            <p className="text-xs mt-1 text-blue-400 bg-blue-900/30 inline-block px-2 py-1 rounded">
              Conta Demo
            </p>
          )}
        </div>
        
        <Tabs defaultValue="deposit" className="w-full">
          <TabsList className="bg-[#1f3158] text-white">
            <TabsTrigger value="deposit">Depósito</TabsTrigger>
            <TabsTrigger value="withdraw">Saque</TabsTrigger>
          </TabsList>
          
          <TabsContent value="deposit" className="py-4">
            <form onSubmit={handleDeposit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount" className="text-white">Valor a Depositar</Label>
                  <div className="relative">
                    <Input
                      id="deposit-amount"
                      type="number"
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="bg-[#1f3158] border-[#1c3654] text-white pl-10"
                      min="10"
                      required
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-[#8492b4]">{accountInfo?.currency || 'USD'}</span>
                    </div>
                  </div>
                </div>
                
                <Alert className="bg-blue-900/30 border-blue-800 text-blue-100">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertTitle className="text-blue-200">Atenção</AlertTitle>
                  <AlertDescription className="text-blue-100">
                    Você será redirecionado para o site oficial da Deriv para concluir o depósito com segurança.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  type="submit" 
                  className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
                  disabled={isLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Realizar Depósito
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
          
          <TabsContent value="withdraw" className="py-4">
            <form onSubmit={handleWithdraw}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdraw-amount" className="text-white">Valor a Sacar</Label>
                  <div className="relative">
                    <Input
                      id="withdraw-amount"
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="bg-[#1f3158] border-[#1c3654] text-white pl-10"
                      min="10"
                      max={accountInfo?.balance?.toString()}
                      required
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-[#8492b4]">{accountInfo?.currency || 'USD'}</span>
                    </div>
                  </div>
                </div>
                
                <Alert className="bg-blue-900/30 border-blue-800 text-blue-100">
                  <AlertCircle className="h-4 w-4 text-blue-400" />
                  <AlertTitle className="text-blue-200">Atenção</AlertTitle>
                  <AlertDescription className="text-blue-100">
                    Você será redirecionado para o site oficial da Deriv para concluir o saque com segurança.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  type="submit" 
                  className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
                  disabled={isLoading || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || (accountInfo?.balance !== undefined && parseFloat(withdrawAmount) > accountInfo.balance)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Realizar Saque
                    </>
                  )}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter>
        <Button 
          variant="outline" 
          className="w-full text-white border-[#1c3654] hover:bg-[#1c3654]"
          onClick={() => window.open('https://app.deriv.com/cashier', '_blank')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir Caixa Completo
        </Button>
      </CardFooter>
    </Card>
  );
}
