// ============================================
// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ
// Облачная версия для GitHub Pages
// ============================================

// КОНФИГУРАЦИЯ
const APP_VERSION = '2.1.0';
const APP_NAME = 'Ремонтный журнал';
const EQUIPMENT_DB_URL = 'data/equipment_database.csv';

// ПЕРЕМЕННЫЕ ПРИЛОЖЕНИЯ
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = true;

// DOM ЭЛЕМЕНТЫ
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============================================
// ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ
// ============================================

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем приложение...');
    initApp();
});

// Инициализация приложения
function initApp() {
    console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
    
    // Инициализация DOM элементов
    initDOMElements();
    
    // Проверка аутентификации
    if (!checkAuthentication()) {
        return;
    }
    
    // Загружаем данные
    loadAllData();
    
    // Инициализируем интерфейс
    initializeInterface();
    
    // Проверяем соединение
    checkConnection();
    
    console.log('Приложение успешно инициализировано');
}

// Инициализация DOM элементов
function initDOMElements() {
    console.log('Инициализация DOM элементов...');
    
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
    
    console.log('DOM элементы инициализированы');
}

// Проверка аутентификации
function checkAuthentication() {
    console.log('Проверка аутентификации...');
    
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const savedUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!isAuthenticated || !savedUser) {
        console.log('Пользователь не авторизован, перенаправление на страницу входа');
        window.location.href = 'login.html';
        return false;
    }
    
    // Восстанавливаем пользователя
    currentUser = savedUser;
    console.log(`Авторизован: ${currentUser.name} (${currentUser.type})`);
    
    // Настраиваем интерфейс
    configureInterface(currentUser);
    
    // Отображаем информацию о пользователе
    displayUserInfo();
    
    return true;
}

// ============================================
// ФУНКЦИИ ИНТЕРФЕЙСА
// ============================================

// Настройка интерфейса в зависимости от прав доступа
function configureInterface(user) {
    if (!user) return;
    
    console.log('Настройка интерфейса для пользователя:', user.type);
    
    // Автоподстановка имени автора для авторов заявок
    if (user.type === 'author' && authorInput) {
        authorInput.value = user.name;
        authorInput.readOnly = true;
        authorInput.style.backgroundColor = '#f0f0f0';
    }
    
    // Скрываем/показываем элементы в зависимости от прав
    if (user.type === 'repair') {
        console.log('Настройка интерфейса для ремонтной службы');
        
        // Для ремонтной службы показываем только таблицу
        const elementsToHide = ['formSection', 'searchFilter', 'summarySection'];
        elementsToHide.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = 'none';
                console.log(`Скрыт элемент: ${id}`);
            }
        });
        
        // Обновляем заголовок
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
            pageTitle.textContent = 'Журнал заявок на ремонт оборудования';
        }
    }
    
    // Сохраняем пользователя в глобальной переменной
    window.currentUser = user;
    console.log('Пользователь сохранен в window.currentUser');
}

// Инициализация интерфейса
function initializeInterface() {
    console.log('Инициализация интерфейса...');
    
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
    
    // Добавляем поиск в выпадающий список инвентарных номеров
    addSearchToInventorySelect();
    
    console.log('Интерфейс инициализирован');
}

