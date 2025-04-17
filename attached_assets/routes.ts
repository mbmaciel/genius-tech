import { Express, Request, Response } from 'express';
import { createServer, Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { registerStrategyRoutes } from './strategies';

// Função auxiliar para fazer requisições à API da Deriv
async function makeDerivRequest(request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    try {
      // URL da API WebSocket da Deriv com app_id correto
      const derivWsUrl = 'wss://ws.derivws.com/websockets/v3?app_id=71403';
      
      // Conectar ao WebSocket da Deriv
      const ws = new WebSocket(derivWsUrl);
      
      // Timeout de conexão (10 segundos)
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout de conexão com a API da Deriv'));
      }, 10000);
      
      // Quando a conexão estiver aberta, enviar a requisição
      ws.onopen = () => {
        const requestJson = JSON.stringify(request);
        ws.send(requestJson);
      };
      
      // Tratar a resposta
      ws.onmessage = (event) => {
        clearTimeout(timeout);
        try {
          const response = JSON.parse(event.data.toString());
          ws.close();
          resolve(response);
        } catch (error) {
          ws.close();
          reject(new Error('Erro ao processar resposta da API da Deriv'));
        }
      };
      
      // Tratar erros
      ws.onerror = (error) => {
        clearTimeout(timeout);
        ws.close();
        reject(error);
      };
      
      // Tratar fechamento de conexão
      ws.onclose = () => {
        clearTimeout(timeout);
        // Se o WebSocket for fechado sem resposta
        reject(new Error('Conexão fechada sem resposta'));
      };
    } catch (error) {
      reject(error);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes
  app.use("/api", (req, res, next) => {
    console.log(`API Request: ${req.method} ${req.path}`);
    next();
  });
  
  // Rota específica para acesso ao Robô de Operações
  app.get('/api/robo-access', (req, res) => {
    res.json({ 
      status: 'ok', 
      message: 'Acesso autorizado ao Robô de Operações',
      url: '/robo-operacoes',
      ports: {
        current: process.env.PORT || '5000',
        frontend: '3000',
        websocket: '5000'
      }
    });
  });
  
  // Proxy WebSocket para a API da Deriv
  app.post("/api/deriv-ws", async (req: Request, res: Response) => {
    try {
      // Esta rota aceita solicitações WebSocket da Deriv em formato JSON e responde de volta
      const request = req.body;
      console.log('Proxy Deriv API request:', JSON.stringify(request));
      
      // Se o método de autorização for usado, verificar token da variável de ambiente
      if (request.authorize && !request.authorize.length) {
        const envToken = process.env.DERIV_API_TOKEN;
        if (envToken) {
          request.authorize = envToken;
        }
      }
      
      // Tente fazer a solicitação à API da Deriv usando a biblioteca de WebSocket do lado do servidor
      try {
        const derivResponse = await makeDerivRequest(request);
        console.log('Proxy Deriv API response:', JSON.stringify(derivResponse));
        return res.status(200).json(derivResponse);
      } catch (wsError) {
        console.error('WebSocket request error:', wsError);
        return res.status(502).json({ 
          error: { 
            code: 'WebSocketRequestFailed', 
            message: 'Falha ao comunicar com a API da Deriv' 
          }
        });
      }
    } catch (error) {
      console.error("Proxy API error:", error);
      return res.status(500).json({ 
        error: { 
          code: 'InternalServerError', 
          message: 'Erro no servidor ao processar solicitação'
        }
      });
    }
  });

  // Criar servidor HTTP
  const httpServer = createServer(app);
  
  // Configurar WebSocket Server com caminho específico para não conflitar com HMR do Vite
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (clientWs) => {
    console.log('Nova conexão WebSocket estabelecida');
    
    // Variável para armazenar a conexão com a Deriv API
    let derivWs: WebSocket | null = null;
    
    // Função para estabelecer conexão com o WebSocket da Deriv
    const connectToDerivAPI = () => {
      console.log('Conectando ao WebSocket da Deriv API...');
      
      // Fechar conexão anterior se existir
      if (derivWs) {
        derivWs.close();
        derivWs = null;
      }
      
      // Criar nova conexão com o endpoint recomendado
      // De acordo com a documentação oficial da Deriv, o endpoint correto é ws.derivws.com
      // Usando app_id 71403 que é o ID da aplicação
      derivWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=71403');
      
      derivWs.on('open', () => {
        console.log('Conexão com a Deriv API estabelecida com sucesso');
        
        // Informar ao cliente que a conexão foi estabelecida
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ 
            msg_type: 'connection_status', 
            status: 'connected',
            message: 'Conexão com a API da Deriv estabelecida com sucesso' 
          }));
        }
      });
      
      // Encaminhar mensagens da Deriv para o cliente
      derivWs.on('message', (message) => {
        try {
          const data = message.toString();
          
          // Log mais detalhado (apenas se não for muito grande)
          if (data.length < 1000) {
            console.log('Resposta da Deriv:', data);
          } else {
            console.log('Resposta da Deriv: [Dados volumosos]');
          }
          
          // Encaminhar para o cliente
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(data);
          }
        } catch (error) {
          console.error('Erro ao processar mensagem da Deriv:', error);
        }
      });
      
      // Lidar com erros
      derivWs.on('error', (error) => {
        console.error('Erro no WebSocket da Deriv:', error);
        
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ 
            msg_type: 'error', 
            error: {
              message: 'Erro na conexão com a API da Deriv',
              details: error.message || 'Detalhes do erro não disponíveis'
            }
          }));
        }
      });
      
      // Lidar com fechamento de conexão
      derivWs.on('close', (code, reason) => {
        console.log(`WebSocket da Deriv fechado (código: ${code}, razão: ${reason || 'Não especificada'})`);
        
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ 
            msg_type: 'connection_status', 
            status: 'disconnected',
            message: 'Conexão com a API da Deriv encerrada' 
          }));
        }
      });
    };
    
    // Estabelecer conexão inicial
    connectToDerivAPI();
    
    // Encaminhar mensagens do cliente para a Deriv
    clientWs.on('message', (message) => {
      try {
        const messageStr = message.toString();
        
        // Log mais detalhado (apenas se não for muito grande)
        if (messageStr.length < 1000) {
          console.log('Requisição para Deriv:', messageStr);
        } else {
          console.log('Requisição para Deriv: [Dados volumosos]');
        }
        
        // Verificar se a conexão está pronta
        if (derivWs && derivWs.readyState === WebSocket.OPEN) {
          derivWs.send(messageStr);
        } else {
          console.log('Conexão com Deriv não está pronta, reconectando...');
          
          // Tentar reconectar e encaminhar a mensagem após a conexão
          connectToDerivAPI();
          
          // Armazenar mensagem para enviar após conectar
          const timer = setTimeout(() => {
            if (derivWs && derivWs.readyState === WebSocket.OPEN) {
              derivWs.send(messageStr);
              console.log('Mensagem enviada após reconexão');
            } else {
              console.error('Falha ao enviar mensagem após reconexão');
              
              if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.send(JSON.stringify({
                  msg_type: 'error',
                  error: {
                    message: 'Não foi possível enviar a mensagem para a API da Deriv',
                    code: 'CONNECTION_ERROR'
                  }
                }));
              }
            }
            clearTimeout(timer);
          }, 1000);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem do cliente:', error);
      }
    });
    
    // Fechar a conexão com a Deriv quando o cliente se desconectar
    clientWs.on('close', () => {
      console.log('Cliente desconectado');
      if (derivWs) {
        derivWs.close();
        derivWs = null;
      }
    });
    
    // Lidar com erros do cliente
    clientWs.on('error', (error) => {
      console.error('Erro no WebSocket do cliente:', error);
      if (derivWs) {
        derivWs.close();
        derivWs = null;
      }
    });
  });

  // Rota para status da API 
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'online',
      version: '1.0.0',
      serverTime: new Date().toISOString()
    });
  });

  // Registrar rotas para estratégias
  registerStrategyRoutes(app);

  return httpServer;
}