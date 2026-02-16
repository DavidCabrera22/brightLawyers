const prisma = require('../loaders/prisma');

const getAllPracticeAreas = async () => {
    return await prisma.practiceArea.findMany({
        orderBy: { name: 'asc' }
    });
};

const getPracticeAreaById = async (id) => {
    return await prisma.practiceArea.findUnique({
        where: { id }
    });
};

const createPracticeArea = async (data) => {
    return await prisma.practiceArea.create({
        data
    });
};

const updatePracticeArea = async (id, data) => {
    return await prisma.practiceArea.update({
        where: { id },
        data
    });
};

const deletePracticeArea = async (id) => {
    return await prisma.practiceArea.delete({
        where: { id }
    });
};

module.exports = {
    getAllPracticeAreas,
    getPracticeAreaById,
    createPracticeArea,
    updatePracticeArea,
    deletePracticeArea
};
