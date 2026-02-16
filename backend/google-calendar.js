const { google } = require('googleapis');
const path = require('path');

// Cargar variables de entorno explícitamente
require('dotenv').config();

const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const USER_CALENDAR_EMAIL = process.env.USER_CALENDAR_EMAIL;

class GoogleCalendarService {
    constructor() {
        this.calendar = null;
        this.auth = null;
    }

    async initialize() {
        try {
            console.log('📅 Inicializando Google Calendar...');
            
            let credentials;
            
            // Intentar cargar credenciales desde variable de entorno primero (para Render)
            if (process.env.GOOGLE_CREDENTIALS_JSON) {
                try {
                    console.log('🔑 Usando credenciales desde GOOGLE_CREDENTIALS_JSON');
                    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
                } catch (e) {
                    console.error('❌ Error al parsear GOOGLE_CREDENTIALS_JSON:', e.message);
                }
            }

            // Si no hay variable de entorno o falló el parseo, intentar archivo local
            if (!credentials) {
                try {
                    console.log('📂 Buscando archivo credentials.json local...');
                    credentials = require(CREDENTIALS_PATH);
                    console.log('✅ Archivo credentials.json cargado exitosamente');
                } catch (e) {
                    console.warn('⚠️ No se encontró credentials.json local o es inválido');
                }
            }

            if (!credentials) {
                throw new Error('No se encontraron credenciales de Google Calendar (ni ENV ni archivo)');
            }
            
            // Configurar autenticación
            this.auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/calendar']
            });
            
            // Crear cliente de Calendar
            this.calendar = google.calendar({ version: 'v3', auth: this.auth });
            
            console.log('✅ Google Calendar inicializado correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando Google Calendar:', error.message);
            return false;
        }
    }

    // Función para parsear fecha y hora
    parseDateTime(dateStr, timeStr) {
        try {
            // Formato esperado: "2024-01-15" y "14:30"
            const [year, month, day] = dateStr.split('-').map(Number);
            const [hours, minutes] = timeStr.split(':').map(Number);
            
            // Crear fecha en zona horaria de Colombia (UTC-5)
            const date = new Date();
            date.setFullYear(year);
            date.setMonth(month - 1); // Los meses en JS van de 0-11
            date.setDate(day);
            date.setHours(hours);
            date.setMinutes(minutes);
            date.setSeconds(0);
            date.setMilliseconds(0);
            
            return date;
        } catch (error) {
            console.error('❌ Error parseando fecha/hora:', error);
            return new Date(); // Retornar fecha actual como fallback
        }
    }

    async createEvent(appointmentData) {
        if (!this.calendar) {
            throw new Error('Google Calendar no está inicializado');
        }

        try {
            // Normalizar datos de entrada
            const {
                clientName = 'Cliente',
                clientPhone = 'No especificado',
                date = new Date().toISOString().split('T')[0],
                time = '10:00',
                legalArea = 'Consulta general',
                description = 'Cita agendada desde WhatsApp'
            } = appointmentData;

            // Parsear fecha y hora
            const startDate = this.parseDateTime(date, time);
            const endDate = new Date(startDate.getTime() + (60 * 60 * 1000)); // +1 hora

            // Logging para diagnóstico
            console.log('🔧 Variables de entorno:');
            console.log('   USER_CALENDAR_EMAIL:', USER_CALENDAR_EMAIL);
            console.log('   Tipo:', typeof USER_CALENDAR_EMAIL);
            console.log('   Longitud:', USER_CALENDAR_EMAIL ? USER_CALENDAR_EMAIL.length : 'undefined');

            // Usar email por defecto si no está configurado
            const calendarEmail = USER_CALENDAR_EMAIL || 'brightpeople00@gmail.com';
            console.log('📧 Email del calendario a usar:', calendarEmail);
            console.log('📅 Fecha procesada:', startDate.toISOString());

            // Configurar evento
            const event = {
                summary: `Cita Legal - ${clientName}`,
                description: `Cliente: ${clientName}\nTeléfono: ${clientPhone}\nÁrea: ${legalArea}\nDescripción: ${description}\n\n📧 Email generado: ${clientPhone.replace(/\\D/g, '')}@cliente-brightlawyers.com`,
                start: {
                    dateTime: startDate.toISOString(),
                    timeZone: 'America/Bogota'
                },
                end: {
                    dateTime: endDate.toISOString(),
                    timeZone: 'America/Bogota'
                },
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 }, // 1 día antes
                        { method: 'popup', minutes: 30 } // 30 min antes
                    ]
                }
            };

            console.log('📅 Creando evento en calendario...');
            console.log('🔧 Configuración del evento:', JSON.stringify(event, null, 2));
            
            // Intentar insertar en el calendario del usuario
            let result;
            try {
                result = await this.calendar.events.insert({
                    calendarId: calendarEmail,
                    resource: event
                });
                console.log('✅ Evento creado en calendario del usuario');
            } catch (userCalendarError) {
                console.log('⚠️ Error en calendario del usuario:', userCalendarError.message);
                console.log('🔄 Intentando calendario primario...');
                // Fallback: intentar con calendario primario
                result = await this.calendar.events.insert({
                    calendarId: 'primary',
                    resource: event
                });
                console.log('✅ Evento creado en calendario primario');
            }

            return result.data;
        } catch (error) {
            console.error('❌ Error detallado creando evento:', {
                message: error.message,
                stack: error.stack,
                details: error.details || 'No hay detalles adicionales'
            });
            throw error;
        }
    }
}

module.exports = GoogleCalendarService;