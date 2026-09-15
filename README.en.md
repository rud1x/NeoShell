<div align="center">

  <img src="https://github.com/rud1x/NeoShell/blob/main/static/logo.png" width="120" alt="NeoShell Logo" style="border-radius: 18px;" />

  <h1 align="center" style="font-style: italic; color: #ffcc00;">NeoShell</h1>

  <p align="center">
    <strong>Remote PC control from your phone — now with a native Android app</strong>
  </p>

  <p align="center">
    <a href="README.md"><strong>🇷🇺 Читать на русском</strong></a>
  </p>

  <img src="https://readme-typing-svg.demolab.com?font=JetBrains+Mono&weight=600&size=20&duration=3000&pause=1000&color=FFCC00&center=true&vCenter=true&width=550&lines=Windows+Remote+Control;Lock+%2B+Shutdown+%2B+Restart+%2B+Sleep;Launch+Apps+from+Phone;Native+Android+APK" alt="Typing SVG" />

  <br>

  <a href="https://github.com/rud1x/NeoShell/releases/latest">
    <img src="https://img.shields.io/badge/Release-v2.3-ffcc00?style=for-the-badge&logo=github&logoColor=white" alt="Release"/>
  </a>
  <a href="https://t.me/therudix">
    <img src="https://img.shields.io/badge/Telegram-Contact-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x/NeoShell">
    <img src="https://img.shields.io/github/stars/rud1x/NeoShell?style=for-the-badge&color=ffcc00&logo=github" alt="Stars"/>
  </a>

</div>

<br>

### <img src="https://api.iconify.design/ph:device-mobile-duotone.svg?color=%23ffcc00" width="22" align="top"> Now with Android APK 🎉

NeoShell is no longer just a browser-based solution. We've built a **native Android client** with:

* **QR Scanner** — Point your camera at the QR code in the NeoShell window
* **Push Notifications** — Know when your PC is online or offline
* **Saved Devices** — Multiple PCs, easy switching between them
* **Native UI** — Splash Screen, Bottom Sheet, smooth animations
* **Built-in Update Checker** — The app tells you when a new version is out

Download the APK from [Releases](https://github.com/rud1x/NeoShell/releases/latest) → install → scan → control.

<br>

### <img src="https://api.iconify.design/ph:sparkle-duotone.svg?color=%23ffcc00" width="22" align="top"> Why I built NeoShell

I built NeoShell for myself. Because getting up from the couch to shut down the PC or reboot it at 2 AM is not the most pleasant thing to do :)

When you're in another room or already in bed, standard remote access tools are too bulky. They require installation, complex setup, and a constant internet connection.

**NeoShell** turns your phone into a full-featured remote control for a Windows PC. Open the app, scan the QR code — and you're done. No cloud dependencies, just local Wi-Fi.

<br>

### <img src="https://api.iconify.design/ph:lightning-duotone.svg?color=%23ffcc00" width="22" align="top"> Key Features

* **Native Android APK**: Full-featured client with QR scanner and push notifications
* **Instant Control**: Lock, shutdown, restart, sleep, launch apps
* **QR Pairing**: Scan the QR code from your PC screen to connect
* **Launch Any Application**: Drop `.exe`, `.lnk`, or `.url` files into the `NeoShellApps` folder
* **Media Control**: Play/Pause, next, previous, stop
* **Secure Access**: Built-in key-based authentication
* **Smart Status**: PC name, IP, and ping in real time
* **Works Offline**: Local Wi-Fi only — no internet required
* **CORS Support**: Stable APK ↔ PC communication

<br>

### <img src="https://api.iconify.design/ph:download-simple-duotone.svg?color=%23ffcc00" width="22" align="top"> Installation

#### <img src="https://api.iconify.design/basil:android-solid.svg?color=%23ffcc00" width="20" align="top"> Android APK

1. Download **NeoShell.apk** from [Releases](https://github.com/rud1x/NeoShell/releases/latest)
2. Install on your phone (allow installation from unknown sources)
3. Open NeoShell → tap **+** → scan QR or enter the data manually

#### <img src="https://api.iconify.design/basil:windows-solid.svg?color=%23ffcc00" width="20" align="top"> Windows

1. Download **NeoShell.exe** from [Releases](https://github.com/rud1x/NeoShell/releases/latest)
2. Run the file — it will minimize to the tray
3. A QR code will appear on screen — scan it via the APK
4. Control your PC

#### Build from Source
```
git clone https://github.com/rud1x/NeoShell.git

cd NeoShell

pip install pyinstaller pillow pyqt6 qrcode winsdk

pyinstaller --onefile --windowed --icon=neoshell.ico --add-data "static;static" --add-data "neoshell.ico;." --name NeoShell NeoShell.py
```
The built NeoShell.exe will appear in the dist/ folder.

<br>

### <img src="https://api.iconify.design/ph:code-duotone.svg?color=%23ffcc00" width="22" align="top"> Tech Stack

<div align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=python,html,css,js,pyqt,git,androidstudio&theme=dark" alt="NeoShell Tech Stack" />
  </a>
</div>

<br>

### <img src="https://api.iconify.design/ph:heart-duotone.svg?color=%23ffcc00" width="22" align="top"> Contact & Support

NeoShell is developed independently. If this tool saved you time, leaving a star ⭐️ on GitHub helps a lot!

<br>

<div align="left">
  <a href="https://t.me/therudix">
    <img src="https://img.shields.io/badge/Telegram-therudix-26A5E4?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram"/>
  </a>
  <a href="https://github.com/rud1x">
    <img src="https://img.shields.io/badge/GitHub-rud1x-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub Profile"/>
  </a>
</div>
