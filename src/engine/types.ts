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
  // Индекс положения окна по горизонтали в 12-колоночной сетке (0..10)
  hIndex: number;
  // Индекс положения окна по вертикали в 12-строчной сетке (0..6)
  vIndex: number;
  // Последнее примененное направление движения (или null, если окно только открыто)
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
