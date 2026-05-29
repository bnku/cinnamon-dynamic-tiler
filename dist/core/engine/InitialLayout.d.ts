export declare class InitialLayout {
    /**
     * Находит наиболее подходящий горизонтальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialHSpan(direction: 'left' | 'right' | 'shift-left' | 'shift-right', siblingSpans: {
        hSpan: [number, number];
    }[]): [number, number];
    /**
     * Находит наиболее подходящий вертикальный спан для первого тайлинга в зависимости от направления и соседей
     */
    static getInitialVSpan(direction: 'up' | 'down', siblingSpans: {
        vSpan: [number, number];
    }[]): [number, number];
}
