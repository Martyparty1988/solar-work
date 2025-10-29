// =============================================
// SOLAR WORK v4.0 - UPGRADE 🚀
// =============================================
// PDF.js Worker Configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

// Paleta barev pro pracovníky
const WORKER_COLORS = [
    '#ef4444', '#f97316', '#22c55e', '#3b82f6', 
    '#a855f7', '#ec4899', '#22d3ee', '#a3e635'
];

// State Management - ROZŠÍŘENO v4.0
let state = {
    projects: [], 
    workers: [], 
    workEntries: [],
    templates: [], // NOVÉ: Šablony projektů
    settings: {
        theme: 'dark',
        autoBackup: false,
        notifications: true
    }
};

// Canvas State - ROZŠÍŘENO v4.0
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
    // NOVÉ: Pro drag&drop pinů
    selectedPins: [],
    draggedPin: null,
    dragStartX: 0,
    dragStartY: 0,
    isEditMode: false,
    history: [], // Pro undo/redo
    historyIndex: -1
};

// Timer State - ROZŠÍŘENO v4.0
let timerState = {
    isRunning: false,
    startTime: null,
    workerId: null,
    intervalId: null,
    breakStartTime: null, // NOVÉ: Break tracking
    totalBreakTime: 0
};

// IndexedDB variables
const DB_NAME = 'SolarWorkDB_v2';
const STORE_NAME = 'pdfStore';
let db;

// =============================================
// INDEXEDDB HELPERS
// =============================================

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
            console.log('IndexedDB initialized');
            resolve(db);
        };
        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
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
// INITIALIZE APP v4.0
// =============================================

async function initApp() {
    try {
        await initDB();
    } catch (error) {
        console.error('Failed to init DB', error);
        showToast('Chyba databáze, PDF nebudou uložena', 'error');
    }

    loadState();
    setupEventListeners();
    setupKeyboardShortcuts(); // NOVÉ
    applyTheme(); // NOVÉ
    
    document.getElementById('backupButton').addEventListener('click', backupData);
    document.getElementById('restoreButton').addEventListener('click', triggerRestore);
    document.getElementById('restoreFileInput').addEventListener('change', restoreData);
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    
    // NOVÉ: Advanced reports
    document.getElementById('exportPDFReport')?.addEventListener('click', exportPDFReport);
    document.getElementById('exportExcelReport')?.addEventListener('click', exportExcelReport);

    renderProjectsDropdown();
    renderWorkersList();
    renderProjectsList();
    renderRecordsList();
    renderTemplatesList(); // NOVÉ
    updateStatistics();
    updateDashboard(); // NOVÉ
    
    document.getElementById('reportDate').valueAsDate = new Date();
    
    if (timerState.isRunning && timerState.startTime) {
        document.getElementById('startShift').style.display = 'none';
        document.getElementById('stopShift').style.display = 'block';
        document.getElementById('pauseShift')?.style.display = 'block'; // NOVÉ
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
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('SW registration failed:', err));
    }
    
    // NOVÉ: Request notification permission
    if ('Notification' in window && state.settings.notifications) {
        Notification.requestPermission();
    }
}

// =============================================
// POKRAČOVÁNÍ NÁSLEDUJE...
// =============================================
// Přidáme zbytek funkcí v dalším commitu