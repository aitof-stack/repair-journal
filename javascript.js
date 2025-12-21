// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ С АВТОМАТИЧЕСКОЙ СИНХРОНИЗАЦИЕЙ

// Константы
const APP_VERSION = '2.1.0';
const APP_NAME = 'Ремонтный журнал';
const EQUIPMENT_DB_URL = 'https://raw.githubusercontent.com/aitof-stack/repair-journal/main/data/equipment_database.csv';
const SYNC_INTERVAL = 30000; // 30 секунд для автоматической синхронизации
const STORAGE_KEYS = {
    EQUIPMENT_DB: 'repair_journal_equipmentDatabase',
    REPAIR_REQUESTS: 'repair_journal_repairRequests',
    CURRENT_USER: 'repair_journal_currentUser',
    AUTH_STATUS: 'repair_journal_isAuthenticated',
    DB_LAST_UPDATED: 'repair_journal_equipmentDBLastUpdated',
    LAST_SYNC: 'repair_journal_lastSync',
    DEVICE_ID: 'repair_journal_deviceId',
    APP_VERSION: 'repair_journal_appVersion'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = true;
let isDBLoading = false;
let syncInterval = null;

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============ ИНИЦИАЛИЗАЦИЯ ============

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
    
    // Проверяем версию приложения
    checkAppVersion();
    
    // Генерируем уникальный ID устройства
    generateDeviceId();
    
    // Проверяем авторизацию
    checkAuthAndInit();
});

// Проверка версии приложения
function checkAppVersion() {
    const savedVersion = localStorage.getItem(STORAGE_KEYS.APP_VERSION);
    
    if (!savedVersion || savedVersion !== APP_VERSION) {
        // Новая версия - очищаем некоторые данные если нужно
        console.log(`Обновление версии: ${savedVersion || 'нет'} -> ${APP_VERSION}`);
        localStorage.setItem(STORAGE_KEYS.APP_VERSION, APP_VERSION);
        
        // Принудительное обновление базы оборудования
        localStorage.removeItem(STORAGE_KEYS.DB_LAST_UPDATED);
    }
}

// Генерация ID устройства
function generateDeviceId() {
    let deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
    }
    console.log('ID устройства:', deviceId);
    return deviceId;
}

// Проверка авторизации и инициализация
function checkAuthAndInit() {
    const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
    const savedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    
    if (!isAuthenticated || !savedUser) {
        redirectToLogin();
        return;
    }
    
    currentUser = savedUser;
    console.log(`Пользователь: ${currentUser.name} (${currentUser.type})`);
    
    // Инициализация приложения
    initApp();
}

// Основная функция инициализации
function initApp() {
    console.log(`${APP_NAME} v${APP_VERSION}`);
    
    // Проверяем авторизацию еще раз для уверенности
    if (!checkAuth()) {
        return;
    }
    
    // Скрываем экран загрузки
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    // Показываем основной контейнер
    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
        mainContainer.style.display = 'block';
    }
    
    // Инициализация DOM элементов
    initDOMElements();
    
    // Настройка интерфейса по роли
    setupRoleBasedUI();
    
    // Показать информацию о пользователе
    showUserInfo();
    
    // Загрузка данных (база + заявки)
    loadAllData();
    
    // Настройка интерфейса
    setupInterface();
    
    // Проверка соединения
    checkConnection();
    
    // Настройка поиска в выпадающем списке
    setupSearchableSelect();
    
    // Запускаем автоматическую синхронизацию
    startAutoSync();
    
    console.log('Приложение успешно запущено');
}

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
    
    const accessRestricted = document.getElementById('accessRestricted');
    const formSection = document.getElementById('formSection');
    const searchFilter = document.getElementById('searchFilter');
    
    // Настройка видимости секций
    if (currentUser.type === 'repair') {
        // Ремонтная служба - только просмотр
        if (formSection) formSection.style.display = 'none';
        if (searchFilter) searchFilter.style.display = 'block';
        if (accessRestricted) accessRestricted.style.display = 'none';
    } else if (currentUser.type === 'author') {
        // Авторы - могут создавать заявки
        if (formSection) formSection.style.display = 'block';
        if (searchFilter) searchFilter.style.display = 'block';
        if (accessRestricted) accessRestricted.style.display = 'none';
    } else if (currentUser.type === 'admin') {
        // Администраторы - полный доступ
        if (formSection) formSection.style.display = 'block';
        if (searchFilter) searchFilter.style.display = 'block';
        if (accessRestricted) accessRestricted.style.display = 'none';
    }
}