// Отображение информации о пользователе
function displayUserInfo() {
    console.log('Отображение информации о пользователе...');
    
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (userInfo && currentUser) {
        userInfo.style.display = 'flex';
        if (userName) userName.textContent = currentUser.name;
        if (userRole) userRole.textContent = `(${getRoleName(currentUser.type)})`;
        console.log('Информация о пользователе отображена');
    } else {
        console.warn('Не удалось отобразить информацию о пользователе');
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
// ГЛОБАЛЬНЫЕ ФУНКЦИИ ДЛЯ КНОПОК
// ============================================

// Выход из системы (глобальная функция)
window.logout = function() {
    console.log('Кнопка выхода нажата');
    
    if (confirm('Вы уверены, что хотите выйти?')) {
        console.log('Выход из системы...');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('isAuthenticated');
        window.location.href = 'login.html';
    }
};

// Импорт базы оборудования (глобальная функция)
window.importEquipmentDB = function() {
    console.log('Кнопка импорта базы оборудования нажата');
    
    if (!window.currentUser) {
        console.warn('Пользователь не авторизован');
        showAccessError();
        return;
    }
    
    console.log('Открытие диалога выбора файла...');
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,.json';
    
    // Добавляем стили для отладки
    input.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: pointer;
        z-index: 9999;
    `;
    
    input.onchange = function(event) {
        console.log('Файл выбран:', event.target.files[0]?.name);
        const file = event.target.files[0];
        if (!file) {
            console.log('Файл не выбран');
            return;
        }
        
        try {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    console.log('Файл прочитан, размер:', content.length, 'символов');
                    
                    if (file.name.endsWith('.csv')) {
                        // Парсинг CSV
                        equipmentDatabase = parseCSV(content);
                        console.log(`Загружено ${equipmentDatabase.length} записей из CSV`);
                        showNotification(`Загружено ${equipmentDatabase.length} записей из CSV`, 'success');
                    } else if (file.name.endsWith('.json')) {
                        // Парсинг JSON
                        const data = JSON.parse(content);
                        if (Array.isArray(data)) {
                            equipmentDatabase = data;
                            console.log(`Загружено ${equipmentDatabase.length} записей из JSON`);
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
            
            reader.onerror = function(error) {
                console.error('Ошибка чтения файла:', error);
                showNotification('Ошибка чтения файла', 'error');
            };
            
            reader.readAsText(file);
            
        } catch (error) {
            console.error('Ошибка при работе с файлом:', error);
            showNotification('Ошибка при работе с файлом', 'error');
        }
    };
    
    input.onclick = function(event) {
        console.log('Input clicked, event:', event);
    };
    
    // Удаляем старый input если есть
    const oldInput = document.querySelector('input[type="file"]');
    if (oldInput) oldInput.remove();
    
    // Добавляем input в DOM
    document.body.appendChild(input);
    
    // Программно кликаем по input
    console.log('Запуск клика по input...');
    setTimeout(() => {
        input.click();
        console.log('Клик выполнен');
    }, 100);
    
    // Удаляем input после использования
    setTimeout(() => {
        if (input.parentNode) {
            input.parentNode.removeChild(input);
            console.log('Input удален из DOM');
        }
    }, 1000);
};

// Экспорт заявок (глобальная функция)
window.exportRepairData = function() {
    console.log('Кнопка экспорта заявок нажата');
    
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
    
    // Освобождаем память
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    showNotification(`Экспортировано ${repairRequests.length} заявок`, 'success');
};

// Показать дашборд (глобальная функция)
window.showDashboard = function() {
    console.log('Кнопка дашборда нажата');
    
    const modal = document.getElementById('dashboardModal');
    const dashboardContent = document.getElementById('dashboardContent');
    
    if (!modal || !dashboardContent) {
        showNotification('Ошибка открытия дашборда', 'error');
        return;
    }
    
    // Генерируем содержимое дашборда
    dashboardContent.innerHTML = generateDashboardHTML();
    
    // Показываем модальное окно
    modal.style.display = 'block';
};

// Закрыть дашборд (глобальная функция)
window.closeDashboard = function() {
    console.log('Закрытие дашборда');
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Удаление заявки (глобальная функция)
window.deleteRequest = async function(id) {
    console.log(`Удаление заявки ID: ${id}`);
    
    if (!window.currentUser) {
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

// Завершение ремонта (глобальная функция)
window.completeRequest = async function(id) {
    console.log(`Завершение ремонта ID: ${id}`);
    
    if (!window.currentUser) {
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

// ============================================
// ДОБАВЛЕНИЕ ПОИСКА В ВЫПАДАЮЩИЙ СПИСОК
// ============================================

// Добавление поиска в выпадающий список инвентарных номеров
function addSearchToInventorySelect() {
    if (!invNumberSelect) return;
    
    console.log('Добавление поиска в выпадающий список...');
    
    // Сохраняем оригинальный select
    const originalSelect = invNumberSelect;
    
    // Создаем контейнер для поиска и select
    const container = document.createElement('div');
    container.className = 'searchable-select-container';
    container.style.position = 'relative';
    
    // Создаем поле для поиска
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.id = 'invNumberSearch';
    searchInput.placeholder = '🔍 Поиск по номеру или названию...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 10px;
        margin-bottom: 5px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
    `;
    
    // Создаем новый select для результатов поиска
    const newSelect = document.createElement('select');
    newSelect.id = 'invNumber';
    newSelect.name = 'invNumber';
    newSelect.required = true;
    newSelect.style.cssText = `
        width: 100%;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
        box-sizing: border-box;
        max-height: 200px;
        overflow-y: auto;
    `;
    
    // Копируем опции из оригинального select
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Выберите инвентарный номер';
    newSelect.appendChild(defaultOption);
    
    // Сохраняем все опции для фильтрации
    let allOptions = [];
    
    // Копируем остальные опции
    for (let i = 1; i < originalSelect.options.length; i++) {
        const option = originalSelect.options[i];
        const newOption = document.createElement('option');
        newOption.value = option.value;
        newOption.textContent = option.textContent;
        newOption.title = option.title;
        newSelect.appendChild(newOption.cloneNode(true));
        
        // Сохраняем опцию для фильтрации
        allOptions.push({
            element: newOption,
            text: option.textContent.toLowerCase(),
            value: option.value
        });
    }
    
    // Функция фильтрации
    function filterOptions(searchTerm) {
        const term = searchTerm.toLowerCase();
        newSelect.innerHTML = '';
        
        // Добавляем опцию по умолчанию
        newSelect.appendChild(defaultOption.cloneNode(true));
        
        // Фильтруем и добавляем подходящие опции
        allOptions.forEach(option => {
            if (option.text.includes(term) || option.value.includes(term)) {
                newSelect.appendChild(option.element.cloneNode(true));
            }
        });
        
        // Если есть результаты, показываем первый
        if (newSelect.options.length > 1) {
            newSelect.selectedIndex = 1;
            handleInvNumberChange.call(newSelect);
        } else {
            newSelect.selectedIndex = 0;
            // Очищаем связанные поля
            if (equipmentNameInput) equipmentNameInput.value = '';
            if (locationInput) locationInput.value = '';
            if (modelInput) modelInput.value = '';
            if (machineNumberInput) machineNumberInput.value = '';
        }
    }
    
    // Обработчик ввода в поле поиска
    searchInput.addEventListener('input', function() {
        filterOptions(this.value);
    });
    
    // Обработчик клика по полю поиска (очистка)
    searchInput.addEventListener('click', function() {
        this.select();
    });
    
    // Обработчик выбора в select
    newSelect.addEventListener('change', handleInvNumberChange);
    
    // Заменяем оригинальный select
    originalSelect.parentNode.replaceChild(container, originalSelect);
    container.appendChild(searchInput);
    container.appendChild(newSelect);
    
    // Обновляем ссылку на select
    invNumberSelect = newSelect;
    
    // Добавляем стили для контейнера
    const style = document.createElement('style');
    style.textContent = `
        .searchable-select-container select {
            display: block !important;
        }
        
        .searchable-select-container option {
            padding: 8px;
        }
        
        @media (max-width: 768px) {
            .searchable-select-container input,
            .searchable-select-container select {
                font-size: 16px !important;
            }
        }
    `;
    document.head.appendChild(style);
    
    console.log('Поиск добавлен в выпадающий список');
}

// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================

// Загрузка всех данных
async function loadAllData() {
    console.log('Загрузка всех данных...');
    
    try {
        await loadEquipmentDatabase();
        loadRepairRequests();
        applyFilters(); // Применяем фильтры после загрузки
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных', 'error');
    }
}

// Загрузка базы оборудования
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    try {
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
    console.log('Загрузка заявок...');
    
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
    
    console.log('Заполнение выпадающего списка...');
    
    // Проверяем, есть ли уже поисковое поле
    const searchContainer = document.querySelector('.searchable-select-container');
    
    if (searchContainer) {
        // Если уже есть поиск, обновляем только опции
        updateSearchableSelectOptions();
    } else {
        // Создаем обычный select
        createRegularSelect();
    }
}

// Обновление опций в поисковом select
function updateSearchableSelectOptions() {
    const searchInput = document.getElementById('invNumberSearch');
    const select = document.getElementById('invNumber');
    
    if (!select) return;
    
    // Очищаем select
    select.innerHTML = '';
    
    // Добавляем опцию по умолчанию
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Выберите инвентарный номер';
    select.appendChild(defaultOption);
    
    // Сохраняем все опции для фильтрации
    window.allEquipmentOptions = [];
    
    // Сортируем оборудование по инвентарному номеру
    equipmentDatabase.sort((a, b) => {
        const numA = parseInt(a.invNumber) || 0;
        const numB = parseInt(b.invNumber) || 0;
        return numA - numB;
    });
    
    // Добавляем опции
    equipmentDatabase.forEach(equipment => {
        const option = document.createElement('option');
        option.value = equipment.invNumber;
        
        // Обрезаем длинное название
        const shortName = equipment.name.length > 40 
            ? equipment.name.substring(0, 40) + '...' 
            : equipment.name;
        
        option.textContent = `${equipment.invNumber} - ${shortName}`;
        option.title = `${equipment.location} | ${equipment.name} (${equipment.model}) | Станок: ${equipment.machineNumber}`;
        select.appendChild(option);
        
        // Сохраняем для фильтрации
        window.allEquipmentOptions.push({
            element: option.cloneNode(true),
            text: option.textContent.toLowerCase(),
            value: equipment.invNumber
        });
    });
    
    // Если есть поисковый запрос, применяем фильтр
    if (searchInput && searchInput.value) {
        filterSearchableOptions(searchInput.value);
    }
    
    console.log(`Добавлено ${equipmentDatabase.length} опций в select`);
}

// Создание обычного select
function createRegularSelect() {
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
    
    console.log(`Добавлено ${equipmentDatabase.length} опций в обычный select`);
}

// Фильтрация опций в поисковом select
function filterSearchableOptions(searchTerm) {
    const select = document.getElementById('invNumber');
    if (!select || !window.allEquipmentOptions) return;
    
    const term = searchTerm.toLowerCase();
    select.innerHTML = '';
    
    // Добавляем опцию по умолчанию
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Выберите инвентарный номер';
    select.appendChild(defaultOption);
    
    // Фильтруем и добавляем подходящие опции
    window.allEquipmentOptions.forEach(option => {
        if (option.text.includes(term) || option.value.includes(term)) {
            select.appendChild(option.element.cloneNode(true));
        }
    });
    
    // Если есть результаты, показываем первый
    if (select.options.length > 1) {
        select.selectedIndex = 1;
        handleInvNumberChange.call(select);
    } else {
        select.selectedIndex = 0;
    }
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
    console.log('Добавление обработчиков событий...');
    
    // Обработчик изменения инвентарного номера
    if (invNumberSelect) {
        invNumberSelect.addEventListener('change', handleInvNumberChange);
        console.log('Обработчик добавлен для invNumberSelect');
    }
    
    // Обработчик отправки формы
    if (repairForm) {
        repairForm.addEventListener('submit', handleFormSubmit);
        console.log('Обработчик добавлен для repairForm');
    }
    
    // Обработчик очистки формы
    if (clearBtn) {
        clearBtn.addEventListener('click', clearForm);
        console.log('Обработчик добавлен для clearBtn');
    }
    
    // Обработчики фильтров
    if (searchInput) {
        searchInput.addEventListener('input', applyFilters);
        console.log('Обработчик добавлен для searchInput');
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
        console.log('Обработчик добавлен для statusFilter');
    }
    if (locationFilter) {
        locationFilter.addEventListener('change', applyFilters);
        console.log('Обработчик добавлен для locationFilter');
    }
    if (monthFilter) {
        monthFilter.addEventListener('change', applyFilters);
        console.log('Обработчик добавлен для monthFilter');
    }
    
    // Добавляем обработчик для поиска в инвентарном номере
    const invSearchInput = document.getElementById('invNumberSearch');
    if (invSearchInput) {
        invSearchInput.addEventListener('input', function() {
            filterSearchableOptions(this.value);
        });
        console.log('Обработчик добавлен для invNumberSearch');
    }
    
    console.log('Все обработчики событий добавлены');
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

// Обработчик изменения инвентарного номера
function handleInvNumberChange() {
    const selectedInvNumber = this.value;
    console.log('Выбран инвентарный номер:', selectedInvNumber);
    
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
            
            console.log('Поля автозаполнены для оборудования:', equipment.name);
        } else {
            console.warn('Оборудование не найдено для номера:', selectedInvNumber);
        }
    } else {
        // Очищаем поля
        if (equipmentNameInput) equipmentNameInput.value = '';
        if (locationInput) locationInput.value = '';
        if (modelInput) modelInput.value = '';
        if (machineNumberInput) machineNumberInput.value = '';
        console.log('Поля очищены');
    }
}

// Обработчик отправки формы
async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('Отправка формы...');
    
    // Проверка прав доступа
    if (!window.currentUser) {
        console.warn('Пользователь не авторизован');
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
        console.log('Создана новая заявка:', newRequest);
        
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
    console.log('Очистка формы...');
    
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
    const invSelect = document.getElementById('invNumber');
    if (invSelect) {
        invSelect.selectedIndex = 0;
        handleInvNumberChange.call(invSelect);
    }
    
    // Очищаем поле поиска если есть
    const searchInput = document.getElementById('invNumberSearch');
    if (searchInput) {
        searchInput.value = '';
    }
    
    console.log('Форма очищена');
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

// Остальной код остается таким же как в предыдущей версии...
// (функции renderRepairTable, formatDateTime, truncateText, applyFilters и т.д.)

// ... [Здесь должен быть остальной код из предыдущей версии] ...

console.log(`${APP_NAME} v${APP_VERSION} готов к работе!`);
