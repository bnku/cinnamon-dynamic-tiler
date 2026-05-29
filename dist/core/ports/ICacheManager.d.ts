import { WindowState, Geometry, CachedWindowState } from '../types';
export interface ICacheManager {
    saveState(windowId: string, state: WindowState, tiledGeom: Geometry, originalGeom: Geometry): void;
    getCachedWindow(windowId: string): CachedWindowState | null;
    getAllCachedWindows(): Record<string, CachedWindowState>;
    clearState(windowId: string): void;
}
