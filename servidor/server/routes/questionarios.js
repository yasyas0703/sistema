const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');

const router = express.Router();


router.put('/departamento/:departamentoId', verificarToken, async (req, res) => {
    try {
        const { departamentoId } = req.params;
        const { questionario } = req.body;
        
        console.log(`📝 Salvando questionário do departamento ${departamentoId}`);
        console.log('📦 Total de perguntas:', Array.isArray(questionario) ? questionario.length : 0);
        
        if (!Array.isArray(questionario)) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'Questionário deve ser um array' 
            });
        }
        
        const dept = await db.getAsync(
            'SELECT * FROM departamentos WHERE id = ?', 
            [departamentoId]
        );
        
        if (!dept) {
            return res.status(404).json({ 
                sucesso: false, 
                erro: 'Departamento não encontrado' 
            });
        }
        
        await db.runAsync(
            'UPDATE departamentos SET questionario = ? WHERE id = ?',
            [JSON.stringify(questionario), departamentoId]
        );
        
        console.log('✅ Questionário salvo com sucesso no banco de dados');
        
        res.json({ 
            sucesso: true,
            questionario: questionario,
            mensagem: `${questionario.length} pergunta(s) salva(s)`
        });
        
    } catch (erro) {
        console.error('❌ Erro ao salvar questionário:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao salvar questionário', 
            detalhes: erro.message 
        });
    }
});


router.get('/departamento/:departamentoId', verificarToken, async (req, res) => {
    try {
        const { departamentoId } = req.params;
        
        console.log(`🔍 Buscando questionário do departamento ${departamentoId}`);
        
        const dept = await db.getAsync(
            'SELECT questionario FROM departamentos WHERE id = ?',
            [departamentoId]
        );
        
        if (!dept) {
            return res.status(404).json({ 
                sucesso: false, 
                erro: 'Departamento não encontrado' 
            });
        }
        
        const questionario = JSON.parse(dept.questionario || '[]');
        
        console.log(`✅ Questionário encontrado: ${questionario.length} pergunta(s)`);
        
        res.json({ 
            sucesso: true,
            questionario: questionario
        });
        
    } catch (erro) {
        console.error('❌ Erro ao buscar questionário:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao buscar questionário', 
            detalhes: erro.message 
        });
    }
});

router.get('/respostas/:processoId/:departamentoId', verificarToken, async (req, res) => {
    try {
        const { processoId, departamentoId } = req.params;
        
        console.log(`🔍 Buscando respostas: Processo ${processoId}, Departamento ${departamentoId}`);
        
        const respostas = await db.allAsync(
            `SELECT * FROM respostas_questionario 
             WHERE processo_id = ? AND departamento_id = ? 
             ORDER BY criado_em DESC`,
            [processoId, departamentoId]
        );
        
        const respostasObj = {};
        respostas.forEach(r => {
            respostasObj[r.pergunta_id] = r.resposta;
        });
        
        console.log(`✅ ${Object.keys(respostasObj).length} resposta(s) encontrada(s)`);
        
        res.json({ 
            sucesso: true,
            respostas: respostasObj,
            total: Object.keys(respostasObj).length
        });
        
    } catch (erro) {
        console.error('❌ Erro ao buscar respostas:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao buscar respostas',
            detalhes: erro.message 
        });
    }
});


router.post('/', verificarToken, async (req, res) => {
    try {
        const { departamentoId, perguntas } = req.body;
        
        console.log(`📝 Salvando questionário do departamento ${departamentoId} via POST`);
        console.log('📦 Total de perguntas:', Array.isArray(perguntas) ? perguntas.length : 0);
        
        if (!departamentoId) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'departamentoId é obrigatório' 
            });
        }
        
        if (!Array.isArray(perguntas)) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'perguntas deve ser um array' 
            });
        }
        
        const dept = await db.getAsync(
            'SELECT * FROM departamentos WHERE id = ?', 
            [departamentoId]
        );
        
        if (!dept) {
            return res.status(404).json({ 
                sucesso: false, 
                erro: 'Departamento não encontrado' 
            });
        }
        
        await db.runAsync(
            'UPDATE departamentos SET questionario = ? WHERE id = ?',
            [JSON.stringify(perguntas), departamentoId]
        );
        
        console.log('✅ Questionário salvo com sucesso via POST');
        
        res.json({ 
            sucesso: true,
            questionario: perguntas,
            mensagem: `${perguntas.length} pergunta(s) salva(s)`
        });
        
    } catch (erro) {
        console.error('❌ Erro ao salvar questionário via POST:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao salvar questionário', 
            detalhes: erro.message 
        });
    }
});


