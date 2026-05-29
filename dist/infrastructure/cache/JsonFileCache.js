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
exports.JsonFileCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class JsonFileCache {
    cacheDir = path.join(os.homedir(), '.cache', 'dynamic-tiler');
    cacheFile = path.join(this.cacheDir, 'state.json');
    ensureCacheDir() {
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    readAllCache() {
        this.ensureCacheDir();
        if (!fs.existsSync(this.cacheFile)) {
            return {};
        }
        try {
            const content = fs.readFileSync(this.cacheFile, 'utf8');
            return JSON.parse(content) || {};
        }
        catch {
            return {};
        }
    }
    writeAllCache(cache) {
        this.ensureCacheDir();
        try {
            fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
        }
        catch (error) {
            // Игнорируем ошибки записи
        }
    }
    getCachedWindow(windowId) {
        const cache = this.readAllCache();
        return cache[windowId] || null;
    }
    getAllCachedWindows() {
        return this.readAllCache();
    }
    saveState(windowId, state, tiledGeometry, originalGeometry) {
        const cache = this.readAllCache();
        cache[windowId] = {
            windowId,
            state,
            tiledGeometry,
            originalGeometry,
            lastUpdated: Date.now(),
        };
        this.writeAllCache(cache);
    }
    clearState(windowId) {
        const cache = this.readAllCache();
        if (cache[windowId]) {
            delete cache[windowId];
            this.writeAllCache(cache);
        }
    }
}
exports.JsonFileCache = JsonFileCache;
