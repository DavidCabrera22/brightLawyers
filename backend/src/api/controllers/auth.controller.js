const { validationResult } = require('express-validator');
const authService = require('../../services/auth.service');
const { logAudit } = require('../../services/audit.service');

const register = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const newUser = await authService.registerUser(req.body, req);
        res.status(201).json({ message: 'Usuario registrado exitosamente', userId: newUser.id });
    } catch (error) {
        console.error('Error en registro:', error);
        if (error.message === 'El email ya está registrado') return res.status(400).json({ error: error.message });
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
};

const login = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const result = await authService.loginUser(email, password, req);

        // Log Audit
        req.organizationId = result.user.organizationId;
        req.userId = result.user.id;
        await logAudit(req, 'LOGIN', 'USER', result.user.id, { email });

        res.json({
            message: 'Login exitoso',
            token: result.token,
            user: result.user
        });
    } catch (error) {
        console.error('Error en login:', error);
        if (error.message.includes('Credenciales')) return res.status(401).json({ error: error.message });
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
};

const getMe = async (req, res) => {
    try {
        const user = await authService.getCurrentUser(req.userId);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json({ user });
    } catch (error) {
        console.error('Error obteniendo usuario:', error);
        res.status(500).json({ error: 'Error al obtener información del usuario' });
    }
};

module.exports = { register, login, getMe };
