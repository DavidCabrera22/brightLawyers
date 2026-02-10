const taskService = require('../../services/task.service');

const getTasks = async (req, res) => {
    try {
        const tasks = await taskService.getAllTasks(req.query, req);
        res.json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Error al obtener tareas' });
    }
};

const createTask = async (req, res) => {
    try {
        const task = await taskService.createTask(req.body, req);
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Error al crear tarea' });
    }
};

const updateTask = async (req, res) => {
    try {
        const { id } = req.params;
        const task = await taskService.updateTask(id, req.body);
        res.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Error al actualizar tarea' });
    }
};

const deleteTask = async (req, res) => {
    try {
        await taskService.deleteTask(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ error: 'Error al eliminar tarea' });
    }
};

module.exports = {
    getTasks,
    createTask,
    updateTask,
    deleteTask
};
