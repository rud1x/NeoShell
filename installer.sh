#!/bin/bash
# ============================================
# NeoShell Installer for WSL
# Устанавливает NeoShell из GitHub репозитория
# ============================================

# Проверка запуска из WSL
if ! grep -qi microsoft /proc/version && ! grep -qi wsl /proc/version; then
    echo -e "\033[91m❌ Этот скрипт должен запускаться в WSL!\033[0m"
    exit 1
fi

# Цвета
Y='\033[93m'
G='\033[92m'
R='\033[91m'
C='\033[96m'
RST='\033[0m'

# Баннер
echo -e "${Y}"
echo "     __           __ _          _ _  "
echo "  /\ \ \___  ___ / _\ |__   ___| | | "
echo " /  \/ / _ \/ _ \\\\ \| '_ \ / _ \ | | "
echo "/ /\  /  __/ (_) |\ \ | | |  __/ | | "
echo "\_\ \/ \___|\___/\__/_| |_|\___|_|_| "
echo -e "${RST}\n"

echo "rudix: Привет! Сейчас я помогу установить NeoShell на твой ПК."
echo "rudix: Это займёт пару минут. Поехали!"
echo ""

# Определение переменных
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r' | tr -d '\n')
[ -z "$WIN_USER" ] && WIN_USER=$(whoami)

WSL_DISTRO=$(wsl.exe -l -q 2>/dev/null | head -1 | tr -d '\r')
[ -z "$WSL_DISTRO" ] && WSL_DISTRO="Debian"

REPO_URL="https://raw.githubusercontent.com/rud1x/NeoShell/main"

# Правильный локальный IP
REAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '10.' | grep -v '26.' | head -1)
[ -z "$REAL_IP" ] && REAL_IP="192.168.1.21"

# Шаг 1
echo -e "${C}[1/7]${RST} Создание структуры проекта..."
mkdir -p ~/.neoshell/web/static
mkdir -p ~/.neoshell/logs
echo -e "   ${G}✓${RST} Папки созданы"

# Шаг 2
echo -e "${C}[2/7]${RST} Генерация секретного ключа..."
if [ -f ~/.neoshell/config.json ]; then
    SECRET_KEY=$(grep -o '"secret_key": "[^"]*"' ~/.neoshell/config.json | cut -d'"' -f4)
    echo -e "   ${Y}⚠${RST} Конфиг уже существует, ключ: ${Y}$SECRET_KEY${RST}"
else
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
fi

# Шаг 3
echo -e "${C}[3/7]${RST} Создание папки для ярлыков..."
APPS_DIR="C:\\Users\\$WIN_USER\\NeoShellApps"
mkdir -p "/mnt/c/Users/$WIN_USER/NeoShellApps"
echo -e "   ${G}✓${RST} Папка: ${Y}$APPS_DIR${RST}"

# Шаг 4
echo -e "${C}[4/7]${RST} Установка зависимостей..."
if ! command -v pip3 &> /dev/null; then
    sudo apt update -qq && sudo apt install python3-pip -y -qq
fi

pip3 install fastapi uvicorn -q 2>/dev/null || true
echo -e "   ${G}✓${RST} Зависимости установлены"

# Шаг 5
echo -e "${C}[5/7]${RST} Скачивание файлов сервера..."
curl -sL "$REPO_URL/web/server.py" -o ~/.neoshell/web/server.py
curl -sL "$REPO_URL/web/static/index.html" -o ~/.neoshell/web/static/index.html
curl -sL "$REPO_URL/web/static/style.css" -o ~/.neoshell/web/static/style.css
curl -sL "$REPO_URL/web/static/script.js" -o ~/.neoshell/web/static/script.js
curl -sL "$REPO_URL/neoshell_config.py" -o ~/.neoshell/neoshell_config.py
echo -e "   ${G}✓${RST} Файлы загружены"

# Шаг 6
echo -e "${C}[6/7]${RST} Настройка автозагрузки..."
WIN_STARTUP="/mnt/c/Users/$WIN_USER/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
mkdir -p "$WIN_STARTUP"

cat > "$WIN_STARTUP/NeoShell_Server.vbs" << EOF
CreateObject("WScript.Shell").Run "wsl -d $WSL_DISTRO -u $WIN_USER bash -c 'cd /home/$WIN_USER/.neoshell/web && nohup python3 server.py > ../logs/server.log 2>&1 &'", 0, False
EOF

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
echo -e "   ${G}✓${RST} Автозагрузка настроена"

# Шаг 7
echo -e "${C}[7/7]${RST} Настройка sudo для fuser..."
echo "$WIN_USER ALL=(ALL) NOPASSWD: /usr/bin/fuser" | sudo tee /etc/sudoers.d/neoshell > /dev/null 2>&1
echo -e "   ${G}✓${RST} Готово"

echo ""
echo -e "${G}════════════════════════════════════════════════════════════${RST}"
echo -e "${G}✅ УСТАНОВКА ЗАВЕРШЕНА!${RST}"
echo -e "${G}════════════════════════════════════════════════════════════${RST}"
echo ""

# Финальные инструкции
echo -e "${Y}📌 ЧТО ДАЛЬШЕ:${RST}"
echo ""
echo -e "1️⃣  ${G}Запусти сервер:${RST}"
echo -e "   ${Y}cd ~/.neoshell/web && python3 server.py${RST}"
echo ""
echo -e "2️⃣  ${G}Подключись с телефона:${RST}"
echo -e "   ${Y}http://$REAL_IP:8000${RST}"
echo -e "   Ключ: ${Y}$SECRET_KEY${RST}"
echo ""
echo -e "3️⃣  ${G}Добавляй ярлыки в папку:${RST}"
echo -e "   ${Y}C:\\Users\\$WIN_USER\\NeoShellApps${RST}"
echo ""
echo -e "4️⃣  ${G}Сервер в автозагрузке Windows${RST}"
echo ""
echo -e "${G}🚀 Удачного использования!${RST}"
