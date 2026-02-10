const clientService = require('../../services/client.service');

const getClients = async (req, res) => {
    try {
        const clients = await clientService.getAllClients(req.query, req);
        res.json({ clients });
    } catch (error) {
        console.error('Error buscar clientes:', error);
        res.status(500).json({ error: 'Error al buscar clientes' });
    }
};

const getClientById = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await clientService.getClientById(id, req);
        if (!client) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json({ client });
    } catch (error) {
        console.error('Error obteniendo cliente:', error);
        res.status(500).json({ error: 'Error al obtener cliente' });
    }
};

const createClient = async (req, res) => {
    try {
        const client = await clientService.createClient(req.body, req);
        res.status(201).json({ message: 'Cliente creado', client });
    } catch (error) {
        console.error('Error creando cliente:', error);
        if (error.message.includes('Ya existe')) return res.status(400).json({ error: error.message });
        res.status(500).json({ error: 'Error al crear cliente' });
    }
};

const updateClient = async (req, res) => {
    try {
        const { id } = req.params;
        const client = await clientService.updateClient(id, req.body);
        res.json({ message: 'Cliente actualizado', client });
    } catch (error) {
        console.error('Error actualizando cliente:', error);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
};

const deleteClient = async (req, res) => {
    try {
        const { id } = req.params;
        await clientService.deleteClient(id);
        res.json({ message: 'Cliente eliminado' });
    } catch (error) {
        console.error('Error eliminando cliente:', error);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
};

module.exports = {
    getClients,
    getClientById,
    createClient,
    updateClient,
    deleteClient
};
