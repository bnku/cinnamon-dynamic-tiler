"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.init = init;
exports.enable = enable;
exports.disable = disable;
const TilingEngine_1 = require("./core/TilingEngine");
const TilingUseCase_1 = require("./core/usecases/TilingUseCase");
const CinnamonAdapters_1 = require("./CinnamonAdapters");
const DragTiling_1 = require("./DragTiling");
const TilePreview_1 = require("./TilePreview");
const Settings = imports.ui.settings;
const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Clutter = imports.gi.Clutter;
class DynamicTilerExtension {
    metadata;
    settings;
    shell;
    cache;
    configProvider;
    useCase;
    bindings = {};
    // Settings values automatically bound by Cinnamon settings system
    gaps;
    gridSize;
    minSpan;
    step;
    enablePreview;
    'enable-dnd-tiling';
    'dnd-modifier-key';
    'keybinding-tile-left';
    'keybinding-tile-right';
    'keybinding-tile-up';
    'keybinding-tile-down';
    'keybinding-shift-left';
    'keybinding-shift-right';
    'keybinding-shift-up';
    'keybinding-shift-down';
    'keybinding-restore';
    // DnD State tracking
    grabBeginId = 0;
    grabEndId = 0;
    draggedWindow = null;
    draggedWindowId = '';
    dragTimerId = 0;
    previewsMap = {};
    lastDragStates = null;
    lastDragMonitor = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
    dragSession = null;
    vacancyPreview = null;
    constructor(metadata) {
        this.metadata = metadata;
        this.shell = new CinnamonAdapters_1.CinnamonShellAdapter(this);
        this.cache = new CinnamonAdapters_1.CinnamonCache();
        this.configProvider = new CinnamonAdapters_1.CinnamonConfigProvider(this);
        this.useCase = new TilingUseCase_1.TilingUseCase(this.shell, this.cache, this.configProvider);
    }
    enable() {
        try {
            this.settings = new Settings.ExtensionSettings(this, this.metadata.uuid, this.metadata.uuid);
            // Bind basic settings and trigger layout adjustments in real-time
            this.settings.bindProperty(Settings.BindingDirection.IN, 'gaps', 'gaps', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'gridSize', 'gridSize', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'minSpan', 'minSpan', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'step', 'step', () => {
                this.applyConfigurationChange();
            });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'enablePreview', 'enablePreview', () => { });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'enable-dnd-tiling', 'enable-dnd-tiling', () => { });
            this.settings.bindProperty(Settings.BindingDirection.IN, 'dnd-modifier-key', 'dnd-modifier-key', () => { });
            // Bind keybindings
            this.registerKeybinding('keybinding-tile-left', 'left');
            this.registerKeybinding('keybinding-tile-right', 'right');
            this.registerKeybinding('keybinding-tile-up', 'up');
            this.registerKeybinding('keybinding-tile-down', 'down');
            this.registerKeybinding('keybinding-shift-left', 'shift-left');
            this.registerKeybinding('keybinding-shift-right', 'shift-right');
            this.registerKeybinding('keybinding-shift-up', 'shift-up');
            this.registerKeybinding('keybinding-shift-down', 'shift-down');
            this.registerKeybinding('keybinding-restore', 'restore');
            // Universally hook into window dragging supporting both 2-arg (Mutter 40+) and 3-arg/4-arg (older Mutter) signatures
            this.grabBeginId = global.display.connect('grab-op-begin', (...args) => {
                let window = global.display.focus_window;
                let op = null;
                if (args.length === 4) {
                    // Signature: (display, screen, window, op)
                    window = args[2];
                    op = args[3];
                }
                else if (args.length === 3) {
                    // Signature: (display, window, op)
                    window = args[1];
                    op = args[2];
                }
                else if (args.length === 2) {
                    // Signature: (display, op)
                    op = args[1];
                }
                else {
                    // Fallback
                    op = args[args.length - 1];
                }
                this.onGrabBegin(window, op);
            });
            this.grabEndId = global.display.connect('grab-op-end', () => {
                this.onGrabEnd();
            });
            // Index all windows on startup
            try {
                const monitors = this.shell.getActiveMonitors();
                const config = this.configProvider.getConfig();
                const activeMonitor = monitors[0];
                this.indexAllWindows(activeMonitor, config, monitors, true);
                global.log(`[Dynamic Tiler] Initial window indexing completed`);
            }
            catch (err) {
                global.logError(`[Dynamic Tiler] Initial indexing error: ${err.message}`);
            }
            global.log(`[Dynamic Tiler] Extension enabled and hooks registered successfully`);
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to enable extension: ${e}`);
        }
    }
    disable() {
        try {
            // Remove mouse grab events
            if (this.grabBeginId) {
                global.display.disconnect(this.grabBeginId);
                this.grabBeginId = 0;
            }
            if (this.grabEndId) {
                global.display.disconnect(this.grabEndId);
                this.grabEndId = 0;
            }
            this.stopDragTimer();
            this.clearPreviews();
            // Remove all keybindings
            for (const key of Object.keys(this.bindings)) {
                Main.keybindingManager.removeHotKey(key);
            }
            this.bindings = {};
            if (this.settings) {
                this.settings.finalize();
            }
            global.log(`[Dynamic Tiler] Extension disabled successfully`);
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to disable extension: ${e}`);
        }
    }
    onGrabBegin(window, op) {
        const enableDnd = this['enable-dnd-tiling'] !== false;
        if (!enableDnd)
            return;
        // Robustly filter out non-interactive grab ops (NONE, COMPOSITOR) but allow window moving
        const isMoving = op === Meta.GrabOp.MOVING ||
            op === Meta.GrabOp.KEYBOARD_MOVING ||
            (typeof op === 'number' && op === 3);
        if (!isMoving) {
            return;
        }
        // Fallback to focus_window if window is not passed by Mutter signature
        const win = window || global.display.focus_window;
        if (win) {
            this.draggedWindow = win;
            this.draggedWindowId = win.get_stable_sequence().toString();
            this.lastDragStates = null;
            this.lastDragMonitor = null;
            const cached = this.cache.getCachedWindow(this.draggedWindowId);
            const monitors = this.shell.getActiveMonitors();
            const geom = this.shell.getWindowGeometry(this.draggedWindowId);
            const activeMonitor = this.shell.findMonitorForWindow(geom, monitors);
            this.dragSession = {
                draggedWindowId: this.draggedWindowId,
                sourceMonitor: activeMonitor,
                wasTiled: (cached !== null),
                sourceState: cached ? { ...cached.state } : null,
                sourceGeometry: cached ? { ...cached.originalGeometry } : { ...geom },
                sourceTiledGeometry: cached ? { ...cached.tiledGeometry } : null,
                lastDragStates: null
            };
            // Calculate mouse offset relative to top-left corner of the dragged window
            try {
                const [mx, my] = global.get_pointer();
                this.dragOffsetX = mx - geom.x;
                this.dragOffsetY = my - geom.y;
            }
            catch (err) {
                this.dragOffsetX = 0;
                this.dragOffsetY = 0;
            }
            global.log(`[Dynamic Tiler] Window drag started: ID ${this.draggedWindowId}, Op: ${op}, Offset: ${this.dragOffsetX}, ${this.dragOffsetY}, WasTiled: ${this.dragSession.wasTiled}`);
            // Auto-index all screen windows immediately on drag start to rebuild active grid states
            try {
                const config = this.configProvider.getConfig();
                this.indexAllWindows(activeMonitor, config, monitors);
            }
            catch (err) {
                global.logError(`[Dynamic Tiler] DnD Pre-indexing error: ${err.message}`);
            }
            this.stopDragTimer();
            this.dragTimerId = imports.mainloop.timeout_add(30, () => {
                return this.onDragUpdate();
            });
        }
    }
    indexAllWindows(activeMonitor, config, monitors, forceAddNew = false) {
        const visibleWindowIds = this.shell.getVisibleWindowIds();
        const visibleSet = new Set(visibleWindowIds);
        // 1. Clean up cached states for windows that are no longer visible on screen
        const allCached = this.cache.getAllCachedWindows();
        for (const id of Object.keys(allCached)) {
            if (!visibleSet.has(id)) {
                this.cache.clearState(id);
            }
        }
        // confirmedSpansMap keeps track of validated non-overlapping tiled spans for each monitor
        const confirmedSpansMap = {};
        // 2. Refresh or index newly discovered windows
        for (const id of visibleWindowIds) {
            if (id === this.draggedWindowId)
                continue;
            const cached = this.cache.getCachedWindow(id);
            if (!cached && !forceAddNew) {
                continue;
            }
            try {
                const currentGeom = this.shell.getWindowGeometry(id);
                const ext = this.shell.getFrameExtents(id);
                const currentVisible = {
                    x: currentGeom.x + ext.left,
                    y: currentGeom.y + ext.top,
                    width: currentGeom.width - ext.left - ext.right,
                    height: currentGeom.height - ext.top - ext.bottom,
                };
                const currentMonitor = this.shell.findMonitorForWindow(currentVisible, monitors);
                let hSpan = [0, config.gridSize];
                let vSpan = [0, config.gridSize];
                let isResting = false;
                if (cached) {
                    // Verify if the window physical location matches its cached tiled geometry
                    const diffX = Math.abs(currentVisible.x - cached.tiledGeometry.x);
                    const diffY = Math.abs(currentVisible.y - cached.tiledGeometry.y);
                    const diffW = Math.abs(currentVisible.width - cached.tiledGeometry.width);
                    const diffH = Math.abs(currentVisible.height - cached.tiledGeometry.height);
                    const MATCH_THRESHOLD = 40;
                    if (diffX <= MATCH_THRESHOLD && diffY <= MATCH_THRESHOLD && diffW <= MATCH_THRESHOLD && diffH <= MATCH_THRESHOLD) {
                        // Window is resting on its tiled position. Keep its perfect logical spans!
                        hSpan = cached.state.hSpan;
                        vSpan = cached.state.vSpan;
                        isResting = true;
                    }
                }
                if (!isResting) {
                    // Window is either new or has been manually moved by user. Re-calculate spans!
                    hSpan = TilingEngine_1.TilingEngine.geometryToHSpan(currentVisible, currentMonitor, config);
                    vSpan = TilingEngine_1.TilingEngine.geometryToVSpan(currentVisible, currentMonitor, config);
                    // Clamping to support minimum sizing requirements
                    if (hSpan[1] - hSpan[0] < config.minSpan) {
                        const center = Math.round((hSpan[0] + hSpan[1]) / 2);
                        hSpan[0] = Math.max(0, center - Math.floor(config.minSpan / 2));
                        hSpan[1] = Math.min(config.gridSize, hSpan[0] + config.minSpan);
                        hSpan[0] = Math.max(0, hSpan[1] - config.minSpan);
                    }
                    if (vSpan[1] - vSpan[0] < config.minSpan) {
                        const center = Math.round((vSpan[0] + vSpan[1]) / 2);
                        vSpan[0] = Math.max(0, center - Math.floor(config.minSpan / 2));
                        vSpan[1] = Math.min(config.gridSize, vSpan[0] + config.minSpan);
                        vSpan[0] = Math.max(0, vSpan[1] - config.minSpan);
                    }
                }
                // Z-Overlap Sanitization Check:
                // Ensure this window's logical span does not overlap with already confirmed tiled windows on this monitor.
                let hasOverlap = false;
                const confirmed = confirmedSpansMap[currentMonitor.id] || [];
                for (const span of confirmed) {
                    const hasH = Math.max(hSpan[0], span.hSpan[0]) < Math.min(hSpan[1], span.hSpan[1]);
                    const hasV = Math.max(vSpan[0], span.vSpan[0]) < Math.min(vSpan[1], span.vSpan[1]);
                    if (hasH && hasV) {
                        hasOverlap = true;
                        break;
                    }
                }
                if (hasOverlap) {
                    // Overlap detected! Strip this overlapping window from the tiling cache to make it float.
                    if (cached) {
                        this.cache.clearState(id);
                        global.log(`[Dynamic Tiler] Cache Sanitation: Stripped overlapping window ${id} from cache`);
                    }
                    continue;
                }
                // Add this non-overlapping window's spans to the confirmed list
                if (!confirmedSpansMap[currentMonitor.id]) {
                    confirmedSpansMap[currentMonitor.id] = [];
                }
                confirmedSpansMap[currentMonitor.id].push({ hSpan, vSpan });
                if (isResting) {
                    // No changes needed for resting windows, they are already correctly cached
                    continue;
                }
                // Window needs to be newly saved or updated in cache
                const restoredState = {
                    hIndex: TilingEngine_1.TilingEngine.spanToHIndex(hSpan),
                    vIndex: TilingEngine_1.TilingEngine.spanToVIndex(vSpan),
                    hSpan,
                    vSpan,
                    lastDirection: null
                };
                const originalGeom = cached ? cached.originalGeometry : currentGeom;
                this.cache.saveState(id, restoredState, currentVisible, originalGeom);
                global.log(`[Dynamic Tiler] Auto-indexed window ${id} to cell [${hSpan.join(',')}] x [${vSpan.join(',')}]`);
            }
            catch (e) {
                // Ignore failures for individual windows
            }
        }
    }
    onDragUpdate() {
        if (!this.draggedWindowId)
            return false;
        try {
            const [mx, my, mods] = global.get_pointer();
            // Parse keybinding string from settings (e.g. "<Shift>d" or "d")
            let hotkeySetting = this['dnd-modifier-key'] || '<Shift>d';
            if (Array.isArray(hotkeySetting)) {
                hotkeySetting = hotkeySetting[0] || '<Shift>d';
            }
            const ctrl = hotkeySetting.includes('Control') || hotkeySetting.includes('Ctrl') || hotkeySetting.includes('Primary');
            const shift = hotkeySetting.includes('Shift');
            const alt = hotkeySetting.includes('Alt') || hotkeySetting.includes('Meta') || hotkeySetting.includes('Mod1');
            const superKey = hotkeySetting.includes('Super') || hotkeySetting.includes('Mod4');
            let isModifierPressed = false;
            if (!ctrl && !shift && !alt && !superKey) {
                isModifierPressed = true;
            }
            else {
                const ctrlPressed = (mods & Clutter.ModifierType.CONTROL_MASK) !== 0;
                const shiftPressed = (mods & Clutter.ModifierType.SHIFT_MASK) !== 0;
                const altPressed = (mods & Clutter.ModifierType.MOD1_MASK) !== 0;
                const superPressed = (mods & Clutter.ModifierType.SUPER_MASK) !== 0;
                isModifierPressed = true;
                if (ctrl && !ctrlPressed)
                    isModifierPressed = false;
                if (shift && !shiftPressed)
                    isModifierPressed = false;
                if (alt && !altPressed)
                    isModifierPressed = false;
                if (superKey && !superPressed)
                    isModifierPressed = false;
            }
            if (!isModifierPressed) {
                if (this.dragSession && this.dragSession.lastDragStates) {
                    this.clearPreviews();
                    this.dragSession.lastDragStates = null;
                    this.lastDragStates = null;
                    // Restore the original geometry and place the window smoothly under the mouse
                    try {
                        const win = this.shell._findMetaWindow(this.draggedWindowId);
                        if (win && this.dragSession.sourceGeometry) {
                            const orig = this.dragSession.sourceGeometry;
                            this.shell.unmaximizeWindow(this.draggedWindowId);
                            // Position the window title bar right under the mouse cursor
                            const nextX = mx - Math.round(orig.width / 2);
                            const nextY = my - 15; // 15px down (header drag zone)
                            win.move_resize_frame(true, nextX, nextY, orig.width, orig.height);
                            // Reset mouse offsets to ensure smooth classical floating drag thereafter
                            this.dragOffsetX = Math.round(orig.width / 2);
                            this.dragOffsetY = 15;
                        }
                    }
                    catch (err) { }
                }
                else {
                    this.clearPreviews();
                }
                this.lastDragStates = null;
                this.lastDragMonitor = null;
                return true;
            }
            const monitors = this.shell.getActiveMonitors();
            let activeMonitor = monitors[0];
            for (const m of monitors) {
                if (mx >= m.workarea.x && mx < m.workarea.x + m.workarea.width &&
                    my >= m.workarea.y && my < m.workarea.y + m.workarea.height) {
                    activeMonitor = m;
                    break;
                }
            }
            this.lastDragMonitor = activeMonitor;
            if (this.dragSession) {
                this.dragSession.targetMonitor = activeMonitor;
            }
            const config = this.configProvider.getConfig();
            const { workarea } = activeMonitor;
            const colWidth = workarea.width / config.gridSize;
            // Determine the target sizes based on cache or physical size
            let windowWidth = Math.round(config.gridSize / 2);
            let windowHeight = config.gridSize;
            if (this.dragSession && this.dragSession.wasTiled && this.dragSession.sourceState) {
                windowWidth = this.dragSession.sourceState.hSpan[1] - this.dragSession.sourceState.hSpan[0];
                windowHeight = this.dragSession.sourceState.vSpan[1] - this.dragSession.sourceState.vSpan[0];
            }
            else {
                try {
                    const geom = this.dragSession ? this.dragSession.sourceGeometry : this.shell.getWindowGeometry(this.draggedWindowId);
                    const hSpan = TilingEngine_1.TilingEngine.geometryToHSpan(geom, activeMonitor, config);
                    const vSpan = TilingEngine_1.TilingEngine.geometryToVSpan(geom, activeMonitor, config);
                    windowWidth = Math.max(config.minSpan, hSpan[1] - hSpan[0]);
                    windowHeight = Math.max(config.minSpan, vSpan[1] - vSpan[0]);
                }
                catch (e) {
                    windowWidth = Math.round(config.gridSize / 2);
                    windowHeight = Math.round(config.gridSize / 2);
                }
            }
            // Convert cursor position to intent hotspot (cursor as center of target window span)
            let startCol = Math.round(((mx - workarea.x) / colWidth) - windowWidth / 2);
            // Clamp starting cells to remain fully inside the grid boundary
            if (startCol + windowWidth > config.gridSize) {
                startCol = config.gridSize - windowWidth;
            }
            if (startCol < 0)
                startCol = 0;
            const targetHSpan = [startCol, startCol + windowWidth];
            // Scan all other normal windows on this monitor to build the activeWindowsOnMonitor list first,
            // as we need this context to detect stacked windows in the target column.
            const visibleWindowIds = this.shell.getVisibleWindowIds();
            const activeWindowsOnMonitor = [];
            for (const id of visibleWindowIds) {
                let state = null;
                let cachedWin = this.cache.getCachedWindow(id);
                if (id === this.draggedWindowId) {
                    if (this.dragSession && this.dragSession.wasTiled && this.dragSession.sourceState) {
                        state = this.dragSession.sourceState;
                    }
                    else {
                        // New window, create transient state
                        state = {
                            hSpan: [startCol, startCol + windowWidth],
                            vSpan: [0, config.gridSize],
                            hIndex: TilingEngine_1.TilingEngine.spanToHIndex([startCol, startCol + windowWidth]),
                            vIndex: TilingEngine_1.TilingEngine.spanToVIndex([0, config.gridSize]),
                            lastDirection: null
                        };
                    }
                }
                else {
                    if (cachedWin) {
                        state = cachedWin.state;
                    }
                }
                if (!state)
                    continue;
                let currentMonitor = activeMonitor;
                if (id !== this.draggedWindowId) {
                    try {
                        const geom = this.shell.getWindowGeometry(id);
                        currentMonitor = this.shell.findMonitorForWindow(geom, monitors);
                    }
                    catch {
                        if (cachedWin) {
                            currentMonitor = this.shell.findMonitorForWindow(cachedWin.tiledGeometry, monitors);
                        }
                    }
                }
                if (currentMonitor.id === activeMonitor.id) {
                    activeWindowsOnMonitor.push({
                        windowId: id,
                        state: state
                    });
                }
            }
            // Check for windows stacked vertically (above and below) in our target horizontal span
            let hasWindowAbove = false;
            let hasWindowBelow = false;
            const midGrid = Math.round(config.gridSize / 2);
            const hasHorizontalOverlap = (spanA, spanB) => {
                return Math.max(spanA[0], spanB[0]) < Math.min(spanA[1], spanB[1]);
            };
            for (const w of activeWindowsOnMonitor) {
                if (w.windowId === this.draggedWindowId)
                    continue;
                if (hasHorizontalOverlap(targetHSpan, w.state.hSpan)) {
                    const centerV = (w.state.vSpan[0] + w.state.vSpan[1]) / 2;
                    if (centerV < midGrid) {
                        hasWindowAbove = true;
                    }
                    else if (centerV > midGrid) {
                        hasWindowBelow = true;
                    }
                }
            }
            let targetVSpan;
            const ratioY = (my - workarea.y) / workarea.height;
            if (ratioY < 0.28) {
                // Upper edge -> take upper half
                targetVSpan = [0, midGrid];
            }
            else if (ratioY > 0.72) {
                // Lower edge -> take lower half
                targetVSpan = [midGrid, config.gridSize];
            }
            else {
                // Center zone
                if (hasWindowAbove && hasWindowBelow) {
                    // Stand 'between' them (occupy middle half)
                    const quarter = Math.round(config.gridSize / 4);
                    targetVSpan = [quarter, config.gridSize - quarter];
                }
                else {
                    // Clear center -> occupy full vertical height
                    targetVSpan = [0, config.gridSize];
                }
            }
            // Calculate the elastic pushes
            const dragStates = (0, DragTiling_1.calculateDragTransitions)(this.draggedWindowId, targetHSpan, targetVSpan, config, activeWindowsOnMonitor);
            this.lastDragStates = dragStates;
            if (this.dragSession) {
                this.dragSession.lastDragStates = dragStates;
            }
            // Draw vacancy-outline at the old window position if it was tiled
            if (this.dragSession && this.dragSession.wasTiled && this.dragSession.sourceTiledGeometry) {
                if (!this.vacancyPreview) {
                    this.vacancyPreview = new TilePreview_1.TilePreview();
                }
                const sourceMonitorIndex = parseInt(this.dragSession.sourceMonitor.id);
                const win = this.shell._findMetaWindow(this.draggedWindowId);
                if (win) {
                    this.vacancyPreview.show(win, this.dragSession.sourceTiledGeometry, sourceMonitorIndex, true, 80, 50, true);
                }
            }
            // Draw ghost frames for all affected windows
            for (const [id, nextState] of Object.entries(dragStates)) {
                const isDragged = (id === this.draggedWindowId);
                let hasChanged = true;
                if (!isDragged) {
                    const cached = this.cache.getCachedWindow(id);
                    if (cached) {
                        const sameH = cached.state.hSpan[0] === nextState.hSpan[0] && cached.state.hSpan[1] === nextState.hSpan[1];
                        const sameV = cached.state.vSpan[0] === nextState.vSpan[0] && cached.state.vSpan[1] === nextState.vSpan[1];
                        if (sameH && sameV) {
                            hasChanged = false;
                        }
                    }
                }
                if (hasChanged) {
                    const frameGeom = TilingEngine_1.TilingEngine.stateToGeometry(nextState, activeMonitor, config);
                    let preview = this.previewsMap[id];
                    if (!preview) {
                        preview = new TilePreview_1.TilePreview();
                        this.previewsMap[id] = preview;
                    }
                    const win = this.shell._findMetaWindow(id);
                    if (win) {
                        const monitorIndex = parseInt(activeMonitor.id);
                        if (isDragged) {
                            preview.show(win, frameGeom, monitorIndex, true, 80, 200, false); // Bright focus landing
                        }
                        else {
                            preview.show(win, frameGeom, monitorIndex, true, 80, 80, true); // Subtle secondary preview
                        }
                    }
                }
            }
            // Destroy previews for windows that are no longer affected or dragged
            const unusedIds = new Set(Object.keys(this.previewsMap));
            for (const id of Object.keys(dragStates)) {
                const isDragged = (id === this.draggedWindowId);
                let hasChanged = true;
                if (!isDragged) {
                    const cached = this.cache.getCachedWindow(id);
                    if (cached) {
                        const sameH = cached.state.hSpan[0] === dragStates[id].hSpan[0] && cached.state.hSpan[1] === dragStates[id].hSpan[1];
                        const sameV = cached.state.vSpan[0] === dragStates[id].vSpan[0] && cached.state.vSpan[1] === dragStates[id].vSpan[1];
                        if (sameH && sameV) {
                            hasChanged = false;
                        }
                    }
                }
                if (hasChanged) {
                    unusedIds.delete(id);
                }
            }
            for (const id of unusedIds) {
                this.previewsMap[id].destroy();
                delete this.previewsMap[id];
            }
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Drag update error: ${e.message}\n${e.stack}`);
        }
        return true;
    }
    onGrabEnd() {
        this.stopDragTimer();
        if (!this.draggedWindowId || !this.dragSession) {
            this.draggedWindow = null;
            this.draggedWindowId = '';
            this.lastDragStates = null;
            this.lastDragMonitor = null;
            this.dragSession = null;
            return;
        }
        global.log(`[Dynamic Tiler] Window drag ended. Active ID: ${this.draggedWindowId}`);
        const session = this.dragSession;
        this.clearPreviews();
        if (session && this.draggedWindowId) {
            const monitors = this.shell.getActiveMonitors();
            const config = this.configProvider.getConfig();
            const activeMonitor = this.lastDragMonitor || session.sourceMonitor;
            if (session.lastDragStates) {
                // SUCCESSFUL COMMIT: Apply the drag states
                global.log(`[Dynamic Tiler] Committing DnD tiling session for ${Object.keys(session.lastDragStates).length} windows`);
                // If cross-monitor move: collapse the vacancy on the source monitor first
                if (session.wasTiled && session.sourceMonitor && activeMonitor && session.sourceMonitor.id !== activeMonitor.id) {
                    global.log(`[Dynamic Tiler] Cross-monitor drag detected. Collapsing vacancy on source monitor ${session.sourceMonitor.id}`);
                    this.collapseAndApplyVacancy(this.draggedWindowId, session.sourceMonitor, config, monitors);
                }
                // Apply new geometries to all affected windows on target monitor
                for (const [id, nextState] of Object.entries(session.lastDragStates)) {
                    try {
                        const cached = this.cache.getCachedWindow(id);
                        const currentGeom = this.shell.getWindowGeometry(id);
                        const originalGeom = cached ? cached.originalGeometry : currentGeom;
                        this.shell.unmaximizeWindow(id);
                        const nextStateTyped = nextState;
                        const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(nextStateTyped, activeMonitor, config);
                        this.shell.applyGeometry(id, nextGeom);
                        const hasPreview = this.enablePreview !== false;
                        const delay = hasPreview ? 100 : 20;
                        imports.mainloop.timeout_add(delay, () => {
                            try {
                                const realGeom = this.shell.getWindowGeometry(id);
                                this.cache.saveState(id, nextStateTyped, realGeom, originalGeom);
                            }
                            catch (err) {
                                this.cache.saveState(id, nextStateTyped, nextGeom, originalGeom);
                            }
                            return false;
                        });
                    }
                    catch (e) {
                        global.logError(`[Dynamic Tiler] DnD Apply error for window ${id}: ${e.message}`);
                    }
                }
            }
            else {
                // FLOAT OR CANCEL:
                // If window was tiled originally, we must collapse the vacancy on its source monitor
                if (session.wasTiled && session.sourceMonitor) {
                    global.log(`[Dynamic Tiler] DnD Cancelled/Floated: Collapsing vacancy on source monitor ${session.sourceMonitor.id} for window ${this.draggedWindowId}`);
                    this.collapseAndApplyVacancy(this.draggedWindowId, session.sourceMonitor, config, monitors);
                    this.cache.clearState(this.draggedWindowId);
                }
            }
        }
        this.draggedWindow = null;
        this.draggedWindowId = '';
        this.lastDragStates = null;
        this.lastDragMonitor = null;
        this.dragSession = null;
    }
    collapseAndApplyVacancy(draggedId, monitor, config, monitors) {
        try {
            const visibleWindowIds = this.shell.getVisibleWindowIds();
            const activeWindowsOnMonitor = [];
            for (const id of visibleWindowIds) {
                const cached = this.cache.getCachedWindow(id);
                if (cached) {
                    let currentMonitor = monitor;
                    try {
                        const geom = this.shell.getWindowGeometry(id);
                        currentMonitor = this.shell.findMonitorForWindow(geom, monitors);
                    }
                    catch {
                        currentMonitor = this.shell.findMonitorForWindow(cached.tiledGeometry, monitors);
                    }
                    if (currentMonitor.id === monitor.id) {
                        activeWindowsOnMonitor.push({
                            windowId: id,
                            state: cached.state
                        });
                    }
                }
            }
            const collapsedStates = (0, DragTiling_1.collapseVacancy)(draggedId, config, activeWindowsOnMonitor);
            // Physially apply the collapsed geometries with animations to remaining windows
            for (const [id, nextState] of Object.entries(collapsedStates)) {
                try {
                    const cached = this.cache.getCachedWindow(id);
                    const currentGeom = this.shell.getWindowGeometry(id);
                    const originalGeom = cached ? cached.originalGeometry : currentGeom;
                    const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(nextState, monitor, config);
                    this.shell.applyGeometry(id, nextGeom);
                    const hasPreview = this.enablePreview !== false;
                    const delay = hasPreview ? 100 : 20;
                    imports.mainloop.timeout_add(delay, () => {
                        try {
                            const realGeom = this.shell.getWindowGeometry(id);
                            this.cache.saveState(id, nextState, realGeom, originalGeom);
                        }
                        catch (err) {
                            this.cache.saveState(id, nextState, nextGeom, originalGeom);
                        }
                        return false;
                    });
                }
                catch (e) {
                    global.logError(`[Dynamic Tiler] Collapse apply error for window ${id}: ${e.message}`);
                }
            }
            // Remove the dragged window from the tiling engine cache (makes it a free floating window)
            this.cache.clearState(draggedId);
            global.log(`[Dynamic Tiler] Successfully collapsed grid vacancy and cleared state for ${draggedId}`);
        }
        catch (err) {
            global.logError(`[Dynamic Tiler] Failed to collapse and apply vacancy: ${err.message}`);
        }
    }
    restoreAndCollapseActiveWindow() {
        try {
            const windowId = this.shell.getActiveWindowId();
            if (!windowId)
                return;
            const cached = this.cache.getCachedWindow(windowId);
            if (cached && cached.originalGeometry) {
                const monitors = this.shell.getActiveMonitors();
                const geom = this.shell.getWindowGeometry(windowId);
                const activeMonitor = this.shell.findMonitorForWindow(geom, monitors);
                const config = this.configProvider.getConfig();
                // 1. Collapse the grid vacancy left by this window
                this.collapseAndApplyVacancy(windowId, activeMonitor, config, monitors);
                // 2. Restore the window back to its original layout and free floating state
                this.shell.unmaximizeWindow(windowId);
                this.shell.applyGeometry(windowId, cached.originalGeometry);
                this.cache.clearState(windowId);
                global.log(`[Dynamic Tiler] Successfully restored and collapsed window ${windowId}`);
            }
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to restore and collapse window: ${e.message}`);
        }
    }
    stopDragTimer() {
        if (this.dragTimerId) {
            imports.mainloop.source_remove(this.dragTimerId);
            this.dragTimerId = 0;
        }
    }
    clearPreviews() {
        for (const [id, preview] of Object.entries(this.previewsMap)) {
            try {
                preview.hide();
                preview.destroy();
            }
            catch (e) { }
        }
        this.previewsMap = {};
        if (this.vacancyPreview) {
            try {
                this.vacancyPreview.hide();
                this.vacancyPreview.destroy();
            }
            catch (e) { }
            this.vacancyPreview = null;
        }
    }
    applyConfigurationChange() {
        try {
            const config = this.configProvider.getConfig();
            const visibleWindowIds = this.shell.getVisibleWindowIds();
            const monitors = this.shell.getActiveMonitors();
            for (const id of visibleWindowIds) {
                const cached = this.cache.getCachedWindow(id);
                if (!cached)
                    continue;
                try {
                    const currentGeom = this.shell.getWindowGeometry(id);
                    const monitor = this.shell.findMonitorForWindow(currentGeom, monitors);
                    const nextGeom = TilingEngine_1.TilingEngine.stateToGeometry(cached.state, monitor, config);
                    const win = this.shell._findMetaWindow(id);
                    if (win) {
                        if (win.maximized_horz || win.maximized_vert) {
                            win.unmaximize(Meta.MaximizeFlags.BOTH);
                        }
                        win.move_resize_frame(true, nextGeom.x, nextGeom.y, nextGeom.width, nextGeom.height);
                        this.cache.saveState(id, cached.state, nextGeom, cached.originalGeometry);
                    }
                }
                catch (e) {
                    // Ignore failures for individual windows
                }
            }
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to apply config change: ${e}`);
        }
    }
    registerKeybinding(settingName, action) {
        // Bind setting change to listen to updates
        this.settings.bindProperty(Settings.BindingDirection.IN, settingName, settingName, () => {
            this.updateHotKey(settingName, action);
        });
        // Initial binding
        this.updateHotKey(settingName, action);
    }
    updateHotKey(settingName, action) {
        const key = `dynamic-tiler-${settingName}`;
        const value = this[settingName];
        // Clean up old keybinding if active
        if (this.bindings[key]) {
            Main.keybindingManager.removeHotKey(key);
            delete this.bindings[key];
        }
        if (!value || value === '')
            return;
        try {
            Main.keybindingManager.addHotKey(key, value, () => {
                try {
                    if (action === 'restore') {
                        this.restoreAndCollapseActiveWindow();
                    }
                    else {
                        this.useCase.tile(action);
                    }
                }
                catch (e) {
                    global.logError(`[Dynamic Tiler] Execution error for action ${action}: ${e.message}`);
                }
            });
            this.bindings[key] = value;
        }
        catch (e) {
            global.logError(`[Dynamic Tiler] Failed to register hotkey ${value}: ${e}`);
        }
    }
}
// Global instance variable
let extensionInstance = null;
function init(metadata) {
    extensionInstance = new DynamicTilerExtension(metadata);
}
function enable() {
    if (extensionInstance) {
        extensionInstance.enable();
    }
}
function disable() {
    if (extensionInstance) {
        extensionInstance.disable();
    }
}
