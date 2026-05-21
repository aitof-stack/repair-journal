// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ С FIREBASE СИНХРОНИЗАЦИЕЙ

// Константы
const APP_VERSION = '5.0.9';
const APP_NAME = 'Ремонтный журнал (Firebase Sync)';

// Ключи для хранения данных
const STORAGE_KEYS = {
    EQUIPMENT_DB: 'equipmentDatabase_v5',
    REPAIR_REQUESTS: 'repairRequests_v5',
    CURRENT_USER: 'repair_journal_currentUser',
    AUTH_STATUS: 'repair_journal_isAuthenticated',
    DB_LAST_UPDATED: 'equipmentDBLastUpdated_v5',
    DEVICE_ID: 'deviceId_v5',
    LAST_SYNC_TIME: 'lastSyncTime_v5'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = navigator.onLine;
let isDBLoading = false;
let deviceId = null;

// Firebase переменные
let firestore = null;
let auth = null;
let firestoreUnsubscribe = null;
let isFirebaseInitialized = false;

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============ ОСНОВНОЙ ЗАПУСК ============

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
    
    try {
        // Проверяем, находимся ли мы на главной странице
        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) {
            console.log('Элемент loadingScreen не найден. Возможно, это страница входа.');
            return;
        }
        
        // Генерируем ID устройства
        deviceId = generateDeviceId();
        console.log('Device ID:', deviceId);
        
        // Основной процесс инициализации
        setTimeout(() => {
            initializeApplication();
        }, 100);
        
    } catch (error) {
        console.error('Критическая ошибка при запуске:', error);
        showErrorAndContinue('Критическая ошибка при запуске приложения');
    }
});

// Генерация уникального ID устройства
function generateDeviceId() {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
        id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
}

// Основная функция инициализации приложения
async function initializeApplication() {
    console.log('Начинаем инициализацию приложения...');
    
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingStatus = document.getElementById('loadingStatus');
    const mainContainer = document.getElementById('mainContainer');
    
    // Проверяем наличие необходимых DOM элементов
    if (!loadingScreen || !mainContainer) {
        console.error('Не найдены необходимые элементы DOM');
        return;
    }
    
    try {
        // 1. Проверка авторизации
        if (!checkAuthentication()) {
            console.log('Пользователь не авторизован, перенаправляем...');
            redirectToLogin();
            return;
        }
        
        // 2. Инициализация интерфейса
        if (loadingStatus) loadingStatus.textContent = 'Инициализация интерфейса...';
        initDOMElements();
        setupInterface();
        
        // 3. Загрузка базы оборудования
        if (loadingStatus) loadingStatus.textContent = 'Загрузка базы оборудования...';
        await loadEquipmentDatabase();
        
        // 4. Пробуем Firebase (не блокируем загрузку)
        if (loadingStatus) loadingStatus.textContent = 'Проверка облачной синхронизации...';
        await initializeFirebase();
        
        // 5. Загрузка данных
        if (isFirebaseInitialized) {
            if (loadingStatus) loadingStatus.textContent = 'Загрузка данных из облака...';
            await loadRepairRequestsFromFirebase();
        } else {
            if (loadingStatus) loadingStatus.textContent = 'Загрузка локальных данных...';
            await loadRepairRequestsFromLocal();
        }
        
        // 6. Финальная настройка
        setupRoleBasedUI();
        showUserInfo();
        setupSearchableSelect();
        applyFilters();
        
        console.log('Приложение успешно инициализировано!');
        
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        
        // Пытаемся продолжить с локальными данными
        try {
            await loadRepairRequestsFromLocal();
        } catch (e) {
            console.error('Не удалось загрузить даже локальные данные:', e);
        }
        
        showNotification('Ошибка загрузки приложения. Работаем в локальном режиме.', 'error');
    } finally {
        // Всегда показываем основной интерфейс через 1 секунду
        setTimeout(() => {
            loadingScreen.style.display = 'none';
            mainContainer.style.display = 'block';
        }, 1000);
    }
}

// Проверка авторизации
function checkAuthentication() {
    try {
        const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
        const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
        
        if (!isAuthenticated || !savedUser) {
            return false;
        }
        
        currentUser = JSON.parse(savedUser);
        console.log(`Пользователь: ${currentUser.name} (${currentUser.type})`);
        return true;
        
    } catch (error) {
        console.error('Ошибка проверки авторизации:', error);
        return false;
    }
}

// Перенаправление на страницу входа
function redirectToLogin() {
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
}

// Показать ошибку и продолжить
function showErrorAndContinue(message) {
    console.error(message);
    
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.getElementById('mainContainer');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';
}

// ============ FIREBASE ИНИЦИАЛИЗАЦИЯ ============

// Инициализация Firebase
async function initializeFirebase() {
    if (isFirebaseInitialized) {
        console.log('Firebase уже инициализирован');
        return true;
    }
    
    console.log('Пробуем инициализировать Firebase...');
    
    // Проверяем наличие Firebase SDK
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не загружен');
        return false;
    }
    
    try {
        // Проверяем, инициализировано ли приложение Firebase
        if (firebase.apps.length === 0) {
            console.warn('Firebase приложение не инициализировано');
            return false;
        }
        
        // Получаем экземпляры
        firestore = firebase.firestore();
        auth = firebase.auth();
        
        console.log('Firebase app найден');
        
        // Пробуем анонимную авторизацию
        if (!auth.currentUser) {
            try {
                await auth.signInAnonymously();
                console.log('Анонимный вход выполнен');
            } catch (authError) {
                console.warn('Не удалось выполнить анонимный вход:', authError.message);
            }
        } else {
            console.log('Уже авторизован');
        }
        
        isFirebaseInitialized = true;
        console.log('Firebase успешно инициализирован');
        return true;
        
    } catch (error) {
        console.warn('Не удалось инициализировать Firebase:', error.message);
        isFirebaseInitialized = false;
        return false;
    }
}

