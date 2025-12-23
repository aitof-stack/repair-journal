<script type="module">
  // firebase-config.js

// Импорт функций из Modular SDK (версия 10.x)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Конфигурация вашего проекта (замените на свою!)
const firebaseConfig = {
    apiKey: "AIzaSyAdOqQX31vCcj7OXVyNSQX_nRUijAGOVKM",
    authDomain: "repair-journal-eadf1.firebaseapp.com",
    projectId: "repair-journal-eadf1",
    storageBucket: "repair-journal-eadf1.firebasestorage.app",
    messagingSenderId: "525057868534",
    appId: "1:525057868534:web:372b03243b0bc34b31e2d7"
};

// Инициализация Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Инициализация сервисов
const db = getFirestore(firebaseApp); // База данных Firestore
const auth = getAuth(firebaseApp);    // Модуль аутентификации

// Функция для анонимного входа (требуется правилами безопасности Firestore)
async function loginToFirebase() {
    try {
        await signInAnonymously(auth);
        console.log("Анонимный вход в Firebase выполнен. UID:", auth.currentUser?.uid);
    } catch (error) {
        console.error("Ошибка анонимного входа в Firebase:", error);
    }
}

// Экспорт всего необходимого
export { 
    firebaseApp, db, auth, 
    collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy,
    loginToFirebase 
};
</script>
