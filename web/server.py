#!/usr/bin/env python3
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
import subprocess
import os
import json
import socket
import time
import urllib.parse
from datetime import datetime
from pathlib import Path

app = FastAPI(title="NeoShell API")
app.mount("/static", StaticFiles(directory="static"), name="static")

CONFIG_FILE = Path.home() / ".neoshell" / "config.json"

# Загружаем конфиг или создаём по умолчанию
if not CONFIG_FILE.exists():
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w") as f:
        json.dump({"secret_key": "1234", "port": 8000, "auto_start": True}, f)

with open(CONFIG_FILE) as f:
    config = json.load(f)

SECRET_KEY = config.get("secret_key", "1234")
PORT = config.get("port", 8000)
WIN_USER = os.environ.get("USERNAME") or os.environ.get("USER") or "rudix"
DEFAULT_APPS_PATH = f"/mnt/c/Users/{WIN_USER}/NeoShellApps"
APPS_DIR = config.get("apps_path", DEFAULT_APPS_PATH)
Path(APPS_DIR).mkdir(parents=True, exist_ok=True)

FAILED_ATTEMPTS_FILE = Path.home() / ".neoshell" / "failed_attempts.json"
BLOCK_DURATION = 300

# ========== ФУНКЦИИ ОЧИСТКИ ПОРТА ==========
def kill_process_on_port(port):
    """Жёстко убивает процесс, занимающий порт"""
    try:
        # Через fuser
        subprocess.run(f"sudo fuser -k {port}/tcp 2>/dev/null", shell=True)
        # Через lsof (альтернатива)
        result = subprocess.run(f"sudo lsof -t -i:{port}", shell=True, capture_output=True, text=True)
        if result.stdout.strip():
            for pid in result.stdout.strip().split():
                subprocess.run(f"sudo kill -9 {pid}", shell=True)
        return True
    except:
        return False

def clean_portproxy(port):
    """Удаляет проброс порта в Windows"""
    try:
        subprocess.run(f'powershell.exe -Command "netsh interface portproxy delete v4tov4 listenport={port} listenaddress=0.0.0.0"', 
                      shell=True, capture_output=True)
        return True
    except:
        return False

# ========== ОСТАЛЬНЫЕ ФУНКЦИИ ==========
def load_failed_attempts():
    if FAILED_ATTEMPTS_FILE.exists():
        with open(FAILED_ATTEMPTS_FILE) as f:
            return json.load(f)
    return {"count": 0, "blocked_until": 0}

def save_failed_attempts(data):
    with open(FAILED_ATTEMPTS_FILE, "w") as f:
        json.dump(data, f)

def is_blocked():
    data = load_failed_attempts()
    if data["blocked_until"] > time.time():
        return True, data["blocked_until"] - time.time()
    return False, 0

def record_failed_attempt():
    data = load_failed_attempts()
    data["count"] += 1
    if data["count"] >= 3:
        data["blocked_until"] = time.time() + BLOCK_DURATION
        data["count"] = 0
    save_failed_attempts(data)

def reset_failed_attempts():
    save_failed_attempts({"count": 0, "blocked_until": 0})

def run_cmd(cmd):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return {"success": r.returncode == 0, "output": r.stdout.strip()}
    except subprocess.TimeoutExpired:
        return {"success": False, "output": "Command timeout"}
    except Exception as e:
        return {"success": False, "output": str(e)}

def check_key(key):
    blocked, remaining = is_blocked()
    if blocked:
        raise HTTPException(status_code=403, detail=f"Blocked for {int(remaining)} seconds")
    if key != SECRET_KEY:
        record_failed_attempt()
        raise HTTPException(status_code=401, detail="Invalid key")
    reset_failed_attempts()
    return True

def get_ping_status():
    result = run_cmd("ping -c 1 -W 2 192.168.1.21 2>/dev/null | grep '1 received'")
    return result["success"] and "1 received" in result["output"]

# ========== API ENDPOINTS ==========
@app.get("/api/status")
async def status(key: str):
    check_key(key)
    return {"status": "online", "time": datetime.now().isoformat()}

@app.get("/api/ping")
async def ping_pc(key: str):
    check_key(key)
    return {"online": get_ping_status(), "ip": "192.168.1.21"}

@app.post("/api/lock")
async def lock(key: str):
    check_key(key)
    run_cmd('rundll32.exe user32.dll,LockWorkStation')
    return {"success": True}

@app.post("/api/sleep")
async def sleep(key: str):
    check_key(key)
    run_cmd('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')
    return {"success": True}

@app.post("/api/shutdown")
async def shutdown(key: str):
    check_key(key)
    run_cmd('shutdown /s /t 10')
    return {"success": True}

