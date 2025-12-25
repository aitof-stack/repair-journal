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
        
        // Рендерим таблицу
        renderRepairsTable(repairsList);
        
        // Синхронизируем локальные данные
        await syncLocalData();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        repairsList = loadLocalRepairs();
        renderRepairsTable(repairsList);
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
            renderRepairsTable(repairsList);
            
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

// Функция рендеринга таблицы с сортировкой
function renderRepairsTable(repairs) {
    console.log('Рендеринг таблицы с', repairs?.length || 0, 'заявками');
    
    if (!Array.isArray(repairs)) {
        console.error('repairs не является массивом:', repairs);
        return;
    }
    
    // Сортируем заявки
    const sortedRepairs = sortRepairs(repairs);
    
    const tbody = document.getElementById('repairsTableBody');
    if (!tbody) {
        console.error('Не найден элемент repairsTableBody');
        return;
    }
    
    tbody.innerHTML = '';
    
    if (sortedRepairs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i><br>
                    📭 Нет заявок на ремонт
                    <br>
                    <small class="text-muted">Создайте первую заявку</small>
                </td>
            </tr>
        `;
        updateStatsPanel([]);
        return;
    }
    
    // Рендерим каждую заявку
    sortedRepairs.forEach((repair, index) => {
        const row = createRepairRow(repair, index);
        tbody.appendChild(row);
    });
    
    // Обновляем статистику
    updateStatsPanel(sortedRepairs);
    
    // Обновляем счетчик в заголовке
    updateTableCounter(sortedRepairs);
}

// Функция сортировки заявок
function sortRepairs(repairs) {
    return [...repairs].sort((a, b) => {
        // Приоритет 1: статус "в ремонте" или "в работе"
        const aInRepair = isInRepairStatus(a.status);
        const bInRepair = isInRepairStatus(b.status);
        
        if (aInRepair && !bInRepair) return -1;
        if (!aInRepair && bInRepair) return 1;
        
        // Приоритет 2: дата (новые сверху)
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
        
        // Приоритет 3: ID (для одинаковых дат)
        if (dateA.getTime() === dateB.getTime()) {
            return (b.id || '').localeCompare(a.id || '');
        }
    });
}

// Проверка статуса "в ремонте"
function isInRepairStatus(status) {
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower.includes('ремонт') || 
           statusLower.includes('в работе') || 
           statusLower.includes('выполняется') ||
           statusLower.includes('в процессе');
}

// Создание строки таблицы
function createRepairRow(repair, index) {
    const row = document.createElement('tr');
    
    // Проверяем статус
    const isInRepair = isInRepairStatus(repair.status);
    
    // Добавляем класс для строки в ремонте
    if (isInRepair) {
        row.className = 'repair-in-progress';
    }
    
    // Форматируем дату
    const repairDate = repair.date ? new Date(repair.date) : new Date();
    const formattedDate = formatDate(repairDate);
    
    // Получаем класс статуса
    const statusClass = getStatusClass(repair.status);
    
    row.innerHTML = `
        <td class="align-middle">
            <div class="equipment-info">
                <strong>${repair.equipment || 'Не указано'}</strong>
                ${isInRepair ? ' <span class="repair-icon">🔧</span>' : ''}
                ${repair.location ? `<br><small class="text-muted">${repair.location}</small>` : ''}
            </div>
        </td>
        <td class="align-middle">
            <div class="problem-text">
                ${repair.problem || 'Не указана'}
                ${repair.description ? `<br><small class="text-muted">${repair.description.substring(0, 50)}...</small>` : ''}
            </div>
        </td>
        <td class="align-middle">
            <span class="date-text" title="${repairDate.toLocaleString('ru-RU')}">
                ${formattedDate}
            </span>
        </td>
        <td class="align-middle status-cell">
            <span class="status-badge ${statusClass}">
                ${repair.status || 'Не указан'}
                ${isInRepair ? ' ⚡' : ''}
            </span>
        </td>
        <td class="align-middle">
            <div class="author-info">
                <strong>${repair.author || 'Не указан'}</strong>
                ${repair.assigned_to ? `<br><small>Исполнитель: ${repair.assigned_to}</small>` : ''}
            </div>
        </td>
        <td class="align-middle">
            <div class="btn-group" role="group">
                <button onclick="editRepair('${repair.id}')" class="btn-edit" title="Редактировать">
                    <i class="fas fa-edit"></i>
                </button>
                <button onclick="changeStatus('${repair.id}')" class="btn-status" title="Изменить статус">
                    <i class="fas fa-sync-alt"></i>
                </button>
                <button onclick="deleteRepair('${repair.id}')" class="btn-delete" title="Удалить">
                    <i class="fas fa-trash"></i>
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
    }, index * 30);
    
    return row;
}

