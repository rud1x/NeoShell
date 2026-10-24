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
let selectedCommandIcon = 'lightning';
let devicePollTimer = null;
let autolockTimer = null;
let lastActivity = Date.now();
let volumeDragging = false;
let commandMenuIndex = null;
let addDeviceIcon = 'desktop';
let editDeviceIcon = 'desktop';
let panelLayout = [];
let panelEditMode = false;
let panelScope = 'device';
let panelSelected = null;
let panelTab = 'blocks';
let panelAppsCache = null;
let panelAppsLoading = false;
let panelAppsError = false;
let panelDragState = null;

const CURRENT_VERSION = '2.4';
const GITHUB_REPO = 'rud1x/NeoShell';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}`;
const GITHUB_RELEASES = `https://github.com/${GITHUB_REPO}/releases/latest`;

const DEVICE_ICONS = ['desktop', 'laptop', 'game-controller', 'hard-drives', 'briefcase'];

const QUICK_ACTIONS = [
    { id: 'explorer', label: 'Проводник', icon: 'folder-open', desc: 'Открыть проводник' },
    { id: 'minimize_all', label: 'Свернуть', icon: 'corners-in', desc: 'Свернуть все окна' },
    { id: 'task_manager', label: 'Диспетчер', icon: 'chart-line', desc: 'Диспетчер задач' },
    { id: 'close_app', label: 'Закрыть', icon: 'x-circle', desc: 'Закрыть активное окно' },
    { id: 'browser', label: 'Браузер', icon: 'browser', desc: 'Открыть браузер' },
    { id: 'apps', label: 'Приложения', icon: 'grid-four', desc: 'Приложения на ПК' },
    { id: 'commands', label: 'Команды', icon: 'lightning', desc: 'Мои команды' },
    { id: 'edit', label: 'Изменить ПК', icon: 'pencil-simple', desc: 'Название, адрес и ключ' }
];
const QUICK_ACTIONS_ORDER = QUICK_ACTIONS.map(a => a.id);

function haptic(pattern = 12) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

function shakePin() {
    const dots = document.getElementById('pinDots');
    if (!dots) return;
    dots.classList.remove('shake');
    void dots.offsetWidth;
    dots.classList.add('shake');
    setTimeout(() => dots.classList.remove('shake'), 520);
}

