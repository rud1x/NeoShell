#!/bin/bash
# ============================================
# NeoShell Installer for WSL
# ============================================

set -e

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
clear
echo -e "${Y}"
echo "     __           __ _          _ _  "
echo "  /\ \ \___  ___ / _\ |__   ___| | | "
echo " /  \/ / _ \/ _ \\\\ \| '_ \ / _ \ | | "
echo "/ /\  /  __/ (_) |\ \ | | |  __/ | | "
echo "\_\ \/ \___|\___/\__/_| |_|\___|_|_| "
echo -e "${RST}\n"

# Функция анимации печати
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

# Определение переменных
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r' | tr -d '\n')
[ -z "$WIN_USER" ] && WIN_USER=$(whoami)

WSL_DISTRO=$(wsl.exe -l -q 2>/dev/null | head -1 | tr -d '\r')
[ -z "$WSL_DISTRO" ] && WSL_DISTRO="Debian"

# Правильный локальный IP (192.168.x.x)
REAL_IP=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '10.' | grep -v '26.' | head -1)
[ -z "$REAL_IP" ] && REAL_IP="192.168.1.21"

# Шаг 1
echo -e "${C}[1/7]${RST} Создание структуры проекта..."
mkdir -p ~/.neoshell/web/static
mkdir -p ~/.neoshell/logs
echo -e "   ${G}✓${RST} Папки созданы"
sleep 0.3

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
sleep 0.3

# Шаг 3
echo -e "${C}[3/7]${RST} Создание папки для ярлыков..."
APPS_DIR="C:\\Users\\$WIN_USER\\NeoShellApps"
mkdir -p "/mnt/c/Users/$WIN_USER/NeoShellApps"
echo -e "   ${G}✓${RST} Папка: ${Y}$APPS_DIR${RST}"
sleep 0.3

# Шаг 4
echo -e "${C}[4/7]${RST} Установка зависимостей..."
if ! command -v pip3 &> /dev/null; then
    sudo apt update -qq && sudo apt install python3-pip -y -qq
fi

is_pip_installed() {
    python3 -c "import $1" 2>/dev/null && return 0 || return 1
}

if is_pip_installed fastapi; then
    echo -e "   ${Y}⚠${RST} FastAPI уже установлен"
else
    pip3 install fastapi --break-system-packages -q
    echo -e "   ${G}✓${RST} FastAPI установлен"
fi

if is_pip_installed uvicorn; then
    echo -e "   ${Y}⚠${RST} Uvicorn уже установлен"
else
    pip3 install uvicorn --break-system-packages -q
    echo -e "   ${G}✓${RST} Uvicorn установлен"
fi
sleep 0.3

# Шаг 5 - Создание скрипта автозагрузки Windows
echo -e "${C}[5/7]${RST} Создание скрипта автозагрузки Windows..."

WIN_STARTUP="/mnt/c/Users/$WIN_USER/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup"
mkdir -p "$WIN_STARTUP"

# Создаём VBS скрипт
cat > "$WIN_STARTUP/NeoShell_Server.vbs" << EOF
CreateObject("WScript.Shell").Run "wsl -d $WSL_DISTRO -u $WIN_USER bash -c 'cd /home/$WIN_USER/.neoshell/web && nohup python3 server.py > ../logs/server.log 2>&1 &'", 0, False
EOF

# Удаляем старый BAT файл, если есть
rm -f "$WIN_STARTUP/NeoShell_Server.bat" 2>/dev/null

echo -e "   ${G}✓${RST} VBS скрипт автозагрузки создан"
sleep 0.3

# Шаг 6
echo -e "${C}[6/7]${RST} Создание start.sh..."
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
echo -e "   ${G}✓${RST} start.sh создан"
sleep 0.3

# Шаг 7
echo -e "${C}[7/7]${RST} Настройка sudo для fuser..."
echo "$WIN_USER ALL=(ALL) NOPASSWD: /usr/bin/fuser" | sudo tee /etc/sudoers.d/neoshell > /dev/null 2>&1
echo -e "   ${G}✓${RST} Готово""   ${G}✓${RST} Готово"

