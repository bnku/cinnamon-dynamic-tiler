import { Config } from '../types';
export declare class ChainBlockDetector {
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон слева от текущей границы
     */
    static isLeftChainBlocked(startCol: number, siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, activeVSpan: [number, number]): boolean;
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон справа от текущей границы
     */
    static isRightChainBlocked(endCol: number, siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, activeVSpan: [number, number]): boolean;
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон сверху от текущей границы
     */
    static isTopChainBlocked(startRow: number, siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, activeHSpan: [number, number]): boolean;
    /**
     * Проверяет, заблокирована ли цепочка соприкасающихся окон снизу от текущей границы
     */
    static isBottomChainBlocked(endRow: number, siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, activeHSpan: [number, number]): boolean;
}
