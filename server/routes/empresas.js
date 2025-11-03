const express = require('express');
const router = express.Router();




const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.get('/', verificarToken, async (req, res) => {
  try {
    const empresas = await new Promise((resolve, reject) => {
      db.all(`SELECT * FROM empresas ORDER BY razao_social`, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    console.log('📋 Total de empresas no banco:', empresas.length);
    res.json({ sucesso: true, empresas });
  } catch (error) {
    console.error('❌ Erro ao listar empresas:', error);
    res.status(500).json({ sucesso: false, erro: error.message, empresas: [] });
  }
});

router.get('/:id', verificarToken, (req, res) => {
  try {
    const empresa = db.prepare('SELECT * FROM empresas WHERE id = ?')
      .get(req.params.id);
    
    if (!empresa) {
      return res.status(404).json({ sucesso: false, erro: 'Empresa não encontrada' });
    }
    
    res.json({ sucesso: true, empresa });
  } catch (error) {
    console.error('Erro ao buscar empresa:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.post('/', verificarToken, (req, res) => {
  try {
    if (req.usuario.role !== 'admin') {
      return res.status(403).json({ sucesso: false, erro: 'Sem permissão' });
    }

    const {
      cnpj, codigo, razao_social, apelido,
      inscricao_estadual, inscricao_municipal,
      regime_federal, regime_estadual, regime_municipal,
      data_abertura, estado, cidade, bairro,
      logradouro, numero, cep
    } = req.body;

    if (!cnpj || !codigo || !razao_social) {
      return res.status(400).json({ 
        sucesso: false, 
        erro: 'CNPJ, código e razão social são obrigatórios' 
      });
    }

    const resultado = db.prepare(`
      INSERT INTO empresas (
        cnpj, codigo, razao_social, apelido,
        inscricao_estadual, inscricao_municipal,
        regime_federal, regime_estadual, regime_municipal,
        data_abertura, estado, cidade, bairro,
        logradouro, numero, cep, criado_em, criado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cnpj, codigo, razao_social, apelido || '',
      inscricao_estadual || '', inscricao_municipal || '',
      regime_federal || '', regime_estadual || '', regime_municipal || '',
      data_abertura || null, estado || '', cidade || '', bairro || '',
      logradouro || '', numero || '', cep || '',
      new Date().toISOString(),
      req.usuario.id
    );

    const novaEmpresa = db.prepare('SELECT * FROM empresas WHERE id = ?')
      .get(resultado.lastInsertRowid);

    res.json({ sucesso: true, empresa: novaEmpresa });
  } catch (error) {
    console.error('Erro ao criar empresa:', error);
    
    if (error.message.includes('UNIQUE')) {
      return res.status(400).json({ 
        sucesso: false, 
        erro: 'CNPJ ou código já cadastrado' 
      });
    }
    
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.put('/:id', verificarToken, (req, res) => {
  try {
    if (req.usuario.role !== 'admin') {
      return res.status(403).json({ sucesso: false, erro: 'Sem permissão' });
    }

    const {
      cnpj, codigo, razao_social, apelido,
      inscricao_estadual, inscricao_municipal,
      regime_federal, regime_estadual, regime_municipal,
      data_abertura, estado, cidade, bairro,
      logradouro, numero, cep
    } = req.body;

    const empresaExistente = db.prepare('SELECT * FROM empresas WHERE id = ?')
      .get(req.params.id);
    
    if (!empresaExistente) {
      return res.status(404).json({ sucesso: false, erro: 'Empresa não encontrada' });
    }

    db.prepare(`
      UPDATE empresas SET
        cnpj = ?, codigo = ?, razao_social = ?, apelido = ?,
        inscricao_estadual = ?, inscricao_municipal = ?,
        regime_federal = ?, regime_estadual = ?, regime_municipal = ?,
        data_abertura = ?, estado = ?, cidade = ?, bairro = ?,
        logradouro = ?, numero = ?, cep = ?,
        atualizado_em = ?
      WHERE id = ?
    `).run(
      cnpj, codigo, razao_social, apelido || '',
      inscricao_estadual || '', inscricao_municipal || '',
      regime_federal || '', regime_estadual || '', regime_municipal || '',
      data_abertura || null, estado || '', cidade || '', bairro || '',
      logradouro || '', numero || '', cep || '',
      new Date().toISOString(),
      req.params.id
    );

    const empresaAtualizada = db.prepare('SELECT * FROM empresas WHERE id = ?')
      .get(req.params.id);

    res.json({ sucesso: true, empresa: empresaAtualizada });
  } catch (error) {
    console.error('Erro ao atualizar empresa:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

router.delete('/:id', verificarToken, (req, res) => {
  try {
    if (req.usuario.role !== 'admin') {
      return res.status(403).json({ sucesso: false, erro: 'Sem permissão' });
    }

    const empresaExistente = db.prepare('SELECT * FROM empresas WHERE id = ?')
      .get(req.params.id);
    
    if (!empresaExistente) {
      return res.status(404).json({ sucesso: false, erro: 'Empresa não encontrada' });
    }

    db.prepare('DELETE FROM empresas WHERE id = ?').run(req.params.id);
    
    res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao excluir empresa:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

module.exports = router;