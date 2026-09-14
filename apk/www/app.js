let currentDeviceIndex = null;
let editDeviceIndex = null;
let allApps = [];
let checkTimer = null;
let updateCheckTimer = null;
let confirmCallback = null;
let lastNotificationState = null;
let lastNotificationId = 1;
let notificationActionSetup = false;

const CURRENT_VERSION = '2.2';
const GITHUB_REPO = 'rud1x/NeoShell';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;
const GITHUB_RELEASES = `https://github.com/${GITHUB_REPO}/releases/latest`;


setTimeout(async () => {
    document.getElementById('splash').classList.add('hidden');
    document.getElementById('app').classList.add('visible');
    await initApp();
}, 2200);


document.querySelectorAll('.app-version').forEach(el => {
    el.textContent = CURRENT_VERSION;
});


function getDevices() {
    try { return JSON.parse(localStorage.getItem('neoshell_devices') || '[]'); }
    catch { return []; }
}
function saveDevices(d) {
    localStorage.setItem('neoshell_devices', JSON.stringify(d));
}
function getSettings() {
    try { return JSON.parse(localStorage.getItem('neoshell_settings') || '{}'); }
    catch { return {}; }
}
function saveSettings(s) {
    localStorage.setItem('neoshell_settings', JSON.stringify(s));
}


function showConfirmDialog(title, desc, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmDesc').textContent = desc;
    document.getElementById('confirmDialog').classList.add('open');
    confirmCallback = onConfirm;
}

function closeConfirm(result) {
    document.getElementById('confirmDialog').classList.remove('open');
    if (result && confirmCallback) {
        const cb = confirmCallback;
        confirmCallback = null;
        cb();
    } else {
        confirmCallback = null;
    }
}


async function checkUpdates(showDialog = false) {
    try {
        const res = await fetch(`${GITHUB_API}/releases/latest`, {
            signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) throw new Error('No releases');
        const data = await res.json();
        const latestVersion = (data.tag_name || '').replace(/^v/, '');
        
        const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0;
        
        if (hasUpdate) {
            document.getElementById('updateBtn').style.display = 'flex';
            document.getElementById('updateDesc').textContent = 
                `Доступна новая версия ${data.tag_name}. Текущая: v${CURRENT_VERSION}`;
            
            if (showDialog) {
                document.getElementById('updateDialog').classList.add('open');
            }
        } else {
            document.getElementById('updateBtn').style.display = 'none';
            if (showDialog) showToast('Обновлений нет', 'success');
        }
    } catch (e) {
        console.log('Update check failed:', e);
        if (showDialog) showToast('Не удалось проверить', 'error');
    }
}

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na > nb) return 1;
        if (na < nb) return -1;
    }
    return 0;
}

function showUpdateDialog() {
    document.getElementById('updateDialog').classList.add('open');
}
function closeUpdateDialog() {
    document.getElementById('updateDialog').classList.remove('open');
}
function openReleasePage() {
    window.open(GITHUB_RELEASES, '_blank');
    closeUpdateDialog();
}
function checkUpdatesManual() {
    showToast('Проверка обновлений...');
    checkUpdates(true);
}


async function setupNotificationActions() {
    if (notificationActionSetup) return;
    try {
        const plugin = window.Capacitor?.Plugins?.LocalNotifications;
        if (!plugin) return;
        
        await plugin.registerActionTypes({
            types: [{
                id: 'OPEN_PC',
                actions: [{ id: 'open', title: 'Открыть' }]
            }]
        });
        
        plugin.addListener('localNotificationActionPerformed', (data) => {
            if (data.actionId === 'open' || data.actionId === 'tap') {
                const ip = data.notification?.extra?.ip;
                if (ip) {
                    const devices = getDevices();
                    const index = devices.findIndex(d => d.ip === ip);
                    if (index !== -1) {
                        setTimeout(() => openActions(index), 300);
                    }
                }
            }
        });
        
        notificationActionSetup = true;
    } catch (e) {
        console.log('Setup notification actions error:', e);
    }
}

