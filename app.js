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
            
            document.getElementById('startShift').style.display = 'none';
            document.getElementById('stopShift').style.display = 'block';
            document.getElementById('timerWorker').value = workerId;
            document.getElementById('timerWorker').disabled = true;
            
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
            
            document.getElementById('startShift').style.display = 'block';
            document.getElementById('stopShift').style.display = 'none';
            document.getElementById('timerWorker').disabled = false;
            document.getElementById('timerDisplay').textContent = '00:00:00';
            
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
                        <li><code>addWorker(name, code, rate)</code></li>
                        <li><code>startShift(workerId)</code></li>
                        <li><code>stopShift()</code></li>
                        <li><code>getWorkers()</code></li>
                    </ul>
                </div>
            </div>
        `;
        
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
    
    document.getElementById('backupButton')?.addEventListener('click', backupData);
    document.getElementById('restoreButton')?.addEventListener('click', triggerRestore);
    document.getElementById('restoreFileInput')?.addEventListener('change', restoreData);
    document.getElementById('exportCSV')?.addEventListener('click', exportToCSV);

    renderProjectsDropdown();
    renderWorkersList();
    renderProjectsList();
    renderRecordsList();
    updateStatistics();
    
    const reportDate = document.getElementById('reportDate');
    if (reportDate) reportDate.valueAsDate = new Date();
    
    if (timerState.isRunning && timerState.startTime) {
        document.getElementById('startShift').style.display = 'none';
        document.getElementById('stopShift').style.display = 'block';
        document.getElementById('timerWorker').disabled = true;
        document.getElementById('timerWorker').value = timerState.workerId;
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
        timerState.intervalId = null;
    }
}

function saveState() {
    const stateToSave = {
        projects: state.projects,  
        workers: state.workers,
        workEntries: state.workEntries,
        templates: state.templates,
        settings: state.settings
    };

    localStorage.setItem('solarWorkState_v4', JSON.stringify(stateToSave));
    localStorage.setItem('solarWorkTimer_v4', JSON.stringify(timerState));
}

// Navigation
function navigateTo(pageName) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageName}`);
    if (targetPage) targetPage.classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    
    if (pageName === 'records') {
        renderRecordsList();
        renderWorkersList();
        renderProjectsDropdown();
    } else if (pageName === 'statistics') {
        updateStatistics();
    } else if (pageName === 'plan') {
        const projectId = document.getElementById('projectSelect')?.value;
        if (projectId) renderWorkerBadges(projectId);
    }
}

// Event Listeners
function setupEventListeners() {
    const projectSelect = document.getElementById('projectSelect');
    if (projectSelect) projectSelect.addEventListener('change', loadProjectPlan);
    
    const canvas = document.getElementById('pdfCanvas');
    if (canvas) {
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    }
    
    // Timer
    const startBtn = document.getElementById('startShift');
    const stopBtn = document.getElementById('stopShift');
    if (startBtn) startBtn.addEventListener('click', startShift);
    if (stopBtn) stopBtn.addEventListener('click', stopShift);
    
    // PDF Controls
    const resetBtn = document.getElementById('resetZoom');
    const zoomInBtn = document.getElementById('zoomIn');
    const zoomOutBtn = document.getElementById('zoomOut');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (resetBtn) resetBtn.addEventListener('click', resetZoom);
    if (zoomInBtn) zoomInBtn.addEventListener('click', () => changeZoom(0.2));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => changeZoom(-0.2));
    if (prevBtn) prevBtn.addEventListener('click', () => changePage(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => changePage(1));
    
    // Filters
    const filterIds = ['recordsFilter', 'recordsWorkerFilter', 'recordsProjectFilter', 'recordsDateFilter', 'statsWorkerFilter', 'statsProjectFilter'];
    filterIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', id.startsWith('stats') ? updateStatistics : renderRecordsList);
        }
    });
}

// Utility Functions
function vibrate(duration = 50) {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(duration);
        } catch (e) {
            console.warn('Vibration failed', e);
        }
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    
    if (type === 'success') vibrate(50);
    else if (type === 'error') vibrate([100, 30, 100]);
    
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function showLoader() { 
    const loader = document.getElementById('loader');
    if (loader) loader.classList.add('show'); 
}

function hideLoader() { 
    const loader = document.getElementById('loader');
    if (loader) loader.classList.remove('show'); 
}

function openModal(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active'); 
}

function closeModal(modalId) { 
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active'); 
}

// PROJECTS
function openProjectModal(projectId = null) {
    if (projectId) {
        const project = state.projects.find(p => p.id === projectId);
        if (!project) return;
        
        document.getElementById('projectModalTitle').textContent = 'Upravit Projekt';
        document.getElementById('projectId').value = project.id;
        document.getElementById('projectName').value = project.jmenoProjektu;
        document.getElementById('currentPDF').textContent = 'Pro změnu nahrajte nové PDF (původní bude přepsáno)';
        document.getElementById('projectPDF').required = false;
    } else {
        document.getElementById('projectModalTitle').textContent = 'Přidat Nový Projekt';
        document.getElementById('projectForm').reset();
        document.getElementById('currentPDF').textContent = '';
        document.getElementById('projectPDF').required = true;
    }
    openModal('projectModal');
}

async function saveProject(event) {
    event.preventDefault();
    const projectId = document.getElementById('projectId').value;
    const projectName = document.getElementById('projectName').value.trim();
    const pdfFile = document.getElementById('projectPDF').files[0];

    const projectIdToSave = projectId || 'proj-' + Date.now();

    if (pdfFile) {
        showLoader();
        try {
            await savePDF(projectIdToSave, pdfFile);
            
            if (projectId) {
                const project = state.projects.find(p => p.id === projectId);
                if (project) project.jmenoProjektu = projectName;
            } else {
                state.projects.push({ id: projectIdToSave, jmenoProjektu: projectName });
            }
            
            saveState();
            renderProjectsList();
            renderProjectsDropdown();
            
            if (document.getElementById('projectSelect')?.value === projectIdToSave) {
                updatePlanUI(projectIdToSave);
            }
            closeModal('projectModal');
            hideLoader();
            showToast('Projekt a PDF uloženy', 'success');

        } catch (error) {
            console.error('Failed to save PDF:', error);
            showToast('Chyba při ukládání PDF', 'error');
            hideLoader();
        }
    } else if (projectId) {
        const project = state.projects.find(p => p.id === projectId);
        if (project) {
            project.jmenoProjektu = projectName;
            saveState();
            renderProjectsList();
            renderProjectsDropdown();
            closeModal('projectModal');
            showToast('Projekt aktualizován', 'success');
        }
    } else {
        showToast('Prosím, vyberte PDF soubor', 'error');
    }
}