// Форматирование даты
function formatDate(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return 'Сегодня, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
        return 'Вчера, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays < 7) {
        const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
        return `${date.getDate()} ${date.toLocaleDateString('ru-RU', { month: 'short' })} (${days[date.getDay()]})`;
    }
    
    return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Получение класса для статуса
function getStatusClass(status) {
    if (!status) return '';
    
    const statusLower = status.toLowerCase();
    if (isInRepairStatus(status)) return 'status-in-repair';
    if (statusLower.includes('нов')) return 'status-new';
    if (statusLower.includes('заверш') || statusLower.includes('готов') || statusLower.includes('выполнен')) return 'status-completed';
    if (statusLower.includes('отмен') || statusLower.includes('отказ')) return 'status-cancelled';
    if (statusLower.includes('ожидан') || statusLower.includes('приостанов') || statusLower.includes('пауза')) return 'status-on-hold';
    if (statusLower.includes('планир')) return 'status-planned';
    
    return '';
}

// Обновление панели статистики
function updateStatsPanel(repairs) {
    const statsPanel = document.getElementById('statsPanel');
    if (!statsPanel) return;
    
    const total = repairs.length;
    const inRepair = repairs.filter(r => isInRepairStatus(r.status)).length;
    const completed = repairs.filter(r => 
        getStatusClass(r.status) === 'status-completed'
    ).length;
    const newRepairs = repairs.filter(r => 
        getStatusClass(r.status) === 'status-new'
    ).length;
    
    statsPanel.innerHTML = `
        <div class="stat-item stat-total">
            <div class="stat-value">${total}</div>
            <div class="stat-label">Всего заявок</div>
        </div>
        <div class="stat-item stat-in-repair">
            <div class="stat-value">${inRepair}</div>
            <div class="stat-label">В ремонте</div>
        </div>
        <div class="stat-item stat-completed">
            <div class="stat-value">${completed}</div>
            <div class="stat-label">Завершено</div>
        </div>
        <div class="stat-item stat-new">
            <div class="stat-value">${newRepairs}</div>
            <div class="stat-label">Новых</div>
        </div>
    `;
}

// Обновление счетчика в заголовке
function updateTableCounter(repairs) {
    const counterElement = document.getElementById('tableCounter');
    if (counterElement) {
        const inRepairCount = repairs.filter(r => isInRepairStatus(r.status)).length;
        const totalCount = repairs.length;
        counterElement.innerHTML = `
            <span class="badge badge-light">
                <i class="fas fa-list"></i> Всего: ${totalCount}
            </span>
            <span class="badge badge-warning ml-1">
                <i class="fas fa-tools"></i> В ремонте: ${inRepairCount}
            </span>
        `;
    }
}

