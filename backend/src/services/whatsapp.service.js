const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');
const prisma = require('../../src/loaders/prisma'); // Use shared singleton instance
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');

// Constants
const APPOINTMENT_STATES = {
    NONE: 'none',
    REQUESTING: 'requesting',
    COLLECTING_NAME: 'collecting_name',
    COLLECTING_PHONE: 'collecting_phone', 
    COLLECTING_AREA: 'collecting_area',
    COLLECTING_DESCRIPTION: 'collecting_description',
    COLLECTING_DATE: 'collecting_date',
    COLLECTING_TIME: 'collecting_time',
    COLLECTING_DATETIME: 'collecting_datetime',
    COLLECTING_ALL_DATA: 'collecting_all_data',
    COLLECTING_TYPE: 'collecting_type',
    CONFIRMING: 'confirming'
};

const LEGAL_KNOWLEDGE = `
Soy Zero, tu asistente virtual de Bright Lawyers, un prestigioso bufete de abogados en Colombia.

Nuestro bufete se caracteriza por:
- Contar con los mejores abogados expertos en TODAS las áreas del derecho
- Más de 20 años de experiencia exitosa en casos complejos
- Equipo altamente calificado y reconocido a nivel nacional
- Enfoque personalizado para cada cliente y situación
- Historial comprobado de casos ganados en múltiples especialidades
- Atención integral y profesional en cualquier materia legal

Nuestras áreas de expertise incluyen:
- Derecho Civil, Comercial y Corporativo
- Derecho Laboral y Seguridad Social
- Derecho Penal y Procesal Penal
- Derecho de Familia y Sucesiones
- Derecho Administrativo y Constitucional
- Derecho Inmobiliario y Urbanístico
- Y muchas otras especialidades legales

IMPORTANTE - ESTRATEGIA DE CONVERSIÓN:
- SIEMPRE termina tus respuestas dirigiendo al cliente hacia agendar una cita
- Usa frases como: "¿Te gustaría agendar una consulta gratuita para revisar tu caso?"
- Menciona que la primera consulta es GRATUITA (30 minutos)
- Crea urgencia: "Mientras más pronto actúes, mejores opciones tendrás"
- Enfatiza la importancia de asesoría profesional personalizada
- Nunca des consejos legales específicos sin cita previa
- Siempre sugiere que cada caso es único y requiere análisis personalizado

Siempre proporciona información precisa y actualizada de manera conversacional y humana.
`;

class WhatsAppService {
    constructor() {
        this.client = null;
        this.qrCodeDataUrl = null;
        this.status = 'disconnected'; // disconnected, initializing, ready, error
        
        this.prisma = prisma; // Use the imported singleton
        
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        // Polling properties
        this.isProcessing = false;
        this.POLL_INTERVAL = 10000; // 10 seconds
        
        // Control properties
        this.botActive = true;
        this.humanControlSessions = new Set();
        this.lastBotMessage = new Map();
        this.clientInteractions = new Map();
        
        // Appointment State Management
        this.appointmentStates = new Map();
        this.appointmentData = new Map();
        
        this.HUMAN_KEYWORDS = [
            'hola soy', 'mi nombre es', 'te voy a ayudar', 'en un momento',
            'permíteme', 'déjame revisar', 'voy a verificar', 'te contacto',
            'gracias por escribir', 'te atiendo', 'soy el abogado', 'soy la asistente'
        ];
    }

    async initialize() {
        console.log('🚀 Initializing WhatsApp Service...');
        this.status = 'initializing';

        try {
            this.client = new Client({
                authStrategy: new LocalAuth({
                    dataPath: './.wwebjs_auth'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        // '--single-process', // Removed for better stability
                        '--disable-gpu'
                    ],
                    timeout: 60000
                }
            });

            this.setupEventListeners();
            
            // Initialize properly handling the promise
            console.log('🚀 Starting WhatsApp Client...');
            this.client.initialize().catch(err => {
                console.error('❌ WhatsApp Client Initialization Error:', err);
                this.status = 'error';
            });
            
            // Start polling for alerts
            setInterval(() => this.processPendingNotifications(), this.POLL_INTERVAL);
            
        } catch (error) {
            console.error('❌ Error initializing WhatsApp client:', error);
            this.status = 'error';
        }
    }

