# 🚀 NeoShell

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**Управляй своим ПК с телефона через Wi-Fi. Красивый веб-интерфейс, безопасный SSH-туннель, клик-клик — и готово.**
**Прога еще в бете и собрана на коленке за день, если будет интересно продолжу развивать проект**

---

## ✨ Возможности

| Функция | Описание |
|---------|----------|
| 🔒 **LOCK** | Блокировка ПК одной кнопкой |
| 💤 **SLEEP** | Быстрый сон компьютера |
| 🖥️ **DESKTOP** | Свернуть все окна (Win+D) |
| 📊 **TASKS** | Открыть диспетчер задач |
| ❌ **CLOSE** | Закрыть активное окно (Alt+F4) |
| 🌐 **OPEN** | Открыть ссылку или поиск в Google |
| 📦 **APPS** | Запуск приложений из папки `NeoShellApps` |
| 📡 **PING** | Статус ПК в реальном времени |
| 🔐 **SECURITY** | 3 попытки входа → блокировка 5 минут |
| 📱 **PWA** | Установка на телефон как приложение |

---

## 🚀 Быстрая установка

### На ПК (WSL)

```bash
curl -sL https://raw.githubusercontent.com/rud1x/NeoShell/main/installer.sh -o /tmp/neoshell_install.sh && bash /tmp/neoshell_install.sh
```

### На телефоне (Termux) — опционально

```bash
pkg install openssh
ssh user@ip -p port
```

---

## 📱 Подключение

1. **Запусти сервер:**
   ```bash
   cd ~/.neoshell/web && python3 server.py
   ```

2. **Открой браузер на телефоне:**
   ```
   http://ip:port
   ```

3. **Введи секретный ключ** (покажется при установке)

---

## 📂 Добавление приложений

1. Открой папку:
   ```
   C:\Users\ТВОЁ_ИМЯ\NeoShellApps
   ```

2. Перетащи туда ярлыки программ (.lnk) или ссылки (.url)

3. Обнови страницу в NeoShell — приложения появятся!

---

## 🛠️ Управление сервером

| Команда | Действие |
|---------|----------|
| `cd ~/.neoshell/web && python3 server.py` | Запустить сервер |
| `pkill -f 'server.py'` | Остановить сервер |
| `cd ~/.neoshell && python3 neoshell_config.py` | Настройки |
| `tail -f ~/.neoshell/logs/server.log` | Посмотреть логи |

---

## 🔧 Настройка

```bash
cd ~/.neoshell
python3 neoshell_config.py
```

Доступные опции:

- Сменить секретный ключ
- Сменить порт
- Изменить путь к папке приложений
- Настроить автозагрузку
- Управление сервером

---

## 📁 Структура проекта

```
~/.neoshell/
├── config.json           # Настройки (ключ, порт)
├── neoshell_config.py    # CLI конфигуратор
├── web/
│   ├── server.py         # FastAPI сервер
│   └── static/
│       ├── index.html    # Веб-интерфейс
│       ├── style.css     # Стили
│       └── script.js     # Клиентская логика
└── logs/
    └── server.log        # Логи сервера
```


## 🔌 Проброс портов (доступ с телефона)

Из-за особенностей WSL2 сервер NeoShell не виден из локальной сети автоматически. Нужно **пробросить порт** через Windows.

### ✅ Автоматический проброс (рекомендуемый)

Скачай и запусти скрипт `portproxy.sh`:

```bash
# Скачать скрипт
curl -sL https://raw.githubusercontent.com/rud1x/NeoShell/main/portproxy.sh -o ~/portproxy.sh

# Сделать исполняемым
chmod +x ~/portproxy.sh

# Запустить (откроется окно PowerShell с запросом прав администратора)
bash ~/portproxy.sh
```

Скрипт сам:
- Определит порт из `~/.neoshell/config.json`
- Найдёт твой локальный IP (`192.168.x.x`)
- Добавит правило проброса в Windows
- Откроет порт в брандмауэре

### ❗ Если не работает

- **IP изменился** — скрипт нужно запускать заново при смене сети
- **Порт занят** — проверь `ss -tulpn | grep 8000` и убей процесс
- **Брандмауэр блокирует** — проверь правило в `wf.msc`

> 💡 Совет: добавь выполнение `portproxy.sh` в автозагрузку WSL, чтобы проброс настраивался автоматически при каждом запуске.



---

## 🤝 Вклад в проект

Приветствуются Pull Request'ы!

1. Форкни репозиторий
2. Создай ветку (`git checkout -b feature/amazing`)
3. Сделай коммит (`git commit -m 'Add amazing feature'`)
4. Запушь (`git push origin feature/amazing`)
5. Открой Pull Request

---

## 📄 Лицензия

MIT © [rud1x](https://github.com/rud1x)

---

## ⭐ Поставь звезду!

Если проект оказался полезным — поставь звезду на GitHub, это поможет другим найти его. Спасибо! 🙌


