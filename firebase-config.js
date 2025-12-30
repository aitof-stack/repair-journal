// firebase-config.js - Конфигурация Firebase v3.2.0 (ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ)
// Устранена ошибка с настройками Firestore после инициализации

console.log('Firebase config v3.2.0 загружен');

// Конфигурация Firebase проекта
const firebaseConfig = {
    apiKey: "AIzaSyAdOqQX31vCcj7OXVyNSQX_nRUijAGOVKM",
    authDomain: "repair-journal-eadf1.firebaseapp.com",
    projectId: "repair-journal-eadf1",
    storageBucket: "repair-journal-eadf1.firebasestorage.app",
    messagingSenderId: "525057868534",
    appId: "1:525057868534:web:372b03243b0bc34b31e2d7",
    measurementId: "G-ZGMEQTYBKQ"
};

// Экспортируем конфигурацию
window.firebaseConfig = firebaseConfig;

// Флаги состояния
let persistenceEnabled = false;
let settingsApplied = false;

// Основная функция инициализации Firebase (ИСПРАВЛЕННАЯ)
window.initializeFirebase = async function() {
    console.log('Инициализация Firebase v3.2.0...');
    
    // Проверяем, загружена ли библиотека Firebase
    if (typeof firebase === 'undefined') {
        console.error('Firebase SDK не загружен!');
        return { success: false, error: 'Firebase SDK не загружен' };
    }
    
    try {
        // Инициализируем Firebase только если еще не инициализирован
        let app;
        if (firebase.apps.length === 0) {
            console.log('Создаем новое Firebase приложение...');
            app = firebase.initializeApp(firebaseConfig);
        } else {
            console.log('Используем существующее Firebase приложение');
            app = firebase.app();
        }
        
        // Получаем сервисы
        const db = firebase.firestore(app);
        const auth = firebase.auth(app);
        
        console.log('Firebase сервисы получены');
        
        // ВАЖНО: НАСТРАИВАЕМ НАСТРОЙКИ Firestore ДО ВСЕХ ДРУГИХ ОПЕРАЦИЙ
        if (!settingsApplied) {
            try {
                console.log('Применение настроек Firestore...');
                // Настройка таймаутов для Firestore (только один раз!)
                const firestoreSettings = {
                    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
                };
                
                db.settings(firestoreSettings);
                settingsApplied = true;
                console.log('Настройки Firestore успешно применены');
            } catch (settingsError) {
                console.warn('Ошибка применения настроек Firestore:', settingsError.message);
                // Продолжаем работу даже если настройки не применились
            }
        }
        
        // ВАЖНО: Настраиваем persistence
        if (!persistenceEnabled) {
            try {
                console.log('Попытка включения persistence...');
                
                // Используем более безопасный подход
                await db.enablePersistence({
                    synchronizeTabs: false  // Отключаем синхронизацию между вкладками
                });
                
                persistenceEnabled = true;
                console.log('Firestore persistence успешно включена');
                
            } catch (persistenceError) {
                console.log('Обработка ошибки persistence:', persistenceError.code);
                
                // Игнорируем конкретные ошибки и продолжаем работу
                if (persistenceError.code === 'failed-precondition') {
                    console.log('Persistence уже включена в другой вкладке. Продолжаем...');
                } else if (persistenceError.code === 'unimplemented') {
                    console.log('Браузер не поддерживает persistence. Продолжаем...');
                } else {
                    console.warn('Другая ошибка persistence:', persistenceError.message);
                }
                
                // Все равно продолжаем работу
                persistenceEnabled = true;
            }
        }
        
        // Настраиваем анонимную аутентификацию
        console.log('Настройка аутентификации...');
        let user = null;
        
        try {
            user = auth.currentUser;
            
            if (!user) {
                // Пробуем анонимную аутентификацию
                console.log('Попытка анонимной аутентификации...');
                const userCredential = await auth.signInAnonymously();
                user = userCredential.user;
                console.log('Анонимная аутентификация успешна:', user.uid);
            } else {
                console.log('Пользователь уже аутентифицирован:', user.uid);
            }
        } catch (authError) {
            console.warn('Ошибка аутентификации (не критично):', authError);
            // Продолжаем без аутентификации
        }
        
        // Тестируем соединение с Firestore (упрощенная версия)
        let connectionTest = false;
        try {
            console.log('Тестирование соединения с Firestore...');
            
            // Более безопасный тест - просто проверяем доступ
            const testQuery = db.collection('repairs').limit(1);
            // Используем таймаут для теста
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Таймаут соединения')), 5000)
            );
            
            await Promise.race([testQuery.get(), timeoutPromise]);
            
            connectionTest = true;
            console.log('Соединение с Firestore успешно!');
            
        } catch (connectionError) {
            console.warn('Ошибка соединения с Firestore:', connectionError.message);
            
            // Анализируем ошибку
            if (connectionError.code === 'permission-denied') {
                console.error('Доступ запрещен. Проверьте правила безопасности Firestore.');
            } else if (connectionError.code === 'unavailable') {
                console.error('Firestore недоступен. Проверьте интернет-соединение.');
            }
            
            connectionTest = false;
        }
        
        // Сохраняем сервисы в глобальные переменные
        window.firebaseApp = app;
        window.db = db;
        window.auth = auth;
        window.isFirebaseReady = connectionTest;
        window.firebaseUser = user;
        
        console.log('Инициализация Firebase завершена:', {
            projectId: app.options.projectId,
            userId: user?.uid || 'anonymous',
            firestoreConnected: connectionTest,
            persistenceEnabled: persistenceEnabled,
            settingsApplied: settingsApplied
        });
        
        return { 
            success: true, 
            app: app, 
            db: db, 
            auth: auth,
            user: user,
            connected: connectionTest
        };
        
    } catch (error) {
        console.error('Критическая ошибка инициализации Firebase:', error);
        
        // Устанавливаем флаги офлайн-режима
        window.isFirebaseReady = false;
        window.db = null;
        window.auth = null;
        window.firebaseApp = null;
        window.firebaseUser = null;
        
        return { 
            success: false, 
            error: error.message,
            connected: false
        };
    }
};

