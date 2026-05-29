#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TilingUseCase_1 = require("./core/usecases/TilingUseCase");
const X11ShellAdapter_1 = require("./infrastructure/x11/X11ShellAdapter");
const JsonFileCache_1 = require("./infrastructure/cache/JsonFileCache");
const JsonFileConfigProvider_1 = require("./infrastructure/config/JsonFileConfigProvider");
const UdpDaemon_1 = require("./infrastructure/daemon/UdpDaemon");
const PORT = 12345;
const HOST = '127.0.0.1';
const shell = new X11ShellAdapter_1.X11ShellAdapter();
const cache = new JsonFileCache_1.JsonFileCache();
const configProvider = new JsonFileConfigProvider_1.JsonFileConfigProvider();
const tilingUseCase = new TilingUseCase_1.TilingUseCase(shell, cache, configProvider);
const daemon = new UdpDaemon_1.UdpDaemon(tilingUseCase, PORT, HOST);
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
            tilingUseCase.tile(args[1]);
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
            tilingUseCase.tile(`shift-${args[1]}`);
        }
        catch (error) {
            console.error('Shift Error:', error.message);
            process.exit(1);
        }
        break;
    case 'restore':
        try {
            tilingUseCase.restore();
            console.log('Window geometry restored successfully.');
        }
        catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        }
        break;
    case 'clear':
        try {
            tilingUseCase.clearCache();
            console.log('Cache cleared successfully.');
        }
        catch (error) {
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
        }
        catch (error) {
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
