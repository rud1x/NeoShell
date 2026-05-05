#!/usr/bin/env python3
"""
NeoShell Configuration Tool
Run: python3 neoshell_config.py
"""

import os
import json
import sys
import secrets
import subprocess
import platform
from pathlib import Path

CONFIG_FILE = Path.home() / ".neoshell" / "config.json"
DEVICES_FILE = Path.home() / ".neoshell" / "devices.json"
LANG_FILE = Path.home() / ".neoshell" / "lang.txt"

# Yellow theme only
Y = '\033[93m'
G = '\033[92m'
R = '\033[91m'
C = '\033[96m'
RESET = '\033[0m'

def detect_language():
    if LANG_FILE.exists():
        with open(LANG_FILE) as f:
            return f.read().strip()
    try:
        lang = os.environ.get('LANG', 'en_US').split('.')[0].lower()
        if 'ru' in lang:
            return 'ru'
    except:
        pass
    return 'en'

def save_language(lang):
    with open(LANG_FILE, 'w') as f:
        f.write(lang)

def set_language():
    if not LANG_FILE.exists():
        print(f"\n  {C}Choose language / Выберите язык:{RESET}")
        print(f"    {Y}[1]{RESET} English")
        print(f"    {Y}[2]{RESET} Русский")
        choice = input(f"\n  {C}> {RESET}")
        if choice == "2":
            save_language('ru')
            return 'ru'
        else:
            save_language('en')
            return 'en'
    return detect_language()

TEXTS = {
    'en': {
        'status': 'Status',
        'server_running': 'Server is running',
        'server_stopped': 'Server is stopped',
        'auto_start_on': 'Auto-start is ENABLED',
        'auto_start_off': 'Auto-start is DISABLED',
        'service': 'SERVICE',
        'install': '1. Install Service (auto-start)',
        'remove': '2. Remove Service (disable auto-start)',
        'status_cmd': '3. Check Status',
        'settings': 'SETTINGS',
        'change_key': '4. Change Secret Key',
        'change_port': '5. Change Port',
        'change_path': '6. Change Apps Folder Path',
        'devices': 'DEVICES',
        'show_devices': '7. Show Trusted Devices',
        'remove_device': '8. Remove Trusted Device',
        'tools': 'TOOLS',
        'reset': '9. Reset All Settings',
        'server': '10. Start/Stop Server',
        'diagnostics': '11. Run Diagnostics',
        'exit': '0. Exit',
        'select': 'Select option (0-11)',
        'invalid': 'Invalid option',
        'goodbye': 'Goodbye!',
        'press_enter': 'Press Enter to continue...',
        'key_updated': 'Secret key updated',
        'port_updated': 'Port updated. Restart server to apply',
        'path_updated': 'Apps path updated',
        'reset_done': 'All settings reset to default',
        'reset_confirm': 'Type RESET to confirm',
        'reset_cancelled': 'Cancelled',
        'device_removed': 'Device removed',
        'no_devices': 'No trusted devices',
        'current_key': 'Current key',
        'new_key': 'New key (or Enter for random)',
        'current_port': 'Current port',
        'new_port': 'New port (1024-65535)',
        'current_path': 'Current path',
        'new_path': 'New path',
        'diagnostics_ok': 'All systems OK',
        'diagnostics_error': 'WSL detected - check /mnt/c/ access',
        'server_started': 'Server started in background',
        'server_stopped_msg': 'Server stopped',
        'server_not_found': 'Server script not found'
    },
    'ru': {
        'status': 'Статус',
        'server_running': 'Сервер запущен',
        'server_stopped': 'Сервер остановлен',
        'auto_start_on': 'Автозагрузка ВКЛЮЧЕНА',
        'auto_start_off': 'Автозагрузка ОТКЛЮЧЕНА',
        'service': 'СЕРВИС',
        'install': '1. Установить сервис (автозагрузка)',
        'remove': '2. Удалить сервис (отключить автозагрузку)',
        'status_cmd': '3. Проверить статус',
        'settings': 'НАСТРОЙКИ',
        'change_key': '4. Изменить секретный ключ',
        'change_port': '5. Изменить порт',
        'change_path': '6. Изменить путь к папке приложений',
        'devices': 'УСТРОЙСТВА',
        'show_devices': '7. Показать доверенные устройства',
        'remove_device': '8. Удалить доверенное устройство',
        'tools': 'ИНСТРУМЕНТЫ',
        'reset': '9. Сбросить все настройки',
        'server': '10. Запуск/Остановка сервера',
        'diagnostics': '11. Диагностика',
        'exit': '0. Выход',
        'select': 'Выберите опцию (0-11)',
        'invalid': 'Неверный выбор',
        'goodbye': 'До свидания!',
        'press_enter': 'Нажмите Enter для продолжения...',
        'key_updated': 'Секретный ключ обновлён',
        'port_updated': 'Порт обновлён. Перезапустите сервер',
        'path_updated': 'Путь к приложениям обновлён',
        'reset_done': 'Все настройки сброшены',
        'reset_confirm': 'Введите RESET для подтверждения',
        'reset_cancelled': 'Отменено',
        'device_removed': 'Устройство удалено',
        'no_devices': 'Нет доверенных устройств',
        'current_key': 'Текущий ключ',
        'new_key': 'Новый ключ (или Enter для random)',
        'current_port': 'Текущий порт',
        'new_port': 'Новый порт (1024-65535)',
        'current_path': 'Текущий путь',
        'new_path': 'Новый путь',
        'diagnostics_ok': 'Всё работает нормально',
        'diagnostics_error': 'Обнаружен WSL - проверьте доступ к /mnt/c/',
        'server_started': 'Сервер запущен в фоне',
        'server_stopped_msg': 'Сервер остановлен',
        'server_not_found': 'Скрипт сервера не найден'
    }
}

