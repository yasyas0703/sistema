const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { db } = require('../database/db');
const { gerarToken, verificarToken } = require('../middleware/auth');

console.log('✅ Arquivo usuarios.js carregado');

router.use((req, res, next) => {
    console.log(`🔵 Rota de usuários chamada: ${req.method} ${req.path}`);
    console.log('📦 Body:', req.body);
    next();
});

router.post('/login', async (req, res) => {
    console.log('🚀 ENTROU NA ROTA DE LOGIN');
    const { nome, senha } = req.body;

    if (!nome || !senha) {
        return res.status(400).json({ 
            sucesso: false,
            erro: 'Nome e senha são obrigatórios' 
        });
    }

    try {
        const usuario = await db.getAsync(`
            SELECT 
                u.*,
                d.nome as departamento_nome
            FROM usuarios u
            LEFT JOIN departamentos d ON u.departamento_id = d.id
            WHERE u.nome = ?
        `, [nome]);

        console.log('👤 Usuário encontrado:', usuario);
        
        if (!usuario) {
            return res.status(401).json({ 
                sucesso: false,
                erro: 'Usuário não encontrado' 
            });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        
        if (!senhaValida) {
            return res.status(401).json({ 
                sucesso: false,
                erro: 'Senha incorreta' 
            });
        }

        const token = gerarToken(usuario);

        console.log('✅ Login bem-sucedido! Departamento:', usuario.departamento_id);

        res.json({
            sucesso: true,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                role: usuario.role,
                departamento_id: usuario.departamento_id, 
                departamento_nome: usuario.departamento_nome,
                permissoes: JSON.parse(usuario.permissoes || '[]'),
                ativo: !!usuario.ativo
            },
            token
        });

    } catch (err) {
        console.error('💥 Erro no login:', err);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro interno do servidor' 
        });
    }
});


router.get('/me', verificarToken, async (req, res) => {
    try {
        console.log('🔍 Buscando dados do usuário ID:', req.usuario.id);
        
        const usuario = await db.getAsync(`
            SELECT 
                u.id, 
                u.nome, 
                u.role, 
                u.departamento_id,
                u.permissoes, 
                u.ativo,
                d.nome as departamento_nome
            FROM usuarios u
            LEFT JOIN departamentos d ON u.departamento_id = d.id
            WHERE u.id = ?
        `, [req.usuario.id]);

        console.log('👤 Dados do usuário retornados:', usuario);

        if (!usuario) {
            return res.status(404).json({ 
                sucesso: false,
                erro: 'Usuário não encontrado' 
            });
        }

        const resposta = {
            sucesso: true,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                role: usuario.role,
                departamento_id: usuario.departamento_id, 
                departamento_nome: usuario.departamento_nome,
                permissoes: JSON.parse(usuario.permissoes || '[]'),
                ativo: !!usuario.ativo
            }
        };

        console.log('📤 Enviando resposta:', resposta);
        res.json(resposta);

    } catch (err) {
        console.error('❌ Erro ao verificar sessão:', err);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro interno do servidor' 
        });
    }
});

router.post('/', verificarToken, async (req, res) => {
    try {
        if (req.usuario.role !== 'admin') {
            return res.status(403).json({ 
                sucesso: false,
                erro: 'Acesso negado. Apenas administradores podem criar usuários.' 
            });
        }

        const { nome, senha, role, permissoes, departamento_id } = req.body;
        
        console.log('🔍 BACKEND - Criando usuário:', { 
            nome, 
            role, 
            departamento_id,
            bodyCompleto: req.body 
        });

        if (!nome || !senha || !role) {
            return res.status(400).json({ 
                sucesso: false,
                erro: 'Nome, senha e role são obrigatórios' 
            });
        }

        if (role === 'gerente' && !departamento_id) {
            console.log('❌ BACKEND - Gerente sem departamento_id');
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'Gerentes devem ter um departamento associado' 
            });
        }

        if (departamento_id) {
            const departamentoExiste = await db.getAsync(
                'SELECT id FROM departamentos WHERE id = ?',
                [departamento_id]
            );
            
            if (!departamentoExiste) {
                return res.status(400).json({
                    sucesso: false,
                    erro: 'Departamento não encontrado'
                });
            }
        }

        const usuarioExistente = await db.getAsync(
            'SELECT id FROM usuarios WHERE nome = ?', 
            [nome]
        );

        if (usuarioExistente) {
            return res.status(400).json({ 
                sucesso: false,
                erro: 'Nome de usuário já existe' 
            });
        }

        const hashSenha = await bcrypt.hash(senha, 10);

        const permissoesJson = JSON.stringify(permissoes || []);

        const result = await db.runAsync(
            'INSERT INTO usuarios (nome, senha, role, departamento_id, permissoes, ativo) VALUES (?, ?, ?, ?, ?, 1)',
            [nome, hashSenha, role, departamento_id || null, permissoesJson]
        );

        console.log('✅ Usuário criado com ID:', result.lastID);

        res.status(201).json({ 
            sucesso: true,
            mensagem: 'Usuário criado com sucesso', 
            id: result.lastID 
        });

    } catch (err) {
        console.error('❌ Erro ao criar usuário:', err);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro interno do servidor: ' + err.message 
        });
    }
});


