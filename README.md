<p align="center">
  <img src="https://i.ibb.co/gL2pJL2m/image.png" alt="NeoShell Preview" width="800"/>
</p>

**Управляй своим ПК с телефона через Wi-Fi. Красивый веб-интерфейс, просто запусти exe — и готово.**

[![Stars](https://img.shields.io/github/stars/rud1x/NeoShell?style=for-the-badge&logo=github&color=yellow)](https://github.com/rud1x/NeoShell)
[![Releases](https://img.shields.io/github/v/release/rud1x/NeoShell?style=for-the-badge&logo=github&color=orange)](https://github.com/rud1x/NeoShell/releases)

---

## ✨ Возможности

- 🔒 **LOCK** — Блокировка ПК одной кнопкой
- 💤 **SLEEP** — Быстрый сон компьютера
- 🔄 **SHUTDOWN / REBOOT** — Выключение и перезагрузка
- 🖥️ **MINIMIZE ALL** — Свернуть все окна
- 📊 **TASK MANAGER** — Открыть диспетчер задач
- ❌ **CLOSE APP** — Закрыть активное окно (Alt+F4)
- 🌐 **OPEN IN BROWSER** — Открыть ссылку или поиск в Google
- 📦 **APPS** — Запуск приложений из папки `NeoShellApps`
- 📡 **PING** — Статус ПК в реальном времени
- 🔐 **SECURITY** — Защита секретным ключом
- 📱 **PWA** — Установка на телефон как приложение
- 🖼️ **TRAY** — Работа в фоне, иконка меняет цвет
- ⚡ **AUTOSTART** — Автоматический запуск с Windows

---

## 🚀 Быстрая установка

### На ПК (Windows)

1. Скачай `NeoShell_v2.0.zip` из [Releases](https://github.com/rud1x/NeoShell/releases)
2. Запусти `NeoShell.exe`
3. Нажми `START SERVER`
4. Отсканируй QR код телефоном

**Всё! Никаких установок Python, WSL или консоли.**

---

## 📱 Подключение с телефона

1. Убедись, что телефон в той же Wi-Fi сети, что и ПК
2. Открой приложение NeoShell на ПК
3. Нажми `START SERVER`
4. Нажми `CONNECT`
5. Отсканируй QR код телефоном
6. Или вручную введи URL в браузере: `http://IP_компьютера:8000`

---

## 📂 Добавление приложений

1. Открой папку `NeoShellApps` (она создается рядом с программой)
2. Перетащи туда ярлыки программ (`.lnk`) или ссылки (`.url`)
3. Обнови страницу в NeoShell — приложения появятся!

---

## ⚙️ Настройки

В приложении доступны:

- **Смена порта** (по умолчанию 8000)
- **Смена секретного ключа**
- **Изменение папки с приложениями**
- **Автозагрузка с Windows**
- **Автозапуск сервера при старте программы**

Все настройки сохраняются в `.neoshell/config.json`

---

## 🖥️ Управление из трея

- **Левый клик** по иконке — показать окно
- **Правый клик** — меню (Show Window, Start Server, Stop Server, Exit)

Иконка в трее:
- 🟡 **Желтая** — сервер остановлен
- 🟢 **Зеленая** — сервер запущен

---

## Скриншоты

![image](https://i.ibb.co/ymFMjdJw/Screenshot-20260503-002824-Chrome.jpg)
![image](https://i.ibb.co/4HnrNKG/image.png)
