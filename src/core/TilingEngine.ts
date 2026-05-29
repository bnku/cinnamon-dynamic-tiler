import { Geometry, ScreenInfo, Direction, WindowState, Config } from './types';
import { HORIZONTAL_SPANS, VERTICAL_SPANS, spanToHIndex, spanToVIndex } from './engine/GridSpans';
import { GeometryConverter } from './engine/GeometryConverter';
import { InitialLayout } from './engine/InitialLayout';
import { ChainBlockDetector } from './engine/ChainBlockDetector';
import { ChainTransitions } from './engine/ChainTransitions';

export { HORIZONTAL_SPANS, VERTICAL_SPANS };

export class TilingEngine {
  /**
   * Возвращает дефолтное пустое состояние окна (до тайлинга)
   */
  public static getDefaultState(): WindowState {
    return {
      hIndex: 5, // [0, 12] (полная ширина)
      vIndex: 5, // [0, 12] (полная высота)
      hSpan: [0, 12],
      vSpan: [0, 12],
      lastDirection: null,
    };
  }

  /**
   * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
   */
  public static getInitialHSpan(
    direction: 'left' | 'right' | 'shift-left' | 'shift-right',
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[],
    fixedVSpan?: [number, number]
  ): [number, number] {
    return InitialLayout.getInitialHSpan(direction, siblingSpans, fixedVSpan);
  }

  /**
   * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
   */
  public static getInitialVSpan(
    direction: 'up' | 'down',
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[],
    fixedHSpan?: [number, number]
  ): [number, number] {
    return InitialLayout.getInitialVSpan(direction, siblingSpans, fixedHSpan);
  }

