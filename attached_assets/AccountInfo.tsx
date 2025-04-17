import React from 'react';

interface AccountInfoProps {
  accountInfo: {
    loginId?: string;
    name?: string;
    email?: string;
    balance?: {
      balance: number;
      currency: string;
      loginId: string;
    };
    isVirtual?: boolean;
    landingCompanyName?: string;
    loginTime?: string;
  } | null;
  className?: string;
}

const AccountInfo: React.FC<AccountInfoProps> = ({
  accountInfo,
  className = ''
}) => {
  if (!accountInfo) {
    return (
      <div className={`account-info ${className} bg-opacity-10 bg-gray-800 p-4 rounded-lg shadow-md`}>
        <div className="text-center text-gray-400">
          <p>Nenhuma conta conectada</p>
        </div>
      </div>
    );
  }

  const { loginId, name, email, balance, isVirtual, landingCompanyName, loginTime } = accountInfo;
  
  // Formatar hora de login
  const formattedLoginTime = loginTime 
    ? new Date(loginTime).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }) 
    : '';
  
  return (
    <div className={`account-info ${className} bg-opacity-10 bg-gray-800 p-4 rounded-lg shadow-md`}>
      <h3 className="text-lg font-semibold text-green-400 mb-4 pb-2 border-b border-gray-700">
        Informações da Conta
      </h3>
      
      <div className="grid gap-3">
        <div className="flex justify-between">
          <span className="text-gray-400">Tipo de Conta:</span>
          <span className={`font-medium ${isVirtual ? 'text-blue-400' : 'text-green-400'}`}>
            {isVirtual ? 'Demo' : 'Real'}
          </span>
        </div>
        
        {loginId && (
          <div className="flex justify-between">
            <span className="text-gray-400">ID da Conta:</span>
            <span className="font-medium">{loginId}</span>
          </div>
        )}
        
        {name && (
          <div className="flex justify-between">
            <span className="text-gray-400">Nome:</span>
            <span className="font-medium">{name}</span>
          </div>
        )}
        
        {email && (
          <div className="flex justify-between overflow-hidden">
            <span className="text-gray-400">Email:</span>
            <span className="font-medium truncate ml-2">{email}</span>
          </div>
        )}
        
        {landingCompanyName && (
          <div className="flex justify-between">
            <span className="text-gray-400">Jurisdição:</span>
            <span className="font-medium">{landingCompanyName}</span>
          </div>
        )}
        
        {balance && (
          <div className="flex justify-between text-lg mt-2 pt-2 border-t border-gray-700">
            <span className="text-gray-400">Saldo:</span>
            <span className="font-bold text-green-400">
              {balance.balance.toFixed(2)} {balance.currency}
            </span>
          </div>
        )}
        
        {formattedLoginTime && (
          <div className="text-xs text-gray-500 mt-2 text-right">
            Conectado em: {formattedLoginTime}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountInfo;