import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middleware
app.use(express.json());

// Criar servidor HTTP
const server = createServer(app);

// Configurar WebSocket para comunicação com a API Deriv
const wss = new WebSocketServer({
  server,
  path: '/ws'
});

// Evento: Nova conexão WebSocket
wss.on('connection', (ws) => {
  console.log('Nova conexão WebSocket estabelecida');
  
  // Configurar endpoint WebSocket para a Deriv
  const derivWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=71403');
  
  // Configurar handlers para o WebSocket da Deriv
  derivWs.onopen = () => {
    console.log('Conexão com a API da Deriv estabelecida');
    
    // Enviar evento de conexão bem-sucedida para o cliente
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        msg_type: 'connection_status',
        status: 'connected',
        message: 'Conexão com a API da Deriv estabelecida'
      }));
    }
  };
  
  derivWs.onerror = (error: any) => {
    console.error('Erro na conexão com a Deriv:', error);
    
    // Enviar mensagem de erro para o cliente
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        msg_type: 'connection_status',
        status: 'error',
        message: 'Erro na conexão com a API da Deriv'
      }));
    }
  };
  
  derivWs.onmessage = (message: any) => {
    // Encaminhar mensagem da Deriv para o cliente
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message.data);
    }
  };
  
  derivWs.onclose = (event: any) => {
    console.log(`Conexão com a Deriv fechada: ${event.code} - ${event.reason}`);
    
    // Notificar cliente sobre o fechamento da conexão
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        msg_type: 'connection_status',
        status: 'disconnected',
        message: 'Conexão com a API da Deriv encerrada'
      }));
    }
  };
  
  // Encaminhar mensagens do cliente para a Deriv
  ws.on('message', (message: any) => {
    if (derivWs.readyState === WebSocket.OPEN) {
      derivWs.send(message);
    } else {
      console.log('Conexão com Deriv não está pronta');
    }
  });
  
  // Evento: Cliente desconectado
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
    
    // Fechar conexão com a Deriv
    if (derivWs.readyState === WebSocket.OPEN) {
      derivWs.close();
    }
  });
  
  // Evento: Erro no WebSocket do cliente
  ws.on('error', (error: any) => {
    console.error('Erro no WebSocket do cliente:', error);
  });
});

// Rota API básica para verificar status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    message: 'Genius Technology API está funcionando',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});