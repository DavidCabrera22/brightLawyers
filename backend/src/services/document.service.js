const prisma = require('../loaders/prisma');
const emailService = require('./email.service');

const createDocument = async (fileData, context) => {
    const { file, organizationId, userId, caseId, docCategory, notes, isConfidential } = context;

    // 1. Create generic Document record
    const document = await prisma.document.create({
      data: {
        organizationId,
        ownerUserId: userId,
        storageProvider: 'local',
        storageKey: file.path,
        fileName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        isConfidential: isConfidential !== undefined ? isConfidential : true
      }
    });

    // 2. Link to Case if provided
    if (caseId) {
       await prisma.documentLink.create({
         data: {
           organizationId,
           documentId: document.id,
           entityType: 'CASE',
           entityId: caseId,
           docCategory: docCategory || 'GRAL',
           notes: notes || null
         }
       });

       // --- NOTIFICATION: Email Lawyer & Stop Reminders ---
       try {
          const caseData = await prisma.case.findUnique({
              where: { id: caseId },
              include: {
                  assignments: {
                      include: {
                          user: true
                      }
                  }
              }
          });

          if (caseData) {
              // 1. Stop Reminder if active
              if (caseData.documentRequestActive) {
                  await prisma.case.update({
                      where: { id: caseId },
                      data: { documentRequestActive: false }
                  });
                  
                  // System Message: Stop Reminders
                  await prisma.caseMessage.create({
                      data: {
                          caseId: caseId,
                          senderRole: 'system',
                          messageText: `El cliente ha subido el documento "${document.fileName}". Los recordatorios automáticos se han desactivado.`,
                          isRead: false
                      }
                  });
              } else {
                   // System Message: Just notify upload
                   await prisma.caseMessage.create({
                      data: {
                          caseId: caseId,
                          senderRole: 'system',
                          messageText: `El cliente ha subido el documento "${document.fileName}".`,
                          isRead: false
                      }
                  });
              }

              // 2. Email Notification to Lawyers
              if (caseData.assignments.length > 0) {
                  const lawyers = caseData.assignments.map(a => a.user);
                  const subject = `📄 Nuevo documento cargado: Caso #${caseData.caseNumberInternal}`;
                  
                  for (const lawyer of lawyers) {
                      const html = `
                        <h3>Nuevo documento disponible</h3>
                        <p>Hola ${lawyer.fullName},</p>
                        <p>Se ha cargado un nuevo documento en el caso <strong>${caseData.title}</strong> (${caseData.caseNumberInternal}).</p>
                        <ul>
                            <li><strong>Archivo:</strong> ${document.fileName}</li>
                            <li><strong>Categoría:</strong> ${docCategory || 'General'}</li>
                            <li><strong>Fecha:</strong> ${new Date().toLocaleString()}</li>
                        </ul>
                        <p>Por favor revisa el documento en la plataforma para agilizar el proceso.</p>
                        <br>
                        <p>Atentamente,<br>Bright Lawyers Bot</p>
                      `;
                      
                      await emailService.sendEmail(lawyer.email, subject, html);
                  }
                  console.log(`📧 Notified ${lawyers.length} lawyers about new document ${document.id}`);
              }
          }
       } catch (error) {
           console.error('Error sending document notification:', error);
       }
       // ----------------------------------
    }

    return document;
};

const getAllDocuments = async (req) => {
    const { organizationId, userId, userRole: role } = req;
    const { search } = req.query || {};

    let where = {};

    // Role filtering for lawyers: Only show own docs or docs from assigned cases
    if (role === 'abogado' || role === 'lawyer' || role === 'support_lawyer') {
        // 1. Get IDs of cases assigned to this user
        const assignedCases = await prisma.case.findMany({
            where: {
                assignments: {
                    some: { assignedUserId: userId }
                }
            },
            select: { id: true }
        });
        
        let caseIds = assignedCases.map(c => c.id);

        // 3. Filter documents: Owned by user OR Linked to assigned cases
        // Note: We include linked documents even if organizationId might differ (though it shouldn't),
        // matching the behavior of Case Detail view.
        where.OR = [
            { organizationId, ownerUserId: userId },
            {
                links: {
                    some: {
                        entityType: 'CASE',
                        entityId: { in: caseIds }
                    }
                }
            }
        ];
    } else if (role === 'cliente') {
        // Client filtering
        const clientUser = await prisma.clientUser.findFirst({
            where: { userId: userId }
        });

        if (clientUser) {
             const clientCases = await prisma.case.findMany({
                where: { clientId: clientUser.clientId },
                select: { id: true }
             });
             const caseIds = clientCases.map(c => c.id);

             where.OR = [
                { organizationId, ownerUserId: userId },
                {
                    links: {
                        some: {
                            entityType: 'CASE',
                            entityId: { in: caseIds }
                        }
                    }
                    // Removed isConfidential: false to allow client to see all case docs for now
                    // In a real app, we should respect confidentiality but maybe default uploads to public
                }
             ];
        } else {
            // No client profile, no docs
            where.id = '00000000-0000-0000-0000-000000000000'; // Force empty
        }
    } else {
        // Default: Show all documents in organization
        where.organizationId = organizationId;
    }


    if (search) {
        const searchConditions = [
            { fileName: { contains: search, mode: 'insensitive' } },
            { links: { some: { notes: { contains: search, mode: 'insensitive' } } } },
            { links: { some: { docCategory: { contains: search, mode: 'insensitive' } } } }
        ];

        if (where.OR) {
            // If we already have permission filters, combine with search using AND
            where.AND = [
                { OR: [...where.OR] },
                { OR: searchConditions }
            ];
            delete where.OR;
        } else {
            where.OR = searchConditions;
        }
    }

    return await prisma.document.findMany({
        where,
        include: {
            links: {
                include: {
                    case: {
                        select: {
                            id: true,
                            title: true,
                            caseNumberInternal: true,
                            client: {
                                select: {
                                    id: true,
                                    fullNameOrBusinessName: true
                                }
                            }
                        }
                    }
                }
            },
            owner: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
};

const getDocumentById = async (id) => {
    return await prisma.document.findUnique({
        where: { id }
    });
};

module.exports = {
    createDocument,
    getDocumentById,
    getAllDocuments
};
