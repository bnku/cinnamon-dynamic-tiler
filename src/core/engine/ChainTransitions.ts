import { Direction, Config, WindowState } from '../types';
import { HORIZONTAL_SPANS, VERTICAL_SPANS, spanToHIndex, spanToVIndex } from './GridSpans';

export class ChainTransitions {
  /**
   * Рассчитывает новые состояния для всей цепочки соприкасающихся окон на основе направления
   */
  public static calculateChainTransitions(
    activeId: string,
    direction: Direction,
    config: Config,
    activeWindows: { windowId: string; state: WindowState }[],
    allVisibleSpans: { hSpan: [number, number]; vSpan: [number, number] }[] = [],
    calculateNextStateFn: (
      currentState: WindowState,
      direction: Direction,
      config: Config,
      siblingSpans: { hSpan: [number, number]; vSpan: [number, number] }[]
    ) => WindowState,
    getDefaultStateFn: () => WindowState
  ): Record<string, WindowState> {
    const result: Record<string, WindowState> = {};
    
    // 1. Находим активное окно в списке
    const activeWin = activeWindows.find(w => w.windowId === activeId);
    if (!activeWin) {
      const siblingSpans = allVisibleSpans.length > 0
        ? allVisibleSpans
        : activeWindows.map(w => ({
            hSpan: w.state.hSpan || HORIZONTAL_SPANS[w.state.hIndex] || [0, config.gridSize],
            vSpan: w.state.vSpan || VERTICAL_SPANS[w.state.vIndex] || [0, config.gridSize]
          }));
      const defaultState = getDefaultStateFn();
      const nextActiveState = calculateNextStateFn(defaultState, direction, config, siblingSpans);
      result[activeId] = nextActiveState;
      return result;
    }

    // Инициализируем hSpan/vSpan в активном окне, если их нет
    const currentActiveState = { ...activeWin.state };
    if (!currentActiveState.hSpan) {
      currentActiveState.hSpan = HORIZONTAL_SPANS[currentActiveState.hIndex] || [0, config.gridSize];
    }
    if (!currentActiveState.vSpan) {
      currentActiveState.vSpan = VERTICAL_SPANS[currentActiveState.vIndex] || [0, config.gridSize];
    }

    // Сиблинги для проверки упора активного окна
    const siblings = activeWindows
      .filter(w => w.windowId !== activeId)
      .map(w => ({
        hSpan: w.state.hSpan || HORIZONTAL_SPANS[w.state.hIndex] || [0, config.gridSize],
        vSpan: w.state.vSpan || VERTICAL_SPANS[w.state.vIndex] || [0, config.gridSize]
      }));

    // 2. Рассчитываем одиночный шаг для активного окна (с передачей соседей для выявления тупиков)
    const nextActiveState = calculateNextStateFn(currentActiveState, direction, config, siblings);
    result[activeId] = nextActiveState;

    // Если это сдвиг Shift, цепочка ресайза не срабатывает, просто сдвигаем окно
    if (direction === 'shift-left' || direction === 'shift-right' || direction === 'shift-up' || direction === 'shift-down') {
      return result;
    }

    // Приводим все остальные окна в списке к корректным hSpan/vSpan
    const normalizedWindows = activeWindows.map(w => {
      const state = { ...w.state };
      if (!state.hSpan) {
        state.hSpan = HORIZONTAL_SPANS[state.hIndex] || [0, config.gridSize];
      }
      if (!state.vSpan) {
        state.vSpan = VERTICAL_SPANS[state.vIndex] || [0, config.gridSize];
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

      const MIN_WIDTH = config.minSpan;

      // Распространяем вправо
      for (let i = k + 1; i < N; i++) {
        const currWin = sortedWins[i];
        const currOriginalStart = currWin.state.hSpan[0];

        const touchBoundaries: number[] = [];
        for (let j = 0; j < i; j++) {
          const prevWin = sortedWins[j];
          const hasVSpanOverlap = Math.max(prevWin.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(prevWin.state.vSpan[1], currWin.state.vSpan[1]);
          const touching = prevWin.state.hSpan[1] === currOriginalStart && hasVSpanOverlap;
          if (touching) {
            touchBoundaries.push(newSpans[j][1]);
          }
        }

        if (touchBoundaries.length > 0) {
          const origStart = currWin.state.hSpan[0];
          const origEnd = currWin.state.hSpan[1];
          newSpans[i][0] = Math.max(...touchBoundaries);
          const shift = newSpans[i][0] - origStart;

          if (shift > 0) {
            let limit = config.gridSize;
            for (const other of sortedWins) {
              if (other.windowId === currWin.windowId) continue;
              const hasVSpanOverlap = Math.max(other.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(other.state.vSpan[1], currWin.state.vSpan[1]);
              if (other.state.hSpan[0] >= origEnd && hasVSpanOverlap) {
                if (other.state.hSpan[0] < limit) {
                  limit = other.state.hSpan[0];
                }
              }
            }
            const freeSpace = limit - origEnd;
            const allowedShift = Math.max(0, Math.min(shift, freeSpace));
            newSpans[i][1] = origEnd + allowedShift;
          } else if (shift < 0) {
            const hasRightAnchor = sortedWins.some(other => {
              if (other.windowId === currWin.windowId) return false;
              const hasVSpanOverlap = Math.max(other.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(other.state.vSpan[1], currWin.state.vSpan[1]);
              return other.state.hSpan[0] === origEnd && hasVSpanOverlap;
            });
            const isAnchored = origEnd === config.gridSize || hasRightAnchor;
            newSpans[i][1] = isAnchored ? origEnd : origEnd + shift;
          }

          const width = newSpans[i][1] - newSpans[i][0];
          if (width < MIN_WIDTH) {
            newSpans[i][1] = newSpans[i][0] + MIN_WIDTH;
            if (newSpans[i][1] > config.gridSize) {
              newSpans[i][1] = config.gridSize;
              newSpans[i][0] = config.gridSize - MIN_WIDTH;
            }
          }
        }
      }

      // Распространяем влево
      for (let i = k - 1; i >= 0; i--) {
        const currWin = sortedWins[i];
        const currOriginalEnd = currWin.state.hSpan[1];

        const touchBoundaries: number[] = [];
        for (let j = i + 1; j < N; j++) {
          const nextWin = sortedWins[j];
          const hasVSpanOverlap = Math.max(nextWin.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(nextWin.state.vSpan[1], currWin.state.vSpan[1]);
          const touching = nextWin.state.hSpan[0] === currOriginalEnd && hasVSpanOverlap;
          if (touching) {
            touchBoundaries.push(newSpans[j][0]);
          }
        }

        if (touchBoundaries.length > 0) {
          const origStart = currWin.state.hSpan[0];
          const origEnd = currWin.state.hSpan[1];
          newSpans[i][1] = Math.min(...touchBoundaries);
          const shift = origEnd - newSpans[i][1];

          if (shift > 0) {
            let limit = 0;
            for (const other of sortedWins) {
              if (other.windowId === currWin.windowId) continue;
              const hasVSpanOverlap = Math.max(other.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(other.state.vSpan[1], currWin.state.vSpan[1]);
              if (other.state.hSpan[1] <= origStart && hasVSpanOverlap) {
                if (other.state.hSpan[1] > limit) {
                  limit = other.state.hSpan[1];
                }
              }
            }
            const freeSpace = origStart - limit;
            const allowedShift = Math.max(0, Math.min(shift, freeSpace));
            newSpans[i][0] = origStart - allowedShift;
          } else if (shift < 0) {
            const hasLeftAnchor = sortedWins.some(other => {
              if (other.windowId === currWin.windowId) return false;
              const hasVSpanOverlap = Math.max(other.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(other.state.vSpan[1], currWin.state.vSpan[1]);
              return other.state.hSpan[1] === origStart && hasVSpanOverlap;
            });
            const isAnchored = origStart === 0 || hasLeftAnchor;
            newSpans[i][0] = isAnchored ? origStart : origStart - shift;
          }

          const width = newSpans[i][1] - newSpans[i][0];
          if (width < MIN_WIDTH) {
            newSpans[i][0] = newSpans[i][1] - MIN_WIDTH;
            if (newSpans[i][0] < 0) {
              newSpans[i][0] = 0;
              newSpans[i][1] = MIN_WIDTH;
            }
          }
        }
      }

      // Заполняем результат
      for (let i = 0; i < N; i++) {
        const w = sortedWins[i];
        if (w.windowId === activeId) {
          nextActiveState.hSpan = newSpans[i];
          nextActiveState.hIndex = spanToHIndex(newSpans[i]);
        } else {
          const nextState: WindowState = {
            ...w.state,
            hSpan: newSpans[i],
            hIndex: spanToHIndex(newSpans[i]),
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

      const MIN_HEIGHT = config.minSpan;

      // Распространяем вниз
      for (let i = k + 1; i < N; i++) {
        const currWin = sortedWins[i];
        const currOriginalStart = currWin.state.vSpan[0];

        const touchBoundaries: number[] = [];
        for (let j = 0; j < i; j++) {
          const prevWin = sortedWins[j];
          const hasHSpanOverlap = Math.max(prevWin.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(prevWin.state.hSpan[1], currWin.state.hSpan[1]);
          const touching = prevWin.state.vSpan[1] === currOriginalStart && hasHSpanOverlap;
          if (touching) {
            touchBoundaries.push(newSpans[j][1]);
          }
        }

        if (touchBoundaries.length > 0) {
          const origStart = currWin.state.vSpan[0];
          const origEnd = currWin.state.vSpan[1];
          newSpans[i][0] = Math.max(...touchBoundaries);
          const shift = newSpans[i][0] - origStart;

          if (shift > 0) {
            let limit = config.gridSize;
            for (const other of sortedWins) {
              if (other.windowId === currWin.windowId) continue;
              const hasHSpanOverlap = Math.max(other.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(other.state.hSpan[1], currWin.state.hSpan[1]);
              if (other.state.vSpan[0] >= origEnd && hasHSpanOverlap) {
                if (other.state.vSpan[0] < limit) {
                  limit = other.state.vSpan[0];
                }
              }
            }
            const freeSpace = limit - origEnd;
            const allowedShift = Math.max(0, Math.min(shift, freeSpace));
            newSpans[i][1] = origEnd + allowedShift;
          } else if (shift < 0) {
            const hasBottomAnchor = sortedWins.some(other => {
              if (other.windowId === currWin.windowId) return false;
              const hasHSpanOverlap = Math.max(other.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(other.state.hSpan[1], currWin.state.hSpan[1]);
              return other.state.vSpan[0] === origEnd && hasHSpanOverlap;
            });
            const isAnchored = origEnd === config.gridSize || hasBottomAnchor;
            newSpans[i][1] = isAnchored ? origEnd : origEnd + shift;
          }

          const height = newSpans[i][1] - newSpans[i][0];
          if (height < MIN_HEIGHT) {
            newSpans[i][1] = newSpans[i][0] + MIN_HEIGHT;
            if (newSpans[i][1] > config.gridSize) {
              newSpans[i][1] = config.gridSize;
              newSpans[i][0] = config.gridSize - MIN_HEIGHT;
            }
          }
        }
      }

      // Распространяем вверх
      for (let i = k - 1; i >= 0; i--) {
        const currWin = sortedWins[i];
        const currOriginalEnd = currWin.state.vSpan[1];

        const touchBoundaries: number[] = [];
        for (let j = i + 1; j < N; j++) {
          const nextWin = sortedWins[j];
          const hasHSpanOverlap = Math.max(nextWin.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(nextWin.state.hSpan[1], currWin.state.hSpan[1]);
          const touching = nextWin.state.vSpan[0] === currOriginalEnd && hasHSpanOverlap;
          if (touching) {
            touchBoundaries.push(newSpans[j][0]);
          }
        }

        if (touchBoundaries.length > 0) {
          const origStart = currWin.state.vSpan[0];
          const origEnd = currWin.state.vSpan[1];
          newSpans[i][1] = Math.min(...touchBoundaries);
          const shift = origEnd - newSpans[i][1];

          if (shift > 0) {
            let limit = 0;
            for (const other of sortedWins) {
              if (other.windowId === currWin.windowId) continue;
              const hasHSpanOverlap = Math.max(other.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(other.state.hSpan[1], currWin.state.hSpan[1]);
              if (other.state.vSpan[1] <= origStart && hasHSpanOverlap) {
                if (other.state.vSpan[1] > limit) {
                  limit = other.state.vSpan[1];
                }
              }
            }
            const freeSpace = origStart - limit;
            const allowedShift = Math.max(0, Math.min(shift, freeSpace));
            newSpans[i][0] = origStart - allowedShift;
          } else if (shift < 0) {
            const hasTopAnchor = sortedWins.some(other => {
              if (other.windowId === currWin.windowId) return false;
              const hasHSpanOverlap = Math.max(other.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(other.state.hSpan[1], currWin.state.hSpan[1]);
              return other.state.vSpan[1] === origStart && hasHSpanOverlap;
            });
            const isAnchored = origStart === 0 || hasTopAnchor;
            newSpans[i][0] = isAnchored ? origStart : origStart - shift;
          }

          const height = newSpans[i][1] - newSpans[i][0];
          if (height < MIN_HEIGHT) {
            newSpans[i][0] = newSpans[i][1] - MIN_HEIGHT;
            if (newSpans[i][0] < 0) {
              newSpans[i][0] = 0;
              newSpans[i][1] = MIN_HEIGHT;
            }
          }
        }
      }

      // Заполняем результат
      for (let i = 0; i < N; i++) {
        const w = sortedWins[i];
        if (w.windowId === activeId) {
          nextActiveState.vSpan = newSpans[i];
          nextActiveState.vIndex = spanToVIndex(newSpans[i]);
        } else {
          const nextState: WindowState = {
            ...w.state,
            vSpan: newSpans[i],
            vIndex: spanToVIndex(newSpans[i]),
            lastDirection: direction
          };
          result[w.windowId] = nextState;
        }
      }
    }

    return result;
  }
}
