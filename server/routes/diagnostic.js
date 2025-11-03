const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const { testarNotificacoes } = require('../utils/notificacoes');

const router = express.Router();

router.get('/completo', verificarToken, async (req, res) => {
    const diagnostico = {
        timestamp: new Date().toISOString(),
        banco: {},
        tabelas: {},
        notificacoes: {},
        processos: {},
        websocket: {}
    };

    try {
        try {
            const teste = await db.getAsync('SELECT 1 as test');
            diagnostico.banco.conectado = true;
            diagnostico.banco.teste = teste;
        } catch (erro) {
            diagnostico.banco.conectado = false;
            diagnostico.banco.erro = erro.message;
        }

        try {
            const tabelas = await db.allAsync(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            );
            diagnostico.tabelas.lista = tabelas.map(t => t.name);
            diagnostico.tabelas.total = tabelas.length;
        } catch (erro) {
            diagnostico.tabelas.erro = erro.message;
        }

        try {
            const estrutura = await db.allAsync('PRAGMA table_info(notificacoes)');
            diagnostico.notificacoes.estrutura = estrutura;
            
            const total = await db.getAsync('SELECT COUNT(*) as total FROM notificacoes');
            diagnostico.notificacoes.total = total.total;
            
            const ultimas = await db.allAsync(
                'SELECT * FROM notificacoes ORDER BY id DESC LIMIT 5'
            );
            diagnostico.notificacoes.ultimas = ultimas;
            
        } catch (erro) {
            diagnostico.notificacoes.erro = erro.message;
        }

        try {
            const testeNotif = await testarNotificacoes();
            diagnostico.notificacoes.teste = testeNotif;
        } catch (erro) {
            diagnostico.notificacoes.teste = { erro: erro.message };
        }

        try {
            const totalProcessos = await db.getAsync('SELECT COUNT(*) as total FROM processos');
            diagnostico.processos.total = totalProcessos.total;
            
            const ultimosProcessos = await db.allAsync(
                'SELECT id, nome_empresa, status, data_criacao FROM processos ORDER BY id DESC LIMIT 5'
            );
            diagnostico.processos.ultimos = ultimosProcessos;
            
        } catch (erro) {
            diagnostico.processos.erro = erro.message;
        }

        diagnostico.websocket.disponivel = !!global.wss;
        if (global.wss) {
            diagnostico.websocket.clientesConectados = global.wss.clients.size;
        }

        try {
            const totalDepts = await db.getAsync('SELECT COUNT(*) as total FROM departamentos');
            diagnostico.departamentos = {
                total: totalDepts.total
            };
        } catch (erro) {
            diagnostico.departamentos = { erro: erro.message };
        }

        try {
            const totalTags = await db.getAsync('SELECT COUNT(*) as total FROM tags');
            diagnostico.tags = {
                total: totalTags.total
            };
        } catch (erro) {
            diagnostico.tags = { erro: erro.message };
        }

        res.json({
            sucesso: true,
            diagnostico
        });

    } catch (erro) {
        console.error('❌ Erro no diagnóstico:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Erro ao executar diagnóstico',
            detalhes: erro.message,
            diagnostico
        });
    }
});

router.post('/testar-notificacao', verificarToken, async (req, res) => {
    try {
        console.log('🧪 Iniciando teste de notificação...');
        
        const tabelaExiste = await db.getAsync(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='notificacoes'"
        );
        
        if (!tabelaExiste) {
            return res.status(500).json({
                sucesso: false,
                erro: 'Tabela notificacoes não existe!',
                solucao: 'Execute o schema.sql novamente'
            });
        }
        
        const resultado = await db.runAsync(
            `INSERT INTO notificacoes (mensagem, tipo, usuario_id, lida) 
             VALUES (?, ?, ?, ?)`,
            ['TESTE - Notificação criada via diagnóstico', 'teste', req.usuario.id, 0]
        );
        
        console.log('✅ Notificação teste criada com ID:', resultado.id);
        
        const notifCriada = await db.getAsync(
            'SELECT * FROM notificacoes WHERE id = ?',
            [resultado.id]
        );
        
        await db.runAsync(
            'DELETE FROM notificacoes WHERE id = ?',
            [resultado.id]
        );
        
        res.json({
            sucesso: true,
            mensagem: 'Teste de notificação concluído com sucesso!',
            testes: {
                tabelaExiste: true,
                inseriu: true,
                buscou: !!notifCriada,
                excluiu: true
            },
            notificacaoCriada: notifCriada
        });
        
    } catch (erro) {
        console.error('❌ Erro no teste de notificação:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Falha no teste de notificação',
            detalhes: erro.message,
            stack: erro.stack
        });
    }
});

