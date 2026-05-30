import { Direction, WindowState } from '../types';
import { IShellAdapter } from '../ports/IShellAdapter';
import { ICacheManager } from '../ports/ICacheManager';
import { IConfigProvider } from '../ports/IConfigProvider';
import { TilingEngine } from '../TilingEngine';

export class TilingUseCase {
  constructor(
    private shell: IShellAdapter,
    private cache: ICacheManager,
    private configProvider: IConfigProvider
  ) {}

  public tile(direction: Direction): void {
    // 0. Получаем конфигурацию
    const config = this.configProvider.getConfig();

    // 1. Получаем ID активного окна
    const windowId = this.shell.getActiveWindowId();
    if (!windowId) {
      throw new Error('Could not retrieve active window ID.');
    }

    // 2. Получаем физическую геометрию окна, тени и список мониторов
    const windowGeom = this.shell.getWindowGeometry(windowId);
    const extents = this.shell.getFrameExtents(windowId);
    const monitors = this.shell.getActiveMonitors();

    // 3. Определяем текущий монитор активного окна
    const activeMonitor = this.shell.findMonitorForWindow(windowGeom, monitors);

    // 4. Сканируем видимые окна и фильтруем активные затайленные на этом мониторе
    const visibleWindowIds = this.shell.getVisibleWindowIds();
    const allCached = this.cache.getAllCachedWindows();
    const activeWindowsOnMonitor: { windowId: string; state: WindowState }[] = [];

    // Проверяем Smart Reset (ручное изменение размеров) только для самого АКТИВНОГО окна
    let activeWindowIsResized = false;
    const activeCached = allCached[windowId];
    if (activeCached) {
      try {
        const currentGeom = this.shell.getWindowGeometry(windowId);
        const ext = this.shell.getFrameExtents(windowId);
        const currentVisible = {
          x: currentGeom.x + ext.left,
          y: currentGeom.y + ext.top,
          width: currentGeom.width - ext.left - ext.right,
          height: currentGeom.height - ext.top - ext.bottom,
        };

        const diffX = Math.abs(currentVisible.x - activeCached.tiledGeometry.x);
        const diffY = Math.abs(currentVisible.y - activeCached.tiledGeometry.y);
        const diffW = Math.abs(currentVisible.width - activeCached.tiledGeometry.width);
        const diffH = Math.abs(currentVisible.height - activeCached.tiledGeometry.height);

        const THRESHOLD = 80;
        if (diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD) {
          activeWindowIsResized = true;
        }
      } catch {
        // Игнорируем ошибки для активного окна
      }
    }

    for (const id of visibleWindowIds) {
      if (id === windowId && activeWindowIsResized) {
        continue;
      }

      const cachedWin = allCached[id];
      if (!cachedWin) continue;

      let windowState = { ...cachedWin.state };
      
      let currentMonitor = activeMonitor;
      let currentGeom = cachedWin.tiledGeometry;
      try {
        currentGeom = this.shell.getWindowGeometry(id);
        const ext = this.shell.getFrameExtents(id);
        const currentVisible = {
          x: currentGeom.x + ext.left,
          y: currentGeom.y + ext.top,
          width: currentGeom.width - ext.left - ext.right,
          height: currentGeom.height - ext.top - ext.bottom,
        };
        currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);

        if (id !== windowId) {
          if (currentMonitor.id !== activeMonitor.id) {
            continue;
          }

          const diffX = Math.abs(currentVisible.x - cachedWin.tiledGeometry.x);
          const diffY = Math.abs(currentVisible.y - cachedWin.tiledGeometry.y);
          const diffW = Math.abs(currentVisible.width - cachedWin.tiledGeometry.width);
          const diffH = Math.abs(currentVisible.height - cachedWin.tiledGeometry.height);

          const THRESHOLD = 80;
          if (diffX > THRESHOLD || diffY > THRESHOLD || diffW > THRESHOLD || diffH > THRESHOLD) {
            const hSpan = TilingEngine.geometryToHSpan(currentVisible, currentMonitor, config);
            const vSpan = TilingEngine.geometryToVSpan(currentVisible, currentMonitor, config);
            
            windowState = {
              ...cachedWin.state,
              hSpan,
              vSpan,
              hIndex: TilingEngine.spanToHIndex(hSpan),
              vIndex: TilingEngine.spanToVIndex(vSpan)
            };
            
            this.cache.saveState(id, windowState, currentVisible, cachedWin.originalGeometry || currentGeom);
          }
        }
      } catch {
        currentMonitor = this.shell.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
        if (id !== windowId && currentMonitor.id !== activeMonitor.id) {
          continue;
        }
      }

      if (id === windowId) {
        const monitor = this.shell.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
        if (monitor.id !== activeMonitor.id) continue;
      }

      const isOldStateSchema = typeof (windowState as any).hIndex !== 'number' || typeof (windowState as any).vIndex !== 'number';
      if (isOldStateSchema) continue;

      activeWindowsOnMonitor.push({
        windowId: id,
        state: windowState
      });
    }

    // 5. Рассчитываем переходы цепного тайлинга окон
    const chainStates = TilingEngine.calculateChainTransitions(
      windowId,
      direction,
      config,
      activeWindowsOnMonitor
    );

    // 6. Применяем новые размеры сначала ко всем соседям цепочки
    for (const [id, nextState] of Object.entries(chainStates)) {
      if (id === windowId) continue;

      try {
        const cachedWin = allCached[id];
        const currentGeom = this.shell.getWindowGeometry(id);
        const originalGeom = cachedWin ? (cachedWin.originalGeometry || currentGeom) : currentGeom;

        const nextGeom = TilingEngine.stateToGeometry(nextState, activeMonitor, config);
        this.shell.unmaximizeWindow(id);
        this.shell.applyGeometry(id, nextGeom);
        this.cache.saveState(id, nextState, nextGeom, originalGeom);
      } catch {
        // Игнорируем ошибки для отдельных окон
      }
    }

    // 7. Применяем изменения к активному окну в конце
    const activeNextState = chainStates[windowId];
    if (activeNextState) {
      const cachedWin = allCached[windowId];
      const originalGeom = cachedWin ? (cachedWin.originalGeometry || windowGeom) : windowGeom;

      const nextGeom = TilingEngine.stateToGeometry(activeNextState, activeMonitor, config);
      try {
        this.shell.unmaximizeWindow(windowId);
        this.shell.applyGeometry(windowId, nextGeom);
        this.cache.saveState(windowId, activeNextState, nextGeom, originalGeom);
        this.shell.raiseWindow(windowId);
      } catch {
        // Игнорируем ошибки для активного окна
      }
    }
  }

  public restore(): void {
    const windowId = this.shell.getActiveWindowId();
    if (!windowId) {
      throw new Error('Could not retrieve active window ID.');
    }

    const cached = this.cache.getCachedWindow(windowId);
    if (cached && cached.originalGeometry) {
      this.shell.unmaximizeWindow(windowId);
      this.shell.applyGeometry(windowId, cached.originalGeometry);
      this.cache.clearState(windowId);
    } else {
      throw new Error('No original geometry saved for this window.');
    }
  }

  public clearCache(): void {
    const windowId = this.shell.getActiveWindowId();
    if (windowId) {
      this.cache.clearState(windowId);
    } else {
      throw new Error('Could not get active window ID for clearing cache.');
    }
  }
}
