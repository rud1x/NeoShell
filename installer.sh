#!/bin/bash
# ============================================
# NeoShell Installer for WSL (Fixed)
# Более надежная версия с проверкой ошибок
# ============================================

# Прерываем скрипт при любой ошибке
set -e

# Цвета для красивого вывода
Y='\033[1;93m'
G='\033[1;92m'
R='\033[1;91m'
C='\033[1;96m'
RST='\033[0m'

# Баннер
clear
echo -e "${Y}"
echo "     __           __ _          _ _  "
echo "  /\ \ \___  ___ / _\ |__   ___| | | "
echo " /  \/ / _ \/ _ \\\\ \| '_ \ / _ \ | | "
echo "/ /\  /  __/ (_) |\ \ | | |  __/ | | "
echo "\_\ \/ \___|\___/\__/_| |_|\___|_|_| "
echo -e "${RST}\n"

# Функция для печати с анимацией (только для обычного текста)
type_animation() {
    local text="$1"
    local delay="${2:-0.03}"
    for ((i=0; i<${#text}; i++)); do
        echo -n "${text:$i:1}"
        sleep "$delay"
    done
    echo
}

# Приветствие
type_animation "rudix: Привет! Сейчас я помогу установить NeoShell на твой ПК." 0.04
sleep 0.5
type_animation "rudix: Это займёт пару минут. Поехали!" 0.04
sleep 1
echo ""

# Определение переменных (с резервными значениями)
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r' | tr -d '\n')
[ -z "$WIN_USER" ] && WIN_USER=$(whoami)

WSL_DISTRO=$(wsl.exe -l -q 2>/dev/null | head -1 | tr -d '\r')
[ -z "$WSL_DISTRO" ] && WSL_DISTRO="Debian"

REPO_URL="https://raw.githubusercontent.com/rud1x/NeoShell/main"

# Правильный локальный IP
REAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '10.' | grep -v '26.' | head -1)
[ -z "$REAL_IP" ] && REAL_IP="192.168.1.21"

# --- 1. Структура ---
echo -e "${C}[1/7]${RST} Создание структуры проекта..."
mkdir -p ~/.neoshell/web/static
mkdir -p ~/.neoshell/logs
echo -e "   ${G}✓${RST}"

# --- 2. Ключ ---
echo -e "${C}[2/7]${RST} Генерация секретного ключа..."
SECRET_KEY=$(openssl rand -hex 16)
cat > ~/.neoshell/config.json << EOF
{
    "secret_key": "$SECRET_KEY",
    "port": 8000,
    "auto_start": true,
    "apps_path": "C:\\Users\\$WIN_USER\\NeoShellApps"
}
EOF
echo -e "   ${G}✓${RST} Ключ: ${Y}$SECRET_KEY${RST}"
sleep 0.3

# --- 3. Папка с ярлыками ---
echo -e "${C}[3/7]${RST} Создание папки для ярлыков..."
APPS_WIN_PATH="C:\\Users\\$WIN_USER\\NeoShellApps"
APPS_WSL_PATH="/mnt/c/Users/$WIN_USER/NeoShellApps"
mkdir -p "$APPS_WSL_PATH"
echo -e "   ${G}✓${RST} Папка: ${Y}$APPS_WIN_PATH${RST}"
sleep 0.3

# --- 4. Установка зависимостей (самое проблемное место) ---
echo -e "${C}[4/7]${RST} Установка зависимостей..."
# Функция для установки пакета через pip с обходом ошибок
install_pip_pkg() {
    local pkg=$1
    echo -e "     ${C}Установка $pkg...${RST}"
    
    # Пробуем стандартную установку
    if pip3 install "$pkg" --break-system-packages -q 2>/dev/null; then
        return 0
    fi
    
    # Если не получилось, создаем venv и ставим там
    echo -e "     ${Y}⚠️ Проблема с глобальной установкой, пробуем через venv...${RST}"
    cd ~/.neoshell
    python3 -m venv venv
    source venv/bin/activate
    pip install "$pkg" -q
    deactivate
    cd - > /dev/null
}

install_pip_pkg "fastapi"
install_pip_pkg "uvicorn"

echo -e "   ${G}✓${RST}"

# --- 5. Скачивание файлов с GitHub ---
echo -e "${C}[5/8]${RST} Скачивание файлов сервера с GitHub..."

# Функция для загрузки файла с проверкой
download_file() {
    local url="$1"
    local output="$2"
    echo -e "     Загрузка $(basename $output)..."
    curl -L --fail --silent --show-error "$url" -o "$output"
}

mkdir -p ~/.neoshell/web/static
download_file "$REPO_URL/web/server.py" ~/.neoshell/web/server.py
download_file "$REPO_URL/web/static/index.html" ~/.neoshell/web/static/index.html
download_file "$REPO_URL/web/static/style.css" ~/.neoshell/web/static/style.css
download_file "$REPO_URL/web/static/script.js" ~/.neoshell/web/static/script.js
download_file "$REPO_URL/neoshell_config.py" ~/.neoshell/neoshell_config.py

echo -e "   ${G}✓${RST} Файлы загружены"
sleep 0.3

# --- 6. Автозагрузка ---
echo -e "${C}[6/8]${RST} Настройка автозагрузки..."

WIN_STARTUP="/mnt/c/Users/$WIN_USER/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
mkdir -p "$WIN_STARTUP"

# Создаём VBS скрипт для автозагрузки
cat > "$WIN_STARTUP/NeoShell_Server.vbs" << EOF
CreateObject("WScript.Shell").Run "wsl -d $WSL_DISTRO -u $WIN_USER bash -c 'cd /home/$WIN_USER/.neoshell/web && nohup python3 server.py > ../logs/server.log 2>&1 &'", 0, False
EOF

# Создаём start.sh для ручного запуска
mkdir -p ~/.neoshell
cat > ~/.neoshell/start.sh << 'STARTEOF'
#!/bin/bash
CONFIG_FILE="$HOME/.neoshell/config.json"
PORT=$(grep -o '"port": [0-9]*' "$CONFIG_FILE" | awk '{print $2}')
[ -z "$PORT" ] && PORT=8000
sudo fuser -k $PORT/tcp 2>/dev/null
sleep 1
cd ~/.neoshell/web
nohup python3 server.py > ../logs/server.log 2>&1 &
echo "NeoShell server started on port $PORT"
STARTEOF
chmod +x ~/.neoshell/start.sh

echo -e "   ${G}✓${RST}"

# --- 7. Права для fuser ---
echo -e "${C}[7/8]${RST} Настройка прав (sudo для fuser)..."
sudoers_file="/etc/sudoers.d/neoshell"
echo "$WIN_USER ALL=(ALL) NOPASSWD: /usr/bin/fuser" | sudo tee "$sudoers_file" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "   ${G}✓${RST}"
else
    echo -e "   ${Y}⚠️ Не удалось настроить sudo. Вам может потребоваться вводить пароль при запуске.${RST}"
fi

# --- 8. Создание псевдонима (alias) ---
echo -e "${C}[8/8]${RST} Создание алиаса 'neoshell'..."
if ! grep -q "alias neoshell=" ~/.bashrc 2>/dev/null; then
    echo "alias neoshell='cd ~/.neoshell/web && python3 server.py'" >> ~/.bashrc
    echo -e "   ${G}✓${RST} Алиас добавлен. Используйте 'neoshell' для запуска."
else
    echo -e "   ${Y}⚠️ Алиас уже существует.${RST}"
fi

echo ""
echo -e "${G}════════════════════════════════════════════════════════════${RST}"
echo -e "${G}✅ УСТАНОВКА ЗАВЕРШЕНА!${RST}"
echo -e "${G}════════════════════════════════════════════════════════════${RST}"
echo ""

# --- Финальная инструкция ---
echo -e "${C}🧩 ЧТО ДАЛЬШЕ?${RST}"
echo ""
echo -e "${Y}1. ЗАПУСТИТЕ СЕРВЕР:${RST}"
echo -e "   ${C}cd ~/.neoshell/web && python3 server.py${RST}"
echo ""
echo -e "${Y}2. ПОДКЛЮЧИТЕСЬ С ТЕЛЕФОНА:${RST}"
echo -e "   Откройте браузер и перейдите по адресу: ${C}http://$REAL_IP:8000${RST}"
echo -e "   🔑 Секретный ключ: ${C}$SECRET_KEY${RST}"
echo ""
echo -e "${Y}3. ДОБАВЬТЕ ЯРЛЫКИ:${RST}"
echo -e "   Положите .lnk или .url файлы в папку: ${C}$APPS_WIN_PATH${RST}"
echo ""
echo -e "${Y}4. АВТОЗАГРУЗКА:${RST}"
echo -e "   Сервер будет автоматически запускаться при старте Windows."
echo ""
echo -e "${G}🚀 Удачного использования!${RST}"
echo ""
