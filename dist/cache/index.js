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
exports.CacheManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class CacheManager {
    static CACHE_DIR = path.join(os.homedir(), '.cache', 'dynamic-tiler');
    static CACHE_FILE = path.join(this.CACHE_DIR, 'state.json');
    /**
     * Инициализирует директорию кэша
     */
    static ensureCacheDir() {
        if (!fs.existsSync(this.CACHE_DIR)) {
            fs.mkdirSync(this.CACHE_DIR, { recursive: true });
        }
    }
    /**
     * Считывает весь кэш из файла
     */
    static readAllCache() {
        this.ensureCacheDir();
        if (!fs.existsSync(this.CACHE_FILE)) {
            return {};
        }
        try {
            const content = fs.readFileSync(this.CACHE_FILE, 'utf8');
            return JSON.parse(content) || {};
        }
        catch {
            // Если файл поврежден, возвращаем пустую базу
            return {};
        }
    }
    /**
     * Записывает весь кэш в файл
     */
    static writeAllCache(cache) {
        this.ensureCacheDir();
        try {
            fs.writeFileSync(this.CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
        }
        catch (error) {
            // Игнорируем ошибки записи, чтобы не ломать основной процесс тайлинга
        }
    }
    /**
     * Получает все кэшированные окна
     */
    static getAllCachedWindows() {
        return this.readAllCache();
    }
    /**
     * Получает сохраненное состояние для конкретного окна
     */
    static getState(windowId) {
        const cache = this.readAllCache();
        return cache[windowId] || null;
    }
    /**
     * Сохраняет состояние для конкретного окна
     */
    static saveState(windowId, state, tiledGeometry, originalGeometry) {
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
    /**
     * Удаляет состояние конкретного окна
     */
    static clearState(windowId) {
        const cache = this.readAllCache();
        if (cache[windowId]) {
            delete cache[windowId];
            this.writeAllCache(cache);
        }
    }
}
exports.CacheManager = CacheManager;