async function deleteProject(projectId) {
    if (confirm('Opravdu chcete smazat tento projekt? Smažou se i všechny související záznamy a PDF.')) {
        const isDeletingActive = (document.getElementById('projectSelect')?.value === projectId);

        state.projects = state.projects.filter(p => p.id !== projectId);
        state.workEntries = state.workEntries.filter(e => e.projectId !== projectId);
        
        try { 
            await deletePDF(projectId); 
        } catch (error) { 
            console.warn('Could not delete PDF from DB:', error); 
        }
        
        saveState();
        renderProjectsList();
        renderProjectsDropdown();
        
        if (isDeletingActive) {
            const projectSelect = document.getElementById('projectSelect');
            if (projectSelect) projectSelect.value = "";
            updatePlanUI(null);
        }
        
        showToast('Projekt smazán', 'success');
    }
}

function renderProjectsList() {
    const container = document.getElementById('projectsList');
    if (!container) return;
    
    if (state.projects.length === 0) {
        container.innerHTML = '<div class="empty-state" style="padding: 20px;">Žádné projekty</div>';
        return;
    }
    
    container.innerHTML = state.projects.map(project => `
        <div class="list-item">
            <div class="list-item-info">
                <div class="list-item-title">${project.jmenoProjektu}</div>
                <div class="list-item-subtitle">ID: ${project.id.substring(5, 13)}</div>
            </div>
            <div class="flex gap-8">
                <button onclick="openProjectModal('${project.id}')" class="record-btn" style="background: rgba(59, 130, 246, 0.2); color: var(--color-primary);">Upravit</button>
                <button onclick="deleteProject('${project.id}')" class="record-btn" style="background: rgba(239, 68, 68, 0.2); color: var(--color-danger);">Smazat</button>
            </div>
        </div>
    `).join('');
}

function renderProjectsDropdown() {
    const selects = [
        document.getElementById('projectSelect'),
        document.getElementById('statsProjectFilter'),
        document.getElementById('recordsProjectFilter'),
        document.getElementById('manualTaskProject')
    ].filter(Boolean);
    
    const options = state.projects.map(p => `<option value="${p.id}">${p.jmenoProjektu}</option>`).join('');
    
    selects.forEach(select => {
        if (select.id === 'projectSelect' || select.id === 'manualTaskProject') {
            select.innerHTML = '<option value="">-- Vyberte projekt --</option>' + options;
        } else {
            select.innerHTML = '<option value="">Všechny projekty</option>' + options;
        }
    });
}

// Boot app
window.addEventListener('DOMContentLoaded', initApp);

// =============================================
// VŠECHNY ZBYLÉ FUNKCE - PŘIDAT NA KONEC
// =============================================

// WORKERS MANAGEMENT
function openWorkerModal(workerId = null) {
    if (workerId) {
        const worker = state.workers.find(w => w.id === workerId);
        if (!worker) return;
        
        document.getElementById('workerModalTitle').textContent = 'Upravit Pracovníka';
        document.getElementById('workerId').value = worker.id;
        document.getElementById('workerName').value = worker.name;
        document.getElementById('workerCode').value = worker.code || '';
        document.getElementById('workerRate').value = worker.hourlyRate;
    } else {
        document.getElementById('workerModalTitle').textContent = 'Přidat Nového Pracovníka';
        document.getElementById('workerForm').reset();
    }
    openModal('workerModal');
}

function saveWorker(event) {
    event.preventDefault();
    const workerId = document.getElementById('workerId').value;
    const workerName = document.getElementById('workerName').value.trim();
    const workerCode = document.getElementById('workerCode').value.trim();
    const workerRate = parseFloat(document.getElementById('workerRate').value);

    if (workerId) {
        const worker = state.workers.find(w => w.id === workerId);
        if (worker) {
            worker.name = workerName;
            worker.code = workerCode;
            worker.hourlyRate = workerRate;
        }
    } else {
        const newWorker = {
            id: 'worker-' + Date.now(),
            name: workerName,
            code: workerCode,
            hourlyRate: workerRate,
            color: WORKER_COLORS[state.workers.length % WORKER_COLORS.length]
        };
        state.workers.push(newWorker);
    }
    
    saveState();
    renderWorkersList();
    closeModal('workerModal');
    showToast('Pracovník uložen', 'success');
}

function deleteWorker(workerId) {
    if (confirm('Opravdu chcete smazat tohoto pracovníka?')) {
        state.workers = state.workers.filter(w => w.id !== workerId);
        saveState();
        renderWorkersList();
        showToast('Pracovník smazán', 'success');
    }
}

function renderWorkersList() {
    const container = document.getElementById('workersList');
    if (!container) return;
    
    const selectors = [
        document.getElementById('timerWorker'),
        document.getElementById('statsWorkerFilter'),
        document.getElementById('recordsWorkerFilter'),
        document.getElementById('manualHourWorker')
    ].filter(Boolean);
    
    if (state.workers.length === 0) {
        container.innerHTML = '<div class="empty-state">Žádní pracovníci</div>';
    } else {
        container.innerHTML = state.workers.map(worker => `
            <div class="list-item" data-worker-id="${worker.id}">
                <div class="list-item-info">
                    <div class="list-item-title">
                        <span class="worker-color-dot" style="background-color: ${worker.color || '#94a3b8'}"></span>
                        ${worker.name}
                    </div>
                    <div class="list-item-subtitle">Kód: <strong>${worker.code || 'N/A'}</strong> | €${worker.hourlyRate.toFixed(2)}/hod</div>
                </div>
                <div class="flex gap-8">
                    <button onclick="openWorkerModal('${worker.id}')" class="record-btn" style="background: rgba(59, 130, 246, 0.2); color: var(--color-primary);">Upravit</button>
                    <button onclick="deleteWorker('${worker.id}')" class="record-btn" style="background: rgba(239, 68, 68, 0.2); color: var(--color-danger);">Smazat</button>
                </div>
            </div>
        `).join('');
    }
    
    const workerOptions = state.workers.map(w => 
        `<option value="${w.id}">${w.name} (${w.code || 'N/A'})</option>`
    ).join('');
    
    selectors.forEach(select => {
        if (select.id === 'statsWorkerFilter' || select.id === 'recordsWorkerFilter') {
            select.innerHTML = '<option value="">Všichni pracovníci</option>' + workerOptions;
        } else {
            select.innerHTML = '<option value="">-- Vyberte pracovníka --</option>' + workerOptions;
        }
    });
}

