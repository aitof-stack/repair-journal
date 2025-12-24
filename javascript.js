// ЖУРНАЛ ЗАЯВОК НА РЕМОНТ ОБОРУДОВАНИЯ - ВЕРСИЯ С FIREBASE СИНХРОНИЗАЦИЕЙ

// Константы
const APP_VERSION = '5.0.5';
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

// Firebase переменные
let firebaseApp = null;
let firestore = null;
let auth = null;
let firestoreUnsubscribe = null;
let isFirebaseInitialized = false;
let isSyncing = false;
let firebaseInitializationAttempted = false;
let firebasePersistenceEnabled = false;

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
    console.log(`${APP_NAME} v${APP_VERSION} - основная инициализация`);
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
        
        // Настраиваем кэширование для офлайн работы (только если еще не включено)
        if (!firebasePersistenceEnabled) {
            try {
                await firestore.enablePersistence({ synchronizeTabs: true });
                firebasePersistenceEnabled = true;
                console.log('Firestore persistence включена');
            } catch (persistenceError) {
                // Если persistence уже включена, это нормально
                if (persistenceError.code === 'failed-precondition') {
                    console.log('Firestore persistence уже включена в другой вкладке');
                    firebasePersistenceEnabled = true;
                } else if (persistenceError.code === 'unimplemented') {
                    console.warn('Firestore persistence не поддерживается в этом браузере');
                } else {
                    console.warn('Не удалось включить persistence:', persistenceError.message);
                }
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
        firebasePersistenceEnabled = false;
        
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

// Вспомогательная функция для выполнения запроса с таймаутом
async function fetchWithTimeout