def get_text(key):
    lang = detect_language()
    return TEXTS.get(lang, TEXTS['en']).get(key, key)

def load_config():
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return json.load(f)
    return {
        "secret_key": secrets.token_hex(16),
        "port": 8000,
        "auto_start": True,
        "apps_path": "/mnt/c/Users/rudix/NeoShellApps",
        "theme": "dark"
    }

def save_config(config):
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2)

def load_devices():
    if DEVICES_FILE.exists():
        with open(DEVICES_FILE) as f:
            return json.load(f)
    return {"devices": [], "trusted_keys": []}

def save_devices(devices):
    with open(DEVICES_FILE, "w") as f:
        json.dump(devices, f, indent=2)

def clear_screen():
    os.system('clear' if os.name != 'nt' else 'cls')

def print_banner():
    print(f"{Y}")
    print("     __           __ _          _ _  ")
    print("  /\\ \\ \\___  ___ / _\\ |__   ___| | | ")
    print(" /  \\/ / _ \\/ _ \\\\ \\| '_ \\ / _ \\ | | ")
    print("/ /\\  /  __/ (_) |\\ \\ | | |  __/ | | ")
    print("\\_\\ \\/ \\___|\\___/\\__/_| |_|\\___|_|_| ")
    print(f"{RESET}")

def show_status(config):
    server_status = get_text('server_running') if is_server_running() else get_text('server_stopped')
    auto_status = get_text('auto_start_on') if config['auto_start'] else get_text('auto_start_off')
    print(f"\n  {Y}{get_text('status')}:{RESET} {server_status} | {auto_status}\n")

def is_server_running():
    result = subprocess.run("pgrep -f 'server.py'", shell=True, capture_output=True)
    return result.returncode == 0


def toggle_autostart(config, enable):
    config['auto_start'] = enable
    save_config(config)
    
    win_user = os.environ.get('USERNAME') or os.environ.get('USER') or "rudix"
    startup_dir = f"/mnt/c/Users/{win_user}/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
    vbs_path = f"{startup_dir}/NeoShell_Server.vbs"
    
    if enable:
        os.makedirs(startup_dir, exist_ok=True)
        with open(vbs_path, 'w') as f:
            f.write(f'''CreateObject("WScript.Shell").Run "wsl -d Debian -u {win_user} bash -c 'cd /home/{win_user}/.neoshell && ./start.sh'", 0, False
''')
        print(f"  {Y}✅ Автозагрузка добавлена (VBS){RESET}")
    else:
        if os.path.exists(vbs_path):
            os.remove(vbs_path)
            print(f"  {Y}✅ Автозагрузка удалена{RESET}")
    
    print(f"\n  {Y}{get_text('auto_start_on') if enable else get_text('auto_start_off')}{RESET}\n")

def change_secret_key(config):
    print(f"\n  {Y}{get_text('current_key')}:{RESET} {config['secret_key'][:20]}...")
    new_key = input(f"  {Y}{get_text('new_key')}:{RESET} ")
    if new_key:
        config['secret_key'] = new_key
    else:
        config['secret_key'] = secrets.token_hex(16)
    save_config(config)
    print(f"  {Y}{get_text('key_updated')}{RESET}\n")

def change_port(config):
    print(f"\n  {Y}{get_text('current_port')}:{RESET} {config['port']}")
    try:
        new_port = int(input(f"  {Y}{get_text('new_port')}:{RESET} "))
        if 1024 <= new_port <= 65535:
            config['port'] = new_port
            save_config(config)
            print(f"  {Y}{get_text('port_updated')}{RESET}\n")
        else:
            print(f"  {R}{get_text('invalid')}{RESET}\n")
    except:
        print(f"  {R}{get_text('invalid')}{RESET}\n")

def change_apps_path(config):
    print(f"\n  {Y}{get_text('current_path')}:{RESET} {config['apps_path']}")
    new_path = input(f"  {Y}{get_text('new_path')}:{RESET} ")
    if new_path:
        config['apps_path'] = new_path
        save_config(config)
        print(f"  {Y}{get_text('path_updated')}{RESET}\n")

def show_devices():
    devices = load_devices()
    print()
    if not devices["devices"]:
        print(f"  {Y}{get_text('no_devices')}{RESET}")
    else:
        for i, d in enumerate(devices["devices"], 1):
            print(f"  {i}. {d['ip']} - {d.get('first_seen', 'unknown')[:10]}")
    print()

