import { TilingEngine } from '../src/core/TilingEngine';
import { ScreenInfo, WindowState, Config } from '../src/core/types';

describe('TilingEngine - 12-Column Layout Calculations', () => {
  const fakeScreen: ScreenInfo = {
    id: 'HDMI-1',
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    workarea: {
      x: 0,
      y: 40,
      width: 1920,
      height: 1040,
    },
  };

  const fakeConfig: Config = {
    horizontalFractions: [2, 3, 4],
    verticalFractions: [2, 3, 4],
    gaps: 0,
  };

  test('should return default state', () => {
    const defaultState = TilingEngine.getDefaultState();
    expect(defaultState).toEqual({
      hIndex: 5,
      vIndex: 5,
      hSpan: [0, 12],
      vSpan: [0, 12],
      lastDirection: null,
    });
  });

  test('should handle first left keypress', () => {
    const startState = TilingEngine.getDefaultState();
    const nextState = TilingEngine.calculateNextState(startState, 'left', fakeConfig);

    expect(nextState.hSpan).toEqual([0, 6]);
    expect(nextState.vSpan).toEqual([0, 12]);
    expect(nextState.lastDirection).toBe('left');
  });

  test('should decrease hSpan on repeated left presses down to 2', () => {
    let state = TilingEngine.getDefaultState();

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 6]);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 4]);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 2]);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 2]);
  });

  test('should smart snap to sibling edge and occupy maximum 1/2 of screen', () => {
    // Есть окно A, занимающее левую часть [0, 2] (уже сжато до предела)
    const winA: WindowState = {
      hIndex: 0,
      vIndex: 5,
      hSpan: [0, 2],
      vSpan: [0, 12],
      lastDirection: 'left'
    };

    // Тайлим окно B влево
    const nextStateB = TilingEngine.calculateNextState(
      TilingEngine.getDefaultState(),
      'left',
      fakeConfig,
      [{ hSpan: winA.hSpan, vSpan: winA.vSpan }]
    );

    // Окно B должно прилипнуть к правому краю A (2) и занять ровно 1/2 экрана (6 колонок), т.е. [2, 8]
    expect(nextStateB.hSpan).toEqual([2, 8]);
    expect(nextStateB.lastDirection).toBe('right');
  });

  test('should compress active window in place instead of overlapping if sibling is at minimum size', () => {
    // Окно A [0, 2] (минимум) и окно B [2, 12] (ширина 10)
    const winA: { windowId: string; state: WindowState } = {
      windowId: 'winA',
      state: {
        hIndex: 0,
        vIndex: 5,
        hSpan: [0, 2],
        vSpan: [0, 12],
        lastDirection: 'left'
      }
    };
    const winB: { windowId: string; state: WindowState } = {
      windowId: 'winB',
      state: {
        hIndex: 6, // [2, 12]
        vIndex: 5,
        hSpan: [2, 12],
        vSpan: [0, 12],
        lastDirection: 'right'
      }
    };

    const chain1 = TilingEngine.calculateChainTransitions(
      'winB',
      'left',
      fakeConfig,
      [winA, winB]
    );

    expect(chain1['winB'].hSpan).toEqual([2, 8]);
    expect(chain1['winA'].hSpan).toEqual([0, 2]); // Сосед A не изменился

    // Теперь B сжался до [2, 4] (ширина 2 - минимальная)
    const winB_step1 = { 
      windowId: 'winB', 
      state: { ...winB.state, hSpan: [2, 4] as [number, number] } 
    };
    const chain2 = TilingEngine.calculateChainTransitions(
      'winB',
      'left',
      fakeConfig,
      [winA, winB_step1]
    );

    // В тупике окно B сожмется на месте до [2, 4]
    expect(chain2['winB'].hSpan).toEqual([2, 4]);
  });

  test('should propagate compression chain for 3 windows', () => {
    // 3 окна: A [0, 2], B [2, 4], C [4, 12] (ширина 8)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 6, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 8, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    // winA расширится до [0, 4] (шаг 2)
    // winB сдвинется до [4, 6]
    // winC сожмется до [6, 12] (ширина 6)
    expect(chain['winA'].hSpan).toEqual([0, 4]);
    expect(chain['winB'].hSpan).toEqual([4, 6]);
    expect(chain['winC'].hSpan).toEqual([6, 12]);
  });

  test('should smoothly expand custom span window without massive jumps', () => {
    const stateCustom: WindowState = {
      hIndex: 5,
      vIndex: 5,
      hSpan: [6, 8],
      vSpan: [0, 12],
      lastDirection: 'right'
    };

    const nextStateRight = TilingEngine.calculateNextState(stateCustom, 'right', fakeConfig);
    expect(nextStateRight.hSpan).toEqual([6, 10]);

    const nextStateLeft = TilingEngine.calculateNextState(stateCustom, 'left', fakeConfig);
    expect(nextStateLeft.hSpan).toEqual([4, 8]);
  });

  test('should find the nearest free gap on the screen instead of stretching to 1/2 of screen and overlapping', () => {
    // 3 окна уже занимают [0, 2], [2, 4], [4, 6]. Правая часть [6, 12] свободна
    const winA = { hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number] };
    const winB = { hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number] };
    const winC = { hSpan: [4, 6] as [number, number], vSpan: [0, 12] as [number, number] };

    // Тайлим 4-е окно вправо (right). Оно должно найти свободный стык справа [6, 12] (лимит 1/2 экрана = 6 колонок) и встать туда!
    const nextState = TilingEngine.calculateNextState(
      TilingEngine.getDefaultState(),
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    expect(nextState.hSpan).toEqual([6, 12]);
    expect(nextState.lastDirection).toBe('right');
  });

  test('should accurately convert physical geometry to logical spans with rounding threshold', () => {
    const monitor: ScreenInfo = {
      id: 'HDMI-0',
      width: 3840,
      height: 1080,
      x: 2280,
      y: 0,
      workarea: {
        x: 2280,
        y: 0,
        width: 3840,
        height: 1080,
      },
    };

    // 1. Окно [4, 8] с небольшими отклонениями из-за теней (3570 вместо 3560, ширина 1280)
    // 2280 + 4 * 320 = 3560. 2280 + 8 * 320 = 4840.
    const geom1 = { x: 3570, y: 0, width: 1280, height: 1080 };
    const hSpan1 = TilingEngine.geometryToHSpan(geom1, monitor);
    expect(hSpan1).toEqual([4, 8]);

    // 2. Окно [6, 12] (4200, ширина 1920)
    // 2280 + 6 * 320 = 4200.
    const geom2 = { x: 4200, y: 0, width: 1920, height: 1080 };
    const hSpan2 = TilingEngine.geometryToHSpan(geom2, monitor);
    expect(hSpan2).toEqual([6, 12]);

    // 3. Окно [0, 2] (2280, ширина 640)
    const geom3 = { x: 2280, y: 0, width: 640, height: 1080 };
    const hSpan3 = TilingEngine.geometryToHSpan(geom3, monitor);
    expect(hSpan3).toEqual([0, 2]);
  });

  test('should allow active window at [0, 2] to expand right by shifting neighbors [2, 4] and [4, 6] into free space [6, 12]', () => {
    // 3 затайленных окна на мониторе
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 0, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 0, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    // Так как справа [6, 12] свободно, winA должен расшириться до [0, 4] (шаг 2)
    // Соседи сдвинутся вправо на шаг 2: winB -> [4, 6], winC -> [6, 8]
    expect(chain['winA'].hSpan).toEqual([0, 4]);
    expect(chain['winB'].hSpan).toEqual([4, 6]);
    expect(chain['winC'].hSpan).toEqual([6, 8]);
  });

  test('should handle active window at [8, 12] expanding left and shifting neighbors [4, 8] and [0, 4]', () => {
    const winA = {
      windowId: 'winA',
      state: { hIndex: 1, vIndex: 5, hSpan: [0, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 7, vIndex: 5, hSpan: [4, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 8, vIndex: 5, hSpan: [8, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winC',
      'left',
      fakeConfig,
      [winA, winB, winC]
    );

    expect(chain['winC'].hSpan).toEqual([6, 12]);
    expect(chain['winB'].hSpan).toEqual([4, 6]);
    expect(chain['winA'].hSpan).toEqual([0, 4]);
  });

  test('should handle active window at [6, 12] expanding left and shifting neighbors [2, 6] and [0, 2]', () => {
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 2, vIndex: 5, hSpan: [2, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 8, vIndex: 5, hSpan: [6, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winC',
      'left',
      fakeConfig,
      [winA, winB, winC]
    );

    expect(chain['winC'].hSpan).toEqual([4, 12]);
    expect(chain['winB'].hSpan).toEqual([2, 4]);
    expect(chain['winA'].hSpan).toEqual([0, 2]);
  });

  test('should handle active window at [2, 6] expanding right and shifting neighbor [6, 10] into free space [10, 12]', () => {
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 2, vIndex: 5, hSpan: [2, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 8, vIndex: 5, hSpan: [6, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winB',
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    expect(chain['winB'].hSpan).toEqual([2, 8]);
    expect(chain['winC'].hSpan).toEqual([8, 12]);
    expect(chain['winA'].hSpan).toEqual([0, 2]);
  });
});
