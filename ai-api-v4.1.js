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
    
    async updateWorker(workerId, updates) {
        try {
            const worker = state.workers.find(w => w.id === workerId);
            if (!worker) {
                throw new Error(`Pracovník s ID ${workerId} nenalezen`);
            }
            
            Object.assign(worker, updates);
            saveState();
            renderWorkersList();
            
            return {
                success: true,
                message: `Pracovník ${worker.name} aktualizován`,
                data: worker
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async deleteWorker(workerId) {
        try {
            const workerIndex = state.workers.findIndex(w => w.id === workerId);
            if (workerIndex === -1) {
                throw new Error(`Pracovník s ID ${workerId} nenalezen`);
            }
            
            const worker = state.workers[workerIndex];
            state.workers.splice(workerIndex, 1);
            saveState();
            renderWorkersList();
            
            return {
                success: true,
                message: `Pracovník ${worker.name} smazán`,
                data: { deletedId: workerId }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Project Management
    async addProject(name, pdfFile = null) {
        try {
            const projectId = 'proj-' + Date.now();
            const project = {
                id: projectId,
                jmenoProjektu: name.trim()
            };
            
            state.projects.push(project);
            
            if (pdfFile) {
                await savePDF(projectId, pdfFile);
            }
            
            saveState();
            renderProjectsList();
            renderProjectsDropdown();
            
            return {
                success: true,
                projectId: projectId,
                message: `Projekt ${name} vytvořen`,
                data: project
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Shift Management
    async startShift(workerId, fromTime = null, toTime = null, projectId = null) {
        try {
            if (timerState.isRunning) {
                throw new Error('Směna již běží');
            }
            
            const worker = state.workers.find(w => w.id === workerId);
            if (!worker) {
                throw new Error(`Pracovník s ID ${workerId} nenalezen`);
            }
            
            timerState.isRunning = true;
            timerState.startTime = Date.now();
            timerState.workerId = workerId;
            timerState.intervalId = setInterval(updateTimerDisplay, 1000);
            
            saveState();
            
            // Update UI
            document.getElementById('startShift').style.display = 'none';
            document.getElementById('stopShift').style.display = 'block';
            document.getElementById('pauseShift')?.style.display = 'block';
            document.getElementById('timerWorker').value = workerId;
            document.getElementById('timerWorker').disabled = true;
            
            return {
                success: true,
                message: `Směna zahájena pro ${worker.name}`,
                data: {
                    workerId,
                    workerName: worker.name,
                    startTime: timerState.startTime,
                    projectId
                }
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async stopShift() {
        try {
            if (!timerState.isRunning) {
                throw new Error('Žádná směna neběží');
            }
            
            const endTime = Date.now();
            const totalMs = endTime - timerState.startTime;
            const totalHours = totalMs / (1000 * 60 * 60);
            
            const worker = state.workers.find(w => w.id === timerState.workerId);
            const totalEarned = totalHours * (worker ? worker.hourlyRate : 0);
            
            const newEntry = {
                id: 'entry-' + Date.now(),
                type: 'hourly',
                workerId: timerState.workerId,
                startTime: timerState.startTime,
                endTime: endTime,
                totalHours: totalHours,
                totalEarned: totalEarned
            };
            
            state.workEntries.push(newEntry);
            
            // Reset timer
            clearInterval(timerState.intervalId);
            timerState.isRunning = false;
            timerState.startTime = null;
            timerState.workerId = null;
            
            saveState();
            
            // Update UI
            document.getElementById('startShift').style.display = 'block';
            document.getElementById('stopShift').style.display = 'none';
            document.getElementById('pauseShift')?.style.display = 'none';
            document.getElementById('timerWorker').disabled = false;
            document.getElementById('timerDisplay').textContent = '00:00:00';
            
            renderRecordsList();
            updateStatistics();
            
            return {
                success: true,
                message: `Směna ukončena: ${totalHours.toFixed(2)}h, €${totalEarned.toFixed(2)}`,
                data: newEntry
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Task Management
    async addTask(projectId, tableNumber, workerIds, rewardPerWorker, x = null, y = null, pageNum = 1) {
        try {
            if (!Array.isArray(workerIds)) {
                workerIds = [workerIds];
            }
            
            const project = state.projects.find(p => p.id === projectId);
            if (!project) {
                throw new Error(`Projekt s ID ${projectId} nenalezen`);
            }
            
            const workersArray = workerIds.map(id => {
                const worker = state.workers.find(w => w.id === id);
                return {
                    workerId: id,
                    workerCode: worker ? (worker.code || '?') : '?'
                };
            });
            
            const newEntry = {
                id: 'entry-' + Date.now(),
                type: 'task',
                projectId: projectId,
                tableNumber: tableNumber.toString().trim(),
                rewardPerWorker: parseFloat(rewardPerWorker),
                x: x,
                y: y,
                pageNum: pageNum,
                timestamp: Date.now(),
                workers: workersArray
            };
            
            state.workEntries.push(newEntry);
            saveState();
            
            if (x !== null && y !== null) {
                renderCanvasWithPins();
            }
            renderRecordsList();
            updateStatistics();
            
            return {
                success: true,
                message: `Stůl ${tableNumber} přidán do projektu ${project.jmenoProjektu}`,
                data: newEntry
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    // Batch Operations
    async addMultipleTasks(tasks) {
        const results = [];
        for (const task of tasks) {
            const result = await this.addTask(
                task.projectId,
                task.tableNumber,
                task.workerIds,
                task.rewardPerWorker,
                task.x,
                task.y,
                task.pageNum
            );
            results.push(result);
        }
        return {
            success: results.every(r => r.success),
            message: `Přidáno ${results.filter(r => r.success).length}/${results.length} stolů`,
            data: results
        };
    },
    
    async addMultipleWorkers(workers) {
        const results = [];
        for (const worker of workers) {
            const result = await this.addWorker(
                worker.name,
                worker.code,
                worker.hourlyRate,
                worker.color
            );
            results.push(result);
        }
        return {
            success: results.every(r => r.success),
            message: `Přidáno ${results.filter(r => r.success).length}/${results.length} pracovníků`,
            data: results
        };
    },
    
    // Data Retrieval
    getState() {
        return {
            workers: state.workers,
            projects: state.projects,
            workEntries: state.workEntries,
            templates: state.templates,
            timerState: {
                isRunning: timerState.isRunning,
                startTime: timerState.startTime,
                workerId: timerState.workerId
            }
        };
    },
    
    getWorkers() {
        return state.workers;
    },
    
    getProjects() {
        return state.projects;
    },
    
    getWorkEntries(filter = {}) {
        let entries = state.workEntries;
        
        if (filter.projectId) {
            entries = entries.filter(e => e.projectId === filter.projectId);
        }
        if (filter.workerId) {
            entries = entries.filter(e => {
                if (e.type === 'hourly') return e.workerId === filter.workerId;
                if (e.type === 'task') return e.workers?.some(w => w.workerId === filter.workerId);
                return false;
            });
        }
        if (filter.type) {
            entries = entries.filter(e => e.type === filter.type);
        }
        if (filter.dateFrom) {
            const fromDate = new Date(filter.dateFrom).getTime();
            entries = entries.filter(e => {
                const entryDate = new Date(e.timestamp || e.startTime).getTime();
                return entryDate >= fromDate;
            });
        }
        if (filter.dateTo) {
            const toDate = new Date(filter.dateTo).getTime();
            entries = entries.filter(e => {
                const entryDate = new Date(e.timestamp || e.startTime).getTime();
                return entryDate <= toDate;
            });
        }
        
        return entries;
    },
    
    // UI Control
    navigateToPage(pageName) {
        navigateTo(pageName);
        return { success: true, message: `Navigováno na stránku ${pageName}` };
    },
    
    // AI Mode
    enableAIMode() {
        this.aiMode = true;
        document.body.setAttribute('data-ai-mode', 'true');
        document.body.classList.add('ai-control-mode');
        
        // Přidat AI panel
        this.showAIPanel();
        
        return { success: true, message: 'AI režim aktivován' };
    },
    
    disableAIMode() {
        this.aiMode = false;
        document.body.removeAttribute('data-ai-mode');
        document.body.classList.remove('ai-control-mode');
        
        // Skrýt AI panel
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
        if (aiPanel) {
            aiPanel.style.display = 'none';
        }
    },
    
    createAIPanel() {
        const panel = document.createElement('div');
        panel.id = 'ai-control-panel';
        panel.className = 'ai-control-panel';
        panel.innerHTML = `
            <div class="ai-panel-header">
                <h3>🤖 AI Ovládání</h3>
                <button onclick="SolarWorkAPI.disableAIMode()" class="btn btn-secondary btn-sm">Zavřít</button>
            </div>
            <div class="ai-panel-content">
                <div class="ai-status">
                    <div class="status-indicator active"></div>
                    <span>AI režim aktivní</span>
                </div>
                <div class="ai-commands">
                    <h4>Dostupné příkazy:</h4>
                    <ul>
                        <li><code>SolarWorkAPI.addWorker(name, code, rate)</code></li>
                        <li><code>SolarWorkAPI.startShift(workerId)</code></li>
                        <li><code>SolarWorkAPI.addTask(projectId, table, workers, reward)</code></li>
                        <li><code>SolarWorkAPI.getState()</code></li>
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
    initApp = async function() {
        await originalInitApp();
        console.log('🤖 Solar Work AI API v4.1 initialized');
        console.log('Available at: window.SolarWorkAPI');
        console.log('Quick functions: startShift(), addWorker(), addTask()');
    };
}