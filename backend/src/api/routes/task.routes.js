const express = require('express');
const router = express.Router();
const taskController = require('../controllers/task.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Obtener todas las tareas
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [todo, doing, done]
 *         description: Filtrar por estado
 *       - in: query
 *         name: caseId
 *         schema:
 *           type: string
 *         description: Filtrar por caso ID
 *     responses:
 *       200:
 *         description: Lista de tareas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *   post:
 *     summary: Crear nueva tarea
 *     tags: [Tasks]
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
 *               priority:
 *                 type: string
 *                 enum: [low, med, high]
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *               taskType:
 *                 type: string
 *                 default: deadline
 *               caseId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Tarea creada exitosamente
 */

router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
/**
 * @swagger
 * /api/tasks/{id}:
 *   patch:
 *     summary: Actualizar tarea
 *     tags: [Tasks]
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
 *               status:
 *                 type: string
 *                 enum: [todo, doing, done]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Tarea actualizada
 *   delete:
 *     summary: Eliminar tarea
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Tarea eliminada
 */
router.patch('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;