// PLAN FUNCTIONS
async function loadProjectPlan() {
    const projectId = document.getElementById('projectSelect').value;
    updatePlanUI(projectId);
    
    if (!projectId) return;
    
    showLoader();
    try {
        const pdfBlob = await loadPDF(projectId);
        const arrayBuffer = await pdfBlob.arrayBuffer();
        renderPDF(arrayBuffer);
    } catch (error) {
        console.warn('PDF not found:', error);
        
        const canvasWrapper = document.getElementById('canvasWrapper');
        const pdfCanvas = document.getElementById('pdfCanvas');
        const noPlanMessage = document.getElementById('noPlanMessage');
        
        if (canvasWrapper) canvasWrapper.style.display = 'block';
        if (pdfCanvas) pdfCanvas.style.display = 'none';
        if (noPlanMessage) {
            noPlanMessage.style.display = 'flex';
            noPlanMessage.innerHTML = `
                <div class="empty-state-icon">🔄</div>
                <div>Plán PDF není v databázi.</div>
                <button onclick="openProjectModal('${projectId}')" class="btn btn-primary mt-16">Nahrát PDF</button>
            `;
        }
        showToast('Prosím, nahrajte PDF pro tento projekt', 'info');
        hideLoader();
    }
}

function updatePlanUI(projectId) {
    const project = state.projects.find(p => p.id === projectId);
    
    const elements = {
        title: document.getElementById('planTitle'),
        actions: document.getElementById('planActions'),
        controls: document.getElementById('pdfControls'),
        badges: document.getElementById('workerBadgesContainer'),
        wrapper: document.getElementById('canvasWrapper'),
        canvas: document.getElementById('pdfCanvas'),
        message: document.getElementById('noPlanMessage')
    };
    
    if (project) {
        if (elements.title) elements.title.textContent = project.jmenoProjektu;
        if (elements.actions) elements.actions.style.display = 'flex';
        if (elements.controls) elements.controls.style.display = 'flex';
        if (elements.badges) elements.badges.style.display = 'block';
        if (elements.wrapper) elements.wrapper.style.display = 'block';
        if (elements.canvas) elements.canvas.style.display = 'block';
        if (elements.message) elements.message.style.display = 'none';
        
        renderWorkerBadges(projectId);
    } else {
        if (elements.title) elements.title.textContent = 'Vyberte projekt';
        if (elements.actions) elements.actions.style.display = 'none';
        if (elements.controls) elements.controls.style.display = 'none';
        if (elements.badges) elements.badges.style.display = 'none';
        if (elements.canvas) elements.canvas.style.display = 'none';
        if (elements.message) {
            elements.message.style.display = 'flex';
            elements.message.innerHTML = `
                <div class="empty-state-icon">📋</div>
                <div>Pro zobrazení plánu vyberte projekt výše.</div>
                <button onclick="navigateTo('settings')" class="btn btn-primary mt-16">Přidat Projekt</button>
            `;
        }
    }
}

function renderPDF(pdfData) {
    const loadingTask = pdfjsLib.getDocument({ data: pdfData });
    loadingTask.promise.then(pdf => {
        canvasState.currentPDF = pdf;
        canvasState.totalPages = pdf.numPages;
        canvasState.currentPageNum = 1;
        
        renderPage(canvasState.currentPageNum);
        hideLoader();
        canvasState.pdfRendered = true;
    }).catch(error => {
        console.error('Error loading PDF:', error);
        showToast('Chyba při načítání PDF', 'error');
        hideLoader();
    });
}

function renderPage(pageNum) {
    if (!canvasState.currentPDF) return;
    
    canvasState.currentPageNum = pageNum;
    updatePdfControls();
    
    canvasState.currentPDF.getPage(pageNum).then(page => {
        canvasState.currentPage = page;
        canvasState.currentZoom = 1.0;
        canvasState.panOffsetX = 0;
        canvasState.panOffsetY = 0;
        
        const canvas = document.getElementById('pdfCanvas');
        const container = document.getElementById('canvasWrapper');
        const containerWidth = container ? container.clientWidth : 800;
        
        const viewport = page.getViewport({ scale: 1.0 });
        const scale = containerWidth > 0 ? containerWidth / viewport.width : 1.0;
        canvasState.baseScale = scale;
        
        renderCanvasWithPins();
    });
}

function renderCanvasWithPins() {
    if (!canvasState.currentPage) return;
    
    const canvas = document.getElementById('pdfCanvas');
    if (!canvas) return;
    
    const context = canvas.getContext('2d');
    const totalScale = canvasState.baseScale * canvasState.currentZoom;
    const viewport = canvasState.currentPage.getViewport({ scale: totalScale });
    
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(canvasState.panOffsetX, canvasState.panOffsetY);
    
    const renderContext = { canvasContext: context, viewport: viewport };
    canvasState.currentPage.render(renderContext).promise.then(() => {
        context.restore();
        drawPins(context);
    });
}

function drawPins(context) {
    const projectId = document.getElementById('projectSelect')?.value;
    if (!projectId) return;
    
    const entries = state.workEntries.filter(e => 
        e.type === 'task' && 
        e.projectId === projectId && 
        e.x !== null && e.y !== null &&
        (e.pageNum || 1) === canvasState.currentPageNum
    );
    
    const totalScale = canvasState.baseScale * canvasState.currentZoom;
    
    entries.forEach((entry) => {
        if (!entry.workers || entry.workers.length === 0) return;
        
        const firstWorker = state.workers.find(w => w.id === entry.workers[0]?.workerId);
        const color = firstWorker ? firstWorker.color : '#94a3b8';
        const codes = entry.workers.map(w => w.workerCode).join('+');

        const x = (entry.x * totalScale) + canvasState.panOffsetX;
        const y = (entry.y * totalScale) + canvasState.panOffsetY;
        
        context.beginPath();
        context.arc(x, y, 12, 0, 2 * Math.PI);
        context.fillStyle = color + 'cc';
        context.fill();
        context.strokeStyle = '#fff';
        context.lineWidth = 2;
        context.stroke();
        
        context.fillStyle = '#000';
        context.font = 'bold 10px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(codes, x, y);
        
        context.fillStyle = '#fff';
        context.fillText(entry.tableNumber, x, y + 25);
    });
}

function renderWorkerBadges(projectId) {
    const container = document.getElementById('workerBadges');
    if (!container) return;
    
    if (!projectId) {
        container.innerHTML = '';
        return;
    }
    
    const projectEntries = state.workEntries.filter(e => e.type === 'task' && e.projectId === projectId);
    const workerIds = [...new Set(projectEntries.flatMap(e => e.workers?.map(w => w.workerId) || []))];
    const workers = workerIds.map(id => state.workers.find(w => w.id === id)).filter(Boolean);
    
    if (workers.length === 0) {
        container.innerHTML = '<span style="color: var(--color-text-secondary); font-size: 14px;">Žádní pracovníci na tomto projektu.</span>';
        return;
    }
    
    container.innerHTML = workers.map(w => `
        <div class="worker-badge" data-worker-id="${w.id}" style="background: ${w.color || '#94a3b8'}33; border: 1px solid ${w.color || '#94a3b8'}88;">
            <span class="worker-color-dot" style="background-color: ${w.color || '#94a3b8'}"></span>
            ${w.name} (${w.code || 'N/A'})
        </div>
    `).join('');
}

