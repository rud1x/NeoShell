let currentDeviceIndex = null;
let editDeviceIndex = null;
let allApps = [];
let checkTimer = null;
let updateCheckTimer = null;
let confirmCallback = null;
let lastNotificationState = null;
let lastNotificationId = 1;
let notificationActionSetup = false;

// v2.3
let pinBuffer = '';
let pinMode = 'unlock';
let currentCommands = [];
let editingCommandIndex = null;
let selectedCommandIcon = '⚡';
let devicePollTimer = null;
let autolockTimer = null;
let lastActivity = Date.now();
let volumeDragging = false;
let commandMenuIndex = null;

const CURRENT_VERSION = '2.3';
const GITHUB_REPO = 'rud1x/NeoShell';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;
const GITHUB_RELEASES = `https://github.com/${GITHUB_REPO}/releases/latest`;


// ============================================================
// СТАРТ
// ============================================================

document.querySelectorAll('.app-version').forEach(el => {
    el.textContent = CURRENT_VERSION;
});

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('splash').style.display = 'flex';
    document.getElementById('splash').classList.remove('hidden');
    document.getElementById('app').style.display = 'none';
    document.getElementById('app').classList.remove('visible');
    document.getElementById('pinPage').style.display = 'none';
    document.getElementById('pinPage').classList.remove('visible');

    setTimeout(() => {
        document.getElementById('splash').classList.add('hidden');
        setTimeout(() => {
            document.getElementById('splash').style.display = 'none';
            const hasPin = localStorage.getItem('neoshell_pin');
            if (hasPin) showPinPage();
            else startApp();
        }, 600);
    }, 2000);
});

function startApp() {
    document.getElementById('pinPage').style.display = 'none';
    document.getElementById('pinPage').classList.remove('visible');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('app').classList.add('visible');
    initApp();
    setupAutolock();
    resetActivityTimer();
}

function showPinPage() {
    document.getElementById('pinPage').style.display = 'flex';
    document.getElementById('pinPage').classList.add('visible');
    pinBuffer = '';
    updatePinDots();
    document.getElementById('pinError').textContent = '';
    const lockUntil = parseInt(localStorage.getItem('neoshell_lock_until') || '0');
    if (lockUntil > Date.now()) {
        const seconds = Math.ceil((lockUntil - Date.now()) / 1000);
        document.getElementById('pinError').textContent = `Подождите ${seconds} сек`;
    }
}


// ============================================================
// PIN
// ============================================================

function pinInput(digit) {
    const lockUntil = parseInt(localStorage.getItem('neoshell_lock_until') || '0');
    if (lockUntil > Date.now()) return;
    if (pinBuffer.length >= 4) return;
    pinBuffer += digit;
    updatePinDots();
    if (pinBuffer.length === 4) setTimeout(checkPin, 200);
}

function pinBackspace() {
    pinBuffer = pinBuffer.slice(0, -1);
    updatePinDots();
}

function updatePinDots() {
    const dots = document.querySelectorAll('#pinDots span');
    dots.forEach((dot, i) => {
        if (i < pinBuffer.length) dot.classList.add('filled');
        else dot.classList.remove('filled');
    });
}