document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    btn.style.setProperty('--rx', `${e.clientX - r.left}px`);
    btn.style.setProperty('--ry', `${e.clientY - r.top}px`);
}, { passive: true });


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
        shakePin();
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
        shakePin();
        haptic([18, 60, 24]);
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
    closeAllPages();
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
    renderHeroActions();
    setupPanelInteractions();
    setupHeroTilt();
    panelLayout = getEffectiveWidgets();
    renderPanelLayout();
    renderDevices();
    updateHero();
    startAutoCheck();
        setTimeout(() => checkUpdates(false), 3000);
    if (updateCheckTimer) clearInterval(updateCheckTimer);
    updateCheckTimer = setInterval(() => checkUpdates(false), 6 * 60 * 60 * 1000);
    const deepLink = location.hash.match(/^#device=(\d+)/);
    if (deepLink) {
        const idx = parseInt(deepLink[1]);
        if (getDevices()[idx]) setTimeout(() => openDevicePage(idx), 350);
    }
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
    const countEl = document.getElementById('deviceCount');
    if (countEl) countEl.textContent = devices.length;
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

function deviceIconName(d) {
    const icon = d && d.icon;
    return DEVICE_ICONS.includes(icon) ? icon : 'desktop';
}

function deviceCardHTML(d, i) {
    const cls = d.online === true ? 'online' : d.online === false ? 'offline' : 'unknown';
    const icon = d.online === true ? 'ph-check-circle' : d.online === false ? 'ph-x-circle' : 'ph-circle';
    const pingText = d.ping ? `${d.ping} ms` : (d.online === false ? 'недоступен' : '...');
    return `
        <div class="device-card" data-index="${i}" onclick="openDevicePage(${i})" oncontextmenu="openActions(${i}); return false;">
            <div class="device-icon"><i class="ph-light ph-${deviceIconName(d)}"></i></div>
            <div class="device-info">
                <div class="device-name">${escapeHtml(d.name || 'ПК')}</div>
                <div class="device-meta">
                    <span class="device-addr">${d.ip}:${d.port}</span>
                    <span class="ping-value ${cls}">${pingText}</span>
                </div>
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
    const nameEl = card.querySelector('.device-name');
    if (nameEl) nameEl.textContent = d.name || 'ПК';
    const addrEl = card.querySelector('.device-addr');
    if (addrEl) addrEl.textContent = `${d.ip}:${d.port}`;
    const pingEl = card.querySelector('.ping-value');
    if (pingEl) {
        pingEl.className = `ping-value ${cls}`;
        pingEl.textContent = pingText;
    }
    const deviceIcon = card.querySelector('.device-icon i');
    if (deviceIcon) deviceIcon.className = `ph-light ph-${deviceIconName(d)}`;
    const statusEl = card.querySelector('.device-status');
    if (statusEl) {
        statusEl.className = `device-status ${cls}`;
        const statusIcon = statusEl.querySelector('i');
        if (statusIcon) statusIcon.className = `ph-light ${icon}`;
    }
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
    updateHero();
    checkAndNotify();
}

function updateHero() {
  const nameEl = document.getElementById('heroName');
  const subEl = document.getElementById('heroSub');
  const pingEl = document.getElementById('heroPing');
  const labelEl = document.querySelector('.hero-label');
  if (!nameEl || !subEl) return;
  const devices = getDevices();
  const online = devices.find(d => d.online === true);
  if (online) {
    nameEl.textContent = online.name || 'ПК';
    subEl.textContent = `${online.ip}:${online.port}`;
    if (pingEl) pingEl.textContent = online.ping ? `${online.ping} ms` : '';
    if (labelEl) { labelEl.textContent = 'В сети'; labelEl.style.color = 'var(--green)'; }
    window.__heroDeviceIndex = devices.indexOf(online);
  } else {
    nameEl.textContent = 'Нет онлайн-устройств';
    subEl.textContent = 'Проверьте Wi-Fi или запустите NeoShell на ПК';
    if (pingEl) pingEl.textContent = '';
    if (labelEl) { labelEl.textContent = 'Не в сети'; labelEl.style.color = 'var(--text-mute)'; }
    window.__heroDeviceIndex = -1;
  }
}

function renderHeroActions() {
  const wrap = document.getElementById('heroActions');
  if (!wrap) return;
  wrap.innerHTML = `
    <button class="hero-action" onclick="heroAction('lock')"><i class="ph-light ph-lock-simple"></i><span>Блок</span></button>
    <button class="hero-action" onclick="heroAction('sleep')"><i class="ph-light ph-moon"></i><span>Сон</span></button>
    <button class="hero-action danger" onclick="heroAction('shutdown')"><i class="ph-light ph-power"></i><span>Выключить</span></button>`;
}

function heroAction(action) {
  const idx = typeof window.__heroDeviceIndex === 'number' ? window.__heroDeviceIndex : -1;
  if (idx < 0) { showToast('Нет онлайн-устройства', 'error'); return; }
  currentDeviceIndex = idx;
  sendCmdWithConfirm(action, action === 'shutdown' ? 'Выключить ПК?' : action === 'sleep' ? 'Перевести в сон?' : 'Заблокировать ПК?');
}


// ============================================================
// ПАНЕЛЬ ПК · WIDGET GRID, LAYOUT, PINS
// ============================================================

const PANEL_COLS = 4;
const PANEL_ROW_H = 68;
const PANEL_GAP = 10;
const PANEL_LAYOUT_KEY = 'neoshell_panel_layout_v1';
const PANEL_PINS_KEY = 'neoshell_panel_pins_v1';
const PANEL_MAX_PINS = 12;

const WIDGET_DEFS = {
    media: { label: 'Медиа', icon: 'music-notes', desc: 'Плеер и обложка', defW: 4, defH: 2, minW: 2, minH: 2 },
    status: { label: 'Состояние', icon: 'chart-line', desc: 'CPU, RAM, диск, температура', defW: 4, defH: 3, minW: 2, minH: 2 },
    volume: { label: 'Громкость', icon: 'speaker-high', desc: 'Ползунок звука', defW: 4, defH: 1, minW: 2, minH: 1 },
    control: { label: 'Управление', icon: 'sliders-horizontal', desc: 'Закреплённые ярлыки', defW: 4, defH: 3, minW: 2, minH: 2 },
    power: { label: 'Питание', icon: 'power', desc: 'Блокировка, сон, выключение', defW: 4, defH: 1, minW: 2, minH: 1 },
    commands: { label: 'Команды', icon: 'lightning', desc: 'Превью закреплённых команд', defW: 4, defH: 3, minW: 2, minH: 2 },
    apps: { label: 'Приложения', icon: 'grid-four', desc: 'Превью закреплённых приложений', defW: 4, defH: 3, minW: 2, minH: 2 }
};

function defaultPanelWidgets() {
    return [
        { type: 'media', x: 0, y: 0, w: 4, h: 2 },
        { type: 'status', x: 0, y: 2, w: 4, h: 3 },
        { type: 'volume', x: 0, y: 5, w: 4, h: 1 },
        { type: 'control', x: 0, y: 6, w: 4, h: 3 },
        { type: 'power', x: 0, y: 9, w: 4, h: 1 }
    ];
}

function cloneLayout(widgets) {
    return (widgets || []).map(w => ({ ...w }));
}

function currentDevice() {
    if (currentDeviceIndex === null) return null;
    return getDevices()[currentDeviceIndex] || null;
}

function panelDeviceKey() {
    const d = currentDevice();
    return d ? `${d.ip}:${d.port}` : null;
}

function loadPanelStore() {
    let store = null;
    try { store = JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) || 'null'); } catch {}
    if (!store || !store.global || !Array.isArray(store.global.widgets)) {
        store = { version: 1, global: { widgets: defaultPanelWidgets() }, devices: {} };
    }
    if (!store.devices || typeof store.devices !== 'object') store.devices = {};
    return store;
}

function savePanelStore(store) {
    localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(store));
}

function normalizeWidgets(widgets) {
    const out = [];
    (Array.isArray(widgets) ? widgets : []).forEach(raw => {
        const def = WIDGET_DEFS[raw?.type];
        if (!def || out.some(w => w.type === raw.type)) return;
        const w = Math.max(def.minW, Math.min(4, parseInt(raw.w) || def.defW));
        const h = Math.max(def.minH, Math.min(20, parseInt(raw.h) || def.defH));
        const x = Math.max(0, Math.min(PANEL_COLS - w, parseInt(raw.x) || 0));
        const y = Math.max(0, parseInt(raw.y) || 0);
        out.push({ type: raw.type, x, y, w, h });
    });
    return out;
}

function getEffectiveWidgets() {
    const store = loadPanelStore();
    const key = panelDeviceKey();
    if (key && store.devices[key] && Array.isArray(store.devices[key].widgets)) {
        return normalizeWidgets(store.devices[key].widgets);
    }
    return normalizeWidgets(store.global.widgets);
}

function persistWidgets(scope, widgets) {
    const store = loadPanelStore();
    const key = panelDeviceKey();
    if (scope === 'device' && key) {
        store.devices[key] = { widgets: cloneLayout(widgets), updated: Date.now() };
    } else {
        store.global = { widgets: cloneLayout(widgets) };
        store.devices = {};
    }
    savePanelStore(store);
}

function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function findFreeSpot(widgets, w, h) {
    for (let y = 0; y < 200; y++) {
        for (let x = 0; x <= PANEL_COLS - w; x++) {
            const cand = { x, y, w, h };
            if (!widgets.some(other => overlaps(cand, other))) return { x, y };
        }
    }
    return { x: 0, y: 0 };
}

function resolveCollisions(widgets, fixedType) {
    const fixed = widgets.find(w => w.type === fixedType);
    const others = widgets
        .filter(w => w.type !== fixedType)
        .sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = fixed ? [fixed] : [];
    others.forEach(w => {
        let guard = 0;
        while (placed.some(p => overlaps(w, p)) && guard++ < 300) w.y++;
        placed.push(w);
    });
    widgets.sort((a, b) => a.y - b.y || a.x - b.x);
    return widgets;
}

function compactWidgets(widgets) {
    const placed = [];
    [...widgets].sort((a, b) => a.y - b.y || a.x - b.x).forEach(w => {
        let y = Math.max(0, w.y);
        while (y > 0 && !placed.some(p => overlaps({ ...w, y: y - 1 }, p))) y--;
        w.y = y;
        placed.push(w);
    });
    widgets.sort((a, b) => a.y - b.y || a.x - b.x);
    return widgets;
}

function capturePanelRects() {
    const rects = new Map();
    document.querySelectorAll('#panelGrid .widget').forEach(el => {
        if (el.style.display !== 'none') rects.set(el.dataset.widget, el.getBoundingClientRect());
    });
    return rects;
}

function animatePanelReflow(before) {
    if (!before || !before.size) return;
    requestAnimationFrame(() => {
        document.querySelectorAll('#panelGrid .widget').forEach(el => {
            const prev = before.get(el.dataset.widget);
            if (!prev || el.style.display === 'none') return;
            const now = el.getBoundingClientRect();
            const dx = prev.left - now.left;
            const dy = prev.top - now.top;
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
            el.animate(
                [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
                { duration: 320, easing: 'cubic-bezier(.16,1,.3,1)' }
            );
        });
    });
}

function ensureWidgetChrome() {
    document.querySelectorAll('#panelGrid .widget').forEach(widget => {
        if (!widget.querySelector('.widget-grip')) {
            const grip = document.createElement('button');
            grip.className = 'widget-grip';
            grip.setAttribute('aria-label', 'Перетащить блок');
            grip.innerHTML = '<i class="ph-light ph-dots-six-vertical"></i>';
            const resize = document.createElement('span');
            resize.className = 'widget-resize';
            resize.setAttribute('aria-hidden', 'true');
            widget.appendChild(grip);
            widget.appendChild(resize);
        }
    });
}

function renderPanelLayout() {
    const grid = document.getElementById('panelGrid');
    if (!grid) return;
    ensureWidgetChrome();
    document.querySelectorAll('#panelGrid .widget').forEach(widget => {
        const type = widget.dataset.widget;
        const cfg = panelLayout.find(w => w.type === type);
        if (!cfg) {
            widget.style.display = 'none';
            return;
        }
        widget.style.display = '';
        widget.style.gridColumn = `${cfg.x + 1} / span ${cfg.w}`;
        widget.style.gridRow = `${cfg.y + 1} / span ${cfg.h}`;
        widget.classList.toggle('selected', panelSelected === type);
    });
    renderPinnedGrid();
    renderMiniWidgets();
    updateEditorUI();
}

function enterPanelEdit(globalOnly = false) {
    const page = document.getElementById('devicePage');
    if (!page.classList.contains('open')) {
        const devices = getDevices();
        if (!devices.length) { showToast('Сначала добавьте ПК', 'error'); return; }
        let idx = currentDeviceIndex !== null ? currentDeviceIndex : devices.findIndex(x => x.online);
        if (idx < 0 || !devices[idx]) idx = devices.findIndex(x => x.online);
        if (idx < 0) idx = 0;
        closePanelMenu();
        openDevicePage(idx);
        if (!currentDevice()) return;
        globalOnly = true;
    }
    panelEditMode = true;
    panelScope = globalOnly ? 'global' : 'device';
    panelLayout = panelScope === 'global'
        ? normalizeWidgets(loadPanelStore().global.widgets)
        : getEffectiveWidgets();
    renderPanelLayout();
    page.classList.add('editing');
    haptic(18);
}

function exitPanelEdit() {
    if (!panelEditMode) return;
    compactWidgets(panelLayout);
    persistWidgets(panelScope, panelLayout);
    panelEditMode = false;
    panelSelected = null;
    document.getElementById('devicePage').classList.remove('editing');
    panelLayout = getEffectiveWidgets();
    renderPanelLayout();
    showToast('Раскладка сохранена', 'success');
}

function setPanelScope(scope) {
    panelScope = scope;
    if (scope === 'global') {
        panelLayout = normalizeWidgets(loadPanelStore().global.widgets);
    } else {
        panelLayout = getEffectiveWidgets();
    }
    panelSelected = null;
    renderPanelLayout();
    haptic(8);
}

function updateEditorUI() {
    const deviceBtn = document.getElementById('scopeDeviceBtn');
    const allBtn = document.getElementById('scopeAllBtn');
    if (deviceBtn) deviceBtn.classList.toggle('active', panelScope === 'device');
    if (allBtn) allBtn.classList.toggle('active', panelScope === 'global');
    const page = document.getElementById('devicePage');
    if (page) page.classList.toggle('editing', panelEditMode);
}

function resetPanelLayout() {
    showConfirmDialog('Сбросить раскладку?', panelScope === 'global'
        ? 'Вернуть панель по умолчанию для всех ПК?'
        : 'Вернуть панель этого ПК по умолчанию?', () => {
        const store = loadPanelStore();
        if (panelScope === 'device' && panelDeviceKey()) delete store.devices[panelDeviceKey()];
        else { store.global = { widgets: defaultPanelWidgets() }; store.devices = {}; }
        savePanelStore(store);
        panelLayout = panelScope === 'global' ? normalizeWidgets(store.global.widgets) : getEffectiveWidgets();
        panelSelected = null;
        renderPanelLayout();
        renderPanelMenu();
        showToast('Раскладка сброшена', 'success');
    });
}

function addWidget(type) {
    const def = WIDGET_DEFS[type];
    if (!def || panelLayout.some(w => w.type === type)) return;
    const before = capturePanelRects();
    const spot = findFreeSpot(panelLayout, def.defW, def.defH);
    panelLayout.push({ type, x: spot.x, y: spot.y, w: def.defW, h: def.defH });
    compactWidgets(panelLayout);
    persistWidgets(panelEditMode ? panelScope : (panelDeviceKey() ? 'device' : 'global'), panelLayout);
    renderPanelLayout();
    animatePanelReflow(before);
}

function removeWidget(type) {
    if (panelLayout.length <= 1) { showToast('Оставьте хотя бы один блок', 'error'); return; }
    const before = capturePanelRects();
    panelLayout = panelLayout.filter(w => w.type !== type);
    compactWidgets(panelLayout);
    persistWidgets(panelEditMode ? panelScope : (panelDeviceKey() ? 'device' : 'global'), panelLayout);
    renderPanelLayout();
    animatePanelReflow(before);
}

function toggleWidget(type, enabled) {
    if (enabled) addWidget(type);
    else removeWidget(type);
    if (panelTab === 'blocks') renderPanelMenu();
    haptic(8);
}

/* ---------- drag & resize ---------- */

function startWidgetDrag(type, ev) {
    const widget = document.querySelector(`#panelGrid .widget[data-widget="${type}"]`);
    const grid = document.getElementById('panelGrid');
    if (!widget || !grid) return;
    const cfg = panelLayout.find(w => w.type === type);
    if (!cfg) return;
    const rect = widget.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const cellW = (gridRect.width - PANEL_GAP * (PANEL_COLS - 1)) / PANEL_COLS;
    const pitchX = cellW + PANEL_GAP;
    const pitchY = PANEL_ROW_H + PANEL_GAP;
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    widget.classList.add('dragging');
    panelDragState = { type, offsetX: ev.clientX - rect.left, offsetY: ev.clientY - rect.top, ghost, grid, gridRect, pitchX, pitchY, targetX: cfg.x, targetY: cfg.y, cfg };

    const move = e => dragMove(e);
    const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        finishDrag();
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
}

function dragMove(e) {
    const s = panelDragState;
    if (!s) return;
    const left = e.clientX - s.offsetX;
    const top = e.clientY - s.offsetY;
    s.ghost.style.left = left + 'px';
    s.ghost.style.top = top + 'px';
    const x = Math.round((left - s.gridRect.left) / s.pitchX);
    const y = Math.round((top - s.gridRect.top) / s.pitchY);
    s.targetX = Math.max(0, Math.min(PANEL_COLS - s.cfg.w, x));
    s.targetY = Math.max(0, y);
}

function finishDrag() {
    const s = panelDragState;
    if (!s) return;
    const before = capturePanelRects();
    s.ghost.classList.add('drop');
    setTimeout(() => s.ghost.remove(), 170);
    const widget = document.querySelector(`#panelGrid .widget[data-widget="${s.type}"]`);
    if (widget) widget.classList.remove('dragging');
    s.cfg.x = s.targetX;
    s.cfg.y = s.targetY;
    resolveCollisions(panelLayout, s.type);
    compactWidgets(panelLayout);
    panelDragState = null;
    persistWidgets(panelScope, panelLayout);
    renderPanelLayout();
    animatePanelReflow(before);
    haptic(10);
}

function startWidgetResize(type, ev) {
    const widget = document.querySelector(`#panelGrid .widget[data-widget="${type}"]`);
    const grid = document.getElementById('panelGrid');
    if (!widget || !grid) return;
    const cfg = panelLayout.find(w => w.type === type);
    if (!cfg) return;
    const def = WIDGET_DEFS[type];
    const gridRect = grid.getBoundingClientRect();
    const cellW = (gridRect.width - PANEL_GAP * (PANEL_COLS - 1)) / PANEL_COLS;
    const pitchX = cellW + PANEL_GAP;
    const pitchY = PANEL_ROW_H + PANEL_GAP;
    const rect = widget.getBoundingClientRect();
    panelDragState = { type, resize: true, startX: ev.clientX, startY: ev.clientY, startW: rect.width, startH: rect.height, def, cfg, pitchX, pitchY };

    const move = e => {
        const s = panelDragState;
        if (!s) return;
        const wRaw = s.startW + (e.clientX - s.startX);
        const hRaw = s.startH + (e.clientY - s.startY);
        const w = Math.max(s.def.minW, Math.min(PANEL_COLS - s.cfg.x, Math.round((wRaw + PANEL_GAP) / s.pitchX)));
        const h = Math.max(s.def.minH, Math.min(20, Math.round((hRaw + PANEL_GAP) / s.pitchY)));
        s.cfg.w = w;
        s.cfg.h = h;
        widget.style.gridColumn = `${s.cfg.x + 1} / span ${w}`;
        widget.style.gridRow = `${s.cfg.y + 1} / span ${h}`;
    };
    const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        const s = panelDragState;
        panelDragState = null;
        if (s) {
            const before = capturePanelRects();
            resolveCollisions(panelLayout, s.type);
            compactWidgets(panelLayout);
            persistWidgets(panelScope, panelLayout);
            renderPanelLayout();
            animatePanelReflow(before);
            haptic(10);
        }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
}

function setupPanelInteractions() {
    const grid = document.getElementById('panelGrid');
    if (!grid || grid.dataset.ready) return;
    grid.dataset.ready = '1';
    grid.addEventListener('pointerdown', ev => {
        const widget = ev.target.closest('.widget');
        if (!widget) return;
        const type = widget.dataset.widget;
        if (ev.target.closest('.widget-resize')) {
            ev.preventDefault();
            panelSelected = type;
            renderPanelLayout();
            startWidgetResize(type, ev);
            return;
        }
        if (panelEditMode) {
            if (ev.target.closest('.widget-grip')) {
                ev.preventDefault();
                panelSelected = type;
                renderPanelLayout();
                startWidgetDrag(type, ev);
            } else {
                panelSelected = type;
                renderPanelLayout();
            }
            return;
        }
        if (ev.target.closest('button, input, select, textarea, a')) return;
        const startX = ev.clientX;
        const startY = ev.clientY;
        let timer = setTimeout(() => {
            if (panelEditMode) return;
            panelSelected = type;
            enterPanelEdit();
            startWidgetDrag(type, ev);
            haptic(20);
        }, 430);
        const move = e => {
            if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) cancel();
        };
        const cancel = () => {
            clearTimeout(timer);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', cancel);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', cancel, { once: true });
    });
}