router.get('/', verificarToken, async (req, res) => {
    try {
        if (req.usuario.role !== 'admin') {
            return res.status(403).json({ 
                sucesso: false,
                erro: 'Acesso negado' 
            });
        }

        const usuarios = await db.allAsync(`
            SELECT 
                u.id, 
                u.nome, 
                u.role, 
                u.departamento_id,
                u.permissoes, 
                u.ativo,
                d.nome as departamento_nome
            FROM usuarios u
            LEFT JOIN departamentos d ON u.departamento_id = d.id
            ORDER BY u.nome
        `);
        
        const usuariosFormatados = usuarios.map(u => ({
            id: u.id,
            nome: u.nome,
            role: u.role,
            departamento_id: u.departamento_id,
            departamento: u.departamento_nome,
            permissoes: JSON.parse(u.permissoes || '[]'),
            ativo: !!u.ativo
        }));
        
        console.log(`✅ ${usuariosFormatados.length} usuários retornados`);
        
        res.json({
            sucesso: true,
            usuarios: usuariosFormatados
        });

    } catch (err) {
        console.error('Erro ao listar usuários:', err);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro interno do servidor' 
        });
    }
});


router.put('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    const { nome, senha, role, permissoes, ativo, departamento_id } = req.body;

    try {
        if (req.usuario.role !== 'admin' && req.usuario.id !== parseInt(id)) {
            return res.status(403).json({ 
                sucesso: false,
                erro: 'Acesso negado' 
            });
        }

        if (role === 'gerente' && !departamento_id) {
            return res.status(400).json({ 
                sucesso: false, 
                erro: 'Gerentes devem ter um departamento associado' 
            });
        }

        if (departamento_id) {
            const departamentoExiste = await db.getAsync(
                'SELECT id FROM departamentos WHERE id = ?',
                [departamento_id]
            );
            
            if (!departamentoExiste) {
                return res.status(400).json({
                    sucesso: false,
                    erro: 'Departamento não encontrado'
                });
            }
        }

        let query = 'UPDATE usuarios SET nome = ?, role = ?, permissoes = ?, ativo = ?, departamento_id = ?';
        let params = [
            nome, 
            role, 
            JSON.stringify(permissoes || []), 
            ativo ? 1 : 0, 
            departamento_id || null
        ];

        if (senha) {
            const hashSenha = await bcrypt.hash(senha, 10);
            query += ', senha = ?';
            params.push(hashSenha);
        }

        query += ' WHERE id = ?';
        params.push(id);

        await db.runAsync(query, params);

        res.json({ 
            sucesso: true,
            mensagem: 'Usuário atualizado com sucesso' 
        });

    } catch (err) {
        console.error('Erro ao atualizar usuário:', err);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro interno do servidor' 
        });
    }
});


router.delete('/:id', verificarToken, async (req, res) => {
    const { id } = req.params;

    try {
        if (req.usuario.role !== 'admin') {
            return res.status(403).json({ 
                sucesso: false,
                erro: 'Acesso negado' 
            });
        }

        if (req.usuario.id === parseInt(id)) {
            return res.status(400).json({ 
                sucesso: false,
                erro: 'Você não pode excluir sua própria conta' 
            });
        }

        await db.runAsync('DELETE FROM usuarios WHERE id = ?', [id]);

        res.json({ 
            sucesso: true,
            mensagem: 'Usuário excluído com sucesso' 
        });

    } catch (err) {
        console.error('Erro ao excluir usuário:', err);
        res.status(500).json({ 
            sucesso: false,
            erro: 'Erro interno do servidor' 
        });
    }
});

module.exports = router;