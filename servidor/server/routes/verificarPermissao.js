const verificarPermissao = (permissaoRequerida, recursoCheck = null) => {
  return async (req, res, next) => {
    const usuarioId = req.usuario?.id;
    const usuario = await db.getAsync(
      'SELECT * FROM usuarios WHERE id = ?',
      [usuarioId]
    );

    await db.runAsync(
      `INSERT INTO auditoria_permissoes 
       (usuario_id, acao, recurso, resultado, motivo) 
       VALUES (?, ?, ?, ?, ?)`,
      [usuarioId, permissaoRequerida, recursoCheck, 'tentativa', null]
    );

    if (!usuario) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }

    if (usuario.nivel_acesso === 'admin') {
      return next(); 
    }

    if (usuario.nivel_acesso === 'gerente') {
      if (recursoCheck?.departamentoId && 
          recursoCheck.departamentoId !== usuario.departamento_id) {
        await db.runAsync(
          `UPDATE auditoria_permissoes SET resultado = ?, motivo = ? 
           WHERE usuario_id = ? ORDER BY id DESC LIMIT 1`,
          ['bloqueado', 'Acesso negado - departamento diferente', usuarioId]
        );
        return res.status(403).json({ 
          erro: 'Você só pode acessar seu departamento' 
        });
      }
    }

    if (usuario.nivel_acesso === 'usuario') {
      return res.status(403).json({ 
        erro: 'Usuários normais não têm essa permissão' 
      });
    }

    next();
  };
};

module.exports = verificarPermissao;