import { Config, Direction, Geometry, ScreenInfo, WindowState } from '../types';
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
    const configForMonitor = (monitor: ScreenInfo): Config =>
      this.configProvider.getConfigForMonitor
        ? this.configProvider.getConfigForMonitor(monitor)
        : config;

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
    const activeConfig = configForMonitor(activeMonitor);

    // 4. Сканируем видимые окна и фильтруем активные затайленные на этом мониторе
    const visibleWindowIds = this.shell.getVisibleWindowIds();
    const allCached = this.cache.getAllCachedWindows();
    const activeWindowsOnMonitor: { windowId: string; state: WindowState }[] = [];

    // Проверяем Smart Reset (ручное изменение размеров) только для самого АКТИВНОГО окна
    let activeWindowIsResized = false;
    let activeWindowPhysicalState: {
      state: WindowState;
      visibleGeometry: Geometry;
      frameGeometry: Geometry;
      monitor: ScreenInfo;
    } | null = null;
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
          const currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);
          const currentConfig = configForMonitor(currentMonitor);
          const hSpan = TilingEngine.geometryToHSpan(currentVisible, currentMonitor, currentConfig);
          const vSpan = TilingEngine.geometryToVSpan(currentVisible, currentMonitor, currentConfig);
          activeWindowPhysicalState = {
            state: {
              ...activeCached.state,
              hSpan,
              vSpan,
              hIndex: TilingEngine.spanToHIndex(hSpan),
              vIndex: TilingEngine.spanToVIndex(vSpan)
            },
            visibleGeometry: currentVisible,
            frameGeometry: currentGeom,
            monitor: currentMonitor
          };
        }
      } catch {
        // Игнорируем ошибки для активного окна
      }
    }

    for (const id of visibleWindowIds) {
      let cachedWin = allCached[id];
      if (!cachedWin) {
        try {
          const currentGeom = this.shell.getWindowGeometry(id);
          const ext = this.shell.getFrameExtents(id);
          const currentVisible = {
            x: currentGeom.x + ext.left,
            y: currentGeom.y + ext.top,
            width: currentGeom.width - ext.left - ext.right,
            height: currentGeom.height - ext.top - ext.bottom,
          };
          const currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);

          // Convert current physical geometry to logical grid spans
          const currentConfig = configForMonitor(currentMonitor);
          const hSpan = TilingEngine.geometryToHSpan(currentVisible, currentMonitor, currentConfig);
          const vSpan = TilingEngine.geometryToVSpan(currentVisible, currentMonitor, currentConfig);

          // Verify if window matches grid layout with small tolerance
          const testState = {
            hIndex: TilingEngine.spanToHIndex(hSpan),
            vIndex: TilingEngine.spanToVIndex(vSpan),
            hSpan,
            vSpan,
            lastDirection: null as any
          };
          const idealGeom = TilingEngine.stateToGeometry(testState, currentMonitor, currentConfig);

          const diffX = Math.abs(currentVisible.x - idealGeom.x);
          const diffY = Math.abs(currentVisible.y - idealGeom.y);
          const diffW = Math.abs(currentVisible.width - idealGeom.width);
          const diffH = Math.abs(currentVisible.height - idealGeom.height);

          const SNAP_THRESHOLD = 80; // High tolerance for matching grid structures
          if (diffX <= SNAP_THRESHOLD && diffY <= SNAP_THRESHOLD && diffW <= SNAP_THRESHOLD && diffH <= SNAP_THRESHOLD) {
            // Check if there is already a tiled window in the cache that overlaps with this span on the same monitor
            let hasOverlap = false;
            for (const [cachedId, cachedW] of Object.entries(allCached)) {
              if (cachedId === id) continue;

              let cachedMonitor = currentMonitor;
              try {
                const g = this.shell.getWindowGeometry(cachedId);
                cachedMonitor = this.shell.findMonitorForWindow(g, monitors);
              } catch {
                cachedMonitor = this.shell.findMonitorForWindow(cachedW.tiledGeometry, monitors);
              }

              if (cachedMonitor.id === currentMonitor.id) {
                const hasH = Math.max(hSpan[0], cachedW.state.hSpan[0]) < Math.min(hSpan[1], cachedW.state.hSpan[1]);
                const hasV = Math.max(vSpan[0], cachedW.state.vSpan[0]) < Math.min(vSpan[1], cachedW.state.vSpan[1]);
                if (hasH && hasV) {
                  hasOverlap = true;
                  break;
                }
              }
            }

            if (!hasOverlap) {
              const restoredState = {
                hIndex: TilingEngine.spanToHIndex(hSpan),
                vIndex: TilingEngine.spanToVIndex(vSpan),
                hSpan,
                vSpan,
                lastDirection: null as any
              };
              this.cache.saveState(id, restoredState, currentVisible, currentGeom);
              cachedWin = this.cache.getCachedWindow(id)!;
            }
          }
        } catch {
          // Ignore failures for individual windows
        }
      }

      if (!cachedWin) continue;

      let windowState = { ...cachedWin.state };
      
      let currentMonitor = activeMonitor;
      let currentGeom = cachedWin.tiledGeometry;
      if (id === windowId && activeWindowIsResized && activeWindowPhysicalState) {
        windowState = activeWindowPhysicalState.state;
        currentMonitor = activeWindowPhysicalState.monitor;
        currentGeom = activeWindowPhysicalState.frameGeometry;
        this.cache.saveState(
          id,
          windowState,
          activeWindowPhysicalState.visibleGeometry,
          cachedWin.originalGeometry || currentGeom
        );
      } else {
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
              const currentConfig = configForMonitor(currentMonitor);
              const hSpan = TilingEngine.geometryToHSpan(currentVisible, currentMonitor, currentConfig);
              const vSpan = TilingEngine.geometryToVSpan(currentVisible, currentMonitor, currentConfig);

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
      }

      if (id === windowId) {
        if (currentMonitor.id !== activeMonitor.id) continue;
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
      activeConfig,
      activeWindowsOnMonitor
    );

    // 6. Применяем новые размеры сначала ко всем соседям цепочки
    for (const [id, nextState] of Object.entries(chainStates)) {
      if (id === windowId) continue;

      try {
        const cachedWin = allCached[id];
        const currentGeom = this.shell.getWindowGeometry(id);
        const originalGeom = cachedWin ? (cachedWin.originalGeometry || currentGeom) : currentGeom;

        const nextGeom = TilingEngine.stateToGeometry(nextState, activeMonitor, activeConfig);
        this.shell.unmaximizeWindow(id);
        this.shell.applyGeometry(id, nextGeom);

        // Delay caching slightly to read the actual physical geometry from Mutter
        setTimeout(() => {
          try {
            const realGeom = this.shell.getWindowGeometry(id);
            this.cache.saveState(id, nextState, realGeom, originalGeom);
          } catch {
            this.cache.saveState(id, nextState, nextGeom, originalGeom);
          }
        }, 100);
      } catch {
        // Игнорируем ошибки для отдельных окон
      }
    }

    // 7. Применяем изменения к активному окну в конце
    const activeNextState = chainStates[windowId];
    if (activeNextState) {
      const cachedWin = allCached[windowId];
      const originalGeom = cachedWin ? (cachedWin.originalGeometry || windowGeom) : windowGeom;

      const nextGeom = TilingEngine.stateToGeometry(activeNextState, activeMonitor, activeConfig);
      try {
        this.shell.unmaximizeWindow(windowId);
        this.shell.applyGeometry(windowId, nextGeom);

        // Delay caching slightly to read the actual physical geometry from Mutter
        setTimeout(() => {
          try {
            const realGeom = this.shell.getWindowGeometry(windowId);
            this.cache.saveState(windowId, activeNextState, realGeom, originalGeom);
          } catch {
            this.cache.saveState(windowId, activeNextState, nextGeom, originalGeom);
          }
        }, 100);
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
