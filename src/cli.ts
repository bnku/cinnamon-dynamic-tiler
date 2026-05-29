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

  // 3. Определяем текущий монитор активного окна
  const activeMonitor = ShellAdapter.findMonitorForWindow(windowGeom, monitors);

  // 4. Сканируем видимые окна и фильтруем активные затайленные на этом мониторе
  const visibleWindowIds = ShellAdapter.getVisibleWindowIds();
  const allCached = CacheManager.getAllCachedWindows();
  const activeWindowsOnMonitor: { windowId: string; state: WindowState }[] = [];

  // Проверяем Smart Reset (ручное изменение размеров) только для самого АКТИВНОГО окна
  let activeWindowIsResized = false;
  const activeCached = allCached[windowId];
  if (activeCached) {
    try {
      const currentGeom = ShellAdapter.getWindowGeometry(windowId);
      const ext = ShellAdapter.getFrameExtents(windowId);
      const currentVisible = {
        x: currentGeom.x + ext.left,
        y: currentGeom.y + ext.top,
        width: currentGeom.width - ext.left - ext.right,
        height: currentGeom.height - ext.top - ext.bottom,
      };

      const diffX = Math.abs(currentVisible.x - activeCached.tiledGeometry.x);
      const diffY = Math.abs(currentVisible.y - activeCached.tiledGeometry.y);
      const diffW = Math.abs(currentVisible.width - activeCached.tiledGeometry.width);
      const diffH = Math.abs(currentVisible.height - activeCached.tiledGeometry.height);

      const THRESHOLD = 80;
      if (diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD) {
        activeWindowIsResized = true;
      }
    } catch {
      // Игнорируем ошибки для активного окна
    }
  }

  for (const id of visibleWindowIds) {
    // Если это само активное окно, и оно было вручную изменено в размерах,
    // мы его НЕ добавляем в activeWindowsOnMonitor, чтобы для него сработал первый тайлинг (Smart Reset)
    if (id === windowId && activeWindowIsResized) {
      continue;
    }

    const cachedWin = allCached[id];
    if (!cachedWin) continue;

    // Проверяем, принадлежит ли окно активному монитору по его кэшированной геометрии
    const monitor = ShellAdapter.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
    if (monitor.id !== activeMonitor.id) continue;

    // Проверяем на старую схему состояния
    const isOldStateSchema = typeof (cachedWin.state as any).hIndex !== 'number' || typeof (cachedWin.state as any).vIndex !== 'number';
    if (isOldStateSchema) continue;

    activeWindowsOnMonitor.push({
      windowId: id,
      state: cachedWin.state
    });
  }

  // 5. Рассчитываем переходы цепного тайлинга окон
  const chainStates = TilingEngine.calculateChainTransitions(
    windowId,
    direction,
    config,
    activeWindowsOnMonitor
  );

  // 6. Применяем новые размеры сначала ко всем соседям цепочки
  for (const [id, nextState] of Object.entries(chainStates)) {
    if (id === windowId) continue;

    try {
      const cachedWin = allCached[id];
      const currentGeom = ShellAdapter.getWindowGeometry(id);
      const originalGeom = cachedWin ? (cachedWin.originalGeometry || currentGeom) : currentGeom;

      const nextGeom = TilingEngine.stateToGeometry(nextState, activeMonitor, config);
      ShellAdapter.unmaximizeWindow(id);
      ShellAdapter.applyGeometry(id, nextGeom);
      CacheManager.saveState(id, nextState, nextGeom, originalGeom);
    } catch {
      // Игнорируем ошибки для отдельных окон
    }
  }

  // 7. И в самом конце применяем изменения к активному окну, чтобы оно гарантированно было поверх
  const activeNextState = chainStates[windowId];
  if (activeNextState) {
    const cachedWin = allCached[windowId];
    const originalGeom = cachedWin ? (cachedWin.originalGeometry || windowGeom) : windowGeom;

    const nextGeom = TilingEngine.stateToGeometry(activeNextState, activeMonitor, config);
    ShellAdapter.unmaximizeWindow(windowId);
    ShellAdapter.applyGeometry(windowId, nextGeom);
    CacheManager.saveState(windowId, activeNextState, nextGeom, originalGeom);
  }
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
      } else if (messageStr.startsWith('shift ')) {
        const subDir = messageStr.substring(6);
        const direction = `shift-${subDir}` as Direction;
        console.log(`[Daemon] Received shift command: ${direction}`);
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

  case 'shift':
    if (args.length < 2) {
      console.error('Error: Please specify direction.');
      printUsage();
    }
    try {
      tileWindow(`shift-${args[1]}` as Direction);
    } catch (error: any) {
      console.error('Shift Error:', error.message);
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
    console.log('dynamic-tiler v1.5.0 (with 12-Column Grid, Gaps, Daemon and Elastic Tiling)');
    break;

  default:
    console.error(`Error: Unknown command "${command}"`);
    printUsage();
}
