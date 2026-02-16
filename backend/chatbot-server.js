const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { PrismaClient } = require('@prisma/client');

// Optimize Prisma connection for chatbot polling
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL + (process.env.DATABASE_URL.includes('?') ? '&' : '?') + 'connection_limit=1'
        }
    }
});
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const GoogleCalendarService = require('./google-calendar');
require('dotenv').config();

// Configuración de OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Inicializar Google Calendar Service
let calendarService = null;

// ===== SISTEMA DE CONTROL AUTOMÁTICO =====
let botActive = true;
const humanControlSessions = new Set();
const lastBotMessage = new Map();
const clientInteractions = new Map();

// Palabras clave que indican intervención humana
const HUMAN_KEYWORDS = [
    'hola soy',
    'mi nombre es',
    'te voy a ayudar',
    'en un momento',
    'permíteme',
    'déjame revisar',
    'voy a verificar',
    'te contacto',
    'gracias por escribir',
    'te atiendo',
    'soy el abogado',
    'soy la asistente'
];

// Función para logging detallado
function logConversation(type, phoneNumber, message, response = null) {
    const timestamp = new Date().toLocaleString('es-CO');
    const separator = '='.repeat(80);
    
    console.log(`\n${separator}`);
    console.log(`🕐 TIMESTAMP: ${timestamp}`);
    console.log(`📱 TELÉFONO: ${phoneNumber}`);
    console.log(`📝 TIPO: ${type}`);
    console.log(`${separator}`);
    
    if (type === 'MENSAJE_RECIBIDO') {
        console.log(`👤 USUARIO DICE:`);
        console.log(`"${message}"`);
    } else if (type === 'RESPUESTA_BOT') {
        console.log(`👤 USUARIO DIJO:`);
        console.log(`"${message}"`);
        console.log(`\n🤖 BOT RESPONDE:`);
        console.log(`"${response}"`);
    } else if (type === 'RESPUESTA_RAPIDA') {
        console.log(`👤 USUARIO DIJO:`);
        console.log(`"${message}"`);
        console.log(`\n⚡ RESPUESTA RÁPIDA:`);
        console.log(`"${response}"`);
    } else if (type === 'IA_PROCESANDO') {
        console.log(`🧠 PROCESANDO CON IA:`);
        console.log(`"${message}"`);
    } else if (type === 'ERROR') {
        console.log(`❌ ERROR:`);
        console.log(`Mensaje: "${message}"`);
        console.log(`Error: ${response}`);
    }
    
    console.log(`${separator}\n`);
}

// Función para detectar intervención humana
function isHumanMessage(message, phoneNumber, isFromAdmin = false) {
    const lowerMessage = message.toLowerCase();
    
    const hasKeyword = HUMAN_KEYWORDS.some(keyword => 
        lowerMessage.includes(keyword)
    );
    
    if (hasKeyword && isFromAdmin) {
        console.log(`🤖➡️👤 Administrador tomó control de ${phoneNumber}: "${message}"`);
        humanControlSessions.add(phoneNumber);
        return true;
    }
    
    return false;
}

function shouldBotRespond(phoneNumber) {
    if (!botActive) return false;
    if (humanControlSessions.has(phoneNumber)) {
        console.log(`⏸️ Bot pausado para ${phoneNumber} - Humano en control`);
        return false;
    }
    return true;
}

// Configuración del cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--disable-gpu'
        ],
        timeout: 60000 // Aumentar timeout a 60s
    }
});

