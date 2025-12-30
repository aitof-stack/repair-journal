// javascript.js - Основная логика приложения v6.4 (Исправленная инициализация)
console.log('Ремонтный журнал v6.4 загружен');

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let repairsList = [];
let equipmentList = [];
let unsubscribeRepairs = null;
let deviceId = null;
let isFirestoreConnected = false;

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
async function initApplication() {
    console.log('Инициализация приложения v6.4');
    
    try {
        // 1. Сначала инициализируем Firebase (самое первое действие!)
        updateLoadingStatus('Инициализация Firebase...');
        const firebaseResult = await initializeFirebase();
        
        // 2. Устанавливаем текущую дату и время в форму
        setDefaultFormDateTime();
        
        // 3. Загружаем базу оборудования (из CSV, без Firestore)
        updateLoadingStatus('Загрузка базы оборудования...');
        await loadEquipmentDatabase();
        
        // 4. Загружаем заявки
        updateLoadingStatus('Загрузка заявок...');
        await loadRepairs();
        
        // 5. Настраиваем UI
        setupUI();
        
        // 6. Обновляем статистику
        updateStatistics();
        
        console.log('Приложение инициализировано успешно');
        console.log('Статус подключения:', isFirestoreConnected ? 'ONLINE' : 'OFFLINE');
        
        // 7. Скрываем экран загрузки
        hideLoadingScreen();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка запуска приложения: ' + error.message, 'error');
        hideLoadingScreen();
    }
}

// Упрощенная инициализация Firebase (без повторных попыток, которые вызывали ошибку)
async function initializeFirebase() {
    try {
        if (typeof window.initializeFirebase === 'function') {
            console.log('Инициализация Firebase...');
            
            const firebaseResult = await window.initializeFirebase();
            
            if (firebaseResult.success) {
                console.log('Firebase инициализирован успешно');
                isFirestoreConnected = firebaseResult.connected;
                
                // Если не удалось подключиться, показываем предупреждение
                if (!isFirestoreConnected) {
                    console.warn('Firestore не подключен, работаем в офлайн-режиме');
                    showNotification('Работаем в офлайн-режиме', 'warning');
                }
                
                return firebaseResult;
            } else {
                console.warn('Инициализация Firebase не удалась:', firebaseResult.error);
                isFirestoreConnected = false;
                showNotification('Firebase недоступен, работаем в офлайн-режиме', 'warning');
                return { success: false, connected: false };
            }
        } else {
            throw new Error('Функция инициализации Firebase не найдена');
        }
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        isFirestoreConnected = false;
        showNotification('Ошибка подключения к Firebase', 'warning');
        return { success: false, connected: false };
    }
}

function updateLoadingStatus(message) {
    const loadingStatus = document.getElementById('loadingStatus');
    if (loadingStatus) {
        loadingStatus.textContent = message;
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

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.getElementById('mainContainer');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    if (mainContainer) {
        mainContainer.style.display = 'block';
    }
}

// ===== БАЗА ОБОРУДОВАНИЯ =====
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    try {
        // ВСЕГДА загружаем из CSV (основной источник)
        const equipmentData = await loadEquipmentFromCSV();
        equipmentList = equipmentData;
        console.log('Загружено из CSV:', equipmentList.length);
        
        // Попробуем обновить из Firestore если подключены
        if (window.isFirebaseReady && window.db && isFirestoreConnected) {
            try {
                await syncEquipmentWithFirestore();
            } catch (syncError) {
                console.warn('Не удалось синхронизировать оборудование с Firestore:', syncError);
            }
        }
        
        populateEquipmentSelect();
        
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        equipmentList = [];
        showNotification('Ошибка загрузки базы оборудования', 'error');
    }
}

