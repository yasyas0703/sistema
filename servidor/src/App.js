import React, { useState, useEffect, useRef } from "react";
import {
  FileText, Calendar, ArrowRight, X, Bell, Upload, MessageSquare,
  Download, Eye, ChevronDown, ChevronRight, Filter, Search,
  MoreVertical, Briefcase, Users, Calculator, FileCheck, Star,
  TrendingUp, Save, ArrowLeft, Info, Trash2, Edit, Check, Building,
  Plus, Clock, CheckCircle, AlertCircle, User, Play, Pause, RefreshCw
} from 'lucide-react';

const SERVIDOR_IP = "192.168.0.115";
const API_URL = process.env.REACT_APP_API_URL || `http://${SERVIDOR_IP}:3001/api`;
const WS_URL = `ws://${SERVIDOR_IP}:3002`;




console.log('🔧 Configuração:', { API_URL, WS_URL });


const BACKEND_BASE = API_URL.replace(/\/api\/?$/, '');

const resolveFileUrl = (url) => {
  if (!url) return null;

  console.log('🔍 URL original do documento:', url);

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }


  const cleanUrl = url.replace(/^\/+/, '');


  if (cleanUrl.startsWith('uploads/')) {
    const resolvedUrl = `${BACKEND_BASE}/${cleanUrl}`;
    console.log('📍 URL resolvida:', resolvedUrl);
    return resolvedUrl;
  }


  const resolvedUrl = `${BACKEND_BASE}/uploads/${cleanUrl}`;
  console.log('📍 URL resolvida do filename:', resolvedUrl);
  return resolvedUrl;
};



let ws = null;


const conectarWebSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('❌ Nenhum token disponível para WebSocket');
    return;
  }

  try {
    ws = new WebSocket(`${WS_URL}?token=${token}`);

    ws.onopen = () => {
      console.log('✅ Conectado ao servidor WebSocket');

      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ tipo: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = async (event) => {
      try {
        const { tipo, dados } = JSON.parse(event.data);


        if (tipo === 'processo_atualizado') {
          console.log('🔄 Processo atualizado por outro usuário');


          if (!showQuestionario && !showUploadDocumento) {
            await carregarProcessos();
            adicionarNotificacao(`Processo atualizado`, 'info');
          } else {
            console.log('⏸️ Adiando atualização (modal aberto)');
          }
        }
        else if (tipo === 'departamento_atualizado') {
          await carregarDepartamentos();
          adicionarNotificacao(`Departamento atualizado`, 'info');
        }
        else if (tipo === 'usuario_criado') {
          await carregarUsuarios();
        }
        else if (tipo === 'documento_adicionado') {

          const { processoId } = dados;
          await carregarDocumentos(processoId);
          adicionarNotificacao(`Novo documento adicionado`, 'info');
        }
        else if (tipo === 'comentario_adicionado') {

          const { processoId } = dados;
          await carregarComentarios(processoId);
        }
        else if (tipo === 'sessao_expirada') {
          localStorage.removeItem('token');
          setToken(null);
          setUsuarioLogado(null);
          setShowLogin(true);
          adicionarNotificacao('Sessão expirada', 'erro');
        }
        else if (tipo === 'nova_notificacao') {
          if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('nova_notificacao', { detail: dados }));
          }
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };

    ws.onclose = () => {
      console.log('❌ Desconectado do servidor. Reconectando em 3s...');
      setTimeout(conectarWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('❌ Erro WebSocket:', error);
    };
  } catch (error) {
    console.error('❌ Erro ao conectar WebSocket:', error);
  }
};

const fetchAutenticado = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {

    localStorage.removeItem('token');

    window.location.reload();
    throw new Error('Sessão expirada');
  }
  return response;
};


const api = {
  login: async (nome, senha) => {
    console.log('🔄 Tentando fazer login...', { nome });
    console.log('📍 URL:', `${API_URL}/usuarios/login`);

    try {
      const res = await fetch(`${API_URL}/usuarios/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, senha })
      });

      console.log('📡 Status da resposta:', res.status);

      const data = await res.json();
      console.log('📦 Dados recebidos:', data);

      if (res.ok && data.sucesso) {
        if (data.token) {

          localStorage.setItem('token', data.token);
          console.log('✅ Token salvo:', data.token.substring(0, 20) + '...');

          return {
            sucesso: true,
            usuario: data.usuario,
            token: data.token
          };
        } else {
          console.error('❌ Resposta sem token:', data);
          return {
            sucesso: false,
            mensagem: 'Resposta inválida do servidor'
          };
        }
      } else {
        return {
          sucesso: false,
          mensagem: data.erro || 'Erro ao fazer login'
        };
      }
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      return {
        sucesso: false,
        mensagem: 'Erro ao conectar com servidor: ' + error.message
      };
    }
  },
  getDocumentos: async (processoId) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/documentos?processoId=${processoId}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Erro ao carregar documentos:', error);
      return [];
    }
  },

  uploadDocumento: async (processoId, arquivo, tipoCategoria, perguntaId = null, departamentoId = null) => {
    try {
      console.log('📤 API Upload:', {
        processoId,
        arquivo: arquivo.name,
        tamanho: arquivo.size,
        tipo: arquivo.type,
        tipoCategoria,
        perguntaId,
        departamentoId
      });

      const formData = new FormData();
      formData.append('file', arquivo);
      formData.append('processoId', processoId);
      formData.append('tipoCategoria', tipoCategoria);

      if (perguntaId !== undefined && perguntaId !== null) {
        formData.append('perguntaId', String(perguntaId));
      }

      if (departamentoId) {
        formData.append('departamentoId', departamentoId);
      }

      const token = localStorage.getItem('token');

      console.log('📍 URL:', `${API_URL}/documentos`);
      console.log('🔑 Token:', token ? 'Presente' : 'Ausente');

      const res = await fetch(`${API_URL}/documentos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      console.log('📡 Status:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Erro HTTP:', res.status, errorText);
        throw new Error(`Erro HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log('✅ Resposta:', data);

      return data;
    } catch (error) {
      console.error('❌ Erro na API:', error);
      throw error;
    }
  },


  excluirDocumento: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/documentos/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },


  salvarQuestionario: async (departamentoId, perguntas) => {
    try {
      console.log(' Salvando questionário no banco...', {
        departamentoId,
        totalPerguntas: perguntas.length
      });

      const res = await fetchAutenticado(`${API_URL}/questionarios`, {
        method: 'POST',
        body: JSON.stringify({
          departamentoId,
          perguntas
        })
      });




      console.log('📡 Status da resposta:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Erro HTTP:', res.status, errorText);
        throw new Error(`Erro HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log('📦 Resposta do servidor:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar questionário:', error);
      throw error;
    }
  },

  atualizarUsuario: async (id, usuario) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/usuarios/${id}`, {
        method: 'PUT',
        body: JSON.stringify(usuario)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro HTTP ${res.status}: ${errorText}`);
      }

      return res.json();
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
      throw error;
    }
  },

  excluirUsuario: async (id) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/usuarios/${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Erro HTTP ${res.status}: ${errorText}`);
      }

      return res.json();
    } catch (error) {
      console.error('❌ Erro ao excluir usuário:', error);
      throw error;
    }
  },

  salvarDepartamento: async (departamento) => {
    const res = await fetchAutenticado(`${API_URL}/departamentos`, {
      method: 'POST',
      body: JSON.stringify(departamento)
    });
    return res.json();
  },

  atualizarDepartamento: async (id, departamento) => {
    const res = await fetchAutenticado(`${API_URL}/departamentos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(departamento)
    });
    return res.json();
  },

  excluirDepartamento: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/departamentos/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },


  salvarRespostasQuestionario: async (processoId, departamentoId, respostas) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/questionarios/salvar-respostas`, {
        method: 'POST',
        body: JSON.stringify({ processoId, departamentoId, respostas })
      });

      console.log('📡 Status da resposta:', res.status);
      const data = await res.json();
      console.log('📦 Resposta:', data);
      return data;
    } catch (error) {
      console.error('❌ Erro ao salvar respostas:', error);
      throw error;
    }
  },


  getRespostasQuestionario: async (processoId, departamentoId) => {
    const res = await fetchAutenticado(
      `${API_URL}/questionarios/respostas/${processoId}/${departamentoId}`
    );
    return res.json();
  },


  getUsuarioAtual: async () => {
    const res = await fetchAutenticado(`${API_URL}/usuarios/me`);
    return res.json();
  },

  getProcessos: async () => {
    const res = await fetchAutenticado(`${API_URL}/processos`);
    return res.json();
  },

  salvarProcesso: async (processo) => {
    const res = await fetchAutenticado(`${API_URL}/processos`, {
      method: 'POST',
      body: JSON.stringify(processo)
    });
    return res.json();
  },


  excluirProcesso: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/processos/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  criarUsuario: async (usuario) => {
    const res = await fetchAutenticado(`${API_URL}/usuarios`, {
      method: 'POST',
      body: JSON.stringify(usuario)
    });
    return res.json();
  },

  excluirUsuario: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/usuarios/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },


  getDepartamentos: async () => {
    try {
      const res = await fetchAutenticado(`${API_URL}/departamentos`);
      const data = await res.json();
      return data;
    } catch (error) {
      console.error('Erro ao carregar departamentos:', error);
      return [];
    }
  },

  getUsuarios: async () => {
    try {
      const res = await fetchAutenticado(`${API_URL}/usuarios`);
      return await res.json();
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      return { sucesso: false, usuarios: [] };
    }
  },

  criarUsuario: async (usuario) => {
    const res = await fetchAutenticado(`${API_URL}/usuarios`, {
      method: 'POST',
      body: JSON.stringify(usuario)
    });
    return res.json();
  },



  getTags: async () => {
    const res = await fetchAutenticado(`${API_URL}/tags`);
    return res.json();
  },

  salvarTag: async (tag) => {
    const res = await fetchAutenticado(`${API_URL}/tags`, {
      method: 'POST',
      body: JSON.stringify(tag)
    });
    return res.json();
  },

  atualizarTag: async (id, tag) => {
    const res = await fetchAutenticado(`${API_URL}/tags/${id}`, {
      method: 'PUT',
      body: JSON.stringify(tag)
    });
    return res.json();
  },

  excluirTag: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/tags/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },
  getComentarios: async (processoId) => {
    try {
      const res = await fetchAutenticado(`${API_URL}/comentarios?processoId=${processoId}`);
      const data = await res.json();


      return Array.isArray(data) ? data : (data.comentarios || []);
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
      return [];
    }
  },


  salvarComentario: async (comentario) => {
    try {
      console.log('🔐 Token disponível:', !!localStorage.getItem('token'));
      console.log('📤 Enviando comentário:', comentario);

      const res = await fetchAutenticado(`${API_URL}/comentarios`, {
        method: 'POST',
        body: JSON.stringify(comentario)
      });

      console.log('📡 Status da resposta:', res.status);

      if (!res.ok) {
        const errorText = await res.text();
        console.error('❌ Erro HTTP:', res.status, errorText);
        throw new Error(`Erro HTTP ${res.status}: ${errorText}`);
      }

      const data = await res.json();
      console.log('📦 Dados retornados:', data);
      return data;

    } catch (error) {
      console.error('❌ Erro na requisição salvarComentario:', error);
      throw error;
    }
  },

  atualizarComentario: async (id, texto) => {
    const res = await fetchAutenticado(`${API_URL}/comentarios/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ texto })
    });
    return res.json();
  },

  excluirComentario: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/comentarios/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },


  salvarTemplate: async (template) => {
    const res = await fetchAutenticado(`${API_URL}/templates`, {
      method: 'POST',
      body: JSON.stringify(template)
    });
    return res.json();
  },

  getTemplates: async () => {
    const res = await fetchAutenticado(`${API_URL}/templates`);
    return res.json();
  },

  atualizarTemplate: async (id, template) => {
    const res = await fetchAutenticado(`${API_URL}/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(template)
    });
    return res.json();
  },


  excluirTemplate: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/templates/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  },

  getEmpresas: async () => {
    try {
      console.log('📡 Chamando API de empresas...');
      const res = await fetchAutenticado(`${API_URL}/empresas`);
      const data = await res.json();
      console.log('📦 Resposta bruta da API empresas:', data);


      if (Array.isArray(data)) {
        return { sucesso: true, empresas: data };
      }
      if (data && data.sucesso && data.empresas) {
        return { sucesso: true, empresas: data.empresas };
      }

      return { sucesso: true, empresas: data.empresas || [] };
    } catch (error) {
      console.error('❌ Erro na API getEmpresas:', error);
      return { sucesso: false, empresas: [] };
    }
  },


  getEmpresa: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/empresas/${id}`);
    return res.json();
  },

  salvarEmpresa: async (empresa) => {
    const res = await fetchAutenticado(`${API_URL}/empresas`, {
      method: 'POST',
      body: JSON.stringify(empresa)
    });
    return res.json();
  },

  atualizarEmpresa: async (id, empresa) => {
    const res = await fetchAutenticado(`${API_URL}/empresas/${id}`, {
      method: 'PUT',
      body: JSON.stringify(empresa)
    });
    return res.json();
  },

  excluirEmpresa: async (id) => {
    const res = await fetchAutenticado(`${API_URL}/empresas/${id}`, {
      method: 'DELETE'
    });
    return res.json();
  }
};





