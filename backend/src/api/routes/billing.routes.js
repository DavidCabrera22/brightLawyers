const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authMiddleware } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.use(authMiddleware);

router.post('/invoices', billingController.createInvoice);
router.get('/invoices', billingController.getInvoices);
router.post('/payments', upload.single('proofImage'), billingController.registerPayment);

module.exports = router;