/* ---------- pins ---------- */

function getPins() {
    const key = panelDeviceKey();
    if (!key) return [];
    let store = {};
    try { store = JSON.parse(localStorage.getItem(PANEL_PINS_KEY) || '{}'); } catch {}
    if (!Array.isArray(store[key])) {
        let migrated = null;
        try {
            const old = JSON.parse(localStorage.getItem('neoshell_quick_actions') || 'null');
            if (old && Array.isArray(old.order)) {
                migrated = old.order
                    .filter(id => !(old.hidden || []).includes(id) && QUICK_ACTIONS.some(a => a.id === id))
                    .map(id => ({ type: 'action', id }));
            }
        } catch {}
        store[key] = migrated && migrated.length
            ? migrated
            : QUICK_ACTIONS.map(a => ({ type: 'action', id: a.id }));
        localStorage.setItem(PANEL_PINS_KEY, JSON.stringify(store));
    }
    return store[key].filter(p => p && p.type && p.id).slice(0, PANEL_MAX_PINS);
}

function savePins(pins) {
    const key = panelDeviceKey();
    if (!key) return;
    let store = {};
    try { store = JSON.parse(localStorage.getItem(PANEL_PINS_KEY) || '{}'); } catch {}
    store[key] = pins.slice(0, PANEL_MAX_PINS);
    localStorage.setItem(PANEL_PINS_KEY, JSON.stringify(store));
}

