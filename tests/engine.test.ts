import { TilingEngine } from '../src/core/TilingEngine';
import { calculateDragTransitions, collapseVacancy, computeDragTarget, hasLayoutOverlaps, restoreDragTransaction, restoreDragTransactionHistory, shouldFloatAfterModifierRelease, solveDragTransitions } from '../src/DragTiling';
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
    gridSize: 12,
    minSpan: 2,
    step: 2,
    gaps: 0,
  };

  const canonicalStates = (states: Record<string, WindowState>) => Object.fromEntries(
    Object.entries(states)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, state]) => [id, { hSpan: state.hSpan, vSpan: state.vSpan }])
  );

  const deterministicPermutations = <T,>(items: T[]): T[][] => [
    [...items].reverse(),
    [...items.slice(1), items[0]],
    [...items.slice(2), ...items.slice(0, 2)]
  ];

  const expectStableDnDResultAcrossPermutations = (
    activeWindows: { windowId: string; state: WindowState }[],
    draggedId: string,
    targetHSpan: [number, number],
    targetVSpan: [number, number],
    options = {}
  ) => {
    const expected = solveDragTransitions(
      draggedId,
      targetHSpan,
      targetVSpan,
      fakeConfig,
      activeWindows,
      options
    );

    for (const permutation of deterministicPermutations(activeWindows)) {
      const result = solveDragTransitions(
        draggedId,
        targetHSpan,
        targetVSpan,
        fakeConfig,
        permutation,
        options
      );

      expect(result.status).toBe(expected.status);
      expect(result.reason).toBe(expected.reason);
      expect(result.affected).toEqual(expected.affected);
      expect(canonicalStates(result.states)).toEqual(canonicalStates(expected.states));
    }
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

  test('should softly compress active window in place instead of overlapping if sibling is at minimum size', () => {
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

    expect(chain1['winB'].hSpan).toEqual([2, 10]);
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

    // В тупике минимальное окно B останется на месте.
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

  test('should handle Corner Mode transitions (Left -> Down and Up -> Right)', () => {
    const state1: WindowState = {
      hIndex: 2,
      vIndex: 5,
      hSpan: [0, 6],
      vSpan: [0, 12],
      lastDirection: 'left'
    };

    const nextState1 = TilingEngine.calculateNextState(state1, 'down', fakeConfig);
    expect(nextState1.hSpan).toEqual([0, 6]);
    expect(nextState1.vSpan).toEqual([6, 12]);
    expect(nextState1.lastDirection).toBe('down');

    const state2: WindowState = {
      hIndex: 5,
      vIndex: 2,
      hSpan: [0, 12],
      vSpan: [0, 6],
      lastDirection: 'up'
    };

    const nextState2 = TilingEngine.calculateNextState(state2, 'right', fakeConfig);
    expect(nextState2.vSpan).toEqual([0, 6]);
    expect(nextState2.hSpan).toEqual([6, 12]);
    expect(nextState2.lastDirection).toBe('right');
  });

  test('should not affect horizontal neighbors that do not have vertical overlap', () => {
    // Окно A: [0, 2] по горизонтали, [0, 6] по вертикали (верхняя левая часть)
    // Окно B: [2, 12] по горизонтали, [6, 12] по вертикали (нижняя правая часть)
    // Они соприкасаются по горизонтали на x = 2, но НЕ перекрываются по вертикали (A: 0-6, B: 6-12)
    // Если окно A расширяется вправо, оно НЕ должно сдвигать или сжимать окно B, потому что они на разной высоте.
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 0, hSpan: [0, 2] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 6, vIndex: 6, hSpan: [2, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'right',
      fakeConfig,
      [winA, winB]
    );

    // winA расширится до [0, 4]
    // winB не должно измениться (hSpan останется [2, 12])
    expect(chain['winA'].hSpan).toEqual([0, 4]);
    expect(chain['winB'].hSpan).toEqual([2, 12]);
  });

  test('should clamp gaps to keep minimum window dimension at 100px', () => {
    const monitor: ScreenInfo = {
      id: 'HDMI-0',
      width: 1200,
      height: 1200,
      x: 0,
      y: 0,
      workarea: {
        x: 0,
        y: 0,
        width: 1200,
        height: 1200,
      },
    };

    // Окно занимает 1 колонку из 12 (100px) и 1 строку из 12 (100px)
    const state: WindowState = {
      hIndex: 0,
      vIndex: 0,
      hSpan: [0, 1], // ширина 100px
      vSpan: [0, 1], // высота 100px
      lastDirection: 'left'
    };

    // С gaps = 20, без ограничения ширина/высота стали бы 100 - 40 = 60px.
    // С ограничением они должны остаться ровно 100px (gapW/gapH станет 0).
    const geom = TilingEngine.stateToGeometry(state, monitor, { ...fakeConfig, gaps: 20 });
    expect(geom.width).toBe(100);
    expect(geom.height).toBe(100);
    expect(geom.x).toBe(0);
    expect(geom.y).toBe(0);

    // Окно занимает 2 колонки из 12 (200px)
    const state2: WindowState = {
      hIndex: 0,
      vIndex: 0,
      hSpan: [0, 2], // ширина 200px
      vSpan: [0, 2], // высота 200px
      lastDirection: 'left'
    };

    // С gaps = 30, без ограничения ширина стала бы 200 - 60 = 140px.
    // maxGap = (200 - 100) / 2 = 50px.
    // gapW = Math.min(30, 50) = 30px.
    // width = 200 - 60 = 140px. x = 30px.
    const geom2 = TilingEngine.stateToGeometry(state2, monitor, { ...fakeConfig, gaps: 30 });
    expect(geom2.width).toBe(140);
    expect(geom2.height).toBe(140);
    expect(geom2.x).toBe(30);
    expect(geom2.y).toBe(30);

    // С gaps = 60, без ограничения ширина стала бы 200 - 120 = 80px.
    // maxGap = (200 - 100) / 2 = 50px.
    // gapW = Math.min(60, 50) = 50px.
    // width = 200 - 100 = 100px. x = 50px.
    const geom3 = TilingEngine.stateToGeometry(state2, monitor, { ...fakeConfig, gaps: 60 });
    expect(geom3.width).toBe(100);
    expect(geom3.height).toBe(100);
    expect(geom3.x).toBe(50);
    expect(geom3.y).toBe(50);
  });

  test('should smart snap to a free 2D quadrant instead of shrinking or overlapping', () => {
    // Окно A: [0, 6] по горизонтали, [0, 6] по вертикали (верхняя левая четверть)
    const winA = { hSpan: [0, 6] as [number, number], vSpan: [0, 6] as [number, number] };

    // Новое окно тайлится влево (left). Левый верх свободный? Нет, занят окном A.
    // Но левый низ [0, 6] по горизонтали и [6, 12] по вертикали абсолютно свободен!
    // Оно должно занять именно эту свободную четверть [0, 6] x [6, 12]!
    const nextState = TilingEngine.calculateNextState(
      TilingEngine.getDefaultState(),
      'left',
      fakeConfig,
      [winA]
    );

    expect(nextState.hSpan).toEqual([0, 6]);
    expect(nextState.vSpan).toEqual([6, 12]);
  });

  test('should rebuild calculations for customizable grid config (e.g. 16x16, step 4, minSpan 4)', () => {
    const customConfig: Config = {
      gridSize: 16,
      minSpan: 4,
      step: 4,
      gaps: 0,
    };

    // 1. Первый тайлинг влево должен занять ровно половину сетки 16 (т.е. 8 колонок)
    const state1 = TilingEngine.calculateNextState(TilingEngine.getDefaultState(), 'left', customConfig);
    expect(state1.hSpan).toEqual([0, 8]);

    // 2. Повторное сжатие влево должно сдвинуть границу на шаг 4 (до ширины 4)
    const state2 = TilingEngine.calculateNextState(state1, 'left', customConfig);
    expect(state2.hSpan).toEqual([0, 4]);

    // 3. Дальнейшее сжатие должно упереться в minSpan: 4
    const state3 = TilingEngine.calculateNextState(state2, 'left', customConfig);
    expect(state3.hSpan).toEqual([0, 4]);
  });

  test('should support dynamic corner mode resize without jump when both dimensions are compressed', () => {
    // Окно уже в углу: [0, 6] по горизонтали, [6, 12] по вертикали (обе оси сжаты, меньше 12)
    const state: WindowState = {
      hIndex: 0,
      vIndex: 6,
      hSpan: [0, 6],
      vSpan: [6, 12],
      lastDirection: 'down' // Смена оси произойдет при нажатии 'right'
    };

    // Нажатие 'right' (смена оси с вертикальной на горизонтальную)
    // Поскольку обе оси сжаты, мы не должны телепортировать окно вправо, а должны эластично расширить hSpan до [0, 8]!
    const nextState = TilingEngine.calculateNextState(state, 'right', fakeConfig);
    expect(nextState.hSpan).toEqual([0, 8]);
    expect(nextState.vSpan).toEqual([6, 12]); // vSpan остался неизменным
    expect(nextState.lastDirection).toBe('right');
  });

  test('should accurately isolate propagation chains for multi-window staircases without vertical overlap', () => {
    // Три окна:
    // Окно A (активное): [0, 4] по горизонтали, [0, 6] по вертикали
    // Окно B: [4, 8] по горизонтали, [0, 6] по вертикали (касается A по X на 4, перекрывается по Y)
    // Окно C: [8, 12] по горизонтали, [6, 12] по вертикали (касается B по X на 8, но НЕ перекрывается с B по Y: B: 0-6, C: 6-12)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 0, vIndex: 0, hSpan: [0, 4] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: 'left' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 4, vIndex: 0, hSpan: [4, 8] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: 'right' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 8, vIndex: 6, hSpan: [8, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'right',
      fakeConfig,
      [winA, winB, winC]
    );

    // winA расширяется до [0, 6]
    // winB сдвигается до [6, 10] (так как справа свободно, оно сдвигается целиком, не сжимаясь)
    // winC НЕ ДОЛЖНО быть затронуто, так как между B и C нет пересечения по вертикали!
    expect(chain['winA'].hSpan).toEqual([0, 6]);
    expect(chain['winB'].hSpan).toEqual([6, 10]);
    expect(chain['winC'].hSpan).toEqual([8, 12]);
  });

  test('should propagate compression chain vertically for 3 windows stacked on top of each other', () => {
    // Три окна друг над другом:
    // Окно A: [0, 12] по горизонтали, [0, 4] по вертикали (верхнее)
    // Окно B: [0, 12] по горизонтали, [4, 8] по vertical (среднее)
    // Окно C (активное): [0, 12] по горизонтали, [8, 12] по vertical (нижнее)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 5, vIndex: 1, hSpan: [0, 12] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: 'up' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 5, vIndex: 3, hSpan: [0, 12] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: 'down' as const }
    };
    const winC = {
      windowId: 'winC',
      state: { hIndex: 5, vIndex: 8, hSpan: [0, 12] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: 'down' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winC',
      'up',
      fakeConfig,
      [winA, winB, winC]
    );

    // winC расширяется вверх до [6, 12] (шаг 2)
    // winB сдвигается вверх на 2 единицы до [4, 6] (сжимается до высоты 2)
    // winA сдвигается вверх до [0, 4] (остается без изменений, так как вверху свободно)
    expect(chain['winC'].vSpan).toEqual([6, 12]);
    expect(chain['winB'].vSpan).toEqual([4, 6]);
    expect(chain['winA'].vSpan).toEqual([0, 4]);
  });

  test('should pull sibling window when active window shrinks vertically', () => {
    // Окно A (активное, верхнее): [0, 12] x [0, 8]
    // Окно B (нижнее): [0, 12] x [8, 12] (прилипло к низу экрана 12)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 5, vIndex: 5, hSpan: [0, 12] as [number, number], vSpan: [0, 8] as [number, number], lastDirection: 'down' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 5, vIndex: 8, hSpan: [0, 12] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: 'down' as const }
    };

    // Окно A сжимается снизу-вверх: vSpan становится [0, 6]
    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'up',
      fakeConfig,
      [winA, winB]
    );

    // winA уменьшилось до [0, 6] (шаг 2)
    // winB притянулось вслед за ним до [6, 12] (расширилось, так как было прилипшим к нижнему краю)
    expect(chain['winA'].vSpan).toEqual([0, 6]);
    expect(chain['winB'].vSpan).toEqual([6, 12]);
  });

  test('should pull and shift sibling window when it is not clamped to the screen edge vertically', () => {
    // Окно A (активное, верхнее): [0, 12] x [0, 8]
    // Окно B (нижнее): [0, 12] x [8, 10] (не прилипло к низу экрана 12)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 5, vIndex: 5, hSpan: [0, 12] as [number, number], vSpan: [0, 8] as [number, number], lastDirection: 'down' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 5, vIndex: 8, hSpan: [0, 12] as [number, number], vSpan: [8, 10] as [number, number], lastDirection: 'down' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'up',
      fakeConfig,
      [winA, winB]
    );

    // winA уменьшилось до [0, 6]
    // winB притянулось до [6, 8] (сдвинулось целиком вверх, сохранив высоту 2)
    expect(chain['winA'].vSpan).toEqual([0, 6]);
    expect(chain['winB'].vSpan).toEqual([6, 8]);
  });

  test('should pull sibling window when active window shrinks horizontally', () => {
    // Окно A (активное, левое): [0, 8] x [0, 12]
    // Окно B (правое): [8, 12] x [0, 12] (прилипло к правому краю 12)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 5, vIndex: 5, hSpan: [0, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 8, vIndex: 5, hSpan: [8, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    // Окно A сжимается справа-налево: hSpan становится [0, 6]
    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'left',
      fakeConfig,
      [winA, winB]
    );

    // winA уменьшилось до [0, 6] (шаг 2)
    // winB притянулось вслед за ним до [6, 12] (расширилось, так как было прилипшим к правому краю)
    expect(chain['winA'].hSpan).toEqual([0, 6]);
    expect(chain['winB'].hSpan).toEqual([6, 12]);
  });

  test('should pull and shift sibling window when it is not clamped to the screen edge horizontally', () => {
    // Окно A (активное, левое): [0, 8] x [0, 12]
    // Окно B (правое): [8, 10] x [0, 12] (не прилипло к правому краю 12)
    const winA = {
      windowId: 'winA',
      state: { hIndex: 5, vIndex: 5, hSpan: [0, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const winB = {
      windowId: 'winB',
      state: { hIndex: 8, vIndex: 5, hSpan: [8, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'winA',
      'left',
      fakeConfig,
      [winA, winB]
    );

    // winA уменьшилось до [0, 6]
    // winB притянулось до [6, 8] (сдвинулось целиком влево, сохранив ширину 2)
    expect(chain['winA'].hSpan).toEqual([0, 6]);
    expect(chain['winB'].hSpan).toEqual([6, 8]);
  });

  test('should expand an anchored left sibling when the active right-edge window shrinks', () => {
    const leftStack = {
      windowId: 'leftStack',
      state: { hIndex: 2, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const chrome = {
      windowId: 'chrome',
      state: { hIndex: 5, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const chat = {
      windowId: 'chat',
      state: { hIndex: 8, vIndex: 5, hSpan: [6, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'chat',
      'right',
      fakeConfig,
      [leftStack, chrome, chat]
    );

    expect(chain['chat'].hSpan).toEqual([8, 12]);
    expect(chain['chrome'].hSpan).toEqual([4, 8]);
    expect(chain['leftStack'].hSpan).toEqual([2, 4]);
  });

  test('should softly shrink active window from the opposite edge when left expansion is blocked', () => {
    const stepOneConfig = { ...fakeConfig, step: 1 };
    const fileManager = {
      windowId: 'fileManager',
      state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const terminalStack = {
      windowId: 'terminalStack',
      state: { hIndex: 0, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const chrome = {
      windowId: 'chrome',
      state: { hIndex: 5, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const chat = {
      windowId: 'chat',
      state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'chrome',
      'left',
      stepOneConfig,
      [fileManager, terminalStack, chrome, chat]
    );

    expect(chain['chrome'].hSpan).toEqual([4, 9]);
    expect(chain['chat'].hSpan).toEqual([9, 12]);
    expect(chain['terminalStack'].hSpan).toEqual([2, 4]);
    expect(chain['fileManager'].hSpan).toEqual([0, 2]);
  });

  test('should softly shrink active window from the opposite edge when right expansion is blocked', () => {
    const stepOneConfig = { ...fakeConfig, step: 1 };
    const fileManager = {
      windowId: 'fileManager',
      state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'left' as const }
    };
    const terminalStack = {
      windowId: 'terminalStack',
      state: { hIndex: 0, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const chrome = {
      windowId: 'chrome',
      state: { hIndex: 5, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };
    const chat = {
      windowId: 'chat',
      state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: 'right' as const }
    };

    const chain = TilingEngine.calculateChainTransitions(
      'chrome',
      'right',
      stepOneConfig,
      [fileManager, terminalStack, chrome, chat]
    );

    expect(chain['chrome'].hSpan).toEqual([5, 10]);
    expect(chain['terminalStack'].hSpan).toEqual([2, 5]);
    expect(chain['fileManager'].hSpan).toEqual([0, 2]);
    expect(chain['chat'].hSpan).toEqual([10, 12]);
  });

  test('should handle first shift-up keypress', () => {
    const startState = TilingEngine.getDefaultState();
    const nextState = TilingEngine.calculateNextState(startState, 'shift-up', fakeConfig);

    expect(nextState.hSpan).toEqual([0, 12]);
    expect(nextState.vSpan).toEqual([0, 6]);
    expect(nextState.lastDirection).toBe('shift-up');
  });

  test('should handle first shift-down keypress', () => {
    const startState = TilingEngine.getDefaultState();
    const nextState = TilingEngine.calculateNextState(startState, 'shift-down', fakeConfig);

    expect(nextState.hSpan).toEqual([0, 12]);
    expect(nextState.vSpan).toEqual([6, 12]);
    expect(nextState.lastDirection).toBe('shift-down');
  });

  test('should handle Corner Mode transitions for shift-up and shift-down', () => {
    const stateLeft: WindowState = {
      hIndex: 0,
      vIndex: 5,
      hSpan: [0, 6],
      vSpan: [0, 12],
      lastDirection: 'left'
    };

    const nextStateShiftUp = TilingEngine.calculateNextState(stateLeft, 'shift-up', fakeConfig);
    expect(nextStateShiftUp.hSpan).toEqual([0, 6]);
    expect(nextStateShiftUp.vSpan).toEqual([0, 6]);
    expect(nextStateShiftUp.lastDirection).toBe('shift-up');

    const nextStateShiftDown = TilingEngine.calculateNextState(stateLeft, 'shift-down', fakeConfig);
    expect(nextStateShiftDown.hSpan).toEqual([0, 6]);
    expect(nextStateShiftDown.vSpan).toEqual([6, 12]);
    expect(nextStateShiftDown.lastDirection).toBe('shift-down');
  });

  test('DnD should insert a floating terminal to the right of a wide Chrome window without pushing Chrome over existing terminal columns', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal-top',
        state: { hIndex: 1, vIndex: 2, hSpan: [2, 4] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal-bottom',
        state: { hIndex: 1, vIndex: 8, hSpan: [2, 4] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'dragged-terminal',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows
    );

    expect(result['dragged-terminal'].hSpan).toEqual([10, 12]);
    expect(result['chrome'].hSpan).toEqual([4, 10]);
    expect(result['middle-terminal-top'].hSpan).toEqual([2, 4]);
    expect(result['middle-terminal-bottom'].hSpan).toEqual([2, 4]);
  });

  test('DnD should insert a floating terminal to the left of Chrome by shrinking Chrome rightward instead of wildly rearranging existing columns', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 1, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'dragged-terminal',
        state: { hIndex: 3, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [4, 6],
      [0, 12],
      fakeConfig,
      activeWindows
    );

    expect(result['dragged-terminal'].hSpan).toEqual([4, 6]);
    expect(result['chrome'].hSpan).toEqual([6, 12]);
    expect(result['middle-terminal'].hSpan).toEqual([2, 4]);
    expect(result['left-terminal'].hSpan).toEqual([0, 2]);
  });

  test('DnD should place a floating terminal in the top-right slot, move Chrome left, and leave bottom-right chat untouched', () => {
    const activeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chat',
        state: { hIndex: 9, vIndex: 8, hSpan: [8, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [10, 12],
      [0, 6],
      fakeConfig,
      activeWindows
    );

    expect(result['dragged-terminal'].hSpan).toEqual([10, 12]);
    expect(result['dragged-terminal'].vSpan).toEqual([0, 6]);
    expect(result['chat'].hSpan).toEqual([8, 12]);
    expect(result['chat'].vSpan).toEqual([6, 12]);
    expect(result['chrome'].hSpan).toEqual([4, 8]);
    expect(result['chrome'].vSpan).toEqual([0, 12]);
  });

  test('DnD should prefer horizontal carving over vertical collapse for a wide top-right drop target', () => {
    const activeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chat',
        state: { hIndex: 9, vIndex: 8, hSpan: [8, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [8, 12],
      [0, 6],
      fakeConfig,
      activeWindows
    );

    expect(result['dragged-terminal'].hSpan).toEqual([8, 12]);
    expect(result['dragged-terminal'].vSpan).toEqual([0, 6]);
    expect(result['chrome'].hSpan).toEqual([4, 8]);
    expect(result['chrome'].vSpan).toEqual([0, 12]);
    expect(result['chat'].hSpan).toEqual([8, 12]);
    expect(result['chat'].vSpan).toEqual([6, 12]);
  });

  test('DnD vacancy collapse should expand the squeezed Chrome into the freed top-right slot without touching bottom-right chat', () => {
    const activeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 3, vIndex: 5, hSpan: [4, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chat',
        state: { hIndex: 9, vIndex: 8, hSpan: [8, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'dragged-terminal',
        state: { hIndex: 8, vIndex: 2, hSpan: [8, 12] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      }
    ];

    const result = collapseVacancy('dragged-terminal', fakeConfig, activeWindows);

    expect(result['chrome'].hSpan).toEqual([4, 12]);
    expect(result['chrome'].vSpan).toEqual([0, 6]);
    expect(result['chat'].hSpan).toEqual([8, 12]);
    expect(result['chat'].vSpan).toEqual([6, 12]);
  });

  test('DnD vacancy collapse should keep a narrow vertical terminal stack intact instead of pulling Chrome sideways into the hole', () => {
    const makeActiveWindows = () => [
      {
        windowId: 'top-terminal',
        state: { hIndex: 1, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 1, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom-terminal',
        state: { hIndex: 1, vIndex: 9, hSpan: [2, 4] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 6, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 11, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    for (const vacantId of ['top-terminal', 'middle-terminal', 'bottom-terminal']) {
      const result = collapseVacancy(vacantId, fakeConfig, makeActiveWindows());
      const terminalEntries = Object.entries(result)
        .filter(([id, state]) => id.endsWith('-terminal') && state.hSpan[0] === 2 && state.hSpan[1] === 4)
        .sort((a, b) => a[1].vSpan[0] - b[1].vSpan[0]);
      const terminalSpans = terminalEntries.map(([, state]) => state.vSpan);

      expect(result['chrome'].hSpan).toEqual([4, 10]);
      expect(result['chrome'].vSpan).toEqual([0, 12]);
      expect(terminalSpans).toEqual([[0, 6], [6, 12]]);
      expect(hasLayoutOverlaps(result)).toBe(false);
    }
  });

  test('DnD should insert a window between two vertically stacked windows', () => {
    const activeWindows = [
      {
        windowId: 'top',
        state: { hIndex: 5, vIndex: 2, hSpan: [0, 12] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom',
        state: { hIndex: 5, vIndex: 8, hSpan: [0, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [0, 12],
      [4, 8],
      fakeConfig,
      activeWindows
    );

    expect(result['top'].vSpan).toEqual([0, 4]);
    expect(result['dragged-terminal'].vSpan).toEqual([4, 8]);
    expect(result['bottom'].vSpan).toEqual([8, 12]);
  });

  test('DnD should insert a window between the top screen edge and an existing full-height window', () => {
    const activeWindows = [
      {
        windowId: 'existing',
        state: { hIndex: 5, vIndex: 5, hSpan: [0, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [0, 12],
      [0, 6],
      fakeConfig,
      activeWindows
    );

    expect(result['dragged-terminal'].vSpan).toEqual([0, 6]);
    expect(result['existing'].vSpan).toEqual([6, 12]);
  });

  test('DnD should choose vertical carving for a top insertion into a wide window', () => {
    const activeWindows = [
      {
        windowId: 'editor',
        state: { hIndex: 3, vIndex: 5, hSpan: [0, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 9, vIndex: 5, hSpan: [8, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'dragged-terminal',
      [2, 6],
      [0, 2],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 4, v: 0.2 }
      }
    );

    expect(result['dragged-terminal'].hSpan).toEqual([2, 6]);
    expect(result['dragged-terminal'].vSpan).toEqual([0, 2]);
    expect(result.editor.hSpan).toEqual([0, 8]);
    expect(result.editor.vSpan).toEqual([2, 12]);
    expect(result['right-panel'].hSpan).toEqual([8, 12]);
    expect(result['right-panel'].vSpan).toEqual([0, 12]);
    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD target computation should keep top, center, and bottom magnetic height gestures', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;

    const topTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(3),
      my: yForRow(1),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows: []
    });
    const centerTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(3),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows: []
    });
    const bottomTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(3),
      my: yForRow(11),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows: []
    });

    expect(topTarget.targetHSpan).toEqual([2, 4]);
    expect(topTarget.targetVSpan).toEqual([0, 6]);
    expect(centerTarget.targetVSpan).toEqual([0, 12]);
    expect(bottomTarget.targetVSpan).toEqual([6, 12]);
  });

  test('DnD target computation should keep magnetic height intent across small boundary jitter', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRatio = (ratio: number) => fakeScreen.workarea.y + fakeScreen.workarea.height * ratio;

    const topTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(3),
      my: yForRatio(0.27),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows: []
    });
    const jitterTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(3),
      my: yForRatio(0.30),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows: [],
      previousTarget: topTarget
    });
    const releasedTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(3),
      my: yForRatio(0.33),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows: [],
      previousTarget: jitterTarget
    });

    expect(topTarget.targetVSpan).toEqual([0, 6]);
    expect(jitterTarget.targetVSpan).toEqual([0, 6]);
    expect(releasedTarget.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should turn a cursor near a stack boundary into an insertion slot', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'top',
        state: { hIndex: 5, vIndex: 2, hSpan: [0, 12] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom',
        state: { hIndex: 5, vIndex: 8, hSpan: [0, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(6),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 12,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([0, 12]);
    expect(target.targetVSpan).toEqual([4, 8]);
  });

  test('DnD target computation should keep a vertical stack insertion while the cursor jitters just outside the boundary threshold', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'top',
        state: { hIndex: 5, vIndex: 2, hSpan: [0, 12] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom',
        state: { hIndex: 5, vIndex: 8, hSpan: [0, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      }
    ];

    const insertedTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(6),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 12,
      preferredHeight: 12,
      activeWindows
    });
    const jitterTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(6),
      my: yForRow(8.2),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 12,
      preferredHeight: 12,
      activeWindows,
      previousTarget: insertedTarget
    });
    const releasedTarget = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(6),
      my: yForRow(8.8),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 12,
      preferredHeight: 12,
      activeWindows,
      previousTarget: jitterTarget
    });

    expect(insertedTarget.targetVSpan).toEqual([4, 8]);
    expect(jitterTarget.targetVSpan).toEqual([4, 8]);
    expect(releasedTarget.targetVSpan).toEqual([6, 12]);
  });

  test('DnD target computation should adopt a narrow stack width when a wide window is dragged into that stack', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'top-terminal',
        state: { hIndex: 10, vIndex: 2, hSpan: [10, 12] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom-terminal',
        state: { hIndex: 10, vIndex: 8, hSpan: [10, 12] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'wide-file-manager',
      mx: xForCol(11),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 8,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([4, 8]);
  });

  test('DnD target computation should offer edge insertion for a horizontal stack at the screen edge', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 6, vIndex: 5, hSpan: [6, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 8, vIndex: 5, hSpan: [8, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'new-terminal',
      mx: xForCol(11.8),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should shrink a wide window to the edge slot width for horizontal stack insertion', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 6, vIndex: 5, hSpan: [6, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 8, vIndex: 5, hSpan: [8, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'wide-file-manager',
      mx: xForCol(11.8),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 8,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should shrink a wide window into a single edge neighbor slot when the cursor is at the screen edge', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'wide-file-manager',
      mx: xForCol(11.8),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 8,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should shrink a wide clamped window into a single edge slot even when the cursor is not at the screen edge', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'wide-file-manager',
      mx: xForCol(9),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 8,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should shrink a medium clamped window into a single edge slot beside a minimum edge neighbor', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'file-manager',
      mx: xForCol(9),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 4,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should offer the edge slot when both dragged and edge neighbor are minimum width', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'file-manager',
      mx: xForCol(9),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 2,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([10, 12]);
    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD target computation should shrink an interior horizontal insertion when the edge neighbor cannot donate enough space', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 6, vIndex: 5, hSpan: [4, 9] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-editor',
        state: { hIndex: 10, vIndex: 5, hSpan: [9, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'terminal',
      mx: xForCol(9.2),
      my: yForRow(3.2),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 3,
      preferredHeight: 7,
      activeWindows
    });

    expect(target.targetHSpan).toEqual([8, 10]);
    expect(target.targetVSpan).toEqual([0, 12]);
    expect(target.debug.slotWidth).toBe(2);
  });

  test('DnD target computation should keep a horizontal insertion while the cursor jitters toward the next boundary', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const activeWindows = [
      {
        windowId: 'left',
        state: { hIndex: 5, vIndex: 5, hSpan: [4, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right',
        state: { hIndex: 10, vIndex: 5, hSpan: [8, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const insertedTarget = computeDragTarget({
      draggedId: 'terminal',
      mx: xForCol(8),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 4,
      preferredHeight: 12,
      activeWindows
    });
    const jitterTarget = computeDragTarget({
      draggedId: 'terminal',
      mx: xForCol(10.2),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 4,
      preferredHeight: 12,
      activeWindows,
      previousTarget: insertedTarget
    });
    const releasedTarget = computeDragTarget({
      draggedId: 'terminal',
      mx: xForCol(10.5),
      my: yForRow(6),
      monitor: fakeScreen,
      config: fakeConfig,
      preferredWidth: 4,
      preferredHeight: 12,
      activeWindows,
      previousTarget: jitterTarget
    });

    expect(insertedTarget.targetHSpan).toEqual([6, 10]);
    expect(jitterTarget.targetHSpan).toEqual([6, 10]);
    expect(releasedTarget.targetHSpan).toEqual([8, 12]);
  });

  test('DnD target computation should not offer stack insertion when min sizes cannot fit another window', () => {
    const xForCol = (col: number) => fakeScreen.workarea.x + (fakeScreen.workarea.width / fakeConfig.gridSize) * col;
    const yForRow = (row: number) => fakeScreen.workarea.y + (fakeScreen.workarea.height / fakeConfig.gridSize) * row;
    const tightConfig: Config = { ...fakeConfig, minSpan: 3 };
    const activeWindows = [
      {
        windowId: 'one',
        state: { hIndex: 5, vIndex: 1, hSpan: [0, 12] as [number, number], vSpan: [0, 3] as [number, number], lastDirection: null }
      },
      {
        windowId: 'two',
        state: { hIndex: 5, vIndex: 4, hSpan: [0, 12] as [number, number], vSpan: [3, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'three',
        state: { hIndex: 5, vIndex: 7, hSpan: [0, 12] as [number, number], vSpan: [6, 9] as [number, number], lastDirection: null }
      },
      {
        windowId: 'four',
        state: { hIndex: 5, vIndex: 10, hSpan: [0, 12] as [number, number], vSpan: [9, 12] as [number, number], lastDirection: null }
      }
    ];

    const target = computeDragTarget({
      draggedId: 'dragged-terminal',
      mx: xForCol(6),
      my: yForRow(6),
      monitor: fakeScreen,
      config: tightConfig,
      preferredWidth: 12,
      preferredHeight: 12,
      activeWindows
    });

    expect(target.targetVSpan).toEqual([0, 12]);
  });

  test('DnD should relocate a pinned narrow stack horizontally when inserting into a tight vertical boundary', () => {
    const activeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 6, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'top-terminal',
        state: { hIndex: 10, vIndex: 0, hSpan: [10, 12] as [number, number], vSpan: [0, 2] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom-terminal',
        state: { hIndex: 10, vIndex: 2, hSpan: [10, 12] as [number, number], vSpan: [2, 4] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'wide-file-manager',
      [10, 12],
      [1, 3],
      fakeConfig,
      activeWindows
    );

    expect(result['wide-file-manager'].hSpan).toEqual([10, 12]);
    expect(result['wide-file-manager'].vSpan).toEqual([1, 3]);
    expect(result['top-terminal'].hSpan).toEqual([8, 10]);
    expect(result['bottom-terminal'].hSpan).toEqual([8, 10]);
    expect(result['chrome'].hSpan).toEqual([4, 8]);
    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD should redistribute a vertical stack in place before using horizontal relief', () => {
    const activeWindows = [
      {
        windowId: 'left-top',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-bottom',
        state: { hIndex: 0, vIndex: 8, hSpan: [0, 2] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [6, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'top-terminal',
        state: { hIndex: 4, vIndex: 1, hSpan: [4, 6] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 4, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom-terminal',
        state: { hIndex: 4, vIndex: 9, hSpan: [4, 6] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'file-manager',
        state: { hIndex: 2, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 3] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'file-manager',
      [4, 6],
      [0, 3],
      fakeConfig,
      activeWindows
    );

    expect(result['file-manager'].hSpan).toEqual([4, 6]);
    expect(result['file-manager'].vSpan).toEqual([0, 3]);
    expect(result['top-terminal'].hSpan).toEqual([4, 6]);
    expect(result['top-terminal'].vSpan).toEqual([3, 6]);
    expect(result['middle-terminal'].hSpan).toEqual([4, 6]);
    expect(result['middle-terminal'].vSpan).toEqual([6, 9]);
    expect(result['bottom-terminal'].hSpan).toEqual([4, 6]);
    expect(result['bottom-terminal'].vSpan).toEqual([9, 12]);
    expect(result.chrome.hSpan).toEqual([6, 10]);
    expect(result['right-panel'].hSpan).toEqual([10, 12]);
    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD should shift a horizontal edge stack inward when inserting between the outer window and screen edge', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 6, vIndex: 5, hSpan: [6, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 8, vIndex: 5, hSpan: [8, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'new-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows
    );

    expect(result['new-terminal'].hSpan).toEqual([10, 12]);
    expect(result['left-terminal'].hSpan).toEqual([4, 6]);
    expect(result['middle-terminal'].hSpan).toEqual([6, 8]);
    expect(result['right-terminal'].hSpan).toEqual([8, 10]);
    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD should shift a horizontal edge stack inward for a wide dragged window that has been narrowed to the slot', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 6, vIndex: 5, hSpan: [6, 8] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 8, vIndex: 5, hSpan: [8, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'wide-file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows
    );

    expect(result['wide-file-manager'].hSpan).toEqual([10, 12]);
    expect(result['left-terminal'].hSpan).toEqual([4, 6]);
    expect(result['middle-terminal'].hSpan).toEqual([6, 8]);
    expect(result['right-terminal'].hSpan).toEqual([8, 10]);
    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD should shift a single edge neighbor inward only for an explicit screen-edge insertion intent', () => {
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const centeredDrop = solveDragTransitions(
      'wide-file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      { intentPoint: { h: 11, v: 6 } }
    );
    const edgeDrop = solveDragTransitions(
      'wide-file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      { intentPoint: { h: 11.8, v: 6 } }
    );

    expect(centeredDrop.status).toBe('blocked');
    expect(edgeDrop.status).toBe('valid');
    expect(edgeDrop.states['wide-file-manager'].hSpan).toEqual([10, 12]);
    expect(edgeDrop.states['right-panel'].hSpan).toEqual([8, 10]);
    expect(hasLayoutOverlaps(edgeDrop.states)).toBe(false);
  });

  test('DnD should shift a single edge neighbor inward when a wide clamped window was narrowed to the edge slot', () => {
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'wide-file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 9, v: 6 },
        preferredWidth: 8
      }
    );

    expect(result.status).toBe('valid');
    expect(result.states['wide-file-manager'].hSpan).toEqual([10, 12]);
    expect(result.states['right-panel'].hSpan).toEqual([8, 10]);
    expect(hasLayoutOverlaps(result.states)).toBe(false);
  });

  test('DnD should shift a minimum edge neighbor inward for a medium clamped edge insertion', () => {
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 9, v: 6 },
        preferredWidth: 4
      }
    );

    expect(result.status).toBe('valid');
    expect(result.states['file-manager'].hSpan).toEqual([10, 12]);
    expect(result.states['right-panel'].hSpan).toEqual([8, 10]);
    expect(hasLayoutOverlaps(result.states)).toBe(false);
  });

  test('DnD should shift a minimum edge neighbor inward even when the dragged window is already minimum width', () => {
    const activeWindows = [
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 12, v: 6 },
        preferredWidth: 2
      }
    );

    expect(result.status).toBe('valid');
    expect(result.states['file-manager'].hSpan).toEqual([10, 12]);
    expect(result.states['right-panel'].hSpan).toEqual([8, 10]);
    expect(hasLayoutOverlaps(result.states)).toBe(false);
  });

  test('DnD should make an edge slot by shrinking the inner neighbor instead of translating the whole row into other columns', () => {
    const activeWindows = [
      {
        windowId: 'left-top',
        state: { hIndex: 2, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-middle',
        state: { hIndex: 2, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-bottom',
        state: { hIndex: 2, vIndex: 9, hSpan: [2, 4] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'file-manager',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 12, v: 6 },
        preferredWidth: 2
      }
    );

    expect(result.status).toBe('valid');
    expect(result.states['file-manager'].hSpan).toEqual([10, 12]);
    expect(result.states['right-panel'].hSpan).toEqual([8, 10]);
    expect(result.states.chrome.hSpan).toEqual([4, 8]);
    expect(result.states['left-top'].hSpan).toEqual([2, 4]);
    expect(result.states['left-middle'].hSpan).toEqual([2, 4]);
    expect(result.states['left-bottom'].hSpan).toEqual([2, 4]);
    expect(hasLayoutOverlaps(result.states)).toBe(false);
  });

  test('DnD should make a left edge slot by shifting a minimum-width corridor and shrinking the first wide donor', () => {
    const activeWindows = [
      {
        windowId: 'left-top',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-bottom',
        state: { hIndex: 0, vIndex: 8, hSpan: [0, 2] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-top',
        state: { hIndex: 2, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-mid',
        state: { hIndex: 2, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-bottom',
        state: { hIndex: 2, vIndex: 9, hSpan: [2, 4] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'file-manager',
      [0, 2],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 0, v: 4 },
        preferredWidth: 2
      }
    );

    expect(result.status).toBe('valid');
    expect(result.states['file-manager'].hSpan).toEqual([0, 2]);
    expect(result.states['left-top'].hSpan).toEqual([2, 4]);
    expect(result.states['left-bottom'].hSpan).toEqual([2, 4]);
    expect(result.states['middle-top'].hSpan).toEqual([4, 6]);
    expect(result.states['middle-mid'].hSpan).toEqual([4, 6]);
    expect(result.states['middle-bottom'].hSpan).toEqual([4, 6]);
    expect(result.states.chrome.hSpan).toEqual([6, 10]);
    expect(result.states['right-panel'].hSpan).toEqual([10, 12]);
    expect(hasLayoutOverlaps(result.states)).toBe(false);
  });

  test('DnD should insert between full-height neighbors by narrowing the dragged slot instead of blocking', () => {
    const activeWindows = [
      {
        windowId: 'left-top',
        state: { hIndex: 2, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-middle',
        state: { hIndex: 2, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-bottom',
        state: { hIndex: 2, vIndex: 9, hSpan: [2, 4] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 6, vIndex: 5, hSpan: [4, 9] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-editor',
        state: { hIndex: 10, vIndex: 5, hSpan: [9, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'terminal',
      [8, 10],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        intentPoint: { h: 9.2, v: 3.2 },
        preferredWidth: 3
      }
    );

    expect(result.status).toBe('valid');
    expect(result.states['chrome'].hSpan).toEqual([4, 8]);
    expect(result.states['terminal'].hSpan).toEqual([8, 10]);
    expect(result.states['right-editor'].hSpan).toEqual([10, 12]);
    expect(result.states['left-top'].hSpan).toEqual([2, 4]);
    expect(result.states['left-middle'].hSpan).toEqual([2, 4]);
    expect(result.states['left-bottom'].hSpan).toEqual([2, 4]);
    expect(hasLayoutOverlaps(result.states)).toBe(false);
  });

  test('DnD explicit swap should exchange non-neighbor windows with the same grid shape', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 2, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 5, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'left-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: true,
        intentPoint: { h: 11, v: 6 }
      }
    );

    expect(result['left-terminal'].hSpan).toEqual([10, 12]);
    expect(result['right-terminal'].hSpan).toEqual([0, 2]);
    expect(result['middle-terminal'].hSpan).toEqual([4, 6]);
  });

  test('DnD swap should stay disabled unless the swap modifier is active', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 5, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'left-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: false,
        intentPoint: { h: 11, v: 6 }
      }
    );

    expect(result['left-terminal'].hSpan).toEqual([10, 12]);
    expect(result['right-terminal'].hSpan).not.toEqual([0, 2]);
    expect(hasLayoutOverlaps(result)).toBe(true);
  });

  test('DnD explicit swap should exchange windows with different shapes', () => {
    const activeWindows = [
      {
        windowId: 'wide-window',
        state: { hIndex: 3, vIndex: 2, hSpan: [0, 4] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'tall-window',
        state: { hIndex: 9, vIndex: 5, hSpan: [8, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'wide-window',
      [8, 10],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: true,
        intentPoint: { h: 9, v: 6 }
      }
    );

    expect(result['wide-window'].hSpan).toEqual([8, 10]);
    expect(result['wide-window'].vSpan).toEqual([0, 12]);
    expect(result['tall-window'].hSpan).toEqual([0, 4]);
    expect(result['tall-window'].vSpan).toEqual([0, 6]);
  });

  test('DnD explicit swap should work even near a target edge', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 5, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'left-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: true,
        intentPoint: { h: 10.1, v: 6 }
      }
    );

    expect(result['left-terminal'].hSpan).toEqual([10, 12]);
    expect(result['right-terminal'].hSpan).toEqual([0, 2]);
    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD explicit swap should exchange neighboring windows with different shapes', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 1, vIndex: 5, hSpan: [0, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 4, vIndex: 2, hSpan: [4, 6] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      }
    ];

    const disabledResult = calculateDragTransitions(
      'left-terminal',
      [4, 6],
      [0, 6],
      fakeConfig,
      activeWindows,
      {
        swapWindows: false,
        intentPoint: { h: 5, v: 3 }
      }
    );
    const result = calculateDragTransitions(
      'left-terminal',
      [4, 6],
      [0, 6],
      fakeConfig,
      activeWindows,
      {
        swapWindows: true,
        intentPoint: { h: 5, v: 3 }
      }
    );

    expect(canonicalStates(result)).not.toEqual(canonicalStates(disabledResult));
    expect(result['left-terminal'].hSpan).toEqual([4, 6]);
    expect(result['left-terminal'].vSpan).toEqual([0, 6]);
    expect(result['right-terminal'].hSpan).toEqual([0, 4]);
    expect(result['right-terminal'].vSpan).toEqual([0, 12]);
  });

  test('DnD layout validation should accept a resolved swap result', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 5, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = calculateDragTransitions(
      'left-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: true,
        intentPoint: { h: 11, v: 6 }
      }
    );

    expect(hasLayoutOverlaps(result)).toBe(false);
  });

  test('DnD solve result should explain overlap-blocked layouts', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 5, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'left-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: false,
        intentPoint: { h: 11, v: 6 }
      }
    );

    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('wouldOverlap');
    expect(result.affected).toContain('left-terminal');
  });

  test('DnD solve result should explain too-small target layouts', () => {
    const result = solveDragTransitions(
      'dragged-terminal',
      [0, 1],
      [0, 12],
      fakeConfig,
      []
    );

    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('tooSmall');
    expect(result.affected).toEqual(['dragged-terminal']);
  });

  test('DnD solve result should expose affected windows for a clean swap', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 2, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-terminal',
        state: { hIndex: 5, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const result = solveDragTransitions(
      'left-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows,
      {
        swapWindows: true,
        intentPoint: { h: 11, v: 6 }
      }
    );

    expect(result.status).toBe('valid');
    expect(result.reason).toBeUndefined();
    expect(result.affected).toEqual(['left-terminal', 'right-terminal']);
  });

  test('DnD solve result should stay stable when active windows arrive in a different order', () => {
    const activeWindows = [
      {
        windowId: 'left-terminal',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal-top',
        state: { hIndex: 1, vIndex: 2, hSpan: [2, 4] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal-bottom',
        state: { hIndex: 1, vIndex: 8, hSpan: [2, 4] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'dragged-terminal',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    const expected = solveDragTransitions(
      'dragged-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      activeWindows
    );
    const permutations = [
      [...activeWindows].reverse(),
      [activeWindows[3], activeWindows[1], activeWindows[4], activeWindows[0], activeWindows[2]],
      [activeWindows[2], activeWindows[0], activeWindows[3], activeWindows[1], activeWindows[4]]
    ];

    for (const permutation of permutations) {
      const result = solveDragTransitions(
        'dragged-terminal',
        [10, 12],
        [0, 12],
        fakeConfig,
        permutation
      );

      expect(result.status).toBe(expected.status);
      expect(result.reason).toBe(expected.reason);
      expect(result.affected).toEqual(expected.affected);
      expect(canonicalStates(result.states)).toEqual(canonicalStates(expected.states));
    }
  });

  test('DnD solve result should stay stable across permutations for edge corridor insertion', () => {
    const activeWindows = [
      {
        windowId: 'left-top',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-bottom',
        state: { hIndex: 0, vIndex: 8, hSpan: [0, 2] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-top',
        state: { hIndex: 2, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-mid',
        state: { hIndex: 2, vIndex: 5, hSpan: [2, 4] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-bottom',
        state: { hIndex: 2, vIndex: 9, hSpan: [2, 4] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];

    expectStableDnDResultAcrossPermutations(
      activeWindows,
      'file-manager',
      [0, 2],
      [0, 12],
      {
        intentPoint: { h: 0, v: 4 },
        preferredWidth: 2
      }
    );
  });

  test('DnD solve result should stay stable across permutations for vertical stack redistribution', () => {
    const activeWindows = [
      {
        windowId: 'left-top',
        state: { hIndex: 0, vIndex: 2, hSpan: [0, 2] as [number, number], vSpan: [0, 6] as [number, number], lastDirection: null }
      },
      {
        windowId: 'left-bottom',
        state: { hIndex: 0, vIndex: 8, hSpan: [0, 2] as [number, number], vSpan: [6, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [6, 10] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'top-terminal',
        state: { hIndex: 4, vIndex: 1, hSpan: [4, 6] as [number, number], vSpan: [0, 4] as [number, number], lastDirection: null }
      },
      {
        windowId: 'middle-terminal',
        state: { hIndex: 4, vIndex: 5, hSpan: [4, 6] as [number, number], vSpan: [4, 8] as [number, number], lastDirection: null }
      },
      {
        windowId: 'bottom-terminal',
        state: { hIndex: 4, vIndex: 9, hSpan: [4, 6] as [number, number], vSpan: [8, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'right-panel',
        state: { hIndex: 10, vIndex: 5, hSpan: [10, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      },
      {
        windowId: 'file-manager',
        state: { hIndex: 2, vIndex: 1, hSpan: [2, 4] as [number, number], vSpan: [0, 3] as [number, number], lastDirection: null }
      }
    ];

    expectStableDnDResultAcrossPermutations(
      activeWindows,
      'file-manager',
      [4, 6],
      [0, 3]
    );
  });

  test('DnD transaction restore should give a carved neighbor its previous space when the inserted window is extracted', () => {
    const beforeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];
    const inserted = solveDragTransitions(
      'dragged-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      beforeWindows
    );
    const beforeStates = Object.fromEntries(beforeWindows.map(w => [w.windowId, w.state]));
    const activeAfterInsert = Object.entries(inserted.states).map(([windowId, state]) => ({ windowId, state }));

    const restored = restoreDragTransaction(
      {
        draggedId: 'dragged-terminal',
        monitorId: 'HDMI-1',
        beforeStates,
        afterStates: inserted.states,
        affected: inserted.affected
      },
      'dragged-terminal',
      fakeConfig,
      activeAfterInsert
    );

    expect(restored).not.toBeNull();
    expect(restored!['chrome'].hSpan).toEqual([4, 12]);
    expect(restored!['chrome'].vSpan).toEqual([0, 12]);
    expect(restored!['dragged-terminal']).toBeUndefined();
    expect(hasLayoutOverlaps(restored!)).toBe(false);
  });

  test('DnD transaction restore should fall back when the carved neighbor changed after insertion', () => {
    const beforeWindows = [
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];
    const inserted = solveDragTransitions(
      'dragged-terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      beforeWindows
    );
    const beforeStates = Object.fromEntries(beforeWindows.map(w => [w.windowId, w.state]));
    const activeAfterManualChange = Object.entries(inserted.states).map(([windowId, state]) => ({
      windowId,
      state: windowId === 'chrome'
        ? { ...state, hSpan: [4, 8] as [number, number] }
        : state
    }));

    const restored = restoreDragTransaction(
      {
        draggedId: 'dragged-terminal',
        monitorId: 'HDMI-1',
        beforeStates,
        afterStates: inserted.states,
        affected: inserted.affected
      },
      'dragged-terminal',
      fakeConfig,
      activeAfterManualChange
    );

    expect(restored).toBeNull();
  });

  test('DnD transaction history should restore the matching older commit when newer commits belong to another dragged window', () => {
    const terminalInsertBefore = [
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];
    const terminalInserted = solveDragTransitions(
      'terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      terminalInsertBefore
    );
    const noteInsertBefore = [
      {
        windowId: 'notes',
        state: { hIndex: 0, vIndex: 5, hSpan: [0, 4] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];
    const noteInserted = solveDragTransitions(
      'scratch',
      [0, 2],
      [0, 12],
      fakeConfig,
      noteInsertBefore
    );
    const history = [
      {
        draggedId: 'terminal',
        monitorId: 'HDMI-1',
        beforeStates: Object.fromEntries(terminalInsertBefore.map(w => [w.windowId, w.state])),
        afterStates: terminalInserted.states,
        affected: terminalInserted.affected
      },
      {
        draggedId: 'scratch',
        monitorId: 'HDMI-1',
        beforeStates: Object.fromEntries(noteInsertBefore.map(w => [w.windowId, w.state])),
        afterStates: noteInserted.states,
        affected: noteInserted.affected
      }
    ];
    const activeAfterTerminalInsert = Object.entries(terminalInserted.states).map(([windowId, state]) => ({ windowId, state }));

    const restored = restoreDragTransactionHistory(
      history,
      'terminal',
      'HDMI-1',
      fakeConfig,
      activeAfterTerminalInsert
    );

    expect(restored).not.toBeNull();
    expect(restored!.snapshotIndex).toBe(0);
    expect(restored!.states['chrome'].hSpan).toEqual([4, 12]);
    expect(hasLayoutOverlaps(restored!.states)).toBe(false);
  });

  test('DnD transaction history should prefer the newest matching restorable commit', () => {
    const oldBefore = [
      {
        windowId: 'chrome',
        state: { hIndex: 6, vIndex: 5, hSpan: [2, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];
    const oldInserted = solveDragTransitions(
      'terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      oldBefore
    );
    const latestBefore = [
      {
        windowId: 'chrome',
        state: { hIndex: 7, vIndex: 5, hSpan: [4, 12] as [number, number], vSpan: [0, 12] as [number, number], lastDirection: null }
      }
    ];
    const latestInserted = solveDragTransitions(
      'terminal',
      [10, 12],
      [0, 12],
      fakeConfig,
      latestBefore
    );
    const activeAfterLatestInsert = Object.entries(latestInserted.states).map(([windowId, state]) => ({ windowId, state }));

    const restored = restoreDragTransactionHistory(
      [
        {
          draggedId: 'terminal',
          monitorId: 'HDMI-1',
          beforeStates: Object.fromEntries(oldBefore.map(w => [w.windowId, w.state])),
          afterStates: oldInserted.states,
          affected: oldInserted.affected
        },
        {
          draggedId: 'terminal',
          monitorId: 'HDMI-1',
          beforeStates: Object.fromEntries(latestBefore.map(w => [w.windowId, w.state])),
          afterStates: latestInserted.states,
          affected: latestInserted.affected
        }
      ],
      'terminal',
      'HDMI-1',
      fakeConfig,
      activeAfterLatestInsert
    );

    expect(restored).not.toBeNull();
    expect(restored!.snapshotIndex).toBe(1);
    expect(restored!.states['chrome'].hSpan).toEqual([4, 12]);
  });

  test('DnD extraction intent should ignore accidental modifier release near the source slot', () => {
    expect(shouldFloatAfterModifierRelease({
      pointerX: 1040,
      pointerY: 520,
      startPointerX: 980,
      startPointerY: 500
    })).toBe(false);

    expect(shouldFloatAfterModifierRelease({
      pointerX: 901,
      pointerY: 500,
      startPointerX: 980,
      startPointerY: 500
    })).toBe(false);
  });

  test('DnD extraction intent should float only after the pointer leaves the source slot decisively', () => {
    expect(shouldFloatAfterModifierRelease({
      pointerX: 1061,
      pointerY: 530,
      startPointerX: 980,
      startPointerY: 500
    })).toBe(true);
  });
});
