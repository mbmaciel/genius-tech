import React from 'react';
import { toast } from '@/hooks/use-toast';
import TradingBot from '@/components/tradingBot/TradingBot';
import derivAPI from '@/lib/derivApi';
import { Bot } from 'lucide-react';

/**
 * Página dedicada ao Robô de Operações
 */
export default function TradingBotPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center mb-6">
        <Bot className="h-6 w-6 mr-2 text-[#00e5b3]" />
        <h1 className="text-2xl font-bold text-white">Robô de Operações</h1>
      </div>
      
      <div className="bg-[#162440] rounded-lg p-6 border border-slate-800">
        <TradingBot 
          apiToken={derivAPI.getToken() || ''}
          isConnected={derivAPI.getConnectionStatus()}
          onError={(error: string) => {
            toast({
              title: "Erro no Robô de Operações",
              description: error,
              variant: "destructive",
            });
          }}
        />
      </div>
    </div>
  );
}