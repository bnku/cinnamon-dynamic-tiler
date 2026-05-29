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
export type Direction = 'left' | 'right' | 'up' | 'down';
export interface WindowState {
    widthFraction: number;
    heightFraction: number;
    horizontalAlign: 'left' | 'right' | 'center' | null;
    verticalAlign: 'top' | 'bottom' | 'center' | null;
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
    horizontalFractions: number[];
    verticalFractions: number[];
    gaps: number;
}
