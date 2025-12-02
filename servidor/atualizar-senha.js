const bcrypt = require('bcrypt');
const { db } = require('./server/database/db');

async function atualizarSenha() {
    try {
        const novaSenha = 'admin123';
        const hash = await bcrypt.hash(novaSenha, 10);
        
        await db.runAsync(
            'UPDATE usuarios SET senha = ? WHERE nome = ?',
            [hash, 'Admin']
        );
        
        console.log('✅ Senha atualizada com sucesso!');
        console.log('Novo hash:', hash);
        
        // Verifica se funcionou
        const usuario = await db.getAsync('SELECT * FROM usuarios WHERE nome = ?', ['Admin']);
        const valido = await bcrypt.compare(novaSenha, usuario.senha);
        
        console.log('Teste de validação:', valido ? '✅ OK' : '❌ FALHOU');
        
        process.exit(0);
    } catch (err) {
        console.error('❌ Erro:', err);
        process.exit(1);
    }
}

atualizarSenha();