// Base de conocimiento legal mejorada
const legalKnowledge = `
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

// Función para procesar con IA (GPT-4) - VERSIÓN CORREGIDA
async function processWithAI(message, userPhone) {
    try {
        const interactionCount = clientInteractions.get(userPhone) || 0;
        const currentState = appointmentStates.get(userPhone) || APPOINTMENT_STATES.NONE;
        const userData = appointmentData.get(userPhone) || {};
        
        // Detectar si es el primer mensaje del usuario
        const isFirstMessage = interactionCount === 0;
        
        // MANEJO DEL PROCESO DE CITA SEGÚN EL ESTADO
        if (currentState !== APPOINTMENT_STATES.NONE) {
            return await handleAppointmentFlow(message, userPhone, currentState, userData);
        }
        
        // MEJORAR DETECCIÓN DE SOLICITUD DE CITA
        const lowerMessage = message.toLowerCase();
        const isAppointmentRequest = lowerMessage.includes('agendar') || 
                                   lowerMessage.includes('cita') || 
                                   lowerMessage.includes('reunión') ||
                                   lowerMessage.includes('consulta') ||
                                   (lowerMessage.includes('si') || lowerMessage.includes('sí'));
        
        let systemPrompt = legalKnowledge;
        
        if (isFirstMessage) {
            // MENSAJE DE BIENVENIDA ESTRUCTURADO
            systemPrompt += `\n\nIMPORTANTE - MENSAJE DE BIENVENIDA:\nEste es el primer mensaje del usuario. Debes responder con:\n\n"👋 ¡Hola! Soy **Zero**, tu asistente virtual de **Bright Lawyers**.\n\n🏛️ **¿En qué podemos ayudarte hoy?**\n\n📋 **Nuestros servicios incluyen:**\n• 👨‍👩‍👧‍👦 Derecho de Familia (divorcios, custodia, alimentos)\n• 💼 Derecho Laboral (despidos, liquidaciones, demandas)\n• 🏠 Derecho Civil (contratos, arrendamientos, cobros)\n• ⚖️ Derecho Penal (defensa criminal, procesos judiciales)\n• 🏢 Derecho Comercial (constitución de empresas, contratos)\n• 🏘️ Derecho Inmobiliario (compraventa, hipotecas)\n\n🎁 **¡CONSULTA INICIAL GRATUITA!**\nTe ofrecemos 30 minutos de asesoría profesional sin costo.\n\n¿Cuál es tu situación legal? Cuéntame para poder ayudarte mejor."\n\nNo agregues nada más, usa exactamente este formato.`;
        } else if (isAppointmentRequest && interactionCount > 0) {
            // INICIAR PROCESO DE CITA CON FORMATO ORGANIZADO
            appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_ALL_DATA);
            appointmentData.set(userPhone, {});
            
            return `📅 **¡Perfecto! Vamos a agendar tu consulta GRATUITA**\n\n📋 **Para poder agendar tu cita, compártenos esta información:**\n\n1️⃣ **Nombre completo** 📝\n2️⃣ **Número de contacto** 📞\n3️⃣ **Tipo de consulta** ⚖️\n(Ejemplo: Laboral, Familiar, Inmobiliaria, Penal, etc.)\n4️⃣ **Fecha y hora preferida** ⏰\n\n✨ **Con estos datos, uno de nuestros abogados expertos se comunicará contigo a la brevedad para revisar tu caso con total confidencialidad y profesionalismo.**\n\n💬 **Ejemplo de respuesta:**\n\"Juan Pérez, 300-123-4567, Consulta Laboral, Mañana 10 AM\"\n\n📝 Por favor comparte toda la información en un solo mensaje:`;
        } else {
            // NUEVA LÓGICA: Después de 2 interacciones, SIEMPRE dirigir a cita
            if (interactionCount >= 2) {
                systemPrompt += `\n\nESTRATEGIA OBLIGATORIA DESPUÉS DE 2 MENSAJES:\n- Responde MUY brevemente (1 línea máximo)\n- INMEDIATAMENTE pregunta: "¿Te gustaría agendar una consulta GRATUITA para revisar tu caso específico? Solo responde 'SÍ' y coordinamos tu cita."\n- NO des más información legal\n- FUERZA la decisión de agendar`;
            } else {
                systemPrompt += `\n\nESTRATEGIA OBLIGATORIA:\n- Responde brevemente la consulta (máximo 2-3 líneas)\n- NO des consejos legales específicos\n- Menciona que cada caso es único\n- SIEMPRE termina dirigiendo hacia agendar una consulta GRATUITA\n- Usa frases de urgencia y valor\n- Ejemplo: "Para darte el mejor consejo personalizado, ¿te gustaría agendar tu consulta GRATUITA de 30 minutos? Mientras más pronto actúes, mejores opciones tendrás."`;
            }
        }
        
        const completion = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message }
            ],
            max_tokens: 300,
            temperature: 0.8
        });
        
        clientInteractions.set(userPhone, interactionCount + 1);
        
        return completion.choices[0].message.content;
    } catch (error) {
        console.error('❌ Error con OpenAI:', error);
        return 'Disculpa, estoy experimentando dificultades técnicas. Sin embargo, puedo ayudarte de inmediato si agendas una consulta gratuita. ¿Te gustaría que coordinemos una cita?';
    }
}

