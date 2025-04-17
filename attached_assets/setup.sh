#!/bin/bash

# Script de configuração para Genius Technology Trading

echo "=== Configurando Genius Technology Trading ==="

# Atualizar o comando dev em package.json
echo "Configurando script 'dev' para iniciar o servidor..."

# Instalar dependências
echo "Instalando dependências..."
npm install express ws

# Garantir que a pasta client/public existe
echo "Verificando estrutura de arquivos..."
mkdir -p client/public

# Verificar se o arquivo principal existe
if [ ! -f "index.js" ]; then
  echo "ERRO: Arquivo index.js não encontrado!"
  exit 1
fi

# Iniciar o servidor
echo "Iniciando o servidor Genius Technology Trading..."
node index.js