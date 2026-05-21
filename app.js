let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let capturedPhotos = [];
let html5Scanner = null;
let serverAvailable = false;
const API_BASE = '/api';
const SUPABASE_URL_RAW = (window.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
const SUPABASE_TABLE = 'requests';
const USE_SUPABASE = !!(SUPABASE_URL_RAW && SUPABASE_ANON_KEY && SUPABASE_URL_RAW.includes('supabase.co'));

const STATUS_LABELS = { open: 'Открыта', repair: 'В ремонте', completed: 'Выполнена' };
const STATUS_ICONS = { open: '🟦', repair: '🟧', completed: '🟩' };

async function apiFetch(path, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
        const res = await fetch(`${API_BASE}${path}`, {
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            ...options
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        serverAvailable = false;
        throw e;
    }
}

async function initApp() {
    currentUser = checkAuthentication();
    if (!currentUser) { window.location.href = 'login.html'; return; }

    document.getElementById('userBadge').textContent = `👤 ${currentUser.name}`;
    document.getElementById('appShell').style.display = 'flex';
    document.getElementById('bottomTabs').style.display = 'flex';

    // Скрываем таб "Новая" для ремонтной службы
    if (!currentUser.permissions.canAdd) {
        const tabNew = document.querySelector('.tab-btn[data-tab="tabNew"]');
        if (tabNew) tabNew.style.display = 'none';
    }

    setupTabs();
    setupForm();
    setupSearchableSelect();
    await Promise.all([loadEquipmentDatabase(), loadRequests()]).catch(() => {});

    document.getElementById('loadingScreen').style.display = 'none';

    if (USE_SUPABASE) {
        setInterval(async () => {
            const data = await loadFromSupabase();
            if (data && data.length > 0) {
                const localIds = new Set(repairRequests.map(r => r.id));
                let changed = false;
                data.forEach(r => {
                    if (!localIds.has(r.id)) {
                        repairRequests.push(r);
                        changed = true;
                    }
                });
                if (changed) {
                    localStorage.setItem('repair_requests', JSON.stringify(repairRequests));
                    renderRequests();
                    updateSummary();
                }
            }
        }, 15000);
    }
}

// ========== TABS ==========
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            if (btn.dataset.tab === 'tabStats') renderReport();
        });
    });
}

function switchTab(name) {
    document.querySelector(`.tab-btn[data-tab="${name}"]`)?.click();
}

// ========== FORM ==========
function setupForm() {
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (timeInput) {
        const n = new Date();
        timeInput.value = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
    }
    document.getElementById('repairForm')?.addEventListener('submit', e => { e.preventDefault(); submitRequest(); });
}

function setupSearchableSelect() {
    const input = document.getElementById('invNumberSearch');
    const select = document.getElementById('invNumber');
    if (!input || !select) return;
    input.addEventListener('input', function() {
        const t = this.value.toLowerCase();
        for (let i = 0; i < select.options.length; i++) {
            select.options[i].style.display = select.options[i].text.toLowerCase().includes(t) ? '' : 'none';
        }
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].style.display !== 'none') { select.selectedIndex = i; handleInvNumberChange.call(select); break; }
        }
    });
}

function handleInvNumberChange() {
    const eq = equipmentDatabase.find(e => e.invNumber === this.value);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    if (eq) { set('equipmentName', eq.name); set('location', eq.location); set('model', eq.model); set('machineNumber', eq.machineNumber); }
    else { set('equipmentName', ''); set('location', ''); set('model', ''); set('machineNumber', ''); }
}

