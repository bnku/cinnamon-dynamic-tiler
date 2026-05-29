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
    horizontalFractions: [2, 3, 4], // не используются напрямую в 12-колоночной шкале, но нужны по типу
    verticalFractions: [2, 3, 4],   // не используются напрямую
    gaps: 0,
  };

  test('should return default state', () => {
    const defaultState = TilingEngine.getDefaultState();
    expect(defaultState).toEqual({
      hIndex: 5,
      vIndex: 3,
      lastDirection: null,
    });
  });

  test('should handle first left keypress', () => {
    const startState = TilingEngine.getDefaultState();
    const nextState = TilingEngine.calculateNextState(startState, 'left', fakeConfig);

    expect(nextState.hIndex).toBe(2); // Левая половина [0..6]
    expect(nextState.vIndex).toBe(3); // Полная высота [0..12]
    expect(nextState.lastDirection).toBe('left');
  });

  test('should decrease hIndex on repeated left presses down to 0', () => {
    let state = TilingEngine.getDefaultState();

    // 1st press left -> index 2
    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hIndex).toBe(2);

    // 2nd press left -> index 1
    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hIndex).toBe(1);

    // 3rd press left -> index 0
    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hIndex).toBe(0);

    // 4th press left -> remains index 0
    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hIndex).toBe(0);
  });

  test('should increase hIndex on right presses up to 10', () => {
    let state = TilingEngine.getDefaultState();

    // 1st press left -> index 2 [0..6]
    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hIndex).toBe(2);

    // Then repeated right presses: 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10 -> 10
    const expectedIndices = [3, 4, 5, 6, 7, 8, 9, 10, 10];
    for (const expected of expectedIndices) {
      state = TilingEngine.calculateNextState(state, 'right', fakeConfig);
      expect(state.hIndex).toBe(expected);
    }
  });

  test('should handle perpendicular shift (left -> down -> down)', () => {
    let state = TilingEngine.getDefaultState();

    // left -> [0..6] по горизонтали (hIndex 2, vIndex 3)
    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.hIndex).toBe(2);
    expect(state.vIndex).toBe(3);

    // down -> [6..12] по вертикали (hIndex 2, vIndex 4)
    state = TilingEngine.calculateNextState(state, 'down', fakeConfig);
    expect(state.hIndex).toBe(2);
    expect(state.vIndex).toBe(4);

    // down -> [8..12] по вертикали (hIndex 2, vIndex 5)
    state = TilingEngine.calculateNextState(state, 'down', fakeConfig);
    expect(state.hIndex).toBe(2);
    expect(state.vIndex).toBe(5);
  });

  test('should calculate correct pixel geometries for workarea', () => {
    // Состояние: левая половина [0..6] по горизонтали, полная высота [0..12] по вертикали
    const stateLeftHalf: WindowState = {
      hIndex: 2,
      vIndex: 3,
      lastDirection: 'left',
    };

    const geomLeftHalf = TilingEngine.stateToGeometry(stateLeftHalf, fakeScreen, fakeConfig);
    // colWidth = 1920 / 12 = 160.
    // x = 0 + 0 * 160 = 0.
    // width = 6 * 160 = 960.
    // rowHeight = 1040 / 12 = 86.666
    // y = 40 + 0 * 86.66 = 40.
    // height = 12 * 86.66 = 1040.
    expect(geomLeftHalf).toEqual({
      x: 0,
      y: 40,
      width: 960,
      height: 1040,
    });
  });

  test('should apply gaps properly if configured', () => {
    const stateLeftHalf: WindowState = {
      hIndex: 2,
      vIndex: 3,
      lastDirection: 'left',
    };

    const configWithGaps: Config = {
      ...fakeConfig,
      gaps: 10, // Отступ 10px
    };

    const geomWithGaps = TilingEngine.stateToGeometry(stateLeftHalf, fakeScreen, configWithGaps);
    // При x=0, y=40, width=960, height=1040:
    // x += 10 -> 10
    // y += 10 -> 50
    // width -= 20 -> 940
    // height -= 20 -> 1020
    expect(geomWithGaps).toEqual({
      x: 10,
      y: 50,
      width: 940,
      height: 1020,
    });
  });

  test('should handle instant shift commands', () => {
    let state = TilingEngine.getDefaultState();

    state = TilingEngine.calculateNextState(state, 'shift-left', fakeConfig);
    expect(state.hIndex).toBe(2);
    expect(state.lastDirection).toBe('shift-left');

    state = TilingEngine.calculateNextState(state, 'shift-right', fakeConfig);
    expect(state.hIndex).toBe(8);
    expect(state.lastDirection).toBe('shift-right');
  });
});
