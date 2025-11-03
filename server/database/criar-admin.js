const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'sistema.db');
const schemaPath = path.join(__dirname, 'schema.sql');
const db = new sqlite3.Database(dbPath);

async function initDatabase() {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  return new Promise((resolve, reject) => {
    db.exec(schema, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function criarAdmin() {
  try {
    await initDatabase();

    const senhaHash = await bcrypt.hash('admin123', 10);

    db.run(
      `
      INSERT INTO usuarios (nome, senha, role, permissoes, ativo)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        'Admin',
        senhaHash,
        'admin',
        JSON.stringify([
          'criar_processo',
          'editar_processo',
          'excluir_processo',
          'criar_departamento',
          'editar_departamento',
          'excluir_departamento',
          'criar_tag',
          'editar_tag',
          'excluir_tag',
          'gerenciar_usuarios'
        ]),
        1
      ],
      (err) => {
        if (err) {
          console.error('❌ Erro ao criar admin:', err);
        } else {
          console.log('✅ Admin criado com sucesso!');
        }
      }
    );
  } catch (e) {
    console.error('❌ Erro geral:', e);
  }
}

criarAdmin();
