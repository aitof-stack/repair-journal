// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ 4.1.3
// С РАБОЧЕЙ СИНХРОНИЗАЦИЕЙ ЧЕРЕЗ GITHUB GIST

// Константы
const APP_VERSION = '4.1.3';
const APP_NAME = 'Ремонтный журнал';

// Настройки GitHub Gist
const GIST_ID = 'd356b02c2c182270935739995790fc20';
const GIST_FILENAME = 'repair_requests.json';

// URL для работы с Gist API
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const GIST_RAW_URL = `https://gist.githubusercontent.com/aitof-stack/${GIST_ID}/raw/${GIST_FILENAME}`;

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
  LAST_SYNC_HASH: 'lastSyncHash_v4',
  GITHUB_TOKEN: 'github_token_secure'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = navigator.onLine;
let isDBLoading = false;
let syncInProgress = false;
let pendingSyncRequests = [];
let deviceId = null;
let lastSyncHash = null;
let githubToken = '';

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody;
let searchInput, statusFilter, locationFilter, monthFilter;
let totalRequestsElement, pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

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

// Загрузка GitHub токена из безопасного хранилища
function loadGitHubToken() {
  try {
    const token = localStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN);
    if (token) {
      githubToken = token;
      console.log('GitHub Token загружен из хранилища');
      return true;
    }
    
    const sessionToken = sessionStorage.getItem(STORAGE_KEYS.GITHUB_TOKEN);
    if (sessionToken) {
      githubToken = sessionToken;
      console.log('GitHub Token загружен из сессии');
      return true;
    }
    
    const oldToken = localStorage.getItem('github_token');
    if (oldToken) {
      githubToken = oldToken;
      console.log('GitHub Token загружен из старого хранилища');
      saveGitHubToken(oldToken, true);
      localStorage.removeItem('github_token');
      return true;
    }
    
    console.log('GitHub Token не найден');
    return false;
    
  } catch (error) {
    console.error('Ошибка загрузки токена:', error);
    return false;
  }
}

// Сохранение GitHub токена в безопасное хранилище
function saveGitHubToken(token, remember = true) {
  try {
    if (remember) {
      localStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, token);
      console.log('GitHub Token сохранен в постоянное хранилище');
    } else {
      sessionStorage.setItem(STORAGE_KEYS.GITHUB_TOKEN, token);
      console.log('GitHub Token сохранен для текущей сессии');
    }
    
    githubToken = token;
    return true;
    
  } catch (error) {
    console.error('Ошибка сохранения токена:', error);
    return false;
  }
}

// Удаление GitHub токена
function clearGitHubToken() {
  try {
    localStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN);
    sessionStorage.removeItem(STORAGE_KEYS.GITHUB_TOKEN);
    githubToken = '';
    console.log('GitHub Token удален');
    return true;
  } catch (error) {
    console.error('Ошибка удаления токена:', error);
    return false;
  }
}

// Проверка валидности токена (формат)
function isValidToken(token) {
  if (!token || token.length < 40) return false;
  
  if (!token.startsWith('ghp_')) {
    console.warn('Токен должен начинаться с ghp_');
    return false;
  }
  
  return true;
}

// Проверка токена на GitHub API
async function testGitHubToken(token) {
  try {
    if (!token) return false;
    
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log('Токен валиден для пользователя:', userData.login);
      return true;
    } else {
      console.error('Неверный токен:', response.status);
      return false;
    }
  } catch (error) {
    console.error('Ошибка проверки токена:', error);
    return false;
  }
}

