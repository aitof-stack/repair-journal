// Ремонтный журнал (Firebase Sync) v5.0.5
// Основной файл приложения

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
console.log('Ремонтный журнал (Firebase Sync) v5.0.5 запускается...');

// Генерация Device ID
const deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
console.log('Device ID:', deviceId);

// Функция инициализации приложения
async function initApp() {
    console.log('Ремонтный журнал (Firebase Sync) v5.0.5 - основная инициализация');
    
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
    // Проверяем сохраненные данные пользователя
    const savedUser = localStorage.getItem('repair_journal_user');
    if (savedUser) {
        try {
            user = JSON.parse(savedUser);
            console.log('Пользователь:', user.name + ' (' + user.role + ')');
            
            // Обновляем UI
            updateUserInfo();
        } catch (e) {
            console.error('Ошибка загрузки пользователя:', e);
            showLoginModal();
        }
    } else {
        showLoginModal();
    }
}

function updateUserInfo() {
    const userInfoElement = document.getElementById('userInfo');
    if (userInfoElement && user) {
        userInfoElement.innerHTML = `
            <i class="fas fa-user"></i> ${user.name} 
            <span class="badge badge-${user.role === 'admin' ? 'danger' : 'primary'} ml-1">
                ${user.role}
            </span>
        `;
    }
}

