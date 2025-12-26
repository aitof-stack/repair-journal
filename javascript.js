// Ремонтный журнал (Firebase Sync) v5.0.6
// Основной файл приложения - ИСПРАВЛЕННАЯ ВЕРСИЯ

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let firebaseApp = null;
let db = null;
let auth = null;
let currentUser = null;
let repairsList = [];
let equipmentList = [];
let isFirebaseReady = false;
let unsubscribeRepairs = null;
let deviceId = null;

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
console.log('Ремонтный журнал (Firebase Sync) v5.0.6 запускается...');

// Генерация Device ID при первой загрузке
if (!deviceId) {
    deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    console.log('Device ID:', deviceId);
}

// Функция инициализации приложения
async function initApp() {
    console.log('Ремонтный журнал (Firebase Sync) v5.0.6 - основная инициализация');
    
    try {
        // Проверяем авторизацию
        await checkAuthAndInit();
        
        // Инициализируем Firebase (один раз!)
        await initializeFirebase();
        
        // Загружаем базу оборудования
        await loadEquipmentDatabase();
        
        // Загружаем данные
        await loadData();
        
        // Настраиваем UI
        setupUI();
        
        console.log('Приложение успешно запущено. Firebase:', isFirebaseReady ? 'ONLINE' : 'OFFLINE');
        
        // Убираем экран загрузки
        setTimeout(() => {
            const loadingScreen = document.getElementById('loadingScreen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }
        }, 500);
        
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        showNotification('Ошибка запуска приложения: ' + error.message, 'error');
    }
}

// ===== АВТОРИЗАЦИЯ =====
async function checkAuthAndInit() {
    // Проверяем сохраненные данные пользователя
    const savedUser = localStorage.getItem('repair_journal_currentUser');
    const isAuth = localStorage.getItem('repair_journal_isAuthenticated');
    
    if (savedUser && isAuth === 'true') {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('Пользователь:', currentUser.name + ' (' + currentUser.type + ')');
            
            // Обновляем UI информации о пользователе
            updateUserInfo();
            
        } catch (e) {
            console.error('Ошибка загрузки пользователя:', e);
            window.location.href = 'login.html';
        }
    } else {
        window.location.href = 'login.html';
    }
}

function updateUserInfo() {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userInfoElement = document.getElementById('userInfo');
    
    if (currentUser && userNameElement && userRoleElement) {
        userNameElement.textContent = currentUser.name;
        
        let roleText = '';
        switch(currentUser.type) {
            case 'admin': roleText = 'Администратор'; break;
            case 'author': roleText = 'Автор заявок'; break;
            case 'repair': roleText = 'Ремонтная служба'; break;
            default: roleText = currentUser.type;
        }
        
        userRoleElement.textContent = roleText;
        
        if (userInfoElement) {
            userInfoElement.style.display = 'flex';
        }
    }
}

// ===== FIREBASE ИНИЦИАЛИЗАЦИЯ =====
async function initializeFirebase() {
    console.log('Проверяем инициализацию Firebase...');
    
    // Проверяем, что Firebase SDK загружен
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не загружен. Работаем в офлайн-режиме.');
        isFirebaseReady = false;
        return;
    }
    
    try {
        // Инициализируем Firebase только если еще не инициализирован
        if (firebase.apps.length === 0) {
            console.log('Инициализируем Firebase приложение...');
            
            // Проверяем наличие конфигурации
            if (typeof firebaseConfig === 'undefined') {
                console.warn('Конфигурация Firebase не найдена');
                isFirebaseReady = false;
                return;
            }
            
            firebaseApp = firebase.initializeApp(firebaseConfig);
            console.log('Firebase проект:', firebaseApp.options.projectId);
        } else {
            console.log('Firebase уже инициализирован');
            firebaseApp = firebase.app();
        }
        
        // Инициализируем сервисы
        db = firebase.firestore();
        auth = firebase.auth();
        
        // Настраиваем анонимную аутентификацию
        await setupAnonymousAuth();
        
        // Включаем persistence (только один раз!)
        await enablePersistence();
        
        isFirebaseReady = true;
        console.log('Firebase успешно инициализирован');
        
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        isFirebaseReady = false;
        showNotification('Офлайн режим: ' + error.message, 'warning');
    }
}