// Запрос GitHub токена у пользователя
function requestGitHubToken(force = false) {
  return new Promise((resolve, reject) => {
    if (githubToken && !force) {
      resolve(githubToken);
      return;
    }
    
    // Создаем модальное окно для ввода токена
    const tokenModal = document.createElement('div');
    tokenModal.className = 'modal';
    tokenModal.style.display = 'block';
    tokenModal.style.zIndex = '2000';
    
    tokenModal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; margin-top: 100px;">
        <span class="close" onclick="closeTokenModal()">&times;</span>
        <h2 style="color: #4CAF50; margin-bottom: 20px;">Настройка синхронизации</h2>
        
        <div style="margin-bottom: 20px; padding: 15px; background-color: #e8f5e9; border-radius: 6px; border-left: 4px solid #4CAF50;">
          <p><strong>Для работы синхронизации требуется GitHub Token</strong></p>
          <p style="font-size: 14px; margin-top: 10px;">Токен будет храниться только на вашем устройстве</p>
        </div>
        
        <div style="margin-bottom: 20px;">
          <p><strong>Как получить токен:</strong></p>
          <ol style="margin-left: 20px; margin-bottom: 15px; font-size: 14px;">
            <li>Зайдите на <a href="https://github.com/settings/tokens" target="_blank" style="color: #2196F3; text-decoration: underline;">GitHub Tokens</a></li>
            <li>Нажмите "Generate new token (classic)"</li>
            <li>Введите название: "Ремонтный журнал"</li>
            <li>Выберите срок действия (рекомендуется 90 дней)</li>
            <li>В разделе "Select scopes" выберите только <strong>gist</strong></li>
            <li>Нажмите "Generate token" и скопируйте его</li>
          </ol>
        </div>
        
        <div class="form-group" style="margin-bottom: 20px;">
          <label for="tokenInput" style="font-weight: bold;">Ваш GitHub Token:</label>
          <input type="password" id="tokenInput" 
                 placeholder="Вставьте ваш токен сюда" 
                 style="width: 100%; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 16px; margin-top: 8px;"
                 value="${githubToken ? '••••••••' + githubToken.slice(-4) : ''}">
          
          <div style="margin-top: 10px; display: flex; align-items: center; gap: 10px;">
            <label style="font-size: 14px; cursor: pointer;">
              <input type="checkbox" id="rememberToken" checked style="margin-right: 5px;">
              Запомнить на этом устройстве
            </label>
            <span style="font-size: 12px; color: #666;">(рекомендуется)</span>
          </div>
          
          <div id="tokenError" style="color: #f44336; font-size: 14px; margin-top: 10px; display: none;">
            <strong>Ошибка:</strong> <span id="errorText"></span>
          </div>
        </div>
        
        <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
          <button id="cancelTokenBtn" 
                  style="padding: 10px 20px; background-color: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Отмена
          </button>
          <button id="saveTokenBtn" 
                  style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            Сохранить токен
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(tokenModal);
    
    // Закрытие по клику вне окна
    tokenModal.onclick = function(event) {
      if (event.target === tokenModal) {
        closeTokenModal();
        reject(new Error('Ввод токена отменен'));
      }
    };
    
    function closeTokenModal() {
      tokenModal.remove();
      reject(new Error('Ввод токена отменен'));
    }
    
    function submitToken() {
      const tokenInput = document.getElementById('tokenInput');
      const rememberToken = document.getElementById('rememberToken');
      const errorDiv = document.getElementById('tokenError');
      const errorText = document.getElementById('errorText');
      
      const token = tokenInput.value.trim();
      
      // Очистка предыдущих ошибок
      errorDiv.style.display = 'none';
      
      if (!token) {
        errorText.textContent = 'Введите токен';
        errorDiv.style.display = 'block';
        return;
      }
      
      // Проверка формата токена
      if (!isValidToken(token)) {
        errorText.textContent = 'Неверный формат токена. Токен должен начинаться с ghp_ и иметь длину не менее 40 символов';
        errorDiv.style.display = 'block';
        return;
      }
      
      // Проверка токена через GitHub API (асинхронно)
      const saveBtn = document.getElementById('saveTokenBtn');
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Проверка токена...';
      saveBtn.disabled = true;
      
      testGitHubToken(token).then(isValid => {
        if (isValid) {
          saveGitHubToken(token, rememberToken.checked);
          tokenModal.remove();
          showNotification('Токен успешно сохранен!', 'success');
          resolve(token);
        } else {
          errorText.textContent = 'Токен недействителен или у него нет прав gist';
          errorDiv.style.display = 'block';
          saveBtn.textContent = originalText;
          saveBtn.disabled = false;
        }
      }).catch(error => {
        console.warn('Не удалось проверить токен через API:', error);
        saveGitHubToken(token, rememberToken.checked);
        tokenModal.remove();
        showNotification('Токен сохранен. Проверка не удалась, но можно попробовать синхронизацию', 'warning');
        resolve(token);
      });
    }
    
    // Обработчики кнопок
    document.getElementById('saveTokenBtn').addEventListener('click', submitToken);
    document.getElementById('cancelTokenBtn').addEventListener('click', closeTokenModal);
    
    // Enter для отправки
    document.getElementById('tokenInput').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        submitToken();
      }
    });
    
    // Добавляем глобальные функции
    window.closeTokenModal = closeTokenModal;
    window.submitToken = submitToken;
  });
}

