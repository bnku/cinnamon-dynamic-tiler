import { TilingEngine } from '../src/core/TilingEngine';
import { calculateDragTransitions, collapseVacancy } from '../src/DragTiling';
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
});
