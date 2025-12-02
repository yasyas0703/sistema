const bcrypt = require('bcrypt');
const { db } = require('./db');

async function resetAdminPassword() {
    try {
        const senhaHash = await bcrypt.hash('admin123', 10);
        
        await db.runAsync(
            `UPDATE usuarios SET senha = ? WHERE nome = 'Admin'`,
            [senhaHash]
        );
        
        console.log('✅ Senha do Admin resetada com sucesso!');
        console.log('📝 Novo hash:', senhaHash);
        console.log('🔑 Credenciais: Admin / admin123');
        
        process.exit(0);
    } catch (erro) {
        console.error('❌ Erro ao resetar senha:', erro);
        process.exit(1);
    }
}

resetAdminPassword();