// Функция фильтрации таблицы
function filterTable() {
    const showOnlyInRepair = document.getElementById('showOnlyInRepair')?.checked || false;
    const statusFilter = document.getElementById('statusFilter')?.value.toLowerCase() || '';
    const equipmentFilter = document.getElementById('equipmentFilter')?.value.toLowerCase() || '';
    
    let repairs = getAllRepairs();
    
    // Применяем фильтры
    if (showOnlyInRepair) {
        repairs = repairs.filter(repair => isInRepairStatus(repair.status));
    }
    
    if (statusFilter) {
        repairs = repairs.filter(repair => 
            repair.status && repair.status.toLowerCase().includes(statusFilter)
        );
    }
    
    if (equipmentFilter) {
        repairs = repairs.filter(repair => 
            repair.equipment && repair.equipment.toLowerCase().includes(equipmentFilter)
        );
    }
    
    renderRepairsTable(repairs);
}

// Сброс фильтров
function resetFilters() {
    const checkbox = document.getElementById('showOnlyInRepair');
    const statusSelect = document.getElementById('statusFilter');
    const equipmentInput = document.getElementById('equipmentFilter');
    
    if (checkbox) checkbox.checked = false;
    if (statusSelect) statusSelect.value = '';
    if (equipmentInput) equipmentInput.value = '';
    
    const repairs = getAllRepairs();
    renderRepairsTable(repairs);
    showNotification('Фильтры сброшены', 'info');
}

// ===== УПРАВЛЕНИЕ ЗАЯВКАМИ =====
function getAllRepairs() {
    return repairsList || [];
}

function createNewRepair() {
    showRepairModal();
}

