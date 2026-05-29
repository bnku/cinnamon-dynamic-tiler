"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialLayout = void 0;
class InitialLayout {
    /**
     * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialHSpan(direction, siblingSpans) {
        const occupied = new Array(12).fill(false);
        for (const sibling of siblingSpans) {
            const [start, end] = sibling.hSpan;
            for (let c = start; c < end; c++) {
                if (c >= 0 && c < 12) {
                    occupied[c] = true;
                }
            }
        }
        if (direction === 'shift-left')
            return [0, 6];
        if (direction === 'shift-right')
            return [6, 12];
        if (direction === 'left') {
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
                const width = (end - start) > 6 ? 6 : (end - start);
                return [start, start + width];
            }
            return [0, 6];
        }
        if (direction === 'right') {
            if (!occupied[11]) {
                let start = 12;
                while (start > 0 && !occupied[start - 1]) {
                    start--;
                }
                const width = (12 - start) > 6 ? 6 : (12 - start);
                return [12 - width, 12];
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
    static getInitialVSpan(direction, siblingSpans) {
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
}
exports.InitialLayout = InitialLayout;
