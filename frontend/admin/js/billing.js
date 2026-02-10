const API_URL = 'http://localhost:4000/api';
const authToken = localStorage.getItem('token');

if (!authToken) {
    window.location.href = '../index.html';
}

async function init() {
    // Load sidebar profile
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (document.getElementById('sidebarName')) {
        document.getElementById('sidebarName').textContent = user.fullName || 'Usuario';
    }
    if (document.getElementById('sidebarRole')) {
        document.getElementById('sidebarRole').textContent = (user.userRoles?.[0]?.role?.name || 'Rol').toUpperCase();
    }
    if (document.getElementById('sidebarAvatar')) {
        const initials = (user.fullName || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        document.getElementById('sidebarAvatar').textContent = initials;
    }

    // Admin Dashboard Link Logic
    const isAdmin = user.userRoles?.some(ur => ur.role?.name === 'admin' || ur.role?.name === 'administrador');
    const dashLink = document.getElementById('dashLink');
    if (isAdmin && dashLink) {
        dashLink.href = 'admin.html';
    }

    loadInvoices();
    setupEventListeners();

    // Check URL params for auto-creation
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('create') === 'true') {
        const clientId = urlParams.get('clientId');
        const caseId = urlParams.get('caseId');
        const amount = urlParams.get('amount');
        
        await openInvoiceModal();
        
        if (clientId) {
            // Wait a bit for dropdown to populate or set value directly
            setTimeout(() => {
                const clientSelect = document.getElementById('invoiceClientId');
                if (clientSelect) clientSelect.value = clientId;
            }, 500);
        }
        if (caseId) {
             // We might need to load cases for this client, but for now just set if option exists
             // Or better, we load cases when client is selected.
             // For simplicity, let's assume we can just set it if we load all cases or just skip case validation in dropdown visually
             // The backend validates.
             // Actually, the invoice modal has a case select.
             // We should probably load cases for the client.
        }
        if (amount) {
            document.getElementById('invoiceTotal').value = amount;
            // Also set subtotal equal to total for simplicity (assuming no tax)
        }
        
        // Set issue date to today
        document.getElementById('invoiceIssueDate').valueAsDate = new Date();
    }
}

function setupEventListeners() {
    // Search or filters if needed
}

