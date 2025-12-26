// javascript.js - Основная логика приложения v6.0
console.log('Ремонтный журнал v6.0 загружен');

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let repairsList = [];
let equipmentList = [];
let unsubscribeRepairs = null;
let deviceId = null;

// ===== ИНИЦИАЛИЗАЦИЯ =====
async function initApplication() {
    console.log('Инициализация приложения v6.0');
    
    try {
        // Устанавливаем текущую дату и время в форму
        setDefaultFormDateTime();
        
        // Загружаем базу оборудования
        await loadEquipmentDatabase();
        
        // Загружаем заявки
        await loadRepairs();
        
        // Настраиваем UI
        setupUI();
        
        // Обновляем статистику
        updateStatistics();
        
        console.log('Приложение инициализировано успешно');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка запуска приложения', 'error');
    }
}

function setDefaultFormDateTime() {
    const now = new Date();
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    const authorInput = document.getElementById('author');
    
    if (dateInput) {
        dateInput.value = now.toISOString().split('T')[0];
    }
    
    if (timeInput) {
        timeInput.value = now.toTimeString().slice(0, 5);
    }
    
    // Устанавливаем текущего пользователя как автора
    if (authorInput && window.currentUser) {
        authorInput.value = window.currentUser.name;
    }
}

// ===== БАЗА ОБОРУДОВАНИЯ =====
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    try {
        // Пробуем загрузить из Firestore
        if (window.isFirebaseReady && window.db) {
            try {
                const snapshot = await window.db.collection('equipment').limit(100).get();
                if (!snapshot.empty) {
                    equipmentList = [];
                    snapshot.forEach(doc => {
                        equipmentList.push({ id: doc.id, ...doc.data() });
                    });
                    console.log('Загружено из Firestore:', equipmentList.length);
                    populateEquipmentSelect();
                    return;
                }
            } catch (firestoreError) {
                console.warn('Не удалось загрузить из Firestore:', firestoreError);
            }
        }
        
        // Загружаем из CSV
        const equipmentData = await loadEquipmentFromCSV();
        equipmentList = equipmentData;
        console.log('Загружено из CSV:', equipmentList.length);
        
        populateEquipmentSelect();
        
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        equipmentList = [];
        showNotification('Ошибка загрузки базы оборудования', 'error');
    }
}

async function loadEquipmentFromCSV() {
    try {
        const response = await fetch('equipment_database.csv?t=' + Date.now());
        if (!response.ok) throw new Error('Не удалось загрузить CSV');
        
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
    
    // Сохраняем текущее значение
    const currentValue = invNumberSelect.value;
    
    // Очищаем и заполняем заново
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    equipmentList.forEach(equip => {
        const option = document.createElement('option');
        option.value = equip.invNumber;
        option.textContent = `${equip.invNumber} - ${equip.name} (${equip.location})`;
        option.dataset.equipment = JSON.stringify(equip);
        invNumberSelect.appendChild(option);
    });
    
    // Восстанавливаем значение
    if (currentValue) {
        invNumberSelect.value = currentValue;
    }
    
    setupEquipmentSearch();
}

function setupEquipmentSearch() {
    const searchInput = document.getElementById('invNumberSearch');
    const select = document.getElementById('invNumber');
    
    if (!searchInput || !select) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        
        Array.from(select.options).forEach(option => {
            if (option.value === '') return; // Не скрываем первый пустой option
            
            const text = option.textContent.toLowerCase();
            if (searchTerm === '' || text.includes(searchTerm)) {
                option.style.display = '';
            } else {
                option.style.display = 'none';
            }
        });
    });
    
    // При выборе оборудования заполняем поля
    select.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.value && selectedOption.dataset.equipment) {
            try {
                const equipment = JSON.parse(selectedOption.dataset.equipment);
                
                document.getElementById('equipmentName').value = equipment.name || '';
                document.getElementById('location').value = equipment.location || '';
                document.getElementById('model').value = equipment.model || '';
                document.getElementById('machineNumber').value = equipment.machineNumber || '';
                
                // Фокусируемся на поле описания
                document.getElementById('faultDescription').focus();
                
            } catch (e) {
                console.error('Ошибка парсинга данных оборудования:', e);
            }
        }
    });
}

// ===== ЗАГРУЗКА И ОТОБРАЖЕНИЕ ЗАЯВОК =====
async function loadRepairs() {
    console.log('Загрузка заявок...');
    
    try {
        if (window.isFirebaseReady && window.db) {
            await loadFromFirestore();
        } else {
            loadFromLocalStorage();
        }
        
        renderRepairsTable();
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        loadFromLocalStorage();
        renderRepairsTable();
    }
}

