const API_URL = 'http://localhost:4000/api';
let authToken = localStorage.getItem('token');
let currentContractId = null;
let currentUser = null;

function getAuthHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
    };
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '../public/login.html';
}

async function fetchAPI(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            ...getAuthHeaders(),
            ...options.headers
        }
    });
    if (response.status === 401) {
        logout();
        return null;
    }
    return response.json();
}

async function initContracts() {
    if (!authToken) {
        window.location.href = '../public/login.html';
        return;
    }

    try {
        const data = await fetchAPI('/auth/me');
        if (data && data.user) {
            currentUser = data.user;
            document.getElementById('userName').textContent = currentUser.fullName || currentUser.name;
            const initials = (currentUser.fullName || currentUser.name || 'C').substring(0,2).toUpperCase();
            document.getElementById('userInitials').textContent = initials;
            
            loadContracts();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

async function loadContracts() {
    const grid = document.getElementById('contractsGrid');
    const search = document.getElementById('searchInput').value;
    
    let endpoint = '/contracts';
    if (search) endpoint += `?search=${encodeURIComponent(search)}`;

    try {
        const data = await fetchAPI(endpoint);
        const contracts = data ? (data.contracts || []) : [];
        
        grid.innerHTML = '';

        if (contracts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 text-gray-500">
                    <span class="material-symbols-outlined text-4xl mb-2">folder_off</span>
                    <p>No se encontraron contratos.</p>
                </div>
            `;
            return;
        }

        contracts.forEach(contract => {
            const card = document.createElement('div');
            card.className = 'bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer overflow-hidden';
            card.onclick = () => openContractModal(contract);

            const date = new Date(contract.createdAt).toLocaleDateString();
            const amount = contract.contractValue 
                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(contract.contractValue)
                : 'Pendiente';

            let statusColor = 'bg-gray-100 text-gray-600';
            let statusText = 'Borrador';
            
            if (contract.status === 'sent') {
                statusColor = 'bg-blue-100 text-blue-800';
                statusText = 'Por Firmar';
            } else if (contract.status === 'signed') {
                statusColor = 'bg-green-100 text-green-800';
                statusText = 'Firmado';
            } else if (contract.status === 'cancelled') {
                statusColor = 'bg-red-100 text-red-800';
                statusText = 'Cancelado';
            }

            card.innerHTML = `
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <span class="px-2 py-1 rounded text-xs font-bold uppercase ${statusColor}">
                            ${statusText}
                        </span>
                        <span class="text-xs text-gray-400">${date}</span>
                    </div>
                    <h3 class="text-lg font-bold text-client-primary font-legal mb-2 line-clamp-2">${contract.title || 'Contrato sin título'}</h3>
                    <p class="text-xs text-gray-500 mb-4">${contract.contractNumber}</p>
                    
                    <div class="flex items-center justify-between pt-4 border-t border-gray-100">
                        <div class="text-sm font-bold text-gray-700">${amount}</div>
                        <span class="material-symbols-outlined text-client-accent">arrow_forward</span>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Error loading contracts:', error);
        grid.innerHTML = '<div class="col-span-full text-center text-red-500">Error al cargar contratos.</div>';
    }
}

let activeContract = null;

async function openContractModal(contract) {
    activeContract = contract;
    currentContractId = contract.id;
    
    document.getElementById('modalTitle').textContent = contract.title || 'Detalle del Contrato';
    document.getElementById('modalNumber').textContent = contract.contractNumber;
    
    const amount = contract.contractValue 
        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(contract.contractValue)
        : '$0.00';
    document.getElementById('modalAmount').textContent = amount;

    const statusBadge = document.getElementById('modalStatus');
    const btnSign = document.getElementById('btnSign');

    if (contract.status === 'sent') {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800';
        statusBadge.textContent = 'Por Firmar';
        btnSign.classList.remove('hidden');
    } else if (contract.status === 'signed') {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800';
        statusBadge.textContent = 'Firmado';
        btnSign.classList.add('hidden');
    } else {
        statusBadge.className = 'px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600';
        statusBadge.textContent = contract.status === 'draft' ? 'Borrador' : contract.status;
        btnSign.classList.add('hidden');
    }

    // Load content
    // Check if there is a version with documentId (PDF) or if we just show text content
    // For now, assume we fetch the latest version content if available, or just a placeholder text
    const contentDiv = document.getElementById('contractContent');
    
    if (contract.versions && contract.versions.length > 0) {
        const latestVersion = contract.versions[0];
        const docId = latestVersion.document?.id;
        const fileName = latestVersion.document?.fileName || `contrato-${contract.contractNumber}.pdf`;

        // If we had the text content stored, display it. 
        // But the backend usually stores documentId for PDF/Word files.
        // We'll show a preview message.
        contentDiv.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full gap-4">
                <span class="material-symbols-outlined text-6xl text-gray-300">description</span>
                <p class="text-gray-500">Este contrato tiene un documento adjunto.</p>
                ${docId ? `
                <button onclick="downloadContract('${docId}', '${fileName}')" class="text-client-accent underline flex items-center gap-2 text-lg font-bold">
                    <span class="material-symbols-outlined">download</span>
                    Ver / Descargar Documento
                </button>
                <p class="text-xs text-gray-400 mt-2">Versión ${latestVersion.versionNumber} - ${new Date(latestVersion.createdAt).toLocaleDateString()}</p>
                ` : '<p class="text-red-400">Error: Documento no encontrado</p>'}
            </div>
        `;
        
        // Update footer download button
        const footerDownloadBtn = document.querySelector('button[onclick="downloadPDF()"]');
        if (footerDownloadBtn && docId) {
            footerDownloadBtn.setAttribute('onclick', `downloadContract('${docId}', '${fileName}')`);
            footerDownloadBtn.classList.remove('hidden');
        } else if (footerDownloadBtn) {
            footerDownloadBtn.classList.add('hidden');
        }

    } else {
        // Mock content if no versions
        contentDiv.innerHTML = `
            <h4 class="font-bold text-lg mb-4 text-center uppercase">${contract.title}</h4>
            <p class="mb-4">Entre los suscritos a saber, <strong>BrightLawyers</strong> ... y el cliente <strong>${currentUser.fullName}</strong>...</p>
            <p class="mb-4">Cláusula Primera: Objeto. El presente contrato tiene por objeto...</p>
            <p class="mb-4">Cláusula Segunda: Valor. El valor del contrato es de ${amount}...</p>
            <p class="mb-4">...</p>
        `;
        
        // Hide footer download button if no document
        const footerDownloadBtn = document.querySelector('button[onclick="downloadPDF()"]');
        if (footerDownloadBtn) {
            footerDownloadBtn.classList.add('hidden');
        }
    }

    document.getElementById('contractModal').classList.remove('hidden');
}

function closeModal() {
    document.getElementById('contractModal').classList.add('hidden');
    activeContract = null;
}

function openSignModal() {
    document.getElementById('signModal').classList.remove('hidden');
}

function closeSignModal() {
    document.getElementById('signModal').classList.add('hidden');
    document.getElementById('signerName').value = '';
    document.getElementById('agreeTerms').checked = false;
}

async function confirmSignature() {
    const name = document.getElementById('signerName').value;
    const agree = document.getElementById('agreeTerms').checked;

    if (!name.trim()) {
        alert('Por favor escriba su nombre para firmar.');
        return;
    }
    if (!agree) {
        alert('Debe aceptar los términos para continuar.');
        return;
    }

    try {
        // 1. Add Signer Record
        await fetchAPI(`/contracts/${currentContractId}/signers`, {
            method: 'POST',
            body: JSON.stringify({
                signerType: 'CLIENT',
                signerName: name,
                signerEmail: currentUser.email,
                signerUserId: currentUser.id
            })
        });

        // 2. Update Contract Status to Signed
        const response = await fetchAPI(`/contracts/${currentContractId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: 'signed'
            })
        });

        if (response) {
            alert('Contrato firmado exitosamente.');
            closeSignModal();
            closeModal();
            loadContracts(); // Refresh list
        }
    } catch (error) {
        console.error('Error signing contract:', error);
        alert('Error al firmar el contrato.');
    }
}

async function downloadContract(docId, fileName) {
    try {
        const res = await fetch(`${API_URL}/documents/${docId}/download`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (!res.ok) throw new Error('Error descargando documento');
        
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    } catch (e) {
        console.error(e);
        alert('Error al descargar el documento');
    }
}

function downloadPDF() {
    // Fallback if needed, but should be replaced by dynamic onclick
    console.warn('downloadPDF called without context');
}

// Search debounce
let debounceTimer;
document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        loadContracts();
    }, 500);
});

// Initialize
document.addEventListener('DOMContentLoaded', initContracts);
