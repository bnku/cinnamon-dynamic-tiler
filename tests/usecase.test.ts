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

  const state = (
    hSpan: [number, number],
    vSpan: [number, number] = [0, 12],
    lastDirection: WindowState['lastDirection'] = 'right'
  ): WindowState => ({
    hIndex: TilingEngine.spanToHIndex(hSpan),
    vIndex: TilingEngine.spanToVIndex(vSpan),
    hSpan,
    vSpan,
    lastDirection
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

  test('undoes the previous vertical keyboard resize when the next key is the opposite direction', () => {
    const cache = new FakeCache();
    const topState = state([0, 12], [0, 4], 'down');
    const middleState = state([0, 12], [4, 8], 'down');
    const bottomState = state([0, 12], [8, 12], 'down');

    cache.saveState('top', topState, TilingEngine.stateToGeometry(topState, monitor, config), { x: 0, y: 0, width: 1200, height: 300 });
    cache.saveState('middle', middleState, TilingEngine.stateToGeometry(middleState, monitor, config), { x: 0, y: 300, width: 1200, height: 300 });
    cache.saveState('bottom', bottomState, TilingEngine.stateToGeometry(bottomState, monitor, config), { x: 0, y: 600, width: 1200, height: 300 });

    const shell = new FakeShell(
      'middle',
      {
        top: TilingEngine.stateToGeometry(topState, monitor, config),
        middle: TilingEngine.stateToGeometry(middleState, monitor, config),
        bottom: TilingEngine.stateToGeometry(bottomState, monitor, config)
      },
      ['top', 'middle', 'bottom'],
      [monitor]
    );
    const useCase = new TilingUseCase(shell, cache, new FakeConfigProvider(config));

    useCase.tile('down');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(state([0, 12], [4, 9], 'down'), monitor, config));
    expect(shell.applied.bottom).toEqual(TilingEngine.stateToGeometry(state([0, 12], [9, 12], 'down'), monitor, config));

    useCase.tile('up');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(middleState, monitor, config));
    expect(shell.applied.bottom).toEqual(TilingEngine.stateToGeometry(bottomState, monitor, config));
  });

  test('undoes the previous horizontal keyboard resize when the next key is the opposite direction', () => {
    const cache = new FakeCache();
    const leftState = state([0, 4]);
    const middleState = state([4, 8]);
    const rightState = state([8, 12]);

    cache.saveState('left', leftState, TilingEngine.stateToGeometry(leftState, monitor, config), { x: 0, y: 0, width: 400, height: 900 });
    cache.saveState('middle', middleState, TilingEngine.stateToGeometry(middleState, monitor, config), { x: 400, y: 0, width: 400, height: 900 });
    cache.saveState('right', rightState, TilingEngine.stateToGeometry(rightState, monitor, config), { x: 800, y: 0, width: 400, height: 900 });

    const shell = new FakeShell(
      'middle',
      {
        left: TilingEngine.stateToGeometry(leftState, monitor, config),
        middle: TilingEngine.stateToGeometry(middleState, monitor, config),
        right: TilingEngine.stateToGeometry(rightState, monitor, config)
      },
      ['left', 'middle', 'right'],
      [monitor]
    );
    const useCase = new TilingUseCase(shell, cache, new FakeConfigProvider(config));

    useCase.tile('right');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(state([4, 9]), monitor, config));
    expect(shell.applied.right).toEqual(TilingEngine.stateToGeometry(state([9, 12]), monitor, config));

    useCase.tile('left');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(middleState, monitor, config));
    expect(shell.applied.right).toEqual(TilingEngine.stateToGeometry(rightState, monitor, config));
  });

  test('keeps a short undo stack for repeated keyboard resizes on the same axis', () => {
    const cache = new FakeCache();
    const topState = state([0, 12], [0, 4], 'up');
    const middleState = state([0, 12], [4, 8], 'up');
    const bottomState = state([0, 12], [8, 12], 'up');

    cache.saveState('top', topState, TilingEngine.stateToGeometry(topState, monitor, config), { x: 0, y: 0, width: 1200, height: 300 });
    cache.saveState('middle', middleState, TilingEngine.stateToGeometry(middleState, monitor, config), { x: 0, y: 300, width: 1200, height: 300 });
    cache.saveState('bottom', bottomState, TilingEngine.stateToGeometry(bottomState, monitor, config), { x: 0, y: 600, width: 1200, height: 300 });

    const shell = new FakeShell(
      'middle',
      {
        top: TilingEngine.stateToGeometry(topState, monitor, config),
        middle: TilingEngine.stateToGeometry(middleState, monitor, config),
        bottom: TilingEngine.stateToGeometry(bottomState, monitor, config)
      },
      ['top', 'middle', 'bottom'],
      [monitor]
    );
    const useCase = new TilingUseCase(shell, cache, new FakeConfigProvider(config));

    useCase.tile('up');
    useCase.tile('up');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(state([0, 12], [2, 8], 'up'), monitor, config));
    expect(shell.applied.top).toEqual(TilingEngine.stateToGeometry(state([0, 12], [0, 2], 'up'), monitor, config));

    useCase.tile('down');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(state([0, 12], [3, 8], 'up'), monitor, config));
    expect(shell.applied.top).toEqual(TilingEngine.stateToGeometry(state([0, 12], [0, 3], 'up'), monitor, config));

    useCase.tile('down');
    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(middleState, monitor, config));
    expect(shell.applied.top).toEqual(TilingEngine.stateToGeometry(topState, monitor, config));
  });

  test('lets the opposite direction resize normally after the undo window expires', () => {
    const now = jest.spyOn(Date, 'now');
    now.mockReturnValue(1_000);

    const cache = new FakeCache();
    const topState = state([0, 12], [0, 4], 'down');
    const middleState = state([0, 12], [4, 8], 'down');
    const bottomState = state([0, 12], [8, 12], 'down');

    cache.saveState('top', topState, TilingEngine.stateToGeometry(topState, monitor, config), { x: 0, y: 0, width: 1200, height: 300 });
    cache.saveState('middle', middleState, TilingEngine.stateToGeometry(middleState, monitor, config), { x: 0, y: 300, width: 1200, height: 300 });
    cache.saveState('bottom', bottomState, TilingEngine.stateToGeometry(bottomState, monitor, config), { x: 0, y: 600, width: 1200, height: 300 });

    const shell = new FakeShell(
      'middle',
      {
        top: TilingEngine.stateToGeometry(topState, monitor, config),
        middle: TilingEngine.stateToGeometry(middleState, monitor, config),
        bottom: TilingEngine.stateToGeometry(bottomState, monitor, config)
      },
      ['top', 'middle', 'bottom'],
      [monitor]
    );
    const useCase = new TilingUseCase(shell, cache, new FakeConfigProvider(config));

    useCase.tile('down');
    now.mockReturnValue(4_000);
    useCase.tile('up');

    expect(shell.applied.middle).toEqual(TilingEngine.stateToGeometry(state([0, 12], [3, 9], 'up'), monitor, config));
    expect(shell.applied.top).toEqual(TilingEngine.stateToGeometry(state([0, 12], [0, 3], 'up'), monitor, config));

    now.mockRestore();
  });
});