async function loadFromFirestore() {
    try {
        const snapshot = await window.db.collection('repairs')
            .orderBy('created_at', 'desc')
            .get();
        
        repairsList = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            repairsList.push({
                id: doc.id,
                ...data,
                firestoreId: doc.id,
                // Преобразуем timestamp в Date если нужно
                created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
                updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
                start_datetime: data.start_datetime?.toDate ? data.start_datetime.toDate().toISOString() : data.start_datetime,
                end_datetime: data.end_datetime?.toDate ? data.end_datetime.toDate().toISOString() : data.end_datetime
            });
        });
        
        console.log('Загружено из Firestore:', repairsList.length);
        
        // Настраиваем подписку на обновления
        setupFirestoreListener();
        
    } catch (error) {
        console.error('Ошибка загрузки из Firestore:', error);
        throw error;
    }
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('repair_journal_repairs');
    repairsList = saved ? JSON.parse(saved) : [];
    console.log('Загружено из localStorage:', repairsList.length);
}

function setupFirestoreListener() {
    if (!window.isFirebaseReady || !window.db || unsubscribeRepairs) return;
    
    unsubscribeRepairs = window.db.collection('repairs')
        .orderBy('created_at', 'desc')
        .onSnapshot(snapshot => {
            repairsList = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                repairsList.push({
                    id: doc.id,
                    ...data,
                    firestoreId: doc.id,
                    created_at: data.created_at?.toDate ? data.created_at.toDate().toISOString() : data.created_at,
                    updated_at: data.updated_at?.toDate ? data.updated_at.toDate().toISOString() : data.updated_at,
                    start_datetime: data.start_datetime?.toDate ? data.start_datetime.toDate().toISOString() : data.start_datetime,
                    end_datetime: data.end_datetime?.toDate ? data.end_datetime.toDate().toISOString() : data.end_datetime
                });
            });
            
            console.log('Обновление из Firestore:', repairsList.length, 'заявок');
            renderRepairsTable();
            updateStatistics();
            saveToLocalStorage();
            
        }, error => {
            console.error('Ошибка подписки Firestore:', error);
            showNotification('Ошибка синхронизации', 'error');
        });
}

function saveToLocalStorage() {
    try {
        localStorage.setItem('repair_journal_repairs', JSON.stringify(repairsList));
    } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error);
    }
}

