let isOnline = navigator.onLine;

function checkConnection() {
    isOnline = navigator.onLine;
    const el = document.getElementById('connectionStatus');
    if (!el) return;
    if (isOnline) { el.textContent = 'Онлайн'; el.className = 'connection-status online'; }
    else { el.textContent = 'Офлайн'; el.className = 'connection-status offline'; }
}

setInterval(checkConnection, 30000);

window.addEventListener('online', () => { isOnline = true; checkConnection(); showNotification('Соединение восстановлено', 'success'); });
window.addEventListener('offline', () => { isOnline = false; checkConnection(); showNotification('Нет соединения', 'warning'); });

document.addEventListener('DOMContentLoaded', checkConnection);

window.isOnline = isOnline;
