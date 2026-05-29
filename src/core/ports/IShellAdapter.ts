import { Geometry, ScreenInfo } from '../types';

export interface IShellAdapter {
  getActiveWindowId(): string;
  getWindowGeometry(id: string): Geometry;
  getFrameExtents(id: string): { left: number; right: number; top: number; bottom: number };
  getVisibleWindowIds(): string[];
  getActiveMonitors(): ScreenInfo[];
  findMonitorForWindow(geom: Geometry, monitors: ScreenInfo[]): ScreenInfo;
  applyGeometry(id: string, geom: Geometry): void;
  unmaximizeWindow(id: string): void;
  raiseWindow(id: string): void;
}
