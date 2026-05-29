"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeometryConverter = void 0;
const GridSpans_1 = require("./GridSpans");
class GeometryConverter {
    /**
     * Преобразует физическую геометрию окна в логические колонки (hSpan) на указанном мониторе
     */
    static geometryToHSpan(geom, monitor) {
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
    static geometryToVSpan(geom, monitor) {
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
    static stateToGeometry(state, screen, config) {
        const { workarea } = screen;
        const gaps = config.gaps || 0;
        const hSpan = state.hSpan || GridSpans_1.HORIZONTAL_SPANS[state.hIndex] || GridSpans_1.HORIZONTAL_SPANS[5];
        const vSpan = state.vSpan || GridSpans_1.VERTICAL_SPANS[state.vIndex] || GridSpans_1.VERTICAL_SPANS[3];
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
exports.GeometryConverter = GeometryConverter;
