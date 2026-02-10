const prisma = require('../loaders/prisma');

const getAllContracts = async (req) => {
    const { organizationId, userRole, userId } = req;
    const { search } = req.query || {};

    const where = { organizationId };

    // Filter for clients
    if (userRole === 'client') {
        const clientUser = await prisma.clientUser.findFirst({
            where: { userId }
        });
        
        if (clientUser) {
            where.clientId = clientUser.clientId;
        } else {
            // If client user has no client profile, return empty
            return [];
        }
    }

    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { contractNumber: { contains: search, mode: 'insensitive' } }
        ];
        
        if (userRole !== 'client') {
             where.OR.push({ client: { fullNameOrBusinessName: { contains: search, mode: 'insensitive' } } });
        }
    }

    return await prisma.contract.findMany({
        where,
        include: { 
            client: true,
            versions: {
                orderBy: { versionNumber: 'desc' },
                take: 1,
                include: { document: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });
};

const createContract = async (contractData, user) => {
    let { 
        clientId, 
        contractNumber, 
        title, 
        contractValue, 
        practiceAreaId, 
        caseId,
        feeType,
        feePercentage,
        feeFixed
    } = contractData;

    // If caseId is provided but clientId is not, try to get clientId from the Case
    if (caseId && !clientId) {
        const linkedCase = await prisma.case.findUnique({
            where: { id: caseId },
            select: { clientId: true, practiceAreaId: true }
        });
        
        if (linkedCase) {
            clientId = linkedCase.clientId;
            // Also optional: infer practiceAreaId if not provided
            if (!practiceAreaId) {
                practiceAreaId = linkedCase.practiceAreaId;
            }
        }
    }

    if (!clientId) {
        throw new Error('El cliente es obligatorio para crear un contrato');
    }

    if (!contractNumber) {
        const lastContract = await prisma.contract.findFirst({
            where: { organizationId: user.organizationId },
            orderBy: { createdAt: 'desc' }
        });
        
        const year = new Date().getFullYear();
        let nextNum = 1;
        
        if (lastContract && lastContract.contractNumber && lastContract.contractNumber.startsWith(`CNT-${year}-`)) {
            const parts = lastContract.contractNumber.split('-');
            if (parts.length === 3) {
                const lastNum = parseInt(parts[2], 10);
                if (!isNaN(lastNum)) {
                    nextNum = lastNum + 1;
                }
            }
        }
        
        contractNumber = `CNT-${year}-${nextNum.toString().padStart(4, '0')}`;
    }

    return await prisma.contract.create({
        data: {
            organizationId: user.organizationId,
            clientId,
            caseId,
            contractNumber,
            title,
            contractValue: contractValue ? parseFloat(contractValue) : null,
            practiceAreaId,
            createdBy: user.userId,
            status: 'draft',
            feeType: feeType || 'FIXED',
            feePercentage: feePercentage ? parseFloat(feePercentage) : null,
            feeFixed: feeFixed ? parseFloat(feeFixed) : null
        }
    });
};

const addVersion = async (id, versionData) => {
    const { documentId } = versionData;
    
    const latestVersion = await prisma.contractVersion.findFirst({
        where: { contractId: id },
        orderBy: { versionNumber: 'desc' }
    });
    
    const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;
    
    return await prisma.contractVersion.create({
        data: {
            contractId: id,
            versionNumber,
            documentId
        }
    });
};

const addSigner = async (id, signerData) => {
    const { signerType, signerName, signerEmail, signerUserId } = signerData;
    
    return await prisma.contractSigner.create({
        data: {
            contractId: id,
            signerType,
            signerName,
            signerEmail,
            signerUserId: signerUserId || null,
            status: 'pending'
        }
    });
};

const updateContract = async (id, updateData) => {
    const { status } = updateData;
    const data = { ...updateData };
    
    if (status === 'signed') {
        data.signedAt = new Date();
    } else if (status && status !== 'signed') {
        data.signedAt = null;
    }

    return await prisma.contract.update({
        where: { id },
        data,
        include: {
            client: true,
            versions: {
                orderBy: { versionNumber: 'desc' },
                include: { document: true }
            },
            signers: true
        }
    });
};

const getContractById = async (id) => {
    return await prisma.contract.findUnique({
        where: { id },
        include: {
            client: true,
            versions: {
                orderBy: { versionNumber: 'desc' },
                include: { document: true }
            },
            signers: true
        }
    });
};

const deleteContract = async (id) => {
    return await prisma.contract.delete({
        where: { id }
    });
};

module.exports = {
    getAllContracts,
    createContract,
    getContractById,
    addVersion,
    addSigner,
    updateContract,
    deleteContract
};
