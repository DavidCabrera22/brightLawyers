const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../loaders/prisma');
const { logAudit } = require('../services/audit.service');

const registerUser = async (userData, req) => {
    const { name, email, password, phone, roleId, organizationId } = userData;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        throw new Error('El email ya está registrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let org;
    if (organizationId) {
        org = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (!org) throw new Error('Organización no válida');
    } else {
        org = await prisma.organization.findFirst();
        if (!org) throw new Error('Setup incompleto: No existe organización por defecto');
    }

    let finalRoleId;
    if (roleId) {
        const requestedRole = await prisma.role.findUnique({ where: { id: roleId } });
        if (!requestedRole) throw new Error('Rol no válido');
        finalRoleId = requestedRole.id;
    } else {
        const defaultRole = await prisma.role.findFirst({ where: { organizationId: org.id, name: 'abogado' } });
        if (!defaultRole) throw new Error('Error de configuración: No existe rol por defecto');
        finalRoleId = defaultRole.id;
    }

    const newUser = await prisma.user.create({
        data: {
            organizationId: org.id,
            fullName: name,
            email,
            passwordHash: hashedPassword,
            phone,
            status: 'active',
            userRoles: {
                create: { roleId: finalRoleId }
            }
        }
    });

    return newUser;
};

const loginUser = async (email, password, req) => {
    const user = await prisma.user.findUnique({
        where: { email },
        include: { userRoles: { include: { role: true } } }
    });

    if (!user || user.status !== 'active') {
        throw new Error('Credenciales inválidas o cuenta inactiva');
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
        throw new Error('Credenciales inválidas');
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
    });

    const priorityRoles = ['superadmin', 'admin', 'administrador', 'abogado', 'operator', 'operador'];
    const primaryRole = user.userRoles.find(ur => priorityRoles.includes(ur.role.name.toLowerCase()));
    const roleName = primaryRole ? primaryRole.role.name : (user.userRoles[0]?.role?.name || 'user');

    const token = jwt.sign(
        { 
            userId: user.id,
            email: user.email,
            role: roleName,
            organizationId: user.organizationId 
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );

    // Audit Log is handled in controller or here? 
    // Usually service focuses on business logic. 
    // But we need req context for audit logs usually (IP, Agent).
    // We passed req. 
    // Let's log here or in controller. Controller is safer for req access.
    // I'll return user and token, let controller log.
    
    return {
        token,
        user: {
            id: user.id,
            name: user.fullName,
            email: user.email,
            role: roleName,
            userRoles: user.userRoles,
            organizationId: user.organizationId
        }
    };
};

const getCurrentUser = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            userRoles: { include: { role: true } },
            organization: true 
        }
    });

    if (!user) return null;

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
};

module.exports = { registerUser, loginUser, getCurrentUser };