async function updateNotification(deviceName, deviceIp) {
    try {
        const plugin = window.Capacitor?.Plugins?.LocalNotifications;
        if (!plugin) return;
        
        const { display } = await plugin.checkPermissions();
        if (display !== 'granted') {
            await plugin.requestPermissions();
        }
        

        if (lastNotificationState &&
            lastNotificationState.name === deviceName &&
            lastNotificationState.ip === deviceIp) {
            return;
        }
        

        try {
            await plugin.cancel({ notifications: [{ id: lastNotificationId }] });
        } catch {}
        lastNotificationId++;
        
        await plugin.schedule({
            notifications: [{
                id: lastNotificationId,
                title: `NeoShell — ${deviceName}`,
                body: `ПК доступен · ${deviceIp}`,
                smallIcon: 'ic_stat_icon',
                iconColor: '#ffcc00',
                ongoing: true,
                autoCancel: false,
                actionTypeId: 'OPEN_PC',
                extra: { ip: deviceIp }
            }]
        });
        
        lastNotificationState = { name: deviceName, ip: deviceIp };
    } catch (e) {
        console.log('Notification error:', e);
    }
}

async function hideNotification() {
    try {
        const plugin = window.Capacitor?.Plugins?.LocalNotifications;
        if (plugin && lastNotificationState) {
            try {
                await plugin.cancel({ notifications: [{ id: lastNotificationId }] });
            } catch {}
            lastNotificationState = null;
        }
    } catch (e) {
        console.log('Cancel error:', e);
    }
}

async function checkAndNotify() {
    const s = getSettings();
    if (s.notificationsEnabled === false) {
        await hideNotification();
        return;
    }
    
    const devices = getDevices();
    let onlineDevice = null;
    for (const d of devices) {
        if (d.online === true) {
            onlineDevice = d;
            break;
        }
    }
    
    if (onlineDevice) {
        await updateNotification(onlineDevice.name, onlineDevice.ip);
    } else {
        await hideNotification();
    }
}


async function initApp() {
    const s = getSettings();
    document.getElementById('confirmShutdown').checked = s.confirmShutdown !== false;
    document.getElementById('confirmRestart').checked = s.confirmRestart !== false;
    document.getElementById('confirmSleep').checked = s.confirmSleep !== false;
    document.getElementById('confirmLock').checked = s.confirmLock !== false;
    document.getElementById('notificationsEnabled').checked = s.notificationsEnabled !== false;

    await setupNotificationActions();
    renderDevices();
    startAutoCheck();
    
    setTimeout(() => checkUpdates(true), 3000);
    
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    updateCheckTimer = setInterval(() => checkUpdates(false), 6 * 60 * 60 * 1000);
}


function renderDevices() {
    const list = document.getElementById('deviceList');
    const devices = getDevices();

    if (devices.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="ph-light ph-devices"></i>
                <h3>Нет устройств</h3>
                <p>Нажмите <strong>+</strong> внизу,<br>чтобы добавить ПК</p>
            </div>
        `;
        return;
    }

    const existingCards = list.querySelectorAll('.device-card');
    if (existingCards.length === devices.length) {
        devices.forEach((d, i) => updateDeviceCard(existingCards[i], d, i));
        return;
    }

    list.innerHTML = devices.map((d, i) => deviceCardHTML(d, i)).join('');
}

function deviceCardHTML(d, i) {
    const cls = d.online === true ? 'online' : d.online === false ? 'offline' : 'unknown';
    const icon = d.online === true ? 'ph-check-circle' : d.online === false ? 'ph-x-circle' : 'ph-circle';
    const pingText = d.ping ? `${d.ping} ms` : (d.online === false ? 'недоступен' : '...');
    return `
        <div class="device-card" data-index="${i}" onclick="openActions(${i})">
            <div class="device-icon"><i class="ph-light ph-desktop"></i></div>
            <div class="device-info">
                <div class="device-name">${escapeHtml(d.name || 'ПК')}</div>
                <div class="device-ip">${d.ip}:${d.port} · <span class="ping-value ${cls}">${pingText}</span></div>
            </div>
            <div class="device-status ${cls}">
                <i class="ph-light ${icon}"></i>
            </div>
        </div>
    `;
}

function updateDeviceCard(card, d, i) {
    const cls = d.online === true ? 'online' : d.online === false ? 'offline' : 'unknown';
    const icon = d.online === true ? 'ph-check-circle' : d.online === false ? 'ph-x-circle' : 'ph-circle';
    const pingText = d.ping ? `${d.ping} ms` : (d.online === false ? 'недоступен' : '...');

    card.querySelector('.device-name').textContent = d.name || 'ПК';
    card.querySelector('.device-ip').innerHTML = `${d.ip}:${d.port} · <span class="ping-value ${cls}">${pingText}</span>`;

    const statusEl = card.querySelector('.device-status');
    statusEl.className = `device-status ${cls}`;
    statusEl.querySelector('i').className = `ph-light ${icon}`;

    card.setAttribute('data-index', i);
    card.setAttribute('onclick', `openActions(${i})`);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


async function checkAllDevices() {
    const devices = getDevices();
    let changed = false;

    for (let i = 0; i < devices.length; i++) {
        const d = devices[i];
        const start = performance.now();
        try {
            const res = await fetch(`http://${d.ip}:${d.port}/api/ping?key=${d.key}`, {
                signal: AbortSignal.timeout(8000)
            });
            const ping = Math.round(performance.now() - start);
            
            if (res.ok) {
                const data = await res.json();
                
                if (d.online !== true) { d.online = true; changed = true; }
                if (d.ping !== ping) { d.ping = ping; changed = true; }
                
                if (data.name && (!d.customName) && (d.name === 'Новый ПК' || !d.name || d.name === 'ПК')) {
                    d.name = data.name;
                    changed = true;
                }
            } else {
                if (d.online !== false) { d.online = false; changed = true; }
                if (d.ping !== null) { d.ping = null; changed = true; }
            }
        } catch (e) {
            if (d.online !== false) { d.online = false; changed = true; }
            if (d.ping !== null) { d.ping = null; changed = true; }
        }
    }

    if (changed) {
        saveDevices(devices);
        renderDevices();
    }
    checkAndNotify();
}

