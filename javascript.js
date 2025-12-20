// ============================================
// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ
// Облачная версия для GitHub Pages
// ============================================

// КОНФИГУРАЦИЯ
const APP_VERSION = '2.0.0';
const APP_NAME = 'Ремонтный журнал';
const EQUIPMENT_DB_URL = 'data/equipment_database.csv';

// ПЕРЕМЕННЫЕ ПРИЛОЖЕНИЯ
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = true;

// DOM ЭЛЕМЕНТЫ
const repairForm = document.getElementById('repairForm');
const invNumberSelect = document.getElementById('invNumber');
const equipmentNameInput = document.getElementById('equipmentName');
const locationInput = document.getElementById('location');
const modelInput = document.getElementById('model');
const machineNumberInput = document.getElementById('machineNumber');
const authorInput = document.getElementById('author');
const clearBtn = document.getElementById('clearBtn');
const repairTableBody = document.getElementById('repairTableBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const locationFilter = document.getElementById('locationFilter');
const monthFilter = document.getElementById('monthFilter');
const totalRequestsElement = document.getElementById('totalRequests');
const pendingRequestsElement = document.getElementById('pendingRequests');
const completedRequestsElement = document.getElementById('completedRequests');
const totalDowntimeElement = document.getElementById('totalDowntime');

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

// Проверка аутентификации и инициализация
(function initApp() {
    console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
    
    // Проверка аутентификации
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!isAuthenticated || !savedUser) {
        console.log('Пользователь не авторизован, перенаправление на страницу входа');
        window.location.href = 'login.html';
        return;
    }
    
    // Восстанавливаем пользователя
    currentUser = savedUser;
    console.log(`Авторизован: ${currentUser.name} (${currentUser.type})`);
    
    // Настраиваем интерфейс
    configureInterface(currentUser);
    
    // Загружаем данные
    loadAllData();
    
    // Инициализируем интерфейс
    initializeInterface();
    
    // Отображаем информацию о пользователе
    displayUserInfo();
    
    // Проверяем соединение
    checkConnection();
    
    console.log('Приложение успешно инициализировано');
})();

// ============================================
// ФУНКЦИИ ИНИЦИАЛИЗАЦИИ
// ============================================

// Настройка интерфейса в зависимости от прав доступа
function configureInterface(user) {
    if (!user) return;
    
    // Автоподстановка имени автора для авторов заявок
    if (user.type === 'author') {
        if (authorInput) {
            authorInput.value = user.name;
            authorInput.readOnly = true;
            authorInput.style.backgroundColor = '#f0f0f0';
        }
    }
    
    // Скрываем/показываем элементы в зависимости от прав
    if (user.type === 'repair') {
        // Для ремонтной службы показываем только таблицу
        const elementsToHide = ['formSection', 'searchFilter', 'summarySection'];
        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.style.display = 'none';
        });
        
        // Обновляем заголовок
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = 'Журнал заявок на ремонт оборудования';
        }
        
        // Скрываем заголовки формы
        document.querySelectorAll('h2').forEach(h2 => {
            if (h2.textContent.includes('Новая заявка') || 
                h2.textContent.includes('Поиск')) {
                h2.style.display = 'none';
            }
        });
    }
    
    // Сохраняем пользователя в глобальной переменной
    window.currentUser = user;
}

// Инициализация интерфейса
function initializeInterface() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('date');
    const repairEndDateInput = document.getElementById('repairEndDate');
    
    if (dateInput) dateInput.value = today;
    if (repairEndDateInput) repairEndDateInput.value = today;
    
    // Устанавливаем текущее время по умолчанию
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const timeInput = document.getElementById('time');
    const repairEndTimeInput = document.getElementById('repairEndTime');
    
    if (timeInput) timeInput.value = timeString;
    if (repairEndTimeInput) repairEndTimeInput.value = timeString;
    
    // Добавляем обработчики событий
    addEventListeners();
    
    // Применяем фильтры по умолчанию
    applyFilters();
}

// Отображение информации о пользователе
function displayUserInfo() {
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userInfo && currentUser) {
        userInfo.style.display = 'flex';
        if (userName) userName.textContent = currentUser.name;
        if (userRole) userRole.textContent = `(${getRoleName(currentUser.type)})`;
    }
}

