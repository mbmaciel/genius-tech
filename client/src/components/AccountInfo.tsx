import { Badge } from "@/components/ui/badge";
import { Wallet, Calendar, DollarSign, BadgeInfo } from "lucide-react";

interface AccountInfoProps {
  accountInfo: {
    loginid?: string;
    balance?: number;
    currency?: string;
    fullname?: string;
    email?: string;
    is_virtual?: boolean | number;
    landing_company_name?: string;
    country?: string;
    account_type?: string;
  } | null;
  className?: string;
}

export function AccountInfo({ accountInfo, className = '' }: AccountInfoProps) {
  if (!accountInfo) return null;
  
  const isVirtual = accountInfo.is_virtual === 1 || accountInfo.is_virtual === true;
  const balance = accountInfo.balance !== undefined ? accountInfo.balance : 0;
  const currency = accountInfo.currency || 'USD';
  
  return (
    <div className={`bg-[#13203a] rounded-lg p-4 shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-white font-medium">{accountInfo.loginid}</h2>
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className={`${isVirtual ? 'bg-blue-900/20 text-blue-400 border-blue-800' : 'bg-green-900/20 text-green-400 border-green-800'}`}>
                {isVirtual ? 'Demo' : 'Real'}
              </Badge>
              <Badge variant="outline" className="bg-purple-900/20 text-purple-400 border-purple-800">
                {accountInfo.landing_company_name || accountInfo.account_type || 'Standard'}
              </Badge>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-white">
            {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
          </div>
          <div className="text-sm text-gray-400">Saldo disponível</div>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-300">
        <div className="flex items-center space-x-2">
          <BadgeInfo className="h-4 w-4 text-gray-400" />
          <span>{accountInfo.fullname || 'Nome não disponível'}</span>
        </div>
        <div className="flex items-center space-x-2">
          <DollarSign className="h-4 w-4 text-gray-400" />
          <span>{currency}</span>
        </div>
      </div>
    </div>
  );
}