const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

/**
 * @swagger
 * /api/messages/conversations:
 *   get:
 *     summary: Obtener conversaciones (casos)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de conversaciones
 */
router.get('/conversations', messageController.getConversations);
router.get('/unread-count', messageController.getUnreadCount);
router.post('/mark-read', messageController.markAsRead);

/**
 * @swagger
 * /api/messages/{caseId}:
 *   get:
 *     summary: Obtener mensajes de un caso
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: caseId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Historial de mensajes
 */
router.get('/:caseId', messageController.getMessages);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Enviar mensaje (HTTP fallback)
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               caseId:
 *                 type: string
 *               messageText:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mensaje enviado
 */
router.post('/', messageController.createMessage);

module.exports = router;