function commandIconHtml(icon) {
    const val = icon || 'lightning';
    return /^[a-z0-9-]+$/.test(val) ? `<i class="ph-light ph-${val}"></i>` : val;
}

function resolvePin(pin, index) {
    if (pin.type === 'action') {
        const a = QUICK_ACTIONS.find(x => x.id === pin.id);
        if (!a) return null;
        return { index, type: 'action', id: a.id, label: a.label, icon: `<i class="ph-light ph-${a.icon}"></i>` };
    }
    if (pin.type === 'command') {
        const d = currentDevice();
        if (!d) return null;
        const cmd = getCommands(d.ip).find(c => c.id === pin.id);
        if (!cmd) return null;
        return { index, type: 'command', id: cmd.id, label: cmd.name, icon: commandIconHtml(cmd.icon) };
    }
    if (pin.type === 'app') {
        const d = currentDevice();
        const apps = (panelAppsCache && d && panelAppsCache.ip === d.ip && panelAppsCache.apps) || allApps || [];
        const app = apps.find(a => (a.file || a.path || a.name) === pin.id);
        return { index, type: 'app', id: pin.id, label: app ? (app.name || app.title || app.file) : (pin.name || pin.id), icon: '<i class="ph-light ph-app-window"></i>' };
    }
    return null;
}

