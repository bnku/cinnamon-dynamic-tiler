"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainTransitions = void 0;
const GridSpans_1 = require("./GridSpans");
class ChainTransitions {
    /**
     * Рассчитывает новые состояния для всей цепочки соприкасающихся окон на основе направления
     */
    static calculateChainTransitions(activeId, direction, config, activeWindows, allVisibleSpans = [], calculateNextStateFn, getDefaultStateFn) {
        const result = {};
        // 1. Находим активное окно в списке
        const activeWin = activeWindows.find(w => w.windowId === activeId);
        if (!activeWin) {
            const siblingSpans = allVisibleSpans.length > 0
                ? allVisibleSpans
                : activeWindows.map(w => ({
                    hSpan: w.state.hSpan || GridSpans_1.HORIZONTAL_SPANS[w.state.hIndex] || [0, config.gridSize],
                    vSpan: w.state.vSpan || GridSpans_1.VERTICAL_SPANS[w.state.vIndex] || [0, config.gridSize]
                }));
            const defaultState = getDefaultStateFn();
            const nextActiveState = calculateNextStateFn(defaultState, direction, config, siblingSpans);
            result[activeId] = nextActiveState;
            return result;
        }
        // Инициализируем hSpan/vSpan в активном окне, если их нет
        const currentActiveState = { ...activeWin.state };
        if (!currentActiveState.hSpan) {
            currentActiveState.hSpan = GridSpans_1.HORIZONTAL_SPANS[currentActiveState.hIndex] || [0, config.gridSize];
        }
        if (!currentActiveState.vSpan) {
            currentActiveState.vSpan = GridSpans_1.VERTICAL_SPANS[currentActiveState.vIndex] || [0, config.gridSize];
        }
        // Сиблинги для проверки упора активного окна
        const siblings = activeWindows
            .filter(w => w.windowId !== activeId)
            .map(w => ({
            hSpan: w.state.hSpan || GridSpans_1.HORIZONTAL_SPANS[w.state.hIndex] || [0, config.gridSize],
            vSpan: w.state.vSpan || GridSpans_1.VERTICAL_SPANS[w.state.vIndex] || [0, config.gridSize]
        }));
        // 2. Рассчитываем одиночный шаг для активного окна (с передачей соседей для выявления тупиков)
        const nextActiveState = calculateNextStateFn(currentActiveState, direction, config, siblings);
        result[activeId] = nextActiveState;
        // Если это сдвиг Shift, цепочка ресайза не срабатывает, просто сдвигаем окно
        if (direction === 'shift-left' || direction === 'shift-right') {
            return result;
        }
        // Приводим все остальные окна в списке к корректным hSpan/vSpan
        const normalizedWindows = activeWindows.map(w => {
            const state = { ...w.state };
            if (!state.hSpan) {
                state.hSpan = GridSpans_1.HORIZONTAL_SPANS[state.hIndex] || [0, config.gridSize];
            }
            if (!state.vSpan) {
                state.vSpan = GridSpans_1.VERTICAL_SPANS[state.vIndex] || [0, config.gridSize];
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
            const newSpans = sortedWins.map(w => {
                return w.windowId === activeId ? [...nextActiveState.hSpan] : [...w.state.hSpan];
            });
            const MIN_WIDTH = config.minSpan;
            // Распространяем вправо
            for (let i = k + 1; i < N; i++) {
                const prevOriginalEnd = sortedWins[i - 1].state.hSpan[1];
                const currOriginalStart = sortedWins[i].state.hSpan[0];
                const prevWin = sortedWins[i - 1];
                const currWin = sortedWins[i];
                const hasVSpanOverlap = Math.max(prevWin.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(prevWin.state.vSpan[1], currWin.state.vSpan[1]);
                const wasTouching = Math.abs(currOriginalStart - prevOriginalEnd) === 0 && hasVSpanOverlap;
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
                            const overlap = Math.max(sortedWins[R].state.vSpan[0], sortedWins[R + 1].state.vSpan[0]) <
                                Math.min(sortedWins[R].state.vSpan[1], sortedWins[R + 1].state.vSpan[1]);
                            if (Math.abs(nextStart - currEnd) === 0 && overlap) {
                                R++;
                            }
                            else {
                                break;
                            }
                        }
                        const chainEnd = sortedWins[R].state.hSpan[1];
                        const limitRight = (R + 1 < N) ? sortedWins[R + 1].state.hSpan[0] : config.gridSize;
                        const freeSpaceRight = limitRight - chainEnd;
                        const allowedShift = Math.min(shift, freeSpaceRight);
                        newSpans[i][1] = origEnd + allowedShift;
                    }
                    const width = newSpans[i][1] - newSpans[i][0];
                    if (width < MIN_WIDTH) {
                        newSpans[i][1] = newSpans[i][0] + MIN_WIDTH;
                        if (newSpans[i][1] > config.gridSize) {
                            newSpans[i][1] = config.gridSize;
                            newSpans[i][0] = config.gridSize - MIN_WIDTH; // наложение
                        }
                    }
                }
            }
            // Распространяем влево
            for (let i = k - 1; i >= 0; i--) {
                const nextOriginalStart = sortedWins[i + 1].state.hSpan[0];
                const currOriginalEnd = sortedWins[i].state.hSpan[1];
                const nextWin = sortedWins[i + 1];
                const currWin = sortedWins[i];
                const hasVSpanOverlap = Math.max(nextWin.state.vSpan[0], currWin.state.vSpan[0]) < Math.min(nextWin.state.vSpan[1], currWin.state.vSpan[1]);
                const wasTouching = Math.abs(nextOriginalStart - currOriginalEnd) === 0 && hasVSpanOverlap;
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
                            const overlap = Math.max(sortedWins[L].state.vSpan[0], sortedWins[L - 1].state.vSpan[0]) <
                                Math.min(sortedWins[L].state.vSpan[1], sortedWins[L - 1].state.vSpan[1]);
                            if (Math.abs(currStart - prevEnd) === 0 && overlap) {
                                L--;
                            }
                            else {
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
                            newSpans[i][1] = MIN_WIDTH; // наложение
                        }
                    }
                }
            }
            // Заполняем результат
            for (let i = 0; i < N; i++) {
                const w = sortedWins[i];
                if (w.windowId === activeId) {
                    nextActiveState.hSpan = newSpans[i];
                    nextActiveState.hIndex = (0, GridSpans_1.spanToHIndex)(newSpans[i]);
                }
                else {
                    const nextState = {
                        ...w.state,
                        hSpan: newSpans[i],
                        hIndex: (0, GridSpans_1.spanToHIndex)(newSpans[i]),
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
            const newSpans = sortedWins.map(w => {
                return w.windowId === activeId ? [...nextActiveState.vSpan] : [...w.state.vSpan];
            });
            const MIN_HEIGHT = config.minSpan;
            // Распространяем вниз
            for (let i = k + 1; i < N; i++) {
                const prevOriginalEnd = sortedWins[i - 1].state.vSpan[1];
                const currOriginalStart = sortedWins[i].state.vSpan[0];
                const prevWin = sortedWins[i - 1];
                const currWin = sortedWins[i];
                const hasHSpanOverlap = Math.max(prevWin.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(prevWin.state.hSpan[1], currWin.state.hSpan[1]);
                const wasTouching = Math.abs(currOriginalStart - prevOriginalEnd) === 0 && hasHSpanOverlap;
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
                            const overlap = Math.max(sortedWins[R].state.hSpan[0], sortedWins[R + 1].state.hSpan[0]) <
                                Math.min(sortedWins[R].state.hSpan[1], sortedWins[R + 1].state.hSpan[1]);
                            if (Math.abs(nextStart - currEnd) === 0 && overlap) {
                                R++;
                            }
                            else {
                                break;
                            }
                        }
                        const chainEnd = sortedWins[R].state.vSpan[1];
                        const limitBottom = (R + 1 < N) ? sortedWins[R + 1].state.vSpan[0] : config.gridSize;
                        const freeSpaceBottom = limitBottom - chainEnd;
                        const allowedShift = Math.min(shift, freeSpaceBottom);
                        newSpans[i][1] = origEnd + allowedShift;
                    }
                    const height = newSpans[i][1] - newSpans[i][0];
                    if (height < MIN_HEIGHT) {
                        newSpans[i][1] = newSpans[i][0] + MIN_HEIGHT;
                        if (newSpans[i][1] > config.gridSize) {
                            newSpans[i][1] = config.gridSize;
                            newSpans[i][0] = config.gridSize - MIN_HEIGHT; // наложение
                        }
                    }
                }
            }
            // Распространяем вверх
            for (let i = k - 1; i >= 0; i--) {
                const nextOriginalStart = sortedWins[i + 1].state.vSpan[0];
                const currOriginalEnd = sortedWins[i].state.vSpan[1];
                const nextWin = sortedWins[i + 1];
                const currWin = sortedWins[i];
                const hasHSpanOverlap = Math.max(nextWin.state.hSpan[0], currWin.state.hSpan[0]) < Math.min(nextWin.state.hSpan[1], currWin.state.hSpan[1]);
                const wasTouching = Math.abs(nextOriginalStart - currOriginalEnd) === 0 && hasHSpanOverlap;
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
                            const overlap = Math.max(sortedWins[L].state.hSpan[0], sortedWins[L - 1].state.hSpan[0]) <
                                Math.min(sortedWins[L].state.hSpan[1], sortedWins[L - 1].state.hSpan[1]);
                            if (Math.abs(currStart - prevEnd) === 0 && overlap) {
                                L--;
                            }
                            else {
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
                            newSpans[i][1] = MIN_HEIGHT; // наложение
                        }
                    }
                }
            }
            // Заполняем результат
            for (let i = 0; i < N; i++) {
                const w = sortedWins[i];
                if (w.windowId === activeId) {
                    nextActiveState.vSpan = newSpans[i];
                    nextActiveState.vIndex = (0, GridSpans_1.spanToVIndex)(newSpans[i]);
                }
                else {
                    const nextState = {
                        ...w.state,
                        vSpan: newSpans[i],
                        vIndex: (0, GridSpans_1.spanToVIndex)(newSpans[i]),
                        lastDirection: direction
                    };
                    result[w.windowId] = nextState;
                }
            }
        }
        return result;
    }
}
exports.ChainTransitions = ChainTransitions;
