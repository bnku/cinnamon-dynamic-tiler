"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainBlockDetector = void 0;
class ChainBlockDetector {
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон слева от текущей границы
     */
    static isLeftChainBlocked(startCol, siblingSpans, config) {
        let currentStart = startCol;
        let chainLength = 0;
        let currentChainWidth = 0;
        while (true) {
            const neighbor = siblingSpans.find(s => s.hSpan[1] === currentStart);
            if (!neighbor)
                break;
            chainLength++;
            const width = neighbor.hSpan[1] - neighbor.hSpan[0];
            currentChainWidth += width;
            currentStart = neighbor.hSpan[0];
        }
        if (chainLength === 0)
            return false;
        const freeSpace = currentStart;
        const minChainWidth = chainLength * config.minSpan;
        const compressionReserve = currentChainWidth - minChainWidth;
        const movementReserve = freeSpace + compressionReserve;
        return movementReserve <= 0;
    }
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон справа от текущей границы
     */
    static isRightChainBlocked(endCol, siblingSpans, config) {
        let currentEnd = endCol;
        let chainLength = 0;
        let currentChainWidth = 0;
        while (true) {
            const neighbor = siblingSpans.find(s => s.hSpan[0] === currentEnd);
            if (!neighbor)
                break;
            chainLength++;
            const width = neighbor.hSpan[1] - neighbor.hSpan[0];
            currentChainWidth += width;
            currentEnd = neighbor.hSpan[1];
        }
        if (chainLength === 0)
            return false;
        const freeSpace = config.gridSize - currentEnd;
        const minChainWidth = chainLength * config.minSpan;
        const compressionReserve = currentChainWidth - minChainWidth;
        const movementReserve = freeSpace + compressionReserve;
        return movementReserve <= 0;
    }
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон сверху от текущей границы
     */
    static isTopChainBlocked(startRow, siblingSpans, config) {
        let currentStart = startRow;
        let chainLength = 0;
        let currentChainHeight = 0;
        while (true) {
            const neighbor = siblingSpans.find(s => s.vSpan[1] === currentStart);
            if (!neighbor)
                break;
            chainLength++;
            const height = neighbor.vSpan[1] - neighbor.vSpan[0];
            currentChainHeight += height;
            currentStart = neighbor.vSpan[0];
        }
        if (chainLength === 0)
            return false;
        const freeSpace = currentStart;
        const minChainHeight = chainLength * config.minSpan;
        const compressionReserve = currentChainHeight - minChainHeight;
        const movementReserve = freeSpace + compressionReserve;
        return movementReserve <= 0;
    }
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон снизу от текущей границы
     */
    static isBottomChainBlocked(endRow, siblingSpans, config) {
        let currentEnd = endRow;
        let chainLength = 0;
        let currentChainHeight = 0;
        while (true) {
            const neighbor = siblingSpans.find(s => s.vSpan[0] === currentEnd);
            if (!neighbor)
                break;
            chainLength++;
            const height = neighbor.vSpan[1] - neighbor.vSpan[0];
            currentChainHeight += height;
            currentEnd = neighbor.vSpan[1];
        }
        if (chainLength === 0)
            return false;
        const freeSpace = config.gridSize - currentEnd;
        const minChainHeight = chainLength * config.minSpan;
        const compressionReserve = currentChainHeight - minChainHeight;
        const movementReserve = freeSpace + compressionReserve;
        return movementReserve <= 0;
    }
}
exports.ChainBlockDetector = ChainBlockDetector;