  /**
   * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
   */
  public static calculateNextState(
    currentState: WindowState,
    direction: Direction,
    config: Config,
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[] = []
  ): WindowState {
    const nextState: WindowState = { ...currentState };

    // Если hSpan/vSpan не инициализированы, берем их на основе индексов
    if (!nextState.hSpan) {
      nextState.hSpan = HORIZONTAL_SPANS[nextState.hIndex] || HORIZONTAL_SPANS[5];
    }
    if (!nextState.vSpan) {
      nextState.vSpan = VERTICAL_SPANS[nextState.vIndex] || VERTICAL_SPANS[5];
    }

    if (currentState.lastDirection === null) {
      // Первый тайлинг окна
      switch (direction) {
        case 'left': {
          const spans = InitialLayout.getInitialSpans('left', siblingSpans);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.hSpan[0] > 0 ? 'right' : 'left';
          break;
        }

        case 'right': {
          const spans = InitialLayout.getInitialSpans('right', siblingSpans);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.hSpan[1] < 12 ? 'left' : 'right';
          break;
        }

        case 'up': {
          const spans = InitialLayout.getInitialSpans('up', siblingSpans);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.vSpan[0] > 0 ? 'down' : 'up';
          break;
        }

        case 'down': {
          const spans = InitialLayout.getInitialSpans('down', siblingSpans);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.vSpan[1] < 12 ? 'up' : 'down';
          break;
        }

        case 'shift-left':
          nextState.hSpan = [0, 6];
          nextState.vSpan = [0, 12];
          nextState.hIndex = 2;
          nextState.vIndex = 5;
          nextState.lastDirection = 'shift-left';
          break;

        case 'shift-right':
          nextState.hSpan = [6, 12];
          nextState.vSpan = [0, 12];
          nextState.hIndex = 8;
          nextState.vIndex = 5;
          nextState.lastDirection = 'shift-right';
          break;
      }
    } else {
      // Проверка на смену оси (Corner Mode)
      const isHorizontalOld = currentState.lastDirection === 'left' || currentState.lastDirection === 'right' || currentState.lastDirection === 'shift-left' || currentState.lastDirection === 'shift-right';
      const isVerticalOld = currentState.lastDirection === 'up' || currentState.lastDirection === 'down';
      
      const isHorizontalNew = direction === 'left' || direction === 'right' || direction === 'shift-left' || direction === 'shift-right';
      const isVerticalNew = direction === 'up' || direction === 'down';

      if (isHorizontalOld && isVerticalNew) {
        nextState.hSpan = currentState.hSpan;
        nextState.hIndex = currentState.hIndex;
        nextState.vSpan = this.getInitialVSpan(direction as 'up' | 'down', siblingSpans, currentState.hSpan);
        nextState.vIndex = this.spanToVIndex(nextState.vSpan);
        nextState.lastDirection = direction;
        return nextState;
      }

      if (isVerticalOld && isHorizontalNew) {
        nextState.vSpan = currentState.vSpan;
        nextState.vIndex = currentState.vIndex;
        nextState.hSpan = this.getInitialHSpan(direction as 'left' | 'right' | 'shift-left' | 'shift-right', siblingSpans, currentState.vSpan);
        nextState.hIndex = this.spanToHIndex(nextState.hSpan);
        nextState.lastDirection = direction;
        return nextState;
      }

      // Окно уже в режиме тайлинга
      switch (direction) {
        case 'left': {
          const [start, end] = nextState.hSpan;
          let newStart = start;
          let newEnd = end;

          if (start > 0) {
            newStart = Math.max(0, start - 2);
          } else {
            newEnd = Math.max(2, end - 2);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const leftCollision = targetSpan[0] < currentState.hSpan[0] && ChainBlockDetector.isLeftChainBlocked(currentState.hSpan[0], siblingSpans);

          if (leftCollision) {
            const currentStart = currentState.hSpan[0];
            const currentEnd = currentState.hSpan[1];
            const currentWidth = currentEnd - currentStart;
            let nextWidth = currentWidth > 6 ? 6 : 2;
            if (currentWidth <= 2) nextWidth = 2;
            nextState.hSpan = [currentStart, currentStart + nextWidth];
          } else {
            nextState.hSpan = targetSpan;
          }
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.lastDirection = 'left';
          break;
        }

        case 'right': {
          const [start, end] = nextState.hSpan;
          let newStart = start;
          let newEnd = end;

          if (end < 12) {
            newEnd = Math.min(12, end + 2);
          } else {
            newStart = Math.min(10, start + 2);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const rightCollision = targetSpan[1] > currentState.hSpan[1] && ChainBlockDetector.isRightChainBlocked(currentState.hSpan[1], siblingSpans);

          if (rightCollision) {
            const currentStart = currentState.hSpan[0];
            const currentEnd = currentState.hSpan[1];
            const currentWidth = currentEnd - currentStart;
            let nextWidth = currentWidth > 6 ? 6 : 2;
            if (currentWidth <= 2) nextWidth = 2;
            nextState.hSpan = [currentEnd - nextWidth, currentEnd];
          } else {
            nextState.hSpan = targetSpan;
          }
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.lastDirection = 'right';
          break;
        }

        case 'up': {
          const [start, end] = nextState.vSpan;
          let newStart = start;
          let newEnd = end;

          if (start > 0) {
            newStart = Math.max(0, start - 2);
          } else {
            newEnd = Math.max(2, end - 2);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const topCollision = targetSpan[0] < currentState.vSpan[0] && ChainBlockDetector.isTopChainBlocked(currentState.vSpan[0], siblingSpans);

          if (topCollision) {
            const currentStart = currentState.vSpan[0];
            const currentEnd = currentState.vSpan[1];
            const currentHeight = currentEnd - currentStart;
            let nextHeight = currentHeight > 6 ? 6 : 2;
            if (currentHeight <= 2) nextHeight = 2;
            nextState.vSpan = [currentStart, currentStart + nextHeight];
          } else {
            nextState.vSpan = targetSpan;
          }
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'up';
          break;
        }

        case 'down': {
          const [start, end] = nextState.vSpan;
          let newStart = start;
          let newEnd = end;

          if (end < 12) {
            newEnd = Math.min(12, end + 2);
          } else {
            newStart = Math.min(10, start + 2);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const bottomCollision = targetSpan[1] > currentState.vSpan[1] && ChainBlockDetector.isBottomChainBlocked(currentState.vSpan[1], siblingSpans);

          if (bottomCollision) {
            const currentStart = currentState.vSpan[0];
            const currentEnd = currentState.vSpan[1];
            const currentHeight = currentEnd - currentStart;
            let nextHeight = currentHeight > 6 ? 6 : 2;
            if (currentHeight <= 2) nextHeight = 2;
            nextState.vSpan = [currentEnd - nextHeight, currentEnd];
          } else {
            nextState.vSpan = targetSpan;
          }
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'down';
          break;
        }

        case 'shift-left':
          nextState.hSpan = [0, 6];
          nextState.hIndex = 1;
          nextState.lastDirection = 'shift-left';
          break;

        case 'shift-right':
          nextState.hSpan = [6, 12];
          nextState.hIndex = 8;
          nextState.lastDirection = 'shift-right';
          break;
      }
    }

    return nextState;
  }

  /**
   * Рассчитывает новые состояния для всей цепочки соприкасающихся окон на основе направления
   */
  public static calculateChainTransitions(
    activeId: string,
    direction: Direction,
    config: Config,
    activeWindows: { windowId: string; state: WindowState }[],
    allVisibleSpans: { hSpan: [number, number]; vSpan: [number, number] }[] = []
  ): Record<string, WindowState> {
    return ChainTransitions.calculateChainTransitions(
      activeId,
      direction,
      config,
      activeWindows,
      allVisibleSpans,
      this.calculateNextState.bind(this),
      this.getDefaultState.bind(this)
    );
  }

  public static spanToHIndex(span: [number, number]): number {
    return spanToHIndex(span);
  }

  public static spanToVIndex(span: [number, number]): number {
    return spanToVIndex(span);
  }

  public static geometryToHSpan(geom: Geometry, monitor: ScreenInfo): [number, number] {
    return GeometryConverter.geometryToHSpan(geom, monitor);
  }

  public static geometryToVSpan(geom: Geometry, monitor: ScreenInfo): [number, number] {
    return GeometryConverter.geometryToVSpan(geom, monitor);
  }

  public static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry {
    return GeometryConverter.stateToGeometry(state, screen, config);
  }
}
