// =============================================
// SOLAR WORK v4.1 - COMPLETE + AI CONTROL
// =============================================
// PDF.js Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
// Paleta barev pro pracovníky
const WORKER_COLORS = [
    '#ef4444', '#f97316', '#22c55e', '#3b82f6', 
    '#a855f7', '#ec4899', '#22d3ee', '#a3e635'
];
// Helper: safe DOM getters and setters
const byId = (id) => document.getElementById(id);
const safeText = (el, text) => { if (el) el.textContent = text; };
const safeValue = (el) => el?.value ?? '';
const safeSetValue = (el, val) => { if (el) el.value = val; };
const safeStyle = (el, prop, val) => { if (el) el.style[prop] = val; };

// State Management - ROZŠÍŘENO v4.1
let state = {
    projects: [], 
    workers: [], 
    workEntries: [],
    templates: [], 
    settings: {
        theme: 'dark',
        autoBackup: false,
        notifications: true
    }
};
// Canvas State - ROZŠÍŘENO v4.1
let canvasState = {
    currentZoom: 1.0,
    panOffsetX: 0,
    panOffsetY: 0,
    pdfRendered: false,
    currentPDF: null,
    currentPage: null,
    currentPageNum: 1, 
    totalPages: 0,     
    baseScale: 1.0,
    touchStartDistance: 0,
    touchStartZoom: 1.0,
    lastTouchX: 0,
    lastTouchY: 0,
    isDragging: false,
    touchStartTime: 0,
    touchMoved: false,
    selectedPins: [],
    draggedPin: null,
    dragStartX: 0,
    dragStartY: 0,
    isEditMode: false,
    history: [],
    historyIndex: -1
};
// Timer State - ROZŠÍŘENO v4.1
let timerState = {
    isRunning: false,
    startTime: null,
    workerId: null,
    intervalId: null,
    breakStartTime: null,
    totalBreakTime: 0
};
// IndexedDB variables
const DB_NAME = 'SolarWorkDB_v2';
const STORE_NAME = 'pdfStore';
let db;
// IndexedDB helpers
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 2);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
        request.onerror = (event) => reject(event.target.error);
    });
}
function savePDF(id, pdfBlob) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put({ id: id, pdf: pdfBlob });
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
function loadPDF(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);
        request.onsuccess = (event) => {
            if (event.target.result) {
                resolve(event.target.result.pdf);
            } else {
                reject('No PDF found for this ID');
            }
        };
        request.onerror = (event) => reject(event.target.error);
    });
}
function deletePDF(id) {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
function getAllPDFs() {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}
function clearPDFStore() {
    return new Promise((resolve, reject) => {
        if (!db) return reject('DB not initialized');
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event.target.error);
    });
}
// =============================================
// AI OVLÁDÁNÍ API
// =============================================
window.SolarWorkAPI = {
    version: '4.1.0',
    aiMode: false,
    
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
            
            return { success: true, workerId: worker.id, data: worker };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async startShift(workerId) {
        try {
            if (timerState.isRunning) throw new Error('Směna již běží');
            
            const worker = state.workers.find(w => w.id === workerId);
            if (!worker) throw new Error(`Pracovník nenalezen: ${workerId}`);
            
            timerState.isRunning = true;
            timerState.startTime = Date.now();
            timerState.workerId = workerId;
            timerState.intervalId = setInterval(updateTimerDisplay, 1000);
            
            safeStyle(byId('startShift'), 'display', 'none');
            safeStyle(byId('stopShift'), 'display', 'block');
            safeSetValue(byId('timerWorker'), workerId);
            const timerWorker = byId('timerWorker'); if (timerWorker) timerWorker.disabled = true;
            
            saveState();
            showToast(`Směna zahájena pro ${worker.name}`, 'success');
            
            return { success: true, workerId, workerName: worker.name, startTime: timerState.startTime };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    async stopShift() {
        try {
            if (!timerState.isRunning) throw new Error('Žádná směna neběží');
            
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
            
            clearInterval(timerState.intervalId);
            timerState.isRunning = false;
            timerState.startTime = null;
            timerState.workerId = null;
            
            safeStyle(byId('startShift'), 'display', 'block');
            safeStyle(byId('stopShift'), 'display', 'none');
            const timerWorker2 = byId('timerWorker'); if (timerWorker2) timerWorker2.disabled = false;
            safeText(byId('timerDisplay'), '00:00:00');
            
            saveState();
            renderRecordsList();
            updateStatistics();
            
            return { success: true, data: newEntry };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },
    
    getWorkers: () => state.workers,
    getProjects: () => state.projects,
    getWorkEntries: () => state.workEntries,
    
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
        let aiPanel = byId('ai-control-panel');
        if (!aiPanel) {
            aiPanel = this.createAIPanel();
        }
        aiPanel.style.display = 'block';
    },
    
    hideAIPanel() {
        const aiPanel = byId('ai-control-panel');
        if (aiPanel) aiPanel.style.display = 'none';
    },
    
    createAIPanel() {
        const panel = document.createElement('div');
        panel.id = 'ai-control-panel';
        panel.className = 'ai-control-panel';
        panel.innerHTML = `
            <div class="ai-panel-header">\n                🤖 AI Ovládání\n                <button class="btn btn-secondary btn-sm" onclick="SolarWorkAPI.disableAIMode()">Zavřít</button>\n            </div>\n            <div class="ai-panel-content">\n                <div class="ai-status">\n                    <div class="status-indicator active"></div>\n                    AI režim aktivní\n                </div>\n                <div class="ai-commands">\n                    Dostupné příkazy:\n                    <ul>\n                        addWorker(name, code, rate)\n                        startShift(workerId)\n                        stopShift()\n                        getWorkers()\n                    </ul>\n                </div>\n            </div>\n        `;
        
        document.body.appendChild(panel);
        return panel;
    }
};
// Aliasy pro zpětnou kompatibilitu
window.startShift = (workerId) => SolarWorkAPI.startShift(workerId);
window.stopShift = () => SolarWorkAPI.stopShift();
window.addWorker = (name, code, rate, color) => SolarWorkAPI.addWorker(name, code, rate, color);
window.getWorkers = () => SolarWorkAPI.getWorkers();
// Initialize App
async function initApp() {
    try {
        await initDB();
    } catch (error) {
        console.error('Failed to init DB', error);
        showToast('Chyba databáze, PDF nebudou uložena', 'error');
    }
    loadState();
    setupEventListeners();
    
    byId('backupButton')?.addEventListener('click', backupData);
    byId('restoreButton')?.addEventListener('click', triggerRestore);
    byId('restoreFileInput')?.addEventListener('change', restoreData);
    byId('exportCSV')?.addEventListener('click', exportToCSV);
    renderProjectsDropdown();
    renderWorkersList();
    renderProjectsList();
    renderRecordsList();
    updateStatistics();
    
    const reportDate = byId('reportDate');
    if (reportDate) reportDate.valueAsDate = new Date();
    
    if (timerState.isRunning && timerState.startTime) {
        safeStyle(byId('startShift'), 'display', 'none');
        safeStyle(byId('stopShift'), 'display', 'block');
        const tw = byId('timerWorker'); if (tw) { tw.disabled = true; tw.value = timerState.workerId; }
        timerState.intervalId = setInterval(updateTimerDisplay, 1000);
        showToast('Běžící směna obnovena', 'info');
    }
    
    if (state.projects.length === 0) {
        navigateTo('settings');
    }
    
    updatePlanUI(null);
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .catch(err => console.log('SW registration failed:', err));
    }
    
    console.log('🤖 Solar Work AI API v4.1 ready at window.SolarWorkAPI');
}
// State Management
function loadState() {
    const savedState = localStorage.getItem('solarWorkState_v4');
    const savedTimer = localStorage.getItem('solarWorkTimer_v4');
    if (savedState) {
        const parsedState = JSON.parse(savedState);
        state.projects = parsedState.projects || [];
        state.workers = parsedState.workers || [];
        state.templates = parsedState.templates || [];
        state.settings = parsedState.settings || { theme: 'dark', autoBackup: false, notifications: true };
        
        if (parsedState.workEntries && parsedState.workEntries.length > 0) {
            state.workEntries = parsedState.workEntries.map(e => {
                if (e.type === 'task') {
                    // OPRAVA: Zajistit workers pole
                    if (!e.workers && e.workerId) {
                        e.workers = [{ workerId: e.workerId, workerCode: e.workerCode || '?' }];
                    }
                    if (!e.workers || e.workers.length === 0) {
                        e.workers = [{ workerId: 'unknown', workerCode: '?' }];
                    }
                    // OPRAVA: Zajistit rewardPerWorker
                    if (e.rewardPerWorker === undefined) {
                        e.rewardPerWorker = e.reward || 0;
                    }
                }
                return e;
            });
        } else {
            state.workEntries = [];
        }
    } else {
        // Migrace z v3
        const oldState = localStorage.getItem('solarWorkState_v3');
        if (oldState) {
            const parsed = JSON.parse(oldState);
            state.projects = parsed.projects || [];
            state.workers = parsed.workers || [];
            state.workEntries = (parsed.workEntries || []).map(e => {
                if (e.type === 'task' && e.workerId && !e.workers) {
                    return {
                        ...e,
                        rewardPerWorker: e.reward || 0,
                        workers: [{ workerId: e.workerId, workerCode: e.workerCode || '?' }]
                    };
                }
                return e;
            });
            saveState();
            showToast('Data migrována z v3 na v4.1', 'success');
        }
    }
    
    if (savedTimer) {
        timerState = JSON.parse(savedTimer);
        timer
