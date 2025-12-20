// База пользователей
const users = {
    admin: [
        { name: "Попов Н.В.", password: "Tab5180" },
        { name: "Аитов Е.А.", password: "Tab4565" }
    ],
    author: [
        { name: "Виноградов А.Ф.", password: "Tab3918" },
        { name: "Базыльников С.П.", password: "Tab6219" },
        { name: "Шостак И.Е.", password: "Tab628" },
        { name: "Шихов С.Ф.", password: "Tab2035" },
        { name: "Мамайко Г.С.", password: "Tab4348" },
        { name: "Селиванов В.В.", password: "Tab4673" }
    ],
    repair: [
        { name: "Горшков И.В.", password: "" }
    ]
};

let selectedUserType = 'repair';
let selectedUser = null;

// DOM элементы
const userTypeButtons = document.querySelectorAll('.user-type-btn');
const userList = document.getElementById('userList');
const passwordSection = document.getElementById('passwordSection');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем список пользователей для ремонтной службы по умолчанию
    populateUserList('repair');
    
    // Устанавливаем первого пользователя ремонтной службы по умолчанию
    if (users.repair.length > 0) {
        selectedUser = users.repair[0];
        highlightSelectedUser(selectedUser.name);
    }
    
    // Добавляем обработчики для кнопок типа пользователя
    userTypeButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Убираем активный класс у всех кнопок
            userTypeButtons.forEach(btn => btn.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке
            this.classList.add('active');
            
            // Обновляем выбранный тип пользователя
            selectedUserType = this.dataset.type;
            selectedUser = null;
            
            // Обновляем список пользователей
            populateUserList(selectedUserType);
            
            // Показываем/скрываем поле пароля
            if (selectedUserType === 'repair') {
                passwordSection.style.display = 'none';
                if (users.repair.length > 0) {
                    selectedUser = users.repair[0];
                    highlightSelectedUser(selectedUser.name);
                }
            } else {
                passwordSection.style.display = 'block';
            }
            
            // Сбрасываем поле пароля и сообщение об ошибке
            passwordInput.value = '';
            errorMessage.style.display = 'none';
        });
    });
    
    // Обработчик кнопки входа
    loginBtn.addEventListener('click', login);
    
    // Обработчик нажатия Enter в поле пароля
    passwordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});

// Заполнение списка пользователей
function populateUserList(userType) {
    userList.innerHTML = '';
    
    if (!users[userType] || users[userType].length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'user-item';
        emptyItem.textContent = 'Нет пользователей в этой категории';
        userList.appendChild(emptyItem);
        return;
    }
    
    users[userType].forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.textContent = user.name;
        userItem.dataset.name = user.name;
        
        userItem.addEventListener('click', function() {
            selectedUser = user;
            highlightSelectedUser(user.name);
            passwordInput.value = '';
            errorMessage.style.display = 'none';
        });
        
        userList.appendChild(userItem);
    });
}

// Выделение выбранного пользователя
function highlightSelectedUser(userName) {
    const userItems = document.querySelectorAll('.user-item');
    userItems.forEach(item => {
        if (item.dataset.name === userName) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
}

// Функция входа
function login() {
    if (!selectedUser) {
        showError('Пожалуйста, выберите пользователя');
        return;
    }
    
    // Проверка пароля (кроме ремонтной службы)
    if (selectedUserType !== 'repair') {
        const enteredPassword = passwordInput.value.trim();
        
        if (!enteredPassword) {
            showError('Введите пароль');
            return;
        }
        
        if (enteredPassword !== selectedUser.password) {
            showError('Неверный пароль. Попробуйте еще раз.');
            return;
        }
    }
    
    // Сохраняем данные пользователя в localStorage
    const userData = {
        type: selectedUserType,
        name: selectedUser.name,
        permissions: getPermissions(selectedUserType)
    };
    
    localStorage.setItem('currentUser', JSON.stringify(userData));
    localStorage.setItem('isAuthenticated', 'true');
    
    // Перенаправляем на главную страницу
    window.location.href = 'index.html';
}

// Функция показа ошибки
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Скрываем ошибку через 3 секунды
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// Получение прав доступа для типа пользователя
function getPermissions(userType) {
    switch(userType) {
        case 'admin':
            return {
                canAdd: true,
                canDelete: true,
                canComplete: true,
                canViewAll: true,
                canEdit: true
            };
        case 'author':
            return {
                canAdd: true,
                canDelete: false,
                canComplete: false,
                canViewAll: true,
                canEdit: false
            };
        case 'repair':
            return {
                canAdd: false,
                canDelete: false,
                canComplete: true,
                canViewAll: true,
                canEdit: false
            };
        default:
            return {
                canAdd: false,
                canDelete: false,
                canComplete: false,
                canViewAll: false,
                canEdit: false
            };
    }
}

// Функция проверки аутентификации (для использования на других страницах)
function checkAuthentication() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!isAuthenticated || !currentUser) {
        return null;
    }
    
    return currentUser;
}

// Функция выхода
function logout() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    window.location.href = 'login.html';
}