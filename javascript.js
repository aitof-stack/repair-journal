// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ С FIREBASE СИНХРОНИЗАЦИЕЙ

// Константы
const APP_VERSION = '5.0.4';
const APP_NAME = 'Ремонтный журнал (Firebase Sync)';

// Ссылки на GitHub для данных
const GITHUB_REPO = 'aitof-stack/repair-journal';
const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/' + GITHUB_REPO + '/main/';
const EQUIPMENT_DB_URL = GITHUB_RAW_URL + 'data/equipment_database.csv';

// Ключи для хранения данных
const STORAGE_KEYS = {
    EQUIPMENT_DB: 'equipmentDatabase_v5',
    REPAIR_REQUESTS: 'repairRequests_v5',
    CURRENT_USER: 'repair_journal_currentUser',
    AUTH_STATUS: 'repair_journal_isAuthenticated',
    DB_LAST_UPDATED: 'equipmentDBLastUpdated_v5',
    DEVICE_ID: 'deviceId_v5',
    LAST_SYNC_TIME: 'lastSyncTime_v5'
};

// Переменные приложения
let equipmentDatabase = [];
let repairRequests = [];
let currentUser = null;
let isOnline = navigator.onLine;
let isDBLoading = false;
let deviceId = null;
let pendingLocalRequests = [];

// Firebase переменные
let firebaseApp = null;
let firestore = null;
let auth = null;
let firestoreUnsubscribe = null;
let isFirebaseInitialized = false;
let isSyncing = false;
let firebaseInitializationAttempted = false;

// DOM элементы
let repairForm, invNumberSelect, equipmentNameInput, locationInput, modelInput;
let machineNumberInput, authorInput, clearBtn, repairTableBody, searchInput;
let statusFilter, locationFilter, monthFilter, totalRequestsElement;
let pendingRequestsElement, completedRequestsElement, totalDowntimeElement;

// Флаги инициализации
let appInitialized = false;
let initializationInProgress = false;

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
    
    // Проверяем авторизацию и инициализируем приложение
    checkAuthAndInit();
});

// Проверка авторизации и инициализация
async function checkAuthAndInit() {
    // Защита от повторной инициализации
    if (initializationInProgress) {
        console.log('Инициализация уже выполняется...');
        return;
    }
    
    if (appInitialized) {
        console.log('Приложение уже инициализировано');
        return;
    }
    
    initializationInProgress = true;
    
    try {
        const isAuthenticated = localStorage.getItem(STORAGE_KEYS.AUTH_STATUS);
        const savedUser = JSON.parse(localStorage.getItem(STORAGE_KEYS.CURRENT_USER));
        
        if (!isAuthenticated || !savedUser) {
            redirectToLogin();
            return;
        }
        
        currentUser = savedUser;
        console.log(`Пользователь: ${currentUser.name} (${currentUser.type})`);
        
        // Устанавливаем флаг инициализации
        appInitialized = true;
        
        // Инициализация приложения
        await initApp();
    } finally {
        initializationInProgress = false;
    }
}