function clearForm() {
    document.getElementById('repairForm')?.reset();
    ['equipmentName','location','model','machineNumber'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    capturedPhotos = [];
    document.getElementById('photoPreview').innerHTML = '';
    const d = document.getElementById('date'); if (d) d.value = new Date().toISOString().split('T')[0];
    const t = document.getElementById('time'); if (t) { const n = new Date(); t.value = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0'); }
    const s = document.getElementById('invNumber'); if (s) { s.selectedIndex = 0; handleInvNumberChange.call(s); }
    const si = document.getElementById('invNumberSearch'); if (si) { si.value = ''; for (let i = 0; i < s.options.length; i++) s.options[i].style.display = ''; }
}

async function submitRequest() {
    if (!currentUser || !currentUser.permissions.canAdd) { showNotification('Нет прав для добавления заявок', 'error'); return; }
    const g = id => document.getElementById(id)?.value || '';
    const now = new Date();
    const date = g('date') || now.toISOString().split('T')[0];
    const time = g('time') || now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
    const location = g('location');
    const invNumber = g('invNumber'), faultDesc = g('faultDescription');
    if (!location || !invNumber || !faultDesc) { showNotification('Заполните участок, инв. номер и описание', 'warning'); return; }

    const req = {
        id: Date.now().toString(), date, time,
        author: currentUser.name,
        location, invNumber, equipmentName: g('equipmentName'),
        model: g('model'), machineNumber: g('machineNumber') || '-',
        faultDescription: faultDesc,
        status: 'open',
        downtimeCount: 0, downtimeHours: 0,
        productionItem: g('productionItem') || '-',
        photos: capturedPhotos.map(p => p.startsWith('data:') ? p : ''),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };

    repairRequests.unshift(req);
    saveToLS();
    renderRequests();
    updateSummary();
    clearForm();
    showNotification('Заявка добавлена', 'success');
    switchTab('tabRequests');
}

// ========== PHOTO ==========
function capturePhoto() {
    const input = document.getElementById('photoInput');
    input.value = '';
    input.click();
}

function handlePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(ev) {
        capturedPhotos.push(ev.target.result);
        renderPhotoPreviews();
    };
    reader.readAsDataURL(file);
}

function renderPhotoPreviews() {
    const container = document.getElementById('photoPreview');
    container.innerHTML = capturedPhotos.map(p => `<img src="${p}" alt="photo">`).join('');
}

// ========== SCANNER ==========
function openScanner() {
    document.getElementById('scannerOverlay').classList.add('active');
    const container = document.getElementById('scannerContainer');
    container.innerHTML = '';
    try {
        html5Scanner = new Html5Qrcode("scannerContainer");
        html5Scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 120 } },
            onScanSuccess,
            () => {}
        ).catch(() => showNotification('Ошибка доступа к камере', 'error'));
    } catch(e) { showNotification('Сканер не поддерживается', 'error'); }
}

function closeScanner() {
    if (html5Scanner) {
        try { html5Scanner.stop().then(() => { html5Scanner.clear(); }); } catch(e) {}
        html5Scanner = null;
    }
    document.getElementById('scannerOverlay').classList.remove('active');
    document.getElementById('scannerContainer').innerHTML = '';
}

function onScanSuccess(code) {
    closeScanner();
    const select = document.getElementById('invNumber');
    const cleaned = code.replace(/[^0-9]/g, '');
    for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        const optClean = opt.value.replace(/[^0-9]/g, '');
        if (optClean && cleaned && (opt.value === code || optClean === cleaned || opt.value.includes(code) || code.includes(opt.value))) {
            select.selectedIndex = i;
            handleInvNumberChange.call(select);
            document.getElementById('invNumberSearch').value = opt.value;
            showNotification(`Найдено: ${opt.textContent}`, 'success');
            return;
        }
    }
    // try partial match
    for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        if (opt.value.replace(/[^0-9]/g, '').includes(cleaned) || cleaned.includes(opt.value.replace(/[^0-9]/g, ''))) {
            select.selectedIndex = i;
            handleInvNumberChange.call(select);
            document.getElementById('invNumberSearch').value = opt.value;
            showNotification(`Найдено: ${opt.textContent}`, 'success');
            return;
        }
    }
    document.getElementById('invNumberSearch').value = code;
    showNotification('Штрихкод распознан, но оборудование не найдено', 'warning');
}