router.post('/registrar-preenchimento', async (req, res) => {
  try {
    const { processoId, departamentoId, preenchidoPor } = req.body;

    if (!processoId || !departamentoId) {
      return res.status(400).json({ sucesso: false, erro: 'processoId e departamentoId são obrigatórios' });
    }

    const existente = await db.getAsync(
      'SELECT id FROM questionarios_preenchidos WHERE processo_id = ? AND departamento_id = ?',
      [processoId, departamentoId]
    );

    const agora = new Date().toISOString();
    const usuario = preenchidoPor || 'Sistema';

    if (existente && existente.id) {
      await db.runAsync(
        `UPDATE questionarios_preenchidos 
         SET preenchido_em = ?, preenchido_por = ?, todos_obrigatorios_preenchidos = ?
         WHERE processo_id = ? AND departamento_id = ?`,
        [agora, usuario, 1, processoId, departamentoId]
      );
    } else {
      await db.runAsync(
        `INSERT INTO questionarios_preenchidos 
         (processo_id, departamento_id, preenchido_em, preenchido_por, todos_obrigatorios_preenchidos)
         VALUES (?, ?, ?, ?, ?)`,
        [processoId, departamentoId, agora, usuario, 1]
      );
    }

    return res.json({ sucesso: true });
  } catch (error) {
    console.error('Erro ao registrar preenchimento (sqlite):', error);
    return res.status(500).json({ sucesso: false, erro: error.message });
  }
});


router.put('/processos/:id/questionario', async (req, res) => {
  try {
    const { id } = req.params;
    const { departamentoId, questionario } = req.body;

    console.log('📝 Atualizando questionário:', {
      processoId: id,
      departamentoId,
      totalPerguntas: questionario.length
    });

    const [processos] = await db.query(
      'SELECT questionarios_por_departamento FROM processos WHERE id = ?',
      [id]
    );

    if (processos.length === 0) {
      return res.status(404).json({ sucesso: false, erro: 'Processo não encontrado' });
    }

    let questionariosPorDepartamento = {};
    try {
      const raw = processos[0].questionarios_por_departamento;
      questionariosPorDepartamento = raw 
        ? (typeof raw === 'string' ? JSON.parse(raw) : raw)
        : {};
    } catch (error) {
      console.error('❌ Erro ao parsear questionários:', error);
      questionariosPorDepartamento = {};
    }

    questionariosPorDepartamento[String(departamentoId)] = questionario;

    console.log('💾 Salvando estrutura atualizada:', {
      departamentos: Object.keys(questionariosPorDepartamento),
      totalPorDepto: Object.entries(questionariosPorDepartamento).map(([k, v]) => ({
        departamentoId: k,
        perguntas: v.length
      }))
    });

    await db.query(
      'UPDATE processos SET questionarios_por_departamento = ? WHERE id = ?',
      [JSON.stringify(questionariosPorDepartamento), id]
    );
    res.json({
      sucesso: true,
      mensagem: 'Questionário atualizado com sucesso',
      questionariosPorDepartamento
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar questionário:', error);
    res.status(500).json({
      sucesso: false,
      erro: 'Erro ao atualizar questionário: ' + error.message
    });
  }
});

router.put('/:departamentoId', verificarToken, async (req, res) => {
    try {
        const { departamentoId } = req.params;
        const { perguntas } = req.body;
        
        console.log(`📝 Salvando questionário do departamento ${departamentoId} via PUT`);
        console.log('📦 Total de perguntas:', Array.isArray(perguntas) ? perguntas.length : 0);
        
        if (!Array.isArray(perguntas)) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'perguntas deve ser um array' 
            });
        }
        
        const dept = await db.getAsync(
            'SELECT * FROM departamentos WHERE id = ?', 
            [departamentoId]
        );
        
        if (!dept) {
            return res.status(404).json({ 
                sucesso: false, 
                erro: 'Departamento não encontrado' 
            });
        }
        
        await db.runAsync(
            'UPDATE departamentos SET questionario = ? WHERE id = ?',
            [JSON.stringify(perguntas), departamentoId]
        );
        
        console.log('✅ Questionário salvo com sucesso via PUT');
        
        res.json({ 
            sucesso: true,
            questionario: perguntas,
            mensagem: `${perguntas.length} pergunta(s) salva(s)`
        });
        
    } catch (erro) {
        console.error('❌ Erro ao salvar questionário via PUT:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao salvar questionário', 
            detalhes: erro.message 
        });
    }
});

