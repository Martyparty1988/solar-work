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
    getWorkEntries: () => state.workEntries
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
    
    document.getElementById('backupButton').addEventListener('click', backupData);
    document.getElementById('restoreButton').addEventListener('click', triggerRestore);
    document.getElementById('restoreFileInput').addEventListener('change', restoreData);
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);

    renderProjectsDropdown();
    renderWorkersList();
    renderProjectsList();
    renderRecordsList();
    updateStatistics();
    
    document.getElementById('reportDate').valueAsDate = new Date();
    
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
    document.getElementById('startShift').addEventListener('click', startShift);
    document.getElementById('stopShift').addEventListener('click', stopShift);
    
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
    const filters = ['recordsFilter', 'recordsWorkerFilter', 'recordsProjectFilter', 'recordsDateFilter', 'statsWorkerFilter', 'statsProjectFilter'];
    filters.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', id.startsWith('stats') ? updateStatistics : renderRecordsList);
        }
    });
}

// Vibrace
function vibrate(duration = 50) {
    if ('vibrate' in navigator) {
        try {
            navigator.vibrate(duration);
        } catch (e) {
            console.warn('Vibration failed', e);
        }
    }
}

// Toasts
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
            
            if (document.getElementById('projectSelect').value === projectIdToSave) {
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

// Boot app
window.addEventListener('DOMContentLoaded', initApp);