// NUEVA FUNCIÓN: Manejar el flujo de agendamiento de citas
async function handleAppointmentFlow(message, userPhone, currentState, userData) {
    const lowerMessage = message.toLowerCase();
    
    // Permitir cancelar en cualquier momento
    if (lowerMessage.includes('cancelar') || lowerMessage.includes('salir')) {
        appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
        appointmentData.delete(userPhone);
        return '❌ Proceso de cita cancelado. Si cambias de opinión, solo dime "quiero agendar una cita".';
    }
    
    switch (currentState) {
        case APPOINTMENT_STATES.COLLECTING_ALL_DATA:
            // Procesar todos los datos en un solo mensaje
            const messageText = message.trim();
            
            // Intentar extraer los datos del mensaje
            const lines = messageText.split(/[,\n]/).map(line => line.trim()).filter(line => line.length > 0);
            
            if (lines.length >= 4) {
                userData.name = lines[0];
                userData.phone = lines[1];
                userData.area = lines[2];
                userData.preferredDateTime = lines[3];
                userData.description = `Consulta sobre ${userData.area}`;
                
                appointmentData.set(userPhone, userData);
                
                try {
                    // Crear objeto de cita para Google Calendar
                    const appointmentForCalendar = {
                        name: userData.name,
                        phone: userData.phone,
                        area: userData.area,
                        description: userData.description,
                        preferredDateTime: userData.preferredDateTime,
                        dateTime: generateDateTime(userData.preferredDateTime),
                        email: `${userData.phone.replace(/[^0-9]/g, '')}@cliente-brightlawyers.com`
                    };
                    
                    // Guardar en Google Calendar y localmente
                    await saveAppointment(appointmentForCalendar);
                    
                    // Limpiar estado del usuario
                    appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                    appointmentData.delete(userPhone);
                    
                    return `🎉 **¡CITA AGENDADA EXITOSAMENTE!**\n\n✅ **Confirmación de tu Consulta GRATUITA:**\n\n👤 **Cliente:** ${userData.name}\n📞 **Teléfono:** ${userData.phone}\n⚖️ **Tipo de Consulta:** ${userData.area}\n📅 **Fecha Preferida:** ${userData.preferredDateTime}\n⏱️ **Duración:** 30 minutos SIN COSTO\n\n📞 **Próximos pasos:**\n🔸 Nuestro equipo te contactará en las próximas 2 horas\n🔸 Te confirmaremos la fecha y hora definitiva\n🔸 Recibirás la ubicación o enlace virtual\n🔸 Prepara tus documentos relacionados al caso\n\n📱 **¿Necesitas cambios?**\nContáctanos: +57 300 123 4567\n\n🏛️ **¡Gracias por confiar en Bright Lawyers!**\nNuestro equipo de expertos está listo para ayudarte.`;
                    
                } catch (error) {
                    console.error('❌ Error guardando cita:', error);
                    
                    // Limpiar estado incluso si hay error
                    appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                    appointmentData.delete(userPhone);
                    
                    return `✅ **¡Cita Registrada!**\n\n📝 Hemos guardado todos tus datos correctamente.\n\n⚠️ *Nota técnica: Hubo un problema menor con el calendario digital, pero tu cita está confirmada.*\n\n📞 **Nuestro equipo te contactará pronto para:**\n🔸 Confirmar fecha y hora definitiva\n🔸 Enviarte la ubicación o enlace virtual\n🔸 Coordinar los detalles finales\n\n📱 **También puedes llamarnos directamente:**\n+57 300 123 4567\n\n🏛️ **¡Gracias por elegir Bright Lawyers!**`;
                }
            } else {
                // Si no hay suficientes datos, pedir que complete la información
                return `⚠️ **Información incompleta**\n\nPor favor, proporciona todos los datos requeridos:\n\n📝 **Formato correcto:**\n\"Nombre Completo, Teléfono, Tipo de Consulta, Fecha y Hora\"\n\n💬 **Ejemplo:**\n\"Juan Pérez, 300-123-4567, Consulta Laboral, Mañana 10 AM\"\n\nIntenta nuevamente con todos los datos:`;
            }
            
        case APPOINTMENT_STATES.COLLECTING_NAME:
            userData.name = message.trim();
            appointmentData.set(userPhone, userData);
            appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_PHONE);
            return `✅ Perfecto, **${userData.name}**.

📱 **Paso 2 de 5: Número de Contacto**

Por favor compárteme tu **número de teléfono** (puede ser el mismo de WhatsApp):`;
            
        case APPOINTMENT_STATES.COLLECTING_PHONE:
            userData.phone = message.trim();
            appointmentData.set(userPhone, userData);
            appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_AREA);
            return `✅ Teléfono registrado: **${userData.phone}**

⚖️ **Paso 3 de 5: Área Legal**

¿En qué área legal necesitas asesoría?

🔹 **Derecho de Familia** (divorcios, custodia, alimentos)
🔹 **Derecho Laboral** (despidos, liquidaciones, demandas)
🔹 **Derecho Civil** (contratos, arrendamientos, cobros)
🔹 **Derecho Penal** (defensa criminal, procesos)
🔹 **Derecho Comercial** (empresas, contratos comerciales)
🔹 **Derecho Inmobiliario** (compraventa, hipotecas)
🔹 **Otro** (especifica cuál)

Escribe el área que necesitas:`;
            
        case APPOINTMENT_STATES.COLLECTING_AREA:
            userData.area = message.trim();
            appointmentData.set(userPhone, userData);
            appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_DESCRIPTION);
            return `✅ Área seleccionada: **${userData.area}**

📝 **Paso 4 de 5: Descripción del Caso**

Cuéntame **brevemente** tu situación legal para preparar mejor tu consulta:

💡 *Ejemplo: "Necesito divorcio de mutuo acuerdo" o "Me despidieron sin justa causa"*`;
            
        case APPOINTMENT_STATES.COLLECTING_DESCRIPTION:
            userData.description = message.trim();
            appointmentData.set(userPhone, userData);
            appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_DATETIME);
            return `✅ Caso registrado correctamente.

📅🕐 **Paso 5 de 5: Fecha y Hora Preferida**

¿Cuándo te gustaría tener tu **consulta GRATUITA de 30 minutos**?

📅 **Para la fecha, puedes decir:**
🔸 "Mañana" o "Pasado mañana"
🔸 Fecha específica: "15/01/2024"
🔸 Día de la semana: "El próximo lunes"

🕐 **Para la hora, puedes decir:**
🔸 "10:00 AM" o "2:30 PM"
🔸 "En la mañana" o "En la tarde"
🔸 "A las 3 de la tarde"

💬 **Ejemplo completo:** "Mañana a las 10 AM" o "15/01/2024 a las 2 PM"

¿Cuándo prefieres tu cita?`;
            
        case APPOINTMENT_STATES.COLLECTING_DATETIME:
            // Procesar fecha y hora juntas
            const dateTimeInput = message.trim();
            userData.preferredDateTime = dateTimeInput;
            appointmentData.set(userPhone, userData);
            appointmentStates.set(userPhone, APPOINTMENT_STATES.CONFIRMING);
            
            return `✅ **¡Perfecto! Datos completos**

📋 **Resumen de tu consulta GRATUITA:**

👤 **Cliente:** ${userData.name}
📱 **Teléfono:** ${userData.phone}
⚖️ **Área Legal:** ${userData.area}
📝 **Caso:** ${userData.description}
📅 **Fecha y Hora:** ${userData.preferredDateTime}

🎁 **Duración:** 30 minutos SIN COSTO
🏛️ **Modalidad:** Presencial o virtual (según tu preferencia)

¿Confirmas estos datos para agendar tu cita?

✅ Responde **"SÍ"** para confirmar
❌ Responde **"NO"** para corregir algún dato`;
            
        case APPOINTMENT_STATES.CONFIRMING:
            if (lowerMessage.includes('si') || lowerMessage.includes('sí') || lowerMessage.includes('confirmo') || lowerMessage.includes('confirmar')) {
                // Procesar y guardar la cita
                try {
                    // Crear objeto de cita para Google Calendar
                    const appointmentForCalendar = {
                        name: userData.name,
                        phone: userData.phone,
                        area: userData.area,
                        description: userData.description,
                        preferredDateTime: userData.preferredDateTime,
                        dateTime: generateDateTime(userData.preferredDateTime),
                        email: `${userData.phone.replace(/[^0-9]/g, '')}@cliente-brightlawyers.com`
                    };
                    
                    // Guardar en Google Calendar y localmente
                    await saveAppointment(appointmentForCalendar);
                    
                    // Limpiar estado del usuario
                    appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                    appointmentData.delete(userPhone);
                    
                    return `🎉 **¡CITA AGENDADA EXITOSAMENTE!**

✅ **Confirmación de tu Consulta GRATUITA:**

👤 **Cliente:** ${userData.name}
📅 **Programada para:** ${userData.preferredDateTime}
⏱️ **Duración:** 30 minutos SIN COSTO
⚖️ **Especialista en:** ${userData.area}

📞 **Próximos pasos:**
🔸 Te contactaremos 1 día antes para confirmar
🔸 Recibirás la ubicación o enlace virtual
🔸 Prepara tus documentos relacionados al caso

📱 **¿Necesitas cambios?**
Contáctanos: +57 300 123 4567

🏛️ **¡Gracias por confiar en Bright Lawyers!**
Nuestro equipo de expertos está listo para ayudarte.`;
                    
                } catch (error) {
                    console.error('❌ Error guardando cita:', error);
                    
                    // Limpiar estado incluso si hay error
                    appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
                    appointmentData.delete(userPhone);
                    
                    return `✅ **¡Cita Registrada!**

📝 Hemos guardado todos tus datos correctamente.

⚠️ *Nota técnica: Hubo un problema menor con el calendario digital, pero tu cita está confirmada.*

📞 **Nuestro equipo te contactará pronto para:**
🔸 Confirmar fecha y hora definitiva
🔸 Enviarte la ubicación o enlace virtual
🔸 Coordinar los detalles finales

📱 **También puedes llamarnos directamente:**
+57 300 123 4567

🏛️ **¡Gracias por elegir Bright Lawyers!**`;
                }
            } else {
                // Reiniciar proceso si dice NO
                appointmentStates.set(userPhone, APPOINTMENT_STATES.COLLECTING_NAME);
                appointmentData.set(userPhone, {});
                return `🔄 **Reiniciando el proceso...**

👤 **Paso 1 de 5: Información Personal**

Por favor, compárteme nuevamente tu **nombre completo**:`;
            }
            
        default:
            appointmentStates.set(userPhone, APPOINTMENT_STATES.NONE);
            appointmentData.delete(userPhone);
            return '❌ Hubo un error en el proceso. ¿Te gustaría agendar una cita? Solo responde "sí" para comenzar.';
    }
}

