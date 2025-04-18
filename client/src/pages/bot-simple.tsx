import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { SimpleDigitDisplay } from '@/components/SimpleDigitDisplay';
import { oauthDirectService } from "@/services/oauthDirectService";

export function BotSimplePage() {
  const { toast } = useToast();
  
  // Estado para autenticação e dados da conta
  const [accountInfo, setAccountInfo] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Estado para últimos dígitos recebidos
  const [lastDigits, setLastDigits] = useState<number[]>([]);
  
  // Estado para o valor de entrada e funcionamento do bot
  const [entryValue, setEntryValue] = useState("1.00");
  const [isBotRunning, setIsBotRunning] = useState(false);
  
  // Configurar conexão inicial
  useEffect(() => {
    console.log('[BOT_SIMPLE] Iniciando página simples do bot');
    
    // Recuperar informações da conta do localStorage
    const accountInfoStr = localStorage.getItem('deriv_account_info');
    const token = localStorage.getItem('deriv_oauth_token');
    
    if (accountInfoStr && token) {
      try {
        const parsedInfo = JSON.parse(accountInfoStr);
        setAccountInfo(parsedInfo);
        
        // Configurar a conta no serviço OAuth Direct
        oauthDirectService.setActiveAccount(
          parsedInfo.loginid || '', 
          token
        );
        
        // Inicializar a conexão WebSocket
        connectToApi();
      } catch (error) {
        console.error('[BOT_SIMPLE] Erro ao processar informações da conta:', error);
        toast({
          title: "Erro de autenticação",
          description: "Não foi possível recuperar informações da conta",
          variant: "destructive"
        });
      }
    } else {
      toast({
        title: "Não autenticado",
        description: "Faça login na dashboard primeiro",
        variant: "destructive"
      });
    }
    
    // Configurar listener para eventos do serviço OAuth
    const handleOAuthEvent = (event: any) => {
      if (event.type === 'tick') {
        console.log(`[BOT_SIMPLE] Tick recebido: ${event.price}, Último dígito: ${event.lastDigit}`);
        
        // Atualizar lista de últimos dígitos
        setLastDigits(prev => {
          const updated = [event.lastDigit, ...prev];
          return updated.slice(0, 20);
        });
      }
      
      if (event.type === 'authorized') {
        console.log('[BOT_SIMPLE] Autorização bem-sucedida:', event.account?.loginid);
        setIsConnected(true);
        
        toast({
          title: "Conectado com sucesso",
          description: `Conta: ${event.account?.loginid || 'Deriv'}`,
        });
      }
      
      if (event.type === 'error') {
        console.error('[BOT_SIMPLE] Erro:', event.message);
        toast({
          title: "Erro",
          description: event.message,
          variant: "destructive"
        });
      }
    };
    
    // Registrar o handler
    oauthDirectService.addEventListener(handleOAuthEvent);
    
    // Cleanup: remover o handler quando o componente for desmontado
    return () => {
      oauthDirectService.removeEventListener(handleOAuthEvent);
    };
  }, [toast]);
  
  // Conectar com a API da Deriv
  const connectToApi = async () => {
    try {
      // Iniciar a conexão WebSocket
      console.log('[BOT_SIMPLE] Iniciando conexão com a API Deriv...');
      const success = await oauthDirectService.initializeConnection();
      
      if (success) {
        console.log('[BOT_SIMPLE] Conexão inicializada com sucesso');
        setIsConnected(true);
        
        toast({
          title: "Conexão estabelecida",
          description: "Conectado à API Deriv com sucesso",
        });
      } else {
        console.error('[BOT_SIMPLE] Falha ao conectar com a API');
        setIsConnected(false);
        
        toast({
          title: "Falha na conexão",
          description: "Não foi possível conectar à API Deriv",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[BOT_SIMPLE] Erro ao conectar com a API:', error);
      setIsConnected(false);
      
      toast({
        title: "Erro de conexão",
        description: "Ocorreu um erro ao conectar com a API",
        variant: "destructive"
      });
    }
  };
  
  // Iniciar o bot
  const startBot = async () => {
    if (!isConnected) {
      toast({
        title: "Não conectado",
        description: "É necessário estar conectado para iniciar o bot",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Configurar o valor de entrada
      oauthDirectService.setSettings({
        entryValue: entryValue,
        contractType: 'DIGITEVEN',
        martingaleFactor: 1.5
      });
      
      // Iniciar o bot
      const success = await oauthDirectService.start();
      
      if (success) {
        setIsBotRunning(true);
        toast({
          title: "Bot iniciado",
          description: "Operações automáticas iniciadas com sucesso",
        });
      } else {
        toast({
          title: "Falha ao iniciar",
          description: "Não foi possível iniciar o bot",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('[BOT_SIMPLE] Erro ao iniciar o bot:', error);
      toast({
        title: "Erro ao iniciar",
        description: "Ocorreu um erro ao iniciar o bot",
        variant: "destructive"
      });
    }
  };
  
  // Parar o bot
  const stopBot = () => {
    oauthDirectService.stop();
    setIsBotRunning(false);
    toast({
      title: "Bot parado",
      description: "Operações automáticas interrompidas",
    });
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Robô de Operações (Simplificado)</h1>
      
      {/* Status da conexão */}
      <Card className="p-4 mb-6 bg-[#162440] border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium">Status da Conexão</h2>
            <p className="text-sm text-gray-400">
              {isConnected ? 'Conectado à API Deriv' : 'Desconectado'}
            </p>
          </div>
          <div className={`h-3 w-3 rounded-full ${isConnected ? 'bg-[#00e5b3]' : 'bg-[#ff444f]'}`}></div>
        </div>
        
        {accountInfo && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <p className="text-sm">
              <span className="text-gray-400">Conta:</span> {accountInfo.loginid}
            </p>
            <p className="text-sm">
              <span className="text-gray-400">Saldo:</span> {accountInfo.balance} {accountInfo.currency}
            </p>
          </div>
        )}
        
        <div className="mt-4">
          <Button 
            onClick={connectToApi}
            disabled={isConnected}
            className="w-full bg-[#2a3f6d] hover:bg-[#3a4f7d]"
          >
            Reconectar
          </Button>
        </div>
      </Card>
      
      {/* Exibição de dígitos */}
      <div className="mb-6">
        <SimpleDigitDisplay digits={lastDigits} symbol="R_100" />
      </div>
      
      {/* Configurações do bot */}
      <Card className="p-4 mb-6 bg-[#162440] border-slate-800">
        <h2 className="text-lg font-medium mb-4">Configurações do Bot</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="entry-value">Valor de Entrada ($)</Label>
            <Input
              id="entry-value"
              type="number"
              step="0.01"
              min="0.35"
              value={entryValue}
              onChange={(e) => setEntryValue(e.target.value)}
              className="bg-[#0e1a33] border-slate-700"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="bot-status">Status do Bot</Label>
            <div className="flex items-center space-x-2">
              <Label htmlFor="bot-status" className="text-sm">
                {isBotRunning ? 'Ativo' : 'Inativo'}
              </Label>
              <Switch
                id="bot-status"
                checked={isBotRunning}
                onCheckedChange={(checked) => {
                  if (checked) {
                    startBot();
                  } else {
                    stopBot();
                  }
                }}
              />
            </div>
          </div>
        </div>
      </Card>
      
      {/* Controles do bot */}
      <div className="flex space-x-4">
        <Button
          onClick={startBot}
          disabled={isBotRunning || !isConnected}
          className="flex-1 bg-[#00e5b3] text-black hover:bg-[#00c59a]"
        >
          Iniciar Bot
        </Button>
        
        <Button
          onClick={stopBot}
          disabled={!isBotRunning}
          className="flex-1 bg-[#ff444f] hover:bg-[#e03e48]"
        >
          Parar Bot
        </Button>
      </div>
    </div>
  );
}