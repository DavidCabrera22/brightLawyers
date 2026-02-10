const documentService = require('../../services/document.service');
const path = require('path');
const fs = require('fs');

const uploadDocument = async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No se subió ningún archivo' });
        }

        const context = {
            file,
            organizationId: req.organizationId,
            userId: req.userId,
            caseId: req.body.caseId,
            docCategory: req.body.docCategory,
            notes: req.body.notes,
            isConfidential: req.body.isConfidential === 'true' || req.body.isConfidential === true
        };

        const document = await documentService.createDocument(null, context);
        
        // Convert BigInt to string for JSON serialization
        const serializedDoc = {
            ...document,
            sizeBytes: document.sizeBytes ? document.sizeBytes.toString() : '0'
        };
        
        res.status(201).json({ message: 'Documento subido', document: serializedDoc });
    } catch (error) {
        console.error('Error subiendo documento:', error);
        res.status(500).json({ error: 'Error al subir documento' });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await documentService.getDocumentById(id);

        if (!document) {
            return res.status(404).json({ error: 'Documento no encontrado' });
        }

        if (document.storageProvider !== 'local') {
            return res.status(501).json({ error: 'Proveedor de almacenamiento no soportado aún' });
        }

        const filePath = path.resolve(document.storageKey);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Archivo físico no encontrado' });
        }

        res.download(filePath, document.fileName);
    } catch (error) {
        console.error('Error descargando documento:', error);
        res.status(500).json({ error: 'Error al descargar documento' });
    }
};

const getDocuments = async (req, res) => {
    try {
        const documents = await documentService.getAllDocuments(req);
        
        // Convert BigInt to string for JSON serialization
        const serializedDocs = documents.map(doc => ({
            ...doc,
            sizeBytes: doc.sizeBytes ? doc.sizeBytes.toString() : '0'
        }));

        res.json({ documents: serializedDocs });
    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({ error: 'Error al obtener documentos' });
    }
};

module.exports = {
    uploadDocument,
    downloadDocument,
    getDocuments
};
