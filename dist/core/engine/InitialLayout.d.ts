import { Config } from '../types';
export declare class InitialLayout {
    /**
     * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialHSpan(direction: 'left' | 'right' | 'shift-left' | 'shift-right', siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, fixedVSpan?: [number, number]): [number, number];
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction: 'up' | 'down', siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, fixedHSpan?: [number, number]): [number, number];
    /**
     * Находит наиболее подходящий двумерный макет для первого тайлинга
     */
    static getInitialSpans(direction: 'left' | 'right' | 'up' | 'down' | 'shift-left' | 'shift-right', siblingSpans: {
        hSpan: [number, number];
        vSpan: [number, number];
    }[], config: Config, options?: {
        fixedHSpan?: [number, number];
        fixedVSpan?: [number, number];
    }): {
        hSpan: [number, number];
        vSpan: [number, number];
    };
}