def remove_device():
    devices = load_devices()
    if not devices["devices"]:
        print(f"\n  {Y}{get_text('no_devices')}{RESET}\n")
        return
    show_devices()
    try:
        num = int(input(f"  {Y}{get_text('remove_device')} (1-{len(devices['devices'])}) or 0: {RESET}"))
        if 1 <= num <= len(devices["devices"]):
            removed = devices["devices"].pop(num-1)
            save_devices(devices)
            print(f"  {Y}{get_text('device_removed')}: {removed['ip']}{RESET}\n")
        elif num == 0:
            print(f"  {Y}{get_text('reset_cancelled')}{RESET}\n")
        else:
            print(f"  {R}{get_text('invalid')}{RESET}\n")
    except:
        print(f"  {R}{get_text('invalid')}{RESET}\n")

def reset_all():
    print(f"\n  {R}{get_text('reset_confirm')}{RESET}")
    confirm = input(f"  {Y}> {RESET}")
    if confirm == "RESET":
        default_config = {
            "secret_key": secrets.token_hex(16),
            "port": 8000,
            "auto_start": True,
            "apps_path": "/mnt/c/Users/rudix/NeoShellApps",
            "theme": "dark"
        }
        save_config(default_config)
        save_devices({"devices": [], "trusted_keys": []})
        print(f"  {Y}{get_text('reset_done')}{RESET}\n")
    else:
        print(f"  {Y}{get_text('reset_cancelled')}{RESET}\n")

def manage_server():
    server_script = Path.home() / ".neoshell" / "web" / "server.py"
    if is_server_running():
        subprocess.run("pkill -f 'server.py'", shell=True)
        print(f"\n  {Y}{get_text('server_stopped_msg')}{RESET}\n")
    else:
        if server_script.exists():
            subprocess.Popen([sys.executable, str(server_script)], 
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print(f"\n  {Y}{get_text('server_started')}{RESET}\n")
        else:
            print(f"\n  {R}{get_text('server_not_found')}{RESET}\n")

def run_diagnostics():
    print(f"\n  {Y}DIAGNOSTICS{RESET}")
    config = load_config()
    print(f"    Config file: {G}OK{RESET}" if CONFIG_FILE.exists() else f"    Config file: {R}MISSING{RESET}")
    print(f"    Server: {G}Running{RESET}" if is_server_running() else f"    Server: {R}Stopped{RESET}")
    print(f"    Apps path: {G}Found{RESET}" if Path(config['apps_path']).exists() else f"    Apps path: {R}Not found{RESET}")
    wsl_detected = 'microsoft' in platform.uname().release.lower()
    print(f"    WSL: {G}Yes{RESET}" if wsl_detected else f"    WSL: {Y}No{RESET}")
    print()

def main():
    # Set language on first run
    if not LANG_FILE.exists():
        clear_screen()
        print_banner()
        set_language()
    
    while True:
        clear_screen()
        print_banner()
        config = load_config()
        show_status(config)
        
        print(f"  {Y}{get_text('service')}{RESET}")
        print(f"    {get_text('install')}")
        print(f"    {get_text('remove')}")
        print(f"    {get_text('status_cmd')}")
        print()
        print(f"  {Y}{get_text('settings')}{RESET}")
        print(f"    {get_text('change_key')}")
        print(f"    {get_text('change_port')}")
        print(f"    {get_text('change_path')}")
        print()
        print(f"  {Y}{get_text('devices')}{RESET}")
        print(f"    {get_text('show_devices')}")
        print(f"    {get_text('remove_device')}")
        print()
        print(f"  {Y}{get_text('tools')}{RESET}")
        print(f"    {get_text('reset')}")
        print(f"    {get_text('server')}")
        print(f"    {get_text('diagnostics')}")
        print()
        print(f"    {get_text('exit')}")
        print()
        
        choice = input(f"  {Y}{get_text('select')}: {RESET}")
        
        if choice == "1":
            toggle_autostart(config, True)
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "2":
            toggle_autostart(config, False)
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "3":
            print(f"\n  {Y}{get_text('server_running') if is_server_running() else get_text('server_stopped')}{RESET}")
            print(f"  {Y}{get_text('auto_start_on') if config['auto_start'] else get_text('auto_start_off')}{RESET}\n")
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "4":
            change_secret_key(config)
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "5":
            change_port(config)
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "6":
            change_apps_path(config)
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "7":
            clear_screen()
            print_banner()
            show_devices()
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "8":
            remove_device()
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "9":
            reset_all()
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "10":
            manage_server()
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "11":
            run_diagnostics()
            input(f"  {Y}{get_text('press_enter')}{RESET}")
        elif choice == "0":
            print(f"\n  {Y}{get_text('goodbye')}{RESET}\n")
            break
        else:
            print(f"\n  {R}{get_text('invalid')}{RESET}\n")
            input(f"  {Y}{get_text('press_enter')}{RESET}")

if __name__ == "__main__":
    main()
