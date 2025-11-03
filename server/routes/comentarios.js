
const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const { criarNotificacao, notificarClientesWebSocket } = require('../utils/notificacoes');

const router = express.Router();


router.get('/', verificarToken, async (req, res) => {
  try {
    const { processoId } = req.query; 
    
    console.log('🔍 Buscando comentários do processo:', processoId);
    
    if (!processoId) {
      return res.status(400).json({ erro: 'processoId é obrigatório' });
    }
    
    const comentarios = await db.allAsync(
      'SELECT * FROM comentarios WHERE processo_id = ? ORDER BY criado_em ASC',
      [processoId]
    );
    
    console.log(`✅ Encontrados ${comentarios.length} comentários`);
    
    const comentariosFormatados = comentarios.map(c => ({
      id: c.id,
      processoId: c.processo_id,
      texto: c.texto,
      autor: c.autor,
      departamentoId: c.departamento_id,
      departamento: c.departamento || 'Sistema',
      timestamp: c.criado_em,
      editado: c.editado === 1,
      editadoEm: c.editado_em,
      mencoes: JSON.parse(c.mencoes || '[]')
    }));
    
    res.json(comentariosFormatados);
  } catch (erro) {
    console.error('❌ Erro ao listar comentários:', erro);
    res.status(500).json({ erro: 'Erro ao listar comentários' });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    console.log('📥 Recebendo requisição de comentário:', req.body);
    const { processoId, texto, departamentoId, autor, mencoes } = req.body;
    
    if (!texto || !texto.trim()) {
      console.log('❌ Texto vazio recebido');
      return res.status(400).json({ erro: 'Texto é obrigatório' });
    }
    
    console.log('💾 Salvando no banco...');
    const resultado = await db.runAsync(
      `INSERT INTO comentarios (
        processo_id, texto, autor, departamento_id, mencoes
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        processoId,
        texto,
        autor,
        departamentoId || null,
        JSON.stringify(mencoes || [])
      ]
    );
    
    console.log('✅ Comentário salvo no banco, ID:', resultado.id);
    
    const comentario = await db.getAsync(
      'SELECT * FROM comentarios WHERE id = ?',
      [resultado.id]
    );
    
    await criarNotificacao(
      `Novo comentário em processo`,
      'info',
      req.usuario.id
    );
    
    res.json({ 
      sucesso: true, 
      id: resultado.id,
      comentario: {
        ...comentario,
        mencoes: JSON.parse(comentario.mencoes || '[]')
      }
    });
    
    notificarClientesWebSocket('comentario_criado', { processoId });
    
  } catch (erro) {
    console.error('❌ Erro ao criar comentário:', erro);
    res.status(500).json({ erro: 'Erro ao criar comentário' });
  }
});

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    
    await db.runAsync(
      `UPDATE comentarios SET 
        texto = ?, 
        editado = 1, 
        editado_em = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      [texto, id]
    );
    
    res.json({ sucesso: true });
    
  } catch (erro) {
    console.error('❌ Erro ao atualizar comentário:', erro);
    res.status(500).json({ erro: 'Erro ao atualizar comentário' });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.runAsync('DELETE FROM comentarios WHERE id = ?', [id]);
    
    res.json({ sucesso: true });
    
  } catch (erro) {
    console.error('❌ Erro ao excluir comentário:', erro);
    res.status(500).json({ erro: 'Erro ao excluir comentário' });
  }
});

module.exports = router;