// Загрузка заявок из Firebase
async function loadRepairRequestsFromFirebase() {
    if (!firestore || !isFirebaseInitialized) {
        console.log('Firebase недоступен, загружаем локальные данные');
        await loadRepairRequestsFromLocal();
        return;
    }
    
    try {
        console.log('Загрузка данных из Firestore...');
        
        const snapshot = await firestore.collection('repair_requests').get();
        
        const firebaseRequests = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            synced: true,
            firebaseId: doc.id
        }));
        
        console.log('Загружено заявок из Firestore:', firebaseRequests.length);
        
        // Объединяем с локальными данными
        const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
        repairRequests = mergeRequests(firebaseRequests, localRequests);
        
        // Сохраняем локально
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());
        
        // Обновляем интерфейс
        renderRepairTable();
        updateSummary();
        
        return true;
        
    } catch (error) {
        console.error('Ошибка загрузки из Firebase:', error);
        showNotification('Ошибка загрузки из облака', 'error');
        await loadRepairRequestsFromLocal();
        return false;
    }
}

// Слияние данных Firebase и локальных
function mergeRequests(firebaseRequests, localRequests) {
    const merged = [...firebaseRequests];
    const firebaseIds = new Set(firebaseRequests.map(r => r.id));
    
    // Добавляем локальные заявки, которых нет в Firebase
    localRequests.forEach(localRequest => {
        if (!firebaseIds.has(localRequest.id) && !localRequest.synced) {
            merged.push({
                ...localRequest,
                synced: false
            });
        }
    });
    
    // Удаляем дубликаты
    const uniqueRequests = [];
    const seenIds = new Set();
    
    merged.forEach(request => {
        const id = request.firebaseId || request.id;
        if (!seenIds.has(id)) {
            seenIds.add(id);
            uniqueRequests.push(request);
        }
    });
    
    return uniqueRequests;
}

// Загрузка локальных данных
async function loadRepairRequestsFromLocal() {
    try {
        const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
        repairRequests = localRequests;
        
        console.log('Загружено локальных заявок:', repairRequests.length);
        
        renderRepairTable();
        updateSummary();
        
        return repairRequests;
    } catch (error) {
        console.error('Ошибка загрузки локальных данных:', error);
        repairRequests = [];
        return [];
    }
}

// ============ ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ============

// Инициализация DOM элементов
function initDOMElements() {
    repairForm = document.getElementById('repairForm');
    invNumberSelect = document.getElementById('invNumber');
    equipmentNameInput = document.getElementById('equipmentName');
    locationInput = document.getElementById('location');
    modelInput = document.getElementById('model');
    machineNumberInput = document.getElementById('machineNumber');
    authorInput = document.getElementById('author');
    clearBtn = document.getElementById('clearBtn');
    repairTableBody = document.getElementById('repairTableBody');
    searchInput = document.getElementById('searchInput');
    statusFilter = document.getElementById('statusFilter');
    locationFilter = document.getElementById('locationFilter');
    monthFilter = document.getElementById('monthFilter');
    totalRequestsElement = document.getElementById('totalRequests');
    pendingRequestsElement = document.getElementById('pendingRequests');
    completedRequestsElement = document.getElementById('completedRequests');
    totalDowntimeElement = document.getElementById('totalDowntime');
}

// Настройка интерфейса по роли
function setupRoleBasedUI() {
    if (!currentUser) return;
    
    // Автозаполнение автора для авторов заявок
    if (currentUser.type === 'author' && authorInput) {
        authorInput.value = currentUser.name;
        authorInput.readOnly = true;
        authorInput.style.backgroundColor = '#f0f0f0';
    }
    
    // Для ремонтной службы скрываем форму добавления
    if (currentUser.type === 'repair') {
        const formSection = document.getElementById('formSection');
        const searchFilter = document.getElementById('searchFilter');
        
        if (formSection) formSection.style.display = 'none';
        if (searchFilter) searchFilter.style.display = 'none';
    }
    
    window.currentUser = currentUser;
}

// Показать информацию о пользователе
function showUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userInfo && currentUser) {
        userInfo.style.display = 'flex';
        if (userName) userName.textContent = currentUser.name;
        if (userRole) userRole.textContent = `(${getRoleName(currentUser.type)})`;
    }
}

// Получить название роли
function getRoleName(roleType) {
    const roles = {
        'admin': 'Администратор',
        'author': 'Автор заявки',
        'repair': 'Ремонтная служба'
    };
    return roles[roleType] || 'Пользователь';
}

