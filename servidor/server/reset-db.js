const fs = require('fs');
const path = require('path');
const { initDatabase } = require('./database/db');

const dbPath = path.join(__dirname, 'database', 'sistema.db');

console.log('🔄 Resetando banco de dados...');

if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  Banco de dados antigo removido');
}

initDatabase()
    .then(() => {
        console.log('✅ Banco de dados resetado com sucesso!');
        console.log('👤 Usuário admin criado:');
        console.log('   Nome: Admin');
        console.log('   Senha: admin123');
        process.exit(0);
    })
    .catch((err) => {
        console.error('❌ Erro ao resetar banco:', err);
        process.exit(1);
    });