async function hashPin(pin) {
    const buf = new TextEncoder().encode(pin + 'neoshell_salt');
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkPin() {
    const lockUntil = parseInt(localStorage.getItem('neoshell_lock_until') || '0');
    if (lockUntil > Date.now()) {
        const seconds = Math.ceil((lockUntil - Date.now()) / 1000);
        document.getElementById('pinError').textContent = `Подождите ${seconds} сек`;
        pinBuffer = '';
        updatePinDots();
        return;
    }
    const inputHash = await hashPin(pinBuffer);
    const storedHash = localStorage.getItem('neoshell_pin');
    if (inputHash === storedHash) {
        localStorage.setItem('neoshell_failed_attempts', '0');
        startApp();
    } else {
        let attempts = parseInt(localStorage.getItem('neoshell_failed_attempts') || '0') + 1;
        localStorage.setItem('neoshell_failed_attempts', attempts.toString());
        if (attempts >= 5) {
            localStorage.setItem('neoshell_lock_until', (Date.now() + 10000).toString());
            localStorage.setItem('neoshell_failed_attempts', '0');
            document.getElementById('pinError').textContent = 'Слишком много попыток. 10 сек';
        } else {
            document.getElementById('pinError').textContent = `Неверный PIN. Осталось: ${5 - attempts}`;
        }
        pinBuffer = '';
        updatePinDots();
    }
}

function openPinResetDialog() {
    document.getElementById('pinResetDialog').classList.add('open');
}
function closePinResetDialog() {
    document.getElementById('pinResetDialog').classList.remove('open');
}
function confirmPinReset() {
    localStorage.clear();
    closePinResetDialog();
    location.reload();
}


// ============================================================
// НАСТРОЙКИ PIN
// ============================================================

function openPinSettings() {
    const hasPin = localStorage.getItem('neoshell_pin');
    pinMode = hasPin ? 'change' : 'setup';
    document.getElementById('pinSetupTitle').textContent = hasPin ? 'Изменить PIN' : 'Установить PIN';
    document.getElementById('pinSetupDesc').textContent = hasPin ? 'Введите новый PIN' : 'Введите 4-значный код';
    document.getElementById('pinInput1').value = '';
    document.getElementById('pinInput2').value = '';
    document.getElementById('pinInput2Wrap').style.display = 'none';
    document.getElementById('pinSetupDialog').classList.add('open');
    setTimeout(() => document.getElementById('pinInput1').focus(), 300);
}

function closePinSetupDialog() {
    document.getElementById('pinSetupDialog').classList.remove('open');
}

async function submitPinSetup() {
    const pin1 = document.getElementById('pinInput1').value.trim();
    if (pin1.length !== 4 || !/^\d{4}$/.test(pin1)) {
        showToast('PIN должен быть 4 цифры', 'error');
        return;
    }
    const pinInput2Wrap = document.getElementById('pinInput2Wrap');
    if (pinInput2Wrap.style.display === 'none') {
        pinInput2Wrap.style.display = 'block';
        document.getElementById('pinSetupDesc').textContent = 'Повторите PIN';
        setTimeout(() => document.getElementById('pinInput2').focus(), 100);
        return;
    }
    const pin2 = document.getElementById('pinInput2').value.trim();
    if (pin1 !== pin2) {
        showToast('PIN не совпадают', 'error');
        document.getElementById('pinInput2').value = '';
        return;
    }
    const hash = await hashPin(pin1);
    localStorage.setItem('neoshell_pin', hash);
    closePinSetupDialog();
    updatePinBtn();
    showToast('✅ PIN установлен', 'success');
}

function updatePinBtn() {
    const hasPin = localStorage.getItem('neoshell_pin');
    const btn = document.getElementById('pinBtn');
    if (btn) btn.textContent = hasPin ? 'Изменить' : 'Установить';
}


// ============================================================
// АВТОБЛОКИРОВКА
// ============================================================

function setupAutolock() {
    const autolock = parseInt(localStorage.getItem('neoshell_autolock') || '0');
    const select = document.getElementById('autolockSelect');
    if (select) select.value = autolock.toString();
    ['click', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
        document.addEventListener(evt, resetActivityTimer, { passive: true });
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            localStorage.setItem('neoshell_last_hidden', Date.now().toString());
        } else {
            checkAutolockOnReturn();
        }
    });
}

function resetActivityTimer() {
    lastActivity = Date.now();
    if (autolockTimer) clearTimeout(autolockTimer);
    const autolock = parseInt(localStorage.getItem('neoshell_autolock') || '0');
    if (autolock > 0 && localStorage.getItem('neoshell_pin')) {
        autolockTimer = setTimeout(lockApp, autolock * 60 * 1000);
    }
}

function checkAutolockOnReturn() {
    const autolock = parseInt(localStorage.getItem('neoshell_autolock') || '0');
    if (autolock === 0 || !localStorage.getItem('neoshell_pin')) return;
    const lastHidden = parseInt(localStorage.getItem('neoshell_last_hidden') || '0');
    if (lastHidden === 0) return;
    const elapsed = (Date.now() - lastHidden) / 1000 / 60;
    if (elapsed >= autolock) lockApp();
    else resetActivityTimer();
}

function lockApp() {
    if (!localStorage.getItem('neoshell_pin')) return;
    document.getElementById('app').style.display = 'none';
    document.getElementById('app').classList.remove('visible');
    document.getElementById('devicePage').classList.remove('open');
    document.getElementById('settingsPage').classList.remove('open');
    document.getElementById('aboutPage').classList.remove('open');
    document.getElementById('appsPage').classList.remove('open');
    document.getElementById('commandsPage').classList.remove('open');
    if (devicePollTimer) clearInterval(devicePollTimer);
    showPinPage();
}

