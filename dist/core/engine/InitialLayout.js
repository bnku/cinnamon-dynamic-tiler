"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialLayout = void 0;
class InitialLayout {
    /**
     * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialHSpan(direction, siblingSpans, fixedVSpan = [0, 12]) {
        if (direction === 'shift-left')
            return [0, 6];
        if (direction === 'shift-right')
            return [6, 12];
        const spans = this.getInitialSpans(direction, siblingSpans, { fixedVSpan });
        return spans.hSpan;
    }
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction, siblingSpans, fixedHSpan = [0, 12]) {
        const spans = this.getInitialSpans(direction, siblingSpans, { fixedHSpan });
        return spans.vSpan;
    }
    /**
     * Находит наиболее подходящий двумерный макет для первого тайлинга
     */
    static getInitialSpans(direction, siblingSpans, options = {}) {
        const occupied = Array.from({ length: 12 }, () => new Array(12).fill(false));
        for (const sibling of siblingSpans) {
            const [hStart, hEnd] = sibling.hSpan;
            const [vStart, vEnd] = sibling.vSpan;
            for (let r = vStart; r < vEnd; r++) {
                for (let c = hStart; c < hEnd; c++) {
                    if (r >= 0 && r < 12 && c >= 0 && c < 12) {
                        occupied[r][c] = true;
                    }
                }
            }
        }
        if (direction === 'shift-left') {
            return { hSpan: [0, 6], vSpan: options.fixedVSpan || [0, 12] };
        }
        if (direction === 'shift-right') {
            return { hSpan: [6, 12], vSpan: options.fixedVSpan || [0, 12] };
        }
        if (direction === 'left') {
            let bestHSpan = [0, 6];
            let bestVSpan = options.fixedVSpan || [0, 12];
            for (let hStart = 0; hStart <= 10; hStart++) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const vIntervals = options.fixedVSpan
                    ? [options.fixedVSpan]
                    : [];
                if (!options.fixedVSpan) {
                    for (let vStart = 0; vStart <= 10; vStart += 2) {
                        for (let vEnd = vStart + 2; vEnd <= 12; vEnd += 2) {
                            vIntervals.push([vStart, vEnd]);
                        }
                    }
                }
                for (const [vStart, vEnd] of vIntervals) {
                    let w = 0;
                    while (hStart + w < 12 && w < 6) {
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
                    if (w >= 2) {
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
            let bestHSpan = [6, 12];
            let bestVSpan = options.fixedVSpan || [0, 12];
            for (let hEnd = 12; hEnd >= 2; hEnd--) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const vIntervals = options.fixedVSpan
                    ? [options.fixedVSpan]
                    : [];
                if (!options.fixedVSpan) {
                    for (let vStart = 0; vStart <= 10; vStart += 2) {
                        for (let vEnd = vStart + 2; vEnd <= 12; vEnd += 2) {
                            vIntervals.push([vStart, vEnd]);
                        }
                    }
                }
                for (const [vStart, vEnd] of vIntervals) {
                    let w = 0;
                    while (hEnd - 1 - w >= 0 && w < 6) {
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
                    if (w >= 2) {
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
            let bestHSpan = options.fixedHSpan || [0, 12];
            let bestVSpan = [0, 6];
            for (let vStart = 0; vStart <= 10; vStart++) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const hIntervals = options.fixedHSpan
                    ? [options.fixedHSpan]
                    : [];
                if (!options.fixedHSpan) {
                    for (let hStart = 0; hStart <= 10; hStart += 2) {
                        for (let hEnd = hStart + 2; hEnd <= 12; hEnd += 2) {
                            hIntervals.push([hStart, hEnd]);
                        }
                    }
                }
                for (const [hStart, hEnd] of hIntervals) {
                    let h = 0;
                    while (vStart + h < 12 && h < 6) {
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
                    if (h >= 2) {
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
            let bestHSpan = options.fixedHSpan || [0, 12];
            let bestVSpan = [6, 12];
            for (let vEnd = 12; vEnd >= 2; vEnd--) {
                let maxArea = 0;
                let localBestHSpan = null;
                let localBestVSpan = null;
                const hIntervals = options.fixedHSpan
                    ? [options.fixedHSpan]
                    : [];
                if (!options.fixedHSpan) {
                    for (let hStart = 0; hStart <= 10; hStart += 2) {
                        for (let hEnd = hStart + 2; hEnd <= 12; hEnd += 2) {
                            hIntervals.push([hStart, hEnd]);
                        }
                    }
                }
                for (const [hStart, hEnd] of hIntervals) {
                    let h = 0;
                    while (vEnd - 1 - h >= 0 && h < 6) {
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
                    if (h >= 2) {
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
        return { hSpan: [0, 12], vSpan: [0, 12] };
    }
}
exports.InitialLayout = InitialLayout;
