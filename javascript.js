// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ С ЛОКАЛЬНОЙ СИНХРОНИЗАЦИЕЙ

// Константы
const APP_VERSION = '4.0.0';
const APP_NAME = 'Ремонтный журнал';

// Ссылки на GitHub для данных
const GITHUB_REPO = 'aitof-stack/repair-journal';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/main/';
const EQUIPMENT_DB_URL = GITHUB_RAW_URL + 'equipment_database.csv';
const GITHUB_PAGES_URL = 'https://aitof-stack.github.io/repair-journal/';

// Ключи для хранения данных
const STORAGE_KEYS = {
    EQUIPMENT_DB: 'equipmentDatabase_v4',
    REPAIR_REQUESTS: 'repairRequests_v4',
    CURRENT_USER: 'repair_journal_currentUser',
    AUTH_STATUS: 'repair_journal_isAuthenticated',
    DB_LAST_UPDATED: 'equipmentDBLastUpdated_v4',
    REQUESTS_LAST_UPDATED: 'requestsLastUpdated_v4',
    LAST_SYNC_TIME: 'lastSyncTime_v4',
    SYNC_DATA: 'syncData_v4',
    DEVICE_ID: 'deviceId_v4',
    DELETED_REQUESTS: 'deletedRequests_v4'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = navigator.onLine;
let isDBLoading = false;
let syncInProgress = false;
let deviceId = null;
let deletedRequests = [];

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============ ИНИЦИАЛИЗАЦИЯ ============

// Генерация уникального ID устройства
function generateDeviceId() {
    let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    if (!id) {
        id = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
    }
    return id;
}

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
    
    // Генерируем ID устройства
    deviceId = generateDeviceId();
    console.log('Device ID:', deviceId);
    
    // Загружаем список удаленных заявок
    loadDeletedRequests();
    
    // Проверяем авторизацию
    checkAuthAndInit();
});

// Загрузить список удаленных заявок
function loadDeletedRequests() {
    try {
        const deleted = localStorage.getItem(STORAGE_KEYS.DELETED_REQUESTS);
        if (deleted) {
            deletedRequests = JSON.parse(deleted) || [];
            console.log('Загружено удаленных заявок:', deletedRequests.length);
        }
    } catch (error) {
        console.error('Ошибка загрузки удаленных заявок:', error);
        deletedRequests = [];
    }
}

// Сохранить список удаленных заявок
function saveDeletedRequests() {
    try {
        localStorage.setItem(STORAGE_KEYS.DELETED_REQUESTS, JSON.stringify(deletedRequests));
    } catch (error) {
        console.error('Ошибка сохранения удаленных заявок:', error);
    }
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
    
    // Скрываем экран загрузки
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500);
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
    
    // Загрузка данных
    loadAllData();
    
    // Настройка интерфейса
    setupInterface();
    
    // Проверка соединения
    checkConnection();
    
    // Настройка поиска в выпадающем списке
    setupSearchableSelect();
    
    // Запуск автоматической синхронизации
    startAutoSync();
    
    console.log('Приложение успешно запущено');
}

