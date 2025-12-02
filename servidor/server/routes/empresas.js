

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
      logradouro, numero, cep,
      cadastrada
    } = req.body;

    if (!codigo) {
      return res.status(400).json({ 
        sucesso: false, 
        erro: 'Código é obrigatório' 
      });
    }

    // ✅ VERIFICAR SE CÓDIGO JÁ EXISTE ANTES DE INSERIR


    const ehCadastrada = cadastrada !== undefined 
      ? cadastrada 
      : !!(cnpj?.trim() && razao_social?.trim());

    const resultado = db.prepare(`
      INSERT INTO empresas (
        cnpj, codigo, razao_social, apelido,
        inscricao_estadual, inscricao_municipal,
        regime_federal, regime_estadual, regime_municipal,
        data_abertura, estado, cidade, bairro,
        logradouro, numero, cep, cadastrada, criado_em, criado_por
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      cnpj || '', 
      codigo, 
      razao_social || '', 
      apelido || '',
      inscricao_estadual || '', 
      inscricao_municipal || '',
      regime_federal || '', 
      regime_estadual || '', 
      regime_municipal || '',
      data_abertura || null, 
      estado || '', 
      cidade || '', 
      bairro || '',
      logradouro || '', 
      numero || '', 
      cep || '',
      ehCadastrada ? 1 : 0,
      new Date().toISOString(),
      req.usuario.id
    );

    const novaEmpresa = db.prepare('SELECT * FROM empresas WHERE id = ?')
      .get(resultado.lastInsertRowid);

    res.json({ sucesso: true, empresa: novaEmpresa });
  } catch (error) {
    console.error('❌ Erro ao criar empresa:', error);
    
    // ✅ TRATAMENTO MELHORADO DE ERRO UNIQUE
    if (error.message.includes('UNIQUE constraint failed')) {
      if (error.message.includes('empresas.codigo')) {
        return res.status(409).json({ 
          sucesso: false, 
          erro: 'Este código já está sendo usado por outra empresa. Por favor, use um código diferente.' 
        });
      }
      if (error.message.includes('empresas.cnpj')) {
        return res.status(409).json({ 
          sucesso: false, 
          erro: 'Este CNPJ já está cadastrado no sistema.' 
        });
      }
      return res.status(409).json({ 
        sucesso: false, 
        erro: 'Código ou CNPJ já cadastrado no sistema.' 
      });
    }
    
    // ✅ OUTROS ERROS GENÉRICOS
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Erro interno do servidor ao cadastrar empresa.' 
    });
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
// No final do arquivo empresa.js, antes do module.exports

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

    // Verificar se há processos vinculados a esta empresa
const processosVinculados = db.prepare(`
  SELECT COUNT(*) AS total 
  FROM processos 
  WHERE nome_empresa = ?
`).get(empresaExistente.razao_social);

if (processosVinculados.total > 0) {
  return res.status(400).json({ 
    sucesso: false, 
    erro: `Não é possível excluir. Existem ${processosVinculados.total} processo(s) vinculado(s) a esta empresa.` 
  });
}


    db.prepare('DELETE FROM empresas WHERE id = ?').run(req.params.id);

    console.log('🗑️ Empresa excluída:', empresaExistente.razao_social);
    res.json({ sucesso: true, mensagem: 'Empresa excluída com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao excluir empresa:', error);
    res.status(500).json({ sucesso: false, erro: error.message });
  }
});

module.exports = router;