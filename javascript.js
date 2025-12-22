// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ 4.1.4
// УПРОЩЕННАЯ ВЕРСИЯ ДЛЯ СТАБИЛЬНОЙ РАБОТЫ

// Константы
const APP_VERSION = '4.1.4';
const APP_NAME = 'Ремонтный журнал';

// Настройки GitHub Gist
const GIST_ID = 'd356b02c2c182270935739995790fc20';
const GIST_FILENAME = 'repair_requests.json';

// Ключи для хранения данных
const STORAGE_KEYS = {
  EQUIPMENT_DB: 'equipmentDatabase_v4',
  REPAIR_REQUESTS: 'repairRequests_v4',
  CURRENT_USER: 'repair_journal_currentUser',
  AUTH_STATUS: 'repair_journal_isAuthenticated',
  DB_LAST_UPDATED: 'equipmentDBLastUpdated_v4',
  REQUESTS_LAST_UPDATED: 'requestsLastUpdated_v4',
  LAST_SYNC_TIME: 'lastSyncTime_v4',
  SYNC_PENDING: 'syncPendingRequests_v4',
  DEVICE_ID: 'deviceId_v4',
  GITHUB_TOKEN: 'github_token_secure'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = navigator.onLine;

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody;
let searchInput, statusFilter, locationFilter, monthFilter;
let totalRequestsElement, pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// ============ ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ ============

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
  
  // Проверяем соединение
  checkConnection();
  
  // Инициализируем интерфейс
  initInterface();
  
  // Проверяем авторизацию
  checkAuthAndLoad();
});

// Инициализация интерфейса
function initInterface() {
  try {
    // Инициализируем DOM элементы
    initDOMElements();
    
    // Настраиваем начальные значения
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    if (dateInput) dateInput.value = today;
    if (timeInput) timeInput.value = timeString;
    
    // Добавляем обработчики событий
    addEventListeners();
    
    console.log('Интерфейс инициализирован');
  } catch (error) {
    console.error('Ошибка инициализации интерфейса:', error);
  }
}

// Инициализация DOM элементов
function initDOMElements() {
  try {
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
  } catch (error) {
    console.error('Ошибка получения DOM элементов:', error);
  }
}

// Проверка авторизации и загрузка данных
function checkAuthAndLoad() {
  try {
    const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    
    if (!isAuthenticated || !savedUser) {
      redirectToLogin();
      return;
    }
    
    currentUser = JSON.parse(savedUser);
    console.log(`Пользователь: ${currentUser.name} (${currentUser.type})`);
    
    // Показываем интерфейс
    showMainInterface();
    
    // Загружаем данные
    loadAllData();
    
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    redirectToLogin();
  }
}

// Показать основной интерфейс
function showMainInterface() {
  try {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.getElementById('mainContainer');
    const userInfo = document.getElementById('userInfo');
    const userName = document.getElementById('userName');
    const userRole = document.getElementById('userRole');
    
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';
    
    if (userInfo && currentUser) {
      userInfo.style.display = 'flex';
      if (userName) userName.textContent = currentUser.name;
      if (userRole) userRole.textContent = `(${getRoleName(currentUser.type)})`;
    }
    
    // Настраиваем интерфейс по роли
    setupRoleBasedUI();
    
  } catch (error) {
    console.error('Ошибка показа интерфейса:', error);
  }
}