// Начать автоматическую синхронизацию
function startAutoSync() {
    // Синхронизация при запуске если онлайн
    if (isOnline) {
        setTimeout(() => {
            window.syncAllData().catch(() => {
                console.log('Автоматическая синхронизация при запуске не удалась');
            });
        }, 3000);
    }
    
    // Синхронизация каждые 5 минут если онлайн
    setInterval(() => {
        if (isOnline && !syncInProgress) {
            window.syncAllData().catch(() => {
                console.log('Периодическая синхронизация не удалась');
            });
        }
    }, 300000); // 5 минут
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

// Синхронизация всех данных
window.syncAllData = async function() {
    if (!checkAuth()) return;
    
    if (syncInProgress) {
        showNotification('Синхронизация уже выполняется...', 'warning');
        return;
    }
    
    syncInProgress = true;
    showNotification('Начата синхронизация данных...', 'info');
    
    try {
        // 1. Сначала обновляем базу оборудования
        await loadEquipmentDatabase(true);
        
        // 2. Обновляем интерфейс
        renderRepairTable();
        updateSummary();
        updateDBButtonInfo();
        
        // 3. Показываем результат
        showNotification('Синхронизация завершена успешно!', 'success');
        
        // 4. Сохраняем время последней синхронизации
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации: ' + error.message, 'error');
    } finally {
        syncInProgress = false;
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
window.deleteRequest = async function(id) {
    if (!checkAuth()) return;
    
    if (currentUser.type !== 'admin') {
        showNotification('Только администраторы могут удалять заявки', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?\n\nУдаление приведет к полному удалению заявки на всех устройствах при синхронизации.')) {
        return;
    }
    
    try {
        const request = repairRequests.find(req => req.id === id);
        if (!request) {
            showNotification('Заявка не найдена', 'error');
            return;
        }
        
        // Добавляем ID в список удаленных
        if (!deletedRequests.includes(id)) {
            deletedRequests.push(id);
            saveDeletedRequests();
        }
        
        // Удаляем локально
        repairRequests = repairRequests.filter(req => req.id !== id);
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        
        renderRepairTable();
        updateSummary();
        
        showNotification('Заявка удалена', 'success');
        
        // Если онлайн, пытаемся синхронизировать
        if (isOnline) {
            setTimeout(() => {
                window.syncAllData().catch(() => {
                    console.log('Синхронизация не удалась');
                });
            }, 1000);
        }
        
    } catch (error) {
        console.error('Ошибка при удалении заявки:', error);
        showNotification('Ошибка при удалении заявки', 'error');
    }
};

// Завершить ремонт
window.completeRequest = async function(id) {
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
    
    // Обновляем заявку
    request.status = 'completed';
    request.repairEndDate = repairEndDate;
    request.repairEndTime = repairEndTime;
    request.downtimeCount = parseInt(downtimeCount) || 1;
    request.downtimeHours = downtimeHours;
    request.updatedAt = new Date().toISOString();
    request.completedBy = currentUser.name;
    
    // Сохраняем локально
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    showNotification('Ремонт завершен!', 'success');
    
    renderRepairTable();
    updateSummary();
};

// ============ ЗАГРУЗКА ДАННЫХ ============

// Загрузка всех данных
async function loadAllData() {
    try {
        showNotification('Загрузка данных...', 'info');
        
        // Загружаем параллельно
        await Promise.allSettled([
            loadEquipmentDatabase(),
            loadRepairRequests()
        ]);
        
        applyFilters();
        
        setTimeout(() => {
            const notification = document.getElementById('notification');
            if (notification && notification.textContent.includes('Загрузка данных')) {
                notification.style.display = 'none';
            }
        }, 2000);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных. Проверьте соединение.', 'error');
    }
}

// Загрузка базы оборудования
async function loadEquipmentDatabase(forceUpdate = false) {
    try {
        const lastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
        const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
        
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const shouldUpdate = forceUpdate || 
                            !lastUpdated || 
                            new Date(lastUpdated) < oneDayAgo ||
                            !savedData || 
                            savedData.length === 0;
        
        if (shouldUpdate && isOnline) {
            console.log('Загрузка базы оборудования с сервера...');
            
            const url = EQUIPMENT_DB_URL + '?t=' + Date.now();
            console.log('URL базы оборудования:', url);
            
            const response = await fetchWithTimeout(url, 15000);
            
            if (!response.ok) {
                throw new Error(`Ошибка HTTP ${response.status}: ${response.statusText}`);
            }
            
            const csvContent = await response.text();
            
            if (!csvContent || csvContent.trim().length === 0) {
                throw new Error('CSV файл пуст или не загружен');
            }
            
            console.log('CSV загружен, длина:', csvContent.length);
            
            equipmentDatabase = parseCSV(csvContent);
            
            if (equipmentDatabase.length === 0) {
                console.log('Содержимое CSV для отладки:', csvContent.substring(0, 1000));
                throw new Error('Не удалось загрузить данные оборудования');
            }
            
            localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
            localStorage.setItem(STORAGE_KEYS.DB_LAST_UPDATED, new Date().toISOString());
            
            console.log(`Загружена база: ${equipmentDatabase.length} записей`);
            
            if (!forceUpdate) {
                showNotification(`База оборудования обновлена (${equipmentDatabase.length} записей)`, 'success');
            }
            
        } else if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
            console.log('Загружена локальная база оборудования:', equipmentDatabase.length, 'записей');
            
            if (lastUpdated && new Date(lastUpdated) < oneDayAgo && isOnline) {
                console.log('Фоновая проверка обновлений базы...');
                setTimeout(() => {
                    loadEquipmentDatabase(true).catch(error => {
                        console.warn('Фоновая загрузка не удалась:', error.message);
                    });
                }, 5000);
            }
        } else {
            console.warn('Нет локальной базы и нет интернета');
            equipmentDatabase = getDefaultEquipmentDatabase();
            showNotification('Используется локальная база оборудования', 'warning');
        }
        
    } catch (error) {
        console.error('Ошибка загрузки базы оборудования:', error);
        
        const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
        
        if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
            console.log('Используем сохраненную базу после ошибки:', equipmentDatabase.length, 'записей');
            showNotification('Ошибка загрузки. Используется локальная версия базы', 'warning');
        } else {
            equipmentDatabase = getDefaultEquipmentDatabase();
            console.log('Используем базу по умолчанию:', equipmentDatabase.length, 'записей');
            showNotification('Нет подключения. Используется база по умолчанию.', 'error');
        }
    }
    
    populateInvNumberSelect();
    populateLocationFilter();
    updateDBButtonInfo();
    
    return equipmentDatabase.length;
}

// Загрузка заявок
async function loadRepairRequests() {
    try {
        console.log('Загрузка заявок...');
        
        // Загружаем локальные данные
        const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
        
        // Фильтруем удаленные заявки
        const filteredRequests = localRequests.filter(request => !deletedRequests.includes(request.id));
        
        repairRequests = filteredRequests;
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        
        console.log('Всего заявок после загрузки:', repairRequests.length);
        
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        repairRequests = [];
    }
    
    renderRepairTable();
    updateSummary();
}

// Парсинг CSV
function parseCSV(csvContent) {
    const equipment = [];
    const lines = csvContent.split('\n');
    
    console.log('Общее количество строк CSV:', lines.length);
    
    const firstLine = lines[0] || '';
    let delimiter = ';';
    
    if (firstLine.includes(';')) {
        delimiter = ';';
    } else if (firstLine.includes(',')) {
        delimiter = ',';
    } else if (firstLine.includes('\t')) {
        delimiter = '\t';
    }
    
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
            const parts = parseCSVLine(line, delimiter);
            
            if (parts.length >= 3) {
                const item = {
                    location: cleanValue(parts[0]),
                    invNumber: cleanValue(parts[1]),
                    name: cleanValue(parts[2]),
                    model: parts.length > 3 ? cleanValue(parts[3]) : '-',
                    machineNumber: parts.length > 4 ? cleanValue(parts[4]) : '-'
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
        return parseCSVAlternative(csvContent);
    }
    
    return equipment;
}

// Парсинг одной строки CSV
function parseCSVLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result.map(v => v.trim());
}

// Очистка значения
function cleanValue(value) {
    if (!value) return '';
    let cleaned = value.toString().replace(/^["']|["']$/g, '').trim();
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// Альтернативный парсинг CSV
function parseCSVAlternative(csvContent) {
    const equipment = [];
    const lines = csvContent.split('\n');
    
    console.log('Альтернативный парсинг, строк:', lines.length);
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (!line) continue;
        
        let parts = null;
        
        if (line.includes(';')) {
            parts = line.split(';').map(p => p.trim().replace(/^["']|["']$/g, ''));
        } else if (line.includes(',')) {
            parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        } else if (line.includes('\t')) {
            parts = line.split('\t').map(p => p.trim().replace(/^["']|["']$/g, ''));
        }
        
        if (parts && parts.length >= 3) {
            const item = {
                location: parts[0] || '',
                invNumber: parts[1] || '',
                name: parts[2] || '',
                model: parts[3] || '-',
                machineNumber: parts[4] || '-'
            };
            
            if (item.invNumber && 
                item.name && 
                item.name.length > 2 &&
                !item.name.toLowerCase().includes('наименование')) {
                equipment.push(item);
            }
        }
    }
    
    console.log('Альтернативным методом распарсено:', equipment.length, 'записей');
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

// ============ ИНТЕРФЕЙС ============

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
    
    addEventListeners();
    updateDBButtonInfo();
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
    
    window.addEventListener('online', () => {
        console.log('Интернет появился');
        isOnline = true;
        showNotification('Соединение восстановлено', 'success');
        checkConnection();
    });
    
    window.addEventListener('offline', () => {
        console.log('Интернет пропал');
        isOnline = false;
        showNotification('Потеряно соединение с интернетом', 'warning');
        checkConnection();
    });
}

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

// Fetch с таймаутом
function fetchWithTimeout(url, timeout = 10000) {
    return Promise.race([
        fetch(url, {
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json,text/plain,*/*'
            }
        }),
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Таймаут запроса')), timeout)
        )
    ]);
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
        id: Date.now() + Math.floor(Math.random() * 1000),
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
        createdBy: currentUser.name
    };
}

// Добавить заявку
async function addRepairRequest(request) {
    // Добавляем локально
    repairRequests.push(request);
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
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
                <strong>Нет заявок на ремонт</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Создайте первую заявку</p>
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
            actionButtons += `<button class="btn-delete" onclick="deleteRequest(${request.id})" title="Удалить">Удалить</button>`;
        }
        
        if (request.status === 'pending' && currentUser && 
            (currentUser.type === 'admin' || currentUser.type === 'repair')) {
            actionButtons += `<button class="btn-complete" onclick="completeRequest(${request.id})" title="Завершить ремонт">Завершить</button>`;
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
    const lastSyncTime = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
    const lastSync = lastSyncTime ? new Date(lastSyncTime).toLocaleString('ru-RU') : 'никогда';
    
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
            <h3 style="color: #4CAF50; margin-top: 0;">Статус синхронизации</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div><strong>Статус:</strong> <span style="color: ${isOnline ? '#4CAF50' : '#F44336'}">${isOnline ? 'Онлайн' : 'Оффлайн'}</span></div>
                <div><strong>Последняя синхронизация:</strong> ${lastSync}</div>
                <div><strong>Удалено заявок:</strong> ${deletedRequests.length}</div>
                <div><strong>Устройство:</strong> ${deviceId.substring(0, 15)}...</div>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h3 style="color: #4CAF50; margin-top: 0;">Ключевые показатели</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div><strong>Общий простой:</strong> ${stats.totalDowntime} часов</div>
                <div><strong>Эффективность:</strong> ${stats.efficiency}% завершено вовремя</div>
                <div><strong>Заявок в этом месяце:</strong> ${stats.thisMonthRequests}</div>
                <div><strong>Завершено в этом месяце:</strong> ${stats.thisMonthCompleted}</div>
                <div><strong>База оборудования:</strong> ${equipmentDatabase.length} записей</div>
                <div><strong>Пользователь:</strong> ${currentUser.name}</div>
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
        
        <div style="margin-top: 30px; text-align: center;">
            <button onclick="window.syncAllData()" style="
                background-color: #4CAF50;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            ">🔄 Синхронизировать все данные</button>
            
            <button onclick="window.updateEquipmentDB()" style="
                background-color: #2196F3;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            ">🔄 Обновить базу оборудования</button>
            
            <button onclick="window.exportRepairData()" style="
                background-color: #FF9800;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                margin: 10px;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            ">📥 Экспорт заявок</button>
        </div>
        
        <div style="margin-top: 30px; font-size: 12px; color: #666; text-align: center;">
            Данные обновлены: ${new Date().toLocaleString('ru-RU')}<br>
            Приложение: ${APP_NAME} v${APP_VERSION} | Устройство: ${deviceId.substring(0, 10)}...
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
    
    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonthRequests = repairRequests.filter(req => {
        return req.date && req.date.startsWith(currentMonth);
    }).length;
    
    const thisMonthCompleted = repairRequests.filter(req => {
        return req.status === 'completed' && 
               req.date && req.date.startsWith(currentMonth);
    }).length;
    
    const completedWithinDay = repairRequests.filter(req => {
        if (req.status !== 'completed') return false;
        if (!req.downtimeHours) return false;
        return req.downtimeHours <= 24;
    }).length;
    
    const efficiency = completedRequests > 0 
        ? ((completedWithinDay / completedRequests) * 100).toFixed(1) 
        : '0.0';
    
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
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1000);
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

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    showNotification('Произошла ошибка в приложении', 'error');
});

// Инициализация при полной загрузке
window.addEventListener('load', function() {
    console.log('Окно полностью загружено');
    
    // Проверяем, находимся ли мы на GitHub Pages
    if (window.location.href.includes('github.io')) {
        console.log('Работаем на GitHub Pages');
    }
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