function onAutolockChange() {
    const val = parseInt(document.getElementById('autolockSelect').value);
    localStorage.setItem('neoshell_autolock', val.toString());
    resetActivityTimer();
    showToast('✅ Сохранено', 'success');
}


// ============================================================
// ХРАНИЛИЩЕ
// ============================================================

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


// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

async function initApp() {
    const s = getSettings();
    document.getElementById('confirmShutdown').checked = s.confirmShutdown !== false;
    document.getElementById('confirmRestart').checked = s.confirmRestart !== false;
    document.getElementById('confirmSleep').checked = s.confirmSleep !== false;
    document.getElementById('confirmLock').checked = s.confirmLock !== false;
    document.getElementById('notificationsEnabled').checked = s.notificationsEnabled !== false;
    updatePinBtn();
    await setupNotificationActions();
    renderDevices();
    startAutoCheck();
    setTimeout(() => checkUpdates(true), 3000);
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    updateCheckTimer = setInterval(() => checkUpdates(false), 6 * 60 * 60 * 1000);
}


// ============================================================
// ОБНОВЛЕНИЯ
// ============================================================

async function checkUpdates(showDialog = false) {
    try {
        const res = await fetch(`${GITHUB_API}/releases/latest`);
        if (!res.ok) throw new Error('No releases');
        const data = await res.json();
        const latestVersion = (data.tag_name || '').replace(/^v/, '');
        const hasUpdate = compareVersions(latestVersion, CURRENT_VERSION) > 0;
        if (hasUpdate) {
            document.getElementById('updateBtn').style.display = 'flex';
            document.getElementById('updateDesc').textContent =
                `Доступна новая версия ${data.tag_name}. Текущая: v${CURRENT_VERSION}`;
            if (showDialog) document.getElementById('updateDialog').classList.add('open');
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


// ============================================================
// УВЕДОМЛЕНИЯ
// ============================================================

async function setupNotificationActions() {
    if (notificationActionSetup) return;
    try {
        const plugin = window.Capacitor?.Plugins?.LocalNotifications;
        if (!plugin) return;
        await plugin.registerActionTypes({
            types: [{ id: 'OPEN_PC', actions: [{ id: 'open', title: 'Открыть' }] }]
        });
        plugin.addListener('localNotificationActionPerformed', (data) => {
            if (data.actionId === 'open' || data.actionId === 'tap') {
                const ip = data.notification?.extra?.ip;
                if (ip) {
                    const devices = getDevices();
                    const index = devices.findIndex(d => d.ip === ip);
                    if (index !== -1) setTimeout(() => openDevicePage(index), 300);
                }
            }
        });
        notificationActionSetup = true;
    } catch (e) { console.log('Setup notification actions error:', e); }
}

async function updateNotification(deviceName, deviceIp) {
    try {
        const plugin = window.Capacitor?.Plugins?.LocalNotifications;
        if (!plugin) return;
        const { display } = await plugin.checkPermissions();
        if (display !== 'granted') await plugin.requestPermissions();
        if (lastNotificationState &&
            lastNotificationState.name === deviceName &&
            lastNotificationState.ip === deviceIp) return;
        try { await plugin.cancel({ notifications: [{ id: lastNotificationId }] }); } catch {}
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
    } catch (e) { console.log('Notification error:', e); }
}

async function hideNotification() {
    try {
        const plugin = window.Capacitor?.Plugins?.LocalNotifications;
        if (plugin && lastNotificationState) {
            try { await plugin.cancel({ notifications: [{ id: lastNotificationId }] }); } catch {}
            lastNotificationState = null;
        }
    } catch (e) { console.log('Cancel error:', e); }
}

async function checkAndNotify() {
    const s = getSettings();
    if (s.notificationsEnabled === false) { await hideNotification(); return; }
    const devices = getDevices();
    let onlineDevice = null;
    for (const d of devices) if (d.online === true) { onlineDevice = d; break; }
    if (onlineDevice) await updateNotification(onlineDevice.name, onlineDevice.ip);
    else await hideNotification();
}


// ============================================================
// РЕНДЕР СПИСКА
// ============================================================

function renderDevices() {
    const list = document.getElementById('deviceList');
    const devices = getDevices();
    if (devices.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="ph-light ph-devices"></i>
                <h3>Нет устройств</h3>
                <p>Нажмите <strong>+</strong> внизу,<br>чтобы добавить ПК</p>
            </div>`;
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
        <div class="device-card" data-index="${i}" onclick="openDevicePage(${i})" oncontextmenu="openActions(${i}); return false;">
            <div class="device-icon"><i class="ph-light ph-desktop"></i></div>
            <div class="device-info">
                <div class="device-name">${escapeHtml(d.name || 'ПК')}</div>
                <div class="device-ip">${d.ip}:${d.port} · <span class="ping-value ${cls}">${pingText}</span></div>
            </div>
            <div class="device-status ${cls}">
                <i class="ph-light ${icon}"></i>
            </div>
        </div>`;
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
    card.setAttribute('onclick', `openDevicePage(${i})`);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ============================================================
// ПРОВЕРКА СТАТУСА
// ============================================================

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
    if (changed) { saveDevices(devices); renderDevices(); }
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


// ============================================================
// ДОБАВЛЕНИЕ ПК
// ============================================================

function openAddMenu() { document.getElementById('addMenuOverlay').classList.add('open'); }
function closeAddMenu() { document.getElementById('addMenuOverlay').classList.remove('open'); }

async function scanQR() {
    try {
        if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorBarcodeScanner) {
            const result = await window.Capacitor.Plugins.CapacitorBarcodeScanner.scanBarcode({
                hint: 0, scanInstructions: 'Наведите на QR-код', cameraDirection: 0
            });
            if (result && result.ScanResult) handleQRData(result.ScanResult);
        } else {
            const data = prompt('Введите данные:\nNEOSHELL://IP:PORT?key=KEY', 'NEOSHELL://192.168.1.100:8000?key=123');
            if (data) handleQRData(data);
        }
    } catch (e) { showToast('Сканер отменён', 'error'); }
}

function handleQRData(data) {
    try {
        const match = data.match(/NEOSHELL:\/\/([^:]+):(\d+)\?key=(.+)/);
        if (!match) { showToast('Неверный QR-код', 'error'); return; }
        addDeviceFromQR(match[1], parseInt(match[2]), match[3]);
    } catch (e) { showToast('Ошибка обработки QR', 'error'); }
}

async function addDeviceFromQR(ip, port, key) {
    const devices = getDevices();
    const existingIndex = devices.findIndex(d => d.ip === ip);
    if (existingIndex !== -1) {
        const existing = devices[existingIndex];
        showConfirmDialog('Устройство уже есть', `"${existing.name}" уже добавлен. Обновить?`, () => {
            existing.port = port; existing.key = key; existing.online = null; existing.ping = null;
            saveDevices(devices); renderDevices();
            showToast('Обновлено', 'success'); checkAllDevices();
        });
        return;
    }
    devices.push({ name: 'Новый ПК', ip, port, key, online: null, ping: null, customName: false });
    saveDevices(devices); renderDevices(); showToast('ПК добавлен', 'success'); checkAllDevices();
}

function openAddDialog() {
    document.getElementById('addDeviceDialog').classList.add('open');
    document.getElementById('addName').value = '';
    document.getElementById('addIp').value = '';
    document.getElementById('addPort').value = '8000';
    document.getElementById('addKey').value = '';
    setTimeout(() => document.getElementById('addIp').focus(), 300);
}
function closeAddDialog() { document.getElementById('addDeviceDialog').classList.remove('open'); }

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
        showConfirmDialog('Устройство уже есть', `"${existing.name}" уже добавлен. Обновить?`, () => {
            existing.name = name; existing.port = port; existing.key = key;
            existing.online = null; existing.ping = null;
            if (userTypedName) existing.customName = true;
            saveDevices(devices); closeAddDialog(); renderDevices();
            showToast('Обновлено', 'success'); checkAllDevices();
        });
        return;
    }
    devices.push({ name, ip, port, key, online: null, ping: null, customName: !!userTypedName });
    saveDevices(devices); closeAddDialog(); renderDevices();
    showToast('ПК добавлен', 'success'); checkAllDevices();
}


// ============================================================
// СТРАНИЦА ПК
// ============================================================

function openDevicePage(index) {
    const d = getDevices()[index];
    if (!d) return;
    currentDeviceIndex = index;
    document.getElementById('dpName').textContent = d.name || 'ПК';
    updateDevicePageStatus(d);
    document.getElementById('devicePage').classList.add('open');
    startDevicePolling();
}

function updateDevicePageStatus(d) {
    const dot = d.online === true ? '🟢' : d.online === false ? '🔴' : '⚪';
    const ping = d.ping ? `${d.ping} ms` : (d.online === false ? 'недоступен' : '...');
    document.getElementById('dpStatus').textContent = `${dot} ${d.ip}:${d.port} · ${ping}`;
}

function closeDevicePage() {
    document.getElementById('devicePage').classList.remove('open');
    stopDevicePolling();
    currentDeviceIndex = null;
}

function refreshDevicePage() {
    showToast('Обновление...');
    checkMedia(); checkMonitor(); checkVolume();
}

function startDevicePolling() {
    stopDevicePolling();
    checkMedia(); checkMonitor(); checkVolume();
    devicePollTimer = setInterval(() => { checkMedia(); checkMonitor(); }, 3000);
    setInterval(checkVolume, 5000);
}

function stopDevicePolling() {
    if (devicePollTimer) { clearInterval(devicePollTimer); devicePollTimer = null; }
}


// ============================================================
// МЕДИА
// ============================================================

async function checkMedia() {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/media/now?key=${d.key}`, {
            signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();
        const card = document.getElementById('mediaCard');
        if (!data.success || !data.title) { card.style.display = 'none'; return; }
        card.style.display = 'block';
        document.getElementById('mediaTitle').textContent = data.title;
        document.getElementById('mediaArtist').textContent = data.artist || '—';
        document.getElementById('mediaAlbum').textContent = data.album || '';
        const playBtn = document.querySelector('#mediaPlayBtn i');
        if (playBtn) playBtn.className = data.is_playing ? 'ph-light ph-pause' : 'ph-light ph-play';
        if (data.artwork) {
            card.style.setProperty('--artwork-url', `url(${data.artwork})`);
            card.classList.add('has-artwork');
        } else {
            card.classList.remove('has-artwork');
        }
    } catch { document.getElementById('mediaCard').style.display = 'none'; }
}

async function mediaCmd(action) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    try {
        await fetch(`http://${d.ip}:${d.port}/api/media/${action}?key=${d.key}`, { method: 'POST' });
        setTimeout(checkMedia, 500);
    } catch {}
}


// ============================================================
// ГРОМКОСТЬ
// ============================================================

async function checkVolume() {
    if (currentDeviceIndex === null) return;
    if (volumeDragging) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/volume/get?key=${d.key}`, {
            signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('volumeSlider').value = data.level;
            document.getElementById('volumePercent').textContent = data.level + '%';
            updateVolumeSliderBackground(data.level);
            const icon = document.getElementById('volumeIcon');
            if (data.muted) { icon.className = 'ph-light ph-speaker-slash'; icon.style.color = 'var(--red)'; }
            else if (data.level === 0) { icon.className = 'ph-light ph-speaker-x'; icon.style.color = 'var(--text-muted)'; }
            else if (data.level < 50) { icon.className = 'ph-light ph-speaker-low'; icon.style.color = 'var(--accent)'; }
            else { icon.className = 'ph-light ph-speaker-high'; icon.style.color = 'var(--accent)'; }
        }
    } catch {}
}

function updateVolumeSliderBackground(value) {
    const slider = document.getElementById('volumeSlider');
    if (!slider) return;
    slider.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
}

function onVolumeInput(value) {
    volumeDragging = true;
    document.getElementById('volumePercent').textContent = value + '%';
    updateVolumeSliderBackground(value);
}

async function onVolumeChange(value) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    try {
        await fetch(`http://${d.ip}:${d.port}/api/volume/set?level=${value}&key=${d.key}`, { method: 'POST' });
    } catch {}
    setTimeout(() => { volumeDragging = false; }, 1500);
}


