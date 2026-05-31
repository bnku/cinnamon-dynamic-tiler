export interface Geometry {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface ScreenInfo {
    id: string;
    width: number;
    height: number;
    x: number;
    y: number;
    workarea: Geometry;
}
export type Direction = 'left' | 'right' | 'up' | 'down' | 'shift-left' | 'shift-right' | 'shift-up' | 'shift-down';
export interface WindowState {
    hIndex: number;
    vIndex: number;
    hSpan: [number, number];
    vSpan: [number, number];
    lastDirection: Direction | null;
}
export interface CachedWindowState {
    windowId: string;
    state: WindowState;
    tiledGeometry: Geometry;
    originalGeometry: Geometry;
    lastUpdated: number;
}
export interface Config {
    gridSize: number;
    gridColumns?: number;
    gridRows?: number;
    minSpan: number;
    minColumnSpan?: number;
    minRowSpan?: number;
    step: number;
    gaps: number;
}
export declare function getGridColumns(config: Config): number;
export declare function getGridRows(config: Config): number;
export declare function getMinColumnSpan(config: Config): number;
export declare function getMinRowSpan(config: Config): number;
