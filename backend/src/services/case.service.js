const prisma = require('../loaders/prisma');
const contractService = require('./contract.service');

const getAllCases = async (filters, user) => {
    const { status, search } = filters;
    let where = { organizationId: user.organizationId };

    // Role filtering
    if (user.userRole === 'abogado' || user.userRole === 'support_lawyer') {
        // Lawyers can ONLY see cases assigned to them
        where.assignments = { some: { assignedUserId: user.userId } };
    }

    // Status filtering
    if (status && status !== 'all') {
        where.caseStatus = status;
    }

    // Search filtering
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { caseNumberInternal: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { client: { fullNameOrBusinessName: { contains: search, mode: 'insensitive' } } }
        ];
    }
    
    // Client filtering: If I am a client, only show cases where I am the client
    // Note: This relies on linking the User to the Client entity via ClientUser table
    if (user.userRole === 'cliente') {
        const clientUser = await prisma.clientUser.findFirst({
            where: { userId: user.userId }
        });

        if (clientUser) {
            where.clientId = clientUser.clientId;
        } else {
            // If no client link found, show no cases
            return [];
        }
    }

    const cases = await prisma.case.findMany({

        where,
        include: {
            client: true,
            practiceArea: true,
            creator: { select: { fullName: true, email: true } },
            assignments: { include: { user: { select: { fullName: true, id: true } } } }
        },
        orderBy: { createdAt: 'desc' }
    });

    return cases;
};

const getCaseById = async (id, user) => {
    return await prisma.case.findUnique({
        where: { id },
        include: {
            client: true,
            practiceArea: true,
            creator: { select: { fullName: true, email: true } },
            assignments: { include: { user: { select: { fullName: true } } } },
            documents: {
                include: {
                    document: true
                }
            }
        }
    });
};

const getOpportunityCases = async (user) => {
    // Lawyers should NOT see unassigned cases anymore (Admin assigns them)
    if (user.userRole === 'abogado' || user.userRole === 'support_lawyer') {
        return [];
    }

    // 1. Get lawyer's practice areas
    const profile = await prisma.lawyerProfile.findUnique({
        where: { userId: user.userId },
        include: { practices: true }
    });

    if (!profile || !profile.practices.length) {
        return [];
    }

    const practiceAreaIds = profile.practices.map(p => p.practiceAreaId);

    // 2. Find cases with status 'intake' in those areas, NOT assigned to this user
    return await prisma.case.findMany({
        where: {
            organizationId: user.organizationId,
            caseStatus: 'intake',
            practiceAreaId: { in: practiceAreaIds },
            assignments: {
                none: { assignedUserId: user.userId }
            }
        },
        include: {
            client: true,
            practiceArea: true
        },
        orderBy: { createdAt: 'desc' }
    });
};

const createCase = async (caseData, user) => {
    const { 
        clientId, 
        practiceAreaId, 
        title, 
        description, 
        confidentialityLevel 
    } = caseData;

    let finalClientId = clientId;

    // If user is client, ensure they can only create cases for themselves
    if (user.userRole === 'cliente') {
        const clientUser = await prisma.clientUser.findFirst({
            where: { userId: user.userId }
        });

        if (!clientUser) {
            throw new Error('Usuario no asociado a un perfil de cliente');
        }
        finalClientId = clientUser.clientId;
    }

    // Generate internal number
    const count = await prisma.case.count({ where: { organizationId: user.organizationId } });
    const year = new Date().getFullYear();
    const caseNumberInternal = `JUDGE-${year}-${(count + 1).toString().padStart(4, '0')}`;

    const newCase = await prisma.case.create({
        data: {
            organizationId: user.organizationId,
            clientId: finalClientId,
            practiceAreaId,
            caseNumberInternal,
            title,
            description,
            confidentialityLevel: confidentialityLevel || 'normal',
            createdBy: user.userId,
            caseStatus: 'intake'
        }
    });

    // --- Welcome Bot Message ---
    try {
        await prisma.caseMessage.create({
            data: {
                caseId: newCase.id,
                senderRole: 'system',
                messageText: '¡Bienvenido! Hemos creado su caso exitosamente. Por favor, esté atento a las solicitudes de documentos de su abogado.',
                isRead: false
            }
        });
    } catch (error) {
        console.error('Error creating welcome message:', error);
    }

    return newCase;
};

const updateCase = async (id, updateData) => {
    return await prisma.case.update({
        where: { id },
        data: updateData
    });
};

// --- Sub-resources ---

const addTimelineEvent = async (id, eventData, userId) => {
    return await prisma.caseTimelineEvent.create({
        data: {
            caseId: id,
            ...eventData,
            createdBy: userId
        }
    });
};

const getTimeline = async (id) => {
    return await prisma.caseTimelineEvent.findMany({
        where: { caseId: id },
        include: {
            stage: true,
            creator: { select: { fullName: true } }, 
            document: { select: { fileName: true } }
        },
        orderBy: { eventDate: 'desc' }
    });
};

const addNote = async (id, noteData, userId) => {
  return await prisma.caseNote.create({
    data: {
      caseId: id,
      authorUserId: userId,
      visibility: noteData.visibility || 'internal',
      ...noteData
    }
  });
};