// ============================================================
// МОНИТОРИНГ
// ============================================================

async function checkMonitor() {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/monitor?key=${d.key}`, {
            signal: AbortSignal.timeout(3000)
        });
        const data = await res.json();
        if (data.success) {
            updateMonitorBar('cpu', data.cpu);
            updateMonitorBar('ram', data.ram);
            updateMonitorBar('disk', data.disk);
            const tempRow = document.getElementById('tempRow');
            if (data.temp) { tempRow.style.display = 'flex'; document.getElementById('tempValue').textContent = data.temp + '°C'; }
            else tempRow.style.display = 'none';
        }
    } catch {}
}

function updateMonitorBar(type, value) {
    const bar = document.getElementById(type + 'Bar');
    const val = document.getElementById(type + 'Value');
    if (!bar || !val) return;
    bar.style.width = value + '%';
    val.textContent = Math.round(value) + '%';
    bar.style.background = getColorForValue(value);
}

function getColorForValue(value) {
    if (value < 50) {
        const t = value / 50;
        const g = Math.round(204 - t * 68);
        return `rgb(255, ${g}, 0)`;
    } else if (value < 75) {
        const t = (value - 50) / 25;
        const g = Math.round(136 - t * 68);
        return `rgb(255, ${g}, 0)`;
    } else {
        const t = (value - 75) / 25;
        const r = Math.round(255 - t * 51);
        const g = Math.round(68 - t * 68);
        return `rgb(${r}, ${g}, 0)`;
    }
}


// ============================================================
// СТАНДАРТНЫЕ КОМАНДЫ
// ============================================================

async function sendCmd(action) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    showToast('Выполнение...');
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/${action}?key=${d.key}`, {
            method: 'POST', signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        if (data.success) showToast('Готово!', 'success');
        else showToast('Ошибка', 'error');
    } catch { showToast('Ошибка подключения', 'error'); }
}

