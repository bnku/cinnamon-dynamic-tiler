#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const dgram = __importStar(require("dgram"));
const engine_1 = require("./engine");
const adapter_1 = require("./adapter");
const cache_1 = require("./cache");
const config_1 = require("./config");
const PORT = 12345;
const HOST = '127.0.0.1';
function printUsage() {
    console.log('Usage:');
    console.log('  dynamic-tiler tile <left|right|up|down>  - Snap and resize active window');
    console.log('  dynamic-tiler shift <left|right>        - Quick shift window to left/right half');
    console.log('  dynamic-tiler restore                    - Restore active window to its original pre-tiled size');
    console.log('  dynamic-tiler clear                      - Clear current window cached state');
    console.log('  dynamic-tiler start                      - Start background UDP daemon');
    console.log('  dynamic-tiler stop                       - Stop background UDP daemon');
    console.log('  dynamic-tiler version                    - Print current version');
    process.exit(1);
}
/**
 * Основное бизнес-ядро тайлинга окон
 */
function tileWindow(direction) {
    // 0. Загружаем свежую конфигурацию пользователя
    const config = config_1.ConfigManager.getConfig();
    // 1. Получаем ID активного окна
    const windowId = adapter_1.ShellAdapter.getActiveWindowId();
    if (!windowId) {
        throw new Error('Could not retrieve active window ID.');
    }
    // 2. Получаем физическую геометрию окна, тени и список мониторов
    const windowGeom = adapter_1.ShellAdapter.getWindowGeometry(windowId);
    const extents = adapter_1.ShellAdapter.getFrameExtents(windowId);
    const monitors = adapter_1.ShellAdapter.getActiveMonitors();
    // Вычисляем ЧИСТУЮ видимую геометрию окна на данный момент (без теней!)
    const visibleGeom = {
        x: windowGeom.x + extents.left,
        y: windowGeom.y + extents.top,
        width: windowGeom.width - extents.left - extents.right,
        height: windowGeom.height - extents.top - extents.bottom,
    };
    // 3. Определяем текущий монитор окна
    const activeMonitor = adapter_1.ShellAdapter.findMonitorForWindow(windowGeom, monitors);
    // 4. Достаем кэшированное состояние
    const cached = cache_1.CacheManager.getState(windowId);
    let currentState;
    let originalGeom = windowGeom; // Исходная геометрия по умолчанию физическая (содержит тени)
    if (cached) {
        // Проверка на ручной ресайз (Smart Reset) на основе ЧИСТОЙ видимой геометрии!
        const diffX = Math.abs(visibleGeom.x - cached.tiledGeometry.x);
        const diffY = Math.abs(visibleGeom.y - cached.tiledGeometry.y);
        const diffW = Math.abs(visibleGeom.width - cached.tiledGeometry.width);
        const diffH = Math.abs(visibleGeom.height - cached.tiledGeometry.height);
        // Порог 80px, чтобы сгладить ограничения минимальных размеров окон (size hints)
        const THRESHOLD = 80;
        const wasResizedManually = diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD;
        const isOldStateSchema = typeof cached.state.hIndex !== 'number' || typeof cached.state.vIndex !== 'number';
        if (wasResizedManually || isOldStateSchema) {
            currentState = engine_1.TilingEngine.getDefaultState();
            // Если окно изменили вручную или схема устарела, сохраняем оригинальную геометрию, если она есть
            originalGeom = cached.originalGeometry || windowGeom;
        }
        else {
            currentState = cached.state;
            // Сохраняем исходные координаты, которые были в самом начале
            originalGeom = cached.originalGeometry || windowGeom;
        }
    }
    else {
        currentState = engine_1.TilingEngine.getDefaultState();
    }
    // 5. Вычисляем новое состояние
    const nextState = engine_1.TilingEngine.calculateNextState(currentState, direction, config);
    // 6. Вычисляем новые физические пиксели (целевая видимая область)
    const nextGeom = engine_1.TilingEngine.stateToGeometry(nextState, activeMonitor, config);
    // 7. Снимаем флаг максимизации (если окно развернуто на весь экран)
    adapter_1.ShellAdapter.unmaximizeWindow(windowId);
    // 8. Применяем координаты и получаем фактически примененные физические границы
    const appliedGeom = adapter_1.ShellAdapter.applyGeometry(windowId, nextGeom);
    // 9. Сохраняем состояние, ЦЕЛЕВУЮ ВИДИМУЮ область и ИСХОДНЫЕ физические координаты в кэш
    cache_1.CacheManager.saveState(windowId, nextState, nextGeom, originalGeom);
}
/**
 * Восстанавливает геометрию активного окна к ее исходному состоянию до тайлинга
 */