// Настройка интерфейса
function setupInterface() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
    
    // Настраиваем события
    if (invNumberSelect) {
        invNumberSelect.addEventListener('change', handleInvNumberChange);
    }
    
    if (repairForm) {
        repairForm.addEventListener('submit', handleFormSubmit);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    if (searchInput) searchInput.addEventListener('input', debounce(applyFilters, 300));
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (locationFilter) locationFilter.addEventListener('change', applyFilters);
    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
    
    // События сети
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    checkConnection();
    updateDBButtonInfo();
}

// Обработчик появления сети
function handleOnline() {
    console.log('Интернет появился');
    isOnline = true;
    showNotification('Соединение восстановлено', 'success');
    checkConnection();
}

// Обработчик потери сети
function handleOffline() {
    console.log('Интернет пропал');
    isOnline = false;
    showNotification('Потеряно соединение с интернетом', 'warning');
    checkConnection();
}

// Проверка соединения
function checkConnection() {
    isOnline = navigator.onLine;
    
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        if (isOnline) {
            connectionStatus.textContent = isFirebaseInitialized ? 'Онлайн (синхронизация)' : 'Онлайн (локально)';
            connectionStatus.className = 'connection-status';
        } else {
            connectionStatus.textContent = 'Оффлайн';
            connectionStatus.className = 'connection-status offline';
        }
    }
}

// ============ РАБОТА С ФОРМОЙ ============

// Изменение инвентарного номера
function handleInvNumberChange() {
    const selectedInvNumber = this.value;
    
    if (selectedInvNumber) {
        const equipment = equipmentDatabase.find(item => item.invNumber === selectedInvNumber);
        
        if (equipment) {
            if (equipmentNameInput) equipmentNameInput.value = equipment.name;
            if (locationInput) locationInput.value = equipment.location;
            if (modelInput) modelInput.value = equipment.model;
            
            if (machineNumberInput && equipment.machineNumber && equipment.machineNumber !== '-') {
                machineNumberInput.value = equipment.machineNumber;
            } else if (machineNumberInput) {
                machineNumberInput.value = '';
            }
        }
    } else {
        if (equipmentNameInput) equipmentNameInput.value = '';
        if (locationInput) locationInput.value = '';
        if (modelInput) modelInput.value = '';
        if (machineNumberInput) machineNumberInput.value = '';
    }
}

// Отправка формы
async function handleFormSubmit(e) {
    e.preventDefault();
    
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin' && currentUser.type !== 'author') {
        showNotification('У вас нет прав для добавления заявок', 'error');
        return;
    }
    
    if (!validateForm()) {
        return;
    }
    
    try {
        const newRequest = createRequestFromForm();
        await addRepairRequest(newRequest);
        
        renderRepairTable();
        updateSummary();
        clearForm();
        
    } catch (error) {
        console.error('Ошибка при добавлении заявки:', error);
        showNotification('Ошибка при добавлении заявки: ' + error.message, 'error');
    }
}

// Валидация формы
function validateForm() {
    const invNumber = document.getElementById('invNumber')?.value;
    if (!invNumber) {
        showNotification('Пожалуйста, выберите инвентарный номер', 'warning');
        document.getElementById('invNumber')?.focus();
        return false;
    }
    
    const faultDescription = document.getElementById('faultDescription')?.value;
    if (!faultDescription || faultDescription.trim().length < 5) {
        showNotification('Пожалуйста, подробно опишите неисправность (минимум 5 символов)', 'warning');
        document.getElementById('faultDescription')?.focus();
        return false;
    }
    
    return true;
}

