const contractService = require('../../services/contract.service');
const { logAudit } = require('../../services/audit.service');

const getContracts = async (req, res) => {
    try {
        const contracts = await contractService.getAllContracts(req);
        res.json({ contracts });
    } catch (error) {
        console.error('Error listando contratos:', error);
        res.status(500).json({ error: 'Error al listar contratos' });
    }
};

const createContract = async (req, res) => {
    try {
        const contract = await contractService.createContract(req.body, req);
        
        await logAudit(req, 'CREATE_CONTRACT', 'CONTRACT', contract.id, { contractNumber: contract.contractNumber });

        res.status(201).json(contract);
    } catch (error) {
         console.error('Error creando contrato:', error);
         res.status(500).json({ error: 'Error al crear contrato' });
    }
};

const createVersion = async (req, res) => {
    try {
        const version = await contractService.addVersion(req.params.id, req.body);
        res.status(201).json(version);
    } catch (error) {
        console.error('Error creating version:', error);
        res.status(500).json({ error: 'Error al crear versión' });
    }
};

const createSigner = async (req, res) => {
    try {
        const signer = await contractService.addSigner(req.params.id, req.body);
        res.status(201).json(signer);
    } catch (error) {
        console.error('Error adding signer:', error);
        res.status(500).json({ error: 'Error al agregar firmante' });
    }
};

const updateContract = async (req, res) => {
    try {
        const contract = await contractService.updateContract(req.params.id, req.body);
        res.json(contract);
    } catch (error) {
        console.error('Error updating contract:', error);
        res.status(500).json({ error: 'Error al actualizar contrato' });
    }
};

const getContractById = async (req, res) => {
    try {
        const contract = await contractService.getContractById(req.params.id);
        if (!contract) {
            return res.status(404).json({ error: 'Contrato no encontrado' });
        }
        res.json({ contract });
    } catch (error) {
        console.error('Error obteniendo contrato:', error);
        res.status(500).json({ error: 'Error al obtener contrato' });
    }
};

const deleteContract = async (req, res) => {
    try {
        if (req.userRole !== 'ADMIN') {
            return res.status(403).json({ error: 'No tienes permiso para realizar esta acción' });
        }
        const { id } = req.params;
        await contractService.deleteContract(id);
        res.json({ message: 'Contrato eliminado correctamente' });
    } catch (error) {
        console.error('Error deleting contract:', error);
        res.status(500).json({ error: 'Error al eliminar el contrato' });
    }
};

module.exports = {
    getContracts,
    getContractById,
    createContract,
    createVersion,
    createSigner,
    updateContract,
    deleteContract
};
