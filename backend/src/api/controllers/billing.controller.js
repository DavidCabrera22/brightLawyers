const billingService = require('../../services/billing.service');

const createInvoice = async (req, res, next) => {
    try {
        const invoice = await billingService.createInvoice(req.body, req.user);
        res.status(201).json(invoice);
    } catch (error) {
        next(error);
    }
};

const registerPayment = async (req, res, next) => {
    try {
        const paymentData = {
            ...req.body,
            proofImage: req.file ? req.file.path : null
        };
        const payment = await billingService.registerPayment(paymentData, req.user);
        res.status(201).json(payment);
    } catch (error) {
        next(error);
    }
};

const getInvoices = async (req, res, next) => {
    try {
        const invoices = await billingService.getInvoices(req);
        res.json(invoices);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createInvoice,
    registerPayment,
    getInvoices
};
