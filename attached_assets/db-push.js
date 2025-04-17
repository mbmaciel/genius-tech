#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Executar npx drizzle-kit push
console.log('Executando migração do banco de dados...');

try {
  // Caminhos
  const drizzleConfigPath = path.resolve(__dirname, '../drizzle.config.ts');
  
  // Comando para fazer push das alterações no banco
  const pushCommand = `npx drizzle-kit push:pg --config=${drizzleConfigPath}`;
  
  // Executar o comando
  console.log(`> ${pushCommand}`);
  execSync(pushCommand, { stdio: 'inherit' });
  
  console.log('Migração concluída com sucesso!');
} catch (error) {
  console.error('Erro ao executar a migração:', error.message);
  process.exit(1);
}