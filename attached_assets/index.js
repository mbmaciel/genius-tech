#!/usr/bin/env node

/**
 * Servidor principal para a plataforma Genius Technology Trading
 * Suporta conexão com a API da Deriv via WebSocket
 */

const express = require('express');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const http = require('http');
const rsiDataManager = require('./rsiData');

// Iniciar serviço de dados RSI
console.log('Iniciando serviço de dados RSI...');
rsiDataManager.start();

// Criar aplicação Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middleware
app.use(express.json());
// Configurar a entrega de arquivos estáticos
app.use(express.static(path.join(__dirname, '../client/public')));

// Criar servidor HTTP
const server = http.createServer(app);

// Rota da API para dados do R_100
app.get('/api/v1/r100-data', (req, res) => {
  console.log('Endpoint /api/v1/r100-data acessado');
  res.json(rsiDataManager.getData());
});

// Configurar WebSocket para comunicação com a API Deriv
const wss = new WebSocketServer({
  server,
  path: '/ws'
});

// Configurar WebSocket específico para dígitos em tempo real
const wssDigits = new WebSocketServer({
  server,
  path: '/ws-digits'
});

// Armazenar conexões de clientes para dígitos em tempo real
const digitClients = new Set();

// Manipulador de conexões para WebSocket de dígitos
wssDigits.on('connection', (ws) => {
  console.log('Nova conexão WebSocket para dígitos em tempo real estabelecida');
  
  // Adicionar cliente à lista
  digitClients.add(ws);
  
  // Enviar os últimos 100 dígitos imediatamente
  const lastDigits = rsiDataManager.getData().lastDigits;
  if (lastDigits && lastDigits.length > 0) {
    ws.send(JSON.stringify({
      type: 'digits_history',
      digits: lastDigits
    }));
  }
  
  // Evento: Cliente desconectado
  ws.on('close', () => {
    console.log('Cliente WebSocket de dígitos desconectado');
    digitClients.delete(ws);
  });
  
  // Evento: Erro no WebSocket do cliente
  ws.on('error', (error) => {
    console.error('Erro no WebSocket de dígitos do cliente:', error);
    digitClients.delete(ws);
  });
});

// Função para transmitir um novo dígito para todos os clientes conectados
global.broadcastNewDigit = (digit) => {
  console.log(`Transmitindo novo dígito ${digit} para ${digitClients.size} clientes conectados`);
  let clientsAtivos = 0;
  
  digitClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'new_digit',
        digit: digit
      }));
      clientsAtivos++;
    }
  });
  
  console.log(`Dígito ${digit} enviado para ${clientsAtivos} clientes ativos`);
};

// Evento: Nova conexão WebSocket
wss.on('connection', (ws) => {
  console.log('Nova conexão WebSocket estabelecida');
  
  // Configurar endpoint WebSocket para a Deriv com novo App ID
  const derivWs = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=71555');
  
  // Configurar handlers para o WebSocket da Deriv
  derivWs.onopen = () => {
    console.log('Conexão com a API da Deriv estabelecida');
    
    // Enviar evento de conexão bem-sucedida para o cliente
    if (ws.readyState === ws.OPEN) {
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
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        msg_type: 'connection_status',
        status: 'error',
        message: 'Erro na conexão com a API da Deriv'
      }));
    }
  };
  
  derivWs.onmessage = (message) => {
    // Encaminhar mensagem da Deriv para o cliente
    if (ws.readyState === ws.OPEN) {
      ws.send(message.data);
    }
  };
  
  derivWs.onclose = (event) => {
    console.log(`Conexão com a Deriv fechada: ${event.code} - ${event.reason}`);
    
    // Notificar cliente sobre o fechamento da conexão
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        msg_type: 'connection_status',
        status: 'disconnected',
        message: 'Conexão com a API da Deriv encerrada'
      }));
    }
  };
  
  // Encaminhar mensagens do cliente para a Deriv
  ws.on('message', (message) => {
    if (derivWs.readyState === derivWs.OPEN) {
      derivWs.send(message);
    } else {
      console.log('Conexão com Deriv não está pronta');
    }
  });
  
  // Evento: Cliente desconectado
  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
    
    // Fechar conexão com a Deriv
    if (derivWs.readyState === derivWs.OPEN) {
      derivWs.close();
    }
  });
  
  // Evento: Erro no WebSocket do cliente
  ws.on('error', (error) => {
    console.error('Erro no WebSocket do cliente:', error);
  });
});

// Rotas específicas para as páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/login.html'));
});

app.get('/dashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/dashboard.html'));
});

app.get('/oauth-redirect.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/oauth-redirect.html'));
});

// Adicionar rota específica para o Robô de Operações
app.get('/robo-operacoes', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robo-operacoes.html'));
});

app.get('/robo-operacoes.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robo-operacoes.html'));
});

app.get('/robo', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robo-acesso.html'));
});

app.get('/robo.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robo-acesso.html'));
});

app.get('/robo-acesso', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robo-acesso.html'));
});

app.get('/robo-acesso.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/robo-acesso.html'));
});

// Rota de fallback para outras páginas
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/public/login.html'));
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});