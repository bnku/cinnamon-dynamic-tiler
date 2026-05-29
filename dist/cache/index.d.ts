import { Geometry, WindowState, CachedWindowState } from '../engine/types';
export declare class CacheManager {
    private static readonly CACHE_DIR;
    private static readonly CACHE_FILE;
    /**
     * Инициализирует директорию кэша
     */
    private static ensureCacheDir;
    /**
     * Считывает весь кэш из файла
     */
    private static readAllCache;
    /**
     * Записывает весь кэш в файл
     */
    private static writeAllCache;
    /**
     * Получает все кэшированные окна
     */
    static getAllCachedWindows(): Record<string, CachedWindowState>;
    /**
     * Получает сохраненное состояние для конкретного окна
     */
    static getState(windowId: string): CachedWindowState | null;
    /**
     * Сохраняет состояние для конкретного окна
     */
    static saveState(windowId: string, state: WindowState, tiledGeometry: Geometry, originalGeometry: Geometry): void;
    /**
     * Удаляет состояние конкретного окна
     */
    static clearState(windowId: string): void;
}
