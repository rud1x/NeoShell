let currentKey = '';
const BASE = window.location.origin;
let pingTimeout = null;
let deferredPrompt = null;
let lastStatus = 'unknown';
let isChecking = false; 

let settings = {
    confirmShutdown: true,
    confirmRestart: true,
    confirmSleep: true
};


let toastTimeout = null;

function showToast(text, type) {
    const toast = document.getElementById('toast');
    toast.textContent = text;
    toast.className = type || '';
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}


window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('pwaBtn');
    if (btn) btn.style.display = 'flex';
});

function installPWA() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(() => {
            deferredPrompt = null;
            const btn = document.getElementById('pwaBtn');
            if (btn) btn.style.display = 'none';
        });
    } else {
        showToast('📲 Добавьте сайт через меню браузера', 'success');
    }
}

if (window.matchMedia('(display-mode: standalone)').matches) {
    const btn = document.getElementById('pwaBtn');
    if (btn) btn.style.display = 'none';
}


window.addEventListener('online', () => {
    showToast('Интернет восстановлен', 'success');
    if (currentKey) {
        lastStatus = 'unknown';

        if (pingTimeout) {
            clearTimeout(pingTimeout);
            pingTimeout = null;
        }
        startPing();
    }
});

window.addEventListener('offline', () => {
    showToast('Интернет отключён', 'error');
    if (lastStatus !== 'offline') {
        lastStatus = 'offline';
        setOfflineStatus('Нет подключения к интернету\nПроверьте Wi-Fi или мобильные данные', true);
    }
});


function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem('neoshell_settings'));
        if (saved) {
            settings = saved;
            document.getElementById('confirmShutdown').checked = saved.confirmShutdown !== false;
            document.getElementById('confirmRestart').checked = saved.confirmRestart !== false;
            document.getElementById('confirmSleep').checked = saved.confirmSleep !== false;
        }
    } catch {}
}

function saveSettings() {
    settings.confirmShutdown = document.getElementById('confirmShutdown').checked;
    settings.confirmRestart = document.getElementById('confirmRestart').checked;
    settings.confirmSleep = document.getElementById('confirmSleep').checked;
    localStorage.setItem('neoshell_settings', JSON.stringify(settings));
}

function toggleSettings() {
    const page = document.getElementById('settingsPage');
    page.classList.toggle('open');
    if (!page.classList.contains('open')) {
        saveSettings();
        showToast('✅ Настройки сохранены', 'success');
    }
}


async function connect() {
    const keyInput = document.getElementById('secretKey');
    currentKey = keyInput.value.trim();
    if (!currentKey) {
        document.getElementById('loginError').textContent = 'Введите ключ';
        return;
    }

    try {
        const res = await fetch(`${BASE}/api/ping?key=${currentKey}`);
        
        if (res.ok) {
            const data = await res.json();
            localStorage.setItem('neoshell_key', currentKey);
            document.getElementById('loginOverlay').classList.add('hidden');
            document.getElementById('loginError').textContent = '';
            showToast(`✅ Подключено к ${data.name || 'ПК'}`, 'success');
            
            lastStatus = 'unknown';
            startPing();
        } else if (res.status === 401) {
            document.getElementById('loginError').textContent = 'Неверный ключ';
            showToast('❌ Неверный ключ', 'error');
        } else {
            document.getElementById('loginError').textContent = 'Ошибка сервера';
            showToast('❌ Ошибка сервера', 'error');
        }
    } catch(e) {
        document.getElementById('loginError').textContent = 'Не удалось подключиться к серверу';
        showToast('❌ Ошибка подключения', 'error');
    }
}

function logout() {
    localStorage.removeItem('neoshell_key');
    document.getElementById('loginOverlay').classList.remove('hidden');
    document.getElementById('secretKey').value = '';
    document.getElementById('loginError').textContent = '';
    document.getElementById('settingsPage').classList.remove('open');
    if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
    }
    lastStatus = 'unknown';
    showToast('👋 Выход');
}


function setOnlineStatus(data, ping) {
    const dot = document.getElementById('statusDot');
    const name = document.getElementById('statusName');
    const ip = document.getElementById('statusIp');
    const label = document.getElementById('statusLabel');
    const pingEl = document.getElementById('statusPing');
    const glow = document.getElementById('statusGlow');

    dot.className = 'status-dot online';
    name.className = 'status-name online';
    name.textContent = data.name || 'ПК';

    label.className = 'status-label online';
    label.innerHTML = 'ПК доступен';

    ip.textContent = data.ip || '';

    pingEl.textContent = `⚡ ${ping}ms`;
    pingEl.style.color = '#ffcc00';

    glow.className = 'status-glow online';

    const errorEl = document.querySelector('.status-error');
    if (errorEl) errorEl.remove();
}

