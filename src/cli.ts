#!/usr/bin/env node

import * as dgram from 'dgram';
import { TilingUseCase } from './core/usecases/TilingUseCase';
import { X11ShellAdapter } from './infrastructure/x11/X11ShellAdapter';
import { JsonFileCache } from './infrastructure/cache/JsonFileCache';
import { ConfigManager } from './config';
import { Direction } from './core/types';

const PORT = 12345;
const HOST = '127.0.0.1';

const shell = new X11ShellAdapter();
const cache = new JsonFileCache();
const tilingUseCase = new TilingUseCase(shell, cache);

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
  const config = ConfigManager.getConfig();
  tilingUseCase.tile(direction, config);
}

/**
 * Восстанавливает геометрию активного окна к ее исходному состоянию до тайлинга
 */
function restoreActiveWindowGeometry(): void {
  tilingUseCase.restore();
}

/**
 * Очистка кэша для текущего активного окна
 */
function clearActiveWindowCache(): void {
  tilingUseCase.clearCache();
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
    console.log('dynamic-tiler v1.5.0 (Clean Architecture, 12-Column Grid, Gaps, Daemon and Elastic Tiling)');
    break;

  default:
    console.error(`Error: Unknown command "${command}"`);
    printUsage();
}