@app.post("/api/reboot")
async def reboot(key: str):
    check_key(key)
    run_cmd('shutdown /r /t 10')
    return {"success": True}

@app.post("/api/minimize_all")
async def minimize_all(key: str):
    check_key(key)
    run_cmd('cmd.exe /c powershell -c "(New-Object -ComObject Shell.Application).minimizeall()"')
    return {"success": True}

@app.post("/api/task_manager")
async def task_manager(key: str):
    check_key(key)
    run_cmd('cmd.exe /c start taskmgr')
    return {"success": True}

@app.post("/api/close_app")
async def close_app(key: str):
    check_key(key)
    run_cmd('cmd.exe /c powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(\'%{F4}\')"')
    return {"success": True}

@app.post("/api/open_browser")
async def open_browser(query: str, key: str):
    check_key(key)
    query = urllib.parse.unquote(query)
    if query.startswith(('http://', 'https://')):
        run_cmd(f'cmd.exe /c start "{query}"')
    else:
        encoded = urllib.parse.quote_plus(query)
        run_cmd(f'cmd.exe /c start "https://www.google.com/search?q={encoded}"')
    return {"success": True}

@app.get("/api/apps")
async def list_apps(key: str):
    check_key(key)
    apps = []
    apps_path = Path(APPS_DIR)
    if apps_path.exists():
        for f in apps_path.iterdir():
            if f.suffix.lower() in ['.lnk', '.url', '.exe', '.bat']:
                apps.append({"name": f.stem, "file": f.name})
    else:
        apps_path.mkdir(parents=True, exist_ok=True)
    return {"apps": sorted(apps, key=lambda x: x["name"]), "path": str(apps_path)}

@app.post("/api/run/{filename}")
async def run_app(filename: str, key: str):
    check_key(key)
    path = Path(APPS_DIR) / filename
    if not path.exists():
        return {"success": False, "error": f"File not found: {filename}"}
    win_path = str(path).replace("/mnt/c/", "C:/").replace("/", "\\")
    result = run_cmd(f'cmd.exe /c start "" "{win_path}"')
    return result

@app.get("/manifest.json")
async def manifest():
    return JSONResponse(content={
        "name": "NeoShell",
        "short_name": "NeoShell",
        "description": "Remote PC Control",
        "start_url": "/",
        "display": "standalone",
        "theme_color": "#ffcc00",
        "background_color": "#0a0a0a",
        "icons": [
            {"src": "/static/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/static/icon-512.png", "sizes": "512x512", "type": "image/png"}
        ]
    })

@app.get("/static/icon-192.png")
async def icon_192():
    icon_path = Path(__file__).parent / "static" / "icon-192.png"
    if icon_path.exists():
        return FileResponse(icon_path)
    return JSONResponse(status_code=404, content={"error": "Icon not found"})

@app.get("/static/icon-512.png")
async def icon_512():
    icon_path = Path(__file__).parent / "static" / "icon-512.png"
    if icon_path.exists():
        return FileResponse(icon_path)
    return JSONResponse(status_code=404, content={"error": "Icon not found"})

@app.get("/")
async def index():
    index_path = Path(__file__).parent / "static" / "index.html"
    if index_path.exists():
        with open(index_path) as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>NeoShell</h1><p>Installation incomplete. Please check static files.</p>", status_code=500)

# ========== ЗАПУСК СЕРВЕРА ==========
if __name__ == "__main__":
    import uvicorn
    
    # 1. ОЧИСТКА ПОРТА ПЕРЕД ЗАПУСКОМ
    print(f"\n[NeoShell] Очистка порта {PORT}...")
    kill_process_on_port(PORT)
    clean_portproxy(PORT)
    time.sleep(1)
    
    # 2. ПОЛУЧАЕМ IP
    try:
        ip = socket.gethostbyname(socket.gethostname())
        if ip.startswith('127.'):
            result = subprocess.run("ip route get 1 | awk '{print $NF;exit}'", shell=True, capture_output=True, text=True)
            if result.returncode == 0 and result.stdout.strip():
                ip = result.stdout.strip()
    except:
        ip = "192.168.1.21"
    
    print("\n" + "="*50)
    print("  NeoShell Server Started")
    print("="*50)
    print(f"  URL: http://{ip}:{PORT}")
    print(f"  Key: {SECRET_KEY}")
    print(f"  Port: {PORT}")
    print(f"  Apps Path: {APPS_DIR}")
    print("="*50 + "\n")
    
    # 3. ЗАПУСК UVICORN С SO_REUSEADDR
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=PORT,
        log_level="warning",
        # Эти параметры помогают с портами
        loop="asyncio",
        limit_concurrency=10,
        timeout_keep_alive=5
    )