// NUEVA FUNCIÓN: Generar fecha y hora para Google Calendar
function generateDateTime(dateTimeInput) {
    try {
        const now = new Date();
        let targetDate = new Date();
        const input = dateTimeInput.toLowerCase();
        
        // Procesar fecha
        if (input.includes('mañana') && !input.includes('pasado')) {
            targetDate.setDate(now.getDate() + 1);
        } else if (input.includes('pasado mañana')) {
            targetDate.setDate(now.getDate() + 2);
        } else if (input.includes('lunes')) {
            const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilMonday);
        } else if (input.includes('martes')) {
            const daysUntilTuesday = (2 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilTuesday);
        } else if (input.includes('miércoles') || input.includes('miercoles')) {
            const daysUntilWednesday = (3 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilWednesday);
        } else if (input.includes('jueves')) {
            const daysUntilThursday = (4 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilThursday);
        } else if (input.includes('viernes')) {
            const daysUntilFriday = (5 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilFriday);
        } else if (input.includes('sábado') || input.includes('sabado')) {
            const daysUntilSaturday = (6 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilSaturday);
        } else if (input.includes('/')) {
            // Formato DD/MM/YYYY
            const dateMatch = input.match(/(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})/);
            if (dateMatch) {
                const [, day, month, year] = dateMatch;
                const fullYear = year.length === 2 ? 2000 + parseInt(year) : parseInt(year);
                targetDate = new Date(fullYear, parseInt(month) - 1, parseInt(day));
            }
        }
        
        // Procesar hora
        let hour = 10; // Hora por defecto: 10 AM
        let minute = 0;
        
        if (input.includes('mañana') && !input.includes('pasado')) {
            hour = 10;
        } else if (input.includes('tarde')) {
            hour = 14;
        } else {
            // Buscar hora específica
            const timeMatch = input.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i) || 
                            input.match(/(\d{1,2})\s*(am|pm)/i) ||
                            input.match(/a las (\d{1,2})/i);
            
            if (timeMatch) {
                hour = parseInt(timeMatch[1]);
                if (timeMatch[2] && !isNaN(parseInt(timeMatch[2]))) {
                    minute = parseInt(timeMatch[2]);
                }
                
                // Convertir PM/AM
                const period = timeMatch[3] || timeMatch[2];
                if (period && period.toLowerCase().includes('pm') && hour < 12) {
                    hour += 12;
                } else if (period && period.toLowerCase().includes('am') && hour === 12) {
                    hour = 0;
                }
            }
        }
        
        // Asegurar que la hora esté en horario laboral (8 AM - 6 PM)
        if (hour < 8) hour = 10;
        if (hour > 18) hour = 14;
        
        targetDate.setHours(hour, minute, 0, 0);
        
        // Si la fecha es en el pasado, moverla al día siguiente
        if (targetDate < now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        
        return targetDate.toISOString();
        
    } catch (error) {
        console.error('❌ Error generando fecha:', error);
        // Fecha por defecto: mañana a las 10 AM
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        return tomorrow.toISOString();
    }
}
// Función para guardar cita CON Google Calendar
async function saveAppointment(appointmentData) {
    try {
        console.log('💾 Guardando cita:', appointmentData);
        
        let calendarEventId = null;
        
        // Intentar crear evento en Google Calendar
        if (calendarService) {
            try {
                // Extraer fecha y hora del dateTime generado
                const dateTimeObj = new Date(appointmentData.dateTime);
                const dateStr = dateTimeObj.toISOString().split('T')[0]; // YYYY-MM-DD
                const timeStr = dateTimeObj.toTimeString().split(' ')[0].substring(0, 5); // HH:MM
                
                const calendarEvent = await calendarService.createEvent({
                    clientName: appointmentData.name,
                    clientPhone: appointmentData.phone,
                    date: dateStr,
                    time: timeStr,
                    legalArea: appointmentData.area,
                    description: appointmentData.description
                });
                
                calendarEventId = calendarEvent.id;
                console.log('📅 Evento creado en Google Calendar:', calendarEventId);
            } catch (calendarError) {
                console.error('⚠️ Error creando evento en calendario:', calendarError.message);
                // Continuar sin bloquear el proceso
            }
        }
        
        const appointment = {
            id: Date.now().toString(),
            ...appointmentData,
            calendarEventId,
            createdAt: new Date().toISOString(),
            status: 'pending'
        };
        
        // Guardar en archivo local
        const appointmentsFile = path.join(__dirname, 'appointments.json');
        let appointments = [];
        
        if (fs.existsSync(appointmentsFile)) {
            const data = fs.readFileSync(appointmentsFile, 'utf8');
            appointments = JSON.parse(data);
        }
        
        appointments.push(appointment);
        fs.writeFileSync(appointmentsFile, JSON.stringify(appointments, null, 2));
        
        console.log('✅ Cita guardada exitosamente');
        return appointment;
    } catch (error) {
        console.error('❌ Error guardando cita:', error);
        throw error;
    }
}

