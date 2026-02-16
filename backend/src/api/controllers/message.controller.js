const messageService = require('../../services/message.service');
const emailService = require('../../services/email.service');
const prisma = require('../../loaders/prisma');

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
        
        // Emit to room (active case view)
        if (req.io) {
            req.io.to(`case_${caseId}`).emit('new_message', message);
        }

        // --- Notification Logic (Socket, Email, WhatsApp) ---
        try {
            // Fetch case data once for all notifications
            const caseData = await messageService.getCaseRecipients(caseId);
            
            if (caseData) {
                const senderName = req.userRole === 'cliente' 
                    ? (caseData.client ? caseData.client.fullNameOrBusinessName : 'Cliente')
                    : 'Su Abogado';

                const recipientIds = [];
                const recipientEmails = [];

                if (req.userRole === 'cliente') {
                    // Notify Lawyers
                    if (caseData.assignments) {
                        caseData.assignments.forEach(a => {
                            if (a.user) {
                                recipientIds.push(a.user.id);
                                if (a.user.email) recipientEmails.push(a.user.email);
                            }
                        });
                    }
                } else {
                    // Notify Client
                    if (caseData.client) {
                        if (caseData.client.users) {
                            caseData.client.users.forEach(u => recipientIds.push(u.userId));
                        }
                        if (caseData.client.email) {
                            recipientEmails.push(caseData.client.email);
                        }
                    }
                }

                // 1. Socket Notification (Toasts/Badges)
                if (req.io) {
                    recipientIds.forEach(uid => {
                         req.io.to(`user_${uid}`).emit('notification', {
                             type: 'message',
                             title: 'Nuevo Mensaje',
                             body: `Nuevo mensaje en caso ${caseData.caseNumberInternal || '...'}`,
                             data: { caseId: caseId, messageId: message.id }
                         });
                    });
                }

                // 2. Email Notification
                if (recipientEmails.length > 0) {
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
                    for (const email of recipientEmails) {
                        // Avoid await inside loop for email to not block response too much, 
                        // but here we are already after message creation, so it's fine.
                        // Or use Promise.all
                        emailService.sendEmail(email, subject, html).catch(err => console.error('Email error:', err));
                    }
                }

                // 3. WhatsApp Notification (via Alert table)
                for (const uid of recipientIds) {
                    await prisma.alert.create({
                        data: {
                            organizationId: caseData.organizationId,
                            caseId: parseInt(caseId),
                            recipientUserId: uid,
                            alertType: 'new_message',
                            channel: 'whatsapp',
                            scheduledAt: new Date(),
                            status: 'pending',
                            payload: {
                                originalMessage: messageText,
                                senderName: senderName,
                                caseTitle: caseData.title
                            }
                        }
                    }).catch(err => console.error('WhatsApp alert creation error:', err));
                }
            }
        } catch (notifError) {
            console.error('Error sending notifications:', notifError);
            // Don't fail the request if notifications fail
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
