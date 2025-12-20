// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ

// Константы
const APP_VERSION = '2.0.1'; // Обновленная версия
const APP_NAME = 'Ремонтный журнал';
const EQUIPMENT_DB_URL = 'data/equipment_database.csv';

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = true;

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============ ИНИЦИАЛИЗАЦИЯ ============

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('Приложение запускается...');
    
    // Проверяем авторизацию
    checkAuthAndInit();
});

// Проверка авторизации и инициализация
function checkAuthAndInit() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!isAuthenticated || !savedUser) {
        // Если нет авторизации, скрываем контент
        document.getElementById('mainContainer').style.display = 'none';
        document.getElementById('loadingScreen').style.display = 'none';
        
        // Показываем сообщение или перенаправляем
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
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
    
    // Загрузка данных
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
        });
        
        invNumberSearch.addEventListener('focus', function() {
            invNumberSelect.size = 5; // Показываем несколько вариантов
        });
        
        invNumberSearch.addEventListener('blur', function() {
            setTimeout(() => {
                invNumberSelect.size = 1;
            }, 200);
        });
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

// ОСТАВЬТЕ ВСЕ ОСТАЛЬНЫЕ ФУНКЦИИ ИЗ ВАШЕГО javascript.js НЕИЗМЕННЫМИ
// ... весь остальной код javascript.js ...

// Проверка авторизации
function checkAuth() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!isAuthenticated || !savedUser) {
        window.location.href = 'login.html';
        return false;
    }
    
    currentUser = savedUser;
    console.log(`Пользователь: ${currentUser.name} (${currentUser.type})`);
    
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
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated');
        window.location.href = 'login.html';
    }
};