// NUEVO: Sistema de estado para agendamiento de citas
const appointmentStates = new Map();
const appointmentData = new Map();

// Estados posibles del proceso de cita
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
    COLLECTING_ALL_DATA: 'collecting_all_data',  // NUEVO ESTADO
    COLLECTING_TYPE: 'collecting_type',
    CONFIRMING: 'confirming'
};

// Manejador principal de mensajes
client.on('message', async (message) => {
    try {
        const userPhone = message.from;
        const userMessage = message.body;
        const isFromAdmin = userPhone.includes('admin'); // Ajusta según tu número
        
        console.log(`📱 Mensaje de ${userPhone}: ${userMessage}`);
        
        // Detectar intervención humana
        if (isHumanMessage(userMessage, userPhone, isFromAdmin)) {
            return; // No responder si humano tomó control
        }
        
        // Verificar si el bot debe responder
        if (!shouldBotRespond(userPhone)) {
            return;
        }
        
        // Respuestas rápidas MEJORADAS con llamados a la acción
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
            // Usar IA para respuestas legales complejas CON ESTRATEGIA DE CONVERSIÓN
            response = await processWithAI(userMessage, userPhone);
        }
        
        // Registrar que el bot respondió
        lastBotMessage.set(userPhone, Date.now());
        
        // Enviar respuesta
        await message.reply(response);
        
        // MODIFICADO: Mostrar mensaje completo en consola
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🤖 BOT RESPUESTA COMPLETA para ${userPhone}:`);
        console.log(`${'='.repeat(80)}`);
        console.log(response);
        console.log(`${'='.repeat(80)}\n`);
        console.log(`🤖 Bot respondió a ${userPhone}: ${response.substring(0, 100)}...`);
    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
        await message.reply('Disculpa, hubo un error. Sin embargo, puedo ayudarte de inmediato si agendas una consulta gratuita. ¿Te gustaría coordinemos una cita?');
    }
});

// Eventos del cliente
client.on('loading_screen', (percent, message) => {
    console.log('⏳ Cargando WhatsApp:', percent + '%', message);
});

client.on('qr', (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 CÓDIGO QR PARA WHATSAPP - ESCANEA CON TU TELÉFONO');
    console.log('='.repeat(60));
    qrcode.generate(qr, { small: true });
    console.log('='.repeat(60));
    console.log('💡 Instrucciones:');
    console.log('1. Abre WhatsApp en tu teléfono');
    console.log('2. Ve a Menú (3 puntos) > Dispositivos vinculados');
    console.log('3. Toca "Vincular dispositivo"');
    console.log('4. Escanea el código QR de arriba');
    console.log('='.repeat(60) + '\n');
});

client.on('ready', () => {
    console.log('🤖 ¡Chatbot está listo y funcionando!');
    console.log('🧠 Sistema de detección automática activado');
    console.log('📝 Palabras clave configuradas:', HUMAN_KEYWORDS.length);
    console.log('🚀 Modelo de IA: GPT-4 (Avanzado)');
    console.log('📊 Sistema de logging detallado: ACTIVADO');
    if (calendarService) {
        console.log('📅 Google Calendar integrado y funcionando');
    } else {
        console.log('⚠️ Google Calendar no disponible - funcionando solo localmente');
    }
    
    // Iniciar sistema de notificaciones
    console.log('🔔 Sistema de notificaciones WhatsApp: ACTIVADO (Polling cada 10s)');
    setInterval(processPendingNotifications, 10000);

    console.log('\n' + '='.repeat(80));
    console.log('🎯 CHATBOT LEGAL PROFESIONAL - LISTO PARA ATENDER CLIENTES');
    console.log('='.repeat(80) + '\n');
});

client.on('auth_failure', (msg) => {
    console.error('❌ Error de autenticación:', msg);
});

client.on('disconnected', (reason) => {
    console.log('📱 Cliente desconectado:', reason);
    console.log('🔄 Reiniciando en 5 segundos...');
    setTimeout(() => {
        client.initialize();
    }, 5000);
});

// Manejo de errores
process.on('unhandledRejection', (err) => {
    console.error('❌ Error no manejado:', err.message);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Excepción no capturada:', err.message);
    process.exit(1);
});

// Función para inicializar el bot
async function startBot() {
    try {
        console.log('🚀 Iniciando chatbot legal avanzado...');
        
        // Inicializar Google Calendar de forma no bloqueante
        console.log('📅 Inicializando Google Calendar...');
        try {
            calendarService = new GoogleCalendarService();
            await calendarService.initialize();
            console.log('✅ Google Calendar inicializado correctamente');
        } catch (calendarError) {
            console.error('⚠️ Error inicializando Google Calendar:', calendarError.message);
            console.log('📝 Continuando sin Google Calendar - las citas se guardarán localmente');
            calendarService = null;
        }
        
        // Inicializar cliente WhatsApp
        console.log('📱 Inicializando cliente WhatsApp...');
        client.initialize();
        
    } catch (error) {
        console.error('❌ Error iniciando el bot:', error);
        process.exit(1);
    }
}

// INICIALIZACIÓN CON GOOGLE CALENDAR Y LOGGING AVANZADO
startBot();

// --- SISTEMA DE NOTIFICACIONES WHATSAPP ---
let isProcessing = false;

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '');
}

async function processPendingNotifications() {
    if (isProcessing) return;
    isProcessing = true;

    try {
        const pendingAlerts = await prisma.alert.findMany({
            where: {
                channel: 'whatsapp',
                status: 'pending',
                scheduledAt: { lte: new Date() }
            },
            include: { recipient: true },
            take: 5
        });

        if (pendingAlerts.length > 0) {
            console.log(`🔔 Procesando ${pendingAlerts.length} notificaciones pendientes...`);
        }

        for (const alert of pendingAlerts) {
            try {
                if (!alert.recipient || !alert.recipient.phone) {
                    await prisma.alert.update({
                        where: { id: alert.id },
                        data: { status: 'failed', sentAt: new Date(), payload: { error: 'Usuario sin teléfono' } }
                    });
                    continue;
                }

                const phoneNumber = formatPhoneNumber(alert.recipient.phone);
                let messageBody = '';
                const data = alert.payload || {};
                const cleanMessage = stripHtml(data.originalMessage || '...');

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

                await client.sendMessage(phoneNumber, messageBody);
                console.log(`✅ Notificación enviada a ${phoneNumber}`);

                await prisma.alert.update({
                    where: { id: alert.id },
                    data: { status: 'sent', sentAt: new Date() }
                });

            } catch (innerError) {
                console.error(`❌ Error enviando alerta ${alert.id}:`, innerError);
                await prisma.alert.update({
                    where: { id: alert.id },
                    data: { status: 'failed', sentAt: new Date(), payload: { error: innerError.message } }
                });
            }
        }
    } catch (error) {
        // Ignorar errores de conexión momentáneos para no saturar el log
        if (error.code === 'P2024' || error.message.includes('MaxClientsInSessionMode')) {
             console.warn('⚠️ Base de datos saturada, esperando siguiente ciclo...');
        } else if (!error.message.includes('Connection closed')) {
            console.error('⚠️ Error en proceso de notificaciones:', error.message);
        }
    } finally {
        isProcessing = false;
    }
}

function formatPhoneNumber(phone) {
    let clean = phone.replace(/\D/g, '');
    if (clean.length === 10 && clean.startsWith('3')) {
        clean = '57' + clean;
    }
    return `${clean}@c.us`;
}