const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
  try {
    const templates = await new Promise((resolve, reject) => {
      db.all(
        `SELECT t.*, u.nome as criador_nome 
         FROM templates_solicitacao t
         LEFT JOIN usuarios u ON t.criado_por = u.id
         ORDER BY t.criado_em DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    res.json({ sucesso: true, templates });
  } catch (err) {
    console.error('❌ Erro ao listar templates:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    const { nome, descricao, fluxo_departamentos, questionarios_por_departamento, criado_por } = req.body;

    console.log('📦 Criando template:', { nome, descricao });

    const resultado = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO templates_solicitacao (nome, descricao, fluxo_departamentos, questionarios_por_departamento, criado_por)
         VALUES (?, ?, ?, ?, ?)`,
        [
          nome,
          descricao || '',
          fluxo_departamentos,
          questionarios_por_departamento,
          criado_por || req.usuario.id
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ lastID: this.lastID, changes: this.changes });
        }
      );
    });

    res.json({ 
      sucesso: true, 
      id: resultado.lastID,
      mensagem: 'Template criado com sucesso' 
    });

  } catch (err) {
    console.error('❌ Erro ao criar template:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { nome, descricao, fluxo_departamentos, questionarios_por_departamento } = req.body;

    const resultado = await new Promise((resolve, reject) => {
      db.run(
        `UPDATE templates_solicitacao 
         SET nome = ?, descricao = ?, fluxo_departamentos = ?, questionarios_por_departamento = ?
         WHERE id = ?`,
        [
          nome,
          descricao,
          fluxo_departamentos,
          questionarios_por_departamento,
          req.params.id
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    res.json({ sucesso: true, changes: resultado.changes });

  } catch (err) {
    console.error('❌ Erro ao atualizar template:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const resultado = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM templates_solicitacao WHERE id = ?',
        [req.params.id],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    res.json({ sucesso: true, changes: resultado.changes });

  } catch (err) {
    console.error('❌ Erro ao excluir template:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

module.exports = router;