function startAutoCheck() {
    if (checkTimer) clearInterval(checkTimer);
    checkAllDevices();
    checkTimer = setInterval(checkAllDevices, 8000);
}

function refreshAll() {
    showToast('Обновление...');
    checkAllDevices();
}

function openAddMenu() {
    document.getElementById('addMenuOverlay').classList.add('open');
}
function closeAddMenu() {
    document.getElementById('addMenuOverlay').classList.remove('open');
}

async function scanQR() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorBarcodeScanner) {
            const result = await window.Capacitor.Plugins.CapacitorBarcodeScanner.scanBarcode({
                hint: 0,
                scanInstructions: 'Наведите на QR-код',
                cameraDirection: 0
            });
            if (result && result.ScanResult) handleQRData(result.ScanResult);
        } else {
            const data = prompt('Введите данные:\nNEOSHELL://IP:PORT?key=KEY', 'NEOSHELL://192.168.1.9:8000?key=123');
            if (data) handleQRData(data);
        }
    } catch (e) {
        showToast('Сканер отменён', 'error');
    }
}

function handleQRData(data) {
    try {
        const match = data.match(/NEOSHELL:\/\/([^:]+):(\d+)\?key=(.+)/);
        if (!match) { showToast('Неверный QR-код', 'error'); return; }
        addDeviceFromQR(match[1], parseInt(match[2]), match[3]);
    } catch (e) {
        showToast('Ошибка обработки QR', 'error');
    }
}

async function addDeviceFromQR(ip, port, key) {
    const devices = getDevices();
    const existingIndex = devices.findIndex(d => d.ip === ip);

    if (existingIndex !== -1) {
        const existing = devices[existingIndex];
        showConfirmDialog(
            'Устройство уже есть',
            `"${existing.name}" уже добавлен. Обновить параметры?`,
            () => {
                existing.port = port;
                existing.key = key;
                existing.online = null;
                existing.ping = null;
                saveDevices(devices);
                renderDevices();
                showToast('Обновлено', 'success');
                checkAllDevices();
            }
        );
        return;
    }

    devices.push({ name: 'Новый ПК', ip, port, key, online: null, ping: null, customName: false });
    saveDevices(devices);
    renderDevices();
    showToast('ПК добавлен', 'success');
    checkAllDevices();
}

function openAddDialog() {
    document.getElementById('addDeviceDialog').classList.add('open');
    document.getElementById('addName').value = '';
    document.getElementById('addIp').value = '';
    document.getElementById('addPort').value = '8000';
    document.getElementById('addKey').value = '';
    setTimeout(() => document.getElementById('addIp').focus(), 300);
}
function closeAddDialog() {
    document.getElementById('addDeviceDialog').classList.remove('open');
}

