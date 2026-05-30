import { Config } from '../types';
export declare class ChainBlockDetector {
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон слева от текущей границы
     */
    static isLeftChainBlocked(startCol: number, siblingSpans: {
        hSpan: [number, number];
    }[], config: Config): boolean;
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон справа от текущей границы
     */
    static isRightChainBlocked(endCol: number, siblingSpans: {
        hSpan: [number, number];
    }[], config: Config): boolean;
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон сверху от текущей границы
     */
    static isTopChainBlocked(startRow: number, siblingSpans: {
        vSpan: [number, number];
    }[], config: Config): boolean;
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон снизу от текущей границы
     */
    static isBottomChainBlocked(endRow: number, siblingSpans: {
        vSpan: [number, number];
    }[], config: Config): boolean;
}
