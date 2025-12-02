const { db } = require('./db');

async function resetDatabase() {
  try {
    console.log('🗑️ Limpando banco de dados...');
    
    await db.runAsync('DROP TABLE IF EXISTS processos');
    await db.runAsync('DROP TABLE IF EXISTS departamentos');
    await db.runAsync('DROP TABLE IF EXISTS usuarios');
    await db.runAsync('DROP TABLE IF EXISTS comentarios');
    await db.runAsync('DROP TABLE IF EXISTS tags');
    await db.runAsync('DROP TABLE IF EXISTS notificacoes');
    await db.runAsync('DROP TABLE IF EXISTS documentos');
    
    console.log('✅ Tabelas deletadas');
    
    // Recriar as tabelas
    const { initDatabase } = require('./db');
    await initDatabase();
    
    console.log('✅ Banco de dados resetado com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao resetar banco:', error);
    process.exit(1);
  }
}

resetDatabase();