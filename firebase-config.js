// firebase-config.js - Конфигурация Firebase
// Версия 2.0.0 - с исправленной аутентификацией

console.log('Firebase config v2.0.0 загружен');

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

// Основная функция инициализации Firebase
window.initializeFirebase = async function() {
    console.log('Инициализация Firebase...');
    
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
        
        // Настраиваем анонимную аутентификацию
        console.log('Настройка анонимной аутентификации...');
        try {
            // Пробуем получить текущего пользователя
            let user = auth.currentUser;
            
            if (!user) {
                // Если нет пользователя, пробуем анонимную аутентификацию
                console.log('Пытаемся анонимную аутентификацию...');
                const userCredential = await auth.signInAnonymously();
                user = userCredential.user;
                console.log('Анонимная аутентификация успешна, user ID:', user.uid);
            } else {
                console.log('Пользователь уже аутентифицирован:', user.uid);
            }
            
            // Настраиваем Firestore persistence (офлайн-режим)
            try {
                await db.enablePersistence({
                    synchronizeTabs: true
                });
                console.log('Firestore persistence включена');
            } catch (persistenceError) {
                // Игнорируем ошибку если persistence уже включена
                if (persistenceError.code === 'failed-precondition') {
                    console.log('Persistence уже включена в другой вкладке');
                } else if (persistenceError.code === 'unimplemented') {
                    console.log('Браузер не поддерживает persistence');
                } else {
                    console.warn('Ошибка включения persistence:', persistenceError);
                }
            }
            
            // Сохраняем сервисы в глобальные переменные
            window.firebaseApp = app;
            window.db = db;
            window.auth = auth;
            window.isFirebaseReady = true;
            window.firebaseUser = user;
            
            console.log('Firebase успешно инициализирован:', {
                projectId: app.options.projectId,
                userId: user.uid,
                isAnonymous: user.isAnonymous
            });
            
            return { 
                success: true, 
                app: app, 
                db: db, 
                auth: auth,
                user: user 
            };
            
        } catch (authError) {
            console.error('Ошибка аутентификации:', authError);
            
            // Даже если аутентификация не удалась, все равно сохраняем сервисы
            window.firebaseApp = app;
            window.db = db;
            window.auth = auth;
            window.isFirebaseReady = true; // Все равно помечаем как готовый
            
            console.log('Firebase инициализирован без аутентификации');
            
            return { 
                success: true, 
                app: app, 
                db: db, 
                auth: auth,
                user: null,
                warning: 'Аутентификация не удалась, но Firebase готов'
            };
        }
        
    } catch (error) {
        console.error('Критическая ошибка инициализации Firebase:', error);
        
        // Устанавливаем флаги офлайн-режима
        window.isFirebaseReady = false;
        window.db = null;
        window.auth = null;
        window.firebaseApp = null;
        
        return { 
            success: false, 
            error: error.message 
        };
    }
};

// Проверка состояния Firebase
window.checkFirebaseStatus = function() {
    const status = {
        sdkLoaded: typeof firebase !== 'undefined',
        appInitialized: typeof firebase !== 'undefined' && firebase.apps.length > 0,
        dbReady: typeof window.db !== 'undefined' && window.db !== null,
        authReady: typeof window.auth !== 'undefined' && window.auth !== null,
        userAuthenticated: window.firebaseUser !== null,
        isFirebaseReady: window.isFirebaseReady === true
    };
    
    console.log('Статус Firebase:', status);
    return status;
};

// Функция для принудительной переинициализации Firebase
window.reinitializeFirebase = async function() {
    console.log('Принудительная переинициализация Firebase...');
    
    // Очищаем предыдущие состояния
    window.isFirebaseReady = false;
    window.db = null;
    window.auth = null;
    window.firebaseApp = null;
    window.firebaseUser = null;
    
    // Пробуем инициализировать заново
    return await window.initializeFirebase();
};

// Тестовая функция для проверки соединения с Firestore
window.testFirestoreConnection = async function() {
    if (!window.isFirebaseReady || !window.db) {
        console.log('Firebase не готов для тестирования');
        return { success: false, error: 'Firebase не готов' };
    }
    
    try {
        console.log('Тестирование соединения с Firestore...');
        
        // Пробуем простой запрос
        const testRef = window.db.collection('test_connection').doc('ping');
        await testRef.set({
            timestamp: new Date().toISOString(),
            test: 'connection_test'
        }, { merge: true });
        
        console.log('Запись в Firestore успешна');
        
        // Удаляем тестовую запись
        await testRef.delete();
        
        console.log('Соединение с Firestore работает');
        return { success: true };
        
    } catch (error) {
        console.error('Ошибка тестирования Firestore:', error);
        return { success: false, error: error.message };
    }
};

console.log('Firebase config загружен и готов к использованию');
