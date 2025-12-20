// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ С СИНХРОНИЗАЦИЕЙ

// Константы
const APP_VERSION = '2.0.5';
const APP_NAME = 'Ремонтный журнал';
const EQUIPMENT_DB_URL = 'https://raw.githubusercontent.com/aitof-stack/repair-journal/main/data/equipment_database.csv';
const STORAGE_KEYS = {
    EQUIPMENT_DB: 'repair_journal_equipmentDatabase',
    REPAIR_REQUESTS: 'repair_journal_repairRequests',
    CURRENT_USER: 'repair_journal_currentUser',
    AUTH_STATUS: 'repair_journal_isAuthenticated',
    DB_LAST_UPDATED: 'repair_journal_equipmentDBLastUpdated',
    SYNC_TIMESTAMP: 'repair_journal_syncTimestamp',
    DEVICE_ID: 'repair_journal_deviceId'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = true;
let isDBLoading = false;

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============ ИНИЦИАЛИЗАЦИЯ ============

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
    
    // Генерируем уникальный ID устройства
    generateDeviceId();
    
    // Проверяем авторизацию
    checkAuthAndInit();
});

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
    
    console.log('Приложение успешно запущено');
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
            
            // Показываем первый подходящий вариант
            for (let i = 0; i < options.length; i++) {
                if (options[i].style.display !== 'none') {
                    invNumberSelect.selectedIndex = i;
                    handleInvNumberChange.call(invNumberSelect);
                    break;
                }
            }
        });
        
        // Добавляем кнопку очистки поиска
        const searchContainer = invNumberSearch.parentElement;
        searchContainer.style.position = 'relative';
        
        const clearSearchBtn = document.createElement('button');
        clearSearchBtn.innerHTML = '×';
        clearSearchBtn.style.position = 'absolute';
        clearSearchBtn.style.right = '5px';
        clearSearchBtn.style.top = '50%';
        clearSearchBtn.style.transform = 'translateY(-50%)';
        clearSearchBtn.style.background = 'none';
        clearSearchBtn.style.border = 'none';
        clearSearchBtn.style.fontSize = '20px';
        clearSearchBtn.style.cursor = 'pointer';
        clearSearchBtn.style.color = '#999';
        clearSearchBtn.style.display = 'none';
        
        clearSearchBtn.addEventListener('click', function() {
            invNumberSearch.value = '';
            invNumberSelect.selectedIndex = 0;
            handleInvNumberChange.call(invNumberSelect);
            
            // Показываем все опции
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

// Проверка авторизации
function checkAuth() {
    const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
    const savedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
    
    if (!isAuthenticated || !savedUser) {
        redirectToLogin();
        return false;
    }
    
    currentUser = savedUser;
    
    // Настройка интерфейса по роли
    setupRoleBasedUI();
    
    // Показать информацию о пользователе
    showUserInfo();
    
    return true;
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

// ============ ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ КНОПОК ============

// Выход из системы
window.logout = function() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
        redirectToLogin();
    }
};

// Импорт базы оборудования (ручной)
window.importEquipmentDB = function() {
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin' && currentUser.type !== 'author') {
        showNotification('У вас нет прав для импорта данных', 'error');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const content = e.target.result;
                
                if (file.name.endsWith('.csv')) {
                    equipmentDatabase = parseCSV(content);
                    showNotification(`Загружено ${equipmentDatabase.length} записей из CSV`, 'success');
                } else if (file.name.endsWith('.json')) {
                    const data = JSON.parse(content);
                    if (Array.isArray(data)) {
                        equipmentDatabase = data;
                        showNotification(`Загружено ${equipmentDatabase.length} записей из JSON`, 'success');
                    } else {
                        throw new Error('Неверный формат JSON');
                    }
                } else {
                    throw new Error('Неподдерживаемый формат файла');
                }
                
                // Сохраняем с отметкой времени
                localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
                localStorage.setItem(STORAGE_KEYS.DB_LAST_UPDATED, new Date().toISOString());
                
                populateInvNumberSelect();
                populateLocationFilter();
                
            } catch (error) {
                console.error('Ошибка обработки файла:', error);
                showNotification('Ошибка обработки файла: ' + error.message, 'error');
            }
        };
        
        reader.onerror = function() {
            showNotification('Ошибка чтения файла', 'error');
        };
        
        reader.readAsText(file);
    };
    
    input.click();
};

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

