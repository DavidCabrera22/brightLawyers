
// notification.js - Handles global notifications via Socket.IO

(function() {
    // Prevent multiple initializations
    if (window.NotificationSystem) return;
    
    window.NotificationSystem = {
        socket: null,
        init: function() {
            const token = localStorage.getItem('token');
            if (!token) return;

            // Connect to socket if not already connected (or reuse existing)
            // Note: messages.html might have its own socket. 
            // Ideally we share one connection, but for simplicity we can have a separate one or check window.socket
            
            const socketUrl = (typeof API_URL !== 'undefined') ? API_URL.replace('/api', '') : 'http://localhost:4000';
            
            // If window.socket exists and is connected, use it? 
            // Or just create a new manager. Socket.io handles multiplexing usually.
            
            this.socket = io(socketUrl, { 
                auth: { token },
                reconnection: true
            });

            this.socket.on('connect', () => {
                console.log('🔔 Notification System Connected');
            });

            this.socket.on('notification', (data) => {
                this.showToast(data);
                this.playNotificationSound();
                this.incrementBadge();
            });

            this.socket.on('messages_read', () => {
                this.fetchUnreadCount();
            });

            // Initial fetch
            this.fetchUnreadCount();
        },

        fetchUnreadCount: async function() {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`${API_URL}/messages/unread-count`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    this.updateBadgeUI(data.count);
                }
            } catch (e) {
                console.error('Failed to fetch unread count', e);
            }
        },

        updateBadgeUI: function(count) {
            // Find sidebar link for messages
            // Client sidebar: href="messages.html"
            // Lawyer sidebar: href="messages.html"
            const links = document.querySelectorAll('a[href="messages.html"], a[href="messages.html?"]');
            
            links.forEach(link => {
                // Remove existing badge
                const existing = link.querySelector('.notification-badge');
                if (existing) existing.remove();

                if (count > 0) {
                    const badge = document.createElement('span');
                    badge.className = 'notification-badge bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-auto';
                    badge.textContent = count > 99 ? '99+' : count;
                    link.appendChild(badge);
                }
            });
        },

        incrementBadge: function() {
            const badges = document.querySelectorAll('.notification-badge');
            if (badges.length === 0) {
                this.updateBadgeUI(1);
            } else {
                badges.forEach(b => {
                    let c = parseInt(b.textContent) || 0;
                    c++;
                    b.textContent = c > 99 ? '99+' : c;
                });
            }
        },

        showToast: function(data) {
            // Check if we are already in the chat for this case
            // If we are in messages.html and currentCaseId matches, don't show toast (optional)
            if (window.location.pathname.includes('messages.html') && 
                window.currentCaseId === data.data.caseId) {
                return;
            }

            const div = document.createElement('div');
            div.className = 'fixed top-4 right-4 bg-slate-800 text-white px-6 py-4 rounded-lg shadow-xl z-[9999] animate-bounce flex items-start gap-3 max-w-sm cursor-pointer hover:bg-slate-700 transition-colors';
            div.onclick = () => {
                // Navigate to messages
                if (window.location.pathname.includes('lawyer')) {
                    window.location.href = `messages.html?caseId=${data.data.caseId}`;
                } else {
                    window.location.href = `messages.html?caseId=${data.data.caseId}`;
                }
            };

            div.innerHTML = `
                <span class="material-symbols-outlined text-yellow-400 mt-1">notifications_active</span>
                <div>
                    <h4 class="font-bold text-sm">${data.title}</h4>
                    <p class="text-xs text-slate-300 mt-1">${data.body}</p>
                </div>
                <button class="ml-auto text-slate-400 hover:text-white" onclick="event.stopPropagation(); this.parentElement.remove()">×</button>
            `;

            document.body.appendChild(div);

            // Remove after 5 seconds
            setTimeout(() => {
                if (div.parentElement) div.remove();
            }, 5000);
        },

        playNotificationSound: function() {
            // Simple beep or soft sound
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.volume = 0.5;
                audio.play().catch(e => console.log('Audio play failed (user interaction needed first)'));
            } catch (e) {}
        },

    };

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => window.NotificationSystem.init());
    } else {
        window.NotificationSystem.init();
    }

})();
