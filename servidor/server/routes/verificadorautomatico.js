const { db } = require('../database/db'); 

const MODO_TESTE = true;
const MINUTOS_PARA_AVANCAR = MODO_TESTE ? 1 : 7200;
const INTERVALO_VERIFICACAO = MODO_TESTE ? '*/1 * * * *' : '0 */6 * * *';
const cron = require('node-cron');
console.log(`🔧 Verificador: ${MODO_TESTE ? 'TESTE (1 min)' : 'PRODUÇÃO (5 dias)'}`);

async function verificarProcessosParados() {
  console.log('🔄 Verificando processos parados...');

  return new Promise((resolve, reject) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='processos'",
      (err, row) => {
        if (err) {
          console.error('❌ Erro ao verificar tabelas:', err);
          return reject(err);
        }

        if (!row) {
          console.warn("⚠️ Tabela 'processos' não existe ainda. Aguardando...");
          return resolve();
        }

        const query = `
          SELECT 
            p.id,
            p.nome_empresa,
            p.departamento_atual,
            p.fluxo_departamentos,
            p.departamento_atual_index,
            p.questionarios_por_departamento,
            p.respostas_historico,
            p.historico
          FROM processos p
          WHERE p.status = 'Em Andamento'
        `;

        db.all(query, [], async (err, processos) => {
          if (err) {
            console.error('❌ Erro na query:', err);
            return reject(err);
          }

          console.log(`📊 ${processos.length} processos encontrados`);
          
          for (const processo of processos) {
            await verificarEAvancarProcesso(processo);
          }
          
          resolve();
        });
      }
    );
  });
}

async function verificarEAvancarProcesso(processo) {
  return new Promise((resolve) => {
    try {
      console.log(`🔍 Verificando: ${processo.nome_empresa}`);
      
      const fluxoDepartamentos = JSON.parse(processo.fluxo_departamentos || '[]');
      const questionariosPorDept = JSON.parse(processo.questionarios_por_departamento || '{}');
      const respostasHistorico = JSON.parse(processo.respostas_historico || '{}');
      
      const indexAtual = processo.departamento_atual_index || 0;
      
      if (indexAtual >= fluxoDepartamentos.length - 1) {
        console.log(`⏭️ ${processo.nome_empresa} está no último departamento`);
        resolve();
        return;
      }
      
      const deptAtualId = processo.departamento_atual;
      const questionarioDept = questionariosPorDept[deptAtualId] || [];
      const respostasDept = respostasHistorico[deptAtualId]?.respostas || {};
      
      const camposObrigatorios = questionarioDept.filter(p => {
        const obrigatorio = p.obrigatorio;
        
        if (obrigatorio === true || obrigatorio === 1) return true;
        if (typeof obrigatorio === 'string') {
          const valorLower = obrigatorio.toLowerCase().trim();
          return valorLower === 'true' || valorLower === '1';
        }
        
        return false;
      });

      console.log('📋 Campos obrigatórios detectados:', camposObrigatorios.map(c => ({
        id: c.id,
        label: c.label,
        obrigatorio: c.obrigatorio,
        tipo: typeof c.obrigatorio
      })));

      console.log(`📋 ${processo.nome_empresa}:`, {
        totalPerguntas: questionarioDept.length,
        camposObrigatorios: camposObrigatorios.length,
        respostasPreenchidas: Object.keys(respostasDept).length
      });

      const todosCamposObrigatoriosPreenchidos = camposObrigatorios.every(campo => {
        const resposta = respostasDept[campo.id];
        const preenchido = resposta !== null && resposta !== undefined && resposta !== '';

        if (!preenchido) {
          console.log(`❌ Campo obrigatório NÃO preenchido: ${campo.label} (ID: ${campo.id})`);
        }

        return preenchido;
      });

      if (!todosCamposObrigatoriosPreenchidos) {
        console.log(`⚠️ ${processo.nome_empresa} - campos obrigatórios não preenchidos`);
        resolve();
        return;
      }

      console.log(`✅ ${processo.nome_empresa} - TODOS os campos obrigatórios preenchidos!`);
      
      const proximoIndex = indexAtual + 1;
      const proximoDeptId = fluxoDepartamentos[proximoIndex];
      
      db.get('SELECT nome FROM departamentos WHERE id = ?', [proximoDeptId], (err, deptDestino) => {
        if (err || !deptDestino) {
          console.log(`❌ Departamento ${proximoDeptId} não encontrado`);
          resolve();
          return;
        }
        
        db.get('SELECT nome FROM departamentos WHERE id = ?', [deptAtualId], (err, deptOrigem) => {
          const nomeDeptOrigem = deptOrigem?.nome || 'Desconhecido';
          const nomeDeptDestino = deptDestino.nome;
          
          console.log(`✅ Avançando: ${nomeDeptOrigem} → ${nomeDeptDestino}`);
          
          const historicoAtualizado = JSON.parse(processo.historico || '[]');
          historicoAtualizado.push({
            departamento: nomeDeptOrigem,
            data: new Date().toISOString(),
            dataTimestamp: Date.now(),
            acao: `⏰ Avançado automaticamente para ${nomeDeptDestino}`,
            responsavel: 'Sistema Automático',
            tipo: 'movimentacao_automatica'
          });
          
          const novoProgresso = Math.round(((proximoIndex + 1) / fluxoDepartamentos.length) * 100);
          
          db.run(`
            UPDATE processos 
            SET 
              departamento_atual = ?,
              departamento_atual_index = ?,
              progresso = ?,
              historico = ?
            WHERE id = ?
          `, [
            proximoDeptId,
            proximoIndex,
            novoProgresso,
            JSON.stringify(historicoAtualizado),
            processo.id
          ], (err) => {
            if (err) {
              console.error(`❌ Erro ao atualizar:`, err);
            } else {
              console.log(`✅ ${processo.nome_empresa} avançado com sucesso!`);
              criarNotificacao(processo.id, processo.nome_empresa, proximoDeptId, nomeDeptDestino);
            }
            resolve();
          });
        });
      });
      
    } catch (error) {
      console.error(`❌ Erro ao processar ${processo.nome_empresa}:`, error);
      resolve();
    }
  });
}
function criarNotificacao(processoId, nomeEmpresa, deptId, nomeDept) {
  const mensagem = `⏰ Processo "${nomeEmpresa}" avançado automaticamente para ${nomeDept}`;
  
  db.all('SELECT id FROM usuarios WHERE departamento_id = ? AND ativo = 1', [deptId], (err, usuarios) => {
    if (err || !usuarios) return;
    
    usuarios.forEach(user => {
      db.run(
        'INSERT INTO notificacoes (usuario_id, mensagem, tipo) VALUES (?, ?, ?)',
        [user.id, mensagem, 'info']
      );
    });
    
    console.log(`📬 ${usuarios.length} notificação(ões) criada(s)`);
  });
}

function iniciarVerificador() {
  cron.schedule(INTERVALO_VERIFICACAO, () => {
    console.log(`⏰ Executando verificação agendada...`);
    verificarProcessosParados().catch(err => {
      console.error('❌ Erro na verificação agendada:', err);
    });
  });

  setTimeout(() => {
    console.log('🚀 Primeira verificação automática...');
    verificarProcessosParados().catch(err => {
      console.error('❌ Erro na primeira verificação:', err);
    });
  }, 30000);
}

module.exports = { verificarProcessosParados, iniciarVerificador };