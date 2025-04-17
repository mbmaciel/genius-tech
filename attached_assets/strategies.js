/**
 * Módulo de gerenciamento de estratégias XML para o Robô de Operações
 * Fornece endpoints para listar e carregar estratégias XML disponíveis
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Diretório onde as estratégias XML estão armazenadas
const STRATEGIES_DIR = path.join(__dirname, '../client/public/assets/strategies');

/**
 * Registra as rotas de API para gerenciamento de estratégias
 * @param {express.Router} app - Router Express para registrar as rotas
 */
function registerStrategyRoutes(app) {
  // Listar todas as estratégias disponíveis
  app.get('/api/strategies', async (req, res) => {
    try {
      const strategies = await listStrategies();
      res.json(strategies);
    } catch (error) {
      console.error('Erro ao listar estratégias:', error);
      res.status(500).json({ error: 'Erro ao listar estratégias' });
    }
  });

  // Obter uma estratégia específica pelo ID
  app.get('/api/strategies/:id', async (req, res) => {
    try {
      const strategies = await listStrategies();
      const strategy = strategies.find(s => s.id === req.params.id);
      
      if (!strategy) {
        return res.status(404).json({ error: 'Estratégia não encontrada' });
      }
      
      // Carregar o conteúdo XML completo
      const xmlContent = await fs.promises.readFile(
        path.join(STRATEGIES_DIR, strategy.fileName),
        'utf8'
      );
      
      // Incluir o conteúdo XML na resposta
      res.json({
        ...strategy,
        xml: xmlContent
      });
    } catch (error) {
      console.error('Erro ao obter estratégia:', error);
      res.status(500).json({ error: 'Erro ao obter estratégia' });
    }
  });
}

/**
 * Lista todas as estratégias disponíveis no diretório de estratégias
 * @returns {Promise<Array>} Lista de estratégias com informações básicas
 */
async function listStrategies() {
  try {
    // Verificar se o diretório existe
    if (!fs.existsSync(STRATEGIES_DIR)) {
      console.warn(`Diretório de estratégias não encontrado: ${STRATEGIES_DIR}`);
      return [];
    }
    
    // Ler todos os arquivos do diretório
    const files = await fs.promises.readdir(STRATEGIES_DIR);
    const xmlFiles = files.filter(file => file.endsWith('.xml'));
    
    // Processar cada arquivo XML
    const strategies = xmlFiles.map((fileName, index) => {
      // Gerar um ID baseado no nome do arquivo
      const id = fileName.replace(/\s+/g, '-').replace('.xml', '').toLowerCase();
      
      // Extrair o nome da estratégia do nome do arquivo
      const name = fileName.replace('.xml', '');
      
      // Determinar o tipo baseado no nome (simplificado)
      const type = determineStrategyType(fileName);
      
      return {
        id,
        name,
        fileName,
        description: `Estratégia ${name} para o índice R_100`,
        type
      };
    });
    
    return strategies;
  } catch (error) {
    console.error('Erro ao listar estratégias:', error);
    throw error;
  }
}

/**
 * Determina o tipo de estratégia com base no nome do arquivo
 * @param {string} fileName - Nome do arquivo da estratégia
 * @returns {string} Tipo da estratégia (over, under, etc)
 */
function determineStrategyType(fileName) {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('over')) return 'over';
  if (lowerName.includes('under')) return 'under';
  if (lowerName.includes('odd')) return 'odd';
  if (lowerName.includes('even')) return 'even';
  if (lowerName.includes('match')) return 'match';
  if (lowerName.includes('differ')) return 'differ';
  
  // Se não conseguir determinar pelo nome, atribui tipo "over" por padrão
  return 'over';
}

module.exports = {
  registerStrategyRoutes,
  listStrategies
};