// Основная функция инициализации
async function initApp() {
    console.log(`${APP_NAME} v${APP_VERSION}`);
    const loadingScreen = document.getElementById('loadingScreen');
    const loadingStatus = document.getElementById('loadingStatus');
    
    try {
        // 1. Инициализация интерфейса
        initDOMElements();
        setupRoleBasedUI();
        showUserInfo();
        setupInterface();
        checkConnection();
        setupSearchableSelect();
        
        // 2. Загрузка базы оборудования
        loadingStatus.textContent = 'Загрузка базы оборудования...';
        await loadEquipmentDatabase();
        
        // 3. Инициализация Firebase (с защитой от повторной инициализации)
        loadingStatus.textContent = 'Инициализация синхронизации...';
        const firebaseInitialized = await initializeFirebase();
        
        if (firebaseInitialized) {
            // 4. Загрузка данных из Firebase
            loadingStatus.textContent = 'Синхронизация данных с облаком...';
            await loadRepairRequestsFromFirebase();
            
            // 5. Синхронизация локальных данных
            await syncLocalDataToFirebase();
        } else {
            // Работа в офлайн режиме
            loadingStatus.textContent = 'Облако недоступно, загрузка локальных данных...';
            await loadRepairRequestsFromLocal();
            showNotification('Работа в автономном режиме. Данные сохраняются локально.', 'warning');
        }
        
        // 6. Применение фильтров
        applyFilters();
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showNotification('Ошибка загрузки приложения', 'error');
        
        // Пробуем загрузить локальные данные
        await loadRepairRequestsFromLocal();
    }
    
    // Скрываем экран загрузки
    setTimeout(() => {
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        const mainContainer = document.getElementById('mainContainer');
        if (mainContainer) {
            mainContainer.style.display = 'block';
        }
    }, 500);
    
    console.log('Приложение успешно запущено. Firebase:', isFirebaseInitialized ? 'ONLINE' : 'OFFLINE');
}

// Инициализация Firebase с защитой от повторной инициализации
async function initializeFirebase() {
    // Если Firebase уже инициализирован, возвращаем true
    if (isFirebaseInitialized) {
        console.log('Firebase уже инициализирован');
        return true;
    }
    
    // Если попытка инициализации уже была, не повторяем
    if (firebaseInitializationAttempted) {
        console.log('Попытка инициализации Firebase уже была выполнена');
        return isFirebaseInitialized;
    }
    
    firebaseInitializationAttempted = true;
    console.log('Проверяем инициализацию Firebase...');
    
    // Проверяем наличие Firebase SDK
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не загружен. Работаем в офлайн режиме.');
        isFirebaseInitialized = false;
        return false;
    }
    
    try {
        // Проверяем, инициализировано ли приложение Firebase
        if (firebase.apps.length === 0) {
            console.warn('Firebase приложение не инициализировано. Проверьте firebase-config.js');
            isFirebaseInitialized = false;
            return false;
        }
        
        // Получаем экземпляры (уже должны быть доступны через firebase-config.js)
        firebaseApp = firebase.app();
        firestore = firebase.firestore();
        auth = firebase.auth();
        
        console.log('Firebase приложения найдены:', firebase.apps.length);
        console.log('Firebase project:', firebaseApp.options.projectId);
        
        // Настраиваем кэширование для офлайн работы (только один раз)
        try {
            await firestore.enablePersistence({ synchronizeTabs: true });
            console.log('Firestore persistence включена');
        } catch (persistenceError) {
            // Если persistence уже включена, это нормально
            if (persistenceError.code === 'failed-precondition') {
                console.log('Firestore persistence уже включена в другой вкладке');
            } else if (persistenceError.code === 'unimplemented') {
                console.warn('Firestore persistence не поддерживается в этом браузере');
            } else {
                console.warn('Не удалось включить persistence:', persistenceError.message);
            }
        }
        
        // Анонимная авторизация (если не авторизован)
        if (!auth.currentUser) {
            console.log('Выполняем анонимный вход...');
            await auth.signInAnonymously();
            console.log('Анонимный вход выполнен. User ID:', auth.currentUser?.uid);
        } else {
            console.log('Уже авторизован. User ID:', auth.currentUser?.uid);
        }
        
        // Проверяем доступность Firestore
        const testDocRef = firestore.collection('test').doc('connection_test');
        try {
            await testDocRef.set({ test: true, timestamp: new Date() });
            await testDocRef.delete();
            console.log('Firestore доступен для записи');
        } catch (firestoreError) {
            console.warn('Firestore доступен только для чтения или офлайн:', firestoreError.message);
        }
        
        isFirebaseInitialized = true;
        console.log('Firebase успешно инициализирован');
        return true;
        
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        isFirebaseInitialized = false;
        
        // Показываем подробную информацию об ошибке
        if (error.code === 'permission-denied') {
            console.error('Ошибка доступа к Firebase. Проверьте правила безопасности Firestore.');
            showNotification('Ошибка доступа к облачной базе. Проверьте правила безопасности.', 'error');
        } else if (error.code === 'failed-precondition') {
            console.error('Firebase уже инициализирован в другой вкладке');
        } else {
            console.error('Неизвестная ошибка Firebase:', error.code, error.message);
        }
        
        return false;
    }
}

