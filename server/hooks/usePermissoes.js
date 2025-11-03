
export const usePermissoes = () => {
  const { usuarioLogado } = useContext(AuthContext); 
  
  const temPermissao = (permissao) => {
    if (!usuarioLogado) return false;
    
    const permissoesPorNivel = {
      admin: [
        'criar_processo', 'editar_processo', 'excluir_processo',
        'criar_departamento', 'editar_departamento', 'excluir_departamento',
        'criar_tag', 'editar_tag', 'excluir_tag', 'gerenciar_usuarios',
        'mover_processos', 'finalizar_processos', 'criar_questionarios'
      ],
      gerente: [
        'mover_processos_departamento', 'criar_questionarios', 'finalizar_processos'
      ],
      usuario: [
        'criar_processos', 'preencher_questionarios'
      ]
    };
    
    return permissoesPorNivel[usuarioLogado.nivel_acesso]?.includes(permissao) || false;
  };
  
  const podeVerDepartamento = (departamentoId) => {
    if (usuarioLogado?.nivel_acesso === 'admin') return true;
    if (usuarioLogado?.nivel_acesso === 'gerente') {
      return usuarioLogado.departamento_id === departamentoId;
    }
    return false;
  };
  
  return { temPermissao, podeVerDepartamento };
};


const BotaoMoverProcesso = ({ processo, onMover }) => {
  const { temPermissao, podeVerDepartamento } = usePermissoes();
  
  if (!temPermissao('mover_processos_departamento') || 
      !podeVerDepartamento(processo.departamentoAtual)) {
    return null;
  }
  
  return (
    <button
      onClick={onMover}
      className="bg-blue-500 text-white px-3 py-1 rounded text-sm"
    >
      Mover
    </button>
  );
};