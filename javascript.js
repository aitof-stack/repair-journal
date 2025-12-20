// Конфигурация API - используем localStorage в облачной версии
// Для облачной версии используем только localStorage
let equipmentDatabase = JSON.parse(localStorage.getItem('equipmentDatabase')) || [];
let repairRequests = JSON.parse(localStorage.getItem('repairRequests')) || [];
let currentUser = JSON.parse(localStorage.getItem('currentUser')) || null;

// DOM элементы
const repairForm = document.getElementById('repairForm');
const invNumberSelect = document.getElementById('invNumber');
const equipmentNameInput = document.getElementById('equipmentName');
const locationInput = document.getElementById('location');
const modelInput = document.getElementById('model');
const machineNumberInput = document.getElementById('machineNumber');
const authorInput = document.getElementById('author');
const clearBtn = document.getElementById('clearBtn');
const repairTableBody = document.getElementById('repairTableBody');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const locationFilter = document.getElementById('locationFilter');
const monthFilter = document.getElementById('monthFilter');
const totalRequestsElement = document.getElementById('totalRequests');
const pendingRequestsElement = document.getElementById('pendingRequests');
const completedRequestsElement = document.getElementById('completedRequests');
const totalDowntimeElement = document.getElementById('totalDowntime');

// Добавьте в самое начало проверку аутентификации
(function checkAuth() {
    const isAuthenticated = localStorage.getItem('isAuthenticated');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    if (!isAuthenticated || !currentUser) {
        window.location.href = 'login.html';
        return;
    }
    
    // Отображаем информацию о пользователе
    document.getElementById('userInfo').style.display = 'flex';
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = `(${getRoleName(currentUser.type)})`;
    
    // Настраиваем интерфейс в зависимости от прав доступа
    configureInterface(currentUser);
    
    // Загружаем данные
    loadEquipmentData();
    loadRepairRequests();
    
    // Инициализируем интерфейс
    initializeInterface(currentUser);
})();

// Функция для получения названия роли
function getRoleName(roleType) {
    switch(roleType) {
        case 'admin': return 'Администратор';
        case 'author': return 'Автор заявки';
        case 'repair': return 'Ремонтная служба';
        default: return 'Пользователь';
    }
}

// Функция настройки интерфейса
function configureInterface(currentUser) {
    // Автоподстановка имени автора для авторов заявок
    if (currentUser.type === 'author') {
        authorInput.value = currentUser.name;
        authorInput.readOnly = true;
        authorInput.style.backgroundColor = '#f0f0f0';
    }
    
    // Скрываем/показываем элементы в зависимости от прав
    if (currentUser.type === 'repair') {
        // Для ремонтной службы показываем только таблицу
        document.getElementById('formSection').style.display = 'none';
        document.getElementById('searchFilter').style.display = 'none';
        document.getElementById('summarySection').style.display = 'none';
        
        // Убираем лишние заголовки
        document.querySelectorAll('h2').forEach(h2 => {
            if (h2.textContent.includes('Новая заявка') || 
                h2.textContent.includes('Поиск')) {
                h2.style.display = 'none';
            }
        });
        
        // Увеличиваем таблицу
        document.querySelector('.table-container').style.marginTop = '0';
        
        // Обновляем заголовок
        document.getElementById('pageTitle').textContent = 'Журнал заявок на ремонт оборудования';
    } else {
        // Для других пользователей показываем все
        document.getElementById('formSection').style.display = 'block';
        document.getElementById('searchFilter').style.display = 'flex';
        document.getElementById('summarySection').style.display = 'flex';
    }
    
    // Сохраняем права доступа в глобальной переменной
    window.currentUser = currentUser;
}

// Загрузка оборудования
function loadEquipmentData() {
    // Пытаемся загрузить из файла
    fetch('data/equipment_database.csv')
        .then(response => {
            if (!response.ok) throw new Error('Файл не найден');
            return response.text();
        })
        .then(csvContent => {
            equipmentDatabase = parseCSV(csvContent);
            localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
            populateInvNumberSelect();
            populateLocationFilter();
        })
        .catch(error => {
            console.log('Используем локальные данные:', error);
            // Используем данные из localStorage или тестовые
            if (equipmentDatabase.length === 0) {
                equipmentDatabase = getDefaultEquipmentDatabase();
                localStorage.setItem('equipmentDatabase', JSON.stringify(equipmentDatabase));
            }
            populateInvNumberSelect();
            populateLocationFilter();
        });
}

