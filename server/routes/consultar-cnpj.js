const express = require('express');
const axios = require('axios');
const router = express.Router();


function cleanCnpj(raw) {
  if (!raw) return null;
  const onlyDigits = String(raw).replace(/\D/g, '');
  return onlyDigits.length === 14 ? onlyDigits : null;
}

async function handleConsultarCnpj(req, res) {
  try {
    const rawCnpj = (req.method === 'POST') ? req.body?.cnpj : req.query?.cnpj;
    console.log(`🔍 [consultar-cnpj] Requisição ${req.method} - cnpj raw:`, rawCnpj);

    if (!rawCnpj) {
      return res.status(400).json({ sucesso: false, erro: 'CNPJ não fornecido' });
    }

    const cnpjLimpo = cleanCnpj(rawCnpj);
    if (!cnpjLimpo) {
      return res.status(400).json({ sucesso: false, erro: 'CNPJ inválido - deve ter 14 dígitos' });
    }

    if (cnpjLimpo === '00000000000000') {
      return res.json({
        sucesso: true,
        dados: {
          razao_social: 'EMPRESA EXEMPLO LTDA',
          nome_fantasia: 'EMPRESA EXEMPLO',
          inscricao_estadual: '123.456.789.112',
          logradouro: 'Rua Exemplo',
          numero: '123',
          bairro: 'Centro',
          municipio: 'São Paulo',
          uf: 'SP',
          cep: '01001000',
          email: 'exemplo@empresa.com',
          telefone: '(11) 9999-9999'
        }
      });
    }

    console.log('🌐 Consultando BrasilAPI para', cnpjLimpo);
    const response = await axios.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, { timeout: 15000 });
    const dados = response.data || {};

    const dadosFormatados = {
      razao_social: dados.razao_social || '',
      nome_fantasia: dados.nome_fantasia || '',
      inscricao_estadual: dados.inscricao_estadual || '',
      logradouro: `${dados.logradouro || ''}`.trim(),
      numero: dados.numero || 'S/N',
      bairro: dados.bairro || '',
      municipio: dados.municipio || '',
      uf: dados.uf || '',
      cep: dados.cep ? dados.cep.replace(/\D/g, '') : '',
      email: dados.email || '',
      telefone: dados.telefone_1 || dados.telefone_2 || ''
    };

    console.log('📤 Enviando dados formatados');
    return res.json({ sucesso: true, dados: dadosFormatados });

  } catch (error) {
    console.error('❌ Erro na consulta CNPJ:', error?.message || error);

    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ sucesso: false, erro: 'Timeout na consulta. Tente novamente.' });
    }
    if (error.response) {
      const status = error.response.status || 500;
      const mensagem = (error.response.data && error.response.data.message) || error.response.data || 'Erro na consulta à Receita Federal';
      return res.status(status).json({ sucesso: false, erro: mensagem });
    }

    return res.status(500).json({ sucesso: false, erro: 'Erro interno do servidor' });
  }
}

router.post('/consultar-cnpj',  handleConsultarCnpj);
router.get('/consultar-cnpj',  handleConsultarCnpj);

module.exports = router;
