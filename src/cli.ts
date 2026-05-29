#!/usr/bin/env node

import { TilingUseCase } from './core/usecases/TilingUseCase';
import { X11ShellAdapter } from './infrastructure/x11/X11ShellAdapter';
import { JsonFileCache } from './infrastructure/cache/JsonFileCache';
import { JsonFileConfigProvider } from './infrastructure/config/JsonFileConfigProvider';
import { UdpDaemon } from './infrastructure/daemon/UdpDaemon';
import { Direction } from './core/types';

const PORT = 12345;
const HOST = '127.0.0.1';

const shell = new X11ShellAdapter();
const cache = new JsonFileCache();
const configProvider = new JsonFileConfigProvider();
const tilingUseCase = new TilingUseCase(shell, cache, configProvider);
const daemon = new UdpDaemon(tilingUseCase, PORT, HOST);

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
      tilingUseCase.tile(args[1] as Direction);
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
      tilingUseCase.tile(`shift-${args[1]}` as Direction);
    } catch (error: any) {
      console.error('Shift Error:', error.message);
      process.exit(1);
    }
    break;

  case 'restore':
    try {
      tilingUseCase.restore();
      console.log('Window geometry restored successfully.');
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    break;

  case 'clear':
    try {
      tilingUseCase.clearCache();
      console.log('Cache cleared successfully.');
    } catch (error: any) {
      console.error('Error:', error.message);
      process.exit(1);
    }
    break;

  case 'start':
    daemon.start();
    break;

  case 'stop':
    try {
      daemon.sendStopSignal();
    } catch (error: any) {
      console.error('Error stopping daemon:', error.message);
      process.exit(1);
    }
    break;

  case 'version':
    console.log('dynamic-tiler v2.0.0 (Clean Architecture Facade, 12-Column Grid, Gaps, UdpDaemon and Elastic Tiling)');
    break;

  default:
    console.error(`Error: Unknown command "${command}"`);
    printUsage();
}