// Парсинг CSV
function parseCSV(csvContent) {
    const equipment = [];
    const lines = csvContent.split('\n');
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
            const parts = line.split(';');
            if (parts.length >= 5) {
                equipment.push({
                    location: parts[0]?.trim() || '',
                    invNumber: parts[1]?.trim() || '',
                    name: parts[2]?.replace(/"/g, '').trim() || '',
                    model: parts[3]?.replace(/"/g, '').trim() || '-',
                    machineNumber: parts[4]?.replace(/"/g, '').trim() || '-'
                });
            }
        }
    }
    
    return equipment;
}

// Тестовые данные оборудования
function getDefaultEquipmentDatabase() {
    return [
        { location: "701", invNumber: "11323", name: "Автомат холод штамповки", model: "-", machineNumber: "СК-11323" },
        { location: "735", invNumber: "28542", name: "Токарный автомобиль (СМТ) (СК6136/750)", model: "КЕ36750", machineNumber: "ТС-28542" },
        { location: "717", invNumber: "7257", name: "Токарный автомат", model: "1269M-6", machineNumber: "А-7257" },
        { location: "702", invNumber: "11324", name: "Пресс гидравлический", model: "ПГ-100", machineNumber: "ПГ-11324" },
        { location: "735", invNumber: "28543", name: "Токарный станок", model: "1К62", machineNumber: "ТС-28543" },
        { location: "717", invNumber: "7258", name: "Фрезерный станок", model: "6Р82", machineNumber: "ФС-7258" },
        { location: "701", invNumber: "11325", name: "Сверлильный станок", model: "2Н125", machineNumber: "СС-11325" },
        { location: "702", invNumber: "11326", name: "Шлифовальный станок", model: "3Б722", machineNumber: "ШС-11326" }
    ];
}

// Загрузка заявок
function loadRepairRequests() {
    // Всегда используем localStorage для облачной версии
    repairRequests = JSON.parse(localStorage.getItem('repairRequests')) || [];
    renderRepairTable();
    updateSummary();
}

// Инициализация интерфейса
function initializeInterface() {
    // Устанавливаем сегодняшнюю дату по умолчанию
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('date').value = today;
    document.getElementById('repairEndDate').value = today;
    
    // Устанавливаем текущее время по умолчанию
    const now = new Date();
    const timeString = now.getHours().toString().padStart(2, '0') + ':' + 
                      now.getMinutes().toString().padStart(2, '0');
    document.getElementById('time').value = timeString;
    document.getElementById('repairEndTime').value = timeString;
}

// Остальной код (функции populateInvNumberSelect, renderRepairTable и т.д.)
// остается таким же, как в предыдущей версии
// ...

// Экспорт данных
window.exportRepairData = function() {
    if (repairRequests.length === 0) {
        alert('Нет данных для экспорта');
        return;
    }
    
    // Создаем CSV
    let csvContent = "Дата;Время;Автор;Участок;Инв.номер;Оборудование;Модель;Номер станка;Неисправность;Дата окончания;Время окончания;Статус;Кол-во простоев;Время простоя;Номенклатура\n";
    
    repairRequests.forEach(request => {
        csvContent += `"${request.date}";"${request.time}";"${request.author}";"${request.location}";"${request.invNumber}";"${request.equipmentName}";"${request.model}";"${request.machineNumber}";"${request.faultDescription}";"${request.repairEndDate}";"${request.repairEndTime}";"${request.status}";"${request.downtimeCount}";"${request.downtimeHours}";"${request.productionItem}"\n`;
    });
    
    // Создаем и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `заявки_${new Date().toISOString().slice(0,10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Функция выхода
window.logout = function() {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('isAuthenticated');
    window.location.href = 'login.html';
};

// Функция для мобильной оптимизации
function checkMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Применение мобильной оптимизации
if (checkMobileDevice()) {
    document.addEventListener('DOMContentLoaded', function() {
        // Уменьшаем размер шрифта для мобильных
        document.body.style.fontSize = '14px';
        
        // Увеличиваем отступы для кнопок
        document.querySelectorAll('.btn').forEach(btn => {
            btn.style.padding = '12px 15px';
            btn.style.fontSize = '15px';
        });
        
        // Оптимизируем таблицу для мобильных
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.style.fontSize = '12px';
        }
        
        // Добавляем сообщение для мобильных пользователей
        const mobileHint = document.createElement('div');
        mobileHint.innerHTML = `
            <div style="
                background: #e3f2fd;
                border: 1px solid #2196F3;
                border-radius: 4px;
                padding: 10px;
                margin: 10px 0;
                font-size: 12px;
                color: #1565C0;
            ">
                <strong>💡 Совет:</strong> Используйте горизонтальную прокрутку для просмотра таблицы. 
                Поверните устройство для лучшего отображения.
            </div>
        `;
        
        const tableElement = document.querySelector('table');
        if (tableElement) {
            tableElement.parentNode.insertBefore(mobileHint, tableElement);
        }
    });
}