const express = require('express');
const router = express.Router();
const practiceAreaController = require('../controllers/practiceArea.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

/**
 * @swagger
 * tags:
 *   name: PracticeAreas
 *   description: Gestión de áreas de práctica
 */

/**
 * @swagger
 * /api/practice-areas:
 *   get:
 *     summary: Obtener todas las áreas de práctica
 *     tags: [PracticeAreas]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de áreas de práctica
 */
router.get('/', authMiddleware, practiceAreaController.getPracticeAreas);

/**
 * @swagger
 * /api/practice-areas/{id}:
 *   get:
 *     summary: Obtener un área de práctica por ID
 *     tags: [PracticeAreas]
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
 *         description: Detalles del área de práctica
 *       404:
 *         description: Área no encontrada
 */
router.get('/:id', authMiddleware, practiceAreaController.getPracticeArea);

/**
 * @swagger
 * /api/practice-areas:
 *   post:
 *     summary: Crear nueva área de práctica
 *     tags: [PracticeAreas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Área creada
 */
router.post('/', authMiddleware, practiceAreaController.createPracticeArea);

/**
 * @swagger
 * /api/practice-areas/{id}:
 *   put:
 *     summary: Actualizar área de práctica
 *     tags: [PracticeAreas]
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
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Área actualizada
 */
router.put('/:id', authMiddleware, practiceAreaController.updatePracticeArea);

/**
 * @swagger
 * /api/practice-areas/{id}:
 *   delete:
 *     summary: Eliminar área de práctica
 *     tags: [PracticeAreas]
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
 *         description: Área eliminada
 */
router.delete('/:id', authMiddleware, practiceAreaController.deletePracticeArea);

module.exports = router;