// ============ СИНХРОНИЗАЦИЯ ДАННЫХ ============

// Загрузка заявок из Firebase
async function loadRepairRequestsFromFirebase() {
    if (!firestore || !isFirebaseInitialized) {
        console.log('Firestore не инициализирован, загружаем локальные данные');
        return false;
    }
    
    try {
        console.log('Загрузка данных из Firestore...');
        
        // Проверяем правила доступа
        const testQuery = firestore.collection('repair_requests').limit(1);
        
        // Загружаем все заявки с сортировкой по дате создания
        const snapshot = await firestore.collection('repair_requests')
            .orderBy('createdAt', 'desc')
            .get();
        
        const firebaseRequests = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                synced: true,
                firebaseId: doc.id
            };
        });
        
        console.log('Загружено заявок из Firestore:', firebaseRequests.length);
        
        // Загружаем локальные данные
        const localRequests = await loadRepairRequestsFromLocal();
        
        // Объединяем данные: приоритет у Firebase, но сохраняем локальные изменения
        repairRequests = mergeRequests(firebaseRequests, localRequests);
        
        // Сохраняем объединенные данные локально
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        
        // Настраиваем подписку на обновления в реальном времени
        setupFirestoreRealtimeListener();
        
        // Обновляем интерфейс
        renderRepairTable();
        updateSummary();
        
        // Сохраняем время синхронизации
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());
        
        return true;
    } catch (error) {
        console.error('Ошибка загрузки из Firebase:', error);
        
        // Проверяем тип ошибки
        if (error.code === 'permission-denied') {
            showNotification('Нет доступа к облачной базе. Проверьте правила безопасности Firestore.', 'error');
        } else if (error.code === 'failed-precondition') {
            showNotification('Ошибка индексов Firestore. Требуется создать индексы.', 'error');
        } else {
            showNotification('Ошибка загрузки из облака', 'error');
        }
        
        return false;
    }
}

// Слияние данных Firebase и локальных
function mergeRequests(firebaseRequests, localRequests) {
    const merged = [...firebaseRequests];
    const firebaseIds = new Set(firebaseRequests.map(r => r.id));
    
    // Добавляем локальные заявки, которых нет в Firebase
    localRequests.forEach(localRequest => {
        if (!firebaseIds.has(localRequest.id)) {
            merged.push({
                ...localRequest,
                synced: false
            });
        }
    });
    
    // Удаляем дубликаты по firebaseId
    const uniqueRequests = [];
    const seenFirebaseIds = new Set();
    
    merged.forEach(request => {
        if (request.firebaseId) {
            if (!seenFirebaseIds.has(request.firebaseId)) {
                seenFirebaseIds.add(request.firebaseId);
                uniqueRequests.push(request);
            }
        } else {
            uniqueRequests.push(request);
        }
    });
    
    return uniqueRequests;
}