// Экспорт данных для синхронизации
window.exportForSync = function() {
    if (!checkAuth()) return;
    
    const syncData = {
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        deviceId: localStorage.getItem(STORAGE_KEYS.DEVICE_ID),
        repairRequests: repairRequests,
        equipmentDatabase: equipmentDatabase,
        users: currentUser ? {
            name: currentUser.name,
            type: currentUser.type
        } : null
    };
    
    const dataStr = JSON.stringify(syncData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const link = document.createElement("a");
    link.setAttribute("href", dataUri);
    link.setAttribute("download", `repair_journal_sync_${new Date().toISOString().slice(0,10)}.json`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Данные экспортированы для синхронизации', 'success');
};

// Импорт данных для синхронизации
window.importForSync = function() {
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin') {
        showNotification('Только администраторы могут импортировать данные', 'error');
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const syncData = JSON.parse(e.target.result);
                
                if (!syncData.repairRequests || !Array.isArray(syncData.repairRequests)) {
                    throw new Error('Неверный формат файла синхронизации');
                }
                
                // Вопрос пользователю - как объединять данные
                const mergeOption = confirm('Объединить данные с существующими? (OK - объединить, Отмена - заменить)');
                
                if (mergeOption) {
                    // Объединение данных
                    const existingIds = new Set(repairRequests.map(req => req.id));
                    const newRequests = syncData.repairRequests.filter(req => !existingIds.has(req.id));
                    
                    repairRequests = [...repairRequests, ...newRequests];
                    showNotification(`Добавлено ${newRequests.length} новых заявок`, 'success');
                } else {
                    // Замена данных
                    repairRequests = syncData.repairRequests;
                    showNotification(`Загружено ${repairRequests.length} заявок`, 'success');
                }
                
                // Сохраняем оборудование если есть
                if (syncData.equipmentDatabase && Array.isArray(syncData.equipmentDatabase)) {
                    equipmentDatabase = syncData.equipmentDatabase;
                    localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
                    showNotification(`Загружено ${equipmentDatabase.length} записей оборудования`, 'success');
                }
                
                // Сохраняем данные
                localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
                localStorage.setItem(STORAGE_KEYS.SYNC_TIMESTAMP, new Date().toISOString());
                
                // Обновляем интерфейс
                renderRepairTable();
                updateSummary();
                populateInvNumberSelect();
                populateLocationFilter();
                
            } catch (error) {
                console.error('Ошибка импорта данных:', error);
                showNotification('Ошибка импорта данных: ' + error.message, 'error');
            }
        };
        
        reader.onerror = function() {
            showNotification('Ошибка чтения файла', 'error');
        };
        
        reader.readAsText(file);
    };
    
    input.click();
};

// Показать дашборд
window.showDashboard = function() {
    if (!checkAuth()) return;
    
    const modal = document.getElementById('dashboardModal');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (!modal || !dashboardContent) {
        showNotification('Ошибка открытия дашборда', 'error');
        return;
    }
    
    dashboardContent.innerHTML = generateDashboardHTML();
    modal.style.display = 'block';
    
    // Закрытие по клику вне модального окна
    modal.onclick = function(event) {
        if (event.target === modal) {
            window.closeDashboard();
        }
    };
};

// Закрыть дашборд
window.closeDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Удалить заявку
window.deleteRequest = function(id) {
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin') {
        showNotification('Только администраторы могут удалять заявки', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        const initialLength = repairRequests.length;
        repairRequests = repairRequests.filter(request => request.id !== id);
        
        if (repairRequests.length === initialLength) {
            showNotification('Заявка не найдена', 'error');
            return;
        }
        
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        localStorage.setItem(STORAGE_KEYS.SYNC_TIMESTAMP, new Date().toISOString());
        
        renderRepairTable();
        updateSummary();
        
        showNotification('Заявка успешно удалена', 'success');
        
    } catch (error) {
        console.error('Ошибка при удалении заявки:', error);
        showNotification('Ошибка при удалении заявки', 'error');
    }
};

