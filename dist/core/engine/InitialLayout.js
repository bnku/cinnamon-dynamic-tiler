"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialLayout = void 0;
const types_1 = require("../types");
class InitialLayout {
    /**
     * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialHSpan(direction, siblingSpans, config, fixedVSpan) {
        const gridColumns = (0, types_1.getGridColumns)(config);
        const halfColumns = Math.round(gridColumns / 2);
        if (direction === 'shift-left')
            return [0, halfColumns];
        if (direction === 'shift-right')
            return [halfColumns, gridColumns];
        const spans = this.getInitialSpans(direction, siblingSpans, config, {
            fixedVSpan: fixedVSpan || [0, (0, types_1.getGridRows)(config)]
        });
        return spans.hSpan;
    }
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction, siblingSpans, config, fixedHSpan) {
        const gridRows = (0, types_1.getGridRows)(config);
        const halfRows = Math.round(gridRows / 2);
        if (direction === 'shift-up')
            return [0, halfRows];
        if (direction === 'shift-down')
            return [halfRows, gridRows];
        const spans = this.getInitialSpans(direction, siblingSpans, config, {
            fixedHSpan: fixedHSpan || [0, (0, types_1.getGridColumns)(config)]
        });
        return spans.vSpan;
    }
    /**
     * Находит наиболее подходящий двумерный макет для первого тайлинга
     */
    static getInitialSpans(direction, siblingSpans, config, options = {}) {
        const gridColumns = (0, types_1.getGridColumns)(config);
        const gridRows = (0, types_1.getGridRows)(config);
        const minColumnSpan = (0, types_1.getMinColumnSpan)(config);
        const minRowSpan = (0, types_1.getMinRowSpan)(config);
        const halfColumns = Math.round(gridColumns / 2);
        const halfRows = Math.round(gridRows / 2);
        const occupied = Array.from({ length: gridRows }, () => new Array(gridColumns).fill(false));
        for (const sibling of siblingSpans) {
            const [hStart, hEnd] = sibling.hSpan;
            const [vStart, vEnd] = sibling.vSpan;
            for (let r = vStart; r < vEnd; r++) {
                for (let c = hStart; c < hEnd; c++) {
                    if (r >= 0 && r < gridRows && c >= 0 && c < gridColumns) {
                        occupied[r][c] = true;
                    }
                }
            }
        }
        if (direction === 'shift-left') {
            return { hSpan: [0, halfColumns], vSpan: options.fixedVSpan || [0, gridRows] };
        }
        if (direction === 'shift-right') {
            return { hSpan: [halfColumns, gridColumns], vSpan: options.fixedVSpan || [0, gridRows] };
        }
        if (direction === 'shift-up') {
            return { hSpan: options.fixedHSpan || [0, gridColumns], vSpan: [0, halfRows] };
        }
        if (direction === 'shift-down') {
            return { hSpan: options.fixedHSpan || [0, gridColumns], vSpan: [halfRows, gridRows] };
        }
        if (direction === 'left') {
            let bestHSpan = [0, halfColumns];
            let bestVSpan = options.fixedVSpan || [0, gridRows];
            for (let hStart = 0; hStart <= gridColumns - minColumnSpan; hStart++) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const vIntervals = options.fixedVSpan
                    ? [options.fixedVSpan]
                    : [];
                if (!options.fixedVSpan) {
                    for (let vStart = 0; vStart <= gridRows - minRowSpan; vStart += config.step) {
                        for (let vEnd = vStart + minRowSpan; vEnd <= gridRows; vEnd += config.step) {
                            vIntervals.push([vStart, vEnd]);
                        }
                        if ((gridRows - vStart) >= minRowSpan && (gridRows - vStart) % config.step !== 0) {
                            vIntervals.push([vStart, gridRows]);
                        }
                    }
                }
                for (const [vStart, vEnd] of vIntervals) {
                    let w = 0;
                    while (hStart + w < gridColumns && w < halfColumns) {
                        let colFree = true;
                        for (let r = vStart; r < vEnd; r++) {
                            if (occupied[r][hStart + w]) {
                                colFree = false;
                                break;
                            }
                        }
                        if (colFree) {
                            w++;
                        }
                        else {
                            break;
                        }
                    }
                    if (w >= minColumnSpan) {
                        const area = w * (vEnd - vStart);
                        if (area > maxArea || (area === maxArea && w > (localBestHSpan ? (localBestHSpan[1] - localBestHSpan[0]) : 0))) {
                            maxArea = area;
                            localBestHSpan = [hStart, hStart + w];
                            localBestVSpan = [vStart, vEnd];
                        }
                    }
                }
                if (localBestHSpan && localBestVSpan) {
                    bestHSpan = localBestHSpan;
                    bestVSpan = localBestVSpan;
                    break;
                }
            }
            return { hSpan: bestHSpan, vSpan: bestVSpan };
        }
        if (direction === 'right') {
            let bestHSpan = [halfColumns, gridColumns];
            let bestVSpan = options.fixedVSpan || [0, gridRows];
            for (let hEnd = gridColumns; hEnd >= minColumnSpan; hEnd--) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const vIntervals = options.fixedVSpan
                    ? [options.fixedVSpan]
                    : [];
                if (!options.fixedVSpan) {
                    for (let vStart = 0; vStart <= gridRows - minRowSpan; vStart += config.step) {
                        for (let vEnd = vStart + minRowSpan; vEnd <= gridRows; vEnd += config.step) {
                            vIntervals.push([vStart, vEnd]);
                        }
                        if ((gridRows - vStart) >= minRowSpan && (gridRows - vStart) % config.step !== 0) {
                            vIntervals.push([vStart, gridRows]);
                        }
                    }
                }
                for (const [vStart, vEnd] of vIntervals) {
                    let w = 0;
                    while (hEnd - 1 - w >= 0 && w < halfColumns) {
                        let colFree = true;
                        for (let r = vStart; r < vEnd; r++) {
                            if (occupied[r][hEnd - 1 - w]) {
                                colFree = false;
                                break;
                            }
                        }
                        if (colFree) {
                            w++;
                        }
                        else {
                            break;
                        }
                    }
                    if (w >= minColumnSpan) {
                        const area = w * (vEnd - vStart);
                        if (area > maxArea || (area === maxArea && w > (localBestHSpan ? (localBestHSpan[1] - localBestHSpan[0]) : 0))) {
                            maxArea = area;
                            localBestHSpan = [hEnd - w, hEnd];
                            localBestVSpan = [vStart, vEnd];
                        }
                    }
                }
                if (localBestHSpan && localBestVSpan) {
                    bestHSpan = localBestHSpan;
                    bestVSpan = localBestVSpan;
                    break;
                }
            }
            return { hSpan: bestHSpan, vSpan: bestVSpan };
        }
        if (direction === 'up') {
            let bestHSpan = options.fixedHSpan || [0, gridColumns];
            let bestVSpan = [0, halfRows];
            for (let vStart = 0; vStart <= gridRows - minRowSpan; vStart++) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const hIntervals = options.fixedHSpan
                    ? [options.fixedHSpan]
                    : [];
                if (!options.fixedHSpan) {
                    for (let hStart = 0; hStart <= gridColumns - minColumnSpan; hStart += config.step) {
                        for (let hEnd = hStart + minColumnSpan; hEnd <= gridColumns; hEnd += config.step) {
                            hIntervals.push([hStart, hEnd]);
                        }
                        if ((gridColumns - hStart) >= minColumnSpan && (gridColumns - hStart) % config.step !== 0) {
                            hIntervals.push([hStart, gridColumns]);
                        }
                    }
                }
                for (const [hStart, hEnd] of hIntervals) {
                    let h = 0;
                    while (vStart + h < gridRows && h < halfRows) {
                        let rowFree = true;
                        for (let c = hStart; c < hEnd; c++) {
                            if (occupied[vStart + h][c]) {
                                rowFree = false;
                                break;
                            }
                        }
                        if (rowFree) {
                            h++;
                        }
                        else {
                            break;
                        }
                    }
                    if (h >= minRowSpan) {
                        const area = h * (hEnd - hStart);
                        if (area > maxArea || (area === maxArea && h > (localBestVSpan ? (localBestVSpan[1] - localBestVSpan[0]) : 0))) {
                            maxArea = area;
                            localBestHSpan = [hStart, hEnd];
                            localBestVSpan = [vStart, vStart + h];
                        }
                    }
                }
                if (localBestHSpan && localBestVSpan) {
                    bestHSpan = localBestHSpan;
                    bestVSpan = localBestVSpan;
                    break;
                }
            }
            return { hSpan: bestHSpan, vSpan: bestVSpan };
        }
        if (direction === 'down') {
            let bestHSpan = options.fixedHSpan || [0, gridColumns];
            let bestVSpan = [halfRows, gridRows];
            for (let vEnd = gridRows; vEnd >= minRowSpan; vEnd--) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const hIntervals = options.fixedHSpan
                    ? [options.fixedHSpan]
                    : [];
                if (!options.fixedHSpan) {
                    for (let hStart = 0; hStart <= gridColumns - minColumnSpan; hStart += config.step) {
                        for (let hEnd = hStart + minColumnSpan; hEnd <= gridColumns; hEnd += config.step) {
                            hIntervals.push([hStart, hEnd]);
                        }
                        if ((gridColumns - hStart) >= minColumnSpan && (gridColumns - hStart) % config.step !== 0) {
                            hIntervals.push([hStart, gridColumns]);
                        }
                    }
                }
                for (const [hStart, hEnd] of hIntervals) {
                    let h = 0;
                    while (vEnd - 1 - h >= 0 && h < halfRows) {
                        let rowFree = true;
                        for (let c = hStart; c < hEnd; c++) {
                            if (occupied[vEnd - 1 - h][c]) {
                                rowFree = false;
                                break;
                            }
                        }
                        if (rowFree) {
                            h++;
                        }
                        else {
                            break;
                        }
                    }
                    if (h >= minRowSpan) {
                        const area = h * (hEnd - hStart);
                        if (area > maxArea || (area === maxArea && h > (localBestVSpan ? (localBestVSpan[1] - localBestVSpan[0]) : 0))) {
                            maxArea = area;
                            localBestHSpan = [hStart, hEnd];
                            localBestVSpan = [vEnd - h, vEnd];
                        }
                    }
                }
                if (localBestHSpan && localBestVSpan) {
                    bestHSpan = localBestHSpan;
                    bestVSpan = localBestVSpan;
                    break;
                }
            }
            return { hSpan: bestHSpan, vSpan: bestVSpan };
        }
        return { hSpan: [0, gridColumns], vSpan: [0, gridRows] };
    }
}
exports.InitialLayout = InitialLayout;
