// app.js - Управление инициализацией приложения v1.0
console.log('app.js загружен - версия 1.0');

let appInitialized = false;
let initializationAttempts = 0;
const MAX_INIT_ATTEMPTS = 3;

// Основная функция инициализации приложения
async function initializeApplication() {
    if (appInitialized) {
        console.log('Приложение уже инициализировано');
        return;
    }
    
    if (initializationAttempts >= MAX_INIT_ATTEMPTS) {
        console.error('Превышено количество попыток инициализации');
        return;
    }
    
    initializationAttempts++;
    console.log(`Попытка инициализации #${initializationAttempts}`);
    
    try {
        // 1. Проверяем авторизацию
        await checkAuthorization();
        
        // 2. Инициализируем Firebase (только один раз!)
        await initializeFirebaseOnce();
        
        // 3. Инициализируем основные компоненты
        await initializeComponents();
        
        // 4. Загружаем данные
        await loadApplicationData();
        
        // 5. Настраиваем UI
        setupApplicationUI();
        
        appInitialized = true;
        console.log('Приложение успешно инициализировано');
        
        // Скрываем экран загрузки
        hideLoadingScreen();
        
    } catch (error) {
        console.error('Ошибка инициализации приложения:', error);
        
        if (initializationAttempts < MAX_INIT_ATTEMPTS) {
            console.log('Повторная попытка инициализации через 2 секунды...');
            setTimeout(initializeApplication, 2000);
        } else {
            showCriticalError('Не удалось инициализировать приложение. Пожалуйста, обновите страницу.');
        }
    }
}

// Проверка авторизации
async function checkAuthorization() {
    console.log('Проверка авторизации...');
    
    const isAuthenticated = localStorage.getItem('repair_journal_isAuthenticated');
    const userData = localStorage.getItem('repair_journal_currentUser');
    
    if (!isAuthenticated || !userData) {
        console.log('Пользователь не авторизован, перенаправляем...');
        window.location.href = 'login.html';
        throw new Error('User not authenticated');
    }
    
    try {
        window.currentUser = JSON.parse(userData);
        console.log('Пользователь:', window.currentUser.name);
    } catch (e) {
        console.error('Ошибка парсинга данных пользователя:', e);
        window.location.href = 'login.html';
        throw e;
    }
}

// Инициализация Firebase (один раз!)
async function initializeFirebaseOnce() {
    console.log('Инициализация Firebase...');
    
    // Если Firebase SDK не загружен
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не загружен');
        window.isFirebaseReady = false;
        return;
    }
    
    // Если Firebase уже инициализирован
    if (firebase.apps.length > 0) {
        console.log('Firebase уже инициализирован');
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        window.isFirebaseReady = true;
        return;
    }
    
    try {
        // Проверяем наличие конфигурации
        if (typeof firebaseConfig === 'undefined') {
            console.warn('Конфигурация Firebase не найдена');
            window.isFirebaseReady = false;
            return;
        }
        
        // Инициализируем Firebase
        const app = firebase.initializeApp(firebaseConfig);
        console.log('Firebase инициализирован, проект:', app.options.projectId);
        
        // Получаем сервисы
        window.db = firebase.firestore();
        window.auth = firebase.auth();
        
        // Настраиваем анонимную аутентификацию
        try {
            await window.auth.signInAnonymously();
            console.log('Анонимная аутентификация выполнена');
        } catch (authError) {
            console.warn('Ошибка анонимной аутентификации:', authError);
        }
        
        // Включаем persistence (с обработкой ошибок)
        try {
            await window.db.enablePersistence({
                synchronizeTabs: true
            }).catch(err => {
                if (err.code === 'failed-precondition') {
                    console.log('Persistence уже включена в другой вкладке');
                } else if (err.code === 'unimplemented') {
                    console.log('Браузер не поддерживает persistence');
                } else {
                    console.warn('Ошибка включения persistence:', err);
                }
            });
        } catch (persistenceError) {
            console.warn('Ошибка при настройке persistence:', persistenceError);
        }
        
        window.isFirebaseReady = true;
        console.log('Firebase готов к работе');
        
    } catch (error) {
        console.error('Критическая ошибка инициализации Firebase:', error);
        window.isFirebaseReady = false;
        throw error;
    }
}

// Инициализация компонентов
async function initializeComponents() {
    console.log('Инициализация компонентов...');
    
    // Инициализируем глобальные переменные
    window.repairsList = [];
    window.equipmentList = [];
    window.unsubscribeRepairs = null;
    
    // Генерируем Device ID если нужно
    if (!window.deviceId) {
        window.deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        console.log('Device ID:', window.deviceId);
    }
}

// Загрузка данных приложения
async function loadApplicationData() {
    console.log('Загрузка данных приложения...');
    
    // 1. Загружаем базу оборудования
    await loadEquipmentDatabase();
    
    // 2. Загружаем заявки
    await loadRepairsData();
    
    console.log('Данные загружены:', {
        equipment: window.equipmentList.length,
        repairs: window.repairsList.length
    });
}

// Настройка UI
function setupApplicationUI() {
    console.log('Настройка UI...');
    
    // 1. Обновляем информацию о пользователе
    updateUserInfoUI();
    
    // 2. Настраиваем форму
    setupRepairForm();
    
    // 3. Настраиваем фильтры
    setupFilters();
    
    // 4. Рендерим таблицу
    renderRepairsTable();
    
    // 5. Настраиваем обработчики событий
    setupEventHandlers();
    
    // 6. Настраиваем статус соединения
    setupConnectionStatus();
    
    console.log('UI настроен');
}

// Обновление информации о пользователе в UI
function updateUserInfoUI() {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userInfoElement = document.getElementById('userInfo');
    
    if (!window.currentUser || !userNameElement || !userRoleElement) return;
    
    userNameElement.textContent = window.currentUser.name;
    
    let roleText = '';
    switch(window.currentUser.type) {
        case 'admin': roleText = 'Администратор'; break;
        case 'author': roleText = 'Автор заявок'; break;
        case 'repair': roleText = 'Ремонтная служба'; break;
        default: roleText = window.currentUser.type;
    }
    
    userRoleElement.textContent = roleText;
    
    if (userInfoElement) {
        userInfoElement.style.display = 'flex';
    }
}

// Скрытие экрана загрузки
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainContainer = document.getElementById('mainContainer');
    
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    if (mainContainer) {
        mainContainer.style.display = 'block';
    }
    
    console.log('Экран загрузки скрыт');
}

// Показать критическую ошибку
function showCriticalError(message) {
    const loadingScreen = document.getElementById('loadingScreen');
    
    if (loadingScreen) {
        loadingScreen.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <div style="color: #f44336; font-size: 48px; margin-bottom: 20px;">⚠️</div>
                <h2 style="color: #f44336;">Критическая ошибка</h2>
                <p>${message}</p>
                <button onclick="window.location.reload()" style="
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 6px;
                    font-size: 16px;
                    cursor: pointer;
                    margin-top: 20px;
                ">
                    Обновить страницу
                </button>
            </div>
        `;
    }
}

// Экспортируем функцию инициализации
window.initializeApp = initializeApplication;

// Запускаем инициализацию при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, запускаем инициализацию приложения...');
    
    // Небольшая задержка для стабильности
    setTimeout(() => {
        initializeApplication();
    }, 100);
});