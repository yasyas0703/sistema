const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');

console.log('🔧 Atualizando estrutura do banco...\n');

const criarTabela = `
CREATE TABLE IF NOT EXISTS respostas_questionario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL,
  departamento_id INTEGER NOT NULL,
  pergunta_id TEXT NOT NULL,
  resposta TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
  FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
)`;

db.run(criarTabela, (err) => {
  if (err) {
    console.error('❌ Erro ao criar tabela:', err.message);
    db.close();
    return;
  }
  
  console.log('✅ Tabela respostas_questionario criada/verificada!');
  
  db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, tables) => {
    if (err) {
      console.error('❌ Erro ao listar tabelas:', err);
    } else {
      console.log('\n📋 Tabelas no banco:');
      tables.forEach(t => console.log('   -', t.name));
    }
    
    db.close();
    console.log('\n✅ Atualização concluída!');
  });
});