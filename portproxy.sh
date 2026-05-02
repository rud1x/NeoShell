#!/bin/bash
CONFIG_FILE="$HOME/.neoshell/config.json"
PORT=$(grep -o '"port": [0-9]*' "$CONFIG_FILE" | awk '{print $2}')
[ -z "$PORT" ] && PORT=8002

# Правильное определение IP
WIN_IP=$(ip addr show eth0 | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1)
[ -z "$WIN_IP" ] && WIN_IP="192.168.1.21"

echo "[NeoShell] Проброс порта $PORT на $WIN_IP"

# Запускаем PowerShell от администратора через runas
powershell.exe -Command "Start-Process powershell -Verb RunAs -ArgumentList '-Command \"netsh interface portproxy add v4tov4 listenport=$PORT listenaddress=0.0.0.0 connectport=$PORT connectaddress=$WIN_IP; New-NetFirewallRule -DisplayName ''NeoShell $PORT'' -Direction Inbound -LocalPort $PORT -Protocol TCP -Action Allow -ErrorAction SilentlyContinue\"'"
