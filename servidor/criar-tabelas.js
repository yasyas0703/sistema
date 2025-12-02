const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

console.log('🚨 CRIANDO TABELAS URGENTE...');

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('❌ Erro ao conectar:', err.message);
    return;
  }
  console.log('✅ Conectado ao banco');
});

const executarSQL = (sql) => {
  return new Promise((resolve, reject) => {
    db.run(sql, function(err) {
      if (err) {
        console.error('❌ Erro:', err.message);
        resolve(); // Continua mesmo com erro
      } else {
        console.log('✅ Sucesso');
        resolve();
      }
    });
  });
};

const criarTabelas = async () => {
  try {
    console.log('\n🗄️ CRIANDO TABELA usuarios...');
    await executarSQL(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE,
        senha TEXT NOT NULL,
        role TEXT DEFAULT 'normal',
        ativo INTEGER DEFAULT 1,
        permissoes TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('\n👤 CRIANDO USUÁRIO ADMIN...');
    await executarSQL(`
      INSERT OR IGNORE INTO usuarios (id, nome, senha, role, permissoes) 
      VALUES (
        1, 
        'Admin', 
        '$2b$10$Xq0EeCjP7R3jN5eQX0fT6e5fJYy8n6kY.5npuPjcW6Q5e7w1lq9Ii',
        'admin',
        '["criar_processo","editar_processo","excluir_processo","criar_departamento","editar_departamento","excluir_departamento","criar_tag","editar_tag","excluir_tag","gerenciar_usuarios"]'
      )
    `);

    console.log('\n🗄️ CRIANDO OUTRAS TABELAS...');
    
    await executarSQL(`
      CREATE TABLE IF NOT EXISTS departamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        responsavel TEXT,
        cor TEXT,
        cor_solida TEXT,
        icone TEXT,
        descricao TEXT,
        questionario TEXT DEFAULT '[]',
        documentos_obrigatorios TEXT DEFAULT '[]',
        ordem INTEGER DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await executarSQL(`
      CREATE TABLE IF NOT EXISTS processos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome_empresa TEXT NOT NULL,
        cliente TEXT,
        email TEXT,
        telefone TEXT,
        tipo_empresa TEXT DEFAULT 'LTDA',
        departamento_atual INTEGER,
        status TEXT DEFAULT 'Em Andamento',
        prioridade TEXT DEFAULT 'MEDIA',
        data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
        prazo_estimado DATETIME,
        data_finalizacao DATETIME,
        progresso INTEGER DEFAULT 0,
        respostas TEXT DEFAULT '{}',
        historico TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        observacoes TEXT,
        criado_por INTEGER,
        FOREIGN KEY (criado_por) REFERENCES usuarios(id)
      )
    `);

    await executarSQL(`
      CREATE TABLE IF NOT EXISTS notificacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mensagem TEXT NOT NULL,
        tipo TEXT,
        lida INTEGER DEFAULT 0,
        usuario_id INTEGER,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);

    await executarSQL(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        cor TEXT,
        texto TEXT,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('\n🏷️ INSERINDO TAGS PADRÃO...');
    const tags = [
      `INSERT OR IGNORE INTO tags (id, nome, cor, texto) VALUES (1, 'Urgente', 'bg-red-500', 'text-white')`,
      `INSERT OR IGNORE INTO tags (id, nome, cor, texto) VALUES (2, 'Aguardando Cliente', 'bg-yellow-500', 'text-white')`,
      `INSERT OR IGNORE INTO tags (id, nome, cor, texto) VALUES (3, 'Revisão', 'bg-purple-500', 'text-white')`,
      `INSERT OR IGNORE INTO tags (id, nome, cor, texto) VALUES (4, 'Documentação Pendente', 'bg-orange-500', 'text-white')`
    ];

    for (const tag of tags) {
      await executarSQL(tag);
    }

    console.log('\n🎉 TODAS AS TABELAS CRIADAS!');
    console.log('👤 Usuário: Admin');
    console.log('🔑 Senha: admin123');

  } catch (error) {
    console.error('❌ Erro geral:', error);
  } finally {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
      if (err) {
        console.error('❌ Erro ao verificar tabelas:', err);
      } else {
        console.log('\n📊 TABELAS EXISTENTES NO BANCO:');
        tables.forEach(table => console.log(`✅ ${table.name}`));
      }
      
      db.close(() => {
        console.log('🔒 Conexão fechada.');
        console.log('\n🚀 AGORA EXECUTE: node server.js');
      });
    });
  }
};


criarTabelas();