// Создание заявки из формы
function createRequestFromForm() {
    let authorName = currentUser.name;
    if (authorInput && !authorInput.readOnly && authorInput.value.trim()) {
        authorName = authorInput.value.trim();
    }
    
    return {
        date: document.getElementById('date')?.value || '',
        time: document.getElementById('time')?.value || '',
        author: authorName,
        location: document.getElementById('location')?.value || '',
        invNumber: document.getElementById('invNumber')?.value || '',
        equipmentName: document.getElementById('equipmentName')?.value || '',
        model: document.getElementById('model')?.value || '',
        machineNumber: document.getElementById('machineNumber')?.value || '-',
        faultDescription: document.getElementById('faultDescription')?.value || '',
        status: 'pending',
        downtimeCount: 0,
        downtimeHours: 0,
        productionItem: document.getElementById('productionItem')?.value || '-',
        createdBy: currentUser.name,
        deviceId: deviceId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// Добавить заявку (с синхронизацией)
async function addRepairRequest(request) {
    // Генерируем локальный ID
    const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    request.id = localId;
    request.synced = false;
    
    // Добавляем в локальный массив
    repairRequests.unshift(request);
    
    // Сохраняем локально
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    // Обновляем интерфейс
    renderRepairTable();
    updateSummary();
    
    // Пытаемся синхронизировать с Firebase
    if (isFirebaseInitialized && firestore) {
        try {
            const requestToSave = { ...request };
            delete requestToSave.id;
            delete requestToSave.synced;
            
            const docRef = await firestore.collection('repair_requests').add(requestToSave);
            
            // Обновляем локальную запись с Firebase ID
            const index = repairRequests.findIndex(r => r.id === localId);
            if (index !== -1) {
                repairRequests[index].firebaseId = docRef.id;
                repairRequests[index].synced = true;
                repairRequests[index].id = docRef.id;
                
                // Сохраняем обновленные данные
                localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
                
                showNotification('Заявка добавлена и синхронизирована!', 'success');
            }
            
        } catch (error) {
            console.error('Ошибка сохранения в Firebase:', error);
            showNotification('Заявка добавлена локально. Синхронизация при восстановлении связи.', 'warning');
        }
    } else {
        showNotification('Заявка добавлена локально. Синхронизация при восстановлении связи.', 'warning');
    }
    
    return request;
}

// Очистка формы
function clearForm() {
    if (!repairForm) return;
    
    repairForm.reset();
    
    if (equipmentNameInput) equipmentNameInput.value = '';
    if (locationInput) locationInput.value = '';
    if (modelInput) modelInput.value = '';
    if (machineNumberInput) machineNumberInput.value = '';
    
    if (authorInput && currentUser) {
        if (currentUser.type === 'author') {
            authorInput.value = currentUser.name;
        } else {
            authorInput.value = '';
        }
    }
    
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
    
    const invSelect = document.getElementById('invNumber');
    if (invSelect) {
        invSelect.selectedIndex = 0;
        handleInvNumberChange.call(invSelect);
    }
    
    const invNumberSearch = document.getElementById('invNumberSearch');
    if (invNumberSearch) {
        invNumberSearch.value = '';
        const options = invSelect.options;
        for (let i = 0; i < options.length; i++) {
            options[i].style.display = '';
        }
    }
}

// ============ РАБОТА С ТАБЛИЦЕЙ ============

// Отобразить таблицу заявок
function renderRepairTable(filteredRequests = null) {
    if (!repairTableBody) return;
    
    const requestsToRender = filteredRequests || repairRequests;
    
    requestsToRender.sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateB - dateA;
    });
    
    repairTableBody.innerHTML = '';
    
    if (requestsToRender.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="15" style="text-align: center; padding: 30px; color: #666;">
                <strong>Нет заявок на ремонт</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">${isFirebaseInitialized ? 'Создайте первую заявку' : 'Ожидание подключения к облаку...'}</p>
            </td>
        `;
        repairTableBody.appendChild(emptyRow);
        return;
    }
    
    requestsToRender.forEach(request => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const startDateTime = formatDateTime(request.date, request.time);
        
        let endDateTimeDisplay = '-';
        if (request.repairEndDate && request.repairEndTime && request.status === 'completed') {
            endDateTimeDisplay = formatDateTime(request.repairEndDate, request.repairEndTime);
        } else if (request.status === 'completed') {
            endDateTimeDisplay = 'Завершено';
        }
        
        let downtimeHours = request.downtimeHours || 0;
        if (request.status === 'completed' && request.repairEndDate && request.repairEndTime) {
            downtimeHours = calculateDowntimeHours(
                request.date, 
                request.time, 
                request.repairEndDate, 
                request.repairEndTime
            );
        }
        
        const statusText = request.status === 'pending' ? 'В ремонте' : 'Завершено';
        const statusClass = request.status === 'pending' ? 'status-pending' : 'status-completed';
        
        let actionButtons = '';
        
        if (currentUser && currentUser.type === 'admin') {
            actionButtons += `<button class="btn-delete" onclick="deleteRequest('${request.id}')" title="Удалить">Удалить</button>`;
        }
        
        if (request.status === 'pending' && currentUser && 
            (currentUser.type === 'admin' || currentUser.type === 'repair')) {
            actionButtons += `<button class="btn-complete" onclick="completeRequest('${request.id}')" title="Завершить ремонт">Завершить</button>`;
        }
        
        if (!actionButtons) {
            actionButtons = '<span style="color: #999; font-size: 12px;">Нет доступных действий</span>';
        }
        
        row.innerHTML = `
            <td>${startDateTime}</td>
            <td>${request.author}</td>
            <td>${request.location}</td>
            <td>${request.invNumber}</td>
            <td title="${request.equipmentName}">${truncateText(request.equipmentName, 30)}</td>
            <td>${request.model}</td>
            <td>${request.machineNumber}</td>
            <td title="${request.faultDescription}">${truncateText(request.faultDescription, 40)}</td>
            <td>${endDateTimeDisplay}</td>
            <td class="${statusClass}">${statusText}</td>
            <td>${request.downtimeCount}</td>
            <td>${downtimeHours.toFixed(1)} ч</td>
            <td>${request.productionItem}</td>
            <td class="actions-cell">${actionButtons}</td>
        `;
        
        repairTableBody.appendChild(row);
    });
}

// Обновление сводной информации
function updateSummary() {
    const totalRequests = repairRequests.length;
    const pendingRequests = repairRequests.filter(req => req.status === 'pending').length;
    const completedRequests = repairRequests.filter(req => req.status === 'completed').length;
    
    const totalDowntime = repairRequests.reduce((sum, req) => sum + (req.downtimeHours || 0), 0);
    
    if (totalRequestsElement) totalRequestsElement.textContent = totalRequests;
    if (pendingRequestsElement) pendingRequestsElement.textContent = pendingRequests;
    if (completedRequestsElement) completedRequestsElement.textContent = completedRequests;
    if (totalDowntimeElement) totalDowntimeElement.textContent = totalDowntime.toFixed(1) + ' ч';
}

// ============ ФИЛЬТРАЦИЯ ============

// Применить фильтры
function applyFilters() {
    let filtered = [...repairRequests];
    
    const searchTerm = searchInput?.value.toLowerCase() || '';
    if (searchTerm) {
        filtered = filtered.filter(request => 
            (request.equipmentName && request.equipmentName.toLowerCase().includes(searchTerm)) ||
            (request.faultDescription && request.faultDescription.toLowerCase().includes(searchTerm)) ||
            (request.invNumber && request.invNumber.toLowerCase().includes(searchTerm)) ||
            (request.location && request.location.toLowerCase().includes(searchTerm)) ||
            (request.author && request.author.toLowerCase().includes(searchTerm)) ||
            (request.machineNumber && request.machineNumber.toLowerCase().includes(searchTerm))
        );
    }
    
    const statusValue = statusFilter?.value || 'all';
    if (statusValue !== 'all') {
        filtered = filtered.filter(request => request.status === statusValue);
    }
    
    const locationValue = locationFilter?.value || 'all';
    if (locationValue !== 'all') {
        filtered = filtered.filter(request => request.location === locationValue);
    }
    
    const monthValue = monthFilter?.value;
    if (monthValue) {
        filtered = filtered.filter(request => {
            try {
                const requestDate = new Date(request.date);
                const requestMonth = requestDate.getFullYear() + '-' + 
                                    (requestDate.getMonth() + 1).toString().padStart(2, '0');
                return requestMonth === monthValue;
            } catch (error) {
                return false;
            }
        });
    }
    
    renderRepairTable(filtered);
}

// ============ ЗАГРУЗКА БАЗЫ ОБОРУДОВАНИЯ ============

// Загрузка базы оборудования
async function loadEquipmentDatabase(forceUpdate = false) {
    console.log('Загрузка базы оборудования...');
    
    try {
        const lastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
        const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
        
        // Проверяем, нужно ли обновлять
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const shouldUpdate = forceUpdate || 
                            !lastUpdated || 
                            new Date(lastUpdated) < oneDayAgo ||
                            !savedData || 
                            savedData.length === 0;
        
        if (shouldUpdate && isOnline) {
            console.log('Пытаемся загрузить базу оборудования с сервера...');
            
            // Пробуем несколько возможных URL
            const urls = [
                `https://raw.githubusercontent.com/aitof-stack/repair-journal/main/data/equipment_database.csv?t=${Date.now()}`,
                `https://raw.githubusercontent.com/aitof-stack/repair-journal/main/equipment_database.csv?t=${Date.now()}`,
                `https://raw.githubusercontent.com/aitof-stack/repair-journal/refs/heads/main/data/equipment_database.csv?t=${Date.now()}`
            ];
            
            let success = false;
            
            for (const url of urls) {
                try {
                    console.log('Пробуем URL:', url);
                    const response = await fetch(url, {
                        mode: 'cors',
                        cache: 'no-cache',
                        headers: { 'Accept': 'text/csv' }
                    });
                    
                    if (response.ok) {
                        const csvContent = await response.text();
                        
                        if (csvContent && csvContent.trim().length > 0) {
                            equipmentDatabase = parseCSV(csvContent);
                            
                            if (equipmentDatabase.length === 0) {
                                equipmentDatabase = getDefaultEquipmentDatabase();
                            }
                            
                            localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
                            localStorage.setItem(STORAGE_KEYS.DB_LAST_UPDATED, new Date().toISOString());
                            
                            console.log(`База оборудования загружена: ${equipmentDatabase.length} записей`);
                            
                            if (forceUpdate) {
                                showNotification(`База обновлена (${equipmentDatabase.length} записей)`, 'success');
                            }
                            
                            success = true;
                            break;
                        }
                    }
                } catch (fetchError) {
                    console.warn(`Ошибка загрузки с URL ${url}:`, fetchError.message);
                }
            }
            
            if (!success) {
                throw new Error('Не удалось загрузить с любого из доступных URL');
            }
            
        } else if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
            console.log('Используем локальную базу оборудования:', equipmentDatabase.length, 'записей');
        } else {
            equipmentDatabase = getDefaultEquipmentDatabase();
            console.log('Используем базу по умолчанию (нет локальной):', equipmentDatabase.length, 'записей');
        }
        
    } catch (error) {
        console.error('Критическая ошибка загрузки базы оборудования:', error);
        equipmentDatabase = getDefaultEquipmentDatabase();
        showNotification('Ошибка загрузки базы оборудования', 'error');
    }
    
    populateInvNumberSelect();
    populateLocationFilter();
    updateDBButtonInfo();
    
    return equipmentDatabase.length;
}