async function setupAnonymousAuth() {
    if (!auth) return;
    
    try {
        // Используем анонимную аутентификацию для Firestore
        await auth.signInAnonymously();
        console.log('Анонимная аутентификация выполнена');
    } catch (error) {
        console.error('Ошибка анонимной аутентификации:', error);
    }
}

async function enablePersistence() {
    if (!db) return;
    
    try {
        // Проверяем, не включена ли уже persistence
        await db.enablePersistence({
            synchronizeTabs: true
        });
        console.log('Firestore persistence включена');
    } catch (err) {
        if (err.code === 'failed-precondition') {
            console.log('Persistence уже включена в другой вкладке');
        } else if (err.code === 'unimplemented') {
            console.log('Браузер не поддерживает persistence');
        } else {
            console.error('Ошибка включения persistence:', err);
        }
    }
}

// ===== БАЗА ОБОРУДОВАНИЯ =====
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    const loadingStatus = document.getElementById('loadingStatus');
    if (loadingStatus) {
        loadingStatus.textContent = 'Загрузка базы оборудования...';
    }
    
    try {
        let equipmentData = [];
        
        // Пытаемся загрузить из Firestore
        if (isFirebaseReady && db) {
            try {
                const snapshot = await db.collection('equipment').limit(100).get();
                if (!snapshot.empty) {
                    snapshot.forEach(doc => {
                        equipmentData.push({ id: doc.id, ...doc.data() });
                    });
                    console.log('Загружено оборудования из Firestore:', equipmentData.length);
                    equipmentList = equipmentData;
                    populateEquipmentSelect();
                    return;
                }
            } catch (firestoreError) {
                console.warn('Не удалось загрузить из Firestore:', firestoreError);
            }
        }
        
        // Загружаем из CSV файла
        equipmentData = await loadEquipmentFromCSV();
        equipmentList = equipmentData;
        console.log('Загружено оборудования из CSV:', equipmentList.length);
        
        // Синхронизируем с Firestore
        if (isFirebaseReady && db && equipmentList.length > 0) {
            await syncEquipmentToFirebase();
        }
        
        populateEquipmentSelect();
        
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        equipmentList = [];
        showNotification('Ошибка загрузки базы оборудования', 'error');
    }
}

async function loadEquipmentFromCSV() {
    try {
        // Загружаем CSV файл
        const response = await fetch('equipment_database.csv?t=' + Date.now());
        if (!response.ok) {
            throw new Error('Не удалось загрузить файл оборудования');
        }
        
        const csvText = await response.text();
        console.log('CSV загружен, длина:', csvText.length);
        
        // Парсим CSV
        const lines = csvText.split('\n');
        console.log('Общее количество строк CSV:', lines.length);
        
        const equipmentData = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            try {
                // Убираем кавычки и разбиваем по точкам с запятой
                const cleanLine = line.replace(/^"|"$/g, '');
                const parts = cleanLine.split(';');
                
                if (parts.length >= 4) {
                    const equipment = {
                        id: 'eq_' + i,
                        location: parts[0]?.trim() || '',
                        invNumber: parts[1]?.trim() || '',
                        name: parts[2]?.trim() || '',
                        model: parts[3]?.trim() || '',
                        machineNumber: parts[4]?.trim() || '',
                        fullText: line
                    };
                    
                    equipmentData.push(equipment);
                }
            } catch (parseError) {
                console.warn('Ошибка парсинга строки', i, ':', line);
            }
        }
        
        console.log('Успешно распарсено записей:', equipmentData.length);
        return equipmentData;
        
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        return [];
    }
}

