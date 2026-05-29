import { TilingEngine } from '../src/engine';
import { ScreenInfo, WindowState, Config } from '../src/engine/types';

describe('TilingEngine - Core Layout Calculations', () => {
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
    horizontalFractions: [2, 3, 4, 5, 6, 7, 8],
    verticalFractions: [2, 3, 4],
    gaps: 0,
  };

  test('should return default state', () => {
    const defaultState = TilingEngine.getDefaultState();
    expect(defaultState).toEqual({
      widthFraction: 1,
      heightFraction: 1,
      horizontalAlign: null,
      verticalAlign: null,
      lastDirection: null,
    });
  });

  test('should handle first left keypress', () => {
    const startState = TilingEngine.getDefaultState();
    const nextState = TilingEngine.calculateNextState(startState, 'left', fakeConfig);

    expect(nextState.horizontalAlign).toBe('left');
    expect(nextState.widthFraction).toBe(2);
    expect(nextState.lastDirection).toBe('left');
    expect(nextState.heightFraction).toBe(1);
    expect(nextState.verticalAlign).toBeNull();
  });

  test('should cycle width fractions up to 8 on repeated left presses', () => {
    let state = TilingEngine.getDefaultState();

    // Цикл по горизонтали: 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 2
    const expectedFractions = [2, 3, 4, 5, 6, 7, 8, 2];
    for (const expected of expectedFractions) {
      state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
      expect(state.widthFraction).toBe(expected);
    }
  });

  test('should handle perpendicular shift (left -> down -> down)', () => {
    let state = TilingEngine.getDefaultState();

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.horizontalAlign).toBe('left');
    expect(state.widthFraction).toBe(2);

    state = TilingEngine.calculateNextState(state, 'down', fakeConfig);
    expect(state.verticalAlign).toBe('bottom');
    expect(state.heightFraction).toBe(2);

    state = TilingEngine.calculateNextState(state, 'down', fakeConfig);
    expect(state.heightFraction).toBe(3);
  });

  test('should calculate correct pixel geometries for workarea', () => {
    const stateLeftHalf: WindowState = {
      widthFraction: 2,
      heightFraction: 1,
      horizontalAlign: 'left',
      verticalAlign: null,
      lastDirection: 'left',
    };

    const geomLeftHalf = TilingEngine.stateToGeometry(stateLeftHalf, fakeScreen, fakeConfig);
    expect(geomLeftHalf).toEqual({
      x: 0,
      y: 40,
      width: 960,
      height: 1040,
    });
  });

  test('should apply gaps properly if configured', () => {
    const stateLeftHalf: WindowState = {
      widthFraction: 2,
      heightFraction: 1,
      horizontalAlign: 'left',
      verticalAlign: null,
      lastDirection: 'left',
    };

    const configWithGaps: Config = {
      ...fakeConfig,
      gaps: 10, // Отступ 10px
    };

    const geomWithGaps = TilingEngine.stateToGeometry(stateLeftHalf, fakeScreen, configWithGaps);
    // При ширине 960 и высоте 1040 с отступами 10px:
    // x должен сдвинуться на +10 -> 10
    // y должен сдвинуться на +10 -> 50 (40 + 10)
    // width должен уменьшиться на 20 -> 940 (960 - 20)
    // height должен уменьшиться на 20 -> 1020 (1040 - 20)
    expect(geomWithGaps).toEqual({
      x: 10,
      y: 50,
      width: 940,
      height: 1020,
    });
  });

  test('should handle reverse transitions (left -> left -> right -> right)', () => {
    let state = TilingEngine.getDefaultState();

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.horizontalAlign).toBe('left');
    expect(state.widthFraction).toBe(2);

    state = TilingEngine.calculateNextState(state, 'left', fakeConfig);
    expect(state.widthFraction).toBe(3);

    state = TilingEngine.calculateNextState(state, 'right', fakeConfig);
    expect(state.horizontalAlign).toBe('left');
    expect(state.widthFraction).toBe(2);

    state = TilingEngine.calculateNextState(state, 'right', fakeConfig);
    expect(state.horizontalAlign).toBe('right');
    expect(state.widthFraction).toBe(2);
  });
});
