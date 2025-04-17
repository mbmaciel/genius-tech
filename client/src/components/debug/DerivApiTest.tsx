import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertCircle, Check, Copy, ExternalLink, RefreshCw, Server, Terminal, Wifi, WifiOff } from 'lucide-react';

export default function DerivApiTest() {
  const [connectionStatus, setConnectionStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [apiUrl, setApiUrl] = useState('wss://ws.binaryws.com/websockets/v3');
  const [token, setToken] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [websocket, setWebsocket] = useState<WebSocket | null>(null);
  const [requestText, setRequestText] = useState('{"ping": 1}');
  const [isSendingRequest, setIsSendingRequest] = useState(false);

  // Load token from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('deriv_api_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Cleanup WebSocket on component unmount
  useEffect(() => {
    return () => {
      if (websocket) {
        addLog('Fechando conexão WebSocket');
        websocket.close();
      }
    };
  }, [websocket]);

  // Add a log entry
  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  // Connect to the API
  const connect = () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    addLog(`Iniciando conexão com ${apiUrl}`);
    
    try {
      const ws = new WebSocket(apiUrl);
      
      ws.onopen = () => {
        addLog('Conexão WebSocket estabelecida');
        setConnectionStatus(true);
        setIsConnecting(false);
        setWebsocket(ws);
        
        // If we have a token, authorize
        if (token) {
          authorize();
        }
      };
      
      ws.onclose = () => {
        addLog('Conexão WebSocket fechada');
        setConnectionStatus(false);
        setWebsocket(null);
      };
      
      ws.onerror = (error) => {
        addLog(`Erro de WebSocket: ${JSON.stringify(error)}`);
        setIsConnecting(false);
        setConnectionStatus(false);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog(`Recebido: ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`);
          setResponses(prev => [data, ...prev].slice(0, 10));
        } catch (error) {
          addLog(`Erro ao processar mensagem: ${error}`);
        }
      };
    } catch (error) {
      addLog(`Erro ao conectar: ${error}`);
      setIsConnecting(false);
    }
  };

  // Disconnect from the API
  const disconnect = () => {
    if (websocket) {
      addLog('Desconectando...');
      websocket.close();
      setWebsocket(null);
      setConnectionStatus(false);
    }
  };

  // Authorize with the API
  const authorize = () => {
    if (!websocket || !token) return;
    
    const request = {
      authorize: token,
      req_id: Date.now()
    };
    
    addLog(`Enviando solicitação de autorização`);
    websocket.send(JSON.stringify(request));
  };

  // Send a custom request
  const sendRequest = () => {
    if (!websocket) {
      addLog('WebSocket não está conectado');
      return;
    }
    
    setIsSendingRequest(true);
    
    try {
      const requestObj = JSON.parse(requestText);
      addLog(`Enviando: ${JSON.stringify(requestObj)}`);
      websocket.send(JSON.stringify(requestObj));
    } catch (error) {
      addLog(`Erro ao enviar requisição: ${error}`);
    } finally {
      setIsSendingRequest(false);
    }
  };

  // Send a ping request
  const sendPing = () => {
    if (!websocket) {
      addLog('WebSocket não está conectado');
      return;
    }
    
    const request = {
      ping: 1,
      req_id: Date.now()
    };
    
    addLog(`Enviando ping`);
    websocket.send(JSON.stringify(request));
  };

  // Format JSON for display
  const formatJson = (json: any): string => {
    return JSON.stringify(json, null, 2);
  };

  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        addLog('Copiado para a área de transferência');
      })
      .catch(err => {
        addLog(`Erro ao copiar: ${err}`);
      });
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
    addLog('Logs limpos');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-6">
        <Card className="bg-[#162746] border-[#1c3654]">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Server className="h-5 w-5 mr-2" />
              Conexão com a API
            </CardTitle>
            <CardDescription>
              Teste a conexão direta com a API WebSocket da Deriv
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <div className={`h-2 w-2 rounded-full ${connectionStatus ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-white">
                {connectionStatus ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api-url" className="text-white">URL da API</Label>
              <Input
                id="api-url"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                disabled={connectionStatus}
                className="bg-[#1f3158] border-[#1c3654] text-white"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="api-token" className="text-white">Token da API (opcional)</Label>
              <Input
                id="api-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                disabled={connectionStatus}
                className="bg-[#1f3158] border-[#1c3654] text-white"
              />
            </div>
          </CardContent>
          <CardFooter className="flex space-x-2">
            {connectionStatus ? (
              <>
                <Button 
                  variant="outline" 
                  className="border-[#1c3654] text-white hover:bg-[#1c3654]"
                  onClick={disconnect}
                >
                  <WifiOff className="h-4 w-4 mr-2" />
                  Desconectar
                </Button>
                <Button 
                  className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
                  onClick={sendPing}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Enviar Ping
                </Button>
              </>
            ) : (
              <Button 
                className="bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
                onClick={connect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Conectando...
                  </>
                ) : (
                  <>
                    <Wifi className="h-4 w-4 mr-2" />
                    Conectar
                  </>
                )}
              </Button>
            )}
          </CardFooter>
        </Card>
        
        <Card className="bg-[#162746] border-[#1c3654]">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Terminal className="h-5 w-5 mr-2" />
              Requisição Personalizada
            </CardTitle>
            <CardDescription>
              Envie requisições personalizadas para a API
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="request-text" className="text-white">JSON da Requisição</Label>
                <textarea
                  id="request-text"
                  rows={5}
                  value={requestText}
                  onChange={(e) => setRequestText(e.target.value)}
                  disabled={!connectionStatus}
                  className="w-full bg-[#1f3158] border-[#1c3654] text-white p-3 rounded-md font-mono text-sm"
                />
              </div>
              
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestText('{"ping": 1}')}
                  disabled={!connectionStatus}
                  className="border-[#1c3654] text-white hover:bg-[#1c3654]"
                >
                  Ping
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestText(`{"authorize": "${token}"}`)}
                  disabled={!connectionStatus || !token}
                  className="border-[#1c3654] text-white hover:bg-[#1c3654]"
                >
                  Authorize
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestText('{"ticks": "R_100"}')}
                  disabled={!connectionStatus}
                  className="border-[#1c3654] text-white hover:bg-[#1c3654]"
                >
                  Ticks
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRequestText('{"forget_all": ["ticks"]}')}
                  disabled={!connectionStatus}
                  className="border-[#1c3654] text-white hover:bg-[#1c3654]"
                >
                  Forget All
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full bg-[#00e5b3] hover:bg-[#00c69a] text-[#0e1a33]"
              onClick={sendRequest}
              disabled={!connectionStatus || isSendingRequest}
            >
              {isSendingRequest ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Enviar Requisição
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="space-y-6">
        <Card className="bg-[#162746] border-[#1c3654]">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Respostas</CardTitle>
              <Badge variant="outline" className="text-white">
                {responses.length}
              </Badge>
            </div>
            <CardDescription>
              Respostas recebidas da API
            </CardDescription>
          </CardHeader>
          <CardContent className="max-h-[400px] overflow-y-auto">
            {responses.length === 0 ? (
              <div className="text-center p-4 text-[#8492b4] italic">
                Nenhuma resposta recebida ainda
              </div>
            ) : (
              <Accordion type="multiple" className="space-y-2">
                {responses.map((response, index) => (
                  <AccordionItem 
                    key={index}
                    value={`response-${index}`}
                    className="bg-[#1f3158] rounded-md border-[#1c3654]"
                  >
                    <AccordionTrigger className="px-4 py-2 text-white hover:no-underline">
                      <div className="flex items-center justify-between w-full">
                        <span>
                          {response.msg_type}
                          {response.req_id && <span className="text-xs ml-2 text-[#8492b4]">ID: {response.req_id}</span>}
                        </span>
                        {response.error ? (
                          <Badge variant="destructive" className="ml-auto mr-4">Erro</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-green-900/30 text-green-400 ml-auto mr-4">Sucesso</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="flex justify-end mb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(JSON.stringify(response, null, 2))}
                          className="text-xs border-[#1c3654] text-white hover:bg-[#1c3654]"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copiar
                        </Button>
                      </div>
                      <pre className="bg-[#0e1a33] p-4 rounded-md text-xs text-white overflow-x-auto">
                        {formatJson(response)}
                      </pre>
                      {response.error && (
                        <Alert variant="destructive" className="mt-2 bg-red-900/30 border-red-800">
                          <AlertCircle className="h-4 w-4" />
                          <AlertTitle>Erro {response.error.code}</AlertTitle>
                          <AlertDescription>
                            {response.error.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>
        
        <Card className="bg-[#162746] border-[#1c3654]">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-white">Logs</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={clearLogs}
                className="border-[#1c3654] text-white hover:bg-[#1c3654]"
              >
                Limpar
              </Button>
            </div>
            <CardDescription>
              Logs de debug da conexão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-[#1f3158] rounded-md p-4 max-h-[200px] overflow-y-auto font-mono text-xs text-white">
              {logs.length === 0 ? (
                <div className="text-center p-4 text-[#8492b4] italic">
                  Nenhum log ainda
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-[#162746] border-[#1c3654]">
          <CardHeader>
            <CardTitle className="text-white">
              Informações de Diagnóstico
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-white">Status da API:</Label>
              <div className="flex items-center space-x-2 mt-1">
                <div className={`w-3 h-3 rounded-full ${connectionStatus ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm">{connectionStatus ? 'Conectado' : 'Desconectado'}</span>
              </div>
            </div>
            
            <div>
              <Label className="text-white">Token Salvo:</Label>
              <div className="mt-1 text-sm">
                {token ? 
                  <div className="flex items-center text-green-400">
                    <Check className="h-4 w-4 mr-1" />
                    <span>Token presente</span>
                  </div> : 
                  <span className="text-[#8492b4]">Nenhum token informado</span>
                }
              </div>
            </div>
            
            <Separator className="bg-[#1c3654]" />
            
            <div>
              <Label className="text-white">Status do WebSocket:</Label>
              <div className="mt-1 text-sm">
                {websocket ? (
                  <div>
                    <Badge variant="outline" className="bg-blue-900/30 text-blue-400">
                      {websocket.readyState === WebSocket.CONNECTING ? 'Conectando' :
                       websocket.readyState === WebSocket.OPEN ? 'Aberto' :
                       websocket.readyState === WebSocket.CLOSING ? 'Fechando' :
                       'Fechado'}
                    </Badge>
                    <p className="mt-1 text-[#8492b4]">
                      ReadyState: {websocket.readyState}
                    </p>
                  </div>
                ) : (
                  <span className="text-[#8492b4]">WebSocket não inicializado</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
