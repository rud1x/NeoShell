let currentKey = '';
const BASE = window.location.origin;
let pingInterval = null;

function showToast(msg, isError) {
    const t = document.getElementById('toast');
    t.innerHTML = msg;
    t.style.display = 'block';
    t.style.borderLeftColor = isError ? '#ff4444' : '#ffcc00';
    setTimeout(() => { t.style.display = 'none'; }, 2000);
}

async function connect() {
    currentKey = document.getElementById('secretKey').value;
    if (!currentKey) { showToast('Enter key!', true); return; }
    
    try {
        const res = await fetch(`${BASE}/api/status?key=${currentKey}`);
        if (res.ok) {
            localStorage.setItem('neoshell_key', currentKey);
            document.getElementById('loginPanel').style.display = 'none';
            document.getElementById('mainPanel').classList.remove('hidden');
            showToast('Connected!');
            loadApps();
            startPing();
            checkPWA();
        } else if (res.status === 403) {
            const error = document.getElementById('errorMsg');
            error.textContent = 'Too many failed attempts. Try again later.';
            error.classList.remove('hidden');
        } else {
            showToast('Invalid key', true);
        }
    } catch(e) {
        showToast('Connection failed', true);
    }
}

async function sendApi(action) {
    if (!currentKey) return;
    showToast('Executing...');
    try {
        const res = await fetch(`${BASE}/api/${action}?key=${currentKey}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('Done!');
            if (action === 'shutdown' || action === 'reboot') {
                setTimeout(() => { location.reload(); }, 3000);
            }
        } else {
            showToast('Error', true);
        }
    } catch(e) {
        showToast('Error', true);
    }
}

async function openBrowser() {
    if (!currentKey) return;
    const query = document.getElementById('urlInput').value.trim();
    if (!query) { showToast('Enter URL or search query', true); return; }
    
    showToast('Opening...');
    try {
        await fetch(`${BASE}/api/open_browser?query=${encodeURIComponent(query)}&key=${currentKey}`, { method: 'POST' });
        showToast('Opened!');
        document.getElementById('urlInput').value = '';
    } catch(e) {
        showToast('Error', true);
    }
}

async function loadApps() {
    const grid = document.getElementById('appsGrid');
    grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; color:#ffcc00;">Loading...</div>';
    
    try {
        const res = await fetch(`${BASE}/api/apps?key=${currentKey}`);
        const data = await res.json();
        
        if (!data.apps || data.apps.length === 0) {
            grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; color:#888;">No apps found</div>';
            return;
        }
        
        grid.innerHTML = '';
        data.apps.forEach(app => {
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
            
            tile.innerHTML = `<i class="${icon}"></i><div class="app-name">${escapeHtml(app.name)}</div>`;
            tile.onclick = () => runApp(app.file);
            grid.appendChild(tile);
        });
    } catch(e) {
        grid.innerHTML = '<div style="text-align:center; grid-column:1/-1; color:#f44;">Failed to load</div>';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function runApp(filename) {
    if (!currentKey) return;
    showToast('Launching...');
    try {
        const res = await fetch(`${BASE}/api/run/${encodeURIComponent(filename)}?key=${currentKey}`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showToast('Launched!');
        } else {
            showToast('Failed', true);
        }
    } catch(e) {
        showToast('Error', true);
    }
}

async function updatePing() {
    if (!currentKey) return;
    try {
        const res = await fetch(`${BASE}/api/ping?key=${currentKey}`);
        const data = await res.json();
        const dot = document.getElementById('onlineDot');
        const text = document.getElementById('pingText');
        
        dot.className = 'online-dot online';
        text.innerHTML = 'PC ACCESSIBLE';
        
    } catch(e) {
        document.getElementById('onlineDot').className = 'online-dot offline';
        document.getElementById('pingText').innerHTML = '● ERROR';
    }
}

function startPing() {
    updatePing();
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(updatePing, 5000);
}

function checkPWA() {
    if (window.matchMedia('(display-mode: standalone)').matches) {
        document.getElementById('installHint').classList.add('hidden');
    } else {
        document.getElementById('installHint').classList.remove('hidden');
    }
}

const savedKey = localStorage.getItem('neoshell_key');
if (savedKey) {
    document.getElementById('secretKey').value = savedKey;
    connect();
}


async function sendApiWithConfirm(action, message) {
    if (!currentKey) return;
    if (confirm(message)) {
        await sendApi(action);
    }
}