router.post('/salvar-respostas', verificarToken, async (req, res) => {
  console.log('\n=== INÍCIO SALVAR RESPOSTAS ===');
  console.log('📥 Headers:', req.headers);
  console.log('📥 Body recebido:', req.body);
  console.log('👤 Usuário:', req.usuario?.nome);
  
  try {
    const { processoId, departamentoId, respostas } = req.body;
    
    console.log('📊 Dados extraídos:', {
      processoId,
      departamentoId,
      totalRespostas: respostas ? Object.keys(respostas).length : 0,
      tipoRespostas: typeof respostas,
      respostas: respostas
    });

    if (!processoId) {
      console.error('❌ processoId ausente');
      return res.status(400).json({ 
        sucesso: false,
        erro: 'processoId é obrigatório' 
      });
    }

    if (!departamentoId) {
      console.error('❌ departamentoId ausente');
      return res.status(400).json({ 
        sucesso: false,
        erro: 'departamentoId é obrigatório' 
      });
    }

    if (!respostas || typeof respostas !== 'object') {
      console.error('❌ respostas inválidas:', respostas);
      return res.status(400).json({ 
        sucesso: false,
        erro: 'respostas deve ser um objeto' 
      });
    }

    console.log('✅ Validações passaram');

    console.log('🔍 Buscando processo:', processoId);
    const processo = await db.getAsync(
      'SELECT * FROM processos WHERE id = ?',
      [processoId]
    );

    if (!processo) {
      console.error('❌ Processo não encontrado:', processoId);
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Processo não encontrado' 
      });
    }

    console.log('✅ Processo encontrado:', processo.nome_empresa);

    console.log('📋 Histórico atual:', processo.respostas_historico);
    let respostasHistorico = {};
    try {
      respostasHistorico = JSON.parse(processo.respostas_historico || '{}');
      console.log('✅ Histórico parseado:', Object.keys(respostasHistorico).length, 'departamentos');
    } catch (e) {
      console.warn('⚠️ Erro ao parsear, criando novo histórico:', e.message);
      respostasHistorico = {};
    }

    const dadosAtuais = respostasHistorico[departamentoId] || {};
    console.log('📂 Dados atuais do departamento:', dadosAtuais);
    
    respostasHistorico[departamentoId] = {
      ...dadosAtuais,
      respostas: respostas,
      respondidoEm: new Date().toISOString(),
      respondidoPor: req.usuario?.nome || 'Sistema',
      departamentoId: departamentoId
    };

    console.log('📝 Novo histórico:', respostasHistorico[departamentoId]);

    const novoHistoricoJSON = JSON.stringify(respostasHistorico);
    console.log('💾 Salvando no banco, tamanho:', novoHistoricoJSON.length, 'bytes');
    
    const resultado = await db.runAsync(
      `UPDATE processos 
       SET respostas_historico = ? 
       WHERE id = ?`,
      [novoHistoricoJSON, processoId]
    );

    console.log('✅ Resultado da atualização:', resultado);

    const verificacao = await db.getAsync(
      'SELECT respostas_historico FROM processos WHERE id = ?',
      [processoId]
    );
    console.log('🔍 Verificação pós-save:', verificacao.respostas_historico.substring(0, 100) + '...');

    console.log('✅ Respostas salvas com sucesso!');
    console.log('=== FIM SALVAR RESPOSTAS ===\n');

    res.json({ 
      sucesso: true, 
      mensagem: 'Respostas salvas com sucesso',
      totalSalvas: Object.keys(respostas).length
    });

  } catch (erro) {
    console.error('❌ ERRO FATAL:', erro);
    console.error('   Stack:', erro.stack);
    console.log('=== FIM COM ERRO ===\n');
    
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao salvar respostas', 
      detalhes: erro.message 
    });
  }
});

router.delete('/respostas/:processoId/:departamentoId', verificarToken, async (req, res) => {
    try {
        const { processoId, departamentoId } = req.params;
        
        console.log(`🗑️ Excluindo respostas: Processo ${processoId}, Departamento ${departamentoId}`);
        
        const resultado = await db.runAsync(
            'DELETE FROM respostas_questionario WHERE processo_id = ? AND departamento_id = ?',
            [processoId, departamentoId]
        );
        
        console.log(`✅ ${resultado.changes} resposta(s) excluída(s)`);
        
        res.json({ 
            sucesso: true,
            mensagem: `${resultado.changes} resposta(s) excluída(s)`,
            totalExcluidas: resultado.changes
        });
        
    } catch (erro) {
        console.error('❌ Erro ao excluir respostas:', erro);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro ao excluir respostas',
            detalhes: erro.message 
        });
    }
});

module.exports = router;