// PDF CONTROLS
function resetZoom() {
    canvasState.currentZoom = 1.0;
    canvasState.panOffsetX = 0;
    canvasState.panOffsetY = 0;
    renderCanvasWithPins();
}

function changeZoom(delta) {
    const newZoom = canvasState.currentZoom + delta;
    canvasState.currentZoom = Math.max(0.5, Math.min(3.0, newZoom));
    renderCanvasWithPins();
}

function changePage(delta) {
    if (!canvasState.currentPDF) return;
    const newPageNum = canvasState.currentPageNum + delta;
    
    if (newPageNum > 0 && newPageNum <= canvasState.totalPages) {
        renderPage(newPageNum);
    }
}

function updatePdfControls() {
    const indicator = document.getElementById('pageIndicator');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    
    if (indicator) indicator.textContent = `Strana ${canvasState.currentPageNum} / ${canvasState.totalPages}`;
    if (prevBtn) prevBtn.disabled = canvasState.currentPageNum <= 1;
    if (nextBtn) nextBtn.disabled = canvasState.currentPageNum >= canvasState.totalPages;
}

// TOUCH HANDLING
function handleTouchStart(e) {
    e.preventDefault();
    canvasState.touchStartTime = Date.now();
    canvasState.touchMoved = false;
    
    if (e.touches.length === 1) {
        canvasState.lastTouchX = e.touches[0].clientX;
        canvasState.lastTouchY = e.touches[0].clientY;
        canvasState.isDragging = true;
    } else if (e.touches.length === 2) {
        canvasState.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        canvasState.touchStartDistance = Math.sqrt(dx * dx + dy * dy);
        canvasState.touchStartZoom = canvasState.currentZoom;
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    canvasState.touchMoved = true;
    
    if (e.touches.length === 1 && canvasState.isDragging) {
        const deltaX = e.touches[0].clientX - canvasState.lastTouchX;
        const deltaY = e.touches[0].clientY - canvasState.lastTouchY;
        
        canvasState.panOffsetX += deltaX;
        canvasState.panOffsetY += deltaY;
        
        canvasState.lastTouchX = e.touches[0].clientX;
        canvasState.lastTouchY = e.touches[0].clientY;
        
        renderCanvasWithPins();
    } else if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        const scale = distance / canvasState.touchStartDistance;
        const newZoom = canvasState.touchStartZoom * scale;
        canvasState.currentZoom = Math.max(0.5, Math.min(3.0, newZoom));
        
        renderCanvasWithPins();
    }
}

function handleTouchEnd(e) {
    e.preventDefault();
    
    const touchDuration = Date.now() - canvasState.touchStartTime;
    
    if (touchDuration < 300 && !canvasState.touchMoved && e.changedTouches.length === 1) {
        vibrate(20);
        
        const rect = e.target.getBoundingClientRect();
        const x = e.changedTouches[0].clientX - rect.left;
        const y = e.changedTouches[0].clientY - rect.top;
        
        const totalScale = canvasState.baseScale * canvasState.currentZoom;
        const pdfX = (x - canvasState.panOffsetX) / totalScale;
        const pdfY = (y - canvasState.panOffsetY) / totalScale;
        
        const projectId = document.getElementById('projectSelect').value;
        const entries = state.workEntries.filter(en => 
            en.type === 'task' && 
            en.projectId === projectId && 
            en.x !== null &&
            (en.pageNum || 1) === canvasState.currentPageNum
        );
        
        const clickRadius = 15 / totalScale;
        
        let clickedPin = null;
        for (const entry of entries) {
            const distance = Math.sqrt(Math.pow(pdfX - entry.x, 2) + Math.pow(pdfY - entry.y, 2));
            if (distance < clickRadius) {
                clickedPin = entry;
                break;
            }
        }
        
        if (clickedPin) {
            openEditTaskModal(clickedPin.id);
        } else {
            openTaskModal(pdfX, pdfY);
        }
    }
    
    canvasState.isDragging = false;
}

// TASK MANAGEMENT
function populateWorkerChecklist(containerId, selectedWorkerIds = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (state.workers.length === 0) {
        container.innerHTML = '<div style="color: var(--color-text-secondary);">Nejprve přidejte pracovníky v Nastavení.</div>';
        return;
    }

    container.innerHTML = state.workers.map(worker => `
        <div class="worker-checklist-item">
            <input type="checkbox" 
                   id="${containerId}-${worker.id}" 
                   value="${worker.id}"
                   ${selectedWorkerIds.includes(worker.id) ? 'checked' : ''}>
            <label for="${containerId}-${worker.id}">
                <span class="worker-color-dot" style="background-color: ${worker.color || '#94a3b8'}"></span>
                ${worker.name} (${worker.code || 'N/A'})
            </label>
        </div>
    `).join('');
}

function openTaskModal(x, y) {
    if (state.workers.length === 0) {
        showToast('Nejprve přidejte pracovníky v Nastavení', 'error');
        return;
    }
    
    document.getElementById('taskModalTitle').textContent = 'Zadat Hotový Stůl';
    document.getElementById('taskForm').reset();
    document.getElementById('taskEntryId').value = '';
    document.getElementById('taskX').value = x;
    document.getElementById('taskY').value = y;
    
    populateWorkerChecklist('taskWorkerChecklist');
    openModal('taskModal');
}

function openEditTaskModal(entryId) {
    const entry = state.workEntries.find(e => e.id === entryId);
    if (!entry || entry.type !== 'task') return;

    document.getElementById('taskModalTitle').textContent = 'Upravit Stůl';
    document.getElementById('taskEntryId').value = entry.id;
    document.getElementById('taskTableNumber').value = entry.tableNumber;
    document.getElementById('taskRewardPerWorker').value = entry.rewardPerWorker || entry.reward || 0;
    document.getElementById('taskX').value = entry.x;
    document.getElementById('taskY').value = entry.y;
    
    const selectedIds = entry.workers?.map(w => w.workerId) || [];
    populateWorkerChecklist('taskWorkerChecklist', selectedIds);

    openModal('taskModal');
}

