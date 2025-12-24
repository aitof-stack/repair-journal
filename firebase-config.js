// firebase-config.js
// Конфигурация Firebase для приложения "Журнал заявок на ремонт"

console.log("Загрузка конфигурации Firebase...");

// Проверяем наличие Firebase SDK
if (typeof firebase === 'undefined') {
    console.warn("Firebase SDK не загружен. Синхронизация с облаком будет недоступна.");
} else {
    console.log("Firebase SDK доступен, версия:", firebase.SDK_VERSION);
    
    // Конфигурация Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyAdOqQX31vCcj7OXVyNSQX_nRUijAGOVKM",
        authDomain: "repair-journal-eadf1.firebaseapp.com",
        projectId: "repair-journal-eadf1",
        storageBucket: "repair-journal-eadf1.firebasestorage.app",
        messagingSenderId: "525057868534",
        appId: "1:525057868534:web:372b03243b0bc34b31e2d7"
    };
    
    try {
        // Инициализируем Firebase только если еще не инициализирован
        if (!firebase.apps.length) {
            console.log("Инициализируем Firebase приложение...");
            firebase.initializeApp(firebaseConfig);
            console.log("Firebase успешно инициализирован");
        } else {
            console.log("Firebase уже инициализирован, используем существующий экземпляр");
        }
        
        // Экспортируем сервисы для использования в основном скрипте
        window.firebaseApp = firebase.app();
        window.firestore = firebase.firestore();
        window.auth = firebase.auth();
        
        console.log("Firebase сервисы готовы к использованию");
        
    } catch (error) {
        console.error("Ошибка настройки Firebase:", error);
        console.warn("Приложение будет работать в офлайн-режиме без синхронизации");
    }
}

// Экспортируем функцию для инициализации Firebase из основного скрипта
window.initializeFirebaseFromConfig = async function() {
    return new Promise((resolve) => {
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            console.warn("Firebase не инициализирован");
            resolve(false);
            return;
        }
        
        try {
            // Получаем сервисы
            window.firebaseApp = firebase.app();
            window.firestore = firebase.firestore();
            window.auth = firebase.auth();
            
            console.log("Firebase сервисы получены из конфигурации");
            resolve(true);
        } catch (error) {
            console.error("Ошибка получения Firebase сервисов:", error);
            resolve(false);
        }
    });
};