// ===== ОТОБРАЖЕНИЕ ТАБЛИЦЫ =====
function renderRepairsTable() {
    console.log('Рендеринг таблицы с', repairsList.length, 'заявками');
    
    const tbody = document.getElementById('repairTableBody');
    if (!tbody) {
        console.error('Не найден repairTableBody');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (repairsList.length === 0) {
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
        updateStatistics();
        return;
    }
    
    // ВАЖНО: СОРТИРУЕМ - сначала заявки "в ремонте", потом остальные
    const sortedRepairs = [...repairsList].sort((a, b) => {
        // Проверяем статусы
        const aInRepair = isInRepairStatus(a.status);
        const bInRepair = isInRepairStatus(b.status);
        
        // Если одна заявка в ремонте, а другая нет - в ремонте должна быть выше
        if (aInRepair && !bInRepair) return -1;
        if (!aInRepair && bInRepair) return 1;
        
        // Если обе в ремонте или обе не в ремонте - сортируем по дате
        const dateA = a.start_datetime ? new Date(a.start_datetime) : new Date(0);
        const dateB = b.start_datetime ? new Date(b.start_datetime) : new Date(0);
        return dateB - dateA; // Новые сверху
    });
    
    // Рендерим отсортированный список
    sortedRepairs.forEach((repair, index) => {
        const row = createRepairRow(repair, index);
        tbody.appendChild(row);
    });
    
    updateStatistics();
}

function isInRepairStatus(status) {
    if (!status) return false;
    
    const statusLower = status.toLowerCase();
    return statusLower.includes('ремонт') || 
           statusLower.includes('в работе') || 
           statusLower.includes('выполняется') ||
           statusLower.includes('в процессе');
}

function createRepairRow(repair, index) {
    const row = document.createElement('tr');
    
    // ВАЖНО: Определяем, находится ли заявка в ремонте
    const isInRepair = isInRepairStatus(repair.status);
    
    // ВАЖНО: Если заявка в ремонте - добавляем специальный класс
    if (isInRepair) {
        row.className = 'repair-in-progress';
        row.style.backgroundColor = '#fff3cd';
        row.style.borderLeft = '4px solid #ffc107';
        row.style.fontWeight = '600';
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
    
    // Определяем класс для статуса
    const statusClass = getStatusClass(repair.status);
    
    // Создаем HTML строки
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
    
    // Добавляем анимацию появления
    row.style.animationDelay = `${index * 0.05}s`;
    row.classList.add('fade-in');
    
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
    if (isInRepairStatus(statusLower)) return 'status-pending';
    if (statusLower.includes('заверш') || statusLower.includes('готов')) return 'status-completed';
    if (statusLower.includes('нов')) return 'status-new';
    
    return 'status-unknown';
}

// ===== СТАТИСТИКА =====
function updateStatistics() {
    const totalElement = document.getElementById('totalRequests');
    const pendingElement = document.getElementById('pendingRequests');
    const completedElement = document.getElementById('completedRequests');
    const downtimeElement = document.getElementById('totalDowntime');
    
    if (!totalElement || !pendingElement || !completedElement || !downtimeElement) return;
    
    // Считаем заявки в ремонте
    const pending = repairsList.filter(repair => isInRepairStatus(repair.status)).length;
    const completed = repairsList.filter(repair => repair.status === 'Завершено').length;
    const total = repairsList.length;
    
    // Рассчитываем общее время простоя
    let totalDowntime = 0;
    repairsList.forEach(repair => {
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

// ===== ФОРМА ДОБАВЛЕНИЯ ЗАЯВКИ =====
function setupUI() {
    console.log('Настройка UI...');
    
    // Настраиваем форму
    const form = document.getElementById('repairForm');
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    // Кнопка очистки формы
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    // Настраиваем фильтры
    setupFilters();
    
    // Настраиваем информацию о пользователе
    updateUserInfo();
    
    console.log('UI настроен');
}

function updateUserInfo() {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    
    if (!window.currentUser || !userNameElement || !userRoleElement) return;
    
    userNameElement.textContent = window.currentUser.name;
    
    let roleText = '';
    switch(window.currentUser.type) {
        case 'admin': roleText = 'Администратор'; break;
        case 'author': roleText = 'Автор заявок'; break;
        case 'repair': roleText = 'Ремонтная служба'; break;
        default: roleText = window.currentUser.type;
    }
    
    userRoleElement.textContent = roleText;
    
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement) {
        userInfoElement.style.display = 'flex';
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!window.currentUser) {
        showNotification('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Проверяем права доступа
    if (window.currentUser.type !== 'admin' && window.currentUser.type !== 'author') {
        showNotification('У вас нет прав для создания заявок', 'error');
        return;
    }
    
    // Собираем данные формы
    const formData = {
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        author: document.getElementById('author').value.trim(),
        inv_number: document.getElementById('invNumber').value,
        equipment_name: document.getElementById('equipmentName').value,
        location: document.getElementById('location').value,
        model: document.getElementById('model').value,
        machine_number: document.getElementById('machineNumber').value.trim(),
        fault_description: document.getElementById('faultDescription').value.trim(),
        production_item: document.getElementById('productionItem').value.trim(),
        status: 'В ремонте',
        start_datetime: new Date(document.getElementById('date').value + 'T' + document.getElementById('time').value).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: window.currentUser.name,
        user_id: window.currentUser.id || 'anonymous',
        synced: false
    };
    
    // Проверка обязательных полей
    if (!formData.author || !formData.inv_number || !formData.fault_description) {
        showNotification('Заполните обязательные поля: автор, инвентарный номер и описание неисправности', 'error');
        return;
    }
    
    try {
        let repairId;
        
        if (window.isFirebaseReady && window.db) {
            // Сохраняем в Firestore
            const docRef = await window.db.collection('repairs').add({
                ...formData,
                created_at: firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            repairId = docRef.id;
            formData.id = repairId;
            formData.firestoreId = repairId;
            formData.synced = true;
            
            console.log('Заявка создана в Firestore:', repairId);
            
        } else {
            // Локальное сохранение
            repairId = 'local_' + Date.now();
            formData.id = repairId;
            formData.synced = false;
        }
        
        // Добавляем в начало списка
        repairsList.unshift(formData);
        
        // Сохраняем локально
        saveToLocalStorage();
        
        // Обновляем таблицу
        renderRepairsTable();
        
        // Очищаем форму
        clearForm();
        
        showNotification('Заявка успешно добавлена', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения заявки:', error);
        showNotification('Ошибка сохранения заявки', 'error');
    }
}

function clearForm() {
    const form = document.getElementById('repairForm');
    if (form) {
        form.reset();
        
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
        
        // Очищаем поля оборудования
        document.getElementById('equipmentName').value = '';
        document.getElementById('location').value = '';
        document.getElementById('model').value = '';
        document.getElementById('machineNumber').value = '';
        
        showNotification('Форма очищена', 'info');
    }
}

// ===== ФИЛЬТРЫ =====
function setupFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const locationFilter = document.getElementById('locationFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    
    if (locationFilter) {
        // Заполняем уникальные участки
        const locations = new Set();
        repairsList.forEach(repair => {
            if (repair.location) locations.add(repair.location);
        });
        
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
        
        locationFilter.addEventListener('change', applyFilters);
    }
    
    if (monthFilter) {
        monthFilter.addEventListener('change', applyFilters);
    }
}

function applyFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const locationFilter = document.getElementById('locationFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    const statusValue = statusFilter?.value || 'all';
    const locationValue = locationFilter?.value || 'all';
    const monthValue = monthFilter?.value || '';
    
    const rows = document.querySelectorAll('#repairTableBody tr');
    let visibleCount = 0;
    
    rows.forEach(row => {
        if (row.cells.length < 14) {
            row.style.display = ''; // Строка "нет данных"
            return;
        }
        
        let showRow = true;
        
        // Поиск по тексту
        if (searchTerm && showRow) {
            const rowText = row.textContent.toLowerCase();
            if (!rowText.includes(searchTerm)) {
                showRow = false;
            }
        }
        
        // Фильтр по статусу
        if (statusValue !== 'all' && showRow) {
            const statusCell = row.cells[9];
            const statusText = statusCell.textContent.toLowerCase();
            
            if (statusValue === 'pending' && !isInRepairStatus(statusText)) {
                showRow = false;
            } else if (statusValue === 'completed' && !statusText.includes('заверш')) {
                showRow = false;
            }
        }
        
        // Фильтр по участку
        if (locationValue !== 'all' && showRow) {
            const locationCell = row.cells[2];
            if (locationCell.textContent.trim() !== locationValue) {
                showRow = false;
            }
        }
        
        // Фильтр по месяцу
        if (monthValue && showRow) {
            const dateCell = row.cells[0];
            const cellDate = new Date(dateCell.textContent);
            const cellMonth = cellDate.getFullYear() + '-' + String(cellDate.getMonth() + 1).padStart(2, '0');
            if (cellMonth !== monthValue) {
                showRow = false;
            }
        }
        
        row.style.display = showRow ? '' : 'none';
        if (showRow) visibleCount++;
    });
    
    // Обновляем статистику с учетом фильтров
    updateFilteredStatistics();
}

function updateFilteredStatistics() {
    const rows = document.querySelectorAll('#repairTableBody tr');
    let total = 0;
    let pending = 0;
    let completed = 0;
    let totalDowntime = 0;
    
    rows.forEach(row => {
        if (row.style.display === 'none' || row.cells.length < 14) return;
        
        total++;
        
        const statusCell = row.cells[9];
        const statusText = statusCell.textContent.toLowerCase();
        const hoursCell = row.cells[11];
        const hoursText = hoursCell.textContent.replace(' ч', '').trim();
        const hours = parseFloat(hoursText) || 0;
        
        if (isInRepairStatus(statusText)) {
            pending++;
        } else if (statusText.includes('заверш')) {
            completed++;
        }
        
        totalDowntime += hours;
    });
    
    const totalElement = document.getElementById('totalRequests');
    const pendingElement = document.getElementById('pendingRequests');
    const completedElement = document.getElementById('completedRequests');
    const downtimeElement = document.getElementById('totalDowntime');
    
    if (totalElement) totalElement.textContent = total;
    if (pendingElement) pendingElement.textContent = pending;
    if (completedElement) completedElement.textContent = completed;
    if (downtimeElement) downtimeElement.textContent = Math.round(totalDowntime) + ' ч';
}

// ===== ДЕЙСТВИЯ С ЗАЯВКАМИ =====
async function completeRepair(repairId) {
    if (!window.currentUser || (window.currentUser.type !== 'admin' && window.currentUser.type !== 'repair')) {
        showNotification('У вас нет прав для завершения заявок', 'error');
        return;
    }
    
    const repair = repairsList.find(r => r.id === repairId);
    if (!repair) {
        showNotification('Заявка не найдена', 'error');
        return;
    }
    
    if (repair.status === 'Завершено') {
        showNotification('Заявка уже завершена', 'info');
        return;
    }
    
    // Запрашиваем количество простоев
    const downtimeCount = prompt('Введите количество простоев (целое число):', '1');
    if (downtimeCount === null) return;
    
    const count = parseInt(downtimeCount);
    if (isNaN(count) || count < 0) {
        showNotification('Неверное количество простоев', 'error');
        return;
    }
    
    try {
        const updateData = {
            status: 'Завершено',
            end_datetime: new Date().toISOString(),
            downtime_count: count,
            updated_at: new Date().toISOString(),
            completed_by: window.currentUser.name,
            synced: false
        };
        
        if (window.isFirebaseReady && window.db && repair.firestoreId) {
            // Обновляем в Firestore
            await window.db.collection('repairs').doc(repair.firestoreId).update({
                ...updateData,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            updateData.synced = true;
        }
        
        // Обновляем локально
        const index = repairsList.findIndex(r => r.id === repairId);
        if (index !== -1) {
            repairsList[index] = { ...repairsList[index], ...updateData };
            saveToLocalStorage();
        }
        
        // Обновляем таблицу
        renderRepairsTable();
        
        showNotification('Заявка завершена', 'success');
        
    } catch (error) {
        console.error('Ошибка завершения заявки:', error);
        showNotification('Ошибка завершения заявки', 'error');
    }
}

async function deleteRepair(repairId) {
    if (!window.currentUser || window.currentUser.type !== 'admin') {
        showNotification('Только администратор может удалять заявки', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        const repair = repairsList.find(r => r.id === repairId);
        
        if (window.isFirebaseReady && window.db && repair?.firestoreId) {
            // Удаляем из Firestore
            await window.db.collection('repairs').doc(repair.firestoreId).delete();
        }
        
        // Удаляем локально
        repairsList = repairsList.filter(r => r.id !== repairId);
        saveToLocalStorage();
        
        // Обновляем таблицу
        renderRepairsTable();
        
        showNotification('Заявка удалена', 'warning');
        
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        showNotification('Ошибка удаления заявки', 'error');
    }
}

// ===== УВЕДОМЛЕНИЯ =====
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

// ===== ГЛОБАЛЬНЫЕ ФУНКЦИИ =====
window.syncAllData = async function() {
    if (!window.isFirebaseReady || !window.db) {
        showNotification('Firebase не доступен. Проверьте интернет-соединение.', 'error');
        return;
    }
    
    showNotification('Синхронизация началась...', 'info');
    
    try {
        // Перезагружаем данные
        await loadRepairs();
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
    
    if (repairsList.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    try {
        // Создаем CSV
        const headers = ['Дата начала', 'Автор', 'Участок', 'Инв. номер', 'Оборудование', 'Статус', 'Время простоя'];
        const rows = repairsList.map(repair => {
            const startDate = repair.start_datetime ? new Date(repair.start_datetime) : null;
            let downtime = '0';
            
            if (startDate && repair.end_datetime) {
                const endDate = new Date(repair.end_datetime);
                const diffHours = Math.floor((endDate - startDate) / (1000 * 60 * 60));
                downtime = diffHours.toString();
            }
            
            return [
                startDate ? startDate.toLocaleString('ru-RU') : '',
                repair.author || '',
                repair.location || '',
                repair.inv_number || '',
                repair.equipment_name || '',
                repair.status || '',
                downtime
            ];
        });
        
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
    
    const pending = repairsList.filter(r => isInRepairStatus(r.status)).length;
    const completed = repairsList.filter(r => r.status === 'Завершено').length;
    const total = repairsList.length;
    
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
        <div style="margin-top: 30px; padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <h3>Информация о системе</h3>
            <p><strong>Заявок в ремонте:</strong> выделены желтым цветом и находятся в начале таблицы</p>
            <p><strong>Всего оборудования:</strong> ${equipmentList.length}</p>
            <p><strong>Статус Firebase:</strong> ${window.isFirebaseReady ? 'ONLINE' : 'OFFLINE'}</p>
            <p><strong>Пользователь:</strong> ${window.currentUser?.name || 'Неизвестно'}</p>
            <p><strong>Роль:</strong> ${window.currentUser?.type || 'Не определена'}</p>
        </div>
    `;
    
    modal.style.display = 'block';
};

window.closeDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.logout = function() {
    localStorage.removeItem('repair_journal_currentUser');
    localStorage.removeItem('repair_journal_isAuthenticated');
    window.location.href = 'login.html';
};

// Запускаем приложение когда всё готово
window.addEventListener('load', function() {
    console.log('Страница загружена, запускаем приложение...');
    
    // Проверяем авторизацию
    const isAuthenticated = localStorage.getItem('repair_journal_isAuthenticated');
    const currentUser = JSON.parse(localStorage.getItem('repair_journal_currentUser'));
    
    if (!isAuthenticated || !currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Устанавливаем текущего пользователя
    window.currentUser = currentUser;
    
    // Запускаем инициализацию
    setTimeout(initApplication, 100);
});