function saveTask(event) {
    event.preventDefault();
    const entryId = document.getElementById('taskEntryId').value;
    
    const selectedWorkers = Array.from(document.querySelectorAll('#taskWorkerChecklist input:checked'))
                                 .map(input => input.value);
    
    if (selectedWorkers.length === 0) {
        showToast('Vyberte alespoň jednoho pracovníka', 'error');
        return;
    }

    const workersArray = selectedWorkers.map(id => {
        const w = state.workers.find(w => w.id === id);
        return { workerId: id, workerCode: w ? (w.code || '?') : '?' };
    });

    const projectId = document.getElementById('projectSelect').value;
    const tableNumber = document.getElementById('taskTableNumber').value.trim();
    const rewardPerWorker = parseFloat(document.getElementById('taskRewardPerWorker').value);
    const x = parseFloat(document.getElementById('taskX').value);
    const y = parseFloat(document.getElementById('taskY').value);
    
    if (entryId) {
        const entry = state.workEntries.find(e => e.id === entryId);
        if (entry) {
            entry.workers = workersArray;
            entry.tableNumber = tableNumber;
            entry.rewardPerWorker = rewardPerWorker;
        }
        showToast('Stůl upraven', 'success');
    } else {
        const newEntry = {
            id: 'entry-' + Date.now(),
            type: 'task',
            projectId: projectId,
            tableNumber: tableNumber,
            rewardPerWorker: rewardPerWorker,
            x: x,
            y: y,
            pageNum: canvasState.currentPageNum,
            timestamp: Date.now(),
            workers: workersArray
        };
        state.workEntries.push(newEntry);
        showToast('Stůl přidán', 'success');
    }
    
    saveState();
    renderCanvasWithPins();
    renderRecordsList();
    updateStatistics();
    renderWorkerBadges(projectId);
    closeModal('taskModal');
}

// TIMER FUNCTIONS
function startShift() {
    const workerId = document.getElementById('timerWorker').value;
    if (!workerId) {
        showToast('Vyberte pracovníka', 'error');
        return;
    }
    
    vibrate(100);
    timerState.isRunning = true;
    timerState.startTime = Date.now();
    timerState.workerId = workerId;
    timerState.totalBreakTime = 0;
    
    document.getElementById('startShift').style.display = 'none';
    document.getElementById('stopShift').style.display = 'block';
    document.getElementById('timerWorker').disabled = true;
    
    timerState.intervalId = setInterval(updateTimerDisplay, 1000);
    saveState();
    showToast('Směna zahájena', 'success');
}

function stopShift() {
    if (!timerState.isRunning) return;
    
    vibrate(100);
    const endTime = Date.now();
    const totalMs = endTime - timerState.startTime - timerState.totalBreakTime;
    const totalHours = totalMs / (1000 * 60 * 60);
    
    const worker = state.workers.find(w => w.id === timerState.workerId);
    const totalEarned = totalHours * (worker ? worker.hourlyRate : 0);
    
    const newEntry = {
        id: 'entry-' + Date.now(),
        type: 'hourly',
        workerId: timerState.workerId,
        startTime: timerState.startTime,
        endTime: endTime,
        totalHours: Math.max(0, totalHours),
        totalEarned: Math.max(0, totalEarned)
    };
    
    state.workEntries.push(newEntry);
    
    clearInterval(timerState.intervalId);
    timerState.isRunning = false;
    timerState.startTime = null;
    timerState.workerId = null;
    timerState.totalBreakTime = 0;
    
    saveState();
    
    document.getElementById('startShift').style.display = 'block';
    document.getElementById('stopShift').style.display = 'none';
    document.getElementById('timerWorker').disabled = false;
    document.getElementById('timerDisplay').textContent = '00:00:00';
    
    showToast(`Směna ukončena: ${totalHours.toFixed(2)}h, €${totalEarned.toFixed(2)}`, 'success');
    renderRecordsList();
    updateStatistics();
}

function updateTimerDisplay() {
    if (!timerState.isRunning) return;
    
    const elapsed = Date.now() - timerState.startTime - timerState.totalBreakTime;
    const hours = Math.floor(elapsed / (1000 * 60 * 60));
    const minutes = Math.floor((elapsed % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((elapsed % (1000 * 60)) / 1000);
    
    const display = document.getElementById('timerDisplay');
    if (display) {
        display.textContent = `${String(Math.max(0, hours)).padStart(2, '0')}:${String(Math.max(0, minutes)).padStart(2, '0')}:${String(Math.max(0, seconds)).padStart(2, '0')}`;
    }
}

// RECORDS - OPRAVENO
function renderRecordsList() {
    const container = document.getElementById('recordsList');
    if (!container) return;
    
    const filters = {
        type: document.getElementById('recordsFilter')?.value || 'all',
        worker: document.getElementById('recordsWorkerFilter')?.value || '',
        project: document.getElementById('recordsProjectFilter')?.value || '',
        date: document.getElementById('recordsDateFilter')?.value || 'all'
    };
    
    let entries = state.workEntries;

    // Date filter
    if (filters.date !== 'all') {
        const now = new Date();
        let startDate, endDate;

        if (filters.date === 'today') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).setHours(23, 59, 59, 999);
        } else if (filters.date === 'this_week') {
            const currentDay = now.getDay();
            const diff = now.getDate() - (currentDay === 0 ? 6 : currentDay - 1);
            startDate = new Date(now.getFullYear(), now.getMonth(), diff).setHours(0, 0, 0, 0);
            const startDateObj = new Date(startDate);
            endDate = new Date(startDateObj.setDate(startDateObj.getDate() + 6)).setHours(23, 59, 59, 999);
        } else if (filters.date === 'this_month') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).setHours(23, 59, 59, 999);
        }

        if (startDate && endDate) {
            entries = entries.filter(e => {
                const entryDate = new Date(e.timestamp || e.startTime).getTime();
                return entryDate >= startDate && entryDate <= endDate;
            });
        }
    }

    // Other filters
    if (filters.project) entries = entries.filter(e => e.type === 'task' && e.projectId === filters.project);
    if (filters.type !== 'all') entries = entries.filter(e => e.type === filters.type);
    if (filters.worker) {
        entries = entries.filter(e => {
            if (e.type === 'hourly') return e.workerId === filters.worker;
            if (e.type === 'task') return e.workers?.some(w => w.workerId === filters.worker);
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
            
            // OPRAVA: Bezpečná kontrola
            const workers = entry.workers || [{ workerId: 'unknown', workerCode: '?' }];
            const rewardPerWorker = entry.rewardPerWorker || entry.reward || 0;
            
            const workerDetails = workers.map(w => {
                const worker = state.workers.find(f => f.id === w.workerId);
                return {
                    name: worker ? worker.name : 'Neznámý',
                    color: worker ? worker.color : '#94a3b8'
                };
            });

            const workerDots = workerDetails.map(d => `<span class="worker-color-dot" style="background-color: ${d.color}"></span>`).join('');
            const workerNames = workerDetails.map(d => d.name).join(', ');
            const totalReward = rewardPerWorker * workers.length;
            const canEdit = entry.x !== null;
            
            return `
                <div class="record-item">
                    <div class="record-header">
                        <span class="record-type record-type-task">Stůl</span>
                        <div class="record-actions">
                            ${canEdit ? `<button onclick="openEditTaskModal('${entry.id}')" class="record-btn" style="background: rgba(59, 130, 246, 0.2); color: var(--color-primary);">Upravit</button>` : ''}
                            <button onclick="deleteEntry('${entry.id}')" class="record-btn" style="background: rgba(239, 68, 68, 0.2); color: var(--color-danger);">Smazat</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;"><strong>${entry.tableNumber}</strong></div>
                    <div style="font-size: 14px; color: var(--color-text-secondary);">
                        <div class="record-item-worker-name" style="margin-bottom: 8px;">
                            ${workerDots}
                            <span style="margin-left: 4px;">${workerNames}</span>
                        </div>
                        <div>📋 ${projectName}</div>
                        <div>💰 €${totalReward.toFixed(2)} (${workers.length}x €${rewardPerWorker.toFixed(2)})</div>
                        <div>📅 ${date.toLocaleDateString('cs-CZ')} ${date.toLocaleTimeString('cs-CZ')}</div>
                        ${!canEdit ? '<div>(Ručně zadaný)</div>' : ''}
                    </div>
                </div>
            `;
        } else {
            const worker = state.workers.find(w => w.id === entry.workerId);
            const workerName = worker ? worker.name : 'Neznámý';
            const workerColor = worker ? worker.color : '#94a3b8';
            const startDate = new Date(entry.startTime);
            const endDate = new Date(entry.endTime);
            
            return `
                <div class="record-item">
                    <div class="record-header">
                        <span class="record-type record-type-hourly">Hodiny</span>
                        <div class="record-actions">
                            <button onclick="deleteEntry('${entry.id}')" class="record-btn" style="background: rgba(239, 68, 68, 0.2); color: var(--color-danger);">Smazat</button>
                        </div>
                    </div>
                    <div style="margin-bottom: 8px;" class="record-item-worker-name">
                        <span class="worker-color-dot" style="background-color: ${workerColor}"></span>
                        <strong>${workerName}</strong>
                    </div>
                    <div style="font-size: 14px; color: var(--color-text-secondary);">
                        <div>⏱️ ${(entry.totalHours || 0).toFixed(2)} hodin</div>
                        <div>💰 €${(entry.totalEarned || 0).toFixed(2)}</div>
                        <div>📅 ${startDate.toLocaleDateString('cs-CZ')} ${startDate.toLocaleTimeString('cs-CZ')}</div>
                        <div>→ ${endDate.toLocaleTimeString('cs-CZ')}</div>
                    </div>
                </div>
            `;
        }
    }).join('');
}

