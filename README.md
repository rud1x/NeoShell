<div align="center">

  <img src="https://github.com/rud1x/NeoShell/blob/main/static/logo.png" width="120" alt="NeoShell Logo" style="border-radius: 18px;" />

  <h1 align="center" style="font-style: italic; color: #ffcc00;">NeoShell</h1>

  <p align="center">
    <strong>Управление ПК с телефона — теперь с нативным Android-приложением</strong>
  </p>

  <p align="center">
    <a href="README.en.md"><strong>🇬🇧 Read in English</strong></a>
  </p>

  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=3000&pause=1000&color=FFCC00&center=true&vCenter=true&width=550&lines=Windows+Remote+Control;Lock+%2B+Shutdown+%2B+Restart+%2B+Sleep;Launch+Apps+from+Phone;Native+Android+APK" alt="Typing SVG" />

  <br>

  <a href="https://github.com/rud1x/NeoShell/releases/latest">
    <img src="https://img.shields.io/badge/Релиз-v2.3-ffcc00?style=for-the-badge&logo=github&logoColor=white" alt="Release"/>
  </a>
  <a href="https://t.me/therudix">
    <img src="https://img.shields.io/badge/Telegram-Контакты-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x/NeoShell">
    <img src="https://img.shields.io/github/stars/rud1x/NeoShell?style=for-the-badge&color=ffcc00&logo=github" alt="Stars"/>
  </a>

</div>

<br>

### <img src="https://api.iconify.design/ph:device-mobile-duotone.svg?color=%23ffcc00" width="22" align="top"> Теперь с Android APK 🎉

NeoShell больше не просто браузерное решение. Мы сделали **нативный Android-клиент** с:

* **QR-сканер** — Наведи камеру на QR-код в окне NeoShell
* **Push-уведомления** — Узнавай, когда ПК онлайн или оффлайн
* **Список устройств** — Несколько ПК, лёгкое переключение между ними
* **Нативный интерфейс** — Splash Screen, Bottom Sheet, плавные анимации
* **Проверка обновлений** — Приложение само скажет, когда вышла новая версия

Скачай APK из [Releases](https://github.com/rud1x/NeoShell/releases/latest) → установи → сканируй → управляй.

<br>

### <img src="https://api.iconify.design/ph:sparkle-duotone.svg?color=%23ffcc00" width="22" align="top"> Зачем я создал NeoShell

Я создал NeoShell для себя. Потому что вставать с дивана, чтобы выключить компьютер или перезагрузить его в 2 часа ночи — не самое приятное занятие :)

Когда ты в другой комнате или уже в кровати, стандартные средства удалённого доступа слишком громоздки. Они требуют установки, сложной настройки и постоянного подключения к интернету.

**NeoShell** превращает твой телефон в полноценный пульт управления для Windows-ПК. Открой приложение, отсканируй QR-код — и всё готово. Без облачных зависимостей, только локальный Wi-Fi.

<br>

### <img src="https://api.iconify.design/ph:lightning-duotone.svg?color=%23ffcc00" width="22" align="top"> Ключевые возможности

* **Нативный Android APK**: Полноценный клиент с QR-сканером и push-уведомлениями
* **Мгновенное управление**: Блокировка, выключение, перезагрузка, сон, запуск приложений
* **Подключение по QR**: Отсканируй QR-код с экрана ПК и подключайся
* **Запуск любых приложений**: Помести `.exe`, `.lnk` или `.url` в папку `NeoShellApps`
* **Медиа-контроль**: Play/Pause, следующий, предыдущий, стоп
* **Безопасный доступ**: Встроенная авторизация по ключу
* **Умный статус**: Имя ПК, IP и пинг в реальном времени
* **Работает офлайн**: Только локальный Wi-Fi — интернет не нужен
* **CORS поддержка**: Стабильная связь APK ↔ ПК

<br>

### <img src="https://api.iconify.design/ph:download-simple-duotone.svg?color=%23ffcc00" width="22" align="top"> Установка

#### <img src="https://api.iconify.design/basil:android-solid.svg?color=%23ffcc00" width="20" align="top"> Android APK

1. Скачай **NeoShell.apk** из [Releases](https://github.com/rud1x/NeoShell/releases/latest)
2. Установи на телефон (разреши установку из неизвестных источников)
3. Открой NeoShell → нажми **+** → сканируй QR или введи данные вручную

#### <img src="https://api.iconify.design/basil:windows-solid.svg?color=%23ffcc00" width="20" align="top"> Windows

1. Скачай **NeoShell.exe** из [Releases](https://github.com/rud1x/NeoShell/releases/latest)
2. Запусти файл — он свернётся в трей
3. На экране появится QR-код — отсканируй его через APK
4. Управляй ПК

#### Сборка из исходников
```
git clone https://github.com/rud1x/NeoShell.git

cd NeoShell

pip install pyinstaller pillow pyqt6 qrcode winsdk

pyinstaller --onefile --windowed --icon=neoshell.ico --add-data "static;static" --add-data "neoshell.ico;." --name NeoShell NeoShell.py
```
Готовый NeoShell.exe появится в папке dist/.

<br>

### <img src="https://api.iconify.design/ph:code-duotone.svg?color=%23ffcc00" width="22" align="top"> Технологии

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=python,html,css,js,pyqt,git,androidstudio&theme=dark" alt="NeoShell Tech Stack" />
  </a>
</div>

<br>

### <img src="https://api.iconify.design/ph:heart-duotone.svg?color=%23ffcc00" width="22" align="top"> Контакты и поддержка

NeoShell разрабатывается независимо. Если этот инструмент сэкономил тебе время, поставь звёздочку ⭐️ на GitHub — это очень помогает!

<br>

<div align="left">
  <a href="https://t.me/therudix">
    <img src="https://img.shields.io/badge/Telegram-therudix-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x">
    <img src="https://img.shields.io/badge/GitHub-rud1x-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Profile"/>
  </a>
</div>