async function syncEquipmentWithFirestore() {
    if (!window.db) return;
    
    try {
        console.log('Синхронизация оборудования с Firestore...');
        const snapshot = await window.db.collection('equipment').limit(10).get();
        
        if (!snapshot.empty) {
            const firestoreEquipment = [];
            snapshot.forEach(doc => {
                firestoreEquipment.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Получено оборудования из Firestore:', firestoreEquipment.length);
            
            // Можно объединить данные, но пока просто логируем
            // В будущем можно реализовать приоритет Firestore
        }
    } catch (error) {
        throw error;
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
        if (window.isFirebaseReady && window.db && isFirestoreConnected) {
            console.log('Попытка загрузки из Firestore...');
            await loadFromFirestore();
        } else {
            console.log('Загрузка из localStorage...');
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
        console.log('Загрузка данных из Firestore...');
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
        
        // Сохраняем локально для офлайн-режима
        saveToLocalStorage();
        
    } catch (error) {
        console.error('Ошибка загрузки из Firestore:', error);
        
        // Если ошибка, переключаемся в офлайн-режим
        if (error.code === 'permission-denied' || error.code === 'unavailable') {
            console.log('Доступ к Firestore запрещен или недоступен, переключаемся на localStorage');
            isFirestoreConnected = false;
            loadFromLocalStorage();
        } else {
            throw error;
        }
    }
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('repair_journal_repairs');
    repairsList = saved ? JSON.parse(saved) : [];
    console.log('Загружено из localStorage:', repairsList.length);
}

function setupFirestoreListener() {
    if (!window.isFirebaseReady || !window.db || !isFirestoreConnected || unsubscribeRepairs) return;
    
    console.log('Настройка слушателя Firestore...');
    
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
            isFirestoreConnected = false;
        });
}

function saveToLocalStorage() {
    try {
        localStorage.setItem('repair_journal_repairs', JSON.stringify(repairsList));
        console.log('Данные сохранены в localStorage');
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
    if (isInRepairStatus(statusLower)) return 'status-in-repair';
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
    
    // Настраиваем обработчики кнопок
    setupButtonHandlers();
    
    // Показываем статус подключения
    updateConnectionStatus();
    
    console.log('UI настроен');
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (!statusElement) return;
    
    if (isFirestoreConnected) {
        statusElement.textContent = '🔥 ONLINE';
        statusElement.className = 'connection-status';
    } else {
        statusElement.textContent = '📴 OFFLINE';
        statusElement.className = 'connection-status offline';
    }
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
    
    // Кнопка закрытия дашборда
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
        synced: false,
        isOnline: isFirestoreConnected
    };
    
    // Проверка обязательных полей
    if (!formData.author || !formData.inv_number || !formData.fault_description) {
        showNotification('Заполните обязательные поля: автор, инвентарный номер и описание неисправности', 'error');
        return;
    }
    
    try {
        let repairId;
        
        if (window.isFirebaseReady && window.db && isFirestoreConnected) {
            // Сохраняем в Firestore
            try {
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
            } catch (firestoreError) {
                console.error('Ошибка сохранения в Firestore:', firestoreError);
                // Сохраняем локально
                repairId = 'local_' + Date.now();
                formData.id = repairId;
                formData.synced = false;
                showNotification('Заявка сохранена локально (Firestore недоступен)', 'warning');
            }
            
        } else {
            // Локальное сохранение
            repairId = 'local_' + Date.now();
            formData.id = repairId;
            formData.synced = false;
            showNotification('Заявка сохранена локально (офлайн режим)', 'info');
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
            synced: false,
            isOnline: isFirestoreConnected
        };
        
        if (window.isFirebaseReady && window.db && repair.firestoreId && isFirestoreConnected) {
            // Обновляем в Firestore
            try {
                await window.db.collection('repairs').doc(repair.firestoreId).update({
                    ...updateData,
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                updateData.synced = true;
                console.log('Заявка обновлена в Firestore:', repair.firestoreId);
            } catch (firestoreError) {
                console.error('Ошибка обновления в Firestore:', firestoreError);
                updateData.synced = false;
                showNotification('Обновлено локально (Firestore недоступен)', 'warning');
            }
        } else {
            showNotification('Обновлено локально (офлайн режим)', 'info');
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
        
        if (window.isFirebaseReady && window.db && repair?.firestoreId && isFirestoreConnected) {
            // Удаляем из Firestore
            try {
                await window.db.collection('repairs').doc(repair.firestoreId).delete();
                console.log('Заявка удалена из Firestore:', repair.firestoreId);
            } catch (firestoreError) {
                console.error('Ошибка удаления из Firestore:', firestoreError);
                showNotification('Удалено локально (Firestore недоступен)', 'warning');
            }
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
        
        // Обновляем статус подключения
        updateConnectionStatus();
        
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
    const equipmentCount = equipmentList.length;
    
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
            <p><strong>Всего оборудования:</strong> ${equipmentCount}</p>
            <p><strong>Статус Firestore:</strong> ${isFirestoreConnected ? '<span style="color: green;">🔥 ONLINE</span>' : '<span style="color: red;">📴 OFFLINE</span>'}</p>
            <p><strong>Firebase готовность:</strong> ${window.isFirebaseReady ? '<span style="color: green;">Готов</span>' : '<span style="color: red;">Не готов</span>'}</p>
            <p><strong>Пользователь:</strong> ${window.currentUser?.name || 'Неизвестно'}</p>
            <p><strong>Роль:</strong> ${window.currentUser?.type || 'Не определена'}</p>
            <p><strong>Локальных заявок:</strong> ${repairsList.filter(r => !r.synced).length} не синхронизировано</p>
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

// Функция для переподключения Firebase (исправленная)
window.reinitializeFirebase = async function() {
    showNotification('Переподключение к Firebase...', 'info');
    
    try {
        // Используем функцию из firebase-config.js
        const result = await window.reinitializeFirebase();
        
        if (result.success) {
            showNotification('Firebase переподключен успешно', 'success');
            isFirestoreConnected = result.connected;
            
            // Перезагружаем данные
            await loadRepairs();
            updateConnectionStatus();
        } else {
            showNotification('Ошибка переподключения: ' + (result.error || 'Неизвестная ошибка'), 'error');
            isFirestoreConnected = false;
        }
    } catch (error) {
        showNotification('Ошибка переподключения: ' + error.message, 'error');
        isFirestoreConnected = false;
    }
};

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
// Запускаем приложение когда страница загружена
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startApplication);
} else {
    startApplication();
}

function startApplication() {
    console.log('Запуск приложения...');
    
    // Проверяем авторизацию
    const isAuthenticated = localStorage.getItem('repair_journal_isAuthenticated');
    const currentUser = JSON.parse(localStorage.getItem('repair_journal_currentUser'));
    
    if (!isAuthenticated || !currentUser) {
        console.log('Пользователь не авторизован, перенаправляем...');
        window.location.href = 'login.html';
        return;
    }
    
    // Устанавливаем текущего пользователя
    window.currentUser = currentUser;
    
    // Запускаем инициализацию
    setTimeout(initApplication, 100);
}