function renderPinnedGrid() {
    const grid = document.getElementById('actionGrid');
    if (!grid) return;
    if (!currentDevice()) { grid.innerHTML = ''; return; }
    const pins = getPins();
    const items = pins.map((p, i) => resolvePin(p, i)).filter(Boolean);
    if (!items.length) {
        grid.innerHTML = `<button class="pm-empty" style="grid-column:1/-1" onclick="openPanelMenu('pins')"><i class="ph-light ph-plus"></i>Добавьте ярлыки</button>`;
        return;
    }
    grid.innerHTML = items.map(item => `
        <button class="action" onclick="runPinAt(${item.index})">
            ${item.icon}<span>${escapeHtml(item.label)}</span>
        </button>`).join('');
}

function renderQuickActionGrid() { renderPinnedGrid(); }

function runQuickAction(id) {
    if (currentDeviceIndex === null) return;
    haptic(10);
    if (id === 'browser') { openBrowserDialog(); return; }
    if (id === 'apps') { openAppsPage(); return; }
    if (id === 'commands') { openCommandsPage(); return; }
    if (id === 'edit') { openEditDialog(); return; }
    sendCmd(id);
}

function runPinAt(index) {
    const pins = getPins();
    const pin = pins[index];
    if (!pin) return;
    haptic(10);
    if (pin.type === 'action') { runQuickAction(pin.id); return; }
    if (pin.type === 'command') {
        const d = currentDevice();
        if (!d) return;
        const cmd = getCommands(d.ip).find(c => c.id === pin.id);
        if (!cmd) { showToast('Команда не найдена', 'error'); return; }
        if (cmd.confirm) showConfirmDialog('Выполнить команду?', cmd.name, () => executeCustomCommand(cmd));
        else executeCustomCommand(cmd);
        return;
    }
    if (pin.type === 'app') runApp(pin.id);
}

function togglePin(type, id, enabled, name) {
    const pins = getPins();
    const exists = pins.findIndex(p => p.type === type && p.id === id);
    if (enabled) {
        if (exists !== -1) return;
        if (pins.length >= PANEL_MAX_PINS) {
            showToast(`Максимум ${PANEL_MAX_PINS} ярлыков`, 'error');
            renderPanelMenu();
            return;
        }
        const item = { type, id };
        if (type === 'app') {
            const app = (panelAppsCache?.apps || allApps || []).find(a => (a.file || a.path || a.name) === id);
            if (app) item.name = app.name || app.title || id;
        }
        if (name) item.name = name;
        pins.push(item);
    } else {
        if (exists === -1) return;
        pins.splice(exists, 1);
    }
    savePins(pins);
    renderPinnedGrid();
    renderMiniWidgets();
    renderPanelMenu();
    haptic(8);
}

function togglePinApp(index, enabled) {
    const app = (window.__pmApps || [])[index];
    if (!app) return;
    const file = app.file || app.path || app.name;
    togglePin('app', file, enabled, app.name || app.title || file);
}

function movePin(index, delta) {
    const pins = getPins();
    const j = index + delta;
    if (index < 0 || j < 0 || j >= pins.length) return;
    [pins[index], pins[j]] = [pins[j], pins[index]];
    savePins(pins);
    renderPinnedGrid();
    renderMiniWidgets();
    renderPanelMenu();
    haptic(8);
}

function unpinAt(index) {
    const pins = getPins();
    if (!pins[index]) return;
    pins.splice(index, 1);
    savePins(pins);
    renderPinnedGrid();
    renderMiniWidgets();
    renderPanelMenu();
}

function renderMiniWidgets() {
    const d = currentDevice();
    const pins = d ? getPins() : [];
    const miniCommands = document.getElementById('miniCommands');
    const miniApps = document.getElementById('miniApps');
    if (miniCommands) {
        const items = pins.map((p, i) => ({ p, i })).filter(x => x.p.type === 'command').slice(0, 4);
        miniCommands.innerHTML = items.length
            ? items.map(({ p, i }) => {
                const r = resolvePin(p, i);
                return r ? `<button class="mini-tile" onclick="runPinAt(${i})">${r.icon}<span>${escapeHtml(r.label)}</span></button>` : '';
            }).join('')
            : `<div class="mini-empty">Закрепите команды в «Управлении»</div>`;
    }
    if (miniApps) {
        const items = pins.map((p, i) => ({ p, i })).filter(x => x.p.type === 'app').slice(0, 4);
        miniApps.innerHTML = items.length
            ? items.map(({ p, i }) => {
                const r = resolvePin(p, i);
                return r ? `<button class="mini-tile" onclick="runPinAt(${i})">${r.icon}<span>${escapeHtml(r.label)}</span></button>` : '';
            }).join('')
            : `<div class="mini-empty">Закрепите приложения в «Управлении»</div>`;
    }
}

/* ---------- panel menu ---------- */

function openPanelMenu(tab = 'blocks') {
    if (!panelEditMode) {
        panelLayout = currentDevice()
            ? getEffectiveWidgets()
            : normalizeWidgets(loadPanelStore().global.widgets);
    }
    panelTab = tab;
    renderPanelMenu();
    document.getElementById('panelMenuOverlay').classList.add('open');
    if (tab === 'pins' && currentDevice()) loadPanelApps();
}

function openQuickActionsSheet() { openPanelMenu('pins'); }

function closePanelMenu() {
    document.getElementById('panelMenuOverlay').classList.remove('open');
}

function closeQuickActionsSheet() { closePanelMenu(); }

function setPanelTab(tab) {
    panelTab = tab;
    renderPanelMenu();
    if (tab === 'pins' && currentDevice()) loadPanelApps();
    haptic(8);
}

function renderPanelMenu() {
    const body = document.getElementById('panelMenuBody');
    const sub = document.getElementById('panelMenuSub');
    if (!body) return;
    const d = currentDevice();
    if (sub) sub.textContent = d ? d.name || 'ПК' : 'Все ПК';
    const blocksTab = document.getElementById('panelTabBlocks');
    const pinsTab = document.getElementById('panelTabPins');
    if (blocksTab) blocksTab.classList.toggle('active', panelTab === 'blocks');
    if (pinsTab) pinsTab.classList.toggle('active', panelTab === 'pins');
    body.innerHTML = panelTab === 'blocks' ? renderBlocksTab(d) : renderPinsTab(d);
}

function renderBlocksTab(d) {
    const items = Object.entries(WIDGET_DEFS).map(([type, def]) => {
        const on = panelLayout.some(w => w.type === type);
        return `
        <div class="pm-row">
            <span class="pm-ico"><i class="ph-light ph-${def.icon}"></i></span>
            <span class="pm-name">${def.label}<small>${def.desc}</small></span>
            <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="toggleWidget('${type}', this.checked)"><i></i></label>
        </div>`;
    }).join('');
    return `
        <div class="pm-head-actions">
            <button class="btn-mini" onclick="closePanelMenu(); enterPanelEdit()"><i class="ph-light ph-pencil-simple"></i> Изменить раскладку</button>
        </div>
        <div class="pm-hint">Долгое нажатие на блоке тоже открывает редактор. Размер меняется за уголок.</div>
        <div class="pm-list">${items}</div>`;
}

