const prisma = require('../loaders/prisma');

const getAllClients = async (filters, user) => {
    const { search } = filters;
    let where = { organizationId: user.organizationId };

    if (search) {
        where.OR = [
            { fullNameOrBusinessName: { contains: search, mode: 'insensitive' } },
            { documentNumber: { contains: search } }
        ];
    }

    return await prisma.client.findMany({
        where,
        orderBy: { fullNameOrBusinessName: 'asc' }
    });
};

const getClientById = async (id, user) => {
    return await prisma.client.findUnique({
        where: { id },
        include: {
            cases: {
                select: {
                    id: true,
                    title: true,
                    caseNumberInternal: true,
                    caseStatus: true,
                    openedAt: true,
                    practiceArea: { select: { name: true } }
                },
                orderBy: { openedAt: 'desc' }
            }
        }
    });
};

const createClient = async (clientData, user) => {
    const { 
        clientType, 
        fullNameOrBusinessName, 
        documentType, 
        documentNumber, 
        email, 
        phone, 
        address 
    } = clientData;

    // Check duplicate document number within organization
    if (documentNumber) {
        const existing = await prisma.client.findFirst({
            where: { 
                documentNumber,
                organizationId: user.organizationId 
            }
        });
        if (existing) {
            throw new Error('Ya existe un cliente con este documento en su organización');
        }
    }

    return await prisma.client.create({
        data: {
            organizationId: user.organizationId,
            clientType: clientType || 'PERSON',
            fullNameOrBusinessName,
            documentType,
            documentNumber,
            email,
            phone,
            address
        }
    });
};

const updateClient = async (id, updateData) => {
    return await prisma.client.update({
        where: { id },
        data: updateData
    });
};

const deleteClient = async (id) => {
    return await prisma.client.delete({
        where: { id }
    });
};

module.exports = {
    getAllClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};
