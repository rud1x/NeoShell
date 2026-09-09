<div align="center">

  <img src="https://github.com/rud1x/NeoShell/blob/main/static/logo.png" width="120" alt="NeoShell Logo" style="border-radius: 18px;" />

  <h1 align="center" style="font-style: italic; color: #ffcc00;">NeoShell</h1>

  <p align="center">
    <strong>Remote PC control from your phone — no installation, just a browser</strong>
  </p>

  <p align="center">
    <a href="README.ru.md"><strong>🇷🇺 Читать на русском</strong></a>
  </p>

  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=3000&pause=1000&color=FFCC00&center=true&vCenter=true&width=550&lines=Windows+Remote+Control;Lock+%2B+Shutdown+%2B+Restart+%2B+Sleep;Launch+Apps+from+Phone;PWA+%2B+Mobile-Friendly+UI" alt="Typing SVG" />

  <br>

  <a href="https://github.com/rud1x/NeoShell/releases/latest">
    <img src="https://img.shields.io/badge/Release-v2.0-ffcc00?style=for-the-badge&logo=github&logoColor=white" alt="Release"/>
  </a>
  <a href="https://t.me/therudix">
    <img src="https://img.shields.io/badge/Telegram-Contact-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x/NeoShell">
    <img src="https://img.shields.io/github/stars/rud1x/NeoShell?style=for-the-badge&color=ffcc00&logo=github" alt="Stars"/>
  </a>

</div>


### <img src="https://api.iconify.design/ph:sparkle-duotone.svg?color=%23ffcc00" width="22" align="top"> Why I built NeoShell

I built NeoShell because getting up from the couch to shut down my PC or turn off the monitor light at 2 AM is not my idea of a good time :)

When you're working in another room or already in bed, standard remote desktop tools are overkill. They require installation, complex setup, and constant internet connection.

**NeoShell** turns your phone into a full-featured remote control for your Windows PC. Open the browser, scan the QR code, and you're ready to go. No phone installation, no cloud dependencies, just your local Wi-Fi.

<br>

### <img src="https://api.iconify.design/ph:table-duotone.svg?color=%23ffcc00" width="22" align="top"> Supported Commands

| Command | Description |
| :--- | :--- |
| **Lock** | Lock the PC screen instantly |
| **Explorer** | Open File Explorer on the PC |
| **Minimize All** | Minimize all open windows |
| **Task Manager** | Open Windows Task Manager |
| **Close App** | Close the active application |
| **Sleep** | Put the PC to sleep mode |
| **Shutdown** | Shut down the PC (with confirmation) |
| **Reboot** | Restart the PC (with confirmation) |
| **Apps** | Launch any app from the `NeoShellApps` folder |
| **Browser** | Open any URL or search query on the PC |

<br>

### <img src="https://api.iconify.design/ph:lightning-duotone.svg?color=%23ffcc00" width="22" align="top"> Key Features

* **Instant Remote Control**: Lock, shutdown, restart, sleep, and launch apps directly from your phone.
* **No Phone Installation**: Just open the browser or install as PWA (Progressive Web App).
* **QR Code Pairing**: Scan the QR code from the PC screen to connect instantly.
* **Launch Any Application**: Drop `.exe`, `.lnk`, or `.url` files into `NeoShellApps` folder — they appear in the interface.
* **Secure Access**: Built-in key-based authentication prevents unauthorized access.
* **Mobile-First UI**: Clean, glass-morphism design optimized for smartphones.
* **Smart Status Tracking**: Real-time connection status with PC name, IP, and ping.
* **Works Offline**: Local Wi-Fi only — no internet required.
* **Atomic File Saves**: Your data is safe even during power outages.

<br>

### <img src="https://api.iconify.design/ph:puzzle-piece-duotone.svg?color=%23ffcc00" width="22" align="top"> Architecture & Extensibility

NeoShell was designed to be simple yet extensible:

* **Python HTTP Server**: Lightweight Flask-like server handles all API requests.
* **Static Web Interface**: HTML + CSS + JS — easy to customize and style.
* **API-First Design**: Add new commands by extending the API endpoints.
* **Open Source**: Modify, fork, and adapt to your needs.

<br>

### Adding a new command in 2 minutes:

In `NeoShell.py`, add a new route:

```python
@app.route('/api/my_command', methods=['POST'])
@require_key
def api_my_command():
    os.system('your_command_here')
    return jsonify({'success': True})
```

Then add a button in the frontend (`index.html`):

```html
<div class="menu-item" onclick="sendCmd('my_command')">
    <span class="icon"><i class="ph-light ph-my-icon"></i></span>
    <span class="label">My Command</span>
</div>
```
### <img src="https://api.iconify.design/ph:download-simple-duotone.svg?color=%23ffcc00" width="22" align="top"> Installation

1. Download **`NeoShell.exe`** from the [Releases](https://github.com/rud1x/NeoShell/releases) page.
2. Run the executable — it will minimize to the system tray.
3. A QR code will appear on the screen. Scan it with your phone.
4. Start controlling your PC from the browser!

#### Build from Source:

```bash
# Clone repository
git clone https://github.com/rud1x/NeoShell.git
cd NeoShell

# Install dependencies
pip install pyinstaller pillow pyqt6 qrcode

# Build executable
pyinstaller --onefile --windowed --icon=neoshell.ico --add-data "static;static" --add-data "neoshell.ico;." --name NeoShell NeoShell.py
```

The built `NeoShell.exe` will be in the `dist/` folder.

<br>

### <img src="https://api.iconify.design/ph:code-duotone.svg?color=%23ffcc00" width="22" align="top"> Tech Stack

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=python,html,css,js,pyqt,git&theme=dark" alt="NeoShell Tech Stack" />
  </a>
</div>

<br>

### <img src="https://api.iconify.design/ph:heart-duotone.svg?color=%23ffcc00" width="22" align="top"> Contact & Support

NeoShell is developed independently. If this tool saves you time, leaving a star ⭐️ on GitHub means a lot!

<br>

<div align="left">
  <a href="https://t.me/therudix">
    <img src="https://img.shields.io/badge/Telegram-therudix-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x">
    <img src="https://img.shields.io/badge/GitHub-rud1x-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Profile"/>
  </a>
</div>