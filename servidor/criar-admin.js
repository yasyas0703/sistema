const bcrypt = require('bcrypt');
;

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database/db'); // Importa a função de init

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'sistema.db');
const db = new sqlite3.Database(dbPath);

async function criarAdmin() {
    try {
        await initDatabase();

        console.log('🔐 Gerando hash correto para "admin123"...');
        const senhaHash = await bcrypt.hash('admin123', 10);
        const testeHash = await bcrypt.compare('admin123', senhaHash);
        if (!testeHash) throw new Error('Hash incorreto');

        const permissoes = JSON.stringify([
            "criar_processo","editar_processo","excluir_processo",
            "criar_departamento","editar_departamento","excluir_departamento",
            "criar_tag","editar_tag","excluir_tag","gerenciar_usuarios"
        ]);

        await db.runAsync('DELETE FROM usuarios WHERE nome = ?', ['Admin']);
        console.log('🗑️  Usuário Admin antigo removido (se existia)');

        await db.runAsync(
            `INSERT INTO usuarios (id, nome, senha, role, permissoes, ativo) 
             VALUES (1, 'Admin', ?, 'admin', ?, 1)`,
            [senhaHash, permissoes]
        );
        console.log('✅ Usuário Admin criado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        db.close();
        process.exit(0);
    }
}

criarAdmin();