function deleteEntry(entryId) {
    if (confirm('Opravdu chcete smazat tento záznam?')) {
        const entry = state.workEntries.find(e => e.id === entryId);
        const projectId = entry?.projectId;
        
        state.workEntries = state.workEntries.filter(e => e.id !== entryId);
        saveState();
        renderRecordsList();
        
        if (projectId && entry?.x !== null) {
            renderCanvasWithPins();
            renderWorkerBadges(projectId);
        }

        updateStatistics();
        showToast('Záznam smazán', 'success');
    }
}

// STATISTICS - OPRAVENO
function updateStatistics() {
    const workerFilter = document.getElementById('statsWorkerFilter')?.value || '';
    const projectFilter = document.getElementById('statsProjectFilter')?.value || '';
    
    let entries = state.workEntries;
    
    if (workerFilter) {
        entries = entries.filter(e => {
            if (e.type === 'hourly') return e.workerId === workerFilter;
            if (e.type === 'task') return e.workers?.some(w => w.workerId === workerFilter);
            return false;
        });
    }
    
    if (projectFilter) {
        entries = entries.filter(e => e.type === 'hourly' || (e.type === 'task' && e.projectId === projectFilter));
    }
    
    const taskEntries = entries.filter(e => e.type === 'task');
    const hourlyEntries = entries.filter(e => e.type === 'hourly');
    
    // OPRAVA: Bezpečný výpočet
    const totalTaskEarnings = taskEntries.reduce((sum, e) => {
        const rewardPerWorker = e.rewardPerWorker || e.reward || 0;
        const workersCount = e.workers?.length || 1;
        return sum + (rewardPerWorker * workersCount);
    }, 0);
    
    const totalHourlyEarnings = hourlyEntries.reduce((sum, e) => sum + (e.totalEarned || 0), 0);
    const totalEarnings = totalTaskEarnings + totalHourlyEarnings;
    const totalHours = hourlyEntries.reduce((sum, e) => sum + (e.totalHours || 0), 0);
    const totalTables = taskEntries.length;
    const avgReward = totalTables > 0 ? totalTaskEarnings / totalTables : 0;
    
    // Update UI
    const statElements = {
        earnings: document.getElementById('statTotalEarnings'),
        hours: document.getElementById('statTotalHours'),
        tables: document.getElementById('statTotalTables'),
        avgReward: document.getElementById('statAvgReward')
    };
    
    if (statElements.earnings) statElements.earnings.textContent = `€${totalEarnings.toFixed(2)}`;
    if (statElements.hours) statElements.hours.textContent = `${totalHours.toFixed(1)}h`;
    if (statElements.tables) statElements.tables.textContent = totalTables;
    if (statElements.avgReward) statElements.avgReward.textContent = `€${avgReward.toFixed(2)}`;
    
    // Worker chart - OPRAVENO
    const workerChart = document.getElementById('workerEarningsChart');
    if (workerChart) {
        const workerEarnings = {};
        
        entries.forEach(entry => {
            if (entry.type === 'task' && entry.workers) {
                entry.workers.forEach(w => {
                    if (!workerEarnings[w.workerId]) {
                        const worker = state.workers.find(f => f.id === w.workerId);
                        workerEarnings[w.workerId] = { 
                            name: worker ? worker.name : 'Neznámý', 
                            color: worker ? worker.color : '#94a3b8', 
                            amount: 0 
                        };
                    }
                    workerEarnings[w.workerId].amount += entry.rewardPerWorker || 0;
                });
            } else if (entry.type === 'hourly') {
                if (!workerEarnings[entry.workerId]) {
                    const worker = state.workers.find(w => w.id === entry.workerId);
                    workerEarnings[entry.workerId] = { 
                        name: worker ? worker.name : 'Neznámý', 
                        color: worker ? worker.color : '#94a3b8', 
                        amount: 0 
                    };
                }
                workerEarnings[entry.workerId].amount += entry.totalEarned || 0;
            }
        });
        
        const workerEntries = Object.values(workerEarnings).filter(data => data.amount > 0);
        
        if (workerEntries.length > 0) {
            workerChart.innerHTML = workerEntries
                .sort((a, b) => b.amount - a.amount)
                .map(data => `
                    <div style="margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                            <span style="display: flex; align-items: center; gap: 8px;">
                                <span class="worker-color-dot" style="background-color: ${data.color}"></span>
                                ${data.name}
                            </span>
                            <span style="font-weight: 600;">€${data.amount.toFixed(2)}</span>
                        </div>
                        <div style="background: rgba(255,255,255,0.1); height: 8px; border-radius: 4px; overflow: hidden;">
                            <div style="background: ${data.color}; height: 100%; width: ${totalEarnings > 0 ? (data.amount / totalEarnings * 100).toFixed(1) : 0}%;"></div>
                        </div>
                    </div>
                `).join('');
        } else {
            workerChart.innerHTML = '<div class="chart-placeholder">Žádná data k zobrazení</div>';
        }
    }
}

