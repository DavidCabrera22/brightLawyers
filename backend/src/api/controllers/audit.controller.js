const prisma = require('../../loaders/prisma');

const getAuditLogs = async (req, res) => {
    try {
        const { limit = 50, entityType } = req.query;
        const where = { organizationId: req.organizationId };
        
        if (entityType) where.entityType = entityType;

        const logs = await prisma.auditLog.findMany({
            where,
            take: parseInt(limit),
            orderBy: { createdAt: 'desc' },
            include: { actor: { select: { fullName: true, email: true } } }
        });
        res.json(logs);
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Error obteniendo logs' });
    }
};

module.exports = { getAuditLogs };
