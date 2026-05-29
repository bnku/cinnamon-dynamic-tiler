"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TilingEngine = void 0;
class TilingEngine {
    /**
     * Возвращает дефолтное пустое состояние окна (до тайлинга)
     */
    static getDefaultState() {
        return {
            widthFraction: 1,
            heightFraction: 1,
            horizontalAlign: null,
            verticalAlign: null,
            lastDirection: null,
        };
    }
    /**
     * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
     */
    static calculateNextState(currentState, direction, config) {
        const nextState = { ...currentState };
        const hFractions = config.horizontalFractions;
        const vFractions = config.verticalFractions;
        switch (direction) {
            case 'left':
                if (currentState.horizontalAlign === 'left') {
                    if (currentState.lastDirection === 'left') {
                        // Повторный клик влево: уменьшаем ширину по кругу согласно массиву в конфиге
                        nextState.widthFraction = this.cycleFraction(currentState.widthFraction, hFractions);
                    }
                    else {
                        nextState.lastDirection = 'left';
                    }
                }
                else if (currentState.horizontalAlign === 'right') {
                    // Шаг назад / расширение при противоположном движении
                    const prevIdx = hFractions.indexOf(currentState.widthFraction);
                    if (prevIdx > 0) {
                        nextState.widthFraction = hFractions[prevIdx - 1];
                    }
                    else {
                        // Было 1/2 (первое в массиве) -> перекидываем влево
                        nextState.horizontalAlign = 'left';
                        nextState.widthFraction = hFractions[0];
                    }
                    nextState.lastDirection = 'left';
                }
                else {
                    // Первый клик влево
                    nextState.horizontalAlign = 'left';
                    nextState.widthFraction = hFractions[0];
                    nextState.lastDirection = 'left';
                }
                break;
            case 'right':
                if (currentState.horizontalAlign === 'right') {
                    if (currentState.lastDirection === 'right') {
                        // Повторный клик вправо
                        nextState.widthFraction = this.cycleFraction(currentState.widthFraction, hFractions);
                    }
                    else {
                        nextState.lastDirection = 'right';
                    }
                }
                else if (currentState.horizontalAlign === 'left') {
                    // Шаг назад / расширение при противоположном движении
                    const prevIdx = hFractions.indexOf(currentState.widthFraction);
                    if (prevIdx > 0) {
                        nextState.widthFraction = hFractions[prevIdx - 1];
                    }
                    else {
                        // Было 1/2 -> перекидываем вправо
                        nextState.horizontalAlign = 'right';
                        nextState.widthFraction = hFractions[0];
                    }
                    nextState.lastDirection = 'right';
                }
                else {
                    // Первый клик вправо
                    nextState.horizontalAlign = 'right';
                    nextState.widthFraction = hFractions[0];
                    nextState.lastDirection = 'right';
                }
                break;
            case 'up':
                if (currentState.verticalAlign === 'top') {
                    if (currentState.lastDirection === 'up') {
                        // Повторный клик вверх
                        nextState.heightFraction = this.cycleFraction(currentState.heightFraction, vFractions);
                    }
                    else {
                        nextState.lastDirection = 'up';
                    }
                }
                else if (currentState.verticalAlign === 'bottom') {
                    // Шаг назад / расширение по высоте при противоположном движении
                    const prevIdx = vFractions.indexOf(currentState.heightFraction);
                    if (prevIdx > 0) {
                        nextState.heightFraction = vFractions[prevIdx - 1];
                    }
                    else {
                        // Было 1/2 -> перекидываем вверх
                        nextState.verticalAlign = 'top';
                        nextState.heightFraction = vFractions[0];
                    }
                    nextState.lastDirection = 'up';
                }
                else {
                    // Первый клик вверх
                    nextState.verticalAlign = 'top';
                    nextState.heightFraction = vFractions[0];
                    nextState.lastDirection = 'up';
                }
                break;
            case 'down':
                if (currentState.verticalAlign === 'bottom') {
                    if (currentState.lastDirection === 'down') {
                        // Повторный клик вниз
                        nextState.heightFraction = this.cycleFraction(currentState.heightFraction, vFractions);
                    }
                    else {
                        nextState.lastDirection = 'down';
                    }
                }
                else if (currentState.verticalAlign === 'top') {
                    // Шаг назад / расширение по высоте при противоположном движении
                    const prevIdx = vFractions.indexOf(currentState.heightFraction);
                    if (prevIdx > 0) {
                        nextState.heightFraction = vFractions[prevIdx - 1];
                    }
                    else {
                        // Было 1/2 -> перекидываем вниз
                        nextState.verticalAlign = 'bottom';
                        nextState.heightFraction = vFractions[0];
                    }
                    nextState.lastDirection = 'down';
                }
                else {
                    // Первый клик вниз
                    nextState.verticalAlign = 'bottom';
                    nextState.heightFraction = vFractions[0];
                    nextState.lastDirection = 'down';
                }
                break;
        }
        return nextState;
    }
    /**
     * Преобразует абстрактные доли WindowState в реальные координаты Geometry с учетом отступов (gaps)
     */
    static stateToGeometry(state, screen, config) {
        const { workarea } = screen;
        const gaps = config.gaps || 0;
        // Вычисляем целевую ширину и высоту окна
        let width = Math.round(workarea.width / state.widthFraction);
        let height = Math.round(workarea.height / state.heightFraction);
        // Вычисляем X координату
        let x = workarea.x;
        if (state.horizontalAlign === 'right') {
            x = workarea.x + workarea.width - width;
        }
        else if (state.horizontalAlign === 'center') {
            x = workarea.x + Math.round((workarea.width - width) / 2);
        }
        // Вычисляем Y координату
        let y = workarea.y;
        if (state.verticalAlign === 'bottom') {
            y = workarea.y + workarea.height - height;
        }
        else if (state.verticalAlign === 'center') {
            y = workarea.y + Math.round((workarea.height - height) / 2);
        }
        // Накладываем умные отступы (gaps), если они настроены
        if (gaps > 0) {
            x += gaps;
            y += gaps;
            width -= 2 * gaps;
            height -= 2 * gaps;
        }
        return { x, y, width, height };
    }
    /**
     * Циклический переход долей на основе массива из конфигурации
     */
    static cycleFraction(current, fractions) {
        const idx = fractions.indexOf(current);
        if (idx === -1 || idx === fractions.length - 1) {
            return fractions[0]; // Возвращаем первую долю (например, 2)
        }
        return fractions[idx + 1];
    }
}
exports.TilingEngine = TilingEngine;