function sendCmdWithConfirm(action, message) {
    const s = getSettings();
    let need = false;
    if (action === 'shutdown' && s.confirmShutdown !== false) need = true;
    if (action === 'reboot' && s.confirmRestart !== false) need = true;
    if (action === 'sleep' && s.confirmSleep !== false) need = true;
    if (action === 'lock' && s.confirmLock !== false) need = true;
    if (need) showConfirmDialog('Подтверждение', message, () => sendCmd(action));
    else sendCmd(action);
}


// ============================================================
// МОИ КОМАНДЫ
// ============================================================

function getCommands(deviceIp) {
    try {
        const all = JSON.parse(localStorage.getItem('neoshell_commands') || '{}');
        return all[deviceIp] || [];
    } catch { return []; }
}

function saveCommands(deviceIp, commands) {
    const all = JSON.parse(localStorage.getItem('neoshell_commands') || '{}');
    all[deviceIp] = commands;
    localStorage.setItem('neoshell_commands', JSON.stringify(all));
}

function openCommandsPage() {
    if (currentDeviceIndex === null) return;
    document.getElementById('commandsPage').classList.add('open');
    renderCommands();
}

function closeCommandsPage() {
    document.getElementById('commandsPage').classList.remove('open');
}

function renderCommands() {
    const list = document.getElementById('commandsList');
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    currentCommands = getCommands(d.ip);
    if (currentCommands.length === 0) {
        list.innerHTML = `
            <div class="command-empty">
                <i class="ph-light ph-lightning"></i>
                <p>Нет команд<br><br>Нажмите <strong>+</strong> чтобы создать</p>
            </div>`;
        return;
    }
    list.innerHTML = currentCommands.map((cmd, i) => `
        <div class="command-item" onclick="runCustomCommand(${i})" oncontextmenu="showCommandMenu(event, ${i}); return false;">
            <div class="command-icon">${cmd.icon || '⚡'}</div>
            <div class="command-info">
                <div class="command-name">${escapeHtml(cmd.name)}</div>
                <div class="command-preview">${escapeHtml(cmd.commands[0] || '')}</div>
            </div>
            <button class="command-menu-btn" onclick="event.stopPropagation(); showCommandMenu(event, ${i})">
                <i class="ph-light ph-dots-three-vertical"></i>
            </button>
        </div>
    `).join('');
}