// Автоматическая проверка и запрос токена при запуске
async function initGitHubToken() {
  const hasToken = loadGitHubToken();
  
  if (!hasToken && isOnline) {
    // Если токена нет, показываем уведомление
    showNotification('Для синхронизации требуется GitHub Token. Нажмите "🔄 Синхронизация" для настройки.', 'warning');
  } else if (hasToken && isOnline) {
    // Если токен есть, проверяем его валидность в фоне
    setTimeout(async () => {
      try {
        const isValid = await testGitHubToken(githubToken);
        if (!isValid) {
          console.warn('Токен недействителен, требуется обновление');
          showNotification('Токен устарел или недействителен. Обновите его через меню синхронизации.', 'warning');
        }
      } catch (error) {
        console.log('Фоновая проверка токена не удалась:', error.message);
      }
    }, 5000);
  }
}

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
  console.log(`${APP_NAME} v${APP_VERSION} запускается...`);
  
  // Устанавливаем таймаут на инициализацию
  const initTimeout = setTimeout(() => {
    console.warn('Инициализация превысила время ожидания, принудительный запуск');
    forceAppStart();
  }, 15000); // 15 секунд таймаут
  
  deviceId = generateDeviceId();
  console.log('Device ID:', deviceId);
  
  initGitHubToken();
  loadPendingSyncRequests();
  lastSyncHash = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_HASH) || '';
  
  try {
    checkAuthAndInit();
    clearTimeout(initTimeout);
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    clearTimeout(initTimeout);
    forceAppStart();
  }
});

// Аварийный запуск приложения
function forceAppStart() {
  const loadingScreen = document.getElementById('loadingScreen');
  const mainContainer = document.getElementById('mainContainer');
  const userInfo = document.getElementById('userInfo');
  
  if (loadingScreen) loadingScreen.style.display = 'none';
  if (mainContainer) mainContainer.style.display = 'block';
  if (userInfo) userInfo.style.display = 'none';
  
  showNotification('Приложение запущено в безопасном режиме', 'warning');
  
  // Показываем кнопку входа для аварийного доступа
  const emergencyLogin = document.createElement('div');
  emergencyLogin.innerHTML = `
    <div style="text-align: center; padding: 20px; background: #fff3e0; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #f57c00;">Аварийный доступ</h3>
      <p style="margin-bottom: 15px;">Если приложение не загружается, используйте эти кнопки:</p>
      <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
        <button onclick="window.location.href='login.html'" 
                style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px;">
          Перейти к входу
        </button>
        <button onclick="window.forceUpdate()" 
                style="padding: 10px 20px; background: #ff9800; color: white; border: none; border-radius: 4px;">
          Очистить все данные
        </button>
      </div>
    </div>
  `;
  document.querySelector('.container').prepend(emergencyLogin);
}

// Загрузить ожидающие синхронизацию заявки
function loadPendingSyncRequests() {
  try {
    const pending = localStorage.getItem(STORAGE_KEYS.SYNC_PENDING);
    if (pending) {
      pendingSyncRequests = JSON.parse(pending) || [];
      console.log('Загружены ожидающие синхронизацию заявки:', pendingSyncRequests.length);
    }
  } catch (error) {
    console.error('Ошибка загрузки ожидающих заявок:', error);
    pendingSyncRequests = [];
  }
}

// Сохранить ожидающие синхронизацию заявки
function savePendingSyncRequests() {
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_PENDING, JSON.stringify(pendingSyncRequests));
  } catch (error) {
    console.error('Ошибка сохранения ожидающих заявок:', error);
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
  
  initApp();
}

// Основная функция инициализации
function initApp() {
  console.log(`${APP_NAME} v${APP_VERSION} инициализация...`);
  
  try {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.getElementById('mainContainer');
    
    if (loadingScreen) {
      loadingScreen.style.display = 'none';
    }
    
    if (mainContainer) {
      mainContainer.style.display = 'block';
    }
    
    initDOMElements();
    setupRoleBasedUI();
    showUserInfo();
    
    // Загружаем данные асинхронно
    setTimeout(() => {
      loadAllData().then(() => {
        console.log('Данные успешно загружены');
      }).catch(error => {
        console.error('Ошибка загрузки данных:', error);
      });
    }, 100);
    
    setupInterface();
    checkConnection();
    setupSearchableSelect();
    updateSyncMessage();
    
    console.log('Приложение успешно запущено');
    
  } catch (error) {
    console.error('Критическая ошибка инициализации:', error);
    showNotification('Ошибка инициализации приложения', 'error');
    
    // Пытаемся восстановить базовый функционал
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) loadingScreen.style.display = 'none';
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
  setupRoleBasedUI();
  showUserInfo();
  
  return true;
}

