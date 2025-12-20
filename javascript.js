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
        
        // Показываем уведомление только если есть изменения
        const syncNotification = document.getElementById('syncNotification');
        if (syncNotification) {
            syncNotification.textContent = 'Синхронизация...';
            syncNotification.className = 'notification info';
            syncNotification.style.display = 'block';
        }
        
        // Здесь можно добавить логику синхронизации с внешним API
        // Например, отправка/получение заявок с сервера
        
        // Обновляем время последней синхронизации
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
        
        // Обновляем информацию о синхронизации
        updateSyncInfo();
        
        setTimeout(() => {
            if (syncNotification) {
                syncNotification.style.display = 'none';
            }
        }, 2000);
        
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
    
    // Добавляем информацию о синхронизации
    addSyncInfo();
    
    // Добавить обработчики событий
    addEventListeners();
}

// Добавить информацию о синхронизации
function addSyncInfo() {
    const formSection = document.getElementById('formSection');
    if (!formSection) return;
    
    const syncInfo = document.createElement('div');
    syncInfo.className = 'sync-info';
    syncInfo.innerHTML = `
        <div class="sync-status">
            <span id="syncInfo">Загрузка статуса синхронизации...</span>
            <span class="sync-indicator ${isOnline ? 'online' : 'offline'}"></span>
        </div>
    `;
    
    // Добавляем после кнопок
    const buttonGroup = formSection.querySelector('.button-group');
    if (buttonGroup) {
        formSection.insertBefore(syncInfo, buttonGroup.nextSibling);
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

// Удалить ненужные функции синхронизации
window.exportForSync = undefined;
window.importForSync = undefined;

// ============ ПРОВЕРКА СОЕДИНЕНИЯ ============

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

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

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

// Очистка при закрытии
window.addEventListener('beforeunload', function() {
    if (syncInterval) {
        clearInterval(syncInterval);
    }
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
