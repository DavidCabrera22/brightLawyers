
const whatsappService = require('../../services/whatsapp.service');

exports.getStatus = (req, res) => {
    try {
        const status = whatsappService.getStatus();
        const qrCode = whatsappService.getQR();
        
        res.json({
            status: status,
            qrCode: qrCode,
            message: status === 'ready' ? 'WhatsApp connected' : 'Waiting for connection'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.restartService = async (req, res) => {
    try {
        // Simple re-init logic (might need more robust cleanup in service)
        whatsappService.initialize();
        res.json({ message: 'WhatsApp service restarting...' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
