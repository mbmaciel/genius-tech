import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import derivAPI from '@/lib/derivApi';

export default function AccountInfo() {
  const [accountInfo, setAccountInfo] = useState<{
    loginid?: string;
    fullname?: string;
    email?: string;
    balance?: number;
    currency?: string;
    isVirtual?: boolean;
    landingCompany?: string;
  } | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Function to update account info
    const updateAccountInfo = () => {
      const info = derivAPI.getAccountInfo();
      if (info) {
        setAccountInfo({
          loginid: info.loginId,
          fullname: info.fullname,
          email: info.email,
          balance: info.balance,
          currency: info.currency,
          isVirtual: info.isVirtual,
          landingCompany: info.landingCompanyName
        });
        setIsLoading(false);
      }
    };

    // Initial load
    updateAccountInfo();
    
    // Set up listener for account info changes
    const handleAccountInfo = () => {
      updateAccountInfo();
    };
    
    // Set up listener for balance updates
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
    
    // Add event listeners
    document.addEventListener('deriv:account_info' as any, handleAccountInfo);
    document.addEventListener('deriv:balance_update' as any, handleBalanceUpdate as any);
    
    // Listen for connection status changes
    const handleConnectionStatus = (event: CustomEvent) => {
      if (event.detail.connected) {
        updateAccountInfo();
      }
    };
    
    document.addEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    
    // Clean up event listeners on unmount
    return () => {
      document.removeEventListener('deriv:account_info' as any, handleAccountInfo);
      document.removeEventListener('deriv:balance_update' as any, handleBalanceUpdate as any);
      document.removeEventListener('deriv:connection_status' as any, handleConnectionStatus as any);
    };
  }, []);

  // Format balance with 2 decimal places
  const formattedBalance = accountInfo?.balance 
    ? new Intl.NumberFormat('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      }).format(accountInfo.balance)
    : '0.00';

  return (
    <Card className="bg-[#162746] border-[#1c3654]">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-xl">Informações da Conta</CardTitle>
        <CardDescription>Detalhes da sua conta Deriv</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-[#1f3158]" />
              <Skeleton className="h-4 w-32 bg-[#1f3158]" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-[#1f3158]" />
              <Skeleton className="h-4 w-36 bg-[#1f3158]" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-[#1f3158]" />
              <Skeleton className="h-4 w-28 bg-[#1f3158]" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-20 bg-[#1f3158]" />
              <Skeleton className="h-4 w-24 bg-[#1f3158]" />
            </div>
          </div>
        ) : !accountInfo ? (
          <div className="text-center py-3 text-[#8492b4]">
            Você não está conectado.
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#8492b4]">ID da Conta:</span>
              <span className="text-white font-medium">{accountInfo.loginid}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8492b4]">Nome:</span>
              <span className="text-white">{accountInfo.fullname}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8492b4]">Email:</span>
              <span className="text-white">{accountInfo.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8492b4]">Saldo:</span>
              <span className="text-white font-bold">
                {formattedBalance} {accountInfo.currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8492b4]">Tipo:</span>
              <span className="text-white">
                {accountInfo.isVirtual ? 'Demo' : 'Real'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#8492b4]">Jurisdição:</span>
              <span className="text-white">{accountInfo.landingCompany || 'N/A'}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