async function syncEquipmentToFirebase() {
    if (!isFirebaseReady || !db) return;
    
    try {
        console.log('Начинаем синхронизацию оборудования с Firestore...');
        
        // Ограничиваем количество для первой синхронизации
        const batchSize = 50;
        const equipmentToSync = equipmentList.slice(0, batchSize);
        
        const batch = db.batch();
        
        equipmentToSync.forEach(equip => {
            const docRef = db.collection('equipment').doc(equip.id);
            batch.set(docRef, {
                location: equip.location,
                invNumber: equip.invNumber,
                name: equip.name,
                model: equip.model,
                machineNumber: equip.machineNumber,
                updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                synced: true
            });
        });
        
        await batch.commit();
        console.log('Оборудование синхронизировано с Firestore:', equipmentToSync.length, 'записей');
        
    } catch (error) {
        console.error('Ошибка синхронизации оборудования:', error);
    }
}

function populateEquipmentSelect() {
    const invNumberSelect = document.getElementById('invNumber');
    if (!invNumberSelect) return;
    
    // Сохраняем выбранное значение
    const selectedValue = invNumberSelect.value;
    
    // Очищаем список
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    // Добавляем оборудование
    equipmentList.forEach(equip => {
        const option = document.createElement('option');
        option.value = equip.invNumber;
        option.textContent = `${equip.invNumber} - ${equip.name} (${equip.location})`;
        option.dataset.equipment = JSON.stringify(equip);
        invNumberSelect.appendChild(option);
    });
    
    // Восстанавливаем выбранное значение
    if (selectedValue) {
        invNumberSelect.value = selectedValue;
    }
    
    // Настраиваем поиск
    setupEquipmentSearch();
}

function setupEquipmentSearch() {
    const searchInput = document.getElementById('invNumberSearch');
    const select = document.getElementById('invNumber');
    
    if (!searchInput || !select) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        // Показываем/скрываем селект
        if (searchTerm.length > 0) {
            select.style.display = 'block';
            
            // Фильтруем опции
            Array.from(select.options).forEach(option => {
                if (option.value === '') return;
                
                const text = option.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    option.style.display = '';
                } else {
                    option.style.display = 'none';
                }
            });
        } else {
            select.style.display = 'block';
            // Показываем все опции
            Array.from(select.options).forEach(option => {
                option.style.display = '';
            });
        }
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
                
                // Фокусируемся на следующем поле
                document.getElementById('faultDescription').focus();
            } catch (e) {
                console.error('Ошибка парсинга данных оборудования:', e);
            }
        }
    });
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadData() {
    console.log('Загрузка данных...');
    
    try {
        if (isFirebaseReady && db) {
            // Загружаем из Firestore
            await loadFromFirestore();
        } else {
            // Загружаем локальные данные
            loadLocalData();
        }
        
        // Рендерим таблицу
        renderRepairsTable();
        
        // Обновляем статистику
        updateStatistics();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        loadLocalData();
        renderRepairsTable();
    }
}

async function loadFromFirestore() {
    try {
        console.log('Загрузка данных из Firestore...');
        
        // Сначала получаем snapshot
        const snapshot = await db.collection('repairs')
            .orderBy('created_at', 'desc')
            .get();
        
        repairsList = [];
        snapshot.forEach(doc => {
            repairsList.push({ 
                id: doc.id, 
                ...doc.data(),
                firestoreId: doc.id
            });
        });
        
        console.log('Загружено заявок из Firestore:', repairsList.length);
        
        // Настраиваем подписку на обновления в реальном времени
        setupRealtimeUpdates();
        
    } catch (error) {
        console.error('Ошибка загрузки из Firestore:', error);
        throw error;
    }
}