// Парсинг CSV
function parseCSV(csvContent) {
    const equipment = [];
    const lines = csvContent.split('\n');
    
    console.log('Общее количество строк CSV:', lines.length);
    
    const firstLine = lines[0] || '';
    let delimiter = ';';
    
    if (firstLine.includes(';')) delimiter = ';';
    else if (firstLine.includes(',')) delimiter = ',';
    else if (firstLine.includes('\t')) delimiter = '\t';
    
    let startIndex = 0;
    if (lines[0] && (
        lines[0].toLowerCase().includes('участок') ||
        lines[0].toLowerCase().includes('инв') ||
        lines[0].toLowerCase().includes('наименование')
    )) {
        startIndex = 1;
    }
    
    for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        try {
            const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
            
            if (parts.length >= 3) {
                const item = {
                    location: parts[0] || '',
                    invNumber: parts[1] || '',
                    name: parts[2] || '',
                    model: parts.length > 3 ? parts[3] : '-',
                    machineNumber: parts.length > 4 ? parts[4] : '-'
                };
                
                if (item.invNumber && item.name && item.name.length > 2) {
                    if (!item.name.toLowerCase().includes('наименование') &&
                        !item.name.toLowerCase().includes('оборудование')) {
                        equipment.push(item);
                    }
                }
            }
        } catch (error) {
            console.warn(`Ошибка парсинга строки ${i + 1}:`, error);
            continue;
        }
    }
    
    console.log('Успешно распарсено записей:', equipment.length);
    
    if (equipment.length === 0 && lines.length > 1) {
        return getDefaultEquipmentDatabase();
    }
    
    return equipment;
}

