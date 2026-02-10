// API_URL is defined in auth.js


document.addEventListener('DOMContentLoaded', () => {
    loadDashboardStats();
    loadLawyerPerformance();
    loadRecentActivity();
});

async function loadDashboardStats() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '../public/login.html';
        return;
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        // Fetch stats in parallel
        const [casesRes, contractsRes, usersRes, tasksRes] = await Promise.all([
            fetch(`${API_URL}/cases`, { headers }),
            fetch(`${API_URL}/contracts`, { headers }),
            fetch(`${API_URL}/users`, { headers }),
            fetch(`${API_URL}/tasks?status=todo`, { headers }) // Assuming this endpoint exists and filters work
        ]);

        if (casesRes.ok) {
            const data = await casesRes.json();
            const cases = data.cases || [];
            const activeCases = cases.filter(c => c.caseStatus === 'active').length;
            document.getElementById('activeCasesCount').textContent = activeCases;
            
            // Calculate growth (mock logic or based on created_at)
            const thisMonth = new Date().getMonth();
            const newCasesThisMonth = cases.filter(c => new Date(c.createdAt).getMonth() === thisMonth).length;
            const growth = cases.length > 0 ? Math.round((newCasesThisMonth / cases.length) * 100) : 0;
            const growthEl = document.getElementById('casesGrowth');
            if (growthEl) growthEl.innerHTML = `<span class="material-symbols-outlined text-[14px]">trending_up</span> ${growth}%`;
        }

        if (contractsRes.ok) {
            const data = await contractsRes.json();
            const contracts = data.contracts || [];
            document.getElementById('contractsCount').textContent = contracts.length;
        }

        if (usersRes.ok) {
            const data = await usersRes.json();
            const users = data.users || [];
            document.getElementById('usersCount').textContent = users.length;
        }

        if (tasksRes.ok) {
            const data = await tasksRes.json();
            const tasks = data.tasks || [];
            const urgentTasks = tasks.filter(t => t.priority === 'high').length;
            document.getElementById('urgentTasksCount').textContent = urgentTasks;
            const alertBadge = document.getElementById('alertBadge');
            if (alertBadge) alertBadge.innerHTML = `<span class="material-symbols-outlined text-[14px]">priority_high</span> ${urgentTasks}`;
        }

    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

async function loadLawyerPerformance() {
    const tbody = document.getElementById('lawyersTable');
    if (!tbody) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // We need users and cases to calculate performance
        // Assuming we can get all users and filter for lawyers
        const [usersRes, casesRes] = await Promise.all([
            fetch(`${window.API_URL}/users`, { headers }),
            fetch(`${window.API_URL}/cases`, { headers })
        ]);

        if (!usersRes.ok || !casesRes.ok) throw new Error('Failed to fetch data');

        const usersData = await usersRes.json();
        const casesData = await casesRes.json();
        
        const allUsers = usersData.users || [];
        const allCases = casesData.cases || [];

        // Filter for lawyers (role 'lawyer' or 'abogado')
        // Adjust role check based on actual data structure
        const lawyers = allUsers.filter(u => 
            u.role?.name === 'lawyer' || 
            u.role?.name === 'abogado' || 
            (u.roles && u.roles.some(r => r.name === 'lawyer' || r.name === 'abogado'))
        );

        // If no explicit lawyers found, maybe use all users for now or check logic
        const lawyersToDisplay = lawyers.length > 0 ? lawyers : allUsers.slice(0, 5);

        if (lawyersToDisplay.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-slate-500">No hay abogados registrados</td></tr>`;
            return;
        }

        tbody.innerHTML = lawyersToDisplay.map(lawyer => {
            // Calculate active cases
            // Assuming case has 'lawyerId' or 'assignments'
            const activeCasesCount = allCases.filter(c => 
                c.caseStatus === 'active' && 
                (c.lawyerId === lawyer.id || (c.assignments && c.assignments.some(a => a.userId === lawyer.id)))
            ).length;

            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-3">
                            <div class="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                ${lawyer.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p class="font-medium text-slate-900">${lawyer.name}</p>
                                <p class="text-xs text-slate-500">${lawyer.email}</p>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <span class="font-bold text-slate-700">${activeCasesCount}</span>
                            <div class="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                                <div class="h-full bg-primary rounded-full" style="width: ${Math.min(activeCasesCount * 10, 100)}%"></div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-slate-600 text-sm">General</td>
                    <td class="px-6 py-4">
                        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                            Activo
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading lawyer performance:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="px-6 py-8 text-center text-red-500">Error al cargar datos</td></tr>`;
    }
}

async function loadRecentActivity() {
    const container = document.getElementById('activityTimeline');
    if (!container) return;

    try {
        const token = localStorage.getItem('token');
        // Fetch recent cases as activity proxy
        const res = await fetch(`${window.API_URL}/cases?limit=5&sort=desc`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error('Failed to fetch activity');
        
        const data = await res.json();
        const recentCases = data.cases ? data.cases.slice(0, 5) : [];

        if (recentCases.length === 0) {
            container.innerHTML = `<p class="text-center text-slate-500 py-4">No hay actividad reciente</p>`;
            return;
        }

        container.innerHTML = recentCases.map((c, index) => `
            <div class="relative pl-6 pb-6 border-l border-slate-200 last:border-0 last:pb-0">
                <div class="absolute -left-1.5 top-0 h-3 w-3 rounded-full border-2 border-white ${index === 0 ? 'bg-green-500' : 'bg-slate-300'}"></div>
                <div>
                    <p class="text-sm font-medium text-slate-900">Nuevo caso registrado</p>
                    <p class="text-xs text-slate-500 mt-0.5">Se ha creado el caso <span class="font-medium text-primary">#${c.caseNumber || 'S/N'}</span> - ${c.title}</p>
                    <p class="text-[10px] text-slate-400 mt-2">${new Date(c.createdAt).toLocaleString()}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error loading activity:', error);
        container.innerHTML = `<p class="text-center text-red-500 py-4">Error al cargar actividad</p>`;
    }
}
