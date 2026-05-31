"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CinnamonShellAdapter = exports.CinnamonConfigProvider = exports.CinnamonCache = void 0;
const TilePreview_1 = require("./TilePreview");
const Meta = imports.gi.Meta;
class CinnamonCache {
    cache = {};
    saveState(windowId, state, tiledGeom, originalGeom) {
        this.cache[windowId] = {
            windowId,
            state,
            tiledGeometry: tiledGeom,
            originalGeometry: originalGeom,
            lastUpdated: Date.now()
        };
    }
    getCachedWindow(windowId) {
        return this.cache[windowId] || null;
    }
    getAllCachedWindows() {
        return this.cache;
    }
    clearState(windowId) {
        delete this.cache[windowId];
    }
}
exports.CinnamonCache = CinnamonCache;
class CinnamonConfigProvider {
    ext;
    constructor(ext) {
        this.ext = ext;
    }
    getConfig() {
        return this.ext.getConfigForMonitor
            ? this.ext.getConfigForMonitor(null)
            : this.buildConfig();
    }
    getConfigForMonitor(monitor) {
        return this.ext.getConfigForMonitor
            ? this.ext.getConfigForMonitor(monitor)
            : this.buildConfig();
    }
    buildConfig() {
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
exports.CinnamonConfigProvider = CinnamonConfigProvider;
class CinnamonShellAdapter {
    ext;
    constructor(ext) {
        this.ext = ext;
    }
    getActiveWindowId() {
        const win = global.display.focus_window;
        return win ? win.get_stable_sequence().toString() : '';
    }
    getWindowGeometry(id) {
        const win = this._findMetaWindow(id);
        if (!win) {
            throw new Error(`Window ${id} not found.`);
        }
        const rect = win.get_frame_rect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    }
    getFrameExtents(id) {
        return { left: 0, right: 0, top: 0, bottom: 0 };
    }
    getVisibleWindowIds() {
        const workspace = global.workspace_manager.get_active_workspace();
        const actors = global.get_window_actors() || [];
        return actors
            .map((a) => a.meta_window)
            .filter((win) => {
            if (!win)
                return false;
            if (win.get_window_type() !== Meta.WindowType.NORMAL)
                return false;
            if (win.minimized)
                return false;
            if (!win.is_on_all_workspaces() && win.get_workspace() !== workspace)
                return false;
            return true;
        })
            .map((win) => win.get_stable_sequence().toString());
    }
    getActiveMonitors() {
        const monitors = [];
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
    findMonitorForWindow(geom, monitors) {
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
    applyGeometry(id, geom) {
        const win = this._findMetaWindow(id);
        if (!win)
            return;
        if (win.maximized_horz || win.maximized_vert) {
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        }
        const enablePreview = this.ext.enablePreview !== undefined ? this.ext.enablePreview : true;
        if (enablePreview) {
            const monitorIndex = win.get_monitor();
            const preview = new TilePreview_1.TilePreview();
            preview.show(win, geom, monitorIndex, true, 150);
            // Apply geometry after a micro-delay for smooth visual transition
            imports.mainloop.timeout_add(60, () => {
                try {
                    win.move_resize_frame(true, geom.x, geom.y, geom.width, geom.height);
                }
                catch (e) { }
                return false;
            });
            // Hide and destroy preview frame
            imports.mainloop.timeout_add(220, () => {
                try {
                    preview.hide();
                    preview.destroy();
                }
                catch (e) { }
                return false;
            });
        }
        else {
            // Instant layout rearrangement without delay and preview frame
            win.move_resize_frame(true, geom.x, geom.y, geom.width, geom.height);
        }
    }
    unmaximizeWindow(id) {
        const win = this._findMetaWindow(id);
        if (win && (win.maximized_horz || win.maximized_vert)) {
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        }
    }
    raiseWindow(id) {
        const win = this._findMetaWindow(id);
        if (win) {
            win.activate(global.get_current_time());
        }
    }
    _findMetaWindow(stableSequence) {
        const actors = global.get_window_actors() || [];
        const actor = actors.find((a) => {
            return a.meta_window && a.meta_window.get_stable_sequence().toString() === stableSequence;
        });
        return actor ? actor.meta_window : null;
    }
}
exports.CinnamonShellAdapter = CinnamonShellAdapter;
