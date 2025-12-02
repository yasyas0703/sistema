const express = require('express');
const { db } = require('../database/db');
const { verificarToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

router.use((req, res, next) => {
  console.log('📬 /api/documentos - Requisição recebida:', {
    method: req.method,
    path: req.path,
    headers: {
      authorization: req.headers['authorization'] ? '<<present>>' : '<<missing>>',
      'content-type': req.headers['content-type'] || null
    }
  });
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    
    if (!fs.existsSync(uploadDir)) {
      console.log('📁 Criando diretório de uploads:', uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    console.log('📂 Salvando arquivo em:', uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    console.log('📝 Nome do arquivo:', uniqueName);
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });



router.get('/', verificarToken, async (req, res) => {
  try {
    const { processoId, departamentoId, perguntaId } = req.query;
    
    console.log('📥 GET /api/documentos - Query:', req.query);
    
    let query = 'SELECT * FROM documentos WHERE 1=1';
    let params = [];
    
    if (processoId) {
      query += ' AND processo_id = ?';
      params.push(processoId);
    } else {
      return res.json([]);
    }
    
    if (perguntaId && perguntaId !== 'null' && perguntaId !== 'undefined') {
      query += ' AND pergunta_id = ?';
      params.push(parseInt(perguntaId)); 
      console.log('🔍 Filtrando por pergunta:', perguntaId);
    } 
    else if (departamentoId && departamentoId !== 'null' && departamentoId !== 'undefined') {
      query += ' AND departamento_id = ?';
      params.push(parseInt(departamentoId));
      console.log('🔍 Filtrando por departamento:', departamentoId);
    }
    
    query += ' ORDER BY criado_em DESC';
    
    console.log('📋 Query SQL:', query);
    console.log('📋 Params:', params);
    
    const documentos = await db.allAsync(query, params);
    console.log(`📄 ${documentos.length} documento(s) encontrado(s)`);
    
    documentos.forEach(doc => {
      console.log(`   - ${doc.nome} (pergunta_id: ${doc.pergunta_id}, tipo: ${typeof doc.pergunta_id})`);
    });
    
    res.json(documentos);
    
  } catch (erro) {
    console.error('❌ Erro ao listar documentos:', erro);
    res.status(500).json({ 
      erro: 'Erro ao listar documentos', 
      detalhes: erro.message 
    });
  }
});

router.post('/', verificarToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        sucesso: false,
        erro: 'Nenhum arquivo enviado' 
      });
    }
    
    console.log('📤 UPLOAD RECEBIDO:', {
      arquivo: req.file.originalname,
      processoId: req.body.processoId,
      perguntaId: req.body.perguntaId, 
      departamentoId: req.body.departamentoId,
      tipoCategoria: req.body.tipoCategoria
    });
    
    let { processoId, tipoCategoria, perguntaId, departamentoId } = req.body;
    
    perguntaId = perguntaId && perguntaId !== 'null' && perguntaId !== 'undefined' 
      ? parseInt(perguntaId) 
      : null;
    
    departamentoId = departamentoId && departamentoId !== 'null' && departamentoId !== 'undefined'
      ? parseInt(departamentoId)
      : null;
    
    console.log('📝 Valores parseados:', {
      perguntaId,
      departamentoId,
      tiposPergunta: typeof perguntaId,
      tiposDept: typeof departamentoId
    });
    
    const documentoUrl = `/uploads/${req.file.filename}`;
    
    const resultado = await db.runAsync(
      `INSERT INTO documentos (
        processo_id, nome, tipo, tamanho, url, 
        tipo_categoria, departamento_id, pergunta_id, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        processoId,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        documentoUrl,
        tipoCategoria || 'geral',
        departamentoId,
        perguntaId, 
        new Date().toISOString()
      ]
    );

    const documento = await db.getAsync(
      'SELECT * FROM documentos WHERE id = ?',
      [resultado.id]
    );

    console.log('✅ Documento salvo:', {
      id: documento.id,
      nome: documento.nome,
      pergunta_id: documento.pergunta_id, 
      tipo_pergunta: typeof documento.pergunta_id
    });

    res.json({ 
      sucesso: true, 
      id: resultado.id,
      documento
    });
    
  } catch (erro) {
    console.error('❌ Erro ao fazer upload:', erro);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao fazer upload', 
      detalhes: erro.message 
    });
  }
});

router.delete('/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🗑️ Tentando excluir documento:', id);
    
    const documento = await db.getAsync(
      'SELECT * FROM documentos WHERE id = ?',
      [id]
    );
    
    if (!documento) {
      return res.status(404).json({ 
        sucesso: false,
        erro: 'Documento não encontrado' 
      });
    }
    
    console.log('📄 Documento encontrado:', {
      id: documento.id,
      nome: documento.nome,
      url: documento.url
    });
    

  const relativeUrl = (documento.url || '').replace(/^\//, '');
  const filePath = path.join(__dirname, '..', relativeUrl);
    console.log('🔍 Caminho do arquivo:', filePath);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('✅ Arquivo físico removido');
    } else {
      console.warn('⚠️ Arquivo físico não encontrado:', filePath);
    }
    
    await db.runAsync('DELETE FROM documentos WHERE id = ?', [id]);
    
    console.log('✅ Documento excluído do banco de dados');
    
    res.json({ 
      sucesso: true,
      mensagem: 'Documento excluído com sucesso'
    });
    
  } catch (erro) {
    console.error('❌ Erro ao excluir documento:', erro);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao excluir documento',
      detalhes: erro.message
    });
  }
});

router.get('/pergunta/:perguntaId', verificarToken, async (req, res) => {
  try {
    const { perguntaId } = req.params;
    const { processoId } = req.query;
    
    console.log('📥 Buscando documentos da pergunta:', perguntaId);
    
    let query = 'SELECT * FROM documentos WHERE pergunta_id = ?';
    let params = [perguntaId];
    
    if (processoId) {
      query += ' AND processo_id = ?';
      params.push(processoId);
    }
    
    query += ' ORDER BY criado_em DESC';
    
    const documentos = await db.allAsync(query, params);
    
    console.log(`✅ ${documentos.length} documento(s) encontrado(s) para pergunta ${perguntaId}`);
    
    res.json(documentos);
    
  } catch (erro) {
    console.error('❌ Erro ao buscar documentos da pergunta:', erro);
    res.status(500).json({ 
      sucesso: false,
      erro: 'Erro ao buscar documentos',
      detalhes: erro.message
    });
  }
});


router.get('/debug', verificarToken, async (req, res) => {
  try {
    const { nome, processoId } = req.query;
    let query = 'SELECT * FROM documentos WHERE 1=1';
    const params = [];

    if (nome) {
      query += ' AND nome LIKE ?';
      params.push(`%${nome}%`);
    }
    if (processoId) {
      query += ' AND processo_id = ?';
      params.push(processoId);
    }

    query += ' ORDER BY criado_em DESC LIMIT 50';

    const docs = await db.allAsync(query, params);

    const docsWithFile = docs.map(d => {
      const filePath1 = path.join(__dirname, '..', d.url || ''); 
      const filePath2 = path.join(__dirname, '..', 'server', d.url ? d.url.replace(/^\//, '') : '');
      const exists1 = fs.existsSync(filePath1);
      const exists2 = fs.existsSync(filePath2);
      return {
        ...d,
        filePath1,
        filePath2,
        exists1,
        exists2
      };
    });

    res.json({ sucesso: true, total: docsWithFile.length, documentos: docsWithFile });
  } catch (err) {
    console.error('❌ Erro debug documentos:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

  router.post('/debug-upload', verificarToken, upload.single('file'), (req, res) => {
    try {
      console.log('🧪 Debug upload - req.file:', req.file ? { originalname: req.file.originalname, filename: req.file.filename, path: req.file.path, size: req.file.size } : null);
      console.log('🧪 Debug upload - req.body:', req.body);

      res.json({
        sucesso: true,
        recebidos: {
          headers: {
            authorization: req.headers['authorization'] ? '<<present>>' : '<<missing>>',
            'content-type': req.headers['content-type'] || null
          },
          file: req.file ? {
            originalname: req.file.originalname,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size
          } : null,
          body: req.body
        }
      });
    } catch (err) {
      console.error('❌ Erro debug-upload:', err);
      res.status(500).json({ sucesso: false, erro: err.message });
    }
  });

router.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = path.join(__dirname, '..', 'uploads', filename);
  
  console.log('📁 Tentando servir arquivo:', filePath);
  
  if (!fs.existsSync(filePath)) {
    console.error('❌ Arquivo não encontrado:', filePath);
    return res.status(404).json({ 
      erro: 'Arquivo não encontrado',
      path: filePath 
    });
  }
  
  res.sendFile(filePath);
});


router.get('/list-uploads', verificarToken, (req, res) => {
  try {
    const serverUploads = path.join(__dirname, '..', 'uploads');
    const rootUploads = path.join(__dirname, '..', '..', 'uploads');

    const gather = (dir) => {
      if (!fs.existsSync(dir)) return { dir, exists: false, files: [] };
      const names = fs.readdirSync(dir);
      const files = names.map(name => {
        const p = path.join(dir, name);
        let stat = null;
        try { stat = fs.statSync(p); } catch (e) {  }
        return {
          name,
          fullPath: p,
          size: stat ? stat.size : null,
          mtime: stat ? stat.mtime : null,
          isFile: stat ? stat.isFile() : false
        };
      });
      return { dir, exists: true, files };
    };

    const serverList = gather(serverUploads);
    const rootList = gather(rootUploads);

    res.json({ sucesso: true, serverUploads: serverList, rootUploads: rootList });
  } catch (err) {
    console.error('❌ Erro listando uploads:', err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});
module.exports = router;