async function submitAddDevice() {
    const userTypedName = document.getElementById('addName').value.trim();
    const name = userTypedName || 'Новый ПК';
    const ip = document.getElementById('addIp').value.trim();
    const port = parseInt(document.getElementById('addPort').value) || 8000;
    const key = document.getElementById('addKey').value.trim();

    if (!ip) { showToast('Введите IP-адрес', 'error'); return; }
    if (!key) { showToast('Введите ключ', 'error'); return; }

    const devices = getDevices();
    const existingIndex = devices.findIndex(d => d.ip === ip);

    if (existingIndex !== -1) {
        const existing = devices[existingIndex];
        showConfirmDialog(
            'Устройство уже есть',
            `"${existing.name}" уже добавлен. Обновить параметры?`,
            () => {
                existing.name = name;
                existing.port = port;
                existing.key = key;
                existing.online = null;
                existing.ping = null;
                if (userTypedName) existing.customName = true;
                saveDevices(devices);
                closeAddDialog();
                renderDevices();
                showToast('Обновлено', 'success');
                checkAllDevices();
            }
        );
        return;
    }

    devices.push({
        name,
        ip,
        port,
        key,
        online: null,
        ping: null,
        customName: !!userTypedName
    });
    saveDevices(devices);
    closeAddDialog();
    renderDevices();
    showToast('ПК добавлен', 'success');
    checkAllDevices();
}

function openActions(index) {
    const d = getDevices()[index];
    if (!d) return;
    currentDeviceIndex = index;
    document.getElementById('sheetName').textContent = d.name || 'ПК';
    document.getElementById('sheetIp').textContent = `${d.ip}:${d.port}`;
    document.getElementById('sheetOverlay').classList.add('open');
}

function closeActions() {
    document.getElementById('sheetOverlay').classList.remove('open');
    currentDeviceIndex = null;
}

async function sendCmd(action) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;

    showToast('Выполнение...');
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/${action}?key=${d.key}`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        if (data.success) showToast('Готово!', 'success');
        else showToast('Ошибка', 'error');
    } catch {
        showToast('Ошибка подключения', 'error');
    }
}

function sendCmdWithConfirm(action, message) {
    const s = getSettings();
    let need = false;
    if (action === 'shutdown' && s.confirmShutdown !== false) need = true;
    if (action === 'reboot' && s.confirmRestart !== false) need = true;
    if (action === 'sleep' && s.confirmSleep !== false) need = true;
    if (action === 'lock' && s.confirmLock !== false) need = true;

    if (need) {
        showConfirmDialog('Подтверждение', message, () => sendCmd(action));
    } else {
        sendCmd(action);
    }
}

function unpairDevice() {
    if (currentDeviceIndex === null) return;
    const devices = getDevices();
    const d = devices[currentDeviceIndex];
    showConfirmDialog(
        'Удалить устройство?',
        `Разорвать сопряжение с "${d.name}"?`,
        () => {
            devices.splice(currentDeviceIndex, 1);
            saveDevices(devices);
            closeActions();
            renderDevices();
            showToast('Удалено', 'success');
        }
    );
}

function openBrowserDialog() {
    document.getElementById('browserDialog').classList.add('open');
    document.getElementById('browserInput').value = '';
    setTimeout(() => document.getElementById('browserInput').focus(), 300);
}
function closeBrowserDialog() {
    document.getElementById('browserDialog').classList.remove('open');
}
async function submitBrowserDialog() {
    if (currentDeviceIndex === null) return;
    const query = document.getElementById('browserInput').value.trim();
    if (!query) { showToast('Введите запрос', 'error'); return; }
    const d = getDevices()[currentDeviceIndex];
    closeBrowserDialog();
    showToast('Открытие...');
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/open_browser?query=${encodeURIComponent(query)}&key=${d.key}`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        if (data.success) showToast('Открыто', 'success');
        else showToast('Ошибка', 'error');
    } catch {
        showToast('Ошибка подключения', 'error');
    }
}

function openEditDialog() {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    editDeviceIndex = currentDeviceIndex;
    document.getElementById('editName').value = d.name || '';
    document.getElementById('editIp').value = d.ip || '';
    document.getElementById('editPort').value = d.port || 8000;
    document.getElementById('editKey').value = d.key || '';
    closeActions();
    document.getElementById('editDialog').classList.add('open');
}
function closeEditDialog() {
    document.getElementById('editDialog').classList.remove('open');
    editDeviceIndex = null;
}
function saveEdit() {
    if (editDeviceIndex === null) return;
    const devices = getDevices();
    const d = devices[editDeviceIndex];
    if (!d) return;

    const userTypedName = document.getElementById('editName').value.trim();
    const name = userTypedName || 'ПК';
    const ip = document.getElementById('editIp').value.trim();
    const port = parseInt(document.getElementById('editPort').value) || 8000;
    const key = document.getElementById('editKey').value.trim();

    if (!ip || !key) {
        showToast('IP и ключ обязательны', 'error');
        return;
    }

    d.name = name;
    d.ip = ip;
    d.port = port;
    d.key = key;
    d.online = null;
    d.ping = null;
    
    if (userTypedName) d.customName = true;

    saveDevices(devices);
    closeEditDialog();
    renderDevices();
    showToast('Сохранено', 'success');
    checkAllDevices();
}

