const userService = require('../../services/user.service');
const fs = require('fs');
const path = require('path');

const getUsers = async (req, res) => {
    try {
        console.log('getUsers query:', req.query);
        const users = await userService.getAllUsers(req.query, req);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

const updateProfile = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const { phone, fullName } = req.body;
        
        // Basic validation
        if (!userId) return res.status(401).json({ error: 'No autorizado' });

        const updatedUser = await userService.updateUser(userId, {
            phone,
            fullName
        });

        res.json({ message: 'Perfil actualizado', user: updatedUser });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Error al actualizar perfil' });
    }
};

const uploadAvatar = async (req, res) => {
    try {
        const userId = req.userId;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ error: 'No se subió ninguna imagen' });
        }

        // Generate URL (assuming served statically from /uploads)
        // In auth-server.js, we don't see explicit static serving of uploads yet, but usually it is.
        // Or we need to add an endpoint to serve it.
        // Let's assume /uploads is static or we'll add it.
        const avatarUrl = `/uploads/${file.filename}`;

        const updatedUser = await userService.updateUser(userId, {
            avatarUrl
        });

        res.json({ message: 'Foto de perfil actualizada', avatarUrl });
    } catch (error) {
        console.error('Error uploading avatar:', error);
        res.status(500).json({ error: 'Error al subir imagen' });
    }
};

const createLawyer = async (req, res) => {
    try {
        const { organizationId, userRole } = req;
        // Verify admin role
        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'No autorizado. Se requiere rol de administrador.' });
        }

        const newUser = await userService.createLawyer(req.body, { organizationId });
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error creating lawyer:', error);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    getUsers,
    updateProfile,
    uploadAvatar,
    createLawyer
};