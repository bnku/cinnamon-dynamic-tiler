import { Config, Direction, Geometry, ScreenInfo, WindowState, getGridColumns, getGridRows, getMinColumnSpan, getMinRowSpan } from './types';
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
    config: Config,
    fixedVSpan?: [number, number]
  ): [number, number] {
    return InitialLayout.getInitialHSpan(direction, siblingSpans, config, fixedVSpan);
  }

  /**
   * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
   */
  public static getInitialVSpan(
    direction: 'up' | 'down' | 'shift-up' | 'shift-down',
    siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[],
    config: Config,
    fixedHSpan?: [number, number]
  ): [number, number] {
    return InitialLayout.getInitialVSpan(direction, siblingSpans, config, fixedHSpan);
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
    const gridColumns = getGridColumns(config);
    const gridRows = getGridRows(config);
    const minColumnSpan = getMinColumnSpan(config);
    const minRowSpan = getMinRowSpan(config);

    // Если hSpan/vSpan не инициализированы, берем их на основе индексов
    if (!nextState.hSpan) {
      nextState.hSpan = HORIZONTAL_SPANS[nextState.hIndex] || [0, gridColumns];
    }
    if (!nextState.vSpan) {
      nextState.vSpan = VERTICAL_SPANS[nextState.vIndex] || [0, gridRows];
    }

    const halfColumns = Math.round(gridColumns / 2);
    const halfRows = Math.round(gridRows / 2);

    if (currentState.lastDirection === null) {
      // Первый тайлинг окна
      switch (direction) {
        case 'left': {
          const spans = InitialLayout.getInitialSpans('left', siblingSpans, config);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.hSpan[0] > 0 ? 'right' : 'left';
          break;
        }

        case 'right': {
          const spans = InitialLayout.getInitialSpans('right', siblingSpans, config);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.hSpan[1] < gridColumns ? 'left' : 'right';
          break;
        }

        case 'up': {
          const spans = InitialLayout.getInitialSpans('up', siblingSpans, config);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.vSpan[0] > 0 ? 'down' : 'up';
          break;
        }

        case 'down': {
          const spans = InitialLayout.getInitialSpans('down', siblingSpans, config);
          nextState.hSpan = spans.hSpan;
          nextState.vSpan = spans.vSpan;
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.vSpan[1] < gridRows ? 'up' : 'down';
          break;
        }

        case 'shift-left':
          nextState.hSpan = [0, halfColumns];
          nextState.vSpan = [0, gridRows];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'shift-left';
          break;

        case 'shift-right':
          nextState.hSpan = [halfColumns, gridColumns];
          nextState.vSpan = [0, gridRows];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'shift-right';
          break;

        case 'shift-up':
          nextState.hSpan = [0, gridColumns];
          nextState.vSpan = [0, halfRows];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'shift-up';
          break;

        case 'shift-down':
          nextState.hSpan = [0, gridColumns];
          nextState.vSpan = [halfRows, gridRows];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'shift-down';
          break;
      }
    } else {
      // Проверка на смену оси (Corner Mode)
      const isHorizontalOld = currentState.lastDirection === 'left' || currentState.lastDirection === 'right' || currentState.lastDirection === 'shift-left' || currentState.lastDirection === 'shift-right';
      const isVerticalOld = currentState.lastDirection === 'up' || currentState.lastDirection === 'down' || currentState.lastDirection === 'shift-up' || currentState.lastDirection === 'shift-down';
      
      const isHorizontalNew = direction === 'left' || direction === 'right' || direction === 'shift-left' || direction === 'shift-right';
      const isVerticalNew = direction === 'up' || direction === 'down' || direction === 'shift-up' || direction === 'shift-down';

      // Если обе оси уже не full, Corner Mode переключается в "эластичный ресайз внутри угла"
      const isBothSpansCompressed = 
        (currentState.hSpan[1] - currentState.hSpan[0] < gridColumns) &&
        (currentState.vSpan[1] - currentState.vSpan[0] < gridRows);

      if (!isBothSpansCompressed) {
        if (isHorizontalOld && isVerticalNew) {
          nextState.hSpan = currentState.hSpan;
          nextState.hIndex = currentState.hIndex;
          nextState.vSpan = this.getInitialVSpan(direction as 'up' | 'down' | 'shift-up' | 'shift-down', siblingSpans, config, currentState.hSpan);
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = direction;
          return nextState;
        }

        if (isVerticalOld && isHorizontalNew) {
          nextState.vSpan = currentState.vSpan;
          nextState.vIndex = currentState.vIndex;
          nextState.hSpan = this.getInitialHSpan(direction as 'left' | 'right' | 'shift-left' | 'shift-right', siblingSpans, config, currentState.vSpan);
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.lastDirection = direction;
          return nextState;
        }
      }

      // Окно уже в режиме тайлинга
      switch (direction) {
        case 'left': {
          const [start, end] = nextState.hSpan;
          let newStart = start;
          let newEnd = end;

          if (start > 0) {
            newStart = Math.max(0, start - config.step);
          } else {
            newEnd = Math.max(minColumnSpan, end - config.step);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const leftCollision = targetSpan[0] < currentState.hSpan[0] && ChainBlockDetector.isLeftChainBlocked(currentState.hSpan[0], siblingSpans, config, currentState.vSpan);

          if (leftCollision) {
            const currentStart = currentState.hSpan[0];
            const currentEnd = currentState.hSpan[1];
            nextState.hSpan = [
              currentStart,
              Math.max(currentStart + minColumnSpan, currentEnd - config.step)
            ];
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

          if (end < gridColumns) {
            newEnd = Math.min(gridColumns, end + config.step);
          } else {
            newStart = Math.min(gridColumns - minColumnSpan, start + config.step);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const rightCollision = targetSpan[1] > currentState.hSpan[1] && ChainBlockDetector.isRightChainBlocked(currentState.hSpan[1], siblingSpans, config, currentState.vSpan);

          if (rightCollision) {
            const currentStart = currentState.hSpan[0];
            const currentEnd = currentState.hSpan[1];
            nextState.hSpan = [
              Math.min(currentEnd - minColumnSpan, currentStart + config.step),
              currentEnd
            ];
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
            newStart = Math.max(0, start - config.step);
          } else {
            newEnd = Math.max(minRowSpan, end - config.step);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const topCollision = targetSpan[0] < currentState.vSpan[0] && ChainBlockDetector.isTopChainBlocked(currentState.vSpan[0], siblingSpans, config, currentState.hSpan);

          if (topCollision) {
            const currentStart = currentState.vSpan[0];
            const currentEnd = currentState.vSpan[1];
            nextState.vSpan = [
              currentStart,
              Math.max(currentStart + minRowSpan, currentEnd - config.step)
            ];
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

          if (end < gridRows) {
            newEnd = Math.min(gridRows, end + config.step);
          } else {
            newStart = Math.min(gridRows - minRowSpan, start + config.step);
          }
          const targetSpan: [number, number] = [newStart, newEnd];
          const bottomCollision = targetSpan[1] > currentState.vSpan[1] && ChainBlockDetector.isBottomChainBlocked(currentState.vSpan[1], siblingSpans, config, currentState.hSpan);

          if (bottomCollision) {
            const currentStart = currentState.vSpan[0];
            const currentEnd = currentState.vSpan[1];
            nextState.vSpan = [
              Math.min(currentEnd - minRowSpan, currentStart + config.step),
              currentEnd
            ];
          } else {
            nextState.vSpan = targetSpan;
          }
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'down';
          break;
        }

        case 'shift-left':
          nextState.hSpan = [0, halfColumns];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.lastDirection = 'shift-left';
          break;

        case 'shift-right':
          nextState.hSpan = [halfColumns, gridColumns];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.lastDirection = 'shift-right';
          break;

        case 'shift-up':
          nextState.vSpan = [0, halfRows];
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'shift-up';
          break;

        case 'shift-down':
          nextState.vSpan = [halfRows, gridRows];
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = 'shift-down';
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

  public static geometryToHSpan(geom: Geometry, monitor: ScreenInfo, config?: Config): [number, number] {
    return GeometryConverter.geometryToHSpan(geom, monitor, config);
  }

  public static geometryToVSpan(geom: Geometry, monitor: ScreenInfo, config?: Config): [number, number] {
    return GeometryConverter.geometryToVSpan(geom, monitor, config);
  }

  public static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry {
    return GeometryConverter.stateToGeometry(state, screen, config);
  }
}