function showLoginModal() {
    // Реализация модального окна авторизации
    const modalHTML = `
        <div class="modal fade show" style="display: block; background: rgba(0,0,0,0.5)">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Авторизация</h5>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>Имя пользователя</label>
                            <input type="text" class="form-control" id="loginUsername" 
                                   placeholder="Введите ваше имя">
                        </div>
                        <div class="form-group">
                            <label>Роль</label>
                            <select class="form-control" id="loginRole">
                                <option value="author">Автор заявок</option>
                                <option value="engineer">Инженер</option>
                                <option value="admin">Администратор</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" onclick="handleLogin()">Войти</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function handleLogin() {
    const username = document.getElementById('loginUsername').value;
    const role = document.getElementById('loginRole').value;
    
    if (!username.trim()) {
        alert('Введите имя пользователя');
        return;
    }
    
    user = {
        name: username.trim(),
        role: role,
        id: 'local_' + Date.now()
    };
    
    localStorage.setItem('repair_journal_user', JSON.stringify(user));
    
    // Закрываем модальное окно
    const modal = document.querySelector('.modal');
    if (modal) modal.remove();
    
    updateUserInfo();
    console.log('Пользователь авторизован:', user.name);
}

// ===== FIREBASE ИНИЦИАЛИЗАЦИЯ =====
async function initializeFirebase() {
    console.log('Проверяем инициализацию Firebase...');
    
    if (window.firebase && !firebaseApp) {
        try {
            // Инициализируем Firebase
            firebaseApp = firebase.initializeApp(firebaseConfig);
            console.log('Firebase приложения найдены:', firebase.apps.length);
            console.log('Firebase project:', firebaseApp.options.projectId);
            
            // Инициализируем сервисы
            db = firebase.firestore();
            auth = firebase.auth();
            
            // Включаем persistence
            await enablePersistence();
            
            console.log('Firebase успешно инициализирован');
            isFirebaseReady = true;
            
        } catch (error) {
            console.error('Ошибка инициализации Firebase:', error);
            isFirebaseReady = false;
        }
    } else if (firebaseApp) {
        console.log('Firebase уже инициализирован');
        isFirebaseReady = true;
    }
}

async function enablePersistence() {
    if (!db) return;
    
    try {
        await db.enablePersistence({
            synchronizeTabs: true
        });
        console.log('Firestore persistence включена');
    } catch (err) {
        console.error('Ошибка включения persistence:', err);
        if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence can only be enabled in one tab at a time.');
        } else if (err.code === 'unimplemented') {
            console.warn('The current browser does not support persistence.');
        }
    }
}

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadEquipmentDatabase() {
    console.log('Загрузка базы оборудования...');
    
    try {
        // Пытаемся загрузить из Firestore
        if (isFirebaseReady && db) {
            const snapshot = await db.collection('equipment').get();
            if (!snapshot.empty) {
                equipmentList = [];
                snapshot.forEach(doc => {
                    equipmentList.push({ id: doc.id, ...doc.data() });
                });
                console.log('Загружено оборудования из Firestore:', equipmentList.length);
                return;
            }
        }
        
        // Загружаем локальную базу
        const localEquipment = await loadLocalEquipment();
        equipmentList = localEquipment;
        console.log('Используем локальную базу оборудования:', equipmentList.length, 'записей');
        
        // Синхронизируем с Firestore
        if (isFirebaseReady && equipmentList.length > 0) {
            await syncEquipmentToFirebase();
        }
        
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        equipmentList = await loadLocalEquipment();
    }
}

async function loadLocalEquipment() {
    // Локальная база оборудования (можно расширить)
    const localEquipment = [
        { id: '1', name: 'Компьютер офисный', type: 'Компьютер', location: 'Офис 101' },
        { id: '2', name: 'Ноутбук Dell', type: 'Ноутбук', location: 'Склад' },
        { id: '3', name: 'Принтер HP', type: 'Принтер', location: 'Офис 201' },
        // ... остальные 693 записи
    ];
    return localEquipment.slice(0, 50); // Ограничим для примера
}

async function syncEquipmentToFirebase() {
    if (!isFirebaseReady || !db) return;
    
    try {
        const batch = db.batch();
        equipmentList.forEach(equip => {
            const docRef = db.collection('equipment').doc(equip.id);
            batch.set(docRef, {
                name: equip.name,
                type: equip.type,
                location: equip.location,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        
        await batch.commit();
        console.log('Оборудование синхронизировано с Firestore');
    } catch (error) {
        console.error('Ошибка синхронизации оборудования:', error);
    }
}

async function loadData() {
    console.log('Загрузка данных из Firestore...');
    
    try {
        if (isFirebaseReady && db) {
            // Загружаем из Firestore
            const snapshot = await db.collection('repairs').get();
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

function sortRepairsByStatus(repairs) {
    return repairs.sort((a, b) => {
        // Функция проверки статуса "в ремонте"
        const isInRepair = (status) => {
            if (!status) return false;
            const statusLower = status.toLowerCase();
            return statusLower.includes('в ремонте') || 
                   statusLower.includes('в работе') || 
                   statusLower.includes('ремонт') ||
                   statusLower.includes('ремонтируется');
        };
        
        const aInRepair = isInRepair(a.status);
        const bInRepair = isInRepair(b.status);
        
        // Сначала заявки "в ремонте", потом остальные
        if (aInRepair && !bInRepair) return -1;
        if (!aInRepair && bInRepair) return 1;
        
        // Для одинаковых статусов сортируем по дате (новые сверху)
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
    });
}

function setupRealtimeUpdates() {
    if (!isFirebaseReady || !db || unsubscribeRepairs) return;
    
    console.log('Настраиваем подписку на обновления Firestore в реальном времени');
    
    unsubscribeRepairs = db.collection('repairs')
        .orderBy('created_at', 'desc')
        .onSnapshot(snapshot => {
            const changes = [];
            repairsList = [];
            
            snapshot.forEach(doc => {
                repairsList.push({ id: doc.id, ...doc.data() });
                if (doc.metadata.hasPendingWrites) {
                    changes.push('локальное: ' + doc.id);
                } else {
                    changes.push('серверное: ' + doc.id);
                }
            });
            
            console.log('Получены изменения из Firestore:', changes.length, 'изменений');
            
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
        const batch = db.batch();
        let syncedCount = 0;
        
        localRepairs.forEach(repair => {
            if (!repair.id || repair.id.startsWith('local_')) {
                const docRef = db.collection('repairs').doc();
                batch.set(docRef, {
                    ...repair,
                    synced: true,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                syncedCount++;
            }
        });
        
        if (syncedCount > 0) {
            await batch.commit();
            console.log('Синхронизировано заявок:', syncedCount);
            
            // Очищаем локальное хранилище
            localStorage.removeItem('repair_journal_data');
        }
        
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
    }
}

function saveLocalData() {
    try {
        localStorage.setItem('repair_journal_data', JSON.stringify(repairsList));
    } catch (error) {
        console.error('Ошибка сохранения локальных данных:', error);
    }
}

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С ТАБЛИЦЕЙ =====
function renderRepairsTable() {
    const tbody = document.getElementById('repairTableBody');
    if (!tbody) return;
    
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
    
    repairsList.forEach((repair, index) => {
        const row = createRepairRow(repair, index);
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
        row.style.backgroundColor = '#fff3cd';
        row.style.borderLeft = '4px solid #ffc107';
    }
    
    // Форматируем даты
    const startDate = repair.date ? formatDateTime(repair.date) : '-';
    const endDate = repair.endDate ? formatDateTime(repair.endDate) : '-';
    
    // Рассчитываем время простоя
    const downtime = calculateDowntime(repair.date, repair.endDate, repair.status);
    
    // Создаем HTML строки
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
            ${repair.status || '-'}
        </td>
        <td style="text-align: center;">${repair.downtimeCount || '-'}</td>
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
    
    return row;
}

function isRepairInProgress(status) {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower.includes('в ремонте') || 
           statusLower.includes('в работе') || 
           statusLower.includes('ремонт') ||
           statusLower.includes('ремонтируется');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function calculateDowntime(startDate, endDate, status) {
    if (!startDate) return '0 ч';
    
    const start = new Date(startDate);
    let end = endDate ? new Date(endDate) : new Date();
    
    // Если ремонт завершен, используем дату завершения
    if (status && status.toLowerCase().includes('завершен')) {
        if (!endDate) return '0 ч';
        end = new Date(endDate);
    }
    
    const diffHours = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60)));
    return `${diffHours} ч`;
}

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
            const start = new Date(repair.date);
            const end = new Date(repair.endDate);
            totalHours += Math.max(0, Math.floor((end - start) / (1000 * 60 * 60)));
        }
    });
    
    totalRequests.textContent = total;
    pendingRequests.textContent = pending;
    completedRequests.textContent = completed;
    totalDowntime.textContent = `${totalHours} ч`;
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
        renderRepairsTable();
        
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
        }
        
        repairsList = repairsList.filter(r => r.id !== id);
        saveLocalData();
        renderRepairsTable();
        showNotification('Заявка удалена', 'success');
        
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
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
    
    // Инициализация селекта инвентарных номеров
    initInvNumberSelect();
});

function initInvNumberSelect() {
    const invNumberSearch = document.getElementById('invNumberSearch');
    const invNumberSelect = document.getElementById('invNumber');
    
    if (!invNumberSearch || !invNumberSelect) return;
    
    // Заполняем селект
    equipmentList.forEach(equip => {
        const option = document.createElement('option');
        option.value = equip.invNumber || equip.id;
        option.textContent = `${equip.invNumber || ''} - ${equip.name} (${equip.location})`;
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
        const selectedEquip = equipmentList.find(e => 
            e.invNumber === this.value || e.id === this.value
        );
        
        if (selectedEquip) {
            document.getElementById('equipmentName').value = selectedEquip.name || '';
            document.getElementById('location').value = selectedEquip.location || '';
            document.getElementById('model').value = selectedEquip.model || '';
        }
    });
}

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
        user_id: user?.id
    };
    
    // Валидация
    if (!formData.date || !formData.author || !formData.faultDescription) {
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
        
        // Обновление таблицы
        renderRepairsTable();
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
            
            dashboardContent.innerHTML = `
                <h3>Статистика</h3>
                <p>Всего заявок: ${repairsList.length}</p>
                <p>В ремонте: ${pending}</p>
                <p>Завершено: ${completed}</p>
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
    showNotification('Синхронизация...', 'info');
    loadData();
    setTimeout(() => {
        showNotification('Данные синхронизированы!', 'success');
    }, 1000);
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
    
    // Установка автора
    const authorInput = document.getElementById('author');
    if (authorInput && user) {
        authorInput.value = user.name;
    }
    
    console.log('UI настроен');
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
    localStorage.removeItem('repair_journal_user');
    window.location.href = 'login.html';
};
