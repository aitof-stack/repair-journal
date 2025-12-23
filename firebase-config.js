// firebase-config.js
// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAdOqQX31vCcj7OXVyNSQX_nRUijAGOVKM",
    authDomain: "repair-journal-eadf1.firebaseapp.com",
    projectId: "repair-journal-eadf1",
    storageBucket: "repair-journal-eadf1.firebasestorage.app",
    messagingSenderId: "525057868534",
    appId: "1:525057868534:web:372b03243b0bc34b31e2d7"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);

// Инициализация сервисов
const firebaseApp = firebase.app();
const db = firebase.firestore();
const auth = firebase.auth();

// Функция для анонимного входа
async function loginToFirebase() {
    try {
        await auth.signInAnonymously();
        console.log("Анонимный вход в Firebase выполнен. UID:", auth.currentUser?.uid);
    } catch (error) {
        console.error("Ошибка анонимного входа в Firebase:", error);
    }
}

// Делаем необходимые объекты глобально доступными
window.firebaseApp = firebaseApp;
window.db = db;
window.auth = auth;
window.loginToFirebase = loginToFirebase;

// Также экспортируем функции firestore, чтобы не писать каждый раз firebase.firestore.
// Но в javascript.js мы будем использовать глобальные переменные.
