// Fix pro řádek ~854 - Oprava undefined rewardPerWorker
// Nahradit existující funkci renderRecordsList v app.js

// --- RECORDS ---
function renderRecordsList() {
    const container = document.getElementById('recordsList');
    
    const typeFilter = document.getElementById('recordsFilter').value;
    const workerFilter = document.getElementById('recordsWorkerFilter').value;
    const projectFilter = document.getElementById('recordsProjectFilter').value;
    const dateFilter = document.getElementById('recordsDateFilter').value;
    
    let entries = state.workEntries;

    // Date filter
    if (dateFilter !== 'all') {
        const now = new Date();
        let startDate, endDate;

        if (dateFilter === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).setHours(23, 59, 59, 999);
        } else if (dateFilter === 'this_week') {
            const currentDay = now.getDay();
            const diff = now.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
            startDate = new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0);
            const startDateObj = new Date(startDate);
            endDate = new Date(startDateObj.setDate(startDateObj.getDate() + 6)).setHours(23, 59, 59, 999);
        } else if (dateFilter === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).setHours(23, 59, 59, 999);
        }

        entries = entries.filter(e => {
            const entryDate = new Date(e.timestamp || e.startTime).getTime();
            return entryDate >= startDate && entryDate <= endDate;
        });
    }

    // Project filter
    if (projectFilter) {
        entries = entries.filter(e => e.type === 'task' && e.projectId === projectFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
        entries = entries.filter(e => e.type === typeFilter);
    }
    
    // Worker filter
    if (workerFilter) {
        entries = entries.filter(e => {
            if (e.type === 'hourly') {
                return e.workerId === workerFilter;
            }
            if (e.type === 'task') {
                return e.workers && e.workers.some(w => w.workerId === workerFilter);
            }
            return false;
        });
    }
    
    entries.sort((a, b) => (b.timestamp || b.endTime) - (a.timestamp || a.endTime));
    
    if (entries.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📝</div><div>Žádné záznamy dle filtrů</div></div>';
        return;
    }
    
    container.innerHTML = entries.map(entry => {
        if (entry.type === 'task') {
            const project = state.projects.find(p => p.id === entry.projectId);
            const projectName = project ? project.jmenoProjektu : 'Neznámý projekt';
            const date = new Date(entry.timestamp);
            
            // ✅ OPRAVA: Zkontroluj, zda existují workers a rewardPerWorker
            if (!entry.workers || entry.workers.length === 0) {
                // Fallback pro staré záznamy
                const oldWorker = state.workers.find(w => w.id === entry.workerId);
                entry.workers = oldWorker ? [{
                    workerId: entry.workerId,
                    workerCode: entry.workerCode || oldWorker.code || '?'
                }] : [{ workerId: 'unknown', workerCode: '?' }];
            }
            
            // ✅ OPRAVA: Zkontroluj rewardPerWorker
            const rewardPerWorker = entry.rewardPerWorker || entry.reward || 0;
            
            // Získat jména a barvy VŠECH pracovníků
            const workerDetails = entry.workers.map(w => {
                const worker = state.workers.find(f => f.id === w.workerId);
                return {
                    name: worker ? worker.name : 'Neznámý',
                    color: worker ? worker.color : '#94a3b8'
                };
            });

            const workerDots = workerDetails.map(d => `<span class="worker-color-dot" style="background-color: ${d.color}"></span>`).join('');
            const workerNames = workerDetails.map(d => d.name).join(', ');
            
            // ✅ OPRAVA: Bezpečný výpočet s kontrolou
            const totalReward = rewardPerWorker * entry.workers.length;
            const canEdit = entry.x !== null;
            
            return `
                <div class="record-item">
                    <div class="record-header">
                        <span class="record-type record-type-task">Stůl</span>
                        <div class="record-actions">
                            ${canEdit ? `<button onclick="openEditTaskModal('${entry.id}')" class="record-btn" style="background: rgba(59, 130, 246, 0.2); color: var(--color-primary);">Upravit</button>` : ''}
                            <button onclick="deleteEntry('${entry.id}')" class="record-btn btn-danger" style="background: rgba(239, 68, 68, 0.2); color: var(--color-danger);">Smazat</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;"><strong>${entry.tableNumber}</strong></div>
                    <div style="font-size: 14px; color: var(--color-text-secondary);">
                        <div class="record-item-worker-name" style="margin-bottom: 8px;">
                            ${workerDots}
                            <span style="margin-left: 4px;">${workerNames}</span>
                        </div>
                        <div>📋 ${projectName}</div>
                        <div>💰 €${totalReward.toFixed(2)} (${entry.workers.length}x €${rewardPerWorker.toFixed(2)})</div>
                        <div>📅 ${date.toLocaleDateString('cs-CZ')} ${date.toLocaleTimeString('cs-CZ')}</div>
                        ${!canEdit ? '<div>(Ručně zadaný)</div>' : ''}
                    </div>
                </div>
            `;
        } else {
            // Hodinový záznam (zůstává stejný, je jen pro 1 pracovníka)
            const worker = state.workers.find(w => w.id === entry.workerId);
            const workerName = worker ? worker.name : 'Neznámý';
            const workerColor = worker ? worker.color : '#94a3b8';
            const startDate = new Date(entry.startTime);
            const endDate = new Date(entry.endTime);
            
            // ✅ OPRAVA: Bezpečná kontrola totalEarned
            const totalEarned = entry.totalEarned || 0;
            const totalHours = entry.totalHours || 0;
            
            return `
                <div class="record-item">
                    <div class="record-header">
                        <span class="record-type record-type-hourly">Hodiny</span>
                        <div class="record-actions">
                            <button onclick="deleteEntry('${entry.id}')" class="record-btn btn-danger" style="background: rgba(239, 68, 68, 0.2); color: var(--color-danger);">Smazat</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;" class="record-item-worker-name">
                        <span class="worker-color-dot" style="background-color: ${workerColor}"></span>
                        <strong>${workerName}</strong>
                    </div>
                    <div style="font-size: 14px; color: var(--color-text-secondary);">
                        <div>⏱️ ${totalHours.toFixed(2)} hodin</div>
                        <div>💰 €${totalEarned.toFixed(2)}</div>
                        <div>📅 ${startDate.toLocaleDateString('cs-CZ')} ${startDate.toLocaleTimeString('cs-CZ')}</div>
                        <div>→ ${endDate.toLocaleTimeString('cs-CZ')}</div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// ✅ DALŠÍ OPRAVA: Také opravit updateStatistics funkci
function updateStatistics() {
    const workerFilter = document.getElementById('statsWorkerFilter').value;
    const projectFilter = document.getElementById('statsProjectFilter').value;
    
    let entries = state.workEntries;
    
    // Filtry (stejné jako v renderRecordsList)
    if (workerFilter) {
        entries = entries.filter(e => {
            if (e.type === 'hourly') return e.workerId === workerFilter;
            if (e.type === 'task') {
                // ✅ OPRAVA: Bezpečná kontrola workers
                if (!e.workers || e.workers.length === 0) {
                    return e.workerId === workerFilter; // Fallback pro staré záznamy
                }
                return e.workers.some(w => w.workerId === workerFilter);
            }
            return false;
        });
    }
    if (projectFilter) {
        entries = entries.filter(e => e.type === 'hourly' || (e.type === 'task' && e.projectId === projectFilter));
    }
    
    const taskEntries = entries.filter(e => e.type === 'task');
    const hourlyEntries = entries.filter(e => e.type === 'hourly');
    
    // ✅ OPRAVA: Bezpečný výpočet výdělku ze stolů
    const totalTaskEarnings = taskEntries.reduce((sum, e) => {
        const rewardPerWorker = e.rewardPerWorker || e.reward || 0;
        const workersCount = e.workers ? e.workers.length : 1;
        return sum + (rewardPerWorker * workersCount);
    }, 0);
    
    const totalHourlyEarnings = hourlyEntries.reduce((sum, e) => sum + (e.totalEarned || 0), 0);
    const totalEarnings = totalTaskEarnings + totalHourlyEarnings;
    
    const totalHours = hourlyEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const totalTables = taskEntries.length;
    
    const avgReward = totalTables > 0 ? totalTaskEarnings / totalTables : 0;
    
    document.getElementById('statTotalEarnings').textContent = `€${totalEarnings.toFixed(2)}`;
    document.getElementById('statTotalHours').textContent = `${totalHours.toFixed(1)}h`;
    document.getElementById('statTotalTables').textContent = totalTables;
    document.getElementById('statAvgReward').textContent = `€${avgReward.toFixed(2)}`;
    
    // Zbytek funkce updateStatistics...
    // (pro úsporu místa neopisuji celou funkci)
}

// ✅ OPRAVA MIGRACE v loadState()
function loadState() {
    const savedState = localStorage.getItem('solarWorkState_v3');
    const savedTimer = localStorage.getItem('solarWorkTimer_v3');

    if (savedState) {
        const parsedState = JSON.parse(savedState);
        state.projects = parsedState.projects || [];
        state.workers = parsedState.workers || [];
        
        // ✅ ZLEPŠENÁ MIGRACE DAT
        if (parsedState.workEntries && parsedState.workEntries.length > 0) {
            state.workEntries = parsedState.workEntries.map(e => {
                // Opravit task záznamy
                if (e.type === 'task') {
                    // Pokud nemá workers pole, vytvořit ho
                    if (!e.workers && e.workerId) {
                        e.workers = [{ 
                            workerId: e.workerId, 
                            workerCode: e.workerCode || '?' 
                        }];
                    }
                    // Pokud nemá rewardPerWorker, převzít z reward
                    if (e.rewardPerWorker === undefined && e.reward !== undefined) {
                        e.rewardPerWorker = e.reward;
                    }
                    // Pokud ani reward nemá, nastavit 0
                    if (e.rewardPerWorker === undefined) {
                        e.rewardPerWorker = 0;
                    }
                }
                return e;
            });
            console.log('✅ Data migrována a opravena');
        } else {
            state.workEntries = [];
        }
        
        // Ihned uložit opravená data
        saveState();
    }
    
    if (savedTimer) {
        timerState = JSON.parse(savedTimer);
        timerState.intervalId = null;
    }
}