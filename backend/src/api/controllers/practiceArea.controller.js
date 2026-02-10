const practiceAreaService = require('../../services/practiceArea.service');

const getPracticeAreas = async (req, res) => {
    try {
        const areas = await practiceAreaService.getAllPracticeAreas();
        res.json(areas);
    } catch (error) {
        console.error('Error fetching practice areas:', error);
        res.status(500).json({ error: 'Error al obtener áreas de práctica' });
    }
};

const getPracticeArea = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await practiceAreaService.getPracticeAreaById(id);
        if (!area) {
            return res.status(404).json({ error: 'Área de práctica no encontrada' });
        }
        res.json(area);
    } catch (error) {
        console.error('Error fetching practice area:', error);
        res.status(500).json({ error: 'Error al obtener el área de práctica' });
    }
};

const createPracticeArea = async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        const area = await practiceAreaService.createPracticeArea({
            name,
            description,
            organizationId: req.organizationId
        });
        res.status(201).json(area);
    } catch (error) {
        console.error('Error creating practice area:', error);
        res.status(500).json({ error: 'Error al crear el área de práctica' });
    }
};

const updatePracticeArea = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        const area = await practiceAreaService.updatePracticeArea(id, { name, description });
        res.json(area);
    } catch (error) {
        console.error('Error updating practice area:', error);
        res.status(500).json({ error: 'Error al actualizar el área de práctica' });
    }
};

const deletePracticeArea = async (req, res) => {
    try {
        const { id } = req.params;
        await practiceAreaService.deletePracticeArea(id);
        res.json({ message: 'Área de práctica eliminada correctamente' });
    } catch (error) {
        console.error('Error deleting practice area:', error);
        res.status(500).json({ error: 'Error al eliminar el área de práctica' });
    }
};

module.exports = {
    getPracticeAreas,
    getPracticeArea,
    createPracticeArea,
    updatePracticeArea,
    deletePracticeArea
};