function showRepairModal(repairId = null) {
    const repair = repairId ? repairsList.find(r => r.id === repairId) : null;
    
    const modalHTML = `
        <div class="modal fade show" id="repairModal" style="display: block; background: rgba(0,0,0,0.5)">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${repair ? 'Редактирование заявки' : 'Новая заявка на ремонт'}</h5>
                        <button type="button" class="close" onclick="closeModal()">
                            <span>&times;</span>
                        </button>
                    </div>
                    <div class="modal-body">
                        <form id="repairForm">
                            <div class="form-group">
                                <label>Оборудование *</label>
                                <select class="form-control" id="equipmentSelect" required>
                                    <option value="">Выберите оборудование</option>
                                    ${equipmentList.map(eq => 
                                        `<option value="${eq.name}" ${repair?.equipment === eq.name ? 'selected' : ''}>
                                            ${eq.name} (${eq.type}, ${eq.location})
                                        </option>`
                                    ).join('')}
                                </select>
                            </div>
                            <div class="form-group">
                                <label>Неисправность *</label>
                                <textarea class="form-control" id="problemInput" rows="3" required 
                                          placeholder="Опишите проблему...">${repair?.problem || ''}</textarea>
                            </div>
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label>Статус</label>
                                        <select class="form-control" id="statusSelect">
                                            <option value="Новый" ${repair?.status === 'Новый' ? 'selected' : ''}>Новый</option>
                                            <option value="В работе" ${repair?.status === 'В работе' ? 'selected' : ''}>В работе</option>
                                            <option value="В ремонте" ${(repair?.status === 'В ремонте' || !repair) ? 'selected' : ''}>В ремонте</option>
                                            <option value="Завершен" ${repair?.status === 'Завершен' ? 'selected' : ''}>Завершен</option>
                                            <option value="Ожидание запчастей" ${repair?.status === 'Ожидание запчастей' ? 'selected' : ''}>Ожидание запчастей</option>
                                            <option value="Отменен" ${repair?.status === 'Отменен' ? 'selected' : ''}>Отменен</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="form-group">
                                        <label>Дата</label>
                                        <input type="datetime-local" class="form-control" id="dateInput" 
                                               value="${repair ? new Date(repair.date || new Date()).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)}">
                                    </div>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Дополнительное описание</label>
                                <textarea class="form-control" id="descriptionInput" rows="2" 
                                          placeholder="Дополнительная информация...">${repair?.description || ''}</textarea>
                            </div>
                            <div class="form-group">
                                <label>Исполнитель</label>
                                <input type="text" class="form-control" id="assignedToInput" 
                                       value="${repair?.assigned_to || ''}" placeholder="ФИО исполнителя">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="closeModal()">Отмена</button>
                        <button type="button" class="btn btn-primary" onclick="saveRepair('${repair?.id || ''}')">
                            ${repair ? 'Сохранить изменения' : 'Создать заявку'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function closeModal() {
    const modal = document.getElementById('repairModal');
    if (modal) modal.remove();
}

async function saveRepair(repairId = null) {
    const equipment = document.getElementById('equipmentSelect').value;
    const problem = document.getElementById('problemInput').value;
    const status = document.getElementById('statusSelect').value;
    const date = document.getElementById('dateInput').value;
    const description = document.getElementById('descriptionInput').value;
    const assigned_to = document.getElementById('assignedToInput').value;
    
    if (!equipment || !problem) {
        alert('Пожалуйста, заполните обязательные поля (Оборудование и Неисправность)');
        return;
    }
    
    const repairData = {
        equipment,
        problem,
        status,
        date: date ? new Date(date).toISOString() : new Date().toISOString(),
        description,
        assigned_to,
        author: user?.name || 'Неизвестный',
        user_id: user?.id,
        updated_at: new Date().toISOString()
    };
    
    if (!repairId) {
        repairData.created_at = new Date().toISOString();
    }
    
    try {
        if (isFirebaseReady && db) {
            if (repairId) {
                await db.collection('repairs').doc(repairId).update(repairData);
                console.log('Заявка обновлена в Firestore:', repairId);
            } else {
                const docRef = await db.collection('repairs').add({
                    ...repairData,
                    created_at: firebase.firestore.FieldValue.serverTimestamp()
                });
                repairId = docRef.id;
                console.log('Заявка создана в Firestore:', repairId);
            }
        } else {
            // Локальное сохранение
            if (repairId) {
                const index = repairsList.findIndex(r => r.id === repairId);
                if (index !== -1) {
                    repairsList[index] = { ...repairsList[index], ...repairData, id: repairId };
                }
            } else {
                repairId = 'local_' + Date.now();
                repairsList.push({ ...repairData, id: repairId });
            }
            saveLocalData();
            console.log('Заявка сохранена локально:', repairId);
        }
        
        closeModal();
        renderRepairsTable(getAllRepairs());
        showNotification(repairId ? 'Заявка обновлена' : 'Заявка создана', 'success');
        
    } catch (error) {
        console.error('Ошибка сохранения заявки:', error);
        showNotification('Ошибка сохранения: ' + error.message, 'danger');
    }
}

function editRepair(id) {
    showRepairModal(id);
}

async function changeStatus(id) {
    const repair = repairsList.find(r => r.id === id);
    if (!repair) return;
    
    const newStatus = prompt('Введите новый статус для заявки:', repair.status);
    if (!newStatus || newStatus === repair.status) return;
    
    try {
        const updateData = { 
            status: newStatus,
            updated_at: new Date().toISOString()
        };
        
        if (isFirebaseReady && db) {
            await db.collection('repairs').doc(id).update(updateData);
        } else {
            const index = repairsList.findIndex(r => r.id === id);
            if (index !== -1) {
                repairsList[index] = { ...repairsList[index], ...updateData };
                saveLocalData();
            }
        }
        
        renderRepairsTable(getAllRepairs());
        showNotification('Статус обновлен', 'info');
        
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        showNotification('Ошибка обновления', 'danger');
    }
}

async function deleteRepair(id) {
    if (!confirm('Вы уверены, что хотите удалить эту заявку?')) return;
    
    try {
        if (isFirebaseReady && db) {
            await db.collection('repairs').doc(id).delete();
            console.log('Заявка удалена из Firestore:', id);
        }
        
        repairsList = repairsList.filter(r => r.id !== id);
        saveLocalData();
        renderRepairsTable(getAllRepairs());
        showNotification('Заявка удалена', 'warning');
        
    } catch (error) {
        console.error('Ошибка удаления заявки:', error);
        showNotification('Ошибка удаления: ' + error.message, 'danger');
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function showNotification(message, type = 'info') {
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
    `;
    
    notification.innerHTML = `
        <strong>${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</strong>
        ${message}
        <button type="button" class="close" onclick="this.parentElement.remove()">
            <span>&times;</span>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 3000);
}

// Анимация обновления таблицы
function refreshTable() {
    const tbody = document.getElementById('repairsTableBody');
    if (!tbody) return;
    
    tbody.style.opacity = '0.5';
    tbody.style.transition = 'opacity 0.3s ease';
    
    setTimeout(() => {
        loadData();
        tbody.style.opacity = '1';
        showNotification('Таблица обновлена', 'success');
    }, 300);
}

// Экспорт данных
function exportToExcel() {
    const repairs = getAllRepairs();
    if (repairs.length === 0) {
        showNotification('Нет данных для экспорта', 'warning');
        return;
    }
    
    const headers = ['Оборудование', 'Неисправность', 'Дата', 'Статус', 'Автор', 'Исполнитель', 'Описание'];
    const rows = repairs.map(item => [
        `"${item.equipment || ''}"`,
        `"${item.problem || ''}"`,
        `"${formatDate(new Date(item.date || new Date()))}"`,
        `"${item.status || ''}"`,
        `"${item.author || ''}"`,
        `"${item.assigned_to || ''}"`,
        `"${item.description || ''}"`
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Создаем и скачиваем файл
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `заявки_ремонт_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Экспорт завершен', 'success');
}

