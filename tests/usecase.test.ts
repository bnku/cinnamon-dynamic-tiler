import { TilingUseCase } from '../src/core/usecases/TilingUseCase';
import { CachedWindowState, Config, Geometry, ScreenInfo, WindowState } from '../src/core/types';
import { ICacheManager } from '../src/core/ports/ICacheManager';
import { IShellAdapter } from '../src/core/ports/IShellAdapter';
import { IConfigProvider } from '../src/core/ports/IConfigProvider';
import { TilingEngine } from '../src/core/TilingEngine';

class FakeCache implements ICacheManager {
  public cache: Record<string, CachedWindowState> = {};

  public saveState(windowId: string, state: WindowState, tiledGeom: Geometry, originalGeom: Geometry): void {
    this.cache[windowId] = {
      windowId,
      state,
      tiledGeometry: tiledGeom,
      originalGeometry: originalGeom,
      lastUpdated: Date.now()
    };
  }

  public getCachedWindow(windowId: string): CachedWindowState | null {
    return this.cache[windowId] || null;
  }

  public getAllCachedWindows(): Record<string, CachedWindowState> {
    return this.cache;
  }

  public clearState(windowId: string): void {
    delete this.cache[windowId];
  }
}

class FakeConfigProvider implements IConfigProvider {
  constructor(private config: Config) {}

  public getConfig(): Config {
    return this.config;
  }
}

class FakeShell implements IShellAdapter {
  public applied: Record<string, Geometry> = {};
  public raised: string[] = [];

  constructor(
    private activeId: string,
    private geometries: Record<string, Geometry>,
    private visibleIds: string[],
    private monitors: ScreenInfo[]
  ) {}

  public getActiveWindowId(): string {
    return this.activeId;
  }

  public getWindowGeometry(id: string): Geometry {
    return this.geometries[id];
  }

  public getFrameExtents(): { left: number; right: number; top: number; bottom: number } {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  public getVisibleWindowIds(): string[] {
    return this.visibleIds;
  }

  public getActiveMonitors(): ScreenInfo[] {
    return this.monitors;
  }

  public findMonitorForWindow(): ScreenInfo {
    return this.monitors[0];
  }

  public applyGeometry(id: string, geom: Geometry): void {
    this.applied[id] = geom;
    this.geometries[id] = geom;
  }

  public unmaximizeWindow(): void {}

  public raiseWindow(id: string): void {
    this.raised.push(id);
  }
}

describe('TilingUseCase keyboard UX', () => {
  const config: Config = {
    gridSize: 12,
    minSpan: 2,
    step: 1,
    gaps: 0
  };
  const monitor: ScreenInfo = {
    id: '0',
    width: 1200,
    height: 900,
    x: 0,
    y: 0,
    workarea: {
      x: 0,
      y: 0,
      width: 1200,
      height: 900
    }
  };

  const state = (hSpan: [number, number], vSpan: [number, number] = [0, 12]): WindowState => ({
    hIndex: TilingEngine.spanToHIndex(hSpan),
    vIndex: TilingEngine.spanToVIndex(vSpan),
    hSpan,
    vSpan,
    lastDirection: 'right'
  });

  test('continues keyboard resize from the active window physical shape after manual resizing', () => {
    const cache = new FakeCache();
    const leftStackState = state([2, 4]);
    const chromeState = state([4, 6]);
    const chatCachedState = state([10, 12]);
    const chatPhysicalState = state([6, 12]);

    cache.saveState('left-stack', leftStackState, TilingEngine.stateToGeometry(leftStackState, monitor, config), { x: 200, y: 0, width: 200, height: 900 });
    cache.saveState('chrome', chromeState, TilingEngine.stateToGeometry(chromeState, monitor, config), { x: 400, y: 0, width: 200, height: 900 });
    cache.saveState('chat', chatCachedState, TilingEngine.stateToGeometry(chatCachedState, monitor, config), { x: 1000, y: 0, width: 200, height: 900 });

    const shell = new FakeShell(
      'chat',
      {
        'left-stack': TilingEngine.stateToGeometry(leftStackState, monitor, config),
        chrome: TilingEngine.stateToGeometry(chromeState, monitor, config),
        chat: TilingEngine.stateToGeometry(chatPhysicalState, monitor, config)
      },
      ['left-stack', 'chrome', 'chat'],
      [monitor]
    );
    const useCase = new TilingUseCase(shell, cache, new FakeConfigProvider(config));

    useCase.tile('right');

    expect(shell.applied.chrome).toEqual(TilingEngine.stateToGeometry(state([4, 7]), monitor, config));
    expect(shell.applied.chat).toEqual(TilingEngine.stateToGeometry(state([7, 12]), monitor, config));
    expect(shell.applied['left-stack']).toEqual(TilingEngine.stateToGeometry(leftStackState, monitor, config));
  });
});
