CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'gerente', 'comum', 'normal')),
    departamento_id INTEGER,
    permissoes TEXT DEFAULT '[]',
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id)
);


INSERT OR IGNORE INTO usuarios (id, nome, senha, role, permissoes) 
VALUES (
    1, 
    'Admin', 
    '$2b$10$FoyAHZ6fHf3AU9hQJjPQZ.EBy9Fxvf6dLnnUMJ99DJji5DHvLkp9G', 
    'admin',
    '["criar_processo","editar_processo","excluir_processo","criar_departamento","editar_departamento","excluir_departamento","criar_tag","editar_tag","excluir_tag","gerenciar_usuarios"]'
);

CREATE TABLE IF NOT EXISTS templates_solicitacao (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  fluxo_departamentos TEXT NOT NULL, -- JSON array de IDs
  questionarios_por_departamento TEXT, -- JSON object
  criado_por INTEGER,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  ativo BOOLEAN DEFAULT 1,
  FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);


CREATE TABLE IF NOT EXISTS questionarios_preenchidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL,
  departamento_id INTEGER NOT NULL,
  preenchido_em DATETIME NOT NULL,
  preenchido_por TEXT,
  todos_obrigatorios_preenchidos INTEGER DEFAULT 0,
  FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
  FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_processo_dept ON questionarios_preenchidos(processo_id, departamento_id);
-- ========================================
-- TABELA DE PROCESSOS
-- ========================================
CREATE TABLE IF NOT EXISTS processos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome_empresa TEXT NOT NULL,
    cliente TEXT,
    email TEXT,
    telefone TEXT,
    tipo_empresa TEXT DEFAULT 'LTDA',
    departamento_atual INTEGER,
    status TEXT DEFAULT 'Em Andamento',
    prioridade TEXT DEFAULT 'MEDIA',
    data_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    prazo_estimado DATETIME,
    data_finalizacao DATETIME,
    progresso INTEGER DEFAULT 0,
    respostas TEXT DEFAULT '{}',
    historico TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    observacoes TEXT,
    criado_por INTEGER,
    FOREIGN KEY (criado_por) REFERENCES usuarios(id)
);

-- ========================================
-- TABELA DE DEPARTAMENTOS
-- ========================================
CREATE TABLE IF NOT EXISTS departamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    responsavel TEXT,
    cor TEXT,
    cor_solida TEXT,
    icone TEXT,
    descricao TEXT,
    questionario TEXT DEFAULT '[]',
    documentos_obrigatorios TEXT DEFAULT '[]',
    ordem INTEGER DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- TABELA DE COMENTÁRIOS
-- ========================================
CREATE TABLE IF NOT EXISTS comentarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    processo_id INTEGER NOT NULL,
    texto TEXT NOT NULL,
    autor TEXT,
    departamento TEXT,
    departamento_id INTEGER,
    mencoes TEXT DEFAULT '[]',
    editado INTEGER DEFAULT 0,
    editado_em DATETIME,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE
);

-- ========================================
-- TABELA DE DOCUMENTOS
-- ========================================
  CREATE TABLE IF NOT EXISTS documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    processo_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    tipo TEXT NOT NULL,
    tamanho INTEGER NOT NULL,
    url TEXT NOT NULL,
    tipo_categoria TEXT,
    departamento_id INTEGER,
    pergunta_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
    FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE SET NULL
  );
-- ========================================
-- TABELA DE RESPOSTAS DE QUESTIONÁRIO
-- ========================================
CREATE TABLE IF NOT EXISTS respostas_questionario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  processo_id INTEGER NOT NULL,
  departamento_id INTEGER NOT NULL,
  pergunta_id TEXT NOT NULL,
  resposta TEXT NOT NULL,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
  FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS empresas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cnpj VARCHAR(20) NOT NULL UNIQUE,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  razao_social VARCHAR(255) NOT NULL,
  apelido VARCHAR(255),
  inscricao_estadual VARCHAR(50),
  inscricao_municipal VARCHAR(50),
  regime_federal VARCHAR(50),
  regime_estadual VARCHAR(50),
  regime_municipal VARCHAR(50),
  data_abertura DATE,
  estado VARCHAR(2),
  cidade VARCHAR(100),
  bairro VARCHAR(100),
  logradouro VARCHAR(255),
  numero VARCHAR(20),
  cep VARCHAR(10),
  email VARCHAR(100),
  telefone VARCHAR(20),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  criado_por INTEGER
);
-- ========================================
-- TABELA DE NOTIFICAÇÕES
-- ========================================
CREATE TABLE IF NOT EXISTS notificacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mensagem TEXT NOT NULL,
    tipo TEXT,
    lida INTEGER DEFAULT 0,
    usuario_id INTEGER,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
-- TABELA DE TAGS
-- ========================================
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  cor TEXT,
  texto TEXT,
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);


INSERT OR IGNORE INTO tags (id, nome, cor, texto) VALUES
(1, 'Urgente', 'bg-red-500', 'text-white'),
(2, 'Aguardando Cliente', 'bg-yellow-500', 'text-white'),
(3, 'Revisão', 'bg-purple-500', 'text-white'),
(4, 'Documentação Pendente', 'bg-orange-500', 'text-white');

