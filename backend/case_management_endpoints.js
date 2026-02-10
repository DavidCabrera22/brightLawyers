// Case Management Endpoints - To be integrated into auth-server.js

/**
 * @swagger
 * /api/cases/{id}/assignments:
 *   post:
 *     summary: Asignar usuario al caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [assignedUserId, assignmentRole]
 *             properties:
 *               assignedUserId: { type: string, format: uuid }
 *               assignmentRole: { type: string, enum: [LEAD_LAWYER, SUPPORT_LAWYER, OPERATOR, PARALEGAL, COMMERCIAL] }
 *               isPrimary: { type: boolean }
 *     responses:
 *       201:
 *         description: Asignación creada
 *   get:
 *     summary: Listar asignaciones del caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de asignaciones
 */
app.post('/api/cases/:id/assignments', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { assignedUserId, assignmentRole, isPrimary } = req.body;
        
        const assignment = await prisma.caseAssignment.create({
            data: {
                caseId: id,
                assignedUserId,
                assignmentRole,
                isPrimary: isPrimary || false
            }
        });
        
        res.status(201).json(assignment);
    } catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Error al crear asignación' });
    }
});

app.get('/api/cases/:id/assignments', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const assignments = await prisma.caseAssignment.findMany({
            where: { caseId: id },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { assignedAt: 'desc' }
        });
        res.json({ assignments });
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Error al obtener asignaciones' });
    }
});

/**
 * @swagger
 * /api/procedural-stages:
 *   get:
 *     summary: Listar etapas procesales
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de etapas
 *   post:
 *     summary: Crear etapa procesal
 *     tags: [Configuración]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Etapa creada
 */
app.get('/api/procedural-stages', authMiddleware, async (req, res) => {
    try {
        const stages = await prisma.proceduralStage.findMany({
            where: { organizationId: req.organizationId },
            orderBy: { name: 'asc' }
        });
        res.json({ stages });
    } catch (error) {
        console.error('Error fetching stages:', error);
        res.status(500).json({ error: 'Error al obtener etapas' });
    }
});

app.post('/api/procedural-stages', authMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body;
        const stage = await prisma.proceduralStage.create({
            data: {
                organizationId: req.organizationId,
                name,
                description
            }
        });
        res.status(201).json(stage);
    } catch (error) {
        console.error('Error creating stage:', error);
        res.status(500).json({ error: 'Error al crear etapa' });
    }
});

/**
 * @swagger
 * /api/cases/{id}/timeline:
 *   post:
 *     summary: Agregar evento a bitácora
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [eventType, eventDate, summary]
 *             properties:
 *               eventType: { type: string }
 *               eventDate: { type: string, format: date-time }
 *               summary: { type: string }
 *               details: { type: string }
 *               stageId: { type: string, format: uuid }
 *               relatedDocumentId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Evento agregado
 *   get:
 *     summary: Obtener bitácora del caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Bitácora del caso
 */
app.post('/api/cases/:id/timeline', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { eventType, eventDate, summary, details, stageId, relatedDocumentId } = req.body;
        
        const event = await prisma.caseTimelineEvent.create({
            data: {
                caseId: id,
                eventType,
                eventDate: new Date(eventDate),
                summary,
                details,
                stageId,
                relatedDocumentId,
                createdBy: req.userId
            }
        });
        
        res.status(201).json(event);
    } catch (error) {
         console.error('Error creating timeline event:', error);
        res.status(500).json({ error: 'Error al crear evento' });
    }
});

app.get('/api/cases/:id/timeline', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const events = await prisma.caseTimelineEvent.findMany({
            where: { caseId: id },
            include: {
                stage: true,
                creator: { select: { name: true } },
                document: { select: { fileName: true } }
            },
            orderBy: { eventDate: 'desc' }
        });
        res.json({ events });
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Error al obtener bitácora' });
    }
});