// Завершить ремонт
window.completeRequest = function(id) {
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin' && currentUser.type !== 'repair') {
        showNotification('У вас нет прав для завершения ремонтов', 'error');
        return;
    }
    
    const request = repairRequests.find(req => req.id === id);
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
    
    if (isNaN(downtimeHours) || downtimeHours < 0) {
        showNotification('Ошибка расчета времени простоя', 'error');
        return;
    }
    
    request.status = 'completed';
    request.repairEndDate = repairEndDate;
    request.repairEndTime = repairEndTime;
    request.downtimeCount = parseInt(downtimeCount) || 1;
    request.downtimeHours = downtimeHours;
    request.updatedAt = new Date().toISOString();
    request.completedBy = currentUser.name;
    request.deviceId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    localStorage.setItem(STORAGE_KEYS.SYNC_TIMESTAMP, new Date().toISOString());
    
    renderRepairTable();
    updateSummary();
    
    showNotification(`Ремонт завершен! Время простоя: ${downtimeHours.toFixed(1)} ч`, 'success');
};

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
}

// Загрузка заявок
function loadRepairRequests() {
    const savedRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS));
    
    if (savedRequests && Array.isArray(savedRequests)) {
        repairRequests = savedRequests;
        console.log('Загружено заявок:', repairRequests.length);
    } else {
        repairRequests = [];
        console.log('Нет сохраненных заявок');
    }
    
    renderRepairTable();
    updateSummary();
}

// Парсинг CSV с GitHub
function parseCSV(csvContent) {
    const equipment = [];
    const lines = csvContent.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        try {
            // Простой парсинг CSV
            const parts = line.split(';');
            
            if (parts.length >= 5) {
                const item = {
                    location: cleanValue(parts[0]),
                    invNumber: cleanValue(parts[1]),
                    name: cleanValue(parts[2]),
                    model: cleanValue(parts[3]) || '-',
                    machineNumber: cleanValue(parts[4]) || '-'
                };
                
                // Проверяем, что это валидная запись
                if (item.invNumber && item.name && item.name.length > 2) {
                    equipment.push(item);
                }
            }
        } catch (error) {
            console.warn('Ошибка парсинга строки CSV:', error);
            continue;
        }
    }
    
    console.log('Успешно распарсено записей:', equipment.length);
    return equipment;
}