function updateOnlineStatus(data, ping) {
    const ip = document.getElementById('statusIp');
    const pingEl = document.getElementById('statusPing');

    ip.textContent = data.ip || '';
    pingEl.textContent = `⚡ ${ping}ms`;
    pingEl.style.color = '#ffcc00';
}

function setOfflineStatus(message, showError = true) {
    const dot = document.getElementById('statusDot');
    const name = document.getElementById('statusName');
    const ip = document.getElementById('statusIp');
    const label = document.getElementById('statusLabel');
    const pingEl = document.getElementById('statusPing');
    const glow = document.getElementById('statusGlow');

    dot.className = 'status-dot offline';
    name.className = 'status-name offline';
    name.textContent = 'ПК недоступен';

    const shortMessage = message.split('\n')[0];
    label.className = 'status-label offline';
    label.innerHTML = shortMessage;

    ip.textContent = '';

    pingEl.textContent = '⚡ --ms';
    pingEl.style.color = 'var(--text-muted)';

    glow.className = 'status-glow offline';

    if (showError) {
        let errorEl = document.querySelector('.status-error');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'status-error';
            document.querySelector('.status-content').appendChild(errorEl);
        }
        errorEl.textContent = message;
    }
}

async function updateStatus() {

    if (isChecking) return;
    isChecking = true;

    try {
        if (!currentKey) {
            if (lastStatus !== 'offline') {
                lastStatus = 'offline';
                setOfflineStatus('Не подключено к ПК', true);
            }
            isChecking = false;
            return;
        }

        if (!navigator.onLine) {
            if (lastStatus !== 'offline') {
                lastStatus = 'offline';
                setOfflineStatus('Нет подключения к интернету\nПроверьте Wi-Fi или мобильные данные', true);
            }
            isChecking = false;
            return;
        }

        const start = performance.now();
        const res = await fetch(`${BASE}/api/ping?key=${currentKey}`, {
            signal: AbortSignal.timeout(10000)
        });
        const end = performance.now();
        const ping = Math.round(end - start);
        const data = await res.json();

        if (lastStatus !== 'online') {
            lastStatus = 'online';
            setOnlineStatus(data, ping);
        } else {
            updateOnlineStatus(data, ping);
        }

    } catch (e) {

        if (lastStatus === 'offline') {
            isChecking = false;
            return;
        }

        lastStatus = 'offline';
        
        let message = 'ПК недоступен\nВозможно, вы не в той же Wi-Fi сети, что и компьютер';
        if (e.name === 'AbortError' || e.message?.includes('timeout')) {
            message = 'ПК не отвечает\nПроверьте, запущен ли NeoShell на компьютере';
        } else if (e.message?.includes('Failed to fetch') || e.message?.includes('NetworkError')) {
            message = 'ПК недоступен\nВозможно, вы не в той же Wi-Fi сети, что и компьютер';
        } else {
            message = 'Ошибка подключения\nПопробуйте обновить страницу';
        }
        
        setOfflineStatus(message, true);
    }

    isChecking = false;
}

function startPing() {
    if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
    }
    
    async function check() {
        await updateStatus();
        

        const interval = lastStatus === 'online' ? 3000 : 15000;
        pingTimeout = setTimeout(check, interval);
    }
    
    check();
}

function refreshStatus() {
    showToast('🔄 Обновление...');
    lastStatus = 'unknown';
    if (pingTimeout) {
        clearTimeout(pingTimeout);
        pingTimeout = null;
    }
    startPing();
}


