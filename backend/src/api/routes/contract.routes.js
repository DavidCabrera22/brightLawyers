const express = require('express');
const router = express.Router();
const contractController = require('../controllers/contract.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

router.use(authMiddleware);

/**
 * @swagger
 * /api/contracts:
 *   get:
 *     summary: Obtener todos los contratos
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de contratos
 *   post:
 *     summary: Crear nuevo contrato
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               caseId:
 *                 type: string
 *                 description: ID del caso (opcional, si se provee se deduce el cliente)
 *               clientId:
 *                 type: string
 *                 description: ID del cliente (requerido si no se provee caseId)
 *               contractValue:
 *                 type: number
 *               practiceAreaId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contrato creado
 */
router.get('/', contractController.getContracts);
router.post('/', contractController.createContract);
router.delete('/:id', contractController.deleteContract);

/**
 * @swagger
 * /api/contracts/{id}/versions:
 *   post:
 *     summary: Crear nueva versión del contrato
 *     tags: [Contracts]
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
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Versión creada
 */
router.post('/:id/versions', contractController.createVersion);

/**
 * @swagger
 * /api/contracts/{id}/signers:
 *   post:
 *     summary: Agregar firmante al contrato
 *     tags: [Contracts]
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: Firmante agregado
 */
router.post('/:id/signers', contractController.createSigner);

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Obtener contrato por ID
 *     tags: [Contracts]
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
 *         description: Detalles del contrato
 *       404:
 *         description: Contrato no encontrado
 */
router.get('/:id', contractController.getContractById);

/**
 * @swagger
 * /api/contracts/{id}:
 *   put:
 *     summary: Actualizar contrato
 *     tags: [Contracts]
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
 *                 enum: [draft, sent, signed, cancelled]
 *               title:
 *                 type: string
 *               contractValue:
 *                 type: number
 *     responses:
 *       200:
 *         description: Contrato actualizado
 */
router.put('/:id', contractController.updateContract);

module.exports = router;
