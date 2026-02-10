const express = require('express');
const router = express.Router();
const clientController = require('../controllers/client.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Obtener todos los clientes
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de clientes
 *   post:
 *     summary: Crear nuevo cliente
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               documentNumber:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cliente creado
 */
router.get('/', clientController.getClients);
router.post('/', clientController.createClient);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Obtener detalle de un cliente
 *     tags: [Clients]
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
 *         description: Detalle del cliente con sus casos
 *       404:
 *         description: Cliente no encontrado
 */
router.get('/:id', clientController.getClientById);

/**
 * @swagger
 * /api/clients/{id}:
 *   put:
 *     summary: Actualizar cliente
 *     tags: [Clients]
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
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cliente actualizado
 *   delete:
 *     summary: Eliminar cliente
 *     tags: [Clients]
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
 *         description: Cliente eliminado
 */
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

module.exports = router;
