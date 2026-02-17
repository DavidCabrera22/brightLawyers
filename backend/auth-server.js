require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const prisma = require('./src/loaders/prisma'); // Import from loader
const { authMiddleware } = require('./src/api/middlewares/auth.middleware'); // Import middleware
const auditRoutes = require('./src/api/routes/audit.routes'); // Audit Routes
const authRoutes = require('./src/api/routes/auth.routes'); // Auth Routes
const caseRoutes = require('./src/api/routes/case.routes'); // Case Routes
const clientRoutes = require('./src/api/routes/client.routes'); // Client Routes
const documentRoutes = require('./src/api/routes/document.routes'); // Document Routes
// Force reload
const taskRoutes = require('./src/api/routes/task.routes'); // Task Routes
const contractRoutes = require('./src/api/routes/contract.routes'); // Contract Routes
const userRoutes = require('./src/api/routes/user.routes'); // User Routes
const practiceAreaRoutes = require('./src/api/routes/practiceArea.routes'); // Practice Area Routes
const messageRoutes = require('./src/api/routes/message.routes'); // Message Routes
const billingRoutes = require('./src/api/routes/billing.routes'); // Billing Routes
const whatsappRoutes = require('./src/api/routes/whatsapp.routes'); // WhatsApp Routes

// Initialize Cron Jobs
require('./src/cron/reminder.cron');

// Initialize WhatsApp Service
const whatsappService = require('./src/services/whatsapp.service');
// Only initialize if configured or requested (auto-start for now as requested)
// Delay initialization to ensure server starts first and to avoid timeout during deployment
setTimeout(() => {
  whatsappService.initialize();
}, 10000); // 10 seconds delay

const multer = require('multer');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"]
  }
});

