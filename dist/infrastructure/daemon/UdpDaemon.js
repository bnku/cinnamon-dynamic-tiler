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
exports.UdpDaemon = void 0;
const dgram = __importStar(require("dgram"));
class UdpDaemon {
    tilingUseCase;
    port;
    host;
    server = null;
    constructor(tilingUseCase, port = 12345, host = '127.0.0.1') {
        this.tilingUseCase = tilingUseCase;
        this.port = port;
        this.host = host;
    }
    start() {
        this.server = dgram.createSocket('udp4');
        this.server.on('listening', () => {
            const address = this.server.address();
            console.log(`Dynamic Tiler Daemon successfully started on ${address.address}:${address.port}`);
        });
        this.server.on('message', (msg) => {
            const messageStr = msg.toString().trim();
            try {
                if (messageStr.startsWith('tile ')) {
                    const direction = messageStr.substring(5);
                    console.log(`[Daemon] Received tile command: ${direction}`);
                    this.tilingUseCase.tile(direction);
                }
                else if (messageStr.startsWith('shift ')) {
                    const subDir = messageStr.substring(6);
                    const direction = `shift-${subDir}`;
                    console.log(`[Daemon] Received shift command: ${direction}`);
                    this.tilingUseCase.tile(direction);
                }
                else if (messageStr === 'restore') {
                    console.log('[Daemon] Received restore command');
                    this.tilingUseCase.restore();
                }
                else if (messageStr === 'clear') {
                    console.log('[Daemon] Received clear command');
                    this.tilingUseCase.clearCache();
                }
                else if (messageStr === 'stop') {
                    console.log('[Daemon] Stopping daemon as requested...');
                    this.stop();
                    process.exit(0);
                }
            }
            catch (error) {
                console.error(`[Daemon Error] Failed to process message "${messageStr}":`, error.message);
            }
        });
        this.server.on('error', (err) => {
            console.error('[Daemon Error] Server error:', err.message);
            this.stop();
            process.exit(1);
        });
        this.server.bind(this.port, this.host);
    }
    stop() {
        if (this.server) {
            try {
                this.server.close();
            }
            catch {
                // Игнорируем
            }
            this.server = null;
        }
    }
    sendStopSignal() {
        const client = dgram.createSocket('udp4');
        client.send('stop', this.port, this.host, (err) => {
            client.close();
            if (err) {
                console.error('Error sending stop signal to daemon:', err.message);
                process.exit(1);
            }
            console.log('Stop signal sent to daemon.');
            process.exit(0);
        });
    }
}
exports.UdpDaemon = UdpDaemon;