const SistemaAberturaEmpresas = () => {
  const [showNovaEmpresa, setShowNovaEmpresa] = useState(false);
  const [processos, setProcessos] = useState([]);
  const [showQuestionario, setShowQuestionario] = useState(null);
  const [showVisualizacao, setShowVisualizacao] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [draggedItem, setDraggedItem] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busca, setBusca] = useState("");
  const [notificacoes, setNotificacoes] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);


  useEffect(() => {
    const salvas = localStorage.getItem('notificacoes');
    if (salvas) {
      try {
        const lista = JSON.parse(salvas);
        setNotificacoes(lista);
        console.log('📥 Notificações restauradas do localStorage:', lista.length);
      } catch (e) {
        console.error('Erro ao ler notificações do localStorage:', e);
      }
    }
  }, []);


  useEffect(() => {
    try {
      localStorage.setItem('notificacoes', JSON.stringify(notificacoes));
    } catch (e) {
      console.error('Erro ao salvar notificações no localStorage:', e);
    }
  }, [notificacoes]);


  const [departamentosCriados, setDepartamentosCriados] = useState([]);
  const [showCriarDepartamento, setShowCriarDepartamento] = useState(false);

  const [editandoDepartamento, setEditandoDepartamento] = useState(null);
  const [comentarios, setComentarios] = useState({});
  const [showComentarios, setShowComentarios] = useState(null);
  const [showConfirmacaoExclusao, setShowConfirmacaoExclusao] = useState(null);
  const [novoComentario, setNovoComentario] = useState("");

  const [documentos, setDocumentos] = useState({});
  const [uploading, setUploading] = useState(false);
  const [previewDocumento, setPreviewDocumento] = useState(null);
  const [showGaleria, setShowGaleria] = useState(null);
  const [documentosObrigatorios, setDocumentosObrigatorios] = useState([]);
  const [showUploadDocumento, setShowUploadDocumento] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));


  const [excluindoDocumento, setExcluindoDocumento] = useState({});
  const [showSelecionarDepartamentoDestino, setShowSelecionarDepartamentoDestino] = useState(null);
  const [showCriarQuestionario, setShowCriarQuestionario] = useState(null);
  const [showQuestionarioSolicitacao, setShowQuestionarioSolicitacao] = useState(null);
  const [nomeServico, setNomeServico] = useState("");

  const [templatesDisponiveis, setTemplatesDisponiveis] = useState([]);
  const [showSelecionarTemplate, setShowSelecionarTemplate] = useState(false);
  const [showCriarTemplate, setShowCriarTemplate] = useState(false);
  const [filtroDepartamento, setFiltroDepartamento] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [showCadastrarEmpresa, setShowCadastrarEmpresa] = useState(false);
  const [showListarEmpresas, setShowListarEmpresas] = useState(null); // null, 'cadastradas' ou 'nao-cadastradas'
  const [empresaSelecionadaSolicitacao, setEmpresaSelecionadaSolicitacao] = useState(null);
  const [editandoEmpresa, setEditandoEmpresa] = useState(null);
  const [empresaSelecionada, setEmpresaSelecionada] = useState(null);


  const normalizarQuestionarios = (qpd) => {
    if (!qpd) return {};
    try {
      return Object.fromEntries(
        Object.entries(qpd).map(([k, v]) => [String(k), v])
      );
    } catch (e) {
      console.error("Erro ao normalizar questionarios:", e, qpd);
      return qpd || {};
    }
  };




  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        console.log('🔔 Permissão de notificação:', permission);
      });
    }
  }, []);


  const mostrarNotificacaoNativa = (titulo, mensagem, dados = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(titulo, {
        body: mensagem,
        icon: '/triar.png',
        badge: '/triar.png',
        tag: dados.processoId ? `processo-${dados.processoId}` : undefined,
        requireInteraction: false,
        silent: false
      });

      notification.onclick = () => {
        window.focus();
        notification.close();


        if (dados.processoId) {
          const processo = processos.find(p => p.id === dados.processoId);
          if (processo) {
            setShowQuestionario({
              processoId: processo.id,
              departamento: processo.departamentoAtual
            });
          }
        }
      };
    }
  };


  useEffect(() => {
    const handler = (e) => {
      const dados = e.detail;
      console.log('🔔 Nova notificação recebida:', dados);

      const nova = {
        id: dados.id || Date.now(),
        mensagem: dados.mensagem,
        tipo: dados.tipo || 'info',
        lida: !!dados.lida,
        timestamp: formatarDataHora(dados.criado_em || new Date()),
        dados: typeof dados.dados === 'string' ? JSON.parse(dados.dados) : dados.dados
      };


      setNotificacoes(prev => [nova, ...prev.filter(n => n.id !== nova.id)].slice(0, 50));


      mostrarNotificacaoNativa(
        'Sistema de Abertura',
        nova.mensagem,
        nova.dados
      );
    };

    window.addEventListener('nova_notificacao', handler);
    return () => window.removeEventListener('nova_notificacao', handler);
  }, []);


  useEffect(() => {
    const verificarSessao = async () => {
      const tokenSalvo = localStorage.getItem('token');

      if (tokenSalvo) {
        try {
          const response = await fetchAutenticado(`${API_URL}/usuarios/me`);
          const data = await response.json();

          if (data.sucesso) {
            setUsuarioLogado(data.usuario);
            setToken(tokenSalvo);
            setShowLogin(false);
            conectarWebSocket();


            await carregarEmpresas();

            await carregarDepartamentos();
            await carregarTemplates();
            await carregarDadosIniciais();
          }
        } catch (error) {
          console.error('Erro ao verificar sessão:', error);
        }
      }
    };

    verificarSessao();
  }, []);

  const [usuarios, setUsuarios] = useState([
    {
      id: 1,
      nome: "Admin",
      senha: "admin123",
      role: "admin",
      ativo: true,
      criadoEm: new Date(),
      permissoes: [
        "criar_processo",
        "editar_processo",
        "excluir_processo",
        "criar_departamento",
        "editar_departamento",
        "excluir_departamento",
        "criar_tag",
        "editar_tag",
        "excluir_tag",
        "gerenciar_usuarios"
      ]
    }
  ]);

  const [usuarioLogado, setUsuarioLogado] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [showGerenciarUsuarios, setShowGerenciarUsuarios] = useState(false);



  const [showConfirmacao, setShowConfirmacao] = useState(null);
  const [showAlerta, setShowAlerta] = useState(null);

  const [showSelecionarTags, setShowSelecionarTags] = useState(null);
  const [showMenuDepartamento, setShowMenuDepartamento] = useState(null);

  const excluirProcesso = async (processoId) => {
    const processo = processos.find(p => p.id === processoId);


    if (usuarioLogado.role === "gerente") {
      if (processo.departamentoAtual !== usuarioLogado.departamento_id) {
        await mostrarAlerta(
          "Sem Permissão",
          "Você só pode excluir processos do seu departamento",
          "erro"
        );
        return;
      }
    }


    if (usuarioLogado.role !== "admin" && usuarioLogado.role !== "gerente") {
      await mostrarAlerta(
        "Sem Permissão",
        "Você não tem permissão para excluir processos",
        "erro"
      );
      return;
    }


    const processosNoDept = processos.filter(
      p => p.departamentoAtual === processoId && p.status === "Em Andamento"
    );

    const confirmou = await mostrarConfirmacao({
      tipo: "processo",
      nome: processo.nomeEmpresa,
      titulo: "Excluir Processo",
      mensagem: `Tem certeza que deseja excluir o processo "${processo.nomeEmpresa}"?\n\nEsta ação não pode ser desfeita e todos os dados serão perdidos.`,
      textoConfirmar: "Sim, Excluir"
    });

    if (!confirmou) {
      console.log('ℹ️ Exclusão cancelada pelo usuário');
      return;
    }

    try {
      console.log('🗑️ Iniciando exclusão do processo:', processoId);
      const resultado = await api.excluirProcesso(processoId);

      if (resultado.sucesso) {
        await carregarProcessos();

        const novosComentarios = { ...comentarios };
        delete novosComentarios[processoId];
        setComentarios(novosComentarios);

        const novosDocumentos = { ...documentos };
        delete novosDocumentos[processoId];
        setDocumentos(novosDocumentos);

        adicionarNotificacao("Processo excluído com sucesso", "sucesso");
      } else {
        adicionarNotificacao(`Erro ao excluir: ${resultado.erro}`, "erro");
      }
    } catch (error) {
      console.error('❌ Erro ao excluir processo:', error);
      adicionarNotificacao(`Erro: ${error.message}`, "erro");
    }
  };

  const [tags, setTags] = useState([
    { id: 1, nome: "Urgente", cor: "bg-red-500", texto: "text-white" },
    {
      id: 2,
      nome: "Aguardando Cliente",
      cor: "bg-yellow-500",
      texto: "text-white",
    },
    { id: 3, nome: "Revisão", cor: "bg-purple-500", texto: "text-white" },
    {
      id: 4,
      nome: "Documentação Pendente",
      cor: "bg-orange-500",
      texto: "text-white",
    },
  ]);
  const [showGerenciarTags, setShowGerenciarTags] = useState(false);
  const [filtroTags, setFiltroTags] = useState([]);

  const [analytics, setAnalytics] = useState({
    tempoMedioPorDepartamento: {},
    taxaConclusaoMensal: {},
    gargalos: [],
    performanceDepartamentos: {},
    previsaoConclusao: {},
    metricasGerais: {},
  });
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [periodoAnalytics, setPeriodoAnalytics] = useState("30d");


  const coresDisponiveis = [
    {
      nome: "Ciano",
      gradient: "from-cyan-400 to-blue-500",
      solida: "bg-cyan-500",
    },
    {
      nome: "Azul",
      gradient: "from-blue-500 to-indigo-600",
      solida: "bg-blue-600",
    },
    {
      nome: "Rosa",
      gradient: "from-purple-500 to-pink-600",
      solida: "bg-purple-600",
    },
    {
      nome: "Verde",
      gradient: "from-green-500 to-emerald-600",
      solida: "bg-green-600",
    },
    {
      nome: "Laranja",
      gradient: "from-orange-500 to-red-600",
      solida: "bg-orange-600",
    },
    {
      nome: "Amarelo",
      gradient: "from-yellow-500 to-amber-600",
      solida: "bg-yellow-600",
    },
  ];


  const iconesDisponiveis = [
    { nome: "Documento", componente: FileText },
    { nome: "Usuários", componente: Users },
    { nome: "Calculadora", componente: Calculator },
    { nome: "Verificação", componente: FileCheck },
    { nome: "Maleta", componente: Briefcase },
    { nome: "Editar", componente: Edit },
  ];







  const formatarData = (data) => {
    if (!data) return "N/A";

    try {
      if (data instanceof Date) {
        return data.toLocaleDateString("pt-BR");
      }
      if (typeof data === "string") {
        return new Date(data).toLocaleDateString("pt-BR");
      }
      if (typeof data === "number") {
        return new Date(data).toLocaleDateString("pt-BR");
      }
      return "N/A";
    } catch (error) {
      console.error("Erro ao formatar data:", error);
      return "N/A";
    }
  };
  const formatarDataHora = (data) => {
    if (!data) return "N/A";

    try {
      let dataObj;

      if (data instanceof Date) {
        dataObj = data;
      } else if (typeof data === "string") {
        dataObj = new Date(data);
      } else if (typeof data === "number") {
        dataObj = new Date(data);
      } else {
        return "N/A";
      }


      const options = {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };

      return dataObj.toLocaleString('pt-BR', options);
    } catch (error) {
      console.error("Erro ao formatar data/hora:", error);
      return "N/A";
    }
  };
  const criarNovaSolicitacao = async (dadosEmpresa) => {
    console.log('Criando solicitação:', dadosEmpresa);

    if (!temPermissao("criar_processo")) {
      await mostrarAlerta("Sem Permissão", "Você não tem permissão para criar processos", "erro");
      return;
    }

    const dataAtual = new Date();
    const prazoEstimado = new Date(dataAtual);
    prazoEstimado.setDate(prazoEstimado.getDate() + 15);


    const fluxoDepartamentos = dadosEmpresa.fluxoDepartamentos;
    const departamentoAtualIndex = 0;
    const departamentoAtualId = fluxoDepartamentos[0];

    const novoProcesso = {
      nomeEmpresa: dadosEmpresa.nomeEmpresa,
      nomeServico: dadosEmpresa.nomeServico,
      cliente: dadosEmpresa.cliente || "",
      email: dadosEmpresa.email || "",
      telefone: dadosEmpresa.telefone || "",
      empresaId: empresaSelecionadaSolicitacao?.id || null,


      fluxoDepartamentos: fluxoDepartamentos,
      departamentoAtualIndex: departamentoAtualIndex,
      departamentoAtual: departamentoAtualId,

      status: "Em Andamento",
      prioridade: "MEDIA",
      dataInicio: dataAtual.toISOString(),
      prazoEstimado: prazoEstimado.toISOString(),
      progresso: 0,


      questionariosPorDepartamento: Object.fromEntries(
        Object.entries(dadosEmpresa.questionariosPorDepartamento || {}).map(
          ([k, v]) => [String(k), v]
        )
      ),



      respostasHistorico: {},

      historico: [
        {
          departamento: "Sistema",
          data: dataAtual.toISOString(),
          dataTimestamp: dataAtual.getTime(),
          acao: `Solicitação criada: ${dadosEmpresa.nomeServico}`,
          responsavel: usuarioLogado.nome,
          tipo: "inicio",
        },
      ],
      tags: [],
      observacoes: "",
      criadoPor: usuarioLogado.id
    };

    try {
      console.log('🚀 Criando solicitação:', novoProcesso);

      const resultado = await api.salvarProcesso(novoProcesso);

      if (resultado.sucesso) {

        if (resultado.processo) {
          setProcessos(prev => [...prev, resultado.processo]);

          console.log('✅ Processo adicionado ao estado:', resultado.processo);
        }

        await carregarProcessos();

        setShowNovaEmpresa(false);
        adicionarNotificacao(
          `✅ Solicitação "${dadosEmpresa.nomeEmpresa}" criada!`,
          "sucesso"
        );
      }
    } catch (error) {
      console.error('❌ Erro:', error);
      await mostrarAlerta("Erro", error.message, "erro");
    }
  };



  const salvarComoTemplate = async (dadosSolicitacao) => {
    if (!temPermissao("criar_departamento")) {
      await mostrarAlerta("Sem Permissão", "Apenas admins podem criar templates", "erro");
      return;
    }

    const nomeTemplate = dadosSolicitacao.nomeServico;
    if (!nomeTemplate?.trim()) {
      await mostrarAlerta("Erro", "Nome do serviço não encontrado", "erro");
      return;
    }

    try {
      console.log(' Salvando template:', {
        nome: nomeTemplate,
        fluxo: dadosSolicitacao.fluxoDepartamentos,
        questionarios: dadosSolicitacao.questionariosPorDepartamento
      });

      const template = {
        nome: nomeTemplate,
        descricao: `Template para ${nomeTemplate}`,
        fluxo_departamentos: JSON.stringify(dadosSolicitacao.fluxoDepartamentos),
        questionarios_por_departamento: JSON.stringify(dadosSolicitacao.questionariosPorDepartamento),
        criado_por: usuarioLogado.id
      };

      const resultado = await api.salvarTemplate(template);

      if (resultado.sucesso) {
        await carregarTemplates();
        adicionarNotificacao(`Template "${nomeTemplate}" criado com sucesso!`, "sucesso");
      } else {
        await mostrarAlerta("Erro", resultado.erro || "Erro ao salvar template", "erro");
      }
    } catch (error) {
      console.error('❌ Erro ao salvar template:', error);
      await mostrarAlerta("Erro", error.message, "erro");
    }
  };

  const carregarProcessos = async () => {
    try {
      console.log('🔄 Carregando processos do banco...');
      const processosData = await api.getProcessos();

      console.log('📦 DEBUG - Estrutura completa do processo 168:', {
        processo168: processosData.find(p => p.id === 168),
        todosCampos: Object.keys(processosData.find(p => p.id === 168) || {})
      });

      console.log('📦 Processos retornados:', processosData);

      if (processosData && Array.isArray(processosData)) {
        const processosComEstrutura = processosData.map((processo) => {
          let questionarioSolicitacao = [];
          let questionariosPorDepartamento = {};
          let respostasHistorico = {};

          try {
            if (processo.questionario) {
              questionarioSolicitacao =
                typeof processo.questionario === "string"
                  ? JSON.parse(processo.questionario)
                  : processo.questionario;
            }
            else if (processo.questionario_solicitacao) {
              const raw = processo.questionario_solicitacao;
              questionarioSolicitacao =
                typeof raw === "string"
                  ? JSON.parse(raw)
                  : Array.isArray(raw)
                    ? raw
                    : [];
            }
            else if (processo.questionarioSolicitacao) {
              const raw = processo.questionarioSolicitacao;
              questionarioSolicitacao =
                typeof raw === "string"
                  ? JSON.parse(raw)
                  : Array.isArray(raw)
                    ? raw
                    : [];
            }
          } catch (error) {
            console.error("❌ Erro ao parsear questionarioSolicitacao:", error);
            questionarioSolicitacao = [];
          }

          try {
            if (processo.respostas_historico) {
              const raw = processo.respostas_historico;
              respostasHistorico =
                typeof raw === "string"
                  ? JSON.parse(raw)
                  : typeof raw === "object"
                    ? raw
                    : {};
            } else if (processo.respostasHistorico) {
              const raw = processo.respostasHistorico;
              respostasHistorico =
                typeof raw === "string"
                  ? JSON.parse(raw)
                  : typeof raw === "object"
                    ? raw
                    : {};
            }
          } catch (error) {
            console.error("❌ Erro ao parsear respostasHistorico:", error);
            respostasHistorico = {};
          }

          try {
            if (processo.questionarios_por_departamento) {
              const raw = processo.questionarios_por_departamento;
              questionariosPorDepartamento =
                typeof raw === "string"
                  ? JSON.parse(raw)
                  : typeof raw === "object"
                    ? raw
                    : {};
            } else if (processo.questionariosPorDepartamento) {
              const raw = processo.questionariosPorDepartamento;
              questionariosPorDepartamento =
                typeof raw === "string"
                  ? JSON.parse(raw)
                  : typeof raw === "object"
                    ? raw
                    : {};
            } else if (processo.questionario && typeof processo.questionario === "object") {
              questionariosPorDepartamento = processo.questionario;
            }
          } catch (error) {
            console.error("❌ Erro ao parsear questionariosPorDepartamento:", error);
            questionariosPorDepartamento = {};
          }


          const normalizado = {};
          Object.entries(questionariosPorDepartamento || {}).forEach(([k, v]) => {
            normalizado[String(k)] = v;
          });
          questionariosPorDepartamento = normalizado;

          console.log(`📋 Processo "${processo.nome_empresa}":`, {
            questionarioSolicitacao: questionarioSolicitacao.length,
            respostasHistorico: Object.keys(respostasHistorico).length,
            questionariosPorDepartamento: Object.keys(questionariosPorDepartamento).length,
          });

          return {
            ...processo,
            nomeEmpresa: processo.nome_empresa || processo.nomeEmpresa || "Empresa sem nome",
            questionarioSolicitacao,
            questionariosPorDepartamento,
            respostasHistorico,
            cliente: processo.cliente || "",
            email: processo.email || "",
            telefone: processo.telefone || "",
            departamentoAtual:
              processo.departamento_atual || processo.departamentoAtual || null,
            status: processo.status || "Em Andamento",
            prioridade: processo.prioridade || "MEDIA",
            dataInicio: processo.data_inicio || processo.dataInicio || new Date().toISOString(),
            prazoEstimado:
              processo.prazo_estimado || processo.prazoEstimado || new Date().toISOString(),
            progresso: processo.progresso || 0,
            historico: processo.historico || [],
            tags: processo.tags || [],
            observacoes: processo.observacoes || "",
          };
        });

        console.log("✅ Processos formatados:", processosComEstrutura);
        setProcessos(processosComEstrutura);
        return processosComEstrutura;
      } else {
        console.warn("⚠️ Nenhum processo retornado");
        setProcessos([]);
        return [];
      }
    } catch (error) {
      console.error("❌ Erro ao carregar processos:", error);
      adicionarNotificacao("Erro ao carregar processos: " + error.message, "erro");
      return [];
    }
  };
  const carregarEmpresas = async () => {
    try {
      console.log('🔄 Carregando empresas...');
      console.log('📍 URL da API:', `${API_URL}/empresas`);

      const response = await fetchAutenticado(`${API_URL}/empresas`);

      console.log('📡 Status da resposta:', response.status);

      const dados = await response.json();
      console.log('📦 Dados recebidos da API:', dados);

      if (dados.sucesso && Array.isArray(dados.empresas)) {
        console.log('✅ Empresas válidas:', dados.empresas.length);
        setEmpresas(dados.empresas);
        return dados.empresas;
      } else {
        console.error('❌ Formato de resposta inválido:', dados);
        setEmpresas([]);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao carregar empresas:', error);
      adicionarNotificacao('Erro ao carregar empresas: ' + error.message, 'erro');
      setEmpresas([]);
      return [];
    }
  };

  const carregarDepartamentos = async () => {
    try {
      console.log('🔄 Carregando departamentos do banco...');
      const departamentosData = await api.getDepartamentos();

      console.log('📦 Departamentos retornados:', departamentosData);

      if (departamentosData && Array.isArray(departamentosData)) {
        const departamentosLocal = departamentosData.map((d) => {
          const iconeEncontrado = iconesDisponiveis.find((i) => i.nome === d.icone) || iconesDisponiveis[0];
          return {
            ...d,
            icone: iconeEncontrado.componente,
            ordem: d.ordem || 0
          };
        });

        const departamentosOrdenados = departamentosLocal.sort((a, b) => {
          if (a.ordem !== b.ordem) {
            return a.ordem - b.ordem;
          }
          return a.id - b.id;
        });

        setDepartamentosCriados(departamentosOrdenados);
        return departamentosOrdenados;
      } else {
        console.warn('⚠️ Nenhum departamento retornado');
        setDepartamentosCriados([]);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao carregar departamentos:', error);
      adicionarNotificacao('Erro ao carregar departamentos: ' + error.message, 'erro');
      return [];
    }
  };
  const carregarDadosIniciais = async () => {
    try {
      console.log('🔄 Carregando todos os dados do banco...');

      const departamentos = await carregarDepartamentos();
      console.log('✅ Departamentos:', departamentos.length);



      const processos = await carregarProcessos();
      console.log('✅ Processos:', processos.length);

      const tags = await carregarTags();
      console.log('✅ Tags:', tags.length);

      for (const processo of processos) {
        await carregarComentarios(processo.id);
      }
      console.log('✅ Comentários carregados');

      for (const processo of processos) {
        await carregarDocumentos(processo.id);
      }
      console.log('✅ Documentos carregados');

      if (usuarioLogado?.role === 'admin') {
        const usuariosData = await api.getUsuarios();
        if (usuariosData && usuariosData.sucesso) {
          setUsuarios(usuariosData.usuarios);
          console.log('✅ Usuários:', usuariosData.usuarios.length);
        }
      }


      await carregarNotificacoes();
    } catch (error) {

    }
  };

  const carregarNotificacoes = async () => {
    try {
      console.log('🔄 Carregando notificações do servidor...');
      const token = localStorage.getItem('token');
      if (!token) {
        console.warn('⚠️ Sem token - não é possível carregar notificações');
        return;
      }

      const res = await fetch(`${API_URL}/notificacoes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        console.error('❌ Erro ao buscar notificações:', await res.text());
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        const carregadas = data.map(n => ({
          id: n.id,
          mensagem: n.mensagem,
          tipo: n.tipo,
          lida: !!n.lida,
          timestamp: formatarDataHora(n.criado_em || n.timestamp || new Date())
        }));

        setNotificacoes(carregadas);
        console.log('✅ Notificações carregadas:', carregadas.length);
      }
    } catch (error) {
      console.error('❌ Erro carregarNotificacoes:', error);
    }
  };

  useEffect(() => {
    const handler = (e) => {
      const dados = e.detail;
      console.log('🔔 Evento nova_notificacao recebido via window:', dados);
      const nova = {
        id: dados.id || Date.now(),
        mensagem: dados.mensagem,
        tipo: dados.tipo || 'info',
        lida: !!dados.lida,
        timestamp: formatarDataHora(dados.criado_em || dados.timestamp || new Date())
      };
      setNotificacoes(prev => [nova, ...prev.filter(n => n.id !== nova.id)].slice(0, 10));
    };

    window.addEventListener('nova_notificacao', handler);
    return () => window.removeEventListener('nova_notificacao', handler);
  }, []);


  useEffect(() => {
    console.log('📊 Estado atual:');
    console.log('   Departamentos:', departamentosCriados.length);
    console.log('   Processos:', processos.length);

    departamentosCriados.forEach(dept => {
      const processosNoDept = processos.filter(p => p.departamentoAtual === dept.id);
      console.log(`   ${dept.nome} (ID ${dept.id}):`, processosNoDept.length, 'processos');
      processosNoDept.forEach(p => {
        console.log(`      - ${p.nomeEmpresa} (ID ${p.id})`);
      });
    });

    const processosSemDept = processos.filter(p => {
      return p.departamentoAtual === null ||
        p.departamentoAtual === undefined ||
        !departamentosCriados.find(d => d.id === p.departamentoAtual);
    });

    if (processosSemDept.length > 0) {
      console.warn('⚠️ Processos sem departamento válido:', processosSemDept.length);
      processosSemDept.forEach(p => {
        console.warn(`   - ${p.nomeEmpresa} (ID ${p.id}, Dept: ${p.departamentoAtual})`);
      });
    }
  }, [departamentosCriados, processos]);


  const debugGaleria = (departamento) => {
    console.log('🔍 Debug Galeria:');
    console.log('   Departamento:', departamento);
    console.log('   Processos:', processos.length);
    console.log('   Documentos:', documentos);

    const documentosDoDepartamento = processos.flatMap((processo) =>
      (documentos[processo.id] || [])
        .filter((doc) => {
          if (String(doc.departamentoId) === String(departamento.id)) return true;

          if (doc.perguntaId && Array.isArray(departamento.questionario)) {
            return departamento.questionario.some((p) => p.id === doc.perguntaId);
          }

          return false;
        })
        .map((doc) => ({ ...doc, processo }))
    );

    console.log('   Documentos do departamento:', documentosDoDepartamento);

    const grupos = {};
    documentosDoDepartamento.forEach((doc) => {
      if (!grupos[doc.tipoCategoria]) {
        grupos[doc.tipoCategoria] = [];
      }
      grupos[doc.tipoCategoria].push(doc);
    });

    console.log('   Agrupados por tipo:', grupos);

    return documentosDoDepartamento;
  };


  const temPermissao = (permissao, contexto = {}) => {
    console.log("🔐 Verificando permissão:", {
      permissao,
      usuarioRole: usuarioLogado?.role,
      usuarioDept: usuarioLogado?.departamento_id,
      contexto,
    });

    if (!usuarioLogado) {
      console.warn('❌ Nenhum usuário logado');
      return false;
    }

    if (usuarioLogado.role === "admin") {
      console.log('✅ Admin tem todas as permissões');
      return true;
    }

    if (usuarioLogado.role === "gerente") {
      if (permissao === "criar_processo") {
        if (contexto.fluxoDepartamentos) {
          return validarFluxoParaGerente(contexto.fluxoDepartamentos);
        }
        return true;
      }

      if (["criar_tag", "editar_tag", "excluir_tag"].includes(permissao)) return true;

      if (permissao === "mover_processo") {
        const podeMover = contexto.departamentoOrigemId === usuarioLogado.departamento_id;
        console.log("📋 Verificação mover_processo:", {
          departamentoOrigemId: contexto.departamentoOrigemId,
          usuarioDept: usuarioLogado.departamento_id,
          resultado: podeMover ? '✅ PODE' : '❌ NÃO PODE'
        });
        return podeMover;
      }

      if (permissao === "editar_processo") {
        return contexto.departamentoAtual === usuarioLogado.departamento_id;
      }

      if (permissao === "excluir_processo") {
        const podeExcluir = contexto.departamentoAtual === usuarioLogado.departamento_id;
        console.log("🗑️ Verificação excluir_processo:", {
          departamentoAtual: contexto.departamentoAtual,
          usuarioDept: usuarioLogado.departamento_id,
          resultado: podeExcluir ? '✅ PODE' : '❌ NÃO PODE'
        });
        return podeExcluir;
      }

      if (["upload_documento", "adicionar_comentario", "responder_questionario"].includes(permissao)) {
        return contexto.departamentoAtual === usuarioLogado.departamento_id;
      }
    }

    if (usuarioLogado.role === "comum" || usuarioLogado.role === "normal") {
      if (["criar_tag", "editar_tag", "excluir_tag"].includes(permissao)) return true;

      const permissoesComuns = [
        "responder_questionario",
        "upload_documento",
        "adicionar_comentario"
      ];
      return permissoesComuns.includes(permissao);
    }

    return false;
  };


  const usarQuestionarioSolicitacaoNoDep = async (processoId, departamentoId) => {
    try {
      const processo = processos.find(p => p.id === processoId);
      const dept = departamentosCriados.find(d => d.id === departamentoId);

      if (!processo || !dept) return;

      const respostasHistoricoAtualizado = {
        ...processo.respostasHistorico,
        [departamentoId]: {
          questionario: processo.questionarioSolicitacao || [],
          respostas: {},
          respondidoEm: null,
          respondidoPor: null,
          departamentoId: departamentoId,
          departamentoNome: dept.nome
        }
      };

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...processo,
          respostasHistorico: respostasHistoricoAtualizado
        })
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        await carregarProcessos();
        setShowQuestionario({
          processoId: processoId,
          departamento: departamentoId
        });
        adicionarNotificacao("Questionário da solicitação pronto para responder!", "sucesso");
      }
    } catch (error) {
      console.error('❌ Erro:', error);
      adicionarNotificacao(`Erro: ${error.message}`, "erro");
    }
  };


  const alterarPrioridade = (processoId, novaPrioridade) => {
    setProcessos(
      processos.map((processo) => {
        if (processo.id === processoId) {
          const dataAtual = new Date();
          return {
            ...processo,
            prioridade: novaPrioridade,
            historico: [
              ...processo.historico,
              {
                departamento: "Sistema",
                data: dataAtual,
                dataTimestamp: dataAtual.getTime(),
                acao: `Prioridade alterada para ${novaPrioridade}`,
                responsavel: "Sistema",
                tipo: "alteracao",
              },
            ],
          };
        }
        return processo;
      })
    );
    adicionarNotificacao(`Prioridade alterada para ${novaPrioridade}`, "info");
  };

  const avancarProcesso = async (processoId, departamentoDestinoId) => {
    try {
      const processo = processos.find(p => p.id === processoId);
      const deptDestino = departamentosCriados.find(d => d.id === departamentoDestinoId);
      const deptOrigem = departamentosCriados.find(d => d.id === processo.departamentoAtual);

      if (!processo || !deptDestino) {
        adicionarNotificacao("Departamento destino não encontrado", "erro");
        return;
      }

      const historicoExistente = processo.respostasHistorico || {};

      if (!historicoExistente[departamentoDestinoId]) {
        historicoExistente[departamentoDestinoId] = {
          departamentoId: departamentoDestinoId,
          departamentoNome: deptDestino.nome,
          questionario: [],
          respostas: {},
          respondidoEm: null,
          respondidoPor: null
        };
      }

      const novosDepartamentosEnvolvidos = [
        ...(processo.departamentosEnvolvidos || []),
        departamentoDestinoId
      ].filter((value, index, self) => self.indexOf(value) === index);
      const dataAtual = new Date();
      const processoAtualizado = {
        ...processo,
        departamentoAtual: departamentoDestinoId,
        respostasHistorico: historicoExistente,
        departamentosEnvolvidos: novosDepartamentosEnvolvidos,
        historico: [
          ...processo.historico,
          {
            departamento: deptOrigem?.nome || "Sistema",
            data: dataAtual.toISOString(),
            dataTimestamp: dataAtual.getTime(),
            acao: `Transferido de ${deptOrigem?.nome} para ${deptDestino.nome}`,
            responsavel: usuarioLogado?.nome || "Sistema",
            tipo: "movimentacao",
          },
        ],
      };

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify(processoAtualizado)
      });

      const resultado = await response.json();
      if (resultado.sucesso) {
        await carregarProcessos();
        adicionarNotificacao(`Transferido para ${deptDestino.nome}`, "sucesso");
        setShowSelecionarDepartamentoDestino(null);
      } else {
        adicionarNotificacao(`Erro ao transferir: ${resultado.erro}`, "erro");
      }
    } catch (error) {
      console.error('Erro ao avançar:', error);
      adicionarNotificacao(`Erro: ${error.message}`, "erro");
    }
  };

  const avancarParaProximoDepartamento = async (processoId) => {
    try {
      const processo = processos.find(p => p.id === processoId);

      if (!processo) {
        await mostrarAlerta("Erro", "Processo não encontrado", "erro");
        return;
      }

      if (!processo.fluxoDepartamentos || processo.fluxoDepartamentos.length === 0) {
        await mostrarAlerta(
          "Fluxo Indefinido",
          "Este processo não possui um fluxo de departamentos definido",
          "aviso"
        );
        return;
      }

      const indexAtual = processo.departamentoAtualIndex || 0;
      const proximoIndex = indexAtual + 1;

      console.log('📊 DEBUG AVANÇAR:', {
        indexAtual,
        proximoIndex,
        totalDepartamentos: processo.fluxoDepartamentos.length,
        fluxo: processo.fluxoDepartamentos,
        eUltimoDepto: proximoIndex >= processo.fluxoDepartamentos.length
      });

      if (proximoIndex >= processo.fluxoDepartamentos.length) {
        await mostrarAlerta(
          "Fim do Fluxo",
          "Este é o último departamento do fluxo. Use o botão 'Finalizar Processo' para concluir.",
          "info"
        );
        return;
      }

      const proximoDeptId = processo.fluxoDepartamentos[proximoIndex];
      const proximoDept = departamentosCriados.find(d => d.id === proximoDeptId);
      const deptAtual = departamentosCriados.find(d => d.id === processo.departamentoAtual);

      if (!proximoDept) {
        await mostrarAlerta("Erro", "Próximo departamento não encontrado no sistema", "erro");
        return;
      }

      const dataAtual = new Date();
      const novoProgresso = Math.round(((proximoIndex + 1) / processo.fluxoDepartamentos.length) * 100);

      const processoAtualizado = {
        ...processo,
        departamentoAtual: proximoDeptId,
        departamentoAtualIndex: proximoIndex,
        progresso: novoProgresso,
        historico: [
          ...processo.historico,
          {
            departamento: deptAtual?.nome || "Sistema",
            data: dataAtual.toISOString(),
            dataTimestamp: dataAtual.getTime(),
            acao: `Avançou de ${deptAtual?.nome} para ${proximoDept.nome} (${proximoIndex + 1}/${processo.fluxoDepartamentos.length})`,
            responsavel: usuarioLogado?.nome || "Sistema",
            tipo: "movimentacao",
          },
        ],
      };

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify(processoAtualizado)
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        await carregarProcessos();
        adicionarNotificacao(
          `✅ Processo avançado para ${proximoDept.nome} (${proximoIndex + 1}/${processo.fluxoDepartamentos.length})`,
          "sucesso"
        );
      } else {
        await mostrarAlerta("Erro", resultado.erro, "erro");
      }
    } catch (error) {
      console.error('❌ Erro ao avançar:', error);
      await mostrarAlerta("Erro", error.message, "erro");
    }
  };

  const finalizarProcesso = async (processoId) => {
    try {
      const processo = processos.find(p => p.id === processoId);
      if (!processo) {
        await mostrarAlerta("Erro", "Processo não encontrado", "erro");
        return;
      }

      if (processo.fluxoDepartamentos && processo.fluxoDepartamentos.length > 0) {
        const ultimoIndex = processo.fluxoDepartamentos.length - 1;
        const indexAtual = processo.departamentoAtualIndex || 0;

        console.log('🔍 DEBUG FINALIZAR:', {
          indexAtual,
          ultimoIndex,
          estaNoUltimo: indexAtual === ultimoIndex,
          fluxo: processo.fluxoDepartamentos
        });

        if (indexAtual < ultimoIndex) {
          await mostrarAlerta(
            "Não é Possível Finalizar",
            `Este processo ainda não chegou ao último departamento do fluxo.\n\nDepartamento atual: ${indexAtual + 1}/${processo.fluxoDepartamentos.length}\n\nClique em "Avançar" para prosseguir.`,
            "aviso"
          );
          return;
        }
      }

      if (!temPermissao("mover_processo", {
        departamentoOrigemId: processo.departamentoAtual
      })) {
        await mostrarAlerta(
          "Sem Permissão",
          "Apenas o gerente deste departamento pode finalizar processos",
          "erro"
        );
        return;
      }

      setShowConfirmacao({
        tipo: "sucesso",
        nome: processo.nomeEmpresa,
        titulo: "Finalizar Processo",
        mensagem: `Tem certeza que deseja finalizar o processo "${processo.nomeEmpresa}"?\n\nO processo será marcado como concluído e não poderá mais ser alterado.`,
        textoConfirmar: "Sim, Finalizar",
        textoCancelar: "Cancelar",
        onConfirm: async () => {
          setShowConfirmacao(null);
          await executarFinalizacao(processoId);
        },
        onCancel: () => {
          console.log('ℹ️ Finalização cancelada pelo usuário');
          setShowConfirmacao(null);
        }
      });

    } catch (error) {
      console.error('❌ Erro ao finalizar:', error);
      await mostrarAlerta("Erro", error.message, "erro");
    }
  };


  const criarQuestionarioDepartamento = async (processoId, departamentoId, perguntas) => {
    try {
      console.log(' Criando questionário do departamento:', {
        processoId,
        departamentoId,
        totalPerguntas: perguntas.length
      });

      const processo = processos.find(p => p.id === processoId);
      const dept = departamentosCriados.find(d => d.id === departamentoId);

      if (!processo || !dept) {
        adicionarNotificacao("Processo ou departamento não encontrado", "erro");
        return;
      }

      const respostasHistoricoAtualizado = {
        ...processo.respostasHistorico,
        [departamentoId]: {
          ...processo.respostasHistorico[departamentoId],
          departamentoId: departamentoId,
          departamentoNome: dept.nome,
          questionario: perguntas,
          respondidoEm: processo.respostasHistorico[departamentoId]?.respondidoEm || null,
          respondidoPor: processo.respostasHistorico[departamentoId]?.respondidoPor || null
        }
      };

      const processoAtualizado = {
        ...processo,
        respostasHistorico: respostasHistoricoAtualizado
      };

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify(processoAtualizado)
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        await carregarProcessos();
        adicionarNotificacao("Questionário do departamento criado com sucesso!", "sucesso");
        return true;
      } else {
        adicionarNotificacao(`Erro ao criar questionário: ${resultado.erro}`, "erro");
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao criar questionário do departamento:', error);
      adicionarNotificacao(`Erro: ${error.message}`, "erro");
      return false;
    }
  };
  const selecionarDepartamentoParaAvancar = (processoId) => {
    const processo = processos.find(p => p.id === processoId);

    if (!temPermissao("mover_processo", {
      departamentoOrigemId: processo.departamentoAtual
    })) {
      mostrarAlerta(
        "Sem Permissão",
        "Apenas o gerente deste departamento pode mover processos",
        "erro"
      );
      return;
    }

    setShowSelecionarDepartamentoDestino(processo);
  };
  const transferirProcesso = async (processoId, novoDepartamentoId) => {
    try {
      const processo = processos.find(p => p.id === processoId);
      const deptOrigem = departamentosCriados.find(d => d.id === processo.departamentoAtual);
      const deptDestino = departamentosCriados.find(d => d.id === novoDepartamentoId);

      const dataAtual = new Date();
      const novoHistorico = [
        ...processo.historico,
        {
          departamento: deptOrigem.nome,
          data: dataAtual.toISOString(),
          dataTimestamp: dataAtual.getTime(),
          acao: `Processo transferido de ${deptOrigem.nome} para ${deptDestino.nome}`,
          responsavel: usuarioLogado?.nome || deptOrigem.responsavel,
          tipo: "movimentacao",
        },
      ];

      const processoAtualizado = {
        ...processo,
        departamentoAtual: novoDepartamentoId,
        historico: novoHistorico,
      };

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify(processoAtualizado)
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        await carregarProcessos();
        adicionarNotificacao(
          `Processo transferido para ${deptDestino.nome}`,
          "sucesso"
        );
      } else {
        adicionarNotificacao(`Erro ao transferir: ${resultado.erro}`, "erro");
      }
    } catch (error) {
      console.error('❌ Erro ao transferir processo:', error);
      adicionarNotificacao(`Erro ao transferir: ${error.message}`, "erro");
    }
  };




  const moverProcesso = (processoId, novoDepartamentoId) => {
    const processo = processos.find(p => p.id === processoId);

    if (!temPermissao("mover_processo", {
      departamentoOrigemId: processo.departamentoAtual
    })) {
      mostrarAlerta(
        "Sem Permissão",
        "Apenas o gerente deste departamento pode mover processos",
        "erro"
      );
      return;
    }

    setProcessos(
      processos.map((processo) => {
        if (processo.id === processoId) {
          const dataAtual = new Date();

          const deptOrigem = departamentosCriados.find(
            (d) => d && d.id === processo.departamentoAtual
          );

          const deptDestino = departamentosCriados.find(
            (d) => d && d.id === novoDepartamentoId
          );

          if (!deptOrigem || !deptDestino) {
            console.error('❌ Departamento não encontrado:', {
              origem: deptOrigem?.id,
              destino: deptDestino?.id,
              disponíveis: departamentosCriados.map(d => d?.id)
            });
            return processo;
          }

          const deptDestinoIndex = departamentosCriados.findIndex(
            (d) => d && d.id === novoDepartamentoId
          );

          const novoProgresso = Math.round(
            (deptDestinoIndex / departamentosCriados.length) * 100
          );

          const novoHistorico = [
            ...processo.historico,
            {
              departamento: deptOrigem.nome,
              data: dataAtual,
              dataTimestamp: dataAtual.getTime(),
              acao: `Processo movido de ${deptOrigem.nome} para ${deptDestino.nome}`,
              responsavel: usuarioLogado?.nome || deptOrigem.responsavel,
              tipo: "movimentacao",
            },
          ];

          adicionarNotificacao(
            `${processo.nomeEmpresa} foi movido para ${deptDestino.nome}`,
            "info"
          );

          return {
            ...processo,
            departamentoAtual: novoDepartamentoId,
            progresso: novoProgresso,
            historico: novoHistorico,
          };
        }
        return processo;
      })
    );
  };
  const adicionarNotificacao = async (mensagem, tipo) => {
    console.log('🔔 Frontend: Adicionando notificação:', { mensagem, tipo });

    const dataAtual = new Date();
    const novaNotificacao = {
      id: Date.now(),
      mensagem,
      tipo,
      timestamp: formatarDataHora(dataAtual),
      lida: false,
    };

    setNotificacoes(prev => [novaNotificacao, ...prev.slice(0, 9)]);

    try {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('📤 Enviando notificação para API...');
        const response = await fetch(`${API_URL}/notificacoes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            mensagem,
            tipo,
            usuarioId: usuarioLogado?.id
          })
        });

        const resultado = await response.json();
        console.log('📥 Resposta da API:', resultado);

        if (resultado.sucesso && resultado.id) {
          setNotificacoes(prev => prev.map(n => n.id === novaNotificacao.id ? { ...n, id: resultado.id, timestamp: formatarDataHora(resultado.notificacao?.criado_em || new Date()) } : n));
        } else if (!resultado.sucesso) {
          console.error('❌ Erro ao salvar notificação:', resultado.erro);
        }
      } else {
        console.warn('⚠️ Sem token - notificação não será salva no banco');
      }
    } catch (error) {
      console.error('❌ Erro ao salvar notificação:', error);
    }
  };

  const limparTodasNotificacoes = async () => {
    try {
      const token = localStorage.getItem('token');

      setNotificacoes([]);

      if (!token) {
        console.log('⚠️ Sem token - notificações limpas apenas localmente');
        return;
      }

      console.log('🗑️ Excluindo todas as notificações...');

      const res = await fetch(`${API_URL}/notificacoes/limpar-todas`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('📡 Status da resposta:', res.status);

      if (res.ok) {
        const data = await res.json();
        console.log('✅ Notificações excluídas do servidor:', data.excluidas);

      } else {
        console.error('❌ Erro ao excluir notificações:', res.status);
        const errorText = await res.text();
        console.error('📄 Detalhes:', errorText);
      }
    } catch (error) {
      console.error('❌ Erro ao limpar notificações:', error);
    }
  };
  const removerNotificacao = async (id) => {
    try {
      setNotificacoes(prev => prev.filter(n => n.id !== id));

      const token = localStorage.getItem('token');
      if (!token) return;

      await fetch(`${API_URL}/notificacoes/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('❌ Erro ao remover notificação:', error);
    }
  };

  const calcularDiasEntreDatas = (data1, data2) => {
    const umDia = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((new Date(data1) - new Date(data2)) / umDia));
  };
  const salvarQuestionario = async (processoId, departamentoId, respostas) => {
    try {
      console.log(' SALVANDO RESPOSTAS:', {
        processoId,
        departamentoId,
        totalRespostas: Object.keys(respostas).length,
        respostas
      });

      const processo = processos.find(p => p.id === processoId);
      const dept = departamentosCriados.find(d => d.id === departamentoId);

      if (!processo || !dept) {
        await mostrarAlerta("Erro", "Processo ou departamento não encontrado", "erro");
        return;
      }

      const questionarioDepartamento = processo.questionariosPorDepartamento?.[departamentoId] || [];
      const perguntasObrigatorias = questionarioDepartamento.filter(p => p.obrigatorio);
      const respostasVazias = perguntasObrigatorias.filter(p => {
        const resposta = respostas[p.id];
        return !resposta || (typeof resposta === 'string' && !resposta.trim());
      });

      if (respostasVazias.length > 0) {
        const nomes = respostasVazias.map(p => p.label).join(', ');
        await mostrarAlerta(
          "Campos Obrigatórios",
          `Preencha os campos obrigatórios: ${nomes}`,
          "aviso"
        );
        return;
      }

      const respostasHistoricoAtualizado = {
        ...processo.respostasHistorico,
        [departamentoId]: {
          departamentoId: departamentoId,
          departamentoNome: dept.nome,
          questionario: questionarioDepartamento,
          respostas: respostas,
          respondidoEm: new Date().toISOString(),
          respondidoPor: usuarioLogado?.nome || "Sistema"
        }
      };

      const processoAtualizado = {
        ...processo,
        respostasHistorico: respostasHistoricoAtualizado
      };

      console.log('📤 Enviando para API:', {
        processoId,
        totalRespostas: Object.keys(respostas).length
      });

      const camposObrigatorios = questionarioDepartamento.filter(p => p.obrigatorio);
      const todosCamposPreenchidos = camposObrigatorios.every(campo => {
        const resposta = respostas[campo.id];
        return resposta !== null && resposta !== undefined && resposta !== '';
      });


      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processoAtualizado)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro HTTP:', response.status, errorText);
        throw new Error(`Erro ao salvar: ${response.status}`);
      }

      const resultado = await response.json();

      console.log('📥 Resposta da API:', resultado);

      if (resultado.sucesso) {
        if (todosCamposPreenchidos) {
          await registrarPreenchimentoCompleto(processoId, departamentoId);
        }

        setProcessos(prev => prev.map(p =>
          p.id === processoId ? processoAtualizado : p
        ));

        setShowQuestionario(null);
        adicionarNotificacao("✅ Respostas salvas com sucesso!", "sucesso");
      }

    } catch (error) {
      console.error('❌ Erro ao salvar:', error);
      await mostrarAlerta("Erro", "Erro ao salvar respostas: " + error.message, "erro");
    }
  };
  useEffect(() => {
    if (showQuestionario?.processoId) {
      const processo = processos.find(p => p.id === showQuestionario.processoId);
      if (processo) {
        console.log('🔍 DEBUG - Respostas salvas do processo:', {
          processoId: processo.id,
          departamentoId: showQuestionario.departamento,
          respostasHistorico: processo.respostasHistorico,
          totalRespostas: processo.respostasHistorico?.[showQuestionario.departamento]?.respostas
            ? Object.keys(processo.respostasHistorico[showQuestionario.departamento].respostas).length
            : 0
        });
      }
    }
  }, [showQuestionario, processos]);

  const registrarPreenchimentoCompleto = async (processoId, departamentoId) => {
    try {
      const response = await fetchAutenticado(`${API_URL}/questionarios/registrar-preenchimento`, {
        method: 'POST',
        body: JSON.stringify({
          processoId,
          departamentoId,
          preenchidoPor: usuarioLogado.nome
        })
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        console.log('✅ Preenchimento registrado para verificação automática');
      }
    } catch (error) {
      console.error('❌ Erro ao registrar preenchimento:', error);
    }
  };
  const salvarQuestionarioSolicitacao = async (processoId, departamentoId, novasPerguntas) => {
    try {
      console.log(' Salvando questionário EDITADO:', {
        processoId,
        departamentoId,
        totalPerguntas: novasPerguntas.length,
        perguntas: novasPerguntas
      });

      const processo = processos.find(p => p.id === processoId);
      if (!processo) {
        await mostrarAlerta("Erro", "Processo não encontrado", "erro");
        return;
      }

      const questionariosAtualizados = {
        ...processo.questionariosPorDepartamento,
        [String(departamentoId)]: novasPerguntas
      };

      const respostasHistorico = processo.respostasHistorico || {};
      if (respostasHistorico[departamentoId]) {
        respostasHistorico[departamentoId] = {
          ...respostasHistorico[departamentoId],
          questionario: novasPerguntas
        };
      } else {
        respostasHistorico[departamentoId] = {
          questionario: novasPerguntas,
          respostas: {},
          respondidoEm: null,
          respondidoPor: null,
          departamentoId: departamentoId,
          departamentoNome: departamentosCriados.find(d => d.id === departamentoId)?.nome
        };
      }

      const processoAtualizado = {
        ...processo,
        questionariosPorDepartamento: questionariosAtualizados,
        respostasHistorico: respostasHistorico
      };

      console.log('📤 Enviando atualização:', {
        processoId,
        respostasPreservadas: respostasHistorico[departamentoId]?.respostas
      });

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(processoAtualizado)
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        console.log('✅ Questionário salvo!');

        setProcessos(prev => prev.map(p => {
          if (p.id === processoId) {
            return processoAtualizado;
          }
          return p;
        }));

        setShowQuestionarioSolicitacao(null);
        adicionarNotificacao("✅ Questionário atualizado com sucesso!", "sucesso");

        setTimeout(() => {
          setShowQuestionario({
            processoId: processoId,
            departamento: departamentoId
          });
        }, 100);

      } else {
        await mostrarAlerta("Erro ao Salvar", resultado.erro || "Erro desconhecido", "erro");
      }

    } catch (error) {
      console.error('❌ Erro ao salvar questionário:', error);
      await mostrarAlerta("Erro", error.message, "erro");
    }
  };
  useEffect(() => {
    if (showQuestionario?.processoId) {
      console.log('🔄 Questionário aberto, verificando dados...');

      const processo = processos.find(p => p.id === showQuestionario.processoId);

      if (processo) {
        const questionario = processo.questionariosPorDepartamento?.[showQuestionario.departamento] ||
          processo.questionarioSolicitacao ||
          [];

        console.log('📋 Perguntas atuais no questionário:', {
          total: questionario.length,
          perguntas: questionario
        });
      }
    }
  }, [showQuestionario, processos]);
  useEffect(() => {
    if (showQuestionario) {
      const processo = processos.find(p => p.id === showQuestionario.processoId);
      const questionario = processo?.questionariosPorDepartamento?.[showQuestionario.departamento] ||
        processo?.questionarioSolicitacao ||
        [];

      console.log('🔍 DEBUG Modal Questionário:', {
        processoId: showQuestionario.processoId,
        departamentoId: showQuestionario.departamento,
        totalPerguntas: questionario.length,
        perguntas: questionario,
        processoCompleto: processo
      });
    }
  }, [showQuestionario, processos]);
  const carregarRespostasQuestionario = async (processoId, departamentoId) => {
    try {
      console.log('🔄 Carregando respostas do questionário...', { processoId, departamentoId });
      const resultado = await api.getRespostasQuestionario(processoId, departamentoId);

      if (resultado.sucesso) {
        console.log('✅ Respostas carregadas do banco:', resultado.respostas);
        return resultado.respostas;
      }
      console.warn('⚠️ Nenhuma resposta retornada');
      return {};
    } catch (error) {
      console.error('❌ Erro ao carregar respostas:', error);
      return {};
    }
  };



  const calcularTempoMedioPorDepartamento = (processosFinalizados) => {
    const temposPorDept = {};
    const contagemPorDept = {};

    processosFinalizados.forEach((processo) => {
      const historicoOrdenado = [...processo.historico].sort((a, b) => {
        const dataA = a.dataTimestamp || new Date(a.data).getTime();
        const dataB = b.dataTimestamp || new Date(b.data).getTime();
        return dataA - dataB;
      });

      historicoOrdenado.forEach((evento, index) => {
        if (
          evento.tipo === "conclusao" ||
          evento.tipo === "finalizacao" ||
          evento.tipo === "movimentacao"
        ) {
          const dept = evento.departamento;

          if (!temposPorDept[dept]) {
            temposPorDept[dept] = 0;
            contagemPorDept[dept] = 0;
          }

          if (index > 0) {
            const dataAtual =
              evento.dataTimestamp || new Date(evento.data).getTime();
            const dataAnterior =
              historicoOrdenado[index - 1].dataTimestamp ||
              new Date(historicoOrdenado[index - 1].data).getTime();

            const tempoDias = calcularDiasEntreDatas(dataAnterior, dataAtual);

            if (tempoDias > 0) {
              temposPorDept[dept] += tempoDias;
              contagemPorDept[dept]++;
            }
          }
        }
      });
    });

    const tempoMedio = {};
    Object.keys(temposPorDept).forEach((dept) => {
      tempoMedio[dept] =
        contagemPorDept[dept] > 0
          ? Math.round(temposPorDept[dept] / contagemPorDept[dept])
          : 0;
    });

    return tempoMedio;
  };

  const calcularTaxaConclusaoMensal = (processosFinalizados) => {
    const conclusoesPorMes = {};

    processosFinalizados.forEach((processo) => {
      const dataFinalizacao = processo.dataFinalizacao
        ? (processo.dataFinalizacao instanceof Date
          ? processo.dataFinalizacao
          : new Date(processo.dataFinalizacao))
        : new Date();

      const mesAno = dataFinalizacao.toISOString().slice(0, 7);

      if (!conclusoesPorMes[mesAno]) {
        conclusoesPorMes[mesAno] = 0;
      }
      conclusoesPorMes[mesAno]++;
    });

    return conclusoesPorMes;
  };

  const identificarGargalos = (todosProcessos) => {
    const tempoPorDept = {};
    const processosPorDept = {};

    todosProcessos.forEach((processo) => {
      processo.historico.forEach((evento) => {
        if (!tempoPorDept[evento.departamento]) {
          tempoPorDept[evento.departamento] = 0;
          processosPorDept[evento.departamento] = 0;
        }
        processosPorDept[evento.departamento]++;
      });
    });

    return Object.entries(tempoPorDept)
      .map(([dept, tempo]) => ({
        departamento: dept,
        tempoMedio: tempo,
        processos: processosPorDept[dept],
        taxaGargalo: tempo / processosPorDept[dept] || 0,
      }))
      .sort((a, b) => b.taxaGargalo - a.taxaGargalo)
      .slice(0, 3);
  };

  const calcularPerformanceDepartamentos = (processosFinalizados) => {
    const performance = {};

    departamentosCriados.forEach((dept) => {
      const processosNoDept = processosFinalizados.filter((p) =>
        p.historico.some((h) => h.departamento === dept.nome)
      );

      performance[dept.id] = {
        nome: dept.nome,
        processosConcluidos: processosNoDept.length,
        tempoMedio: analytics.tempoMedioPorDepartamento[dept.nome] || 0,
        eficiencia: processosNoDept.length > 0 ? Math.random() * 100 : 0,
      };
    });

    return performance;
  };

  const preverConclusao = (processosAndamento, processosFinalizados) => {
    const previsoes = {};

    if (processosFinalizados.length === 0) return previsoes;

    const tempoTotalFinalizados = processosFinalizados.reduce(
      (acc, processo) => {
        return acc + processo.historico.length * 1;
      },
      0
    );

    const tempoMedioTotal = tempoTotalFinalizados / processosFinalizados.length;

    processosAndamento.forEach((processo) => {
      const progressoAtual = processo.progresso;
      const tempoEstimado = tempoMedioTotal * (1 - progressoAtual / 100);

      previsoes[processo.id] = {
        nomeEmpresa: processo.nomeEmpresa,
        previsao: new Date(
          Date.now() + tempoEstimado * 24 * 60 * 60 * 1000
        ).toLocaleDateString(),
        confianca: Math.min(progressoAtual + 30, 95),
      };
    });

    return previsoes;
  };

  const calcularMetricasGerais = (todosProcessos, finalizados, andamento) => {
    const totalProcessos = todosProcessos.length;
    const taxaSucesso =
      totalProcessos > 0 ? (finalizados.length / totalProcessos) * 100 : 0;
    const tempoMedioTotal =
      finalizados.length > 0
        ? Object.values(analytics.tempoMedioPorDepartamento).reduce(
          (a, b) => a + b,
          0
        ) / finalizados.length
        : 0;

    return {
      totalProcessos,
      processosFinalizados: finalizados.length,
      processosAndamento: andamento.length,
      taxaSucesso: Math.round(taxaSucesso),
      tempoMedioTotal: Math.round(tempoMedioTotal),
      departamentosAtivos: departamentosCriados.length,
    };
  };

  const calcularAnalytics = () => {
    if (processos.length === 0 || departamentosCriados.length === 0) return;

    const processosFinalizados = processos.filter(
      (p) => p.status === "Finalizado"
    );
    const processosAndamento = processos.filter(
      (p) => p.status === "Em Andamento"
    );

    const novosAnalytics = {
      tempoMedioPorDepartamento:
        calcularTempoMedioPorDepartamento(processosFinalizados),
      taxaConclusaoMensal: calcularTaxaConclusaoMensal(processosFinalizados),
      gargalos: identificarGargalos(processos),
      performanceDepartamentos:
        calcularPerformanceDepartamentos(processosFinalizados),
      previsaoConclusao: preverConclusao(
        processosAndamento,
        processosFinalizados
      ),
      metricasGerais: calcularMetricasGerais(
        processos,
        processosFinalizados,
        processosAndamento
      ),
    };

    setAnalytics(novosAnalytics);
  };

  useEffect(() => {
    calcularAnalytics();
  }, [processos, departamentosCriados]);

  const detectarMencoes = (texto) => {
    const regex = /@(\w+)/g;
    const mencoes = [];
    let match;

    while ((match = regex.exec(texto)) !== null) {
      mencoes.push(match[1]);
    }

    return mencoes;
  };


  const adicionarComentario = async (processoId, texto, mencoes = []) => {
    if (!texto.trim()) {
      console.log('❌ Texto vazio, não enviando comentário');
      return;
    }

    try {
      console.log('🔄 Tentando adicionar comentário:', {
        processoId,
        texto,
        usuarioLogado: usuarioLogado?.nome,
        mencoes
      });

      const processo = processos.find((p) => p.id === processoId);
      const deptAtual = departamentosCriados.find(
        (d) => d.id === processo.departamentoAtual
      );

      console.log('📤 Enviando para API...');
      const resultado = await api.salvarComentario({
        processoId,
        texto,
        autor: usuarioLogado.nome,
        departamentoId: deptAtual?.id,
        mencoes
      });

      console.log('📥 Resposta da API:', resultado);

      if (resultado.sucesso) {
        console.log('✅ Comentário salvo com sucesso, ID:', resultado.id);
        await carregarComentarios(processoId);
        setNovoComentario("");
        adicionarNotificacao("Comentário adicionado", "sucesso");
      } else {
        console.error('❌ Erro ao salvar comentário:', resultado.erro);
        adicionarNotificacao(`Erro ao adicionar comentário: ${resultado.erro}`, "erro");
      }
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      adicionarNotificacao('Erro ao adicionar comentário: ' + error.message, "erro");
    }
  };

  const carregarComentarios = async (processoId) => {
    try {
      const comentariosData = await api.getComentarios(processoId);

      console.log('📝 Comentários retornados (raw):', comentariosData);

      const comentariosArray = (Array.isArray(comentariosData) ? comentariosData : []).map((c) => ({
        id: c.id,
        processoId: c.processo_id || c.processoId || null,
        texto: c.texto,
        autor: c.autor,
        departamentoId: c.departamento_id || c.departamentoId || null,
        departamento: c.departamento || 'Sistema',
        timestamp: c.criado_em || c.timestamp || null,
        editado: c.editado === 1 || c.editado === true,
        editadoEm: c.editado_em || c.editadoEm || null,
        mencoes: c.mencoes ? (typeof c.mencoes === 'string' ? JSON.parse(c.mencoes) : c.mencoes) : [],
        _raw: c
      }));

      console.log('📝 Comentários normalizados:', comentariosArray);

      setComentarios((prev) => ({
        ...prev,
        [processoId]: comentariosArray
      }));

      const rawDocs = await api.getDocumentos(processoId);
      console.log('📦 Documentos retornados (raw):', rawDocs);

      const docs = (Array.isArray(rawDocs) ? rawDocs : []).map((d) => ({
        id: d.id,
        processoId: d.processo_id || d.processoId || null,
        nome: d.nome,
        tipo: d.tipo,
        tamanho: d.tamanho,
        url: d.url,
        tipoCategoria: d.tipo_categoria || d.tipoCategoria || null,
        departamentoId: d.departamento_id || d.departamentoId || null,
        perguntaId: d.pergunta_id || d.perguntaId || null,
        dataUpload: d.criado_em || d.dataUpload || null,
        _raw: d
      }));

      console.log('📦 Documentos normalizados:', docs);

      setDocumentos((prev) => ({
        ...prev,
        [processoId]: docs
      }));

      return comentariosArray;
    } catch (error) {
      console.error('Erro ao carregar comentários:', error);
      return [];
    }
  };

  const editarComentario = async (processoId, comentarioId, novoTexto) => {
    try {
      const resultado = await api.atualizarComentario(comentarioId, novoTexto);

      if (resultado.sucesso) {
        await carregarComentarios(processoId);
        adicionarNotificacao("Comentário editado", "sucesso");
      }
    } catch (error) {
      console.error('Erro ao editar comentário:', error);
      adicionarNotificacao('Erro ao editar comentário: ' + error.message, "erro");
    }
  };

  const excluirComentarioDireto = async (processoId, comentarioId) => {
    const confirmou = await mostrarConfirmacao({
      tipo: "comentario",
      nome: "comentário",
      titulo: "Excluir Comentário",
      mensagem: "Tem certeza que deseja excluir este comentário?",
      textoConfirmar: "Sim, Excluir"
    });

    if (confirmou) {
      try {
        const resultado = await api.excluirComentario(comentarioId);

        if (resultado.sucesso) {
          await carregarComentarios(processoId);
          adicionarNotificacao("Comentário excluído", "info");
        }
      } catch (error) {
        console.error('Erro ao excluir comentário:', error);
        adicionarNotificacao('Erro ao excluir comentário: ' + error.message, "erro");
      }
    }
  };


  const fazerUploadDocumento = async (
    processoId,
    arquivo,
    tipo,
    perguntaId = null,
    departamentoIdParam = undefined
  ) => {
    try {
      const processo = processos.find(p => p.id === processoId);

      let departamentoId = processo?.departamentoAtual;

      if (typeof departamentoIdParam !== 'undefined') {
        departamentoId = departamentoIdParam;
      }

      console.log('🔍 DEBUG UPLOAD:', {
        processoId,
        departamentoId,
        arquivo: arquivo.name,
        tipo,
        perguntaId,
        tamanho: arquivo.size
      });

      const resultado = await api.uploadDocumento(
        processoId,
        arquivo,
        tipo,
        perguntaId,
        departamentoId
      );

      if (resultado.sucesso) {
        console.log('✅ Upload bem-sucedido!');

        await carregarDocumentos(processoId);

        return true;
      } else {
        throw new Error(resultado.erro || 'Erro ao fazer upload');
      }
    } catch (error) {
      console.error('❌ Erro no upload:', error);
      adicionarNotificacao(`Erro ao enviar documento: ${error.message}`, "erro");
      return false;
    }
  };


  const carregarDocumentos = async (processoId) => {
    try {
      console.log('🔄 Carregando documentos do processo:', processoId);
      const docs = await api.getDocumentos(processoId);

      console.log('📦 Documentos retornados:', docs);

      const normalized = (Array.isArray(docs) ? docs : []).map((d) => ({
        id: d.id,
        processoId: d.processo_id || d.processoId || null,
        nome: d.nome,
        tipo: d.tipo,
        tamanho: d.tamanho,
        url: d.url,
        tipoCategoria: d.tipo_categoria || d.tipoCategoria || null,
        departamentoId: d.departamento_id || d.departamentoId || null,
        perguntaId: d.pergunta_id || d.perguntaId || null,
        dataUpload: d.criado_em || d.dataUpload || null,
      }));

      console.log('📦 Documentos normalizados:', normalized);

      setDocumentos(prev => ({
        ...prev,
        [processoId]: normalized
      }));

      return normalized;
    } catch (error) {
      console.error('❌ Erro ao carregar documentos:', error);
      adicionarNotificacao('Erro ao carregar documentos: ' + error.message, 'erro');
      return [];
    }
  };

  const carregarTemplates = async () => {
    try {
      console.log('🔄 Carregando templates...');
      const resultado = await api.getTemplates();

      if (resultado.sucesso && Array.isArray(resultado.templates)) {
        setTemplatesDisponiveis(resultado.templates);
        console.log('✅ Templates carregados:', resultado.templates.length);
      } else {
        setTemplatesDisponiveis([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar templates:', error);
      adicionarNotificacao('Erro ao carregar templates: ' + error.message, 'erro');
    }
  };

  useEffect(() => {
    const verificarSessao = async () => {
      const tokenSalvo = localStorage.getItem('token');

      if (tokenSalvo) {
        try {
          const response = await fetchAutenticado(`${API_URL}/usuarios/me`);
          const data = await response.json();

          if (data.sucesso) {
            console.log('👤 Dados do usuário carregados:', data.usuario);

            setUsuarioLogado(data.usuario);
            setToken(tokenSalvo);
            setShowLogin(false);
            conectarWebSocket();

            console.log('🚀 Iniciando carregamento de empresas...');
            await carregarEmpresas();

            await carregarDepartamentos();
            await carregarTemplates();
            await carregarDadosIniciais();
          } else {
            localStorage.removeItem('token');
            setShowLogin(true);
          }
        } catch (error) {
          console.error('Erro ao verificar sessão:', error);
          localStorage.removeItem('token');
          setShowLogin(true);
        }
      } else {
        setShowLogin(true);
      }
    };

    verificarSessao();
  }, []);
  const conectarWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('❌ Nenhum token disponível para WebSocket');
      return;
    }

    try {
      ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        console.log('✅ Conectado ao servidor WebSocket');
      };

      ws.onmessage = async (event) => {
        try {
          const { tipo, dados } = JSON.parse(event.data);

          if (tipo === 'processo_atualizado') {
            await carregarProcessos();
            adicionarNotificacao(`Processo atualizado por outro usuário`, 'info');
          } else if (tipo === 'departamento_atualizado') {
            await carregarDepartamentos();
            adicionarNotificacao(`Departamento atualizado`, 'info');
          } else if (tipo === 'usuario_criado') {
            await carregarUsuarios();
          } else if (tipo === 'sessao_expirada') {
            localStorage.removeItem('token');
            setToken(null);
            setUsuarioLogado(null);
            setShowLogin(true);
            adicionarNotificacao('Sessão expirada', 'erro');
          } else if (tipo === 'nova_notificacao') {
            try {
              if (typeof window !== 'undefined' && window.dispatchEvent) {
                window.dispatchEvent(new CustomEvent('nova_notificacao', { detail: dados }));
              }
            } catch (e) {
              console.error('Erro ao despachar evento nova_notificacao:', e);
            }
          }
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      ws.onclose = () => {
        console.log('❌ Desconectado do servidor. Reconectando...');
        setTimeout(conectarWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error('❌ Erro WebSocket:', error);
      };
    } catch (error) {
      console.error('❌ Erro ao conectar WebSocket:', error);
    }
  };



  const excluirDocumentoDireto = async (processoId, documentoId) => {
    console.log('🗑️ Tentando excluir documento:', { processoId, documentoId });

    const doc = documentos[processoId]?.find(d => d.id === documentoId);

    if (!doc) {
      console.error('❌ Documento não encontrado!');
      adicionarNotificacao("Documento não encontrado", "erro");
      return false;
    }

    const confirmou = await mostrarConfirmacao({
      tipo: "documento",
      nome: doc.nome,
      titulo: "Excluir Documento",
      mensagem: `Tem certeza que deseja excluir o documento "${doc.nome}"?`,
      textoConfirmar: "Sim, Excluir",
      textoCancelar: "Cancelar"
    });

    if (!confirmou) {
      console.log('ℹ️ Exclusão cancelada pelo usuário');
      return false;
    }

    console.log('🗑️ Usuário confirmou exclusão do documento:', documentoId);
    setExcluindoDocumento((prev) => ({ ...prev, [documentoId]: true }));

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/documentos/${documentoId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      let corpo;
      try {
        corpo = await res.json();
      } catch (err) {
        corpo = { raw: await res.text() };
      }

      console.log('📡 Resposta DELETE:', res.status, corpo);

      if (res.status === 401) {
        adicionarNotificacao('Sessão expirada. Faça login novamente.', 'erro');
        localStorage.removeItem('token');
        setToken(null);
        setUsuarioLogado(null);
        setShowLogin(true);
        return false;
      }

      if (!res.ok) {
        console.error('❌ Exclusão falhou:', corpo);
        adicionarNotificacao(
          'Erro ao excluir: ' + (corpo?.erro || `HTTP ${res.status}`),
          'erro'
        );
        return false;
      }

      if (corpo?.sucesso) {
        setDocumentos((prev) => ({
          ...prev,
          [processoId]: prev[processoId].filter((d) => d.id !== documentoId),
        }));

        await carregarDocumentos(processoId);

        setProcessos(processos.map((p) =>
          p.id === processoId
            ? {
              ...p,
              historico: [
                ...p.historico,
                {
                  departamento: "Sistema",
                  data: new Date().toISOString(),
                  dataTimestamp: Date.now(),
                  acao: `Documento "${doc.nome}" excluído`,
                  responsavel: usuarioLogado?.nome || "Sistema",
                  tipo: "documento",
                },
              ],
            }
            : p
        ));

        adicionarNotificacao("Documento excluído com sucesso", "sucesso");
        return true;
      } else {
        adicionarNotificacao('Erro: resposta inválida do servidor', 'erro');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro na requisição:', error);
      adicionarNotificacao(`Erro ao excluir: ${error.message}`, 'erro');
      return false;
    } finally {
      setExcluindoDocumento((prev) => ({ ...prev, [documentoId]: false }));
    }
  };

  const verificarDocumentosObrigatorios = (processoId, departamentoId) => {
    const dept = departamentosCriados.find((d) => d.id === departamentoId);
    if (!dept?.documentosObrigatorios) return { faltantes: [], completo: true };

    const docsProcesso = documentos[processoId] || [];
    const docsFaltantes = dept.documentosObrigatorios.filter(
      (docObrigatorio) =>
        !docsProcesso.some((doc) => doc.tipoCategoria === docObrigatorio.tipo)
    );

    return {
      faltantes: docsFaltantes,
      completo: docsFaltantes.length === 0,
    };
  };

  const adicionarDocumentoObrigatorio = (departamentoId, documentoConfig) => {
    setDepartamentosCriados((prev) =>
      prev.map((dept) =>
        dept.id === departamentoId
          ? {
            ...dept,
            documentosObrigatorios: [
              ...(dept.documentosObrigatorios || []),
              documentoConfig,
            ],
          }
          : dept
      )
    );
  };

  const criarDepartamento = async (dadosDepartamento) => {
    if (!temPermissao("criar_departamento") && !editandoDepartamento) {
      mostrarAlerta("Sem Permissão", "Você não tem permissão para criar departamentos", "erro");
      return;
    }

    try {
      let resultado;

      if (editandoDepartamento) {
        const departamentoAtualizado = {
          ...editandoDepartamento,
          nome: dadosDepartamento.nome,
          responsavel: dadosDepartamento.responsavel,
          cor: dadosDepartamento.cor.gradient,
          corSolida: dadosDepartamento.cor.solida,
          icone: dadosDepartamento.icone.componente,
          descricao: dadosDepartamento.descricao,
          documentosObrigatorios: dadosDepartamento.documentosObrigatorios || [],
          ordem: editandoDepartamento.ordem || departamentosCriados.length
        };

        const payloadAtualizar = {
          ...departamentoAtualizado,
          icone: dadosDepartamento.icone.nome
        };

        resultado = await api.atualizarDepartamento(editandoDepartamento.id, payloadAtualizar);

        if (resultado.sucesso) {
          setDepartamentosCriados(
            departamentosCriados.map((dept) =>
              dept.id === editandoDepartamento.id ? departamentoAtualizado : dept
            )
          );

          setEditandoDepartamento(null);
          setShowCriarDepartamento(false);
          adicionarNotificacao(
            `Departamento "${dadosDepartamento.nome}" atualizado com sucesso`,
            "sucesso"
          );
        }
      } else {
        const novoDepartamento = {
          nome: dadosDepartamento.nome,
          responsavel: dadosDepartamento.responsavel,
          cor: dadosDepartamento.cor.gradient,
          corSolida: dadosDepartamento.cor.solida,
          icone: dadosDepartamento.icone.componente,
          descricao: dadosDepartamento.descricao,
          documentosObrigatorios: dadosDepartamento.documentosObrigatorios || [],
          ordem: departamentosCriados.length
        };

        const payloadNovo = {
          ...novoDepartamento,
          icone: dadosDepartamento.icone.nome
        };

        resultado = await api.salvarDepartamento(payloadNovo);

        if (resultado.sucesso) {
          const departamentoComId = {
            id: resultado.id,
            ...novoDepartamento
          };

          setDepartamentosCriados([...departamentosCriados, departamentoComId]);
          setShowCriarDepartamento(false);
          adicionarNotificacao(
            `Departamento "${dadosDepartamento.nome}" criado com sucesso`,
            "sucesso"
          );
        }
      }
    } catch (error) {
      console.error('Erro ao salvar departamento:', error);
      adicionarNotificacao(`Erro ao salvar departamento: ${error.message}`, "erro");
    }
  };
  const validarFluxoParaGerente = (fluxoDepartamentos) => {
    if (usuarioLogado?.role !== "gerente") return true;

    const departamentosPermitidos = [usuarioLogado.departamento_id];

    const todosDepartamentosValidos = fluxoDepartamentos.every(deptId =>
      departamentosPermitidos.includes(deptId)
    );

    console.log('🔐 Validação fluxo gerente:', {
      usuario: usuarioLogado.nome,
      departamentoUsuario: usuarioLogado.departamento_id,
      fluxoDepartamentos,
      departamentosPermitidos,
      valido: todosDepartamentosValidos
    });

    return todosDepartamentosValidos;
  };

  const excluirDepartamentoDireto = async (departamentoId) => {
    const departamento = departamentosCriados.find(d => d.id === departamentoId);

    const processosNoDept = processos.filter(
      p => p.departamentoAtual === departamentoId && p.status === "Em Andamento"
    );

    if (processosNoDept.length > 0) {
      setShowAlerta({
        titulo: "Não é possível excluir",
        mensagem: `Não é possível excluir este departamento pois há ${processosNoDept.length} processo(s) em andamento nele.`,
        tipo: "aviso",
        onClose: () => setShowAlerta(null)
      });
      return;
    }

    setShowConfirmacao({
      tipo: "departamento",
      nome: departamento.nome,
      titulo: "Excluir Departamento",
      mensagem: `Tem certeza que deseja excluir o departamento "${departamento.nome}"?\n\nEsta ação não pode ser desfeita.`,
      textoConfirmar: "Sim, Excluir",
      onConfirm: async () => {
        try {
          const resultado = await api.excluirDepartamento(departamentoId);

          if (resultado.sucesso) {
            setDepartamentosCriados(
              departamentosCriados.filter((dept) => dept.id !== departamentoId)
            );

            setProcessos(processos.map(processo => {
              if (processo.departamentoAtual === departamentoId) {
                const primeiroDept = departamentosCriados
                  .filter(d => d.id !== departamentoId)[0];

                return {
                  ...processo,
                  departamentoAtual: primeiroDept?.id || processo.departamentoAtual,
                  historico: [
                    ...processo.historico,
                    {
                      departamento: "Sistema",
                      data: new Date().toISOString(),
                      dataTimestamp: Date.now(),
                      acao: `Departamento "${departamento.nome}" foi excluído - processo movido`,
                      responsavel: "Sistema",
                      tipo: "movimentacao",
                    }
                  ]
                };
              }
              return processo;
            }));

            setShowConfirmacao(null);
            adicionarNotificacao(`Departamento "${departamento.nome}" excluído`, "info");
          } else {
            adicionarNotificacao(`Erro ao excluir: ${resultado.erro}`, "erro");
          }
        } catch (error) {
          console.error('❌ Erro ao excluir departamento:', error);
          adicionarNotificacao(`Erro: ${error.message}`, "erro");
        }
      },
      onCancel: () => setShowConfirmacao(null)
    });
  };


  const adicionarTag = async (novaTag) => {
    try {
      const resultado = await api.salvarTag(novaTag);

      if (resultado.sucesso) {
        await carregarTags();
        adicionarNotificacao(`Tag "${novaTag.nome}" criada`, "sucesso");
      }
    } catch (error) {
      console.error('Erro ao criar tag:', error);
      adicionarNotificacao('Erro ao criar tag: ' + error.message, "erro");
    }
  };

  const editarTag = async (tagId, dadosAtualizados) => {
    try {
      const resultado = await api.atualizarTag(tagId, dadosAtualizados);

      if (resultado.sucesso) {
        await carregarTags();
        adicionarNotificacao("Tag atualizada", "sucesso");
      }
    } catch (error) {
      console.error('Erro ao atualizar tag:', error);
      adicionarNotificacao('Erro ao atualizar tag: ' + error.message, "erro");
    }
  };

  const excluirTagDireta = async (tagId) => {
    const tag = tags.find(t => t.id === tagId);

    const confirmou = await mostrarConfirmacao({
      tipo: "tag",
      nome: tag.nome,
      titulo: "Excluir Tag",
      mensagem: `Tem certeza que deseja excluir a tag "${tag.nome}"?`,
      textoConfirmar: "Sim, Excluir"
    });

    if (confirmou) {
      try {
        const resultado = await api.excluirTag(tagId);

        if (resultado.sucesso) {
          await carregarTags();

          setProcessos(
            processos.map((p) => ({
              ...p,
              tags: (p.tags || []).filter((t) => t !== tagId),
            }))
          );

          adicionarNotificacao("Tag excluída", "info");
        }
      } catch (error) {
        console.error('Erro ao excluir tag:', error);
        adicionarNotificacao('Erro ao excluir tag: ' + error.message, "erro");
      }
    }
  };

  const carregarTags = async () => {
    try {
      const resultado = await api.getTags();

      if (resultado.sucesso && Array.isArray(resultado.tags)) {
        setTags(resultado.tags);
        return resultado.tags;
      } else {
        console.warn('⚠️ Nenhuma tag retornada');
        setTags([]);
        return [];
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tags:', error);
      adicionarNotificacao('Erro ao carregar tags: ' + error.message, 'erro');
      return [];
    }
  };
  const toggleTagProcesso = (processoId, tagId) => {
    setProcessos(
      processos.map((processo) => {
        if (processo.id === processoId) {
          const tagsAtuais = processo.tags || [];
          const temTag = tagsAtuais.includes(tagId);

          return {
            ...processo,
            tags: temTag
              ? tagsAtuais.filter((t) => t !== tagId)
              : [...tagsAtuais, tagId],
          };
        }
        return processo;
      })
    );
  };

  const handleDragStart = (e, processo) => {
    if (!temPermissao("mover_processo", {
      departamentoOrigemId: processo.departamentoAtual
    })) {
      e.preventDefault();
      mostrarAlerta(
        "Sem Permissão",
        "Apenas o gerente deste departamento pode mover processos",
        "aviso"
      );
      return;
    }

    setDraggedItem(processo);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e, departamentoId) => {
    e.preventDefault();

    if (!draggedItem) return;

    const processo = draggedItem;

    if (processo.fluxoDepartamentos && processo.fluxoDepartamentos.length > 0) {
      const indexAtual = processo.departamentoAtualIndex || 0;
      const proximoEsperado = processo.fluxoDepartamentos[indexAtual + 1];
      const ultimoDept = processo.fluxoDepartamentos[processo.fluxoDepartamentos.length - 1];

      if (departamentoId !== proximoEsperado && departamentoId !== ultimoDept) {
        const deptEsperado = departamentosCriados.find(d => d.id === proximoEsperado);
        mostrarAlerta(
          "Departamento Incorreto",
          `Este processo deve seguir o fluxo definido.\n\nPróximo departamento: ${deptEsperado?.nome || "Desconhecido"}`,
          "aviso"
        );
        setDraggedItem(null);
        return;
      }
    }

    if (departamentoId !== processo.departamentoAtual) {
      avancarParaProximoDepartamento(processo.id);
    }

    setDraggedItem(null);
  };
  const processosFiltrados = processos.filter((processo) => {
    const nomeEmpresa = processo.nomeEmpresa || "";
    const cliente = processo.cliente || "";
    const buscaLower = busca.toLowerCase();

    const matchBusca =
      nomeEmpresa.toLowerCase().includes(buscaLower) ||
      cliente.toLowerCase().includes(buscaLower);

    const matchTags =
      filtroTags.length === 0 ||
      filtroTags.every((tagId) => (processo.tags || []).includes(tagId));

    const matchDepartamento =
      !filtroDepartamento ||
      processo.departamentoAtual === filtroDepartamento;

    const matchFiltro = (() => {
      switch (filtro) {
        case "andamento":
          return processo.status === "Em Andamento";
        case "finalizado":
          return processo.status === "Finalizado";
        case "alta":
          return processo.prioridade === "ALTA";
        default:
          return true;
      }
    })();

    return matchBusca && matchTags && matchDepartamento && matchFiltro;
  });

  const getPriorityColor = (prioridade) => {
    switch (prioridade) {
      case "ALTA":
        return "text-red-600 bg-red-50 border-red-200";
      case "MEDIA":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "BAIXA":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Em Andamento":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "Finalizado":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };
  const marcarComoLida = async (notificacaoId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      setNotificacoes(prev =>
        prev.map(n => n.id === notificacaoId ? { ...n, lida: true } : n)
      );

      await fetch(`${API_URL}/notificacoes/${notificacaoId}/marcar-lida`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('❌ Erro ao marcar notificação como lida:', error);
      setNotificacoes(prev =>
        prev.map(n => n.id === notificacaoId ? { ...n, lida: false } : n)
      );
    }
  };

  const marcarTodasComoLidas = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));

      await fetch(`${API_URL}/notificacoes/marcar-todas-lidas`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('❌ Erro ao marcar todas as notificações como lidas:', error);
    }
  };

  const ModalNovaEmpresa = ({ onClose, onSave, onSalvarTemplate }) => {
    const [nomeEmpresa, setNomeEmpresa] = useState("");
    const [cliente, setCliente] = useState("");
    const [email, setEmail] = useState("");
    const [telefone, setTelefone] = useState("");
    const [nomeServico, setNomeServico] = useState("");

    const [questionariosPorDept, setQuestionariosPorDept] = useState({});
    const [departamentoSelecionado, setDepartamentoSelecionado] = useState(null);
    const [editandoPergunta, setEditandoPergunta] = useState(null);
    const [fluxoDepartamentos, setFluxoDepartamentos] = useState([]);
    const [descricaoTemplate, setDescricaoTemplate] = useState("");

    const [salvarComoTemplateChecked, setSalvarComoTemplateChecked] = useState(false);

    const tiposCampo = [
      { valor: "text", label: "Texto Simples" },
      { valor: "textarea", label: "Texto Longo" },
      { valor: "number", label: "Número" },
      { valor: "date", label: "Data" },
      { valor: "boolean", label: "Sim/Não" },
      { valor: "select", label: "Seleção Única" },
      { valor: "file", label: "Arquivo/Anexo" },
      { valor: "phone", label: "Telefone" },
      { valor: "email", label: "Email" },
    ];


    const adicionarDepartamentoAoFluxo = (deptId) => {
      if (usuarioLogado?.role === "gerente") {
        if (deptId !== usuarioLogado.departamento_id) {
          mostrarAlerta(
            "Sem Permissão",
            "Você só pode adicionar seu próprio departamento ao fluxo",
            "erro"
          );
          return;
        }

        if (fluxoDepartamentos.includes(deptId)) {
          return;
        }
      }

      if (!fluxoDepartamentos.includes(deptId)) {
        setFluxoDepartamentos([...fluxoDepartamentos, deptId]);
        setQuestionariosPorDept({
          ...questionariosPorDept,
          [deptId]: []
        });
      }
      setDepartamentoSelecionado(deptId);
    };
    const removerDepartamentoDoFluxo = (deptId) => {
      setFluxoDepartamentos(fluxoDepartamentos.filter(id => id !== deptId));
      const novosQuestionarios = { ...questionariosPorDept };
      delete novosQuestionarios[deptId];
      setQuestionariosPorDept(novosQuestionarios);

      if (departamentoSelecionado === deptId) {
        setDepartamentoSelecionado(null);
      }
    };

    const adicionarPergunta = (tipo) => {
      const novaPergunta = {
        id: Date.now(),
        label: "",
        tipo: tipo,
        obrigatorio: false,
        opcoes: tipo === "select" ? [""] : [],
        ordem: (questionariosPorDept[departamentoSelecionado]?.length || 0) + 1,
        condicao: null
      };
      setEditandoPergunta(novaPergunta);
    };

    const salvarPergunta = () => {
      if (!editandoPergunta.label.trim()) {
        alert("Digite o texto da pergunta!");
        return;
      }

      if (
        editandoPergunta.tipo === "select" &&
        editandoPergunta.opcoes.filter((o) => o.trim()).length === 0
      ) {
        alert("Adicione pelo menos uma opção de resposta!");
        return;
      }

      const perguntasDepto = questionariosPorDept[departamentoSelecionado] || [];

      if (perguntasDepto.find((p) => p.id === editandoPergunta.id)) {
        // Editando
        setQuestionariosPorDept({
          ...questionariosPorDept,
          [departamentoSelecionado]: perguntasDepto.map((p) =>
            p.id === editandoPergunta.id ? editandoPergunta : p
          )
        });
      } else {
        setQuestionariosPorDept({
          ...questionariosPorDept,
          [departamentoSelecionado]: [...perguntasDepto, editandoPergunta]
        });
      }

      setEditandoPergunta(null);
    };

    const excluirPergunta = (perguntaId) => {
      setQuestionariosPorDept({
        ...questionariosPorDept,
        [departamentoSelecionado]: questionariosPorDept[departamentoSelecionado].filter(
          (p) => p.id !== perguntaId
        )
      });
    };

    const adicionarOpcao = () => {
      setEditandoPergunta({
        ...editandoPergunta,
        opcoes: [...editandoPergunta.opcoes, ""],
      });
    };

    const atualizarOpcao = (index, valor) => {
      const novasOpcoes = [...editandoPergunta.opcoes];
      novasOpcoes[index] = valor;
      setEditandoPergunta({ ...editandoPergunta, opcoes: novasOpcoes });
    };

    const removerOpcao = (index) => {
      setEditandoPergunta({
        ...editandoPergunta,
        opcoes: editandoPergunta.opcoes.filter((_, i) => i !== index),
      });
    };

    const handleSubmit = (e) => {
      e.preventDefault();

      if (!empresaSelecionadaSolicitacao) {
        alert("Selecione uma empresa cadastrada!");
        return;
      }

      if (!nomeServico.trim()) {
        alert("Digite o nome do serviço!");
        return;
      }

      if (fluxoDepartamentos.length === 0) {
        alert("Adicione pelo menos um departamento ao fluxo!");
        return;
      }

      const dadosSolicitacao = {
        nomeEmpresa: empresaSelecionadaSolicitacao.razao_social,
        cliente: empresaSelecionadaSolicitacao.razao_social,
        email: empresaSelecionadaSolicitacao.email || "",
        telefone: empresaSelecionadaSolicitacao.telefone || "",
        nomeServico,
        questionariosPorDepartamento: questionariosPorDept,
        fluxoDepartamentos: fluxoDepartamentos
      };
      onSave(dadosSolicitacao);

      if (salvarComoTemplateChecked && onSalvarTemplate) {
        onSalvarTemplate({
          nomeServico,
          fluxoDepartamentos,
          questionariosPorDepartamento: questionariosPorDept
        });
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">

          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Nova Solicitação</h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
              <h4 className="font-semibold text-cyan-800 mb-4">Informações da Solicitação</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Selecionar Empresa Cadastrada <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={empresaSelecionadaSolicitacao?.id || ""}
                    onChange={(e) => {
                      const empresaId = e.target.value;
                      if (empresaId) {
                        const empresa = empresas.find(emp => emp.id === parseInt(empresaId));
                        setEmpresaSelecionadaSolicitacao(empresa);
                        setNomeEmpresa(empresa.razao_social);
                        setCliente(empresa.razao_social);
                        setEmail(empresa.email || "");
                        setTelefone(empresa.telefone || "");
                      } else {
                        setEmpresaSelecionadaSolicitacao(null);
                        setNomeEmpresa("");
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                    required
                  >
                    <option value="">Selecione uma empresa</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.codigo} - {emp.razao_social}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Nome do Serviço <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nomeServico}
                  onChange={(e) => setNomeServico(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                  placeholder="Ex: Abertura de Empresa, Alteração Contratual..."
                  required
                />
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-4">
                Criar Questionários por Departamento
              </h4>

              <div className="mb-6">
                <h5 className="text-sm font-medium text-gray-700 mb-3">
                  Adicionar Departamentos ao Fluxo:
                </h5>
                <div className="flex flex-wrap gap-2">
                  {departamentosCriados.map((dept) => {
                    const IconeDept = dept.icone;
                    const jaAdicionado = fluxoDepartamentos.includes(dept.id);

                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => jaAdicionado
                          ? removerDepartamentoDoFluxo(dept.id)
                          : adicionarDepartamentoAoFluxo(dept.id)
                        }
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${jaAdicionado
                            ? `bg-gradient-to-r ${dept.cor} text-white`
                            : 'border-2 border-gray-300 hover:border-purple-500'
                          }`}
                      >
                        {IconeDept && <IconeDept size={16} />}
                        {dept.nome}
                        {jaAdicionado && (
                          <span className="bg-white bg-opacity-20 px-2 py-0.5 rounded text-xs">
                            {questionariosPorDept[dept.id]?.length || 0} perguntas
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {fluxoDepartamentos.length > 0 && (
                <div className="mb-6 bg-white rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-700 mb-3">
                    Fluxo da Solicitação ({fluxoDepartamentos.length} departamentos):
                  </h5>
                  <div className="flex flex-wrap items-center gap-2">
                    {fluxoDepartamentos.map((deptId, index) => {
                      const dept = departamentosCriados.find(d => d.id === deptId);
                      if (!dept) return null;

                      const IconeDept = dept.icone;

                      return (
                        <React.Fragment key={deptId}>
                          <button
                            type="button"
                            onClick={() => setDepartamentoSelecionado(deptId)}
                            className={`px-3 py-2 rounded-lg flex items-center gap-2 ${departamentoSelecionado === deptId
                                ? `bg-gradient-to-r ${dept.cor} text-white shadow-lg`
                                : 'bg-gray-100 text-gray-700'
                              }`}
                          >
                            {IconeDept && <IconeDept size={14} />}
                            {dept.nome}
                          </button>
                          {index < fluxoDepartamentos.length - 1 && (
                            <ArrowRight size={16} className="text-gray-400" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {departamentoSelecionado && (
                <div className="border-2 border-purple-300 rounded-xl p-4 bg-white">
                  {(() => {
                    const dept = departamentosCriados.find(d => d.id === departamentoSelecionado);
                    const IconeDept = dept?.icone;
                    const perguntasDepto = questionariosPorDept[departamentoSelecionado] || [];

                    return (
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h5 className="font-medium text-gray-800 flex items-center gap-2">
                            {IconeDept && <IconeDept size={18} />}
                            Questionário - {dept?.nome}
                          </h5>
                          <span className="text-sm text-gray-600">
                            {perguntasDepto.length} pergunta(s)
                          </span>
                        </div>

                        {!editandoPergunta && (
                          <div className="mb-4">
                            <h6 className="text-sm font-medium text-gray-700 mb-2">
                              Adicionar Pergunta:
                            </h6>
                            <div className="grid grid-cols-3 gap-2">
                              {tiposCampo.map((tipo) => (
                                <button
                                  key={tipo.valor}
                                  type="button"
                                  onClick={() => adicionarPergunta(tipo.valor)}
                                  className="p-2 border-2 border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 text-sm"
                                >
                                  {tipo.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {editandoPergunta && (
                          <div className="bg-purple-50 rounded-lg p-4 mb-4 border-2 border-purple-400">
                            <h6 className="font-medium text-gray-800 mb-3">Editando Pergunta:</h6>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Texto da Pergunta <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="text"
                                  value={editandoPergunta.label}
                                  onChange={(e) =>
                                    setEditandoPergunta({
                                      ...editandoPergunta,
                                      label: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                                  placeholder="Ex: Qual o nome da empresa?"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id="obrigatorio-nova"
                                  checked={editandoPergunta.obrigatorio}
                                  onChange={(e) =>
                                    setEditandoPergunta({
                                      ...editandoPergunta,
                                      obrigatorio: e.target.checked,
                                    })
                                  }
                                  className="w-4 h-4 text-purple-600 rounded"
                                />
                                <label
                                  htmlFor="obrigatorio-nova"
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Campo obrigatório
                                </label>
                              </div>
                              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                <label className="flex items-center gap-2 mb-3">
                                  <input
                                    type="checkbox"
                                    checked={!!editandoPergunta.condicao}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setEditandoPergunta({
                                          ...editandoPergunta,
                                          condicao: {
                                            perguntaId: null,
                                            operador: "igual",
                                            valor: ""
                                          }
                                        });
                                      } else {
                                        setEditandoPergunta({
                                          ...editandoPergunta,
                                          condicao: null
                                        });
                                      }
                                    }}
                                    className="w-4 h-4 text-blue-600 rounded"
                                  />
                                  <span className="text-sm font-medium text-gray-700">
                                    Pergunta Condicional (só aparece se...)
                                  </span>
                                </label>

                                {editandoPergunta.condicao && (
                                  <div className="space-y-3 mt-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Depende da pergunta:
                                      </label>
                                      <select
                                        value={editandoPergunta.condicao.perguntaId || ""}
                                        onChange={(e) => setEditandoPergunta({
                                          ...editandoPergunta,
                                          condicao: {
                                            ...editandoPergunta.condicao,
                                            perguntaId: parseInt(e.target.value)
                                          }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                      >
                                        <option value="">Selecione...</option>
                                        {(questionariosPorDept[departamentoSelecionado] || [])
                                          .filter(p => p.id !== editandoPergunta.id)
                                          .map(p => (
                                            <option key={p.id} value={p.id}>
                                              {p.label}
                                            </option>
                                          ))}
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Condição:
                                      </label>
                                      <select
                                        value={editandoPergunta.condicao.operador}
                                        onChange={(e) => setEditandoPergunta({
                                          ...editandoPergunta,
                                          condicao: {
                                            ...editandoPergunta.condicao,
                                            operador: e.target.value
                                          }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                      >
                                        <option value="igual">É igual a</option>
                                        <option value="diferente">É diferente de</option>
                                        <option value="contem">Contém</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Valor:
                                      </label>
                                      <input
                                        type="text"
                                        value={editandoPergunta.condicao.valor}
                                        onChange={(e) => setEditandoPergunta({
                                          ...editandoPergunta,
                                          condicao: {
                                            ...editandoPergunta.condicao,
                                            valor: e.target.value
                                          }
                                        })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        placeholder="Ex: Sim"
                                      />
                                    </div>

                                    <div className="bg-white p-2 rounded border border-blue-300">
                                      <p className="text-xs text-gray-600">
                                        📌 Esta pergunta só aparecerá se "{
                                          (questionariosPorDept[departamentoSelecionado] || [])
                                            .find(p => p.id === editandoPergunta.condicao.perguntaId)?.label
                                        }" {editandoPergunta.condicao.operador} "{editandoPergunta.condicao.valor}"
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                              {editandoPergunta.tipo === "select" && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Opções de Resposta
                                  </label>
                                  <div className="space-y-2">
                                    {editandoPergunta.opcoes.map((opcao, index) => (
                                      <div key={index} className="flex gap-2">
                                        <input
                                          type="text"
                                          value={opcao}
                                          onChange={(e) =>
                                            atualizarOpcao(index, e.target.value)
                                          }
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                                          placeholder={`Opção ${index + 1}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removerOpcao(index)}
                                          className="px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                        >
                                          <X size={14} />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={adicionarOpcao}
                                      className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 text-gray-600 hover:text-purple-600 text-sm"
                                    >
                                      + Adicionar Opção
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2 pt-2">
                                <button
                                  type="button"
                                  onClick={() => setEditandoPergunta(null)}
                                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  onClick={salvarPergunta}
                                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                                >
                                  Salvar Pergunta
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {perguntasDepto.length > 0 && (
                          <div>
                            <h6 className="text-sm font-medium text-gray-700 mb-2">
                              Perguntas Criadas ({perguntasDepto.length}):
                            </h6>
                            <div className="space-y-2">
                              {perguntasDepto.map((pergunta, index) => (
                                <div
                                  key={pergunta.id}
                                  className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-medium">
                                          {index + 1}
                                        </span>

                                        <span className="font-medium text-sm">
                                          {pergunta.label}
                                        </span>
                                        {pergunta.obrigatorio && (
                                          <span className="text-red-500 text-xs">*</span>
                                        )}




                                      </div>
                                      <div className="text-xs text-gray-600">
                                        Tipo:{" "}
                                        {
                                          tiposCampo.find((t) => t.valor === pergunta.tipo)
                                            ?.label
                                        }
                                      </div>

                                    </div>


                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setEditandoPergunta(pergunta)}
                                        className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                                      >
                                        <Edit size={14} />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => excluirPergunta(pergunta.id)}
                                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {usuarioLogado?.role === "admin" && (
              <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={salvarComoTemplateChecked}
                    onChange={(e) => setSalvarComoTemplateChecked(e.target.checked)}
                    className="w-5 h-5 text-yellow-600 rounded focus:ring-yellow-500"
                  />
                  <div>
                    <span className="font-medium text-yellow-800 block">
                      Salvar como Template de Solicitação
                    </span>
                    <p className="text-sm text-yellow-600 mt-1">
                      Crie um template reutilizável com este fluxo e questionários
                    </p>
                  </div>
                </label>
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Criar Solicitação
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };


  const confirmarExclusaoUsuario = (usuario) => {
    return mostrarConfirmacao({
      tipo: "usuario",
      nome: usuario.nome,
      titulo: "Excluir Usuário",
      mensagem: `Tem certeza que deseja excluir o usuário "${usuario.nome}"?\n\nEsta ação não pode ser desfeita.`,
      textoConfirmar: "Sim, Excluir"
    });
  };
  const ModalConfirmacao = ({
    titulo,
    mensagem,
    onConfirm,
    onCancel,
    tipo = "info",
    textoConfirmar = "Confirmar",
    textoCancelar = "Cancelar"
  }) => {
    const getConfigTipo = () => {
      switch (tipo) {
        case "perigo":
          return {
            cor: "from-red-500 to-red-600",
            icone: <AlertCircle size={24} className="text-white" />,
            botaoConfirmar: "from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
          };
        case "aviso":
          return {
            cor: "from-amber-500 to-amber-600",
            icone: <AlertCircle size={24} className="text-white" />,
            botaoConfirmar: "from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
          };
        case "sucesso":
          return {
            cor: "from-green-500 to-green-600",
            icone: <CheckCircle size={24} className="text-white" />,
            botaoConfirmar: "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
          };
        default:
          return {
            cor: "from-blue-500 to-blue-600",
            icone: <AlertCircle size={24} className="text-white" />,
            botaoConfirmar: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          };
      }
    };

    const config = getConfigTipo();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 hover:scale-105">
          <div className={`bg-gradient-to-r ${config.cor} p-6 rounded-t-2xl`}>
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                {config.icone}
              </div>
              <h3 className="text-xl font-bold text-white">{titulo}</h3>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {config.icone}
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">{mensagem}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
              >
                {textoCancelar}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 px-6 py-3 bg-gradient-to-r ${config.botaoConfirmar} text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl`}
              >
                {textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const ModalConfirmacaoGenerica = ({ config, onConfirm, onCancel }) => {
    const cores = {
      info: {
        header: "from-blue-500 to-blue-600",
        icone: <CheckCircle size={32} className="text-blue-600" />,
        bg: "bg-blue-100",
        botao: "from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
      },
      sucesso: {
        header: "from-green-500 to-green-600",
        icone: <CheckCircle size={32} className="text-green-600" />,
        bg: "bg-green-100",
        botao: "from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
      },
      aviso: {
        header: "from-amber-500 to-amber-600",
        icone: <AlertCircle size={32} className="text-amber-600" />,
        bg: "bg-amber-100",
        botao: "from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
      }
    };

    const estilo = cores[config.tipo] || cores.info;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className={`bg-gradient-to-r ${estilo.header} p-6 rounded-t-2xl`}>
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                <AlertCircle size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{config.titulo}</h3>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <div className={`w-16 h-16 ${estilo.bg} rounded-full flex items-center justify-center mx-auto mb-4`}>
                {estilo.icone}
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">{config.mensagem}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
              >
                {config.textoCancelar || "Cancelar"}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 px-6 py-3 bg-gradient-to-r ${estilo.botao} text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl`}
              >
                {config.textoConfirmar || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ModalConfirmacaoExclusao = ({
    tipo,
    nome,
    onConfirm,
    onCancel
  }) => {
    const [processing, setProcessing] = useState(false);

    const handleConfirm = async () => {
      setProcessing(true);
      try {
        await onConfirm();
      } catch (error) {
        console.error('Erro na confirmação:', error);
      } finally {
        setProcessing(false);
      }
    };

    const getConfig = () => {
      switch (tipo) {
        case "processo":
          return {
            titulo: "Excluir Processo",
            mensagem: `Tem certeza que deseja excluir o processo "${nome}"?\n\nEsta ação não pode ser desfeita.`,
            icone: <X size={32} className="text-red-600" />
          };
        case "departamento":
          return {
            titulo: "Excluir Departamento",
            mensagem: `Tem certeza que deseja excluir o departamento "${nome}"?\n\nEsta ação não pode ser desfeita.`,
            icone: <X size={32} className="text-red-600" />
          };
        case "tag":
          return {
            titulo: "Excluir Tag",
            mensagem: `Tem certeza que deseja excluir a tag "${nome}"?\n\nEsta ação removerá a tag de todos os processos.`,
            icone: <X size={32} className="text-red-600" />
          };
        case "comentario":
          return {
            titulo: "Excluir Comentário",
            mensagem: "Tem certeza que deseja excluir este comentário?",
            icone: <X size={32} className="text-red-600" />
          };
        case "documento":
          return {
            titulo: "Excluir Documento",
            mensagem: `Tem certeza que deseja excluir o documento "${nome}"?`,
            icone: <X size={32} className="text-red-600" />
          };
        case "template":
          return {
            titulo: "Excluir Template",
            mensagem: `Tem certeza que deseja excluir o template "${nome}"?`,
            icone: <X size={32} className="text-red-600" />
          };
        default:
          return {
            titulo: "Confirmar Exclusão",
            mensagem: `Tem certeza que deseja excluir "${nome}"?`,
            icone: <X size={32} className="text-red-600" />
          };
      }
    };

    const config = getConfig();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                <AlertCircle size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-white">{config.titulo}</h3>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {config.icone}
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">{config.mensagem}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onCancel}
                disabled={processing}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                onClick={handleConfirm}
                disabled={processing}
                className={`flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl
                ${processing ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {processing ? 'Processando...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const executarFinalizacao = async (processoId) => {
    try {
      const processo = processos.find(p => p.id === processoId);
      if (!processo) return;

      const dataAtual = new Date();
      const processoAtualizado = {
        ...processo,
        status: "Finalizado",
        dataFinalizacao: dataAtual.toISOString(),
        progresso: 100,
        historico: [
          ...processo.historico,
          {
            departamento: "Sistema",
            data: dataAtual.toISOString(),
            dataTimestamp: dataAtual.getTime(),
            acao: "Processo finalizado com sucesso",
            responsavel: usuarioLogado?.nome || "Sistema",
            tipo: "finalizacao",
          },
        ],
      };

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify(processoAtualizado)
      });

      const resultado = await response.json();

      if (resultado.sucesso) {
        await carregarProcessos();
        adicionarNotificacao(
          `✅ Processo "${processo.nomeEmpresa}" finalizado com sucesso!`,
          "sucesso"
        );
      } else {
        await mostrarAlerta("Erro", resultado.erro, "erro");
      }
    } catch (error) {
      console.error('❌ Erro ao executar finalização:', error);
      await mostrarAlerta("Erro", error.message, "erro");
    }
  };


  const ModalAlerta = ({
    titulo,
    mensagem,
    tipo = "info",
    onClose
  }) => {
    const getConfig = () => {
      switch (tipo) {
        case "erro":
          return {
            cor: "from-red-500 to-red-600",
            icone: <AlertCircle size={24} className="text-white" />,
            iconeCentral: <AlertCircle size={32} className="text-red-600" />
          };
        case "aviso":
          return {
            cor: "from-amber-500 to-amber-600",
            icone: <AlertCircle size={24} className="text-white" />,
            iconeCentral: <AlertCircle size={32} className="text-amber-600" />
          };
        case "sucesso":
          return {
            cor: "from-green-500 to-green-600",
            icone: <CheckCircle size={24} className="text-white" />,
            iconeCentral: <CheckCircle size={32} className="text-green-600" />
          };
        default:
          return {
            cor: "from-blue-500 to-blue-600",
            icone: <AlertCircle size={24} className="text-white" />,
            iconeCentral: <AlertCircle size={32} className="text-blue-600" />
          };
      }
    };

    const config = getConfig();

    return (
      <div className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-md flex items-center justify-center z-[100000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 relative">
          <div className={`bg-gradient-to-r ${config.cor} p-6 rounded-t-2xl`}>
            <div className="flex items-center gap-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-full">
                {config.icone}
              </div>
              <h3 className="text-xl font-bold text-white">{titulo}</h3>
            </div>
          </div>

          <div className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {config.iconeCentral}
              </div>
              <p className="text-gray-600 whitespace-pre-wrap">{mensagem}</p>
            </div>

            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };









  const ModalCadastrarEmpresa = ({ onClose, empresa }) => {
    // ✅ ADICIONAR ESTE ESTADO NO INÍCIO
    const [empresaCadastrada, setEmpresaCadastrada] = useState(
      empresa ? empresa.cadastrada !== false : true
    );

    const [formData, setFormData] = useState({
      cnpj: '',
      codigo: '',
      razao_social: '',
      apelido: '',
      inscricao_estadual: '',
      inscricao_municipal: '',
      regime_federal: '',
      regime_estadual: '',
      regime_municipal: '',
      data_abertura: '',
      estado: '',
      cidade: '',
      bairro: '',
      logradouro: '',
      numero: '',
      cep: '',
cadastrada: empresaCadastrada
    });

    const handleChange = (field, value) => {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    };


useEffect(() => {
  handleChange('cadastrada', empresaCadastrada);
}, [empresaCadastrada]);
    const formatarCPFCNPJ = (valor) => {
      const apenasNumeros = valor.replace(/\D/g, '');

      if (apenasNumeros.length <= 11) {
        // Formatar como CPF: 000.000.000-00
        return apenasNumeros
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d{1,2})/, '$1-$2')
          .replace(/(-\d{2})\d+?$/, '$1');
      } else {
        // Formatar como CNPJ: 00.000.000/0000-00
        return apenasNumeros
          .replace(/(\d{2})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1.$2')
          .replace(/(\d{3})(\d)/, '$1/$2')
          .replace(/(\d{4})(\d)/, '$1-$2')
          .replace(/(-\d{2})\d+?$/, '$1');
      }
    };

    const formatarTelefone = (valor) => {
      const apenasNumeros = valor.replace(/\D/g, '');

      if (apenasNumeros.length <= 10) {
        // Telefone fixo: (00) 0000-0000
        return apenasNumeros
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{4})(\d)/, '$1-$2')
          .replace(/(-\d{4})\d+?$/, '$1');
      } else {
        // Celular: (00) 00000-0000
        return apenasNumeros
          .replace(/(\d{2})(\d)/, '($1) $2')
          .replace(/(\d{5})(\d)/, '$1-$2')
          .replace(/(-\d{4})\d+?$/, '$1');
      }
    };

    const formatarCEP = (valor) => {
      const apenasNumeros = valor.replace(/\D/g, '');
      if (apenasNumeros.length <= 5) {
        return apenasNumeros;
      }
      return `${apenasNumeros.slice(0, 5)}-${apenasNumeros.slice(5, 8)}`;
    };

    // ✅ ATUALIZAR useEffect
    useEffect(() => {
      if (empresa) {
        setFormData(empresa);
        setEmpresaCadastrada(empresa.cadastrada !== false);
      }
    }, [empresa]);


const handleSubmit = async (e) => {
  e.preventDefault();

  // ✅ VALIDAÇÃO CORRIGIDA
  if (!formData.codigo || !formData.razao_social) {
    await mostrarAlerta("Campos Obrigatórios", "Código e Razão Social são obrigatórios", "aviso");
    return;
  }

  // ✅ SE FOR EMPRESA CADASTRADA, CNPJ É OBRIGATÓRIO
  if (empresaCadastrada && !formData.cnpj) {
    await mostrarAlerta(
      "CNPJ Obrigatório", 
      "Empresas cadastradas precisam ter CNPJ", 
      "aviso"
    );
    return;
  }

  try {
    // ✅ GARANTIR QUE O CAMPO CADASTRADA ESTÁ CORRETO
    const dadosParaSalvar = {
      ...formData,
      cadastrada: empresaCadastrada, // ✅ FORÇAR O VALOR DO RADIO BUTTON
      cnpj: empresaCadastrada ? formData.cnpj : null // ✅ Se não for cadastrada, CNPJ = null
    };

    let resultado;

    if (empresa) {
      resultado = await api.atualizarEmpresa(empresa.id, dadosParaSalvar);
    } else {
      resultado = await api.salvarEmpresa(dadosParaSalvar);
    }

    if (resultado.sucesso) {
      await carregarEmpresas();
      onClose();
      adicionarNotificacao(
        empresa ? "Empresa atualizada com sucesso" : "Empresa cadastrada com sucesso",
        "sucesso"
      );
    } else {
      await mostrarAlerta("Erro ao Salvar", resultado.erro || "Erro desconhecido", "erro");
    }
  } catch (error) {
    console.error('Erro ao salvar empresa:', error);
    await mostrarAlerta("Erro", error.message, "erro");
  }
};

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 modal-cadastro-empresa">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {empresa ? "Editar Empresa" : "Cadastrar Nova Empresa"}
              </h3>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-4">Tipo de Empresa</h4>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-all flex-1">
                  <input
                    type="radio"
                    name="tipoCadastro"
                    checked={empresaCadastrada}
                    onChange={() => setEmpresaCadastrada(true)}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Empresa Cadastrada</div>
                    <div className="text-xs text-gray-600">Já possui CNPJ e Razão Social</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer bg-white p-4 rounded-lg border-2 border-gray-200 hover:border-blue-500 transition-all flex-1">
                  <input
                    type="radio"
                    name="tipoCadastro"
                    checked={!empresaCadastrada}
                    onChange={() => setEmpresaCadastrada(false)}
                    className="w-5 h-5 text-blue-600"
                  />
                  <div>
                    <div className="font-semibold text-gray-900">Empresa Nova</div>
                    <div className="text-xs text-gray-600">Ainda não possui CNPJ</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-4">
                Dados Principais {empresaCadastrada && '*'}
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* ✅ CPF/CNPJ COM FORMATAÇÃO */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CPF/CNPJ {empresaCadastrada && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.cnpj}
                    onChange={(e) => {
                      const valorFormatado = formatarCPFCNPJ(e.target.value);
                      handleChange('cnpj', valorFormatado);
                    }}
                    onKeyDown={(e) => {
                      // Permitir apenas números e teclas de controle
                      if (
                        e.ctrlKey || e.metaKey ||
                        ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                        /^[0-9]$/.test(e.key)
                      ) return;
                      e.preventDefault();
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                    placeholder={empresaCadastrada ? "000.000.000-00 ou 00.000.000/0000-00" : "Opcional"}
                    required={empresaCadastrada}
                    maxLength={18} // CNPJ formatado tem 18 caracteres
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Código <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => handleChange('codigo', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                    placeholder="001"
                    required // ✅ SEMPRE OBRIGATÓRIO
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Razão Social {empresaCadastrada && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    value={formData.razao_social}
                    onChange={(e) => handleChange('razao_social', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                    placeholder={empresaCadastrada ? "Nome oficial da empresa" : "Nome provisório (opcional)"}
                    required={empresaCadastrada} // ✅ CONDICIONAL
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Apelido/Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={formData.apelido}
                    onChange={(e) => handleChange('apelido', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500"
                    placeholder="Apelido"
                  />
                </div>
              </div>

              {/* ✅ ADICIONAR ALERTA VISUAL */}
              {!empresaCadastrada && (
                <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    ⚠️ <strong>Empresa não cadastrada:</strong> Os campos CNPJ e Razão Social são opcionais.
                    Complete estas informações quando a empresa for oficializada.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 mt-6">
              <h4 className="font-semibold text-blue-800 mb-4">Inscrições e Regimes</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Inscrição Estadual
                  </label>
                  <input
                    type="text"
                    value={formData.inscricao_estadual}
                    onChange={(e) => handleChange('inscricao_estadual', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Inscrição Municipal
                  </label>
                  <input
                    type="text"
                    value={formData.inscricao_municipal}
                    onChange={(e) => handleChange('inscricao_municipal', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Regime Federal
                  </label>
                  <select
                    value={formData.regime_federal}
                    onChange={(e) => handleChange('regime_federal', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="Simples Nacional">Simples Nacional</option>
                    <option value="Lucro Presumido">Lucro Presumido</option>
                    <option value="Lucro Real">Lucro Real</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Regime Estadual
                  </label>
                  <input
                    type="text"
                    value={formData.regime_estadual}
                    onChange={(e) => handleChange('regime_estadual', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Regime Municipal
                  </label>
                  <input
                    type="text"
                    value={formData.regime_municipal}
                    onChange={(e) => handleChange('regime_municipal', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200 mt-6">
              <h4 className="font-semibold text-purple-800 mb-4">Endereço</h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    CEP
                  </label>
                  <input
                    type="text"
                    value={formData.cep}
                    onChange={(e) => {
                      const apenasNumeros = e.target.value.replace(/\D/g, '');
                      const valorFormatado = formatarCEP(apenasNumeros);
                      handleChange('cep', valorFormatado);
                    }}
                    onKeyDown={(e) => {
                      if (
                        e.ctrlKey || e.metaKey ||
                        ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                        /^[0-9]$/.test(e.key)
                      ) return;
                      e.preventDefault();
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Estado
                  </label>
                  <select
                    value={formData.estado}
                    onChange={(e) => handleChange('estado', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecione...</option>
                    <option value="AC">AC</option>
                    <option value="AL">AL</option>
                    <option value="AP">AP</option>
                    <option value="AM">AM</option>
                    <option value="BA">BA</option>
                    <option value="CE">CE</option>
                    <option value="DF">DF</option>
                    <option value="ES">ES</option>
                    <option value="GO">GO</option>
                    <option value="MA">MA</option>
                    <option value="MT">MT</option>
                    <option value="MS">MS</option>
                    <option value="MG">MG</option>
                    <option value="PA">PA</option>
                    <option value="PB">PB</option>
                    <option value="PR">PR</option>
                    <option value="PE">PE</option>
                    <option value="PI">PI</option>
                    <option value="RJ">RJ</option>
                    <option value="RN">RN</option>
                    <option value="RS">RS</option>
                    <option value="RO">RO</option>
                    <option value="RR">RR</option>
                    <option value="SC">SC</option>
                    <option value="SP">SP</option>
                    <option value="SE">SE</option>
                    <option value="TO">TO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.cidade}
                    onChange={(e) => handleChange('cidade', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={formData.bairro}
                    onChange={(e) => handleChange('bairro', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Logradouro
                  </label>
                  <input
                    type="text"
                    value={formData.logradouro}
                    onChange={(e) => handleChange('logradouro', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                    placeholder="Rua, Avenida..."
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Número
                </label>
                <input
                  type="text"
                  value={formData.numero}
                  onChange={(e) => {
                    const apenasNumeros = e.target.value.replace(/\D/g, '');
                    handleChange('numero', apenasNumeros);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.ctrlKey || e.metaKey ||
                      ['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) ||
                      /^[0-9]$/.test(e.key)
                    ) return;
                    e.preventDefault();
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>


            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                {empresa ? "Salvar Alterações" : "Cadastrar Empresa"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };
  const ModalCriarDepartamento = ({ onClose, onSave, departamento }) => {
    const [nome, setNome] = useState(departamento?.nome || "");
    const [responsavel, setResponsavel] = useState(
      departamento?.responsavel || ""
    );
    const [descricao, setDescricao] = useState(departamento?.descricao || "");
    const [corSelecionada, setCorSelecionada] = useState(
      departamento?.cor
        ? coresDisponiveis.find((c) => c.gradient === departamento.cor) || coresDisponiveis[0]
        : coresDisponiveis[0]
    );
    const [iconeSelecionado, setIconeSelecionado] = useState(
      departamento?.icone
        ? iconesDisponiveis.find((i) => i.componente === departamento.icone) || iconesDisponiveis[0]
        : iconesDisponiveis[0]
    );
    const [docsObrigatorios, setDocsObrigatorios] = useState(
      departamento?.documentosObrigatorios || []
    );

    const handleSubmit = (e) => {
      e.preventDefault();

      if (!nome.trim()) {
        alert("Digite o nome do departamento!");
        return;
      }

      if (!responsavel.trim()) {
        alert("Digite o nome do responsável!");
        return;
      }

      onSave({
        nome,
        responsavel,
        descricao,
        cor: corSelecionada,
        icone: iconeSelecionado,
        documentosObrigatorios: docsObrigatorios
      });
    };


    const adicionarDocumentoObrigatorio = () => {
      const novoDoc = {
        id: Date.now(),
        tipo: `documento_${docsObrigatorios.length + 1}`,
        nome: `Documento ${docsObrigatorios.length + 1}`,
        descricao: "Descrição do documento",
      };
      setDocsObrigatorios([...docsObrigatorios, novoDoc]);
    };

    const removerDocumentoObrigatorio = (id) => {
      setDocsObrigatorios(docsObrigatorios.filter((doc) => doc.id !== id));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div
            className={`bg-gradient-to-r ${corSelecionada.gradient} p-6 rounded-t-2xl sticky top-0`}
          >
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {departamento
                  ? "Editar Departamento"
                  : "Criar Novo Departamento"}
              </h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome do Departamento <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                placeholder="Ex: Cadastro, RH, Fiscal..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Responsável <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={responsavel}
                onChange={(e) => setResponsavel(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                placeholder="Nome do responsável"
                required
              />
            </div>

            <div></div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Cor do Departamento
              </label>
              <div className="grid grid-cols-3 gap-3">
                {coresDisponiveis.map((cor) => (
                  <button
                    key={cor.nome}
                    type="button"
                    onClick={() => setCorSelecionada(cor)}
                    className={`p-4 rounded-xl bg-gradient-to-r ${cor.gradient
                      } text-white font-medium transition-all ${(corSelecionada?.nome === cor.nome)
                        ? "ring-4 ring-offset-2 ring-gray-400 scale-105"
                        : "hover:scale-105"
                      }`}
                  >
                    {cor.nome}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ícone do Departamento
              </label>
              <div className="grid grid-cols-6 gap-3">
                {iconesDisponiveis.map((icone) => {
                  const IconeComp = icone.componente;
                  return (
                    <button
                      key={icone.nome}
                      type="button"
                      onClick={() => setIconeSelecionado(icone)}
                      className={`p-4 rounded-xl border-2 transition-all ${(iconeSelecionado?.nome === icone.nome)
                          ? "border-cyan-500 bg-cyan-50 scale-110"
                          : "border-gray-300 hover:border-cyan-300 hover:scale-105"
                        }`}
                      title={icone.nome}
                    >
                      <IconeComp
                        size={24}
                        className={
                          (iconeSelecionado?.nome === icone.nome)
                            ? "text-cyan-600"
                            : "text-gray-600"
                        }
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="space-y-2">
                {docsObrigatorios.filter(Boolean).map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div>
                      <span className="font-medium text-sm">{doc?.nome}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({doc.tipo})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removerDocumentoObrigatorio(doc.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium"
              >
                {departamento ? "Salvar Alterações" : "Criar Departamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };



  const ModalEditarQuestionarioSolicitacao = ({ processo, departamentoId, onClose, onSave }) => {
    const [perguntas, setPerguntas] = useState([]);
    const [editandoPergunta, setEditandoPergunta] = useState(null);
    useEffect(() => {
      console.log('📋 Modal aberto - Buscando questionário do departamento:', {
        processoId: processo.id,
        departamentoId,
        questionariosPorDepartamento: processo.questionariosPorDepartamento,
        respostasHistorico: processo.respostasHistorico
      });

      const questionario = processo.questionariosPorDepartamento?.[String(departamentoId)] || [];

      console.log('✅ Questionário encontrado para edição:', {
        total: questionario.length,
        perguntas: questionario,
        respostasExistentes: processo.respostasHistorico?.[departamentoId]?.respostas
      });

      setPerguntas(questionario);
    }, [processo, departamentoId]);
    useEffect(() => {
      console.log('📋 Modal aberto - Buscando questionário do departamento:', {
        processoId: processo.id,
        departamentoId,
        questionariosPorDepartamento: processo.questionariosPorDepartamento
      });

      const questionario = processo.questionariosPorDepartamento?.[String(departamentoId)] || [];

      console.log('✅ Questionário encontrado para edição:', {
        total: questionario.length,
        perguntas: questionario
      });

      setPerguntas(questionario);
    }, [processo, departamentoId]);

    const tiposCampo = [
      { valor: "text", label: "Texto Simples" },
      { valor: "textarea", label: "Texto Longo" },
      { valor: "number", label: "Número" },
      { valor: "date", label: "Data" },
      { valor: "boolean", label: "Sim/Não" },
      { valor: "select", label: "Seleção Única" },
      { valor: "file", label: "Arquivo/Anexo" },
      { valor: "phone", label: "Telefone" },
      { valor: "email", label: "Email" },
    ];

    useEffect(() => {
      console.log('📋 Modal aberto com perguntas do departamento:', {
        departamentoId,
        perguntas: processo.questionariosPorDepartamento?.[departamentoId],
        totalPerguntas: (processo.questionariosPorDepartamento?.[departamentoId] || []).length
      });

      setPerguntas(processo.questionariosPorDepartamento?.[departamentoId] || []);
    }, [processo, departamentoId]);

    const adicionarPergunta = (tipo) => {
      const novaPergunta = {
        id: Date.now(),
        label: "",
        tipo: tipo,
        obrigatorio: false,
        opcoes: tipo === "select" ? [""] : [],
        ordem: perguntas.length + 1,
      };
      setEditandoPergunta(novaPergunta);
    };

    const salvarPergunta = async () => {
      if (!editandoPergunta.label.trim()) {
        await mostrarAlerta("Campo Obrigatório", "Digite o texto da pergunta!", "aviso");
        return;
      }

      if (
        editandoPergunta.tipo === "select" &&
        editandoPergunta.opcoes.filter((o) => o.trim()).length === 0
      ) {
        await mostrarAlerta("Opções Necessárias", "Adicione pelo menos uma opção de resposta!", "aviso");
        return;
      }

      if (perguntas.find((p) => p.id === editandoPergunta.id)) {
        setPerguntas(
          perguntas.map((p) =>
            p.id === editandoPergunta.id ? editandoPergunta : p
          )
        );
      } else {
        setPerguntas([...perguntas, editandoPergunta]);
      }
      setEditandoPergunta(null);
    };

    const excluirPergunta = (id) => {
      setPerguntas(perguntas.filter((p) => p.id !== id));
    };

    const adicionarOpcao = () => {
      setEditandoPergunta({
        ...editandoPergunta,
        opcoes: [...editandoPergunta.opcoes, ""],
      });
    };

    const atualizarOpcao = (index, valor) => {
      const novasOpcoes = [...editandoPergunta.opcoes];
      novasOpcoes[index] = valor;
      setEditandoPergunta({ ...editandoPergunta, opcoes: novasOpcoes });
    };

    const removerOpcao = (index) => {
      setEditandoPergunta({
        ...editandoPergunta,
        opcoes: editandoPergunta.opcoes.filter((_, i) => i !== index),
      });
    };

    const handleSalvar = async () => {
      if (perguntas.length === 0) {
        await mostrarAlerta("Sem Perguntas", "Crie pelo menos uma pergunta!", "aviso");
        return;
      }

      console.log('Salvando perguntas:', {
        processoId: processo.id,
        departamentoId: departamentoId,
        perguntas: perguntas,
        totalPerguntas: perguntas.length
      });

      await onSave(processo.id, departamentoId, perguntas);

      setShowQuestionarioSolicitacao(null);
      setShowQuestionario({
        processoId: processo.id,
        departamentoId: departamentoId,
        somenteLeitura: true
      });



      await onSave(processo.id, departamentoId, perguntas);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Editar Questionário da Solicitação
                </h3>
                <p className="text-white opacity-90 text-sm mt-1">
                  {processo.nomeEmpresa}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            {!editandoPergunta && (
              <div className="mb-8">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Adicionar Nova Pergunta:
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  {tiposCampo.map((tipo) => (
                    <button
                      key={tipo.valor}
                      onClick={() => adicionarPergunta(tipo.valor)}
                      className="p-4 border-2 border-gray-300 rounded-xl hover:border-cyan-500 hover:bg-cyan-50 transition-all text-left"
                    >
                      <div className="font-medium text-gray-900">
                        {tipo.label}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editandoPergunta && (
              <div className="bg-cyan-50 rounded-xl p-6 mb-6 border-2 border-cyan-300">
                <h4 className="font-semibold text-gray-800 mb-4">
                  Editando Pergunta:
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Texto da Pergunta <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editandoPergunta.label}
                      onChange={(e) =>
                        setEditandoPergunta({
                          ...editandoPergunta,
                          label: e.target.value,
                        })
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                      placeholder="Ex: Qual o nome da empresa?"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="obrigatorio"
                      checked={editandoPergunta.obrigatorio}
                      onChange={(e) =>
                        setEditandoPergunta({
                          ...editandoPergunta,
                          obrigatorio: e.target.checked,
                        })
                      }
                      className="w-5 h-5 text-cyan-600 rounded focus:ring-cyan-500"
                    />
                    <label
                      htmlFor="obrigatorio"
                      className="text-sm font-medium text-gray-700"
                    >
                      Campo obrigatório
                    </label>
                  </div>

                  {editandoPergunta.tipo === "select" && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Opções de Resposta
                      </label>
                      <div className="space-y-2">
                        {editandoPergunta.opcoes.map((opcao, index) => (
                          <div key={index} className="flex gap-2">
                            <input
                              type="text"
                              value={opcao}
                              onChange={(e) =>
                                atualizarOpcao(index, e.target.value)
                              }
                              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                              placeholder={`Opção ${index + 1}`}
                            />
                            <button
                              type="button"
                              onClick={() => removerOpcao(index)}
                              className="px-2 py-1 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={adicionarOpcao}
                          className="w-full px-3 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-cyan-500 text-gray-600 hover:text-cyan-600"
                        >
                          + Adicionar Opção
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditandoPergunta(null)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={salvarPergunta}
                      className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
                    >
                      Salvar Pergunta
                    </button>
                  </div>
                </div>
              </div>
            )}

            {perguntas.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-4">
                  Perguntas ({perguntas.length}):
                </h4>
                <div className="space-y-2">
                  {perguntas.map((pergunta, index) => (
                    <div
                      key={pergunta.id}
                      className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-xs font-medium">
                              {index + 1}
                            </span>
                            <span className="font-medium text-sm">
                              {pergunta.label}
                            </span>
                            {pergunta.obrigatorio && (
                              <span className="text-red-500 text-xs">*</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-600">
                            Tipo: {tiposCampo.find((t) => t.valor === pergunta.tipo)?.label}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => setEditandoPergunta(pergunta)}
                            className="p-1 text-cyan-600 hover:bg-cyan-100 rounded"
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            onClick={() => excluirPergunta(pergunta.id)}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium"
              >
                Salvar Questionário da Solicitação
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const ModalSelecionarTemplate = ({ onClose, onSelecionarTemplate }) => {
    const [templateSelecionado, setTemplateSelecionado] = useState(null);
    const [empresaSelecionadaSolicitacao, setEmpresaSelecionadaSolicitacao] = useState(null);
    const [responsavel, setResponsavel] = useState(""); // ✅ NOVO ESTADO
    const [showMenuTemplate, setShowMenuTemplate] = useState(null);
    const [templateComTooltip, setTemplateComTooltip] = useState(null);
    const [templateComTooltipNome, setTemplateComTooltipNome] = useState(null);

    const handleCriar = () => {
      if (!templateSelecionado) {
        mostrarAlerta("Selecione um Template", "Escolha um template para continuar", "aviso");
        return;
      }

      if (!empresaSelecionadaSolicitacao) {
        mostrarAlerta("Selecione uma Empresa", "Escolha uma empresa cadastrada para continuar", "aviso");
        return;
      }

      const template = templatesDisponiveis.find(t => t.id === templateSelecionado);
      if (!template) return;

      try {
        const fluxoDepartamentos = JSON.parse(template.fluxo_departamentos);

        if (usuarioLogado?.role === "gerente") {
          const fluxoValido = validarFluxoParaGerente(fluxoDepartamentos);
          if (!fluxoValido) {
            mostrarAlerta(
              "Template Não Permitido",
              "Este template contém departamentos que você não tem permissão para usar",
              "erro"
            );
            return;
          }
        }

        const questionariosPorDepartamento = JSON.parse(template.questionarios_por_departamento);

        const dadosSolicitacao = {
          nomeEmpresa: empresaSelecionadaSolicitacao.razao_social,
          cliente: responsavel || empresaSelecionadaSolicitacao.razao_social,
          email: empresaSelecionadaSolicitacao.email || "",
          telefone: empresaSelecionadaSolicitacao.telefone || "",
          empresaId: empresaSelecionadaSolicitacao.id,
          nomeServico: template.nome,
          questionariosPorDepartamento,
          fluxoDepartamentos
        };

        onSelecionarTemplate(dadosSolicitacao);
      } catch (error) {
        console.error('Erro ao processar template:', error);
        adicionarNotificacao('Erro ao carregar template selecionado', 'erro');
      }
    };

    const excluirTemplate = async (templateId, templateNome) => {
      if (!temPermissao("excluir_departamento")) {
        await mostrarAlerta("Sem Permissão", "Apenas administradores podem excluir templates", "erro");
        return;
      }

      const confirmou = await mostrarConfirmacao({
        tipo: "template",
        nome: templateNome,
        titulo: "Excluir Template",
        mensagem: `Tem certeza que deseja excluir o template "${templateNome}"?\n\nEsta ação não pode ser desfeita.`,
        textoConfirmar: "Sim, Excluir"
      });

      if (!confirmou) return;

      try {
        const resultado = await api.excluirTemplate(templateId);

        if (resultado.sucesso) {
          await carregarTemplates();
          adicionarNotificacao(`Template "${templateNome}" excluído com sucesso`, "sucesso");
        } else {
          adicionarNotificacao(`Erro ao excluir template: ${resultado.erro}`, "erro");
        }
      } catch (error) {
        console.error('Erro ao excluir template:', error);
        adicionarNotificacao(`Erro ao excluir template: ${error.message}`, "erro");
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  📋 Nova Solicitação (Template)
                </h3>
                <p className="text-white opacity-90 text-sm mt-1">
                  Selecione um template e preencha os dados básicos
                </p>
              </div>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleCriar(); }} className="p-6 space-y-6">
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-4">Dados da Empresa</h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Selecionar Empresa Cadastrada <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={empresaSelecionadaSolicitacao?.id || ""}
                    onChange={(e) => {
                      const empresaId = e.target.value;
                      if (empresaId) {
                        const empresa = empresas.find(emp => emp.id === parseInt(empresaId));
                        setEmpresaSelecionadaSolicitacao(empresa);
                      } else {
                        setEmpresaSelecionadaSolicitacao(null);
                      }
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                    required
                  >
                    <option value="">Selecione uma empresa</option>
                    {empresas.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.codigo} - {emp.razao_social}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Responsável
                  </label>
                  <input
                    type="text"
                    value={responsavel}
                    onChange={(e) => setResponsavel(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                    placeholder="Nome do responsável"
                  />
                </div>
              </div>

              {empresaSelecionadaSolicitacao && (
                <div className="mt-3 bg-white rounded-lg p-3 border border-purple-200">
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-gray-900">{empresaSelecionadaSolicitacao.razao_social}</p>
                    <p className="text-gray-600">📄 CNPJ: {empresaSelecionadaSolicitacao.cnpj}</p>
                    {responsavel && (
                      <p className="text-gray-600">👤 Responsável: {responsavel}</p>
                    )}
                    {empresaSelecionadaSolicitacao.email && (
                      <p className="text-gray-600">📧 {empresaSelecionadaSolicitacao.email}</p>
                    )}
                    {empresaSelecionadaSolicitacao.telefone && (
                      <p className="text-gray-600">📞 {empresaSelecionadaSolicitacao.telefone}</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-cyan-800">
                  Selecione o Template <span className="text-red-500">*</span>
                </h4>
                {temPermissao("excluir_departamento") && (
                  <span className="text-xs text-gray-500">
                    Admins: clique nos três pontos para excluir
                  </span>
                )}
              </div>

              {templatesDisponiveis.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600 mb-2">Nenhum template disponível</p>
                  <p className="text-sm text-gray-500">
                    Admins precisam criar templates primeiro
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templatesDisponiveis.map(template => (
                    <div
                      key={template.id}
                      className={`border-2 rounded-xl p-4 transition-all relative ${templateSelecionado === template.id
                          ? 'border-cyan-500 bg-cyan-50'
                          : 'border-gray-200 hover:border-cyan-300'
                        }`}
                    >
                      <label className="cursor-pointer">
                        <input
                          type="radio"
                          name="template"
                          value={template.id}
                          checked={templateSelecionado === template.id}
                          onChange={() => setTemplateSelecionado(template.id)}
                          className="sr-only"
                        />
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText size={20} className="text-white" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="relative">
                              <h5
                                className="font-bold text-lg text-cyan-700 mb-2 truncate cursor-help"
                                onMouseEnter={() => setTemplateComTooltipNome(template.id)}
                                onMouseLeave={() => setTemplateComTooltipNome(null)}
                              >
                                {template.nome}
                              </h5>

                              {templateComTooltipNome === template.id && (
                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-sm rounded-lg p-3 z-50 shadow-xl">
                                  <div className="font-semibold">{template.nome}</div>
                                  {template.descricao && (
                                    <div className="text-gray-300 text-xs mt-1">{template.descricao}</div>
                                  )}
                                </div>
                              )}
                            </div>

                            {template.descricao && (
                              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                {template.descricao}
                              </p>
                            )}

                            <div className="relative inline-block mt-2">
                              <button
                                type="button"
                                onMouseEnter={() => setTemplateComTooltip(template.id)}
                                onMouseLeave={() => setTemplateComTooltip(null)}
                                className="text-xs text-cyan-600 hover:text-cyan-700 flex items-center gap-1"
                              >
                                <Info size={12} />
                                Ver detalhes do fluxo
                              </button>

                              {templateComTooltip === template.id && (
                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 z-50 shadow-xl">
                                  <div className="font-semibold mb-2">Fluxo do Template:</div>
                                  {(() => {
                                    try {
                                      const fluxo = JSON.parse(template.fluxo_departamentos);
                                      const questionarios = JSON.parse(template.questionarios_por_departamento);

                                      return (
                                        <div className="space-y-2">
                                          {fluxo.map((deptId, index) => {
                                            const dept = departamentosCriados.find(d => d.id === deptId);
                                            const perguntas = questionarios[deptId] || [];

                                            return (
                                              <div key={deptId} className="flex items-start gap-2">
                                                <div className="bg-cyan-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                                                  {index + 1}
                                                </div>
                                                <div className="flex-1">
                                                  <div className="font-medium">
                                                    {dept?.nome || `Departamento ${deptId}`}
                                                  </div>
                                                  <div className="text-cyan-300">
                                                    {perguntas.length} pergunta(s)
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      );
                                    } catch (error) {
                                      return (
                                        <div className="text-red-300">
                                          Erro ao carregar detalhes do template
                                        </div>
                                      );
                                    }
                                  })()}
                                  <div className="border-t border-gray-700 mt-2 pt-2 text-cyan-300">
                                    Total: {JSON.parse(template.fluxo_departamentos).length} departamentos
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                              <span>{JSON.parse(template.fluxo_departamentos).length} departamentos</span>
                              <span>•</span>
                              <span>Criado em {formatarData(template.criado_em)}</span>
                            </div>
                          </div>
                        </div>
                      </label>

                      {temPermissao("excluir_departamento") && (
                        <div className="absolute top-3 right-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowMenuTemplate(showMenuTemplate === template.id ? null : template.id);
                            }}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          >
                            <MoreVertical size={16} />
                          </button>

                          {showMenuTemplate === template.id && (
                            <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[120px] overflow-hidden">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  excluirTemplate(template.id, template.nome);
                                }}
                                className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                              >
                                <Trash2 size={14} />
                                <span>Excluir</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!templateSelecionado || !empresaSelecionadaSolicitacao}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Criar Solicitação
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const normalizarId = (id) => {
    if (id === null || id === undefined || id === '') return null;

    const num = Number(id);

    if (!isNaN(num) && isFinite(num)) {
      return num;
    }

    console.warn('❌ ID inválido encontrado:', { id, tipo: typeof id });
    return null;
  };

  const compararIds = (id1, id2) => {
    if (id1 == null && id2 == null) return true;

    if (id1 == null || id2 == null) return false;

    const num1 = Number(id1);
    const num2 = Number(id2);

    if (isNaN(num1) || isNaN(num2)) {
      return String(id1) === String(id2);
    }

    return num1 === num2;
  };
  const debugDocumentosPergunta = (processoId, perguntaId) => {
    console.log('🐛 DEBUG MANUAL - Documentos por pergunta:');
    console.log('Processo ID:', processoId);
    console.log('Pergunta ID:', perguntaId);

    const todosDocs = documentos[processoId] || [];
    const docsFiltrados = todosDocs.filter(doc =>
      compararIds(doc.perguntaId, perguntaId)
    );

    console.log('Total documentos processo:', todosDocs.length);
    console.log('Documentos filtrados:', docsFiltrados.length);
    console.log('Todos documentos:', todosDocs);
    console.log('Documentos filtrados detalhados:', docsFiltrados);

    return docsFiltrados;
  };



  const QuestionarioModal = ({
    processoId,
    departamentoId,
    departamentosCriados,
    processos,
    onClose,
    onSave,
    somenteLeitura = false,
  }) => {
    const processo = processos.find((p) => p.id === processoId);
    const dept = departamentosCriados.find((d) => d.id === departamentoId);

    if (!processo || !dept) {
      console.error('❌ Processo ou departamento não encontrado');
      return null;
    }

    const questionarioAtual =
      processo?.questionariosPorDepartamento?.[String(departamentoId)] ||
      processo?.questionarioSolicitacao ||
      processo?.questionario ||
      [];

    const [respostasAnteriores, setRespostasAnteriores] = useState({});
    const [respostas, setRespostas] = useState({});
    const [scrollPosition, setScrollPosition] = useState(0);

    const respostasBackupRef = useRef({});
    const isModalOpenRef = useRef(false);
    const modalContainerRef = useRef(null);


    const [respostasTemporarias, setRespostasTemporarias] = useState({});

    useEffect(() => {
      const chave = `respostas_temp_${processoId}_${departamentoId}`;

      if (Object.keys(respostas).length > 0) {
        localStorage.setItem(chave, JSON.stringify(respostas));
        console.log(' Respostas salvas temporariamente:', respostas);
      }

      return () => {
        if (respostas && Object.keys(respostas).length > 0) {
          console.log('🔄 Mantendo backup das respostas');
        }
      };
    }, [respostas, processoId, departamentoId]);
    useEffect(() => {
      const timer = setTimeout(() => {
        const scrollSalvo = localStorage.getItem(`scroll_${processoId}_${departamentoId}`);

        if (scrollSalvo && modalContainerRef.current) {
          const posicao = parseInt(scrollSalvo);
          console.log('📜 Restaurando scroll inicial:', posicao);
          modalContainerRef.current.scrollTop = posicao;
        }
      }, 200);

      return () => clearTimeout(timer);
    }, [processoId, departamentoId]);
    useEffect(() => {
      const chave = `respostas_temp_${processoId}_${departamentoId}`;
      const respostasBackup = localStorage.getItem(chave);

      if (respostasBackup) {
        try {
          const respostasRecuperadas = JSON.parse(respostasBackup);
          console.log('🔄 Recuperando respostas temporárias:', respostasRecuperadas);

          if (Object.keys(respostas).length === 0 && Object.keys(respostasRecuperadas).length > 0) {
            setRespostas(respostasRecuperadas);
            respostasBackupRef.current = respostasRecuperadas;
          }
        } catch (error) {
          console.error('❌ Erro ao recuperar backup:', error);
        }
      }
    }, [processoId, departamentoId]);

    useEffect(() => {
      const chaveBackup = `respostas_temp_${processoId}_${departamentoId}`;
      const respostasBackup = localStorage.getItem(chaveBackup);

      if (respostasBackup && Object.keys(respostas).length === 0) {
        try {
          const respostasRecuperadas = JSON.parse(respostasBackup);
          console.log('🔄 Restaurando respostas ao reabrir modal:', respostasRecuperadas);
          setRespostas(respostasRecuperadas);
          respostasBackupRef.current = respostasRecuperadas;
        } catch (error) {
          console.error('❌ Erro ao restaurar:', error);
        }
      }
    }, [processoId, departamentoId]);

    const keyOf = (pergunta) => String(pergunta.id);
    const safeValue = (val) => (val === undefined || val === null ? "" : val);

    const temMudancasNaoSalvas = () => {
      try {
        const atual = respostas || {};
        const backup = respostasBackupRef.current || {};

        const jsonAtual = JSON.stringify(atual);
        const jsonBackup = JSON.stringify(backup);
        const saoIguais = jsonAtual === jsonBackup;

        console.log('🔍 Comparando respostas:', {
          atual: Object.keys(atual).length,
          backup: Object.keys(backup).length,
          saoIguais
        });

        return !saoIguais;
      } catch (error) {
        console.error('❌ Erro ao verificar mudanças:', error);
        return false;
      }
    };

    const handleRespostaChange = (perguntaId, valor) => {
      console.log('📝 Mudança de resposta:', { perguntaId, valor });

      setRespostas((prev) => {
        const novasRespostas = {
          ...prev,
          [String(perguntaId)]: valor
        };

        console.log('🔄 Estado atualizado:', {
          total: Object.keys(novasRespostas).length
        });

        return novasRespostas;
      });
    };

    const handleFecharModal = async () => {
      console.log('🔄 handleFecharModal chamado');

      const temMudancas = temMudancasNaoSalvas();

      if (temMudancas && !somenteLeitura && processo?.status !== "Finalizado") {
        const confirmou = await mostrarConfirmacao({
          tipo: "aviso",
          titulo: "Alterações não salvas",
          mensagem: "Você tem alterações não salvas. Deseja salvar antes de fechar?",
          textoConfirmar: "Salvar",
          textoCancelar: "Descartar"
        });

        if (confirmou) {
          await onSave(processoId, departamentoId, respostas);
        } else {
          setRespostas({ ...respostasBackupRef.current });
        }
      }

      localStorage.removeItem(`scroll_${processoId}_${departamentoId}`);

      onClose();
    };


    const handleSubmit = (e) => {
      e.preventDefault();

      const chave = `respostas_temp_${processoId}_${departamentoId}`;
      localStorage.removeItem(chave);
      console.log('🗑️ Backup removido após salvar');

      onSave(processoId, departamentoId, respostas);
    };
    const salvarSilenciosamente = async () => {
      try {
        console.log(' Salvando silenciosamente...', {
          processoId,
          departamentoId,
          totalRespostas: Object.keys(respostas).length
        });

        const processo = processos.find(p => p.id === processoId);
        const dept = departamentosCriados.find(d => d.id === departamentoId);

        if (!processo || !dept) {
          console.error('❌ Processo ou departamento não encontrado');
          return false;
        }

        const questionarioDepartamento = processo.questionariosPorDepartamento?.[departamentoId] || [];

        const respostasHistoricoAtualizado = {
          ...processo.respostasHistorico,
          [departamentoId]: {
            departamentoId: departamentoId,
            departamentoNome: dept.nome,
            questionario: questionarioDepartamento,
            respostas: respostas,
            respondidoEm: new Date().toISOString(),
            respondidoPor: usuarioLogado?.nome || "Sistema"
          }
        };

        const processoAtualizado = {
          ...processo,
          respostasHistorico: respostasHistoricoAtualizado
        };

        const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(processoAtualizado)
        });

        if (!response.ok) {
          console.error('❌ Erro ao salvar silenciosamente');
          return false;
        }

        const resultado = await response.json();

        if (resultado.sucesso) {
          console.log('✅ Respostas salvas silenciosamente!');

          setProcessos(prev => prev.map(p =>
            p.id === processoId ? processoAtualizado : p
          ));

          respostasBackupRef.current = { ...respostas };

          return true;
        }

        return false;

      } catch (error) {
        console.error('❌ Erro ao salvar silenciosamente:', error);
        return false;
      }
    };

    useEffect(() => {
      const loadRespostas = async () => {
        try {
          console.log('🔄 Carregando respostas...', { processoId, departamentoId });

          if (!processo?.respostasHistorico?.[departamentoId]) {
            console.log('ℹ️ Sem histórico - iniciando vazio');
            setRespostas({});
            respostasBackupRef.current = {};
            return;
          }

          const historicoDepto = processo.respostasHistorico[departamentoId];
          const respostasSalvas = historicoDepto.respostas || {};

          console.log('✅ Respostas carregadas:', {
            total: Object.keys(respostasSalvas).length,
            respostas: respostasSalvas
          });

          const backupInicial = JSON.parse(JSON.stringify(respostasSalvas));

          setRespostas(respostasSalvas);
          respostasBackupRef.current = backupInicial;

          console.log('Backup criado com sucesso');

        } catch (err) {
          console.error('❌ Erro ao carregar respostas:', err);
          setRespostas({});
          respostasBackupRef.current = {};
        }
      };

      loadRespostas();
    }, [processoId, departamentoId, processo]);

    useEffect(() => {
      const loadRespostasAnteriores = async () => {
        try {
          if (!processo?.respostasHistorico) return;

          const respostasAnt = {};

          Object.entries(processo.respostasHistorico).forEach(([deptId, dados]) => {
            if (Number(deptId) === Number(departamentoId)) return;

            if (dados.respostas && Object.keys(dados.respostas).length > 0) {
              respostasAnt[deptId] = dados.respostas;
            }
          });

          setRespostasAnteriores(respostasAnt);

        } catch (err) {
          console.error('❌ Erro ao carregar respostas anteriores:', err);
        }
      };

      loadRespostasAnteriores();
    }, [processoId, departamentoId, processo]);

    useEffect(() => {
      console.log('📊 Estado:', {
        respostas: Object.keys(respostas).length,
        backup: Object.keys(respostasBackupRef.current).length,
        temMudancas: temMudancasNaoSalvas()
      });
    }, [respostas]);

    useEffect(() => {
      if (!showUploadDocumento && isModalOpenRef.current) {
        console.log('🔄 Modal de upload fechado - Verificando integridade...');

        const backupAtual = respostasBackupRef.current;
        const estadoAtual = respostas;

        if (Object.keys(estadoAtual).length < Object.keys(backupAtual).length) {
          console.log('⚠️ PERDA DETECTADA! Restaurando...');
          setRespostas(backupAtual);
        }

        isModalOpenRef.current = false;
      }
    }, [showUploadDocumento, respostas]);
    const avaliarCondicao = (pergunta, respostas) => {
      if (!pergunta.condicao) return true;

      const { perguntaId, operador, valor } = pergunta.condicao;
      const respostaCondicional = respostas[perguntaId];

      if (respostaCondicional === undefined || respostaCondicional === null || respostaCondicional === "") {
        return false;
      }

      switch (operador) {
        case "igual":
          return String(respostaCondicional).toLowerCase() === String(valor).toLowerCase();

        case "diferente":
          return String(respostaCondicional).toLowerCase() !== String(valor).toLowerCase();

        case "contem":
          return String(respostaCondicional).toLowerCase().includes(String(valor).toLowerCase());

        default:
          return true;
      }
    };
    // ========== RENDER DE CAMPOS ==========
    const renderCampo = (pergunta) => {
      const bloqueado = somenteLeitura || processo.status === "Finalizado";
      const k = keyOf(pergunta);
      const valor = respostas[k];
      const isEmpty = valor === undefined || valor === null || valor === "";

      switch (pergunta.tipo) {
        case "text":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {isEmpty ? "—" : String(valor)}
            </div>
          ) : (
            <input
              type="text"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              required={pergunta.obrigatorio}
              placeholder="Digite sua resposta"
            />
          );

        case "textarea":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700 whitespace-pre-wrap">
              {isEmpty ? "—" : String(valor).trim()}
            </div>
          ) : (
            <textarea
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 resize-vertical"
              required={pergunta.obrigatorio}
              placeholder="Digite sua resposta"
            />
          );

        case "number":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {isEmpty ? "—" : String(valor)}
            </div>
          ) : (
            <input
              type="number"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              required={pergunta.obrigatorio}
              placeholder="Digite um número"
            />
          );

        case "date":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {isEmpty ? "—" : new Date(valor).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
            </div>
          ) : (
            <input
              type="date"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              required={pergunta.obrigatorio}
            />
          );

        case "email":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {isEmpty ? "—" : String(valor)}
            </div>
          ) : (
            <input
              type="email"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              required={pergunta.obrigatorio}
              placeholder="exemplo@email.com"
            />
          );

        case "phone":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {isEmpty ? "—" : String(valor)}
            </div>
          ) : (
            <input
              type="tel"
              value={safeValue(valor)}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              required={pergunta.obrigatorio}
              placeholder="(00) 00000-0000"
            />
          );

        case "file":
          const todosDocumentos = documentos[processoId] || [];
          const docsAnexados = todosDocumentos.filter((doc) =>
            compararIds(doc.perguntaId, pergunta.id)
          );

          return (
            <div className="space-y-3">
              <div className="space-y-2">
                <h5 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                  <FileText size={16} className="text-blue-500" />
                  Documentos Anexados ({docsAnexados.length})
                </h5>

                {docsAnexados.length === 0 ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-center">
                    <FileText size={26} className="mx-auto text-blue-300 mb-2" />
                    <p className="text-sm text-blue-700">Nenhum documento anexado ainda</p>
                    {!bloqueado && (
                      <p className="text-xs text-blue-500 mt-1">
                        Clique em "Anexar Arquivo" para enviar documentos
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {docsAnexados.map((doc) => (
                      <div
                        key={doc.id}
                        className="bg-blue-50 border border-blue-200 rounded-xl p-3 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                              <FileText size={20} className="text-blue-600" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate" title={doc.nome}>
                                {doc.nome}
                              </div>
                              <div className="flex items-center gap-3 text-xs text-blue-500 mt-1">
                                <span>{(doc.tamanho / 1024 / 1024).toFixed(2)} MB</span>
                                <span>{formatarDataHora(doc.dataUpload)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 flex-shrink-0 ml-3">
                            <button
                              type="button"
                              onClick={() => {
                                const url = resolveFileUrl(doc.url);
                                setPreviewDocumento({ ...doc, url });
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1"
                              title="Visualizar documento"
                            >
                              <Eye size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const url = resolveFileUrl(doc.url);
                                try {
                                  const response = await fetch(url);
                                  const blob = await response.blob();
                                  const downloadUrl = window.URL.createObjectURL(blob);
                                  const link = document.createElement("a");
                                  link.href = downloadUrl;
                                  link.download = doc.nome;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                  window.URL.revokeObjectURL(downloadUrl);
                                } catch (error) {
                                  console.error("Erro ao baixar:", error);
                                  adicionarNotificacao("Erro ao baixar arquivo", "erro");
                                }
                              }}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
                              title="Baixar documento"
                            >
                              <Download size={16} />
                            </button>

                            {!bloqueado && (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();

                                  console.log('🗑️ Tentando excluir documento do questionário:', {
                                    processoId: processo.id,
                                    documentoId: doc.id,
                                    nome: doc.nome
                                  });

                                  const resultado = await excluirDocumentoDireto(processo.id, doc.id);

                                  if (resultado) {
                                    console.log('✅ Documento excluído, recarregando questionário...');
                                    await carregarDocumentos(processo.id);

                                    setDocumentos(prev => ({
                                      ...prev,
                                      [processo.id]: prev[processo.id].filter(d => d.id !== doc.id)
                                    }));
                                  }
                                }}
                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors flex items-center gap-1"
                                title="Excluir documento"
                                disabled={excluindoDocumento[doc.id]}
                              >
                                {excluindoDocumento[doc.id] ? (
                                  <RefreshCw size={16} className="animate-spin" />
                                ) : (
                                  <X size={16} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!bloqueado && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const estadoAtual = { ...respostas };
                    isModalOpenRef.current = true;

                    setShowUploadDocumento({
                      id: processoId,
                      perguntaId: pergunta.id,
                      perguntaLabel: pergunta.label,
                      onUploadSuccess: async () => {
                        await new Promise(resolve => setTimeout(resolve, 100));

                        setRespostas(estadoAtual);
                        respostasBackupRef.current = estadoAtual;
                        isModalOpenRef.current = false;

                        await carregarDocumentos(processoId);
                        adicionarNotificacao('Documento anexado com sucesso!', 'sucesso');
                      },
                    });
                  }}
                  className="w-full px-4 py-3 border-2 border-dashed border-blue-300 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Upload size={18} />
                  <span>
                    {docsAnexados.length > 0 ? "Adicionar Mais Arquivos" : "Anexar Arquivo"}
                  </span>
                </button>
              )}

              <input
                type="hidden"
                name={`pergunta_${pergunta.id}`}
                value={safeValue(respostas[keyOf(pergunta)])}
              />
            </div>
          );

        case "boolean":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {respostas[pergunta.id] || "—"}
            </div>
          ) : (
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={pergunta.id}
                  value="Sim"
                  checked={respostas[pergunta.id] === "Sim"}
                  onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
                  className="w-5 h-5 text-cyan-600"
                  required={pergunta.obrigatorio}
                />
                <span className="text-gray-700">Sim</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={pergunta.id}
                  value="Não"
                  checked={respostas[pergunta.id] === "Não"}
                  onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
                  className="w-5 h-5 text-cyan-600"
                  required={pergunta.obrigatorio}
                />
                <span className="text-gray-700">Não</span>
              </label>
            </div>
          );

        case "select":
          return bloqueado ? (
            <div className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-700">
              {respostas[pergunta.id] || "—"}
            </div>
          ) : (
            <select
              value={respostas[pergunta.id] || ""}
              onChange={(e) => handleRespostaChange(pergunta.id, e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
              required={pergunta.obrigatorio}
            >
              <option value="">Selecione...</option>
              {pergunta.opcoes
                .filter((o) => o.trim())
                .map((opcao, idx) => (
                  <option key={idx} value={opcao}>
                    {opcao}
                  </option>
                ))}
            </select>
          );

        default:
          return null;
      }
    };

    // ========== RENDER PRINCIPAL ==========
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        {Object.keys(respostas).length > 0 && (
          <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-[9999]">
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />

            </div>
          </div>
        )}
        <div
          ref={modalContainerRef}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        >
          <div className={`bg-gradient-to-r ${dept.cor} p-6 rounded-t-2xl`}>
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <MessageSquare size={24} />
                  Questionário - {dept.nome}
                </h3>
                <p className="text-white opacity-90 text-sm mt-1">
                  {processo?.nomeEmpresa}
                </p>
              </div>
              <button
                onClick={handleFecharModal}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>




          <form onSubmit={handleSubmit} className="p-6">

            {Object.keys(respostasAnteriores).length > 0 && (
              <div className="mb-8 space-y-6">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                  <Eye size={18} className="text-blue-500" />
                  {somenteLeitura ? "Respostas do Questionário" : "Respostas de Departamentos Anteriores"} (somente leitura)
                </h4>

                {Object.entries(respostasAnteriores).map(([deptId, respostasDept]) => {
                  const historicoDepto = processo.respostasHistorico?.[deptId];

                  if (!historicoDepto) return null;

                  const deptAnt = departamentosCriados.find(d => d.id === Number(deptId));

                  if (!deptAnt) return null;

                  const IconeDept = deptAnt.icone;
                  const questionarioDepto = historicoDepto.questionario || [];
                  const respostasDepto = historicoDepto.respostas || {};

                  if (questionarioDepto.length === 0) return null;

                  const deveAparecerNaVisualizacao = (pergunta) => {
                    if (!pergunta.condicao) return true;

                    const { perguntaId, operador, valor } = pergunta.condicao;
                    const respostaCondicional = respostasDepto[perguntaId];

                    if (respostaCondicional === undefined || respostaCondicional === null || respostaCondicional === "") {
                      return false;
                    }

                    switch (operador) {
                      case "igual":
                        return String(respostaCondicional).toLowerCase() === String(valor).toLowerCase();

                      case "diferente":
                        return String(respostaCondicional).toLowerCase() !== String(valor).toLowerCase();

                      case "contem":
                        return String(respostaCondicional).toLowerCase().includes(String(valor).toLowerCase());

                      default:
                        return true;
                    }
                  };

                  const perguntasVisiveis = questionarioDepto.filter(p => deveAparecerNaVisualizacao(p));

                  if (perguntasVisiveis.length === 0) return null;

                  const paresDePerguntas = [];
                  for (let i = 0; i < perguntasVisiveis.length; i += 2) {
                    paresDePerguntas.push(perguntasVisiveis.slice(i, i + 2));
                  }

                  return (
                    <div
                      key={deptId}
                      className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm"
                    >
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${deptAnt.cor} flex items-center justify-center`}>
                          {IconeDept && <IconeDept size={20} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-800 text-lg">
                            {deptAnt.nome}
                          </h5>
                          {historicoDepto.respondidoEm && (
                            <p className="text-sm text-gray-600">
                              Respondido por <span className="font-medium">{historicoDepto.respondidoPor}</span> em {formatarDataHora(historicoDepto.respondidoEm)}
                            </p>
                          )}
                        </div>
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {perguntasVisiveis.length} respostas
                        </span>
                      </div>

                      <div className="space-y-4">
                        {paresDePerguntas.map((par, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {par.map((pergunta) => {
                              const resposta = respostasDepto[pergunta.id];

                              return (
                                <div
                                  key={pergunta.id}
                                  className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm h-full flex flex-col"
                                >


                                  <div className="flex-1">
                                    {!resposta ? (
                                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-sm text-yellow-700 h-full flex items-center justify-center">
                                        ⚠️ Não respondido
                                      </div>
                                    ) : pergunta.tipo === "file" ? (
                                      <div className="space-y-2">
                                        {(() => {
                                          const todosDocumentos = documentos[processo.id] || [];
                                          const docsAnexados = todosDocumentos.filter(doc =>
                                            compararIds(doc.perguntaId, pergunta.id)
                                          );

                                          return docsAnexados.length > 0 ? (
                                            docsAnexados.map(doc => (
                                              <div
                                                key={doc.id}
                                                className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
                                              >
                                                <div className="flex items-center gap-3 flex-1">
                                                  <FileText size={20} className="text-blue-600" />
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-sm text-gray-900 truncate">
                                                      {doc.nome}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                      {(doc.tamanho / 1024 / 1024).toFixed(2)} MB
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex gap-2">
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      const url = resolveFileUrl(doc.url);
                                                      setPreviewDocumento({ ...doc, url });
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                    title="Visualizar"
                                                  >
                                                    <Eye size={16} />
                                                  </button>

                                                  <button
                                                    type="button"
                                                    onClick={async () => {
                                                      const url = resolveFileUrl(doc.url);
                                                      try {
                                                        const response = await fetch(url);
                                                        const blob = await response.blob();
                                                        const downloadUrl = window.URL.createObjectURL(blob);
                                                        const link = document.createElement("a");
                                                        link.href = downloadUrl;
                                                        link.download = doc.nome;
                                                        document.body.appendChild(link);
                                                        link.click();
                                                        document.body.removeChild(link);
                                                        window.URL.revokeObjectURL(downloadUrl);
                                                      } catch (error) {
                                                        console.error("Erro ao baixar:", error);
                                                        adicionarNotificacao("Erro ao baixar arquivo", "erro");
                                                      }
                                                    }}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                                    title="Baixar"
                                                  >
                                                    <Download size={16} />
                                                  </button>
                                                </div>
                                              </div>
                                            ))
                                          ) : (
                                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
                                              Nenhum arquivo anexado
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    ) : pergunta.tipo === "textarea" ? (
                                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap text-sm text-gray-800 h-full">
                                        {resposta}
                                      </div>
                                    ) : pergunta.tipo === "select" ? (
                                      <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium inline-block">
                                        {resposta}
                                      </div>
                                    ) : pergunta.tipo === "boolean" ? (
                                      <div className={`${resposta === "Sim" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} px-3 py-2 rounded-lg text-sm font-medium inline-block`}>
                                        {resposta}
                                      </div>
                                    ) : (
                                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm text-gray-800 h-full">
                                        {resposta}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                <hr className="my-6 border-gray-300" />
              </div>
            )}

            {questionarioAtual.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 mb-4">
                  Esta solicitação não possui questionário ainda.
                </p>
                <p className="text-sm text-gray-500">
                  O questionário será adicionado ao criar a solicitação.
                </p>
              </div>
            ) : (
              <>




                {somenteLeitura ? (
                  <div className="mb-8">
                    <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2 text-lg">
                      <Eye size={18} className="text-blue-500" />
                      Respostas do Questionário (somente leitura)
                    </h4>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200">
                        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${dept.cor} flex items-center justify-center`}>
                          {dept.icone && <dept.icone size={20} className="text-white" />}
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-800 text-lg">
                            {dept.nome}
                          </h5>
                          {processo.respostasHistorico?.[departamentoId]?.respondidoEm && (
                            <p className="text-sm text-gray-600">
                              Respondido por <span className="font-medium">{processo.respostasHistorico[departamentoId].respondidoPor}</span> em {formatarDataHora(processo.respostasHistorico[departamentoId].respondidoEm)}
                            </p>
                          )}
                        </div>
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                          {(() => {
                            const deveAparecerTemp = (pergunta) => {
                              if (!pergunta.condicao) return true;
                              const { perguntaId, operador, valor } = pergunta.condicao;
                              const respostaCondicional = respostas[perguntaId];
                              if (!respostaCondicional || respostaCondicional === "") return false;
                              const respostaNorm = String(respostaCondicional).trim().toLowerCase();
                              const valorNorm = String(valor).trim().toLowerCase();
                              switch (operador) {
                                case "igual": return respostaNorm === valorNorm;
                                case "diferente": return respostaNorm !== valorNorm;
                                case "contem": return respostaNorm.includes(valorNorm);
                                default: return true;
                              }
                            };
                            return questionarioAtual.filter(p => deveAparecerTemp(p)).length;
                          })()} respostas
                        </span>
                      </div>

                      <div className="space-y-4">
                        {(() => {
                          const deveAparecerNaVisualizacao = (pergunta) => {
                            if (!pergunta.condicao) return true;

                            const { perguntaId, operador, valor } = pergunta.condicao;
                            const respostaCondicional = respostas[perguntaId];

                            console.log('🔍 [Ver Questionário] Avaliando:', {
                              pergunta: pergunta.label,
                              condicao: pergunta.condicao,
                              respostaCondicional,
                              operador,
                              valorEsperado: valor
                            });

                            if (respostaCondicional === undefined ||
                              respostaCondicional === null ||
                              respostaCondicional === "" ||
                              respostaCondicional === "⚠️ Não respondido") {
                              console.log('❌ Não exibe: resposta vazia');
                              return false;
                            }

                            const respostaNormalizada = String(respostaCondicional).trim().toLowerCase();
                            const valorNormalizado = String(valor).trim().toLowerCase();

                            console.log('📊 Comparação:', {
                              respostaNormalizada,
                              valorNormalizado,
                              operador
                            });

                            switch (operador) {
                              case "igual":
                                const resultado = respostaNormalizada === valorNormalizado;
                                console.log(`✅ Resultado (igual): ${resultado}`);
                                return resultado;

                              case "diferente":
                                const resultadoDif = respostaNormalizada !== valorNormalizado;
                                console.log(`✅ Resultado (diferente): ${resultadoDif}`);
                                return resultadoDif;

                              case "contem":
                                const resultadoContem = respostaNormalizada.includes(valorNormalizado);
                                console.log(`✅ Resultado (contém): ${resultadoContem}`);
                                return resultadoContem;

                              default:
                                return true;
                            }
                          };

                          const perguntasVisiveis = questionarioAtual.filter(p => deveAparecerNaVisualizacao(p));

                          console.log('📋 Perguntas visíveis:', perguntasVisiveis.length, 'de', questionarioAtual.length);

                          const paresDePerguntas = [];
                          for (let i = 0; i < perguntasVisiveis.length; i += 2) {
                            paresDePerguntas.push(perguntasVisiveis.slice(i, i + 2));
                          }

                          return paresDePerguntas.map((par, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {par.map((pergunta) => {
                                const resposta = respostas[pergunta.id];

                                return (
                                  <div
                                    key={pergunta.id}
                                    className="bg-white rounded-lg p-4 border border-blue-100 shadow-sm h-full flex flex-col"
                                  >
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                      {pergunta.label}
                                      {pergunta.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                                      {pergunta.condicao && (
                                        <span className="ml-2 text-xs text-blue-600"> Condicional</span>
                                      )}
                                    </label>

                                    <div className="flex-1">
                                      {!resposta ? (
                                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center text-sm text-yellow-700 h-full flex items-center justify-center">
                                          ⚠️ Não respondido
                                        </div>
                                      ) : pergunta.tipo === "file" ? (
                                        <div className="space-y-2">
                                          {(() => {
                                            const todosDocumentos = documentos[processo.id] || [];
                                            const docsAnexados = todosDocumentos.filter(doc =>
                                              compararIds(doc.perguntaId, pergunta.id)
                                            );

                                            return docsAnexados.length > 0 ? (
                                              docsAnexados.map(doc => (
                                                <div
                                                  key={doc.id}
                                                  className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
                                                >
                                                  <div className="flex items-center gap-3 flex-1">
                                                    <FileText size={20} className="text-blue-600" />
                                                    <div className="flex-1 min-w-0">
                                                      <div className="font-medium text-sm text-gray-900 truncate">
                                                        {doc.nome}
                                                      </div>
                                                      <div className="text-xs text-gray-500">
                                                        {(doc.tamanho / 1024 / 1024).toFixed(2)} MB
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div className="flex gap-2">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        const url = resolveFileUrl(doc.url);
                                                        setPreviewDocumento({ ...doc, url });
                                                      }}
                                                      className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                                                      title="Visualizar"
                                                    >
                                                      <Eye size={16} />
                                                    </button>

                                                    <button
                                                      type="button"
                                                      onClick={async () => {
                                                        const url = resolveFileUrl(doc.url);
                                                        try {
                                                          const response = await fetch(url);
                                                          const blob = await response.blob();
                                                          const downloadUrl = window.URL.createObjectURL(blob);
                                                          const link = document.createElement("a");
                                                          link.href = downloadUrl;
                                                          link.download = doc.nome;
                                                          document.body.appendChild(link);
                                                          link.click();
                                                          document.body.removeChild(link);
                                                          window.URL.revokeObjectURL(downloadUrl);
                                                        } catch (error) {
                                                          console.error("Erro ao baixar:", error);
                                                          adicionarNotificacao("Erro ao baixar arquivo", "erro");
                                                        }
                                                      }}
                                                      className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                                      title="Baixar"
                                                    >
                                                      <Download size={16} />
                                                    </button>
                                                  </div>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-center text-sm text-gray-500">
                                                Nenhum arquivo anexado
                                              </div>
                                            );
                                          })()}
                                        </div>
                                      ) : pergunta.tipo === "textarea" ? (
                                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 whitespace-pre-wrap text-sm text-gray-800 h-full">
                                          {resposta}
                                        </div>
                                      ) : pergunta.tipo === "select" ? (
                                        <div className="bg-blue-100 text-blue-800 px-3 py-2 rounded-lg text-sm font-medium inline-block">
                                          {resposta}
                                        </div>
                                      ) : pergunta.tipo === "boolean" ? (
                                        <div className={`${resposta === "Sim" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"} px-3 py-2 rounded-lg text-sm font-medium inline-block`}>
                                          {resposta}
                                        </div>
                                      ) : (
                                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 text-sm text-gray-800 h-full">
                                          {resposta}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <h4 className="font-semibold text-gray-800 mb-6">
                      Preencha o Questionário:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {questionarioAtual
                        .filter(pergunta => avaliarCondicao(pergunta, respostas))
                        .map((pergunta) => (
                          <div
                            key={pergunta.id}
                            className={pergunta.tipo === "textarea" ? "md:col-span-2" : ""}
                          >
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              {pergunta.label}{" "}
                              {pergunta.obrigatorio && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            {renderCampo(pergunta)}
                          </div>
                        ))
                      }
                    </div>
                  </>
                )}
              </>
            )}

            <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleFecharModal}
                className="flex-1 min-h-[36px] px-4 py-1.5 text-gray-700 border border-gray-300 rounded-lg 
               hover:bg-gray-100 hover:shadow-sm text-base font-medium transition-all duration-200"
              >
                Fechar
              </button>

              {!somenteLeitura && processo?.status !== "Finalizado" && (
                <>
                  <button
                    type="submit"
                    className="flex-1 min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 
                   hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg 
                   shadow-sm hover:shadow-md transition-all duration-200 
                   font-semibold flex items-center justify-center gap-2 text-base"
                  >
                    <Save size={16} />
                    Salvar Questionário
                  </button>

                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();

                      if (modalContainerRef.current) {
                        const posicaoAtual = modalContainerRef.current.scrollTop;
                        setScrollPosition(posicaoAtual);
                        console.log('📜 Scroll salvo na posição:', posicaoAtual);

                        localStorage.setItem(
                          `scroll_${processoId}_${departamentoId}`,
                          posicaoAtual.toString()
                        );
                      }

                      console.log(' Salvando respostas...');
                      await salvarSilenciosamente();

                      setShowQuestionario(null);
                      setShowQuestionarioSolicitacao({
                        ...processo,
                        departamentoIdAtual: departamentoId
                      });
                    }}
                    className="flex-1 min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-orange-500 to-orange-600 
             hover:from-orange-600 hover:to-orange-700 text-white rounded-lg 
             shadow-sm hover:shadow-md transition-all duration-200 
             font-semibold flex items-center justify-center gap-2 text-base"
                  >
                    <Edit size={16} />
                    Editar Quest.
                  </button>
                  {(() => {
                    let empresaDoProcesso = null;
                    if (processo.empresaId) {
                      empresaDoProcesso = empresas.find(emp => emp.id === processo.empresaId);
                    }
                    if (!empresaDoProcesso) {
                      empresaDoProcesso = empresas.find(
                        emp => emp.razao_social === processo.nomeEmpresa
                      );
                    }

                    return empresaDoProcesso ? (
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (modalContainerRef.current) {
                            const posicaoAtual = modalContainerRef.current.scrollTop;
                            setScrollPosition(posicaoAtual);
                            console.log('📜 Scroll salvo na posição:', posicaoAtual);

                            localStorage.setItem(
                              `scroll_${processoId}_${departamentoId}`,
                              posicaoAtual.toString()
                            );
                          }

                          console.log('Salvando respostas...');
                          await salvarSilenciosamente();

                          setEmpresaSelecionada(empresaDoProcesso);
                        }}
                        className="flex-1 min-h-[36px] px-4 py-1.5 bg-gradient-to-r from-green-500 to-green-600 
                 hover:from-green-600 hover:to-green-700 text-white rounded-lg 
                 shadow-sm hover:shadow-md transition-all duration-200 
                 font-semibold flex items-center justify-center gap-2 text-base"
                      >
                        <Building size={16} />
                        Ver Detalhes da Empresa
                      </button>
                    ) : null;
                  })()}


                  {empresaSelecionada && (
                    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
                      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
                        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl">
                          <div className="flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">
                              📊 Detalhes da Empresa
                            </h3>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();

                                const chaveBackup = `respostas_temp_${processoId}_${departamentoId}`;
                                const respostasBackup = localStorage.getItem(chaveBackup);

                                if (respostasBackup) {
                                  try {
                                    const respostasRecuperadas = JSON.parse(respostasBackup);
                                    console.log('🔄 Restaurando respostas:', respostasRecuperadas);
                                    setRespostas(respostasRecuperadas);
                                    respostasBackupRef.current = respostasRecuperadas;
                                  } catch (error) {
                                    console.error('❌ Erro ao restaurar backup:', error);
                                  }
                                }

                                setEmpresaSelecionada(null);

                                setTimeout(() => {
                                  let posicaoSalva = scrollPosition;

                                  if (!posicaoSalva) {
                                    const scrollSalvo = localStorage.getItem(`scroll_${processoId}_${departamentoId}`);
                                    if (scrollSalvo) {
                                      posicaoSalva = parseInt(scrollSalvo);
                                    }
                                  }

                                  if (modalContainerRef.current && posicaoSalva) {
                                    console.log('📜 Restaurando scroll para posição:', posicaoSalva);
                                    modalContainerRef.current.scrollTop = posicaoSalva;
                                  }
                                }, 100);
                              }}
                              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
                            >
                              <X size={20} />
                            </button>
                          </div>
                        </div>

                        <div className="p-6 space-y-6">
                          <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                            <h4 className="font-semibold text-green-800 mb-4">Informações Principais</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                                <p className="text-gray-900 font-semibold">{empresaSelecionada.razao_social}</p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                                <p className="text-gray-900 font-semibold">{empresaSelecionada.codigo}</p>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Abertura</label>
                                <p className="text-gray-900">
                                  {empresaSelecionada.data_abertura
                                    ? formatarData(empresaSelecionada.data_abertura)
                                    : "Não informada"}
                                </p>
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ ou CPF</label>
                                <p className="text-gray-900">{empresaSelecionada.cnpj}</p>
                              </div>
                              {empresaSelecionada.apelido && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                                  <p className="text-gray-900">{empresaSelecionada.apelido}</p>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                            <h4 className="font-semibold text-blue-800 mb-4">Inscrições e Regimes</h4>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {empresaSelecionada.inscricao_estadual && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Inscrição Estadual (IE)
                                  </label>
                                  <p className="text-gray-900 font-semibold break-words">
                                    {empresaSelecionada.inscricao_estadual}
                                  </p>
                                </div>
                              )}

                              {empresaSelecionada.inscricao_municipal && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Inscrição Municipal (IM)
                                  </label>
                                  <p className="text-gray-900 font-semibold break-words">
                                    {empresaSelecionada.inscricao_municipal}
                                  </p>
                                </div>
                              )}

                              {empresaSelecionada.regime_federal && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Regime Federal
                                  </label>
                                  <p className="text-gray-900">{empresaSelecionada.regime_federal}</p>
                                </div>
                              )}

                              {empresaSelecionada.regime_estadual && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Regime Estadual
                                  </label>
                                  <p className="text-gray-900 break-words">
                                    {empresaSelecionada.regime_estadual}
                                  </p>
                                </div>
                              )}

                              {empresaSelecionada.regime_municipal && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Regime Municipal
                                  </label>
                                  <p className="text-gray-900 break-words">
                                    {empresaSelecionada.regime_municipal}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>


                          <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                            <h4 className="font-semibold text-purple-800 mb-4">Endereço</h4>
                            <div className="space-y-2">
                              <p className="text-gray-900">
                                {empresaSelecionada.logradouro && `${empresaSelecionada.logradouro}, `}
                                {empresaSelecionada.numero}
                              </p>
                              <p className="text-gray-900">
                                {empresaSelecionada.bairro && `${empresaSelecionada.bairro} - `}
                                {empresaSelecionada.cidade}/{empresaSelecionada.estado}
                              </p>
                              {empresaSelecionada.cep && (
                                <p className="text-gray-600 text-sm">CEP: {empresaSelecionada.cep}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  };



  const ModalListarEmpresas = ({ onClose, tipo = 'cadastradas' }) => { // ✅ ADICIONAR PROP tipo
    const [buscaEmpresa, setBuscaEmpresa] = useState("");
    const [empresaSelecionada, setEmpresaSelecionada] = useState(null);

    useEffect(() => {
      console.log('🔍 Estado de empresas no modal:', {
        total: empresas.length,
        empresas: empresas
      });
    }, [empresas]);


    const recarregarEmpresas = async () => {
      console.log('🔄 Recarregando empresas...');
      await carregarEmpresas();
      adicionarNotificacao('Lista de empresas atualizada', 'sucesso');
    };
const empresasFiltradas = empresas
  .filter(empresa => {
    const matchBusca = empresa.razao_social.toLowerCase().includes(buscaEmpresa.toLowerCase()) ||
      empresa.codigo.toLowerCase().includes(buscaEmpresa.toLowerCase()) ||
      (empresa.cnpj && empresa.cnpj.includes(buscaEmpresa));

    const matchTipo = tipo === 'cadastradas'
      ? (empresa.cadastrada === true || empresa.cadastrada === 1 || empresa.cadastrada === '1')
      : (empresa.cadastrada === false || empresa.cadastrada === 0 || empresa.cadastrada === '0' || empresa.cadastrada === null);

    return matchBusca && matchTipo;
  });



    useEffect(() => {
      console.log('🔍 DEBUG Modal Empresas:', {
        totalEmpresas: empresas.length,
        empresas: empresas.map(e => ({ id: e.id, nome: e.razao_social }))
      });
    }, [empresas]);





    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          {/* ✅ HEADER DINÂMICO */}
          <div className={`bg-gradient-to-r ${tipo === 'cadastradas'
              ? 'from-blue-500 to-blue-600'
              : 'from-amber-500 to-orange-600'
            } p-6 rounded-t-2xl sticky top-0 z-10`}>
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">
                {tipo === 'cadastradas' ? '📋 Empresas Cadastradas' : '🆕 Empresas Novas'} ({empresasFiltradas.length})
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={recarregarEmpresas}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white p-2 rounded-lg transition-colors"
                  title="Recarregar lista"
                >
                  <RefreshCw size={16} />
                </button>
                <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-6">
              <div className="relative">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar por código, CNPJ ou razão social..."
                  value={buscaEmpresa}
                  onChange={(e) => setBuscaEmpresa(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>





            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {empresasFiltradas.map(empresa => (
                <div
                  key={empresa.id}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between h-full"
                  onClick={() => setEmpresaSelecionada(empresa)}
                >




                  <div className="flex-grow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-bold text-gray-900 text-sm sm:text-base truncate max-w-[180px] md:max-w-[200px] lg:max-w-[220px]"
                          title={empresa.razao_social}
                        >
                          {empresa.razao_social}
                        </h4>

                        {empresa.apelido && (
                          <p
                            className="text-sm text-gray-600 truncate max-w-[180px] md:max-w-[200px] lg:max-w-[220px]"
                            title={empresa.apelido}
                          >
                            ({empresa.apelido})
                          </p>
                        )}
                      </div>

                      <span
                        className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium flex-shrink-0 ml-2 truncate max-w-[60px]"
                        title={empresa.codigo}
                      >
                        {empresa.codigo}
                      </span>
                    </div>



                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-medium">
                        {empresa.codigo}
                      </span>

                      {empresa.cadastrada === false && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
                          <AlertCircle size={10} />
                          Nova
                        </span>
                      )}
                    </div>





                    <div className="space-y-1 text-xs text-gray-600">
                      <p>📄 CNPJ: {empresa.cnpj}</p>
                      {empresa.cidade && empresa.estado && (
                        <p>📍 {empresa.cidade}/{empresa.estado}</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmpresaSelecionada(empresa);
                      }}
                      className="w-full bg-blue-500 text-white px-3 py-1.5 rounded text-xs hover:bg-blue-600"
                    >
                      Ver Detalhes
                    </button>
                  </div>

                </div>
              ))}
            </div>

            {empresasFiltradas.length === 0 && (
              <div className="text-center py-12">
                <Building size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600">Nenhuma empresa encontrada</p>
              </div>
            )}
          </div>
        </div>

        {empresaSelecionada && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
              <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">
                    📊 Detalhes da Empresa
                  </h3>
                  <button
                    onClick={() => setEmpresaSelecionada(null)}
                    className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-4">Informações Principais</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                      <p className="text-gray-900">{empresaSelecionada.razao_social}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Código</label>
                      <p className="text-gray-900">{empresaSelecionada.codigo}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ</label>
                      <p className="text-gray-900">{empresaSelecionada.cnpj}</p>
                    </div>
                    {empresaSelecionada.apelido && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome Fantasia</label>
                        <p className="text-gray-900">{empresaSelecionada.apelido}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data de Abertura</label>
                      <p className="text-gray-900">
                        {empresaSelecionada.data_abertura
                          ? formatarData(empresaSelecionada.data_abertura)
                          : "Não informada"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-4">Inscrições e Regimes</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {empresaSelecionada.inscricao_estadual && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Estadual (IE)</label>
                        <p className="text-gray-900 break-words">{empresaSelecionada.inscricao_estadual}</p>
                      </div>
                    )}
                    {empresaSelecionada.inscricao_municipal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Inscrição Municipal (IM)</label>
                        <p className="text-gray-900 break-words">{empresaSelecionada.inscricao_municipal}</p>
                      </div>
                    )}
                    {empresaSelecionada.regime_federal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Regime Federal</label>
                        <p className="text-gray-900 break-words">{empresaSelecionada.regime_federal}</p>
                      </div>
                    )}
                    {empresaSelecionada.regime_estadual && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Regime Estadual</label>
                        <p className="text-gray-900 break-words">{empresaSelecionada.regime_estadual}</p>
                      </div>
                    )}
                    {empresaSelecionada.regime_municipal && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Regime Municipal</label>
                        <p className="text-gray-900 break-words">{empresaSelecionada.regime_municipal}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                  <h4 className="font-semibold text-purple-800 mb-4">Endereço</h4>
                  <div className="space-y-2">
                    <p className="text-gray-900">
                      {empresaSelecionada.logradouro && `${empresaSelecionada.logradouro}, `}
                      {empresaSelecionada.numero}
                    </p>
                    <p className="text-gray-900">
                      {empresaSelecionada.bairro && `${empresaSelecionada.bairro} - `}
                      {empresaSelecionada.cidade}/{empresaSelecionada.estado}
                    </p>
                    {empresaSelecionada.cep && (
                      <p className="text-gray-900">CEP: {empresaSelecionada.cep}</p>
                    )}
                  </div>
                </div>


                {usuarioLogado?.role === "admin" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditandoEmpresa(empresaSelecionada);
                        setShowCadastrarEmpresa(true);
                        setEmpresaSelecionada(null);
                      }}
                      className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                      <Edit size={16} />
                      Editar
                    </button>
                    <button
                      onClick={async () => {
                        const confirmou = await mostrarConfirmacao({
                          tipo: "info",
                          nome: empresaSelecionada.razao_social,
                          titulo: "Excluir Empresa",
                          mensagem: `Deseja realmente excluir "${empresaSelecionada.razao_social}"?`,
                          textoConfirmar: "Sim, Excluir"
                        });

                        if (confirmou) {
                          try {
                            const resultado = await api.excluirEmpresa(empresaSelecionada.id);
                            if (resultado.sucesso) {
                              await carregarEmpresas();
                              setEmpresaSelecionada(null);
                              adicionarNotificacao("Empresa excluída com sucesso", "sucesso");
                            }
                          } catch (error) {
                            adicionarNotificacao("Erro ao excluir empresa", "erro");
                          }
                        }
                      }}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 flex items-center gap-2"
                    >
                      <Trash2 size={16} />
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ModalGerenciarTags = ({ onClose }) => {
    const [editando, setEditando] = useState(null);
    const [novaTag, setNovaTag] = useState({
      nome: "",
      cor: "bg-red-500",
      texto: "text-white",
    });


    const coresDisponiveis = [
      { bg: "bg-red-500", text: "text-white", nome: "Vermelho" },
      { bg: "bg-orange-500", text: "text-white", nome: "Laranja" },
      { bg: "bg-yellow-500", text: "text-white", nome: "Amarelo" },
      { bg: "bg-green-500", text: "text-white", nome: "Verde" },
      { bg: "bg-blue-500", text: "text-white", nome: "Azul" },
      { bg: "bg-indigo-500", text: "text-white", nome: "Índigo" },
      { bg: "bg-purple-500", text: "text-white", nome: "Roxo" },
      { bg: "bg-pink-500", text: "text-white", nome: "Rosa" },
      { bg: "bg-gray-500", text: "text-white", nome: "Cinza" },
      { bg: "bg-cyan-500", text: "text-white", nome: "Ciano" },
      { bg: "bg-emerald-500", text: "text-white", nome: "Esmeralda" },
      { bg: "bg-amber-500", text: "text-white", nome: "Âmbar" },
    ];

    const handleSalvarNova = () => {
      if (!novaTag.nome.trim()) {
        alert("Digite o nome da tag!");
        return;
      }
      adicionarTag(novaTag);
      setNovaTag({ nome: "", cor: "bg-red-500", texto: "text-white" });
    };

    const handleSalvarEdicao = () => {
      editarTag(editando.id, editando);
      setEditando(null);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Gerenciar Tags</h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>




          <div className="p-6 space-y-6">
            <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200">
              <h4 className="font-semibold text-gray-800 mb-3">
                Criar Nova Tag
              </h4>
              <div className="space-y-4">
                <input
                  type="text"
                  value={novaTag.nome}
                  onChange={(e) =>
                    setNovaTag({ ...novaTag, nome: e.target.value })
                  }
                  placeholder="Nome da tag (ex: Urgente, Revisão, etc.)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Selecione a Cor:
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {coresDisponiveis.map((cor, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() =>
                          setNovaTag({
                            ...novaTag,
                            cor: cor.bg,
                            texto: cor.text,
                          })
                        }
                        className={`w-10 h-10 rounded-full ${cor.bg} border-2 ${novaTag.cor === cor.bg
                            ? "border-gray-800 ring-2 ring-offset-2 ring-gray-400"
                            : "border-transparent"
                          } transition-all hover:scale-110`}
                        title={cor.nome}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Cor selecionada:{" "}
                    {coresDisponiveis.find((c) => c.bg === novaTag.cor)?.nome}
                  </p>
                </div>

                <button
                  onClick={handleSalvarNova}
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 font-medium"
                >
                  Criar Tag
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-800">
                Tags Existentes ({tags.length})
              </h4>
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between bg-gray-50 p-4 rounded-lg"
                >
                  {editando?.id === tag.id ? (
                    <div className="flex gap-3 flex-1 items-center">
                      <input
                        type="text"
                        value={editando.nome}
                        onChange={(e) =>
                          setEditando({ ...editando, nome: e.target.value })
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded"
                      />
                      <select
                        value={editando.cor}
                        onChange={(e) => {
                          const corSelecionada = coresDisponiveis.find(
                            (c) => c.bg === e.target.value
                          );
                          setEditando({
                            ...editando,
                            cor: e.target.value,
                            texto: corSelecionada?.text || "text-white",
                          });
                        }}
                        className="px-3 py-2 border border-gray-300 rounded"
                      >
                        {coresDisponiveis.map((cor) => (
                          <option key={cor.bg} value={cor.bg}>
                            {cor.nome}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleSalvarEdicao}
                        className="text-green-600 hover:text-green-700 p-2"
                      >
                        <Check size={20} />
                      </button>
                      <button
                        onClick={() => setEditando(null)}
                        className="text-gray-600 hover:text-gray-700 p-2"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-4 h-4 rounded-full ${tag.cor}`}
                        ></div>
                        <span
                          className={`${tag.cor} ${tag.texto} px-3 py-1 rounded-full text-sm font-medium`}
                        >
                          {tag.nome}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditando(tag)}
                          className="text-blue-600 hover:text-blue-700 p-2"
                          title="Editar tag"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            excluirTagDireta(tag.id);
                          }}
                          className="text-red-600 hover:text-red-700 p-2"
                          title="Excluir tag"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ModalSelecionarTags = ({ processo, tags, onClose, onSalvar }) => {
    const [tagsSelecionadas, setTagsSelecionadas] = useState(
      processo.tags || []
    );

    const toggleTag = (tagId) => {
      setTagsSelecionadas((prev) =>
        prev.includes(tagId)
          ? prev.filter((id) => id !== tagId)
          : [...prev, tagId]
      );
    };

    const handleSalvar = () => {
      onSalvar(processo.id, tagsSelecionadas);
      onClose();
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Selecionar Tags</h3>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-3">
                Processo: {processo.nomeEmpresa}
              </h4>
              <p className="text-sm text-gray-600">
                Selecione as tags que deseja aplicar a este processo
              </p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={tagsSelecionadas.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span
                    className={`${tag.cor} ${tag.texto} px-3 py-1 rounded-full text-sm font-medium flex-1 text-center`}
                  >
                    {tag.nome}
                  </span>
                </label>
              ))}
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Aplicar Tags
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const aplicarTagsProcesso = async (processoId, novasTags) => {
    try {
      const processo = processos.find(p => p.id === processoId);

      if (!processo) {
        adicionarNotificacao("Processo não encontrado", "erro");
        return;
      }

      console.log('🏷️ Salvando tags:', novasTags, 'no processo:', processoId);

      const response = await fetchAutenticado(`${API_URL}/processos/${processoId}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...processo,
          tags: novasTags
        })
      });

      const resultado = await response.json();
      console.log('📦 Resposta do servidor:', resultado);

      if (resultado.sucesso) {
        setProcessos(
          processos.map((p) => {
            if (p.id === processoId) {
              return {
                ...p,
                tags: novasTags,
              };
            }
            return p;
          })
        );

        adicionarNotificacao("Tags atualizadas com sucesso", "sucesso");
      } else {
        adicionarNotificacao(`Erro ao salvar tags: ${resultado.erro}`, "erro");
      }
    } catch (error) {
      console.error('❌ Erro ao aplicar tags:', error);
      adicionarNotificacao(`Erro ao salvar tags: ${error.message}`, "erro");
    }
  };
  const VisualizacaoCompleta = ({
    processo,
    departamentosCriados,
    onClose,
  }) => {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Processo Completo
                </h3>
                <p className="text-white opacity-90 text-sm">
                  {processo.nomeEmpresa}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="font-bold text-gray-800 mb-4">
                Informações Gerais
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <span className="font-medium text-gray-600">Cliente:</span>
                  <div className="text-gray-800">{processo.cliente}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Status:</span>
                  <div className="text-gray-800">{processo.status}</div>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Prioridade:</span>
                  <div className="text-gray-800">{processo.prioridade}</div>
                </div>
              </div>
            </div>

            {departamentosCriados.map((dept) => {
              const respostasDept = processo.respostas[dept.id] || {};
              const hasRespostas = Object.keys(respostasDept).length > 0;

              if (!hasRespostas) return null;

              return (
                <div
                  key={dept.id}
                  className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm"
                >
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <dept.icone size={20} />
                    {dept.nome} - {dept.responsavel}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    const resposta = respostasDept[pergunta.id];
                    if (!resposta) return null;

                    return (
                    <div
                      key={pergunta.id}
                      className={
                        pergunta.tipo === "textarea" ? "md:col-span-2" : ""
                      }
                    >
                      <div className="bg-gray-50 rounded-lg p-4">
                        <label className="block text-sm font-medium text-gray-600 mb-2">
                          {pergunta.label}
                        </label>
                        <div className="text-gray-800">
                          {pergunta.tipo === "textarea" ? (
                            <div className="whitespace-pre-wrap">
                              {resposta}
                            </div>
                          ) : (
                            resposta
                          )}
                        </div>
                      </div>
                    </div>
                    );
                    )
                  </div>
                </div>
              );
            })}

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="font-bold text-gray-800 mb-4">
                Histórico Completo
              </h4>
              <div className="space-y-4">
                {processo.historico.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl"
                  >
                    <div className="mt-1">
                      {item.tipo === "inicio" && (
                        <Calendar className="text-blue-500" size={16} />
                      )}
                      {item.tipo === "conclusao" && (
                        <CheckCircle className="text-green-500" size={16} />
                      )}
                      {item.tipo === "finalizacao" && (
                        <Star className="text-yellow-500" size={16} />
                      )}
                      {item.tipo === "movimentacao" && (
                        <ArrowRight className="text-purple-500" size={16} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {item.acao}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        <span className="bg-gray-200 px-2 py-1 rounded">
                          {item.departamento}
                        </span>
                        <span className="mx-2">•</span>
                        <span>{item.responsavel}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {formatarDataHora(item.data)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span>Documentos do Processo</span>
                <button
                  onClick={() => {
                    onClose();
                    setShowUploadDocumento(processo);
                  }}
                  className="bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-cyan-700 flex items-center gap-2"
                >
                  <Upload size={16} />
                  Adicionar Documento
                </button>
              </h4>

              {documentos[processo.id]?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {documentos[processo.id].map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-gray-400" />
                          <span className="font-medium text-sm">
                            {doc.nome}
                          </span>
                        </div>
                        <div className="flex gap-1">
                          {(() => {
                            const BACKEND_BASE = API_URL.replace(/\/api\/?$/, "");
                            const fileUrl = doc.url && (doc.url.startsWith('http') ? doc.url : `${BACKEND_BASE}${doc.url}`);

                            return (
                              <>
                                <button
                                  onClick={() =>
                                    setPreviewDocumento({ ...doc, url: fileUrl, processo })
                                  }
                                  className="p-1 text-cyan-600 hover:bg-cyan-100 rounded"
                                >
                                  <Eye size={14} />
                                </button>
                                <a
                                  href={fileUrl}
                                  download={doc.nome}
                                  className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                >
                                  <Download size={14} />
                                </a>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {doc.tipoCategoria} •{" "}
                        {(doc.tamanho / 1024 / 1024).toFixed(2)} MB
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatarDataHora(doc.dataUpload)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText size={48} className="mx-auto mb-4 opacity-30" />
                  <p>Nenhum documento enviado ainda</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ModalAnalytics = ({ onClose, analytics, departamentosCriados }) => {
    const [visualizacaoAtiva, setVisualizacaoAtiva] = useState("overview");

    const GraficoBarras = ({
      dados,
      titulo,
      cor = "from-cyan-500 to-blue-600",
    }) => {
      const maxValor = Math.max(
        ...Object.values(dados).map((val) =>
          typeof val === "number" ? val : val.tempoMedio || 0
        )
      );

      return (
        <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
          <h4 className="font-bold text-gray-800 mb-4">{titulo}</h4>
          <div className="space-y-3">
            {Object.entries(dados).map(([nome, valor]) => {
              const valorNumerico =
                typeof valor === "number" ? valor : valor.tempoMedio || 0;
              const porcentagem =
                maxValor > 0 ? (valorNumerico / maxValor) * 100 : 0;

              return (
                <div key={nome} className="flex items-center gap-3">
                  <div className="w-32 text-sm text-gray-600 truncate">
                    {nome}
                  </div>
                  <div className="flex-1">
                    <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
                      <div
                        className={`bg-gradient-to-r ${cor} h-4 rounded-full transition-all duration-500`}
                        style={{ width: `${porcentagem}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="w-16 text-right text-sm font-semibold text-gray-700">
                    {typeof valor === "number"
                      ? `${valor}d`
                      : `${valor.tempoMedio}d`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                  <TrendingUp size={28} />
                  Dashboard Análises
                </h3>
                <p className="text-white opacity-90 text-sm mt-1">
                  Métricas e insights do seu fluxo de trabalho
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-4 mt-4">
              {[
                { id: "overview", label: "Visão Geral", icon: TrendingUp },
                { id: "departamentos", label: "Departamentos", icon: Building },
                { id: "previsoes", label: "Previsões", icon: Clock },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setVisualizacaoAtiva(item.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${visualizacaoAtiva === item.id
                        ? "bg-white text-cyan-600 shadow-lg"
                        : "text-white hover:bg-white hover:bg-opacity-20"
                      }`}
                  >
                    <Icon size={16} className="inline mr-2" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {visualizacaoAtiva === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="text-2xl font-bold">
                      {analytics.metricasGerais?.totalProcessos || 0}
                    </div>
                    <div className="text-sm opacity-90">Total Processos</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="text-2xl font-bold">
                      {analytics.metricasGerais?.processosFinalizados || 0}
                    </div>
                    <div className="text-sm opacity-90">Concluídos</div>
                  </div>
                  <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="text-2xl font-bold">
                      {analytics.metricasGerais?.taxaSucesso || 0}%
                    </div>
                    <div className="text-sm opacity-90">Taxa Sucesso</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-4 shadow-lg">
                    <div className="text-2xl font-bold">
                      {analytics.metricasGerais?.tempoMedioTotal || 0}d
                    </div>
                    <div className="text-sm opacity-90">Tempo Médio</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GraficoBarras
                    dados={analytics.tempoMedioPorDepartamento}
                    titulo="Tempo Médio por Departamento (dias)"
                    cor="from-cyan-500 to-blue-600"
                  />

                  <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <AlertCircle size={20} className="text-amber-500" />
                      Principais Gargalos
                    </h4>
                    <div className="space-y-3">
                      {analytics.gargalos?.map((gargalo, index) => (
                        <div
                          key={gargalo.departamento}
                          className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 bg-amber-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-semibold text-amber-800">
                                {gargalo.departamento}
                              </div>
                              <div className="text-xs text-amber-600">
                                {gargalo.processos} processos
                              </div>
                            </div>
                          </div>
                          <div className="text-amber-700 font-bold">
                            {gargalo.taxaGargalo.toFixed(1)}d
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4">
                    Taxa de Conclusão Mensal
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {Object.entries(analytics.taxaConclusaoMensal || {}).map(
                      ([mes, quantidade]) => (
                        <div
                          key={mes}
                          className="text-center p-3 bg-cyan-50 rounded-lg border border-cyan-200"
                        >
                          <div className="text-2xl font-bold text-cyan-600">
                            {quantidade}
                          </div>
                          <div className="text-sm text-cyan-700">{mes}</div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}

            {visualizacaoAtiva === "departamentos" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Object.entries(analytics.performanceDepartamentos || {}).map(
                    ([deptId, performance]) => (
                      <div
                        key={deptId}
                        className="bg-white rounded-xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all"
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center text-white">
                            <Building size={24} />
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-800">
                              {performance.nome}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {performance.processosConcluidos} processos
                            </p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Tempo Médio:
                            </span>
                            <span className="font-semibold text-cyan-600">
                              {performance.tempoMedio}d
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">
                              Eficiência:
                            </span>
                            <span className="font-semibold text-green-600">
                              {Math.round(performance.eficiencia)}%
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${performance.eficiencia}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {visualizacaoAtiva === "previsoes" && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
                  <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-purple-500" />
                    Previsão de Conclusão
                  </h4>
                  <div className="space-y-4">
                    {Object.entries(analytics.previsaoConclusao || {}).map(
                      ([processoId, previsao]) => (
                        <div
                          key={processoId}
                          className="flex items-center justify-between p-4 bg-purple-50 rounded-lg border border-purple-200"
                        >
                          <div>
                            <div className="font-semibold text-purple-800">
                              {previsao.nomeEmpresa}
                            </div>
                            <div className="text-sm text-purple-600">
                              Previsão: {previsao.previsao}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`px-3 py-1 rounded-full text-xs font-medium ${previsao.confianca > 70
                                  ? "bg-green-100 text-green-700"
                                  : previsao.confianca > 40
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                            >
                              {previsao.confianca}% confiança
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const mostrarConfirmacao = (config) => {
    return new Promise((resolve) => {
      let settled = false;

      const safeResolve = (val) => {
        if (settled) return;
        settled = true;
        resolve(val);
        setTimeout(() => setShowConfirmacao(null), 10);
      };

      setShowConfirmacao({
        ...config,
        onConfirm: () => safeResolve(true),
        onCancel: () => safeResolve(false)
      });
    });
  };


  const mostrarAlerta = (titulo, mensagem, tipo = "info") => {
    setShowAlerta(null);

    setTimeout(() => {
      setShowAlerta({
        titulo,
        mensagem,
        tipo,
        onClose: () => setShowAlerta(null)
      });
    }, 10);
  };

  const confirmarExclusaoProcesso = (processo) => {
    return mostrarConfirmacao({
      tipo: "processo",
      nome: processo.nomeEmpresa,
      titulo: "Excluir Processo",
      mensagem: `Tem certeza que deseja excluir o processo "${processo.nomeEmpresa}"?\n\nEsta ação não pode ser desfeita.`,
      textoConfirmar: "Sim, Excluir"
    });
  };

  const confirmarExclusaoDepartamento = async (departamento) => {
    return new Promise((resolve) => {
      setShowConfirmacao({
        tipo: "departamento",
        nome: departamento.nome,
        titulo: "Excluir Departamento",
        mensagem: `Tem certeza que deseja excluir o departamento "${departamento.nome}"?`,
        onConfirm: () => {
          setShowConfirmacao(null);
          setTimeout(() => resolve(true), 10);
        },
        onCancel: () => {
          setShowConfirmacao(null);
          setTimeout(() => resolve(false), 10);
        }
      });
    });
  };


  const confirmarExclusaoTag = (tag) => {
    return mostrarConfirmacao({
      tipo: "tag",
      nome: tag.nome,
      titulo: "Excluir Tag",
      mensagem: `Tem certeza que deseja excluir a tag "${tag.nome}"?\n\nEsta ação removerá a tag de todos os processos.`,
      textoConfirmar: "Sim, Excluir"
    });
  };

  const confirmarExclusaoComentario = () => {
    return mostrarConfirmacao({
      tipo: "comentario",
      nome: "comentário",
      titulo: "Excluir Comentário",
      mensagem: "Tem certeza que deseja excluir este comentário?",
      textoConfirmar: "Sim, Excluir"
    });
  };

  const confirmarExclusaoDocumento = async (documento) => {
    return new Promise((resolve) => {
      setShowConfirmacao({
        tipo: "documento",
        nome: documento.nome,
        titulo: "Excluir Documento",
        mensagem: `Tem certeza que deseja excluir o documento "${documento.nome}"?`,
        onConfirm: () => {
          setShowConfirmacao(null);
          setTimeout(() => resolve(true), 10);
        },
        onCancel: () => {
          setShowConfirmacao(null);
          setTimeout(() => resolve(false), 10);
        }
      });
    });
  };


  const GaleriaDocumentos = ({
    departamento,
    processos,
    documentos,
    onClose,
  }) => {

    useEffect(() => {
      if (departamento) {
        const docsEncontrados = debugGaleria(departamento);
        console.log('🎯 Documentos que deveriam aparecer:', docsEncontrados);
      }
    }, [departamento]);

    const documentosDoDepartamento = processos.flatMap((processo) =>
      (documentos[processo.id] || [])
        .filter((doc) => {
          if (String(doc.departamentoId) === String(departamento.id)) return true;

          if (doc.perguntaId && Array.isArray(departamento.questionario)) {
            return departamento.questionario.some((p) => String(p.id) === String(doc.perguntaId));
          }

          return false;
        })
        .map((doc) => ({ ...doc, processo }))
    );

    console.log('📁 Documentos filtrados para galeria:', documentosDoDepartamento);


    const agruparPorTipo = () => {
      const grupos = {};
      documentosDoDepartamento.forEach((doc) => {
        if (!grupos[doc.tipoCategoria]) {
          grupos[doc.tipoCategoria] = [];
        }
        grupos[doc.tipoCategoria].push(doc);
      });
      return grupos;
    };

    const grupos = agruparPorTipo();

    const DocumentoCard = ({ documento, onPreview }) => {
      const getIcone = () => {
        if (documento.tipo.startsWith("image/")) {
          return <FileText className="text-blue-500" size={24} />;
        }
        if (documento.tipo === "application/pdf") {
          return <FileText className="text-red-500" size={24} />;
        }
        return <FileText className="text-gray-500" size={24} />;
      };

      const getCorTipo = () => {
        if (documento.tipo.startsWith("image/"))
          return "bg-blue-100 text-blue-700";
        if (documento.tipo === "application/pdf")
          return "bg-red-100 text-red-700";
        return "bg-gray-100 text-gray-700";
      };

      return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-3">
            {getIcone()}
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${getCorTipo()}`}
            >
              {documento.tipo.split("/")[1]?.toUpperCase() || "DOC"}
            </span>
          </div>

          <div className="mb-3">
            <h5 className="font-medium text-gray-900 text-sm mb-1 truncate">
              {documento.nome}
            </h5>
            <p className="text-xs text-gray-600 mb-1">
              {documento.processo.nomeEmpresa}
            </p>
            <p className="text-xs text-gray-500">
              {(documento.tamanho / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => onPreview(documento)}
              className="flex-1 bg-cyan-600 text-white px-3 py-1.5 rounded text-xs hover:bg-cyan-700 flex items-center justify-center gap-1"
            >
              <Eye size={12} />
              Visualizar
            </button>

            <button
              onClick={async (e) => {
                e.stopPropagation();
                const url = resolveFileUrl(documento.url);
                try {
                  const response = await fetch(url);
                  const blob = await response.blob();
                  const downloadUrl = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = downloadUrl;
                  link.download = documento.nome;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(downloadUrl);
                } catch (error) {
                  console.error('Erro ao baixar:', error);
                }
              }}
              className="flex-1 bg-gray-600 text-white px-3 py-1.5 rounded text-xs hover:bg-gray-700 flex items-center justify-center gap-1"
            >
              <Download size={12} />
              Baixar
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                console.log('🖱️ Clique em Excluir (DocumentoCard):', {
                  processoId: documento.processo.id,
                  documentoId: documento.id,
                  nome: documento.nome,
                });
                excluirDocumentoDireto(documento.processo.id, documento.id);
              }}
              className="flex-1 bg-red-500 text-white px-3 py-1.5 rounded text-xs hover:bg-red-600 flex items-center justify-center gap-1"
              title="Excluir documento"
            >
              <X size={12} />
              Excluir
            </button>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            {formatarDataHora(documento.dataUpload)}
          </div>
        </div>
      );

    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div
            className={`bg-gradient-to-r ${departamento.cor} p-6 rounded-t-2xl`}
          >
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Galeria de Documentos - {departamento.nome}
                </h3>
                <p className="text-white opacity-90 text-sm">
                  {documentosDoDepartamento.length} documentos encontrados
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>

            </div>
          </div>

          <div className="p-6">
            {documentosDoDepartamento.length === 0 ? (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 mb-2">
                  Nenhum documento encontrado
                </p>
                <p className="text-sm text-gray-500">
                  Os documentos aparecerão aqui quando forem enviados para
                  processos deste departamento
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(grupos).map(([tipo, docs]) => (
                  <div key={tipo} className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-800 mb-3 capitalize">
                      {tipo.replace("_", " ")} ({docs.length})
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {docs.map((doc) => (
                        <DocumentoCard
                          key={doc.id}
                          documento={doc}
                          onPreview={setPreviewDocumento}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };


  const PreviewDocumento = ({ documento, onClose }) => {
    const [erroCarregamento, setErroCarregamento] = useState(false);
    const [carregando, setCarregando] = useState(true);

    const isGaleria = documento.galeria === true;
    const documentos = isGaleria ? documento.docs : [documento];
    const [indiceAtual, setIndiceAtual] = useState(0);
    const docAtual = documentos[indiceAtual];

    const urlCompleta = resolveFileUrl(docAtual.url);

    console.log('🔍 Preview Documento:', {
      documento: docAtual,
      urlOriginal: docAtual.url,
      urlResolvida: urlCompleta,
      tipo: docAtual.tipo
    });

    const verificarArquivo = async () => {
      try {
        setCarregando(true);
        setErroCarregamento(false);

        const response = await fetch(urlCompleta, { method: 'HEAD' });
        if (!response.ok) {
          throw new Error(`Arquivo não encontrado: ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar arquivo:', error);
        setErroCarregamento(true);
      } finally {
        setCarregando(false);
      }
    };

    useEffect(() => {
      verificarArquivo();
    }, [docAtual]);

    const navegarDocumento = (direcao) => {
      if (direcao === 'anterior' && indiceAtual > 0) {
        setIndiceAtual(indiceAtual - 1);
      } else if (direcao === 'proximo' && indiceAtual < documentos.length - 1) {
        setIndiceAtual(indiceAtual + 1);
      }
    };

    const renderConteudo = (doc) => {
      const resolvedUrl = resolveFileUrl(doc.url);

      if (erroCarregamento) {
        return (
          <div className="text-center py-12">
            <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
            <p className="text-gray-600 mb-4">
              Arquivo não encontrado no servidor
            </p>
            <p className="text-sm text-gray-500 mb-4">
              O arquivo "{doc.nome}" não está disponível.
            </p>
            <a
              href={resolvedUrl}
              download={doc.nome}
              className="bg-slate-700 text-white px-6 py-2 rounded-lg hover:bg-slate-600 inline-flex items-center gap-2"
            >
              <Download size={16} />
              Tentar Baixar Arquivo
            </a>
          </div>
        );
      }

      if (carregando) {
        return (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando documento...</p>
          </div>
        );
      }

      if (doc.tipo.startsWith("image/")) {
        return (
          <div className="flex justify-center">
            <img
              src={resolvedUrl}
              alt={doc.nome}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
              onError={() => setErroCarregamento(true)}
            />
          </div>
        );
      }

      if (doc.tipo === "application/pdf") {
        return (
          <div className="w-full h-full">
            <iframe
              src={`${resolvedUrl}#toolbar=1`}
              className="w-full h-[70vh] border-0 rounded-lg shadow-lg"
              title={doc.nome}
              onError={() => setErroCarregamento(true)}
            />
            <div className="mt-3 text-center">
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-gray-200 text-gray-800 px-3 py-1 rounded hover:bg-gray-300 text-sm"
              >
                Abrir em nova aba
              </a>
            </div>
          </div>
        );
      }

      return (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600 mb-4">
            Visualização não disponível para este tipo de arquivo
          </p>
          <p className="text-sm text-gray-500 mb-4">
            Tipo: {doc.tipo}
          </p>
          <a
            href={resolvedUrl}
            download={doc.nome}
            className="bg-slate-700 text-white px-6 py-2 rounded-lg hover:bg-slate-600 inline-flex items-center gap-2"
          >
            <Download size={16} />
            Baixar Arquivo
          </a>
        </div>
      );
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="bg-white shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-gray-300">
          {/* Header */}
          <div className="bg-slate-800 p-6 flex-shrink-0 border-b border-slate-600">
            <div className="flex justify-between items-center">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white truncate drop-shadow-sm">
                  {isGaleria ? documento.titulo || `Galeria de Documentos` : docAtual.nome}
                </h3>
                {isGaleria && (
                  <p className="text-slate-300 text-sm mt-1 flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                    Documento {indiceAtual + 1} de {documentos.length}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isGaleria && documentos.length > 1 && (
                  <div className="flex items-center gap-2 text-white bg-slate-900/30 backdrop-blur-sm rounded-xl px-3 py-2 border border-slate-600/30">
                    <button
                      onClick={() => navegarDocumento('anterior')}
                      disabled={indiceAtual === 0}
                      className="p-2 bg-slate-700/50 rounded-lg hover:bg-slate-600/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <span className="text-sm font-medium px-2 min-w-[60px] text-center">
                      {indiceAtual + 1} / {documentos.length}
                    </span>
                    <button
                      onClick={() => navegarDocumento('proximo')}
                      disabled={indiceAtual === documentos.length - 1}
                      className="p-2 bg-slate-700/50 rounded-lg hover:bg-slate-600/70 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 hover:scale-105 active:scale-95"
                    >
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}

                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    try {
                      const response = await fetch(urlCompleta);
                      const blob = await response.blob();
                      const downloadUrl = window.URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = docAtual.nome;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(downloadUrl);
                    } catch (error) {
                      console.error('Erro ao baixar o arquivo:', error);
                    }
                  }}
                  className="p-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg hover:shadow-emerald-500/50"
                  title="Baixar arquivo"
                >
                  <Download size={18} />
                </button>

                <button
                  onClick={onClose}
                  className="p-2.5 bg-slate-700/50 text-white rounded-lg hover:bg-red-500 transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-gray-100">
            <div className="w-full max-w-4xl">
              {renderConteudo(docAtual)}
            </div>
          </div>

          <div className="bg-slate-50 p-4 border-t border-slate-300">
            <div className="flex justify-between items-center text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Nome:</span>
                <span className="text-slate-600">{docAtual.nome}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Tipo:</span>
                <span className="px-2 py-1 bg-slate-200 rounded text-slate-700 text-xs font-medium">{docAtual.tipo}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Tamanho:</span>
                <span className="text-slate-600">{(docAtual.tamanho / 1024 / 1024).toFixed(2)} MB</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">Data:</span>
                <span className="text-slate-600">{formatarDataHora(docAtual.dataUpload)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const ProcessosEmRisco = () => {
    const [processosEmRisco, setProcessosEmRisco] = useState([]);

    useEffect(() => {
      carregarProcessosEmRisco();
    }, []);

    const carregarProcessosEmRisco = async () => {
      try {
        const response = await fetchAutenticado(`${API_URL}/processos/em-risco`);
        const dados = await response.json();
        setProcessosEmRisco(dados.processos || []);
      } catch (error) {
        console.error('Erro ao carregar processos em risco:', error);
      }
    };

    return (
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-lg">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle size={20} className="text-amber-600" />
          <h3 className="font-bold text-amber-800">⚠️ Processos Próximos ao Avanço Automático</h3>
        </div>

        {processosEmRisco.length === 0 ? (
          <p className="text-sm text-amber-700">Nenhum processo em risco no momento</p>
        ) : (
          <div className="space-y-2">
            {processosEmRisco.map(processo => (
              <div key={processo.id} className="bg-white rounded-lg p-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{processo.nome_empresa}</p>
                    <p className="text-xs text-gray-600">
                      Avança em {5 - processo.dias_parado} dia(s)
                    </p>
                  </div>
                  <button
                    onClick={() => avancarParaProximoDepartamento(processo.id)}
                    className="bg-amber-600 text-white px-3 py-1 rounded text-xs hover:bg-amber-700"
                  >
                    Avançar Agora
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
  const ModalComentarios = ({ processoId, processo, onClose }) => {
    const [comentarioAtual, setComentarioAtual] = useState("");
    const [editando, setEditando] = useState(null);
    const [textoEditado, setTextoEditado] = useState("");
    const [enviando, setEnviando] = useState(false);


    const comentariosDoProcesso = Array.isArray(comentarios[processoId])
      ? comentarios[processoId]
      : [];

    const deptAtual = departamentosCriados.find(
      (d) => d.id === processo.departamentoAtual
    );

    const handleEnviar = async () => {
      if (!comentarioAtual.trim() || enviando) return;

      setEnviando(true);
      try {
        const mencoes = detectarMencoes(comentarioAtual);
        await adicionarComentario(processoId, comentarioAtual, mencoes);
        setComentarioAtual("");
      } finally {
        setEnviando(false);
      }
    };

    const handleExcluir = async (comentarioId) => {
      await excluirComentario(processoId, comentarioId);
    };

    const handleEditar = (comentario) => {
      setEditando(comentario.id);
      setTextoEditado(comentario.texto);
    };

    const handleSalvarEdicao = (comentarioId) => {
      editarComentario(processoId, comentarioId, textoEditado);
      setEditando(null);
      setTextoEditado("");
    };

    const handleCancelarEdicao = () => {
      setEditando(null);
      setTextoEditado("");
    };

    const renderTextoComMencoes = (texto) => {
      const partes = texto.split(/(@\w+)/g);
      return partes.map((parte, idx) => {
        if (parte.startsWith("@")) {
          return (
            <span
              key={idx}
              className="bg-cyan-100 text-cyan-700 px-1 rounded font-medium"
            >
              {parte}
            </span>
          );
        }
        return parte;
      });
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl flex-shrink-0">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <MessageSquare size={24} />
                  Comentários - {processo.nomeEmpresa}
                </h3>
                <p className="text-white opacity-90 text-sm mt-1">
                  {comentariosDoProcesso.length} comentários • Departamento:{" "}
                  {deptAtual?.nome}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {comentariosDoProcesso.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">
                  Nenhum comentário ainda
                </p>
                <p className="text-sm">
                  Seja o primeiro a comentar neste processo
                </p>
              </div>
            ) : (
              comentariosDoProcesso.map((comentario) => {
                const dept = departamentosCriados.find(
                  (d) => d.id === comentario.departamentoId
                );

                return (
                  <div
                    key={comentario.id}
                    className="bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full bg-gradient-to-br ${dept?.cor || "from-gray-400 to-gray-500"
                            } flex items-center justify-center text-white font-bold`}
                        >
                          {comentario.autor.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            {comentario.autor}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{comentario.departamento}</span>
                            <span>•</span>
                            <span>{comentario.timestamp}</span>
                            {comentario.editado && (
                              <>
                                <span>•</span>
                                <span className="italic">Editado</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditar(comentario)}
                          className="p-2 text-cyan-600 hover:bg-cyan-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit size={14} />
                        </button>
                        {temPermissao("excluir_tag") && (
                          <button
                            onClick={() => excluirComentarioDireto(processo.id, comentario.id)}
                            className="text-red-600 hover:text-red-700 p-2"
                            title="Excluir comentário"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {editando === comentario.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={textoEditado}
                          onChange={(e) => setTextoEditado(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 resize-none"
                          rows={3}
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSalvarEdicao(comentario.id)}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={handleCancelarEdicao}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-gray-800 whitespace-pre-wrap pl-13">
                        {renderTextoComMencoes(comentario.texto)}
                      </div>
                    )}

                    {comentario.mencoes && comentario.mencoes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <User size={12} />
                          <span>
                            Mencionou: {comentario.mencoes.join(", ")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-gray-200 p-6 bg-gray-50 rounded-b-2xl flex-shrink-0">
            <div className="space-y-3">
              <textarea
                value={comentarioAtual}
                onChange={(e) => setComentarioAtual(e.target.value)}
                placeholder="Digite seu comentário..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.ctrlKey) {
                    handleEnviar();
                  }
                }}
              />

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  <kbd className="px-2 py-1 bg-gray-200 rounded">Ctrl</kbd> +{" "}
                  <kbd className="px-2 py-1 bg-gray-200 rounded">Enter</kbd>{" "}
                  para enviar
                </div>

                <button
                  onClick={handleEnviar}
                  disabled={!comentarioAtual.trim()}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed text-white px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-all"
                >
                  <MessageSquare size={16} />
                  Enviar Comentário
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const ModalUploadDocumento = ({
    processo,
    perguntaId,
    perguntaLabel,
    onClose,
    onUpload,
    onUploadSuccess,
  }) => {
    const [arquivos, setArquivos] = useState([]);
    const [tipoDocumento, setTipoDocumento] = useState("geral");
    const [arrastando, setArrastando] = useState(false);

    const tiposDocumento = [
      { value: "geral", label: "Geral" },
      { value: "contrato_social", label: "Contrato Social" },
      { value: "cnpj", label: "CNPJ" },
      { value: "ie", label: "Inscrição Estadual" },
      { value: "certificado_digital", label: "Certificado Digital" },
      { value: "procuracoes", label: "Procurações" },
      { value: "documentos_socios", label: "Documentos dos Sócios" },
      { value: "comprovante_endereco", label: "Comprovante de Endereço" },
    ];

    const handleArquivosSelecionados = (files) => {
      const novosArquivos = Array.from(files).map((file) => ({
        file,
        id: Date.now() + Math.random(),
        nome: file.name,
        tipo: file.type,
        tamanho: file.size,
        progresso: 0,
      }));
      setArquivos((prev) => [...prev, ...novosArquivos]);
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      setArrastando(true);
    };

    const handleDragLeave = () => {
      setArrastando(false);
    };

    const handleDrop = (e) => {
      e.preventDefault();
      setArrastando(false);
      handleArquivosSelecionados(e.dataTransfer.files);
    };

    const handleUpload = async () => {
      if (arquivos.length === 0) {
        await mostrarAlerta("Nenhum Arquivo", "Selecione pelo menos um arquivo para enviar", "aviso");
        return;
      }

      try {
        console.log('📤 Iniciando upload de', arquivos.length, 'arquivo(s)');
        setUploading(true);

        let sucessos = 0;
        let erros = 0;

        for (const arquivo of arquivos) {
          try {
            console.log('📤 Enviando:', arquivo.nome);

            const sucesso = await onUpload(
              processo.id,
              arquivo.file,
              tipoDocumento,
              perguntaId
            );

            if (sucesso) {
              sucessos++;
              console.log('✅ Upload sucesso:', arquivo.nome);
            } else {
              erros++;
              console.error('❌ Upload falhou:', arquivo.nome);
            }
          } catch (error) {
            erros++;
            console.error('❌ Erro no upload:', arquivo.nome, error);
          }
        }

        console.log('📊 Resultado:', { sucessos, erros });

        if (sucessos > 0) {
          if (onUploadSuccess) {
            console.log('🔄 Chamando onUploadSuccess...');
            await onUploadSuccess();
          }

          setArquivos([]);

          console.log('🚪 Fechando modal...');
          onClose();

          if (sucessos === 1) {
            adicionarNotificacao('✅ Documento enviado com sucesso!', 'sucesso');
          } else {
            adicionarNotificacao(`✅ ${sucessos} documentos enviados com sucesso!`, 'sucesso');
          }
        }

        if (erros > 0) {
          await mostrarAlerta(
            "Erro no Upload",
            `${erros} arquivo(s) não puderam ser enviados`,
            "erro"
          );
        }

      } catch (error) {
        console.error('❌ Erro geral no upload:', error);
        await mostrarAlerta("Erro", "Erro ao fazer upload: " + error.message, "erro");
      } finally {
        setUploading(false);
      }
    };

    const removerArquivo = (id) => {
      setArquivos((prev) => prev.filter((a) => a.id !== id));
    };

    const getIconePorTipo = (tipo) => {
      if (tipo.startsWith("image/"))
        return <FileText className="text-blue-500" />;
      if (tipo === "application/pdf")
        return <FileText className="text-red-500" />;
      return <FileText className="text-gray-500" />;
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-white">
                  {perguntaId
                    ? "Upload para Pergunta"
                    : "Upload de Documentos Gerais"}
                </h3>
                {perguntaLabel && (
                  <p className="text-white opacity-90 text-sm mt-1">
                    Para: {perguntaLabel}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
              <h4 className="font-semibold text-cyan-800 mb-2">
                {processo.nomeEmpresa}
              </h4>
              <p className="text-sm text-cyan-600">
                Cliente: {processo.cliente}
              </p>
              {perguntaLabel && (
                <p className="text-sm text-cyan-600 mt-1">
                  <strong>Pergunta:</strong> {perguntaLabel}
                </p>
              )}
            </div>

            <div></div>

            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${arrastando
                  ? "border-cyan-500 bg-cyan-50"
                  : "border-gray-300 hover:border-cyan-400 hover:bg-cyan-50"
                }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2">
                Arraste e solte os arquivos aqui, ou clique para selecionar
              </p>
              <input
                type="file"
                multiple
                onChange={(e) => handleArquivosSelecionados(e.target.files)}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-block bg-cyan-600 text-white px-6 py-2 rounded-lg cursor-pointer hover:bg-cyan-700"
              >
                Selecionar Arquivos
              </label>
            </div>

            {arquivos.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-800">
                  Arquivos Selecionados:
                </h4>
                {arquivos.map((arquivo) => (
                  <div
                    key={arquivo.id}
                    className="flex items-center justify-between bg-gray-50 p-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {getIconePorTipo(arquivo.tipo)}
                      <div>
                        <div className="font-medium text-sm">
                          {arquivo.nome}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(arquivo.tamanho / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => removerArquivo(arquivo.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-4 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={arquivos.length === 0 || uploading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Enviar {arquivos.length} Documento(s)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };


  const styles = `
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .break-words {
    word-break: break-word;
    overflow-wrap: break-word;
  }
  
  .card-grid-responsive {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: start;
  }
  
  .company-name-container {
    min-width: 0; /* Importante para flexbox shrinking */
  }
      /* ✅ NOVO: Estilo para textos com múltiplas linhas */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  /* Força quebra de linha em palavras muito longas */
  .break-words {
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
  }
/* Trunca texto em 1 linha com reticências */
  .truncate-1 {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  /* Mantém o line-clamp-2 para casos específicos */
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  /* Remove o break-words antigo que causava quebra */
  .break-words {
    overflow-wrap: normal;
    word-break: normal;
  }

  /* Container responsivo */
  .card-grid-responsive {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    align-items: start;
  }
  
  .company-name-container {
    min-width: 0;
    overflow: hidden;
  }
     /* Tooltip customizado */
  .custom-tooltip {
    position: relative;
  }

  .custom-tooltip:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    white-space: nowrap;
    z-index: 1000;
    margin-bottom: 0.5rem;
    max-width: 300px;
    white-space: normal;
    word-wrap: break-word;
  }

  /* Adicione cursor pointer para indicar hover */
  .cursor-help {
    cursor: help;
`;

  <style jsx>{styles}</style>;


  const additionalStyles = `
  /* Estilos para os botões compactos */
  .compact-button {
    font-size: 10px;
    padding: 4px 8px;
    white-space: nowrap;
  }

  /* Estilos para o grid de detalhes do processo */
  .process-details-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .process-detail-item {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .process-detail-text {
    min-width: 0;
    flex: 1;
  }

  /* Animação para novos itens */
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-slide-in {
    animation: slideIn 0.3s ease-out;
  }

  /* Hover effects melhorados */
  .hover-scale {
    transition: transform 0.2s ease;
  }

  .hover-scale:hover {
    transform: scale(1.02);
  }

  /* Badge de status pulsante para processos urgentes */
  .pulse-badge {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.7;
    }
  }

  /* Scrollbar customizada */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Tooltip customizado */
  .custom-tooltip {
    position: relative;
  }

  .custom-tooltip:hover::after {
    content: attr(data-tooltip);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.5rem 1rem;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    font-size: 0.75rem;
    border-radius: 0.5rem;
    white-space: nowrap;
    z-index: 1000;
    margin-bottom: 0.5rem;
  }

  /* Loading spinner */
  .spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
     /* Tooltip para templates longos */
  .template-card-title {
    position: relative;
  }

  .template-card-title:hover::after {
    content: attr(data-full-name);
    position: absolute;
    bottom: 100%;
    left: 0;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    white-space: normal;
    max-width: 300px;
    word-wrap: break-word;
    z-index: 1000;
    margin-bottom: 0.5rem;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

`;

  const ModalLogin = ({ onClose, onLogin }) => {
    const [nome, setNome] = useState("");
    const [senha, setSenha] = useState("");
    const [erro, setErro] = useState("");
    const [carregando, setCarregando] = useState(false);

    const handleLogin = async (e) => {
      e.preventDefault();
      setErro("");
      setCarregando(true);

      try {
        const resultado = await api.login(nome, senha);

        console.log('🎯 Resultado do login:', resultado);

        if (resultado.sucesso) {
          setUsuarioLogado(resultado.usuario);
          setShowLogin(false);
          adicionarNotificacao(`Bem-vindo, ${resultado.usuario.nome}!`, "sucesso");
          setToken(resultado.token);

          conectarWebSocket();
          carregarDadosIniciais();
        } else {
          setErro(resultado.mensagem || "Erro ao fazer login");
        }
      } catch (error) {
        console.error("❌ Erro inesperado no handleLogin:", error);
        setErro("Erro inesperado: " + error.message);
      } finally {
        setCarregando(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 rounded-t-2xl">
            <h3 className="text-2xl font-bold text-white text-center">
              Sistema de Abertura
            </h3>
            <p className="text-white opacity-90 text-sm text-center mt-1">
              Faça login para continuar
            </p>
          </div>

          <form onSubmit={handleLogin} className="p-6 space-y-4">
            {erro && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl">
                {erro}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Usuário
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                placeholder="Digite seu usuário"
                required
                disabled={carregando}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Senha
              </label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                placeholder="Digite sua senha"
                required
                disabled={carregando}
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {carregando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setToken(token);
      verificarTokenValido();
    } else {
      setShowLogin(true);
    }
  }, []);

  const verificarTokenValido = async () => {
    try {
      const response = await fetchAutenticado(`${API_URL}/usuarios/me`);
      const data = await response.json();

      if (data.sucesso) {
        await carregarDepartamentos();

        setUsuarioLogado(data.usuario);
        setShowLogin(false);
        conectarWebSocket();
        carregarDadosIniciais();
      } else {
        localStorage.removeItem('token');
        setToken(null);
        setShowLogin(true);
      }
    } catch (error) {
      console.error('Erro ao verificar token:', error);
      localStorage.removeItem('token');
      setToken(null);
      setShowLogin(true);
    }
  };

  const getNomeDepartamento = (departamentoId) => {
    console.log('🔍 Buscando departamento:', {
      departamentoId,
      tipo: typeof departamentoId,
      departamentosDisponiveis: departamentosCriados.map(d => ({ id: d.id, nome: d.nome }))
    });

    if (!departamentoId) {
      console.warn('⚠️ departamentoId é null/undefined');
      return "Sem Departamento";
    }

    const idNumerico = Number(departamentoId);
    const departamento = departamentosCriados.find(d => d.id === idNumerico);

    if (!departamento) {
      console.error('❌ Departamento não encontrado para ID:', departamentoId);
      console.log('📋 Departamentos disponíveis:', departamentosCriados.map(d => ({ id: d.id, nome: d.nome })));
      return "Departamento Não Encontrado";
    }

    console.log('✅ Departamento encontrado:', departamento.nome);
    return departamento.nome;
  };

  { usuarioLogado?.role === "gerente" && `Gerente - ${getNomeDepartamento(usuarioLogado.departamento_id)}` }


  const ModalGerenciarUsuarios = ({ onClose }) => {
    const [novoUsuario, setNovoUsuario] = useState({
      nome: "",
      senha: "",
      role: "comum",
      departamento_id: null,
      permissoes: []
    });

    const [showConfirmacaoExclusaoUsuario, setShowConfirmacaoExclusaoUsuario] = useState(null);
    const [usuarioParaAlterarStatus, setUsuarioParaAlterarStatus] = useState(null);
    const [editandoUsuario, setEditandoUsuario] = useState(null);
    const [usuariosCarregados, setUsuariosCarregados] = useState([]);

    const permissoesDisponiveis = [
      { id: "criar_processo", label: "Criar Processos" },
      { id: "editar_processo", label: "Editar Processos" },
      { id: "excluir_processo", label: "Excluir Processos" },
      { id: "criar_tag", label: "Criar Tags" },
      { id: "editar_tag", label: "Editar Tags" },
      { id: "excluir_tag", label: "Excluir Tags" },
      { id: "criar_departamento", label: "Criar Departamentos" },
      { id: "editar_departamento", label: "Editar Departamentos" },
      { id: "excluir_departamento", label: "Excluir Departamentos" },
      { id: "gerenciar_usuarios", label: "Gerenciar Usuários" }
    ];

    useEffect(() => {
      carregarUsuarios();
    }, []);
    useEffect(() => {
      const garantirDepartamentosCarregados = async () => {
        if (departamentosCriados.length === 0) {
          console.log('🔄 Carregando departamentos...');
          await carregarDepartamentos();
        }
      };

      garantirDepartamentosCarregados();
    }, []);
    const carregarUsuarios = async () => {
      try {
        if (departamentosCriados.length === 0) {
          await carregarDepartamentos();
        }

        const usuariosData = await api.getUsuarios();
        if (usuariosData && usuariosData.sucesso) {
          setUsuariosCarregados(usuariosData.usuarios || []);
        }
      } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        adicionarNotificacao('Erro ao carregar usuários: ' + error.message, 'erro');
      }
    };

    const handleCriarUsuario = async () => {
      if (!novoUsuario.nome || !novoUsuario.senha) {
        mostrarAlerta("Campos Obrigatórios", "Preencha nome e senha", "aviso");
        return;
      }

      console.log('🔍 DEBUG Criar Usuário:', {
        nome: novoUsuario.nome,
        role: novoUsuario.role,
        departamento_id: novoUsuario.departamento_id,
        departamentosDisponiveis: departamentosCriados.map(d => ({ id: d.id, nome: d.nome }))
      });
      console.log('🔍 DEBUG FINAL antes de criar:', {
        nome: novoUsuario.nome,
        role: novoUsuario.role,
        departamento_id: novoUsuario.departamento_id,
        departamentoSelecionado: departamentosCriados.find(d => d.id === novoUsuario.departamento_id)
      });

      if (novoUsuario.role === "gerente") {
        if (!novoUsuario.departamento_id) {
          await mostrarAlerta(
            "Departamento Obrigatório",
            "Usuários gerentes devem ter um departamento associado",
            "aviso"
          );
          return;
        }

        const departamentoSelecionado = departamentosCriados.find(
          d => d.id === novoUsuario.departamento_id
        );

        console.log('🔍 Departamento selecionado:', departamentoSelecionado);

        if (!departamentoSelecionado) {
          await mostrarAlerta(
            "Departamento Inválido",
            "O departamento selecionado não foi encontrado. ID: " + novoUsuario.departamento_id,
            "erro"
          );
          return;
        }
      }

      try {
        const usuarioData = {
          nome: novoUsuario.nome,
          senha: novoUsuario.senha,
          role: novoUsuario.role,
          departamento_id: novoUsuario.role === "gerente" ? novoUsuario.departamento_id : null,
          permissoes: novoUsuario.role === "admin"
            ? permissoesDisponiveis.map(p => p.id)
            : novoUsuario.permissoes,
          ativo: true
        };

        console.log('📤 Criando usuário com dados:', usuarioData);

        const resultado = await api.criarUsuario(usuarioData);

        if (resultado.sucesso) {
          await carregarUsuarios();
          setNovoUsuario({
            nome: "",
            senha: "",
            role: "comum",
            departamento_id: null,
            permissoes: []
          });
          adicionarNotificacao(`Usuário ${usuarioData.nome} criado com sucesso`, "sucesso");
        } else {
          adicionarNotificacao(`Erro ao criar usuário: ${resultado.mensagem}`, "erro");
        }
      } catch (error) {
        console.error('Erro ao criar usuário:', error);
        adicionarNotificacao(`Erro ao criar usuário: ${error.message}`, "erro");
      }
    };

    const handleEditarUsuario = async () => {
      if (!editandoUsuario.nome) {
        mostrarAlerta("Campo Obrigatório", "Preencha o nome do usuário", "aviso");
        return;
      }

      if (editandoUsuario.role === "gerente" && !editandoUsuario.departamento_id) {
        await mostrarAlerta(
          "Departamento Obrigatório",
          "Usuários gerentes devem ter um departamento associado",
          "aviso"
        );
        return;
      }

      try {
        const usuarioData = {
          nome: editandoUsuario.nome,
          role: editandoUsuario.role,
          departamento_id: editandoUsuario.departamento_id || null,
          permissoes: editandoUsuario.role === "admin"
            ? permissoesDisponiveis.map(p => p.id)
            : editandoUsuario.permissoes,
          ativo: editandoUsuario.ativo
        };

        if (editandoUsuario.senha) {
          usuarioData.senha = editandoUsuario.senha;
        }

        const resultado = await api.atualizarUsuario(editandoUsuario.id, usuarioData);

        if (resultado.sucesso) {
          await carregarUsuarios();
          setEditandoUsuario(null);
          adicionarNotificacao(`Usuário ${usuarioData.nome} atualizado com sucesso`, "sucesso");
        } else {
          adicionarNotificacao(`Erro ao atualizar usuário: ${resultado.mensagem}`, "erro");
        }
      } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        adicionarNotificacao(`Erro ao atualizar usuário: ${error.message}`, "erro");
      }
    };

    const handleExcluirUsuario = async (usuario) => {
      if (usuario.id === usuarioLogado.id) {
        mostrarAlerta("Não Permitido", "Você não pode excluir seu próprio usuário", "erro");
        return;
      }

      setShowConfirmacaoExclusaoUsuario(usuario);
    };

    const confirmarExclusaoUsuario = async () => {
      const usuario = showConfirmacaoExclusaoUsuario;

      try {
        const resultado = await api.excluirUsuario(usuario.id);

        if (resultado.sucesso) {
          setUsuariosCarregados(prev => prev.filter(u => u.id !== usuario.id));
          adicionarNotificacao(`Usuário ${usuario.nome} excluído com sucesso`, "sucesso");
        } else {
          adicionarNotificacao(`Erro ao excluir usuário: ${resultado.mensagem}`, "erro");
        }
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        adicionarNotificacao(`Erro ao excluir usuário: ${error.message}`, "erro");
      } finally {
        setShowConfirmacaoExclusaoUsuario(null);
      }
    };

    const toggleStatusUsuario = async (usuario) => {
      setUsuarioParaAlterarStatus(usuario);
    };

    const confirmarAlteracaoStatus = async () => {
      const usuario = usuarioParaAlterarStatus;
      const novoStatus = !usuario.ativo;

      try {
        const resultado = await api.atualizarUsuario(usuario.id, {
          ...usuario,
          ativo: novoStatus
        });

        if (resultado.sucesso) {
          await carregarUsuarios();
          adicionarNotificacao(
            `Usuário ${usuario.nome} ${novoStatus ? 'ativado' : 'desativado'} com sucesso`,
            "sucesso"
          );
        }
      } catch (error) {
        console.error('Erro ao alterar status:', error);
        adicionarNotificacao(`Erro ao alterar status: ${error.message}`, "erro");
      } finally {
        setUsuarioParaAlterarStatus(null);
      }
    };

    const togglePermissao = (permissaoId) => {
      if (editandoUsuario) {
        setEditandoUsuario(prev => ({
          ...prev,
          permissoes: prev.permissoes.includes(permissaoId)
            ? prev.permissoes.filter(p => p !== permissaoId)
            : [...prev.permissoes, permissaoId]
        }));
      } else {
        setNovoUsuario(prev => ({
          ...prev,
          permissoes: prev.permissoes.includes(permissaoId)
            ? prev.permissoes.filter(p => p !== permissaoId)
            : [...prev.permissoes, permissaoId]
        }));
      }
    };

    const iniciarEdicao = (usuario) => {
      setEditandoUsuario({
        ...usuario,
        senha: ""
      });
    };

    const cancelarEdicao = () => {
      setEditandoUsuario(null);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Gerenciar Usuários</h3>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
              <h4 className="font-semibold text-gray-800 mb-4">
                {editandoUsuario ? `Editando Usuário: ${editandoUsuario.nome}` : "Criar Novo Usuário"}
              </h4>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome do usuário *
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do usuário"
                      value={editandoUsuario ? editandoUsuario.nome : novoUsuario.nome}
                      onChange={(e) => editandoUsuario
                        ? setEditandoUsuario({ ...editandoUsuario, nome: e.target.value })
                        : setNovoUsuario({ ...novoUsuario, nome: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {editandoUsuario ? "Nova Senha (deixe em branco para manter)" : "Senha *"}
                    </label>
                    <input
                      type="password"
                      placeholder={editandoUsuario ? "Nova senha (opcional)" : "Senha"}
                      value={editandoUsuario ? editandoUsuario.senha : novoUsuario.senha}
                      onChange={(e) => editandoUsuario
                        ? setEditandoUsuario({ ...editandoUsuario, senha: e.target.value })
                        : setNovoUsuario({ ...novoUsuario, senha: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipo de Usuário
                    </label>
                    <select

                      value={editandoUsuario ? editandoUsuario.role : novoUsuario.role}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        if (editandoUsuario) {
                          setEditandoUsuario({
                            ...editandoUsuario,
                            role: newRole,
                            departamento_id: newRole === 'gerente' ? editandoUsuario.departamento_id : null
                          });
                        } else {
                          setNovoUsuario({
                            ...novoUsuario,
                            role: newRole,
                            departamento_id: newRole === 'gerente' ? novoUsuario.departamento_id : null
                          });
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="comum">Usuário Comum</option>
                      <option value="gerente">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </div>
                  {(editandoUsuario ? editandoUsuario.role === "gerente" : novoUsuario.role === "gerente") && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Departamento Gerenciado *
                      </label>
                      <select
                        value={editandoUsuario ? editandoUsuario.departamento_id || "" : novoUsuario.departamento_id || ""}
                        onChange={(e) => {
                          const deptId = e.target.value ? parseInt(e.target.value) : null;
                          console.log('🔍 Departamento selecionado no select:', deptId); // Debug

                          if (editandoUsuario) {
                            setEditandoUsuario({ ...editandoUsuario, departamento_id: deptId });
                          } else {
                            setNovoUsuario({ ...novoUsuario, departamento_id: deptId });
                          }
                        }}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        required
                      >
                        <option value="">Selecione um departamento</option>
                        {departamentosCriados.map(dept => (
                          <option key={dept.id} value={dept.id}>
                            {dept.nome} (ID: {dept.id})
                          </option>
                        ))}
                      </select>

                      <div className="text-xs text-gray-500 mt-1">
                        Departamento selecionado: {editandoUsuario ? editandoUsuario.departamento_id : novoUsuario.departamento_id}
                      </div>
                    </div>
                  )}
                  {editandoUsuario && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="usuario-ativo"
                          checked={editandoUsuario.ativo}
                          onChange={(e) => setEditandoUsuario({
                            ...editandoUsuario,
                            ativo: e.target.checked
                          })}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <label htmlFor="usuario-ativo" className="text-sm font-medium text-gray-700">
                          Usuário ativo
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {(editandoUsuario ? editandoUsuario.role === "normal" : novoUsuario.role === "normal") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Permissões
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {permissoesDisponiveis.map(perm => (
                        <label key={perm.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              editandoUsuario
                                ? editandoUsuario.permissoes.includes(perm.id)
                                : novoUsuario.permissoes.includes(perm.id)
                            }
                            onChange={() => togglePermissao(perm.id)}
                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <span className="text-sm">{perm.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {editandoUsuario ? (
                    <>
                      <button
                        onClick={cancelarEdicao}
                        className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleEditarUsuario}
                        className="flex-1 bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
                      >
                        Salvar Alterações
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleCriarUsuario}
                      className="w-full bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-medium"
                    >
                      Criar Usuário
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-gray-800">
                  Usuários Cadastrados ({usuariosCarregados.length})
                </h4>

              </div>

              <div className="space-y-3">
                {usuariosCarregados.map(user => (
                  <div key={user.id} className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {user.nome.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {user.nome}
                            {user.id === usuarioLogado.id && (
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs">
                                Você
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-gray-600">
                            {user.role === "admin" && "Administrador"}
                            {user.role === "gerente" && `Gerente - ${departamentosCriados.find(d => d.id === user.departamento_id)?.nome ||
                              "Sem Departamento"
                              }`}
                            {user.role === "comum" && "Usuário Comum"}
                            {user.role === "normal" && user.permissoes && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({user.permissoes.length} permissões)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${user.ativo
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                          }`}>
                          {user.ativo ? "Ativo" : "Inativo"}
                        </span>

                        <div className="flex gap-1">



                          <button
                            onClick={() => iniciarEdicao(user)}
                            className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg"
                            title="Editar usuário"
                          >
                            <Edit size={16} />
                          </button>

                          {user.id !== usuarioLogado.id && (
                            <button
                              onClick={() => handleExcluirUsuario(user)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg"
                              title="Excluir usuário"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {user.role === "normal" && user.permissoes && user.permissoes.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="text-xs text-gray-500 mb-2">Permissões:</div>
                        <div className="flex flex-wrap gap-1">
                          {user.permissoes.map(permissaoId => {
                            const permissao = permissoesDisponiveis.find(p => p.id === permissaoId);
                            return permissao ? (
                              <span
                                key={permissaoId}
                                className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs"
                              >
                                {permissao.label}
                              </span>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {showConfirmacaoExclusaoUsuario && (
            <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100]">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
                <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 rounded-t-2xl">
                  <div className="flex items-center gap-3">
                    <div className="bg-white bg-opacity-20 p-2 rounded-full">
                      <AlertCircle size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">Excluir Usuário</h3>
                  </div>
                </div>

                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X size={32} className="text-red-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      Confirmar Exclusão
                    </h4>
                    <p className="text-gray-600">
                      Tem certeza que deseja excluir o usuário{" "}
                      <span className="font-semibold text-red-600">
                        "{showConfirmacaoExclusaoUsuario.nome}"
                      </span>
                      ? Esta ação não pode ser desfeita.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowConfirmacaoExclusaoUsuario(null)}
                      className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarExclusaoUsuario}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      Sim, Excluir
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}


          {usuarioParaAlterarStatus && (
            <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-[100]">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
                <div className={`bg-gradient-to-r ${usuarioParaAlterarStatus.ativo ? 'from-amber-500 to-amber-600' : 'from-green-500 to-green-600'} p-6 rounded-t-2xl`}>
                  <div className="flex items-center gap-3">
                    <div className="bg-white bg-opacity-20 p-2 rounded-full">
                      <AlertCircle size={24} className="text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-white">

                    </h3>
                  </div>
                </div>

                <div className="p-6">
                  <div className="text-center mb-6">
                    <div className={`w-16 h-16 ${usuarioParaAlterarStatus.ativo ? 'bg-amber-100' : 'bg-green-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
                      {usuarioParaAlterarStatus.ativo ? <Pause size={32} className="text-amber-600" /> : <Play size={32} className="text-green-600" />}
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">
                      Confirmar {usuarioParaAlterarStatus.ativo ? 'Desativação' : 'Ativação'}
                    </h4>
                    <p className="text-gray-600">

                      <span className="font-semibold">
                        "{usuarioParaAlterarStatus.nome}"
                      </span>
                      ?
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setUsuarioParaAlterarStatus(null)}
                      className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarAlteracaoStatus}
                      className={`flex-1 px-6 py-3 bg-gradient-to-r ${usuarioParaAlterarStatus.ativo ? 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700' : 'from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'} text-white rounded-xl font-medium transition-all duration-200 shadow-lg hover:shadow-xl`}
                    >

                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };


  const debugProcesso = (processoId) => {
    const processo = processos.find(p => p.id === processoId);
    if (!processo) {
      console.error('❌ Processo não encontrado:', processoId);
      return;
    }

    console.group('🔍 DEBUG PROCESSO:', processo.nomeEmpresa);
    console.log('📋 ID:', processoId);
    console.log('🏢 Departamento Atual:', processo.departamentoAtual);
    console.log('📊 Status:', processo.status);
    console.log('📈 Progresso:', processo.progresso + '%');
    console.log('🏷️ Tags:', processo.tags);
    console.log('💬 Comentários:', comentarios[processoId]?.length || 0);
    console.log('📎 Documentos:', documentos[processoId]?.length || 0);
    console.log('📜 Histórico:', processo.historico.length, 'eventos');
    console.log('📝 Dados completos:', processo);
    console.groupEnd();
  };

  const exportarDados = () => {
    const dados = {
      versao: "1.0.0",
      dataExportacao: new Date().toISOString(),
      departamentos: departamentosCriados,
      processos: processos,
      tags: tags,
      usuarios: usuarios.map(u => ({
        ...u,
        senha: undefined
      }))
    };

    const blob = new Blob([JSON.stringify(dados, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-sistema-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    adicionarNotificacao("Dados exportados com sucesso!", "sucesso");
  };

  {
    usuarioLogado?.role === "admin" && (
      <button
        onClick={exportarDados}
        className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
      >
        <Download size={20} />
        Exportar Dados
      </button>
    )
  }
  const debugDepartamento = (departamentoId) => {
    const dept = departamentosCriados.find(d => d.id === departamentoId);
    if (!dept) {
      console.error('❌ Departamento não encontrado:', departamentoId);
      return;
    }

    const processosNoDept = processos.filter(
      p => p.departamentoAtual === departamentoId && p.status === "Em Andamento"
    );

    console.group('🏢 DEBUG DEPARTAMENTO:', dept.nome);
    console.log('📋 ID:', departamentoId);
    console.log('👤 Responsável:', dept.responsavel);
    console.log('📊 Processos:', processosNoDept.length);

    console.log('🎨 Cor:', dept.cor);
    console.log('📝 Dados completos:', dept);
    console.log('📋 Processos no departamento:', processosNoDept);
    console.groupEnd();
  };
  const ModalSelecionarDepartamentoDestino = ({ processo, onClose, onConfirm }) => {
    const [departamentoSelecionado, setDepartamentoSelecionado] = useState(null);

    const handleConfirmar = async () => {
      if (!departamentoSelecionado) {
        await mostrarAlerta("Selecione um Departamento", "Escolha para qual departamento deseja transferir", "aviso");
        return;
      }

      const dept = departamentosCriados.find(d => d.id === departamentoSelecionado);

      const confirmou = await mostrarConfirmacao({
        tipo: "info",
        nome: processo.nomeEmpresa,
        titulo: "Confirmar Transferência",
        mensagem: `Tem certeza que deseja transferir "${processo.nomeEmpresa}" para "${dept.nome}"?`,
        textoConfirmar: "Sim, Transferir"
      });

      if (confirmou) {
        await avancarProcesso(processo.id, departamentoSelecionado);
        onClose();
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-t-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Transferir Processo</h3>
              <button onClick={onClose} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-2">
                Processo: {processo.nomeEmpresa}
              </h4>
              <p className="text-sm text-gray-600">Selecione o departamento de destino:</p>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {departamentosCriados
                .filter(dept => dept.id !== processo.departamentoAtual)
                .map((dept) => {
                  const IconeDept = dept.icone;
                  return (
                    <label
                      key={dept.id}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${departamentoSelecionado === dept.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                        }`}
                    >
                      <input
                        type="radio"
                        name="departamento"
                        value={dept.id}
                        checked={departamentoSelecionado === dept.id}
                        onChange={() => setDepartamentoSelecionado(dept.id)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${dept.cor} flex items-center justify-center flex-shrink-0`}>
                        {IconeDept && <IconeDept size={20} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{dept.nome}</div>
                        <div className="text-sm text-gray-600">{dept.responsavel}</div>
                      </div>
                    </label>
                  );
                })}
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Confirmar Transferência
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  <style jsx>{`
  .modal-alerta-frente {
    z-index: 99999 !important;
  }
  
  .modal-cadastro-empresa {
    z-index: 9999;
  }
`}</style>


  // ========== RENDER PRINCIPAL ==========
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-100">
      <style jsx>{styles}</style>
      <div className="bg-white shadow-lg border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-xl shadow-lg overflow-hidden bg-white flex items-center justify-center">
                <img
                  src="/triar.png"
                  alt="Logo Triar"
                  className="w-12 h-12 object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Sistema de Abertura
                </h1>
                <p className="text-gray-600 text-sm">

                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-3 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors relative"
                >
                  <Bell size={20} className="text-gray-600" />
                  {notificacoes.filter((n) => !n.lida).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                      {notificacoes.filter((n) => !n.lida).length}
                    </span>
                  )}
                </button>





                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                      <h3 className="font-semibold text-gray-900">
                        Notificações
                        {notificacoes.length > 0 && (
                          <span className="ml-2 bg-cyan-500 text-white text-xs rounded-full px-2 py-1">
                            {notificacoes.length}
                          </span>
                        )}
                      </h3>
                      <div className="flex gap-2">
                        {notificacoes.some(n => !n.lida) && (
                          <button
                            onClick={marcarTodasComoLidas}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                        {notificacoes.length > 0 && (
                          <button
                            onClick={limparTodasNotificacoes}
                            className="text-xs text-gray-500 hover:text-gray-700"
                          >
                            Limpar todas
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notificacoes.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">
                          <Bell size={32} className="mx-auto mb-2 opacity-30" />
                          <p>Nenhuma notificação</p>
                        </div>
                      ) : (
                        notificacoes.map((notif) => (
                          <div
                            key={notif.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${notif.lida ? 'bg-white' : 'bg-blue-50'
                              }`}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {notif.tipo === 'sucesso' && (
                                    <CheckCircle size={16} className="text-green-500" />
                                  )}
                                  {notif.tipo === 'erro' && (
                                    <AlertCircle size={16} className="text-red-500" />
                                  )}
                                  {notif.tipo === 'info' && (
                                    <Info size={16} className="text-blue-500" />
                                  )}
                                  {!notif.lida && (
                                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                  )}
                                </div>
                                <p className="text-sm text-gray-800">{notif.mensagem}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {notif.timestamp}
                                </p>
                              </div>
                              <div className="flex gap-1 ml-2">
                                {!notif.lida && (
                                  <button
                                    onClick={() => marcarComoLida(notif.id)}
                                    className="text-xs text-blue-600 hover:text-blue-800 p-1"
                                    title="Marcar como lida"
                                  >
                                    <Check size={12} />
                                  </button>
                                )}
                                <button
                                  onClick={() => removerNotificacao(notif.id)}
                                  className="text-xs text-gray-400 hover:text-red-500 p-1"
                                  title="Fechar notificação"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Análises */}
              <button
                onClick={() => setShowAnalytics(true)}
                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 
             text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all 
             duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
             min-w-[180px] justify-center"
              >
                <TrendingUp size={20} />
                <span>Análises</span>
              </button>

              {temPermissao("criar_processo") && (
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowSelecionarTemplate(true)}
                    className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 
                 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all 
                 duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                 min-w-[180px] justify-center"
                    title="Nova Solicitação usando Templates"
                  >
                    <FileText size={20} />
                    <span className="truncate">Nova Solicitação</span>
                  </button>

                  {(usuarioLogado?.role === "admin" || usuarioLogado?.role === "gerente") && (
                    <button
                      onClick={() => setShowNovaEmpresa(true)}
                      className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 
                   text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all 
                   duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
                   min-w-[180px] justify-center"
                      title="Criar Solicitação Personalizada"
                    >
                      <Plus size={20} />
                      <span>Personalizada</span>
                    </button>
                  )}
                </div>
              )}

              {temPermissao("gerenciar_usuarios") && (
                <button
                  onClick={() => setShowGerenciarUsuarios(true)}
                  className="bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 
               text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 transition-all 
               duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 
               min-w-[180px] justify-center"
                >
                  <Users size={20} />
                  <span>Usuários</span>
                </button>
              )}


              {usuarioLogado && (
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl">
                  <User size={16} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">{usuarioLogado.nome}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${usuarioLogado.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                      usuarioLogado.role === 'gerente' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700'
                    }`}>
                    {usuarioLogado.role === 'admin' ? 'Admin' :
                      usuarioLogado.role === 'gerente' ? (
                        <>
                          Gerente - {getNomeDepartamento(usuarioLogado.departamento_id)}
                        </>
                      ) :
                        'Usuário'}
                  </span>
                  <button
                    onClick={() => {
                      localStorage.removeItem('token');
                      setUsuarioLogado(null);
                      setToken(null);
                      setShowLogin(true);
                    }}
                    className="ml-2 text-red-600 hover:text-red-700"
                    title="Sair"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>


      {showConfirmacaoExclusao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 scale-100 hover:scale-105">
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-white bg-opacity-20 p-2 rounded-full">
                  <AlertCircle size={24} className="text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Confirmar Exclusão</h3>
              </div>
            </div>

            <div className="p-6">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X size={32} className="text-red-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  Excluir Departamento
                </h4>
                <p className="text-gray-600">
                  Tem certeza que deseja excluir o departamento{" "}
                  <span className="font-semibold text-red-600">
                    "{showConfirmacaoExclusao.nome}"
                  </span>
                  ? Esta ação não pode ser desfeita.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmacaoExclusao(null)}
                  className="flex-1 px-6 py-3 text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-100 transition-all duration-200 font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    excluirDepartamentoDireto(dept.id);
                    setShowModal(null);
                  }}
                  className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100 transition-colors"
                >
                  <X size={14} className="text-red-600" />
                  <span className="font-medium">Excluir</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Total de Processos
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {processos.length}
                </p>
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp size={12} />
                  +12% este mês
                </p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl">
                <Building className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Em Andamento
                </p>
                <p className="text-3xl font-bold text-amber-600 mt-1">
                  {processos.filter((p) => p.status === "Em Andamento").length}
                </p>
                <p className="text-xs text-amber-600 mt-2">
                  Aguardando processamento
                </p>
              </div>
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-4 rounded-xl">
                <Clock className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Finalizados</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {processos.filter((p) => p.status === "Finalizado").length}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Empresas registradas
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 p-4 rounded-xl">
                <CheckCircle className="text-white" size={24} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Taxa de Sucesso
                </p>
                <p className="text-3xl font-bold text-cyan-600 mt-1">
                  {processos.length > 0
                    ? Math.round(
                      (processos.filter((p) => p.status === "Finalizado")
                        .length /
                        processos.length) *
                      100
                    )
                    : 0}
                  %
                </p>
                <p className="text-xs text-cyan-600 mt-2 flex items-center gap-1">
                  <Star size={12} />
                  Excelente desempenho
                </p>
              </div>
              <div className="bg-gradient-to-br from-cyan-500 to-blue-600 p-4 rounded-xl">
                <AlertCircle className="text-white" size={24} />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Fluxo dos Departamentos
              </h2>
              <p className="text-gray-600">
                {departamentosCriados.length === 0
                  ? "Crie seus departamentos para começar"
                  : "Arraste os processos entre os departamentos ou use os controles"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {usuarioLogado?.role === "admin" && (
                <button
                  onClick={() => setShowCadastrarEmpresa(true)}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 
                 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all 
                 duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
                 min-w-[160px] justify-center"
                >
                  <Plus size={18} />
                  <span>Cadastrar Empresa</span>
                </button>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setFiltroDepartamento(null);
                    setShowListarEmpresas('cadastradas');
                  }}
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 
             text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-12 transition-all 
             duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
             min-w-[180px] justify-center"
                >
                  <Building size={18} />

                  <span className="flex flex-col text-center leading-tight">
                    Empresas
                    <span>({empresas.filter(e => e.cadastrada === true || e.cadastrada === 1).length})</span>
                  </span>
                </button>



                <button
                  onClick={() => {
                    setFiltroDepartamento(null);
                    setShowListarEmpresas('nao-cadastradas');
                  }}
                  className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 
             text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all 
             duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 
             min-w-[180px] justify-center"
                >
                  <AlertCircle size={18} />
                  <span>Empresas Novas ({empresas.filter(e => e.cadastrada === false || e.cadastrada === 0 || !e.cadastrada).length})</span>
                </button>
              </div>

              {temPermissao("criar_departamento") && (
                <button
                  onClick={() => setShowCriarDepartamento(true)}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 
                 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 shadow-md hover:shadow-lg transition-all justify-center"
                >
                  <Plus size={18} />
                  Criar Departamento
                </button>
              )}
            </div>

          </div>


          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {departamentosCriados.length === 0 ? (
              <div className="col-span-4 text-center py-12">
                <Building size={64} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">
                  Nenhum departamento criado
                </h3>
                <p className="text-gray-600 mb-6">
                  Crie seu primeiro departamento para começar a gerenciar
                  processos
                </p>
                <button
                  onClick={() => setShowCriarDepartamento(true)}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-4 rounded-xl font-medium inline-flex items-center gap-2"
                >
                  <Plus size={20} />
                  Criar Primeiro Departamento
                </button>
              </div>
            ) : (
              departamentosCriados.map((dept, index) => {
                const processosNoDept = processos.filter(
                  (p) =>
                    p.departamentoAtual === dept.id &&
                    p.status === "Em Andamento"
                );
                const IconeDept = dept.icone;

                return (
                  <div key={dept.id} className="relative">
                    <div
                      className="bg-white rounded-2xl shadow-lg border-2 border-gray-100 hover:border-gray-200 transition-all duration-300 overflow-hidden min-h-[600px]"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, dept.id)}
                    >
                      <div
                        className={`bg-gradient-to-br ${dept.cor} p-4 text-white relative overflow-hidden`}
                      >
                        <div className="flex items-start justify-between gap-2">




                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {IconeDept && (
                                <IconeDept size={20} className="flex-shrink-0" />
                              )}
                              <h3
                                className="font-bold text-base break-words line-clamp-2 cursor-help flex-1"
                                title={dept.nome}
                              >
                                {dept.nome}
                              </h3>
                            </div>

                            <div className="flex items-center gap-1 text-xs opacity-90">
                              <User size={12} />
                              <span className="break-words line-clamp-1" title={dept.responsavel}>
                                {dept.responsavel}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1 flex-shrink-0">
                            {usuarioLogado?.role === "admin" && (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenuDepartamento(showMenuDepartamento === dept.id ? null : dept.id);
                                  }}
                                  className="p-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded transition-all"
                                  title="Opções"
                                >
                                  <MoreVertical size={14} />
                                </button>

                                {showMenuDepartamento === dept.id && (
                                  <div className="absolute top-full right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[140px] overflow-hidden">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditandoDepartamento(dept);
                                        setShowCriarDepartamento(true);
                                        setShowMenuDepartamento(null);
                                      }}
                                      className="w-full px-2 py-1 text-left text-xs text-gray-700 hover:bg-blue-50 flex items-center gap-1.5 transition-colors"
                                    >
                                      <Edit size={14} className="text-blue-500" />
                                      <span className="font-medium">Editar</span>
                                    </button>

                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        excluirDepartamentoDireto(dept.id);
                                        setShowMenuDepartamento(null);
                                      }}
                                      className="w-full px-2 py-1 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5 border-t border-gray-100 transition-colors"
                                    >
                                      <Trash2 size={14} className="text-red-600" />
                                      <span className="font-medium">Excluir</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowGaleria(dept);
                              }}
                              className="p-1.5 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded transition-all"
                              title="Galeria de Documentos"
                            >
                              <Eye size={14} />
                            </button>
                          </div>
                        </div>




                        <div className="mt-2">

                        </div>
                      </div>

                      <div className="bg-white rounded-xl p-4 min-h-[400px]">
                        <div className="space-y-3">
                          {processosNoDept.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                              {IconeDept && (
                                <IconeDept
                                  size={32}
                                  className="mx-auto mb-2 opacity-30"
                                />
                              )}
                              <p className="text-sm">Nenhum processo</p>
                            </div>
                          ) : (
                            processosNoDept.map((processo) => (
                              <div
                                key={processo.id}
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(e, processo)
                                }
                                className="bg-gray-50 rounded-xl p-4 cursor-move hover:bg-gray-100 transition-all duration-200 hover:shadow-md border border-gray-200"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1 min-w-0 mr-2">

                                    {processo.nomeServico && (
                                      <div
                                        className="text-medium font-semibold text-blue-600 mb-1 leading-tight truncate-1 cursor-help"
                                        title={processo.nomeServico}
                                      >
                                        {processo.nomeServico}
                                      </div>
                                    )}

                                    <div className="flex items-center gap-1 mb-0.5">
                                      <div
                                        className="font-base text-sm text-gray-700 truncate-1 flex-1 cursor-help"
                                        title={processo.nomeEmpresa}
                                      >
                                        {processo.nomeEmpresa || "Nova Empresa"}
                                      </div>



                                      {(processo.tags || []).length > 0 && (
                                        <div className="flex gap-1 flex-shrink-0">
                                          {(processo.tags || []).map((tagId) => {
                                            const tag = tags.find((t) => t.id === tagId);
                                            return tag ? (
                                              <div
                                                key={tagId}
                                                className={`w-2 h-2 rounded-full ${tag.cor} border border-white shadow-sm`}
                                                title={tag.nome}
                                              />
                                            ) : null;
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    <p
                                      className="text-xs text-gray-600 truncate-1 cursor-help"
                                      title={processo.cliente}
                                    >
                                      {processo.cliente || "Sem responsável"}
                                    </p>

                                  </div>


                                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSelecionarTags(processo);
                                      }}
                                      className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-xs hover:bg-indigo-200 transition-colors flex items-center gap-1 flex-shrink-0"
                                      title="Gerenciar Tags"
                                    >
                                      <Star size={10} />
                                      {(processo.tags || []).length > 0 && (
                                        <span className="bg-indigo-500 text-white rounded-full w-3 h-3 text-[10px] flex items-center justify-center flex-shrink-0">
                                          {(processo.tags || []).length}
                                        </span>
                                      )}
                                    </button>


                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowComentarios(processo.id);
                                      }}
                                      className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs hover:bg-purple-200 transition-colors flex items-center gap-1 flex-shrink-0"
                                      title="Comentários"
                                    >
                                      <MessageSquare size={10} />
                                      {(comentarios[processo.id] || []).length >
                                        0 && (
                                          <span className="text-[10px]">
                                            (
                                            {
                                              (comentarios[processo.id] || [])
                                                .length
                                            }
                                            )
                                          </span>

                                        )}

                                    </button>

                                    {temPermissao("excluir_processo", {
                                      departamentoAtual: processo.departamentoAtual
                                    }) && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            e.preventDefault();
                                            excluirProcesso(processo.id);
                                          }}
                                          className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200 transition-colors flex items-center gap-1 flex-shrink-0"
                                          title="Excluir processo"
                                        >
                                          <X size={10} />
                                        </button>
                                      )}

                                  </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <div className="relative">
                                    <select
                                      value={processo.prioridade}
                                      onChange={(e) =>
                                        alterarPrioridade(
                                          processo.id,
                                          e.target.value
                                        )
                                      }
                                      className={`text-xs px-3 py-1 rounded-full border cursor-pointer appearance-none pr-8 ${getPriorityColor(
                                        processo.prioridade
                                      )}`}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option
                                        value="BAIXA"
                                        className="text-green-600 bg-white"
                                      >
                                        BAIXA
                                      </option>
                                      <option
                                        value="MEDIA"
                                        className="text-yellow-600 bg-white"
                                      >
                                        MEDIA
                                      </option>
                                      <option
                                        value="ALTA"
                                        className="text-red-600 bg-white"
                                      >
                                        ALTA
                                      </option>
                                    </select>
                                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                                      <ChevronDown size={12} />
                                    </div>
                                  </div>


                                  <span className="text-xs text-gray-500">
                                    {processo.tipoEmpresa}
                                  </span>
                                </div>

                                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                                  <div
                                    className={`bg-gradient-to-r ${dept.cor} h-1.5 rounded-full transition-all duration-300`}
                                    style={{
                                      width: `${processo.progresso}%`,
                                    }}
                                  ></div>
                                </div>

                                <p className="text-xs text-gray-500">
                                  Desde: {formatarData(processo.dataInicio)}
                                </p>

                                <div className="grid grid-cols-2 gap-1 mt-3">
                                  {processo.status === "Em Andamento" && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowQuestionario({
                                            processoId: processo.id,
                                            departamento: dept.id,
                                          });
                                        }}
                                        className="w-full bg-white border border-gray-300 text-gray-700 px-2 py-1 rounded text-xs hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
                                        title="Abrir Questionário"
                                      >
                                        <FileText size={10} />
                                        Form
                                      </button>

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowUploadDocumento(processo);
                                        }}
                                        className="w-full bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600 transition-colors flex items-center justify-center gap-1"
                                        title="Upload de Documentos"
                                      >
                                        <Upload size={10} />
                                        Docs
                                      </button>

                                      {temPermissao("mover_processo", {
                                        departamentoOrigemId: processo.departamentoAtual,
                                      }) && (
                                          <>
                                            {processo.fluxoDepartamentos &&
                                              processo.fluxoDepartamentos.length > 0 &&
                                              (processo.departamentoAtualIndex || 0) < processo.fluxoDepartamentos.length - 1 && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    avancarParaProximoDepartamento(processo.id);
                                                  }}
                                                  className="col-span-2 w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center gap-1"
                                                >
                                                  <ArrowRight size={10} />
                                                  Avançar ({(processo.departamentoAtualIndex || 0) + 1}/{processo.fluxoDepartamentos.length})
                                                </button>
                                              )}



                                            {processo.fluxoDepartamentos &&
                                              processo.fluxoDepartamentos.length > 0 &&
                                              (processo.departamentoAtualIndex || 0) === processo.fluxoDepartamentos.length - 1 && (
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    finalizarProcesso(processo.id);
                                                  }}
                                                  className="col-span-2 w-full bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center gap-1"
                                                >
                                                  <CheckCircle size={10} />
                                                  Finalizar
                                                </button>
                                              )}
                                          </>
                                        )}
                                    </>
                                  )}

                                  {processo.status === "Finalizado" && (
                                    <div className="col-span-2 bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-lg text-xs text-center flex items-center justify-center gap-2">
                                      <CheckCircle size={14} />
                                      <span className="font-medium">Processo Finalizado</span>
                                    </div>
                                  )}





                                  <div className="mt-3"></div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {index < departamentosCriados.length - 1 && (
                      <div className="hidden lg:flex absolute -right-4 top-1/2 transform -translate-y-1/2 z-10">
                        <div className="bg-white rounded-full p-2 shadow-lg border-2 border-gray-200">
                          <ArrowRight className="text-gray-400" size={16} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Buscar processos..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 w-64"
                />
              </div>

              <select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
              >
                <option value="todos">Todos os processos</option>
                <option value="andamento">Em andamento</option>
                <option value="finalizado">Finalizados</option>
                <option value="alta">Prioridade alta</option>
              </select>

              <div className="relative">
                <button
                  onClick={() => setShowModal(!showModal)}
                  className="px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50 flex items-center gap-2"
                >
                  <Filter size={16} />
                  Tags {filtroTags.length > 0 && `(${filtroTags.length})`}
                </button>

                {showModal && (
                  <div className="absolute top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-64">
                    <div className="space-y-2">
                      {tags.map((tag) => (
                        <label
                          key={tag.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={filtroTags.includes(tag.id)}
                            onChange={() => {
                              setFiltroTags((prev) =>
                                prev.includes(tag.id)
                                  ? prev.filter((t) => t !== tag.id)
                                  : [...prev, tag.id]
                              );
                            }}
                            className="w-4 h-4"
                          />
                          <span
                            className={`${tag.cor} text-white px-2 py-1 rounded text-xs`}
                          >
                            {tag.nome}
                          </span>
                        </label>
                      ))}
                    </div>
                    {filtroTags.length > 0 && (
                      <button
                        onClick={() => setFiltroTags([])}
                        className="w-full mt-3 text-xs text-red-600 hover:text-red-700"
                      >
                        Limpar filtros
                      </button>
                    )}
                  </div>
                )}
              </div>
              <select
                value={filtroDepartamento || ""}
                onChange={(e) => setFiltroDepartamento(e.target.value ? parseInt(e.target.value) : null)}
                className="px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200"
              >
                <option value="">Todos os departamentos</option>
                {departamentosCriados.map(dept => (
                  <option key={dept.id} value={dept.id}>
                    {dept.nome} ({processos.filter(p => p.departamentoAtual === dept.id && p.status === "Em Andamento").length})
                  </option>
                ))}
              </select>

              {filtro === "finalizado" && (
                <button
                  onClick={() => {
                    const processoFinalizado = processosFiltrados[0];
                    if (processoFinalizado) {
                      setShowVisualizacao(processoFinalizado);
                    }
                  }}

                >


                </button>
              )}
            </div>

            <div className="text-sm text-gray-600">
              Mostrando {processosFiltrados.length} de {processos.length}{" "}
              processos
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              Processos Detalhados
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {processosFiltrados.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Building size={48} className="mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">
                  Nenhum processo encontrado
                </p>
                <p className="text-sm">
                  Tente ajustar os filtros ou criar uma nova solicitação
                </p>
              </div>
            ) : (
              processosFiltrados.map((processo) => {
                const deptAtual =
                  processo.status === "Finalizado"
                    ? null
                    : departamentosCriados.find(
                      (d) => d.id === processo.departamentoAtual
                    );

                return (





                  <div
                    key={processo.id}
                    className="p-6 hover:bg-gray-50 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-6 gap-4">




                      <div className="flex-1 min-w-0">

                        <div className="flex items-start gap-3 mb-3">

                          <div className="flex-1 min-w-0">
                            {processo.nomeServico && (
                              <div
                                className="text-sm font-semibold text-blue-600 mb-1 truncate cursor-help"
                                title={processo.nomeServico}
                              >
                                {processo.nomeServico}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 mb-1">

                              <h3
                                className="text-xl font-bold text-gray-900 truncate flex-shrink min-w-0 max-w-[85%]"
                                title={processo.nomeEmpresa || "Nova Empresa"}
                              >
                                {processo.nomeEmpresa || "Nova Empresa"}
                              </h3>

                              {(processo.tags || []).length > 0 && (
                                <div className="flex gap-1 flex-shrink-0 flex-wrap">
                                  {(processo.tags || []).map((tagId) => {
                                    const tag = tags.find((t) => t.id === tagId);
                                    return tag ? (
                                      <div
                                        key={tagId}
                                        className={`w-3 h-3 rounded-full ${tag.cor} border border-white shadow-sm flex-shrink-0`}
                                        title={tag.nome}
                                      />
                                    ) : null;
                                  })}
                                </div>
                              )}
                            </div>

                            <p
                              className="text-sm text-gray-600 truncate cursor-help"
                              title={processo.cliente}
                            >
                              {processo.cliente || "Não informado"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium border whitespace-nowrap ${getStatusColor(
                                processo.status
                              )}`}
                            >
                              {processo.status}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getPriorityColor(
                                processo.prioridade
                              )}`}
                            >
                              {processo.prioridade}
                            </span>
                          </div>
                        </div>

                        <div className="process-details-grid mb-6">
                          <div className="process-detail-item">
                            <User
                              size={16}
                              className="text-gray-400 flex-shrink-0"
                            />
                            <div className="process-detail-text">
                              <div className="text-xs text-gray-500">
                                Cliente
                              </div>
                              <div
                                className="text-sm font-medium text-gray-900 truncate"
                                title={processo.cliente}
                              >
                                {processo.cliente || "Não informado"}
                              </div>
                            </div>
                          </div>



                          <div className="process-detail-item">
                            <Calendar
                              size={16}
                              className="text-gray-400 flex-shrink-0"
                            />
                            <div className="process-detail-text">
                              <div className="text-xs text-gray-500">
                                Início
                              </div>
                              <div className="text-sm font-medium text-gray-900">
                                {formatarData(processo.dataInicio)}
                              </div>
                            </div>
                          </div>

                          <div className="process-detail-item">
                            <Clock
                              size={16}
                              className="text-gray-400 flex-shrink-0"
                            />
                            <div className="process-detail-text">
                              <div className="text-xs text-gray-500">Prazo</div>
                              <div className="text-sm font-medium text-gray-900">
                                {formatarData(processo.prazoEstimado)}
                              </div>
                            </div>
                          </div>

                          {processo.dataFinalizacao && (
                            <div className="process-detail-item">
                              <CheckCircle
                                size={16}
                                className="text-green-500 flex-shrink-0"
                              />
                              <div className="process-detail-text">
                                <div className="text-xs text-gray-500">
                                  Finalizado
                                </div>
                                <div className="text-sm font-medium text-green-600">
                                  {formatarData(processo.dataFinalizacao)}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {(processo.email || processo.telefone) && (
                          <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                            {processo.email && <span>📧 {processo.email}</span>}
                            {processo.telefone && (
                              <span>📞 {processo.telefone}</span>
                            )}
                          </div>
                        )}


                        {processo.status === "Em Andamento" && deptAtual && (
                          <div className="bg-white border-l-4 border-blue-500 rounded-lg p-5 shadow-sm mb-6">
                            <div className="flex items-center gap-4">
                              {/* Ícone */}
                              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${deptAtual.cor} flex items-center justify-center flex-shrink-0`}>
                                {deptAtual.icone && <deptAtual.icone size={24} className="text-white" />}
                              </div>

                              <div className="flex-1">
                                <p className="text-xs text-blue-600 font-semibold uppercase mb-1">
                                  Departamento Atual
                                </p>
                                <h4 className="text-lg font-bold text-gray-900">
                                  {deptAtual.nome}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                  <User size={14} />
                                  <span>{deptAtual.responsavel}</span>
                                </div>
                              </div>

                              <div className="bg-blue-50 rounded-lg px-4 py-3 text-center">
                                <div className="text-2xl font-bold text-blue-600">
                                  {processo.progresso}%
                                </div>
                                <div className="text-xs text-gray-500">
                                  Completo
                                </div>
                              </div>
                            </div>

                            {deptAtual.descricao && (
                              <p className="text-sm text-gray-600 mt-3 pl-16">
                                {deptAtual.descricao}
                              </p>
                            )}
                          </div>
                        )}
                      </div>


                      <div className="flex gap-2 justify-between items-center">
                        <div className="flex gap-3">
                          {processo.status === "Finalizado" && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => setShowVisualizacao(processo)}
                                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <Eye size={16} />
                                Ver Completo
                              </button>

                              <button
                                onClick={() => setShowComentarios(processo.id)}
                                className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <MessageSquare size={16} />
                                Comentários ({(comentarios[processo.id] || []).length})
                              </button>


                              <button
                                onClick={() =>
                                  setShowQuestionario({
                                    processoId: processo.id,
                                    departamento: processo.departamentoAtual,
                                    somenteLeitura: true,
                                  })
                                }
                                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <FileText size={16} />
                                Ver Questionário
                              </button>

                              <button
                                onClick={() => {
                                  const docsProcesso = documentos[processo.id] || [];
                                  if (docsProcesso.length > 0) {
                                    setPreviewDocumento({
                                      galeria: true,
                                      docs: docsProcesso,
                                      titulo: `Documentos - ${processo.nomeEmpresa}`,
                                      processo: processo,
                                    });
                                  } else {
                                    mostrarAlerta(
                                      "Sem Documentos",
                                      "Este processo não possui documentos anexados",
                                      "info"
                                    );
                                  }
                                }}
                                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <FileText size={16} />
                                Documentos ({(documentos[processo.id] || []).length})
                              </button>
                            </div>
                          )}

                          {processo.status === "Em Andamento" && (
                            <>
                              <button
                                onClick={() => setShowComentarios(processo.id)}
                                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <MessageSquare size={16} />
                                Comentários ({(comentarios[processo.id] || []).length})
                              </button>

                              <button
                                onClick={() =>
                                  setShowQuestionario({
                                    processoId: processo.id,
                                    departamento: processo.departamentoAtual,
                                    readOnly: processo.status === "Finalizado"
                                  })

                                }
                                className="bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-600 hover:to-teal-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <Edit size={16} />
                                Questionário
                              </button>

                              {temPermissao("mover_processo", {
                                departamentoOrigemId: processo.departamentoAtual,
                              }) && (
                                  <>
                                    {processo.fluxoDepartamentos &&
                                      processo.fluxoDepartamentos.length > 0 &&
                                      (processo.departamentoAtualIndex || 0) <
                                      processo.fluxoDepartamentos.length - 1 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            avancarParaProximoDepartamento(processo.id);
                                          }}
                                          className="bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                                        >
                                          <ArrowRight size={16} />
                                          Avançar (
                                          {(processo.departamentoAtualIndex || 0) + 2}/
                                          {processo.fluxoDepartamentos.length})
                                        </button>
                                      )}

                                    {processo.fluxoDepartamentos &&
                                      processo.fluxoDepartamentos.length > 0 &&
                                      (processo.departamentoAtualIndex || 0) ===
                                      processo.fluxoDepartamentos.length - 1 && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            finalizarProcesso(processo.id);
                                          }}
                                          className="bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl"
                                        >
                                          <CheckCircle size={16} />
                                          Finalizar
                                        </button>
                                      )}
                                  </>
                                )}



                              {(usuarioLogado?.role === "admin" ||
                                usuarioLogado?.role === "gerente" ||
                                usuarioLogado?.role === "comum" ||
                                usuarioLogado?.role === "normal") && (
                                  <button
                                    onClick={() => setShowGerenciarTags(true)}
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 
               text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all 
               duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                  >
                                    <Star size={20} />
                                    Gerenciar Tags
                                  </button>
                                )}

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowSelecionarTags(processo);
                                }}
                                className="bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                              >
                                <Star size={16} />
                                Tags{" "}
                                {(processo.tags || []).length > 0 &&
                                  `(${(processo.tags || []).length})`}
                              </button>
                            </>
                          )}
                        </div>

                        {temPermissao("excluir_processo") && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              excluirProcesso(processo.id);
                            }}
                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-colors"
                            title="Excluir processo"
                          >
                            <X size={20} />
                          </button>
                        )}
                      </div>            </div>



                    {processo.historico.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                          <Clock size={16} />
                          Últimas Atividades
                        </h4>
                        <div className="space-y-2">
                          {processo.historico.slice(-3).map((item, index) => (
                            <div
                              key={index}
                              className="flex items-start gap-3 text-sm"
                            >
                              <div className="mt-1">
                                {item.tipo === "inicio" && (
                                  <Calendar
                                    className="text-blue-500"
                                    size={12}
                                  />
                                )}
                                {item.tipo === "conclusao" && (
                                  <CheckCircle
                                    className="text-green-500"
                                    size={12}
                                  />
                                )}
                                {item.tipo === "finalizacao" && (
                                  <Star className="text-yellow-500" size={12} />
                                )}
                                {item.tipo === "movimentacao" && (
                                  <ArrowRight
                                    className="text-purple-500"
                                    size={12}
                                  />
                                )}
                                {item.tipo === "alteracao" && (
                                  <Edit className="text-orange-500" size={12} />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-gray-900">{item.acao}</div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {item.responsavel} •{" "}
                                  {formatarDataHora(item.data)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {processo.observacoes && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <h5 className="font-medium text-gray-700 mb-2">
                              Observações:
                            </h5>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap">
                              {processo.observacoes}
                            </p>
                          </div>
                        )}
                        {(processo.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {processo.tags.map((tagId) => {
                              const tag = tags.find((t) => t.id === tagId);
                              return tag ? (
                                <span
                                  key={tagId}
                                  className={`${tag.cor} text-white px-2 py-0.5 rounded text-xs`}
                                >
                                  {tag.nome}
                                </span>
                              ) : null;
                            })}
                          </div>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const tagId = prompt(
                              "ID da tag (temp - use modal depois):"
                            );
                            if (tagId)
                              toggleTagProcesso(processo.id, parseInt(tagId));
                          }}
                          className="text-xs text-gray-600 hover:text-gray-800 mt-1"
                        >

                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Modais */}
      {showQuestionario && (
        <QuestionarioModal
          processoId={showQuestionario.processoId}
          departamentoId={showQuestionario.departamento}
          departamentosCriados={departamentosCriados}
          processos={processos}
          onClose={() => setShowQuestionario(null)}
          onSave={salvarQuestionario}
          somenteLeitura={showQuestionario.somenteLeitura || false}
        />
      )}

      {showVisualizacao && (
        <VisualizacaoCompleta
          processo={showVisualizacao}
          departamentosCriados={departamentosCriados}
          onClose={() => setShowVisualizacao(null)}
        />
      )}

      {showCriarDepartamento && (
        <ModalCriarDepartamento
          onClose={() => setShowCriarDepartamento(false)}
          onSave={criarDepartamento}
          departamento={editandoDepartamento}
        />
      )}

      {showCriarQuestionario && (
        <ModalCriarQuestionario
          departamento={showCriarQuestionario}
          onClose={() => setShowCriarQuestionario(null)}
          onSave={salvarQuestionarioDepartamento}
        />
      )}

      {showNovaEmpresa && (
        <ModalNovaEmpresa
          onClose={() => setShowNovaEmpresa(false)}
          onSave={criarNovaSolicitacao}
          onSalvarTemplate={salvarComoTemplate}
        />
      )}

      {showComentarios && (
        <ModalComentarios
          processoId={showComentarios}
          processo={processos.find((p) => p.id === showComentarios)}
          onClose={() => setShowComentarios(null)}
        />
      )}

      {showAnalytics && (
        <ModalAnalytics
          onClose={() => setShowAnalytics(false)}
          analytics={analytics}
          departamentosCriados={departamentosCriados}
        />
      )}


      {showUploadDocumento && (
        <ModalUploadDocumento
          processo={
            typeof showUploadDocumento === 'object' && showUploadDocumento.id
              ? processos.find(p => p.id === showUploadDocumento.id)
              : showUploadDocumento
          }
          perguntaId={
            typeof showUploadDocumento === 'object' && showUploadDocumento.perguntaId
              ? showUploadDocumento.perguntaId
              : null
          }
          perguntaLabel={
            typeof showUploadDocumento === 'object' && showUploadDocumento.perguntaLabel
              ? showUploadDocumento.perguntaLabel
              : null
          }
          onClose={() => setShowUploadDocumento(null)}
          onUpload={fazerUploadDocumento}
          onUploadSuccess={
            typeof showUploadDocumento === 'object' && showUploadDocumento.onUploadSuccess
              ? showUploadDocumento.onUploadSuccess
              : null
          }
        />
      )}
      {showGaleria && (
        <GaleriaDocumentos
          departamento={showGaleria}
          processos={processos}
          documentos={documentos}
          onClose={() => setShowGaleria(null)}
        />
      )}

      {previewDocumento && (
        <PreviewDocumento
          documento={previewDocumento}
          onClose={() => setPreviewDocumento(null)}
        />
      )}
      {showGerenciarTags && (
        <ModalGerenciarTags onClose={() => setShowGerenciarTags(false)} />
      )}

      {showSelecionarTags && (
        <ModalSelecionarTags
          processo={showSelecionarTags}
          tags={tags}
          onClose={() => setShowSelecionarTags(null)}
          onSalvar={aplicarTagsProcesso}
        />
      )}


      {showConfirmacao && (
        (showConfirmacao.tipo === 'processo' ||
          showConfirmacao.tipo === 'departamento' ||
          showConfirmacao.tipo === 'tag' ||
          showConfirmacao.tipo === 'comentario' ||
          showConfirmacao.tipo === 'documento' ||
          showConfirmacao.tipo === 'template') ? (<div className="fixed inset-0 z-[1000]">
            <ModalConfirmacaoExclusao
              tipo={showConfirmacao.tipo}
              nome={showConfirmacao.nome}
              onConfirm={showConfirmacao.onConfirm}
              onCancel={showConfirmacao.onCancel}
            />
          </div>
        ) : (
          <div className="fixed inset-0 z-[1000]">
            <ModalConfirmacao
              titulo={showConfirmacao.titulo || showConfirmacao.nome}
              mensagem={showConfirmacao.mensagem}
              onConfirm={showConfirmacao.onConfirm}
              onCancel={showConfirmacao.onCancel}
              tipo={showConfirmacao.tipo || 'info'}
              textoConfirmar={showConfirmacao.textoConfirmar}
              textoCancelar={showConfirmacao.textoCancelar}
            />
          </div>
        )
      )}


      {/* Login */}
      {showLogin && !usuarioLogado && (
        <ModalLogin
          onClose={() => { }}
          onLogin={(usuario) => {
            setUsuarioLogado(usuario);
            setShowLogin(false);
          }}
        />
      )}

      {showGerenciarUsuarios && (
        <ModalGerenciarUsuarios onClose={() => setShowGerenciarUsuarios(false)} />
      )}

      {showCadastrarEmpresa && (
        <ModalCadastrarEmpresa
          onClose={() => {
            setShowCadastrarEmpresa(false);
            setEditandoEmpresa(null);
          }}
          empresa={editandoEmpresa}
        />
      )}

      {showAlerta && (
        <ModalAlerta
          titulo={showAlerta.titulo}
          mensagem={showAlerta.mensagem}
          tipo={showAlerta.tipo}
          onClose={showAlerta.onClose}
        />
      )}

      {showListarEmpresas && (
        <ModalListarEmpresas
          onClose={() => setShowListarEmpresas(null)}
          tipo={showListarEmpresas}
        />
      )}

      {showQuestionarioSolicitacao && (
        <ModalEditarQuestionarioSolicitacao
          processo={showQuestionarioSolicitacao}
          departamentoId={showQuestionarioSolicitacao.departamentoIdAtual}
          onClose={() => setShowQuestionarioSolicitacao(null)}
          onSave={(processoId, departamentoId, novasPerguntas) =>
            salvarQuestionarioSolicitacao(processoId, departamentoId, novasPerguntas)
          }
        />
      )}
      {showSelecionarTemplate && (
        <ModalSelecionarTemplate
          onClose={() => setShowSelecionarTemplate(false)}
          onSelecionarTemplate={(dados) => {
            criarNovaSolicitacao(dados);
            setShowSelecionarTemplate(false);
          }}
        />
      )}
    </div>
  );
};



export default SistemaAberturaEmpresas;