// Синхронизация локальных данных с Firebase
async function syncLocalDataToFirebase() {
    if (!firestore || !isFirebaseInitialized || isSyncing) {
        return;
    }
    
    isSyncing = true;
    console.log('Начинаем синхронизацию локальных данных...');
    
    try {
        // Загружаем локальные данные
        const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
        
        // Находим несинхронизированные заявки
        const unsyncedRequests = localRequests.filter(request => !request.synced || !request.firebaseId);
        
        if (unsyncedRequests.length === 0) {
            console.log('Нет данных для синхронизации');
            return;
        }
        
        console.log(`Синхронизация ${unsyncedRequests.length} заявок...`);
        let successfulSyncs = 0;
        
        // Синхронизируем каждую заявку
        for (const request of unsyncedRequests) {
            try {
                const requestToSave = { ...request };
                delete requestToSave.id;
                delete requestToSave.synced;
                delete requestToSave.firebaseId;
                
                // Убедимся, что у заявки есть обязательные поля
                if (!requestToSave.createdAt) {
                    requestToSave.createdAt = new Date().toISOString();
                }
                if (!requestToSave.updatedAt) {
                    requestToSave.updatedAt = new Date().toISOString();
                }
                
                let docRef;
                
                if (request.firebaseId) {
                    // Обновляем существующую заявку
                    await firestore.collection('repair_requests').doc(request.firebaseId).update(requestToSave);
                    docRef = { id: request.firebaseId };
                    console.log('Обновлена заявка в Firebase:', request.firebaseId);
                } else {
                    // Создаем новую заявку
                    docRef = await firestore.collection('repair_requests').add(requestToSave);
                    console.log('Создана заявка в Firebase:', docRef.id);
                }
                
                // Обновляем локальную запись
                const index = repairRequests.findIndex(r => r.id === request.id);
                if (index !== -1) {
                    repairRequests[index].synced = true;
                    repairRequests[index].firebaseId = docRef.id;
                    repairRequests[index].id = docRef.id; // Используем Firebase ID как основной
                }
                
                successfulSyncs++;
                
            } catch (error) {
                console.error('Ошибка синхронизации заявки', request.id, ':', error.code, error.message);
                
                // Если ошибка доступа, пропускаем эту заявку
                if (error.code === 'permission-denied') {
                    console.warn('Нет прав для синхронизации заявки', request.id);
                }
            }
        }
        
        // Сохраняем обновленные данные локально
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());
        
        if (successfulSyncs > 0) {
            showNotification(`Синхронизировано ${successfulSyncs} заявок`, 'success');
        }
        
        if (successfulSyncs < unsyncedRequests.length) {
            const failed = unsyncedRequests.length - successfulSyncs;
            showNotification(`${failed} заявок не удалось синхронизировать`, 'warning');
        }
        
    } catch (error) {
        console.error('Критическая ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации: ' + error.message, 'error');
    } finally {
        isSyncing = false;
    }
}

// Настройка подписки на обновления в реальном времени
function setupFirestoreRealtimeListener() {
    if (!firestore || !isFirebaseInitialized) {
        return;
    }
    
    // Отписываемся от предыдущей подписки
    if (firestoreUnsubscribe) {
        console.log('Отписываемся от предыдущей подписки Firestore');
        firestoreUnsubscribe();
    }
    
    console.log('Настраиваем подписку на обновления Firestore в реальном времени');
    
    try {
        firestoreUnsubscribe = firestore.collection('repair_requests')
            .orderBy('createdAt', 'desc')
            .onSnapshot((snapshot) => {
                console.log('Получены изменения из Firestore:', snapshot.docChanges().length, 'изменений');
                
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    const requestId = change.doc.id;
                    
                    if (change.type === 'added') {
                        console.log('Добавлена заявка из Firebase:', requestId);
                        const existingIndex = repairRequests.findIndex(r => r.firebaseId === requestId);
                        
                        const newRequest = {
                            ...data,
                            id: requestId,
                            firebaseId: requestId,
                            synced: true
                        };
                        
                        if (existingIndex === -1) {
                            repairRequests.push(newRequest);
                        }
                        
                    } else if (change.type === 'modified') {
                        console.log('Обновлена заявка из Firebase:', requestId);
                        const existingIndex = repairRequests.findIndex(r => r.firebaseId === requestId);
                        
                        if (existingIndex !== -1) {
                            repairRequests[existingIndex] = {
                                ...repairRequests[existingIndex],
                                ...data,
                                synced: true
                            };
                        }
                        
                    } else if (change.type === 'removed') {
                        console.log('Удалена заявка из Firebase:', requestId);
                        repairRequests = repairRequests.filter(r => r.firebaseId !== requestId);
                    }
                });
                
                // Сортируем по дате создания
                repairRequests.sort((a, b) => {
                    const dateA = new Date(a.createdAt || a.date || 0);
                    const dateB = new Date(b.createdAt || b.date || 0);
                    return dateB - dateA;
                });
                
                // Сохраняем обновленные данные локально
                localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
                
                // Обновляем интерфейс
                renderRepairTable();
                updateSummary();
                applyFilters();
                
            }, (error) => {
                console.error('Ошибка подписки Firestore:', error.code, error.message);
                
                if (error.code === 'permission-denied') {
                    console.error('Нет прав для прослушивания изменений в Firestore');
                    showNotification('Нет прав для синхронизации в реальном времени', 'error');
                } else if (error.code === 'failed-precondition') {
                    console.error('Требуется индекс для запроса в реальном времени');
                    showNotification('Требуется создать индекс в Firebase консоли', 'warning');
                } else {
                    showNotification('Ошибка синхронизации с облаком', 'error');
                }
                
                // Отключаем подписку при ошибке
                if (firestoreUnsubscribe) {
                    firestoreUnsubscribe();
                    firestoreUnsubscribe = null;
                }
            });
            
        console.log('Подписка на обновления Firestore настроена');
        
    } catch (error) {
        console.error('Ошибка настройки подписки Firestore:', error);
    }
}

