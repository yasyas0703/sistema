const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'sistema.db');
const db = new sqlite3.Database(dbPath);

db.all('SELECT id, nome, role, ativo FROM usuarios', (err, rows) => {
  if (err) {
    console.error('❌ Erro ao consultar usuários:', err);
  } else if (rows.length === 0) {
    console.log('⚠️ Nenhum usuário encontrado.');
  } else {
    console.log('👤 Usuários cadastrados:');
    console.table(rows);
  }
  db.close();
});
