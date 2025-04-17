# Genius Technology Trading

Plataforma moderna de trading com integração à API Deriv para operações de opções binárias.

## Visão Geral

Genius Technology Trading (anteriormente OneBot - ROBÔ DE OPERAÇÕES) é uma plataforma que oferece:

- Conexão com a API Deriv para negociações em tempo real
- Autenticação via token API ou fluxo OAuth
- Interface moderna e responsiva
- 6 estratégias pré-configuradas de trading
- Estatísticas de dígitos para o índice R_100
- Suporte a múltiplas contas de trading
- Design otimizado para a melhor experiência do usuário

## Tecnologias Utilizadas

- Frontend: HTML5, CSS3, JavaScript moderno
- Conexão com API: WebSocket para comunicação em tempo real
- Autenticação: Sistema OAuth integrado com a Deriv
- Servidor: Node.js com Express para servir a aplicação e proxy WebSocket

## Requisitos

- Node.js v10.19.0 ou superior
- Conexão à Internet para acessar a API Deriv
- Token de API da Deriv ou credenciais para autenticação OAuth

## Instalação

1. Clone o repositório
2. Execute o script de configuração:
   ```
   ./setup.sh
   ```
3. O servidor será iniciado automaticamente na porta 3000

## Execução Manual

Se preferir iniciar manualmente:

```
node index.js
```

## Estratégias de Trading Disponíveis

- Bot Low: para mercados com tendência de baixa
- Iron Under: para operar abaixo de níveis de suporte
- Iron Over: para operar acima de níveis de resistência
- Max Pro: para maximizar lucros em mercados voláteis
- Green: para captura de tendências positivas
- Profit Pro AT: estratégia de alta frequência

## Autenticação

### Via Token API

1. Obtenha seu token de API na plataforma Deriv (https://app.deriv.com/account/api-token)
2. Clique em "Conectar à Deriv" na interface da aplicação
3. Insira o token API quando solicitado

### Via OAuth

1. Clique em "Conectar à Deriv" na interface da aplicação
2. Escolha a opção de login via Deriv
3. Será aberta uma janela para autorização na Deriv
4. Após autorização bem-sucedida, você será redirecionado de volta para a aplicação

## Suporte

Para suporte ou relatar problemas, entre em contato com a equipe Genius Technology.