// EXPORT FUNCTIONS
function escapeCSV(str) {
    if (str === null || str === undefined) return '""';
    str = String(str);
    let result = str.replace(/"/g, '""');
    if (result.search(/("|,|\n)/g) >= 0) {
        result = `"${result}"`;
    }
    return result;
}

function exportToCSV() {
    if (state.workEntries.length === 0) {
        showToast('Není co exportovat', 'info');
        return;
    }

    showLoader();

    const headers = [
        "ID_Zaznamu", "Typ", "Datum", 
        "Pracovnik_ID", "Pracovnik_Jmeno", "Pracovnik_Kod", 
        "Projekt_ID", "Projekt_Jmeno", 
        "Cislo_Stolu", "Pocet_Hodin", "Vydelano_EUR"
    ];
    let csvContent = headers.join(",") + "\r\n";

    state.workEntries.forEach(entry => {
        if (entry.type === 'hourly') {
            const worker = state.workers.find(w => w.id === entry.workerId) || { name: 'Neznamy', code: 'N/A' };
            const date = new Date(entry.startTime).toISOString();
            const row = [
                entry.id, entry.type, date,
                entry.workerId, worker.name, worker.code,
                "", "",
                "", (entry.totalHours || 0).toFixed(2), (entry.totalEarned || 0).toFixed(2)
            ];
            csvContent += row.map(escapeCSV).join(",") + "\r\n";
        } else if (entry.type === 'task' && entry.workers) {
            const project = state.projects.find(p => p.id === entry.projectId) || { jmenoProjektu: 'Neznamy' };
            const date = new Date(entry.timestamp).toISOString();
            
            entry.workers.forEach(w => {
                const worker = state.workers.find(f => f.id === w.workerId) || { name: 'Neznamy', code: 'N/A' };
                const row = [
                    entry.id, entry.type, date,
                    w.workerId, worker.name, w.workerCode,
                    entry.projectId, project.jmenoProjektu,
                    entry.tableNumber, "", (entry.rewardPerWorker || 0).toFixed(2)
                ];
                csvContent += row.map(escapeCSV).join(",") + "\r\n";
            });
        }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const date = new Date().toISOString().split('T')[0];
    a.download = `solar_work_export_${date}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    hideLoader();
    showToast('CSV export úspěšně vygenerován', 'success');
}

// BACKUP/RESTORE
async function backupData() {
    showLoader();
    try {
        const localStorageState = localStorage.getItem('solarWorkState_v4');
        const localStorageTimer = localStorage.getItem('solarWorkTimer_v4');
        const indexedDBData = await getAllPDFs();
        
        const backupData = {
            version: '4.1',
            timestamp: Date.now(),
            localStorage: {
                solarWorkState_v4: localStorageState,
                solarWorkTimer_v4: localStorageTimer
            },
            indexedDB: {
                pdfStore: indexedDBData
            }
        };
        
        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const date = new Date().toISOString().split('T')[0];
        a.download = `solar_work_backup_v4.1_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        hideLoader();
        showToast('Záloha úspěšně vytvořena', 'success');
        
    } catch (error) {
        hideLoader();
        showToast('Chyba při vytváření zálohy', 'error');
    }
}

function triggerRestore() {
    const input = document.getElementById('restoreFileInput');
    if (input) input.click();
}

async function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('Opravdu chcete obnovit data ze zálohy? Všechna současná data budou přepsána!')) {
        event.target.value = null;
        return;
    }

    showLoader();
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const backupData = JSON.parse(e.target.result);
            
            if (!backupData.localStorage || !backupData.indexedDB) {
                throw new Error('Neplatný formát souboru zálohy.');
            }

            localStorage.clear();
            await clearPDFStore();
            
            if (backupData.localStorage.solarWorkState_v4) {
                localStorage.setItem('solarWorkState_v4', backupData.localStorage.solarWorkState_v4);
            }
            if (backupData.localStorage.solarWorkTimer_v4) {
                localStorage.setItem('solarWorkTimer_v4', backupData.localStorage.solarWorkTimer_v4);
            }
            
            const pdfStoreData = backupData.indexedDB.pdfStore || [];
            if (!db) await initDB();
            
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            for (const item of pdfStoreData) {
                store.put(item);
            }

            await new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(event.target.error);
            });

            hideLoader();
            showToast('Data úspěšně obnovena. Aplikace se restartuje.', 'success');
            setTimeout(() => location.reload(), 2000);

        } catch (error) {
            hideLoader();
            showToast(`Chyba při obnově: ${error.message}`, 'error');
        } finally {
            event.target.value = null;
        }
    };
    
    reader.readAsText(file);
}

