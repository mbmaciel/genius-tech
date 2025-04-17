import React, { useState, useEffect } from 'react';
import derivAPI from '../../lib/derivApi';

interface DerivConnectButtonProps {
  onConnectionChange?: (isConnected: boolean) => void;
  onAuthChange?: (isAuthorized: boolean, account?: any) => void;
  className?: string;
}

export const DerivConnectButton: React.FC<DerivConnectButtonProps> = ({
  onConnectionChange,
  onAuthChange,
  className = ''
}) => {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountInfo, setAccountInfo] = useState<any>(null);

  // Verificar estado da conexão ao iniciar
  useEffect(() => {
    const checkConnection = () => {
      const isConnected = derivAPI.getConnectionStatus();
      setConnected(isConnected);
      
      if (isConnected) {
        const account = derivAPI.getAccountInfo();
        const isAuthorized = Object.keys(account).length > 0;
        setAuthorized(isAuthorized);
        if (isAuthorized) {
          setAccountInfo(account);
          onAuthChange?.(true, account);
        }
      }
    };

    checkConnection();

    // Adicionar event listeners para mudanças de estado
    const handleAuthorize = (e: CustomEvent) => {
      setAuthorized(true);
      setAccountInfo(derivAPI.getAccountInfo());
      onAuthChange?.(true, derivAPI.getAccountInfo());
    };

    const handleDisconnect = () => {
      setConnected(false);
      setAuthorized(false);
      setAccountInfo(null);
      onConnectionChange?.(false);
      onAuthChange?.(false);
    };

    document.addEventListener('deriv:authorize', handleAuthorize as EventListener);
    document.addEventListener('deriv:disconnect', handleDisconnect);
    
    return () => {
      document.removeEventListener('deriv:authorize', handleAuthorize as EventListener);
      document.removeEventListener('deriv:disconnect', handleDisconnect);
    };
  }, [onConnectionChange, onAuthChange]);

  // Conectar à API Deriv
  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      
      const response = await derivAPI.connect();
      
      setConnected(true);
      setAuthorized(response.authorized || false);
      
      if (response.accountInfo) {
        setAccountInfo(response.accountInfo);
      }
      
      onConnectionChange?.(true);
      if (response.authorized) {
        onAuthChange?.(true, response.accountInfo);
      }
    } catch (error) {
      setError(`Erro ao conectar: ${(error as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  // Desconectar da API
  const handleDisconnect = () => {
    derivAPI.disconnect(true);
    setConnected(false);
    setAuthorized(false);
    setAccountInfo(null);
    onConnectionChange?.(false);
    onAuthChange?.(false);
  };
  
  // Exibir informações da conta
  const renderAccountInfo = () => {
    if (!accountInfo) return null;
    
    return (
      <div className="account-info-mini mt-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-300">ID:</span>
          <span className="font-medium">{accountInfo.loginId}</span>
        </div>
        {accountInfo.balance && (
          <div className="flex justify-between">
            <span className="text-gray-300">Saldo:</span>
            <span className="font-medium">
              {accountInfo.balance.balance} {accountInfo.balance.currency}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`deriv-connect ${className}`}>
      {error && (
        <div className="error-message text-red-500 text-sm mb-2">
          {error}
        </div>
      )}
      
      {!connected && (
        <button
          className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? "Conectando..." : "Conectar à Deriv"}
        </button>
      )}
      
      {connected && (
        <div className="flex flex-col">
          <div className="flex items-center space-x-2">
            <span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>
            <span>{authorized ? 'Autenticado' : 'Conectado'}</span>
            <button
              className="ml-auto text-red-500 hover:text-red-700 text-sm"
              onClick={handleDisconnect}
            >
              Desconectar
            </button>
          </div>
          {authorized && renderAccountInfo()}
        </div>
      )}
    </div>
  );
};

export default DerivConnectButton;