// База оборудования по умолчанию
function getDefaultEquipmentDatabase() {
    return [
        { location: "701", invNumber: "11323", name: "Автомат холод штамповки", model: "-", machineNumber: "СК-11323" },
        { location: "735", invNumber: "28542", name: "Токарный автомобиль (СМТ) (СК6136/750)", model: "КЕ36750", machineNumber: "ТС-28542" },
        { location: "717", invNumber: "7257", name: "Токарный автомат", model: "1269M-6", machineNumber: "А-7257" },
        { location: "702", invNumber: "11324", name: "Пресс гидравлический", model: "ПГ-100", machineNumber: "ПГ-11324" },
        { location: "735", invNumber: "28543", name: "Токарный станок", model: "1К62", machineNumber: "ТС-28543" },
        { location: "717", invNumber: "7258", name: "Фрезерный станок", model: "6Р82", machineNumber: "ФС-7258" },
        { location: "701", invNumber: "11325", name: "Сверлильный станок", model: "2Н125", machineNumber: "СС-11325" },
        { location: "702", invNumber: "11326", name: "Шлифовальный станок", model: "3Б722", machineNumber: "ШС-11326" }
    ];
}

// Заполнение выпадающего списка инвентарных номеров
function populateInvNumberSelect() {
    if (!invNumberSelect) return;
    
    const currentValue = invNumberSelect.value;
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    if (equipmentDatabase.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "База оборудования пуста...";
        option.disabled = true;
        invNumberSelect.appendChild(option);
        
        if (isOnline) {
            const updateOption = document.createElement('option');
            updateOption.value = "";
            updateOption.textContent = "Нажмите 'Обновить базу'";
            updateOption.disabled = true;
            invNumberSelect.appendChild(updateOption);
        }
        return;
    }
    
    equipmentDatabase.sort((a, b) => {
        const numA = parseInt(a.invNumber) || 0;
        const numB = parseInt(b.invNumber) || 0;
        return numA - numB;
    });
    
    const uniqueEquipment = [];
    const seen = new Set();
    
    equipmentDatabase.forEach(equipment => {
        if (!seen.has(equipment.invNumber) && equipment.invNumber) {
            seen.add(equipment.invNumber);
            uniqueEquipment.push(equipment);
        }
    });
    
    uniqueEquipment.forEach(equipment => {
        const option = document.createElement('option');
        option.value = equipment.invNumber;
        
        const shortName = equipment.name.length > 40 
            ? equipment.name.substring(0, 40) + '...' 
            : equipment.name;
        
        option.textContent = `${equipment.invNumber} - ${shortName}`;
        option.title = `${equipment.location} | ${equipment.name} (${equipment.model}) | Станок: ${equipment.machineNumber}`;
        invNumberSelect.appendChild(option);
    });
    
    if (currentValue) {
        invNumberSelect.value = currentValue;
        handleInvNumberChange.call(invNumberSelect);
    }
    
    updateDBButtonInfo();
}

// Заполнение фильтра участков
function populateLocationFilter() {
    if (!locationFilter) return;
    
    const currentValue = locationFilter.value;
    locationFilter.innerHTML = '<option value="all">Все участки</option>';
    
    if (equipmentDatabase.length === 0) return;
    
    const locationsSet = new Set();
    equipmentDatabase.forEach(item => {
        if (item.location && item.location.trim()) {
            locationsSet.add(item.location.trim());
        }
    });
    
    const locations = Array.from(locationsSet);
    locations.sort((a, b) => {
        const numA = parseInt(a) || 0;
        const numB = parseInt(b) || 0;
        return numA - numB;
    });
    
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
    
    if (currentValue && currentValue !== 'all') {
        locationFilter.value = currentValue;
    }
}

// Обновить информацию о базе на кнопке
function updateDBButtonInfo() {
    const updateBtn = document.querySelector('.btn-load');
    if (!updateBtn) return;
    
    const lastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
    
    if (savedData && savedData.length > 0) {
        const count = savedData.length;
        const date = lastUpdated ? new Date(lastUpdated).toLocaleDateString('ru-RU') : 'неизвестно';
        updateBtn.title = `База оборудования: ${count} записей (обновлено: ${date})`;
        updateBtn.textContent = `🔄 База: ${count} записей`;
    } else {
        updateBtn.title = 'База оборудования не загружена';
        updateBtn.textContent = '🔄 Обновить базу';
    }
}

// ============ ГЛОБАЛЬНЫЕ ФУНКЦИИ ============

