export declare const HORIZONTAL_SPANS: [number, number][];
export declare const VERTICAL_SPANS: [number, number][];
/**
 * Мапит горизонтальный спан на примерный hIndex для совместимости со старыми частями кода
 */
export declare function spanToHIndex(span: [number, number]): number;
/**
 * Мапит вертикальный спан на примерный vIndex для совместимости
 */
export declare function spanToVIndex(span: [number, number]): number;
