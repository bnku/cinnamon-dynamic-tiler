import { Geometry, WindowState, CachedWindowState } from '../../core/types';
import { ICacheManager } from '../../core/ports/ICacheManager';
export declare class JsonFileCache implements ICacheManager {
    private readonly cacheDir;
    private readonly cacheFile;
    private ensureCacheDir;
    private readAllCache;
    private writeAllCache;
    getCachedWindow(windowId: string): CachedWindowState | null;
    getAllCachedWindows(): Record<string, CachedWindowState>;
    saveState(windowId: string, state: WindowState, tiledGeometry: Geometry, originalGeometry: Geometry): void;
    clearState(windowId: string): void;
}
