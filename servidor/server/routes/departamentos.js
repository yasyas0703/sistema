const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
    try {
        const departamentos = await db.allAsync('SELECT * FROM departamentos ORDER BY ordem, nome');
        
        const departamentosFormatados = departamentos.map(dept => ({
            ...dept,
            questionario: JSON.parse(dept.questionario || '[]'),
            documentosObrigatorios: JSON.parse(dept.documentos_obrigatorios || '[]')
        }));
        
        res.json(departamentosFormatados);
    } catch (erro) {
        console.error('Erro ao listar departamentos:', erro);
        res.status(500).json({ erro: 'Erro ao listar departamentos' });
    }
});

router.post('/', verificarToken, async (req, res) => {
    try {
        const departamento = req.body;
        
        const resultado = await db.runAsync(
            `INSERT INTO departamentos (
                nome, responsavel, cor, cor_solida, icone, 
                descricao, questionario, documentos_obrigatorios, ordem
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                departamento.nome,
                departamento.responsavel,
                departamento.cor,
                departamento.corSolida,
                departamento.icone,
                departamento.descricao,
                JSON.stringify(departamento.questionario || []),
                JSON.stringify(departamento.documentosObrigatorios || []),
                departamento.ordem || 0
            ]
        );
        
        res.json({ 
            sucesso: true, 
            id: resultado.id,
            departamento: {
                id: resultado.id,
                ...departamento
            }
        });
        
        global.wss?.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    tipo: 'departamento_criado',
                    dados: { id: resultado.id }
                }));
            }
        });
        
    } catch (erro) {
        console.error('Erro ao criar departamento:', erro);
        res.status(500).json({ erro: 'Erro ao criar departamento' });
    }
});

router.put('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const departamento = req.body;
        
        await db.runAsync(
            `UPDATE departamentos SET 
                nome = ?, responsavel = ?, cor = ?, cor_solida = ?, icone = ?,
                descricao = ?, questionario = ?, documentos_obrigatorios = ?, ordem = ?
            WHERE id = ?`,
            [
                departamento.nome,
                departamento.responsavel,
                departamento.cor,
                departamento.corSolida,
                departamento.icone,
                departamento.descricao,
                JSON.stringify(departamento.questionario || []),
                JSON.stringify(departamento.documentosObrigatorios || []),
                departamento.ordem || 0,
                id
            ]
        );
        
        res.json({ sucesso: true });
        
        global.wss?.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    tipo: 'departamento_atualizado',
                    dados: { id }
                }));
            }
        });
        
    } catch (erro) {
        console.error('Erro ao atualizar departamento:', erro);
        res.status(500).json({ erro: 'Erro ao atualizar departamento' });
    }
});

router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.runAsync('DELETE FROM departamentos WHERE id = ?', [id]);
        
        res.json({ sucesso: true });
        
    } catch (erro) {
        console.error('Erro ao excluir departamento:', erro);
        res.status(500).json({ erro: 'Erro ao excluir departamento' });
    }
});

router.post('/', verificarToken, async (req, res) => {
    try {
        console.log('📥 Criando departamento:', req.body);
        
        const departamento = req.body;
        
        if (!departamento.nome) {
            return res.status(400).json({ erro: 'Nome do departamento é obrigatório' });
        }
        
        const resultado = await db.runAsync(
            `INSERT INTO departamentos (
                nome, responsavel, cor, cor_solida, icone, 
                descricao, questionario, documentos_obrigatorios, ordem
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                departamento.nome,
                departamento.responsavel,
                departamento.cor,
                departamento.corSolida,
                departamento.icone,
                departamento.descricao || '',
                JSON.stringify(departamento.questionario || []),
                JSON.stringify(departamento.documentosObrigatorios || []),
                departamento.ordem || 0
            ]
        );
        
        console.log('✅ Departamento criado com ID:', resultado.id);
        
        res.json({ sucesso: true, id: resultado.id });
    } catch (erro) {
        console.error('❌ Erro ao criar departamento:', erro);
        res.status(500).json({ erro: 'Erro ao criar departamento', detalhes: erro.message });
    }
});

module.exports = router;