// Настройка интерфейса по роли
function setupRoleBasedUI() {
  if (!currentUser) return;
  
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
  
  // Проверяем наличие токена
  if (!githubToken) {
    try {
      showNotification('Настройка синхронизации...', 'info');
      await requestGitHubToken();
    } catch (error) {
      showNotification('Синхронизация отменена: ' + error.message, 'error');
      return;
    }
  }
  
  syncInProgress = true;
  showNotification('Начата синхронизация данных...', 'info');
  
  try {
    // 1. Проверяем токен перед синхронизацией
    const isValid = await testGitHubToken(githubToken);
    if (!isValid) {
      throw new Error('Токен недействителен. Обновите токен.');
    }
    
    // 2. Отправляем ожидающие заявки на сервер
    if (pendingSyncRequests.length > 0 && isOnline) {
      const sentCount = await sendPendingRequestsToServer();
      if (sentCount > 0) {
        showNotification(`Отправлено ${sentCount} заявок на сервер`, 'success');
      }
    }
    
    // 3. Загружаем заявки с сервера
    if (isOnline) {
      await loadRepairRequestsFromServer();
    }
    
    // 4. Объединяем с локальными данными
    await mergeAndSaveRequests();
    
    // 5. Обновляем базу оборудования (если онлайн)
    if (isOnline) {
      await loadEquipmentDatabase(true);
    }
    
    // 6. Показываем результат
    showNotification('Синхронизация завершена!', 'success');
    
    // 7. Обновляем интерфейс
    renderRepairTable();
    updateSummary();
    updateDBButtonInfo();
    
    // 8. Сохраняем время последней синхронизации
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());
    
  } catch (error) {
    console.error('Ошибка синхронизации:', error);
    
    if (error.message.includes('401') || error.message.includes('403')) {
      showNotification('Ошибка авторизации. Токен недействителен или устарел.', 'error');
      
      // Предлагаем обновить токен
      if (confirm('Токен недействителен. Хотите ввести новый токен?')) {
        clearGitHubToken();
        await requestGitHubToken(true);
        
        // Пробуем синхронизацию снова
        if (githubToken) {
          window.syncAllData();
        }
      }
    } else if (error.message.includes('404')) {
      showNotification('Gist не найден. Проверьте настройки Gist.', 'error');
    } else if (error.message.includes('Network')) {
      showNotification('Ошибка сети. Проверьте подключение к интернету.', 'error');
    } else {
      showNotification('Ошибка синхронизации: ' + error.message, 'error');
    }
  } finally {
    syncInProgress = false;
    updateSyncMessage();
  }
};

