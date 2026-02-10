const jwt = require('jsonwebtoken');
const prisma = require('../../loaders/prisma');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Acceso denegado' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.userId;
        req.userRole = decoded.role;
        req.organizationId = decoded.organizationId;
        
        // Log para auditoría (simplificado, se puede expandir)
        // console.log(`User ${req.userId} accessing ${req.path}`);

        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token inválido' });
    }
};

module.exports = { authMiddleware };