function renderPinsTab(d) {
    if (!d) return `<div class="pm-empty"><i class="ph-light ph-desktop"></i>Откройте ПК, чтобы настроить ярлыки</div>`;
    const pins = getPins();
    const pinnedRows = pins.length ? pins.map((p, i) => {
        const r = resolvePin(p, i);
        if (!r) return '';
        return `
        <div class="pm-row" data-search="${escapeHtml(r.label.toLowerCase())}">
            <span class="pm-ico">${r.icon}</span>
            <span class="pm-name">${escapeHtml(r.label)}<small>${p.type === 'action' ? 'Действие' : p.type === 'command' ? 'Команда' : 'Приложение'}</small></span>
            <span class="pm-move">
                <button onclick="movePin(${i},-1)" ${i === 0 ? 'disabled' : ''} aria-label="Выше"><i class="ph-light ph-caret-up"></i></button>
                <button onclick="movePin(${i},1)" ${i === pins.length - 1 ? 'disabled' : ''} aria-label="Ниже"><i class="ph-light ph-caret-down"></i></button>
                <button onclick="unpinAt(${i})" aria-label="Убрать"><i class="ph-light ph-x"></i></button>
            </span>
        </div>`;
    }).join('') : `<div class="pm-empty">Пока пусто. Включите ярлыки ниже.</div>`;

    const actionRows = QUICK_ACTIONS.map(a => {
        const on = pins.some(p => p.type === 'action' && p.id === a.id);
        return `
        <div class="pm-row" data-search="${escapeHtml(a.label.toLowerCase())}">
            <span class="pm-ico"><i class="ph-light ph-${a.icon}"></i></span>
            <span class="pm-name">${a.label}<small>${a.desc}</small></span>
            <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="togglePin('action','${a.id}',this.checked)"><i></i></label>
        </div>`;
    }).join('');

    const commands = getCommands(d.ip);
    const commandRows = commands.length ? commands.map(cmd => {
        const on = pins.some(p => p.type === 'command' && p.id === cmd.id);
        return `
        <div class="pm-row" data-search="${escapeHtml(String(cmd.name).toLowerCase())}">
            <span class="pm-ico">${commandIconHtml(cmd.icon)}</span>
            <span class="pm-name">${escapeHtml(cmd.name)}<small>${escapeHtml(cmd.commands[0] || '')}</small></span>
            <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="togglePin('command','${cmd.id}',this.checked)"><i></i></label>
        </div>`;
    }).join('') : `<div class="pm-empty">Нет своих команд. Создайте их на странице «Команды».</div>`;

    let appsHtml = '';
    if (panelAppsLoading) {
        appsHtml = `<div class="pm-empty">Загрузка приложений…</div>`;
    } else if (panelAppsError) {
        appsHtml = `<div class="pm-empty">Не удалось загрузить приложения<br><button class="pm-add" onclick="loadPanelApps(true)">Повторить</button></div>`;
    } else if (panelAppsCache && panelAppsCache.apps.length) {
        window.__pmApps = panelAppsCache.apps;
        appsHtml = panelAppsCache.apps.map((app, idx) => {
            const file = app.file || app.path || app.name;
            const name = app.name || app.title || file;
            const on = pins.some(p => p.type === 'app' && p.id === file);
            return `
            <div class="pm-row" data-search="${escapeHtml(String(name).toLowerCase())}">
                <span class="pm-ico"><i class="ph-light ph-app-window"></i></span>
                <span class="pm-name">${escapeHtml(name)}<small>${escapeHtml(file)}</small></span>
                <label class="switch"><input type="checkbox" ${on ? 'checked' : ''} onchange="togglePinApp(${idx},this.checked)"><i></i></label>
            </div>`;
        }).join('');
    } else {
        appsHtml = `<div class="pm-empty">Приложения не найдены или ПК offline</div>`;
    }

    return `
        <div class="search-field"><i class="ph-light ph-magnifying-glass"></i><input type="text" id="pinSearch" placeholder="Поиск ярлыков" oninput="filterPanelItems(this.value)" /></div>
        <div class="pm-section">На панели · ${pins.length}/${PANEL_MAX_PINS}</div>
        <div class="pm-list">${pinnedRows}</div>
        <div class="pm-section">Действия</div>
        <div class="pm-list">${actionRows}</div>
        <div class="pm-section">Мои команды</div>
        <div class="pm-list">${commandRows}</div>
        <div class="pm-section">Приложения</div>
        <div class="pm-list">${appsHtml}</div>`;
}

function filterPanelItems(query) {
    const q = (query || '').trim().toLowerCase();
    document.querySelectorAll('#panelMenuBody .pm-row').forEach(row => {
        row.style.display = !q || (row.dataset.search || '').includes(q) ? '' : 'none';
    });
}