function filterCommands() {
    const q = document.getElementById('commandsSearch').value.toLowerCase();
    document.querySelectorAll('.command-item').forEach(item => {
        const name = item.querySelector('.command-name')?.textContent?.toLowerCase() || '';
        item.style.display = name.includes(q) ? '' : 'none';
    });
}

function showCommandMenu(event, index) {
    event.preventDefault();
    event.stopPropagation();
    commandMenuIndex = index;
    const cmd = currentCommands[index];
    if (!cmd) return;
    document.getElementById('commandMenuTitle').textContent = cmd.name;
    document.getElementById('commandMenu').classList.add('open');
}

function closeCommandMenu() {
    document.getElementById('commandMenu').classList.remove('open');
    commandMenuIndex = null;
}

function menuEditCommand() {
    const idx = commandMenuIndex;
    closeCommandMenu();
    if (idx === null) return;
    setTimeout(() => editCustomCommand(idx), 200);
}

function menuDeleteCommand() {
    const idx = commandMenuIndex;
    closeCommandMenu();
    if (idx === null) return;
    const cmd = currentCommands[idx];
    if (!cmd) return;
    setTimeout(() => {
        showConfirmDialog(
            'Удалить команду?',
            `Удалить "${cmd.name}"?`,
            () => {
                if (currentDeviceIndex === null) return;
                const d = getDevices()[currentDeviceIndex];
                if (!d) return;
                const allCommands = getCommands(d.ip);
                allCommands.splice(idx, 1);
                saveCommands(d.ip, allCommands);
                renderCommands();
                showToast('Удалено', 'success');
            }
        );
    }, 200);
}

