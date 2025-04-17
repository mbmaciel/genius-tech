import React, { useState, useEffect } from 'react';
import derivAPI from '@/lib/derivApi';
import { Skeleton } from '@/components/ui/skeleton';

export function AccountDisplay() {
  const [accountInfo, setAccountInfo] = useState<{
    loginid?: string;
    fullname?: string;
    balance?: number;
    currency?: string;
    isVirtual?: boolean;
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
          balance: info.balance,
          currency: info.currency,
          isVirtual: info.isVirtual
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <p className="text-[#8492b4] text-xs">ID da Conta</p>
          <Skeleton className="h-6 w-24 bg-[#1f3158]" />
        </div>
        
        <div className="space-y-1">
          <p className="text-[#8492b4] text-xs">Tipo</p>
          <Skeleton className="h-6 w-16 bg-[#1f3158]" />
        </div>
        
        <div className="space-y-1">
          <p className="text-[#8492b4] text-xs">Saldo</p>
          <Skeleton className="h-6 w-20 bg-[#1f3158]" />
        </div>
        
        <div className="space-y-1">
          <p className="text-[#8492b4] text-xs">Nome</p>
          <Skeleton className="h-6 w-32 bg-[#1f3158]" />
        </div>
      </div>
    );
  }

  if (!accountInfo) {
    return (
      <div className="p-4 text-center">
        <p className="text-[#8492b4]">Nenhuma conta ativa</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <p className="text-[#8492b4] text-xs">ID da Conta</p>
        <p className="font-mono font-medium">{accountInfo.loginid || 'N/A'}</p>
      </div>
      
      <div className="space-y-1">
        <p className="text-[#8492b4] text-xs">Tipo</p>
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#00e5b3]/10 text-[#00e5b3]">
            <span className={`w-1.5 h-1.5 rounded-full ${accountInfo.isVirtual ? 'bg-blue-500' : 'bg-[#00e5b3]'} mr-1`}></span>
            {accountInfo.isVirtual ? 'Demo' : 'Real'}
          </span>
        </div>
      </div>
      
      <div className="space-y-1">
        <p className="text-[#8492b4] text-xs">Saldo</p>
        <p className="text-white font-semibold flex items-center">
          <span>{formattedBalance}</span>
          <span className="ml-1 text-xs text-[#8492b4]">{accountInfo.currency || 'USD'}</span>
        </p>
      </div>
      
      <div className="space-y-1">
        <p className="text-[#8492b4] text-xs">Nome</p>
        <p className="text-white">{accountInfo.fullname || 'N/A'}</p>
      </div>
    </div>
  );
}