function loadLocalData() {
    const localData = localStorage.getItem('repair_journal_repairs');
    if (localData) {
        try {
            repairsList = JSON.parse(localData);
            console.log('Загружено локальных заявок:', repairsList.length);
        } catch (e) {
            console.error('Ошибка парсинга локальных данных:', e);
            repairsList = [];
        }
    } else {
        repairsList = [];
    }
}

function saveLocalData() {
    try {
        localStorage.setItem('repair_journal_repairs', JSON.stringify(repairsList));
    } catch (error) {
        console.error('Ошибка сохранения локальных данных:', error);
    }
}

function setupRealtimeUpdates() {
    if (!isFirebaseReady || !db || unsubscribeRepairs) return;
    
    console.log('Настраиваем подписку на обновления Firestore в реальном времени');
    
    unsubscribeRepairs = db.collection('repairs')
        .orderBy('created_at', 'desc')
        .onSnapshot(snapshot => {
            repairsList = [];
            snapshot.forEach(doc => {
                repairsList.push({ 
                    id: doc.id, 
                    ...doc.data(),
                    firestoreId: doc.id
                });
            });
            
            console.log('Получены обновления из Firestore:', repairsList.length, 'заявок');
            renderRepairsTable();
            updateStatistics();
            saveLocalData();
            
        }, error => {
            console.error('Ошибка подписки Firestore:', error);
            showNotification('Ошибка синхронизации с сервером', 'error');
        });
}

