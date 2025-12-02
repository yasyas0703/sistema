const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const { criarNotificacao, notificarClientesWebSocket } = require('../utils/notificacoes'); 

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
  try {
    const tags = await db.allAsync('SELECT * FROM tags ORDER BY nome ASC');
    
    res.json({
      sucesso: true,
      tags: tags
    });
  } catch (erro) {
    console.error('❌ Erro ao listar tags:', erro);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao listar tags',
      detalhes: erro.message 
    });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, cor, texto } = req.body;
    
    if (!nome || !nome.trim()) {
      return res.status(400).json({
        sucesso: false,
        erro: 'Nome da tag é obrigatório'
      });
    }
    
    console.log('📝 Criando tag:', { nome, cor, texto });
    
    const tagExistente = await db.getAsync(
      'SELECT id FROM tags WHERE nome = ?', 
      [nome.trim()]
    );
    
    if (tagExistente) {
      return res.status(409).json({
        sucesso: false,
        erro: 'Já existe uma tag com este nome'
      });
    }
    
    const resultado = await db.runAsync(
      `INSERT INTO tags (nome, cor, texto) VALUES (?, ?, ?)`,
      [nome.trim(), cor || 'bg-gray-500', texto || 'text-white']
    );
    
    console.log('✅ Tag criada com ID:', resultado.id);
    
    const novaTag = await db.getAsync('SELECT * FROM tags WHERE id = ?', [resultado.id]);
    
    await criarNotificacao(
      `Nova tag criada: ${nome}`,
      'sucesso',
      req.usuario.id
    );
    
    res.status(201).json({
      sucesso: true,
      mensagem: 'Tag criada com sucesso',
      id: resultado.id,
      tag: novaTag
    });
    
    notificarClientesWebSocket('tag_criada', { id: resultado.id });
    
  } catch (erro) {
    console.error('❌ Erro ao criar tag:', erro);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao criar tag',
      detalhes: erro.message 
    });
  }
});


router.put('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, cor, texto } = req.body;
        
        const tagExistente = await db.getAsync('SELECT * FROM tags WHERE id = ?', [id]);
        
        if (!tagExistente) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Tag não encontrada'
            });
        }
        
        if (!nome || !nome.trim()) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Nome da tag é obrigatório'
            });
        }
        
        console.log('🔄 Atualizando tag ID:', id);
        
        await db.runAsync(
            `UPDATE tags SET nome = ?, cor = ?, texto = ? WHERE id = ?`,
            [nome.trim(), cor || tagExistente.cor, texto || tagExistente.texto, id]
        );
        
        const tagAtualizada = await db.getAsync('SELECT * FROM tags WHERE id = ?', [id]);
        
        await criarNotificacao(
            `Tag atualizada: ${nome}`,
            'info',
            req.usuario.id
        );
        
        res.json({
            sucesso: true,
            mensagem: 'Tag atualizada com sucesso',
            tag: tagAtualizada
        });
        
        notificarClientesWebSocket('tag_atualizada', { id: parseInt(id) });
        
    } catch (erro) {
        console.error('❌ Erro ao atualizar tag:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao atualizar tag',
            detalhes: erro.message 
        });
    }
});

router.delete('/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const tag = await db.getAsync('SELECT * FROM tags WHERE id = ?', [id]);
        
        if (!tag) {
            return res.status(404).json({
                sucesso: false,
                erro: 'Tag não encontrada'
            });
        }
        
        console.log('🗑️ Excluindo tag:', tag.nome);
        
        await db.runAsync('DELETE FROM tags WHERE id = ?', [id]);
        
        await criarNotificacao(
            `Tag excluída: ${tag.nome}`,
            'info',
            req.usuario.id
        );
        
        res.json({
            sucesso: true,
            mensagem: 'Tag excluída com sucesso'
        });
        
        notificarClientesWebSocket('tag_excluida', { id: parseInt(id) });
        
    } catch (erro) {
        console.error('❌ Erro ao excluir tag:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao excluir tag',
            detalhes: erro.message 
        });
    }
});

module.exports = router;