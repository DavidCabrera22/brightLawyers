const OpenAI = require('openai');

class LegalAI {
    constructor(apiKey) {
        this.openai = new OpenAI({ apiKey });
        this.conversationHistory = new Map();
    }
    
    // Clasificar tipo de consulta legal
    async classifyLegalQuery(message) {
        const prompt = `
        Clasifica esta consulta legal en una de estas categorías:
        - civil
        - penal
        - laboral
        - familia
        - administrativo
        - comercial
        - otro
        
        Consulta: "${message}"
        
        Responde solo con la categoría.
        `;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 10
            });
            
            return response.choices[0].message.content.trim().toLowerCase();
        } catch (error) {
            return 'otro';
        }
    }
    
    // Generar respuesta legal especializada
    async generateLegalResponse(message, category, userPhone) {
        // Obtener historial de conversación
        let history = this.conversationHistory.get(userPhone) || [];
        
        const systemPrompt = this.getSystemPromptByCategory(category);
        
        const messages = [
            { role: "system", content: systemPrompt },
            ...history,
            { role: "user", content: message }
        ];
        
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: messages,
                max_tokens: 600,
                temperature: 0.7
            });
            
            const aiResponse = response.choices[0].message.content;
            
            // Actualizar historial
            history.push({ role: "user", content: message });
            history.push({ role: "assistant", content: aiResponse });
            
            // Mantener solo los últimos 10 mensajes
            if (history.length > 10) {
                history = history.slice(-10);
            }
            
            this.conversationHistory.set(userPhone, history);
            
            return aiResponse;
        } catch (error) {
            console.error('Error generando respuesta:', error);
            return "Disculpa, tengo problemas técnicos. Un abogado te contactará pronto.";
        }
    }
    
    getSystemPromptByCategory(category) {
        const prompts = {
            civil: "Eres un experto en derecho civil colombiano. Proporciona información precisa sobre contratos, responsabilidad civil, propiedad, etc.",
            penal: "Eres un experto en derecho penal colombiano. Ayuda con consultas sobre delitos, procedimientos penales, derechos del acusado, etc.",
            laboral: "Eres un experto en derecho laboral colombiano. Asiste con temas de contratos laborales, despidos, prestaciones, etc.",
            familia: "Eres un experto en derecho de familia colombiano. Ayuda con divorcios, custodia, alimentos, adopción, etc.",
            administrativo: "Eres un experto en derecho administrativo colombiano. Asiste con temas gubernamentales, licencias, permisos, etc.",
            comercial: "Eres un experto en derecho comercial colombiano. Ayuda con sociedades, contratos comerciales, quiebras, etc."
        };
        
        return prompts[category] || "Eres un asistente legal general especializado en derecho colombiano.";
    }
    
    // Limpiar historial de conversación
    clearHistory(userPhone) {
        this.conversationHistory.delete(userPhone);
    }
}

module.exports = LegalAI;