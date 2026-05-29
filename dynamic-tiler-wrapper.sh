#!/bin/bash

PORT=12345
HOST="127.0.0.1"
NODE_PATH="/usr/bin/node"
CLI_PATH="/home/bn/dev/dynamic-tiler/dist/cli.js"

# Функция для мгновенной отправки сообщения по локальному UDP
send_udp() {
    echo "$1" > /dev/udp/$HOST/$PORT 2>/dev/null
}

if [ "$1" = "tile" ] && [ -n "$2" ]; then
    # Если запущен фоновый Node.js демон, мгновенно шлем UDP
    if pgrep -f "dist/cli.js start" > /dev/null; then
        send_udp "tile $2"
        exit 0
    else
        # Откат на прямой синхронный вызов Node.js, если демон не запущен
        $NODE_PATH $CLI_PATH "$@"
        exit $?
    fi
elif [ "$1" = "shift" ] && [ -n "$2" ]; then
    if pgrep -f "dist/cli.js start" > /dev/null; then
        send_udp "shift $2"
        exit 0
    else
        $NODE_PATH $CLI_PATH "$@"
        exit $?
    fi
elif [ "$1" = "restore" ]; then
    if pgrep -f "dist/cli.js start" > /dev/null; then
        send_udp "restore"
        exit 0
    else
        $NODE_PATH $CLI_PATH "$@"
        exit $?
    fi
elif [ "$1" = "clear" ]; then
    if pgrep -f "dist/cli.js start" > /dev/null; then
        send_udp "clear"
        exit 0
    else
        $NODE_PATH $CLI_PATH "$@"
        exit $?
    fi
elif [ "$1" = "start" ]; then
    if pgrep -f "dist/cli.js start" > /dev/null; then
        echo "Dynamic Tiler Daemon is already running."
        exit 0
    fi
    
    # Убедимся, что папка логов существует
    mkdir -p /home/bn/.cache/dynamic-tiler
    
    # Запускаем фоновый процесс демона
    $NODE_PATH $CLI_PATH start > /home/bn/.cache/dynamic-tiler/daemon.log 2>&1 &
    
    echo "Dynamic Tiler Daemon started successfully in background!"
    exit 0
elif [ "$1" = "stop" ]; then
    if pgrep -f "dist/cli.js start" > /dev/null; then
        send_udp "stop"
        echo "Dynamic Tiler Daemon stopped."
    else
        echo "Dynamic Tiler Daemon is not running."
    fi
    exit 0
else
    # Все прочие системные команды (например, version) прокидываем в ноду
    $NODE_PATH $CLI_PATH "$@"
    exit $?
fi