// Make io available in requests
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Socket.io Middleware for Auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.user.email);
  
  // Join user specific room for personal notifications
  if (socket.user.id) {
      socket.join(`user_${socket.user.id}`);
      console.log(`User ${socket.user.email} joined user room: user_${socket.user.id}`);
  }
  
  socket.on('join_case', (caseId) => {
    // In a production app, verify here if user has access to caseId
    socket.join(`case_${caseId}`);
    console.log(`User ${socket.user.email} joined case room: case_${caseId}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected');
  });
});

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// In-memory verification codes (use Redis in production)
const verificationCodes = new Map();

// Generate Random Code
const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// Configurar multer para subida de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir);
    }
    cb(null, dir)
  },
  filename: function (req, file, cb) {
    // Generar un nombre único: timestamp-random-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname)
  }
});

const upload = multer({ storage: storage });

// === MIDDLEWARE DE AUTENTICACIÓN (Imported) ===
// authMiddleware is now imported from './src/api/middlewares/auth.middleware'
const { logAudit } = require('./src/services/audit.service');
// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Bright Lawyers API',
      version: '1.0.0',
      description: 'API de autenticación y gestión para Bright Lawyers',
      contact: {
        name: 'Bright Lawyers',
        email: 'contacto@brightlawyers.com'
      }
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Organization: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Bright Lawyers S.A.S' },
            nit: { type: 'string', example: '900.123.456' },
            city: { type: 'string', example: 'Bogotá' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            organizationId: { type: 'string', format: 'uuid' },
            fullName: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', example: 'juan@brightlawyers.com' },
            phone: { type: 'string', example: '+57 300 123 4567' },
            status: { type: 'string', example: 'active' },
            roles: { 
              type: 'array',
              items: { $ref: '#/components/schemas/Role' }
            },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        Role: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'abogado' },
            description: { type: 'string', example: 'Abogado que trabaja en casos legales' },
            permissions: {
                type: 'array',
                items: { $ref: '#/components/schemas/Permission' }
            }
          }
        },
        UserRole: {
          type: 'object',
          properties: {
             role: { $ref: '#/components/schemas/Role' }
          }
        },
        Permission: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'CASE_READ' },
              description: { type: 'string', example: 'Ver casos' }
            }
        },
        PracticeArea: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Derecho Penal' },
            description: { type: 'string', example: 'Delitos y defensa criminal' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        LawyerProfile: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            professionalCardNumber: { type: 'string', example: 'TP-123456' },
            professionalCardCountry: { type: 'string', example: 'Colombia' },
            yearsExperience: { type: 'integer', example: 5 },
            bio: { type: 'string', example: 'Abogado especialista en derecho penal...' },
            hourlyRate: { type: 'number', example: 150000.00 },
            availabilityStatus: { type: 'string', enum: ['available', 'busy', 'off'], example: 'available' },
            ratingAvg: { type: 'number', example: 4.5 },
            casesCapacity: { type: 'integer', example: 10 },
            isFeatured: { type: 'boolean', example: false }
          }
        },
        Case: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            clientId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            practiceAreaId: { type: 'string', format: 'uuid' },
            numero_interno: { type: 'string', example: 'CASE-2024-001' },
            titulo: { type: 'string', example: 'Defensa penal Juan Perez' },
            descripcion: { type: 'string', example: 'Detalles del caso...' },
            estado_caso: { type: 'string', enum: ['intake', 'active', 'suspended', 'closed'], example: 'active' },
            nivel_confidencialidad: { type: 'string', enum: ['normal', 'alta'], example: 'normal' },
            fecha_apertura: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
             id: { type: 'string', format: 'uuid' },
             action: { type: 'string', example: 'CREATE_CASE' },
             entityType: { type: 'string', example: 'CASE' },
             entityId: { type: 'string', format: 'uuid' },
             actorUserId: { type: 'string', format: 'uuid' },
             createdAt: { type: 'string', format: 'date-time' },
             metadata: { type: 'object' }
          }
        },
        Client: {
          type: 'object',
          required: ['fullNameOrBusinessName'],
          properties: {
             id: { type: 'string', format: 'uuid' },
             clientType: { type: 'string', example: 'PERSON' }, // PERSON|COMPANY
             fullNameOrBusinessName: { type: 'string', example: 'Juan Perez' },
             documentType: { type: 'string', example: 'CC' },
             documentNumber: { type: 'string', example: '123456789' },
             email: { type: 'string' },
             phone: { type: 'string' },
             address: { type: 'string' },
             status: { type: 'string', example: 'active' },
             createdAt: { type: 'string', format: 'date-time' }
          }
        },
        CreateClientRequest: {
          type: 'object',
          required: ['clientType', 'fullNameOrBusinessName'],
          properties: {
             clientType: { type: 'string', default: 'PERSON' },
             fullNameOrBusinessName: { type: 'string' },
             documentType: { type: 'string' },
             documentNumber: { type: 'string' },
             email: { type: 'string' },
             phone: { type: 'string' },
             address: { type: 'string' }
          }
        },
        RegisterRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: { type: 'string', example: 'Juan Pérez' },
            email: { type: 'string', example: 'juan@brightlawyers.com' },
            password: { type: 'string', example: 'password123' },
            phone: { type: 'string', example: '+57 300 123 4567' },
            organizationId: { type: 'string', format: 'uuid', description: 'ID de la organización (opcional)' }
          }
        },
        LawyerEducation: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            institution: { type: 'string' },
            degree: { type: 'string' },
            field: { type: 'string' },
            startYear: { type: 'integer' },
            endYear: { type: 'integer' },
            description: { type: 'string' }
          }
        },
        Contract: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            clientId: { type: 'string', format: 'uuid' },
            contractNumber: { type: 'string' },
            title: { type: 'string' },
            status: { type: 'string', enum: ['draft', 'sent', 'signed', 'cancelled'] },
            contractValue: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ContractVersion: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            contractId: { type: 'string', format: 'uuid' },
            versionNumber: { type: 'integer' },
            documentId: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        ContractSigner: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            contractId: { type: 'string', format: 'uuid' },
            signerType: { type: 'string', enum: ['CLIENT', 'LAWYER', 'REPRESENTATIVE'] },
            signerName: { type: 'string' },
            signerEmail: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'signed', 'rejected'] },
            signedAt: { type: 'string', format: 'date-time' }
          }
        },
        CaseParty: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            partyRole: { type: 'string', enum: ['CLIENT', 'OPPOSING', 'THIRD', 'WITNESS'] },
            fullNameOrBusinessName: { type: 'string' },
            documentNumber: { type: 'string' },
            contactEmail: { type: 'string' },
            contactPhone: { type: 'string' }
          }
        },
        EmailLog: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            entityType: { type: 'string' },
            entityId: { type: 'string', format: 'uuid' },
            toEmail: { type: 'string' },
            subject: { type: 'string' },
            status: { type: 'string', enum: ['queued', 'sent', 'failed'] },
            sentAt: { type: 'string', format: 'date-time' }
          }
        },
        CaseAssignment: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            assignedUserId: { type: 'string', format: 'uuid' },
            assignmentRole: { type: 'string', enum: ['LEAD_LAWYER', 'SUPPORT_LAWYER', 'OPERATOR', 'PARALEGAL', 'COMMERCIAL'] },
            isPrimary: { type: 'boolean' }
          }
        },
        ProceduralStage: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' }
          }
        },
        CaseTimelineEvent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            eventType: { type: 'string' },
            eventDate: { type: 'string', format: 'date-time' },
            summary: { type: 'string' }
          }
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            taskType: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'med','high'] },
            status: { type: 'string', enum: ['todo', 'doing', 'done', 'cancelled'] },
            dueAt: { type: 'string', format: 'date-time' }
          }
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            alertType: { type: 'string' },
            channel: { type: 'string', enum: ['in_app', 'email', 'whatsapp'] },
            status: { type: 'string', enum: ['pending', 'sent', 'failed'] }
          }
        },
        CaseNote: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            visibility: { type: 'string', enum: ['internal', 'client_visible'] },
            note: { type: 'string' }
          }
        },
        CaseMessage: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            caseId: { type: 'string', format: 'uuid' },
            senderRole: { type: 'string', enum: ['client', 'lawyer', 'operator'] },
            messageText: { type: 'string' }
          }
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', example: 'admin@brightlawyers.com' },
            password: { type: 'string', example: 'admin123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            message: { type: 'string', example: 'Login exitoso' },
            token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
            user: { $ref: '#/components/schemas/User' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Mensaje de error' }
          }
        },
        ValidationError: {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  msg: { type: 'string' },
                  param: { type: 'string' },
                  location: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  },
  apis: ['./auth-server.js', './src/api/routes/*.js'] // Path to the API docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// --- AUDIT HELPER ---
// logAudit moved to src/services/audit.service.js and imported.
// Old inline definition removed.

// Audit Logs Endpoint moved to src/api/controllers/audit.controller.js and mounted via routes.
// Old endpoint removed.

// Middleware
app.use(cors());
app.use(express.json());
app.use('/api', auditRoutes); // Mount Audit Routes
app.use('/api/auth', authRoutes); // Mount Auth Routes
app.use('/api/cases', caseRoutes); // Mount Case Routes
app.use('/api/clients', clientRoutes); // Mount Client Routes
app.use('/api/documents', documentRoutes); // Mount Document Routes
app.use('/api/tasks', taskRoutes); // Mount Task Routes
app.use('/api/contracts', contractRoutes); // Mount Contract Routes
app.use('/api/users', userRoutes); // Mount User Routes
app.use('/api/practice-areas', practiceAreaRoutes); // Mount Practice Area Routes
app.use('/api/messages', messageRoutes); // Mount Message Routes
app.use('/api/billing', billingRoutes); // Mount Billing Routes
app.use('/api/whatsapp', whatsappRoutes); // Mount WhatsApp Routes
app.use(express.static(path.join(__dirname, '../frontend'))); 
// Start Server archivos estáticos desde la carpeta frontend

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Bright Lawyers API Docs',
  customCss: '.swagger-ui .topbar { display: none }'
}));

// Validation rules moved to src/api/routes/auth.routes.js

// Auth Endpoints (Register, Login, Me) moved to src/api/controllers/auth.controller.js
// and mounted via /api/auth routes.

/**
 * @swagger
 * /api/organization:
 *   get:
 *     summary: Obtener organizaicón del usuario
 *     tags: [Organización]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Organización obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *   put:
 *     summary: Actualizar organización
 *     tags: [Organización]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               nit: { type: string }
 *               city: { type: string }
 *               country: { type: string }
 *     responses:
 *       200:
 *         description: Organización actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Organization'
 *   post:
 *      summary: Crear organizacion
 *      tags: [Organización]
 *      security:
 *          - bearerAuth: []
 *      requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               nit: { type: string }
 *               city: { type: string }
 *               country: { type: string }
 *      responses:
 *       201:
 *          description: Organizacion creada
 *   delete:
 *      summary: Eliminar organizacion
 *      tags: [Organización]
 *      security:
 *          - bearerAuth: []
 *      responses:
 *          200:
 *              description: Eliminada correctamente
 */
app.get('/api/organization', authMiddleware, async (req, res) => {
    try {
        const organization = await prisma.organization.findUnique({
            where: { id: req.organizationId }
        });
        res.json(organization);
    } catch (error) {
        console.error('Error obteniendo organización:', error);
        res.status(500).json({ error: 'Error al obtener organización' });
    }
});

app.put('/api/organization', authMiddleware, async (req, res) => {
    try {
        const { name, nit, city, country } = req.body;
        const organization = await prisma.organization.update({
            where: { id: req.organizationId },
            data: { name, nit, city, country }
        });
        res.json(organization);
    } catch (error) {
        console.error('Error actualizando organización:', error);
        res.status(500).json({ error: 'Error al actualizar organización' });
    }
});

app.post('/api/organization', authMiddleware, async (req, res) => {
     try {
        const { name, nit, city, country } = req.body;
        const organization = await prisma.organization.create({
            data: { name, nit, city, country }
        });
        res.status(201).json(organization);
    } catch (error) {
        console.error('Error creando organización:', error);
        res.status(500).json({ error: 'Error al crear organización' });
    }
});

app.delete('/api/organization', authMiddleware, async (req, res) => {
    try {
        await prisma.organization.delete({
            where: { id: req.organizationId }
        });
        res.json({ message: 'Organización eliminada' });
    } catch (error) {
        console.error('Error eliminando organización:', error);
        res.status(500).json({ error: 'Error al eliminar organización' });
    }
});

/**
 * @swagger
 * /api/roles:
 *   get:
 *     summary: Obtener todos los roles disponibles
 *     description: Retorna la lista completa de roles en el sistema
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de roles obtenida exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 roles:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Role'
 *       500:
 *         description: Error del servidor
 *   post:
 *     summary: Crear nuevo rol
 *     tags: [Roles]
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
 *               organizationId: { type: string, format: uuid, description: 'ID de Organización (Solo Super Admin)' }
 *     responses:
 *       201:
 *         description: Rol creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Role'
 *       500:
 *         description: Error del servidor
 */  
// GET /api/roles - Obtener todos los roles de la organización
app.get('/api/roles', authMiddleware, async (req, res) => {
  try {
    const rolesRaw = await prisma.role.findMany({
      where: { organizationId: req.organizationId },
      orderBy: { name: 'asc' },
      include: { 
        rolePermissions: {
          include: {
            permission: true
          }
        } 
      }
    });
    
    // Transformar la respuesta para que permissions sea un array directo en el objeto rol
    const roles = rolesRaw.map(role => ({
      ...role,
      permissions: role.rolePermissions.map(rp => rp.permission),
      rolePermissions: undefined // Limpiar la relación intermedia si no se necesita
    }));

    res.json({ roles });
  } catch (error) {
    console.error('Error obteniendo roles:', error);
    res.status(500).json({ error: 'Error al obtener roles' });
  }
});

app.post('/api/roles', authMiddleware, async (req, res) => {
  try {
    const { name, description, organizationId } = req.body;
    
    // Si se envía organizationId, se usa (para Super Admin), si no, se usa la del usuario
    const targetOrgId = organizationId || req.organizationId;

    const role = await prisma.role.create({
      data: {
        name,
        description,
        organizationId: targetOrgId
      }
    });
    res.status(201).json(role);
  } catch (error) {
    console.error('Error creando rol:', error);
    res.status(500).json({ error: 'Error al crear rol' });
  }
});

/**
 * @swagger
 * /api/roles/{id}:
 *   put:
 *     summary: Actualizar rol
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Rol actualizado
 *   delete:
 *     summary: Eliminar rol
 *     tags: [Roles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Rol eliminado
 */
app.put('/api/roles/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    // Verificar que el rol pertenezca a la organización
    const existingRole = await prisma.role.findFirst({
        where: { id, organizationId: req.organizationId }
    });

    if (!existingRole) {
        return res.status(404).json({ error: 'Rol no encontrado o no autorizado' });
    }

    const role = await prisma.role.update({
      where: { id },
      data: { name, description }
    });
    res.json(role);
  } catch (error) {
    console.error('Error actualizando rol:', error);
    res.status(500).json({ error: 'Error al actualizar rol' });
  }
});

app.delete('/api/roles/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar que el rol pertenezca a la organización
    const existingRole = await prisma.role.findFirst({
        where: { id, organizationId: req.organizationId }
    });

    if (!existingRole) {
        return res.status(404).json({ error: 'Rol no encontrado o no autorizado' });
    }

    await prisma.role.delete({ where: { id } });
    res.json({ message: 'Rol eliminado correctamente' });
  } catch (error) {
    console.error('Error eliminando rol:', error);
    res.status(500).json({ error: 'Error al eliminar rol' });
  }
});



/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: Obtener perfil profesional del abogado
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtenido exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LawyerProfile'
 *   post:
 *     summary: Crear perfil profesional
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [professionalCardNumber, yearsExperience]
 *             properties:
 *               professionalCardNumber: { type: string }
 *               professionalCardCountry: { type: string }
 *               yearsExperience: { type: integer }
 *               bio: { type: string }
 *               hourlyRate: { type: number }
 *               practiceAreaIds: 
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Perfil creado exitosamente
 *       400:
 *         description: El perfil ya existe
 *   put:
 *     summary: Actualizar perfil profesional
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               professionalCardNumber: { type: string }
 *               professionalCardCountry: { type: string }
 *               yearsExperience: { type: integer }
 *               bio: { type: string }
 *               hourlyRate: { type: number }
 *               practiceAreaIds: 
 *                 type: array
 *                 items: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Perfil actualizado exitosamente
 */
app.get('/api/profile', authMiddleware, async (req, res) => {
  try {
    const profile = await prisma.lawyerProfile.findUnique({
      where: { userId: req.userId }, // Changed from lawyerId to userId
      include: { practices: { include: { practiceArea: true } } }
    });
    
    if (!profile) return res.status(404).json({ message: 'Perfil no encontrado' });

    res.json(profile);
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});
app.post('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { 
      professionalCardNumber, 
      professionalCardCountry, 
      yearsExperience, 
      bio, 
      hourlyRate,
      practiceAreaIds 
    } = req.body;

    const existingProfile = await prisma.lawyerProfile.findUnique({
      where: { userId: req.userId }
    });

    if (existingProfile) {
      return res.status(400).json({ error: 'El perfil ya existe. Use PUT para actualizar.' });
    }

    const result = await prisma.$transaction(async (prisma) => {
      const profile = await prisma.lawyerProfile.create({
        data: {
          userId: req.userId,
          organizationId: req.organizationId,
          professionalCardNumber,
          professionalCardCountry,
          yearsExperience: parseInt(yearsExperience),
          bio,
          hourlyRate: parseFloat(hourlyRate)
        }
      });

      if (practiceAreaIds && Array.isArray(practiceAreaIds)) {
        for (const areaId of practiceAreaIds) {
            await prisma.lawyerPracticeArea.create({
                data: {
                    lawyerProfileId: profile.id,
                    practiceAreaId: areaId
                }
            });
        }
      }

      return profile;
    });

    res.status(201).json({ message: 'Perfil creado exitosamente', profile: result });
  } catch (error) {
    console.error('Error creando perfil:', error);
    res.status(500).json({ error: 'Error al crear perfil' });
  }
});

app.put('/api/profile', authMiddleware, async (req, res) => {
  try {
    const { 
      professionalCardNumber, 
      professionalCardCountry, 
      yearsExperience, 
      bio, 
      hourlyRate,
      practiceAreaIds 
    } = req.body;

    // Use transaction to update profile and practices
    const result = await prisma.$transaction(async (prisma) => {
      const profile = await prisma.lawyerProfile.upsert({
        where: { userId: req.userId },
        create: {
          userId: req.userId,
          organizationId: req.organizationId,
          professionalCardNumber,
          professionalCardCountry,
          yearsExperience: parseInt(yearsExperience),
          bio,
          hourlyRate: parseFloat(hourlyRate)
        },
        update: {
          professionalCardNumber,
          professionalCardCountry,
          yearsExperience: parseInt(yearsExperience),
          bio,
          hourlyRate: parseFloat(hourlyRate)
        }
      });

      if (practiceAreaIds && Array.isArray(practiceAreaIds)) {
        // Clear existing keys
        await prisma.lawyerPracticeArea.deleteMany({ where: { lawyerProfileId: profile.id } });
        // Add new ones
        for (const areaId of practiceAreaIds) {
            await prisma.lawyerPracticeArea.create({
                data: {
                    lawyerProfileId: profile.id,
                    practiceAreaId: areaId
                }
            });
        }
      }

      return profile;
    });

    res.json({ message: 'Perfil actualizado exitosamente', profile: result });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
});

/**
 * @swagger
 * /api/profile:
 *   delete:
 *     summary: Eliminar perfil profesional
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil eliminado exitosamente
 */
app.delete('/api/profile', authMiddleware, async (req, res) => {
  try {
    await prisma.lawyerProfile.delete({
      where: { lawyerId: req.userId }
    });
    res.json({ message: 'Perfil eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando perfil:', error);
  }
});

/**
 * @swagger
 * /api/profile/education:
 *   post:
 *     summary: Agregar educación al perfil
 *     tags: [Perfil]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [institution, degree]
 *             properties:
 *               institution: { type: string }
 *               degree: { type: string }
 *               field: { type: string }
 *               startYear: { type: integer }
 *               endYear: { type: integer }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Educación agregada
 */
app.post('/api/profile/education', authMiddleware, async (req, res) => {
  try {
    const { institution, degree, field, startYear, endYear, description } = req.body;
    
    // Get profile id first
    const profile = await prisma.lawyerProfile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

    const education = await prisma.lawyerEducation.create({
      data: {
        lawyerProfileId: profile.id,
        institution,
        degree,
        field,
        startYear,
        endYear,
        description
      }
    });

    res.status(201).json(education);
  } catch (error) {
    console.error('Error adding education:', error);
    res.status(500).json({ error: 'Error al agregar educación' });
  }
});

// Contracts endpoints moved to src/api/controllers/contract.controller.js and routes.
// Legacy endpoints removed.

/**
 * @swagger
 * /api/cases/{id}/parties:
 *   post:
 *     summary: Agregar parte al caso
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
 *             required: [partyRole, fullNameOrBusinessName]
 *             properties:
 *               partyRole: { type: string, enum: [CLIENT, OPPOSING, THIRD, WITNESS] }
 *               fullNameOrBusinessName: { type: string }
 *               documentNumber: { type: string }
 *               contactEmail: { type: string }
 *               contactPhone: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Parte agregada
 *   get:
 *     summary: Listar partes del caso
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
 *         description: Lista de partes
 */
app.post('/api/cases/:id/parties', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { partyRole, fullNameOrBusinessName, documentNumber, contactEmail, contactPhone, notes } = req.body;
        
        const party = await prisma.caseParty.create({
            data: {
                caseId: id,
                partyRole,
                fullNameOrBusinessName,
                documentNumber,
                contactEmail,
                contactPhone,
                notes
            }
        });
        
        res.status(201).json(party);
    } catch (error) {
        console.error('Error adding party:', error);
        res.status(500).json({ error: 'Error al agregar parte' });
    }
});

app.get('/api/cases/:id/parties', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const parties = await prisma.caseParty.findMany({
            where: { caseId: id },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ parties });
    } catch (error) {
        console.error('Error fetching parties:', error);
        res.status(500).json({ error: 'Error al obtener partes' });
    }
});

/**
 * @swagger
 * /api/email-log:
 *   get:
 *     summary: Ver logs de emails
 *     tags: [Email]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: entityType
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [queued, sent, failed] }
 *     responses:
 *       200:
 *         description: Lista de logs
 */
app.get('/api/email-log', authMiddleware, async (req, res) => {
    try {
        const { entityType, status } = req.query;
        const where = { organizationId: req.organizationId };
        
        if (entityType) where.entityType = entityType;
        if (status) where.status = status;
        
        const logs = await prisma.emailLog.findMany({
            where,
            take: 100,
            orderBy: { createdAt: 'desc' }
        });
        res.json({ logs });
    } catch (error) {
        console.error('Error fetching email logs:', error);
        res.status(500).json({ error: 'Error al obtener logs' });
    }
});

// ==================== CASE MANAGEMENT ENDPOINTS ====================

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

// Case Endpoints moved to src/api/controllers/case.controller.js and routes.
// Legacy endpoints removed (cases, timeline, notes, messages, case-documents).

// Tasks endpoints moved to src/api/controllers/task.controller.js and routes.
// Legacy endpoints removed.

// Client endpoints moved to src/api/controllers/client.controller.js and routes.
// Legacy endpoints removed.

// Documents endpoints moved to src/api/controllers/document.controller.js and routes.
// Legacy endpoints removed.

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`\n🔐 Auth server running on http://localhost:${PORT}`);
  console.log(`📚 API Docs available at http://localhost:${PORT}/api-docs`);
  console.log('📡 API endpoints:');
  console.log(`   POST http://localhost:${PORT}/api/auth/register`);
  console.log(`   POST http://localhost:${PORT}/api/auth/login`);
  console.log(`   CRUD http://localhost:${PORT}/api/practice-areas`);
  console.log(`   CRUD http://localhost:${PORT}/api/profile`);
  console.log(`   CRUD http://localhost:${PORT}/api/clients`);
  console.log(`   CRUD http://localhost:${PORT}/api/cases`);
  console.log(`   CRUD http://localhost:${PORT}/api/contracts`);
  console.log(`   POST http://localhost:${PORT}/api/profile/education`);
  console.log(`   DOCS http://localhost:${PORT}/api/documents/upload`);
  console.log(`   GET http://localhost:${PORT}/api/cases/:caseId/documents`);
  console.log(`   GET http://localhost:${PORT}/api/documents/:id/download`);
  console.log(`   MSG  http://localhost:${PORT}/api/messages/conversations`);
});

// Manejar cierre gracefully
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
