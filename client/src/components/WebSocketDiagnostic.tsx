import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/card";
import { oauthDirectService } from "@/services/oauthDirectService";

/**
 * Componente para diagnóstico de conexão WebSocket
 * Exibe informações importantes para debug em tempo real
 */
export function WebSocketDiagnostic() {
  const [events, setEvents] = useState<{
    type: string;
    timestamp: number;
    count: number;
  }[]>([]);
  
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [connected, setConnected] = useState<boolean>(false);
  
  // Atualiza periodicamente o tempo desde a última atualização
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Monitora eventos de WebSocket
  useEffect(() => {
    console.log("[DIAGNOSTIC] Iniciando monitoramento de eventos WebSocket");
    
    const handleEvent = (event: any) => {
      console.log("[DIAGNOSTIC] Evento recebido:", event.type);
      
      // Atualizar contagem de eventos
      setEvents(prev => {
        const existingEvent = prev.find(e => e.type === event.type);
        
        if (existingEvent) {
          // Atualizar evento existente
          return prev.map(e => 
            e.type === event.type 
              ? { ...e, count: e.count + 1, timestamp: Date.now() }
              : e
          );
        } else {
          // Adicionar novo tipo de evento
          return [...prev, { 
            type: event.type, 
            timestamp: Date.now(),
            count: 1 
          }];
        }
      });
      
      // Atualizar status de conexão
      if (event.type === 'authorized') {
        setConnected(true);
      } else if (event.type === 'error' && event.message?.includes('conexão')) {
        setConnected(false);
      }
    };
    
    // Registrar handler
    oauthDirectService.addEventListener(handleEvent);
    
    return () => {
      oauthDirectService.removeEventListener(handleEvent);
    };
  }, []);
  
  // Calcula o tempo desde a última atualização
  const getTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return `${seconds}s atrás`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m atrás`;
    return `${Math.floor(seconds / 3600)}h atrás`;
  };
  
  return (
    <Card className="bg-slate-900 p-3 border border-slate-800">
      <h3 className="text-sm font-medium text-slate-300 mb-2">Diagnóstico WebSocket</h3>
      
      <div className="text-xs flex items-center gap-2 mb-3">
        <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-slate-400">
          {connected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
      
      <div className="space-y-1 text-xs">
        <div className="text-slate-400 mb-1">Eventos recebidos:</div>
        {events.length === 0 ? (
          <div className="text-slate-500 italic">Nenhum evento recebido</div>
        ) : (
          events.map((event, index) => (
            <div 
              key={`event-${event.type}-${index}`}
              className="flex justify-between py-1 border-t border-slate-800"
            >
              <span className="text-slate-300">{event.type}</span>
              <div className="flex gap-2">
                <span className="text-slate-400">{event.count}x</span>
                <span className="text-slate-500">{getTimeSince(event.timestamp)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      <div className="mt-2 pt-2 border-t border-slate-800 text-xs text-slate-500">
        Atualizado: {lastUpdate.toLocaleTimeString()}
      </div>
    </Card>
  );
}