// Поиск по таблице
function searchTable() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const repairs = getAllRepairs();
    
    if (!searchTerm) {
        renderRepairsTable(repairs);
        return;
    }
    
    const filteredRepairs = repairs.filter(repair => 
        (repair.equipment && repair.equipment.toLowerCase().includes(searchTerm)) ||
        (repair.problem && repair.problem.toLowerCase().includes(searchTerm)) ||
        (repair.description && repair.description.toLowerCase().includes(searchTerm)) ||
        (repair.author && repair.author.toLowerCase().includes(searchTerm)) ||
        (repair.status && repair.status.toLowerCase().includes(searchTerm))
    );
    
    renderRepairsTable(filteredRepairs);
    showNotification(`Найдено: ${filteredRepairs.length} заявок`, 'info');
}

// ===== НАСТРОЙКА UI =====
function setupUI() {
    // Добавляем обработчики событий
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.focus();
        }
        if (e.key === 'Escape') {
            const modal = document.getElementById('repairModal');
            if (modal) closeModal();
        }
    });
    
    // Автообновление каждые 30 секунд
    setInterval(() => {
        if (document.visibilityState === 'visible' && isFirebaseReady) {
            loadData();
        }
    }, 30000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            refreshTable();
        }
    });
    
    // Инициализация select2 для оборудования (если подключена библиотека)
    if (typeof $.fn.select2 !== 'undefined') {
        setTimeout(() => {
            $('#equipmentSelect').select2({
                placeholder: "Выберите оборудование",
                allowClear: true,
                width: '100%'
            });
        }, 100);
    }
    
    console.log('UI настроен');
}

// ===== ЗАПУСК ПРИЛОЖЕНИЯ =====
document.addEventListener('DOMContentLoaded', initApp);

// Экспортируем функции для глобального доступа
window.refreshTable = refreshTable;
window.filterTable = filterTable;
window.resetFilters = resetFilters;
window.exportToExcel = exportToExcel;
window.searchTable = searchTable;
window.createNewRepair = createNewRepair;
window.editRepair = editRepair;
window.deleteRepair = deleteRepair;
window.changeStatus = changeStatus;
window.saveRepair = saveRepair;
window.closeModal = closeModal;
