const express = require('express');
const router = express.Router();
const { getAuditLogs } = require('../controllers/audit.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Obtener logs de auditoría
 *     tags: [Audit]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de logs de auditoría
 */
router.get('/audit-logs', authMiddleware, getAuditLogs);

module.exports = router;
