const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const { criarNotificacao, notificarClientesWebSocket } = require('../utils/notificacoes');

const router = express.Router();

router.get('/', verificarToken, async (req, res) => {
  try {
    const processos = await db.allAsync('SELECT * FROM processos ORDER BY data_criacao DESC');

    const processosFormatados = processos.map(p => {
      let questionariosPorDepartamento = {};
      let questionarioSolicitacao = [];
      
      try {
        if (p.questionarios_por_departamento) {
          questionariosPorDepartamento = typeof p.questionarios_por_departamento === 'string' 
            ? JSON.parse(p.questionarios_por_departamento) 
            : p.questionarios_por_departamento;
        }
        
        if (p.questionario_solicitacao) {
          questionarioSolicitacao = typeof p.questionario_solicitacao === 'string'
            ? JSON.parse(p.questionario_solicitacao)
            : p.questionario_solicitacao;
        }
      } catch (error) {
        console.error('❌ Erro ao parsear questionários:', error);
      }

      return {
        ...p,
        nomeEmpresa: p.nome_empresa,
        nomeServico: p.nome_servico,
        questionarioSolicitacao,
        questionariosPorDepartamento,
        respostas: JSON.parse(p.respostas || '{}'),
        respostasHistorico: JSON.parse(p.respostas_historico || '{}'),
        fluxoDepartamentos: JSON.parse(p.fluxo_departamentos || '[]'),
        historico: JSON.parse(p.historico || '[]'),
        tags: JSON.parse(p.tags || '[]'),
        departamentoAtualIndex: p.departamento_atual_index || 0,
        status: p.status || 'Em Andamento',
      };
    });

    res.json(processosFormatados);
  } catch (erro) {
    console.error('❌ Erro ao listar processos:', erro);
    res.status(500).json({ erro: 'Erro ao listar processos', detalhes: erro.message });
  }
});

