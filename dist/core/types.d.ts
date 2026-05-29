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
export type Direction = 'left' | 'right' | 'up' | 'down' | 'shift-left' | 'shift-right';
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
    minSpan: number;
    step: number;
    gaps: number;
}
