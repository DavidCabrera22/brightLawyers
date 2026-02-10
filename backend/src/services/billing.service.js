const prisma = require('../loaders/prisma');

/**
 * Create a new invoice
 */
const createInvoice = async (invoiceData, user) => {
    let { 
        clientId, 
        caseId, 
        invoiceNumber, 
        issueDate, 
        dueDate, 
        subtotal, 
        tax, 
        total,
        currency 
    } = invoiceData;

    if (caseId && !clientId) {
        const linkedCase = await prisma.case.findUnique({
            where: { id: caseId },
            select: { clientId: true }
        });
        if (linkedCase) clientId = linkedCase.clientId;
    }

    if (!clientId) {
        throw new Error('El cliente es obligatorio para crear una factura');
    }

    // Auto-generate invoice number if not provided
    if (!invoiceNumber) {
        const lastInvoice = await prisma.invoice.findFirst({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' }
        });
        
        const year = new Date().getFullYear();
        let nextNum = 1;
        
        if (lastInvoice && lastInvoice.invoiceNumber && lastInvoice.invoiceNumber.startsWith(`INV-${year}-`)) {
            const parts = lastInvoice.invoiceNumber.split('-');
            if (parts.length === 3) {
                const lastNum = parseInt(parts[2], 10);
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }
        }
        
        invoiceNumber = `INV-${year}-${nextNum.toString().padStart(4, '0')}`;
    }

    return await prisma.invoice.create({
        data: {
            organizationId: user.organizationId,
            clientId,
            caseId,
            invoiceNumber,
            issueDate: new Date(issueDate),
            dueDate: dueDate ? new Date(dueDate) : null,
            subtotal: parseFloat(subtotal || 0),
            tax: parseFloat(tax || 0),
            total: parseFloat(total || 0),
            currency: currency || 'COP',
            status: 'draft'
        }
    });
};

/**
 * Register a payment (Bancolombia transfer simulation)
 */
const registerPayment = async (paymentData, user) => {
    const { invoiceId, amount, method, reference, paymentDate, proofImage } = paymentData;

    const invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId }
    });

    if (!invoice) {
        throw new Error('Factura no encontrada');
    }

    // Record payment
    const payment = await prisma.payment.create({
        data: {
            invoiceId,
            amount: parseFloat(amount),
            method,
            reference,
            proofImage,
            paymentDate: paymentDate ? new Date(paymentDate) : new Date()
        }
    });

    // Update invoice status if fully paid
    const allPayments = await prisma.payment.findMany({
        where: { invoiceId }
    });

    const totalPaid = allPayments.reduce((acc, curr) => acc + Number(curr.amount), 0);
    
    let newStatus = invoice.status;
    if (totalPaid >= Number(invoice.total)) {
        newStatus = 'paid';
    } else if (totalPaid > 0) {
        // partial payment logic could go here, for now we leave it or maybe 'issued'
    }

    if (newStatus !== invoice.status) {
        await prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: newStatus }
        });
    }

    return payment;
};

const getInvoices = async (req) => {
    const { organizationId } = req;
    const { caseId } = req.query;

    const where = { organizationId };
    if (caseId) where.caseId = caseId;

    return await prisma.invoice.findMany({
        where,
        include: { 
            client: { select: { fullNameOrBusinessName: true } },
            payments: true 
        },
        orderBy: { createdAt: 'desc' }
    });
};

module.exports = {
    createInvoice,
    registerPayment,
    getInvoices
};
