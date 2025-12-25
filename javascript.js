// Ремонтный журнал (Firebase Sync) v5.0.6
// Основной файл приложения

console.log('Ремонтный журнал (Firebase Sync) v5.0.6 запускается...');

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let firebaseApp = null;
let db = null;
let auth = null;
let user = null;
let repairsList = [];
let equipmentList = [];
let isFirebaseReady = false;
let unsubscribeRepairs = null;

// ===== ИНИЦИАЛИЗАЦИЯ ПРИЛОЖЕНИЯ =====
async function initApp() {
    console.log('Ремонтный журнал (Firebase Sync) v5.0.6 - основная инициализация');
    
    // Проверяем авторизацию
    await checkAuthAndInit();
    
    // Инициализируем Firebase
    await initializeFirebase();
    
    // Загружаем базу оборудования
    await loadEquipmentDatabase();
    
    // Загружаем данные
    await loadData();
    
    // Настраиваем UI
    setupUI();
    
    console.log('Приложение успешно запущено. Firebase: ONLINE');
}

// ===== АВТОРИЗАЦИЯ =====
async function checkAuthAndInit() {
    // Проверяем сохраненные данные пользователя из localStorage
    const isAuthenticated = localStorage.getItem('repair_journal_isAuthenticated');
    const currentUser = JSON.parse(localStorage.getItem('repair_journal_currentUser'));
    
    if (!isAuthenticated || !currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    user = currentUser;
    console.log('Пользователь:', user.name + ' (' + user.type + ')');
    
    // Обновляем UI
    updateUserInfo();
}

function updateUserInfo() {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userInfoElement = document.getElementById('userInfo');
    
    if (userNameElement && userRoleElement && user) {
        userNameElement.textContent = user.name;
        userRoleElement.textContent = user.type === 'admin' ? 'Администратор' : 
                                    user.type === 'author' ? 'Автор заявки' : 'Ремонтная служба';
        
        if (userInfoElement) {
            userInfoElement.style.display = 'flex';
        }
    }
}

// ===== FIREBASE ИНИЦИАЛИЗАЦИЯ =====
async function initializeFirebase() {
    console.log('Проверяем инициализацию Firebase...');
    
    // Ждем загрузки Firebase SDK
    if (typeof firebase === 'undefined') {
        console.warn('Firebase SDK не загружен');
        return;
    }
    
    try {
        // Используем уже инициализированное приложение
        if (firebase.apps.length > 0) {
            firebaseApp = firebase.apps[0];
        } else {
            firebaseApp = firebase.initializeApp(window.firebaseConfig);
        }
        
        console.log('Firebase приложения найдены:', firebase.apps.length);
        console.log('Firebase project:', firebaseApp.options.projectId);
        
        // Инициализируем сервисы
        db = firebase.firestore();
        auth = firebase.auth();
        
        // Анонимная аутентификация
        if (!auth.currentUser) {
            console.log('Выполняем анонимный вход...');
            await auth.signInAnonymously();
            console.log('Анонимный вход выполнен. User ID:', auth.currentUser.uid);
        } else {
            console.log('Уже авторизован. User ID:', auth.currentUser.uid);
        }
        
        // Включаем persistence
        try {
            await db.enablePersistence({ synchronizeTabs: true });
            console.log('Firestore persistence включена');
        } catch (err) {
            console.log('Persistence error (можно игнорировать):', err.message);
        }
        
        isFirebaseReady = true;
        console.log('Firebase успешно инициализирован');
        
    } catch (error) {
        console.error('Ошибка инициализации Firebase:', error);
        isFirebaseReady = false;
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    try {
        // Проверяем наличие локальной базы оборудования
        const localEquipment = localStorage.getItem('equipment_database');
        
        if (localEquipment) {
            equipmentList = JSON.parse(localEquipment);
            console.log('Загружено оборудования из localStorage:', equipmentList.length, 'записей');
        } else {
            // Загружаем примерную базу
            equipmentList = [
                { invNumber: "001", name: "Компьютер", location: "Офис 1", model: "HP Elite" },
                { invNumber: "002", name: "Принтер", location: "Офис 2", model: "Canon MF" },
                { invNumber: "003", name: "Монитор", location: "Офис 3", model: "Dell 24\"" },
                { invNumber: "004", name: "Сервер", location: "Серверная", model: "IBM System" },
                { invNumber: "005", name: "Ноутбук", location: "Мобильный", model: "Lenovo ThinkPad" }
            ];
            
            // Сохраняем локально
            localStorage.setItem('equipment_database', JSON.stringify(equipmentList));
            console.log('Создана локальная база оборудования:', equipmentList.length, 'записей');
        }
        
        // Инициализация селекта инвентарных номеров
        initInvNumberSelect();
        
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
    }
}

async function loadData() {
    console.log('Загрузка данных из Firestore...');
    
    try {
        if (isFirebaseReady && db) {
            // Загружаем из Firestore
            const snapshot = await db.collection('repairs').orderBy('date', 'desc').get();
            repairsList = [];
            snapshot.forEach(doc => {
                repairsList.push({ id: doc.id, ...doc.data() });
            });
            console.log('Загружено заявок из Firestore:', repairsList.length);
            
            // Настраиваем реальное время
            setupRealtimeUpdates();
        } else {
            // Загружаем локальные данные
            repairsList = loadLocalRepairs();
            console.log('Загружено локальных заявок:', repairsList.length);
        }
        
        // Сортируем заявки: сначала "в ремонте", потом остальные
        repairsList = sortRepairsByStatus(repairsList);
        
        // Рендерим таблицу
        renderRepairsTable();
        
        // Синхронизируем локальные данные
        await syncLocalData();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        repairsList = loadLocalRepairs();
        repairsList = sortRepairsByStatus(repairsList);
        renderRepairsTable();
    }
}

function loadLocalRepairs() {
    const localData = localStorage.getItem('repair_journal_data');
    if (localData) {
        try {
            return JSON.parse(localData);
        } catch (e) {
            console.error('Ошибка парсинга локальных данных:', e);
        }
    }
    return [];
}

// ===== СОРТИРОВКА ЗАЯВОК =====
function sortRepairsByStatus(repairs) {
    console.log('Сортируем заявки по статусу...');
    
    return repairs.sort((a, b) => {
        // Проверяем статус "в ремонте"
        const aInRepair = isRepairInProgress(a.status);
        const bInRepair = isRepairInProgress(b.status);
        
        // Сначала заявки "в ремонте", потом остальные
        if (aInRepair && !bInRepair) return -1;
        if (!aInRepair && bInRepair) return 1;
        
        // Для одинаковых статусов сортируем по дате (новые сверху)
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
    });
}

function isRepairInProgress(status) {
    if (!status) return false;
    
    const statusLower = status.toLowerCase();
    return statusLower.includes('в ремонте') || 
           statusLower.includes('в работе') || 
           statusLower.includes('ремонт') ||
           statusLower.includes('ремонтируется') ||
           statusLower.includes('выполняется');
}

// ===== ОТОБРАЖЕНИЕ ТАБЛИЦЫ =====
function renderRepairsTable() {
    const tbody = document.getElementById('repairTableBody');
    if (!tbody) {
        console.error('Не найден элемент repairTableBody');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (repairsList.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="14" style="text-align: center; padding: 40px; color: #666;">
                    📭 Нет заявок на ремонт
                </td>
            </tr>
        `;
        updateStats();
        return;
    }
    
    // Счетчик для анимации
    let rowIndex = 0;
    
    repairsList.forEach((repair) => {
        const row = createRepairRow(repair, rowIndex++);
        tbody.appendChild(row);
    });
    
    updateStats();
}

function createRepairRow(repair, index) {
    const row = document.createElement('tr');
    
    // Проверяем статус "в ремонте"
    const isInRepair = isRepairInProgress(repair.status);
    
    // Добавляем класс для выделения цветом
    if (isInRepair) {
        row.className = 'repair-in-progress';
    }
    
    // Форматируем даты
    const startDate = repair.date ? formatDateTime(repair.date) : '-';
    const endDate = repair.endDate ? formatDateTime(repair.endDate) : '-';
    
    // Рассчитываем время простоя
    const downtime = calculateDowntime(repair.date, repair.endDate, repair.status);
    
    // Добавляем значок 🔧 для заявок в ремонте
    const statusWithIcon = isInRepair ? `🔧 ${repair.status}` : repair.status;
    
    row.innerHTML = `
        <td>${startDate}</td>
        <td>${repair.author || '-'}</td>
        <td>${repair.location || '-'}</td>
        <td>${repair.invNumber || '-'}</td>
        <td>${repair.equipmentName || '-'}</td>
        <td>${repair.model || '-'}</td>
        <td>${repair.machineNumber || '-'}</td>
        <td>${repair.faultDescription || '-'}</td>
        <td>${endDate}</td>
        <td class="${isInRepair ? 'status-pending' : 'status-completed'}">
            ${statusWithIcon || '-'}
        </td>
        <td style="text-align: center;">${repair.downtimeCount || '0'}</td>
        <td style="text-align: center;">${downtime}</td>
        <td>${repair.productionItem || '-'}</td>
        <td>
            <div class="actions-cell">
                <button onclick="completeRepair('${repair.id}')" class="btn-complete" 
                        ${isInRepair ? '' : 'disabled'}>
                    ${isInRepair ? '✅ Завершить' : 'Завершено'}
                </button>
                <button onclick="deleteRepair('${repair.id}')" class="btn-delete">
                    🗑️ Удалить
                </button>
            </div>
        </td>
    `;
    
    // Анимация появления
    row.style.opacity = '0';
    row.style.transform = 'translateY(10px)';
    setTimeout(() => {
        row.style.transition = 'all 0.3s ease';
        row.style.opacity = '1';
        row.style.transform = 'translateY(0)';
    }, index * 50);
    
    return row;
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        
        return date.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return '-';
    }
}

function calculateDowntime(startDate, endDate, status) {
    if (!startDate) return '0 ч';
    
    try {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) return '0 ч';
        
        let end = new Date();
        if (endDate) {
            end = new Date(endDate);
            if (isNaN(end.getTime())) end = new Date();
        }
        
        // Если ремонт завершен, используем дату завершения
        if (status && status.toLowerCase().includes('завершен') && endDate) {
            end = new Date(endDate);
        }
        
        const diffMs = end - start;
        if (diffMs < 0) return '0 ч';
        
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        return `${diffHours} ч`;
    } catch (e) {
        return '0 ч';
    }
}

// ===== СТАТИСТИКА =====
function updateStats() {
    const totalRequests = document.getElementById('totalRequests');
    const pendingRequests = document.getElementById('pendingRequests');
    const completedRequests = document.getElementById('completedRequests');
    const totalDowntime = document.getElementById('totalDowntime');
    
    if (!totalRequests || !pendingRequests || !completedRequests || !totalDowntime) return;
    
    // Рассчитываем статистику
    const total = repairsList.length;
    const pending = repairsList.filter(repair => isRepairInProgress(repair.status)).length;
    const completed = total - pending;
    
    // Рассчитываем общее время простоя
    let totalHours = 0;
    repairsList.forEach(repair => {
        if (repair.status && repair.status.toLowerCase().includes('завершен') && repair.endDate && repair.date) {
            try {
                const start = new Date(repair.date);
                const end = new Date(repair.endDate);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    totalHours += Math.max(0, Math.floor((end - start) / (1000 * 60 * 60)));
                }
            } catch (e) {
                // Игнорируем ошибки парсинга дат
            }
        }
    });
    
    totalRequests.textContent = total;
    pendingRequests.textContent = pending;
    completedRequests.textContent = completed;
    totalDowntime.textContent = `${totalHours} ч`;
}

// ===== РЕАЛЬНОЕ ВРЕМЯ ОБНОВЛЕНИЙ =====
function setupRealtimeUpdates() {
    if (!isFirebaseReady || !db || unsubscribeRepairs) return;
    
    console.log('Настраиваем подписку на обновления Firestore в реальном времени');
    
    unsubscribeRepairs = db.collection('repairs')
        .orderBy('date', 'desc')
        .onSnapshot(snapshot => {
            repairsList = [];
            snapshot.forEach(doc => {
                repairsList.push({ id: doc.id, ...doc.data() });
            });
            
            console.log('Получены изменения из Firestore:', repairsList.length, 'изменений');
            
            // Сортируем заявки
            repairsList = sortRepairsByStatus(repairsList);
            renderRepairsTable();
            
            // Сохраняем локально
            saveLocalData();
        }, error => {
            console.error('Ошибка подписки Firestore:', error);
        });
    
    console.log('Подписка на обновления Firestore настроена');
}

// ===== УПРАВЛЕНИЕ ЗАЯВКАМИ =====
async function completeRepair(id) {
    if (!confirm('Завершить ремонт?')) return;
    
    const repair = repairsList.find(r => r.id === id);
    if (!repair) return;
    
    try {
        const updateData = {
            status: 'Завершен',
            endDate: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        if (isFirebaseReady && db) {
            await db.collection('repairs').doc(id).update(updateData);
            console.log('Ремонт завершен в Firestore:', id);
        } else {
            const index = repairsList.findIndex(r => r.id === id);
            if (index !== -1) {
                repairsList[index] = { ...repairsList[index], ...updateData };
                // Сортируем заново
                repairsList = sortRepairsByStatus(repairsList);
                saveLocalData();
            }
        }
        
        showNotification('Ремонт завершен!', 'success');
        
    } catch (error) {
        console.error('Ошибка завершения ремонта:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

async function deleteRepair(id) {
    if (!confirm('Удалить заявку?')) return;
    
    try {
        if (isFirebaseReady && db) {
            await db.collection('repairs').doc(id).delete();
            console.log('Заявка удалена из Firestore:', id);
        } else {
            repairsList = repairsList.filter(r => r.id !== id);
            saveLocalData();
        }
        
        showNotification('Заявка удалена', 'success');
        
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// ===== СОХРАНЕНИЕ ЛОКАЛЬНЫХ ДАННЫХ =====
function saveLocalData() {
    try {
        localStorage.setItem('repair_journal_data', JSON.stringify(repairsList));
    } catch (error) {
        console.error('Ошибка сохранения локальных данных:', error);
    }
}

async function syncLocalData() {
    console.log('Начинаем синхронизацию локальных данных...');
    
    if (!isFirebaseReady || !db) {
        console.log('Firebase не готов, пропускаем синхронизацию');
        return;
    }
    
    const localRepairs = loadLocalRepairs();
    if (localRepairs.length === 0) {
        console.log('Нет данных для синхронизации');
        return;
    }
    
    try {
        for (const repair of localRepairs) {
            if (!repair.id || repair.id.startsWith('local_')) {
                await db.collection('repairs').add({
                    ...repair,
                    synced: true,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log('Заявка синхронизирована:', repair.id);
            }
        }
        
        // Очищаем локальное хранилище
        localStorage.removeItem('repair_journal_data');
        console.log('Локальные данные синхронизированы с Firestore');
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
    }
}

// ===== ИНИЦИАЛИЗАЦИЯ ФОРМЫ =====
function initInvNumberSelect() {
    const invNumberSearch = document.getElementById('invNumberSearch');
    const invNumberSelect = document.getElementById('invNumber');
    
    if (!invNumberSearch || !invNumberSelect) return;
    
    // Очищаем селект
    invNumberSelect.innerHTML = '<option value="">Выберите инвентарный номер</option>';
    
    // Заполняем селект
    equipmentList.forEach(equip => {
        const option = document.createElement('option');
        option.value = equip.invNumber || '';
        option.textContent = `${equip.invNumber || ''} - ${equip.name} (${equip.location})`;
        option.dataset.equipmentName = equip.name;
        option.dataset.location = equip.location;
        option.dataset.model = equip.model;
        invNumberSelect.appendChild(option);
    });
    
    // Поиск при вводе
    invNumberSearch.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const options = invNumberSelect.options;
        
        for (let i = 0; i < options.length; i++) {
            const option = options[i];
            const text = option.textContent.toLowerCase();
            option.style.display = text.includes(searchTerm) ? '' : 'none';
        }
    });
    
    // Автозаполнение полей при выборе
    invNumberSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        
        if (selectedOption.value) {
            document.getElementById('equipmentName').value = selectedOption.dataset.equipmentName || '';
            document.getElementById('location').value = selectedOption.dataset.location || '';
            document.getElementById('model').value = selectedOption.dataset.model || '';
        } else {
            document.getElementById('equipmentName').value = '';
            document.getElementById('location').value = '';
            document.getElementById('model').value = '';
        }
    });
}

// ===== ОБРАБОТКА ФОРМЫ =====
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('repairForm');
    if (form) {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveRepair();
        });
    }
    
    // Кнопка очистки формы
    const clearBtn = document.getElementById('clearBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            document.getElementById('repairForm').reset();
            document.getElementById('equipmentName').value = '';
            document.getElementById('location').value = '';
            document.getElementById('model').value = '';
        });
    }
});

async function saveRepair() {
    const form = document.getElementById('repairForm');
    if (!form) return;
    
    const formData = {
        date: document.getElementById('date').value + 'T' + document.getElementById('time').value,
        author: document.getElementById('author').value,
        location: document.getElementById('location').value,
        invNumber: document.getElementById('invNumber').value,
        equipmentName: document.getElementById('equipmentName').value,
        model: document.getElementById('model').value,
        machineNumber: document.getElementById('machineNumber').value,
        faultDescription: document.getElementById('faultDescription').value,
        productionItem: document.getElementById('productionItem').value,
        status: 'В ремонте',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_id: user?.id || 'anonymous'
    };
    
    // Валидация
    if (!formData.date || !formData.author || !formData.faultDescription || !formData.invNumber) {
        showNotification('Заполните обязательные поля!', 'error');
        return;
    }
    
    try {
        let repairId;
        
        if (isFirebaseReady && db) {
            const docRef = await db.collection('repairs').add(formData);
            repairId = docRef.id;
            console.log('Заявка сохранена в Firestore:', repairId);
        } else {
            repairId = 'local_' + Date.now();
            formData.id = repairId;
            repairsList.push(formData);
            // Сортируем заново
            repairsList = sortRepairsByStatus(repairsList);
            saveLocalData();
            console.log('Заявка сохранена локально:', repairId);
        }
        
        // Очистка формы
        form.reset();
        document.getElementById('equipmentName').value = '';
        document.getElementById('location').value = '';
        document.getElementById('model').value = '';
        
        // Установка текущей даты и времени
        const today = new Date();
        document.getElementById('date').value = today.toISOString().split('T')[0];
        document.getElementById('time').value = today.toTimeString().split(' ')[0].substring(0, 5);
        
        showNotification('Заявка создана!', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения заявки:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function showNotification(message, type) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function updateEquipmentDB() {
    showNotification('База оборудования обновлена!', 'success');
}

function exportRepairData() {
    if (repairsList.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    // Простая экспортная функция
    const dataStr = JSON.stringify(repairsList, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `заявки_ремонт_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('Данные экспортированы!', 'success');
}

function showDashboard() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'block';
        
        // Обновляем содержимое дашборда
        const dashboardContent = document.getElementById('dashboardContent');
        if (dashboardContent) {
            const pending = repairsList.filter(r => isRepairInProgress(r.status)).length;
            const completed = repairsList.length - pending;
            
            // Группировка по статусам
            const statusStats = {};
            repairsList.forEach(repair => {
                const status = repair.status || 'Без статуса';
                statusStats[status] = (statusStats[status] || 0) + 1;
            });
            
            let statusHtml = '';
            for (const [status, count] of Object.entries(statusStats)) {
                const isInRepair = isRepairInProgress(status);
                statusHtml += `
                    <div style="margin: 10px 0; padding: 8px; background: ${isInRepair ? '#fff3cd' : '#f5f5f5'}; border-radius: 4px;">
                        ${status}: ${count} заявок
                    </div>
                `;
            }
            
            dashboardContent.innerHTML = `
                <h3>Статистика ремонтов</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin: 20px 0;">
                    <div style="background: #f0f8ff; padding: 15px; border-radius: 8px;">
                        <h4>📊 Общая статистика</h4>
                        <p>Всего заявок: ${repairsList.length}</p>
                        <p>В ремонте: ${pending}</p>
                        <p>Завершено: ${completed}</p>
                    </div>
                    <div style="background: #f0fff0; padding: 15px; border-radius: 8px;">
                        <h4>📈 Распределение по статусам</h4>
                        ${statusHtml}
                    </div>
                </div>
                <button onclick="closeDashboard()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Закрыть
                </button>
            `;
        }
    }
}

function closeDashboard() {
    const modal = document.getElementById('dashboardModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function syncAllData() {
    showNotification('Синхронизация данных...', 'info');
    loadData();
}

// ===== НАСТРОЙКА UI =====
function setupUI() {
    // Установка текущей даты по умолчанию
    const today = new Date();
    const dateInput = document.getElementById('date');
    if (dateInput) {
        dateInput.value = today.toISOString().split('T')[0];
    }
    
    // Установка текущего времени
    const timeInput = document.getElementById('time');
    if (timeInput) {
        const timeString = today.toTimeString().split(' ')[0].substring(0, 5);
        timeInput.value = timeString;
    }
    
    // Установка автора из данных пользователя
    const authorInput = document.getElementById('author');
    if (authorInput && user) {
        authorInput.value = user.name;
        authorInput.readOnly = true;
    }
    
    // Инициализация фильтров
    initFilters();
    
    console.log('UI настроен');
}

function initFilters() {
    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const locationFilter = document.getElementById('locationFilter');
    const monthFilter = document.getElementById('monthFilter');
    
    if (searchInput) {
        searchInput.addEventListener('input', filterTable);
    }
    
    if (statusFilter) {
        statusFilter.addEventListener('change', filterTable);
    }
    
    if (locationFilter) {
        // Заполняем фильтр участков
        const locations = [...new Set(equipmentList.map(e => e.location))];
        locations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
        locationFilter.addEventListener('change', filterTable);
    }
    
    if (monthFilter) {
        monthFilter.addEventListener('change', filterTable);
    }
}

function filterTable() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('statusFilter')?.value;
    const locationFilter = document.getElementById('locationFilter')?.value;
    const monthFilter = document.getElementById('monthFilter')?.value;
    
    let filtered = repairsList;
    
    // Поиск по тексту
    if (searchTerm) {
        filtered = filtered.filter(repair => 
            (repair.equipmentName && repair.equipmentName.toLowerCase().includes(searchTerm)) ||
            (repair.faultDescription && repair.faultDescription.toLowerCase().includes(searchTerm)) ||
            (repair.author && repair.author.toLowerCase().includes(searchTerm)) ||
            (repair.invNumber && repair.invNumber.toLowerCase().includes(searchTerm))
        );
    }
    
    // Фильтр по статусу
    if (statusFilter === 'pending') {
        filtered = filtered.filter(repair => isRepairInProgress(repair.status));
    } else if (statusFilter === 'completed') {
        filtered = filtered.filter(repair => !isRepairInProgress(repair.status));
    }
    
    // Фильтр по участку
    if (locationFilter && locationFilter !== 'all') {
        filtered = filtered.filter(repair => repair.location === locationFilter);
    }
    
    // Фильтр по месяцу
    if (monthFilter) {
        const [year, month] = monthFilter.split('-');
        filtered = filtered.filter(repair => {
            if (!repair.date) return false;
            const repairDate = new Date(repair.date);
            return repairDate.getFullYear() === parseInt(year) && 
                   (repairDate.getMonth() + 1) === parseInt(month);
        });
    }
    
    // Рендерим отфильтрованную таблицу
    const tbody = document.getElementById('repairTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        
        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="14" style="text-align: center; padding: 40px; color: #666;">
                        📭 Нет заявок, соответствующих фильтру
                    </td>
                </tr>
            `;
            return;
        }
        
        // Сохраняем сортировку
        filtered = sortRepairsByStatus(filtered);
        
        filtered.forEach((repair, index) => {
            const row = createRepairRow(repair, index);
            tbody.appendChild(row);
        });
    }
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', initApp);

// Экспорт функций в глобальную область видимости
window.completeRepair = completeRepair;
window.deleteRepair = deleteRepair;
window.updateEquipmentDB = updateEquipmentDB;
window.exportRepairData = exportRepairData;
window.showDashboard = showDashboard;
window.closeDashboard = closeDashboard;
window.syncAllData = syncAllData;
window.logout = function() {
    localStorage.removeItem('repair_journal_isAuthenticated');
    localStorage.removeItem('repair_journal_currentUser');
    localStorage.removeItem('repair_journal_data');
    window.location.href = 'login.html';
};