function menuRunCommand() {
    const idx = commandMenuIndex;
    closeCommandMenu();
    if (idx === null) return;
    setTimeout(() => runCustomCommand(idx), 200);
}

function openAddCommandDialog() {
    editingCommandIndex = null;
    selectedCommandIcon = '⚡';
    document.getElementById('commandDialogTitle').textContent = 'Новая команда';
    document.getElementById('cmdName').value = '';
    document.getElementById('cmdCommands').value = '';
    document.getElementById('cmdConfirm').checked = false;
    document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
    document.querySelector('.icon-option').classList.add('selected');
    document.getElementById('addCommandDialog').classList.add('open');
}

function editCustomCommand(index) {
    editingCommandIndex = index;
    const cmd = currentCommands[index];
    if (!cmd) return;
    selectedCommandIcon = cmd.icon || '⚡';
    document.getElementById('commandDialogTitle').textContent = 'Изменить команду';
    document.getElementById('cmdName').value = cmd.name;
    document.getElementById('cmdCommands').value = cmd.commands.join('\n');
    document.getElementById('cmdConfirm').checked = cmd.confirm || false;
    document.querySelectorAll('.icon-option').forEach(el => {
        el.classList.remove('selected');
        if (el.textContent === selectedCommandIcon) el.classList.add('selected');
    });
    document.getElementById('addCommandDialog').classList.add('open');
}

function closeAddCommandDialog() {
    document.getElementById('addCommandDialog').classList.remove('open');
    editingCommandIndex = null;
}

function selectIcon(el, icon) {
    document.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedCommandIcon = icon;
}

async function saveCommand() {
    const name = document.getElementById('cmdName').value.trim();
    const commandsText = document.getElementById('cmdCommands').value.trim();
    const confirm = document.getElementById('cmdConfirm').checked;
    if (!name) { showToast('Введите название', 'error'); return; }
    if (!commandsText) { showToast('Введите команды', 'error'); return; }
    const commands = commandsText.split('\n').map(c => c.trim()).filter(c => c);
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    const allCommands = getCommands(d.ip);
    if (editingCommandIndex !== null) {
        allCommands[editingCommandIndex] = { name, icon: selectedCommandIcon, commands, confirm };
    } else {
        allCommands.push({ name, icon: selectedCommandIcon, commands, confirm });
    }
    saveCommands(d.ip, allCommands);
    closeAddCommandDialog();
    renderCommands();
    showToast('Сохранено', 'success');
}

async function runCustomCommand(index) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    const cmd = currentCommands[index];
    if (!cmd) return;
    if (cmd.confirm) showConfirmDialog('Выполнить команду?', cmd.name, () => executeCustomCommand(cmd));
    else executeCustomCommand(cmd);
}

async function executeCustomCommand(cmd) {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;

    showToast('Выполнение...');

    try {
        const url = `http://${d.ip}:${d.port}/api/command/batch?key=${d.key}`;
        console.log('Sending to:', url);
        console.log('Commands:', cmd.commands);

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commands: cmd.commands })
        });

        console.log('Status:', res.status);

        if (!res.ok) {
            showToast(`❌ HTTP ${res.status}`, 'error');
            return;
        }

        const text = await res.text();
        console.log('Response:', text);

        try {
            const data = JSON.parse(text);
            if (data.success) {
                const failed = (data.results || []).filter(r => !r.success);
                if (failed.length > 0) showToast(`⚠️ ${failed.length} ошибок`, 'error');
                else showToast(`✅ ${cmd.name}`, 'success');
            } else {
                showToast(`❌ ${data.error || 'Ошибка'}`, 'error');
            }
        } catch (parseErr) {
            console.error('Parse error:', parseErr, text);
            showToast('❌ Ошибка парсинга', 'error');
        }
    } catch (e) {
        console.error('Command error:', e);
        showToast(`❌ ${e.name}: ${e.message}`, 'error');
    }
}


