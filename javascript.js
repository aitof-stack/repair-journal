// javascript.js - Основная логика приложения (без инициализации) v5.0.7

console.log('Ремонтный журнал - основная логика v5.0.7');

// ===== БАЗА ОБОРУДОВАНИЯ =====
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    try {
        // Пробуем загрузить из Firestore
        if (window.isFirebaseReady && window.db) {
            try {
                const snapshot = await window.db.collection('equipment').limit(100).get();
                if (!snapshot.empty) {
                    window.equipmentList = [];
                    snapshot.forEach(doc => {
                        window.equipmentList.push({ id: doc.id, ...doc.data() });
                    });
                    console.log('Загружено оборудования из Firestore:', window.equipmentList.length);
                    populateEquipmentSelect();
                    return;
                }
            } catch (firestoreError) {
                console.warn('Не удалось загрузить из Firestore:', firestoreError);
            }
        }
        
        // Загружаем из CSV
        const equipmentData = await loadEquipmentFromCSV();
        window.equipmentList = equipmentData;
        console.log('Загружено оборудования из CSV:', window.equipmentList.length);
        
        // Синхронизируем с Firestore
        if (window.isFirebaseReady && window.db && window.equipmentList.length > 0) {
            await syncEquipmentToFirebase();
        }
        
        populateEquipmentSelect();
        
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        window.equipmentList = [];
        showNotification('Ошибка загрузки базы оборудования', 'error');
    }
}

async function loadEquipmentFromCSV() {
    try {
        const response = await fetch('equipment_database.csv?t=' + Date.now());
        if (!response.ok) throw new Error('Не удалось загрузить файл оборудования');
        
        const csvText = await response.text();
        const lines = csvText.split('\n');
        const equipmentData = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                const cleanLine = line.replace(/^"|"$/g, '');
                const parts = cleanLine.split(';');
                
                if (parts.length >= 4) {
                    equipmentData.push({
                        id: 'eq_' + i,
                        location: parts[0]?.trim() || '',
                        invNumber: parts[1]?.trim() || '',
                        name: parts[2]?.trim() || '',
                        model: parts[3]?.trim() || '',
                        machineNumber: parts[4]?.trim() || ''
                    });
                }
            } catch (e) {
                console.warn('Ошибка парсинга строки', i);
            }
        }
        
        return equipmentData;
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        return [];
    }
}

function populateEquipmentSelect() {
    const invNumberSelect = document.getElementById('invNumber');
    if (!invNumberSelect) return;
    
    const selectedValue = invNumberSelect.value;
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    window.equipmentList.forEach(equip => {
        const option = document.createElement('option');
        option.value = equip.invNumber;
        option.textContent = `${equip.invNumber} - ${equip.name} (${equip.location})`;
        option.dataset.equipment = JSON.stringify(equip);
        invNumberSelect.appendChild(option);
    });
    
    if (selectedValue) invNumberSelect.value = selectedValue;
    setupEquipmentSearch();
}

function setupEquipmentSearch() {
    const searchInput = document.getElementById('invNumberSearch');
    const select = document.getElementById('invNumber');
    
    if (!searchInput || !select) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        if (searchTerm.length > 0) {
            select.style.display = 'block';
            Array.from(select.options).forEach(option => {
                if (option.value === '') return;
                option.style.display = option.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
            });
        } else {
            select.style.display = 'block';
            Array.from(select.options).forEach(option => option.style.display = '');
        }
    });
    
    select.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.value && selectedOption.dataset.equipment) {
            try {
                const equipment = JSON.parse(selectedOption.dataset.equipment);
                document.getElementById('equipmentName').value = equipment.name || '';
                document.getElementById('location').value = equipment.location || '';
                document.getElementById('model').value = equipment.model || '';
                document.getElementById('machineNumber').value = equipment.machineNumber || '';
                document.getElementById('faultDescription').focus();
            } catch (e) {
                console.error('Ошибка парсинга данных оборудования:', e);
            }
        }
    });
}