// Проверка состояния Firebase
window.checkFirebaseStatus = function() {
    const status = {
        sdkLoaded: typeof firebase !== 'undefined',
        appInitialized: typeof firebase !== 'undefined' && firebase.apps.length > 0,
        dbReady: window.db !== null && window.db !== undefined,
        authReady: window.auth !== null && window.auth !== undefined,
        userAuthenticated: window.firebaseUser !== null,
        isFirebaseReady: window.isFirebaseReady === true,
        persistenceEnabled: persistenceEnabled,
        settingsApplied: settingsApplied
    };
    
    console.log('Статус Firebase:', status);
    return status;
};

// Функция для принудительной переинициализации Firebase
window.reinitializeFirebase = async function() {
    console.log('Принудительная переинициализация Firebase...');
    
    // Сбрасываем флаги
    persistenceEnabled = false;
    settingsApplied = false;
    
    // Очищаем предыдущие состояния
    window.isFirebaseReady = false;
    window.db = null;
    window.auth = null;
    window.firebaseApp = null;
    window.firebaseUser = null;
    
    try {
        // Пробуем закрыть предыдущее приложение
        if (firebase.apps.length > 0) {
            try {
                await firebase.app().delete();
                console.log('Предыдущее Firebase приложение удалено');
            } catch (deleteError) {
                console.warn('Не удалось удалить предыдущее приложение:', deleteError);
            }
        }
    } catch (e) {
        console.warn('Ошибка при подготовке к переинициализации:', e);
    }
    
    // Пробуем инициализировать заново
    return await window.initializeFirebase();
};

// Тестовая функция для проверки соединения с Firestore (безопасная версия)
window.testFirestoreConnection = async function() {
    if (!window.db) {
        console.log('Firestore не инициализирован');
        return { success: false, error: 'Firestore не инициализирован' };
    }
    
    try {
        console.log('Безопасное тестирование соединения с Firestore...');
        
        // Простой тест - проверяем доступ к коллекции repairs с таймаутом
        const testRef = window.db.collection('repairs');
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Таймаут теста соединения')), 7000)
        );
        
        const querySnapshot = await Promise.race([testRef.limit(1).get(), timeoutPromise]);
        
        console.log('Соединение с Firestore работает. Документов:', querySnapshot.size);
        
        // Если коллекция пуста - это нормально, главное что доступ есть
        return { 
            success: true, 
            documentCount: querySnapshot.size,
            message: 'Соединение установлено успешно'
        };
        
    } catch (error) {
        console.error('Ошибка тестирования Firestore:', error);
        
        // Детальный анализ ошибки
        let errorMessage = error.message;
        if (error.code === 'permission-denied') {
            errorMessage = 'Доступ запрещен. Проверьте правила безопасности Firestore.';
        } else if (error.code === 'unavailable') {
            errorMessage = 'Firestore недоступен. Проверьте интернет-соединение.';
        }
        
        return { 
            success: false, 
            error: errorMessage,
            code: error.code
        };
    }
};

// Функция для очистки кеша Firebase (принудительный сброс)
window.clearFirebaseCache = async function() {
    console.log('Очистка кеша Firebase...');
    
    try {
        if (window.db && persistenceEnabled) {
            // Пробуем очистить persistence
            await window.db.clearPersistence();
            console.log('Persistence очищена');
        }
        
        // Сбрасываем флаги
        persistenceEnabled = false;
        settingsApplied = false;
        window.isFirebaseReady = false;
        
        console.log('Кеш Firebase очищен');
        return { success: true };
        
    } catch (error) {
        console.error('Ошибка очистки кеша:', error);
        return { success: false, error: error.message };
    }
};

console.log('Firebase config v3.2.0 загружен и готов к использованию');