function openAppsPage() {
    if (currentDeviceIndex === null) return;
    document.getElementById('appsPage').classList.add('open');
    loadAppsPage();
}
function closeAppsPage() {
    document.getElementById('appsPage').classList.remove('open');
}

async function loadAppsPage() {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;

    const grid = document.getElementById('appsGrid');
    grid.innerHTML = '<div class="apps-loading">Загрузка...</div>';

    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/apps?key=${d.key}`, {
            signal: AbortSignal.timeout(8000)
        });
        const data = await res.json();

        let apps = [];
        if (Array.isArray(data)) apps = data;
        else if (data.apps) apps = data.apps;
        else if (data.data) apps = data.data;
        else if (data.list) apps = data.list;

        allApps = apps;
        renderApps();
    } catch (e) {
        grid.innerHTML = '<div class="apps-loading">Ошибка загрузки</div>';
    }
}

function renderApps() {
    const grid = document.getElementById('appsGrid');
    if (!allApps || allApps.length === 0) {
        grid.innerHTML = '<div class="apps-loading">Нет приложений<br><br><small>Добавьте .exe, .lnk или .url в папку NeoShellApps на ПК</small></div>';
        return;
    }
    grid.innerHTML = allApps.map(app => {
        const name = app.name || app.title || 'Приложение';
        const file = app.file || app.path || name;
        return `
            <div class="app-tile" onclick="runApp('${escapeHtml(file).replace(/'/g, "\\'")}')">
                <i class="ph-light ph-app-window"></i>
                <div class="name">${escapeHtml(name)}</div>
            </div>
        `;
    }).join('');
}

function filterAppsPage() {
    const q = document.getElementById('appsSearch').value.toLowerCase();
    document.querySelectorAll('.app-tile').forEach(t => {
        const name = t.querySelector('.name')?.textContent?.toLowerCase() || '';
        t.style.display = name.includes(q) ? '' : 'none';
    });
}

async function runApp(file) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    try {
        await fetch(`http://${d.ip}:${d.port}/api/run/${encodeURIComponent(file)}?key=${d.key}`, {
            method: 'POST',
            signal: AbortSignal.timeout(5000)
        });
        showToast('Запущено', 'success');
    } catch { showToast('Ошибка запуска', 'error'); }
}

function toggleDrawer() {
    document.getElementById('drawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
}

function openSettings() {
    document.getElementById('settingsPage').classList.add('open');
}
function closeSettings() {
    const s = {
        confirmShutdown: document.getElementById('confirmShutdown').checked,
        confirmRestart: document.getElementById('confirmRestart').checked,
        confirmSleep: document.getElementById('confirmSleep').checked,
        confirmLock: document.getElementById('confirmLock').checked,
        notificationsEnabled: document.getElementById('notificationsEnabled').checked
    };
    saveSettings(s);
    document.getElementById('settingsPage').classList.remove('open');
    showToast('Сохранено', 'success');
    
    if (s.notificationsEnabled) checkAndNotify();
    else hideNotification();
}


async function openAbout() {
    document.getElementById('aboutPage').classList.add('open');
    loadGitHubStats();
}

function closeAbout() {
    document.getElementById('aboutPage').classList.remove('open');
}

async function loadGitHubStats() {
    try {
        const res = await fetch(GITHUB_API, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) throw new Error();
        const data = await res.json();
        document.getElementById('ghStars').textContent = data.stargazers_count || 0;
        document.getElementById('ghForks').textContent = data.forks_count || 0;
        document.getElementById('ghWatchers').textContent = data.subscribers_count || 0;
    } catch (e) {
        document.getElementById('ghStars').textContent = '—';
        document.getElementById('ghForks').textContent = '—';
        document.getElementById('ghWatchers').textContent = '—';
    }
}

function openGitHub() {
    window.open(`https://github.com/${GITHUB_REPO}`, '_blank');
}

function logout() {
    showConfirmDialog(
        'Удалить всё?',
        'Все устройства будут удалены из приложения',
        () => {
            localStorage.removeItem('neoshell_devices');
            hideNotification();
            renderDevices();
            closeSettings();
            showToast('Очищено', 'success');
        }
    );
}

let toastTimer = null;
function showToast(text, type) {
    const t = document.getElementById('toast');
    t.textContent = text;
    t.className = type || '';
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}