// ===== РЕНДЕРИНГ ТАБЛИЦЫ =====
function renderRepairsTable() {
    console.log('Рендеринг таблицы с', repairsList?.length || 0, 'заявками');
    
    const tbody = document.getElementById('repairTableBody');
    if (!tbody) {
        console.error('Не найден элемент repairTableBody');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!repairsList || repairsList.length === 0) {
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
    
    // Сортируем заявки: сначала "в ремонте", потом по дате
    const sortedRepairs = [...repairsList].sort((a, b) => {
        // Приоритет 1: статус "в ремонте"
        const aInRepair = isInRepairStatus(a.status);
        const bInRepair = isInRepairStatus(b.status);
        
        if (aInRepair && !bInRepair) return -1;
        if (!aInRepair && bInRepair) return 1;
        
        // Приоритет 2: дата (новые сверху)
        const dateA = a.start_datetime ? new Date(a.start_datetime) : new Date(0);
        const dateB = b.start_datetime ? new Date(b.start_datetime) : new Date(0);
        return dateB - dateA;
    });
    
    // Рендерим каждую заявку
    sortedRepairs.forEach((repair, index) => {
        const row = createRepairRow(repair, index);
        tbody.appendChild(row);
    });
    
    // Применяем фильтры
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

function createRepairRow(repair, index) {
    const row = document.createElement('tr');
    
    // Проверяем статус
    const isInRepair = isInRepairStatus(repair.status);
    
    // Добавляем класс для строки в ремонте
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
    
    // Получаем класс статуса
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
            ${currentUser?.type === 'admin' || currentUser?.type === 'repair' ? 
                `<button class="btn-complete" onclick="completeRepair('${repair.id}')" ${repair.status === 'Завершено' ? 'disabled' : ''}>
                    ${repair.status === 'Завершено' ? '✓ Завершено' : 'Завершить'}
                </button>` : 
                ''
            }
            ${currentUser?.type === 'admin' ? 
                `<button class="btn-delete" onclick="deleteRepair('${repair.id}')">Удалить</button>` : 
                ''
            }
        </td>
    `;
    
    // Анимация появления
    row.style.opacity = '0';
    row.style.transform = 'translateY(10px)';
    setTimeout(() => {
        row.style.transition = 'all 0.3s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
    }, index * 30);
    
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
    if (statusLower.includes('заверш') || statusLower.includes('готов') || statusLower.includes('выполнен')) return 'status-completed';
    if (statusLower.includes('нов')) return 'status-new';
    if (statusLower.includes('отмен') || statusLower.includes('отказ')) return 'status-cancelled';
    
    return 'status-unknown';
}

// ===== ФИЛЬТРАЦИЯ И ПОИСК =====
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
    
    rows.forEach(row => {
        if (row.cells.length < 14) return; // Пропускаем строку "нет данных"
        
        let showRow = true;
        
        // Поиск по тексту
        if (searchTerm) {
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
    });
    
    // Обновляем статистику после фильтрации
    updateStatistics();
}

// ===== СТАТИСТИКА =====
function updateStatistics() {
    const totalElement = document.getElementById('totalRequests');
    const pendingElement = document.getElementById('pendingRequests');
    const completedElement = document.getElementById('completedRequests');
    const downtimeElement = document.getElementById('totalDowntime');
    
    if (!totalElement || !pendingElement || !completedElement || !downtimeElement) return;
    
    // Получаем видимые строки
    const visibleRows = Array.from(document.querySelectorAll('#repairTableBody tr'))
        .filter(row => row.style.display !== 'none' && row.cells.length >= 14);
    
    const total = visibleRows.length;
    const pending = visibleRows.filter(row => {
        const statusCell = row.cells[9];
        return isInRepairStatus(statusCell.textContent);
    }).length;
    
    const completed = visibleRows.filter(row => {
        const statusCell = row.cells[9];
        return statusCell.textContent.toLowerCase().includes('заверш');
    }).length;
    
    // Рассчитываем общее время простоя
    let totalDowntime = 0;
    visibleRows.forEach(row => {
        const hoursCell = row.cells[11];
        const hoursText = hoursCell.textContent.replace(' ч', '').trim();
        const hours = parseFloat(hoursText) || 0;
        totalDowntime += hours;
    });
    
    totalElement.textContent = total;
    pendingElement.textContent = pending;
    completedElement.textContent = completed;
    downtimeElement.textContent = Math.round(totalDowntime) + ' ч';
}

// ===== ФОРМА ДОБАВЛЕНИЯ ЗАЯВКИ =====
function setupForm() {
    const form = document.getElementById('repairForm');
    const clearBtn = document.getElementById('clearBtn');
    
    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    // Устанавливаем текущую дату и время по умолчанию
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().slice(0, 5);
    
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    if (dateInput) dateInput.value = dateStr;
    if (timeInput) timeInput.value = timeStr;
    
    // Устанавливаем автора заявки
    const authorInput = document.getElementById('author');
    if (authorInput && currentUser) {
        authorInput.value = currentUser.name;
    }
}

async function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!currentUser) {
        showNotification('Ошибка: пользователь не авторизован', 'error');
        return;
    }
    
    // Проверяем права доступа
    if (currentUser.type !== 'admin' && currentUser.type !== 'author') {
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
        created_by: currentUser.name,
        user_id: currentUser.id || 'anonymous',
        device_id: deviceId,
        synced: false
    };
    
    // Проверка обязательных полей
    if (!formData.author || !formData.inv_number || !formData.fault_description) {
        showNotification('Заполните обязательные поля: автор, инвентарный номер и описание неисправности', 'error');
        return;
    }
    
    try {
        let repairId;
        
        if (isFirebaseReady && db) {
            // Сохраняем в Firestore
            const docRef = await db.collection('repairs').add({
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
        
        // Добавляем в локальный список
        repairsList.unshift(formData);
        
        // Сохраняем локально
        saveLocalData();
        
        // Обновляем таблицу
        renderRepairsTable();
        updateStatistics();
        
        // Очищаем форму
        clearForm();
        
        showNotification('Заявка успешно добавлена', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения заявки:', error);
        showNotification('Ошибка сохранения заявки: ' + error.message, 'error');
    }
}

function clearForm() {
    const form = document.getElementById('repairForm');
    if (form) {
        form.reset();
        
        // Устанавливаем текущую дату и время
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toTimeString().slice(0, 5);
        
        const dateInput = document.getElementById('date');
        const timeInput = document.getElementById('time');
        const authorInput = document.getElementById('author');
        
        if (dateInput) dateInput.value = dateStr;
        if (timeInput) timeInput.value = timeStr;
        if (authorInput && currentUser) {
            authorInput.value = currentUser.name;
        }
        
        // Очищаем поля, заполняемые из оборудования
        document.getElementById('equipmentName').value = '';
        document.getElementById('location').value = '';
        document.getElementById('model').value = '';
        document.getElementById('machineNumber').value = '';
        
        showNotification('Форма очищена', 'info');
    }
}

// ===== ДЕЙСТВИЯ С ЗАЯВКАМИ =====
async function completeRepair(repairId) {
    if (!currentUser || (currentUser.type !== 'admin' && currentUser.type !== 'repair')) {
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
            completed_by: currentUser.name,
            synced: false
        };
        
        if (isFirebaseReady && db && repair.firestoreId) {
            // Обновляем в Firestore
            await db.collection('repairs').doc(repair.firestoreId).update({
                ...updateData,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            updateData.synced = true;
        }
        
        // Обновляем локально
        const index = repairsList.findIndex(r => r.id === repairId);
        if (index !== -1) {
            repairsList[index] = { ...repairsList[index], ...updateData };
            saveLocalData();
        }
        
        // Обновляем таблицу
        renderRepairsTable();
        updateStatistics();
        
        showNotification('Заявка завершена', 'success');
        
    } catch (error) {
        console.error('Ошибка завершения заявки:', error);
        showNotification('Ошибка завершения заявки: ' + error.message, 'error');
    }
}

async function deleteRepair(repairId) {
    if (!currentUser || currentUser.type !== 'admin') {
        showNotification('Только администратор может удалять заявки', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        const repair = repairsList.find(r => r.id === repairId);
        
        if (isFirebaseReady && db && repair?.firestoreId) {
            // Удаляем из Firestore
            await db.collection('repairs').doc(repair.firestoreId).delete();
        }
        
        // Удаляем локально
        repairsList = repairsList.filter(r => r.id !== repairId);
        saveLocalData();
        
        // Обновляем таблицу
        renderRepairsTable();
        updateStatistics();
        
        showNotification('Заявка удалена', 'warning');
        
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        showNotification('Ошибка удаления заявки: ' + error.message, 'error');
    }
}

// ===== СИНХРОНИЗАЦИЯ =====
async function syncAllData() {
    if (!isFirebaseReady || !db) {
        showNotification('Firebase не доступен. Проверьте интернет-соединение.', 'error');
        return;
    }
    
    showNotification('Синхронизация началась...', 'info');
    
    try {
        console.log('Начинаем полную синхронизацию...');
        
        // Синхронизируем оборудование
        if (equipmentList.length > 0) {
            await syncEquipmentToFirebase();
        }
        
        // Синхронизируем заявки
        const localRepairs = repairsList.filter(r => !r.synced && !r.firestoreId);
        
        if (localRepairs.length > 0) {
            console.log('Найдено несинхронизированных заявок:', localRepairs.length);
            
            for (const repair of localRepairs) {
                try {
                    const docRef = await db.collection('repairs').add({
                        ...repair,
                        created_at: firebase.firestore.FieldValue.serverTimestamp(),
                        updated_at: firebase.firestore.FieldValue.serverTimestamp(),
                        synced: true
                    });
                    
                    // Обновляем локальную запись
                    const index = repairsList.findIndex(r => r.id === repair.id);
                    if (index !== -1) {
                        repairsList[index].firestoreId = docRef.id;
                        repairsList[index].synced = true;
                    }
                    
                } catch (error) {
                    console.error('Ошибка синхронизации заявки', repair.id, ':', error);
                }
            }
            
            saveLocalData();
        }
        
        // Загружаем свежие данные с сервера
        await loadFromFirestore();
        
        showNotification(`Синхронизация завершена. Заявок: ${repairsList.length}`, 'success');
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации: ' + error.message, 'error');
    }
}

// ===== ОБНОВЛЕНИЕ БАЗЫ ОБОРУДОВАНИЯ =====
async function updateEquipmentDB() {
    showNotification('Обновление базы оборудования...', 'info');
    
    try {
        // Очищаем текущий список
        equipmentList = [];
        
        // Загружаем заново
        await loadEquipmentDatabase();
        
        showNotification('База оборудования обновлена', 'success');
        
    } catch (error) {
        console.error('Ошибка обновления базы оборудования:', error);
        showNotification('Ошибка обновления базы оборудования', 'error');
    }
}

// ===== ЭКСПОРТ ДАННЫХ =====
function exportRepairData() {
    if (!currentUser || currentUser.type !== 'admin') {
        showNotification('Только администратор может экспортировать данные', 'error');
        return;
    }
    
    if (repairsList.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    try {
        // Создаем CSV
        const headers = [
            'ID',
            'Дата начала',
            'Автор',
            'Участок',
            'Инв. номер',
            'Оборудование',
            'Модель',
            'Номер станка',
            'Неисправность',
            'Дата окончания',
            'Статус',
            'Кол-во простоев',
            'Время простоя (ч)',
            'Номенклатура',
            'Создано',
            'Обновлено'
        ];
        
        const rows = repairsList.map(repair => [
            repair.id || '',
            repair.start_datetime ? new Date(repair.start_datetime).toLocaleString('ru-RU') : '',
            repair.author || '',
            repair.location || '',
            repair.inv_number || '',
            repair.equipment_name || '',
            repair.model || '',
            repair.machine_number || '',
            repair.fault_description || '',
            repair.end_datetime ? new Date(repair.end_datetime).toLocaleString('ru-RU') : '',
            repair.status || '',
            repair.downtime_count || '0',
            repair.downtime_hours || '0',
            repair.production_item || '',
            repair.created_at ? new Date(repair.created_at).toLocaleString('ru-RU') : '',
            repair.updated_at ? new Date(repair.updated_at).toLocaleString('ru-RU') : ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');
        
        // Создаем и скачиваем файл
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
        showNotification('Ошибка экспорта: ' + error.message, 'error');
    }
}

// ===== ДАШБОРД =====
function showDashboard() {
    const modal = document.getElementById('dashboardModal');
    const content = document.getElementById('dashboardContent');
    
    if (!modal || !content) return;
    
    // Рассчитываем статистику
    const total = repairsList.length;
    const pending = repairsList.filter(r => isInRepairStatus(r.status)).length;
    const completed = repairsList.filter(r => r.status === 'Завершено').length;
    
    // Группируем по участкам
    const locationStats = {};
    repairsList.forEach(repair => {
        const location = repair.location || 'Не указан';
        locationStats[location] = (locationStats[location] || 0) + 1;
    });
    
    // Группируем по месяцам
    const monthStats = {};
    repairsList.forEach(repair => {
        if (repair.start_datetime) {
            const date = new Date(repair.start_datetime);
            const monthKey = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
            monthStats[monthKey] = (monthStats[monthKey] || 0) + 1;
        }
    });
    
    // Создаем HTML для дашборда
    content.innerHTML = `
        <div class="dashboard-stats">
            <div class="stat-card">
                <h3>Всего заявок</h3>
                <div class="stat-value">${total}</div>
                <div class="stat-change">Всего создано заявок</div>
            </div>
            <div class="stat-card">
                <h3>В ремонте</h3>
                <div class="stat-value">${pending}</div>
                <div class="stat-change">Требуют внимания</div>
            </div>
            <div class="stat-card">
                <h3>Завершено</h3>
                <div class="stat-value">${completed}</div>
                <div class="stat-change">${total > 0 ? Math.round((completed / total) * 100) : 0}% от общего числа</div>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 30px;">
            <div>
                <h3>Статистика по участкам</h3>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${Object.entries(locationStats)
                        .sort((a, b) => b[1] - a[1])
                        .map(([location, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee;">
                                <span>${location}</span>
                                <strong>${count}</strong>
                            </div>
                        `).join('')}
                </div>
            </div>
            <div>
                <h3>Статистика по месяцам</h3>
                <div style="max-height: 300px; overflow-y: auto;">
                    ${Object.entries(monthStats)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([month, count]) => `
                            <div style="display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee;">
                                <span>${month}</span>
                                <strong>${count}</strong>
                            </div>
                        `).join('')}
                </div>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
            <h3>Информация о системе</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div><strong>Пользователь:</strong> ${currentUser?.name || 'Не авторизован'}</div>
                <div><strong>Роль:</strong> ${currentUser?.type || 'Не определена'}</div>
                <div><strong>Firebase:</strong> ${isFirebaseReady ? 'ONLINE' : 'OFFLINE'}</div>
                <div><strong>Устройство:</strong> ${deviceId?.substring(0, 15) + '...' || 'Не определено'}</div>
                <div><strong>Заявок в памяти:</strong> ${repairsList.length}</div>
                <div><strong>Оборудования в базе:</strong> ${equipmentList.length}</div>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeDashboard() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// ===== УВЕДОМЛЕНИЯ =====
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    // Автоматическое скрытие
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// ===== НАСТРОЙКА UI =====
function setupUI() {
    // Настраиваем форму
    setupForm();
    
    // Настраиваем фильтры
    setupFilters();
    
    // Настраиваем обработчики кнопок
    setupButtonHandlers();
    
    // Настраиваем обработку изменений онлайн/офлайн
    setupOnlineHandler();
    
    console.log('UI настроен');
}

function setupButtonHandlers() {
    // Кнопка выхода
    const logoutBtn = document.querySelector('.logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('repair_journal_currentUser');
            localStorage.removeItem('repair_journal_isAuthenticated');
            window.location.href = 'login.html';
        });
    }
    
    // Кнопка синхронизации
    const syncBtn = document.querySelector('.sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncAllData);
    }
    
    // Кнопка закрытия модального окна дашборда
    const closeModalBtn = document.querySelector('.modal .close');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeDashboard);
    }
    
    // Закрытие модального окна при клике вне его
    window.addEventListener('click', (event) => {
        const modal = document.getElementById('dashboardModal');
        if (modal && event.target === modal) {
            closeDashboard();
        }
    });
}

function setupOnlineHandler() {
    const connectionStatus = document.getElementById('connectionStatus');
    
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        if (connectionStatus) {
            connectionStatus.textContent = isOnline ? 'Онлайн' : 'Офлайн';
            connectionStatus.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
        }
        
        if (isOnline && isFirebaseReady) {
            // При восстановлении соединения пытаемся синхронизироваться
            setTimeout(syncAllData, 1000);
        }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
// Запускаем приложение после полной загрузки страницы
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOM загружен, запускаем приложение...');
    
    // Проверяем авторизацию перед инициализацией
    const isAuthenticated = localStorage.getItem('repair_journal_isAuthenticated');
    const currentUser = JSON.parse(localStorage.getItem('repair_journal_currentUser'));
    
    if (!isAuthenticated || !currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Показываем основной контент
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
        mainContainer.style.display = 'block';
    }
    
    // Запускаем инициализацию с задержкой
    setTimeout(initApp, 100);
});

// Экспортируем функции для глобального доступа
window.logout = function() {
    localStorage.removeItem('repair_journal_currentUser');
    localStorage.removeItem('repair_journal_isAuthenticated');
    window.location.href = 'login.html';
};

window.syncAllData = syncAllData;
window.updateEquipmentDB = updateEquipmentDB;
window.exportRepairData = exportRepairData;
window.showDashboard = showDashboard;
window.closeDashboard = closeDashboard;
window.completeRepair = completeRepair;
window.deleteRepair = deleteRepair;
