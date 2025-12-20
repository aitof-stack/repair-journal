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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем список пользователей для ремонтной службы по умолчанию
    populateUserList('repair');
    
    // Устанавливаем первого пользователя ремонтной службы по умолчанию
    if (users.repair.length > 0) {
        selectedUser = users.repair[0];
        highlightSelectedUser(selectedUser.name);
    }
    
    // Обработчики для кнопок типа пользователя
    document.querySelectorAll('.user-type-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.user-type-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            selectedUserType = this.dataset.type;
            selectedUser = null;
            
            populateUserList(selectedUserType);
            
            if (selectedUserType === 'repair') {
                document.getElementById('passwordSection').style.display = 'none';
                if (users.repair.length > 0) {
                    selectedUser = users.repair[0];
                    highlightSelectedUser(selectedUser.name);
                }
            } else {
                document.getElementById('passwordSection').style.display = 'block';
            }
            
            document.getElementById('password').value = '';
            document.getElementById('errorMessage').style.display = 'none';
        });
    });
    
    // Обработчик кнопки входа
    document.getElementById('loginBtn').addEventListener('click', login);
    
    // Обработчик нажатия Enter в поле пароля
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            login();
        }
    });
});

// Заполнение списка пользователей
function populateUserList(userType) {
    const userList = document.getElementById('userList');
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
            document.getElementById('password').value = '';
            document.getElementById('errorMessage').style.display = 'none';
        });
        
        userList.appendChild(userItem);
    });
}

// Выделение выбранного пользователя
function highlightSelectedUser(userName) {
    document.querySelectorAll('.user-item').forEach(item => {
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
        const enteredPassword = document.getElementById('password').value.trim();
        
        if (!enteredPassword) {
            showError('Введите пароль');
            return;
        }
        
        if (enteredPassword !== selectedUser.password) {
            showError('Неверный пароль. Попробуйте еще раз.');
            return;
        }
    }
    
    // Сохраняем данные пользователя
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
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// Получение прав доступа
function getPermissions(userType) {
    switch(userType) {
        case 'admin':
            return { canAdd: true, canDelete: true, canComplete: true, canExport: true };
        case 'author':
            return { canAdd: true, canDelete: false, canComplete: false, canExport: false };
        case 'repair':
            return { canAdd: false, canDelete: false, canComplete: true, canExport: false };
        default:
            return { canAdd: false, canDelete: false, canComplete: false, canExport: false };
    }
}

// Функция проверки аутентификации
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