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

// Global navigateTo function for UI navigation
function navigateTo(pageName) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    const targetPage = document.getElementById(pageName);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

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
                    if (!e.workers && e.workerId) {
                        e.workers = [{ workerId: e.workerId, workerCode: e.workerCode || '?' }];
                    }
                    if (!e.workers || e.workers.length === 0) {
                        e.workers = [{ workerId: 'unknown', workerCode: '?' }];
                    }
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
    }
}

function saveState() {
    localStorage.setItem('solarWorkState_v4', JSON.stringify(state));
    localStorage.setItem('solarWorkTimer_v4', JSON.stringify(timerState));
}

// DOM Ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
