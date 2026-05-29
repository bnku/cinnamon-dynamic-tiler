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
    static getInitialHSpan(direction, siblingSpans, fixedVSpan) {
        return InitialLayout_1.InitialLayout.getInitialHSpan(direction, siblingSpans, fixedVSpan);
    }
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction, siblingSpans, fixedHSpan) {
        return InitialLayout_1.InitialLayout.getInitialVSpan(direction, siblingSpans, fixedHSpan);
    }
    /**
     * Рассчитывает следующее состояние окна на основе текущего состояния, направления и конфигурации
     */
    static calculateNextState(currentState, direction, config, siblingSpans = []) {
        const nextState = { ...currentState };
        // Если hSpan/vSpan не инициализированы, берем их на основе индексов
        if (!nextState.hSpan) {
            nextState.hSpan = GridSpans_1.HORIZONTAL_SPANS[nextState.hIndex] || GridSpans_1.HORIZONTAL_SPANS[5];
        }
        if (!nextState.vSpan) {
            nextState.vSpan = GridSpans_1.VERTICAL_SPANS[nextState.vIndex] || GridSpans_1.VERTICAL_SPANS[5];
        }
        if (currentState.lastDirection === null) {
            // Первый тайлинг окна
            switch (direction) {
                case 'left': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('left', siblingSpans);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.hSpan[0] > 0 ? 'right' : 'left';
                    break;
                }
                case 'right': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('right', siblingSpans);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.hSpan[1] < 12 ? 'left' : 'right';
                    break;
                }
                case 'up': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('up', siblingSpans);
                    nextState.hSpan = spans.hSpan;
                    nextState.vSpan = spans.vSpan;
                    nextState.hIndex = this.spanToHIndex(nextState.hSpan);
                    nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                    nextState.lastDirection = nextState.vSpan[0] > 0 ? 'down' : 'up';
                    break;
                }
                case 'down': {
                    const spans = InitialLayout_1.InitialLayout.getInitialSpans('down', siblingSpans);
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
        }
        else {
            // Проверка на смену оси (Corner Mode)
            const isHorizontalOld = currentState.lastDirection === 'left' || currentState.lastDirection === 'right' || currentState.lastDirection === 'shift-left' || currentState.lastDirection === 'shift-right';
            const isVerticalOld = currentState.lastDirection === 'up' || currentState.lastDirection === 'down';
            const isHorizontalNew = direction === 'left' || direction === 'right' || direction === 'shift-left' || direction === 'shift-right';
            const isVerticalNew = direction === 'up' || direction === 'down';
            if (isHorizontalOld && isVerticalNew) {
                nextState.hSpan = currentState.hSpan;
                nextState.hIndex = currentState.hIndex;
                nextState.vSpan = this.getInitialVSpan(direction, siblingSpans, currentState.hSpan);
                nextState.vIndex = this.spanToVIndex(nextState.vSpan);
                nextState.lastDirection = direction;
                return nextState;
            }
            if (isVerticalOld && isHorizontalNew) {
                nextState.vSpan = currentState.vSpan;
                nextState.vIndex = currentState.vIndex;
                nextState.hSpan = this.getInitialHSpan(direction, siblingSpans, currentState.vSpan);
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
                    }
                    else {
                        newEnd = Math.max(2, end - 2);
                    }
                    const targetSpan = [newStart, newEnd];
                    const leftCollision = targetSpan[0] < currentState.hSpan[0] && ChainBlockDetector_1.ChainBlockDetector.isLeftChainBlocked(currentState.hSpan[0], siblingSpans);
                    if (leftCollision) {
                        const currentStart = currentState.hSpan[0];
                        const currentEnd = currentState.hSpan[1];
                        const currentWidth = currentEnd - currentStart;
                        let nextWidth = currentWidth > 6 ? 6 : 2;
                        if (currentWidth <= 2)
                            nextWidth = 2;
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
                    if (end < 12) {
                        newEnd = Math.min(12, end + 2);
                    }
                    else {
                        newStart = Math.min(10, start + 2);
                    }
                    const targetSpan = [newStart, newEnd];
                    const rightCollision = targetSpan[1] > currentState.hSpan[1] && ChainBlockDetector_1.ChainBlockDetector.isRightChainBlocked(currentState.hSpan[1], siblingSpans);
                    if (rightCollision) {
                        const currentStart = currentState.hSpan[0];
                        const currentEnd = currentState.hSpan[1];
                        const currentWidth = currentEnd - currentStart;
                        let nextWidth = currentWidth > 6 ? 6 : 2;
                        if (currentWidth <= 2)
                            nextWidth = 2;
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
                        newStart = Math.max(0, start - 2);
                    }
                    else {
                        newEnd = Math.max(2, end - 2);
                    }
                    const targetSpan = [newStart, newEnd];
                    const topCollision = targetSpan[0] < currentState.vSpan[0] && ChainBlockDetector_1.ChainBlockDetector.isTopChainBlocked(currentState.vSpan[0], siblingSpans);
                    if (topCollision) {
                        const currentStart = currentState.vSpan[0];
                        const currentEnd = currentState.vSpan[1];
                        const currentHeight = currentEnd - currentStart;
                        let nextHeight = currentHeight > 6 ? 6 : 2;
                        if (currentHeight <= 2)
                            nextHeight = 2;
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
                    if (end < 12) {
                        newEnd = Math.min(12, end + 2);
                    }
                    else {
                        newStart = Math.min(10, start + 2);
                    }
                    const targetSpan = [newStart, newEnd];
                    const bottomCollision = targetSpan[1] > currentState.vSpan[1] && ChainBlockDetector_1.ChainBlockDetector.isBottomChainBlocked(currentState.vSpan[1], siblingSpans);
                    if (bottomCollision) {
                        const currentStart = currentState.vSpan[0];
                        const currentEnd = currentState.vSpan[1];
                        const currentHeight = currentEnd - currentStart;
                        let nextHeight = currentHeight > 6 ? 6 : 2;
                        if (currentHeight <= 2)
                            nextHeight = 2;
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
    static calculateChainTransitions(activeId, direction, config, activeWindows, allVisibleSpans = []) {
        return ChainTransitions_1.ChainTransitions.calculateChainTransitions(activeId, direction, config, activeWindows, allVisibleSpans, this.calculateNextState.bind(this), this.getDefaultState.bind(this));
    }
    static spanToHIndex(span) {
        return (0, GridSpans_1.spanToHIndex)(span);
    }
    static spanToVIndex(span) {
        return (0, GridSpans_1.spanToVIndex)(span);
    }
    static geometryToHSpan(geom, monitor) {
        return GeometryConverter_1.GeometryConverter.geometryToHSpan(geom, monitor);
    }
    static geometryToVSpan(geom, monitor) {
        return GeometryConverter_1.GeometryConverter.geometryToVSpan(geom, monitor);
    }
    static stateToGeometry(state, screen, config) {
        return GeometryConverter_1.GeometryConverter.stateToGeometry(state, screen, config);
    }
}
exports.TilingEngine = TilingEngine;
