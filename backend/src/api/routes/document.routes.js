const express = require('express');
const router = express.Router();
const documentController = require('../controllers/document.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

router.use(authMiddleware);

/**
 * @swagger
 * /api/documents/upload:
 *   post:
 *     summary: Subir documento
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               caseId:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Documento subido
 */
router.post('/upload', upload.single('file'), documentController.uploadDocument);

/**
 * @swagger
 * /api/documents:
 *   get:
 *     summary: Obtener todos los documentos
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de documentos
 */
router.get('/', documentController.getDocuments);

/**
 * @swagger
 * /api/documents/{id}/download:
 *   get:
 *     summary: Descargar documento
 *     tags: [Documents]
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
 *         description: Archivo del documento
 */
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;
