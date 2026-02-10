const prisma = require('../loaders/prisma');

async function logAudit(req, action, entityType, entityId, metadata = {}) {
    try {
        await prisma.auditLog.create({
            data: {
                organizationId: req.organizationId,
                actorUserId: req.userId,
                action,
                entityType,
                entityId,
                metadata,
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.get('User-Agent')
            }
        });
    } catch (error) {
        console.error('Error logging audit:', error);
    }
}

module.exports = { logAudit };
