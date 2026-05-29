import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Geometry, WindowState, CachedWindowState } from '../engine/types';

export class CacheManager {
  private static readonly CACHE_DIR = path.join(os.homedir(), '.cache', 'dynamic-tiler');
  private static readonly CACHE_FILE = path.join(this.CACHE_DIR, 'state.json');

  /**
   * Инициализирует директорию кэша
   */
  private static ensureCacheDir(): void {
    if (!fs.existsSync(this.CACHE_DIR)) {
      fs.mkdirSync(this.CACHE_DIR, { recursive: true });
    }
  }

  /**
   * Считывает весь кэш из файла
   */
  private static readAllCache(): Record<string, CachedWindowState> {
    this.ensureCacheDir();
    if (!fs.existsSync(this.CACHE_FILE)) {
      return {};
    }

    try {
      const content = fs.readFileSync(this.CACHE_FILE, 'utf8');
      return JSON.parse(content) || {};
    } catch {
      // Если файл поврежден, возвращаем пустую базу
      return {};
    }
  }

  /**
   * Записывает весь кэш в файл
   */
  private static writeAllCache(cache: Record<string, CachedWindowState>): void {
    this.ensureCacheDir();
    try {
      fs.writeFileSync(this.CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      // Игнорируем ошибки записи, чтобы не ломать основной процесс тайлинга
    }
  }

  /**
   * Получает сохраненное состояние для конкретного окна
   */
  public static getState(windowId: string): CachedWindowState | null {
    const cache = this.readAllCache();
    return cache[windowId] || null;
  }

  /**
   * Сохраняет состояние для конкретного окна
   */
  public static saveState(
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

  /**
   * Удаляет состояние конкретного окна
   */
  public static clearState(windowId: string): void {
    const cache = this.readAllCache();
    if (cache[windowId]) {
      delete cache[windowId];
      this.writeAllCache(cache);
    }
  }
}