// ========== SUPABASE SYNC ==========
async function supabaseFetch(path, options = {}) {
    if (!USE_SUPABASE) throw new Error('Supabase not configured');
    const url = SUPABASE_URL_RAW + '/rest/v1/' + SUPABASE_TABLE + path;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
        const res = await fetch(url, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal',
                ...options.headers
            },
            signal: controller.signal,
            ...options
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error('Supabase ' + res.status);
        return res;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function syncToSupabase() {
    if (!USE_SUPABASE) return false;
    try {
        const existing = await loadFromSupabase();
        const existingMap = {};
        (existing || []).forEach(r => { existingMap[r.id] = r; });
        const allIds = new Set([...Object.keys(existingMap), ...repairRequests.map(r => r.id)]);
        const ops = [];
        allIds.forEach(id => {
            const local = repairRequests.find(r => r.id === id);
            const remote = existingMap[id];
            if (!remote && local) {
                ops.push(supabaseFetch('', {
                    method: 'POST',
                    body: JSON.stringify(requestToRow(local))
                }).catch(() => {}));
            } else if (remote && !local) {
                ops.push(supabaseFetch('?id=eq.' + encodeURIComponent(id), {
                    method: 'DELETE'
                }).catch(() => {}));
            } else if (local && remote && JSON.stringify(remote) !== JSON.stringify(requestToRow(local))) {
                ops.push(supabaseFetch('?id=eq.' + encodeURIComponent(id), {
                    method: 'PATCH',
                    body: JSON.stringify(requestToRow(local))
                }).catch(() => {}));
            }
        });
        await Promise.all(ops);
        return true;
    } catch (e) {
        console.warn('Supabase sync error:', e);
        return false;
    }
}

async function loadFromSupabase() {
    if (!USE_SUPABASE) return null;
    try {
        const res = await supabaseFetch('?select=*&order=created_at.desc', { method: 'GET' });
        const rows = await res.json();
        return (rows || []).map(rowToRequest);
    } catch (e) {
        console.warn('Supabase load error:', e);
        return null;
    }
}

function requestToRow(r) {
    return {
        id: r.id,
        date: r.date || '',
        time: r.time || '',
        author: r.author || '',
        location: r.location || '',
        inv_number: r.invNumber || '',
        equipment_name: r.equipmentName || '',
        model: r.model || '',
        machine_number: r.machineNumber || '',
        fault_description: r.faultDescription || '',
        status: r.status || 'open',
        downtime_count: r.downtimeCount || 0,
        downtime_hours: r.downtimeHours || 0,
        production_item: r.productionItem || '',
        photos: JSON.stringify(r.photos || []),
        created_at: r.createdAt || new Date().toISOString(),
        updated_at: r.updatedAt || new Date().toISOString(),
        repair_end_date: r.repairEndDate || null,
        repair_end_time: r.repairEndTime || null
    };
}

function rowToRequest(r) {
    return {
        id: r.id,
        date: r.date || '',
        time: r.time || '',
        author: r.author || '',
        location: r.location || '',
        invNumber: r.inv_number || '',
        equipmentName: r.equipment_name || '',
        model: r.model || '',
        machineNumber: r.machine_number || '',
        faultDescription: r.fault_description || '',
        status: r.status || 'open',
        downtimeCount: r.downtime_count || 0,
        downtimeHours: r.downtime_hours || 0,
        productionItem: r.production_item || '',
        photos: typeof r.photos === 'string' ? (r.photos ? JSON.parse(r.photos) : []) : (r.photos || []),
        createdAt: r.created_at || '',
        updatedAt: r.updated_at || '',
        repairEndDate: r.repair_end_date || '',
        repairEndTime: r.repair_end_time || ''
    };
}

// ========== REQUESTS ==========
async function loadRequests() {
    try {
        const data = await apiFetch('/requests');
        repairRequests = data;
        serverAvailable = true;
    } catch {
        try { repairRequests = JSON.parse(localStorage.getItem('repair_requests')) || []; } catch { repairRequests = []; }
    }
    renderRequests();
    updateSummary();
    if (USE_SUPABASE) {
        loadFromSupabase().then(supabaseData => {
            if (!supabaseData) return;
            if (supabaseData.length > 0) {
                const localIds = new Set(repairRequests.map(r => r.id));
                const merged = [...repairRequests];
                supabaseData.forEach(r => {
                    if (!localIds.has(r.id)) merged.push(r);
                });
                if (merged.length > repairRequests.length) {
                    repairRequests = merged;
                    localStorage.setItem('repair_requests', JSON.stringify(repairRequests));
                    renderRequests();
                    updateSummary();
                }
            }
        }).catch(() => {});
    }
}

async function saveToLS() {
    localStorage.setItem('repair_requests', JSON.stringify(repairRequests));
    try {
        serverAvailable = true;
        await apiFetch('/requests', { method: 'PUT', body: JSON.stringify(repairRequests) });
    } catch { /* server not available */ }
    if (USE_SUPABASE) {
        syncToSupabase().catch(() => {});
    }
}

async function syncToServer() {
    try {
        await apiFetch('/requests', { method: 'PUT', body: JSON.stringify(repairRequests) });
        serverAvailable = true;
        return true;
    } catch { return false; }
}

function renderRequests(filtered = null) {
    const list = document.getElementById('requestsList');
    if (!list) return;
    const data = filtered || repairRequests;
    if (data.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>Нет заявок на ремонт</p></div>';
        return;
    }
    list.innerHTML = data.map(r => {
        const statusClass = r.status || 'open';
        const label = STATUS_LABELS[statusClass] || 'Открыта';
        const icon = STATUS_ICONS[statusClass] || '🟦';
        const desc = (r.faultDescription || '').length > 60 ? (r.faultDescription || '').substring(0, 60) + '...' : (r.faultDescription || '');
        const photos = (r.photos || []).filter(p => p).slice(0, 3);
        const photoHtml = photos.length ? `<div class="card-photos">${photos.map(p => `<img src="${p}" alt="">`).join('')}</div>` : '';
        const dateStr = r.date ? (r.date + (r.time ? ' ' + r.time : '')) : '';
        return `<div class="request-card" onclick="openDetail('${r.id}')">
            <div class="card-header">
                <div class="card-title">${r.invNumber || '—'} ${r.equipmentName || ''}</div>
                <span class="status-badge ${statusClass}">${icon} ${label}</span>
            </div>
            <div class="card-meta">
                <span>📅 ${dateStr}</span>
                <span>📍 ${r.location || '—'}</span>
                <span>👤 ${r.author || '—'}</span>
            </div>
            ${photoHtml}
            <div class="card-desc">${desc}</div>
            <div class="card-footer">
                <span style="font-size:12px;color:var(--text-secondary)">🔧 ${r.equipmentName || '—'}</span>
                <span style="font-size:12px;color:var(--text-secondary)">#${r.id.slice(-4)}</span>
            </div>
        </div>`;
    }).join('');
}

function updateSummary() {
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('totalRequests', repairRequests.length);
    setText('openRequests', repairRequests.filter(r => r.status === 'open' || !r.status).length);
    setText('repairRequests_count', repairRequests.filter(r => r.status === 'repair').length);
    setText('completedRequests', repairRequests.filter(r => r.status === 'completed').length);
}

// ========== DETAIL ==========
function openDetail(id) {
    const req = repairRequests.find(r => r.id === id);
    if (!req) { showNotification('Заявка не найдена', 'error'); return; }

    const statusClass = req.status || 'open';
    const label = STATUS_LABELS[statusClass] || 'Открыта';
    const icon = STATUS_ICONS[statusClass] || '🟦';
    const photos = (req.photos || []).filter(p => p);
    const photoHtml = photos.length ? `<div class="detail-photos">${photos.map(p => `<img src="${p}" alt="photo">`).join('')}</div>` : '';

    document.getElementById('detailTitle').textContent = `Заявка #${req.id.slice(-6)}`;
    document.getElementById('detailBody').innerHTML = `
        ${photoHtml}
        <div class="detail-row"><span class="label">Статус</span><span class="value"><span class="status-badge ${statusClass}">${icon} ${label}</span></span></div>
        <div class="detail-row"><span class="label">Дата/Время</span><span class="value">${req.date || ''} ${req.time || ''}</span></div>
        <div class="detail-row"><span class="label">Автор</span><span class="value">${req.author || ''}</span></div>
        <div class="detail-row"><span class="label">Участок</span><span class="value">${req.location || ''}</span></div>
        <div class="detail-row"><span class="label">Инв. номер</span><span class="value">${req.invNumber || ''}</span></div>
        <div class="detail-row"><span class="label">Оборудование</span><span class="value">${req.equipmentName || ''}</span></div>
        <div class="detail-row"><span class="label">Модель</span><span class="value">${req.model || '—'}</span></div>
        <div class="detail-row"><span class="label">Номер станка</span><span class="value">${req.machineNumber || '—'}</span></div>
        <div class="detail-row"><span class="label">Неисправность</span><span class="value">${req.faultDescription || ''}</span></div>
        <div class="detail-row"><span class="label">Номенклатура</span><span class="value">${req.productionItem || '—'}</span></div>
        ${req.status === 'completed' && req.repairEndDate ? `<div class="detail-row"><span class="label">Завершено</span><span class="value">${req.repairEndDate} ${req.repairEndTime || ''}</span></div>` : ''}
        ${req.downtimeHours ? `<div class="detail-row"><span class="label">Время простоя</span><span class="value">${req.downtimeHours} ч</span></div>` : ''}
    `;

    // Status action buttons
    let footerHtml = '';
    if (currentUser && currentUser.permissions.canComplete && req.status !== 'completed') {
        const statuses = [ {key:'repair',label:'🔧 В ремонт'}, {key:'completed',label:'✅ Завершить'} ];
        footerHtml = statuses.map(s =>
            `<button class="btn btn-sm ${s.key === 'completed' ? 'btn-success' : 'btn-outline'}" onclick="changeStatus('${req.id}','${s.key}')">${s.label}</button>`
        ).join(' ');
    }
    if (currentUser && currentUser.permissions.canDelete) {
        footerHtml += `<button class="btn btn-sm btn-danger" onclick="deleteRequest('${req.id}')">🗑️ Удалить</button>`;
    }
    document.getElementById('detailFooter').innerHTML = footerHtml || '<span style="color:var(--text-secondary);font-size:13px">Нет доступных действий</span>';
    document.getElementById('detailModal').style.display = 'block';
}

function closeDetail() { document.getElementById('detailModal').style.display = 'none'; }

function changeStatus(id, newStatus) {
    const req = repairRequests.find(r => r.id === id);
    if (!req) return;
    if (newStatus === 'completed') {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
        req.repairEndDate = today;
        req.repairEndTime = timeStr;
        req.downtimeCount = (req.downtimeCount || 0) + 1;
        req.downtimeHours = (req.downtimeHours || 0) + 1;
    }
    req.status = newStatus;
    req.updatedAt = new Date().toISOString();
    saveToLS();
    renderRequests();
    updateSummary();
    closeDetail();
    showNotification(`Статус изменён: ${STATUS_LABELS[newStatus]}`, 'success');
}

function deleteRequest(id) {
    if (!currentUser || !currentUser.permissions.canDelete) { showNotification('Нет прав для удаления', 'error'); return; }
    if (!confirm('Удалить заявку?')) return;
    repairRequests = repairRequests.filter(r => r.id !== id);
    saveToLS();
    renderRequests();
    updateSummary();
    closeDetail();
    showNotification('Заявка удалена', 'success');
}

function completeRequest(id) { changeStatus(id, 'completed'); }

// ========== FILTERS ==========
function applyFilters() {
    const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const status = document.getElementById('statusFilter')?.value || 'all';
    let filtered = [...repairRequests];
    if (search) {
        filtered = filtered.filter(r =>
            (r.equipmentName || '').toLowerCase().includes(search) ||
            (r.faultDescription || '').toLowerCase().includes(search) ||
            (r.invNumber || '').toLowerCase().includes(search) ||
            (r.location || '').toLowerCase().includes(search) ||
            (r.author || '').toLowerCase().includes(search)
        );
    }
    if (status !== 'all') filtered = filtered.filter(r => (r.status || 'open') === status);
    renderRequests(filtered);
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('statusFilter').value = 'all';
    renderRequests();
}

// ========== EQUIPMENT DB ==========
async function loadEquipmentDatabase() {
    try {
        const data = await apiFetch('/equipment');
        if (data && data.length > 0) {
            equipmentDatabase = data;
            populateInvNumberSelect();
            return;
        }
    } catch { /* пробуем CSV */ }
    try {
        const controller = new AbortController();
        setTimeout(() => controller.abort(), 5000);
        const response = await fetch('equipment_database.csv', { signal: controller.signal });
        const text = await response.text();
        parseEquipmentCSV(text);
        populateInvNumberSelect();
    } catch (error) {
        console.warn('CSV не загрузился, использую умолчания:', error);
        equipmentDatabase = [
            { location: "701", invNumber: "11323", name: "Автомат холод штамповки", model: "-", machineNumber: "СК-11323" },
            { location: "735", invNumber: "28542", name: "Токарный автомобиль", model: "КЕ36750", machineNumber: "ТС-28542" },
            { location: "717", invNumber: "7257", name: "Токарный автомат", model: "1269M-6", machineNumber: "А-7257" },
            { location: "702", invNumber: "11324", name: "Пресс гидравлический", model: "ПГ-100", machineNumber: "ПГ-11324" }
        ];
        populateInvNumberSelect();
    }
}

function parseEquipmentCSV(csvText) {
    equipmentDatabase = [];
    csvText.split('\n').forEach((line, idx) => {
        if (!line.trim()) return;
        if (idx === 0 && line.toLowerCase().includes('участок')) return;
        const inner = line.startsWith('"') && line.endsWith('"') ? line.slice(1, -1) : line;
        const parts = [];
        let cur = '', inField = false;
        for (let i = 0; i < inner.length; i++) {
            const c = inner[i];
            if (c === '"') {
                if (i + 1 < inner.length && inner[i + 1] === '"') { inField = !inField; i++; }
            } else if (c === ';' && !inField) { parts.push(cur.trim()); cur = ''; }
            else { cur += c; }
        }
        parts.push(cur.trim());
        if (parts.length >= 3) {
            equipmentDatabase.push({
                location: parts[0] || '',
                invNumber: parts[1] || '',
                name: parts[2] || '',
                model: parts.length > 3 && parts[3] ? parts[3] : '-',
                machineNumber: parts.length > 4 && parts[4] ? parts[4] : '-'
            });
        }
    });
}

function populateInvNumberSelect() {
    const select = document.getElementById('invNumber');
    if (!select) return;
    select.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    equipmentDatabase.sort((a, b) => (parseInt(a.invNumber)||0) - (parseInt(b.invNumber)||0));
    const seen = new Set();
    equipmentDatabase.forEach(eq => {
        if (seen.has(eq.invNumber) || !eq.invNumber) return;
        seen.add(eq.invNumber);
        const opt = document.createElement('option');
        opt.value = eq.invNumber;
        const sn = eq.name.length > 40 ? eq.name.substring(0,40)+'...' : eq.name;
        opt.textContent = `${eq.invNumber} - ${sn}`;
        select.appendChild(opt);
    });
}

async function updateEquipmentDB() { await loadEquipmentDatabase(); showNotification('База обновлена', 'success'); }

function openDashboard() { switchTab('tabStats'); }

// ========== REPORT ==========
function renderReport() {
    const container = document.getElementById('reportContent');
    if (!container) return;
    if (repairRequests.length === 0) {
        container.innerHTML = '<p style="color:var(--gray);text-align:center;padding:20px">Нет заявок для отчета</p>';
        return;
    }
    const total = repairRequests.length;
    const open = repairRequests.filter(r => r.status === 'open' || !r.status).length;
    const repair = repairRequests.filter(r => r.status === 'repair').length;
    const completed = repairRequests.filter(r => r.status === 'completed').length;
    const hours = repairRequests.reduce((s, r) => s + (r.downtimeHours || 0), 0);

    const grouped = {};
    repairRequests.forEach(r => {
        const key = r.invNumber || '—';
        if (!grouped[key]) grouped[key] = { ...r, downtimeCount: 0, downtimeHours: 0, count: 0 };
        grouped[key].downtimeCount += (r.downtimeCount || 0);
        grouped[key].downtimeHours += (r.downtimeHours || 0);
        grouped[key].count++;
        if (r.updatedAt > (grouped[key].updatedAt || '')) grouped[key].status = r.status;
    });

    const rows = Object.values(grouped).map(g =>
        `<tr><td>${g.location || '—'}</td><td>${g.invNumber}</td><td>${g.equipmentName || '—'}</td><td>${STATUS_LABELS[g.status] || g.status}</td><td>${g.count}</td><td>${g.downtimeCount}</td><td>${g.downtimeHours.toFixed(1)} ч</td></tr>`
    ).join('');

    container.innerHTML = `
        <div class="summary">
            <div class="summary-item"><h3>Всего</h3><div class="stat-value">${total}</div></div>
            <div class="summary-item"><h3>Открыто</h3><div class="stat-value">${open}</div></div>
            <div class="summary-item"><h3>В ремонте</h3><div class="stat-value">${repair}</div></div>
            <div class="summary-item"><h3>Выполнено</h3><div class="stat-value">${completed}</div></div>
        </div>
        <p style="font-size:13px;color:var(--text-secondary);margin:12px 0 8px">Дата формирования: ${new Date().toLocaleString('ru-RU')}</p>
        <h3 style="font-size:14px;margin:16px 0 8px;color:var(--primary)">Сводка по оборудованию</h3>
        <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
                <thead><tr style="background:var(--primary);color:white">
                    <th style="padding:6px;border:1px solid #ddd">Участок</th>
                    <th style="padding:6px;border:1px solid #ddd">Инв.№</th>
                    <th style="padding:6px;border:1px solid #ddd">Оборудование</th>
                    <th style="padding:6px;border:1px solid #ddd">Статус</th>
                    <th style="padding:6px;border:1px solid #ddd">Заявок</th>
                    <th style="padding:6px;border:1px solid #ddd">Простоев</th>
                    <th style="padding:6px;border:1px solid #ddd">Время</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function exportPDF() {
    const total = repairRequests.length;
    const open = repairRequests.filter(r => r.status === 'open' || !r.status).length;
    const repair = repairRequests.filter(r => r.status === 'repair').length;
    const completed = repairRequests.filter(r => r.status === 'completed').length;

    const grouped = {};
    repairRequests.forEach(r => {
        const key = r.invNumber || '—';
        if (!grouped[key]) grouped[key] = { ...r, downtimeCount: 0, downtimeHours: 0, count: 0 };
        grouped[key].downtimeCount += (r.downtimeCount || 0);
        grouped[key].downtimeHours += (r.downtimeHours || 0);
        grouped[key].count++;
        if (r.updatedAt > (grouped[key].updatedAt || '')) grouped[key].status = r.status;
    });

    const rows = Object.values(grouped).map(g =>
        `<tr><td>${g.location || '—'}</td><td>${g.invNumber}</td><td>${g.equipmentName || '—'}</td><td>${STATUS_LABELS[g.status] || g.status}</td><td>${g.count}</td><td>${g.downtimeCount}</td><td>${g.downtimeHours.toFixed(1)} ч</td></tr>`
    ).join('');

    const detailRows = [...repairRequests].reverse().map((r, i) => {
        const label = STATUS_LABELS[r.status] || r.status || 'Открыта';
        return `<tr><td>${i + 1}</td><td>${r.date || '—'}</td><td>${r.author || '—'}</td><td>${r.location || '—'}</td><td>${r.invNumber || '—'}</td><td>${r.equipmentName || '—'}</td><td>${label}</td><td>${r.downtimeHours || 0}</td></tr>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`
        <html><head><title>Отчет по ремонтам</title>
        <style>
            body{font-family:Arial;margin:20px;font-size:13px;color:#212121}
            h1{color:#1565C0;font-size:22px;margin-bottom:4px}
            p{color:#666;font-size:12px;margin:0 0 16px}
            h2{color:#1565C0;font-size:16px;margin:20px 0 8px;border-bottom:2px solid #1565C0;padding-bottom:4px}
            table{border-collapse:collapse;width:100%;margin-top:8px}
            th,td{border:1px solid #ccc;padding:5px 7px;text-align:left;font-size:11px}
            th{background:#1565C0;color:white;font-weight:600}
            tr:nth-child(even){background:#f5f5f5}
            .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}
            .stat-box{background:#f0f4f8;padding:10px;border-radius:6px;text-align:center}
            .stat-box .num{font-size:22px;font-weight:700;color:#1565C0}
            .stat-box .label{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.5px}
            @media print{body{margin:15mm}button{display:none}}
        </style>
        </head><body>
        <h1>Отчет по ремонтам</h1>
        <p>Дата формирования: ${new Date().toLocaleString('ru-RU')} · Всего заявок: ${total}</p>

        <div class="stats">
            <div class="stat-box"><div class="num">${total}</div><div class="label">Всего</div></div>
            <div class="stat-box"><div class="num">${open}</div><div class="label">Открыто</div></div>
            <div class="stat-box"><div class="num">${repair}</div><div class="label">В ремонте</div></div>
            <div class="stat-box"><div class="num">${completed}</div><div class="label">Выполнено</div></div>
        </div>

        <h2>Сводка по оборудованию</h2>
        <table><thead><tr><th>Участок</th><th>Инв.№</th><th>Оборудование</th><th>Статус</th><th>Заявок</th><th>Простоев</th><th>Время</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="7">Нет данных</td></tr>'}</tbody></table>

        <h2>Детальный список заявок</h2>
        <table><thead><tr><th>№</th><th>Дата</th><th>Автор</th><th>Участок</th><th>Инв.№</th><th>Оборудование</th><th>Статус</th><th>Простой (ч)</th></tr></thead>
        <tbody>${detailRows || '<tr><td colspan="8">Нет данных</td></tr>'}</tbody></table>

        <p style="text-align:center;color:#999;margin-top:30px;font-size:10px">— Конец отчета —</p>
        </body></html>
    `);
    win.document.close();
}