// Показать информацию о пользователе
function showUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userInfo && currentUser) {
        userInfo.style.display = 'flex';
        
        if (userName) {
            userName.textContent = currentUser.name;
        }
        
        if (userRole) {
            let roleText = '';
            switch(currentUser.type) {
                case 'admin': roleText = 'Администратор'; break;
                case 'author': roleText = 'Автор заявок'; break;
                case 'repair': roleText = 'Ремонтная служба'; break;
                default: roleText = 'Пользователь';
            }
            userRole.textContent = roleText;
        }
    }
}

// Проверка авторизации
function checkAuth() {
    const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
    const savedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    
    if (!isAuthenticated || !savedUser) {
        redirectToLogin();
        return false;
    }
    
    return true;
}

// ============ АВТОМАТИЧЕСКАЯ СИНХРОНИЗАЦИЯ ============

// Запуск автоматической синхронизации
function startAutoSync() {
    // Останавливаем предыдущий интервал если есть
    if (syncInterval) {
        clearInterval(syncInterval);
    }
    
    // Запускаем синхронизацию каждые SYNC_INTERVAL миллисекунд
    syncInterval = setInterval(() => {
        if (isOnline) {
            syncWithServer();
        }
    }, SYNC_INTERVAL);
    
    // Первая синхронизация сразу
    setTimeout(() => {
        if (isOnline) {
            syncWithServer();
        }
    }, 5000);
}

// Синхронизация с сервером
async function syncWithServer() {
    try {
        console.log('Проверка обновлений с сервера...');
        
        // Обновляем время последней синхронизации
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        
        // Обновляем информацию о синхронизации
        updateSyncInfo();
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
    }
}

// Обновить информацию о синхронизации
function updateSyncInfo() {
    const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    const syncInfoElement = document.getElementById('syncInfo');
    
    if (syncInfoElement) {
        if (lastSync) {
            const date = new Date(lastSync);
            const now = new Date();
            const diffMinutes = Math.floor((now - date) / (1000 * 60));
            
            if (diffMinutes < 1) {
                syncInfoElement.textContent = 'Синхронизировано только что';
            } else if (diffMinutes < 60) {
                syncInfoElement.textContent = `Синхронизировано ${diffMinutes} мин. назад`;
            } else {
                const diffHours = Math.floor(diffMinutes / 60);
                syncInfoElement.textContent = `Синхронизировано ${diffHours} ч. назад`;
            }
        } else {
            syncInfoElement.textContent = 'Синхронизация не выполнялась';
        }
    }
}

// ============ ИНТЕРФЕЙС ============

// Настройка интерфейса
function setupInterface() {
    // Установить дату и время по умолчанию
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
    
    // Если пользователь - автор, заполняем его имя
    if (currentUser && currentUser.type === 'author' && authorInput) {
        authorInput.value = currentUser.name;
    }
    
    // Добавляем информацию о синхронизации
    addSyncInfo();
    
    // Добавить обработчики событий
    addEventListeners();
}

// Добавить информацию о синхронизации
function addSyncInfo() {
    const formSection = document.getElementById('formSection');
    if (!formSection) return;
    
    // Проверяем, не добавлена ли уже информация о синхронизации
    let syncInfo = formSection.querySelector('.sync-info');
    if (!syncInfo) {
        syncInfo = document.createElement('div');
        syncInfo.className = 'sync-info';
        syncInfo.innerHTML = `
            <div class="sync-status">
                <span id="syncInfo">Загрузка статуса синхронизации...</span>
                <span class="sync-indicator ${isOnline ? 'online' : 'offline'}"></span>
            </div>
        `;
        
        // Добавляем после информации о базе оборудования
        const dbInfo = formSection.querySelector('.db-info');
        if (dbInfo && dbInfo.nextSibling) {
            formSection.insertBefore(syncInfo, dbInfo.nextSibling);
        } else {
            // Если нет dbInfo, добавляем в конец формы
            formSection.appendChild(syncInfo);
        }
    }
    
    // Обновляем информацию
    updateSyncInfo();
}

