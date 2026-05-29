import { TilingEngine } from '../src/engine';
import { ScreenInfo, WindowState, Config } from '../src/engine/types';

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
      vIndex: 3,
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

  test('should decrease hIndex on repeated left presses down to 0', () => {
    let state = TilingEngine.getDefaultState();

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 6]);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 4]);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 3]);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hSpan).toEqual([0, 3]);
  });

  test('should smart snap to sibling edge and occupy maximum 1/2 of screen', () => {
    // Есть окно A, занимающее левую треть [0, 3] (уже сжато до предела)
    const winA: WindowState = {
      hIndex: 0,
      vIndex: 3,
      hSpan: [0, 3],
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

    // Окно B должно прилипнуть к правому краю A (3) и занять ровно 1/2 экрана (6 колонок), т.е. [3, 9]
    expect(nextStateB.hSpan).toEqual([3, 9]);
    expect(nextStateB.lastDirection).toBe('right');
  });

  test('should compress active window in place instead of overlapping if sibling is at minimum size', () => {
    // Окно A [0, 3] (минимум) и окно B [3, 12] (ширина 9)
    const winA: { windowId: string; state: WindowState } = {
      windowId: 'winA',
      state: {
        hIndex: 0,
        vIndex: 3,
        hSpan: [0, 3],
        vSpan: [0, 12],
        lastDirection: 'left'
      }
    };
    const winB: { windowId: string; state: WindowState } = {
      windowId: 'winB',
      state: {
        hIndex: 6, // [3, 12]
        vIndex: 3,
        hSpan: [3, 12],
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

    expect(chain1['winB'].hSpan).toEqual([3, 9]);
    expect(chain1['winA'].hSpan).toEqual([0, 3]); // Сосед A не изменился

    const winB_step1 = { windowId: 'winB', state: chain1['winB'] };
    const chain2 = TilingEngine.calculateChainTransitions(
      'winB',
      'left',
      fakeConfig,
      [winA, winB_step1]
    );

    expect(chain2['winB'].hSpan).toEqual([3, 6]);
  });

  test('should propagate compression chain for 3 windows', () => {
    // 3 окна: A [0, 4], B [4, 8], C [8, 12]
    const winA = {
      windowId: 'winA',
      state: { hIndex: 1, vIndex: 3, hSpan: [0, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 5, vIndex: 3, hSpan: [4, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 8, vIndex: 3, hSpan: [8, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    expect(chain['winA'].hSpan).toEqual([0, 6]);
    expect(chain['winB'].hSpan).toEqual([6, 9]);
    expect(chain['winC'].hSpan).toEqual([9, 12]);
  });

  test('should smoothly expand custom span window without massive jumps', () => {
    const stateCustom: WindowState = {
      hIndex: 5,
      vIndex: 3,
      hSpan: [6, 9],
      vSpan: [0, 12],
      lastDirection: 'right'
    };

    const nextStateRight = TilingEngine.calculateNextState(stateCustom, 'right', fakeConfig);
    expect(nextStateRight.hSpan).toEqual([6, 12]);

    const nextStateLeft = TilingEngine.calculateNextState(stateCustom, 'left', fakeConfig);
    expect(nextStateLeft.hSpan).toEqual([3, 9]);
  });

  test('should find the nearest free gap on the screen instead of stretching to 1/2 of screen and overlapping', () => {
    // 3 окна уже занимают [0, 3], [3, 6], [6, 9]. Правая часть [9, 12] абсолютно свободна
    const winA = { hSpan: [0, 3] as [number, number], vSpan: [0, 12] as [number, number] };
    const winB = { hSpan: [3, 6] as [number, number], vSpan: [0, 12] as [number, number] };
    const winC = { hSpan: [6, 9] as [number, number], vSpan: [0, 12] as [number, number] };

    // Тайлим 4-е окно вправо (right). Оно должно найти свободный стык справа [9, 12] и встать туда!
    const nextState = TilingEngine.calculateNextState(
      TilingEngine.getDefaultState(),
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    expect(nextState.hSpan).toEqual([9, 12]);
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

    // 1. Окно [3, 6] с небольшими отклонениями из-за теней (3250 вместо 3240, ширина 960)
    const geom1 = { x: 3250, y: 0, width: 960, height: 1080 };
    const hSpan1 = TilingEngine.geometryToHSpan(geom1, monitor);
    expect(hSpan1).toEqual([3, 6]);

    // 2. Окно [6, 9] (4200, ширина 960)
    const geom2 = { x: 4200, y: 0, width: 960, height: 1080 };
    const hSpan2 = TilingEngine.geometryToHSpan(geom2, monitor);
    expect(hSpan2).toEqual([6, 9]);

    // 3. Окно [0, 3] (2280, width 960)
    const geom3 = { x: 2280, y: 0, width: 960, height: 1080 };
    const hSpan3 = TilingEngine.geometryToHSpan(geom3, monitor);
    expect(hSpan3).toEqual([0, 3]);
  });

  test('should allow active window at [0, 3] to expand right by shifting neighbors [3, 6] and [6, 9] into free space [9, 12]', () => {
    // 3 затайленных окна на мониторе
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 3, hSpan: [0, 3] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 0, vIndex: 3, hSpan: [3, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 0, vIndex: 3, hSpan: [6, 9] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    // Так как справа [9, 12] абсолютно свободно, winA должен расшириться до [0, 4]
    // Соседи сдвинутся вправо: winB -> [4, 7], winC -> [7, 10]
    expect(chain['winA'].hSpan).toEqual([0, 4]);
    expect(chain['winB'].hSpan).toEqual([4, 7]);
    expect(chain['winC'].hSpan).toEqual([7, 10]);
  });
});