async function loadPanelApps(force = false) {
    const d = currentDevice();
    if (!d) return;
    if (panelAppsLoading) return;
    if (!force && panelAppsCache && panelAppsCache.ip === d.ip) return;
    panelAppsLoading = true;
    panelAppsError = false;
    if (panelTab === 'pins') renderPanelMenu();
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/apps?key=${d.key}`, { signal: AbortSignal.timeout(8000) });
        const data = await res.json();
        let apps = [];
        if (Array.isArray(data)) apps = data;
        else if (data.apps) apps = data.apps;
        else if (data.data) apps = data.data;
        else if (data.list) apps = data.list;
        panelAppsCache = { ip: d.ip, apps };
        allApps = apps;
    } catch {
        panelAppsError = true;
    } finally {
        panelAppsLoading = false;
        if (document.getElementById('panelMenuOverlay')?.classList.contains('open') && panelTab === 'pins') renderPanelMenu();
        renderMiniWidgets();
    }
}

function resetPanelConfig() {
    showConfirmDialog('Сбросить настройки панели?', 'Вернуть раскладку и ярлыки по умолчанию?', () => {
        const store = loadPanelStore();
        const key = panelDeviceKey();
        if (key) {
            delete store.devices[key];
            let pins = {};
            try { pins = JSON.parse(localStorage.getItem(PANEL_PINS_KEY) || '{}'); } catch {}
            delete pins[key];
            localStorage.setItem(PANEL_PINS_KEY, JSON.stringify(pins));
        } else {
            store.global = { widgets: defaultPanelWidgets() };
            store.devices = {};
            localStorage.removeItem(PANEL_PINS_KEY);
        }
        savePanelStore(store);
        panelLayout = getEffectiveWidgets();
        renderPanelLayout();
        renderPanelMenu();
        showToast('Панель сброшена', 'success');
    });
}

function resetQuickActions() { resetPanelConfig(); }

/* ---------- hero tilt ---------- */

function setupHeroTilt() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const hero = document.querySelector('.hero');
    if (!hero || hero.dataset.tiltReady) return;
    hero.dataset.tiltReady = '1';
    const glow = hero.querySelector('.hero-glow');
    let raf = null;
    const apply = (e, active) => {
        if (raf) cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            const r = hero.getBoundingClientRect();
            const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
            const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
            if (glow) {
                glow.style.setProperty('--gx', `${px * 100}%`);
                glow.style.setProperty('--gy', `${py * 100}%`);
            }
            if (active) {
                hero.style.setProperty('--ry', `${(px - .5) * 8}deg`);
                hero.style.setProperty('--rx', `${(0.5 - py) * 6}deg`);
            } else {
                hero.style.setProperty('--ry', '0deg');
                hero.style.setProperty('--rx', '0deg');
            }
        });
    };
    hero.addEventListener('pointerdown', e => apply(e, true));
    hero.addEventListener('pointermove', e => { if (e.pressure > 0 || e.buttons) apply(e, true); else apply(e, false); });
    hero.addEventListener('pointerup', e => apply(e, false));
    hero.addEventListener('pointercancel', e => apply(e, false));
    hero.addEventListener('pointerleave', e => apply(e, false));
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
    devices.push({ name: 'Новый ПК', ip, port, key, icon: 'desktop', online: null, ping: null, customName: false });
    saveDevices(devices); renderDevices(); showToast('ПК добавлен', 'success'); checkAllDevices();
}

function openAddDialog() {
    addDeviceIcon = 'desktop';
    setDeviceIconPicker('add', addDeviceIcon);
    document.getElementById('addDeviceDialog').classList.add('open');
    document.getElementById('addName').value = '';
    document.getElementById('addIp').value = '';
    document.getElementById('addPort').value = '8000';
    document.getElementById('addKey').value = '';
    setTimeout(() => document.getElementById('addIp').focus(), 300);
}

function selectDeviceIcon(el, scope) {
    const icon = el.dataset.icon || 'desktop';
    if (scope === 'add') addDeviceIcon = icon;
    else if (scope === 'edit') editDeviceIcon = icon;
    setDeviceIconPicker(scope, icon);
    haptic(8);
}

function setDeviceIconPicker(scope, icon) {
    const picker = document.getElementById(`${scope}DeviceIconPicker`);
    if (!picker) return;
    picker.querySelectorAll('.icon-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.icon === icon);
    });
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
            existing.icon = addDeviceIcon;
            existing.online = null; existing.ping = null;
            if (userTypedName) existing.customName = true;
            saveDevices(devices); closeAddDialog(); renderDevices();
            showToast('Обновлено', 'success'); checkAllDevices();
        });
        return;
    }
    devices.push({ name, ip, port, key, icon: addDeviceIcon, online: null, ping: null, customName: !!userTypedName });
    saveDevices(devices); closeAddDialog(); renderDevices();
    showToast('ПК добавлен', 'success'); checkAllDevices();
}


// ============================================================
// СТРАНИЦА ПК
// ============================================================

// --- Навигационный стек: страницы открываются поверх main, но не копятся ---
const PAGE_STACK = [];
const PAGE_IDS = ['devicePage', 'commandsPage', 'appsPage', 'settingsPage', 'aboutPage'];

function pushPage(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (PAGE_STACK[PAGE_STACK.length - 1] === id) return;
  PAGE_STACK.push(id);
  el.classList.add('open');
}

function popPage(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
  const i = PAGE_STACK.lastIndexOf(id);
  if (i !== -1) PAGE_STACK.splice(i, 1);
}

function closeAllPages() {
  PAGE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  PAGE_STACK.length = 0;
}

function openDevicePage(index) {
    const d = getDevices()[index];
    if (!d) return;
    closeAllPages();
    currentDeviceIndex = index;
    panelEditMode = false;
    panelSelected = null;
    panelScope = 'device';
    document.getElementById('devicePage').classList.remove('editing');
    panelLayout = getEffectiveWidgets();
    const mediaWidget = document.querySelector('.widget[data-widget="media"]');
    if (mediaWidget) mediaWidget.classList.add('is-empty');
    renderPanelLayout();
    document.getElementById('dpName').textContent = d.name || 'ПК';
    updateDevicePageStatus(d);
    pushPage('devicePage');
    startDevicePolling();
}

function updateDevicePageStatus(d) {
    const ping = d.ping ? `${d.ping} ms` : (d.online === false ? 'недоступен' : '...');
    const ipPort = `${d.ip}:${d.port}`;
    const sub = document.getElementById('dpStatus');
    if (sub) sub.textContent = `${ipPort} · ${ping}`;
    const pill = document.getElementById('dpStatusPill');
    const text = document.getElementById('dpStatusText');
    if (pill && text) {
        const state = d.online === true ? 'online' : d.online === false ? 'offline' : '';
        pill.className = 'dp-status-pill ' + state;
        text.textContent = d.online === true ? 'ПК доступен' : d.online === false ? 'ПК недоступен' : 'Проверка…';
    }
    const nameEl = document.getElementById('dpName');
    if (nameEl) nameEl.textContent = d.name || 'ПК';
}

function closeDevicePage() {
    if (panelEditMode) exitPanelEdit();
    popPage('devicePage');
    // при закрытии страницы ПК закрываем и все её дочерние
    popPage('commandsPage');
    popPage('appsPage');
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
        const widget = document.querySelector('.widget[data-widget="media"]');
        if (!data.success || !data.title) { if (widget) widget.classList.add('is-empty'); return; }
        if (widget) widget.classList.remove('is-empty');
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
    } catch {
        const widget = document.querySelector('.widget[data-widget="media"]');
        if (widget) widget.classList.add('is-empty');
    }
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
            else if (data.level === 0) { icon.className = 'ph-light ph-speaker-x'; icon.style.color = 'var(--text-mute)'; }
            else if (data.level < 50) { icon.className = 'ph-light ph-speaker-low'; icon.style.color = 'var(--amber)'; }
            else { icon.className = 'ph-light ph-speaker-high'; icon.style.color = 'var(--amber)'; }
        }
    } catch {}
}

function updateVolumeSliderBackground(value) {
    const slider = document.getElementById('volumeSlider');
    if (!slider) return;
    slider.style.background = `linear-gradient(to right, var(--amber) 0%, var(--amber) ${value}%, rgba(255,255,255,0.1) ${value}%, rgba(255,255,255,0.1) 100%)`;
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
            if (data.temp) {
                tempRow.style.display = 'flex';
                document.getElementById('tempValue').textContent = data.temp + '°C';
                const tempBar = tempRow.querySelector('.stat-fill.temp');
                if (tempBar) tempBar.style.width = Math.min(data.temp, 100) + '%';
            } else tempRow.style.display = 'none';
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
    if (value < 50) return 'var(--amber)';
    if (value < 75) return 'var(--orange)';
    return 'var(--red)';
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
    haptic(action === 'shutdown' || action === 'reboot' ? [16, 44, 22] : 14);
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

function newCommandId() {
    return `cmd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getCommands(deviceIp) {
    try {
        const all = JSON.parse(localStorage.getItem('neoshell_commands') || '{}');
        const list = all[deviceIp] || [];
        let changed = false;
        list.forEach(cmd => {
            if (!cmd.id) { cmd.id = newCommandId(); changed = true; }
        });
        if (changed) {
            all[deviceIp] = list;
            localStorage.setItem('neoshell_commands', JSON.stringify(all));
        }
        return list;
    } catch { return []; }
}

function saveCommands(deviceIp, commands) {
    const all = JSON.parse(localStorage.getItem('neoshell_commands') || '{}');
    all[deviceIp] = commands;
    localStorage.setItem('neoshell_commands', JSON.stringify(all));
}

function openCommandsPage() {
    if (currentDeviceIndex === null) return;
    pushPage('commandsPage');
    renderCommands();
}

function closeCommandsPage() {
    popPage('commandsPage');
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
    list.innerHTML = currentCommands.map((cmd, i) => {
        const icon = cmd.icon || 'lightning';
        const iconHtml = /^[a-z0-9-]+$/.test(icon)
            ? `<i class="ph-light ph-${icon}"></i>`
            : icon;
        return `
        <div class="command-item" onclick="runCustomCommand(${i})" oncontextmenu="showCommandMenu(event, ${i}); return false;">
            <div class="command-icon">${iconHtml}</div>
            <div class="command-info">
                <div class="command-name">${escapeHtml(cmd.name)}</div>
                <div class="command-preview">${escapeHtml(cmd.commands[0] || '')}</div>
            </div>
            <button class="command-menu-btn" onclick="event.stopPropagation(); showCommandMenu(event, ${i})">
                <i class="ph-light ph-dots-three-vertical"></i>
            </button>
        </div>`;
    }).join('');
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
                const pins = getPins().filter(p => p.type !== 'command' || allCommands.some(c => c.id === p.id));
                savePins(pins);
                renderCommands();
                renderPinnedGrid();
                renderMiniWidgets();
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
    selectedCommandIcon = 'lightning';
    document.getElementById('commandDialogTitle').textContent = 'Новая команда';
    document.getElementById('cmdName').value = '';
    document.getElementById('cmdCommands').value = '';
    document.getElementById('cmdConfirm').checked = false;
    setCommandIconPicker(selectedCommandIcon);
    document.getElementById('addCommandDialog').classList.add('open');
}

function editCustomCommand(index) {
    editingCommandIndex = index;
    const cmd = currentCommands[index];
    if (!cmd) return;
    selectedCommandIcon = cmd.icon || 'lightning';
    document.getElementById('commandDialogTitle').textContent = 'Изменить команду';
    document.getElementById('cmdName').value = cmd.name;
    document.getElementById('cmdCommands').value = cmd.commands.join('\n');
    document.getElementById('cmdConfirm').checked = cmd.confirm || false;
    setCommandIconPicker(selectedCommandIcon);
    document.getElementById('addCommandDialog').classList.add('open');
}

function closeAddCommandDialog() {
    document.getElementById('addCommandDialog').classList.remove('open');
    editingCommandIndex = null;
}

function selectIcon(el) {
    const icon = el.dataset.icon || 'lightning';
    const picker = document.getElementById('iconPicker');
    if (picker) picker.querySelectorAll('.icon-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
    selectedCommandIcon = icon;
    haptic(8);
}

function setCommandIconPicker(icon) {
    const picker = document.getElementById('iconPicker');
    if (!picker) return;
    picker.querySelectorAll('.icon-option').forEach(o => {
        o.classList.toggle('selected', o.dataset.icon === icon);
    });
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
        const prev = allCommands[editingCommandIndex] || {};
        allCommands[editingCommandIndex] = { ...prev, id: prev.id || newCommandId(), name, icon: selectedCommandIcon, commands, confirm };
    } else {
        allCommands.push({ id: newCommandId(), name, icon: selectedCommandIcon, commands, confirm });
    }
    saveCommands(d.ip, allCommands);
    closeAddCommandDialog();
    renderCommands();
    renderPinnedGrid();
    renderMiniWidgets();
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
    editDeviceIcon = deviceIconName(d);
    setDeviceIconPicker('edit', editDeviceIcon);
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
    d.name = name; d.ip = ip; d.port = port; d.key = key; d.icon = editDeviceIcon;
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
    pushPage('appsPage');
    loadAppsPage();
}
function closeAppsPage() { popPage('appsPage'); }

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

function appKind(file) {
    const ext = String(file || '').split('.').pop().toLowerCase();
    if (ext === 'lnk') return { cls: 'lnk', label: 'LNK', icon: 'link-simple' };
    if (ext === 'url') return { cls: 'url', label: 'URL', icon: 'globe-simple' };
    if (ext === 'bat') return { cls: 'bat', label: 'BAT', icon: 'terminal-window' };
    return { cls: 'exe', label: 'EXE', icon: 'app-window' };
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
        const kind = appKind(file);
        return `
            <div class="app-tile ${kind.cls}" title="${escapeHtml(name)}" onclick="runApp('${escapeHtml(file).replace(/'/g, "\\'")}')">
                <span class="app-ico"><i class="ph-light ph-${kind.icon}"></i></span>
                <div class="name">${escapeHtml(name)}</div>
                <span class="app-kind">${kind.label}</span>
            </div>`;
    }).join('');
}

async function openAppsFolder() {
    if (currentDeviceIndex === null) return;
    const d = getDevices()[currentDeviceIndex];
    if (!d) return;
    try {
        const res = await fetch(`http://${d.ip}:${d.port}/api/open_apps_folder?key=${encodeURIComponent(d.key)}`, {
            method: 'POST', signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) throw new Error('open failed');
        showToast('Папка открыта на ПК', 'success');
    } catch {
        showToast('Не удалось открыть папку', 'error');
    }
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
    pushPage('settingsPage');
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
    popPage('settingsPage');
    showToast('Сохранено', 'success');
    if (s.notificationsEnabled) checkAndNotify();
    else hideNotification();
}

async function openAbout() {
    pushPage('aboutPage');
    loadGitHubStats();
}
function closeAbout() { popPage('aboutPage'); }

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