// Обновить информацию о базе
function updateDBInfo() {
    const dbInfoText = document.getElementById('dbInfoText');
    if (!dbInfoText) return;
    
    const lastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
    
    let info = '';
    
    if (savedData && savedData.length > 0) {
        const count = savedData.length;
        const date = lastUpdated ? new Date(lastUpdated).toLocaleDateString('ru-RU') : 'неизвестно';
        const time = lastUpdated ? new Date(lastUpdated).toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'}) : '';
        info = `База оборудования: ${count} записей (обновлено: ${date} ${time})`;
    } else {
        info = 'База оборудования не загружена';
    }
    
    dbInfoText.textContent = info;
}

// Добавить обработчики событий
function addEventListeners() {
    // Обработчик отправки формы
    if (repairForm) {
        repairForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Обработчик очистки формы
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    // Обработчик выбора инвентарного номера
    if (invNumberSelect) {
        invNumberSelect.addEventListener('change', handleInvNumberChange);
    }
    
    // Обработчики фильтров
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    
    if (locationFilter) {
        locationFilter.addEventListener('change', applyFilters);
    }
    
    if (monthFilter) {
        monthFilter.addEventListener('change', applyFilters);
    }
}

// ============ ЗАГРУЗКА ДАННЫХ ============

// Загрузка всех данных
async function loadAllData() {
    try {
        // Загружаем базу оборудования и заявки параллельно
        await Promise.allSettled([
            loadEquipmentDatabase(),
            loadRepairRequests()
        ]);
        
        applyFilters();
        
        // Обновляем информацию о базе
        updateDBInfo();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Загрузка базы оборудования с GitHub
async function loadEquipmentDatabase(forceUpdate = false) {
    try {
        const lastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
        const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
        
        // Проверяем, нужно ли обновлять базу (раз в день или принудительно)
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const shouldUpdate = forceUpdate || 
                            !lastUpdated || 
                            new Date(lastUpdated) < oneDayAgo ||
                            !savedData || 
                            savedData.length === 0;
        
        if (shouldUpdate && navigator.onLine) {
            console.log('Загрузка базы оборудования с GitHub...');
            showNotification('Загрузка базы оборудования...', 'info');
            
            const response = await fetch(EQUIPMENT_DB_URL + '?t=' + Date.now());
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }
            
            const csvContent = await response.text();
            
            if (!csvContent || csvContent.trim().length === 0) {
                throw new Error('CSV файл пуст');
            }
            
            equipmentDatabase = parseCSV(csvContent);
            
            if (equipmentDatabase.length === 0) {
                throw new Error('Не удалось загрузить данные оборудования');
            }
            
            // Сохраняем с отметкой времени
            localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
            localStorage.setItem(STORAGE_KEYS.DB_LAST_UPDATED, new Date().toISOString());
            
            console.log(`Загружена база с GitHub: ${equipmentDatabase.length} записей`);
            
            if (!forceUpdate) {
                showNotification(`База оборудования обновлена (${equipmentDatabase.length} записей)`, 'success');
            }
            
        } else if (savedData && savedData.length > 0) {
            // Используем сохраненные данные
            equipmentDatabase = savedData;
            console.log('Загружена локальная база оборудования:', equipmentDatabase.length, 'записей');
            
            // Если данные старые и есть интернет, обновляем в фоне
            if (lastUpdated && new Date(lastUpdated) < oneDayAgo && navigator.onLine) {
                console.log('Фоновая проверка обновлений базы...');
                loadEquipmentDatabase(true).catch(error => {
                    console.warn('Фоновая загрузка не удалась:', error);
                });
            }
        } else {
            // Если нет сохраненных данных и нет интернета
            console.warn('Нет локальной базы и нет интернета');
            equipmentDatabase = getDefaultEquipmentDatabase();
            showNotification('Используется локальная база оборудования', 'warning');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки базы оборудования:', error);
        
        // Пробуем загрузить сохраненные данные
        const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
        
        if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
            console.log('Используем сохраненную базу после ошибки:', equipmentDatabase.length, 'записей');
        } else {
            equipmentDatabase = getDefaultEquipmentDatabase();
            console.log('Используем базу по умолчанию:', equipmentDatabase.length, 'записей');
            showNotification('Ошибка загрузки базы. Используется локальная версия', 'error');
        }
    }
    
    // Обновляем интерфейс
    populateInvNumberSelect();
    populateLocationFilter();
    updateDBInfo();
}

// Загрузка заявок из localStorage
function loadRepairRequests() {
    const savedRequests = localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS);
    
    if (savedRequests) {
        repairRequests = JSON.parse(savedRequests);
        console.log(`Загружено ${repairRequests.length} заявок из localStorage`);
    } else {
        repairRequests = [];
        console.log('Заявки не найдены, создан новый список');
    }
    
    updateSummary();
}

// Сохранение заявок в localStorage
function saveRepairRequests() {
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    console.log(`Сохранено ${repairRequests.length} заявок в localStorage`);
}

// ============ ОБРАБОТКА ФОРМЫ ============

// Обработчик отправки формы
function handleFormSubmit(event) {
    event.preventDefault();
    
    if (!checkAuth()) return;
    
    // Проверка прав
    if (currentUser.type !== 'author' && currentUser.type !== 'admin') {
        showNotification('У вас нет прав для создания заявок', 'error');
        return;
    }
    
    // Сбор данных из формы
    const formData = {
        id: Date.now().toString(),
        date: document.getElementById('date').value,
        time: document.getElementById('time').value,
        author: document.getElementById('author').value,
        invNumber: document.getElementById('invNumber').value,
        equipmentName: document.getElementById('equipmentName').value,
        location: document.getElementById('location').value,
        model: document.getElementById('model').value,
        machineNumber: document.getElementById('machineNumber').value,
        faultDescription: document.getElementById('faultDescription').value,
        productionItem: document.getElementById('productionItem').value,
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.name
    };
    
    // Проверка обязательных полей
    if (!formData.date || !formData.time || !formData.author || !formData.invNumber || !formData.faultDescription) {
        showNotification('Заполните все обязательные поля', 'error');
        return;
    }
    
    // Добавление заявки
    repairRequests.unshift(formData);
    saveRepairRequests();
    
    // Очистка формы
    clearForm();
    
    // Обновление таблицы
    applyFilters();
    
    // Обновление сводной информации
    updateSummary();
    
    showNotification('Заявка успешно добавлена', 'success');
}

// Очистка формы
function clearForm() {
    if (!repairForm) return;
    
    repairForm.reset();
    
    // Установить текущую дату и время
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    document.getElementById('date').value = today;
    document.getElementById('time').value = timeString;
    
    // Если пользователь - автор, заполняем его имя
    if (currentUser && currentUser.type === 'author' && authorInput) {
        authorInput.value = currentUser.name;
    }
    
    // Очистить зависимые поля
    if (equipmentNameInput) equipmentNameInput.value = '';
    if (locationInput) locationInput.value = '';
    if (modelInput) modelInput.value = '';
    if (machineNumberInput) machineNumberInput.value = '';
    
    // Сбросить выпадающий список
    if (invNumberSelect) {
        invNumberSelect.value = '';
    }
}

// Обработчик изменения инвентарного номера
function handleInvNumberChange() {
    const selectedValue = invNumberSelect.value;
    
    if (!selectedValue) {
        if (equipmentNameInput) equipmentNameInput.value = '';
        if (locationInput) locationInput.value = '';
        if (modelInput) modelInput.value = '';
        return;
    }
    
    // Поиск выбранного оборудования в базе
    const equipment = equipmentDatabase.find(item => 
        item.invNumber === selectedValue || 
        `${item.invNumber} - ${item.equipmentName}` === selectedValue
    );
    
    if (equipment) {
        if (equipmentNameInput) equipmentNameInput.value = equipment.equipmentName || '';
        if (locationInput) locationInput.value = equipment.location || '';
        if (modelInput) modelInput.value = equipment.model || '';
    }
}

// Настройка поиска в выпадающем списке
function setupSearchableSelect() {
    const searchInput = document.getElementById('invNumberSearch');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        populateInvNumberSelect(searchTerm);
    });
}

