const path = require('path');
const { db } = require('./db.js');

// Função principal
async function atualizarSchema() {
    try {
        console.log("🔧 Iniciando atualização do schema...");

        // Adicionar coluna cadastrada, se não existir
        await db.runAsync(`
            ALTER TABLE empresas ADD COLUMN cadastrada BOOLEAN DEFAULT 1
        `).catch(() => {
            console.log("ℹ️ Coluna 'cadastrada' já existe na tabela empresas.");
        });

        // Atualizar valores antigos
        await db.runAsync(`
            UPDATE empresas
            SET cadastrada = CASE
                WHEN cnpj IS NOT NULL AND cnpj != ''
                 AND razao_social IS NOT NULL AND razao_social != ''
                THEN 1
                ELSE 0
            END;
        `);

        // Criar índice único opcional
        await db.runAsync(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_codigo ON empresas(codigo);
        `);

        console.log("✅ Atualização de schema concluída!");
        process.exit(0);

    } catch (err) {
        console.error("❌ ERRO na atualização do schema:", err);
        process.exit(1);
    }
}

atualizarSchema();
