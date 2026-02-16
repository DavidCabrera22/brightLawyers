
const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsapp.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');

// Protect these routes with admin access ideally
// For now, using authMiddleware
router.get('/status', authMiddleware, whatsappController.getStatus);
router.post('/restart', authMiddleware, whatsappController.restartService);

module.exports = router;
