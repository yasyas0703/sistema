const { db } = require('../database/db');

const converterParaBrasilia = (dataUTC) => {
  if (!dataUTC) return null;
  const data = new Date(dataUTC + 'Z');
  data.setHours(data.getHours() - 3);
  return data.toISOString();
};

const TIPOS_NOTIFICACAO = {
  PROCESSO_CRIADO: 'processo_criado',
  PROCESSO_EXCLUIDO: 'processo_excluido',
  DEPARTAMENTO_CRIADO: 'departamento_criado',
  USUARIO_CRIADO: 'usuario_criado',
  PROCESSO_ATRASADO: 'processo_atrasado',
  PROCESSO_PARADO: 'processo_parado',
  PROCESSO_TRANSFERIDO: 'processo_transferido',
  DOCUMENTO_PENDENTE: 'documento_pendente',
  COMENTARIO_MENCAO: 'comentario_mencao',
  PROCESSO_FINALIZADO: 'processo_finalizado',
  PROCESSO_AVANCADO: 'processo_avancado',
};

const getDataHoraBrasilia = () => {
  const agora = new Date();
  
  const brasiliaTime = new Date(agora.getTime() - (3 * 60 * 60 * 1000));
  
  const year = brasiliaTime.getUTCFullYear();
  const month = String(brasiliaTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(brasiliaTime.getUTCDate()).padStart(2, '0');
  const hours = String(brasiliaTime.getUTCHours()).padStart(2, '0');
  const minutes = String(brasiliaTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(brasiliaTime.getUTCSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

const criarNotificacao = async (mensagem, tipo, usuarioId = null, dados = {}) => {
  try {
    console.log('📥 Criando notificação:', { mensagem, tipo, usuarioId, dados });
    
    const dataHoraBrasilia = getDataHoraBrasilia();
    console.log('🕐 Horário de Brasília:', dataHoraBrasilia);
    
    const resultado = await db.runAsync(
      `INSERT INTO notificacoes (mensagem, tipo, usuario_id, lida, dados, criado_em) 
       VALUES (?, ?, ?, 0, ?, ?)`,
      [mensagem, tipo || 'info', usuarioId || null, JSON.stringify(dados), dataHoraBrasilia]
    );
    
    if (resultado && resultado.id) {
      const notificacao = await db.getAsync(
        'SELECT * FROM notificacoes WHERE id = ?',
        [resultado.id]
      );
      
      console.log('✅ Notificação criada:', notificacao);
      
      if (global.wss) {
        notificarClientesWebSocket('nova_notificacao', notificacao);
      }
      
      return notificacao;
    }
    
  } catch (erro) {
    console.error('❌ Erro ao criar notificação:', erro);
    throw erro;
  }
};

const notificarProcessoCriado = async (processo, criadoPor) => {
  const admins = await db.allAsync(
    `SELECT id FROM usuarios WHERE role = 'admin' AND ativo = 1`
  );
  
  for (const admin of admins) {
    await criarNotificacao(
      `Nova solicitação criada: ${processo.nome_empresa}`,
      TIPOS_NOTIFICACAO.PROCESSO_CRIADO,
      admin.id,
      { processoId: processo.id, criadoPor }
    );
  }
};

const notificarProcessoExcluido = async (nomeEmpresa, excluidoPor) => {
  const admins = await db.allAsync(
    `SELECT id FROM usuarios WHERE role = 'admin' AND ativo = 1`
  );
  
  for (const admin of admins) {
    await criarNotificacao(
      `Processo excluído: ${nomeEmpresa}`,
      TIPOS_NOTIFICACAO.PROCESSO_EXCLUIDO,
      admin.id,
      { nomeEmpresa, excluidoPor }
    );
  }
};

const notificarProcessoAtrasado = async (processo, departamentoId) => {
  const gerente = await db.getAsync(
    `SELECT id FROM usuarios WHERE role = 'gerente' AND departamento_id = ? AND ativo = 1`,
    [departamentoId]
  );
  
  if (gerente) {
    await criarNotificacao(
      `⚠️ Processo atrasado: ${processo.nome_empresa} (${processo.dias_atraso} dias)`,
      TIPOS_NOTIFICACAO.PROCESSO_ATRASADO,
      gerente.id,
      { processoId: processo.id, diasAtraso: processo.dias_atraso }
    );
  }
};

const notificarProcessoParado = async (processo, departamentoId, diasParado) => {
  const gerente = await db.getAsync(
    `SELECT id FROM usuarios WHERE role = 'gerente' AND departamento_id = ? AND ativo = 1`,
    [departamentoId]
  );
  
  if (gerente) {
    await criarNotificacao(
      `⏸️ Processo sem movimento: ${processo.nome_empresa} (${diasParado} dias no departamento)`,
      TIPOS_NOTIFICACAO.PROCESSO_PARADO,
      gerente.id,
      { processoId: processo.id, diasParado }
    );
  }
};

const notificarProcessoTransferido = async (processo, departamentoDestinoId) => {
  const gerente = await db.getAsync(
    `SELECT id FROM usuarios WHERE role = 'gerente' AND departamento_id = ? AND ativo = 1`,
    [departamentoDestinoId]
  );
  
  if (gerente) {
    await criarNotificacao(
      `📥 Novo processo no seu departamento: ${processo.nome_empresa}`,
      TIPOS_NOTIFICACAO.PROCESSO_TRANSFERIDO,
      gerente.id,
      { processoId: processo.id }
    );
  }
};

const notificarProcessoFinalizado = async (processo) => {
  if (processo.departamentosEnvolvidos) {
    const departamentos = JSON.parse(processo.departamentosEnvolvidos);
    
    for (const deptId of departamentos) {
      const gerente = await db.getAsync(
        `SELECT id FROM usuarios WHERE role = 'gerente' AND departamento_id = ? AND ativo = 1`,
        [deptId]
      );
      
      if (gerente) {
        await criarNotificacao(
          `✅ Processo finalizado: ${processo.nome_empresa}`,
          TIPOS_NOTIFICACAO.PROCESSO_FINALIZADO,
          gerente.id,
          { processoId: processo.id }
        );
      }
    }
  }
};

const notificarMencaoComentario = async (comentario, mencionados) => {
  for (const nomeUsuario of mencionados) {
    const usuario = await db.getAsync(
      `SELECT id FROM usuarios WHERE nome = ? AND ativo = 1`,
      [nomeUsuario]
    );
    
    if (usuario) {
      await criarNotificacao(
        `💬 ${comentario.autor} mencionou você em um comentário`,
        TIPOS_NOTIFICACAO.COMENTARIO_MENCAO,
        usuario.id,
        { comentarioId: comentario.id, processoId: comentario.processo_id }
      );
    }
  }
};

const verificarProcessosEmRisco = async () => {
  console.log('🔍 Verificando processos em risco...');
  
  try {
    const processosAtrasados = await db.allAsync(`
      SELECT p.*, 
             julianday('now') - julianday(p.prazo_estimado) as dias_atraso,
             p.departamento_atual
      FROM processos p
      WHERE p.status = 'Em Andamento'
        AND julianday('now') > julianday(p.prazo_estimado)
        AND NOT EXISTS (
          SELECT 1 FROM notificacoes n
          WHERE n.dados LIKE '%"processoId":' || p.id || '%'
            AND n.tipo = 'processo_atrasado'
            AND date(n.criado_em) = date('now')
        )
    `);
    
    for (const processo of processosAtrasados) {
      await notificarProcessoAtrasado(processo, processo.departamento_atual);
    }
    
    const processosParados = await db.allAsync(`
      SELECT p.*, 
             julianday('now') - julianday(p.data_ultima_movimentacao) as dias_parado,
             p.departamento_atual
      FROM processos p
      WHERE p.status = 'Em Andamento'
        AND julianday('now') - julianday(p.data_ultima_movimentacao) >= 7
        AND NOT EXISTS (
          SELECT 1 FROM notificacoes n
          WHERE n.dados LIKE '%"processoId":' || p.id || '%'
            AND n.tipo = 'processo_parado'
            AND date(n.criado_em) = date('now')
        )
    `);
    
    for (const processo of processosParados) {
      await notificarProcessoParado(
        processo, 
        processo.departamento_atual, 
        Math.floor(processo.dias_parado)
      );
    }
    
    console.log(`✅ Verificação concluída: ${processosAtrasados.length} atrasados, ${processosParados.length} parados`);
    
  } catch (erro) {
    console.error('❌ Erro ao verificar processos:', erro);
  }
};

let intervaloVerificacao = null;

const iniciarVerificacaoPeriodica = () => {
  console.log('⏰ Iniciando verificação periódica de notificações...');
  
  if (intervaloVerificacao) {
    clearInterval(intervaloVerificacao);
  }
  
  verificarProcessosEmRisco();
  
  intervaloVerificacao = setInterval(verificarProcessosEmRisco, 60 * 60 * 1000);
  
  console.log('✅ Verificação periódica iniciada (a cada 1 hora)');
};

const notificarClientesWebSocket = (tipo, dados) => {
  if (global.wss) {
    global.wss.clients.forEach(client => {
      if (client.readyState === 1) { 
        client.send(JSON.stringify({
          tipo: tipo,
          dados: dados
        }));
      }
    });
  }
};

module.exports = {
  criarNotificacao,
  notificarClientesWebSocket,
  
  notificarProcessoCriado,
  notificarProcessoExcluido,
  notificarProcessoAtrasado,
  notificarProcessoParado,
  notificarProcessoTransferido,
  notificarProcessoFinalizado,
  notificarMencaoComentario,
  
  iniciarVerificacaoPeriodica,
  verificarProcessosEmRisco,
  
  TIPOS_NOTIFICACAO
};