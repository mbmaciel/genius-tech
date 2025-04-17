/**
 * Servidor estático simples para demonstração da Genius Tecnologic
 */

const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middleware para servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'client/public')));

// Configurar middleware para parsing JSON
app.use(express.json());

// Criar servidor HTTP
const server = http.createServer(app);

// Configurar WebSocket para comunicação com a API Deriv
const wss = new WebSocket.Server({
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
  
  derivWs.onerror = (error) => {
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
  
  derivWs.onmessage = (message) => {
    // Encaminhar mensagem da Deriv para o cliente
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message.data);
    }
  };
  
  derivWs.onclose = (event) => {
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
  ws.on('message', (message) => {
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
  ws.on('error', (error) => {
    console.error('Erro no WebSocket do cliente:', error);
  });
});

// Rota para servir o arquivo index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/public/index.html'));
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});