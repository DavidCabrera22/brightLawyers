const prisma = require('../loaders/prisma');

const getAllUsers = async (filters, contextUser) => {
    const { search, role } = filters;
    const { organizationId } = contextUser;

    const where = { organizationId };

    if (role) {
        const roles = role.split(',').map(r => r.trim());
        where.userRoles = {
            some: {
                role: {
                    name: { in: roles }
                }
            }
        };
    }

    if (search) {
        where.OR = [
            { fullName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } }
        ];
    }

    return await prisma.user.findMany({
        where,
        include: {
            userRoles: {
                include: { role: true }
            },
            profile: {
                include: {
                    practices: {
                        include: {
                            practiceArea: true
                        }
                    }
                }
            }
        },
        orderBy: { fullName: 'asc' }
    });
};

const updateUser = async (userId, data) => {
    return await prisma.user.update({
        where: { id: userId },
        data
    });
};

const bcrypt = require('bcryptjs');

const createLawyer = async (data, contextUser) => {
    const { 
        fullName, email, password, phone, 
        professionalCardNumber, professionalCardCountry, 
        yearsExperience, hourlyRate, bio, practiceAreaIds 
    } = data;
    const { organizationId } = contextUser;

    // Check if email exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Get Lawyer Role ID
    const lawyerRole = await prisma.role.findFirst({ 
        where: { organizationId, name: 'abogado' } 
    });
    
    if (!lawyerRole) throw new Error('Rol de abogado no configurado en la organización');

    // Transaction to create User, Role assigment, and Profile
    return await prisma.$transaction(async (tx) => {
        // 1. Create User
        const user = await tx.user.create({
            data: {
                organizationId,
                fullName,
                email,
                passwordHash: hashedPassword,
                phone,
                status: 'active',
                userRoles: {
                    create: { roleId: lawyerRole.id }
                }
            }
        });

        // 2. Create Lawyer Profile
        const profile = await tx.lawyerProfile.create({
            data: {
                organizationId,
                userId: user.id,
                professionalCardNumber,
                professionalCardCountry,
                yearsExperience: parseInt(yearsExperience) || 0,
                hourlyRate: parseFloat(hourlyRate) || 0,
                bio,
                availabilityStatus: 'available'
            }
        });

        // 3. Assign Practice Areas
        if (practiceAreaIds && practiceAreaIds.length > 0) {
            await tx.lawyerPracticeArea.createMany({
                data: practiceAreaIds.map(areaId => ({
                    lawyerProfileId: profile.id,
                    practiceAreaId: areaId,
                    level: 'senior' // Default level
                }))
            });
        }

        return user;
    });
};

module.exports = {
    getAllUsers,
    updateUser,
    createLawyer
};