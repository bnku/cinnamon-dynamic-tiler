import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Geometry, WindowState, CachedWindowState } from '../../core/types';
import { ICacheManager } from '../../core/ports/ICacheManager';

export class JsonFileCache implements ICacheManager {
  private readonly cacheDir = path.join(os.homedir(), '.cache', 'dynamic-tiler');
  private readonly cacheFile = path.join(this.cacheDir, 'state.json');

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private readAllCache(): Record<string, CachedWindowState> {
    this.ensureCacheDir();
    if (!fs.existsSync(this.cacheFile)) {
      return {};
    }

    try {
      const content = fs.readFileSync(this.cacheFile, 'utf8');
      return JSON.parse(content) || {};
    } catch {
      return {};
    }
  }

  private writeAllCache(cache: Record<string, CachedWindowState>): void {
    this.ensureCacheDir();
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      // Игнорируем ошибки записи
    }
  }

  public getCachedWindow(windowId: string): CachedWindowState | null {
    const cache = this.readAllCache();
    return cache[windowId] || null;
  }

  public getAllCachedWindows(): Record<string, CachedWindowState> {
    return this.readAllCache();
  }

  public saveState(
    windowId: string,
    state: WindowState,
    tiledGeometry: Geometry,
    originalGeometry: Geometry
  ): void {
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

  public clearState(windowId: string): void {
    const cache = this.readAllCache();
    if (cache[windowId]) {
      delete cache[windowId];
      this.writeAllCache(cache);
    }
  }
}
