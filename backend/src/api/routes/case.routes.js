const express = require('express');
const router = express.Router();
const caseController = require('../controllers/case.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Middlewares already applied in app.js via authRoutes usually, but here we apply per route or router level.
// We'll apply authMiddleware to all routes here for safety.
router.use(authMiddleware);

// Core Case CRUD

/**
 * @swagger
 * /api/cases/opportunities:
 *   get:
 *     summary: Obtener casos disponibles para el abogado según especialidad
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de casos disponibles (oportunidades)
 */
router.get('/opportunities', caseController.getOpportunities);

/**
 * @swagger
 * /api/cases/activity/recent:
 *   get:
 *     summary: Obtener actividad reciente de los casos asignados
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de eventos recientes
 */
router.get('/activity/recent', caseController.getRecentActivity);

/**
 * @swagger
 * /api/cases:
 *   get:
 *     summary: Obtener todos los casos
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [intake, active, closed, suspended]
 *         description: Filtrar por estado del caso
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Busqueda general
 *     responses:
 *       200:
 *         description: Lista de casos
 *   post:
 *     summary: Crear nuevo caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               clientId:
 *                 type: string
 *               practiceAreaId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Caso creado
 */
router.get('/', caseController.getCases);
router.post('/', caseController.createCase);
router.post('/:id/assign-me', caseController.assignMe);
router.post('/:id/assign', caseController.assignLawyer);
router.post('/:id/document-request', caseController.toggleDocumentRequest);
router.delete('/:id', caseController.deleteCase);


/**
 * @swagger
 * /api/cases/{id}:
 *   get:
 *     summary: Obtener detalle de un caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalle del caso
 *   patch:
 *     summary: Actualizar caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Caso actualizado
 */
router.get('/:id', caseController.getCaseById);
router.patch('/:id', caseController.updateCase);

// Sub-resources

/**
 * @swagger
 * /api/cases/{id}/timeline:
 *   get:
 *     summary: Obtener línea de tiempo del caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de eventos
 *   post:
 *     summary: Agregar evento a la línea de tiempo
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Evento creado
 */
router.get('/:id/timeline', caseController.getTimeline);
router.post('/:id/timeline', caseController.createTimelineEvent);

/**
 * @swagger
 * /api/cases/{id}/notes:
 *   get:
 *     summary: Obtener notas del caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de notas
 *   post:
 *     summary: Crear nota en el caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Nota creada
 */
router.get('/:id/notes', caseController.getNotes);
router.post('/:id/notes', caseController.createNote);

/**
 * @swagger
 * /api/cases/{id}/messages:
 *   get:
 *     summary: Obtener mensajes del caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mensajes
 *   post:
 *     summary: Enviar mensaje al caso
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Mensaje creado
 */
router.get('/:id/messages', caseController.getMessages);
router.post('/:id/messages', caseController.createMessage);

/**
 * @swagger
 * /api/cases/{caseId}/documents:
 *   get:
 *     summary: Obtener documentos del caso
 *     tags: [Cases]
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
 *         description: Lista de documentos
 */
router.get('/:caseId/documents', caseController.getDocuments); // Note: param name matches controller expectation if passed correctly

/**
 * @swagger
 * /api/cases/{id}/assign-me:
 *   post:
 *     summary: Asignar caso al usuario actual (Abogado)
 *     tags: [Cases]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Caso asignado
 */
router.post('/:id/assign-me', caseController.assignMe);

module.exports = router;