// Отправить ожидающие заявки на сервер (GitHub Gist)
async function sendPendingRequestsToServer() {
  if (pendingSyncRequests.length === 0) {
    console.log('Нет заявок для отправки');
    return 0;
  }
  
  console.log(`Отправка ${pendingSyncRequests.length} заявок на сервер...`);
  
  // Проверяем наличие токена
  if (!githubToken) {
    throw new Error('GitHub Token не найден');
  }
  
  try {
    // 1. Сначала загружаем текущие данные из Gist
    const response = await fetch(GIST_API_URL, {
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Ошибка авторизации: неверный или устаревший токен');
      }
      throw new Error(`Ошибка загрузки Gist: ${response.status}`);
    }
    
    const gistData = await response.json();
    const currentContent = gistData.files[GIST_FILENAME]?.content || '[]';
    let currentRequests = JSON.parse(currentContent);
    
    console.log('Текущих заявок в Gist:', currentRequests.length);
    
    // 2. Объединяем данные
    let changesMade = false;
    let addedCount = 0;
    let updatedCount = 0;
    let deletedCount = 0;
    
    pendingSyncRequests.forEach(newRequest => {
      if (newRequest.deleted) {
        // Удаляем заявку
        const index = currentRequests.findIndex(r => r.id === newRequest.id);
        if (index !== -1) {
          currentRequests.splice(index, 1);
          changesMade = true;
          deletedCount++;
          console.log('Заявка удалена:', newRequest.id);
        }
      } else {
        // Добавляем или обновляем заявку
        const existingIndex = currentRequests.findIndex(r => r.id === newRequest.id);
        if (existingIndex !== -1) {
          // Обновляем существующую (только если новее)
          const existing = currentRequests[existingIndex];
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0);
          const newTime = new Date(newRequest.updatedAt || newRequest.createdAt || 0);
          
          if (newTime > existingTime) {
            currentRequests[existingIndex] = newRequest;
            changesMade = true;
            updatedCount++;
            console.log('Заявка обновлена:', newRequest.id);
          }
        } else {
          // Добавляем новую
          currentRequests.push(newRequest);
          changesMade = true;
          addedCount++;
          console.log('Заявка добавлена:', newRequest.id);
        }
      }
    });
    
    // 3. Сохраняем обратно в Gist только если есть изменения
    if (changesMade) {
      const updateResponse = await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          description: `Ремонтный журнал - обновлено ${new Date().toLocaleDateString('ru-RU')}`,
          files: {
            [GIST_FILENAME]: {
              content: JSON.stringify(currentRequests, null, 2)
            }
          }
        })
      });
      
      if (!updateResponse.ok) {
        throw new Error(`Ошибка обновления Gist: ${updateResponse.status}`);
      }
      
      // 4. Очищаем ожидающие заявки
      const totalChanges = addedCount + updatedCount + deletedCount;
      pendingSyncRequests = [];
      savePendingSyncRequests();
      
      console.log('Заявки успешно сохранены в Gist:', totalChanges);
      
      // Показываем детальную статистику
      let message = 'Синхронизация завершена:';
      if (addedCount > 0) message += ` +${addedCount} добавлено`;
      if (updatedCount > 0) message += ` ${updatedCount} обновлено`;
      if (deletedCount > 0) message += ` ${deletedCount} удалено`;
      
      showNotification(message, 'success');
      return totalChanges;
      
    } else {
      console.log('Нет изменений для синхронизации');
      // Очищаем ожидающие, так как они уже есть на сервере
      pendingSyncRequests = [];
      savePendingSyncRequests();
      return 0;
    }
    
  } catch (error) {
    console.error('Ошибка отправки заявок на сервер:', error);
    throw error;
  }
}

// Загрузить заявки с сервера (GitHub Gist)
async function loadRepairRequestsFromServer() {
  try {
    console.log('Загрузка заявок с сервера...');
    
    // Используем raw URL для чтения (не требует токена)
    const response = await fetch(`${GIST_RAW_URL}?t=${Date.now()}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        // Если файл не найден, создаем пустой массив
        console.log('Файл не найден, создаем пустой массив');
        return [];
      }
      throw new Error(`Ошибка загрузки: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Загружено заявок с сервера:', data.length);
    
    // Фильтруем удаленные заявки
    return Array.isArray(data) ? data.filter(item => !item.deleted) : [];
    
  } catch (error) {
    console.error('Ошибка загрузки заявок с сервера:', error);
    return [];
  }
}

// Объединить и сохранить заявки
async function mergeAndSaveRequests() {
  try {
    let serverRequests = [];
    if (isOnline) {
      serverRequests = await loadRepairRequestsFromServer();
    }
    
    const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
    
    console.log('Объединение данных: локальных -', localRequests.length, ', серверных -', serverRequests.length);
    
    const requestMap = new Map();
    
    // Сначала добавляем серверные данные
    serverRequests.forEach(request => {
      if (request.id && !request.deleted) {
        requestMap.set(request.id, request);
      }
    });
    
    // Затем добавляем локальные данные (перезаписываем если новее)
    localRequests.forEach(request => {
      if (!request.id || request.deleted) return;
      
      const existing = requestMap.get(request.id);
      
      if (!existing) {
        requestMap.set(request.id, request);
      } else {
        const localTime = new Date(request.updatedAt || request.createdAt || 0);
        const serverTime = new Date(existing.updatedAt || existing.createdAt || 0);
        
        if (localTime > serverTime) {
          requestMap.set(request.id, request);
        }
      }
    });
    
    // Добавляем ожидающие синхронизацию заявки (самые свежие)
    pendingSyncRequests.forEach(pending => {
      if (pending.deleted) {
        requestMap.delete(pending.id);
      } else if (pending.id) {
        const existing = requestMap.get(pending.id);
        if (!existing) {
          requestMap.set(pending.id, pending);
        } else {
          const pendingTime = new Date(pending.updatedAt || pending.createdAt || 0);
          const existingTime = new Date(existing.updatedAt || existing.createdAt || 0);
          
          if (pendingTime > existingTime) {
            requestMap.set(pending.id, pending);
          }
        }
      }
    });
    
    const mergedRequests = Array.from(requestMap.values());
    
    repairRequests = mergedRequests;
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(mergedRequests));
    localStorage.setItem(STORAGE_KEYS.REQUESTS_LAST_UPDATED, new Date().toISOString());
    
    console.log('Данные объединены. Итоговое количество:', mergedRequests.length);
    
    return mergedRequests;
    
  } catch (error) {
    console.error('Ошибка объединения заявок:', error);
    throw error;
  }
}

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

