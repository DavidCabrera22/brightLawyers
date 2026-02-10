const messageService = require('../../services/message.service');
const emailService = require('../../services/email.service');

const getConversations = async (req, res) => {
    try {
        const conversations = await messageService.getConversations(
            req.userId,
            req.userRole,
            req.organizationId
        );
        res.json(conversations);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener conversaciones' });
    }
};

const getMessages = async (req, res) => {
    try {
        const { caseId } = req.params;
        const messages = await messageService.getMessages(
            caseId,
            req.userId,
            req.userRole,
            req.organizationId
        );
        res.json(messages);
    } catch (error) {
        console.error(error);
        res.status(403).json({ error: error.message || 'Error al obtener mensajes' });
    }
};

const createMessage = async (req, res) => {
    try {
        const { caseId, messageText } = req.body;
        const message = await messageService.createMessage(
            caseId,
            req.userId,
            req.userRole,
            messageText
        );
        
        // Emit to room
        if (req.io) {
            req.io.to(`case_${caseId}`).emit('new_message', message);
            
            // Emit to global notification channels
            // We need to notify the recipients so they see the badge/toast even if they are not in the case room
            // Ideally we emit to user_ID rooms.
            // We can reuse the recipients logic below or just fetch assignments/client.
            
            // Re-fetch recipients for socket (lightweight)
            try {
                const caseData = await messageService.getCaseRecipients(caseId);
                if (caseData) {
                    const recipientIds = [];
                    if (req.userRole === 'cliente') {
                        // Notify Lawyers
                        caseData.assignments.forEach(a => {
                            if (a.user) recipientIds.push(a.user.id); // Assuming user.id exists in assignments include
                            // Wait, getCaseRecipients in service only selected email/fullName. 
                            // Let's check service.
                        });
                    } else {
                        // Notify Client users
                        if (caseData.client && caseData.client.users) {
                             caseData.client.users.forEach(u => recipientIds.push(u.userId));
                        }
                    }

                    // Emit to each user room
                    recipientIds.forEach(uid => {
                         req.io.to(`user_${uid}`).emit('notification', {
                             type: 'message',
                             title: 'Nuevo Mensaje',
                             body: `Nuevo mensaje en caso ${caseData.caseNumberInternal || '...'}`,
                             data: { caseId: caseId, messageId: message.id }
                         });
                    });
                }
            } catch (e) { console.error('Socket notification error', e); }
        }

        // Email Notification Logic
        try {
            const caseData = await messageService.getCaseRecipients(caseId);
            if (caseData) {
                const recipients = [];
                // Determine Sender Name
                const senderName = req.userRole === 'cliente' 
                    ? (caseData.client ? caseData.client.fullNameOrBusinessName : 'Cliente')
                    : 'Su Abogado';

                if (req.userRole === 'cliente') {
                    // Notify Lawyers
                    caseData.assignments.forEach(a => {
                        if (a.user && a.user.email) recipients.push(a.user.email);
                    });
                } else {
                    // Notify Client
                    if (caseData.client && caseData.client.email) {
                        recipients.push(caseData.client.email);
                    }
                }

                if (recipients.length > 0) {
                    const subject = `Nuevo mensaje en caso: ${caseData.caseNumberInternal || caseData.title}`;
                    const html = `
                        <div style="font-family: Arial, sans-serif; color: #333;">
                            <h3>Nuevo mensaje de ${senderName}</h3>
                            <p><strong>Caso:</strong> ${caseData.title}</p>
                            <p><strong>Mensaje:</strong></p>
                            <blockquote style="background: #f9f9f9; padding: 15px; border-left: 4px solid #1e3a8a; margin: 10px 0;">
                                ${messageText}
                            </blockquote>
                            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                                Este es un mensaje automático de la plataforma BrightLawyers. Por favor no responder a este correo.
                            </p>
                        </div>
                    `;
                    
                    // Send to all recipients
                    for (const email of recipients) {
                        emailService.sendEmail(email, subject, html);
                    }
                }
            }
        } catch (emailErr) {
            console.error('Error sending email notifications:', emailErr);
            // Don't fail the request if email fails
        }
        
        res.status(201).json(message);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
};

const getUnreadCount = async (req, res) => {
    try {
        const result = await messageService.getUnreadCount(
            req.userId,
            req.userRole,
            req.organizationId
        );
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener conteo' });
    }
};

const markAsRead = async (req, res) => {
    try {
        const { caseId } = req.body;
        await messageService.markMessagesAsRead(
            caseId,
            req.userId,
            req.userRole
        );
        
        // Emit event to update badges in real-time across all devices/tabs
        if (req.io) {
            req.io.to(`user_${req.userId}`).emit('messages_read', { caseId });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al marcar leídos' });
    }
};

module.exports = {
    getConversations,
    getMessages,
    createMessage,
    getUnreadCount,
    markAsRead
};
