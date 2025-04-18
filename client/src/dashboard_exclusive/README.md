# Dashboard Exclusive

Este diretório contém componentes e serviços EXCLUSIVOS para o Dashboard.

## IMPORTANTE

Os componentes e serviços aqui contidos são completamente separados do resto da aplicação, 
especialmente do robô de operações.

## Regras de uso:

1. NÃO IMPORTE ou use estes componentes em módulos relacionados ao robô de operações
2. NÃO MODIFIQUE conexões WebSocket existentes do robô
3. Este módulo usa um TOKEN DEDICADO apenas para visualização do R_100 no dashboard

## Arquitetura:

- `dashboardWebSocket.ts` - Serviço de conexão WebSocket isolado para o dashboard
- `R100Display.tsx` - Componente React para visualização do R_100 no dashboard

## Conexão WebSocket:

- URL: `wss://ws.binaryws.com/websockets/v3`
- Token: `jybcQm0FbKr7evp` (dedicado apenas para o dashboard)
- Símbolo: `R_100`

## Notas adicionais:

Este é um sistema completamente independente que NÃO interfere em nenhuma 
conexão WebSocket usada pelo robô de operações que utiliza o sistema OAuth.