async function sendCmd(action) {
    if (!currentKey) {
        showToast('❌ Не подключено', 'error');
        return;
    }
    showToast('⏳ Выполнение...');
    try {
        const res = await fetch(`${BASE}/api/${action}?key=${currentKey}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Готово!', 'success');
            if (action === 'shutdown' || action === 'reboot') {
                setTimeout(() => location.reload(), 3000);
            }
        } else {
            showToast('❌ Ошибка', 'error');
        }
    } catch(e) {
        showToast('❌ Ошибка подключения', 'error');
    }
}

function sendCmdWithConfirm(action, message) {
    if (!currentKey) {
        showToast('❌ Не подключено', 'error');
        return;
    }
    let needConfirm = false;
    if (action === 'shutdown' && settings.confirmShutdown) needConfirm = true;
    if (action === 'reboot' && settings.confirmRestart) needConfirm = true;
    if (action === 'sleep' && settings.confirmSleep) needConfirm = true;

    if (needConfirm) {
        if (confirm(message)) sendCmd(action);
    } else {
        sendCmd(action);
    }
}


function openBrowserDialog() {
    document.getElementById('browserDialog').classList.add('open');
    document.getElementById('browserInput').value = '';
    setTimeout(() => document.getElementById('browserInput').focus(), 200);
}

function closeBrowserDialog() {
    document.getElementById('browserDialog').classList.remove('open');
}

async function submitBrowser() {
    const input = document.getElementById('browserInput');
    const query = input.value.trim();
    if (!query) {
        showToast('❌ Введите запрос или URL', 'error');
        return;
    }

    closeBrowserDialog();

    if (!currentKey) {
        showToast('❌ Не подключено', 'error');
        return;
    }

    showToast('⏳ Открытие...');
    try {
        await fetch(`${BASE}/api/open_browser?query=${encodeURIComponent(query)}&key=${currentKey}`, { method: 'POST' });
        showToast('✅ Открыто', 'success');
    } catch(e) {
        showToast('❌ Ошибка', 'error');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('browserInput');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') submitBrowser();
        });
    }
});


let appsPageLoaded = false;
let allApps = [];

function openAppsPage() {
    document.getElementById('appsPage').classList.add('open');
    document.getElementById('appsPageSearch').value = '';
    if (!appsPageLoaded) {
        loadAppsPage();
    } else {
        renderAppsPage(allApps);
    }
}

function closeAppsPage() {
    document.getElementById('appsPage').classList.remove('open');
}

async function loadAppsPage() {
    if (!currentKey) {
        showToast('❌ Не подключено', 'error');
        return;
    }

    const grid = document.getElementById('appsPageGrid');
    grid.innerHTML = '<div class="apps-loading"><i class="ph-light ph-spinner"></i> Загрузка...</div>';

    try {
        const res = await fetch(`${BASE}/api/apps?key=${currentKey}`);
        const data = await res.json();

        if (!data.apps || data.apps.length === 0) {
            grid.innerHTML = '<div class="apps-loading">Нет приложений</div>';
            return;
        }

        allApps = data.apps;
        renderAppsPage(allApps);
        appsPageLoaded = true;

    } catch(e) {
        grid.innerHTML = '<div class="apps-loading" style="color:var(--red);">Ошибка загрузки</div>';
    }
}

function renderAppsPage(apps) {
    const grid = document.getElementById('appsPageGrid');
    
    if (!apps || apps.length === 0) {
        grid.innerHTML = '<div class="apps-loading">Нет приложений</div>';
        return;
    }

    grid.innerHTML = '';
    apps.forEach(app => {
        const tile = document.createElement('div');
        tile.className = 'app-tile';

        let icon = 'ph-light ph-app-window';
        const name = app.name.toLowerCase();
        if (name.includes('chrome')) icon = 'ph-light ph-browser';
        else if (name.includes('discord')) icon = 'ph-light ph-discord-logo';
        else if (name.includes('code') || name.includes('vscode')) icon = 'ph-light ph-code';
        else if (name.includes('steam')) icon = 'ph-light ph-steam-logo';
        else if (name.includes('spotify')) icon = 'ph-light ph-spotify-logo';
        else if (name.includes('youtube')) icon = 'ph-light ph-youtube-logo';
        else if (name.includes('telegram')) icon = 'ph-light ph-telegram-logo';
        else if (name.includes('github')) icon = 'ph-light ph-github-logo';
        else if (name.includes('epic')) icon = 'ph-light ph-game-controller';

        tile.innerHTML = `<i class="${icon}"></i><div class="name">${escapeHtml(app.name)}</div>`;
        tile.onclick = () => runAppFromPage(app.file);
        grid.appendChild(tile);
    });
}

function filterAppsPage() {
    const query = document.getElementById('appsPageSearch').value.toLowerCase();
    const tiles = document.querySelectorAll('#appsPageGrid .app-tile');
    tiles.forEach(tile => {
        const name = tile.querySelector('.name')?.textContent?.toLowerCase() || '';
        if (name.includes(query)) {
            tile.style.display = '';
        } else {
            tile.style.display = 'none';
        }
    });
}

async function runAppFromPage(filename) {
    if (!currentKey) {
        showToast('❌ Не подключено', 'error');
        return;
    }
    showToast('⏳ Запуск...');
    try {
        const res = await fetch(`${BASE}/api/run/${encodeURIComponent(filename)}?key=${currentKey}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('✅ Запущено', 'success');
        } else {
            showToast('❌ Ошибка запуска', 'error');
        }
    } catch(e) {
        showToast('❌ Ошибка подключения', 'error');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function init() {
    loadSettings();

    const savedKey = localStorage.getItem('neoshell_key');
    if (savedKey) {
        document.getElementById('secretKey').value = savedKey;
        connect();
    } else {
        document.getElementById('secretKey').focus();
    }

    document.getElementById('secretKey').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') connect();
    });
}

document.addEventListener('DOMContentLoaded', init);

console.log('🔌 NeoShell v2.0 loaded');