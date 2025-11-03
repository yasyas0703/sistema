const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs'); 
const dbPath = path.join(__dirname, 'sistema.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error("❌ Erro ao abrir o banco:", err);
    else console.log("✅ Conexão com o banco estabelecida:", dbPath);
});

async function initDatabase() {
    try {
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        await new Promise((resolve, reject) => {
            db.exec(schema, (err) => {
                if (err) {
                    console.error('❌ Erro ao criar tabelas:', err);
                    return reject(err);
                }
                console.log('✅ Banco de dados inicializado com sucesso!');
                resolve();
            });
        });

        await db.runAsync(`
          CREATE TABLE IF NOT EXISTS notificacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mensagem TEXT NOT NULL,
            tipo TEXT DEFAULT 'info',
            usuario_id INTEGER,
            lida INTEGER DEFAULT 0,
            dados TEXT, -- coluna para JSON/text extra
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
          )
        `).catch(err => {
          console.error('⚠️ Erro ao criar ou garantir tabela notificacoes:', err.message || err);
        });

        await db.runAsync(`ALTER TABLE notificacoes ADD COLUMN dados TEXT`).catch(() => {
          console.log('⚠️ Coluna dados já existe em notificacoes (ou não foi necessária).');
        });

        await db.runAsync(`ALTER TABLE processos ADD COLUMN data_ultima_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP`).catch(() => {
          console.log('⚠️ Coluna data_ultima_movimentacao já existe em processos (ou não foi necessária).');
        });

        const columns = await new Promise((resolve, reject) => {
            db.all("PRAGMA table_info(processos)", (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        const nomes = columns.map(c => c.name);

        const adicionarColuna = (nome, tipo) => {
            return new Promise((resolve) => {
                if (!nomes.includes(nome)) {
                    db.run(`ALTER TABLE processos ADD COLUMN ${nome} ${tipo};`, (err) => {
                        if (err) console.error(`❌ Erro ao adicionar ${nome}:`, err.message);
                        else console.log(`✅ Coluna ${nome} adicionada!`);
                        resolve();
                    });
                } else {
                    console.log(`ℹ️ Coluna ${nome} já existe.`);
                    resolve();
                }
            });
        };

        await adicionarColuna("questionario_solicitacao", "TEXT DEFAULT '[]'");
        await adicionarColuna("respostas_historico", "TEXT DEFAULT '{}'");
        await adicionarColuna("nome_servico", "TEXT");
        await adicionarColuna("questionarios_por_departamento", "TEXT DEFAULT '{}'");

        console.log("✅ Verificação de colunas finalizada com sucesso!");

        await createIndexes();

        await createInitialData();

    } catch (err) {
        console.error("❌ ERRO NA INICIALIZAÇÃO DO BANCO:", err);
        throw err;
    }
}

db.runAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

db.getAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

db.allAsync = function (sql, params = []) {
    return new Promise((resolve, reject) => {
        this.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

async function createIndexes() {
  return new Promise((resolve) => {
    const indexes = `
      CREATE INDEX IF NOT EXISTS idx_processo_dept 
        ON questionarios_preenchidos(processo_id, departamento_id);
      
      CREATE INDEX IF NOT EXISTS idx_processo_status 
        ON processos(status);
      
      CREATE INDEX IF NOT EXISTS idx_documentos_processo 
        ON documentos(processo_id);
    `;

    db.exec(indexes, (err) => {
      if (err) {
        console.error('⚠️ Erro ao criar índices:', err);
      } else {
        console.log('✅ Índices criados');
      }
      resolve();
    });
  });
}

async function aguardarTabelas() {
  return new Promise((resolve) => {
    const verificar = () => {
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='processos'", (err, row) => {
        if (row) {
          console.log('✅ Tabelas verificadas');
          resolve();
        } else {
          console.log('⏳ Aguardando criação das tabelas...');
          setTimeout(verificar, 1000);
        }
      });
    };
    verificar();
  });
}

async function createInitialData() {
  return new Promise(async (resolve, reject) => {
    try {
      db.get('SELECT id FROM usuarios WHERE nome = ?', ['Admin'], async (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          const senhaHash = await bcrypt.hash('admin123', 10);
          const permissoes = JSON.stringify([
            "criar_processo",
            "editar_processo",
            "excluir_processo",
            "criar_departamento",
            "editar_departamento",
            "excluir_departamento",
            "criar_tag",
            "editar_tag",
            "excluir_tag",
            "gerenciar_usuarios"
          ]);

          db.run(
            'INSERT INTO usuarios (nome, senha, role, permissoes) VALUES (?, ?, ?, ?)',
            ['Admin', senhaHash, 'admin', permissoes],
            (err) => {
              if (err) {
                console.error('❌ Erro ao criar admin:', err);
              } else {
                console.log('✅ Usuário admin criado');
              }
            }
          );
        }

        resolve();  
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { db, initDatabase, aguardarTabelas, createIndexes, createInitialData };
