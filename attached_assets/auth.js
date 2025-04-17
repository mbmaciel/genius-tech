const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

// Configurar conexão com o banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Middleware de autenticação
function setupAuth(app) {
  // Configurar sessão
  app.use(session({
    store: new pgSession({
      pool,
      tableName: 'session' // Nome da tabela de sessões no PostgreSQL
    }),
    secret: process.env.SESSION_SECRET || 'genius-technology-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { 
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
      secure: process.env.NODE_ENV === 'production'
    }
  }));

  // Middleware para verificar autenticação
  const checkAuth = (req, res, next) => {
    if (req.session.userId) {
      next();
    } else {
      res.status(401).json({ error: 'Não autenticado' });
    }
  };

  // Rota de login
  app.post('/api/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      // Validação de entrada
      if (!username || !password) {
        return res.status(400).json({ error: 'Nome de usuário e senha são obrigatórios' });
      }

      // Buscar usuário no banco de dados
      const result = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      const user = result.rows[0];
      
      // Verificar se o usuário existe
      if (!user) {
        return res.status(401).json({ error: 'Nome de usuário ou senha incorretos' });
      }

      // Verificar se a senha está correta
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ error: 'Nome de usuário ou senha incorretos' });
      }

      // Atualizar último login
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );

      // Criar sessão
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.isAdmin = user.is_admin;

      // Remover a senha do objeto usuário antes de enviar
      delete user.password;

      res.status(200).json({ user });
    } catch (error) {
      console.error('Erro no login:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota de registro
  app.post('/api/register', async (req, res) => {
    try {
      const { username, email, password, fullname, phone } = req.body;

      // Validação de entrada
      if (!username || !email || !password || !fullname || !phone) {
        return res.status(400).json({ 
          error: 'Todos os campos são obrigatórios' 
        });
      }

      // Verificar se o nome de usuário já existe
      const usernameCheck = await pool.query(
        'SELECT * FROM users WHERE username = $1',
        [username]
      );

      if (usernameCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Nome de usuário já existe', 
          field: 'username' 
        });
      }

      // Verificar se o email já existe
      const emailCheck = await pool.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      if (emailCheck.rows.length > 0) {
        return res.status(400).json({ 
          error: 'Email já cadastrado', 
          field: 'email' 
        });
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, 10);

      // Verificar se a tabela users tem a coluna phone
      // Se não tiver, vamos adicioná-la antes
      try {
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN IF NOT EXISTS phone VARCHAR(20)
        `);
      } catch (err) {
        console.log('Coluna phone já existe ou erro ao adicionar:', err);
      }

      // Inserir novo usuário
      const result = await pool.query(
        'INSERT INTO users (username, email, password, full_name, phone, is_active, created_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP) RETURNING id, username, email, full_name, phone, created_at',
        [username, email, hashedPassword, fullname, phone, true]
      );

      const newUser = result.rows[0];

      res.status(201).json({ user: newUser });
    } catch (error) {
      console.error('Erro no registro:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  // Rota de logout
  app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error('Erro ao encerrar sessão:', err);
        return res.status(500).json({ error: 'Erro ao fazer logout' });
      }
      res.status(200).json({ message: 'Logout realizado com sucesso' });
    });
  });

  // Rota para verificar autenticação
  app.get('/api/check-auth', checkAuth, (req, res) => {
    res.status(200).json({ authenticated: true, userId: req.session.userId, username: req.session.username });
  });

  // Rota para obter informações do usuário atual
  app.get('/api/user', checkAuth, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, username, email, full_name, created_at, is_active, deriv_token FROM users WHERE id = $1',
        [req.session.userId]
      );

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }

      res.status(200).json({ user });
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });

  return { checkAuth };
}

module.exports = { setupAuth };