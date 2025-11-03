const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'seu_segredo_super_secreto_aqui_mude_isso';

function gerarToken(usuario) {
    console.log('🎫 Gerando token com dados:', {
        id: usuario.id,
        nome: usuario.nome, 
        role: usuario.role,
        departamento_id: usuario.departamento_id 
    });
    
    return jwt.sign(
        { 
            id: usuario.id, 
            nome: usuario.nome, 
            role: usuario.role,
            departamento_id: usuario.departamento_id 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
    );
}


function verificarToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ erro: 'Token inválido' });
        }
        req.usuario = decoded;
        next();
    });
}

function verificarPermissao(permissao) {
    return (req, res, next) => {
        if (req.usuario.role === 'admin') {
            return next();
        }

        next();
    };
}

module.exports = { gerarToken, verificarToken, verificarPermissao };