// Проверка авторизации для глобальных функций
function checkAuth() {
    const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    
    if (!isAuthenticated || !savedUser) {
        redirectToLogin();
        return false;
    }
    
    try {
        currentUser = JSON.parse(savedUser);
        return true;
    } catch (error) {
        console.error('Ошибка парсинга пользователя:', error);
        redirectToLogin();
        return false;
    }
}

// Синхронизация всех данных
window.syncAllData = async function() {
    if (!checkAuth()) return;
    
    showNotification('Начата синхронизация данных...', 'info');
    
    try {
        // Инициализируем Firebase если нужно
        if (!isFirebaseInitialized) {
            const success = await initializeFirebase();
            if (!success) {
                showNotification('Firebase не инициализирован. Проверьте соединение.', 'error');
                return;
            }
        }
        
        // Загружаем свежие данные из Firebase
        await loadRepairRequestsFromFirebase();
        
        // Обновляем базу оборудования
        await loadEquipmentDatabase(true);
        
        showNotification('Синхронизация завершена успешно!', 'success');
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации: ' + error.message, 'error');
    }
};

// Обновить базу оборудования
window.updateEquipmentDB = async function() {
    if (!checkAuth()) return;
    
    if (isDBLoading) {
        showNotification('База уже загружается...', 'warning');
        return;
    }
    
    isDBLoading = true;
    
    const updateBtn = document.querySelector('.btn-load');
    const originalText = updateBtn ? updateBtn.textContent : '🔄 Обновить базу';
    
    if (updateBtn) {
        updateBtn.textContent = '🔄 Загрузка...';
        updateBtn.disabled = true;
        updateBtn.style.opacity = '0.7';
    }
    
    try {
        await loadEquipmentDatabase(true);
        showNotification(`База обновлена! Загружено ${equipmentDatabase.length} записей`, 'success');
    } catch (error) {
        console.error('Ошибка обновления базы:', error);
        showNotification('Ошибка обновления базы: ' + error.message, 'error');
    } finally {
        isDBLoading = false;
        if (updateBtn) {
            updateBtn.textContent = originalText;
            updateBtn.disabled = false;
            updateBtn.style.opacity = '1';
        }
    }
};

