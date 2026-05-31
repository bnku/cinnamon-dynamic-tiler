import { IShellAdapter } from './core/ports/IShellAdapter';
import { ICacheManager } from './core/ports/ICacheManager';
import { IConfigProvider } from './core/ports/IConfigProvider';
import { WindowState, Geometry, ScreenInfo, CachedWindowState, Config } from './core/types';
import { TilePreview } from './TilePreview';

declare const imports: any;
declare const global: any;

const Meta = imports.gi.Meta;

export class CinnamonCache implements ICacheManager {
  private cache: Record<string, CachedWindowState> = {};

  public saveState(windowId: string, state: WindowState, tiledGeom: Geometry, originalGeom: Geometry): void {
    this.cache[windowId] = {
      windowId,
      state,
      tiledGeometry: tiledGeom,
      originalGeometry: originalGeom,
      lastUpdated: Date.now()
    };
  }

  public getCachedWindow(windowId: string): CachedWindowState | null {
    return this.cache[windowId] || null;
  }

  public getAllCachedWindows(): Record<string, CachedWindowState> {
    return this.cache;
  }

  public clearState(windowId: string): void {
    delete this.cache[windowId];
  }
}

export class CinnamonConfigProvider implements IConfigProvider {
  constructor(private ext: any) {}

  public getConfig(): Config {
    return this.ext.getConfigForMonitor
      ? this.ext.getConfigForMonitor(null)
      : this.buildConfig();
  }

  public getConfigForMonitor(monitor: ScreenInfo): Config {
    return this.ext.getConfigForMonitor
      ? this.ext.getConfigForMonitor(monitor)
      : this.buildConfig();
  }

  private buildConfig(): Config {
    return {
      gridSize: this.ext.gridSize !== undefined ? this.ext.gridSize : 12,
      gridColumns: this.ext.gridColumns !== undefined ? this.ext.gridColumns : (this.ext.gridSize !== undefined ? this.ext.gridSize : 12),
      gridRows: this.ext.gridRows !== undefined ? this.ext.gridRows : 6,
      minSpan: this.ext.minSpan !== undefined ? this.ext.minSpan : 2,
      minColumnSpan: this.ext.minColumnSpan !== undefined ? this.ext.minColumnSpan : (this.ext.minSpan !== undefined ? this.ext.minSpan : 2),
      minRowSpan: this.ext.minRowSpan !== undefined ? this.ext.minRowSpan : (this.ext.minSpan !== undefined ? this.ext.minSpan : 2),
      step: this.ext.step !== undefined ? this.ext.step : 1,
      gaps: this.ext.gaps !== undefined ? this.ext.gaps : 8
    };
  }
}

export class CinnamonShellAdapter implements IShellAdapter {
  constructor(private ext: any) {}

  public getActiveWindowId(): string {
    const win = global.display.focus_window;
    return win ? win.get_stable_sequence().toString() : '';
  }

  public getWindowGeometry(id: string): Geometry {
    const win = this._findMetaWindow(id);
    if (!win) {
      throw new Error(`Window ${id} not found.`);
    }
    const rect = win.get_frame_rect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  public getFrameExtents(id: string): { left: number; right: number; top: number; bottom: number } {
    return { left: 0, right: 0, top: 0, bottom: 0 };
  }

  public getVisibleWindowIds(): string[] {
    const workspace = global.workspace_manager.get_active_workspace();
    const actors = global.get_window_actors() || [];
    return actors
      .map((a: any) => a.meta_window)
      .filter((win: any) => {
        if (!win) return false;
        if (win.get_window_type() !== Meta.WindowType.NORMAL) return false;
        if (win.minimized) return false;
        if (!win.is_on_all_workspaces() && win.get_workspace() !== workspace) return false;
        return true;
      })
      .map((win: any) => win.get_stable_sequence().toString());
  }

  public getActiveMonitors(): ScreenInfo[] {
    const monitors: ScreenInfo[] = [];
    const nMonitors = global.display.get_n_monitors();
    const activeWorkspace = global.workspace_manager.get_active_workspace();
    for (let i = 0; i < nMonitors; i++) {
      const rect = global.display.get_monitor_geometry(i);
      const workArea = activeWorkspace.get_work_area_for_monitor(i);
      monitors.push({
        id: i.toString(),
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        workarea: {
          x: workArea.x,
          y: workArea.y,
          width: workArea.width,
          height: workArea.height
        }
      });
    }
    return monitors;
  }

  public findMonitorForWindow(geom: Geometry, monitors: ScreenInfo[]): ScreenInfo {
    let maxArea = -1;
    let bestMonitor = monitors[0];
    for (const m of monitors) {
      const ix = Math.max(geom.x, m.workarea.x);
      const iy = Math.max(geom.y, m.workarea.y);
      const iw = Math.min(geom.x + geom.width, m.workarea.x + m.workarea.width) - ix;
      const ih = Math.min(geom.y + geom.height, m.workarea.y + m.workarea.height) - iy;
      if (iw > 0 && ih > 0) {
        const area = iw * ih;
        if (area > maxArea) {
          maxArea = area;
          bestMonitor = m;
        }
      }
    }
    return bestMonitor;
  }

  public applyGeometry(id: string, geom: Geometry): void {
    const win = this._findMetaWindow(id);
    if (!win) return;

    if (win.maximized_horz || win.maximized_vert) {
      win.unmaximize(Meta.MaximizeFlags.BOTH);
    }

    const enablePreview = this.ext.enablePreview !== undefined ? this.ext.enablePreview : true;

    if (enablePreview) {
      const monitorIndex = win.get_monitor();
      const preview = new TilePreview();
      preview.show(win, geom, monitorIndex, true, 150);

      // Apply geometry after a micro-delay for smooth visual transition
      imports.mainloop.timeout_add(60, () => {
        try {
          win.move_resize_frame(true, geom.x, geom.y, geom.width, geom.height);
        } catch (e) {}
        return false;
      });

      // Hide and destroy preview frame
      imports.mainloop.timeout_add(220, () => {
        try {
          preview.hide();
          preview.destroy();
        } catch (e) {}
        return false;
      });
    } else {
      // Instant layout rearrangement without delay and preview frame
      win.move_resize_frame(true, geom.x, geom.y, geom.width, geom.height);
    }
  }

  public unmaximizeWindow(id: string): void {
    const win = this._findMetaWindow(id);
    if (win && (win.maximized_horz || win.maximized_vert)) {
      win.unmaximize(Meta.MaximizeFlags.BOTH);
    }
  }

  public raiseWindow(id: string): void {
    const win = this._findMetaWindow(id);
    if (win) {
      win.activate(global.get_current_time());
    }
  }

  public _findMetaWindow(stableSequence: string): any {
    const actors = global.get_window_actors() || [];
    const actor = actors.find((a: any) => {
      return a.meta_window && a.meta_window.get_stable_sequence().toString() === stableSequence;
    });
    return actor ? actor.meta_window : null;
  }
}
