const jwt = require('jsonwebtoken');

// Middleware para verificar JWT token
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
    }

    // Manejo robusto del formato "Bearer <token>"
    let token = authHeader;
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        token = authHeader.slice(7).trim();
    }

    if (!token) {
        return res.status(401).json({ error: 'Formato de token inválido' });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Agregar información del usuario al request
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.userRole = decoded.role;
    req.organizationId = decoded.organizationId;
    
    next();
  } catch (error) {
    console.error('Auth Error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Token inválido', details: error.message });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'No autorizado: Error al verificar token' });
  }
};

module.exports = authMiddleware;