// ===== ЗАГРУЗКА И ОТОБРАЖЕНИЕ ЗАЯВОК =====
async function loadRepairsData() {
    console.log('Загрузка данных заявок...');
    
    try {
        if (window.isFirebaseReady && window.db) {
            await loadFromFirestore();
        } else {
            loadLocalRepairs();
        }
        
        renderRepairsTable();
        updateStatistics();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        loadLocalRepairs();
        renderRepairsTable();
    }
}

async function loadFromFirestore() {
    try {
        const snapshot = await window.db.collection('repairs').orderBy('created_at', 'desc').get();
        window.repairsList = [];
        snapshot.forEach(doc => {
            window.repairsList.push({ id: doc.id, ...doc.data(), firestoreId: doc.id });
        });
        console.log('Загружено заявок из Firestore:', window.repairsList.length);
        setupRealtimeUpdates();
    } catch (error) {
        console.error('Ошибка загрузки из Firestore:', error);
        throw error;
    }
}

function loadLocalRepairs() {
    const localData = localStorage.getItem('repair_journal_repairs');
    window.repairsList = localData ? JSON.parse(localData) : [];
    console.log('Загружено локальных заявок:', window.repairsList.length);
}

function setupRealtimeUpdates() {
    if (!window.isFirebaseReady || !window.db || window.unsubscribeRepairs) return;
    
    window.unsubscribeRepairs = window.db.collection('repairs')
        .orderBy('created_at', 'desc')
        .onSnapshot(snapshot => {
            window.repairsList = [];
            snapshot.forEach(doc => {
                window.repairsList.push({ id: doc.id, ...doc.data(), firestoreId: doc.id });
            });
            console.log('Обновление из Firestore:', window.repairsList.length, 'заявок');
            renderRepairsTable();
            updateStatistics();
            saveLocalRepairs();
        }, error => {
            console.error('Ошибка подписки Firestore:', error);
            showNotification('Ошибка синхронизации', 'error');
        });
}

function saveLocalRepairs() {
    try {
        localStorage.setItem('repair_journal_repairs', JSON.stringify(window.repairsList));
    } catch (error) {
        console.error('Ошибка сохранения локальных данных:', error);
    }
}

