"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TilingEngine = exports.VERTICAL_SPANS = exports.HORIZONTAL_SPANS = void 0;
const GridSpans_1 = require("./engine/GridSpans");
Object.defineProperty(exports, "HORIZONTAL_SPANS", { enumerable: true, get: function () { return GridSpans_1.HORIZONTAL_SPANS; } });
Object.defineProperty(exports, "VERTICAL_SPANS", { enumerable: true, get: function () { return GridSpans_1.VERTICAL_SPANS; } });
const GeometryConverter_1 = require("./engine/GeometryConverter");
const InitialLayout_1 = require("./engine/InitialLayout");
const ChainBlockDetector_1 = require("./engine/ChainBlockDetector");
const ChainTransitions_1 = require("./engine/ChainTransitions");
class TilingEngine {
    /**
     * Возвращает дефолтное пустое состояние окна (до тайлинга)
     */
    static getDefaultState() {
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
    static getInitialHSpan(direction, siblingSpans, config, fixedVSpan) {
        return InitialLayout_1.InitialLayout.getInitialHSpan(direction, siblingSpans, config, fixedVSpan);
    }
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction, siblingSpans, config, fixedHSpan) {
        return InitialLayout_1.InitialLayout.getInitialVSpan(direction, siblingSpans, config, fixedHSpan);
    }
    /**
     * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
     */
    static calculateNextState(currentState, direction, config, siblingSpans = []) {
        const nextState = { ...currentState };
        // Если hSpan/vSpan не инициализированы, берем их на основе индексов
        if (!nextState.hSpan) {
            nextState.hSpan = GridSpans_1.HORIZONTAL_SPANS[nextState.hIndex] || [0, config.gridSize];
        }
        if (!nextState.vSpan) {
            nextState.vSpan = GridSpans_1.VERTICAL_SPANS[nextState.vIndex] || [0, config.gridSize];
        }
        const halfGrid = Math.round(config.gridSize / 2);
        if (currentState.lastDirection === null) {
            // Первый тайлинг окна
            switch (direction) {
                case 'left': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('left', siblingSpans, config);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.hSpan[0] > 0 ? 'right' : 'left';
                    break;
                }
                case 'right': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('right', siblingSpans, config);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.hSpan[1] < config.gridSize ? 'left' : 'right';
                    break;
                }
                case 'up': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('up', siblingSpans, config);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.vSpan[0] > 0 ? 'down' : 'up';
                    break;
                }
                case 'down': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('down', siblingSpans, config);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.vSpan[1] < config.gridSize ? 'up' : 'down';
                    break;
                }
                case 'shift-left':
                    nextState.hSpan = [0, halfGrid];
                    nextState.vSpan = [0, config.gridSize];
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = 'shift-left';
                    break;
                case 'shift-right':
                    nextState.hSpan = [halfGrid, config.gridSize];
                    nextState.vSpan = [0, config.gridSize];
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = 'shift-right';
                    break;
                case 'shift-up':
                    nextState.hSpan = [0, config.gridSize];
                    nextState.vSpan = [0, halfGrid];
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = 'shift-up';
                    break;
                case 'shift-down':
                    nextState.hSpan = [0, config.gridSize];
                    nextState.vSpan = [halfGrid, config.gridSize];
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = 'shift-down';
                    break;
            }
        }
        else {
            // Проверка на смену оси (Corner Mode)
            const isHorizontalOld = currentState.lastDirection === 'left' || currentState.lastDirection === 'right' || currentState.lastDirection === 'shift-left' || currentState.lastDirection === 'shift-right';
            const isVerticalOld = currentState.lastDirection === 'up' || currentState.lastDirection === 'down' || currentState.lastDirection === 'shift-up' || currentState.lastDirection === 'shift-down';
            const isHorizontalNew = direction === 'left' || direction === 'right' || direction === 'shift-left' || direction === 'shift-right';
            const isVerticalNew = direction === 'up' || direction === 'down' || direction === 'shift-up' || direction === 'shift-down';
            // Если обе оси уже не full, Corner Mode переключается в "эластичный ресайз внутри угла"
            const isBothSpansCompressed = (currentState.hSpan[1] - currentState.hSpan[0] < config.gridSize) &&
                (currentState.vSpan[1] - currentState.vSpan[0] < config.gridSize);
            if (!isBothSpansCompressed) {
                if (isHorizontalOld && isVerticalNew) {
                    nextState.hSpan = currentState.hSpan;
                    nextState.hIndex = currentState.hIndex;
                    nextState.vSpan = this.getInitialVSpan(direction, siblingSpans, config, currentState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = direction;
                    return nextState;
                }
                if (isVerticalOld && isHorizontalNew) {
                    nextState.vSpan = currentState.vSpan;
                    nextState.vIndex = currentState.vIndex;
                    nextState.hSpan = this.getInitialHSpan(direction, siblingSpans, config, currentState.vSpan);
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
                    }
                    else {
                        newEnd = Math.max(config.minSpan, end - config.step);
                    }
                    const targetSpan = [newStart, newEnd];
                    const leftCollision = targetSpan[0] < currentState.hSpan[0] && ChainBlockDetector_1.ChainBlockDetector.isLeftChainBlocked(currentState.hSpan[0], siblingSpans, config, currentState.vSpan);
                    if (leftCollision) {
                        const currentStart = currentState.hSpan[0];
                        const currentEnd = currentState.hSpan[1];
                        const currentWidth = currentEnd - currentStart;
                        let nextWidth = currentWidth > halfGrid ? halfGrid : config.minSpan;
                        if (currentWidth <= config.minSpan)
                            nextWidth = config.minSpan;
                        nextState.hSpan = [currentStart, currentStart + nextWidth];
                    }
                    else {
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
                    if (end < config.gridSize) {
                        newEnd = Math.min(config.gridSize, end + config.step);
                    }
                    else {
                        newStart = Math.min(config.gridSize - config.minSpan, start + config.step);
                    }
                    const targetSpan = [newStart, newEnd];
                    const rightCollision = targetSpan[1] > currentState.hSpan[1] && ChainBlockDetector_1.ChainBlockDetector.isRightChainBlocked(currentState.hSpan[1], siblingSpans, config, currentState.vSpan);
                    if (rightCollision) {
                        const currentStart = currentState.hSpan[0];
                        const currentEnd = currentState.hSpan[1];
                        const currentWidth = currentEnd - currentStart;
                        let nextWidth = currentWidth > halfGrid ? halfGrid : config.minSpan;
                        if (currentWidth <= config.minSpan)
                            nextWidth = config.minSpan;
                        nextState.hSpan = [currentEnd - nextWidth, currentEnd];
                    }
                    else {
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
                    }
                    else {
                        newEnd = Math.max(config.minSpan, end - config.step);
                    }
                    const targetSpan = [newStart, newEnd];
                    const topCollision = targetSpan[0] < currentState.vSpan[0] && ChainBlockDetector_1.ChainBlockDetector.isTopChainBlocked(currentState.vSpan[0], siblingSpans, config, currentState.hSpan);
                    if (topCollision) {
                        const currentStart = currentState.vSpan[0];
                        const currentEnd = currentState.vSpan[1];
                        const currentHeight = currentEnd - currentStart;
                        let nextHeight = currentHeight > halfGrid ? halfGrid : config.minSpan;
                        if (currentHeight <= config.minSpan)
                            nextHeight = config.minSpan;
                        nextState.vSpan = [currentStart, currentStart + nextHeight];
                    }
                    else {
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
                    if (end < config.gridSize) {
                        newEnd = Math.min(config.gridSize, end + config.step);
                    }
                    else {
                        newStart = Math.min(config.gridSize - config.minSpan, start + config.step);
                    }
                    const targetSpan = [newStart, newEnd];
                    const bottomCollision = targetSpan[1] > currentState.vSpan[1] && ChainBlockDetector_1.ChainBlockDetector.isBottomChainBlocked(currentState.vSpan[1], siblingSpans, config, currentState.hSpan);
                    if (bottomCollision) {
                        const currentStart = currentState.vSpan[0];
                        const currentEnd = currentState.vSpan[1];
                        const currentHeight = currentEnd - currentStart;
                        let nextHeight = currentHeight > halfGrid ? halfGrid : config.minSpan;
                        if (currentHeight <= config.minSpan)
                            nextHeight = config.minSpan;
                        nextState.vSpan = [currentEnd - nextHeight, currentEnd];
                    }
                    else {
                        nextState.vSpan = targetSpan;
                    }
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = 'down';
                    break;
                }
                case 'shift-left':
                    nextState.hSpan = [0, halfGrid];
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.lastDirection = 'shift-left';
                    break;
                case 'shift-right':
                    nextState.hSpan = [halfGrid, config.gridSize];
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.lastDirection = 'shift-right';
                    break;
                case 'shift-up':
                    nextState.vSpan = [0, halfGrid];
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = 'shift-up';
                    break;
                case 'shift-down':
                    nextState.vSpan = [halfGrid, config.gridSize];
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
    static calculateChainTransitions(activeId, direction, config, activeWindows, allVisibleSpans = []) {
        return ChainTransitions_1.ChainTransitions.calculateChainTransitions(activeId, direction, config, activeWindows, allVisibleSpans, this.calculateNextState.bind(this), this.getDefaultState.bind(this));
    }
    static spanToHIndex(span) {
        return (0, GridSpans_1.spanToHIndex)(span);
    }
    static spanToVIndex(span) {
        return (0, GridSpans_1.spanToVIndex)(span);
    }
    static geometryToHSpan(geom, monitor, config) {
        return GeometryConverter_1.GeometryConverter.geometryToHSpan(geom, monitor, config);
    }
    static geometryToVSpan(geom, monitor, config) {
        return GeometryConverter_1.GeometryConverter.geometryToVSpan(geom, monitor, config);
    }
    static stateToGeometry(state, screen, config) {
        return GeometryConverter_1.GeometryConverter.stateToGeometry(state, screen, config);
    }
}
exports.TilingEngine = TilingEngine;