function restoreActiveWindowGeometry() {
    const windowId = adapter_1.ShellAdapter.getActiveWindowId();
    if (!windowId) {
        throw new Error('Could not retrieve active window ID.');
    }
    const cached = cache_1.CacheManager.getState(windowId);
    if (cached && cached.originalGeometry) {
        // Снимаем максимизацию, если она есть
        adapter_1.ShellAdapter.unmaximizeWindow(windowId);
        // Возвращаем исходный размер напрямую через wmctrl (сырые физические координаты)
        adapter_1.ShellAdapter.applyRawPhysicalGeometry(windowId, cached.originalGeometry);
        // Очищаем кэш для этого окна
        cache_1.CacheManager.clearState(windowId);
    }
    else {
        throw new Error('No original geometry saved for this window.');
    }
}
/**
 * Очистка кэша для текущего активного окна
 */
function clearActiveWindowCache() {
    const windowId = adapter_1.ShellAdapter.getActiveWindowId();
    if (windowId) {
        cache_1.CacheManager.clearState(windowId);
    }
    else {
        throw new Error('Could not get active window ID for clearing cache.');
    }
}
/**
 * Запуск фонового UDP-демона
 */
function startDaemon() {
    const server = dgram.createSocket('udp4');
    server.on('listening', () => {
        const address = server.address();
        console.log(`Dynamic Tiler Daemon successfully started on ${address.address}:${address.port}`);
    });
    server.on('message', (msg) => {
        const messageStr = msg.toString().trim();
        try {
            if (messageStr.startsWith('tile ')) {
                const direction = messageStr.substring(5);
                console.log(`[Daemon] Received tile command: ${direction}`);
                tileWindow(direction);
            }
            else if (messageStr.startsWith('shift ')) {
                const subDir = messageStr.substring(6);
                const direction = `shift-${subDir}`;
                console.log(`[Daemon] Received shift command: ${direction}`);
                tileWindow(direction);
            }
            else if (messageStr === 'restore') {
                console.log('[Daemon] Received restore command');
                restoreActiveWindowGeometry();
            }
            else if (messageStr === 'clear') {
                console.log('[Daemon] Received clear command');
                clearActiveWindowCache();
            }
            else if (messageStr === 'stop') {
                console.log('[Daemon] Stopping daemon as requested...');
                server.close();
                process.exit(0);
            }
        }
        catch (error) {
            console.error(`[Daemon Error] Failed to process message "${messageStr}":`, error.message);
        }
    });
    server.on('error', (err) => {
        console.error('[Daemon Error] Server error:', err.message);
        server.close();
        process.exit(1);
    });
    server.bind(PORT, HOST);
}
// Разбор аргументов командной строки при прямом вызове
const args = process.argv.slice(2);
if (args.length === 0) {
    printUsage();
}
const command = args[0].toLowerCase();
switch (command) {
    case 'tile':
        if (args.length < 2) {
            console.error('Error: Please specify direction.');
            printUsage();
        }
        try {
            tileWindow(args[1]);
        }
        catch (error) {
            console.error('Tiling Error:', error.message);
            process.exit(1);
        }
        break;
    case 'shift':
        if (args.length < 2) {
            console.error('Error: Please specify direction.');
            printUsage();
        }
        try {
            tileWindow(`shift-${args[1]}`);
        }
        catch (error) {
            console.error('Shift Error:', error.message);
            process.exit(1);
        }
        break;
    case 'restore':
        try {
            restoreActiveWindowGeometry();
            console.log('Window geometry restored successfully.');
        }
        catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
        break;
    case 'clear':
        try {
            clearActiveWindowCache();
            console.log('Cache cleared successfully.');
        }
        catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
        break;
    case 'start':
        startDaemon();
        break;
    case 'stop':
        // Посылаем сигнал остановки демону по UDP
        try {
            const client = dgram.createSocket('udp4');
            client.send('stop', PORT, HOST, (err) => {
                client.close();
                if (err) {
                    console.error('Error sending stop signal to daemon:', err.message);
                    process.exit(1);
                }
                console.log('Stop signal sent to daemon.');
                process.exit(0);
            });
        }
        catch (error) {
            console.error('Error stopping daemon:', error.message);
            process.exit(1);
        }
        break;
    case 'version':
        console.log('dynamic-tiler v1.5.0 (with 12-Column Grid, Gaps, Daemon and Elastic Tiling)');
        break;
    default:
        console.error(`Error: Unknown command "${command}"`);
        printUsage();
}