const getNotes = async (id) => {
    return await prisma.caseNote.findMany({
        where: { caseId: id },
        include: { author: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' }
    });
};



const addMessage = async (id, messageData, userId) => {
    return await prisma.caseMessage.create({
        data: {
            caseId: id,
            senderUserId: userId,
            ...messageData
        }
    });
};

const getMessages = async (id) => {
    return await prisma.caseMessage.findMany({
        where: { caseId: id },
        include: { sender: { select: { fullName: true } } },
        orderBy: { createdAt: 'asc' }
    });
};

const getCaseDocuments = async (caseId) => {
    return await prisma.document.findMany({
        where: {
            links: {
                some: {
                    entityType: 'CASE',
                    entityId: caseId
                }
            }
        },
        include: {
            links: true
        },
        orderBy: { createdAt: 'desc' }
    });
};

const assignCaseToUser = async (caseId, userId, role = 'LEAD_LAWYER') => {
    let caseDataForContract = null;

    // 1. Transaction to ensure concurrency safety
    const assignment = await prisma.$transaction(async (tx) => {
        // 1.1 Check current state (lock implicitly by reading, though Prisma optimistic requires versioning or careful checks)
        // Here we rely on "assignments" check.
        const currentCase = await tx.case.findUnique({
            where: { id: caseId },
            include: { assignments: true }
        });

        if (!currentCase) throw new Error('Caso no encontrado');

        // 1.2 Check if already assigned
        if (currentCase.assignments.length > 0) {
            // Check if I'm already assigned (idempotency)
            const isMe = currentCase.assignments.some(a => a.assignedUserId === userId);
            if (isMe) return currentCase.assignments.find(a => a.assignedUserId === userId);
            
            throw new Error('Este caso ya ha sido tomado por otro abogado.');
        }

        // 1.3 Create assignment
        const assignment = await tx.caseAssignment.create({
            data: {
                caseId,
                assignedUserId: userId,
                assignmentRole: role,
                isPrimary: true
            }
        });

        // 1.4 Update case status
        await tx.case.update({
            where: { id: caseId },
            data: { caseStatus: 'active' }
        });

        caseDataForContract = currentCase;
        return assignment;
    });

    // 2. Auto-generate contract
    if (caseDataForContract) {
        try {
            await contractService.createContract({
                caseId: caseId,
                title: `Contrato - ${caseDataForContract.caseNumberInternal}`,
                contractValue: 0,
                feeType: 'FIXED',
                feeFixed: 0
            }, { 
                organizationId: caseDataForContract.organizationId, 
                userId: userId 
            });
        } catch (error) {
            console.error('Error generating automatic contract:', error);
            // Non-blocking error
        }
    }

    return assignment;
};

const getRecentActivity = async (user) => {
    // 1. Get IDs of cases assigned to this user
    const assignedCases = await prisma.case.findMany({
        where: {
            organizationId: user.organizationId,
            assignments: {
                some: { assignedUserId: user.userId }
            }
        },
        select: { id: true }
    });
    
    const caseIds = assignedCases.map(c => c.id);

    // 2. Get timeline events for these cases
    return await prisma.caseTimelineEvent.findMany({
        where: {
            caseId: { in: caseIds }
        },
        include: {
            case: { select: { title: true, caseNumberInternal: true } },
            stage: true,
            creator: { select: { fullName: true } }
        },
        orderBy: { eventDate: 'desc' },
        take: 10
    });
};

const toggleDocumentRequest = async (id, active) => {
    const updatedCase = await prisma.case.update({
        where: { id },
        data: { documentRequestActive: active }
    });

    if (active) {
        // Send immediate system message
        await prisma.caseMessage.create({
            data: {
                caseId: id,
                senderRole: 'system',
                messageText: 'Solicitud de documentos activada. Le enviaremos recordatorios automáticos al cliente hasta que suba los archivos.',
                isRead: false
            }
        });
        // Also send message to Client so they know
        await prisma.caseMessage.create({
            data: {
                caseId: id,
                senderRole: 'system',
                messageText: 'Su abogado ha solicitado que suba documentos. Por favor, hágalo lo antes posible para evitar retrasos.',
                isRead: false
            }
        });
    } else {
        await prisma.caseMessage.create({
            data: {
                caseId: id,
                senderRole: 'system',
                messageText: 'Solicitud de documentos desactivada manualmente.',
                isRead: false
            }
        });
    }

    return updatedCase;
};

const deleteCase = async (id) => {
    // 1. Delete DocumentLinks manually (Polymorphic relation workaround)
    await prisma.documentLink.deleteMany({
        where: {
            entityType: 'CASE',
            entityId: id
        }
    });

    // 2. Unlink Contracts (Set caseId to null)
    await prisma.contract.updateMany({
        where: { caseId: id },
        data: { caseId: null }
    });

    // 3. Delete Case (Cascade will handle Parties, Assignments, Timeline, Tasks, Alerts, Notes, Messages)
    return await prisma.case.delete({
        where: { id }
    });
};

module.exports = {
    getAllCases,
    getCaseById,
    getOpportunityCases,
    getRecentActivity,
    createCase,
    updateCase,
    addTimelineEvent,
    getTimeline,
    addNote,
    getNotes,
    addMessage,
    getMessages,
    getCaseDocuments,
    assignCaseToUser,
    toggleDocumentRequest,
    deleteCase
};