router.post('/recriar-tabela-notificacoes', verificarToken, async (req, res) => {
    try {
        if (req.usuario.role !== 'admin') {
            return res.status(403).json({
                sucesso: false,
                erro: 'Apenas administradores podem recriar tabelas'
            });
        }
        
        console.log('⚠️ Recriando tabela de notificações...');
        
        let backup = [];
        try {
            backup = await db.allAsync('SELECT * FROM notificacoes');
        } catch (e) {
            console.log('Sem dados para backup');
        }
        
        await db.runAsync('DROP TABLE IF EXISTS notificacoes');
        
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
        
        console.log('✅ Tabela notificacoes recriada');
        
        let restaurados = 0;
        if (backup.length > 0) {
            for (const notif of backup) {
                try {
                    await db.runAsync(
                        `INSERT INTO notificacoes (id, mensagem, tipo, lida, usuario_id, criado_em)
                         VALUES (?, ?, ?, ?, ?, ?)`,
                        [notif.id, notif.mensagem, notif.tipo, notif.lida, notif.usuario_id, notif.criado_em]
                    );
                    restaurados++;
                } catch (e) {
                    console.error('Erro ao restaurar notificação:', e);
                }
            }
        }
        
        res.json({
            sucesso: true,
            mensagem: 'Tabela de notificações recriada com sucesso',
            backup: backup.length,
            restaurados
        });
        
    } catch (erro) {
        console.error('❌ Erro ao recriar tabela:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Erro ao recriar tabela',
            detalhes: erro.message
        });
    }
});

router.get('/estatisticas', verificarToken, async (req, res) => {
    try {
        const stats = {
            processos: await db.getAsync('SELECT COUNT(*) as total FROM processos'),
            departamentos: await db.getAsync('SELECT COUNT(*) as total FROM departamentos'),
            tags: await db.getAsync('SELECT COUNT(*) as total FROM tags'),
            notificacoes: await db.getAsync('SELECT COUNT(*) as total FROM notificacoes'),
            notificacoesNaoLidas: await db.getAsync(
                'SELECT COUNT(*) as total FROM notificacoes WHERE lida = 0'
            ),
            documentos: await db.getAsync('SELECT COUNT(*) as total FROM documentos'),
            comentarios: await db.getAsync('SELECT COUNT(*) as total FROM comentarios'),
            usuarios: await db.getAsync('SELECT COUNT(*) as total FROM usuarios')
        };
        
        res.json({
            sucesso: true,
            estatisticas: stats
        });
        
    } catch (erro) {
        console.error('❌ Erro ao obter estatísticas:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Erro ao obter estatísticas',
            detalhes: erro.message
        });
    }
});

router.delete('/limpar-testes', verificarToken, async (req, res) => {
    try {
        if (req.usuario.role !== 'admin') {
            return res.status(403).json({
                sucesso: false,
                erro: 'Apenas administradores podem limpar dados de teste'
            });
        }
        
        const notifExcluidas = await db.runAsync(
            "DELETE FROM notificacoes WHERE tipo = 'teste' OR mensagem LIKE '%TESTE%'"
        );
        
        res.json({
            sucesso: true,
            mensagem: 'Dados de teste limpos',
            notificacoesExcluidas: notifExcluidas.changes
        });
        
    } catch (erro) {
        console.error('❌ Erro ao limpar testes:', erro);
        res.status(500).json({
            sucesso: false,
            erro: 'Erro ao limpar dados de teste',
            detalhes: erro.message
        });
    }
});

module.exports = router;