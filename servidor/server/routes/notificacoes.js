const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const { criarNotificacao, notificarClientesWebSocket } = require('../utils/notificacoes');

const router = express.Router();

const getDataHoraBrasilia = () => {
  const agora = new Date();
  console.log('🕐 UTC agora:', agora.toISOString());
  console.log('🕐 Local agora:', agora.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
  
  const brasiliaTime = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
  
  const year = brasiliaTime.getUTCFullYear();
  const month = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brasiliaTime.getUTCDate()).padStart(2, '0');
  const hours = String(brasiliaTime.getUTCHours()).padStart(2, '0');
  const minutes = String(brasiliaTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(brasiliaTime.getUTCSeconds()).padStart(2, '0');
  
  const resultado = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  console.log('🕐 Brasília calculado:', resultado);
  
  return resultado;
};

router.get('/', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        
        const notificacoes = await db.allAsync(
            'SELECT * FROM notificacoes WHERE usuario_id = ? OR usuario_id IS NULL ORDER BY criado_em DESC LIMIT 50',
            [usuarioId]
        );
        
        res.json(notificacoes);
    } catch (erro) {
        console.error('❌ Erro ao listar notificações:', erro);
        res.status(500).json({ erro: 'Erro ao listar notificações', detalhes: erro.message });
    }
});


router.patch('/:id/lida', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`📖 Marcando notificação ${id} como lida`);
        
        const resultado = await db.runAsync(
            'UPDATE notificacoes SET lida = 1 WHERE id = ?',
            [id]
        );
        
        if (resultado.changes === 0) {
            return res.status(404).json({ erro: 'Notificação não encontrada' });
        }
        
        console.log('✅ Notificação marcada como lida');
        
        res.json({ sucesso: true });
        
    } catch (erro) {
        console.error('❌ Erro ao marcar notificação:', erro);
        res.status(500).json({ erro: 'Erro ao marcar notificação', detalhes: erro.message });
    }
});

router.delete('/limpar-todas', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        
        console.log(`🗑️ Excluindo todas notificações do usuário ${usuarioId}`);
        
        const resultado = await db.runAsync(
            'DELETE FROM notificacoes WHERE usuario_id = ? OR usuario_id IS NULL',
            [usuarioId]
        );
        
        console.log('✅ Notificações excluídas:', resultado.changes);
        
        res.json({ sucesso: true, excluidas: resultado.changes });
        
    } catch (erro) {
        console.error('❌ Erro ao excluir notificações:', erro);
        res.status(500).json({ erro: 'Erro ao excluir notificações', detalhes: erro.message });
    }
});

router.patch('/marcar-todas-lidas', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        
        console.log(`📖 Marcando todas notificações do usuário ${usuarioId} como lidas`);
        
        const resultado = await db.runAsync(
            'UPDATE notificacoes SET lida = 1 WHERE (usuario_id = ? OR usuario_id IS NULL) AND lida = 0',
            [usuarioId]
        );
        
        console.log('✅ Notificações marcadas:', resultado.changes);
        
        res.json({ sucesso: true, marcadas: resultado.changes });
        
    } catch (erro) {
        console.error('❌ Erro ao marcar notificações:', erro);
        res.status(500).json({ erro: 'Erro ao marcar notificações', detalhes: erro.message });
    }
});

router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        console.log(`🗑️ Excluindo notificação ${id}`);
        
        const resultado = await db.runAsync(
            'DELETE FROM notificacoes WHERE id = ?',
            [id]
        );
        
        if (resultado.changes === 0) {
            return res.status(404).json({ erro: 'Notificação não encontrada' });
        }
        
        console.log('✅ Notificação excluída');
        
        res.json({ sucesso: true });
        
    } catch (erro) {
        console.error('❌ Erro ao excluir notificação:', erro);
        res.status(500).json({ erro: 'Erro ao excluir notificação', detalhes: erro.message });
    }
});

router.get('/nao-lidas/count', verificarToken, async (req, res) => {
    try {
        const usuarioId = req.usuario.id;
        
        const resultado = await db.getAsync(
            'SELECT COUNT(*) as count FROM notificacoes WHERE (usuario_id = ? OR usuario_id IS NULL) AND lida = 0',
            [usuarioId]
        );
        
        res.json({ count: resultado.count });
        
    } catch (erro) {
        console.error('❌ Erro ao contar notificações:', erro);
        res.status(500).json({ erro: 'Erro ao contar notificações', detalhes: erro.message });
    }
});

module.exports = router;