/**
 * @swagger
 * /api/tasks:
 *   get:
 *     summary: Listar tareas
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [todo, doing, done, cancelled] }
 *       - in: query
 *         name: caseId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de tareas
 *   post:
 *     summary: Crear tarea
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [caseId, title, assignedToUserId, dueAt]
 *             properties:
 *               caseId: { type: string, format: uuid }
 *               title: { type: string }
 *               description: { type: string }
 *               taskType: { type: string }
 *               priority: { type: string, enum: [low, med, high] }
 *               assignedToUserId: { type: string, format: uuid }
 *               dueAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: Tarea creada
 */
app.get('/api/tasks', authMiddleware, async (req, res) => {
    try {
        const { status, caseId } = req.query;
        const where = { organizationId: req.organizationId };
        
        if (status) where.status = status;
        if (caseId) where.caseId = caseId;
        
        const tasks = await prisma.task.findMany({
            where,
            include: {
                case: { select: { title: true } },
                assignedTo: { select: { name: true, email: true } }
            },
            orderBy: { dueAt: 'asc' }
        });
        res.json({ tasks });
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ error: 'Error al obtener tareas' });
    }
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
    try {
        const { caseId, title, description, taskType, priority, assignedToUserId, dueAt } = req.body;
        
        const task = await prisma.task.create({
            data: {
                organizationId: req.organizationId,
                caseId,
                title,
                description,
                taskType,
                priority: priority || 'med',
                assignedToUserId,
                dueAt: new Date(dueAt)
            }
        });
        
        res.status(201).json(task);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ error: 'Error al crear tarea' });
    }
});

/**
 * @swagger
 * /api/tasks/{id}:
 *   patch:
 *     summary: Actualizar tarea
 *     tags: [Tareas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string, enum: [todo, doing, done, cancelled] }
 *               completedAt: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Tarea actualizada
 */
app.patch('/api/tasks/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, completedAt } = req.body;
        
        const data = {};
        if (status) data.status = status;
        if (completedAt) data.completedAt = new Date(completedAt);
        
        const task = await prisma.task.update({
            where: { id },
            data
        });
        
        res.json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ error: 'Error al actualizar tarea' });
    }
});

/**
 * @swagger
 * /api/cases/{id}/notes:
 *   post:
 *     summary: Agregar nota al caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [note]
 *             properties:
 *               note: { type: string }
 *               visibility: { type: string, enum: [internal, client_visible] }
 *     responses:
 *       201:
 *         description: Nota agregada
 *   get:
 *     summary: Obtener notas del caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Lista de notas
 */
app.post('/api/cases/:id/notes', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { note, visibility } = req.body;
        
        const caseNote = await prisma.caseNote.create({
            data: {
                caseId: id,
                authorUserId: req.userId,
                note,
                visibility: visibility || 'internal'
            }
        });
        
        res.status(201).json(caseNote);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Error al crear nota' });
    }
});

app.get('/api/cases/:id/notes', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const notes = await prisma.caseNote.findMany({
            where: { caseId: id },
            include: { author: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ notes });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Error al obtener notas' });
    }
});

/**
 * @swagger
 * /api/cases/{id}/messages:
 *   post:
 *     summary: Enviar mensaje en el caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messageText]
 *             properties:
 *               messageText: { type: string }
 *               senderRole: { type: string, enum: [client, lawyer, operator] }
 *     responses:
 *       201:
 *         description: Mensaje enviado
 *   get:
 *     summary: Obtener mensajes del caso
 *     tags: [Casos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Chat del caso
 */
app.post('/api/cases/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { messageText, senderRole } = req.body;
        
        const message = await prisma.caseMessage.create({
            data: {
                caseId: id,
                senderUserId: req.userId,
                senderRole: senderRole || 'lawyer',
                messageText
            }
        });
        
        res.status(201).json(message);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
});

app.get('/api/cases/:id/messages', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const messages = await prisma.caseMessage.findMany({
            where: { caseId: id },
            include: { sender: { select: { name: true } } },
            orderBy: { createdAt: 'asc' }
        });
        res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
});
