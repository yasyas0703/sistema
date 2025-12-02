require('dotenv').config();
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { iniciarVerificacaoPeriodica } = require('./server/utils/notificacoes');

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 3002;
   const { iniciarVerificador } = require('./server/routes/verificadorautomatico');
const cron = require('node-cron');



app.use(cors({
  origin: [
    'http://localhost:3000',     
    'http://127.0.0.1:3000',
    'http://192.168.0.115:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

app.use((req, res, next) => {
  console.log(`🌐 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Servidor funcionando!', 
    timestamp: new Date(),
    ambiente: process.env.NODE_ENV || 'development'
  });
});

const { initDatabase } = require('./server/database/db');

(async () => {
  try {
    console.log('🔧 Inicializando banco de dados...');
    await initDatabase();
    console.log('✅ Banco inicializado');

    console.log('⏰ Iniciando verificador automático...');
    iniciarVerificador();


    console.log('📁 Configurando servidor de arquivos estáticos...');
    

    
const uploadsDir = path.join(__dirname, 'server', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  console.log('📁 Criando diretório de uploads:', uploadsDir);
  fs.mkdirSync(uploadsDir, { recursive: true });
}
iniciarVerificacaoPeriodica();

console.log('✅ Sistema de notificações em segundo plano ativo');
app.use('/uploads', express.static(uploadsDir, {
  index: false,
  dotfiles: 'deny',
  setHeaders: (res, filePath) => {
    console.log('✅ Servindo arquivo:', filePath);
    
    if (path.extname(filePath).toLowerCase() === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + path.basename(filePath) + '"');
    }
  }
}));

console.log('✅ Servidor de arquivos estáticos configurado');
console.log('📂 Diretório de uploads:', uploadsDir);

    //ROTAS DE API
    console.log('📍 Registrando rotas de API...');
    app.use('/api/usuarios', require('./server/routes/usuarios'));
    app.use('/api/processos', require('./server/routes/processos'));
    app.use('/api/departamentos', require('./server/routes/departamentos'));
    app.use('/api/notificacoes', require('./server/routes/notificacoes'));
    app.use('/api/tags', require('./server/routes/tags'));
    app.use('/api/comentarios', require('./server/routes/comentarios'));
    app.use('/api/documentos', require('./server/routes/documentos'));
    app.use('/api/questionarios', require('./server/routes/questionarios'));
    app.use('/api/templates', require('./server/routes/templates'));
    app.use('/api/empresas', require('./server/routes/empresas'));
    app.use('/api', require('./server/routes/consultar-cnpj'));





    app.get('/uploads/:filename', (req, res) => {
      let filename;
      try {
        filename = path.basename(decodeURIComponent(req.params.filename));
      } catch (e) {
        filename = path.basename(req.params.filename);
      }

      const candidates = [
        path.join(__dirname, 'server', 'uploads', filename),
        path.join(__dirname, 'uploads', filename)
      ];

      for (const filePath of candidates) {
        try {
          if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            console.log('✅ Enviando arquivo via rota explícita:', filePath);
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
            return res.sendFile(filePath);
          }
        } catch (err) {
          console.error('❌ Erro verificando arquivo:', filePath, err);
        }
      }

      res.status(404).send(`<!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Arquivo não encontrado</title>
            <style>body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#333}</style>
          </head>
          <body>
            <h1>Arquivo não encontrado</h1>
            <p>O arquivo "${filename}" não foi encontrado no servidor.</p>
            <p><a href="/uploads/">Ver lista de arquivos</a></p>
          </body>
        </html>
      `);
    });
    console.log('✅ Todas as rotas registradas');

app.get('/uploads/:filename', (req, res) => {
  try {
    const filename = path.basename(req.params.filename);
    const filePath = path.join(uploadsDir, filename);
    
    console.log('🔍 Buscando arquivo:', {
      filename: filename,
      filePath: filePath,
      exists: fs.existsSync(filePath)
    });

    if (!fs.existsSync(filePath)) {
      console.log('❌ Arquivo não encontrado:', filePath);
      return res.status(404).json({
        erro: 'Arquivo não encontrado',
        arquivo: filename,
        caminho: filePath
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('❌ Erro ao enviar arquivo:', err);
        res.status(500).json({ erro: 'Erro ao enviar arquivo' });
      } else {
        console.log('✅ Arquivo enviado com sucesso:', filename);
      }
    });

  } catch (error) {
    console.error('❌ Erro na rota de uploads:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});

app.use('/uploads', (req, res, next) => {
  console.log('📁 Requisição de arquivo:', {
    method: req.method,
    originalUrl: req.originalUrl,
    path: req.path,
    query: req.query,
    headers: req.headers
  });
  next();
});

    app.use((err, req, res, next) => {
      console.error('❌ Erro não tratado:', err);
      res.status(500).json({
        erro: 'Erro interno do servidor',
        mensagem: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    });

    app.use((req, res) => {
      console.log(`⚠️ Rota não encontrada: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        erro: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method,
        rotasDisponiveis: [
          'GET /api/test',
          'GET /api/usuarios',
          'GET /api/processos',
          'GET /api/departamentos',
          'GET /api/notificacoes',
          'GET /api/tags',
          'GET /api/comentarios',
          'GET /api/documentos',
          'GET /api/questionarios',
          'GET /api/templates',
          'GET /api/verificadorautomatico',
           'GET /api/consultar-cnpj',
          'GET /uploads/:filename'
        ]
      });
    });

app.get('/api/debug-documentos', async (req, res) => {
  try {
    const { db } = require('./server/database/db');
    const path = require('path');
    const fs = require('fs');
    
    const documentos = await db.allAsync(
      'SELECT id, nome, url, processo_id, pergunta_id, departamento_id, criado_em FROM documentos ORDER BY id DESC LIMIT 20'
    );
    
    const uploadsDir = path.join(__dirname, 'server', 'uploads');
    const arquivosFisicos = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    
    res.json({
      documentos_no_banco: documentos.map(d => ({
        id: d.id,
        nome: d.nome,
        url: d.url,
        nome_arquivo: d.nome_arquivo
      })),
      arquivos_fisicos: arquivosFisicos,
      pasta_uploads: uploadsDir
    });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});




    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log(`🚀 Servidor HTTP rodando`);
      console.log(`   URL: http://localhost:${PORT}`);
      console.log(`   Rede: http://192.168.0.115:${PORT}`);
      console.log(`   Teste: http://localhost:${PORT}/api/test`);
      console.log(`   Uploads: http://localhost:${PORT}/uploads/`);
      console.log('═══════════════════════════════════════');
      console.log('');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Porta ${PORT} já está em uso!`);
        console.log('💡 Tente:');
        console.log('   1. Fechar o processo que está usando a porta');
        console.log('   2. Ou mudar a porta no arquivo .env');
      } else {
        console.error('❌ Erro no servidor HTTP:', err);
      }
      process.exit(1);
    });


    const jwt = require('jsonwebtoken');
    const SECRET_KEY = process.env.JWT_SECRET || 'seu-secret-super-seguro-12345';

    const verificarToken = (req, res, next) => {
      console.log('🔐 Verificando token...');
      const authHeader = req.headers['authorization'];
      const token = authHeader?.split(' ')[1];

      if (!token) {
        console.log('❌ Token não fornecido');
        return res.status(401).json({ 
          sucesso: false,
          erro: 'Token não fornecido' 
        });
      }

      try {
        const decoded = jwt.verify(token, SECRET_KEY);
        console.log('✅ Token válido:', decoded);
        req.usuario = decoded;
        next();
      } catch (err) {
        console.error('❌ Token inválido:', err.message);
        return res.status(401).json({ 
          sucesso: false,
          erro: 'Token inválido ou expirado',
          detalhes: err.message 
        });
      }
    };

    const gerarToken = (usuario) => {
      console.log('🎫 Gerando token para:', usuario.nome);
      return jwt.sign(
        { 
          id: usuario.id, 
          nome: usuario.nome, 
          role: usuario.role 
        },
        SECRET_KEY,
        { expiresIn: '24h' }
      );
    };

    module.exports = { verificarToken, gerarToken };

    const wss = new WebSocket.Server({ port: WS_PORT });
    global.wss = wss;

    wss.on('connection', (ws) => {
      console.log('🔌 Novo cliente WebSocket conectado');
      
      ws.on('message', (message) => {
        console.log('📨 Mensagem recebida:', message.toString());
      });
      
      ws.on('close', () => {
        console.log('🔌 Cliente WebSocket desconectado');
      });
      
      ws.on('error', (err) => {
        console.error('❌ Erro no WebSocket:', err);
      });
    });

    console.log(`🔌 WebSocket rodando em ws://localhost:${WS_PORT}`);

    wss.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Porta WebSocket ${WS_PORT} já está em uso!`);
      } else {
        console.error('❌ Erro no servidor WebSocket:', err);
      }
    });

  } catch (err) {
    console.error('');
    console.error('═══════════════════════════════════════');
    console.error('❌ ERRO NA INICIALIZAÇÃO');
    console.error('═══════════════════════════════════════');
    console.error(err);
    console.error('');
    process.exit(1);
  }
})();



process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('📴 Recebido SIGTERM. Encerrando servidor...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📴 Recebido SIGINT. Encerrando servidor...');
  process.exit(0);
});