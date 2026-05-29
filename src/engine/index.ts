import { Geometry, ScreenInfo, Direction, WindowState, Config } from './types';

export const HORIZONTAL_SPANS: [number, number][] = [
  [0, 3],   // 0
  [0, 4],   // 1
  [0, 6],   // 2 (left 1/2)
  [0, 8],   // 3
  [0, 9],   // 4
  [0, 12],  // 5 (full width)
  [3, 12],  // 6
  [4, 12],  // 7
  [6, 12],  // 8 (right 1/2)
  [8, 12],  // 9
  [9, 12],  // 10
];

export const VERTICAL_SPANS: [number, number][] = [
  [0, 3],   // 0
  [0, 4],   // 1
  [0, 6],   // 2 (top 1/2)
  [0, 12],  // 3 (full height)
  [6, 12],  // 4 (bottom 1/2)
  [8, 12],  // 5
  [9, 12],  // 6
];

export class TilingEngine {
  /**
   * Возвращает дефолтное пустое состояние окна (до тайлинга)
   */
  public static getDefaultState(): WindowState {
    return {
      hIndex: 5, // [0, 12] (полная ширина)
      vIndex: 3, // [0, 12] (полная высота)
      lastDirection: null,
    };
  }

  /**
   * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
   */
  public static calculateNextState(
    currentState: WindowState,
    direction: Direction,
    config: Config
  ): WindowState {
    const nextState: WindowState = { ...currentState };

    if (currentState.lastDirection === null) {
      // Первый клик на окне
      switch (direction) {
        case 'left':
          nextState.hIndex = 2; // Левая половина [0..6]
          nextState.lastDirection = 'left';
          break;
        case 'right':
          nextState.hIndex = 8; // Правая половина [6..12]
          nextState.lastDirection = 'right';
          break;
        case 'up':
          nextState.vIndex = 2; // Верхняя половина [0..6]
          nextState.lastDirection = 'up';
          break;
        case 'down':
          nextState.vIndex = 4; // Нижняя половина [6..12]
          nextState.lastDirection = 'down';
          break;
        case 'shift-left':
          nextState.hIndex = 2; // Левая половина [0..6]
          nextState.lastDirection = 'shift-left';
          break;
        case 'shift-right':
          nextState.hIndex = 8; // Правая половина [6..12]
          nextState.lastDirection = 'shift-right';
          break;
      }
    } else {
      // Окно уже в режиме тайлинга
      switch (direction) {
        case 'left':
          nextState.hIndex = Math.max(0, currentState.hIndex - 1);
          nextState.lastDirection = 'left';
          break;
        case 'right':
          nextState.hIndex = Math.min(10, currentState.hIndex + 1);
          nextState.lastDirection = 'right';
          break;
        case 'up':
          nextState.vIndex = Math.max(0, currentState.vIndex - 1);
          nextState.lastDirection = 'up';
          break;
        case 'down':
          nextState.vIndex = Math.min(6, currentState.vIndex + 1);
          nextState.lastDirection = 'down';
          break;
        case 'shift-left':
          nextState.hIndex = 2; // Мгновенный сдвиг влево
          nextState.lastDirection = 'shift-left';
          break;
        case 'shift-right':
          nextState.hIndex = 8; // Мгновенный сдвиг вправо
          nextState.lastDirection = 'shift-right';
          break;
      }
    }

    return nextState;
  }

  /**
   * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
   */
  public static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry {
    const { workarea } = screen;
    const gaps = config.gaps || 0;

    const hSpan = HORIZONTAL_SPANS[state.hIndex] !== undefined ? HORIZONTAL_SPANS[state.hIndex] : HORIZONTAL_SPANS[5];
    const vSpan = VERTICAL_SPANS[state.vIndex] !== undefined ? VERTICAL_SPANS[state.vIndex] : VERTICAL_SPANS[3];

    const colWidth = workarea.width / 12;
    const rowHeight = workarea.height / 12;

    const xStart = workarea.x + Math.round(hSpan[0] * colWidth);
    const xEnd = workarea.x + Math.round(hSpan[1] * colWidth);
    let width = xEnd - xStart;
    let x = xStart;

    const yStart = workarea.y + Math.round(vSpan[0] * rowHeight);
    const yEnd = workarea.y + Math.round(vSpan[1] * rowHeight);
    let height = yEnd - yStart;
    let y = yStart;

    if (gaps > 0) {
      x += gaps;
      y += gaps;
      width -= 2 * gaps;
      height -= 2 * gaps;
    }

    return { x, y, width, height };
  }
}
