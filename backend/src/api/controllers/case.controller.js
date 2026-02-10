const caseService = require('../../services/case.service');
const { logAudit } = require('../../services/audit.service');

const getCases = async (req, res) => {
    try {
        const cases = await caseService.getAllCases(req.query, req);
        res.json({ cases });
    } catch (error) {
        console.error('Error getting cases:', error);
        res.status(500).json({ error: 'Error al obtener casos' });
    }
};

const getOpportunities = async (req, res) => {
    try {
        const cases = await caseService.getOpportunityCases(req);
        res.json({ cases });
    } catch (error) {
        console.error('Error getting opportunities:', error);
        res.status(500).json({ error: 'Error al obtener oportunidades' });
    }
};

const getRecentActivity = async (req, res) => {
    try {
        const activities = await caseService.getRecentActivity(req);
        res.json({ activities });
    } catch (error) {
        console.error('Error getting recent activity:', error);
        res.status(500).json({ error: 'Error al obtener actividad reciente' });
    }
};

const getCaseById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            return res.status(400).json({ error: 'ID de caso inválido' });
        }

        const caseItem = await caseService.getCaseById(id, req);
        if (!caseItem) {
            return res.status(404).json({ error: 'Caso no encontrado' });
        }
        res.json({ case: caseItem });
    } catch (error) {
        console.error('Error getting case by ID:', error);
        res.status(500).json({ error: 'Error al obtener el caso' });
    }
};

const createCase = async (req, res) => {
    try {
        const newCase = await caseService.createCase(req.body, req);
        
        await logAudit(req, 'CREATE_CASE', 'CASE', newCase.id, { caseNumber: newCase.caseNumberInternal });
        
        // Emit socket event
        if (req.io) {
            req.io.emit('case:created', {
                id: newCase.id,
                practiceAreaId: newCase.practiceAreaId,
                title: newCase.title,
                caseStatus: newCase.caseStatus
            });
        }

        res.status(201).json({ message: 'Caso creado', case: newCase });
    } catch (error) {
        console.error('Error creating case:', error);
        res.status(500).json({ error: 'Error al crear caso' });
    }
};

const assignMe = async (req, res) => {
    try {
        const { id } = req.params;
        const assignment = await caseService.assignCaseToUser(id, req.userId, 'LEAD_LAWYER');

        await logAudit(req, 'ASSIGN_CASE', 'CASE', id, { assignedUserId: req.userId });

        // Emit socket event
        if (req.io) {
            req.io.emit('case:taken', {
                caseId: id,
                takenBy: req.userId
            });
        }

        res.status(201).json({ message: 'Caso asignado correctamente', assignment });
    } catch (error) {
        console.error('Error assigning case:', error);
        res.status(400).json({ error: error.message });
    }
};

const assignLawyer = async (req, res) => {
    try {
        const { id } = req.params;
        const { lawyerId } = req.body;

        if (!lawyerId) {
            return res.status(400).json({ error: 'Se requiere lawyerId' });
        }

        const assignment = await caseService.assignCaseToUser(id, lawyerId, 'LEAD_LAWYER');

        await logAudit(req, 'ASSIGN_CASE_ADMIN', 'CASE', id, { assignedUserId: lawyerId, assignedBy: req.userId });

        // Emit socket event
        if (req.io) {
            req.io.emit('case:assigned', {
                caseId: id,
                assignedTo: lawyerId,
                assignedBy: req.userId
            });
        }

        res.status(201).json({ message: 'Abogado asignado correctamente', assignment });
    } catch (error) {
        console.error('Error assigning lawyer:', error);
        res.status(400).json({ error: error.message });
    }
};

const updateCase = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedCase = await caseService.updateCase(id, req.body);
        res.json({ message: 'Caso actualizado', case: updatedCase });
    } catch (error) {
        console.error('Error updating case:', error);
        res.status(500).json({ error: 'Error al actualizar caso' });
    }
};

// Sub-resources

const createTimelineEvent = async (req, res) => {
    try {
        const event = await caseService.addTimelineEvent(req.params.id, req.body, req.userId);
        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating timeline event:', error);
        res.status(500).json({ error: 'Error al crear evento' });
    }
};

const getTimeline = async (req, res) => {
    try {
        const events = await caseService.getTimeline(req.params.id);
        res.json({ events });
    } catch (error) {
        console.error('Error fetching timeline:', error);
        res.status(500).json({ error: 'Error al obtener bitácora' });
    }
};

const createNote = async (req, res) => {
    try {
        const note = await caseService.addNote(req.params.id, req.body, req.userId);
        res.status(201).json(note);
    } catch (error) {
        console.error('Error creating note:', error);
        res.status(500).json({ error: 'Error al crear nota' });
    }
};

const getNotes = async (req, res) => {
    try {
        const notes = await caseService.getNotes(req.params.id);
        res.json({ notes });
    } catch (error) {
        console.error('Error fetching notes:', error);
        res.status(500).json({ error: 'Error al obtener notas' });
    }
};

const createMessage = async (req, res) => {
    try {
        const message = await caseService.addMessage(req.params.id, req.body, req.userId);
        res.status(201).json(message);
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ error: 'Error al enviar mensaje' });
    }
};

const getMessages = async (req, res) => {
    try {
        const messages = await caseService.getMessages(req.params.id);
        res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ error: 'Error al obtener mensajes' });
    }
};

const getDocuments = async (req, res) => {
    try {
        // Support both :id and :caseId params depending on route definition
        const id = req.params.caseId || req.params.id;
        
        if (!id) {
            return res.status(400).json({ error: 'ID de caso no proporcionado' });
        }

        const documents = await caseService.getCaseDocuments(id);
        // Serialize BigInt if needed (usually handled by a JSON replacer/serializer but doing it manually here like legacy)
        const serializedDocs = documents.map(doc => ({
             ...doc,
             sizeBytes: doc.sizeBytes ? doc.sizeBytes.toString() : '0' 
        }));
        res.json({ documents: serializedDocs });
    } catch (error) {
        console.error('Error fetching case documents:', error);
        res.status(500).json({ error: 'Error al listar documentos' });
    }
};



const toggleDocumentRequest = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        if (active === undefined) {
            return res.status(400).json({ error: 'Falta el campo "active"' });
        }

        const updatedCase = await caseService.toggleDocumentRequest(id, active);
        
        await logAudit(req, 'TOGGLE_DOC_REQUEST', 'CASE', id, { active });
        
        res.json({ message: 'Estado de solicitud de documentos actualizado', case: updatedCase });
    } catch (error) {
        console.error('Error toggling document request:', error);
        res.status(500).json({ error: 'Error al actualizar solicitud' });
    }
};

const deleteCase = async (req, res) => {
    try {
        const { id } = req.params;
        await caseService.deleteCase(id);
        res.json({ message: 'Caso eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting case:', error);
        res.status(500).json({ error: 'Error al eliminar el caso' });
    }
};

module.exports = {
    getCases,
    getOpportunities,
    getRecentActivity,
    createCase,
    assignLawyer,
    updateCase,
    createTimelineEvent,
    getTimeline,
    createNote,
    getNotes,
    createMessage,
    getMessages,
    getDocuments,
    getCaseById,
    assignMe,
    toggleDocumentRequest
};
