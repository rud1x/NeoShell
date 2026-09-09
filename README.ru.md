<div align="center">

  <img src="https://github.com/rud1x/NeoShell/blob/main/static/logo.png" width="120" alt="NeoShell Logo" style="border-radius: 18px;" />

  <h1 align="center" style="font-style: italic; color: #ffcc00;">NeoShell</h1>

  <p align="center">
    <strong>Управление ПК с телефона — без установки, просто браузер</strong>
  </p> 

  <p align="center">
    <a href="README.md"><strong>Read in English</strong></a>
  </p>

  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=3000&pause=1000&color=FFCC00&center=true&vCenter=true&width=550&lines=Windows+Remote+Control;Lock+%2B+Shutdown+%2B+Restart+%2B+Sleep;Launch+Apps+from+Phone;PWA+%2B+Mobile-Friendly+UI" alt="Typing SVG" />

  <br>

  <a href="https://github.com/rud1x/NeoShell/releases/latest">
    <img src="https://img.shields.io/badge/Релиз-v2.0-ffcc00?style=for-the-badge&logo=github&logoColor=white" alt="Release"/>
  </a>
  <a href="therudix">
    <img src="https://img.shields.io/badge/Telegram-Контакты-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x/NeoShell">
    <img src="https://img.shields.io/github/stars/rud1x/NeoShell?style=for-the-badge&color=ffcc00&logo=github" alt="Stars"/>
  </a>

</div>

<br>

### <img src="https://api.iconify.design/ph:sparkle-duotone.svg?color=%23ffcc00" width="22" align="top"> Зачем я создал NeoShell

Я создал NeoShell для себя. Потому что вставать с дивана, чтобы выключить компьютер или перезагрузить его в 2 часа ночи — не самое приятное занятие :)

Когда ты в другой комнате или уже в кровати, стандартные средства удалённого доступа слишком громоздки. Они требуют установки, сложной настройки и постоянного подключения к интернету.

**NeoShell** превращает твой телефон в полноценный пульт управления для Windows-ПК. Открой браузер, отсканируй QR-код — и всё готово. Без установки на телефон, без облачных зависимостей, только локальный Wi-Fi.

<br>

### <img src="https://api.iconify.design/ph:table-duotone.svg?color=%23ffcc00" width="22" align="top"> Поддерживаемые команды

| Команда | Описание |
| :--- | :--- |
| **Блокировка** | Мгновенная блокировка экрана ПК |
| **Проводник** | Открыть проводник на ПК |
| **Cвернуть все** | Свернуть все открытые окна |
| **Диспетчер задач** | Открыть диспетчер задач Windows |
| **Закрыть приложение** | Закрыть активное окно |
| **Cон** | Перевести ПК в спящий режим |
| **Выключить** | Выключить ПК (с подтверждением) |
| **Перезагрузить** | Перезагрузить ПК (с подтверждением) |
| **Приложения** | Запустить любое приложение из папки `NeoShellApps` |
| **Браузер** | Открыть URL или поисковый запрос на ПК |

<br>

### <img src="https://api.iconify.design/ph:lightning-duotone.svg?color=%23ffcc00" width="22" align="top"> Ключевые возможности

* **Мгновенное управление**: Блокировка, выключение, перезагрузка, сон и запуск приложений с телефона.
* **Без установки на телефон**: Просто открой браузер или установи как PWA (Progressive Web App).
* **Подключение по QR**: Отсканируй QR-код с экрана ПК и подключайся.
* **Запуск любых приложений**: Помести `.exe`, `.lnk` или `.url` в папку `NeoShellApps` — они появятся в интерфейсе.
* **Безопасный доступ**: Встроенная авторизация по ключу.
* **Мобильный интерфейс**: Чистый стеклянный дизайн, оптимизированный для смартфонов.
* **Умный статус**: Отображение имени ПК, IP и пинга в реальном времени.
* **Работает офлайн**: Только локальный Wi-Fi — интернет не нужен.
* **Атомарное сохранение**: Данные не повреждаются даже при отключении питания.

<br>

### <img src="https://api.iconify.design/ph:puzzle-piece-duotone.svg?color=%23ffcc00" width="22" align="top"> Архитектура и расширяемость

NeoShell спроектирован просто, но с возможностью расширения:

* **Python HTTP-сервер**: Лёгкий сервер обрабатывает все API-запросы.
* **Веб-интерфейс**: HTML + CSS + JS — легко кастомизировать.
* **API-ориентированный дизайн**: Добавляй новые команды через API.
* **Открытый исходный код**: Изменяй, форкай и адаптируй под свои нужды.

<br>

#### Добавление новой команды за 2 минуты:

В `NeoShell.py` добавь новый роут:

```python
@app.route('/api/my_command', methods=['POST'])
@require_key
def api_my_command():
    os.system('your_command_here')
    return jsonify({'success': True})
```

А затем кнопку в интерфейсе (`index.html`):

```html
<div class="menu-item" onclick="sendCmd('my_command')">
    <span class="icon"><i class="ph-light ph-my-icon"></i></span>
    <span class="label">Моя команда</span>
</div>
```

<br>

### <img src="https://api.iconify.design/ph:download-simple-duotone.svg?color=%23ffcc00" width="22" align="top"> Установка

1. Скачай **`NeoShell.exe`** из раздела [Releases](https://github.com/rud1x/NeoShell/releases).
2. Запусти файл — он свернётся в трей.
3. На экране появится QR-код. Отсканируй его телефоном.
4. Начинай управлять ПК из браузера!

#### Сборка из исходников:

```bash
# Клонируй репозиторий
git clone https://github.com/rud1x/NeoShell.git
cd NeoShell

# Установи зависимости
pip install pyinstaller pillow pyqt6 qrcode

# Собери исполняемый файл
pyinstaller --onefile --windowed --icon=neoshell.ico --add-data "static;static" --add-data "neoshell.ico;." --name NeoShell NeoShell.py
```

Готовый `NeoShell.exe` появится в папке `dist/`.

<br>

### <img src="https://api.iconify.design/ph:code-duotone.svg?color=%23ffcc00" width="22" align="top"> Технологии

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=python,html,css,js,pyqt,git&theme=dark" alt="NeoShell Tech Stack" />
  </a>
</div>

<br>

### <img src="https://api.iconify.design/ph:heart-duotone.svg?color=%23ffcc00" width="22" align="top"> Контакты и поддержка

NeoShell разрабатывается независимо. Если этот инструмент сэкономил тебе время, поставь звёздочку ⭐️ на GitHub — это очень помогает!

<br>

<div align="left">
  <a href="therudix">
    <img src="https://img.shields.io/badge/Telegram-therudix-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x">
    <img src="https://img.shields.io/badge/GitHub-rud1x-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Profile"/>
  </a>
</div>