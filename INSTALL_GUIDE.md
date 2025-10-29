# 📝 INSTALAČNÍ PRůVODCE - Solar Work v4.0

## ⚠️ PŘED INSTALACÍ

### 1. Záloha současné verze
```bash
cp app.js app_backup.js
cp index.html index_backup.html  
cp style.css style_backup.css
```

### 2. Nové funkce co přidáváme:
✅ **Pokročilé PDF Interakce** - Drag&Drop, Bulk editing, Undo/Redo  
✅ **Dashboard** - KPI karty, trendy, predikce, analytics  
✅ **Smart Templates** - Šablony projektů s quick apply  
✅ **Advanced Reporting** - PDF & Excel export  
✅ **PWA Vylepšení** - Break tracking, notifications, themes  

## 📦 SOUBORY K AKTUALIZACI

### 1. app.js ✅ 
Kompletně nahradit novym v4.0 souborem:
- Starý: 75KB (v3)
- Nový: 108KB (v4) - všechny nové funkce + zachované původní
- Automatická migrace dat z v3 → v4

### 2. index.html - Přidat nové sekce

**A) Nová stránka Dashboard** (před page-plan):
```html
<div id="page-dashboard" class="page">
    <!-- 5 KPI karet -->
    <div class="dashboard-kpi-grid">
        <div class="kpi-card">
            <div class="kpi-icon">💰</div>
            <div class="kpi-value" id="dashTotalEarnings">€0</div>
            <div class="kpi-label">Výdělky</div>
        </div>
        <!-- + 4 další KPI karty -->
    </div>
    
    <!-- Grafy a analytics -->
    <div class="card mb-16">
        <h3>📈 Trendy</h3>
        <div id="productivityTrend"></div>
    </div>
    <!-- + další grafy -->
</div>
```

**B) Plan toolbar** (začátek page-plan):
```html
<div class="plan-toolbar">
    <button id="toggleEditMode" class="btn btn-secondary">✏️ Edit</button>
    <button onclick="toggleTheme()" class="btn btn-secondary">🌓 Téma</button>
</div>

<div id="editModeToolbar" class="edit-toolbar" style="display:none;">
    <button id="selectAllPins" class="btn">☑️ Vše</button>
    <button id="deleteSelected" class="btn btn-danger">🗑️ Smazat</button>
    <button id="undoButton" class="btn" disabled>↶ Undo</button>
    <button id="redoButton" class="btn" disabled>↷ Redo</button>
</div>
```

**C) Templates** (page-settings před projekty):
```html
<div class="card mb-24">
    <h2>📋 Šablony</h2>
    <button onclick="openTemplateModal()" class="btn btn-primary w-full mb-16">
        Vytvořit Šablonu
    </button>
    <div id="templatesList"></div>
</div>
```

**D) Advanced Reports** (page-settings):
```html
<div class="card mb-24">
    <h2>📅 Pokročilé Reporty</h2>
    <div class="flex gap-8">
        <button id="exportPDFReport" class="btn btn-secondary w-full">
            📄 PDF
        </button>
        <button id="exportExcelReport" class="btn btn-secondary w-full">
            📁 Excel
        </button>
    </div>
</div>
```

**E) Enhanced Timer** (nahradit v page-records):
```html
<div class="card mb-16">
    <h2>⏱️ Časovač</h2>
    <select id="timerWorker" class="form-control"></select>
    <div class="timer-display" id="timerDisplay">00:00:00</div>
    <div id="breakInfo" class="break-info" style="display:none;">
        ⏸️ Přestávka: <span id="breakDuration">0 min</span>
    </div>
    <div class="flex gap-8">
        <button id="startShift" class="btn btn-success w-full">▶️ Start</button>
        <button id="pauseShift" class="btn btn-secondary w-full" style="display:none;">⏸️ Pause</button>
        <button id="stopShift" class="btn btn-danger w-full" style="display:none;">⏹️ Stop</button>
    </div>
</div>
```

**F) Template Modal** (před </body>):
```html
<div id="templateModal" class="modal">
    <div class="modal-content">
        <h3 id="templateModalTitle">Nová Šablona</h3>
        <form id="templateForm" onsubmit="saveTemplate(event)">
            <input type="hidden" id="templateId">
            <input type="text" id="templateName" placeholder="Název" required>
            <input type="number" id="templateEstimatedTables" placeholder="Počet stolů" required>
            <input type="number" id="templateRewardPerWorker" step="0.01" placeholder="Odměna/stůl" required>
            <div id="templateWorkerChecklist" class="worker-checklist"></div>
            <div class="flex gap-8">
                <button type="button" onclick="closeModal('templateModal')" class="btn btn-secondary w-full">Zrušit</button>
                <button type="submit" class="btn btn-primary w-full">Uložit</button>
            </div>
        </form>
    </div>
</div>
```

**G) Nová navigace** (nahradit .bottom-nav - 5 tabů):
```html
<nav class="bottom-nav">
    <div class="nav-item" onclick="navigateTo('dashboard')" data-page="dashboard">
        <div class="nav-icon">📁</div>
        <div class="nav-label">Dashboard</div>
    </div>
    <div class="nav-item active" onclick="navigateTo('plan')" data-page="plan">
        <div class="nav-icon">📋</div>
        <div class="nav-label">Plán</div>
    </div>
    <div class="nav-item" onclick="navigateTo('records')" data-page="records">
        <div class="nav-icon">📝</div>
        <div class="nav-label">Záznamy</div>
    </div>
    <div class="nav-item" onclick="navigateTo('statistics')" data-page="statistics">
        <div class="nav-icon">📈</div>
        <div class="nav-label">Statistiky</div>
    </div>
    <div class="nav-item" onclick="navigateTo('settings')" data-page="settings">
        <div class="nav-icon">⚙️</div>
        <div class="nav-label">Nastavení</div>
    </div>
</nav>
```

### 3. style.css - Přidat na konec
Viz style_additions.css soubor s novými CSS styly.

## 🚀 RYCHLÝ DEPLOYMENT

```bash
# 1. Backup
cp app.js app_backup.js

# 2. Nový app.js 
cp app_v4.js app.js

# 3. Přidat HTML sekce do index.html
# (dle instrukcí výše)

# 4. Přidat CSS styly do style.css
# (z style_additions.css)

# 5. Test
npm start

# 6. Deploy
vercel --prod
```

## ✅ CHECKLIST
- [ ] app.js nahrazen v4.0
- [ ] Dashboard stránka přidána
- [ ] Plan toolbar přidán
- [ ] Templates sekce přidána
- [ ] Advanced reports přidány
- [ ] Timer vylepšen
- [ ] Template modal přidán
- [ ] Navigace aktualizována (5 tabů)
- [ ] CSS styly přidány
- [ ] Localhost test OK
- [ ] Produkční deployment OK

## 📱 OČekávané výsledky:
1. 📁 **Dashboard** jako úvodní stránka
2. ✏️ **Drag&Drop pinů** na plánech
3. 📋 **Šablony** pro rychlejší setup
4. 📄 **PDF/Excel reporty** pro klienty
5. ⏸️ **Break tracking** v časovači
6. 🌓 **Light/Dark theme**
7. ↶↷ **Undo/Redo** (Ctrl+Z/Ctrl+Shift+Z)
8. 📦 **Migrace dat** z v3 na v4

Ready to upgrade! 🚀

---
**Status**: Production Ready  
**Testováno**: iPhone 15 Pro, Desktop  
**Deploy**: Vercel compatible