// Настройка интерфейса по роли
function setupRoleBasedUI() {
  if (!currentUser) return;
  
  try {
    if (currentUser.type === 'author' && authorInput) {
      authorInput.value = currentUser.name;
      authorInput.readOnly = true;
      authorInput.style.backgroundColor = '#f0f0f0';
    }
    
    if (currentUser.type === 'repair') {
      const formSection = document.getElementById('formSection');
      const searchFilter = document.getElementById('searchFilter');
      
      if (formSection) formSection.style.display = 'none';
      if (searchFilter) searchFilter.style.display = 'none';
    }
  } catch (error) {
    console.error('Ошибка настройки интерфейса по роли:', error);
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

// ============ ЗАГРУЗКА ДАННЫХ ============

// Загрузка всех данных
async function loadAllData() {
  try {
    console.log('Загрузка данных...');
    
    // Показываем уведомление о загрузке
    showNotification('Загрузка данных...', 'info');
    
    // Загружаем базу оборудования
    await loadEquipmentDatabase();
    
    // Загружаем заявки
    await loadRepairRequests();
    
    // Обновляем интерфейс
    applyFilters();
    updateSummary();
    
    // Скрываем уведомление о загрузке
    setTimeout(() => {
      const notification = document.getElementById('notification');
      if (notification && notification.textContent.includes('Загрузка данных')) {
        notification.style.display = 'none';
      }
    }, 1000);
    
    console.log('Данные успешно загружены');
    
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    showNotification('Ошибка загрузки данных', 'error');
  }
}

// Загрузка базы оборудования
async function loadEquipmentDatabase() {
  try {
    console.log('Загрузка базы оборудования...');
    
    // Пробуем загрузить из localStorage
    const savedData = localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB);
    
    if (savedData) {
      equipmentDatabase = JSON.parse(savedData);
      console.log('Загружена локальная база оборудования:', equipmentDatabase.length, 'записей');
    } else {
      // Если нет локальной базы, используем стандартную
      equipmentDatabase = getDefaultEquipmentDatabase();
      localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
      console.log('Создана база по умолчанию:', equipmentDatabase.length, 'записей');
    }
    
    // Обновляем интерфейс
    populateInvNumberSelect();
    populateLocationFilter();
    updateDBButtonInfo();
    
    return true;
    
  } catch (error) {
    console.error('Ошибка загрузки базы оборудования:', error);
    equipmentDatabase = getDefaultEquipmentDatabase();
    populateInvNumberSelect();
    return false;
  }
}

// База оборудования по умолчанию
function getDefaultEquipmentDatabase() {
  return [
    { location: "701", invNumber: "11323", name: "Автомат холод штамповки", model: "-", machineNumber: "СК-11323" },
    { location: "735", invNumber: "28542", name: "Токарный автомобиль (СМТ) (СК6136/750)", model: "КЕ36750", machineNumber: "ТС-28542" },
    { location: "717", invNumber: "7257", name: "Токарный автомат", model: "1269M-6", machineNumber: "А-7257" },
    { location: "701", invNumber: "11325", name: "Сверлильный станок", model: "2Н125", machineNumber: "СС-11325" },
    { location: "702", invNumber: "11326", name: "Шлифовальный станок", model: "3Б722", machineNumber: "ШС-11326" },
    { location: "715", invNumber: "27575", name: "Станок настольно-сверлильный", model: "2М112", machineNumber: "СС-27575" },
    { location: "723", invNumber: "27480", name: "Станок бесцентрово-шлифовальный", model: "3М184", machineNumber: "ШС-27480" },
    { location: "740", invNumber: "27934", name: "Печь камерная", model: "ПК-45", machineNumber: "П-27934" }
  ];
}

// Загрузка заявок
async function loadRepairRequests() {
  try {
    console.log('Загрузка заявок...');
    
    const savedRequests = localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS);
    
    if (savedRequests) {
      repairRequests = JSON.parse(savedRequests);
      console.log('Загружено заявок:', repairRequests.length);
    } else {
      repairRequests = [];
      console.log('Нет сохраненных заявок');
    }
    
    // Обновляем таблицу
    renderRepairTable();
    
    return true;
    
  } catch (error) {
    console.error('Ошибка загрузки заявок:', error);
    repairRequests = [];
    renderRepairTable();
    return false;
  }
}

// ============ ИНТЕРФЕЙСНЫЕ ФУНКЦИИ ============

// Добавление обработчиков событий
function addEventListeners() {
  try {
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
    
    console.log('Обработчики событий добавлены');
  } catch (error) {
    console.error('Ошибка добавления обработчиков событий:', error);
  }
}

// Обновить информацию о базе на кнопке
function updateDBButtonInfo() {
  try {
    const updateBtn = document.querySelector('.btn-load');
    if (!updateBtn) return;
    
    if (equipmentDatabase && equipmentDatabase.length > 0) {
      updateBtn.title = `База оборудования: ${equipmentDatabase.length} записей`;
      updateBtn.textContent = `🔄 База: ${equipmentDatabase.length} записей`;
    } else {
      updateBtn.title = 'База оборудования не загружена';
      updateBtn.textContent = '🔄 Обновить базу';
    }
  } catch (error) {
    console.error('Ошибка обновления информации о базе:', error);
  }
}

// Заполнение выпадающего списка инвентарных номеров
function populateInvNumberSelect() {
  if (!invNumberSelect) return;
  
  try {
    const currentValue = invNumberSelect.value;
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    if (equipmentDatabase.length === 0) {
      const option = document.createElement('option');
      option.value = "";
      option.textContent = "База оборудования пуста...";
      option.disabled = true;
      invNumberSelect.appendChild(option);
      return;
    }
    
    // Сортируем оборудование
    const sortedEquipment = [...equipmentDatabase].sort((a, b) => {
      const numA = parseInt(a.invNumber) || 0;
      const numB = parseInt(b.invNumber) || 0;
      return numA - numB;
    });
    
    // Убираем дубликаты
    const uniqueEquipment = [];
    const seen = new Set();
    
    sortedEquipment.forEach(equipment => {
      const key = equipment.invNumber;
      if (key && !seen.has(key)) {
        seen.add(key);
        uniqueEquipment.push(equipment);
      }
    });
    
    // Заполняем список
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
  } catch (error) {
    console.error('Ошибка заполнения списка инвентарных номеров:', error);
  }
}

