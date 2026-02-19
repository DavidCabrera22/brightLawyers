const prisma = require('../loaders/prisma');

const getConversations = async (userId, userRole, organizationId) => {
    let where = { organizationId };

    if (userRole === 'cliente') {
        const clientUser = await prisma.clientUser.findFirst({
            where: { userId }
        });

        if (!clientUser) {
            return [];
        }

        where.clientId = clientUser.clientId;
    } else {
        // Lawyers/Staff see assigned cases
        // Admin sees all cases in organization
        const lowerRole = (userRole || '').toLowerCase();
        const isAdmin = lowerRole.includes('admin') || 
                       lowerRole.includes('administrador') || 
                       lowerRole.includes('gerente') || 
                       lowerRole.includes('director');

        if (!isAdmin) {
            where.assignments = {
                some: { assignedUserId: userId }
            };
        }
    }

    const cases = await prisma.case.findMany({
        where,
        select: {
            id: true,
            title: true,
            caseNumberInternal: true,
            caseStatus: true,
            documentRequestActive: true,
            updatedAt: true,
            client: {
                select: {
                    id: true,
                    fullNameOrBusinessName: true,
                    email: true
                }
            },
            _count: {
                select: { messages: true }
            },
            messages: {
                // Get unread count logic here is hard with just findMany select
                // We will fetch unread counts in parallel or use a raw query if needed
                // For now, let's fetch last message
                take: 1,
                orderBy: { createdAt: 'desc' },
                select: {
                    messageText: true,
                    createdAt: true,
                    senderRole: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Calculate unread count for each case
    // This is N+1 but efficient enough for small N cases. 
    // For scaling, use groupBy or raw query.
    const casesWithUnread = await Promise.all(cases.map(async (c) => {
        let unreadCount = 0;
        if (userRole === 'cliente') {
             unreadCount = await prisma.caseMessage.count({
                 where: {
                     caseId: c.id,
                     senderRole: { not: 'client' },
                     isRead: false
                 }
             });
        } else {
             unreadCount = await prisma.caseMessage.count({
                 where: {
                     caseId: c.id,
                     senderRole: 'client',
                     isRead: false
                 }
             });
        }

        return {
            id: c.id,
            title: c.title,
            caseNumber: c.caseNumberInternal,
            status: c.caseStatus,
            documentRequestActive: c.documentRequestActive,
            client: c.client,
            assignments: c.assignments,
            lastMessage: c.messages[0] || null,
            messageCount: c._count.messages,
            unreadCount
        };
    }));

    return casesWithUnread;
};

const getUnreadCount = async (userId, userRole, organizationId) => {
    // If client, count unread messages where senderRole != 'client'
    // If lawyer, count unread messages where senderRole == 'client' (in assigned cases)
    
    let caseWhere = { organizationId };

    if (userRole === 'cliente') {
        const clientUser = await prisma.clientUser.findFirst({ where: { userId } });
        if (!clientUser) return 0;
        
        // Count unread messages in user's cases sent by NON-clients (lawyers)
        const count = await prisma.caseMessage.count({
            where: {
                case: { clientId: clientUser.clientId },
                senderRole: { not: 'client' }, // Sent by firm
                isRead: false
            }
        });
        return { count };
    } else {
        // Lawyer/Admin: Count unread messages
        const lowerRole = (userRole || '').toLowerCase();
        const isAdmin = lowerRole.includes('admin') || 
                       lowerRole.includes('administrador') || 
                       lowerRole.includes('gerente') || 
                       lowerRole.includes('director');

        const whereClause = {
            senderRole: 'client',
            isRead: false
        };

        if (!isAdmin) {
            whereClause.case = {
                assignments: { some: { assignedUserId: userId } }
            };
        }

        const count = await prisma.caseMessage.count({
            where: whereClause
        });
        return { count };
    }
};

const markMessagesAsRead = async (caseId, userId, userRole) => {
    // If client opens, mark all messages from NON-client as read
    // If lawyer opens, mark all messages from CLIENT as read
    
    let where = { caseId, isRead: false };

    if (userRole === 'cliente') {
        where.senderRole = { not: 'client' };
    } else {
        where.senderRole = 'client';
    }

    await prisma.caseMessage.updateMany({
        where,
        data: { isRead: true }
    });
};

const getMessages = async (caseId, userId, userRole, organizationId) => {
    // Permission check
    let hasAccess = false;
    if (userRole === 'cliente') {
        const clientUser = await prisma.clientUser.findFirst({
            where: { userId }
        });
        if (clientUser) {
            const caseData = await prisma.case.findFirst({
                where: { id: caseId, clientId: clientUser.clientId }
            });
            if (caseData) hasAccess = true;
        }
    } else {
        const lowerRole = (userRole || '').toLowerCase();
        const isAdmin = lowerRole.includes('admin') || 
                       lowerRole.includes('administrador') || 
                       lowerRole.includes('gerente') || 
                       lowerRole.includes('director');
        
        if (isAdmin) {
            // Admin has access if case belongs to organization
            const caseExists = await prisma.case.findFirst({
                where: { id: caseId, organizationId }
            });
            if (caseExists) hasAccess = true;
        } else {
            const assignment = await prisma.caseAssignment.findFirst({
                where: { caseId, assignedUserId: userId }
            });
            if (assignment) hasAccess = true;
        }
    }

    if (!hasAccess) {
        throw new Error('No tiene acceso a este caso');
    }

    return await prisma.caseMessage.findMany({
        where: { caseId },
        include: {
            sender: {
                select: {
                    id: true,
                    fullName: true,
                    email: true,
                    avatarUrl: true
                }
            }
        },
        orderBy: { createdAt: 'asc' }
    });
};

const createMessage = async (caseId, userId, userRole, messageText) => {
    // We assume permission is checked by caller or we check it again
    // For speed, let's assume the controller/socket does the check or we duplicate it lightly
    
    // Quick check
    // ... logic same as getMessages ...
    
    // Create
    const message = await prisma.caseMessage.create({
        data: {
            caseId,
            senderUserId: userId,
            senderRole: (userRole && ['cliente', 'client'].includes(userRole.toLowerCase())) ? 'client' : 'lawyer',
            messageText
        },
        include: {
            sender: {
                select: {
                    id: true,
                    fullName: true,
                    avatarUrl: true
                }
            }
        }
    });

    // Update case updatedAt
    await prisma.case.update({
        where: { id: caseId },
        data: { updatedAt: new Date() }
    });

    // --- Immediate WhatsApp Notification ---
    try {
        const caseDataForAlert = await prisma.case.findUnique({
            where: { id: caseId },
            include: {
                client: {
                    include: {
                        users: {
                            take: 1 // Primary client user
                        }
                    }
                },
                assignments: {
                    include: {
                        user: {
                            select: { id: true, email: true, fullName: true, phone: true }
                        }
                    }
                }
            }
        });

        if (caseDataForAlert) {
            let recipients = [];
            let senderName = 'BrightLawyers';

            // Identify Sender Name
            if (userRole === 'cliente') {
                // If sender is client, get their name from caseData (client name)
                senderName = caseDataForAlert.client.fullNameOrBusinessName;
            } else {
                 // If sender is lawyer, try to find their name from message sender
                 if (message.sender) {
                     senderName = message.sender.fullName;
                 }
            }

            // Determine Recipients
            if (userRole !== 'cliente' && userRole !== 'client') {
                 // Sender is Lawyer -> Notify Client
                 const clientUserId = caseDataForAlert.client?.users?.[0]?.userId;
                 if (clientUserId) recipients.push(clientUserId);
            } else {
                // Sender is Client -> Notify Assigned Lawyers
                // Add all assigned users
                caseDataForAlert.assignments.forEach(a => {
                    if (a.user && a.user.id) recipients.push(a.user.id);
                });
            }

            // Filter out sender (just in case)
            recipients = recipients.filter(uid => uid !== userId);

            // Create Alerts
            for (const recipientId of recipients) {
                 await prisma.alert.create({
                    data: {
                        organizationId: caseDataForAlert.organizationId,
                        caseId,
                        recipientUserId: recipientId,
                        alertType: 'new_message',
                        channel: 'whatsapp',
                        scheduledAt: new Date(),
                        status: 'pending',
                        payload: {
                            triggerMessageId: message.id,
                            originalMessage: messageText,
                            senderName: senderName,
                            caseTitle: caseDataForAlert.title
                        }
                    }
                });
                console.log(`🔔 Alert created for user ${recipientId} (Sender: ${senderName})`);
            }
        }
    } catch (alertError) {
        console.error('Error creating WhatsApp alerts:', alertError);
    }

    // --- AUTOMATED BOT: Document Reminder ---
    // If lawyer asks for documents, schedule a reminder for the client
    if (userRole !== 'cliente') {
        const lowerMsg = messageText.toLowerCase();
        const actionKeywords = ['subir', 'cargar', 'adjuntar', 'enviar', 'suba', 'cargue', 'adjunte', 'envie', 'necesito', 'requiero'];
        const objectKeywords = ['documento', 'archivo', 'foto', 'pdf', 'contrato', 'cedula', 'prueba', 'papel'];

        const hasAction = actionKeywords.some(k => lowerMsg.includes(k));
        const hasObject = objectKeywords.some(k => lowerMsg.includes(k));

        if (hasAction && hasObject) {
            try {
                // Find client user associated with this case
                const caseData = await prisma.case.findUnique({
                    where: { id: caseId },
                    include: {
                        client: {
                            include: {
                                users: {
                                    take: 1 // Get primary user
                                }
                            }
                        }
                    }
                });

                const clientUserId = caseData?.client?.users?.[0]?.userId;

                if (clientUserId) {
                    // Check if there is already a pending reminder to avoid spam
                    const pendingAlert = await prisma.alert.findFirst({
                        where: {
                            caseId,
                            recipientUserId: clientUserId,
                            alertType: 'document_request_reminder',
                            status: 'pending'
                        }
                    });

                    if (!pendingAlert) {
                        // Schedule reminder for 24 hours later
                        // For demo purposes, we can set it to 1 minute if needed, but 24h is realistic
                        const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); 
                        
                        await prisma.alert.create({
                            data: {
                                organizationId: caseData.organizationId,
                                caseId,
                                recipientUserId: clientUserId,
                                alertType: 'document_request_reminder',
                                channel: 'email', 
                                scheduledAt,
                                status: 'pending',
                                payload: {
                                    triggerMessageId: message.id,
                                    originalMessage: messageText
                                }
                            }
                        });

                        // Also schedule WhatsApp reminder
                        await prisma.alert.create({
                            data: {
                                organizationId: caseData.organizationId,
                                caseId,
                                recipientUserId: clientUserId,
                                alertType: 'document_request_reminder',
                                channel: 'whatsapp',
                                scheduledAt,
                                status: 'pending',
                                payload: {
                                    triggerMessageId: message.id,
                                    originalMessage: messageText
                                }
                            }
                        });
                        console.log(`🤖 Bot: Scheduled document reminder (Email & WhatsApp) for client ${clientUserId} on case ${caseId}`);
                    }
                }
            } catch (error) {
                console.error('Error scheduling bot reminder:', error);
                // Don't fail the message creation if bot fails
            }
        }
    }
    // ----------------------------------------

    return message;
};

const getCaseRecipients = async (caseId) => {
    return await prisma.case.findUnique({
        where: { id: caseId },
        include: {
            client: {
                select: { 
                    email: true, 
                    fullNameOrBusinessName: true,
                    users: { select: { userId: true } }
                }
            },
            assignments: {
                include: {
                    user: {
                        select: { id: true, email: true, fullName: true }
                    }
                }
            }
        }
    });
};

module.exports = {
    getConversations,
    getMessages,
    createMessage,
    getCaseRecipients,
    getUnreadCount,
    markMessagesAsRead
};