async function loadInvoices() {
    const tbody = document.getElementById('invoicesTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center">Cargando...</td></tr>';

    try {
        const response = await fetch(`${API_URL}/billing/invoices`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!response.ok) throw new Error('Error al cargar facturas');
        
        const invoices = await response.json();
        tbody.innerHTML = '';
        
        if (invoices.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No hay facturas registradas</td></tr>';
            return;
        }

        invoices.forEach(inv => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors';
            
            const clientName = inv.client?.fullNameOrBusinessName || 'Cliente desconocido';
            const statusBadge = getStatusBadge(inv.status);
            const totalFormatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(inv.total);

            tr.innerHTML = `
                <td class="px-6 py-4 text-sm font-medium text-primary dark:text-white">${inv.invoiceNumber}</td>
                <td class="px-6 py-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">${clientName}</td>
                <td class="px-6 py-4 text-sm text-text-secondary-light dark:text-text-secondary-dark">${new Date(inv.issueDate).toLocaleDateString()}</td>
                <td class="px-6 py-4 text-sm font-bold text-primary dark:text-white">${totalFormatted}</td>
                <td class="px-6 py-4">${statusBadge}</td>
                <td class="px-6 py-4">
                    <button onclick="viewInvoice('${inv.id}')" class="text-primary hover:text-accent font-medium text-sm">Ver</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Error cargando datos</td></tr>';
    }
}

function getStatusBadge(status) {
    const styles = {
        draft: 'bg-gray-100 text-gray-800',
        issued: 'bg-blue-100 text-blue-800',
        paid: 'bg-green-100 text-green-800',
        overdue: 'bg-red-100 text-red-800',
        void: 'bg-gray-200 text-gray-500'
    };
    const labels = {
        draft: 'Borrador',
        issued: 'Emitida',
        paid: 'Pagada',
        overdue: 'Vencida',
        void: 'Anulada'
    };
    return `<span class="px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.draft}">${labels[status] || status}</span>`;
}

// Bank Details Toggle
function toggleBankDetails() {
    const method = document.getElementById('paymentMethod').value;
    const details = document.getElementById('bankDetails');
    if (details) {
        if (method === 'transfer') {
            details.classList.remove('hidden');
        } else {
            details.classList.add('hidden');
        }
    }
}

// Modal Functions - Payment
async function openPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const select = document.getElementById('paymentInvoiceId');
    
    // Load pending invoices
    try {
        const response = await fetch(`${API_URL}/billing/invoices`, { 
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const invoices = await response.json();
            select.innerHTML = '<option value="">Seleccione Factura</option>';
            invoices.filter(i => i.status !== 'paid' && i.status !== 'void').forEach(inv => {
                select.innerHTML += `<option value="${inv.id}">${inv.invoiceNumber} - ${inv.client?.fullNameOrBusinessName} (${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(inv.total)})</option>`;
            });
        }
    } catch (e) {
        console.error(e);
    }

    modal.classList.remove('hidden');
    toggleBankDetails(); // Ensure correct state on open
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
    document.getElementById('paymentProof').value = ''; // Reset file input
}

async function submitPayment() {
    const invoiceId = document.getElementById('paymentInvoiceId').value;
    const amount = document.getElementById('paymentAmount').value;
    const method = document.getElementById('paymentMethod').value;
    const reference = document.getElementById('paymentReference').value;
    const date = document.getElementById('paymentDate').value;
    const fileInput = document.getElementById('paymentProof');

    if (!invoiceId || !amount || !method) {
        alert('Complete los campos obligatorios');
        return;
    }

    const formData = new FormData();
    formData.append('invoiceId', invoiceId);
    formData.append('amount', amount);
    formData.append('method', method);
    if (reference) formData.append('reference', reference);
    if (date) formData.append('paymentDate', date);
    if (fileInput.files[0]) {
        formData.append('proofImage', fileInput.files[0]);
    }

    try {
        const response = await fetch(`${API_URL}/billing/payments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error registrando pago');
        }

        alert('Pago registrado exitosamente');
        closePaymentModal();
        loadInvoices();
    } catch (error) {
        alert(error.message);
    }
}

// Modal Functions - Invoice
async function openInvoiceModal() {
    const modal = document.getElementById('invoiceModal');
    const clientSelect = document.getElementById('invoiceClientId');
    const caseSelect = document.getElementById('invoiceCaseId');

    // Load clients
    try {
        const response = await fetch(`${API_URL}/clients`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const clients = await response.json();
            clientSelect.innerHTML = '<option value="">Seleccione Cliente</option>';
            clients.forEach(c => {
                clientSelect.innerHTML += `<option value="${c.id}">${c.fullNameOrBusinessName}</option>`;
            });
        }
    } catch (e) { console.error(e); }

    // Load cases (optional, maybe load all active cases for now or filter by client on change)
    try {
        const response = await fetch(`${API_URL}/cases?status=active`, {
             headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (response.ok) {
            const data = await response.json(); // returns { cases: [...] } or [...] depending on implementation.
            // Check controller: returns json(cases) directly in list
            // But wait, case.controller.js might return { cases: ... } or just array.
            // Let's assume array or handle both.
            const cases = Array.isArray(data) ? data : (data.cases || []);
            
            caseSelect.innerHTML = '<option value="">Ninguno / General</option>';
            cases.forEach(c => {
                caseSelect.innerHTML += `<option value="${c.id}">${c.title} (${c.caseNumberInternal})</option>`;
            });
        }
    } catch (e) { console.error(e); }

    modal.classList.remove('hidden');
    // Set default date
    document.getElementById('invoiceIssueDate').valueAsDate = new Date();
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').classList.add('hidden');
    // Clear fields
    document.getElementById('invoiceClientId').value = '';
    document.getElementById('invoiceCaseId').value = '';
    document.getElementById('invoiceNumber').value = '';
    document.getElementById('invoiceIssueDate').value = '';
    document.getElementById('invoiceDueDate').value = '';
    document.getElementById('invoiceTotal').value = '';
}

async function submitInvoice() {
    const clientId = document.getElementById('invoiceClientId').value;
    const caseId = document.getElementById('invoiceCaseId').value;
    const invoiceNumber = document.getElementById('invoiceNumber').value;
    const issueDate = document.getElementById('invoiceIssueDate').value;
    const dueDate = document.getElementById('invoiceDueDate').value;
    const total = document.getElementById('invoiceTotal').value;

    if (!clientId || !issueDate || !total) {
        alert('Cliente, Fecha y Total son obligatorios');
        return;
    }

    const payload = {
        clientId,
        caseId: caseId || null,
        invoiceNumber: invoiceNumber || undefined, // Backend generates if undefined
        issueDate,
        dueDate: dueDate || null,
        total,
        subtotal: total, // Simplified for now
        tax: 0,
        currency: 'COP'
    };

    try {
        const response = await fetch(`${API_URL}/billing/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Error creando factura');
        }

        alert('Factura creada exitosamente');
        closeInvoiceModal();
        loadInvoices();
    } catch (error) {
        alert(error.message);
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../index.html';
}

init();
