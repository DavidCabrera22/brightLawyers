const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Estadísticas del chatbot
let stats = {
    totalMessages: 0,
    activeUsers: new Set(),
    categoriesCount: {
        civil: 0,
        penal: 0,
        laboral: 0,
        familia: 0,
        administrativo: 0,
        comercial: 0,
        otro: 0
    }
};

app.use(express.static('public'));
app.use(express.json());

// Endpoint para estadísticas
app.get('/api/stats', (req, res) => {
    res.json({
        ...stats,
        activeUsers: stats.activeUsers.size
    });
});

// Dashboard HTML
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Dashboard Chatbot Legal</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .stat-card { background: #f5f5f5; padding: 20px; margin: 10px; border-radius: 8px; }
            .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        </style>
    </head>
    <body>
        <h1>🤖 Dashboard Chatbot Legal con IA</h1>
        <div class="grid" id="stats">
            <div class="stat-card">
                <h3>Mensajes Totales</h3>
                <p id="totalMessages">0</p>
            </div>
            <div class="stat-card">
                <h3>Usuarios Activos</h3>
                <p id="activeUsers">0</p>
            </div>
        </div>
        
        <script>
            async function updateStats() {
                const response = await fetch('/api/stats');
                const data = await response.json();
                document.getElementById('totalMessages').textContent = data.totalMessages;
                document.getElementById('activeUsers').textContent = data.activeUsers;
            }
            
            setInterval(updateStats, 5000);
            updateStats();
        </script>
    </body>
    </html>
    `);
});

app.listen(PORT, () => {
    console.log(`🌐 Dashboard disponible en http://localhost:${PORT}`);
});

module.exports = { app, stats };