// Получение названия роли
function getRoleName(roleType) {
    const roles = {
        'admin': 'Администратор',
        'author': 'Автор заявки',
        'repair': 'Ремонтная служба'
    };
    return roles[roleType] || 'Пользователь';
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================

// Загрузка всех данных
async function loadAllData() {
    try {
        await loadEquipmentDatabase();
        loadRepairRequests();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Загрузка базы оборудования
async function loadEquipmentDatabase() {
    try {
        console.log('Загрузка базы оборудования...');
        
        // Пытаемся загрузить из CSV файла
        const response = await fetch(EQUIPMENT_DB_URL);
        
        if (response.ok) {
            const csvContent = await response.text();
            equipmentDatabase = parseCSV(csvContent);
            console.log(`Загружено ${equipmentDatabase.length} единиц оборудования из CSV`);
        } else {
            throw new Error('CSV файл не найден');
        }
    } catch (error) {
        console.warn('Не удалось загрузить CSV, используем локальные данные:', error);
        
        // Используем данные из localStorage
        const savedData = JSON.parse(localStorage.getItem('equipmentDatabase'));
        
        if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
            console.log(`Загружено ${equipmentDatabase.length} единиц оборудования из localStorage`);
        } else {
            // Используем тестовые данные
            equipmentDatabase = getDefaultEquipmentDatabase();
            console.log('Используются тестовые данные оборудования');
        }
    }
    
    // Сохраняем в localStorage для офлайн-работы
    localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
    
    // Обновляем интерфейс
    populateInvNumberSelect();
    populateLocationFilter();
}

// Загрузка заявок
function loadRepairRequests() {
    const savedRequests = JSON.parse(localStorage.getItem('repairRequests'));
    
    if (savedRequests && Array.isArray(savedRequests)) {
        repairRequests = savedRequests;
        console.log(`Загружено ${repairRequests.length} заявок из localStorage`);
    } else {
        repairRequests = [];
        console.log('Нет сохраненных заявок');
    }
    
    // Обновляем интерфейс
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

// ============================================
// ФУНКЦИИ ИНТЕРФЕЙСА
// ============================================

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
    
    // Сортируем оборудование по инвентарному номеру
    equipmentDatabase.sort((a, b) => {
        const numA = parseInt(a.invNumber) || 0;
        const numB = parseInt(b.invNumber) || 0;
        return numA - numB;
    });
    
    // Заполняем список
    equipmentDatabase.forEach(equipment => {
        const option = document.createElement('option');
        option.value = equipment.invNumber;
        
        // Обрезаем длинное название
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
    
    // Собираем уникальные участки
    const locations = [...new Set(equipmentDatabase.map(item => item.location).filter(loc => loc))];
    locations.sort();
    
    // Заполняем фильтр
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
    
    // Суммируем время простоя
    const totalDowntime = repairRequests.reduce((sum, req) => sum + (req.downtimeHours || 0), 0);
    
    // Обновляем DOM элементы
    if (totalRequestsElement) totalRequestsElement.textContent = totalRequests;
    if (pendingRequestsElement) pendingRequestsElement.textContent = pendingRequests;
    if (completedRequestsElement) completedRequestsElement.textContent = completedRequests;
    if (totalDowntimeElement) totalDowntimeElement.textContent = totalDowntime.toFixed(1) + ' ч';
}

// Добавление обработчиков событий
function addEventListeners() {
    // Обработчик изменения инвентарного номера
    if (invNumberSelect) {
        invNumberSelect.addEventListener('change', handleInvNumberChange);
    }
    
    // Обработчик отправки формы
    if (repairForm) {
        repairForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Обработчик очистки формы
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
    }
    
    // Обработчики фильтров
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (locationFilter) locationFilter.addEventListener('change', applyFilters);
    if (monthFilter) monthFilter.addEventListener('change', applyFilters);
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

// Обработчик изменения инвентарного номера
function handleInvNumberChange() {
    const selectedInvNumber = this.value;
    
    if (selectedInvNumber) {
        // Находим оборудование по инвентарному номеру
        const equipment = equipmentDatabase.find(item => item.invNumber === selectedInvNumber);
        
        if (equipment) {
            // Автозаполнение полей
            if (equipmentNameInput) equipmentNameInput.value = equipment.name;
            if (locationInput) locationInput.value = equipment.location;
            if (modelInput) modelInput.value = equipment.model;
            
            // Автозаполнение номера станка
            if (machineNumberInput && equipment.machineNumber && equipment.machineNumber !== '-') {
                machineNumberInput.value = equipment.machineNumber;
            }
        }
    } else {
        // Очищаем поля
        if (equipmentNameInput) equipmentNameInput.value = '';
        if (locationInput) locationInput.value = '';
        if (modelInput) modelInput.value = '';
        if (machineNumberInput) machineNumberInput.value = '';
    }
}

// Обработчик отправки формы
async function handleFormSubmit(e) {
    e.preventDefault();
    
    // Проверка прав доступа
    if (!window.currentUser || !window.currentUser.permissions || !window.currentUser.permissions.canAdd) {
        showAccessError();
        return;
    }
    
    // Валидация формы
    if (!validateForm()) {
        return;
    }
    
    try {
        // Создаем новую заявку
        const newRequest = createRequestFromForm();
        
        // Добавляем заявку
        await addRepairRequest(newRequest);
        
        // Обновляем интерфейс
        renderRepairTable();
        updateSummary();
        
        // Очищаем форму
        clearForm();
        
        // Показываем уведомление
        showNotification('Заявка успешно добавлена!', 'success');
        
    } catch (error) {
        console.error('Ошибка при добавлении заявки:', error);
        showNotification('Ошибка при добавлении заявки', 'error');
    }
}

// Валидация формы
function validateForm() {
    // Проверка инвентарного номера
    const invNumber = document.getElementById('invNumber')?.value;
    if (!invNumber) {
        showNotification('Пожалуйста, выберите инвентарный номер', 'warning');
        document.getElementById('invNumber')?.focus();
        return false;
    }
    
    // Проверка описания неисправности
    const faultDescription = document.getElementById('faultDescription')?.value;
    if (!faultDescription || faultDescription.trim().length < 5) {
        showNotification('Пожалуйста, подробно опишите неисправность (минимум 5 символов)', 'warning');
        document.getElementById('faultDescription')?.focus();
        return false;
    }
    
    return true;
}

// Создание заявки из данных формы
function createRequestFromForm() {
    // Определяем автора
    let authorName = window.currentUser.name;
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

// Очистка формы
function clearForm() {
    if (!repairForm) return;
    
    repairForm.reset();
    
    // Очищаем автозаполненные поля
    if (equipmentNameInput) equipmentNameInput.value = '';
    if (locationInput) locationInput.value = '';
    if (modelInput) modelInput.value = '';
    if (machineNumberInput) machineNumberInput.value = '';
    
    // Автоподстановка имени автора
    if (authorInput && window.currentUser) {
        if (window.currentUser.type === 'author') {
            authorInput.value = window.currentUser.name;
        } else {
            authorInput.value = '';
        }
    }
    
    // Устанавливаем дату и время по умолчанию
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
    
    // Сбрасываем выпадающий список
    if (invNumberSelect) {
        invNumberSelect.selectedIndex = 0;
        handleInvNumberChange.call(invNumberSelect);
    }
}

// ============================================
// РАБОТА С ЗАЯВКАМИ
// ============================================

// Добавление заявки
async function addRepairRequest(request) {
    // Добавляем в массив
    repairRequests.push(request);
    
    // Сохраняем в localStorage
    localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
    
    console.log(`Заявка добавлена: ${request.equipmentName} (ID: ${request.id})`);
    return request;
}

// Удаление заявки
window.deleteRequest = async function(id) {
    if (!window.currentUser || !window.currentUser.permissions || !window.currentUser.permissions.canDelete) {
        showAccessError();
        return;
    }
    
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        // Удаляем из массива
        repairRequests = repairRequests.filter(request => request.id !== id);
        
        // Сохраняем в localStorage
        localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
        
        // Обновляем интерфейс
        renderRepairTable();
        updateSummary();
        
        showNotification('Заявка успешно удалена', 'success');
        
    } catch (error) {
        console.error('Ошибка при удалении заявки:', error);
        showNotification('Ошибка при удалении заявки', 'error');
    }
};

// Завершение ремонта
window.completeRequest = async function(id) {
    if (!window.currentUser || !window.currentUser.permissions || !window.currentUser.permissions.canComplete) {
        showAccessError();
        return;
    }
    
    const request = repairRequests.find(req => req.id === id);
    if (!request) {
        showNotification('Заявка не найдена', 'error');
        return;
    }
    
    // Запрашиваем данные
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toLocaleTimeString('ru-RU', {hour12: false, hour: '2-digit', minute:'2-digit'});
    
    const repairEndDate = prompt('Введите дату окончания ремонта (ГГГГ-ММ-ДД):', currentDate);
    if (!repairEndDate) return;
    
    const repairEndTime = prompt('Введите время окончания ремонта (ЧЧ:ММ):', currentTime);
    if (!repairEndTime) return;
    
    const downtimeCount = prompt('Введите количество простоев:', '1') || '1';
    
    // Вычисляем время простоя
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
    
    // Сохраняем изменения
    localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
    
    // Обновляем интерфейс
    renderRepairTable();
    updateSummary();
    
    showNotification(`Ремонт завершен! Время простоя: ${downtimeHours.toFixed(1)} ч`, 'success');
};

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

// ============================================
// ОТОБРАЖЕНИЕ ТАБЛИЦЫ
// ============================================

// Отображение таблицы с заявками
function renderRepairTable(filteredRequests = null) {
    if (!repairTableBody) return;
    
    const requestsToRender = filteredRequests || repairRequests;
    const permissions = window.currentUser ? window.currentUser.permissions : {};
    
    // Сортируем по дате (новые сверху)
    requestsToRender.sort((a, b) => {
        const dateA = new Date(a.date + 'T' + a.time);
        const dateB = new Date(b.date + 'T' + b.time);
        return dateB - dateA;
    });
    
    // Очищаем таблицу
    repairTableBody.innerHTML = '';
    
    // Если нет заявок
    if (requestsToRender.length === 0) {
        const emptyRow = document.createElement('tr');
        emptyRow.innerHTML = `
            <td colspan="15" style="text-align: center; padding: 30px; color: #666;">
                <div style="font-size: 18px; margin-bottom: 10px;">📭</div>
                <strong>Нет заявок на ремонт</strong>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Создайте первую заявку</p>
            </td>
        `;
        repairTableBody.appendChild(emptyRow);
        return;
    }
    
    // Заполняем таблицу
    requestsToRender.forEach(request => {
        const row = document.createElement('tr');
        
        // Форматируем дату и время начала
        const startDateTime = formatDateTime(request.date, request.time);
        
        // Форматируем дату и время окончания
        let endDateTimeDisplay = '-';
        if (request.repairEndDate && request.repairEndTime && request.status === 'completed') {
            endDateTimeDisplay = formatDateTime(request.repairEndDate, request.repairEndTime);
        } else if (request.status === 'completed') {
            endDateTimeDisplay = 'Завершено';
        }
        
        // Вычисляем время простоя
        let downtimeHours = request.downtimeHours || 0;
        if (request.status === 'completed' && request.repairEndDate && request.repairEndTime) {
            downtimeHours = calculateDowntimeHours(
                request.date, 
                request.time, 
                request.repairEndDate, 
                request.repairEndTime
            );
        }
        
        // Определяем статус
        const statusText = request.status === 'pending' ? 'В ремонте' : 'Завершено';
        const statusClass = request.status === 'pending' ? 'status-pending' : 'status-completed';
        
        // Создаем кнопки действий
        let actionButtons = '';
        
        if (permissions.canDelete) {
            actionButtons += `<button class="btn btn-delete" onclick="deleteRequest(${request.id})" title="Удалить">🗑️ Удалить</button>`;
        }
        
        if (request.status === 'pending' && permissions.canComplete) {
            actionButtons += `<button class="btn" style="background-color: #2196F3; padding: 6px 12px; font-size: 13px;" onclick="completeRequest(${request.id})" title="Завершить ремонт">✅ Завершить</button>`;
        }
        
        // Если нет доступных действий
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

// Форматирование даты и времени
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

// Обрезка длинного текста
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================
// ФИЛЬТРАЦИЯ И ПОИСК
// ============================================

// Применение фильтров
function applyFilters() {
    let filtered = [...repairRequests];
    
    // Фильтр по поисковому запросу
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
    
    // Фильтр по статусу
    const statusValue = statusFilter?.value || 'all';
    if (statusValue !== 'all') {
        filtered = filtered.filter(request => request.status === statusValue);
    }
    
    // Фильтр по участку
    const locationValue = locationFilter?.value || 'all';
    if (locationValue !== 'all') {
        filtered = filtered.filter(request => request.location === locationValue);
    }
    
    // Фильтр по месяцу
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
    
    // Отображаем отфильтрованные данные
    renderRepairTable(filtered);
}

// ============================================
// ИМПОРТ/ЭКСПОРТ ДАННЫХ
// ============================================

// Импорт базы оборудования
window.importEquipmentDB = function() {
    if (!window.currentUser || !window.currentUser.permissions || !window.currentUser.permissions.canAdd) {
        showAccessError();
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,.json';
    
    input.onchange = async function(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    
                    if (file.name.endsWith('.csv')) {
                        // Парсинг CSV
                        equipmentDatabase = parseCSV(content);
                        showNotification(`Загружено ${equipmentDatabase.length} записей из CSV`, 'success');
                    } else if (file.name.endsWith('.json')) {
                        // Парсинг JSON
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
                    
                    // Сохраняем в localStorage
                    localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
                    
                    // Обновляем интерфейс
                    populateInvNumberSelect();
                    populateLocationFilter();
                    
                } catch (error) {
                    console.error('Ошибка обработки файла:', error);
                    showNotification('Ошибка обработки файла: ' + error.message, 'error');
                }
            };
            
            reader.readAsText(file);
            
        } catch (error) {
            console.error('Ошибка чтения файла:', error);
            showNotification('Ошибка чтения файла', 'error');
        }
    };
    
    input.click();
};

// Экспорт заявок
window.exportRepairData = function() {
    if (repairRequests.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Создаем CSV содержимое
    let csvContent = "Дата;Время;Автор;Участок;Инв.номер;Оборудование;Модель;Номер станка;Неисправность;Дата окончания;Время окончания;Статус;Кол-во простоев;Время простоя;Номенклатура\n";
    
    repairRequests.forEach(request => {
        csvContent += `"${request.date || ''}";"${request.time || ''}";"${request.author || ''}";"${request.location || ''}";"${request.invNumber || ''}";"${request.equipmentName || ''}";"${request.model || ''}";"${request.machineNumber || ''}";"${request.faultDescription || ''}";"${request.repairEndDate || ''}";"${request.repairEndTime || ''}";"${request.status || ''}";"${request.downtimeCount || 0}";"${request.downtimeHours || 0}";"${request.productionItem || ''}"\n`;
    });
    
    // Создаем и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `заявки_на_ремонт_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Экспортировано ${repairRequests.length} заявок`, 'success');
};

// Экспорт базы оборудования
window.exportEquipmentDB = function() {
    if (equipmentDatabase.length === 0) {
        showNotification('База оборудования пуста', 'warning');
        return;
    }
    
    // Создаем CSV содержимое
    let csvContent = "Участок;Инвентарный номер;Наименование оборудования;Модель;Номер станка\n";
    
    equipmentDatabase.forEach(item => {
        csvContent += `${item.location};${item.invNumber};"${item.name}";"${item.model}";"${item.machineNumber}"\n`;
    });
    
    // Создаем и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", `база_оборудования_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification(`Экспортировано ${equipmentDatabase.length} позиций`, 'success');
};

// ============================================
// ДАШБОРД
// ============================================

// Показать дашборд
window.showDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (!modal || !dashboardContent) return;
    
    // Генерируем содержимое дашборда
    dashboardContent.innerHTML = generateDashboardHTML();
    
    // Показываем модальное окно
    modal.style.display = 'block';
    
    // Инициализируем графики
    setTimeout(initializeCharts, 100);
};

// Закрыть дашборд
window.closeDashboard = function() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Генерация HTML для дашборда
function generateDashboardHTML() {
    const stats = calculateDashboardStats();
    
    return `
        <div class="dashboard-stats">
            <div class="stat-card">
                <h3>📊 Всего заявок</h3>
                <div class="stat-value">${stats.totalRequests}</div>
                <div class="stat-change">За все время</div>
            </div>
            
            <div class="stat-card">
                <h3>🔧 В работе</h3>
                <div class="stat-value">${stats.pendingRequests}</div>
                <div class="stat-change">${stats.pendingPercent}% от общего</div>
            </div>
            
            <div class="stat-card">
                <h3>✅ Завершено</h3>
                <div class="stat-value">${stats.completedRequests}</div>
                <div class="stat-change">${stats.completedPercent}% от общего</div>
            </div>
            
            <div class="stat-card">
                <h3>⏱️ Среднее время ремонта</h3>
                <div class="stat-value">${stats.avgRepairTime} ч</div>
                <div class="stat-change">на заявку</div>
            </div>
        </div>
        
        <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
            <h3 style="color: #4CAF50; margin-top: 0;">📈 Ключевые показатели</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div><strong>Общий простой:</strong> ${stats.totalDowntime} часов</div>
                <div><strong>Эффективность:</strong> ${stats.efficiency}% завершено вовремя</div>
                <div><strong>Заявок в этом месяце:</strong> ${stats.thisMonthRequests}</div>
                <div><strong>Завершено в этом месяце:</strong> ${stats.thisMonthCompleted}</div>
                <div><strong>Самый проблемный участок:</strong> ${stats.mostProblematicLocation}</div>
                <div><strong>Среднее количество простоев:</strong> ${stats.avgDowntimeCount}</div>
            </div>
        </div>
        
        <div style="margin-top: 30px;">
            <h3 style="color: #4CAF50;">📋 Последние заявки</h3>
            <div style="max-height: 300px; overflow-y: auto;">
                ${generateRecentRequestsHTML()}
            </div>
        </div>
    `;
}

// Расчет статистики для дашборда
function calculateDashboardStats() {
    const totalRequests = repairRequests.length;
    const pendingRequests = repairRequests.filter(req => req.status === 'pending').length;
    const completedRequests = repairRequests.filter(req => req.status === 'completed').length;
    
    // Проценты
    const pendingPercent = totalRequests > 0 ? Math.round((pendingRequests / totalRequests) * 100) : 0;
    const completedPercent = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
    
    // Время простоя
    const totalDowntime = repairRequests.reduce((sum, req) => sum + (req.downtimeHours || 0), 0);
    const avgRepairTime = completedRequests > 0 ? (totalDowntime / completedRequests).toFixed(1) : '0.0';
    
    // Эффективность
    const timelyCompleted = repairRequests.filter(req => {
        if (req.status !== 'completed') return false;
        if (!req.repairEndDate || !req.date) return false;
        
        const startDate = new Date(req.date);
        const endDate = new Date(req.repairEndDate);
        const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
        
        return diffDays <= 7;
    }).length;
    
    const efficiency = completedRequests > 0 ? Math.round((timelyCompleted / completedRequests) * 100) : 0;
    
    // Заявки за текущий месяц
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const thisMonthRequests = repairRequests.filter(req => {
        const reqDate = new Date(req.date);
        return reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear;
    }).length;
    
    const thisMonthCompleted = repairRequests.filter(req => {
        if (req.status !== 'completed') return false;
        const reqDate = new Date(req.date);
        return reqDate.getMonth() === currentMonth && reqDate.getFullYear() === currentYear;
    }).length;
    
    // Самый проблемный участок
    const locationCounts = {};
    repairRequests.forEach(req => {
        locationCounts[req.location] = (locationCounts[req.location] || 0) + 1;
    });
    
    let mostProblematicLocation = '-';
    let maxLocationCount = 0;
    
    Object.entries(locationCounts).forEach(([location, count]) => {
        if (count > maxLocationCount) {
            maxLocationCount = count;
            mostProblematicLocation = location;
        }
    });
    
    // Среднее количество простоев
    const avgDowntimeCount = completedRequests > 0 ? 
        (repairRequests.reduce((sum, req) => sum + (req.downtimeCount || 0), 0) / completedRequests).toFixed(1) : '0.0';
    
    return {
        totalRequests,
        pendingRequests,
        completedRequests,
        pendingPercent,
        completedPercent,
        totalDowntime: totalDowntime.toFixed(1),
        avgRepairTime,
        efficiency,
        thisMonthRequests,
        thisMonthCompleted,
        mostProblematicLocation,
        avgDowntimeCount
    };
}

// Генерация HTML для последних заявок
function generateRecentRequestsHTML() {
    const recentRequests = [...repairRequests]
        .sort((a, b) => new Date(b.date + 'T' + b.time) - new Date(a.date + 'T' + a.time))
        .slice(0, 10);
    
    if (recentRequests.length === 0) {
        return '<p style="text-align: center; color: #666;">Нет заявок</p>';
    }
    
    let html = '<table style="width: 100%; border-collapse: collapse; font-size: 14px;">';
    html += '<tr style="background-color: #f0f0f0;"><th>Дата</th><th>Оборудование</th><th>Статус</th></tr>';
    
    recentRequests.forEach(req => {
        const statusColor = req.status === 'pending' ? '#ff9800' : '#4CAF50';
        html += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px;">${formatDateTime(req.date, req.time)}</td>
                <td style="padding: 8px;">${truncateText(req.equipmentName, 25)}</td>
                <td style="padding: 8px; color: ${statusColor}; font-weight: bold;">
                    ${req.status === 'pending' ? 'В работе' : 'Завершено'}
                </td>
            </tr>
        `;
    });
    
    html += '</table>';
    return html;
}

// Инициализация графиков (заглушка)
function initializeCharts() {
    // В будущем можно добавить Chart.js или другую библиотеку
    console.log('Графики инициализированы (заглушка)');
}

// ============================================
// УТИЛИТЫ И ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

// Проверка соединения
function checkConnection() {
    isOnline = navigator.onLine;
    
    // Обновляем статус
    updateConnectionStatus();
    
    // Слушаем события изменения соединения
    window.addEventListener('online', () => {
        isOnline = true;
        updateConnectionStatus();
        showNotification('Соединение восстановлено', 'success');
    });
    
    window.addEventListener('offline', () => {
        isOnline = false;
        updateConnectionStatus();
        showNotification('Работа в офлайн-режиме', 'warning');
    });
}

// Обновление статуса соединения
function updateConnectionStatus() {
    const statusElement = document.createElement('div');
    statusElement.id = 'connectionStatus';
    statusElement.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: bold;
        z-index: 9999;
        background-color: ${isOnline ? '#4CAF50' : '#ff9800'};
        color: white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 5px;
    `;
    
    statusElement.innerHTML = isOnline 
        ? '<span style="font-size: 16px;">●</span> Онлайн' 
        : '<span style="font-size: 16px;">●</span> Офлайн';
    
    // Удаляем старый статус
    const oldStatus = document.getElementById('connectionStatus');
    if (oldStatus) oldStatus.remove();
    
    // Добавляем новый
    document.body.appendChild(statusElement);
}

// Показать уведомление
function showNotification(message, type = 'info') {
    // Удаляем старое уведомление
    const oldNotification = document.querySelector('.custom-notification');
    if (oldNotification) oldNotification.remove();
    
    // Создаем новое уведомление
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: bold;
        z-index: 10000;
        background-color: ${colors[type] || colors.info};
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Автоматически скрываем через 5 секунд
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

// Показать ошибку доступа
function showAccessError() {
    const errorDiv = document.getElementById('accessRestricted');
    if (errorDiv) {
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 3000);
    }
}

// Выход из системы
window.logout = function() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated');
        window.location.href = 'login.html';
    }
};

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const modal = document.getElementById('dashboardModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Закрытие модального окна по ESC
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('dashboardModal');
    if (event.key === 'Escape' && modal && modal.style.display === 'block') {
        modal.style.display = 'none';
    }
});

// Добавляем стили для анимаций
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .dashboard-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin-bottom: 30px;
    }
    
    .stat-card {
        background-color: #f5f5f5;
        padding: 20px;
        border-radius: 8px;
        text-align: center;
        box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    
    .stat-card h3 {
        margin-top: 0;
        color: #4CAF50;
        font-size: 14px;
        text-transform: uppercase;
    }
    
    .stat-value {
        font-size: 32px;
        font-weight: bold;
        color: #333;
        margin: 10px 0;
    }
    
    .stat-change {
        font-size: 12px;
        color: #666;
    }
`;
document.head.appendChild(style);

// Сообщение при закрытии страницы
window.addEventListener('beforeunload', function(e) {
    // Автосохранение данных
    localStorage.setItem('repairRequests', JSON.stringify(repairRequests));
    localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
    
    // Для несохраненных данных можно показать предупреждение
    // e.returnValue = 'У вас есть несохраненные изменения. Вы уверены, что хотите уйти?';
});

console.log(`${APP_NAME} v${APP_VERSION} готов к работе!`);