// Импорт базы оборудования
window.importEquipmentDB = function() {
    if (!currentUser) {
        showAccessError();
        return;
    }
    
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
                
                localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
                populateInvNumberSelect();
                populateLocationFilter();
                
            } catch (error) {
                console.error('Ошибка обработки файла:', error);
                showNotification('Ошибка обработки файла: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
};

// Экспорт заявок
window.exportRepairData = function() {
    if (!currentUser) {
        showAccessError();
        return;
    }
    
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
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
    if (!currentUser) {
        showAccessError();
        return;
    }
    
    const modal = document.getElementById('dashboardModal');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (!modal || !dashboardContent) {
        showNotification('Ошибка открытия дашборда', 'error');
        return;
    }
    
    dashboardContent.innerHTML = generateDashboardHTML();
    modal.style.display = 'block';
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
    if (!currentUser) {
        showAccessError();
        return;
    }
    
    if (currentUser.type !== 'admin') {
        showNotification('Только администраторы могут удалять заявки', 'error');
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        repairRequests = repairRequests.filter(request => request.id !== id);
        localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
        
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
    if (!currentUser) {
        showAccessError();
        return;
    }
    
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
    
    request.status = 'completed';
    request.repairEndDate = repairEndDate;
    request.repairEndTime = repairEndTime;
    request.downtimeCount = parseInt(downtimeCount) || 1;
    request.downtimeHours = downtimeHours;
    request.updatedAt = new Date().toISOString();
    
    localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
    
    renderRepairTable();
    updateSummary();
    
    showNotification(`Ремонт завершен! Время простоя: ${downtimeHours.toFixed(1)} ч`, 'success');
};

// ============ ЗАГРУЗКА ДАННЫХ ============

// Загрузка всех данных
async function loadAllData() {
    try {
        await loadEquipmentDatabase();
        loadRepairRequests();
        applyFilters();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Загрузка базы оборудования
async function loadEquipmentDatabase() {
    try {
        const response = await fetch(EQUIPMENT_DB_URL);
        
        if (response.ok) {
            const csvContent = await response.text();
            equipmentDatabase = parseCSV(csvContent);
        } else {
            throw new Error('CSV файл не найден');
        }
    } catch (error) {
        console.warn('Используем локальные данные:', error);
        
        const savedData = JSON.parse(localStorage.getItem('equipmentDatabase'));
        
        if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
        } else {
            equipmentDatabase = getDefaultEquipmentDatabase();
        }
    }
    
    localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
    
    populateInvNumberSelect();
    populateLocationFilter();
}

// Загрузка заявок
function loadRepairRequests() {
    const savedRequests = JSON.parse(localStorage.getItem('repairRequests'));
    
    if (savedRequests && Array.isArray(savedRequests)) {
        repairRequests = savedRequests;
    } else {
        repairRequests = [];
    }
    
    renderRepairTable();
    updateSummary();
}

// Парсинг CSV
function parseCSV(csvContent) {
    const equipment = [];
    const lines = csvContent.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line) {
            const parts = line.split(';');
            
            if (parts.length >= 5) {
                equipment.push({
                    location: parts[0]?.trim() || '',
                    invNumber: parts[1]?.trim() || '',
                    name: parts[2]?.replace(/"/g, '').trim() || '',
                    model: parts[3]?.replace(/"/g, '').trim() || '-',
                    machineNumber: parts[4]?.replace(/"/g, '').trim() || '-'
                });
            }
        }
    }
    
    return equipment;
}

// Тестовые данные оборудования
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
    const repairEndDateInput = document.getElementById('repairEndDate');
    const repairEndTimeInput = document.getElementById('repairEndTime');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
    if (repairEndDateInput) repairEndDateInput.value = today;
    if (repairEndTimeInput) repairEndTimeInput.value = timeString;
    
    // Добавить обработчики событий
    addEventListeners();
}

// Заполнение выпадающего списка инвентарных номеров
function populateInvNumberSelect() {
    if (!invNumberSelect) return;
    
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    if (equipmentDatabase.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "База оборудования пуста...";
        option.disabled = true;
        invNumberSelect.appendChild(option);
        return;
    }
    
    equipmentDatabase.sort((a, b) => {
        const numA = parseInt(a.invNumber) || 0;
        const numB = parseInt(b.invNumber) || 0;
        return numA - numB;
    });
    
    equipmentDatabase.forEach(equipment => {
        const option = document.createElement('option');
        option.value = equipment.invNumber;
        
        const shortName = equipment.name.length > 40 
            ? equipment.name.substring(0, 40) + '...' 
            : equipment.name;
        
        option.textContent = `${equipment.invNumber} - ${shortName}`;
        option.title = `${equipment.location} | ${equipment.name} (${equipment.model}) | Станок: ${equipment.machineNumber}`;
        invNumberSelect.appendChild(option);
    });
}

// Заполнение фильтра участков
function populateLocationFilter() {
    if (!locationFilter) return;
    
    locationFilter.innerHTML = '<option value="all">Все участки</option>';
    
    if (equipmentDatabase.length === 0) return;
    
    const locations = [...new Set(equipmentDatabase.map(item => item.location).filter(loc => loc))];
    locations.sort();
    
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
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
    
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (locationFilter) locationFilter.addEventListener('change', applyFilters);
    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
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
    
    if (!currentUser) {
        showAccessError();
        return;
    }
    
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
        id: Date.now(),
        date: document.getElementById('date')?.value || '',
        time: document.getElementById('time')?.value || '',
        author: authorName,
        location: document.getElementById('location')?.value || '',
        invNumber: document.getElementById('invNumber')?.value || '',
        equipmentName: document.getElementById('equipmentName')?.value || '',
        model: document.getElementById('model')?.value || '',
        machineNumber: document.getElementById('machineNumber')?.value || '-',
        faultDescription: document.getElementById('faultDescription')?.value || '',
        repairEndDate: document.getElementById('repairEndDate')?.value || '',
        repairEndTime: document.getElementById('repairEndTime')?.value || '',
        status: 'pending',
        downtimeCount: 0,
        downtimeHours: 0,
        productionItem: document.getElementById('productionItem')?.value || '-',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// Добавить заявку
function addRepairRequest(request) {
    repairRequests.push(request);
    localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
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
    const repairEndDateInput = document.getElementById('repairEndDate');
    const repairEndTimeInput = document.getElementById('repairEndTime');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
    if (repairEndDateInput) repairEndDateInput.value = today;
    if (repairEndTimeInput) repairEndTimeInput.value = timeString;
    
    const invSelect = document.getElementById('invNumber');
    if (invSelect) {
        invSelect.selectedIndex = 0;
        handleInvNumberChange.call(invSelect);
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
        return Math.round(diffHours * 100) / 100;
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
                <div style="font-size: 18px; margin-bottom: 10px;"></div>
                <strong>Нет заявок на ремонт</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Создайте первую заявку</p>
            </td>
        `;
        repairTableBody.appendChild(emptyRow);
        return;
    }
    
    requestsToRender.forEach(request => {
        const row = document.createElement('tr');
        
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
        const date = new Date(dateString);
        
        if (timeString) {
            const [hours, minutes] = timeString.split(':');
            date.setHours(parseInt(hours) || 0, parseInt(minutes) || 0);
            
            return date.toLocaleDateString('ru-RU') + ' ' + 
                   date.getHours().toString().padStart(2, '0') + ':' + 
                   date.getMinutes().toString().padStart(2, '0');
        }
        
        return date.toLocaleDateString('ru-RU');
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
                            <td style="padding: 10px; border: 1px solid #ddd;">${item.equipmentName}</td>
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
            connectionStatus.innerHTML = 'Онлайн';
            connectionStatus.style.color = '#4CAF50';
        } else {
            connectionStatus.innerHTML = 'Оффлайн';
            connectionStatus.style.color = '#f44336';
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
    notification.className = 'notification';
    
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            notification.style.display = 'none';
            notification.style.opacity = '1';
        }, 300);
    }, 3000);
}

// Показать ошибку доступа
function showAccessError() {
    showNotification('Ошибка доступа. Пожалуйста, войдите в систему.', 'error');
    setTimeout(() => {
        window.location.href = 'login.html';
    }, 2000);
}

// Добавление стилей для дашборда
function addDashboardStyles() {
    const styles = `
        .dashboard-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        
        .stat-card {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2196F3;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .stat-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
            font-weight: normal;
        }
        
        .stat-value {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin-bottom: 5px;
        }
        
        .stat-change {
            font-size: 12px;
            color: #4CAF50;
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

// Инициализация при полной загрузке окна
window.addEventListener('load', function() {
    console.log('Окно полностью загружено');
    addDashboardStyles();
});

console.log('Приложение готово к работе!');