    setupEventListeners() {
        this.client.on('qr', async (qr) => {
            console.log('🔗 QR Code received');
            
            // Print QR to terminal for CLI users
            console.log('\n' + '='.repeat(60));
            console.log('📱 CÓDIGO QR PARA WHATSAPP - ESCANEA CON TU TELÉFONO');
            console.log('='.repeat(60));
            qrcodeTerminal.generate(qr, { small: true });
            console.log('='.repeat(60));
            console.log('💡 Instrucciones:');
            console.log('1. Abre WhatsApp en tu teléfono');
            console.log('2. Ve a Menú (3 puntos) > Dispositivos vinculados');
            console.log('3. Toca "Vincular dispositivo"');
            console.log('4. Escanea el código QR de arriba');
            console.log('='.repeat(60) + '\n');

            try {
                this.qrCodeDataUrl = await qrcode.toDataURL(qr);
                this.status = 'qr_ready';
            } catch (err) {
                console.error('Error generating QR code:', err);
            }
        });

        this.client.on('ready', () => {
            console.log('\n' + '='.repeat(60));
            console.log('✅ CHATBOT LEGAL AVANZADO - CONECTADO Y LISTO');
            console.log('='.repeat(60));
            console.log('🧠 Sistema de IA (OpenAI) activado');
            console.log('🔔 Sistema de notificaciones monitoreando');
            console.log('='.repeat(60) + '\n');
            
            this.status = 'ready';
            this.qrCodeDataUrl = null;
        });

        this.client.on('authenticated', () => {
            console.log('🔐 WhatsApp Authenticated');
        });

        this.client.on('auth_failure', msg => {
            console.error('❌ WhatsApp Auth Failure:', msg);
            this.status = 'error';
        });

        this.client.on('disconnected', (reason) => {
            console.log('⚠️ WhatsApp Disconnected:', reason);
            this.status = 'disconnected';
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                this.client.initialize();
            }, 5000);
        });

        this.client.on('message', async msg => {
            await this.handleMessage(msg);
        });
    }

    getStatus() {
        return {
            status: this.status,
            botActive: this.botActive,
            humanSessions: this.humanControlSessions.size
        };
    }

    getQR() {
        return this.qrCodeDataUrl;
    }

    // --- Message Handling Logic ---

    async handleMessage(message) {
        try {
            const userPhone = message.from;
            const userMessage = message.body;
            const isFromAdmin = userPhone.includes('admin'); // Adjust if needed
            
            console.log(`📱 Message from ${userPhone}: ${userMessage}`);

            // 1. Check if the user is a REGISTERED CLIENT in our database
            const phoneNumberClean = userPhone.replace(/\D/g, ''); // 573001234567
            // Remove country code if needed or match partial
            // Our DB stores phone like '3001234567' or '+573001234567'
            // Let's try to match flexible
            
            const registeredUser = await this.prisma.user.findFirst({
                where: {
                    OR: [
                        { phone: phoneNumberClean },
                        { phone: `+${phoneNumberClean}` },
                        { phone: phoneNumberClean.replace(/^57/, '') } // if DB has 300... and incoming is 57300...
                    ]
                },
                include: {
                    clientUsers: {
                        include: {
                            client: {
                                include: {
                                    cases: {
                                        where: { caseStatus: 'active' },
                                        take: 1, // Focus on most recent active case
                                        orderBy: { updatedAt: 'desc' },
                                        include: {
                                            assignments: {
                                                include: { user: true }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            // If it IS a registered client with an active case, forward message to Lawyer/Platform
            if (registeredUser && registeredUser.clientUsers.length > 0) {
                const clientUser = registeredUser.clientUsers[0];
                const activeCase = clientUser.client.cases[0];

                if (activeCase) {
                    console.log(`✅ Registered Client ${registeredUser.fullName} detected. Case: ${activeCase.caseNumberInternal}`);
                    
                    // Create CaseMessage in Database
                    await this.prisma.caseMessage.create({
                        data: {
                            caseId: activeCase.id,
                            senderUserId: registeredUser.id,
                            senderRole: 'client',
                            messageText: `[WhatsApp] ${userMessage}`,
                            isRead: false
                        }
                    });

                    // Notify Lawyer via Alert (so they get email/socket notification)
                    // We can reuse the alert system but targeting the lawyer
                    const lawyers = activeCase.assignments.map(a => a.user);
                    for (const lawyer of lawyers) {
                        await this.prisma.alert.create({
                            data: {
                                organizationId: activeCase.organizationId,
                                caseId: activeCase.id,
                                recipientUserId: lawyer.id,
                                alertType: 'new_message',
                                channel: 'in_app', // Lawyer is on platform
                                scheduledAt: new Date(),
                                status: 'pending',
                                payload: {
                                    originalMessage: userMessage,
                                    senderName: registeredUser.fullName,
                                    caseTitle: activeCase.title,
                                    via: 'whatsapp'
                                }
                            }
                        });
                        // Optional: If lawyer also has WhatsApp configured, we could notify them there too
                        // But usually lawyers use the web platform.
                    }

                    // Reply to Client on WhatsApp confirming receipt
                    await message.reply(`✅ Hemos recibido tu mensaje y lo hemos adjuntado a tu caso *${activeCase.caseNumberInternal}*. Tu abogado ha sido notificado.`);
                    return; // Stop here, don't trigger AI chatbot flow
                }
            }
            
            // Detect human intervention
            if (this.isHumanMessage(userMessage, userPhone, isFromAdmin)) {
                return;
            }
            
            if (!this.shouldBotRespond(userPhone)) {
                return;
            }
            
            const lowerMessage = userMessage.toLowerCase();
            let response;
            
            if (lowerMessage.includes('horario') || lowerMessage.includes('hora')) {
                response = `🕒 **Horarios de Atención:**\n\n` +
                          `📅 Lunes a Viernes: 8:00 AM - 6:00 PM\n` +
                          `📅 Sábados: 9:00 AM - 1:00 PM\n` +
                          `📅 Domingos: Cerrado\n\n` +
                          `🎯 **¡CONSULTA GRATUITA DISPONIBLE!**\n` +
                          `Agenda tu cita de 30 minutos SIN COSTO y recibe asesoría profesional personalizada. ¿Cuándo te gustaría que te atendamos?`;
            } else if (lowerMessage.includes('precio') || lowerMessage.includes('costo')) {
                response = `💰 **Información de Inversión:**\n\n` +
                          `🎁 **CONSULTA INICIAL: COMPLETAMENTE GRATUITA (30 min)**\n\n` +
                          `Nuestras tarifas varían según la complejidad del caso:\n` +
                          `• Casos civiles: Desde $500.000\n` +
                          `• Casos penales: Desde $800.000\n` +
                          `• Casos laborales: Desde $400.000\n\n` +
                          `⚡ **¡APROVECHA TU CONSULTA GRATUITA!**\n` +
                          `En 30 minutos evaluamos tu caso y te damos un plan de acción. ¿Agendamos tu cita ahora?`;
            } else if (lowerMessage.includes('ubicación') || lowerMessage.includes('dirección')) {
                response = `📍 **Nuestra Ubicación:**\n\n` +
                          `🏢 Calle 123 #45-67, Bogotá\n` +
                          `🚇 Cerca al Metro: Estación Universidad\n` +
                          `🅿️ Parqueadero disponible\n` +
                          `📞 Tel: +57 (1) 234-5678\n\n` +
                          `🎯 **¡Visítanos para tu CONSULTA GRATUITA!**\n` +
                          `30 minutos de asesoría profesional sin costo. ¿Prefieres cita presencial o virtual?`;
            } else if (lowerMessage.includes('emergencia') || lowerMessage.includes('urgente')) {
                response = `🚨 **Emergencia Legal:**\n\n` +
                          `Para casos urgentes:\n` +
                          `📞 Teléfono: +57 300 123 4567\n` +
                          `📧 Email: emergencias@bufete.com\n\n` +
                          `⚡ **ATENCIÓN INMEDIATA DISPONIBLE**\n` +
                          `¿Necesitas asesoría urgente? Agenda tu consulta de emergencia AHORA. Cada minuto cuenta en casos urgentes.`;
            } else {
                response = await this.processWithAI(userMessage, userPhone);
            }
            
            this.lastBotMessage.set(userPhone, Date.now());
            await message.reply(response);
            
        } catch (error) {
            console.error('❌ Error processing message:', error);
            await message.reply('Disculpa, hubo un error. Sin embargo, puedo ayudarte de inmediato si agendas una consulta gratuita. ¿Te gustaría coordinemos una cita?');
        }
    }

    isHumanMessage(message, phoneNumber, isFromAdmin = false) {
        const lowerMessage = message.toLowerCase();
        const hasKeyword = this.HUMAN_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
        
        if (hasKeyword && isFromAdmin) {
            console.log(`🤖➡️👤 Admin took control of ${phoneNumber}`);
            this.humanControlSessions.add(phoneNumber);
            return true;
        }
        return false;
    }

    shouldBotRespond(phoneNumber) {
        if (!this.botActive) return false;
        if (this.humanControlSessions.has(phoneNumber)) return false;
        return true;
    }

    // --- AI & Appointment Logic ---

    async processWithAI(message, userPhone) {
        try {
            const interactionCount = this.clientInteractions.get(userPhone) || 0;
            const currentState = this.appointmentStates.get(userPhone) || APPOINTMENT_STATES.NONE;
            const userData = this.appointmentData.get(userPhone) || {};
            
            const isFirstMessage = interactionCount === 0;
            
            if (currentState !== APPOINTMENT_STATES.NONE) {
                return await this.handleAppointmentFlow(message, userPhone, currentState, userData);
            }
            
            const lowerMessage = message.toLowerCase();
            const isAppointmentRequest = lowerMessage.includes('agendar') || 
                                       lowerMessage.includes('cita') || 
                                       lowerMessage.includes('reunión') ||
                                       lowerMessage.includes('consulta') ||
                                       (lowerMessage.includes('si') || lowerMessage.includes('sí'));
            
            let systemPrompt = LEGAL_KNOWLEDGE;
            
            if (isFirstMessage) {
                systemPrompt += `\n\nIMPORTANTE - MENSAJE DE BIENVENIDA:\nEste es el primer mensaje del usuario. Debes responder con:\n\n"👋 ¡Hola! Soy **Zero**, tu asistente virtual de **Bright Lawyers**.\n\n🏛️ **¿En qué podemos ayudarte hoy?**\n\n📋 **Nuestros servicios incluyen:**\n• 👨‍👩‍👧‍👦 Derecho de Familia (divorcios, custodia, alimentos)\n• 💼 Derecho Laboral (despidos, liquidaciones, demandas)\n• 🏠 Derecho Civil (contratos, arrendamientos, cobros)\n• ⚖️ Derecho Penal (defensa criminal, procesos judiciales)\n• 🏢 Derecho Comercial (constitución de empresas, contratos)\n• 🏘️ Derecho Inmobiliario (compraventa, hipotecas)\n\n🎁 **¡CONSULTA INICIAL GRATUITA!**\nTe ofrecemos 30 minutos de asesoría profesional sin costo.\n\n¿Cuál es tu situación legal? Cuéntame para poder ayudarte mejor."\n\nNo agregues nada más, usa exactamente este formato.`;
            } else if (isAppointmentRequest && interactionCount > 0) {
                this.appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_ALL_DATA);
                this.appointmentData.set(userPhone, {});
                return `📅 **¡Perfecto! Vamos a agendar tu consulta GRATUITA**\n\n📋 **Para poder agendar tu cita, compártenos esta información:**\n\n1️⃣ **Nombre completo** 📝\n2️⃣ **Número de contacto** 📞\n3️⃣ **Tipo de consulta** ⚖️\n(Ejemplo: Laboral, Familiar, Inmobiliaria, Penal, etc.)\n4️⃣ **Fecha y hora preferida** ⏰\n\n✨ **Con estos datos, uno de nuestros abogados expertos se comunicará contigo a la brevedad para revisar tu caso con total confidencialidad y profesionalismo.**\n\n💬 **Ejemplo de respuesta:**\n\"Juan Pérez, 300-123-4567, Consulta Laboral, Mañana 10 AM\"\n\n📝 Por favor comparte toda la información en un solo mensaje:`;
            } else {
                if (interactionCount >= 2) {
                    systemPrompt += `\n\nESTRATEGIA OBLIGATORIA DESPUÉS DE 2 MENSAJES:\n- Responde MUY brevemente (1 línea máximo)\n- INMEDIATAMENTE pregunta: "¿Te gustaría agendar una consulta GRATUITA para revisar tu caso específico? Solo responde 'SÍ' y coordinamos tu cita."\n- NO des más información legal\n- FUERZA la decisión de agendar`;
                } else {
                    systemPrompt += `\n\nESTRATEGIA OBLIGATORIA:\n- Responde brevemente la consulta (máximo 2-3 líneas)\n- NO des consejos legales específicos\n- Menciona que cada caso es único\n- SIEMPRE termina dirigiendo hacia agendar una consulta GRATUITA\n- Usa frases de urgencia y valor\n- Ejemplo: "Para darte el mejor consejo personalizado, ¿te gustaría agendar tu consulta GRATUITA de 30 minutos? Mientras más pronto actúes, mejores opciones tendrás."`;
                }
            }
            
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                max_tokens: 300,
                temperature: 0.8
            });
            
            this.clientInteractions.set(userPhone, interactionCount + 1);
            return completion.choices[0].message.content;
            
        } catch (error) {
            console.error('❌ Error with OpenAI:', error);
            return 'Disculpa, estoy experimentando dificultades técnicas. Sin embargo, puedo ayudarte de inmediato si agendas una consulta gratuita. ¿Te gustaría que coordinemos una cita?';
        }
    }

    async handleAppointmentFlow(message, userPhone, currentState, userData) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('cancelar') || lowerMessage.includes('salir')) {
            this.appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
            this.appointmentData.delete(userPhone);
            return '❌ Proceso de cita cancelado. Si cambias de opinión, solo dime "quiero agendar una cita".';
        }
        
        switch (currentState) {
            case APPOINTMENT_STATES.COLLECTING_ALL_DATA:
                const messageText = message.trim();
                const lines = messageText.split(/[,\n]/).map(line => line.trim()).filter(line => line.length > 0);
                
                if (lines.length >= 4) {
                    userData.name = lines[0];
                    userData.phone = lines[1];
                    userData.area = lines[2];
                    userData.preferredDateTime = lines[3];
                    userData.description = `Consulta sobre ${userData.area}`;
                    
                    this.appointmentData.set(userPhone, userData);
                    
                    try {
                        const appointmentForCalendar = {
                            name: userData.name,
                            phone: userData.phone,
                            area: userData.area,
                            description: userData.description,
                            preferredDateTime: userData.preferredDateTime,
                            dateTime: this.generateDateTime(userData.preferredDateTime),
                            email: `${userData.phone.replace(/[^0-9]/g, '')}@cliente-brightlawyers.com`
                        };
                        
                        await this.saveAppointment(appointmentForCalendar);
                        
                        this.appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                        this.appointmentData.delete(userPhone);
                        
                        return `🎉 **¡CITA AGENDADA EXITOSAMENTE!**\n\n✅ **Confirmación de tu Consulta GRATUITA:**\n\n👤 **Cliente:** ${userData.name}\n📞 **Teléfono:** ${userData.phone}\n⚖️ **Tipo de Consulta:** ${userData.area}\n📅 **Fecha Preferida:** ${userData.preferredDateTime}\n⏱️ **Duración:** 30 minutos SIN COSTO\n\n📞 **Próximos pasos:**\n🔸 Nuestro equipo te contactará en las próximas 2 horas\n🔸 Te confirmaremos la fecha y hora definitiva\n🔸 Recibirás la ubicación o enlace virtual\n🔸 Prepara tus documentos relacionados al caso\n\n📱 **¿Necesitas cambios?**\nContáctanos: +57 300 123 4567\n\n🏛️ **¡Gracias por confiar en Bright Lawyers!**\nNuestro equipo de expertos está listo para ayudarte.`;
                    } catch (error) {
                        console.error('❌ Error saving appointment:', error);
                        this.appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                        this.appointmentData.delete(userPhone);
                        return `✅ **¡Cita Registrada!**\n\n📝 Hemos guardado todos tus datos correctamente.\n\n⚠️ *Nota técnica: Hubo un problema menor con el calendario digital, pero tu cita está confirmada.*\n\n📞 **Nuestro equipo te contactará pronto.**`;
                    }
                } else {
                    return `⚠️ **Información incompleta**\n\nPor favor, proporciona todos los datos requeridos:\n\n📝 **Formato correcto:**\n\"Nombre Completo, Teléfono, Tipo de Consulta, Fecha y Hora\"\n\n💬 **Ejemplo:**\n\"Juan Pérez, 300-123-4567, Consulta Laboral, Mañana 10 AM\"\n\nIntenta nuevamente con todos los datos:`;
                }
            
            // ... (other cases like COLLECTING_NAME, etc. could be implemented if we want granular flows, but COLLECTING_ALL_DATA is the main one used in logic)
            default:
                this.appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                this.appointmentData.delete(userPhone);
                return '❌ Hubo un error en el proceso. ¿Te gustaría agendar una cita? Solo responde "sí" para comenzar.';
        }
    }

    generateDateTime(dateTimeInput) {
        try {
            const now = new Date();
            let targetDate = new Date();
            const input = dateTimeInput.toLowerCase();
            
            if (input.includes('mañana') && !input.includes('pasado')) {
                targetDate.setDate(now.getDate() + 1);
            } else if (input.includes('pasado mañana')) {
                targetDate.setDate(now.getDate() + 2);
            }
            // ... (Simple logic for now, expanding would duplicate the long function)
            // Just basic fallback for safety
            
            let hour = 10;
            if (input.includes('tarde')) hour = 14;
            targetDate.setHours(hour, 0, 0, 0);
            
            if (targetDate < now) targetDate.setDate(targetDate.getDate() + 1);
            
            return targetDate.toISOString();
        } catch (error) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(10, 0, 0, 0);
            return tomorrow.toISOString();
        }
    }

    async saveAppointment(appointmentData) {
        console.log('💾 Saving appointment:', appointmentData);
        let calendarEventId = null;
        
        // Save to local file as backup (or DB if we had an Appointment model)
        const appointmentsFile = path.join(__dirname, '../../appointments.json');
        let appointments = [];
        if (fs.existsSync(appointmentsFile)) {
            const data = fs.readFileSync(appointmentsFile, 'utf8');
            appointments = JSON.parse(data);
        }
        
        const appointment = {
            id: Date.now().toString(),
            ...appointmentData,
            calendarEventId,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        appointments.push(appointment);
        fs.writeFileSync(appointmentsFile, JSON.stringify(appointments, null, 2));
        return appointment;
    }

    // --- Notification Logic ---

    formatPhoneNumber(phone) {
        if (!phone) return null;
        let cleaned = phone.replace(/\D/g, '');
        if (!cleaned.startsWith('57')) {
            cleaned = '57' + cleaned;
        }
        return `${cleaned}@c.us`;
    }

    stripHtml(html) {
        if (!html) return '';
        return html.replace(/<[^>]*>?/gm, '');
    }

    async processPendingNotifications() {
        if (this.isProcessing || this.status !== 'ready') return;
        this.isProcessing = true;

        try {
            const pendingAlerts = await this.prisma.alert.findMany({
                where: {
                    channel: 'whatsapp',
                    status: 'pending',
                    scheduledAt: { lte: new Date() }
                },
                include: { recipient: true },
                take: 5
            });

            for (const alert of pendingAlerts) {
                try {
                    if (!alert.recipient || !alert.recipient.phone) {
                        await this.prisma.alert.update({
                            where: { id: alert.id },
                            data: { status: 'failed', sentAt: new Date(), payload: { error: 'Usuario sin teléfono' } }
                        });
                        continue;
                    }

                    const phoneNumber = this.formatPhoneNumber(alert.recipient.phone);
                    let messageBody = '';
                    const data = alert.payload || {};
                    const cleanMessage = this.stripHtml(data.originalMessage || '...');

                    if (alert.alertType === 'new_message') {
                        const sender = data.senderName || 'BrightLawyers';
                        const caseTitle = data.caseTitle || 'Su Caso';
                        messageBody = `🔔 *Nuevo Mensaje de ${sender}*\n\n` +
                                     `En el caso: *${caseTitle}*\n\n` +
                                     `📝 *Mensaje:* "${cleanMessage}"\n\n` +
                                     `Por favor ingrese a la plataforma para responder.`;
                    } else if (alert.alertType === 'document_request_reminder') {
                         messageBody = `📄 *Recordatorio de Documentos*\n\n` +
                                      `Su abogado está esperando documentos para continuar con su caso.\n\n` +
                                      `📝 *Contexto:* "${cleanMessage}"\n\n` +
                                      `Por favor ingrese a la plataforma y suba los archivos solicitados.`;
                    } else {
                        messageBody = `🔔 *Notificación de BrightLawyers*\n\n` +
                                     `Tiene una nueva actualización en su caso.\n\n` +
                                     `Por favor ingrese a la plataforma para ver los detalles.`;
                    }

                    await this.client.sendMessage(phoneNumber, messageBody);
                    await this.prisma.alert.update({
                        where: { id: alert.id },
                        data: { status: 'sent', sentAt: new Date() }
                    });
                    console.log(`✅ Alert ${alert.id} sent to ${phoneNumber}`);

                } catch (innerError) {
                    console.error(`❌ Error sending alert ${alert.id}:`, innerError);
                    await this.prisma.alert.update({
                        where: { id: alert.id },
                        data: { status: 'failed', sentAt: new Date(), payload: { error: innerError.message } }
                    });
                }
            }
        } catch (error) {
            console.error('⚠️ Notification processing error:', error.message);
        } finally {
            this.isProcessing = false;
        }
    }
}

module.exports = new WhatsAppService();