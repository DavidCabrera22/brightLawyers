const prisma = require('../loaders/prisma');

const getAllTasks = async (filters, user) => {
    const { status, caseId, search, assignedToUserId, upcoming, priority } = filters;
    const where = { organizationId: user.organizationId };
    
    // Role filtering for lawyers
    if (user.userRole === 'abogado' || user.userRole === 'support_lawyer') {
        where.OR = [
            { assignedToUserId: user.userId },
            { 
                case: { 
                    assignments: { 
                        some: { assignedUserId: user.userId } 
                    } 
                } 
            }
        ];
    }

    if (status) {
        if (status.includes(',')) {
            where.status = { in: status.split(',') };
        } else {
            where.status = status;
        }
    }
    
    if (priority) {
        if (priority.includes(',')) {
            where.priority = { in: priority.split(',') };
        } else {
            where.priority = priority;
        }
    }

    if (caseId) where.caseId = caseId;
    // If explicitly filtering by user, respect it but ensure it doesn't bypass role filter (though OR above handles visibility)
    if (assignedToUserId) {
        // If we already have an OR constraint for visibility, we need to be careful.
        // But usually assignedToUserId filter is to narrow down.
        // Simplest is to just add it to where, but with AND semantics implicit in top-level object.
        // However, Prisma top-level keys are ANDed.
        // If we have where.OR from role filter, adding where.assignedToUserId will mean:
        // (RoleVisibility) AND (assignedToUserId == X).
        // This is correct.
        where.assignedToUserId = assignedToUserId;
    }

    if (upcoming === 'true') {
        where.dueAt = {
            gte: new Date(),
            lte: new Date(new Date().setDate(new Date().getDate() + 7)) // Next 7 days
        };
    }
    
    if (search) {
        where.OR = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { assignedTo: { fullName: { contains: search, mode: 'insensitive' } } }
        ];
    }
    
    return await prisma.task.findMany({
        where,
        include: {
            case: { select: { title: true } },
            assignedTo: { select: { fullName: true, email: true } }
        },
        orderBy: { dueAt: 'asc' }
    });
};

const createTask = async (taskData, user) => {
    const { caseId, title, description, taskType, priority, assignedToUserId, dueAt } = taskData;
    
    const data = {
        title,
        description,
        taskType,
        priority: priority || 'med',
        dueAt: dueAt ? new Date(dueAt + 'T12:00:00') : null,
        organization: {
            connect: { id: user.organizationId }
        }
    };

    // Only connect case if caseId is provided
    if (caseId) {
        data.case = { connect: { id: caseId } };
    }

    // Only connect assignedTo if assignedToUserId is provided
    if (assignedToUserId) {
        data.assignedTo = { connect: { id: assignedToUserId } };
    }
    
    return await prisma.task.create({ data });
};

const updateTask = async (id, updateData) => {
    const { status, completedAt, title, description, priority, dueAt, taskType, caseId } = updateData;
    const data = {};
    if (status) data.status = status;
    if (completedAt) data.completedAt = new Date(completedAt);
    if (title) data.title = title;
    if (description) data.description = description;
    if (priority) data.priority = priority;
    if (taskType) data.taskType = taskType;
    if (dueAt) data.dueAt = new Date(dueAt + 'T12:00:00');
    
    // Handle case update
    if (caseId) {
        data.case = { connect: { id: caseId } };
    } else if (caseId === '') {
        // If explicitly empty string, disconnect
        data.case = { disconnect: true };
    }

    return await prisma.task.update({
        where: { id },
        data
    });
};

const deleteTask = async (id) => {
    return await prisma.task.delete({
        where: { id }
    });
};

module.exports = {
    getAllTasks,
    createTask,
    updateTask,
    deleteTask
};
