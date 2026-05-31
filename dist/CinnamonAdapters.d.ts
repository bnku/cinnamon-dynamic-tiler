import { IShellAdapter } from './core/ports/IShellAdapter';
import { ICacheManager } from './core/ports/ICacheManager';
import { IConfigProvider } from './core/ports/IConfigProvider';
import { WindowState, Geometry, ScreenInfo, CachedWindowState, Config } from './core/types';
export declare class CinnamonCache implements ICacheManager {
    private cache;
    saveState(windowId: string, state: WindowState, tiledGeom: Geometry, originalGeom: Geometry): void;
    getCachedWindow(windowId: string): CachedWindowState | null;
    getAllCachedWindows(): Record<string, CachedWindowState>;
    clearState(windowId: string): void;
}
export declare class CinnamonConfigProvider implements IConfigProvider {
    private ext;
    constructor(ext: any);
    getConfig(): Config;
    getConfigForMonitor(monitor: ScreenInfo): Config;
    private buildConfig;
}
export declare class CinnamonShellAdapter implements IShellAdapter {
    private ext;
    constructor(ext: any);
    getActiveWindowId(): string;
    getWindowGeometry(id: string): Geometry;
    getFrameExtents(id: string): {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
    getVisibleWindowIds(): string[];
    getActiveMonitors(): ScreenInfo[];
    findMonitorForWindow(geom: Geometry, monitors: ScreenInfo[]): ScreenInfo;
    applyGeometry(id: string, geom: Geometry): void;
    unmaximizeWindow(id: string): void;
    raiseWindow(id: string): void;
    _findMetaWindow(stableSequence: string): any;
}