// ============================================================
// BOTTOM SHEET (долгий тап)
// ============================================================

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
}

function openDevicePageFromSheet() {
    const idx = currentDeviceIndex;
    closeActions();
    if (idx !== null) setTimeout(() => openDevicePage(idx), 200);
}


// ============================================================
// РЕДАКТИРОВАНИЕ / УДАЛЕНИЕ ПК
// ============================================================

function openEditDialog() {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    editDeviceIndex = currentDeviceIndex;
    document.getElementById('editName').value = d.name || '';
    document.getElementById('editIp').value = d.ip || '';
    document.getElementById('editPort').value = d.port || 8000;
    document.getElementById('editKey').value = d.key || '';
    closeDevicePage();
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
    if (!ip || !key) { showToast('IP и ключ обязательны', 'error'); return; }
    d.name = name; d.ip = ip; d.port = port; d.key = key;
    d.online = null; d.ping = null;
    if (userTypedName) d.customName = true;
    saveDevices(devices); closeEditDialog(); renderDevices();
    showToast('Сохранено', 'success'); checkAllDevices();
}

function unpairDevice() {
    if (currentDeviceIndex === null) return;
    const devices = getDevices();
    const d = devices[currentDeviceIndex];
    showConfirmDialog('Удалить устройство?', `Разорвать сопряжение с "${d.name}"?`, () => {
        devices.splice(currentDeviceIndex, 1);
        saveDevices(devices); closeDevicePage(); closeActions();
        renderDevices(); showToast('Удалено', 'success');
    });
}


// ============================================================
// БРАУЗЕР
// ============================================================

function openBrowserDialog() {
    document.getElementById('browserDialog').classList.add('open');
    document.getElementById('browserInput').value = '';
    setTimeout(() => document.getElementById('browserInput').focus(), 300);
}
function closeBrowserDialog() { document.getElementById('browserDialog').classList.remove('open'); }
async function submitBrowserDialog() {
    if (currentDeviceIndex === null) return;
    const query = document.getElementById('browserInput').value.trim();
    if (!query) { showToast('Введите запрос', 'error'); return; }
    const d = getDevices()[currentDeviceIndex];
    closeBrowserDialog();
    showToast('Открытие...');
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/open_browser?query=${encodeURIComponent(query)}&key=${d.key}`, {
            method: 'POST', signal: AbortSignal.timeout(5000)
        });
        const data = await res.json();
        if (data.success) showToast('Открыто', 'success');
        else showToast('Ошибка', 'error');
    } catch { showToast('Ошибка подключения', 'error'); }
}


// ============================================================
// ПРИЛОЖЕНИЯ
// ============================================================

function openAppsPage() {
    if (currentDeviceIndex === null) return;
    document.getElementById('appsPage').classList.add('open');
    loadAppsPage();
}
function closeAppsPage() { document.getElementById('appsPage').classList.remove('open'); }

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
            </div>`;
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
            method: 'POST', signal: AbortSignal.timeout(5000)
        });
        showToast('Запущено', 'success');
    } catch { showToast('Ошибка запуска', 'error'); }
}


// ============================================================
// DRAWER / SETTINGS / ABOUT / TOAST
// ============================================================

function toggleDrawer() {
    document.getElementById('drawer').classList.toggle('open');
    document.getElementById('drawerOverlay').classList.toggle('open');
}

function openSettings() {
    document.getElementById('settingsPage').classList.add('open');
    updatePinBtn();
    const autolock = parseInt(localStorage.getItem('neoshell_autolock') || '0');
    document.getElementById('autolockSelect').value = autolock.toString();
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
function closeAbout() { document.getElementById('aboutPage').classList.remove('open'); }

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
    showConfirmDialog('Удалить всё?', 'Все устройства будут удалены из приложения', () => {
        localStorage.removeItem('neoshell_devices');
        hideNotification();
        renderDevices();
        closeSettings();
        showToast('Очищено', 'success');
    });
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