// Заполнение фильтра участков
function populateLocationFilter() {
  if (!locationFilter) return;
  
  try {
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
  } catch (error) {
    console.error('Ошибка заполнения фильтра участков:', error);
  }
}

// ============ ОБРАБОТЧИКИ СОБЫТИЙ ============

// Изменение инвентарного номера
function handleInvNumberChange() {
  try {
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
  } catch (error) {
    console.error('Ошибка обработки изменения инвентарного номера:', error);
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
  repairRequests.push(request);
  localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
  
  return request;
}

// Очистка формы
function clearForm() {
  if (!repairForm) return;
  
  try {
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
  } catch (error) {
    console.error('Ошибка очистки формы:', error);
  }
}

// ============ ТАБЛИЦА ЗАЯВОК ============

// Отобразить таблицу заявок
function renderRepairTable(filteredRequests = null) {
  if (!repairTableBody) return;
  
  try {
    const requestsToRender = filteredRequests || repairRequests;
    
    // Сортируем по дате (новые сверху)
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
      
      const downtimeHours = request.downtimeHours || 0;
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
  } catch (error) {
    console.error('Ошибка рендеринга таблицы:', error);
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

// ============ ФИЛЬТРАЦИЯ ============

// Применить фильтры
function applyFilters() {
  try {
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
    updateSummary(filtered);
    
  } catch (error) {
    console.error('Ошибка применения фильтров:', error);
  }
}

// Обновление сводной информации
function updateSummary(requests = null) {
  try {
    const requestsToCount = requests || repairRequests;
    const totalRequests = requestsToCount.length;
    const pendingRequests = requestsToCount.filter(req => req.status === 'pending').length;
    const completedRequests = requestsToCount.filter(req => req.status === 'completed').length;
    
    const totalDowntime = requestsToCount.reduce((sum, req) => sum + (req.downtimeHours || 0), 0);
    
    if (totalRequestsElement) totalRequestsElement.textContent = totalRequests;
    if (pendingRequestsElement) pendingRequestsElement.textContent = pendingRequests;
    if (completedRequestsElement) completedRequestsElement.textContent = completedRequests;
    if (totalDowntimeElement) totalDowntimeElement.textContent = totalDowntime.toFixed(1) + ' ч';
  } catch (error) {
    console.error('Ошибка обновления сводной информации:', error);
  }
}

// ============ ОСНОВНЫЕ ФУНКЦИИ ============

// Проверка соединения
function checkConnection() {
  isOnline = navigator.onLine;
  
  try {
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
  } catch (error) {
    console.error('Ошибка проверки соединения:', error);
  }
}

// Проверка авторизации
function checkAuth() {
  try {
    const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    
    if (!isAuthenticated || !savedUser) {
      redirectToLogin();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка проверки авторизации:', error);
    return false;
  }
}

// Выход из системы
window.logout = function() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
    redirectToLogin();
  }
};

// Обновить базу оборудования
window.updateEquipmentDB = async function() {
  if (!checkAuth()) return;
  
  try {
    const updateBtn = document.querySelector('.btn-load');
    const originalText = updateBtn ? updateBtn.textContent : '🔄 Обновить базу';
    
    if (updateBtn) {
      updateBtn.textContent = '🔄 Загрузка...';
      updateBtn.disabled = true;
      updateBtn.style.opacity = '0.7';
    }
    
    // Здесь можно добавить загрузку с сервера
    // Для простоты просто перезагружаем локальную базу
    await loadEquipmentDatabase();
    
    showNotification(`База обновлена! Загружено ${equipmentDatabase.length} записей`, 'success');
    
  } catch (error) {
    console.error('Ошибка обновления базы:', error);
    showNotification('Ошибка обновления базы: ' + error.message, 'error');
  } finally {
    const updateBtn = document.querySelector('.btn-load');
    if (updateBtn) {
      updateBtn.textContent = '🔄 Обновить базу';
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
  
  try {
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
    
  } catch (error) {
    console.error('Ошибка экспорта данных:', error);
    showNotification('Ошибка экспорта данных', 'error');
  }
};

// Показать дашборд
window.showDashboard = function() {
  if (!checkAuth()) return;
  
  try {
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
  } catch (error) {
    console.error('Ошибка показа дашборда:', error);
    showNotification('Ошибка открытия дашборда', 'error');
  }
};

// Закрыть дашборд
window.closeDashboard = function() {
  try {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
      modal.style.display = 'none';
    }
  } catch (error) {
    console.error('Ошибка закрытия дашборда:', error);
  }
};

// Удалить заявку
window.deleteRequest = async function(id) {
  if (!checkAuth()) return;
  
  if (currentUser.type !== 'admin') {
    showNotification('Только администраторы могут удалять заявки', 'error');
    return;
  }
  
  if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
    return;
  }
  
  try {
    repairRequests = repairRequests.filter(req => req.id !== id);
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
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
  if (!checkAuth()) return;
  
  if (currentUser.type !== 'admin' && currentUser.type !== 'repair') {
    showNotification('У вас нет прав для завершения ремонтов', 'error');
    return;
  }
  
  try {
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
    
    const updatedRequest = {
      ...request,
      status: 'completed',
      repairEndDate: repairEndDate,
      repairEndTime: repairEndTime,
      downtimeCount: parseInt(downtimeCount) || 1,
      downtimeHours: downtimeHours,
      updatedAt: new Date().toISOString(),
      completedBy: currentUser.name
    };
    
    const index = repairRequests.findIndex(req => req.id === id);
    if (index !== -1) {
      repairRequests[index] = updatedRequest;
    }
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    showNotification('Ремонт завершен! Изменения сохранены.', 'success');
    
    renderRepairTable();
    updateSummary();
    
  } catch (error) {
    console.error('Ошибка завершения ремонта:', error);
    showNotification('Ошибка завершения ремонта', 'error');
  }
};

// Синхронизация всех данных
window.syncAllData = async function() {
  showNotification('Синхронизация временно отключена', 'warning');
};

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

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

// Показать уведомление
function showNotification(message, type = 'info') {
  try {
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
  } catch (error) {
    console.error('Ошибка показа уведомления:', error);
  }
}

// Перенаправление на страницу входа
function redirectToLogin() {
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 1000);
}

// Генерация HTML дашборда
function generateDashboardHTML() {
  try {
    const totalRequests = repairRequests.length;
    const pendingRequests = repairRequests.filter(req => req.status === 'pending').length;
    const completedRequests = repairRequests.filter(req => req.status === 'completed').length;
    
    const totalDowntime = repairRequests.reduce((sum, req) => sum + (req.downtimeHours || 0), 0);
    const avgRepairTime = completedRequests > 0 
      ? (totalDowntime / completedRequests).toFixed(1) 
      : '0.0';
    
    return `
      <div class="dashboard-stats">
        <div class="stat-card">
          <h3>Всего заявок</h3>
          <div class="stat-value">${totalRequests}</div>
          <div class="stat-change">За все время</div>
        </div>
        
        <div class="stat-card">
          <h3>В работе</h3>
          <div class="stat-value">${pendingRequests}</div>
          <div class="stat-change">${totalRequests > 0 ? ((pendingRequests / totalRequests) * 100).toFixed(1) : 0}% от общего</div>
        </div>
        
        <div class="stat-card">
          <h3>Завершено</h3>
          <div class="stat-value">${completedRequests}</div>
          <div class="stat-change">${totalRequests > 0 ? ((completedRequests / totalRequests) * 100).toFixed(1) : 0}% от общего</div>
        </div>
        
        <div class="stat-card">
          <h3>Среднее время ремонта</h3>
          <div class="stat-value">${avgRepairTime} ч</div>
          <div class="stat-change">на заявку</div>
        </div>
      </div>
      
      <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Информация о системе</h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
          <div><strong>Статус:</strong> <span style="color: ${isOnline ? '#4CAF50' : '#F44336'}">${isOnline ? 'Онлайн' : 'Оффлайн'}</span></div>
          <div><strong>База оборудования:</strong> ${equipmentDatabase.length} записей</div>
          <div><strong>Пользователь:</strong> ${currentUser.name} (${getRoleName(currentUser.type)})</div>
          <div><strong>Версия приложения:</strong> ${APP_VERSION}</div>
        </div>
      </div>
      
      <div style="margin-top: 30px; text-align: center;">
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
        ">🔄 Обновить базу</button>
      </div>
    `;
  } catch (error) {
    console.error('Ошибка генерации дашборда:', error);
    return '<p>Ошибка загрузки дашборда</p>';
  }
}

// Обработка ошибок
window.addEventListener('error', function(e) {
  console.error('Глобальная ошибка:', e.error);
  showNotification('Произошла ошибка в приложении', 'error');
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