// Управление токеном GitHub
window.manageGitHubToken = async function() {
  try {
    await requestGitHubToken(true);
    showNotification('Токен обновлен', 'success');
  } catch (error) {
    showNotification('Токен не обновлен: ' + error.message, 'error');
  }
};

// Удалить токен
window.clearGitHubToken = function() {
  if (confirm('Вы уверены, что хотите удалить сохраненный GitHub Token?\n\nСинхронизация перестанет работать до ввода нового токена.')) {
    clearGitHubToken();
    showNotification('Токен удален. Синхронизация отключена.', 'warning');
    updateSyncMessage();
  }
};

// Показать текущий токен (маскированный)
window.showGitHubToken = function() {
  if (!githubToken) {
    showNotification('Токен не настроен', 'warning');
    return;
  }
  
  const maskedToken = '••••••••' + githubToken.slice(-4);
  const tokenInfo = `Токен настроен: ${maskedToken}\n\nПрава: gist\n\nДля изменения нажмите "Настроить токен"`;
  
  if (confirm(tokenInfo + '\n\nХотите настроить новый токен?')) {
    window.manageGitHubToken();
  }
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
  
  if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
    return;
  }
  
  try {
    const request = repairRequests.find(req => req.id === id);
    if (!request) {
      showNotification('Заявка не найдена', 'error');
      return;
    }
    
    const deleteRequest = {
      ...request,
      deleted: true,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser.name,
      updatedAt: new Date().toISOString(),
      syncDeviceId: deviceId
    };
    
    pendingSyncRequests.push(deleteRequest);
    savePendingSyncRequests();
    
    repairRequests = repairRequests.filter(req => req.id !== id);
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    renderRepairTable();
    updateSummary();
    
    showNotification('Заявка помечена для удаления', 'success');
    updateSyncMessage();
    
    if (isOnline && githubToken) {
      setTimeout(() => {
        window.syncAllData().catch(() => {
          console.log('Фоновая синхронизация не удалась');
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
  
  const updatedRequest = {
    ...request,
    status: 'completed',
    repairEndDate: repairEndDate,
    repairEndTime: repairEndTime,
    downtimeCount: parseInt(downtimeCount) || 1,
    downtimeHours: downtimeHours,
    updatedAt: new Date().toISOString(),
    completedBy: currentUser.name,
    syncDeviceId: deviceId
  };
  
  const index = repairRequests.findIndex(req => req.id === id);
  if (index !== -1) {
    repairRequests[index] = updatedRequest;
  }
  localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
  
  pendingSyncRequests.push(updatedRequest);
  savePendingSyncRequests();
  
  if (!isOnline || !githubToken) {
    showNotification('Изменение сохранено локально. Синхронизируйте при появлении интернета.', 'warning');
  } else {
    showNotification('Ремонт завершен! Изменения сохранены.', 'success');
    
    setTimeout(() => {
      window.syncAllData().catch(() => {
        console.log('Фоновая синхронизация не удалась');
      });
    }, 1000);
  }
  
  updateSyncMessage();
  renderRepairTable();
  updateSummary();
};

// ============ ЗАГРУЗКА ДАННЫХ ============

// Загрузка всех данных
async function loadAllData() {
  try {
    showNotification('Загрузка данных...', 'info');
    
    await Promise.allSettled([
      loadEquipmentDatabase(),
      loadRepairRequests()
    ]);
    
    applyFilters();
    
    if (isOnline && githubToken) {
      setTimeout(() => {
        window.syncAllData().catch(error => {
          console.log('Автоматическая синхронизация не удалась:', error.message);
        });
      }, 3000);
    }
    
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
      console.log('Загрузка базы оборудования...');
      
      const response = await fetch('data/equipment_database.csv?t=' + Date.now());
      
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
        console.log('Пробуем альтернативный парсинг...');
        equipmentDatabase = parseCSVAlternative(csvContent);
      }
      
      if (equipmentDatabase.length === 0) {
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
    
    const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
    console.log('Локальные заявки:', localRequests.length);
    
    if (isOnline) {
      await mergeAndSaveRequests();
    } else {
      repairRequests = localRequests;
    }
    
    console.log('Всего заявок после загрузки:', repairRequests.length);
    
  } catch (error) {
    console.error('Ошибка загрузки заявок:', error);
    
    const savedRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS));
    
    if (savedRequests && Array.isArray(savedRequests)) {
      repairRequests = savedRequests.filter(req => !req.deleted);
      console.log('Используем локальные заявки после ошибки:', repairRequests.length);
    } else {
      repairRequests = [];
    }
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
    
    if (!line || line === ';' || line === ',') continue;
    
    try {
      const parts = line.split(delimiter).map(part => {
        let clean = part.trim();
        if (clean.startsWith('"') && clean.endsWith('"')) {
          clean = clean.substring(1, clean.length - 1);
        }
        return clean;
      });
      
      if (parts.length >= 3) {
        const item = {
          location: parts[0] || '',
          invNumber: parts[1] || '',
          name: parts[2] || '',
          model: parts.length > 3 ? parts[3] : '-',
          machineNumber: parts.length > 4 ? parts[4] : '-'
        };
        
        if (item.invNumber && 
            item.name && 
            item.name.length > 2 &&
            !item.name.toLowerCase().includes('наименование') &&
            !item.name.toLowerCase().includes('оборудование')) {
          equipment.push(item);
        }
      }
    } catch (error) {
      console.warn(`Ошибка парсинга строки ${i + 1}:`, error, 'Содержимое:', line);
      continue;
    }
  }
  
  console.log('Успешно распарсено записей:', equipment.length);
  return equipment;
}

// Альтернативный парсинг CSV
function parseCSVAlternative(csvContent) {
  const equipment = [];
  const lines = csvContent.split(/\r?\n/);
  
  console.log('Альтернативный парсинг, строк:', lines.length);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;
    
    const parts = line.split(';').map(p => {
      let clean = p.trim();
      clean = clean.replace(/^["']+|["']+$/g, '');
      return clean;
    });
    
    if (parts.length >= 3) {
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
    { location: "701", invNumber: "11325", name: "Сверлильный станок", model: "2Н125", machineNumber: "СС-11325" },
    { location: "702", invNumber: "11326", name: "Шлифовальный станок", model: "3Б722", machineNumber: "ШС-11326" },
    { location: "715", invNumber: "27575", name: "Станок настольно-сверлильный", model: "2М112", machineNumber: "СС-27575" },
    { location: "723", invNumber: "27480", name: "Станок бесцентрово-шлифовальный", model: "3М184", machineNumber: "ШС-27480" },
    { location: "740", invNumber: "27934", name: "Печь камерная", model: "ПК-45", machineNumber: "П-27934" }
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
  
  const sortedEquipment = [...equipmentDatabase].sort((a, b) => {
    const numA = parseInt(a.invNumber) || 0;
    const numB = parseInt(b.invNumber) || 0;
    return numA - numB;
  });
  
  const uniqueEquipment = [];
  const seen = new Set();
  
  sortedEquipment.forEach(equipment => {
    const key = equipment.invNumber;
    if (key && !seen.has(key)) {
      seen.add(key);
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
    updateSyncMessage();
    
    if (pendingSyncRequests.length > 0 && githubToken) {
      setTimeout(() => {
        showNotification('Автоматическая синхронизация...', 'info');
        window.syncAllData().catch(() => {
          console.log('Автоматическая синхронизация не удалась');
        });
      }, 2000);
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('Интернет пропал');
    isOnline = false;
    showNotification('Потеряно соединение с интернетом', 'warning');
    checkConnection();
    updateSyncMessage();
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
    syncDeviceId: deviceId,
    createdBy: currentUser.name
  };
}

// Добавить заявку
async function addRepairRequest(request) {
  repairRequests.push(request);
  localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
  
  pendingSyncRequests.push(request);
  savePendingSyncRequests();
  
  updateSyncMessage();
  
  if (isOnline && githubToken) {
    setTimeout(() => {
      window.syncAllData().catch(() => {
        console.log('Фоновая синхронизация не удалась');
      });
    }, 1000);
  } else {
    showNotification('Заявка сохранена локально. Синхронизируйте при появлении интернета.', 'warning');
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
  const dbLastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
  const dbDate = dbLastUpdated ? new Date(dbLastUpdated).toLocaleDateString('ru-RU') : 'неизвестно';
  const tokenStatus = githubToken ? 'Настроен' : 'Не настроен';
  const tokenPreview = githubToken ? '••••••••' + githubToken.slice(-4) : 'Не указан';
  
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
        <div><strong>GitHub Token:</strong> <span style="color: ${githubToken ? '#4CAF50' : '#F44336'}">${tokenStatus}</span> (${tokenPreview})</div>
        <div><strong>Последняя синхронизация:</strong> ${lastSync}</div>
        <div><strong>Ожидают синхронизации:</strong> <span style="color: ${pendingSyncRequests.length > 0 ? '#FF9800' : '#4CAF50'}">${pendingSyncRequests.length} заявок</span></div>
        <div><strong>База оборудования:</strong> ${equipmentDatabase.length} записей (${dbDate})</div>
        <div><strong>Устройство:</strong> ${deviceId.substring(0, 15)}...</div>
      </div>
    </div>
    
    <div style="margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 8px;">
      <h3 style="color: #4CAF50; margin-top: 0;">Настройки GitHub</h3>
      <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; margin-bottom: 15px;">
        <div>
          <strong>GitHub Token:</strong> ${tokenPreview}
          <p style="font-size: 12px; color: #666; margin-top: 5px;">
            Токен нужен для доступа к GitHub Gist. Создайте токен с правами gist 
            <a href="https://github.com/settings/tokens" target="_blank" style="color: #2196F3;">здесь</a>.
          </p>
        </div>
        <div style="display: flex; gap: 10px;">
          <button onclick="window.manageGitHubToken()" 
                  style="padding: 8px 15px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${githubToken ? 'Изменить токен' : 'Добавить токен'}
          </button>
          ${githubToken ? `
            <button onclick="window.clearGitHubToken()" 
                    style="padding: 8px 15px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Удалить токен
            </button>
          ` : ''}
        </div>
      </div>
      <div style="font-size: 13px; color: #666;">
        <p><strong>Gist ID:</strong> ${GIST_ID}</p>
        <p><strong>Файл данных:</strong> ${GIST_FILENAME}</p>
        <p><strong>URL для проверки:</strong> <a href="${GIST_RAW_URL}" target="_blank">${GIST_RAW_URL}</a></p>
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
        <div><strong>Пользователь:</strong> ${currentUser.name} (${getRoleName(currentUser.type)})</div>
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

// Обновить сообщение о синхронизации
function updateSyncMessage() {
  const syncMessage = document.getElementById('syncMessage');
  const syncMessageText = document.getElementById('syncMessageText');
  
  if (!syncMessage || !syncMessageText) return;
  
  try {
    if (!githubToken) {
      syncMessageText.textContent = '⚠️ Для синхронизации требуется GitHub Token. Нажмите "🔄 Синхронизация" для настройки.';
      syncMessage.className = 'sync-message warning';
      syncMessage.style.display = 'block';
      return;
    }
    
    if (pendingSyncRequests.length > 0) {
      syncMessageText.textContent = `⚠️ У вас есть ${pendingSyncRequests.length} заявок, ожидающих синхронизации. Нажмите кнопку "🔄 Синхронизация" для отправки на сервер.`;
      syncMessage.className = 'sync-message warning';
      syncMessage.style.display = 'block';
    } else {
      const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
      if (lastSync) {
        const lastSyncDate = new Date(lastSync);
        const now = new Date();
        const diffHours = Math.floor((now - lastSyncDate) / (1000 * 60 * 60));
        
        if (diffHours > 24) {
          syncMessageText.textContent = `🔄 Последняя синхронизация была ${diffHours} часов назад. Рекомендуется выполнить синхронизацию.`;
          syncMessage.className = 'sync-message';
          syncMessage.style.display = 'block';
        } else {
          syncMessage.style.display = 'none';
        }
      } else {
        syncMessageText.textContent = '🔄 Данные еще не синхронизировались. Нажмите кнопку "🔄 Синхронизация" для первой синхронизации.';
        syncMessage.className = 'sync-message';
        syncMessage.style.display = 'block';
      }
    }
  } catch (error) {
    console.error('Ошибка при обновлении сообщения синхронизации:', error);
    syncMessage.style.display = 'none';
  }
}

// Обработка ошибок
window.addEventListener('error', function(e) {
  console.error('Глобальная ошибка:', e.error);
  showNotification('Произошла ошибка в приложении', 'error');
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