router.post('/', verificarToken, async (req, res) => {
  try {
    console.log('📦 Body recebido:', JSON.stringify(req.body, null, 2));
    
    const processo = req.body;
    
    if (!processo.nomeEmpresa || !processo.nomeServico) {
      return res.status(400).json({ 
        sucesso: false, 
        erro: 'Nome da empresa e serviço são obrigatórios' 
      });
    }

    const questionariosPorDepartamento = processo.questionariosPorDepartamento || {};
    const fluxoDepartamentos = processo.fluxoDepartamentos || [];
    
    console.log('📥 Salvando processo:', {
      nome: processo.nomeEmpresa,
      servico: processo.nomeServico,
      totalDepartamentos: fluxoDepartamentos.length,
      totalQuestionarios: Object.keys(questionariosPorDepartamento).length
    });
    
    Object.entries(questionariosPorDepartamento).forEach(([deptId, perguntas]) => {
      console.log(`   📋 Dept ${deptId}: ${perguntas.length} perguntas`);
    });
    
    const processoDB = {
      nome_empresa: processo.nomeEmpresa,
      nome_servico: processo.nomeServico,
      cliente: processo.cliente || 'Não informado',
      email: processo.email || '',
      telefone: processo.telefone || '',
      departamento_atual: processo.fluxoDepartamentos?.[0] || 1,
      departamento_atual_index: 0,
      fluxo_departamentos: JSON.stringify(processo.fluxoDepartamentos || []),
      status: processo.status || 'Em Andamento',
      prioridade: processo.prioridade || 'MEDIA',
      data_inicio: processo.dataInicio || new Date().toISOString(),
      prazo_estimado: processo.prazoEstimado || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      progresso: processo.progresso || 0,
      historico: JSON.stringify(processo.historico || []),
      tags: JSON.stringify(processo.tags || []),
      observacoes: processo.observacoes || '',
      criado_por: req.usuario.id,
      questionario_solicitacao: JSON.stringify(processo.questionarioSolicitacao || []),
      questionarios_por_departamento: JSON.stringify(processo.questionariosPorDepartamento || {}),
      respostas_historico: JSON.stringify(processo.respostasHistorico || {}),
    };

    const sql = `
      INSERT INTO processos (
        nome_empresa, nome_servico, cliente, email, telefone,
        departamento_atual, departamento_atual_index, fluxo_departamentos, 
        status, prioridade, data_inicio, prazo_estimado, progresso, 
        historico, tags, observacoes, criado_por, questionario_solicitacao,
        questionarios_por_departamento, respostas_historico
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      processoDB.nome_empresa,
      processoDB.nome_servico,
      processoDB.cliente,
      processoDB.email,
      processoDB.telefone,
      processoDB.departamento_atual,
      processoDB.departamento_atual_index,
      processoDB.fluxo_departamentos,
      processoDB.status,
      processoDB.prioridade,
      processoDB.data_inicio,
      processoDB.prazo_estimado,
      processoDB.progresso,
      processoDB.historico,
      processoDB.tags,
      processoDB.observacoes,
      processoDB.criado_por,
      processoDB.questionario_solicitacao,
      processoDB.questionarios_por_departamento,
      processoDB.respostas_historico,
    ];

    console.log('🔧 Executando INSERT...');
    
    db.run(sql, params, function(err) {
      if (err) {
        console.error('❌ Erro no INSERT:', err);
        return res.status(500).json({ 
          sucesso: false, 
          erro: 'Erro ao inserir no banco: ' + err.message 
        });
      }
      
      console.log('✅ Processo salvo com ID:', this.lastID);

      db.get('SELECT * FROM processos WHERE id = ?', [this.lastID], (err, processoSalvo) => {
        if (err) {
          console.error('❌ Erro ao buscar processo criado:', err);
          return res.status(500).json({ 
            sucesso: false, 
            erro: 'Erro ao buscar processo criado' 
          });
        }

        if (!processoSalvo) {
          return res.status(500).json({ 
            sucesso: false, 
            erro: 'Processo não encontrado após inserção' 
          });
        }

        const processoFormatado = {
          ...processoSalvo,
          nomeEmpresa: processoSalvo.nome_empresa,
          nomeServico: processoSalvo.nome_servico,
          questionarioSolicitacao: JSON.parse(processoSalvo.questionario_solicitacao || '[]'),
          questionariosPorDepartamento: JSON.parse(processoSalvo.questionarios_por_departamento || '{}'),
          respostasHistorico: JSON.parse(processoSalvo.respostas_historico || '{}'),
          fluxoDepartamentos: JSON.parse(processoSalvo.fluxo_departamentos || '[]'),
          historico: JSON.parse(processoSalvo.historico || '[]'),
          tags: JSON.parse(processoSalvo.tags || '[]')
        };

        res.json({ 
          sucesso: true, 
          id: this.lastID,
          processo: processoFormatado,
          mensagem: 'Processo criado com sucesso'
        });
      });
    });

  } catch (error) {
    console.error('❌ Erro ao criar processo:', error);
    res.status(500).json({ 
      sucesso: false, 
      erro: 'Erro ao criar processo: ' + error.message 
    });
  }
});
router.put('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const dadosAtualizados = req.body;
    
    console.log('📥 Backend recebeu atualização:', {
      processoId: id,
      temQuestionarios: !!dadosAtualizados.questionariosPorDepartamento,
      totalDepartamentos: Object.keys(dadosAtualizados.questionariosPorDepartamento || {}).length
    });

    const processoAtual = await db.getAsync('SELECT * FROM processos WHERE id = ?', [id]);
    
    if (!processoAtual) {
      return res.status(404).json({ sucesso: false, erro: 'Processo não encontrado' });
    }

    let questionariosAtualizados = {};
    if (dadosAtualizados.questionariosPorDepartamento) {
      const questionariosAtual = typeof processoAtual.questionarios_por_departamento === 'string'
        ? JSON.parse(processoAtual.questionarios_por_departamento)
        : processoAtual.questionarios_por_departamento || {};

      questionariosAtualizados = {
        ...questionariosAtual,
        ...dadosAtualizados.questionariosPorDepartamento
      };
    }

    const sql = `
      UPDATE processos 
      SET nome_empresa = ?,
          nome_servico = ?,
          cliente = ?,
          email = ?,
          telefone = ?,
          departamento_atual = ?,
          departamento_atual_index = ?,
          status = ?,
          prioridade = ?,
          data_inicio = ?,
          prazo_estimado = ?,
          data_finalizacao = ?,
          progresso = ?,
          respostas = ?,
          respostas_solicitacao = ?,
          respostas_historico = ?,
          historico = ?,
          tags = ?,
          observacoes = ?,
          questionario_solicitacao = ?,
          questionarios_por_departamento = ?,
          fluxo_departamentos = ?
      WHERE id = ?
    `;

    const params = [
      dadosAtualizados.nomeEmpresa || processoAtual.nome_empresa,
      dadosAtualizados.nomeServico || processoAtual.nome_servico,
      dadosAtualizados.cliente || processoAtual.cliente,
      dadosAtualizados.email || processoAtual.email,
      dadosAtualizados.telefone || processoAtual.telefone,
      dadosAtualizados.departamentoAtual || processoAtual.departamento_atual,
      dadosAtualizados.departamentoAtualIndex !== undefined ? dadosAtualizados.departamentoAtualIndex : processoAtual.departamento_atual_index,
      dadosAtualizados.status || processoAtual.status,
      dadosAtualizados.prioridade || processoAtual.prioridade,
      dadosAtualizados.dataInicio || processoAtual.data_inicio,
      dadosAtualizados.prazoEstimado || processoAtual.prazo_estimado,
      dadosAtualizados.dataFinalizacao || processoAtual.data_finalizacao,
      dadosAtualizados.progresso !== undefined ? dadosAtualizados.progresso : processoAtual.progresso,
      JSON.stringify(dadosAtualizados.respostas || JSON.parse(processoAtual.respostas || '{}')),
      JSON.stringify(dadosAtualizados.respostasSolicitacao || JSON.parse(processoAtual.respostas_solicitacao || '{}')),
      JSON.stringify(dadosAtualizados.respostasHistorico || JSON.parse(processoAtual.respostas_historico || '{}')),
      JSON.stringify(dadosAtualizados.historico || JSON.parse(processoAtual.historico || '[]')),
      JSON.stringify(dadosAtualizados.tags || JSON.parse(processoAtual.tags || '[]')),
      dadosAtualizados.observacoes || processoAtual.observacoes,
      JSON.stringify(dadosAtualizados.questionarioSolicitacao || JSON.parse(processoAtual.questionario_solicitacao || '[]')),
      JSON.stringify(questionariosAtualizados),
      JSON.stringify(dadosAtualizados.fluxoDepartamentos || JSON.parse(processoAtual.fluxo_departamentos || '[]')),
      id
    ];

    await db.runAsync(sql, params);

    const processoAtualizado = await db.getAsync('SELECT * FROM processos WHERE id = ?', [id]);

    res.json({ 
      sucesso: true, 
      processo: {
        ...processoAtualizado,
        nomeEmpresa: processoAtualizado.nome_empresa,
        nomeServico: processoAtualizado.nome_servico,
        questionarioSolicitacao: JSON.parse(processoAtualizado.questionario_solicitacao || '[]'),
        questionariosPorDepartamento: JSON.parse(processoAtualizado.questionarios_por_departamento || '{}'),
        respostasHistorico: JSON.parse(processoAtualizado.respostas_historico || '{}'),
        fluxoDepartamentos: JSON.parse(processoAtualizado.fluxo_departamentos || '[]'),
        historico: JSON.parse(processoAtualizado.historico || '[]'),
        tags: JSON.parse(processoAtualizado.tags || '[]')
      }
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar processo:', error);
    res.status(500).json({ sucesso: false, erro: 'Erro ao atualizar processo: ' + error.message });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`🗑️ Excluindo processo ${id}`);
    
    const existe = await db.getAsync('SELECT * FROM processos WHERE id = ?', [id]);
    if (!existe) {
      return res.status(404).json({ erro: 'Processo não encontrado' });
    }
    
    await db.runAsync('DELETE FROM comentarios WHERE processo_id = ?', [id]);
    await db.runAsync('DELETE FROM documentos WHERE processo_id = ?', [id]);
    const resultado = await db.runAsync('DELETE FROM processos WHERE id = ?', [id]);
    
    console.log('✅ Processo excluído');
    
    await criarNotificacao(
      `Processo excluído: ${existe.nome_empresa}`,
      'info',
      req.usuario.id
    );
    
    res.json({ sucesso: true, changes: resultado.changes });
    
    notificarClientesWebSocket('processo_excluido', { id: parseInt(id) });
    
  } catch (erro) {
    console.error('❌ Erro ao excluir processo:', erro);
    res.status(500).json({ erro: 'Erro ao excluir processo', detalhes: erro.message });
  }
});

router.put('/:id/questionario', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { departamentoId, questionario } = req.body;

    console.log('📝 Atualizando questionário do processo:', id);
    console.log('📦 Perguntas recebidas:', questionario?.length || 0);

    const processoAtual = await db.getAsync('SELECT * FROM processos WHERE id = ?', [id]);
    
    if (!processoAtual) {
      return res.status(404).json({ sucesso: false, erro: 'Processo não encontrado' });
    }

    let questionariosPorDepartamento = {};
    try {
      questionariosPorDepartamento = JSON.parse(processoAtual.questionarios_por_departamento || '{}');
    } catch (e) {
      console.warn('⚠️ Erro ao parsear questionarios_por_departamento, criando novo objeto');
    }

    questionariosPorDepartamento[String(departamentoId)] = questionario;

    const sql = `
      UPDATE processos 
      SET questionarios_por_departamento = ?
      WHERE id = ?
    `;

    const jsonString = JSON.stringify(questionariosPorDepartamento);
    console.log('✅ Gravando no banco:', jsonString.substring(0, 100) + '...');

    await db.runAsync(sql, [jsonString, id]);

    res.json({
      sucesso: true,
      mensagem: 'Questionário atualizado com sucesso',
      questionariosPorDepartamento
    });

  } catch (erro) {
    console.error('❌ Erro ao atualizar questionário:', erro);
    res.status(500).json({ sucesso: false, erro: erro.message });
  }
});

module.exports = router;