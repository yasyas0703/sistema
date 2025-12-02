const bcrypt = require('bcrypt');

async function gerarHash() {
    const senha = 'admin123';
    const hash = await bcrypt.hash(senha, 10);
    
    console.log('=====================================');
    console.log('Senha:', senha);
    console.log('Hash gerado:', hash);
    console.log('=====================================');
    
    const valido = await bcrypt.compare(senha, hash);
    console.log('Teste de validação:', valido ? '✅ OK' : '❌ FALHOU');
}

gerarHash();