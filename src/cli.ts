#!/usr/bin/env node

import * as dgram from 'dgram';
import { TilingEngine } from './engine';
import { ShellAdapter } from './adapter';
import { CacheManager } from './cache';
import { ConfigManager } from './config';
import { Direction, WindowState } from './engine/types';

const PORT = 12345;
const HOST = '127.0.0.1';

function printUsage(): void {
  console.log('Usage:');
  console.log('  dynamic-tiler tile <left|right|up|down>  - Snap and resize active window');
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
function tileWindow(direction: Direction): void {
  // 0. Загружаем свежую конфигурацию пользователя
  const config = ConfigManager.getConfig();

  // 1. Получаем ID активного окна
  const windowId = ShellAdapter.getActiveWindowId();
  if (!windowId) {
    throw new Error('Could not retrieve active window ID.');
  }

  // 2. Получаем физическую геометрию окна, тени и список мониторов
  const windowGeom = ShellAdapter.getWindowGeometry(windowId);
  const extents = ShellAdapter.getFrameExtents(windowId);
  const monitors = ShellAdapter.getActiveMonitors();
  
  // Вычисляем ЧИСТУЮ видимую геометрию окна на данный момент (без теней!)
  const visibleGeom = {
    x: windowGeom.x + extents.left,
    y: windowGeom.y + extents.top,
    width: windowGeom.width - extents.left - extents.right,
    height: windowGeom.height - extents.top - extents.bottom,
  };

  // 3. Определяем текущий монитор окна
  const activeMonitor = ShellAdapter.findMonitorForWindow(windowGeom, monitors);

  // 4. Достаем кэшированное состояние
  const cached = CacheManager.getState(windowId);
  let currentState: WindowState;
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

    if (wasResizedManually) {
      currentState = TilingEngine.getDefaultState();
      // Если окно изменили вручную, его текущие физические координаты становятся новыми исходными
      originalGeom = windowGeom;
    } else {
      currentState = cached.state;
      // Сохраняем исходные координаты, которые были в самом начале
      originalGeom = cached.originalGeometry || windowGeom;
    }
  } else {
    currentState = TilingEngine.getDefaultState();
  }

  // 5. Вычисляем новое состояние
  const nextState = TilingEngine.calculateNextState(currentState, direction, config);

  // 6. Вычисляем новые физические пиксели (целевая видимая область)
  const nextGeom = TilingEngine.stateToGeometry(nextState, activeMonitor, config);

  // 7. Снимаем флаг максимизации (если окно развернуто на весь экран)
  ShellAdapter.unmaximizeWindow(windowId);

  // 8. Применяем координаты и получаем фактически примененные физические границы
  const appliedGeom = ShellAdapter.applyGeometry(windowId, nextGeom);

  // 9. Сохраняем состояние, ЦЕЛЕВУЮ ВИДИМУЮ область и ИСХОДНЫЕ физические координаты в кэш
  CacheManager.saveState(windowId, nextState, nextGeom, originalGeom);
}

/**
 * Восстанавливает геометрию активного окна к ее исходному состоянию до тайлинга
 */
function restoreActiveWindowGeometry(): void {
  const windowId = ShellAdapter.getActiveWindowId();
  if (!windowId) {
    throw new Error('Could not retrieve active window ID.');
  }

  const cached = CacheManager.getState(windowId);
  if (cached && cached.originalGeometry) {
    // Снимаем максимизацию, если она есть
    ShellAdapter.unmaximizeWindow(windowId);
    
    // Возвращаем исходный размер напрямую через wmctrl (сырые физические координаты)
    ShellAdapter.applyRawPhysicalGeometry(windowId, cached.originalGeometry);
    
    // Очищаем кэш для этого окна
    CacheManager.clearState(windowId);
  } else {
    throw new Error('No original geometry saved for this window.');
  }
}

/**
 * Очистка кэша для текущего активного окна
 */
function clearActiveWindowCache(): void {
  const windowId = ShellAdapter.getActiveWindowId();
  if (windowId) {
    CacheManager.clearState(windowId);
  } else {
    throw new Error('Could not get active window ID for clearing cache.');
  }
}

/**
 * Запуск фонового UDP-демона
 */
function startDaemon(): void {
  const server = dgram.createSocket('udp4');

  server.on('listening', () => {
    const address = server.address();
    console.log(`Dynamic Tiler Daemon successfully started on ${address.address}:${address.port}`);
  });

  server.on('message', (msg) => {
    const messageStr = msg.toString().trim();

    try {
      if (messageStr.startsWith('tile ')) {
        const direction = messageStr.substring(5) as Direction;
        console.log(`[Daemon] Received tile command: ${direction}`);
        tileWindow(direction);
      } else if (messageStr === 'restore') {
        console.log('[Daemon] Received restore command');
        restoreActiveWindowGeometry();
      } else if (messageStr === 'clear') {
        console.log('[Daemon] Received clear command');
        clearActiveWindowCache();
      } else if (messageStr === 'stop') {
        console.log('[Daemon] Stopping daemon as requested...');
        server.close();
        process.exit(0);
      }
    } catch (error: any) {
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
      tileWindow(args[1] as Direction);
    } catch (error: any) {
      console.error('Tiling Error:', error.message);
      process.exit(1);
    }
    break;

  case 'restore':
    try {
      restoreActiveWindowGeometry();
      console.log('Window geometry restored successfully.');
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    break;

  case 'clear':
    try {
      clearActiveWindowCache();
      console.log('Cache cleared successfully.');
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('Error stopping daemon:', error.message);
      process.exit(1);
    }
    break;

  case 'version':
    console.log('dynamic-tiler v1.4.0 (with Configurable Grid, Gaps and Daemon mode)');
    break;

  default:
    console.error(`Error: Unknown command "${command}"`);
    printUsage();
}
