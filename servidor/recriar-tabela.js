const { db, initDatabase } = require('./server/database/db');

async function recriar() {
  try {
    console.log('🔧 Conectando ao banco...');
    await initDatabase();
    
    console.log('🗑️ Apagando tabela antiga...');
    await db.runAsync('DROP TABLE IF EXISTS notificacoes');
    
    console.log('✨ Criando tabela nova...');
    await db.runAsync(`
      CREATE TABLE notificacoes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mensagem TEXT NOT NULL,
          tipo TEXT,
          lida INTEGER DEFAULT 0,
          usuario_id INTEGER,
          criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
      )
    `);
    
    console.log('✅ Tabela notificacoes recriada com sucesso!');
    
    const resultado = await db.runAsync(
      'INSERT INTO notificacoes (mensagem, tipo, lida) VALUES (?, ?, ?)',
      ['Sistema inicializado', 'sucesso', 0]
    );
    
    console.log('✅ Notificação inicial criada com ID:', resultado.id);
    
    const todas = await db.allAsync('SELECT * FROM notificacoes');
    console.table(todas);
    
    console.log('\n✅ RECRIAÇÃO CONCLUÍDA!\n');
    process.exit(0);
    
  } catch (erro) {
    console.error('❌ ERRO:', erro);
    process.exit(1);
  }
}

recriar();