// Очистка значения
function cleanValue(value) {
    if (!value) return '';
    return value.toString().replace(/^["']|["']$/g, '').trim();
}

// Тестовые данные оборудования (используются если GitHub недоступен)
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
    
    // Добавляем информацию о базе оборудования
    addDBInfo();
    
    // Добавляем кнопки синхронизации для администраторов
    addSyncButtons();
    
    // Добавить обработчики событий
    addEventListeners();
}

// Добавить информацию о базе оборудования
function addDBInfo() {
    const buttonGroup = document.querySelector('.button-group');
    if (!buttonGroup) return;
    
    const dbInfo = document.createElement('div');
    dbInfo.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        background-color: #e8f5e9;
        border-radius: 4px;
        font-size: 12px;
        color: #2e7d32;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    const infoText = document.createElement('span');
    infoText.id = 'dbInfoText';
    
    const updateBtn = document.createElement('button');
    updateBtn.textContent = '🔄';
    updateBtn.title = 'Обновить базу оборудования';
    updateBtn.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        padding: 5px;
        border-radius: 50%;
        transition: background-color 0.3s;
    `;
    updateBtn.onmouseover = () => updateBtn.style.backgroundColor = '#c8e6c9';
    updateBtn.onmouseout = () => updateBtn.style.backgroundColor = 'transparent';
    updateBtn.onclick = window.updateEquipmentDB;
    
    dbInfo.appendChild(infoText);
    dbInfo.appendChild(updateBtn);
    
    buttonGroup.parentNode.insertBefore(dbInfo, buttonGroup.nextSibling);
    
    updateDBInfo();
}

// Добавить кнопки синхронизации
function addSyncButtons() {
    if (currentUser && currentUser.type === 'admin') {
        const buttonGroup = document.querySelector('.button-group');
        if (!buttonGroup) return;
        
        // Создаем контейнер для кнопок синхронизации
        const syncContainer = document.createElement('div');
        syncContainer.style.cssText = `
            margin-top: 15px;
            padding: 15px;
            background-color: #e3f2fd;
            border-radius: 8px;
            border: 1px solid #bbdefb;
        `;
        
        syncContainer.innerHTML = `
            <div style="font-weight: bold; color: #1976d2; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                <span>🔄 Синхронизация между устройствами</span>
            </div>
            <div style="font-size: 12px; color: #546e7a; margin-bottom: 10px;">
                Экспортируйте данные с компьютера и импортируйте на телефон
            </div>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn" onclick="window.exportForSync()" style="background-color: #4CAF50; color: white; padding: 8px 15px; font-size: 13px;">
                    📤 Экспорт для синхронизации
                </button>
                <button class="btn" onclick="window.importForSync()" style="background-color: #2196F3; color: white; padding: 8px 15px; font-size: 13px;">
                    📥 Импорт с другого устройства
                </button>
            </div>
        `;
        
        // Добавляем информацию о данных
        const dataInfo = document.createElement('div');
        dataInfo.style.cssText = `
            margin-top: 10px;
            font-size: 11px;
            color: #78909c;
            display: flex;
            justify-content: space-between;
        `;
        
        const requestsInfo = document.createElement('span');
        requestsInfo.id = 'syncRequestsInfo';
        
        const syncInfo = document.createElement('span');
        syncInfo.id = 'syncInfo';
        
        dataInfo.appendChild(requestsInfo);
        dataInfo.appendChild(syncInfo);
        syncContainer.appendChild(dataInfo);
        
        buttonGroup.parentNode.insertBefore(syncContainer, buttonGroup.nextSibling);
        
        // Обновляем информацию
        updateSyncInfo();
    }
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
        info = `База оборудования: ${count} записей (обновлено: ${date})`;
    } else {
        info = 'База оборудования не загружена';
    }
    
    dbInfoText.textContent = info;
}

// Обновить информацию о синхронизации
function updateSyncInfo() {
    const requestsInfo = document.getElementById('syncRequestsInfo');
    const syncInfo = document.getElementById('syncInfo');
    
    if (requestsInfo) {
        requestsInfo.textContent = `Заявок: ${repairRequests.length}`;
    }
    
    if (syncInfo) {
        const lastSync = localStorage.getItem(STORAGE_KEYS.SYNC_TIMESTAMP);
        if (lastSync) {
            const date = new Date(lastSync).toLocaleString('ru-RU');
            syncInfo.textContent = `Синхр.: ${date}`;
        } else {
            syncInfo.textContent = 'Синхр.: никогда';
        }
    }
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
        
        // Предлагаем обновить базу
        if (navigator.onLine) {
            const updateOption = document.createElement('option');
            updateOption.value = "";
            updateOption.textContent = "Нажмите 'Обновить базу'";
            updateOption.disabled = true;
            invNumberSelect.appendChild(updateOption);
        }
        return;
    }
    
    // Сортируем по инвентарному номеру
    equipmentDatabase.sort((a, b) => {
        const numA = parseInt(a.invNumber) || 0;
        const numB = parseInt(b.invNumber) || 0;
        return numA - numB;
    });
    
    // Убираем дубликаты по инвентарному номеру
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
    
    // Восстанавливаем предыдущее значение
    if (currentValue) {
        invNumberSelect.value = currentValue;
        handleInvNumberChange.call(invNumberSelect);
    }
    
    // Обновляем информацию о базе
    updateDBInfo();
    updateSyncInfo();
}

// Заполнение фильтра участков
function populateLocationFilter() {
    if (!locationFilter) return;
    
    const currentValue = locationFilter.value;
    locationFilter.innerHTML = '<option value="all">Все участки</option>';
    
    if (equipmentDatabase.length === 0) return;
    
    // Убираем дубликаты и сортируем
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
    
    // Восстанавливаем предыдущее значение
    if (currentValue && currentValue !== 'all') {
        locationFilter.value = currentValue;
    }
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

// Добавление обработчиков событий
function addEventListeners() {
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
    
    // Обновление базы при появлении интернета
    window.addEventListener('online', () => {
        console.log('Интернет появился, проверяем обновления базы...');
        setTimeout(() => {
            loadEquipmentDatabase().then(() => {
                updateDBInfo();
            }).catch(error => {
                console.warn('Не удалось обновить базу после появления интернета:', error);
            });
        }, 5000);
    });
}

// Дебаунс для оптимизации поиска
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

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============

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
function handleFormSubmit(e) {
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
        addRepairRequest(newRequest);
        
        renderRepairTable();
        updateSummary();
        clearForm();
        
        showNotification('Заявка успешно добавлена!', 'success');
        
    } catch (error) {
        console.error('Ошибка при добавлении заявки:', error);
        showNotification('Ошибка при добавлении заявки', 'error');
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
        id: Date.now() + Math.floor(Math.random() * 1000), // Уникальный ID
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deviceId: localStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    };
}

// Добавить заявку
function addRepairRequest(request) {
    repairRequests.push(request);
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    localStorage.setItem(STORAGE_KEYS.SYNC_TIMESTAMP, new Date().toISOString());
    
    // Обновляем информацию о синхронизации
    updateSyncInfo();
    
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
    
    // Очищаем поиск в селекте
    const invNumberSearch = document.getElementById('invNumberSearch');
    if (invNumberSearch) {
        invNumberSearch.value = '';
        const options = invSelect.options;
        for (let i = 0; i < options.length; i++) {
            options[i].style.display = '';
        }
    }
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
        return Math.max(0, Math.round(diffHours * 10) / 10); // Округляем до 0.1 часа
    } catch (error) {
        console.error('Ошибка вычисления времени простоя:', error);
        return 0;
    }
}

// ============ ОТОБРАЖЕНИЕ ТАБЛИЦЫ ============

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
                <div style="font-size: 18px; margin-bottom: 10px;">📭</div>
                <strong>Нет заявок на ремонт</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Используйте экспорт/импорт для синхронизации</p>
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
        
        // Добавляем индикатор устройства
        const deviceIndicator = request.deviceId ? 
            `<span style="font-size: 10px; color: #666;" title="Создано на устройстве: ${request.deviceId}">📱</span>` : 
            '';
        
        let actionButtons = '';
        
        if (currentUser && currentUser.type === 'admin') {
            actionButtons += `<button class="btn btn-delete" onclick="deleteRequest(${request.id})" title="Удалить">Удалить</button>`;
        }
        
        if (request.status === 'pending' && currentUser && 
            (currentUser.type === 'admin' || currentUser.type === 'repair')) {
            actionButtons += `<button class="btn" style="background-color: #2196F3; padding: 6px 12px; font-size: 13px;" onclick="completeRequest(${request.id})" title="Завершить ремонт">Завершить</button>`;
        }
        
        if (!actionButtons) {
            actionButtons = '<span style="color: #999; font-size: 12px;">Нет доступных действий</span>';
        }
        
        row.innerHTML = `
            <td>${startDateTime} ${deviceIndicator}</td>
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

// ============ ДАШБОРД ============

// Генерация HTML дашборда
function generateDashboardHTML() {
    const stats = calculateDashboardStats();
    
    return `
        <div class="dashboard-stats">
            <div class="stat-card">
                <h3>Всего заявок</h3>
                <div class="stat-value">${stats.totalRequests}</div>
                <div class="stat-change">За все время</div>
            </div>
            
            <div class="stat-card">
                <h3>В работе</h3>
                <div class="stat-value">${stats.pendingRequests}</div>
                <div class="stat-change">${stats.pendingPercent}% от общего</div>
            </div>
            
            <div class="stat-card">
                <h3>Завершено</h3>
                <div class="stat-value">${stats.completedRequests}</div>
                <div class="stat-change">${stats.completedPercent}% от общего</div>
            </div>
            
            <div class="stat-card">
                <h3>Среднее время ремонта</h3>
                <div class="stat-value">${stats.avgRepairTime} ч</div>
                <div class="stat-change">на заявку</div>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h3 style="color: #4CAF50; margin-top: 0;">Ключевые показатели</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div><strong>Общий простой:</strong> ${stats.totalDowntime} часов</div>
                <div><strong>Эффективность:</strong> ${stats.efficiency}% завершено вовремя</div>
                <div><strong>Заявок в этом месяце:</strong> ${stats.thisMonthRequests}</div>
                <div><strong>Завершено в этом месяце:</strong> ${stats.thisMonthCompleted}</div>
            </div>
        </div>
        
        ${stats.topEquipment.length > 0 ? `
        <div style="margin-top: 30px;">
            <h3 style="color: #2196F3; margin-bottom: 15px;">Наиболее проблемное оборудование</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background-color: #f0f0f0;">
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Оборудование</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Кол-во заявок</th>
                        <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">Общий простой (ч)</th>
                    </tr>
                </thead>
                <tbody>
                    ${stats.topEquipment.map(item => `
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">${truncateText(item.equipmentName, 40)}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${item.count}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">${item.totalDowntime.toFixed(1)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ` : ''}
        
        <div style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
            Данные обновлены: ${new Date().toLocaleString('ru-RU')}
        </div>
    `;
}

// Расчет статистики для дашборда
function calculateDashboardStats() {
    const totalRequests = repairRequests.length;
    const pendingRequests = repairRequests.filter(req => req.status === 'pending').length;
    const completedRequests = repairRequests.filter(req => req.status === 'completed').length;
    
    const totalDowntime = repairRequests.reduce((sum, req) => sum + (req.downtimeHours || 0), 0);
    
    const avgRepairTime = completedRequests > 0 
        ? (totalDowntime / completedRequests).toFixed(1) 
        : '0.0';
    
    const pendingPercent = totalRequests > 0 
        ? ((pendingRequests / totalRequests) * 100).toFixed(1) 
        : '0.0';
    
    const completedPercent = totalRequests > 0 
        ? ((completedRequests / totalRequests) * 100).toFixed(1) 
        : '0.0';
    
    // Текущий месяц
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonthRequests = repairRequests.filter(req => {
        return req.date && req.date.startsWith(currentMonth);
    }).length;
    
    const thisMonthCompleted = repairRequests.filter(req => {
        return req.status === 'completed' && 
               req.date && req.date.startsWith(currentMonth);
    }).length;
    
    // Эффективность (завершено в течение 24 часов)
    const completedWithinDay = repairRequests.filter(req => {
        if (req.status !== 'completed') return false;
        if (!req.downtimeHours) return false;
        return req.downtimeHours <= 24;
    }).length;
    
    const efficiency = completedRequests > 0 
        ? ((completedWithinDay / completedRequests) * 100).toFixed(1) 
        : '0.0';
    
    // Наиболее проблемное оборудование
    const equipmentStats = {};
    repairRequests.forEach(req => {
        const key = req.equipmentName || req.invNumber;
        if (key) {
            if (!equipmentStats[key]) {
                equipmentStats[key] = {
                    equipmentName: req.equipmentName,
                    count: 0,
                    totalDowntime: 0
                };
            }
            equipmentStats[key].count++;
            equipmentStats[key].totalDowntime += req.downtimeHours || 0;
        }
    });
    
    const topEquipment = Object.values(equipmentStats)
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    return {
        totalRequests,
        pendingRequests,
        completedRequests,
        totalDowntime: totalDowntime.toFixed(1),
        avgRepairTime,
        pendingPercent,
        completedPercent,
        thisMonthRequests,
        thisMonthCompleted,
        efficiency,
        topEquipment
    };
}

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

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
    
    window.addEventListener('online', () => {
        isOnline = true;
        showNotification('Соединение восстановлено', 'success');
        checkConnection();
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        showNotification('Потеряно соединение с интернетом', 'warning');
        checkConnection();
    });
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

// Инициализация при полной загрузке окна
window.addEventListener('load', function() {
    console.log('Окно полностью загружено');
});

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    showNotification('Произошла ошибка в приложении', 'error');
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
// ============ ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ============

// Функции, которые должны быть доступны глобально
window.updateEquipmentDB = updateEquipmentDB;
window.exportRepairData = exportRepairData;
window.exportForSync = exportForSync;
window.importForSync = importForSync;
window.showDashboard = showDashboard;
window.closeDashboard = closeDashboard;
window.deleteRequest = deleteRequest;
window.completeRequest = completeRequest;
window.logout = logout;

// Функции для работы с DOM
window.addEventListener('DOMContentLoaded', function() {
    // Инициализация происходит в основном скрипте
});

// Убедитесь, что эти функции объявлены
function updateEquipmentDB() {
    // Эта функция уже есть в коде
}

function exportRepairData() {
    // Эта функция уже есть в коде
}

function exportForSync() {
    // Эта функция уже есть в коде
}

function importForSync() {
    // Эта функция уже есть в коде
}

function showDashboard() {
    // Эта функция уже есть в коде
}

function closeDashboard() {
    // Эта функция уже есть в коде
}

function deleteRequest(id) {
    // Эта функция уже есть в коде
}

function completeRequest(id) {
    // Эта функция уже есть в коде
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
        redirectToLogin();
    }
}