// ========== EXPORT / IMPORT ==========
function exportRepairData() {
    if (repairRequests.length === 0) { showNotification('Нет данных для экспорта', 'warning'); return; }
    let csv = 'ID;Дата;Время;Автор;Участок;Инв.номер;Оборудование;Модель;Номер станка;Неисправность;Статус;Время простоя;Номенклатура\n';
    repairRequests.forEach(r => {
        csv += `"${r.id}";"${r.date}";"${r.time}";"${r.author}";"${r.location}";"${r.invNumber}";"${r.equipmentName}";"${r.model}";"${r.machineNumber}";"${r.faultDescription}";"${STATUS_LABELS[r.status] || r.status}";"${r.downtimeHours || 0}";"${r.productionItem}"\n`;
    });
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `заявки_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    showNotification('Данные экспортированы', 'success');
}

function importRepairData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const lines = e.target.result.split('\n');
            const imported = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                const p = line.split(';').map(s => s.replace(/^"|"$/g, ''));
                if (p.length >= 5) {
                    imported.push({
                        id: Date.now() + i, date: p[1]||'', time: p[2]||'',
                        author: p[3]||'', location: p[4]||'', invNumber: p[5]||'',
                        equipmentName: p[6]||'', model: p[7]||'', machineNumber: p[8]||'',
                        faultDescription: p[9]||'', status: 'open',
                        downtimeHours: parseFloat(p[11]) || 0, productionItem: p[12]||'-',
                        photos: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
                    });
                }
            }
            repairRequests = [...imported, ...repairRequests];
            saveToLS();
            renderRequests();
            updateSummary();
            showNotification(`Импортировано ${imported.length} заявок`, 'success');
        } catch(err) { showNotification('Ошибка импорта', 'error'); }
    };
    reader.readAsText(file);
}

function formatDT(date, time) {
    return (date || '') + (time ? ' ' + time : '');
}

function formatISO(iso) {
    if (!iso) return '—';
    try { const d = new Date(iso); return d.toLocaleString('ru-RU'); }
    catch { return iso; }
}



// ========== SYNC ==========
async function syncAllData() {
    showNotification('Синхронизация...', 'info');
    let ok = false;
    try { ok = await syncToServer(); } catch {}
    if (USE_SUPABASE) {
        const sb = await syncToSupabase();
        if (sb) ok = true;
    }
    if (ok) showNotification('Данные синхронизированы', 'success');
    else showNotification('Сервер недоступен, данные сохранены локально', 'warning');
}

// ========== MISC ==========
function showNotification(msg, type = 'info') {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = msg;
    el.className = `notification ${type}`;
    el.style.display = 'block';
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => { el.style.display = 'none'; }, 3000);
    console.log(`[${type.toUpperCase()}] ${msg}`);
}

window.onclick = function(e) {
    const m = document.getElementById('detailModal');
    if (e.target === m) closeDetail();
};

// ========== INIT ==========
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initApp);
else initApp();

// ========== GLOBALS ==========
window.syncWithFirebase = syncWithFirebase;
async function syncWithFirebase() {}
window.syncAllData = syncAllData;
window.updateEquipmentDB = updateEquipmentDB;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.openDashboard = openDashboard;
window.exportPDF = exportPDF;
window.exportRepairData = exportRepairData;
window.completeRequest = completeRequest;
window.deleteRequest = deleteRequest;
window.openDetail = openDetail;
window.closeDetail = closeDetail;
window.changeStatus = changeStatus;
window.openScanner = openScanner;
window.closeScanner = closeScanner;
window.capturePhoto = capturePhoto;
window.handlePhoto = handlePhoto;
