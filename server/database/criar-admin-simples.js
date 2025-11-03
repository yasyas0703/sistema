const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'sistema.db');
const db = new sqlite3.Database(dbPath);

const usuario = 'Admin';
const senhaSimples = 'admin123';

async function run() {
  try {
    const hash = await bcrypt.hash(senhaSimples, 10);
    db.run("UPDATE usuarios SET senha = ? WHERE nome = ?", [hash, usuario], function(err) {
      if (err) {
        console.error('❌ Erro ao atualizar senha:', err);
      } else {
        console.log(`✅ Senha do usuário "${usuario}" atualizada com hash. Linhas afetadas: ${this.changes}`);
      }
      db.close();
    });
  } catch (e) {
    console.error(e);
    db.close();
  }
}

run();