// Экспорт заявок
window.exportRepairData = function() {
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin') {
        showNotification('Только администраторы могут экспортировать данные', 'error');
        return;
    }
    
    if (repairRequests.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    let csvContent = "ID;Дата;Время;Автор;Участок;Инв.номер;Оборудование;Модель;Номер станка;Неисправность;Дата окончания;Время окончания;Статус;Кол-во простоев;Время простоя;Номенклатура;Создано;Обновлено;Firebase ID\n";
    
    repairRequests.forEach(request => {
        csvContent += `"${request.id || ''}";"${request.date || ''}";"${request.time || ''}";"${request.author || ''}";"${request.location || ''}";"${request.invNumber || ''}";"${request.equipmentName || ''}";"${request.model || ''}";"${request.machineNumber || ''}";"${request.faultDescription || ''}";"${request.repairEndDate || ''}";"${request.repairEndTime || ''}";"${request.status || ''}";"${request.downtimeCount || 0}";"${request.downtimeHours || 0}";"${request.productionItem || ''}";"${request.createdAt || ''}";"${request.updatedAt || ''}";"${request.firebaseId || ''}"\n`;
    });
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `заявки_на_ремонт_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showNotification(`Экспортировано ${repairRequests.length} заявок`, 'success');
};

// Удалить заявку
window.deleteRequest = async function(id) {
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        // Находим заявку
        const request = repairRequests.find(req => req.id === id || req.firebaseId === id);
        
        if (!request) {
            showNotification('Заявка не найдена', 'error');
            return;
        }
        
        // Удаляем из Firebase если есть firebaseId
        if (request.firebaseId && isFirebaseInitialized && firestore) {
            try {
                await firestore.collection('repair_requests').doc(request.firebaseId).delete();
                console.log('Заявка удалена из Firebase:', request.firebaseId);
            } catch (firebaseError) {
                console.warn('Не удалось удалить заявку из Firebase:', firebaseError.message);
            }
        }
        
        // Удаляем локально
        repairRequests = repairRequests.filter(req => req.id !== id && req.firebaseId !== id);
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        
        // Обновляем интерфейс
        renderRepairTable();
        updateSummary();
        
        showNotification('Заявка удалена', 'success');
        
    } catch (error) {
        console.error('Ошибка при удалении заявки:', error);
        showNotification('Ошибка при удалении заявки', 'error');
    }
};

// Завершить ремонт
window.completeRequest = async function(id) {
    const request = repairRequests.find(req => req.id === id || req.firebaseId === id);
    
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }
    
    if (request.status === 'completed') {
        showNotification('Заявка уже завершена', 'warning');
        return;
    }
    
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('ru-RU', {hour12: false, hour: '2-digit', minute:'2-digit'});
    
    const repairEndDate = prompt('Введите дату окончания ремонта (ГГГГ-ММ-ДД):', currentDate);
    if (!repairEndDate) return;
    
    const repairEndTime = prompt('Введите время окончания ремонта (ЧЧ:ММ):', currentTime);
    if (!repairEndTime) return;
    
    const downtimeCount = prompt('Введите количество простоев:', '1') || '1';
    
    const downtimeHours = calculateDowntimeHours(
        request.date, 
        request.time, 
        repairEndDate, 
        repairEndTime
    );
    
    // Обновляем заявку
    request.status = 'completed';
    request.repairEndDate = repairEndDate;
    request.repairEndTime = repairEndTime;
    request.downtimeCount = parseInt(downtimeCount) || 1;
    request.downtimeHours = downtimeHours;
    request.updatedAt = new Date().toISOString();
    request.completedBy = currentUser.name;
    request.synced = false;
    
    // Сохраняем локально
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    // Синхронизируем с Firebase
    if (request.firebaseId && isFirebaseInitialized && firestore) {
        try {
            const updateData = {
                status: 'completed',
                repairEndDate: repairEndDate,
                repairEndTime: repairEndTime,
                downtimeCount: parseInt(downtimeCount) || 1,
                downtimeHours: downtimeHours,
                updatedAt: new Date().toISOString(),
                completedBy: currentUser.name
            };
            
            await firestore.collection('repair_requests').doc(request.firebaseId).update(updateData);
            
            request.synced = true;
            showNotification('Ремонт завершен и синхронизирован!', 'success');
        } catch (error) {
            console.error('Ошибка обновления в Firebase:', error);
            showNotification('Ремонт завершен локально. Синхронизация при восстановлении связи.', 'warning');
        }
    } else {
        showNotification('Ремонт завершен локально', 'success');
    }
    
    renderRepairTable();
    updateSummary();
};

// Выход из системы
window.logout = function() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        // Отписываемся от обновлений
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }
        
        // Выход из Firebase
        if (auth && auth.currentUser) {
            auth.signOut();
        }
        
        // Сбрасываем флаги
        isFirebaseInitialized = false;
        
        // Удаляем данные пользователя
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
        
        redirectToLogin();
    }
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

// Дебаунс
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Вычисление времени простоя
function calculateDowntimeHours(startDate, startTime, endDate, endTime) {
    if (!startDate || !startTime || !endDate || !endTime) {
        return 0;
    }
    
    try {
        const startDateTime = new Date(`${startDate}T${startTime}`);
        const endDateTime = new Date(`${endDate}T${endTime}`);
        
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            return 0;
        }
        
        if (endDateTime < startDateTime) {
            return 0;
        }
        
        const diffMs = endDateTime - startDateTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        return Math.max(0, Math.round(diffHours * 10) / 10);
    } catch (error) {
        console.error('Ошибка вычисления времени простоя:', error);
        return 0;
    }
}

// Форматировать дату и время
function formatDateTime(dateString, timeString = '') {
    if (!dateString || dateString === '-' || dateString === 'Завершено') {
        return dateString;
    }
    
    try {
        const date = new Date(dateString + (timeString ? 'T' + timeString : ''));
        
        if (isNaN(date.getTime())) {
            return dateString + (timeString ? ' ' + timeString : '');
        }
        
        const formattedDate = date.toLocaleDateString('ru-RU');
        
        if (timeString) {
            return `${formattedDate} ${timeString}`;
        }
        
        return formattedDate;
    } catch (error) {
        console.error('Ошибка форматирования даты:', error);
        return dateString + (timeString ? ' ' + timeString : '');
    }
}

// Обрезать текст
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Показать уведомление
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = 'notification ' + type;
    
    notification.style.display = 'block';
    notification.style.opacity = '1';
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
            notification.style.opacity = '1';
        }, 300);
    }, 3000);
}

// Настройка поиска в выпадающем списке
function setupSearchableSelect() {
    const invNumberSearch = document.getElementById('invNumberSearch');
    const invNumberSelect = document.getElementById('invNumber');
    
    if (invNumberSearch && invNumberSelect) {
        invNumberSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const options = invNumberSelect.options;
            
            for (let i = 0; i < options.length; i++) {
                const option = options[i];
                const text = option.textContent.toLowerCase();
                option.style.display = text.includes(searchTerm) ? '' : 'none';
            }
            
            for (let i = 0; i < options.length; i++) {
                if (options[i].style.display !== 'none') {
                    invNumberSelect.selectedIndex = i;
                    handleInvNumberChange.call(invNumberSelect);
                    break;
                }
            }
        });
        
        const searchContainer = invNumberSearch.parentElement;
        searchContainer.style.position = 'relative';
        
        const clearSearchBtn = document.createElement('button');
        clearSearchBtn.innerHTML = '×';
        clearSearchBtn.style.cssText = `
            position: absolute;
            right: 5px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            font-size: 20px;
            cursor: pointer;
            color: #999;
            display: none;
            z-index: 10;
            min-height: 20px;
            min-width: 20px;
        `;
        
        clearSearchBtn.addEventListener('click', function() {
            invNumberSearch.value = '';
            invNumberSelect.selectedIndex = 0;
            handleInvNumberChange.call(invNumberSelect);
            
            const options = invNumberSelect.options;
            for (let i = 0; i < options.length; i++) {
                options[i].style.display = '';
            }
            
            this.style.display = 'none';
        });
        
        invNumberSearch.addEventListener('input', function() {
            clearSearchBtn.style.display = this.value ? 'block' : 'none';
        });
        
        searchContainer.appendChild(clearSearchBtn);
    }
}

// ============ ОБРАБОТКА ОШИБОК ============

window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    showNotification('Произошла ошибка в приложении', 'error');
});

window.addEventListener('beforeunload', function() {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