// Заполнение выпадающего списка инвентарных номеров
function populateInvNumberSelect(filter = '') {
    if (!invNumberSelect) return;
    
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    if (!equipmentDatabase || equipmentDatabase.length === 0) {
        return;
    }
    
    // Фильтрация и сортировка
    let filteredData = equipmentDatabase;
    
    if (filter) {
        filteredData = equipmentDatabase.filter(item => 
            (item.invNumber && item.invNumber.toLowerCase().includes(filter)) ||
            (item.equipmentName && item.equipmentName.toLowerCase().includes(filter))
        );
    }
    
    // Сортировка по инвентарному номеру
    filteredData.sort((a, b) => {
        const numA = parseInt(a.invNumber) || 0;
        const numB = parseInt(b.invNumber) || 0;
        return numA - numB;
    });
    
    // Добавление опций
    filteredData.forEach(item => {
        const option = document.createElement('option');
        const displayText = item.invNumber + (item.equipmentName ? ` - ${item.equipmentName}` : '');
        option.value = item.invNumber;
        option.textContent = displayText;
        invNumberSelect.appendChild(option);
    });
}

// Заполнение фильтра участков
function populateLocationFilter() {
    if (!locationFilter) return;
    
    locationFilter.innerHTML = '<option value="all">Все участки</option>';
    
    if (!equipmentDatabase || equipmentDatabase.length === 0) {
        return;
    }
    
    // Сбор уникальных участков
    const locations = new Set();
    equipmentDatabase.forEach(item => {
        if (item.location) {
            locations.add(item.location);
        }
    });
    
    // Сортировка и добавление
    Array.from(locations).sort().forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

// ============ ФИЛЬТРАЦИЯ И ПОИСК ============

// Применение фильтров
function applyFilters() {
    if (!repairTableBody) return;
    
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusValue = statusFilter ? statusFilter.value : 'all';
    const locationValue = locationFilter ? locationFilter.value : 'all';
    const monthValue = monthFilter ? monthFilter.value : '';
    
    let filteredRequests = repairRequests;
    
    // Фильтрация по поисковому запросу
    if (searchTerm) {
        filteredRequests = filteredRequests.filter(request => 
            (request.equipmentName && request.equipmentName.toLowerCase().includes(searchTerm)) ||
            (request.faultDescription && request.faultDescription.toLowerCase().includes(searchTerm)) ||
            (request.invNumber && request.invNumber.toLowerCase().includes(searchTerm)) ||
            (request.author && request.author.toLowerCase().includes(searchTerm))
        );
    }
    
    // Фильтрация по статусу
    if (statusValue !== 'all') {
        filteredRequests = filteredRequests.filter(request => request.status === statusValue);
    }
    
    // Фильтрация по участку
    if (locationValue !== 'all') {
        filteredRequests = filteredRequests.filter(request => request.location === locationValue);
    }
    
    // Фильтрация по месяцу
    if (monthValue) {
        filteredRequests = filteredRequests.filter(request => {
            const requestDate = new Date(request.date);
            const filterDate = new Date(monthValue + '-01');
            return requestDate.getFullYear() === filterDate.getFullYear() && 
                   requestDate.getMonth() === filterDate.getMonth();
        });
    }
    
    // Обновление таблицы
    updateRepairTable(filteredRequests);
    
    // Обновление сводной информации
    updateSummary();
}

// Обновление таблицы заявок
function updateRepairTable(requests = repairRequests) {
    if (!repairTableBody) return;
    
    repairTableBody.innerHTML = '';
    
    if (requests.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="14" style="text-align: center; padding: 40px; color: #888;">
                Заявки не найдены. Добавьте новую заявку или измените параметры фильтра.
            </td>
        `;
        repairTableBody.appendChild(emptyRow);
        return;
    }
    
    // Добавление строк с заявками
    requests.forEach(request => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        // Рассчет времени простоя если ремонт завершен
        let downtimeHours = 0;
        let downtimeCount = 0;
        
        if (request.status === 'completed' && request.repairEndDate && request.repairEndTime) {
            const startDate = new Date(`${request.date}T${request.time}`);
            const endDate = new Date(`${request.repairEndDate}T${request.repairEndTime}`);
            
            if (!isNaN(startDate) && !isNaN(endDate) && endDate > startDate) {
                downtimeHours = Math.round((endDate - startDate) / (1000 * 60 * 60) * 10) / 10;
                downtimeCount = 1;
            }
        }
        
        row.innerHTML = `
            <td>${request.date} ${request.time}</td>
            <td>${request.author || ''}</td>
            <td>${request.location || ''}</td>
            <td>${request.invNumber || ''}</td>
            <td>${request.equipmentName || ''}</td>
            <td>${request.model || ''}</td>
            <td>${request.machineNumber || ''}</td>
            <td style="max-width: 200px; word-wrap: break-word;">${request.faultDescription || ''}</td>
            <td>${request.repairEndDate || ''} ${request.repairEndTime || ''}</td>
            <td class="status-${request.status || 'pending'}">${getStatusText(request.status)}</td>
            <td style="text-align: center;">${downtimeCount}</td>
            <td style="text-align: center;">${downtimeHours > 0 ? downtimeHours + ' ч' : ''}</td>
            <td>${request.productionItem || ''}</td>
            <td>
                <div class="actions-cell">
                    ${currentUser && currentUser.permissions && currentUser.permissions.canComplete ? 
                        `<button class="btn-complete" onclick="completeRepair('${request.id}')" ${request.status === 'completed' ? 'disabled' : ''}>
                            ${request.status === 'completed' ? '✓ Завершено' : 'Завершить'}
                        </button>` : ''}
                    ${currentUser && currentUser.permissions && currentUser.permissions.canDelete ? 
                        `<button class="btn-delete" onclick="deleteRepairRequest('${request.id}')">Удалить</button>` : ''}
                </div>
            </td>
        `;
        
        repairTableBody.appendChild(row);
    });
}

// Получение текста статуса
function getStatusText(status) {
    switch(status) {
        case 'pending': return 'В ремонте';
        case 'completed': return 'Завершено';
        default: return 'Неизвестно';
    }
}

// Обновление сводной информации
function updateSummary() {
    if (!totalRequestsElement || !pendingRequestsElement || !completedRequestsElement || !totalDowntimeElement) return;
    
    const total = repairRequests.length;
    const pending = repairRequests.filter(r => r.status === 'pending').length;
    const completed = repairRequests.filter(r => r.status === 'completed').length;
    
    // Рассчет общего времени простоя
    let totalDowntime = 0;
    repairRequests.forEach(request => {
        if (request.status === 'completed' && request.repairEndDate && request.repairEndTime) {
            const startDate = new Date(`${request.date}T${request.time}`);
            const endDate = new Date(`${request.repairEndDate}T${request.repairEndTime}`);
            
            if (!isNaN(startDate) && !isNaN(endDate) && endDate > startDate) {
                totalDowntime += (endDate - startDate) / (1000 * 60 * 60);
            }
        }
    });
    
    totalRequestsElement.textContent = total;
    pendingRequestsElement.textContent = pending;
    completedRequestsElement.textContent = completed;
    totalDowntimeElement.textContent = Math.round(totalDowntime * 10) / 10 + ' ч';
}

// ============ ОПЕРАЦИИ С ЗАЯВКАМИ ============

// Завершить ремонт
function completeRepair(requestId) {
    if (!checkAuth()) return;
    
    // Проверка прав
    if (currentUser.type !== 'repair' && currentUser.type !== 'admin') {
        showNotification('Только ремонтная служба может завершать заявки', 'error');
        return;
    }
    
    const request = repairRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }
    
    if (request.status === 'completed') {
        showNotification('Заявка уже завершена', 'warning');
        return;
    }
    
    // Запрос даты и времени окончания
    const endDate = prompt('Введите дату окончания ремонта (ГГГГ-ММ-ДД):', new Date().toISOString().split('T')[0]);
    if (!endDate) return;
    
    const endTime = prompt('Введите время окончания ремонта (ЧЧ:ММ):', 
        new Date().getHours().toString().padStart(2, '0') + ':' + 
        new Date().getMinutes().toString().padStart(2, '0'));
    if (!endTime) return;
    
    // Обновление заявки
    request.status = 'completed';
    request.repairEndDate = endDate;
    request.repairEndTime = endTime;
    request.completedAt = new Date().toISOString();
    request.completedBy = currentUser.name;
    
    // Сохранение
    saveRepairRequests();
    
    // Обновление интерфейса
    applyFilters();
    
    showNotification('Заявка успешно завершена', 'success');
}

// Удалить заявку
function deleteRepairRequest(requestId) {
    if (!checkAuth()) return;
    
    // Проверка прав
    if (currentUser.type !== 'admin') {
        showNotification('Только администраторы могут удалять заявки', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    const initialLength = repairRequests.length;
    repairRequests = repairRequests.filter(r => r.id !== requestId);
    
    if (repairRequests.length < initialLength) {
        saveRepairRequests();
        applyFilters();
        showNotification('Заявка удалена', 'success');
    } else {
        showNotification('Заявка не найдена', 'error');
    }
}

// ============ ДАШБОРД ============

// Показать дашборд
window.showDashboard = function() {
    if (!checkAuth()) return;
    
    const modal = document.getElementById('dashboardModal');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (!modal || !dashboardContent) return;
    
    // Сбор статистики
    const stats = calculateDashboardStats();
    
    // Генерация контента дашборда
    dashboardContent.innerHTML = `
        <div class="dashboard-stats">
            <div class="stat-card">
                <h3>Всего заявок</h3>
                <div class="stat-value">${stats.total}</div>
                <div class="stat-change">за все время</div>
            </div>
            <div class="stat-card">
                <h3>В работе</h3>
                <div class="stat-value">${stats.pending}</div>
                <div class="stat-change">${stats.pendingPercentage}% от общего</div>
            </div>
            <div class="stat-card">
                <h3>Завершено</h3>
                <div class="stat-value">${stats.completed}</div>
                <div class="stat-change">${stats.completedPercentage}% от общего</div>
            </div>
            <div class="stat-card">
                <h3>Среднее время ремонта</h3>
                <div class="stat-value">${stats.avgRepairTime} ч</div>
                <div class="stat-change">на одну заявку</div>
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <h3>Топ участков по количеству заявок</h3>
            <div style="margin-top: 15px;">
                ${stats.topLocations.map(loc => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
                        <span>${loc.location || 'Не указан'}</span>
                        <span><strong>${loc.count}</strong> заявок</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <h3>Статистика по месяцам</h3>
            <div style="margin-top: 15px;">
                ${stats.monthlyStats.map(month => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
                        <span>${month.month}</span>
                        <span><strong>${month.count}</strong> заявок</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Показать модальное окно
    modal.style.display = 'block';
};

// Закрыть дашборд
window.closeDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Рассчет статистики для дашборда
function calculateDashboardStats() {
    const total = repairRequests.length;
    const pending = repairRequests.filter(r => r.status === 'pending').length;
    const completed = repairRequests.filter(r => r.status === 'completed').length;
    
    // Рассчет времени ремонта
    let totalRepairTime = 0;
    let completedCount = 0;
    
    repairRequests.forEach(request => {
        if (request.status === 'completed' && request.repairEndDate && request.repairEndTime) {
            const startDate = new Date(`${request.date}T${request.time}`);
            const endDate = new Date(`${request.repairEndDate}T${request.repairEndTime}`);
            
            if (!isNaN(startDate) && !isNaN(endDate) && endDate > startDate) {
                totalRepairTime += (endDate - startDate) / (1000 * 60 * 60);
                completedCount++;
            }
        }
    });
    
    const avgRepairTime = completedCount > 0 ? Math.round(totalRepairTime / completedCount * 10) / 10 : 0;
    
    // Статистика по участкам
    const locationStats = {};
    repairRequests.forEach(request => {
        const location = request.location || 'Не указан';
        locationStats[location] = (locationStats[location] || 0) + 1;
    });
    
    const topLocations = Object.entries(locationStats)
        .map(([location, count]) => ({ location, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    // Статистика по месяцам
    const monthlyStats = {};
    repairRequests.forEach(request => {
        if (request.date) {
            const month = request.date.substring(0, 7); // ГГГГ-ММ
            const monthName = new Date(request.date).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
            monthlyStats[month] = monthlyStats[month] || { month: monthName, count: 0 };
            monthlyStats[month].count++;
        }
    });
    
    const monthlyStatsArray = Object.values(monthlyStats)
        .sort((a, b) => b.month.localeCompare(a.month))
        .slice(0, 6);
    
    return {
        total,
        pending,
        completed,
        pendingPercentage: total > 0 ? Math.round((pending / total) * 100) : 0,
        completedPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        avgRepairTime,
        topLocations,
        monthlyStats: monthlyStatsArray
    };
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

// Парсинг CSV
function parseCSV(csvContent) {
    const lines = csvContent.split('\n');
    const result = [];
    
    if (lines.length < 2) return result;
    
    // Определение заголовков
    const headers = lines[0].split(';').map(h => h.trim().replace(/"/g, ''));
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(';').map(v => v.trim().replace(/"/g, ''));
        const item = {};
        
        headers.forEach((header, index) => {
            if (values[index] !== undefined) {
                item[header] = values[index];
            }
        });
        
        // Стандартизация полей
        item.invNumber = item['Инвентарный номер'] || item['Инвентарный номер'] || '';
        item.equipmentName = item['Наименование оборудования'] || item['Наименование'] || '';
        item.location = item['Участок'] || item['Местонахождение'] || '';
        item.model = item['Модель'] || item['Тип'] || '';
        
        if (item.invNumber || item.equipmentName) {
            result.push(item);
        }
    }
    
    return result;
}

// База оборудования по умолчанию
function getDefaultEquipmentDatabase() {
    return [
        { invNumber: '12345', equipmentName: 'Станок токарный', location: 'Цех №1', model: 'ТВ-320' },
        { invNumber: '12346', equipmentName: 'Фрезерный станок', location: 'Цех №2', model: 'ФС-450' },
        { invNumber: '12347', equipmentName: 'Сверлильный станок', location: 'Цех №1', model: 'СС-200' },
        { invNumber: '12348', equipmentName: 'Шлифовальный станок', location: 'Цех №3', model: 'ШЛ-600' }
    ];
}

// Показать уведомление
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, duration);
}

// Перенаправление на страницу входа
function redirectToLogin() {
    // Очищаем данные авторизации
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
    
    // Проверяем, не находимся ли уже на странице логина
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage !== 'login.html') {
        window.location.href = 'login.html';
    }
}

// Проверка соединения
function checkConnection() {
    isOnline = navigator.onLine;
    
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        if (isOnline) {
            connectionStatus.textContent = 'Онлайн';
            connectionStatus.className = 'connection-status';
        } else {
            connectionStatus.textContent = 'Оффлайн';
            connectionStatus.className = 'connection-status offline';
        }
    }
    
    // Обновляем индикатор синхронизации
    updateSyncIndicator();
    
    window.addEventListener('online', () => {
        isOnline = true;
        showNotification('Соединение восстановлено', 'success');
        checkConnection();
        
        // При появлении интернета синхронизируемся
        setTimeout(() => {
            syncWithServer();
            loadEquipmentDatabase(); // Проверяем обновления базы
        }, 3000);
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        showNotification('Потеряно соединение с интернетом', 'warning');
        checkConnection();
    });
}

// Обновить индикатор синхронизации
function updateSyncIndicator() {
    const syncIndicator = document.querySelector('.sync-indicator');
    if (syncIndicator) {
        syncIndicator.className = `sync-indicator ${isOnline ? 'online' : 'offline'}`;
        syncIndicator.title = isOnline ? 'Соединение активно' : 'Нет соединения';
    }
}

// ============ ГЛОБАЛЬНЫЕ ФУНКЦИИ ============

// Обновить базу оборудования
window.updateEquipmentDB = async function() {
    if (!checkAuth()) return;
    
    if (isDBLoading) {
        showNotification('База уже загружается...', 'warning');
        return;
    }
    
    isDBLoading = true;
    showNotification('Обновление базы оборудования...', 'info');
    
    try {
        await loadEquipmentDatabase(true); // Принудительное обновление
        showNotification(`База обновлена! Загружено ${equipmentDatabase.length} записей`, 'success');
    } catch (error) {
        console.error('Ошибка обновления базы:', error);
        showNotification('Ошибка обновления базы', 'error');
    } finally {
        isDBLoading = false;
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
    
    let csvContent = "Дата;Время;Автор;Участок;Инв.номер;Оборудование;Модель;Номер станка;Неисправность;Дата окончания;Время окончания;Статус;Кол-во простоев;Время простоя;Номенклатура\n";
    
    repairRequests.forEach(request => {
        csvContent += `"${request.date || ''}";"${request.time || ''}";"${request.author || ''}";"${request.location || ''}";"${request.invNumber || ''}";"${request.equipmentName || ''}";"${request.model || ''}";"${request.machineNumber || ''}";"${request.faultDescription || ''}";"${request.repairEndDate || ''}";"${request.repairEndTime || ''}";"${request.status || ''}";"${request.downtimeCount || 0}";"${request.downtimeHours || 0}";"${request.productionItem || ''}"\n`;
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

// Выход из системы
window.logout = function() {
    if (confirm('Вы уверены, что хотите выйти из системы?')) {
        // Очищаем данные авторизации
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
        
        // Останавливаем синхронизацию
        if (syncInterval) {
            clearInterval(syncInterval);
        }
        
        // Перенаправляем на страницу входа
        window.location.href = 'login.html';
    }
};

// Инициализация при полной загрузке окна
window.addEventListener('load', function() {
    console.log('Окно полностью загружено');
});

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    showNotification('Произошла ошибка в приложении', 'error');
});

// Очистка при закрытии
window.addEventListener('beforeunload', function() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
