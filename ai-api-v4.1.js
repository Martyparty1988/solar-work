// =============================================
// SOLAR WORK v4.1 - AI OVLÁDÁNÍ API LAYER
// =============================================
// Globální AI API pro externí ovládání
window.SolarWorkAPI = {
    version: '4.1.0',
    aiMode: false,
    
    // =============================================
    // GLOBÁLNÍ FUNKCE PRO AI ASISTENTY
    // =============================================
    
    // Worker Management
    async addWorker(name, code, hourlyRate, color = null) {
        try {
            const worker = {
                id: 'worker-' + Date.now(),
                name: name.trim(),
                code: code.trim(),
                hourlyRate: parseFloat(hourlyRate),
                color: color || WORKER_COLORS[state.workers.length % WORKER_COLORS.length]
            };
            
            state.workers.push(worker);
            saveState();
            renderWorkersList();
            
            return {
                success: true,
                workerId: worker.id,
                message: `Pracovník ${name} přidán úspěšně`,
                data: worker
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // ... trimmed for brevity ...

    // UI Control
    navigateToPage(pageName) {
        if (typeof navigateTo === 'function') {
            navigateTo(pageName);
            return { success: true, message: `Navigováno na stránku ${pageName}` };
        }
        return { success: false, error: 'navigateTo is not available' };
    },

    // AI Mode
    enableAIMode() {
        this.aiMode = true;
        document.body.setAttribute('data-ai-mode', 'true');
        document.body.classList.add('ai-control-mode');
        this.showAIPanel();
        return { success: true, message: 'AI režim aktivován' };
    },
    
    disableAIMode() {
        this.aiMode = false;
        document.body.removeAttribute('data-ai-mode');
        document.body.classList.remove('ai-control-mode');
        this.hideAIPanel();
        return { success: true, message: 'AI režim deaktivován' };
    },
    
    showAIPanel() {
        let aiPanel = document.getElementById('ai-control-panel');
        if (!aiPanel) {
            aiPanel = this.createAIPanel();
        }
        aiPanel.style.display = 'block';
    },
    
    hideAIPanel() {
        const aiPanel = document.getElementById('ai-control-panel');
        if (aiPanel) aiPanel.style.display = 'none';
    },
    
    createAIPanel() {
        const panel = document.createElement('div');
        panel.id = 'ai-control-panel';
        panel.className = 'ai-control-panel';
        panel.innerHTML = `
            <div class="ai-panel-header">
                🤖 AI Ovládání
                <button class="btn btn-secondary btn-sm" onclick="SolarWorkAPI.disableAIMode()">Zavřít</button>
            </div>
            <div class="ai-panel-content">
                <div class="ai-status">
                    <div class="status-indicator active"></div>
                    AI režim aktivní
                </div>
                <div class="ai-commands">
                    Dostupné příkazy:
                    <ul>
                        SolarWorkAPI.addWorker(name, code, rate)
                        SolarWorkAPI.startShift(workerId)
                        SolarWorkAPI.addTask(projectId, table, workers, reward)
                        SolarWorkAPI.getState()
                    </ul>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        return panel;
    }
};
// =============================================
// GLOBÁLNÍ FUNKCE PRO ZPĚTNOU KOMPATIBILITU
// =============================================
// Aliasy pro rychlé volání
window.startShift = (workerId, fromTime, toTime, projectId) => 
    SolarWorkAPI.startShift(workerId, fromTime, toTime, projectId);
window.stopShift = () => SolarWorkAPI.stopShift();
window.addWorker = (name, code, rate, color) => 
    SolarWorkAPI.addWorker(name, code, rate, color);
window.addTask = (projectId, tableNumber, workerIds, rewardPerWorker, x, y, pageNum) =>
    SolarWorkAPI.addTask(projectId, tableNumber, workerIds, rewardPerWorker, x, y, pageNum);
window.getWorkers = () => SolarWorkAPI.getWorkers();
window.getProjects = () => SolarWorkAPI.getProjects();
window.getWorkEntries = (filter) => SolarWorkAPI.getWorkEntries(filter);
// =============================================
// AUTO-INIT AI API
// =============================================
// Automaticky inicializovat po načtení aplikace
if (typeof initApp === 'function') {
    const originalInitApp = initApp;
    // Avoid invalid assignment to const by attaching a wrapper to window
    window.initApp = async function() {
        await originalInitApp();
        console.log('🤖 Solar Work AI API v4.1 initialized');
        console.log('Available at: window.SolarWorkAPI');
        console.log('Quick functions: startShift(), addWorker(), addTask()');
    };
}