// DAILY REPORT
function generateDailyReport() {
    const dateInput = document.getElementById('reportDate')?.value;
    if (!dateInput) {
        showToast('Vyberte datum', 'error');
        return;
    }
    
    const selectedDate = new Date(dateInput);
    selectedDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const entries = state.workEntries.filter(entry => {
        const entryDate = new Date(entry.timestamp || entry.startTime);
        return entryDate >= selectedDate && entryDate < nextDate;
    });
    
    if (entries.length === 0) {
        showToast('Žádné záznamy pro vybrané datum', 'info');
        return;
    }
    
    let report = `DENNÍ REPORT - ${selectedDate.toLocaleDateString('cs-CZ')}\n${'='.repeat(50)}\n\n`;
    
    const workerGroups = {};
    entries.forEach(entry => {
        if (entry.type === 'task' && entry.workers) {
            entry.workers.forEach(w => {
                const worker = state.workers.find(f => f.id === w.workerId);
                const workerName = worker ? worker.name : 'Neznámý';
                
                if (!workerGroups[workerName]) {
                    workerGroups[workerName] = { tasks: [], hourly: [], worker: worker };
                }
                workerGroups[workerName].tasks.push({
                    tableNumber: entry.tableNumber,
                    reward: entry.rewardPerWorker || 0,
                    projectId: entry.projectId
                });
            });
        } else if (entry.type === 'hourly') {
            const worker = state.workers.find(w => w.id === entry.workerId);
            const workerName = worker ? worker.name : 'Neznámý';
            if (!workerGroups[workerName]) {
                workerGroups[workerName] = { tasks: [], hourly: [], worker: worker };
            }
            workerGroups[workerName].hourly.push(entry);
        }
    });
    
    let grandTotal = 0;

    Object.entries(workerGroups).forEach(([workerName, data]) => {
        const workerCode = data.worker ? (data.worker.code || 'N/A') : 'N/A';
        report += `PRACOVNÍK: ${workerName} (Kód: ${workerCode})\n${'-'.repeat(50)}\n`;
        
        let taskTotal = 0;
        if (data.tasks.length > 0) {
            report += '\nHotové Stoly:\n';
            data.tasks.forEach(task => {
                const project = state.projects.find(p => p.id === task.projectId);
                const projectName = project ? project.jmenoProjektu : 'N/A';
                report += `  • Stůl ${task.tableNumber} (${projectName}) - €${task.reward.toFixed(2)}\n`;
                taskTotal += task.reward;
            });
            report += `  Celkem ze stolů: €${taskTotal.toFixed(2)}\n`;
        }
        
        let hourlyTotal = 0;
        if (data.hourly.length > 0) {
            report += '\nOdpracované Hodiny:\n';
            data.hourly.forEach(h => {
                report += `  • ${(h.totalHours || 0).toFixed(2)}h - €${(h.totalEarned || 0).toFixed(2)}\n`;
                hourlyTotal += h.totalEarned || 0;
            });
            report += `  Celkem z hodin: €${hourlyTotal.toFixed(2)}\n`;
        }
        
        const workerTotal = taskTotal + hourlyTotal;
        grandTotal += workerTotal;
        report += `\n  CELKEM: €${workerTotal.toFixed(2)}\n\n`;
    });
    
    report += `${'='.repeat(50)}\nCELKOVÝ SOUČET: €${grandTotal.toFixed(2)}\n`;
    
    const reportContent = document.getElementById('reportContent');
    if (reportContent) reportContent.textContent = report;
    
    openModal('reportModal');
}

function copyReport() {
    const reportContent = document.getElementById('reportContent');
    if (!reportContent) return;
    
    const reportText = reportContent.textContent;
    
    if (navigator.clipboard) {
        navigator.clipboard.writeText(reportText).then(() => {
            showToast('Report zkopírován do schránky', 'success');
        }).catch(() => {
            showToast('Chyba při kopírování', 'error');
        });
    } else {
        try {
            const textArea = document.createElement("textarea");
            textArea.value = reportText;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            showToast('Report zkopírován do schránky', 'success');
        } catch (err) {
            showToast('Chyba při kopírování', 'error');
        }
    }
}

// MANUAL ENTRY FUNCTIONS
function openManualHourModal() {
    const form = document.getElementById('manualHourForm');
    const dateInput = document.getElementById('manualHourDate');
    
    if (form) form.reset();
    if (dateInput) dateInput.valueAsDate = new Date();
    
    openModal('manualHourModal');
}

function saveManualHours(event) {
    event.preventDefault();
    
    const workerId = document.getElementById('manualHourWorker').value;
    const dateInput = document.getElementById('manualHourDate').value;
    const totalHours = parseFloat(document.getElementById('manualHourTotalHours').value);
    
    if (!workerId || !dateInput || !totalHours || totalHours <= 0) {
        showToast('Vyplňte všechna pole', 'error');
        return;
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
        showToast('Pracovník nenalezen', 'error');
        return;
    }

    const totalEarned = totalHours * worker.hourlyRate;
    const startTime = new Date(dateInput);
    startTime.setHours(8, 0, 0, 0);
    const endTime = new Date(startTime.getTime() + totalHours * 60 * 60 * 1000);

    const newEntry = {
        id: 'entry-' + Date.now(),
        type: 'hourly',
        workerId: workerId,
        startTime: startTime.getTime(),
        endTime: endTime.getTime(),
        totalHours: totalHours,
        totalEarned: totalEarned
    };

    state.workEntries.push(newEntry);
    saveState();
    
    renderRecordsList();
    updateStatistics();
    closeModal('manualHourModal');
    showToast(`Ručně přidáno ${totalHours}h pro ${worker.name}`, 'success');
}

function openManualTaskModal() {
    const form = document.getElementById('manualTaskForm');
    const dateInput = document.getElementById('manualTaskDate');
    
    if (form) form.reset();
    if (dateInput) dateInput.valueAsDate = new Date();
    
    populateWorkerChecklist('manualTaskWorkerChecklist');
    openModal('manualTaskModal');
}

function saveManualTask(event) {
    event.preventDefault();
    
    const selectedWorkers = Array.from(document.querySelectorAll('#manualTaskWorkerChecklist input:checked'))
                                 .map(input => input.value);
    const projectId = document.getElementById('manualTaskProject').value;
    const dateInput = document.getElementById('manualTaskDate').value;
    const tableNumbersString = document.getElementById('manualTaskTableNumbers').value;
    const rewardPerWorker = parseFloat(document.getElementById('manualTaskRewardPerWorker').value);

    if (selectedWorkers.length === 0 || !projectId || !dateInput || !tableNumbersString || rewardPerWorker < 0) {
        showToast('Vyplňte všechna pole (včetně pracovníků)', 'error');
        return;
    }

    const workersArray = selectedWorkers.map(id => {
        const w = state.workers.find(w => w.id === id);
        return { workerId: id, workerCode: w ? (w.code || '?') : '?' };
    });
    
    const tableNumbers = tableNumbersString.split(',').map(s => s.trim()).filter(s => s.length > 0);
    
    if (tableNumbers.length === 0) {
        showToast('Zadejte alespoň jedno číslo stolu', 'error');
        return;
    }
    
    const timestamp = new Date(dateInput);
    timestamp.setHours(12, 0, 0, 0);
    
    let entriesAdded = 0;
    tableNumbers.forEach((tableNum, index) => {
        const newEntry = {
            id: 'entry-' + Date.now() + '-' + index,
            type: 'task',
            projectId: projectId,
            tableNumber: tableNum,
            rewardPerWorker: rewardPerWorker,
            x: null,
            y: null,
            pageNum: 1,
            timestamp: timestamp.getTime(),
            workers: workersArray
        };
        state.workEntries.push(newEntry);
        entriesAdded++;
    });

    saveState();
    renderRecordsList();
    updateStatistics();
    
    if (document.getElementById('projectSelect')?.value === projectId) {
        renderWorkerBadges(projectId);
    }

    closeModal('manualTaskModal');
    showToast(`Ručně přidáno ${entriesAdded} stolů`, 'success');
}