// ===== ОТОБРАЖЕНИЕ ТАБЛИЦЫ (ВЫДЕЛЕНИЕ ЗАЯВОК В РЕМОНТЕ) =====
function renderRepairsTable() {
    console.log('Рендеринг таблицы с', window.repairsList?.length || 0, 'заявками');
    
    const tbody = document.getElementById('repairTableBody');
    if (!tbody) {
        console.error('Не найден элемент repairTableBody');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!window.repairsList || window.repairsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" class="text-center text-muted py-4">
                    <div style="font-size: 48px; margin-bottom: 10px;">📭</div>
                    Нет заявок на ремонт
                    <br>
                    <small class="text-muted">Создайте первую заявку</small>
                </td>
            </tr>
        `;
        return;
    }
    
    // ВАЖНО: Сортируем заявки - сначала "в ремонте", потом остальные
    const sortedRepairs = [...window.repairsList].sort((a, b) => {
        // Проверяем статусы
        const aInRepair = isInRepairStatus(a.status);
        const bInRepair = isInRepairStatus(b.status);
        
        // Сначала показываем заявки "в ремонте"
        if (aInRepair && !bInRepair) return -1;
        if (!aInRepair && bInRepair) return 1;
        
        // Затем сортируем по дате (новые сверху)
        const dateA = a.start_datetime ? new Date(a.start_datetime) : new Date(0);
        const dateB = b.start_datetime ? new Date(b.start_datetime) : new Date(0);
        return dateB - dateA;
    });
    
    // Рендерим отсортированный список
    sortedRepairs.forEach((repair, index) => {
        const row = createRepairRow(repair);
        tbody.appendChild(row);
    });
    
    applyFilters();
}

function isInRepairStatus(status) {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower.includes('ремонт') || 
           statusLower.includes('в работе') || 
           statusLower.includes('выполняется') ||
           statusLower.includes('в процессе') ||
           statusLower === 'в ремонте';
}

function createRepairRow(repair) {
    const row = document.createElement('tr');
    
    // Проверяем статус и добавляем класс для заявок в ремонте
    const isInRepair = isInRepairStatus(repair.status);
    if (isInRepair) {
        row.className = 'repair-in-progress';
        row.style.backgroundColor = '#fff3cd';
        row.style.borderLeft = '4px solid #ffc107';
    }
    
    // Форматируем даты
    const startDate = repair.start_datetime ? new Date(repair.start_datetime) : null;
    const endDate = repair.end_datetime ? new Date(repair.end_datetime) : null;
    
    const formattedStartDate = startDate ? formatDateTime(startDate) : '-';
    const formattedEndDate = endDate ? formatDateTime(endDate) : '-';
    
    // Рассчитываем время простоя
    let downtimeHours = '0';
    if (startDate && endDate) {
        const diffMs = endDate - startDate;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        downtimeHours = diffHours.toString();
    }
    
    // Определяем класс статуса
    const statusClass = getStatusClass(repair.status);
    
    row.innerHTML = `
        <td class="col-datetime">${formattedStartDate}</td>
        <td>${repair.author || '-'}</td>
        <td class="col-location">${repair.location || '-'}</td>
        <td class="col-inv">${repair.inv_number || '-'}</td>
        <td>${repair.equipment_name || '-'}</td>
        <td>${repair.model || '-'}</td>
        <td class="col-machine">${repair.machine_number || '-'}</td>
        <td>${repair.fault_description || '-'}</td>
        <td class="col-datetime">${formattedEndDate}</td>
        <td class="col-status">
            <span class="status-badge ${statusClass}">
                ${repair.status || 'Не указан'}
            </span>
        </td>
        <td class="col-count">${repair.downtime_count || '0'}</td>
        <td class="col-hours">${downtimeHours} ч</td>
        <td>${repair.production_item || '-'}</td>
        <td class="col-actions actions-cell">
            ${window.currentUser?.type === 'admin' || window.currentUser?.type === 'repair' ? 
                `<button class="btn-complete" onclick="completeRepair('${repair.id}')" ${repair.status === 'Завершено' ? 'disabled' : ''}>
                    ${repair.status === 'Завершено' ? '✓ Завершено' : 'Завершить'}
                </button>` : 
                ''
            }
            ${window.currentUser?.type === 'admin' ? 
                `<button class="btn-delete" onclick="deleteRepair('${repair.id}')">Удалить</button>` : 
                ''
            }
        </td>
    `;
    
    return row;
}

function formatDateTime(date) {
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusClass(status) {
    if (!status) return 'status-unknown';
    
    const statusLower = status.toLowerCase();
    if (isInRepairStatus(status)) return 'status-pending';
    if (statusLower.includes('заверш') || statusLower.includes('готов')) return 'status-completed';
    if (statusLower.includes('нов')) return 'status-new';
    
    return 'status-unknown';
}

// ===== ФОРМА И ФИЛЬТРЫ =====
function setupRepairForm() {
    const form = document.getElementById('repairForm');
    const clearBtn = document.getElementById('clearBtn');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    // Устанавливаем текущую дату и время
    const now = new Date();
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const authorInput = document.getElementById('author');
    
    if (dateInput) dateInput.value = now.toISOString().split('T')[0];
    if (timeInput) timeInput.value = now.toTimeString().slice(0, 5);
    if (authorInput && window.currentUser) {
        authorInput.value = window.currentUser.name;
    }
}

// ===== ОБНОВЛЕНИЕ СТАТИСТИКИ =====
function updateStatistics() {
    const totalElement = document.getElementById('totalRequests');
    const pendingElement = document.getElementById('pendingRequests');
    const completedElement = document.getElementById('completedRequests');
    const downtimeElement = document.getElementById('totalDowntime');
    
    if (!totalElement || !pendingElement || !completedElement || !downtimeElement) return;
    
    // Считаем заявки в ремонте
    const pending = window.repairsList.filter(r => isInRepairStatus(r.status)).length;
    const completed = window.repairsList.filter(r => r.status === 'Завершено').length;
    const total = window.repairsList.length;
    
    // Рассчитываем общее время простоя
    let totalDowntime = 0;
    window.repairsList.forEach(repair => {
        if (repair.start_datetime && repair.end_datetime) {
            const start = new Date(repair.start_datetime);
            const end = new Date(repair.end_datetime);
            const diffHours = Math.floor((end - start) / (1000 * 60 * 60));
            totalDowntime += diffHours;
        }
    });
    
    totalElement.textContent = total;
    pendingElement.textContent = pending;
    completedElement.textContent = completed;
    downtimeElement.textContent = Math.round(totalDowntime) + ' ч';
}

// ===== ОСТАЛЬНЫЕ ФУНКЦИИ (упрощенные) =====
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Экспортируем функции для глобального доступа
window.syncAllData = async function() {
    if (!window.isFirebaseReady || !window.db) {
        showNotification('Firebase не доступен', 'error');
        return;
    }
    
    showNotification('Синхронизация...', 'info');
    
    try {
        // Перезагружаем данные
        await loadRepairsData();
        showNotification('Синхронизация завершена', 'success');
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации', 'error');
    }
};

window.updateEquipmentDB = async function() {
    showNotification('Обновление базы оборудования...', 'info');
    await loadEquipmentDatabase();
    showNotification('База оборудования обновлена', 'success');
};

window.exportRepairData = function() {
    if (!window.currentUser || window.currentUser.type !== 'admin') {
        showNotification('Только администратор может экспортировать данные', 'error');
        return;
    }
    
    if (window.repairsList.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    try {
        // Создаем CSV
        const headers = ['Дата начала', 'Автор', 'Участок', 'Инв. номер', 'Оборудование', 'Статус'];
        const rows = window.repairsList.map(repair => [
            repair.start_datetime ? new Date(repair.start_datetime).toLocaleString('ru-RU') : '',
            repair.author || '',
            repair.location || '',
            repair.inv_number || '',
            repair.equipment_name || '',
            repair.status || ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Скачиваем файл
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `заявки_ремонт_${new Date().toISOString().slice(0,10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('Экспорт завершен', 'success');
        
    } catch (error) {
        console.error('Ошибка экспорта:', error);
        showNotification('Ошибка экспорта', 'error');
    }
};

window.showDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    const content = document.getElementById('dashboardContent');
    
    if (!modal || !content) return;
    
    const pending = window.repairsList.filter(r => isInRepairStatus(r.status)).length;
    const completed = window.repairsList.filter(r => r.status === 'Завершено').length;
    const total = window.repairsList.length;
    
    content.innerHTML = `
        <div class="dashboard-stats">
            <div class="stat-card">
                <h3>Всего заявок</h3>
                <div class="stat-value">${total}</div>
            </div>
            <div class="stat-card">
                <h3>В ремонте</h3>
                <div class="stat-value">${pending}</div>
            </div>
            <div class="stat-card">
                <h3>Завершено</h3>
                <div class="stat-value">${completed}</div>
            </div>
        </div>
        <div style="margin-top: 30px;">
            <h3>Статистика</h3>
            <p>Заявок в ремонте выделены желтым цветом и находятся в начале таблицы.</p>
            <p>Всего оборудования в базе: ${window.equipmentList.length}</p>
            <p>Статус Firebase: ${window.isFirebaseReady ? 'ONLINE' : 'OFFLINE'}</p>
        </div>
    `;
    
    modal.style.display = 'block';
};

window.closeDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    if (modal) modal.style.display = 'none';
};

window.logout = function() {
    localStorage.removeItem('repair_journal_currentUser');
    localStorage.removeItem('repair_journal_isAuthenticated');
    window.location.href = 'login.html';
};

// Для отладки
console.log('Основная логика приложения загружена');