// Загрузка локальных данных
async function loadRepairRequestsFromLocal() {
    try {
        const localRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REPAIR_REQUESTS)) || [];
        repairRequests = localRequests;
        
        console.log('Загружено локальных заявок:', repairRequests.length);
        
        renderRepairTable();
        updateSummary();
        
        return repairRequests;
    } catch (error) {
        console.error('Ошибка загрузки локальных данных:', error);
        repairRequests = [];
        return [];
    }
}

// ============ ГЛОБАЛЬНЫЕ ФУНКЦИИ ============

// Синхронизация всех данных
window.syncAllData = async function() {
    if (!isFirebaseInitialized) {
        const initialized = await initializeFirebase();
        if (!initialized) {
            showNotification('Firebase не инициализирован. Проверьте соединение и правила безопасности.', 'error');
            return;
        }
    }
    
    showNotification('Начата синхронизация данных...', 'info');
    
    try {
        // 1. Загружаем свежие данные из Firebase
        await loadRepairRequestsFromFirebase();
        
        // 2. Отправляем локальные изменения в Firebase
        await syncLocalDataToFirebase();
        
        // 3. Обновляем базу оборудования
        await loadEquipmentDatabase(true);
        
        showNotification('Синхронизация завершена успешно!', 'success');
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        showNotification('Ошибка синхронизации: ' + error.message, 'error');
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
    
    let csvContent = "ID;Дата;Время;Автор;Участок;Инв.номер;Оборудование;Модель;Номер станка;Неисправность;Дата окончания;Время окончания;Статус;Кол-во простоев;Время простоя;Номенклатура;Создано;Обновлено;Firebase ID\n";
    
    repairRequests.forEach(request => {
        csvContent += `"${request.id || ''}";"${request.date || ''}";"${request.time || ''}";"${request.author || ''}";"${request.location || ''}";"${request.invNumber || ''}";"${request.equipmentName || ''}";"${request.model || ''}";"${request.machineNumber || ''}";"${request.faultDescription || ''}";"${request.repairEndDate || ''}";"${request.repairEndTime || ''}";"${request.status || ''}";"${request.downtimeCount || 0}";"${request.downtimeHours || 0}";"${request.productionItem || ''}";"${request.createdAt || ''}";"${request.updatedAt || ''}";"${request.firebaseId || ''}"\n`;
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

// Добавить заявку (с синхронизацией)
async function addRepairRequest(request) {
    // Генерируем локальный ID
    const localId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    request.id = localId;
    request.synced = false;
    request.createdAt = new Date().toISOString();
    request.updatedAt = new Date().toISOString();
    request.deviceId = deviceId;
    
    // Добавляем в локальный массив
    repairRequests.unshift(request); // Добавляем в начало для сортировки
    
    // Сохраняем локально
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    // Обновляем интерфейс
    renderRepairTable();
    updateSummary();
    
    // Пытаемся синхронизировать с Firebase
    if (isFirebaseInitialized && firestore) {
        try {
            const requestToSave = { ...request };
            delete requestToSave.id;
            delete requestToSave.synced;
            
            const docRef = await firestore.collection('repair_requests').add(requestToSave);
            
            // Обновляем локальную запись с Firebase ID
            const index = repairRequests.findIndex(r => r.id === localId);
            if (index !== -1) {
                repairRequests[index].firebaseId = docRef.id;
                repairRequests[index].synced = true;
                repairRequests[index].id = docRef.id; // Заменяем локальный ID на Firebase ID
                
                // Сохраняем обновленные данные
                localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
                
                showNotification('Заявка добавлена и синхронизирована!', 'success');
            }
            
        } catch (error) {
            console.error('Ошибка сохранения в Firebase:', error);
            showNotification('Заявка добавлена локально. Синхронизация при восстановлении связи.', 'warning');
        }
    } else {
        showNotification('Заявка добавлена локально. Синхронизация при восстановлении связи.', 'warning');
    }
    
    return request;
}

// Удалить заявку
window.deleteRequest = async function(id) {
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) {
        return;
    }
    
    try {
        // Находим заявку
        const request = repairRequests.find(req => req.id === id || req.firebaseId === id);
        
        if (!request) {
            showNotification('Заявка не найдена', 'error');
            return;
        }
        
        // Удаляем из Firebase если есть firebaseId и есть доступ
        if (request.firebaseId && isFirebaseInitialized && firestore) {
            try {
                await firestore.collection('repair_requests').doc(request.firebaseId).delete();
                console.log('Заявка удалена из Firebase:', request.firebaseId);
            } catch (firebaseError) {
                console.warn('Не удалось удалить заявку из Firebase:', firebaseError.message);
                showNotification('Заявка удалена локально, но не из облака (нет прав)', 'warning');
            }
        }
        
        // Удаляем локально
        repairRequests = repairRequests.filter(req => req.id !== id && req.firebaseId !== id);
        localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
        
        // Обновляем интерфейс
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
    const request = repairRequests.find(req => req.id === id || req.firebaseId === id);
    
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
    
    // Обновляем заявку
    request.status = 'completed';
    request.repairEndDate = repairEndDate;
    request.repairEndTime = repairEndTime;
    request.downtimeCount = parseInt(downtimeCount) || 1;
    request.downtimeHours = downtimeHours;
    request.updatedAt = new Date().toISOString();
    request.completedBy = currentUser.name;
    request.synced = false; // Помечаем для синхронизации
    
    // Сохраняем локально
    localStorage.setItem(STORAGE_KEYS.REPAIR_REQUESTS, JSON.stringify(repairRequests));
    
    // Синхронизируем с Firebase
    if (request.firebaseId && isFirebaseInitialized && firestore) {
        try {
            const updateData = {
                status: 'completed',
                repairEndDate: repairEndDate,
                repairEndTime: repairEndTime,
                downtimeCount: parseInt(downtimeCount) || 1,
                downtimeHours: downtimeHours,
                updatedAt: new Date().toISOString(),
                completedBy: currentUser.name
            };
            
            await firestore.collection('repair_requests').doc(request.firebaseId).update(updateData);
            
            request.synced = true;
            showNotification('Ремонт завершен и синхронизирован!', 'success');
        } catch (error) {
            console.error('Ошибка обновления в Firebase:', error);
            showNotification('Ремонт завершен локально. Синхронизация при восстановлении связи.', 'warning');
        }
    } else {
        showNotification('Ремонт завершен локально', 'success');
    }
    
    renderRepairTable();
    updateSummary();
};

// Выход из системы
window.logout = function() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        // Отписываемся от обновлений
        if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
        }
        
        // Выход из Firebase
        if (auth && auth.currentUser) {
            auth.signOut();
        }
        
        // Сбрасываем флаги Firebase
        isFirebaseInitialized = false;
        firebaseInitializationAttempted = false;
        
        // Удаляем данные пользователя
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(STORAGE_KEYS.AUTH_STATUS);
        
        // Сбрасываем флаг инициализации приложения
        appInitialized = false;
        
        redirectToLogin();
    }
};

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

// ============ ЗАГРУЗКА БАЗЫ ОБОРУДОВАНИЯ ============

// Загрузка базы оборудования
async function loadEquipmentDatabase(forceUpdate = false) {
    try {
        const lastUpdated = localStorage.getItem(STORAGE_KEYS.DB_LAST_UPDATED);
        const savedData = JSON.parse(localStorage.getItem(STORAGE_KEYS.EQUIPMENT_DB));
        
        // Проверяем, нужно ли обновлять
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const shouldUpdate = forceUpdate || 
                            !lastUpdated || 
                            new Date(lastUpdated) < oneDayAgo ||
                            !savedData || 
                            savedData.length === 0;
        
        if (shouldUpdate && isOnline) {
            console.log('Пытаемся загрузить базу оборудования...');
            
            // Используем правильный URL с папкой data
            const url = 'https://raw.githubusercontent.com/aitof-stack/repair-journal/main/data/equipment_database.csv';
            console.log('Загрузка с URL:', url);
            
            try {
                const response = await fetch(url, {
                    mode: 'cors',
                    cache: 'no-cache',
                    headers: {
                        'Accept': 'text/csv'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Ошибка HTTP ${response.status}`);
                }
                
                const csvContent = await response.text();
                
                if (!csvContent || csvContent.trim().length === 0) {
                    throw new Error('CSV файл пуст');
                }
                
                console.log('CSV загружен, длина:', csvContent.length, 'символов');
                
                equipmentDatabase = parseCSV(csvContent);
                
                if (equipmentDatabase.length === 0) {
                    console.warn('Не удалось распарсить CSV. Используем данные по умолчанию.');
                    equipmentDatabase = getDefaultEquipmentDatabase();
                }
                
                localStorage.setItem(STORAGE_KEYS.EQUIPMENT_DB, JSON.stringify(equipmentDatabase));
                localStorage.setItem(STORAGE_KEYS.DB_LAST_UPDATED, new Date().toISOString());
                
                console.log(`База оборудования загружена: ${equipmentDatabase.length} записей`);
                
                if (forceUpdate) {
                    showNotification(`База обновлена (${equipmentDatabase.length} записей)`, 'success');
                }
                
            } catch (fetchError) {
                console.warn('Ошибка загрузки с GitHub:', fetchError.message);
                
                // Если есть локальная копия, используем ее
                if (savedData && savedData.length > 0) {
                    equipmentDatabase = savedData;
                    console.log('Используем сохраненную базу после ошибки:', equipmentDatabase.length, 'записей');
                    showNotification('Ошибка загрузки. Используется локальная версия базы', 'warning');
                } else {
                    equipmentDatabase = getDefaultEquipmentDatabase();
                    console.log('Используем базу по умолчанию:', equipmentDatabase.length, 'записей');
                    showNotification('Нет подключения. Используется база по умолчанию.', 'warning');
                }
            }
            
        } else if (savedData && savedData.length > 0) {
            equipmentDatabase = savedData;
            console.log('Используем локальную базу оборудования:', equipmentDatabase.length, 'записей');
        } else {
            equipmentDatabase = getDefaultEquipmentDatabase();
            console.log('Используем базу по умолчанию (нет локальной):', equipmentDatabase.length, 'записей');
        }
        
    } catch (error) {
        console.error('Критическая ошибка загрузки базы оборудования:', error);
        equipmentDatabase = getDefaultEquipmentDatabase();
    }
    
    populateInvNumberSelect();
    populateLocationFilter();
    updateDBButtonInfo();
    
    return equipmentDatabase.length;
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

// ============ ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ============

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

// ============ РАБОТА С ФОРМОЙ ============

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
        
        // Пробуем переподключиться к Firebase
        if (!isFirebaseInitialized) {
            setTimeout(() => {
                initializeFirebase().then(success => {
                    if (success) {
                        loadRepairRequestsFromFirebase();
                        showNotification('Подключено к облачной базе', 'success');
                    }
                });
            }, 2000);
        }
    });
    
    window.addEventListener('offline', () => {
        console.log('Интернет пропал');
        isOnline = false;
        showNotification('Потеряно соединение с интернетом', 'warning');
        checkConnection();
    });
}

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
        
    } catch (error) {
        console.error('Ошибка при добавлении заявки:', error);
        showNotification('Ошибка при добавлении заявки: ' + error.message, 'error');
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
        createdBy: currentUser.name,
        deviceId: deviceId
    };
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

// ============ РАБОТА С ТАБЛИЦЕЙ ============

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
                <p style="margin: 5px 0 0 0; font-size: 14px;">${isFirebaseInitialized ? 'Создайте первую заявку' : 'Ожидание подключения к облаку...'}</p>
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
            actionButtons += `<button class="btn-delete" onclick="deleteRequest('${request.id}')" title="Удалить">Удалить</button>`;
        }
        
        if (request.status === 'pending' && currentUser && 
            (currentUser.type === 'admin' || currentUser.type === 'repair')) {
            actionButtons += `<button class="btn-complete" onclick="completeRequest('${request.id}')" title="Завершить ремонт">Завершить</button>`;
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

// ============ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ============

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

// Проверка соединения
function checkConnection() {
    isOnline = navigator.onLine;
    
    const connectionStatus = document.getElementById('connectionStatus');
    if (connectionStatus) {
        if (isOnline) {
            connectionStatus.textContent = isFirebaseInitialized ? 'Онлайн (синхронизация)' : 'Онлайн (локально)';
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
    // Отписываемся от обновлений Firebase перед переходом
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }
    
    // Сбрасываем флаги Firebase
    isFirebaseInitialized = false;
    firebaseInitializationAttempted = false;
    
    // Сбрасываем флаг инициализации приложения
    appInitialized = false;
    initializationInProgress = false;
    
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
            <h3 style="color: #4CAF50; margin-top: 0;">Статус синхронизации</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                <div><strong>Статус Firebase:</strong> <span style="color: ${isFirebaseInitialized ? '#4CAF50' : '#F44336'}">${isFirebaseInitialized ? 'ПОДКЛЮЧЕНО' : 'ОФФЛАЙН'}</span></div>
                <div><strong>Заявок в облаке:</strong> ${repairRequests.length}</div>
                <div><strong>База оборудования:</strong> ${equipmentDatabase.length} записей</div>
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
            Приложение: ${APP_NAME} v${APP_VERSION} | Режим: ${isFirebaseInitialized ? 'ОНЛАЙН (синхронизация)' : 'ОФФЛАЙН (локально)'}
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

// Обработка ошибок
window.addEventListener('error', function(e) {
    console.error('Глобальная ошибка:', e.error);
    showNotification('Произошла ошибка в приложении', 'error');
});

// Предотвращение повторной инициализации при перезагрузке страницы
window.addEventListener('beforeunload', function() {
    // Отписываемся от обновлений Firebase
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
    }
});

console.log(`${APP_NAME} v${APP_VERSION} готово к работе!`);
