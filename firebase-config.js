// firebase-config.js - Конфигурация Firebase
// Версия 1.0.1

console.log('Firebase config v1.0.1 загружен');

// Конфигурация Firebase проекта "repair-journal-eadf1"
const firebaseConfig = {
    apiKey: "AIzaSyAdOqQX31vCcj7OXVyNSQX_nRUijAGOVKM",
    authDomain: "repair-journal-eadf1.firebaseapp.com",
    projectId: "repair-journal-eadf1",
    storageBucket: "repair-journal-eadf1.firebasestorage.app",
    messagingSenderId: "525057868534",
    appId: "1:525057868534:web:372b03243b0bc34b31e2d7",
    measurementId: "G-ZGMEQTYBKQ"
};

// Экспортируем конфигурацию для использования в других файлах
window.firebaseConfig = firebaseConfig;

console.log('Конфигурация Firebase экспортирована:', {
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain
});

// Функция для безопасной инициализации Firebase
window.initializeFirebaseSafely = async function() {
    console.log('Безопасная инициализация Firebase...');
    
    // Проверяем, загружена ли библиотека Firebase
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не загружен');
        return { success: false, error: 'Firebase SDK не загружен' };
    }
    
    try {
        // Проверяем, не инициализирован ли Firebase уже
        if (firebase.apps.length > 0) {
            console.log('Firebase уже инициализирован, используем существующий экземпляр');
            const app = firebase.app();
            return {
                success: true,
                app: app,
                db: firebase.firestore(app),
                auth: firebase.auth(app)
            };
        }
        
        // Инициализируем Firebase
        console.log('Инициализируем Firebase с проектом:', firebaseConfig.projectId);
        const app = firebase.initializeApp(firebaseConfig);
        
        // Получаем сервисы
        const db = firebase.firestore(app);
        const auth = firebase.auth(app);
        
        console.log('Firebase успешно инициализирован');
        
        return {
            success: true,
            app: app,
            db: db,
            auth: auth
        };
        
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Функция для настройки анонимной аутентификации
window.setupAnonymousAuth = async function() {
    if (!window.auth) {
        console.warn('Auth не инициализирован');
        return false;
    }
    
    try {
        // Пробуем анонимную аутентификацию
        await window.auth.signInAnonymously();
        console.log('Анонимная аутентификация выполнена');
        return true;
    } catch (error) {
        console.warn('Ошибка анонимной аутентификации:', error);
        return false;
    }
};

// Функция для настройки Firestore persistence
window.setupFirestorePersistence = async function() {
    if (!window.db) {
        console.warn('Firestore не инициализирован');
        return false;
    }
    
    try {
        // Проверяем, поддерживает ли браузер persistence
        await window.db.enablePersistence({
            synchronizeTabs: true
        }).catch(err => {
            // Игнорируем ошибку если persistence уже включена
            if (err.code === 'failed-precondition') {
                console.log('Persistence уже включена в другой вкладке');
            } else if (err.code === 'unimplemented') {
                console.log('Браузер не поддерживает persistence');
            } else {
                console.warn('Ошибка включения persistence:', err);
            }
        });
        
        console.log('Firestore persistence настроена');
        return true;
    } catch (error) {
        console.warn('Ошибка настройки persistence:', error);
        return false;
    }
};

// Функция для полной инициализации Firebase сервисов
window.initializeFirebaseServices = async function() {
    console.log('Инициализация Firebase сервисов...');
    
    try {
        // 1. Инициализируем Firebase
        const initResult = await window.initializeFirebaseSafely();
        if (!initResult.success) {
            throw new Error(initResult.error || 'Не удалось инициализировать Firebase');
        }
        
        // 2. Сохраняем сервисы в window
        window.firebaseApp = initResult.app;
        window.db = initResult.db;
        window.auth = initResult.auth;
        window.isFirebaseReady = true;
        
        // 3. Настраиваем анонимную аутентификацию
        await window.setupAnonymousAuth();
        
        // 4. Настраиваем persistence (необязательно)
        await window.setupFirestorePersistence();
        
        console.log('Все Firebase сервисы успешно инициализированы');
        return true;
        
    } catch (error) {
        console.error('Ошибка инициализации Firebase сервисов:', error);
        window.isFirebaseReady = false;
        return false;
    }
};

// Проверяем, была ли уже выполнена инициализация
window.checkFirebaseInitialization = function() {
    return {
        isSDKLoaded: typeof firebase !== 'undefined',
        isAppInitialized: typeof firebase !== 'undefined' && firebase.apps.length > 0,
        isDbReady: typeof window.db !== 'undefined' && window.db !== null,
        isAuthReady: typeof window.auth !== 'undefined' && window.auth !== null,
        isFirebaseReady: window.isFirebaseReady === true
    };
};

console.log('Firebase config готов к использованию');
