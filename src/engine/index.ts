import { Geometry, ScreenInfo, Direction, WindowState, Config } from './types';

export const HORIZONTAL_SPANS: [number, number][] = [
  [0, 2],   // 0
  [0, 4],   // 1
  [0, 6],   // 2 (left 1/2)
  [0, 8],   // 3
  [0, 10],  // 4
  [0, 12],  // 5 (full width)
  [2, 12],  // 6
  [4, 12],  // 7
  [6, 12],  // 8 (right 1/2)
  [8, 12],  // 9
  [10, 12], // 10
];

export const VERTICAL_SPANS: [number, number][] = [
  [0, 2],   // 0
  [0, 4],   // 1
  [0, 6],   // 2 (top 1/2)
  [0, 8],   // 3
  [0, 10],  // 4
  [0, 12],  // 5 (full height)
  [2, 12],  // 6
  [4, 12],  // 7
  [6, 12],  // 8 (bottom 1/2)
  [8, 12],  // 9
  [10, 12], // 10
];

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
    siblingSpans: { hSpan: [number, number] }[]
  ): [number, number] {
    // 1. Строим карту занятости колонок
    const occupied = new Array(12).fill(false);
    for (const sibling of siblingSpans) {
      const [start, end] = sibling.hSpan;
      for (let c = start; c < end; c++) {
        if (c >= 0 && c < 12) {
          occupied[c] = true;
        }
      }
    }

    if (direction === 'shift-left') return [0, 6];
    if (direction === 'shift-right') return [6, 12];

    if (direction === 'left') {
      // Ищем свободную зону слева направо
      // Если самый левый край свободен, занимаем его
      if (!occupied[0]) {
        let end = 0;
        while (end < 12 && !occupied[end]) {
          end++;
        }
        // Занимаем не более 1/2 экрана (6 колонок)
        return [0, Math.min(end, 6)];
      }

      // Если левый край занят, ищем первый свободный стык слева направо
      let start = 0;
      while (start < 12 && occupied[start]) {
        start++;
      }
      if (start < 12) {
        let end = start;
        while (end < 12 && !occupied[end]) {
          end++;
        }
        const width = (end - start) > 6 ? 6 : (end - start);
        return [start, start + width];
      }

      // Если всё занято, ложимся поверх по умолчанию в [0, 6]
      return [0, 6];
    }

    if (direction === 'right') {
      // Ищем свободную зону справа налево
      if (!occupied[11]) {
        let start = 12;
        while (start > 0 && !occupied[start - 1]) {
          start--;
        }
        const width = (12 - start) > 6 ? 6 : (12 - start);
        return [12 - width, 12];
      }

      // Если правый край занят, ищем свободный стык справа налево
      let end = 12;
      while (end > 0 && occupied[end - 1]) {
        end--;
      }
      if (end > 0) {
        let start = end;
        while (start > 0 && !occupied[start - 1]) {
          start--;
        }
        const width = (end - start) > 6 ? 6 : (end - start);
        return [end - width, end];
      }

      return [6, 12];
    }

    return direction === 'left' ? [0, 6] : [6, 12];
  }

  /**
   * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
   */
  public static getInitialVSpan(
    direction: 'up' | 'down',
    siblingSpans: { vSpan: [number, number] }[]
  ): [number, number] {
    const occupied = new Array(12).fill(false);
    for (const sibling of siblingSpans) {
      const [start, end] = sibling.vSpan;
      for (let r = start; r < end; r++) {
        if (r >= 0 && r < 12) {
          occupied[r] = true;
        }
      }
    }

    if (direction === 'up') {
      if (!occupied[0]) {
        let end = 0;
        while (end < 12 && !occupied[end]) {
          end++;
        }
        return [0, Math.min(end, 6)];
      }

      let start = 0;
      while (start < 12 && occupied[start]) {
        start++;
      }
      if (start < 12) {
        let end = start;
        while (end < 12 && !occupied[end]) {
          end++;
        }
        const height = (end - start) > 6 ? 6 : (end - start);
        return [start, start + height];
      }

      return [0, 6];
    }

    if (direction === 'down') {
      if (!occupied[11]) {
        let start = 12;
        while (start > 0 && !occupied[start - 1]) {
          start--;
        }
        const height = (12 - start) > 6 ? 6 : (12 - start);
        return [12 - height, 12];
      }

      let end = 12;
      while (end > 0 && occupied[end - 1]) {
        end--;
      }
      if (end > 0) {
        let start = end;
        while (start > 0 && !occupied[start - 1]) {
          start--;
        }
        const height = (end - start) > 6 ? 6 : (end - start);
        return [end - height, end];
      }

      return [6, 12];
    }

    return direction === 'up' ? [0, 6] : [6, 12];
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
        case 'left':
          nextState.hSpan = this.getInitialHSpan('left', siblingSpans);
          nextState.vSpan = [0, 12];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = 5;
          nextState.lastDirection = nextState.hSpan[0] > 0 ? 'right' : 'left';
          break;

        case 'right':
          nextState.hSpan = this.getInitialHSpan('right', siblingSpans);
          nextState.vSpan = [0, 12];
          nextState.hIndex = this.spanToHIndex(nextState.hSpan);
          nextState.vIndex = 5;
          nextState.lastDirection = nextState.hSpan[1] < 12 ? 'left' : 'right';
          break;

        case 'up':
          nextState.hSpan = [0, 12];
          nextState.vSpan = this.getInitialVSpan('up', siblingSpans);
          nextState.hIndex = 5;
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.vSpan[0] > 0 ? 'down' : 'up';
          break;

        case 'down':
          nextState.hSpan = [0, 12];
          nextState.vSpan = this.getInitialVSpan('down', siblingSpans);
          nextState.hIndex = 5;
          nextState.vIndex = this.spanToVIndex(nextState.vSpan);
          nextState.lastDirection = nextState.vSpan[1] < 12 ? 'up' : 'down';
          break;

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
          const leftCollision = targetSpan[0] < currentState.hSpan[0] && this.isLeftChainBlocked(currentState.hSpan[0], siblingSpans);

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
          const rightCollision = targetSpan[1] > currentState.hSpan[1] && this.isRightChainBlocked(currentState.hSpan[1], siblingSpans);

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
          const topCollision = targetSpan[0] < currentState.vSpan[0] && this.isTopChainBlocked(currentState.vSpan[0], siblingSpans);

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
          const bottomCollision = targetSpan[1] > currentState.vSpan[1] && this.isBottomChainBlocked(currentState.vSpan[1], siblingSpans);

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
    const result: Record<string, WindowState> = {};
    
    // 1. Находим активное окно в списке
    const activeWin = activeWindows.find(w => w.windowId === activeId);
    if (!activeWin) {
      // Если активного окна нет в списке (первый тайлинг), рассчитываем его с учетом прилипания к соседям
      // Если передан список всех видимых окон на мониторе, используем его!
      const siblingSpans = allVisibleSpans.length > 0
        ? allVisibleSpans
        : activeWindows.map(w => ({
            hSpan: w.state.hSpan || HORIZONTAL_SPANS[w.state.hIndex] || HORIZONTAL_SPANS[5],
            vSpan: w.state.vSpan || VERTICAL_SPANS[w.state.vIndex] || VERTICAL_SPANS[3]
          }));
      const defaultState = this.getDefaultState();
      const nextActiveState = this.calculateNextState(defaultState, direction, config, siblingSpans);
      result[activeId] = nextActiveState;
      return result;
    }

    // Инициализируем hSpan/vSpan в активном окне, если их нет
    const currentActiveState = { ...activeWin.state };
    if (!currentActiveState.hSpan) {
      currentActiveState.hSpan = HORIZONTAL_SPANS[currentActiveState.hIndex] || HORIZONTAL_SPANS[5];
    }
    if (!currentActiveState.vSpan) {
      currentActiveState.vSpan = VERTICAL_SPANS[currentActiveState.vIndex] || VERTICAL_SPANS[3];
    }

    // Сиблинги для проверки упора активного окна
    const siblings = activeWindows
      .filter(w => w.windowId !== activeId)
      .map(w => ({
        hSpan: w.state.hSpan || HORIZONTAL_SPANS[w.state.hIndex] || HORIZONTAL_SPANS[5],
        vSpan: w.state.vSpan || VERTICAL_SPANS[w.state.vIndex] || VERTICAL_SPANS[3]
      }));

    // 2. Рассчитываем одиночный шаг для активного окна (с передачей соседей для выявления тупиков)
    const nextActiveState = this.calculateNextState(currentActiveState, direction, config, siblings);
    result[activeId] = nextActiveState;

    // Если это сдвиг Shift, цепочка ресайза не срабатывает, просто сдвигаем окно
    if (direction === 'shift-left' || direction === 'shift-right') {
      return result;
    }

    // Приводим все остальные окна в списке к корректным hSpan/vSpan
    const normalizedWindows = activeWindows.map(w => {
      const state = { ...w.state };
      if (!state.hSpan) {
        state.hSpan = HORIZONTAL_SPANS[state.hIndex] || HORIZONTAL_SPANS[5];
      }
      if (!state.vSpan) {
        state.vSpan = VERTICAL_SPANS[state.vIndex] || VERTICAL_SPANS[5];
      }
      return { windowId: w.windowId, state };
    });

    // 3. Обрабатываем цепочку соприкасающихся окон по горизонтали
    if (direction === 'left' || direction === 'right') {
      const sortedWins = [...normalizedWindows].sort((a, b) => {
        const aSpan = a.windowId === activeId ? nextActiveState.hSpan : a.state.hSpan;
        const bSpan = b.windowId === activeId ? nextActiveState.hSpan : b.state.hSpan;
        return aSpan[0] - bSpan[0];
      });

      const N = sortedWins.length;
      const k = sortedWins.findIndex(w => w.windowId === activeId);

      const newSpans: [number, number][] = sortedWins.map(w => {
        return w.windowId === activeId ? [...nextActiveState.hSpan] : [...w.state.hSpan];
      });

      const MIN_WIDTH = 2;

      // Распространяем вправо
      for (let i = k + 1; i < N; i++) {
        const prevOriginalEnd = sortedWins[i - 1].state.hSpan[1];
        const currOriginalStart = sortedWins[i].state.hSpan[0];
        
        const wasTouching = Math.abs(currOriginalStart - prevOriginalEnd) === 0;

        if (wasTouching) {
          const origStart = sortedWins[i].state.hSpan[0];
          const origEnd = sortedWins[i].state.hSpan[1];
          newSpans[i][0] = newSpans[i - 1][1];
          const shift = newSpans[i][0] - origStart;

          if (shift > 0) {
            let R = i;
            while (R + 1 < N) {
              const nextStart = sortedWins[R + 1].state.hSpan[0];
              const currEnd = sortedWins[R].state.hSpan[1];
              if (Math.abs(nextStart - currEnd) === 0) {
                R++;
              } else {
                break;
              }
            }
            const chainEnd = sortedWins[R].state.hSpan[1];
            const limitRight = (R + 1 < N) ? sortedWins[R + 1].state.hSpan[0] : 12;
            const freeSpaceRight = limitRight - chainEnd;
            const allowedShift = Math.min(shift, freeSpaceRight);
            newSpans[i][1] = origEnd + allowedShift;
          }

          const width = newSpans[i][1] - newSpans[i][0];

          if (width < MIN_WIDTH) {
            newSpans[i][1] = newSpans[i][0] + MIN_WIDTH;

            if (newSpans[i][1] > 12) {
              newSpans[i][1] = 12;
              newSpans[i][0] = 10; // наложение
            }
          }
        }
      }

      // Распространяем влево
      for (let i = k - 1; i >= 0; i--) {
        const nextOriginalStart = sortedWins[i + 1].state.hSpan[0];
        const currOriginalEnd = sortedWins[i].state.hSpan[1];

        const wasTouching = Math.abs(nextOriginalStart - currOriginalEnd) === 0;

        if (wasTouching) {
          const origStart = sortedWins[i].state.hSpan[0];
          const origEnd = sortedWins[i].state.hSpan[1];
          newSpans[i][1] = newSpans[i + 1][0];
          const shift = origEnd - newSpans[i][1];

          if (shift > 0) {
            let L = i;
            while (L - 1 >= 0) {
              const prevEnd = sortedWins[L - 1].state.hSpan[1];
              const currStart = sortedWins[L].state.hSpan[0];
              if (Math.abs(currStart - prevEnd) === 0) {
                L--;
              } else {
                break;
              }
            }
            const chainStart = sortedWins[L].state.hSpan[0];
            const limitLeft = (L - 1 >= 0) ? sortedWins[L - 1].state.hSpan[1] : 0;
            const freeSpaceLeft = chainStart - limitLeft;
            const allowedShift = Math.min(shift, freeSpaceLeft);
            newSpans[i][0] = origStart - allowedShift;
          }

          const width = newSpans[i][1] - newSpans[i][0];

          if (width < MIN_WIDTH) {
            newSpans[i][0] = newSpans[i][1] - MIN_WIDTH;

            if (newSpans[i][0] < 0) {
              newSpans[i][0] = 0;
              newSpans[i][1] = 2; // наложение
            }
          }
        }
      }

      // Заполняем результат
      for (let i = 0; i < N; i++) {
        const w = sortedWins[i];
        if (w.windowId === activeId) {
          nextActiveState.hSpan = newSpans[i];
          nextActiveState.hIndex = this.spanToHIndex(newSpans[i]);
        } else {
          const nextState: WindowState = {
            ...w.state,
            hSpan: newSpans[i],
            hIndex: this.spanToHIndex(newSpans[i]),
            lastDirection: direction
          };
          result[w.windowId] = nextState;
        }
      }
    }

    // 4. Обрабатываем цепочку соприкасающихся окон по вертикали
    if (direction === 'up' || direction === 'down') {
      const sortedWins = [...normalizedWindows].sort((a, b) => {
        const aSpan = a.windowId === activeId ? nextActiveState.vSpan : a.state.vSpan;
        const bSpan = b.windowId === activeId ? nextActiveState.vSpan : b.state.vSpan;
        return aSpan[0] - bSpan[0];
      });

      const N = sortedWins.length;
      const k = sortedWins.findIndex(w => w.windowId === activeId);

      const newSpans: [number, number][] = sortedWins.map(w => {
        return w.windowId === activeId ? [...nextActiveState.vSpan] : [...w.state.vSpan];
      });

      const MIN_HEIGHT = 2;

      // Распространяем вниз
      for (let i = k + 1; i < N; i++) {
        const prevOriginalEnd = sortedWins[i - 1].state.vSpan[1];
        const currOriginalStart = sortedWins[i].state.vSpan[0];
        
        const wasTouching = Math.abs(currOriginalStart - prevOriginalEnd) === 0;

        if (wasTouching) {
          const origStart = sortedWins[i].state.vSpan[0];
          const origEnd = sortedWins[i].state.vSpan[1];
          newSpans[i][0] = newSpans[i - 1][1];
          const shift = newSpans[i][0] - origStart;

          if (shift > 0) {
            let R = i;
            while (R + 1 < N) {
              const nextStart = sortedWins[R + 1].state.vSpan[0];
              const currEnd = sortedWins[R].state.vSpan[1];
              if (Math.abs(nextStart - currEnd) === 0) {
                R++;
              } else {
                break;
              }
            }
            const chainEnd = sortedWins[R].state.vSpan[1];
            const limitBottom = (R + 1 < N) ? sortedWins[R + 1].state.vSpan[0] : 12;
            const freeSpaceBottom = limitBottom - chainEnd;
            const allowedShift = Math.min(shift, freeSpaceBottom);
            newSpans[i][1] = origEnd + allowedShift;
          }

          const height = newSpans[i][1] - newSpans[i][0];

          if (height < MIN_HEIGHT) {
            newSpans[i][1] = newSpans[i][0] + MIN_HEIGHT;

            if (newSpans[i][1] > 12) {
              newSpans[i][1] = 12;
              newSpans[i][0] = 10; // наложение
            }
          }
        }
      }

      // Распространяем вверх
      for (let i = k - 1; i >= 0; i--) {
        const nextOriginalStart = sortedWins[i + 1].state.vSpan[0];
        const currOriginalEnd = sortedWins[i].state.vSpan[1];

        const wasTouching = Math.abs(nextOriginalStart - currOriginalEnd) === 0;

        if (wasTouching) {
          const origStart = sortedWins[i].state.vSpan[0];
          const origEnd = sortedWins[i].state.vSpan[1];
          newSpans[i][1] = newSpans[i + 1][0];
          const shift = origEnd - newSpans[i][1];

          if (shift > 0) {
            let L = i;
            while (L - 1 >= 0) {
              const prevEnd = sortedWins[L - 1].state.vSpan[1];
              const currStart = sortedWins[L].state.vSpan[0];
              if (Math.abs(currStart - prevEnd) === 0) {
                L--;
              } else {
                break;
              }
            }
            const chainStart = sortedWins[L].state.vSpan[0];
            const limitTop = (L - 1 >= 0) ? sortedWins[L - 1].state.vSpan[1] : 0;
            const freeSpaceTop = chainStart - limitTop;
            const allowedShift = Math.min(shift, freeSpaceTop);
            newSpans[i][0] = origStart - allowedShift;
          }

          const height = newSpans[i][1] - newSpans[i][0];

          if (height < MIN_HEIGHT) {
            newSpans[i][0] = newSpans[i][1] - MIN_HEIGHT;

            if (newSpans[i][0] < 0) {
              newSpans[i][0] = 0;
              newSpans[i][1] = 2; // наложение
            }
          }
        }
      }

      // Заполняем результат
      for (let i = 0; i < N; i++) {
        const w = sortedWins[i];
        if (w.windowId === activeId) {
          nextActiveState.vSpan = newSpans[i];
          nextActiveState.vIndex = this.spanToVIndex(newSpans[i]);
        } else {
          const nextState: WindowState = {
            ...w.state,
            vSpan: newSpans[i],
            vIndex: this.spanToVIndex(newSpans[i]),
            lastDirection: direction
          };
          result[w.windowId] = nextState;
        }
      }
    }

    return result;
  }

  /**
   * Мапит горизонтальный спан на примерный hIndex для совместимости со старыми частями кода
   */
  public static spanToHIndex(span: [number, number]): number {
    for (let i = 0; i < HORIZONTAL_SPANS.length; i++) {
      if (HORIZONTAL_SPANS[i][0] === span[0] && HORIZONTAL_SPANS[i][1] === span[1]) {
        return i;
      }
    }
    return 5; 
  }

  /**
   * Мапит вертикальный спан на примерный vIndex для совместимости
   */
  public static spanToVIndex(span: [number, number]): number {
    for (let i = 0; i < VERTICAL_SPANS.length; i++) {
      if (VERTICAL_SPANS[i][0] === span[0] && VERTICAL_SPANS[i][1] === span[1]) {
        return i;
      }
    }
    return 3;
  }

  /**
   * Преобразует физическую геометрию окна в логические колонки (hSpan) на указанном мониторе
   */
  public static geometryToHSpan(geom: Geometry, monitor: ScreenInfo): [number, number] {
    const { workarea } = monitor;
    const colWidth = workarea.width / 12;
    const relLeft = geom.x - workarea.x;
    const relRight = geom.x + geom.width - workarea.x;

    let startCol = Math.floor(relLeft / colWidth);
    const startRemainder = (relLeft / colWidth) - startCol;
    if (startRemainder > 0.2) {
      startCol = Math.min(11, startCol + 1);
    }
    startCol = Math.max(0, startCol);

    let endCol = Math.ceil(relRight / colWidth);
    const endRemainder = endCol - (relRight / colWidth);
    if (endRemainder > 0.2) {
      endCol = Math.max(1, endCol - 1);
    }
    endCol = Math.min(12, endCol);

    return [startCol, endCol];
  }

  /**
   * Преобразует физическую геометрию окна в логические строки (vSpan) на указанном мониторе
   */
  public static geometryToVSpan(geom: Geometry, monitor: ScreenInfo): [number, number] {
    const { workarea } = monitor;
    const rowHeight = workarea.height / 12;
    const relTop = geom.y - workarea.y;
    const relBottom = geom.y + geom.height - workarea.y;

    let startRow = Math.floor(relTop / rowHeight);
    const startRemainder = (relTop / rowHeight) - startRow;
    if (startRemainder > 0.2) {
      startRow = Math.min(11, startRow + 1);
    }
    startRow = Math.max(0, startRow);

    let endRow = Math.ceil(relBottom / rowHeight);
    const endRemainder = endRow - (relBottom / rowHeight);
    if (endRemainder > 0.2) {
      endRow = Math.max(1, endRow - 1);
    }
    endRow = Math.min(12, endRow);

    return [startRow, endRow];
  }

  /**
   * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
   */
  public static stateToGeometry(state: WindowState, screen: ScreenInfo, config: Config): Geometry {
    const { workarea } = screen;
    const gaps = config.gaps || 0;

    const hSpan = state.hSpan || HORIZONTAL_SPANS[state.hIndex] || HORIZONTAL_SPANS[5];
    const vSpan = state.vSpan || VERTICAL_SPANS[state.vIndex] || VERTICAL_SPANS[3];

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

  /**
   * Проверяет, заблокирована ли цепочка соприкасающихся окон слева от текущей границы
   */
  private static isLeftChainBlocked(startCol: number, siblingSpans: { hSpan: [number, number] }[]): boolean {
    let currentStart = startCol;
    let chainLength = 0;
    let currentChainWidth = 0;

    while (true) {
      const neighbor = siblingSpans.find(s => s.hSpan[1] === currentStart);
      if (!neighbor) break;

      chainLength++;
      const width = neighbor.hSpan[1] - neighbor.hSpan[0];
      currentChainWidth += width;
      currentStart = neighbor.hSpan[0];
    }

    if (chainLength === 0) return false;

    const freeSpace = currentStart;
    const minChainWidth = chainLength * 2;
    const compressionReserve = currentChainWidth - minChainWidth;
    const movementReserve = freeSpace + compressionReserve;

    return movementReserve <= 0;
  }

  /**
   * Проверяет, заблокирована ли цепочка соприкасающихся окон справа от текущей границы
   */
  private static isRightChainBlocked(endCol: number, siblingSpans: { hSpan: [number, number] }[]): boolean {
    let currentEnd = endCol;
    let chainLength = 0;
    let currentChainWidth = 0;

    while (true) {
      const neighbor = siblingSpans.find(s => s.hSpan[0] === currentEnd);
      if (!neighbor) break;

      chainLength++;
      const width = neighbor.hSpan[1] - neighbor.hSpan[0];
      currentChainWidth += width;
      currentEnd = neighbor.hSpan[1];
    }

    if (chainLength === 0) return false;

    const freeSpace = 12 - currentEnd;
    const minChainWidth = chainLength * 2;
    const compressionReserve = currentChainWidth - minChainWidth;
    const movementReserve = freeSpace + compressionReserve;

    return movementReserve <= 0;
  }

  /**
   * Проверяет, заблокирована ли цепочка соприкасающихся окон сверху от текущей границы
   */
  private static isTopChainBlocked(startRow: number, siblingSpans: { vSpan: [number, number] }[]): boolean {
    let currentStart = startRow;
    let chainLength = 0;
    let currentChainHeight = 0;

    while (true) {
      const neighbor = siblingSpans.find(s => s.vSpan[1] === currentStart);
      if (!neighbor) break;

      chainLength++;
      const height = neighbor.vSpan[1] - neighbor.vSpan[0];
      currentChainHeight += height;
      currentStart = neighbor.vSpan[0];
    }

    if (chainLength === 0) return false;

    const freeSpace = currentStart;
    const minChainHeight = chainLength * 2;
    const compressionReserve = currentChainHeight - minChainHeight;
    const movementReserve = freeSpace + compressionReserve;

    return movementReserve <= 0;
  }

  /**
   * Проверяет, заблокирована ли цепочка соприкасающихся окон снизу от текущей границы
   */
  private static isBottomChainBlocked(endRow: number, siblingSpans: { vSpan: [number, number] }[]): boolean {
    let currentEnd = endRow;
    let chainLength = 0;
    let currentChainHeight = 0;

    while (true) {
      const neighbor = siblingSpans.find(s => s.vSpan[0] === currentEnd);
      if (!neighbor) break;

      chainLength++;
      const height = neighbor.vSpan[1] - neighbor.vSpan[0];
      currentChainHeight += height;
      currentEnd = neighbor.vSpan[1];
    }

    if (chainLength === 0) return false;

    const freeSpace = 12 - currentEnd;
    const minChainHeight = chainLength * 2;
    const compressionReserve = currentChainHeight - minChainHeight;
    const movementReserve = freeSpace + compressionReserve;

    return movementReserve <= 0;
  }
}