echo ""
echo -e "${G}════════════════════════════════════════════════════════════${RST}"
echo -e "${G}✅ УСТАНОВКА ЗАВЕРШЕНА!${RST}"
echo -e "${G}════════════════════════════════════════════════════════════${RST}"
echo ""

# Очищаем консоль и показываем баннер снова
sleep 2
clear
echo -e "${Y}"
echo "     __           __ _          _ _  "
echo "  /\ \ \___  ___ / _\ |__   ___| | | "
echo " /  \/ / _ \/ _ \\\\ \| '_ \ / _ \ | | "
echo "/ /\  /  __/ (_) |\ \ | | |  __/ | | "
echo "\_\ \/ \___|\___/\__/_| |_|\___|_|_| "
echo -e "${RST}\n"

# Диалог с объяснением
type_animation "rudix: Всё установлено! Теперь расскажу, что делать дальше." 0.04
sleep 1
echo ""

type_animation "rudix: 1. ЗАПУСТИТЬ СЕРВЕР" 0.04
type_animation "    Выполни команду в этом окне:" 0.03
echo ""
echo -e "       ${Y}cd ~/.neoshell/web && python3 server.py${RST}"
echo ""
type_animation "    Сервер начнёт работу. Не закрывай это окно!" 0.03
sleep 1
echo ""

type_animation "rudix: 2. ПОДКЛЮЧИТЬСЯ С ТЕЛЕФОНА" 0.04
type_animation "    Открой браузер на телефоне и введи:" 0.03
echo ""
echo -e "       ${Y}http://$REAL_IP:8000${RST}"
echo ""
type_animation "    Введи секретный ключ:" 0.03
echo ""
echo -e "       ${Y}$SECRET_KEY${RST}"
echo ""
type_animation "    Ключ запомнится в телефоне — повторно вводить не нужно." 0.03
sleep 1
echo ""

type_animation "rudix: 3. ДОБАВИТЬ ЯРЛЫКИ ПРОГРАММ" 0.04
type_animation "    Сейчас откроется папка. Кидай туда ярлыки:" 0.03
type_animation "      • Из меню Пуск (.lnk)" 0.03
type_animation "      • Ссылки на сайты (.url)" 0.03
type_animation "      • Исполняемые файлы (.exe)" 0.03
sleep 1
echo ""

# Открываем папку с ярлыками
cmd.exe /c start explorer "C:\\Users\\$WIN_USER\\NeoShellApps" 2>/dev/null
echo -e "   ${G}✓${RST} Папка открыта"
sleep 1
echo ""

type_animation "rudix: 4. АВТОЗАГРУЗКА" 0.04
type_animation "    Сервер уже добавлен в автозагрузку Windows." 0.03
type_animation "    При каждом включении ПК он будет запускаться в фоне." 0.03
sleep 1
echo ""

type_animation "rudix: 5. УПРАВЛЕНИЕ СЕРВЕРОМ" 0.04
echo ""
echo -e "   ${Y}cd ~/.neoshell && python3 neoshell_config.py${RST}  ${C}# Настройки порта и ключа${RST}"
echo -e "   ${Y}pkill -f 'server.py'${RST}                           ${C}# Остановить сервер${RST}"
echo -e "   ${Y}tail -f ~/.neoshell/logs/server.log${RST}            ${C}# Посмотреть логи${RST}"
echo ""
sleep 1

type_animation "rudix: Если что-то не работает, проверь:" 0.04
type_animation "   • Телефон в той же WiFi сети, что и ПК" 0.03
type_animation "   • IP адрес: $REAL_IP" 0.03
type_animation "   • Сервер запущен (команда выше)" 0.03
sleep 1
echo ""

type_animation "rudix: ВСЁ ГОТОВО! Запускай сервер и пользуйся." 0.04
sleep 0.5
echo ""
echo -e "${G}🚀 Удачного использования!${RST}"
echo ""

